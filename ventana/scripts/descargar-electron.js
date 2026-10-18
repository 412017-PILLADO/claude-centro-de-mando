// Descarga el programa de Electron sin depender del Node de la PC.
//
// El instalador que trae Electron 44 pide Node 22.12+, y en muchos equipos se usa un
// Node más viejo por las librerías del trabajo. Este script hace lo mismo con lo básico
// de Node (corre desde Node 14): baja el zip oficial, verifica su SHA-256 contra la lista
// que viene en el paquete de Electron y lo descomprime con el tar de Windows.
// La app después usa el Node que Electron trae adentro, no el de la PC.
//
// ELECTRON_MIRROR cambia de dónde se baja (por ejemplo, un espejo interno de la empresa).
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ELECTRON = path.join(__dirname, '..', 'node_modules', 'electron')
const DIST = path.join(ELECTRON, 'dist')

function fallar(mensaje) {
  console.error('No pude descargar Electron: ' + mensaje)
  process.exit(1)
}

if (process.platform !== 'win32') {
  // Fuera de Windows se usa el instalador original de Electron.
  const original = spawnSync(process.execPath, [path.join(ELECTRON, 'install.js')], { stdio: 'inherit' })
  process.exit(original.status === null ? 1 : original.status)
}

const version = require(path.join(ELECTRON, 'package.json')).version
const arch = process.env.npm_config_arch || process.arch
const archivo = 'electron-v' + version + '-win32-' + arch + '.zip'
const sumaEsperada = require(path.join(ELECTRON, 'checksums.json'))[archivo]
if (!sumaEsperada) fallar('no hay versión para esta arquitectura (' + arch + ').')

function yaInstalado() {
  try {
    return (
      fs.readFileSync(path.join(DIST, 'version'), 'utf8').replace(/^v/, '') === version &&
      fs.existsSync(path.join(DIST, 'electron.exe'))
    )
  } catch (error) {
    return false
  }
}

function descargar(url, destino, saltos) {
  return new Promise(function (listo, error) {
    https
      .get(url, { headers: { 'User-Agent': 'centro-de-mando' } }, function (respuesta) {
        if (respuesta.statusCode >= 300 && respuesta.statusCode < 400 && respuesta.headers.location) {
          respuesta.resume()
          if (saltos > 5) return error(new Error('demasiadas redirecciones'))
          return listo(descargar(new URL(respuesta.headers.location, url).toString(), destino, saltos + 1))
        }
        if (respuesta.statusCode !== 200) {
          respuesta.resume()
          return error(new Error('el servidor respondió ' + respuesta.statusCode + ' para ' + url))
        }
        const total = Number(respuesta.headers['content-length']) || 0
        let recibido = 0
        let ultimoAviso = 0
        const salida = fs.createWriteStream(destino)
        respuesta.on('data', function (pedazo) {
          recibido += pedazo.length
          const porcentaje = total ? Math.floor((recibido / total) * 100) : 0
          if (porcentaje >= ultimoAviso + 10) {
            ultimoAviso = porcentaje - (porcentaje % 10)
            process.stdout.write('  ' + ultimoAviso + '%')
          }
        })
        respuesta.pipe(salida)
        salida.on('finish', function () {
          process.stdout.write('\n')
          salida.close(listo)
        })
        salida.on('error', error)
      })
      .on('error', error)
  })
}

function sha256(ruta) {
  return new Promise(function (listo, error) {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(ruta)
      .on('data', function (pedazo) {
        hash.update(pedazo)
      })
      .on('end', function () {
        listo(hash.digest('hex'))
      })
      .on('error', error)
  })
}

function descomprimir(zip) {
  fs.rmSync ? fs.rmSync(DIST, { recursive: true, force: true }) : spawnSync('cmd', ['/c', 'rmdir', '/s', '/q', DIST])
  fs.mkdirSync(DIST, { recursive: true })
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  if (fs.existsSync(tar) && spawnSync(tar, ['-xf', zip, '-C', DIST], { stdio: 'inherit' }).status === 0) return
  const comando = "Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + DIST.replace(/'/g, "''") + "' -Force"
  if (spawnSync('powershell.exe', ['-NoProfile', '-Command', comando], { stdio: 'inherit' }).status !== 0) {
    fallar('no pude descomprimir ' + zip)
  }
}

async function principal() {
  if (yaInstalado()) {
    console.log('Electron ' + version + ' ya estaba descargado.')
    return
  }
  const base = (process.env.ELECTRON_MIRROR || 'https://github.com/electron/electron/releases/download/').replace(/\/?$/, '/')
  const url = base + 'v' + version + '/' + archivo
  const zip = path.join(os.tmpdir(), archivo)

  console.log('Descargando Electron ' + version + ' (~110 MB)…')
  await descargar(url, zip, 0)

  const suma = await sha256(zip)
  if (suma !== sumaEsperada) {
    fs.unlinkSync(zip)
    fallar('la firma del archivo no coincide (se esperaba ' + sumaEsperada + ', llegó ' + suma + ').')
  }

  descomprimir(zip)
  const tipos = path.join(DIST, 'electron.d.ts')
  if (fs.existsSync(tipos)) fs.renameSync(tipos, path.join(ELECTRON, 'electron.d.ts'))
  fs.writeFileSync(path.join(ELECTRON, 'path.txt'), 'electron.exe')
  fs.unlinkSync(zip)
  console.log('Electron ' + version + ' listo.')
}

principal().catch(function (error) {
  fallar(error.message + (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET/.test(error.message) ? ' (¿hay un proxy? probá con ELECTRON_MIRROR)' : ''))
})
