<div align="center">

# SvenStudio 3D

###
**A modern browser-based level editor for Sven Co-op · GoldSrc · Svengine**

[![Release](https://img.shields.io/badge/RELEASE-v1.7.19-7058e8?style=for-the-badge)](https://github.com/KazamiiSC/SvenStudio3D/releases)
![Platform](https://img.shields.io/badge/PLATFORM-Windows%20x64-2384b8?style=for-the-badge)
![Engine](https://img.shields.io/badge/ENGINE-GoldSrc%20%2F%20Svengine-168c9c?style=for-the-badge)
![Languages](https://img.shields.io/badge/LANGUAGES-6-364d78?style=for-the-badge)

[**Download Release**](https://github.com/KazamiiSC/SvenStudio3D/releases) · [**Features**](#-features-at-a-glance) · [**Screenshots**](#-screenshots) · [**Installation**](#-get-started) · [**English / Español**](#-full-documentation--documentación-completa)

<img src="https://github.com/user-attachments/assets/69959e8e-082f-46f5-9418-8a7e05edb67b" alt="SvenStudio 3D home screen" width="100%" />

**Created by KZ-Sheez · AI-assisted development**

</div>

> [!IMPORTANT]
> **v1.7** not a claim of zero bugs. Keep backups and verify compiled maps in Sven Co-op. Advanced features such as SDHLT and BuildTogether are experimental.

---

## ✦ Features at a glance

| Create & edit | Design & test | Compile & collaborate |
| :--- | :--- | :--- |
| **3D MAP Editor** — brushes, CSG, vertices, edges & faces | **Gameplay Studio 3.0** — spatial entity logic & events | **SC SDK** — CSG, BSP, VIS & RAD |
| **Texture Studio 2.0** — WAD, UV, alignment & texture lock | **True Lighting** — baked RGB preview, SC-RAD / SDHLT | **SDHLT (experimental)** — AO & PCF options |
| **Terrain & Shape Studio** — brush-based terrain | **BSP Viewer** — lighting, models & map inspection | **BuildTogether** — shared editing & remote cameras |
| **Architecture, prefabs & smart placement** | **NPC & AI, sounds, cinematic cameras** | **Map Doctor, leak tracing & packaging** |

<div align="center">

**Edit in your browser** · **Compile with local tools** · **No system-wide Node.js installation for the complete Windows release**

</div>

---

## ✦ Screenshots

### 01 / Map Editor — Create with precision

<p align="center"><img src="https://github.com/user-attachments/assets/64ad59b8-1d4f-4585-9c2f-36b713e5c7e5" alt="SvenStudio 3D map editor" width="100%" /></p>

### 02 / True Lighting — See compiled lightmaps

<p align="center">
  <img src="https://github.com/user-attachments/assets/5cc010c2-4c1c-4e51-a81b-509cd269de8c" alt="True Lighting compiled preview" width="49%" />
  <img src="https://github.com/user-attachments/assets/12e52d0a-acd2-428d-a4ef-2cb3261e9df9" alt="Corresponding lighting in Sven Co-op" width="49%" />
</p>

<sub>Left: editor preview · Right: Sven Co-op. Results depend on compiler settings and map content.</sub>

### 03 / BSP Viewer — Explore compiled maps

<p align="center">
  <img src="https://github.com/user-attachments/assets/0a340e23-3440-474d-944e-7b479fb6f65f" alt="BSP Viewer exterior" width="49%" />
  <img src="https://github.com/user-attachments/assets/689e0298-c743-4da3-b049-cc5a721a4a94" alt="BSP Viewer interior" width="49%" />
</p>

<details>
<summary><b>Explore more screenshots / Ver más capturas</b></summary>

#### Terrain & Shape Studio
<p align="center"><img src="https://github.com/user-attachments/assets/e7c19164-1c08-49ee-abca-f5383405e03f" alt="Terrain studio" width="88%" /></p>

#### Models & NPCs
<p align="center"><img src="https://github.com/user-attachments/assets/d22a8684-fe95-4350-8feb-c8d46c9174ff" alt="Model Browser" width="49%" /> <img src="https://github.com/user-attachments/assets/c9bcc851-fa11-4043-9dde-29281cb78a03" alt="NPC & AI Studio" width="49%" /></p>

#### Sound & Atmosphere
<p align="center"><img src="https://github.com/user-attachments/assets/4de5587f-3894-46ea-95d1-4a45277e42a6" alt="Sound Studio" width="85%" /></p>

#### Gameplay & Cinematic Cameras
<p align="center"><img src="https://github.com/user-attachments/assets/0db538e3-1c8d-4ceb-9239-c7709c591724" alt="Gameplay Studio" width="49%" /> <img src="https://github.com/user-attachments/assets/a2ce221e-b7e8-4c9d-bcb2-06a24e076261" alt="Gameplay Test" width="49%" /></p>
<p align="center"><img src="https://github.com/user-attachments/assets/e33d1462-98fb-4b9f-910a-f11a083b4206" alt="Cinematic Camera Studio" width="88%" /></p>

#### Lighting & Environment Studio
<p align="center"><img src="https://github.com/user-attachments/assets/6b46a39f-cd47-49d8-b3df-d125acea01fc" alt="Lighting Studio" width="86%" /></p>

#### BuildTogether
<p align="center"><img src="https://github.com/user-attachments/assets/78416736-1a14-4921-ac33-0fde055751ee" alt="BuildTogether collaborative session" width="43%" /> <img src="https://github.com/user-attachments/assets/c982e261-14e6-4564-a1a1-2cabd499140b" alt="BuildTogether map collaboration" width="55%" /></p>

</details>

---

## ✦ What's new in 1.7

- **Gameplay Studio 3.0:** Interactive top/isometric entity map, event inspection, filters and native keyvalue connections.
- **SC-RAD + SDHLT True Lighting:** Preview compiled RGB lightmaps; optional SDHLT AO and PCF settings, explicit compiler selection and a free-camera preview.
- **Improved workspace:** Docking/layout fixes, scalable panels and fullscreen camera controls.
- **BuildTogether upgrades:** Remote camera visualization, selection sharing, synchronization and reconnection improvements.
- **Easier Windows startup:** Local Node.js runtime managed by the launcher; no separate system-wide installation for the complete package.
- **Six UI languages:** English, Español, Русский, 한국어, 简体中文 and Português (Brasil).

---

## ✦ Get started

**Complete Windows release / Versión completa para Windows**

1. [**Download the complete ZIP / Descargá el ZIP completo**](https://github.com/KazamiiSC/SvenStudio3D/releases) and extract everything.
2. Run **`SvenStudio3D.bat`**. If the local Node.js runtime is missing, the launcher downloads it on the first run; subsequent starts can work offline.
3. SvenStudio opens in your browser. If needed, visit **`http://127.0.0.1:5173`**.
4. In **Build Configuration**, select the Sven Co-op SDK, game folders and required WAD/FGD resources.
5. For **SDHLT**, select **SDHLT — Experimental** and point it to **`tools/`** (or the folder containing its four `sdHL*_x64.exe` compilers). Make `sdhlt.wad` available in the WAD paths.

> [!NOTE]
> **SDHLT is already included in the complete Windows distribution**, so a separate SDHLT download is unnecessary. The source-code archive is different: it excludes preinstalled `node_modules` and requires Node.js/npm for development.

### Quick controls / Controles rápidos

| Keys | Action / Acción |
| :---: | :--- |
| `W A S D` · `Q / E` | Camera movement / Movimiento de cámara |
| `G` · `R` · `C` | Move · Rotate · Scale / Mover · Rotar · Escalar |
| `Right Mouse` | Camera look / Girar cámara |
| `Z` | Point-selectable shading menu / Menú radial de sombreado |
| `Ctrl+C` · `Ctrl+V` | Copy · Duplicate / Copiar · Duplicar |
| `Esc` · `F8` | Cancel/release camera · True Lighting fallback / Cancelar/liberar cámara |

**Controls depend on context.** `Ctrl+D` is intentionally not used for duplication. Fullscreen Escape capture depends on browser permissions.

---

## ✦ Full documentation / Documentación completa

Both language references below preserve detailed tool descriptions, limitations, requirements and examples from the project's original documentation.

<details>
<summary><b>English — features, tools, setup, controls and troubleshooting notes</b></summary>

### About SvenStudio 3D

**SvenStudio 3D** is a local, browser-based level editor designed to make map creation for **Sven Co-op / Svengine** more accessible without sacrificing the tools needed for complex GoldSrc projects. Build and texture brushes in a 3D viewport, configure entities through FGD definitions, preview gameplay logic, inspect compiled BSP maps, and launch the Sven Co-op compilation pipeline from a single workspace.

The editor combines familiar workflows from traditional level editors with modern viewport navigation, visual controls, reusable structures, smart placement, and diagnostic tools. It is intended for both beginners creating their first room and experienced mappers working on larger environments. This README describes the **v1.7.19 release candidate**. Some advanced features are experimental and should be validated in Sven Co-op.

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
- **Gameplay Studio 3.0:** Interactive top/isometric entity map, spatial selection, search and filters, native `target`/`targetname` relationships, event inspection, entity properties and static checks. Gameplay Studio 3.0 keeps its own feature name independently of the editor version.
- **Named brushes and searchable targets:** Give brushes a custom editor name (for example, *Laboratory Door*) and find them in the Explorer and entity connection picker. Editor-only names remain separate from Svengine's `targetname`.
- **Door and button controls:** Configure `func_door` movement direction, speed, travel, wait time, button activation, and sounds through guided properties.
- **Detach brush entities:** Convert one or multiple brushes belonging to a `func_*` or brush-based trigger entity back to normal `worldspawn` geometry without deleting their shape or textures, with Undo/Redo support.
- **Smart entity markers:** Automatic shapes for useful entity classes (lights, buttons, doors, sounds, player starts, triggers, etc.) or a single uniform shape for all entities; adjustable marker size, colors and appearance.
- **Entity X-Ray selection:** Display and select entity markers through brush geometry, with an optional normal depth mode and modifier-based selection.
- **Optimized entity labels:** Camera-aware limits, reduced overlap, selected-entity priority, and lightweight display settings for dense maps.
- **Player start visualization:** `info_player_start` model preview with idle animation where supported, ground alignment preview, and a visible/configurable initial facing direction.
- **NPC & AI Studio:** Browse NPC classes, preview supported models, place NPCs, create paths, waypoints, and spawners, and check common configuration errors.

#### BuildTogether — Multiplayer Mapping

*Collaborate on a map from separate browsers through a local WebSocket session with a host and invited participants.
Synchronize brushes, entities, editing selections and remote cursors; follow another participant's camera when needed.
Includes smoother cursor updates, reconnection/recovery improvements, and safer batching for large terrain changes.
Each participant uses local WAD/FGD/MDL and SDK resources; these files are not transferred over BuildTogether.
Tested with ***Porthole — Local Port Sharing***: Real multiplayer testing was performed between two participants using Porthole's private-network TCP port sharing. This confirms that the tested setup worked, but does not guarantee compatibility with every network or project.
Experimental feature: BuildTogether may still contain bugs, synchronization issues or unexpected behavior, especially with complex tools or large maps. Save backup copies of your project and report any problems you encounter.
Security: Use trusted private networks only. Do not publicly share session codes or expose the server port directly to the Internet.*

#### Sound, models and visual previews

- **Sound & Atmosphere Studio:** Browse available Sven Co-op WAV/OGG audio, preview supported files, inspect waveforms, convert audio, configure ambience and assign sound paths to native entities.
- **Sound and action helpers:** Set up button sounds, door movement/stop sounds and audio-related keyvalues; use `ambient_generic` or relays for more advanced sequences.
- **MDL Model Browser:** Browse Sven Co-op models and inspect their animations, skins and bodygroups; preview supported assets in the editor.
- **Advanced Lighting Studio:** Configure `light`, `light_spot`, `light_environment`, skyboxes, fog, lightstyles and advanced SC-RAD settings. The standard viewport preview remains approximate.
- **True Lighting (Studies):** Preview baked RGB lightmaps from **SC-RAD** or optional **SDHLT**, select the compiler before rebuilding, and inspect the resulting BSP lighting. SDHLT supports experimental AO/PCF options when available. Rebuilding displays a warning because compilation may take time and affect performance. Enlarged preview uses its own free camera (WASD, Q/E, mouse; Esc or F8 releases cursor where supported). Rendered lightmaps are more faithful than approximate real-time preview, but final results should still be checked in-game.
- **GoldSrc materials:** Visual previews of water, glass, masked textures, transparency and additive effects, subject to differences from in-game rendering.
- **Shading modes:** Wireframe, Solid, Material Preview and Rendered, including a pointer-selectable radial shading menu.
- **Cinematic Camera Studio:** Arrange native Sven Co-op camera entities, preview paths and scenes, configure timing and camera keyvalues, and validate routes. The preview is approximate and must be verified in-game.

#### BSP, gameplay testing and compilation

- **Advanced BSP Viewer:** Inspect compiled BSP maps, geometry, textures, baked RGB lightmaps, skyboxes, entities and supported models, with smart labels, improved rendering and interior/exterior navigation.
- **BSP-to-MAP / recovery tools:** Experimental recovery and inspection workflows for existing BSP files; reconstructed geometry, texture alignment and lighting may differ from the original source.
- **Player Walk and Gameplay Test:** Explore an editable map in first person with WASD, mouse look, jumping, sprinting, crouching, gravity, collisions and noclip options.
- **Player flashlight and HUD:** Flashlight, coordinates, speed readouts, FPS-only counter, and customizable/movable HUD elements.
- **Integrated compilation:** Use **SC-CSG / SC-BSP / SC-VIS / SC-RAD** by default, or configure **SDHLT** as an optional experimental toolchain. Executables and compatible resource paths are required; SDHLT may produce different lighting or hit different map limits.
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
- **Multilingual interface:** English, Spanish, Russian, Korean, Simplified Chinese and Brazilian Portuguese; native FGD classnames and keyvalues are not translated.
- **Windows launcher and branding:** `SvenStudio3D.bat` starts the local editor with a bundled/download-on-first-launch Node.js runtime (no system-wide Node.js installation required); launcher messages follow the Windows display language where supported, otherwise English.
- **Build configuration convenience:** Folder browsing and discovery of Sven Co-op and SDK compiler locations across registered Steam libraries, including other drives, where available.

### Controls and shortcuts

| Control | Action |
| --- | --- |
| Right mouse button + mouse | Look around in the MAP editor |
| WASD / Q / E | Move camera / down and up (when navigation has focus) |
| G / R / C | Move / rotate / scale selected geometry |
| Left click / right click | Confirm / cancel an active transform where applicable |
| Z | Radial shading menu (point at the choice) |
| Ctrl+C / Ctrl+V | Copy / duplicate selection |
| Esc | Cancel tool or release supported free-camera capture |
| F8 | Alternative cursor release in True Lighting free-camera mode |
| Shift | Faster movement in supported free-camera views |

**Fullscreen:** A long Escape press (about 1.5 seconds) may exit fullscreen where Keyboard Lock is supported. Browser-reserved shortcuts cannot always be intercepted. `Ctrl+D` is intentionally not used for duplication. Actual bindings depend on editor context and configurable shortcuts.

### Example: a button opens a door

1. Create a brush-based **`func_door`** and assign it `targetname = door_01`.
2. Create a **`func_button`** and set `target = door_01`, or select the named door through the Entity Assistant.
3. Configure the door's opening direction, movement speed, `wait` and `lip` from the basic properties or the expanded guide.
4. Assign a button sound and optional door movement/stop sounds using supported keyvalues or the sound picker.
5. Check the connection in **Gameplay Studio**, compile the map, and verify the mechanism inside Sven Co-op.

### Requirements

- **Windows x64** for the provided launcher and included Windows dependencies. A recent Chromium-based desktop browser is recommended.
- **Internet on first launch only if the local Node.js runtime has not yet been downloaded.** A global Node.js installation is not required to run the packaged Windows release.
- **Sven Co-op SDK / compatible SC compilation tools** — required to compile BSP maps.
- **Sven Co-op** — required for testing and playing compiled maps.

### Installation

1. Download the complete Windows package from [Releases](https://github.com/KazamiiSC/SvenStudio3D/releases) and extract **all** files to a writable folder.
2. Run **`SvenStudio3D.bat`**. On the first run, if the Node.js runtime is missing, the launcher downloads it once; subsequent launches can work offline. **Do not run `npm install`** for the complete packaged release.
3. Open the local address displayed by the launcher (normally `http://127.0.0.1:5173`) if the browser does not open automatically.
4. Use **Build Configuration** to choose Sven Co-op/SDK compiler folders and required WAD/FGD files.
5. **SDHLT is already included in the complete Windows package**, inside the `tools` folder. In **Build Configuration**, choose **SDHLT — Experimental** and point the SDHLT tool directory to that folder (or the subfolder containing `sdHLCSG_x64.exe`, `sdHLBSP_x64.exe`, `sdHLVIS_x64.exe`, and `sdHLRAD_x64.exe`). Make sure `sdhlt.wad` is available in the configured WAD resources. No separate SDHLT download is needed for the complete release. Test compiled maps in Sven Co-op.

**From source:** The smaller GitHub source archive does **not** contain `node_modules` or a ready-to-run runtime. Developers need a compatible Node.js/npm installation and must install dependencies themselves.

> **Note:** SvenStudio 3D runs locally in the browser. The browser interface alone cannot run Windows SDK compilers; compilation depends on the local backend and configured Sven Co-op tools. Visual previews (especially lighting, textures and recovered BSPs) should be checked in-game before release.

### Third-party credits — SDHLT

- **SDHLT** — Half-Life 1 / GoldSrc map compilation tools developed and maintained by **seedee**, based on **Vluzacn's ZHLT v34** with contributions from other developers and earlier Valve tooling.
- **Official source repository:** [github.com/seedee/SDHLT](https://github.com/seedee/SDHLT)
- **Project license and original notices:** [SDHLT LICENSE.md](https://github.com/seedee/SDHLT/blob/master/LICENSE.md). SDHLT is a separate third-party project; integration into SvenStudio 3D does not imply its authors endorse SvenStudio 3D.

### Feedback and collaboration

I would appreciate help testing, reporting issues, contributing improvements and expanding the project. Please contact me on Discord or Steam.

- **Discord:** `kzsheez`
- **Steam:** https://steamcommunity.com/id/KazamiiSC

</details>

<details>
<summary><b>Español — herramientas, instalación, controles y notas técnicas</b></summary>

### Acerca de SvenStudio 3D

**SvenStudio 3D** es un editor de niveles 3D que funciona localmente en el navegador y está diseñado para facilitar la creación de mapas para **Sven Co-op / Svengine**, sin renunciar a las herramientas que necesitan los proyectos avanzados de GoldSrc. Permite construir y texturizar brushes en un visor 3D, configurar entidades a partir de archivos FGD, organizar conexiones de jugabilidad, inspeccionar BSP compilados y ejecutar el proceso de compilación desde un mismo entorno.

Combina herramientas clásicas de creación de mapas con controles modernos, construcción reutilizable, colocación inteligente y diagnóstico. Está pensado tanto para personas que crean su primera habitación como para mappers experimentados que trabajan en escenarios grandes. Este README describe la **versión candidata v1.7.19**. Algunas funciones avanzadas son experimentales y deben comprobarse dentro de Sven Co-op.

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
- **Gameplay Studio 3.0:** Mapa interactivo de entidades en vista superior/isométrica, selección espacial, búsqueda y filtros, conexiones nativas `target`/`targetname`, inspección de eventos, edición de propiedades y comprobaciones estáticas. Gameplay Studio 3.0 conserva su nombre independientemente de la versión del editor.
- **Nombres personalizados y conexiones buscables:** Dar a un brush un nombre como *Puerta del laboratorio* y encontrarlo en el Explorador y el selector de conexiones. El nombre del editor es independiente del `targetname` que utiliza el motor.
- **Puertas y botones:** Configurar dirección de apertura de `func_door`, velocidad, recorrido, espera, activación desde botones y sonidos mediante controles explicados.
- **Desvincular entidades de brushes:** Convertir uno o varios brushes de una entidad `func_*` o trigger sólida en geometría normal de `worldspawn`, conservando sus texturas y forma, con Deshacer/Rehacer.
- **Formas inteligentes de entidades:** Indicadores automáticos para luces, botones, puertas, sonidos, spawns y triggers, o una única forma para todas las entidades; tamaños, colores y apariencia configurables.
- **Selección X-Ray de entidades:** Ver y seleccionar indicadores a través de brushes, con modo de profundidad normal y selección mediante modificador.
- **Etiquetas optimizadas:** Límites según cámara y distancia, reducción de superposiciones, prioridad para entidades seleccionadas y opciones livianas para mapas densos.
- **Vista previa del jugador inicial:** `info_player_start` con modelo, idle cuando está disponible, alineación visual con el suelo y dirección inicial visible y configurable.
- **NPC & AI Studio:** Exploración de clases NPC, vista previa de modelos compatibles, colocación de NPC, creación de rutas, waypoints y spawners, y validaciones de configuración.

#### BuildTogether — Multiplayer Mapping

*Colaboración sobre un mismo mapa desde distintos navegadores mediante sesiones WebSocket locales con anfitrión e invitados.
Sincronización de brushes, entidades, selecciones y cursores remotos; opción para seguir la cámara de otra persona.
Incluye cursores más suaves, mejoras de reconexión/recuperación y envío por lotes más seguro para terrenos grandes.
Cada participante utiliza sus recursos WAD/FGD/MDL y el SDK local; estos archivos no se transfieren durante la sesión.
Probado con ***Porthole — Local Port Sharing***: Se realizaron pruebas reales de multijugador entre dos participantes utilizando el sistema de puertos TCP compartidos de Porthole en una red privada. Esto confirma el funcionamiento en esa configuración, pero no garantiza compatibilidad con todas las redes o proyectos.
Función experimental: BuildTogether todavía puede presentar errores, problemas de sincronización o comportamientos inesperados, especialmente al utilizar herramientas complejas o mapas grandes. Guardá copias de seguridad de tus proyectos y reportá los problemas que encuentres.
Seguridad: Utilizá solamente redes privadas de confianza. No compartas públicamente códigos de sesión ni expongas directamente el puerto del servidor a Internet.*

#### Sonidos, modelos y vista previa

- **Sound & Atmosphere Studio:** Exploración de archivos WAV/OGG de Sven Co-op, vista previa de formatos compatibles, análisis de formas de onda, conversión de audio, ambientes y asignación de rutas a entidades nativas.
- **Asistentes de sonido y acciones:** Sonido de botones, sonidos de movimiento y detención de puertas, y keyvalues de audio; soporte para `ambient_generic` y relays en secuencias más complejas.
- **Explorador de modelos MDL:** Navegar modelos de Sven Co-op, inspeccionar animaciones, skins y bodygroups y previsualizar recursos compatibles.
- **Advanced Lighting Studio:** Configuración de `light`, `light_spot`, `light_environment`, skyboxes, niebla, estilos de iluminación y ajustes avanzados de SC-RAD. La vista previa normal sigue siendo aproximada.
- **True Lighting (Estudios):** Vista de lightmaps RGB compilados con **SC-RAD** o **SDHLT** opcional, selección del compilador antes de reconstruir e inspección de la iluminación BSP resultante. SDHLT incorpora opciones experimentales AO/PCF cuando están disponibles. La reconstrucción advierte que puede tardar y afectar el rendimiento. La vista ampliada utiliza cámara libre independiente (WASD, Q/E, ratón; Esc o F8 para liberar el cursor cuando el navegador lo permite). Los lightmaps compilados ofrecen mayor fidelidad que la vista aproximada, pero conviene verificar el resultado en el juego.
- **Materiales GoldSrc:** Vistas previas de agua, vidrio, texturas enmascaradas, transparencias y efectos aditivos, con posibles diferencias respecto al juego.
- **Modos de sombreado:** Wireframe, Solid, Material Preview y Rendered, con menú radial de sombreado seleccionable al apuntar.
- **Cinematic Camera Studio:** Creación de escenas mediante entidades de cámara nativas de Sven Co-op, rutas, tiempos, keyvalues y validación. La vista previa es aproximada y se debe verificar dentro del juego.

#### BSP, pruebas y compilación

- **Visor BSP avanzado:** Inspección de mapas BSP compilados, geometría, texturas, lightmaps RGB horneados, skyboxes, entidades y modelos compatibles, con etiquetas inteligentes, renderizado mejorado y navegación interior/exterior.
- **Herramientas BSP a MAP / recuperación:** Funciones experimentales para inspeccionar y reconstruir mapas a partir de BSP; la geometría, las UV o la iluminación recuperadas pueden diferir del proyecto original.
- **Player Walk y Gameplay Test:** Recorrer mapas en primera persona con WASD, mouse, salto, carrera, agacharse, gravedad, colisiones y opciones noclip.
- **Linterna y HUD:** Linterna, coordenadas, velocidad, monitor que muestra únicamente FPS y elementos del HUD movibles y personalizables.
- **Compilación integrada:** Uso predeterminado de **SC-CSG / SC-BSP / SC-VIS / SC-RAD** y opción experimental **SDHLT** con rutas independientes. Es necesario disponer de ejecutables y recursos compatibles; SDHLT puede cambiar la iluminación o presentar límites distintos.
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
- **Interfaz multilingüe:** Inglés, español, ruso, coreano, chino simplificado y portugués de Brasil; los `classname` y keyvalues FGD mantienen sus nombres originales.
- **Iniciador para Windows:** `SvenStudio3D.bat` abre el editor usando el runtime de Node.js incluido o descargado en el primer inicio (sin instalación global de Node.js). Los mensajes detectan el idioma de Windows si está admitido; si no, usan inglés.
- **Configuración de compilación más sencilla:** Exploración de carpetas y búsqueda de Sven Co-op y sus compiladores SDK en bibliotecas Steam registradas, incluso en otras unidades cuando están disponibles.

### Controles y atajos

| Control | Acción |
| --- | --- |
| Botón derecho + ratón | Mirar alrededor en el editor MAP |
| WASD / Q / E | Mover cámara / bajar y subir (cuando la navegación tiene el foco) |
| G / R / C | Mover / rotar / escalar geometría seleccionada |
| Clic izquierdo / derecho | Confirmar / cancelar transformaciones, según contexto |
| Z | Menú radial de sombreado (seleccionar apuntando) |
| Ctrl+C / Ctrl+V | Copiar / duplicar selección |
| Esc | Cancelar herramienta o liberar cámara libre compatible |
| F8 | Alternativa para liberar el cursor de True Lighting |
| Shift | Acelerar en vistas de cámara libre compatibles |

**Pantalla completa:** mantener Escape aproximadamente 1,5 segundos puede salir de pantalla completa cuando el navegador autoriza Keyboard Lock. Algunos atajos reservados no pueden interceptarse. `Ctrl+D` no se utiliza para duplicar. Los atajos pueden variar según el contexto y la configuración.

### Ejemplo práctico: botón que abre una puerta

1. Creá una puerta de tipo **`func_door`** y asignale `targetname = door_01`.
2. Creá un **`func_button`** y configurá `target = door_01`, o elegí la puerta por su nombre personalizado desde el Asistente de entidades.
3. Configurá la dirección de apertura, velocidad, `wait` y `lip` desde las propiedades básicas o la guía ampliada.
4. Asigná un sonido al botón y, si querés, sonidos de movimiento y detención de la puerta desde los keyvalues compatibles o el selector de audio.
5. Verificá la conexión en **Gameplay Studio**, compilá y probá el mecanismo en Sven Co-op.

### Requisitos

- **Windows x64** para el iniciador distribuido y sus dependencias de Windows. Se recomienda Chrome u otro navegador de escritorio basado en Chromium.
- **Internet solo en el primer inicio si todavía falta descargar el runtime local de Node.js.** No es necesario instalar Node.js globalmente para ejecutar el paquete completo.
- **SDK de Sven Co-op / herramientas SC compatibles** — necesarias para generar mapas BSP.
- **Sven Co-op** — necesario para probar y jugar los mapas compilados.

### Instalación

1. Descargá el paquete completo de Windows desde [Releases](https://github.com/KazamiiSC/SvenStudio3D/releases) y extraé **todos** sus archivos en una carpeta con permisos de escritura.
2. Ejecutá **`SvenStudio3D.bat`**. Si falta el runtime local de Node.js, se descargará una sola vez durante el primer inicio; después podrá iniciarse sin Internet. **No ejecutes `npm install`** para el paquete completo.
3. Si Chrome no se abre automáticamente, utilizá la dirección indicada en la consola (normalmente `http://127.0.0.1:5173`).
4. En **Build Configuration** configurá el SDK de Sven Co-op y los WAD/FGD necesarios.
5. **SDHLT ya está incluido en el paquete completo para Windows**, dentro de la carpeta `tools`. En **Build Configuration**, seleccioná **SDHLT — Experimental** y configurá la ruta de esa carpeta (o la subcarpeta donde estén `sdHLCSG_x64.exe`, `sdHLBSP_x64.exe`, `sdHLVIS_x64.exe` y `sdHLRAD_x64.exe`). Comprobá que `sdhlt.wad` esté disponible entre los recursos WAD configurados. No hace falta descargar SDHLT por separado para el paquete completo. Verificá los BSP generados dentro de Sven Co-op.

**Desde el código fuente:** El ZIP reducido de GitHub no incluye `node_modules` ni el runtime listo para usar. Para desarrollo sí se necesita instalar Node.js/npm y las dependencias.

> **Nota:** SvenStudio 3D funciona localmente desde el navegador. La interfaz web por sí sola no ejecuta los compiladores de Windows; para compilar se necesita el backend local y las herramientas de Sven Co-op configuradas. Las vistas previas —especialmente iluminación, texturas y BSP recuperados— deben comprobarse dentro del juego antes de publicar un mapa.

### Créditos de terceros — SDHLT

- **SDHLT** — Herramientas de compilación para Half-Life 1 / GoldSrc desarrolladas y mantenidas por **seedee**, basadas en **Vluzacn's ZHLT v34**, con contribuciones de otros desarrolladores y herramientas anteriores de Valve.
- **Repositorio oficial:** [github.com/seedee/SDHLT](https://github.com/seedee/SDHLT)
- **Licencia y avisos originales:** [SDHLT LICENSE.md](https://github.com/seedee/SDHLT/blob/master/LICENSE.md). SDHLT es un proyecto independiente; su integración no implica que sus autores respalden SvenStudio 3D.

### Comentarios y colaboración

Agradecería ayuda para probar el editor, informar errores, aportar mejoras y ampliar el proyecto. Podés contactarme por Discord o Steam.

- **Discord:** `kzsheez`
- **Steam:** https://steamcommunity.com/id/KazamiiSC

</details>

---

## ✦ Credits & community

**SvenStudio 3D** — Created by **KZ-Sheez** with AI-assisted development.

**SDHLT** — Third-party GoldSrc compilation tools by **seedee**, based on Vluzacn's ZHLT v34 and earlier contributions. Original source and license information: **[seedee/SDHLT](https://github.com/seedee/SDHLT)**. SDHLT is independent; inclusion does not imply endorsement. Retain the original notices when redistributing binaries.

**Community / Comunidad** — Bug reports, testing feedback and contributions are welcome.

[![GitHub](https://img.shields.io/badge/GitHub-SvenStudio3D-24292f?logo=github&style=for-the-badge)](https://github.com/KazamiiSC/SvenStudio3D)
[![Releases](https://img.shields.io/badge/Releases-Download-7058e8?style=for-the-badge)](https://github.com/KazamiiSC/SvenStudio3D/releases)
[![Steam](https://img.shields.io/badge/Steam-KazamiiSC-1b2838?logo=steam&style=for-the-badge)](https://steamcommunity.com/id/KazamiiSC)

**Discord:** `kzsheez`

<div align="center">

---

**SVENSTUDIO 3D · MADE FOR THE SVEN CO-OP MAPPING COMMUNITY**

</div>
