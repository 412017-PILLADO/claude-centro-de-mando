// Abrir la app al iniciar sesión en la compu, en Windows, macOS y Linux.
// Sin empaquetar, la app es "electron <carpeta>": hay que registrar los dos. En macOS,
// setLoginItemSettings ignora los argumentos y abriría un Electron vacío, por eso se usa un LaunchAgent.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ETIQUETA = 'com.centro-de-mando.gatito'

const comando = app => (app.isPackaged ? [process.execPath] : [process.execPath, app.getAppPath()])

const escaparXml = texto => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function plistMac(argumentos) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${ETIQUETA}</string>
  <key>ProgramArguments</key>
  <array>
${argumentos.map(a => `    <string>${escaparXml(a)}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`
}

function escritorioLinux(argumentos) {
  return `[Desktop Entry]
Type=Application
Name=Centro de mando
Exec=${argumentos.map(a => `"${a.replace(/(["\\$`])/g, '\\$1')}"`).join(' ')}
X-GNOME-Autostart-enabled=true
`
}

function archivoDeInicio(plataforma = process.platform, casa = os.homedir()) {
  if (plataforma === 'darwin') return path.join(casa, 'Library', 'LaunchAgents', `${ETIQUETA}.plist`)
  if (plataforma === 'linux') return path.join(casa, '.config', 'autostart', 'centro-de-mando.desktop')
  return null
}

function escribirOBorrar(archivo, contenido, activo) {
  if (!activo) return fs.rmSync(archivo, { force: true })
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  fs.writeFileSync(archivo, contenido)
}

// Deja el inicio automático como dice la config. Se llama al arrancar: si se movió la carpeta, se corrige la ruta.
function aplicar(app, activo) {
  const argumentos = comando(app)
  try {
    if (process.platform === 'win32' || (process.platform === 'darwin' && app.isPackaged)) {
      app.setLoginItemSettings({ openAtLogin: activo, path: argumentos[0], args: argumentos.slice(1) })
    } else if (process.platform === 'darwin') {
      escribirOBorrar(archivoDeInicio(), plistMac(argumentos), activo)
    } else if (process.platform === 'linux') {
      escribirOBorrar(archivoDeInicio(), escritorioLinux(argumentos), activo)
    }
  } catch (error) {
    console.error('No se pudo configurar el inicio automático:', error.message)
  }
}

module.exports = { aplicar, plistMac, escritorioLinux, archivoDeInicio, ETIQUETA }
