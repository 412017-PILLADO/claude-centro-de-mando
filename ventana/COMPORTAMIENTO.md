# Comportamiento del gatito

`src/ui/comportamiento.js` comparte la máquina con las pruebas. Cada animación declara `inicio` y `fin`; `camino` usa BFS para insertar el camino más corto antes del siguiente ciclo. Se conserva la pose final: dormir nunca agrega un sentado al final. `tramos` permite inspeccionar la continuidad. El arrastre es una interrupción física; caer conserva `caer1` hasta recibir el contacto real con el piso.

| Pose base | Dibujos / uso |
| --- | --- |
| sentado | sentado-quieto, parpadeo1–2, cola-nueva; trabajo, avisos y mimos |
| parado | parado, frenar3; giro |
| caminando | caminar1–4; arranque y frenada |
| acostado | dormir1, respirar2–3; una sola secuencia de sueño |
| agazapado | agachar3; croquetas1–4, leche1–4, raton1–4 y ovillo1–2 |
| suspendido | alzar0–2, colgar1–4; agarrado |
| cayendo | caer1; sin aterrizar antes del contacto |

| Transición dirigida | Dibujos en orden | ms por cuadro |
| --- | --- | --- |
| sentado → parado | incorporar1, incorporar2, parado | 140 |
| parado → sentado | sentarse1, sentarse2, sentarse3 | 160 |
| sentado → acostado | acostar1, acostar2, dormir1 | 260 |
| acostado → parado | despertar1, despertar2, estirar-nuevo, parado | 280 |
| parado → caminando | arrancar1–3 | 110 |
| caminando → parado | frenar1–3 | 130 |
| sentado → agazapado | agachar1–3 | 180 |
| agazapado → sentado | agachar3, agachar2, agachar1 | 180 |
| sentado → suspendido | alzar0–2 | 140 |
| suspendido → cayendo | caer1 | 100 |
| cayendo → sentado | aterrizar1, aterrizar2, sentado-quieto | 180 |

Todas las poses son alcanzables entre sí. El giro usa girar1, girar2 y girar3 (160/180/160 ms). El espejo cambia después de pasar por el frente; esos tres cuadros conservan la orientación inicial. El panel pide un giro cuando queda del otro lado. Caminar está disponible como ciclo explícito; el trabajo sigue en el lugar; el ocio puede iniciar un paseo hasta un borde.

| Animación | Inicio → fin | Prioridad / criterio |
| --- | --- | --- |
| reunion | sentado → sentado | 5, una por aviso |
| sesion | sentado → sentado | 4, una por turno |
| comer, jugar | agazapado → agazapado | 3, cuidados en cola |
| croquetas, leche, raton | agazapado → agazapado | 3, dibujos propios; el ratón y las croquetas vuelven a la pose baja |
| pescado | sentado → sentado | 3, sostiene el pescado y termina con las espinas |
| caja, rascar | parado → parado | 3, la caja revierte la entrada para salir; rascar termina en reposo |
| mimar | sentado → sentado | 3 |
| pensar | sentado → sentado | bloques de 20–60 s; cuadros de 1,8–3,5 s |
| hambre | sentado → sentado | espera creciente: 10, 20, 40, 80 y 120 minutos |
| dormir (incluye siesta) | acostado → acostado | energía menor a 22, necesidad propia o pedido explícito |
| panel, ocio | sentado → sentado | bloques dinámicos de 30–90 s; parpadeo cada 4–8 s y cola cada 15–30 s |
| caminar | caminando → caminando | pedido explícito, 160 ms por cuadro |
| girar | parado → parado | al abrir el panel del otro lado |
| soltar | sentado → sentado | 6; entra desde cayendo, insertando aterrizaje |

## Dormir sin bucles

Una sola secuencia: acostarse → respirar con zzz → despertar → estirarse. No se usan durmiendo ni bolita como ciclos alternativos; sueno sólo aparece como gesto de cansancio en el reposo sentado. Antes de acostarse bosteza y hace uno o dos cabeceos sentado. La respiración recorre respirar1–3 cada 900 ms en bloques de 30–60 s; descansado se despierta en el momento, sin esperar el fin del bloque. Duerme un mínimo de quince minutos y se despierta al recuperar al menos 75 de energía, una vez terminada la siesta solicitada. El ocio, el panel y el hambre no lo despiertan. Una reunión, un cuidado, un saludo o un festejo sí pueden despertarlo antes. Una sesión que termina no lo despierta: sólo aparece el globo. Después tiene cinco minutos de vigilia. Los eventos esperan a que termine la entrada a acostarse.

El renderer renueva el descanso cada treinta segundos mientras muestra los cuadros de sueño; así no vence el permiso de un minuto de la vida persistente. Los pedidos de siesta consumidos no quedan pendientes para disparar otro sueño al despertar.

## Hojas y alineación

Hoja 6: seis filas de tres; incorporar1–2/parado, sentarse1–3, acostar1–2/dormir1, despertar1–2/estirar-nuevo, parpadeo1–2/cola-nueva y girar1–3. Hoja 7: cuatro filas de tres; arrancar1–3, frenar1–3, agachar1–3 y respirar1–3. Los prompts quedan al lado; se generaron con la herramienta integrada usando las hojas originales como referencia.

Los manifiestos arte/transiciones.json y arte/movimientos.json son compartidos por el cortador y la validación sin Electron. Cada hoja conserva su escala general; el lienzo sigue en 288 × 237, centrado y apoyado abajo. Las poses bajas no se agrandan individualmente. No hizo falta desplazamiento adicional. Los PNG viejos no se reescriben al validar: se comparan sus 73 hashes con hashes-antes-tanda3.json.

scripts/validar-hojas.cjs decodifica PNG con zlib y ejecuta el detector real del cortador sobre un canvas simulado: compara las filas detectadas, sin zonas que inventen el conteo. Exporta sólo los cuadros nuevos por vecino cercano. El cortador de Electron sigue disponible para regenerar todo; puede haber diferencias de interpolación en los sprites nuevos respecto del exportador de Node. Las reglas de las hojas anteriores no cambian.

## Arrastre y pantallas

La misma ventana sigue el cursor durante el arrastre. Al soltar conserva su altura y cae con y = origen + 950 × segundos² hasta workArea.y + workArea.height − 340 del monitor más cercano al cursor. El gato está apoyado en el borde inferior de esa ventana, por eso el contacto coincide con la barra de tareas. Durante la caída toda la ventana deja pasar clics. El proceso principal avisa al renderer cuando toca piso; recién ahí se ve aplastarse → recuperarse → sentado. No se crea una ventana que cubra el escritorio.

Se guarda el id del monitor elegido y se usa la primaria si deja de existir. El panel reserva espacio para el gato y se adapta al ancho del monitor.

## Panel

El blur cierra el panel salvo mientras se redimensiona o si el cursor está sobre el gato (ese clic lo alterna). El gato informa su centro por IPC para comprobar esa excepción. Ocultar aplica hidden a la sección completa: sale de la grilla y las columnas visibles se reparten el espacio. Los chips «Mostrar…» permiten recuperarla, incluso si ocultaste todas. Se recuerda con las mismas claves de las secciones plegadas.

## Necesidades y jornada (quinta tanda)

`src/rutina.js` decide con reloj y azar inyectables; `main.js` aporta reuniones completas (desde cinco minutos antes hasta el fin, aun sin enlace), alertas de sesiones, actividad de Windows y sesiones trabajando. Se observa cada cinco segundos. Los eventos se envían juntos a ambos renderers; recién se consumen cuando la franja terminó de cargar. Se guardan esperas y fechas en `gatito.json` versión 4. La migración conserva nombre, pelaje, cuidados, favorita y diario; descarta `muebles`, aunque cama y rascador estuvieran activos. No hay controles ni nodos para muebles fijos.

| Necesidad | Entrada | Salida / histéresis | Conducta y espera |
| --- | --- | --- | --- |
| Energía | <22 | ≥75; sueño mínimo de 15 min | Camina a un lugar, 60% de las veces al borde más cercano, y recorre acostarse → respirar → despertar → estirarse. El respaldo del renderer también atiende energía baja. |
| Cariño | <30 | ≥55 | Camina hacia el cursor si está en su pantalla y se movió hace poco, y se pone de espaldas. No se cumple solo: tocarlo de espaldas es Mimar. +0,15 mimoso por iniciativa. |
| Aburrimiento | ≥60; sube 18/h | ≤20 | Juega con el ovillo; baja 45 y suma 0,15 juguetón. Los juegos manuales también bajan 45. |
| Hambre | Saciedad <25 + glotón/20 (25–30) | Saciedad ≥45 | Se sienta junto a un cuenco temporal, `pedir1–2` y un emote 🐟 de 9 s. El pescadito abre Gatito con Comer desplegado. Repite tras 10, 20, 40, 80 y 120 min; luego mantiene 120. Comer hasta ≥45 reinicia la espera. |

Las iniciativas propias esperan 5 min entre sí. No interrumpen el sueño para pedir comida, jugar o buscar mimos. Hambre y pausa se posponen durante reuniones y alertas de trabajo; si aparecen mientras hay un globo propio, ese globo se retira y se cancela el pedido pendiente. El inicio de una reunión y el fin de una sesión conservan su prioridad. Las iniciativas no se programan con el panel abierto, salvo el pedido de comida. El usuario conserva el control mediante los cuidados manuales.

## Bordes sin muebles

En ocio se elige entre jugar, mimar, dormir o pasear hasta uno de los extremos del `workArea` elegido. El viaje usa `caminar` y las transiciones del grafo; sólo al llegar empieza `rascar` o `dormir`. El lado izquierdo usa dirección −1 y el derecho +1. El arrastre cancela el viaje; al cambiar el ancho se recalcula el destino.

Para rascar se reutiliza la hoja 8 sin reescribirla: el límite de la pantalla pasa por el 59% del lienzo mirando a la derecha y por el 41% al espejar. No hay máscara: rasca sólo junto a la pared del monitor. No se generaron hojas ni prompts nuevos. Se conservan `arte/cuidados.json` y los prompts existentes para el cortador. El cuenco de afuera es el vacío: queda en el piso mientras tenga hambre (ver «Revisión de vida»). Croquetas y leche traen su propio cuenco dibujado.

## Rutina, racha y aniversarios

La primera actividad del día entre las 5 y las 12 dispara `saludar1–2` y «¡Buen día!» una sola vez por fecha local, aun reiniciando. Si arrancás después del mediodía, se cuenta el día juntos sin saludo de mañana. Desde las 16 (o una hora antes del fin aprendido, si es posterior), diez minutos de inactividad disparan `bostezo1–3` y una despedida, una vez por fecha y sin reunión ni alerta.

La racha cuenta días calendario locales con actividad; perder un día la reinicia a 1. El inicio se aprende de la primera actividad diaria y el fin de la primera despedida diaria, con promedio móvil: 80% valor previo + 20% nueva hora. Arranca en 9–18 h. La hora de fin aprendida ajusta cuándo puede despedirse; el saludo conserva la ventana matutina. Los rasgos y horarios aprendidos son internos.

A los 7 y 30 días y en el aniversario de creación festeja una vez por hito, con un aviso y una entrada en el diario, sin accesorios.

## Pausas activas

Se invita tras 90 min continuos de sesiones trabajando **o** actividad de Windows con menos de 5 min de inactividad. Cinco minutos de pausa sin sesiones trabajando, o más de 2 min sin observaciones (app cerrada/suspendida), reinician el tramo. La reunión o alerta difiere el aviso sin consumirlo. Se estira mediante el grafo y muestra «¿Nos estiramos un toque?» durante 21 s: **Dale** fija la siguiente invitación a 90 min; **Después** y el cierre la difieren 15 min. Si se deja vencer sola, espera 90 min. Se puede apagar desde clic derecho → Ajustes; se persiste. Reiniciar la app no repite una invitación ya emitida.

## Personalidad

Los rasgos van de 0 a 100. Un cuidado aceptado suma 0,4: comidas → glotón; juegos → juguetón; mimos → mimoso; siesta → dormilón. Las iniciativas de jugar, mimar o dormir suman 0,15 al rasgo correspondiente. Rechazos y clics durante la espera no suman.

En ocio se sortea con pesos `jugar = 0,25 + juguetón/200`, `mimar = 0,25 + mimoso/200`, `dormir = 0,25 + dormilón/200`, `rascar = 0,15 + juguetón/400`. Se normalizan por su suma. El glotón adelanta el umbral de hambre hasta 30. El dormilón cambia la despedida desde 25 puntos. Las necesidades urgentes tienen prioridad sobre este sorteo. No se sortean paseos durante sesiones trabajando.

## Cuidados y panel compacto

Croquetas suman 25 saciedad, 3 energía y 2 cariño; pescado 40/5/5; leche 15/2/3. La favorita suma 8 de cariño extra y ronroneo. Los cuidados tienen espera de 4500 ms en main y UI; con saciedad ≥95, o ≥85 tras comer en los últimos 20 min, rechaza sin animación ni progreso. El diario conserva hasta 24 entradas.

La antigua pestaña del gato fue retirada. Nombre, colores y Pausas activas viven en la tarjeta Ajustes junto al gato; los cuidados se eligen en el abanico. No se muestran necesidades, barras, cifras, ánimo ni diario en el centro.

## Verificación

Desde la raíz, en Windows:

```powershell
node --preserve-symlinks --preserve-symlinks-main ventana/scripts/probar-gatito.cjs
node --preserve-symlinks --preserve-symlinks-main ventana/scripts/verificar-interfaz.cjs
```

Se comprueban vida, migración real sin muebles, persistencia, cuidados, grafo, sueño, caída/monitores, hashes, umbrales, histéresis, esperas de hambre, supresión en reunión/alerta, rutina diaria, racha, hitos, pausa de 90 min y probabilidades. El renderer real corre con DOM simulado para verificar ambos bordes/espejos, sueño autónomo, emote y apertura de comidas, controles y plegables. El CSS limita el contenido; el DOM simulado no mide el alto físico. La parte Electron conserva aserciones para comprobar ≤540 px y geometría real cuando se ejecute en Windows.

No se ejecutan Electron ni el cortador en el sandbox. No hubo hojas nuevas ni se reexportaron PNG: se comparan los 103 hashes anteriores. Las escenas `CENTRO_ESCENA=borde|hambre|pausa` se combinan con `CENTRO_CAPTURA` y `CENTRO_CAPTURA_MASCOTA`. Sólo capturan panel/franja con `capturePage`; se retiró la captura del escritorio completo. Los comandos exactos están en `VERIFICACION-TANDA5.txt` y en el scratchpad solicitado `codex5/VERIFICACION.txt`. Quedan para revisión visual el recorte de las patas junto al borde, alto real a distintos DPI y foco/arrastre de Windows.


## Séptima tanda: simplificar y consultar al pasar el mouse

El centro conserva solo la vista de utilidad. La tarjeta de hover se retiró; el título del gato dice si tiene hambre o pide mimos.

La versión 4 de gatito.json descarta accesorio/desbloqueados y entradas de diario cuyo id comienza con accesorio-. Conserva nombre, pelaje, necesidades, cuidados, favorita, foco, rasgos y autonomía. Los aniversarios siguen con aviso y diario, sin gorrito. No se generan sprites nuevos.

La tarjeta sobre el gato espera 350 ms de hover; al salir conserva 450 ms para llegar a los botones. Usa posicion-mouse cada 50 ms, también en click-through. Sólo su rectángulo visible participa de mascota-interactiva. Arrastrar, caer y abrir el menú la ocultan; no sintetiza clics y no dispara cuidados. Durante foco/descanso muestra mm:ss grande, progreso transcurrido y Terminar. Una pastilla por encima del lienzo del gato mantiene el tiempo visible sin hover.

El resumen usa las reuniones y sesiones que ya llegan por estado: próxima reunión desde cinco minutos después de su inicio, Unirse desde 15 minutos antes si tiene enlace; sesiones waiting con señal y actividad de menos de diez minutos. Sin información útil y sin foco muestra nombre y necesidad más baja o estado tranquilo. Cada cuadro actualiza el tiempo y la vigencia del resumen.

Escenas de captura: foco (sin hover), foco-hover y resumen-hover (Daily en 12 min y una sesión esperando). Son muestras en memoria con CENTRO_DATOS aislado; sólo capturePage de panel/franja. Los dos scripts verifican migración, ausencia de UI retirada, tarjeta, contador, botones, indicador, menu y arrastre. La revisión visual real queda para Windows; no se ejecutó Electron en el sandbox.

## Sexta tanda: panel, caricias, menú y foco

Esta sección reemplaza la presentación de «Cuidados y panel compacto»: se mantiene el acceso al Centro, panel horizontal al costado, redimensionado, autoalto, secciones ocultables, Esc/clic afuera y una columna a ≤800 px. El límite de contenido sigue en 450 px y el máximo de ventana en 540 px.

### Diseño

La guía diseno/frontend-design.SKILL.md se leyó completa. La decisión es un instrumento de escritorio con identidad pixel, no una habitación: azul tinta #202737, superficie #2b3448, elevación #354058, texto #f0f2fa, acento lavanda #c2b5f5 y ámbar semántico #efc36f. Sin transparencia en superficies del panel. tokens.css comparte colores, tipografía Segoe UI Variable local de Windows, radios de 6/12 px y espacios de 4/8/12/16 px entre ambas ventanas. No hay fuentes remotas.

El abanico reutiliza dibujos locales. Los cuidados respetan la espera; cuando main rechaza un cuidado, el gato dice el resultado durante 3 s. Cuando acepta, se muestra la animación y, si corresponde, la frase de comida favorita. No se muestran cambios numéricos.

### Mimos desde el menu

Se retiraron caricias.js y el detector por pasadas. Pasar el cursor s?lo muestra la tarjeta; Mimar se elige en el menu del clic derecho. El cuidado aceptado conserva ronroneo y coraz?n.

### Menú rápido

Contextmenu sobre el gato abre seis controles en abanico centrado sobre el gato, con Comer al azar, Mimar, Jugar al azar, Dormir, Foco y Ajustes; Foco abre 25 min / 50 min / Volver. Se ubica separado horizontalmente de los globos para no tapar alertas. Se cierra al elegir, por Escape, clic afuera o blur nativo. Sólo mientras está abierto, la ventana de franja es enfocable; al cerrar recupera focusable:false. El polling sigue limitando la captura del mouse al gato, globos o menú. Las flechas/Home/End recorren acciones disponibles. Los cuidados respetan la espera de main; durante foco sólo se ofrece terminarlo.

### Foco persistente

foco.js valida fases foco/descanso/listo y conserva desde/hasta/minutos en gatito.json versión 4, compatible con archivos anteriores. Las fechas son absolutas: no depende de ticks ni del renderer. observar avanza las fases y guarda los avisos consumidos; un reinicio durante foco o descanso conserva el vencimiento y recupera los avisos vencidos. Un foco nuevo acepta 25 o 50, con 25 como respaldo; cancelar limpia el bloque.

Durante foco se descuentan del decaimiento las horas superpuestas al bloque; no se observan iniciativas autónomas ni se aceptan cuidados. El renderer cancela viajes y pedidos pendientes y usa el grafo existente para acostarse, respirar y quedarse en el lugar. Los globos de reuniones/sesiones se procesan normalmente y no agregan animaciones que lo despierten. Reuniones sin enlace también se muestran, sin botón Unirse. El inicio de reunión no interrumpe el sueño de foco.

Al salir del foco se recorre despertar → estirar; fin-foco muestra un globo cerrable de 21 s para el descanso de 5 min. fin-descanso avisa con globo y ronroneo suave. Ambos avisos pasan aun si hay una reunión. La observación principal tiene una resolución de 5 s; los indicadores muestran segundos a partir de la fecha final. Arrastrar sigue siendo una interrupción física explícita.

### Verificación de la sexta tanda

Los dos scripts Node pasan con DOM simulado y reloj inyectado: clic/arrastre; menú/comidas/Esc/clic afuera; foco quieto y dormido con hambre baja, globos de reunión/sesión visibles, despertar y estiramiento; 25/50, cancelación, reinicios y avisos únicos; tokens, urgencia, relleno de espera y aspecto deshabilitado. Se conservan las verificaciones previas y los 127 hashes anteriores. No se generaron hojas ni se corrió el cortador.

Las escenas centro-datos, radial y foco sólo inyectan muestras visuales en memoria. VERIFICACION-TANDA6.txt y el scratchpad codex7/VERIFICACION.txt incluyen los comandos exactos con CENTRO_DATOS y perfil aislados. Sólo se usa capturePage de panel y franja. No se ejecutó Electron: quedan pendientes capturas, contraste visual real, DPI, foco/blur nativo y sonido de Windows.

## Revisión del gatito

Cancelar un id corta tanto la cola como la secuencia actual y conserva su pose final declarada para el siguiente camino. Rutina y pausa comparten el id del evento entre pedido y globo; el aviso aparece cuando la máquina toma ese pedido. Los pedidos sin ejecutar vencen a los dos minutos. Reunión o alerta cancela también los pedidos propios pendientes. Saludo y festejo tienen prioridad 3 y pueden despertar; despedida conserva prioridad 2.

El clic no inicia ALZAR ni despierta: abre el centro y maúlla. Si está en ocio sentado, acompaña con maullar1–2 sin cambiar la pose; dormido conserva su dibujo. El arrastre comienza al superar 4 px en cualquier dirección. Sesion celebra sentado con reposo y ronroneo. El aseo usa lamer1-3 durante 8-15 s, con espera aleatoria de 2-3 min. Los viajes mayores al 40% del ancho usan correr1–4 al doble de velocidad, con las mismas transiciones arrancar/frenar de caminando. El ciclo legado comer permanece en el grafo por compatibilidad; los cuidados de comida usan croquetas, pescado o leche.

Hambre camina un trecho y elige una variante por episodio: empujar1–4 si llega parado/caminando (parado → parado, 8,4 s), o panza1–2 si llega sentado/agazapado (sentado → sentado, 4,4 s). Conserva esa variante hasta comer o cancelar el episodio; recorre las transiciones del grafo antes del gesto. El cuenco externo se oculta mientras el cuadro empujar contiene su propio cuenco; el clic sobre el gato, incluido el cuenco dibujado en su lienzo, da de comer. En panza y las transiciones se conserva el cuenco externo clickeable. No hay globo de hambre. Los cuencos vacío/lleno son temporales. No se usan clases de salto o zarpazo: el festejo usa sprites.

Varias sesiones esperando se agrupan en un globo con su cantidad. El límite es de tres globos, priorizando reuniones individuales; todos vencen. Las actualizaciones de texto conservan botones y sus nodos. La pila tiene overflow visible y cada texto ocupa como máximo dos líneas con ellipsis; cada globo colapsa altura y margen al salir. El ancho medido determina el margen horizontal y la colita apunta al centro del gato. La tarjeta sube por encima de la pila y se oculta si no cabe en los 340 px. El menú reevalúa la espera de cuidados cada cuadro. Las reuniones redondean minutos hacia arriba y dicen ya empezó desde su inicio.

## Necesidades expresadas con comportamiento

No hay pestaña del gato ni indicadores o textos de necesidades. El hover muestra nombre y utilidad: foco, próxima reunión con Unirse y sesiones esperando.

Antes del primer dormir, la máquina llega por el grafo a sentado, ejecuta bostezo1–3 y uno o dos ciclos cabeceo (sentado, parpadeo1/parpadeo2 lentos, pausas largas), y recorre acostar1–2 hasta acostado. Las respiraciones posteriores no repiten el preámbulo. La energía baja y la iniciativa autonomia.sueno comparten este camino.

El hambre inicia una caminata corta; al llegar mira al cuenco vacío mientras pide. El cuenco permanece durante el pedido, captura el mouse y acepta clic, Enter o Espacio. Comer elige entre croquetas/pescado/leche con pesos 1/1/1 y una posibilidad adicional para la favorita. La animación aceptada reemplaza el pedido; un rechazo se dice durante 3 s.

La iniciativa de mimos viaja y entra por sentado → espaldas1 → espaldas2 en la pose espaldas. Alterna esos dos cuadros mirando sobre el hombro. El cuidado Mimar usa la arista inversa espaldas2 → espaldas1 → sentado antes de ronronear1–2. La iniciativa de juego va a rascar la pared (35%) o mira alrededor (mirar1/mirar2) desde sentado y encola el ovillo o el ratón; el grafo pasa por parado o agazapado según corresponda.

Los sprites cabecear1–3, empujar1–4 y panza1–2 están cargados como ciclos con extremos de pose explícitos. Antes de acostarse, cuando parte de parado o caminando, alterna cabecear de pie (4,5 s, parado → parado) con el bostezo sentado existente. Después recorre sentado → acostado. Si parte de sentado conserva bostezo y cabeceo sentado. Las respiraciones posteriores no repiten el gesto.

Sesiones: 8 s. Reuniones: 20 s al entrar en los cinco minutos previos y otros 20 s al inicio con id reu:<id>:inicio. El primer vencimiento se conserva en cada refresco y los ids vencidos o cerrados pasan a descartadas. El grupo de sesiones incluye ids y últimas actividades ordenados. Decir respeta su duración. Los tres globos miden hasta 58 px cada uno y caben sobre los 84 px del gato en la franja de 340 px, sin scroll.

Ajustes es una tarjeta junto al gato con nombre, seis colores y Pausas activas. Los cuidados y ajustes están en el clic derecho; durante foco el abanico ofrece solo Terminar foco. Flechas/Home/End recorren el abanico; Tab recorre los controles de la tarjeta y Escape cierra. Los iconos reutilizan sprites existentes.

Verificación de esta revisión: pruebas Node y DOM simulado. No se verificó la apariencia en Electron, DPI, sonido ni foco/blur nativo.

## Revisión liquid glass (octubre 2026)

Esta revisión reemplaza la dirección visual sólida y las columnas de la sexta tanda. Se leyeron frontend-design.SKILL.md y liquid-glass.md: tinte tinta #161a26 / #121620, texto #f0f2fa, lila #c2b5f5, ámbar #efc36f y menta #a5e5c8. Segoe UI Variable Text para contenido y Display para títulos y contador; escala 11/13/15/34. El gesto distintivo es el abanico de vidrio alrededor del pixel art; el panel mantiene alineación izquierda y orden vertical Ahora → reuniones → tickets → sesiones. No se agregan adornos ni datos de cuidados al panel.

Globos con punto semántico, dos líneas como máximo, cierre al hover o foco y línea de tiempo calculada con desde/hasta originales en cada cuadro: refrescar el texto no reinicia ni el vencimiento ni la barra. El menú tiene círculos de 48 px, etiquetas en pastilla y escalón de 20 ms; respeta movimiento reducido. Ajustes contiene nombre subrayado, seis pelajes e interruptor de pausas. La tarjeta del hover resume foco y hasta dos filas útiles.

Ahora presenta reuniones a ≤15 minutos y sesiones esperando, sin cambiar el umbral de las alertas de negocio (5 minutos). Sin urgencias queda Todo en orden y se oculta la franja. La agenda usa una línea de tiempo con próxima/actual resaltada; tickets se agrupan por estado con conteos y filtros segmentados; sesiones conservan actividad, carpeta y antigüedad. Probar alerta vive en el menú de puntos. Se conservan IPC, manijas, cierre, secciones ocultables y posicionamiento del panel.

Panel Windows: se prueba backgroundMaterial acrylic con transparent:false; el vidrio CSS es el respaldo. Otros sistemas mantienen ventana transparente y material none. No se pudo confirmar material nativo: Electron aborta por las ACL de su instalación antes de crear BrowserWindow, incluso con sandbox deshabilitado. El script capturar-diseno.cjs queda preparado para panel y mascota, claro/oscuro, foco, menú, hover y ajustes. No hay capturas válidas ni se afirma validación visual. Ver diseno/capturas/LEEME.md.

Panza se recortó exclusivamente con validar-hojas.cjs estados --sobrescribir y selección panza1/panza2 en arte/estados.json; cada uno iguala la altura alfa de sentado (194 px). Los 140 hashes se comparan en diseno/verificacion-hashes.json: 138 intactos, sólo dos panza modificados. Contraste calculado con composición alfa y máximo reflejo: mínimo 4,79:1, tabla en diseno/contraste.md.


Cruce entre pantallas: los vecinos laterales tocan sus bounds en DIP (tolerancia 2 px) y comparten altura; las pantallas apiladas o separadas no conectan. Pasear elige cruzar con probabilidad 0,35 en un borde conectado; en los dem?s rasca. Puede seguir al cursor tras 20 s en un vecino, como m?ximo una vez cada diez minutos. Reuni?n/alerta, trabajo, foco, sueno, centro abierto, globos, arrastre y caida bloquean el cruce.

Camina al borde, recorre las transiciones hasta agazapado y sostiene agachar3 antes del IPC. El vuelo dura 650 ms: salto1/2/3 seg?n subida/?pice/bajada y aterrizar1/2 hasta sentado. El ?pice esta 90 DIP sobre el piso m?s alto y aterriza 75 DIP dentro del workArea vecino; admite pisos y escalas diferentes. Main mueve la franja cada 16 ms, ignora clics y persiste el monitor al aterrizar. Cambiar pantallas cancela el vuelo con caida f?sica; cerrar la mascota limpia el reloj. Las alertas recibidas en vuelo se conservan y empiezan su duraci?n al aterrizar.


## Freno de oscilaciones y registro

Todo pedido de girar se adapta a la pose al ejecutarse: parado/caminando conserva girar1–3; sentado usa parpadeo1 (180 ms), invierte la dirección y termina con cola-nueva (420 ms), sin aristas de pose. Las otras poses conservan cuadros propios durante los mismos 600 ms y cambian la orientación a los 180 ms. Abrir el panel usa este mismo camino.

Al terminar rascar, caja, cabecear o empujar, si no hay pedidos, conserva parado durante un bloque de 30–90 s con el cuadro existente. Luego se sienta una sola vez y los ocios posteriores permanecen sentados. No genera pedidos para volver a levantarse.

El reposo del freno usa cuadros de la pose declarada: parado usa ocio-parado; caminando recorre primero la arista caminando → parado (frenar1–3) y luego ocio-parado. Agazapado sostiene agachar3; espaldas alterna espaldas1/espaldas2 lentamente; acostado usa dormir y respiraciones. Sentado usa ocio; volando, cayendo y suspendido conservan salto1, caer1 y alzar2 respectivamente. No hay ciclos sentados con extremos de otra pose. La prueba recorre todas las poses, activa el freno tras tres cambios y valida cada cuadro contra un mapa de poses construido con los extremos del grafo y los ciclos declarados; también comprueba las aristas de transición, los giros y el reposo parado.

La máquina cuenta las aristas sentado ↔ parado en una ventana de 30 s. Tras tres cambios, un pedido de prioridad menor que 3 que necesita otra arista de ese tipo se difiere 20 s y se reproduce reposo en la pose actual con motivo freno-anti-oscilacion. La espera activa no se prolonga por cada ciclo de reposo. Los pedidos de prioridad ≥3 y los viajes caminar/correr/cruzar (incluida preparar-salto) quedan exceptuados. Los pedidos diferidos conservan orden e id y pueden cancelarse.

El renderer conserva las últimas 200 secuencias en un buffer circular, incluidas las de foco. Cada entrada contiene t (fecha en ms), estado, variante, id técnico depurado, prioridad, poseInicial, poseFinal y motivo. Envía las entradas nuevas cada 30 s y de inmediato cuando actúa el freno. No incluye nombres, rutas, sesiones ni textos de alertas. preload expone registrarGatito; el handler gatito-registro acepta únicamente mascota.webContents, lotes de hasta 200 y los campos técnicos esperados, descarta campos adicionales y escribe ~/.claude/centro/gatito-registro.jsonl, limitado a las últimas 2000 líneas.

Las regresiones cubren hambre estable y fin de episodio al comer, giro sentado sin parado, reposo de 30–90 s y una única sentada tras rascar, hasta tres cambios en 30 s con pedidos alternados de prioridad 2 y entradas del registro con sus campos. El DOM simulado permite la demora del freno al encadenar escenas de borde. Pruebas desde ventana/: node --preserve-symlinks --preserve-symlinks-main scripts/probar-gatito.cjs y node --preserve-symlinks --preserve-symlinks-main scripts/verificar-interfaz.cjs (flags necesarios por EPERM). Ambas pasan. No se ejecutó Electron ni validar-hojas.cjs y no se modificaron PNGs.

## Revision de pose y cursor

El PNG historico sentado.png esta dibujado en cuatro patas: alternarlo con parpadeo1/2 producia el falso ciclo de pararse y sentarse. Todos los cuadros de reposo, menu y extremos de transicion usan ahora sentado-quieto.png. No se modifico ningun PNG anterior.

Nuevo sprite: src/ui/sprites/sentado-quieto.png, generado con imagegen integrado desde parpadeo1.png, ojos abiertos amarillos, sentado hacia la derecha, cola detras y transparencia. Fuente y prompt: arte/gatito-hoja-sentado-quieto.png y .prompt.txt; receta arte/sentado-quieto.json. Se corto con node scripts/validar-hojas.cjs sentado-quieto, sin sobrescribir, escala de parpadeo1, lienzo 288 x 237 y base compartida. Comparacion visual con parpadeos y cola-nueva: pose sentada, escala y apoyo compatibles.

La auditoria visual de cada cuadro del grafo queda en arte/auditoria-poses.png (orden de ciclos y luego transiciones, ocho columnas). Se corrigieron alerta/listo/contento parados en ciclos sentados mediante reposo/ronroneo; sesion celebra sentado en vez de saltar sin aristas. Estirar declara parado. Croquetas4, leche3/4 y raton4 se sientan: sus ciclos agazapados conservan los cuadros agazapados. Mirar1/2 estan sentados. Las transiciones conservan sus poses intermedias intencionales.

En ocio sentado, cada 20-60 s aleatorios puede mirar al cursor si se movio en los ultimos 5 s y esta en la pantalla actual. Usa mirar1/2 durante 2160 ms; cambia direccion hacia el cursor y vuelve al ocio. No actua en sueno, foco, trabajo, panel, viaje, arrastre, caida o vuelo, ni ante pedidos pendientes. La posicion se consulta con el IPC existente; los limites verticales usan Screen del renderer, incluidos monitores apilados.

Globos: sesion 8 s, reunion 20 s, rutinas de 30 s a 21 s, mensajes de 5 s a 4 s y valor predeterminado de 6 s a 4,2 s. Minimo de 4 s. Se retiraron markup, actualizacion y CSS de globo-tiempo. Las pruebas verifican vencimiento y refresco sin prolongar el plazo.

Validacion de esta revision: probar-gatito.cjs y verificar-interfaz.cjs pasan con --preserve-symlinks --preserve-symlinks-main por EPERM; verificar-interfaz ejecuta tambien verificar-panel.cjs, que pasa. Conservados los 127 hashes de sprites anteriores. No se ejecuto Electron.

## Ritmo tranquilo del reposo

La máquina genera cada bloque al entrar: ocio y panel duran 30–90 s aleatorios, con sentado-quieto como base, un parpadeo parpadeo1 → parpadeo2 → parpadeo1 de 350 ms cada 4–8 s de quietud y cola-nueva durante 800 ms cada 15–30 s. Estos gestos son cuadros internos, no pedidos ni secuencias nuevas. Pensar dura 20–60 s, alternando pensar1–8 lentamente. Los catálogos estáticos sirven para precargar sprites; las duraciones autónomas se generan de nuevo en cada bloque.

El aseo autónomo empieza cuando vence una espera de 120–180 s, en el siguiente límite de bloque libre: nunca con menos de dos minutos entre inicios. Repite lamer1–3 durante 8–15 s y completa en quietud un bloque total de 30–90 s. El registro conserva estado lamer y motivo aseo-y-reposo para ese bloque; el resto conserva ocio o reposo-parado. Esto permite un gesto breve sin volver a encadenar secuencias de menos de 20 s.

Los pedidos de prioridad ≥2 interrumpen el reposo en el próximo paso, conservando las transiciones de entrada que todavía no terminaron. Los de prioridad menor esperan. Cambiar entre trabajo, panel y ocio espera al menos 20 s desde el inicio del bloque; entrar en foco es una interrupción explícita. La iniciativa por energía baja espera esos 20 s y luego puede iniciar el viaje al borde. Los viajes ya pedidos interrumpen el reposo sin esperar 90 s. El sueño mínimo sube a 15 minutos; conserva sus excepciones por eventos reales.

La mirada al cursor se superpone durante 2160 ms al bloque sentado, incluso en la quietud posterior al aseo, sin reiniciar ni extender su plazo. Conserva los bloqueos por sueño, foco, trabajo, panel, viaje, arrastre y caída. El registro anota mirar-cursor con motivo mirada-en-reposo; no registra cada parpadeo ni cada movimiento de cola como una secuencia. Una alerta o cuidado cancela la superposición.

Pruebas de esta ampliación: diez minutos sin eventos generan 20, 10 y 7 secuencias con azar controlado en ambos extremos y el punto medio. Se verifican duración mínima de bloques, variación de duración, aseo de 8–15 s separado ≥120 s, interrupción por prioridad 2, espera de prioridad 1, sueño mínimo de 15 minutos y mirada que conserva identidad y vencimiento del bloque. Ambos scripts pasan; verificar-interfaz también ejecuta y aprueba verificar-panel. Se mantienen los 127 hashes anteriores. No se ejecutó Electron.

## Revisión de vida (octubre 2026)

Surgió de leer el registro real (`gatito-registro.jsonl`) y `gatito.json`: el gato llevaba 31 h sin comer, casi no expresaba necesidades y en una siesta con Claude trabajando rearmaba el reposo en cada cuadro.

| Tema | Antes | Ahora |
| --- | --- | --- |
| Siesta con Claude trabajando | El reposo se rearmaba en cada cuadro (cientos de secuencias por segundo, clavado en pensar1) | Sólo corta el reposo si de verdad puede dormirse |
| Energía | Con una alerta se le pasaba 80 y se despertaba a los 15 min aunque estuviera cansado | Se pasa la energía real y `ocupado` impide sólo empezar a dormir |
| Alerta de sesión | Callaba las necesidades 10 min después de cada turno de Claude (casi siempre) | Las calla 90 s (`ALERTA_FRESCA_MS` en main) |
| Llegada de un viaje | Seguía caminando en el lugar hasta terminar el ciclo | Corta el ciclo y frena al llegar |
| Cambio de sentido | Espejo instantáneo al caminar, al mirar el cursor y al llegar | Se da vuelta con girar (o el giro sentado) antes |
| Cuenco | Cuenco rojo fijo a la derecha, encima del cuenco dibujado | Queda en el piso adelante del gato mientras tenga hambre, a escala del gato; se oculta en los dibujos que traen su cuenco |
| Aburrido | Podía rascar el aire en medio de la pantalla | Juega en el lugar (ovillo o ratón); rascar sólo junto a la pared |
| Giro al panel | Prioridad 1: hasta 20 s tarde y quedaba pendiente al cerrar | Prioridad 2 y se cancela al cerrar |
| Mimar desde el menú | `cancelar(undefined)` vaciaba los pedidos sin id (y podía tirar TypeError) | `cancelar` sin id no hace nada |
| Cruce de pantalla | `armarEstado` consumía eventos de la rutina y se perdían | Usa `contextoDelGatito` sin observar la vida |
| Cuadro nuevo | El gato desaparecía mientras se recoloreaba un dibujo por primera vez | Queda el cuadro anterior hasta que carga |
| sentado-quieto | Ojo cercano deforme, sin nariz | Ojos y nariz copiados de cola-nueva, alineados a la cabeza |

Animaciones nuevas con dibujos que ya existían: reunión con atento → alerta (!); sesión que espera con atento; sesión terminada con salto y tilde (listo); duda (?) al rechazar un cuidado; tablet alternada con pensar mientras Claude trabaja (corrida 20 px de lienzo al mostrarse); respiración al dormir; ovillo3 en el juego; contento al final de mimar; satisfecho (se lava la cara) después de comer; estirarse en la pausa; agazapado moviendo la cola antes de saltar; zarpazo (pata1–2) si el cursor pasa muy cerca.

El ánimo agrega un gesto al reposo sentado cada 20–40 s: con hambre maúlla, cansado (energía < 35) cabecea con sueno, contento (cariño ≥ 70 y saciedad ≥ 50) cierra los ojos. Desde el segundo pedido de comida maúlla bajito con sonido. Con hambre el botón Comer del abanico late.

Verificación: `npm test` con pruebas nuevas para cada punto; capturas reales en Electron con `CENTRO_GUION` (JS en la mascota) y `CENTRO_ESPERA`; dos minutos de la app aislada con el registro sin ráfagas.
