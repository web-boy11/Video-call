import type { ConnectionState } from '../lib/webrtc-manager'
import type { StreamStats } from '../lib/webrtc-manager'

interface StreamingPanelProps {
  roomId: string
  streamUrl: string
  streamState: ConnectionState
  streamStats: StreamStats | null
  onStop: () => void
}

export function StreamingPanel({ roomId, streamUrl, streamState, streamStats, onStop }: StreamingPanelProps) {
  const getStateColor = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return '#00d4aa'
      case 'connecting': return '#ffa500'
      case 'failed': return '#ff4444'
      case 'disconnected': return '#888'
      default: return '#888'
    }
  }

  const getStateLabel = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return 'LIVE'
      case 'connecting': return 'CONNECTING...'
      case 'failed': return 'FAILED'
      case 'disconnected': return 'DISCONNECTED'
      default: return 'WAITING'
    }
  }

  return (
    <div className="streaming-panel">
      <div className="stream-header">
        <h3>📡 Streaming to Meeting</h3>
        <div className={`stream-status ${streamState}`}>
          <span className="status-dot" style={{ backgroundColor: getStateColor(streamState) }} />
          <span>{getStateLabel(streamState)}</span>
        </div>
      </div>

      <div className="stream-info">
        <div className="info-row">
          <label>Room ID</label>
          <code>{roomId}</code>
        </div>
        <div className="info-row">
          <label>Viewer URL</label>
          <div className="url-with-copy">
            <input type="text" value={streamUrl} readOnly />
            <button onClick={() => navigator.clipboard.writeText(streamUrl)}>Copy</button>
          </div>
        </div>
      </div>

      {streamStats && streamState === 'connected' && (
        <div className="stream-stats">
          <h4>Stream Stats</h4>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-value">{streamStats.bitrate.toFixed(0)}</span>
              <span className="stat-label">kbps</span>
            </div>
            <div className="stat">
              <span className="stat-value">{streamStats.framerate.toFixed(1)}</span>
              <span className="stat-label">FPS</span>
            </div>
            <div className="stat">
              <span className="stat-value">{streamStats.packetsLost}</span>
              <span className="stat-label">Lost</span>
            </div>
            <div className="stat">
              <span className="stat-value">{streamStats.rtt.toFixed(0)}</span>
              <span className="stat-label">ms RTT</span>
            </div>
            <div className="stat">
              <span className="stat-value">{streamStats.resolution.width}×{streamStats.resolution.height}</span>
              <span className="stat-label">Resolution</span>
            </div>
          </div>
        </div>
      )}

      <div className="stream-instructions">
        <h4>How to use in Zoom/Teams/Meet:</h4>
        <ol>
          <li>Open <a href={streamUrl} target="_blank" rel="noopener">{streamUrl}</a> on your computer</li>
          <li>Allow camera/microphone permissions on the viewer page</li>
          <li>In your meeting app, select "VirtualCam Stream" as camera</li>
          <li>Select "VirtualCam Stream" as microphone</li>
        </ol>
      </div>

      <button className="stop-stream-btn" onClick={onStop}>
        Stop Streaming
      </button>
    </div>
  )
}