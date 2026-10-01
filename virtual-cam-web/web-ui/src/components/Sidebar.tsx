import React from 'react'
import { useStore } from '../store'
import type { BackgroundSettings } from '../lib/background-remover'

export const Sidebar: React.FC = () => {
  const { 
    mode,
    devices,
    videoInput,
    audioInput,
    onVideoInputChange,
    onAudioInputChange,
    obsConfig,
    setOBSConfig,
    obsConnected,
    scenes,
    selectedScene,
    setSelectedScene,
    virtualCamActive,
    sendCommand,
    pairedAgentId,
    mirrorPreview,
    setMirrorPreview,
    voiceEnabled,
    setVoiceEnabled,
    voiceSettings,
    setVoiceSettings,
    backgroundSettings,
    setBackgroundEnabled,
    setBackgroundMode,
    setBackgroundImage,
    setBackgroundColor,
    setBlurAmount,
    setSegmentationThreshold,
    qualityPreset,
    setQualityPreset,
    customQuality,
    setCustomQuality,
    connected,
  } = useStore()

  const handleSceneChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scene = e.target.value
    setSelectedScene(scene)
    if (pairedAgentId) {
      await sendCommand('obs-set-scene', { sceneName: scene })
    }
  }

  const handleOBSConnect = async () => {
    if (pairedAgentId) {
      await sendCommand('obs-connect', obsConfig)
    }
  }

  const handleOBSDisconnect = async () => {
    if (pairedAgentId) {
      await sendCommand('obs-disconnect', {})
    }
  }

  const handleStartCam = async () => {
    if (pairedAgentId) {
      await sendCommand('start-camera', {})
    }
  }

  const handleStopCam = async () => {
    if (pairedAgentId) {
      await sendCommand('stop-camera', {})
    }
  }

  const handleBackgroundImageSelect = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        setBackgroundImage(url)
        setBackgroundMode('image')
      }
    }
    input.click()
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setBackgroundColor(color)
  }

  const qualityPresets = {
    ultra: { width: 3840, height: 2160, fps: 60, bitrate: 20000, name: 'Ultra', desc: '4K@60fps, 20Mbps' },
    high: { width: 1920, height: 1080, fps: 30, bitrate: 8000, name: 'High', desc: '1080p@30fps, 8Mbps' },
    medium: { width: 1280, height: 720, fps: 30, bitrate: 3500, name: 'Medium', desc: '720p@30fps, 3.5Mbps' },
    low: { width: 854, height: 480, fps: 24, bitrate: 1500, name: 'Low', desc: '480p@24fps, 1.5Mbps' },
  }

  const handlePresetChange = (preset: keyof typeof qualityPresets) => {
    setQualityPreset(preset)
  }

  const handleCustomQualityChange = (field: string, value: number) => {
    setCustomQuality({ [field]: value })
  }

  const voicePresets = {
    normal: { pitch: 1.0, formant: 1.0, robot: 0, reverb: 0, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Normal' },
    deep: { pitch: 0.7, formant: 0.85, robot: 0, reverb: 0.1, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Deep' },
    high: { pitch: 1.4, formant: 1.15, robot: 0, reverb: 0, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'High' },
    robot: { pitch: 1.0, formant: 1.0, robot: 0.8, reverb: 0.2, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Robot' },
    alien: { pitch: 1.3, formant: 0.7, robot: 0.5, reverb: 0.4, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Alien' },
    chipmunk: { pitch: 1.8, formant: 1.3, robot: 0, reverb: 0, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Chipmunk' },
    darth: { pitch: 0.6, formant: 0.7, robot: 0.3, reverb: 0.3, noiseGate: -40, compression: 0, equalizer: { low: 0, mid: 0, high: 0 }, name: 'Darth' },
  }

  const applyVoicePreset = (preset: typeof voicePresets.normal) => {
    setVoiceSettings(preset)
  }

  // Only show OBS section in desktop-agent mode
  const showOBS = mode === 'desktop-agent'

  return (
    <aside className="sidebar">
      {showOBS && (
        <div className="sidebar-section">
          <h3>OBS Control</h3>
          {!obsConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-group">
                <label>Host</label>
                <input
                  type="text"
                  value={obsConfig.host}
                  onChange={(e) => setOBSConfig({ ...obsConfig, host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  type="number"
                  value={obsConfig.port}
                  onChange={(e) => setOBSConfig({ ...obsConfig, port: parseInt(e.target.value) })}
                  placeholder="4455"
                />
              </div>
              <div className="form-group">
                <label>Password (optional)</label>
                <input
                  type="password"
                  value={obsConfig.password}
                  onChange={(e) => setOBSConfig({ ...obsConfig, password: e.target.value })}
                  placeholder="Leave empty if none"
                />
              </div>
              <button className="btn btn-primary" onClick={handleOBSConnect} style={{ width: '100%' }}>
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
                    <option key={scene} value={scene}>{scene}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleStartCam}
                  disabled={virtualCamActive}
                  style={{ flex: 1 }}
                >
                  {virtualCamActive ? 'Camera Running' : 'Start Virtual Camera'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleStopCam}
                  disabled={!virtualCamActive}
                  style={{ flex: 1 }}
                >
                  Stop Camera
                </button>
              </div>
              <button className="btn btn-secondary" onClick={handleOBSDisconnect} style={{ width: '100%' }}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-section">
        <h3>Video Input</h3>
        <div className="form-group">
          <label>Camera</label>
          <div className="device-selector">
            <div className="device-row">
              <select value={videoInput || ''} onChange={(e) => onVideoInputChange(e.target.value || null)}>
                <option value="">Default</option>
                {devices.videoinputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="toggle">
          <div className="toggle-label">
            <span className="toggle-title">Mirror Preview</span>
            <span className="toggle-desc">Flip preview horizontally (like a mirror)</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={mirrorPreview} onChange={(e) => setMirrorPreview(e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Voice Changer</h3>

        <div className="toggle">
          <div className="toggle-label">
            <span className="toggle-title">Enable Voice Changer</span>
            <span className="toggle-desc">Real-time voice processing</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div style={{ opacity: voiceEnabled ? 1 : 0.5, pointerEvents: voiceEnabled ? 'auto' : 'none' }}>
          <div className="form-group">
            <label>Microphone Input</label>
            <div className="device-selector">
              <div className="device-row">
                <select value={audioInput || ''} onChange={(e) => onAudioInputChange(e.target.value || null)}>
                  <option value="">Default</option>
                  {devices.audioinputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Mic ${device.deviceId.slice(0, 8)}`}
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
                  onClick={() => applyVoicePreset(preset)}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Pitch & Formant
            </label>
            <div className="effect-knobs">
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.01"
                    value={voiceSettings.pitch}
                    onChange={(e) => setVoiceSettings({ pitch: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Pitch</div>
                <div className="knob-value">{voiceSettings.pitch.toFixed(2)}x</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.01"
                    value={voiceSettings.formant}
                    onChange={(e) => setVoiceSettings({ formant: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Formant</div>
                <div className="knob-value">{voiceSettings.formant.toFixed(2)}x</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSettings.robot}
                    onChange={(e) => setVoiceSettings({ robot: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Robot</div>
                <div className="knob-value">{Math.round(voiceSettings.robot * 100)}%</div>
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
                    value={voiceSettings.reverb}
                    onChange={(e) => setVoiceSettings({ reverb: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Reverb</div>
                <div className="knob-value">{Math.round(voiceSettings.reverb * 100)}%</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    step="1"
                    value={voiceSettings.noiseGate}
                    onChange={(e) => setVoiceSettings({ noiseGate: parseInt(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Noise Gate</div>
                <div className="knob-value">{voiceSettings.noiseGate}dB</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSettings.compression}
                    onChange={(e) => setVoiceSettings({ compression: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="knob-label">Compression</div>
                <div className="knob-value">{Math.round(voiceSettings.compression * 100)}%</div>
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
                    value={voiceSettings.equalizer.low}
                    onChange={(e) => setVoiceSettings({ equalizer: { ...voiceSettings.equalizer, low: parseInt(e.target.value) } })}
                  />
                </div>
                <div className="knob-label">Low</div>
                <div className="knob-value">{voiceSettings.equalizer.low > 0 ? '+' : ''}{voiceSettings.equalizer.low}dB</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={voiceSettings.equalizer.mid}
                    onChange={(e) => setVoiceSettings({ equalizer: { ...voiceSettings.equalizer, mid: parseInt(e.target.value) } })}
                  />
                </div>
                <div className="knob-label">Mid</div>
                <div className="knob-value">{voiceSettings.equalizer.mid > 0 ? '+' : ''}{voiceSettings.equalizer.mid}dB</div>
              </div>
              <div className="knob-group">
                <div className="knob">
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={voiceSettings.equalizer.high}
                    onChange={(e) => setVoiceSettings({ equalizer: { ...voiceSettings.equalizer, high: parseInt(e.target.value) } })}
                  />
                </div>
                <div className="knob-label">High</div>
                <div className="knob-value">{voiceSettings.equalizer.high > 0 ? '+' : ''}{voiceSettings.equalizer.high}dB</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Background Replacement</h3>

        <div className="toggle">
          <div className="toggle-label">
            <span className="toggle-title">Enable Background Replacement</span>
            <span className="toggle-desc">AI-powered person segmentation (MediaPipe)</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={backgroundSettings.enabled} onChange={(e) => setBackgroundEnabled(e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div style={{ opacity: backgroundSettings.enabled ? 1 : 0.5, pointerEvents: backgroundSettings.enabled ? 'auto' : 'none' }}>
          <div className="form-group">
            <label>Mode</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['blur', 'image', 'color', 'none'].map((m) => (
                <button
                  key={m}
                  className={`btn ${backgroundSettings.mode === m ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setBackgroundMode(m as BackgroundSettings['mode'])}
                  style={{ flex: 1, minWidth: '60px', padding: '8px', fontSize: '0.8rem' }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {backgroundSettings.mode === 'image' && (
            <div className="form-group">
              <label>Background Image</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handleBackgroundImageSelect} style={{ flex: 1 }}>
                  {backgroundSettings.backgroundImage ? 'Change Image' : 'Select Image'}
                </button>
                {backgroundSettings.backgroundImage && (
                  <button className="btn btn-ghost" onClick={() => { setBackgroundImage(null); setBackgroundMode('blur'); }}>
                    Clear
                  </button>
                )}
              </div>
              {backgroundSettings.backgroundImage && (
                <div className="media-preview">
                  <img src={backgroundSettings.backgroundImage} alt="Background preview" />
                </div>
              )}
            </div>
          )}

          {backgroundSettings.mode === 'color' && (
            <div className="form-group">
              <label>Background Color</label>
              <div className="color-inputs">
                <input
                  type="color"
                  value={backgroundSettings.backgroundColor}
                  onChange={handleColorChange}
                />
                <input
                  type="text"
                  value={backgroundSettings.backgroundColor}
                  onChange={handleColorChange}
                  placeholder="#000000"
                />
              </div>
            </div>
          )}

          {backgroundSettings.mode === 'blur' && (
            <div className="form-group">
              <label>Blur Amount: {backgroundSettings.blurAmount}px</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={backgroundSettings.blurAmount}
                  onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                />
                <span className="slider-value">{backgroundSettings.blurAmount}px</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Segmentation Threshold: {backgroundSettings.segmentationThreshold.toFixed(2)}</label>
            <div className="slider-row">
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={backgroundSettings.segmentationThreshold}
                onChange={(e) => setSegmentationThreshold(parseFloat(e.target.value))}
              />
              <span className="slider-value">{backgroundSettings.segmentationThreshold.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Lower = more inclusive, Higher = stricter person detection
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Video Quality</h3>

        <div className="quality-presets">
          {Object.entries(qualityPresets).map(([key, q]) => (
            <button
              key={key}
              className={`quality-btn ${qualityPreset === key ? 'active' : ''}`}
              onClick={() => handlePresetChange(key as keyof typeof qualityPresets)}
            >
              <div className="quality-btn-name">{q.name}</div>
              <div className="quality-btn-desc">{q.desc}</div>
            </button>
          ))}
          <button
            className={`quality-btn ${qualityPreset === 'custom' ? 'active' : ''}`}
            onClick={() => handlePresetChange('custom' as any)}
          >
            <div className="quality-btn-name">Custom</div>
            <div className="quality-btn-desc">Manual settings</div>
          </button>
        </div>

        {(qualityPreset === 'custom' || Object.keys(qualityPresets).includes(qualityPreset)) && (
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
                  value={customQuality.width}
                  onChange={(e) => handleCustomQualityChange('width', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Height</label>
                <input
                  type="number"
                  min="240"
                  max="4320"
                  step="2"
                  value={customQuality.height}
                  onChange={(e) => handleCustomQualityChange('height', parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>FPS</label>
                <input
                  type="number"
                  min="15"
                  max="120"
                  step="1"
                  value={customQuality.fps}
                  onChange={(e) => handleCustomQualityChange('fps', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Bitrate: {customQuality.bitrate} kbps</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="500"
                  max="50000"
                  step="100"
                  value={customQuality.bitrate}
                  onChange={(e) => handleCustomQualityChange('bitrate', parseInt(e.target.value))}
                />
                <span className="slider-value">{customQuality.bitrate} kbps</span>
              </div>
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
            &#8226; <strong>High (1080p)</strong> for Zoom/Teams/Meet with good internet<br/>
            &#8226; <strong>Medium (720p)</strong> for Discord/Slack or limited bandwidth<br/>
            &#8226; <strong>Low (480p)</strong> for mobile hotspot or poor connection<br/>
            &#8226; <strong>Ultra (4K)</strong> only for local recording or NDI output
          </div>
        </div>
      </div>

      {!showOBS && !connected && (
        <div className="sidebar-section" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📱</div>
          <h4 style={{ marginBottom: '8px' }}>Browser Mode Active</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            All processing runs in your browser. No laptop needed!
            Start streaming to share your camera with any meeting app.
          </p>
        </div>
      )}
    </aside>
  )
}