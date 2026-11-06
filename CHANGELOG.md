## v1.4.0 HF11 — Guías legibles y dirección nativa de func_door

- Gameplay Studio: el inspector conserva un resumen de la mini guía y ofrece «Abrir guía ampliada» en una ventana central de hasta 780 px, con desplazamiento único y accesibilidad básica. Esc cierra la guía, no el estudio.
- Propiedades: también ofrece guía ampliada. Se incorpora la elección de modo **Básico / Avanzado**. El modo Básico presenta los ajustes más frecuentes; Avanzado conserva todos los keyvalues FGD y los campos personalizados.
- func_door: los botones «Subir» y «Bajar» dejan de escribir `angle` y configuran el keyvalue de movimiento correcto `angles`: `0 -1 0` o `0 -2 0`. Cambiar la dirección elimina el alias anterior en una sola operación deshacible. El cambio es visible en la propia interfaz con un estado y su valor nativo.
- Se preservan velocidad, wait, lip, sonidos, targetname, referencias, brushes y texturas al cambiar dirección. El editor de movimiento es el mismo en Gameplay Studio y Propiedades.
- Proyectos antiguos con `angle` y `angles` contradictorios muestran advertencia y pueden normalizarse al elegir una dirección. Los datos antiguos no se migran silenciosamente al abrirlos.
- Gameplay Test interpreta la misma dirección que el editor; los ejemplos nuevos de puertas usan `angles` directamente.
- No se modifica el exportador Valve 220, el BSP Viewer ni los compiladores de Sven Co-op.

## v1.4.0 HF10 — Ver y seleccionar entidades detrás de brushes

- Nueva opción en Apariencia de entidades: **Entidades detrás de brushes** (rayos X / profundidad normal). El modo de rayos X muestra marcadores semitransparentes incluso si quedan dentro de una pared.
- Al hacer clic en un marcador detrás de un brush, el Editor MAP da prioridad a la entidad; no elimina ni mueve el brush. Se admite Alt + clic incluso en modo normal.
- También se pueden seleccionar los indicadores de entidades asociadas a brushes, conservando las interacciones existentes en Caras, UV, Medir, Formas y gizmos.
- Configuración persistente solo del editor, seis idiomas, sin alterar MAP, BSP, compiladores ni datos de entidades.

## v1.4.0 HF9 — Interfaz oscura, posición del jugador y menú Estudios

- Normalizados los botones que no tenían estilo propio: color, fondo, borde y estados deshabilitados (Map Doctor, panel de Propiedades y controles nativos). Se evita que se muestren rectángulos blancos sobre el tema oscuro.
- Map Doctor: botón de cerrar oscuro y accesible; estados inactivos coherentes. Botones para desvincular entidades del brush: fondo oscuro aun cuando la operación esté deshabilitada.
- Menús select de la aplicación: fondo oscuro como respaldo para opciones nativas en Chrome.
- Vista previa de info_player_start: la altura se calcula a partir de las mallas y bodygroups realmente mostrados y de una muestra de la secuencia idle animada; los pies se alinean con el suelo en vez de hundirse al cambiar de pose. Solo se modifica la previsualización del editor; el origen real de la entidad y el MAP no cambian.
- En el menú superior, el rótulo en español cambia de «Herramientas» a «Estudios»; se conservan los demás idiomas.
- La geometría, UV, Valve 220, BSP Viewer, backend y compiladores son idénticos a HF8.

## v1.4.0 HF8 — Formas de entidades y nombres de brushes

- Marcadores automáticos por classname, con alternativa global configurable y control de colores por categoría o uniforme.
- Distintivos discretos para brushes de `func_door`/`func_button` sin reemplazar su geometría.
- Menú contextual «Cambiar nombre en el editor…» para brushes y entidades puntuales; edición en Propiedades y deshacer.
- Explorador de brushes y entidades filtrable por nombre personalizado; nombres visibles en el visor y Gameplay Studio.
- Búsqueda por nombre de entidad, nombre de brush vinculado, `classname` y `targetname` para crear conexiones; se conserva la asociación real `target`/`targetname`.
- Se conservan los módulos y exportador Valve 220 de HF7.

## SvenStudio 3D v1.4.0 HF7 — Apariencia de entidades y punto de inicio

- Marcadores de entidades más pequeños; control de tamaño (25–250 %) y formas: caja, burbuja/esfera, cápsula, diamante y cono. Se migran preferencias antiguas de tamaño. Ajustes solo del editor; las entidades no se alteran.
- Propiedades: etiquetas FGD con más espacio y ajuste de línea para leer nombres largos; inputs más compactos.
- Help/Ayuda: sección con las funciones de v1.4 recientes, incluyendo Entity Assistant, desvinculación a worldspawn, Smart Placement y nuevos controles. Se conservan los seis idiomas.
- Créditos: la imagen de GPT-6 Astra ahora tiene transparencia real fuera de letras y planeta. KZ-Sheez permanece sin modificar.
- info_player_start: marcador en el piso con flecha de orientación; vista previa de jugador con pies alineados al piso, idle si el MDL lo admite y figura sencilla de respaldo si no carga; selector de giro horizontal en Propiedades (`angles`). No se modifica la ubicación real de aparición.
- Sin modificaciones en los compiladores, backend, exportador Valve 220, geometría, MAP recovery, BSP Viewer o texturas WAD.

## v1.4.0 HF6 — Entity Assistant / Mini guías (2026-11-06)
- Guías contextuales con uso, pasos, ejemplos y capacidades verificadas mediante FGD para las entidades de Sven Co-op.
- Accesos desde Biblioteca de recursos, Propiedades de entidades y brushes vinculados, e inspector de Gameplay Studio.
- Controles nativos para enlaces target→targetname (una sola operación de Undo), dirección de puerta, sonido de botón/puerta, WAV con vista previa y opciones `choices` cuando el FGD está cargado.
- Validación contextual de referencias faltantes y aviso para puertas que suben verticalmente.
- No se modificaron entidades ni recursos de proyectos existentes, Valve 220, compiladores ni BSP Viewer.

## v1.4.0 HF3 — Smart Placement 3D (6 noviembre 2026)
- Formas y Prefabs: orientación previa mediante R (90°), Shift+R (15°), X/Y/Z (eje), F (alineación a superficie), 0 (restablecer) y P (repetir).
- En superficies horizontales, la orientación inicial sigue la dirección cardinal de la cámara; en paredes, la normal de la cara.
- La vista previa y la colocación comparten la misma transformación de objetos; las entidades asociadas a prefabs conservan sus relaciones e IDs remapeados.
- Dibujar: planos XY, XZ y YZ seleccionables con Z/Y/X; F permite usar una superficie bajo el cursor como plano de dibujo. Extrusión en el sentido de la normal.
- Modo inmersivo opcional: pantalla completa y solicitud de Keyboard Lock donde el navegador lo admita. No modifica atajos globales de Windows ni garantiza bloquear atajos reservados por Chrome.
- Los compiladores y el serializador Valve 220 permanecen sin modificaciones.

## v1.4.0 HF2 — Atajo Ctrl+D retirado

- Ctrl+D (y Cmd+D) dejan de duplicar brushes y entidades; se devuelve la combinación al navegador.
- Duplicar desde la barra de herramientas, Propiedades y el menú contextual sigue disponible.
- Se elimina la indicación obsoleta «Ctrl+D» del menú contextual.
- Sin cambios en UV, cámara, geometría, exportación MAP ni compiladores.

## v1.4.0 HF1 — Orientación WAD en el Editor MAP

- Corrige la inversión vertical de texturas al convertir la coordenada V de GoldSrc a Three.js.
- Vista previa consistente con la orientación Valve 220: no se altera MAP exportado ni WAD.
- Pruebas de regresión para texturas asimétricas, V negativa, offsets y funciones anteriores.
- Las caras ajustadas con la vista previa antigua se pueden reorientar manualmente con Texture Studio → Invertir V.

## v1.4.0 — Cámara estilo Roblox Studio y proyección UV GoldSrc (6 noviembre 2026)

- Cámara del Editor MAP: mantener **botón derecho** para girar horizontal y verticalmente alrededor de la posición de la cámara; **WASD** para moverse, **Q / E** para bajar / subir. Se elimina la activación de cámara con Ctrl y el botón Capturar cámara. El cursor se libera al soltar botón derecho y se captura mediante Pointer Lock cuando Chrome lo permite. **Esc** también libera captura.
- Mantener un clic derecho breve conserva el menú contextual de brushes, incluidos los ocultos; mantener/arrastrar inicia navegación.
- Etiqueta superior, pie y versión de paquete: **v1.4.0**.
- Vista previa UV corregida: GoldSrc/Valve 220 aplica escala a la proyección del eje y luego suma `uShift`/`vShift` expresados en texeles. Antes el visor dividía también el desplazamiento por la escala y mostraba una posición distinta de la compilada.
- Texture Lock al trasladar o rotar brushes compensa los desplazamientos en texeles; Smart Fit, Smart Align, centrar e invertir están ajustados a la misma convención. Las caras con ejes ilegales conservan la compensación en la reparación segura para SC-RAD.
- No se cambiaron la estructura del mapa, los brushes, los compiladores, el backend ni el visor BSP. La diferencia visual entre editor y motor por otro motivo (WAD distinto, brush de entidad móvil, escalado adicional de BSP, iluminación) requiere una prueba de MAP/BSP real.
- Ver `LEER_V14_CAMARA_UV_ES.md` y `VERIFICACION_V14_CAMARA_UV_ES.md`.

## v1.4.0 Preview 2 HF5 — Captura de cámara y actualización de Ayuda (6 noviembre 2026)

- Ctrl desde el visor inicia captura real del mouse (Pointer Lock), con botón alternativo por clic.
- Soltar Ctrl permite mirar y moverse con WASD sin necesidad de mantener la combinación; Esc libera el cursor.
- Q/E siguen bajando/subiendo. Modos Fly, Gameplay Test y transformaciones conservan controles propios.
- Se evitaron combinaciones Ctrl+WASD en el movimiento del editor (protección de mejor esfuerzo; atajos de Chrome no se pueden garantizar).
- «Controles de cámara y gizmo» muestra un resumen de navegación, atajos actuales, gizmos y precauciones.
- «Ayuda» reemplaza secciones antiguas por un resumen actualizado y un catálogo de funciones actuales en los seis idiomas.
- Ventana de ayuda más ancha, con secciones organizadas y desplazamiento.
- Sin cambios en geometría, texturas, UV, exportación MAP, SDK, BSP Viewer ni datos del proyecto.

## v1.4.0 Preview 2 HF4 — UV seguro para SC-RAD (6 noviembre 2026)
- Reparación no destructiva de ejes UV casi perpendiculares a las caras en la vista previa y la exportación Valve 220.
- Resuelve la causa de las advertencias de SC-CSG `Malformed texture alignment` y el error de SC-RAD `Malformed face normal` del brush `func_button` con `+0BUTTON3` (según el registro del usuario).
- La reparación respeta los ejes válidos y compensa el desplazamiento UV en el vértice de referencia; ningún vértice, entidad ni brush del proyecto se modifica.
- Map Doctor informa `TEXTURE_AXIS_REPAIRED` para localizar qué brushes requieren normalización al exportar.
- 115 pruebas automatizadas aprobadas, 3 pruebas BSP bloqueadas por ausencia de `three`. Test nuevo de dos caras basado en las coordenadas del fallo. Build y prueba SC-RAD en Windows pendientes.
- No se modificó el backend, BSP Viewer, los compiladores, Q/E, las WAD persistentes ni el sistema de Prefabs.

## v1.4.0 Preview 2 HF3 — Cámara, WAD persistentes y texturas (6 noviembre 2026)
- Ctrl + movimiento del mouse sin botones: mirar alrededor desde la posición actual; Q/E vuelven a bajar/subir en Editor MAP.
- Persistencia de WAD externos importados en IndexedDB y restauración al iniciar desde el mismo navegador/origen; advertencias ante errores de almacenamiento.
- Clic derecho contextual sobre brushes fantasma: desocultar solo el brush apuntado.
- Previsualización de texturas y dimensiones ordenadas por prioridad de WAD para compilación; salida de advertencias sobre colisiones o WAD importadas no configuradas.
- Sin cambios al exportador Valve 220, BSP Viewer ni compiladores; UV del MAP y datos de entidades intactos.

## v1.4.0 Preview 2 HF2 — Formas / Prefabs: bloqueo del viewport (6 noviembre 2026)

- Corregido `textureSizes?.get is not a function` al colocar Formas o Prefabs. Las llamadas a `buildMeshGeometry` ya no reciben el índice de `Array.map` como segundo argumento.
- Las vistas previas, el dibujo de brushes y los objetos ocultos usan dimensiones WAD cuando se conocen. La conversión de tamaños se comparte sin crear un Map para cada brush.
- Corregido `GhostBrush`, que antes usaba `assets` sin declararlo.
- `buildMeshGeometry` tolera un parámetro opcional incorrecto sin bloquear todo el viewport.
- Añadidas seis pruebas de regresión específicas para los dos generadores de vista previa, valores WAD, sintaxis y fallo original.
- Se mantienen las funciones de Preview 2, Texture Studio, Texture Lock HF1, compatibilidad Valve 220, BSP Viewer, HUD e idiomas.
- Ver `LEER_PREVIEW2_HF2_FORMAS_ES.md` y `VERIFICACION_PREVIEW2_HF2_FORMAS_ES.md`.

## v1.4.0 Preview 2 HF1 — Texture Lock (6 noviembre 2026)

- Solucionado el deslizamiento de texturas WAD sobre las caras de un brush cuando se traslada. Al cambiar la posición se compensa el desplazamiento UV en el sistema de proyección Valve 220; los píxeles quedan fijados al brush.
- Corregido el movimiento por gizmos, transformaciones modales, mover selección, alinear a la cuadrícula, editar posición mediante `updateObject`, duplicar brushes y colocar prefabs reutilizables.
- Respeta nombres de texturas, ejes U/V explícitos, rotación de la textura, escalas independientes (incluidas negativas), entidades asociadas, propiedades y geometría.
- No cambia los datos de los mapas anteriores al cargarlos: se corrigen automáticamente los próximos movimientos. Si una textura ya quedó desalineada, habrá que recolocarla una sola vez y guardar.
- 79 pruebas automáticas aprobadas. El build Vite/TypeScript completo y la ejecución real en Windows siguen pendientes por dependencias npm no disponibles en este entorno.

---

## v1.4.0 Preview 1 — Texture Studio (6 noviembre 2026)

- Se integran en una actualización las cinco fases previstas: editor flotante, controles directos UV, Smart Fit/Align/Tiling, multicara/cuentagotas/presets y validaciones Valve 220.
- Overlay de 8 puntos para la escala, centro de movimiento y giro con mouse. Vista previa del WAD usa el tamaño verdadero de la imagen cuando está cargado.
- Selección de caras con Shift+clic, acciones en lote y undo por gesto.
- UI multilenguaje (ES/EN/RU/KO/ZH/PT) y panel arrastrable.
- Sin cambios de geometría, exportador MAP, compiladores, BSP Viewer ni backend.
- Entrega de código fuente para comprobar en Windows; ver `VERIFICACION_V14_TEXTURE_STUDIO_ES.md`.

---

## v1.3.0 Preview 6 HF1 — HUD FPS + giros Q/E

- Al seleccionar FPS en «Editar HUD», el editor de personalización se desplaza al borde contrario, sin tapar el indicador.
- El elemento FPS seleccionado pasa por delante de otras capas de edición para permitir arrastrar su asa.
- Controles X/Y en «Editar HUD» para recuperar la posición de cualquier widget aunque haya solapamientos o la ventana sea estrecha.
- En el Editor MAP (modo vuelo / navegación clásica), Q gira a la izquierda y E a la derecha sin desplazar la cámara. Las teclas WASD mantienen su comportamiento.
- Se conserva E para extruir caras seleccionadas fuera del modo vuelo y para interactuar en «Prueba de juego».
- Sin cambios en exportación Valve 220, compiladores ni BSP Viewer.

## v1.3.0 Preview 6 — Interface Refresh & FPS-only HUD

- Monitor del Editor MAP reducido exclusivamente a FPS; pasa a formar parte del HUD movible y ya no se superpone a las ayudas. Eliminado el contador visual separado de candidatas de etiquetas.
- Barra superior organizada: seis acciones de ajustes/visibilidad/salida agrupadas bajo Área de trabajo; permanecen Estudios, Archivo, Ayuda, los modos Editor MAP/BSP/Gameplay, Guardar y Compilar.
- Estilo visual unificado de cabeceras de paneles y cinta clásica más compacta, sin quitar herramientas ni atajos. Nuevo preset «Ordenado» reversible desde Distribución.
- Se mantienen 6 idiomas, preferencias de HUD, opciones de etiquetas, geometría/entidades, exportador Valve 220, BSP Viewer y compiladores sin modificaciones.
- Ver LEER_PREVIEW6_REDISENO_UI_ES.md y VERIFICACION_PREVIEW6_UI_ES.md. Vite/Chromium/Windows y FPS de Osprey aún pendientes por paquetes npm no disponibles.

---

## v1.3.0 Preview 5 — MAP Performance Monitor & Label Idle Optimization

- Eliminado recálculo de etiquetas cuando cámara, mouse, selección y ajustes permanecen iguales; límite de actualización durante movimiento 18 Hz para escenas con >400 anclas y 30 Hz para escenas menores.
- Estilo de etiquetas liviano por defecto, reversible mediante configuración; conserva colores, estados, títulos, targetname, selección y modo Clásico.
- Monitor opcional de FPS/draw calls/triángulos del Editor MAP, accesible incluso al apagar Etiquetas o usar el modo Clásico.
- Nuevas traducciones para los seis idiomas, pruebas y documentación de diagnóstico; no cambia exportación Valve 220, compiladores, BSP Viewer ni iluminación.
- **Pendiente:** instalar dependencias y validar `tsc -b`/Vite, interfaz real, FPS Osprey y Sven Co-op en Windows.

---

## v1.3.0 Preview 4 — Entity Labels Optimization (Editor MAP)

- Nueva capa de etiquetas HTML compartida, virtualizada; elimina centenares de `<Html>` individuales de Drei para entidades puntuales y brushes ligados a entidades en el modo optimizado.
- Filtrado de frustum, distancia configurable (predeterminado 2400 u), límite configurable (predeterminado 48), prioridades, cercanía del cursor y rechazo de solapamiento mediante grilla espacial.
- Las etiquetas seleccionadas no consumen el presupuesto y no se excluyen por distancia mientras estén dentro del plano frontal de la cámara.
- Modo Clásico de respaldo con el comportamiento de HF5, ajustes persistidos y diagnóstico de candidatas / en pantalla / dibujadas.
- Sin modificaciones en MAP Valve 220, exportador, SC-CSG/BSP/VIS/RAD, BSP Recovery, UV, luz ni visualizador BSP.
- Véase `LEER_PREVIEW4_ETIQUETAS_ES.md` y `VERIFICACION_PREVIEW4_ETIQUETAS_ES.md` para límites de validación y prueba en Windows.

---

## v1.3.0 Preview 3 HF2 — BSP → MAP visible surface texture recovery (2026-11-05)
- Surface-aware texture recovery: compare each reconstructed NULL face with visible, overlapping BSP polygons before restoring material and compiled texinfo UV axes.
- Preserve hidden/intentional NULL faces and avoid arbitrary replacement when multiple materials or UV mappings overlap.
- Conversion panel reports restored, unmatched and ambiguous NULL faces; original BSP and existing project remain untouched until user confirms importing.
- Embedded WAD extraction and external WAD handling from HF1 remain unchanged.
- TypeScript, BSP-to-MAP, geometry/viewport, and gameplay regression tests applied. Real osprey BSP and MAP not provided; Windows/Sven Co-op verification pending.

## v1.3.0 Preview 3 HF1 — Recuperación BSP → MAP más segura (2026-11-05)

- BSP Recovery reconoce imágenes WAD3 incrustadas en BSP y permite descargar el WAD complementario; no inventa píxeles para referencias externas.
- Al abrir el MAP recuperado, carga las vistas previas disponibles desde BSP Viewer y el WAD extraído en el navegador de texturas del editor.
- Agrega la referencia al WAD recuperado sin borrar los WAD originales del MAP. Para compilar, instalar el WAD en `svencoop_addon` y configurar su ruta en Ajustes de compilación.
- El importador MAP valida cada brush con el mismo verificador del compilador: intenta reconstruirlo con tolerancias más estrictas; si sigue inválido, informa y omite el sólido solamente con confirmación expresa (podría causar LEAKs).
- Las advertencias de targets no se cambian automáticamente: pueden depender de scripts o entidades dinámicas de Sven Co-op.
- No se tocan compiladores, BSP original, Gameplay Test ni etiquetas del visor (optimización de etiquetas aplazada).
- Validación: TypeScript, 23 pruebas de BSP/Recovery y verificadores de BSP Viewer, Gameplay Test, gizmos y modelado. Prueba real del MAP reportado por el usuario pendiente.

## v1.3.0 Preview 3 — BSP → MAP Recovery (experimental)
- Integrated optional SurfDecomp CLI into BSP Recovery via an isolated local server endpoint; third-party executable is user-provided, not distributed or auto-executed.
- Convert BSP30 to Valve 220 MAP, validate the converted MAP with SvenStudio's existing importer, report skipped brushes and recovered entity counts.
- Download MAP or safely open it in the editor with project backup and explicit confirmation of geometry loss, if any.
- Original BSP, compilers, GoldSrc exporter and previous BSP entity editing remain untouched.
- Actual SurfDecomp runtime and Sven Co-op compilation require Windows validation.

## v1.3.0 Preview 2 — BSP Recovery Studio (2026-11-05)
- Herramienta **BSP Recovery** dentro del BSP Viewer, sobre la base **v1.3.0 Preview 1 HF1**.
- Modo seguro de **edición nativa de entidades BSP30**: inspección, búsqueda, cambio y adición/eliminación de keyvalues, y creación/eliminación de entidades puntuales.
- Preserva la estructura original de todas las entidades no editadas, incluso claves repetidas, y conserva byte a byte los 14 lumps compilados no relacionados con entidades (geometría, texturas, lightmaps, VIS y colisiones).
- Exportación a un BSP **nuevo** con la entidad lump al final del archivo; nunca se sobrescribe el original ni la instalación de Sven Co-op.
- Protección de worldspawn, referencias a brush models `*n` y sus campos geométricos; rechazo de BSP inválidos, variantes ajenas a BSP v30 y extensiones desconocidas.
- Interfaz en seis idiomas; modal autónomo con scroll, búsqueda y mensajes de error; bloquea atajos del editor mientras está abierto.
- El BSP Viewer existente sigue siendo de solo lectura; esta operación funciona mediante una copia descargable.
- **Alcance intencional**: NO reconstituye el MAP original, NO mueve geometría BSP y NO vuelve a hornear iluminación, visibilidad ni colisiones.
- Validación automática: TypeScript, pruebas de integridad de 14 lumps y regresiones clave. **Pendiente:** ejecutar el ZIP en Windows y validar el BSP editado en Sven Co-op real.

## v1.3.0 Preview 1 — Gameplay Test (2026-11-05)
- Player Walk pasa a llamarse Gameplay Test en los seis idiomas, conservando internamente walkMode para compatibilidad.
- Vista Material / Rendered aproximada, reutilizando el visor y las luces GoldSrc ya implementados, sin calcular SC-RAD.
- NPC y entidades con MDL: modelos de la instalación local visibles durante Gameplay Test, con animaciones idle compatibles cuando están disponibles; marcador alternativo para monstruos sin MDL resuelto. No hay IA ni AngelScript ejecutado en navegador.
- Interacción E: activación temporal de func_button y func_rot_button, conexiones target/targetname, trigger_relay, trigger_once y trigger_multiple; movimiento aproximado de func_door. Puertas rotatorias y cámaras nativas se dejan para Sven Co-op, sin simularlas falsamente.
- F, H, N, WASD, Shift, C/Ctrl, Space, F5/Esc conservados; render de agua, transparencias y materiales recuperado del sistema previo.
- Sesión de simulación en memoria, sin alterar .svenstudio.json, propiedades de entidades, brushes, exportación MAP o compiladores BSP.
- Escáner de raycast interactivo impide activar botones a través de otra pared.
- Pruebas de Gameplay Test y ejemplo original de botón → relay → puerta; regresiones del editor anteriores.
- PREVIEW: sin validación visual en Windows ni equivalencia con IA, física, animaciones avanzadas o SC-RAD final de Sven Co-op.

## v1.2.0 Preview 6 — Workspace & HUD Layout
- Toolbar clásica: nuevas acciones rápidas de Forms, Visibility, Layout, Terrain, Gameplay, NPC, Map Doctor y Packager, reutilizando las herramientas existentes.
- Secciones de la barra reordenables arrastrando el icono de cada sección y mediante botones en Diseño; orden persistente por usuario.
- Paneles acoplables: ajustes responsivos para Recursos, Explorador y Propiedades en los cuatro lados, con controles que se contraen y scroll cuando falta espacio.
- Formas se integra en Editar HUD: permite mover, ocultar, mostrar, redimensionar y restablecer su posición, sin tocar geometría ni archivos MAP.
- El desplegable de Formas se orienta hacia arriba cuando falta espacio debajo y se limita al tamaño del visor.
- Se conservan las preferencias anteriores de interfaz y se proporciona un restablecimiento seguro desde Diseño.
- PREVIEW: prueba interactiva visual en Windows pendiente; las pruebas automáticas no sustituyen esa validación.

## v1.2.0 Preview 5 — Shape Palette, UV Lock & UI refinement (2026-11-05)

- Paleta **Formas**: ahora incluye **Dibujar** y 25 formas colocables (10 originales + 15 nuevas), con scroll, ancho, profundidad y altura.
- Recupera puertas y ventanas como aberturas reales en paredes worldspawn mediante el sistema existente, más marcos independientes y otras estructuras.
- Se elimina el grupo inferior «Crear · Primitivas», que había quedado redundante.
- Rotación con **Texture Lock**: materializa los ejes UV Valve 220 para que la textura gire junto con los brushes. Incluye cambios mediante gizmos y propiedades.
- Etiquetas profesionales en español, ruso y coreano; nuevo chino simplificado y portugués (Brasil) con traducción de los controles principales. El resto de opciones menos comunes usa fallback inglés.
- Nombre del proyecto desplazado hacia la izquierda en la barra superior.
- Selección prioritaria de las seis flechas del gizmo de escala frente a la pared que quede delante en pantalla.
- Se preservan los sistemas anteriores y el soporte de MAP Valve 220. **Pendiente de prueba visual en Windows y compilación real con SC-CSG/SC-BSP/SC-VIS/SC-RAD.**

## v1.2.0 Preview 4 — Viewport & shape workflow fixes (2026-11-05)

- Al dibujar un brush, clic derecho cancela y vuelve a selección. Escape conserva el mismo comportamiento.
- Administrador de visibilidad: los objetos reactivados no desaparecen de la lista durante la sesión; «Mostrar y enfocar» no cambia el atributo `hidden`: muestra el brush en modo fantasma y centra la cámara.
- G alterna gizmo Move (G otra vez vuelve a Select), igual que R y C; ninguna tecla transforma el brush hasta arrastrar un control.
- Escalado de brush individual: seis flechas en las caras X±/Y±/Z±; la cara opuesta permanece fija. Los grupos conservan el gizmo de escala anterior. Eliminado «Ancla de escala» de la interfaz.
- Eliminados el selector de formas y Arquitectura rápida del panel lateral. Los navegadores WAD, FGD, modelos y NPC permanecen intactos. Paleta de Formas en el visor, con dimensiones ancho/profundidad/altura independientes y colocación por clic.
- Geometría de formas sigue formada por brushes convexos con exportación Valve 220. Ningún cambio en los compiladores BSP, mapas anteriores, Cinematic, NPC ni Terrain Studio.
- Preview: G, R, C, Undo/Redo, shapes, MAP y pruebas automatizadas comprobados; falta validar visualmente los seis controles de escala y la compilación BSP real en Windows / Sven Co-op.

## v1.2.0 Preview 3 — Vista sólida de terreno y profundidad configurable (2026-11-05)

- El visor de Terrain & Shape Studio ahora muestra **superficie, paredes laterales y base inferior** del volumen sólido, como se crea en el mapa Valve 220. Se ocultan solo caras internas coincidentes para evitar solapamientos en WebGL.
- Botón «Terreno sólido (base visible) / Solo superficie superior» para inspección. El modo sólido está activo inicialmente.
- Nuevo control «Profundidad de la base» (64–1024 u); la base mantiene automáticamente al menos 64 unidades bajo el vértice más bajo, incluso en valles profundos. Se muestra la posición inferior real respecto de Z.
- El valor por defecto es 96 u: los proyectos de Preview 1/2 sin este campo siguen utilizando la fórmula anterior y se abren sin conversión.
- Construcción y vista previa comparten las mismas coordenadas de vértices y plano inferior. No se agregaron displacements ni brushes huecos.
- Se preservan esculpido, texturas WAD, colocación por clic, rocas, Undo/Redo y compiladores. No modifica la geometría de grupos existentes hasta que se aplique una edición.
- Texturas y luces aproximadas del visor; el resultado final del BSP requiere SC-CSG/SC-BSP/SC-RAD en Windows y verificación en Sven Co-op.

## v1.2.0 Preview 2 — Terrain placement and WAD texture picker (2026-11-05)

- Terrain & Shape Studio: botón principal «Colocar con clic en el mapa»; al cerrar el estudio se arma un único clic sobre una superficie, con marcador del tamaño del terreno. Escape cancela sin cambiar nada.
- Alternativa «Aplicar en X/Y/Z» para colocación numérica existente; también funciona con rocas.
- Miniaturas, filtro por WAD, búsqueda e importación WAD dentro del estudio. Mantiene los archivos WAD y texturas originales sin reescribirlos.
- Texturas reales en el preview (starter y WAD importados) con UV aproximadas y repetición, para terrenos y rocas; las coordenadas de texturas finales siguen usando el exportador Valve 220 existente.
- La colocación reutiliza el estado de Undo/Redo, valida límites y geometría GoldSrc y no interfiere con modos de colocación preexistentes.
- No cambia compiladores, entidades, proyecto nativo, brushes ya colocados, gizmos o controles principales. Compilación final en Windows / Sven Co-op pendiente de prueba.

## v1.2.0 Preview 1 — Terrain & Shape Studio (2026-11-05)

- Terrain & Shape Studio nuevo: Raise, Lower, Smooth, Flatten, Noise y navegación de vista previa independiente.
- Generación de terrenos como brushes triangulares convexos y cerrados, válidos para GoldSrc Valve 220.
- Rock & Cliff Generator con rocas convexas de semilla reproducible.
- Persistencia opcional de grupos de terreno en .svenstudio.json, edición posterior protegida, Undo/Redo y comprobación de validez.
- Integración sin alterar los paneles, compiladores ni controles existentes.
- Limitaciones: vista previa aproximada; 512 brushes como máximo por terreno; compilación real Windows pendiente.

## v1.0.1 Preview 5 Hotfix 1 — NPC Studio React crash

- Fixed infinite React re-render (`Maximum update depth exceeded`) on opening NPC & AI Studio in projects without `customNpcs`.
- Fixed the same unstable Zustand selector in Custom NPC Importer.
- Added a single, immutable, module-scoped empty list fallback; no project format, MAP, game entities or compilers changed.
- Preserves Custom NPC Importer and all other Preview 5 functionality.

## v1.0.1 Preview 4 — Gameplay Studio: exploración de grafos (experimental)

- Navegación libre por el gráfico: desplazar el lienzo arrastrando el fondo o con botón central, zoom alrededor del cursor, encajar visibles, centrar selección y minimapa.
- Organización automática determinista para cientos de nodos, con restauración de la distribución anterior y posiciones guardadas dentro de `.svenstudio.json`.
- Búsqueda, filtros por grupos de entidad y vista local de la entidad seleccionada y sus vecinas.
- Enlaces visuales diferenciados: `target` y referencias adicionales `moveto`, `killtarget` y `master`. Las adicionales son **solo de lectura gráfica**: el puerto convencional sigue editando únicamente `target`.
- Las rutas de `trigger_camera` se reconocen incluso si los `path_corner` no usan el prefijo `cs_`.
- Confirmación antes de reasignar un target con significado especial o que afecte a varias entidades con el mismo `targetname`.
- Traducciones de los nuevos controles a español, inglés, ruso y coreano.
- Sin cambios en los compiladores BSP, modelado, WAD/FGD, gizmos ni lógica de exportación MAP. No cambia la estructura de entidades GoldSrc.
- Es una Preview: falta prueba interactiva de interfaz y en Sven Co-op bajo Windows.

## v1.0.1 Preview 3 — Cinematic viewport & camera controls (experimental)
- Four preview-only shading modes: Wireframe, Solid, Material Preview, Rendered. Rendered reuses the main editor light parsing/attenuation and light/spot/environment approximations, not SC-RAD lightmaps.
- Optional expanded cinematic preview with playback controls, rate selector (0.5×/1×/2×), and jump-to-point actions.
- Native trigger_camera editor properties: speed, acceleration, deceleration, turnspeed, selected spawnflags, HUD visibility. Unknown/custom props and flags are preserved.
- Path inspector shows per-leg length/time, optional per-leg **simulation-only** speeds in `.svenstudio.json`. `path_corner.speed` is documented for trains, not guaranteed for cameras; these per-leg speeds NEVER export to MAP/BSP.
- Safe deletion of last path corner with inbound-link protection, Undo/Redo and cleanup of preview-only speed metadata.
- Read-only diagnostic checks for target proximity, sampled solid crossings, and estimated travel duration; not a GoldSrc collision simulation.
- 7 additional Preview 3 regression groups + existing cinematic checks. No changes to core modeling, MAP exporter or SC-CSG/BSP/VIS/RAD.
- Experimental: requires browser visual check and a compiled-map test in Sven Co-op before any Stable promotion.

## v1.0.1 Preview 2 — Cinematic camera viewport fixes
- Preview-only WAD/starter textures and readable ambient lighting.
- Fixed brush scale coordinate conversion in cinematic preview.
- Camera / Inspect scene toggle with orbit and path visualization.
- Visual-only warning when a camera is inside a solid world brush.
- No changes to GoldSrc entities, MAP export, compiler, original viewport or project format.

# SvenStudio 3D — Changelog

## 1.0.1 Preview 1 — Cinematic Camera Studio (experimental)

- Cinematic Camera Studio en Studios: cámaras estáticas o móviles con `trigger_camera`, objetivo `info_target` y rutas de `path_corner`.
- Colocación de puntos con el mouse en el visor 3D, edición de posiciones mediante gizmos existentes y línea de recorrido visible.
- Vista previa independiente y aproximada (sin alterar la cámara principal ni ejecutar lógica Svengine).
- Tiempo, velocidad, flags Freeze Player / All Players / Player Invulnerable; conexión opcional y no destructiva con triggers y botones.
- Compatibilidad del proyecto JSON y MAP Valve 220; mutaciones agrupadas para Undo/Redo y pruebas específicas de exportación.
- **Pendiente:** validación de escena y compilación en Sven Co-op para promover esta Preview a Stable.
- No se modifican el pipeline de compilación ni el formato de proyecto ni los sistemas de iluminación, modelado o BSP Viewer.

## 1.0.0 Stable

- Lanzamiento estable desde 1.0.0 RC1 tras confirmar ocho pruebas funcionales en Windows, incluida la ejecución de un mapa compilado en Sven Co-op.
- **Sin cambios en el código funcional del editor, los controles, la iluminación o la compilación** respecto de RC1.
- Versión de aplicación/paquete `1.0.0`; actualizados el lanzador, README y guías de instalación.
- Añadidos inventario de dependencias y avisos de licencia/distribución; no se asigna una licencia de proyecto sin autorización.
- Nuevas pruebas automáticas de verificación del paquete estable.

## 1.0.0 RC1

- Candidata de lanzamiento: documentación, checklist, organización de historial y verificación del servidor local.
- Conservó herramientas, Renderer, G/R/C, menú Z, Player Walk, SKY, Map Doctor y BSP Viewer de v0.9.5.

## 0.9.5 — Lighting Preview Fix

- Calibración de `light`, `light_spot` y `light_environment` para Rendered.

## 0.9.4 — Performance & Shading

- Menú radial Z; sombreado Wireframe, Solid, Material Preview y Rendered.
- Nombre SvenStudio 3D, iconos y lanzador SvenStudio3D.bat.

Notas anteriores en `docs/history/`.

## v1.0.1 Preview 5 — Custom NPC Importer (AngelScript)
- NPC & AI Studio: importacion no ejecutable de scripts .as y metadatos de NPC personalizados (con FGD opcional).
- Registro de classnames por proyecto, incluyendo nombres sin prefijo monster_, model path y source files persistentes.
- Generacion de paquete ZIP aditivo con scripts y recursos opcionales y linea de configuracion map_script.
- Bootstrap MapInit solo cuando el script no trae MapInit y se selecciono una funcion Register*.
- Validaciones de rutas seguras, classnames, dependencias, proyectos y pruebas MAP/Undo/Redo.
- No modifica SC-CSG/BSP/VIS/RAD, el exportador MAP ni la IA real de Svengine.
- Las pruebas en Windows y la ejecucion de NPC personalizados en Sven Co-op siguen pendientes.

## v1.1.0 Preview 1 — Map Packager Studio (2026-11-05)
- New read-only packaging panel at File → Map Packager Studio.
- Scans the compiled BSP's entity lump and local game addon/download directories, including skybox sides, models, auxiliary model files, sounds, CFG map_script, AngelScript includes, replacement lists and selected manual paths.
- Integrates imported Custom NPC scripts from the current project, while refusing conflicting installed scripts.
- Shows available, missing and built-in resources and warnings; requires explicit acknowledgment for incomplete packages.
- Generates a standalone ZIP for svencoop_addon/ without writing to game folders or modifying existing CFG.
- Includes Spanish, English, Russian and Korean interface strings.
- Static scanning limitations, third-party licensing and Windows runtime verification are documented.

## v1.3.0 Preview 3 HF5 — SC-RAD lighting diagnostic (experimental)
- Added optional non-destructive ambient lighting test in Build configuration (0.08 / 0.15 / 0.25); default Off.
- Separate output names (`_light08`, `_light15`, `_light25`) protect an existing compiled BSP.
- Adds bounded `-ambient r g b` to SC-RAD ONLY, never modifies source MAP, worldspawn, or other compiler stages.
- Includes read-only BSP lighting comparison utility, translations, and safety tests.

## v1.4.0 Preview 2 — Formas, Prefabs & Precision Gizmo (6 noviembre 2026)
- El panel Formas y geometría se oculta automáticamente al elegir una forma o prefab; no tapa la zona de colocación.
- Memoria local persistente de dimensiones por tipo de forma y respeto de ajustes introducidos antes de elegir una forma.
- Biblioteca Prefabs accesible directamente desde Formas, con creación a partir de selección múltiple y colocación mediante clic y preview 3D.
- Se reutiliza el almacenamiento existente `.svprefab.json` y su preservación de ID/grupos en vez de desarrollar un sistema paralelo.
- Flechas del gizmo de escala en tamaño de pantalla y Shift para ajuste fino sin grilla.
- Panel compacto de dimensiones exactas cuando se escala un brush individual.
- Nuevas etiquetas traducidas a español, ruso, coreano, chino simplificado y portugués; las etiquetas inglesas son las claves originales.
- Tests de regresión y validación estática. La prueba Windows/Vite queda pendiente por dependencias de npm no instaladas.

## v1.4.0 HF4 — Botón Pantalla completa en la barra superior
- Se trasladó el control de modo inmersivo al lado de **Ayuda** con texto visible («Pantalla completa» / «Salir de pantalla completa»).
- Se eliminó el botón duplicado del HUD del visor MAP.
- Se conserva la entrada y salida de Fullscreen, Keyboard Lock opcional y el bloqueo de Ctrl+D cuando el navegador entrega ese evento.
- Traducciones en español, inglés (texto base), ruso, coreano, chino y portugués.
- Sin modificaciones en geometría, WAD, UV, MAP Valve 220, BSP Viewer ni compiladores.

## v1.4.0 HF5 — Desvincular brushes de entidades (worldspawn)

- Nueva herramienta genérica para retirar el vínculo `entityId` sin perder el brush. Funciona con cualquier classname de entidad sólida asociada a brushes, no solo puertas y botones.
- Acción individual, multiselección y conversión de todos los brushes de una entidad en el menú contextual y Propiedades.
- Se conserva la entidad mientras queden brushes asociados; se limpia el registro sin brushes al convertir el último, con advertencia y confirmación.
- Operación única reversible con Ctrl+Z, comprobación de bloqueos, sin cambios en caras/UV/posición ni geometría.
- Localización ES/EN/RU/KO/ZH/PT; tests de casos combinados.
- Se mantienen intactos exportador Valve 220, BSP Viewer y backend.

Consulta `LEER_HF5_DESVINCULAR_ENTIDADES_ES.md` y `VERIFICACION_HF5_DESVINCULAR_ENTIDADES_ES.md`.
