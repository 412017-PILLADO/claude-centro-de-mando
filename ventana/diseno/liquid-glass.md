# Brief: liquid glass para el gatito y el centro de mando

Leé primero `diseno/frontend-design.SKILL.md`: este brief es la aplicación concreta de esa guía a este producto.

## Qué es y para quién

Una mascota de escritorio que vive sobre la barra de tareas de Windows 11 y avisa lo útil: una sesión de Claude que terminó y te espera, una reunión que empieza, el foco en curso. La persona está trabajando en otra cosa; el gatito interrumpe lo mínimo. El tamagotchi (comer, mimar, dormir) es el encanto, pero nunca compite con la información.

Trabajo primero: un aviso se entiende de un vistazo en menos de un segundo, sin leer dos veces.

## Dirección visual

Vidrio líquido de Windows 11 / visionOS, no glassmorphism genérico de Dribbble. Material calmo, translúcido, que deja adivinar el escritorio, con un borde de luz fino y una profundidad física creíble. El gatito es pixel art: el vidrio es suave y redondeado, el gato es nítido y pixelado. Ese contraste es la identidad; no pixelar la interfaz ni redondear el gato.

## Material (tokens, en `src/ui/tokens.css`)

Reemplazá los valores sólidos por un sistema de capas. El contraste de texto no se negocia (el comentario de tokens.css lo dice): todo texto ≥ 4.5:1 contra el peor fondo posible (escritorio blanco o foto clara). Por eso el vidrio es tintado oscuro y bastante opaco, no transparente.

- `--vidrio`: rgba(22, 26, 38, .72) para globos y menú; `--vidrio-fuerte`: rgba(18, 22, 32, .84) para la tarjeta y el panel.
- Desenfoque: `backdrop-filter: blur(18px) saturate(160%)` (dentro de cada ventana; ver límites).
- Borde de luz: 1px `rgba(255,255,255,.14)` más un `inset 0 1px 0 rgba(255,255,255,.18)` arriba (el brillo del canto), y `inset 0 -1px 0 rgba(0,0,0,.25)` abajo.
- Sombra en dos capas: una cercana y nítida (0 1px 2px rgba(0,0,0,.35)) y una lejana y difusa (0 12px 32px rgba(0,0,0,.35)).
- Reflejo: un `::before` con gradiente lineal de rgba(255,255,255,.10) arriba a transparente a 45%, recortado al radio. Sutil; si se nota como "brillo de plástico", es demasiado.
- Radios: globo 16px, tarjeta 18px, botones del abanico círculo completo, panel 20px. Mismo radio en todo lo que es del mismo nivel.
- Acento: mantené el lila actual (`--acento: #c2b5f5`) como único color de marca. Estado "listo" (sesión terminó): verde menta suave solo como punto o línea de 2px, nunca fondo entero. Reunión: ámbar `--aviso` igual, solo como acento.
- Tipografía: Segoe UI Variable (Display para el número del foco y títulos, Text para el resto). Escala corta: 11 / 13 / 15 / 34. Peso 600 solo para el nombre de la sesión o reunión. Cifras tabulares en contadores.

## Límites técnicos (respetarlos, no inventar)

- La mascota es una franja transparente del ancho del monitor que deja pasar los clics. Ahí `backdrop-filter` solo desenfoca lo que está dentro de la misma ventana (nada), no el escritorio. Por eso en globos, menú y tarjeta el vidrio es "simulado": tinte + borde de luz + reflejo + sombra. Que se vea bien igual sobre fondo claro y oscuro.
- El panel del centro de mando sí puede usar el material real de Windows 11: Electron 44 tiene `backgroundMaterial: 'acrylic'` en `BrowserWindow`. Probalo en `src/main.js` para la ventana del panel (Windows 11 22H2+). Si con `transparent: true` no aplica, documentá la combinación que sí funciona y dejá un respaldo: el mismo vidrio simulado. No rompas el redimensionado ni el arrastre del panel.
- Respetá `prefers-reduced-motion` (ya hay regla global) y el foco visible por teclado.

## Piezas

### Globo de aviso (lo más importante)

Una línea, máximo dos. Estructura: punto de estado (6px, color según tipo) · **nombre** (600) · verbo corto en tono normal ("terminó", "te espera", "en 4 min"). Acción a la derecha solo si existe (Unirse) como pastilla con acento; el ✕ aparece al pasar el mouse, no siempre. Sin emojis como íconos (hoy 💬 📅 ✓ 🐾): reemplazalos por el punto de estado o glifos SVG de 12px coherentes con los del panel. La colita del globo es parte del mismo vidrio (mismo tinte y borde), no un triángulo plano.
Entrada: sube 6px y aparece en 220ms con easing suave (cubic-bezier(.2,.8,.2,1)); salida: se desvanece y colapsa en 180ms. Barra de tiempo: una línea de 2px en el borde inferior que se vacía mientras el globo vive (los avisos se van solos).

### Menú del clic derecho (abanico)

Botones circulares de vidrio de 48px alrededor del gato, con el sprite o un glifo centrado y la etiqueta debajo en 11px dentro de una pastilla de vidrio (no texto suelto sobre el escritorio). Aparición escalonada 20ms por botón. Hover: el vidrio se aclara (+.06 de blanco) y el borde de luz pasa a acento. Sub-abanicos (Foco, Ajustes) reemplazan al principal con la misma animación, con "Volver" siempre en la misma posición.

### Ajustes (desde ⚙)

Tarjeta de vidrio chica: nombre (input sin caja, subrayado de 1px que se ilumina al enfocar), fila de 6 puntos de color de pelaje (el elegido con anillo de acento), y un interruptor "Pausas activas". Nada más.

### Tarjeta del hover

Es un resumen de utilidad: título = nombre del gato o "Foco" / "Descanso". Si hay foco: el contador grande (34px, Display, tabular) con un anillo o línea de progreso fina, y "Terminar" como botón fantasma. Debajo, como máximo dos filas con punto de estado: la próxima reunión (con Unirse si faltan ≤15 min) y "N sesiones te esperan". Sin necesidades del gato, nunca.

### Panel del centro de mando

Hoy es una pila de secciones con títulos, cuentas y flechas: se siente tosco porque todo pesa lo mismo. Reorganizalo por urgencia:
1. Arriba, una franja "Ahora": lo que pide acción ya (reunión en ≤15 min con Unirse, sesiones que te esperan). Si no hay nada, una línea tranquila ("Todo en orden") y desaparece el bloque.
2. Reuniones del día como línea de tiempo compacta: hora a la izquierda en cifras tabulares, título, y la actual/próxima resaltada con el acento. Las pasadas se atenúan.
3. Tickets: agrupados por estado con conteo, filas densas de una línea (clave en monoespaciada tenue, título, estado como punto de color). Los filtros como segmentado de vidrio, no botones sueltos.
4. Sesiones de Claude: cada fila con punto de estado (trabajando = pulso lento lila, esperando = ámbar fijo, sin señal = gris), nombre, carpeta tenue y "hace X". El ✕ de quitar al pasar el mouse.
Secciones como bloques de vidrio sobre el acrílico, separadas por espacio (16px), no por líneas. Títulos de sección en 13px 600 sin mayúsculas. Plegables como hoy.
"Probar alerta" no es una acción de primer nivel: llevalo a un menú "…" de la sección.

## Qué evitar

- Gradientes de colores saturados, neón, brillos fuertes.
- Todo con el mismo peso visual: lo urgente tiene que ganar.
- Texto en mayúsculas para etiquetas, numeraciones decorativas, emojis como íconos.
- Bajar el contraste por "verse más vidrio".

## Cómo validar

- Capturas sobre fondo de escritorio claro y oscuro (podés renderizar `mascota.html` e `index.html` en Electron con un fondo de prueba detrás, o con una página de prueba que ponga una imagen de fondo). Si no podés capturar, decilo.
- Contraste medido de cada par texto/fondo contra el peor caso.
- Las pruebas existentes (`scripts/probar-gatito.cjs`, `scripts/verificar-interfaz.cjs`) siguen pasando.
