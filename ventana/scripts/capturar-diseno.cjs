if (!process.versions.electron) {
 const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
 const salida=path.resolve(__dirname,'../diseno/capturas'),ui=path.resolve(__dirname,'../src/ui');
 fs.mkdirSync(salida,{recursive:true});
 const electron=path.resolve(__dirname,'../node_modules/electron/dist/electron.exe');
 const vistas=[['panel','claro','base'],['panel','oscuro','base'],['mascota','claro','globos'],['mascota','oscuro','globos'],['mascota','oscuro','menu'],['mascota','claro','ajustes'],['mascota','claro','base']];
 for(const [tipo,fondo,pieza] of vistas){
  const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'capturar-diseno-'));
  try {
   const r=spawnSync(electron,['--no-sandbox',__filename,ui,salida,tipo,fondo,pieza],{stdio:'inherit',env:{...process.env,CAPTURA_PERFIL:perfil}});
   if(r.error)throw r.error;
   if(r.status!==0){process.exitCode=r.status||1;break}
  } finally {fs.rmSync(perfil,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
 }
} else {
const {app,BrowserWindow}=require('electron');const fs=require('fs'),path=require('path');
const [ui,salida,tipo,fondo,pieza]=process.argv.slice(-5)
app.commandLine.appendSwitch('disable-gpu');app.setPath('userData',process.env.CAPTURA_PERFIL)
const paso=ms=>new Promise(r=>setTimeout(r,ms))
app.whenReady().then(async()=>{try{
 const w=new BrowserWindow({width:tipo==='panel'?580:1000,height:tipo==='panel'?880:480,show:false,webPreferences:{offscreen:true,contextIsolation:false,preload:path.join(ui,'../../scripts/captura-preload.cjs')}})
 w.webContents.on('console-message',(e,...a)=>{const t=JSON.stringify(a);if(/error|Error/.test(t))console.log('console',t.slice(0,300))})
 await w.loadFile(path.join(ui,tipo==='panel'?'index.html':'mascota.html'))
 await w.webContents.executeJavaScript(`document.body.style.background=${JSON.stringify(fondo==='claro'?'#f4f1ea':'#10131a')};window.__estado();1`)
 await paso(400)
 if(tipo==='mascota'){
  await w.webContents.executeJavaScript(`x=450;1`)
  if(pieza==='base'||pieza==='menu')await w.webContents.executeJavaScript('gatito.foco=null;1');
  if(pieza==='menu')await w.webContents.executeJavaScript(`abrirMenu();1`)
  if(pieza==='ajustes')await w.webContents.executeJavaScript(`abrirAjustes();1`)
  if(pieza==='hover')await w.webContents.executeJavaScript(`actualizarTarjeta();$('tarjeta-gato').hidden=false;hoverDesde=performance.now()-1000;hoverHasta=performance.now()+9000;1`)
 }
 await paso(900)
 fs.writeFileSync(path.join(salida,`${tipo}-${pieza}-${fondo}.png`),(await w.webContents.capturePage()).toPNG());console.log('ok',tipo,pieza,fondo)
}catch(e){console.error('ERR',e.message);process.exitCode=1}finally{app.quit()}})

}
