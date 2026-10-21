const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { actualizar, crearVida } = require('../src/gatito')

const hora = 3600000, ahora = 1800000000000
const lleno = { saciedad: 100, energia: 100, carino: 100, actualizado: ahora }
assert.equal(actualizar(lleno, ahora + 12.5 * hora).saciedad, 0)
assert.equal(actualizar(lleno, ahora + 8 * hora).saciedad, 36)
assert.equal(actualizar(lleno, ahora + 12 * hora).carino, 0)
assert.equal(actualizar({ ...lleno, energia: 0, duermeHasta: ahora + hora }, ahora + hora).energia, 35)
assert.equal(actualizar(lleno, ahora - hora).saciedad, 100)
assert.equal(actualizar(lleno, ahora + 1000 * hora).saciedad, 0)
assert.equal(actualizar({ ...lleno, energia: 0, duermeHasta: ahora + 977 * hora }, ahora + 1000 * hora).energia, 0)
assert.equal(actualizar({ ...lleno, saciedad: Infinity, energia: -200, carino: 'no' }, ahora).energia, 0)
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'centro-gatito-'))
let tiempo = ahora
let vida = crearVida(carpeta, () => tiempo)
assert.equal(vida.leer().nombre, 'Michi')
vida.actuar('nombre', 'Ñoqui')
vida.actuar('color', 'naranja')
tiempo += 4 * hora
assert.equal(vida.leer().saciedad, 48)
assert.equal(vida.actuar('croquetas').saciedad, 73)
assert.equal(vida.actuar('pescado').resultado.aceptado, false, 'la espera también rige fuera de la UI')
tiempo += 4500
assert.ok(vida.actuar('pescado').saciedad > 94)
tiempo += 4500
assert.equal(vida.actuar('leche').resultado.aceptado, false, 'lleno rechaza sin consumir la comida')
assert.equal(vida.actuar('color', 'inexistente').color, 'naranja')
const energia = vida.leer().energia
tiempo += 4500
assert.ok(Math.abs(vida.actuar('jugar').energia-(energia-12))<.01)
tiempo += 4500
vida.actuar('siesta')
vida.actuar('descanso', true)
tiempo += hora / 2
assert.ok(Math.abs(vida.leer().energia-(energia-12+17.5))<.03)
vida = crearVida(carpeta, () => tiempo)
assert.equal(vida.leer().nombre, 'Ñoqui')
assert.equal(vida.leer().color, 'naranja')
fs.writeFileSync(path.join(carpeta, 'gatito.json'), '{roto')
assert.equal(crearVida(carpeta, () => tiempo).leer().nombre, 'Michi')
assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(carpeta, 'gatito.json'), 'utf8')))
console.log('Vida verificada: decaimiento, sueño, límites, acciones, persistencia y archivo corrupto.')
console.log('Datos de prueba:', carpeta)

// La máquina usa el mismo reloj que el renderer: ninguna prueba espera tiempo real.
const { crearMaquina, ciclos } = require('../src/ui/comportamiento')
let maquina = crearMaquina(), reloj = 0
maquina.pedir('comer', 3); maquina.pedir('sesion', 4); maquina.pedir('reunion', 5)
for (const estado of ['reunion', 'sesion', 'comer']) {
  const accion = maquina.paso(reloj, {panel:true, trabajando:true})
  assert.equal(accion.estado, estado)
  assert.equal(accion.poseFinal, estado === 'comer' ? 'agazapado' : 'sentado')
  assert.equal(maquina.paso(reloj+1).estado, estado, 'no corta la secuencia')
  reloj = accion.hasta
}
assert.equal(maquina.paso(reloj, {trabajando:true}).estado, 'pensar')
maquina = crearMaquina()
for (let i=0;i<100;i++) {
  const accion = maquina.paso(i * 10000, {trabajando:true, panel:true, hambre:true, energia:0})
  assert.equal(accion.estado, 'pensar')
  assert.ok(accion.cuadros.every(([n]) => !/caminar|correr|tablet|espaldas/.test(n)))
}
for (const estado of ['comer','mimar','jugar','siesta']) {
  maquina = crearMaquina(); maquina.pedir(estado,3)
  assert.ok(maquina.paso(0,{panel:true}).cuadros.every(([n])=>!n.startsWith('espaldas')))
}
for (const cuadros of Object.values(ciclos)) assert.ok(cuadros.every(([n])=>n !== 'tablet'))
assert.equal(ciclos.pensar.reduce((s,c)=>s+c[1],0),20000)
assert.ok(require('../src/ui/comportamiento').camino('cayendo','sentado').flatMap(t=>t.cuadros).some(([n])=>n==='aterrizar1'))
assert.ok(require('../src/ui/comportamiento').camino('cayendo','sentado').flatMap(t=>t.cuadros).some(([n])=>n==='aterrizar2'))
for (const color of ['siames','atigrado']) assert.equal(vida.actuar('color',color).color,color)
const {elegirMonitor, ubicarPanel} = require('../src/monitores')
const displays = [
 {id:1,workArea:{x:0,y:0,width:1920,height:1040}},
 {id:2,workArea:{x:-1280,y:-200,width:1280,height:960}},
 {id:3,workArea:{x:1920,y:0,width:800,height:600}},
]
assert.equal(elegirMonitor(displays,'2',displays[0]).id,2)
assert.equal(elegirMonitor(displays,99,displays[0]).id,1)
assert.equal(elegirMonitor(displays.slice(1),1,displays[1]).id,2)
for (const {workArea:area} of displays) for (const offset of [64,150,area.width/2,area.width-64]) {
 const centro=area.x+offset, panel=ubicarPanel(area,centro,1080)
 assert.ok(panel.x >= area.x && panel.x+panel.width <= area.x+area.width)
 assert.ok(panel.x+panel.width <= centro-51 || panel.x >= centro+51, 'no tapa al gato')
}
console.log('Máquina y monitores verificados: prioridades, cierre sentado, cuidados visibles, trabajo sin paseos, sin tablet, dos aterrizajes y respaldo de monitor.')

// Cancelar corta el pedido actual y conserva su extremo para el siguiente camino.
{
 const m=crearMaquina();m.pedir('croquetas',3,'cancelar-actual')
 const anterior=m.paso(0,{energia:80});m.cancelar('cancelar-actual');m.pedir('saludo',3,'siguiente')
 const siguiente=m.paso(1,{energia:80})
 assert.equal(siguiente.id,'siguiente');assert.equal(siguiente.poseInicial,anterior.poseFinal)
 m.pedir('festejo',3,'cancelar-cola');m.cancelar('cancelar-cola');assert.ok(!m.pendientes().includes('festejo'))
 console.log('Cancelación actual y pendiente con continuidad de pose: OK.')
}
// Todos los pares, con continuidad de cada tramo y extremos declarados.
const {poses,animaciones,camino,SUENO_MINIMO}=require('../src/ui/comportamiento')
for(const de of poses)for(const a of poses){let pose=de;for(const t of camino(de,a)){assert.equal(t.de,pose);pose=t.a}assert.equal(pose,a)}
for(const [a,metaA] of Object.entries(animaciones))for(const [b,metaB] of Object.entries(animaciones)){
 const m=crearMaquina();m.reiniciar(metaA.fin);m.pedir(b,4)
 const accion=m.paso(0,{energia:80});let pose=metaA.fin
 for(const t of accion.tramos){assert.equal(t.de,pose,a+' ? '+b);if(t.de!==t.a)assert.equal(t.tipo,'transicion');pose=t.a}
 assert.equal(pose,accion.variante==='giro-sentado'?metaA.fin:animaciones[accion.variante||b].fin)
}
// Ocho horas: recupera energ?a sin entrar en un bucle de siestas cortas.
maquina=crearMaquina();let energiaSueno=15,entradas=0,antesDormido=false,desde=0
for(let t=0;t<8*hora;t+=1000){
 const accion=maquina.paso(t,{energia:energiaSueno,panel:true});const dormido=maquina.durmiendo()
 if(dormido&&!antesDormido){entradas++;desde=t}
 if(!dormido&&antesDormido)assert.ok(t-desde>=SUENO_MINIMO)
 energiaSueno=Math.max(0,Math.min(100,energiaSueno+(dormido?35:-5)/3600));antesDormido=dormido
 assert.ok(!accion.cuadros.some(([n])=>['sueno','durmiendo','bolita'].includes(n)))
}
assert.equal(entradas,1)
maquina=crearMaquina();maquina.pedir('reunion',5)
assert.equal(maquina.paso(0,{energia:0}).estado,'reunion','un aviso pendiente gana al sueño')
maquina=crearMaquina();maquina.pedir('siesta',3)
const primeraSiesta=maquina.paso(0,{energia:80})
assert.equal(primeraSiesta.estado,'dormir')
maquina.paso(primeraSiesta.hasta,{energia:80,siesta:true})
assert.deepEqual(maquina.pendientes(),[],'el pedido de siesta se consume una sola vez')
maquina.despertar()
assert.notEqual(maquina.paso(20000,{energia:80}).estado,'dormir','un clic despierta incluso antes del mínimo')
maquina=crearMaquina();maquina.paso(0,{energia:0});maquina.paso(2000,{energia:0});maquina.pedir('reunion',5,'alerta-real')
const finPreparacion=maquina.paso(2000,{energia:0}).hasta
assert.equal(maquina.paso(finPreparacion,{energia:0}).estado,'reunion')
assert.equal(maquina.durmiendo(),false)
assert.ok(maquina.paso(finPreparacion+1,{energia:0}).tramos.some(t=>t.de==='acostado'&&t.a==='parado'))
const {crearCaida,pasoCaida}=require('../src/caida')
for(const display of displays){const piso=display.workArea.y+display.workArea.height-340,c=crearCaida(piso-500,piso,0);let anterior=c.y
 for(let t=0;t<=2000;t+=16){const paso=pasoCaida(c,t);assert.ok(paso.y>=anterior);assert.ok(paso.y<=piso);anterior=paso.y}
 assert.equal(pasoCaida(c,2000).y,piso);assert.equal(pasoCaida(c,2000).termino,true)
 assert.ok(pasoCaida(c,300).y>c.origen&&pasoCaida(c,300).y<piso)
}
console.log('Grafo completo, continuidad entre animaciones, ocho horas de sueño, alerta real y gravedad en tres monitores: OK.')

// Cuarta tanda: migramos un archivo real, no sólo objetos armados en memoria.
const archivoVida=path.join(carpeta,'gatito.json')
fs.writeFileSync(archivoVida,JSON.stringify({nombre:'Mora',color:'gris',saciedad:20,energia:40,carino:30,actualizado:tiempo}))
vida=crearVida(carpeta,()=>tiempo)
let migrada=vida.leer()
assert.equal(migrada.version,4);assert.equal(migrada.nombre,'Mora');assert.equal(migrada.color,'gris')
assert.equal(migrada.saciedad,20);assert.ok(['croquetas','pescado','leche'].includes(migrada.favorita))
assert.equal(Object.hasOwn(migrada,'muebles'),false)
const favorita=migrada.favorita
assert.equal(crearVida(carpeta,()=>tiempo).leer().favorita,favorita)
const antesFavorita=vida.leer(),conFavorita=vida.actuar(favorita)
assert.equal(conFavorita.resultado.favorita,true)
assert.equal(conFavorita.carino-antesFavorita.carino,require('../src/gatito').COMIDAS[favorita].carino+8)
assert.ok(conFavorita.diario.some(m=>m.id==='comida-'+favorita))
assert.equal(vida.actuar('pescado').resultado.aceptado,false)
assert.equal(vida.leer().cuidados.comidas,1)
// No hay desbloqueos ligados a sesiones, tickets o plata.
for(let i=0;i<2;i++){tiempo+=4*hora;vida.actuar('croquetas')}
for(let i=0;i<5;i++){tiempo+=5000;vida.actuar(['jugar','raton','caja'][i%3])}
tiempo+=3*24*hora
for(let i=0;i<2;i++){tiempo+=5000;vida.actuar('mimar')}
fs.writeFileSync(archivoVida,JSON.stringify({...vida.leer(),muebles:{cama:true,rascador:true},accesorio:'collar',desbloqueados:['collar'],diario:[{id:'accesorio-collar',texto:'Viejo desbloqueo',fecha:tiempo}]}))
vida=crearVida(carpeta,()=>tiempo)
for(const k of ['muebles','accesorio','desbloqueados'])assert.equal(Object.hasOwn(vida.leer(),k),false)
assert.ok(!vida.leer().diario.some(m=>m.id.startsWith('accesorio-')))
assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(archivoVida,'utf8')),'muebles'),false)
for(const nombre of ['croquetas','pescado','leche','raton','caja','rascar']){
 assert.ok(ciclos[nombre].length>=4)
 assert.ok(ciclos[nombre].every(([n])=>n.startsWith(nombre==='rascar'?'pared':nombre)),nombre+' tiene dibujos propios')
 const m=crearMaquina();m.reiniciar('acostado');m.pedir(nombre,3)
 const a=m.paso(0,{energia:80});assert.ok(poses.includes(a.poseFinal));assert.equal(a.poseFinal,animaciones[nombre].fin)
 assert.equal(a.tramos[0].de,'acostado')
 for(const [n] of a.cuadros)assert.ok(fs.existsSync(path.join(__dirname,'../src/ui/sprites',n+'.png')),n)
}
// Regresiones de hambre, jornada, hitos y fechas, con reloj local controlado.
{
 const {observar,fecha,normalizar}=require('../src/rutina')
 const min=60000,dia=24*hora,t=new Date(2026,0,2,17).getTime(),c={inactivoSeg:0}
 const base=extra=>actualizar({saciedad:80,energia:80,carino:80,creado:t,...extra},t)
 assert.equal(fecha(t),'2026-01-02')
 for(const campo of ['ultimoDia','saludo','despedida','ultimoFin'])assert.equal(normalizar({[campo]:'2026-1-2'})[campo],'2026-01-02')
 let d=base({autonomia:{ultimoDia:'2026-1-1',ultimaVisita:t-dia,racha:4}})
 observar(d,t,c);assert.equal(d.autonomia.racha,5)
 d=base({autonomia:{ultimoDia:'2026-1-2',ultimaVisita:t,racha:5,despedida:'2026-1-2'}})
 assert.ok(!observar(d,t,c).some(e=>e.tipo==='despedida'));assert.equal(d.autonomia.racha,5)
 d=base();assert.ok(!observar(d,t+44*min,c).some(e=>e.tipo==='despedida'))
 assert.ok(observar(d,t+45*min,c).some(e=>e.tipo==='despedida'));assert.equal(d.autonomia.fin,18)
 assert.ok(!observar(d,t+46*min,c).some(e=>e.tipo==='despedida'))
 d=base();assert.ok(!observar(d,t+30*min,{inactivoSeg:1200}).some(e=>e.tipo==='despedida'))
 assert.ok(Math.abs(d.autonomia.fin-(18*.8+(17+10/60)*.2))<1e-9)
 const fin=d.autonomia.fin;observar(d,t+60*min,{inactivoSeg:1200});assert.equal(d.autonomia.fin,fin)
 for(const edad of [30,31]){
  d=base({creado:t-edad*dia});assert.equal(observar(d,t,c).filter(e=>e.tipo==='festejo').length,1)
  assert.ok(d.autonomia.festejos.includes('semana')&&d.autonomia.festejos.includes('mes'))
  assert.ok(!d.diario.some(e=>e.id==='aniversario-semana'))
  assert.ok(!observar(d,t+min,c).some(e=>e.tipo==='festejo'))
 }
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gatito-gracia-'));let reloj=t
 try{
  for(const [comida,saciedad] of [['leche',0],['pescado',30]]){
   fs.writeFileSync(path.join(dir,'gatito.json'),JSON.stringify(base({saciedad,favorita:comida,autonomia:{hambre:true,intentos:4}})))
   reloj=t;const v=crearVida(dir,()=>reloj),comido=v.actuar(comida)
   assert.equal(comido.autonomia.hambre,false);assert.equal(comido.autonomia.intentos,0);assert.equal(comido.autonomia.pedirDesde,t+45*min)
   assert.equal(comido.diario.find(e=>e.id==='comida-'+comida).texto,'Probamos '+comida+' por primera vez. ¡Mi comida favorita!')
   reloj=t+44*min;const visto=v.observar(c)
   assert.ok(!visto.eventos.some(e=>e.tipo==='hambre'));assert.equal(visto.datos.autonomia.pedirDesde,t+45*min)
   if(comida==='leche'){reloj=t+45*min;assert.ok(v.observar(c).eventos.some(e=>e.tipo==='hambre'))}
  }
  const frases=[]
  for(let i=0;i<3;i++){
   reloj=t
   fs.writeFileSync(path.join(dir,'gatito.json'),JSON.stringify(base({saciedad:0,favorita:'leche',cuidados:{comidas:i}})))
   frases.push(crearVida(dir,()=>reloj).actuar('leche').resultado.texto)
  }
  assert.equal(new Set(frases).size,3,'la favorita rota sus frases')
  for(const [comida,texto] of Object.entries({croquetas:'Qué rico.',pescado:'Me gustó.',leche:'Rico rico.'})){
   fs.writeFileSync(path.join(dir,'gatito.json'),JSON.stringify(base({saciedad:0,favorita:comida==='leche'?'pescado':'leche'})))
   const comido=crearVida(dir,()=>reloj).actuar(comida)
   assert.equal(comido.diario.find(e=>e.id==='comida-'+comida).texto,'Probamos '+comida+' por primera vez. '+texto)
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 console.log('Regresiones: gracia tras comer, despedida activa, fin real, hito unico, fechas y migracion: OK.')
}
const hashes=JSON.parse(fs.readFileSync(path.join(__dirname,'../arte/hashes-antes-pared.json'),'utf8'))
for(const {archivo,Hash} of hashes)assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../src/ui/sprites',archivo))).digest('hex').toUpperCase(),Hash,archivo)
for(const corrupto of ['null','[]','{"cuidados":null,"muebles":"roto","diario":[null,7],"desbloqueados":{}}','{"nombre":17,"creado":"ayer","favorita":"tornillos","saciedad":null}']){
 fs.writeFileSync(archivoVida,corrupto);const sana=crearVida(carpeta,()=>tiempo).leer();assert.equal(sana.version,4);assert.ok(Number.isFinite(sana.saciedad));assert.ok(Array.isArray(sana.diario))
}
console.log(`Cuarta tanda: comidas propias, favorita persistida, espera, lleno, retiro de accesorios, diario, retiro de muebles, migración y ${hashes.length} hashes viejos: OK.`)
// Quinta tanda: jornada y necesidades con reloj y azar controlados.
const {observar,probabilidades}=require('../src/rutina')
const minuto=60000,dia=24*hora,manana=new Date(2026,9,19,9).getTime()
const nueva=(extra={})=>actualizar({saciedad:80,energia:80,carino:80,creado:manana,...extra},manana)
const libre={inactivoSeg:0,trabajando:false,panel:false}
let d=nueva(), eventos=observar(d,manana,libre)
assert.equal(eventos.filter(e=>e.tipo==='saludo').length,1)
assert.equal(observar(d,manana+minuto,libre).some(e=>e.tipo==='saludo'),false)
d=actualizar(d,manana+minuto)
assert.equal(observar(d,manana+2*minuto,libre).some(e=>e.tipo==='saludo'),false,'reiniciar no repite el saludo')
assert.ok(observar(d,manana+dia,libre).some(e=>e.tipo==='saludo'))
assert.equal(d.autonomia.racha,2)
observar(d,manana+3*dia,libre);assert.equal(d.autonomia.racha,1,'un día sin venir corta la racha')
d=nueva({energia:10});assert.ok(observar(d,manana,libre).some(e=>e.tipo==='dormir'));assert.equal(d.autonomia.sueno,true)
d.energia=50;observar(d,manana+minuto,libre);assert.equal(d.autonomia.sueno,true)
d.energia=75;observar(d,manana+2*minuto,libre);assert.equal(d.autonomia.sueno,false)
d=nueva({saciedad:10});assert.ok(observar(d,manana,libre).some(e=>e.tipo==='hambre'))
assert.equal(d.autonomia.pedirDesde-manana,10*minuto)
assert.ok(!observar(d,manana+minuto,libre).some(e=>e.tipo==='hambre'))
assert.ok(observar(d,manana+10*minuto,libre).some(e=>e.tipo==='hambre'));assert.equal(d.autonomia.pedirDesde-manana,30*minuto)
for(const c of [{reunion:true},{alerta:true}])assert.equal(observar(d,manana+31*minuto,{...libre,...c}).some(e=>['hambre','pausa','saludo','festejo'].includes(e.tipo)),false)
assert.ok(observar(d,manana+32*minuto,libre).some(e=>e.tipo==='hambre'));assert.equal(d.autonomia.pedirDesde-(manana+32*minuto),40*minuto)
d.saciedad=45;observar(d,manana+33*minuto,libre);assert.equal(d.autonomia.intentos,0)
d=nueva();for(let m=0;m<90;m++)assert.equal(observar(d,manana+m*minuto,libre).some(e=>e.tipo==='pausa'),false)
assert.ok(observar(d,manana+90*minuto,libre).some(e=>e.tipo==='pausa'))
assert.ok(!observar(d,manana+91*minuto,libre).some(e=>e.tipo==='pausa'))
for(const restriccion of ['reunion','alerta']){d=nueva();for(let m=0;m<=90;m++)assert.equal(observar(d,manana+m*minuto,{...libre,[restriccion]:true}).some(e=>e.tipo==='pausa'),false);assert.ok(observar(d,manana+91*minuto,libre).some(e=>e.tipo==='pausa'))}
d=nueva();d.autonomia.pausas=false;for(let m=0;m<100;m++)assert.equal(observar(d,manana+m*minuto,libre).some(e=>e.tipo==='pausa'),false)
d=nueva();for(let m=0;m<80;m++)observar(d,manana+m*minuto,libre);observar(d,manana+80*minuto,{inactivoSeg:301});observar(d,manana+81*minuto,libre);assert.ok(!observar(d,manana+91*minuto,libre).some(e=>e.tipo==='pausa'))
d=nueva({carino:10});assert.ok(observar(d,manana,libre).some(e=>e.tipo==='mimar'));assert.ok(d.rasgos.mimoso>0);assert.equal(d.carino,10)
d=nueva({aburrimiento:80});assert.ok(observar(d,manana,libre).some(e=>e.tipo==='jugar'));assert.equal(d.aburrimiento,80)
const base=probabilidades({}),crecida=probabilidades({jugueton:100,mimoso:100,dormilon:100,gloton:100});for(const k of Object.keys(base))assert.ok(crecida[k]>base[k],k)
d=nueva();assert.equal(observar(d,manana,{...libre,azar:.29}).find(e=>['jugar','mimar','dormir','pasear'].includes(e.tipo)).tipo,'mimar')
d=nueva({rasgos:{jugueton:100}});assert.equal(observar(d,manana,{...libre,azar:.29}).find(e=>['jugar','mimar','dormir','pasear'].includes(e.tipo)).tipo,'jugar')
for(const dias of [7,30]){d=nueva({creado:manana-dias*dia});if(dias===30)d.autonomia.festejos=['semana'];assert.ok(observar(d,manana,libre).some(e=>e.tipo==='festejo'));assert.ok(d.diario.some(e=>e.id==='aniversario-'+(dias===7?'semana':'mes')))}
d=nueva({creado:new Date(2025,9,19,9).getTime()});d.autonomia.festejos=['semana','mes'];assert.ok(observar(d,manana,libre).some(e=>e.tipo==='festejo'));assert.ok(d.diario.some(e=>e.id==='aniversario-cumple-2026'))
d=nueva();const noche=new Date(2026,9,19,20).getTime();assert.ok(observar(d,noche,{inactivoSeg:0}).some(e=>e.tipo==='despedida'));assert.ok(!observar(d,noche+minuto,{inactivoSeg:601}).some(e=>e.tipo==='despedida'))
console.log('Quinta tanda: migración sin muebles, necesidades e histéresis, hambre con espera creciente, jornada, racha, aniversarios, pausas y probabilidades: OK.')
// La respuesta Después no reinicia los 90 minutos: se ofrece otra vez a los 15.
fs.writeFileSync(archivoVida,JSON.stringify(nueva()))
tiempo=manana;vida=crearVida(carpeta,()=>tiempo)
for(let m=0;m<=90;m++){tiempo=manana+m*minuto;vida.observar({...libre,trabajando:true})}
const tramo=vida.leer().autonomia.continuaDesde
vida.actuar('pausa-respuesta','despues');assert.equal(vida.leer().autonomia.continuaDesde,tramo)
for(let m=91;m<105;m++){tiempo=manana+m*minuto;assert.ok(!vida.observar({...libre,trabajando:true}).eventos.some(e=>e.tipo==='pausa'))}
tiempo=manana+105*minuto;assert.ok(vida.observar({...libre,trabajando:true}).eventos.some(e=>e.tipo==='pausa'))
vida.actuar('pausa-respuesta','dale');assert.equal(vida.leer().autonomia.continuaDesde,tiempo)
vida.actuar('pausas',false);assert.equal(crearVida(carpeta,()=>tiempo).leer().autonomia.pausas,false)
tiempo+=5000;const rasgoAntes=vida.leer().rasgos.mimoso
vida.actuar('mimar');assert.equal(vida.leer().rasgos.mimoso,rasgoAntes+.4)
vida.actuar('mimar');assert.equal(vida.leer().rasgos.mimoso,rasgoAntes+.4,'no progresa al rechazar por espera')
assert.equal(crearVida(carpeta,()=>tiempo).leer().rasgos.mimoso,rasgoAntes+.4)
d=nueva({duermeHasta:manana+hora,saciedad:0,energia:10,aburrimiento:100,carino:0})
assert.ok(!observar(d,manana,libre).some(e=>['hambre','dormir','jugar','mimar'].includes(e.tipo)),'las necesidades no cortan el sueño')
// La integración usa toda la reunión (también sin enlace), no sólo su aviso inicial.
const vm=require('node:vm'),mainFuente=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8')
let contextoObservado
const mainCtx=vm.createContext({Date:class extends Date{static now(){return manana}},Math,path,CENTRO:carpeta,mascotaLista:true,ventana:{isVisible:()=>false},powerMonitor:{getSystemIdleTime:()=>0},leerSesiones:()=>[{status:'working'},{status:'waiting',lastActivityAt:manana}],leerReuniones:()=>[{start:new Date(manana-20*minuto).toISOString(),end:new Date(manana+40*minuto).toISOString()}],leerJson:()=>[],errorReuniones:()=>null,config:()=>({get:()=>({})}),fuentesVisibles:()=>({sesiones:true,reuniones:true,tickets:true}),vida:{observar(c){contextoObservado=c;return {datos:{},eventos:[]}}}})
vm.runInContext(mainFuente.slice(mainFuente.indexOf('function armarEstado()'),mainFuente.indexOf('// --- reuniones')),mainCtx)
vm.runInContext('armarEstado()',mainCtx)
assert.equal(contextoObservado.reunion,true);assert.equal(contextoObservado.alerta,true);assert.equal(contextoObservado.trabajando,true)
console.log('Persistencia de rasgos y pausa, respuestas Dale/Después, respeto del sueño e integración de reunión completa: OK.')


// Las patitas llegan al borde del lienzo sin recortar el cuerpo.
const {leer:leerPared}=require('./png-puro.cjs')
for(const nombre of ['pared1','pared2','pared3','pared4']){
 const png=leerPared(path.join(__dirname,'../src/ui/sprites',nombre+'.png'))
 assert.equal(png.width,288);assert.equal(png.height,237)
 let derecha=-1,izquierda=288
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>40){derecha=Math.max(derecha,x);izquierda=Math.min(izquierda,x)}
 assert.equal(derecha,287,nombre+' toca la pared');assert.ok(izquierda>0,nombre+' conserva la cola')
}

// Sexta tanda: foco con reloj absoluto, reinicio, necesidades congeladas y avisos únicos.
{
 const carpetaFoco=fs.mkdtempSync(path.join(os.tmpdir(),'centro-foco-'))
 let t=ahora,v=crearVida(carpetaFoco,()=>t)
 v.actuar('foco-iniciar',50)
 const inicio=v.leer(),fin=inicio.foco.hasta
 t+=20*60000
 assert.equal(v.observar({}).eventos.length,0,'no hay pedidos de comida ni pausas durante foco')
 assert.equal(v.leer().saciedad,inicio.saciedad,'el foco congela las necesidades')
 assert.equal(v.actuar('mimar').resultado.aceptado,false)
 v=crearVida(carpetaFoco,()=>t)
 assert.equal(v.leer().foco.hasta,fin,'reiniciar conserva la fecha final')
 assert.equal(v.leer().foco.minutos,50)
 t=fin
 const descanso=v.observar({reunion:true,alerta:true})
 assert.equal(descanso.datos.foco.fase,'descanso')
 assert.ok(descanso.eventos.some(e=>e.tipo==='fin-foco'),'el descanso se avisa aun en reunión')
 assert.ok(!v.observar({reunion:true}).eventos.some(e=>e.tipo==='fin-foco'))
 v=crearVida(carpetaFoco,()=>t);t+=5*60000
 assert.ok(v.observar({}).eventos.some(e=>e.tipo==='fin-descanso'))
 assert.equal(v.leer().foco.fase,'listo')
 assert.ok(!v.observar({}).eventos.some(e=>e.tipo==='fin-descanso'))
 v.actuar('foco-iniciar',13);assert.equal(v.leer().foco.minutos,25,'duraciones no válidas usan 25')
 v.actuar('foco-cancelar');assert.equal(v.leer().foco,null)
 v.actuar('foco-iniciar',25);t+=40*60000;v=crearVida(carpetaFoco,()=>t)
 const vencido=v.observar({}).eventos
 assert.ok(vencido.some(e=>e.tipo==='fin-foco')&&vencido.some(e=>e.tipo==='fin-descanso'),'recupera fases vencidas con la app cerrada')
 fs.rmSync(carpetaFoco,{recursive:true,force:true})
 console.log('Sexta tanda: foco 25/50, necesidades, reinicio, vencimientos, avisos y cancelación: OK.')
}



{
 const antes=vida.leer()
 for(const tipo of ['mimar','jugar']){
  const previo=vida.leer(),hecho=vida.actuar('conducta-hecha',tipo)
  assert.equal(hecho.carino,tipo==='mimar'?Math.min(100,previo.carino+12):previo.carino)
  assert.equal(hecho.aburrimiento,tipo==='jugar'?Math.max(0,previo.aburrimiento-45):previo.aburrimiento)
  for(const k of ['cuidados','esperaHasta','resultado'])assert.deepEqual(hecho[k],previo[k])
 }
 const t=new Date(2026,9,20,17,34).getTime(),d=nueva({autonomia:{fin:17+50/60}})
 assert.ok(!observar(d,t,libre).some(e=>e.tipo==='despedida'))
 assert.ok(observar(d,t+minuto,libre).some(e=>e.tipo==='despedida'))
 console.log('Conductas realizadas sin cuidado y despedida quince minutos antes: OK.')
}

{
 const m=crearMaquina();m.pedir('dormir',3)
 const dormir=m.paso(0,{energia:10})
 assert.ok(dormir.cuadros.some(([n])=>n==='bostezo1'))
 assert.ok(dormir.cuadros.some(([n,ms])=>n==='parpadeo2'&&ms>=1000))
 assert.ok(dormir.cuadros.findIndex(([n])=>n==='bostezo1')<dormir.cuadros.findIndex(([n])=>n==='acostar1'))
 assert.ok(!m.paso(dormir.hasta,{energia:10}).cuadros.some(([n])=>n==='bostezo1'))
 const espaldas=crearMaquina();espaldas.pedir('espaldas',2);const e=espaldas.paso(0,{energia:80})
 assert.equal(e.poseFinal,'espaldas');espaldas.pedir('mimar',3)
 const mimo=espaldas.paso(e.hasta,{energia:80})
 assert.ok(mimo.tramos.some(t=>t.de==='espaldas'&&t.a==='sentado'))
 console.log('Necesidades por comportamiento: bostezo y cabeceo antes de dormir, vuelta desde espaldas y grafo: OK.')
}

{
 const m=crearMaquina();m.reiniciar('caminando');let t=0
 for(const variante of ['empujar','empujar','empujar']){m.pedir('hambre',4);const a=m.paso(t,{energia:80});assert.equal(a.variante,variante);assert.equal(a.poseFinal,animaciones[variante].fin);assert.ok(a.cuadros.some(([n])=>n===variante+'1'));for(let i=1;i<a.tramos.length;i++)assert.equal(a.tramos[i-1].a,a.tramos[i].de);t=a.hasta}
 const s=crearMaquina();s.reiniciar('caminando');s.pedir('dormir',4);const a=s.paso(0,{energia:10});assert.ok(a.cuadros.some(([n])=>n==='cabecear3'));assert.ok(a.cuadros.findIndex(([n])=>n==='cabecear3')<a.cuadros.findIndex(([n])=>n==='acostar1'));assert.ok(!a.cuadros.some(([n])=>n==='bostezo1'))
 console.log('Sprites nuevos: hambre estable por episodio, cabecear parado antes de acostarse y continuidad: OK.')
}

{
 const {vecinos,planSalto,puntoSalto}=require('../src/monitores')
 const display=(id,x,y,width=1920,height=1080,scaleFactor=1)=>({id,bounds:{x,y,width,height},workArea:{x,y,width,height:height-40},scaleFactor})
 const a=display(1,0,0),b=display(2,1920,0),c=display(3,-1280,-200,1280,1024,1.5)
 assert.equal(vecinos([a,b],a).derecha,b);assert.equal(vecinos([a,b],b).izquierda,a)
 assert.equal(vecinos([a,b,c],a).izquierda,c);assert.equal(vecinos([a,b,c],a).derecha,b)
 for(const y of [-300,0,300]){
  const d=display(2,1920,y,1280,900,1.5)
  assert.equal(vecinos([a,d],a).derecha,d)
  for(const [o,dest,lado] of [[a,d,'derecha'],[d,a,'izquierda']]){
   const p=planSalto(o,dest,lado,51)
   assert.equal(p.despegue.y,o.workArea.y+o.workArea.height)
   assert.equal(p.aterrizaje.y,dest.workArea.y+dest.workArea.height)
   assert.equal(p.apice,Math.min(p.despegue.y,p.aterrizaje.y)-90)
   assert.equal(p.despegue.x,lado==='derecha'?o.workArea.x+o.workArea.width-51:o.workArea.x+51)
   assert.equal(p.aterrizaje.x,lado==='derecha'?dest.workArea.x+75:dest.workArea.x+dest.workArea.width-75)
   assert.ok(Math.abs(puntoSalto(p,0).y-p.despegue.y)<1e-8)
   assert.ok(Math.abs(puntoSalto(p,1).y-p.aterrizaje.y)<1e-8)
   const t=Math.sqrt(p.despegue.y-p.apice)/(Math.sqrt(p.despegue.y-p.apice)+Math.sqrt(p.aterrizaje.y-p.apice))
   assert.equal(puntoSalto(p,t).y,p.apice);assert.equal(puntoSalto(p,t).fase,'apice')
  }
 }
 for(const d of [display(2,0,1080),display(2,1920,1080),display(2,1923,0)])assert.deepEqual(vecinos([a,d],a),{izquierda:null,derecha:null})
 assert.ok(vecinos([a,display(2,1922,0)],a).derecha)
 console.log('Saltos: vecinos en dos y tres monitores, pisos distintos, DIP/escalas, apice, apilados, tolerancia y huecos: OK.')
}

{
 const vmSalto=require('node:vm'),g=require('../src/monitores')
 const fuente=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8')
 const a={id:1,bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:0,width:1920,height:1040}}
 const b={id:2,bounds:{x:1920,y:-200,width:1280,height:1024},workArea:{x:1920,y:-200,width:1280,height:984}}
 let reloj=0,id=0,guardado=1,caja={x:0,y:700,width:1920,height:340},displays=[a,b],actualizaciones=0
 const timers=new Map(),mensajes=[],handlers={},sender={send:(...args)=>mensajes.push(args)}
 const mascotaMock={webContents:sender,getBounds:()=>caja,setBounds:c=>{caja=c},setIgnoreMouseEvents:()=>{}}
 const ctx=vmSalto.createContext({mascota:mascotaMock,ALTO_MASCOTA:340,Date:{now:()=>reloj},Math,
  screen:{getAllDisplays:()=>displays,getCursorScreenPoint:()=>({x:1900,y:1000}),getDisplayNearestPoint:p=>p.x>=1920?b:a},
  require:n=>n==='./monitores'?g:require('../src/caida'),
  monitorMascota:()=>guardado===1?a:b,zonaMascota:()=>{const d=guardado===1?a:b;return {x:d.workArea.x,y:d.workArea.y+d.workArea.height-340,width:d.workArea.width,height:340}},
  config:()=>({set:c=>{guardado=c['mascota.monitor']}}),vecinosCache:null,enviarEstado:()=>actualizaciones++,armarEstado:()=>({contextoGatito:{},gatito:{}}),
  ipcMain:{on:(n,fn)=>handlers[n]=fn},setInterval:fn=>{timers.set(++id,fn);return id},clearInterval:n=>timers.delete(n)})
 vmSalto.runInContext(fuente.slice(fuente.indexOf('let arrastreGlobal ='),fuente.indexOf('function terminarArrastre()')),ctx)
 handlers['gatito-cruzar']({sender:{}},'derecha');assert.equal(timers.size,0,'valida sender')
 handlers['gatito-cruzar']({sender},'arriba');assert.equal(timers.size,0,'valida lado')
 handlers['gatito-cruzar']({sender},'derecha');assert.equal(timers.size,1)
 handlers['gatito-cruzar']({sender},'derecha');assert.equal(timers.size,1,'no duplica vuelo')
 for(reloj=16;reloj<=656;reloj+=16)for(const fn of [...timers.values()])fn()
 assert.equal(timers.size,0);assert.equal(guardado,2);assert.equal(actualizaciones,1)
 assert.equal(caja.x,1920);assert.equal(caja.y,444);assert.equal(caja.width,1280)
 assert.ok(mensajes.some(([,d])=>d.saltando&&d.fase==='subida'))
 assert.ok(mensajes.some(([,d])=>d.saltando&&d.fase==='bajada'))
 assert.equal(mensajes.at(-1)[1].aterrizo,true);assert.equal(mensajes.at(-1)[1].x,75)
 handlers['gatito-cruzar']({sender},'izquierda');reloj+=100;for(const fn of [...timers.values()])fn()
 vmSalto.runInContext('cancelarSalto()',ctx)
 assert.equal(vmSalto.runInContext('saltoGlobal',ctx),null)
 assert.ok(mensajes.at(-1)[1].cayendo,'cancelar inicia caida fisica')
 assert.equal(timers.size,1,'solo queda el reloj de caida')
 console.log('IPC de salto simulado: sender, lado, vuelo unico, franja destino, persistencia y cancelacion con caida: OK.')
}

// Regresiones de oscilacion con reloj controlado.
{
 for(const pose of ['sentado','agazapado','parado']){
  const m=crearMaquina();m.reiniciar(pose);let t=0;
  for(let i=0;i<4;i++){m.pedir('hambre',2);const a=m.paso(t,{energia:80});assert.equal(a.variante,pose==='parado'?'empujar':'panza');t=a.hasta}
  m.pedir('croquetas',4);const comida=m.paso(t,{energia:80});m.pedir('hambre',2);assert.equal(m.paso(comida.hasta,{energia:80}).variante,'panza');
 }
 const giro=crearMaquina();giro.pedir('girar',1);const g=giro.paso(0,{energia:80});
 assert.equal(g.variante,'giro-sentado');assert.ok(g.tramos.every(t=>t.de==='sentado'&&t.a==='sentado'));assert.ok(!g.cuadros.some(([n])=>/parado|incorporar|girar/.test(n)));
 const r=crearMaquina();r.pedir('rascar',2);let a=r.paso(0,{energia:80}),t=a.hasta;
 a=r.paso(t,{energia:80});assert.equal(a.variante,'ocio-parado');assert.ok(a.hasta-t>=30000&&a.hasta-t<=90000);t=a.hasta;
 let sentadas=0;
 for(let i=0;i<10;i++){a=r.paso(t,{energia:80});sentadas+=a.tramos.filter(t=>t.de==='parado'&&t.a==='sentado').length;assert.equal(a.poseFinal,'sentado');assert.ok(!a.tramos.some(t=>t.a==='parado'));t=a.hasta}
 assert.equal(sentadas,1);
 const f=crearMaquina();t=0;let cambios=0,frenos=0;
 for(let i=0;i<12&&t<30000;i++){f.pedir(i%2?'maullar':'cabecear',2);a=f.paso(t,{energia:80});
 cambios+=a.tramos.filter(t=>t.de!==t.a&&['sentado','parado'].includes(t.de)&&['sentado','parado'].includes(t.a)).length;
 if(a.motivo==='freno-anti-oscilacion')frenos++;t=a.hasta;
 }
 assert.ok(cambios<=3);assert.ok(frenos>0);
 f.pedir('maullar',3);a=f.paso(t,{energia:80});assert.equal(a.estado,'maullar');
 console.log('Anti-oscilacion: hambre estable por episodio, giro sentado, reposo parado y una sentada, freno con prioridad 2: OK.');
}

// Los extremos del grafo y los ciclos con pose declarada definen los cuadros propios.
{
 const {transiciones,ciclos}=require('../src/ui/comportamiento')
 const validos=Object.fromEntries(poses.map(p=>[p,new Set()]))
 for(const arista of transiciones)validos[arista.a].add(arista.cuadros.at(-1)[0])
 for(const [nombre,meta] of Object.entries(animaciones)){
  if(meta.inicio===meta.fin)for(const [cuadro] of ciclos[nombre])validos[meta.inicio].add(cuadro)
 }
 function verificarCuadros(a){
  let pose=a.poseInicial
  for(const tramo of a.tramos){
   assert.equal(tramo.de,pose)
   if(tramo.tipo==='transicion'){
    const arista=transiciones.find(t=>t.de===pose&&t.a===tramo.a)
    assert.ok(arista,`arista legal ${pose}->${tramo.a}`)
    assert.deepEqual(tramo.cuadros,arista.cuadros)
   }else{
    assert.equal(tramo.a,pose)
    for(const [cuadro] of tramo.cuadros)assert.ok(validos[pose].has(cuadro),`${cuadro} no pertenece a ${pose}`)
   }
   pose=tramo.a
  }
  assert.equal(pose,a.poseFinal)
 }
 for(const pose of poses){
  const m=crearMaquina();let t=0
  // Tres cambios reales en menos de 30 s; reiniciar cambia la pose de partida,
  // conservando el historial del freno.
  for(const estado of ['cabecear','maullar','cabecear']){m.pedir(estado,3);t=m.paso(t,{energia:80}).hasta}
  m.reiniciar(pose)
  const estado=['parado','caminando','acostado'].includes(pose)?'maullar':'cabecear'
  m.pedir(estado,2);const a=m.paso(t,{energia:80})
  assert.equal(a.motivo,'freno-anti-oscilacion',pose)
  verificarCuadros(a)
  assert.equal(a.poseFinal,pose==='caminando'?'parado':pose)
  if(pose==='caminando')assert.deepEqual(a.tramos[0].cuadros,transiciones.find(t=>t.de==='caminando'&&t.a==='parado').cuadros)
  const g=crearMaquina();g.reiniciar(pose);g.pedir('girar',2)
  verificarCuadros(g.paso(0,{energia:80}))
 }
 const reposo=crearMaquina();reposo.reiniciar('parado')
 verificarCuadros(reposo.paso(0,{energia:80}))
 console.log('Reposos y giros: cuadros propios en todas las poses, frenado caminando->parado y aristas legales: OK.')
}

{
 const {ciclos,animaciones,transiciones}=require('../src/ui/comportamiento')
 for(const [nombre,cuadros] of Object.entries(ciclos))if(animaciones[nombre].inicio==='sentado')assert.ok(!cuadros.some(([n])=>n==='sentado'),nombre+' usa el PNG viejo parado')
 assert.ok(!transiciones.some(t=>t.cuadros.some(([n])=>n==='sentado')))
 assert.equal(ciclos['mirar-cursor'].reduce((s,c)=>s+c[1],0),2160)
 assert.deepEqual(animaciones['mirar-cursor'],{inicio:'sentado',fin:'sentado'})
 console.log('Reposo sentado nuevo y mirada sin cambio de pose: OK.')
}

// Reloj y azar controlados: cubre ambos extremos y una secuencia variable.
{
 const original=Math.random, conteos=[]
 try{
  for(const semilla of [0,.5,.999]){
   Math.random=()=>semilla
   const m=crearMaquina();let previo=null,secuencias=0,ultimoAseo=-Infinity
   for(let t=0;t<600000;t+=100){
    const a=m.paso(t,{energia:80})
    if(a===previo)continue
    secuencias++;assert.ok(a.reposo);assert.ok(a.hasta-a.desde>=30000&&a.hasta-a.desde<=90000)
    if(previo)assert.ok(a.desde-previo.desde>=20000,'sin cambios nerviosos entre gestos')
    if(a.estado==='lamer'){
     assert.ok(a.desde-ultimoAseo>=120000,'aseo separado al menos dos minutos');ultimoAseo=a.desde
     const ms=a.cuadros.filter(([n])=>n.startsWith('lamer')).reduce((s,c)=>s+c[1],0)
     assert.ok(ms>=8000&&ms<=15000);assert.equal(ms,a.aseoMs)
     assert.equal(a.motivo,'aseo-y-reposo')
    }
    previo=a
   }
   assert.ok(secuencias<=20,'diez minutos no producen cientos de secuencias');conteos.push(secuencias)
  }
  let semilla=42;Math.random=()=>((semilla=(semilla*1664525+1013904223)>>>0)/4294967296)
  for(const contexto of [{energia:80},{energia:80,panel:true},{energia:80,trabajando:true}]){
   const m=crearMaquina(),a=m.paso(0,contexto),b=m.paso(a.hasta,contexto)
   assert.ok(a.hasta>=(contexto.trabajando?20000:30000));assert.ok(a.hasta<=(contexto.trabajando?60000:90000))
   assert.notEqual(a.hasta-a.desde,b.hasta-b.desde,'duraciones nuevas por bloque')
   const cuadros=a.cuadros.map(c=>c[0]);assert.ok(cuadros.includes(contexto.trabajando?'pensar1':'sentado-quieto'))
   if(!contexto.trabajando){assert.ok(cuadros.includes('parpadeo2'));assert.ok(cuadros.includes('cola-nueva'))}
   m.pedir('reunion',2,'urgente');const aviso=m.paso(b.desde+100,contexto)
   assert.equal(aviso.estado,'reunion');assert.equal(aviso.motivo,'pedido')
  }
  const m=crearMaquina(),a=m.paso(0,{energia:80});m.pedir('maullar',1)
  assert.equal(m.paso(100,{energia:80}),a,'prioridad baja espera el bloque')
  assert.equal(SUENO_MINIMO,15*60000)
  const sueno=crearMaquina();sueno.paso(0,{energia:0});sueno.paso(14*60000,{energia:80})
  assert.equal(sueno.durmiendo(),true,'no termina el sueno a los 14 minutos')
  sueno.paso(15*60000+10000,{energia:80});assert.equal(sueno.durmiendo(),false)
 }finally{Math.random=original}
 console.log('Ritmo: 10 min de ocio = '+conteos.join('/')+' secuencias; bloques largos, aseo 8-15 s cada >=2 min, interrupcion real y sueno minimo 15 min: OK.')
}
