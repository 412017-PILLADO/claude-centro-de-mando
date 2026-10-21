// Corre una copia aislada de la app durante N segundos con métricas y la cierra.
// Uso: node scripts/medir.cjs <carpeta de salida> [segundos=180]
// Copia ~/.claude/centro a la salida para no tocar los datos reales.
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const salida = path.resolve(process.argv[2] || 'medicion')
const segundos = Number(process.argv[3] || 180)
const datos = path.join(salida, 'centro')
fs.rmSync(salida, { recursive: true, force: true })
const origen = path.join(os.homedir(), '.claude', 'centro')
if (fs.existsSync(origen)) fs.cpSync(origen, datos, { recursive: true })
else fs.mkdirSync(datos, { recursive: true })
const electron = require('electron')
const app = spawn(electron, [path.join(__dirname, '..')], {
  env: { ...process.env, CENTRO_METRICAS: '1', CENTRO_DATOS: datos, CENTRO_PERFIL: path.join(salida, 'perfil') },
  stdio: 'ignore',
})
setTimeout(() => {
  if (process.platform === 'win32') execSync(`taskkill /PID ${app.pid} /T /F`, { stdio: 'ignore' })
  else app.kill()
  console.log(path.join(salida, 'perfil', 'metricas.jsonl'))
}, segundos * 1000)
