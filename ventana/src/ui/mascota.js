// La mascota: un gatito que pasea por la barra de tareas y reacciona a lo que hace Claude.
//   · Una sesión trabajando  → corre de un lado a otro.
//   · Una sesión terminó     → salta y avisa "¡Listo!".
//   · Una sesión te espera   → se sienta y te lo dice.
//   · Reunión en 5 min       → te avisa; tocarlo te une a la reunión.
//   · Sin actividad          → pasea tranquilo y a veces se duerme (más si no hay nada abierto).
// Tocarlo lo hace maullar; se puede arrastrar.
const api = window.centro
const { CUADROS, COLORES } = window.GATO_LADO

const $ = id => document.getElementById(id)
const ESCALA = 4
const MARGEN = 90 // para que el globo no se salga de la pantalla
const AVISO_REUNION_MS = 5 * 60_000
const RECIENTE_MS = 10 * 60_000
const DORMILON_MS = 30 * 60_000

// --- dibujo ---------------------------------------------------------------

const svgs = {}
for (const [nombre, cuadro] of Object.entries(CUADROS)) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', cuadro[0].length * ESCALA)
  svg.setAttribute('height', cuadro.length * ESCALA)
  svg.setAttribute('viewBox', `0 0 ${cuadro[0].length} ${cuadro.length}`)
  cuadro.forEach((fila, y) =>
    [...fila].forEach((letra, x) => {
      if (!COLORES[letra]) return
      const pixel = document.createElementNS(ns, 'rect')
      pixel.setAttribute('x', x)
      pixel.setAttribute('y', y)
      pixel.setAttribute('width', 1)
      pixel.setAttribute('height', 1)
      pixel.setAttribute('fill', COLORES[letra])
      svg.append(pixel)
    }),
  )
  svg.style.display = 'none'
  $('gato').append(svg)
  svgs[nombre] = svg
}
const ANCHO_GATO = CUADROS.sentado[0].length * ESCALA

let cuadroActual = null
function mostrarCuadro(nombre) {
  if (nombre === cuadroActual) return
  if (cuadroActual) svgs[cuadroActual].style.display = 'none'
  svgs[nombre].style.display = 'block'
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
let accion = null // { tipo: 'caminar' | 'sentado' | 'dormir' | 'saltar', hasta, objetivo, velocidad }
let arrastre = null
let ultimoCuadro = 0
let pasoAlterno = false

const azar = (min, max) => min + Math.random() * (max - min)
const limite = valor => Math.max(MARGEN, Math.min(ancho - MARGEN - ANCHO_GATO, valor))

function elegirAccion(ahora) {
  if (modo === 'trabajando') return { tipo: 'caminar', objetivo: azar(MARGEN, ancho - MARGEN), velocidad: 150 }
  if (modo === 'esperando' || modo === 'reunion') return { tipo: 'sentado', hasta: ahora + 4000 }
  const ganasDeDormir = modo === 'dormilon' ? 0.55 : 0.12
  const dado = Math.random()
  if (dado < ganasDeDormir) return { tipo: 'dormir', hasta: ahora + azar(15000, 40000) }
  if (dado < ganasDeDormir + 0.35) return { tipo: 'sentado', hasta: ahora + azar(3000, 9000) }
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
    mostrarCuadro('sentado')
  } else {
    if (!accion || (accion.hasta && ahora > accion.hasta)) accion = elegirAccion(ahora)

    if (accion.tipo === 'caminar') {
      const destino = limite(accion.objetivo)
      direccion = destino > x ? 1 : -1
      x += direccion * accion.velocidad * dt
      if ((direccion > 0 && x >= destino) || (direccion < 0 && x <= destino)) {
        x = destino
        accion = null
      }
      const ritmo = accion && accion.velocidad > 100 ? 90 : 160
      if (ahora - ultimoCuadro > ritmo) {
        pasoAlterno = !pasoAlterno
        ultimoCuadro = ahora
      }
      mostrarCuadro(pasoAlterno ? 'caminar1' : 'caminar2')
    } else if (accion.tipo === 'dormir') {
      mostrarCuadro('dormido')
    } else if (accion.tipo === 'saltar') {
      mostrarCuadro('caminar1')
    } else {
      mostrarCuadro('sentado')
    }
  }

  x = limite(x)
  $('zzz').hidden = !(accion && accion.tipo === 'dormir') || Boolean(arrastre)
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
  accion = { tipo: 'sentado', hasta: performance.now() + 3000 }
  if (fueClic) {
    maullar()
    if (modo === 'reunion' && reunion) api.unirse(reunion.joinUrl)
    else globo(['¡Miau!', 'Mrrp?', 'Prrr…', '¡Miau miau!'][Math.floor(Math.random() * 4)], { ms: 1800 })
  }
  hacerTocable(encima(evento))
})

api.alRecibirAlerta(() => {
  accion = { tipo: 'sentado', hasta: performance.now() + 5000 }
})

api.pedirEstado()
