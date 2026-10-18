// La mascota: un gatito que pasea por la barra de tareas, abre el centro de mando y da todas las alertas.
//   · Tocarlo                → abre (o cierra) el centro de mando a su lado.
//   · Una sesión trabajando  → corre, o se sienta con la tablet.
//   · Una sesión terminó     → salta con un ✓ y avisa en un globo (queda hasta que la atiendas o la cierres).
//   · Reunión en 5 min       → globo con "Unirse".
//   · Otros avisos           → globos que se van solos.
//   · Sin actividad          → pasea tranquilo; a veces le da sueño, duerme y al despertar se estira.
// Cada globo se cierra con su ✕. Se lo puede arrastrar (pone cara de duda).
// Los dibujos están en sprites/, todos del mismo tamaño y mirando a la derecha.
const api = window.centro

const $ = id => document.getElementById(id)
const ALTO_GATO = 84
const ANCHO_GATO = Math.round((ALTO_GATO * 234) / 237)
const MARGEN = 150 // para que los globos no se salgan de la pantalla
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

// --- globos de alerta ----------------------------------------------------------
// Cada alerta tiene un id. "fija" = queda hasta que se cierra o deja de aplicar; si no, se va sola.
// Cerrar una alerta la recuerda (no vuelve a aparecer con el mismo id).

const alertas = new Map() // id → { icono, texto, negrita, boton, fija, hasta, tono, nodo }
const descartadas = new Set()
const MAX_GLOBOS = 4

function mostrarAlerta(id, { icono = '', negrita = '', texto = '', boton = null, fija = false, ms = 6000, tono = '' }) {
  if (descartadas.has(id)) return
  const existente = alertas.get(id)
  const alerta = { icono, negrita, texto, boton, fija, tono, hasta: fija ? Infinity : performance.now() + ms, nodo: existente && existente.nodo }
  alertas.set(id, alerta)
  dibujarAlerta(id, alerta)
}

function cerrarAlerta(id, { recordar = false } = {}) {
  const alerta = alertas.get(id)
  if (recordar) descartadas.add(id)
  if (!alerta) return
  alertas.delete(id)
  if (alerta.nodo) {
    alerta.nodo.classList.add('saliendo')
    setTimeout(() => alerta.nodo.remove(), 180)
  }
}

function dibujarAlerta(id, alerta) {
  const nodo = alerta.nodo || document.createElement('div')
  nodo.className = `globo ${alerta.tono}`
  nodo.replaceChildren()
  if (alerta.icono) nodo.append(Object.assign(document.createElement('span'), { className: 'globo-icono', textContent: alerta.icono }))
  const texto = document.createElement('span')
  texto.className = 'globo-texto'
  if (alerta.negrita) texto.append(Object.assign(document.createElement('b'), { textContent: alerta.negrita }), ' ')
  texto.append(alerta.texto)
  nodo.append(texto)
  if (alerta.boton) {
    const boton = Object.assign(document.createElement('button'), { className: 'globo-boton', textContent: alerta.boton.texto })
    boton.onclick = () => {
      alerta.boton.accion()
      cerrarAlerta(id, { recordar: true })
    }
    nodo.append(boton)
  }
  const cerrar = Object.assign(document.createElement('button'), { className: 'globo-cerrar', textContent: '✕', title: 'Cerrar' })
  cerrar.onclick = () => cerrarAlerta(id, { recordar: true })
  nodo.append(cerrar)
  if (!alerta.nodo) {
    $('alertas').append(nodo)
    alerta.nodo = nodo
  }
  // Si hay demasiados, se van los más viejos que no son fijos.
  const sobrantes = [...alertas.entries()].filter(([, a]) => !a.fija)
  while (alertas.size > MAX_GLOBOS && sobrantes.length) cerrarAlerta(sobrantes.shift()[0])
}

const hayAlertaFija = () => [...alertas.values()].some(a => a.fija)

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
    volumen.gain.exponentialRampToValueAtTime(0.1, ahora + 0.04)
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.42)
    oscilador.connect(volumen).connect(audio.destination)
    oscilador.start(ahora)
    oscilador.stop(ahora + 0.45)
  } catch {
    // sin audio
  }
}

// --- estado de Claude y del calendario ---------------------------------------

let modo = 'tranqui' // tranqui | dormilon | trabajando | esperando | reunion
let centroAbierto = false
const estadosPrevios = new Map()

const nombreSesion = s =>
  /[\\/]scratch-workspaces[\\/]|^[a-z]:[\\/]windows([\\/]|$)/i.test(s.cwd || '') ? 'Una conversación' : s.name
const ultimaActividad = s => s.lastActivityAt || s.startedAt || 0

function cuandoReunion(reunion, ahora) {
  const minutos = Math.round((Date.parse(reunion.start) - ahora) / 60_000)
  return minutos > 0 ? `en ${minutos} min` : 'ya empezó'
}

api.alRecibirEstado(({ ahora, sesiones, reuniones }) => {
  const vivas = sesiones.filter(s => !s.sinSenal)

  // Sesiones que terminaron desde la última vez (se festejan).
  const terminadas = new Set()
  for (const s of vivas) {
    if (estadosPrevios.get(s.id) === 'working' && s.status === 'waiting') terminadas.add(s.id)
    estadosPrevios.set(s.id, s.status)
  }

  // Alertas de sesiones que te esperan: una por sesión y por "turno" (última actividad).
  const esperando = vivas.filter(s => s.status === 'waiting' && ahora - ultimaActividad(s) < RECIENTE_MS)
  const vigentes = new Set()
  for (const s of esperando) {
    const id = `ses:${s.id}:${ultimaActividad(s)}`
    vigentes.add(id)
    const recien = terminadas.has(s.id)
    if (!alertas.has(id) || recien) {
      mostrarAlerta(id, {
        icono: recien ? '✓' : '💬',
        negrita: nombreSesion(s),
        texto: recien ? 'terminó y te espera' : 'te espera',
        tono: recien ? 'listo' : '',
        fija: true,
      })
    }
  }
  for (const id of alertas.keys()) if (id.startsWith('ses:') && !vigentes.has(id)) cerrarAlerta(id)
  if (terminadas.size) celebrar()

  // Alertas de reuniones: desde 5 min antes hasta 5 min después de empezar.
  const proximas = reuniones.filter(
    r => r.joinUrl && Date.parse(r.start) - AVISO_REUNION_MS <= ahora && ahora < Date.parse(r.start) + AVISO_REUNION_MS,
  )
  const reunionesVigentes = new Set()
  for (const r of proximas) {
    const id = `reu:${r.id}`
    reunionesVigentes.add(id)
    mostrarAlerta(id, {
      icono: '📅',
      negrita: r.title,
      texto: cuandoReunion(r, ahora),
      boton: { texto: 'Unirse', accion: () => api.unirse(r.joinUrl) },
      tono: 'importante',
      fija: true,
    })
  }
  for (const id of alertas.keys()) if (id.startsWith('reu:') && !reunionesVigentes.has(id)) cerrarAlerta(id)

  const anterior = modo
  if (proximas.length) modo = 'reunion'
  else if (vivas.some(s => s.status === 'working')) modo = 'trabajando'
  else if (esperando.length) modo = 'esperando'
  else if (!vivas.some(s => ahora - ultimaActividad(s) < DORMILON_MS)) modo = 'dormilon'
  else modo = 'tranqui'
  if (modo !== anterior && !(accion && accion.tipo === 'saltar')) accion = null // re-elegir qué hacer
})

// El centro avisa a qué hora empieza una reunión: si la habías cerrado, vuelve a aparecer.
api.alRecibirAlerta(idReunion => {
  descartadas.delete(`reu:${idReunion}`)
  accion = { tipo: 'sentado', dibujo: 'alerta', hasta: performance.now() + 5000 }
})

// Otros avisos de la app (por ejemplo, "copié el pedido para Claude").
let numeroDeAviso = 0
api.alRecibirDecir(({ texto, ms }) => {
  mostrarAlerta(`decir:${numeroDeAviso++}`, { icono: '🐾', texto: String(texto), ms: Number(ms) || 6000 })
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
  // Con el centro abierto se queda sentado al lado, atento.
  if (centroAbierto) return { tipo: 'sentado', dibujo: hayAlertaFija() ? 'alerta' : 'atento', hasta: ahora + 2000 }
  // Al despertar, se estira.
  if (anterior && anterior.tipo === 'dormir' && modo !== 'reunion') {
    return { tipo: 'sentado', dibujo: 'estirarse', hasta: ahora + 1800 }
  }
  if (modo === 'trabajando') {
    return Math.random() < 0.55
      ? { tipo: 'caminar', objetivo: azar(MARGEN, ancho - MARGEN), velocidad: 150 }
      : { tipo: 'sentado', dibujo: 'tablet', hasta: ahora + azar(4000, 8000) }
  }
  if (modo === 'reunion' || hayAlertaFija()) return { tipo: 'sentado', dibujo: 'alerta', hasta: ahora + 4000 }
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

function celebrar() {
  accion = { tipo: 'saltar', hasta: performance.now() + 1300 }
  $('gato').classList.remove('saltando')
  void $('gato').offsetWidth // reinicia la animación
  $('gato').classList.add('saltando')
}

let antes = performance.now()
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - antes) / 1000)
  antes = ahora

  for (const [id, alerta] of alertas) if (ahora > alerta.hasta) cerrarAlerta(id)

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
  $('zzz').hidden = Boolean(arrastre) || cuadroActual !== 'bolita'
  $('gato').classList.toggle('izquierda', direccion < 0)
  $('mascota').style.transform = `translateX(${Math.round(x)}px)`
  requestAnimationFrame(cuadro)
}
requestAnimationFrame(cuadro)

addEventListener('resize', () => {
  ancho = innerWidth
})

// --- centro de mando ------------------------------------------------------------

const centroDelGato = () => Math.round(x + ANCHO_GATO / 2)

api.alRecibirCentroVisible(visible => {
  centroAbierto = visible
  accion = null
})

// La bandeja o el atajo preguntan dónde está el gatito para abrir el centro a su lado.
api.alRecibirPedidoPosicion(() => api.alternarCentro(centroDelGato()))

// --- tocar y arrastrar ----------------------------------------------------------
// La franja deja pasar los clics; solo se vuelve "tocable" cuando el mouse está sobre el gatito o un globo.

let tocable = false
function hacerTocable(si) {
  if (si === tocable) return
  tocable = si
  api.mascotaInteractiva(si)
}

function encima(evento) {
  const cajas = [$('gato'), ...$('alertas').children]
  return cajas.some(caja => {
    const r = caja.getBoundingClientRect()
    return evento.clientX >= r.left && evento.clientX <= r.right && evento.clientY >= r.top && evento.clientY <= r.bottom
  })
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
  if (fueClic) {
    // Tocarlo abre (o cierra) el centro de mando a su lado.
    maullar()
    accion = { tipo: 'sentado', dibujo: 'contento', hasta: performance.now() + 1200 }
    api.alternarCentro(centroDelGato())
  } else {
    accion = { tipo: 'sentado', dibujo: 'sentado', hasta: performance.now() + 2500 }
  }
  hacerTocable(encima(evento))
})

api.pedirEstado()
