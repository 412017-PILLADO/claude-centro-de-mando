// Pruebas de las fuentes: solo se muestran las activas que existen; sin ninguna, el gatito queda solo.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { visibles, configParaPlugin, escribirConfigPlugin } = require('../src/fuentes')
const { POR_DEFECTO, normalizar } = require('../src/nucleo/config')

const leerJson = archivo => { try { return JSON.parse(fs.readFileSync(archivo, 'utf8')) } catch { return null } }
const carpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'centro-fuentes-'))

// Carpeta vacía (sin plugin): ninguna fuente, aunque estén activas.
{
  assert.deepEqual(visibles(POR_DEFECTO, carpeta(), leerJson), { sesiones: false, reuniones: false, tickets: false })
}

// El plugin detectó Calendar pero no Jira: reuniones y sesiones sí, tickets no.
{
  const dir = carpeta()
  fs.writeFileSync(path.join(dir, 'conectores.json'), JSON.stringify({ version: 1, jira: false, calendario: true }))
  assert.deepEqual(visibles(POR_DEFECTO, dir, leerJson), { sesiones: true, reuniones: true, tickets: false })
  // Apagada en la config: no se muestra aunque exista.
  const sinReuniones = normalizar({ fuentes: { reuniones: { activa: false } } })
  assert.equal(visibles(sinReuniones, dir, leerJson).reuniones, false)
}

// Datos ya escritos por una versión anterior del plugin (sin conectores.json) cuentan como presentes.
{
  const dir = carpeta()
  fs.mkdirSync(path.join(dir, 'sesiones'))
  fs.writeFileSync(path.join(dir, 'sesiones', 'a.json'), '{}')
  fs.writeFileSync(path.join(dir, 'tickets.json'), '{"items":[]}')
  assert.deepEqual(visibles(POR_DEFECTO, dir, leerJson), { sesiones: true, reuniones: false, tickets: true })
}

// Lo que se le pasa al plugin.
{
  const dir = carpeta()
  const config = normalizar({ fuentes: { tickets: { activa: false, jql: 'project = DEMO' } } })
  escribirConfigPlugin(dir, config)
  const escrito = JSON.parse(fs.readFileSync(path.join(dir, 'config-plugin.json'), 'utf8'))
  assert.deepEqual(escrito, configParaPlugin(config))
  assert.deepEqual(escrito.tickets, { activa: false, jql: 'project = DEMO' })
  assert.equal(escrito.reuniones.activa, true)
}

console.log('Fuentes: activas y presentes, conectores detectados, datos viejos y config para el plugin: OK.')
