No se generaron PNG: Electron 44.5.0 aborta antes de app.whenReady():
FATAL electron/shell/browser/win/install_dir_access.cc:52
Sandboxed processes cannot read .../node_modules/electron/dist: its ACL has an entry for an AppContainer package SID but none for ALL APPLICATION PACKAGES.

Intentos: electron.exe --no-sandbox scripts/capturar-diseno.cjs; luego ELECTRON_DISABLE_SANDBOX=1 y --disable-features=RendererAppContainer. Mismo resultado. No se modificaron ACL.

Reproducción desde ventana, en un entorno con Electron ejecutable:
node_modules/electron/dist/electron.exe --no-sandbox scripts/capturar-diseno.cjs
El script usa únicamente datos ficticios, perfil aislado, ventana offscreen y capturePage. Produce panel, mascota con menú, hover, ajustes y foco sobre blanco y oscuro. La transparencia y el acrílico nativos requieren además revisión en Windows 11. No se validaron visualmente ni arrastre/blur nativos ni el material.
