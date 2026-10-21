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
// Sumamos las poses de pared sin reinterpolar los sprites que ya estaban.
const ANTERIORES = new Set(require('../arte/hashes-antes-pared.json').map(d=>d.archivo))

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
  {
    archivo: 'arte/gatito-hoja-3.webp',
    filas: [6],
    nombres: ['mirar1', 'mirar2', 'agazapado1', 'agazapado2', 'pata1', 'pata2'],
    escalarComo: { propio: 'mirar1', referencia: 'sentado' },
    // En la hoja, el segundo agazapado mira a la izquierda: se espeja para que mire a la derecha como el resto.
    espejar: ['agazapado2'],
  },
  {
    archivo: 'arte/gatito-hoja-4.webp',
    minMancha: 100,
    distanciaMotitas: 100,
    filas: [8, 10],
    nombres: ['pensar1', 'pensar2', 'pensar3', 'pensar4', 'pensar5', 'pensar6', 'pensar7', 'pensar8',
      'alzar0', 'alzar1', 'alzar2', 'colgar1', 'colgar2', 'colgar3', 'colgar4', 'caer1', 'aterrizar1', 'alzar-fin'],
    escalarComo: { propio: 'alzar0', referencia: 'sentado' },
    // Zonas de las manos, antes de detectar las manchas (coordenadas relativas).
    descartar: [[.114,.62,.052,.105], [.211,.59,.052,.095], [.325,.53,.05,.095],
      [.432,.53,.048,.095], [.527,.53,.048,.095], [.622,.53,.047,.095], [.726,.57,.056,.105], [.906,.70,.008,.26]],
  },
  {
    archivo: 'arte/gatito-hoja-5.png',
    filas: [4, 2, 2, 2, 3],
    nombres: ['comer1', 'comer2', 'comer3', 'comer4', 'cuenco-vacio', 'cuenco-lleno',
      'ronronear1', 'ronronear2', 'pedir1', 'pedir2', 'ovillo1', 'ovillo2', 'ovillo3'],
    escalarComo: { propio: 'ronronear1', referencia: 'sentado' },
    limpiarAlfa: 180,
    // Zonas separadas para conservar el cuenco y los corazones junto a cada pose.
    zonas: [[0,.09,.25,.18], [.25,.09,.25,.18], [.5,.09,.25,.18], [.75,.09,.25,.18],
      [.24,.32,.19,.07], [.56,.32,.18,.07], [.18,.425,.29,.18], [.51,.425,.29,.18],
      [.1,.62,.35,.17], [.5,.62,.38,.17], [0,.81,.375,.18], [.375,.81,.31,.18], [.685,.81,.315,.18]],
  },
]
HOJAS.push(require('../arte/transiciones.json'), require('../arte/movimientos.json'), require('../arte/cuidados.json'), require('../arte/pared.json'))

// Se ejecuta en la página: devuelve las cajas de cada dibujo (en pixeles de la hoja).
const DETECTAR = `
function detectar(src, filasEsperadas, opciones = {}) {
  return new Promise((listo, falla) => {
    const img = new Image()
    img.onerror = () => falla(new Error('no se pudo leer la imagen'))
    img.onload = () => {
      const W = img.width, H = img.height
      const lienzo = document.createElement('canvas'); lienzo.width = W; lienzo.height = H
      const ctx = lienzo.getContext('2d'); ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, W, H).data
      let transparentes = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] < 40) transparentes++
      if (opciones.limpiarAlfa) for (let i = 3; i < d.length; i += 4) if (d[i] < opciones.limpiarAlfa) d[i] = 0
      // Fondo claro conectado al borde; no borra blancos dentro del dibujo.
      if (opciones.quitarFondoClaro) {
        const vistos = new Uint8Array(W * H), pila = []
        const agregar = p => {
          if (vistos[p]) return
          vistos[p] = 1
          const i = p * 4
          if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) { d[i + 3] = 0; pila.push(p) }
        }
        for (let x = 0; x < W; x++) { agregar(x); agregar((H - 1) * W + x) }
        for (let y = 0; y < H; y++) { agregar(y * W); agregar(y * W + W - 1) }
        while (pila.length) {
          const p = pila.pop(), x = p % W, y = Math.floor(p / W)
          if (x) agregar(p - 1)
          if (x + 1 < W) agregar(p + 1)
          if (y) agregar(p - W)
          if (y + 1 < H) agregar(p + W)
        }
      }
      for (const [x, y, w, h] of opciones.descartar || []) {
        for (let py = Math.floor(y * H); py < Math.ceil((y + h) * H); py++)
          for (let px = Math.floor(x * W); px < Math.ceil((x + w) * W); px++) d[(py * W + px) * 4 + 3] = 0
      }
      if (opciones.descartar || opciones.quitarFondoClaro || opciones.limpiarAlfa) ctx.putImageData(new ImageData(d, W, H), 0, 0)
      if (opciones.zonas) {
        const cajas = opciones.zonas.map(([x, y, w, h]) => {
          let x0 = W, y0 = H, x1 = -1, y1 = -1
          for (let py = Math.floor(y * H); py < Math.min(H, Math.ceil((y + h) * H)); py++)
            for (let px = Math.floor(x * W); px < Math.min(W, Math.ceil((x + w) * W)); px++)
              if (d[(py * W + px) * 4 + 3] > 40) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py) }
          if (x1 < x0) throw new Error('zona sin dibujo')
          return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
        })
        window.__hoja = lienzo
        return listo({ W, H, cajas, conteo: filasEsperadas, transparente: transparentes > 0 })
      }
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
      const minimo = opciones.minMancha || 40
      const grandes = manchas.filter(m => m.n >= minimo), chicas = manchas.filter(m => m.n < minimo)
      const centro = m => [(m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2]
      for (const c of chicas) {
        const [cx, cy] = centro(c)
        let mejor = null, dist = Infinity
        for (const g of grandes) {
          const dx = Math.max(g.x0 - cx, 0, cx - g.x1), dy = Math.max(g.y0 - cy, 0, cy - g.y1)
          const dd = Math.hypot(dx, dy)
          if (dd < dist) { dist = dd; mejor = g }
        }
        if (mejor && dist < (opciones.distanciaMotitas || 60)) { mejor.x0 = Math.min(mejor.x0, c.x0); mejor.y0 = Math.min(mejor.y0, c.y0); mejor.x1 = Math.max(mejor.x1, c.x1); mejor.y1 = Math.max(mejor.y1, c.y1) }
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
      listo({ W, H, conteo, cajas, transparente: transparentes > 0 })
    }
    img.src = src
  })
}
// Dibuja una caja de la hoja cargada, escalada, apoyada abajo y centrada en un lienzo común (espejada si se pide).
function exportar(caja, escala, anchoFinal, altoFinal, espejo, alinearDerecha) {
  const [x, y, w, h] = caja
  const r = document.createElement('canvas'); r.width = anchoFinal; r.height = altoFinal
  const ctx = r.getContext('2d'); ctx.imageSmoothingQuality = 'high'
  if (espejo) { ctx.translate(anchoFinal, 0); ctx.scale(-1, 1) }
  const ew = Math.round(w * escala), eh = Math.round(h * escala)
  ctx.drawImage(window.__hoja, x, y, w, h, alinearDerecha ? anchoFinal - ew : Math.floor((anchoFinal - ew) / 2), altoFinal - eh, ew, eh)
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
    const r = await js(`detectar(${JSON.stringify(src)}, ${JSON.stringify(hoja.filas)}, ${JSON.stringify(hoja)})`).catch(e => {
      throw new Error(`${hoja.archivo}: ${e.message}`)
    })
    detectadas.push({ hoja, src, cajas: r.cajas })
    console.log(hoja.archivo, JSON.stringify({ ancho: r.W, alto: r.H, transparente: r.transparente, filas: r.conteo }))
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
  // Conserva el lienzo original; los adornos nuevos se ajustan para entrar.
  const anchoFinal = 288
  const altoFinal = 237
  for (const d of detectadas.slice(3)) d.escalas = d.escalas.map((e, i) => Math.min(e, 284 / d.cajas[i][2], 235 / d.cajas[i][3]))

  // 3) Exportar.
  fs.mkdirSync(SALIDA, { recursive: true })
  for (const d of detectadas) {
    await js(`detectar(${JSON.stringify(d.src)}, ${JSON.stringify(d.hoja.filas)}, ${JSON.stringify(d.hoja)})`) // carga esta hoja en la página
    for (let i = 0; i < d.cajas.length; i++) {
      const archivo = `${d.hoja.nombres[i]}.png`, original = path.join(RAIZ,'src','ui','sprites',archivo)
      if(ANTERIORES.has(archivo) && fs.existsSync(original) && process.env.CENTRO_REGENERAR_ANTERIORES !== '1'){
        const destino=path.join(SALIDA,archivo)
        if(path.resolve(destino)!==path.resolve(original))fs.copyFileSync(original,destino)
        continue
      }
      const espejo = (d.hoja.espejar || []).includes(d.hoja.nombres[i])
      const b64 = await js(`exportar(${JSON.stringify(d.cajas[i])}, ${d.escalas[i]}, ${anchoFinal}, ${altoFinal}, ${espejo}, ${!!d.hoja.alinearDerecha})`)
      fs.writeFileSync(path.join(SALIDA, `${d.hoja.nombres[i]}.png`), Buffer.from(b64, 'base64'))
    }
  }
  // La pose final de la hoja 4 es el segundo tiempo del aterrizaje: recupera la postura.
  fs.copyFileSync(path.join(SALIDA, 'alzar-fin.png'), path.join(SALIDA, 'aterrizar2.png'))
  fs.writeFileSync(path.join(SALIDA, 'medidas.json'), JSON.stringify({ ancho: anchoFinal, alto: altoFinal }) + '\n')
  console.log('LISTO', JSON.stringify({ lienzo: [anchoFinal, altoFinal], escalas: detectadas.map(d => +d.escala.toFixed(3)), dibujos: detectadas.reduce((n, d) => n + d.cajas.length, 0) }))
  app.quit()
}).catch(error => {
  console.error('ERROR', error.message)
  app.exit(1)
})
