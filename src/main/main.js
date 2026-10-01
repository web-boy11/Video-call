const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let tray = null
let obsProcess = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Required for camera/media access
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
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

  // Handle window close - minimize to tray instead
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
    { label: 'Start Virtual Camera', click: () => mainWindow?.webContents.send('start-virtual-cam') },
    { label: 'Stop Virtual Camera', click: () => mainWindow?.webContents.send('stop-virtual-cam') },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
  ])

  tray.setToolTip('VirtualCam Pro')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show())
}

// OBS WebSocket connection management
let obsWs = null

ipcMain.handle('obs-connect', async (event, { host, port, password }) => {
  try {
    const { OBSWebSocket } = require('obs-websocket-js')
    obsWs = new OBSWebSocket()
    await obsWs.connect(`ws://${host}:${port}`, password)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-disconnect', async () => {
  if (obsWs) {
    await obsWs.disconnect()
    obsWs = null
  }
  return { success: true }
})

ipcMain.handle('obs-set-scene', async (event, sceneName) => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    await obsWs.call('SetCurrentProgramScene', { sceneName })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-set-source', async (event, { sceneName, sourceName, settings }) => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    await obsWs.call('SetInputSettings', { inputName: sourceName, inputSettings: settings, overlay: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-get-scenes', async () => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    const result = await obsWs.call('GetSceneList')
    return { success: true, scenes: result.scenes }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-get-sources', async () => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    const result = await obsWs.call('GetInputList')
    return { success: true, sources: result.inputs }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-start-virtual-cam', async () => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    await obsWs.call('StartVirtualCam')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-stop-virtual-cam', async () => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    await obsWs.call('StopVirtualCam')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('obs-get-virtual-cam-status', async () => {
  if (!obsWs) return { success: false, error: 'Not connected' }
  try {
    const result = await obsWs.call('GetVirtualCamStatus')
    return { success: true, status: result.outputActive }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Audio device enumeration
ipcMain.handle('get-audio-devices', async () => {
  // This will be handled in renderer via navigator.mediaDevices
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
  if (obsWs) obsWs.disconnect()
})