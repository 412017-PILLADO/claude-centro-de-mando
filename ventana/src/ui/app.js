// Interfaz de la ventana. Los datos (tickets, carpetas) entran siempre con textContent, nunca como HTML.
const api = window.centro

const $ = id => document.getElementById(id)

function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag)
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === undefined || valor === null || valor === false) continue
    if (clave === 'class') nodo.className = valor
    else if (clave === 'text') nodo.textContent = valor
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor)
    else if (clave === 'style') nodo.style.cssText = valor
    else nodo.setAttribute(clave, valor)
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)))
  }
  return nodo
}

// Íconos fijos (texto propio, no datos): se arman una vez desde estas rutas SVG.
const ICONOS = {
  claude: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
}

function icono(nombre) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  trazo.setAttribute('d', ICONOS[nombre])
  svg.append(trazo)
  return svg
}

function leer(clave) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // sin almacenamiento: se usan los valores por defecto
  }
}

function hace(ms) {
  const minutos = Math.round(ms / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

const miles = n => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const esSuelta = cwd => /[\\/]scratch-workspaces[\\/]|^[a-z]:[\\/]windows([\\/]|$)/i.test(cwd ?? '')
const nombreSesion = s => (esSuelta(s.cwd) ? 'Conversación suelta' : s.name)

// --- tickets ---------------------------------------------------------------

const CATEGORIAS = {
  'por-hacer': { nombre: 'Por hacer', color: 'var(--por-hacer)' },
  'en-curso': { nombre: 'En curso', color: 'var(--en-curso)' },
  hecho: { nombre: 'Hecho', color: 'var(--hecho)' },
}

// statusCategory de Jira; si falta (datos viejos), se deduce del nombre del estado.
function categoria(ticket) {
  if (ticket.category === 'new') return 'por-hacer'
  if (ticket.category === 'indeterminate') return 'en-curso'
  if (ticket.category === 'done') return 'hecho'
  return /curso|progress|prueba|review|revis|test/i.test(ticket.status ?? '') ? 'en-curso' : 'por-hacer'
}

function prioridad(ticket) {
  const nombre = String(ticket.priority ?? '').toLowerCase()
  if (/highest|high|alta|crític|critic|urgent/.test(nombre)) return el('span', { class: 'prioridad alta', title: ticket.priority, text: '↑' })
  if (/lowest|low|baja/.test(nombre)) return el('span', { class: 'prioridad baja', title: ticket.priority, text: '↓' })
  return null
}

let filtro = leer('filtro') ?? 'todos'

function pintarFiltros(tickets) {
  const cuentas = { todos: tickets.length }
  for (const t of tickets) cuentas[categoria(t)] = (cuentas[categoria(t)] ?? 0) + 1
  if (filtro !== 'todos' && !cuentas[filtro]) filtro = 'todos'

  const opciones = [['todos', 'Todos'], ...Object.entries(CATEGORIAS).map(([clave, c]) => [clave, c.nombre])]
  $('filtros').replaceChildren(
    ...opciones
      .filter(([clave]) => cuentas[clave])
      .map(([clave, nombre]) =>
        el('button', {
          class: `filtro ${filtro === clave ? 'activo' : ''}`,
          text: `${nombre} ${cuentas[clave]}`,
          onclick: () => {
            filtro = clave
            guardar('filtro', clave)
            pintar()
          },
        }),
      ),
  )
}

function tarjetaTicket(ticket) {
  const cat = categoria(ticket)
  return el(
    'div',
    {
      class: 'ticket',
      role: 'button',
      title: `Abrir ${ticket.key} en Jira`,
      style: `--color-estado:${CATEGORIAS[cat].color}`,
      onclick: () => api.abrirUrl(ticket.url),
    },
    el(
      'div',
      { class: 'ticket-cuerpo' },
      el(
        'div',
        { class: 'ticket-cabeza' },
        el('span', { class: 'clave', text: ticket.key }),
        prioridad(ticket),
        el('span', { class: 'estado', text: ticket.status }),
      ),
      el('div', { class: 'resumen-ticket', text: ticket.summary }),
    ),
    el(
      'button',
      {
        class: 'ticket-claude',
        title: 'Trabajarlo con Claude Desktop (copia el pedido)',
        onclick: evento => {
          evento.stopPropagation()
          api.trabajarTicket({ key: ticket.key, summary: ticket.summary })
        },
      },
      icono('claude'),
    ),
  )
}

function pintarTickets(tickets, ahora) {
  const caja = $('tickets')
  const items = tickets?.items ?? []
  $('cuenta-tickets').textContent = tickets ? String(items.length) : ''
  pintarFiltros(items)
  caja.replaceChildren()
  if (!tickets) {
    caja.append(el('div', { class: 'vacio', text: 'Se cargan cuando abrís una sesión de Claude (usa tu conexión a Jira).' }))
    return
  }
  if (items.length === 0) {
    caja.append(el('div', { class: 'vacio', text: 'No tenés tickets abiertos asignados. 🎉' }))
  }
  for (const ticket of items.filter(t => filtro === 'todos' || categoria(t) === filtro)) caja.append(tarjetaTicket(ticket))
  caja.append(el('div', { class: 'pie', text: `Actualizado ${hace(ahora - tickets.loadedAt)} · se renueva cada 10 min` }))
}

// --- sesiones --------------------------------------------------------------

// Una sesión que terminó hace rato no "te espera": quedó abierta.
const INACTIVA_MS = 10 * 60_000

function estadoSesion(sesion, ahora) {
  if (sesion.sinSenal) return { clase: '', texto: 'sin señal' }
  if (sesion.status === 'working') return { clase: 'working', texto: 'trabajando' }
  const ultima = sesion.lastActivityAt || sesion.startedAt || 0
  if (ultima && ahora - ultima > INACTIVA_MS) return { clase: '', texto: `inactiva · ${hace(ahora - ultima)}` }
  return { clase: 'waiting', texto: 'te espera' }
}

function filaSesion(sesion, ahora) {
  const uso = sesion.usage
  const porcentaje = uso?.percent ?? null
  const nivel = porcentaje === null ? '' : porcentaje >= 85 ? 'alto' : porcentaje >= 60 ? 'medio' : ''
  const corriendo = (sesion.agents ?? []).filter(a => a.endedAt === null)
  const estado = estadoSesion(sesion, ahora)

  return el(
    'div',
    { class: 'sesion' },
    el(
      'div',
      { class: 'fila' },
      el('span', { class: `punto ${estado.clase}`, title: estado.texto }),
      el(
        'span',
        { class: 'crece', title: sesion.cwd },
        el('span', { class: 'nombre', text: nombreSesion(sesion) }),
        sesion.branch ? el('span', { class: 'tenue', text: `  ⎇ ${sesion.branch}` }) : null,
        sesion.changed > 0 ? el('span', { class: 'aviso', text: `  ✎${sesion.changed}` }) : null,
      ),
      el('span', { class: 'tenue', text: estado.texto }),
      el(
        'button',
        {
          class: 'quitar',
          title: 'Quitar de la lista (vuelve sola si la usás de nuevo)',
          onclick: () => api.ocultarSesion(sesion.id),
        },
        '✕',
      ),
    ),
    porcentaje === null
      ? null
      : el(
          'div',
          { class: 'contexto' },
          el('span', { text: `${Math.round(porcentaje)}%` }),
          el('div', { class: `mini-barra ${nivel}` }, el('div', { style: `width:${Math.min(100, porcentaje)}%` })),
        ),
    corriendo.map(a =>
      el('div', { class: 'agente crece' }, el('b', { text: `● ${a.type}` }), ` ${a.description} · ${Math.round((ahora - a.startedAt) / 1000)}s`),
    ),
  )
}

function pintarSesiones(sesiones, ahora) {
  $('cuenta-sesiones').textContent = String(sesiones.length)
  const caja = $('sesiones')
  caja.replaceChildren()
  if (sesiones.length === 0) caja.append(el('div', { class: 'vacio', text: 'No hay sesiones de Claude abiertas.' }))
  for (const sesion of sesiones) caja.append(filaSesion(sesion, ahora))
}

// --- reuniones -------------------------------------------------------------

const AVISO_ANTES_MS = 5 * 60_000

const hora = iso => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

function etiquetaDia(iso, ahora) {
  const dia = new Date(iso)
  const hoy = new Date(ahora)
  const manana = new Date(ahora + 86_400_000)
  if (dia.toDateString() === hoy.toDateString()) return 'Hoy'
  if (dia.toDateString() === manana.toDateString()) return 'Mañana'
  return dia.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })
}

function cuando(reunion, ahora) {
  const inicio = Date.parse(reunion.start)
  if (inicio <= ahora) return `en curso · termina ${hora(reunion.end)}`
  const minutos = Math.round((inicio - ahora) / 60_000)
  if (minutos < 1) return 'empieza ahora'
  if (minutos < 60) return `en ${minutos} min`
  return `a las ${hora(reunion.start)}`
}

const esInminente = (r, ahora) => Date.parse(r.start) - AVISO_ANTES_MS <= ahora && Date.parse(r.end) > ahora

function pintarReuniones(reuniones, ahora) {
  $('cuenta-reuniones').textContent = String(reuniones.length)
  const caja = $('reuniones')
  caja.replaceChildren()
  if (reuniones.length === 0) {
    caja.append(el('div', { class: 'vacio', text: 'Sin reuniones en los próximos días.' }))
    return
  }
  let diaAnterior = null
  for (const r of reuniones.slice(0, 6)) {
    const dia = etiquetaDia(r.start, ahora)
    if (dia !== diaAnterior) caja.append(el('div', { class: 'dia', text: dia }))
    diaAnterior = dia
    caja.append(
      el(
        'div',
        { class: `reunion ${esInminente(r, ahora) ? 'ahora' : ''}` },
        el('span', { class: 'hora', text: `${hora(r.start)}–${hora(r.end)}` }),
        el('span', { class: 'crece', title: r.title, text: r.title }),
        r.joinUrl ? el('button', { class: 'unirse chico', text: 'Unirse', onclick: () => api.unirse(r.joinUrl) }) : null,
      ),
    )
  }
}

// Las alertas de reuniones las da el gatito; acá solo se lista la agenda.
$('btn-probar').addEventListener('click', evento => {
  evento.stopPropagation()
  api.probarAlerta()
})

// --- secciones plegables y alto de la ventana -----------------------------

for (const seccion of document.querySelectorAll('.seccion')) {
  const nombre = seccion.dataset.seccion
  seccion.classList.toggle('cerrada', leer(`seccion-${nombre}`) === '1')
  seccion.querySelector('.seccion-titulo').addEventListener('click', () => {
    const ahoraCerrada = seccion.classList.toggle('cerrada')
    guardar(`seccion-${nombre}`, ahoraCerrada ? '1' : '0')
  })
}

// Se cierra tocando al gatito o con Esc.
addEventListener('keydown', evento => {
  if (evento.key === 'Escape') api.ocultar()
})

// Alto que ocuparía todo el contenido sin scroll: lo que se ve más lo que quedó oculto en el panel.
function altoCompleto() {
  const panel = $('panel')
  return $('app').offsetHeight + panel.scrollHeight - panel.clientHeight
}

const medir = new ResizeObserver(() => api.alto(altoCompleto()))
medir.observe($('app'))
medir.observe($('panel-contenido'))

// Manijas: arriba cambia el alto, el borde izquierdo el ancho; doble clic vuelve al tamaño automático.
function manija(elemento, lado) {
  elemento.addEventListener('pointerdown', evento => {
    const desdeX = evento.screenX
    const desdeY = evento.screenY
    elemento.setPointerCapture(evento.pointerId)
    api.redimensionInicio()
    const mover = e => api.redimension(e.screenX - desdeX, e.screenY - desdeY, lado)
    const soltar = () => {
      elemento.removeEventListener('pointermove', mover)
      api.redimensionFin()
    }
    elemento.addEventListener('pointermove', mover)
    elemento.addEventListener('pointerup', soltar, { once: true })
  })
  elemento.addEventListener('dblclick', () => api.tamanoAutomatico())
}

manija($('agarre-alto'), 'alto')
manija($('agarre-ancho'), 'ancho')

// --- arranque --------------------------------------------------------------

let ultimo = null

function pintar() {
  if (!ultimo) return
  const { ahora, sesiones, tickets, reuniones } = ultimo
  pintarReuniones(reuniones, ahora)
  pintarTickets(tickets, ahora)
  pintarSesiones(sesiones, ahora)
}

api.alRecibirEstado(estado => {
  ultimo = estado
  pintar()
})
api.pedirEstado()
