const {app,BrowserWindow}=require('electron');const fs=require('fs'),path=require('path');
const [ui,salida,tipo,fondo,pieza]=process.argv.slice(-5)
app.commandLine.appendSwitch('disable-gpu');app.setPath('userData',path.join(salida,'perfil'))
const paso=ms=>new Promise(r=>setTimeout(r,ms))
app.whenReady().then(async()=>{try{
 const w=new BrowserWindow({width:tipo==='panel'?580:1000,height:tipo==='panel'?880:480,show:false,webPreferences:{offscreen:true,contextIsolation:false,preload:path.join(ui,'../../scripts/captura-preload.cjs')}})
 w.webContents.on('console-message',(e,...a)=>{const t=JSON.stringify(a);if(/error|Error/.test(t))console.log('console',t.slice(0,300))})
 await w.loadFile(path.join(ui,tipo==='panel'?'index.html':'mascota.html'))
 await w.webContents.executeJavaScript(`document.body.style.background=${JSON.stringify(fondo==='claro'?'#f4f1ea':'#10131a')};window.__estado();1`)
 await paso(400)
 if(tipo==='mascota'){
  await w.webContents.executeJavaScript(`x=450;1`)
  if(pieza==='menu')await w.webContents.executeJavaScript(`abrirMenu();1`)
  if(pieza==='ajustes')await w.webContents.executeJavaScript(`abrirAjustes();1`)
  if(pieza==='hover')await w.webContents.executeJavaScript(`actualizarTarjeta();$('tarjeta-gato').hidden=false;hoverDesde=performance.now()-1000;hoverHasta=performance.now()+9000;1`)
 }
 await paso(900)
 fs.writeFileSync(path.join(salida,`${tipo}-${pieza}-${fondo}.png`),(await w.webContents.capturePage()).toPNG());console.log('ok',tipo,pieza,fondo)
}catch(e){console.log('ERR',e.message)}finally{app.quit()}})
