// Instala todo con un solo comando: node instalar.js
//   1. el plugin "centro-de-mando" en Claude Code (para todas tus sesiones),
//   2. la app del gatito (npm install; en Windows además crea el acceso directo en el menú Inicio),
//   3. y la abre. La primera vez se abre la bienvenida para elegir qué mostrar.
// Con --solo-mascota se saltea Claude Code: queda el gatito solo, sin conexiones.
// Se puede correr de nuevo para actualizar: no duplica nada.
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = __dirname
const VENTANA = path.join(RAIZ, 'ventana')
const MARKETPLACE = 'centro-de-mando'
const PLUGIN = `centro-de-mando@${MARKETPLACE}`
const enWindows = process.platform === 'win32'
const enMac = process.platform === 'darwin'
const soloMascota = process.argv.includes('--solo-mascota')

function correr(comando, args, opciones = {}) {
  const resultado = spawnSync(comando, args, { encoding: 'utf8', shell: enWindows, ...opciones })
  return { ok: resultado.status === 0, salida: ((resultado.stdout || '') + (resultado.stderr || '')).trim() }
}

function paso(titulo) {
  console.log(`\n▸ ${titulo}`)
}

function fallar(mensaje) {
  console.error(`\n✗ ${mensaje}`)
  process.exit(1)
}

// --- requisitos ------------------------------------------------------------

paso('Revisando requisitos')
if (!enWindows && !enMac) fallar('Por ahora el gatito funciona en Windows y macOS.')
// En Windows la descarga de Electron es propia y anda con Node 14; en macOS usa el instalador de Electron, que pide Node 22.
const [mayor, menor] = process.versions.node.split('.').map(Number)
const nodeMinimo = enWindows ? '14' : '22.12'
if (enWindows ? mayor < 14 : mayor < 22 || (mayor === 22 && menor < 12)) fallar(`Hace falta Node ${nodeMinimo} o más nuevo para instalar (tenés ${process.versions.node}). La app después usa su propio Node.`)
if (!soloMascota && !correr('claude', ['--version']).ok) fallar('No encontré Claude Code ("claude" en la terminal). Instalalo (https://code.claude.com) o corré "node instalar.js --solo-mascota" para tener solo el gatito.')
console.log(`  Node ${process.versions.node}${soloMascota ? '' : ' y Claude Code'}: ok`)

// --- plugin ------------------------------------------------------------------

// Si el repo vino de GitHub, el marketplace apunta ahí (así "claude plugin update" trae lo nuevo);
// si no, a esta carpeta.
function origen() {
  const remoto = correr('git', ['-C', RAIZ, 'remote', 'get-url', 'origin'])
  const github = remoto.ok && /github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/.exec(remoto.salida)
  return github ? github[1] : RAIZ
}

if (!soloMascota) {
  paso('Instalando el plugin en Claude Code')
  const fuente = origen()
  const yaEsta = correr('claude', ['plugin', 'marketplace', 'list']).salida.includes(MARKETPLACE)
  const marketplace = yaEsta
    ? correr('claude', ['plugin', 'marketplace', 'update', MARKETPLACE])
    : correr('claude', ['plugin', 'marketplace', 'add', fuente])
  if (!marketplace.ok) fallar(`No pude agregar el marketplace desde ${fuente}:\n${marketplace.salida}`)

  const instalado = correr('claude', ['plugin', 'list']).salida.includes(PLUGIN)
  const plugin = instalado
    ? correr('claude', ['plugin', 'update', PLUGIN])
    : correr('claude', ['plugin', 'install', PLUGIN, '--scope', 'user'])
  if (!plugin.ok) fallar(`No pude instalar el plugin:\n${plugin.salida}`)
  console.log(`  ${instalado ? 'Actualizado' : 'Instalado'} desde ${fuente}`)
}

// --- ventana -----------------------------------------------------------------

paso('Instalando la app del gatito (puede tardar un minuto: descarga Electron)')
const npm = correr('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: VENTANA, stdio: 'inherit' })
if (!npm.ok) fallar('Falló "npm install" en la carpeta ventana.')

paso('Abriendo el gatito')
// El paquete de Electron sabe dónde quedó su programa en cada sistema.
let electron = null
try { electron = require(path.join(VENTANA, 'node_modules', 'electron')) } catch { /* sin Electron */ }
if (electron && fs.existsSync(electron)) {
  // Si ya estaba abierto, la app abre el centro en vez de duplicarse.
  spawn(electron, [VENTANA], { cwd: VENTANA, detached: true, stdio: 'ignore' }).unref()
  console.log('  Listo: el gatito ya está en tu escritorio. Tocalo para abrir el centro de mando.')
} else {
  console.log('  No encontré Electron; abrilo con "npm start" dentro de la carpeta ventana.')
}

console.log(soloMascota ? `
✓ Instalación terminada. El gatito arranca solo cuando prendés la compu (se cambia en Ajustes).
` : `
✓ Instalación terminada. El gatito arranca solo cuando prendés la compu (se cambia en Ajustes).

Para sumar tus reuniones y tickets (opcional):
  • Conectá Google Calendar y/o Jira (Atlassian) en claude.ai → Configuración → Conectores.
  • Reiniciá las sesiones de Claude abiertas para que carguen el plugin.
  • En Ajustes del gatito elegís qué mostrar. Sin conectores, el gatito funciona igual.
`)
