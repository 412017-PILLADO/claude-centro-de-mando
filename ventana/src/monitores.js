// Geometría pura: también se prueba sin una pantalla física.
function elegirMonitor(displays, id, primaria) {
  return displays.find(d => String(d.id) === String(id)) || primaria || displays[0]
}
function ubicarPanel(area, centro, deseado) {
  const izquierda = centro - area.x - 64, derecha = area.x + area.width - centro - 64
  const lado = izquierda >= derecha ? 'izquierda' : 'derecha'
  const width = Math.max(180, Math.min(deseado, Math.max(izquierda, derecha) - 8))
  return {lado, width: Math.round(width), x: Math.round(lado === 'izquierda' ? centro - 64 - width : centro + 64)}
}
function vecinos(displays, actual) {
  const b=actual.bounds, lados={izquierda:null,derecha:null}
  for(const lado of Object.keys(lados)) {
    const candidatos=displays.filter(d=>d.id!==actual.id &&
      Math.min(b.y+b.height,d.bounds.y+d.bounds.height)>Math.max(b.y,d.bounds.y) &&
      Math.abs(lado==='izquierda'?d.bounds.x+d.bounds.width-b.x:d.bounds.x-b.x-b.width)<=2)
    const solape=d=>Math.min(b.y+b.height,d.bounds.y+d.bounds.height)-Math.max(b.y,d.bounds.y)
    candidatos.sort((a,c)=>solape(c)-solape(a))
    lados[lado]=candidatos[0]||null
  }
  return lados
}
function planSalto(origen,destino,lado,xDesdeBorde=51) {
  const a=origen.workArea,b=destino.workArea
  const despegue={x:lado==='derecha'?a.x+a.width-xDesdeBorde:a.x+xDesdeBorde,y:a.y+a.height}
  const aterrizaje={x:lado==='derecha'?b.x+Math.min(75,b.width/2):b.x+b.width-Math.min(75,b.width/2),y:b.y+b.height}
  const apice=Math.min(despegue.y,aterrizaje.y)-90
  return {despegue,aterrizaje,apice,altura:Math.max(despegue.y,aterrizaje.y)-apice}
}
function puntoSalto(plan,t) {
  const {despegue:a,aterrizaje:b,apice}=plan
  const u=-Math.sqrt(a.y-apice)+(Math.sqrt(a.y-apice)+Math.sqrt(b.y-apice))*t
  return {x:a.x+(b.x-a.x)*t,y:apice+u*u,fase:u< -3?'subida':u>3?'bajada':'apice'}
}
module.exports = {elegirMonitor, ubicarPanel, vecinos, planSalto, puntoSalto}
