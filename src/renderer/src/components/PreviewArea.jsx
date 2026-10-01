import React, { useEffect, useRef, useState, useCallback } from 'react'

export default function PreviewArea({
  stream,
  mirror,
  useMask,
  maskImage,
  maskVideo,
  backgroundEnabled,
  backgroundMode,
  backgroundImage,
  backgroundColor,
  blurAmount,
  segmentationThreshold,
  processFrame,
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const maskImgRef = useRef(null)
  const maskVidRef = useRef(null)
  const bgImgRef = useRef(null)
  const animationRef = useRef(null)
  const [showPlaceholder, setShowPlaceholder] = useState(!stream)
  const [canvasReady, setCanvasReady] = useState(false)

  // Load mask image
  useEffect(() => {
    if (maskImage && !maskImgRef.current?.src.includes(maskImage)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = `file://${maskImage}`
      img.onload = () => { maskImgRef.current = img }
      img.onerror = () => { console.warn('Failed to load mask image') }
    }
  }, [maskImage])

  // Load mask video
  useEffect(() => {
    if (maskVideo && !maskVidRef.current?.src.includes(maskVideo)) {
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'
      vid.src = `file://${maskVideo}`
      vid.muted = true
      vid.loop = true
      vid.playsInline = true
      vid.onloadeddata = () => { maskVidRef.current = vid; vid.play().catch(() => {}) }
      vid.onerror = () => { console.warn('Failed to load mask video') }
    }
  }, [maskVideo])

  // Load background image
  useEffect(() => {
    if (backgroundImage && backgroundMode === 'image' && !bgImgRef.current?.src.includes(backgroundImage)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = `file://${backgroundImage}`
      img.onload = () => { bgImgRef.current = img }
      img.onerror = () => { console.warn('Failed to load background image') }
    }
  }, [backgroundImage, backgroundMode])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    setCanvasReady(true)

    const renderLoop = () => {
      if (!stream && !useMask) {
        setShowPlaceholder(true)
        animationRef.current = requestAnimationFrame(renderLoop)
        return
      }

      setShowPlaceholder(false)

      const video = videoRef.current
      const hasVideo = video && video.readyState >= 2

      // Set canvas size
      const targetWidth = 1280
      const targetHeight = 720
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw background first if enabled
      if (backgroundEnabled && backgroundMode !== 'none') {
        if (backgroundMode === 'color') {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        } else if (backgroundMode === 'image' && bgImgRef.current) {
          ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height)
        } else if (backgroundMode === 'blur' && hasVideo) {
          // Draw blurred video as background
          ctx.filter = `blur(${blurAmount}px)`
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          ctx.filter = 'none'
        }
      }

      // Draw main content
      if (useMask) {
        // Draw mask image/video
        if (maskVidRef.current && maskVidRef.current.readyState >= 2) {
          const vid = maskVidRef.current
          const scale = Math.max(canvas.width / vid.videoWidth, canvas.height / vid.videoHeight)
          const w = vid.videoWidth * scale
          const h = vid.videoHeight * scale
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2
          ctx.drawImage(vid, x, y, w, h)
        } else if (maskImgRef.current) {
          const img = maskImgRef.current
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
          const w = img.width * scale
          const h = img.height * scale
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2
          ctx.drawImage(img, x, y, w, h)
        }
      } else if (hasVideo && processFrame) {
        // Process frame with AI segmentation
        const processedCanvas = processFrame(video, {
          backgroundEnabled,
          backgroundMode,
          backgroundColor,
          blurAmount,
          segmentationThreshold,
          bgImage: bgImgRef.current,
        })
        if (processedCanvas) {
          ctx.drawImage(processedCanvas, 0, 0, canvas.width, canvas.height)
        } else {
          // Fallback: draw video directly
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }
      } else if (hasVideo) {
        // Simple video draw
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }

      animationRef.current = requestAnimationFrame(renderLoop)
    }

    renderLoop()
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [stream, useMask, maskImage, maskVideo, backgroundEnabled, backgroundMode, backgroundImage, backgroundColor, blurAmount, segmentationThreshold, processFrame])

  // Update video src
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    } else {
      video.srcObject = null
    }
  }, [stream])

  if (showPlaceholder) {
    return (
      <div className="preview-area">
        <div className="placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No Camera Active</p>
            <p style={{ fontSize: '0.85rem' }}>Select a camera and click Start to begin</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="preview-area">
      <video
        ref={videoRef}
        className={`video-preview ${mirror ? 'mirrored' : ''}`}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        className={`video-preview ${mirror ? 'mirrored' : ''}`}
        style={{ display: canvasReady ? 'block' : 'none' }}
      />
      {!canvasReady && (
        <div className="placeholder">
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p>Initializing...</p>
        </div>
      )}
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}