import { useState, useEffect, useCallback } from 'react'

export function useMediaDevices() {
  const [devices, setDevices] = useState({
    videoinputs: [],
    audioinputs: [],
    audiooutputs: [],
  })
  const [requesting, setRequesting] = useState(false)

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return

    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        videoinputs: deviceList.filter((d) => d.kind === 'videoinput'),
        audioinputs: deviceList.filter((d) => d.kind === 'audioinput'),
        audiooutputs: deviceList.filter((d) => d.kind === 'audiooutput'),
      })
    } catch (error) {
      console.error('Failed to enumerate devices:', error)
    }
  }, [])

  const refreshDevices = useCallback(async () => {
    setRequesting(true)
    try {
      // Request permissions to get labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => {})
      await enumerateDevices()
    } finally {
      setRequesting(false)
    }
  }, [enumerateDevices])

  useEffect(() => {
    enumerateDevices()
    // Listen for device changes
    navigator.mediaDevices?.addEventListener?.('devicechange', enumerateDevices)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', enumerateDevices)
  }, [enumerateDevices])

  return { devices, refreshDevices, requesting }
}