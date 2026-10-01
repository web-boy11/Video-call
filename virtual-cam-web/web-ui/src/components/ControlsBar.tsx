import React from 'react'
import { useStore } from '../store'

interface ControlsBarProps {
  devices: { videoinputs: MediaDeviceInfo[]; audioinputs: MediaDeviceInfo[] }
  videoInput: string | null
  audioInput: string | null
  onVideoInputChange: (deviceId: string | null) => Promise<void>
  onAudioInputChange: (deviceId: string | null) => Promise<void>
  mirrorPreview: boolean
  onMirrorPreviewChange: (enabled: boolean) => void
  voiceEnabled: boolean
  onVoiceEnabledChange: (enabled: boolean) => void
  backgroundSettings: any
  onBackgroundSettingsChange: (settings: any) => void
  qualityPreset: 'ultra' | 'high' | 'medium' | 'low' | 'custom'
  onQualityChange: (preset: 'ultra' | 'high' | 'medium' | 'low' | 'custom', custom?: any) => void
  streaming: boolean
  streamState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'
  streamUrl: string | null
  onStartStreaming: () => Promise<void>
  onStopStreaming: () => void
  mode: 'browser' | 'desktop-agent'
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  devices,
  videoInput,
  audioInput,
  onVideoInputChange,
  onAudioInputChange,
  mirrorPreview,
  onMirrorPreviewChange,
  voiceEnabled,
  onVoiceEnabledChange,
  backgroundSettings,
  onBackgroundSettingsChange,
  qualityPreset,
  onQualityChange,
  streaming,
  streamState,
  streamUrl,
  onStartStreaming,
  onStopStreaming,
  mode,
}) => {
  const { virtualCamActive, pairedAgentId, sendCommand } = useStore()

  const handleStart = async () => {
    if (mode === 'desktop-agent' && pairedAgentId) {
      await sendCommand('start-camera', {})
    }
  }

  const handleStop = async () => {
    if (mode === 'desktop-agent' && pairedAgentId) {
      await sendCommand('stop-camera', {})
    }
  }

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

  if (mode === 'browser') {
    return (
      <div className="controls-bar">
        {/* Stream Controls */}
        <div className="controls-group">
          {!streaming ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={onStartStreaming}
              disabled={streamState === 'connecting'}
              style={{ minWidth: '180px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Streaming
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="status-badge streaming" style={{ backgroundColor: getStreamStateColor(streamState), borderColor: getStreamStateColor(streamState) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'pulse 1s infinite' }}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {getStreamStateLabel(streamState)}
              </span>
              <button
                className="btn btn-danger"
                onClick={onStopStreaming}
                style={{ minWidth: '120px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Stop
              </button>
            </div>
          )}
        </div>

        {streamUrl && (
          <div className="stream-url-box">
            <label>Stream URL (open on computer for meetings)</label>
            <div className="url-with-copy">
              <input type="text" value={streamUrl} readOnly />
              <button onClick={() => navigator.clipboard.writeText(streamUrl!)}>Copy</button>
            </div>
          </div>
        )}

        {/* Quick Settings */}
        <div className="quick-settings">
          <div className="setting-item">
            <label>Camera</label>
            <select value={videoInput || ''} onChange={(e) => onVideoInputChange(e.target.value || null)} style={{ width: '200px' }}>
              <option value="">Default</option>
              {devices.videoinputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <label>Mic</label>
            <select value={audioInput || ''} onChange={(e) => onAudioInputChange(e.target.value || null)} style={{ width: '200px' }}>
              <option value="">Default</option>
              {devices.audioinputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Mic ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-item toggle-inline">
            <label className="toggle-switch">
              <input type="checkbox" checked={mirrorPreview} onChange={(e) => onMirrorPreviewChange(e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span>Mirror</span>
          </div>

          <div className="setting-item toggle-inline">
            <label className="toggle-switch">
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => onVoiceEnabledChange(e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span>Voice</span>
          </div>

          <div className="setting-item toggle-inline">
            <label className="toggle-switch">
              <input type="checkbox" checked={backgroundSettings.enabled} onChange={(e) => onBackgroundSettingsChange({ enabled: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
            <span>BG</span>
          </div>

          <div className="setting-item">
            <label>Quality</label>
            <select value={qualityPreset} onChange={(e) => onQualityChange(e.target.value as any)} style={{ width: '140px' }}>
              <option value="ultra">Ultra (4K)</option>
              <option value="high">High (1080p)</option>
              <option value="medium">Medium (720p)</option>
              <option value="low">Low (480p)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>
    )
  }

  // Desktop Agent Mode
  return (
    <div className="controls-bar">
      <button
        className="btn btn-primary"
        onClick={handleStart}
        disabled={virtualCamActive || !pairedAgentId}
        style={{ minWidth: '160px' }}
      >
        {virtualCamActive ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Running
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Camera
          </>
        )}
      </button>

      <button
        className="btn btn-danger"
        onClick={handleStop}
        disabled={!virtualCamActive || !pairedAgentId}
        style={{ minWidth: '140px' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        Stop
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <span>
          {pairedAgentId ? (
            <>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginRight: '6px' }} />
              Agent Connected
            </>
          ) : (
            <>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', marginRight: '6px' }} />
              No Agent
            </>
          )}
        </span>
      </div>
    </div>
  )
}