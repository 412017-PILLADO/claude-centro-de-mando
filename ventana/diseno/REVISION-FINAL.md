# Revisión final

Rama fix/gatito-revision; sin commits, cambios de rama ni reversión del trabajo previo.

## Cambios por archivo

- `src/ui/comportamiento.js`: Ciclos cabecear/empujar/panza, metadatos de pose, alternancia de hambre y preparación de sueño por el grafo.
- `src/ui/mascota.js`: Puntos de estado, barra basada en desde/hasta, cuenco integrado clickeable, etiquetas del abanico, filas del hover y retorno desde ajustes.
- `src/ui/mascota.css`: Vidrio simulado, colita, barra, cierre al hover/foco, círculos de 48 px con etiquetas, tarjetas y controles.
- `src/ui/mascota.html`: Interruptor accesible de pausas y botón Volver de ajustes.
- `src/ui/tokens.css`: Capas de vidrio, borde, sombra, tipografía, radios, colores y foco visible/movimiento reducido.
- `src/ui/index.html`: Franja Ahora y menú de opciones de reuniones.
- `src/ui/estilos.css`: Jerarquía vertical por urgencia, línea de tiempo, tickets densos agrupados, segmentado y sesiones.
- `src/ui/app.js`: Render de Ahora a 15 minutos, agrupación/conteos de tickets, filtros accesibles, agenda y carpetas/antigüedad de sesiones. Se conservan umbrales de negocio.
- `src/ui/secciones.js`: Los clics en el menú de opciones no ocultan la sección.
- `src/main.js`: Panel Windows con acrylic, transparent:false y fondo transparente para permitir el material; otros sistemas usan vidrio CSS. Sin tocar IPC de tamaño/posición/cierre.
- `arte/estados.json`: Selección de escritura exclusiva de panza1/2 y referencia sentado por cuadro.
- `scripts/validar-hojas.cjs`: Soporte de selección explícita de sprites y referencia de escala por cuadro, conservando validaciones previas.
- `src/ui/sprites/panza1.png y panza2.png`: Altura visible de 194 px, igual a sentado; lienzo 288 × 237.
- `scripts/probar-gatito.cjs`: Verifica extremos de la variante elegida y agrega alternancia/grafo/cabecear completo.
- `scripts/verificar-interfaz.cjs`: DOM simulado adaptado a etiquetas/filas; conserva verificaciones y agrega alimentación con cuenco integrado y barra de duración real.
- `scripts/verificar-panel.cjs`: Prueba renderer del panel: urgencias, enlaces, agrupación, carpetas, filtros, alerta de prueba y manijas.
- `scripts/verificar-diseno.cjs`: Contraste reproducible y comparación exhaustiva SHA-256.
- `scripts/capturar-diseno.cjs y captura-preload.cjs`: Escenas ficticias offscreen, sin datos personales, para capturePage claro/oscuro.
- `COMPORTAMIENTO.md`: Documentación de los gestos, diseño, escalado y límites de validación.

## Contraste

# Contraste WCAG

Composición alfa en sRGB; escritorio blanco, reflejo blanco al 10% en su máximo. El escritorio negro produce mayor contraste. Acentos de texto sólo sobre secciones tintadas; vidrio liviano siempre usa texto principal. No se reduce la opacidad del texto.

| Uso | Texto | Peor fondo (escritorio blanco) | Contraste |
|---|---|---|---:|
| Globos, menú y etiquetas (reflejo máximo) | #f0f2fa | rgb(104.02, 106.61, 114.38) | 4.79:1 |
| Principal en tarjeta/panel | #f0f2fa | rgb(75.83, 78.85, 86.41) | 7.35:1 |
| Secundario en tarjeta/panel | #d4dbea | rgb(75.83, 78.85, 86.41) | 5.92:1 |
| Tenue en tarjeta/panel | #c5cee0 | rgb(75.83, 78.85, 86.41) | 5.20:1 |
| Lila en secciones | #c2b5f5 | rgb(27.25, 31.10, 40.71) | 8.80:1 |
| Ámbar en secciones | #efc36f | rgb(27.25, 31.10, 40.71) | 9.96:1 |
| Error en secciones | #f29b9b | rgb(27.25, 31.10, 40.71) | 7.79:1 |
| Menta en secciones | #a5e5c8 | rgb(27.25, 31.10, 40.71) | 11.48:1 |
| Texto/control en hover | #f0f2fa | rgb(48.00, 54.00, 69.00) | 10.80:1 |
| Texto/control en hover | #d4dbea | rgb(48.00, 54.00, 69.00) | 8.69:1 |
| Texto/control en hover | #c5cee0 | rgb(48.00, 54.00, 69.00) | 7.63:1 |
| Texto/control en hover | #c2b5f5 | rgb(48.00, 54.00, 69.00) | 6.45:1 |
| Texto/control en hover | #efc36f | rgb(48.00, 54.00, 69.00) | 7.31:1 |
| Texto/control en hover | #f29b9b | rgb(48.00, 54.00, 69.00) | 5.71:1 |
| Texto de acción y filtro activo | #161a26 | rgb(194.00, 181.00, 245.00) | 9.28:1 |

## Hashes

Comparación de los 140 PNG: 138 intactos. Sólo panza1.png y panza2.png cambiaron. Antes/después completos en hashes-sprites-antes.json y hashes-sprites-despues.json. Resumen:

```json
{
  "total": 140,
  "intactos": 138,
  "cambios": [
    {
      "archivo": "panza1.png",
      "antes": "70909E98F9DA945158F21A733C78ACD6E331F86B61CD2A5B87E0DE7B73596E44",
      "despues": "20DE78AB51143E60E3E9BF7C85C931437CE98A618DA3BAB843B7B940559AD7EC"
    },
    {
      "archivo": "panza2.png",
      "antes": "05403F9F1D9F6AFE30F951DF0BF9AE0AAE5549AFCBCAFF510E1CF0E23F139671",
      "despues": "4D0A2BE200FD895B3E05B0D83A61929F49CEAE6793D2A3B6D3E4CEED65BBEDBA"
    }
  ]
}
```

## Capturas y límites

No hay PNG de captura. Electron abortó por install_dir_access.cc:52 (ACL AppContainer sin ALL APPLICATION PACKAGES) antes de crear ventanas, también al reintentar sin sandbox. No se modificaron permisos. Ver capturas/LEEME.md para comandos y diagnóstico. No se pudo revisar ni corregir visualmente, ni confirmar acrylic, DPI o arrastre/blur nativos. Se dejó combinación acrylic + transparent:false + backgroundColor transparente y respaldo CSS.

## Salida completa final de pruebas

La invocación normal de ambos scripts dio EPERM al resolver C:\Users\mateo. Se reintentó con los flags solicitados. Ambas salidas finales completas:

```text
Desde ventana/:
node --preserve-symlinks --preserve-symlinks-main scripts/probar-gatito.cjs
Vida verificada: decaimiento, sueño, límites, acciones, persistencia y archivo corrupto.
Datos de prueba: C:\Users\mateo\AppData\Local\Temp\centro-gatito-5ihcSi
Máquina y monitores verificados: prioridades, cierre sentado, cuidados visibles, trabajo sin paseos, sin tablet, dos aterrizajes y respaldo de monitor.
Cancelación actual y pendiente con continuidad de pose: OK.
Grafo completo, continuidad entre animaciones, ocho horas de sueño, alerta real y gravedad en tres monitores: OK.
Regresiones: gracia tras comer, despedida activa, fin real, hito unico, fechas y migracion: OK.
Cuarta tanda: comidas propias, favorita persistida, espera, lleno, retiro de accesorios, diario, retiro de muebles, migración y 127 hashes viejos: OK.
Quinta tanda: migración sin muebles, necesidades e histéresis, hambre con espera creciente, jornada, racha, aniversarios, pausas y probabilidades: OK.
Persistencia de rasgos y pausa, respuestas Dale/Después, respeto del sueño e integración de reunión completa: OK.
Sexta tanda: foco 25/50, necesidades, reinicio, vencimientos, avisos y cancelación: OK.
Caricias: pasadas amplias, temblor, espera, salida y arrastre: OK.
Conductas realizadas sin cuidado y despedida quince minutos antes: OK.
Necesidades por comportamiento: bostezo y cabeceo antes de dormir, vuelta desde espaldas y grafo: OK.
Sprites nuevos: hambre alternada, cabecear parado antes de acostarse y continuidad: OK.
Exit: 0

node --preserve-symlinks --preserve-symlinks-main scripts/verificar-interfaz.cjs
Alertas: sesión vence a 12 s sin reaparecer; menú, comida ponderada, cuenco y rechazos: OK.
Tarjeta sin parpadeo y conductas propias exactamente una vez: OK.
Interfaz verificada: renderer, caricias sin clic/arrastre, menú, foco dormido, avisos de trabajo y despertar. DOM simulado: OK.
Barra de alerta: duración real y refresco sin reiniciar el plazo: OK.
Centro sin pestaña del gato ni necesidades: OK.
Panel: urgencia a 15 min, Unirse, estados, carpetas, filtros, menú de prueba y manijas: OK.
Exit: 0
```

También pasaron verificar-diseno.cjs y comprobación de sintaxis de main.js, mascota.js, app.js y validar-hojas.cjs.
