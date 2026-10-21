// Configuración de la app: un solo config.json en la carpeta de la app, con valores por defecto,
// validación por tipo y caché en memoria. El estado del gato (nombre, color, hambre…) vive en gatito.json.
const fs = require('node:fs')
const path = require('node:path')

const VERSION = 1

const POR_DEFECTO = Object.freeze({
  version: VERSION,
  primerUso: true,
  inicioAutomatico: true,
  // Sin aceleración por hardware el gato consume bastante menos (medido: 0,22 % de CPU contra 0,76 %).
  aceleracionGrafica: false,
  mascota: { visible: true, monitor: null },
  fuentes: {
    sesiones: { activa: true },
    reuniones: { activa: true, soloHoy: false },
    tickets: { activa: true, jql: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC' },
  },
})

// Reglas extra para los valores que no alcanza con el tipo.
const REGLAS = {
  'mascota.monitor': v => v === null || Number.isFinite(v),
  'fuentes.tickets.jql': v => typeof v === 'string' && v.trim().length > 0 && v.length <= 500,
}

const copiar = valor => JSON.parse(JSON.stringify(valor))
const esObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// Arma una config válida a partir de cualquier cosa: lo que no cumple se reemplaza por el valor por defecto.
function normalizar(entrada, base = POR_DEFECTO, ruta = '') {
  const salida = {}
  for (const [clave, defecto] of Object.entries(base)) {
    const actual = ruta + clave, valor = esObjeto(entrada) ? entrada[clave] : undefined
    if (esObjeto(defecto)) salida[clave] = normalizar(valor, defecto, actual + '.')
    else if (REGLAS[actual]) salida[clave] = valor !== undefined && REGLAS[actual](valor) ? copiar(valor) : copiar(defecto)
    else salida[clave] = typeof valor === typeof defecto ? valor : defecto
  }
  if (ruta === '') salida.version = VERSION
  return salida
}

// Los ajustes sueltos de versiones anteriores (ajustes.json) pasan a la config.
function migrarAjustes(viejos) {
  const config = copiar(POR_DEFECTO)
  if (typeof viejos.mascota === 'boolean') config.mascota.visible = viejos.mascota
  if (Number.isFinite(viejos.monitor)) config.mascota.monitor = viejos.monitor
  if (typeof viejos.reunionesSoloHoy === 'boolean') config.fuentes.reuniones.soloHoy = viejos.reunionesSoloHoy
  // Quien ya usaba la app no necesita el asistente.
  config.primerUso = false
  return config
}

function leer(archivo) {
  try { return JSON.parse(fs.readFileSync(archivo, 'utf8')) } catch { return undefined }
}

function escribir(archivo, valor) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  fs.writeFileSync(archivo + '.tmp', JSON.stringify(valor, null, 2) + '\n')
  fs.renameSync(archivo + '.tmp', archivo)
}

function crearConfig(carpeta) {
  const archivo = path.join(carpeta, 'config.json')
  const viejos = path.join(carpeta, 'ajustes.json')
  let datos = leer(archivo)
  if (datos === undefined && fs.existsSync(viejos)) {
    datos = migrarAjustes(leer(viejos) ?? {})
    escribir(archivo, normalizar(datos))
    fs.renameSync(viejos, viejos + '.bak')
  }
  datos = normalizar(datos)
  const oyentes = new Set()
  return {
    archivo,
    get: () => copiar(datos),
    // Cambia una o varias claves con rutas ("fuentes.tickets.activa": false); devuelve la config resultante.
    set(cambios) {
      const nueva = copiar(datos)
      for (const [ruta, valor] of Object.entries(cambios)) {
        const partes = ruta.split('.'), ultima = partes.pop()
        let nodo = nueva
        for (const parte of partes) {
          if (!esObjeto(nodo[parte])) throw new Error(`Clave desconocida: ${ruta}`)
          nodo = nodo[parte]
        }
        if (!(ultima in nodo)) throw new Error(`Clave desconocida: ${ruta}`)
        nodo[ultima] = valor
      }
      datos = normalizar(nueva)
      escribir(archivo, datos)
      for (const oyente of oyentes) oyente(copiar(datos))
      return copiar(datos)
    },
    alCambiar(oyente) { oyentes.add(oyente); return () => oyentes.delete(oyente) },
  }
}

module.exports = { crearConfig, normalizar, migrarAjustes, POR_DEFECTO }
