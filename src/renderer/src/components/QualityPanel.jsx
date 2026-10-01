import React from 'react'

const qualityPresets = {
  ultra: { width: 3840, height: 2160, fps: 60, bitrate: 20000, name: 'Ultra', desc: '4K@60fps, 20Mbps' },
  high: { width: 1920, height: 1080, fps: 30, bitrate: 8000, name: 'High', desc: '1080p@30fps, 8Mbps' },
  medium: { width: 1280, height: 720, fps: 30, bitrate: 3500, name: 'Medium', desc: '720p@30fps, 3.5Mbps' },
  low: { width: 854, height: 480, fps: 24, bitrate: 1500, name: 'Low', desc: '480p@24fps, 1.5Mbps' },
}

export default function QualityPanel({
  preset,
  setPreset,
  customQuality,
  setCustomQuality,
}) {
  const handlePresetChange = (newPreset) => {
    setPreset(newPreset)
    if (newPreset !== 'custom' && qualityPresets[newPreset]) {
      setCustomQuality(qualityPresets[newPreset])
    }
  }

  const handleCustomChange = (field, value) => {
    setCustomQuality({ [field]: value })
    if (preset !== 'custom') setPreset('custom')
  }

  const current = preset === 'custom' ? customQuality : qualityPresets[preset] || qualityPresets.high

  return (
    <div className="sidebar-section">
      <h3>Video Quality</h3>

      <div className="quality-presets">
        {Object.entries(qualityPresets).map(([key, q]) => (
          <button
            key={key}
            className={`quality-btn ${preset === key ? 'active' : ''}`}
            onClick={() => handlePresetChange(key)}
          >
            <div className="quality-btn-name">{q.name}</div>
            <div className="quality-btn-desc">{q.desc}</div>
          </button>
        ))}
        <button
          className={`quality-btn ${preset === 'custom' ? 'active' : ''}`}
          onClick={() => handlePresetChange('custom')}
        >
          <div className="quality-btn-name">Custom</div>
          <div className="quality-btn-desc">Manual settings</div>
        </button>
      </div>

      {(preset === 'custom' || Object.keys(qualityPresets).includes(preset)) && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Resolution & Frame Rate
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Width</label>
              <input
                type="number"
                min="320"
                max="7680"
                step="2"
                value={current.width}
                onChange={(e) => handleCustomChange('width', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Height</label>
              <input
                type="number"
                min="240"
                max="4320"
                step="2"
                value={current.height}
                onChange={(e) => handleCustomChange('height', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>FPS</label>
              <input
                type="number"
                min="15"
                max="120"
                step="1"
                value={current.fps}
                onChange={(e) => handleCustomChange('fps', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Bitrate: {current.bitrate} kbps</label>
            <input
              type="range"
              min="500"
              max="50000"
              step="100"
              value={current.bitrate}
              onChange={(e) => handleCustomChange('bitrate', parseInt(e.target.value))}
              className="slider-container"
            />
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Higher quality = more CPU/GPU usage and bandwidth. Match your upload speed.
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(233, 69, 96, 0.1)', borderRadius: '8px', border: '1px solid rgba(233, 69, 96, 0.3)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px' }}>
          Recommended for Video Calls:
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          • <strong>High (1080p)</strong> for Zoom/Teams/Meet with good internet<br/>
          • <strong>Medium (720p)</strong> for Discord/Slack or limited bandwidth<br/>
          • <strong>Low (480p)</strong> for mobile hotspot or poor connection<br/>
          • <strong>Ultra (4K)</strong> only for local recording or NDI output
        </div>
      </div>
    </div>
  )
}