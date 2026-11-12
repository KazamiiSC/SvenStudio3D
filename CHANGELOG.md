## 2026-11-12 — SvenStudio 3D v2.0.0 · consolidación de HF10

- Base intacta: v1.9 Etapa 8A HF10, Smart Build 3.0 con compilación aislada, recursos externos, Smart WAD y salida por carpeta/ZIP o instalación explícita. No cambia algoritmos de geometría, colisiones ni iluminación.
- Actualización de metadatos a semver 2.0.0, consola BAT, lanzador en ES/EN/RU/KO/ZH/PT, identidad superior y Ayuda. Se conserva la compatibilidad de `.svenstudio.json` y la estructura de configuración anterior.
- Ayuda, guía de novedades y resúmenes de estudios renovados en los seis idiomas con reglas actuales de salida sin escribir en Sven Co-op y límites de BSP/prefabs.
- Revisión de traducciones: completadas las cadenas de `t()` faltantes en español, ruso y coreano dentro del inventario estático; ampliadas chino y portugués. Quedan fallbacks históricos documentados en `AUDITORIA_TRADUCCIONES_V2_0.md`.
- Portable preparado reutilizando `node_modules` Windows x64 verificados de la versión HF9, cuyas dependencias son idénticas al lockfile de HF10 (salvo semver de raíz). Descarga verificada de Node 22.16 en primer inicio.
- Pruebas y limitaciones: ver `VALIDACION_V2_0.md`. Primera ejecución Windows limpia y compilación real SC siguen pendientes.

## 2026-11-11 — Editor BSP · Etapa 8A HF3 · Extracción aproximada tolerante

- Reordena cíclicamente los primeros vértices de paneles BSP válidos para evitar falsos planos degenerados al construir Valve 220, respetando textura, ejes UV y orientación.
- En la opción explícita de exportación **aproximada**, omite caras sin polígono MAP válido y conserva sus IDs/rechazos en `recovery.skippedFaces` del `.svprefab`.
- **Confirma antes de guardar** si hay pérdidas; marca el archivo `_PARCIAL_N` y muestra el número de caras omitidas en Estudio de Prefabricados. No exporta selecciones vacías. La recuperación exacta de sólidos cerrados no cambia.
- Validación: 234/234 pruebas BSP repartidas en dos grupos, 3 pruebas nuevas de paneles; TypeScript y sintaxis del servidor correctas. Pendiente comprobar con `BlackMesaEPF.bsp` real y Sven Co-op.
- Guía: `docs/EDITOR_BSP_8A_HF3_PANELES_TOLERANTES_ES.md`.

## 2026-11-11 — Editor BSP · Etapa 6E · Exportación compacta y gestión de WAD importados

- Exportación compacta automática de los 15 lumps activos de BSP30, sin retener copias append-only obsoletas; verificación byte a byte de cada lump y reimportación con parser.
- Biblioteca de texturas BSP: «Quitar WAD importados», con botón por archivo WAD3; eliminación de la sesión únicamente, sin tocar archivos físicos ni referencias originales de `worldspawn`.
- Protección de WAD utilizados por ediciones actuales o estados de Undo/Redo, con remapeo de índices temporales del resto de texturas.
- Se preservan RGB, lightstyles, VIS, clipnodes, MDL, geometría y modelos sin reconstruir RAD. La Etapa 6D fue probada en el juego por el usuario; la exportación compacta 6E requiere nueva prueba real.
- Documentación: `docs/BSP_EDITOR_ETAPA_6E_EXPORTACION_COMPACTA_GESTION_WAD_ES.md`.

## 2026-11-11 — Editor BSP · Etapa 6D · UV continuos y lightmaps

- Conserva el visor GPU durante gestos UV en caras BSP para evitar reconstrucción de mallas, texturas y atlas de luz por cada movimiento.
- Rotación y escala de materiales en superficies iluminadas con reproyección aproximada de los lightmaps RGB y conservación de estilos; no reemplaza RAD.
- Validada posteriormente por el usuario en Windows y Sven Co-op con exportación real del mapa `sandstone`.

## 2026-11-11 — Editor BSP · Etapa 6C · Texture Studio + WAD3

- Interfaz flotante Texture Studio y biblioteca WAD3 con búsqueda, miniaturas, selector de WAD y presets de ajustes UV; no modifica el editor MAP.
- Widget UV de 120 px fijado a pantalla con pestaña de arrastre separada y posición persistente; Alt + clic izquierdo para desplazar UV con seguridad de gestos/cancelación.
- Exportación BSP incorpora nuevas texturas WAD3 sin comprimir con todos sus mipmaps y paleta; reapertura y validación de otros lumps; preservación del original y restricciones de lightmaps/texturas especiales.
- Regresiones BSP, TypeScript y servidor; prueba en Sven Co-op/Windows 6C aún pendiente.

## Editor BSP — Etapa 6B: edición persistente y controlada de texturas/UV (11 noviembre 2026)
- Partiendo de la Etapa 6A que el usuario probó y aprobó, el modo **Caras** incorpora cambio de textura a otra ya existente en el BSP de igual resolución, desplazamiento U/V y edición de rotación/escala cuando no existe lightmap compilado.
- Para caras con luz compilada, solo se admite UV desplazado en múltiplos de 16 texeles: se valida que cada vértice muestree exactamente la misma posición relativa del lightmap; operaciones que exijan RAD se rechazan.
- Exportación binaria real en copia BSP30: clonación de texinfo por cara y parche exacto de los índices de las caras; reimportación con parser, validación de lightmap y conservación de otros lumps. Cambios de entidades y superficies pueden exportarse juntos sin sobrescribir el archivo original.
- Deshacer/rehacer de superficies, selección múltiple atómica, selector de texturas compatibles y protecciones de materiales especiales. UI en seis idiomas. Sin alteraciones a Editor MAP, BSP Composition ni BuildTogether.
- Ver `docs/BSP_EDITOR_ETAPA_6B_EDICION_SEGURA_ES.md`. **No se ha probado aún esta Etapa 6B en Windows ni dentro del juego**.

## Editor BSP — Etapa 6A: selección de caras compiladas y diagnóstico (11 noviembre 2026)
- Primera mejora funcional construida **sobre Preview 5 HF9**, sin sustituir el visor BSP, el editor MAP ni el editor de entidades.
- Nuevo selector **Entidades / Caras** en la barra superior del Editor BSP. Clic en superficies compiladas recupera el índice de cara original, aunque los triángulos estén agrupados; resaltado de polígono completo, Ctrl/Shift+clic y selección múltiple acotada a 64. Al volver a Entidades se recuperan gizmos y MDL.
- Inspector integrado con textura, tamaño, texinfo compartido, ejes S/T, UV reales, plano/modelo, lightmap y lightstyles; textos de UI ES/EN/RU/KO/ZH/PT.
- Solo diagnóstico: no guarda UV ni texturas, no cambia BSP binario ni invalida lightmaps. La **Etapa 6B** implementará edición persistente con exportación de copia y validaciones.
- Ver `docs/BSP_EDITOR_ETAPA_6A_CARAS_DIAGNOSTICO_ES.md`; 164/164 pruebas BSP, TypeScript y sintaxis del servidor correctos. Compilación y prueba de interfaz en Windows pendientes.

## Distribución portable HF9 para primera instalación (11 noviembre 2026)
- **Solo empaquetado y documentación** de la Preview 5 HF9 aprobada por el usuario. No modifica el código de Editor BSP, Editor MAP, BSP Composition, servidor ni herramientas.
- Se entregan: ZIP completo **Windows x64 con `node_modules`** y ZIP de **código fuente sin `node_modules`**, con documentos de continuidad para la próxima Etapa 6. `package.json`/`package-lock.json` coinciden exactamente con las dependencias Windows heredadas del portable v1.9.
- **Primer inicio:** el BAT prepara Node.js 22.16.0 desde sitio oficial y verifica SHA-256; requiere conexión en ese primer arranque si no existe `runtime/node.exe`. Los siguientes inicios locales pueden ser offline.
- **Etapa 6 aún no implementada:** selección/edición segura de caras, texturas y UV sobre BSP compilado es el siguiente trabajo. Más detalles: `docs/CONTINUIDAD_HF9_ETAPA6_NUEVO_CHAT_ES.md`.

## Editor BSP Preview 5 HF9 — Gizmo de rotación compacto
- El aro de rotación anterior era demasiado grande y tapaba al NPC. Se sustituyó por **dos arcos de giro pequeños** con puntas discretas, sin la flecha larga de orientación de las primeras previews.
- Radios visibles: 20–26 unidades, frente a 35–48 de HF8. La captura de clic permanece amplia (13–35 unidades), independientemente del dibujo.
- Se mantiene arrastre circular desde cualquier sector, Yaw durante la rotación, deshacer y guardado BSP original protegido. Rótulo Yaw más cercano al nuevo aro.
- No cambia cámara, selección múltiple, paneles, MDL, FGD, IA, exportación, ni otras herramientas. Ver `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF9_ES.md`.

## Editor BSP Preview 5 HF8 — Ventana de propiedades redimensionable y ajustes visuales
- La ventana flotante de propiedades de entidades se puede **agrandar o achicar desde la esquina inferior derecha** (ancho y alto); sus dimensiones se recuerdan en este navegador separadamente de su posición, y se limitan al espacio disponible. Incluye soporte de teclado con flechas para redimensionar al enfocar el tirador y área interna desplazable sin recortar controles.
- Rótulo **Yaw** del aro grande de rotación más próximo al aro (de 72 a 40 unidades relativas), sin modificar agarre, rotación ni exportación BSP.
- **Vuelo WASD** situado inmediatamente **antes** de Buscar entidades en la barra superior del Editor BSP; borde cian resaltado y estado activo distinguible.
- No cambia NPC, IA, FGD, modelos MDL, selección, BSP Composition ni operaciones binarias. Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF8_ES.md`.

## Editor BSP Preview 5 HF7 — Aro de rotación y ubicación de Vuelo
- Gizmo R reemplazado por aro único ancho con área de captura ampliada, giro continuo y sin flechas ni marcas de orientación.
- Vuelo WASD reubicado al lado de Buscar entidades (Editor BSP); se conserva en Visor BSP.
- Sin cambios en selección, geometría, IA, FGD ni guardado BSP.
- Ver `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF5_HF7_ARO_ES.md`.

## Editor BSP Preview 5 HF6 — Ajuste visual del gizmo de rotación
- Se reemplazó la flecha amarilla grande por un indicador discreto en el aro de rotación; se mantienen Yaw, grados y marcas de orientación.
- Sin cambios en comportamientos de NPC, FGD, editor MAP, exportación o geometría BSP.
- Véase `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF5_HF6_GIZMO_ES.md`.

## v1.9 — Editor BSP Visual Preview 5 HF5 (11 noviembre 2026)
- Propiedades de entidades ahora en panel flotante cerca de la selección 3D, arrastrable, con posición persistente y límites adaptativos; pestañas FGD, conexiones, RAW, duplicación y eliminación conservados. La inspector lateral mantiene visualización, búsqueda y creación.
- Navegador lateral categorizado por tipos de entidad, tarjetas compactas, búsqueda, número de resultados y paginación de 24 elementos; selección múltiple y enfocar continúan.
- Gizmo R: guía de orientación/yaw con aro, marcas y flecha, lectura de ángulo y variación mientras se gira, sin modificar el motor BSP ni el guardado de `angles`.
- UI localizada ES/EN/RU/KO/ZH/PT. No modifica BSP Composition 2.1.2, MDL, cámara ni geometría.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF5_INTERFAZ_ES.md`.

## v1.9 — Editor BSP Preview 5 HF4 (11 noviembre 2026)
- La Biblioteca de modelos BSP sugiere clases de IA de combate nativa para MDL conocidos (p. ej. `models/agrunt.mdl` → `monster_alien_grunt`) si existen en las FGD cargadas; advierte que `monster_generic` no ataca automáticamente. No se asigna IA a modelos de forma implícita al exportar.
- FGD adicionales importables solo para la sesión del Editor BSP; combinación de clases y herencia disponible entre archivos importados, con límites de tamaño; no instala recursos ni motores de IA.
- Inspector con pestañas **Atributos / Flags / Edición RAW**, choices y casillas generadas desde FGD, bits desconocidos preservados, y edición manual de keyvalues.
- Menú contextual con clic derecho sobre modelos y marcadores 3D, sin interferir con el arrastre de cámara; eliminación por **Supr**, confirmación al borrar grupos, Ctrl+Z para deshacer. Clic en vacío cancela colocación/conexión y limpia selección.
- Mantiene el Visor BSP, Editor MAP, BSP Composition 2.1.2, BuildTogether, MDL, paneles redimensionables, controles G/R, seis idiomas y exportación sin sobrescribir BSP original. Los modelos brush compilados siguen protegidos.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF4_FGD_CONTEXTO_ES.md`.

## v1.9 — Editor BSP Preview 5 HF3 (11 noviembre 2026)
- Biblioteca MDL: modos nativos de colocación diferenciados (decoración `item_generic`, objeto con colisión `item_generic`, NPC `monster_*` de FGD y modelo reactivo a disparos `cycler`). Ya no se crea siempre un `item_generic` decorativo al colocar MDL desde la biblioteca.
- Configuración por modo de salud, aliado, roaming, spawnflags, clase de IA, equipo compatible, hull personalizado, skin/bodygroup, escala y secuencias donde el motor las permite. Validación antes de entrar al modo colocar en 3D.
- Convertir modelos puntuales existentes entre modos de forma atómica y deshacible: conserva origen, orientación, conexiones y keyvalues ajenos al modo. No altera entidades brush compiladas.
- Panel de propiedades de Biblioteca MDL con scroll propio y distribución responsiva; traducciones en ES/EN/RU/KO/ZH/PT.
- 139/139 pruebas BSP y 125/126 regresiones FGD/NPC relacionadas; falla histórica aislada en comprobación textual de Gameplay Studio. TypeScript y servidor correctos. Vite Linux no disponible por módulo nativo de Rollup no incluido en la base Windows; juego real por comprobar.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF3_MODELOS_ES.md`.

## Editor BSP Visual Preview 5 HF2 (v1.9, 11-11-2026)
- Al entrar nuevamente en Vuelo WASD se conserva la orientación orbital; OrbitControls ya no se remonta al alternar los modos.
- Marco 3D en MDL seleccionados y anillos de selección para entidades puntuales y selecciones múltiples.
- Biblioteca BSP con cuadrícula de miniaturas MDL de carga diferida, preferencia persistente y soporte de modelos locales de sesión.
- Se mantiene la base Preview 5 HF1 y la exportación de copia BSP.

## v1.9 — Editor BSP Visual Preview 5 HF1 (11 noviembre 2026)

- Correcciones sobre Preview 5: modo visible de selección múltiple en Editor BSP, botones rápidos de buscar/colocar entidades y biblioteca de modelos recuperados en la barra superior; paneles y herramientas laterales intactos.
- Vuelo WASD → órbita: snapshot de cámara y sincronización del target durante los primeros fotogramas al salir, para evitar saltos al pulsar Escape o «Salir de vuelo».
- Modelos MDL: interpolación de rotación de huesos por cuaterniones en el parser compartido, validación de matrices de pose antes de aplicar cambios y ajuste cercano al suelo de NPC, items, armas, munición y props en el visor, sin cambiar sus `origin`.
- Mensajes nuevos en los seis idiomas. Tests nuevos de selección, interpolación, modelos y accesos, más regresiones BSP existentes. Vista previa en Windows por verificar; Vite bloqueado en Linux por módulos nativos de Windows de la distribución original.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_HF1_ES.md`.

---

## v1.9 — Editor BSP visual, Preview 4 (11 noviembre 2026)

- Visor BSP y Editor BSP: se conserva posición, yaw y pitch al salir de Vuelo WASD con Escape o botón. Reconciliación de cámara y destino de OrbitControls al cambiar de modo sin amortiguación antigua; Escape de vuelo no borra la selección.
- Interfaz BSP en tres columnas ajustables: barra superior simplificada, panel izquierdo para herramientas/visualización/cámara y panel derecho para inspector y edición. Laterales redimensionables con arrastre o flechas, tamaños persistidos, botones para ocultar/mostrar y correcciones de scroll, texto y controles estrechos.
- Marcadores de entidades desde la apertura: en BSP con más de 800 entidades, se eligen las cercanas al usuario en vez de los primeros 800 índices del lump; se actualizan al recorrer el escenario y respetan selección/distancia.
- Idle MDL más fluido: actualización de pose adaptativa 30/24/18 FPS frente a 11 FPS anterior; la ventana MDL usa requestAnimationFrame a 30 FPS frente al temporizador de 20 FPS. Alineación de NPC al suelo basada en la altura de pies idle y caché por bodygroup; ningún cambio al origin de BSP.
- Cambios aislados al Viewer/Editor BSP, modelo de vista previa e idioma. Conserva BSP Composition 2.1.2, MAP, BuildTogether y exportación por copia.
- TypeScript, sintaxis servidor y pruebas BSP con regresiones nuevas. **Pendiente** prueba visual en Windows/Sven Co-op y compilación web completa por dependencias nativas Linux ausentes en el ZIP Windows original.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_4_ES.md`.

---

## v1.9 — Editor BSP visual, Preview 3 (11 noviembre 2026)

- Nuevo control **Distancia de visibilidad de entidades** independiente del de etiquetas: oculta marcadores 3D y vistas previas MDL lejanos, preservando la entidad seleccionada y la lista del inspector.
- No se renderiza una multitud de modelos de jugador para `info_player_deathmatch`/`info_player_coop`: solo `info_player_start` mantiene su previsualización de personaje.
- Previsualización MDL para NPC terrestres ajustada visualmente al suelo worldspawn cercano (con opción de desactivar el ajuste), sin alterar la posición BSP (`origin`) ni las colisiones. Los NPC aéreos no se ajustan. Animación idle nativa del MDL, limitada por distancia, complejidad y cantidad de recursos.
- Mejoras en resolución de `model`, `new_model`, `custom_model`, rutas de subcarpetas, FGD y modelos aliados; búsqueda opcional en carpetas instaladas adicionales.
- Biblioteca de modelos: **Importar carpeta MDL adicional** desde archivos elegidos por el usuario (sesión solamente), con compañeros de textura/animación y previsualización/asignación por ruta. No instala MDL ni modifica archivos de juego.
- Mantiene Editor BSP, Visor BSP, BSP Composition 2.1.2 y MAP editor. Traducciones ES/EN/RU/KO/ZH/PT y documentación.
- TypeScript y sintaxis servidor aprobados; 99/99 pruebas BSP y 38/38 regresiones extra aprobadas. Vite Linux no pudo compilar por dependencia nativa Rollup ausente. Sin prueba visual de los MDL reales en Windows todavía.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_3_ES.md`.

---

## v1.9 — Editor BSP visual, Preview 2 (11 noviembre 2026)

- Acceso independiente **Editor BSP** en la barra global, junto a **Visor BSP**. Herramientas de escena reorganizadas en menús compactos **Herramientas / Visualización / Cámara**, con exportación BSP y Biblioteca de modelos a mano.
- La creación de entidades puntuales desde FGD pasa a **modo de colocación en superficies**: vista previa del punto en el visor, clic izquierdo confirma la posición 3D real, Esc cancela. Conserva los gizmos G/R y el historial/guardado nativo previos.
- Resuelve modelos NPC implícitos a través de `@studio` FGD y rutas GoldSrc conocidas, sin escribir keyvalues artificiales. Vista previa limitada/priorizada para escenas grandes, con diagnóstico de recursos no cargados. Requiere gameDir válido y archivos MDL disponibles.
- Nueva ventana **Biblioteca de modelos BSP**: catálogo de MDL instalados, búsqueda, vista previa 3D existente, aplicar a entidad puntual o colocar `item_generic` en una superficie. No modifica archivos MDL.
- Traducciones ES/EN/RU/KO/ZH/PT. Se conserva BSP Composition 2.1.2 y todas las herramientas existentes.
- TypeScript, sintaxis del servidor y 91/91 pruebas BSP aprobadas (incluidas 4 nuevas). Compilación web en Linux y verificación Windows/Sven Co-op pendientes.
- Guía: `docs/BSP_EDITOR_VISUAL_PREVIEW_2_ES.md`.

---

## v1.9 — Editor BSP visual, Preview 1 (11 noviembre 2026)

- Primer modo de **edición visual de entidades puntuales y NPC** integrado directamente en el Visor BSP, independiente de las tres pestañas de Recuperación BSP. La versión de aplicación sigue siendo `1.9.0`.
- Selección 3D de entidades, gizmo G para desplazamiento XYZ y R para yaw, edición de keyvalues con confirmación al terminar, búsqueda e inspector lateral.
- Añadir desde el FGD `PointClass` existente, duplicar y eliminar entidades puntuales, Ctrl+Z/Y, historial limitado a 80 operaciones, restablecer, y exportar **copia BSP** verificada.
- La geometría compilada original y sus lumps de lightmaps/VIS/clipnodes no se editan. Entidades de submodelo `*N` bloqueadas para transformación. No hay simulación de IA ni recomputación de luz.
- Vista previa rápida basada en el mapa original; modelos MDL opcionales siguen posiciones editadas cuando sus recursos están disponibles, sin recargar el modelo si solo cambia su posición.
- Traducciones ES/EN/RU/KO/ZH/PT. Se conserva BSP Composition 2.1.2 con sus correcciones WAD3/lightstyles.
- Pruebas unitarias nuevas y regresiones BSP, TypeScript, sintaxis del servidor. **Pendiente:** prueba real de la interfaz y archivos exportados en Windows/Sven Co-op.
- Instrucciones: `docs/BSP_EDITOR_VISUAL_PREVIEW_1_ES.md`.

---

## v1.9 — BSP Composition 2.1.2 (lightstyles sin lightmap, 11 noviembre 2026)

- Corrección del bloqueo `Invalid face lightstyle array` observado tras resolver `halflife.wad` en la transferencia binaria de `func_door`.
- Las caras sin estilos activos (`255,255,255,255`) no intentan copiar lightmaps aunque el BSP origen conserve un `lightofs` residual; en el submodelo nuevo se normaliza ese offset a `-1`. Las caras iluminadas preservan sus datos.
- Los estilos inválidos con huecos o los offsets fuera de rango siguen rechazándose; diagnóstico de cara/valores con traducciones ES/EN/RU/KO/ZH/PT y contador de ajustes en el informe.
- Regresiones específicas de iluminación sin lightmaps y caso conjunto WAD3 + estilo ausente; **77/77 pruebas BSP** y TypeScript aprobados.
- Pendiente: comprobación con los BSP originales del usuario y ejecución real en Sven Co-op. Proyecto completo sin `node_modules`, semver `1.9.0`.
- Informe: `docs/VALIDACION_BSP_COMPOSITION_2_1_2_LIGHTSTYLES_ES.md`.

---

## v1.9 — BSP Composition 2.1.1 (corrección de texturas WAD3 externas, 11 noviembre 2026)

- Corregido el bloqueo reproducido al transferir puertas compiladas cuando el BSP fuente usa una textura externa como `-0babtech7` no registrada en el destino, aunque los mapas se hubieran compilado usando el mismo WAD.
- Nuevo selector opcional de archivos WAD3 dentro de la transferencia binaria: resuelve por nombre/dimensiones, comprueba mipmaps/paleta, incrusta únicamente las texturas necesarias en la **copia** del BSP, sin modificar archivos de origen/destino o WAD.
- Rechazos explícitos por textura ausente, WAD comprimido o malformado, dimensiones incompatibles y definiciones ambiguas; contador de texturas recuperadas desde WAD3.
- Mensajes y etiquetas nuevas traducidas al español, inglés, ruso, coreano, chino y portugués. Conserva pestañas e interfaz v1.9.
- Pruebas específicas agregadas y suite BSP de regresión. Sigue pendiente la verificación de esta copia en Sven Co-op real.
- ZIP de desarrollo completo sin `node_modules`; versión de la aplicación sigue siendo 1.9.0.

---

## v1.9 — BSP Composition 2.1 (primera transferencia binaria de submodelos, 10 noviembre 2026)

- Nueva operación independiente en la pestaña «Composición BSP»: trasplantar **un** submodelo `*N` compilado (puerta/plataforma), sin MAP intermedio ni recompilación. No transfiere el mundo ni modifica BSP originales.
- Reindexación de caras, planos, vértices, texinfo, texturas incrustadas compatibles, lightmaps RGB, nodos, hojas, marcas de superficie y hulls/clipnodes; lectura de validación tras escribir.
- Selección de entidad fuente, análisis previo, resumen numérico, rechazo de casos no compatibles, confirmación y descarga de copia. Localización de la nueva interfaz a ES/EN/RU/KO/ZH/PT; se conservan las tres pestañas.
- Límites de 64 MiB por BSP de entrada, 2.048 caras, 8.192 nodos por clase; sin offset XYZ, PVS del mundo, fusión `worldspawn` ni entidades enlazadas.
- Pruebas automáticas con geometría de fixture BSP30 compilado; falta validar modelos reales dentro de Sven Co-op en Windows. Detalles en `docs/BSP_COMPOSITION_2_1_SUBMODELOS_BINARIOS_ES.md`.
- Entrega **de desarrollo**: ZIP completo sin `node_modules`, no distribución GitHub con dependencias. Semver se conserva en `1.9.0`.

---

## v1.9 Hotfix — Inicio del visor 3D y reparación UV (11 noviembre 2026)

- Corregido un desacuerdo entre los umbrales de reconstrucción de los ejes UV que podía lanzar `Unable to create a valid tangent UV basis for this face` durante el inicio del viewport 3D.
- Los ejes problemáticos se reparan sin modificar el brush ni los datos del proyecto; se conserva el desfase de textura en el punto de referencia.
- Añadidas pruebas de regresión para el caso concreto, la calidad de la base UV y la conservación de offsets.
- No se alteran las herramientas de edición, la interfaz, los seis idiomas, el lanzador portátil ni las opciones de compilación.
- La ejecución real del visor con los datos locales del usuario queda pendiente de comprobar en Windows.

---

# SvenStudio 3D v1.9 — Consolidación portable

- Consolidación de World Builder Studio, Brush Workshop 3D, Smart Brush Fusion y Universal Placement 3D a partir de la cadena v1.9.2 → v1.9.7 Preview 3, sin crear estudios duplicados.
- Ayuda actualizada y localizada en ES/EN/RU/KO/ZH/PT, incluidos los controles de colocación y herramientas de geometría.
- Interfaz e iniciador identificados como v1.9; paquete semver interno 1.9.0.
- Documentación e instrucciones históricas movidas a `docs/` y `docs/Historial/`, sin archivos LEEME sueltos en la raíz.
- Se mantienen los `node_modules` Windows y el sistema de Node.js local descargado solo cuando falta.

---

## v1.9.7 Preview 3 — Geometry Refinement / World Builder integrado (10 noviembre 2026)
- **World Builder Studio:** la curva paramétrica y la repetición radial se organizan en una nueva pestaña interna «Curvas y repeticiones», sin abrir el antiguo estudio de curvas por separado.
- **Sin generadores duplicados:** carreteras, puentes, túneles y rampas nuevos utilizan el generador de recorridos de World Builder. La repetición radial conserva su utilidad para copiar brushes existentes alrededor de un arco.
- **Compatibilidad con proyectos anteriores:** las curvas paramétricas de Preview 1/2 siguen almacenadas como `curveAssemblies` y pueden editarse o desvincularse con la selección original; no se eliminan ni se convierten automáticamente.
- **Reutilizar rutas:** en Recorridos y estructuras se puede cargar una ruta guardada y copiar sus puntos a un recorrido NUEVO con otro tipo de estructura, sin modificar el original ni duplicar identificadores ferroviarios.
- **Accesos:** el menú contextual y Modelado/CSG llevan a World Builder → Curvas y repeticiones, no a un segundo estudio de curvas. Brush Workshop y Smart Brush Fusion permanecen como herramientas generales del editor.
- **Interfaz:** controles existentes del World Builder, tamaños legibles y distribución adaptativa; traducciones ES/EN/RU/KO/ZH/PT.
- **Seguridad:** no cambia el formato de proyecto, geometría MAP, compiladores, BuildTogether, Universal Placement, runtime ni node_modules.
- **Alcance:** no incorpora todavía Loft Builder, deformación libre de pasillos, unión automática de bifurcaciones T/Y ni una optimización automática de geometría. Es reorganización funcional y reutilización de rutas existentes.

## v1.9.7 Preview 2 — Brush Workshop 3D y perfiles precisos (10 noviembre 2026)
- Brush Workshop incorpora visor 3D independiente, orbitable y con vistas orientadas; ya no depende solamente de la proyección 2D que se veía desde abajo.
- Vista 3D del resultado real CSG antes de aplicar, con opción de comparación del sólido original y selección de cara desde la vista.
- Dibujo 2D conservado como pestaña para trazar sobre la cara seleccionada con precisión.
- Nuevos perfiles rectángulo/círculo/elipse/polígono regular/rectángulo redondeado y control de calidad de 3–64 segmentos según la forma.
- Paneles, recortes, rebajes, marcos y huecos con marco funcionan con perfiles poligonales convexos GoldSrc; validación antes de modificar el mapa.
- Interfaz amplia y controles grandes, traducciones de los seis idiomas; sin modificar Universal Placement, World Builder ni el runtime portable.
- Se conservan por compatibilidad las curvas paramétricas de Preview 1 mientras se migra la organización de World Builder.

# SvenStudio 3D v1.9.7 — Advanced Geometry (Preview 1)

- **Smart Brush Fusion (editor general):** fusiona varios brushes en un único sólido cuando la unión es convexa y las texturas/UV son uniformes; si no, crea un objeto compuesto seleccionable y desplegable en el Explorador, sin rellenar huecos ni eliminar piezas. Permite separar y restaurar los grupos previos. Valida compatibilidad de entidades, visibilidad, bloqueo y procedencia de la geometría.
- **Brush Workshop:** edición de una cara en un panel amplio; dibujar rectángulos, añadir panel sobresaliente, hacer rebajes, abrir huecos pasantes y crear marcos; validación convexa de cada resultado, vista previa 2D, Undo/Redo por operación. Los detalles de una entidad de brushes siguen unidos a la misma entidad.
- **Advanced Curved Geometry:** rampas/puentes en arco y espiral (prismas triangulares cerrados y planos), repetición radial de brushes existentes, elevación por recorrido y parámetros guardados que permiten regenerar la rampa mientras la geometría no haya sido modificada manualmente.
- **Sin estudios duplicados:** accesos en Modelado/CSG y menú contextual de brushes. Traducciones principales ES/EN/RU/KO/ZH/PT. Sin modificar BuildTogether, World Builder, BSP Viewer, la colocación universal, runtime ni dependencias.
- **Alcance:** no se incluyeron todavía Loft Builder, uniones T/Y automáticas, deformación libre de una estructura existente ni edición no destructiva de un historial de recortes. Son mejoras posteriores; el MAP exporta brushes convexos convencionales.

## v1.9.6 — Universal Placement 3D: Free Space + Camera Control (2026-11-10)

- **Libre 3D real:** rayos desde la cámara, con profundidad ajustable 32–8192 unidades; no depende del plano Z ni de los brushes existentes.
- Tres modos principales: Superficie, Plano Z y Libre 3D. Ajuste a objeto y altura relativa siguen en controles avanzados sin duplicar menús.
- Alt + rueda cambia profundidad en el visor; Shift + rueda cambia altura del plano o desplazamiento relativo. Rueda sola mantiene el zoom habitual.
- **WASD:** los botones no conservan el foco del navegador; campos numéricos devuelven el foco con Enter.
- RMB corto cancela; RMB arrastrado conserva el control de la cámara. Escape cancela los modos de colocación.
- Posicionamiento opcional en dos pasos: primer clic congela la vista previa, edición XYZ, segundo clic utiliza la misma operación original para colocar el objeto. Cancelación limpia sin historial extra.
- Visor sin control Z flotante; el cursor mantiene el último punto válido al pasar por la interfaz.
- Compatibilidad con formas, prefabs, World Builder, Blueprint, luces, sonidos, NPC y recorridos; puertas y decals siguen sujetos a superficies.
- Localización ES/EN/RU/KO/ZH/PT. La preferencia previa de modo permanece, pero una colocación provisional no se restaura tras reiniciar el navegador.

# v1.9.5 — Universal Placement 3D: usability hotfix

- Rediseño del panel universal de colocación: compacto, dos modos principales (superficie/plano de trabajo), ajuste Z numérico y opciones avanzadas desplegables.
- Vista previa más estable con respaldo cuando un rayo de cámara no intersecta el plano de altura. No se oculta simplemente al pasar el cursor sobre las herramientas flotantes.
- Eliminado el botón `⇅ Z` que seguía al cursor y tapaba la selección.
- Clic derecho y Escape cancelan todos los modos universales de colocación desde un mismo controlador, sin alterar geometría o historial. Botón explícito cancelar.
- Doble clic ya no selecciona los textos de overlays del visor mientras una colocación está activa; entradas numéricas siguen editables.
- Traducidos nuevos controles a los seis idiomas. Compatible con proyectos v1.9.4 y sistema portable.

# SvenStudio 3D v1.9.4 — Universal Placement 3D (10 noviembre 2026)

- Motor compartido en el editor MAP para ubicar shapes, prefabs, terrenos, rocas, rutas, Blueprint, NPC/waypoints, cine, iluminación, sonidos y recursos arrastrados desde la biblioteca, conservando las acciones de confirmación originales.
- Modos: sobre superficie, sobre grilla, libre 3D, ajuste a vértices/bordes/cara real y altura relativa Z.
- Plano de trabajo Z configurado y hasta 12 niveles guardados. Puede colocarse por encima o debajo de la grilla global sin modificarla.
- Panel del visor compacto y expandible, campos XYZ exactos, +/- de altura, copia de posición seleccionada y botón 3D vertical de altura arrastrable con control de teclado.
- Controles localizados ES/EN/RU/KO/ZH/PT. No modifica World Builder Studio, Map Packager, BuildTogether ni la jerarquía de los demás estudios.
- Las puertas/ventanas y decals conservan su requisito de una superficie válida para no crear geometría inválida.
- Pruebas de motor, integración con editor MAP, TypeScript y regresión seleccionada; aún requiere validación visual final en Windows/Sven Co-op.
- Instalación mediante un parche incremental sobre v1.9.3; sin node_modules, sin cambios al runtime o al BAT portable.

# SvenStudio 3D v1.9.3 — Smart World Building (incremental)

- World Builder Studio > Recorridos y estructuras: panel grande de **Integración inteligente**.
- Caminos y pasarelas que siguen el terreno seleccionado, adaptan suavemente vértices y muestran la geometría final en el visor 3D. Usa muestreo exacto de triángulos y diagonales.
- Cuevas sobre terreno **Superficie delgada**: accesos por celdas retiradas y paneles de techo abiertos solo en los extremos. **No** realiza operaciones booleanas sobre brushes sólidos ni sella automáticamente el mapa.
- Guarda terreno + ruta en una sola operación deshacible del editor MAP. Firmas protegidas para evitar sobrescribir brushes modificados o bloqueados.
- Relación persistente entre terreno y recorrido: evita editar un lado por separado y dejar la integración rota. Sin modificar rutas anteriores.
- Nuevo metadato opcional `excludedCells` en terrenos y `surfacePortals`/`integratedTerrainId` en rutas, con validación y compatibilidad retroactiva.
- World Builder mantiene rocas, acantilados, rutas, ferrocarriles, BuildTogether, Empaquetador y el resto de estudios sin modificaciones funcionales.
- Controles del panel de integración con tamaño mínimo 47 px, mensajes de validación y soporte multidioma.
- Cobertura de pruebas de geometría convexa, round-trip Valve 220, Undo y proyectos existentes.

**Limitaciones:** las cuevas en v1.9.3 crean entradas verticales en capas delgadas; no excavan macizos sólidos, no generan rampas/escaleras automáticamente y no garantizan sellado VIS. Se deben comprobar los accesos, colisiones y fugas en Sven Co-op. Los recorridos ligados se protegen contra ediciones independientes hasta disponer de una edición sincronizada.

---

## v1.9.2 — World Builder Studio: Advanced Terrain & 3D Workspace (2026-11-10)

- Fusiona el nombre **World Builder Studio** en los menús y el visor, traducido a español, ruso, coreano, chino y portugués (inglés por defecto).
- Rediseño de trabajo: lienzo de terreno más grande, panel de propiedades plegable en modo concentración, accesos rápidos a secciones, botones amplios y vistas de cámara en perspectiva/superior/lateral.
- Esculpido y navegación simultáneos: arrastre izquierdo esculpe, derecho orbita, medio desplaza y rueda acerca. El modo inspección mantiene su navegación independiente. Cursor circular de radio del pincel.
- Edición de vértices con marcadores grandes, cambio preciso de altura y Undo/Redo. Cambio de diagonal de cada celda persistido en el proyecto y usado también en la exportación Valve 220.
- Nuevas formaciones de superficie (crestas, cauces, escarpes), deterministas y dentro de ±512 unidades, combinables con heightmaps y los 9 generadores anteriores.
- Nueva estructura Cave Tunnel de recorrido 3D (piso plano, sección arqueada, brushes convexos cerrados). Las entradas deben conectarse manualmente: no excava automáticamente brushes adyacentes.
- Se conservan el terreno de base sólida/delgada, rocas, recorridos, vías, tuberías, BuildTogether, compilers y el resto de estudios, sin alterar Workspace global.
- Nuevas pruebas de triangulación, persistencia, MAP roundtrip y construcción de túneles. No se añaden mallas abiertas incompatibles.

## v1.9.1 — World Builder: Thin Surface & Base Modes (HF1)

- Nuevo generador de terreno con **superficie delgada** (16u iniciales) y caras ocultas NULL; brushes cerrados y convexos GoldSrc, no superficies abiertas.
- Se conserva **base sólida** original; nuevo modo **base personalizada** con comprobación del fondo mínimo.
- Vista previa exacta de las superficies superiores e inferiores, selector visual grande y campos accesibles.
- Terrenos anteriores sin `baseMode` continúan en modo sólido sin alteraciones automáticas.
- Rocas, acantilados, vías, tuberías y soportes conservan su volumen; caminos/pasarelas mantienen su espesor existente.
- Validación de metadatos en proyectos guardados, pruebas de mapa Valve 220 y compatibilidad con Undo, BuildTogether y sistema MAP.

## SvenStudio 3D v1.9.0 — World Builder (2026-11-10)
- Fusiona el estudio existente «Terrenos y geometría» bajo el nombre World Builder, sin duplicar paneles ni modificar el editor MAP.
- Conserva Terrain Sculpt, Rock & Cliff Generator, Road & Structure Studio, rutas y ferrocarriles guardados, WAD, UV, Undo MAP y BuildTogether.
- Generador reproducible de 9 paisajes (plano, colinas, montañas, valle, cañón, isla, cráter, dunas, meseta), con semilla y altura configurables.
- Importación de mapas de altura PNG/JPEG/WebP con escala configurable e inversión de colores; exportación de mapa de altura PNG.
- Operaciones de alturas: suavizado, terrazas, centrado, simetría X/Y, giro 90°, deshacer/rehacer alturas y pinceles de esculpido agrupados por trazo.
- Vista previa no destructiva; se mantiene exportación Valve 220 mediante brushes convexos válidos y validación antes de aplicar.
- UI aislada más grande, propiedades accesibles, scroll independiente, fullscreen opcional en todas las pestañas, controles/hit targets ampliados, diseño adaptable y traducciones.
- Pruebas automatizadas de paisajes, MAP export/import, transformaciones, raster y regresión de herramientas existentes.
- Limitaciones: heightmap representa una superficie de terreno sólido, no cuevas perforadas ni agua simulada. El agua sigue en Material & Surface Studio. Recursos externos se cargan desde el navegador WAD.

## SvenStudio 3D v1.8.16 — Map Packager 2.0 (2026-11-10)
- Expande el Empaquetador de mapas existente: no se añade un estudio duplicado.
- Nuevo generador automático de maps/<map>.res para las dependencias descargables seleccionadas que efectivamente se incluyen en el ZIP.
- Excluye BSP, CFG, AngelScript, recursos de la instalación oficial y recursos faltantes del RES; los archivos del servidor se mantienen en el paquete para instalación manual.
- Previsualización RES sensible a selección y opción de desactivarlo. El RES anterior solamente se sustituye dentro del ZIP; no cambia ningún fichero instalado.
- Localización segura y diagnóstico de diferencias entre mayúsculas/minúsculas en rutas; el ZIP usa la ruta referenciada para funcionar en servidores Linux.
- Conserva los límites y controles de seguridad del empaquetador, sin tocar compiladores, MAP, BSP Viewer, Custom NPC Importer ni BuildTogether.
- La detección de recursos sigue siendo estática: eventos de audio dentro de MDL, recursos dinámicos de AngelScript y restricciones de distribución requieren inspección adicional.

## SvenStudio 3D v1.8.15 — Hammer / SvenCraft Project Importer

- Importación directa de archivos binarios RMF (Worldcraft / Valve Hammer / SvenCraft 1.4, 1.6, 1.8 y 2.2) desde Archivo.
- Importación de brushes, entidades, worldspawn, planos y alineación de texturas mediante validación del motor MAP existente.
- Recuperación de grupos, VisGroups, cámaras, rutas, parámetros de caras y metadatos originales en el proyecto SvenStudio.
- Resumen previo a la importación y rechazo seguro si se detecta geometría no reconstruible; no se sobrescribe el proyecto actual por error.
- El editor MAP, Blueprint to Map, BuildTogether, BSP Viewer y demás estudios se mantienen sin cambios funcionales.
- Más información y limitaciones: `docs/HAMMER_SVENCRAFT_PROJECT_IMPORT_V1815_ES.md`.

# v1.8.14 Preview — Multi-Level Building, Smart Wall Visibility y Escaleras

- Blueprint to Map: hasta seis plantas con alturas propias y trazados editables independientes.
- Escaleras paramétricas rectas con controles 2D/3D y hueco real en las losas que atraviesan.
- Cubiertas de una o dos aguas para habitaciones superiores rectangulares.
- Vista 3D: ocultación o transparencia automática de muros exteriores frente a la cámara.
- Se conserva inspector HF4 sin compactar ni duplicar paneles; selector de plantas en barra separada.
- Compatibilidad con proyectos HF4; persistencia independiente y Undo/Redo completo.
- MAP de dos plantas y pruebas de regresión. Pendiente de prueba real en Windows y juego.

---

## v1.8.13 HF4 — Blueprint to Map: Inspector adaptable y ajuste vertical de aberturas (Preview)

- Panel derecho organizado en pestañas **Habitaciones**, **Propiedades** y **Conexiones** con controles grandes y desplazamiento independiente. La lista de habitaciones ya no comparte un scroll reducido con los vértices, las puertas y la reparación de conexiones.
- Las propiedades presentan vértices en un desplegable opcional, por lo que las aberturas permanecen accesibles incluso con muchas habitaciones.
- Puertas y ventanas ahora tienen controles **Subir / Bajar** (8 unidades por clic), campo **Altura desde el suelo Z** y un tirador violeta para arrastrarlas verticalmente desde la vista 3D.
- El desplazamiento vertical conserva el ancho y alto del hueco, salvo que un documento previo incumpla los límites del muro. Se impide atravesar el suelo o el techo.
- Guardado, importación/exportación `.svenblueprint.json`, sincronización de muros compartidos, MAP Valve 220 y edición 2D/3D se mantienen compatibles.
- Pruebas de exportación/reimportación MAP y geometría convexa. Prueba real en Chrome Windows y compilación BSP siguen pendientes.

## v1.8.13 HF3 — Blueprint to Map: Smart Wall Connections (Preview)

- Unificación geométrica de muros colineales compartidos entre habitaciones (también parcialmente solapados e invertidos).
- Encuentros T/X recortados, puertas comunes unificadas y detección de aberturas incompatibles.
- Ajuste magnético a vértices y ejes; marcadores verdes de paredes compartidas en 2D.
- Previsualización de reparación de uniones desalineadas, aplicar/cancelar, integración Undo.
- Conservación de documentos HF2 y archivos `.svenblueprint.json`, protección de brushes modificados y mapa MAP Valve 220.
- Pruebas automatizadas; Chrome Windows y compilación Sven Co-op pendientes de validación real.

## v1.8.13 HF2 — Blueprint to Map: edición 3D y planos reutilizables (Preview)

- Cierre no bloqueante y guardado de borradores con errores de geometría; la validación estricta se mantiene al generar.
- Editor 3D con tiradores de ancho, alto y posición para aberturas, sincronizado con el plano 2D; 3 modos 2D / 3D / dividido y techos ocultables.
- Auto Snap para aberturas y reparación asistida de huecos mal colocados; sincronización de cambios entre muros coincidentes cuando corresponda.
- Exportar, importar y duplicar planos editables, incluidos planos ya terminados y generados. Formato independiente `.svenblueprint.json` con imagen y trazados, sin identificadores externos.
- Inspector de margen a esquina y ancho disponible; advertencia de puertas demasiado bajas.
- 7 pruebas nuevas de HF2, además de las regresiones de Blueprint, misiones, NPC, puzles y Railway.
- Windows / juego: requieren comprobación práctica antes de considerar HF2 estable.

## v1.8.13 HF1 — Blueprint to Map: correcciones de calibración, colocación y guardado

- Evita un fallo fatal de React cuando la calibración recibe puntos inválidos: validación previa a setState y mensaje local.
- Añade Guardar plano (metadatos sin geometría), recuperación del último documento y guardado al cerrar.
- Añade Colocar en mapa mediante un fantasma 3D, con anclaje de centro de trazado y altura de superficie.
- Mejora colocación de puertas/ventanas y sincroniza huecos en paredes compartidas; marcador arrastrable y control de posición.
- Mantiene validación convexa, protección de ediciones manuales, Undo/Redo y estudios existentes.

# SvenStudio 3D — Changes

## v1.8.13 Preview — Blueprint to Map

- Add a new standalone visual blueprint tracing Studio with PNG/JPG/WEBP references, two-point scale calibration, grid snapping, 2D pan/zoom and 3D preview.
- Draw free-angle walls, closed polygon or rectangular rooms, geometric doors/windows (no entities), floors and ceilings. Closed, convex solids are prevalidated for Valve 220; concave floors use convex decomposition.
- Persist editable image and layout metadata; safe provenance-preserving rebuild, detach, remove and one-step map Undo/Redo.
- Add demo reference image, MAP, editable JSON project, WAD and roundtrip report. Vehicle Builder remains removed.
- Build and game tests on Windows/Sven Co-op are still required.


## v1.8.12 Preview — Advanced Co-op Gameplay

- Co-op Puzzle Builder: native func_button consoles, one-shot game_counter puzzles, timed simultaneous multisource inputs, and one-shot relay completion for missions, events and door targets.
- Editable XYZ console placement, six locales, integrated reference audit, project-save metadata validation, provenance signatures, safe detach/remove, and one-step Undo/Redo.
- Encounter Director planning data inside existing NPC & AI Studio. Static diagnostics cover mission/event references, loops and NPC spawn restrictions, without claiming to simulate AI.
- Add a new 3-stage combined Valve 220 MAP + editable project + WAD demo, with two puzzles, 3-wave combat, timed extraction and native alarms.
- No changes intended to Architecture, BuildTogether, True Lighting, Terrain, Railway or launcher. Vehicle Builder remains removed.
- The demo must still be compiled and played with Sven Co-op to verify actual engine behavior.

## v1.8.11 Preview — Smart NPC Encounters 2.0

- Extend existing NPC & AI Studio with a dedicated encounter editor; no separate duplicate Studio.
- Native sequence generation: `squadmaker` with `trigger_condition=4`, death-counted `game_counter`, `multi_manager`, optional `trigger_once` entry brush and HUD notifications.
- Defense/ambush/mixed presets; up to 8 waves, adjustable NPC type/count/max-live/health/weapon/intervals and up to four spawn XYZ locations per wave; waypoint/guard options.
- Connect wave start events to Dynamic Events Studio and finish signals to Mission & Campaign objective relays / existing map targets.
- Strict project metadata validation, targetname collision checks, cross-studio reference protections, non-destructive detach, one-operation Undo/Redo, manual-edit protection.
- Add a packaged **Valve 220 MAP and editable SvenStudio project** containing a sealed industrial arena, equipment lobby, three enemy waves, Mission objectives, alarms, door and extraction.
- Six localized UI languages; preserve previous terrain, railway, lighting, BuildTogether, Architecture Mode and portable Windows launcher. Vehicle Builder stays removed.
- GoldSrc note: blocked squadmaker spawn points or bodies counted toward the active-monster limit can stall waves. Validate gameplay/compilation with installed Sven Co-op SDK; no native game execution was available in this environment.

## v1.8.10 Preview — Mission & Dynamic Events 2.0

- Editable native mission success/failure branches with bounded activation counters (`game_counter`), optional-stage annotations and dedicated external failure relays.
- Deterministic in-editor mission logic inspector; explicitly **not** gameplay emulation.
- Map target picker with temporary non-blocking toolbar; existing object `targetname` only, no implicit mutation.
- Timeline handles support pointer drag and keyboard nudge, duplicate cues and records, shift all cues, and inspect missing targetnames.
- Reject indirect event-trigger cycles and invalid mission route cycles; warn on unreachable objectives and missing external targets.
- Block removal or regeneration when externally authored connections would be broken; preserve detachment and one-step MAP Undo/Redo.
- Retain the 1.8.9 project format with optional metadata fields and keep the full existing browser editor and Windows portable runtime.
- Preview requires real Chrome/Windows and Sven Co-op gameplay verification. Does not count unique players or create AngelScript/checkpoints.

## v1.8.9 Preview — Mission & Campaign + Dynamic Events Studio

- New objective-based mission editor: ordered stages, HUD notices, first objective auto-start, completion relays, event sequence linkage, and optional final target.
- New timeline editor: multi_manager actions with seconds, Toggle/On/Off/Kill, existing targetname picker, timeline inspection and event templates (alarm, reinforcements and reactor).
- Generates standard Sven Co-op map entities, no mandatory script dependencies, using verified native entity classes.
- Editable project metadata, strict validation, protected regeneration, delete/detach with safeguards, full MAP history Undo/Redo.
- Embedded language support for ES/EN/RU/KO/ZH/PT, Help and menu entries updated.
- Experimental: real Sven Co-op entity behavior, asset effects and gameplay completion require in-game testing. No automatic checkpoints or mission-state gating.
- Vehicle Builder remains removed. The existing architecture, terrain, railway, lighting, compilation and collaboration modules are not intentionally changed.

## v1.8.8 HF1 — Vehicle Builder removal (Preview)

- Removed the Vehicle Builder introduced in v1.8.8 after its geometry did not meet the desired quality.
- This build is restored from the v1.8.7 code baseline, with no Vehicle Builder menu item, component, generator, project serializer or translations.
- Preserved Railway Builder 2.0, Path & Structure Studio, optimized terrain, True Lighting, SDHLT integration and the Windows launcher.
- **Compatibility:** vehicle-generated brushes in an older saved project remain normal brushes, but their parametric vehicle controls are no longer supported. Backup projects before switching.
- Preview only: native Windows launch and in-game compile tests still recommended.

## v1.8.7 — Railway Builder 2.0 (Preview)

- Added native **path_track** chains sampled along existing rails (including curves and slopes), with valid `target` / `targetname` links.
- Optional experimental **turnout**: additional rail branch, `altpath` on the junction node and a `func_button` to toggle the branch. Junction geometry and collision must be checked after compilation.
- Optional second parallel railway with configurable separation. Parallel rail geometry is decorative and does not yet have an independent path_track chain.
- Station platforms with configurable side, size, control point and optional `newspeed 0` stop. Stations do not automatically terraform the terrain.
- Optional **func_tracktrain** brush template, **ORIGIN** brush and **func_traincontrols** volume; player train starts stopped with speed and size settings.
- Approximate 3D train-position slider for inspecting route curvature. It is *not* an in-game physics simulation.
- Native railway entities and generated brushes are stored with route metadata. Updating a route safely replaces both; manually modified entities or brushes block destructive regeneration. Undo/Redo is a single map history action. Network names are checked for collisions.
- Localized railway settings in EN / ES / RU / KO / ZH / PT. Added project-format bounds checks and directed MAP export/import and route persistence tests.
- Existing roads, terrain, pipes, cables, bridge, Architecture Mode, BuildTogether, lighting and compilers are not changed.
- **Experimental:** no fully collision-clean curved railway turnout, automatic train path reversing, advanced signaling or complete player-tested train behavior. Validate BSP and train operation in actual Sven Co-op before release.

## v1.8.6 HF1 — Terrain & Shape Studio startup fix

- Fixed a React/Zustand 5 render loop when opening Terrain & Shape Studio in maps that do not yet have saved path structures.
- The missing `pathGroups` fallback now uses a stable, shared empty snapshot instead of allocating a fresh array on every store read.
- Keeps saved routes reactive; no changes to path geometry, 3D controls, road tools, cable settings, compiler paths, or project file format.
- Regression tests added for existing and absent path groups.

## v1.8.6 — XYZ Pipes, Ventilation & Cable Builder (Preview)

- New true-3D sweep frames for **octagonal hollow pipes** and **rectangular hollow ventilation ducts**. Sections follow the XYZ route, including vertical sections and rising turns. This changes only the pipe/vent generator; roads, railway, fences, and bridges keep the previous algorithm.
- Convex decomposition for twisted wall sections: fallback into planar tetrahedral brushes when a standard closed panel is not a valid MAP solid. Confirmed in automated Valve 220 export/reimport tests. This can increase brush counts, so a hard safety limit prevents excessively complex routes from being added.
- New **Suspended cables (3D)** mode with adjustable cable diameter, parabolic sag between selected anchor points, 1–4 parallel cables and controllable spacing. The drop is a design approximation, not a simulated physical catenary.
- New settings in Path & Structure Studio with six localized interfaces; switching to 3D structures opens the 3D preview. Saved route settings retain the new parameters, and the existing MAP click-placement / Undo / regeneration safeguards remain.
- Added dedicated 3D sweep tests (valid brushes, import/export round-trips, vertical segments, bends, multi-strand cables and invalid input).
- **Still experimental:** sharp or highly detailed XYZ paths may exceed brush limits; some more complex path intersections, T/Y pipe junctions, pipe flanges, attachment points and fully realistic cable physics are not implemented in this preview. Confirm visual seams, in-game collision, textures and compiler compatibility in Sven Co-op.

## v1.8.5 — Path & Structure Studio (Preview)

- Added direct 3D control-point editing in the **3D geometry preview**. Select orange handles, move in XY, X, Y or Z, use green intermediate handles to insert points, then verify the geometry before placement.
- Added **Railway Track** (parallel rails and sleepers), **Fence & Barrier** (posts and horizontal rails), and **Bridge & Catwalk** (deck, edge rails, supports) modes. These generate real convex brushes; tracks are *visual geometry*, not working train entities.
- Saved path metadata in the SvenStudio project so a generated route can be loaded, edited and safely regenerated. Added **Edit saved route in MAP** for modifying the same route directly within the map viewport with pointer handles and axis constraints. If individual source brushes were changed or deleted, a signature guard prevents accidental replacement. The original MAP export remains normal Valve 220 geometry.
- Preserved the v1.8.4 large 2D editor, elevation profile, map-click placement, and route-local Undo/Redo.
- New interface labels translated to Spanish, English, Russian, Korean, Simplified Chinese and Brazilian Portuguese.
- Does **not** yet include train movement logic, railway switches, railway junctions, 3D vertical pipe elbows, or direct in-MAP gizmos; these require separate compatibility and geometry work.

**Preview: Windows Chrome visual interaction and actual Sven Co-op compilation still require user testing. Keep v1.8.4 as a backup.**

## v1.8.4 — Route Editor UX Preview

- Expand terrain studio to nearly fullscreen; focus mode hides settings while editing paths.
- Fit-to-route, wheel zoom at cursor, middle-button or Shift+drag pan, adaptive canvas coordinates, visible unit grid and cursor readout.
- Expandable elevation profile; existing route history and geometry generation remain unchanged.
- Removed immediate Apply at X/Y/Z for new roads, ventilation paths and rock clusters; use placement by clicking on the MAP viewport. Existing terrain can still be updated in place.
- UI strings in six supported locales.

**Preview** — mouse interaction must be verified in Windows Chrome before publishing as stable.

## v1.8.3 — Path elevation editing (Preview)

- Added a linked elevation profile for Paths & Ventilation. The overhead plan edits X/Y; the draggable profile edits Z in 8-unit increments.
- Added route-local Undo/Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`) and visible buttons, with one history entry per point drag.
- The 3D geometry preview reflects route changes. Invalid brushes remain blocked by the existing Valve 220 MAP round-trip validation.
- No changes to Architecture Mode, SDHLT/SC compilers, BuildTogether, or the Windows launcher.

## v1.8.2 Preview — Roads & Ventilation rework

# SvenStudio 3D v1.8.2 — Preview de Road Builder y Paths & Ventilation

## Cambios
- Se reemplazó el ensamblado de rectángulos independientes por secciones de carretera con bordes compartidos y uniones tipo miter.
- Curvas suavizadas con interpolación centrípeta y subdivisión por distancia/curvatura.
- Interfaz para arrastrar puntos de control, añadir/eliminar puntos, ajustar alturas y alternar entre planta y vista 3D del resultado.
- Road Builder: calzada, bordillos y veredas opcionales. Los tramos rectos necesitan pocos brushes y las curvas utilizan subdivisiones.
- Paths & Ventilation: pasos elevados, conductos rectangulares huecos y tuberías octogonales (estas últimas todavía experimentales).
- La colocación en mapa conserva el botón de clic sobre superficie, coordenadas manuales y Undo.
- La confirmación bloquea los segmentos que no sobreviven la exportación/reimportación MAP Valve 220. No se insertan brushes inválidos deliberadamente.
- Se conserva Terrain Sculpt, Terrain Optimization, Architecture Mode, compilación SC/SDHLT, BuildTogether y Node local.
- Traducciones nuevas para español, inglés, ruso, coreano, chino simplificado y portugués.

## Limitaciones y validación pendiente
- Cruces en T/X/Y y conexiones de conductos ramificados no están implementados.
- Curvas muy cerradas, cruces propios o uniones de conductos que provoquen pérdida de brushes se rechazan con error; ampliar radio, separar puntos o reducir detalle.
- Algunos cambios de altura y codos complejos de conductos/tuberías están limitados por la geometría convexa de GoldSrc.
- Las UV pueden mostrar costuras en curvas; comprobar texturas en Sven Co-op.
- No se ha probado la compilación SC-CSG/SC-RAD en Windows ni la interacción gráfica real en Chrome en este entorno.
- Es una PREVIEW: conservar la v1.7.19 estable como respaldo y probar la nueva función en una copia de mapa.

## Prueba recomendada
1. Abrí Estudios > Terrain & Shape Studio > Paths & Ventilation.
2. Elegí Road Builder. Mové puntos naranjas en el plano y alterná con 3D geometry preview.
3. Configurá ancho, curva y veredas. Aplicá sobre mapa o por X/Y/Z.
4. Probá una calle en S, una curva de 90° amplia y una pendiente. Verificá dentro de Sven Co-op.
5. Repetí para conducto rectangular y tubería, evitando radios demasiado cerrados.


---

# SvenStudio 3D v1.8.1 — Preview (Paths Placement)

- Fixed Paths & Ventilation placement: the viewport now supports choosing where to place a generated path with a click.
- Click placement uses the existing terrain placement system, including grid snapping and Escape to cancel.
- Preserves the relative layout of control points and moves all generated brushes together.
- The original Apply at X/Y/Z placement remains available.
- Windows and in-game testing still required before considering this stable.

# SvenStudio 3D v1.8.0 — Preview (Terrain & Paths)

- Optional planar-cell optimization for new terrain; existing saved terrain retains legacy output.
- New Paths & Ventilation tab with editable control points, road/walkway and hollow rectangular duct generation.
- GoldSrc convex brush export, live brush count, translations for all six editor languages.
- Still experimental: corner joins, visual UVs, full runtime integration and Windows map compilation must be tested.

## v1.7.19 — Rama 1.7 / candidata estable (2026-11-09)

- Ayuda actualizada: True Lighting, SC-RAD/SDHLT, cámara libre y Escape/F8, funcionamiento portátil.
- Se unifican los indicadores de versión de la interfaz y el iniciador.
- Corregida la selección de `revision` en el panel BuildTogether (error de tipado; sin cambiar el protocolo).
- Documentación histórica y de instalación anterior archivada en `docs/historico/`, sin saturar la carpeta principal.
- La condición de versión estable requiere pruebas finales de Windows, compilación SC y SDHLT y sesión real de BuildTogether.

## v1.7.11 — Dock Flex Weight Fix (2026-11-08)
- Identificada la causa real del hueco de Propiedades: `flex-grow` guardado inferior a 1 en una zona con un solo panel (`0.864242` en la sesión real de Chrome).
- Los pesos de todos los paneles visibles en cada zona ahora se normalizan a suma 1; se conserva la relación de tamaño entre varios paneles.
- Solución única en `DockWorkspace`, sin modificar la estructura de Propiedades, scroll, datos FGD, brushes o protocolo BuildTogether.
- 38/38 pruebas Node dirigidas aprobadas. En Chromium se reprodujo el hueco de 98 px (vertical) y 150 px (horizontal) antes de normalizar y se eliminó después (salvo el borde de 1 px).
- Pendiente compilación completa Vite/TypeScript y validación en Chrome Windows.

## v1.7.10 — Properties dock / installation verification
- Un único Grid para la cabecera y el scroll de Propiedades; wrapper `.properties` sin caja de layout dentro del dock.
- Corregida la versión visible que seguía mostrando v1.7.8.
- El parche incremental ahora no incluye la carpeta raíz adicional `SvenStudio3D/` para poder extraerlo directamente sobre la instalación.
- No se modifican las entidades, FGD, BuildTogether ni la exportación MAP/BSP.
- Prueba real en Windows todavía pendiente.

## v1.7.9 — Propiedades ocupa todo el dock (2026-11-08)

- Corrección del **hueco vacío al pie de Propiedades** observado en Chrome para posiciones derecha e inferior (también compatible con izquierda y superior).
- El dock conserva su barra de título; el cuerpo queda anclado a `top/right/bottom/left`, mientras `Properties` usa dos filas: cabecera fija y una sola región de scroll que ocupa exactamente el alto restante.
- El desplazamiento vuelve arriba cuando cambia la selección. El dock inferior mantiene el formato de campos en varias columnas cuando hay suficiente ancho.
- No se modifican entidades, FGD, MAP Valve 220, BuildTogether ni otros estudios.
- Verificación: 52/52 pruebas Node dirigidas aprobadas. 8/8 comprobaciones visuales de geometría CSS en Chromium con 75 campos: scrollbar al borde inferior y botones finales accesibles. **Pendiente** el test de la aplicación React real en Windows y build Vite por dependencias npm no instaladas.

## v1.7.8 — Propiedades con scroll exterior (2026-11-08)

- Solución estructural nueva tras comprobar que v1.7.7 seguía dejando una franja vacía bajo la barra de desplazamiento del inspector en Windows.
- El **elemento `.dock-pane[data-pane="properties"]`** ahora es el único contenedor desplazable; se eliminó el scroll anidado y las alturas absolutas/grids internas del área de campos.
- La barra de título y la cabecera del inspector permanecen fijas con `position:sticky`; la barra de desplazamiento exterior llega físicamente al borde inferior del panel.
- Al cambiar de objeto seleccionado, el desplazamiento vuelve al principio del dock. Se mantiene un fallback para inspecciones fuera del dock.
- No se modificaron los valores FGD, las entidades, la compilación MAP, BuildTogether ni los demás estudios.
- Verificación: **55/55** regresiones dirigidas Node; **6/6** pruebas de disposición en Chromium usando la hoja CSS real y alturas/escala variadas. Verificación final en Chrome de Windows pendiente, porque la app React completa no pudo compilarse aquí por falta de dependencias npm.

## v1.7.7 — Properties Dock Layout Fix (2026-11-08)

- Corregido el espacio vacío de unos 100–130 px bajo la barra de desplazamiento de Propiedades observado en Windows al seleccionar entidades con FGD extenso.
- Eliminadas las reglas anteriores de Grid anidado y alturas al 100 % que podían limitar el área desplazable; el cuerpo del dock ahora queda anclado a sus límites y dispone de una única región de scroll flexible.
- Se conserva cabecera fija y la posición del panel; el final de la lista (incluidos Duplicar/Eliminar) debe seguir siendo accesible en ventanas estrechas y modos de interfaz compacta.
- Las mini guías y los campos FGD usan la misma región desplazable, sin cambiar sus datos, Undo/Redo, MAP Valve 220, Gameplay Studio ni BuildTogether.
- Verificación: 54/54 pruebas automatizadas dirigidas, 6/6 simulaciones de layout Chromium (600–1080 px y escalas 0.8–1.5). Pendiente comprobación real con React/Windows y build Vite por dependencias npm ausentes.

## v1.7.6 — Captura de cámara y scroll estructural de Propiedades (2026-11-08)

- **Cámara RMB:** restablecido el `requestPointerLock()` real tanto en pantalla completa como en ventana. El modo `setPointerCapture` introducido en v1.7.5 no confinaba ni ocultaba el cursor y permitía clics accidentales. Se conserva el movimiento alternativo cuando el navegador deniega Pointer Lock; la captura se libera al soltar RMB. Una respuesta tardía al permiso no deja el cursor bloqueado.
- **Menú contextual nativo:** `preventDefault()` en captura para todo el visor 3D, incluidos overlays dentro de `.viewport-frame`. Fuera del visor se conservan los menús de Chrome.
- **Propiedades:** reemplazadas las reglas contradictorias de alto automático/overflow visible con un grid acotado al dock: barra de título, cabecera del inspector y un único scroll que ocupa todo el alto restante. No se permite que los campos se recorten sobre una franja vacía. Al cambiar selección se reinicia el scroll interior.
- **Escape:** se conserva la salida programada a los 1.500 ms y el intento de Keyboard Lock. Los avisos de fullscreen, los permisos y el mecanismo de salida de emergencia dependen del navegador, no pueden desactivarse desde SvenStudio.
- **Regresión:** 77/77 pruebas aprobadas (Gameplay, BuildTogether, Architecture, Valve 220 y UI). Prueba del layout CSS en Chromium a 900, 720 y 600 px de altura: scroll llega al borde y los últimos botones quedan visibles. El build completo Vite/TypeScript y el test integrado real en Windows/Chrome siguen pendientes por dependencias npm no disponibles.
- No se cambian los datos de entidad, el formato MAP Valve 220, compiladores, BuildTogether ni los demás estudios.

## v1.7.5 — Escape, cámara y Propiedades (2026-11-08)

- **Escape 1,5 segundos:** `fullscreenEscapeHold` ofrece salida propia al mantener Escape durante 1500 ms, siempre que Chrome entregue las pulsaciones a la aplicación. Una pulsación corta mantiene su función de cancelar. El navegador sigue controlando sus avisos de seguridad y su mecanismo de salida de emergencia.
- **Cámara con clic derecho:** en pantalla completa se utiliza captura de puntero y movimiento del mouse, sin solicitar `requestPointerLock()` por cada giro. En ventana se conserva el bloqueo de puntero y el control previo.
- **Propiedades sin recortes:** el cuerpo del dock lateral es el único contenedor con desplazamiento vertical. El inspector y los campos FGD se expanden completos, con cabecera fija y espacio de seguridad al final. Se restablece la posición de scroll al seleccionar otra entidad. Sin cambios en docks superior/inferior.
- Sin cambios en entidades, edición MAP Valve 220, compiladores, Gameplay Studio 3.0, BuildTogether ni el resto de los estudios.
- **Verificación dirigida:** 59/59 pruebas aprobadas. Integridad de ZIP verificada. Compilación completa Vite/TypeScript y validación visual en Windows pendientes por dependencias no instaladas / navegador no disponible para la aplicación.

## v1.7.4 — Fullscreen, FGD & Gameplay Inspector (2026-11-08)

- La pantalla completa solicita Keyboard Lock incluyendo `Escape` cuando el navegador lo permite. Un Esc breve se entrega a las herramientas; Chrome reserva un Esc prolongado (aproximadamente dos segundos) como salida de seguridad. Botón de salir existente intacto. En navegadores sin permiso/soporte no se garantiza interceptar Esc.
- El panel acoplado de Propiedades usa una sola región desplazable; la mini guía de FGD expande su contenido sin interceptar el desplazamiento del panel.
- El FGD de Sven Co-op se intenta cargar al iniciar desde la carpeta configurada o una única instalación Steam detectada; se usan solicitudes compartidas y se respetan las definiciones manuales que puedan cargarse mientras la operación está pendiente. Los inspectores muestran botón de recarga y errores.
- Gameplay Studio 3.0 permite deseleccionar haciendo clic en un espacio vacío o clic derecho en el mapa; se desactiva el menú contextual de imagen solo en ese canvas. No cambia el clic derecho de otras herramientas.
- Gameplay Studio 3.0 permite editar los keyvalues nativos del FGD de la entidad seleccionada en modo Básico/Avanzado, con flags y choices; mini guía desplegable de uso y ejemplo cargada únicamente para la entidad activa.
- Se mantienen conexiones, Undo/Redo, entidades, MAP Valve 220, BuildTogether y estudios ajenos. Verificación automatizada dirigida y limitaciones: `VERIFICACION_SVENSTUDIO_3D_V1.7.4_ES.md`.

## v1.7.3 — Gameplay Studio 3.0: Top/Iso Map Fix (2026-11-08)

- Contornos 2D derivados de los vértices transformados reales, con rotación y escala, tanto en Superior como en Iso. Eliminados los rectángulos y rombos falsos y el clamp de 350px que deformaba las vistas al acercarse.
- Pan/zoom que reproyecta puntos originales sin redondeos acumulativos; strokes de grosor CSS fijo; ajuste automático solo cuando cambia la proyección, sector o tamaño del área.
- Filtros de altura Z (todas/selección/personalizado ±32–512u), geometría de referencia opcional y aislamiento de entidades relacionadas.
- Entidades coincidentes agrupadas con contador y selector por nombre, classname y Z, con páginas para todos los resultados.
- El botón «Localizar en mapa» permite centrar de nuevo la entidad; el selector en canvas no desplaza el mapa tras cada clic.
- Compatibilidad: no cambian entidades nativas, referencias, exportación MAP, compiladores, BuildTogether, Architecture Mode ni los otros estudios.
- Verificación: 28 pruebas dirigidas de Gameplay aprobadas, 13 de BuildTogether aprobadas. Sintaxis TS/TSX validada. Compilación Vite/TypeScript completa y prueba visual real en Windows pendientes por dependencias ausentes.

## v1.7.2 — Gameplay Studio 3.0: nuevo diseñador visual (2026-11-08)

- Reemplazada por completo la interfaz principal del gráfico de nodos de Gameplay Studio 3.1. Nombre visible **Gameplay Studio 3.0**.
- Tres áreas nuevas: mapa esquemático interactivo, lista paginada de referencias nativas y laboratorio de diagnóstico/rastreo.
- Vista superior/isométrica con pan/zoom, selección por marcador, líneas solo de la entidad seleccionada y sectorización espacial sin modificar el proyecto.
- Explorador de sectores y entidades paginado, filtros por categoría/capa, inspector nativo con keyvalues y guía, edición de conexiones por selección de origen/destino.
- Rendimiento: canvas 2D para los indicadores en lugar de miles de nodos HTML, listas con páginas acotadas, sectorización de miles de entidades.
- Sin cambios en las clases/formatos FGD, export MAP Valve 220, BuildTogether 3.5, Terrain Studio, Architecture Mode, Lighting Studio, compiladores, ni operaciones originales del estado.
- Pruebas dirigidas Gameplay 22/22, BuildTogether 11/11; TypeScript/TSX analizado por parser. Build Vite/TypeScript completo y revisión visual en Windows pendientes (faltan dependencias npm).

## v1.7.1 — Gameplay Studio 3.1: mapa de sistemas y navegación legible (2026-11-08)

- En mapas grandes, el inicio del modo Esencial muestra una vista de sistemas en tarjetas en lugar de cientos de nodos reducidos a 20 % de zoom. Los mapas pequeños siguen entrando al gráfico directamente.
- Las redes se agrupan según referencias nativas del proyecto (`target`, `moveto`, `killtarget`, `master`). Las entidades sin enlaces se organizan visualmente por capa/categoría en bloques de hasta 24, sin alterar keyvalues o grupos existentes.
- Vista de sistemas paginada (30 tarjetas/página), búsqueda y filtros compartidos con el explorador avanzado; navegación por sistema con ajuste de zoom y regreso inmediato. La vista de todos los nodos sigue disponible.
- Posiciones del gráfico localizadas por vista, preservando las coordenadas guardadas del proyecto. Autoorganización sobre el sistema visible y posibilidad de recuperar la distribución previa. Minimap compactable y movible de lado.
- Se mantiene el renderizado virtualizado de nodos y aristas del viewport. No se cambian los datos de entidades, la compilación GoldSrc MAP, el servidor o protocolo BuildTogether ni los demás estudios.
- Pruebas automatizadas dirigidas aprobadas. El build completo requiere las dependencias npm y la prueba visual de la aplicación completa en Windows sigue pendiente.

## v1.7.0 — Gameplay Studio 3.0: editor visual renovado y escalable (2026-11-08)

- Dos modos de trabajo: Esencial y Explorador avanzado; vista de estadísticas, filtros por categorías, capas y grupos, lista de resultados paginados y búsqueda indexada.
- Gráfico de nodos con culling espacial de elementos y aristas por viewport; minimapa limitado por muestreo en mapas grandes. Para mapas con más de 350 entidades abre una vista inicial manejable.
- Inspector reorganizado en propiedades, diagnóstico y rastreo limitado de referencias nativas. Advertencias de nombres compartidos no tratan usos intencionales como errores definitivos.
- Mejora de escalado: se indexan nombres de brushes por entidad y se usan conjuntos para validar relaciones brush/entidad sin exploraciones cuadráticas; el editor de Gameplay no altera estructuras ajenas.
- Compatibilidad: `target`/`targetname`, `moveto`/`killtarget`/`master`, posiciones de nodos, FGD, Undo/Redo, MAP Valve 220, BuildTogether 3.5, Terrain Studio, Architecture Mode, NPC, cámaras y resto de estudios conservados.
- Verificación: 11/11 pruebas automáticas dirigidas aprobadas (7 de Gameplay y 4 de integración de BuildTogether). Parser TypeScript/TSX correcto. **Typecheck completo, build Vite y pruebas visuales reales pendientes por dependencias npm no presentes**; v1.7.0 se entrega como candidata para Windows.

## v1.6.5 — BuildTogether 3.5: envío fragmentado para terrenos grandes (2026-11-08)

- **Motivo:** en la prueba real con Porthole, 4×4 y 8×8 funcionaban mientras que 12×12 y 16×16 seguían desconectando. Los paquetes de prueba median aproximadamente 21, 86, 197 y 339 KiB, respectivamente. Esa correlación sugiere un límite de transporte o buffering, sin confirmar todavía su causa exacta.
- **Protocolo 4:** fragmentación de mensajes WebSocket en bloques binarios de 16 KiB codificados en Base64 (aprox. 22 KiB por frame). Se usa tanto cliente→servidor como servidor→cliente, también para snapshots de quienes ingresan tarde. Los frames se envían a ritmo controlado, con seguimiento de `bufferedAmount`.
- **Atomicidad:** el receptor valida y reconstruye la transacción completa antes de actualizar los brushes, los metadatos y la revisión; no presenta estados intermedios de terreno. La transferencia no elimina vértices ni modifica Valve 220.
- **Control de recursos:** límites de tamaño, número de fragmentos, orden, identificador y tiempo máximo de ensamblaje. Los datos temporales de cámara y cursores no bloquean la cola de geometría.
- **Corrección de compatibilidad interna:** los clientes del protocolo 4 siguen usando `metaPatch` por estudio igual que los del protocolo 3; no vuelven a sobrescribir todos los metadatos del mapa. El servidor acepta clientes antiguos del protocolo 2/3. Para usar fragmentación de terreno, *el anfitrión y los invitados deben actualizar a v1.6.5 y reiniciar el servidor*.
- **Pruebas:** 23/23 pruebas automatizadas dirigidas aprobadas. Incluye una red simulada que rechaza cualquier frame superior a 64 KiB, terreno 12×12 desde el anfitrión, 16×16 desde el invitado, edición de metadatos y entrada posterior de un tercer participante con snapshot fragmentado. TypeScript/Vite completo y conexión Windows/Porthole real pendientes.
- No se alteró el algoritmo de terreno ni sus materiales, Architecture Mode, Smart Build, cámaras remotas, exportación MAP, compiladores ni el resto del editor.

## v1.6.4 — BuildTogether 3.4: sincronización atómica y terreno más liviano (2026-11-08)

- Las operaciones de Terrain Studio de hasta 512 brushes se envían en una única transacción cuando el paquete pesa menos de 1,5 MB. Para paquetes mayores se conserva el límite y el fraccionamiento seguro; el servidor acepta hasta 512 objetos por operación y mantiene la validación de límites y permisos.
- Se reduce la carga del cliente receptor al evitar varias reconstrucciones parciales del terreno por cada operación y al reutilizar referencias inmutables durante la actualización de los estados de deshacer y rehacer, en lugar de clonar todos los brushes en cada checkpoint.
- Las firmas de detección de ediciones manuales se guardan como dos hashes de 32 bits en lugar de duplicar todo el JSON de la geometría. Los mapas anteriores con firmas JSON pueden seguir editándose. El diseño geométrico y la exportación Valve 220 permanecen intactos.
- Se amplía la tolerancia de los tiempos de espera de confirmación y ping durante la construcción de escenas pesadas; la reconexión sigue disponible ante cortes reales de transporte.
- No se modifica Architecture Mode, Smart Build, los compiladores, las cámaras remotas, las entidades ni la forma del terreno.
- Pruebas automatizadas nuevas con 512 brushes, un receptor tardío, 70 checkpoints de historial, dos clientes de prueba, una entidad concurrente, medición de paquetes y compatibilidad de firmas anteriores. No constituye validación en Windows/Porthole.

## v1.6.3 — BuildTogether 3.3: cola fiable de terreno y etiquetas 3D (2026-11-08)

- El servidor WebSocket ya no cierra inmediatamente un cliente al acumular más de 4 MiB de cambios de geometría pendientes. Las actualizaciones fiables se guardan temporalmente en una cola acotada y se entregan en orden cuando el socket libera capacidad (`drain`).
- Los mensajes efímeros (cámara, cursor, actividad) se omiten bajo congestión para priorizar datos del mapa. La cola se limita a 40 MiB por cliente para impedir consumo de memoria ilimitado: un cliente que deja de leer indefinidamente todavía podría desconectarse.
- Se conserva la compatibilidad de protocolo BuildTogether 3.0/3.1/3.2 y los límites de validación de paquetes, roles y selecciones.
- Se corrigen los nombres de cámaras remotas gigantes al alternar entre perspectiva y ortográfica mediante HTML con tamaño fijo (sin `distanceFactor`). Los nombres largos se truncan.
- Se añade diagnóstico del código de cierre de WebSocket en el registro del editor.
- Nuevas pruebas de saturación TCP simulada con más de 4 MiB de datos por transmitir, orden de revisiones, preferencia por geometría y límite de memoria.
- 21/21 pruebas dirigidas aprobadas. Falta validación real en Windows con Porthole y prueba de visualización completa de Three.js.

## v1.6.2 — BuildTogether 3.2: recuperación de terreno y Vista superior (2026-11-08)

- Reconciliación de cambios no confirmados tras reconexión con reenvío selectivo de operaciones pendientes.
- Conservación temporal de cámaras remotas y participantes durante desconexiones breves, sin conservar bloqueos.
- Manejo más conservador de conflictos/rechazos y mayor ventana de confirmación de operaciones pesadas.
- Architecture Mode: evitar que OrbitControls mueva la cámara al dibujar; sincronizar pivote y elevación al cambiar a Vista superior.
- Nueva prueba de corte real de WebSocket a mitad de un terreno de 512 brushes y prueba de interacción de Vista superior.
- 17/17 pruebas dirigidas aprobadas. Falta validación real con Windows y Porthole.

## v1.6.1 — BuildTogether 3.1 / Remote Cameras & Presence (2026-11-08)

- Mini cámaras 3D flotantes por participante sobre el visor MAP. Cuerpo, lente y etiqueta de usuario, cono de campo visual y línea de mirada, sin una segunda cámara/render target ni colisiones de selección.
- Interpolación de posición y orientación para reducir saltos cuando hay latencia. Muestras de cámara limitadas a ~8,7 Hz en buena conexión y menos con congestión/jitter; se descartan actualizaciones efímeras antes de retrasar geometría.
- Publicación de la pose inicial al conectar y almacenamiento de la última pose en memoria del servidor para participantes que entren más tarde. Validación y eliminación de campos arbitrarios del mensaje de cámara.
- Panel lateral colapsable «Ping · BuildTogether» con nombre/color, RTT de cada usuario al servidor anfitrión, actividad/herramienta/estudio, selección remota, seguimiento de cámara y controles de visibilidad. No es ping directo entre dos participantes.
- Estados de actividad sincronizados mediante códigos limitados y sin rutas locales: Terrain, Architecture, Gameplay, Cinematic, NPC, Sound, Lighting, Texture, Decal, Model Browser, Material, transformaciones y otras opciones. Ritmo limitado y sin modificar revisiones del mapa.
- Optimización de resaltado de selecciones: no reconstruye los rectángulos de brushes por cambios de ping/actividad. Mantiene la sincronización por estudio, permisos, bloqueos, recuperación y clientes compatibles del protocolo 3.
- Pruebas nuevas de dos clientes, cámara cacheada, espectadores tardíos, ping real, validación de campos y limitación de frecuencia.

**Estado:** experimental. Se requieren pruebas visuales de React/Three.js, TypeScript completo, build Vite y un ensayo Windows + Porthole con dos usuarios.

## v1.6.0 — BuildTogether 3.0 (2026-11-08)

- Sincronización por campo de metadatos `Project` para Terrain, Architecture, Cinematic, Gameplay, NPC y Material & Surface; sincronización de objetos y lotes confirmados existente conservada.
- Revisión de concurrencia por campo en el servidor y prevención de sobrescrituras de cambios ajenos, con soporte para eliminación de campos opcionales.
- Detección de conflictos en el cliente, alerta visible y copia de recuperación en el navegador antes de priorizar el estado confirmado del servidor.
- Puente bidireccional con clientes BuildTogether 2.0 en el servidor actualizado; validación de mensajes entrantes y permisos existentes de espectadores y locks.
- Diagnóstico visible de revisión, última sincronización y conflictos; corregida la referencia de Porthole en la guía.
- Nuevas pruebas de protocolo y dos clientes reales de prueba con terreno de 512 brushes, estudios concurrentes, seguridad y control de conflictos.
- Sin cambios deliberados a Architecture Mode, Smart Build, True Lighting, shaders, SDK SC, MAP Valve 220 ni al resto de herramientas.
- **Experimental:** faltan pruebas con dos equipos Windows y Porthole, compilación Vite completa y cobertura de todos los gestos de cada estudio.

## v1.5.23 — Ayuda sin logos (2026-11-08)

- Eliminados los elementos de imagen **GPT-6 Astra** y **KZ-Sheez** exclusivamente de la ventana Ayuda; el texto de créditos se conserva en una franja discreta.
- Corregido el título de Ayuda de `v1.5.10` a `v1.5.23`; versión actualizada en barra, pie, lanzador y metadatos.
- Eliminadas las reglas CSS inactivas de esos dos logos en Ayuda. Sus archivos PNG permanecen en `public/` para compatibilidad histórica; no se renderizan desde Ayuda.
- Actualizados los tests heredados que exigían logos; agregado caso de regresión para garantizar que Ayuda se mantiene sin las dos imágenes.
- Agregada lista de novedades comparativa con el README de GitHub (`CAMBIOS_DESDE_GITHUB_A_V1.5.23_ES.md`).
- Sin cambios en edición 3D, BuildTogether, Terrain, Smart Build, Architecture, SDK, formatos MAP/BSP ni recursos de proyectos.

## v1.5.22 — BuildTogether Terrain & Setup (2026-11-08)

- **Paneles al actualizar:** migración única de preferencias de Workspace v1 a v2 que vuelve a mostrar Biblioteca de recursos, Explorador y Propiedades. Las preferencias del usuario tras la migración vuelven a guardarse con normalidad; no se modifica el HUD.
- **BuildTogether:** interfaz de sesión con pestañas «Sesión» y «Guía y conexión». La ayuda de BuildTogether y la guía de conexión LAN/Pothole se trasladaron íntegramente a ese diálogo, eliminando el bloque duplicado de Ayuda general. Se mantienen botones Crear, Unirse, Solo observar, Copiar código, Seguir cámara, Salir y Descargar recuperación; sin cambios al protocolo TCP/WebSocket.
- **Compilación:** botones Buscar para elegir visualmente carpetas reales del PC local (Sven Co-op y SDK); búsqueda automática de instalaciones Steam en varias unidades (registry + `libraryfolders.vdf` + rutas típicas). Los resultados se muestran como opciones y no se sobreescribe una ruta existente. Verificación de los cuatro compiladores SC-CSG, SC-BSP, SC-VIS y SC-RAD. El selector es de solo lectura y no modifica archivos del disco.
- **BuildTogether + Terrain Studio:** envía primero todos los objetos de operaciones grandes en lotes confirmados de hasta 128, dejando el registro de terreno/arquitectura y otros metadatos para el lote final. Preserva los cambios locales optimistas que aún no fueron confirmados al recibir ediciones ajenas de otros objetos/metadatos; calcula los pendientes restantes tras cada confirmación. Elimina el corte artificial de más de 4096 operaciones dentro de proyectos de hasta 25 000 objetos y agrega protección para mensajes demasiado grandes.
- **Pruebas:** nuevos casos con terreno de 512 brushes, reescultura, inserción concurrente de entidad por el anfitrión, instantánea de un participante tardío, búsqueda de bibliotecas Steam y migración de paneles. Véase `VERIFICACION_SVENSTUDIO_3D_V1.5.22_ES.md` para límites de verificación y pruebas reales pendientes.
- No se cambian las herramientas de modelado, engine Terrain, Architecture Mode, SC compile pipeline ni formato MAP Valve 220.

## v1.5.21 — Adaptive UI Fix (2026-11-08)

- Barra superior reorganizada en zonas realistas (izquierda, proyecto y acciones), con medición del contenedor mediante `ResizeObserver` y menú **Más acciones** accesible en ventanas estrechas. Nombre del proyecto editable y truncado, sin posicionamiento absoluto.
- Herramientas: modo compacto con iconos y tooltips según el ancho CSS real, alineación de grupos y reserva de espacio para el scrollbar sin tapar las etiquetas.
- HUD: posición calculada con tamaño real de cada widget y del visor; `ResizeObserver` reubica las herramientas al abrir paletas y al cambiar la ventana, sin modificar porcentajes persistidos. Desplegables de Visualización y Precisión se reposicionan al lado interior disponible.
- **Editar HUD**: selección transitoria (no persistida), deselección pulsando el fondo, limpieza de contornos al salir. Formas colapsadas ocupan solo el botón visible.
- Eliminado mínimo global rígido de 550px para permitir las dimensiones CSS efectivas de Windows al 200%. Se conserva el aislamiento de escala para Home y BSP Viewer.
- Sin cambios al protocolo BuildTogether, compilación SC, Architecture Mode, MAP Valve 220, materiales, shaders o lógica de edición.
- Verificación: TypeScript OK, 452/452 pruebas Node aprobadas, 12 simulaciones visuales CSS en Chromium sin desbordamientos. Vite y Windows DPI real pendientes por las limitaciones detalladas en `VERIFICACION_SVENSTUDIO_3D_V1.5.21_ES.md`.

## v1.5.20 — Adaptive UI (Windows display scaling)
- Measure actual MAP dock area via ResizeObserver, rather than window size assumptions.
- Automatically reflow saved dock sizes while preserving persistent preferences.
- Compact controls for narrow libraries, properties, HUD and short displays.
- Keep topbar actions scrollable at narrower CSS viewports.
- Optional adaptive setting in Workspace layout (enabled by default for previous installations).
- No changes to Home/BSP 100% shell scale, BuildTogether, Architecture Mode or compilation.

## v1.5.19 — BuildTogether: guía Porthole integrada (2026-11-08)

- Guía ES/EN desplegable dentro de BuildTogether para alojar con TCP 49178 en Porthole, aprobar el puerto y escoger direcciones locales del invitado.
- Ejemplos no universales para `127.0.0.1`, `192.168.x.x` y `10.x.x.x`; guía de remapeo local 49179 cuando 49178 está ocupado.
- Aclarada la diferencia entre código de sesión BuildTogether y sala Porthole, y entre Porthole → Puertos y una LAN clásica.
- Archivo `GUIA_BUILDTOGETHER_PORTHOLE_ES.md` y pruebas de integración de ayuda; sin cambios al protocolo WebSocket, Architecture Mode, MAP o compiladores.

## v1.5.18 — BuildTogether 2.0: network stability and responsiveness (2026-11-08)

- Los cambios de geometría se agrupan (90 ms) y se envían en lotes de hasta 128 objetos, esperando la confirmación del servidor antes del lote siguiente.
- Los cursores remotos reciben interpolación visual CSS; envío de cursores/cámaras limitado y priorización de cambios de MAP cuando hay congestión.
- Ping RTT y variación estimada en el panel BuildTogether, junto con el estado de sincronización y reconexión.
- Reconexión automática durante cortes breves, restauración de identidad con clave de reanudación de sesión y ventana de gracia de 45 segundos para el anfitrión.
- Liberación de bloqueos al perder conexión; salida explícita del anfitrión cierra la sesión. Las interrupciones transitorias no la cierran inmediatamente.
- Si hay cambios locales sin confirmar al reconectar, se guarda una copia en sessionStorage antes de aceptar la versión del servidor (no hay fusión automática de conflictos).
- Comprobaciones de presión de salida para descartar solo tráfico efímero; los cambios permanentes se confirman o requieren resincronización.
- Architecture Mode, sus componentes, operaciones, estructuras y validadores NO fueron modificados.
- Formato MAP Valve 220, SC-RAD, BSP Viewer, BuildTogether TCP 49178 y BuildTogether LAN conservados.

## v1.5.17 — Architecture Mode (2026-11-08)

- Herramienta de dibujo interactivo de muros y habitaciones ortogonales dentro del visor 3D.
- Cierre de habitaciones, suelo y techo opcional generados como brushes convexos GoldSrc.
- Previsualización del contorno, ajuste a grilla, Enter/Backspace/Esc y controles accesibles.
- Editor paramétrico de contorno, altura, grosor, Z y losa, más arrastre de esquinas 3D.
- Construcciones persistentes en proyectos editables, un Undo/Redo por operación.
- Protección contra solapamientos, intersecciones, parámetros inválidos y modificaciones manuales.
- Smart Build original y todas las herramientas previas conservadas en la interfaz.
- Guardas explícitas de puertas/ventanas para evitar corromper construcciones paramétricas.
- Formato MAP Valve 220, True Lighting, BuildTogether y compiladores intactos.

## v1.5.16 — Smart Build render loop fix (2026-11-08)

- Fixed `Maximum update depth exceeded` when mounting the `ArchitectureBuilder` component in the Shapes > Smart Build tab on a project without `architectureOpenings` and `architectureAssemblies`.
- Root cause: selectors `useEditor(s => s.project.architectureOpenings || [])` and `useEditor(s => s.project.architectureAssemblies || [])` allocated a fresh empty array for every `getSnapshot()` call, causing repeated external-store rerenders under Zustand 5 and React 19.
- Selectors now return the stable stored properties (possibly `undefined`), and module-level typed empty arrays are used as stable presentation fallbacks.
- Added `tests/smart-build-zustand-v1516.test.mjs` and updated release-version assertions. Full Node regression: 418/418 passing; TypeScript: zero errors.
- Geometry and map export logic, lighting, tool controls, layout, and all existing architecture actions remain unchanged.
- Browser startup in the user's Windows environment is still pending confirmation.

## v1.5.15 — Smart Architecture 2.0 (2026-11-07)

- Real Shapes palette now includes a compact **Smart Build** tab; the historical ArchitectureBuilder component was previously unused and is now mounted in the actual viewport UI.
- Native parametric generators: rooms with optional open roof, open-ended corridors, stairs with landing, bridges, and supported platforms; all pieces are tested as valid convex Svengine Valve 220 brushes.
- Rebuildable architecture assemblies store editor-only origin, dimensions, member IDs, texture and change-detection signatures in `.svstudio.json`, preserving original authored geometry when users later edit other parts.
- Opening plan rebuild: update offset, sill, width, height and frame; repeat with controlled spacing; delete a window and restore the original wall without accumulating CSG clips. Other openings on the wall are retained.
- Smart Build verifies generated structure parts and newly generated window/door wall fragments before replacing them. Its detach actions preserve manually edited world brushes instead of silently overwriting them; a 24-opening limit guards against pathological CSG work. Converting an assembly to ordinary editable brushes deliberately ends its parametric relationship.
- Stable CSG gizmo centering and multiple-opening support from v1.5.14 preserved. Undo/Redo and historical metadata exports remain unchanged.
- No edits to MAP Valve 220 exporter, BSP parser, Baked RGB shaders, SC-RAD, build backend, home or BuildTogether.

## v1.5.14 — Architecture window gizmo centering

- Fixed the move/rotate gizmo appearing near `info_player_start` or the origin when selecting a wall fragment generated by an architectural window/door cut.
- Recenters CSG-generated architectural wall fragments (local vertices + actual brush world-space position), preserving the same world geometry, texture-face metadata and Valve 220 output.
- For existing saved projects with old world-space CSG vertices, selection pivots now derive from the visible brush bounds, without rewriting project data.
- Reuses the same correct center for centered scale anchors; ordinary centered brushes retain their original pivot.
- Regression tests cover displaced walls, new and legacy fragments, movement, export and syntax, plus multi-window architecture cases.
- Does not change True Lighting, SC-RAD, BSP Viewer, compilation, Material & Surface Studio or BuildTogether.

## v1.5.13 — Material & Surface Studio startup fix

- Fixed a Vite/React-Babel syntax error that prevented SvenStudio from opening after installing v1.5.12. `MaterialSurfaceStudio.tsx` imported `Brush` both as an icon and as a geometric type. The icon is now aliased as `BrushIcon` while the `Brush` type keeps its original name.
- Added a Babel TSX syntax regression test that reproduces the original error and checks that Material & Surface Studio and its integration parse correctly.
- Updated the app, launcher, package metadata, and version assertions.
- No changes to Valve 220 MAP export, GoldSrc geometry, True Lighting shaders, or BuildTogether.

## v1.5.12 — Material & Surface Studio (2026-11-07)

- Added Material & Surface Studio in the left Resource Library beside Texture Browser: native brush presets for glass, alpha-cutout grates, additive screens, and water.
- Atomic, undoable native brush-entity conversion (`func_wall`, `func_illusionary`, `func_water`) without touching Valve 220 UV or rewriting pre-existing game logic.
- Editor-only per-project surface sound assignments and legacy ASCII materials.txt export with optional worldspawn linkage; Map Packager includes map-specific text resources when configured.
- Native `light_surface` helper, animated WAD texture frame inspector, WAD preview, saved presets, and Material Doctor diagnostics.
- Existing SC-RAD, BSP, visualization, MAP exporter, launcher, viewport renderer, BuildTogether and other tools remain untouched.

## v1.5.11 — Visualization menu and compact True Lighting (2026-11-07)

- Replaced the top-right True Lighting build shortcut with a **Visualización / Visualize** menu beside Perspective inside the MAP editor viewport. Choose normal, quick approximate, or compiled True Lighting mode.
- Simplified the True Lighting header to Rebuild, Settings, Split/Full and Close; moved Interior/Exterior, gamma, fog, filter, styled lightmaps and diagnostics into collapsible settings.
- Added an explicit compact status footer for SC-RAD freshness and Baked RGB, plus split and full MAP viewport modes that keep Resources and Properties docked. BSP Viewer access is retained in Settings.
- Cached BSP preview survives closing its panel, reducing unnecessary recompilation; a modified MAP still warns that a new bake is needed.
- No changes to MAP Valve 220, SC-RAD, compiled BSP rendering and RGB samples, world geometry, BuildTogether or the welcome page.

## v1.5.10 — True Lighting: BSP fog and display-only color calibration (2026-11-07)

- Added a safe read-only `env_fog` parser for the compiled BSP (RGB, near/far distances, and Start Off spawnflag).
- Added fog toggle to True Lighting and BSP Viewer; compiled-lighting shader blends fog in linear working space before output color conversion. Approximate built-in non-baked BSP materials also respect the scene fog.
- Added neutral-default display gamma control, and bilinear/nearest lightmap filtering without rebuilding the BSP.
- Lightmap samples, MAP Valve 220 export, texture data, SC-RAD compiler path, welcome screen, BuildTogether and all map-editing tools are unchanged.
- v1.5.9 custom `bspLightUv` fix remains active. Runtime fog triggers and native Svengine user graphics settings are not simulated.
- Node regression tests include the previously submitted maptest1 BSP with active env_fog. Windows/Chrome and actual Sven Co-op color matching still require visual validation.

## v1.5.9 — True Lighting: custom UV shader fix (2026-11-07)

- Fixed baked RGB WebGL shader reading `uv1` without the conditional Three.js `USE_UV1` attribute declaration. Custom `bspLightUv` is always declared and backed by the exact lightmap UV coordinates.
- Preserved `uv1` for built-in Three.js lightmaps and maintained atlas and per-face rendering paths.
- Added regression tests using the actual 14-face BSP lighting test map. No changes to SC-RAD or BSP/MAP writing.
- Browser WebGL validation on user hardware remains necessary.

## v1.5.8 — True Lighting: direct luxels and compile diagnostics (2026-11-07)
- For small BSP maps (up to 64 faces), bypass the shared atlas: upload a padded RGB texture per lightmapped face, keeping exact SC-RAD samples and mapping their GoldSrc 16-unit coordinates directly.
- Add compiled RGB statistics to both True Lighting and BSP Viewer, distinguishing missing, black and dim samples from renderer/geometry problems.
- Add a non-baked geometry inspection mode to True Lighting; it is clearly identified as unlit rather than falsely presented as exact illumination.
- Prevent confusing contradictory `Baked RGB` / `Lightmaps` toggles.
- Preserve MAP/Valve 220, BuildTogether, compilers, BSP preview isolation, original viewport controls and prior versions.
- Tests performed without the unavailable Vite/Three dependencies; visual WebGL and native SC-RAD output still require Windows validation. This release is a diagnostic/precision fix, not a claim that the user's specific BSP has been solved without its bytes.

## v1.5.7 — BSP interior camera / True Lighting visibility

- Fixed True Lighting showing mainly skybox in small maps: default navigation now starts **inside** compiled map bounds, near `info_player_start` when available.
- Fixed BSP Viewer starting outside and requiring large zoom/orbit movements to find the map. Interior / Exterior viewpoint controls and reset added to both compiled-map viewers.
- Included deterministic camera-preset tests for spawn, spawnless rooms, large outdoor maps, and out-of-bounds spawn positions.
- No changes to SC-CSG, SC-BSP, SC-VIS, SC-RAD, BSP lightmap samples, WAD textures, Valve 220 MAP export or normal build output.
- Tests runnable without frontend dependencies: 256/256 passed. Remaining dependency-bound regression suites, frontend build/TypeScript type-check and real Windows WebGL/SC-RAD validation remain pending.

## v1.5.6 — True Lighting Preview (2026-11-07)

- Added **True Lighting** to MAP Editor and Lighting Studio: a second, read-only 3D viewport displays **actual BSP30 RGB lightmaps produced by SC-RAD** next to the editable MAP. Rebuild on demand and see when the current MAP differs from its last bake.
- Added `previewOnly` compilation mode using the original SC-CSG / SC-BSP / SC-VIS / SC-RAD pipeline. The result remains in an isolated temporary build folder and is fetched via an expiring random identifier; unlike normal compilation it **does not install/overwrite** `svencoop/maps/*.bsp` or install demonstration sounds/WADs.
- BSP parser now preserves all compiled face RGB lighting layers and style identifiers; snapshot slider combines static and named/animated lightstyle layers at a selected tick (does not simulate their exact runtime timing).
- **Baked RGB** render path multiplies original BSP RGB samples with textures, without editor lighting, fake ambient light, or Three.js PBR. Added Baked RGB toggle to the full BSP Viewer; optional gain, wireframe and lightstyle snapshot sliders; installed skybox and WAD lookup retained.
- The preview remains tied to a project snapshot and flags stale results after subsequent map edits. Opening the preview in full BSP Viewer does not replace the editable MAP.
- Browser color management, game gamma/palettes, some moving/dynamic objects, and animated lightstyle timing can still make Svengine's final pixels differ. This is a *compiled-lightmap preview*, not a byte-for-byte reimplementation of the complete engine renderer.
- 353/353 Node regression tests and TypeScript (no errors); separate synthetic integration test confirms preview-only build/download does not install a BSP and normal compile still installs one. Windows SC-RAD compilation and in-game results remain to be verified.

## v1.5.5 — Advanced Lighting Studio (2026-11-07)

- Lighting Studio retains its native environment, skybox browser, previews and original tools, with three additive tabs: **Texture lights**, **Advanced SC-RAD**, and **Styles & shadows**.
- Texture lighting: create/edit `light_surface` (native `_tex`, `_light`, optional `_texcolor`, `_frange`, `_texlightgap`), add named RGB/brightness entries to an `info_texlights` entity without deleting other entries; read texture name from a selected MAP brush face or existing map texture list.
- SC-RAD: validated controls for bounce, patch sizes, smoothing, blur, gamma, reflection, ambient, sky, fades, emissive gap and custom shadow options, written to the documented `info_compile_parameters` entity. Existing unrelated BSP/CSG/VIS and RAD properties remain intact. Three optional editing presets (indoor, final and soft sky).
- Native light styles: targetname, appearance, optional custom patterns and initially-dark bit, preserving unrelated spawnflags. Create native `light_shadow` and `light_bounce` helpers with checks for opaque target brush entities.
- Existing MAP Valve 220 exporter and SC-* compiler arguments unchanged. Browser lighting remains an approximation; advanced baked results must be checked in Sven Co-op.
- Version metadata, in-editor version badges and help updated. Added automated safety/regression tests and a Spanish verification guide. No changes to home parallax/shell scaling or BuildTogether.

## v1.5.4 — Escala aislada y parallax estable (2026-11-07)

- La escala del Workspace solo afecta al editor MAP; la pantalla inicial y BSP Viewer se mantienen a escala 100 %.
- Corregido el hover que se repetía sobre iconos: tarjetas y botón Start usan contenedores hitbox estáticos con caras 3D independientes y sin eventos de puntero.
- Se conserva la portada en inglés, el inicio automático y todas las funciones previas, incluyendo BuildTogether y Decal Studio.

## SvenStudio 3D v1.5.2 — Holographic Home (2026-11-07)

- Rebalanced the home to fill the *actual browser content height*, not a full-screen mockup; logo, tools and Start have breathing room. The outer home stays clipped, without fake horizontal/vertical scrollbars on desktop.
- Added a bounded layered holographic visual: two logo orbits, animated glass halo, projected cyan grid, ambient rings, moving spotlight and extra particles.
- Strengthened **local** 3D reactions: each card tilts toward the pointer, its icon lifts separately, a light reflection sweeps across the card, while the whole page only moves a few pixels. Accessible reduced-motion/touch fallbacks remain.
- All visible home wording stays English. Start still enters the mounted editor, with BuildTogether and map state untouched.
- Release numbering updated to v1.5.2.

## SvenStudio 3D v1.5.1 — Home Fit & Gentle Parallax (2026-11-07)

- **Home now opens on every launch** of the browser editor, instead of entering the 3D workspace immediately. Start resumes the already-mounted editor without resetting the map or BuildTogether.
- The one-time onboarding guide is deferred until the first Start so it cannot cover the home screen.
- Solved scrollbars and cropped welcome content on typical desktops by sizing the welcome composition to its own viewport, reducing 3D projection overflow, shrinking the holographic orbit, and tightening vertical spacing.
- Reduced global mouse tilt and individual card hover angles while retaining cyan reactive glows, depth grid, and particles.
- Maintained responsive vertical scrolling on physically narrow or short viewports while preventing horizontal scrolling.
- Updated release to v1.5.1.

## SvenStudio 3D v1.5.0 — Kinetic Parallax & Home Screen (2026-11-07)

- Changed the release version to **1.5.0** in the UI, launcher, package metadata, and verification.
- Enhanced the 3D welcome page with pronounced multi-layer parallax, per-card mouse-driven 3D tilt, reactive cyan lighting, a holographic orbit around the logo, subtle animated points, and an abstract perspective grid. No gameplay imagery or new map rendering is used.
- Fixed the horizontal scrollbar caused by oversized transformed layers: the welcome viewport clips horizontal overflow and keeps intentional vertical scrolling only on small screens.
- All welcome copy remains English by default; map and editor settings remain unchanged when pressing Start.
- Automatically disables motion for reduced-motion and coarse/touch pointers; all effects are pointer-safe and do not create map edits.

## v1.4.0 HF15 Preview 4 HF4 — Interactive Parallax Home

- Added gentle 3D perspective parallax to the existing solid-blue English homepage: logo, title, tool grid, capabilities and footer respond at different depths to mouse movement.
- Two ambient cyan lights drift at a lower rate; hovered cards and the Start button have cursor-following glow. The 3D gameplay viewport is not rendered or modified by this effect.
- Pointer tracking is smoothed with requestAnimationFrame and updates CSS variables without React rerenders. Animation stops when settled and listeners/frames are cleaned up when the home closes.
- Reverts smoothly to neutral on mouse leave or focus loss. Automatically disabled for reduced-motion settings and coarse/touch pointers.
- Same project/editor/BuildTogether state, English home copy and responsive solid navy styling as HF3. No image backgrounds.

## v1.4.0 HF15 Preview 4 HF3 — Solid English Home

- Replaced the stretched full-screen screenshot with entirely responsive, real HTML/CSS home components.
- Removed gameplay/map scenery. Calm solid navy background with subtle cyan highlights; no screenshots or image backgrounds.
- Home defaults to English independently of the language chosen for the rest of SvenStudio 3D.
- Responsive hero, nine studio panels, three capability cards, and centered actual Start button.
- Open-map name and object counts remain live. Home hides duplicate version labels; map/editor, tools and BuildTogether are preserved.

## v1.4.0 HF15 Preview 4 HF2 — Cyan Fullscreen Home

- Full-bleed illustrated cyan/blue landing view matching the selected reference inside the editor (not a mockup).
- Native interactive Start button layered over the cinematic artwork, returns to the existing live viewport without resetting project or BuildTogether.
- Existing header/footer remain live. Screenshot chrome cropped out. Header/footer duplicate version strings hidden while welcome is open.
- Browser window resizing scales the artwork; reduced-motion and accessible names supported.

## v1.4.0 HF15 Preview 4 HF1 — Home Screen

- Clic en logo/título SvenStudio 3D para abrir la portada interna sin descargar ni reemplazar el mapa.
- Banner de bienvenida, resumen de estudios, nombre del proyecto y botón Iniciar.
- Editor WebGL y paneles conservados en memoria; la página oculta la vista y desactiva atajos mientras está abierta.
- Textos ES/EN, diseño responsive y ayuda de validación para Windows.

## SvenStudio 3D v1.4.0 HF15 Preview 4 — BuildTogether (2026-11-07)

- First experimental cooperative mapping service using authenticated rooms and a dedicated WebSocket port (49178).
- Host creates a private invitation code; guests join by private LAN/overlay address and code, with optional spectator role.
- Project object and metadata deltas synchronized; selection locking, participant presence, colored remote outlines and screen-space cursors.
- Optional Follow Camera, independent editor viewport settings, and local-only WAD/FGD/MDL resources and compiler paths.
- Added trusted-LAN launcher `SvenStudio3D_BUILDTOGETHER_LAN.bat`, BuildTogether panel and Spanish/English Help entries.
- Server conflict checks and revision ordering; disallowed writes to peer-locked objects.
- Node.js session integration test plus pre-existing regression suite. Vite/Chrome/Windows validation is still pending.

## HF15 Preview 3 HF1 — Decal Move & Transparency

- Arrastrar decals `infodecal` directamente sobre la cara donde se colocaron. Admite planos verticales, inclinados y horizontales; queda dentro de los límites de la cara.
- Movimiento con gizmos y campos numéricos restringido a la misma superficie, conservando el desplazamiento de 0,8u hacia el lado original.
- Una operación de Undo/Redo por arrastre completo; mover el mouse no llena el historial.
- Vista previa de transparencia mejorada (índice alfa nativo WAD3 y análisis prudente del fondo para entradas WAD3 no nativas).
- Mantiene la exportación MAP `infodecal` estándar: sólo posición y textura. Sin valores inventados de rotación o escala en GoldSrc.


## v1.4.0 HF15 Preview 3 — Native Decal Studio (2026-11-07)

- NEW: Decal Studio tab in Asset Library and Studios navigation. Browse native GoldSrc decals with previews, name filtering and click-to-place interaction on brushes.
- NEW: import the original `decals.wad` manually or load the fixed `decals.wad` path from the configured local Sven Co-op directory through a read-only validated server endpoint. Decals are not bundled with this distribution.
- NEW: GoldSrc `infodecal` point entities exported as ordinary Valve 220 MAP entities with a `texture` key. Each placed decal is individually selectable, duplicable, removable and undoable.
- NEW: editor-side decal visualization with alpha transparency and orientation according to the clicked face. The editor-only normal/brush metadata does not change native MAP export.
- WAD3 parser: supports native decal lump type `0x40` separately from standard WAD texture type `0x43`; handles index-based alpha and validates ranges and palette contents before decoding.
- Doc: English/Spanish Help section covering Decal Studio, import, painting, edit, limits and dependencies.
- Verification: TypeScript clean, Node syntax/server checks clean, 303/303 Node regression tests, local `/api/health` responds, `/api/assets/decals` rejects missing gameDir. Windows Vite build, browser UI and compiled in-game preview remain pending.
- Scope: native static `infodecal` only. No free scale/rotation, dynamic spray effects or nonnative geometry decals; visual previews are approximations and must be validated in Sven Co-op.

## v1.4.0 HF15 Preview 2 HF5 — UV controls stay fixed in the viewport (2026-11-07)

- FIX: removed the UV widget from Drei `Html` projection in the 3D scene. Even with `fullscreen`, that component moved its HTML wrapper when the camera orbited/zoomed, causing the apparent wandering UI.
- Render the UV manipulator as a true DOM overlay directly in `.viewport-frame`, with screen-relative pixel coordinates. Camera movement and face selection no longer change its position.
- The first face click determines the initial widget placement, or the viewport center is used if opening without a face click. Users can drag the `Mover UV` tab to move it; that position is saved and reused for later faces and sessions.
- A viewport resize can clamp the position only when necessary to keep the control accessible.
- Changed the storage key from v1 to v2 to avoid carrying over positions saved in the old, camera-projected coordinate space.
- No changes to Valve 220 UV axes, geometry, WAD data, MAP exporter, or brush clipboard.
- TypeScript and Node regression tests passed (296/296); interactive Chrome/Windows verification pending.

## v1.4.0 HF15 Preview 2 HF4 — UV workspace and brush clipboard (2026-11-07)

- Removed the redundant **Build Configuration** entry from Workspace; the main top-bar button remains next to Compile Map.
- Added a distinct **Mover UV** grab tab to the screen-space UV manipulator. Drag the tab to position the controls freely in the viewport. Position stays fixed when selecting different faces/brushes, orbiting, zooming or reopening Texture Studio, and is stored locally.
- Preserved existing UV transform handles and Valve 220 UV editing; dragging the new tab does not change any brush texture coordinates.
- Added **Ctrl+C** (copy selected, unlocked visible brushes) and **Ctrl+V** (paste independent duplicates, offset so they can be selected), including multiple brushes and repeated pastes. A paste is one undoable map change; object clipboard operations do not override text field copy/paste or Texture Studio's material buttons.
- Updated English/Spanish Help guide for both features; no map format or build pipeline changes.
- TypeScript and automated Node regression tests pass. Browser/Windows visual confirmation remains pending.

## v1.4.0 HF15 Preview 2 HF3 — First-run Guide, Build Configuration & Workspace (2026-11-07)

- Replaced the duplicate top-bar **Save** button with **Build Configuration**. File → Save project and Ctrl+S remain available.
- Build Configuration explains that successful compilation automatically writes `<gameDir>/maps/<mapName>.bsp`; intermediate MAP files remain in the temporary build folder. The editable project must be saved separately.
- Rebuilt the Help dialog: updated camera, gizmo, drawing, UV, smart placement, Gameplay Test, every configurable keyboard shortcut (read live), detailed explanations for the studios, Workspace, game-resource loading and contact information (Discord kzsheez / Steam KazamiiSC).
- Added an explicit incomplete-development notice and recommended Fullscreen navigation warning.
- Help opens automatically when the editor is opened in a browser for the first time; marking it seen on dismissal preserves the preference per browser.
- New workspace default matches the requested screenshot: Classic ribbon at the top; Asset Library left; Properties above Explorer on the right. Existing saved arrangements are respected.
- Increased `info_player_start` MDL idle animation refresh from 10 to up to 30 Hz and adjusted the playback speed (1.4×); hide this preview model in Gameplay Test.
- Changed Spanish `Wireframe` UI text from `Alámbrico` to `Wireframe`.
- No changes to MAP export/brush geometry, WAD rendering or SDK build behavior. Existing layout state and project files are retained.
- Validation: TypeScript clean; 290/290 Node regression tests. Windows Vite build/interactive review pending.

## HF15 Preview 2 HF2 — Stable UV Anchor & Floating Texture Studio

- Pin UV controls to click location (screen-space, zoom independent) until changing face.
- Keep Texture Studio palette position stable across face changes/double-clicks/reopens.
- Render palette outside clipped viewport using a body portal; allow dragging to any workspace area.
- Store position per browser, preserve it between launches and clamp on resize.

## HF15 Preview 2 HF1 — Precision settings & compact UV overlay

- Position precision settings under the triggering toolbar button, raised above side tool rail.
- Replace face-sized projected yellow UV outline with a compact fixed-size draggable UV gizmo.
- Keep UV controls on screen as camera zoom changes; avoid near-plane projection instability.
- Preserve UV texture transforms, brush geometry and Valve 220 MAP export.

## v1.4.0 HF15 Preview 2 — WAD & Valve 220 UV Accuracy (2026-11-07)

- UV Fit and Center now resolve texture dimensions from the **same WAD priority order used by the actual viewport**. This fixes unexpected UV scale when the same texture name exists in WADs with different dimensions.
- Fit preserves mirrored (negative) U/V scale and correctly anchors repeated texels to the mirrored edge.
- Align preserves the full source Valve 220 UV axes (including magnitude and rotation) and texel offsets on coplanar faces. Around corners, unusable axes are repaired while preserving phase at the join.
- WAD3 import validates image and palette bounds **inside each individual lump**, preventing invalid textures from reading data belonging to other textures.
- WAD priority respects the first declared occurrence of a WAD file; when priorities are equal, the latest import continues to win (existing behavior).
- Added seven regression tests covering archive priority and reimports, mirrored fitting, non-unit UV alignment, right-angle repairs, malformed WAD3 lumps and shared UV/WAD selection.
- Retains HF15 Preview 1 HF1 single-grid overlap fix. No changes to BSP compilers, map brush geometry, MAP or project file formats.

Verification: TypeScript OK; 278/278 Node regression tests passed. Vite build and interactive Windows/browser verification are pending due to unavailable Linux Rollup native module.

## HF15 Preview 1 HF1 — Visual grid overlap fix

- Replaced the stacked dual-grid preview with a single larger continuous helper.
- Eliminated the dark square patch that appeared on the floor when changing the visible grid size or selecting brushes.
- Kept visible-grid size independent from move/draw precision.
- Verified TypeScript compilation in the CAAS environment.

## v1.4.0 HF15 Preview 1 — Independent Grid & Precision (2026-11-07)
- Separate **visible grid** spacing from the **move/draw/snap** increment; initial values 16u visible / 1u editing.
- Expose both values in viewport HUD and ribbon toolbar; keep the original UI layout.
- Add precision popover for rotation snap, scale snap, and modifier reference.
- Fix Shift temporarily disabling gizmo displacement snap (preview and commit) consistently with G/R/C.
- Persist visible grid preference and edit precision independently; MAP, WAD, BSP, FGD and project formats are unchanged.
- Grid preview remains an editor-only overlay. This preview does not yet overhaul GoldSrc geometry/UV/lighting.

## v1.4.0 HF14 — Stability & Bug Fixes (Browser)

- Fixed the six-language `DoorMotionControls` type error so TypeScript builds cleanly.
- Updated two legacy preview tests to validate WAD lookup passed to `buildMeshGeometry` correctly.
- Added safe migration/sanitization for saved dock layout data, retaining valid preferences.
- Made panel resize handlers restore the cursor/selection and cancel cleanly on blur, Escape, and pointer cancel; touch handling improved.
- Repaired standalone smoke and Gameplay Preview 4 verification scripts after engine import growth.
- Added 4 workspace stability tests, a cross-platform `npm run verify:hf14` command, and a Windows verification launcher.
- No changes to map serialization, geometry generation, Valve 220, or Sven Co-op SDK compiler pipeline.

Verification: TypeScript clean; 263/263 Node regression tests; additional smoke, layout, gameplay, packager, BSP, terrain, texture and backend API checks passed. Final Vite build and graphical Windows/browser verification remain pending because this environment lacks Rollup's Linux native binary.

---

## v1.4.0 HF13 — Adaptive Docks: Asset Library & Properties

- Asset Library adapts to top/bottom docking with a compact row of search, WAD/FGD import, and filters.
- Texture previews use capped-size tiles in auto-filling columns instead of stretching two tiles across the panel.
- Entities and NPC listings use several responsive columns; Model Browser, Sound Browser, and Layers fill available space.
- Sound files use responsive columns in wide horizontal docking; preview controls remain accessible.
- Properties adapts to horizontal docking: transform, FGD keyvalues and fields are arranged in columns within a scrollable inspector.
- Intermediate-width horizontal docks are supported as well as full-width and narrow side docks.
- Dock locations are passed as presentation-only attributes, so content/layout automatically changes when docking or resizing.
- All editing actions and underlying project serialization remain unchanged.

Verification: 7 new HF13 tests passed; 241/241 supported regression tests passed. Full run: 245/250 (3 blocked by missing three, 2 outdated legacy assertions for HF2 Formas/Prefabs). TypeScript/TSX syntax and CSS parsing passed. Full Vite build unavailable because vite/client is missing. Automated Chromium screenshot could not be completed in this environment; Windows browser test pending.

---

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

## v1.4.0 HF12 — MAP Import: Brush Entity Visual Anchors (2026-11-06)

- Fixed imported solid entity markers appearing at world origin when MAP entities have brushes but no `origin` keyvalue.
- Anchor imported solid entity markers to the bounding box of *all* reconstructed, associated brushes.
- Preserve explicit `origin` values for entities that have them and leave ordinary point entities unchanged.
- Keep brush geometry, UVs, targets and Valve 220 MAP export behavior unchanged.
- Added automated regression tests and a standalone MAP fixture containing `func_door` and `func_button` brush entities.

## 2026-11-11 — SvenStudio 3D v1.9 · Editor BSP Visual Preview 5

- Edición múltiple de entidades puntuales en el Editor BSP: selección Ctrl/Shift+clic, movimiento de grupo conservando distancias, actualización masiva de keyvalues seguros y operaciones reversibles en un paso.
- Conexiones visuales entre entidades (`target`, `killtarget`, `trigger_target`), líneas de colores en el visor, informe de destinos no resueltos y asignación de `targetname` único en el destino cuando sea necesario.
- Inspector FGD contextual: campos `choices` y casillas de `spawnflags`, sin perder bits desconocidos y conservando edición manual de keyvalues.
- Protecciones para entidades sólidas compiladas y `worldspawn`; exportación por copia únicamente del lump de entidades.
- Etiquetas de interfaz en ES/EN/RU/KO/ZH/PT. Conserva paneles, cámara, animaciones y composición BSP de Preview 4.
- Pruebas reproducibles y límites documentados: `docs/BSP_EDITOR_VISUAL_PREVIEW_5_ES.md`.

## 2026-11-11 — Editor BSP Etapa 6D: UV continuo y lightmaps reproyectados

- Reutiliza mallas/materiales durante edición UV (sin reconstrucción completa en cada movimiento).
- Habilita giro/escala en caras iluminadas con reproyección segura de las muestras RGB y lightstyles al exportar. No realiza un RAD nuevo.
- Biblioteca WAD3 indexada con memoización; UI MAP, widget fijo, historia y cámara preservados.
- Pruebas BSP, serialización y reimportación; el juego sigue pendiente de comprobación manual.
- Ver `docs/BSP_EDITOR_ETAPA_6D_UV_CONTINUO_LIGHTMAPS_ES.md`.

- **Editor BSP Etapa 7 / HF7:** Lightmap Studio para RGB de caras con estilos, copia/pegado de muestras compatibles, guardado seguro y compactación; copia/pegado colocado por clic de modelos compilados estáticos func_wall/func_illusionary. Véase docs/SvenStudio3D_v1.9_BSP_ETAPA7_LIGHTMAP_BRUSH_PASTE.md.

### v1.9 Etapa 8A HF9 — External Resource Manager (12-nov-2026)
- Selección de hasta ocho carpetas externas de recursos desde Configuración de compilación, con diagnóstico compartido con Map Packager Studio y restauración de los ajustes.
- Reconocimiento de carpetas anidadas `maps/models`, `maps/sound` y contenido bajo `svencoop_addon`; reubicación solo al empaquetar y solo cuando se identifica inequívocamente el recurso esperado.
- Distribución a carpeta, ZIP o instalación explícita y protegida de recursos en `svencoop_addon`; sin sobrescrituras ni movimientos de archivos originales.
- Smart WAD deja de bloquearse por imágenes distintas para las texturas técnicas `CLIP` y `NULL`, priorizando `zhlt.wad`/`sdhlt.wad`; las colisiones de texturas normales siguen siendo errores.
- Sin reemplazar Map Packager, Prefab Studio ni otros estudios.


### v2.0 Preview UI 4 HF3 (temas, legibilidad y CSS)
- Se elimina el selector CSS incompleto que podía invalidar las reglas posteriores.
- Nuevo puente semántico por componente `interfaceThemeComponents.css`, 1.326
  reglas originales de color/superficie adaptadas a los seis temas.
- Ajustes de encabezados, inputs, estados y acciones de Texture Studio.
- Auditoría de contraste repetible `tests/verify-theme-contrast-hf3.py`.
- Sin cambios en el mapa, compilación, shaders, archivos del juego o editor BSP.
