/** UI-only guide for features that actually ship with SvenStudio v1.4.
 * No keys here are written to MAP/FGD or converted to entity names.
 */
import type {Locale} from '../i18n';
export type GuideGroup={id:string;title:string;features:string[]};
export type GuideContent={summary:string;capture:string;captureButton:string;captureStatus:string;captureTitle:string;interact:string;browserWarning:string;cameraKeys:string;transformKeys:string;guideTitle:string;featureTitle:string;groups:GuideGroup[]};
const guide:Record<Locale,GuideContent>={
  es:{
    summary:'Editor 3D de mapas Valve 220 para Sven Co-op / Svengine. Modelá brushes, editá caras y UV, colocá entidades FGD, probá interacciones aproximadas y compilá con el SDK local. Incluye herramientas visuales de arquitectura, terreno, prefabs, recuperación BSP y empaquetado. La vista previa no sustituye las pruebas en el juego.',
    capture:'Mantené pulsado el botón derecho del mouse dentro del visor para mirar en cualquier dirección, como en Roblox Studio. Soltalo para recuperar el cursor. WASD mueve la cámara, Q baja y E sube; Shift acelera. El clic derecho breve sigue abriendo el menú contextual.',
    captureButton:'Clic derecho para mirar',captureStatus:'Mirando · Soltá botón derecho para liberar',captureTitle:'Mantener botón derecho para mirar libremente',interact:'interactuar',
    browserWarning:'No es necesario mantener Ctrl para navegar. Los atajos Ctrl+W y Ctrl+R pertenecen al navegador; usá WASD sin Ctrl.',
    cameraKeys:'Botón derecho mantenido: mirar horizontal y verticalmente · WASD: moverse · Q/E: bajar/subir · Shift: rápido · rueda: zoom · botón central: órbita en modo Blender · Esc: cancelar herramientas.',
    transformKeys:'G: mover · R: rotar · C: escalar · Shift: precisión · Alt: modificador de gizmo · Ctrl: ajustes de transformación (fuera de captura) · E: extruir cara seleccionada · Alt+arrastrar en Cara: desplazar UV · Alt+Shift: girar UV · Alt+Ctrl: escalar UV.',
    guideTitle:'Guía de funciones actuales',featureTitle:'Herramientas y características especiales',
    groups:[
      {id:'editor',title:'Editor MAP y navegación',features:['Perspectiva, ortográfica, frontal/lateral/superior, vistas adicionales e isométrica; encuadrar selección o mapa.','Cámara libre con botón derecho, navegación Fly, WASD, Q/E, grilla, snap y gizmos de transformación.','HUD editable, barras acoplables, paneles reordenables, seis idiomas, perfiles de diseño y contador FPS.']},
      {id:'geometry',title:'Geometría y modelado avanzado',features:['Brushes y formas: caja, cuña, cilindro, arco, bóveda, cono, pirámide, esfera poligonal, escaleras y tubo.','Edición de objetos, vértices, aristas y caras; CSG unir/restar/intersectar; extruir, biselar, inset, clip y hollow.','Herramientas para medir distancias, ocultar/bloquear objetos, capas, grupos, selección múltiple y deshacer/rehacer.']},
      {id:'architecture',title:'Formas, construcciones y prefabs',features:['Paredes, losas, vigas, columnas, plataformas, rampas, techos, marcos, puertas y ventanas con medidas configurables.','Aberturas interactivas en muros; previsualización al colocar y recuerdo de dimensiones por forma.','Guardar grupos de brushes y entidades como prefabs; colocarlos nuevamente desde Formas, exportar e importar .svprefab.json.']},
      {id:'textures',title:'Texture Studio 2.0 y WAD',features:['Importación WAD3, búsqueda y miniaturas, selección de materiales y aplicación por cara.','Mini editor UV flotante con escala U/V, desplazamiento, rotación, repetición, Smart Fit, Smart Align y controles directos.','Multiselección de caras, cuentagotas, copiar/pegar material, presets y bloqueo de textura al mover brushes; validación de ejes UV para SC-RAD.']},
      {id:'entities',title:'Entidades FGD y lógica',features:['Importación del FGD de Sven Co-op; edición de classname, targetname, target, keyvalues, apariencias y conexiones.','NPC & AI Studio con rutas, waypoints, spawners, vista previa de modelos y Custom NPC Importer para AngelScript.','Gameplay Studio para puertas, botones, triggers, relays y conexiones visuales.', 'HF8: marcadores automáticos por entidad o forma uniforme; renombrar brushes y buscar nombres al conectar target/targetname.']},
      {id:'world',title:'Terreno, luces y sonido',features:['Terrain & Shape Studio: terreno de brushes convexos, esculpido y generador de rocas/acantilados.','Lighting Studio: luces, sombras aproximadas, niebla, cielo y pruebas de skybox en el navegador.','Sound Studio, colocación de ambientación y convertidor/previsualización de audio.']},
      {id:'models',title:'Modelos y animaciones',features:['Model Browser de archivos MDL con skins, bodygroups y animaciones disponibles.','Colocación y vista previa de entidades y NPC; el comportamiento real depende de Sven Co-op y de los recursos instalados.']},
      {id:'gameplay',title:'Gameplay Test y Cinematic Camera',features:['Prueba de juego dentro del visor: caminar, correr, noclip, linterna, HUD y simulación básica de puertas/botones/triggers.','Cinematic Camera Studio con rutas de cámara, path_corner, trigger_camera y previsualización aproximada.']},
      {id:'bsp',title:'Visor BSP y recuperación',features:['Visor BSP con cámara libre, texturas, lightmaps y etiquetas inteligentes para entidades.','BSP Recovery: edición segura de propiedades, conversión externa BSP → MAP con SurfDecomp y recuperación parcial de texturas/WAD.','Las UV y los lightmaps originales de un BSP decompilado no siempre se reconstruyen exactamente.']},
      {id:'build',title:'Compilación y entrega',features:['Importar/exportar MAP Valve 220 y proyectos .svenstudio.json con deshacer, guardado y recuperación de sesión.','Compilar mediante SC-CSG, SC-BSP, SC-VIS y SC-RAD del SDK instalado en Windows; perfiles ambientales de diagnóstico.','Map Doctor detecta problemas de geometría, entidades, recursos y ejes UV; Map Packager reúne BSP, WAD y archivos de distribución.']}
    ]
  },
  en:{
    summary:'Valve 220 3D map editor for Sven Co-op / Svengine. Create brushes, edit faces and UVs, place FGD entities, test approximate interactions, and compile with the local SDK. Includes architecture, terrain, prefabs, BSP recovery and map packaging. Browser previews do not replace in-game testing.',
    capture:'Hold right mouse button inside the viewport to look freely, Roblox Studio-style. Release RMB to restore the cursor. WASD moves, Q descends and E ascends; Shift accelerates. A short right-click still opens the context menu.',
    captureButton:'Right mouse to look',captureStatus:'Looking · Release right mouse to free cursor',captureTitle:'Hold right mouse button for free look',interact:'interact',
    browserWarning:'Ctrl is not needed for camera navigation. Ctrl+W and Ctrl+R are browser shortcuts; use WASD without Ctrl.',
    cameraKeys:'Hold RMB: look horizontally/vertically · WASD: move · Q/E: down/up · Shift: faster · wheel: zoom · MMB: orbit in Blender preset · Esc: cancel tools.',
    transformKeys:'G move · R rotate · C scale · Shift precision · Alt gizmo modifier · Ctrl transform snap (outside capture) · E extrude selected face · Alt+drag Face: offset UV · Alt+Shift: rotate UV · Alt+Ctrl: scale UV.',
    guideTitle:'Current editor guide',featureTitle:'Features and special tools',groups:[
      {id:'editor',title:'MAP editor and camera',features:['Perspective/orthographic, front/side/top, extra views and isometric; frame selection/map.','Right mouse free look, Fly, WASD, Q/E, grid, snap and transform gizmos.','Editable HUD, dockable panels, six languages, layout presets and FPS counter.']},
      {id:'geometry',title:'Advanced geometry',features:['Brush primitives: box, wedge, cylinder, arch, vault, cone, pyramid, faceted sphere, stairs, tube.','Object, vertex, edge and face editing; CSG union/subtract/intersect; extrude, bevel, inset, clip, hollow.','Measurement, layers, groups, hide/lock, multiselect, undo/redo.']},
      {id:'architecture',title:'Shapes and prefabs',features:['Walls, slabs, beams, columns, platforms, ramps, roofs, door/window frames.','Interactive wall openings, placement preview, saved dimensions per shape.','Save brush/entity groups as prefabs and reuse them; .svprefab.json import/export.']},
      {id:'textures',title:'Texture Studio and WAD',features:['WAD3 import, texture search and browser; face application.','Floating UV controls: U/V scale, shifts, rotation, tiling, Smart Fit, Smart Align, direct handles.','Multi-face editing, eyedropper, copy/paste, presets, texture lock and SC-RAD UV-axis checks.']},
      {id:'entities',title:'FGD entities and logic',features:['Sven Co-op FGD, classname/targetname/target, keyvalues, labels and connections.','NPC & AI Studio, routes, waypoints, spawners, model preview and AngelScript NPC importer.','Gameplay Studio for doors, buttons, triggers, relays and visual links.', 'HF8: automatic or uniform entity markers; rename brushes and search aliases when connecting target/targetname.']},
      {id:'world',title:'Terrain, lighting and sound',features:['Terrain & Shape Studio: convex-brush terrain, sculpting, rocks and cliffs.','Lighting Studio: approximate lights, shadows, fog and skyboxes.','Sound Studio, ambient sound placement and audio preview/conversion.']},
      {id:'models',title:'Models and animations',features:['MDL Model Browser with supported animations, skins and bodygroups.','NPC/entity previews; real gameplay depends on Sven Co-op resources.']},
      {id:'gameplay',title:'Gameplay Test and Cinematic',features:['Walk/run, noclip, flashlight, HUD, basic doors/buttons/triggers simulation.','Cinematic Camera Studio: camera paths, path_corner, trigger_camera and approximate preview.']},
      {id:'bsp',title:'BSP Viewer and recovery',features:['BSP viewing with textures, lightmaps, navigation and smart entity labels.','Safe BSP entity edits and external SurfDecomp BSP→MAP with partial WAD/texture restoration.','Decompiled UVs and original lightmaps may not be reconstructed exactly.']},
      {id:'build',title:'Build and distribution',features:['Valve 220 MAP and .svenstudio.json save/import/export, undo and session recovery.','Compile with locally installed SC-CSG/BSP/VIS/RAD and diagnostic RAD presets.','Map Doctor checks errors and UV axes; Map Packager collects resource files.']}
    ]
  },
  pt:{
    summary:'Editor 3D Valve 220 para Sven Co-op / Svengine. Crie brushes, edite faces e UV, coloque entidades FGD e compile com o SDK local. Inclui arquitetura, terreno, prefabs, recuperação BSP e empacotamento.',
    capture:'Segure o botão direito no visor para olhar livremente, como no Roblox Studio. Solte para recuperar o cursor. WASD move, Q desce e E sobe; Shift acelera. Clique direito curto mantém o menu contextual.',
    captureButton:'Olhar com botão direito',captureStatus:'Olhando · Solte o botão direito',captureTitle:'Segure o botão direito para olhar livremente',interact:'interagir',
    browserWarning:'Ctrl não é necessário para a câmera. Ctrl+W e Ctrl+R são atalhos do navegador.',
    cameraKeys:'Botão direito segurado: olhar · WASD: mover · Q/E: descer/subir · Shift: rápido · roda: zoom · botão central: orbitar no modo Blender.',
    transformKeys:'G mover · R girar · C escala · Shift precisão · Alt modificador · E extrusão · Alt+arrastar na Face: mover UV · Alt+Shift: girar UV · Alt+Ctrl: escalar UV.',
    guideTitle:'Guia atual do editor',featureTitle:'Recursos e ferramentas especiais',groups:[
      {id:'editor',title:'Editor MAP e câmera',features:['Perspectiva, ortográfica, vistas frontal/lateral/superior e isométrica.','Mouse capturado, Fly, WASD/Q/E, grade, snap e gizmos.','HUD editável, painéis acopláveis, seis idiomas e FPS.']},
      {id:'geometry',title:'Geometria avançada',features:['Caixa, cunha, cilindro, arco, abóbada, cone, pirâmide, esfera, escadas e tubo.','Vértices, arestas e faces; CSG, extrusão, bevel, inset, clip e hollow.','Medição, camadas, grupos, ocultar/travar, multisseleção e histórico.']},
      {id:'architecture',title:'Formas e prefabs',features:['Paredes, lajes, vigas, colunas, plataformas, rampas, telhados, portas e janelas.','Aberturas na parede, prévia de posicionamento e dimensões memorizadas.','Guardar/reutilizar grupos como prefabs; importar/exportar .svprefab.json.']},
      {id:'textures',title:'Texture Studio e WAD',features:['Importar WAD3, buscar e aplicar texturas por face.','UV flutuante: escala, deslocamento, rotação, repetição, Smart Fit/Align e controles diretos.','Múltiplas faces, conta-gotas, presets, bloqueio de textura e validação SC-RAD.']},
      {id:'entities',title:'Entidades e lógica',features:['FGD, classname, targetname, target, keyvalues e conexões.','NPC & AI Studio, rotas, spawners, MDL e importador AngelScript.','Gameplay Studio com portas, botões e triggers.']},
      {id:'world',title:'Terreno, luz e áudio',features:['Terrain Studio: esculpir, rochas e penhascos.','Lighting Studio: iluminação aproximada, neblina e skyboxes.','Sound Studio e conversor de áudio.']},
      {id:'models',title:'Modelos MDL',features:['Model Browser: animações, skins e bodygroups.','Prévia de NPCs e entidades; confirme no jogo.']},
      {id:'gameplay',title:'Gameplay e câmeras',features:['Gameplay Test: andar, noclip, lanterna e interações básicas.','Cinematic Camera Studio: path_corner e trigger_camera.']},
      {id:'bsp',title:'BSP Viewer e Recovery',features:['BSP com texturas, lightmaps e etiquetas inteligentes.','BSP → MAP externo e recuperação parcial de WAD/UV; nem toda iluminação é recuperável.']},
      {id:'build',title:'Compilação',features:['MAP Valve 220, projetos, desfazer e recuperação de sessão.','SDK SC-CSG/BSP/VIS/RAD, Map Doctor e Map Packager.']}
    ]
  },
  ru:{
    summary:'3D-редактор карт Valve 220 для Sven Co-op / Svengine. Браши, грани, UV, сущности FGD и компиляция локальным SDK. Инструменты архитектуры, рельефа, префабов, восстановления BSP и упаковки.',
    capture:'Удерживайте правую кнопку мыши в 3D-виде для свободного обзора как в Roblox Studio. Отпустите для возвращения курсора. WASD — перемещение, Q/E — вниз/вверх, Shift — быстрее. Короткий правый клик открывает контекстное меню.',
    captureButton:'Обзор правой кнопкой',captureStatus:'Обзор · Отпустите правую кнопку',captureTitle:'Удерживайте правую кнопку для обзора',interact:'взаимодействие',
    browserWarning:'Ctrl для обзора не нужен. Ctrl+W и Ctrl+R — команды браузера.',
    cameraKeys:'Удерживать ПКМ: обзор · WASD: перемещение · Q/E: вниз/вверх · Shift: ускорение · колесо: масштаб · СКМ: вращение в режиме Blender.',
    transformKeys:'G перемещение · R вращение · C масштаб · Shift точность · Alt модификатор · E выдавливание · Alt+перетаскивание граней: UV · Alt+Shift: вращение UV · Alt+Ctrl: масштаб UV.',
    guideTitle:'Руководство по текущей версии',featureTitle:'Особые инструменты и функции',groups:[
      {id:'editor',title:'MAP и камера',features:['Перспектива, ортографические и изометрические виды, фокус на выборе.','Захват курсора, Fly, WASD/Q/E, сетка, привязка, гизмо.','Настраиваемый HUD, панели, 6 языков, FPS.']},
      {id:'geometry',title:'Геометрия',features:['Блок, клин, цилиндр, арка, свод, конус, пирамида, сфера, лестницы, труба.','Вершины, рёбра, грани, CSG, extrude, bevel, inset, clip, hollow.','Измерения, группы, слои, скрытие, блокировка, отмена.']},
      {id:'architecture',title:'Формы и префабы',features:['Стены, перекрытия, колонны, двери, окна и рамы.','Проёмы в стенах, предпросмотр размещения, сохранение размеров.','Группы брашей/сущностей как префабы, .svprefab.json.']},
      {id:'textures',title:'Texture Studio и WAD',features:['WAD3, поиск текстур, назначение на грани.','Смещение, масштаб UV, поворот, повторы, Smart Fit/Align, манипуляторы.','Несколько граней, пипетка, пресеты, привязка текстуры, проверка SC-RAD.']},
      {id:'entities',title:'FGD и логика',features:['classname, targetname, target, keyvalues, связи.','NPC & AI Studio, маршруты, spawners, MDL, AngelScript importer.','Gameplay Studio: двери, кнопки, триггеры и реле.']},
      {id:'world',title:'Рельеф, свет, звук',features:['Terrain Studio: рельеф, камни, скалы.','Lighting Studio: приблизительный свет, туман, небо.','Sound Studio и конвертер звука.']},
      {id:'models',title:'Модели',features:['MDL Browser: анимации, skins, bodygroups.','Предпросмотр NPC и сущностей.']},
      {id:'gameplay',title:'Gameplay и Cinematic',features:['Gameplay Test: движение, noclip, фонарь, простые взаимодействия.','Cinematic Camera Studio: маршруты path_corner и trigger_camera.']},
      {id:'bsp',title:'BSP Viewer и Recovery',features:['BSP, текстуры, lightmaps, умные метки.','BSP→MAP и частичное восстановление WAD; исходный свет не гарантируется.']},
      {id:'build',title:'Компиляция',features:['Valve 220 MAP, проекты, история, восстановление сессии.','SDK SC-CSG/BSP/VIS/RAD, Map Doctor, Map Packager.']}
    ]
  },
  ko:{
    summary:'Sven Co-op / Svengine용 Valve 220 3D 맵 편집기입니다. 브러시, 면, UV, FGD 엔티티를 편집하고 로컬 SDK로 컴파일합니다. 건축, 지형, 프리팹, BSP 복구 및 패키징 기능을 포함합니다.',
    capture:'뷰포트에서 마우스 오른쪽 버튼을 누르고 있으면 Roblox Studio처럼 자유롭게 시점을 회전합니다. 놓으면 커서가 돌아옵니다. WASD로 이동, Q/E로 하강/상승, Shift로 가속합니다. 짧은 오른쪽 클릭은 상황 메뉴를 엽니다.',
    captureButton:'오른쪽 버튼으로 시점 회전',captureStatus:'시점 이동 중 · 오른쪽 버튼을 놓으세요',captureTitle:'오른쪽 버튼을 누른 채 시점 회전',interact:'상호작용',
    browserWarning:'카메라 제어에 Ctrl이 필요하지 않습니다. Ctrl+W와 Ctrl+R은 브라우저 단축키입니다.',
    cameraKeys:'오른쪽 버튼 유지: 시점 회전 · WASD: 이동 · Q/E: 하강/상승 · Shift: 빠르게 · 휠: 확대/축소 · 가운데 버튼: Blender 궤도 회전.',
    transformKeys:'G 이동 · R 회전 · C 크기 · Shift 정밀도 · Alt 기즈모 변경 · E 돌출 · 면에서 Alt+드래그 UV 이동 · Alt+Shift UV 회전 · Alt+Ctrl UV 크기.',
    guideTitle:'현재 편집기 안내',featureTitle:'특수 도구와 기능',groups:[
      {id:'editor',title:'MAP 편집기와 카메라',features:['원근/직교/등각 뷰와 선택 항목에 맞추기.','커서 캡처, Fly, WASD/Q/E, 그리드, 스냅과 기즈모.','편집 가능한 HUD, 도킹 패널, 6개 언어, FPS.']},
      {id:'geometry',title:'고급 지오메트리',features:['상자, 쐐기, 원통, 아치, 돔, 원뿔, 피라미드, 구체, 계단, 튜브.','버텍스/엣지/면 편집, CSG, 돌출, bevel, inset, clip, hollow.','거리 측정, 그룹, 레이어, 숨김/잠금, 실행 취소.']},
      {id:'architecture',title:'도형 및 프리팹',features:['벽, 기둥, 슬래브, 문, 창문, 지붕과 프레임.','벽 개구부, 배치 미리보기, 크기 저장.','브러시/엔티티 그룹 저장 및 .svprefab.json.']},
      {id:'textures',title:'Texture Studio와 WAD',features:['WAD3 가져오기, 검색 및 면 텍스처 적용.','UV 이동, 배율, 회전, 반복, Smart Fit/Align, 직접 핸들.','여러 면 편집, 스포이트, 프리셋, 텍스처 잠금, SC-RAD 검증.']},
      {id:'entities',title:'FGD와 로직',features:['classname/targetname/target, keyvalues, 연결.','NPC & AI Studio, 경로, spawner, MDL, AngelScript 가져오기.','문, 버튼, 트리거용 Gameplay Studio.']},
      {id:'world',title:'지형, 조명, 사운드',features:['Terrain Studio: 지형, 바위, 절벽.','Lighting Studio: 근사 조명, 안개, 하늘.','Sound Studio와 오디오 변환.']},
      {id:'models',title:'MDL 모델',features:['애니메이션, skins, bodygroups 탐색.','NPC/엔티티 미리보기.']},
      {id:'gameplay',title:'Gameplay 및 Cinematic',features:['Gameplay Test: 이동, noclip, 손전등, 기본 상호작용.','Cinematic Camera Studio: path_corner, trigger_camera.']},
      {id:'bsp',title:'BSP 뷰어와 복구',features:['BSP 텍스처, lightmaps, 스마트 엔티티 레이블.','BSP→MAP 및 일부 WAD 복구; 원본 조명은 보장되지 않습니다.']},
      {id:'build',title:'컴파일',features:['Valve 220 MAP, 프로젝트, 실행 취소, 세션 복구.','SC-CSG/BSP/VIS/RAD SDK, Map Doctor, Map Packager.']}
    ]
  },
  zh:{
    summary:'适用于 Sven Co-op / Svengine 的 Valve 220 三维地图编辑器。支持 Brush、面、UV、FGD 实体以及本地 SDK 编译，并包含建筑、地形、预制件、BSP 恢复和打包工具。',
    capture:'在 3D 视口按住鼠标右键即可像 Roblox Studio 一样自由转动视角，松开则恢复光标。WASD 移动，Q/E 下降/上升，Shift 加速。短按右键仍可打开上下文菜单。',
    captureButton:'按住右键环视',captureStatus:'环视中 · 松开右键退出',captureTitle:'按住鼠标右键自由环视',interact:'交互',
    browserWarning:'相机操作不需要 Ctrl。Ctrl+W 和 Ctrl+R 是浏览器快捷键。',
    cameraKeys:'按住右键：水平/垂直环视 · WASD：移动 · Q/E：下降/上升 · Shift：加速 · 滚轮：缩放 · 中键：Blender 轨道。',
    transformKeys:'G 移动 · R 旋转 · C 缩放 · Shift 精细调整 · Alt 控制轴 · E 挤出 · 面模式 Alt+拖动调整 UV · Alt+Shift 旋转 UV · Alt+Ctrl 缩放 UV。',
    guideTitle:'当前编辑器指南',featureTitle:'特殊工具与功能',groups:[
      {id:'editor',title:'MAP 编辑与相机',features:['透视、正交、前/侧/顶及等轴视图，聚焦选择。','鼠标捕获、Fly、WASD/Q/E、网格、吸附、变换控制轴。','可编辑 HUD、停靠面板、六种语言、FPS。']},
      {id:'geometry',title:'高级几何',features:['方块、楔形、圆柱、拱、穹顶、圆锥、金字塔、球体、楼梯、管道。','顶点/边/面编辑、CSG、挤出、bevel、inset、clip、hollow。','测量、分组、图层、隐藏/锁定、多选与撤销。']},
      {id:'architecture',title:'形状与预制件',features:['墙体、梁、柱、门窗、屋顶与边框。','墙体开口、放置预览、每种形状的尺寸记忆。','保存 Brush/实体组合为预制件；.svprefab.json。']},
      {id:'textures',title:'Texture Studio 与 WAD',features:['导入 WAD3、搜索纹理并应用到面。','UV 位移、比例、旋转、平铺、Smart Fit/Align 与手柄。','多面编辑、吸管、预设、纹理锁定与 SC-RAD 轴检查。']},
      {id:'entities',title:'FGD 与逻辑',features:['classname、targetname、target、keyvalues 与连接。','NPC & AI Studio：路径、生成器、MDL、AngelScript 导入。','Gameplay Studio：门、按钮、触发器。']},
      {id:'world',title:'地形、光照、声音',features:['Terrain Studio：地形、岩石和悬崖。','Lighting Studio：近似灯光、雾与天空。','Sound Studio 和音频转换。']},
      {id:'models',title:'MDL 模型',features:['浏览动画、skins、bodygroups。','预览 NPC 与实体。']},
      {id:'gameplay',title:'Gameplay 和 Cinematic',features:['Gameplay Test：移动、noclip、手电筒和基本交互。','Cinematic Camera Studio：path_corner 与 trigger_camera。']},
      {id:'bsp',title:'BSP 查看和恢复',features:['BSP 纹理、lightmaps、智能实体标签。','BSP→MAP 和部分 WAD 恢复；不保证还原原始光照。']},
      {id:'build',title:'编译与打包',features:['Valve 220 MAP、项目保存、撤销与会话恢复。','SC-CSG/BSP/VIS/RAD、Map Doctor、Map Packager。']}
    ]
  }
};
const hf7Features:Record<Locale,string[]>={es: ['Asistente de entidades con mini guías FGD, selección de sonidos WAV, conexiones rápidas target/targetname y ajustes de puertas/botones.', 'Desvincular uno o varios brushes de entidades sólidas y regresarlos a worldspawn conservando texturas y geometría.', 'Apariencia de entidades: marcadores pequeños, cajas, burbujas, cápsulas, diamantes y conos; escala ajustable sin afectar el MAP.', 'info_player_start: jugador parado sobre el suelo, animación idle cuando el MDL lo permite y control de dirección inicial con ángulo yaw.', 'Smart Placement: orientar formas y prefabs antes de colocarlos, superficies verticales y dibujo en planos XY/XZ/YZ.'], en: ['Entity Assistant with FGD mini-guides, WAV sound selector, target/targetname connections, and door/button settings.', 'Detach one or many brushes from solid entities back to worldspawn without losing textures or geometry.', 'Entity appearance: smaller markers, boxes, bubbles, capsules, diamonds and cones; scalable without changing MAP data.', 'info_player_start: grounded player model, idle animation where supported, and editable spawn-facing yaw.', 'Smart Placement: rotate shapes and prefabs before placing, vertical surfaces, and XY/XZ/YZ drawing planes.'], ru: ['Помощник сущностей: справки FGD, звуки WAV, связи target/targetname и параметры дверей и кнопок.', 'Отвязка кистей от сущностей в worldspawn с сохранением геометрии и текстур.', 'Вид сущностей: маленькие маркеры, кубы, сферы, капсулы, ромбы и конусы.', 'info_player_start: модель стоит на полу, idle-анимация (если доступна) и настройка направления появления.', 'Smart Placement: поворот форм и префабов до размещения, вертикальные поверхности и плоскости XY/XZ/YZ.'], ko: ['엔티티 도우미: FGD 가이드, WAV 사운드, target/targetname 연결, 문·버튼 설정.', '브러시를 엔티티에서 분리하여 텍스처와 형상을 유지한 채 worldspawn으로 전환.', '엔티티 표시: 작은 마커, 상자, 구, 캡슐, 다이아몬드, 원뿔.', 'info_player_start: 바닥에 선 모델, 지원되는 idle 애니메이션 및 시작 방향 설정.', 'Smart Placement: 배치 전 회전, 수직 면, XY/XZ/YZ 평면 그리기.'], zh: ['实体助手：FGD 指南、WAV 音效、target/targetname 连接及门/按钮设置。', '从实体解绑 Brush 并转换到 worldspawn，保留纹理和几何。', '实体外观：小标记、方框、球体、胶囊、菱形、圆锥。', 'info_player_start：模型站在地面，支持时播放 idle，设置出生视角方向。', 'Smart Placement：放置前旋转形状和预制件，支持垂直面与 XY/XZ/YZ 绘制。'], pt: ['Assistente de entidades: guias FGD, sons WAV, conexões target/targetname e controles de portas e botões.', 'Desvincule brushes de entidades para worldspawn mantendo texturas e geometria.', 'Aparência de entidades: marcadores menores, caixas, esferas, cápsulas, diamantes e cones.', 'info_player_start: personagem apoiado no piso, animação idle quando disponível e direção inicial editável.', 'Smart Placement: rotação de formas e prefabs antes de posicionar, superfícies verticais e planos XY/XZ/YZ.']};
export function studioGuide(locale:Locale):GuideContent{
  const base=guide[locale]||guide.en;
  return {...base,groups:[...base.groups,{id:'hf7',title:({es:'Últimas mejoras v1.4',en:'Latest v1.4 features',ru:'Новые возможности v1.4',ko:'v1.4 최신 기능',zh:'v1.4 最新功能',pt:'Novidades da v1.4'} as const)[locale],features:hf7Features[locale]}]};
}
