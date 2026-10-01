import { useState, useRef, useCallback, useEffect } from 'react'

export function useVirtualCamera() {
  const [isRunning, setIsRunning] = useState(false)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const virtualVideoRef = useRef(null)

  const startVirtualCamera = useCallback(async (sourceStream, quality) => {
    if (isRunning) return

    try {
      // Create a canvas for processing
      const canvas = document.createElement('canvas')
      canvas.width = quality.width
      canvas.height = quality.height
      canvasRef.current = canvas

      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      // Create a video element to render source
      const video = document.createElement('video')
      video.srcObject = sourceStream
      video.muted = true
      video.playsInline = true
      await video.play()

      // Capture canvas stream at target FPS
      const canvasStream = canvas.captureStream(quality.fps)

      // Combine with audio from source
      const audioTracks = sourceStream.getAudioTracks()
      audioTracks.forEach(track => canvasStream.addTrack(track))

      streamRef.current = canvasStream
      setIsRunning(true)

      // Render loop
      const renderFrame = () => {
        if (!isRunning) return

        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }

        requestAnimationFrame(renderFrame)
      }

      renderFrame()

      return canvasStream
    } catch (error) {
      console.error('Failed to start virtual camera:', error)
      throw error
    }
  }, [isRunning])

  const stopVirtualCamera = useCallback(() => {
    setIsRunning(false)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (canvasRef.current) {
      canvasRef.current = null
    }
  }, [])

  // Get the virtual camera stream for OBS or other apps
  const getVirtualStream = useCallback(() => {
    return streamRef.current
  }, [])

  useEffect(() => {
    return () => {
      stopVirtualCamera()
    }
  }, [stopVirtualCamera])

  return {
    startVirtualCamera,
    stopVirtualCamera,
    getVirtualStream,
    isRunning,
  }
}