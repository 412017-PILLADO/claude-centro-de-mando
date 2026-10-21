const api = window.centro

const $ = id => document.getElementById(id)
const ALTO_GATO = 84
// Todos los dibujos comparten el lienzo de sprites/medidas.json (288 × 237).
const ANCHO_GATO = Math.round((ALTO_GATO * 288) / 237)
const MARGEN = 150 // para que los globos no se salgan de la pantalla
const AVISO_REUNION_MS = 5 * 60_000
const RECIENTE_MS = 10 * 60_000
const DORMILON_MS = 30 * 60_000

// --- dibujo ---------------------------------------------------------------

const DIBUJOS = [...new Set([
  ...Object.values(comportamientoGatito.ciclos).flat().map(([nombre]) => nombre),
  ...comportamientoGatito.transiciones.flatMap(t=>t.cuadros.map(([n])=>n)),
  'salto1', 'salto2', 'salto3', 'sentado-quieto', 'alzar0', 'alzar1', 'alzar2', 'colgar1', 'colgar2', 'colgar3', 'colgar4',
])]

// Secuencias: [dibujo, milisegundos] en orden.
const ALZAR = [['alzar0', 100], ['alzar1', 170], ['alzar2', 200]]
const COLGAR = ['colgar1', 'colgar2', 'colgar3', 'colgar4'].map(n => [n, 180])
const duracion = secuencia => secuencia.reduce((total, [, ms]) => total + ms, 0)

const imagenes = {}
let colorActual = 'negro'
for (const nombre of DIBUJOS) {
  const img = document.createElement('img')
  img.alt = ''
  img.draggable = false
  img.height = ALTO_GATO
  // El lienzo incluye aire sobre algunas poses: acercar el globo a los píxeles visibles.
  img.onload = () => {
    const lienzo = document.createElement('canvas')
    lienzo.width = img.naturalWidth; lienzo.height = img.naturalHeight
    const contexto = lienzo.getContext('2d')
    contexto.drawImage(img, 0, 0)
    const pixeles = contexto.getImageData(0, 0, lienzo.width, lienzo.height).data
    for (let i = 3; i < pixeles.length; i += 4) {
      if (pixeles[i] > 32) { img.aireSuperior = Math.floor(i / 4 / lienzo.width) * ALTO_GATO / lienzo.height; break }
    }
  }
  img.style.display = 'none'
  $('gato').append(img)
  imagenes[nombre] = img
}

let cuadroActual = null
let gatito = { color: 'negro', saciedad: 80, energia: 80, carino: 80 }
let configCentro = {}
// Cada dibujo se carga (y se recolorea) recién cuando se muestra; el recoloreado queda cacheado.
function cargarDibujo(nombre) {
  const img = imagenes[nombre]
  if (img.colorCargado === colorActual) return
  const color = img.colorCargado = colorActual
  pintarGatito(nombre, color).then(src => { if (img.colorCargado === color) img.src = src })
}
function aplicarColor(color) {
  colorActual = color
  if (cuadroActual) cargarDibujo(cuadroActual)
}
function mostrarCuadro(nombre) {
  if (nombre === cuadroActual) return
  cargarDibujo(nombre)
  if (cuadroActual) imagenes[cuadroActual].style.display = 'none'
  imagenes[nombre].style.display = 'block'
  cuadroActual = nombre
}

// --- globos de alerta ----------------------------------------------------------
// Cada alerta vence desde su primera aparición; el refresco no prolonga el plazo.
// Cerrar una alerta la recuerda (no vuelve a aparecer con el mismo id).

const alertas = new Map() // id → { icono, texto, negrita, boton, hasta, tono, nodo }
const descartadas = new Set()
const gestosPendientes = new Map()
const MAX_GLOBOS = 3

function mostrarAlerta(id, { icono = '', negrita = '', texto = '', boton = null, ms = 4200, tono = '', despues = null }) {
  if(salto){globosEnEspera.set(id,{icono,negrita,texto,boton,ms,tono,despues});return}
  if (descartadas.has(id)) return
  const existente = alertas.get(id)
  if (!enFoco() && !existente && id.startsWith('reu:')) maquina.pedir('reunion', 5, id)
  if (!enFoco() && !existente && id.startsWith('ses:')) maquina.pedir('sesion', 4, id)
  const alerta = { desde: existente?.desde ?? performance.now(), icono, negrita, texto, boton, tono, despues, hasta: existente?.hasta ?? performance.now() + ms, nodo: existente && existente.nodo }
  if(existente && existente.icono===icono && existente.tono===tono && !!existente.negrita===!!negrita && existente.boton?.texto===boton?.texto && !!existente.despues===!!despues){
    Object.assign(existente,alerta)
    existente.textoNodo.textContent=texto
    if(existente.negritaNodo)existente.negritaNodo.textContent=negrita
    return
  }
  alertas.set(id, alerta)
  dibujarAlerta(id, alerta)
}

function cerrarAlerta(id, { recordar = false } = {}) {
  maquina.cancelar(id)
  gestosPendientes.delete(id)
  const alerta = alertas.get(id)
  if (recordar) descartadas.add(id)
  if (!alerta) return
  alertas.delete(id)
  if (alerta.nodo) {
    alerta.nodo.style.maxHeight=alerta.nodo.getBoundingClientRect().height+'px'
    void alerta.nodo.offsetHeight
    alerta.nodo.classList.add('saliendo')
    setTimeout(() => alerta.nodo.remove(), 180)
  }
}

function dibujarAlerta(id, alerta) {
  const nodo = alerta.nodo || document.createElement('div')
  nodo.className = `globo ${alerta.tono}`
  nodo.replaceChildren()
  nodo.append(Object.assign(document.createElement('span'), { className: 'globo-icono', textContent: '' }))
  const texto = document.createElement('span')
  texto.className = 'globo-texto'
  if(alerta.negrita){alerta.negritaNodo=Object.assign(document.createElement('b'),{textContent:alerta.negrita});texto.append(alerta.negritaNodo,' ')}
  if(alerta.negrita)texto.classList.add('con-nombre')
  alerta.textoNodo=document.createElement('span');alerta.textoNodo.textContent=alerta.texto;texto.append(alerta.textoNodo)
  nodo.append(texto)
  if (alerta.boton) {
    const boton = Object.assign(document.createElement('button'), { className: 'globo-boton', textContent: alerta.boton.texto })
    if(alerta.tono==='comida'){boton.title='Dar de comer';boton.setAttribute('aria-label','Dar de comer')}
    boton.onclick = () => {
      alerta.boton.accion()
      cerrarAlerta(id, { recordar: true })
    }
    nodo.append(boton)
  }
  if(alerta.despues){const b=Object.assign(document.createElement('button'),{className:'globo-boton',textContent:'Después'});b.onclick=()=>{alerta.despues();cerrarAlerta(id,{recordar:true})};nodo.append(b)}
  const cerrar = Object.assign(document.createElement('button'), { className: 'globo-cerrar', textContent: '✕', title: 'Cerrar' })
  cerrar.onclick = () => {alerta.despues?.();cerrarAlerta(id, { recordar: true })}
  nodo.append(cerrar)
  if (!alerta.nodo) {
    $('alertas').append(nodo)
    alerta.nodo = nodo
  }
  const sobrantes=[...alertas.keys()].sort((a,b)=>Number(a.startsWith('reu:'))-Number(b.startsWith('reu:')))
  while(alertas.size>MAX_GLOBOS&&sobrantes.length)cerrarAlerta(sobrantes.shift(), { recordar:true })
}


// --- maullido (sonido sintetizado, solo al tocarlo) --------------------------

let audio = null
function maullar() {
  try {
    audio = audio || new AudioContext()
    const ahora = audio.currentTime
    // Un "mrrp" bajito: onda suave, tono medio, filtro que saca los agudos y volumen muy bajo.
    const oscilador = audio.createOscillator()
    const filtro = audio.createBiquadFilter()
    const volumen = audio.createGain()
    oscilador.type = 'sine'
    oscilador.frequency.setValueAtTime(500, ahora)
    oscilador.frequency.linearRampToValueAtTime(680, ahora + 0.1)
    oscilador.frequency.linearRampToValueAtTime(460, ahora + 0.28)
    filtro.type = 'lowpass'
    filtro.frequency.value = 1200
    volumen.gain.setValueAtTime(0.0001, ahora)
    volumen.gain.exponentialRampToValueAtTime(0.025, ahora + 0.06)
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.32)
    oscilador.connect(filtro).connect(volumen).connect(audio.destination)
    oscilador.start(ahora)
    oscilador.stop(ahora + 0.35)
  } catch {
    // sin audio
  }
}

// --- estado de Claude y del calendario ---------------------------------------

let trabajando = false
let modo = 'tranqui' // tranqui | dormilon | trabajando | esperando | reunion
let centroAbierto = false
const estadosPrevios = new Map()

const nombreSesion = s =>
  /[\\/]scratch-workspaces[\\/]|^[a-z]:[\\/]windows([\\/]|$)/i.test(s.cwd || '') ? 'Una conversación' : s.name
const ultimaActividad = s => s.lastActivityAt || s.startedAt || 0

function cuandoReunion(reunion, ahora) {
  const minutos = Math.ceil((Date.parse(reunion.start) - ahora) / 60_000)
  return minutos > 0 ? `en ${minutos} min` : 'ya empezó'
}

api.alRecibirEstado(({ ahora, sesiones, reuniones, gatito: nuevo, eventosGatito=[], contextoGatito={}, config = configCentro }) => {
  configCentro = config
  if (nuevo) {
    if (nuevo.color !== gatito.color) aplicarColor(nuevo.color)
    const estabaEnFoco=enFoco()
    gatito = nuevo
    if(enFoco()&&!estabaEnFoco){viaje=null;accion=null;maquina.vaciar();maquina.despertar();maquina.reiniciar();maquina.pedir('dormir',8,'foco');cerrarMenu();for(const id of alertas.keys())if(!id.startsWith('reu:')&&!id.startsWith('ses:'))cerrarAlerta(id)}
    if(!enFoco()&&estabaEnFoco){maquina.despertar();maquina.reiniciar();accion=null;maquina.pedir('estirar',8,'fin-foco')}
    if(nuevo.autonomia?.pausas===false){for(const [id,p] of gestosPendientes)if(p.evento.tipo==='pausa')cerrarAlerta(id);for(const id of alertas.keys())if(id.startsWith('pausa:'))cerrarAlerta(id)}

  }
  bordes=contextoGatito.bordes||{izquierda:false,derecha:false}
  datosTarjeta={sesiones,reuniones}
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
  if(esperando.length>1){
    const grupo='ses:grupo:'+JSON.stringify(esperando.map(s=>[s.id,ultimaActividad(s)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));vigentes.add(grupo)
    const yaAgrupadas=alertas.has(grupo)
    mostrarAlerta(grupo,{icono:'💬',texto:esperando.length+' sesiones te esperan',ms: 8000})
    if(terminadas.size&&!enFoco()&&yaAgrupadas)maquina.pedir('sesion',4,'fin-sesiones:'+ahora)
  }
  for (const s of esperando.length>1?[]:esperando) {
    const id = `ses:${s.id}:${ultimaActividad(s)}`
    vigentes.add(id)
    const recien = terminadas.has(s.id)
    if (!alertas.has(id) || recien) {
      mostrarAlerta(id, {
        icono: recien ? '✓' : '💬',
        negrita: nombreSesion(s),
        texto: recien ? 'terminó y te espera' : 'te espera',
        tono: recien ? 'listo' : '',
        ms: 8000,
      })
    }
  }
  for (const id of alertas.keys()) if (id.startsWith('ses:') && !vigentes.has(id)) cerrarAlerta(id)


  // Alertas de reuniones: desde 5 min antes hasta 5 min después de empezar.
  const proximas = reuniones.filter(
    r => Date.parse(r.start) - AVISO_REUNION_MS <= ahora && ahora < Date.parse(r.start) + AVISO_REUNION_MS,
  )
  const reunionesVigentes = new Set()
  for (const r of proximas) {
    const id = `reu:${r.id}${ahora>=Date.parse(r.start)?":inicio":""}`
    reunionesVigentes.add(id)
    mostrarAlerta(id, {
      icono: '📅',
      negrita: r.title,
      texto: cuandoReunion(r, ahora),
      boton: r.joinUrl ? { texto: 'Unirse', accion: () => api.unirse(r.joinUrl) } : null,
      tono: 'importante',
      ms: 20000,
    })
  }
  for (const id of alertas.keys()) if (id.startsWith('reu:') && !reunionesVigentes.has(id)) cerrarAlerta(id)

  trabajando = vivas.some(s => s.status === 'working')
  if (proximas.length) modo = 'reunion'
  else if (vivas.some(s => s.status === 'working')) modo = 'trabajando'
  else if (esperando.length) modo = 'esperando'
  else if (!vivas.some(s => ahora - ultimaActividad(s) < DORMILON_MS)) modo = 'dormilon'
  else modo = 'tranqui'
  impedido=contextoGatito.reunion||contextoGatito.alerta||proximas.length>0||esperando.length>0
  if(impedido){for(const id of gestosPendientes.keys())cerrarAlerta(id);cerrarAlerta('hambre');for(const id of alertas.keys())if(/^(pausa:|rutina:|saludo:|despedida:|festejo:)/.test(id))cerrarAlerta(id);if(viaje?.estado==='hambre')viaje=null;maquina.cancelar('hambre')}
  for(const evento of eventosGatito)if(evento.tipo==='fin-foco'||evento.tipo==='fin-descanso'){mostrarAlerta(evento.id,{texto:evento.texto,ms: 21000});if(evento.tipo==='fin-descanso')ronronear()}else if(!impedido&&!enFoco())conductaPropia(evento)
})

// El centro avisa a qué hora empieza una reunión: si la habías cerrado, vuelve a aparecer.
api.alRecibirAlerta(idReunion => {
 const r=datosTarjeta.reuniones.find(r=>r.id===idReunion)
 if(r)mostrarAlerta('reu:'+r.id+':inicio',{negrita:r.title,texto:'ya empezó',ms: 21000,tono:'importante',boton:r.joinUrl?{texto:'Unirse',accion:()=>api.unirse(r.joinUrl)}:null})
})

// Otros avisos de la app (por ejemplo, "copié el pedido para Claude").
let numeroDeAviso = 0
api.alRecibirDecir(({ texto, ms }) => {
  mostrarAlerta(`decir:${numeroDeAviso++}`, { icono: '🐾', texto: String(texto), ms: Number.isFinite(Number(ms)) && Number(ms)>=0 ? Math.max(4000,Math.round(Number(ms)*.7)) : 4200 })
})

// --- movimiento ---------------------------------------------------------------

let ancho = innerWidth
let x = innerWidth - MARGEN - ANCHO_GATO - 160
let direccion = 1
// La máquina conserva la pose final entre secuencias.
let accion = null, ultimaSecuencia = null
const registroGatito=[]
let ultimoRegistro=0, pendientesRegistro=0
function enviarRegistroGatito(){
 if(pendientesRegistro)api.registrarGatito(registroGatito.slice(-pendientesRegistro))
 pendientesRegistro=0
 ultimoRegistro=performance.now()
}
setInterval(enviarRegistroGatito,30000)
function registrarSecuencia(s,ahora){
 const categoria=String(s.id||'').split(':')[0]
 const id=s.id?(['hambre','giro-panel','viaje','propia','reu','ses','pausa','rutina','saludo','despedida','festejo','foco','fin-foco','fin-sesiones'].includes(categoria)?categoria:'pedido'):null
 registroGatito.push({t:Date.now(),estado:s.estado,variante:s.variante||null,id,prioridad:s.prioridad||0,poseInicial:s.poseInicial,poseFinal:s.poseFinal,motivo:s.motivo||'pedido'})
 if(registroGatito.length>200)registroGatito.shift()
 pendientesRegistro=Math.min(200,pendientesRegistro+1)
 if(s.motivo==='freno-anti-oscilacion'||ahora-ultimoRegistro>=30000)enviarRegistroGatito()
}
let ladoDelCentro = 'izquierda'
let arrastre = null
let cayendo = false, ultimoDescanso = -Infinity, ultimoCentro = null
let maullidoHasta=0
let viaje=null, ultimoPaso=null, impedido=false, cursorX=null, corazonHasta=0
let bordes={izquierda:false,derecha:false},salto=null,preparando=null
const globosEnEspera=new Map()
function puedeCruzar(){return !impedido&&!trabajando&&!enFoco()&&!maquina.durmiendo()&&!centroAbierto&&!arrastre&&!cayendo&&!salto&&!alertas.size}
// El gato no persigue el mouse: solo lo mira cuando pasa cerca, sin moverse de lugar.
const RADIO_MIRADA=250
let muestraCursor=null,cursorMovido=-Infinity,cursorCerca=false
let proximaMirada=0
let miradaCursor=null
function observarCursor(p){
 if(!p){cursorCerca=false;return}
 if(muestraCursor&&(p.x!==muestraCursor.x||p.y!==muestraCursor.y))cursorMovido=performance.now()
 muestraCursor={x:p.x,y:p.y}
 cursorX=p.x
 cursorCerca=!p.lado&&Math.hypot(p.x-centroDelGato(),p.y-(innerHeight-ALTO_GATO/2))<=RADIO_MIRADA
}
const limite = valor => Math.max(0, Math.min(ancho - ANCHO_GATO, valor))
// Las patitas llegan al extremo del lienzo; deja el gato entero dentro de la pantalla.
function destinoBorde(lado){return lado==='izquierda'?0:ancho-ANCHO_GATO}
function ir(destino,estado,lado=null,id=null){viaje={destino,estado,lado,id,corriendo:estado!=='cruzar'&&Math.abs(destino-x)>ancho*.4};maquina.despertar()}
function irBorde(estado,lado=x<ancho/2?'izquierda':'derecha'){ir(destinoBorde(lado,estado),estado,lado)}
function comidaAlAzar(){const comidas=['croquetas','pescado','leche'];if(comidas.includes(gatito.favorita))comidas.push(gatito.favorita);return comidas[Math.floor(Math.random()*comidas.length)]}
function darDeComer(){api.cuidarGatito(comidaAlAzar())}
function globoPausa(id){mostrarAlerta(id,{texto:'¿Nos estiramos un toque?',ms: 21000,boton:{texto:'Dale',accion:()=>api.cuidarGatito('pausa-respuesta','dale')},despues:()=>api.cuidarGatito('pausa-respuesta','despues')})}
function conductaPropia(e){
 if(arrastre||cayendo||salto||preparando||enFoco())return
 if(e.tipo==='hambre'){ir(limite(x+(x<ancho/2?35:-35)),'hambre');return}
 if(e.tipo==='dormir'){if(Math.random()<.6)irBorde('dormir');else ir(limite(ancho*(.2+Math.random()*.6)),'dormir');return}
 if(e.tipo==='mimar'){ir(x,'mimar',null,'propia:mimar:'+Date.now());return}
 if(e.tipo==='jugar'){maquina.pedir('aburrido',1,'propia:jugar:'+Date.now());return}
 if(e.tipo==='pasear'){const lado=Math.random()<.5?'izquierda':'derecha';irBorde(bordes[lado]&&puedeCruzar()&&Math.random()<.35?'cruzar':'rascar',lado);return}
 gestosPendientes.set(e.id,{evento:e,hasta:performance.now()+120000})
 maquina.pedir(e.tipo==='pausa'?'estirar':e.tipo,['saludo','festejo'].includes(e.tipo)?3:2,e.id)
}
const maquina = comportamientoGatito.crearMaquina()
function enFoco(){return gatito.foco?.fase==='foco'}
function elegirAccion(ahora) {
 if(preparando&&!puedeCruzar())preparando=null
 if(viaje?.estado==='cruzar'&&(!puedeCruzar()||!bordes[viaje.lado]))viaje=null
 if(preparando&&accion?.estado==='preparar-salto'&&ahora>=accion.hasta){
  const lado=preparando;preparando=null
  if(puedeCruzar()&&bordes[lado]){salto={fase:'subida',esperando:true};maquina.reiniciar('volando');api.cruzarPantalla(lado);return accion}
 }

 if(enFoco()){miradaCursor=null;const s=maquina.paso(ahora,{energia:50,siesta:true});if(s!==ultimaSecuencia){registrarSecuencia(s,ahora);ultimaSecuencia=s}return s}
 if(!arrastre&&!cayendo&&!viaje&&!impedido&&!trabajando&&!centroAbierto&&!maquina.durmiendo()&&(!accion||ahora>=accion.hasta||accion.reposo&&ahora-accion.desde>=20000)){
  if(gatito.energia<22)irBorde('dormir')
 }
 if(viaje&&(!accion||accion.reposo||ahora>=accion.hasta)){
  viaje.destino=viaje.lado?destinoBorde(viaje.lado,viaje.estado):limite(viaje.destino)
  if(Math.abs(x-viaje.destino)<2){
   x=viaje.destino;if(viaje.estado==='hambre')direccion=1;if(viaje.lado)direccion=viaje.lado==='izquierda'?-1:1
   if(viaje.estado==='cruzar')preparando=viaje.lado
   maquina.pedir(viaje.estado==='cruzar'?'preparar-salto':viaje.estado==='mimar'?'espaldas':viaje.estado,2,viaje.estado==='hambre'?'hambre':viaje.id)

   viaje=null
  } else {direccion=x<viaje.destino?1:-1;maquina.pedir(viaje.corriendo?'correr':'caminar',2,'viaje:'+ahora)}
 }
 const siguiente=maquina.paso(ahora,{trabajando,panel:centroAbierto,energia:viaje||impedido?80:gatito.energia,siesta:!viaje&&gatito.siestaHasta>Date.now()})
 const quieto=siguiente.estado==='ocio'||siguiente.estado==='lamer'&&ahora>=siguiente.desde+siguiente.aseoMs
 const puedeMirar=!enFoco()&&!trabajando&&!centroAbierto&&!impedido&&!viaje&&!preparando&&!arrastre&&!cayendo&&!salto&&!maquina.durmiendo()&&quieto&&siguiente.reposo&&siguiente.poseInicial==='sentado'&&siguiente.poseFinal==='sentado'&&maquina.pendientes().length===0
 if(miradaCursor&&(!puedeMirar||ahora>=miradaCursor.hasta))miradaCursor=null
 if(!miradaCursor&&puedeMirar&&ahora>=proximaMirada&&siguiente.hasta-ahora>=2160&&cursorCerca&&ahora-cursorMovido<1000){
  direccion=cursorX<centroDelGato()?-1:1
  miradaCursor={desde:ahora,hasta:ahora+2160}
  proximaMirada=ahora+8000
  registrarSecuencia({estado:'mirar-cursor',poseInicial:'sentado',poseFinal:'sentado',motivo:'mirada-en-reposo'},ahora)
 }
 if(siguiente!==ultimaSecuencia){
  registrarSecuencia(siguiente,ahora)
  if(siguiente.id?.startsWith('propia:')&&['espaldas','aburrido'].includes(siguiente.estado))api.cuidarGatito('conducta-hecha',siguiente.estado==='espaldas'?'mimar':'jugar')
  const p=gestosPendientes.get(siguiente.id)
  if(p){gestosPendientes.delete(siguiente.id);if(p.evento.tipo==='pausa')globoPausa(siguiente.id);else mostrarAlerta(siguiente.id,{texto:p.evento.texto,ms: 4000})}
 }
 if(siguiente!==ultimaSecuencia&&siguiente.estado==='girar')siguiente.direccionInicial=direccion
 if(siguiente!==ultimaSecuencia&&siguiente.estado==='mimar')ronronear()
 ultimaSecuencia=siguiente
 return siguiente
}


// Cada secuencia conserva sus transiciones hasta llegar a la pose siguiente.
function cuadroDeSecuencia(cuadros,transcurrido){let total=0;for(const [n,ms] of cuadros){total+=ms;if(transcurrido<total)return n}return null}
function cuadro(ahora){
 if(ahora>corazonHasta)$('corazon-caricia').classList.remove('acariciado')
 const delta=ultimoPaso===null?0:Math.min(50,ahora-ultimoPaso);ultimoPaso=ahora
 for(const [id,p] of gestosPendientes)if(ahora>=p.hasta)cerrarAlerta(id)
 for(const b of $('menu-rapido').children)if(b.esCuidado)b.disabled=Date.now()<(gatito.esperaHasta||0)
 for(const [id,a] of alertas){if(!salto&&ahora>=a.hasta)cerrarAlerta(id,{recordar:true})}
 if(salto)mostrarCuadro(salto.esperando?'agachar3':salto.fase==='subida'?'salto1':salto.fase==='apice'?'salto2':'salto3')
 else if(cayendo)mostrarCuadro('caer1')
 else if(arrastre?.movido){const t=ahora-arrastre.desde;mostrarCuadro(cuadroDeSecuencia(ALZAR,t)||cuadroDeSecuencia(COLGAR,(t-duracion(ALZAR))%duracion(COLGAR)))}
 else {
  accion=elegirAccion(ahora)
  if(viaje&&['caminar','correr'].includes(accion.estado)){
   const previo=accion.tramos.filter(t=>t.tipo==='transicion').flatMap(t=>t.cuadros).reduce((n,c)=>n+c[1],0)
   if(ahora-accion.desde>=previo)x+=Math.sign(viaje.destino-x)*Math.min(Math.abs(viaje.destino-x),delta*(accion.estado==='correr'?.24:.12))
  }
  mostrarCuadro(miradaCursor?cuadroDeSecuencia(comportamientoGatito.ciclos['mirar-cursor'],ahora-miradaCursor.desde):cuadroDeSecuencia(accion.cuadros,ahora-accion.desde)||accion.cuadros.at(-1)[0])
 }
 if(!arrastre&&!salto)x=limite(x)
 $('alertas').hidden=!!salto
 if(!salto&&ahora<maullidoHasta)mostrarCuadro(cuadroDeSecuencia(comportamientoGatito.ciclos.maullar,ahora-(maullidoHasta-400))||'maullar2')
 const comida=['croquetas','pescado','leche'].includes(accion?.estado)
 $('cuenco-pedido').hidden=enFoco()||/^empujar/.test(cuadroActual)||(!comida&&accion?.estado!=='hambre')
 if(!$('cuenco-pedido').hidden&&$('cuenco-pedido').lleno!==comida){$('cuenco-pedido').lleno=comida;$('cuenco-pedido').src='sprites/cuenco-'+(comida?'lleno':'vacio')+'.png';$('cuenco-pedido').alt=comida?'Cuenco lleno':'Cuenco vacío'}
 const f=gatito.foco,seg=f?Math.max(0,Math.ceil((f.hasta-Date.now())/1000)):0
 $('foco-franja').hidden=!f||f.fase==='listo';$('foco-franja').textContent=f&&f.fase!=='listo'?(f.fase==='foco'?'Foco ':'Descanso ')+String(Math.floor(seg/60)).padStart(2,'0')+':'+String(seg%60).padStart(2,'0'):''
 ubicarFranjaFoco()
 const durmiendo=!arrastre?.movido&&!cayendo&&(cuadroActual==='dormir1'||cuadroActual?.startsWith('respirar'))
 if(durmiendo!==descansoAvisado||durmiendo&&ahora-ultimoDescanso>30000){ultimoDescanso=ahora;descansoAvisado=durmiendo;api.descansoGatito(durmiendo)}
 $('zzz').hidden=!durmiendo
 if(accion?.estado==='girar'){
  const previo=accion.tramos.filter(t=>t.tipo==='transicion').flatMap(t=>t.cuadros).reduce((n,c)=>n+c[1],0)
  if(ahora-accion.desde>=previo+(accion.variante==='giro-sentado'?180:340))direccion=-accion.direccionInicial
 }
 const orientacion=accion?.estado==='girar'&&['girar1','girar2','girar3'].includes(cuadroActual)?accion.direccionInicial:direccion
 $('gato').classList.toggle('izquierda',orientacion<0)
 if(alertas.size){
  ubicarGlobo($('alertas'))
  $('alertas').style.setProperty('--aire-gato', (imagenes[cuadroActual]?.aireSuperior || 0) + 'px')
  for(const a of alertas.values()){const r=a.nodo.getBoundingClientRect();a.nodo.style.setProperty('--colita-x',Math.max(12,Math.min(r.width-12,centroDelGato()-r.left))+'px')}
 }
 const desplazo=`translateX(${Math.round(x)}px)`;if($('mascota').style.transform!==desplazo)$('mascota').style.transform=desplazo
 const centro=centroDelGato();if(centro!==ultimoCentro){ultimoCentro=centro;api.posicionGatito(centro)}
 programarCuadro(ahora)
}
function enMovimiento(ahora){
 return !!(salto||cayendo||arrastre||viaje||preparando||miradaCursor||ahora<maullidoHasta||ahora<corazonHasta||!$('menu-rapido').hidden||['caminar','correr','girar'].includes(accion?.estado))
}
function programarCuadro(ahora){
 if(enMovimiento(ahora)){requestAnimationFrame(cuadro);return}
 setTimeout(()=>requestAnimationFrame(cuadro),maquina.durmiendo()?250:100)
}
requestAnimationFrame(cuadro)
addEventListener('resize',()=>{ancho=innerWidth})
const centroDelGato=()=>Math.round(x+ANCHO_GATO/2)
api.alRecibirCentroVisible(({visible,lado})=>{
 centroAbierto=visible;ladoDelCentro=lado==='derecha'?'derecha':'izquierda'
 const mirar=ladoDelCentro==='izquierda'?-1:1
 if(!enFoco()&&visible&&mirar!==direccion)maquina.pedir('girar',1,'giro-panel')
})
api.alRecibirPedidoPosicion(()=>api.alternarCentro(centroDelGato()))
api.alReubicarCentro(()=>api.reubicarCentro(centroDelGato()))
let tocable=false
function hacerTocable(si){if(si===tocable)return;tocable=si;api.mascotaInteractiva(si)}
function encima(evento) {
 const cajas=[$('gato'),...(!$('cuenco-pedido').hidden?[$('cuenco-pedido')]:[]),...(!$('ajustes-gato').hidden?[$('ajustes-gato')]:[]),...$('alertas').children,...(!$('menu-rapido').hidden?[...$('menu-rapido').children].flatMap(b=>[b,...b.children]):[])]
 return cajas.some(c=>{const r=c.getBoundingClientRect();return evento.clientX>=r.left&&evento.clientX<=r.right&&evento.clientY>=r.top&&evento.clientY<=r.bottom})
}
addEventListener('mousemove',evento=>{
 cursorX=evento.clientX
 if(arrastre){if(Math.hypot(evento.clientX-arrastre.desdeX,evento.clientY-arrastre.desdeY)>4&&!arrastre.movido){arrastre.movido=true;arrastre.desde=performance.now();viaje=null;if(!enFoco())maquina.despertar();accion=null;$('gato').classList.add('arrastrando');api.arrastrarGatito(true)}if(arrastre.movido)x=evento.clientX-arrastre.desfase;return}
 hacerTocable(!salto&&!cayendo&&encima(evento))
})
$('gato').addEventListener('mousedown',evento=>{
 if(evento.button!==0||salto||cayendo)return
 cerrarMenu()
 arrastre={desfase:evento.clientX-x,desdeX:evento.clientX,desdeY:evento.clientY,movido:false,desde:performance.now()}
})
addEventListener('mouseup',evento=>{
 if(!arrastre)return
 const fueClic=!arrastre.movido;arrastre=null;api.arrastrarGatito(false);$('gato').classList.remove('arrastrando')
 if(fueClic&&accion?.estado==='hambre'){darDeComer()}else if(fueClic){maullar();if(!maquina.durmiendo()&&['ocio','lamer','panel','maullar'].includes(accion?.estado))maullidoHasta=performance.now()+400;api.alternarCentro(centroDelGato())}else{cayendo=true;accion=null}
 hacerTocable(encima(evento))
})
let descansoAvisado=false
function ronronear(){
 try{audio=audio||new AudioContext();audio.resume();const o=audio.createOscillator(),v=audio.createGain(),t=audio.currentTime;o.frequency.value=38;v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(.012,t+.2);v.gain.exponentialRampToValueAtTime(.0001,t+1.5);o.connect(v).connect(audio.destination);o.start();o.stop(t+1.6)}catch{/* sin audio */}
}
api.alRecibirCuidado(cuidado=>{
 if(cuidado.aceptado===false){mostrarAlerta('rechazo:'+numeroDeAviso++,{texto:cuidado.texto,ms: 4000});return}
 if(enFoco())return
 const estado=typeof cuidado==='string'?cuidado:cuidado.accion
 viaje=null
 if(estado==='mimar'){maquina.cancelar(accion?.id);maquina.reiniciar();accion=null;ronronear();corazonHasta=performance.now()+2000;$('corazon-caricia').textContent='♥';$('corazon-caricia').classList.remove('acariciado');void $('corazon-caricia').offsetWidth;$('corazon-caricia').classList.add('acariciado')}
 if(estado==='siesta')irBorde('dormir');else if(estado==='rascar')irBorde('rascar');else maquina.pedir(estado,3)
 if(['croquetas','pescado','leche'].includes(estado))cerrarAlerta('hambre')
 if(cuidado.favorita){maquina.pedir('mimar',3);mostrarAlerta('favorita:'+numeroDeAviso++,{texto:cuidado.texto||'¡Mi favorita!',ms: 4000})}
})
api.alRecibirArrastre(({x:nuevaX,soltado,aterrizo,saltando,fase,lado,cancelado})=>{
 const volaba=!!salto
 if(saltando){salto={fase};direccion=lado==='izquierda'?-1:1;viaje=null;accion=null;hacerTocable(false)}
 if(soltado||aterrizo||cancelado){salto=null;preparando=null}
 if(aterrizo||cancelado){for(const [id,datos] of globosEnEspera)mostrarAlerta(id,datos);globosEnEspera.clear()}
 if(cancelado){maquina.reiniciar('agazapado');accion=null}
 x=nuevaX-ANCHO_GATO/2
 if(arrastre)arrastre.movido=true
 if(soltado){arrastre=null;cayendo=true;$('gato').classList.remove('arrastrando');hacerTocable(false)}
 if(aterrizo){cayendo=false;maquina.reiniciar(volaba?'volando':'cayendo');maquina.pedir('soltar',6);accion=null}
})
api.pedirEstado()

// Windows sigue informando coordenadas aun cuando la franja deja pasar los clics.
// Rápido solo con el cursor sobre la franja (para volverla tocable a tiempo); lejos, unas pocas veces por segundo.
const MOUSE_CERCA_MS=50, MOUSE_LEJOS_MS=400
async function consultarMouse(){
 let espera=MOUSE_LEJOS_MS
 try{const p=await api.posicionMouse()
  if(p){observarCursor(p)
   hacerTocable(!cayendo&&encima({clientX:p.x,clientY:p.y}))
   if(!p.lado&&p.y>=0&&p.y<=innerHeight)espera=MOUSE_CERCA_MS}
 }finally{setTimeout(consultarMouse,arrastre||tocable?MOUSE_CERCA_MS:espera)}
}
setTimeout(consultarMouse,MOUSE_LEJOS_MS)
function cerrarMenu(){
 $('menu-rapido').hidden=true;$('ajustes-gato').hidden=true;api.menuRapido(false)
}
function abrirMenu(submenu=''){
 if(arrastre||cayendo||salto)return
 const menu=$('menu-rapido');menu.replaceChildren();menu.hidden=false;menu.classList.remove('abierto')
 // El abanico se centra en el gato; cerca de un borde de la pantalla se inclina hacia adentro.
 menu.style.left=ANCHO_GATO/2+'px';menu.style.bottom=ALTO_GATO*.45+'px'
 const sesgo=x<120?20:ancho-x-ANCHO_GATO<120?-20:0
 const opciones=enFoco()?[['foco-cancelar','Terminar foco']]:submenu==='foco'?[['foco-iniciar','25 min'],['foco-50','50 min'],['volver','Volver']]:[['comer','Comer'],['mimar','Mimar'],['jugar','Jugar'],['siesta','Dormir'],['foco','Foco'],['ajustes','Ajustes']]
 for(const [accion,texto] of opciones){
  const b=document.createElement('button');const etiqueta=Object.assign(document.createElement('span'),{className:'menu-etiqueta',textContent:texto});b.append(etiqueta);b.setAttribute('aria-label',texto);b.setAttribute('role','menuitem');b.setAttribute('data-accion',accion)
  if(accion==='volver'){const glifo=document.createElement('span');glifo.textContent='↶';glifo.setAttribute('aria-hidden','true');b.append(glifo)}
  if(accion!=='volver'){
   const img=document.createElement('img');img.src='sprites/'+({foco:'dormir1',ajustes:'sentado-quieto','foco-iniciar':'dormir1','foco-50':'dormir1','foco-cancelar':'despertar1',comer:'cuenco-lleno',croquetas:'croquetas2',pescado:'pescado1',leche:'leche2',mimar:'ronronear1',jugar:'ovillo1',siesta:'dormir1'}[accion])+'.png';img.alt='';b.append(img)
   b.esCuidado=['comer','mimar','jugar','siesta'].includes(accion);b.disabled=b.esCuidado&&Date.now()<(gatito.esperaHasta||0)
  }
  b.onclick=()=>{if(accion==='comer'){darDeComer();cerrarMenu();return}if(accion==='foco'){abrirMenu('foco');return}if(accion==='ajustes'){abrirAjustes();return}if(accion==='volver'){abrirMenu();return}api.cuidarGatito(accion==='foco-50'?'foco-iniciar':accion==='jugar'?['jugar','raton','caja'][Math.floor(Math.random()*3)]:accion,accion==='foco-50'?50:25);cerrarMenu()}
  menu.append(b)
 }
 const botones=[...menu.children],radio=botones.length>4?116:88
 botones.forEach((b,i)=>{const angulo=(170-i*(160/Math.max(1,botones.length-1))-sesgo)*Math.PI/180;b.style.transitionDelay=i*20+'ms';b.style.left=Math.cos(angulo)*radio-22+'px';b.style.bottom=Math.sin(angulo)*radio-22+'px'})
 setTimeout(()=>menu.classList.add('abierto'),16)
 api.menuRapido(true);hacerTocable(true);menu.children[0]?.focus?.()
}
$('gato').addEventListener('contextmenu',e=>{e.preventDefault();abrirMenu()})
addEventListener('keydown',e=>{
 if(e.key==='Escape'){cerrarMenu();return}
 const menu=$('menu-rapido');if(menu.hidden||!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key))return
 e.preventDefault();const botones=[...menu.children].filter(b=>!b.disabled),actual=botones.indexOf(document.activeElement)
 const indice=e.key==='Home'?0:e.key==='End'?botones.length-1:(actual+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+botones.length)%botones.length
 botones[indice]?.focus()
})
api.alCerrarMenu(cerrarMenu)
addEventListener('mousedown',e=>{if($('menu-rapido').hidden||e.button===2)return;if(![...$('menu-rapido').children].some(b=>{const r=b.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}))cerrarMenu()})

let datosTarjeta={sesiones:[],reuniones:[]}
function ubicarFranjaFoco(){$('foco-franja').style.left=Math.max(64-x,Math.min(ANCHO_GATO/2,ancho-64-x))+'px'}

function ubicarGlobo(nodo){const mitad=(nodo.getBoundingClientRect().width||nodo.offsetWidth)/2+4;nodo.style.left=Math.max(mitad-x,Math.min(ANCHO_GATO/2,ancho-mitad-x))+'px'}

$('cuenco-pedido').onclick=darDeComer
$('cuenco-pedido').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();darDeComer()}}
function abrirAjustes(){
 cerrarMenu();const tarjeta=$('ajustes-gato');tarjeta.hidden=false
 $('ajustes-nombre').value=gatito.nombre||'Michi';$('ajustes-pausas').checked=gatito.autonomia?.pausas!==false;$('ajustes-solo-hoy').checked=configCentro.fuentes?.reuniones?.soloHoy===true
 for(const b of $('ajustes-colores').children)b.setAttribute('aria-pressed',b.dataset.color===gatito.color)
 ubicarGlobo(tarjeta);api.menuRapido(true);hacerTocable(true);$('ajustes-nombre').focus?.()
}
$('ajustes-nombre').onchange=()=>api.cuidarGatito('nombre',$('ajustes-nombre').value)
$('ajustes-pausas').onchange=()=>api.cuidarGatito('pausas',$('ajustes-pausas').checked)
$('ajustes-solo-hoy').onchange=()=>api.cambiarConfig({'fuentes.reuniones.soloHoy':$('ajustes-solo-hoy').checked})
$('ajustes-cerrar').onclick=()=>{cerrarMenu();abrirMenu()}
for(const color of ['negro','gris','naranja','crema','siames','atigrado']){
 const b=document.createElement('button');b.className='pelaje-'+color;b.dataset.color=color;b.setAttribute('aria-label',color);b.onclick=()=>api.cuidarGatito('color',color);$('ajustes-colores').append(b)
}
