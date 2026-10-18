// Crea (o actualiza) el acceso directo "Centro de mando" en el menú Inicio de Windows.
// Corre solo después de "npm install"; también a mano con "npm run acceso-directo".
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { gatoIco } = require('../src/icono')

const raiz = path.resolve(__dirname, '..')
const electron = path.join(raiz, 'node_modules', 'electron', 'dist', 'electron.exe')
const icono = path.join(raiz, 'icono.ico')

// Nunca rompe la instalación: si no puede crear el acceso, avisa y sigue.
function omitir(motivo) {
  console.warn(`Acceso directo no creado: ${motivo}`)
  process.exit(0)
}

if (process.platform !== 'win32') omitir('es solo para Windows.')
if (!fs.existsSync(electron)) omitir('falta Electron (corré "npm install").')

fs.writeFileSync(icono, gatoIco())

const menuInicio = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Centro de mando.lnk')
const comillas = texto => `'${texto.replace(/'/g, "''")}'`
const script = [
  `$acceso = (New-Object -ComObject WScript.Shell).CreateShortcut(${comillas(menuInicio)})`,
  `$acceso.TargetPath = ${comillas(electron)}`,
  `$acceso.Arguments = ${comillas(`"${raiz}"`)}`,
  `$acceso.WorkingDirectory = ${comillas(raiz)}`,
  `$acceso.IconLocation = ${comillas(icono)}`,
  `$acceso.Description = 'Centro de mando de Claude'`,
  '$acceso.Save()',
].join('; ')

try {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'inherit' })
} catch (error) {
  omitir(error.message)
}

console.log('Acceso directo listo: buscá "Centro de mando" en el menú Inicio.')
