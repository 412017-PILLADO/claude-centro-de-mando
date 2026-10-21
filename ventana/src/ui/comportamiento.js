// Poses conectadas: nadie cambia de postura sin recorrer una arista del grafo.
;(function (raiz) {
  const repetir = (n, nombres, ms) => Array.from({length:n}, (_,i) => [nombres[i % nombres.length], ms])
  const transiciones = [
    ['sentado','espaldas', ['espaldas1','espaldas2'],300],
    ['espaldas','sentado', ['espaldas2','espaldas1','sentado-quieto'],300],
    ['sentado','parado', ['incorporar1','incorporar2','parado'],140],
    ['parado','sentado', ['sentarse1','sentarse2','sentarse3'],160],
    ['sentado','acostado', ['acostar1','acostar2','dormir1'],260],
    ['acostado','parado', ['despertar1','despertar2','estirar-nuevo','parado'],280],
    ['parado','caminando', ['arrancar1','arrancar2','arrancar3'],110],
    ['caminando','parado', ['frenar1','frenar2','frenar3'],130],
    ['sentado','agazapado', ['agachar1','agachar2','agachar3'],180],
    ['agazapado','sentado', ['agachar3','agachar2','agachar1'],180],
    ['agazapado','volando', ['salto1'],100],
    ['volando','sentado', ['aterrizar1','aterrizar2','sentado-quieto'],180],
    ['volando','cayendo', ['caer1'],100],
    ['suspendido','cayendo', ['caer1'],100],
    ['cayendo','sentado', ['aterrizar1','aterrizar2','sentado-quieto'],180],
    ['sentado','suspendido', ['alzar0','alzar1','alzar2'],140],
  ].map(([de,a,nombres,ms])=>({de,a,cuadros:nombres.map(n=>[n,ms])}))
  const poses = [...new Set(transiciones.flatMap(t=>[t.de,t.a]))]
  function camino(de,a) {
    const cola=[{pose:de,pasos:[]}], vistos=new Set([de])
    while(cola.length){const p=cola.shift();if(p.pose===a)return p.pasos
      for(const t of transiciones.filter(t=>t.de===p.pose))if(!vistos.has(t.a)){vistos.add(t.a);cola.push({pose:t.a,pasos:[...p.pasos,t]})}}
    throw Error(`No hay transición de ${de} a ${a}`)
  }
  // Gestos nuevos con poses explícitas.
  const ciclos = {
    bostezo: [['sentado-quieto',500],['bostezo1',500],['bostezo2',800],['bostezo3',600],['sentado-quieto',500]],
    cabeceo: [['sentado-quieto',1400],['parpadeo1',900],['parpadeo2',1400],['parpadeo1',700],['sentado-quieto',1000]],
    espaldas: repetir(4,['espaldas1','espaldas2'],1300),
    aburrido: [['sentado-quieto',500],['mirar1',1000],['mirar2',1000],['sentado-quieto',400]],
    croquetas: repetir(8,['croquetas1','croquetas2','croquetas3'],340).concat([['croquetas1',300]]),
    pescado: [['pescado1',800],['pescado2',1000],['pescado3',1100],['pescado4',900]],
    leche: repetir(4,['leche1','leche2'],450).concat([['leche1',950],['leche2',850]]),
    raton: repetir(8,['raton1','raton2','raton3'],400).concat([['raton1',300]]),
    caja: [['caja1',500],['caja2',550],['caja3',900],['caja4',600],['caja2',450],['caja1',500]],
    saludo: [['saludar1',700],['saludar2',700],['saludar1',500]], despedida:[['bostezo1',500],['bostezo2',800],['bostezo3',600]], estirar:[['estirar-nuevo',1800]], festejo:[['ronronear2',1800],['cola-nueva',800]],
    rascar: repetir(12,['pared1','pared2','pared3','pared4'],250),
    reunion: [['sentado-quieto',1400],['cola-nueva',600]], sesion: [['sentado-quieto',600],['ronronear1',700],['ronronear2',700]],
    comer: repetir(8,['comer2','comer3','comer4'],320),
    mimar: repetir(6,['ronronear1','ronronear2'],500), jugar: repetir(9,['ovillo1','ovillo2'],350),
    pensar: repetir(8,Array.from({length:8},(_,i)=>'pensar'+(i+1)),2500),
    cabecear: repetir(10,['cabecear1','cabecear2','cabecear3','cabecear2','cabecear1'],450),
    empujar: repetir(21,['empujar1','empujar2','empujar3','empujar4','empujar3','empujar2','empujar1'],400),
    panza: repetir(8,['panza1','panza2'],550),
    hambre: repetir(18,['pedir1','pedir2'],500), dormir: repetir(2,['dormir1'],900),
    // Catálogo para precarga; la máquina genera los bloques en cada entrada.
    panel: [['sentado-quieto',30000],['parpadeo1',120],['parpadeo2',110],['cola-nueva',800]],
    ocio: [['sentado-quieto',30000],['parpadeo1',120],['parpadeo2',110],['cola-nueva',800]],
    'mirar-cursor': [['mirar1',1080],['mirar2',1080]],
    maullar: [['maullar1',180],['maullar2',220]],
    lamer: repetir(30,['lamer1','lamer2','lamer3'],280),
    correr: repetir(4,['correr1','correr2','correr3','correr4'],100),
    caminar: repetir(4,['caminar1','caminar2','caminar3','caminar4'],160),
    'ocio-parado': [['parado',4200]],
    'giro-sentado': [['parpadeo1',180],['cola-nueva',420]],
    girar: [['girar1',160],['girar2',180],['girar3',160]],
    'preparar-salto': [['agachar3',450]],
    soltar: [['sentado-quieto',500]],
  }
  const animaciones = Object.fromEntries(Object.keys(ciclos).map(n=>[n,{inicio:'sentado',fin:'sentado'}]))
  Object.assign(animaciones,{comer:{inicio:'agazapado',fin:'agazapado'},dormir:{inicio:'acostado',fin:'acostado'},caminar:{inicio:'caminando',fin:'caminando'},girar:{inicio:'parado',fin:'parado'},jugar:{inicio:'agazapado',fin:'agazapado'}})
  for(const n of ['croquetas','leche','raton'])animaciones[n]={inicio:'agazapado',fin:'agazapado'}
  animaciones['preparar-salto']={inicio:'agazapado',fin:'agazapado'}
  animaciones.espaldas={inicio:'espaldas',fin:'espaldas'}
  animaciones.correr={inicio:'caminando',fin:'caminando'}
  animaciones.estirar={inicio:'parado',fin:'parado'}
  animaciones.rascar={inicio:'parado',fin:'parado'}
  animaciones.caja={inicio:'parado',fin:'parado'}
  animaciones.cabecear={inicio:'parado',fin:'parado'}
  animaciones.empujar={inicio:'parado',fin:'parado'}
  animaciones['ocio-parado']={inicio:'parado',fin:'parado'}
  const reposos = {
    sentado:ciclos.ocio, parado:ciclos['ocio-parado'],
    agazapado:[['agachar3',4200]], espaldas:ciclos.espaldas,
    acostado:ciclos.dormir, volando:[['salto1',4200]],
    cayendo:[['caer1',4200]], suspendido:[['alzar2',4200]],
  }
  const azar=(min,max)=>Math.round(min+Math.random()*(max-min))
  const duracion=cuadros=>cuadros.reduce((s,c)=>s+c[1],0)
  function repetirHasta(nombres,total,ms){
    const cuadros=[]
    for(let t=0,i=0;t<total;i++){const d=Math.min(ms,total-t);cuadros.push([nombres[i%nombres.length],d]);t+=d}
    return cuadros
  }
  function bloqueSentado(total=azar(30000,90000)){
    const cuadros=[];let t=0,parpadeo=azar(4000,8000),cola=azar(15000,30000)
    while(t<total){
      const siguiente=Math.min(parpadeo,cola,total)
      if(siguiente>t){cuadros.push(['sentado-quieto',siguiente-t]);t=siguiente}
      if(t>=total)break
      const gesto=parpadeo<=cola?[['parpadeo1',120],['parpadeo2',110],['parpadeo1',120]]:[['cola-nueva',800]]
      // No dejar un gesto cortado en el extremo del bloque.
      if(t+duracion(gesto)>total){cuadros.push(['sentado-quieto',total-t]);break}
      cuadros.push(...gesto);t+=duracion(gesto)
      if(parpadeo<=cola)parpadeo=t+azar(4000,8000)
      else cola=t+azar(15000,30000)
      parpadeo=Math.max(parpadeo,t);cola=Math.max(cola,t)
    }
    return cuadros
  }
  const SUENO_MINIMO=15*60000
  function crearMaquina() {
    let varianteHambre=null, turnoSueno=0, reposoParado=false, cambios=[], frenoHasta=0, proximoAseo=null
    let actual=null, cola=[],serial=0, pose='sentado', dormido=false, desdeSueno=0, vigiliaHasta=0, despertar=false
    return {
      pedir(estado,prioridad=0,id){
        if(estado==='siesta')estado='dormir'
        if(!ciclos[estado] || (id && (cola.some(p=>p.id===id)||actual?.id===id)))return
        if(['croquetas','pescado','leche','comer'].includes(estado))varianteHambre=null
        cola.push({estado,prioridad,id,orden:serial++})
        // Sólo los eventos reales interrumpen el sueño; el ocio nunca lo hace.
        if(dormido && estado!=='dormir' && prioridad>=3)despertar=true
      },
      paso(ahora,contexto={}){
        if(proximoAseo===null)proximoAseo=ahora+azar(120000,180000)
        const urgente=cola.some(p=>p.prioridad>=2&&(!p.noAntes||ahora>=p.noAntes))
        const contextoCambio=actual?.reposo&&(contexto.siesta||ahora-actual.desde>=20000&&
          (contexto.trabajando?actual.estado!=='pensar':contexto.panel?actual.estado!=='panel':['pensar','panel'].includes(actual.estado)))
        const interrumpir=actual?.reposo&&urgente&&ahora>=actual.desde+duracion(actual.tramos.filter(t=>t.tipo==='transicion').flatMap(t=>t.cuadros))
        if(actual && ahora<actual.hasta && !despertar&&!interrumpir&&!contextoCambio)return actual
        // Si se interrumpe el dormir, primero completamos acostarse: no saltamos de pose.
        if(despertar && actual && ahora<actual.hasta && actual.tramos.some(t=>t.tipo==='transicion'))return actual
        if(despertar){dormido=false;despertar=false;vigiliaHasta=ahora+5*60000;actual=null}
        if(dormido && ahora-desdeSueno>=SUENO_MINIMO && contexto.energia>=75 && !contexto.siesta){dormido=false;vigiliaHasta=ahora+5*60000}
        if(!dormido && ahora>=vigiliaHasta && (contexto.energia<22 || contexto.siesta) && !contexto.trabajando && !cola.some(p=>p.prioridad>=3)){dormido=true;desdeSueno=ahora}
        cola.sort((a,b)=>b.prioridad-a.prioridad || a.orden-b.orden)
        if(dormido)cola=cola.filter(p=>p.estado!=='dormir')
        const indice=cola.findIndex(p=>!p.noAntes||ahora>=p.noAntes)
        const sinPedidos=!dormido&&indice<0
        let pedido=dormido?{estado:'dormir'}:(indice>=0?cola.splice(indice,1)[0]:null)||{estado:contexto.trabajando?'pensar':contexto.panel?'panel':ahora>=proximoAseo?'lamer':'ocio',reposo:true}
        if(contexto.hambre===false)varianteHambre=null
        if(pedido.estado==='hambre')pedido.variante=varianteHambre||(varianteHambre=['parado','caminando'].includes(pose)?'empujar':'panza')
        if(pedido.estado==='girar'&&!['parado','caminando'].includes(pose))pedido.variante='giro-sentado'
        if(sinPedidos&&pose==='parado'&&!reposoParado){pedido={estado:'ocio',variante:'ocio-parado',motivo:'reposo-parado',reposo:true};reposoParado=true}
        else if(!sinPedidos)reposoParado=false
        let meta=pedido.variante==='giro-sentado'?{inicio:pose,fin:pose}:animaciones[pedido.variante||pedido.estado]
        cambios=cambios.filter(t=>ahora-t<30000)
        const viaje=['caminar','correr','cruzar','preparar-salto'].includes(pedido.estado)
        const oscila=camino(pose,meta.inicio).some(t=>['sentado','parado'].includes(t.de)&&['sentado','parado'].includes(t.a))
        if(!viaje&&!(pedido.prioridad>=3)&&(ahora<frenoHasta||cambios.length>=3)&&oscila){
          if(ahora>=frenoHasta)frenoHasta=ahora+20000
          if(!sinPedidos)cola.push({...pedido,noAntes:frenoHasta})
          const poseReposo=pose==='caminando'?'parado':pose
          pedido={estado:'ocio',variante:poseReposo==='parado'?'ocio-parado':undefined,prioridad:0,motivo:'freno-anti-oscilacion'}
          meta={inicio:poseReposo,fin:poseReposo}
        }
        pedido.motivo=pedido.motivo||(sinPedidos?'ocio':'pedido')
        if(pedido.estado==='dormir'&&!dormido){dormido=true;desdeSueno=ahora}
        const prepararSueno=pedido.estado==='dormir'&&pose!=='acostado'
        const cabecearParado=prepararSueno&&['parado','caminando'].includes(pose)&&turnoSueno++%2===0
        const pasos=camino(pose,prepararSueno?(cabecearParado?'parado':'sentado'):meta.inicio)
        const tramos=pasos.map(t=>({...t,tipo:'transicion'}))
        if(prepararSueno){
          if(cabecearParado){tramos.push({de:'parado',a:'parado',tipo:'animacion',cuadros:ciclos.cabecear});tramos.push(...camino('parado','sentado').map(t=>({...t,tipo:'transicion'})))}
          tramos.push({de:'sentado',a:'sentado',tipo:'animacion',cuadros:(cabecearParado?[]:ciclos.bostezo).concat(...Array.from({length:Math.random()<.5?1:2},()=>ciclos.cabeceo))})
          tramos.push(...camino('sentado','acostado').map(t=>({...t,tipo:'transicion'})))
        }
        if(pedido.estado==='aburrido')cola.push({estado:Math.random()<.5?'rascar':'jugar',prioridad:1,orden:serial++})
        const reposoFrenado=pedido.motivo==='freno-anti-oscilacion'
        let cuadrosAnimacion=reposoFrenado?reposos[meta.inicio]:ciclos[pedido.variante||pedido.estado]
        if(pedido.reposo){
          if(pedido.variante==='ocio-parado')cuadrosAnimacion=[['parado',azar(30000,90000)]]
          else if(pedido.estado==='pensar')cuadrosAnimacion=repetirHasta(Array.from({length:8},(_,i)=>'pensar'+(i+1)),azar(20000,60000),azar(1800,3500))
          else if(pedido.estado==='lamer'){
            const aseo=azar(8000,15000),total=azar(30000,90000)
            pedido.aseoMs=aseo
            cuadrosAnimacion=repetirHasta(['lamer1','lamer2','lamer3'],aseo,280).concat(bloqueSentado(total-aseo))
            proximoAseo=ahora+azar(120000,180000)
            pedido.motivo='aseo-y-reposo'
          }else cuadrosAnimacion=bloqueSentado()
        }else if(pedido.estado==='lamer'){
          cuadrosAnimacion=repetirHasta(['lamer1','lamer2','lamer3'],azar(8000,15000),280)
          proximoAseo=ahora+azar(120000,180000)
        }
        // Un giro sin aristas tampoco puede dibujar una pose sentada ajena.
        if(pedido.variante==='giro-sentado'&&pose!=='sentado'){
          const propios=reposos[pose]
          cuadrosAnimacion=[[propios[0][0],180],[propios[Math.min(1,propios.length-1)][0],420]]
        }
        tramos.push({de:meta.inicio,a:meta.fin,tipo:'animacion',cuadros:cuadrosAnimacion})
        const cuadros=tramos.flatMap(t=>t.cuadros)
        actual={...pedido,tipo:'secuencia',cuadros,tramos,poseInicial:pose,poseFinal:meta.fin,desde:ahora,hasta:ahora+cuadros.reduce((n,c)=>n+c[1],0)}
        let instante=ahora
        for(const t of tramos){instante+=t.cuadros.reduce((n,c)=>n+c[1],0);if(t.de!==t.a&&['sentado','parado'].includes(t.de)&&['sentado','parado'].includes(t.a))cambios.push(instante)}
        pose=meta.fin
        return actual
      },
      cancelar(id){if(id==='hambre')varianteHambre=null;cola=cola.filter(p=>p.id!==id);if(actual?.id===id){pose=actual.poseFinal;actual=null}despertar=dormido&&cola.some(p=>p.prioridad>=3)},
      despertar(){despertar=true},
      reiniciar(nuevaPose){actual=null;if(nuevaPose)pose=nuevaPose},
      vaciar(){cola=[]},
      pendientes(){return cola.map(p=>p.estado)},
      durmiendo(){return dormido},
    }
  }
  const api={crearMaquina,ciclos,animaciones,poses,transiciones,camino,SUENO_MINIMO}
  if(typeof module!=='undefined')module.exports=api
  else raiz.comportamientoGatito=api
})(globalThis)
