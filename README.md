



# SvenStudio 3D — Version 1.5.23

**A modern, browser-based 3D map editor for Sven Co-op (GoldSrc / Svengine).**

Created by **KZ-Sheez** with the help of **ChatGPT-6 Astra**.

<p align="center">
  <img src="https://github.com/user-attachments/assets/69959e8e-082f-46f5-9418-8a7e05edb67b" alt="SvenStudio 3D — modern home screen" width="100%" />
</p>

**Languages / Idiomas:** [English](#english) | [Español](#español) | [Screenshots / Galería](#screenshots--galería)

---

## Screenshots / Galería

*Development screenshots from different v1.5.x builds. Some controls, colors, labels or versions may differ from the latest package.*

*Capturas de distintas versiones v1.5.x en desarrollo. Algunos controles, colores, etiquetas o números de versión pueden variar respecto del paquete más reciente.*

### 3D Map Editor / Editor de mapas 3D

<p align="center">
  <img src="https://github.com/user-attachments/assets/64ad59b8-1d4f-4585-9c2f-36b713e5c7e5"Map Editor — editable brush geometry, WAD textures, gizmos and properties" />
</p>

### Terrain & Shape Studio / Estudio de terrenos y formas

<p align="center">
  <img src="assets/screenshots/terrain-shape-studio.png" width="88%" alt="Terrain & Shape Studio — sculpt terrain preview" />
</p>

### Models, NPCs and sounds / Modelos, NPC y sonidos

<p align="center">
  <img src="assets/screenshots/model-browser.png" width="49%" alt="Model Browser — MDL asset thumbnails" />
  <img src="assets/screenshots/npc-ai-studio.png" width="49%" alt="NPC & AI Studio — NPC preview and waypoint tools" />
</p>
<p align="center">
  <img src="assets/screenshots/sound-studio.png" width="85%" alt="Sound & Atmosphere Studio — sound browser and waveform" />
</p>

### Gameplay and cinematic tools / Jugabilidad y cámaras cinematográficas

<p align="center">
  <img src="assets/screenshots/gameplay-logic.png" width="49%" alt="Gameplay Studio — target and targetname visual connections" />
  <img src="assets/screenshots/gameplay-test.png" width="49%" alt="Gameplay Test — first-person map preview" />
</p>
<p align="center">
  <img src="assets/screenshots/cinematic-camera-studio.png" width="88%" alt="Cinematic Camera Studio — native camera entities and path preview" />
</p>

### Advanced lighting and True Lighting / Iluminación avanzada y True Lighting

<p align="center">
  <img src="assets/screenshots/lighting-studio.png" width="86%" alt="Advanced Lighting Studio — light, sky and fog settings" />
</p>
<p align="center">
  <img src="assets/screenshots/true-lighting-preview.png" width="49%" alt="True Lighting — SC-RAD RGB lightmap preview in the editor" />
  <img src="assets/screenshots/in-game-lighting.png" width="49%" alt="Sven Co-op engine — corresponding compiled lighting in game" />
</p>

### BSP Viewer / Visor de mapas BSP

<p align="center">
  <img src="assets/screenshots/bsp-viewer-exterior.png" width="49%" alt="BSP Viewer — exterior map, entities and GoldSrc material preview" />
  <img src="assets/screenshots/bsp-viewer-interior.png" width="49%" alt="BSP Viewer — first-person interior walkthrough" />
</p>

### BuildTogether 2.0 / Edición multijugador

<p align="center">
  <img src="assets/screenshots/buildtogether-session.png" width="43%" alt="BuildTogether — connected multiplayer mapping session" />
  <img src="assets/screenshots/buildtogether-workspace.png" width="55%" alt="BuildTogether — shared map geometry and remote participant cursor" />
</p>

---

## English

### About SvenStudio 3D

**SvenStudio 3D** is a local, browser-based level editor designed to make map creation for **Sven Co-op / Svengine** more accessible without sacrificing the tools needed for complex GoldSrc projects. Build and texture brushes in a 3D viewport, configure entities through FGD definitions, preview gameplay logic, inspect compiled BSP maps, and launch the Sven Co-op compilation pipeline from a single workspace.

The editor combines familiar workflows from traditional level editors with modern viewport navigation, visual controls, reusable structures, smart placement, and diagnostic tools. It is intended for both beginners creating their first room and experienced mappers working on larger environments. This README includes improvements introduced through **v1.5.23**.

### Main features

#### 3D editing and geometry

- **Modern 3D workspace:** Perspective and orthographic views, customizable panels and layouts, a grid, snapping, mouse navigation, and a camera workflow inspired by Roblox Studio (hold right mouse button to look; WASD to move; Q/E to change height).
- **Brush creation and editing:** Create boxes, walls, floors, ceilings, columns, ramps, arches, openings, and other structures; edit vertices, edges, and individual faces.
- **Advanced modeling operations:** CSG Union, Subtract and Intersect; Extrude, Bevel, Inset, Clip, Hollow, and other brush-editing tools.
- **Precision transforms:** Move, Rotate and Scale gizmos, keyboard shortcuts, grid snapping, fine adjustments, numeric dimensions, and improved handling for small brushes.
- **Smart Placement 3D:** Preview and rotate a shape before placing it, align it to surfaces, choose rotation axes, and draw on horizontal or vertical planes. Repeat placement without re-entering dimensions.
- **Architecture tools:** Quickly build wall openings, doors, windows, frames, stairs and other structural elements.
- **Reusable prefabs:** Save a selection of brushes and linked entities as a reusable construction, preserve their relative positions and textures, and place rotated copies in other areas or projects.
- **Organization:** Groups, layers, hide/lock controls, selection tools, measurements, named brushes, and searchable scene objects.
- **Terrain & Shape Studio:** Sculpt solid brush-based terrain, configure size, grid resolution, height, smoothing and noise, and preview the result before applying it, within GoldSrc/Svengine limits.

#### Texture Studio 2.0 and WAD workflow

- **WAD texture browser:** Import WAD archives, browse thumbnails, search by name, and assign materials to brushes and individual faces.
- **Floating Texture Studio:** Edit texture scale U/V, offset U/V, rotation, repetition, centering, and mirroring without leaving the 3D viewport.
- **Direct manipulation:** Move, rotate and resize a face's texture with on-surface controls, including eight scale handles.
- **Smart Fit and Smart Align:** Fit a texture to a face, configure horizontal/vertical tiling, and align materials across adjacent surfaces.
- **Multi-face editing and eyedropper:** Apply materials or UV settings to multiple faces, copy from another face, and save reusable texture presets.
- **Texture Lock:** Preserve texture placement relative to brushes while moving them, including grid-snapped movement and duplicated objects.
- **GoldSrc / Valve 220 UV compatibility:** Use texture dimensions and axis orientation for a more faithful preview and export; detect and repair certain invalid texture-axis combinations that can affect SC-RAD.
- **WAD session persistence:** Reopen previously imported WAD data on the same browser profile and local origin when browser storage is available. Compilation still requires valid game/SDK WAD paths.

#### Entities, gameplay and logic

- **FGD-based entity editor:** Import Sven Co-op FGD definitions, inspect class descriptions, edit native keyvalues, and work with additional custom FGD entity classes.
- **Entity Assistant:** Contextual mini guides explaining what an entity does, relevant properties, usage examples and available capabilities. Open an expanded guide for comfortable reading.
- **Beginner and advanced properties:** Quick controls for common tasks alongside full access to original FGD keyvalues for experienced mappers.
- **Gameplay Studio:** Visualize entities as nodes, search and connect `target` to `targetname`, and inspect missing or invalid connections.
- **Named brushes and searchable targets:** Give brushes a custom editor name (for example, *Laboratory Door*) and find them in the Explorer and entity connection picker. Editor-only names remain separate from Svengine's `targetname`.
- **Door and button controls:** Configure `func_door` movement direction, speed, travel, wait time, button activation, and sounds through guided properties.
- **Detach brush entities:** Convert one or multiple brushes belonging to a `func_*` or brush-based trigger entity back to normal `worldspawn` geometry without deleting their shape or textures, with Undo/Redo support.
- **Smart entity markers:** Automatic shapes for useful entity classes (lights, buttons, doors, sounds, player starts, triggers, etc.) or a single uniform shape for all entities; adjustable marker size, colors and appearance.
- **Entity X-Ray selection:** Display and select entity markers through brush geometry, with an optional normal depth mode and modifier-based selection.
- **Optimized entity labels:** Camera-aware limits, reduced overlap, selected-entity priority, and lightweight display settings for dense maps.
- **Player start visualization:** `info_player_start` model preview with idle animation where supported, ground alignment preview, and a visible/configurable initial facing direction.
- **NPC & AI Studio:** Browse NPC classes, preview supported models, place NPCs, create paths, waypoints, and spawners, and check common configuration errors.

#### BuildTogether 2.0 — multiplayer mapping

- Collaborate on a map from separate browsers through a local WebSocket session with a host and invited participants.
- Synchronize brushes, entities, editing selections and remote cursors; follow another participant's camera when needed.
- Includes smoother cursor updates, reconnection/recovery improvements, and safer batching for large terrain changes.
- Each participant uses local WAD/FGD/MDL and SDK resources; these files are **not** transferred over BuildTogether.
- Supports virtual LAN workflows such as Pothole. Prefer trusted private networks; do not expose a session code or the server port publicly.

#### Sound, models and visual previews

- **Sound & Atmosphere Studio:** Browse available Sven Co-op WAV/OGG audio, preview supported files, inspect waveforms, convert audio, configure ambience and assign sound paths to native entities.
- **Sound and action helpers:** Set up button sounds, door movement/stop sounds and audio-related keyvalues; use `ambient_generic` or relays for more advanced sequences.
- **MDL Model Browser:** Browse Sven Co-op models and inspect their animations, skins and bodygroups; preview supported assets in the editor.
- **Advanced Lighting Studio:** Configure `light`, `light_spot`, `light_environment`, skyboxes, fog, lightstyles and advanced SC-RAD settings. The standard viewport preview remains approximate.
- **True Lighting:** Preview compiled BSP lightmaps with SC-RAD RGB lighting inside the editor, including a diagnostic view; compiled lighting remains the reference for fidelity.
- **GoldSrc materials:** Visual previews of water, glass, masked textures, transparency and additive effects, subject to differences from in-game rendering.
- **Shading modes:** Wireframe, Solid, Material Preview and Rendered, including a Blender-inspired shading pie menu.
- **Cinematic Camera Studio:** Arrange native Sven Co-op camera entities, preview paths and scenes, configure timing and camera keyvalues, and validate routes. The preview is approximate and must be verified in-game.

#### BSP, gameplay testing and compilation

- **Advanced BSP Viewer:** Inspect compiled BSP maps, geometry, textures, baked RGB lightmaps, skyboxes, entities and supported models, with smart labels, improved rendering and interior/exterior navigation.
- **BSP-to-MAP / recovery tools:** Experimental recovery and inspection workflows for existing BSP files; reconstructed geometry, texture alignment and lighting may differ from the original source.
- **Player Walk and Gameplay Test:** Explore an editable map in first person with WASD, mouse look, jumping, sprinting, crouching, gravity, collisions and noclip options.
- **Player flashlight and HUD:** Flashlight, coordinates, speed readouts, FPS-only counter, and customizable/movable HUD elements.
- **Integrated Sven Co-op SDK compilation:** Run **SC-CSG, SC-BSP, SC-VIS and SC-RAD** through the local tooling and inspect their output.
- **Valve 220 MAP import/export:** Save maps for the GoldSrc/Svengine toolchain, with geometry validation and warnings for unsupported or potentially lossy imports.
- **Map Doctor 2.0:** Detect issues with geometry, entities, textures, resources, SKY enclosure and compilation; display warnings including UV-axis alignment repairs.
- **Visual leak tracing:** Import compiler `.pts`/`.lin` point files and inspect leak routes in 3D, including navigation to their endpoints.
- **Automatic SKY enclosure:** Generate a sealed hollow SKY boundary to help prevent common map leaks.
- **Compilation diagnostics:** Review messages and errors from the compilation tools, including face, texture, leak, light and resource issues.
- **Map Packager:** Tools for collecting and organizing resources needed by a map for distribution.

#### Workflow, performance and accessibility

- **Optimized for larger maps:** Rendering presets, progressive asset loading, optimized labels, and options for controlling editor visual complexity.
- **Autosave and recovery:** Session restoration, project checkpoints, validation, and safeguards for incomplete or damaged imports.
- **Customizable/adaptive UI:** Dockable/resizable panels, compact responsive toolbars, themes, contextual menus, configurable HUD and workspace layouts, including improved behavior with Windows display scaling.
- **Fullscreen editing:** Optional browser fullscreen with Keyboard Lock where supported. Some browser/system shortcuts cannot be intercepted in every environment.
- **Multilingual interface:** Spanish, English, Russian and Korean, with technical FGD classnames and keyvalues preserved in their original form.
- **Windows launcher and branding:** `SvenStudio3D.bat`, application icon, desktop shortcut and browser favicon.
- **Build configuration convenience:** Folder browsing and discovery of Sven Co-op and SDK compiler locations across registered Steam libraries, including other drives, where available.

### Example: a button opens a door

1. Create a brush-based **`func_door`** and assign it `targetname = door_01`.
2. Create a **`func_button`** and set `target = door_01`, or select the named door through the Entity Assistant.
3. Configure the door's opening direction, movement speed, `wait` and `lip` from the basic properties or the expanded guide.
4. Assign a button sound and optional door movement/stop sounds using supported keyvalues or the sound picker.
5. Check the connection in **Gameplay Studio**, compile the map, and verify the mechanism inside Sven Co-op.

### Requirements

- **Node.js 22 or newer** — required for the local editor and its development server.
- **Sven Co-op SDK / compatible SC compilation tools** — required to compile BSP maps.
- **Sven Co-op** — required for testing and playing compiled maps.
- **A modern desktop browser** — Chrome or another compatible Chromium-based browser is recommended for the local editor.

### Installation

1. Download the latest package from [Releases](../../releases) and extract it to a folder.
2. Install [Node.js](https://nodejs.org/) (version 22 or newer).
3. Launch **`SvenStudio3D.bat`** on Windows.
4. Open the local address shown by the launcher in your browser.
5. Use **Build Configuration** to browse for Sven Co-op/SDK folders or detect registered Steam libraries, then configure FGD/WAD resources as needed.

> **Note:** SvenStudio 3D runs locally in the browser. The browser interface alone cannot run Windows SDK compilers; compilation depends on the local backend and configured Sven Co-op tools. Visual previews (especially lighting, textures and recovered BSPs) should be checked in-game before release.

### Feedback and collaboration

I would appreciate help testing, reporting issues, contributing improvements and expanding the project. Please contact me on Discord or Steam.

- **Discord:** `kzsheez`
- **Steam:** https://steamcommunity.com/id/KazamiiSC

---

## Español

### Acerca de SvenStudio 3D

**SvenStudio 3D** es un editor de niveles 3D que funciona localmente en el navegador y está diseñado para facilitar la creación de mapas para **Sven Co-op / Svengine**, sin renunciar a las herramientas que necesitan los proyectos avanzados de GoldSrc. Permite construir y texturizar brushes en un visor 3D, configurar entidades a partir de archivos FGD, organizar conexiones de jugabilidad, inspeccionar BSP compilados y ejecutar el proceso de compilación desde un mismo entorno.

Combina herramientas clásicas de creación de mapas con controles modernos, construcción reutilizable, colocación inteligente y diagnóstico. Está pensado tanto para personas que crean su primera habitación como para mappers experimentados que trabajan en escenarios grandes. Este README incluye las mejoras incorporadas hasta **v1.5.23**.

### Características principales

#### Editor 3D y geometría

- **Espacio de trabajo 3D moderno:** Vistas en perspectiva y ortográficas, paneles configurables, cuadrícula, snapping y navegación inspirada en Roblox Studio (mantener clic derecho para mirar; WASD para moverse; Q/E para bajar y subir).
- **Creación y edición de brushes:** Construcción de bloques, paredes, pisos, techos, columnas, rampas, arcos, aberturas y otras estructuras, con edición de vértices, aristas y caras.
- **Modelado avanzado:** Operaciones CSG de Unión, Sustracción e Intersección, además de Extrude, Bevel, Inset, Clip, Hollow y otras herramientas de geometría.
- **Transformaciones precisas:** Gizmos de mover, rotar y escalar, atajos, ajuste a grilla, control fino, dimensiones numéricas y mejoras para objetos pequeños.
- **Smart Placement 3D:** Previsualización y giro de formas antes de colocarlas, alineación con superficies, elección de ejes y dibujo sobre planos horizontales y verticales. Permite repetir objetos sin volver a ingresar medidas.
- **Herramientas de arquitectura:** Creación rápida de aberturas, puertas, ventanas, marcos, escaleras y otras estructuras.
- **Prefabs reutilizables:** Guardar grupos de brushes y entidades vinculadas, conservar posiciones relativas y texturas, y colocar copias rotadas en otro lugar o proyecto.
- **Organización:** Grupos, capas, ocultar/bloquear, selección, medición de distancias, nombres personalizados para brushes y búsqueda de objetos.
- **Terrain & Shape Studio:** Modelado de terreno sólido basado en brushes, con control de tamaño, resolución, altura, suavizado y ruido, y vista previa antes de aplicar cambios, dentro de las limitaciones de GoldSrc/Svengine.

#### Texture Studio 2.0 y texturas WAD

- **Explorador WAD:** Importar archivos WAD, recorrer miniaturas, buscar texturas y aplicarlas a brushes o caras individuales.
- **Texture Studio flotante:** Ajustar escala U/V, desplazamiento U/V, rotación, repetición, centrado e inversión desde una mini interfaz sin salir del visor 3D.
- **Edición directa con mouse:** Mover, girar y cambiar el tamaño de la textura sobre la cara, con ocho manejadores de escala.
- **Smart Fit y Smart Align:** Ajustar una textura al tamaño de una cara, configurar repeticiones y alinear materiales entre superficies contiguas.
- **Selección múltiple y cuentagotas:** Aplicar materiales o ajustes UV a varias caras, copiar desde otra superficie y guardar presets reutilizables.
- **Texture Lock:** Mantener las texturas fijadas al brush cuando se mueve, incluso con snapping y duplicación.
- **Compatibilidad GoldSrc / Valve 220:** Cálculos basados en dimensiones de textura y orientación de ejes para aproximar la apariencia final; detección y reparación de ciertas combinaciones inválidas que pueden afectar a SC-RAD.
- **Persistencia de WAD:** Recuperación de WAD importadas al reutilizar el mismo perfil y dirección local, cuando el almacenamiento del navegador lo permite. Para compilar siguen siendo necesarias rutas válidas del juego/SDK.

#### Entidades, jugabilidad y lógica

- **Editor de entidades FGD:** Importar definiciones de Sven Co-op, consultar sus descripciones y editar keyvalues originales, incluidas clases personalizadas de otros FGD.
- **Asistente de entidades:** Mini guías contextuales sobre qué hace cada entidad, qué propiedades utiliza, ejemplos prácticos y capacidades disponibles; incluye una guía ampliada para leer cómodamente.
- **Propiedades básicas y avanzadas:** Controles sencillos para tareas comunes y acceso completo a keyvalues FGD para usuarios experimentados.
- **Gameplay Studio:** Visualizar entidades como nodos, buscar y conectar `target` con `targetname`, e identificar conexiones inválidas o inexistentes.
- **Nombres personalizados y conexiones buscables:** Dar a un brush un nombre como *Puerta del laboratorio* y encontrarlo en el Explorador y el selector de conexiones. El nombre del editor es independiente del `targetname` que utiliza el motor.
- **Puertas y botones:** Configurar dirección de apertura de `func_door`, velocidad, recorrido, espera, activación desde botones y sonidos mediante controles explicados.
- **Desvincular entidades de brushes:** Convertir uno o varios brushes de una entidad `func_*` o trigger sólida en geometría normal de `worldspawn`, conservando sus texturas y forma, con Deshacer/Rehacer.
- **Formas inteligentes de entidades:** Indicadores automáticos para luces, botones, puertas, sonidos, spawns y triggers, o una única forma para todas las entidades; tamaños, colores y apariencia configurables.
- **Selección X-Ray de entidades:** Ver y seleccionar indicadores a través de brushes, con modo de profundidad normal y selección mediante modificador.
- **Etiquetas optimizadas:** Límites según cámara y distancia, reducción de superposiciones, prioridad para entidades seleccionadas y opciones livianas para mapas densos.
- **Vista previa del jugador inicial:** `info_player_start` con modelo, idle cuando está disponible, alineación visual con el suelo y dirección inicial visible y configurable.
- **NPC & AI Studio:** Exploración de clases NPC, vista previa de modelos compatibles, colocación de NPC, creación de rutas, waypoints y spawners, y validaciones de configuración.

#### BuildTogether 2.0 — creación de mapas en multijugador

- Colaboración sobre un mismo mapa desde distintos navegadores mediante sesiones WebSocket locales con anfitrión e invitados.
- Sincronización de brushes, entidades, selecciones y cursores remotos; opción para seguir la cámara de otra persona.
- Incluye cursores más suaves, mejoras de reconexión/recuperación y envío por lotes más seguro para terrenos grandes.
- Cada participante utiliza sus recursos WAD/FGD/MDL y el SDK local; estos archivos **no** se transfieren durante la sesión.
- Compatible con redes LAN virtuales como Pothole. Se recomienda una red privada de confianza y no exponer públicamente el puerto o código de sesión.

#### Sonidos, modelos y vista previa

- **Sound & Atmosphere Studio:** Exploración de archivos WAV/OGG de Sven Co-op, vista previa de formatos compatibles, análisis de formas de onda, conversión de audio, ambientes y asignación de rutas a entidades nativas.
- **Asistentes de sonido y acciones:** Sonido de botones, sonidos de movimiento y detención de puertas, y keyvalues de audio; soporte para `ambient_generic` y relays en secuencias más complejas.
- **Explorador de modelos MDL:** Navegar modelos de Sven Co-op, inspeccionar animaciones, skins y bodygroups y previsualizar recursos compatibles.
- **Advanced Lighting Studio:** Configuración de `light`, `light_spot`, `light_environment`, skyboxes, niebla, estilos de iluminación y ajustes avanzados de SC-RAD. La vista previa normal sigue siendo aproximada.
- **True Lighting:** Vista de lightmaps RGB provenientes de la compilación SC-RAD de BSP dentro del editor, con diagnóstico; el resultado compilado es la referencia de fidelidad.
- **Materiales GoldSrc:** Vistas previas de agua, vidrio, texturas enmascaradas, transparencias y efectos aditivos, con posibles diferencias respecto al juego.
- **Modos de sombreado:** Wireframe, Solid, Material Preview y Rendered, con menú radial inspirado en Blender.
- **Cinematic Camera Studio:** Creación de escenas mediante entidades de cámara nativas de Sven Co-op, rutas, tiempos, keyvalues y validación. La vista previa es aproximada y se debe verificar dentro del juego.

#### BSP, pruebas y compilación

- **Visor BSP avanzado:** Inspección de mapas BSP compilados, geometría, texturas, lightmaps RGB horneados, skyboxes, entidades y modelos compatibles, con etiquetas inteligentes, renderizado mejorado y navegación interior/exterior.
- **Herramientas BSP a MAP / recuperación:** Funciones experimentales para inspeccionar y reconstruir mapas a partir de BSP; la geometría, las UV o la iluminación recuperadas pueden diferir del proyecto original.
- **Player Walk y Gameplay Test:** Recorrer mapas en primera persona con WASD, mouse, salto, carrera, agacharse, gravedad, colisiones y opciones noclip.
- **Linterna y HUD:** Linterna, coordenadas, velocidad, monitor que muestra únicamente FPS y elementos del HUD movibles y personalizables.
- **Compilación integrada:** Ejecución local de **SC-CSG, SC-BSP, SC-VIS y SC-RAD** con acceso a sus registros.
- **Importación/exportación MAP Valve 220:** Compatibilidad con herramientas de GoldSrc/Svengine, validación de geometría y advertencias cuando una importación podría perder datos incompatibles.
- **Map Doctor 2.0:** Comprobación de geometría, entidades, texturas, recursos, SKY y errores de compilación; advertencias sobre ejes UV reparados.
- **Detección visual de LEAK:** Importación de recorridos `.pts`/`.lin` generados por los compiladores y visualización 3D de fugas, con navegación a sus extremos.
- **Cerramiento SKY automático:** Generación de un recinto SKY hueco y sellado para ayudar a evitar fugas comunes.
- **Diagnóstico avanzado:** Registro de mensajes y errores de compilación relacionados con caras, texturas, LEAK, luces y archivos faltantes.
- **Map Packager:** Herramientas para recopilar y organizar recursos necesarios para distribuir mapas.

#### Flujo de trabajo, rendimiento y accesibilidad

- **Optimización para mapas grandes:** Perfiles de rendimiento, carga progresiva, etiquetas optimizadas y ajustes para reducir el coste de los elementos visuales.
- **Guardado automático y recuperación:** Restauración de sesión, puntos de recuperación, validación de proyectos y protecciones ante importaciones incompletas o dañadas.
- **Interfaz personalizable y adaptable:** Paneles acoplables y redimensionables, barras responsivas, temas, menús contextuales, HUD configurable y mejoras para distintas escalas de pantalla de Windows.
- **Pantalla completa:** Modo opcional con Keyboard Lock cuando el navegador lo permite. Algunos atajos del navegador o del sistema no se pueden bloquear en todos los equipos.
- **Interfaz multilingüe:** Español, inglés, ruso y coreano; los `classname` y keyvalues técnicos FGD se conservan con sus nombres originales.
- **Lanzador e identidad visual para Windows:** `SvenStudio3D.bat`, icono de aplicación, acceso directo y favicon del navegador.
- **Configuración de compilación más sencilla:** Exploración de carpetas y búsqueda de Sven Co-op y sus compiladores SDK en bibliotecas Steam registradas, incluso en otras unidades cuando están disponibles.

### Ejemplo práctico: botón que abre una puerta

1. Creá una puerta de tipo **`func_door`** y asignale `targetname = door_01`.
2. Creá un **`func_button`** y configurá `target = door_01`, o elegí la puerta por su nombre personalizado desde el Asistente de entidades.
3. Configurá la dirección de apertura, velocidad, `wait` y `lip` desde las propiedades básicas o la guía ampliada.
4. Asigná un sonido al botón y, si querés, sonidos de movimiento y detención de la puerta desde los keyvalues compatibles o el selector de audio.
5. Verificá la conexión en **Gameplay Studio**, compilá y probá el mecanismo en Sven Co-op.

### Requisitos

- **Node.js 22 o superior** — necesario para el editor local y su servidor de desarrollo.
- **SDK de Sven Co-op / herramientas SC compatibles** — necesarias para generar mapas BSP.
- **Sven Co-op** — necesario para probar y jugar los mapas compilados.
- **Navegador de escritorio moderno** — se recomienda Chrome u otro navegador compatible basado en Chromium.

### Instalación

1. Descargá el último paquete desde [Releases](../../releases) y extraelo en una carpeta.
2. Instalá [Node.js](https://nodejs.org/) (versión 22 o superior).
3. Ejecutá **`SvenStudio3D.bat`** en Windows.
4. Abrí en el navegador la dirección local indicada por el lanzador.
5. Usá **Configuración de compilación** para buscar las carpetas de Sven Co-op/SDK o detectar bibliotecas Steam registradas y después configurá recursos FGD/WAD si es necesario.

> **Nota:** SvenStudio 3D funciona localmente desde el navegador. La interfaz web por sí sola no ejecuta los compiladores de Windows; para compilar se necesita el backend local y las herramientas de Sven Co-op configuradas. Las vistas previas —especialmente iluminación, texturas y BSP recuperados— deben comprobarse dentro del juego antes de publicar un mapa.

### Comentarios y colaboración

Agradecería ayuda para probar el editor, informar errores, aportar mejoras y ampliar el proyecto. Podés contactarme por Discord o Steam.

- **Discord:** `kzsheez`
- **Steam:** https://steamcommunity.com/id/KazamiiSC

---
