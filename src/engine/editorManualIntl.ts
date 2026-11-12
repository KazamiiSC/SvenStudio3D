/** Localized base Help sections (technical classnames, file formats and key bindings remain literal). */
import type {Locale} from '../i18n';
import type {Manual} from './editorManual';
type OtherLocale=Exclude<Locale,'es'|'en'>;
type ManualTranslation=Omit<Manual,'studios'|'contact'> & {studios:{title:string;description:string}[]};
const ru:ManualTranslation={
 intro:'SvenStudio 3D — браузерный редактор карт Valve 220 для Sven Co-op / Svengine. Он позволяет создавать браши, настраивать UV и сущности, предварительно проверять взаимодействия и компилировать карты через локальный SDK. Окончательный результат проверяйте в Sven Co-op.',
 firstTitle:'Начало работы',first:['В Build Configuration укажите имя карты, папку компиляторов SDK и каталог Sven Co-op.','Загрузите текстуры WAD3 в Библиотеке и файл sven-coop.fgd для классов сущностей. Имена classnames не переводятся.','Создайте или импортируйте MAP/RMF, редактируйте объекты в 3D и сохраняйте проект через File → Save project (Ctrl+S) в .svenstudio.json.','Compile Map использует настроенные SC-компиляторы и сохраняет готовый BSP в папку maps. Исходный MAP во время сборки временный.'],
 fullTitle:'Рекомендуется полный экран',full:'Используйте полноэкранный режим редактора для камеры и меньшего количества конфликтов с браузером. Некоторые сочетания, например Ctrl+W и F5, могут обрабатываться самим браузером. Регулярно сохраняйте проект.',
 cameraTitle:'Мышь и камера',camera:['Удерживайте правую кнопку мыши для осмотра; короткий правый щелчок вне режима размещения открывает контекстное меню.','W/A/S/D перемещают камеру, Q/E меняют высоту, Shift ускоряет. Колесо приближает и отдаляет.','Средняя кнопка вращает камеру, Shift + средняя перемещает обзор. Настройки — Workspace → Camera & Gizmo Controls.','Переключение перспективной/ортографической проекции и горячие клавиши видов находятся в панели камеры.'],
 editTitle:'Редактирование и клавиши',edit:['Левый щелчок выбирает объект; Shift/Ctrl добавляют в выбор. Двойной щелчок по грани открывает Texture Studio.','G — перемещение, R — поворот, C — масштаб; X/Y/Z ограничивают ось. Escape или правый щелчок отменяет активную модальную операцию.','Видимая сетка и шаг редактирования независимы. Магнит включает Snap.','Ctrl+C копирует, Ctrl+V вставляет, Ctrl+S сохраняет проект, Ctrl+Z отменяет, Ctrl+Y повторяет, Delete удаляет.','В режиме граней E вытягивает; инструмент Draw создаёт браш. Удерживайте Z для радиального меню затенения.'],
 uvTitle:'Texture Studio / UV',uv:['Двойной щелчок по грани открывает плавающий Texture Studio; положение окна запоминается.','Alt + перетаскивание смещает UV, Alt+Shift вращает, Alt+Ctrl масштабирует.','Доступны U/V, масштаб, поворот, Fit, Align, Center, копирование материалов и пипетка. UV не меняют саму геометрию.'],
 shapesTitle:'Формы, префабы и размещение',shapes:['При размещении R поворачивает, Shift+R задаёт малый шаг, X/Y/Z выбирают ось, F выравнивает по поверхности, P повторяет, Escape отменяет.','Доступны Object, Vertex, Edge, Face, Clip, Hollow, CSG, Extrude, Bevel и Inset. Для точной 3D-установки смотрите раздел v1.9 ниже.'],
 walkTitle:'Предпросмотр игры',walk:['F5 или Shift+P включает Gameplay Test. WASD — ходьба, Shift — бег, Space — прыжок, C — приседание, E — взаимодействие.','F — фонарик, H — HUD, N — noclip, Escape — выход. Это приблизительная проверка, не движок Sven Co-op.'],
 shortcutsTitle:'Настраиваемые клавиши камеры и гизмо',shortcutsHint:'Сочетания показаны из действующих настроек Workspace. Изменение привязок сразу отражается в списке.',
 studiosTitle:'Инструменты и студии',studios:[
 ['Редактор MAP','Работа с брашами, гранями, сущностями, WAD и сценой 3D/2D.'],
 ['Texture Studio / WAD','Текстуры WAD3, оси UV, смещения, масштаб и выравнивание.'],
 ['Decal Studio','Размещение и редактирование infodecal на поверхностях.'],
 ['Формы и префабы','Быстрая архитектура, двери, окна, наборы и сохранённые префабы.'],
 ['Gameplay Studio','Кнопки, двери, триггеры, цели и связи сущностей.'],
 ['Co-op Puzzle Builder','Консоли, счётчики, multisource и совместные задачи.'],
 ['NPC & AI Studio','NPC, путевые точки, спавнеры и волны Encounter Director.'],
 ['Lighting Studio','Источники света, туман, небо и настройки окружения.'],
 ['True Lighting','Предпросмотр baked-освещения SC-RAD и экспериментального SDHLT.'],
 ['Sound Studio','Звуки и музыка, прослушивание и конвертация.'],
 ['World Builder Studio','Рельеф, тонкие поверхности, высотные карты, маршруты, туннели, мосты и кривые.'],
 ['Браузер моделей','Модели MDL, скины, bodygroups и анимации.'],
 ['Cinematic Camera Studio','Маршруты камер и trigger_camera.'],
 ['BSP Viewer / Recovery','Просмотр BSP и экспериментальное восстановление MAP.'],
 ['Brush Workshop / Smart Brush Fusion','Точное редактирование граней, отверстий и составных объектов.'],
 ['Map Doctor','Проверка геометрии, текстур, сущностей и ошибок сборки.'],
 ['Map Packager','Ресурсы карты, предварительный .res и ZIP для распространения.'],
 ['Gameplay Test','Приблизительный проход по карте до запуска игры.']
 ].map(([title,description])=>({title,description})),
 workspaceTitle:'Рабочее пространство и панели',workspace:['Библиотека обычно слева, свойства и Проводник справа; сверху — панель инструментов.','В Workspace можно закреплять, менять размер и порядок панелей, сохранять раскладку и масштаб интерфейса.','Build Configuration и Compile Map находятся в верхней панели. Настройки интерфейса сохраняются в браузере.','Edit HUD перемещает элементы поверх 3D-вида; Texture Studio также можно перетаскивать.'],
 technicalTitle:'Ресурсы и компиляция Sven Co-op',technical:['Браузер не читает произвольные локальные папки; выберите WAD/FGD и пути к игре и SDK для локального сервиса 127.0.0.1.','Портативный Node.js загружается при первом запуске, если отсутствует. После подготовки интернет не требуется; внешние игровые ресурсы и компиляторы не входят в поставку.','Проект сохраняется в .svenstudio.json, экспорт MAP соответствует Valve 220; итоговый BSP проверяйте в игре.'],
 noticeTitle:'Программа развивается',notice:'SvenStudio 3D постоянно улучшается. Сообщайте о найденных ошибках и недостающих инструментах.',linksTitle:'Связь с разработчиком'
};
const ko:ManualTranslation={
 intro:'SvenStudio 3D는 Sven Co-op / Svengine용 브라우저 기반 Valve 220 맵 편집기입니다. 브러시, UV, 엔티티, 간단한 상호작용과 로컬 SDK 컴파일을 지원합니다. 최종 맵은 Sven Co-op에서 검증하세요.',
 firstTitle:'시작하기',first:['Build Configuration에서 맵 이름과 Sven Co-op SDK 컴파일러 및 게임 경로를 설정하세요.','라이브러리에 WAD3 텍스처를 불러오고 sven-coop.fgd로 엔티티 정의를 가져오세요. classname은 번역되지 않습니다.','MAP/RMF를 불러오거나 맵을 만들고 3D 뷰에서 편집하세요. Ctrl+S는 .svenstudio.json 프로젝트를 저장합니다.','Compile Map은 설정된 컴파일러를 실행하고 BSP를 게임의 maps 폴더로 복사합니다. 빌드 중간 MAP은 임시 파일입니다.'],
 fullTitle:'전체 화면 권장',full:'카메라 조작과 브라우저 단축키 충돌을 줄이려면 전체 화면을 사용하세요. Ctrl+W나 F5 등 일부 키는 브라우저가 가로챌 수 있으므로 자주 저장하세요.',
 cameraTitle:'마우스 및 카메라',camera:['오른쪽 버튼을 드래그하면 시점을 회전합니다. 일반 편집 상태에서 짧게 누르면 메뉴가 열립니다.','WASD 이동, Q/E 위아래, Shift 가속, 휠 확대/축소를 사용합니다.','가운데 버튼은 궤도 회전, Shift + 가운데 버튼은 이동입니다. Workspace에서 카메라 및 기즈모를 설정하세요.','투시/직교 보기와 정면·측면·상단 카메라 단축키를 사용할 수 있습니다.'],
 editTitle:'편집 및 단축키',edit:['왼쪽 클릭으로 선택하고 Shift/Ctrl을 사용해 다중 선택합니다. 면을 두 번 클릭하면 Texture Studio가 열립니다.','G 이동, R 회전, C 크기 조절, X/Y/Z 축 제한입니다. Escape 또는 짧은 오른쪽 클릭으로 작업을 취소합니다.','표시 그리드와 편집 스냅 간격은 별개이며 자석 버튼으로 Snap을 전환합니다.','Ctrl+C 복사, Ctrl+V 붙여넣기, Ctrl+S 저장, Ctrl+Z 실행 취소, Ctrl+Y 다시 실행, Delete 삭제입니다.','면 편집에서 E는 돌출, 그리기 모드에서는 드래그로 브러시 생성, Z를 누르면 셰이딩 원형 메뉴가 열립니다.'],
 uvTitle:'Texture Studio / UV',uv:['면을 두 번 클릭해 UV 편집을 시작합니다. 떠 있는 창의 위치는 유지됩니다.','Alt+드래그 이동, Alt+Shift+드래그 회전, Alt+Ctrl+드래그 크기 변경을 사용합니다.','U/V 이동, 회전, 배율, Fit, Align, Center, 재질 복사/붙여넣기가 지원됩니다. UV 변경은 브러시 형상을 바꾸지 않습니다.'],
 shapesTitle:'형태, 프리팹 및 배치',shapes:['배치 중 R 회전, Shift+R 작은 회전, X/Y/Z 축 설정, F 표면 정렬, P 반복, Escape 취소입니다.','Object, Vertex, Edge, Face, Clip, Hollow, CSG, Extrude, Bevel 및 Inset을 지원합니다. 3D 배치 설명은 아래 v1.9 항목을 참고하세요.'],
 walkTitle:'Gameplay Test',walk:['F5 또는 Shift+P로 테스트합니다. WASD 이동, Shift 달리기, Space 점프, C 앉기, E 상호작용입니다.','F 손전등, H HUD, N noclip, Escape 종료입니다. 실제 Sven Co-op 게임 엔진의 동작과는 다를 수 있습니다.'],
 shortcutsTitle:'카메라 및 기즈모 단축키',shortcutsHint:'현재 Workspace 설정에 따른 실제 키를 표시합니다.',
 studiosTitle:'스튜디오 및 도구',studios:[
 ['MAP 편집기','3D/2D 브러시, 면, 엔티티, WAD 및 위치 조정.'],
 ['Texture Studio / WAD','WAD3 텍스처, UV 이동·회전·크기 및 정렬.'],
 ['Decal Studio','표면에 infodecal 배치 및 편집.'],
 ['형태 및 프리팹','벽, 바닥, 문, 창문 및 재사용 가능한 구조물.'],
 ['Gameplay Studio','문, 버튼, 트리거와 엔티티 연결.'],
 ['Co-op Puzzle Builder','협동 콘솔, 카운터 및 multisource 퍼즐.'],
 ['NPC & AI Studio','NPC, 웨이포인트, 스포너 및 전투 웨이브.'],
 ['Lighting Studio','조명, 안개, 스카이박스와 환경.'],
 ['True Lighting','SC-RAD/실험적 SDHLT BSP 조명 미리보기.'],
 ['Sound Studio','주변 음향, 음악, 미리 듣기 및 변환.'],
 ['World Builder Studio','지형, 높이맵, 도로, 교량, 터널 및 곡선.'],
 ['모델 브라우저','MDL 모델, 스킨, bodygroup과 애니메이션.'],
 ['Cinematic Camera Studio','카메라 경로와 trigger_camera.'],
 ['BSP Viewer / Recovery','BSP 검사 및 실험적인 MAP 복구.'],
 ['Brush Workshop / Smart Brush Fusion','정밀 면 편집, 구멍, 프레임 및 복합 브러시.'],
 ['Map Doctor','기하, 텍스처, 엔티티 및 컴파일 진단.'],
 ['Map Packager','리소스 검사, .res 미리보기 및 ZIP 생성.'],
 ['Gameplay Test','게임 실행 전 간단한 맵 탐색.']
 ].map(([title,description])=>({title,description})),
 workspaceTitle:'작업 공간 및 패널',workspace:['기본 레이아웃은 왼쪽 라이브러리, 오른쪽 속성/탐색기, 상단 툴바입니다.','Workspace에서 패널을 도킹하고 크기와 순서를 변경할 수 있습니다.','Build Configuration은 상단의 Compile Map 옆에 있으며 레이아웃은 브라우저에 저장됩니다.','Edit HUD로 뷰포트 도구를 옮기고 Texture Studio 창도 드래그할 수 있습니다.'],
 technicalTitle:'Sven Co-op 리소스 및 컴파일',technical:['브라우저는 게임 폴더를 임의로 읽지 못하므로 WAD/FGD와 게임/SDK 경로를 지정해야 합니다. 로컬 서비스는 127.0.0.1에서 동작합니다.','포터블 Node.js가 없으면 첫 실행에 다운로드합니다. 준비된 다음에는 오프라인 실행이 가능하며 게임 데이터/SDK는 별도입니다.','프로젝트는 .svenstudio.json이고 MAP 내보내기는 Valve 220입니다. 완성된 BSP는 실제 게임에서 테스트하세요.'],
 noticeTitle:'개발 중',notice:'SvenStudio 3D는 계속 개선되고 있습니다. 문제와 필요한 도구를 개발자에게 알려주세요.',linksTitle:'개발자 연락처'
};
const zh:ManualTranslation={
 intro:'SvenStudio 3D 是面向 Sven Co-op / Svengine 的浏览器 Valve 220 地图编辑器。支持笔刷、UV、实体、简化交互测试和本地 SDK 编译。最终效果应在 Sven Co-op 中验证。',
 firstTitle:'快速开始',first:['在 Build Configuration 中设置地图名、Sven Co-op SDK 编译器目录和游戏目录。','在资源库中导入 WAD3 纹理及 sven-coop.fgd，实体 classname 保留英文。','创建或导入 MAP/RMF，并在 3D 视图中编辑。Ctrl+S 将项目保存为 .svenstudio.json。','Compile Map 使用选定的编译器，并把成功生成的 BSP 复制到游戏 maps 目录；中间 MAP 是临时文件。'],
 fullTitle:'建议全屏使用',full:'全屏有助于控制相机并减少浏览器快捷键冲突。浏览器仍可能占用 Ctrl+W、F5 等快捷键，请经常保存项目。',
 cameraTitle:'鼠标与相机',camera:['按住鼠标右键拖动可观察场景；普通编辑状态下短按右键打开菜单。','WASD 移动，Q/E 上下，Shift 加速，滚轮缩放。','中键用于环绕，Shift + 中键用于平移。可在 Workspace 中设置相机与操作手柄。','视图按钮可以切换透视/正交视图，并使用正面、侧面和顶部快捷键。'],
 editTitle:'编辑与快捷键',edit:['左键选择，Shift/Ctrl 用于多选，双击表面打开 Texture Studio。','G 移动、R 旋转、C 缩放，X/Y/Z 约束轴。Escape 或短按右键取消当前操作。','显示网格与编辑吸附间隔是独立的；磁铁按钮控制 Snap。','Ctrl+C 复制、Ctrl+V 粘贴、Ctrl+S 保存、Ctrl+Z 撤销、Ctrl+Y 重做、Delete 删除。','选中面时 E 挤出；绘制模式下拖动创建笔刷，按住 Z 调出着色轮盘。'],
 uvTitle:'Texture Studio / UV',uv:['双击表面打开浮动 UV 编辑器；其位置会保留。','Alt+拖动移动 UV，Alt+Shift 旋转，Alt+Ctrl 缩放。','支持 U/V 偏移、比例、旋转、Fit、Align、Center 和材质复制粘贴。UV 编辑不改变实体几何形状。'],
 shapesTitle:'形状、预制件与放置',shapes:['放置时 R 旋转，Shift+R 小角度旋转，X/Y/Z 选轴，F 对齐表面，P 连续放置，Escape 取消。','提供 Object、Vertex、Edge、Face、Clip、Hollow、CSG、Extrude、Bevel 和 Inset。通用 3D 放置请看下方 v1.9 说明。'],
 walkTitle:'Gameplay Test',walk:['F5 或 Shift+P 开启测试。WASD 移动、Shift 奔跑、Space 跳跃、C 蹲下、E 交互。','F 手电筒，H HUD，N noclip，Escape 退出。这只是预览，并非完整的 Sven Co-op 游戏逻辑。'],
 shortcutsTitle:'可自定义相机与操作手柄快捷键',shortcutsHint:'此列表实时读取 Workspace 中设置的快捷键。',
 studiosTitle:'工作室与工具',studios:[
 ['MAP 编辑器','在 3D/2D 中编辑笔刷、面、实体和 WAD 资源。'],
 ['Texture Studio / WAD','纹理搜索、UV 偏移、缩放、旋转和对齐。'],
 ['Decal Studio','在表面放置及编辑 infodecal。'],
 ['形状与预制件','快速创建墙、地板、门、窗和可重用结构。'],
 ['Gameplay Studio','按钮、门、触发器和实体连接。'],
 ['Co-op Puzzle Builder','合作控制台、计数器与 multisource 谜题。'],
 ['NPC & AI Studio','NPC、路点、生成器与战斗波次。'],
 ['Lighting Studio','灯光、雾、天空盒和环境参数。'],
 ['True Lighting','SC-RAD 与实验性 SDHLT 的 BSP 烘焙预览。'],
 ['Sound Studio','环境声音、音乐、试听和转换。'],
 ['World Builder Studio','地形、高度图、道路、桥梁、隧道和曲线。'],
 ['模型浏览器','MDL、皮肤、bodygroup 与动画。'],
 ['Cinematic Camera Studio','相机路径和 trigger_camera。'],
 ['BSP Viewer / Recovery','查看 BSP 和实验性 MAP 恢复。'],
 ['Brush Workshop / Smart Brush Fusion','表面精细编辑、开孔、边框和复合笔刷。'],
 ['Map Doctor','几何、纹理、实体与编译错误检查。'],
 ['Map Packager','资源检查、.res 预览和 ZIP 打包。'],
 ['Gameplay Test','正式进入游戏之前的简化测试。']
 ].map(([title,description])=>({title,description})),
 workspaceTitle:'工作区与面板',workspace:['默认布局：左侧资源库、右侧属性/资源管理器、顶部工具栏。','Workspace 可停靠、调整大小、排序并保存布局。','Build Configuration 位于上方 Compile Map 旁边，布局保存在当前浏览器中。','Edit HUD 可移动视图按钮；Texture Studio 也可拖动。'],
 technicalTitle:'Sven Co-op 资源与编译',technical:['浏览器不能随意读取本机游戏目录，需要指定 WAD/FGD 和游戏/SDK 路径；本地服务在 127.0.0.1 运行。','首次启动缺少 Node.js 时会下载便携运行时，准备完成后可以离线使用；游戏资源与编译器需要另行提供。','项目保存为 .svenstudio.json，MAP 使用 Valve 220 格式；请在游戏内测试最终 BSP。'],
 noticeTitle:'持续开发',notice:'SvenStudio 3D 正在持续更新。欢迎反馈错误与缺失的功能。',linksTitle:'开发者联系方式'
};
const pt:ManualTranslation={
 intro:'SvenStudio 3D é um editor Valve 220 baseado no navegador para Sven Co-op / Svengine. Permite criar brushes, editar UV, posicionar entidades, pré-visualizar interações e compilar com o SDK local. Confira o BSP final no Sven Co-op.',
 firstTitle:'Primeiros passos',first:['Em Build Configuration, defina o nome do mapa e os diretórios do SDK e do jogo.','Importe texturas WAD3 pela biblioteca e o arquivo sven-coop.fgd para as classes de entidades; classnames permanecem em inglês.','Crie ou importe MAP/RMF e edite no visor 3D. Ctrl+S salva o projeto portátil .svenstudio.json.','Compile Map usa os compiladores configurados e copia o BSP pronto para a pasta maps; o MAP intermediário é temporário.'],
 fullTitle:'Tela cheia recomendada',full:'Use o modo de tela cheia para facilitar o controle de câmera e reduzir conflitos de atalhos do navegador. Algumas teclas como Ctrl+W e F5 ainda podem ser reservadas. Salve frequentemente.',
 cameraTitle:'Mouse e câmera',camera:['Segure e arraste o botão direito para olhar; um clique direito curto, fora do modo de posicionamento, abre o menu contextual.','WASD move, Q/E sobe e desce, Shift acelera e a roda aproxima ou afasta.','O botão do meio orbita; Shift + botão do meio desloca a câmera. Configure em Workspace → Camera & Gizmo Controls.','É possível alternar perspectiva/ortográfica e usar atalhos de vistas frontal, lateral e superior.'],
 editTitle:'Edição e teclado',edit:['Clique esquerdo seleciona; Shift/Ctrl fazem seleção múltipla. Clique duplo numa face abre Texture Studio.','G move, R gira, C escala e X/Y/Z restringem o eixo. Escape ou clique direito curto cancela operações modais.','A grade visível é independente do passo de edição; o ímã controla Snap.','Ctrl+C copia, Ctrl+V cola, Ctrl+S salva, Ctrl+Z desfaz, Ctrl+Y refaz e Delete exclui.','No modo de faces E extruda; no modo desenho arraste para criar um brush; segure Z para abrir o menu radial de sombreado.'],
 uvTitle:'Texture Studio / UV',uv:['Clique duplo na face abre o editor UV flutuante, que memoriza a posição.','Alt + arrastar move UV; Alt+Shift gira; Alt+Ctrl altera escala.','Ajuste U/V, escala, rotação, Fit, Align, Center e cópia de materiais. UV não modifica a geometria.'],
 shapesTitle:'Formas, prefabs e posicionamento',shapes:['Ao posicionar: R gira, Shift+R gira em passos menores, X/Y/Z seleciona eixo, F alinha com a superfície, P repete e Escape cancela.','As ferramentas incluem Object, Vertex, Edge, Face, Clip, Hollow, CSG, Extrude, Bevel e Inset. Veja o posicionamento 3D da v1.9 abaixo.'],
 walkTitle:'Gameplay Test',walk:['F5 ou Shift+P ativa o teste. WASD move, Shift corre, Space pula, C agacha e E interage.','F liga lanterna, H controla HUD, N ativa noclip e Escape sai. É uma prévia, não o jogo completo.'],
 shortcutsTitle:'Atalhos configuráveis de câmera e gizmo',shortcutsHint:'A lista mostra as teclas reais definidas em Workspace e atualiza quando você as altera.',
 studiosTitle:'Estúdios e ferramentas',studios:[
 ['Editor MAP','Edição 3D/2D de brushes, faces, entidades e recursos WAD.'],
 ['Texture Studio / WAD','Texturas WAD3, UV, escala, rotação e alinhamento.'],
 ['Decal Studio','Posicionamento e edição de infodecal em superfícies.'],
 ['Formas e prefabs','Paredes, pisos, portas, janelas e estruturas reutilizáveis.'],
 ['Gameplay Studio','Botões, portas, triggers e conexões de entidades.'],
 ['Co-op Puzzle Builder','Consoles cooperativos, contadores e puzzles multisource.'],
 ['NPC & AI Studio','NPCs, waypoints, spawners e ondas de inimigos.'],
 ['Lighting Studio','Luzes, neblina, skybox e ambiente.'],
 ['True Lighting','Prévia baked do SC-RAD e SDHLT experimental.'],
 ['Sound Studio','Sons ambientais, música, prévia e conversão.'],
 ['World Builder Studio','Terrenos, heightmaps, estradas, pontes, túneis e curvas.'],
 ['Navegador de modelos','Modelos MDL, skins, bodygroups e animações.'],
 ['Cinematic Camera Studio','Caminhos de câmera e trigger_camera.'],
 ['BSP Viewer / Recovery','Análise de BSP e recuperação experimental para MAP.'],
 ['Brush Workshop / Smart Brush Fusion','Edição de faces, aberturas, molduras e brushes compostos.'],
 ['Map Doctor','Análise de geometria, texturas, entidades e compilação.'],
 ['Map Packager','Recursos, prévia de .res e ZIP de distribuição.'],
 ['Gameplay Test','Teste simplificado de escala e interações do mapa.']
 ].map(([title,description])=>({title,description})),
 workspaceTitle:'Área de trabalho e painéis',workspace:['No padrão, a biblioteca aparece à esquerda, as Propriedades/Explorador à direita e as ferramentas no topo.','Workspace permite encaixar, redimensionar e reorganizar painéis, além de salvar o layout.','Build Configuration fica na barra superior ao lado de Compile Map; layout é salvo no navegador.','Edit HUD permite mover botões sobre o visor, e Texture Studio também pode ser arrastado.'],
 technicalTitle:'Recursos e compilação Sven Co-op',technical:['O navegador não pode acessar livremente o disco: escolha WAD/FGD e os diretórios do jogo e SDK para o serviço local 127.0.0.1.','Se necessário, o Node.js portátil é baixado no primeiro início; depois funciona offline. Recursos do jogo e compiladores são externos.','O projeto usa .svenstudio.json, o MAP usa Valve 220; teste o BSP no Sven Co-op.'],
 noticeTitle:'Projeto em desenvolvimento',notice:'SvenStudio 3D continua recebendo melhorias. Informe problemas e ferramentas que estejam faltando.',linksTitle:'Contato com o desenvolvedor'
};
const locales:Record<OtherLocale,ManualTranslation>={ru,ko,zh,pt};
export function localizeManual(locale:OtherLocale,english:Manual):Manual {
 const values=locales[locale];
 return {...english,...values,contact:english.contact};
}
/** Readable keyboard-action names for the localized Help, without altering live bindings. */
const actionNames:Record<OtherLocale,Record<string,string>>={
 ru:{move:'Перемещение',rotate:'Поворот',scale:'Масштаб',fly:'Свободная камера',frame:'К выбранному',frameAll:'К карте',projection:'Перспектива / Ортографический',resetView:'Сброс камеры',front:'Спереди',right:'Справа',top:'Сверху',back:'Сзади',left:'Слева',bottom:'Снизу',isometric:'Изометрия',orbitLeft:'Орбита влево',orbitRight:'Орбита вправо',orbitUp:'Орбита вверх',orbitDown:'Орбита вниз',panLeft:'Сдвиг влево',panRight:'Сдвиг вправо',panUp:'Сдвиг вверх',panDown:'Сдвиг вниз',zoomIn:'Приблизить',zoomOut:'Отдалить'},
 ko:{move:'이동',rotate:'회전',scale:'크기',fly:'자유 카메라',frame:'선택 항목 맞추기',frameAll:'전체 맵 맞추기',projection:'투시 / 직교',resetView:'카메라 초기화',front:'정면',right:'오른쪽',top:'상단',back:'후면',left:'왼쪽',bottom:'하단',isometric:'등각',orbitLeft:'왼쪽 궤도',orbitRight:'오른쪽 궤도',orbitUp:'위쪽 궤도',orbitDown:'아래쪽 궤도',panLeft:'왼쪽 이동',panRight:'오른쪽 이동',panUp:'위로 이동',panDown:'아래로 이동',zoomIn:'확대',zoomOut:'축소'},
 zh:{move:'移动',rotate:'旋转',scale:'缩放',fly:'自由相机',frame:'聚焦所选',frameAll:'聚焦整张地图',projection:'透视 / 正交',resetView:'重置相机',front:'正面',right:'右侧',top:'顶部',back:'背面',left:'左侧',bottom:'底部',isometric:'等轴视图',orbitLeft:'向左环绕',orbitRight:'向右环绕',orbitUp:'向上环绕',orbitDown:'向下环绕',panLeft:'向左平移',panRight:'向右平移',panUp:'向上平移',panDown:'向下平移',zoomIn:'放大',zoomOut:'缩小'},
 pt:{move:'Mover',rotate:'Girar',scale:'Escalar',fly:'Câmera livre',frame:'Enquadrar seleção',frameAll:'Enquadrar mapa',projection:'Perspectiva / Ortográfica',resetView:'Reiniciar câmera',front:'Frente',right:'Direita',top:'Superior',back:'Atrás',left:'Esquerda',bottom:'Inferior',isometric:'Isométrica',orbitLeft:'Orbitar esquerda',orbitRight:'Orbitar direita',orbitUp:'Orbitar cima',orbitDown:'Orbitar baixo',panLeft:'Mover esquerda',panRight:'Mover direita',panUp:'Mover cima',panDown:'Mover baixo',zoomIn:'Aproximar',zoomOut:'Afastar'}
};
export function localizedActionTitle(locale:Locale,id:string,english:string):string {
 if(locale==='es'||locale==='en') return english;
 return actionNames[locale][id]||english;
}
