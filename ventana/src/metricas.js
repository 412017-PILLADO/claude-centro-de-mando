// Medición de consumo (CENTRO_METRICAS=1): CPU y memoria de cada proceso de la app, una línea JSON por muestra.
const fs = require('node:fs')
const path = require('node:path')

function muestra(app) {
  const procesos = app.getAppMetrics().map(p => ({
    tipo: p.name ? `${p.type}:${p.name}` : p.type,
    cpu: Math.round(p.cpu.percentCPUUsage * 100) / 100,
    mb: Math.round(p.memory.workingSetSize / 1024),
  }))
  const total = procesos.reduce((t, p) => ({ cpu: t.cpu + p.cpu, mb: t.mb + p.mb }), { cpu: 0, mb: 0 })
  return { t: Date.now(), cpu: Math.round(total.cpu * 100) / 100, mb: total.mb, procesos }
}

function iniciar(app, { cadaMs = 10_000 } = {}) {
  const archivo = path.join(app.getPath('userData'), 'metricas.jsonl')
  fs.writeFileSync(archivo, '')
  console.log('Métricas en', archivo)
  // La primera lectura de CPU siempre da 0: se descarta.
  app.getAppMetrics()
  return setInterval(() => fs.appendFileSync(archivo, JSON.stringify(muestra(app)) + '\n'), cadaMs)
}

module.exports = { iniciar, muestra }
