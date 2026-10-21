// prepararSecciones (ocultar con chip) quedó en desuso: la interfaz usa prepararPlegado.
;(function(raiz){
  function prepararSecciones(documento,leer,guardar){
    const barra=documento.getElementById('secciones-ocultas')
    for(const seccion of documento.querySelectorAll('.seccion')){
      const nombre=seccion.dataset.seccion, titulo=seccion.querySelector('.seccion-titulo')
      const chip=documento.createElement('button')
      chip.textContent=`Mostrar ${nombre === 'tickets' ? 'mis tickets' : nombre === 'sesiones' ? 'sesiones de Claude' : 'reuniones'}`
      function aplicar(oculta){seccion.hidden=oculta;chip.hidden=!oculta;guardar(`seccion-${nombre}`,oculta?'1':'0')}
      chip.addEventListener('click',()=>aplicar(false));barra.append(chip)
      titulo.addEventListener('click',evento=>{if(evento.target.closest?.('.boton-chico,.mas-seccion'))return;aplicar(true)})
      aplicar(leer(`seccion-${nombre}`)==='1')
    }
  }
  // Plegar: el bloque queda en su lugar reducido a su encabezado; clic de nuevo lo despliega.
  // El estado se guarda en 'plegada-<sección>'. Migración: lo que estaba 'oculto' (seccion-<nombre>=1) pasa a plegado.
  function prepararPlegado(documento,leer,guardar){
    const raizDoc=documento.documentElement||documento.body
    raizDoc?.classList?.add('sin-animacion')
    for(const seccion of documento.querySelectorAll('.seccion')){
      const nombre=seccion.dataset.seccion, boton=seccion.querySelector('.seccion-titulo'), cuerpo=seccion.querySelector('.plegable')
      const titulo=seccion.querySelector('h2')?.textContent||nombre
      function aplicar(plegada,guardarEstado=true){
        seccion.classList.toggle('plegada',plegada)
        boton.setAttribute('aria-expanded',String(!plegada))
        boton.setAttribute('aria-label',(plegada?'Desplegar ':'Plegar ')+titulo)
        boton.setAttribute('title',plegada?'Desplegar':'Plegar')
        if(plegada)cuerpo?.setAttribute('inert','');else cuerpo?.removeAttribute('inert')
        if(guardarEstado)guardar('plegada-'+nombre,plegada?'1':'0')
      }
      let inicial=leer('plegada-'+nombre)
      if(inicial===null&&leer('seccion-'+nombre)==='1'){inicial='1';guardar('plegada-'+nombre,'1');guardar('seccion-'+nombre,'0')}
      seccion.hidden=false
      aplicar(inicial==='1',false)
      boton.addEventListener('click',()=>aplicar(!seccion.classList.contains('plegada')))
    }
    const quitar=()=>raizDoc?.classList?.remove('sin-animacion')
    if(raiz.requestAnimationFrame)raiz.requestAnimationFrame(()=>raiz.requestAnimationFrame(quitar));else quitar()
  }
  if(typeof module!=='undefined')module.exports={prepararSecciones,prepararPlegado}
  else{raiz.prepararSecciones=prepararSecciones;raiz.prepararPlegado=prepararPlegado}
})(globalThis)
