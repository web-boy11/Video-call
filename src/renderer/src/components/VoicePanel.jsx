import React from 'react'

const voicePresets = {
  normal: { pitch: 1.0, formant: 1.0, robot: 0, reverb: 0, name: 'Normal' },
  deep: { pitch: 0.7, formant: 0.85, robot: 0, reverb: 0.1, name: 'Deep' },
  high: { pitch: 1.4, formant: 1.15, robot: 0, reverb: 0, name: 'High' },
  robot: { pitch: 1.0, formant: 1.0, robot: 0.8, reverb: 0.2, name: 'Robot' },
  alien: { pitch: 1.3, formant: 0.7, robot: 0.5, reverb: 0.4, name: 'Alien' },
  chipmunk: { pitch: 1.8, formant: 1.3, robot: 0, reverb: 0, name: 'Chipmunk' },
  darth: { pitch: 0.6, formant: 0.7, robot: 0.3, reverb: 0.3, name: 'Darth' },
}

export default function VoicePanel({
  enabled,
  setEnabled,
  settings,
  setSettings,
  devices,
  selectedDevice,
  onDeviceChange,
  outputDevices,
  selectedOutput,
  onOutputChange,
}) {
  const applyPreset = (preset) => {
    setSettings({ ...preset })
  }

  return (
    <div className="sidebar-section">
      <h3>Voice Changer</h3>

      <div className="toggle">
        <div className="toggle-label">
          <span className="toggle-title">Enable Voice Changer</span>
          <span className="toggle-desc">Real-time voice processing</span>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>

      <div className="form-group">
        <label>Microphone Input</label>
        <div className="device-selector">
          <div className="device-row">
            <select value={selectedDevice || ''} onChange={(e) => onDeviceChange(e.target.value || null)}>
              <option value="">Default</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Mic ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Monitor Output (Headphones)</label>
        <div className="device-selector">
          <div className="device-row">
            <select value={selectedOutput || ''} onChange={(e) => onOutputChange(e.target.value || null)}>
              <option value="">Default</option>
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Output ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          Presets
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.entries(voicePresets).map(([key, preset]) => (
            <button
              key={key}
              className="btn btn-secondary"
              onClick={() => applyPreset(preset)}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          Pitch Shift
        </label>
        <div className="effect-knobs">
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.01"
                value={settings.pitch}
                onChange={(e) => setSettings({ pitch: parseFloat(e.target.value) })}
              />
            </div>
            <div className="knob-label">Pitch</div>
            <div className="knob-value">{settings.pitch.toFixed(2)}x</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={settings.formant}
                onChange={(e) => setSettings({ formant: parseFloat(e.target.value) })}
              />
            </div>
            <div className="knob-label">Formant</div>
            <div className="knob-value">{settings.formant.toFixed(2)}x</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.robot}
                onChange={(e) => setSettings({ robot: parseFloat(e.target.value) })}
              />
            </div>
            <div className="knob-label">Robot</div>
            <div className="knob-value">{Math.round(settings.robot * 100)}%</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          Effects
        </label>
        <div className="effect-knobs">
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.reverb}
                onChange={(e) => setSettings({ reverb: parseFloat(e.target.value) })}
              />
            </div>
            <div className="knob-label">Reverb</div>
            <div className="knob-value">{Math.round(settings.reverb * 100)}%</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="-60"
                max="0"
                step="1"
                value={settings.noiseGate}
                onChange={(e) => setSettings({ noiseGate: parseInt(e.target.value) })}
              />
            </div>
            <div className="knob-label">Noise Gate</div>
            <div className="knob-value">{settings.noiseGate}dB</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.compression}
                onChange={(e) => setSettings({ compression: parseFloat(e.target.value) })}
              />
            </div>
            <div className="knob-label">Compression</div>
            <div className="knob-value">{Math.round(settings.compression * 100)}%</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          Equalizer
        </label>
        <div className="effect-knobs">
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={settings.equalizer.low}
                onChange={(e) => setSettings({ equalizer: { ...settings.equalizer, low: parseInt(e.target.value) } })}
              />
            </div>
            <div className="knob-label">Low</div>
            <div className="knob-value">{settings.equalizer.low > 0 ? '+' : ''}{settings.equalizer.low}dB</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={settings.equalizer.mid}
                onChange={(e) => setSettings({ equalizer: { ...settings.equalizer, mid: parseInt(e.target.value) } })}
              />
            </div>
            <div className="knob-label">Mid</div>
            <div className="knob-value">{settings.equalizer.mid > 0 ? '+' : ''}{settings.equalizer.mid}dB</div>
          </div>
          <div className="knob-group">
            <div className="knob">
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={settings.equalizer.high}
                onChange={(e) => setSettings({ equalizer: { ...settings.equalizer, high: parseInt(e.target.value) } })}
              />
            </div>
            <div className="knob-label">High</div>
            <div className="knob-value">{settings.equalizer.high > 0 ? '+' : ''}{settings.equalizer.high}dB</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}