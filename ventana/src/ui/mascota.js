// La mascota: un gatito que pasea por la barra de tareas y reacciona a lo que hace Claude.
//   · Una sesión trabajando  → corre, o se sienta con la tablet.
//   · Una sesión terminó     → salta con un ✓ y avisa "¡Listo!".
//   · Una sesión te espera   → se sienta con un "!" y te lo dice.
//   · Reunión en 5 min       → te avisa; tocarlo te une a la reunión.
//   · Sin actividad          → pasea tranquilo; a veces le da sueño, duerme y al despertar se estira.
// Tocarlo lo hace maullar (pone cara de contento); se puede arrastrar (pone cara de duda).
// Los dibujos están en sprites/, todos del mismo tamaño y mirando a la derecha.
const api = window.centro

const $ = id => document.getElementById(id)
const ALTO_GATO = 84
const ANCHO_GATO = Math.round((ALTO_GATO * 234) / 237)
const MARGEN = 90 // para que el globo no se salga de la pantalla
const AVISO_REUNION_MS = 5 * 60_000
const RECIENTE_MS = 10 * 60_000
const DORMILON_MS = 30 * 60_000

// --- dibujo ---------------------------------------------------------------

const DIBUJOS = [
  'sentado', 'contento', 'atento', 'cola', 'caminar1', 'caminar2', 'caminar3', 'caminar4',
  'alerta', 'tablet', 'listo', 'duda', 'sueno', 'durmiendo', 'bolita', 'estirarse',
]
const PASOS = ['caminar1', 'caminar2', 'caminar3', 'caminar4']

const imagenes = {}
for (const nombre of DIBUJOS) {
  const img = document.createElement('img')
  img.src = `sprites/${nombre}.png`
  img.alt = ''
  img.draggable = false
  img.height = ALTO_GATO
  img.style.display = 'none'
  $('gato').append(img)
  imagenes[nombre] = img
}

let cuadroActual = null
function mostrarCuadro(nombre) {
  if (nombre === cuadroActual) return
  if (cuadroActual) imagenes[cuadroActual].style.display = 'none'
  imagenes[nombre].style.display = 'block'
  cuadroActual = nombre
}

// --- globo de diálogo -------------------------------------------------------

let globoHasta = 0
let globoFijo = false
function globo(texto, { ms = 4000, boton = null, fijo = false } = {}) {
  $('burbuja-texto').textContent = texto
  $('burbuja-boton').hidden = !boton
  if (boton) {
    $('burbuja-boton').textContent = boton.texto
    $('burbuja-boton').onclick = boton.accion
  }
  $('burbuja').hidden = false
  globoFijo = fijo
  globoHasta = fijo ? Infinity : performance.now() + ms
}

function cerrarGlobo() {
  $('burbuja').hidden = true
  globoFijo = false
}

// --- maullido (sonido sintetizado, solo al tocarlo) --------------------------

let audio = null
function maullar() {
  try {
    audio = audio || new AudioContext()
    const ahora = audio.currentTime
    const oscilador = audio.createOscillator()
    const volumen = audio.createGain()
    oscilador.type = 'triangle'
    oscilador.frequency.setValueAtTime(620, ahora)
    oscilador.frequency.linearRampToValueAtTime(980, ahora + 0.12)
    oscilador.frequency.linearRampToValueAtTime(560, ahora + 0.38)
    volumen.gain.setValueAtTime(0.0001, ahora)
    volumen.gain.exponentialRampToValueAtTime(0.12, ahora + 0.04)
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.42)
    oscilador.connect(volumen).connect(audio.destination)
    oscilador.start(ahora)
    oscilador.stop(ahora + 0.45)
  } catch {
    // sin audio: solo el globo
  }
}

// --- estado de Claude y del calendario ---------------------------------------

let modo = 'tranqui' // tranqui | dormilon | trabajando | esperando | reunion
let reunion = null
let esperando = null
const estadosPrevios = new Map()

const nombreSesion = s =>
  /[\\/]scratch-workspaces[\\/]|^[a-z]:[\\/]windows([\\/]|$)/i.test(s.cwd || '') ? 'Una conversación' : s.name
const ultimaActividad = s => s.lastActivityAt || s.startedAt || 0

api.alRecibirEstado(({ ahora, sesiones, reuniones }) => {
  const vivas = sesiones.filter(s => !s.sinSenal)

  // ¿Alguna terminó desde la última vez? (se festeja al final, después de elegir el modo)
  const terminadas = []
  for (const s of vivas) {
    if (estadosPrevios.get(s.id) === 'working' && s.status === 'waiting') terminadas.push(nombreSesion(s))
    estadosPrevios.set(s.id, s.status)
  }

  reunion =
    reuniones.find(r => r.joinUrl && Date.parse(r.start) - AVISO_REUNION_MS <= ahora && ahora < Date.parse(r.start) + AVISO_REUNION_MS) ||
    null
  esperando = vivas.find(s => s.status === 'waiting' && ahora - ultimaActividad(s) < RECIENTE_MS) || null

  const anterior = modo
  if (reunion) modo = 'reunion'
  else if (vivas.some(s => s.status === 'working')) modo = 'trabajando'
  else if (esperando) modo = 'esperando'
  else if (!vivas.some(s => ahora - ultimaActividad(s) < DORMILON_MS)) modo = 'dormilon'
  else modo = 'tranqui'

  if (modo === 'reunion') {
    const inicio = Date.parse(reunion.start)
    const minutos = Math.round((inicio - ahora) / 60_000)
    const cuando = minutos > 0 ? `en ${minutos} min` : 'ya empezó'
    globo(`📅 ${reunion.title} ${cuando}`, { fijo: true, boton: { texto: 'Unirse', accion: () => api.unirse(reunion.joinUrl) } })
  } else if (anterior === 'reunion') {
    cerrarGlobo()
  }
  if (modo !== anterior) accion = null // re-elegir qué hacer
  if (terminadas.length && modo !== 'reunion') celebrar(terminadas[0])
  else if (modo === 'esperando' && anterior !== 'esperando') globo(`¡${nombreSesion(esperando)} te espera!`, { ms: 6000 })
})

// --- movimiento ---------------------------------------------------------------

let ancho = innerWidth
let x = innerWidth - MARGEN - ANCHO_GATO - 160
let direccion = -1
// accion: { tipo: 'caminar' | 'sentado' | 'dormir' | 'saltar', hasta, objetivo, velocidad, dibujo, desde }
let accion = null
let arrastre = null
let ultimoCuadro = 0
let paso = 0

const azar = (min, max) => min + Math.random() * (max - min)
const alguno = lista => lista[Math.floor(Math.random() * lista.length)]
const limite = valor => Math.max(MARGEN, Math.min(ancho - MARGEN - ANCHO_GATO, valor))

function elegirAccion(ahora, anterior) {
  // Al despertar, se estira.
  if (anterior && anterior.tipo === 'dormir' && modo !== 'reunion') {
    return { tipo: 'sentado', dibujo: 'estirarse', hasta: ahora + 1800 }
  }
  if (modo === 'trabajando') {
    return Math.random() < 0.55
      ? { tipo: 'caminar', objetivo: azar(MARGEN, ancho - MARGEN), velocidad: 150 }
      : { tipo: 'sentado', dibujo: 'tablet', hasta: ahora + azar(4000, 8000) }
  }
  if (modo === 'esperando' || modo === 'reunion') return { tipo: 'sentado', dibujo: 'alerta', hasta: ahora + 4000 }
  const ganasDeDormir = modo === 'dormilon' ? 0.55 : 0.12
  const dado = Math.random()
  if (dado < ganasDeDormir) {
    return { tipo: 'dormir', desde: ahora, hasta: ahora + azar(15000, 40000), dibujo: alguno(['durmiendo', 'bolita']) }
  }
  if (dado < ganasDeDormir + 0.35) {
    return { tipo: 'sentado', dibujo: alguno(['sentado', 'sentado', 'atento', 'cola', 'contento']), hasta: ahora + azar(3000, 9000) }
  }
  return { tipo: 'caminar', objetivo: azar(MARGEN, ancho - MARGEN), velocidad: 55 }
}

function celebrar(nombre) {
  accion = { tipo: 'saltar', hasta: performance.now() + 1300 }
  $('gato').classList.remove('saltando')
  void $('gato').offsetWidth // reinicia la animación
  $('gato').classList.add('saltando')
  globo(`¡Listo! ${nombre} terminó`, { ms: 5000 })
}

let antes = performance.now()
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - antes) / 1000)
  antes = ahora

  if (!globoFijo && !$('burbuja').hidden && ahora > globoHasta) cerrarGlobo()

  if (arrastre) {
    mostrarCuadro('duda')
  } else {
    if (!accion || (accion.hasta && ahora > accion.hasta)) accion = elegirAccion(ahora, accion)

    if (accion.tipo === 'caminar') {
      const destino = limite(accion.objetivo)
      const rapido = accion.velocidad > 100
      direccion = destino > x ? 1 : -1
      x += direccion * accion.velocidad * dt
      if ((direccion > 0 && x >= destino) || (direccion < 0 && x <= destino)) {
        x = destino
        accion = null
      }
      if (ahora - ultimoCuadro > (rapido ? 90 : 150)) {
        paso = (paso + 1) % PASOS.length
        ultimoCuadro = ahora
      }
      mostrarCuadro(PASOS[paso])
    } else if (accion.tipo === 'dormir') {
      // Primero le da sueño; después se duerme del todo.
      mostrarCuadro(ahora - accion.desde < 3000 ? 'sueno' : accion.dibujo)
    } else if (accion.tipo === 'saltar') {
      mostrarCuadro('listo')
    } else {
      mostrarCuadro(accion.dibujo || 'sentado')
    }
  }

  x = limite(x)
  // La bolita no trae zZz dibujadas: se las agregamos.
  $('zzz').hidden = arrastre || cuadroActual !== 'bolita'
  $('gato').classList.toggle('izquierda', direccion < 0)
  $('mascota').style.transform = `translateX(${Math.round(x)}px)`
  requestAnimationFrame(cuadro)
}
requestAnimationFrame(cuadro)

addEventListener('resize', () => {
  ancho = innerWidth
})

// --- tocar y arrastrar ----------------------------------------------------------
// La franja deja pasar los clics; solo se vuelve "tocable" cuando el mouse está sobre el gatito o su globo.

let tocable = false
function hacerTocable(si) {
  if (si === tocable) return
  tocable = si
  api.mascotaInteractiva(si)
}

function encima(evento) {
  for (const id of ['gato', 'burbuja']) {
    const caja = $(id)
    if (caja.hidden) continue
    const r = caja.getBoundingClientRect()
    if (evento.clientX >= r.left && evento.clientX <= r.right && evento.clientY >= r.top && evento.clientY <= r.bottom) return true
  }
  return false
}

addEventListener('mousemove', evento => {
  if (arrastre) {
    x = limite(evento.clientX - arrastre.desfase)
    if (Math.abs(evento.clientX - arrastre.desdeX) > 4) arrastre.movido = true
    return
  }
  hacerTocable(encima(evento))
})

$('gato').addEventListener('mousedown', evento => {
  arrastre = { desfase: evento.clientX - x, desdeX: evento.clientX, movido: false }
  $('gato').classList.add('arrastrando')
})

addEventListener('mouseup', evento => {
  if (!arrastre) return
  const fueClic = !arrastre.movido
  arrastre = null
  $('gato').classList.remove('arrastrando')
  accion = { tipo: 'sentado', dibujo: fueClic ? 'contento' : 'sentado', hasta: performance.now() + 2500 }
  if (fueClic) {
    maullar()
    if (modo === 'reunion' && reunion) api.unirse(reunion.joinUrl)
    else globo(['¡Miau!', 'Mrrp?', 'Prrr…', '¡Miau miau!'][Math.floor(Math.random() * 4)], { ms: 1800 })
  }
  hacerTocable(encima(evento))
})

api.alRecibirAlerta(() => {
  accion = { tipo: 'sentado', dibujo: 'alerta', hasta: performance.now() + 5000 }
})

api.pedirEstado()
