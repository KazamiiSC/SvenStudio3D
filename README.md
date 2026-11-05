# SvenStudio 3D *Version 1.0.0*

**A modern 3D map editor for Sven Co-op (GoldSrc / Svengine).**

Created by **KZ-Sheez** with the help of ChatGPT-6 Astra.

<img width="1920" height="925" alt="image" src="https://github.com/user-attachments/assets/ad5dd0b4-4974-4f29-b051-879623809434" />


<p align="center">
  <img src="https://github.com/user-attachments/assets/1e8a824c-5213-40cb-825d-d42f5d3fd401" width="320" />
  <img src="https://github.com/user-attachments/assets/46f33462-659f-4dd6-90ad-26379ccd9622" width="320" />
  <img src="https://github.com/user-attachments/assets/d2a7a31b-219f-4ad6-b488-6ed16a1c55a4" width="320" />
</p>

## English

Sven Studio 3D is a browser-based map editor designed to make creating maps for Sven Co-op easier and more intuitive.

### Features
- **3D Editor:** Perspective and orthographic views, free camera movement, and customizable controls.
- **Advanced Modeling:** Brushes, CSG (Union, Subtract, Intersect), Extrude, Bevel, Inset, Clip, and Hollow.
- **WAD Textures:** Importing, visual browser, search, and UV editing.
- **FGD Entities:** Creation, property editing, and visual connections.
- **NPC & AI Studio:** NPC placement, paths, waypoints, and enemy spawners.
- **Lighting Studio:** Lighting, approximate shadows, fog, and skyboxes.
- **Sound Studio:** Ambient sounds, music, and audio previews.
- **Model Browser:** Browsing MDL models, animations, skins, and bodygroups.
- **Gameplay Studio:** Visual configuration of doors, buttons, triggers, and game logic.
- **Building Tools:** Groups, layers, prefabs, and measurement tools.
- **Map Doctor:** Detection of geometry, entity, and resource errors.
- **BSP Compilation:** Integration with SC-CSG, SC-BSP, SC-VIS, and SC-RAD.
- **Optimization:** Performance profiles for large maps and progressive resource loading.
- **Autosave:** Automatic map and session recovery.
- **Customizable Interface:** Panels, themes, sizes, keyboard shortcuts, and context menus.
- **Multilingual Support:** Spanish, English, Russian, and Korean.
- **Player Walk Mode:** Explore maps in first person with WASD movement, mouse look, jumping, sprinting, crouching, gravity, collision detection, and noclip.
- **Player Flashlight & HUD:** Integrated flashlight with adjustable intensity, player coordinates, movement speed, and customizable HUD.
- **Advanced BSP Viewer:** Preview compiled BSP maps with lightmaps, textures, skyboxes, static models, and entity information.
- **GoldSrc Rendered Preview:** Improved real-time lighting simulation supporting `light`, `light_spot`, and `light_environment`, including colors, intensity, and distance attenuation.
- **GoldSrc Material Effects:** Visual previews of water, glass, masked textures, transparency, and additive materials.
- **Blender-Style Shading Pie Menu:** Hold Z to switch between Wireframe, Solid, Material Preview, and Rendered modes.
- **3D Transform Gizmos:** Interactive Move, Rotate, and Scale handles with keyboard shortcuts, snapping, and toggleable transform modes.
- **Automatic SKY Enclosure:** Generate a sealed, hollow SKY environment around your map to help prevent leaks.
- **Visual Leak Detection:** Automatically import `.pts` files from compilation, display leak paths in 3D, and navigate to their endpoints.
- **Advanced Compilation Diagnostics:** Detailed error reporting for SC-CSG, SC-BSP, SC-VIS, SC-RAD, invalid brushes, missing resources, and SKY problems.
- **Safe MAP Import & Export:** Valve 220 MAP compatibility, geometry validation, and warnings before importing maps that could lose unsupported brushes.
- **Project Integrity Protection:** Validation of project files, automatic recovery checkpoints, and protection against corrupted or incomplete imports.
- **Protected Walk Controls:** Optional fullscreen Keyboard Lock, safer keyboard shortcuts, and protection against accidental browser navigation.
- **Windows Launcher & Branding:** Dedicated `SvenStudio3D.bat` launcher, application icon, desktop shortcut, and browser favicon.

### Requirements
- **Node.js 22 or newer** — required to run the editor.
- **Sven Co-op SDK** — required to compile maps.
- **Sven Co-op** — required to play and test maps.

### Installation
1. Download and extract the final version in Releases.
2. Install [Node.js](https://nodejs.org/).
3. Run `SvenStudio3D.bat`.
4. Open the editor in your browser.

I would appreciate your help in further improving this project; please reach out to me on Discord or Steam.

Discord: kzsheez

Steam: https://steamcommunity.com/id/KazamiiSC

---

## Español

**Sven Studio 3D** es un editor de mapas 3D para Sven Co-op, diseñado para facilitar la creación de mapas mediante una interfaz moderna e intuitiva.

### Características
- **Editor 3D:** Vistas en perspectiva y ortográficas, movimiento libre de cámara y controles personalizables.
- **Modelado avanzado:** Brushes, operaciones CSG (Unión, Sustracción e Intersección), Extrusión, Biselado, Inset, Clip y Hollow.
- **Texturas WAD:** Importación, explorador visual, búsqueda y edición de coordenadas UV.
- **Entidades FGD:** Creación, edición de propiedades y conexiones visuales.
- **NPC & AI Studio:** Colocación de NPC, creación de rutas, waypoints y generadores de enemigos.
- **Lighting Studio:** Iluminación, sombras aproximadas, niebla y skyboxes.
- **Sound Studio:** Sonidos ambientales, música y vistas previas de audio.
- **Explorador de modelos:** Visualización de modelos MDL, animaciones, skins y bodygroups.
- **Gameplay Studio:** Configuración visual de puertas, botones, triggers y lógica del juego.
- **Herramientas de construcción:** Grupos, capas, prefabs y herramientas de medición.
- **Map Doctor:** Detección de errores de geometría, entidades y recursos.
- **Compilación BSP:** Integración con SC-CSG, SC-BSP, SC-VIS y SC-RAD.
- **Optimización:** Perfiles de rendimiento para mapas grandes y carga progresiva de recursos.
- **Guardado automático:** Recuperación automática de mapas y sesiones.
- **Interfaz personalizable:** Paneles, temas, tamaños, atajos de teclado y menús contextuales.
- **Soporte multilingüe:** Español, inglés, ruso y coreano.
- **Modo Player Walk:** Exploración de mapas en primera persona con movimiento WASD, control de cámara con el mouse, saltos, carrera, agacharse, gravedad, detección de colisiones y noclip.
- **Linterna y HUD del jugador:** Linterna integrada con intensidad ajustable, coordenadas del jugador, velocidad de movimiento y HUD personalizable.
- **Visor BSP avanzado:** Vista previa de mapas BSP compilados con lightmaps, texturas, skyboxes, modelos estáticos e información de entidades.
- **Vista previa de renderizado GoldSrc:** Simulación mejorada de iluminación en tiempo real compatible con `light`, `light_spot` y `light_environment`, incluyendo colores, intensidad y atenuación según la distancia.
- **Efectos de materiales GoldSrc:** Vista previa de agua, cristales, texturas enmascaradas, transparencias y materiales aditivos.
- **Menú radial de sombreado estilo Blender:** Mantené presionada la tecla Z para alternar entre los modos Wireframe, Solid, Material Preview y Rendered.
- **Gizmos de transformación 3D:** Controles interactivos para mover, rotar y escalar objetos, con atajos de teclado, ajuste a la cuadrícula (snapping) y modos de transformación que se pueden activar o desactivar.
- **Cerramiento SKY automático:** Generación de un entorno SKY hueco y sellado alrededor del mapa para ayudar a prevenir fugas (LEAKs).
- **Detección visual de LEAKs:** Importación automática de archivos `.pts` generados durante la compilación, visualización de recorridos de fuga en 3D y navegación hacia sus extremos.
- **Diagnóstico avanzado de compilación:** Informes detallados de errores de SC-CSG, SC-BSP, SC-VIS y SC-RAD, brushes inválidos, recursos faltantes y problemas con SKY.
- **Importación y exportación MAP segura:** Compatibilidad con el formato Valve 220, validación de geometría y advertencias antes de importar mapas que podrían perder brushes no compatibles.
- **Protección de integridad de proyectos:** Validación de archivos de proyecto, puntos de recuperación automáticos y protección contra importaciones dañadas o incompletas.
- **Controles protegidos en Player Walk:** Bloqueo de teclado opcional en pantalla completa (Keyboard Lock), atajos de teclado más seguros y protección contra navegación accidental del navegador.
- **Lanzador e identidad visual para Windows:** Lanzador dedicado `SvenStudio3D.bat`, icono de aplicación, acceso directo de escritorio y favicon para el navegador.

### Requisitos
- **Node.js 22 o superior** — necesario para ejecutar el editor.
- **Sven Co-op SDK** — necesario para compilar mapas.
- **Sven Co-op** — necesario para jugar y probar mapas.

### Instalación
1. Descargá y extraé la version final en Releases.
2. Instalá [Node.js](https://nodejs.org/).
3. Ejecutá `SvenStudio3D.bat`.
4. Abrí el editor en tu navegador.

Agradecería tu ayuda para seguir mejorando este proyecto; por favor, contáctame a través de Discord o Steam.

Discord: kzsheez

Steam: https://steamcommunity.com/id/KazamiiSC

---

**Developed by KZ-Sheez with the help of ChatGPT.**

