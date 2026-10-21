// Formato de horarios compartido.
;(function(raiz){
  function momento(hora){return hora<6||hora>=21?'noche':hora<12?'manana':hora<18?'tarde':'atardecer'}
  function hace(fecha,ahora=Date.now()) {if(!fecha)return 'todavía no';const m=Math.max(0,Math.floor((ahora-fecha)/60000));return m<1?'recién':m<60?`hace ${m} min`:`hace ${Math.floor(m/60)} h`}
  const api={momento,hace}
  if(typeof module!=='undefined')module.exports=api
  else raiz.ambienteGatito=api
})(globalThis)
