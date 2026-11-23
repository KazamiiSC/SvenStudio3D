<div align="center">

# SvenStudio 3D

###
**A modern desktop level editor for Sven Co-op · GoldSrc · Svengine**

[![Release](https://img.shields.io/badge/RELEASE-v2.5.0-7058e8?style=for-the-badge)](https://github.com/KazamiiSC/SvenStudio3D/releases)
![Platform](https://img.shields.io/badge/PLATFORM-Windows%20x64-2384b8?style=for-the-badge)
![Engine](https://img.shields.io/badge/ENGINE-GoldSrc%20%2F%20Svengine-168c9c?style=for-the-badge)
![Languages](https://img.shields.io/badge/LANGUAGES-6-364d78?style=for-the-badge)

[**Download Release**](https://github.com/KazamiiSC/SvenStudio3D/releases) · [**Features**](#-features-at-a-glance) · [**Screenshots**](#-screenshots) · [**Installation**](#-get-started) · [**English / Español**](#-full-documentation--documentación-completa)

<img src="https://github.com/user-attachments/assets/69959e8e-082f-46f5-9418-8a7e05edb67b" alt="SvenStudio 3D home screen" width="100%" />

**Created by KZ-Sheez · AI-assisted development**

</div>

> [!IMPORTANT]
> **v2.5** is not a claim of zero bugs. Keep backups and verify compiled maps in Sven Co-op. BSP recovery, BSP-to-prefab extraction, SDHLT and BuildTogether include experimental workflows.

---

## ✦ Features at a glance

| Create & edit | Design & test | Compile & collaborate |
| :--- | :--- | :--- |
| **3D MAP Editor** — brushes, CSG, vertices, edges, faces, mirror & path arrays | **Gameplay Studio** — GPU entity map, logic graph & **Logic Simulator** | **SC SDK & bundled SDHLT** — CSG, BSP, VIS & RAD |
| **Texture Studio** — WAD, UV, find & replace, texture lock | **True Lighting** — baked RGB preview, SC-RAD / SDHLT | **Smart Build** — redesigned settings, quality presets & safe packaging |
| **World Builder** — terrain, caves, rivers, weather & 27 creation tools | **BSP Viewer & Editor** — bspguy-style tools, door & batch prefab extraction | **Map Packager** — map `.cfg`, AngelScript generator & publish checks |
| **Prefab Studio** — redesigned library, kits & linked instances | **Entity Guide (305 entities)**, NPC, sounds, cameras & player-route check | **BuildTogether, Map Doctor & Test in game** |

<div align="center">

**Windows desktop app** · **Compile with local tools** · **Nothing else to install: runtime and SDHLT included**

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

## ✦ What's new in 2.5

- **Windows desktop app:** SvenStudio 3D is now a desktop application only. Install it with the setup wizard or use the portable ZIP; the editor and its local server run in their own window, with a native-style title bar, single instance and an unsaved-changes prompt. Settings are stored in `Documents/SvenStudio3D/settings.json`.
- **Entity Guide (Help → Entity guide):** A searchable guide covering all **305 Sven Co-op FGD entities**: what each one does, step-by-step setup, ideas, wiring examples, tips and common mistakes, key keyvalues, related entities and the FGD keyvalue/spawnflag reference. It includes a *Mapping basics* page (target/targetname, master, delays, spawnflags, ORIGIN brushes) and a *Place in map* button. The inspector's mini guide now covers every entity and opens the full guide.
- **Svengine kits inside every studio (based on TWHL tutorials):** Ready-made, editable setups with a large 3D preview and click-to-place: doors, elevators, turrets, mortars, teleporters, security cameras, vending machines, breakable props, rain, snow, storms, day/night, ordered levers, pressure plates, timed doors, series-map transitions and more.
- **27 new creation tools:** Buildings, roofs, column grids, corridors, vents, fire escapes and freight lifts (Smart Build); caves, cliffs, rivers, vegetation, rubble and terrain roads (World Builder); furniture, lab rooms, pipes, trims, fences and signage (Prefab Studio); combat arenas, sniper nests, traps and hover platforms (Gameplay); light rows, window light and fire zones (Effects). **Mirror X/Y/Z** and **Repeat along path** (line, arc, circle or S curve) are now modeling tools.
- **Logic Simulator:** Fire any button or trigger and watch the chain play out on a timeline: multi_manager delays, masters, counters, random triggers, door auto-close, killtargets and missing targets.
- **Gameplay Studio redesign:** GPU-rendered entity map with minimap, category chips, inspector tabs, problems shown on the map, animated activation chains and a new logic graph view.
- **Player route check (Map Doctor):** Finds items, weapons and objectives the player cannot reach or that sit behind doors.
- **Map CFG, AngelScript and publish checks (Map Packager):** Generate `maps/<name>.cfg` (survival, weapons, settings) and a starter map script (checkpoints, survival, welcome text, respawn, anti-rush), then review a "Before publishing" checklist.
- **BSP Editor upgrades:** bspguy-style tools, smart prefab saving from compiled maps, **complete door capture** (door leaves, frame and buttons that share a name) and **batch extraction** of doors and objects into prefabs.
- **Prefab Studio redesign:** Library / Creation kits / Linked instances tabs, sources sidebar with counters and maintenance tools, tile browser with category thumbnails, and a detail panel with a large 3D viewer and primary actions.
- **Build Configuration redesign:** Compiler, Quality, Textures, Destination and Resources tabs; Final / Fast / Geometry-only quality cards; readiness checks; SDHLT shown as included. If VIS reports *Corrupted leaf mapping*, the build retries automatically with `-nofixprt`.
- **Viewport display styles:** Classic, Studio, Neutral, Bright, Obsidian, Midnight blue, Blueprint, Sunset, Forest, Paper and Terminal green backgrounds and grids (editor look only).
- **Better new project:** "New project" starts with a clean, sealed, grid-aligned room (four walls, floor, ceiling, player start and lights).
- **Previously introduced in 2.3 – 2.4:** Test in game, Go to leak, viewport quick actions, compile quality presets, compile region (cordon), find & replace texture, Entity Report with global targetname rename, editor skybox, linear and radial arrays, optional 4-view layout (Top/Front/Side), spiral stairs, rocks and scatter, player-size check, Editor Preferences window, configurable shortcuts, first-run tour and large performance improvements. Version 2.0 introduced the six SvenStudio Themes, the BSP Editor and BSP Texture Studio.
- **Six UI languages:** English, Español, Русский, 한국어, 简体中文 and Português (Brasil).

---

## ✦ Get started

**Windows releases / Versiones para Windows**

1. [**Download a release / Descargá una versión**](https://github.com/KazamiiSC/SvenStudio3D/releases): the **installer** (`SvenStudio3D-Setup-2.5.0.exe`) or the **portable ZIP** (`SvenStudio3D-Desktop-Portable-2.5.0.zip`). Extract the portable ZIP completely before running it.
2. Open **SvenStudio 3D** from the Start menu / desktop shortcut, or run `SvenStudio3D.exe` from the portable folder.
3. On first launch, follow the short tour or start a **New project** (it opens with a ready, sealed room).
4. In **Build Configuration**, select the compiler (SC SDK or the bundled SDHLT), the quality, the game folders and the required WAD/FGD resources. **Smart Build** writes to an isolated build folder by default; exporting or installing resources is a separate, explicit action.
5. **SDHLT is included.** Choose **SDHLT** in the Compiler tab; leave its folder empty to use the bundled copy, or point it to a folder containing the four `sdHL*_x64.exe` compilers.

> [!NOTE]
> **The Windows releases include SDHLT**; a separate SDHLT download is unnecessary. Smart Build uses an isolated build destination by default. The source-code archive excludes preinstalled `node_modules` and requires Node.js/npm for development.

### Quick controls / Controles rápidos

| Keys | Action / Acción |
| :---: | :--- |
| `W A S D` · `Q / E` | Camera movement / Movimiento de cámara |
| `G` · `R` · `C` | Move · Rotate · Scale / Mover · Rotar · Escalar |
| `Right Mouse` | Camera look / Girar cámara |
| `Z` | Point-selectable shading menu / Menú radial de sombreado |
| `Ctrl+C` · `Ctrl+V` | Copy · Duplicate / Copiar · Duplicar |
| `Esc` · `F8` | Cancel/release camera · True Lighting fallback / Cancelar/liberar cámara |

**Controls depend on context and can be changed in Editor Preferences → Keyboard shortcuts.** `Ctrl+D` is intentionally not used for duplication. Fullscreen Escape capture depends on the system.

---

## ✦ Full documentation / Documentación completa

Both language references below preserve detailed tool descriptions, limitations, requirements and examples from the project's documentation, updated for v2.5.

<details>
<summary><b>English — features, tools, setup, controls and troubleshooting notes</b></summary>

### About SvenStudio 3D

**SvenStudio 3D** is a local level editor — a Windows desktop application — designed to make map creation for **Sven Co-op / Svengine** more accessible without sacrificing the tools needed for complex GoldSrc projects. A separate **Counter-Strike 1.6** profile with CS Map Studio is also available. Build and texture brushes in a 3D viewport, configure entities through FGD definitions, simulate gameplay logic, inspect compiled BSP maps, and launch the compilation pipeline from a single workspace.

The editor combines familiar workflows from traditional level editors with modern viewport navigation, visual controls, ready-made Svengine kits, reusable structures, smart placement and diagnostic tools. It is intended for both beginners creating their first room and experienced mappers working on larger environments. This README describes **SvenStudio 3D v2.5**. Some advanced features remain experimental and should be validated in Sven Co-op.

### Main features

#### 3D editing and geometry

- **Modern 3D workspace:** Perspective and orthographic views, an optional 4-view layout (Top/Front/Side), customizable panels and layouts, a grid, snapping, mouse navigation, and a camera workflow inspired by Roblox Studio (hold right mouse button to look; WASD to move; Q/E to change height). The background and grid can use one of eleven viewport display styles.
- **Clean starter room:** "New project" creates a sealed, grid-aligned room with four walls, floor, ceiling, a player start and lights, ready to compile.
- **Brush creation and editing:** Create boxes, walls, floors, ceilings, columns, ramps, arches, openings, spiral stairs and other structures; edit vertices, edges, and individual faces with live validity preview.
- **Advanced modeling operations:** CSG Union, Subtract and Intersect; Extrude, Bevel, Inset, Clip (also free clip in 2D views), Hollow, **Mirror X/Y/Z** and other brush-editing tools.
- **Arrays:** Linear and radial arrays, plus **Repeat along path** (line, arc, circle or S curve) with copy count, end scale and alignment.
- **Precision transforms:** Move, Rotate and Scale gizmos, keyboard shortcuts, grid snapping, fine adjustments, numeric dimensions, and improved handling for small brushes.
- **Smart Placement 3D:** Preview and rotate a shape before placing it, align it to surfaces, choose rotation axes, and draw on horizontal or vertical planes. Repeat placement without re-entering dimensions.
- **Smart Build structures:** Buildings, roofs, column grids, corridors, vents, fire escapes, freight lifts and stairs with a live 3D preview and click-to-place ghost.
- **Architecture tools:** Quickly build wall openings, doors, windows, frames, stairs and other structural elements, plus advanced door kits.
- **Reusable prefabs:** Save a selection of brushes and linked entities as a reusable construction, preserve their relative positions and textures, and place rotated copies in other areas or projects. The redesigned **Prefab Studio** has Library / Creation kits / Linked instances tabs, a tile browser with category thumbnails, a large 3D viewer and material/WAD checks.
- **Organization:** Groups, upgraded layers, hide/lock controls, selection tools, measurements, named brushes, searchable scene objects and an Entity Report with global targetname rename and bulk keyvalues.
- **World Builder Studio:** Sculpt solid brush-based terrain, generate rocks and cliffs, scatter objects over an area, build paths and structures, curves and repetitions, and use the **Weather & water** and **Nature & ruins** tabs (rain, snow, waterfalls, storms, day/night, caves, cliffs, rivers, vegetation, rubble, terrain roads) with a large 3D preview, within GoldSrc/Svengine limits.

#### Texture Studio and WAD workflow

- **WAD texture browser:** Import WAD archives, browse progressively loaded thumbnails, search by name, use favorites/recent textures, and assign materials to brushes and individual faces without the list jumping back to the top.
- **Floating Texture Studio:** Edit texture scale U/V, offset U/V, rotation, repetition, centering, and mirroring without leaving the 3D viewport.
- **Direct manipulation:** Move, rotate and resize a face's texture with on-surface controls, including eight scale handles.
- **Smart Fit and Smart Align:** Fit a texture to a face, configure horizontal/vertical tiling, and align materials across adjacent surfaces.
- **Multi-face editing, eyedropper and find & replace:** Apply materials or UV settings to multiple faces, copy from another face, replace one texture with another across the map, and save reusable texture presets.
- **Texture Lock:** Preserve texture placement relative to brushes while moving them, including grid-snapped movement and duplicated objects.
- **GoldSrc / Valve 220 UV compatibility:** Use texture dimensions and axis orientation for a more faithful preview and export; detect and repair certain invalid texture-axis combinations that can affect SC-RAD.
- **WAD session persistence:** Reopen previously imported WAD data and restore project textures from the game WADs when a project opens. Compilation still requires valid game/SDK WAD paths.

#### Entities, gameplay and logic

- **FGD-based entity editor:** Import Sven Co-op FGD definitions, inspect class descriptions, edit native keyvalues, and work with additional custom FGD entity classes.
- **Entity Guide (Help → Entity guide):** A complete, searchable guide for all 305 Sven Co-op entities with step-by-step setup, ideas, wiring examples, tips, key keyvalues, related entities, the loaded FGD reference and a *Place in map* button. A *Mapping basics* page explains target/targetname, master, delays, spawnflags and ORIGIN brushes.
- **Entity Assistant:** Contextual mini guides for every entity in the inspector, with steps, extra examples, ideas and a button that opens the full guide for that class.
- **Beginner and advanced properties:** Category navigation, numeric/color inputs when supported, quick controls for common tasks and full access to original FGD keyvalues for experienced mappers.
- **Gameplay Studio:** GPU-rendered top/isometric entity map with minimap, auto floors, category chips, spatial selection, search and filters, native `target`/`targetname` relationships, inspector tabs, problems on the map, animated activation chains and a logic graph view.
- **Logic Simulator:** Start from any button or trigger and follow the event chain on a timeline, including multi_manager delays, masters (multisource), game_counter, trigger_random, trigger_changetarget, door auto-close, killtargets and missing targets.
- **Svengine kits (TWHL-based):** Ready-made setups inside the studio they belong to — puzzles (ordered levers, pressure plates, timed doors, keys), turrets, mortars, teleporters, security cameras with monitors, vending machines, combat arenas, sniper nests, traps, soundscapes, series-map transitions and more — each with options, a 3D preview and click-to-place.
- **Named brushes and searchable targets:** Give brushes a custom editor name (for example, *Laboratory Door*) and find them in the Explorer and entity connection picker. Editor-only names remain separate from Svengine's `targetname`.
- **Door and button controls:** Configure `func_door` movement direction, speed, travel, wait time, button activation, and sounds through guided properties.
- **Detach brush entities:** Convert one or multiple brushes belonging to a `func_*` or brush-based trigger entity back to normal `worldspawn` geometry without deleting their shape or textures, with Undo/Redo support.
- **Smart entity markers and 3D models:** Automatic shapes for useful entity classes or a single uniform shape; entity models are shown in the viewport with an optional distance limit; adjustable marker size, colors and appearance.
- **Entity X-Ray selection:** Display and select entity markers through brush geometry, with an optional normal depth mode and modifier-based selection.
- **Optimized entity labels:** Camera-aware limits, reduced overlap, selected-entity priority, and lightweight display settings for dense maps.
- **Player start visualization:** `info_player_start` model preview with idle animation where supported, ground alignment preview, and a visible/configurable initial facing direction.
- **NPC & AI Studio:** Browse NPC classes, preview supported models, place NPCs, create paths, waypoints, and spawners, and check common configuration errors.
- **Point-entity placement:** Preview the selected entity at a chosen position in the 3D viewport, click to place it, cancel with right-click/Esc, or enable repeated placement.

#### BuildTogether — Multiplayer Mapping

*Collaborate on a map from separate SvenStudio 3D windows or PCs through a local WebSocket session with a host and invited participants.
Synchronize brushes, entities, editing selections and remote cursors; follow another participant's camera when needed.
Includes smoother cursor updates, reconnection/recovery improvements, and safer batching for large terrain changes.
Each participant uses local WAD/FGD/MDL and SDK resources; these files are not transferred over BuildTogether.
Tested with ***Porthole — Local Port Sharing***: Real multiplayer testing was performed between two participants using Porthole's private-network TCP port sharing. This confirms that the tested setup worked, but does not guarantee compatibility with every network or project.
Experimental feature: BuildTogether may still contain bugs, synchronization issues or unexpected behavior, especially with complex tools or large maps. Save backup copies of your project and report any problems you encounter.
Security: Use trusted private networks only. Do not publicly share session codes or expose the server port directly to the Internet.*

#### Sound, models and visual previews

- **Sound & Atmosphere Studio:** Browse available Sven Co-op WAV/OGG audio, preview supported files, inspect waveforms, convert audio, configure ambience, place soundscape kits and assign sound paths to native entities.
- **Sound and action helpers:** Set up button sounds, door movement/stop sounds and audio-related keyvalues; use `ambient_generic` or relays for more advanced sequences.
- **MDL Model Browser:** Browse Sven Co-op models and inspect their animations, skins and bodygroups; preview supported assets in the editor.
- **Advanced Lighting Studio:** Configure `light`, `light_spot`, `light_environment`, skyboxes, fog, lightstyles, effects kits (sprites, sparks, explosions, lasers, light rows, window light, fire zones) and advanced SC-RAD settings, including a lights.rad bridge. The standard viewport preview remains approximate.
- **True Lighting (Studies):** Preview baked RGB lightmaps from **SC-RAD** or the bundled **SDHLT**, select the compiler before rebuilding, and inspect the resulting BSP lighting. SDHLT supports AO/PCF options when available. Rebuilding displays a warning because compilation may take time and affect performance. Enlarged preview uses its own free camera (WASD, Q/E, mouse; Esc or F8 releases cursor where supported). Rendered lightmaps are more faithful than approximate real-time preview, but final results should still be checked in-game.
- **GoldSrc materials:** Visual previews of water, glass, masked textures, transparency and additive effects, subject to differences from in-game rendering.
- **Shading modes and display styles:** Wireframe, Solid, Material Preview and Rendered, a pointer-selectable radial shading menu, an editor skybox and eleven viewport background styles.
- **Cinematic Camera Studio:** Arrange native Sven Co-op camera entities, preview paths and scenes, configure timing and camera keyvalues, place security-camera kits and validate routes. The preview is approximate and must be verified in-game.

#### BSP, gameplay testing and compilation

- **Advanced BSP Viewer:** Inspect compiled BSP maps, geometry, textures, baked RGB lightmaps, skyboxes, entities and supported models, with smart labels, improved rendering and interior/exterior navigation.
- **BSP Editor:** Select and edit supported entities, inspect faces and regions, use bspguy-style model and surface tools, and export supported edits. Not every compiled BSP element can be reconstructed as its original brush.
- **BSP to prefab:** Extract objects and doors from compiled maps as prefabs with smart saving. **Complete door capture** groups door leaves, frame and buttons that share a name; **Batch extraction** lists every door and object of a map and saves the ones you choose.
- **BSP Texture Studio:** Inspect compatible BSP surfaces and adjust WAD material selection, UV offsets, scaling and rotation, with a separate texture browser.
- **BSP-to-MAP / recovery tools:** Experimental recovery and inspection workflows for existing BSP files, including conversion to editable MAP content and reusable prefabs where supported; reconstructed geometry, texture alignment and lighting may differ from the original source.
- **Player Walk and Gameplay Test:** Explore an editable map in first person with WASD, mouse look, jumping, sprinting, crouching, gravity, collisions and noclip options.
- **Test in game:** Launch Sven Co-op directly on the installed map after compiling.
- **Player flashlight and HUD:** Flashlight, coordinates, speed readouts, FPS-only counter, and customizable/movable HUD elements.
- **Integrated compilation:** Use **SC-CSG / SC-BSP / SC-VIS / SC-RAD**, or the bundled **SDHLT**. Choose **Final** (full VIS + extra RAD), **Fast** or **Geometry only** quality; compile only a region (cordon) when testing a section. If VIS reports *Corrupted leaf mapping*, SvenStudio retries automatically with `-nofixprt`.
- **Smart Build:** Redesigned Build Configuration (Compiler, Quality, Textures, Destination, Resources) with readiness checks. Compiles to an isolated folder by default, manages Smart WAD and related assets for each map, and offers optional distribution folders and ZIP export. Explicit game installation requires confirmation; choosing the game path alone does not authorize writing into it.
- **Valve 220 MAP import/export:** Save maps for the GoldSrc/Svengine toolchain, with geometry validation and warnings for unsupported or potentially lossy imports.
- **Map Doctor:** Detect issues with geometry, entities, textures, resources, SKY enclosure and compilation; includes the **player route** check (unreachable items or items behind doors), the player-size check and an optimization assistant.
- **Visual leak tracing:** Import compiler `.pts`/`.lin` point files and inspect leak routes in 3D, or use **Go to leak** from the build output.
- **Automatic SKY enclosure:** Generate a sealed hollow SKY boundary to help prevent common map leaks.
- **Compilation diagnostics:** Review messages and errors from the compilation tools, including face, texture, leak, light and resource issues.
- **Map Packager:** Collect and organize the resources a map needs, generate `maps/<name>.cfg` and a starter AngelScript map script (checkpoints, survival, welcome text, respawn, anti-rush), and review the *Before publishing* checklist.

#### Workflow, performance and accessibility

- **Desktop app:** Windows installer or portable ZIP; the editor and its local server run in their own window, with no browser or separate server needed.
- **Optimized for larger maps:** A spatially chunked brush layer, batched entity brushes and wireframes, rendering presets, progressive asset loading, optimized labels, and autosave only when something changed.
- **Autosave and recovery:** Session restoration, project checkpoints and history, visible Documents backups, validation, and safeguards for incomplete or damaged imports.
- **Customizable/adaptive UI:** Dockable/resizable panels, Modeling and Textures ribbon groups, compact responsive toolbars adapted to 125–175 % Windows scaling, favorite groups, contextual menus, configurable HUD, workspace presets for Construction/Entities/BSP, saved personal layouts and a shared look for every studio.
- **Editor Preferences:** One window for theme, workspace, viewport (including display styles and resolution), entities, camera, keyboard shortcuts and hidden objects.
- **SvenStudio Themes:** Six selectable complete UI styles — Windows 98, Windows XP, GoldSrc Workshop, Modern Dark, Cyber Neon and Midnight Minimal — with separate accent color choices. The selected theme applies to menus, Studies, dialogs, inspectors and floating panels without changing map textures or the 3D render.
- **Help and first-run tour:** Help includes the editor guide with a fixed side index, *What's new and where everything is*, and the Entity Guide. A short tour introduces the editor on first launch.
- **No accidental text selection:** Interface text no longer turns blue when dragging; inputs and code fields remain selectable.
- **Fullscreen editing:** Optional fullscreen with Keyboard Lock. Some system shortcuts cannot be intercepted in every environment.
- **Multilingual interface:** English, Spanish, Russian, Korean, Simplified Chinese and Brazilian Portuguese; native FGD classnames and keyvalues are not translated.
- **Windows integration:** Start menu and desktop shortcuts, own icon and window, single instance; everything it needs to run is bundled (no Node.js or other installation required).
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

**Fullscreen:** A long Escape press (about 1.5 seconds) may exit fullscreen where Keyboard Lock is supported. System-reserved shortcuts cannot always be intercepted. `Ctrl+D` is intentionally not used for duplication. Actual bindings depend on editor context and can be changed in Editor Preferences → Keyboard shortcuts.

### Example: a button opens a door

1. Create a brush-based **`func_door`** and assign it `targetname = door_01`.
2. Create a **`func_button`** and set `target = door_01`, or select the named door through the Entity Assistant.
3. Configure the door's opening direction, movement speed, `wait` and `lip` from the basic properties, the mini guide or **Help → Entity guide**.
4. Assign a button sound and optional door movement/stop sounds using supported keyvalues or the sound picker.
5. Run the chain in the **Logic Simulator** (Gameplay Studio), compile the map, and verify the mechanism inside Sven Co-op with **Test in game**.

### Requirements

- **Windows x64** (Windows 10/11) with a GPU that supports WebGL.
- **No Internet connection or extra installation is required** to run the app: its runtime is bundled.
- **Sven Co-op SDK / compatible SC compilation tools, or the bundled SDHLT** — required to compile BSP maps.
- **Sven Co-op** — required for testing and playing compiled maps.

### Installation

1. Download the **installer** or the **portable ZIP** from [Releases](https://github.com/KazamiiSC/SvenStudio3D/releases). For the portable version, extract **all** files to a writable folder.
2. Run the installer and choose the destination folder, or start `SvenStudio3D.exe` from the portable folder. **Do not run `npm install`** for the packaged releases.
3. Open **SvenStudio 3D** from the Start menu or desktop shortcut.
4. Use **Build Configuration** to choose the compiler, the quality, the Sven Co-op/SDK folders and required WAD/FGD files. Smart Build keeps its default output isolated; install-to-game is a separate, explicitly confirmed option.
5. **SDHLT is already included** in the Windows releases. In the **Compiler** tab, choose **SDHLT**; leave its folder empty to use the bundled copy, or point it to the folder containing `sdHLCSG_x64.exe`, `sdHLBSP_x64.exe`, `sdHLVIS_x64.exe` and `sdHLRAD_x64.exe`. No separate SDHLT download is needed. Test compiled maps in Sven Co-op.

**From source:** The smaller GitHub source archive does **not** contain `node_modules` or a ready-to-run runtime. Developers need a compatible Node.js/npm installation and must install dependencies themselves.

> **Note:** SvenStudio 3D runs entirely on your PC. Compilation uses the local backend built into the app and the configured Sven Co-op tools or bundled SDHLT. Visual previews (especially lighting, textures, kits and recovered BSPs) should be checked in-game before release.

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

**SvenStudio 3D** es un editor de niveles 3D que funciona como aplicación de escritorio para Windows y está diseñado para facilitar la creación de mapas para **Sven Co-op / Svengine**, sin renunciar a las herramientas que necesitan los proyectos avanzados de GoldSrc. También ofrece un perfil separado para **Counter-Strike 1.6** con CS Map Studio. Permite construir y texturizar brushes en un visor 3D, configurar entidades a partir de archivos FGD, simular la lógica de jugabilidad, inspeccionar BSP compilados y ejecutar el proceso de compilación desde un mismo entorno.

Combina herramientas clásicas de creación de mapas con controles modernos, kits de Svengine listos para usar, construcción reutilizable, colocación inteligente y diagnóstico. Está pensado tanto para personas que crean su primera habitación como para mappers experimentados que trabajan en escenarios grandes. Este README describe **SvenStudio 3D v2.5**. Algunas funciones avanzadas siguen siendo experimentales y deben comprobarse dentro de Sven Co-op.

### Características principales

#### Editor 3D y geometría

- **Espacio de trabajo 3D moderno:** Vistas en perspectiva y ortográficas, vista opcional de 4 paneles (Superior/Frontal/Lateral), paneles configurables, cuadrícula, snapping y navegación inspirada en Roblox Studio (mantener clic derecho para mirar; WASD para moverse; Q/E para bajar y subir). El fondo y la grilla pueden usar uno de once estilos de visor.
- **Sala inicial prolija:** "Nuevo proyecto" crea una habitación sellada y alineada a la grilla, con cuatro paredes, piso, techo, punto de inicio del jugador y luces, lista para compilar.
- **Creación y edición de brushes:** Construcción de bloques, paredes, pisos, techos, columnas, rampas, arcos, aberturas, escaleras de caracol y otras estructuras, con edición de vértices, aristas y caras y vista previa de validez en vivo.
- **Modelado avanzado:** Operaciones CSG de Unión, Sustracción e Intersección, además de Extrude, Bevel, Inset, Clip (también corte libre en vistas 2D), Hollow, **Espejo X/Y/Z** y otras herramientas de geometría.
- **Arrays:** Array lineal y radial, y **Repetir a lo largo de un recorrido** (línea, arco, círculo o curva en S) con cantidad de copias, escala final y alineación.
- **Transformaciones precisas:** Gizmos de mover, rotar y escalar, atajos, ajuste a grilla, control fino, dimensiones numéricas y mejoras para objetos pequeños.
- **Smart Placement 3D:** Previsualización y giro de formas antes de colocarlas, alineación con superficies, elección de ejes y dibujo sobre planos horizontales y verticales. Permite repetir objetos sin volver a ingresar medidas.
- **Estructuras de Smart Build:** Edificios, techos, grillas de columnas, pasillos, ductos, escaleras de incendio, montacargas y escaleras con vista previa 3D en vivo y colocación con clic.
- **Herramientas de arquitectura:** Creación rápida de aberturas, puertas, ventanas, marcos, escaleras y otras estructuras, además de kits de puertas avanzadas.
- **Prefabs reutilizables:** Guardar grupos de brushes y entidades vinculadas, conservar posiciones relativas y texturas, y colocar copias rotadas en otro lugar o proyecto. El **Estudio de Prefabricados** rediseñado tiene pestañas Biblioteca / Kits de creación / Instancias vinculadas, tarjetas con miniaturas por categoría, un visor 3D grande y revisión de materiales y WAD.
- **Organización:** Grupos, capas mejoradas, ocultar/bloquear, selección, medición de distancias, nombres personalizados para brushes, búsqueda de objetos e Informe de entidades con renombrado global de targetnames y keyvalues en lote.
- **Estudio de Construcción de Mundos:** Modelado de terreno sólido basado en brushes, generador de rocas y acantilados, dispersión de objetos sobre un área, recorridos y estructuras, curvas y repeticiones, y las pestañas **Clima y agua** y **Naturaleza y ruinas** (lluvia, nieve, cascadas, tormentas, día y noche, cuevas, acantilados, ríos, vegetación, escombros, caminos sobre el terreno) con vista previa 3D grande, dentro de las limitaciones de GoldSrc/Svengine.

#### Texture Studio y texturas WAD

- **Explorador WAD:** Importar archivos WAD, recorrer miniaturas cargadas progresivamente, buscar texturas, utilizar favoritos y recientes y aplicarlas a brushes o caras individuales sin que la lista vuelva al comienzo al seleccionar.
- **Texture Studio flotante:** Ajustar escala U/V, desplazamiento U/V, rotación, repetición, centrado e inversión desde una mini interfaz sin salir del visor 3D.
- **Edición directa con mouse:** Mover, girar y cambiar el tamaño de la textura sobre la cara, con ocho manejadores de escala.
- **Smart Fit y Smart Align:** Ajustar una textura al tamaño de una cara, configurar repeticiones y alinear materiales entre superficies contiguas.
- **Selección múltiple, cuentagotas y buscar y reemplazar:** Aplicar materiales o ajustes UV a varias caras, copiar desde otra superficie, reemplazar una textura por otra en todo el mapa y guardar presets reutilizables.
- **Texture Lock:** Mantener las texturas fijadas al brush cuando se mueve, incluso con snapping y duplicación.
- **Compatibilidad GoldSrc / Valve 220:** Cálculos basados en dimensiones de textura y orientación de ejes para aproximar la apariencia final; detección y reparación de ciertas combinaciones inválidas que pueden afectar a SC-RAD.
- **Persistencia de WAD:** Recuperación de WAD importadas y restauración de las texturas del proyecto desde los WAD del juego al abrirlo. Para compilar siguen siendo necesarias rutas válidas del juego/SDK.

#### Entidades, jugabilidad y lógica

- **Editor de entidades FGD:** Importar definiciones de Sven Co-op, consultar sus descripciones y editar keyvalues originales, incluidas clases personalizadas de otros FGD.
- **Guía de entidades (Ayuda → Guía de entidades):** Guía completa y con buscador de las 305 entidades de Sven Co-op: configuración paso a paso, ideas, ejemplos de conexión, consejos, keyvalues clave, entidades relacionadas, la referencia del FGD cargado y un botón *Colocar en el mapa*. La página *Conceptos básicos* explica target/targetname, master, retardos, spawnflags y brushes ORIGIN.
- **Asistente de entidades:** Mini guías contextuales para todas las entidades en el inspector, con pasos, ejemplos extra, ideas y un botón que abre la guía completa de esa clase.
- **Propiedades básicas y avanzadas:** Navegación por categorías, entradas numéricas y de color cuando corresponda, controles sencillos para tareas comunes y acceso a los keyvalues originales del FGD.
- **Gameplay Studio:** Mapa de entidades renderizado por GPU en vista superior/isométrica con minimapa, pisos automáticos, filtros por categoría, selección espacial, búsqueda, conexiones nativas `target`/`targetname`, inspector con pestañas, problemas marcados en el mapa, cadenas de activación animadas y vista de grafo lógico.
- **Simulador de lógica:** Partir de cualquier botón o trigger y seguir la cadena de eventos en una línea de tiempo, incluidos retardos de multi_manager, masters (multisource), game_counter, trigger_random, trigger_changetarget, cierre automático de puertas, killtargets y destinos inexistentes.
- **Kits de Svengine (basados en TWHL):** Configuraciones listas dentro del estudio al que pertenecen — puzzles (palancas en orden, placas de presión, puertas con tiempo, llaves), torretas, morteros, teletransportadores, cámaras de seguridad con monitores, máquinas expendedoras, arenas de combate, nidos de francotirador, trampas, paisajes sonoros, transición entre mapas de una serie y más — cada uno con opciones, vista previa 3D y colocación con clic.
- **Nombres personalizados y conexiones buscables:** Dar a un brush un nombre como *Puerta del laboratorio* y encontrarlo en el Explorador y el selector de conexiones. El nombre del editor es independiente del `targetname` que utiliza el motor.
- **Puertas y botones:** Configurar dirección de apertura de `func_door`, velocidad, recorrido, espera, activación desde botones y sonidos mediante controles explicados.
- **Desvincular entidades de brushes:** Convertir uno o varios brushes de una entidad `func_*` o trigger sólida en geometría normal de `worldspawn`, conservando sus texturas y forma, con Deshacer/Rehacer.
- **Formas inteligentes y modelos 3D de entidades:** Indicadores automáticos o una única forma para todas las entidades; los modelos de las entidades se muestran en el visor con límite de distancia opcional; tamaños, colores y apariencia configurables.
- **Selección X-Ray de entidades:** Ver y seleccionar indicadores a través de brushes, con modo de profundidad normal y selección mediante modificador.
- **Etiquetas optimizadas:** Límites según cámara y distancia, reducción de superposiciones, prioridad para entidades seleccionadas y opciones livianas para mapas densos.
- **Vista previa del jugador inicial:** `info_player_start` con modelo, idle cuando está disponible, alineación visual con el suelo y dirección inicial visible y configurable.
- **NPC & AI Studio:** Exploración de clases NPC, vista previa de modelos compatibles, colocación de NPC, creación de rutas, waypoints y spawners, y validaciones de configuración.
- **Colocación interactiva de entidades puntuales:** Vista previa en la posición elegida del visor 3D, colocación con clic, cancelación con clic derecho/Esc y opción de colocación consecutiva.

#### BuildTogether — Multiplayer Mapping

*Colaboración sobre un mismo mapa desde distintas ventanas o PCs con SvenStudio 3D mediante sesiones WebSocket locales con anfitrión e invitados.
Sincronización de brushes, entidades, selecciones y cursores remotos; opción para seguir la cámara de otra persona.
Incluye cursores más suaves, mejoras de reconexión/recuperación y envío por lotes más seguro para terrenos grandes.
Cada participante utiliza sus recursos WAD/FGD/MDL y el SDK local; estos archivos no se transfieren durante la sesión.
Probado con ***Porthole — Local Port Sharing***: Se realizaron pruebas reales de multijugador entre dos participantes utilizando el sistema de puertos TCP compartidos de Porthole en una red privada. Esto confirma el funcionamiento en esa configuración, pero no garantiza compatibilidad con todas las redes o proyectos.
Función experimental: BuildTogether todavía puede presentar errores, problemas de sincronización o comportamientos inesperados, especialmente al utilizar herramientas complejas o mapas grandes. Guardá copias de seguridad de tus proyectos y reportá los problemas que encuentres.
Seguridad: Utilizá solamente redes privadas de confianza. No compartas públicamente códigos de sesión ni expongas directamente el puerto del servidor a Internet.*

#### Sonidos, modelos y vista previa

- **Sound & Atmosphere Studio:** Exploración de archivos WAV/OGG de Sven Co-op, vista previa de formatos compatibles, análisis de formas de onda, conversión de audio, ambientes, kits de paisaje sonoro y asignación de rutas a entidades nativas.
- **Asistentes de sonido y acciones:** Sonido de botones, sonidos de movimiento y detención de puertas, y keyvalues de audio; soporte para `ambient_generic` y relays en secuencias más complejas.
- **Explorador de modelos MDL:** Navegar modelos de Sven Co-op, inspeccionar animaciones, skins y bodygroups y previsualizar recursos compatibles.
- **Advanced Lighting Studio:** Configuración de `light`, `light_spot`, `light_environment`, skyboxes, niebla, estilos de iluminación, kits de efectos (sprites, chispas, explosiones, láseres, filas de luces, luz de ventana, zonas de fuego) y ajustes avanzados de SC-RAD, incluido un puente para lights.rad. La vista previa normal sigue siendo aproximada.
- **True Lighting (Estudios):** Vista de lightmaps RGB compilados con **SC-RAD** o el **SDHLT** incluido, selección del compilador antes de reconstruir e inspección de la iluminación BSP resultante. SDHLT incorpora opciones AO/PCF cuando están disponibles. La reconstrucción advierte que puede tardar y afectar el rendimiento. La vista ampliada utiliza cámara libre independiente (WASD, Q/E, ratón; Esc o F8 para liberar el cursor). Los lightmaps compilados ofrecen mayor fidelidad que la vista aproximada, pero conviene verificar el resultado en el juego.
- **Materiales GoldSrc:** Vistas previas de agua, vidrio, texturas enmascaradas, transparencias y efectos aditivos, con posibles diferencias respecto al juego.
- **Modos de sombreado y estilos de visor:** Wireframe, Solid, Material Preview y Rendered, menú radial de sombreado seleccionable al apuntar, skybox en el editor y once estilos de fondo para el visor 3D.
- **Cinematic Camera Studio:** Creación de escenas mediante entidades de cámara nativas de Sven Co-op, rutas, tiempos, keyvalues, kits de cámaras de seguridad y validación. La vista previa es aproximada y se debe verificar dentro del juego.

#### BSP, pruebas y compilación

- **Visor BSP avanzado:** Inspección de mapas BSP compilados, geometría, texturas, lightmaps RGB horneados, skyboxes, entidades y modelos compatibles, con etiquetas inteligentes, renderizado mejorado y navegación interior/exterior.
- **Editor BSP:** Selección y edición de entidades compatibles, inspección de caras y regiones, herramientas de modelos y superficies al estilo bspguy y exportación de cambios admitidos. No toda la geometría compilada puede recuperarse como brushes originales.
- **De BSP a prefab:** Extracción de objetos y puertas de mapas compilados como prefabs con guardado inteligente. **Puerta completa** agrupa las hojas, el marco y los botones que comparten nombre; **Extracción en lote** lista todas las puertas y objetos de un mapa y guarda los que elijas.
- **BSP Texture Studio:** Inspección de superficies BSP compatibles y edición de materiales WAD, desplazamiento UV, escala y rotación, con biblioteca de texturas específica.
- **Herramientas BSP a MAP / recuperación:** Funciones experimentales para inspeccionar y reconstruir contenido desde BSP, convertirlo a MAP editable o prefabricados cuando sea posible; la geometría, las UV o la iluminación recuperadas pueden diferir del proyecto original.
- **Player Walk y Gameplay Test:** Recorrer mapas en primera persona con WASD, mouse, salto, carrera, agacharse, gravedad, colisiones y opciones noclip.
- **Probar en el juego:** Abrir Sven Co-op directamente en el mapa instalado después de compilar.
- **Linterna y HUD:** Linterna, coordenadas, velocidad, monitor que muestra únicamente FPS y elementos del HUD movibles y personalizables.
- **Compilación integrada:** **SC-CSG / SC-BSP / SC-VIS / SC-RAD** o el **SDHLT** incluido. Calidad **Final** (VIS completo + RAD extra), **Rápida** o **Solo geometría**; compilación de una región (cordon) para probar una sección. Si VIS informa *Corrupted leaf mapping*, SvenStudio reintenta automáticamente con `-nofixprt`.
- **Smart Build:** Configuración de compilación rediseñada (Compilador, Calidad, Texturas, Destino, Recursos) con comprobaciones de preparación. Compilación aislada por defecto, administración de Smart WAD y recursos asociados al mapa, distribución opcional por carpetas y exportación ZIP. Para instalar archivos dentro del juego se requiere una acción explícita y confirmación; elegir la ruta del juego no permite escribir automáticamente en ella.
- **Importación/exportación MAP Valve 220:** Compatibilidad con herramientas de GoldSrc/Svengine, validación de geometría y advertencias cuando una importación podría perder datos incompatibles.
- **Map Doctor:** Comprobación de geometría, entidades, texturas, recursos, SKY y errores de compilación; incluye el análisis de **recorrido del jugador** (ítems inalcanzables o detrás de puertas), la comprobación de tamaño del jugador y un asistente de optimización.
- **Detección visual de LEAK:** Importación de recorridos `.pts`/`.lin` generados por los compiladores y visualización 3D de fugas, o **Ir a la fuga** desde la salida de compilación.
- **Cerramiento SKY automático:** Generación de un recinto SKY hueco y sellado para ayudar a evitar fugas comunes.
- **Diagnóstico avanzado:** Registro de mensajes y errores de compilación relacionados con caras, texturas, LEAK, luces y archivos faltantes.
- **Map Packager:** Recopilar y organizar los recursos del mapa, generar `maps/<nombre>.cfg` y un script AngelScript inicial (checkpoints, supervivencia, mensaje de bienvenida, reaparición, anti-rush) y revisar la lista *Antes de publicar*.

#### Flujo de trabajo, rendimiento y accesibilidad

- **App de escritorio:** Instalador para Windows o ZIP portable; el editor y su servidor local funcionan en su propia ventana, sin navegador ni servidor aparte.
- **Optimización para mapas grandes:** Capa de brushes dividida por zonas, brushes de entidades y wireframe agrupados, perfiles de rendimiento, carga progresiva, etiquetas optimizadas y guardado automático solo cuando hay cambios.
- **Guardado automático y recuperación:** Restauración de sesión, puntos de recuperación e historial, copias de seguridad visibles en Documentos, validación de proyectos y protecciones ante importaciones incompletas o dañadas.
- **Interfaz personalizable y adaptable:** Paneles acoplables y redimensionables, grupos Modelado y Texturas en la cinta, barras responsivas adaptadas a escalas de Windows del 125–175 %, grupos favoritos, menús contextuales, HUD configurable, perfiles Construcción/Entidades/BSP, diseños personalizados guardables y un mismo estilo para todos los estudios.
- **Preferencias del editor:** Una sola ventana para tema, espacio de trabajo, visor (incluidos estilos y resolución), entidades, cámara, atajos de teclado y objetos ocultos.
- **SvenStudio Themes:** Seis estilos completos — Windows 98, Windows XP, GoldSrc Workshop, Modern Dark, Cyber Neon y Midnight Minimal — con colores de acento independientes. Los temas abarcan Estudios, menús, diálogos, inspector y ventanas flotantes sin modificar las texturas del mapa ni el renderizado 3D.
- **Ayuda y recorrido inicial:** La Ayuda incluye la guía del editor con índice lateral fijo, *Novedades y dónde está cada cosa* y la Guía de entidades. Un recorrido corto presenta el editor en el primer inicio.
- **Sin selección accidental de texto:** Los textos de la interfaz ya no se marcan en azul al arrastrar; los campos de texto y código siguen siendo seleccionables.
- **Pantalla completa:** Modo opcional con Keyboard Lock. Algunos atajos del sistema no se pueden bloquear en todos los equipos.
- **Interfaz multilingüe:** Inglés, español, ruso, coreano, chino simplificado y portugués de Brasil; los `classname` y keyvalues FGD mantienen sus nombres originales.
- **Integración con Windows:** Accesos en el menú Inicio y el escritorio, ícono y ventana propios, una sola instancia; todo lo necesario para ejecutarse viene incluido (sin instalar Node.js ni nada más).
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

**Pantalla completa:** mantener Escape aproximadamente 1,5 segundos puede salir de pantalla completa. Algunos atajos reservados no pueden interceptarse. `Ctrl+D` no se utiliza para duplicar. Los atajos pueden variar según el contexto y se pueden cambiar en Preferencias del editor → Atajos de teclado.

### Ejemplo práctico: botón que abre una puerta

1. Creá una puerta de tipo **`func_door`** y asignale `targetname = door_01`.
2. Creá un **`func_button`** y configurá `target = door_01`, o elegí la puerta por su nombre personalizado desde el Asistente de entidades.
3. Configurá la dirección de apertura, velocidad, `wait` y `lip` desde las propiedades básicas, la mini guía o **Ayuda → Guía de entidades**.
4. Asigná un sonido al botón y, si querés, sonidos de movimiento y detención de la puerta desde los keyvalues compatibles o el selector de audio.
5. Probá la cadena en el **Simulador de lógica** (Gameplay Studio), compilá y verificá el mecanismo en Sven Co-op con **Probar en el juego**.

### Requisitos

- **Windows x64** (Windows 10/11) con una placa de video compatible con WebGL.
- **No hace falta Internet ni instalar nada más** para usar la app: el runtime viene incluido.
- **SDK de Sven Co-op / herramientas SC compatibles, o el SDHLT incluido** — necesarios para generar mapas BSP.
- **Sven Co-op** — necesario para probar y jugar los mapas compilados.

### Instalación

1. Descargá el **instalador** o el **ZIP portable** desde [Releases](https://github.com/KazamiiSC/SvenStudio3D/releases). Para la versión portable, extraé **todos** los archivos en una carpeta con permisos de escritura.
2. Ejecutá el instalador y elegí la carpeta de destino, o abrí `SvenStudio3D.exe` desde la carpeta portable. **No ejecutes `npm install`** para los paquetes listos.
3. Abrí **SvenStudio 3D** desde el menú Inicio o el acceso directo del escritorio.
4. En **Configuración de compilación** elegí el compilador, la calidad, el SDK de Sven Co-op y los WAD/FGD necesarios. Smart Build genera la salida en una carpeta aislada por defecto; instalar recursos en el juego exige elegir y confirmar esa opción.
5. **SDHLT ya está incluido** en las versiones de Windows. En la pestaña **Compilador**, seleccioná **SDHLT**; dejá su carpeta vacía para usar la copia incluida o indicá la carpeta donde estén `sdHLCSG_x64.exe`, `sdHLBSP_x64.exe`, `sdHLVIS_x64.exe` y `sdHLRAD_x64.exe`. No hace falta descargar SDHLT por separado. Verificá los BSP generados dentro de Sven Co-op.

**Desde el código fuente:** El ZIP reducido de GitHub no incluye `node_modules` ni el runtime listo para usar. Para desarrollo sí se necesita instalar Node.js/npm y las dependencias.

> **Nota:** SvenStudio 3D funciona completamente en tu PC. Para compilar usa el backend local integrado en la app y las herramientas de Sven Co-op configuradas o el SDHLT incluido. Las vistas previas —especialmente iluminación, texturas, kits y BSP recuperados— deben comprobarse dentro del juego antes de publicar un mapa.

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

