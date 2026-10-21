const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto')
const {leer,guardar}=require('./png-puro.cjs')
const argumentos=process.argv.slice(2), tipo=argumentos[0], sobrescribir=argumentos.includes('--sobrescribir')
const tipos=['transiciones','movimientos','cuidados','pared','estados','sentado-quieto']
if(!tipos.includes(tipo)||argumentos.slice(1).some(a=>a!=='--sobrescribir')){
 console.error('Uso: node scripts/validar-hojas.cjs <'+tipos.join('|')+'> [--sobrescribir]');process.exit(1)
}
const raiz=path.join(__dirname,'..'), hoja=require('../arte/'+tipo+'.json')
async function validar(){
 const seleccion=hoja.sobrescribirSolo || hoja.nombres
 const destinos=seleccion.map(n=>path.join(raiz,'src/ui/sprites',n+'.png'))
 const existentes=destinos.filter(p=>fs.existsSync(p))
 if(!sobrescribir&&existentes.length)throw Error('Sprites existentes; no se escribió nada. Usar --sobrescribir para reemplazar: '+existentes.map(p=>path.basename(p)).join(', '))
 const archivoHashes=tipo==='estados'?'hashes-antes-estados.json':tipo==='pared'?'hashes-antes-pared.json':tipo==='cuidados'?'hashes-antes-tanda4.json':'hashes-antes-tanda3.json'
 const antes=JSON.parse(fs.readFileSync(path.join(raiz,'arte',archivoHashes),'utf8').replace(/^\uFEFF/,''))
 const comprobarHashes=()=>{for(const registro of antes){const archivo=registro.archivo||path.basename(registro.Path),Hash=registro.Hash;const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz,'src/ui/sprites',archivo))).digest('hex');if(actual.toUpperCase()!==Hash.toUpperCase())throw Error('Cambió el sprite viejo '+archivo)}}
 comprobarHashes()
 const png=leer(path.join(raiz,hoja.archivo)); let lienzo
 // Ejecutamos el detector del cortador, con un canvas mÃ­nimo que expone los mismos pÃ­xeles.
 const fuente=fs.readFileSync(path.join(__dirname,'cortar-hoja.js'),'utf8')
 const codigo=fuente.match(/const DETECTAR = `([\s\S]*?)`/)[1]
 const contexto={window:{},Image:class{set src(_){this.width=png.width;this.height=png.height;this.onload()}},
  ImageData:class{constructor(data){this.data=data}},document:{createElement(){return lienzo={getContext(){return {drawImage(){},getImageData(){return {data:Buffer.from(png.data)}},putImageData(i){png.data=i.data}}}}}}}
 vm.createContext(contexto);vm.runInContext(codigo,contexto)
 const r=await contexto.detectar('',hoja.filas,hoja)
 console.log(hoja.archivo,JSON.stringify({filas:r.conteo,cajas:r.cajas,transparente:r.transparente}))
 if(!r.transparente)throw Error('Falta transparencia')
 if(r.cajas.length!==hoja.nombres.length || hoja.filas.reduce((n,v)=>n+v,0)!==r.cajas.length)throw Error('Cantidad de dibujos incorrecta')
 // Las zonas preservan los objetos sueltos. Verificamos además filas reales y márgenes.
 if(hoja.zonas){let indice=0,anterior=-1
  for(const cantidad of hoja.filas){const fila=r.cajas.slice(indice,indice+cantidad);if(Math.min(...fila.map(c=>c[1]))<=anterior)throw Error('Filas superpuestas');anterior=Math.max(...fila.map(c=>c[1]+c[3]));
   for(let j=0;j<fila.length;j++){const c=fila[j],z=hoja.zonas[indice+j];if(c[0]<Math.floor(z[0]*png.width)||c[0]+c[2]>Math.ceil((z[0]+z[2])*png.width)||c[2]<10||c[3]<10)throw Error('Zona inválida');if(j&&fila[j-1][0]+fila[j-1][2]>=c[0])throw Error('Dibujos pegados')}
   indice+=cantidad
  }
 }
 const sentado=leer(path.join(raiz,'src/ui/sprites/'+(hoja.escalarComo?.referencia||'sentado')+'.png'))
 let arriba=sentado.height;for(let y=0;y<sentado.height;y++)for(let x=0;x<sentado.width;x++)if(sentado.data[(y*sentado.width+x)*4+3]>40)arriba=Math.min(arriba,y)
 const indice=hoja.nombres.indexOf(hoja.escalarComo?.propio)
 const escala=(sentado.height-arriba)/r.cajas[Math.max(0,indice)][3]
 const anclas={}
 for(let i=0;i<r.cajas.length;i++){
  if(!seleccion.includes(hoja.nombres[i]))continue
  const [x,y,w,h]=r.cajas[i]
  let escalaCuadro=escala
  const referencia=hoja.escalarPorCuadro?.[hoja.nombres[i]]
  if(referencia){const ref=leer(path.join(raiz,"src/ui/sprites",referencia+".png"));let superior=ref.height;for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)if(ref.data[(y*ref.width+x)*4+3]>40)superior=Math.min(superior,y);escalaCuadro=(ref.height-superior)/h}
  const e=Math.min(escalaCuadro,284/w,235/h), ew=Math.round(w*e),eh=Math.round(h*e),salida=Buffer.alloc(288*237*4)
  for(let dy=0;dy<eh;dy++)for(let dx=0;dx<ew;dx++){
   const a=((y+Math.floor(dy*h/eh))*png.width+x+Math.floor(dx*w/ew))*4,b=((237-eh+dy)*288+(hoja.alinearDerecha?288-ew:Math.floor((288-ew)/2))+dx)*4
   png.data.copy(salida,b,a,a+4)
  }
  guardar(path.join(raiz,'src/ui/sprites',hoja.nombres[i]+'.png'),288,237,salida)
  if(hoja.anclasFuente){const [cx,cy,hx,hy]=hoja.anclasFuente[i],p=(ax,ay)=>[+( (Math.floor((288-ew)/2)+(ax-x)*e)/288).toFixed(4),+((237-eh+(ay-y)*e)/237).toFixed(4)];anclas[hoja.nombres[i]]={cuello:p(cx,cy),cabeza:p(hx,hy)}}
 }
 if(hoja.anclasFuente)fs.writeFileSync(path.join(raiz,'src/ui/anclas-cuidados.js'),'// Anclas del lienzo 288 × 237; fuente: arte/cuidados.json y validar-hojas.cjs.\n;(function(r){const anclas='+JSON.stringify(anclas)+';if(typeof module!=="undefined")module.exports=anclas;else r.anclasCuidados=anclas})(globalThis)\n')
 comprobarHashes()
 console.log('Sprites viejos intactos:',antes.length)
}
validar().catch(e=>{console.error(e);process.exitCode=1})

