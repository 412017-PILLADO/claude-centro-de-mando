// La vida del gatito usa tiempo real, con un día de tope por actualización.
const fs = require('node:fs')
const path = require('node:path')
const COLORES = ['negro', 'gris', 'naranja', 'crema', 'siames', 'atigrado']
const limitar = n => Math.max(0, Math.min(100, n))
const COMIDAS = { croquetas: { saciedad: 25, energia: 3, carino: 2 }, pescado: { saciedad: 40, energia: 5, carino: 5 }, leche: { saciedad: 15, energia: 2, carino: 3 } }
const ESPERA = 4500
const entero = n => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
function recuerdos(d, ahora) {
  const creado = Number.isFinite(d.creado) ? Math.min(ahora, d.creado) : ahora
  const cuidados = Object.fromEntries(['comidas','juegos','mimos'].map(k => [k, entero(d.cuidados?.[k])]))
  const diario = Array.isArray(d.diario) ? d.diario.filter(m => m && typeof m.id === 'string' && typeof m.texto === 'string' && Number.isFinite(m.fecha)).slice(-24) : []
  const registrar = (id,texto) => { if (!diario.some(m=>m.id===id)) diario.push({id,texto,fecha:ahora}) }
  registrar('bienvenida','Un hogar y alguien con quien compartirlo.')
  return {foco:require('./foco').normalizar(d.foco),version:4,creado,cuidados,diario:diario.filter(m=>!m.id.startsWith('accesorio-')).slice(-24),
    favorita:Object.hasOwn(COMIDAS,d.favorita)?d.favorita:Object.keys(COMIDAS)[Math.floor(Math.random()*3)],
    ultimaComida:entero(d.ultimaComida),ultimoSueno:entero(d.ultimoSueno),esperaHasta:entero(d.esperaHasta),
    autonomia: require('./rutina').normalizar(d.autonomia),
    rasgos: Object.fromEntries(['jugueton','dormilon','mimoso','gloton'].map(k=>[k,limitar(Number(d.rasgos?.[k])||0)])),
    aburrimiento: limitar(Number(d.aburrimiento)||0),
    resultado:d.resultado && typeof d.resultado.texto==='string'?d.resultado:null}
}

function actualizar(datos, ahora = Date.now()) {
  const d = datos && typeof datos === 'object' ? datos : {}
  const desde=Number.isFinite(d.actualizado)?d.actualizado:ahora
  const pausa=d.foco?.fase==='foco'?Math.max(0,Math.min(ahora,d.foco.hasta)-Math.max(desde,d.foco.desde)):0
  const horas=Math.min(24,Math.max(0,(ahora-desde-pausa)/3600000))
  const nivel = clave => Number.isFinite(d[clave]) ? limitar(d[clave]) : 80
  const dormido = Number.isFinite(d.duermeHasta) ? d.duermeHasta : 0
  const descanso = Math.min(horas, Math.max(0, (Math.min(ahora, dormido) - (ahora - horas * 3600000)) / 3600000))
  return {
    ...recuerdos(d, ahora),
    nombre: typeof d.nombre === 'string' && d.nombre.trim() ? d.nombre.trim().slice(0, 30) : 'Michi',
    color: COLORES.includes(d.color) ? d.color : 'negro',
    saciedad: limitar(nivel('saciedad') - horas * 8),
    energia: limitar(nivel('energia') - (horas - descanso) * 5 + descanso * 35),
    carino: limitar(nivel('carino') - horas * 100 / 12),
    aburrimiento: limitar((Number(d.aburrimiento)||0)+horas*18),
    duermeHasta: dormido,
    siestaHasta: Number.isFinite(d.siestaHasta) ? d.siestaHasta : 0,
    actualizado: ahora,
  }
}

// Lo que avanza solo (hambre, energía) se guarda como mucho cada minuto; lo que hace la persona, al instante.
const GUARDAR_CADA_MS = 60_000

function crearVida(carpeta, reloj = Date.now) {
  const archivo = path.join(carpeta, 'gatito.json')
  let datos
  try { datos = JSON.parse(fs.readFileSync(archivo, 'utf8')) } catch { datos = null }
  let guardadoEn = -Infinity
  const guardar = () => {
    fs.mkdirSync(carpeta, { recursive: true })
    fs.writeFileSync(archivo + '.tmp', JSON.stringify(datos, null, 2) + '\n')
    fs.renameSync(archivo + '.tmp', archivo)
    guardadoEn = reloj()
    return { ...datos }
  }
  const guardarSiToca = () => (reloj() - guardadoEn >= GUARDAR_CADA_MS ? guardar() : { ...datos })
  datos = actualizar(datos, reloj())
  guardar()
  return {
    leer() { datos = actualizar(datos, reloj()); return guardarSiToca() },
    observar(contexto) {datos=actualizar(datos,reloj()); const eventosFoco=require('./foco').avanzar(datos,reloj()); const eventos=datos.foco?.fase==='foco'?eventosFoco:[...eventosFoco,...require('./rutina').observar(datos,reloj(),contexto)];guardarSiToca();return {datos:{...datos},eventos}},
    // Al cerrar la app, para no perder el último minuto.
    guardar,
    actuar(accion, valor) {
      datos = actualizar(datos, reloj())
      const ahora = reloj(), antes = {...datos}
      if(accion==='foco-iniciar'){const minutos=Number(valor)===50?50:25;datos.foco={fase:'foco',desde:ahora,hasta:ahora+minutos*60000,minutos};datos.duermeHasta=datos.siestaHasta=0;return guardar()}
      if(accion==='foco-cancelar'){datos.foco=null;return guardar()}
      if(accion==='conducta-hecha'){if(valor==='mimar')datos.carino=limitar(datos.carino+12);if(valor==='jugar')datos.aburrimiento=limitar(datos.aburrimiento-45);return guardar()}
      const cuidado = Object.hasOwn(COMIDAS,accion) || ['mimar','jugar','raton','caja','siesta','rascar'].includes(accion)
      if(cuidado && datos.foco?.fase==='foco'){datos.resultado={id:ahora,aceptado:false,texto:'Estamos en foco. Los cuidados esperan.',esperaHasta:0};return guardar()}
      if(cuidado && ahora < datos.esperaHasta){datos.resultado={id:ahora,aceptado:false,texto:'Un segundito, ya voy.',esperaHasta:datos.esperaHasta};return guardar()}
      if(Object.hasOwn(COMIDAS,accion) && (datos.saciedad>=95 || (datos.saciedad>=85 && ahora-datos.ultimaComida<20*60000))){datos.resultado={id:ahora,aceptado:false,texto:'Estoy llenito. Guardamos un poquito para después.',esperaHasta:ahora+1500};datos.esperaHasta=ahora+1500;return guardar()}
      if(cuidado) {datos.esperaHasta=ahora+ESPERA;const rasgo=Object.hasOwn(COMIDAS,accion)?'gloton':accion==='siesta'?'dormilon':accion==='mimar'?'mimoso':'jugueton';datos.rasgos[rasgo]=limitar(datos.rasgos[rasgo]+.4)}
      if(accion==='pausas')datos.autonomia.pausas=valor!==false
      if(accion==='pausa-respuesta'){datos.autonomia.proximaPausa=ahora+(valor==='dale'?90:15)*60000;if(valor==='dale')datos.autonomia.continuaDesde=ahora}
      if (accion === 'nombre' && typeof valor === 'string') datos.nombre = valor.trim().slice(0, 30) || 'Michi'
      if (accion === 'color' && COLORES.includes(valor)) datos.color = valor
      const comida = COMIDAS[accion]
      if (comida) {
        for(const k of ['saciedad','energia','carino'])datos[k]=limitar(datos[k]+comida[k]+(k==='carino'&&accion===datos.favorita?8:0))
        datos.ultimaComida=ahora;datos.cuidados.comidas++
        datos.autonomia.hambre=false;datos.autonomia.intentos=0;datos.autonomia.pedirDesde=ahora+45*60000
        if(!datos.diario.some(m=>m.id==='comida-'+accion))datos.diario.push({id:'comida-'+accion,fecha:ahora,texto:`Probamos ${accion} por primera vez. ${accion===datos.favorita?'¡Mi comida favorita!':{croquetas:'Qué rico.',pescado:'Me gustó.',leche:'Rico rico.'}[accion]}`})
      }
      if(['raton','caja'].includes(accion)) { datos.carino=limitar(datos.carino+15);datos.energia=limitar(datos.energia-10);datos.siestaHasta=datos.duermeHasta=0 }
      if(['jugar','raton','caja'].includes(accion)){datos.cuidados.juegos++;datos.aburrimiento=limitar(datos.aburrimiento-45)}
      if(accion==='mimar')datos.cuidados.mimos++
      if (accion === 'mimar' || accion === 'jugar') datos.carino = limitar(datos.carino + (accion === 'mimar' ? 20 : 15))
      if (accion === 'jugar') { datos.energia = limitar(datos.energia - 12); datos.siestaHasta = datos.duermeHasta = 0 }
      if (accion === 'siesta') { datos.siestaHasta = ahora + 30 * 60000; datos.ultimoSueno=ahora }
      if (accion === 'descanso') {
        if(valor && datos.duermeHasta<=ahora)datos.ultimoSueno=ahora
        datos.duermeHasta = valor ? Math.max(datos.siestaHasta, reloj() + 60000) : 0

      }
      datos=actualizar(datos,ahora)
      if(cuidado)datos.resultado={id:ahora,aceptado:true,accion,favorita:!!comida&&accion===datos.favorita,
        texto:comida&&accion===datos.favorita?['¡Mi favorita! Prrr…','¡Esto sí que me gusta!','Mmm, mi comida preferida.'][(datos.cuidados.comidas-1)%3]:'Qué lindo este ratito.',
        cambios:Object.fromEntries(['saciedad','energia','carino'].map(k=>[k,Math.round(datos[k]-antes[k])])),esperaHasta:datos.esperaHasta}
      return guardar()
    },
  }
}
module.exports = { actualizar, crearVida, COMIDAS, ESPERA }
