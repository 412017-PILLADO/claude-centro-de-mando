const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('centro', {
  alRecibirEstado: callback => ipcRenderer.on('estado', (_event, estado) => callback(estado)),
  pedirEstado: () => ipcRenderer.send('pedir-estado'),
  alRecibirAlerta: callback => ipcRenderer.on('alerta', (_event, id) => callback(id)),
  unirse: url => ipcRenderer.send('unirse', url),
  probarAlerta: () => ipcRenderer.send('probar-alerta'),
  trabajarTicket: ticket => ipcRenderer.send('trabajar-ticket', ticket),
  abrirUrl: url => ipcRenderer.send('abrir-url', url),
  ocultar: () => ipcRenderer.send('ocultar'),
  alto: px => ipcRenderer.send('alto', px),
})
