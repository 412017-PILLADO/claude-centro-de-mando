const { app, BrowserWindow, Menu, Notification, Tray, clipboard, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { gatoPng } = require('./icono')

const CENTRO = path.join(os.homedir(), '.claude', 'centro')
const SESIONES = path.join(CENTRO, 'sesiones')
const ATAJO = 'Control+Alt+Space'
const SIN_SENAL_MS = 90_000 // el mod late cada 30 s
const OLVIDAR_MS = 12 * 60 * 60 * 1000
const ANCHO = 340
const ANCHO_MINIMO = 300
const ANCHO_MAXIMO = 760
const ALTO_MINIMO = 64

let ventana = null
let bandeja = null
const estadosPrevios = new Map()

// --- lectura de lo que escribe el mod ----------------------------------

function leerJson(archivo) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'))
  } catch {
    return null
  }
}

function leerSesiones(ahora) {
  let archivos = []
  try {
    archivos = fs.readdirSync(SESIONES).filter(nombre => nombre.endsWith('.json'))
  } catch {
    return []
  }
  const sesiones = []
  for (const nombre of archivos) {
    const archivo = path.join(SESIONES, nombre)
    const sesion = leerJson(archivo)
    if (!sesion) continue
    const edad = ahora - (sesion.updatedAt ?? 0)
    if (sesion.status === 'closed' || edad > OLVIDAR_MS) {
      fs.rm(archivo, { force: true }, () => {})
      continue
    }
    sesiones.push({ ...sesion, sinSenal: edad > SIN_SENAL_MS })
  }

  return sesiones.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

function armarEstado() {
  const ahora = Date.now()
  return {
    ahora,
    sesiones: leerSesiones(ahora),
    tickets: leerJson(path.join(CENTRO, 'tickets.json')),
    reuniones: leerReuniones(ahora),
  }
}

// --- reuniones -----------------------------------------------------------

const AVISO_ANTES_MS = 5 * 60_000
const AVISO_INICIO_MS = 5 * 60_000 // el aviso de "empieza ahora" vale hasta 5 min después
const avisosDados = new Set()
let reunionDePrueba = null

const LINKS_PERMITIDOS = /^https:\/\/(meet\.google\.com|([\w-]+\.)?zoom\.us|teams\.microsoft\.com|teams\.live\.com)\//i

function leerReuniones(ahora) {
  const guardadas = leerJson(path.join(CENTRO, 'reuniones.json'))?.items ?? []
  const todas = reunionDePrueba ? [reunionDePrueba, ...guardadas] : guardadas
  return todas
    .filter(r => Date.parse(r.end) > ahora)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

const enReunion = ahora =>
  leerReuniones(ahora).some(r => !r.esPrueba && Date.parse(r.start) <= ahora && Date.parse(r.end) > ahora)

function unirse(url) {
  if (typeof url === 'string' && LINKS_PERMITIDOS.test(url)) shell.openExternal(url)
}

function alertarReunion(reunion, minutos) {
  const titulo = minutos > 0 ? `${reunion.title} en ${minutos} min` : `${reunion.title} empieza ahora`
  const aviso = new Notification({ title: titulo, body: reunion.joinUrl ? 'Clic para unirte.' : 'Sin link para unirse.' })
  aviso.on('click', () => (reunion.joinUrl ? unirse(reunion.joinUrl) : mostrar()))
  aviso.show()
  if (ventana && !ventana.isVisible()) ventana.showInactive()
  ventana?.webContents.send('alerta', reunion.id)
}

function revisarReuniones() {
  const ahora = Date.now()
  for (const reunion of leerReuniones(ahora)) {
    const inicio = Date.parse(reunion.start)
    if (ahora >= inicio - AVISO_ANTES_MS && ahora < inicio && !avisosDados.has(`${reunion.id}:antes`)) {
      avisosDados.add(`${reunion.id}:antes`)
      alertarReunion(reunion, Math.max(1, Math.round((inicio - ahora) / 60_000)))
    }
    if (ahora >= inicio && ahora < inicio + AVISO_INICIO_MS && !avisosDados.has(`${reunion.id}:inicio`)) {
      avisosDados.add(`${reunion.id}:inicio`)
      alertarReunion(reunion, 0)
    }
  }
}

function probarAlerta() {
  const ahora = Date.now()
  reunionDePrueba = {
    id: `prueba-${ahora}`,
    title: 'Reunión de prueba',
    start: new Date(ahora + AVISO_ANTES_MS).toISOString(),
    end: new Date(ahora + AVISO_ANTES_MS + 10 * 60_000).toISOString(),
    joinUrl: 'https://meet.google.com/',
    calendarUrl: '',
    esPrueba: true,
  }
  revisarReuniones()
  enviarEstado()
}

function avisar(titulo, cuerpo) {
  const aviso = new Notification({ title: titulo, body: cuerpo, silent: true })
  aviso.on('click', mostrar)
  aviso.show()
}

function avisarCambios(sesiones) {
  const silencio = enReunion(Date.now()) // en una reunión no se avisa de Claude
  for (const sesion of sesiones) {
    const antes = estadosPrevios.get(sesion.id)
    if (antes === 'working' && sesion.status === 'waiting' && !ventana?.isFocused() && !silencio) {
      avisar(`✓ ${sesion.name}`, 'Claude terminó y te está esperando.')
    }
    estadosPrevios.set(sesion.id, sesion.status)
  }
}

function enviarEstado() {
  if (!ventana) return
  const estado = armarEstado()
  avisarCambios(estado.sesiones)
  ventana.webContents.send('estado', estado)
}

let pendiente = null
function enviarPronto() {
  clearTimeout(pendiente)
  pendiente = setTimeout(enviarEstado, 150)
}

function vigilar() {
  fs.mkdirSync(SESIONES, { recursive: true })
  fs.watch(CENTRO, { recursive: true }, enviarPronto)
  setInterval(enviarEstado, 5000) // refresca los "hace X" y detecta sesiones sin señal
  setInterval(revisarReuniones, 15_000)
  revisarReuniones()
}

// --- acciones ----------------------------------------------------------

// Abre Claude Desktop con el pedido en el portapapeles: la app no recibe texto por link.
function trabajarTicketEnClaude(ticket) {
  if (!ticket || typeof ticket.key !== 'string') return
  clipboard.writeText(
    `Trabajá en el ticket ${ticket.key} (${ticket.summary ?? ''}). ` +
      'Primero leelo completo en Jira, después ubicá el código involucrado y proponeme un plan antes de cambiar nada.',
  )
  shell.openExternal('claude://')
  avisar(`${ticket.key} listo para Claude`, 'Copié el pedido: pegalo en Claude con Ctrl+V.')
}

// --- ventana -----------------------------------------------------------

const archivoVentana = () => path.join(app.getPath('userData'), 'posicion.json')

// Tamaño: el ancho lo elige la persona; el alto se ajusta al contenido hasta un tope,
// que por defecto es lo que entra en la pantalla (así se ve todo sin scroll).
// Si la persona la achica, ese alto pasa a ser el tope y aparece el scroll.
const guardada = () => leerJson(archivoVentana()) ?? {}
let ancho = ANCHO
let altoMaximo = null // null = lo que entre en la pantalla
let altoNatural = ALTO_MINIMO
let inicioRedimension = null

function posicionInicial() {
  const { x, y, width, altoMax } = guardada()
  ancho = width ?? ANCHO
  altoMaximo = altoMax ?? null
  if (x !== undefined && y !== undefined) return { x, y }
  const { workArea } = screen.getPrimaryDisplay()
  return { x: workArea.x + workArea.width - ancho - 12, y: workArea.y + 12 }
}

function guardarPosicion() {
  if (!ventana) return
  const [x, y] = ventana.getPosition()
  fs.writeFileSync(archivoVentana(), JSON.stringify({ x, y, width: ancho, altoMax: altoMaximo }))
}

function topeDeAlto() {
  const { x, y } = ventana.getBounds()
  const { workArea } = screen.getDisplayNearestPoint({ x, y })
  const lugarEnPantalla = workArea.y + workArea.height - y - 8
  return Math.max(ALTO_MINIMO, Math.min(altoMaximo ?? Infinity, lugarEnPantalla))
}

function ajustarTamano() {
  if (!ventana) return
  const { x, y } = ventana.getBounds()
  const alto = Math.round(Math.max(ALTO_MINIMO, Math.min(altoNatural, topeDeAlto())))
  ventana.setBounds({ x, y, width: Math.round(ancho), height: alto })
}

function crearVentana() {
  ventana = new BrowserWindow({
    ...posicionInicial(),
    width: ancho,
    height: ALTO_MINIMO,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    show: false,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  ventana.setAlwaysOnTop(true, 'floating')
  ventana.loadFile(path.join(__dirname, 'ui', 'index.html'))
  ventana.once('ready-to-show', () => ventana.showInactive())
  ventana.on('moved', guardarPosicion)
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  ventana.webContents.on('will-navigate', evento => evento.preventDefault())
}

function mostrar() {
  if (!ventana) return
  ventana.show()
  ventana.focus()
}

function alternar() {
  if (!ventana) return
  ventana.isVisible() ? ventana.hide() : mostrar()
}

// --- bandeja e inicio con Windows ---------------------------------------

const opcionesInicio = () => ({ path: process.execPath, args: [app.getAppPath()] })

function menuBandeja() {
  return Menu.buildFromTemplate([
    { label: `Mostrar / ocultar   (${ATAJO.replace('Control', 'Ctrl')})`, click: alternar },
    {
      label: 'Siempre visible',
      type: 'checkbox',
      checked: ventana?.isAlwaysOnTop() ?? true,
      click: item => ventana?.setAlwaysOnTop(item.checked, 'floating'),
    },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings(opcionesInicio()).openAtLogin,
      click: item => app.setLoginItemSettings({ ...opcionesInicio(), openAtLogin: item.checked }),
    },
    { label: 'Probar alerta de reunión', click: probarAlerta },
    { label: 'Abrir carpeta de datos', click: () => shell.openPath(CENTRO) },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ])
}

function crearBandeja() {
  // Pixel art: una imagen por escala de pantalla, para que no se vea borroso.
  const imagen = nativeImage.createFromBuffer(gatoPng(1), { scaleFactor: 1 })
  imagen.addRepresentation({ scaleFactor: 2, buffer: gatoPng(2) })
  bandeja = new Tray(imagen)
  bandeja.setToolTip('Centro de mando de Claude')
  bandeja.on('click', alternar)
  bandeja.on('right-click', () => bandeja.popUpContextMenu(menuBandeja()))
}

// --- IPC ---------------------------------------------------------------

ipcMain.on('pedir-estado', enviarEstado)
ipcMain.on('trabajar-ticket', (_e, ticket) => trabajarTicketEnClaude(ticket))
ipcMain.on('abrir-url', (_e, url) => typeof url === 'string' && url.startsWith('https://') && shell.openExternal(url))
ipcMain.on('unirse', (_e, url) => unirse(url))
ipcMain.on('probar-alerta', probarAlerta)
ipcMain.on('ocultar', () => ventana?.hide())
// La interfaz mide cuánto ocupa su contenido completo; la ventana toma ese alto hasta el tope.
ipcMain.on('alto', (_e, alto) => {
  if (typeof alto !== 'number') return
  altoNatural = alto
  ajustarTamano()
})

// Manijas propias: una ventana transparente no se redimensiona desde los bordes en Windows.
ipcMain.on('redimension-inicio', () => {
  if (ventana) inicioRedimension = ventana.getBounds()
})
ipcMain.on('redimension', (_e, { dx, dy, lado }) => {
  if (!ventana || !inicioRedimension || typeof dx !== 'number' || typeof dy !== 'number') return
  const inicio = inicioRedimension
  if (lado === 'ancho') {
    // Crece hacia la izquierda: el borde derecho queda fijo.
    ancho = Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, inicio.width - dx))
    ventana.setBounds({ x: Math.round(inicio.x + inicio.width - ancho), y: inicio.y, width: Math.round(ancho), height: inicio.height })
  } else {
    altoMaximo = Math.max(ALTO_MINIMO, inicio.height + dy)
    ajustarTamano()
  }
})
ipcMain.on('redimension-fin', () => {
  inicioRedimension = null
  guardarPosicion()
})
ipcMain.on('tamano-automatico', () => {
  if (!ventana) return
  const antes = ventana.getBounds()
  ancho = ANCHO
  altoMaximo = null
  ventana.setBounds({ ...antes, x: antes.x + antes.width - ANCHO, width: ANCHO }) // el borde derecho queda fijo
  ajustarTamano()
  guardarPosicion()
})

// --- arranque ----------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', mostrar)
  app.whenReady().then(() => {
    app.setAppUserModelId('centro-flotante')
    crearVentana()
    crearBandeja()
    vigilar()
    globalShortcut.register(ATAJO, alternar)
    // Para revisar la interfaz sin mirarla: CENTRO_CAPTURA=ruta.png guarda una captura y cierra.
    if (process.env.CENTRO_CAPTURA) {
      ventana.webContents.once('did-finish-load', () =>
        setTimeout(async () => {
          if (process.env.CENTRO_PROBAR_ALERTA) {
            probarAlerta()
            await new Promise(listo => setTimeout(listo, 600))
          }
          fs.writeFileSync(process.env.CENTRO_CAPTURA, (await ventana.webContents.capturePage()).toPNG())
          app.quit()
        }, 1500),
      )
    }
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => {})
}
