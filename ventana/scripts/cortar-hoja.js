// Corta la hoja de 4x4 del gatito (fondo ya transparente) en 16 PNG del mismo tamaño.
// Uso: npm run cortar-hoja  (lee arte/gatito-hoja.webp y escribe src/ui/sprites/*.png)
// Para otro gatito: reemplazá arte/gatito-hoja.webp por una hoja 4x4 con fondo transparente,
// con los dibujos en este orden (filas de izquierda a derecha) y mirando a la derecha.
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const RAIZ = path.join(__dirname, '..')
const HOJA = process.env.HOJA || path.join(RAIZ, 'arte', 'gatito-hoja.webp')
const SALIDA = process.env.SALIDA || path.join(RAIZ, 'src', 'ui', 'sprites')

const NOMBRES = [
  'sentado', 'contento', 'atento', 'cola',
  'caminar1', 'caminar2', 'caminar3', 'caminar4',
  'alerta', 'tablet', 'listo', 'duda',
  'sueno', 'durmiendo', 'bolita', 'estirarse',
]

const PAGINA = `
function procesar(src) {
  return new Promise(listo => {
    const img = new Image()
    img.onload = () => {
      const W = img.width, H = img.height
      const lienzo = document.createElement('canvas'); lienzo.width = W; lienzo.height = H
      const ctx = lienzo.getContext('2d'); ctx.drawImage(img, 0, 0)
      const todo = ctx.getImageData(0, 0, W, H).data
      const tinta = (x, y) => todo[(y * W + x) * 4 + 3] > 40

      // Cortes por las franjas vacías reales entre gatos.
      const perfilF = Array.from({ length: H }, (_, y) => { let n = 0; for (let x = 0; x < W; x++) if (tinta(x, y)) n++; return n })
      const perfilC = Array.from({ length: W }, (_, x) => { let n = 0; for (let y = 0; y < H; y++) if (tinta(x, y)) n++; return n })
      function cortes(perfil) {
        const huecos = []; let ini = -1
        perfil.forEach((v, i) => { const vacio = v <= 2; if (vacio && ini < 0) ini = i; if (!vacio && ini >= 0) { huecos.push([ini, i - 1]); ini = -1 } })
        const internos = huecos.filter(h => h[0] > 0 && h[1] < perfil.length - 1).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 3)
        return [0, ...internos.map(h => Math.round((h[0] + h[1]) / 2)).sort((a, b) => a - b), perfil.length]
      }
      const cy = cortes(perfilF), cx = cortes(perfilC)

      // Caja ocupada de cada gato dentro de su celda.
      const celdas = []
      for (let fila = 0; fila < 4; fila++) for (let col = 0; col < 4; col++) {
        let x0 = W, y0 = H, x1 = -1, y1 = -1
        for (let y = cy[fila]; y < cy[fila + 1]; y++) for (let x = cx[col]; x < cx[col + 1]; x++) {
          if (tinta(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
        }
        celdas.push({ x0, y0, x1, y1 })
      }

      // Todos al mismo tamaño de lienzo: apoyados abajo y centrados (así no "saltan" al cambiar de dibujo).
      const fw = Math.max(...celdas.map(c => c.x1 - c.x0 + 1)) + 4
      const fh = Math.max(...celdas.map(c => c.y1 - c.y0 + 1)) + 2
      const salida = celdas.map(c => {
        const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1
        const r = document.createElement('canvas'); r.width = fw; r.height = fh
        r.getContext('2d').drawImage(lienzo, c.x0, c.y0, w, h, Math.floor((fw - w) / 2), fh - h, w, h)
        return r.toDataURL('image/png').split(',')[1]
      })
      listo({ W, H, cortes: { x: cx, y: cy }, marco: [fw, fh], cajas: celdas.map(c => [c.x0, c.y0, c.x1, c.y1]), salida })
    }
    img.src = src
  })
}`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<html><body></body></html>')
  await win.webContents.executeJavaScript(PAGINA)
  // Embebida: una imagen leída desde file:// no deja leer sus pixeles (canvas "contaminado").
  const tipo = HOJA.toLowerCase().endsWith('.png') ? 'png' : 'webp'
  const src = `data:image/${tipo};base64,` + fs.readFileSync(HOJA).toString('base64')
  const r = await win.webContents.executeJavaScript(`procesar(${JSON.stringify(src)})`)
  fs.mkdirSync(SALIDA, { recursive: true })
  r.salida.forEach((b64, i) => fs.writeFileSync(path.join(SALIDA, `${NOMBRES[i]}.png`), Buffer.from(b64, 'base64')))
  console.log('LISTO', JSON.stringify({ hoja: [r.W, r.H], cortes: r.cortes, marco: r.marco }))
  app.quit()
})
