import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { useStore } from '../store'
import type { ConnectionState } from '../lib/webrtc-manager'
import type { StreamStats } from '../lib/webrtc-manager'

interface PreviewAreaProps {
  streaming: boolean
  streamState: ConnectionState
  streamStats: StreamStats | null
}

export const PreviewArea = forwardRef<HTMLVideoElement, PreviewAreaProps>((props, ref) => {
  const { mirrorPreview, mode, pairedAgentId } = useStore()
  const { streaming, streamState, streamStats } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [showPlaceholder, setShowPlaceholder] = useState(true)

  // Expose video ref to parent
  useImperativeHandle(ref, () => videoRef.current!)

  // Request local camera for preview in desktop-agent mode
  useEffect(() => {
    if (mode !== 'desktop-agent' || !pairedAgentId) return

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        setLocalStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setShowPlaceholder(false)
      })
      .catch(err => {
        console.warn('Could not access camera for preview:', err)
        setShowPlaceholder(true)
      })

    return () => {
      localStream?.getTracks().forEach(t => t.stop())
    }
  }, [mode, pairedAgentId])

  // In browser mode, the stream comes from App.tsx media pipeline
  useEffect(() => {
    if (mode === 'browser') {
      setShowPlaceholder(false)
    }
  }, [mode])

  // Render loop for canvas preview (desktop-agent mode only)
  useEffect(() => {
    if (mode === 'browser') return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const renderFrame = () => {
      if (!video || video.readyState < 2) {
        requestAnimationFrame(renderFrame)
        return
      }

      const targetWidth = 1280
      const targetHeight = 720
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw video (mirrored for preview)
      ctx.save()
      if (mirrorPreview) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      requestAnimationFrame(renderFrame)
    }

    renderFrame()
  }, [mirrorPreview, mode])

  const getStreamStateColor = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return '#00d4aa'
      case 'connecting': return '#ffa500'
      case 'failed': return '#ff4444'
      case 'disconnected': return '#888'
      default: return '#888'
    }
  }

  const getStreamStateLabel = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return 'LIVE'
      case 'connecting': return 'CONNECTING...'
      case 'failed': return 'FAILED'
      case 'disconnected': return 'DISCONNECTED'
      default: return 'OFFLINE'
    }
  }

  if (showPlaceholder && mode === 'desktop-agent') {
    return (
      <div className="preview-area">
        <div className="placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No Camera Preview</p>
            <p style={{ fontSize: '0.85rem' }}>Connect to an agent and start camera to see preview</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="preview-area">
      {mode === 'browser' ? (
        <>
          <video
            ref={videoRef}
            className={`video-preview ${mirrorPreview ? 'mirrored' : ''}`}
            autoPlay
            playsInline
            muted
            style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', borderRadius: '8px' }}
          />
          {streaming && (
            <div className="stream-overlay">
              <div className="stream-badge" style={{ backgroundColor: getStreamStateColor(streamState), borderColor: getStreamStateColor(streamState) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'pulse 1s infinite' }}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {getStreamStateLabel(streamState)}
              </div>
              {streamStats && streamState === 'connected' && (
                <div className="preview-stats">
                  <span>{streamStats.resolution.width}×{streamStats.resolution.height} @ {streamStats.framerate.toFixed(1)}fps</span>
                  <span>{streamStats.bitrate.toFixed(0)} kbps</span>
                  <span>{streamStats.rtt.toFixed(0)}ms RTT</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <video
            ref={videoRef}
            className={`video-preview ${mirrorPreview ? 'mirrored' : ''}`}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />
          <canvas
            ref={canvasRef}
            className={`video-preview ${mirrorPreview ? 'mirrored' : ''}`}
            style={{ width: '100%', height: 'auto', maxWidth: '100%', borderRadius: '8px', background: '#1a1a1a' }}
          />
        </>
      )}
    </div>
  )
})

PreviewArea.displayName = 'PreviewArea'