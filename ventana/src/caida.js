// Coordenadas globales: el piso siempre pertenece al monitor donde se suelta.
function crearCaida(y, piso, desde) { return {y:Math.min(y,piso),piso,desde,origen:Math.min(y,piso)} }
function pasoCaida(c, ahora) {
  const segundos=Math.max(0,ahora-c.desde)/1000
  const y=Math.min(c.piso,c.origen+950*segundos*segundos)
  return {y,termino:y>=c.piso}
}
module.exports={crearCaida,pasoCaida}
