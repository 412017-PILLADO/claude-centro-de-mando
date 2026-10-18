// Arma el ícono del gatito como PNG (bandeja) e ICO (acceso directo), sin archivos binarios en el repo.
const zlib = require('node:zlib')

const { PIXELES, COLORES } = require('./ui/gato')

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const rgba = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255]

// El gatito escalado sin suavizar (cada pixel se vuelve un bloque de escala × escala).
function gatoPng(escala = 1) {
  const lado = 16 * escala
  const filas = []
  for (let y = 0; y < lado; y++) {
    const fila = Buffer.alloc(1 + lado * 4)
    for (let x = 0; x < lado; x++) {
      const letra = PIXELES[Math.floor(y / escala)][Math.floor(x / escala)]
      if (COLORES[letra]) fila.set(rgba(COLORES[letra]), 1 + x * 4)
    }
    filas.push(fila)
  }
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(lado, 0)
  cabecera.writeUInt32BE(lado, 4)
  cabecera.set([8, 6, 0, 0, 0], 8)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', cabecera),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(filas))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Un .ico puede contener PNGs tal cual: cabecera + una entrada de 16 bytes por imagen + las imágenes.
function gatoIco(escalas = [1, 2, 4, 16]) {
  const imagenes = escalas.map(gatoPng)
  const cabecera = Buffer.alloc(6 + 16 * imagenes.length)
  cabecera.writeUInt16LE(1, 2)
  cabecera.writeUInt16LE(imagenes.length, 4)
  let desplazamiento = cabecera.length
  imagenes.forEach((png, i) => {
    const lado = 16 * escalas[i]
    const entrada = 6 + 16 * i
    cabecera.writeUInt8(lado >= 256 ? 0 : lado, entrada)
    cabecera.writeUInt8(lado >= 256 ? 0 : lado, entrada + 1)
    cabecera.writeUInt16LE(1, entrada + 4)
    cabecera.writeUInt16LE(32, entrada + 6)
    cabecera.writeUInt32LE(png.length, entrada + 8)
    cabecera.writeUInt32LE(desplazamiento, entrada + 12)
    desplazamiento += png.length
  })
  return Buffer.concat([cabecera, ...imagenes])
}

module.exports = { gatoPng, gatoIco }
