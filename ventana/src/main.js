const { app, BrowserWindow, Menu, Notification, Tray, clipboard, globalShortcut, ipcMain, nativeImage, screen, shell, powerMonitor } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { gatoPng } = require('./icono')

// CENTRO_DATOS permite leer otra carpeta (para pruebas con datos simulados).
const CENTRO = process.env.CENTRO_DATOS || path.join(os.homedir(), '.claude', 'centro')
const SESIONES = path.join(CENTRO, 'sesiones')
const vida = require('./gatito').crearVida(CENTRO)
// Config de la app (config.json en la carpeta de la app); se crea al primer uso, cuando ya hay ruta.
let configCreada = null
const config = () => (configCreada ??= require('./nucleo/config').crearConfig(app.getPath('userData')))
// Las capturas y las mediciones usan su propio perfil para no cambiar los ajustes de la persona.
if (process.env.CENTRO_PERFIL) {
  fs.mkdirSync(process.env.CENTRO_PERFIL, { recursive: true })
  app.setPath('userData', process.env.CENTRO_PERFIL)
} else if (process.env.CENTRO_CAPTURA) {
  const perfil = path.join(path.dirname(process.env.CENTRO_CAPTURA), 'perfil-electron')
  fs.mkdirSync(perfil, { recursive: true })
  app.setPath('userData', perfil)
}
if (!config().get().aceleracionGrafica) app.disableHardwareAcceleration()
const ATAJO = 'Control+Alt+Space'
const SIN_SENAL_MS = 90_000 // el mod late cada 30 s
const OLVIDAR_MS = 12 * 60 * 60 * 1000
const ANCHO = 600
const ANCHO_MINIMO = 300
const ANCHO_MAXIMO = 1400
const ALTO_MINIMO = 64

let ventana = null
let bandeja = null
const estadosPrevios = new Map()

// --- lectura de lo que escribe el mod ----------------------------------

// Solo se vuelve a parsear un archivo si cambió (fecha o tamaño).
const cacheJson = new Map() // archivo → { firma, valor }
function leerJson(archivo) {
  try {
    const info = fs.statSync(archivo), firma = info.mtimeMs + ':' + info.size
    const guardado = cacheJson.get(archivo)
    if (guardado?.firma === firma) return structuredClone(guardado.valor)
    const valor = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    cacheJson.set(archivo, { firma, valor })
    return structuredClone(valor)
  } catch {
    cacheJson.delete(archivo)
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

const fuentesVisibles = () => require('./fuentes').visibles(config().get(), CENTRO, leerJson)

function armarEstado() {
  const ahora = Date.now()
  const fuentes = fuentesVisibles()
  const sesiones=fuentes.sesiones?leerSesiones(ahora):[], reuniones=leerReuniones(ahora, fuentes)
  const reunion=reuniones.some(r=>Date.parse(r.start)-5*60000<=ahora && ahora<(Date.parse(r.end)||Date.parse(r.start)+3600000))
  const alerta=sesiones.some(s=>!s.sinSenal&&s.status==='waiting'&&ahora-(s.lastActivityAt||s.startedAt||0)<10*60000)
  const contexto={reunion,alerta,trabajando:sesiones.some(s=>!s.sinSenal&&s.status==='working'),inactivoSeg:powerMonitor.getSystemIdleTime(),panel:ventana?.isVisible()||false,azar:Math.random()}
  if(typeof screen!=='undefined')contexto.bordes=bordesMascota()
  const observado=mascotaLista?vida.observar(contexto):{datos:vida.leer(),eventos:[]}
  return {ahora,gatito:observado.datos,eventosGatito:observado.eventos,contextoGatito:contexto,sesiones,reuniones,errorReuniones:errorReuniones(),config:config().get(),fuentes,tickets:fuentes.tickets?leerJson(path.join(CENTRO,'tickets.json')):null}
}

// --- reuniones -----------------------------------------------------------

const AVISO_ANTES_MS = 5 * 60_000
const AVISO_INICIO_MS = 5 * 60_000 // el aviso de "empieza ahora" vale hasta 5 min después
const avisosDados = new Set()
let reunionDePrueba = null

const LINKS_PERMITIDOS = /^https:\/\/(meet\.google\.com|([\w-]+\.)?zoom\.us|teams\.microsoft\.com|teams\.live\.com)\//i

// Último error del calendario, si es más nuevo que la última carga buena.
function errorReuniones() {
  const error = leerJson(path.join(CENTRO, 'reuniones-error.json'))
  const cargadas = leerJson(path.join(CENTRO, 'reuniones.json'))?.loadedAt ?? 0
  return error?.error && error.at > cargadas ? String(error.error) : null
}

function leerReuniones(ahora, fuentes = fuentesVisibles()) {
  const guardadas = fuentes.reuniones ? leerJson(path.join(CENTRO, 'reuniones.json'))?.items ?? [] : []
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
  // El panel oculto no recibe nada: al mostrarse se le manda el estado del momento.
  if (ventana.isVisible()) ventana.webContents.send('estado', estado)
  mascota?.webContents.send('estado', estado)
}

// --- mascota: el gatito que pasea por la barra de tareas -----------------
// Vive en una franja transparente sobre la barra de tareas que deja pasar los clics;
// solo se vuelve tocable cuando el mouse está sobre el gatito (lo decide la página).

const ALTO_MASCOTA = 340 // gatito + lugar para globos apilados encima
let mascota = null
let mascotaLista = false


// Los monitores vecinos solo cambian cuando cambia la configuración de pantallas.
let vecinosCache = null
const vecinosDeMascota = () => (vecinosCache ??= require('./monitores').vecinos(screen.getAllDisplays(), monitorMascota()))
function monitorMascota() {
  return require('./monitores').elegirMonitor(screen.getAllDisplays(), config().get().mascota.monitor, screen.getPrimaryDisplay())
}

function bordesMascota() {
  const lados=require('./monitores').vecinos(screen.getAllDisplays(),monitorMascota())
  return {izquierda:!!lados.izquierda,derecha:!!lados.derecha}
}
function zonaMascota() {
  const { workArea } = monitorMascota()
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
  mascota.webContents.once('did-finish-load',()=>{mascotaLista=true;enviarEstado()})
  mascota.loadFile(path.join(__dirname, 'ui', 'mascota.html'))
  mascota.once('ready-to-show', () => mascota.showInactive())
  mascota.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mascota.webContents.on('will-navigate', evento => evento.preventDefault())
  mascota.on('blur',()=>mascota?.webContents.send('cerrar-menu'))
  mascota.on('closed', () => {
    if (arrastreGlobal) { clearInterval(arrastreGlobal.reloj); arrastreGlobal = null }
    cancelarSalto(false)
    if(caidaGlobal){clearInterval(caidaGlobal);caidaGlobal=null}
    mascotaLista=false
    mascota = null
  })
}

function alternarMascota(visible) {
  config().set({ 'mascota.visible': visible })
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
  fs.watch(CENTRO, { recursive: true }, (_evento, nombre) => {
    // La vida se guarda acá mismo: no dispara otra lectura de trabajo.
    if (nombre && /^gatito\.json(?:\.tmp)?$/.test(String(nombre))) return
    enviarPronto()
  })
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

// El centro abre al costado del gato, con ancho para tres columnas y alto acotado.
// El ancho lo elige la persona; el alto se ajusta al contenido hasta 540 px.
// Si la persona la achica, ese alto pasa a ser el tope y aparece el scroll.
const guardada = () => leerJson(archivoVentana()) ?? {}
let ancho = ANCHO
let altoMaximo = null // null = lo que entre en la pantalla
let altoNatural = ALTO_MINIMO
let inicioRedimension = null
let pisoDelPanel = null // borde de abajo del panel (y de pantalla): crece hacia arriba desde ahí
let centroPanel = null
let ladoDelPanel = 'izquierda' // de qué lado del gatito se abrió (el gato mira hacia ahí)

function cargarTamano() {
  const { width, altoMax, diseno } = guardada()
  // Migración única (diseno 3): el ancho viejo (1080) pasa al nuevo por defecto; un ancho elegido a mano (<= 760) se respeta.
  ancho = diseno === 3 ? width ?? ANCHO : typeof width === 'number' && width <= 760 ? width : ANCHO
  altoMaximo = altoMax ?? null
  if (diseno !== 3) guardarPosicion()
}

function guardarPosicion() {
  fs.writeFileSync(archivoVentana(), JSON.stringify({ width: ancho, altoMax: altoMaximo, diseno: 3 }))
}

const areaDeTrabajo = () => monitorMascota().workArea

function topeDeAlto() {
  const area = areaDeTrabajo()
  const piso = pisoDelPanel ?? area.y + area.height - 8
  return Math.max(ALTO_MINIMO, Math.min(altoMaximo ?? 540, piso - area.y - 8))
}

function ajustarTamano() {
  if (!ventana) return
  const area = areaDeTrabajo()
  const piso = pisoDelPanel ?? area.y + area.height - 8
  const alto = Math.round(Math.max(ALTO_MINIMO, Math.min(altoNatural, topeDeAlto())))
  const ubicacion = require('./monitores').ubicarPanel(area, centroPanel ?? area.x + area.width - 170, ancho)
  ladoDelPanel = ubicacion.lado
  ventana.setBounds({ x: ubicacion.x, y: Math.max(area.y + 8, piso - alto), width: ubicacion.width, height: alto })
}

// gatoX: centro del gatito en la pantalla. Sin gatito, se abre abajo a la derecha.
function abrirCentro(gatoX) {
  if (!ventana) return
  const area = areaDeTrabajo()
  const centro = typeof gatoX === 'number' ? gatoX : area.x + area.width - 60
  centroPanel = Math.max(area.x + 64, Math.min(area.x + area.width - 64, centro))
  pisoDelPanel = area.y + area.height - 8
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
    // Ventana totalmente transparente: solo flotan los bloques (el vidrio se simula en CSS por bloque).
    // Un material nativo (acrylic) se aplicaría a toda la ventana y volvería a crear el contenedor de fondo.
    transparent: true,
    backgroundMaterial: 'none',
    backgroundColor: '#00000000',
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
  ventana.on('show', () => {
    ventana.webContents.send('estado', armarEstado())
    mascota?.webContents.send('centro-visible', { visible: true, lado: ladoDelPanel })
  })
  ventana.on('blur', () => {
    const cursor = screen.getCursorScreenPoint(), caja = mascota?.getBounds()
    const sobreGato = caja && centroGatoGlobal !== null && Math.abs(cursor.x-centroGatoGlobal)<54 && cursor.y>=caja.y+caja.height-84 && cursor.y<=caja.y+caja.height
    if (require('./panel').cerrarPorBlur({redimensionando:Boolean(inicioRedimension),sobreGato})) cerrarCentro()
  })
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
      click: item => {
        config().set({ inicioAutomatico: item.checked })
        app.setLoginItemSettings({ ...opcionesInicio(), openAtLogin: item.checked })
      },
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

// La franja sigue al cursor global, incluso fuera del monitor original.
let arrastreGlobal = null, caidaGlobal = null, centroGatoGlobal = null
let saltoGlobal=null
function cancelarSalto(caer=true) {
  if(!saltoGlobal)return
  const punto=saltoGlobal.punto
  clearInterval(saltoGlobal.reloj);saltoGlobal=null
  if(caer&&mascota)empezarCaida(punto)
}
ipcMain.on('gatito-cruzar',(evento,lado)=>{
  if(!mascota||evento.sender!==mascota.webContents||!['izquierda','derecha'].includes(lado)||saltoGlobal||arrastreGlobal||caidaGlobal)return
  const estado=armarEstado(),c=estado.contextoGatito
  const origen=monitorMascota(),g=require('./monitores'),destino=g.vecinos(screen.getAllDisplays(),origen)[lado]
  if(!destino||c.reunion||c.alerta||c.trabajando||c.panel||estado.gatito.foco?.fase==='foco'){
    mascota.webContents.send('gatito-arrastre',{x:(centroGatoGlobal??origen.workArea.x+75)-origen.workArea.x,cancelado:true});return
  }
  const plan=g.planSalto(origen,destino,lado),desde=Date.now()
  mascota.setIgnoreMouseEvents(true,{forward:true})
  saltoGlobal={punto:plan.despegue,reloj:setInterval(()=>{
    if(!mascota){cancelarSalto(false);return}
    const t=Math.min(1,(Date.now()-desde)/650),p=g.puntoSalto(plan,t)
    saltoGlobal.punto={x:Math.round(p.x),y:Math.round(p.y)}
    const area=screen.getDisplayNearestPoint(saltoGlobal.punto).workArea,izquierda=Math.round(p.x-area.width/2)
    mascota.setBounds({x:izquierda,y:Math.round(p.y-ALTO_MASCOTA),width:area.width,height:ALTO_MASCOTA})
    mascota.webContents.send('gatito-arrastre',{x:p.x-izquierda,saltando:true,fase:p.fase,lado})
    if(t===1){
      clearInterval(saltoGlobal.reloj);saltoGlobal=null;config().set({'mascota.monitor':destino.id});vecinosCache=null
      mascota.setBounds(zonaMascota())
      mascota.webContents.send('gatito-arrastre',{aterrizo:true,x:plan.aterrizaje.x-destino.workArea.x})
      enviarEstado()
    }
  },16)}
})
function empezarCaida(cursor = screen.getCursorScreenPoint()) {
  if (!mascota) return
  if (caidaGlobal) clearInterval(caidaGlobal)
  const display = screen.getDisplayNearestPoint(cursor), area=display.workArea
  config().set({ 'mascota.monitor': display.id })
  vecinosCache = null
  const piso=area.y+area.height-ALTO_MASCOTA
  const origen=Math.max(area.y-ALTO_MASCOTA+84,Math.min(piso,mascota.getBounds().y))
  const x=Math.max(area.x+54,Math.min(area.x+area.width-54,cursor.x))
  const fisica=require('./caida'), caida=fisica.crearCaida(origen,piso,Date.now())
  mascota.setBounds({x:area.x,y:Math.round(origen),width:area.width,height:ALTO_MASCOTA})
  mascota.setIgnoreMouseEvents(true,{forward:true})
  mascota.webContents.send('gatito-arrastre',{x:x-area.x,soltado:true,cayendo:true})
  caidaGlobal=setInterval(()=>{
    if(!mascota){clearInterval(caidaGlobal);caidaGlobal=null;return}
    const paso=fisica.pasoCaida(caida,Date.now())
    mascota.setBounds({x:area.x,y:Math.round(paso.y),width:area.width,height:ALTO_MASCOTA})
    if(paso.termino){clearInterval(caidaGlobal);caidaGlobal=null;mascota.webContents.send('gatito-arrastre',{x:x-area.x,aterrizo:true})}
  },16)
}
function terminarArrastre() {
  if (!arrastreGlobal || !mascota) return
  clearInterval(arrastreGlobal.reloj)
  arrastreGlobal = null
  empezarCaida()
}
ipcMain.on('gatito-arrastre', (evento, si) => {
  if (!mascota || evento.sender !== mascota.webContents) return
  if(saltoGlobal)return
  if (!si) return terminarArrastre()
  if (caidaGlobal) {clearInterval(caidaGlobal);caidaGlobal=null}
  cerrarCentro()
  const origen = screen.getCursorScreenPoint()
  arrastreGlobal = {origen, reloj: setInterval(() => {
    if (!mascota) return terminarArrastre()
    const cursor = screen.getCursorScreenPoint()
    if (Math.hypot(cursor.x-origen.x,cursor.y-origen.y) < 5) return
    const display = screen.getDisplayNearestPoint(cursor)
    const width = display.workArea.width
    const x = Math.round(cursor.x - width / 2)
    mascota.setBounds({x, y: Math.round(cursor.y - ALTO_MASCOTA + 42), width, height: ALTO_MASCOTA})
    mascota.webContents.send('gatito-arrastre', {x: cursor.x - x})
  }, 16)}
})
ipcMain.on('gatito-posicion', (evento, x) => { if(mascota && evento.sender===mascota.webContents && Number.isFinite(x)) centroGatoGlobal=mascota.getBounds().x+x })

ipcMain.on('pedir-estado', enviarEstado)
ipcMain.on('abrir-gatito', (evento,x) => {if(evento.sender!==mascota?.webContents)return;abrirCentro(mascota.getBounds().x+x)})
ipcMain.on('gatito-descanso', (_evento, si) => vida.actuar('descanso', Boolean(si)))
// Cambios de config desde las páginas: la config valida cada valor y rechaza claves desconocidas.
ipcMain.on('config', (_evento, cambios) => {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) return
  try { config().set(cambios) } catch (error) { console.error('Config:', error.message); return }
  enviarEstado()
})
ipcMain.on('gatito-accion', (_evento, { accion, valor } = {}) => {
  const permitidas = ['nombre', 'color', 'croquetas', 'pescado', 'leche', 'mimar', 'jugar', 'siesta', 'raton', 'caja', 'pausas', 'pausa-respuesta', 'conducta-hecha', 'foco-iniciar', 'foco-cancelar']
  if (!permitidas.includes(accion)) return
  const cuidado = vida.actuar(accion, valor)
  enviarEstado()
  if(['croquetas','pescado','leche','mimar','jugar','siesta','raton','caja'].includes(accion)&&cuidado.resultado?.aceptado===false)mascota?.webContents.send('gatito-accion',{aceptado:false,texto:cuidado.resultado.texto})
  if(cuidado.resultado?.aceptado && cuidado.resultado.accion===accion) mascota?.webContents.send('gatito-accion', {accion,favorita:cuidado.resultado.favorita,texto:cuidado.resultado.texto})
})
ipcMain.on('trabajar-ticket', (_e, ticket) => trabajarTicketEnClaude(ticket))
ipcMain.on('abrir-url', (_e, url) => typeof url === 'string' && url.startsWith('https://') && shell.openExternal(url))
ipcMain.on('unirse', (_e, url) => unirse(url))
// Dónde está el mouse, relativo a la franja del gatito (para que lo persiga de vez en cuando).
ipcMain.handle('posicion-mouse', evento => {
  if (!mascota || evento.sender !== mascota.webContents) return null
  const cursor = screen.getCursorScreenPoint()
  const zona = mascota.getBounds()
  // Sobre la franja no hace falta saber hacia qué monitor vecino apunta.
  const dentro = cursor.x >= zona.x && cursor.x < zona.x + zona.width && cursor.y >= zona.y && cursor.y < zona.y + zona.height
  let lado = null
  if (!dentro) {
    const lados = vecinosDeMascota(), display = screen.getDisplayNearestPoint(cursor)
    lado = Object.keys(lados).find(l => lados[l]?.id === display.id) || null
  }
  return { x: cursor.x - zona.x, y: cursor.y - zona.y, lado }
})
// Solo la página de la mascota decide cuándo la franja deja de dejar pasar los clics.
ipcMain.on('menu-rapido', (evento, abierto) => {
  if(evento.sender!==mascota?.webContents)return
  mascota.setFocusable(Boolean(abierto))
  if(abierto)mascota.focus()
})
ipcMain.on('mascota-interactiva', (evento, si) => {
  if (mascota && evento.sender === mascota.webContents) mascota.setIgnoreMouseEvents(Boolean(caidaGlobal||saltoGlobal) || !si, { forward: true })
})
ipcMain.on('reubicar-centro', (evento, x) => {
  if (mascota && evento.sender === mascota.webContents && Number.isFinite(x) && ventana?.isVisible()) abrirCentro(mascota.getBounds().x + x)
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
  if (!Number.isFinite(alto) || alto < 0) return
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
    ajustarTamano()
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

ipcMain.on('gatito-registro', (evento, entradas) => {
  // Registro de animaciones para depurar: solo si se pide, en la carpeta de la app.
  if (!process.env.CENTRO_REGISTRO) return
  if (!mascota || evento.sender !== mascota.webContents || !Array.isArray(entradas) || entradas.length > 200) return
  const palabra = v => typeof v === 'string' && /^[a-z-]{1,40}$/.test(v)
  const validas = entradas.filter(e => e && Number.isFinite(e.t) && palabra(e.estado) &&
    (e.variante === null || palabra(e.variante)) && (e.id === null || palabra(e.id)) &&
    Number.isFinite(e.prioridad) && palabra(e.poseInicial) && palabra(e.poseFinal) && palabra(e.motivo))
    .map(({t,estado,variante,id,prioridad,poseInicial,poseFinal,motivo}) => JSON.stringify({t,estado,variante,id,prioridad,poseInicial,poseFinal,motivo}))
  if (!validas.length) return
  try {
    const carpeta = path.join(app.getPath('userData'), 'logs')
    const archivo = path.join(carpeta, 'gatito-registro.jsonl')
    fs.mkdirSync(carpeta, {recursive:true})
    // Pasado 1 MB se rota: queda el anterior y se empieza uno nuevo.
    if ((fs.statSync(archivo, { throwIfNoEntry: false })?.size ?? 0) > 1_000_000) fs.renameSync(archivo, archivo + '.1')
    fs.appendFileSync(archivo, validas.join('\n') + '\n')
  } catch (error) { console.error('No se pudo guardar el registro del gatito:', error.code) }
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
    if (process.env.CENTRO_METRICAS) require('./metricas').iniciar(app)
    require('./fuentes').escribirConfigPlugin(CENTRO, config().get())
    config().alCambiar(nueva => require('./fuentes').escribirConfigPlugin(CENTRO, nueva))
    crearVentana()
    crearBandeja()
    if (config().get().mascota.visible) crearMascota()
    for (const evento of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(evento, () => {
      vecinosCache = null
      if(saltoGlobal){cancelarSalto();enviarEstado();return}
      if (caidaGlobal) {
        clearInterval(caidaGlobal); caidaGlobal=null
        mascota?.webContents.send('gatito-arrastre', {x:monitorMascota().workArea.width/2,aterrizo:true})
      }
      mascota?.setBounds(zonaMascota())
      enviarEstado()
      if (ventana?.isVisible()) {
        if (hayGatito()) mascota.webContents.send('pedir-posicion-reubicar')
        else abrirCentro()
      }
    })
    vigilar()
    globalShortcut.register(ATAJO, alternarCentroDesdeAfuera)
    // Para revisar la interfaz sin mirarla: CENTRO_CAPTURA=ruta.png guarda una captura y cierra.
    if (process.env.CENTRO_CAPTURA) {
      ventana.webContents.once('did-finish-load', () =>
        setTimeout(async () => {
          try {
            const centroCaptura = mascota ? await mascota.webContents.executeJavaScript("centroDelGato()") : null
            abrirCentro(mascota && centroCaptura !== null ? mascota.getBounds().x + centroCaptura : undefined)
            if (process.env.CENTRO_VERIFICAR) await require('../scripts/verificar-interfaz.cjs')({ ventana, mascota })
            await new Promise(listo => setTimeout(listo, 400))
            if (process.env.CENTRO_PROBAR_ALERTA) {
              probarAlerta()
              await new Promise(listo => setTimeout(listo, 600))
            }
            if (process.env.CENTRO_ACCION && mascota) {
              mascota.webContents.send('gatito-accion', process.env.CENTRO_ACCION)
              await mascota.webContents.executeJavaScript('maquina.reiniciar(); accion = null')
              await new Promise(listo => setTimeout(listo, 1200))
            }

            if(process.env.CENTRO_ESCENA==='centro-datos'){
              await ventana.webContents.executeJavaScript("for(const s of document.querySelectorAll('[data-seccion]'))s.hidden=false;ultimo={ahora:Date.now(),sesiones:[{id:'demo',name:'Centro de mando',cwd:'C:/proyectos/centro',status:'working',lastActivityAt:Date.now(),branch:'main',usage:{percent:36},agents:[]}],tickets:{loadedAt:Date.now(),items:[{key:'CMD-42',summary:'Revisar la agenda del equipo',status:'En curso',category:'indeterminate',url:'https://example.com'}]},reuniones:[{id:'demo',title:'Planificación del equipo',start:new Date(Date.now()+120000).toISOString(),end:new Date(Date.now()+1800000).toISOString(),joinUrl:'https://example.com'}]};pintar()")
            }
            if(process.env.CENTRO_ESCENA==='radial'&&mascota){await mascota.webContents.executeJavaScript('abrirMenu()');await new Promise(listo=>setTimeout(listo,100));ventana.showInactive()}
            if(['foco','foco-hover'].includes(process.env.CENTRO_ESCENA)&&mascota){
              await mascota.webContents.executeJavaScript("viaje=null;gatito={...gatito,foco:{fase:'foco',desde:Date.now(),hasta:Date.now()+25*60000,minutos:25}};maquina.vaciar();maquina.despertar();maquina.reiniciar();maquina.pedir('dormir',8,'captura-foco');accion=null")
              await new Promise(listo=>setTimeout(listo,1100))
            }
            // Escenas reproducibles para revisar los intermedios en Windows.
            if (process.env.CENTRO_ESCENA === 'pescado-mitad' && mascota) {
              await mascota.webContents.executeJavaScript("maquina.reiniciar('sentado'); maquina.pedir('pescado',8); accion=null")
              await new Promise(listo=>setTimeout(listo,2100))
            }
            if (mascota && ['borde','hambre','pausa'].includes(process.env.CENTRO_ESCENA)) {
              const escena=process.env.CENTRO_ESCENA
              await mascota.webContents.executeJavaScript(escena==='borde'?"viaje=null; x=destinoBorde('derecha','rascar'); direccion=1; maquina.reiniciar('parado');maquina.pedir('rascar',8);accion=null":escena==='hambre'?"viaje=null;maquina.reiniciar('sentado');maquina.pedir('hambre',8);accion=null":"viaje=null;maquina.reiniciar('parado');maquina.pedir('estirar',8);accion=null;globoPausa('captura-pausa')")
              await new Promise(listo=>setTimeout(listo,700))
            }
            if (process.env.CENTRO_ESCENA === 'acostarse' && mascota) {
              await mascota.webContents.executeJavaScript("maquina.reiniciar('sentado'); maquina.pedir('dormir', 8); accion=null")
              await new Promise(listo => setTimeout(listo, 420))
            }
            if (process.env.CENTRO_ESCENA === 'seccion-oculta') {
              await ventana.webContents.executeJavaScript(" document.querySelector('[data-seccion=tickets]').hidden=false; document.querySelector('[data-seccion=tickets] .seccion-titulo').click()")
              await new Promise(listo => setTimeout(listo, 100))
            }
            if (process.env.CENTRO_ESCENA === 'caida' && mascota) {
              const area=monitorMascota().workArea
              mascota.setBounds({x:area.x,y:area.y-ALTO_MASCOTA+100,width:area.width,height:ALTO_MASCOTA})
              empezarCaida({x:area.x+Math.round(area.width/2),y:area.y+100})
              await new Promise(listo => setTimeout(listo, 350))
            }
            fs.writeFileSync(process.env.CENTRO_CAPTURA, (await ventana.webContents.capturePage()).toPNG())
            if (process.env.CENTRO_CAPTURA_MASCOTA && mascota) {
              fs.writeFileSync(process.env.CENTRO_CAPTURA_MASCOTA, (await mascota.webContents.capturePage()).toPNG())
            }
            app.quit()
          } catch (error) {
            console.error('Falló la captura o verificación:', error)
            app.exit(1)
          }
        }, 1500),
      )
    }
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    vida.guardar()
  })
  app.on('window-all-closed', () => {})
}
