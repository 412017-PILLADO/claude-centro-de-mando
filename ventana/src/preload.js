const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('centro', {
  alRecibirEstado: callback => ipcRenderer.on('estado', (_event, estado) => callback(estado)),
  pedirEstado: () => ipcRenderer.send('pedir-estado'),
  alRecibirAlerta: callback => ipcRenderer.on('alerta', (_event, id) => callback(id)),
  unirse: url => ipcRenderer.send('unirse', url),
  ocultarSesion: id => ipcRenderer.send('ocultar-sesion', id),
  probarAlerta: () => ipcRenderer.send('probar-alerta'),
  trabajarTicket: ticket => ipcRenderer.send('trabajar-ticket', ticket),
  abrirUrl: url => ipcRenderer.send('abrir-url', url),
  ocultar: () => ipcRenderer.send('ocultar'),
  alto: px => ipcRenderer.send('alto', px),
  redimensionInicio: () => ipcRenderer.send('redimension-inicio'),
  redimension: (dx, dy, lado) => ipcRenderer.send('redimension', { dx, dy, lado }),
  redimensionFin: () => ipcRenderer.send('redimension-fin'),
  tamanoAutomatico: () => ipcRenderer.send('tamano-automatico'),
  mascotaInteractiva: si => ipcRenderer.send('mascota-interactiva', si),
  alternarCentro: x => ipcRenderer.send('alternar-centro', x),
  alRecibirCentroVisible: callback => ipcRenderer.on('centro-visible', (_event, visible) => callback(visible)),
  alRecibirPedidoPosicion: callback => ipcRenderer.on('pedir-posicion', () => callback()),
  alRecibirDecir: callback => ipcRenderer.on('decir', (_event, mensaje) => callback(mensaje)),
  posicionMouse: () => ipcRenderer.invoke('posicion-mouse'),
})
