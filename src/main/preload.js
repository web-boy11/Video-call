const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // OBS WebSocket
  obsConnect: (config) => ipcRenderer.invoke('obs-connect', config),
  obsDisconnect: () => ipcRenderer.invoke('obs-disconnect'),
  obsSetScene: (sceneName) => ipcRenderer.invoke('obs-set-scene', sceneName),
  obsSetSource: (params) => ipcRenderer.invoke('obs-set-source', params),
  obsGetScenes: () => ipcRenderer.invoke('obs-get-scenes'),
  obsGetSources: () => ipcRenderer.invoke('obs-get-sources'),
  obsStartVirtualCam: () => ipcRenderer.invoke('obs-start-virtual-cam'),
  obsStopVirtualCam: () => ipcRenderer.invoke('obs-stop-virtual-cam'),
  obsGetVirtualCamStatus: () => ipcRenderer.invoke('obs-get-virtual-cam-status'),

  // File dialogs
  selectImage: () => ipcRenderer.invoke('select-image'),
  selectVideo: () => ipcRenderer.invoke('select-video'),

  // Window events
  onStartVirtualCam: (callback) => {
    ipcRenderer.on('start-virtual-cam', callback)
    return () => ipcRenderer.off('start-virtual-cam', callback)
  },
  onStopVirtualCam: (callback) => {
    ipcRenderer.on('stop-virtual-cam', callback)
    return () => ipcRenderer.off('stop-virtual-cam', callback)
  },
})