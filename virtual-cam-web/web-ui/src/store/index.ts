import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { io, Socket } from 'socket.io-client'
import type { VoiceSettings } from '../lib/voice-changer'
import { DEFAULT_VOICE_SETTINGS } from '../lib/voice-changer'
import type { BackgroundSettings } from '../lib/background-remover'
import { DEFAULT_BACKGROUND_SETTINGS } from '../lib/background-remover'
import type { ConnectionState, StreamStats } from '../lib/webrtc-manager'

interface Agent {
  id: string
  name: string
  status: 'connected' | 'disconnected'
  capabilities: string[]
  lastSeen: number
}

interface CommandResponse {
  commandId: string
  success: boolean
  result?: any
  error?: string
}

type Mode = 'browser' | 'desktop-agent'  // browser = in-browser processing, desktop-agent = OBS relay

interface StoreState {
  // App mode
  mode: Mode
  setMode: (mode: Mode) => void

  // Connection (for desktop agent mode)
  socket: Socket | null
  connected: boolean
  clientId: string | null
  agents: Agent[]
  pairedAgentId: string | null
  pairedAgentName: string | null
  
  // OBS Config (desktop agent mode)
  obsConfig: { host: string; port: number; password: string }
  obsConnected: boolean
  scenes: string[]
  selectedScene: string
  virtualCamActive: boolean

  // Media (both modes)
  videoInput: string | null
  audioInput: string | null
  devices: { videoinputs: MediaDeviceInfo[]; audioinputs: MediaDeviceInfo[] }
  mirrorPreview: boolean

  // Voice (browser mode)
  voiceEnabled: boolean
  voiceSettings: VoiceSettings

  // Background (browser mode)
  backgroundSettings: BackgroundSettings

  // Quality (browser mode)
  qualityPreset: 'ultra' | 'high' | 'medium' | 'low' | 'custom'
  customQuality: { width: number; height: number; fps: number; bitrate: number }

  // WebRTC Streaming (browser mode)
  streaming: boolean
  streamState: ConnectionState
  streamStats: StreamStats | null
  streamUrl: string | null  // WebRTC viewer URL for meeting apps
  roomId: string | null

  // Device actions
  setDevices: (devices: StoreState['devices']) => void
  setVideoInput: (deviceId: string | null) => void
  setAudioInput: (deviceId: string | null) => void
  onVideoInputChange: (deviceId: string | null) => Promise<void>
  onAudioInputChange: (deviceId: string | null) => Promise<void>
  setMirrorPreview: (mirror: boolean) => void

  // Voice actions
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void

  // Background actions
  setBackgroundEnabled: (enabled: boolean) => void
  setBackgroundMode: (mode: BackgroundSettings['mode']) => void
  setBackgroundImage: (url: string | null) => void
  setBackgroundColor: (color: string) => void
  setBlurAmount: (amount: number) => void
  setSegmentationThreshold: (threshold: number) => void
  setBackgroundSettings: (settings: Partial<BackgroundSettings>) => void

  // Quality actions
  setQualityPreset: (preset: StoreState['qualityPreset']) => void
  setCustomQuality: (quality: Partial<StoreState['customQuality']>) => void

  // Streaming actions (browser mode)
  setStreaming: (streaming: boolean) => void
  setStreamState: (state: ConnectionState) => void
  setStreamStats: (stats: StreamStats | null) => void
  setStreamUrl: (url: string | null) => void
  setRoomId: (id: string | null) => void

  // Socket actions (desktop agent mode)
  connectToServer: (serverUrl: string) => Promise<void>
  registerClient: (preferredAgentId?: string) => void
  sendCommand: (command: string, payload: any) => Promise<any>
  disconnect: () => void

  // OBS actions (desktop agent mode)
  setOBSConfig: (config: Partial<StoreState['obsConfig']>) => void
  setOBSConnected: (connected: boolean) => void
  setScenes: (scenes: string[]) => void
  setSelectedScene: (scene: string) => void
  setVirtualCamActive: (active: boolean) => void
}

const qualityPresets = {
  ultra: { width: 3840, height: 2160, fps: 60, bitrate: 20000 },
  high: { width: 1920, height: 1080, fps: 30, bitrate: 8000 },
  medium: { width: 1280, height: 720, fps: 30, bitrate: 3500 },
  low: { width: 854, height: 480, fps: 24, bitrate: 1500 },
}

export const useStore = create<StoreState>()(devtools((set, get) => ({
  // Initial state
  mode: 'browser',  // Default to browser mode for mobile/anywhere

  socket: null,
  connected: false,
  clientId: null,
  agents: [],
  pairedAgentId: null,
  pairedAgentName: null,

  obsConfig: { host: 'localhost', port: 4455, password: '' },
  obsConnected: false,
  scenes: [],
  selectedScene: '',
  virtualCamActive: false,

  videoInput: null,
  audioInput: null,
  devices: { videoinputs: [], audioinputs: [] },
  mirrorPreview: true,

  voiceEnabled: false,
  voiceSettings: { ...DEFAULT_VOICE_SETTINGS },

  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },

  qualityPreset: 'high',
  customQuality: { ...qualityPresets.high },

  streaming: false,
  streamState: 'new',
  streamStats: null,
  streamUrl: null,
  roomId: null,

  // Device actions
  setDevices: (devices) => set({ devices }),
  setVideoInput: (videoInput) => set({ videoInput }),
  setAudioInput: (audioInput) => set({ audioInput }),
  onVideoInputChange: async (deviceId) => {
    set({ videoInput: deviceId })
    // In browser mode, we handle device change directly in the media pipeline
    // In desktop agent mode, send to agent
    const { mode, pairedAgentId, sendCommand } = get()
    if (mode === 'desktop-agent' && pairedAgentId) {
      await sendCommand('set-video-input', { deviceId })
    }
  },
  onAudioInputChange: async (deviceId) => {
    set({ audioInput: deviceId })
    const { mode, pairedAgentId, sendCommand } = get()
    if (mode === 'desktop-agent' && pairedAgentId) {
      await sendCommand('set-audio-input', { deviceId })
    }
  },
  setMirrorPreview: (mirrorPreview) => set({ mirrorPreview }),

  // Voice actions
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVoiceSettings: (voiceSettings) => set((state) => ({ 
    voiceSettings: { ...state.voiceSettings, ...voiceSettings } 
  })),

  // Background actions
  setBackgroundEnabled: (enabled) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, enabled } 
  })),
  setBackgroundMode: (mode) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, mode } 
  })),
  setBackgroundImage: (backgroundImage) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, backgroundImage } 
  })),
  setBackgroundColor: (backgroundColor) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, backgroundColor } 
  })),
  setBlurAmount: (blurAmount) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, blurAmount } 
  })),
  setSegmentationThreshold: (segmentationThreshold) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, segmentationThreshold } 
  })),
  setBackgroundSettings: (settings) => set((state) => ({ 
    backgroundSettings: { ...state.backgroundSettings, ...settings } 
  })),

  // Quality actions
  setQualityPreset: (qualityPreset) => set((state) => {
    const newQuality = qualityPreset !== 'custom' ? qualityPresets[qualityPreset] : state.customQuality
    return { qualityPreset, customQuality: newQuality }
  }),
  setCustomQuality: (customQuality) => set((state) => ({
    customQuality: { ...state.customQuality, ...customQuality },
    qualityPreset: 'custom'
  })),

  // Streaming actions
  setStreaming: (streaming) => set({ streaming }),
  setStreamState: (streamState) => set({ streamState }),
  setStreamStats: (streamStats) => set({ streamStats }),
  setStreamUrl: (streamUrl) => set({ streamUrl }),
  setRoomId: (roomId) => set({ roomId }),

  // Socket actions (desktop agent mode)
  connectToServer: async (serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        set({ socket, connected: true })
        resolve()
      })
      socket.on('connect_error', (err) => reject(err))
      socket.on('disconnect', () => set({ connected: false }))

      socket.on('agents:list', (agents) => set({ agents }))
      socket.on('client:registered', (data) => {
        set({ clientId: data.clientId, agents: data.agents })
      })
      socket.on('client:paired', (data) => {
        set({ pairedAgentId: data.agentId, pairedAgentName: data.agentName })
      })
      socket.on('client:unpaired', () => {
        set({ pairedAgentId: null, pairedAgentName: null })
      })
      socket.on('client:response', (data: CommandResponse) => {
        console.log('Command response:', data)
      })
      socket.on('agent:status', (data) => {
        set((state) => ({
          agents: state.agents.map(a => a.id === data.agentId ? { ...a, ...data.status } : a)
        }))
      })
    })
  },

  registerClient: (preferredAgentId) => {
    const { socket } = get()
    if (socket?.connected) {
      socket.emit('client:register', { preferredAgentId })
    }
  },

  sendCommand: (command, payload) => {
      const { socket, pairedAgentId } = get()
      if (!socket?.connected || !pairedAgentId) {
        return Promise.reject(new Error('Not connected or not paired'))
      }

      return new Promise((resolve, reject) => {
        const commandId = crypto.randomUUID()
        const timeout = setTimeout(() => reject(new Error('Command timeout')), 10000)

        const handler = (data: CommandResponse) => {
          if (data.commandId === commandId) {
            clearTimeout(timeout)
            socket.off('client:response', handler)
            if (data.success) resolve(data.result)
            else reject(new Error(data.error || 'Command failed'))
          }
        }

        socket.on('client:response', handler)
        socket.emit('client:command', { agentId: pairedAgentId, command, payload })
      })
    },

    disconnect: () => {
      const { socket } = get()
      if (socket) {
        socket.disconnect()
        set({ socket: null, connected: false, clientId: null, pairedAgentId: null, pairedAgentName: null })
      }
    },

    // OBS actions
    setOBSConfig: (config) => set((state) => ({ obsConfig: { ...state.obsConfig, ...config } })),
    setOBSConnected: (obsConnected) => set({ obsConnected }),
    setScenes: (scenes) => set({ scenes }),
    setSelectedScene: (selectedScene) => set({ selectedScene }),
    setVirtualCamActive: (virtualCamActive) => set({ virtualCamActive }),

    // Mode switch
    setMode: (mode) => set({ mode }),
  }), { name: 'virtual-cam-web-store' }))