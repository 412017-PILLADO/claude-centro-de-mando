# Centro de mando para Claude Code

Tus sesiones de Claude, tus tickets de Jira y tus reuniones, siempre a la vista.

El gatito puede saltar entre pantallas contiguas.

Son dos piezas que trabajan juntas:

| Pieza | Qué es | Qué muestra |
| --- | --- | --- |
| **Plugin** (`plugin/`) | Un plugin de Claude Code. Corre dentro de cada sesión. | Un panel *Centro de mando* en Claude, una línea de estado (carpeta · rama · cambios · % de contexto) y el comando `/centro`. |
| **Gatito** (`ventana/`) | Una mascota pixel art que pasea por la barra de tareas (app de escritorio en Electron). | **Todas las alertas, como globos que dice el gatito**: sesión que terminó, reunión en 5 minutos (con **Unirse**), avisos. Los globos se van solos; también podés cerrarlos con su ✕. Piensa mientras Claude trabaja, festeja (salta) cuando una sesión termina y se duerme sin actividad. Tiene hambre, cariño y juego, foco/pomodoro y menú de cuidados con clic derecho. |
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
- El panel abre al costado del gato, con Reuniones, Mis tickets y Sesiones en columnas cuando hay espacio. Su alto automático tiene un tope de 540 px; en monitores angostos queda una columna y aparece scroll. Conserva el acceso al Centro, las manijas y Esc.
- Si apagás el gatito, las alertas pasan a ser notificaciones de Windows.
- Todo queda en tu máquina, en `~/.claude/centro/`.
- Tickets y reuniones se renuevan cada 10 minutos mientras haya alguna sesión de Claude abierta. Las alertas de reuniones funcionan aunque no la haya, con la agenda que se cargó antes.

## Uso

| Acción | Cómo |
| --- | --- |
| Abrir / cerrar el centro de mando | **Tocá al gatito** (también `Ctrl+Alt+Espacio` o clic en el ícono de la bandeja). Para cerrar: tocalo de nuevo o `Esc` |
| Alertas | Se van solas: sesiones a los 12 s; reuniones a los 30 s, antes y al empezar. La ✕ también las cierra; el hover conserva la información |
| Entrar a una reunión | **Unirse** en el globo del gatito o en la lista de reuniones |
| Mover al gatito | Arrastralo, también entre monitores. Al soltar se apoya sobre el workArea de ese monitor y lo recuerda; si se desconecta, vuelve a la primaria |
| Cuidados y ajustes | Clic derecho en el gatito: Comer, Mimar, Jugar, Dormir, Foco y Ajustes (nombre, seis pelajes y Pausas activas) |
| Acariciar | Pasar el mouse por encima con varias pasadas horizontales |
| Foco / pomodoro | Clic derecho → Foco → 25 o 50 minutos; después, 5 minutos de descanso |
| Darle de comer | Clic en el cuenco vacío o clic derecho → Comer: elige croquetas, pescado o leche al azar, con más chance de su favorita |
| Pasar un rato juntos | **Mimar** lo hace ronronear bajito; **Jugar** elige ovillo, ratón o caja al azar; **Dormir** le da media hora de descanso |
| Cambiar nombre, pelaje o pausas | Clic derecho → Ajustes |
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

Los 126 dibujos (más el alias `aterrizar2`) salen de ocho hojas con fondo transparente, en `ventana/arte/`. Los 103 PNG de las primeras siete hojas se conservan idénticos en esta tanda. Las hojas se leen por filas, de izquierda a derecha:

| Hoja | Dibujos | Filas |
| --- | --- | --- |
| `gatito-hoja.webp` | 16 | sentado · contento · atento · cola / caminar 1-4 / alerta (!) · tablet · listo (✓) · duda (?) / sueño · durmiendo (zZz) · bolita · estirarse |
| `gatito-hoja-2.webp` | 19 | maullar 1-2 · saludar 1-2 / correr 1-4 / lamerse 1-3 / bostezo 1-3 / salto 1-3 / espaldas 1-2 |
| `gatito-hoja-3.webp` | 6 | mirar arriba 1-2 · agazapado 1-2 (el segundo se espeja al cortar) · zarpazo con la pata 1-2 |
| `gatito-hoja-4.webp` | 18 | pensar 1-8 / alzar 0-2 · colgar 1-4 · caer · aterrizar · sentado final |
| `gatito-hoja-5.png` | 13 | comer 1-4 / cuenco vacío y lleno / ronronear 1-2 / pedir comida 1-2 / ovillo 1-3 |
| `gatito-hoja-6.png` | 18 (6 × 3) | incorporarse, sentarse, acostarse, despertar, estirarse, parpadear, cola y giro |
| `gatito-hoja-7.png` | 12 (4 × 3) | arrancar, frenar, agazaparse y respirar |
| `gatito-hoja-8.png` | 24 (6 × 4) | croquetas 1–4 / pescado 1–4 / leche 1–4 / ratón 1–4 / caja 1–4 / rascar 1–4 |

La hoja 4 trae diez poses en la segunda fila: aterrizar usa el cuadro aplastado y la pose de recuperación final (también exportada como `aterrizar2`, sin cambiar `alzar-fin`). El cortador descarta las manos por posición y agrupa las rueditas con cada gato. La hoja 5 se generó con `imagegen`, usando la hoja 3 como referencia; sus zonas conservan los cuencos y corazones junto a cada pose. `quitarFondoClaro` permite borrar por hoja un fondo claro conectado al borde, sin tocar blancos interiores.

Para cambiar el gatito, reemplazá las hojas (o sumá otra en `HOJAS`, dentro de `ventana/scripts/cortar-hoja.js`) y corré:

```bash
cd ventana && npm run cortar-hoja
```

El script deja todos los dibujos del mismo tamaño y escala, para que el gato no cambie de tamaño entre poses.

Un clic afuera cierra el panel. Tocá el título de una sección para ocultarla por completo; las otras ocupan el espacio y el chip «Mostrar…» la trae de vuelta. Las secciones ocultas se recuerdan.

Sin Electron, desde la raíz: `node ventana/scripts/validar-hojas.cjs` y `node ventana/scripts/validar-hojas.cjs movimientos`. Detectan las filas con el mismo algoritmo del cortador, exportan los treinta cuadros nuevos y comparan los 73 hashes anteriores. En el sandbox de Windows agregá `--preserve-symlinks --preserve-symlinks-main` si Node falla al resolver el directorio del usuario.

`CENTRO_ESCENA=acostarse|caida|seccion-oculta`, junto con `CENTRO_CAPTURA`, prepara capturas reproducibles de los intermedios. Usá una carpeta de `CENTRO_DATOS` vacía para esas escenas y cerrá la app instalada antes de iniciarlas.

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

La saciedad baja 8 puntos por hora (unas 12,5 horas de lleno a vacío). Las comidas tienen dibujos propios: las croquetas saltan del cuenco, el pescado termina en espinas y la leche deja bigote. Cada una cambia saciedad, energía y cariño de distinta manera. La favorita se elige una vez al crear o migrar la vida, suma 8 de cariño extra y provoca un ronroneo. Los cuidados esperan 4,5 segundos entre pedidos, también en el proceso principal; si está llenito, guarda la comida para después. Hay ovillo, ratoncito y caja para jugar.

---

## Instrucciones para Claude

Si te piden instalar este repo, seguí estos pasos en orden y contale al usuario el resultado de cada uno:

1. **Requisitos.** Verificá que sea Windows y que `node --version` sea 14 o más (no le pidas al usuario que actualice Node: la app usa el Node que trae Electron), y que `git` y `claude` estén instalados. Si falta algo, decile al usuario qué instalar y frená.
2. **Clonar.** Cloná el repo en `%USERPROFILE%\claude-plugins\claude-centro-de-mando` (creá la carpeta si no existe). Si ya existe y es este repo, hacé `git pull` en vez de clonar.
3. **Instalar.** Corré `node instalar.js` dentro del repo. Tarda alrededor de un minuto porque descarga Electron. No sigas si termina con ✗: mostrale el error al usuario.
4. **Conectores.** Revisá si en tu sesión hay herramientas de Jira (`searchJiraIssuesUsingJql`) y de Google Calendar (`list_events`). Si falta alguna, pedile al usuario que la conecte en claude.ai → Settings → Connectors con su cuenta del trabajo. No le pidas tokens ni contraseñas: no hacen falta.
5. **Cierre.** Avisale que reinicie sus sesiones de Claude abiertas, y que el gatito ya pasea por la barra de tareas: tocándolo se abre el centro de mando.

No modifiques archivos del repo durante la instalación.

### Gatito simplificado (séptima tanda)

El gato conserva sus necesidades y rasgos internos sin mostrarlos como cifras, barras ni textos. Los cuidados y ajustes se abren con clic derecho. `gatito.json` versión 4 mantiene la vida persistente.

Al dejar el mouse sobre el gato aparece una tarjeta: foco o descanso con contador grande `mm:ss`, progreso y **Terminar**, próxima reunión con **Unirse** desde 15 minutos antes, y sesiones recientes esperando. Sin novedades muestra solo su nombre. Aparece tras 350 ms y espera 450 ms antes de ocultarse para poder alcanzar los botones. Una pastilla sobre el gato muestra el foco incluso sin hover. El clic abre el panel, las pasadas rápidas acarician y el arrastre sigue funcionando; el menú rápido conserva su abanico de botones redondos.

Las escenas `foco`, `foco-hover` y `resumen-hover` preparan capturas de revisión, siempre de las ventanas del panel y la franja.

### Gatito: quinta tanda

El centro de mando muestra reuniones, tickets y sesiones. El gato expresa sus necesidades mediante animaciones: bosteza y cabecea antes de dormir, pide junto al cuenco, se sienta de espaldas para buscar mimos y mira alrededor antes de entretenerse solo.

No quedan muebles fijos. `gatito.json` migra a versión 4 e ignora cama/rascador y accesorios antiguos conservando los cuidados, nombre y pelaje. El gato camina hasta un borde para rascarlo o acurrucarse, espejado según el lado. Se reutiliza la hoja 8 recortando el poste fuera de pantalla, sin generar hojas ni cambiar sprites.

Con energía <22 busca dónde dormir; con cariño <30 se acerca y se sienta de espaldas mirando sobre el hombro; al acariciarlo se da vuelta y ronronea. El aburrimiento lo hace mirar alrededor y luego rascar o jugar con el ovillo. Con hambre (<25, hasta <30 según su rasgo glotón), camina y pide mirando el cuenco vacío; un clic en ese cuenco le da comida al azar. Después de comer tiene 45 minutos de gracia; luego espera 10/20/40/80/120 min entre pedidos, nunca durante reuniones ni alertas de trabajo. La mañana trae un saludo diario; se despide mientras seguís activo, cerca de tu hora habitual de salida. Hay racha, festejos por semana/mes/cumpleaños y diario. Los rasgos crecen lentamente con cuidados e iniciativas y cambian probabilidades y frases; aprende el inicio/fin de tu jornada.

Las pausas activas invitan a estirarse tras 90 min de actividad continua o sesiones trabajando. **Dale**, **Después** y cierre permiten responder; se apagan desde clic derecho → Ajustes. Todos los umbrales, esperas e histéresis están en [COMPORTAMIENTO.md](ventana/COMPORTAMIENTO.md).

Verificación sin Electron desde la raíz: `node --preserve-symlinks --preserve-symlinks-main ventana/scripts/probar-gatito.cjs` y `node --preserve-symlinks --preserve-symlinks-main ventana/scripts/verificar-interfaz.cjs`. Las escenas `borde`, `hambre` y `pausa` preparan capturas de las ventanas del panel y la franja, nunca del escritorio. Los comandos de PowerShell están en [VERIFICACION-TANDA5.txt](ventana/VERIFICACION-TANDA5.txt). Se verifican lógica y DOM simulado; alto físico, DPI, animaciones y foco se revisan en Windows con esas capturas. `CENTRO_HORA` y la escena `collar-cama` se retiraron junto con la habitación y los muebles.


### Gatito: sexta tanda

El panel conserva sus estilos actuales. El menú del gato usa iconos de los sprites existentes y ofrece Comer, Mimar, Jugar, Dormir, Foco y Ajustes. Comer y Jugar eligen una variante al azar; los cuidados aceptados se expresan con animación y los rechazados con un globo de 3 segundos.

Acariciá al gato con varias pasadas horizontales del mouse: cierra los ojos, ronronea bajito y recibe el mismo cuidado persistente que **Mimar**. No cuenta movimientos durante el arrastre o la caída. El clic izquierdo sigue abriendo el panel. El clic derecho abre un menú en abanico centrado sobre el gato: comidas, mimos, juego, siesta y foco. Cerralo con Esc, clic afuera o al elegir; también podés recorrerlo con las flechas del teclado.

**Foco** se inicia por 25 o 50 minutos desde el submenú Foco del clic derecho. El gato duerme quieto, sus necesidades quedan congeladas y no inicia pedidos ni pausas. Las alertas de reuniones (incluso sin enlace) y de sesiones de Claude siguen llegando. Al terminar se despierta, se estira y muestra un globo cerrable para descansar 5 minutos; al terminar el descanso avisa suave. Hay cuenta regresiva junto al gato y en su tarjeta de hover. Las fechas se guardan en gatito.json y sobreviven un reinicio; **Terminar** permite cancelar.

No se generaron hojas nuevas: se reutilizan ronronear1–2, acostar1–2, dormir1, respirar2–3, despertar1–2 y estirar-nuevo, conservando los hashes anteriores. Las pruebas Node se mantienen en los mismos dos scripts. [VERIFICACION-TANDA6.txt](ventana/VERIFICACION-TANDA6.txt) tiene los comandos de las cuatro escenas de captura, con datos aislados y únicamente ventanas de panel/franja. Queda revisar esas capturas, el alto físico a distintos DPI y la interacción nativa de Windows; Electron no se ejecutó en el sandbox.
