# Centro de mando para Claude Code

Tus sesiones de Claude, tus tickets de Jira y tus reuniones, siempre a la vista.

Son dos piezas que trabajan juntas:

| Pieza | Qué es | Qué muestra |
| --- | --- | --- |
| **Plugin** (`plugin/`) | Un plugin de Claude Code. Corre dentro de cada sesión. | Un panel *Centro de mando* en Claude, una línea de estado (carpeta · rama · cambios · % de contexto) y el comando `/centro`. |
| **Gatito** (`ventana/`) | Una mascota pixel art que pasea por la barra de tareas (app de escritorio en Electron). | **Todas las alertas, como globos que dice el gatito**: sesión que terminó, reunión en 5 minutos (con **Unirse**), avisos. Cada globo se cierra con su ✕. Corre si Claude trabaja, salta cuando termina, se duerme sin actividad y de vez en cuando persigue el mouse. |
| **Centro de mando** (`ventana/`) | Un panel que se abre **tocando al gatito**, a su lado. | Reuniones, tickets de Jira por estado y el estado de todas tus sesiones de Claude. |

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
- El panel crece hacia arriba desde la barra de tareas hasta mostrar todo sin scroll (con el alto de la pantalla como límite). Si lo achicás, aparece el scroll.
- Si apagás el gatito, las alertas pasan a ser notificaciones de Windows.
- Todo queda en tu máquina, en `~/.claude/centro/`.
- Tickets y reuniones se renuevan cada 10 minutos mientras haya alguna sesión de Claude abierta. Las alertas de reuniones funcionan aunque no la haya, con la agenda que se cargó antes.

## Uso

| Acción | Cómo |
| --- | --- |
| Abrir / cerrar el centro de mando | **Tocá al gatito** (también `Ctrl+Alt+Espacio` o clic en el ícono de la bandeja). Para cerrar: tocalo de nuevo o `Esc` |
| Cerrar una alerta | La ✕ del globo (no vuelve, salvo que pase algo nuevo) |
| Entrar a una reunión | **Unirse** en el globo del gatito o en la lista de reuniones |
| Mover al gatito | Arrastralo |
| Abrir un ticket en Jira | Clic en el ticket |
| Trabajar un ticket con Claude Desktop | Botón ✳ del ticket (copia el pedido: pegalo con `Ctrl+V`) |
| Sacar una sesión de la lista | ✕ al pasar el mouse por la sesión (vuelve sola si la usás de nuevo) |
| Probar la alerta de reunión | **Probar alerta**, en la sección Reuniones |
| Cambiar el tamaño del panel | Rayita de arriba (alto) o borde izquierdo (ancho). Doble clic: tamaño automático |
| Plegar una sección | Clic en su título |
| Apagar / prender el gatito | Clic derecho en el ícono de la bandeja → *Gatito en el escritorio* |
| Volver a abrir la app después de *Salir* | Menú Inicio → **Centro de mando** |
| Iniciar con Windows | Clic derecho en el ícono de la bandeja |

## Si la descarga de Electron falla

El instalador baja Electron (~110 MB) de GitHub y verifica su firma. Si la red de la empresa lo bloquea, se puede usar un espejo interno:

```bash
set ELECTRON_MIRROR=https://espejo.interno/electron/
```

y volver a correr `node instalar.js`.

## Cambiar el gatito

Los 35 dibujos salen de dos hojas con fondo transparente, en `ventana/arte/`. Cada gatito se detecta solo (no hace falta una grilla pareja); las hojas se leen por filas, de izquierda a derecha, con el gato mirando a la derecha:

| Hoja | Filas |
| --- | --- |
| `gatito-hoja.webp` | sentado · contento · atento · cola / caminar 1-4 / alerta (!) · tablet · listo (✓) · duda (?) / sueño · durmiendo (zZz) · bolita · estirarse |
| `gatito-hoja-2.webp` | maullar 1-2 · saludar 1-2 / correr 1-4 / lamerse 1-3 / bostezo 1-3 / salto 1-3 / espaldas 1-2 |

Para cambiar el gatito, reemplazá las hojas (o sumá otra en `HOJAS`, dentro de `ventana/scripts/cortar-hoja.js`) y corré:

```bash
cd ventana && npm run cortar-hoja
```

El script deja todos los dibujos del mismo tamaño y escala, para que el gato no cambie de tamaño entre poses.

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

`CENTRO_DATOS=<carpeta>` hace que la app lea datos simulados en vez de `~/.claude/centro`. `CENTRO_CAPTURA=captura.png npm start` abre el centro, guarda una captura y cierra (`CENTRO_PROBAR_ALERTA=1` además dispara la alerta de prueba).

---

## Instrucciones para Claude

Si te piden instalar este repo, seguí estos pasos en orden y contale al usuario el resultado de cada uno:

1. **Requisitos.** Verificá que sea Windows y que `node --version` sea 14 o más (no le pidas al usuario que actualice Node: la app usa el Node que trae Electron), y que `git` y `claude` estén instalados. Si falta algo, decile al usuario qué instalar y frená.
2. **Clonar.** Cloná el repo en `%USERPROFILE%\claude-plugins\claude-centro-de-mando` (creá la carpeta si no existe). Si ya existe y es este repo, hacé `git pull` en vez de clonar.
3. **Instalar.** Corré `node instalar.js` dentro del repo. Tarda alrededor de un minuto porque descarga Electron. No sigas si termina con ✗: mostrale el error al usuario.
4. **Conectores.** Revisá si en tu sesión hay herramientas de Jira (`searchJiraIssuesUsingJql`) y de Google Calendar (`list_events`). Si falta alguna, pedile al usuario que la conecte en claude.ai → Settings → Connectors con su cuenta del trabajo. No le pidas tokens ni contraseñas: no hacen falta.
5. **Cierre.** Avisale que reinicie sus sesiones de Claude abiertas, y que el gatito ya pasea por la barra de tareas: tocándolo se abre el centro de mando.

No modifiques archivos del repo durante la instalación.
