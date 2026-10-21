// Necesidades y jornada: reloj inyectable, sin depender de Electron ni del renderer.
const MIN=60000, DIA=86400000
const fecha=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function normalizar(valor){
 const a=valor&&typeof valor==='object'?valor:{}
 const dia=v=>typeof v==='string'?v.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/,(_,a,m,d)=>`${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`):''
 const n=k=>Number.isFinite(a[k])?Math.max(0,a[k]):0
 return {pausas:a.pausas!==false,ultimoDia:dia(a.ultimoDia),racha:n('racha'),ultimaVisita:n('ultimaVisita'),saludo:dia(a.saludo),despedida:dia(a.despedida),inicio:n('inicio')||9,fin:n('fin')||18,
 continuaDesde:n('continuaDesde'),ultimaObservacion:n('ultimaObservacion'),proximaPausa:n('proximaPausa'),hambre:a.hambre===true,intentos:n('intentos'),pedirDesde:n('pedirDesde'),proximoPropio:n('proximoPropio'),sueno:a.sueno===true,mimos:a.mimos===true,juego:a.juego===true,ultimaConducta:a.ultimaConducta||'',ultimoFin:dia(a.ultimoFin),festejos:Array.isArray(a.festejos)?a.festejos.filter(x=>typeof x==='string').slice(-20):[]}
}
function probabilidades(r={}){return {jugar:.25+(r.jugueton||0)/200,mimar:.25+(r.mimoso||0)/200,dormir:.25+(r.dormilon||0)/200,rascar:.15+(r.jugueton||0)/400,hambre:25+(r.gloton||0)/20}}
function observar(d,ahora,c={}){
 const a=d.autonomia=normalizar(d.autonomia), eventos=[],h=new Date(ahora).getHours(),hoy=fecha(ahora),p=probabilidades(d.rasgos)
 const libre=!c.reunion&&!c.alerta, activo=c.trabajando||c.inactivoSeg<300
 const emitir=(tipo,extra={})=>eventos.push({id:tipo+':'+ahora,tipo,...extra})
 // Una pausa real de cinco minutos o una app cerrada cortan el tramo continuo.
 if(!activo || (a.ultimaObservacion&&ahora-a.ultimaObservacion>2*MIN))a.continuaDesde=0
 if(activo){
  if(!a.continuaDesde)a.continuaDesde=ahora
  if(a.ultimoDia!==hoy){a.racha=a.ultimaVisita&&fecha(ahora-DIA)===a.ultimoDia?a.racha+1:1;a.ultimoDia=hoy;a.inicio=a.inicio*.8+(h+new Date(ahora).getMinutes()/60)*.2}
  a.ultimaVisita=ahora
 }
 a.ultimaObservacion=ahora
 if(libre&&activo&&h>=5&&h<12&&a.saludo!==hoy){a.saludo=hoy;emitir('saludo',{texto:'¡Buen día!'})}
 const horaActual=h+new Date(ahora).getMinutes()/60,umbralFin=Math.max(16,a.fin-.25)
 if(libre&&horaActual>=umbralFin&&activo&&a.despedida!==hoy){a.despedida=hoy;emitir('despedida',{texto:d.rasgos.dormilon>25?'Se me cierran los ojitos. Hasta mañana.':'Hasta mañana, descansá.'})}
 // Aprender el último uso real, separado de la despedida.
 if(h>=Math.max(16,Math.floor(a.fin)-1)&&c.inactivoSeg>=600&&a.ultimoFin!==hoy){const fin=new Date(ahora-c.inactivoSeg*1000);a.fin=a.fin*.8+(fin.getHours()+fin.getMinutes()/60+fin.getSeconds()/3600)*.2;a.ultimoFin=hoy}
 const dias=Math.floor((ahora-d.creado)/DIA),nacio=new Date(d.creado),actual=new Date(ahora)
 const hitos=[[dias>=7,'semana','¡Una semana juntos!'],[dias>=30,'mes','¡Un mes juntos!'],[actual.getFullYear()>nacio.getFullYear()&&actual.getMonth()===nacio.getMonth()&&actual.getDate()===nacio.getDate(),'cumple-'+actual.getFullYear(),'¡Hoy es mi cumple!']]
 if(libre&&activo){const hito=hitos.slice().reverse().find(([si])=>si);if(hito){const [,id,texto]=hito;if(id!=='semana'&&!a.festejos.includes('semana'))a.festejos.push('semana');if(id.startsWith('cumple-')&&!a.festejos.includes('mes'))a.festejos.push('mes');if(!a.festejos.includes(id)){a.festejos.push(id);d.diario.push({id:'aniversario-'+id,texto,fecha:ahora});d.diario=d.diario.slice(-24);emitir('festejo',{texto})}}}
 if(libre&&a.pausas&&a.continuaDesde&&ahora-a.continuaDesde>=90*MIN&&ahora>=a.proximaPausa){a.proximaPausa=ahora+90*MIN;emitir('pausa',{texto:'¿Nos estiramos un toque?'})}
 if(d.saciedad>=45){if(a.hambre||ahora>=a.pedirDesde)a.pedirDesde=0;a.hambre=false;a.intentos=0}
 if(d.saciedad<p.hambre&&ahora>=a.pedirDesde)a.hambre=true
 if(libre&&d.duermeHasta<=ahora&&a.hambre&&ahora>=a.pedirDesde){a.intentos++;a.pedirDesde=ahora+Math.min(120,10*2**Math.min(4,a.intentos-1))*MIN;emitir('hambre')}
 if(d.energia<22)a.sueno=true
 if(d.energia>=75)a.sueno=false
 if(d.carino<30)a.mimos=true
 if(d.carino>=55)a.mimos=false
 if(d.aburrimiento>=60)a.juego=true
 if(d.aburrimiento<=20)a.juego=false
 if(libre&&!c.panel&&d.duermeHasta<=ahora&&ahora>=a.proximoPropio){
  let tipo=a.sueno?'dormir':a.mimos?'mimar':a.juego?'jugar':null
  if(!tipo&&activo&&!c.trabajando&&c.azar!==undefined){const r=c.azar*(p.jugar+p.mimar+p.dormir+p.rascar);tipo=r<p.jugar?'jugar':r<p.jugar+p.mimar?'mimar':r<p.jugar+p.mimar+p.dormir?'dormir':'pasear'}
  if(tipo){a.proximoPropio=ahora+5*MIN;a.ultimaConducta=tipo;const rasgo={dormir:'dormilon',mimar:'mimoso',jugar:'jugueton'}[tipo];if(rasgo)d.rasgos[rasgo]=Math.min(100,d.rasgos[rasgo]+.15);emitir(tipo)}
 }
 return eventos
}
module.exports={normalizar,observar,probabilidades,fecha}
