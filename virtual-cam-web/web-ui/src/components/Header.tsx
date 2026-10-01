import React from 'react'

interface HeaderProps {
  mode: 'browser' | 'desktop-agent'
  connected: boolean
  pairedAgentId: string | null
  pairedAgentName: string | null
  obsConnected: boolean
  virtualCamActive: boolean
  streaming: boolean
  streamState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'
  onModeChange: (mode: 'browser' | 'desktop-agent') => void
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  connected,
  pairedAgentId,
  pairedAgentName,
  obsConnected,
  virtualCamActive,
  streaming,
  streamState,
  onModeChange,
}) => {
  const getStreamStateColor = (state: typeof streamState) => {
    switch (state) {
      case 'connected': return '#00d4aa'
      case 'connecting': return '#ffa500'
      case 'failed': return '#ff4444'
      case 'disconnected': return '#888'
      default: return '#888'
    }
  }

  const getStreamStateLabel = (state: typeof streamState) => {
    switch (state) {
      case 'connected': return 'LIVE'
      case 'connecting': return 'CONNECTING...'
      case 'failed': return 'FAILED'
      case 'disconnected': return 'DISCONNECTED'
      default: return 'OFFLINE'
    }
  }

  return (
    <header className="header">
      <div className="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        VirtualCam
      </div>
      <div className="mode-switcher">
        <button
          className={`mode-btn ${mode === 'browser' ? 'active' : ''}`}
          onClick={() => onModeChange('browser')}
          title="Browser Mode - All processing in browser, works on mobile"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          <span>Browser</span>
        </button>
        <button
          className={`mode-btn ${mode === 'desktop-agent' ? 'active' : ''}`}
          onClick={() => onModeChange('desktop-agent')}
          title="Desktop Agent Mode - Connect to OBS on your computer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M2 9h20" />
          </svg>
          <span>Desktop Agent</span>
        </button>
      </div>
      <div className="header-right">
        <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
          {mode === 'desktop-agent' ? (connected ? 'Server Connected' : 'Server Disconnected') : 'Browser Mode'}
        </span>
        {pairedAgentId && (
          <span className="paired-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {pairedAgentName || pairedAgentId.slice(0, 8)}
          </span>
        )}
        {mode === 'desktop-agent' && (
          <>
            <span className={`status-badge ${obsConnected ? 'connected' : 'disconnected'}`}>
              OBS: {obsConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className={`status-badge ${virtualCamActive ? 'connected' : 'disconnected'}`}>
              Camera: {virtualCamActive ? 'Live' : 'Offline'}
            </span>
          </>
        )}
        {mode === 'browser' && streaming && (
          <span className="status-badge streaming" style={{ backgroundColor: getStreamStateColor(streamState), borderColor: getStreamStateColor(streamState) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'pulse 1s infinite' }}>
              <circle cx="12" cy="12" r="10" />
            </svg>
            {getStreamStateLabel(streamState)}
          </span>
        )}
      </div>
    </header>
  )
}
