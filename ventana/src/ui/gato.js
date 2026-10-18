// Gatito negro en pixel art, 16×16. Lo usan la barra (SVG), la bandeja y el acceso directo (PNG/ICO).
// Se dibuja la mitad izquierda y se espeja: o = contorno, k = pelaje, e = ojo, n = nariz, . = vacío.
;(function (exportar) {
  const MITAD = [
    '..o.....',
    '.oko....',
    '.okko...',
    '.okkkooo',
    'okkkkkkk',
    'okkkkkkk',
    'okkeekkk',
    'okkeekkk',
    'okkkkkkk',
    'okkkkkkn',
    '.okkkkkk',
    '..okkkkk',
    '.okkkkkk',
    'okkkkkkk',
    'okkkkkkk',
    '.ooooooo',
  ]

  const PIXELES = MITAD.map(fila => fila + [...fila].reverse().join(''))

  const COLORES = {
    o: '#64748b',
    k: '#0b0b10',
    e: '#facc15',
    n: '#f472b6',
  }

  exportar({ PIXELES, COLORES })
})(
  typeof module !== 'undefined'
    ? valor => (module.exports = valor)
    : valor => (window.GATO = valor),
)
