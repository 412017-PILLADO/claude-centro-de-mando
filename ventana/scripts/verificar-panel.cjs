const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=raiz=>{
 class Nodo{
 constructor(){this.children=[];this.attrs={};this.events={};this.style={};this.dataset={}}
 set textContent(t){this.text=String(t);this.children=[]}get textContent(){return (this.text||'')+this.children.map(n=>n.textContent??n).join('')}
 append(...n){this.children.push(...n)}replaceChildren(...n){this.text='';this.children=n}
 setAttribute(k,v){this.attrs[k]=v}addEventListener(k,f){this.events[k]=f}setPointerCapture(){}
 }
 const nodos=new Map(),enviados=[];let recibir;
 const doc={getElementById(id){if(!nodos.has(id))nodos.set(id,new Nodo());return nodos.get(id)},createElement:()=>new Nodo(),createElementNS:()=>new Nodo(),createTextNode:t=>t};
 const receptores={},api=new Proxy({},{get:(_,k)=>k==='alRecibirEstado'?f=>recibir=f:k.startsWith('al')?f=>receptores[k]=f:(...a)=>enviados.push([k,...a])});
 const ctx=vm.createContext({window:{centro:api},document:doc,Node:Nodo,Date,Math,console,localStorage:{getItem(){return null},setItem(){}},prepararSecciones(){},prepararPlegado(){},ResizeObserver:class{observe(){}},addEventListener(){}});
 vm.runInContext(fs.readFileSync(path.join(raiz,'app.js'),'utf8'),ctx);
 const ahora=Date.now(),r={id:'1',title:'Revisión',start:new Date(ahora+4*60000).toISOString(),end:new Date(ahora+40*60000).toISOString(),joinUrl:'https://example.com/reunion'};
 const estado={ahora,reuniones:[r],sesiones:[{id:'s',status:'waiting',name:'Proyecto',cwd:'C:/proyecto',lastActivityAt:ahora}],tickets:{loadedAt:ahora,items:[{key:'A-1',summary:'Trabajo',category:'indeterminate',status:'En curso',url:'https://example.com/ticket'}]}};
 recibir(estado);
 assert.match(nodos.get('reuniones').textContent,/Revisión.*Unirse/);
 const buscar=(n,clase)=>[...(n.attrs?.class===clase||n.className===clase?[n]:[]),...n.children.flatMap(h=>h instanceof Nodo?buscar(h,clase):[])];
 buscar(nodos.get('reuniones'),'unirse chico')[0].events.click();assert.deepEqual(enviados.at(-1),['unirse',r.joinUrl]);
 assert.match(nodos.get('tickets').textContent,/En curso 1.*A-1.*Trabajo/);assert.match(nodos.get('sesiones').textContent,/C:\/proyecto/);
 assert.equal(nodos.get('filtros').children[0].attrs['aria-pressed'],'true');
 // Los tickets se agrupan por su estado real; la categoría de Jira solo ordena.
 {const t=(key,status,category)=>({key,summary:key,status,category,url:'https://example.com/'+key})
  recibir({...estado,tickets:{loadedAt:ahora,items:[t('B-3','PRUEBAS DE USUARIO','indeterminate'),t('B-1','TAREA POR HACER','new'),t('B-2','EN CURSO','indeterminate')]}})
  assert.match(nodos.get('tickets').textContent,/Tarea por hacer 1.*B-1.*Pruebas de usuario 1.*B-3.*En curso 1.*B-2/)
  assert.deepEqual(nodos.get('filtros').children.map(b=>b.textContent),['Todos 3','Tarea por hacer 1','Pruebas de usuario 1','En curso 1'])
  nodos.get('filtros').children[2].events.click();assert.doesNotMatch(nodos.get('tickets').textContent,/B-2/);assert.match(nodos.get('tickets').textContent,/B-3/)
  nodos.get('filtros').children[0].events.click();recibir(estado)}
 // Ajustes: bienvenida la primera vez, fuentes con su conector y cambios por config.
 {const {POR_DEFECTO}=require(path.join(raiz,'../nucleo/config.js'))
  const config=JSON.parse(JSON.stringify(POR_DEFECTO))
  receptores.alCambiarVista('ajustes')
  recibir({...estado,config,conectores:{version:1,jira:false,calendario:true},gatito:{nombre:'Mora',color:'gris'}})
  assert.equal(nodos.get('vista-ajustes').hidden,false);assert.equal(nodos.get('vista-trabajo').hidden,true)
  assert.equal(nodos.get('bienvenida').hidden,false)
  const texto=nodos.get('ajustes-cuerpo').textContent
  assert.match(texto,/Tu gatito.*Conexiones.*Sesiones de Claude.*Reuniones.*Solo las de hoy.*Mis tickets.*Conectá Jira.*Abrir al iniciar la computadora/)
  assert.doesNotMatch(texto,/Conectá Google Calendar/)
  const interruptores=buscar(nodos.get('ajustes-cuerpo'),'ajuste').map(l=>l.children.at(-1)).filter(n=>n.attrs?.type==='checkbox')
  const tickets=buscar(nodos.get('ajustes-cuerpo'),'ajuste').find(l=>l.textContent.startsWith('Mis tickets')).children.at(-1)
  tickets.checked=false;tickets.events.change();assert.equal(JSON.stringify(enviados.at(-1)),JSON.stringify(['cambiarConfig',{'fuentes.tickets.activa':false}]))
  assert.ok(interruptores.length>=6)
  buscar(nodos.get('ajustes-cuerpo'),'color-gato pelaje-naranja')[0].events.click();assert.deepEqual(enviados.at(-1),['cuidarGatito','color','naranja'])
  nodos.get('ajustes-listo').onclick();assert.equal(JSON.stringify(enviados.at(-1)),JSON.stringify(['cambiarConfig',{primerUso:false}]))
  assert.equal(nodos.get('vista-ajustes').hidden,true);assert.equal(nodos.get('vista-trabajo').hidden,false)
  recibir(estado)}
 // Sin fuentes activas: se avisa que es solo el gatito; con alguna, el aviso se oculta.
 recibir({...estado,fuentes:{sesiones:false,reuniones:false,tickets:false}});assert.equal(nodos.get('sin-fuentes').hidden,false)
 recibir({...estado,fuentes:{sesiones:true,reuniones:false,tickets:false}});assert.equal(nodos.get('sin-fuentes').hidden,true)
 recibir(estado)
 // Con "Solo reuniones de hoy" la de mañana no se lista.
 {const manana=new Date(ahora);manana.setDate(manana.getDate()+1);manana.setHours(10,0,0,0);const otra={id:'2',title:'Retro',start:manana.toISOString(),end:new Date(manana.getTime()+1800000).toISOString()}
  recibir({...estado,reuniones:[r,otra]});assert.match(nodos.get('reuniones').textContent,/Retro/)
  recibir({...estado,reuniones:[r,otra],config:{fuentes:{reuniones:{soloHoy:true}}}});assert.doesNotMatch(nodos.get('reuniones').textContent,/Retro/);assert.equal(nodos.get('cuenta-reuniones').textContent,'1')
  recibir({...estado,reuniones:[otra],config:{fuentes:{reuniones:{soloHoy:true}}}});assert.match(nodos.get('sub-reuniones').textContent,/Sin más reuniones hoy/)
  recibir(estado)}
 nodos.get('btn-probar').events.click({stopPropagation(){}});assert.equal(enviados.at(-1)[0],'probarAlerta');
 for(const id of ['agarre-alto','agarre-ancho']){assert.equal(typeof nodos.get(id).events.pointerdown,'function');nodos.get(id).events.dblclick();assert.equal(enviados.at(-1)[0],'tamanoAutomatico')}
 // Plegar deja el bloque en su lugar (clase plegada, aria-expanded, cuerpo inerte) y se persiste; lo antes oculto pasa a plegado.
 {const {prepararPlegado}=require(path.join(raiz,'secciones.js')),guardado=new Map([['seccion-sesiones','1']]);
  const nodo=()=>({attrs:{},clases:new Set(),setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,fn){this[k]=fn},classList:{add(){},remove(){},toggle:null}});
  const crear=(n,t)=>{const boton=nodo(),cuerpo=nodo(),sec=nodo();sec.dataset={seccion:n};sec.classList={toggle(c,v){v?sec.clases.add(c):sec.clases.delete(c)},add(){},remove(){}};sec.classList.contains=c=>sec.clases.has(c);
   sec.classList.contains=c=>sec.clases.has(c);sec.querySelector=q=>q==='.seccion-titulo'?boton:q==='.plegable'?cuerpo:q==='h2'?{textContent:t}:null;sec.boton=boton;sec.cuerpo=cuerpo;return sec};
  const a=crear('reuniones','Reuniones'),b=crear('sesiones','Sesiones de Claude');
  const doc={documentElement:{classList:{add(){},remove(){}}},querySelectorAll:()=>[a,b]};
  prepararPlegado(doc,k=>guardado.get(k)??null,(k,v)=>guardado.set(k,v));
  assert.equal(b.clases.has('plegada'),true);assert.equal(b.boton.attrs['aria-expanded'],'false');assert.ok('inert' in b.cuerpo.attrs);assert.equal(guardado.get('plegada-sesiones'),'1');assert.equal(guardado.get('seccion-sesiones'),'0');
  assert.equal(a.clases.has('plegada'),false);assert.equal(a.boton.attrs['aria-expanded'],'true');assert.ok(!('inert' in a.cuerpo.attrs));
  a.boton.click();assert.equal(a.clases.has('plegada'),true);assert.equal(a.boton.attrs['aria-expanded'],'false');assert.equal(guardado.get('plegada-reuniones'),'1');
  a.boton.click();assert.equal(a.clases.has('plegada'),false);assert.equal(a.boton.attrs['aria-expanded'],'true');assert.equal(guardado.get('plegada-reuniones'),'0');
  const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');assert.ok(!html.includes('secciones-ocultas'),'sin chip de secciones ocultas');assert.equal((html.match(/aria-expanded="true"/g)||[]).length,3)}
 console.log('Panel: urgencia a 15 min, Unirse, estados, carpetas, filtros, menú de prueba y manijas: OK.')
}
