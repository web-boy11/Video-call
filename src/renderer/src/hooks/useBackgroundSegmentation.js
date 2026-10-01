import { useRef, useCallback, useEffect } from 'react'
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'

export function useBackgroundSegmentation() {
  const segmentationRef = useRef(null)
  const canvasRef = useRef(null)
  const initializedRef = useRef(false)

  const initialize = useCallback(async () => {
    if (initializedRef.current) return

    const segmentation = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    })

    segmentation.setOptions({
      modelSelection: 1, // 0 = general, 1 = landscape (better for full body)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    segmentationRef.current = segmentation
    initializedRef.current = true
  }, [])

  const processFrame = useCallback(async (
    videoElement,
    options
  ) => {
    const {
      backgroundEnabled,
      backgroundMode,
      backgroundColor,
      blurAmount,
      segmentationThreshold,
      bgImage,
    } = options

    if (!backgroundEnabled || backgroundMode === 'none') return null

    await initialize()
    const segmentation = segmentationRef.current
    if (!segmentation) return null

    // Create offscreen canvas for processing
    const canvas = canvasRef.current || document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (!ctx) return null

    // Match video dimensions
    const videoWidth = videoElement.videoWidth
    const videoHeight = videoElement.videoHeight

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth
      canvas.height = videoHeight
    }
    canvasRef.current = canvas

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Process with MediaPipe
    return new Promise((resolve) => {
      segmentation.onResults((results) => {
        if (!results.segmentationMask) {
          resolve(null)
          return
        }

        // Create a mask canvas
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = videoWidth
        maskCanvas.height = videoHeight
        const maskCtx = maskCanvas.getContext('2d')

        // Draw segmentation mask
        maskCtx.drawImage(results.segmentationMask, 0, 0, videoWidth, videoHeight)

        // Threshold the mask
        const imageData = maskCtx.getImageData(0, 0, videoWidth, videoHeight)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i] / 255 // Red channel has the mask
          data[i + 3] = alpha > segmentationThreshold ? 255 : 0 // Alpha channel
          data[i] = data[i + 1] = data[i + 2] = 255 // White RGB
        }
        maskCtx.putImageData(imageData, 0, 0)

        // Draw background first
        if (backgroundMode === 'color') {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        } else if (backgroundMode === 'image' && bgImage) {
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height)
        } else if (backgroundMode === 'blur') {
          // Draw blurred video
          ctx.filter = `blur(${blurAmount}px)`
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
          ctx.filter = 'none'
        }

        // Draw person on top using mask
        ctx.globalCompositeOperation = 'source-over'
        ctx.save()
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(maskCanvas, 0, 0)
        ctx.restore()

        // Now draw the person (video) using the mask as alpha
        ctx.globalCompositeOperation = 'source-atop'
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        ctx.globalCompositeOperation = 'source-over'

        resolve(canvas)
      })

      // Send frame to MediaPipe
      segmentation.send({ image: videoElement })
    })
  }, [initialize])

  const cleanup = useCallback(() => {
    if (segmentationRef.current) {
      segmentationRef.current.close()
      segmentationRef.current = null
    }
    initializedRef.current = false
    canvasRef.current = null
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return { processFrame, cleanup }
}