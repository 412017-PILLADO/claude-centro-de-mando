# Gatito de escritorio · Centro de mando

Un gatito pixel art que vive en tu escritorio: come, juega, duerme, te acompaña en tus ratos de foco y te invita a estirarte. Si usás **Claude Code**, además puede mostrarte tus sesiones de Claude, tus reuniones y tus tickets, y avisarte cuando algo necesita tu atención.

> **English summary.** A pixel-art desktop pet (Electron) for Windows and macOS. It works on its own, and can optionally show your Claude Code sessions, Google Calendar meetings and Jira tickets through your own Claude connectors, with no tokens stored. Install with `node instalar.js` (or `--solo-mascota` for the pet only); everything is configured from the in-app Settings and it starts with your computer.

## Qué trae

| Pieza | Qué es |
| --- | --- |
| **Gatito** (`ventana/`) | La mascota. Pasea por la parte de abajo de la pantalla, salta entre monitores y tiene hambre, cariño, sueño y ganas de jugar. Clic derecho: Comer, Mimar, Jugar, Dormir, Foco (pomodoro de 25 o 50 min) y Ajustes. Clic: abre el centro de mando. |
| **Centro de mando** (`ventana/`) | Un panel que se abre al lado del gato. Muestra solo las conexiones que tengas: reuniones, tickets y sesiones de Claude. Sin ninguna, el gatito funciona solo. |
| **Plugin de Claude Code** (`plugin/`, opcional) | Corre dentro de cada sesión de Claude Code: comparte el estado de la sesión y trae reuniones y tickets con *tus* conectores de Claude. También suma un panel `/centro` y una línea de estado dentro de Claude. |

## Instalación

Requisitos:
- **Windows 10+** o **macOS 12+** (macOS está en beta: ver [Probar en macOS](#probar-en-macos)).
- **Git** y **Node**: Node 14 o más nuevo en Windows, Node 22.12 o más nuevo en macOS. Node solo se usa para instalar; la app trae el suyo.
- **Claude Code**, solo si querés las conexiones.

### Con Claude

Pedile a Claude Code:

> Instalá el gatito de https://github.com/412017-PILLADO/claude-centro-de-mando

Claude sigue las [instrucciones de abajo](#instrucciones-para-claude).

### A mano

```bash
git clone https://github.com/412017-PILLADO/claude-centro-de-mando.git
```
```bash
node claude-centro-de-mando/instalar.js
```

Para tener solo el gatito, sin Claude Code:

```bash
node claude-centro-de-mando/instalar.js --solo-mascota
```

El instalador baja Electron, abre el gatito y, salvo con `--solo-mascota`, agrega el plugin a Claude Code. Se puede correr de nuevo para actualizar.

La primera vez se abre la **bienvenida**: nombre y color del gato, qué conexiones mostrar y si arranca con la computadora (viene prendido). Todo se cambia después en **Ajustes**, desde el ícono de la bandeja, el botón ⚙ del panel o la tarjeta de ajustes del gato.

### Conexiones (opcional)

Las conexiones salen de los conectores que ya tengas en Claude: la app no guarda ni pide claves.

| Sección | Qué necesita |
| --- | --- |
| Sesiones de Claude | El plugin instalado |
| Reuniones | Conector **Google Calendar** en claude.ai → Configuración → Conectores |
| Mis tickets | Conector **Atlassian (Jira)** en claude.ai → Configuración → Conectores. Por defecto trae los tickets abiertos asignados a vos; el filtro (JQL) se cambia en Ajustes |

Después de conectar algo, reiniciá las sesiones de Claude abiertas. Ajustes muestra qué conexiones encontró y, si falta un conector, dónde activarlo. Una sección apagada en Ajustes no se muestra, no le avisa nada al gato y el plugin deja de consultarla.

## Cómo funciona

```
Claude Code (cada sesión)                       App del gatito
┌──────────────────────────┐   ~/.claude/centro/   ┌──────────────────────┐
│ plugin centro-de-mando   │ ── sesiones/*.json ──▶ │ gatito + panel       │
│ · estado de la sesión    │ ── reuniones.json ───▶ │ · muestra lo activo  │
│ · tus conectores         │ ── tickets.json ─────▶ │ · avisa con globos   │
│                          │ ── conectores.json ──▶ │                      │
│                          │ ◀─ config-plugin.json ─ │ (qué consultar)      │
└──────────────────────────┘                        └──────────────────────┘
```

- Todo queda en tu máquina: los datos compartidos en `~/.claude/centro/`, la configuración en la carpeta de la app (`config.json`).
- Reuniones y tickets se renuevan cada 10 minutos mientras haya alguna sesión de Claude abierta. Con varias sesiones abiertas se consulta una sola vez. Las alertas de reuniones funcionan aunque Claude esté cerrado, con la agenda ya cargada.
- Las alertas las dice el gatito con globos. Si lo apagás, pasan a ser notificaciones del sistema.
- Está pensado para no pesar: quieto dibuja pocos cuadros por segundo, no usa la placa de video y guarda su estado como mucho una vez por minuto. Medido en Windows: alrededor de 0,2 % de CPU.

## Uso

| Acción | Cómo |
| --- | --- |
| Abrir / cerrar el centro de mando | Tocá al gatito, `Ctrl+Alt+Espacio` (`Cmd+Alt+Espacio` en Mac) o clic en el ícono de la bandeja. `Esc` cierra |
| Cuidados | Clic derecho en el gatito, o clic en el cuenco cuando pide comida |
| Acariciar | Pasá el mouse por encima varias veces, de un lado al otro |
| Foco / pomodoro | Clic derecho → Foco → 25 o 50 minutos, después 5 de descanso. Mientras tanto el gato duerme y solo pasan avisos de trabajo |
| Mover al gatito | Arrastralo, también a otro monitor (lo recuerda) |
| Entrar a una reunión | **Unirse**, en el globo del gatito o en la lista de reuniones |
| Abrir un ticket | Clic en el ticket; el botón ✳ copia un pedido para trabajarlo con Claude |
| Sacar una sesión de la lista | ✕ sobre la sesión (vuelve sola si la usás de nuevo) |
| Plegar una sección o cambiar el tamaño del panel | Clic en el título de la sección; rayita de arriba (alto) o borde izquierdo (ancho), doble clic para el tamaño automático |
| Ajustes | Ícono de la bandeja → **Ajustes…**, o ⚙ en el panel |
| Volver a abrirlo después de *Salir* | Windows: menú Inicio → **Centro de mando**. macOS: `npm start` en la carpeta `ventana` (o reiniciá la sesión, si dejaste prendido el arranque automático) |

## Si la descarga de Electron falla

El instalador baja Electron (~110 MB) de GitHub y verifica su firma. Si tu red lo bloquea, se puede usar un espejo:

```bash
set ELECTRON_MIRROR=https://tu-espejo/electron/
```

y volver a correr `node instalar.js` (en macOS, `export ELECTRON_MIRROR=…`).

## Probar en macOS

macOS todavía no se probó en un equipo real. Si lo instalás en una Mac, revisá:

- [ ] El gatito aparece abajo, deja pasar los clics a lo que hay detrás y se puede tocar y arrastrar.
- [ ] No aparece en el Dock; el ícono está en la barra de menú y se ve en tema claro y oscuro.
- [ ] Sigue visible al cambiar de escritorio y con una app en pantalla completa.
- [ ] `Cmd+Alt+Espacio` abre el centro de mando.
- [ ] Con "Abrir al iniciar la computadora" prendido existe `~/Library/LaunchAgents/com.centro-de-mando.gatito.plist`, y al cerrar y volver a abrir la sesión el gatito arranca solo.
- [ ] Las notificaciones de reuniones aparecen con el gatito apagado (macOS pide permiso la primera vez).

## Cambiar el gatito

Los dibujos salen de las hojas de `ventana/arte/` (fondo transparente, leídas por filas de izquierda a derecha). Para cambiarlo, reemplazá las hojas (o sumá otra en `HOJAS`, dentro de `ventana/scripts/cortar-hoja.js`) y corré:

```bash
cd ventana && npm run cortar-hoja
```

El script deja todos los dibujos del mismo tamaño y escala. `node ventana/scripts/validar-hojas.cjs` revisa las hojas sin abrir Electron. Los umbrales del comportamiento (hambre, sueño, pausas, esperas) están en [COMPORTAMIENTO.md](ventana/COMPORTAMIENTO.md).

## Desarrollo

```bash
cd ventana && npm test
```
```bash
claude plugin validate plugin
```
```bash
claude plugin test plugin
```
```bash
cd ventana && npm start
```

Variables útiles al desarrollar:

| Variable | Para qué |
| --- | --- |
| `CENTRO_DATOS=<carpeta>` | Lee datos simulados en vez de `~/.claude/centro` |
| `CENTRO_PERFIL=<carpeta>` | Usa otra carpeta de la app (config y demás), sin tocar la tuya ni el arranque automático |
| `CENTRO_CAPTURA=captura.png` | Abre el centro, guarda una captura y cierra. Con `CENTRO_ESCENA=ajustes`, captura los Ajustes |
| `CENTRO_METRICAS=1` | Registra CPU y memoria cada 10 s en `metricas.jsonl` |
| `CENTRO_REGISTRO=1` | Guarda la secuencia de animaciones del gato, para depurar |

Para medir el consumo con una copia aislada durante 3 minutos:

```bash
cd ventana && node scripts/medir.cjs medicion 180 && npm run metricas -- medicion/perfil/metricas.jsonl
```

---

## Instrucciones para Claude

Si te piden instalar este repo, seguí estos pasos en orden y contale al usuario el resultado de cada uno:

1. **Requisitos.** Verificá el sistema (Windows o macOS), `node --version` (14+ en Windows, 22.12+ en macOS) y que estén `git` y `claude`. Si falta algo, decile qué instalar y frená. No le pidas que actualice Node en Windows: la app usa el Node que trae Electron.
2. **Clonar.** Cloná el repo en `~/claude-plugins/claude-centro-de-mando` (en Windows, `%USERPROFILE%\claude-plugins\claude-centro-de-mando`). Si ya existe y es este repo, hacé `git pull`.
3. **Instalar.** Corré `node instalar.js` dentro del repo (con `--solo-mascota` si el usuario solo quiere el gatito). Tarda alrededor de un minuto porque descarga Electron. Si termina con ✗, mostrale el error y frená.
4. **Conectores (opcional).** Revisá si en tu sesión hay herramientas de Jira (`searchJiraIssuesUsingJql`) y de Google Calendar (`list_events`). Si falta alguna y el usuario la quiere, explicale que la conecte en claude.ai → Configuración → Conectores. No le pidas tokens ni contraseñas: no hacen falta.
5. **Cierre.** Avisale que reinicie sus sesiones de Claude abiertas, que el gatito ya está en el escritorio y que la bienvenida le deja elegir qué mostrar.

No modifiques archivos del repo durante la instalación.
