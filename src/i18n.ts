/** UI strings only. Never translate game classnames, keys, WAD texture names or FGD data. */
import {useCallback} from 'react';
import {useEditor} from './store';
export type Locale = 'es'|'en'|'ru'|'ko'|'zh'|'pt';
export type LocalePreference = Locale|'auto';

const STORAGE_KEY = 'svenstudio-locale';
const supported = new Set<string>(['es','en','ru','ko','zh','pt']);

/** Honor the browser/OS language priority; unsupported languages fall back to English. */
export function detectSystemLocale(languages:readonly string[]):Locale {
  for (const entry of languages) {
    const primary = String(entry || '').trim().replace('_','-').split('-')[0]?.toLowerCase();
    if (supported.has(primary)) return primary as Locale;
  }
  return 'en';
}

export function systemLocale():Locale {
  try {
    if (typeof navigator === 'undefined') return 'en';
    const languages = Array.isArray(navigator.languages) && navigator.languages.length
      ? [...navigator.languages] : [navigator.language];
    return detectSystemLocale(languages);
  } catch { return 'en'; }
}

/** Old saved explicit locales remain valid; no preference means automatic. */
export function readLocalePreference():LocalePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && supported.has(saved) ? saved as Locale : 'auto';
  } catch { return 'auto'; }
}

export function preferredLocale():Locale {
  const selected = readLocalePreference();
  return selected === 'auto' ? systemLocale() : selected;
}

export function saveLocalePreference(selected:LocalePreference):void {
  try {
    if (selected === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, selected);
  } catch { /* The language still changes for this session if storage is blocked. */ }
}


export const LANGUAGES:{id:Locale;label:string}[]=[
  {id:'es',label:'Español'},{id:'en',label:'English'},{id:'ru',label:'Русский'},{id:'ko',label:'한국어'},{id:'zh',label:'简体中文'},{id:'pt',label:'Português (Brasil)'}
];
const es:Record<string,string>={
 'Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.':'Mové las herramientas flotantes con Editar HUD. La ubicación en los bordes solo se aplica a la barra clásica.',
 'Gizmo':'Gizmo','Show transform gizmo':'Mostrar gizmo de transformación','Hide transform gizmo':'Ocultar gizmo de transformación',
  'File':'Archivo','Help':'Ayuda','New project':'Nuevo proyecto','Open project':'Abrir proyecto','Import .MAP':'Importar .MAP','Save project':'Guardar proyecto','Save':'Guardar','Export Svengine .MAP':'Exportar .MAP de Svengine',
  'Compile Map':'Compilar mapa','Stop Build':'Detener compilación','Build configuration':'Configuración de compilación','Map name':'Nombre del mapa','Compiler folder':'Carpeta de compiladores','Game directory':'Carpeta del juego','WAD full paths (one per line)':'Rutas completas WAD (una por línea)','Save settings':'Guardar ajustes',
  'Point to your installed Sven Co-op SDK compiler folder and Sven Co-op game directory. Paths must be on the PC running the editor.':'Seleccioná los compiladores del SDK de Sven Co-op y la carpeta del juego instalados en esta PC.',
  'Letters, numbers, underscores and hyphens only.':'Solo letras, números, guion bajo y guion.',
  'These file paths are written to the worldspawn wad key for the compilers. Import a matching .WAD in the Texture Browser for previews.':'Estas rutas se agregan a worldspawn para compilar. Importá los mismos WAD para previsualizarlos.',
  'Camera & Gizmo Controls':'Controles de cámara y gizmo','Camera navigation':'Navegación de cámara','Navigation preset':'Esquema de navegación','Orbit sensitivity':'Sensibilidad de órbita','Pan sensitivity':'Sensibilidad de desplazamiento','Zoom sensitivity':'Sensibilidad de zoom','Fly speed (units/sec)':'Velocidad de vuelo (unidades/s)','Invert orbit rotation':'Invertir órbita','Gizmo / Transform':'Gizmo / Transformación','Gizmo orientation':'Orientación del gizmo','Rotation snap (0 = off)':'Incremento de rotación (0 = desactivado)','Scale snap (0 = off)':'Incremento de escala (0 = desactivado)','Gizmo size':'Tamaño del gizmo','Custom keyboard shortcuts':'Atajos de teclado personalizados','Unassigned':'Sin asignar','Press a key…':'Presioná una tecla…','Reset to Blender defaults':'Restablecer valores Blender','Done':'Listo',
  'Navigation':'Navegación','Interface language':'Idioma de la interfaz','Language':'Idioma','General':'General','English':'Inglés','Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom':'Blender — botón central orbita · Shift+central desplaza · Ctrl+central zoom','Classic — RMB orbit · MMB zoom · LMB pan':'Clásico — botón derecho orbita · central zoom · izquierdo desplaza',
  'Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.':'Rueda: zoom. En Blender, WASD se usa al activar Fly/Walk. Esc sale del modo de vuelo o de la herramienta.',
  'Translate uses the Grid / Snap controls in the editor toolbar. Rotation and scale snaps are optional. Multi-selection pivots use World axes.':'Move usa la cuadrícula del editor. Los incrementos de rotación y escala son opcionales. La selección múltiple usa ejes globales.',
  'Click a shortcut and press your preferred key combination. Backspace clears it; Esc cancels. Conflicting shortcuts are automatically unassigned.':'Hacé clic en un atajo y presioná una combinación. Retroceso lo borra; Esc cancela. Los conflictos se desasignan automáticamente.',
  'Changes are saved automatically in this browser.':'Los cambios se guardan automáticamente en este navegador.',
  'Move':'Mover','Rotate':'Rotar','Scale':'Escalar','Draw':'Dibujar','Block':'Bloque','Wedge':'Cuña','Cylinder':'Cilindro','Arch':'Arco','Faces':'Caras','Wire':'Malla','Grid':'Grilla','Snap':'Ajustar','Undo':'Deshacer','Redo':'Rehacer','Clone':'Duplicar','Delete':'Eliminar',
  'TRANSFORM':'TRANSFORMAR','CREATE':'CREAR','VIEW':'VISTA','EDIT':'EDITAR','SELECT':'SELECCIÓN','DRAW ACTIVE':'DIBUJO ACTIVO','PRIMITIVES':'PRIMITIVAS','Height':'Altura','Ready':'Listo','brushes':'brushes','entities':'entidades','objects':'objetos','selected':'seleccionados',
  'Toolbox':'Caja de herramientas','Entity Browser':'Explorador de entidades','Texture Browser':'Explorador de texturas','Layers':'Capas','Search textures...':'Buscar texturas...','Search classname...':'Buscar classname...',
  'Click to create geometry. Drag it using the transform gizmo.':'Hacé clic para crear geometría. Arrastrala con el gizmo de transformación.','SOLID PRIMITIVES':'PRIMITIVAS SÓLIDAS','QUICK START':'INICIO RÁPIDO','Player Spawn':'Aparición del jugador','Point Light':'Luz puntual','WORKFLOW':'FLUJO DE TRABAJO','Build with convex solids. Use `.wad` textures and `.fgd` entity definitions from your Sven Co-op installation.':'Construí con sólidos convexos. Usá texturas .wad y entidades .fgd de tu instalación de Sven Co-op.',
  'Import .FGD':'Importar .FGD','Imported FGD definitions active':'Definiciones FGD importadas','Starter list. Import sven-coop.fgd for full list.':'Lista básica. Importá sven-coop.fgd para la lista completa.','Import WAD3':'Importar WAD3','Choose textures, then paint selected faces or brushes.':'Elegí texturas para pintar caras o brushes seleccionados.','All WAD files':'Todos los WAD','No WAD textures loaded':'No hay texturas WAD','Import halflife.wad or another WAD3 file from Sven Co-op.':'Importá un archivo WAD3 de Sven Co-op.','Show favorites only':'Solo favoritos','Toggle favorite':'Marcar favorito',
  'Assign an object to a layer from its Properties panel.':'Asigná un objeto a una capa desde Propiedades.','Show/hide layer':'Mostrar/ocultar capa','Explorer':'Explorador','Filter objects...':'Filtrar objetos...','Workspace':'Área de trabajo','Geometry':'Geometría','Entities':'Entidades','Toggle visibility':'Alternar visibilidad','Toggle lock':'Alternar bloqueo','World Properties':'Propiedades del mundo','Map environment':'Entorno del mapa','WORLD SETTINGS':'AJUSTES DEL MUNDO','Select a brush or entity in the viewport to edit its properties.':'Seleccioná un brush o entidad en la vista 3D para editar sus propiedades.',
  'Multi-selection':'Selección múltiple','objects selected':'objetos seleccionados','Move group with the 3D gizmo':'Transformá el grupo con el gizmo 3D','Use Ctrl/Shift + click in Explorer or the viewport to change the selection. Group move is committed when releasing the gizmo; Rotate and Scale remain individual operations.':'Usá Ctrl/Shift + clic para cambiar la selección. Mover, rotar y escalar afectan al grupo.','Duplicate all':'Duplicar todos','Delete all':'Eliminar todos','Properties':'Propiedades','Brush':'Brush','Entity':'Entidad',
  'Name':'Nombre','Position':'Posición','Rotation':'Rotación','Dimensions (units)':'Dimensiones (unidades)','ORGANIZATION':'ORGANIZACIÓN','Layer':'Capa','ENTITY KEYVALUES':'PROPIEDADES DE ENTIDAD','BRUSH MATERIAL':'MATERIAL DEL BRUSH','Editing Face':'Editando cara','Enable Face Mode and click a face to edit its texture coordinates.':'Activá el modo Caras y hacé clic en una superficie para editar sus coordenadas de textura.','Duplicate':'Duplicar',
  'Console':'Consola','Build log':'Registro de compilación','Clear':'Limpiar','Hide':'Ocultar','Show':'Mostrar','No messages':'Sin mensajes','Perspective':'Perspectiva','Textured':'Con texturas','Face':'Cara','Object':'Objeto','selection':'selección',
  'Vertex':'Vértice','Edge':'Arista','Edit vertices':'Editar vértices','Edit edges':'Editar aristas','Face selection mode':'Selección de caras','Clip':'Cortar','Hollow':'Vaciar','Clipping':'Corte','Geometry editing':'Edición de geometría','Selected vertex':'Vértice seleccionado','Selected edge':'Arista seleccionada','Invalid geometry':'Geometría inválida','Split along plane':'Dividir con plano','Clip positive':'Recortar lado positivo','Clip negative':'Recortar lado negativo','Hollow thickness':'Espesor de paredes','Cut axis':'Eje de corte','Cut position':'Posición del corte',
  'Only closed convex brushes can be exported to Svengine. Invalid edits are rejected.':'Solo se exportan brushes convexos cerrados a Svengine. Las ediciones inválidas se rechazan.',
  'Svengine / Sven Co-op 5.x only':'Exclusivo para Svengine / Sven Co-op 5.x','Sven Co-op SDK required':'Se requiere el SDK de Sven Co-op','Editor 3D de Sven Co-op':'Editor 3D de Sven Co-op',
};
const ru:Record<string,string>={
 'Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.':'Перемещайте плавающие инструменты через настройку HUD. Стыковка панели доступна только для классической ленты.',
 'Gizmo':'Гизмо','Show transform gizmo':'Показать гизмо','Hide transform gizmo':'Скрыть гизмо',
  'File':'Файл','Help':'Справка','New project':'Новый проект','Open project':'Открыть проект','Import .MAP':'Импорт .MAP','Save project':'Сохранить проект','Save':'Сохранить','Export Svengine .MAP':'Экспорт .MAP для Svengine','Compile Map':'Скомпилировать карту','Stop Build':'Остановить сборку','Build configuration':'Настройки компиляции','Map name':'Имя карты','Compiler folder':'Папка компиляторов','Game directory':'Папка игры','WAD full paths (one per line)':'Полные пути к WAD (по одному на строку)','Save settings':'Сохранить настройки',
  'Point to your installed Sven Co-op SDK compiler folder and Sven Co-op game directory. Paths must be on the PC running the editor.':'Укажите папку компиляторов Sven Co-op SDK и каталог игры на этом компьютере.','Letters, numbers, underscores and hyphens only.':'Только буквы, цифры, подчёркивания и дефисы.','These file paths are written to the worldspawn wad key for the compilers. Import a matching .WAD in the Texture Browser for previews.':'Пути записываются в ключ wad объекта worldspawn. Для предпросмотра импортируйте соответствующие WAD.',
  'Camera & Gizmo Controls':'Управление камерой и гизмо','Camera navigation':'Навигация камеры','Navigation preset':'Схема навигации','Orbit sensitivity':'Чувствительность вращения','Pan sensitivity':'Чувствительность панорамирования','Zoom sensitivity':'Чувствительность масштаба','Fly speed (units/sec)':'Скорость полёта (ед./с)','Invert orbit rotation':'Инвертировать вращение','Gizmo / Transform':'Гизмо / Преобразования','Gizmo orientation':'Ориентация гизмо','Rotation snap (0 = off)':'Шаг поворота (0 = выкл.)','Scale snap (0 = off)':'Шаг масштабирования (0 = выкл.)','Gizmo size':'Размер гизмо','Custom keyboard shortcuts':'Настраиваемые горячие клавиши','Unassigned':'Не назначено','Press a key…':'Нажмите клавишу…','Reset to Blender defaults':'Настройки Blender по умолчанию','Done':'Готово','Navigation':'Навигация','Interface language':'Язык интерфейса','Language':'Язык','General':'Общие','Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom':'Blender — СКМ вращение · Shift+СКМ сдвиг · Ctrl+СКМ масштаб','Classic — RMB orbit · MMB zoom · LMB pan':'Классика — ПКМ вращение · СКМ масштаб · ЛКМ сдвиг',
  'Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.':'Колесо мыши: масштаб. В режиме Blender WASD доступны при полёте. Esc завершает полёт или действие.','Translate uses the Grid / Snap controls in the editor toolbar. Rotation and scale snaps are optional. Multi-selection pivots use World axes.':'Перемещение использует шаг сетки; поворот и масштабирование могут иметь свои шаги.','Click a shortcut and press your preferred key combination. Backspace clears it; Esc cancels. Conflicting shortcuts are automatically unassigned.':'Нажмите на сочетание и задайте новое. Backspace очищает, Esc отменяет. Конфликты удаляются.','Changes are saved automatically in this browser.':'Изменения сохраняются в браузере автоматически.',
  'Move':'Переместить','Rotate':'Повернуть','Scale':'Масштаб','Draw':'Рисовать','Block':'Блок','Wedge':'Клин','Cylinder':'Цилиндр','Arch':'Арка','Faces':'Грани','Wire':'Каркас','Grid':'Сетка','Snap':'Привязка','Undo':'Отменить','Redo':'Повторить','Clone':'Копия','Delete':'Удалить','TRANSFORM':'ПРЕОБРАЗОВАНИЕ','CREATE':'СОЗДАНИЕ','VIEW':'ВИД','EDIT':'ПРАВКА','SELECT':'ВЫБОР','DRAW ACTIVE':'РИСОВАНИЕ','PRIMITIVES':'ПРИМИТИВЫ','Height':'Высота','Ready':'Готово','brushes':'брашей','entities':'сущностей','objects':'объектов','selected':'выбрано',
  'Toolbox':'Инструменты','Entity Browser':'Каталог сущностей','Texture Browser':'Каталог текстур','Layers':'Слои','Search textures...':'Поиск текстур...','Search classname...':'Поиск classname...','Click to create geometry. Drag it using the transform gizmo.':'Нажмите, чтобы создать геометрию; перемещайте её гизмо.','SOLID PRIMITIVES':'ПРИМИТИВЫ','QUICK START':'БЫСТРЫЙ СТАРТ','Player Spawn':'Точка появления','Point Light':'Точечный свет','WORKFLOW':'ПРОЦЕСС','Build with convex solids. Use `.wad` textures and `.fgd` entity definitions from your Sven Co-op installation.':'Стройте выпуклыми телами. Используйте файлы WAD и FGD из Sven Co-op.','Import .FGD':'Импорт .FGD','Imported FGD definitions active':'FGD загружен','Starter list. Import sven-coop.fgd for full list.':'Базовый список. Импортируйте sven-coop.fgd для полного.','Import WAD3':'Импорт WAD3','Choose textures, then paint selected faces or brushes.':'Выберите текстуру и примените её к граням или брашам.','All WAD files':'Все WAD','No WAD textures loaded':'Текстуры WAD не загружены','Import halflife.wad or another WAD3 file from Sven Co-op.':'Импортируйте файл WAD3 из Sven Co-op.','Show favorites only':'Только избранное','Toggle favorite':'В избранное',
  'Assign an object to a layer from its Properties panel.':'Назначьте слой в свойствах объекта.','Show/hide layer':'Показать/скрыть слой','Explorer':'Обозреватель','Filter objects...':'Фильтр объектов...','Workspace':'Рабочая область','Geometry':'Геометрия','Entities':'Сущности','Toggle visibility':'Переключить видимость','Toggle lock':'Переключить блокировку','World Properties':'Свойства мира','Map environment':'Окружение карты','WORLD SETTINGS':'НАСТРОЙКИ МИРА','Select a brush or entity in the viewport to edit its properties.':'Выберите браш или сущность для редактирования.','Multi-selection':'Множественный выбор','objects selected':'объектов выбрано','Move group with the 3D gizmo':'Преобразование группы гизмо','Use Ctrl/Shift + click in Explorer or the viewport to change the selection. Group move is committed when releasing the gizmo; Rotate and Scale remain individual operations.':'Используйте Ctrl/Shift + щелчок для выбора. Перемещение, поворот и масштаб применяются ко всей группе.','Duplicate all':'Дублировать всё','Delete all':'Удалить всё','Properties':'Свойства','Brush':'Браш','Entity':'Сущность','Name':'Имя','Position':'Позиция','Rotation':'Поворот','Dimensions (units)':'Размеры (ед.)','ORGANIZATION':'ОРГАНИЗАЦИЯ','Layer':'Слой','ENTITY KEYVALUES':'ПАРАМЕТРЫ СУЩНОСТИ','BRUSH MATERIAL':'МАТЕРИАЛ БРАША','Vertices':'Вершины','Editing Face':'Редактирование грани','Enable Face Mode and click a face to edit its texture coordinates.':'Включите режим граней и выберите грань для настройки текстуры.','Duplicate':'Дублировать',
  'Console':'Консоль','Build log':'Журнал компиляции','Clear':'Очистить','Hide':'Скрыть','Show':'Показать','Perspective':'Перспектива','Textured':'Текстуры','Face':'Грань','Object':'Объект','selection':'выбор','Vertex':'Вершина','Edge':'Ребро','Edit vertices':'Редактировать вершины','Edit edges':'Редактировать рёбра','Face selection mode':'Выбор граней','Clip':'Разрезать','Hollow':'Полость','Clipping':'Разрез','Geometry editing':'Правка геометрии','Selected vertex':'Выбранная вершина','Selected edge':'Выбранное ребро','Invalid geometry':'Некорректная геометрия','Split along plane':'Разделить по плоскости','Clip positive':'Оставить положительную сторону','Clip negative':'Оставить отрицательную сторону','Hollow thickness':'Толщина стенок','Cut axis':'Ось разреза','Cut position':'Положение разреза','Only closed convex brushes can be exported to Svengine. Invalid edits are rejected.':'В Svengine экспортируются только замкнутые выпуклые браши. Недопустимые изменения отклоняются.','Svengine / Sven Co-op 5.x only':'Только Svengine / Sven Co-op 5.x','Sven Co-op SDK required':'Требуется Sven Co-op SDK',
};
const ko:Record<string,string>={
 'Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.':'플로팅 도구 위치는 HUD 편집에서 조절하세요. 도킹 위치는 클래식 도구막대에만 적용됩니다.',
 'Gizmo':'기즈모','Show transform gizmo':'변형 기즈모 표시','Hide transform gizmo':'변형 기즈모 숨기기',
  'File':'파일','Help':'도움말','New project':'새 프로젝트','Open project':'프로젝트 열기','Import .MAP':'.MAP 가져오기','Save project':'프로젝트 저장','Save':'저장','Export Svengine .MAP':'Svengine .MAP 내보내기','Compile Map':'맵 컴파일','Stop Build':'컴파일 중지','Build configuration':'컴파일 설정','Map name':'맵 이름','Compiler folder':'컴파일러 폴더','Game directory':'게임 폴더','WAD full paths (one per line)':'WAD 전체 경로 (줄마다 하나)','Save settings':'설정 저장',
  'Point to your installed Sven Co-op SDK compiler folder and Sven Co-op game directory. Paths must be on the PC running the editor.':'이 PC에 설치된 Sven Co-op SDK 컴파일러 폴더와 게임 폴더를 지정하세요.','Letters, numbers, underscores and hyphens only.':'영문자, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.','These file paths are written to the worldspawn wad key for the compilers. Import a matching .WAD in the Texture Browser for previews.':'경로는 worldspawn의 wad 키에 저장됩니다. 미리 보려면 같은 WAD를 가져오세요.',
  'Camera & Gizmo Controls':'카메라 및 기즈모 조작','Camera navigation':'카메라 탐색','Navigation preset':'탐색 프리셋','Orbit sensitivity':'회전 감도','Pan sensitivity':'이동 감도','Zoom sensitivity':'확대 감도','Fly speed (units/sec)':'비행 속도 (단위/초)','Invert orbit rotation':'궤도 회전 반전','Gizmo / Transform':'기즈모 / 변환','Gizmo orientation':'기즈모 방향','Rotation snap (0 = off)':'회전 스냅 (0=끔)','Scale snap (0 = off)':'크기 스냅 (0=끔)','Gizmo size':'기즈모 크기','Custom keyboard shortcuts':'사용자 지정 단축키','Unassigned':'미지정','Press a key…':'키를 누르세요…','Reset to Blender defaults':'Blender 기본값으로 복원','Done':'완료','Navigation':'탐색','Interface language':'인터페이스 언어','Language':'언어','General':'일반','Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom':'Blender — 가운데 회전 · Shift+가운데 이동 · Ctrl+가운데 확대','Classic — RMB orbit · MMB zoom · LMB pan':'클래식 — 오른쪽 회전 · 가운데 확대 · 왼쪽 이동',
  'Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.':'휠: 확대/축소. Blender에서는 비행 모드에서 WASD를 사용합니다. Esc로 종료합니다.','Translate uses the Grid / Snap controls in the editor toolbar. Rotation and scale snaps are optional. Multi-selection pivots use World axes.':'이동은 그리드 스냅을 사용하며 회전 및 크기 스냅은 선택 사항입니다.','Click a shortcut and press your preferred key combination. Backspace clears it; Esc cancels. Conflicting shortcuts are automatically unassigned.':'단축키를 클릭해 조합을 누르세요. Backspace로 지우고 Esc로 취소합니다. 중복 단축키는 해제됩니다.','Changes are saved automatically in this browser.':'변경 사항은 이 브라우저에 자동 저장됩니다.',
  'Move':'이동','Rotate':'회전','Scale':'크기','Draw':'그리기','Block':'블록','Wedge':'쐐기','Cylinder':'원기둥','Arch':'아치','Faces':'면','Wire':'와이어','Grid':'그리드','Snap':'스냅','Undo':'실행 취소','Redo':'다시 실행','Clone':'복제','Delete':'삭제','TRANSFORM':'변환','CREATE':'생성','VIEW':'보기','EDIT':'편집','SELECT':'선택','DRAW ACTIVE':'그리기 사용 중','PRIMITIVES':'기본 도형','Height':'높이','Ready':'준비됨','brushes':'브러시','entities':'엔티티','objects':'오브젝트','selected':'선택됨',
  'Toolbox':'도구 상자','Entity Browser':'엔티티 탐색기','Texture Browser':'텍스처 탐색기','Layers':'레이어','Search textures...':'텍스처 검색...','Search classname...':'classname 검색...','Click to create geometry. Drag it using the transform gizmo.':'클릭하여 도형을 만들고 기즈모로 이동하세요.','SOLID PRIMITIVES':'솔리드 도형','QUICK START':'빠른 시작','Player Spawn':'플레이어 시작점','Point Light':'점 광원','WORKFLOW':'작업 방식','Build with convex solids. Use `.wad` textures and `.fgd` entity definitions from your Sven Co-op installation.':'볼록 솔리드로 제작하세요. Sven Co-op의 WAD 및 FGD 파일을 사용하세요.','Import .FGD':'.FGD 가져오기','Imported FGD definitions active':'FGD 정의 활성화됨','Starter list. Import sven-coop.fgd for full list.':'기본 목록입니다. 전체 목록은 sven-coop.fgd를 가져오세요.','Import WAD3':'WAD3 가져오기','Choose textures, then paint selected faces or brushes.':'텍스처를 선택한 뒤 면 또는 브러시에 적용하세요.','All WAD files':'모든 WAD','No WAD textures loaded':'WAD 텍스처가 없습니다','Import halflife.wad or another WAD3 file from Sven Co-op.':'Sven Co-op의 WAD3 파일을 가져오세요.','Show favorites only':'즐겨찾기만','Toggle favorite':'즐겨찾기 전환',
  'Assign an object to a layer from its Properties panel.':'속성에서 오브젝트의 레이어를 지정하세요.','Show/hide layer':'레이어 표시/숨기기','Explorer':'탐색기','Filter objects...':'오브젝트 필터...','Workspace':'작업 공간','Geometry':'지오메트리','Entities':'엔티티','Toggle visibility':'표시 전환','Toggle lock':'잠금 전환','World Properties':'월드 속성','Map environment':'맵 환경','WORLD SETTINGS':'월드 설정','Select a brush or entity in the viewport to edit its properties.':'뷰포트에서 브러시나 엔티티를 선택해 속성을 편집하세요.','Multi-selection':'다중 선택','objects selected':'개 오브젝트 선택됨','Move group with the 3D gizmo':'3D 기즈모로 그룹 변환','Use Ctrl/Shift + click in Explorer or the viewport to change the selection. Group move is committed when releasing the gizmo; Rotate and Scale remain individual operations.':'Ctrl/Shift+클릭으로 여러 오브젝트를 선택하세요. 이동, 회전, 크기 조절이 그룹에 적용됩니다.','Duplicate all':'모두 복제','Delete all':'모두 삭제','Properties':'속성','Brush':'브러시','Entity':'엔티티','Name':'이름','Position':'위치','Rotation':'회전','Dimensions (units)':'크기 (단위)','ORGANIZATION':'구성','Layer':'레이어','ENTITY KEYVALUES':'엔티티 키값','BRUSH MATERIAL':'브러시 재질','Vertices':'정점','Editing Face':'편집 중인 면','Enable Face Mode and click a face to edit its texture coordinates.':'면 모드를 켜고 면을 클릭하여 텍스처 좌표를 편집하세요.','Duplicate':'복제',
  'Console':'콘솔','Build log':'컴파일 로그','Clear':'지우기','Hide':'숨기기','Show':'보기','Perspective':'원근','Textured':'텍스처','Face':'면','Object':'오브젝트','selection':'선택','Vertex':'정점','Edge':'모서리','Edit vertices':'정점 편집','Edit edges':'모서리 편집','Face selection mode':'면 선택 모드','Clip':'자르기','Hollow':'속 비우기','Clipping':'자르기','Geometry editing':'지오메트리 편집','Selected vertex':'선택한 정점','Selected edge':'선택한 모서리','Invalid geometry':'잘못된 지오메트리','Split along plane':'평면으로 분할','Clip positive':'양의 영역 유지','Clip negative':'음의 영역 유지','Hollow thickness':'벽 두께','Cut axis':'절단 축','Cut position':'절단 위치','Only closed convex brushes can be exported to Svengine. Invalid edits are rejected.':'닫힌 볼록 브러시만 Svengine으로 내보낼 수 있습니다. 잘못된 편집은 거부됩니다.','Svengine / Sven Co-op 5.x only':'Svengine / Sven Co-op 5.x 전용','Sven Co-op SDK required':'Sven Co-op SDK 필요',
};

Object.assign(es,{
  'Save settings':'Guardar ajustes','Implemented':'Implementado','Still to implement':'Pendiente','Close':'Cerrar','Output':'Salida','Building...':'Compilando...',
  'Start a new project? Save existing work first.':'¿Crear un proyecto nuevo? Guardá el trabajo actual primero.','Project display name':'Nombre visible del proyecto',
  'Snap to grid':'Ajustar a grilla','Grid visibility':'Mostrar cuadrícula','Grid size':'Tamaño de grilla','Toggle wireframe':'Alternar malla','Height of new blocks in Svengine units':'Altura de los bloques nuevos en unidades Svengine',
  'Move gizmo':'Gizmo de movimiento','Rotate gizmo':'Gizmo de rotación','Scale gizmo':'Gizmo de escala',
  'Fly / Walk navigation':'Navegación libre','Frame selection':'Enfocar selección','Frame all':'Enfocar todo','Front view':'Vista frontal','Right view':'Vista derecha','Top view':'Vista superior','Orthographic / Perspective':'Ortográfica / Perspectiva',
  'Global / World':'Global / Mundo','Local / Object':'Local / Objeto','Face Push/Pull (u)':'Empujar/tirar cara (u)','Texture':'Textura','Load Sven Co-op FGD':'Cargar FGD de Sven Co-op','Configure the game directory in Build Settings first.':'Primero configurá la carpeta del juego.',
  'Fly ON':'Vuelo activo','MMB orbit':'Botón central: orbitar','RMB orbit':'Botón derecho: orbitar',
  'Left drag · Draw box | Esc · Exit draw mode':'Arrastre izquierdo: dibujar bloque | Esc: salir','MMB · Orbit | Shift+MMB · Pan | Ctrl+MMB · Zoom':'Botón central: orbitar | Shift+central: desplazar | Ctrl+central: zoom',
  'RMB · Orbit | LMB · Pan | MMB · Zoom':'Botón derecho: orbitar | izquierdo: desplazar | central: zoom','Fly/Walk ON · WASD / Q,E · Esc exit':'Vuelo activo · WASD / Q,E · Esc: salir','Wheel · Zoom':'Rueda: zoom',
  'Svengine-only editor for Sven Co-op 5.x.':'Editor exclusivo de Svengine para Sven Co-op 5.x.',
  'Visual vertex/edge manipulation, convex face push/pull, axis clipping, hollow boxes, four UI languages, WAD3, FGD, Blender camera controls, projects and genuine Sven Co-op SDK compilation.':'Edición 3D de vértices y aristas, empujar/tirar caras convexas, corte por eje, bloques huecos, cuatro idiomas, WAD3, FGD, cámara Blender, proyectos y compilación real con el SDK de Sven Co-op.',
  'Complex CSG booleans, sculpted terrain, full prefab/visgroup tools, precise RAD lighting preview and advanced on-face UV handles.':'CSG booleano complejo, terreno esculpido, prefabs y visgroups completos, vista previa RAD precisa y controles UV directamente sobre las caras.',
  'Compiler logs remain in their original language. No proprietary Sven Co-op assets or SDK executables are distributed.':'Los registros del compilador conservan su idioma original. No se distribuyen recursos propietarios ni ejecutables del SDK de Sven Co-op.',
  'Press a key combination…':'Presioná una combinación…','Shortcut recording cancelled.':'Grabación del atajo cancelada.','Blender controls restored.':'Controles Blender restablecidos.',
});
Object.assign(ru,{
  'Save settings':'Сохранить настройки','Implemented':'Реализовано','Still to implement':'В планах','Close':'Закрыть','Output':'Вывод','Building...':'Компиляция...',
  'Start a new project? Save existing work first.':'Создать новый проект? Сначала сохраните изменения.','Project display name':'Название проекта',
  'Snap to grid':'Привязка к сетке','Grid visibility':'Отображение сетки','Grid size':'Шаг сетки','Toggle wireframe':'Каркасный режим','Height of new blocks in Svengine units':'Высота новых блоков в единицах Svengine',
  'Move gizmo':'Гизмо перемещения','Rotate gizmo':'Гизмо поворота','Scale gizmo':'Гизмо масштаба',
  'Fly / Walk navigation':'Режим полёта','Frame selection':'Показать выделенное','Frame all':'Показать всё','Front view':'Вид спереди','Right view':'Вид справа','Top view':'Вид сверху','Orthographic / Perspective':'Ортография / перспектива',
  'Global / World':'Глобально / Мир','Local / Object':'Локально / Объект','Face Push/Pull (u)':'Сдвиг грани (ед.)','Texture':'Текстура','Load Sven Co-op FGD':'Загрузить FGD Sven Co-op','Configure the game directory in Build Settings first.':'Сначала укажите папку игры в настройках сборки.',
  'Fly ON':'Полёт активен','MMB orbit':'СКМ: вращение','RMB orbit':'ПКМ: вращение',
  'Left drag · Draw box | Esc · Exit draw mode':'ЛКМ с перетаскиванием: блок | Esc: выход','MMB · Orbit | Shift+MMB · Pan | Ctrl+MMB · Zoom':'СКМ: вращение | Shift+СКМ: сдвиг | Ctrl+СКМ: масштаб',
  'RMB · Orbit | LMB · Pan | MMB · Zoom':'ПКМ: вращение | ЛКМ: сдвиг | СКМ: масштаб','Fly/Walk ON · WASD / Q,E · Esc exit':'Полёт · WASD / Q,E · Esc: выход','Wheel · Zoom':'Колесо: масштаб',
  'Svengine-only editor for Sven Co-op 5.x.':'Редактор только для Svengine и Sven Co-op 5.x.',
  'Visual vertex/edge manipulation, convex face push/pull, axis clipping, hollow boxes, four UI languages, WAD3, FGD, Blender camera controls, projects and genuine Sven Co-op SDK compilation.':'Правка вершин и рёбер, сдвиг граней выпуклых брашей, разрезание, полые блоки, четыре языка интерфейса, WAD3, FGD, камера Blender, проекты и настоящая компиляция SDK Sven Co-op.',
  'Complex CSG booleans, sculpted terrain, full prefab/visgroup tools, precise RAD lighting preview and advanced on-face UV handles.':'Сложные CSG-операции, редактирование рельефа, полные инструменты префабов и visgroup, точный просмотр RAD и интерактивные UV.',
  'Compiler logs remain in their original language. No proprietary Sven Co-op assets or SDK executables are distributed.':'Логи компиляторов остаются на исходном языке. Файлы SDK и проприетарные ресурсы Sven Co-op не распространяются.',
  'Press a key combination…':'Нажмите комбинацию клавиш…','Shortcut recording cancelled.':'Назначение отменено.','Blender controls restored.':'Настройки Blender восстановлены.',
});
Object.assign(ko,{
  'Save settings':'설정 저장','Implemented':'구현 완료','Still to implement':'추가 예정','Close':'닫기','Output':'출력','Building...':'컴파일 중...',
  'Start a new project? Save existing work first.':'새 프로젝트를 시작할까요? 기존 작업을 먼저 저장하세요.','Project display name':'프로젝트 표시 이름',
  'Snap to grid':'그리드에 맞추기','Grid visibility':'그리드 표시','Grid size':'그리드 크기','Toggle wireframe':'와이어프레임 전환','Height of new blocks in Svengine units':'새 블록 높이 (Svengine 단위)',
  'Move gizmo':'이동 기즈모','Rotate gizmo':'회전 기즈모','Scale gizmo':'크기 기즈모','Fly / Walk navigation':'비행 탐색','Frame selection':'선택 항목에 맞추기','Frame all':'전체 보기','Front view':'정면 보기','Right view':'오른쪽 보기','Top view':'위 보기','Orthographic / Perspective':'직교 / 원근',
  'Global / World':'월드 좌표','Local / Object':'로컬 좌표','Face Push/Pull (u)':'면 밀기/당기기 (단위)','Texture':'텍스처','Load Sven Co-op FGD':'Sven Co-op FGD 불러오기','Configure the game directory in Build Settings first.':'먼저 컴파일 설정에서 게임 폴더를 지정하세요.',
  'Fly ON':'비행 모드 사용 중','MMB orbit':'가운데 버튼: 회전','RMB orbit':'오른쪽 버튼: 회전',
  'Left drag · Draw box | Esc · Exit draw mode':'왼쪽 드래그: 블록 만들기 | Esc: 종료','MMB · Orbit | Shift+MMB · Pan | Ctrl+MMB · Zoom':'가운데: 회전 | Shift+가운데: 이동 | Ctrl+가운데: 확대',
  'RMB · Orbit | LMB · Pan | MMB · Zoom':'오른쪽: 회전 | 왼쪽: 이동 | 가운데: 확대','Fly/Walk ON · WASD / Q,E · Esc exit':'비행 · WASD / Q,E · Esc: 종료','Wheel · Zoom':'휠: 확대',
  'Svengine-only editor for Sven Co-op 5.x.':'Sven Co-op 5.x용 Svengine 전용 에디터입니다.',
  'Visual vertex/edge manipulation, convex face push/pull, axis clipping, hollow boxes, four UI languages, WAD3, FGD, Blender camera controls, projects and genuine Sven Co-op SDK compilation.':'정점·모서리 편집, 볼록 면 밀기/당기기, 축 기준 절단, 속이 빈 블록, 4개 언어, WAD3, FGD, Blender 카메라, 프로젝트 관리, Sven Co-op SDK 실제 컴파일.',
  'Complex CSG booleans, sculpted terrain, full prefab/visgroup tools, precise RAD lighting preview and advanced on-face UV handles.':'고급 CSG, 지형 조형, 프리팹/visgroup 기능 전체, 정확한 RAD 조명 미리보기, 면의 UV 핸들 기능.',
  'Compiler logs remain in their original language. No proprietary Sven Co-op assets or SDK executables are distributed.':'컴파일러 로그는 원문으로 표시됩니다. Sven Co-op의 독점 리소스나 SDK 실행 파일은 포함하지 않습니다.',
  'Press a key combination…':'키 조합을 누르세요…','Shortcut recording cancelled.':'단축키 설정을 취소했습니다.','Blender controls restored.':'Blender 조작 기본값을 복원했습니다.',
});

Object.assign(es,{
  'Show entity names':'Mostrar nombres de entidades','Labels':'Nombres','Entity category':'Categoría de entidades',
  'All categories':'Todas las categorías','NPCs':'NPC','Triggers':'Activadores','Weapons':'Armas',
  'Items':'Objetos','Lighting':'Iluminación','Brush entities':'Entidades brush','Logic & effects':'Lógica y efectos','Other':'Otros',
  'Drag into 3D viewport to place':'Arrastrá al visor 3D para colocar','Select a brush to tie this entity':'Seleccioná un brush para asociar esta entidad',
  'Connect to entity':'Conectar con entidad','No connection':'Sin conexión',
  'Mouse moves selected objects · X/Y/Z axis · numbers · Enter/click confirm · Esc/right click cancel · same key confirm':'El mouse mueve los objetos · X/Y/Z: eje · números · Enter/clic confirma · Esc/clic derecho cancela · misma tecla confirma'
});
Object.assign(ru,{
  'Show entity names':'Показывать имена сущностей','Labels':'Имена','Entity category':'Категория сущностей',
  'All categories':'Все категории','NPCs':'NPC','Triggers':'Триггеры','Weapons':'Оружие',
  'Items':'Предметы','Lighting':'Освещение','Brush entities':'Браш-сущности','Logic & effects':'Логика и эффекты','Other':'Прочие',
  'Drag into 3D viewport to place':'Перетащите в 3D-окно для размещения','Select a brush to tie this entity':'Выберите браш для привязки сущности',
  'Connect to entity':'Связать с сущностью','No connection':'Без связи',
  'Mouse moves selected objects · X/Y/Z axis · numbers · Enter/click confirm · Esc/right click cancel · same key confirm':'Мышь перемещает объект · X/Y/Z: оси · числа · Enter/щелчок: применить · Esc/ПКМ: отмена · повтор клавиши: применить'
});
Object.assign(ko,{
  'Show entity names':'엔티티 이름 표시','Labels':'이름','Entity category':'엔티티 분류',
  'All categories':'전체 분류','NPCs':'NPC','Triggers':'트리거','Weapons':'무기',
  'Items':'아이템','Lighting':'조명','Brush entities':'브러시 엔티티','Logic & effects':'로직 및 효과','Other':'기타',
  'Drag into 3D viewport to place':'3D 뷰에 끌어놓아 배치','Select a brush to tie this entity':'연결할 브러시를 먼저 선택',
  'Connect to entity':'엔티티 연결','No connection':'연결 없음',
  'Mouse moves selected objects · X/Y/Z axis · numbers · Enter/click confirm · Esc/right click cancel · same key confirm':'마우스로 이동 · X/Y/Z: 축 · 숫자 입력 · Enter/클릭: 확정 · Esc/오른쪽 클릭: 취소 · 같은 키: 확정'
});

Object.assign(es,{
  'Modal Blender G/R/C with mouse follow, X/Y/Z constraints, entity name labels, entity placement by drag, FGD inheritance/choices/spawnflags, target connection guides, four languages, convex geometry and real Sven Co-op SDK compilation.':'G/R/C estilo Blender, etiquetas 3D, colocación de entidades por arrastre, herencia y opciones FGD, conexiones target, cuatro idiomas y compilación real de Sven Co-op.',
  'Animated MDL previews, complete entity I/O graph, CSG booleans, sculpted terrain, full prefab/visgroup tools and precise RAD lighting preview.':'Quedan pendientes las vistas animadas MDL, el gráfico completo de conexiones, CSG booleano, terrenos, prefabs y la vista previa RAD.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C siguen al mouse; la misma tecla o clic confirma, Esc o clic derecho cancela. X/Y/Z restringen el eje global y los números fijan valores precisos.',
  'Blender Move (G)':'Mover con mouse (G)','Blender Rotate (R)':'Rotar con mouse (R)','Scale with mouse (C)':'Escalar con mouse (C)'
});
Object.assign(ru,{
  'Modal Blender G/R/C with mouse follow, X/Y/Z constraints, entity name labels, entity placement by drag, FGD inheritance/choices/spawnflags, target connection guides, four languages, convex geometry and real Sven Co-op SDK compilation.':'Перемещение, вращение и масштабирование мышью, имена сущностей в 3D, FGD, связи target, четыре языка и компиляция Sven Co-op.',
  'Animated MDL previews, complete entity I/O graph, CSG booleans, sculpted terrain, full prefab/visgroup tools and precise RAD lighting preview.':'Пока нет анимированного просмотра MDL, полного графа событий, CSG-операций, рельефа и точного предпросмотра RAD.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C управляются мышью: повтор клавиши или щелчок подтверждает; Esc/ПКМ отменяет. X/Y/Z ограничивают ось, числа задают значение.',
  'Blender Move (G)':'Перемещение мышью (G)','Blender Rotate (R)':'Поворот мышью (R)','Scale with mouse (C)':'Масштаб мышью (C)'
});
Object.assign(ko,{
  'Modal Blender G/R/C with mouse follow, X/Y/Z constraints, entity name labels, entity placement by drag, FGD inheritance/choices/spawnflags, target connection guides, four languages, convex geometry and real Sven Co-op SDK compilation.':'Blender식 G/R/C, 엔티티 이름 표시 및 끌어놓기, FGD 상속/옵션/플래그, 타깃 연결선, 4개 언어와 실제 Sven Co-op 컴파일 기능.',
  'Animated MDL previews, complete entity I/O graph, CSG booleans, sculpted terrain, full prefab/visgroup tools and precise RAD lighting preview.':'애니메이션 MDL 미리보기, 전체 엔티티 연결 그래프, CSG, 지형, 프리팹 및 RAD 조명 미리보기는 아직 구현되지 않았습니다.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C로 마우스 변형 시작, 같은 키 또는 클릭으로 확정, Esc/오른쪽 클릭으로 취소. X/Y/Z 축 제한 및 숫자 입력 지원.',
  'Blender Move (G)':'마우스로 이동 (G)','Blender Rotate (R)':'마우스로 회전 (R)','Scale with mouse (C)':'마우스로 크기 조절 (C)'
});

// Dockable workspace and visual customization introduced in v0.4.1.
Object.assign(es,{
  'Layout':'Diseño','Workspace layout':'Distribución del espacio de trabajo','Tools':'Herramientas','Dock':'Acoplar',
  'Left':'Izquierda','Right':'Derecha','Top':'Arriba','Bottom':'Abajo',
  'Dock here':'Acoplar aquí','Drop on a side to dock':'Soltá sobre un borde para acoplar',
  'Move panel to another side':'Mover panel a otro borde','Hide panel':'Ocultar panel',
  'Drag panel headers or choose a docking side. Resize the dividers. Changes are saved automatically.':'Arrastrá la cabecera de un panel o elegí un borde. Ajustá el tamaño con los separadores. La distribución se guarda automáticamente.',
  'Quick layouts':'Distribuciones rápidas','Creative':'Creativo','Classic':'Clásico','Focus':'Concentración',
  'Toolbar location':'Posición de la barra de herramientas','Panels':'Paneles','Interface size':'Tamaño de la interfaz',
  'Accent theme':'Tema de acento','Nebula':'Nébula','Ice':'Hielo','Ember':'Brasa','Reset layout':'Restablecer distribución'
});
Object.assign(ru,{
  'Layout':'Макет','Workspace layout':'Расположение панелей','Tools':'Инструменты','Dock':'Закрепить',
  'Left':'Слева','Right':'Справа','Top':'Сверху','Bottom':'Снизу',
  'Dock here':'Закрепить здесь','Drop on a side to dock':'Перетащите к краю для закрепления',
  'Move panel to another side':'Переместить панель','Hide panel':'Скрыть панель',
  'Drag panel headers or choose a docking side. Resize the dividers. Changes are saved automatically.':'Перетаскивайте заголовки панелей или выбирайте сторону. Изменяйте размер разделителями. Макет сохраняется автоматически.',
  'Quick layouts':'Готовые макеты','Creative':'Творческий','Classic':'Классический','Focus':'Фокус',
  'Toolbar location':'Положение панели инструментов','Panels':'Панели','Interface size':'Масштаб интерфейса',
  'Accent theme':'Цветовая тема','Nebula':'Туманность','Ice':'Лёд','Ember':'Уголь','Reset layout':'Сбросить расположение'
});
Object.assign(ko,{
  'Layout':'레이아웃','Workspace layout':'작업공간 배치','Tools':'도구','Dock':'도킹',
  'Left':'왼쪽','Right':'오른쪽','Top':'위쪽','Bottom':'아래쪽',
  'Dock here':'여기에 도킹','Drop on a side to dock':'가장자리에 놓아 도킹',
  'Move panel to another side':'패널 이동','Hide panel':'패널 숨기기',
  'Drag panel headers or choose a docking side. Resize the dividers. Changes are saved automatically.':'패널 제목을 끌거나 도킹 위치를 선택하세요. 구분선을 끌어 크기를 조절합니다. 배치는 자동 저장됩니다.',
  'Quick layouts':'빠른 배치','Creative':'크리에이티브','Classic':'클래식','Focus':'집중',
  'Toolbar location':'도구 모음 위치','Panels':'패널','Interface size':'인터페이스 크기',
  'Accent theme':'강조 색상','Nebula':'성운','Ice':'얼음','Ember':'불씨','Reset layout':'배치 초기화'
});


Object.assign(es,{'Place':'Colocar','Cancel':'Cancelar'});
Object.assign(ru,{'Place':'Разместить','Cancel':'Отмена'});
Object.assign(ko,{'Place':'배치','Cancel':'취소'});

// v0.4.3.3: labels and shape placement. Technical classname/targetname are never localized.
Object.assign(es,{"Entity visuals":"Apariencia de entidades","Label size":"Tamaño de etiquetas","Label opacity":"Opacidad de etiquetas","Marker size":"Tamaño de marcadores","Show classname":"Mostrar classname","Show targetname":"Mostrar targetname","Always show player spawn":"Mostrar siempre la aparición del jugador","Category colors":"Colores por categoría","Reset appearance":"Restablecer apariencia","color":"color","Click a surface to place":"Clic en una superficie para colocar","Select a primitive, then click any surface in the 3D viewport to place it. Esc cancels.":"Elegí una forma y hacé clic en una superficie del visor 3D para colocarla. Esc cancela.","Change entity markers and labels without affecting the compiled map.":"Personalizá los marcadores y etiquetas sin modificar el mapa compilado.","Classnames and FGD keys remain in English. These colors are editor-only.":"Los classname y las propiedades FGD siguen en inglés. Los colores solo afectan al editor.","Cone":"Cono","Pyramid":"Pirámide","Icosphere":"Esfera poligonal","Stairs":"Escaleras","Pipe":"Tubo","NPCs":"PNJ","Triggers":"Activadores","Items":"Objetos","Logic & effects":"Lógica y efectos","Other":"Otros"});
Object.assign(ru,{"Entity visuals":"Вид сущностей","Label size":"Размер подписей","Label opacity":"Прозрачность подписей","Marker size":"Размер маркеров","Show classname":"Показывать classname","Show targetname":"Показывать targetname","Always show player spawn":"Всегда показывать точку появления","Category colors":"Цвета категорий","Reset appearance":"Сбросить настройки вида","color":"цвет","Click a surface to place":"Нажмите на поверхность для размещения","Select a primitive, then click any surface in the 3D viewport to place it. Esc cancels.":"Выберите примитив и нажмите на поверхность в 3D-окне. Esc — отмена.","Change entity markers and labels without affecting the compiled map.":"Настройка маркеров и подписей без изменений скомпилированной карты.","Classnames and FGD keys remain in English. These colors are editor-only.":"Имена классов и ключи FGD остаются на английском. Цвета только для редактора.","Cone":"Конус","Pyramid":"Пирамида","Icosphere":"Многогранная сфера","Stairs":"Лестница","Pipe":"Труба","NPCs":"NPC","Triggers":"Триггеры","Items":"Предметы","Logic & effects":"Логика и эффекты","Other":"Другое"});
Object.assign(ko,{"Entity visuals":"엔티티 표시 설정","Label size":"라벨 크기","Label opacity":"라벨 투명도","Marker size":"마커 크기","Show classname":"classname 표시","Show targetname":"targetname 표시","Always show player spawn":"플레이어 시작점 항상 표시","Category colors":"범주별 색상","Reset appearance":"표시 설정 초기화","color":"색상","Click a surface to place":"표면을 클릭해 배치","Select a primitive, then click any surface in the 3D viewport to place it. Esc cancels.":"도형을 선택한 뒤 3D 화면의 표면을 클릭해 배치하세요. Esc로 취소합니다.","Change entity markers and labels without affecting the compiled map.":"컴파일된 맵에 영향을 주지 않고 마커와 라벨을 변경합니다.","Classnames and FGD keys remain in English. These colors are editor-only.":"클래스 이름과 FGD 키는 영어로 유지됩니다. 색상은 편집기에서만 표시됩니다.","Cone":"원뿔","Pyramid":"피라미드","Icosphere":"다면체 구","Stairs":"계단","Pipe":"파이프","NPCs":"NPC","Triggers":"트리거","Items":"아이템","Logic & effects":"논리 및 효과","Other":"기타"});

// v0.5 — editor-native context menu, model browser, orthographic quick tools.
Object.assign(es,{'Model Browser':'Biblioteca de modelos','Viewport tools':'Herramientas del visor','Hide':'Ocultar','Show':'Mostrar','Lock':'Bloquear','Unlock':'Desbloquear','Add Box':'Agregar bloque','Add Light':'Agregar luz','Ortho Transform':'Transformación ortográfica','Axis':'Eje','Select a point entity first to apply its model.':'Seleccioná una entidad puntual para aplicarle el modelo.','Configure the game directory in Build Settings first.':'Configurá primero la carpeta de Sven Co-op.'});
Object.assign(ru,{'Model Browser':'Библиотека моделей','Viewport tools':'Инструменты окна','Hide':'Скрыть','Show':'Показать','Lock':'Заблокировать','Unlock':'Разблокировать','Add Box':'Добавить блок','Add Light':'Добавить свет','Ortho Transform':'Ортографическая трансформация','Axis':'Ось','Select a point entity first to apply its model.':'Сначала выберите точечную сущность.'});
Object.assign(ko,{'Model Browser':'모델 브라우저','Viewport tools':'뷰포트 도구','Hide':'숨기기','Show':'표시','Lock':'잠금','Unlock':'잠금 해제','Add Box':'블록 추가','Add Light':'조명 추가','Ortho Transform':'직교 변환','Axis':'축','Select a point entity first to apply its model.':'먼저 점 엔티티를 선택하세요.'});

// v0.5.2 — advanced studio controls; GoldSrc identifiers are never translated.
Object.assign(es,{
 'Model settings':'Ajustes del modelo','Sequence':'Secuencia','Play':'Reproducir','Pause':'Pausar','Playback speed':'Velocidad de reproducción',
 'Animation frame':'Fotograma','Skin family':'Familia de skins','Bodygroups':'Grupos de partes',
 'Animation data not available for this sequence':'Animación no disponible para esta secuencia',
 'Apply model to selected entity':'Aplicar modelo a la entidad seleccionada',
 'Model preview only; skin and bodygroup choices do not modify the map. Advanced Svengine animation may differ in-game.':'Solo vista previa: cambiar skins o bodygroups aquí no modifica el mapa. Las animaciones avanzadas de Svengine pueden diferir en el juego.',
 'List view':'Vista de lista','Grid thumbnails':'Cuadrícula de miniaturas','Only favorites':'Solo favoritos','Rescan models':'Volver a escanear modelos','Favorite':'Favorito','Apply to selected entity':'Aplicar a la entidad',
 'Drag a model onto the viewport to place an item_generic entity. Thumbnails load on demand.':'Arrastrá un modelo al visor para crear una entidad item_generic. Las miniaturas se cargan cuando se necesitan.'
});
Object.assign(ru,{
 'Model settings':'Настройки модели','Sequence':'Анимация','Play':'Воспроизвести','Pause':'Пауза','Playback speed':'Скорость воспроизведения',
 'Animation frame':'Кадр анимации','Skin family':'Вариант текстур','Bodygroups':'Группы частей',
 'Animation data not available for this sequence':'Анимация для этой последовательности недоступна',
 'Apply model to selected entity':'Назначить модель выбранной сущности',
 'Model preview only; skin and bodygroup choices do not modify the map. Advanced Svengine animation may differ in-game.':'Только предпросмотр: варианты текстур и частей не изменяют карту. Анимация Svengine может отличаться в игре.',
 'List view':'Список','Grid thumbnails':'Сетка миниатюр','Only favorites':'Только избранные','Rescan models':'Пересканировать модели','Favorite':'В избранное','Apply to selected entity':'Назначить сущности',
 'Drag a model onto the viewport to place an item_generic entity. Thumbnails load on demand.':'Перетащите модель на сцену для создания item_generic. Миниатюры загружаются по требованию.'
});
Object.assign(ko,{
 'Model settings':'모델 설정','Sequence':'애니메이션 시퀀스','Play':'재생','Pause':'일시 정지','Playback speed':'재생 속도',
 'Animation frame':'애니메이션 프레임','Skin family':'스킨 종류','Bodygroups':'바디그룹',
 'Animation data not available for this sequence':'이 시퀀스의 애니메이션 데이터를 사용할 수 없습니다',
 'Apply model to selected entity':'선택한 엔티티에 모델 적용',
 'Model preview only; skin and bodygroup choices do not modify the map. Advanced Svengine animation may differ in-game.':'미리보기 전용: 스킨과 바디그룹 선택은 맵을 변경하지 않습니다. Svengine 고급 애니메이션은 게임에서 다르게 보일 수 있습니다.',
 'List view':'목록 보기','Grid thumbnails':'썸네일 그리드','Only favorites':'즐겨찾기만','Rescan models':'모델 다시 스캔','Favorite':'즐겨찾기','Apply to selected entity':'선택한 엔티티에 적용',
 'Drag a model onto the viewport to place an item_generic entity. Thumbnails load on demand.':'모델을 뷰포트로 끌어 item_generic 엔티티를 배치하세요. 썸네일은 필요할 때만 로드됩니다.'
});

const en:Record<string,string>={};
const zh:Record<string,string>={};
const pt:Record<string,string>={};
// v1.5.20: adaptive workspace presentation (not game entity/class identifiers).
Object.assign(es,{
  'Adaptive layout / Windows display scaling':'Diseño adaptable / escala de pantalla de Windows',
  'Automatically adjust docks and toolbars to available space':'Adaptar automáticamente los paneles y las barras al espacio disponible',
  'Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.':'Recomendado con Windows al 125 % o 150 %. Conserva tus medidas manuales de paneles y las recupera al haber más espacio. No modifica la geometría MAP ni el zoom del navegador.'
});
Object.assign(ru,{
  'Adaptive layout / Windows display scaling':'Адаптивный интерфейс / масштаб Windows',
  'Automatically adjust docks and toolbars to available space':'Автоматически подстраивать панели и инструменты под доступное место',
  'Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.':'Рекомендуется для масштаба Windows 125 % / 150 %. Размеры панелей сохраняются и восстанавливаются при увеличении пространства. MAP и масштаб браузера не изменяются.'
});
Object.assign(ko,{
  'Adaptive layout / Windows display scaling':'적응형 레이아웃 / Windows 화면 배율',
  'Automatically adjust docks and toolbars to available space':'사용 가능한 공간에 맞춰 패널과 도구 모음 자동 조정',
  'Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.':'Windows 125% / 150% 화면 배율에 권장됩니다. 수동 패널 크기를 보존하고 공간이 늘어나면 복원합니다. MAP 지오메트리와 브라우저 확대/축소는 변경하지 않습니다.'
});
Object.assign(zh,{
  'Adaptive layout / Windows display scaling':'自适应布局 / Windows 显示缩放',
  'Automatically adjust docks and toolbars to available space':'根据可用空间自动调整面板和工具栏',
  'Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.':'建议用于 Windows 125% / 150% 缩放。保留手动面板尺寸，并在空间增加时恢复。不修改 MAP 几何或浏览器缩放。'
});
Object.assign(pt,{
  'Adaptive layout / Windows display scaling':'Layout adaptável / escala do Windows',
  'Automatically adjust docks and toolbars to available space':'Ajustar painéis e barras automaticamente ao espaço disponível',
  'Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.':'Recomendado para escala de 125% ou 150% no Windows. Preserva os tamanhos manuais dos painéis e os restaura com mais espaço. Não altera a geometria MAP nem o zoom do navegador.'
});
const dictionaries:Record<Locale,Record<string,string>>={en,es,ru,ko,zh,pt};
export function translate(locale:Locale,key:string):string{return dictionaries[locale]?.[key]??key}
// Keep the translator stable while the language is unchanged. Effects depending
// on useT() must not fire after every local state update (e.g. model scans).
Object.assign(es,{'Show more models':'Mostrar más modelos','Preview unavailable':'Sin vista previa'});
Object.assign(ru,{'Show more models':'Показать больше моделей','Preview unavailable':'Превью недоступно'});
Object.assign(ko,{'Show more models':'모델 더 보기','Preview unavailable':'미리 보기 불가'});
// Gameplay Studio v0.6.0 (UI only; never translate Svengine classnames or keyvalues).
Object.assign(es,{
 'Gameplay Studio':'Estudio de jugabilidad','Open visual gameplay editor':'Abrir editor visual de jugabilidad',
 'Quick gameplay tools':'Herramientas de jugabilidad','Select a free brush in the 3D viewport, then convert it into a Svengine brush entity.':'Seleccioná un brush libre en el visor 3D para convertirlo en una entidad Svengine.',
 'Create sliding door':'Crear puerta deslizante','Create button':'Crear botón','Create relay':'Crear relay',
 'Add playable example':'Agregar ejemplo jugable','The example adds new brushes inside the room. It does not cut a doorway into an existing wall.':'El ejemplo agrega nuevos brushes dentro de la sala; no abre un hueco en una pared existente.',
 'Connecting nodes':'Conectar nodos','Click the output circle on a source node, then the input circle on its target. The link is saved as real target / targetname keyvalues.':'Hacé clic en la salida del nodo de origen y después en la entrada del destino. Se guardan keyvalues target / targetname reales.',
 'Cancel connection':'Cancelar conexión','Show all entities':'Mostrar todas las entidades','Visual Trigger Editor':'Editor visual de triggers','Choose a destination node…':'Elegí un nodo de destino…','Drag nodes by their headers':'Arrastrá los nodos desde su encabezado',
 'Gameplay Inspector':'Inspector de jugabilidad','Unnamed':'Sin nombre','No outgoing target':'Sin destino','Connect to this input':'Conectar a esta entrada','Connect this output':'Conectar esta salida',
 'Clear outgoing connection':'Borrar enlace saliente','All edits are saved in the map project and exported as Svengine keyvalues.':'Los cambios se guardan en el proyecto y se exportan como keyvalues de Svengine.',
 'Select a node to inspect its keyvalues.':'Seleccioná un nodo para inspeccionar sus propiedades.','Gameplay validation':'Validación de jugabilidad','No gameplay reference issues detected.':'No se encontraron problemas de referencias.',
 'Native Svengine connections — not a simulated scripting engine':'Conexiones nativas Svengine, sin scripts simulados','Export and compile normally with SC-CSG / BSP / VIS / RAD':'Exportá y compilá normalmente con SC-CSG / BSP / VIS / RAD',
 'Select an unassigned brush in the 3D viewport first.':'Primero seleccioná un brush sin entidad en el visor 3D.','Replace existing connection?':'¿Reemplazar la conexión existente?', 'Close':'Cerrar','connections':'conexiones'
});
Object.assign(ru,{
 'Gameplay Studio':'Редактор геймплея','Open visual gameplay editor':'Открыть визуальный редактор геймплея','Quick gameplay tools':'Инструменты геймплея',
 'Select a free brush in the 3D viewport, then convert it into a Svengine brush entity.':'Выберите свободный браш в 3D-окне и преобразуйте его в сущность Svengine.',
 'Create sliding door':'Создать раздвижную дверь','Create button':'Создать кнопку','Create relay':'Создать реле','Add playable example':'Добавить игровой пример',
 'The example adds new brushes inside the room. It does not cut a doorway into an existing wall.':'Пример добавляет браши внутри комнаты, но не прорезает проход.',
 'Connecting nodes':'Соединение узлов','Click the output circle on a source node, then the input circle on its target. The link is saved as real target / targetname keyvalues.':'Нажмите выход исходного узла, затем вход целевого. Связь сохраняется как target / targetname.',
 'Cancel connection':'Отменить соединение','Show all entities':'Показать все сущности','Visual Trigger Editor':'Визуальный редактор триггеров',
 'Choose a destination node…':'Выберите целевой узел…','Drag nodes by their headers':'Перетаскивайте узлы за заголовок','Gameplay Inspector':'Инспектор геймплея',
 'Unnamed':'Без имени','No outgoing target':'Нет цели','Connect to this input':'Подключить к входу','Connect this output':'Подключить выход',
 'Clear outgoing connection':'Удалить исходящую связь','All edits are saved in the map project and exported as Svengine keyvalues.':'Все изменения сохраняются в проекте как keyvalues Svengine.',
 'Select a node to inspect its keyvalues.':'Выберите узел для проверки свойств.','Gameplay validation':'Проверка геймплея',
 'No gameplay reference issues detected.':'Ошибок ссылок не найдено.','Native Svengine connections — not a simulated scripting engine':'Настоящие связи Svengine, не симуляция скриптов',
 'Export and compile normally with SC-CSG / BSP / VIS / RAD':'Экспорт и сборка через SC-CSG / BSP / VIS / RAD',
 'Select an unassigned brush in the 3D viewport first.':'Сначала выберите свободный браш в 3D-окне.','Replace existing connection?':'Заменить существующую связь?', 'Close':'Закрыть','connections':'связей'
});
Object.assign(ko,{
 'Gameplay Studio':'게임플레이 스튜디오','Open visual gameplay editor':'비주얼 게임플레이 편집기 열기','Quick gameplay tools':'게임플레이 도구',
 'Select a free brush in the 3D viewport, then convert it into a Svengine brush entity.':'3D 뷰포트에서 연결되지 않은 브러시를 선택한 뒤 Svengine 엔티티로 변환하세요.',
 'Create sliding door':'슬라이딩 도어 만들기','Create button':'버튼 만들기','Create relay':'릴레이 만들기','Add playable example':'플레이 가능한 예제 추가',
 'The example adds new brushes inside the room. It does not cut a doorway into an existing wall.':'예제는 방 안에 새 브러시를 추가하며 기존 벽에 출입구를 만들지는 않습니다.',
 'Connecting nodes':'노드 연결','Click the output circle on a source node, then the input circle on its target. The link is saved as real target / targetname keyvalues.':'시작 노드의 출력 점을 누르고 대상 노드의 입력 점을 누르세요. 실제 target / targetname 값으로 저장됩니다.',
 'Cancel connection':'연결 취소','Show all entities':'모든 엔티티 표시','Visual Trigger Editor':'비주얼 트리거 편집기',
 'Choose a destination node…':'대상 노드를 선택하세요…','Drag nodes by their headers':'제목 표시줄을 드래그하여 노드 이동','Gameplay Inspector':'게임플레이 속성',
 'Unnamed':'이름 없음','No outgoing target':'출력 대상 없음','Connect to this input':'이 입력에 연결','Connect this output':'이 출력 연결',
 'Clear outgoing connection':'출력 연결 지우기','All edits are saved in the map project and exported as Svengine keyvalues.':'변경 내용은 프로젝트에 저장되고 Svengine keyvalue로 내보내집니다.',
 'Select a node to inspect its keyvalues.':'노드를 선택하여 속성을 확인하세요.','Gameplay validation':'게임플레이 검증',
 'No gameplay reference issues detected.':'엔티티 참조 문제가 없습니다.','Native Svengine connections — not a simulated scripting engine':'시뮬레이션이 아닌 실제 Svengine 연결',
 'Export and compile normally with SC-CSG / BSP / VIS / RAD':'SC-CSG / BSP / VIS / RAD로 내보내고 컴파일',
 'Select an unassigned brush in the 3D viewport first.':'먼저 연결되지 않은 브러시를 3D 뷰포트에서 선택하세요.','Replace existing connection?':'기존 연결을 교체할까요?', 'Close':'닫기','connections':'연결'
});

Object.assign(es,{
  "NPC & AI Studio": "Estudio de NPC e IA",
  "NPC Browser": "Explorador de NPC",
  "NPC Library": "Biblioteca de NPC",
  "Search NPCs…": "Buscar NPC…",
  "NPC Preview": "Vista previa del NPC",
  "NPC Inspector": "Inspector de NPC",
  "NPC Waypoint Route": "Ruta de NPC",
  "NPC Route": "Ruta de NPC",
  "Place in 3D": "Colocar en 3D",
  "Place NPC": "Colocar NPC",
  "Create": "Crear",
  "Create squadmaker": "Crear squadmaker",
  "Add waypoint in 3D": "Agregar waypoint en 3D",
  "Monster count": "Cantidad de enemigos",
  "Delay between spawns": "Intervalo de aparición",
  "Max live children": "Máximo de enemigos vivos",
  "Start on": "Iniciar activado",
  "Squadmaker / Spawning": "Generador squadmaker",
  "NPC Validation": "Validación de NPC",
  "No NPC path or spawner errors detected.": "No se detectaron errores de rutas o generadores.",
  "No model specified in FGD": "Sin modelo definido en el FGD",
  "Loading model…": "Cargando modelo…",
  "Configure a game directory and load the FGD to preview NPCs.": "Configurá la carpeta del juego y cargá el FGD para previsualizar NPC.",
  "Select an NPC first.": "Primero seleccioná un NPC.",
  "Select an NPC or squadmaker first.": "Seleccioná primero un NPC o squadmaker.",
  "No path assigned": "Sin ruta asignada",
  "Loop detected. New waypoints must be inserted manually.": "Se detectó un circuito. Los nuevos waypoints deben insertarse manualmente.",
  "Select a placed NPC or squadmaker to create its route.": "Seleccioná un NPC o squadmaker colocado para crear su ruta.",
  "Select a monster_ entity to create a spawner.": "Seleccioná una entidad monster_ para crear un generador.",
  "Select an existing NPC in Explorer or on the map to edit it here.": "Seleccioná un NPC desde Explorer o el mapa para editarlo.",
  "Choose an NPC and click on a map surface to place it. Drag and drop also works.": "Elegí un NPC y hacé clic sobre una superficie. También podés arrastrarlo.",
  "Use NPC & AI Studio for routes, spawners and validation.": "Usá Estudio de NPC e IA para rutas, generadores y validación.",
  "Place in 3D lets you choose a surface with the mouse. NPC AI runs in Sven Co-op, not in this preview.": "Colocar en 3D permite elegir una superficie con el mouse. La IA funciona en Sven Co-op, no en la vista previa.",
  "Create near the current selection": "Crear cerca de la selección actual",
  "Real Svengine path_waypoint entities, linked by targetname/target and assigned via path_name.": "Entidades reales path_waypoint de Svengine enlazadas con targetname/target y asignadas mediante path_name.",
  "Creates a real squadmaker near the NPC. You can move it using G. Auto Size BBox is enabled.": "Crea un squadmaker real cerca del NPC. Podés moverlo con G. Auto Size BBox queda activado.",
  "Uses supported Sven Co-op keyvalues. No simulated AI.": "Usa keyvalues reales de Sven Co-op, sin IA simulada."
});
Object.assign(ru,{
  "NPC & AI Studio": "Студия NPC и ИИ",
  "NPC Browser": "Каталог NPC",
  "NPC Library": "Библиотека NPC",
  "Search NPCs…": "Поиск NPC…",
  "NPC Preview": "Предпросмотр NPC",
  "NPC Inspector": "Инспектор NPC",
  "NPC Waypoint Route": "Маршрут NPC",
  "NPC Route": "Маршрут NPC",
  "Place in 3D": "Разместить в 3D",
  "Place NPC": "Разместить NPC",
  "Create": "Создать",
  "Create squadmaker": "Создать squadmaker",
  "Add waypoint in 3D": "Добавить точку в 3D",
  "Monster count": "Число монстров",
  "Delay between spawns": "Интервал появления",
  "Max live children": "Макс. живых NPC",
  "Start on": "Включить при старте",
  "Squadmaker / Spawning": "Создание NPC / squadmaker",
  "NPC Validation": "Проверка NPC",
  "No NPC path or spawner errors detected.": "Ошибок маршрутов или генераторов нет.",
  "No model specified in FGD": "Модель не указана в FGD",
  "Loading model…": "Загрузка модели…",
  "Configure a game directory and load the FGD to preview NPCs.": "Укажите папку игры и загрузите FGD для просмотра NPC.",
  "Select an NPC first.": "Сначала выберите NPC.",
  "Select an NPC or squadmaker first.": "Выберите NPC или squadmaker.",
  "No path assigned": "Маршрут не назначен",
  "Loop detected. New waypoints must be inserted manually.": "Обнаружен цикл. Добавляйте точки вручную.",
  "Select a placed NPC or squadmaker to create its route.": "Выберите размещённого NPC или squadmaker для создания маршрута.",
  "Select a monster_ entity to create a spawner.": "Выберите monster_ для создания генератора.",
  "Select an existing NPC in Explorer or on the map to edit it here.": "Выберите NPC в сцене или Explorer для редактирования.",
  "Choose an NPC and click on a map surface to place it. Drag and drop also works.": "Выберите NPC и щёлкните по поверхности. Можно также перетаскивать.",
  "Use NPC & AI Studio for routes, spawners and validation.": "Используйте студию NPC для маршрутов и генераторов.",
  "Place in 3D lets you choose a surface with the mouse. NPC AI runs in Sven Co-op, not in this preview.": "Укажите поверхность мышью. ИИ NPC выполняется в Sven Co-op, а не в предпросмотре.",
  "Create near the current selection": "Создать рядом с выделением",
  "Real Svengine path_waypoint entities, linked by targetname/target and assigned via path_name.": "Реальные path_waypoint связаны через targetname/target и назначаются в path_name.",
  "Creates a real squadmaker near the NPC. You can move it using G. Auto Size BBox is enabled.": "Создаёт squadmaker рядом с NPC. Перемещение: G. Auto Size BBox включён.",
  "Uses supported Sven Co-op keyvalues. No simulated AI.": "Настоящие keyvalue Sven Co-op, без имитации ИИ."
});
Object.assign(ko,{
  "NPC & AI Studio": "NPC 및 AI 스튜디오",
  "NPC Browser": "NPC 탐색기",
  "NPC Library": "NPC 라이브러리",
  "Search NPCs…": "NPC 검색…",
  "NPC Preview": "NPC 미리보기",
  "NPC Inspector": "NPC 속성",
  "NPC Waypoint Route": "NPC 이동 경로",
  "NPC Route": "NPC 경로",
  "Place in 3D": "3D에 배치",
  "Place NPC": "NPC 배치",
  "Create": "생성",
  "Create squadmaker": "squadmaker 생성",
  "Add waypoint in 3D": "3D 웨이포인트 추가",
  "Monster count": "몬스터 수",
  "Delay between spawns": "생성 간격",
  "Max live children": "최대 생존 NPC",
  "Start on": "시작 시 활성화",
  "Squadmaker / Spawning": "NPC 생성 / squadmaker",
  "NPC Validation": "NPC 검사",
  "No NPC path or spawner errors detected.": "경로 및 생성기 오류가 없습니다.",
  "No model specified in FGD": "FGD에 모델 정보 없음",
  "Loading model…": "모델 로드 중…",
  "Configure a game directory and load the FGD to preview NPCs.": "NPC 미리보기를 위해 게임 경로를 설정하고 FGD를 로드하세요.",
  "Select an NPC first.": "먼저 NPC를 선택하세요.",
  "Select an NPC or squadmaker first.": "NPC 또는 squadmaker를 선택하세요.",
  "No path assigned": "경로 없음",
  "Loop detected. New waypoints must be inserted manually.": "순환 경로입니다. 웨이포인트를 직접 추가하세요.",
  "Select a placed NPC or squadmaker to create its route.": "배치된 NPC 또는 squadmaker를 선택하여 경로를 만드세요.",
  "Select a monster_ entity to create a spawner.": "생성기를 만들려면 monster_ 엔티티를 선택하세요.",
  "Select an existing NPC in Explorer or on the map to edit it here.": "Explorer 또는 지도에서 NPC를 선택하여 편집하세요.",
  "Choose an NPC and click on a map surface to place it. Drag and drop also works.": "NPC를 선택하고 표면을 클릭하여 배치하세요. 드래그도 가능합니다.",
  "Use NPC & AI Studio for routes, spawners and validation.": "NPC 및 AI 스튜디오에서 경로와 생성기를 설정하세요.",
  "Place in 3D lets you choose a surface with the mouse. NPC AI runs in Sven Co-op, not in this preview.": "3D 배치 시 마우스로 표면을 선택합니다. NPC AI는 미리보기가 아닌 Sven Co-op에서 실행됩니다.",
  "Create near the current selection": "선택 항목 근처에 생성",
  "Real Svengine path_waypoint entities, linked by targetname/target and assigned via path_name.": "실제 Svengine path_waypoint를 targetname/target으로 연결하고 path_name으로 지정합니다.",
  "Creates a real squadmaker near the NPC. You can move it using G. Auto Size BBox is enabled.": "NPC 근처에 실제 squadmaker를 만듭니다. G로 이동할 수 있으며 Auto Size BBox가 활성화됩니다.",
  "Uses supported Sven Co-op keyvalues. No simulated AI.": "Sven Co-op의 실제 keyvalue 사용. AI 시뮬레이션 없음."
});

// v0.6.2 audio workspace translations; Svengine classnames and keyvalues remain literal.
Object.assign(es,{
  "Sound & Atmosphere Studio":"Estudio de sonido y ambiente",
  "Audio Studio":"Audio Studio",
  "Sound Browser":"Biblioteca de sonidos",
  "Svengine Sound Library":"Biblioteca de sonidos Svengine",
  "Search sound files…":"Buscar archivos de sonido…",
  "Rescan sound folders":"Volver a escanear sonidos",
  "Scanning…":"Escaneando…",
  "sound files":"archivos de sonido",
  "Favorites only":"Solo favoritos",
  "No matching sounds found.":"No se encontraron sonidos.",
  "Choose a sound to preview.":"Elegí un sonido para escucharlo.",
  "Browser cannot decode this format. Sven Co-op may still support it.":"El navegador no puede reproducir este formato. Sven Co-op podría admitirlo.",
  "Analyze waveform to view actual audio levels.":"Analizá la forma de onda para ver niveles reales.",
  "Analyze waveform":"Analizar forma de onda",
  "Waveform unavailable for this format or file size.":"La forma de onda no está disponible para este formato o tamaño.",
  "Preview & Sound Properties":"Vista previa y propiedades de sonido",
  "3D Sound":"Sonido 3D",
  "Music":"Música",
  "Reverb":"Reverberación",
  "Svengine Keyvalues":"Propiedades de Svengine",
  "Volume":"Volumen",
  "Loop":"Repetir en bucle",
  "Start silent (triggered)":"Iniciar en silencio (por trigger)",
  "Approximate sound range":"Alcance aproximado del sonido",
  "small":"Pequeño",
  "medium":"Mediano",
  "large":"Grande",
  "everywhere":"En todas partes",
  "Reverb radius":"Radio de reverberación",
  "Room type":"Tipo de ambiente",
  "Create near selection":"Crear cerca de la selección",
  "Choose a sound first.":"Elegí un sonido primero.",
  "Audio entity created.":"Entidad de audio creada.",
  "Sound assigned to selected entity.":"Sonido asignado a la entidad.",
  "Sound paths are relative to the game sound folder. Browser preview may not support every Svengine audio format.":"Las rutas son relativas a la carpeta sound del juego. El navegador puede no reproducir todos los formatos de Svengine.",
  "Audio Entities":"Entidades de audio",
  "Selected entity":"Entidad seleccionada",
  "Sound File (message)":"Archivo de sonido (message)",
  "Assign selected sound":"Asignar sonido seleccionado",
  "Targetname":"Targetname",
  "Spawnflags":"Spawnflags",
  "Other entity keyvalues remain editable in Properties and Gameplay Studio.":"Los otros keyvalues pueden editarse en Properties y Gameplay Studio.",
  "Select an audio entity in the scene to edit its keyvalues.":"Seleccioná una entidad de audio para editar sus propiedades.",
  "Audio Validation":"Validación de audio",
  "No audio entity errors found.":"No se detectaron errores de audio.",
  "Preview uses browser audio; final playback and reverb use Svengine.":"La vista previa usa audio del navegador; el juego utiliza Svengine.",
  "Ready":"Listo",
  "Place sound in 3D":"Colocar sonido en 3D"
});
Object.assign(ru,{
  "Sound & Atmosphere Studio":"Студия звука и окружения",
  "Audio Studio":"Аудиостудия",
  "Sound Browser":"Библиотека звуков",
  "Svengine Sound Library":"Библиотека звуков Svengine",
  "Search sound files…":"Поиск звуковых файлов…",
  "Rescan sound folders":"Пересканировать звуки",
  "Scanning…":"Сканирование…",
  "sound files":"звуковых файлов",
  "Favorites only":"Только избранное",
  "No matching sounds found.":"Звуки не найдены.",
  "Choose a sound to preview.":"Выберите звук для прослушивания.",
  "Browser cannot decode this format. Sven Co-op may still support it.":"Браузер не поддерживает этот формат. Sven Co-op может его воспроизводить.",
  "Analyze waveform to view actual audio levels.":"Анализируйте волну, чтобы увидеть реальные уровни.",
  "Analyze waveform":"Анализировать волну",
  "Waveform unavailable for this format or file size.":"Волна недоступна для данного формата или размера.",
  "Preview & Sound Properties":"Просмотр и параметры звука",
  "3D Sound":"3D-звук",
  "Music":"Музыка",
  "Reverb":"Реверберация",
  "Svengine Keyvalues":"Параметры Svengine",
  "Volume":"Громкость",
  "Loop":"Повторять",
  "Start silent (triggered)":"Запуск по триггеру",
  "Approximate sound range":"Примерная дальность звука",
  "small":"Малый",
  "medium":"Средний",
  "large":"Большой",
  "everywhere":"Везде",
  "Reverb radius":"Радиус реверберации",
  "Room type":"Тип помещения",
  "Create near selection":"Создать рядом с выделением",
  "Choose a sound first.":"Сначала выберите звук.",
  "Audio entity created.":"Аудиосущность создана.",
  "Sound assigned to selected entity.":"Звук назначен сущности.",
  "Sound paths are relative to the game sound folder. Browser preview may not support every Svengine audio format.":"Пути считаются от папки sound игры. Браузер может не поддерживать все форматы Svengine.",
  "Audio Entities":"Аудиосущности",
  "Selected entity":"Выбранная сущность",
  "Sound File (message)":"Звуковой файл (message)",
  "Assign selected sound":"Назначить выбранный звук",
  "Targetname":"Targetname",
  "Spawnflags":"Spawnflags",
  "Other entity keyvalues remain editable in Properties and Gameplay Studio.":"Остальные параметры доступны в Properties и Gameplay Studio.",
  "Select an audio entity in the scene to edit its keyvalues.":"Выберите аудиосущность на сцене для настройки.",
  "Audio Validation":"Проверка аудио",
  "No audio entity errors found.":"Ошибок аудио не найдено.",
  "Preview uses browser audio; final playback and reverb use Svengine.":"Предпрослушивание — в браузере, воспроизведение в игре — через Svengine.",
  "Ready":"Готово",
  "Place sound in 3D":"Разместить звук в 3D"
});
Object.assign(ko,{
  "Sound & Atmosphere Studio":"사운드 및 환경 스튜디오",
  "Audio Studio":"오디오 스튜디오",
  "Sound Browser":"사운드 브라우저",
  "Svengine Sound Library":"Svengine 사운드 라이브러리",
  "Search sound files…":"사운드 파일 검색…",
  "Rescan sound folders":"사운드 폴더 다시 검색",
  "Scanning…":"검색 중…",
  "sound files":"개의 사운드 파일",
  "Favorites only":"즐겨찾기만",
  "No matching sounds found.":"일치하는 사운드가 없습니다.",
  "Choose a sound to preview.":"미리 들을 사운드를 선택하세요.",
  "Browser cannot decode this format. Sven Co-op may still support it.":"브라우저가 이 형식을 재생할 수 없습니다. Sven Co-op에서는 지원할 수 있습니다.",
  "Analyze waveform to view actual audio levels.":"실제 오디오 레벨을 보려면 파형을 분석하세요.",
  "Analyze waveform":"파형 분석",
  "Waveform unavailable for this format or file size.":"이 형식이나 파일 크기에서는 파형을 사용할 수 없습니다.",
  "Preview & Sound Properties":"미리보기 및 사운드 속성",
  "3D Sound":"3D 사운드",
  "Music":"음악",
  "Reverb":"잔향",
  "Svengine Keyvalues":"Svengine 키값",
  "Volume":"볼륨",
  "Loop":"반복",
  "Start silent (triggered)":"트리거 시 시작",
  "Approximate sound range":"대략적인 사운드 범위",
  "small":"작음",
  "medium":"중간",
  "large":"큼",
  "everywhere":"전체",
  "Reverb radius":"잔향 반경",
  "Room type":"공간 유형",
  "Create near selection":"선택한 오브젝트 근처에 생성",
  "Choose a sound first.":"먼저 사운드를 선택하세요.",
  "Audio entity created.":"오디오 엔티티를 만들었습니다.",
  "Sound assigned to selected entity.":"선택한 엔티티에 사운드를 지정했습니다.",
  "Sound paths are relative to the game sound folder. Browser preview may not support every Svengine audio format.":"경로는 게임 sound 폴더를 기준으로 합니다. 브라우저에서는 일부 Svengine 형식을 재생할 수 없습니다.",
  "Audio Entities":"오디오 엔티티",
  "Selected entity":"선택한 엔티티",
  "Sound File (message)":"사운드 파일 (message)",
  "Assign selected sound":"선택한 사운드 지정",
  "Targetname":"Targetname",
  "Spawnflags":"Spawnflags",
  "Other entity keyvalues remain editable in Properties and Gameplay Studio.":"다른 키값은 Properties 및 Gameplay Studio에서 편집할 수 있습니다.",
  "Select an audio entity in the scene to edit its keyvalues.":"키값을 편집하려면 장면에서 오디오 엔티티를 선택하세요.",
  "Audio Validation":"오디오 검사",
  "No audio entity errors found.":"오디오 엔티티 오류가 없습니다.",
  "Preview uses browser audio; final playback and reverb use Svengine.":"미리듣기는 브라우저를, 실제 재생은 Svengine을 사용합니다.",
  "Ready":"준비",
  "Place sound in 3D":"3D에 사운드 배치"
});
// Workspace and WAV converter — all four interface languages; engine identifiers stay unchanged.
Object.assign(es,{
  'Studios':'Estudios','Scene':'Escena','AI Routes':'Rutas de IA','Routes':'Rutas','Route users':'NPC que usan la ruta','Owner':'Propietario','Shared route':'Ruta compartida',
  'Unassigned':'Sin asignar','Unassigned waypoints':'Waypoints sin asignar','No NPC route references this waypoint':'Ningún NPC usa este waypoint','Broken route connection':'Conexión rota','Looped route':'Ruta circular','Isolate route in 3D':'Aislar ruta en 3D','Isolated AI route':'Ruta de IA aislada','Add waypoint to route':'Agregar waypoint a la ruta','Show all':'Mostrar todo',
  'NPCs':'NPC','NPC Spawners':'Generadores de NPC','Audio':'Audio','Lighting':'Iluminación','Triggers & Logic':'Triggers y lógica','Doors & Brush Entities':'Puertas y brushes especiales','Items & Weapons':'Objetos y armas','Other Entities':'Otras entidades',
  'Floating tools':'Herramientas flotantes','Classic ribbon':'Barra clásica','Toolbar style':'Estilo de herramientas','Asset Library':'Biblioteca de recursos','Shapes':'Formas','Assets':'Recursos','Panels':'Paneles','Switch side':'Cambiar de lado','Select':'Seleccionar',
  'Include WAV loop cue point for looping sound effects':'Incluir punto de repetición WAV para efectos en bucle','Audio Converter':'Convertidor de audio','Convert audio':'Convertir audio','Convert audio inside Sven Studio · no external application required':'Convertí audio en Sven Studio, sin programas externos','Select an audio file':'Seleccionar archivo de audio','as supported by your browser':'si tu navegador lo permite','Output preset':'Formato de salida','Sound effect':'Efecto de sonido','NPC voice / lip-sync':'Voz de NPC / sincronización labial','Ambient HD':'Ambiente HD','Music / stereo':'Música / estéreo','Output filename':'Nombre del archivo','Convert to WAV':'Convertir a WAV','Converting...':'Convirtiendo…','Download WAV':'Descargar WAV','Install in Sven Co-op':'Instalar en Sven Co-op','Installed in Sven Co-op':'Instalado en Sven Co-op','Converted successfully':'Conversión completada',
  'The browser must be able to decode the source format. For best compatibility, use mono PCM WAV for effects and NPC voices. For long music tracks, Svengine also supports OGG/MP3 directly.':'El navegador debe poder decodificar el archivo. Para efectos y voces usá WAV PCM mono. Para música larga, Svengine también permite OGG/MP3 directamente.',
  'Install saves to svencoop_addon/sound/svenstudio_imports/ without overwriting files. New sounds appear in Sound Browser after Refresh. Converted files can be used by ambient_generic or ambient_music.':'Se guarda en svencoop_addon/sound/svenstudio_imports/ sin sobrescribir archivos. Actualizá la biblioteca para verlo. El archivo sirve para ambient_generic o ambient_music.'
});
Object.assign(ru,{
  'Studios':'Студии','Scene':'Сцена','AI Routes':'Маршруты ИИ','Routes':'Маршруты','Route users':'Использующие маршрут','Owner':'Владелец','Shared route':'Общий маршрут','Unassigned':'Без назначения','Unassigned waypoints':'Свободные точки','No NPC route references this waypoint':'NPC не используют эту точку','Broken route connection':'Разрыв маршрута','Looped route':'Замкнутый маршрут','Isolate route in 3D':'Изолировать маршрут','Isolated AI route':'Изолированный маршрут ИИ','Add waypoint to route':'Добавить точку маршрута','Show all':'Показать всё',
  'NPCs':'NPC','NPC Spawners':'Генераторы NPC','Audio':'Аудио','Lighting':'Освещение','Triggers & Logic':'Триггеры и логика','Doors & Brush Entities':'Двери и браш-сущности','Items & Weapons':'Предметы и оружие','Other Entities':'Другие сущности',
  'Floating tools':'Плавающие инструменты','Classic ribbon':'Классическая панель','Toolbar style':'Стиль панели','Asset Library':'Библиотека ресурсов','Shapes':'Фигуры','Assets':'Ресурсы','Panels':'Панели','Switch side':'Сменить сторону','Select':'Выбрать',
  'Include WAV loop cue point for looping sound effects':'Добавить точку повтора WAV для циклических эффектов','Audio Converter':'Аудиоконвертер','Convert audio':'Конвертировать аудио','Convert audio inside Sven Studio · no external application required':'Конвертация прямо в Sven Studio без других программ','Select an audio file':'Выбрать аудиофайл','as supported by your browser':'если поддерживается браузером','Output preset':'Профиль вывода','Sound effect':'Звуковой эффект','NPC voice / lip-sync':'Голос NPC','Ambient HD':'Атмосфера HD','Music / stereo':'Музыка / стерео','Output filename':'Имя файла','Convert to WAV':'Конвертировать в WAV','Converting...':'Конвертация…','Download WAV':'Скачать WAV','Install in Sven Co-op':'Установить в Sven Co-op','Installed in Sven Co-op':'Установлено в Sven Co-op','Converted successfully':'Конвертация завершена',
  'The browser must be able to decode the source format. For best compatibility, use mono PCM WAV for effects and NPC voices. For long music tracks, Svengine also supports OGG/MP3 directly.':'Браузер должен поддерживать исходный формат. Для эффектов и речи рекомендуется моно PCM WAV. Для музыки Svengine поддерживает OGG/MP3.',
  'Install saves to svencoop_addon/sound/svenstudio_imports/ without overwriting files. New sounds appear in Sound Browser after Refresh. Converted files can be used by ambient_generic or ambient_music.':'Сохранение в svencoop_addon/sound/svenstudio_imports/ без перезаписи. Обновите библиотеку звуков.'
});
Object.assign(ko,{
  'Studios':'스튜디오','Scene':'장면','AI Routes':'AI 경로','Routes':'경로','Route users':'경로 사용 NPC','Owner':'소유자','Shared route':'공유 경로','Unassigned':'미지정','Unassigned waypoints':'미지정 경유지','No NPC route references this waypoint':'이 경유지를 사용하는 NPC가 없습니다','Broken route connection':'연결 끊김','Looped route':'순환 경로','Isolate route in 3D':'3D 경로만 보기','Isolated AI route':'분리된 AI 경로','Add waypoint to route':'경로에 경유지 추가','Show all':'전체 표시',
  'NPCs':'NPC','NPC Spawners':'NPC 생성기','Audio':'오디오','Lighting':'조명','Triggers & Logic':'트리거 및 로직','Doors & Brush Entities':'문 및 브러시 엔티티','Items & Weapons':'아이템 및 무기','Other Entities':'기타 엔티티',
  'Floating tools':'플로팅 도구','Classic ribbon':'클래식 도구막대','Toolbar style':'도구막대 스타일','Asset Library':'리소스 라이브러리','Shapes':'도형','Assets':'리소스','Panels':'패널','Switch side':'측면 변경','Select':'선택',
  'Include WAV loop cue point for looping sound effects':'반복 효과음을 위한 WAV 루프 큐 포인트 포함','Audio Converter':'오디오 변환기','Convert audio':'오디오 변환','Convert audio inside Sven Studio · no external application required':'다른 프로그램 없이 Sven Studio에서 오디오 변환','Select an audio file':'오디오 파일 선택','as supported by your browser':'브라우저에서 지원하는 경우','Output preset':'출력 설정','Sound effect':'효과음','NPC voice / lip-sync':'NPC 음성','Ambient HD':'고음질 환경음','Music / stereo':'음악 / 스테레오','Output filename':'출력 파일명','Convert to WAV':'WAV로 변환','Converting...':'변환 중…','Download WAV':'WAV 다운로드','Install in Sven Co-op':'Sven Co-op에 설치','Installed in Sven Co-op':'Sven Co-op에 설치됨','Converted successfully':'변환 완료',
  'The browser must be able to decode the source format. For best compatibility, use mono PCM WAV for effects and NPC voices. For long music tracks, Svengine also supports OGG/MP3 directly.':'브라우저가 원본 형식을 디코딩할 수 있어야 합니다. 효과음과 NPC 음성에는 모노 PCM WAV를 사용하세요. 음악에는 OGG/MP3도 지원됩니다.',
  'Install saves to svencoop_addon/sound/svenstudio_imports/ without overwriting files. New sounds appear in Sound Browser after Refresh. Converted files can be used by ambient_generic or ambient_music.':'기존 파일을 덮어쓰지 않고 svencoop_addon/sound/svenstudio_imports/에 저장합니다. 라이브러리를 새로고침하세요.'
});
// v0.6.4 Lighting Studio UI; engine classnames and keyvalues are intentionally never localized.
Object.assign(es,{
 'Lighting & Environment Studio':'Estudio de iluminación y entorno','Create environment entity':'Crear entidad ambiental','Lighting presets':'Presets de iluminación','Viewport preview':'Vista previa del visor','Approximate lighting':'Iluminación aproximada','Fog preview':'Vista previa de niebla','Environment properties':'Propiedades ambientales','Point Light':'Luz puntual','Spotlight':'Foco de luz','Sun / Sky Light':'Luz de sol / cielo','Fog':'Niebla','Change Sky Trigger':'Activador de cambio de cielo','Daylight':'Día','Sunset':'Atardecer','Moonlight':'Noche lunar','Light color':'Color de luz','Brightness':'Brillo','Inner angle':'Ángulo interior','Outer angle':'Ángulo exterior','Fog color':'Color de niebla','Fog start distance':'Distancia inicial de niebla','Fog end distance':'Distancia final de niebla','Sky texture prefix':'Nombre del cielo','Apply to selected':'Aplicar al seleccionado','World sky':'Cielo del mapa','Save skyname':'Guardar cielo','Scene environment':'Entorno de la escena','Environment validation':'Validación ambiental','No environment entities yet.':'No hay entidades ambientales.','No invalid light or fog keyvalues found.':'Sin errores en luces o niebla.','Lighting Preview':'Vista de iluminación','Approximate lighting preview':'Vista previa aproximada de iluminación','Select an environment entity first.':'Seleccioná primero una entidad ambiental.','Select the matching entity type to edit.':'Seleccioná una entidad del mismo tipo para editarla.','Native Svengine keyvalues updated.':'Propiedades de Svengine actualizadas.','Preset selected. Create a sun light to apply it. Sky textures are not generated automatically.':'Preset seleccionado. Creá una luz de sol para aplicarlo. Las texturas del cielo no se generan automáticamente.','Sky prefix saved. SKY-textured faces are required in the game.':'Nombre de cielo guardado. En el juego necesitás superficies con textura SKY.','Use a valid sky prefix (letters, numbers, dash, underscore).':'Usá un nombre válido para el cielo.','Sky lighting needs SKY-textured brushes to affect the compiled map.':'La luz ambiental necesita brushes con textura SKY en el mapa compilado.','Viewport preview is not SC-RAD lightmaps; compile for final light and shadows.':'La vista previa no es la iluminación real de SC-RAD; compilá para ver luces y sombras definitivas.','Light color and brightness are exported through _light.':'El color y brillo se exportan mediante _light.','Fog is displayed in-game only for players with fog enabled. Dynamic preview is approximate.':'La niebla aparece en el juego solo si el jugador la tiene activada. La vista previa es aproximada.','Use Gameplay Studio to trigger this entity. A static sky is set on worldspawn.':'Usá Gameplay Studio para activar esta entidad. El cielo inicial está en worldspawn.','Enter a sky prefix installed under gfx/env; six sky faces are required.':'Indicá el nombre de un cielo instalado en gfx/env; necesita seis imágenes.','Visual previews are editor-only and do not modify BSP lightmaps.':'La vista previa es solo del editor y no modifica los lightmaps BSP.','Compiled lighting is calculated by SC-RAD; sky and fog effects depend on the game settings.':'SC-RAD calcula la iluminación final; los efectos de cielo y niebla dependen de la configuración del juego.','created':'creada'});
Object.assign(ru,{
 'Lighting & Environment Studio':'Студия освещения и окружения','Create environment entity':'Создать сущность окружения','Lighting presets':'Пресеты освещения','Viewport preview':'Предпросмотр','Approximate lighting':'Приблизительное освещение','Fog preview':'Предпросмотр тумана','Environment properties':'Параметры окружения','Point Light':'Точечный свет','Spotlight':'Прожектор','Sun / Sky Light':'Солнце и свет неба','Fog':'Туман','Change Sky Trigger':'Триггер смены неба','Daylight':'День','Sunset':'Закат','Moonlight':'Лунная ночь','Light color':'Цвет света','Brightness':'Яркость','Inner angle':'Внутренний угол','Outer angle':'Внешний угол','Fog color':'Цвет тумана','Fog start distance':'Начало тумана','Fog end distance':'Конец тумана','Sky texture prefix':'Название неба','Apply to selected':'Применить к выбранному','World sky':'Небо карты','Save skyname':'Сохранить небо','Scene environment':'Окружение сцены','Environment validation':'Проверка окружения','No environment entities yet.':'Сущностей окружения пока нет.','No invalid light or fog keyvalues found.':'Ошибок света или тумана нет.','Lighting Preview':'Предпросмотр света','Approximate lighting preview':'Приблизительный свет','Native Svengine keyvalues updated.':'Параметры Svengine обновлены.','Viewport preview is not SC-RAD lightmaps; compile for final light and shadows.':'Предпросмотр не равен SC-RAD. Для окончательного освещения соберите карту.','Sky lighting needs SKY-textured brushes to affect the compiled map.':'Для света неба нужны поверхности с текстурой SKY.','Fog is displayed in-game only for players with fog enabled. Dynamic preview is approximate.':'Туман виден игрокам с включённым туманом. Предпросмотр приблизителен.','Visual previews are editor-only and do not modify BSP lightmaps.':'Предпросмотр не изменяет карты освещения BSP.','Compiled lighting is calculated by SC-RAD; sky and fog effects depend on the game settings.':'SC-RAD рассчитывает освещение; небо и туман зависят от настроек игры.'});
Object.assign(ko,{
 'Lighting & Environment Studio':'조명 및 환경 스튜디오','Create environment entity':'환경 엔티티 만들기','Lighting presets':'조명 프리셋','Viewport preview':'뷰포트 미리보기','Approximate lighting':'간이 조명','Fog preview':'안개 미리보기','Environment properties':'환경 속성','Point Light':'점광원','Spotlight':'스포트라이트','Sun / Sky Light':'태양 및 하늘 조명','Fog':'안개','Change Sky Trigger':'하늘 변경 트리거','Daylight':'낮','Sunset':'노을','Moonlight':'달빛','Light color':'빛 색상','Brightness':'밝기','Inner angle':'내부 각도','Outer angle':'외부 각도','Fog color':'안개 색상','Fog start distance':'안개 시작 거리','Fog end distance':'안개 종료 거리','Sky texture prefix':'하늘 이름','Apply to selected':'선택 항목에 적용','World sky':'맵 하늘','Save skyname':'하늘 저장','Scene environment':'장면 환경','Environment validation':'환경 유효성 검사','No environment entities yet.':'환경 엔티티가 없습니다.','No invalid light or fog keyvalues found.':'조명 및 안개 값에 오류가 없습니다.','Lighting Preview':'조명 미리보기','Approximate lighting preview':'간이 조명 미리보기','Native Svengine keyvalues updated.':'Svengine 값이 업데이트되었습니다.','Viewport preview is not SC-RAD lightmaps; compile for final light and shadows.':'이 미리보기는 SC-RAD 라이트맵과 다릅니다. 실제 조명은 컴파일 후 확인하세요.','Sky lighting needs SKY-textured brushes to affect the compiled map.':'하늘 조명은 SKY 텍스처가 있는 브러시가 필요합니다.','Fog is displayed in-game only for players with fog enabled. Dynamic preview is approximate.':'게임의 안개 옵션이 켜진 플레이어에게만 안개가 표시됩니다.','Visual previews are editor-only and do not modify BSP lightmaps.':'미리보기는 BSP 라이트맵을 수정하지 않습니다.','Compiled lighting is calculated by SC-RAD; sky and fog effects depend on the game settings.':'최종 조명은 SC-RAD에서 계산하며 하늘과 안개는 게임 설정의 영향을 받습니다.'});

Object.assign(es,{'Installed sky browser':'Explorador de cielos instalados','Search skies':'Buscar cielos','Scanning installed skies…':'Buscando cielos instalados…','Set the game directory to browse installed skies.':'Configurá la carpeta del juego para ver los cielos instalados.','sky collections found':'cielos encontrados','No skyboxes found in gfx/env.':'No se encontraron cielos en gfx/env.','Sky selected; save to worldspawn to apply.':'Cielo seleccionado; guardalo en worldspawn para aplicarlo.','Incomplete sky set: one or more of the six faces are missing.':'Cielo incompleto: faltan una o más de sus seis imágenes.'});
Object.assign(ru,{'Installed sky browser':'Установленные скайбоксы','Search skies':'Поиск неба','Scanning installed skies…':'Поиск установленных небес…','Set the game directory to browse installed skies.':'Выберите папку игры, чтобы найти небо.','sky collections found':'наборов неба','No skyboxes found in gfx/env.':'Небо в gfx/env не найдено.','Sky selected; save to worldspawn to apply.':'Небо выбрано; сохраните в worldspawn.'});
Object.assign(ko,{'Installed sky browser':'설치된 하늘 탐색기','Search skies':'하늘 검색','Scanning installed skies…':'설치된 하늘 검색 중…','Set the game directory to browse installed skies.':'하늘을 찾으려면 게임 폴더를 지정하세요.','sky collections found':'하늘 세트','No skyboxes found in gfx/env.':'gfx/env에 하늘이 없습니다.','Sky selected; save to worldspawn to apply.':'하늘을 선택했습니다. worldspawn에 저장하세요.'});
export function useT(){const locale=useEditor(s=>s.locale);return useCallback((key:string)=>translate(locale,key),[locale])}


Object.assign(es,{
  "Listen to the converted WAV before installing":"Escuchá el WAV convertido antes de instalarlo",
  "If this preview sounds wrong, do not install the file.":"Si esta vista previa suena mal, no instales el archivo.",
  "Sound that will be placed":"Sonido que se colocará",
  "Music playback also depends on the player Music Volume setting (mp3volume).":"La música también depende del ajuste Volumen de música (mp3volume) del jugador.",
  "Selected entity is assigned to a different sound. Use Assign selected sound to update it.":"Esta entidad tiene asignado otro sonido. Pulsá Asignar sonido seleccionado para actualizarlo.",
  "Check audio file path in Sven Co-op":"Comprobar ruta del archivo en Sven Co-op",
  "No sound path selected.":"No hay una ruta de sonido seleccionada.",
  "File not found in game sound folders":"Archivo no encontrado en las carpetas de sonido del juego",
  "Duplicate path in multiple sound folders":"Ruta duplicada en varias carpetas de sonido",
  "Resolved file":"Archivo encontrado",
  "Installed and selected for placement":"Instalado y seleccionado para colocar",
});

Object.assign(ru,{
  "Listen to the converted WAV before installing":"Прослушайте WAV перед установкой",
  "If this preview sounds wrong, do not install the file.":"Если звук неверный, не устанавливайте файл.",
  "Sound that will be placed":"Размещаемый звук",
  "Music playback also depends on the player Music Volume setting (mp3volume).":"Воспроизведение музыки зависит также от настройки громкости музыки (mp3volume).",
  "Selected entity is assigned to a different sound. Use Assign selected sound to update it.":"У этой сущности другой звуковой файл. Используйте «Назначить выбранный звук».",
  "Check audio file path in Sven Co-op":"Проверить путь звука в Sven Co-op",
  "No sound path selected.":"Путь звука не выбран.",
  "File not found in game sound folders":"Файл не найден в звуковых папках игры",
  "Duplicate path in multiple sound folders":"Одинаковый путь в нескольких папках звуков",
  "Resolved file":"Найденный файл",
  "Installed and selected for placement":"Установлен и выбран для размещения",
});

Object.assign(ko,{
  "Listen to the converted WAV before installing":"설치 전에 변환된 WAV 들어보기",
  "If this preview sounds wrong, do not install the file.":"미리 듣기에서 소리가 이상하면 설치하지 마세요.",
  "Sound that will be placed":"배치할 사운드",
  "Music playback also depends on the player Music Volume setting (mp3volume).":"음악 재생은 플레이어의 음악 볼륨(mp3volume) 설정에도 영향을 받습니다.",
  "Selected entity is assigned to a different sound. Use Assign selected sound to update it.":"선택한 엔티티는 다른 사운드를 사용합니다. 선택한 사운드 할당을 눌러 변경하세요.",
  "Check audio file path in Sven Co-op":"Sven Co-op에서 사운드 경로 확인",
  "No sound path selected.":"선택한 사운드 경로가 없습니다.",
  "File not found in game sound folders":"게임 사운드 폴더에서 파일을 찾을 수 없습니다",
  "Duplicate path in multiple sound folders":"여러 사운드 폴더에 같은 경로가 있습니다",
  "Resolved file":"확인된 파일",
  "Installed and selected for placement":"설치 및 배치용 선택 완료",
});

// Professional Mapping Tools v0.8.0. UI text only; FGD classnames and WAD names stay unchanged.
Object.assign(es,{
  "Map Doctor": "Diagnóstico del mapa",
  "Static checks for convex brushes, entity targets and imported WAD previews. Only SC-CSG/SC-BSP can confirm leaks and final compilation.": "Comprueba brushes convexos, conexiones entre entidades y texturas WAD importadas. Solo SC-CSG/SC-BSP pueden confirmar fugas y la compilación final.",
  "All issues": "Todas las incidencias",
  "Errors": "Errores",
  "Warnings": "Advertencias",
  "Information": "Información",
  "No findings for this filter.": "No hay incidencias en este filtro.",
  "Write summary to build log": "Enviar resumen al registro de compilación",
  "Advanced Texture Tools": "Herramientas avanzadas de texturas",
  "Copy face material": "Copiar material de la cara",
  "Paste face material": "Pegar material en la cara",
  "Align UV to world": "Alinear UV al mundo",
  "Copy/paste transfers the texture and UV coordinates. World alignment resets offsets to zero; matching scales align adjacent faces.": "Copiar/pegar transfiere la textura y sus coordenadas UV. La alineación global pone los desplazamientos a cero; con escalas iguales, las caras vecinas se alinean.",
  "Snap selection to grid": "Ajustar selección a la cuadrícula",
  "Preview shadows (selected light)": "Previsualizar sombras (luz seleccionada)",
  "Show point light radius": "Mostrar radio de luces puntuales",
  "UV mouse: Alt+drag moves · Alt+Shift rotates · Alt+Ctrl scales. Undo is supported.": "UV con mouse: Alt+arrastrar desplaza · Alt+Shift rota · Alt+Ctrl escala. Se puede deshacer.",
  "Geometry": "Geometría",
  "Textures": "Texturas",
  "Environment": "Entorno",
  "Entities": "Entidades",
  "Texture": "Textura",
  "Faces": "Caras"
});
Object.assign(ru,{
  "Map Doctor": "Диагностика карты",
  "Static checks for convex brushes, entity targets and imported WAD previews. Only SC-CSG/SC-BSP can confirm leaks and final compilation.": "Проверяет выпуклые браши, связи сущностей и импортированные текстуры WAD. Только SC-CSG/SC-BSP подтверждают утечки и результат компиляции.",
  "All issues": "Все замечания",
  "Errors": "Ошибки",
  "Warnings": "Предупреждения",
  "Information": "Информация",
  "No findings for this filter.": "Для этого фильтра замечаний нет.",
  "Write summary to build log": "Записать сводку в журнал сборки",
  "Advanced Texture Tools": "Расширенные инструменты текстур",
  "Copy face material": "Копировать материал грани",
  "Paste face material": "Вставить материал на грань",
  "Align UV to world": "Выровнять UV по миру",
  "Copy/paste transfers the texture and UV coordinates. World alignment resets offsets to zero; matching scales align adjacent faces.": "Копирование переносит текстуру и UV. Выравнивание по миру обнуляет смещения; одинаковый масштаб совмещает соседние грани.",
  "Snap selection to grid": "Привязать выделение к сетке",
  "Preview shadows (selected light)": "Предпросмотр теней (выбранный свет)",
  "Show point light radius": "Показать радиус точечного света",
  "UV mouse: Alt+drag moves · Alt+Shift rotates · Alt+Ctrl scales. Undo is supported.": "UV мышью: Alt+перетаскивание — сдвиг · Alt+Shift — поворот · Alt+Ctrl — масштаб. Отмена доступна.",
  "Geometry": "Геометрия",
  "Textures": "Текстуры",
  "Environment": "Окружение",
  "Entities": "Сущности",
  "Texture": "Текстура",
  "Faces": "Грани"
});
Object.assign(ko,{
  "Map Doctor": "맵 진단",
  "Static checks for convex brushes, entity targets and imported WAD previews. Only SC-CSG/SC-BSP can confirm leaks and final compilation.": "볼록 브러시, 엔티티 연결, 불러온 WAD 텍스처를 검사합니다. 누수 및 최종 컴파일은 SC-CSG/SC-BSP에서만 확인할 수 있습니다.",
  "All issues": "모든 문제",
  "Errors": "오류",
  "Warnings": "경고",
  "Information": "정보",
  "No findings for this filter.": "이 필터에 해당하는 문제가 없습니다.",
  "Write summary to build log": "빌드 로그에 요약 기록",
  "Advanced Texture Tools": "고급 텍스처 도구",
  "Copy face material": "면 재질 복사",
  "Paste face material": "면에 재질 붙여넣기",
  "Align UV to world": "월드 좌표로 UV 정렬",
  "Copy/paste transfers the texture and UV coordinates. World alignment resets offsets to zero; matching scales align adjacent faces.": "복사/붙여넣기는 텍스처와 UV 좌표를 전송합니다. 월드 정렬은 오프셋을 0으로 맞춰 같은 스케일의 인접 면을 정렬합니다.",
  "Snap selection to grid": "선택한 오브젝트를 그리드에 맞추기",
  "Preview shadows (selected light)": "그림자 미리보기 (선택한 조명)",
  "Show point light radius": "점광원 반경 표시",
  "UV mouse: Alt+drag moves · Alt+Shift rotates · Alt+Ctrl scales. Undo is supported.": "UV 마우스: Alt+드래그 이동 · Alt+Shift 회전 · Alt+Ctrl 크기 변경. 실행 취소 지원.",
  "Geometry": "지오메트리",
  "Textures": "텍스처",
  "Environment": "환경",
  "Entities": "엔티티",
  "Texture": "텍스처",
  "Faces": "면"
});

Object.assign(es,{
  "Map has no world or entity brushes.": "El mapa no tiene brushes de mundo ni de entidades.",
  "Map has no info_player_start.": "El mapa no tiene ninguna entidad info_player_start.",
  "Import the same WAD files used for compilation to check texture names.": "Importá los mismos archivos WAD de la compilación para comprobar los nombres de las texturas.",
  "SKY faces exist but worldspawn.skyname is empty.": "Hay caras SKY, pero worldspawn.skyname está vacío.",
  "Entity target is missing: {classname}.{key} → {target}": "Falta el destino de la entidad: {classname}.{key} → {target}",
  "Class not found in loaded FGD: {classname}": "Clase no encontrada en el FGD importado: {classname}",
  "Shared targetname: {name} ({count} entities; may be intentional)": "targetname compartido: {name} ({count} entidades; puede ser intencional)",
  "Texture not found in imported WAD previews: {texture} (may exist in build WAD)": "Textura ausente de los WAD previsualizados: {texture} (puede existir en los WAD de compilación)"
});
Object.assign(ru,{
  "Map has no world or entity brushes.": "На карте нет брашей мира или сущностей.",
  "Map has no info_player_start.": "На карте отсутствует info_player_start.",
  "Import the same WAD files used for compilation to check texture names.": "Импортируйте те же WAD, что используются при компиляции, для проверки названий текстур.",
  "SKY faces exist but worldspawn.skyname is empty.": "Есть грани SKY, но worldspawn.skyname пуст.",
  "Entity target is missing: {classname}.{key} → {target}": "Цель сущности не найдена: {classname}.{key} → {target}",
  "Class not found in loaded FGD: {classname}": "Класс не найден в загруженном FGD: {classname}",
  "Shared targetname: {name} ({count} entities; may be intentional)": "Общий targetname: {name} ({count} сущностей; возможно, намеренно)",
  "Texture not found in imported WAD previews: {texture} (may exist in build WAD)": "Текстура отсутствует в импортированных WAD: {texture} (может быть в WAD компиляции)"
});
Object.assign(ko,{
  "Map has no world or entity brushes.": "맵에 월드 또는 엔티티 브러시가 없습니다.",
  "Map has no info_player_start.": "맵에 info_player_start가 없습니다.",
  "Import the same WAD files used for compilation to check texture names.": "컴파일에 사용하는 WAD 파일을 동일하게 불러와 텍스처 이름을 확인하세요.",
  "SKY faces exist but worldspawn.skyname is empty.": "SKY 면이 있지만 worldspawn.skyname이 비어 있습니다.",
  "Entity target is missing: {classname}.{key} → {target}": "엔티티 대상이 없습니다: {classname}.{key} → {target}",
  "Class not found in loaded FGD: {classname}": "불러온 FGD에 없는 클래스: {classname}",
  "Shared targetname: {name} ({count} entities; may be intentional)": "공유 targetname: {name} ({count}개 엔티티, 의도적일 수 있음)",
  "Texture not found in imported WAD previews: {texture} (may exist in build WAD)": "불러온 WAD 미리보기에 없는 텍스처: {texture} (컴파일 WAD에는 있을 수 있음)"
});

// Advanced Building Studio v0.7.0.2: translate UI across all installed locales.

// v0.8.1: full help, layout presets, camera button and large WAD galleries.
Object.assign(es,{
  "Sven Studio guide": "Guía de Sven Studio",
  "Help introduction": "Editor de mapas para Sven Co-op. Todo el trabajo de geometría se exporta como brushes convexos en .map Valve 220; las vistas previas no sustituyen al compilador.",
  "Quick start": "Primeros pasos",
  "Help quick start": "Creá o importá un proyecto desde Archivo, construí la geometría con formas y brushes, aplicá texturas WAD, colocá entidades como info_player_start y después guardá o exportá el .map para compilarlo con las herramientas de Sven Co-op. El archivo .svenstudio.json conserva la organización y los ajustes propios del editor.",
  "Camera and views": "Cámara y vistas",
  "Help camera": "Botón central: rotar (esquema Blender). Shift + central: desplazar; Ctrl + central: acercar. Con esquema Classic cambian los botones: revisá Controles. El icono del visor alterna Perspectiva y Ortográfica; Num 1/3/7 muestra frontal/lateral/superior y Num 5 alterna proyección. Home encuadra el mapa y el punto del teclado numérico encuadra la selección. Para moverte con WASD activá el modo Fly/Walk.",
  "Building geometry": "Construir geometría",
  "Help geometry": "Usá CREATE → Block, Wedge, Cylinder, Arch, Vault, Stairs u otras formas. G mueve, R rota y C escala; Esc cancela. El editor limita la exportación a brushes cerrados y convexos compatibles con Svengine. Las mallas cóncavas se generan como varios brushes. La grilla y Snap facilitan los bordes exactos; Vertex y Edge permiten editar puntos con validación.",
  "Advanced modeling": "Modelado avanzado",
  "Help advanced": "Abrí Model / CSG en la barra flotante. Union, Subtract e Intersect requieren DOS brushes seleccionados en orden: primero el destino, segundo el cortador. Para Extrude e Inset elegí Face y una cara. Para Bevel elegí Edge y una arista. Extrude genera un brush adicional contiguo; Push/Pull modifica el existente. Las operaciones usan brushes convexos, no mallas de Blender.",
  "Texture browser": "Explorador de texturas",
  "Help textures": "En Biblioteca → Texturas importá los .wad de Sven Co-op. El explorador carga vistas previas en páginas para evitar bloqueos con miles de texturas. Buscá por nombre o WAD, seleccioná una textura para aplicarla o arrastrala sobre una cara. En Face: Alt + arrastrar cambia U/V; Alt + Shift rota; Alt + Ctrl escala. Las rutas WAD utilizadas deben figurar en Configuración de compilación.",
  "Entity browser and FGD": "Entidades y FGD",
  "Help entities": "Importá sven-coop.fgd desde el SDK para ver las entidades reales y sus parámetros originales en inglés. Seleccioná una entidad para modificar classname, targetname, target, spawnflags y demás keyvalues. Gameplay Studio conecta triggers, puertas y lógica. El Explorador muestra entidades y rutas de IA; los brushes de geometría se editan directamente en el visor para no saturar el árbol.",
  "Groups, layers and prefabs": "Grupos, capas y prefabs",
  "Help organization": "Usá la sección Capas para ocultar o bloquear conjuntos; los grupos permiten seleccionar una construcción completa. En Propiedades guardá una selección como prefab y volvé a insertarla desde Formas. Exportá los .svprefab.json para respaldarlos. Todo esto organiza el trabajo dentro del editor: el compilador recibe brushes y entidades estándar.",
  "Lighting and sky": "Iluminación y cielo",
  "Help lighting": "Studios → Lighting & Environment permite crear light, light_spot, light_environment y niebla. La vista previa del visor es aproximada y puede reducir los FPS; las sombras finales se calculan con SC-RAD. Para ver un cielo real en Sven Co-op, las caras de los brushes deben llevar la textura especial SKY y worldspawn debe tener un skyname cuyas seis imágenes estén presentes en gfx/env.",
  "Saving and compiling": "Guardar y compilar",
  "Help compiling": "Guardá primero el proyecto .svenstudio.json. En Configuración de compilación elegí la carpeta mapping/compilers del Sven Co-op SDK, la carpeta del juego y las rutas WAD. Compilar mapa genera el .map y ejecuta SC-CSG, SC-BSP, SC-VIS y SC-RAD; el resultado depende de tus compiladores instalados en Windows. Exportar .MAP solo genera el archivo fuente sin compilar.",
  "Map Doctor and errors": "Map Doctor y errores",
  "Help diagnosis": "Studios → Map Doctor revisa brushes no convexos, referencias target sin destino y texturas WAD que faltan en la vista previa. Revisá la salida de SC-CSG cuando falten texturas y SC-VIS si hay leaks. Map Doctor es una validación previa, no garantiza que el BSP compile. Si algo falla, conservá el archivo .map y el registro de compilación para diagnosticarlo.",
  "Large map performance": "Rendimiento en mapas grandes",
  "Help performance": "En Diseño → Rendimiento elegí Mapas grandes para limitar etiquetas, luces previas y modelos cargados al mismo tiempo. Para mejorar los FPS desactivá Nombres, sombras de vista previa o los radios de luz; ocultá capas que no estés editando. El explorador de WAD y la lista de entidades usan carga por páginas. Los brushes siempre permanecen en el proyecto y en el .map exportado.",
  "Useful shortcuts": "Atajos útiles",
  "Help shortcuts": "G = mover; R = rotar; C = escalar; E = extruir cara seleccionada; Ctrl + Z = deshacer; Ctrl + Y = rehacer; Ctrl + S = guardar; Supr = eliminar. Alt + arrastrar en Face desplaza UV. Num 1/3/7 cambia vista y Num 5 alterna perspectiva/ortográfica. En Controles podés reasignar los atajos. Para salir de una herramienta, presioná Esc.",
  "Font size": "Tamaño de fuente",
  "Large maps": "Mapas grandes",
  "Quality": "Calidad",
  "Balanced": "Equilibrado",
  "Performance settings affect only viewport previews, never compiled map content.": "Estos ajustes solo afectan al visor, nunca al mapa compilado.",
  "Wide": "Panorámico",
  "Minimal": "Mínimo",
  "Mint": "Menta",
  "Orchid": "Orquídea",
  "Gold": "Dorado",
  "Orthographic": "Ortográfica",
  "Switch orthographic / perspective": "Cambiar entre ortográfica y perspectiva",
  "Showing textures": "Texturas mostradas",
  "Load more textures": "Mostrar más texturas",
  "Show more entities": "Mostrar más entidades"
});
Object.assign(ru,{
  "Sven Studio guide": "Руководство Sven Studio",
  "Help introduction": "Редактор карт Sven Co-op. Геометрия сохраняется как выпуклые браши в Valve 220 .map; предпросмотр не заменяет компилятор.",
  "Quick start": "Начало работы",
  "Help quick start": "Создайте или импортируйте проект через меню Файл, постройте геометрию brush-объектами, назначьте WAD-текстуры, добавьте сущности вроде info_player_start, затем сохраните или экспортируйте .map для компиляции инструментами Sven Co-op. Файл .svenstudio.json хранит структуру проекта и параметры редактора.",
  "Camera and views": "Камера и виды",
  "Help camera": "В схеме Blender средняя кнопка вращает вид, Shift + средняя перемещает, Ctrl + средняя масштабирует. В схеме Classic кнопки другие — смотрите Управление. Кнопка в окне переключает перспективу и ортографию. Num 1/3/7 — спереди/справа/сверху, Num 5 — проекция. Home — показать всю карту, Num . — выделенное. WASD доступны в режиме полёта.",
  "Building geometry": "Создание геометрии",
  "Help geometry": "Используйте CREATE → Block, Wedge, Cylinder, Arch, Vault, Stairs и другие примитивы. G — перемещение, R — поворот, C — масштаб, Esc — отмена. В Svengine экспортируются только замкнутые выпуклые браши; вогнутые формы разбиваются на части. Сетка и привязка помогают точному выравниванию. Режимы Vertex и Edge проверяют допустимость изменений.",
  "Advanced modeling": "Расширенное моделирование",
  "Help advanced": "Откройте Model / CSG на плавающей панели. Union/Subtract/Intersect требуют ДВА выделенных браша: сначала основа, затем инструмент. Extrude и Inset работают в режиме Face, Bevel — в Edge. Extrude создаёт соседний браш, Push/Pull изменяет текущий. Операции создают выпуклые браши, а не сетки Blender.",
  "Texture browser": "Каталог текстур",
  "Help textures": "Откройте Библиотека → Текстуры и импортируйте файлы .wad из Sven Co-op. Превью загружаются порциями, чтобы тысячи текстур не блокировали редактор. Ищите по имени или WAD, применяйте текстуру щелчком или перетаскиванием на грань. В режиме Face: Alt+перетаскивание — сдвиг U/V, Alt+Shift — поворот, Alt+Ctrl — масштаб. Пути к WAD укажите в настройках сборки.",
  "Entity browser and FGD": "Сущности и FGD",
  "Help entities": "Импортируйте sven-coop.fgd из SDK для доступа к настоящим классам и ключам (названия остаются на английском). Выделите сущность и измените classname, targetname, target, spawnflags и другие свойства. Gameplay Studio связывает триггеры, двери и логику. Проводник показывает сущности и маршруты ИИ; браши редактируются прямо в 3D-окне.",
  "Groups, layers and prefabs": "Группы, слои и префабы",
  "Help organization": "Слои позволяют скрывать и блокировать наборы объектов, группы — выделять целые конструкции. В Свойствах можно сохранить выделенное как префаб и вставить снова из Фигур. Экспортируйте .svprefab.json для резервной копии. Компилятор получает только стандартные браши и сущности.",
  "Lighting and sky": "Освещение и небо",
  "Help lighting": "В Studios → Lighting & Environment можно добавить light, light_spot, light_environment и туман. Предпросмотр приблизительный и может замедлять редактор; итоговые тени создаёт SC-RAD. Для неба в Sven Co-op нужны грани с текстурой SKY и ключ worldspawn skyname с шестью изображениями в gfx/env.",
  "Saving and compiling": "Сохранение и компиляция",
  "Help compiling": "Сначала сохраните .svenstudio.json. В настройках сборки укажите mapping/compilers из Sven Co-op SDK, папку игры и WAD. Сборка создаёт .map и запускает SC-CSG, SC-BSP, SC-VIS и SC-RAD; для этого нужны компиляторы на Windows. Экспорт .MAP сохраняет исходник без компиляции.",
  "Map Doctor and errors": "Проверка карты и ошибки",
  "Help diagnosis": "Studios → Map Doctor проверяет невыпуклые браши, отсутствующие target и неимпортированные WAD. Ошибки текстур ищите в SC-CSG, утечки — в SC-VIS. Проверка выполняется до компиляции и не гарантирует успешный BSP. При ошибках сохраните .map и журнал сборки.",
  "Large map performance": "Производительность больших карт",
  "Help performance": "В Дизайн → Производительность выберите Большие карты для ограничения подписей, предпросмотра света и моделей. Для ускорения отключите Подписи, тени предпросмотра, радиусы света и скройте ненужные слои. Текстуры и сущности загружаются в список частями. Все браши остаются в проекте и в экспортированном .map.",
  "Useful shortcuts": "Полезные горячие клавиши",
  "Help shortcuts": "G — перемещение; R — поворот; C — масштаб; E — выдавить грань; Ctrl+Z — отмена; Ctrl+Y — повтор; Ctrl+S — сохранить; Delete — удалить. Alt+перетаскивание в Face — смещение UV. Num 1/3/7 — вид, Num 5 — проекция. В Управлении можно переназначить клавиши. Esc завершает инструмент.",
  "Font size": "Размер шрифта",
  "Large maps": "Большие карты",
  "Quality": "Качество",
  "Balanced": "Сбалансированный",
  "Performance settings affect only viewport previews, never compiled map content.": "Настройки меняют только предпросмотр, не скомпилированную карту.",
  "Wide": "Широкий",
  "Minimal": "Минимальный",
  "Mint": "Мятный",
  "Orchid": "Орхидея",
  "Gold": "Золотой",
  "Orthographic": "Ортографический",
  "Switch orthographic / perspective": "Переключить ортографию / перспективу",
  "Showing textures": "Показано текстур",
  "Load more textures": "Показать больше текстур",
  "Show more entities": "Показать ещё сущности"
});
Object.assign(ko,{
  "Sven Studio guide": "Sven Studio 사용 설명서",
  "Help introduction": "Sven Co-op 맵 편집기입니다. 기하 구조는 Valve 220 .map의 볼록 브러시로 저장되며 미리보기는 컴파일 결과가 아닙니다.",
  "Quick start": "시작하기",
  "Help quick start": "파일 메뉴에서 프로젝트를 만들거나 가져오고, 도형과 브러시로 지오메트리를 구성한 뒤 WAD 텍스처를 적용하고 info_player_start 같은 엔티티를 배치하세요. 이후 프로젝트를 저장하거나 .map으로 내보내 Sven Co-op 도구로 컴파일하면 됩니다. .svenstudio.json 파일에는 편집기 전용 구성과 배치 정보가 저장됩니다.",
  "Camera and views": "카메라와 보기",
  "Help camera": "Blender 설정에서 가운데 버튼은 회전, Shift+가운데 버튼은 이동, Ctrl+가운데 버튼은 확대입니다. Classic 설정은 조작이 다르므로 컨트롤을 확인하세요. 뷰포트 아이콘 또는 Num 5로 원근/직교를 전환합니다. Num 1/3/7은 정면/측면/상단 보기, Home은 전체 맵, Num .은 선택 항목에 초점을 맞춥니다. WASD 이동은 Fly/Walk 모드에서 가능합니다.",
  "Building geometry": "지오메트리 제작",
  "Help geometry": "CREATE에서 Block, Wedge, Cylinder, Arch, Vault, Stairs 등을 사용합니다. G는 이동, R은 회전, C는 크기 조절, Esc는 취소입니다. Svengine 호환을 위해 닫힌 볼록 브러시만 내보낼 수 있으며 오목한 도형은 여러 브러시로 나뉩니다. 그리드와 스냅으로 정확히 정렬하고 Vertex/Edge 모드에서 안전하게 편집하세요.",
  "Advanced modeling": "고급 모델링",
  "Help advanced": "부동 도구 모음에서 Model / CSG를 엽니다. Union/Subtract/Intersect는 두 개의 브러시를 순서대로 선택해야 합니다(대상, 커터). Extrude와 Inset은 Face 모드, Bevel은 Edge 모드에서 사용합니다. Extrude는 인접 브러시를 생성하고 Push/Pull은 기존 브러시를 수정합니다. Blender 메시가 아닌 볼록 브러시 방식입니다.",
  "Texture browser": "텍스처 탐색기",
  "Help textures": "라이브러리 → 텍스처에서 Sven Co-op의 .wad를 가져옵니다. 수천 개의 텍스처를 불러올 때 멈추지 않도록 미리보기는 페이지별로 표시합니다. 이름이나 WAD로 검색하고 클릭하거나 면 위로 끌어 적용하세요. Face 모드에서 Alt+드래그는 U/V 이동, Alt+Shift는 회전, Alt+Ctrl은 크기 조절입니다. 컴파일 설정에 사용한 WAD 경로가 필요합니다.",
  "Entity browser and FGD": "엔티티와 FGD",
  "Help entities": "SDK의 sven-coop.fgd를 가져와 실제 엔티티와 원래 영어 매개변수를 사용하세요. 엔티티를 선택해 classname, targetname, target, spawnflags 등 키값을 수정할 수 있습니다. Gameplay Studio에서 트리거, 문, 로직 연결을 구성합니다. 탐색기에는 엔티티와 AI 경로가 표시되고, 일반 브러시는 목록을 과도하게 늘리지 않도록 뷰포트에서 편집합니다.",
  "Groups, layers and prefabs": "그룹, 레이어, 프리팹",
  "Help organization": "레이어에서 오브젝트를 숨기거나 잠그고 그룹으로 구조물을 한 번에 선택할 수 있습니다. 속성에서 선택 항목을 프리팹으로 저장한 뒤 도형 메뉴에서 다시 배치하세요. .svprefab.json을 내보내 백업할 수 있습니다. 이 기능은 편집기 전용이며 실제 컴파일 결과는 표준 브러시와 엔티티입니다.",
  "Lighting and sky": "조명과 하늘",
  "Help lighting": "Studios → Lighting & Environment에서 light, light_spot, light_environment, 안개를 만들 수 있습니다. 뷰포트의 조명은 근사 미리보기이고 FPS가 떨어질 수 있습니다. 최종 그림자는 SC-RAD가 계산합니다. 실제 Sven Co-op 하늘을 보려면 SKY 텍스처를 적용한 면과 gfx/env의 여섯 이미지가 연결된 worldspawn skyname이 필요합니다.",
  "Saving and compiling": "저장과 컴파일",
  "Help compiling": "먼저 .svenstudio.json 프로젝트를 저장하세요. 컴파일 설정에서 Sven Co-op SDK의 mapping/compilers 폴더, 게임 폴더, WAD 경로를 지정합니다. 맵 컴파일은 .map을 생성하고 설치된 Windows 컴파일러 SC-CSG, SC-BSP, SC-VIS, SC-RAD를 실행합니다. .MAP 내보내기는 소스 파일만 저장합니다.",
  "Map Doctor and errors": "맵 검사 및 오류",
  "Help diagnosis": "Studios → Map Doctor는 볼록하지 않은 브러시, 끊어진 target 연결, 가져오지 않은 WAD를 검사합니다. 텍스처 오류는 SC-CSG 로그에서, 누수는 SC-VIS 로그에서 확인하세요. Map Doctor는 사전 검사이므로 BSP 성공을 보장하지 않습니다. 문제 발생 시 .map과 컴파일 로그를 보관하세요.",
  "Large map performance": "대형 맵 성능",
  "Help performance": "디자인 → 성능에서 대형 맵을 선택하면 동시에 표시되는 라벨, 조명 미리보기, 모델 수가 제한됩니다. FPS를 높이려면 이름 표시, 미리보기 그림자, 조명 범위를 끄고 작업하지 않는 레이어를 숨기세요. WAD 및 엔티티 목록은 페이지별로 로드됩니다. 브러시는 프로젝트와 내보낸 .map에 그대로 유지됩니다.",
  "Useful shortcuts": "유용한 단축키",
  "Help shortcuts": "G 이동, R 회전, C 크기 조절, E 선택한 면 돌출, Ctrl+Z 실행 취소, Ctrl+Y 다시 실행, Ctrl+S 저장, Delete 삭제입니다. Face 모드에서 Alt+드래그는 UV 이동, Num 1/3/7은 보기 전환, Num 5는 원근/직교 전환입니다. 컨트롤에서 단축키를 변경할 수 있고 Esc로 도구를 종료합니다.",
  "Font size": "글꼴 크기",
  "Large maps": "대형 맵",
  "Quality": "품질",
  "Balanced": "균형",
  "Performance settings affect only viewport previews, never compiled map content.": "이 설정은 뷰포트 미리보기에만 영향을 주며 컴파일된 맵 내용은 바뀌지 않습니다.",
  "Wide": "와이드",
  "Minimal": "최소",
  "Mint": "민트",
  "Orchid": "오키드",
  "Gold": "골드",
  "Orthographic": "직교",
  "Switch orthographic / perspective": "직교/원근 전환",
  "Showing textures": "표시된 텍스처",
  "Load more textures": "텍스처 더 보기",
  "Show more entities": "엔티티 더 보기"
});


// English is the source/fallback language. Help paragraphs must be real strings,
// not the internal lookup keys (e.g. `Help quick start`).
Object.assign(en,{
  'Help introduction':'Build and inspect maps with convex Valve 220 brushes for Sven Co-op. The editor preview is not a substitute for compiling the map with the Sven Co-op SDK.',
  'Help quick start':'Create or import a project from File, build your level from shapes and brushes, apply WAD textures, and place entities such as info_player_start. Save the editor project as .svenstudio.json or export .map to compile it with the installed Sven Co-op tools.',
  'Help camera':'Use the Blender or Classic navigation preset. Set camera sensitivity, field of view, smoothing, and Fly/Walk controls under Camera & Gizmo Controls. The viewport includes front, side, top, back, bottom, and isometric views, as well as numpad orbit, pan, and zoom.',
  'Help geometry':'Create blocks, wedges, cylinders, arches, vaults, stairs, and other shapes. Press G to move, R to rotate, or C to scale; Esc cancels. The editor exports closed convex brushes for GoldSrc. Use Grid and Snap for accurate placement, and Vertex, Edge or Face modes for detailed editing.',
  'Help advanced':'Open Model / CSG from the floating toolbar. Union, Subtract, and Intersect use two brushes selected in order: target first, cutter second. Extrude and Inset work on a selected face; Bevel works on an edge. Push/Pull changes an existing brush, while Extrude creates another convex brush.',
  'Help textures':'Import WAD3 texture files into the Texture Browser. Browse and search by name or WAD, then select or drag textures onto brush faces. In Face mode, Alt + drag adjusts UV offsets, Alt + Shift rotates, and Alt + Ctrl scales them. Configure the WAD paths used by your compilers in Build Settings.',
  'Help entities':'Import sven-coop.fgd from the Sven Co-op SDK to access the game entity definitions and their original English keys. Edit classname, targetname, target, spawnflags and other keyvalues in the inspector. Gameplay Studio connects triggers, doors and logic entities.',
  'Help organization':'Use layers to hide or lock sets of objects and groups to select whole structures. Save reusable selections as prefabs, then place them in other maps. Export .svprefab.json files to keep a portable backup. Only standard brushes and entities are passed to the game compilers.',
  'Help lighting':'Lighting & Environment Studio provides light, light_spot, light_environment and fog settings. Preview lighting is approximate; SC-RAD calculates the final lighting. For a sky in Sven Co-op, apply the special SKY texture to suitable faces and set worldspawn.skyname to a six-face skybox available in gfx/env.',
  'Help compiling':'Save your .svenstudio.json project first. In Build Settings, choose the installed Sven Co-op SDK mapping/compilers folder, the game folder and the WAD paths. Compile Map exports a .map and runs SC-CSG, SC-BSP, SC-VIS and SC-RAD. Export .MAP saves just the map source without compiling.',
  'Help recovery':'The editor automatically saves recovery snapshots in this browser. Returning to the same address can restore your map, selection and camera. File → Restore previous autosave loads an older local copy. Browser storage can be cleared or unavailable in private mode, so export .svenstudio.json backups regularly.',
  'Help diagnosis':'Studios → Map Doctor checks invalid or non-convex brushes, broken entity targets, and missing WAD previews. Check SC-CSG output for texture problems and SC-VIS output for leaks. A successful preflight check does not guarantee successful BSP compilation.',
  'Help performance':'For large maps, choose the Large maps performance preset under Layout. To improve viewport performance, hide entity names, preview shadows, light ranges or layers you are not editing. Textures and entity lists are loaded in batches; hidden or unloaded preview items remain in your exported map.',
  'Help shortcuts':'G = Move; R = Rotate; C = Scale; E = Extrude selected face; Ctrl+Z / Ctrl+Y = Undo / Redo; Ctrl+S = Save; Delete = Remove. Shift/Ctrl/Alt adjust mouse transforms. Numpad keys control views; check Camera & Gizmo Controls for customizable shortcuts.',
  'Help summary':'SvenStudio 3D is a 3D level editor for Sven Co-op and GoldSrc that creates Valve 220 compatible brushes, organizes entities, manages WAD textures and previews compiled maps in its integrated BSP Viewer. Build with architectural tools, gizmos and a customizable HUD, then compile with the Sven Co-op SDK and review problems before playing.',
});

Object.assign(es,{
  "Model / CSG": "Modelado / CSG",
  "Advanced Building Studio": "Herramientas avanzadas de construcción",
  "Close panel": "Cerrar panel",
  "SVENGINE · Brush editing modes": "SVENGINE · Modos de edición de brushes",
  "CSG · select 2 overlapping brushes (first = target)": "CSG · Seleccioná 2 brushes superpuestos (el primero es el objetivo)",
  "Select two unlocked brushes with Ctrl/Shift + click": "Seleccioná dos brushes desbloqueados con Ctrl/Shift + clic",
  "Union": "Unir",
  "Subtract": "Restar",
  "Intersect": "Intersección",
  "Face / Edge tools · select an unlocked brush and a face or edge": "Herramientas de caras y aristas · Seleccioná un brush desbloqueado y una cara o arista",
  "Extrude distance": "Distancia de extrusión",
  "Extrude face": "Extruir cara",
  "Bevel / Inset width": "Ancho de bisel / inserción",
  "Bevel width": "Ancho del bisel",
  "Face mode: select a face first": "Modo Cara: seleccioná primero una cara",
  "Edge mode: select an edge first": "Modo Arista: seleccioná primero una arista",
  "Bevel edge": "Biselar arista",
  "Inset (taper)": "Inset (borde inclinado)",
  "Face UV: Alt + drag on the face. Undo: Ctrl + Z.": "UV de la cara: Alt + arrastrar sobre la cara. Deshacer: Ctrl + Z.",
  "Open Properties panel": "Abrir panel Propiedades",
  "Operation completed": "Operación completada",
  "Extrude": "Extruir",
  "Bevel": "Bisel",
  "Inset": "Inset",
  "Measure": "Medir",
  "Vault": "Bóveda",
  "CSG requires two brushes selected in order: target first, cutter second. GoldSrc uses separate convex solids.": "CSG requiere dos brushes seleccionados en orden: primero el objetivo, luego el cortador. GoldSrc usa sólidos convexos independientes.",
  "Group name": "Nombre del grupo",
  "Group": "Agrupar",
  "Ungroup": "Desagrupar",
  "Groups": "Grupos",
  "Prefab name": "Nombre del prefab",
  "Save prefab": "Guardar prefab",
  "Prefabs": "Prefabs",
  "Select entire group": "Seleccionar grupo completo",
  "Show/hide group": "Mostrar/ocultar grupo",
  "Lock/unlock group": "Bloquear/desbloquear grupo",
  "Save a selection from Properties, then reuse it in any project. Library is stored in this browser; Export for backup.": "Guardá una selección desde Propiedades para reutilizarla en cualquier proyecto. La biblioteca se almacena en este navegador; exportá una copia de seguridad.",
  "Import prefab": "Importar prefab",
  "Use selected object position": "Usar posición del objeto seleccionado",
  "No prefabs saved yet.": "Todavía no hay prefabs guardados.",
  "Place at coordinates": "Colocar en las coordenadas",
  "Export JSON": "Exportar JSON",
  "Delete prefab": "Eliminar prefab",
  "Prefab file too large (max 2 MB).": "Archivo de prefab demasiado grande (máximo 2 MB).",
  "Prefab imported.": "Prefab importado.",
  "Extrusion distance (E)": "Distancia de extrusión (E)",
  "Width (units)": "Ancho (unidades)",
  "Move the face of the existing convex solid": "Mover la cara del sólido convexo existente",
  "Push/Pull": "Empujar/tirar",
  "Extrude creates a new adjacent convex brush. Push/Pull modifies the original brush.": "Extruir crea otro brush convexo adyacente. Empujar/tirar modifica el brush original.",
  "Alt + drag directly on the selected face to adjust texture U/V offsets (Undo supported).": "Alt + arrastrar sobre la cara seleccionada para ajustar el desplazamiento U/V de la textura (admite Deshacer)."
});
Object.assign(ru,{
  "Model / CSG": "Моделирование / CSG",
  "Advanced Building Studio": "Расширенное построение",
  "Close panel": "Закрыть панель",
  "SVENGINE · Brush editing modes": "SVENGINE · Режимы редактирования брашей",
  "CSG · select 2 overlapping brushes (first = target)": "CSG · Выберите 2 пересекающихся браша (первый — цель)",
  "Select two unlocked brushes with Ctrl/Shift + click": "Выберите два незаблокированных браша с Ctrl/Shift + щелчок",
  "Union": "Объединить",
  "Subtract": "Вычесть",
  "Intersect": "Пересечь",
  "Face / Edge tools · select an unlocked brush and a face or edge": "Грани и рёбра · Выберите незаблокированный браш и грань или ребро",
  "Extrude distance": "Расстояние выдавливания",
  "Extrude face": "Выдавить грань",
  "Bevel / Inset width": "Ширина фаски / вставки",
  "Bevel width": "Ширина фаски",
  "Face mode: select a face first": "Режим граней: сначала выберите грань",
  "Edge mode: select an edge first": "Режим рёбер: сначала выберите ребро",
  "Bevel edge": "Скосить ребро",
  "Inset (taper)": "Вставка (наклон)",
  "Face UV: Alt + drag on the face. Undo: Ctrl + Z.": "UV грани: Alt + перетаскивание. Отменить: Ctrl + Z.",
  "Open Properties panel": "Открыть свойства",
  "Operation completed": "Операция завершена",
  "Extrude": "Выдавливание",
  "Bevel": "Фаска",
  "Inset": "Вставка",
  "Measure": "Измерить",
  "Vault": "Свод",
  "CSG requires two brushes selected in order: target first, cutter second. GoldSrc uses separate convex solids.": "Для CSG выберите два браша: первый — цель, второй — вырезающий. GoldSrc использует отдельные выпуклые тела.",
  "Group name": "Имя группы",
  "Group": "Сгруппировать",
  "Ungroup": "Разгруппировать",
  "Groups": "Группы",
  "Prefab name": "Имя префаба",
  "Save prefab": "Сохранить префаб",
  "Prefabs": "Префабы",
  "Select entire group": "Выбрать всю группу",
  "Show/hide group": "Показать/скрыть группу",
  "Lock/unlock group": "Заблокировать/разблокировать группу",
  "Save a selection from Properties, then reuse it in any project. Library is stored in this browser; Export for backup.": "Сохраните выделенные объекты из свойств и используйте в любом проекте. Библиотека хранится в этом браузере; экспортируйте резервную копию.",
  "Import prefab": "Импортировать префаб",
  "Use selected object position": "Использовать позицию объекта",
  "No prefabs saved yet.": "Пока нет сохранённых префабов.",
  "Place at coordinates": "Разместить по координатам",
  "Export JSON": "Экспорт JSON",
  "Delete prefab": "Удалить префаб",
  "Prefab file too large (max 2 MB).": "Файл префаба слишком большой (максимум 2 МБ).",
  "Prefab imported.": "Префаб импортирован.",
  "Extrusion distance (E)": "Расстояние выдавливания (E)",
  "Width (units)": "Ширина (единицы)",
  "Move the face of the existing convex solid": "Переместить грань существующего выпуклого тела",
  "Push/Pull": "Толкать/тянуть",
  "Extrude creates a new adjacent convex brush. Push/Pull modifies the original brush.": "Выдавливание создаёт соседний выпуклый браш. Толкать/тянуть изменяет исходный браш.",
  "Alt + drag directly on the selected face to adjust texture U/V offsets (Undo supported).": "Alt + перетаскивание выбранной грани для изменения UV-смещения текстуры (поддерживается отмена)."
});
Object.assign(ko,{
  "Model / CSG": "모델링 / CSG",
  "Advanced Building Studio": "고급 건축 도구",
  "Close panel": "패널 닫기",
  "SVENGINE · Brush editing modes": "SVENGINE · 브러시 편집 모드",
  "CSG · select 2 overlapping brushes (first = target)": "CSG · 겹치는 브러시 2개 선택 (첫 번째가 대상)",
  "Select two unlocked brushes with Ctrl/Shift + click": "Ctrl/Shift + 클릭으로 잠금 해제된 브러시 2개 선택",
  "Union": "합치기",
  "Subtract": "빼기",
  "Intersect": "교차",
  "Face / Edge tools · select an unlocked brush and a face or edge": "면 / 모서리 도구 · 잠금 해제된 브러시와 면 또는 모서리 선택",
  "Extrude distance": "돌출 거리",
  "Extrude face": "면 돌출",
  "Bevel / Inset width": "베벨 / 인셋 너비",
  "Bevel width": "베벨 너비",
  "Face mode: select a face first": "면 모드: 먼저 면을 선택하세요",
  "Edge mode: select an edge first": "모서리 모드: 먼저 모서리를 선택하세요",
  "Bevel edge": "모서리 베벨",
  "Inset (taper)": "인셋 (경사)",
  "Face UV: Alt + drag on the face. Undo: Ctrl + Z.": "면 UV: Alt + 면 드래그. 실행 취소: Ctrl + Z.",
  "Open Properties panel": "속성 패널 열기",
  "Operation completed": "작업 완료",
  "Extrude": "돌출",
  "Bevel": "베벨",
  "Inset": "인셋",
  "Measure": "거리 측정",
  "Vault": "볼트 천장",
  "CSG requires two brushes selected in order: target first, cutter second. GoldSrc uses separate convex solids.": "CSG는 두 브러시를 순서대로 선택해야 합니다. 첫 번째는 대상, 두 번째는 절단용입니다. GoldSrc는 개별 볼록 솔리드를 사용합니다.",
  "Group name": "그룹 이름",
  "Group": "그룹화",
  "Ungroup": "그룹 해제",
  "Groups": "그룹",
  "Prefab name": "프리팹 이름",
  "Save prefab": "프리팹 저장",
  "Prefabs": "프리팹",
  "Select entire group": "전체 그룹 선택",
  "Show/hide group": "그룹 표시/숨기기",
  "Lock/unlock group": "그룹 잠금/해제",
  "Save a selection from Properties, then reuse it in any project. Library is stored in this browser; Export for backup.": "속성에서 선택 항목을 저장해 다른 프로젝트에서도 재사용할 수 있습니다. 라이브러리는 이 브라우저에 저장되므로 백업을 위해 내보내세요.",
  "Import prefab": "프리팹 가져오기",
  "Use selected object position": "선택한 오브젝트 위치 사용",
  "No prefabs saved yet.": "저장된 프리팹이 없습니다.",
  "Place at coordinates": "좌표에 배치",
  "Export JSON": "JSON 내보내기",
  "Delete prefab": "프리팹 삭제",
  "Prefab file too large (max 2 MB).": "프리팹 파일이 너무 큽니다(최대 2 MB).",
  "Prefab imported.": "프리팹을 가져왔습니다.",
  "Extrusion distance (E)": "돌출 거리 (E)",
  "Width (units)": "너비 (단위)",
  "Move the face of the existing convex solid": "기존 볼록 솔리드의 면 이동",
  "Push/Pull": "밀기/당기기",
  "Extrude creates a new adjacent convex brush. Push/Pull modifies the original brush.": "돌출은 인접한 새 볼록 브러시를 생성합니다. 밀기/당기기는 원래 브러시를 수정합니다.",
  "Alt + drag directly on the selected face to adjust texture U/V offsets (Undo supported).": "Alt + 선택한 면을 드래그하여 텍스처 U/V 오프셋 조정 (실행 취소 지원)."
});




// Automatic language selection follows the browser/operating-system languages on first use.
Object.assign(en,{'Automatic (system language)':'Automatic (system language)'});
Object.assign(es,{'Automatic (system language)':'Automático (idioma del sistema)'});
Object.assign(ru,{'Automatic (system language)':'Автоматически (язык системы)'});
Object.assign(ko,{'Automatic (system language)':'자동 (시스템 언어)'});

// v0.8.2: browser recovery, camera customization, accurate Svengine folder and credits.
Object.assign(es,{
  'Sven Co-op game data folder':'Carpeta svencoop o svencoop_addon',
  'Advanced camera options':'Opciones avanzadas de cámara',
  'Smooth camera motion':'Suavizado de cámara','Zoom toward mouse cursor':'Zoom hacia el cursor',
  'Camera smoothing':'Intensidad de suavizado','Perspective field of view':'Campo de visión (FOV)',
  'Minimum camera distance':'Distancia mínima de cámara','Maximum camera distance':'Distancia máxima de cámara',
  'Fly mouse sensitivity':'Sensibilidad del mouse en vuelo',
  'Fast flight multiplier (Shift)':'Multiplicador de vuelo rápido (Shift)',
  'Slow flight multiplier (Ctrl)':'Multiplicador de vuelo lento (Ctrl)',
  'These options affect only the editor camera. They do not change map geometry or the BSP.':'Estos ajustes solo modifican la cámara del editor; no cambian la geometría ni el BSP.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C siguen el mouse; repetí la tecla o hacé clic para confirmar, Esc o clic derecho cancela. X/Y/Z restringen los ejes y los números fijan valores.',
  'Project credits':'Créditos del proyecto',
  'This project was made with the help of ChatGPT.':'Este proyecto esta logrado con la ayuda de Chat GPT',
  'This project was made with the help of GPT-6 Astra.':'Este proyecto fue realizado con la ayuda de GPT-6 Astra.',
  'Editor summary':'Resumen del editor',
  'Help summary':'SvenStudio 3D es un editor de mapas 3D para Sven Co-op y GoldSrc enfocado en construir geometry brushes compatibles con Valve 220, organizar entidades, manejar texturas WAD y previsualizar mapas compilados con un BSP Viewer integrado. El flujo principal combina construcción rápida en el visor 3D, herramientas de arquitectura, gizmo, personalización del HUD, compilación para Sven Co-op y utilidades de diagnóstico para revisar el mapa antes de probarlo en el juego.',
  'Session recovered':'Sesión recuperada','Autosaved':'Autoguardado','Autosave error':'Error de autoguardado',
  'Autosave failed; export a project backup.':'Falló el autoguardado. Exportá una copia del proyecto.',
  'Autosave is stored in this browser. Export a project file for a portable backup.':'El autoguardado queda en este navegador. Exportá un archivo para conservar una copia independiente.',
  'Restore previous autosave':'Recuperar autoguardado anterior',
  'No earlier recovery snapshot is available.':'No hay una copia automática anterior disponible.',
  'Restore the previous locally saved project? Your current work will be replaced.':'¿Restaurar el proyecto de la copia anterior? Reemplazará el trabajo actual.',
  'Automatic recovery':'Recuperación automática',
  'Help recovery':'Los cambios se guardan automáticamente en este navegador. Si cerrás la pestaña y volvés a entrar desde el mismo origen, Sven Studio recuperará el mapa, la selección y la cámara. Archivo → Recuperar autoguardado anterior permite volver a una copia de respaldo. El guardado del navegador se puede perder al borrar sus datos o usar modo privado; usá Archivo → Guardar proyecto para descargar tu .svenstudio.json.',
});
Object.assign(ru,{
  'Sven Co-op game data folder':'Папка svencoop или svencoop_addon',
  'Advanced camera options':'Дополнительные настройки камеры',
  'Smooth camera motion':'Плавная камера','Zoom toward mouse cursor':'Масштабирование к курсору',
  'Camera smoothing':'Степень сглаживания','Perspective field of view':'Угол обзора (FOV)',
  'Minimum camera distance':'Минимальная дистанция камеры','Maximum camera distance':'Максимальная дистанция камеры',
  'Fly mouse sensitivity':'Чувствительность мыши в полёте',
  'Fast flight multiplier (Shift)':'Ускорение полёта (Shift)',
  'Slow flight multiplier (Ctrl)':'Замедление полёта (Ctrl)',
  'These options affect only the editor camera. They do not change map geometry or the BSP.':'Эти параметры меняют только камеру редактора, не геометрию или BSP.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C управляются мышью: повтор клавиши или щелчок подтверждает; Esc/ПКМ отменяет. X/Y/Z ограничивают ось, числа задают значение.',
  'Project credits':'Авторы проекта',
  'This project was made with the help of ChatGPT.':'Этот проект создан при помощи ChatGPT.',
  'This project was made with the help of GPT-6 Astra.':'Этот проект создан при помощи GPT-6 Astra.',
  'Editor summary':'Кратко о редакторе',
  'Help summary':'SvenStudio 3D — это редактор 3D-карт для Sven Co-op и GoldSrc, предназначенный для создания brush-геометрии, совместимой с Valve 220, настройки сущностей, работы с текстурами WAD и просмотра уже собранных карт во встроенном BSP Viewer. Основной процесс объединяет быстрое редактирование в 3D-окне, архитектурные инструменты, gizmo, настройку HUD, компиляцию под Sven Co-op и диагностические средства для проверки карты перед запуском в игре.',
  'Session recovered':'Сессия восстановлена','Autosaved':'Автосохранено','Autosave error':'Ошибка автосохранения',
  'Autosave failed; export a project backup.':'Ошибка автосохранения. Экспортируйте резервную копию проекта.',
  'Autosave is stored in this browser. Export a project file for a portable backup.':'Автосохранение хранится в этом браузере. Экспортируйте файл проекта для резервной копии.',
  'Restore previous autosave':'Восстановить прошлую автокопию',
  'No earlier recovery snapshot is available.':'Предыдущая автокопия отсутствует.',
  'Restore the previous locally saved project? Your current work will be replaced.':'Восстановить предыдущую локальную копию? Текущие изменения будут заменены.',
  'Automatic recovery':'Автоматическое восстановление',
  'Help recovery':'Проект автоматически сохраняется в этом браузере. При повторном открытии того же адреса восстанавливаются карта, выделение и камера. Файл → Восстановить прошлую автокопию возвращает резервную версию. В приватном режиме или после очистки данных браузера копия может исчезнуть; регулярно экспортируйте .svenstudio.json.',
});
Object.assign(ko,{
  'Sven Co-op game data folder':'svencoop 또는 svencoop_addon 폴더',
  'Advanced camera options':'고급 카메라 설정',
  'Smooth camera motion':'카메라 부드럽게 이동','Zoom toward mouse cursor':'마우스 커서 위치로 확대',
  'Camera smoothing':'카메라 감쇠 강도','Perspective field of view':'원근 시야각(FOV)',
  'Minimum camera distance':'최소 카메라 거리','Maximum camera distance':'최대 카메라 거리',
  'Fly mouse sensitivity':'비행 마우스 감도',
  'Fast flight multiplier (Shift)':'고속 비행 배율(Shift)',
  'Slow flight multiplier (Ctrl)':'저속 비행 배율(Ctrl)',
  'These options affect only the editor camera. They do not change map geometry or the BSP.':'이 설정은 편집기 카메라에만 적용되며 맵 구조와 BSP에는 영향을 주지 않습니다.',
  'G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.':'G/R/C로 마우스 변형을 시작하고 같은 키나 클릭으로 확정합니다. Esc/오른쪽 클릭으로 취소하며 X/Y/Z와 숫자 입력을 지원합니다.',
  'Project credits':'프로젝트 크레딧',
  'This project was made with the help of ChatGPT.':'이 프로젝트는 ChatGPT의 도움으로 제작되었습니다.',
  'This project was made with the help of GPT-6 Astra.':'이 프로젝트는 GPT-6 Astra의 도움으로 제작되었습니다.',
  'Editor summary':'편집기 요약',
  'Help summary':'SvenStudio 3D는 Sven Co-op과 GoldSrc용 3D 맵 편집기로, Valve 220 호환 브러시 지오메트리 제작, 엔티티 구성, WAD 텍스처 관리, 통합 BSP 뷰어를 통한 컴파일 맵 미리보기에 초점을 맞춥니다. 주요 작업 흐름은 3D 뷰포트 편집, 건축 도구, 기즈모, HUD 사용자화, Sven Co-op용 컴파일, 게임에서 테스트하기 전 지도를 점검하는 진단 도구를 하나로 묶습니다.',
  'Session recovered':'세션 복구됨','Autosaved':'자동 저장됨','Autosave error':'자동 저장 오류',
  'Autosave failed; export a project backup.':'자동 저장에 실패했습니다. 프로젝트 파일을 백업하세요.',
  'Autosave is stored in this browser. Export a project file for a portable backup.':'자동 저장은 이 브라우저에 보관됩니다. 별도의 프로젝트 파일도 내보내세요.',
  'Restore previous autosave':'이전 자동 저장 복구',
  'No earlier recovery snapshot is available.':'이전 자동 저장본이 없습니다.',
  'Restore the previous locally saved project? Your current work will be replaced.':'이전 로컬 저장본을 복구할까요? 현재 작업이 대체됩니다.',
  'Automatic recovery':'자동 복구',
  'Help recovery':'프로젝트는 브라우저에 자동 저장됩니다. 같은 주소로 편집기를 다시 열면 맵, 선택 상태, 카메라를 복원합니다. 파일 메뉴에서 이전 자동 저장본을 복구할 수도 있습니다. 시크릿 모드나 브라우저 데이터 삭제 시 사라질 수 있으므로 .svenstudio.json 파일도 저장하세요.',
});

Object.assign(es,{
  "Back view": "Vista trasera",
  "Left view": "Vista izquierda",
  "Bottom view": "Vista inferior",
  "Isometric view": "Vista isométrica",
  "Orbit camera left": "Orbitar cámara a la izquierda",
  "Orbit camera right": "Orbitar cámara a la derecha",
  "Orbit camera up": "Orbitar cámara hacia arriba",
  "Orbit camera down": "Orbitar cámara hacia abajo",
  "Pan camera left": "Desplazar cámara a la izquierda",
  "Pan camera right": "Desplazar cámara a la derecha",
  "Pan camera up": "Desplazar cámara hacia arriba",
  "Pan camera down": "Desplazar cámara hacia abajo",
  "Camera zoom in": "Acercar cámara",
  "Camera zoom out": "Alejar cámara",
  "Reset camera view": "Restablecer vista de cámara",
  "Edit object": "Editar objeto",
  "Organize": "Organizar",
  "Brush tools": "Herramientas de brushes",
  "Entity tools": "Herramientas de entidades",
  "History & cleanup": "Historial y limpieza",
  "Create": "Crear",
  "Viewport": "Visor",
  "Scene": "Escena",
  "Open properties": "Abrir propiedades",
  "Select same layer": "Seleccionar misma capa",
  "Isolate selection": "Aislar selección",
  "Show all objects": "Mostrar todos los objetos",
  "Select group": "Seleccionar grupo",
  "Group selection…": "Agrupar selección…",
  "Ungroup selection": "Desagrupar selección",
  "Change layer…": "Cambiar capa…",
  "Object mode": "Modo objeto",
  "Vertex mode": "Modo vértices",
  "Edge mode": "Modo aristas",
  "Face mode": "Modo caras",
  "Apply selected texture": "Aplicar textura seleccionada",
  "Save selection as prefab…": "Guardar selección como prefab…",
  "Create func_door": "Convertir en func_door",
  "Create func_button": "Convertir en func_button",
  "Select same classname": "Seleccionar mismo classname",
  "Find linked target": "Encontrar target vinculado",
  "No matching targetname found": "No se encontró un targetname coincidente",
  "Browse entities": "Explorar entidades",
  "Copy classname": "Copiar classname",
  "Add AI waypoint": "Agregar waypoint de IA",
  "Unlock all objects": "Desbloquear todos los objetos",
  "Copy texture name": "Copiar nombre de textura",
  "Copy WAD name": "Copiar nombre del WAD",
  "Apply texture": "Aplicar textura",
  "Add to favorites": "Agregar a favoritos",
  "Remove from favorites": "Quitar de favoritos",
  "Texture details": "Detalles de textura",
  "Add entity to map": "Añadir entidad al mapa",
  "Fly / Walk mode": "Modo vuelo / caminar",
  "Camera views": "Vistas de cámara",
  "Camera movement": "Movimiento de cámara",
  "Camera zoom": "Zoom de cámara"
});

Object.assign(ru,{
  "Back view": "Вид сзади",
  "Left view": "Вид слева",
  "Bottom view": "Вид снизу",
  "Isometric view": "Изометрический вид",
  "Orbit camera left": "Повернуть камеру влево",
  "Orbit camera right": "Повернуть камеру вправо",
  "Orbit camera up": "Поднять камеру",
  "Orbit camera down": "Опустить камеру",
  "Pan camera left": "Сдвинуть камеру влево",
  "Pan camera right": "Сдвинуть камеру вправо",
  "Pan camera up": "Сдвинуть камеру вверх",
  "Pan camera down": "Сдвинуть камеру вниз",
  "Camera zoom in": "Приблизить камеру",
  "Camera zoom out": "Отдалить камеру",
  "Reset camera view": "Сбросить вид камеры",
  "Edit object": "Правка объекта",
  "Organize": "Организация",
  "Brush tools": "Инструменты брашей",
  "Entity tools": "Инструменты сущностей",
  "History & cleanup": "История и очистка",
  "Create": "Создание",
  "Viewport": "Окно 3D",
  "Scene": "Сцена",
  "Open properties": "Открыть свойства",
  "Select same layer": "Выбрать тот же слой",
  "Isolate selection": "Изолировать выделение",
  "Show all objects": "Показать все объекты",
  "Select group": "Выбрать группу",
  "Group selection…": "Сгруппировать выделение…",
  "Ungroup selection": "Разгруппировать",
  "Change layer…": "Изменить слой…",
  "Object mode": "Режим объектов",
  "Vertex mode": "Режим вершин",
  "Edge mode": "Режим рёбер",
  "Face mode": "Режим граней",
  "Apply selected texture": "Применить текущую текстуру",
  "Save selection as prefab…": "Сохранить выделение как префаб…",
  "Create func_door": "Создать func_door",
  "Create func_button": "Создать func_button",
  "Select same classname": "Выбрать такие же классы",
  "Find linked target": "Найти связанную цель",
  "No matching targetname found": "Связанный targetname не найден",
  "Browse entities": "Открыть список сущностей",
  "Copy classname": "Копировать classname",
  "Add AI waypoint": "Добавить точку маршрута ИИ",
  "Unlock all objects": "Разблокировать все объекты",
  "Copy texture name": "Копировать имя текстуры",
  "Copy WAD name": "Копировать имя WAD",
  "Apply texture": "Применить текстуру",
  "Add to favorites": "В избранное",
  "Remove from favorites": "Убрать из избранного",
  "Texture details": "Сведения о текстуре",
  "Add entity to map": "Добавить сущность на карту",
  "Fly / Walk mode": "Режим полёта / ходьбы",
  "Camera views": "Виды камеры",
  "Camera movement": "Перемещение камеры",
  "Camera zoom": "Приближение камеры"
});

Object.assign(ko,{
  "Back view": "후면 보기",
  "Left view": "왼쪽 보기",
  "Bottom view": "아래 보기",
  "Isometric view": "등각 보기",
  "Orbit camera left": "카메라 왼쪽 회전",
  "Orbit camera right": "카메라 오른쪽 회전",
  "Orbit camera up": "카메라 위로 회전",
  "Orbit camera down": "카메라 아래로 회전",
  "Pan camera left": "카메라 왼쪽 이동",
  "Pan camera right": "카메라 오른쪽 이동",
  "Pan camera up": "카메라 위로 이동",
  "Pan camera down": "카메라 아래로 이동",
  "Camera zoom in": "카메라 확대",
  "Camera zoom out": "카메라 축소",
  "Reset camera view": "카메라 보기 초기화",
  "Edit object": "오브젝트 편집",
  "Organize": "정리",
  "Brush tools": "브러시 도구",
  "Entity tools": "엔티티 도구",
  "History & cleanup": "기록 및 정리",
  "Create": "생성",
  "Viewport": "뷰포트",
  "Scene": "장면",
  "Open properties": "속성 열기",
  "Select same layer": "같은 레이어 선택",
  "Isolate selection": "선택 항목만 표시",
  "Show all objects": "모든 오브젝트 표시",
  "Select group": "그룹 선택",
  "Group selection…": "선택 항목 그룹화…",
  "Ungroup selection": "그룹 해제",
  "Change layer…": "레이어 변경…",
  "Object mode": "오브젝트 모드",
  "Vertex mode": "정점 모드",
  "Edge mode": "모서리 모드",
  "Face mode": "면 모드",
  "Apply selected texture": "선택한 텍스처 적용",
  "Save selection as prefab…": "선택을 프리팹으로 저장…",
  "Create func_door": "func_door 만들기",
  "Create func_button": "func_button 만들기",
  "Select same classname": "같은 classname 선택",
  "Find linked target": "연결된 target 찾기",
  "No matching targetname found": "일치하는 targetname이 없습니다",
  "Browse entities": "엔티티 탐색",
  "Copy classname": "classname 복사",
  "Add AI waypoint": "AI 경유점 추가",
  "Unlock all objects": "모든 오브젝트 잠금 해제",
  "Copy texture name": "텍스처 이름 복사",
  "Copy WAD name": "WAD 이름 복사",
  "Apply texture": "텍스처 적용",
  "Add to favorites": "즐겨찾기에 추가",
  "Remove from favorites": "즐겨찾기에서 제거",
  "Texture details": "텍스처 정보",
  "Add entity to map": "맵에 엔티티 추가",
  "Fly / Walk mode": "비행 / 걷기 모드",
  "Camera views": "카메라 보기",
  "Camera movement": "카메라 이동",
  "Camera zoom": "카메라 확대/축소"
});

// v0.8.3 — update the built-in guide to match the expanded keyboard controls.
Object.assign(es,{
  'Help shortcuts':'G = mover; R = rotar; C = escalar; E = extruir cara; Ctrl+Z / Ctrl+Y = deshacer / rehacer; Ctrl+S = guardar. Num 1/3/7 = frontal/derecha/superior, Ctrl+Num 1/3/7 = trasera/izquierda/inferior, Num 0 = isométrica, Num 5 = ortográfica/perspectiva. Num 4/6/8/2 = orbitar, Ctrl+Num 4/6/8/2 = desplazar cámara, Num +/- = zoom y Shift+Inicio = restablecer. Todos pueden reasignarse en Controles. Clic derecho en brushes, entidades, texturas WAD y clases FGD para ver acciones contextuales.',
  'Help camera':'El visor ofrece controles estilo Blender o Clásico. Configurá sensibilidad, FOV, suavizado y vuelo en Controles de cámara y gizmo. Además del mouse, hay vistas frontal, derecha, superior, trasera, izquierda, inferior e isométrica; órbita, desplazamiento y zoom por teclado numérico. En pantallas bajas la barra flotante se compacta y se puede desplazar sin tapar los indicadores.'
});
Object.assign(ru,{
  'Help shortcuts':'G — перемещение, R — поворот, C — масштаб, E — выдавливание; Ctrl+Z/Y — отмена/повтор, Ctrl+S — сохранение. Num 1/3/7 — перед/справа/сверху, Ctrl+Num 1/3/7 — сзади/слева/снизу, Num 0 — изометрия, Num 5 — проекция. Num 4/6/8/2 — орбита, Ctrl+Num 4/6/8/2 — сдвиг, Num +/- — масштаб, Shift+Home — сброс. Все клавиши можно изменить в настройках. ПКМ на браше, сущности, текстуре WAD или классе FGD открывает контекстное меню.',
  'Help camera':'В редакторе доступны схемы навигации Blender и Classic. Чувствительность, угол обзора, сглаживание и полёт настраиваются в управлении. Дополнительные виды, вращение, перемещение и масштабирование доступны через цифровой блок. На небольших экранах плавающая панель уменьшается и прокручивается.'
});
Object.assign(ko,{
  'Help shortcuts':'G 이동, R 회전, C 크기, E 면 돌출, Ctrl+Z/Y 실행 취소/다시 실행, Ctrl+S 저장. Num 1/3/7 정면/오른쪽/위, Ctrl+Num 1/3/7 뒤/왼쪽/아래, Num 0 등각, Num 5 투영 전환. Num 4/6/8/2 궤도 회전, Ctrl+Num 4/6/8/2 화면 이동, Num +/- 확대/축소, Shift+Home 보기 초기화. 컨트롤에서 단축키를 변경할 수 있습니다. 브러시, 엔티티, WAD 텍스처 및 FGD 클래스에서 마우스 오른쪽 버튼으로 메뉴를 엽니다.',
  'Help camera':'Blender와 클래식 카메라 제어 방식을 지원합니다. 감도, FOV, 부드러운 움직임, 비행 설정은 카메라 컨트롤에서 조절합니다. 숫자 패드로 추가 보기, 회전, 이동, 확대/축소를 실행합니다. 화면 높이가 낮으면 플로팅 도구 막대가 작아지고 내부 스크롤을 지원합니다.'
});

// v0.8.4 floating toolbar manual scale
Object.assign(es,{'Adjust floating toolbar size':'Ajustar tamaño de la barra flotante','Floating toolbar size':'Tamaño de la barra flotante','Toolbar scale':'Escala de la barra','Reset size':'Restablecer tamaño','The size is saved automatically in this browser.':'El tamaño se guarda automáticamente en este navegador.'});
Object.assign(ru,{'Adjust floating toolbar size':'Изменить размер плавающей панели','Floating toolbar size':'Размер плавающей панели','Toolbar scale':'Масштаб панели','Reset size':'Сбросить размер','The size is saved automatically in this browser.':'Размер автоматически сохраняется в браузере.'});
Object.assign(ko,{'Adjust floating toolbar size':'플로팅 도구 모음 크기 조절','Floating toolbar size':'플로팅 도구 모음 크기','Toolbar scale':'도구 모음 배율','Reset size':'크기 초기화','The size is saved automatically in this browser.':'크기는 이 브라우저에 자동으로 저장됩니다.'});

// v0.8.5 — Visibility / compile output, UI-only (no changes to FGD keys).
Object.assign(es,{
  'Visibility manager':'Administrador de visibilidad','Hidden objects':'objetos ocultos','Only hidden objects are listed. Brushes remain outside the main Explorer.':'Solo se muestran los objetos ocultos. Los brushes siguen fuera del Explorador principal.',
  'Ghost mode':'Modo fantasma','On':'Activado','Off':'Desactivado','Show all':'Mostrar todo','Exit isolation':'Salir del aislamiento','Isolate selection':'Aislar selección',
  'Search ID, name or coordinates...':'Buscar ID, nombre o coordenadas...','Show and focus':'Mostrar y enfocar','No hidden objects':'No hay objetos ocultos','Load more':'Cargar más'
});
Object.assign(ru,{
  'Visibility manager':'Управление видимостью','Hidden objects':'скрытых объектов','Only hidden objects are listed. Brushes remain outside the main Explorer.':'Показаны только скрытые объекты. Браши не отображаются в основном списке.',
  'Ghost mode':'Режим призрака','On':'Вкл.','Off':'Выкл.','Show all':'Показать всё','Exit isolation':'Выйти из изоляции','Isolate selection':'Изолировать выделение',
  'Search ID, name or coordinates...':'Поиск по ID, имени или координатам...','Show and focus':'Показать и найти','No hidden objects':'Нет скрытых объектов','Load more':'Загрузить ещё'
});
Object.assign(ko,{
  'Visibility manager':'표시 관리자','Hidden objects':'숨긴 오브젝트','Only hidden objects are listed. Brushes remain outside the main Explorer.':'숨긴 오브젝트만 표시합니다. 브러시는 기본 탐색기에서 제외됩니다.',
  'Ghost mode':'고스트 모드','On':'켜짐','Off':'꺼짐','Show all':'모두 표시','Exit isolation':'격리 해제','Isolate selection':'선택 항목만 표시',
  'Search ID, name or coordinates...':'ID, 이름, 좌표 검색...','Show and focus':'표시하고 초점 맞추기','No hidden objects':'숨긴 오브젝트 없음','Load more':'더 보기'
});

// Quick Architecture v0.8.6 — localize user-facing tool names, preserve engine terminology.
Object.assign(es,{'Quick Architecture':'Arquitectura rápida','Build doors, windows and architectural details from GoldSrc-safe convex brushes.':'Creá puertas, ventanas y detalles arquitectónicos usando brushes convexos compatibles con GoldSrc.','Architecture door':'Puerta','Architecture window':'Ventana','Architecture frame':'Marco','Architecture arch':'Arco','Architecture stairs':'Escaleras','Architecture ramp':'Rampa','Architecture column':'Columna','Architecture room':'Habitación','Segments / steps':'Segmentos / escalones','Frame thickness':'Grosor del marco','Opening only (no frame)':'Solo abertura (sin marco)','Add separate door leaf brush':'Agregar hoja de puerta separada','Select an upright Box wall, then create a real through-hole.':'Seleccioná una pared Box vertical para crear una abertura real.','Creates an editable group of convex brushes near the selected object, or at the origin.':'Crea un grupo editable de brushes convexos junto al objeto seleccionado o en el origen.','Selected wall':'Pared seleccionada','None':'Ninguna','Create architecture':'Crear estructura','Undo: Ctrl+Z. Door leaves can be converted to func_door using the brush context menu.':'Deshacer: Ctrl+Z. Podés convertir la hoja de puerta en func_door desde el menú contextual.'});
Object.assign(ru,{'Quick Architecture':'Быстрая архитектура','Build doors, windows and architectural details from GoldSrc-safe convex brushes.':'Создавайте двери, окна и детали из выпуклых брашей GoldSrc.','Architecture door':'Дверь','Architecture window':'Окно','Architecture frame':'Рама','Architecture arch':'Арка','Architecture stairs':'Лестница','Architecture ramp':'Пандус','Architecture column':'Колонна','Architecture room':'Комната','Segments / steps':'Сегменты / ступени','Frame thickness':'Толщина рамы','Opening only (no frame)':'Только проём','Add separate door leaf brush':'Добавить полотно двери','Select an upright Box wall, then create a real through-hole.':'Выберите вертикальную стену Box для создания проёма.','Creates an editable group of convex brushes near the selected object, or at the origin.':'Создаёт группу выпуклых брашей рядом с выделением или в начале координат.','Selected wall':'Выбранная стена','None':'Нет','Create architecture':'Создать конструкцию','Undo: Ctrl+Z. Door leaves can be converted to func_door using the brush context menu.':'Отмена: Ctrl+Z. Полотно двери можно преобразовать в func_door через контекстное меню.'});
Object.assign(ko,{'Quick Architecture':'빠른 건축','Build doors, windows and architectural details from GoldSrc-safe convex brushes.':'GoldSrc 호환 볼록 브러시로 문, 창문, 건축 구조를 만듭니다.','Architecture door':'문','Architecture window':'창문','Architecture frame':'프레임','Architecture arch':'아치','Architecture stairs':'계단','Architecture ramp':'경사로','Architecture column':'기둥','Architecture room':'방','Segments / steps':'세그먼트 / 계단 수','Frame thickness':'프레임 두께','Opening only (no frame)':'개구부만 생성','Add separate door leaf brush':'문짝 브러시 추가','Select an upright Box wall, then create a real through-hole.':'수직 Box 벽을 선택해 실제 개구부를 만드세요.','Creates an editable group of convex brushes near the selected object, or at the origin.':'선택한 오브젝트 근처 또는 원점에 볼록 브러시 그룹을 만듭니다.','Selected wall':'선택한 벽','None':'없음','Create architecture':'구조 만들기','Undo: Ctrl+Z. Door leaves can be converted to func_door using the brush context menu.':'Ctrl+Z로 실행 취소. 문짝은 컨텍스트 메뉴에서 func_door로 변환할 수 있습니다.'});

// v0.8.7 — interactive architecture and safe brush merging.
Object.assign(es,{
'Point and place in 3D':'Apuntar y colocar en 3D',
'Cancel wall placement':'Cancelar colocación',
'Hover over an axis-aligned Box wall, click to position the opening. Change Width/Height before activating. Esc cancels.':'Apuntá a una pared Box alineada con los ejes. Hacé clic para colocar o arrastrá para definir ancho y alto. Esc cancela.',
'Smart Brush Merge':'Unión inteligente de brushes',
'Select multiple brushes using Shift+click. Smart Merge keeps the convex pieces; Merge into One works only if the union is convex.':'Seleccioná varios brushes con Shift+clic. Unión inteligente conserva las piezas convexas; Unir en uno funciona solo si la unión es convexa.',
'Smart Merge':'Unión inteligente','Merge into One':'Unir en uno','Unmerge':'Separar grupo',
'Selected parametric opening':'Abertura paramétrica seleccionada','Update selected opening':'Actualizar abertura seleccionada','Load opening dimensions':'Cargar medidas de la abertura'
});
Object.assign(ru,{
'Point and place in 3D':'Разместить в 3D','Cancel wall placement':'Отменить размещение',
'Hover over an axis-aligned Box wall, click to position the opening. Change Width/Height before activating. Esc cancels.':'Наведите на стену Box без поворота. Щёлкните для размещения или перетащите для размера. Esc отменяет.',
'Smart Brush Merge':'Умное объединение брашей','Select multiple brushes using Shift+click. Smart Merge keeps the convex pieces; Merge into One works only if the union is convex.':'Выберите несколько брашей с Shift. Умное объединение сохраняет выпуклые части; один браш возможен только при выпуклом результате.',
'Smart Merge':'Умное объединение','Merge into One':'Объединить в один','Unmerge':'Разъединить',
'Selected parametric opening':'Выбранный параметрический проём','Update selected opening':'Обновить проём','Load opening dimensions':'Загрузить размеры проёма'
});
Object.assign(ko,{
'Point and place in 3D':'3D에서 위치 지정','Cancel wall placement':'배치 취소',
'Hover over an axis-aligned Box wall, click to position the opening. Change Width/Height before activating. Esc cancels.':'회전하지 않은 Box 벽을 가리키고 클릭하거나 드래그하여 너비와 높이를 설정하세요. Esc 취소.',
'Smart Brush Merge':'스마트 브러시 병합','Select multiple brushes using Shift+click. Smart Merge keeps the convex pieces; Merge into One works only if the union is convex.':'Shift+클릭으로 여러 브러시를 선택하세요. 스마트 병합은 볼록한 조각을 유지하며 단일 병합은 결과가 볼록할 때만 가능합니다.',
'Smart Merge':'스마트 병합','Merge into One':'하나로 병합','Unmerge':'병합 해제',
'Selected parametric opening':'선택된 매개변수 개구부','Update selected opening':'개구부 업데이트','Load opening dimensions':'개구부 치수 불러오기'
});

Object.assign(es,{'Create func_wall':'Crear func_wall','Create func_door':'Crear func_door'});
Object.assign(ru,{'Create func_wall':'Создать func_wall','Create func_door':'Создать func_door'});
Object.assign(ko,{'Create func_wall':'func_wall 만들기','Create func_door':'func_door 만들기'});

// v0.8.8 — compiled BSP inspection (editor-only labels; BSP keyvalues are never translated).
Object.assign(es,{
  'BSP Viewer':'Visor BSP','MAP Editor':'Editor MAP','Open BSP':'Abrir BSP','Open .BSP (read-only)':'Abrir .BSP (solo lectura)',
  'Open compiled BSP':'Abrir BSP compilado','Unable to open BSP':'No se pudo abrir el BSP','Compiled BSP unavailable':'BSP compilado no disponible',
  'Compiled map':'Mapa compilado','Compiled lightmaps':'Iluminación compilada','Lightmaps':'Lightmaps','Wireframe':'Wireframe',
  'Reset camera':'Restablecer cámara','Fly WASD':'Vuelo WASD','Exit fly':'Salir de vuelo','Faces':'Caras',
  'Vertices':'Vértices','Models':'Modelos','Lightmapped faces':'Caras con lightmap','Textures':'Texturas','embedded':'incrustadas',
  'Import external WAD3':'Importar WAD3 externos','Loading WAD...':'Cargando WAD...','external textures need WAD files':'texturas externas requieren archivos WAD',
  'Entity inspector':'Inspector de entidades','Search entities...':'Buscar entidades...',
  'Read-only preview. Does not change the editable .MAP or .svenstudio.json project.':'Vista de solo lectura. No modifica el proyecto editable .MAP ni .svenstudio.json.',
  'Static geometry and first lightmap style only. No gameplay, collision simulation, animated models or dynamic engine effects.':'Solo geometría estática y el primer estilo de iluminación. Sin jugabilidad, simulación de colisiones, modelos animados ni efectos dinámicos del motor.',
  'Left mouse orbit · Right mouse pan · Wheel zoom · Fly for WASD':'Botón izquierdo: orbitar · Derecho: desplazar · Rueda: zoom · Vuelo para WASD',
  'WASD move · Mouse look · Shift fast · Ctrl slow · Q/E down/up · Esc exit':'WASD: mover · Mouse: mirar · Shift: rápido · Ctrl: lento · Q/E: abajo/arriba · Esc: salir'
});
Object.assign(ru,{
  'BSP Viewer':'Просмотр BSP','MAP Editor':'Редактор MAP','Open BSP':'Открыть BSP','Open .BSP (read-only)':'Открыть .BSP (только чтение)',
  'Open compiled BSP':'Открыть скомпилированный BSP','Unable to open BSP':'Не удалось открыть BSP','Compiled BSP unavailable':'BSP недоступен',
  'Compiled map':'Скомпилированная карта','Compiled lightmaps':'Скомпилированное освещение','Lightmaps':'Карты освещения',
  'Wireframe':'Каркас','Reset camera':'Сброс камеры','Fly WASD':'Полёт WASD','Exit fly':'Выйти из полёта',
  'Faces':'Грани','Vertices':'Вершины','Models':'Модели','Lightmapped faces':'Грани с освещением','Textures':'Текстуры','embedded':'встроено',
  'Import external WAD3':'Импорт внешних WAD3','Loading WAD...':'Загрузка WAD...','external textures need WAD files':'внешних текстур требуют WAD',
  'Entity inspector':'Инспектор сущностей','Search entities...':'Поиск сущностей...',
  'Read-only preview. Does not change the editable .MAP or .svenstudio.json project.':'Просмотр только для чтения, не меняет .MAP или .svenstudio.json.',
  'Static geometry and first lightmap style only. No gameplay, collision simulation, animated models or dynamic engine effects.':'Только статическая геометрия и первый стиль освещения, без симуляции игры и динамических эффектов.',
  'Left mouse orbit · Right mouse pan · Wheel zoom · Fly for WASD':'ЛКМ: орбита · ПКМ: сдвиг · Колёсико: масштаб · Полёт: WASD',
  'WASD move · Mouse look · Shift fast · Ctrl slow · Q/E down/up · Esc exit':'WASD: движение · Мышь: обзор · Shift: быстро · Ctrl: медленно · Q/E: вниз/вверх · Esc: выход'
});
Object.assign(ko,{
  'BSP Viewer':'BSP 뷰어','MAP Editor':'MAP 편집기','Open BSP':'BSP 열기','Open .BSP (read-only)':'.BSP 열기 (읽기 전용)',
  'Open compiled BSP':'컴파일된 BSP 열기','Unable to open BSP':'BSP 열기 실패','Compiled BSP unavailable':'컴파일 BSP 사용 불가',
  'Compiled map':'컴파일된 맵','Compiled lightmaps':'컴파일 라이트맵','Lightmaps':'라이트맵','Wireframe':'와이어프레임',
  'Reset camera':'카메라 초기화','Fly WASD':'WASD 비행','Exit fly':'비행 종료','Faces':'면','Vertices':'정점',
  'Models':'모델','Lightmapped faces':'라이트맵 면','Textures':'텍스처','embedded':'내장',
  'Import external WAD3':'외부 WAD3 가져오기','Loading WAD...':'WAD 로딩 중...','external textures need WAD files':'개의 외부 텍스처에 WAD 파일 필요',
  'Entity inspector':'엔티티 검사기','Search entities...':'엔티티 검색...',
  'Read-only preview. Does not change the editable .MAP or .svenstudio.json project.':'읽기 전용 미리보기입니다. .MAP 및 .svenstudio.json 프로젝트는 변경되지 않습니다.',
  'Static geometry and first lightmap style only. No gameplay, collision simulation, animated models or dynamic engine effects.':'정적 지오메트리와 첫 번째 라이트맵 스타일만 지원합니다. 게임플레이 또는 동적 효과는 포함되지 않습니다.',
  'Left mouse orbit · Right mouse pan · Wheel zoom · Fly for WASD':'왼쪽 클릭 회전 · 오른쪽 클릭 이동 · 휠 확대/축소 · WASD 비행',
  'WASD move · Mouse look · Shift fast · Ctrl slow · Q/E down/up · Esc exit':'WASD 이동 · 마우스 보기 · Shift 빠르게 · Ctrl 느리게 · Q/E 상하 · Esc 종료'
});

Object.assign(es,{"Compiled BSP":"BSP compilado"});
Object.assign(ru,{"Compiled BSP":"Скомпилированный BSP"});
Object.assign(ko,{"Compiled BSP":"컴파일된 BSP"});

// v0.8.8.1 — BSP fly camera and entity labels. Classnames / targetnames remain untranslated.
Object.assign(es,{
  'Entity labels':'Nombres de entidades','Fly settings':'Ajustes de vuelo','Fly camera controls':'Controles de cámara libre',
  'Movement speed':'Velocidad de movimiento','Mouse sensitivity':'Sensibilidad del mouse','Smooth movement':'Movimiento suavizado',
  'Mouse wheel changes fly speed':'La rueda modifica la velocidad de vuelo',
  'Focus selected entity':'Enfocar entidad seleccionada','Double-click to focus entity':'Doble clic para enfocar la entidad',
  'Pointer lock blocked. Click the viewer and try again.':'El navegador bloqueó la captura del mouse. Hacé clic en el visor y volvé a intentar.'
});
Object.assign(ru,{
  'Entity labels':'Названия сущностей','Fly settings':'Настройки полёта','Fly camera controls':'Управление свободной камерой',
  'Movement speed':'Скорость движения','Mouse sensitivity':'Чувствительность мыши','Smooth movement':'Плавное движение',
  'Mouse wheel changes fly speed':'Колесо мыши меняет скорость полёта',
  'Focus selected entity':'Перейти к сущности','Double-click to focus entity':'Двойной щелчок — перейти к сущности',
  'Pointer lock blocked. Click the viewer and try again.':'Захват указателя заблокирован. Нажмите на окно просмотра и повторите.'
});
Object.assign(ko,{
  'Entity labels':'엔티티 이름','Fly settings':'비행 설정','Fly camera controls':'자유 카메라 조작',
  'Movement speed':'이동 속도','Mouse sensitivity':'마우스 감도','Smooth movement':'부드러운 이동',
  'Mouse wheel changes fly speed':'휠로 비행 속도 변경',
  'Focus selected entity':'선택한 엔티티로 이동','Double-click to focus entity':'더블 클릭하여 엔티티에 초점 맞추기',
  'Pointer lock blocked. Click the viewer and try again.':'마우스 캡처가 차단되었습니다. 뷰어를 클릭한 뒤 다시 시도하세요.'
});


// v0.8.9 — BSP Viewer 2.0. The engine classnames and model filenames stay in English.
Object.assign(es,{
  'Real skybox':'Cielo real','Use installed sky textures':'Usar las seis texturas del cielo instaladas',
  'MDL models':'Modelos MDL','Static model previews':'Modelos MDL estáticos (sin animaciones)',
  'off':'Desactivado','no-game':'Sin ruta del juego','none':'No disponible','loading':'Cargando',
  'ready':'Listo','missing':'Incompleto','error':'Error',
  'Configure the Sven Co-op game directory to preview installed skyboxes.':'Configurá la carpeta de Sven Co-op para mostrar los cielos instalados.',
  'The six skybox textures were not found for this skyname.':'No se encontraron las seis imágenes del skyname configurado.',
  'Could not load the installed skybox textures.':'No se pudieron cargar las imágenes del cielo instalado.',
  'Configure the Sven Co-op game directory to load MDL models.':'Configurá la carpeta de Sven Co-op para cargar modelos MDL.',
  'Some MDL assets are unavailable or unsupported.':'Algunos modelos MDL no se encontraron o no son compatibles.',
  'BSP Viewer 2.0 uses the installed six-face skybox and optional static MDL bind poses. No gameplay, collision simulation, animations or dynamic engine effects.':'BSP Viewer 2.0 muestra los seis lados del cielo instalado y modelos MDL estáticos opcionales. No simula jugabilidad, colisiones, animaciones ni efectos dinámicos del motor.'
});
Object.assign(ru,{
  'Real skybox':'Настоящее небо','Use installed sky textures':'Использовать установленные текстуры неба',
  'MDL models':'Модели MDL','Static model previews':'Статические модели MDL без анимации',
  'off':'Отключено','no-game':'Путь к игре не задан','none':'Нет','loading':'Загрузка',
  'ready':'Готово','missing':'Не все файлы найдены','error':'Ошибка',
  'Configure the Sven Co-op game directory to preview installed skyboxes.':'Укажите папку Sven Co-op для загрузки неба.',
  'The six skybox textures were not found for this skyname.':'Не найдены все шесть текстур для этого skyname.',
  'Could not load the installed skybox textures.':'Не удалось загрузить текстуры неба.',
  'Configure the Sven Co-op game directory to load MDL models.':'Укажите папку Sven Co-op для загрузки моделей MDL.',
  'Some MDL assets are unavailable or unsupported.':'Некоторые модели MDL недоступны или не поддерживаются.',
  'BSP Viewer 2.0 uses the installed six-face skybox and optional static MDL bind poses. No gameplay, collision simulation, animations or dynamic engine effects.':'BSP Viewer 2.0 отображает шесть граней неба и статические модели MDL. Игровая логика, столкновения, анимация и динамические эффекты не симулируются.'
});
Object.assign(ko,{
  'Real skybox':'실제 스카이박스','Use installed sky textures':'설치된 하늘 텍스처 사용',
  'MDL models':'MDL 모델','Static model previews':'애니메이션 없는 정적 MDL 모델',
  'off':'꺼짐','no-game':'게임 폴더 미설정','none':'없음','loading':'불러오는 중',
  'ready':'준비됨','missing':'일부 누락','error':'오류',
  'Configure the Sven Co-op game directory to preview installed skyboxes.':'설치된 하늘을 보려면 Sven Co-op 폴더를 설정하세요.',
  'The six skybox textures were not found for this skyname.':'설정된 skyname의 하늘 이미지 6개를 찾지 못했습니다.',
  'Could not load the installed skybox textures.':'하늘 텍스처를 불러올 수 없습니다.',
  'Configure the Sven Co-op game directory to load MDL models.':'MDL을 불러오려면 Sven Co-op 폴더를 설정하세요.',
  'Some MDL assets are unavailable or unsupported.':'일부 MDL 리소스가 없거나 지원되지 않습니다.',
  'BSP Viewer 2.0 uses the installed six-face skybox and optional static MDL bind poses. No gameplay, collision simulation, animations or dynamic engine effects.':'BSP Viewer 2.0은 6면 스카이박스와 선택적 정적 MDL 모델을 표시합니다. 게임 플레이, 충돌, 애니메이션 및 동적 엔진 효과는 재현하지 않습니다.'
});

Object.assign(es,{'Lightmap brightness':'Brillo de lightmaps'});
Object.assign(ru,{'Lightmap brightness':'Яркость карт освещения'});
Object.assign(ko,{'Lightmap brightness':'라이트맵 밝기'});

// v0.8.9.1 — BSP lightmap UV channel and readable lighting controls.
Object.assign(es,{
  'Lightmap intensity':'Intensidad de lightmaps',
  'Ambient fill':'Luz ambiental adicional',
  'Reset lighting':'Restablecer iluminación',
  'BSP lighting preview is approximate; dynamic lightstyles are not simulated.':'La iluminación del BSP es aproximada; no se simulan los estilos de luz dinámicos.'
});
Object.assign(ru,{
  'Lightmap intensity':'Интенсивность карт освещения',
  'Ambient fill':'Дополнительный окружающий свет',
  'Reset lighting':'Сбросить освещение',
  'BSP lighting preview is approximate; dynamic lightstyles are not simulated.':'Освещение BSP приблизительное; динамические стили света не воспроизводятся.'
});
Object.assign(ko,{
  'Lightmap intensity':'라이트맵 강도',
  'Ambient fill':'보조 주변광',
  'Reset lighting':'조명 초기화',
  'BSP lighting preview is approximate; dynamic lightstyles are not simulated.':'BSP 조명은 근사치이며 동적 라이트 스타일은 재현되지 않습니다.'
});

// v0.8.9.3 — BSP Viewer 2.1: local WAD lookups and adaptive entity labels.
Object.assign(es,{
  'Automatic WAD textures':'Texturas WAD automáticas',
  'Searching installed WADs...':'Buscando en los WAD instalados...',
  'Configure the game folder for automatic WAD loading.':'Configurá la carpeta del juego para cargar los WAD automáticamente.',
  'Automatic WAD lookup failed.':'Falló la búsqueda automática de WAD.',
  'Automatic WAD scan finished.':'Búsqueda automática de WAD terminada.',
  'Automatic WAD lookup idle.':'Búsqueda automática de WAD en espera.',
  'textures loaded':'texturas cargadas','WAD files scanned':'archivos WAD examinados',
  'Rescan WADs':'Volver a buscar WAD',
  'Avoid overlapping labels':'Evitar superposición de nombres',
  'Maximum labels':'Máximo de nombres','Label distance':'Distancia de nombres',
  'Selected entities and player spawns receive label priority.':'Se priorizan la entidad seleccionada y los puntos de aparición de jugadores.'
});
Object.assign(ru,{
  'Automatic WAD textures':'Автозагрузка текстур WAD',
  'Searching installed WADs...':'Поиск установленных WAD...',
  'Configure the game folder for automatic WAD loading.':'Укажите папку игры для автоматической загрузки WAD.',
  'Automatic WAD lookup failed.':'Ошибка автоматического поиска WAD.',
  'Automatic WAD scan finished.':'Поиск WAD завершён.',
  'Automatic WAD lookup idle.':'Автопоиск WAD ожидает.',
  'textures loaded':'текстур загружено','WAD files scanned':'файлов WAD проверено',
  'Rescan WADs':'Повторить поиск WAD',
  'Avoid overlapping labels':'Избегать наложения названий',
  'Maximum labels':'Максимум названий','Label distance':'Дистанция названий',
  'Selected entities and player spawns receive label priority.':'Выбранные сущности и точки появления игроков имеют приоритет.'
});
Object.assign(ko,{
  'Automatic WAD textures':'WAD 텍스처 자동 불러오기',
  'Searching installed WADs...':'설치된 WAD 검색 중...',
  'Configure the game folder for automatic WAD loading.':'WAD 자동 로드를 위해 게임 폴더를 설정하세요.',
  'Automatic WAD lookup failed.':'WAD 자동 검색 실패.',
  'Automatic WAD scan finished.':'WAD 자동 검색 완료.',
  'Automatic WAD lookup idle.':'WAD 자동 검색 대기 중.',
  'textures loaded':'개 텍스처 로드됨','WAD files scanned':'개 WAD 파일 검사됨',
  'Rescan WADs':'WAD 다시 검색',
  'Avoid overlapping labels':'이름 겹침 방지',
  'Maximum labels':'최대 이름 수','Label distance':'이름 표시 거리',
  'Selected entities and player spawns receive label priority.':'선택한 엔티티와 플레이어 시작 지점 이름이 우선 표시됩니다.'
});

// v0.8.9.4 — Paged WAD3 scan progress and accurate safety messages.
Object.assign(es,{
  'batches':'lotes',
  'Some WAD files could not be checked within the safety limits. You can import them manually.':'No se pudieron revisar todos los WAD dentro de los límites de seguridad. Podés importar los restantes manualmente.'
});
Object.assign(ru,{
  'batches':'пакетов',
  'Some WAD files could not be checked within the safety limits. You can import them manually.':'Не все WAD проверены из-за ограничений безопасности. Оставшиеся WAD можно импортировать вручную.'
});
Object.assign(ko,{
  'batches':'배치',
  'Some WAD files could not be checked within the safety limits. You can import them manually.':'보안 제한으로 일부 WAD 파일을 확인할 수 없습니다. 나머지는 수동으로 가져올 수 있습니다.'
});

// v0.8.9.5 — Transform UX, world-grid and brush-local scale anchors.
Object.assign(es,{
  'Scale pivot':'Ancla de escala','Scale pivot description':'Elegí qué cara debe quedar fija al escalar',
  'Scale from center':'Desde el centro','Keep left (X-)':'Fijar izquierda (X−)',
  'Keep right (X+)':'Fijar derecha (X+)','Keep back (Y-)':'Fijar atrás (Y−)',
  'Keep front (Y+)':'Fijar frente (Y+)','Keep bottom (Z-)':'Fijar abajo (Z−)',
  'Keep top (Z+)':'Fijar arriba (Z+)',
  'Scaling keeps the selected face in place. Choose Center for symmetric scaling.':'La cara elegida queda fija. Seleccioná Centro para escalar hacia ambos lados.'
});
Object.assign(ru,{
  'Scale pivot':'Опора масштаба','Scale pivot description':'Укажите грань, которая останется на месте',
  'Scale from center':'От центра','Keep left (X-)':'Фиксировать слева (X−)',
  'Keep right (X+)':'Фиксировать справа (X+)','Keep back (Y-)':'Фиксировать сзади (Y−)',
  'Keep front (Y+)':'Фиксировать спереди (Y+)','Keep bottom (Z-)':'Фиксировать снизу (Z−)',
  'Keep top (Z+)':'Фиксировать сверху (Z+)',
  'Scaling keeps the selected face in place. Choose Center for symmetric scaling.':'Выбранная грань остаётся на месте. Для симметричного изменения выберите Центр.'
});
Object.assign(ko,{
  'Scale pivot':'크기 조절 기준점','Scale pivot description':'고정할 면을 선택하세요',
  'Scale from center':'중앙 기준','Keep left (X-)':'왼쪽 고정 (X−)',
  'Keep right (X+)':'오른쪽 고정 (X+)','Keep back (Y-)':'뒤쪽 고정 (Y−)',
  'Keep front (Y+)':'앞쪽 고정 (Y+)','Keep bottom (Z-)':'아래쪽 고정 (Z−)',
  'Keep top (Z+)':'위쪽 고정 (Z+)',
  'Scaling keeps the selected face in place. Choose Center for symmetric scaling.':'선택한 면을 고정합니다. 대칭 확대는 중앙 기준을 선택하세요.'
});

// v0.8.9.7 — Modifier-assisted G/R/C editing. These are editor commands only.
Object.assign(es,{
  'Mouse transform modifiers':'Modificadores de transformación con mouse',
  'While G/R/C is active: Shift = fine control · Ctrl = snap · Alt = alternative transform. X/Y/Z lock an axis; left click or Enter confirms; Esc cancels.':'Durante G/R/C: Shift = precisión · Ctrl = ajuste por pasos · Alt = alternativa. X/Y/Z bloquean un eje; clic izquierdo o Enter confirma; Esc cancela.',
  'Shift precision':'Precisión con Shift',
  'Ctrl rotation step (degrees)':'Incremento de giro con Ctrl (grados)',
  'Ctrl scale step':'Incremento de escala con Ctrl',
  'Alt + mouse: Move = world height (Z), Rotate = two-axis trackball, Scale = temporarily use center pivot. Ctrl works with the gizmo too.':'Alt + mouse: Mover = altura global (Z); Rotar = giro libre en dos ejes; Escalar = centro temporal. Ctrl también ajusta el gizmo.',
  'Shift + mouse: fine · Ctrl + mouse: snap · Alt + mouse: alternate · X/Y/Z: axis · Enter/click: confirm · Esc: cancel':'Shift + mouse: fino · Ctrl + mouse: snap · Alt + mouse: alternativa · X/Y/Z: eje · Enter/clic: confirmar · Esc: cancelar',
  'Fine':'Preciso','Vertical move (Z)':'Movimiento vertical (Z)',
  'Trackball rotation':'Rotación libre en dos ejes','Center scale':'Escalado desde el centro',
  'Normal drag':'Movimiento normal'
});
Object.assign(ru,{
  'Mouse transform modifiers':'Модификаторы перемещения мышью',
  'While G/R/C is active: Shift = fine control · Ctrl = snap · Alt = alternative transform. X/Y/Z lock an axis; left click or Enter confirms; Esc cancels.':'В режиме G/R/C: Shift — точность, Ctrl — привязка, Alt — альтернативное действие. X/Y/Z — ось, ЛКМ/Enter — подтвердить, Esc — отменить.',
  'Shift precision':'Точность Shift',
  'Ctrl rotation step (degrees)':'Шаг поворота Ctrl (градусы)',
  'Ctrl scale step':'Шаг масштаба Ctrl',
  'Alt + mouse: Move = world height (Z), Rotate = two-axis trackball, Scale = temporarily use center pivot. Ctrl works with the gizmo too.':'Alt + мышь: перемещение по высоте Z, поворот по двум осям, масштаб от центра. Ctrl также работает с гизмо.',
  'Shift + mouse: fine · Ctrl + mouse: snap · Alt + mouse: alternate · X/Y/Z: axis · Enter/click: confirm · Esc: cancel':'Shift + мышь: точно · Ctrl + мышь: привязка · Alt + мышь: другой режим · X/Y/Z: ось · Enter/ЛКМ: подтвердить · Esc: отменить',
  'Fine':'Точно','Vertical move (Z)':'Вертикально (Z)',
  'Trackball rotation':'Свободный поворот по двум осям','Center scale':'Масштаб от центра',
  'Normal drag':'Обычное движение'
});
Object.assign(ko,{
  'Mouse transform modifiers':'마우스 변형 보조키',
  'While G/R/C is active: Shift = fine control · Ctrl = snap · Alt = alternative transform. X/Y/Z lock an axis; left click or Enter confirms; Esc cancels.':'G/R/C 중 Shift = 정밀 조작 · Ctrl = 스냅 · Alt = 대체 조작. X/Y/Z로 축 고정, 왼쪽 클릭/Enter로 확정, Esc로 취소합니다.',
  'Shift precision':'Shift 정밀도',
  'Ctrl rotation step (degrees)':'Ctrl 회전 간격 (도)',
  'Ctrl scale step':'Ctrl 크기 간격',
  'Alt + mouse: Move = world height (Z), Rotate = two-axis trackball, Scale = temporarily use center pivot. Ctrl works with the gizmo too.':'Alt + 마우스: 이동은 월드 Z, 회전은 2축 자유 회전, 크기 조절은 임시 중앙 기준. Ctrl은 기즈모에서도 작동합니다.',
  'Shift + mouse: fine · Ctrl + mouse: snap · Alt + mouse: alternate · X/Y/Z: axis · Enter/click: confirm · Esc: cancel':'Shift + 마우스: 정밀 · Ctrl + 마우스: 스냅 · Alt + 마우스: 대체 · X/Y/Z: 축 · Enter/클릭: 확정 · Esc: 취소',
  'Fine':'정밀','Vertical move (Z)':'수직 이동 (Z)',
  'Trackball rotation':'2축 자유 회전','Center scale':'중앙 기준 크기 조절',
  'Normal drag':'일반 이동'
});

// v0.8.9.8 — Customizable viewport HUD. Only editor UI text is translated.
Object.assign(es,{
  'Customize viewport HUD':'Personalizar HUD del visor','Edit HUD':'Editar HUD','HUD layout':'Distribución HUD',
  'Default HUD':'HUD predeterminado','Compact HUD':'HUD compacto','Minimal HUD':'HUD minimalista','Custom HUD':'HUD personalizado',
  'HUD element':'Elemento del HUD','Move HUD element':'Mover elemento HUD','Resize HUD element':'Redimensionar elemento HUD',
  'Drag to move':'Arrastrar para mover','Drag to resize':'Arrastrar para cambiar tamaño',
  'Element size':'Tamaño del elemento','Element opacity':'Opacidad del elemento','Overall HUD opacity':'Opacidad general del HUD',
  'Reset element':'Restablecer elemento','Reset HUD':'Restablecer HUD','Visible':'Visible','Hidden':'Oculto',
  'Drag the handles to move HUD groups. Drag the corner to resize. Changes are saved automatically.':'Arrastrá el asa para mover cada grupo del HUD y la esquina para cambiar su tamaño. Se guarda automáticamente.',
  'Viewport status':'Estado del visor','View controls':'Controles de vista','Floating tools':'Herramientas flotantes',
  'Gizmo button':'Botón del gizmo','Orthographic tools':'Herramientas ortográficas','Mouse help':'Ayuda del mouse',
  'Scene statistics':'Estadísticas de escena','Transform readout':'Indicador de transformación',
  'Editor messages':'Mensajes del editor','Axis navigator':'Navegador de ejes','Measure distance':'Medir distancia',
  'Click second point':'Clic en el segundo punto','Click first point':'Clic en el primer punto'
});
Object.assign(ru,{
  'Customize viewport HUD':'Настройка интерфейса окна 3D','Edit HUD':'Редактировать HUD','HUD layout':'Макет HUD',
  'Default HUD':'Стандартный HUD','Compact HUD':'Компактный HUD','Minimal HUD':'Минимальный HUD','Custom HUD':'Мой HUD',
  'HUD element':'Элемент HUD','Move HUD element':'Переместить элемент HUD','Resize HUD element':'Изменить размер элемента HUD',
  'Drag to move':'Перетащить','Drag to resize':'Потяните для изменения размера',
  'Element size':'Размер элемента','Element opacity':'Прозрачность элемента','Overall HUD opacity':'Общая прозрачность HUD',
  'Reset element':'Сбросить элемент','Reset HUD':'Сбросить HUD','Visible':'Видимый','Hidden':'Скрыт',
  'Drag the handles to move HUD groups. Drag the corner to resize. Changes are saved automatically.':'Перетаскивайте группы за ручку, меняйте размер за угол. Изменения сохраняются автоматически.',
  'Viewport status':'Состояние окна','View controls':'Кнопки вида','Floating tools':'Плавающие инструменты',
  'Gizmo button':'Кнопка гизмо','Orthographic tools':'Ортографические инструменты','Mouse help':'Подсказка мыши',
  'Scene statistics':'Статистика сцены','Transform readout':'Показатели преобразования',
  'Editor messages':'Сообщения редактора','Axis navigator':'Навигатор осей','Measure distance':'Измерить расстояние',
  'Click second point':'Укажите вторую точку','Click first point':'Укажите первую точку'
});
Object.assign(ko,{
  'Customize viewport HUD':'뷰포트 HUD 사용자 지정','Edit HUD':'HUD 편집','HUD layout':'HUD 배치',
  'Default HUD':'기본 HUD','Compact HUD':'컴팩트 HUD','Minimal HUD':'최소 HUD','Custom HUD':'사용자 HUD',
  'HUD element':'HUD 요소','Move HUD element':'HUD 요소 이동','Resize HUD element':'HUD 요소 크기 변경',
  'Drag to move':'드래그하여 이동','Drag to resize':'드래그하여 크기 변경',
  'Element size':'요소 크기','Element opacity':'요소 불투명도','Overall HUD opacity':'전체 HUD 불투명도',
  'Reset element':'요소 초기화','Reset HUD':'HUD 초기화','Visible':'표시','Hidden':'숨김',
  'Drag the handles to move HUD groups. Drag the corner to resize. Changes are saved automatically.':'손잡이를 드래그해 HUD 그룹을 이동하고 모서리를 드래그해 크기를 조정하세요. 변경 내용은 자동 저장됩니다.',
  'Viewport status':'뷰포트 상태','View controls':'뷰 컨트롤','Floating tools':'플로팅 도구',
  'Gizmo button':'기즈모 버튼','Orthographic tools':'직교 뷰 도구','Mouse help':'마우스 도움말',
  'Scene statistics':'장면 통계','Transform readout':'변형 정보',
  'Editor messages':'편집기 메시지','Axis navigator':'축 탐색기','Measure distance':'거리 측정',
  'Click second point':'두 번째 지점 클릭','Click first point':'첫 번째 지점 클릭'
});

// v0.8.9.11 — Complete remaining direct UI strings in ES/RU/KO.
// Engine identifiers (targetname, spawnflags, classname, WAD / FGD) remain unchanged.
Object.assign(es,{
  'Lightmaps':'Mapas de luz','Prefabs':'Prefabricados','Audio Studio':'Estudio de audio'
});
Object.assign(ru,{
  'Preset selected. Create a sun light to apply it. Sky textures are not generated automatically.':'Пресет выбран. Создайте солнечный источник света, чтобы применить его. Текстуры неба не создаются автоматически.',
  'created':'создано',
  'Select an environment entity first.':'Сначала выберите сущность окружения.',
  'Select the matching entity type to edit.':'Выберите соответствующий тип сущности для редактирования.',
  'Use a valid sky prefix (letters, numbers, dash, underscore).':'Введите корректный префикс неба (буквы, цифры, дефис или подчёркивание).',
  'Sky prefix saved. SKY-textured faces are required in the game.':'Префикс неба сохранён. В игре нужны грани с текстурой SKY.',
  'Light color and brightness are exported through _light.':'Цвет и яркость света записываются в параметр _light.',
  'Use Gameplay Studio to trigger this entity. A static sky is set on worldspawn.':'Используйте Gameplay Studio для активации этой сущности. Статичное небо задаётся в worldspawn.',
  'Incomplete sky set: one or more of the six faces are missing.':'Набор текстур неба неполный: отсутствует одна или несколько из шести сторон.',
  'Enter a sky prefix installed under gfx/env; six sky faces are required.':'Укажите префикс неба из gfx/env; нужны все шесть текстур неба.'
});
Object.assign(ko,{
  'Preset selected. Create a sun light to apply it. Sky textures are not generated automatically.':'프리셋이 선택되었습니다. 적용하려면 태양광 조명을 만드세요. 하늘 텍스처는 자동으로 생성되지 않습니다.',
  'created':'생성됨',
  'Select an environment entity first.':'먼저 환경 엔티티를 선택하세요.',
  'Select the matching entity type to edit.':'수정할 엔티티 유형을 선택하세요.',
  'Use a valid sky prefix (letters, numbers, dash, underscore).':'올바른 하늘 이름 접두사를 입력하세요(영문자, 숫자, 하이픈, 밑줄).',
  'Sky prefix saved. SKY-textured faces are required in the game.':'하늘 이름이 저장되었습니다. 게임에서는 SKY 텍스처가 적용된 면이 필요합니다.',
  'Light color and brightness are exported through _light.':'조명 색상과 밝기는 _light 속성으로 내보냅니다.',
  'Use Gameplay Studio to trigger this entity. A static sky is set on worldspawn.':'이 엔티티는 Gameplay Studio로 활성화하세요. 정적 하늘은 worldspawn에서 설정합니다.',
  'Incomplete sky set: one or more of the six faces are missing.':'하늘 텍스처가 불완전합니다. 여섯 방향 중 하나 이상이 누락되었습니다.',
  'Enter a sky prefix installed under gfx/env; six sky faces are required.':'gfx/env에 설치된 하늘 이름 접두사를 입력하세요. 여섯 방향의 텍스처가 모두 필요합니다.'
});

// v0.8.9.12 — Sky enclosure builder. GoldSrc classnames and SKY texture stay untranslated.
Object.assign(es,{
  'Create Sky Enclosure':'Crear envolvente SKY',
  'Regenerate Sky Enclosure':'Regenerar envolvente SKY',
  'Generate six separate SKY-textured world brushes around the current map. The interior stays empty; keep the windows and roof openings you built.':'Genera seis brushes de mundo separados con textura SKY alrededor del mapa. El interior queda vacío y podés conservar ventanas y aberturas del techo.',
  'Sky margin (units)':'Margen del cielo (unidades)',
  'Sky wall thickness (units)':'Grosor de los muros SKY (unidades)',
  'Sky grid (units)':'Grilla SKY (unidades)',
  'Hide enclosure in editor (still compiles)':'Ocultar la envolvente en el editor (se compila igual)',
  'Check sky enclosure settings':'Revisá los ajustes de la envolvente SKY',
  'Six SKY brushes will surround the map without filling the interior.':'Seis brushes SKY rodearán el mapa sin ocupar el interior.',
  'Existing auto sky brushes will be replaced':'Se reemplazarán los brushes SKY automáticos anteriores',
  'Sky enclosure generated. The interior is empty; the six SKY brushes are exported even when hidden in the editor.':'Envolvente SKY generada. El interior queda vacío y los seis brushes SKY se exportan aunque estén ocultos en el editor.',
  'Sky enclosure could not be generated':'No se pudo generar la envolvente SKY',
  'SKY must form a sealed outer shell. This tool does not fix leaks inside your own geometry or simulate light_environment; compile to verify.':'La envolvente SKY debe sellar el exterior. Esta herramienta no corrige fugas internas ni simula light_environment; compilá para comprobar.',
  'Remove the large solid SKY cube first; it still occupies the playable space.':'Primero eliminá el cubo SKY macizo: todavía ocupa el espacio jugable.',
  'Create at least one world brush before generating a sky enclosure.':'Creá al menos un brush de mundo antes de generar la envolvente SKY.',
  'Invalid map coordinates.':'Coordenadas inválidas del mapa.',
  'The sky enclosure would exceed a safe GoldSrc map extent. Reduce the margin or move distant objects.':'La envolvente SKY superaría el tamaño seguro del mapa GoldSrc. Reducí el margen o acercá los objetos lejanos.'
});
Object.assign(ru,{
  'Create Sky Enclosure':'Создать небесную оболочку',
  'Regenerate Sky Enclosure':'Пересоздать небесную оболочку',
  'Generate six separate SKY-textured world brushes around the current map. The interior stays empty; keep the windows and roof openings you built.':'Создаёт шесть отдельных мировых брашей с текстурой SKY вокруг карты. Внутри остаётся пустое пространство; окна и проёмы крыши сохраняются.',
  'Sky margin (units)':'Отступ оболочки (ед.)',
  'Sky wall thickness (units)':'Толщина стен SKY (ед.)',
  'Sky grid (units)':'Шаг сетки SKY (ед.)',
  'Hide enclosure in editor (still compiles)':'Скрыть оболочку в редакторе (в компиляции участвует)',
  'Check sky enclosure settings':'Проверьте параметры небесной оболочки',
  'Six SKY brushes will surround the map without filling the interior.':'Шесть брашей SKY окружат карту, не заполняя внутреннее пространство.',
  'Existing auto sky brushes will be replaced':'Предыдущие автоматически созданные браши SKY будут заменены',
  'Sky enclosure generated. The interior is empty; the six SKY brushes are exported even when hidden in the editor.':'Небесная оболочка создана. Внутри пусто; шесть брашей SKY экспортируются, даже если они скрыты в редакторе.',
  'Sky enclosure could not be generated':'Не удалось создать небесную оболочку',
  'SKY must form a sealed outer shell. This tool does not fix leaks inside your own geometry or simulate light_environment; compile to verify.':'Внешняя оболочка SKY должна быть герметичной. Инструмент не исправляет внутренние утечки и не имитирует light_environment; проверьте компиляцией.',
  'Remove the large solid SKY cube first; it still occupies the playable space.':'Сначала удалите большой сплошной куб SKY: он занимает игровое пространство.',
  'Create at least one world brush before generating a sky enclosure.':'Перед созданием оболочки добавьте хотя бы один мировой браш.',
  'Invalid map coordinates.':'Неверные координаты карты.',
  'The sky enclosure would exceed a safe GoldSrc map extent. Reduce the margin or move distant objects.':'Оболочка SKY превысит безопасные размеры карты GoldSrc. Уменьшите отступ или переместите удалённые объекты.'
});
Object.assign(ko,{
  'Create Sky Enclosure':'SKY 외곽 상자 만들기',
  'Regenerate Sky Enclosure':'SKY 외곽 상자 다시 만들기',
  'Generate six separate SKY-textured world brushes around the current map. The interior stays empty; keep the windows and roof openings you built.':'현재 맵 주변에 SKY 텍스처의 월드 브러시 6개를 생성합니다. 내부 공간은 비어 있으며 기존 창문과 지붕의 열린 부분은 유지됩니다.',
  'Sky margin (units)':'하늘 여백 (단위)',
  'Sky wall thickness (units)':'SKY 벽 두께 (단위)',
  'Sky grid (units)':'SKY 그리드 (단위)',
  'Hide enclosure in editor (still compiles)':'편집기에서 외곽 상자 숨기기 (컴파일에는 포함)',
  'Check sky enclosure settings':'SKY 외곽 상자 설정 확인',
  'Six SKY brushes will surround the map without filling the interior.':'SKY 브러시 6개가 내부를 채우지 않고 맵을 둘러쌉니다.',
  'Existing auto sky brushes will be replaced':'기존 자동 SKY 브러시가 교체됩니다',
  'Sky enclosure generated. The interior is empty; the six SKY brushes are exported even when hidden in the editor.':'SKY 외곽 상자가 생성되었습니다. 내부는 비어 있고, 편집기에서 숨겨도 브러시 6개가 내보내집니다.',
  'Sky enclosure could not be generated':'SKY 외곽 상자를 생성할 수 없습니다',
  'SKY must form a sealed outer shell. This tool does not fix leaks inside your own geometry or simulate light_environment; compile to verify.':'SKY 외곽 상자는 외부를 완전히 막아야 합니다. 도구는 내부 누수나 light_environment 효과를 수정하지 않으니 컴파일하여 확인하세요.',
  'Remove the large solid SKY cube first; it still occupies the playable space.':'먼저 커다란 SKY 고체 상자를 삭제하세요. 플레이 공간을 차지하고 있습니다.',
  'Create at least one world brush before generating a sky enclosure.':'SKY 외곽 상자를 만들기 전에 월드 브러시를 하나 이상 생성하세요.',
  'Invalid map coordinates.':'맵 좌표가 올바르지 않습니다.',
  'The sky enclosure would exceed a safe GoldSrc map extent. Reduce the margin or move distant objects.':'SKY 외곽 상자가 GoldSrc의 안전한 맵 크기를 초과합니다. 여백을 줄이거나 멀리 있는 오브젝트를 이동하세요.'
});

// v0.8.10.0 — Editor-only Player Walk Mode. Fallback for English is the key itself.
Object.assign(es,{
  'Player Walk Mode':'Modo jugador',
  'Walk':'Caminar',
  'Click viewport to capture mouse':'Hacé clic en el visor para capturar el mouse',
  'Walk controls hint':'WASD: caminar · Mouse: mirar · Espacio: saltar · Shift: correr · Ctrl: agacharse · Esc: salir · Shift+P: alternar'
});
Object.assign(ru,{
  'Player Walk Mode':'Режим прогулки',
  'Walk':'Ходьба',
  'Click viewport to capture mouse':'Нажмите в окне просмотра для захвата мыши',
  'Walk controls hint':'WASD: ходьба · Мышь: обзор · Пробел: прыжок · Shift: бег · Ctrl: присесть · Esc: выход · Shift+P: переключить'
});
Object.assign(ko,{
  'Player Walk Mode':'플레이어 걷기 모드',
  'Walk':'걷기',
  'Click viewport to capture mouse':'마우스를 고정하려면 뷰포트를 클릭하세요',
  'Walk controls hint':'WASD: 이동 · 마우스: 시점 · Space: 점프 · Shift: 달리기 · Ctrl: 숙이기 · Esc: 종료 · Shift+P: 전환'
});

// v0.8.10.1 — Preview-only Walk controls and GoldSrc rendering options.
Object.assign(es,{
 'Player Walk 2.0 & GoldSrc Renderer':'Modo jugador 2.0 y renderizador GoldSrc',
 'Walk and renderer settings':'Controles de caminar y renderizado',
 'Starting position':'Posición inicial','Current camera position':'Posición actual de la cámara',
 'Walk speed':'Velocidad al caminar','Run multiplier':'Multiplicador al correr','Crouch multiplier':'Multiplicador al agacharse',
 'Flashlight power':'Potencia de linterna','Player HUD':'HUD del jugador','Flashlight':'Linterna','Noclip preview':'Noclip (vista previa)',
 'GoldSrc Renderer 2.0':'Renderizador GoldSrc 2.0','GoldSrc material preview':'Vista previa de materiales GoldSrc',
 'Water and glass transparency':'Transparencia de agua y cristales','Water texture animation':'Animación de textura de agua',
 'Exposure':'Exposición','Ambient fill':'Luz ambiente adicional','Speed':'Velocidad','Crouched':'Agachado','Grounded':'En el suelo','Airborne':'En el aire',
 'Walk 2 controls hint':'WASD: mover · Mouse: mirar · Espacio: saltar · Shift: correr · Ctrl: agacharse · F: linterna · N: noclip · F5/Esc: salir',
 'GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.':'La vista GoldSrc es aproximada; los lightmaps del BSP compilado siguen siendo la referencia para la iluminación precalculada.'
});
Object.assign(ru,{
 'Player Walk 2.0 & GoldSrc Renderer':'Прогулка 2.0 и рендерер GoldSrc',
 'Walk and renderer settings':'Настройки прогулки и рендеринга',
 'Starting position':'Начальная позиция','Current camera position':'Позиция текущей камеры',
 'Walk speed':'Скорость ходьбы','Run multiplier':'Множитель бега','Crouch multiplier':'Множитель приседания',
 'Flashlight power':'Мощность фонарика','Player HUD':'HUD игрока','Flashlight':'Фонарик','Noclip preview':'Свободный проход (noclip)',
 'GoldSrc Renderer 2.0':'Рендерер GoldSrc 2.0','GoldSrc material preview':'Предпросмотр материалов GoldSrc',
 'Water and glass transparency':'Прозрачность воды и стекла','Water texture animation':'Анимация водных текстур',
 'Exposure':'Экспозиция','Ambient fill':'Заполняющий свет','Speed':'Скорость','Crouched':'Присевший','Grounded':'На земле','Airborne':'В воздухе',
 'Walk 2 controls hint':'WASD: движение · Мышь: обзор · Пробел: прыжок · Shift: бег · Ctrl: присесть · F: фонарик · N: noclip · F5/Esc: выход',
 'GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.':'Предпросмотр GoldSrc приблизителен; световые карты BSP остаются основой для проверки запечённого освещения.'
});
Object.assign(ko,{
 'Player Walk 2.0 & GoldSrc Renderer':'플레이어 걷기 2.0 및 GoldSrc 렌더러',
 'Walk and renderer settings':'걷기 및 렌더링 설정',
 'Starting position':'시작 위치','Current camera position':'현재 카메라 위치',
 'Walk speed':'걷기 속도','Run multiplier':'달리기 배율','Crouch multiplier':'앉기 배율',
 'Flashlight power':'손전등 밝기','Player HUD':'플레이어 HUD','Flashlight':'손전등','Noclip preview':'노클립 미리보기',
 'GoldSrc Renderer 2.0':'GoldSrc 렌더러 2.0','GoldSrc material preview':'GoldSrc 재질 미리보기',
 'Water and glass transparency':'물과 유리 투명도','Water texture animation':'물 텍스처 애니메이션',
 'Exposure':'노출','Ambient fill':'주변광 보정','Speed':'속도','Crouched':'웅크림','Grounded':'지면 위','Airborne':'공중',
 'Walk 2 controls hint':'WASD: 이동 · 마우스: 시점 · Space: 점프 · Shift: 달리기 · Ctrl: 숙이기 · F: 손전등 · N: 노클립 · F5/Esc: 종료',
 'GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.':'GoldSrc 미리보기는 근사치입니다. 정확한 사전 계산 조명은 컴파일된 BSP 라이트맵을 참조하세요.'
});

// v0.8.10.3 — Map Doctor 2.0. Diagnostic codes and GoldSrc identifiers stay original.
Object.assign(es,{
 'Map Doctor checks editable geometry and summarizes real compiler errors. A pointfile from SC-BSP reveals the diagnosed leak route; static checks alone cannot prove a map is sealed.':'Map Doctor revisa la geometría editable y los errores reales del compilador. El archivo .pts de SC-BSP muestra el recorrido de un LEAK; las comprobaciones previas no garantizan que el mapa esté sellado.',
 'Leak pointfile route':'Recorrido del LEAK', 'Current map':'Mapa actual','No pointfile loaded':'Sin archivo de puntos', 'route points':'puntos del recorrido',
 'Compile a leaking map or import a .pts/.lin pointfile to see the route.':'Compilá un mapa con fuga o importá un archivo .pts/.lin para ver el recorrido.',
 'Import pointfile':'Importar .pts/.lin','Hide leak route':'Ocultar recorrido','Show leak route':'Mostrar recorrido','Focus route start':'Ir al inicio','Focus route end':'Ir al final','Clear route':'Borrar recorrido',
 'Invalid pointfile. Use a .pts or .lin file smaller than 1 MB.':'Archivo inválido. Usá un .pts o .lin menor a 1 MB.','The pointfile contains no usable route.':'El archivo no tiene un recorrido válido.','Pointfile loaded into viewport.':'Recorrido cargado en el visor.','The pointfile could not be read.':'No se pudo leer el archivo.',
 'Pointfiles describe a compiler path from an entity to outside, not the exact brush causing the hole. Trace endpoints are diagnostic clues.':'El archivo muestra un recorrido desde una entidad hasta el exterior, no necesariamente el brush que causa la fuga. Sus extremos son pistas.',
 'Last compilation findings':'Diagnóstico de la última compilación','No recognized compiler errors in the last build. Check the full output log for other issues.':'No se reconocieron errores en la última compilación. Revisá el registro completo.','Preflight checks':'Comprobaciones previas',
 'Compiler detected a leak in hulls {hulls}. Follow the pointfile route to find the opening.':'El compilador detectó una fuga en los hulls {hulls}. Seguí el recorrido para encontrar el hueco.',
 'The compiler reported invalid brush geometry. Inspect the affected brushes in Map Doctor and the original compiler log.':'El compilador detectó geometría de brush inválida. Revisá los brushes en Map Doctor y el registro original.',
 'The compiler could not find a texture or WAD. Review the configured WAD paths.':'Falta una textura o WAD. Revisá las rutas configuradas.',
 'RAD found no lighting patches. Verify that the playable space is not filled by a solid SKY brush.':'RAD no encontró parches de iluminación. Comprobá que ningún brush SKY macizo ocupe el espacio jugable.',
 'SC-RAD crashed while calculating lighting. Review the RAD log and brush geometry; the exact cause is not proven.':'SC-RAD falló al calcular la luz. Revisá su registro y la geometría; la causa exacta no está confirmada.',
 'SC-VIS failed. Review the full compiler log for leaks or invalid portal geometry.':'SC-VIS falló. Revisá posibles fugas y problemas de portales en el registro.',
 'A GoldSrc engine or compiler limit was reported. Check the exact limit in the compiler log.':'Se alcanzó un límite de GoldSrc o del compilador. Consultá el límite exacto en el registro.'
});
Object.assign(ru,{
 'Map Doctor checks editable geometry and summarizes real compiler errors. A pointfile from SC-BSP reveals the diagnosed leak route; static checks alone cannot prove a map is sealed.':'Map Doctor проверяет геометрию и ошибки компилятора. Файл точек .pts из SC-BSP показывает путь утечки; предварительная проверка не доказывает герметичность карты.',
 'Leak pointfile route':'Маршрут утечки','Current map':'Текущая карта','No pointfile loaded':'Нет файла точек','route points':'точек маршрута',
 'Compile a leaking map or import a .pts/.lin pointfile to see the route.':'Скомпилируйте карту с утечкой или импортируйте файл .pts/.lin.',
 'Import pointfile':'Импорт .pts/.lin','Hide leak route':'Скрыть маршрут','Show leak route':'Показать маршрут','Focus route start':'Перейти к началу','Focus route end':'Перейти к концу','Clear route':'Очистить маршрут',
 'Invalid pointfile. Use a .pts or .lin file smaller than 1 MB.':'Неверный файл. Нужен .pts или .lin размером до 1 МБ.','The pointfile contains no usable route.':'В файле нет корректного маршрута.','Pointfile loaded into viewport.':'Маршрут загружен в окно просмотра.','The pointfile could not be read.':'Не удалось прочитать файл.',
 'Pointfiles describe a compiler path from an entity to outside, not the exact brush causing the hole. Trace endpoints are diagnostic clues.':'Файл показывает путь от сущности наружу, но не обязательно указывает на конкретный проблемный браш. Концы маршрута служат подсказками.',
 'Last compilation findings':'Ошибки последней компиляции','No recognized compiler errors in the last build. Check the full output log for other issues.':'В последней сборке знакомых ошибок нет. Проверьте полный журнал.','Preflight checks':'Предварительные проверки',
 'Compiler detected a leak in hulls {hulls}. Follow the pointfile route to find the opening.':'Компилятор обнаружил утечку в hull {hulls}. Следуйте маршруту до отверстия.',
 'The compiler reported invalid brush geometry. Inspect the affected brushes in Map Doctor and the original compiler log.':'Компилятор сообщил о неверной геометрии браша. Проверьте браши и исходный журнал.',
 'The compiler could not find a texture or WAD. Review the configured WAD paths.':'Не найдена текстура или WAD. Проверьте пути к WAD.',
 'RAD found no lighting patches. Verify that the playable space is not filled by a solid SKY brush.':'RAD не нашёл световых патчей. Убедитесь, что игровой объём не заполнен сплошным SKY-брашем.',
 'SC-RAD crashed while calculating lighting. Review the RAD log and brush geometry; the exact cause is not proven.':'SC-RAD завершился с ошибкой при расчёте света. Проверьте журнал и геометрию; точная причина не установлена.',
 'SC-VIS failed. Review the full compiler log for leaks or invalid portal geometry.':'SC-VIS завершился с ошибкой. Проверьте утечки и порталы в журнале.',
 'A GoldSrc engine or compiler limit was reported. Check the exact limit in the compiler log.':'Сообщается об ограничении GoldSrc или компилятора. Посмотрите точный предел в журнале.'
});
Object.assign(ko,{
 'Map Doctor checks editable geometry and summarizes real compiler errors. A pointfile from SC-BSP reveals the diagnosed leak route; static checks alone cannot prove a map is sealed.':'Map Doctor는 편집 가능한 지오메트리와 실제 컴파일 오류를 분석합니다. SC-BSP의 .pts 파일로 누수 경로를 표시하지만 사전 검사만으로 밀폐를 보장하지는 않습니다.',
 'Leak pointfile route':'누수 경로','Current map':'현재 맵','No pointfile loaded':'포인트 파일 없음','route points':'경로 지점',
 'Compile a leaking map or import a .pts/.lin pointfile to see the route.':'누수가 있는 맵을 컴파일하거나 .pts/.lin 파일을 가져와 경로를 확인하세요.',
 'Import pointfile':'.pts/.lin 가져오기','Hide leak route':'누수 경로 숨기기','Show leak route':'누수 경로 표시','Focus route start':'경로 시작으로 이동','Focus route end':'경로 끝으로 이동','Clear route':'경로 지우기',
 'Invalid pointfile. Use a .pts or .lin file smaller than 1 MB.':'잘못된 파일입니다. 1MB 미만의 .pts 또는 .lin을 사용하세요.','The pointfile contains no usable route.':'사용 가능한 경로가 없습니다.','Pointfile loaded into viewport.':'뷰포트에 경로를 불러왔습니다.','The pointfile could not be read.':'파일을 읽을 수 없습니다.',
 'Pointfiles describe a compiler path from an entity to outside, not the exact brush causing the hole. Trace endpoints are diagnostic clues.':'포인트 파일은 엔티티에서 외부까지의 경로를 나타냅니다. 반드시 문제 브러시를 정확히 가리키지는 않으며 양 끝점은 단서입니다.',
 'Last compilation findings':'최근 컴파일 진단','No recognized compiler errors in the last build. Check the full output log for other issues.':'최근 컴파일에서 알려진 오류가 없습니다. 전체 로그를 확인하세요.','Preflight checks':'컴파일 전 검사',
 'Compiler detected a leak in hulls {hulls}. Follow the pointfile route to find the opening.':'컴파일러가 hull {hulls}에서 누수를 발견했습니다. 경로를 따라 열린 부분을 찾으세요.',
 'The compiler reported invalid brush geometry. Inspect the affected brushes in Map Doctor and the original compiler log.':'컴파일러가 잘못된 브러시 지오메트리를 보고했습니다. 브러시와 원본 로그를 확인하세요.',
 'The compiler could not find a texture or WAD. Review the configured WAD paths.':'텍스처 또는 WAD를 찾을 수 없습니다. WAD 경로를 확인하세요.',
 'RAD found no lighting patches. Verify that the playable space is not filled by a solid SKY brush.':'RAD가 조명 패치를 찾지 못했습니다. 플레이 공간이 SKY 고체 브러시로 채워져 있지 않은지 확인하세요.',
 'SC-RAD crashed while calculating lighting. Review the RAD log and brush geometry; the exact cause is not proven.':'조명 계산 중 SC-RAD가 비정상 종료되었습니다. 정확한 원인은 확인되지 않았으므로 로그와 지오메트리를 확인하세요.',
 'SC-VIS failed. Review the full compiler log for leaks or invalid portal geometry.':'SC-VIS가 실패했습니다. 로그에서 누수와 잘못된 포털 지오메트리를 확인하세요.',
 'A GoldSrc engine or compiler limit was reported. Check the exact limit in the compiler log.':'GoldSrc 또는 컴파일러 한도 문제가 보고되었습니다. 로그에서 정확한 한도를 확인하세요.'
});
Object.assign(es,{'Open Map Doctor':'Abrir Map Doctor'});
Object.assign(ru,{'Open Map Doctor':'Открыть диагностику карты'});
Object.assign(ko,{'Open Map Doctor':'맵 진단 열기'});
Object.assign(es,{'Solid SKY brush contains {classname}. Replace it with a hollow sky enclosure.':'Un brush SKY sólido contiene {classname}. Reemplazalo por una envolvente SKY hueca.'});
Object.assign(ru,{'Solid SKY brush contains {classname}. Replace it with a hollow sky enclosure.':'Сплошной браш SKY содержит {classname}. Замените его полой небесной оболочкой.'});
Object.assign(ko,{'Solid SKY brush contains {classname}. Replace it with a hollow sky enclosure.':'SKY 고체 브러시에 {classname}가 포함되어 있습니다. 빈 SKY 외곽 상자로 교체하세요.'});

// v0.9.0 — imported files must not silently replace or damage editing sessions.
Object.assign(es,{
 'MAP import would skip {lost} of {total} brushes. The source file is unchanged. Import the incomplete map anyway?':'La importación MAP omitiría {lost} de {total} brushes. El archivo original no cambia. ¿Importar igualmente el mapa incompleto?',
 'Opening this file replaces the current map. Save your work first. Continue?':'Abrir este archivo reemplaza el mapa actual. Guardá tu trabajo primero. ¿Continuar?',
 'The current map could not be backed up locally. Continue without a recovery checkpoint?':'No se pudo respaldar el mapa actual localmente. ¿Continuar sin punto de recuperación?',
 'Import failed':'Error de importación'
});
Object.assign(ru,{
 'MAP import would skip {lost} of {total} brushes. The source file is unchanged. Import the incomplete map anyway?':'При импорте MAP будут пропущены {lost} из {total} брашей. Исходный файл не изменится. Импортировать неполную карту?',
 'Opening this file replaces the current map. Save your work first. Continue?':'Открытие файла заменит текущую карту. Сначала сохраните работу. Продолжить?',
 'The current map could not be backed up locally. Continue without a recovery checkpoint?':'Не удалось создать локальную резервную копию. Продолжить без контрольной копии?',
 'Import failed':'Ошибка импорта'
});
Object.assign(ko,{
 'MAP import would skip {lost} of {total} brushes. The source file is unchanged. Import the incomplete map anyway?':'MAP 가져오기에서 전체 {total}개 중 {lost}개 브러시가 누락됩니다. 원본 파일은 변경되지 않습니다. 불완전한 맵을 가져올까요?',
 'Opening this file replaces the current map. Save your work first. Continue?':'이 파일을 열면 현재 맵이 교체됩니다. 먼저 작업을 저장하세요. 계속할까요?',
 'The current map could not be backed up locally. Continue without a recovery checkpoint?':'현재 맵의 로컬 백업을 만들 수 없습니다. 복구 지점 없이 계속할까요?',
 'Import failed':'가져오기 실패'
});

// v0.9.2 — keyboard safety: safe crouch alternative and reserved-key feedback.
Object.assign(es,{
 'Walk 2 controls hint':'WASD: mover · Mouse: mirar · Espacio: saltar · Shift: correr · C: agacharse · F: linterna · N: noclip · F5/Esc: salir',
 'This shortcut is reserved by your browser or operating system. Choose another key.':'El navegador o Windows reserva esa combinación. Elegí otra tecla.',
 'Use C to crouch while moving. Ctrl+W may close the browser.':'Usá C para agacharte mientras avanzás. Ctrl+W puede cerrar el navegador.'
});
Object.assign(ru,{
 'Walk 2 controls hint':'WASD: движение · Мышь: обзор · Пробел: прыжок · Shift: бег · C: присесть · F: фонарик · N: noclip · F5/Esc: выход',
 'This shortcut is reserved by your browser or operating system. Choose another key.':'Это сочетание зарезервировано браузером или ОС. Выберите другую клавишу.',
 'Use C to crouch while moving. Ctrl+W may close the browser.':'Для приседания на ходу используйте C. Ctrl+W может закрыть вкладку.'
});
Object.assign(ko,{
 'Walk 2 controls hint':'WASD 이동 · 마우스 보기 · Space 점프 · Shift 달리기 · C 숙이기 · F 손전등 · N 노클립 · F5/Esc 종료',
 'This shortcut is reserved by your browser or operating system. Choose another key.':'브라우저 또는 운영체제 예약 단축키입니다. 다른 키를 선택하세요.',
 'Use C to crouch while moving. Ctrl+W may close the browser.':'이동 중 숙이려면 C를 사용하세요. Ctrl+W는 브라우저를 닫을 수 있습니다.'
});

Object.assign(es,{
 'Safe fullscreen keyboard mode':'Teclado protegido en pantalla completa',
 'In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.':'En navegadores compatibles, la pantalla completa puede capturar Ctrl+W. Puede requerir permiso. Mantené Esc para salir.'
});
Object.assign(ru,{
 'Safe fullscreen keyboard mode':'Защищённая клавиатура в полноэкранном режиме',
 'In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.':'В совместимых браузерах полноэкранная блокировка может перехватывать Ctrl+W. Может потребоваться разрешение. Удерживайте Esc для выхода.'
});
Object.assign(ko,{
 'Safe fullscreen keyboard mode':'전체 화면 키보드 보호 모드',
 'In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.':'지원 브라우저에서는 전체 화면 키보드 잠금이 Ctrl+W를 가로챌 수 있습니다. 권한이 필요할 수 있습니다. 종료하려면 Esc를 길게 누르세요.'
});
Object.assign(en,{
 'Walk 2 controls hint':'WASD: move · Mouse: look · Space: jump · Shift: run · C: crouch · F: flashlight · N: noclip · F5/Esc: exit',
 'Safe fullscreen keyboard mode':'Protected fullscreen keyboard mode',
 'In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.':'In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.',
 'Use C to crouch while moving. Ctrl+W may close the browser.':'Use C to crouch while moving. Ctrl+W may close the browser.',
 'This shortcut is reserved by your browser or operating system. Choose another key.':'This shortcut is reserved by your browser or operating system. Choose another key.'
});

// v0.9.3 — R/C toggle the visual gizmo without transforming the selection.
Object.assign(es,{
 'Rotate gizmo (R)':'Gizmo de rotación (R)','Scale gizmo (C)':'Gizmo de escala (C)',
 'G starts mouse-follow Move. R and C toggle the Rotate and Scale gizmos; press again to return to Select. Drag a gizmo handle to edit the brush.':'G inicia Mover siguiendo el mouse. R y C activan o desactivan los gizmos de rotación y escala; pulsá otra vez para volver a Selección. Arrastrá una manija para editar el brush.',
 'G uses mouse-follow Move with Shift/Ctrl/Alt and X/Y/Z axis constraints. R/C show gizmos: drag a handle to rotate/scale, or press the shortcut again to select normally.':'G mueve con el mouse y modificadores Shift/Ctrl/Alt y ejes X/Y/Z. R/C muestran gizmos: arrastrá la manija o repetí la tecla para seleccionar normalmente.'
});
Object.assign(ru,{
 'Rotate gizmo (R)':'Гизмо поворота (R)','Scale gizmo (C)':'Гизмо масштаба (C)',
 'G starts mouse-follow Move. R and C toggle the Rotate and Scale gizmos; press again to return to Select. Drag a gizmo handle to edit the brush.':'G перемещает за мышью. R и C включают и выключают гизмо поворота и масштаба. Повторное нажатие возвращает выделение. Для изменения перетащите ручку.',
 'G uses mouse-follow Move with Shift/Ctrl/Alt and X/Y/Z axis constraints. R/C show gizmos: drag a handle to rotate/scale, or press the shortcut again to select normally.':'G — перемещение мышью с Shift/Ctrl/Alt и X/Y/Z. R/C включают гизмо; перетащите ручку или нажмите кнопку снова для выделения.'
});
Object.assign(ko,{
 'Rotate gizmo (R)':'회전 기즈모 (R)','Scale gizmo (C)':'크기 기즈모 (C)',
 'G starts mouse-follow Move. R and C toggle the Rotate and Scale gizmos; press again to return to Select. Drag a gizmo handle to edit the brush.':'G는 마우스로 이동합니다. R과 C는 회전과 크기 기즈모를 켜거나 끕니다. 다시 누르면 선택 모드로 돌아갑니다. 핸들을 드래그해 편집하세요.',
 'G uses mouse-follow Move with Shift/Ctrl/Alt and X/Y/Z axis constraints. R/C show gizmos: drag a handle to rotate/scale, or press the shortcut again to select normally.':'G는 Shift/Ctrl/Alt 및 X/Y/Z와 함께 마우스로 이동합니다. R/C는 기즈모를 표시합니다. 핸들을 끌거나 다시 눌러 선택 모드로 돌아갑니다.'
});

// v0.9.3 — update Help text; avoid describing R/C as automatic transforms.
Object.assign(en,{'Help shortcuts':'G = mouse-follow Move; R = toggle Rotate gizmo; C = toggle Scale gizmo. Press R/C again to return to Select. E = Extrude face; Ctrl+Z/Y = Undo/Redo; Ctrl+S = Save. Use the gizmo handles with the mouse. View and keyboard bindings are customizable.'});
Object.assign(es,{'Help shortcuts':'G = mover siguiendo el mouse; R = activar/desactivar gizmo de rotación; C = activar/desactivar gizmo de escala. Repetí R/C para volver a selección. E = extruir cara; Ctrl+Z/Y = deshacer/rehacer; Ctrl+S = guardar. Arrastrá las manijas del gizmo. Los atajos de cámara y teclado son configurables.'});
Object.assign(ru,{'Help shortcuts':'G — перемещение за мышью; R — гизмо поворота, C — гизмо масштаба. Нажмите R/C снова, чтобы вернуться к выделению. E — выдавливание грани; Ctrl+Z/Y — отмена/повтор; Ctrl+S — сохранить. Перетаскивайте ручки гизмо.'});
Object.assign(ko,{'Help shortcuts':'G는 마우스로 이동, R은 회전 기즈모 전환, C는 크기 기즈모 전환입니다. R/C를 다시 누르면 선택 모드로 돌아갑니다. E는 면 돌출, Ctrl+Z/Y는 실행 취소/다시 실행, Ctrl+S는 저장입니다. 기즈모 핸들을 드래그해 편집하세요.'});


// v0.9.4 — Blender-style Z shading pie (visual-only presets).
Object.assign(en,{
 'Shading pie menu':'Shading pie menu','Shading':'Shading',
 'Wireframe':'Wireframe','Solid':'Solid','Material Preview':'Material Preview','Rendered':'Rendered',
 'Hold Z · move mouse · release to select':'Hold Z · move mouse · release to select'
});
Object.assign(es,{
 'Shading pie menu':'Menú radial de sombreado','Shading':'Sombreado',
 'Wireframe':'Wireframe','Solid':'Sólido','Material Preview':'Vista de material','Rendered':'Renderizado',
 'Hold Z · move mouse · release to select':'Mantené Z · mové el mouse · soltá para elegir'
});
Object.assign(ru,{
 'Shading pie menu':'Круговое меню затенения','Shading':'Затенение',
 'Wireframe':'Каркас','Solid':'Сплошной','Material Preview':'Просмотр материалов','Rendered':'Рендер',
 'Hold Z · move mouse · release to select':'Удерживайте Z · выберите мышью · отпустите'
});
Object.assign(ko,{
 'Shading pie menu':'음영 파이 메뉴','Shading':'음영',
 'Wireframe':'와이어프레임','Solid':'솔리드','Material Preview':'재질 미리보기','Rendered':'렌더링',
 'Hold Z · move mouse · release to select':'Z 누르기 · 마우스 이동 · 놓아서 선택'
});

// Cinematic Camera Studio: editor UI translations only. GoldSrc classnames and keyvalues stay in English.
Object.assign(es,{
  'Cinematic Camera Studio':'Estudio de cámaras cinematográficas','Native Sven Co-op entities':'Entidades nativas de Sven Co-op',
  'Camera scenes':'Escenas de cámara','Create new scene':'Crear escena nueva','Every scene uses native map entities; no custom engine plugins are required.':'Cada escena usa entidades nativas; no requiere plugins del motor.',
  'path points':'puntos de ruta','Approximate preview — not actual Svengine playback':'Vista previa aproximada — no es la ejecución real de Svengine',
  'Camera path':'Ruta de cámara','Add point in 3D':'Añadir punto en 3D','Camera position':'Posición de cámara','Look target':'Objetivo de mirada',
  'Choose a point to close the studio and move it with the existing gizmo. Add points by clicking map surfaces; Esc ends placement.':'Seleccioná un punto para moverlo con el gizmo existente. Añadí puntos haciendo clic en el mapa; Esc termina la colocación.',
  'New cinematic scene':'Nueva escena cinematográfica','Create a camera and target. For motion, add path points afterward using the 3D viewport.':'Creá una cámara y su objetivo. Para moverla, añadí puntos desde el visor 3D.',
  'Create camera':'Crear cámara','Place route':'Colocar ruta','Connect trigger':'Conectar activador','Compile and test':'Compilar y probar',
  'Position near current selection':'Colocar cerca de la selección','Camera position (GoldSrc X/Y/Z)':'Posición de cámara (GoldSrc X/Y/Z)',
  'Look target (GoldSrc X/Y/Z)':'Objetivo de mirada (GoldSrc X/Y/Z)','Camera properties':'Propiedades de cámara',
  'Scene name':'Nombre de escena','Created by Cinematic Camera Studio':'Creada con Cinematic Camera Studio',
  'Existing camera — inspect only':'Cámara existente — solo inspección','Hold time (seconds)':'Duración (segundos)',
  'Initial speed (units/sec)':'Velocidad inicial (unidades/s)','Freeze player':'Inmovilizar al jugador',
  'All players':'Todos los jugadores','Player invulnerable':'Jugador invulnerable','Moving camera (path)':'Cámara móvil (ruta)',
  'Trigger / button to activate (optional)':'Activador o botón (opcional)','Connect later in Gameplay Studio':'Conectar después en Gameplay Studio',
  'This activator already has a target and will not be overwritten.':'Este activador ya tiene un destino; no se sobrescribirá.',
  'Save camera properties':'Guardar propiedades de cámara','Select camera in 3D':'Seleccionar cámara en 3D',
  'Scene validation':'Validación de escena','No scene reference errors found.':'No se detectaron errores de referencias.',
  'Preview is approximate: GoldSrc uses its own camera acceleration, smoothing, targets and event timing. Verify the BSP in Sven Co-op.':'La vista previa es aproximada: GoldSrc controla aceleración, suavizado, objetivos y eventos. Probá el BSP en Sven Co-op.',
  'Preview limited to 250 brushes for performance; exported map remains complete.':'Vista previa limitada a 250 brushes por rendimiento; el mapa exportado conserva todo.',
  'Native entities only. Existing brushes, WAD/FGD, lightmaps, gizmos and BSP compiler are unchanged.':'Solo entidades nativas. No se modifican brushes, WAD/FGD, lightmaps, gizmos ni compiladores BSP.',
  'Camera created. Link a trigger or add route points.':'Cámara creada. Conectá un activador o añadí puntos de ruta.',
  'Preview time':'Tiempo de vista previa','Pause':'Pausar','Play':'Reproducir'
});
Object.assign(ru,{
  'Cinematic Camera Studio':'Студия кинематографических камер','Native Sven Co-op entities':'Стандартные сущности Sven Co-op',
  'Camera scenes':'Сцены камер','Create new scene':'Создать сцену','Every scene uses native map entities; no custom engine plugins are required.':'Сцена использует стандартные сущности карты, без плагинов движка.',
  'path points':'точек пути','Approximate preview — not actual Svengine playback':'Приблизительный просмотр — не воспроизведение Svengine',
  'Camera path':'Путь камеры','Add point in 3D':'Добавить точку в 3D','Camera position':'Положение камеры','Look target':'Цель взгляда',
  'Choose a point to close the studio and move it with the existing gizmo. Add points by clicking map surfaces; Esc ends placement.':'Выберите точку, чтобы переместить её обычным манипулятором. Щёлкайте по карте для новых точек; Esc завершает.',
  'New cinematic scene':'Новая кинематографическая сцена','Create a camera and target. For motion, add path points afterward using the 3D viewport.':'Создайте камеру и цель. Для движения затем добавьте точки пути в 3D.',
  'Create camera':'Создать камеру','Place route':'Задать путь','Connect trigger':'Связать триггер','Compile and test':'Скомпилировать и проверить',
  'Position near current selection':'Рядом с выделением','Camera position (GoldSrc X/Y/Z)':'Камера (GoldSrc X/Y/Z)',
  'Look target (GoldSrc X/Y/Z)':'Цель (GoldSrc X/Y/Z)','Camera properties':'Параметры камеры',
  'Scene name':'Имя сцены','Created by Cinematic Camera Studio':'Создана студией камер',
  'Existing camera — inspect only':'Существующая камера — только просмотр','Hold time (seconds)':'Длительность (секунды)',
  'Initial speed (units/sec)':'Начальная скорость (ед./с)','Freeze player':'Обездвижить игрока',
  'All players':'Все игроки','Player invulnerable':'Неуязвимость игрока','Moving camera (path)':'Движущаяся камера (путь)',
  'Trigger / button to activate (optional)':'Триггер / кнопка (необязательно)','Connect later in Gameplay Studio':'Связать позже в Gameplay Studio',
  'This activator already has a target and will not be overwritten.':'У триггера уже есть цель: она не будет перезаписана.',
  'Save camera properties':'Сохранить параметры','Select camera in 3D':'Выделить камеру в 3D',
  'Scene validation':'Проверка сцены','No scene reference errors found.':'Ошибок ссылок не найдено.',
  'Preview is approximate: GoldSrc uses its own camera acceleration, smoothing, targets and event timing. Verify the BSP in Sven Co-op.':'Просмотр приблизительный: GoldSrc по-своему управляет ускорением, плавностью, целями и событиями. Проверьте BSP в Sven Co-op.',
  'Preview limited to 250 brushes for performance; exported map remains complete.':'Просмотр ограничен 250 брашами; экспорт карты полный.',
  'Native entities only. Existing brushes, WAD/FGD, lightmaps, gizmos and BSP compiler are unchanged.':'Только стандартные сущности. Браши, WAD/FGD, освещение, манипуляторы и компилятор BSP не изменены.',
  'Camera created. Link a trigger or add route points.':'Камера создана. Свяжите триггер или добавьте точки пути.',
  'Preview time':'Время просмотра','Pause':'Пауза','Play':'Пуск'
});
Object.assign(ko,{
  'Cinematic Camera Studio':'시네마틱 카메라 스튜디오','Native Sven Co-op entities':'Sven Co-op 기본 엔티티',
  'Camera scenes':'카메라 장면','Create new scene':'새 장면 만들기','Every scene uses native map entities; no custom engine plugins are required.':'장면은 기본 맵 엔티티만 사용하며 엔진 플러그인이 필요 없습니다.',
  'path points':'경로 지점','Approximate preview — not actual Svengine playback':'근사 미리보기 — 실제 Svengine 재생과 다름',
  'Camera path':'카메라 경로','Add point in 3D':'3D에서 지점 추가','Camera position':'카메라 위치','Look target':'시선 대상',
  'Choose a point to close the studio and move it with the existing gizmo. Add points by clicking map surfaces; Esc ends placement.':'지점을 선택하면 창이 닫히고 기존 기즈모로 이동할 수 있습니다. 표면을 클릭해 지점을 추가하고 Esc로 종료하세요.',
  'New cinematic scene':'새 시네마틱 장면','Create a camera and target. For motion, add path points afterward using the 3D viewport.':'카메라와 대상을 만든 다음 3D 뷰포트에서 경로 지점을 추가하세요.',
  'Create camera':'카메라 만들기','Place route':'경로 배치','Connect trigger':'트리거 연결','Compile and test':'컴파일 및 테스트',
  'Position near current selection':'선택 항목 근처로 이동','Camera position (GoldSrc X/Y/Z)':'카메라 위치 (GoldSrc X/Y/Z)',
  'Look target (GoldSrc X/Y/Z)':'시선 대상 (GoldSrc X/Y/Z)','Camera properties':'카메라 속성',
  'Scene name':'장면 이름','Created by Cinematic Camera Studio':'시네마틱 스튜디오에서 생성됨',
  'Existing camera — inspect only':'기존 카메라 — 보기만 가능','Hold time (seconds)':'지속 시간 (초)',
  'Initial speed (units/sec)':'초기 속도 (단위/초)','Freeze player':'플레이어 이동 제한',
  'All players':'모든 플레이어','Player invulnerable':'플레이어 무적','Moving camera (path)':'이동 카메라 (경로)',
  'Trigger / button to activate (optional)':'작동 트리거 / 버튼 (선택)','Connect later in Gameplay Studio':'나중에 Gameplay Studio에서 연결',
  'This activator already has a target and will not be overwritten.':'이 트리거에는 이미 대상이 있어 덮어쓰지 않습니다.',
  'Save camera properties':'카메라 속성 저장','Select camera in 3D':'3D에서 카메라 선택',
  'Scene validation':'장면 검사','No scene reference errors found.':'참조 오류 없음.',
  'Preview is approximate: GoldSrc uses its own camera acceleration, smoothing, targets and event timing. Verify the BSP in Sven Co-op.':'미리보기는 근사치입니다. GoldSrc의 가속, 부드러움, 대상, 이벤트 타이밍은 다를 수 있으니 Sven Co-op에서 BSP를 시험하세요.',
  'Preview limited to 250 brushes for performance; exported map remains complete.':'성능상 250개 브러시만 미리 보이지만 맵은 모두 내보냅니다.',
  'Native entities only. Existing brushes, WAD/FGD, lightmaps, gizmos and BSP compiler are unchanged.':'기본 엔티티만 사용합니다. 기존 브러시, WAD/FGD, 라이트맵, 기즈모 및 BSP 컴파일러는 변경되지 않습니다.',
  'Camera created. Link a trigger or add route points.':'카메라를 만들었습니다. 트리거를 연결하거나 경로를 추가하세요.',
  'Preview time':'미리보기 시간','Pause':'일시정지','Play':'재생'
});

Object.assign(es,{'Cinematic route: click a map surface to add a path_corner. Esc to finish.':'Ruta cinematográfica: hacé clic sobre el mapa para añadir un path_corner. Esc para terminar.'});
Object.assign(ru,{'Cinematic route: click a map surface to add a path_corner. Esc to finish.':'Путь камеры: нажмите на поверхность карты, чтобы добавить path_corner. Esc завершает.'});
Object.assign(ko,{'Cinematic route: click a map surface to add a path_corner. Esc to finish.':'시네마틱 경로: 맵 표면을 클릭하여 path_corner를 추가하세요. Esc로 종료합니다.'});

// Cinematic Camera Studio preview fixes: keep native entity strings unchanged.
Object.assign(es,{'Camera view':'Vista de cámara','Inspect scene':'Inspeccionar escena',
 'Mouse: orbit / zoom / pan — no map changes':'Mouse: orbitar / zoom / desplazar — sin cambiar el mapa',
 'Camera is inside a solid brush:':'La cámara está dentro de un brush sólido:',
 'Move the camera or path point with the 3D gizmo.':'Mové la cámara o el punto de ruta con el gizmo 3D.'});
Object.assign(ru,{'Camera view':'Вид камеры','Inspect scene':'Осмотр сцены',
 'Mouse: orbit / zoom / pan — no map changes':'Мышь: вращение / масштаб / панорама — карта не меняется',
 'Camera is inside a solid brush:':'Камера находится внутри сплошного браша:',
 'Move the camera or path point with the 3D gizmo.':'Переместите камеру или точку пути с помощью 3D-манипулятора.'});
Object.assign(ko,{'Camera view':'카메라 뷰','Inspect scene':'장면 살펴보기',
 'Mouse: orbit / zoom / pan — no map changes':'마우스: 회전 / 확대 / 이동 — 지도 변경 없음',
 'Camera is inside a solid brush:':'카메라가 솔리드 브러시 내부에 있습니다:',
 'Move the camera or path point with the 3D gizmo.':'3D 기즈모로 카메라 또는 경로 지점을 이동하세요.'});

// Preview 3: cinematic-only interface text; native GoldSrc classnames/keyvalues stay in English.
Object.assign(es,{
 'Fullscreen preview':'Vista previa ampliada','Preview shading':'Sombreado de vista previa','Preview playback speed':'Velocidad de reproducción',
 'Jump to point':'Ir al punto','To remove a route point, only the last point can be removed safely.':'Para evitar romper conexiones, solo se puede eliminar el último punto.',
 'Remove last point':'Eliminar último punto','Segment speeds — simulation only':'Velocidad por tramos — solo simulación',
 'These speeds are saved only in .svenstudio.json. GoldSrc path_corner.speed controls trains, not documented camera segment speeds; the BSP uses the camera initial speed and acceleration.':'Estas velocidades se guardan solo en .svenstudio.json. path_corner.speed controla trenes; no se ha documentado que cambie la velocidad de la cámara. El BSP utiliza la velocidad inicial y aceleración de trigger_camera.',
 'Preview-only speed (units/sec)':'Velocidad solo de simulación (unidades/s)','Use global speed':'Usar velocidad general',
 'Estimated preview travel':'Recorrido estimado','Hold time':'Duración',
 'Advanced native camera options':'Opciones nativas avanzadas','Acceleration (units/s²)':'Aceleración (unidades/s²)',
 'Stop deceleration (units/s²)':'Desaceleración final (unidades/s²)','Rotation speed (degrees/s)':'Velocidad de giro (grados/s)',
 'Start at Player':'Comenzar desde el jugador','Follow Player':'Seguir al jugador','Force View':'Forzar cámara',
 'No Instant Turn (engine flag 32)':'No Instant Turn (flag 32 del motor)','Instant Move':'Movimiento instantáneo',
 'Hide health HUD':'Ocultar salud y armadura','Hide flashlight HUD':'Ocultar indicador de linterna','Hide weapons HUD':'Ocultar HUD de armas',
 'Svengine note: deceleration and rotation speed may not behave as expected. Start at Player and Follow Player cannot be reproduced accurately in the offline preview.':'Nota Svengine: la desaceleración y el giro pueden comportarse distinto a lo esperado. Comenzar/seguir al jugador no puede reproducirse fielmente en la simulación.'
});
Object.assign(ru,{
 'Fullscreen preview':'Полноэкранный просмотр','Preview shading':'Режим отображения','Preview playback speed':'Скорость воспроизведения',
 'Jump to point':'Перейти к точке','To remove a route point, only the last point can be removed safely.':'Для сохранения связей можно удалить только последнюю точку.',
 'Remove last point':'Удалить последнюю точку','Segment speeds — simulation only':'Скорости участков — только симуляция',
 'These speeds are saved only in .svenstudio.json. GoldSrc path_corner.speed controls trains, not documented camera segment speeds; the BSP uses the camera initial speed and acceleration.':'Эти скорости сохраняются только в .svenstudio.json. path_corner.speed управляет поездами; изменение скорости камеры не подтверждено. BSP использует начальную скорость и ускорение камеры.',
 'Preview-only speed (units/sec)':'Скорость симуляции (ед./с)','Use global speed':'Общая скорость',
 'Estimated preview travel':'Расчётное время','Hold time':'Время камеры',
 'Advanced native camera options':'Расширенные параметры камеры','Acceleration (units/s²)':'Ускорение (ед./с²)',
 'Stop deceleration (units/s²)':'Замедление (ед./с²)','Rotation speed (degrees/s)':'Скорость поворота (град./с)',
 'Start at Player':'Начать у игрока','Follow Player':'Следить за игроком','Force View':'Принудительная камера',
 'No Instant Turn (engine flag 32)':'No Instant Turn (флаг 32)','Instant Move':'Мгновенное движение',
 'Hide health HUD':'Скрыть здоровье','Hide flashlight HUD':'Скрыть фонарик','Hide weapons HUD':'Скрыть оружие',
 'Svengine note: deceleration and rotation speed may not behave as expected. Start at Player and Follow Player cannot be reproduced accurately in the offline preview.':'Svengine: замедление и скорость поворота могут работать иначе. Начало у игрока и слежение за ним не воспроизводятся точно в предварительном просмотре.'
});
Object.assign(ko,{
 'Fullscreen preview':'전체 화면 미리보기','Preview shading':'미리보기 음영','Preview playback speed':'재생 속도',
 'Jump to point':'지점으로 이동','To remove a route point, only the last point can be removed safely.':'연결을 보호하기 위해 마지막 지점만 안전하게 삭제할 수 있습니다.',
 'Remove last point':'마지막 지점 삭제','Segment speeds — simulation only':'구간별 속도 — 시뮬레이션 전용',
 'These speeds are saved only in .svenstudio.json. GoldSrc path_corner.speed controls trains, not documented camera segment speeds; the BSP uses the camera initial speed and acceleration.':'이 속도는 .svenstudio.json에만 저장됩니다. path_corner.speed는 열차용이며 카메라 구간 속도로 보장되지 않습니다. BSP는 카메라 초기 속도와 가속도를 사용합니다.',
 'Preview-only speed (units/sec)':'미리보기 전용 속도 (단위/초)','Use global speed':'전체 속도 사용',
 'Estimated preview travel':'예상 이동 시간','Hold time':'유지 시간',
 'Advanced native camera options':'고급 기본 카메라 옵션','Acceleration (units/s²)':'가속도 (단위/초²)',
 'Stop deceleration (units/s²)':'감속도 (단위/초²)','Rotation speed (degrees/s)':'회전 속도 (도/초)',
 'Start at Player':'플레이어 위치에서 시작','Follow Player':'플레이어 추적','Force View':'강제 카메라',
 'No Instant Turn (engine flag 32)':'No Instant Turn (엔진 플래그 32)','Instant Move':'즉시 이동',
 'Hide health HUD':'체력 HUD 숨기기','Hide flashlight HUD':'손전등 HUD 숨기기','Hide weapons HUD':'무기 HUD 숨기기',
 'Svengine note: deceleration and rotation speed may not behave as expected. Start at Player and Follow Player cannot be reproduced accurately in the offline preview.':'Svengine: 감속 및 회전 속도는 예상과 다를 수 있습니다. 플레이어 위치에서 시작하거나 추적하는 기능은 미리보기에서 정확히 재현되지 않습니다.'
});

// Preview 4 — Gameplay Studio navigation and graph-only references (FGD keys remain original).
Object.assign(es,{"Auto arrange all nodes":"Organizar nodos automáticamente","Restore previous layout":"Restaurar distribución anterior","Fit visible nodes":"Encajar nodos visibles","Center selected node":"Centrar nodo seleccionado","Toggle minimap":"Mostrar u ocultar minimapa","Search classname, name, target or layer":"Buscar classname, nombre, target o capa","Search entities":"Buscar entidades","Clear search":"Limpiar búsqueda","Entity category":"Categoría de entidades","All entities":"Todas las entidades","Triggers and logic":"Triggers y lógica","Brush entities":"Entidades brush","NPCs and paths":"NPC y rutas","Camera entities":"Entidades de cámara","Audio entities":"Entidades de audio","Other entities":"Otras entidades","visible entities":"entidades visibles","visible connections":"referencias visibles","Selected entity and neighbors":"Seleccionada y relacionadas","Wheel: zoom · drag empty space or middle mouse: pan · F: selected · A: fit graph":"Rueda: zoom · arrastrar fondo o botón central: desplazar · F: centrar · A: encajar","Minimap":"Minimapa","Click minimap to navigate":"Hacé clic en el minimapa para navegar","No entities match the current filters.":"No hay entidades que coincidan con los filtros.","Clear filters":"Limpiar filtros","Locate node":"Localizar nodo","Not every target is an activation: cameras, routes, and other entities use target differently.":"No todo target es una activación: cámaras, rutas y otras entidades lo usan de forma diferente.","This target has a special meaning for this entity. Change it anyway?":"Este target tiene un significado especial para esta entidad. ¿Cambiarlo igualmente?","Several entities share this targetname. The link may affect all of them. Continue?":"Varias entidades comparten este targetname. La conexión podría afectarlas a todas. ¿Continuar?","This target is the next path point.":"Este target apunta al siguiente punto de ruta.","This target is the camera look-at reference.":"Este target indica hacia dónde mira la cámara.","A target may represent different behavior depending on classname.":"Un target puede tener distintos comportamientos según el classname.","Graph layout and filters do not change GoldSrc entities or MAP export.":"La organización y los filtros no modifican entidades GoldSrc ni la exportación MAP.","Export and compile normally with SC-CSG / BSP / VIS / RAD":"Exportá y compilá normalmente con SC-CSG / BSP / VIS / RAD"});
Object.assign(ru,{"Auto arrange all nodes":"Автоматически расположить узлы","Restore previous layout":"Восстановить предыдущее расположение","Fit visible nodes":"Показать все видимые узлы","Center selected node":"Центрировать выбранный узел","Toggle minimap":"Показать или скрыть миникарту","Search classname, name, target or layer":"Поиск класса, имени, цели или слоя","Search entities":"Поиск сущностей","Clear search":"Очистить поиск","Entity category":"Категория сущностей","All entities":"Все сущности","Triggers and logic":"Триггеры и логика","Brush entities":"Браш-сущности","NPCs and paths":"NPC и маршруты","Camera entities":"Сущности камер","Audio entities":"Звуковые сущности","Other entities":"Другие сущности","visible entities":"видимых сущностей","visible connections":"видимых связей","Selected entity and neighbors":"Выбранная и связанные","Wheel: zoom · drag empty space or middle mouse: pan · F: selected · A: fit graph":"Колесо: масштаб · пустое место / средняя кнопка: панорама · F: центр · A: весь граф","Minimap":"Миникарта","Click minimap to navigate":"Нажмите на миникарту для навигации","No entities match the current filters.":"Нет сущностей, подходящих под фильтры.","Clear filters":"Сбросить фильтры","Locate node":"Найти узел","Not every target is an activation: cameras, routes, and other entities use target differently.":"Не каждый target активирует сущность: камеры, маршруты и другие сущности используют его по-разному.","This target has a special meaning for this entity. Change it anyway?":"Этот target имеет особое значение для сущности. Всё равно изменить?","Several entities share this targetname. The link may affect all of them. Continue?":"Несколько сущностей имеют одинаковый targetname. Связь может затронуть все. Продолжить?","This target is the next path point.":"Этот target указывает на следующую точку пути.","This target is the camera look-at reference.":"Этот target задаёт направление взгляда камеры.","A target may represent different behavior depending on classname.":"Значение target зависит от classname сущности.","Graph layout and filters do not change GoldSrc entities or MAP export.":"Расположение и фильтры не меняют сущности GoldSrc или экспорт MAP.","Export and compile normally with SC-CSG / BSP / VIS / RAD":"Экспорт и компиляция обычным способом с SC-CSG / BSP / VIS / RAD"});
Object.assign(ko,{"Auto arrange all nodes":"노드 자동 정렬","Restore previous layout":"이전 배치 복원","Fit visible nodes":"보이는 노드 맞춤","Center selected node":"선택 노드 가운데 맞춤","Toggle minimap":"미니맵 표시 전환","Search classname, name, target or layer":"클래스명, 이름, 대상, 레이어 검색","Search entities":"엔티티 검색","Clear search":"검색 지우기","Entity category":"엔티티 범주","All entities":"모든 엔티티","Triggers and logic":"트리거 및 로직","Brush entities":"브러시 엔티티","NPCs and paths":"NPC 및 경로","Camera entities":"카메라 엔티티","Audio entities":"오디오 엔티티","Other entities":"기타 엔티티","visible entities":"표시된 엔티티","visible connections":"표시된 연결","Selected entity and neighbors":"선택 항목 및 연결된 노드","Wheel: zoom · drag empty space or middle mouse: pan · F: selected · A: fit graph":"휠: 확대/축소 · 빈 곳 드래그 또는 가운데 버튼: 이동 · F: 선택 · A: 전체 맞춤","Minimap":"미니맵","Click minimap to navigate":"미니맵을 클릭하여 이동","No entities match the current filters.":"현재 필터에 맞는 엔티티가 없습니다.","Clear filters":"필터 초기화","Locate node":"노드 찾기","Not every target is an activation: cameras, routes, and other entities use target differently.":"모든 target이 활성화용은 아닙니다. 카메라, 경로 및 다른 엔티티는 다르게 사용합니다.","This target has a special meaning for this entity. Change it anyway?":"이 엔티티의 target에는 특별한 의미가 있습니다. 그래도 변경할까요?","Several entities share this targetname. The link may affect all of them. Continue?":"여러 엔티티가 같은 targetname을 사용합니다. 연결이 모두에 영향을 줄 수 있습니다. 계속할까요?","This target is the next path point.":"이 target은 다음 경로 지점을 가리킵니다.","This target is the camera look-at reference.":"이 target은 카메라가 바라볼 대상을 지정합니다.","A target may represent different behavior depending on classname.":"target의 의미는 classname에 따라 다를 수 있습니다.","Graph layout and filters do not change GoldSrc entities or MAP export.":"그래프 배치와 필터는 GoldSrc 엔티티나 MAP 내보내기를 변경하지 않습니다.","Export and compile normally with SC-CSG / BSP / VIS / RAD":"SC-CSG / BSP / VIS / RAD로 정상적으로 내보내고 컴파일하세요"});

// Preview 5 — Custom NPC Importer. GoldSrc/AngelScript classnames and paths are not translated.
Object.assign(es,{
 'Custom NPC Importer':'Importador de NPC personalizados','Import Custom NPC (AngelScript)':'Importar NPC personalizado (AngelScript)',
 'AngelScript custom entities — read-only import, no execution':'Entidades AngelScript — importación sin ejecutar código',
 'Imported NPC definitions':'NPC personalizados importados','No custom NPCs registered in this project yet.':'Todavía no hay NPC personalizados registrados en el proyecto.',
 'Remove definition':'Quitar definición','Removing a definition does not delete entities already placed in the map.':'Quitar la definición no elimina las entidades ya colocadas.',
 'Import existing AngelScript sources':'Importar scripts AngelScript existentes','Select .as files':'Seleccionar archivos .as','Select NPC folder':'Seleccionar carpeta de NPC',
 'Select all related .as files, including relative #include dependencies. No code is run by the editor.':'Seleccioná todos los .as relacionados, incluidos los #include. El editor no ejecuta los scripts.',
 'detected classnames':'clases detectadas','Entity classname':'Classname de la entidad','NPC description':'Descripción del NPC','Main .as script':'Script .as principal',
 'Registration function (if no MapInit)':'Función de registro (si no tiene MapInit)','Model path':'Ruta del modelo','Suggested registration functions':'Funciones de registro sugeridas',
 'Optional custom .FGD':'FGD personalizado opcional','Register in this project':'Registrar en este proyecto','Prepare game package':'Preparar paquete del juego',
 'Export an additive ZIP containing the .as scripts, selected assets, and an installation guide for svencoop_addon.':'Exporta un ZIP con scripts .as, recursos seleccionados y una guía de instalación en svencoop_addon.',
 'Target map':'Mapa de destino','Add resource files':'Agregar carpeta de recursos','assets selected':'recursos seleccionados',
 'Use paths beginning with models/, sound/, sprites/, gfx/ or events/.':'Usá rutas dentro de models/, sound/, sprites/, gfx/ o events/.',
 'Download install ZIP':'Descargar ZIP instalable','The bundle NEVER overwrites an existing map CFG; add the map_script line manually. A static validator cannot prove AngelScript runtime compatibility.':'El paquete NUNCA sobrescribe un CFG existente; agregá la línea map_script manualmente. La validación estática no garantiza compatibilidad con AngelScript.',
 'No changes to BSP compiler, brush geometry, FGD parser or installed game files.':'No modifica compiladores BSP, brushes, parser FGD ni archivos instalados del juego.',
 'saved':'guardado','Scripts are only read and packaged; never executed in the editor.':'Los scripts solo se leen y empaquetan; nunca se ejecutan en el editor.'
});
Object.assign(ru,{
 'Custom NPC Importer':'Импорт пользовательских NPC','Import Custom NPC (AngelScript)':'Импорт NPC (AngelScript)',
 'AngelScript custom entities — read-only import, no execution':'Сущности AngelScript — импорт без выполнения кода',
 'Imported NPC definitions':'Импортированные NPC','No custom NPCs registered in this project yet.':'В проекте пока нет пользовательских NPC.',
 'Remove definition':'Удалить определение','Removing a definition does not delete entities already placed in the map.':'Удаление определения не удаляет сущности с карты.',
 'Import existing AngelScript sources':'Импорт исходников AngelScript','Select .as files':'Выбрать файлы .as','Select NPC folder':'Выбрать папку NPC',
 'Select all related .as files, including relative #include dependencies. No code is run by the editor.':'Выберите все связанные .as, включая зависимости #include. Код не выполняется.',
 'detected classnames':'найденных классов','Entity classname':'Имя класса сущности','NPC description':'Описание NPC','Main .as script':'Основной скрипт .as',
 'Registration function (if no MapInit)':'Функция регистрации (без MapInit)','Model path':'Путь к модели','Suggested registration functions':'Возможные функции регистрации',
 'Optional custom .FGD':'Дополнительный FGD','Register in this project':'Зарегистрировать в проекте','Prepare game package':'Подготовить игровой пакет',
 'Export an additive ZIP containing the .as scripts, selected assets, and an installation guide for svencoop_addon.':'ZIP со скриптами, ресурсами и инструкцией установки в svencoop_addon.',
 'Target map':'Целевая карта','Add resource files':'Добавить ресурсы','assets selected':'выбрано ресурсов',
 'Use paths beginning with models/, sound/, sprites/, gfx/ or events/.':'Используйте папки models/, sound/, sprites/, gfx/ или events/.',
 'Download install ZIP':'Скачать ZIP-пакет','The bundle NEVER overwrites an existing map CFG; add the map_script line manually. A static validator cannot prove AngelScript runtime compatibility.':'Пакет не перезаписывает CFG карты. Добавьте строку map_script вручную. Совместимость с AngelScript проверяется в игре.',
 'No changes to BSP compiler, brush geometry, FGD parser or installed game files.':'Компилятор BSP, геометрия, FGD и файлы игры не изменяются.',
 'saved':'сохранено','Scripts are only read and packaged; never executed in the editor.':'Скрипты только читаются и упаковываются, но не выполняются.'
});
Object.assign(ko,{
 'Custom NPC Importer':'커스텀 NPC 가져오기','Import Custom NPC (AngelScript)':'커스텀 NPC 가져오기 (AngelScript)',
 'AngelScript custom entities — read-only import, no execution':'AngelScript 엔티티 — 실행 없이 가져오기',
 'Imported NPC definitions':'가져온 커스텀 NPC','No custom NPCs registered in this project yet.':'프로젝트에 커스텀 NPC가 없습니다.',
 'Remove definition':'정의 제거','Removing a definition does not delete entities already placed in the map.':'정의를 제거해도 맵에 배치한 엔티티는 삭제되지 않습니다.',
 'Import existing AngelScript sources':'기존 AngelScript 소스 가져오기','Select .as files':'.as 파일 선택','Select NPC folder':'NPC 폴더 선택',
 'Select all related .as files, including relative #include dependencies. No code is run by the editor.':'#include 종속성을 포함한 .as 파일을 선택하세요. 코드는 실행되지 않습니다.',
 'detected classnames':'감지된 클래스','Entity classname':'엔티티 클래스명','NPC description':'NPC 설명','Main .as script':'메인 .as 스크립트',
 'Registration function (if no MapInit)':'등록 함수 (MapInit 없을 때)','Model path':'모델 경로','Suggested registration functions':'추천 등록 함수',
 'Optional custom .FGD':'선택적 커스텀 FGD','Register in this project':'프로젝트에 등록','Prepare game package':'게임 패키지 준비',
 'Export an additive ZIP containing the .as scripts, selected assets, and an installation guide for svencoop_addon.':'스크립트, 리소스, 설치 안내를 포함한 svencoop_addon용 ZIP.',
 'Target map':'대상 맵','Add resource files':'리소스 추가','assets selected':'선택한 리소스',
 'Use paths beginning with models/, sound/, sprites/, gfx/ or events/.':'models/, sound/, sprites/, gfx/, events/ 경로를 사용하세요.',
 'Download install ZIP':'설치 ZIP 다운로드','The bundle NEVER overwrites an existing map CFG; add the map_script line manually. A static validator cannot prove AngelScript runtime compatibility.':'기존 맵 CFG를 덮어쓰지 않습니다. map_script는 직접 추가하세요. 실제 호환성은 게임에서 확인해야 합니다.',
 'No changes to BSP compiler, brush geometry, FGD parser or installed game files.':'BSP 컴파일러, 브러시, FGD, 설치된 게임 파일은 변경하지 않습니다.',
 'saved':'저장됨','Scripts are only read and packaged; never executed in the editor.':'스크립트를 읽고 패키징만 하며 편집기에서 실행하지 않습니다.'
});

// Preview 1.1.0 — Map Packager Studio translations (es).
Object.assign(es,{
  'Map Packager Studio':'Estudio de empaquetado de mapas',
  'Review local map dependencies · Sven Co-op / Svengine':'Revisar dependencias locales · Sven Co-op / Svengine',
  'Package settings':'Configuración del paquete',
  'Compiled map':'Mapa compilado',
  'Game folder':'Carpeta del juego',
  'Not configured':'Sin configurar',
  'Uses the compiled BSP in your configured maps folder. Compile your latest changes before scanning.':'Usa el BSP compilado en la carpeta maps configurada. Compilá los últimos cambios antes de analizar.',
  'Include registered Custom NPC scripts':'Incluir scripts de NPC personalizados registrados',
  'Scripts are packaged as source, never executed. Existing CFG files are not changed.':'Los scripts se empaquetan sin ejecutarse. No se modifican los CFG existentes.',
  'Additional game-relative paths (one per line)':'Rutas adicionales relativas al juego (una por línea)',
  'Analyze resources':'Analizar recursos',
  'Working...':'Procesando...',
  'Paths must be relative to the Sven Co-op game folder. No files are modified.':'Las rutas deben ser relativas a Sven Co-op. No se modifica ningún archivo.',
  'Dependency Inspector':'Inspector de dependencias',
  'resources':'recursos',
  'Missing':'Faltantes',
  'Game built-in':'Del juego base',
  'BSP entities':'Entidades BSP',
  'All':'Todos',
  'Analyze a compiled BSP to inspect resources before creating an archive.':'Analizá un BSP compilado para revisar los recursos antes de crear el ZIP.',
  'Package review':'Revisión del paquete',
  'ZIP contents are placed at the root: maps/, models/, sound/, sprites/, gfx/ and scripts/maps/. Extract into svencoop_addon/.':'El ZIP contiene carpetas maps/, models/, sound/, sprites/, gfx/ y scripts/maps/ en la raíz. Extraelo en svencoop_addon/.',
  'Warnings':'Advertencias',
  'Custom NPC setup':'Configuración de NPC personalizados',
  'If not already present, add these lines to your existing map CFG manually:':'Si no están agregadas, incorporá estas líneas manualmente al CFG existente:',
  'I understand the package is incomplete and want to create it anyway.':'Entiendo que faltan recursos y quiero generar el ZIP igualmente.',
  'Generate ZIP':'Generar ZIP',
  'Read-only scan. Does not alter CFG, scripts, brushes, compiler settings or installed assets.':'Análisis de solo lectura. No modifica CFG, scripts, brushes, compiladores ni archivos del juego.',
  'AngelScript dynamic dependencies and third-party redistribution rights require manual verification.':'Las dependencias dinámicas AngelScript y las licencias de terceros necesitan revisión manual.',
  'Select Analyze resources to begin.':'Seleccioná Analizar recursos para comenzar.',
  'Conflicting Custom NPC scripts':'Scripts de NPC incompatibles',
  'ready resources':'recursos listos',
  'missing resources':'recursos faltantes',
  'Package created':'ZIP generado',
  'Review ZIP before sharing':'Revisá el ZIP antes de compartirlo',
});

// Preview 1.1.0 — Map Packager Studio translations (ru).
Object.assign(ru,{
  'Map Packager Studio':'Студия упаковки карт',
  'Review local map dependencies · Sven Co-op / Svengine':'Проверка локальных ресурсов · Sven Co-op / Svengine',
  'Package settings':'Настройки пакета',
  'Compiled map':'Скомпилированная карта',
  'Game folder':'Папка игры',
  'Not configured':'Не настроено',
  'Uses the compiled BSP in your configured maps folder. Compile your latest changes before scanning.':'Используется BSP из папки maps. Перед проверкой соберите карту.',
  'Include registered Custom NPC scripts':'Включить скрипты пользовательских NPC',
  'Scripts are packaged as source, never executed. Existing CFG files are not changed.':'Скрипты только упаковываются. CFG не изменяются.',
  'Additional game-relative paths (one per line)':'Дополнительные пути в игре (по одному в строке)',
  'Analyze resources':'Проверить ресурсы',
  'Working...':'Выполняется...',
  'Paths must be relative to the Sven Co-op game folder. No files are modified.':'Пути должны быть относительно папки игры. Файлы не изменяются.',
  'Dependency Inspector':'Инспектор зависимостей',
  'resources':'ресурсов',
  'Missing':'Отсутствуют',
  'Game built-in':'Из основной игры',
  'BSP entities':'Сущностей BSP',
  'All':'Все',
  'Analyze a compiled BSP to inspect resources before creating an archive.':'Проверьте BSP перед созданием архива.',
  'Package review':'Проверка пакета',
  'ZIP contents are placed at the root: maps/, models/, sound/, sprites/, gfx/ and scripts/maps/. Extract into svencoop_addon/.':'В ZIP папки находятся в корне. Извлекайте в svencoop_addon/.',
  'Warnings':'Предупреждения',
  'Custom NPC setup':'Настройка пользовательских NPC',
  'If not already present, add these lines to your existing map CFG manually:':'Если этих строк нет, вручную добавьте их в CFG карты:',
  'I understand the package is incomplete and want to create it anyway.':'Я понимаю, что ресурсы отсутствуют, и хочу создать ZIP.',
  'Generate ZIP':'Создать ZIP',
  'Read-only scan. Does not alter CFG, scripts, brushes, compiler settings or installed assets.':'Сканирование без изменений CFG, скриптов, геометрии и файлов игры.',
  'AngelScript dynamic dependencies and third-party redistribution rights require manual verification.':'Динамические зависимости AngelScript и лицензии нужно проверить вручную.',
  'Select Analyze resources to begin.':'Нажмите Проверить ресурсы.',
  'Conflicting Custom NPC scripts':'Конфликт скриптов NPC',
  'ready resources':'готовых ресурсов',
  'missing resources':'отсутствующих ресурсов',
  'Package created':'Пакет создан',
  'Review ZIP before sharing':'Проверьте ZIP перед публикацией',
});

// Preview 1.1.0 — Map Packager Studio translations (ko).
Object.assign(ko,{
  'Map Packager Studio':'맵 패키징 스튜디오',
  'Review local map dependencies · Sven Co-op / Svengine':'로컬 맵 리소스 검사 · Sven Co-op / Svengine',
  'Package settings':'패키지 설정',
  'Compiled map':'컴파일된 맵',
  'Game folder':'게임 폴더',
  'Not configured':'설정되지 않음',
  'Uses the compiled BSP in your configured maps folder. Compile your latest changes before scanning.':'설정된 maps 폴더의 BSP를 사용합니다. 검사 전에 최신 변경 사항을 컴파일하세요.',
  'Include registered Custom NPC scripts':'등록한 커스텀 NPC 스크립트 포함',
  'Scripts are packaged as source, never executed. Existing CFG files are not changed.':'스크립트는 실행 없이 포함됩니다. 기존 CFG는 수정하지 않습니다.',
  'Additional game-relative paths (one per line)':'추가 게임 상대 경로 (줄당 하나)',
  'Analyze resources':'리소스 검사',
  'Working...':'처리 중...',
  'Paths must be relative to the Sven Co-op game folder. No files are modified.':'경로는 게임 폴더 기준이어야 합니다. 파일은 수정되지 않습니다.',
  'Dependency Inspector':'종속성 검사기',
  'resources':'리소스',
  'Missing':'누락',
  'Game built-in':'기본 게임',
  'BSP entities':'BSP 엔티티',
  'All':'전체',
  'Analyze a compiled BSP to inspect resources before creating an archive.':'ZIP 생성 전 컴파일된 BSP를 검사하세요.',
  'Package review':'패키지 검토',
  'ZIP contents are placed at the root: maps/, models/, sound/, sprites/, gfx/ and scripts/maps/. Extract into svencoop_addon/.':'ZIP 루트에 폴더가 들어갑니다. svencoop_addon/에 압축을 푸세요.',
  'Warnings':'경고',
  'Custom NPC setup':'커스텀 NPC 설정',
  'If not already present, add these lines to your existing map CFG manually:':'없다면 기존 맵 CFG에 다음 줄을 직접 추가하세요:',
  'I understand the package is incomplete and want to create it anyway.':'리소스 누락을 이해하고 ZIP을 생성하겠습니다.',
  'Generate ZIP':'ZIP 생성',
  'Read-only scan. Does not alter CFG, scripts, brushes, compiler settings or installed assets.':'CFG, 스크립트, 브러시, 컴파일러, 게임 파일을 수정하지 않습니다.',
  'AngelScript dynamic dependencies and third-party redistribution rights require manual verification.':'AngelScript 동적 종속성과 제3자 재배포 권한은 수동으로 확인해야 합니다.',
  'Select Analyze resources to begin.':'리소스 검사를 눌러 시작하세요.',
  'Conflicting Custom NPC scripts':'커스텀 NPC 스크립트 충돌',
  'ready resources':'준비된 리소스',
  'missing resources':'누락 리소스',
  'Package created':'패키지 생성됨',
  'Review ZIP before sharing':'공유 전 ZIP을 확인하세요',
});


// v1.2.0: Terrain & Shape Studio. Classnames, geometry keys and game assets remain untranslated.
Object.assign(es,{
  'Terrain & Shape Studio':'Estudio de terrenos y formas',
  'Convex brush geometry · Sven Co-op / Svengine':'Geometría de brushes convexos · Sven Co-op / Svengine',
  'Sculpt Terrain':'Esculpir terreno','Rock & Cliff Generator':'Generador de rocas y acantilados',
  'Terrain group':'Grupo de terreno','New terrain':'Nuevo terreno','Width':'Ancho','Depth':'Profundidad',
  'Grid resolution':'Resolución de cuadrícula','Raise':'Elevar','Lower':'Bajar','Smooth':'Suavizar',
  'Flatten':'Aplanar','Noise':'Ruido','Brush radius':'Radio del pincel','Brush strength':'Intensidad del pincel',
  'Flatten entire preview':'Aplanar toda la vista previa','Rocks':'Rocas','Cluster radius':'Radio del conjunto',
  'Rock height':'Altura de las rocas','Random seed':'Semilla aleatoria',
  'Convex rock brushes with a reproducible seed. No models or Source displacements.':'Rocas con brushes convexos y semilla repetible. Sin modelos ni displacements de Source.',
  'GoldSrc texture':'Textura GoldSrc','Use selected WAD texture':'Usar textura WAD seleccionada',
  'Placement center (X / Y / Z)':'Centro de colocación (X / Y / Z)',
  'Use selected object position':'Usar posición del objeto seleccionado',
  'Select an object in the map first.':'Seleccioná antes un objeto del mapa.',
  'Placement position copied from selection.':'Posición de colocación tomada de la selección.',
  'Interactive preview':'Vista previa interactiva','Sculpt with mouse':'Esculpir con mouse','Orbit / inspect':'Orbitar / inspeccionar',
  'rocks':'rocas','Drag the left mouse button on the terrain to sculpt. Switch to Orbit to inspect.':'Arrastrá el botón izquierdo sobre el terreno para esculpir. Usá Orbitar para inspeccionar.',
  'Drag to orbit; use the wheel to zoom. Switch to Sculpt to edit.':'Arrastrá para orbitar y usá la rueda para acercar. Elegí Esculpir para editar.',
  'Drag to orbit; wheel to zoom. Rocks are previewed before placement.':'Arrastrá para orbitar y usá la rueda para acercar. Las rocas se ven antes de colocarlas.',
  'Exports only convex planar Valve 220 brushes. The preview does not compile BSP or seal leaks.':'Exporta únicamente brushes planos y convexos Valve 220. La vista previa no compila BSP ni sella fugas.',
  'No changes to the map until Apply. Undo/Redo supported.':'El mapa no cambia hasta aplicar. Compatible con Deshacer/Rehacer.',
  'Add terrain to map':'Agregar terreno al mapa','Update terrain safely':'Actualizar terreno de forma segura','Add rocks to map':'Agregar rocas al mapa',
  'convex brushes added or safely updated. Use Undo to revert.':'brushes convexos agregados o actualizados. Usá Deshacer para revertir.',
  'convex rocks added. Use Undo to revert.':'rocas convexas agregadas. Usá Deshacer para revertir.',
  'Loaded terrain for editing. Existing geometry will be checked before replacement.':'Terreno cargado para editar. Se verificará la geometría antes de reemplazarla.'
});
Object.assign(ru,{
  'Terrain & Shape Studio':'Студия ландшафта и форм','Sculpt Terrain':'Лепка ландшафта','Rock & Cliff Generator':'Генератор скал',
  'Terrain group':'Группа ландшафта','New terrain':'Новый ландшафт','Width':'Ширина','Depth':'Глубина',
  'Grid resolution':'Разрешение сетки','Raise':'Поднять','Lower':'Опустить','Smooth':'Сгладить','Flatten':'Выровнять','Noise':'Шум',
  'Brush radius':'Радиус кисти','Brush strength':'Сила кисти','Flatten entire preview':'Сбросить высоты',
  'Rocks':'Скалы','Cluster radius':'Радиус группы','Rock height':'Высота скал','Random seed':'Случайное зерно',
  'GoldSrc texture':'Текстура GoldSrc','Use selected WAD texture':'Выбрать текущую WAD-текстуру',
  'Placement center (X / Y / Z)':'Центр размещения (X / Y / Z)','Use selected object position':'Взять позицию выделенного объекта',
  'Interactive preview':'Интерактивный просмотр','Sculpt with mouse':'Лепить мышью','Orbit / inspect':'Вращение / осмотр',
  'Add terrain to map':'Добавить ландшафт','Update terrain safely':'Безопасно обновить ландшафт','Add rocks to map':'Добавить скалы',
  'No changes to the map until Apply. Undo/Redo supported.':'Карта не меняется до применения. Поддерживаются отмена и повтор.',
  'Exports only convex planar Valve 220 brushes. The preview does not compile BSP or seal leaks.':'Экспортируются только выпуклые плоские браши Valve 220. Просмотр не компилирует BSP и не закрывает утечки.',
  'Convex brush geometry · Sven Co-op / Svengine':'Выпуклая геометрия · Sven Co-op / Svengine',
  'Drag the left mouse button on the terrain to sculpt. Switch to Orbit to inspect.':'Тяните левой кнопкой для лепки. Включите вращение для осмотра.',
  'Drag to orbit; use the wheel to zoom. Switch to Sculpt to edit.':'Тяните для вращения, колесо для масштаба. Для правки включите лепку.',
  'Drag to orbit; wheel to zoom. Rocks are previewed before placement.':'Тяните для вращения, колесо для масштаба. Скалы видны до размещения.'
});
Object.assign(ko,{
  'Terrain & Shape Studio':'지형 및 형태 스튜디오','Sculpt Terrain':'지형 조각','Rock & Cliff Generator':'바위 및 절벽 생성',
  'Terrain group':'지형 그룹','New terrain':'새 지형','Width':'너비','Depth':'깊이',
  'Grid resolution':'격자 해상도','Raise':'올리기','Lower':'내리기','Smooth':'부드럽게','Flatten':'평탄화','Noise':'노이즈',
  'Brush radius':'브러시 반경','Brush strength':'브러시 강도','Flatten entire preview':'전체 평탄화',
  'Rocks':'바위','Cluster radius':'군집 반경','Rock height':'바위 높이','Random seed':'무작위 시드',
  'GoldSrc texture':'GoldSrc 텍스처','Use selected WAD texture':'선택한 WAD 텍스처 사용',
  'Placement center (X / Y / Z)':'배치 중심 (X / Y / Z)','Use selected object position':'선택 개체 위치 사용',
  'Interactive preview':'대화형 미리보기','Sculpt with mouse':'마우스로 조각','Orbit / inspect':'회전 / 검사',
  'Add terrain to map':'맵에 지형 추가','Update terrain safely':'지형 안전하게 갱신','Add rocks to map':'맵에 바위 추가',
  'No changes to the map until Apply. Undo/Redo supported.':'적용 전까지 맵은 변경되지 않습니다. 실행 취소/다시 실행 지원.',
  'Exports only convex planar Valve 220 brushes. The preview does not compile BSP or seal leaks.':'볼록한 평면 Valve 220 브러시만 내보냅니다. 미리보기는 BSP 컴파일이나 누수를 막지 않습니다.',
  'Convex brush geometry · Sven Co-op / Svengine':'볼록 브러시 지오메트리 · Sven Co-op / Svengine',
  'Drag the left mouse button on the terrain to sculpt. Switch to Orbit to inspect.':'마우스 왼쪽 버튼을 드래그해 조각하세요. 회전 모드에서 확인하세요.',
  'Drag to orbit; use the wheel to zoom. Switch to Sculpt to edit.':'드래그하여 회전하고 휠로 확대하세요. 조각 모드에서 편집하세요.',
  'Drag to orbit; wheel to zoom. Rocks are previewed before placement.':'드래그하여 회전하고 휠로 확대하세요. 배치 전에 바위를 확인하세요.'
});

Object.assign(es,{'High brush count: start with 4×4 or 8×8 for performance. More segments increase BSP compile cost.': 'Muchos brushes: comenzá con 4×4 u 8×8 para evitar problemas de rendimiento. Más segmentos aumentan el costo de compilación BSP.'});

Object.assign(ru,{'High brush count: start with 4×4 or 8×8 for performance. More segments increase BSP compile cost.': 'Слишком много брашей: начните с 4×4 или 8×8. Больше сегментов увеличивают стоимость компиляции BSP.'});

Object.assign(ko,{'High brush count: start with 4×4 or 8×8 for performance. More segments increase BSP compile cost.': '브러시 수가 많습니다. 성능을 위해 4×4 또는 8×8부터 시작하세요. 분할 수가 늘면 BSP 컴파일 부담이 커집니다.'});


// Preview 2: terrain click placement and WAD texture selection (UI only).
Object.assign(es,{
  'Place by clicking map':'Colocar con clic en el mapa',
  'Apply at X/Y/Z':'Aplicar en X/Y/Z',
  'Filter WAD':'Filtrar WAD','No matching textures.':'No hay texturas que coincidan.',
  'Import WAD file':'Importar archivo WAD','Importing WAD...':'Importando WAD...',
  'WAD import error':'Error al importar WAD',
  'WAD files imported into texture browser.':'WAD importados al navegador de texturas.',
  'Texture preview unavailable. Import the matching WAD.':'Vista previa no disponible. Importá el WAD correspondiente.'
});
Object.assign(ru,{
  'Place by clicking map':'Разместить щелчком на карте',
  'Apply at X/Y/Z':'Применить в X/Y/Z',
  'Filter WAD':'Фильтр WAD','No matching textures.':'Текстуры не найдены.',
  'Import WAD file':'Импортировать WAD','Importing WAD...':'Импорт WAD...',
  'WAD import error':'Ошибка импорта WAD',
  'WAD files imported into texture browser.':'WAD добавлены в браузер текстур.',
  'Texture preview unavailable. Import the matching WAD.':'Нет предпросмотра. Импортируйте нужный WAD.'
});
Object.assign(ko,{
  'Place by clicking map':'맵을 클릭해서 배치',
  'Apply at X/Y/Z':'X/Y/Z 좌표에 적용',
  'Filter WAD':'WAD 필터','No matching textures.':'일치하는 텍스처가 없습니다.',
  'Import WAD file':'WAD 파일 가져오기','Importing WAD...':'WAD 가져오는 중...',
  'WAD import error':'WAD 가져오기 오류',
  'WAD files imported into texture browser.':'WAD가 텍스처 브라우저에 추가되었습니다.',
  'Texture preview unavailable. Import the matching WAD.':'미리보기가 없습니다. 해당 WAD를 가져오세요.'
});

// Preview 3: solid terrain preview matches generated triangular prisms and configurable base.
Object.assign(es,{
  'Base depth (units)':'Profundidad de la base (unidades)',
  'Base extends below the terrain. Deep valleys require an extra 64 units of clearance.':'La base se extiende hacia abajo. Los valles profundos necesitan 64 unidades adicionales de margen.',
  'Solid terrain (base visible)':'Terreno sólido (base visible)',
  'Top surface only':'Solo superficie superior',
  'Base bottom relative to placement Z':'Fondo de la base respecto de Z',
  'Terrain is a solid volume, not a hollow shell.':'El terreno es un volumen sólido, no una capa hueca.'
});
Object.assign(ru,{
  'Base depth (units)':'Глубина основания (ед.)',
  'Base extends below the terrain. Deep valleys require an extra 64 units of clearance.':'Основание уходит вниз; для глубоких долин сохраняется запас 64 единицы.',
  'Solid terrain (base visible)':'Цельный ландшафт (основание)',
  'Top surface only':'Только верхняя поверхность',
  'Base bottom relative to placement Z':'Низ основания относительно Z',
  'Terrain is a solid volume, not a hollow shell.':'Ландшафт — объёмное тело, а не пустая оболочка.'
});
Object.assign(ko,{
  'Base depth (units)':'기반 깊이 (단위)',
  'Base extends below the terrain. Deep valleys require an extra 64 units of clearance.':'바닥은 지형 아래로 연장되며 깊은 골짜기에는 64단위 여유를 둡니다.',
  'Solid terrain (base visible)':'솔리드 지형 (바닥 표시)',
  'Top surface only':'윗면만 표시',
  'Base bottom relative to placement Z':'배치 Z 기준 바닥 위치',
  'Terrain is a solid volume, not a hollow shell.':'지형은 빈 껍질이 아닌 솔리드 볼륨입니다.'
});

// v1.2.0 Preview 4 — visibility, viewport forms and face scaling.
Object.assign(es,{
 'Hidden and previously hidden objects remain listed. Focus shows hidden brushes as ghosts without unhiding them.':'Los objetos ocultos y anteriormente ocultos permanecen en la lista. Enfocar muestra el brush oculto como fantasma sin reactivarlo.',
 'Shape Studio':'Estudio de formas','Shape width':'Ancho','Shape depth':'Profundidad','Shape height':'Altura',
 'Choose a shape and size it before placing it with the mouse.':'Elegí una forma y sus dimensiones antes de colocarla con el mouse.',
 'Right click or Esc to cancel drawing.':'Clic derecho o Esc para cancelar el dibujo.',
 'Scale by dragging one of the six face arrows.':'Escalá arrastrando cualquiera de las seis flechas de las caras.'
});

// Preview 5 — concise professional labels in every language. GoldSrc
// classname, keyvalues, textures, compiler messages and filenames stay original.
Object.assign(es,{
  'Map Packager Studio':'Empaquetador de mapas','Gameplay Studio':'Lógica de juego',
  'Cinematic Camera Studio':'Cámaras cinematográficas','NPC & AI Studio':'NPC y rutas',
  'Terrain & Shape Studio':'Terrenos y geometría','Lighting & Environment Studio':'Iluminación y entorno',
  'Audio Studio':'Editor de audio','Sound Studio':'Editor de audio',
  'Shape Studio':'Formas y geometría','Shapes':'Formas','Ghost mode':'Ver ocultos',
  'Show entity names':'Mostrar etiquetas de entidades','Labels':'Etiquetas',
  'Entity visuals':'Apariencia de entidades','Visibility manager':'Visibilidad de objetos',
  'Map Doctor':'Diagnóstico del mapa','Studios':'Estudios','brushes':'brushes',
  'Basic shapes':'Primitivas','Architecture shapes':'Estructuras',
  'Draw a box':'Dibujar bloque','Stop drawing':'Salir de dibujo','Drag in the 3D viewport':'Arrastrar para definir',
  'Wall openings':'Aberturas en paredes','Door opening':'Abertura de puerta','Window opening':'Abertura de ventana',
  'Door and window openings cut a selected worldspawn box wall. They do not add a second wall.':'Las aberturas modifican una pared rectangular de worldspawn, sin superponer otra pared.',
  'Drawing height':'Altura de dibujo','Left drag to draw; right click or Esc to cancel.':'Arrastrá con clic izquierdo para dibujar. Clic derecho o Esc para salir.',
  'Select a wall and click where the opening should go.':'Elegí una pared y hacé clic en el lugar de la abertura.',
  'Wall':'Pared','Slab':'Losa','Beam':'Viga','Column':'Columna','Ramp':'Rampa',
  'Frame':'Marco','Room':'Habitación','Roof':'Techo','Corner':'Esquina',
  'Platform':'Plataforma','Bridge':'Puente','Barrier':'Barrera','Steps':'Peldaños',
  'Stairs':'Escalera','Vault':'Bóveda','Cone':'Cono','Pyramid':'Pirámide','Icosphere':'Esfera poligonal','Pipe':'Tubería',
  'Shape width':'Ancho','Shape height':'Altura','Shape depth':'Profundidad',
  'Doorframe':'Marco de puerta','Windowframe':'Marco de ventana',
  'Show hidden':'Mostrar objetos ocultos','Focus ghost':'Localizar oculto',
});
Object.assign(ru,{
  'Map Packager Studio':'Упаковка карты','Gameplay Studio':'Логика карты',
  'Cinematic Camera Studio':'Кинематографические камеры','NPC & AI Studio':'NPC и маршруты',
  'Terrain & Shape Studio':'Рельеф и геометрия','Shape Studio':'Геометрия',
  'Ghost mode':'Показать скрытые','Labels':'Метки сущностей',
  'Basic shapes':'Примитивы','Architecture shapes':'Конструкции','Draw a box':'Нарисовать блок',
  'Stop drawing':'Выйти из рисования','Drag in the 3D viewport':'Тяните в окне 3D',
  'Wall openings':'Проёмы в стене','Door opening':'Дверной проём','Window opening':'Оконный проём',
  'Door and window openings cut a selected worldspawn box wall. They do not add a second wall.':'Вырезает проём в прямоугольной стене worldspawn, не добавляя вторую стену.',
  'Drawing height':'Высота рисования','Left drag to draw; right click or Esc to cancel.':'Тяните ЛКМ для рисования. ПКМ или Esc — выход.',
  'Select a wall and click where the opening should go.':'Выберите стену и укажите место проёма.',
  'Doorframe':'Дверная рама','Windowframe':'Оконная рама',
  'Wall':'Стена','Slab':'Плита','Beam':'Балка','Column':'Колонна','Ramp':'Пандус',
  'Frame':'Рама','Room':'Комната','Roof':'Крыша','Corner':'Угол',
  'Platform':'Платформа','Bridge':'Мост','Barrier':'Барьер','Steps':'Ступени'
});
Object.assign(ko,{
  'Map Packager Studio':'맵 패키저','Gameplay Studio':'맵 로직',
  'Cinematic Camera Studio':'시네마틱 카메라','NPC & AI Studio':'NPC 및 경로',
  'Terrain & Shape Studio':'지형과 지오메트리','Shape Studio':'도형 및 지오메트리',
  'Ghost mode':'숨긴 개체 보기','Labels':'엔티티 레이블',
  'Basic shapes':'기본 도형','Architecture shapes':'건축 구조물','Draw a box':'블록 그리기',
  'Stop drawing':'그리기 종료','Drag in the 3D viewport':'3D 뷰에서 드래그',
  'Wall openings':'벽 개구부','Door opening':'문 개구부','Window opening':'창문 개구부',
  'Door and window openings cut a selected worldspawn box wall. They do not add a second wall.':'선택한 worldspawn 사각 벽에 구멍을 만듭니다. 벽을 중복 생성하지 않습니다.',
  'Drawing height':'그리기 높이','Left drag to draw; right click or Esc to cancel.':'왼쪽 드래그로 그리기, 오른쪽 클릭/Esc로 취소',
  'Select a wall and click where the opening should go.':'벽을 선택하고 개구부 위치를 클릭하세요.',
  'Doorframe':'문틀','Windowframe':'창틀',
  'Wall':'벽','Slab':'슬래브','Beam':'보','Column':'기둥','Ramp':'경사로',
  'Frame':'프레임','Room':'방','Roof':'지붕','Corner':'모서리',
  'Platform':'플랫폼','Bridge':'다리','Barrier':'장벽','Steps':'계단 단차'
});
// English fallback is intentional for the specialized tools not translated yet.
// These core interface dictionaries cover the navigation and new workflow.
Object.assign(zh,{
  'File':'文件','Help':'帮助','New project':'新建项目','Open project':'打开项目','Import .MAP':'导入 .MAP',
  'Save project':'保存项目','Save':'保存','Export Svengine .MAP':'导出 Svengine .MAP',
  'Compile Map':'编译地图','Stop Build':'停止编译','Build configuration':'编译设置',
  'Map name':'地图名称','Compiler folder':'编译器目录','Game directory':'游戏目录','Save settings':'保存设置',
  'Camera & Gizmo Controls':'相机与操纵轴设置','Camera navigation':'相机导航',
  'Language':'语言','Interface language':'界面语言','Automatic (system language)':'自动（系统语言）',
  'Move':'移动','Rotate':'旋转','Scale':'缩放','Draw':'绘制','Cancel':'取消','Close':'关闭',
  'Undo':'撤销','Redo':'重做','Clone':'复制','Delete':'删除','Properties':'属性',
  'TRANSFORM':'变换','VIEW':'视图','EDIT':'编辑','CREATE':'创建','SELECT':'选择',
  'Studios':'工具','MAP Editor':'MAP 编辑器','BSP Viewer':'BSP 查看器',
  'Map Packager Studio':'地图打包','Gameplay Studio':'地图逻辑','Cinematic Camera Studio':'电影镜头',
  'NPC & AI Studio':'NPC 与路径','Terrain & Shape Studio':'地形与几何','Lighting & Environment Studio':'灯光与环境',
  'Audio Studio':'音频编辑','Map Doctor':'地图诊断','Shape Studio':'形状与几何','Shapes':'形状',
  'Basic shapes':'基本形状','Architecture shapes':'建筑构件','Draw a box':'绘制方块','Stop drawing':'退出绘制',
  'Drag in the 3D viewport':'在 3D 视图中拖动','Wall openings':'墙体开口','Door opening':'门洞','Window opening':'窗洞',
  'Door and window openings cut a selected worldspawn box wall. They do not add a second wall.':'在所选 worldspawn 方形墙体上切割开口，不会叠加第二面墙。',
  'Drawing height':'绘制高度','Left drag to draw; right click or Esc to cancel.':'左键拖动绘制；右键或 Esc 取消。',
  'Select a wall and click where the opening should go.':'选择墙体并单击开口位置。',
  'Shape width':'宽度','Shape height':'高度','Shape depth':'深度',
  'Choose a shape and size it before placing it with the mouse.':'选择形状和尺寸，再使用鼠标放置。',
  'Click a surface to place':'单击表面放置','Right click or Esc to cancel drawing.':'右键或 Esc 取消绘制。',
  'Doorframe':'门框','Windowframe':'窗框',
  'Wall':'墙','Slab':'楼板','Beam':'梁','Column':'柱','Ramp':'坡道','Frame':'框架',
  'Room':'房间','Roof':'屋顶','Corner':'转角','Platform':'平台','Bridge':'桥','Barrier':'护栏','Steps':'台阶',
  'Box':'方块','Wedge':'楔形','Cylinder':'圆柱','Arch':'拱','Vault':'拱顶','Cone':'圆锥',
  'Pyramid':'金字塔','Icosphere':'多面球','Stairs':'楼梯','Pipe':'管道',
  'Texture Browser':'纹理浏览器','Entity Browser':'实体浏览器','Explorer':'资源管理器',
  'World Properties':'世界属性','Visibility manager':'可见性管理','Ghost mode':'显示隐藏物体',
  'Show entity names':'显示实体标签','Labels':'实体标签','Gizmo':'操纵轴','Grid':'网格',
  'Wire':'线框','Snap':'吸附','Height':'高度','Ready':'就绪','Name':'名称','Position':'位置',
  'Rotation':'旋转','Dimensions (units)':'尺寸（单位）','Layer':'图层','Entities':'实体',
  'Geometry':'几何','Perspective':'透视','Textured':'纹理','Object':'对象','Face':'面',
  'Vertex':'顶点','Edge':'边','Output':'输出','Workspace':'工作区','Load Sven Co-op FGD':'加载 Sven Co-op FGD',
  'Frame selection':'聚焦选中对象','Frame all':'显示全部',
});
Object.assign(pt,{
  'File':'Arquivo','Help':'Ajuda','New project':'Novo projeto','Open project':'Abrir projeto','Import .MAP':'Importar .MAP',
  'Save project':'Salvar projeto','Save':'Salvar','Export Svengine .MAP':'Exportar .MAP Svengine',
  'Compile Map':'Compilar mapa','Stop Build':'Parar compilação','Build configuration':'Configuração de compilação',
  'Map name':'Nome do mapa','Compiler folder':'Pasta dos compiladores','Game directory':'Pasta do jogo','Save settings':'Salvar configurações',
  'Camera & Gizmo Controls':'Controles de câmera e gizmo','Camera navigation':'Navegação de câmera',
  'Language':'Idioma','Interface language':'Idioma da interface','Automatic (system language)':'Automático (sistema)',
  'Move':'Mover','Rotate':'Girar','Scale':'Redimensionar','Draw':'Desenhar','Cancel':'Cancelar','Close':'Fechar',
  'Undo':'Desfazer','Redo':'Refazer','Clone':'Duplicar','Delete':'Excluir','Properties':'Propriedades',
  'TRANSFORM':'TRANSFORMAR','VIEW':'VISUALIZAÇÃO','EDIT':'EDITAR','CREATE':'CRIAR','SELECT':'SELECIONAR',
  'Studios':'Ferramentas','MAP Editor':'Editor MAP','BSP Viewer':'Visualizador BSP',
  'Map Packager Studio':'Empacotador de mapas','Gameplay Studio':'Lógica do mapa',
  'Cinematic Camera Studio':'Câmeras cinematográficas','NPC & AI Studio':'NPCs e rotas',
  'Terrain & Shape Studio':'Terrenos e geometria','Lighting & Environment Studio':'Iluminação e ambiente',
  'Audio Studio':'Editor de áudio','Map Doctor':'Diagnóstico do mapa','Shape Studio':'Formas e geometria',
  'Shapes':'Formas','Basic shapes':'Formas básicas','Architecture shapes':'Estruturas',
  'Draw a box':'Desenhar bloco','Stop drawing':'Sair do desenho','Drag in the 3D viewport':'Arraste na vista 3D',
  'Wall openings':'Aberturas na parede','Door opening':'Abertura de porta','Window opening':'Abertura de janela',
  'Door and window openings cut a selected worldspawn box wall. They do not add a second wall.':'As aberturas recortam a parede retangular de worldspawn sem duplicar a parede.',
  'Drawing height':'Altura do desenho','Left drag to draw; right click or Esc to cancel.':'Arraste com o botão esquerdo; botão direito ou Esc para sair.',
  'Select a wall and click where the opening should go.':'Selecione a parede e clique onde deseja a abertura.',
  'Shape width':'Largura','Shape height':'Altura','Shape depth':'Profundidade',
  'Choose a shape and size it before placing it with the mouse.':'Escolha uma forma e suas dimensões antes de posicionar.',
  'Click a surface to place':'Clique na superfície para posicionar',
  'Right click or Esc to cancel drawing.':'Botão direito ou Esc para cancelar.',
  'Doorframe':'Batente de porta','Windowframe':'Moldura de janela',
  'Wall':'Parede','Slab':'Laje','Beam':'Viga','Column':'Coluna','Ramp':'Rampa','Frame':'Moldura',
  'Room':'Sala','Roof':'Telhado','Corner':'Canto','Platform':'Plataforma','Bridge':'Ponte','Barrier':'Barreira','Steps':'Degraus',
  'Box':'Bloco','Wedge':'Cunha','Cylinder':'Cilindro','Arch':'Arco','Vault':'Abóbada','Cone':'Cone',
  'Pyramid':'Pirâmide','Icosphere':'Esfera poligonal','Stairs':'Escadas','Pipe':'Tubo',
  'Texture Browser':'Explorador de texturas','Entity Browser':'Explorador de entidades','Explorer':'Explorador',
  'World Properties':'Propriedades do mundo','Visibility manager':'Gerenciador de visibilidade',
  'Ghost mode':'Exibir ocultos','Show entity names':'Exibir rótulos das entidades','Labels':'Rótulos',
  'Gizmo':'Gizmo','Grid':'Grade','Wire':'Aramado','Snap':'Ajustar','Height':'Altura','Ready':'Pronto',
  'Name':'Nome','Position':'Posição','Rotation':'Rotação','Dimensions (units)':'Dimensões (unidades)',
  'Layer':'Camada','Entities':'Entidades','Geometry':'Geometria','Perspective':'Perspectiva',
  'Textured':'Com texturas','Object':'Objeto','Face':'Face','Vertex':'Vértice','Edge':'Aresta',
  'Output':'Saída','Workspace':'Área de trabalho','Load Sven Co-op FGD':'Carregar FGD Sven Co-op',
  'Frame selection':'Focar seleção','Frame all':'Mostrar tudo'
});

// v1.3.0 Gameplay Test — labels only; internal walk mode and projects unchanged.
Object.assign(es,{
 'Gameplay Test':'Prueba de juego','Gameplay Test settings':'Ajustes de prueba de juego',
 'Rendered lighting in test':'Iluminación Rendered','Show NPC and MDL models':'Mostrar NPC y modelos MDL',
 'Simulate buttons, doors and triggers':'Simular botones, puertas y triggers',
 'Gameplay Test controls hint':'WASD: mover · Mouse: mirar · E: interactuar · Espacio: saltar · Shift: correr · C/Ctrl: agacharse · F: linterna · N: noclip · F5/Esc: salir',
 'Interaction is an approximation; verify in Sven Co-op.':'Simulación aproximada; verificá el resultado en Sven Co-op.'
});
Object.assign(ru,{
 'Gameplay Test':'Тест игры','Gameplay Test settings':'Настройки теста игры',
 'Rendered lighting in test':'Рендер освещения','Show NPC and MDL models':'Показывать NPC и MDL-модели',
 'Simulate buttons, doors and triggers':'Имитировать кнопки, двери и триггеры',
 'Gameplay Test controls hint':'WASD: движение · Мышь: обзор · E: использовать · Пробел: прыжок · Shift: бег · C/Ctrl: присед · F: фонарь · N: noclip · F5/Esc: выход',
 'Interaction is an approximation; verify in Sven Co-op.':'Приблизительная симуляция; проверяйте в Sven Co-op.'
});
Object.assign(ko,{
 'Gameplay Test':'게임플레이 테스트','Gameplay Test settings':'게임플레이 테스트 설정',
 'Rendered lighting in test':'렌더링 조명','Show NPC and MDL models':'NPC 및 MDL 모델 표시',
 'Simulate buttons, doors and triggers':'버튼, 문, 트리거 시뮬레이션',
 'Gameplay Test controls hint':'WASD 이동 · 마우스 보기 · E 상호작용 · Space 점프 · Shift 달리기 · C/Ctrl 숙이기 · F 손전등 · N 노클립 · F5/Esc 종료',
 'Interaction is an approximation; verify in Sven Co-op.':'근사 시뮬레이션입니다. Sven Co-op에서 확인하세요.'
});
Object.assign(zh,{
 'Gameplay Test':'玩法测试','Gameplay Test settings':'玩法测试设置',
 'Rendered lighting in test':'渲染光照预览','Show NPC and MDL models':'显示NPC与MDL模型',
 'Simulate buttons, doors and triggers':'模拟按钮、门与触发器',
 'Gameplay Test controls hint':'WASD 移动 · 鼠标视角 · E 互动 · 空格跳跃 · Shift奔跑 · C/Ctrl蹲下 · F手电筒 · N穿墙 · F5/Esc退出',
 'Interaction is an approximation; verify in Sven Co-op.':'仅为近似模拟，请在 Sven Co-op 中验证。'
});
Object.assign(pt,{
 'Gameplay Test':'Teste de Jogabilidade','Gameplay Test settings':'Configurações do teste',
 'Rendered lighting in test':'Iluminação renderizada','Show NPC and MDL models':'Mostrar NPCs e modelos MDL',
 'Simulate buttons, doors and triggers':'Simular botões, portas e gatilhos',
 'Gameplay Test controls hint':'WASD: mover · Mouse: olhar · E: interagir · Espaço: pular · Shift: correr · C/Ctrl: agachar · F: lanterna · N: noclip · F5/Esc: sair',
 'Interaction is an approximation; verify in Sven Co-op.':'Simulação aproximada; confirme no Sven Co-op.'
});

// BSP Recovery (Preview 1). UI-only translations. GoldSrc classnames/keyvalues are never translated.
Object.assign(es,{
 'BSP Recovery':'Recuperación BSP','Native entity editing':'Edición nativa de entidades',
 'Native BSP entity editing — original remains untouched':'Editar entidades del BSP sin modificar el original',
 'BSP Recovery cannot edit this map safely':'Este BSP no se puede editar con seguridad',
 'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.':'Esta versión solo edita los keyvalues de las entidades. Conserva exactamente geometría, texturas, lightmaps, VIS y colisiones. Los cambios de luces o posición no recalculan los datos compilados. Probá la copia en Sven Co-op.',
 'Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.':'Editá los keyvalues. Las referencias a brushes compilados (*n) están protegidas. Se conservan las claves repetidas.',
 'Add keyvalue':'Añadir propiedad','Delete keyvalue':'Eliminar propiedad','Key':'Clave','Value':'Valor','Add':'Añadir',
 'Remove point entity':'Eliminar entidad puntual','Add point entity':'Añadir entidad puntual',
 'Remove selected point entity from the exported BSP? This does not modify your original file.':'¿Eliminar esta entidad puntual de la copia exportada? El BSP original seguirá intacto.',
 'Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.':'Copia exportada. Abrila en el Visor BSP para comprobar los cambios. El original no se modificó.',
 'Unexported changes — original BSP not modified.':'Cambios pendientes de exportar. El BSP original está intacto.',
 'No edits yet. Original BSP is read-only.':'Sin modificaciones. El BSP original está protegido.',
 'Discard edits':'Descartar cambios','Export edited BSP copy':'Exportar copia BSP'
});
Object.assign(ru,{
 'BSP Recovery':'Восстановление BSP','Native entity editing':'Редактор сущностей BSP',
 'Native BSP entity editing — original remains untouched':'Редактирование сущностей BSP без изменения оригинала',
 'BSP Recovery cannot edit this map safely':'Невозможно безопасно редактировать этот BSP',
 'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.':'Изменяются только параметры сущностей. Геометрия, текстуры, освещение, VIS и коллизии сохраняются побайтово. Изменения освещения и положения не пересчитывают данные BSP. Проверьте копию в Sven Co-op.',
 'Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.':'Редактируйте параметры. Ссылки на модели кистей (*n) защищены. Повторяющиеся ключи сохраняются.',
 'Add keyvalue':'Добавить параметр','Delete keyvalue':'Удалить параметр','Key':'Ключ','Value':'Значение','Add':'Добавить',
 'Remove point entity':'Удалить точечную сущность','Add point entity':'Добавить точечную сущность',
 'Remove selected point entity from the exported BSP? This does not modify your original file.':'Удалить сущность из экспортируемой копии? Оригинал не изменится.',
 'Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.':'Копия BSP экспортирована. Откройте её в просмотрщике. Оригинал сохранён.',
 'Unexported changes — original BSP not modified.':'Есть несохранённые изменения. Исходный BSP не изменён.',
 'No edits yet. Original BSP is read-only.':'Изменений нет. Исходный BSP защищён.',
 'Discard edits':'Отменить изменения','Export edited BSP copy':'Экспортировать копию BSP'
});
Object.assign(ko,{
 'BSP Recovery':'BSP 복구','Native entity editing':'BSP 엔티티 편집',
 'Native BSP entity editing — original remains untouched':'원본을 유지하면서 BSP 엔티티 편집',
 'BSP Recovery cannot edit this map safely':'이 BSP는 안전하게 편집할 수 없습니다',
 'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.':'엔티티 키값만 편집합니다. 지오메트리, 텍스처, 라이트맵, VIS, 충돌 데이터는 그대로 보존됩니다. 조명이나 위치 변경은 컴파일 데이터를 다시 계산하지 않습니다. Sven Co-op에서 확인하세요.',
 'Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.':'키값 편집. 브러시 모델 참조(*n)는 보호됩니다. 중복 키가 보존됩니다.',
 'Add keyvalue':'키값 추가','Delete keyvalue':'키값 삭제','Key':'키','Value':'값','Add':'추가',
 'Remove point entity':'포인트 엔티티 삭제','Add point entity':'포인트 엔티티 추가',
 'Remove selected point entity from the exported BSP? This does not modify your original file.':'내보낼 BSP 사본에서 엔티티를 삭제할까요? 원본은 유지됩니다.',
 'Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.':'BSP 사본을 내보냈습니다. BSP 뷰어에서 확인하세요. 원본은 그대로입니다.',
 'Unexported changes — original BSP not modified.':'내보내지 않은 변경 사항. 원본 BSP는 그대로입니다.',
 'No edits yet. Original BSP is read-only.':'변경 사항 없음. 원본 BSP는 보호됩니다.',
 'Discard edits':'변경 취소','Export edited BSP copy':'BSP 사본 내보내기'
});
Object.assign(zh,{
 'BSP Recovery':'BSP 恢复','Native entity editing':'原生实体编辑',
 'Native BSP entity editing — original remains untouched':'编辑 BSP 实体，不修改原文件',
 'BSP Recovery cannot edit this map safely':'无法安全编辑此 BSP',
 'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.':'此预览仅编辑实体键值。几何、纹理、光照贴图、VIS 和碰撞数据逐字节保留。修改灯光或位置不会重新计算编译结果。请在 Sven Co-op 中测试导出的副本。',
 'Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.':'编辑实体键值。已编译笔刷模型引用（*n）受到保护，重复键会保留。',
 'Add keyvalue':'添加键值','Delete keyvalue':'删除键值','Key':'键','Value':'值','Add':'添加',
 'Remove point entity':'删除点实体','Add point entity':'添加点实体',
 'Remove selected point entity from the exported BSP? This does not modify your original file.':'从导出副本中删除该点实体？原 BSP 不会修改。',
 'Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.':'BSP 副本已导出。请在 BSP 查看器中检查。原文件未修改。',
 'Unexported changes — original BSP not modified.':'更改尚未导出，原 BSP 未修改。',
 'No edits yet. Original BSP is read-only.':'没有修改。原 BSP 受到保护。',
 'Discard edits':'放弃更改','Export edited BSP copy':'导出 BSP 副本'
});
Object.assign(pt,{
 'BSP Recovery':'Recuperação BSP','Native entity editing':'Edição nativa de entidades',
 'Native BSP entity editing — original remains untouched':'Editar entidades BSP sem alterar o original',
 'BSP Recovery cannot edit this map safely':'Não é possível editar este BSP com segurança',
 'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.':'Esta versão edita apenas as propriedades das entidades. Geometria, texturas, lightmaps, VIS e colisões permanecem idênticos. Mudanças na iluminação ou posição não recalculam os dados compilados. Teste a cópia no Sven Co-op.',
 'Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.':'Edite os valores das entidades. As referências a brushes compilados (*n) são protegidas. Chaves repetidas são preservadas.',
 'Add keyvalue':'Adicionar propriedade','Delete keyvalue':'Excluir propriedade','Key':'Chave','Value':'Valor','Add':'Adicionar',
 'Remove point entity':'Remover entidade pontual','Add point entity':'Adicionar entidade pontual',
 'Remove selected point entity from the exported BSP? This does not modify your original file.':'Remover esta entidade da cópia exportada? O BSP original ficará intacto.',
 'Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.':'Cópia BSP exportada. Abra no visualizador BSP para conferir. O original permanece intacto.',
 'Unexported changes — original BSP not modified.':'Alterações ainda não exportadas. BSP original intacto.',
 'No edits yet. Original BSP is read-only.':'Sem alterações. O BSP original está protegido.',
 'Discard edits':'Descartar alterações','Export edited BSP copy':'Exportar cópia BSP'
});

// BSP -> MAP recovery workflow (external tool is never bundled or run automatically).
Object.assign(es,{
 'Convert BSP to MAP':'Convertir BSP a MAP',
 'Convert BSP to editable MAP':'Convertir BSP en MAP editable',
 'Reconstruct an editable .map with your own SurfDecomp installation. The original BSP stays unchanged. Decompilation cannot recover the exact original brushes, groups, or baked lighting.':'Reconstruí un .map editable con tu propia instalación de SurfDecomp. El BSP original no se modifica. La decompilación no recupera los brushes, grupos ni la iluminación compilada originales con exactitud.',
 'SurfDecomp executable path (optional)':'Ruta de surfdecomp.exe (opcional)',
 'Leave blank if you placed surfdecomp.exe in the tools folder of SvenStudio 3D. Only run decompilers you trust.':'Dejá este campo vacío si colocaste surfdecomp.exe en la carpeta tools de SvenStudio 3D. Ejecutá únicamente herramientas confiables.',
 'Decompile and validate':'Decompilar y verificar','Converting BSP...':'Convirtiendo BSP...',
 'Download recovered MAP':'Descargar MAP recuperado','Open recovered MAP in editor':'Abrir MAP en el editor',
 'MAP validation results':'Resultado de validación del MAP','MAP requires manual inspection':'El MAP requiere revisión manual',
 'Recovered brushes':'Brushes recuperados','Skipped brushes':'Brushes omitidos',
 'Importing this MAP would lose geometry. Review the report and confirm explicitly before replacing your current project.':'Al importar este MAP se perdería geometría. Revisá el informe y confirmá expresamente antes de reemplazar el proyecto actual.',
 'Skipped brush locations':'Ubicación de brushes omitidos',
 'Textures from external WADs and compiled lightmaps may not be recoverable; load the corresponding WADs if necessary.':'Las texturas de WAD externos y los lightmaps compilados podrían no recuperarse. Cargá los WAD correspondientes cuando sea necesario.',
 'Decompiler output':'Registro del decompilador'
});
Object.assign(ru,{'Convert BSP to editable MAP':'Конвертировать BSP в редактируемый MAP','SurfDecomp executable path (optional)':'Путь к surfdecomp.exe (необязательно)','Decompile and validate':'Декомпилировать и проверить','Converting BSP...':'Конвертация BSP…','Download recovered MAP':'Скачать восстановленный MAP','Open recovered MAP in editor':'Открыть MAP в редакторе','Recovered brushes':'Восстановленные браши','Skipped brushes':'Пропущенные браши','MAP validation results':'Результаты проверки MAP'});
Object.assign(ko,{'Convert BSP to editable MAP':'BSP를 편집 가능한 MAP으로 변환','SurfDecomp executable path (optional)':'surfdecomp.exe 경로(선택)','Decompile and validate':'디컴파일 및 검사','Converting BSP...':'BSP 변환 중…','Download recovered MAP':'복원된 MAP 다운로드','Open recovered MAP in editor':'편집기에서 MAP 열기','Recovered brushes':'복원된 브러시','Skipped brushes':'누락된 브러시','MAP validation results':'MAP 검사 결과'});
Object.assign(zh,{'Convert BSP to editable MAP':'将 BSP 转换为可编辑 MAP','SurfDecomp executable path (optional)':'surfdecomp.exe 路径（可选）','Decompile and validate':'反编译并验证','Converting BSP...':'正在转换 BSP…','Download recovered MAP':'下载恢复的 MAP','Open recovered MAP in editor':'在编辑器中打开 MAP','Recovered brushes':'恢复的笔刷','Skipped brushes':'跳过的笔刷','MAP validation results':'MAP 验证结果'});
Object.assign(pt,{'Convert BSP to editable MAP':'Converter BSP em MAP editável','SurfDecomp executable path (optional)':'Caminho do surfdecomp.exe (opcional)','Decompile and validate':'Descompilar e validar','Converting BSP...':'Convertendo BSP…','Download recovered MAP':'Baixar MAP recuperado','Open recovered MAP in editor':'Abrir MAP no editor','Recovered brushes':'Brushes recuperados','Skipped brushes':'Brushes ignorados','MAP validation results':'Resultado da validação MAP'});

Object.assign(es,{'Recovered entities':'Entidades recuperadas','Warning: the recovered MAP contains fewer entities than the original BSP. Review before importing.':'Advertencia: el MAP recuperado contiene menos entidades que el BSP original. Revisalo antes de importarlo.'});

// BSP → MAP texture restoration (keep GoldSrc texture names unchanged).
Object.assign(es,{
 'BSP surface textures restored':'Texturas visibles recuperadas del BSP',
 'NULL faces analyzed':'caras NULL analizadas',
 'ambiguous faces left unchanged':'caras ambiguas sin modificar',
 'No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.':'No se encontraron coincidencias seguras. Se conservaron las caras NULL. Si faltan texturas, revisá el BSP original y el MAP generado.'
});
Object.assign(ru,{
 'BSP surface textures restored':'Восстановлены текстуры видимых поверхностей BSP',
 'NULL faces analyzed':'проверено граней NULL',
 'ambiguous faces left unchanged':'неоднозначных граней не изменено',
 'No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.':'Надёжных совпадений поверхностей нет. Грани NULL сохранены. При отсутствии текстур проверьте исходный BSP и полученный MAP.'
});
Object.assign(ko,{
 'BSP surface textures restored':'BSP의 보이는 표면 텍스처 복원',
 'NULL faces analyzed':'NULL 면 분석',
 'ambiguous faces left unchanged':'모호한 면은 변경하지 않음',
 'No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.':'안전하게 일치하는 BSP 표면을 찾지 못했습니다. NULL 면을 유지했습니다. 텍스처가 없으면 원본 BSP와 생성된 MAP을 함께 확인하세요.'
});
Object.assign(zh,{
 'BSP surface textures restored':'已恢复 BSP 可见表面纹理',
 'NULL faces analyzed':'已分析 NULL 面',
 'ambiguous faces left unchanged':'未更改的歧义面',
 'No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.':'未找到可靠匹配的 BSP 表面。NULL 面保持不变。如果纹理仍然缺失，请同时检查原始 BSP 和生成的 MAP。'
});
Object.assign(pt,{
 'BSP surface textures restored':'Texturas visíveis recuperadas do BSP',
 'NULL faces analyzed':'faces NULL analisadas',
 'ambiguous faces left unchanged':'faces ambíguas mantidas',
 'No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.':'Não foram encontradas correspondências seguras. As faces NULL foram preservadas. Se ainda faltarem texturas, confira o BSP original e o MAP gerado.'
});

// BSP recovery editor-only appearance; never modifies textures or exported MAP.
Object.assign(es,{'Hide NULL faces':'Ocultar caras NULL','Show NULL faces':'Mostrar caras NULL'});
Object.assign(ru,{'Hide NULL faces':'Скрыть грани NULL','Show NULL faces':'Показать грани NULL'});
Object.assign(ko,{'Hide NULL faces':'NULL 면 숨기기','Show NULL faces':'NULL 면 표시'});
Object.assign(zh,{'Hide NULL faces':'隐藏 NULL 面','Show NULL faces':'显示 NULL 面'});
Object.assign(pt,{'Hide NULL faces':'Ocultar faces NULL','Show NULL faces':'Mostrar faces NULL'});

// Preview 3 HF4 — compiled BSP packaging safety.
Object.assign(es,{
 'Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.':'Solo se puede empaquetar un BSP ya compilado en la carpeta del juego. Abrir un MAP no genera automáticamente un BSP.',
 'The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.':'El proyecto abierto y el BSP seleccionado tienen nombres distintos. Comprobá que vas a compartir el archivo correcto.'
});
Object.assign(ru,{
 'Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.':'Можно упаковать только уже скомпилированный BSP в папке игры. Открытие MAP не создаёт BSP автоматически.',
 'The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.':'Имя открытого проекта не совпадает с именем выбранного BSP. Проверьте файл перед упаковкой.'
});
Object.assign(ko,{
 'Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.':'게임 폴더에서 컴파일된 BSP만 패키징할 수 있습니다. MAP을 연다고 BSP가 자동 생성되지는 않습니다.',
 'The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.':'열린 프로젝트와 선택한 BSP의 이름이 다릅니다. 배포할 파일을 확인하세요.'
});
Object.assign(zh,{
 'Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.':'只能打包游戏目录中已编译的 BSP。打开 MAP 不会自动创建 BSP。',
 'The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.':'打开的项目与所选 BSP 名称不同，请确认打包的是正确文件。'
});
Object.assign(pt,{
 'Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.':'Só é possível empacotar um BSP já compilado na pasta do jogo. Abrir um MAP não gera automaticamente um BSP.',
 'The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.':'O projeto aberto e o BSP selecionado têm nomes diferentes. Confira o arquivo antes de compartilhar.'
});

// HF5 — Optional SC-RAD light test. This changes compiler flags ONLY, not GoldSrc keyvalues.
Object.assign(es,{'SC-RAD lighting diagnostic':'Prueba de iluminación SC-RAD','Normal compile — no ambient override':'Compilación normal — sin cambios','Low ambient test (0.08)':'Ambiente bajo (0,08)','Moderate ambient test (0.15)':'Ambiente medio (0,15)','Strong ambient test (0.25)':'Ambiente alto (0,25)','Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.':'Solo para diagnóstico: genera otro BSP con sufijo _lightXX. No sobrescribe el BSP original ni recupera sus lightmaps. Después volvé a Normal.'});
Object.assign(ru,{'SC-RAD lighting diagnostic':'Проверка освещения SC-RAD','Normal compile — no ambient override':'Обычная сборка — без изменений','Low ambient test (0.08)':'Низкий фоновый свет (0,08)','Moderate ambient test (0.15)':'Средний фоновый свет (0,15)','Strong ambient test (0.25)':'Сильный фоновый свет (0,25)','Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.':'Только для диагностики: создаёт отдельный BSP с суффиксом _lightXX. Исходный BSP и его лайтмапы не изменяются. Затем вернитесь к обычному режиму.'});
Object.assign(ko,{'SC-RAD lighting diagnostic':'SC-RAD 조명 진단','Normal compile — no ambient override':'일반 컴파일 — 변경 없음','Low ambient test (0.08)':'약한 주변광 (0.08)','Moderate ambient test (0.15)':'중간 주변광 (0.15)','Strong ambient test (0.25)':'강한 주변광 (0.25)','Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.':'진단용으로 별도 _lightXX BSP를 만듭니다. 원본 BSP나 라이트맵을 덮어쓰지 않습니다. 이후 일반 모드로 되돌리세요.'});
Object.assign(zh,{'SC-RAD lighting diagnostic':'SC-RAD 光照诊断','Normal compile — no ambient override':'正常编译 — 不修改环境光','Low ambient test (0.08)':'低环境光 (0.08)','Moderate ambient test (0.15)':'中等环境光 (0.15)','Strong ambient test (0.25)':'高环境光 (0.25)','Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.':'仅供诊断：单独编译后缀为 _lightXX 的 BSP，不覆盖原 BSP，也不恢复原光照贴图。测试后切回正常编译。'});
Object.assign(pt,{'SC-RAD lighting diagnostic':'Teste de iluminação SC-RAD','Normal compile — no ambient override':'Compilação normal — sem alteração','Low ambient test (0.08)':'Ambiente baixo (0,08)','Moderate ambient test (0.15)':'Ambiente médio (0,15)','Strong ambient test (0.25)':'Ambiente alto (0,25)','Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.':'Somente diagnóstico: compila um BSP separado com sufixo _lightXX. Não sobrescreve o BSP original nem recupera seus lightmaps. Volte ao modo Normal depois.'});

// v1.3.0 Preview 4 — Editor MAP label renderer. UI only; classnames are not translated.
Object.assign(es,{
 'Editor MAP labels':'Etiquetas del Editor MAP','Label renderer':'Renderizador de etiquetas',
 'Optimized (recommended)':'Optimizado (recomendado)','Classic (legacy performance)':'Clásico (rendimiento anterior)',
 'Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.':'El modo optimizado dibuja solo las etiquetas visibles en una capa. Las entidades y su selección no se eliminan.',
 'Maximum labels':'Máximo de etiquetas','Label distance':'Distancia de etiquetas','Avoid overlapping labels':'Evitar etiquetas superpuestas',
 'Show label diagnostics':'Mostrar diagnóstico de etiquetas','Reset label optimization':'Restablecer optimización de etiquetas',
 'Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.':'Las etiquetas seleccionadas ignoran los límites mientras estén frente a la cámara. Los límites altos pueden reducir los FPS.',
 'Label candidates':'Candidatas','In view':'En pantalla','Rendered labels':'Etiquetas dibujadas'
});
Object.assign(ru,{
 'Editor MAP labels':'Подписи редактора MAP','Label renderer':'Рендер подписей',
 'Optimized (recommended)':'Оптимизированный (рекомендуется)','Classic (legacy performance)':'Классический (старый режим)',
 'Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.':'Оптимизированный режим отображает только видимые подписи в одном слое. Сущности и выделение сохраняются.',
 'Maximum labels':'Максимум подписей','Label distance':'Расстояние подписей','Avoid overlapping labels':'Избегать наложения подписей',
 'Show label diagnostics':'Показать диагностику подписей','Reset label optimization':'Сбросить оптимизацию подписей',
 'Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.':'Подписи выбранных объектов видны сверх лимита, если находятся перед камерой. Высокий лимит может снизить FPS.',
 'Label candidates':'Кандидаты','In view':'В кадре','Rendered labels':'Отображено подписей'
});
Object.assign(ko,{
 'Editor MAP labels':'MAP 편집기 엔티티 레이블','Label renderer':'레이블 렌더러',
 'Optimized (recommended)':'최적화 (권장)','Classic (legacy performance)':'기존 방식 (이전 성능)',
 'Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.':'최적화 모드는 화면 안의 레이블만 한 레이어에 표시하며 엔티티와 선택 상태를 유지합니다.',
 'Maximum labels':'최대 레이블 수','Label distance':'레이블 거리','Avoid overlapping labels':'레이블 겹침 방지',
 'Show label diagnostics':'레이블 진단 표시','Reset label optimization':'레이블 최적화 초기화',
 'Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.':'선택한 레이블은 카메라 앞에 있는 경우 제한을 초과해도 표시됩니다. 높은 제한은 FPS를 낮출 수 있습니다.',
 'Label candidates':'후보','In view':'화면 안','Rendered labels':'표시된 레이블'
});
Object.assign(zh,{
 'Editor MAP labels':'MAP 编辑器标签','Label renderer':'标签渲染方式',
 'Optimized (recommended)':'优化模式（推荐）','Classic (legacy performance)':'经典模式（原有性能）',
 'Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.':'优化模式仅在单层中绘制屏幕内的标签，不会删除实体或选择状态。',
 'Maximum labels':'最大标签数','Label distance':'标签距离','Avoid overlapping labels':'避免标签重叠',
 'Show label diagnostics':'显示标签诊断','Reset label optimization':'重置标签优化',
 'Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.':'已选标签在摄像机前方时不受数量限制。较高的上限可能降低帧率。',
 'Label candidates':'候选','In view':'视野内','Rendered labels':'已渲染标签'
});
Object.assign(pt,{
 'Editor MAP labels':'Etiquetas do Editor MAP','Label renderer':'Renderizador de etiquetas',
 'Optimized (recommended)':'Otimizado (recomendado)','Classic (legacy performance)':'Clássico (desempenho anterior)',
 'Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.':'O modo otimizado mostra apenas etiquetas na tela, em uma camada. Entidades e seleção são preservadas.',
 'Maximum labels':'Máximo de etiquetas','Label distance':'Distância das etiquetas','Avoid overlapping labels':'Evitar etiquetas sobrepostas',
 'Show label diagnostics':'Mostrar diagnóstico de etiquetas','Reset label optimization':'Redefinir otimização de etiquetas',
 'Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.':'Etiquetas selecionadas ignoram os limites quando estão à frente da câmera. Limites altos podem reduzir o FPS.',
 'Label candidates':'Candidatas','In view':'Na tela','Rendered labels':'Etiquetas renderizadas'
});

// v1.3.0 Preview 5 — MAP performance diagnostics and lightweight label styling.
Object.assign(es,{
 'Lightweight labels (faster)':'Etiquetas livianas (más rápidas)',
 'Show MAP performance diagnostics':'Mostrar diagnóstico de rendimiento MAP',
 'Draw calls':'Llamadas de dibujo','Triangles':'Triángulos','Off':'Desactivadas'
});
Object.assign(ru,{
 'Lightweight labels (faster)':'Упрощённые подписи (быстрее)',
 'Show MAP performance diagnostics':'Показать производительность MAP',
 'Draw calls':'Вызовы отрисовки','Triangles':'Треугольники','Off':'Выкл.'
});
Object.assign(ko,{
 'Lightweight labels (faster)':'가벼운 레이블 (빠름)',
 'Show MAP performance diagnostics':'MAP 성능 진단 표시',
 'Draw calls':'드로우 콜','Triangles':'삼각형','Off':'꺼짐'
});
Object.assign(zh,{
 'Lightweight labels (faster)':'轻量标签（更快）',
 'Show MAP performance diagnostics':'显示 MAP 性能诊断',
 'Draw calls':'绘制调用','Triangles':'三角形','Off':'关闭'
});
Object.assign(pt,{
 'Lightweight labels (faster)':'Etiquetas leves (mais rápidas)',
 'Show MAP performance diagnostics':'Mostrar diagnóstico de desempenho MAP',
 'Draw calls':'Chamadas de desenho','Triangles':'Triângulos','Off':'Desativadas'
});


// Preview 6 — accessible workspace preset and FPS-only HUD monitor.
Object.assign(es,{'Organized':'Ordenado','Show FPS counter':'Mostrar FPS'});
Object.assign(ru,{'Organized':'Упорядоченный','Show FPS counter':'Показывать FPS'});
Object.assign(ko,{'Organized':'정돈된 작업 공간','Show FPS counter':'FPS 표시'});
Object.assign(zh,{'Organized':'整洁布局','Show FPS counter':'显示 FPS'});
Object.assign(pt,{'Organized':'Organizado','Show FPS counter':'Mostrar FPS'});

// Preview 6 HF1 — MAP yaw controls: Q/E are camera turns, not translations.
Object.assign(es,{
 'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'Vuelo activo · WASD · Q/E bajar/subir · Esc: salir',
 'Wheel · Zoom · Q/E down/up':'Rueda: zoom · Q/E: bajar/subir'
});
Object.assign(ru,{
 'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'Полёт · WASD · Q/E: вниз/вверх · Esc: выход',
 'Wheel · Zoom · Q/E down/up':'Колесо: масштаб · Q/E: вниз/вверх камеры'
});
Object.assign(ko,{
 'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'비행 · WASD · Q/E: 위/아래 · Esc: 종료',
 'Wheel · Zoom · Q/E down/up':'휠: 확대/축소 · Q/E: 카메라 회전'
});
Object.assign(zh,{
 'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'飞行 · WASD 移动 · Q/E 上下 · Esc 退出',
 'Wheel · Zoom · Q/E down/up':'滚轮：缩放 · Q/E：上下移动'
});
Object.assign(pt,{
 'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'Voo ativo · WASD · Q/E: descer/subir · Esc: sair',
 'Wheel · Zoom · Q/E down/up':'Roda: zoom · Q/E: descer/subir a câmera'
});

// v1.4.0 Preview 2 — Quick construction, prefab placement and small-brush scaling.
// Classnames, Valve 220 texture axes and .svprefab.json format remain unchanged.
Object.assign(es,{
 'Reusable constructions':'Construcciones reutilizables',
 'Select a brush group, save it and place copies with one click.':'Seleccioná varios brushes, guardalos y colocá copias con un clic.',
 'Save selected construction':'Guardar selección como prefab',
 'Place prefab with mouse':'Colocar prefab con el mouse',
 'Precise brush dimensions':'Dimensiones precisas del brush',
 'GoldSrc units':'Unidades GoldSrc',
 'Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.':'Las flechas mantienen su tamaño en pantalla. Mantené Shift para escalar con precisión sin ajuste a grilla.'
});
Object.assign(ru,{
 'Reusable constructions':'Повторно используемые конструкции',
 'Select a brush group, save it and place copies with one click.':'Выделите группу брашей, сохраните и размещайте копии одним щелчком.',
 'Save selected construction':'Сохранить выделение как префаб',
 'Place prefab with mouse':'Разместить префаб мышью',
 'Precise brush dimensions':'Точные размеры браша',
 'GoldSrc units':'Единицы GoldSrc',
 'Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.':'Размер стрелок не зависит от масштаба. Shift — точная настройка без привязки к сетке.'
});
Object.assign(ko,{
 'Reusable constructions':'재사용 가능한 구조물',
 'Select a brush group, save it and place copies with one click.':'브러시 그룹을 선택해 저장하고 클릭 한 번으로 복제 배치합니다.',
 'Save selected construction':'선택 항목을 프리팹으로 저장',
 'Place prefab with mouse':'마우스로 프리팹 배치',
 'Precise brush dimensions':'브러시 정확한 크기',
 'GoldSrc units':'GoldSrc 단위',
 'Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.':'화살표 크기는 확대 비율과 무관합니다. Shift로 그리드에 맞추지 않고 미세 조정합니다.'
});
Object.assign(zh,{
 'Reusable constructions':'可重复使用的结构',
 'Select a brush group, save it and place copies with one click.':'选中笔刷组并保存，再单击放置副本。',
 'Save selected construction':'将所选内容保存为预制件',
 'Place prefab with mouse':'鼠标放置预制件',
 'Precise brush dimensions':'笔刷精确尺寸',
 'GoldSrc units':'GoldSrc 单位',
 'Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.':'箭头大小不受缩放影响。按住 Shift 可不吸附网格进行精细缩放。'
});
Object.assign(pt,{
 'Reusable constructions':'Construções reutilizáveis',
 'Select a brush group, save it and place copies with one click.':'Selecione um grupo de brushes, salve e coloque cópias com um clique.',
 'Save selected construction':'Salvar seleção como prefab',
 'Place prefab with mouse':'Posicionar prefab com o mouse',
 'Precise brush dimensions':'Dimensões precisas do brush',
 'GoldSrc units':'Unidades GoldSrc',
 'Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.':'As setas mantêm o tamanho na tela. Segure Shift para ajuste fino sem encaixe na grade.'
});

// v1.4 Preview 2 HF3 — camera navigation and hidden-brush context action.
Object.assign(es,{'Hidden brush':'Brush oculto','Show brush':'Desocultar brush','Wheel · Zoom · Q/E down/up':'Rueda: zoom · Q/E: bajar/subir'});
Object.assign(ru,{'Hidden brush':'Скрытый браш','Show brush':'Показать браш'});
Object.assign(ko,{'Hidden brush':'숨겨진 브러시','Show brush':'브러시 숨김 해제'});
Object.assign(zh,{'Hidden brush':'隐藏的笔刷','Show brush':'取消隐藏笔刷'});
Object.assign(pt,{'Hidden brush':'Brush oculto','Show brush':'Reexibir brush'});

Object.assign(es,{'Wheel · Zoom · Ctrl+mouse look · Q/E down/up':'Rueda: zoom · Ctrl+mouse: mirar · Q/E: bajar/subir'});
Object.assign(ru,{'Wheel · Zoom · Ctrl+mouse look · Q/E down/up':'Колесо: масштаб · Ctrl+мышь: обзор · Q/E: вниз/вверх'});
Object.assign(ko,{'Wheel · Zoom · Ctrl+mouse look · Q/E down/up':'휠: 확대/축소 · Ctrl+마우스: 시점 · Q/E: 위/아래'});
Object.assign(zh,{'Wheel · Zoom · Ctrl+mouse look · Q/E down/up':'滚轮缩放 · Ctrl+鼠标环视 · Q/E 上下'});
Object.assign(pt,{'Wheel · Zoom · Ctrl+mouse look · Q/E down/up':'Roda: zoom · Ctrl+mouse: olhar · Q/E: descer/subir'});

// Smart Placement / immersive workspace (v1.4.0 HF3). Interface text only.
Object.assign(es,{'Rotate 90 degrees':'Girar 90°','Axis':'Eje','Align to surface':'Alinear con superficie','Surface':'Superficie','Repeat placement':'Colocar copias consecutivas','Repeat':'Repetir','Immersive mode':'Modo inmersivo','Fullscreen keyboard lock (when available)':'Pantalla completa y bloqueo de atajos (si es compatible)','Plane':'Plano'});
Object.assign(ru,{'Rotate 90 degrees':'Повернуть на 90°','Axis':'Ось','Align to surface':'Выровнять по поверхности','Surface':'Поверхность','Repeat placement':'Повторное размещение','Repeat':'Повтор','Immersive mode':'Полноэкранный режим','Fullscreen keyboard lock (when available)':'Полный экран и блокировка клавиш (если доступно)','Plane':'Плоскость'});
Object.assign(ko,{'Rotate 90 degrees':'90° 회전','Axis':'축','Align to surface':'표면에 정렬','Surface':'표면','Repeat placement':'반복 배치','Repeat':'반복','Immersive mode':'몰입 모드','Fullscreen keyboard lock (when available)':'전체 화면 키보드 잠금 (지원 시)','Plane':'평면'});
Object.assign(zh,{'Rotate 90 degrees':'旋转90°','Axis':'轴','Align to surface':'贴合表面','Surface':'表面','Repeat placement':'连续放置','Repeat':'重复','Immersive mode':'沉浸模式','Fullscreen keyboard lock (when available)':'全屏键盘锁定（如支持）','Plane':'平面'});
Object.assign(pt,{'Rotate 90 degrees':'Girar 90°','Axis':'Eixo','Align to surface':'Alinhar à superfície','Surface':'Superfície','Repeat placement':'Colocação contínua','Repeat':'Repetir','Immersive mode':'Modo imersivo','Fullscreen keyboard lock (when available)':'Tela cheia e bloqueio de teclas (quando disponível)','Plane':'Plano'});

// HF4: fullscreen control relocated beside Help in the app titlebar.
Object.assign(es,{'Fullscreen':'Pantalla completa','Exit fullscreen':'Salir de pantalla completa'});
Object.assign(ru,{'Fullscreen':'Полный экран','Exit fullscreen':'Выйти из полноэкранного режима'});
Object.assign(ko,{'Fullscreen':'전체 화면','Exit fullscreen':'전체 화면 종료'});
Object.assign(zh,{'Fullscreen':'全屏','Exit fullscreen':'退出全屏'});
Object.assign(pt,{'Fullscreen':'Tela cheia','Exit fullscreen':'Sair da tela cheia'});

// v1.4.0 HF5: generic brush-entity detachment; classname/keyvalues stay in English.
Object.assign(es,{
 'Brush entity association':'Entidad asociada al brush',
 'Linked entity':'Entidad vinculada','Missing entity':'Entidad faltante','brushes':'brushes','linked brushes':'brushes vinculados',
 'Detach this brush (worldspawn)':'Desvincular este brush (worldspawn)',
 'Detach brush from entity (worldspawn)':'Desvincular brush de la entidad (worldspawn)',
 'Detach entire entity':'Desvincular entidad completa',
 'Detach all brushes of this entity':'Desvincular todos los brushes de esta entidad',
 'Convert linked brushes to worldspawn':'Convertir brushes vinculados a worldspawn',
 'Detach selected brushes':'Desvincular brushes seleccionados',
 'Detach all brushes of these entities':'Desvincular todos los brushes de estas entidades',
 'Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.':'Desvinculá solo los brushes elegidos o la entidad completa, sin perder geometría ni UV.',
 'Brush shape, textures, dimensions, position and grouping remain unchanged.':'Se conservan forma, texturas, medidas, posición y grupos.',
 'Convert brushes to worldspawn?':'¿Convertir los brushes a worldspawn?',
 'The last brush of these entities will be detached, so their keyvalues and connections will be removed:':'Estas entidades se quedarán sin brushes, por lo que se eliminarán sus propiedades y conexiones:',
 'You can undo this operation with Ctrl+Z.':'Podés deshacer la operación con Ctrl+Z.'
});
Object.assign(ru,{
 'Brush entity association':'Связь браша с сущностью','Linked entity':'Связанная сущность','Missing entity':'Отсутствующая сущность','brushes':'брашей','linked brushes':'связанных брашей',
 'Detach this brush (worldspawn)':'Отвязать этот браш (worldspawn)','Detach brush from entity (worldspawn)':'Отвязать браш от сущности (worldspawn)',
 'Detach entire entity':'Отвязать всю сущность','Detach all brushes of this entity':'Отвязать все браши сущности',
 'Convert linked brushes to worldspawn':'Перенести связанные браши в worldspawn','Detach selected brushes':'Отвязать выделенные браши','Detach all brushes of these entities':'Отвязать все браши этих сущностей',
 'Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.':'Отвязать отдельные браши или все браши сущности, сохранив геометрию и UV.',
 'Brush shape, textures, dimensions, position and grouping remain unchanged.':'Форма, текстуры, размеры, положение и группы сохраняются.',
 'Convert brushes to worldspawn?':'Перенести браши в worldspawn?',
 'The last brush of these entities will be detached, so their keyvalues and connections will be removed:':'У этих сущностей больше не будет брашей; их параметры и связи будут удалены:',
 'You can undo this operation with Ctrl+Z.':'Действие можно отменить через Ctrl+Z.'
});
Object.assign(ko,{
 'Brush entity association':'브러시 엔티티 연결','Linked entity':'연결된 엔티티','Missing entity':'없는 엔티티','brushes':'브러시','linked brushes':'연결된 브러시',
 'Detach this brush (worldspawn)':'이 브러시 연결 해제 (worldspawn)','Detach brush from entity (worldspawn)':'브러시 연결 해제 (worldspawn)',
 'Detach entire entity':'전체 엔티티 연결 해제','Detach all brushes of this entity':'이 엔티티의 모든 브러시 연결 해제',
 'Convert linked brushes to worldspawn':'연결된 브러시를 worldspawn으로 변환','Detach selected brushes':'선택한 브러시 연결 해제',
 'Detach all brushes of these entities':'이 엔티티의 모든 브러시 연결 해제',
 'Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.':'지오메트리와 UV를 유지하며 선택한 브러시나 전체 엔티티 연결을 해제합니다.',
 'Brush shape, textures, dimensions, position and grouping remain unchanged.':'브러시 형태, 텍스처, 치수, 위치, 그룹이 유지됩니다.',
 'Convert brushes to worldspawn?':'브러시를 worldspawn으로 변환할까요?',
 'The last brush of these entities will be detached, so their keyvalues and connections will be removed:':'엔티티의 마지막 브러시가 연결 해제되어 속성과 연결이 삭제됩니다:',
 'You can undo this operation with Ctrl+Z.':'Ctrl+Z로 되돌릴 수 있습니다.'
});
Object.assign(zh,{
 'Brush entity association':'笔刷实体关联','Linked entity':'关联实体','Missing entity':'实体不存在','brushes':'笔刷','linked brushes':'关联笔刷',
 'Detach this brush (worldspawn)':'解除此笔刷关联 (worldspawn)','Detach brush from entity (worldspawn)':'解除笔刷实体关联 (worldspawn)',
 'Detach entire entity':'解除整个实体关联','Detach all brushes of this entity':'解除该实体所有笔刷关联',
 'Convert linked brushes to worldspawn':'将关联笔刷转换为 worldspawn','Detach selected brushes':'解除选中笔刷关联',
 'Detach all brushes of these entities':'解除这些实体的全部笔刷关联',
 'Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.':'解除选中笔刷或整个实体的关联，保留几何体和 UV。',
 'Brush shape, textures, dimensions, position and grouping remain unchanged.':'保留形状、纹理、尺寸、位置及分组。',
 'Convert brushes to worldspawn?':'将笔刷转换为 worldspawn？',
 'The last brush of these entities will be detached, so their keyvalues and connections will be removed:':'这些实体的最后一个笔刷将解除关联，其属性和连接会被删除：',
 'You can undo this operation with Ctrl+Z.':'可以用 Ctrl+Z 撤销。'
});
Object.assign(pt,{
 'Brush entity association':'Associação de entidade ao brush','Linked entity':'Entidade vinculada','Missing entity':'Entidade ausente','brushes':'brushes','linked brushes':'brushes vinculados',
 'Detach this brush (worldspawn)':'Desvincular este brush (worldspawn)','Detach brush from entity (worldspawn)':'Desvincular brush da entidade (worldspawn)',
 'Detach entire entity':'Desvincular entidade inteira','Detach all brushes of this entity':'Desvincular todos os brushes da entidade',
 'Convert linked brushes to worldspawn':'Converter brushes vinculados para worldspawn','Detach selected brushes':'Desvincular brushes selecionados',
 'Detach all brushes of these entities':'Desvincular todos os brushes destas entidades',
 'Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.':'Desvincule brushes selecionados ou entidades inteiras sem alterar geometria ou UV.',
 'Brush shape, textures, dimensions, position and grouping remain unchanged.':'Forma, texturas, dimensões, posição e grupos são preservados.',
 'Convert brushes to worldspawn?':'Converter brushes para worldspawn?',
 'The last brush of these entities will be detached, so their keyvalues and connections will be removed:':'Estas entidades ficarão sem brushes e suas propriedades e conexões serão removidas:',
 'You can undo this operation with Ctrl+Z.':'É possível desfazer com Ctrl+Z.'
});

// HF7: editor-only entity marker options and spawn direction controls.
Object.assign(es,{
 'Marker shape':'Forma de los marcadores','Box':'Caja','Bubble / sphere':'Burbuja / esfera','Capsule':'Cápsula','Diamond':'Diamante','Cone':'Cono',
 'Markers are editor-only; shapes and sizes do not affect your MAP.':'Los marcadores son solo del editor; su tamaño y forma no modifican el MAP.',
 'Start facing direction':'Dirección inicial del jugador','Yaw (degrees)':'Giro horizontal (grados)',
 'Set where the player looks when spawning. The direction arrow in the viewport updates immediately.':'Elegí hacia dónde mira el jugador al aparecer. La flecha del visor se actualiza al instante.',
 'The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.':'La marca de inicio se apoya en el piso. No se modifican el origen ni las coordenadas exportadas.'
});
Object.assign(ru,{
 'Marker shape':'Форма маркеров','Box':'Куб','Bubble / sphere':'Сфера','Capsule':'Капсула','Diamond':'Ромб','Cone':'Конус',
 'Markers are editor-only; shapes and sizes do not affect your MAP.':'Формы и размеры маркеров используются только в редакторе.',
 'Start facing direction':'Направление появления','Yaw (degrees)':'Поворот (градусы)',
 'Set where the player looks when spawning. The direction arrow in the viewport updates immediately.':'Настройте направление взгляда игрока при появлении. Стрелка показывает направление.',
 'The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.':'Маркер стоит на полу; исходные координаты появления не изменяются.'
});
Object.assign(ko,{
 'Marker shape':'마커 모양','Box':'상자','Bubble / sphere':'구체','Capsule':'캡슐','Diamond':'다이아몬드','Cone':'원뿔',
 'Markers are editor-only; shapes and sizes do not affect your MAP.':'마커 모양과 크기는 에디터 전용이며 MAP에 영향을 주지 않습니다.',
 'Start facing direction':'시작 시 바라보는 방향','Yaw (degrees)':'수평 회전 (도)',
 'Set where the player looks when spawning. The direction arrow in the viewport updates immediately.':'플레이어의 시작 시야를 설정합니다. 화살표가 바로 갱신됩니다.',
 'The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.':'시작 마커는 바닥에 있으며 원래 좌표는 변하지 않습니다.'
});
Object.assign(zh,{
 'Marker shape':'标记形状','Box':'方框','Bubble / sphere':'球体','Capsule':'胶囊','Diamond':'菱形','Cone':'圆锥',
 'Markers are editor-only; shapes and sizes do not affect your MAP.':'标记形状和大小只影响编辑器，不改变 MAP。',
 'Start facing direction':'出生时朝向','Yaw (degrees)':'水平旋转（度）',
 'Set where the player looks when spawning. The direction arrow in the viewport updates immediately.':'设置玩家出生时朝向，视口的箭头会立即更新。',
 'The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.':'出生标记贴地显示，原始坐标与 MAP 导出不会改变。'
});
Object.assign(pt,{
 'Marker shape':'Formato dos marcadores','Box':'Caixa','Bubble / sphere':'Bolha / esfera','Capsule':'Cápsula','Diamond':'Diamante','Cone':'Cone',
 'Markers are editor-only; shapes and sizes do not affect your MAP.':'Os marcadores são apenas visuais e não alteram o MAP.',
 'Start facing direction':'Direção inicial do jogador','Yaw (degrees)':'Rotação horizontal (graus)',
 'Set where the player looks when spawning. The direction arrow in the viewport updates immediately.':'Escolha a direção do olhar ao nascer. A seta atualiza imediatamente.',
 'The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.':'O marcador fica sobre o piso; as coordenadas originais continuam iguais.'
});

// HF8: per-entity marker shapes and searchable names for gameplay connections.
Object.assign(es,{
 'Marker mode':'Modo de formas','Automatic by entity':'Automáticas según entidad','Same shape for all':'La misma forma para todas',
 'Global marker shape':'Forma global / alternativa','Marker colors':'Colores de marcadores',
 'Different colors by category':'Por categoría de entidad','One color for all':'Un solo color','Uniform marker color':'Color uniforme',
 'Rename in editor…':'Cambiar nombre en el editor…','Object display name':'Nombre visible del objeto',
 'Find entity by name…':'Buscar entidad por nombre…'
});
Object.assign(en,{
 'Marker mode':'Marker mode','Automatic by entity':'Automatic per entity','Same shape for all':'Same shape for all',
 'Global marker shape':'Global / fallback shape','Marker colors':'Marker colors',
 'Different colors by category':'Colors by category','One color for all':'One color for all','Uniform marker color':'Uniform color',
 'Rename in editor…':'Rename in editor…','Object display name':'Object display name','Find entity by name…':'Find entity by name…'
});
Object.assign(ru,{
 'Marker mode':'Режим маркеров','Automatic by entity':'По типу сущности','Same shape for all':'Одинаковая форма',
 'Global marker shape':'Общая форма','Marker colors':'Цвета маркеров',
 'Different colors by category':'По категориям','One color for all':'Один цвет','Uniform marker color':'Общий цвет',
 'Rename in editor…':'Переименовать в редакторе…','Object display name':'Название объекта','Find entity by name…':'Поиск по имени…'
});
Object.assign(ko,{
 'Marker mode':'마커 모드','Automatic by entity':'엔티티별 자동','Same shape for all':'모두 같은 모양',
 'Global marker shape':'기본 마커 모양','Marker colors':'마커 색상',
 'Different colors by category':'범주별 색상','One color for all':'동일한 색상','Uniform marker color':'공통 색상',
 'Rename in editor…':'에디터 이름 변경…','Object display name':'표시 이름','Find entity by name…':'이름으로 엔티티 검색…'
});
Object.assign(zh,{
 'Marker mode':'标记模式','Automatic by entity':'按实体自动显示','Same shape for all':'统一形状',
 'Global marker shape':'默认形状','Marker colors':'标记颜色',
 'Different colors by category':'按类别上色','One color for all':'统一颜色','Uniform marker color':'统一标记颜色',
 'Rename in editor…':'在编辑器中重命名…','Object display name':'对象显示名称','Find entity by name…':'按名称查找实体…'
});
Object.assign(pt,{
 'Marker mode':'Modo de marcadores','Automatic by entity':'Automático por entidade','Same shape for all':'Mesma forma para todas',
 'Global marker shape':'Forma global','Marker colors':'Cores dos marcadores',
 'Different colors by category':'Cores por categoria','One color for all':'Uma cor para todas','Uniform marker color':'Cor uniforme',
 'Rename in editor…':'Renomear no editor…','Object display name':'Nome visível do objeto','Find entity by name…':'Buscar entidade por nome…'
});

// HF10: marker visibility and picking through brushes.
Object.assign(es,{
  'Entities behind brushes':'Entidades detrás de brushes',
  'Visible and selectable through brushes':'Visibles y seleccionables a través de brushes',
  'Normal depth (hidden by brushes)':'Profundidad normal (ocultas por brushes)',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'El modo a través de brushes prioriza las entidades al hacer clic sin modificar el MAP. En modo normal, Alt + clic permite seleccionar una entidad oculta.',
});
Object.assign(en,{
  'Entities behind brushes':'Entities behind brushes',
  'Visible and selectable through brushes':'Visible and selectable through brushes',
  'Normal depth (hidden by brushes)':'Normal depth (hidden by brushes)',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.',
});
Object.assign(ru,{
  'Entities behind brushes':'Сущности за брашами',
  'Visible and selectable through brushes':'Видимые и выбираемые сквозь браши',
  'Normal depth (hidden by brushes)':'Обычная глубина (скрыты брашами)',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'Режим сквозного выбора позволяет выбрать сущность за брашем. В обычном режиме используйте Alt + щелчок.',
});
Object.assign(ko,{
  'Entities behind brushes':'브러시 뒤 엔티티',
  'Visible and selectable through brushes':'브러시를 통과해 표시 및 선택',
  'Normal depth (hidden by brushes)':'일반 깊이 (브러시에 가려짐)',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'투시 모드에서는 브러시 뒤 엔티티를 선택할 수 있습니다. 일반 모드에서는 Alt + 클릭을 사용하세요.',
});
Object.assign(zh,{
  'Entities behind brushes':'画刷后方的实体',
  'Visible and selectable through brushes':'透过画刷显示并可选择',
  'Normal depth (hidden by brushes)':'正常遮挡（被画刷遮住）',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'透视模式优先选择画刷后的实体；正常模式可用 Alt + 单击选择被遮挡的实体。',
});
Object.assign(pt,{
  'Entities behind brushes':'Entidades atrás dos brushes',
  'Visible and selectable through brushes':'Visíveis e selecionáveis através dos brushes',
  'Normal depth (hidden by brushes)':'Profundidade normal (ocultas pelos brushes)',
  'X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.':'O modo raio X permite selecionar entidades atrás dos brushes. No modo normal, use Alt + clique.',
});

// HF15: independent visual grid and editor transform increments.
Object.assign(es,{
 "Visual grid":"Grilla visible",
 "Move / draw step":"Paso mover / dibujar",
 "Rotation step":"Paso de rotación",
 "Scale step":"Paso de escala",
 "Grid precision settings":"Ajustes de precisión",
 "Close precision settings":"Cerrar ajustes de precisión",
 "Free rotation":"Rotación libre",
 "Free scaling":"Escala libre",
 "The visible grid does not limit editing precision.":"La grilla visible no limita la precisión de edición.",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift: movimiento fino/libre temporal. Ctrl: ajuste temporal por pasos.",
 "Off":"Desactivado"
});
Object.assign(en,{
 "Visual grid":"Visible grid",
 "Move / draw step":"Move / draw step",
 "Rotation step":"Rotation step",
 "Scale step":"Scale step",
 "Grid precision settings":"Grid precision settings",
 "Close precision settings":"Close precision settings",
 "Free rotation":"Free rotation",
 "Free scaling":"Free scaling",
 "The visible grid does not limit editing precision.":"Visible grid size does not limit editing precision.",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift: temporary fine/free move. Ctrl: temporary snap.",
 "Off":"Off"
});
Object.assign(ru,{
 "Visual grid":"Видимая сетка",
 "Move / draw step":"Шаг перемещения / рисования",
 "Rotation step":"Шаг поворота",
 "Scale step":"Шаг масштаба",
 "Grid precision settings":"Настройки точности сетки",
 "Close precision settings":"Закрыть настройки",
 "Free rotation":"Свободное вращение",
 "Free scaling":"Свободный масштаб",
 "The visible grid does not limit editing precision.":"Видимая сетка не ограничивает точность редактирования.",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift: точное перемещение. Ctrl: временная привязка.",
 "Off":"Выкл."
});
Object.assign(ko,{
 "Visual grid":"표시 그리드",
 "Move / draw step":"이동 / 그리기 간격",
 "Rotation step":"회전 간격",
 "Scale step":"크기 간격",
 "Grid precision settings":"그리드 정밀도 설정",
 "Close precision settings":"정밀도 설정 닫기",
 "Free rotation":"자유 회전",
 "Free scaling":"자유 크기 조절",
 "The visible grid does not limit editing precision.":"표시 그리드와 편집 정밀도는 별개입니다.",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift: 임시 정밀 이동. Ctrl: 임시 스냅.",
 "Off":"끔"
});
Object.assign(zh,{
 "Visual grid":"显示网格",
 "Move / draw step":"移动 / 绘制步长",
 "Rotation step":"旋转步长",
 "Scale step":"缩放步长",
 "Grid precision settings":"网格精度设置",
 "Close precision settings":"关闭精度设置",
 "Free rotation":"自由旋转",
 "Free scaling":"自由缩放",
 "The visible grid does not limit editing precision.":"显示网格不限制编辑精度。",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift：临时精细移动。Ctrl：临时吸附。",
 "Off":"关闭"
});
Object.assign(pt,{
 "Visual grid":"Grade visível",
 "Move / draw step":"Passo mover / desenhar",
 "Rotation step":"Passo de rotação",
 "Scale step":"Passo de escala",
 "Grid precision settings":"Ajustes de precisão",
 "Close precision settings":"Fechar ajustes",
 "Free rotation":"Rotação livre",
 "Free scaling":"Escala livre",
 "The visible grid does not limit editing precision.":"O tamanho da grade visível não limita a precisão da edição.",
 "Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.":"Shift: movimento preciso/livre. Ctrl: ajuste temporário.",
 "Off":"Desligado"
});

// HF15 Preview 2 HF3: truthful compiler output guidance in the Build Configuration dialog.
Object.assign(es,{
  'Automatic map output':'Salida automática del mapa',
  'When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.':'Al pulsar Compile Map, el editor genera un MAP temporal y ejecuta los compiladores del SDK de Sven Co-op. Si termina correctamente, el BSP se guarda automáticamente en la carpeta maps del juego configurado, con el nombre indicado abajo.',
  'Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.':'Compilar no exporta un proyecto portátil. Usá File → Guardar proyecto (Ctrl+S) para respaldar el proyecto editable. Si la compilación falla, no se copia un BSP nuevo.'
});
Object.assign(pt,{
  'Automatic map output':'Saída automática do mapa',
  'When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.':'Ao clicar em Compile Map, o editor gera um MAP temporário e executa os compiladores do SDK. Se a compilação terminar corretamente, o BSP será salvo automaticamente na pasta maps do Sven Co-op com o nome abaixo.',
  'Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.':'Compilar não exporta o projeto editável. Use File → Salvar projeto (Ctrl+S) para criar uma cópia. Se a compilação falhar, nenhum BSP novo será copiado.'
});
Object.assign(ru,{
  'Automatic map output':'Автоматическое сохранение карты',
  'When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.':'При нажатии Compile Map создаётся временный MAP и запускаются компиляторы SDK. После успешной сборки BSP сохраняется в папку maps выбранного Sven Co-op под указанным именем.',
  'Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.':'Компиляция не сохраняет редактируемый проект. Создайте резервную копию через File → Save project (Ctrl+S). При ошибке новый BSP не копируется.'
});
Object.assign(ko,{
  'Automatic map output':'맵 자동 출력',
  'When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.':'Compile Map을 누르면 임시 MAP 파일을 만들고 SDK 컴파일러를 실행합니다. 성공하면 지정된 이름의 BSP가 Sven Co-op의 maps 폴더에 자동 저장됩니다.',
  'Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.':'컴파일은 편집 가능한 프로젝트를 내보내지 않습니다. File → Save project (Ctrl+S)로 백업하세요. 실패 시 새 BSP를 복사하지 않습니다.'
});
Object.assign(zh,{
  'Automatic map output':'自动保存地图输出',
  'When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.':'点击 Compile Map 后，编辑器会创建临时 MAP 并执行 SDK 编译器。成功后，BSP 会以指定名称自动保存到 Sven Co-op 的 maps 文件夹。',
  'Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.':'编译不会导出可编辑项目。请使用 File → Save project (Ctrl+S) 备份。编译失败时不会复制新的 BSP。'
});

// v1.5.5 Advanced Lighting Studio labels. Native entity classnames and keys stay untranslated.
Object.assign(es,{
 'Advanced Lighting Studio':'Estudio avanzado de iluminación','Environment':'Entorno','Texture lights':'Luces de textura','Advanced SC-RAD':'SC-RAD avanzado','Styles & shadows':'Estilos y sombras',
 'Texture Lighting Studio':'Estudio de texturas luminosas','WAD texture name':'Nombre de textura WAD','Use selected face texture':'Usar textura de la cara seleccionada','Brightness (1–100000)':'Brillo (1–100000)',
 'Texture light color':'Color de luz de textura','Light RGB (required)':'RGB de luz (obligatorio)','Override texture color (_texcolor)':'Reemplazar color de textura (_texcolor)',
 'Use original texture color (no _texcolor override)':'Usar color original de textura (sin modificar _texcolor)',
 'Dark gap in front of surface (_texlightgap)':'Separación de luz de la superficie (_texlightgap)',
 'Face filter max distance (_frange, optional)':'Distancia máxima del filtro (_frange, opcional)',
 'Add / update texture light':'Agregar / actualizar luz de textura','Update selected surface light':'Actualizar luz de superficie','Existing texture lighting':'Iluminación de texturas existente',
 'Advanced SC-RAD · info_compile_parameters':'SC-RAD avanzado · info_compile_parameters','Indoor bounce':'Rebotes de interior','Final detail':'Calidad final','Soft sky':'Cielo suave','Reload':'Recargar',
 'Apply SC-RAD settings':'Aplicar ajustes SC-RAD','Create SC-RAD settings entity':'Crear entidad de ajustes SC-RAD',
 'Bounces':'Rebotes','Quality':'Calidad','Color':'Color','Shadows':'Sombras',
 'Light styles & triggers':'Estilos de luces y activadores','Targetname':'Nombre de activación','Appearance (style)':'Apariencia (style)',
 'Custom light pattern (a–z, 1–64 characters)':'Patrón de luz personalizado (a–z, 1–64 caracteres)',
 'Initially dark (spawnflags bit 1)':'Apagada al inicio (spawnflags bit 1)',
 'Apply light style':'Aplicar estilo de luz','Switchable brush shadows & indirect bounce':'Sombras activables de brushes y rebotes indirectos',
 'Target brush entity name':'Nombre de la entidad brush objetivo','Add light_shadow':'Agregar light_shadow','Add light_bounce':'Agregar light_bounce'
});
Object.assign(ru,{
 'Advanced Lighting Studio':'Расширенная студия освещения','Environment':'Окружение','Texture lights':'Светящиеся текстуры','Advanced SC-RAD':'Расширенный SC-RAD','Styles & shadows':'Стили и тени',
 'Texture Lighting Studio':'Студия светящихся текстур','WAD texture name':'Имя текстуры WAD','Use selected face texture':'Взять текстуру выбранной грани','Brightness (1–100000)':'Яркость (1–100000)',
 'Add / update texture light':'Добавить / обновить светящуюся текстуру','Existing texture lighting':'Существующий свет текстур',
 'Indoor bounce':'Отражение в помещении','Final detail':'Финальное качество','Soft sky':'Мягкое небо','Reload':'Перезагрузить',
 'Apply SC-RAD settings':'Применить настройки SC-RAD','Create SC-RAD settings entity':'Создать настройки SC-RAD','Bounces':'Отражения','Quality':'Качество','Shadows':'Тени',
 'Light styles & triggers':'Стили света и триггеры','Targetname':'Имя цели','Apply light style':'Применить стиль света',
 'Switchable brush shadows & indirect bounce':'Переключаемые тени и отражения','Target brush entity name':'Имя целевого браша',
 'Add light_shadow':'Добавить light_shadow','Add light_bounce':'Добавить light_bounce'
});
Object.assign(ko,{
 'Advanced Lighting Studio':'고급 조명 스튜디오','Environment':'환경','Texture lights':'텍스처 조명','Advanced SC-RAD':'고급 SC-RAD','Styles & shadows':'스타일과 그림자',
 'Texture Lighting Studio':'텍스처 조명 스튜디오','WAD texture name':'WAD 텍스처 이름','Use selected face texture':'선택한 면의 텍스처 사용','Brightness (1–100000)':'밝기 (1–100000)',
 'Add / update texture light':'텍스처 조명 추가 / 수정','Existing texture lighting':'기존 텍스처 조명',
 'Indoor bounce':'실내 간접광','Final detail':'최종 품질','Soft sky':'부드러운 하늘광','Reload':'다시 불러오기',
 'Apply SC-RAD settings':'SC-RAD 설정 적용','Create SC-RAD settings entity':'SC-RAD 설정 엔티티 만들기','Bounces':'반사','Quality':'품질','Shadows':'그림자',
 'Light styles & triggers':'조명 스타일과 트리거','Targetname':'대상 이름','Apply light style':'조명 스타일 적용',
 'Switchable brush shadows & indirect bounce':'전환 가능한 그림자와 반사광','Target brush entity name':'대상 브러시 엔티티 이름',
 'Add light_shadow':'light_shadow 추가','Add light_bounce':'light_bounce 추가'
});
Object.assign(zh,{
 'Advanced Lighting Studio':'高级光照工作室','Environment':'环境','Texture lights':'发光纹理','Advanced SC-RAD':'高级 SC-RAD','Styles & shadows':'灯光样式和阴影',
 'Texture Lighting Studio':'纹理光照工作室','WAD texture name':'WAD 纹理名称','Use selected face texture':'使用选中面的纹理','Brightness (1–100000)':'亮度 (1–100000)',
 'Add / update texture light':'添加 / 更新纹理光','Existing texture lighting':'现有纹理光',
 'Indoor bounce':'室内反弹光','Final detail':'最终质量','Soft sky':'柔和天空光','Reload':'重新载入',
 'Apply SC-RAD settings':'应用 SC-RAD 设置','Create SC-RAD settings entity':'创建 SC-RAD 设置实体','Bounces':'反弹光','Quality':'质量','Shadows':'阴影',
 'Light styles & triggers':'灯光样式与触发器','Targetname':'目标名称','Apply light style':'应用灯光样式',
 'Switchable brush shadows & indirect bounce':'可切换的笔刷阴影与反弹光','Target brush entity name':'目标笔刷实体名称',
 'Add light_shadow':'添加 light_shadow','Add light_bounce':'添加 light_bounce'
});
Object.assign(pt,{
 'Advanced Lighting Studio':'Estúdio de iluminação avançada','Environment':'Ambiente','Texture lights':'Luzes de textura','Advanced SC-RAD':'SC-RAD avançado','Styles & shadows':'Estilos e sombras',
 'Texture Lighting Studio':'Estúdio de texturas luminosas','WAD texture name':'Nome da textura WAD','Use selected face texture':'Usar textura da face selecionada','Brightness (1–100000)':'Brilho (1–100000)',
 'Add / update texture light':'Adicionar / atualizar luz de textura','Existing texture lighting':'Iluminação de textura existente',
 'Indoor bounce':'Reflexos internos','Final detail':'Qualidade final','Soft sky':'Céu suave','Reload':'Recarregar',
 'Apply SC-RAD settings':'Aplicar ajustes SC-RAD','Create SC-RAD settings entity':'Criar entidade de ajustes SC-RAD','Bounces':'Reflexos','Quality':'Qualidade','Shadows':'Sombras',
 'Light styles & triggers':'Estilos de luz e acionadores','Targetname':'Nome do alvo','Apply light style':'Aplicar estilo de luz',
 'Switchable brush shadows & indirect bounce':'Sombras alternáveis e reflexos indiretos','Target brush entity name':'Nome da entidade brush alvo',
 'Add light_shadow':'Adicionar light_shadow','Add light_bounce':'Adicionar light_bounce'
});


// v1.7.16 — True Lighting translation coverage in all supported editor locales.
Object.assign(es,{
 "Rebuild temporary BSP (confirmation required)": "Reconstruir BSP temporal (requiere confirmación)",
 "Rebuild True Lighting": "Reconstruir True Lighting",
 "Stop WASD free camera (Esc / F8)": "Detener cámara libre WASD (Esc / F8)",
 "Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)": "Cámara libre: WASD mover, Q/E subir/bajar, Shift acelerar, ratón mirar (Esc libera)",
 "True Lighting fly WASD": "Cámara libre WASD de True Lighting",
 "True Lighting settings": "Ajustes de True Lighting",
 "Camera and lighting settings": "Ajustes de cámara e iluminación",
 "Expand preview in MAP workspace": "Ampliar vista previa en el espacio MAP",
 "Return to split view": "Volver a vista dividida",
 "Full True Lighting view": "Vista completa de True Lighting",
 "Split True Lighting view": "Vista dividida de True Lighting",
 "Close True Lighting (reopen from Studios)": "Cerrar True Lighting (abrir desde Estudios)",
 "Close True Lighting": "Cerrar True Lighting",
 "Compiling lightmaps…": "Compilando mapas de luz…",
 "No compiled preview for": "No hay vista compilada de",
 "Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.": "Elegí Reconstruir para calcular las luces del MAP sin instalar un BSP en Sven Co-op.",
 "Confirm True Lighting compilation": "Confirmar compilación de True Lighting",
 "Compile True Lighting?": "¿Compilar True Lighting?",
 "This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.": "Se compilará un BSP temporal y se calculará la iluminación. Puede tardar y reducir el rendimiento del editor o la PC hasta terminar.",
 "Choose compiler before compiling": "Elegí el compilador antes de comenzar",
 "Experimental": "Experimental",
 "The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.": "La vista previa es de solo lectura y no reemplaza el BSP del juego. SDHLT utiliza los ajustes configurados de AO y PCF.",
 "Cancel": "Cancelar",
 "Compile lighting": "Compilar iluminación",
 "Running compilers…": "Ejecutando compiladores…",
 "MAP changed or compiler settings changed since this bake. Rebuild to update lighting.": "El MAP o los ajustes del compilador cambiaron desde el último cálculo. Reconstruí la iluminación.",
 "Inside BSP / player spawn": "Dentro del BSP / inicio del jugador",
 "Outside BSP": "Fuera del BSP",
 "WASD move · Q/E vertical · Shift fast · Mouse look · Esc / F8 releases": "WASD mover · Q/E vertical · Shift rápido · Ratón mirar · Esc / F8 libera",
 "LMB orbit · RMB pan · Wheel zoom · Fly: WASD": "Izquierdo orbita · Derecho desplaza · Rueda zoom · Vuelo: WASD",
 "compiling…": "compilando…",
 "MAP / compiler changed · rebuild needed": "Cambió el MAP o compilador · hace falta reconstruir",
 "baked lightmaps": "mapas de luz calculados",
 "No compiled preview": "Sin vista previa compilada",
 "Unlit inspection": "Inspección sin iluminación",
 "Baked RGB": "RGB compilado",
 "Compiled lighting / calibration": "Iluminación compilada / calibración",
 "Close settings": "Cerrar ajustes",
 "True Lighting compiler": "Compilador de True Lighting",
 "Compiler profile": "Perfil de compilador",
 "Ambient Occlusion (-ao)": "Oclusión ambiental (-ao)",
 "SDHLT PCF shadow filtering": "Filtrado PCF de sombras de SDHLT",
 "Off": "Desactivado",
 "Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.": "Requiere la carpeta SDHLT y sdhlt.wad en Configuración de compilación. AO y PCF se calculan con SDHLRAD, no en el navegador.",
 "Current baked source:": "Origen de iluminación calculada:",
 "none": "ninguno",
 "Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.": "Cambiar perfil u opciones deja obsoleto el BSP anterior; pulsá Reconstruir para comparar.",
 "BSP camera position": "Posición de cámara BSP",
 "Interior": "Interior",
 "Exterior": "Exterior",
 "Open in BSP Viewer": "Abrir en visor BSP",
 "Lightmap gain": "Intensidad de lightmaps",
 "Diagnostic: show WAD textures without compiled lighting": "Diagnóstico: mostrar texturas WAD sin iluminación compilada",
 "Return to compiled RGB": "Volver al RGB compilado",
 "Inspect geometry (unlit)": "Inspeccionar geometría (sin luz)",
 "Reset calibration": "Restablecer calibración",
 "Wire": "Alámbrico",
 "ON": "ACTIVO",
 "OFF": "INACTIVO",
 "static preview (triggers not simulated).": "vista estática (no simula triggers).",
 "Display gamma": "Gamma de pantalla",
 "1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.": "1.00 es neutro; solo calibra la visualización, no SC-RAD rad_gamma.",
 "Lightmap filtering": "Filtrado de lightmaps",
 "smooth": "suave",
 "nearest": "cercano",
 "Smooth (bilinear)": "Suave (bilineal)",
 "Pixelated (nearest)": "Pixelado (cercano)",
 "Lightstyle snapshot": "Fotograma de estilo de luz",
 "frame": "fotograma",
 "faces with styled lights; use this slider to examine a single lighting frame.": "caras con luces animadas; usá el control para revisar un fotograma.",
 "faces with compiled lighting": "caras con iluminación compilada",
 "total": "en total",
 "all-black faces": "caras totalmente negras",
 "mean": "media",
 "peak": "máximo",
 "All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.": "Todas las muestras de luz son negras. Es un problema de datos BSP, no de cámara. Revisá geometría, registro del compilador y entidades de luz.",
 "No readable RGB light samples in this BSP. Check compiler build output.": "No hay muestras RGB legibles en este BSP. Revisá el registro de compilación.",
 "Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.": "La iluminación compilada está casi negra. Revisá el compilador, las luces y la geometría; usá la inspección sin luz solo para ver superficies.",
 "Configure the Sven Co-op game folder if sky faces are missing.": "Configurá la carpeta de Sven Co-op si faltan caras del cielo.",
 "Geometry inspection is UNLIT and does not represent compiled lighting. ": "La inspección de geometría NO TIENE LUZ y no representa la iluminación compilada. ",
 "Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.": "Muestras RGB del BSP compilado. La niebla y gamma solo afectan la visualización. AO y PCF requieren activarse al compilar con SDHLRAD. El filtrado de lightmaps no es PCF. No se simulan triggers, ajustes del jugador ni tiempos de lightstyles."
});
Object.assign(ru,{
 "Rebuild temporary BSP (confirmation required)": "Пересобрать временный BSP (требуется подтверждение)",
 "Rebuild True Lighting": "Пересобрать True Lighting",
 "Stop WASD free camera (Esc / F8)": "Остановить свободную камеру WASD (Esc / F8)",
 "Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)": "Свободная камера: WASD движение, Q/E вверх/вниз, Shift ускорение, мышь обзор (Esc выход)",
 "True Lighting fly WASD": "Свободная камера WASD True Lighting",
 "True Lighting settings": "Настройки True Lighting",
 "Camera and lighting settings": "Настройки камеры и освещения",
 "Expand preview in MAP workspace": "Развернуть просмотр в области MAP",
 "Return to split view": "Вернуться к разделённому виду",
 "Full True Lighting view": "Полный вид True Lighting",
 "Split True Lighting view": "Разделённый вид True Lighting",
 "Close True Lighting (reopen from Studios)": "Закрыть True Lighting (открыть в Студиях)",
 "Close True Lighting": "Закрыть True Lighting",
 "Compiling lightmaps…": "Компиляция карт освещения…",
 "No compiled preview for": "Нет скомпилированного просмотра для",
 "Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.": "Нажмите «Пересобрать», чтобы рассчитать освещение MAP без установки BSP в Sven Co-op.",
 "Confirm True Lighting compilation": "Подтверждение компиляции True Lighting",
 "Compile True Lighting?": "Скомпилировать True Lighting?",
 "This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.": "Будет создан временный BSP с рассчитанным освещением. Процесс может занять время и снизить производительность редактора или ПК до завершения.",
 "Choose compiler before compiling": "Выберите компилятор перед запуском",
 "Experimental": "Экспериментальный",
 "The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.": "Предпросмотр доступен только для чтения и не заменяет игровой BSP. SDHLT использует заданные параметры AO и PCF.",
 "Cancel": "Отмена",
 "Compile lighting": "Компилировать освещение",
 "Running compilers…": "Запуск компиляторов…",
 "MAP changed or compiler settings changed since this bake. Rebuild to update lighting.": "MAP или настройки компилятора изменились после расчёта. Пересоберите освещение.",
 "Inside BSP / player spawn": "Внутри BSP / точка появления",
 "Outside BSP": "Вне BSP",
 "WASD move · Q/E vertical · Shift fast · Mouse look · Esc / F8 releases": "WASD движение · Q/E высота · Shift ускорение · Мышь обзор · Esc / F8 выход",
 "LMB orbit · RMB pan · Wheel zoom · Fly: WASD": "ЛКМ вращение · ПКМ сдвиг · Колесо масштаб · Полёт: WASD",
 "compiling…": "компиляция…",
 "MAP / compiler changed · rebuild needed": "MAP / компилятор изменён · требуется пересборка",
 "baked lightmaps": "рассчитанные карты освещения",
 "No compiled preview": "Нет скомпилированного просмотра",
 "Unlit inspection": "Просмотр без освещения",
 "Baked RGB": "RGB запечённый",
 "Compiled lighting / calibration": "Скомпилированное освещение / калибровка",
 "Close settings": "Закрыть настройки",
 "True Lighting compiler": "Компилятор True Lighting",
 "Compiler profile": "Профиль компилятора",
 "Ambient Occlusion (-ao)": "Окклюзия окружения (-ao)",
 "SDHLT PCF shadow filtering": "Фильтрация теней PCF в SDHLT",
 "Off": "Выключено",
 "Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.": "Нужны папка SDHLT и sdhlt.wad в настройках сборки. AO и PCF рассчитываются SDHLRAD, а не браузером.",
 "Current baked source:": "Источник рассчитанного освещения:",
 "none": "нет",
 "Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.": "При смене профиля или настроек старый BSP устаревает; нажмите «Пересобрать» для сравнения.",
 "BSP camera position": "Положение камеры BSP",
 "Interior": "Внутри",
 "Exterior": "Снаружи",
 "Open in BSP Viewer": "Открыть в просмотрщике BSP",
 "Lightmap gain": "Усиление карт освещения",
 "Diagnostic: show WAD textures without compiled lighting": "Диагностика: текстуры WAD без рассчитанного света",
 "Return to compiled RGB": "Вернуться к рассчитанному RGB",
 "Inspect geometry (unlit)": "Проверить геометрию (без света)",
 "Reset calibration": "Сбросить калибровку",
 "Wire": "Каркас",
 "ON": "ВКЛ",
 "OFF": "ВЫКЛ",
 "static preview (triggers not simulated).": "статичный просмотр (триггеры не моделируются).",
 "Display gamma": "Экранная гамма",
 "1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.": "1.00 — нейтрально; только коррекция изображения, не SC-RAD rad_gamma.",
 "Lightmap filtering": "Фильтрация карт освещения",
 "smooth": "сглаженный",
 "nearest": "ближайший",
 "Smooth (bilinear)": "Сглаженный (билинейный)",
 "Pixelated (nearest)": "Пиксельный (ближайший)",
 "Lightstyle snapshot": "Кадр светового стиля",
 "frame": "кадр",
 "faces with styled lights; use this slider to examine a single lighting frame.": "граней с анимированным светом; ползунок показывает отдельный кадр.",
 "faces with compiled lighting": "граней с рассчитанным освещением",
 "total": "всего",
 "all-black faces": "полностью чёрных граней",
 "mean": "среднее",
 "peak": "пик",
 "All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.": "Все образцы освещения чёрные. Это данные BSP, не проблема камеры. Проверьте геометрию, вывод компилятора и световые сущности.",
 "No readable RGB light samples in this BSP. Check compiler build output.": "В BSP нет читаемых RGB-образцов. Проверьте вывод компилятора.",
 "Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.": "Освещение почти чёрное. Проверьте компилятор, световые сущности и геометрию; режим без света используйте только для осмотра.",
 "Configure the Sven Co-op game folder if sky faces are missing.": "Укажите папку Sven Co-op, если отсутствуют грани неба.",
 "Geometry inspection is UNLIT and does not represent compiled lighting. ": "Осмотр геометрии БЕЗ ОСВЕЩЕНИЯ не показывает рассчитанный свет. ",
 "Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.": "RGB-данные из BSP. Туман и гамма влияют только на отображение. AO и PCF применяются при сборке SDHLRAD; фильтр lightmap не равен PCF. Триггеры, настройки игрока и тайминги световых стилей не моделируются."
});
Object.assign(ko,{
 "Rebuild temporary BSP (confirmation required)": "임시 BSP 재빌드 (확인 필요)",
 "Rebuild True Lighting": "True Lighting 재빌드",
 "Stop WASD free camera (Esc / F8)": "WASD 자유 카메라 종료 (Esc / F8)",
 "Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)": "자유 카메라: WASD 이동, Q/E 상하, Shift 빠르게, 마우스 시점 (Esc 해제)",
 "True Lighting fly WASD": "True Lighting WASD 자유 카메라",
 "True Lighting settings": "True Lighting 설정",
 "Camera and lighting settings": "카메라 및 조명 설정",
 "Expand preview in MAP workspace": "MAP 작업 영역에서 미리보기 확장",
 "Return to split view": "분할 보기로 돌아가기",
 "Full True Lighting view": "True Lighting 전체 보기",
 "Split True Lighting view": "True Lighting 분할 보기",
 "Close True Lighting (reopen from Studios)": "True Lighting 닫기 (스튜디오에서 다시 열기)",
 "Close True Lighting": "True Lighting 닫기",
 "Compiling lightmaps…": "라이트맵 컴파일 중…",
 "No compiled preview for": "컴파일된 미리보기 없음:",
 "Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.": "재빌드를 선택하면 Sven Co-op에 BSP를 설치하지 않고 현재 MAP의 조명을 계산합니다.",
 "Confirm True Lighting compilation": "True Lighting 컴파일 확인",
 "Compile True Lighting?": "True Lighting을 컴파일하시겠습니까?",
 "This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.": "임시 BSP를 컴파일하고 조명을 베이크합니다. 시간이 걸릴 수 있으며 완료 전까지 편집기나 PC 성능이 저하될 수 있습니다.",
 "Choose compiler before compiling": "컴파일 전에 컴파일러 선택",
 "Experimental": "실험적",
 "The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.": "미리보기는 읽기 전용이며 게임의 BSP를 교체하지 않습니다. SDHLT는 설정된 AO와 PCF 옵션을 사용합니다.",
 "Cancel": "취소",
 "Compile lighting": "조명 컴파일",
 "Running compilers…": "컴파일러 실행 중…",
 "MAP changed or compiler settings changed since this bake. Rebuild to update lighting.": "마지막 베이크 이후 MAP 또는 컴파일러 설정이 변경되었습니다. 조명을 재빌드하세요.",
 "Inside BSP / player spawn": "BSP 내부 / 플레이어 시작점",
 "Outside BSP": "BSP 외부",
 "WASD move · Q/E vertical · Shift fast · Mouse look · Esc / F8 releases": "WASD 이동 · Q/E 높이 · Shift 빠르게 · 마우스 시점 · Esc / F8 해제",
 "LMB orbit · RMB pan · Wheel zoom · Fly: WASD": "좌클릭 회전 · 우클릭 이동 · 휠 확대 · 비행: WASD",
 "compiling…": "컴파일 중…",
 "MAP / compiler changed · rebuild needed": "MAP / 컴파일러 변경됨 · 재빌드 필요",
 "baked lightmaps": "베이크된 라이트맵",
 "No compiled preview": "컴파일된 미리보기 없음",
 "Unlit inspection": "조명 없는 검사",
 "Baked RGB": "베이크된 RGB",
 "Compiled lighting / calibration": "컴파일된 조명 / 보정",
 "Close settings": "설정 닫기",
 "True Lighting compiler": "True Lighting 컴파일러",
 "Compiler profile": "컴파일러 프로필",
 "Ambient Occlusion (-ao)": "앰비언트 오클루전 (-ao)",
 "SDHLT PCF shadow filtering": "SDHLT PCF 그림자 필터링",
 "Off": "끔",
 "Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.": "빌드 설정에 SDHLT 폴더와 sdhlt.wad가 필요합니다. AO와 PCF는 브라우저가 아닌 SDHLRAD에서 베이크됩니다.",
 "Current baked source:": "현재 베이크 소스:",
 "none": "없음",
 "Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.": "프로필이나 베이크 옵션을 변경하면 이전 BSP는 오래된 상태가 됩니다. 비교하려면 재빌드하세요.",
 "BSP camera position": "BSP 카메라 위치",
 "Interior": "내부",
 "Exterior": "외부",
 "Open in BSP Viewer": "BSP 뷰어에서 열기",
 "Lightmap gain": "라이트맵 강도",
 "Diagnostic: show WAD textures without compiled lighting": "진단: 컴파일된 조명 없이 WAD 텍스처 표시",
 "Return to compiled RGB": "컴파일된 RGB로 돌아가기",
 "Inspect geometry (unlit)": "지오메트리 검사 (조명 없음)",
 "Reset calibration": "보정 초기화",
 "Wire": "와이어프레임",
 "ON": "켜짐",
 "OFF": "꺼짐",
 "static preview (triggers not simulated).": "정적 미리보기 (트리거 미시뮬레이션).",
 "Display gamma": "화면 감마",
 "1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.": "1.00은 중립이며 화면 표시만 보정합니다. SC-RAD rad_gamma가 아닙니다.",
 "Lightmap filtering": "라이트맵 필터링",
 "smooth": "부드러움",
 "nearest": "최근접",
 "Smooth (bilinear)": "부드러움 (바이리니어)",
 "Pixelated (nearest)": "픽셀화 (최근접)",
 "Lightstyle snapshot": "라이트스타일 프레임",
 "frame": "프레임",
 "faces with styled lights; use this slider to examine a single lighting frame.": "애니메이션 조명이 있는 면; 슬라이더로 한 프레임을 검사하세요.",
 "faces with compiled lighting": "컴파일된 조명 면",
 "total": "총",
 "all-black faces": "완전히 검은 면",
 "mean": "평균",
 "peak": "최대",
 "All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.": "모든 조명 샘플이 검습니다. 카메라 문제가 아닌 BSP 데이터 문제입니다. 지오메트리, 컴파일러 출력, 조명 엔티티를 확인하세요.",
 "No readable RGB light samples in this BSP. Check compiler build output.": "이 BSP에는 읽을 수 있는 RGB 조명 샘플이 없습니다. 컴파일러 출력을 확인하세요.",
 "Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.": "컴파일된 조명이 거의 검습니다. 컴파일러 출력, 조명 엔티티와 지오메트리를 확인하세요.",
 "Configure the Sven Co-op game folder if sky faces are missing.": "하늘 면이 없으면 Sven Co-op 게임 폴더를 설정하세요.",
 "Geometry inspection is UNLIT and does not represent compiled lighting. ": "지오메트리 검사는 조명이 없으며 컴파일된 조명을 나타내지 않습니다. ",
 "Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.": "BSP에서 컴파일된 RGB 데이터입니다. 안개와 화면 감마는 표시만 바꿉니다. AO와 PCF는 SDHLRAD 컴파일 시 활성화해야 합니다. 라이트맵 필터는 PCF가 아닙니다. 트리거와 게임플레이 설정은 시뮬레이션하지 않습니다."
});
Object.assign(zh,{
 "Rebuild temporary BSP (confirmation required)": "重新构建临时 BSP（需要确认）",
 "Rebuild True Lighting": "重新构建 True Lighting",
 "Stop WASD free camera (Esc / F8)": "停止 WASD 自由相机 (Esc / F8)",
 "Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)": "自由相机：WASD 移动，Q/E 升降，Shift 加速，鼠标转向（Esc 退出）",
 "True Lighting fly WASD": "True Lighting WASD 自由相机",
 "True Lighting settings": "True Lighting 设置",
 "Camera and lighting settings": "相机与光照设置",
 "Expand preview in MAP workspace": "在 MAP 工作区展开预览",
 "Return to split view": "返回分屏视图",
 "Full True Lighting view": "True Lighting 完整视图",
 "Split True Lighting view": "True Lighting 分屏视图",
 "Close True Lighting (reopen from Studios)": "关闭 True Lighting（从工作室重新打开）",
 "Close True Lighting": "关闭 True Lighting",
 "Compiling lightmaps…": "正在编译光照贴图…",
 "No compiled preview for": "没有已编译的预览：",
 "Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.": "选择“重新构建”可烘焙当前 MAP 的光照，而无需向 Sven Co-op 安装 BSP。",
 "Confirm True Lighting compilation": "确认 True Lighting 编译",
 "Compile True Lighting?": "编译 True Lighting？",
 "This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.": "将编译临时 BSP 并烘焙光照。此过程可能耗时，完成前编辑器或电脑可能变慢。",
 "Choose compiler before compiling": "编译前选择编译器",
 "Experimental": "实验性",
 "The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.": "预览为只读，不会替换游戏中的 BSP。SDHLT 使用已设置的 AO 和 PCF 选项。",
 "Cancel": "取消",
 "Compile lighting": "编译光照",
 "Running compilers…": "正在运行编译器…",
 "MAP changed or compiler settings changed since this bake. Rebuild to update lighting.": "自上次烘焙后 MAP 或编译器设置已更改。请重新构建光照。",
 "Inside BSP / player spawn": "BSP 内部 / 玩家出生点",
 "Outside BSP": "BSP 外部",
 "WASD move · Q/E vertical · Shift fast · Mouse look · Esc / F8 releases": "WASD 移动 · Q/E 升降 · Shift 加速 · 鼠标转向 · Esc / F8 退出",
 "LMB orbit · RMB pan · Wheel zoom · Fly: WASD": "左键旋转 · 右键平移 · 滚轮缩放 · 飞行：WASD",
 "compiling…": "编译中…",
 "MAP / compiler changed · rebuild needed": "MAP / 编译器已改变 · 需要重新构建",
 "baked lightmaps": "已烘焙光照贴图",
 "No compiled preview": "没有已编译的预览",
 "Unlit inspection": "无光照检查",
 "Baked RGB": "已烘焙 RGB",
 "Compiled lighting / calibration": "已编译光照 / 校准",
 "Close settings": "关闭设置",
 "True Lighting compiler": "True Lighting 编译器",
 "Compiler profile": "编译器配置",
 "Ambient Occlusion (-ao)": "环境光遮蔽 (-ao)",
 "SDHLT PCF shadow filtering": "SDHLT PCF 阴影过滤",
 "Off": "关闭",
 "Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.": "需要在编译设置中指定 SDHLT 文件夹和 sdhlt.wad。AO 与 PCF 由 SDHLRAD 烘焙，而非浏览器模拟。",
 "Current baked source:": "当前烘焙来源：",
 "none": "无",
 "Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.": "更改配置或烘焙选项会使旧 BSP 过期；点击重新构建以比较。",
 "BSP camera position": "BSP 相机位置",
 "Interior": "内部",
 "Exterior": "外部",
 "Open in BSP Viewer": "在 BSP 查看器中打开",
 "Lightmap gain": "光照贴图增益",
 "Diagnostic: show WAD textures without compiled lighting": "诊断：显示无编译光照的 WAD 纹理",
 "Return to compiled RGB": "返回已编译 RGB",
 "Inspect geometry (unlit)": "检查几何体（无光照）",
 "Reset calibration": "重置校准",
 "Wire": "线框",
 "ON": "开启",
 "OFF": "关闭",
 "static preview (triggers not simulated).": "静态预览（不模拟触发器）。",
 "Display gamma": "显示伽马",
 "1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.": "1.00 为中性，仅校准显示效果，不修改 SC-RAD rad_gamma。",
 "Lightmap filtering": "光照贴图过滤",
 "smooth": "平滑",
 "nearest": "最近邻",
 "Smooth (bilinear)": "平滑（双线性）",
 "Pixelated (nearest)": "像素化（最近邻）",
 "Lightstyle snapshot": "灯光样式帧",
 "frame": "帧",
 "faces with styled lights; use this slider to examine a single lighting frame.": "个面具有动画光照；使用滑块查看单帧。",
 "faces with compiled lighting": "个面具有已编译光照",
 "total": "总计",
 "all-black faces": "全黑面",
 "mean": "平均",
 "peak": "峰值",
 "All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.": "所有光照样本均为黑色。这是 BSP 数据问题，不是相机问题。请检查几何体、编译器输出和光照实体。",
 "No readable RGB light samples in this BSP. Check compiler build output.": "此 BSP 中没有可读取的 RGB 光照样本。请检查编译输出。",
 "Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.": "已编译光照几乎全黑。检查编译输出、光照实体和几何体；无光照模式仅用于检查可见性。",
 "Configure the Sven Co-op game folder if sky faces are missing.": "若天空面缺失，请配置 Sven Co-op 游戏文件夹。",
 "Geometry inspection is UNLIT and does not represent compiled lighting. ": "几何体检查为无光照模式，不代表已编译光照。 ",
 "Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.": "显示 BSP 中的已编译 RGB 数据。雾效和屏幕伽马仅影响显示。AO 和 PCF 必须在 SDHLRAD 编译时启用；光照贴图过滤不等于 PCF。不模拟触发器和游戏设置。"
});
Object.assign(pt,{
 "Rebuild temporary BSP (confirmation required)": "Recompilar BSP temporário (requer confirmação)",
 "Rebuild True Lighting": "Recompilar True Lighting",
 "Stop WASD free camera (Esc / F8)": "Parar câmera livre WASD (Esc / F8)",
 "Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)": "Câmera livre: WASD mover, Q/E subir/descer, Shift acelerar, mouse olhar (Esc libera)",
 "True Lighting fly WASD": "Câmera livre WASD do True Lighting",
 "True Lighting settings": "Configurações de True Lighting",
 "Camera and lighting settings": "Configurações de câmera e iluminação",
 "Expand preview in MAP workspace": "Expandir prévia no espaço MAP",
 "Return to split view": "Voltar à visualização dividida",
 "Full True Lighting view": "Visualização completa do True Lighting",
 "Split True Lighting view": "Visualização dividida do True Lighting",
 "Close True Lighting (reopen from Studios)": "Fechar True Lighting (reabrir em Estúdios)",
 "Close True Lighting": "Fechar True Lighting",
 "Compiling lightmaps…": "Compilando mapas de luz…",
 "No compiled preview for": "Não há prévia compilada para",
 "Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.": "Escolha Recompilar para calcular a iluminação do MAP sem instalar um BSP no Sven Co-op.",
 "Confirm True Lighting compilation": "Confirmar compilação do True Lighting",
 "Compile True Lighting?": "Compilar True Lighting?",
 "This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.": "Será compilado um BSP temporário com iluminação calculada. Isso pode demorar e reduzir o desempenho do editor ou computador até terminar.",
 "Choose compiler before compiling": "Escolha o compilador antes de iniciar",
 "Experimental": "Experimental",
 "The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.": "A prévia é somente leitura e não substitui o BSP do jogo. O SDHLT usa as opções de AO e PCF configuradas.",
 "Cancel": "Cancelar",
 "Compile lighting": "Compilar iluminação",
 "Running compilers…": "Executando compiladores…",
 "MAP changed or compiler settings changed since this bake. Rebuild to update lighting.": "O MAP ou as configurações do compilador mudaram desde o último cálculo. Recompile a iluminação.",
 "Inside BSP / player spawn": "Dentro do BSP / início do jogador",
 "Outside BSP": "Fora do BSP",
 "WASD move · Q/E vertical · Shift fast · Mouse look · Esc / F8 releases": "WASD mover · Q/E vertical · Shift rápido · Mouse olhar · Esc / F8 libera",
 "LMB orbit · RMB pan · Wheel zoom · Fly: WASD": "Esquerdo orbita · Direito move · Roda zoom · Voo: WASD",
 "compiling…": "compilando…",
 "MAP / compiler changed · rebuild needed": "MAP / compilador alterado · recompilação necessária",
 "baked lightmaps": "mapas de luz calculados",
 "No compiled preview": "Sem prévia compilada",
 "Unlit inspection": "Inspeção sem iluminação",
 "Baked RGB": "RGB calculado",
 "Compiled lighting / calibration": "Iluminação compilada / calibração",
 "Close settings": "Fechar configurações",
 "True Lighting compiler": "Compilador do True Lighting",
 "Compiler profile": "Perfil do compilador",
 "Ambient Occlusion (-ao)": "Oclusão de ambiente (-ao)",
 "SDHLT PCF shadow filtering": "Filtragem PCF de sombras do SDHLT",
 "Off": "Desativado",
 "Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.": "Requer a pasta SDHLT e sdhlt.wad na configuração de compilação. AO e PCF são calculados pelo SDHLRAD, não pelo navegador.",
 "Current baked source:": "Origem da iluminação calculada:",
 "none": "nenhuma",
 "Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.": "Alterar o perfil ou as opções torna o BSP anterior desatualizado; recompile para comparar.",
 "BSP camera position": "Posição da câmera BSP",
 "Interior": "Interior",
 "Exterior": "Exterior",
 "Open in BSP Viewer": "Abrir no visualizador BSP",
 "Lightmap gain": "Intensidade dos lightmaps",
 "Diagnostic: show WAD textures without compiled lighting": "Diagnóstico: mostrar texturas WAD sem luz compilada",
 "Return to compiled RGB": "Voltar ao RGB calculado",
 "Inspect geometry (unlit)": "Inspecionar geometria (sem luz)",
 "Reset calibration": "Redefinir calibração",
 "Wire": "Aramado",
 "ON": "LIGADO",
 "OFF": "DESLIGADO",
 "static preview (triggers not simulated).": "prévia estática (gatilhos não simulados).",
 "Display gamma": "Gama da tela",
 "1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.": "1.00 é neutro; apenas calibração visual, não SC-RAD rad_gamma.",
 "Lightmap filtering": "Filtragem dos lightmaps",
 "smooth": "suave",
 "nearest": "vizinho mais próximo",
 "Smooth (bilinear)": "Suave (bilinear)",
 "Pixelated (nearest)": "Pixelado (mais próximo)",
 "Lightstyle snapshot": "Quadro de estilo de luz",
 "frame": "quadro",
 "faces with styled lights; use this slider to examine a single lighting frame.": "faces com luzes animadas; use o controle para examinar um quadro.",
 "faces with compiled lighting": "faces com iluminação compilada",
 "total": "no total",
 "all-black faces": "faces totalmente pretas",
 "mean": "média",
 "peak": "pico",
 "All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.": "Todas as amostras de luz estão pretas. É um problema dos dados BSP, não da câmera. Verifique geometria, log e entidades de luz.",
 "No readable RGB light samples in this BSP. Check compiler build output.": "Não há amostras RGB legíveis neste BSP. Verifique o log da compilação.",
 "Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.": "A iluminação compilada está quase preta. Verifique o compilador, as luzes e a geometria; use inspeção sem luz apenas para ver superfícies.",
 "Configure the Sven Co-op game folder if sky faces are missing.": "Configure a pasta do Sven Co-op se faltarem faces do céu.",
 "Geometry inspection is UNLIT and does not represent compiled lighting. ": "A inspeção da geometria NÃO TEM LUZ e não representa a iluminação compilada. ",
 "Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.": "Dados RGB compilados do BSP. Névoa e gama afetam apenas a visualização. AO e PCF exigem ativação na compilação SDHLRAD; filtro de lightmap não é PCF. Gatilhos e configurações do jogo não são simulados."
});
