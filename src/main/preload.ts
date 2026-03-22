const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // 프록시 제어
  proxyStart: (port: number) => ipcRenderer.invoke('proxy:start', { port }),
  proxyStop: () => ipcRenderer.invoke('proxy:stop'),
  proxyStatus: () => ipcRenderer.invoke('proxy:status'),

  // Push 이벤트 수신
  onProxyRequest: (cb: (data: unknown) => void) =>
    ipcRenderer.on('proxy:request', (_: unknown, data: unknown) => cb(data)),
  onProxyResponse: (cb: (data: unknown) => void) =>
    ipcRenderer.on('proxy:response', (_: unknown, data: unknown) => cb(data)),
  offProxy: () => {
    ipcRenderer.removeAllListeners('proxy:request');
    ipcRenderer.removeAllListeners('proxy:response');
    ipcRenderer.removeAllListeners('proxy:error');
  },

  // DB 영속 저장
  getSessions: () => ipcRenderer.invoke('captures:sessions'),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('captures:delete-session', sessionId),
  clearAllCaptures: () => ipcRenderer.invoke('captures:clear-all'),

  // 내보내기
  exportJson: (opts: { sessionId?: string }) => ipcRenderer.invoke('export:json', opts || {}),
});
