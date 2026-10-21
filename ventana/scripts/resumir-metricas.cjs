// Resume un metricas.jsonl: promedio y máximo de CPU y memoria, total y por proceso.
// Uso: node scripts/resumir-metricas.cjs <ruta a metricas.jsonl>
const fs = require('node:fs')

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/resumir-metricas.cjs <metricas.jsonl>')
  process.exit(1)
}
const muestras = fs.readFileSync(archivo, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
if (!muestras.length) {
  console.error('Sin muestras')
  process.exit(1)
}
const resumen = valores => {
  const prom = valores.reduce((a, b) => a + b, 0) / valores.length
  return `prom ${prom.toFixed(2)} · máx ${Math.max(...valores).toFixed(2)}`
}
console.log(`${muestras.length} muestras, ${Math.round((muestras.at(-1).t - muestras[0].t) / 1000)} s`)
console.log(`Total  CPU % ${resumen(muestras.map(m => m.cpu))} | MB ${resumen(muestras.map(m => m.mb))}`)
const tipos = [...new Set(muestras.flatMap(m => m.procesos.map(p => p.tipo)))]
for (const tipo of tipos) {
  const de = muestras.flatMap(m => m.procesos.filter(p => p.tipo === tipo))
  console.log(`${tipo.padEnd(22)} CPU % ${resumen(de.map(p => p.cpu))} | MB ${resumen(de.map(p => p.mb))}`)
}
