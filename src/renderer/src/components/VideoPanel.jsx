import React, { useState } from 'react'

export default function VideoPanel({
  devices,
  selectedDevice,
  onDeviceChange,
  maskImage,
  setMaskImage,
  maskVideo,
  setMaskVideo,
  useMask,
  setUseMask,
  mirrorPreview,
  setMirrorPreview,
  requesting,
  onRefresh,
}) {
  const [imagePreview, setImagePreview] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)

  const handleImageSelect = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectImage()
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      setMaskImage(filePath)
      setImagePreview(`file://${filePath}`)
      setUseMask(true)
    }
  }

  const handleVideoSelect = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectVideo()
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      setMaskVideo(filePath)
      setVideoPreview(`file://${filePath}`)
      setUseMask(true)
    }
  }

  const handleClearMask = () => {
    setMaskImage(null)
    setMaskVideo(null)
    setImagePreview(null)
    setVideoPreview(null)
    setUseMask(false)
  }

  return (
    <div className="sidebar-section">
      <h3>Video Input</h3>
      <div className="form-group">
        <label>Camera</label>
        <div className="device-selector">
          <div className="device-row">
            <select value={selectedDevice || ''} onChange={(e) => onDeviceChange(e.target.value || null)}>
              <option value="">Default</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost device-refresh" onClick={onRefresh} disabled={requesting}>
              ⟳
            </button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Mask / Overlay Image/Video</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleImageSelect} style={{ flex: 1 }}>
            Load Image
          </button>
          <button className="btn btn-secondary" onClick={handleVideoSelect} style={{ flex: 1 }}>
            Load Video
          </button>
        </div>
        {(maskImage || maskVideo) && (
          <button className="btn btn-ghost" onClick={handleClearMask} style={{ width: '100%', marginTop: '8px' }}>
            Clear Mask
          </button>
        )}
      </div>

      {(imagePreview || videoPreview) && (
        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Preview</label>
          <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {imagePreview && <img src={imagePreview} alt="Mask preview" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover' }} />}
            {videoPreview && <video src={videoPreview} style={{ width: '100%', maxHeight: '120px' }} muted loop />}
          </div>
        </div>
      )}

      <div className="toggle">
        <div className="toggle-label">
          <span className="toggle-title">Use Mask as Camera Output</span>
          <span className="toggle-desc">Replace camera feed with selected image/video</span>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={useMask} onChange={(e) => setUseMask(e.target.checked)} />
          <span className="toggle-slider"></span>
        </label>
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
  )
}