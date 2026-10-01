import { useEffect, useRef, useCallback } from 'react'
import { useStore } from './store'
import { voiceChanger } from './lib/voice-changer'
import { backgroundRemover } from './lib/background-remover'
import { WebRTCManager, DEFAULT_WEBRTC_CONFIG } from './lib/webrtc-manager'
import { io } from 'socket.io-client'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { PreviewArea } from './components/PreviewArea'
import { ControlsBar } from './components/ControlsBar'
import { StreamingPanel } from './components/StreamingPanel'
import './App.css'

// Global references for media pipeline
let mediaPipeline: {
  sourceStream: MediaStream | null
  processedStream: MediaStream | null
  videoElement: HTMLVideoElement | null
  canvas: HTMLCanvasElement | null
  animationFrame: number | null
  webrtc: WebRTCManager | null
} = {
  sourceStream: null,
  processedStream: null,
  videoElement: null,
  canvas: null,
  animationFrame: null,
  webrtc: null,
}

function App() {
  const {
    mode,
    connectToServer,
    registerClient,
    connected,
    pairedAgentId,
    pairedAgentName,
    obsConnected,
    virtualCamActive,
    videoInput,
    audioInput,
    devices,
    setDevices,
    mirrorPreview,
    voiceEnabled,
    voiceSettings,
    backgroundSettings,
    qualityPreset,
    customQuality,
    streaming,
    streamState,
    streamStats,
    streamUrl,
    roomId,
    setStreaming,
    setStreamState,
    setStreamStats,
    setStreamUrl,
    setRoomId,
    onVideoInputChange,
    onAudioInputChange,
  } = useStore()

  const previewRef = useRef<HTMLVideoElement>(null)

  // Initialize media pipeline on mount (browser mode)
  useEffect(() => {
    if (mode !== 'browser') return

    const initPipeline = async () => {
      try {
        // 1. Get user media
        const constraints = getMediaConstraints()
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        mediaPipeline.sourceStream = stream

        // 2. Set up video element for background removal
        const videoEl = document.createElement('video')
        videoEl.srcObject = stream
        videoEl.playsInline = true
        videoEl.muted = true
        await videoEl.play()
        mediaPipeline.videoElement = videoEl

        // 3. Initialize background remover
        await backgroundRemover.init()
        backgroundRemover.setVideoElement(videoEl)
        backgroundRemover.setSettings(backgroundSettings)

        // 4. Initialize voice changer
        await voiceChanger.init()
        voiceChanger.setSettings(voiceSettings)
        voiceChanger.setEnabled(voiceEnabled)

        // 5. Create canvas for preview
        const canvas = document.createElement('canvas')
        canvas.width = videoEl.videoWidth || 1280
        canvas.height = videoEl.videoHeight || 720
        mediaPipeline.canvas = canvas

        // 6. Start background removal loop
        backgroundRemover.start((processedCanvas) => {
          // Update preview
          if (previewRef.current) {
            previewRef.current.srcObject = processedCanvas.captureStream(30)
          }
        })

        // 7. Process audio with voice changer
        let finalStream = stream
        if (voiceEnabled) {
          finalStream = await voiceChanger.processStream(stream)
        }
        mediaPipeline.processedStream = finalStream

        // 8. Update preview with processed stream
        if (previewRef.current) {
          previewRef.current.srcObject = finalStream
        }

        console.log('Media pipeline initialized')
      } catch (error) {
        console.error('Failed to initialize media pipeline:', error)
      }
    }

    initPipeline()

    // Enumerate devices
    enumerateDevices()

    return () => {
      cleanupPipeline()
    }
  }, [mode])

  // Re-initialize when settings change
  useEffect(() => {
    if (mode !== 'browser') return
    
    voiceChanger.setSettings(voiceSettings)
    voiceChanger.setEnabled(voiceEnabled)
    backgroundRemover.setSettings(backgroundSettings)
  }, [voiceEnabled, voiceSettings, backgroundSettings])

  // Device enumeration
  const enumerateDevices = async () => {
    try {
      // Request permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach(t => t.stop())
      
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        videoinputs: deviceList.filter(d => d.kind === 'videoinput'),
        audioinputs: deviceList.filter(d => d.kind === 'audioinput'),
      })
    } catch (error) {
      console.warn('Could not enumerate devices:', error)
    }
  }

  // Get media constraints based on quality preset
  const getMediaConstraints = useCallback(() => {
    const quality = qualityPreset !== 'custom' ? 
      ({ ultra: { width: 3840, height: 2160, fps: 60 }, high: { width: 1920, height: 1080, fps: 30 }, medium: { width: 1280, height: 720, fps: 30 }, low: { width: 854, height: 480, fps: 24 } } as any)[qualityPreset] :
      customQuality

    return {
      video: {
        deviceId: videoInput ? { exact: videoInput } : undefined,
        width: { ideal: quality.width },
        height: { ideal: quality.height },
        frameRate: { ideal: quality.fps },
        facingMode: 'user',
      },
      audio: {
        deviceId: audioInput ? { exact: audioInput } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }
  }, [qualityPreset, customQuality, videoInput, audioInput])

  // Start WebRTC streaming
  const startStreaming = async () => {
    if (!mediaPipeline.processedStream) {
      console.error('No processed stream available')
      return
    }

    try {
      setStreaming(true)
      setStreamState('connecting')

      // Generate room ID
      const newRoomId = crypto.randomUUID().slice(0, 8)
      setRoomId(newRoomId)
      
      // Create WebRTC manager
      const webrtc = new WebRTCManager(DEFAULT_WEBRTC_CONFIG)
      mediaPipeline.webrtc = webrtc

      // Set local stream
      webrtc.setLocalStream(mediaPipeline.processedStream)

      // Create offer
      const offer = await webrtc.initAsInitiator()

      // Connect to signaling server
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
      const socket = io(serverUrl, { transports: ['websocket'] })
      
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve())
        socket.on('connect_error', reject)
      })

      // Join room as broadcaster
      socket.emit('webrtc:join', { roomId: newRoomId, role: 'broadcaster' })

      // Send offer
      socket.emit('webrtc:offer', { roomId: newRoomId, offer })

      // Handle answer
      socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
        await webrtc.setRemoteDescription(data.answer)
        setStreamState('connected')
      })

      // Handle ICE candidates
      socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        await webrtc.addIceCandidate(data.candidate)
      })

      webrtc.onIceCandidate = (candidate) => {
        socket.emit('webrtc:ice-candidate', { roomId: newRoomId, candidate })
      }

      webrtc.setOnStateChange((state) => {
        setStreamState(state)
      })

      webrtc.setOnStats((stats) => {
        setStreamStats(stats)
      })

      // Viewer URL for meeting apps
      const viewerUrl = `${window.location.origin}/view/${newRoomId}`
      setStreamUrl(viewerUrl)

      // Copy to clipboard
      await navigator.clipboard.writeText(viewerUrl)
      console.log('Stream URL copied to clipboard:', viewerUrl)

    } catch (error) {
      console.error('Failed to start streaming:', error)
      setStreaming(false)
      setStreamState('failed')
    }
  }

  // Stop streaming
  const stopStreaming = () => {
    if (mediaPipeline.webrtc) {
      mediaPipeline.webrtc.close()
      mediaPipeline.webrtc = null
    }
    setStreaming(false)
    setStreamState('new')
    setStreamStats(null)
    setStreamUrl(null)
    setRoomId(null)
  }

  // Cleanup
  const cleanupPipeline = () => {
    backgroundRemover.stop()
    
    if (mediaPipeline.sourceStream) {
      mediaPipeline.sourceStream.getTracks().forEach(t => t.stop())
      mediaPipeline.sourceStream = null
    }
    if (mediaPipeline.processedStream) {
      mediaPipeline.processedStream.getTracks().forEach(t => t.stop())
      mediaPipeline.processedStream = null
    }
    if (mediaPipeline.animationFrame) {
      cancelAnimationFrame(mediaPipeline.animationFrame)
      mediaPipeline.animationFrame = null
    }
    if (mediaPipeline.webrtc) {
      mediaPipeline.webrtc.close()
      mediaPipeline.webrtc = null
    }
    mediaPipeline.videoElement = null
    mediaPipeline.canvas = null
  }

  // Desktop agent mode: connect to server
  useEffect(() => {
    if (mode === 'desktop-agent') {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
      connectToServer(serverUrl).then(() => {
        registerClient()
      }).catch(console.error)
    }
  }, [mode, connectToServer, registerClient])

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => enumerateDevices()
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [])

  return (
    <div className="app">
      <Header
        mode={mode}
        connected={mode === 'desktop-agent' ? connected : true}
        pairedAgentId={pairedAgentId}
        pairedAgentName={pairedAgentName}
        obsConnected={obsConnected}
        virtualCamActive={virtualCamActive}
        streaming={streaming}
        streamState={streamState}
        onModeChange={(m) => useStore.getState().setMode(m)}
      />
      <div className="main-layout">
        <Sidebar />
        <main className="content">
          <PreviewArea
            ref={previewRef}
            streaming={streaming}
            streamState={streamState}
            streamStats={streamStats}
          />
          <ControlsBar
            devices={devices}
            videoInput={videoInput}
            audioInput={audioInput}
            onVideoInputChange={onVideoInputChange}
            onAudioInputChange={onAudioInputChange}
            mirrorPreview={mirrorPreview}
            onMirrorPreviewChange={(v) => useStore.getState().setMirrorPreview(v)}
            voiceEnabled={voiceEnabled}
            onVoiceEnabledChange={(v) => useStore.getState().setVoiceEnabled(v)}
            backgroundSettings={backgroundSettings}
            onBackgroundSettingsChange={(s) => useStore.getState().setBackgroundSettings(s)}
            qualityPreset={qualityPreset}
            onQualityChange={(p, q) => {
              useStore.getState().setQualityPreset(p)
              if (q) useStore.getState().setCustomQuality(q)
            }}
            streaming={streaming}
            streamState={streamState}
            streamUrl={streamUrl}
            onStartStreaming={startStreaming}
            onStopStreaming={stopStreaming}
            mode={mode}
          />
          {streaming && streamUrl && roomId && (
            <StreamingPanel
              roomId={roomId}
              streamUrl={streamUrl}
              streamState={streamState}
              streamStats={streamStats}
              onStop={stopStreaming}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
