const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron')
const path = require('path')
const { io } = require('socket.io-client')
const { OBSWebSocket } = require('obs-websocket-js')

let mainWindow = null
let tray = null
let obsWs = null
let socket = null
let agentId = null
let clientId = null
let mediaStream = null
let processedStream = null
let isRunning = false

// Quality presets
const qualityPresets = {
  ultra: { width: 3840, height: 2160, fps: 60, bitrate: 20000 },
  high: { width: 1920, height: 1080, fps: 30, bitrate: 8000 },
  medium: { width: 1280, height: 720, fps: 30, bitrate: 3500 },
  low: { width: 854, height: 480, fps: 24, bitrate: 1500 },
}

let currentQuality = qualityPresets.high
let currentSettings = {
  // Video
  videoInput: null,
  maskImage: null,
  maskVideo: null,
  useMask: false,
  mirrorPreview: true,
  // Voice
  voiceEnabled: false,
  voiceSettings: {
    pitch: 1.0,
    formant: 1.0,
    robot: 0,
    reverb: 0,
    noiseGate: -40,
    compression: 0,
    equalizer: { low: 0, mid: 0, high: 0 },
  },
  // Background
  backgroundEnabled: false,
  backgroundMode: 'blur',
  backgroundImage: null,
  backgroundColor: '#000000',
  blurAmount: 15,
  segmentationThreshold: 0.5,
}

// Audio processing
let audioContext = null
let audioProcessor = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Connect to Server', click: () => connectToServer() },
    { label: 'Disconnect', click: () => disconnectFromServer() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
  ])

  tray.setToolTip('VirtualCam Agent')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show())
}

// Connect to relay server
async function connectToServer(serverUrl = process.env.RELAY_SERVER_URL || 'http://localhost:3001') {
  if (socket?.connected) return

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    console.log('Connected to relay server')
    // Register as agent
    socket.emit('agent:register', {
      name: `Agent-${require('os').hostname()}`,
      capabilities: ['obs', 'camera', 'voice', 'background']
    })
    sendStatus()
  })

  socket.on('disconnect', () => {
    console.log('Disconnected from relay server')
    agentId = null
    clientId = null
    sendStatus()
  })

  socket.on('agent:registered', (data) => {
    agentId = data.agentId
    console.log('Agent registered:', agentId)
    sendStatus()
  })

  socket.on('agent:paired', (data) => {
    clientId = data.clientId
    console.log('Paired with client:', clientId)
    sendStatus()
  })

  socket.on('agent:unpaired', () => {
    clientId = null
    console.log('Unpaired from client')
    sendStatus()
  })

  socket.on('agent:command', async (data) => {
    await handleCommand(data)
  })

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message)
  })
}

function disconnectFromServer() {
  if (socket) {
    socket.disconnect()
    socket = null
    agentId = null
    clientId = null
    sendStatus()
  }
}

// Send status to UI
function sendStatus() {
  if (mainWindow) {
    mainWindow.webContents.send('agent:status', {
      connected: socket?.connected || false,
      agentId,
      clientId,
      paired: !!clientId,
      obsConnected: !!obsWs,
      virtualCamActive: isRunning,
      currentSettings
    })
  }
}

// Handle commands from web UI
async function handleCommand(data) {
  const { commandId, command, payload } = data
  
  try {
    let result = null
    
    switch (command) {
      case 'obs-connect':
        result = await handleOBSConnect(payload)
        break
      case 'obs-disconnect':
        result = await handleOBSDisconnect()
        break
      case 'obs-set-scene':
        result = await handleOBSSetScene(payload.sceneName)
        break
      case 'set-video-input':
        result = await handleSetVideoInput(payload.deviceId)
        break
      case 'set-audio-input':
        result = await handleSetAudioInput(payload.deviceId)
        break
      case 'set-voice-settings':
        result = await handleSetVoiceSettings(payload)
        break
      case 'set-background':
        result = await handleSetBackground(payload)
        break
      case 'set-quality':
        result = await handleSetQuality(payload)
        break
      case 'start-camera':
        result = await handleStartCamera()
        break
      case 'stop-camera':
        result = await handleStopCamera()
        break
      default:
        throw new Error(`Unknown command: ${command}`)
    }
    
    // Send response
    if (clientId && socket) {
      socket.emit('agent:response', {
        clientId,
        commandId,
        success: true,
        result
      })
    }
    
    sendStatus()
  } catch (error) {
    console.error(`Command ${command} failed:`, error)
    if (clientId && socket) {
      socket.emit('agent:response', {
        clientId,
        commandId,
        success: false,
        error: error.message
      })
    }
  }
}

// OBS Handlers
async function handleOBSConnect(config) {
  if (obsWs) await obsWs.disconnect()
  
  obsWs = new OBSWebSocket()
  await obsWs.connect(`ws://${config.host}:${config.port}`, config.password)
  
  const scenes = await obsWs.call('GetSceneList')
  const sources = await obsWs.call('GetInputList')
  const camStatus = await obsWs.call('GetVirtualCamStatus')
  
  currentSettings.obsConfig = config
  
  if (mainWindow) {
    mainWindow.webContents.send('obs:scenes', scenes.scenes)
    mainWindow.webContents.send('obs:sources', sources.inputs)
    mainWindow.webContents.send('obs:virtual-cam-status', camStatus.outputActive)
  }
  
  return { scenes: scenes.scenes, sources: sources.inputs, virtualCamActive: camStatus.outputActive }
}

async function handleOBSDisconnect() {
  if (obsWs) {
    await obsWs.disconnect()
    obsWs = null
  }
  return { success: true }
}

async function handleOBSSetScene(sceneName) {
  if (!obsWs) throw new Error('Not connected to OBS')
  await obsWs.call('SetCurrentProgramScene', { sceneName })
  return { success: true }
}

// Media Handlers
async function handleSetVideoInput(deviceId) {
  currentSettings.videoInput = deviceId
  if (isRunning) {
    await restartCamera()
  }
  return { success: true }
}

async function handleSetAudioInput(deviceId) {
  currentSettings.audioInput = deviceId
  if (isRunning && currentSettings.voiceEnabled) {
    await restartCamera()
  }
  return { success: true }
}

async function handleSetVoiceSettings(settings) {
  currentSettings.voiceSettings = { ...currentSettings.voiceSettings, ...settings }
  if (isRunning && currentSettings.voiceEnabled) {
    await restartCamera()
  }
  return { success: true }
}

async function handleSetBackground(settings) {
  Object.assign(currentSettings, settings)
  // Background is handled in render loop
  return { success: true }
}

async function handleSetQuality(quality) {
  currentQuality = { ...currentQuality, ...quality }
  if (isRunning) {
    await restartCamera()
  }
  return { success: true }
}

// Camera Pipeline
async function handleStartCamera() {
  if (isRunning) return { success: true }
  
  try {
    // Get media stream
    const constraints = {
      video: {
        deviceId: currentSettings.videoInput ? { exact: currentSettings.videoInput } : undefined,
        width: { ideal: currentQuality.width },
        height: { ideal: currentQuality.height },
        frameRate: { ideal: currentQuality.fps }
      },
      audio: {
        deviceId: currentSettings.audioInput ? { exact: currentSettings.audioInput } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }
    
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
    
    // Process audio if voice enabled
    let finalStream = mediaStream
    if (currentSettings.voiceEnabled) {
      finalStream = await processAudio(mediaStream)
    }
    
    // Start virtual camera via OBS
    if (obsWs) {
      await obsWs.call('StartVirtualCam')
    }
    
    isRunning = true
    processedStream = finalStream
    
    // Notify UI
    if (mainWindow) {
      mainWindow.webContents.send('camera:started', { stream: finalStream })
    }
    
    return { success: true }
  } catch (error) {
    console.error('Failed to start camera:', error)
    throw error
  }
}

async function handleStopCamera() {
  if (!isRunning) return { success: true }
  
  // Stop OBS virtual camera
  if (obsWs) {
    await obsWs.call('StopVirtualCam')
  }
  
  // Stop media tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  
  if (processedStream) {
    processedStream.getTracks().forEach(t => t.stop())
    processedStream = null
  }
  
  // Cleanup audio
  if (audioContext) {
    await audioContext.close()
    audioContext = null
  }
  
  isRunning = false
  
  if (mainWindow) {
    mainWindow.webContents.send('camera:stopped')
  }
  
  return { success: true }
}

async function restartCamera() {
  await handleStopCamera()
  await handleStartCamera()
}

// Audio Processing (Web Audio API)
async function processAudio(inputStream) {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 48000 })
  }
  
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  
  const source = audioContext.createMediaStreamSource(inputStream)
  const destination = audioContext.createMediaStreamDestination()
  
  // Create processing chain
  const gain = audioContext.createGain()
  gain.gain.value = 1
  
  // Noise Gate
  const noiseGate = audioContext.createDynamicsCompressor()
  noiseGate.threshold.value = currentSettings.voiceSettings.noiseGate
  noiseGate.knee.value = 10
  noiseGate.ratio.value = 20
  noiseGate.attack.value = 0.001
  noiseGate.release.value = 0.1
  
  // EQ
  const eqLow = audioContext.createBiquadFilter()
  eqLow.type = 'lowshelf'
  eqLow.frequency.value = 250
  eqLow.gain.value = currentSettings.voiceSettings.equalizer.low
  
  const eqMid = audioContext.createBiquadFilter()
  eqMid.type = 'peaking'
  eqMid.frequency.value = 1000
  eqMid.Q.value = 1
  eqMid.gain.value = currentSettings.voiceSettings.equalizer.mid
  
  const eqHigh = audioContext.createBiquadFilter()
  eqHigh.type = 'highshelf'
  eqHigh.frequency.value = 4000
  eqHigh.gain.value = currentSettings.voiceSettings.equalizer.high
  
  // Pitch shift (using delay line modulation)
  let currentNode = source
  
  // Noise gate first
  currentNode.connect(noiseGate)
  currentNode = noiseGate
  
  // EQ chain
  currentNode.connect(eqLow)
  eqLow.connect(eqMid)
  eqMid.connect(eqHigh)
  currentNode = eqHigh
  
  // Pitch shifting
  if (currentSettings.voiceSettings.pitch !== 1.0) {
    const pitchShifter = audioContext.createDelay(1.0)
    const lfo = audioContext.createOscillator()
    const lfoGain = audioContext.createGain()
    
    lfo.type = 'sine'
    lfo.frequency.value = 0.5
    lfoGain.gain.value = 0.01 * (currentSettings.voiceSettings.pitch - 1)
    
    lfo.connect(lfoGain)
    lfoGain.connect(pitchShifter.delayTime)
    lfo.start()
    
    currentNode.connect(pitchShifter)
    currentNode = pitchShifter
  }
  
  // Robot effect (ring modulation)
  if (currentSettings.voiceSettings.robot > 0) {
    const ringMod = audioContext.createGain()
    const ringOsc = audioContext.createOscillator()
    const ringGain = audioContext.createGain()
    
    ringOsc.type = 'sine'
    ringOsc.frequency.value = 30 + currentSettings.voiceSettings.robot * 200
    ringGain.gain.value = currentSettings.voiceSettings.robot
    
    currentNode.connect(ringMod)
    ringOsc.connect(ringGain)
    ringGain.connect(ringMod.gain)
    ringOsc.start()
    
    currentNode = ringMod
  }
  
  // Reverb
  if (currentSettings.voiceSettings.reverb > 0) {
    const convolver = audioContext.createConvolver()
    const impulse = generateImpulseResponse(2, 2 + currentSettings.voiceSettings.reverb * 3)
    convolver.buffer = impulse
    convolver.normalize = true
    
    const dryGain = audioContext.createGain()
    const wetGain = audioContext.createGain()
    dryGain.gain.value = 1 - currentSettings.voiceSettings.reverb * 0.5
    wetGain.gain.value = currentSettings.voiceSettings.reverb * 0.5
    
    currentNode.connect(dryGain)
    currentNode.connect(convolver)
    convolver.connect(wetGain)
    
    const reverbMerge = audioContext.createGain()
    dryGain.connect(reverbMerge)
    wetGain.connect(reverbMerge)
    
    currentNode = reverbMerge
  }
  
  // Compression
  if (currentSettings.voiceSettings.compression > 0) {
    const compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -24 - currentSettings.voiceSettings.compression * 20
    compressor.knee.value = 30
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    
    currentNode.connect(compressor)
    currentNode = compressor
  }
  
  // Final gain
  currentNode.connect(gain)
  gain.connect(destination)
  
  // Create output stream with video from input + processed audio
  const outputStream = new MediaStream()
  inputStream.getVideoTracks().forEach(t => outputStream.addTrack(t))
  destination.stream.getAudioTracks().forEach(t => outputStream.addTrack(t))
  
  return outputStream
}

function generateImpulseResponse(duration, decay) {
  const sampleRate = audioContext.sampleRate
  const length = sampleRate * duration
  const impulse = audioContext.createBuffer(2, length, sampleRate)
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const n = length - i
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay)
    }
  }
  
  return impulse
}

// Server connection IPC handlers
ipcMain.handle('connect-to-server', async (event, serverUrl) => {
  await connectToServer(serverUrl)
  return { success: true }
})

ipcMain.handle('disconnect-from-server', async () => {
  disconnectFromServer()
  return { success: true }
})

// File dialogs
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  })
  return result
})

ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }],
  })
  return result
})

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (socket) socket.disconnect()
  if (obsWs) obsWs.disconnect()
})

// Heartbeat
setInterval(() => {
  if (socket?.connected) {
    socket.emit('agent:heartbeat', { agentId })
  }
}, 10000)