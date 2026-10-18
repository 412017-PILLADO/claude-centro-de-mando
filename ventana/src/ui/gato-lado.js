// El gatito de perfil (mirando a la derecha), para la mascota de escritorio.
// Se dibuja solo la silueta: k = pelaje, e = ojo, n = nariz, c = ojo cerrado, . = vacío.
// El contorno se agrega solo alrededor de la silueta, así se ve sobre fondos claros y oscuros.
;(function () {
  const VACIO = '....................'

  const SILUETAS = {
    caminar1: [
      VACIO,
      '..............kk..kk',
      '..............kkkkkk',
      '..............kkkekk',
      'k.............kkkkkn',
      'k....kkkkkkkkkkkkkk.',
      '.k..kkkkkkkkkkkkkkk.',
      '..kkkkkkkkkkkkkkkk..',
      '....kkkkkkkkkkkkkk..',
      '....kk..kk...kk..kk.',
      '....kk..kk...kk..kk.',
      '...kk....kk.kk....kk',
    ],
    caminar2: [
      VACIO,
      '..............kk..kk',
      '..............kkkkkk',
      '..............kkkekk',
      'k.............kkkkkn',
      'k....kkkkkkkkkkkkkk.',
      '.k..kkkkkkkkkkkkkkk.',
      '..kkkkkkkkkkkkkkkk..',
      '....kkkkkkkkkkkkkk..',
      '.....kk.kk.....kkkk.',
      '.....kk.kk.....kkkk.',
      '......kkk.......kk..',
    ],
    sentado: [
      '........kk..kk......',
      '........kkkkkk......',
      '........kkkkek......',
      '........kkkkkkn.....',
      '.......kkkkkk.......',
      '......kkkkkkk.......',
      '.....kkkkkkkk.......',
      '.....kkkkkkkk.......',
      '.....kkkkkkkk.......',
      '.kk..kkkkkkkk.......',
      '.kkkkkkkkkkkkk......',
      '..kkkkkkkkkk........',
    ],
    dormido: [
      VACIO,
      VACIO,
      VACIO,
      VACIO,
      VACIO,
      '.........kk..kk.....',
      '......kkkkkkkkkk....',
      '....kkkkkkkkkkkkkk..',
      '...kkkkkkkkkkkkckkk.',
      '..kkkkkkkkkkkkkkkkk.',
      '.kkkkkkkkkkkkkkkkkk.',
      '...kkkkkkkkkkkkkkk..',
    ],
  }

  const COLORES = {
    o: '#64748b', // contorno
    k: '#0b0b10', // pelaje
    e: '#facc15', // ojo
    n: '#f472b6', // nariz
    c: '#94a3b8', // ojo cerrado
  }

  // Agrega un pixel de margen y pinta de contorno cada vacío que toca la silueta.
  function conContorno(silueta) {
    const ancho = silueta[0].length + 2
    const grilla = ['.'.repeat(ancho), ...silueta.map(fila => `.${fila}.`), '.'.repeat(ancho)].map(fila => [...fila])
    const lleno = (x, y) => grilla[y] && grilla[y][x] && grilla[y][x] !== '.' && grilla[y][x] !== 'o'
    return grilla.map((fila, y) =>
      fila
        .map((letra, x) => {
          if (letra !== '.') return letra
          return lleno(x - 1, y) || lleno(x + 1, y) || lleno(x, y - 1) || lleno(x, y + 1) ? 'o' : '.'
        })
        .join(''),
    )
  }

  const CUADROS = {}
  for (const [nombre, silueta] of Object.entries(SILUETAS)) CUADROS[nombre] = conContorno(silueta)

  window.GATO_LADO = { CUADROS, COLORES }
})()
