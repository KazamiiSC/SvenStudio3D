/** First-run editor manual, not FGD metadata. Keep shortcuts in App.tsx bound to
 * the live controls store, so remapped shortcuts are never documented incorrectly. */
import type {Locale} from '../i18n';
import {localizeManual} from './editorManualIntl';
import {updateManualForV2} from './releaseHelpV2';
export type Manual={intro:string;firstTitle:string;first:string[];fullTitle:string;full:string;cameraTitle:string;camera:string[];editTitle:string;edit:string[];uvTitle:string;uv:string[];shapesTitle:string;shapes:string[];walkTitle:string;walk:string[];shortcutsTitle:string;shortcutsHint:string;studiosTitle:string;studios:{title:string;description:string}[];workspaceTitle:string;workspace:string[];technicalTitle:string;technical:string[];noticeTitle:string;notice:string;contact:string;linksTitle:string};
const en:Manual={
 intro:'SvenStudio 3D is an actively developed browser-based Valve 220 map editor for Sven Co-op / Svengine. Create brushes, edit UVs, place entities, test simplified interactions and compile using your local Sven Co-op SDK. In-editor previews are approximations: always test the compiled map in Sven Co-op.',
 firstTitle:'Getting started',first:[
 'Set your map name in Build Configuration and configure the SDK compiler directory and Sven Co-op game data folder.',
 'Load your game’s WAD3 textures in Asset Library → Textures. Import sven-coop.fgd for the complete original entity class list; entity classnames remain in English.',
 'Create or import a MAP, select objects in the 3D viewport or Explorer, then edit properties and textures. Use File → Save project (Ctrl+S) for a portable .svenstudio.json file.',
 'Click Compile Map to run the chosen compilers: Sven Co-op SDK (default) or experimental SDHLT. A successful build copies the BSP into the configured maps directory; intermediate MAP/build files are temporary. SDHLT requires separate external tools.'
 ],fullTitle:'Fullscreen recommended',full:'For reliable camera movement and fewer conflicts with browser keyboard shortcuts, use the editor’s Fullscreen button. Some browser shortcuts such as Ctrl+W, Ctrl+R or F5 may still be reserved; fullscreen cannot guarantee blocking all of them. Save projects frequently.',
 cameraTitle:'Mouse and camera',camera:[
 'Hold right mouse button inside the 3D viewport to look freely. Release it to restore the cursor. A brief right-click opens the context menu.',
 'During camera navigation: W/A/S/D moves, Q moves down, E moves up and Shift speeds up. The mouse wheel zooms.',
 'Middle mouse button orbits; Shift + middle mouse pans. Camera speed, inversion, damping and configurable keyboard shortcuts are in Workspace → Camera & Gizmo Controls.',
 'The viewport projection button switches perspective/orthographic. Numpad shortcuts for front/side/top/isometric, orbit, pan, zoom and frame are listed below.'
 ],editTitle:'Editing and keyboard actions',edit:[
 'Left click selects. Shift/Ctrl + click adds to or changes the selection. Double-click a brush face to open Texture Studio.',
 'G: move, R: rotate, C: scale (configurable). Press the same transform shortcut again or Escape to exit; right-click cancels a modal transform. X/Y/Z constrain an active modal transform; enter numbers for exact values, Enter confirms and Backspace edits numbers.',
 'Snap magnet enables/disables snapping. Visible grid size is separate from move/draw step, rotation step and scale step. Shift enables fine movement and Ctrl temporarily changes snapping when supported.',
 'Ctrl+C copies selected brushes and Ctrl+V pastes independent copies (each paste is one Undo action). Ctrl+S saves a project file; Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes. Delete removes selected objects. H hides, Shift+H isolates, Alt+H reveals all, Numpad / toggles temporary isolation.',
 'With Face selected: E extrudes. Draw mode: drag left mouse to make a brush; X/Y/Z change drawing plane; F aligns to the pointed surface; Escape cancels the drawing tool.',
 'Hold Z to open the shading pie menu; aim at a shading mode and release Z to choose it. Escape cancels tools/dialogs. Use Edit HUD to drag and rearrange overlay controls.'
 ],uvTitle:'Texture Studio / UV controls',uv:[
 'Double-click the face to edit. Texture Studio floats independently and remembers the position you drag it to, even when selecting another face.',
 'On a face, Alt+left-drag moves UV; Alt+Shift+drag rotates; Alt+Ctrl+drag scales. Drag the Move UV tab to place the fixed-size UV handles anywhere in the viewport; that position stays fixed when changing faces or moving the camera. The other handles move, rotate or scale the texture.',
 'Adjust U/V offset, scale, rotation, tile count, Fit, Align, Center and flip. Multiple faces may be selected; material copy/paste and the eyedropper are available. UV changes do not alter brush geometry.'
 ],shapesTitle:'Shapes, prefabs and other placement tools',shapes:[
 'While placing a shape/prefab: R rotates 90°, Shift+R rotates 15°, X/Y/Z chooses axis, F toggles surface alignment, 0 resets angle, P toggles repeat placement and Escape cancels.',
 'Construction/geometry tools include Object, Vertex, Edge, Face, Clip, Hollow, CSG, Extrude, Bevel and Inset. Use the measure tool to click two points.'
 ],walkTitle:'Gameplay Test',walk:[
 'F5 or Shift+P toggles Gameplay Test. WASD moves, mouse looks, Shift runs, Space jumps, C crouches; E interacts with supported doors/buttons/triggers.',
 'F toggles flashlight, H toggles gameplay HUD, N toggles noclip, Escape exits the test. Q/E control vertical motion when applicable. This is a preview, not Sven Co-op gameplay.'
 ],shortcutsTitle:'Every configurable camera & gizmo shortcut',shortcutsHint:'These bindings are read live from Workspace → Camera & Gizmo Controls. If you change a key, the guide updates automatically.',
 studiosTitle:'Studios and what each one does',studios:[
 {title:'MAP Editor',description:'Main 3D/2D editing workspace for brushes, objects, faces, transforms, terrain placements, WAD textures and FGD entities.'},
 {title:'Texture Studio / WAD Browser',description:'Import WAD3 textures, search materials and directly adjust U/V axes, shifts, scales, rotation, fit and alignment on selected faces.'},
 {title:'Decal Studio',description:'Load Sven Co-op decals.wad, search decal previews, paint native infodecal entities onto brushes by clicking walls/floors/ceilings, then select, duplicate, delete and undo. Esc exits placement.'},
 {title:'Shapes & Prefabs',description:'Place prepared architecture (walls, floors, ramps, windows, doors) and reusable groups or saved prefabs.'},
 {title:'Gameplay Studio',description:'Visual configuration of triggers, buttons, doors, relays, entity targets and event connections.'},
 {title:'Co-op Puzzle Builder',description:'Create persistent power consoles and timed simultaneous controls using func_button, game_counter and multisource. Connect to missions, events or doors, validate target references and preserve generated edits.'},
 {title:'NPC & AI Studio',description:'Place NPCs, routes, waypoints and spawners. Smart NPC Encounters 2.0 builds up to eight native death-counted waves with multiple spawn points and Mission & Dynamic Events links. Check spawn clearance and corpses before assuming a stalled wave is a wiring bug. Test compiled BSP in Sven Co-op.'},
 {title:'Lighting Studio',description:'Adjust lights, environment, fog and skies; quick viewport lighting is approximate.'},
 {title:'True Lighting (Studios)',description:'Build temporary baked BSP lightmaps with SC-RAD by default or experimental SDHLT. Select a compiler and confirm the potentially time-consuming bake. In expanded preview, WASD/Q/E navigate the BSP camera; Escape or F8 releases the mouse. AO and PCF require SDHLT and a new bake. Keep the console open during compilation.'},
 {title:'Sound Studio',description:'Configure ambient sounds and music, preview audio and work with supported sound conversion.'},
 {title:'World Builder Studio',description:'Sculpt and triangulate terrain, import heightmaps, make thin surfaces, caves, rails, roads, walkways and bridges. Use Routes & Structures to reuse an existing route for a new structure; Curves & Repetitions edits saved curves and creates radial arrays. Smart cave openings are limited to compatible thin terrain; verify sealing and collision in the compiled BSP.'},
 {title:'Model Browser',description:'Inspect available Sven Co-op MDL models, skins, bodygroups and animation sequences using game resources.'},
 {title:'Cinematic Camera Studio',description:'Build and preview camera routes and entities such as path_corner and trigger_camera.'},
 {title:'BSP Viewer / Recovery',description:'Preview compiled BSP faces, textures, lightmaps and entities; experimental BSP-to-MAP recovery may not reproduce the original exactly.'},
 {title:'Brush Workshop / Smart Brush Fusion',description:'Edit a selected brush face in a 3D orbit view or precise 2D drawing view. Make panels, holes, recesses and frames with polygonal profiles. Select multiple brushes in the MAP editor to fuse compatible convex volumes or create editable compound structures; always inspect the preview before applying.'},
 {title:'Map Doctor',description:'Check geometry, texture and WAD references, entity connections and possible compile problems.'},
 {title:'Map Packager',description:'Collect outputs and supporting resources for distributing a compiled Sven Co-op map.'},
 {title:'Gameplay Test',description:'Walk through an approximate browser preview to inspect scale and basic scripted interactions.'}
 ],workspaceTitle:'Workspace and panel layout',workspace:[
 'On a new installation Asset Library appears on the left, Properties and Explorer on the right, and the classic toolbar on top, as in the reference layout.',
 'Workspace → Workspace layout offers presets, the Classic ribbon or Floating tools, toolbar position, order and visibility. Drag panel title grips to move panels to Left, Right, Top or Bottom; resize their separators.',
 'Workspace also contains HUD editing, performance, UI scale, theme/accent, camera and gizmo options, entity visuals and output. Build Configuration remains in the top bar beside Compile Map. Layout changes are saved in this browser, independent from the MAP.',
 'Use Edit HUD for draggable on-viewport buttons. Individual windows such as Texture Studio can be moved independently outside the 3D viewport.'
 ],technicalTitle:'How the editor accesses Sven Co-op',technical:[
 'The browser cannot freely read installed game folders. You explicitly import WAD/FGD assets, or provide game and SDK paths to the local Node.js service running on 127.0.0.1.',
 'The portable local Node.js runtime is downloaded at first launch if missing; subsequent starts work offline. The local service uses configured game/SDK paths. Sven Co-op WAD/FGD/MDL assets and SC/SDHLT compilers are not bundled.',
 'Saving a project exports .svenstudio.json; session recovery is also stored locally in the browser. MAP export uses Valve 220; Compile Map creates a temporary source MAP and copies the finished BSP to the selected Sven Co-op maps folder on success.'
 ],noticeTitle:'Work in progress',notice:'SvenStudio 3D is NOT 100% finished. New updates arrive periodically. Please report bugs, missing tools, feature requests and suggestions to the developer.',contact:'Discord: kzsheez',linksTitle:'Developer contact'
};
const es:Manual={
 intro:'SvenStudio 3D es un editor de mapas Valve 220 para Sven Co-op / Svengine que funciona en el navegador y sigue en desarrollo. Permite crear brushes, editar UV, colocar entidades, probar interacciones aproximadas y compilar con el SDK local de Sven Co-op. La vista previa no reemplaza probar el mapa compilado dentro del juego.',
 firstTitle:'Primeros pasos',first:[
 'Escribí el nombre del mapa en Build Configuration y configurá la carpeta de los compiladores del SDK y la carpeta de datos de Sven Co-op.',
 'Cargá las texturas WAD3 del juego en Asset Library → Texturas. Importá sven-coop.fgd para obtener la lista completa de entidades originales; sus classnames se conservan en inglés.',
 'Creá o importá un MAP, seleccioná objetos en el visor 3D o Explorer y editá sus propiedades y texturas. Usá File → Guardar proyecto (Ctrl+S) para conservar el archivo portátil .svenstudio.json.',
 'Con Compile Map se ejecutan los compiladores del SDK. Si finaliza correctamente, el BSP se copia a <carpeta del juego>/maps/<nombre del mapa>.bsp; el MAP fuente y los archivos intermedios se generan temporalmente.'
 ],fullTitle:'Se recomienda usar pantalla completa',full:'Usá el botón Fullscreen del editor: facilita el movimiento de cámara y reduce conflictos con atajos del navegador. Algunas combinaciones como Ctrl+W, Ctrl+R o F5 pueden seguir reservadas por el navegador; la pantalla completa no garantiza bloquearlas todas. Guardá el proyecto con frecuencia.',
 cameraTitle:'Mouse y controles de cámara',camera:[
 'Mantené clic derecho dentro del visor 3D para mirar libremente. Soltá para recuperar el cursor. Un clic derecho breve abre el menú contextual.',
 'Al navegar: W/A/S/D mueve la cámara, Q baja, E sube y Shift acelera. La rueda acerca y aleja.',
 'Botón central: orbitar. Shift + botón central: desplazar la vista. En Workspace → Camera & Gizmo Controls podés configurar velocidad, inversión, suavizado y atajos.',
 'El botón Perspective/Orthographic cambia la proyección. Abajo aparece la lista completa de atajos configurables, incluidas las vistas numéricas, órbita y zoom.'
 ],editTitle:'Edición y controles de teclado',edit:[
 'Clic izquierdo: seleccionar. Shift/Ctrl + clic: modificar selección múltiple. Doble clic sobre una cara: abrir Texture Studio.',
 'G: mover; R: rotar; C: escalar (configurables). Repetí el atajo o usá Escape para salir; clic derecho cancela una transformación modal. X/Y/Z limita un eje durante la transformación; escribí números para valores exactos, Enter confirma y Backspace corrige.',
 'El imán activa/desactiva Snap. La grilla visible es independiente del paso para mover/dibujar, de la rotación y de la escala. Shift permite precisión fina y Ctrl modifica temporalmente Snap donde corresponda.',
 'Ctrl+C copia los brushes seleccionados; Ctrl+V pega duplicados independientes (se pueden deshacer). Ctrl+S guarda el proyecto; Ctrl+Z deshace; Ctrl+Shift+Z o Ctrl+Y rehace; Delete elimina. H oculta; Shift+H aísla; Alt+H muestra todo; Numpad / activa aislamiento temporal.',
 'En selección de caras: E extruye. En modo dibujo: arrastrá con clic izquierdo para crear el brush; X/Y/Z cambia plano; F alinea con la superficie apuntada; Escape cancela.',
 'Mantené Z para abrir el menú radial de sombreado, apuntá a una opción y soltá Z para seleccionarla. Escape cancela herramientas o ventanas. Edit HUD permite mover los controles superpuestos.'
 ],uvTitle:'Texture Studio y controles UV',uv:[
 'Doble clic sobre una cara para editarla. Texture Studio es flotante y recuerda dónde lo colocás, incluso al cambiar de cara o brush.',
 'Sobre una cara, Alt + arrastrar mueve UV; Alt+Shift + arrastrar rota; Alt+Ctrl + arrastrar escala. Arrastrá la pestaña Mover UV para ubicar el manipulador libremente; queda en ese lugar al cambiar de cara o mover la cámara. Los otros controles mueven, rotan o escalan la textura.',
 'Modificá desplazamiento U/V, escala, rotación, mosaicos, Fit, Align, Center y espejado. Permite varias caras, copiar/pegar material y cuentagotas. Los cambios UV no alteran la geometría.'
 ],shapesTitle:'Formas, prefabs y colocación',shapes:[
 'Mientras colocás una forma o prefab: R gira 90°, Shift+R gira 15°, X/Y/Z elige eje, F alterna alineación con superficie, 0 reinicia ángulo, P repite colocación y Escape cancela.',
 'La edición geométrica incluye Objeto, Vértice, Arista, Cara, Clip, Hollow, CSG, Extrude, Bevel e Inset. La herramienta de medir permite seleccionar dos puntos.'
 ],walkTitle:'Gameplay Test',walk:[
 'F5 o Shift+P activa/desactiva Gameplay Test. WASD mueve, el mouse mira, Shift corre, Espacio salta, C se agacha y E interactúa con puertas, botones o triggers compatibles.',
 'F activa linterna, H muestra/oculta HUD, N activa noclip y Escape sale. Q/E permite movimiento vertical cuando corresponda. Es una simulación, no el funcionamiento definitivo de Sven Co-op.'
 ],shortcutsTitle:'Todos los atajos configurables de cámara y gizmos',shortcutsHint:'Esta lista toma las teclas reales de Workspace → Camera & Gizmo Controls. Si cambiás un atajo, la guía muestra la nueva combinación automáticamente.',
 studiosTitle:'Qué hace cada estudio',studios:[
 {title:'MAP Editor',description:'Espacio principal para mapas 3D/2D: brushes, objetos, caras, transformaciones, texturas WAD y entidades FGD.'},
 {title:'Texture Studio / WAD Browser',description:'Importa WAD3, busca materiales y ajusta ejes UV, desplazamientos, escala, rotación, Fit y Align sobre cada cara.'},
 {title:'Decal Studio',description:'Carga decals.wad de Sven Co-op, busca decals y colócalos con clic sobre paredes, pisos y techos como entidades nativas infodecal. Permite seleccionar, duplicar, borrar y deshacer. Esc termina la colocación.'},
 {title:'Shapes & Prefabs',description:'Coloca arquitectura rápida (paredes, pisos, rampas, ventanas y puertas) y grupos reutilizables o prefabs guardados.'},
 {title:'Gameplay Studio',description:'Configura visualmente triggers, botones, puertas, relays, targets y conexiones de lógica.'},
 {title:'Co-op Puzzle Builder',description:'Creá consolas de energía persistentes y botones simultáneos temporizados, vinculados a misiones, eventos y puertas. Permite auditar conexiones, guardar y deshacer con seguridad.'},
 {title:'NPC & AI Studio',description:'Colocá NPC, rutas, waypoints y spawners. Smart NPC Encounters 2.0 permite hasta ocho oleadas con contadores nativos, varios puntos de aparición y enlaces con Misiones y Eventos. Si se detiene una oleada revisá espacio libre y cuerpos que aún ocupan cupos; probá el BSP compilado en Sven Co-op.'},
 {title:'Lighting Studio',description:'Configura luces, ambiente, niebla y sky; la iluminación rápida del visor es aproximada.'},
 {title:'True Lighting (Estudios)',description:'Genera lightmaps RGB reales en un BSP temporal con SC-RAD (predeterminado) o SDHLT experimental. Elegí el compilador y confirmá la compilación; puede tardar y afectar el rendimiento. Con la vista ampliada, WASD/Q/E mueven la cámara del BSP; Esc o F8 libera el ratón. AO y PCF necesitan SDHLT y recompilar.'},
 {title:'Sound Studio',description:'Configura sonidos ambientales y música, previsualiza audio y permite conversiones de sonido compatibles.'},
 {title:'Estudio de Construcción de Mundos (World Builder Studio)',description:'Esculpí terrenos y editá su triangulación, importá heightmaps y creá superficies delgadas, cuevas, vías, carreteras, pasarelas y puentes. En Recorridos y estructuras podés reutilizar una ruta para crear otra estructura; Curvas y repeticiones permite editar curvas guardadas y crear matrices radiales. Las cuevas automáticas requieren terreno delgado compatible: verificá el sellado y las colisiones al compilar.'},
 {title:'Model Browser',description:'Explora modelos MDL disponibles de Sven Co-op, skins, bodygroups y animaciones usando recursos del juego.'},
 {title:'Cinematic Camera Studio',description:'Diseña y previsualiza recorridos de cámara y entidades como path_corner y trigger_camera.'},
 {title:'BSP Viewer / Recovery',description:'Muestra BSP compilados, texturas, lightmaps y entidades; BSP a MAP es experimental y puede diferir del original.'},
 {title:'Brush Workshop / Smart Brush Fusion',description:'Seleccioná un brush y editá sus caras con visor orbital 3D o dibujo preciso en 2D; creá paneles, huecos, rebajes y marcos. En el editor general seleccioná varios brushes para fusionar volúmenes convexos compatibles o crear una estructura compuesta. Revisá la vista previa antes de aplicar.'},
 {title:'Map Doctor',description:'Analiza geometría, referencias WAD/texturas, conexiones de entidades y posibles errores de compilación.'},
 {title:'Map Packager',description:'Reúne archivos compilados y recursos para distribuir un mapa de Sven Co-op.'},
 {title:'Gameplay Test',description:'Permite recorrer una simulación del mapa para comprobar escala e interacciones básicas.'}
 ],workspaceTitle:'Workspace, paneles y barras',workspace:[
 'En una instalación nueva, Asset Library aparece a la izquierda; Properties y Explorer, a la derecha; y la barra clásica, arriba, como en el diseño de referencia.',
 'Workspace → Workspace layout permite elegir diseños predefinidos, barra Classic o herramientas Floating, ubicación y orden. Arrastrá las cabeceras para acoplar paneles a izquierda, derecha, arriba o abajo y redimensioná los separadores.',
 'Workspace también incluye edición del HUD, rendimiento, escala de interfaz, apariencia, opciones de cámara/gizmos, visualización de entidades y salida. Build Configuration está en la barra superior junto a Compile Map. La distribución se guarda en este navegador, separada del MAP.',
 'Con Edit HUD podés reacomodar los botones flotantes del visor. Algunas ventanas, como Texture Studio, también se arrastran fuera del visor 3D.'
 ],technicalTitle:'Cómo obtiene recursos de Sven Co-op',technical:[
 'Por seguridad, el navegador no puede leer carpetas instaladas libremente. Importás WAD/FGD manualmente o indicás las rutas del juego y el SDK al servidor local de Node.js que funciona en 127.0.0.1.',
 'El runtime Node.js portátil se descarga la primera vez si falta; luego el inicio funciona sin Internet. El servicio lee recursos desde las carpetas configuradas. Los recursos WAD/FGD/MDL de Sven Co-op y los compiladores SC/SDHLT se obtienen por separado.',
 'Guardar proyecto exporta .svenstudio.json y hay recuperación local de sesiones. La compilación usa SC-SDK por defecto o SDHLT experimental (requiere ejecutables externos). Compile Map crea un MAP temporal y copia el BSP final a maps según configuración.'
 ],noticeTitle:'Proyecto en desarrollo',notice:'SvenStudio 3D todavía NO está terminado al 100%. Recibe nuevas actualizaciones periódicamente. Por favor, avisame de errores, herramientas que falten y propuestas de mejoras.',contact:'Discord: kzsheez',linksTitle:'Contacto con el desarrollador'
};
export const editorManual=(locale:Locale):Manual=>updateManualForV2(locale,locale==='es'?es:locale==='en'?en:localizeManual(locale,en));
/** Fixed actions grouped for readability; their actual binding is displayed dynamically. */
export const EDITOR_SHORTCUT_GROUPS={
 transform:['move','rotate','scale','fly','frame','frameAll','projection','resetView'],
 views:['front','right','top','back','left','bottom','isometric'],
 orbit:['orbitLeft','orbitRight','orbitUp','orbitDown','panLeft','panRight','panUp','panDown','zoomIn','zoomOut']
} as const;
export const actionTitlesEs:Record<string,string>={move:'Mover',rotate:'Rotar',scale:'Escalar',fly:'Cámara Fly',frame:'Centrar selección',frameAll:'Centrar mapa',projection:'Perspectiva / Ortográfica',resetView:'Reiniciar cámara',front:'Vista frontal',right:'Vista derecha',top:'Vista superior',back:'Vista posterior',left:'Vista izquierda',bottom:'Vista inferior',isometric:'Vista isométrica',orbitLeft:'Orbitar izquierda',orbitRight:'Orbitar derecha',orbitUp:'Orbitar arriba',orbitDown:'Orbitar abajo',panLeft:'Desplazar izquierda',panRight:'Desplazar derecha',panUp:'Desplazar arriba',panDown:'Desplazar abajo',zoomIn:'Acercar',zoomOut:'Alejar'};

export const actionTitlesEn:Record<string,string>={move:'Move',rotate:'Rotate',scale:'Scale',fly:'Fly camera',frame:'Frame selection',frameAll:'Frame entire map',projection:'Perspective / Orthographic',resetView:'Reset camera',front:'Front view',right:'Right view',top:'Top view',back:'Back view',left:'Left view',bottom:'Bottom view',isometric:'Isometric view',orbitLeft:'Orbit left',orbitRight:'Orbit right',orbitUp:'Orbit up',orbitDown:'Orbit down',panLeft:'Pan left',panRight:'Pan right',panUp:'Pan up',panDown:'Pan down',zoomIn:'Zoom in',zoomOut:'Zoom out'};
