// Pruebas de la config: valores por defecto, validación, migración desde ajustes.json y escritura.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { crearConfig, normalizar, POR_DEFECTO } = require('../src/nucleo/config')

const carpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'centro-config-'))

// Sin archivo: valores por defecto y asistente pendiente.
{
  const config = crearConfig(carpeta())
  assert.deepEqual(config.get(), POR_DEFECTO)
  assert.equal(config.get().primerUso, true)
}

// Lo inválido vuelve al valor por defecto; lo válido se respeta.
{
  const n = normalizar({ inicioAutomatico: 'si', mascota: { visible: false, monitor: 'x' }, fuentes: { tickets: { activa: false, jql: '' } } })
  assert.equal(n.inicioAutomatico, true)
  assert.equal(n.mascota.visible, false)
  assert.equal(n.mascota.monitor, null)
  assert.equal(n.fuentes.tickets.activa, false)
  assert.equal(n.fuentes.tickets.jql, POR_DEFECTO.fuentes.tickets.jql)
  assert.equal(normalizar({ fuentes: { tickets: { jql: 'project = X' } } }).fuentes.tickets.jql, 'project = X')
}

// Migración: ajustes.json pasa a la config, queda un .bak y no se pide el asistente.
{
  const dir = carpeta()
  fs.writeFileSync(path.join(dir, 'ajustes.json'), JSON.stringify({ mascota: false, monitor: 123, reunionesSoloHoy: true }))
  const config = crearConfig(dir)
  assert.equal(config.get().mascota.visible, false)
  assert.equal(config.get().mascota.monitor, 123)
  assert.equal(config.get().fuentes.reuniones.soloHoy, true)
  assert.equal(config.get().primerUso, false)
  assert.ok(fs.existsSync(path.join(dir, 'ajustes.json.bak')))
  assert.ok(!fs.existsSync(path.join(dir, 'ajustes.json')))
  assert.deepEqual(crearConfig(dir).get(), config.get(), 'la migración queda guardada')
}

// set: rutas, validación, guardado, avisos y claves desconocidas.
{
  const dir = carpeta(), config = crearConfig(dir)
  const avisos = []
  config.alCambiar(c => avisos.push(c))
  config.set({ 'fuentes.tickets.activa': false, 'fuentes.reuniones.soloHoy': true })
  assert.equal(config.get().fuentes.tickets.activa, false)
  assert.equal(config.get().fuentes.reuniones.soloHoy, true)
  assert.equal(avisos.length, 1)
  assert.equal(crearConfig(dir).get().fuentes.tickets.activa, false, 'persistido')
  config.set({ 'mascota.visible': 'no' })
  assert.equal(config.get().mascota.visible, true, 'valor inválido no entra')
  assert.throws(() => config.set({ 'fuentes.jira.activa': true }), /Clave desconocida/)
  const copia = config.get(); copia.mascota.visible = false
  assert.equal(config.get().mascota.visible, true, 'get devuelve una copia')
}

// Archivo roto: arranca con valores por defecto.
{
  const dir = carpeta()
  fs.writeFileSync(path.join(dir, 'config.json'), '{roto')
  assert.deepEqual(crearConfig(dir).get(), POR_DEFECTO)
}

console.log('Config: valores por defecto, validación, migración desde ajustes.json, set con rutas y archivo roto: OK.')
