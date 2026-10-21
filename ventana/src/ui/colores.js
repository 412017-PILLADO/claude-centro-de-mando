// Se conserva el color de ojos, orejas y adornos. Cada variante se calcula una sola vez.
window.pintarGatito = (() => {
  const cache = new Map()
  const paleta = { gris: [115, 122, 140], naranja: [205, 120, 55], crema: [229, 216, 182], siames: [220, 202, 167], atigrado: [181, 125, 68] }
  return (nombre, color = 'negro') => {
    const ruta = `sprites/${nombre}.png`
    if (!paleta[color]) return Promise.resolve(ruta)
    const clave = `${nombre}:${color}`
    if (!cache.has(clave)) cache.set(clave, new Promise((listo, falla) => {
      const img = new Image()
      img.onerror = falla
      img.onload = () => {
        const lienzo = document.createElement('canvas')
        lienzo.width = img.width; lienzo.height = img.height
        const ctx = lienzo.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const pixeles = ctx.getImageData(0, 0, img.width, img.height), d = pixeles.data
        // La mancha oscura principal es el cuerpo; las pupilas y signos quedan afuera.
        const candidatos = new Uint8Array(img.width * img.height)
        for (let p = 0; p < candidatos.length; p++) {
          const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2]
          candidatos[p] = d[i + 3] > 40 && Math.max(r, g, b) < 105 && b >= r && b >= g && b - r < 45 ? 1 : 0
        }
        let cuerpo = []
        for (let p = 0; p < candidatos.length; p++) {
          if (!candidatos[p]) continue
          const pila = [p], mancha = []
          candidatos[p] = 0
          while (pila.length) {
            const q = pila.pop(), x = q % img.width, y = Math.floor(q / img.width)
            mancha.push(q)
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy, n = ny * img.width + nx
              if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height && candidatos[n]) { candidatos[n] = 0; pila.push(n) }
            }
          }
          if (mancha.length > cuerpo.length) cuerpo = mancha
        }
        for (const p of cuerpo) {
          const y = Math.floor(p / img.width), x = p % img.width
          const i = (y * img.width + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]
          if (d[i + 3] && Math.max(r, g, b) >= 14 && Math.max(r, g, b) < 105 && b >= r && b >= g && b - r < 45) {
            const luz = Math.max(r, g, b) / 65
            const patron = color === 'siames' ? (y < img.height * .55 || y > img.height * .9 ? .4 : 1) : color === 'atigrado' ? (Math.sin(x * .17 + Math.sin(y * .08) * 2) > .65 ? .45 : 1) : 1
            paleta[color].map(v => v * patron).forEach((v, c) => { d[i + c] = Math.min(255, v * (.35 + luz * .65)) })
          }
        }
        ctx.putImageData(pixeles, 0, 0)
        listo(lienzo.toDataURL())
      }
      img.src = ruta
    }))
    return cache.get(clave)
  }
})()
