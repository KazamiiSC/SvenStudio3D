# Cinematic Camera Studio — SvenStudio 3D v1.0.1 Preview 1

## Alcance de esta actualización

Esta es una actualización **experimental** construida sobre 1.0.0 Stable. La herramienta aparece en **Studios → Cinematic Camera Studio**. Mantiene el formato `.svenstudio.json`, el formato MAP Valve 220 y los compiladores actuales.

Implementado: `trigger_camera` + `info_target`; rutas `path_corner` en 3D; cámara fija o móvil; objetivo fijo; propiedades `wait`, `speed`, `spawnflags`; conexión opcional a un trigger o botón sin sobrescribir conexiones existentes; vista previa simplificada; selección y edición con los gizmos existentes; undo/redo; validación de referencias de la escena.

**No implementado en esta primera etapa:** línea de tiempo de eventos, cámaras encadenadas, audio sincronizado, NPC scripted_sequence, curvas Bézier exactas, ejecución real del motor en la previsualización ni gestión integral de campañas.

## Crear una cámara

1. Abrí el mapa y, opcionalmente, seleccioná un brush o entidad cercana a la zona de la escena.
2. Abrí **Studios → Cinematic Camera Studio → Crear escena nueva**. Elegí nombre, duración, posición y punto al que debe mirar.
3. Elegí si querés una cámara móvil, si debe inmovilizar al jugador, afectar a todos los jugadores y protegerlos del daño durante la escena.
4. Opcionalmente, elegí un `trigger_once`, `trigger_multiple`, `trigger_auto`, `trigger_relay` o `func_button` **ya creado y sin una conexión `target` previa**.
5. Pulsá **Crear cámara**. Si no elegiste activador, conectá uno en Gameplay Studio. La cámara no se inicia por sí sola.
6. Para moverla, abrí la escena y pulsá **Añadir punto en 3D**: hacé clic en las superficies del mapa para definir puntos de la ruta; **Esc** finaliza la colocación.
7. Seleccioná cualquier punto en la lista para cerrar la ventana y ajustarlo con los gizmos habituales (G/R/C). También podés mover el `info_target` para cambiar hacia dónde mira la cámara.
8. Volvé a abrir la escena para ver la vista previa; guardá el `.svenstudio.json`, compilá el `.map` y probá la escena en Sven Co-op.

## Cómo se exporta al juego

- `trigger_camera.targetname` es el nombre que activa el trigger o botón.
- `trigger_camera.target` apunta a `info_target.targetname`: **define hacia dónde mira la cámara**, no el activador.
- `trigger_camera.moveto` apunta al primer `path_corner`.
- Los puntos `path_corner` se conectan mediante `target` al `targetname` del siguiente punto. El último no tiene `target`.
- `wait`: duración de la toma. `speed`: velocidad inicial de movimiento. `spawnflags`: solo flags de Sven Co-op documentados; los flags desconocidos se preservan al editar opciones.
- Si un trigger existente ya tiene `target`, el asistente **rechaza** sobrescribir esa conexión, en lugar de alterar la lógica del mapa.
- Todos los elementos son entidades oficiales; no se añaden clases desconocidas ni scripts al juego.

## Limitaciones importantes (Svengine / GoldSrc)

- La vista previa 3D es **aproximada**: cámara y geometría simples, sin iluminación SC-RAD final ni materiales exactos. El motor del juego aplica su propia aceleración, interpolación, orientación, suavizado y tiempos.
- La velocidad de la vista previa se aproxima por distancia recorrida/velocidad inicial. No reproduce la aceleración o desaceleración real de `trigger_camera`.
- No se interpolan rotaciones autónomas entre puntos de ruta; para orientar la vista se usa `info_target` (objetivo fijo). Para seguir objetos dinámicos, configurá la entidad con cuidado y probala en el juego.
- La opción «Todos los jugadores» de `trigger_camera` usa spawnflag 8; no equivale a una línea de tiempo cooperativa sincronizada.
- Los puntos `path_corner` sirven para cámaras/trenes; no deben confundirse con `path_waypoint` de NPC Studio.
- En vistas previas de mapas grandes se muestran como máximo 250 brushes por rendimiento; el MAP exportado siempre conserva todos los brushes.
- La prueba de TypeScript y de entidades MAP **no** demuestra que la cámara se haya ejecutado correctamente en Sven Co-op. La validación en Windows con el juego sigue pendiente.

## Prueba recomendada en Sven Co-op

1. Creá un mapa pequeño con `info_player_start`, una habitación cerrada y un `trigger_once` delante de la salida.
2. En Cinematic Camera Studio, creá una cámara que mire a un `info_target` ubicado dentro de la habitación.
3. Asigná ese `trigger_once` como activador. Verificá que su brush esté correctamente asociado a la entidad.
4. Agregá dos puntos de ruta con el mouse. Configurá `wait=10`, `speed=180`, Freeze Player y Player Invulnerable.
5. Compilá con SC-CSG, SC-BSP, SC-VIS y SC-RAD; iniciá el mapa en Sven Co-op.
6. Verificá que la escena se activa, que la cámara avanza, que la orientación es correcta y que el control del jugador regresa al finalizar. Repetí la prueba con dos jugadores si activaste «Todos los jugadores».
7. Si hay diferencias, revisá la duración y los nombres `target`, `targetname`, `moveto` en el `.map`. No asumas que la simulación del editor coincide exactamente con el juego.

## Seguridad y continuidad

El archivo `SvenStudio3D_v1.0.0_Stable.rar` original permanece sin tocar. Conservar una copia de la versión anterior y de tus mapas antes de instalar la preview. Los scripts de verificación histórica 1.0.0 son específicos de esa release; el test nuevo `node scripts/check-cinematic.mjs` verifica las nuevas rutas y el exportador.

Referencias: [trigger_camera](https://wiki.svencoop.com/Trigger_camera), [path_corner](https://wiki.svencoop.com/Path_corner), [FGD Sven Co-op](https://wiki.svencoop.com/Mapping/Sven_Co-op_FGD).

## Ejemplo incluido

En `examples/cinematic_intro_demo.svenstudio.json` hay una cámara introductoria con tres `path_corner` (inicio y dos puntos adicionales), `info_target` y `trigger_auto` configurado como activador. El mismo ejemplo está exportado como `examples/cinematic_intro_demo.map`. El ejemplo sirve para inspeccionar la estructura; si necesita recursos WAD, indicá tus rutas locales antes de compilar.


## Vista previa corregida en Preview 2

- **Vista de cámara:** renderiza las superficies con las texturas cargadas en la sesión (WAD o starter), usando una luz de inspección. La iluminación final SC-RAD no se replica.
- **Inspeccionar escena:** órbita libre con mouse, zoom y desplazamiento; muestra la cámara, objetivo y ruta mediante marcadores. No modifica el proyecto ni las entidades.
- **Aviso de cámara dentro de brush:** si la posición de la cámara está dentro de un sólido, se advierte en el panel. Ajustar la posición con el gizmo en el visor principal. Es una verificación aproximada de geometría convexa.
- **Movimiento:** pulsar Reproducir o desplazar el control deslizante; la posición inicial (0 segundos) solo muestra el inicio de la ruta.

La vista previa **no** simula colisiones, la IA, lightmaps finales ni aceleración real de `trigger_camera`; se debe probar el mapa compilado en Sven Co-op.

## Preview 3 — Modos de visualización y controles compatibles

Desde Preview 3, la vista cinematográfica puede usar **Wireframe**, **Solid**, **Material Preview** o **Rendered**, sin modificar los materiales ni el MAP original. Rendered reutiliza `previewLocalLight`, `previewSunLight`, `previewDirection`, `previewCone` y la lectura `_light` de SvenStudio 3D; no calcula lightmaps definitivos ni oclusión SC-RAD. Puede mostrar como máximo 24 luces para mantener fluidez. En mapas grandes sigue existiendo el límite de 250 brushes renderizados en la vista previa; la exportación del mapa no está limitada.

En **Opciones nativas avanzadas**, guardar actualiza únicamente propiedades de `trigger_camera`: `acceleration`, `deceleration`, `turnspeed`, flags conocidos (`startAtPlayer`, `followPlayer`, `forceView`, flag 32, `instantMove`) y `hud_health`, `hud_flashlight`, `hud_weapons` con 0 = mostrar y 1 = ocultar. También conserva propiedades y flags personalizados. Algunas de estas opciones tienen comportamiento específico o limitado en Svengine: consultar [trigger_camera](https://wiki.svencoop.com/Trigger_camera).

### Velocidad por tramo: una limitación esencial

El panel por tramos muestra longitud, tiempo estimado y permite personalizar una **velocidad solo para la simulación visual**. Los valores se guardan en la propiedad opcional `cinematicPreviewSpeeds` dentro del archivo `.svenstudio.json`, asociados a IDs internos de los `path_corner`. **NUNCA se escriben en los keyvalues del MAP**, ni cambian velocidad real en el juego. La especificación FGD define `path_corner.speed` como *New Train Speed*: no debe presentarse como ajuste de velocidad garantizado para `trigger_camera`. Para modificar el movimiento real se usan `trigger_camera.speed`, `acceleration` y los flags correspondientes, comprobados en el BSP de Sven Co-op.

- Se puede seleccionar un punto para moverlo con los gizmos existentes, hacer clic en su botón Play para saltar a ese tramo de simulación y eliminar de forma segura el último punto (con protección de conexiones externas).
- La vista ampliada puede abrirse y cerrarse sin cambiar el editor principal. Escape primero cierra la vista ampliada, luego cierra el Studio.
- Camera Path Doctor añade advertencias aproximadas de intersección con brushes sólidos, objetivo cercano y duración estimada superior a `wait`. No reproduce colisiones de GoldSrc ni reemplaza Map Doctor.
- Las propiedades de previsualización sobreviven a guardar/reabrir el `.svenstudio.json` de la nueva versión. Un archivo `.map` solo contiene entidades y geometría nativas: reimportarlo no puede restaurar esos ajustes solo de previsualización.

**Validación:** TypeScript y 58 comprobaciones aplicables en Linux (excluidas las verificaciones exclusivas de 1.0.0 Stable/RC1/Release) y los tests cinematográficos. No se ha ejecutado un navegador en Windows ni probado el BSP en Sven Co-op durante esta entrega. El build Vite en Linux requiere las dependencias opcionales binarias de Linux que no forman parte del paquete Windows.
