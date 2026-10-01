import React from 'react'

export default function OBSPanel({
  connected,
  config,
  setConfig,
  scenes,
  selectedScene,
  setSelectedScene,
  virtualCamActive,
  onConnect,
  onDisconnect,
  onStartCam,
  onStopCam,
}) {
  const handleSceneChange = async (e) => {
    const sceneName = e.target.value
    setSelectedScene(sceneName)
    if (window.electronAPI) {
      await window.electronAPI.obsSetScene(sceneName)
    }
  }

  return (
    <div className="sidebar-section">
      <h3>OBS Control</h3>
      {!connected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="form-group">
            <label>Host</label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="localhost"
            />
          </div>
          <div className="form-group">
            <label>Port</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
              placeholder="4455"
            />
          </div>
          <div className="form-group">
            <label>Password (optional)</label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="Leave empty if none"
            />
          </div>
          <button className="btn btn-primary" onClick={onConnect} style={{ width: '100%' }}>
            Connect to OBS
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label>Scene</label>
            <select value={selectedScene} onChange={handleSceneChange}>
              <option value="">Select a scene...</option>
              {scenes.map((scene) => (
                <option key={scene.sceneName} value={scene.sceneName}>
                  {scene.sceneName}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={onStartCam}
              disabled={virtualCamActive}
              style={{ flex: 1 }}
            >
              {virtualCamActive ? 'Camera Running' : 'Start Virtual Camera'}
            </button>
            <button
              className="btn btn-danger"
              onClick={onStopCam}
              disabled={!virtualCamActive}
              style={{ flex: 1 }}
            >
              Stop Camera
            </button>
          </div>
          <button className="btn btn-secondary" onClick={onDisconnect} style={{ width: '100%' }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}