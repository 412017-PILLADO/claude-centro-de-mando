// Instala todo con un solo comando: node instalar.js
//   1. el plugin "centro-de-mando" en Claude Code (para todas tus sesiones),
//   2. la ventana flotante (npm install, que además crea el acceso directo en el menú Inicio),
//   3. y la abre.
// Se puede correr de nuevo para actualizar: no duplica nada.
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = __dirname
const VENTANA = path.join(RAIZ, 'ventana')
const MARKETPLACE = 'centro-de-mando'
const PLUGIN = `centro-de-mando@${MARKETPLACE}`
const enWindows = process.platform === 'win32'

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
const versionNode = Number(process.versions.node.split('.')[0])
if (versionNode < 14) fallar(`Hace falta Node 14 o más nuevo para instalar (tenés ${process.versions.node}). La app después usa su propio Node.`)
if (!correr('claude', ['--version']).ok) fallar('No encontré Claude Code ("claude" en la terminal). Instalalo primero: https://code.claude.com')
console.log(`  Node ${process.versions.node} y Claude Code: ok`)

// --- plugin ------------------------------------------------------------------

// Si el repo vino de GitHub, el marketplace apunta ahí (así "claude plugin update" trae lo nuevo);
// si no, a esta carpeta.
function origen() {
  const remoto = correr('git', ['-C', RAIZ, 'remote', 'get-url', 'origin'])
  const github = remoto.ok && /github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/.exec(remoto.salida)
  return github ? github[1] : RAIZ
}

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

// --- ventana -----------------------------------------------------------------

paso('Instalando la ventana flotante (puede tardar un minuto: descarga Electron)')
const npm = correr('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: VENTANA, stdio: 'inherit' })
if (!npm.ok) fallar('Falló "npm install" en la carpeta ventana.')

paso('Abriendo la ventana')
const electron = path.join(VENTANA, 'node_modules', 'electron', 'dist', enWindows ? 'electron.exe' : 'electron')
if (fs.existsSync(electron)) {
  spawn(electron, [VENTANA], { cwd: VENTANA, detached: true, stdio: 'ignore' }).unref()
  console.log('  Listo: la vas a ver arriba a la derecha (Ctrl+Alt+Espacio la muestra u oculta).')
} else {
  console.log('  No encontré Electron; abrila con "npm start" dentro de la carpeta ventana.')
}

console.log(`
✓ Instalación terminada.

Falta una sola cosa, en Claude (una vez):
  • Conectá Jira (Atlassian) y Google Calendar en Settings → Connectors de claude.ai,
    con tu cuenta del trabajo. Sin ellos, la ventana funciona pero sin tickets ni reuniones.
  • Reiniciá las sesiones de Claude que tengas abiertas para que carguen el plugin.
`)
