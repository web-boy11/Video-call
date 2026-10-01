import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { WebRTCManager, DEFAULT_WEBRTC_CONFIG, type ConnectionState } from '../lib/webrtc-manager'

// Extract room ID from URL
const getRoomId = () => {
  const path = window.location.pathname
  const match = path.match(/\/view\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

export const ViewerPage: React.FC = () => {
  const roomId = getRoomId()
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [state, setState] = useState<ConnectionState>('new')
  const [stats, setStats] = useState<{ bitrate: number; framerate: number; packetsLost: number; rtt: number; resolution: { width: number; height: number } } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const webrtcRef = useRef<WebRTCManager | null>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    if (!roomId) {
      setError('Invalid room ID')
      return
    }

    const initViewer = async () => {
      try {
        setState('connecting')

        // Connect to signaling server
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const socket = io(serverUrl, { transports: ['websocket'] })
        socketRef.current = socket

        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve())
          socket.on('connect_error', reject)
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        })

        // Join room as viewer
        socket.emit('webrtc:join', { roomId, role: 'viewer' })

        // Create WebRTC manager
        const webrtc = new WebRTCManager(DEFAULT_WEBRTC_CONFIG)
        webrtcRef.current = webrtc

        webrtc.setOnStateChange((newState) => {
          setState(newState)
        })

        webrtc.setOnStats((newStats) => {
          setStats(newStats)
        })

        // Handle offer from broadcaster
        socket.on('webrtc:offer', async (data: { offer: RTCSessionDescriptionInit }) => {
          try {
            const answer = await webrtc.initAsReceiver(data.offer)
            socket.emit('webrtc:answer', { roomId, answer })
          } catch (err) {
            console.error('Error handling offer:', err)
            setError('Failed to handle offer')
          }
        })

        // Handle ICE candidates
        socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
          await webrtc.addIceCandidate(data.candidate)
        })

        // Handle incoming stream
                webrtc.setOnRemoteStream((remoteStream) => {
                  setStream(remoteStream)
                })
        
                webrtc.onIceCandidate = (candidate) => {
                  socket.emit('webrtc:ice-candidate', { roomId, candidate })
                }

      } catch (err) {
        console.error('Viewer init error:', err)
        setError(err instanceof Error ? err.message : 'Failed to connect')
        setState('failed')
      }
    }

    initViewer()

    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.close()
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [roomId])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  const getStateColor = (s: ConnectionState) => {
    switch (s) {
      case 'connected': return '#00d4aa'
      case 'connecting': return '#ffa500'
      case 'failed': return '#ff4444'
      case 'disconnected': return '#888'
      default: return '#888'
    }
  }

  const getStateLabel = (s: ConnectionState) => {
    switch (s) {
      case 'connected': return 'LIVE'
      case 'connecting': return 'CONNECTING...'
      case 'failed': return 'FAILED'
      case 'disconnected': return 'DISCONNECTED'
      default: return 'WAITING'
    }
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ marginBottom: '8px' }}>Connection Failed</h1>
        <p style={{ color: '#888', maxWidth: '400px' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '24px',
            padding: '12px 24px',
            background: '#00d4aa',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0f0f0f',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>VirtualCam Stream</div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Room: {roomId}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: getStateColor(state),
            color: state === 'connected' ? '#000' : '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: state === 'connected' ? 'pulse 1s infinite' : 'none' }}>
              <circle cx="12" cy="12" r="10" />
            </svg>
            {getStateLabel(state)}
          </span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{
          width: '100%',
          maxWidth: '1280px',
          aspectRatio: '16/9',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#1a1a1a',
          position: 'relative',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {state !== 'connected' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              gap: '16px',
            }}>
              <div style={{ fontSize: '3rem' }}>
                {state === 'connecting' ? '⏳' : state === 'failed' ? '❌' : '📡'}
              </div>
              <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{getStateLabel(state)}</p>
              {state === 'connecting' && <p style={{ color: '#888' }}>Waiting for broadcaster to start streaming...</p>}
              {state === 'failed' && <p style={{ color: '#ff4444' }}>Failed to connect. The stream may have ended.</p>}
            </div>
          )}
        </div>

        {stats && state === 'connected' && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: '1280px',
            width: '100%',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bitrate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#00d4aa' }}>{stats.bitrate.toFixed(0)} kbps</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Framerate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.framerate.toFixed(1)} fps</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolution</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.resolution.width}×{stats.resolution.height}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latency</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: stats.rtt < 100 ? '#00d4aa' : stats.rtt < 200 ? '#ffa500' : '#ff4444' }}>{stats.rtt.toFixed(0)} ms</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Packets Lost</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: stats.packetsLost > 10 ? '#ff4444' : '#888' }}>{stats.packetsLost}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>
          <p>Open this page on your computer, allow camera/mic permissions, then select "VirtualCam Stream" in Zoom/Teams/Meet/Discord</p>
        </div>
      </main>
    </div>
  )
}