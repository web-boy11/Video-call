import React, { useState, useEffect, useRef, useCallback } from 'react'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import OBSPanel from './components/OBSPanel'
import VideoPanel from './components/VideoPanel'
import VoicePanel from './components/VoicePanel'
import BackgroundPanel from './components/BackgroundPanel'
import QualityPanel from './components/QualityPanel'
import Header from './components/Header'
import PreviewArea from './components/PreviewArea'
import ControlsBar from './components/ControlsBar'
import { useMediaDevices } from './hooks/useMediaDevices'
import { useVirtualCamera } from './hooks/useVirtualCamera'
import { useVoiceProcessor } from './hooks/useVoiceProcessor'
import { useBackgroundSegmentation } from './hooks/useBackgroundSegmentation'

// Global store
const useStore = create(devtools((set, get) => ({
  // OBS
  obsConnected: false,
  obsConfig: { host: 'localhost', port: 4455, password: '' },
  scenes: [],
  sources: [],
  selectedScene: '',
  virtualCamActive: false,

  // Media
  videoInput: null,
  audioInput: null,
  audioOutput: null,
  mediaStream: null,
  processedStream: null,

  // Video
  maskImage: null,
  maskVideo: null,
  useMask: false,
  mirrorPreview: true,

  // Voice
  voiceEnabled: false,
  voiceSettings: {
    pitch: 1.0,
    formant: 1.0,
    robot: 0,
    reverb: 0,
    noiseGate: -40,
    compression: 0,
    equalizer: { low: 0, mid: 0, high: 0 },
  },

  // Background
  backgroundEnabled: false,
  backgroundMode: 'blur', // 'blur', 'image', 'color', 'none'
  backgroundImage: null,
  backgroundColor: '#000000',
  blurAmount: 15,
  segmentationThreshold: 0.5,

  // Quality
  qualityPreset: 'high', // 'high', 'medium', 'low', 'custom'
  customQuality: {
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 5000,
  },

  // Actions
  setOBSConnected: (connected) => set({ obsConnected: connected }),
  setOBSConfig: (config) => set({ obsConfig: config }),
  setScenes: (scenes) => set({ scenes }),
  setSources: (sources) => set({ sources }),
  setSelectedScene: (scene) => set({ selectedScene: scene }),
  setVirtualCamActive: (active) => set({ virtualCamActive: active }),

  setVideoInput: (deviceId) => set({ videoInput: deviceId }),
  setAudioInput: (deviceId) => set({ audioInput: deviceId }),
  setAudioOutput: (deviceId) => set({ audioOutput: deviceId }),
  setMediaStream: (stream) => set({ mediaStream: stream }),
  setProcessedStream: (stream) => set({ processedStream: stream }),

  setMaskImage: (file) => set({ maskImage: file }),
  setMaskVideo: (file) => set({ maskVideo: file }),
  setUseMask: (use) => set({ useMask: use }),
  setMirrorPreview: (mirror) => set({ mirrorPreview: mirror }),

  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setVoiceSettings: (settings) => set((state) => ({
    voiceSettings: { ...state.voiceSettings, ...settings }
  })),

  setBackgroundEnabled: (enabled) => set({ backgroundEnabled: enabled }),
  setBackgroundMode: (mode) => set({ backgroundMode: mode }),
  setBackgroundImage: (file) => set({ backgroundImage: file }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setBlurAmount: (amount) => set({ blurAmount: amount }),
  setSegmentationThreshold: (threshold) => set({ segmentationThreshold: threshold }),

  setQualityPreset: (preset) => set({ qualityPreset: preset }),
  setCustomQuality: (quality) => set((state) => ({
    customQuality: { ...state.customQuality, ...quality }
  })),
}), { name: 'virtual-cam-store' }))

const qualityPresets = {
  high: { width: 1920, height: 1080, fps: 30, bitrate: 8000, name: 'High', desc: '1080p@30fps, 8Mbps' },
  medium: { width: 1280, height: 720, fps: 30, bitrate: 3500, name: 'Medium', desc: '720p@30fps, 3.5Mbps' },
  low: { width: 854, height: 480, fps: 24, bitrate: 1500, name: 'Low', desc: '480p@24fps, 1.5Mbps' },
  ultra: { width: 3840, height: 2160, fps: 60, bitrate: 20000, name: 'Ultra', desc: '4K@60fps, 20Mbps' },
}

function App() {
  const [
    obsConnected, setObsConnected, obsConfig, setObsConfig, scenes, setScenes,
    sources, setSources, selectedScene, setSelectedScene, virtualCamActive, setVirtualCamActive,
    videoInput, setVideoInput, audioInput, setAudioInput, audioOutput, setAudioOutput,
    mediaStream, setMediaStream, processedStream, setProcessedStream,
    maskImage, setMaskImage, maskVideo, setMaskVideo, useMask, setUseMask, mirrorPreview, setMirrorPreview,
    voiceEnabled, setVoiceEnabled, voiceSettings, setVoiceSettings,
    backgroundEnabled, setBackgroundEnabled, backgroundMode, setBackgroundMode,
    backgroundImage, setBackgroundImage, backgroundColor, setBackgroundColor,
    blurAmount, setBlurAmount, segmentationThreshold, setSegmentationThreshold,
    qualityPreset, setQualityPreset, customQuality, setCustomQuality,
  ] = useStore((state) => [
    state.obsConnected, state.setOBSConnected, state.obsConfig, state.setOBSConfig,
    state.scenes, state.setScenes, state.sources, state.setSources,
    state.selectedScene, state.setSelectedScene, state.virtualCamActive, state.setVirtualCamActive,
    state.videoInput, state.setVideoInput, state.audioInput, state.setAudioInput,
    state.audioOutput, state.setAudioOutput, state.mediaStream, state.setMediaStream,
    state.processedStream, state.setProcessedStream,
    state.maskImage, state.setMaskImage, state.maskVideo, state.setMaskVideo,
    state.useMask, state.setUseMask, state.mirrorPreview, state.setMirrorPreview,
    state.voiceEnabled, state.setVoiceEnabled, state.voiceSettings, state.setVoiceSettings,
    state.backgroundEnabled, state.setBackgroundEnabled, state.backgroundMode, state.setBackgroundMode,
    state.backgroundImage, state.setBackgroundImage, state.backgroundColor, state.setBackgroundColor,
    state.blurAmount, state.setBlurAmount, state.segmentationThreshold, state.setSegmentationThreshold,
    state.qualityPreset, state.setQualityPreset, state.customQuality, state.setCustomQuality,
  ])

  const { devices, refreshDevices, requesting } = useMediaDevices()
  const { startVirtualCamera, stopVirtualCamera, isRunning } = useVirtualCamera()
  const { processAudio, cleanup: cleanupVoice } = useVoiceProcessor()
  const { processFrame, cleanup: cleanupBg } = useBackgroundSegmentation()

  // Initialize
  useEffect(() => {
    refreshDevices()
    // Apply quality preset on change
    if (qualityPreset !== 'custom' && qualityPresets[qualityPreset]) {
      setCustomQuality(qualityPresets[qualityPreset])
    }
  }, [])

  // Connect to OBS
  const handleOBSConnect = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.obsConnect(obsConfig)
    if (result.success) {
      setObsConnected(true)
      const scenesResult = await window.electronAPI.obsGetScenes()
      if (scenesResult.success) setScenes(scenesResult.scenes)
      const sourcesResult = await window.electronAPI.obsGetSources()
      if (sourcesResult.success) setSources(sourcesResult.sources)
      const camStatus = await window.electronAPI.obsGetVirtualCamStatus()
      if (camStatus.success) setVirtualCamActive(camStatus.status)
    }
    return result
  }

  const handleOBSDisconnect = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.obsDisconnect()
    setObsConnected(false)
    setVirtualCamActive(false)
  }

  // Start/stop virtual camera pipeline
  const handleStartPipeline = async () => {
    if (!mediaStream) return

    try {
      // Start voice processing if enabled
      let audioStream = mediaStream
      if (voiceEnabled) {
        audioStream = await processAudio(mediaStream, voiceSettings)
      }

      // Combine video + processed audio
      const videoTrack = mediaStream.getVideoTracks()[0]
      const audioTracks = audioStream.getAudioTracks()
      const combinedStream = new MediaStream()
      if (videoTrack) combinedStream.addTrack(videoTrack)
      audioTracks.forEach(t => combinedStream.addTrack(t))

      setProcessedStream(combinedStream)

      // Start virtual camera via OBS
      if (obsConnected && window.electronAPI) {
        await window.electronAPI.obsStartVirtualCam()
        setVirtualCamActive(true)
      }

      // Start local virtual camera for preview
      await startVirtualCamera(combinedStream, customQuality)
    } catch (error) {
      console.error('Failed to start pipeline:', error)
      alert('Failed to start: ' + error.message)
    }
  }

  const handleStopPipeline = async () => {
    stopVirtualCamera()
    cleanupVoice()
    if (obsConnected && window.electronAPI) {
      await window.electronAPI.obsStopVirtualCam()
    }
    setVirtualCamActive(false)
    setProcessedStream(null)
  }

  // Handle window events from main process
  useEffect(() => {
    if (!window.electronAPI) return
    const unsubStart = window.electronAPI.onStartVirtualCam(handleStartPipeline)
    const unsubStop = window.electronAPI.onStopVirtualCam(handleStopPipeline)
    return () => { unsubStart(); unsubStop() }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVoice()
      cleanupBg()
      stopVirtualCamera()
    }
  }, [])

  return (
    <div className="app">
      <Header
        obsConnected={obsConnected}
        virtualCamActive={virtualCamActive || isRunning}
        onOBSConnect={handleOBSConnect}
        onOBSDisconnect={handleOBSDisconnect}
        obsConfig={obsConfig}
        setOBSConfig={setObsConfig}
      />
      <div className="main-layout">
        <aside className="sidebar">
          <OBSPanel
            connected={obsConnected}
            config={obsConfig}
            setConfig={setObsConfig}
            scenes={scenes}
            selectedScene={selectedScene}
            setSelectedScene={setSelectedScene}
            virtualCamActive={virtualCamActive}
            onConnect={handleOBSConnect}
            onDisconnect={handleOBSDisconnect}
            onStartCam={handleStartPipeline}
            onStopCam={handleStopPipeline}
          />
          <VideoPanel
            devices={devices.videoinputs}
            selectedDevice={videoInput}
            onDeviceChange={setVideoInput}
            maskImage={maskImage}
            setMaskImage={setMaskImage}
            maskVideo={maskVideo}
            setMaskVideo={setMaskVideo}
            useMask={useMask}
            setUseMask={setUseMask}
            mirrorPreview={mirrorPreview}
            setMirrorPreview={setMirrorPreview}
            requesting={requesting}
            onRefresh={refreshDevices}
          />
          <VoicePanel
            enabled={voiceEnabled}
            setEnabled={setVoiceEnabled}
            settings={voiceSettings}
            setSettings={setVoiceSettings}
            devices={devices.audioinputs}
            selectedDevice={audioInput}
            onDeviceChange={setAudioInput}
            outputDevices={devices.audiooutputs}
            selectedOutput={audioOutput}
            onOutputChange={setAudioOutput}
          />
          <BackgroundPanel
            enabled={backgroundEnabled}
            setEnabled={setBackgroundEnabled}
            mode={backgroundMode}
            setMode={setBackgroundMode}
            backgroundImage={backgroundImage}
            setBackgroundImage={setBackgroundImage}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            blurAmount={blurAmount}
            setBlurAmount={setBlurAmount}
            segmentationThreshold={segmentationThreshold}
            setSegmentationThreshold={setSegmentationThreshold}
          />
          <QualityPanel
            preset={qualityPreset}
            setPreset={setQualityPreset}
            customQuality={customQuality}
            setCustomQuality={setCustomQuality}
          />
        </aside>
        <main className="content">
          <PreviewArea
            stream={processedStream || mediaStream}
            mirror={mirrorPreview}
            useMask={useMask}
            maskImage={maskImage}
            maskVideo={maskVideo}
            backgroundEnabled={backgroundEnabled}
            backgroundMode={backgroundMode}
            backgroundImage={backgroundImage}
            backgroundColor={backgroundColor}
            blurAmount={blurAmount}
            segmentationThreshold={segmentationThreshold}
            processFrame={processFrame}
          />
          <ControlsBar
            running={virtualCamActive || isRunning}
            onStart={handleStartPipeline}
            onStop={handleStopPipeline}
            mediaStream={mediaStream}
          />
        </main>
      </div>
    </div>
  )
}

export default App