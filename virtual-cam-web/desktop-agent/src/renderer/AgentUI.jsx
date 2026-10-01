import React, { useEffect, useState } from 'react'

const AgentUI = () => {
  const [status, setStatus] = useState({
    connected: false,
    agentId: null,
    clientId: null,
    paired: false,
    obsConnected: false,
    virtualCamActive: false,
    currentSettings: {}
  })
  const [serverUrl, setServerUrl] = useState('')

  useEffect(() => {
    // Listen for status updates from main process
    if (window.electronAPI) {
      const unsub = window.electronAPI.onAgentStatus((data) => {
        setStatus(data)
      })
      return unsub
    }
  }, [])

  const connect = async () => {
    if (window.electronAPI?.connectToServer) {
      const url = serverUrl || 'http://localhost:3001'
      await window.electronAPI.connectToServer(url)
    }
  }

  const disconnect = () => {
    if (window.electronAPI?.disconnectFromServer) {
      window.electronAPI.disconnectFromServer()
    }
  }

  const startCamera = async () => {
    // This would be triggered via the socket from web UI
    console.log('Start camera requested from agent UI')
  }

  const stopCamera = async () => {
    console.log('Stop camera requested from agent UI')
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#e94560', marginBottom: '16px' }}>Connection</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '0.9rem' }}>
            Relay Server URL
          </label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:3001 or https://your-server.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
              borderRadius: '6px',
              color: '#eee',
              fontSize: '0.9rem',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#aaa' }}>Server</span>
          <span style={{ color: status.connected ? '#00d9a5' : '#ff4757', fontWeight: 600 }}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#aaa' }}>Agent ID</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {status.agentId || '-'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#aaa' }}>Client Paired</span>
          <span style={{ color: status.paired ? '#00d9a5' : '#ff4757', fontWeight: 600 }}>
            {status.paired ? 'Yes' : 'No'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
          <span style={{ color: '#aaa' }}>Client ID</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {status.clientId || '-'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            className="btn-primary"
            onClick={connect}
            disabled={status.connected}
            style={{ padding: '12px 24px', background: '#e94560', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: status.connected ? 'not-allowed' : 'pointer', opacity: status.connected ? 0.5 : 1 }}
          >
            Connect to Server
          </button>
          <button
            className="btn-secondary"
            onClick={disconnect}
            disabled={!status.connected}
            style={{ padding: '12px 24px', background: '#0f3460', color: '#eee', border: '1px solid #2a2a4a', borderRadius: '8px', fontWeight: 600, cursor: status.connected ? 'pointer' : 'not-allowed', opacity: status.connected ? 1 : 0.5 }}
          >
            Disconnect
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#e94560', marginBottom: '16px' }}>Camera Pipeline</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#aaa' }}>OBS Connected</span>
          <span style={{ color: status.obsConnected ? '#00d9a5' : '#ff4757', fontWeight: 600 }}>
            {status.obsConnected ? 'Yes' : 'No'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#aaa' }}>Virtual Camera</span>
          <span style={{ color: status.virtualCamActive ? '#00d9a5' : '#ff4757', fontWeight: 600 }}>
            {status.virtualCamActive ? 'Live' : 'Offline'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
          <span style={{ color: '#aaa' }}>Quality</span>
          <span style={{ fontWeight: 600 }}>1080p@30fps</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            className="btn-primary"
            onClick={startCamera}
            disabled={status.virtualCamActive || !status.paired}
            style={{ padding: '12px 24px', background: '#e94560', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: (status.virtualCamActive || !status.paired) ? 'not-allowed' : 'pointer', opacity: (status.virtualCamActive || !status.paired) ? 0.5 : 1 }}
          >
            Start Camera
          </button>
          <button
            className="btn-secondary"
            onClick={stopCamera}
            disabled={!status.virtualCamActive}
            style={{ padding: '12px 24px', background: '#ff4757', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: status.virtualCamActive ? 'pointer' : 'not-allowed', opacity: status.virtualCamActive ? 1 : 0.5 }}
          >
            Stop Camera
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.9rem', lineHeight: 1.6 }}>
        <p>This agent runs in the background and connects to the <strong>VirtualCam Web UI</strong>.</p>
        <p>Open the web control panel to configure OBS, camera, voice, and background settings.</p>
        <p>Default server: <code style={{ background: '#0f3460', padding: '2px 6px', borderRadius: '4px' }}>http://localhost:3001</code></p>
      </div>
    </div>
  )
}

export default AgentUI