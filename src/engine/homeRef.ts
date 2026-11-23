import type {Locale} from '../i18n';

/**
 * v2.3 HF4 home copy. One dictionary per language, matching the approved
 * reference layout. Titles are short so they fit the fixed design canvas.
 */
export type ToolId='editor'|'bspViewer'|'bspEditor'|'csMap'|'world'|'connect'|'texture'|'sound'|'prefabs'|'doctor'|'together'|'resources';
export type AbilityId='mapEditing'|'bspTools'|'compile'|'materials'|'prefabAssets'|'soundAmbient'|'collaboration';
type Pair=readonly [string,string];
export type HomeRefCopy={
  quick:string;quickHint:string;actions:{new:string;open:string;import:string;build:string};
  recent:string;recentHint:string;viewAll:string;emptyRecent:string;historyUnavailable:string;currentTag:string;today:string;yesterday:string;
  brushes:string;entities:string;openSaved:string;openFile:string;fileOpenWarning:string;continueCurrent:string;restoreWarning:string;
  activeGame:string;activeGameHint:string;manage:string;profile:string;profileDefault:string;profileSven:string;profileCS:string;profileWarning:string;buildConfig:string;csSwitch:string;
  abilities:string;abilitiesHint:string;ability:Record<AbilityId,Pair>;
  tagline:string;description:string;continue:string;foot:string;
  tools:string;toolsHint:string;tool:Record<ToolId,Pair>;
  help:Pair;appearance:Pair;community:Pair;
};

const en:HomeRefCopy={
  quick:'QUICK ACTIONS',quickHint:'Start a new task instantly',actions:{new:'New\nProject',open:'Open\nProject',import:'Import\nMAP',build:'Build\nSetup'},
  recent:'RECENT PROJECTS',recentHint:'Continue where you left off',viewAll:'View all',emptyRecent:'No saved history yet',historyUnavailable:'Project history is unavailable',currentTag:'Open now',today:'Today',yesterday:'Yesterday',
  brushes:'brushes',entities:'entities',openSaved:'Restore this saved project',openFile:'Open this saved project file',fileOpenWarning:'Open this project file? Unsaved changes in the current map will be replaced (autosave keeps a recovery copy).',continueCurrent:'Continue the current map',restoreWarning:'Restore this saved snapshot? Save your current work first; the editor will switch to the selected project.',
  activeGame:'ACTIVE GAME / PROFILE',activeGameHint:'Select the target game and workspace profile',manage:'Manage',profile:'Profile',profileDefault:'(default)',profileSven:'Cooperative (GoldSrc)',profileCS:'Multiplayer (GoldSrc)',profileWarning:'Switch game profile? The current map geometry stays, but compiler and game paths change. Save your project first.',buildConfig:'Build configuration',csSwitch:'CS Map Studio needs the Counter-Strike 1.6 profile. Switch profile now?',
  abilities:'WHAT CAN YOU DO?',abilitiesHint:'A complete toolkit for GoldSrc map creation',
  ability:{mapEditing:['MAP Editing','Shape your level (MAP/RMF)'],bspTools:['BSP Tools','Inspect, edit and recover BSPs'],compile:['GoldSrc Compilation','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['Textures & Materials','Browse and apply WADs'],prefabAssets:['Prefabs & Assets','Use and reuse map structures'],soundAmbient:['Sound & Ambience','Sounds, music and ambience'],collaboration:['Collaboration','Map together with BuildTogether (LAN / network)']},
  tagline:'GOLDSRC MAPPING FOR SVEN CO-OP & COUNTER-STRIKE 1.6',description:'Create, edit, compile and share professional GoldSrc maps with powerful, unified tools.',continue:'Continue / Open 3D Editor',foot:'MAP · EDIT · COMPILE · TEST · COLLABORATE',
  tools:'EXPLORE YOUR TOOLS',toolsHint:'A powerful, unified suite for GoldSrc mapping, from level design to compilation and collaboration.',
  tool:{editor:['MAP Editor','Create and transform geometry (brushes, entities, groups)'],bspViewer:['BSP Viewer','Inspect compiled maps (entities, faces, UVs)'],bspEditor:['BSP Editor','Edit BSP content (entities, faces and UVs)'],csMap:['CS Map Studio','Spawns, bombsites, buyzones and game rules for CS 1.6'],world:['World Builder','Terrain, roads and geometry (large structures and landscapes)'],connect:['Smart Connect','Paths, openings and brush connections'],texture:['Texture Studio','Manage WADs, textures and UV mapping'],sound:['Sound Studio','Ambient sound, effects and game events'],prefabs:['Prefab Studio','Reusable map structures (rooms, props, and setups)'],doctor:['Map Doctor','Diagnostics, validation and build logs'],together:['BuildTogether','Collaborative LAN mapping (multiuser, realtime)'],resources:['Resource Library','Textures, models, sounds and common assets']},
  help:['Help & Guide','Features, shortcuts and tutorials'],appearance:['Appearance','Themes, accent color and layout'],community:['GoldSrc Mapping for the Community','Build maps, create experiences, and play together.']
};

const es:HomeRefCopy={
  quick:'ACCIONES RÁPIDAS',quickHint:'Empezá una tarea al instante',actions:{new:'Nuevo\nproyecto',open:'Abrir\nproyecto',import:'Importar\nMAP',build:'Config.\ncompilación'},
  recent:'PROYECTOS RECIENTES',recentHint:'Seguí donde lo dejaste',viewAll:'Ver todos',emptyRecent:'Todavía no hay historial guardado',historyUnavailable:'El historial de proyectos no está disponible',currentTag:'Abierto ahora',today:'Hoy',yesterday:'Ayer',
  brushes:'brushes',entities:'entidades',openSaved:'Restaurar este proyecto guardado',openFile:'Abrir este archivo de proyecto guardado',fileOpenWarning:'¿Abrir este archivo de proyecto? Los cambios sin guardar del mapa actual se reemplazarán (el autoguardado conserva una copia de recuperación).',continueCurrent:'Continuar con el mapa actual',restoreWarning:'¿Restaurar esta copia guardada? Guardá el trabajo actual antes de cambiar de proyecto.',
  activeGame:'JUEGO / PERFIL ACTIVO',activeGameHint:'Seleccioná el juego y el perfil de trabajo',manage:'Administrar',profile:'Perfil',profileDefault:'(predeterminado)',profileSven:'Cooperativo (GoldSrc)',profileCS:'Multijugador (GoldSrc)',profileWarning:'¿Cambiar de juego? La geometría actual se conserva, pero cambian las rutas del juego y de los compiladores. Guardá el proyecto primero.',buildConfig:'Configuración de compilación',csSwitch:'CS Map Studio necesita el perfil Counter-Strike 1.6. ¿Cambiar de perfil ahora?',
  abilities:'¿QUÉ PODÉS HACER?',abilitiesHint:'Herramientas completas para crear mapas GoldSrc',
  ability:{mapEditing:['Edición MAP','Modelá tu nivel (MAP/RMF)'],bspTools:['Herramientas BSP','Ver, editar y recuperar BSP'],compile:['Compilación GoldSrc','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['Texturas y materiales','Explorá, gestioná y aplicá WAD'],prefabAssets:['Prefabs y recursos','Usá y reutilizá estructuras'],soundAmbient:['Sonido y ambiente','Sonidos, música y ambientes'],collaboration:['Colaboración','Mapeá en equipo con BuildTogether (LAN / red)']},
  tagline:'MAPAS GOLDSRC PARA SVEN CO-OP Y COUNTER-STRIKE 1.6',description:'Creá, editá, compilá y compartí mapas GoldSrc con herramientas potentes y unificadas.',continue:'Continuar / Abrir editor 3D',foot:'MAPEAR · EDITAR · COMPILAR · PROBAR · COLABORAR',
  tools:'EXPLORÁ TUS HERRAMIENTAS',toolsHint:'Un conjunto unificado para mapas GoldSrc: del diseño de niveles a la compilación y la colaboración.',
  tool:{editor:['Editor MAP','Creá y transformá geometría (brushes, entidades, grupos)'],bspViewer:['Visor BSP','Inspeccioná mapas compilados (entidades, caras, UV)'],bspEditor:['Editor BSP','Editá contenido BSP (entidades, caras y UV)'],csMap:['CS Map Studio','Spawns, bombsites, zonas de compra y reglas de CS 1.6'],world:['World Builder','Terreno, caminos y geometría (estructuras y paisajes)'],connect:['Smart Connect','Rutas, aberturas y conexiones de brushes'],texture:['Texture Studio','WAD, texturas y alineación UV'],sound:['Sound Studio','Sonido ambiental, efectos y eventos'],prefabs:['Estudio de Prefabs','Estructuras reutilizables (salas, objetos y montajes)'],doctor:['Map Doctor','Diagnóstico, validación y logs de compilación'],together:['BuildTogether','Edición colaborativa LAN (multiusuario, en tiempo real)'],resources:['Biblioteca de recursos','Texturas, modelos, sonidos y recursos comunes']},
  help:['Ayuda y guía','Funciones, atajos y tutoriales'],appearance:['Apariencia','Temas, color de acento y distribución'],community:['Mapas GoldSrc para la comunidad','Construí mapas, creá experiencias y jugá en equipo.']
};

const pt:HomeRefCopy={
  quick:'AÇÕES RÁPIDAS',quickHint:'Comece uma tarefa imediatamente',actions:{new:'Novo\nprojeto',open:'Abrir\nprojeto',import:'Importar\nMAP',build:'Config.\ncompilação'},
  recent:'PROJETOS RECENTES',recentHint:'Continue de onde parou',viewAll:'Ver todos',emptyRecent:'Nenhum histórico salvo ainda',historyUnavailable:'Histórico de projetos indisponível',currentTag:'Aberto agora',today:'Hoje',yesterday:'Ontem',
  brushes:'brushes',entities:'entidades',openSaved:'Restaurar este projeto salvo',openFile:'Abrir este arquivo de projeto salvo',fileOpenWarning:'Abrir este arquivo de projeto? As alterações não salvas do mapa atual serão substituídas (o salvamento automático mantém uma cópia de recuperação).',continueCurrent:'Continuar o mapa atual',restoreWarning:'Restaurar este projeto salvo? Salve primeiro o trabalho atual.',
  activeGame:'JOGO / PERFIL ATIVO',activeGameHint:'Selecione o jogo e o perfil de trabalho',manage:'Gerenciar',profile:'Perfil',profileDefault:'(padrão)',profileSven:'Cooperativo (GoldSrc)',profileCS:'Multijogador (GoldSrc)',profileWarning:'Mudar de jogo? A geometria é preservada, mas os caminhos do jogo e dos compiladores mudam. Salve antes.',buildConfig:'Configuração de compilação',csSwitch:'O CS Map Studio precisa do perfil Counter-Strike 1.6. Mudar de perfil agora?',
  abilities:'O QUE VOCÊ PODE FAZER?',abilitiesHint:'Ferramentas completas para mapas GoldSrc',
  ability:{mapEditing:['Edição MAP','Modele seu nível (MAP/RMF)'],bspTools:['Ferramentas BSP','Ver, editar e recuperar BSP'],compile:['Compilação GoldSrc','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['Texturas e materiais','Explore e aplique WADs'],prefabAssets:['Prefabs e recursos','Use e reutilize estruturas'],soundAmbient:['Som e ambiente','Sons, música e ambientes'],collaboration:['Colaboração','Mapeie em equipe com BuildTogether (LAN / rede)']},
  tagline:'MAPEAMENTO GOLDSRC PARA SVEN CO-OP E COUNTER-STRIKE 1.6',description:'Crie, edite, compile e compartilhe mapas GoldSrc com ferramentas poderosas e unificadas.',continue:'Continuar / Abrir editor 3D',foot:'MAPEAR · EDITAR · COMPILAR · TESTAR · COLABORAR',
  tools:'EXPLORE SUAS FERRAMENTAS',toolsHint:'Um conjunto unificado para mapas GoldSrc: do design de níveis à compilação e colaboração.',
  tool:{editor:['Editor MAP','Crie e transforme geometria (brushes, entidades, grupos)'],bspViewer:['Visualizador BSP','Inspecione mapas compilados (entidades, faces, UV)'],bspEditor:['Editor BSP','Edite conteúdo BSP (entidades, faces e UV)'],csMap:['CS Map Studio','Spawns, bombsites, zonas de compra e regras do CS 1.6'],world:['World Builder','Terreno, estradas e geometria (estruturas e paisagens)'],connect:['Smart Connect','Rotas, aberturas e conexões de brushes'],texture:['Texture Studio','WADs, texturas e mapeamento UV'],sound:['Sound Studio','Som ambiente, efeitos e eventos'],prefabs:['Estúdio de Prefabs','Estruturas reutilizáveis (salas, objetos e montagens)'],doctor:['Map Doctor','Diagnóstico, validação e logs de compilação'],together:['BuildTogether','Mapeamento colaborativo LAN (multiusuário, tempo real)'],resources:['Biblioteca de recursos','Texturas, modelos, sons e recursos comuns']},
  help:['Ajuda e guia','Funções, atalhos e tutoriais'],appearance:['Aparência','Temas, cor de destaque e layout'],community:['Mapeamento GoldSrc para a comunidade','Crie mapas, experiências e jogue em conjunto.']
};

const ru:HomeRefCopy={
  quick:'БЫСТРЫЕ ДЕЙСТВИЯ',quickHint:'Сразу начните работу',actions:{new:'Новый\nпроект',open:'Открыть\nпроект',import:'Импорт\nMAP',build:'Настройка\nсборки'},
  recent:'НЕДАВНИЕ ПРОЕКТЫ',recentHint:'Продолжите с того же места',viewAll:'Все',emptyRecent:'Нет сохранённой истории',historyUnavailable:'История проектов недоступна',currentTag:'Открыт',today:'Сегодня',yesterday:'Вчера',
  brushes:'брашей',entities:'сущностей',openSaved:'Восстановить сохранённый проект',openFile:'Открыть сохранённый файл проекта',fileOpenWarning:'Открыть этот файл проекта? Несохранённые изменения текущей карты будут заменены (автосохранение хранит копию для восстановления).',continueCurrent:'Продолжить текущую карту',restoreWarning:'Восстановить эту копию? Сначала сохраните текущую работу.',
  activeGame:'ИГРА / ПРОФИЛЬ',activeGameHint:'Выбор игры и рабочего профиля',manage:'Настроить',profile:'Профиль',profileDefault:'(по умолчанию)',profileSven:'Кооператив (GoldSrc)',profileCS:'Мультиплеер (GoldSrc)',profileWarning:'Сменить игру? Геометрия останется, но пути игры и компиляторов изменятся. Сначала сохраните проект.',buildConfig:'Настройки сборки',csSwitch:'Для CS Map Studio нужен профиль Counter-Strike 1.6. Сменить профиль?',
  abilities:'ВОЗМОЖНОСТИ',abilitiesHint:'Полный набор для карт GoldSrc',
  ability:{mapEditing:['Редактор MAP','Создание уровня (MAP/RMF)'],bspTools:['Инструменты BSP','Правка и восстановление BSP'],compile:['Компиляция GoldSrc','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['Текстуры и материалы','Просмотр и применение WAD'],prefabAssets:['Префабы и ресурсы','Готовые структуры'],soundAmbient:['Звук и окружение','Звуки, музыка и атмосфера'],collaboration:['Совместная работа','BuildTogether (LAN / сеть)']},
  tagline:'GOLDSRC-КАРТЫ ДЛЯ SVEN CO-OP И COUNTER-STRIKE 1.6',description:'Создавайте, редактируйте, компилируйте и публикуйте карты GoldSrc в единой среде.',continue:'Продолжить / 3D-редактор',foot:'КАРТА · ПРАВКА · СБОРКА · ТЕСТ · КОМАНДА',
  tools:'ИНСТРУМЕНТЫ',toolsHint:'Единый набор для карт GoldSrc: от дизайна уровней до компиляции и совместной работы.',
  tool:{editor:['Редактор MAP','Геометрия (браши, сущности, группы)'],bspViewer:['Просмотр BSP','Готовые карты (сущности, грани, UV)'],bspEditor:['Редактор BSP','Правка BSP (сущности, грани, UV)'],csMap:['CS Map Studio','Спавны, бомбплейсы, зоны закупки для CS 1.6'],world:['World Builder','Рельеф, дороги и крупные структуры'],connect:['Smart Connect','Пути, проёмы и соединения брашей'],texture:['Texture Studio','WAD, текстуры и UV'],sound:['Sound Studio','Звуки окружения и события'],prefabs:['Prefab Studio','Готовые конструкции (комнаты, объекты)'],doctor:['Map Doctor','Диагностика, проверка и логи сборки'],together:['BuildTogether','Совместная работа по LAN в реальном времени'],resources:['Библиотека ресурсов','Текстуры, модели, звуки и ресурсы']},
  help:['Справка','Функции, клавиши и уроки'],appearance:['Оформление','Темы, цвет и расположение'],community:['Карты GoldSrc для сообщества','Создавайте карты и играйте вместе.']
};

const ko:HomeRefCopy={
  quick:'빠른 작업',quickHint:'새 작업을 바로 시작',actions:{new:'새\n프로젝트',open:'프로젝트\n열기',import:'MAP\n가져오기',build:'빌드\n설정'},
  recent:'최근 프로젝트',recentHint:'이어서 작업하기',viewAll:'모두 보기',emptyRecent:'저장된 기록이 없습니다',historyUnavailable:'프로젝트 기록을 사용할 수 없습니다',currentTag:'현재 열림',today:'오늘',yesterday:'어제',
  brushes:'브러시',entities:'엔티티',openSaved:'저장된 프로젝트 복원',openFile:'저장된 프로젝트 파일 열기',fileOpenWarning:'이 프로젝트 파일을 여시겠습니까? 현재 맵의 저장되지 않은 변경 사항이 대체됩니다(자동 저장에 복구용 사본이 남습니다).',continueCurrent:'현재 맵 계속',restoreWarning:'저장된 기록을 복원하시겠습니까? 현재 작업을 먼저 저장하세요.',
  activeGame:'게임 / 프로필',activeGameHint:'대상 게임과 작업 프로필 선택',manage:'관리',profile:'프로필',profileDefault:'(기본)',profileSven:'협동 (GoldSrc)',profileCS:'멀티플레이 (GoldSrc)',profileWarning:'게임을 변경하시겠습니까? 지오메트리는 유지되지만 게임 및 컴파일러 경로가 바뀝니다. 먼저 저장하세요.',buildConfig:'빌드 설정',csSwitch:'CS Map Studio에는 Counter-Strike 1.6 프로필이 필요합니다. 지금 변경할까요?',
  abilities:'무엇을 할 수 있나요?',abilitiesHint:'GoldSrc 맵 제작을 위한 완전한 도구',
  ability:{mapEditing:['MAP 편집','레벨 제작 (MAP/RMF)'],bspTools:['BSP 도구','BSP 검사, 편집, 복구'],compile:['GoldSrc 컴파일','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['텍스처와 재질','WAD 탐색, 관리, 적용'],prefabAssets:['프리팹과 리소스','구조물 재사용'],soundAmbient:['사운드와 환경','사운드, 음악, 환경음'],collaboration:['협업','BuildTogether로 함께 제작 (LAN / 네트워크)']},
  tagline:'SVEN CO-OP & COUNTER-STRIKE 1.6용 GOLDSRC 맵 제작',description:'강력한 통합 도구로 GoldSrc 맵을 제작, 편집, 컴파일하고 공유하세요.',continue:'계속 / 3D 편집기 열기',foot:'맵 · 편집 · 컴파일 · 테스트 · 협업',
  tools:'도구 둘러보기',toolsHint:'레벨 디자인부터 컴파일과 협업까지, GoldSrc 맵 제작 통합 도구.',
  tool:{editor:['MAP 편집기','지오메트리 생성과 변형 (브러시, 엔티티, 그룹)'],bspViewer:['BSP 뷰어','컴파일된 맵 검사 (엔티티, 면, UV)'],bspEditor:['BSP 편집기','BSP 내용 편집 (엔티티, 면, UV)'],csMap:['CS Map Studio','CS 1.6 스폰, 폭파 지점, 구매 구역'],world:['World Builder','지형, 도로, 대형 구조물'],connect:['Smart Connect','경로, 개구부, 브러시 연결'],texture:['Texture Studio','WAD, 텍스처, UV 매핑'],sound:['Sound Studio','환경음, 효과음, 이벤트'],prefabs:['Prefab Studio','재사용 구조물 (방, 소품, 구성)'],doctor:['Map Doctor','진단, 검증, 빌드 로그'],together:['BuildTogether','LAN 실시간 공동 편집'],resources:['리소스 라이브러리','텍스처, 모델, 사운드, 공용 리소스']},
  help:['도움말','기능, 단축키, 튜토리얼'],appearance:['테마','테마, 강조색, 배치'],community:['GoldSrc 맵 제작 커뮤니티','함께 맵을 만들고 즐기세요.']
};

const zh:HomeRefCopy={
  quick:'快捷操作',quickHint:'立即开始新任务',actions:{new:'新建\n项目',open:'打开\n项目',import:'导入\nMAP',build:'编译\n设置'},
  recent:'最近的项目',recentHint:'从上次中断处继续',viewAll:'查看全部',emptyRecent:'尚无已保存的历史',historyUnavailable:'项目历史暂不可用',currentTag:'当前打开',today:'今天',yesterday:'昨天',
  brushes:'笔刷',entities:'实体',openSaved:'恢复此已保存项目',openFile:'打开此已保存的项目文件',fileOpenWarning:'打开此项目文件？当前地图未保存的更改将被替换（自动保存会保留恢复副本）。',continueCurrent:'继续当前地图',restoreWarning:'恢复此项目快照？请先保存当前工作。',
  activeGame:'当前游戏 / 配置',activeGameHint:'选择目标游戏和工作配置',manage:'管理',profile:'配置',profileDefault:'(默认)',profileSven:'合作 (GoldSrc)',profileCS:'多人 (GoldSrc)',profileWarning:'切换游戏？当前几何保留，但游戏和编译器路径会改变。请先保存项目。',buildConfig:'编译设置',csSwitch:'CS Map Studio 需要 Counter-Strike 1.6 配置。现在切换吗？',
  abilities:'你可以做什么？',abilitiesHint:'完整的 GoldSrc 地图制作工具',
  ability:{mapEditing:['MAP 编辑','创建和塑造关卡 (MAP/RMF)'],bspTools:['BSP 工具','检查、编辑和恢复 BSP'],compile:['GoldSrc 编译','SC / ZHLT (CSG, BSP, VIS, RAD)'],materials:['纹理与材质','浏览、管理和应用 WAD'],prefabAssets:['预制件与资源','复用地图结构'],soundAmbient:['声音与环境','声音、音乐和环境'],collaboration:['协作','使用 BuildTogether 共同制作 (局域网)']},
  tagline:'SVEN CO-OP 与 COUNTER-STRIKE 1.6 GOLDSRC 地图制作',description:'使用强大的统一工具创建、编辑、编译和分享 GoldSrc 地图。',continue:'继续 / 打开 3D 编辑器',foot:'地图 · 编辑 · 编译 · 测试 · 协作',
  tools:'探索工具',toolsHint:'从关卡设计到编译与协作的统一 GoldSrc 地图工具套件。',
  tool:{editor:['MAP 编辑器','创建和变换几何 (笔刷、实体、分组)'],bspViewer:['BSP 查看器','检查已编译地图 (实体、表面、UV)'],bspEditor:['BSP 编辑器','编辑 BSP 内容 (实体、表面和 UV)'],csMap:['CS Map Studio','CS 1.6 出生点、炸弹点、购买区'],world:['World Builder','地形、道路和大型结构'],connect:['Smart Connect','路径、开口和笔刷连接'],texture:['Texture Studio','WAD、纹理和 UV 映射'],sound:['Sound Studio','环境音、效果和事件'],prefabs:['Prefab Studio','可复用结构 (房间、道具和布置)'],doctor:['Map Doctor','诊断、验证和编译日志'],together:['BuildTogether','局域网实时协作编辑'],resources:['资源库','纹理、模型、声音和常用资源']},
  help:['帮助指南','功能、快捷键和教程'],appearance:['外观','主题、强调色和布局'],community:['GoldSrc 地图社区','一起制作地图、创造体验与游戏。']
};

const dictionary:Record<Locale,HomeRefCopy>={en,es,pt,ru,ko,zh};
export const homeRef=(locale:Locale):HomeRefCopy=>dictionary[locale]??en;
