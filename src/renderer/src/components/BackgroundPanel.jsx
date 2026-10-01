import React, { useState } from 'react'

export default function BackgroundPanel({
  enabled,
  setEnabled,
  mode,
  setMode,
  backgroundImage,
  setBackgroundImage,
  backgroundColor,
  setBackgroundColor,
  blurAmount,
  setBlurAmount,
  segmentationThreshold,
  setSegmentationThreshold,
}) {
  const [colorPreview, setColorPreview] = useState(backgroundColor)
  const [imagePreview, setImagePreview] = useState(null)

  const handleImageSelect = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectImage()
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      setBackgroundImage(filePath)
      setImagePreview(`file://${filePath}`)
      setMode('image')
    }
  }

  const handleColorChange = (e) => {
    const color = e.target.value
    setBackgroundColor(color)
    setColorPreview(color)
  }

  const handleClearBackground = () => {
    setBackgroundImage(null)
    setImagePreview(null)
    setMode('blur')
  }

  return (
    <div className="sidebar-section">
      <h3>Background Replacement</h3>

      <div className="toggle">
        <div className="toggle-label">
          <span className="toggle-title">Enable Background Replacement</span>
          <span className="toggle-desc">AI-powered person segmentation</span>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>

      <div className="form-group">
        <label>Mode</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['blur', 'image', 'color', 'none'].map((m) => (
            <button
              key={m}
              className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode(m)}
              style={{ flex: 1, minWidth: '60px', padding: '8px', fontSize: '0.8rem' }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'image' && (
        <div className="form-group">
          <label>Background Image</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleImageSelect} style={{ flex: 1 }}>
              {backgroundImage ? 'Change Image' : 'Select Image'}
            </button>
            {backgroundImage && (
              <button className="btn btn-ghost" onClick={handleClearBackground}>
                Clear
              </button>
            )}
          </div>
          {imagePreview && (
            <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={imagePreview} alt="Background preview" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      )}

      {mode === 'color' && (
        <div className="form-group">
          <label>Background Color</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={colorPreview}
              onChange={handleColorChange}
              style={{ width: '50px', height: '40px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={colorPreview}
              onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { handleColorChange(e); setColorPreview(e.target.value) } }}
              style={{ flex: 1, padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
              placeholder="#000000"
            />
          </div>
        </div>
      )}

      {mode === 'blur' && (
        <div className="form-group">
          <label>Blur Amount: {blurAmount}px</label>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={blurAmount}
            onChange={(e) => setBlurAmount(parseInt(e.target.value))}
            className="slider-container"
          />
        </div>
      )}

      <div className="form-group">
        <label>Segmentation Threshold: {segmentationThreshold.toFixed(2)}</label>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.05"
          value={segmentationThreshold}
          onChange={(e) => setSegmentationThreshold(parseFloat(e.target.value))}
          className="slider-container"
        />
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Lower = more inclusive, Higher = stricter person detection
        </div>
      </div>
    </div>
  </div>
  )
}