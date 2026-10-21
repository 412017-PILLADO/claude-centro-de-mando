// Fuentes de trabajo: sesiones de Claude, reuniones y tickets. Cada una se muestra (y le avisa al gato)
// solo si la persona la tiene activa en la config y existe: el plugin de Claude la detectó o ya escribió datos.
// Sin ninguna, el gatito es una mascota sola.
const fs = require('node:fs')
const path = require('node:path')

const FUENTES = ['sesiones', 'reuniones', 'tickets']

function presentes(carpeta, leerJson) {
  const conectores = leerJson(path.join(carpeta, 'conectores.json'))
  const hay = nombre => fs.existsSync(path.join(carpeta, nombre))
  let sesiones = false
  try { sesiones = fs.readdirSync(path.join(carpeta, 'sesiones')).some(n => n.endsWith('.json')) } catch { /* sin carpeta */ }
  return {
    // Con el plugin instalado siempre hay sesiones posibles, aunque ahora no haya ninguna abierta.
    sesiones: sesiones || conectores !== null,
    reuniones: conectores?.calendario === true || hay('reuniones.json'),
    tickets: conectores?.jira === true || hay('tickets.json'),
  }
}

function visibles(config, carpeta, leerJson) {
  const hay = presentes(carpeta, leerJson)
  return Object.fromEntries(FUENTES.map(id => [id, config.fuentes[id].activa && hay[id]]))
}

// Lo que el plugin lee para no consultar conectores apagados (y con qué JQL).
function configParaPlugin(config) {
  return {
    version: 1,
    reuniones: { activa: config.fuentes.reuniones.activa },
    tickets: { activa: config.fuentes.tickets.activa, jql: config.fuentes.tickets.jql },
  }
}

function escribirConfigPlugin(carpeta, config) {
  try {
    fs.mkdirSync(carpeta, { recursive: true })
    const archivo = path.join(carpeta, 'config-plugin.json')
    fs.writeFileSync(archivo + '.tmp', JSON.stringify(configParaPlugin(config), null, 2) + '\n')
    fs.renameSync(archivo + '.tmp', archivo)
  } catch (error) {
    console.error('No se pudo escribir config-plugin.json:', error.code)
  }
}

module.exports = { FUENTES, presentes, visibles, configParaPlugin, escribirConfigPlugin }
