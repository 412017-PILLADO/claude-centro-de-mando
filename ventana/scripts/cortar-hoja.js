// Corta las hojas de dibujos del gatito (fondo transparente) en PNG sueltos, todos del mismo tamaño.
// Uso: npm run cortar-hoja   (lee arte/*.webp y escribe src/ui/sprites/*.png)
//
// Cada gatito se detecta solo (no hace falta que la hoja sea una grilla pareja): se buscan las manchas
// de pixeles, se agrupan en filas de arriba a abajo y se leen de izquierda a derecha.
// Para cambiar o sumar dibujos: editá HOJAS (archivo, cuántos dibujos tiene cada fila y sus nombres).
// Los dibujos tienen que mirar a la derecha. Las hojas extra se escalan para que el gato tenga
// el mismo tamaño que en la primera (comparando una pose sentada de cada una).
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const RAIZ = path.join(__dirname, '..')
const SALIDA = process.env.SALIDA || path.join(RAIZ, 'src', 'ui', 'sprites')

const HOJAS = [
  {
    archivo: 'arte/gatito-hoja.webp',
    filas: [4, 4, 4, 4],
    nombres: [
      'sentado', 'contento', 'atento', 'cola',
      'caminar1', 'caminar2', 'caminar3', 'caminar4',
      'alerta', 'tablet', 'listo', 'duda',
      'sueno', 'durmiendo', 'bolita', 'estirarse',
    ],
  },
  {
    archivo: 'arte/gatito-hoja-2.webp',
    filas: [4, 4, 3, 3, 3, 2],
    nombres: [
      'maullar1', 'maullar2', 'saludar1', 'saludar2',
      'correr1', 'correr2', 'correr3', 'correr4',
      'lamer1', 'lamer2', 'lamer3',
      'bostezo1', 'bostezo2', 'bostezo3',
      'salto1', 'salto2', 'salto3',
      'espaldas1', 'espaldas2',
    ],
    // Mismo tamaño de gato que en la primera hoja: "maullar1" (sentado) se iguala a "sentado".
    escalarComo: { propio: 'maullar1', referencia: 'sentado' },
    // En la hoja, los de espaldas están dibujados más chicos: se igualan en alto a uno sentado.
    igualarAlto: { espaldas1: 'maullar1', espaldas2: 'maullar1' },
  },
]

// Se ejecuta en la página: devuelve las cajas de cada dibujo (en pixeles de la hoja).
const DETECTAR = `
function detectar(src, filasEsperadas) {
  return new Promise((listo, falla) => {
    const img = new Image()
    img.onerror = () => falla(new Error('no se pudo leer la imagen'))
    img.onload = () => {
      const W = img.width, H = img.height
      const lienzo = document.createElement('canvas'); lienzo.width = W; lienzo.height = H
      const ctx = lienzo.getContext('2d'); ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, W, H).data
      // Grilla gruesa de bloques: un bloque está "ocupado" si tiene algún pixel visible.
      // Así se unen partes cercanas de un mismo gato (cola, orejas, signos) sin unir gatos distintos.
      const B = 8, bw = Math.ceil(W / B), bh = Math.ceil(H / B)
      const ocupado = new Uint8Array(bw * bh)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) ocupado[Math.floor(y / B) * bw + Math.floor(x / B)] = 1
      const marca = new Int32Array(bw * bh).fill(-1)
      const manchas = []
      for (let i = 0; i < bw * bh; i++) {
        if (!ocupado[i] || marca[i] >= 0) continue
        const id = manchas.length, pila = [i]; marca[i] = id
        let x0 = bw, y0 = bh, x1 = -1, y1 = -1, n = 0
        while (pila.length) {
          const p = pila.pop(), px = p % bw, py = (p - px) / bw; n++
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const qx = px + dx, qy = py + dy
            if (qx < 0 || qy < 0 || qx >= bw || qy >= bh) continue
            const q = qy * bw + qx
            if (ocupado[q] && marca[q] < 0) { marca[q] = id; pila.push(q) }
          }
        }
        manchas.push({ x0: x0 * B, y0: y0 * B, x1: Math.min(W - 1, x1 * B + B - 1), y1: Math.min(H - 1, y1 * B + B - 1), n })
      }
      // Las manchas chicas (signos sueltos, motitas) se suman a la mancha grande más cercana.
      const grandes = manchas.filter(m => m.n >= 40), chicas = manchas.filter(m => m.n < 40)
      const centro = m => [(m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2]
      for (const c of chicas) {
        const [cx, cy] = centro(c)
        let mejor = null, dist = Infinity
        for (const g of grandes) {
          const dx = Math.max(g.x0 - cx, 0, cx - g.x1), dy = Math.max(g.y0 - cy, 0, cy - g.y1)
          const dd = Math.hypot(dx, dy)
          if (dd < dist) { dist = dd; mejor = g }
        }
        if (mejor && dist < 60) { mejor.x0 = Math.min(mejor.x0, c.x0); mejor.y0 = Math.min(mejor.y0, c.y0); mejor.x1 = Math.max(mejor.x1, c.x1); mejor.y1 = Math.max(mejor.y1, c.y1) }
      }
      // Filas: se ordenan por altura y se corta donde hay un salto vertical grande.
      const ordenadas = grandes.slice().sort((a, b) => centro(a)[1] - centro(b)[1])
      const altoMedio = ordenadas.reduce((s, m) => s + (m.y1 - m.y0), 0) / Math.max(1, ordenadas.length)
      const filas = []
      for (const m of ordenadas) {
        const ultima = filas[filas.length - 1]
        if (ultima && Math.abs(centro(m)[1] - centro(ultima[0])[1]) < altoMedio * 0.5) ultima.push(m)
        else filas.push([m])
      }
      filas.forEach(f => f.sort((a, b) => a.x0 - b.x0))
      const conteo = filas.map(f => f.length)
      if (JSON.stringify(conteo) !== JSON.stringify(filasEsperadas)) return falla(new Error('se esperaban filas ' + JSON.stringify(filasEsperadas) + ' y se encontraron ' + JSON.stringify(conteo)))
      // Caja exacta (al pixel) de cada dibujo, dentro de su caja gruesa.
      const cajas = filas.flat().map(m => {
        let x0 = W, y0 = H, x1 = -1, y1 = -1
        for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (d[(y * W + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
        return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
      })
      window.__hoja = lienzo
      listo({ W, H, conteo, cajas })
    }
    img.src = src
  })
}
// Dibuja una caja de la hoja cargada, escalada, apoyada abajo y centrada en un lienzo común.
function exportar(caja, escala, anchoFinal, altoFinal) {
  const [x, y, w, h] = caja
  const r = document.createElement('canvas'); r.width = anchoFinal; r.height = altoFinal
  const ctx = r.getContext('2d'); ctx.imageSmoothingQuality = 'high'
  const ew = Math.round(w * escala), eh = Math.round(h * escala)
  ctx.drawImage(window.__hoja, x, y, w, h, Math.floor((anchoFinal - ew) / 2), altoFinal - eh, ew, eh)
  return r.toDataURL('image/png').split(',')[1]
}`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<html><body></body></html>')
  await win.webContents.executeJavaScript(DETECTAR)
  const js = codigo => win.webContents.executeJavaScript(codigo)

  // 1) Detectar todos los dibujos de todas las hojas.
  const detectadas = []
  for (const hoja of HOJAS) {
    const ruta = path.join(RAIZ, hoja.archivo)
    const tipo = ruta.toLowerCase().endsWith('.png') ? 'png' : 'webp'
    // Embebida: una imagen leída desde file:// no deja leer sus pixeles (canvas "contaminado").
    const src = `data:image/${tipo};base64,` + fs.readFileSync(ruta).toString('base64')
    const r = await js(`detectar(${JSON.stringify(src)}, ${JSON.stringify(hoja.filas)})`).catch(e => {
      throw new Error(`${hoja.archivo}: ${e.message}`)
    })
    detectadas.push({ hoja, src, cajas: r.cajas })
  }

  // 2) Escala de cada hoja (la primera manda) y un lienzo común para todos los dibujos.
  const alturaDe = (nombre) => {
    for (const d of detectadas) {
      const i = d.hoja.nombres.indexOf(nombre)
      if (i >= 0) return d.cajas[i][3]
    }
    throw new Error(`no existe el dibujo ${nombre}`)
  }
  for (const d of detectadas) {
    d.escala = d.hoja.escalarComo ? alturaDe(d.hoja.escalarComo.referencia) / alturaDe(d.hoja.escalarComo.propio) : 1
    const igualar = d.hoja.igualarAlto || {}
    d.escalas = d.hoja.nombres.map((nombre, i) => (igualar[nombre] ? d.escala * (alturaDe(igualar[nombre]) / d.cajas[i][3]) : d.escala))
  }
  const anchoFinal = Math.max(...detectadas.flatMap(d => d.cajas.map((c, i) => Math.round(c[2] * d.escalas[i])))) + 4
  const altoFinal = Math.max(...detectadas.flatMap(d => d.cajas.map((c, i) => Math.round(c[3] * d.escalas[i])))) + 2

  // 3) Exportar.
  fs.mkdirSync(SALIDA, { recursive: true })
  for (const d of detectadas) {
    await js(`detectar(${JSON.stringify(d.src)}, ${JSON.stringify(d.hoja.filas)})`) // carga esta hoja en la página
    for (let i = 0; i < d.cajas.length; i++) {
      const b64 = await js(`exportar(${JSON.stringify(d.cajas[i])}, ${d.escalas[i]}, ${anchoFinal}, ${altoFinal})`)
      fs.writeFileSync(path.join(SALIDA, `${d.hoja.nombres[i]}.png`), Buffer.from(b64, 'base64'))
    }
  }
  fs.writeFileSync(path.join(SALIDA, 'medidas.json'), JSON.stringify({ ancho: anchoFinal, alto: altoFinal }) + '\n')
  console.log('LISTO', JSON.stringify({ lienzo: [anchoFinal, altoFinal], escalas: detectadas.map(d => +d.escala.toFixed(3)), dibujos: detectadas.reduce((n, d) => n + d.cajas.length, 0) }))
  app.quit()
}).catch(error => {
  console.error('ERROR', error.message)
  app.exit(1)
})
