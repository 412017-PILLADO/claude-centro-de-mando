const { app, BrowserWindow, Menu, Notification, Tray, clipboard, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { gatoPng } = require('./icono')

// CENTRO_DATOS permite leer otra carpeta (para pruebas con datos simulados).
const CENTRO = process.env.CENTRO_DATOS || path.join(os.homedir(), '.claude', 'centro')
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
    if (estaOculta(sesion)) continue
    sesiones.push({ ...sesion, sinSenal: edad > SIN_SENAL_MS })
  }

  return sesiones.sort((a, b) => ultimaActividad(b) - ultimaActividad(a))
}

const ultimaActividad = sesion => sesion.lastActivityAt || sesion.startedAt || sesion.updatedAt || 0

// --- sesiones quitadas de la lista -------------------------------------
// Una sesión quitada vuelve a aparecer sola si se la usa de nuevo.

const archivoOcultas = () => path.join(app.getPath('userData'), 'sesiones-ocultas.json')
let ocultas = null // id → última actividad al momento de quitarla

function cargarOcultas() {
  if (!ocultas) ocultas = new Map(Object.entries(leerJson(archivoOcultas()) ?? {}))
  return ocultas
}

function guardarOcultas() {
  fs.writeFileSync(archivoOcultas(), JSON.stringify(Object.fromEntries(cargarOcultas())))
}

function estaOculta(sesion) {
  const lista = cargarOcultas()
  if (!lista.has(sesion.id)) return false
  if (sesion.status === 'working' || ultimaActividad(sesion) > lista.get(sesion.id)) {
    lista.delete(sesion.id)
    guardarOcultas()
    return false
  }
  return true
}

function ocultarSesion(id) {
  if (typeof id !== 'string') return
  const sesion = leerJson(path.join(SESIONES, `${path.basename(id)}.json`))
  cargarOcultas().set(id, sesion ? ultimaActividad(sesion) : Date.now())
  guardarOcultas()
  enviarEstado()
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

// Las alertas las da el gatito (globos sobre su cabeza). Si el gatito está apagado,
// se usan las notificaciones de Windows.
const hayGatito = () => Boolean(mascota && !mascota.isDestroyed())

function alertarReunion(reunion, minutos) {
  if (hayGatito()) {
    mascota.webContents.send('alerta', reunion.id)
    return
  }
  const titulo = minutos > 0 ? `${reunion.title} en ${minutos} min` : `${reunion.title} empieza ahora`
  const aviso = new Notification({ title: titulo, body: reunion.joinUrl ? 'Clic para unirte.' : 'Sin link para unirse.' })
  aviso.on('click', () => (reunion.joinUrl ? unirse(reunion.joinUrl) : abrirCentro()))
  aviso.show()
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
  if (hayGatito()) {
    mascota.webContents.send('decir', { texto: `${titulo}: ${cuerpo}`, ms: 7000 })
    return
  }
  const aviso = new Notification({ title: titulo, body: cuerpo, silent: true })
  aviso.on('click', () => abrirCentro())
  aviso.show()
}

// Sin gatito, se avisa por Windows cuando una sesión termina (el gatito lo hace solo).
function avisarCambios(sesiones) {
  const silencio = enReunion(Date.now()) || hayGatito() // en una reunión no se avisa de Claude
  for (const sesion of sesiones) {
    const antes = estadosPrevios.get(sesion.id)
    if (antes === 'working' && sesion.status === 'waiting' && !ventana?.isVisible() && !silencio) {
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
  mascota?.webContents.send('estado', estado)
}

// --- mascota: el gatito que pasea por la barra de tareas -----------------
// Vive en una franja transparente sobre la barra de tareas que deja pasar los clics;
// solo se vuelve tocable cuando el mouse está sobre el gatito (lo decide la página).

const ALTO_MASCOTA = 340 // gatito + lugar para globos apilados encima
let mascota = null

const archivoAjustes = () => path.join(app.getPath('userData'), 'ajustes.json')
const ajustes = () => leerJson(archivoAjustes()) ?? {}
const guardarAjuste = (clave, valor) => fs.writeFileSync(archivoAjustes(), JSON.stringify({ ...ajustes(), [clave]: valor }))

function zonaMascota() {
  const { workArea } = screen.getPrimaryDisplay()
  return { x: workArea.x, y: workArea.y + workArea.height - ALTO_MASCOTA, width: workArea.width, height: ALTO_MASCOTA }
}

function crearMascota() {
  if (mascota) return
  mascota = new BrowserWindow({
    ...zonaMascota(),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mascota.setAlwaysOnTop(true, 'floating')
  mascota.setIgnoreMouseEvents(true, { forward: true })
  mascota.loadFile(path.join(__dirname, 'ui', 'mascota.html'))
  mascota.once('ready-to-show', () => mascota.showInactive())
  mascota.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mascota.webContents.on('will-navigate', evento => evento.preventDefault())
  mascota.on('closed', () => {
    mascota = null
  })
}

function alternarMascota(visible) {
  guardarAjuste('mascota', visible)
  if (visible) crearMascota()
  else mascota?.destroy()
}

// Tocar al gatito (o el atajo, o la bandeja) abre el centro de mando al lado del gato.
// Si el pedido no viene del gatito, se le pregunta dónde está.
function alternarCentroDesdeAfuera() {
  if (ventana?.isVisible()) return cerrarCentro()
  if (hayGatito()) mascota.webContents.send('pedir-posicion')
  else abrirCentro()
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

const archivoVentana = () => path.join(app.getPath('userData'), 'tamano.json')

// El centro de mando ya no flota solo: se abre al tocar al gatito, al lado del gato y
// apoyado sobre la barra de tareas (crece hacia arriba).
// Tamaño: el ancho lo elige la persona; el alto se ajusta al contenido hasta un tope,
// que por defecto es lo que entra en la pantalla (así se ve todo sin scroll).
// Si la persona la achica, ese alto pasa a ser el tope y aparece el scroll.
const guardada = () => leerJson(archivoVentana()) ?? {}
let ancho = ANCHO
let altoMaximo = null // null = lo que entre en la pantalla
let altoNatural = ALTO_MINIMO
let inicioRedimension = null
let pisoDelPanel = null // borde de abajo del panel (y de pantalla): crece hacia arriba desde ahí
let ladoDelPanel = 'izquierda' // de qué lado del gatito se abrió (el gato mira hacia ahí)

function cargarTamano() {
  const { width, altoMax } = guardada()
  ancho = width ?? ANCHO
  altoMaximo = altoMax ?? null
}

function guardarPosicion() {
  fs.writeFileSync(archivoVentana(), JSON.stringify({ width: ancho, altoMax: altoMaximo }))
}

const areaDeTrabajo = () => screen.getPrimaryDisplay().workArea

function topeDeAlto() {
  const area = areaDeTrabajo()
  const piso = pisoDelPanel ?? area.y + area.height - 8
  return Math.max(ALTO_MINIMO, Math.min(altoMaximo ?? Infinity, piso - area.y - 8))
}

function ajustarTamano() {
  if (!ventana) return
  const { x } = ventana.getBounds()
  const area = areaDeTrabajo()
  const piso = pisoDelPanel ?? area.y + area.height - 8
  const alto = Math.round(Math.max(ALTO_MINIMO, Math.min(altoNatural, topeDeAlto())))
  ventana.setBounds({ x, y: Math.max(area.y + 8, piso - alto), width: Math.round(ancho), height: alto })
}

// gatoX: centro del gatito en la pantalla. Sin gatito, se abre abajo a la derecha.
function abrirCentro(gatoX) {
  if (!ventana) return
  const area = areaDeTrabajo()
  const centro = typeof gatoX === 'number' ? gatoX : area.x + area.width - 60
  const separacion = 56 // medio gatito y un poco de aire
  pisoDelPanel = area.y + area.height - 8
  let x = centro - separacion - ancho // a la izquierda del gato…
  ladoDelPanel = 'izquierda'
  if (x < area.x + 8) {
    x = centro + separacion // …o a la derecha si no entra
    ladoDelPanel = 'derecha'
  }
  x = Math.max(area.x + 8, Math.min(area.x + area.width - ancho - 8, x))
  ventana.setBounds({ x: Math.round(x), y: pisoDelPanel - ALTO_MINIMO, width: Math.round(ancho), height: ALTO_MINIMO })
  ajustarTamano()
  ventana.show()
  ventana.focus()
}

function cerrarCentro() {
  ventana?.hide()
}

function crearVentana() {
  cargarTamano()
  ventana = new BrowserWindow({
    x: 0,
    y: 0,
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
  // El gatito se entera si el centro está abierto (se queda sentado al lado).
  ventana.on('show', () => mascota?.webContents.send('centro-visible', { visible: true, lado: ladoDelPanel }))
  ventana.on('hide', () => mascota?.webContents.send('centro-visible', { visible: false, lado: ladoDelPanel }))
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  ventana.webContents.on('will-navigate', evento => evento.preventDefault())
}

// --- bandeja e inicio con Windows ---------------------------------------

const opcionesInicio = () => ({ path: process.execPath, args: [app.getAppPath()] })

function menuBandeja() {
  return Menu.buildFromTemplate([
    { label: `Abrir el centro de mando   (${ATAJO.replace('Control', 'Ctrl')})`, click: alternarCentroDesdeAfuera },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings(opcionesInicio()).openAtLogin,
      click: item => app.setLoginItemSettings({ ...opcionesInicio(), openAtLogin: item.checked }),
    },
    {
      label: 'Gatito en el escritorio',
      type: 'checkbox',
      checked: Boolean(mascota),
      click: item => alternarMascota(item.checked),
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
  bandeja.on('click', alternarCentroDesdeAfuera)
  bandeja.on('right-click', () => bandeja.popUpContextMenu(menuBandeja()))
}

// --- IPC ---------------------------------------------------------------

ipcMain.on('pedir-estado', enviarEstado)
ipcMain.on('trabajar-ticket', (_e, ticket) => trabajarTicketEnClaude(ticket))
ipcMain.on('abrir-url', (_e, url) => typeof url === 'string' && url.startsWith('https://') && shell.openExternal(url))
ipcMain.on('unirse', (_e, url) => unirse(url))
// Dónde está el mouse, relativo a la franja del gatito (para que lo persiga de vez en cuando).
ipcMain.handle('posicion-mouse', evento => {
  if (!mascota || evento.sender !== mascota.webContents) return null
  const cursor = screen.getCursorScreenPoint()
  const zona = mascota.getBounds()
  return { x: cursor.x - zona.x, y: cursor.y - zona.y }
})
// Solo la página de la mascota decide cuándo la franja deja de dejar pasar los clics.
ipcMain.on('mascota-interactiva', (evento, si) => {
  if (mascota && evento.sender === mascota.webContents) mascota.setIgnoreMouseEvents(!si, { forward: true })
})
ipcMain.on('ocultar-sesion', (_e, id) => ocultarSesion(id))
ipcMain.on('probar-alerta', probarAlerta)
ipcMain.on('ocultar', cerrarCentro)
// El gatito avisa que lo tocaron (o responde dónde está): x es su centro dentro de la franja.
ipcMain.on('alternar-centro', (evento, x) => {
  if (!mascota || evento.sender !== mascota.webContents || typeof x !== 'number') return
  if (ventana?.isVisible()) return cerrarCentro()
  abrirCentro(mascota.getBounds().x + x)
})
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
    // La manija del alto está arriba (el panel crece hacia arriba desde la barra de tareas).
    altoMaximo = Math.max(ALTO_MINIMO, inicio.height - dy)
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
  app.on('second-instance', () => {
    if (!ventana?.isVisible()) alternarCentroDesdeAfuera()
  })
  app.whenReady().then(() => {
    app.setAppUserModelId('centro-flotante')
    crearVentana()
    crearBandeja()
    if (ajustes().mascota !== false) crearMascota()
    screen.on('display-metrics-changed', () => mascota?.setBounds(zonaMascota()))
    vigilar()
    globalShortcut.register(ATAJO, alternarCentroDesdeAfuera)
    // Para revisar la interfaz sin mirarla: CENTRO_CAPTURA=ruta.png guarda una captura y cierra.
    if (process.env.CENTRO_CAPTURA) {
      ventana.webContents.once('did-finish-load', () =>
        setTimeout(async () => {
          abrirCentro()
          await new Promise(listo => setTimeout(listo, 400))
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
