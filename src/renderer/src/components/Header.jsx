import React from 'react'

export default function Header({
  obsConnected,
  virtualCamActive,
  onOBSConnect,
  onOBSDisconnect,
  obsConfig,
  setOBSConfig,
}) {
  return (
    <header className="header">
      <div className="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        VirtualCam Pro
      </div>
      <div className="header-actions">
        <div className="status-indicator status-connected">
          <span>OBS: {obsConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="status-indicator status-connected">
          <span>Camera: {virtualCamActive ? 'Live' : 'Offline'}</span>
        </div>
        {!obsConnected ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Host"
              value={obsConfig.host}
              onChange={(e) => setOBSConfig({ ...obsConfig, host: e.target.value })}
              style={{ width: '100px', padding: '8px', background: '#0f3460', border: '1px solid #2a2a4a', borderRadius: '6px', color: '#eee' }}
            />
            <input
              type="number"
              placeholder="Port"
              value={obsConfig.port}
              onChange={(e) => setOBSConfig({ ...obsConfig, port: parseInt(e.target.value) })}
              style={{ width: '70px', padding: '8px', background: '#0f3460', border: '1px solid #2a2a4a', borderRadius: '6px', color: '#eee' }}
            />
            <input
              type="password"
              placeholder="Password (optional)"
              value={obsConfig.password}
              onChange={(e) => setOBSConfig({ ...obsConfig, password: e.target.value })}
              style={{ width: '140px', padding: '8px', background: '#0f3460', border: '1px solid #2a2a4a', borderRadius: '6px', color: '#eee' }}
            />
            <button className="btn btn-primary" onClick={onOBSConnect}>Connect</button>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={onOBSDisconnect}>Disconnect</button>
        )}
      </div>
    </header>
  )
}