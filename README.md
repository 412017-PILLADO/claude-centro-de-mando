# Centro de mando para Claude Code

Tus sesiones de Claude, tus tickets de Jira y tus reuniones, siempre a la vista.

Son dos piezas que trabajan juntas:

| Pieza | Qué es | Qué muestra |
| --- | --- | --- |
| **Plugin** (`plugin/`) | Un plugin de Claude Code. Corre dentro de cada sesión. | Un panel *Centro de mando* en Claude, una línea de estado (carpeta · rama · cambios · % de contexto) y el comando `/centro`. |
| **Gatito** (`ventana/`) | Una mascota pixel art que pasea por la barra de tareas. | Corre si Claude trabaja, salta cuando termina, te avisa si una sesión te espera, se duerme sin actividad, y antes de una reunión te deja unirte tocándolo. |
| **Ventana** (`ventana/`) | Una app de escritorio (Electron), flotante y siempre visible. | Reuniones con botón **Unirse** y aviso 5 minutos antes, tickets por estado, y el estado de todas tus sesiones de Claude. |

## Instalación

### Con Claude (recomendado)

Pedile a Claude Code:

> Instalá el centro de mando de https://github.com/412017-PILLADO/claude-centro-de-mando

Claude lee las [instrucciones de abajo](#instrucciones-para-claude) y hace todo.

### A mano

Requisitos: **Windows**, **Node 14 o más nuevo** (sirve el Node viejo del trabajo: solo se usa para instalar, la app trae el suyo), **Git** y **Claude Code**.

```bash
git clone https://github.com/412017-PILLADO/claude-centro-de-mando.git
```
```bash
node claude-centro-de-mando/instalar.js
```

El instalador agrega el plugin a Claude Code, instala la ventana, crea **Centro de mando** en el menú Inicio y la abre. Se puede correr de nuevo para actualizar.

### Después de instalar (una sola vez)

1. En **claude.ai → Settings → Connectors**, conectá con tu cuenta del trabajo:
   - **Atlassian** (Jira), para *Mis tickets*.
   - **Google Calendar**, para *Reuniones*.
2. Reiniciá las sesiones de Claude que tengas abiertas.

## Cómo funciona

```
Claude Code (cada sesión)                       Ventana flotante
┌──────────────────────────┐   ~/.claude/centro/   ┌─────────────────────┐
│ plugin centro-de-mando   │ ─── sesiones/*.json ─▶ │ lee los archivos y  │
│ · estado de la sesión    │ ─── tickets.json ────▶ │ los muestra en vivo │
│ · Jira (tu conector)     │ ─── reuniones.json ──▶ │ · avisos y alertas  │
│ · Calendar (tu conector) │                        │                     │
└──────────────────────────┘                        └─────────────────────┘
```

- **No guarda ni pide credenciales.** Los tickets y las reuniones los trae el Claude de cada persona con *sus* conectores. El plugin encuentra los conectores solo, se llamen como se llamen.
- Por defecto la ventana crece hasta mostrar todo sin scroll (con el alto de la pantalla como límite). Si la achicás, aparece el scroll.
- Todo queda en tu máquina, en `~/.claude/centro/`.
- Tickets y reuniones se renuevan cada 10 minutos mientras haya alguna sesión de Claude abierta. Las alertas de reuniones funcionan aunque no la haya, con la agenda que se cargó antes.

## Uso de la ventana

| Acción | Cómo |
| --- | --- |
| Mostrar / ocultar | `Ctrl+Alt+Espacio`, o clic en el gatito de la bandeja |
| Abrirla si la cerraste con *Salir* | Menú Inicio → **Centro de mando** |
| Abrir un ticket en Jira | Clic en el ticket |
| Trabajar un ticket con Claude Desktop | Botón ✳ del ticket (copia el pedido: pegalo con `Ctrl+V`) |
| Entrar a una reunión | **Unirse** (en la lista, en el banner o en la notificación) |
| Sacar una sesión de la lista | ✕ al pasar el mouse por la sesión (vuelve sola si la usás de nuevo) |
| Probar la alerta de reunión | **Probar alerta**, en la sección Reuniones |
| Cambiar el tamaño | Arrastrá la rayita de abajo (alto) o el borde izquierdo (ancho). Doble clic: tamaño automático |
| Plegar una sección / el panel | Clic en su título / flecha ⌄ de la barra |
| Mostrar / ocultar el gatito | Clic derecho en el gatito de la bandeja → *Gatito en el escritorio* |
| Hacer maullar / mover al gatito | Tocalo / arrastralo |
| Iniciar con Windows | Clic derecho en el gatito de la bandeja |

## Si la descarga de Electron falla

El instalador baja Electron (~110 MB) de GitHub y verifica su firma. Si la red de la empresa lo bloquea, se puede usar un espejo interno:

```bash
set ELECTRON_MIRROR=https://espejo.interno/electron/
```

y volver a correr `node instalar.js`.

## Desarrollo

```bash
claude plugin validate plugin
```
```bash
claude plugin test plugin
```
```bash
cd ventana && npm start
```

`CENTRO_CAPTURA=captura.png npm start` guarda una captura de la ventana y cierra (`CENTRO_PROBAR_ALERTA=1` además dispara la alerta de prueba).

---

## Instrucciones para Claude

Si te piden instalar este repo, seguí estos pasos en orden y contale al usuario el resultado de cada uno:

1. **Requisitos.** Verificá que sea Windows y que `node --version` sea 14 o más (no le pidas al usuario que actualice Node: la app usa el Node que trae Electron), y que `git` y `claude` estén instalados. Si falta algo, decile al usuario qué instalar y frená.
2. **Clonar.** Cloná el repo en `%USERPROFILE%\claude-plugins\claude-centro-de-mando` (creá la carpeta si no existe). Si ya existe y es este repo, hacé `git pull` en vez de clonar.
3. **Instalar.** Corré `node instalar.js` dentro del repo. Tarda alrededor de un minuto porque descarga Electron. No sigas si termina con ✗: mostrale el error al usuario.
4. **Conectores.** Revisá si en tu sesión hay herramientas de Jira (`searchJiraIssuesUsingJql`) y de Google Calendar (`list_events`). Si falta alguna, pedile al usuario que la conecte en claude.ai → Settings → Connectors con su cuenta del trabajo. No le pidas tokens ni contraseñas: no hacen falta.
5. **Cierre.** Avisale que reinicie sus sesiones de Claude abiertas, y que la ventana ya está arriba a la derecha (`Ctrl+Alt+Espacio`).

No modifiques archivos del repo durante la instalación.
