const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // OBS
  onOBSStatus: (callback) => {
    ipcRenderer.on('obs:status', (_, data) => callback(data))
    return () => ipcRenderer.off('obs:status', callback)
  },
  onOBSScenes: (callback) => {
    ipcRenderer.on('obs:scenes', (_, data) => callback(data))
    return () => ipcRenderer.off('obs:scenes', callback)
  },
  onOBSSources: (callback) => {
    ipcRenderer.on('obs:sources', (_, data) => callback(data))
    return () => ipcRenderer.off('obs:sources', callback)
  },
  onOBSVirtualCamStatus: (callback) => {
    ipcRenderer.on('obs:virtual-cam-status', (_, data) => callback(data))
    return () => ipcRenderer.off('obs:virtual-cam-status', callback)
  },

  // Camera
  onCameraStarted: (callback) => {
    ipcRenderer.on('camera:started', (_, data) => callback(data))
    return () => ipcRenderer.off('camera:started', callback)
  },
  onCameraStopped: (callback) => {
    ipcRenderer.on('camera:stopped', (_, data) => callback(data))
    return () => ipcRenderer.off('camera:stopped', callback)
  },

  // Agent status
  onAgentStatus: (callback) => {
    ipcRenderer.on('agent:status', (_, data) => callback(data))
    return () => ipcRenderer.off('agent:status', callback)
  },

  // Server connection
  connectToServer: (serverUrl) => ipcRenderer.invoke('connect-to-server', serverUrl),
  disconnectFromServer: () => ipcRenderer.invoke('disconnect-from-server'),

  // File dialogs
  selectImage: () => ipcRenderer.invoke('select-image'),
  selectVideo: () => ipcRenderer.invoke('select-video'),
})