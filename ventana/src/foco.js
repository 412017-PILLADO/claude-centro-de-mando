const MINUTO=60000
function normalizar(f) {
 if(!f||!['foco','descanso','listo'].includes(f.fase)||!Number.isFinite(f.hasta)||!Number.isFinite(f.desde))return null
 return {fase:f.fase,desde:f.desde,hasta:f.hasta,minutos:f.minutos===50?50:25}
}
function avanzar(datos,ahora) {
 const f=datos.foco,eventos=[]
 if(!f||f.fase==='listo'||ahora<f.hasta)return eventos
 if(f.fase==='foco'){f.fase='descanso';f.desde=f.hasta;f.hasta+=5*MINUTO;eventos.push({tipo:'fin-foco',id:'foco:'+f.desde,texto:'Terminaste el foco. Tomate 5 minutos de descanso.'})}
 if(ahora>=f.hasta){f.fase='listo';eventos.push({tipo:'fin-descanso',id:'descanso:'+f.hasta,texto:'Terminó el descanso. Cuando quieras, seguimos.'})}
 return eventos
}
module.exports={normalizar,avanzar,MINUTO}
