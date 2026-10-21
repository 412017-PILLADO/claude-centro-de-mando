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
  lapiz: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
}

// Subtítulo del bloque (bajo el título): mensajes de "vacío" o de carga. Vacío = se oculta.
function subtitulo(id, texto) {
  const nodo = $(id)
  nodo.textContent = texto ?? ''
  nodo.hidden = !texto
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

// Se agrupa por el estado de cada tablero (EN CURSO, PRUEBAS DE USUARIO…); la categoría de Jira
// (new / indeterminate / done) solo ordena los grupos y les da color.
const CATEGORIAS = {
  'por-hacer': { orden: 0, color: 'var(--por-hacer)' },
  'en-curso': { orden: 1, color: 'var(--en-curso)' },
  hecho: { orden: 2, color: 'var(--hecho)' },
}

// statusCategory de Jira; si falta (datos viejos), se deduce del nombre del estado.
function categoria(ticket) {
  if (ticket.category === 'new') return 'por-hacer'
  if (ticket.category === 'indeterminate') return 'en-curso'
  if (ticket.category === 'done') return 'hecho'
  return /curso|progress|prueba|review|revis|test/i.test(ticket.status ?? '') ? 'en-curso' : 'por-hacer'
}

const claveEstado = ticket => (ticket.status || 'Sin estado').trim().toUpperCase()
const nombreEstado = clave => clave.charAt(0) + clave.slice(1).toLowerCase()

// Los estados presentes, en el orden de su categoría y, dentro de ella, como vienen de Jira.
function estados(tickets) {
  const vistos = new Map()
  for (const t of tickets) if (!vistos.has(claveEstado(t))) vistos.set(claveEstado(t), { clave: claveEstado(t), cat: categoria(t), orden: vistos.size })
  return [...vistos.values()].sort((a, b) => CATEGORIAS[a.cat].orden - CATEGORIAS[b.cat].orden || a.orden - b.orden)
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
  for (const t of tickets) cuentas[claveEstado(t)] = (cuentas[claveEstado(t)] ?? 0) + 1
  if (filtro !== 'todos' && !cuentas[filtro]) filtro = 'todos'

  const opciones = [['todos', 'Todos'], ...estados(tickets).map(e => [e.clave, nombreEstado(e.clave)])]
  $('filtros').replaceChildren(
    ...opciones
      .filter(([clave]) => cuentas[clave])
      .map(([clave, nombre]) =>
        el('button', {
          class: `filtro ${filtro === clave ? 'activo' : ''}`,
          'aria-pressed': String(filtro === clave),
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
      tabindex: 0,
      onkeydown: evento => {if(evento.target===evento.currentTarget&&['Enter',' '].includes(evento.key)){evento.preventDefault();api.abrirUrl(ticket.url)}},
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
        'aria-label': 'Trabajar ' + ticket.key + ' con Claude Desktop',
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
  subtitulo('sub-tickets', !tickets ? 'Se cargan cuando abrís una sesión de Claude (usa tu conexión a Jira).' : items.length === 0 ? 'No tenés tickets abiertos asignados.' : '')
  if (!tickets) return
  for(const {clave} of estados(items)){const grupo=items.filter(t=>claveEstado(t)===clave&&(filtro==='todos'||clave===filtro));if(!grupo.length)continue;caja.append(el('h3',{class:'grupo-tickets',text:nombreEstado(clave)+' '+grupo.length}));for(const ticket of grupo)caja.append(tarjetaTicket(ticket))}
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
        sesion.branch ? el('span', { class: 'tenue rama', text: `  ⎇ ${sesion.branch}` }) : null,
      ),
      sesion.changed > 0 ? el('span', { class: 'etiqueta-cambios', title: `${sesion.changed} archivos con cambios` }, icono('lapiz'), String(sesion.changed)) : null,
      el(
        'button',
        {
          class: 'quitar',
          title: 'Quitar de la lista (vuelve sola si la usás de nuevo)',
          'aria-label': 'Quitar de la lista',
          onclick: () => api.ocultarSesion(sesion.id),
        },
        '✕',
      ),
    ),
    el('div',{class:'carpeta-sesion',text:(sesion.cwd||'')+' · '+hace(ahora-(sesion.lastActivityAt||sesion.startedAt||ahora))}),
    el(
      'div',
      { class: 'contexto' },
      porcentaje === null ? null : el('span', { class: 'porcentaje', text: `${Math.round(porcentaje)}%` }),
      porcentaje === null ? el('span', { class: 'relleno' }) : el('div', { class: `mini-barra ${nivel}` }, el('div', { style: `width:${Math.min(100, porcentaje)}%` })),
      el('span', { class: `estado-sesion ${estado.clase}`, text: estado.texto }),
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
  subtitulo('sub-sesiones', sesiones.length === 0 ? 'No hay sesiones de Claude abiertas.' : '')
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

const esDeHoy = (r, ahora) => new Date(r.start).toDateString() === new Date(ahora).toDateString()

function pintarReuniones(todas, ahora, error, soloHoy) {
  const reuniones = soloHoy ? todas.filter(r => esDeHoy(r, ahora)) : todas
  $('cuenta-reuniones').textContent = String(reuniones.length)
  const caja = $('reuniones')
  caja.replaceChildren()
  subtitulo('sub-reuniones', error ? 'No pude leer el calendario: ' + error : reuniones.length === 0 ? (soloHoy ? 'Sin más reuniones hoy.' : 'Sin reuniones en los próximos días.') : '')
  if (reuniones.length === 0) return
  let diaAnterior = null
  for (const r of reuniones.slice(0, 6)) {
    const dia = etiquetaDia(r.start, ahora)
    if (dia !== diaAnterior) caja.append(el('div', { class: 'dia', text: dia }))
    diaAnterior = dia
    caja.append(
      el(
        'div',
        { class: `reunion ${Date.parse(r.end)<=ahora?'pasada':r===reuniones.find(item=>Date.parse(item.end)>ahora)?'ahora':''}` },
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

prepararPlegado(document, leer, guardar)

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

// --- ajustes ---------------------------------------------------------------
// Misma ventana que el panel. La primera vez que se abre la app funciona como bienvenida.

const COLORES_GATO = ['negro', 'gris', 'naranja', 'crema', 'siames', 'atigrado']
// Fuente → [título, clave en conectores.json, nombre del conector en Claude]
const FUENTES_AJUSTES = {
  sesiones: ['Sesiones de Claude', null, 'el plugin de Claude Code'],
  reuniones: ['Reuniones', 'calendario', 'Google Calendar'],
  tickets: ['Mis tickets', 'jira', 'Jira (Atlassian)'],
}
let vista = 'panel'
let claveAjustes = null

function mostrarVista(nueva) {
  vista = nueva === 'ajustes' ? 'ajustes' : 'panel'
  $('vista-trabajo').hidden = vista !== 'panel'
  $('vista-ajustes').hidden = vista !== 'ajustes'
  $('vista-centro').setAttribute('aria-pressed', String(vista === 'panel'))
  $('vista-ajustes-btn').setAttribute('aria-pressed', String(vista === 'ajustes'))
  claveAjustes = null
  pintar()
}

function interruptor(etiqueta, marcado, alCambiar, ayuda = '', clase = 'ajuste') {
  const entrada = el('input', { type: 'checkbox', role: 'switch' })
  entrada.checked = marcado
  entrada.addEventListener('change', () => alCambiar(entrada.checked))
  return el('label', { class: clase }, el('span', { class: 'crece' }, etiqueta, ayuda ? el('small', { text: ayuda }) : null), entrada)
}

function ayudaFuente(id, conectores) {
  const [, clave, conector] = FUENTES_AJUSTES[id]
  if (!conectores) return 'Abrí Claude Code una vez con el plugin para detectarla.'
  if (clave && conectores[clave] !== true) return `Conectá ${conector} en Claude (Configuración › Conectores).`
  return ''
}

function pintarAjustes({ config, conectores = null, gatito = {} }) {
  if (!config) return
  // No se redibuja mientras se escribe ni si nada cambió.
  const clave = JSON.stringify({ config, conectores, nombre: gatito.nombre, color: gatito.color })
  if (clave === claveAjustes || document.activeElement?.tagName === 'INPUT' && document.activeElement.type === 'text') return
  claveAjustes = clave
  const cambiar = cambios => api.cambiarConfig(cambios)
  $('bienvenida').hidden = !config.primerUso
  $('titulo-ajustes').textContent = config.primerUso ? 'Bienvenida' : 'Ajustes'

  const nombre = el('input', { type: 'text', maxlength: '30', 'aria-label': 'Nombre del gatito' })
  nombre.value = gatito.nombre || 'Michi'
  nombre.addEventListener('change', () => api.cuidarGatito('nombre', nombre.value))
  const colores = el('div', { class: 'colores-ajustes', role: 'group', 'aria-label': 'Color' },
    COLORES_GATO.map(c => el('button', { class: `color-gato pelaje-${c}`, title: c, 'aria-label': c, 'aria-pressed': String(gatito.color === c), onclick: () => api.cuidarGatito('color', c) })))

  const fuentes = Object.entries(FUENTES_AJUSTES).map(([id, [titulo]]) => {
    const fila = [interruptor(titulo, config.fuentes[id].activa, v => cambiar({ [`fuentes.${id}.activa`]: v }), ayudaFuente(id, conectores))]
    if (id === 'reuniones' && config.fuentes.reuniones.activa) fila.push(interruptor('Solo las de hoy', config.fuentes.reuniones.soloHoy, v => cambiar({ 'fuentes.reuniones.soloHoy': v }), '', 'ajuste sub'))
    if (id === 'tickets' && config.fuentes.tickets.activa) {
      const jql = el('input', { type: 'text', 'aria-label': 'Filtro de Jira (JQL)' })
      jql.value = config.fuentes.tickets.jql
      jql.addEventListener('change', () => cambiar({ 'fuentes.tickets.jql': jql.value }))
      fila.push(el('details', { class: 'avanzado' }, el('summary', { text: 'Qué tickets traer (JQL)' }), jql))
    }
    return fila
  })

  $('ajustes-cuerpo').replaceChildren(
    el('h2', { text: 'Tu gatito' }),
    el('label', { class: 'ajuste' }, el('span', { class: 'crece', text: 'Nombre' }), nombre),
    colores,
    interruptor('Gatito en el escritorio', config.mascota.visible, v => cambiar({ 'mascota.visible': v })),
    el('h2', { text: 'Conexiones' }),
    el('p', { class: 'subtitulo', text: 'Se leen de tus conectores de Claude Code. Sin ninguna, el gatito funciona solo.' }),
    ...fuentes.flat(),
    el('h2', { text: 'Sistema' }),
    interruptor('Abrir al iniciar la computadora', config.inicioAutomatico, v => cambiar({ inicioAutomatico: v })),
    interruptor('Aceleración gráfica', config.aceleracionGrafica, v => cambiar({ aceleracionGrafica: v }), 'Puede verse más fluido, pero consume más. Se aplica al reiniciar la app.'),
  )
}

$('ajustes-listo').onclick = () => {
  if (ultimo?.config?.primerUso) api.cambiarConfig({ primerUso: false })
  mostrarVista('panel')
}
$('vista-ajustes-btn').onclick = () => mostrarVista('ajustes')
api.alCambiarVista(mostrarVista)

// --- arranque --------------------------------------------------------------

let ultimo = null

function pintar() {
  if (!ultimo) return
  if (vista === 'ajustes') return pintarAjustes(ultimo)
  const { ahora, sesiones, tickets, reuniones, errorReuniones, config = {}, fuentes = { sesiones: true, reuniones: true, tickets: true } } = ultimo
  for (const nombre of Object.keys(fuentes)) document.querySelector?.(`[data-seccion="${nombre}"]`)?.classList.toggle('sin-fuente', !fuentes[nombre])
  $('sin-fuentes').hidden = Object.values(fuentes).some(Boolean)
  pintarReuniones(reuniones, ahora, errorReuniones, config.fuentes?.reuniones?.soloHoy === true)
  pintarTickets(tickets, ahora)
  pintarSesiones(sesiones, ahora)
}

api.alRecibirEstado(estado => {
  ultimo = estado
  pintar()
})
api.pedirEstado()

$('vista-centro').setAttribute('aria-pressed','true')
$('vista-centro').onclick=()=>{mostrarVista('panel');api.alto(altoCompleto())}
