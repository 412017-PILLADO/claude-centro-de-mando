// PNG RGBA/RGB de 8 bits, sin dependencias ni Electron. El cortado usa el detector real.
const fs = require('node:fs'), zlib = require('node:zlib')
function leer(ruta) {
  const b = fs.readFileSync(ruta); let w,h,t,partes=[]
  for(let p=8;p<b.length;) { const n=b.readUInt32BE(p), tipo=b.toString('ascii',p+4,p+8), d=b.subarray(p+8,p+8+n); p+=12+n
    if(tipo==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);t=d[9];if(d[8]!==8 || ![2,6].includes(t)||d[12])throw Error('PNG no compatible')}
    if(tipo==='IDAT')partes.push(d)
  }
  const c=t===6?4:3, raw=zlib.inflateSync(Buffer.concat(partes)), scan=Buffer.alloc(w*h*c), rgba=Buffer.alloc(w*h*4)
  const paeth=(a,b,c)=>{const p=a+b-c, x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c}
  let q=0
  for(let y=0;y<h;y++){const f=raw[q++];if(f>4)throw Error('Filtro PNG inválido');for(let x=0;x<w*c;x++){const i=y*w*c+x,a=x>=c?scan[i-c]:0,b=y?scan[i-w*c]:0,d=y&&x>=c?scan[i-w*c-c]:0;scan[i]=(raw[q++]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,d)][f])&255}}
  for(let i=0;i<w*h;i++){scan.copy(rgba,i*4,i*c,i*c+3);rgba[i*4+3]=c===4?scan[i*c+3]:255}
  return {width:w,height:h,data:rgba}
}
function guardar(ruta,w,h,data){
  const crc=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
  const chunk=(t,d)=>{const b=Buffer.alloc(d.length+12);b.writeUInt32BE(d.length);b.write(t,4);d.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6
  const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)
  fs.writeFileSync(ruta,Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]))
}
module.exports={leer,guardar}
