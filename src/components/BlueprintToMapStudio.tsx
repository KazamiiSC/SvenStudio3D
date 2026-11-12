import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,WheelEvent as ReactWheelEvent} from 'react';
import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {FileImage,ImagePlus,MousePointer2,Ruler,Route,Square,PanelsTopLeft,DoorOpen,ScanEye,Trash2,Copy,Save,Undo2,Redo2,Eye,EyeOff,ZoomIn,ZoomOut,Maximize2,X,AlertTriangle,CheckCircle2,Unlink2,Plus,RotateCcw,Download,Upload,MoveHorizontal,MoveVertical,Columns2,Box,Magnet,GitMerge,WandSparkles,Check,ShieldAlert,Layers3,ArrowUpFromLine,Footprints} from 'lucide-react';
import {useEditor} from '../store';
import {uid,type Brush} from '../engine/types';
import {initialBlueprint,calibrateBlueprint,addBlueprintOpening,fitBlueprintOpening,repairBlueprintOpenings,blueprintOpeningSpaces,exportBlueprintAsset,importBlueprintAsset,blueprintPixelToWorld,blueprintWorldToPixel,buildBlueprintBrushes,validateBlueprintPlan,snapBlueprintPoint,blueprintWallConnections,repairBlueprintWallConnections,BLUEPRINT_MAX_BRUSHES,BLUEPRINT_GROUND_ID,blueprintLevels,blueprintStrokeLevel,blueprintStairRectangle,type BlueprintLevel,type BlueprintStair,type BlueprintPlan,type BlueprintStroke,type BlueprintOpening,type PlanPoint} from '../engine/blueprintToMap';
import {transformedVertices} from '../engine/geometry';
import './blueprintToMapStudio.css';

const HF3_TEXT={
  en:{title:'Smart Wall Connections',on:'Join shared walls automatically',snap:'Magnetic snapping to walls and corners',repair:'Check / repair alignments',shared:'shared wall spans',saved:'redundant wall length',junctions:'wall junctions',review:'Review before applying',apply:'Apply alignment repair',cancel:'Discard preview',aligned:'Aligned corners and shared wall axes',noChange:'No nearby disconnected wall vertices found.',hint:'Green marks shared walls. Preview adjustments before applying; undo remains available.',preview:'Alignment preview: green dashed outlines are proposed positions.',invalid:'Repair preview could not be generated safely:',disabled:'Activate smart walls to prevent duplicates.'},
  es:{title:'Conexión inteligente de muros',on:'Unir paredes compartidas automáticamente',snap:'Ajuste magnético a muros y esquinas',repair:'Comprobar / reparar conexiones',shared:'tramos de pared compartida',saved:'longitud duplicada evitada',junctions:'uniones entre muros',review:'Revisar antes de aplicar',apply:'Aplicar reparación de uniones',cancel:'Descartar vista previa',aligned:'Esquinas y ejes de muros alineados',noChange:'No se encontraron vértices desalineados cercanos.',hint:'El verde indica muros compartidos. Revisá los ajustes antes de aplicarlos; podés deshacerlos.',preview:'Vista previa: las líneas verdes discontinuas muestran la posición propuesta.',invalid:'No fue posible preparar una reparación segura:',disabled:'Activá los muros inteligentes para evitar duplicados.'},
  ru:{title:'Умные соединения стен',on:'Объединять общие стены',snap:'Привязка к стенам и углам',repair:'Проверить и исправить соединения',shared:'общих участков',saved:'устранено повторов (ед.)',junctions:'стыков стен',review:'Просмотр изменений',apply:'Применить исправление',cancel:'Отменить предпросмотр',aligned:'Углы и оси выровнены',noChange:'Смещённые точки рядом не найдены.',hint:'Общие стены выделены зелёным. Проверьте изменения перед применением.',preview:'Зелёный пунктир показывает предложенную геометрию.',invalid:'Не удалось безопасно исправить:',disabled:'Включите умные стены.'},
  ko:{title:'스마트 벽 연결',on:'공유 벽 자동 병합',snap:'벽과 모서리에 자석 스냅',repair:'연결 확인 및 복구',shared:'공유 벽 구간',saved:'제거된 중복 길이',junctions:'벽 접합부',review:'적용 전 미리 보기',apply:'연결 복구 적용',cancel:'미리 보기 취소',aligned:'모서리와 벽 정렬 완료',noChange:'인접한 어긋난 꼭짓점이 없습니다.',hint:'초록색은 공유 벽입니다. 적용 전 확인하고 실행 취소할 수 있습니다.',preview:'초록색 점선이 제안된 위치입니다.',invalid:'안전하게 복구할 수 없습니다:',disabled:'스마트 벽을 켜세요.'},
  zh:{title:'智能墙体连接',on:'自动合并共享墙体',snap:'磁吸墙体和顶点',repair:'检测 / 修复连接',shared:'共享墙段',saved:'消除重复长度',junctions:'墙体接点',review:'应用前预览',apply:'应用连接修复',cancel:'取消预览',aligned:'已对齐墙角与墙体',noChange:'没有发现附近错位顶点。',hint:'绿色表示共享墙。应用前检查，并可撤销。',preview:'绿色虚线表示建议的位置。',invalid:'无法安全修复：',disabled:'启用智能墙体以防重复。'},
  pt:{title:'Conexões inteligentes de paredes',on:'Unir paredes compartilhadas automaticamente',snap:'Ajuste magnético a paredes e cantos',repair:'Verificar / reparar conexões',shared:'trechos compartilhados',saved:'comprimento duplicado evitado',junctions:'junções de paredes',review:'Prévia antes de aplicar',apply:'Aplicar reparação',cancel:'Descartar prévia',aligned:'Cantos e paredes alinhados',noChange:'Nenhum vértice desalinhado próximo.',hint:'Verde indica paredes compartilhadas. Confira antes de aplicar e use desfazer.',preview:'Linhas verdes tracejadas mostram a posição proposta.',invalid:'Não foi possível reparar com segurança:',disabled:'Ative paredes inteligentes para evitar duplicações.'}
} as const;
const HF4_TEXT={
  en:{rooms:'Rooms',properties:'Properties',connections:'Connections',selectRoom:'Select a room to edit',rename:'Name',vertices:'Vertices (world XY)',openings:'Openings',heightZ:'Height from floor (Z)',raise:'Raise',lower:'Lower',zHint:'Move the entire opening vertically without changing its height. Purple 3D handle: height from floor.',preview:'Openings can be edited in 2D or 3D.',noOpenings:'No openings in this room. Choose Door or Window to add one.',wall:'Wall',empty:'Choose a room in the Rooms tab.',width:'Width',height:'Height',position:'Position on wall',remove:'Remove opening',status:'Geometry status',goRooms:'Choose another room',select:'Select for 3D editing',floor:'Floor',ceiling:'Ceiling'},
  es:{rooms:'Habitaciones',properties:'Propiedades',connections:'Conexiones',selectRoom:'Elegí una habitación para editar',rename:'Nombre',vertices:'Vértices (XY del mapa)',openings:'Puertas y ventanas',heightZ:'Altura desde el suelo (Z)',raise:'Subir',lower:'Bajar',zHint:'Mové toda la abertura en vertical sin cambiar su alto. Control violeta en 3D: altura desde el suelo.',preview:'Podés editar las aberturas en 2D o 3D.',noOpenings:'Esta habitación no tiene aberturas. Usá Hueco de puerta o ventana.',wall:'Muro',empty:'Elegí una habitación en la pestaña Habitaciones.',width:'Ancho',height:'Alto',position:'Posición en el muro',remove:'Eliminar abertura',status:'Estado de la geometría',goRooms:'Elegir otra habitación',select:'Seleccionar para editar en 3D',floor:'Suelo',ceiling:'Techo'},
  ru:{rooms:'Комнаты',properties:'Свойства',connections:'Соединения',selectRoom:'Выберите комнату',rename:'Название',vertices:'Вершины (XY)',openings:'Проёмы',heightZ:'Высота от пола (Z)',raise:'Поднять',lower:'Опустить',zHint:'Фиолетовый маркер в 3D: вертикальное положение проёма.',preview:'Редактируйте проёмы в 2D и 3D.',noOpenings:'Проёмов нет.',wall:'Стена',empty:'Выберите комнату.',width:'Ширина',height:'Высота',position:'Позиция на стене',remove:'Удалить проём',status:'Состояние геометрии',goRooms:'Другая комната',select:'Выбрать в 3D',floor:'Пол',ceiling:'Потолок'},
  ko:{rooms:'방',properties:'속성',connections:'연결',selectRoom:'편집할 방 선택',rename:'이름',vertices:'꼭짓점 (XY)',openings:'문과 창',heightZ:'바닥에서 높이 (Z)',raise:'올리기',lower:'내리기',zHint:'3D의 보라색 핸들로 개구부를 위아래로 옮깁니다.',preview:'2D 또는 3D에서 개구부 편집',noOpenings:'개구부가 없습니다.',wall:'벽',empty:'방을 선택하세요.',width:'너비',height:'높이',position:'벽 위치',remove:'개구부 삭제',status:'형상 상태',goRooms:'다른 방 선택',select:'3D에서 선택',floor:'바닥',ceiling:'천장'},
  zh:{rooms:'房间',properties:'属性',connections:'连接',selectRoom:'选择要编辑的房间',rename:'名称',vertices:'顶点 (XY)',openings:'门窗开口',heightZ:'离地高度 (Z)',raise:'上移',lower:'下移',zHint:'拖动 3D 中的紫色手柄可上下移动开口。',preview:'在 2D 或 3D 中编辑开口',noOpenings:'暂无开口。',wall:'墙',empty:'选择一个房间。',width:'宽度',height:'高度',position:'墙上位置',remove:'删除开口',status:'几何状态',goRooms:'选择其他房间',select:'在 3D 中选择',floor:'地板',ceiling:'天花板'},
  pt:{rooms:'Salas',properties:'Propriedades',connections:'Conexões',selectRoom:'Escolha uma sala',rename:'Nome',vertices:'Vértices (XY)',openings:'Portas e janelas',heightZ:'Altura do piso (Z)',raise:'Subir',lower:'Descer',zHint:'Arraste o marcador roxo 3D para mover a abertura verticalmente.',preview:'Edite as aberturas em 2D ou 3D.',noOpenings:'Nenhuma abertura.',wall:'Parede',empty:'Escolha uma sala.',width:'Largura',height:'Altura',position:'Posição na parede',remove:'Remover abertura',status:'Geometria',goRooms:'Escolher outra sala',select:'Selecionar em 3D',floor:'Piso',ceiling:'Teto'}
} as const;

const LEVEL_TEXT={
  en:{floor:'Floor',ground:'Ground floor',add:'Add floor',remove:'Delete floor',stairs:'Stairs',placeStair:'Click where the staircase starts',levels:'Building floors',from:'From',to:'To',steps:'Steps',length:'Run length',direction:'Direction',name:'Name',selected:'Selected floor',all:'All floors',only:'Active floor',roof:'Ceiling',viewWalls:'Camera-facing walls',normal:'Normal',fade:'Fade',hide:'Hide automatically',hint:'The front walls are hidden only in the preview; the exported brushes remain intact.',stairHelp:'Create a floor above first. Place stairs on the lower floor, then edit size and direction.',deleteStair:'Delete staircase'},
  es:{floor:'Piso',ground:'Planta baja',add:'Agregar piso',remove:'Eliminar piso',stairs:'Escaleras',placeStair:'Hacé clic donde comienza la escalera',levels:'Plantas del edificio',from:'Desde',to:'Hasta',steps:'Peldaños',length:'Longitud',direction:'Dirección',name:'Nombre',selected:'Planta seleccionada',all:'Todas las plantas',only:'Solo planta activa',roof:'Techo',viewWalls:'Paredes frente a la cámara',normal:'Normal',fade:'Transparentar',hide:'Ocultar automáticamente',hint:'Las paredes cercanas se ocultan solo en la vista previa; los brushes del MAP no se modifican.',stairHelp:'Primero creá un piso superior. Colocá las escaleras en el piso inferior y ajustá tamaño y dirección.',deleteStair:'Eliminar escalera'},
  ru:{floor:'Этаж',ground:'Первый этаж',add:'Добавить этаж',remove:'Удалить этаж',stairs:'Лестница',placeStair:'Нажмите на начало лестницы',levels:'Этажи здания',from:'От',to:'До',steps:'Ступени',length:'Длина',direction:'Направление',name:'Название',selected:'Выбранный этаж',all:'Все этажи',only:'Активный этаж',roof:'Потолок',viewWalls:'Передние стены',normal:'Обычный',fade:'Прозрачные',hide:'Скрывать',hint:'Скрытие стен действует только в 3D-просмотре.',stairHelp:'Сначала добавьте второй этаж.',deleteStair:'Удалить лестницу'},
  ko:{floor:'층',ground:'1층',add:'층 추가',remove:'층 삭제',stairs:'계단',placeStair:'계단 시작 위치를 클릭하세요',levels:'건물 층',from:'시작 층',to:'도착 층',steps:'계단 수',length:'길이',direction:'방향',name:'이름',selected:'선택한 층',all:'모든 층',only:'현재 층',roof:'천장',viewWalls:'카메라 앞벽',normal:'기본',fade:'반투명',hide:'자동 숨김',hint:'벽 숨김은 3D 미리 보기에만 적용됩니다.',stairHelp:'위층을 먼저 추가하세요.',deleteStair:'계단 삭제'},
  zh:{floor:'楼层',ground:'底层',add:'添加楼层',remove:'删除楼层',stairs:'楼梯',placeStair:'点击楼梯起点',levels:'建筑楼层',from:'起点',to:'终点',steps:'台阶数',length:'长度',direction:'方向',name:'名称',selected:'当前楼层',all:'所有楼层',only:'当前楼层',roof:'天花板',viewWalls:'摄像机前方墙体',normal:'正常',fade:'半透明',hide:'自动隐藏',hint:'隐藏只影响3D预览，不改变MAP几何体。',stairHelp:'请先添加上层。',deleteStair:'删除楼梯'},
  pt:{floor:'Andar',ground:'Térreo',add:'Adicionar andar',remove:'Excluir andar',stairs:'Escadas',placeStair:'Clique no início da escada',levels:'Andares do prédio',from:'De',to:'Até',steps:'Degraus',length:'Comprimento',direction:'Direção',name:'Nome',selected:'Andar selecionado',all:'Todos os andares',only:'Andar atual',roof:'Teto',viewWalls:'Paredes da frente',normal:'Normal',fade:'Transparente',hide:'Ocultar automaticamente',hint:'A ocultação das paredes só afeta a prévia 3D.',stairHelp:'Adicione um andar superior primeiro.',deleteStair:'Excluir escada'}
} as const;
type Tool='select'|'calibrate'|'wall'|'room'|'rectangle'|'door'|'window'|'stair';
type View={x:number;y:number;w:number;h:number};
const clone=<T,>(a:T):T=>structuredClone(a);
const safeNumber=(v:number)=>Number.isFinite(v)?v:0;
const STRINGS={
  en:['Blueprint to Map','Trace walls and rooms over a scaled reference','Documents','New blueprint','Import PNG / JPG / WEBP','Calibrate','Walls','Polygon room','Rectangle room','Door opening','Window opening','Select','Generate / Update','Detach geometry','Delete blueprint','Preview 3D','Show blueprint','Finish outline','Cancel outline','Units between calibration points','Reference opacity','Grid snap (units)','Wall height','Wall thickness','Floor / ceiling thickness','Base Z','Material','Rooms and walls','Add a wall or room to see it here','Floor','Ceiling','Undo','Redo','Fit','Save before closing? Unsaved edits will be lost.','No outline to generate.','Calibration: click two points in the image.','Click to trace the outline; Enter finishes, Esc cancels.','Click near a segment to place the opening.','Ready. Add a wall or room, then generate real brushes.','A PNG/JPG/WEBP reference remains editable only; it is not exported to MAP.','Loaded image is too large (maximum 1.5 MB).','Click a wall in the list to edit points and openings.','Delete selected outline','Duplicate selected outline','Plan image replaced: existing traced geometry will be cleared. Continue?'],
  es:['Blueprint to Map','Dibujá muros y habitaciones sobre un plano calibrado','Documentos','Nuevo plano','Importar PNG / JPG / WEBP','Calibrar','Muros','Habitación poligonal','Habitación rectangular','Hueco de puerta','Hueco de ventana','Seleccionar','Generar / Actualizar','Desvincular geometría','Eliminar plano','Vista previa 3D','Mostrar plano','Terminar contorno','Cancelar contorno','Unidades entre puntos','Opacidad del plano','Ajuste de grilla (unidades)','Altura de muros','Grosor de muros','Espesor de suelo / techo','Altura base Z','Material','Habitaciones y muros','Dibujá un muro o habitación para verlo aquí','Suelo','Techo','Deshacer','Rehacer','Encajar','¿Salir sin guardar? Se perderán los cambios del plano.','No hay trazados para generar.','Calibración: hacé clic en dos puntos del plano.','Dibujá el contorno con clics; Enter termina, Esc cancela.','Hacé clic cerca de un tramo para crear el hueco.','Listo. Dibujá una habitación o muro y generá brushes reales.','La imagen de referencia se guarda solo en el proyecto; NO se exporta al MAP.','La imagen supera el límite de 1,5 MB.','Seleccioná un trazado para editar sus vértices y aberturas.','Eliminar trazado seleccionado','Duplicar trazado seleccionado','Reemplazar la imagen descartará los trazados actuales. ¿Continuar?'],
  ru:['Blueprint to Map','Чертите стены и комнаты по плану в масштабе','Документы','Новый план','Импорт PNG / JPG / WEBP','Масштаб','Стены','Комната многоугольник','Комната прямоугольник','Дверной проём','Оконный проём','Выбор','Создать / Обновить','Отвязать геометрию','Удалить план','Просмотр 3D','Показать план','Завершить контур','Отменить контур','Длина между точками','Прозрачность','Шаг сетки','Высота стен','Толщина стен','Толщина плит','Высота Z','Текстура','Комнаты и стены','Нарисуйте стены','Пол','Потолок','Отмена','Повтор','По размеру','Закрыть без сохранения?','Контур отсутствует','Выберите две точки','Нажимайте для точек; Enter завершает','Нажмите возле стены','Готово','Изображение не экспортируется в MAP','Файл слишком большой','Выберите контур','Удалить контур','Дублировать контур','Удалить контуры при замене изображения?'],
  ko:['Blueprint to Map','축척 평면도에 벽과 방을 그리세요','문서','새 평면도','PNG / JPG / WEBP 가져오기','축척','벽','다각형 방','직사각형 방','문 개구부','창 개구부','선택','생성 / 업데이트','형상 연결 해제','평면도 삭제','3D 미리보기','평면도 표시','윤곽 완료','취소','기준 거리','투명도','격자 간격','벽 높이','벽 두께','슬래브 두께','기준 Z','텍스처','방과 벽','윤곽을 그리세요','바닥','천장','실행 취소','다시 실행','맞춤','저장하지 않고 닫을까요?','윤곽이 없습니다','두 점 선택','클릭하여 점 추가, Enter 완료','벽 주변 클릭','준비','이미지는 MAP에 포함되지 않습니다','이미지가 너무 큽니다','윤곽 선택','윤곽 삭제','윤곽 복제','기존 윤곽을 지울까요?'],
  zh:['Blueprint to Map','在已校准比例的平面图上绘制墙壁与房间','文档','新建平面图','导入 PNG / JPG / WEBP','校准','墙壁','多边形房间','矩形房间','门洞','窗洞','选择','生成 / 更新','解除几何绑定','删除平面图','3D 预览','显示底图','完成轮廓','取消轮廓','参考距离','底图透明度','网格吸附','墙体高度','墙体厚度','楼板厚度','基准 Z','纹理','房间与墙壁','请先绘制轮廓','地板','天花板','撤销','重做','适应','丢弃未保存的编辑？','没有轮廓','点击两个校准点','点击添加顶点；Enter 完成','点击墙段添加开口','就绪','参考图不会导出到 MAP','图片文件过大','选择轮廓','删除轮廓','复制轮廓','替换图片将清除轮廓，继续？'],
  pt:['Blueprint to Map','Desenhe paredes e salas sobre uma planta em escala','Documentos','Nova planta','Importar PNG / JPG / WEBP','Calibrar','Paredes','Sala poligonal','Sala retangular','Vão de porta','Vão de janela','Selecionar','Gerar / Atualizar','Desvincular geometria','Excluir planta','Prévia 3D','Mostrar planta','Concluir contorno','Cancelar contorno','Distância de referência','Opacidade','Passo da grade','Altura das paredes','Espessura das paredes','Espessura do piso / teto','Altura base Z','Textura','Salas e paredes','Desenhe uma parede ou sala','Piso','Teto','Desfazer','Refazer','Ajustar','Fechar sem salvar?','Nenhum contorno','Selecione dois pontos','Clique para desenhar; Enter conclui','Clique perto de uma parede','Pronto','A imagem não é exportada para MAP','Imagem grande demais','Selecione um contorno','Excluir contorno','Duplicar contorno','Substituir a imagem apagará os desenhos. Continuar?']
} as const;
const HF2_TEXT={
  en:{open:'Open saved blueprint (.json)',export:'Export editable blueprint',duplicate:'Duplicate editable blueprint',close:'Save draft and close',split:'Split view',ceilings:'Hide ceilings in 3D',fit:'Auto-fit openings',saved:'Generated · editable',draft:'Draft · editable',edit3d:'3D: select an opening, then drag width, height or position handles.',short:'Opening may be too low for a standing player.',handles:'Cyan: width · green: height · amber: position',choose3d:'Select a doorway or window to edit it in 3D',maxWidth:'Maximum available width',corner:'Corner clearance',standalone:'Use File > Save project to save the whole map; export an editable blueprint for reuse.'},
  es:{open:'Abrir plano guardado (.json)',export:'Exportar plano editable',duplicate:'Duplicar plano editable',close:'Guardar borrador y cerrar',split:'Vista dividida',ceilings:'Ocultar techos en 3D',fit:'Ajustar aberturas automáticamente',saved:'Generado · editable',draft:'Borrador · editable',edit3d:'3D: seleccioná una abertura y arrastrá los controles de ancho, alto o posición.',short:'La abertura puede ser demasiado baja para un jugador de pie.',handles:'Cian: ancho · verde: alto · ámbar: posición',choose3d:'Seleccioná una abertura para editarla en 3D',maxWidth:'Ancho máximo en el tramo',corner:'Margen a esquina',standalone:'Usá Archivo > Guardar proyecto para conservar el mapa; exportá el plano editable para reutilizarlo.'},
  ru:{open:'Открыть сохранённый план (.json)',export:'Экспорт редактируемого плана',duplicate:'Дублировать план',close:'Сохранить черновик и закрыть',split:'Разделённый экран',ceilings:'Скрыть потолки в 3D',fit:'Исправить положение проёмов',saved:'Создан · редактируемый',draft:'Черновик · редактируемый',edit3d:'3D: выберите проём и перетаскивайте маркеры ширины, высоты и положения.',short:'Проём слишком низкий для стоящего игрока.',handles:'Голубой: ширина · зелёный: высота · янтарный: позиция',choose3d:'Выберите проём для редактирования в 3D',maxWidth:'Максимальная ширина',corner:'Отступ от угла',standalone:'Сохраните проект целиком или экспортируйте редактируемый план для повторного использования.'},
  ko:{open:'저장된 설계도 열기 (.json)',export:'편집 가능한 설계도 내보내기',duplicate:'설계도 복제',close:'초안 저장 후 닫기',split:'화면 분할',ceilings:'3D에서 천장 숨기기',fit:'개구부 자동 조정',saved:'생성됨 · 편집 가능',draft:'초안 · 편집 가능',edit3d:'3D: 개구부를 선택하고 너비, 높이, 위치 핸들을 드래그하세요.',short:'서 있는 플레이어가 통과하기에 높이가 낮을 수 있습니다.',handles:'청록: 너비 · 초록: 높이 · 황색: 위치',choose3d:'3D에서 편집할 개구부를 선택하세요',maxWidth:'최대 너비',corner:'모서리 여유',standalone:'전체 지도를 보관하려면 프로젝트를 저장하고, 재사용하려면 편집 가능한 설계도를 내보내세요.'},
  zh:{open:'打开已保存蓝图 (.json)',export:'导出可编辑蓝图',duplicate:'复制蓝图',close:'保存草稿并关闭',split:'分屏视图',ceilings:'3D 中隐藏天花板',fit:'自动调整门窗开口',saved:'已生成 · 可编辑',draft:'草稿 · 可编辑',edit3d:'3D：选择门窗开口，拖动宽度、高度或位置控制柄。',short:'开口高度可能不足以让站立玩家通过。',handles:'青色：宽度 · 绿色：高度 · 琥珀色：位置',choose3d:'选择门窗开口以在 3D 中编辑',maxWidth:'最大宽度',corner:'距角落间距',standalone:'保存项目以保留整个地图，导出可编辑蓝图以便复用。'},
  pt:{open:'Abrir planta salva (.json)',export:'Exportar planta editável',duplicate:'Duplicar planta editável',close:'Salvar rascunho e fechar',split:'Vista dividida',ceilings:'Ocultar tetos em 3D',fit:'Ajustar aberturas automaticamente',saved:'Gerado · editável',draft:'Rascunho · editável',edit3d:'3D: selecione uma abertura e arraste os controles de largura, altura e posição.',short:'A abertura pode ser baixa demais para um jogador em pé.',handles:'Ciano: largura · verde: altura · âmbar: posição',choose3d:'Selecione uma abertura para editar em 3D',maxWidth:'Largura máxima',corner:'Folga até a esquina',standalone:'Salve o projeto para manter o mapa completo e exporte a planta editável para reutilizá-la.'}
} as const;
function makePreviewGeometry(brushes:Brush[]):THREE.BufferGeometry{
  const positions:number[]=[];
  for(const brush of brushes){
    const v=transformedVertices(brush);
    for(const face of brush.faces){
      for(let i=1;i<face.indices.length-1;i++)for(const idx of [face.indices[0],face.indices[i],face.indices[i+1]]){
        const [x,y,z]=v[idx];positions.push(x,z,-y);
      }
    }
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.computeVertexNormals();return geom;
}
type OpeningChange=Partial<Pick<BlueprintOpening,'t'|'width'|'height'|'sill'>>;
/** Selection and handles live in the 3D preview, sharing exactly the same source document as the SVG. */
function OpeningEditor3D({plan,stroke,opening,active,onSelect,onChange,onDragState}:{
  plan:BlueprintPlan;stroke:BlueprintStroke;opening:BlueprintOpening;active:boolean;
  onSelect:()=>void;onChange:(patch:OpeningChange,first:boolean)=>void;onDragState:(dragging:boolean)=>void;
}){
  const a=blueprintPixelToWorld(plan,stroke.points[opening.edge]);
  const b=blueprintPixelToWorld(plan,stroke.points[(opening.edge+1)%stroke.points.length]);
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  const ux=dx/length,uy=dy/length,theta=Math.atan2(uy,ux);
  const midpoint:[number,number,number]=[a[0]+dx*opening.t,plan.baseZ+(blueprintLevels(plan).find(l=>l.id===blueprintStrokeLevel(stroke))?.offsetZ||0)+opening.sill+opening.height/2,-(a[1]+dy*opening.t)];
  const tangent=new THREE.Vector3(ux,0,-uy),normal=new THREE.Vector3(Math.sin(theta),0,Math.cos(theta));
  const drag=useRef<{mode:'width'|'height'|'t'|'sill';start:THREE.Vector3;value:number;first:boolean}|null>(null);
  const edgeLines=useMemo(()=>{
    const rectangle=new THREE.PlaneGeometry(opening.width,opening.height);
    const edges=new THREE.EdgesGeometry(rectangle);rectangle.dispose();return edges;
  },[opening.width,opening.height]);
  useEffect(()=>()=>edgeLines.dispose(),[edgeLines]);
  const pointFromRay=(e:ThreeEvent<PointerEvent>)=>{
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(...midpoint));
    return e.ray.intersectPlane(plane,new THREE.Vector3());
  };
  const handler=(mode:'width'|'height'|'t'|'sill')=>({
    onPointerDown:(e:ThreeEvent<PointerEvent>)=>{
      e.stopPropagation();onSelect();const point=pointFromRay(e);if(!point)return;
      drag.current={mode,start:point.clone(),value:opening[mode==='t'?'t':mode],first:true};
      onDragState(true);(e.target as EventTarget & {setPointerCapture?:(id:number)=>void})?.setPointerCapture?.(e.pointerId);
    },
    onPointerMove:(e:ThreeEvent<PointerEvent>)=>{
      e.stopPropagation();const current=drag.current;if(!current)return;
      const point=pointFromRay(e);if(!point)return;
      const delta=point.clone().sub(current.start);
      const raw=current.mode==='width'?current.value+2*delta.dot(tangent):current.mode==='height'||current.mode==='sill'?current.value+delta.y:current.value+delta.dot(tangent)/length;
      const value=current.mode==='t'?Math.round(raw*1000)/1000:Math.round(raw/2)*2;
      onChange({[current.mode]:value},current.first);current.first=false;
    },
    onPointerUp:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();drag.current=null;onDragState(false);try{(e.target as EventTarget & {releasePointerCapture?:(id:number)=>void})?.releasePointerCapture?.(e.pointerId)}catch{/* no capture */}},
    onPointerCancel:()=>{drag.current=null;onDragState(false)}
  });
  return <group position={midpoint} rotation={[0,theta,0]}>
    <mesh renderOrder={5} onClick={e=>{e.stopPropagation();onSelect()}}>
      <planeGeometry args={[opening.width,opening.height]}/>
      <meshBasicMaterial color={active?'#41d6ee':'#f9b766'} transparent opacity={active?.26:.16} side={THREE.DoubleSide} depthTest={false}/>
    </mesh>
    <lineSegments geometry={edgeLines} renderOrder={6}>
      <lineBasicMaterial color={active?'#6be6ff':'#e9b673'} depthTest={false}/>
    </lineSegments>
    {active&&<>
      <mesh position={[opening.width/2,0,2]} renderOrder={8} {...handler('width')}><sphereGeometry args={[Math.max(4,Math.min(10,opening.width/12)),10,8]}/><meshBasicMaterial color="#54dcf1" depthTest={false}/></mesh>
      <mesh position={[0,opening.height/2,2]} renderOrder={8} {...handler('height')}><sphereGeometry args={[6,10,8]}/><meshBasicMaterial color="#91e5a3" depthTest={false}/></mesh>
      <mesh position={[0,0,3]} renderOrder={8} {...handler('t')}><sphereGeometry args={[5,10,8]}/><meshBasicMaterial color="#ffcf78" depthTest={false}/></mesh>
      <mesh position={[-opening.width/2-14,-opening.height/2,3]} renderOrder={9} {...handler('sill')}><sphereGeometry args={[7,12,10]}/><meshBasicMaterial color="#c99aff" depthTest={false}/></mesh>
    </>}
  </group>;
}
/** The camera watcher quantizes azimuth into sectors, avoiding a React update per frame. */
function CameraSectorWatcher({center,onSector}:{center:THREE.Vector3;onSector:(sector:number)=>void}){
  const {camera}=useThree();const last=useRef(-1);
  useFrame(()=>{const a=Math.atan2(-(camera.position.z-center.z),camera.position.x-center.x);
    const sector=(Math.round(a/(Math.PI/8))+16)%16;
    if(sector!==last.current){last.current=sector;onSector(sector);}
  });return null;
}
function StairEditor3D({plan,stair,active,onSelect,onChange,onDragState}:{plan:BlueprintPlan;stair:BlueprintStair;active:boolean;onSelect:()=>void;onChange:(patch:Partial<BlueprintStair>,snapshot:boolean)=>void;onDragState:(drag:boolean)=>void}){
  const rect=blueprintStairRectangle(plan,stair),levels=blueprintLevels(plan),level=levels.find(l=>l.id===stair.fromLevelId)!;
  const source=rect[0],target=rect[1],side=rect[3];
  const dir=new THREE.Vector3((target[0]-source[0])/stair.length,0,-(target[1]-source[1])/stair.length);
  const lateral=new THREE.Vector3((side[0]-source[0])/stair.width,0,-(side[1]-source[1])/stair.width);
  const baseY=plan.baseZ+level.offsetZ+8;
  const centre=new THREE.Vector3((rect[0][0]+rect[2][0])/2,baseY,-(rect[0][1]+rect[2][1])/2);
  const verts=rect.map(p=>new THREE.Vector3(p[0],baseY,-p[1]));
  const lines=useMemo(()=>{const pts:number[]=[];for(let i=0;i<4;i++){pts.push(...verts[i].toArray(),...verts[(i+1)%4].toArray());}return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3))},[stair.start[0],stair.start[1],stair.length,stair.width,stair.direction,baseY]);
  useEffect(()=>()=>lines.dispose(),[lines]);
  const drag=useRef<{mode:'width'|'length'|'start';point:THREE.Vector3;value:number;origin:PlanPoint;first:boolean}|null>(null);
  const pointer=(e:ThreeEvent<PointerEvent>)=>e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-baseY),new THREE.Vector3());
  const handle=(mode:'width'|'length'|'start')=>({onPointerDown:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();onSelect();const p=pointer(e);if(!p)return;drag.current={mode,point:p,value:stair[mode==='start'?'length':mode],origin:[...stair.start],first:true};onDragState(true);try{(e.target as EventTarget & {setPointerCapture?:(id:number)=>void})?.setPointerCapture?.(e.pointerId)}catch{}},onPointerMove:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();const d=drag.current;if(!d)return;const p=pointer(e);if(!p)return;const delta=p.clone().sub(d.point);if(mode==='width')onChange({width:Math.round(Math.max(40,d.value+2*delta.dot(lateral))/4)*4},d.first);
    if(mode==='length')onChange({length:Math.round(Math.max(128,d.value+delta.dot(dir))/4)*4},d.first);
    if(mode==='start'){const w=blueprintPixelToWorld(plan,d.origin);const pos:PlanPoint=[w[0]+delta.x,w[1]-delta.z];onChange({start:blueprintWorldToPixel(plan,pos)},d.first)}d.first=false;},onPointerUp:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();drag.current=null;onDragState(false);try{(e.target as EventTarget & {releasePointerCapture?:(id:number)=>void})?.releasePointerCapture?.(e.pointerId)}catch{}},onPointerCancel:()=>{drag.current=null;onDragState(false)}});
  return <group>
    <lineSegments geometry={lines} renderOrder={7} onClick={e=>{e.stopPropagation();onSelect()}}><lineBasicMaterial color={active?'#dfadff':'#9a8ece'} depthTest={false}/></lineSegments>
    <mesh position={centre.toArray()} rotation={[0,stair.direction*Math.PI/180,0]} onClick={e=>{e.stopPropagation();onSelect()}} renderOrder={6}><boxGeometry args={[Math.max(6,stair.length),4,Math.max(6,stair.width)]}/><meshBasicMaterial color="#bc82ed" transparent opacity={.045} depthWrite={false}/></mesh>
    {active&&<>
      <mesh position={[(rect[1][0]+rect[2][0])/2,baseY+5,-(rect[1][1]+rect[2][1])/2]} {...handle('length')}><sphereGeometry args={[8,10,8]}/><meshBasicMaterial color="#55ddee" depthTest={false}/></mesh>
      <mesh position={[(rect[2][0]+rect[3][0])/2,baseY+5,-(rect[2][1]+rect[3][1])/2]} {...handle('width')}><sphereGeometry args={[8,10,8]}/><meshBasicMaterial color="#91e5a3" depthTest={false}/></mesh>
      <mesh position={[rect[0][0],baseY+6,-rect[0][1]]} {...handle('start')}><sphereGeometry args={[8,10,8]}/><meshBasicMaterial color="#e9c578" depthTest={false}/></mesh>
    </>}
  </group>;
}
function Preview({brushes,plan,selectedOpening,selectedStair,onSelect,onChange,onSelectStair,onChangeStair,hideCeilings,wallVis,activeLevelId,allFloors,hint}:{brushes:Brush[];plan:BlueprintPlan;
  selectedOpening:string|null;selectedStair:string|null;hint:string;onSelect:(stroke:string,opening:string)=>void;
  onChange:(stroke:string,opening:string,patch:OpeningChange,first:boolean)=>void;onSelectStair:(id:string)=>void;
  onChangeStair:(id:string,patch:Partial<BlueprintStair>,first:boolean)=>void;
  hideCeilings:boolean;wallVis:'normal'|'fade'|'hide';activeLevelId:string;allFloors:boolean}){
  const [sector,setSector]=useState(2),[dragging,setDragging]=useState(false);
  const scoped=useMemo(()=>brushes.filter(b=>(!hideCeilings||(!b.name.includes(' Ceiling ')&&!b.name.includes(' Roof ')))&&(allFloors||!b.name.startsWith('@')||b.name.startsWith(`@${activeLevelId} `)||b.name.includes('· Step '))),[brushes,hideCeilings,activeLevelId,allFloors]);
  const allGeometry=useMemo(()=>makePreviewGeometry(scoped),[scoped]);
  useEffect(()=>()=>allGeometry.dispose(),[allGeometry]);
  const bounds=useMemo(()=>scoped.length?new THREE.Box3().setFromBufferAttribute(allGeometry.getAttribute('position') as THREE.BufferAttribute):new THREE.Box3(new THREE.Vector3(-128,-32,-128),new THREE.Vector3(128,192,128)),[allGeometry,scoped]);
  const center=useMemo(()=>bounds.getCenter(new THREE.Vector3()),[bounds]);
  const max=Math.max(...bounds.getSize(new THREE.Vector3()).toArray(),128);
  const az=sector*Math.PI/8,cx=Math.cos(az),cy=Math.sin(az);
  const normal:Brush[]=[],ghost:Brush[]=[];
  for(const brush of scoped){
    const dx=brush.position[0]-center.x,dy=brush.position[1]+center.z;
    const isFront=brush.name.includes('· Exterior')&&dx*cx+dy*cy>Math.max(6,max*.025);
    if(wallVis!=='normal'&&isFront){if(wallVis==='fade')ghost.push(brush)}else normal.push(brush);
  }
  const normalGeometry=useMemo(()=>makePreviewGeometry(normal),[scoped,sector,wallVis]);
  const ghostGeometry=useMemo(()=>makePreviewGeometry(ghost),[scoped,sector,wallVis]);
  useEffect(()=>()=>{normalGeometry.dispose();ghostGeometry.dispose()},[normalGeometry,ghostGeometry]);
  const currentStairs=(plan.stairs||[]).filter(st=>allFloors||st.fromLevelId===activeLevelId||st.toLevelId===activeLevelId);
  const editorStrokes=plan.strokes.filter(st=>allFloors||blueprintStrokeLevel(st)===activeLevelId);
  return <div className="bp-3d"><Canvas camera={{position:[center.x+max*.9,center.y+max*.8,center.z+max*.9],fov:48,near:1,far:100000}} gl={{antialias:true}}>
    <ambientLight intensity={1.5}/><directionalLight position={[200,400,100]} intensity={2}/>
    <CameraSectorWatcher center={center} onSector={setSector}/>
    {normal.length>0&&<mesh geometry={normalGeometry}><meshStandardMaterial color="#81b9d0" side={THREE.DoubleSide} roughness={.82}/></mesh>}
    {ghost.length>0&&<mesh geometry={ghostGeometry}><meshStandardMaterial color="#81b9d0" side={THREE.DoubleSide} transparent opacity={.12} depthWrite={false} roughness={.82}/></mesh>}
    <gridHelper args={[Math.min(max*2,8192),32,0x417c90,0x344857]} position={[center.x,Math.min(center.y-24,0),center.z]}/>
    {editorStrokes.flatMap(stroke=>stroke.openings.map(opening=><OpeningEditor3D key={opening.id} plan={plan} stroke={stroke} opening={opening} active={selectedOpening===opening.id}
      onSelect={()=>onSelect(stroke.id,opening.id)} onChange={(patch,first)=>onChange(stroke.id,opening.id,patch,first)} onDragState={setDragging}/>))}
    {currentStairs.map(stair=><StairEditor3D key={stair.id} plan={plan} stair={stair} active={selectedStair===stair.id}
      onSelect={()=>onSelectStair(stair.id)} onChange={(patch,first)=>onChangeStair(stair.id,patch,first)} onDragState={setDragging}/>)}
    <OrbitControls target={[center.x,center.y,center.z]} enabled={!dragging} enableDamping dampingFactor={.08} minDistance={12} maxDistance={100000}/>
  </Canvas><div className="bp-3d-tip">{hint}</div></div>;
}
const getPoint=(svg:SVGSVGElement,e:{clientX:number;clientY:number}):PlanPoint=>{
  const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
  const matrix=svg.getScreenCTM();if(!matrix)return [0,0];
  const p=point.matrixTransform(matrix.inverse());return [p.x,p.y];
};
const nearestEdge=(plan:BlueprintPlan,p:PlanPoint)=>{
  let best:{stroke:string;edge:number;t:number;distance:number}|null=null;
  for(const stroke of plan.strokes){
    const edges=stroke.kind==='room'?stroke.points.length:stroke.points.length-1;
    for(let i=0;i<edges;i++){
      const a=stroke.points[i],b=stroke.points[(i+1)%stroke.points.length];
      const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
      const d=Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);
      if(!best||d<best.distance)best={stroke:stroke.id,edge:i,t,distance:d};
    }
  }
  return best;
};
export function BlueprintToMapStudio({onClose}:{onClose:()=>void}){
  const locale=useEditor(s=>s.locale);
  const L=STRINGS[locale]||STRINGS.en;
  const F=LEVEL_TEXT[locale]||LEVEL_TEXT.en;
  const T=HF2_TEXT[locale]||HF2_TEXT.en;
  const S=HF3_TEXT[locale]||HF3_TEXT.en;
  const H=HF4_TEXT[locale]||HF4_TEXT.en;
  const savedPlans=useEditor(s=>s.project.blueprintPlans);
  const saveBlueprint=useEditor(s=>s.saveBlueprint);
  const saveBlueprintDraft=useEditor(s=>s.saveBlueprintDraft);
  const setBlueprintPlacement=useEditor(s=>s.setBlueprintPlacement);
  const removeBlueprint=useEditor(s=>s.removeBlueprint);
  const currentTexture=useEditor(s=>s.currentTexture);
  const [draft,setDraft]=useState<BlueprintPlan>(()=>clone(savedPlans?.at(-1)||({...initialBlueprint(),texture:currentTexture||'SV_BRICK01'})));
  const [dirty,setDirty]=useState(false),[tool,setTool]=useState<Tool>('select');
  const [activeLevelId,setActiveLevelId]=useState<string>(BLUEPRINT_GROUND_ID);
  const [selectedStair,setSelectedStair]=useState<string|null>(null),[allFloors,setAllFloors]=useState(true),[wallVis,setWallVis]=useState<'normal'|'fade'|'hide'>('hide');
  const [cursorPoints,setCursorPoints]=useState<PlanPoint[]>([]);
  const [calibrationPoints,setCalibrationPoints]=useState<PlanPoint[]>([]);
  const [calibrationUnits,setCalibrationUnits]=useState(128);
  const [selected,setSelected]=useState<string|null>(null);
  const [view,setView]=useState<View>({x:0,y:0,w:1024,h:768});
  const [showImage,setShowImage]=useState(true),[opacity,setOpacity]=useState(.63),[snap,setSnap]=useState(8);
  const [viewMode,setViewMode]=useState<'2d'|'3d'|'split'>('2d'),[hideCeilings,setHideCeilings]=useState(true),[selectedOpening,setSelectedOpening]=useState<string|null>(null),[notice,setNotice]=useState('');
  const [working,setWorking]=useState(false);
  const [inspectorTab,setInspectorTab]=useState<'rooms'|'properties'|'connections'>('rooms');
  const [repairProposal,setRepairProposal]=useState<BlueprintPlan|null>(null);
  const [hoverOpening,setHoverOpening]=useState<{stroke:string;edge:number;t:number;point:PlanPoint}|null>(null);
  const openingDrag=useRef<{stroke:string;id:string;edge:number;backup:BlueprintStroke[]}|null>(null);
  const svgRef=useRef<SVGSVGElement|null>(null);
  const panning=useRef<{x:number;y:number;view:View}|null>(null);
  const dragging=useRef<{stroke:string;index:number}|null>(null);
  const histories=useRef<BlueprintPlan[]>([]),futures=useRef<BlueprintPlan[]>([]);
  const saved=(savedPlans||[]).find(p=>p.id===draft.id);
  const levels=blueprintLevels(draft);
  const activeLevel=levels.find(level=>level.id===activeLevelId)||levels[0];
  const visibleStrokes=draft.strokes.filter(st=>blueprintStrokeLevel(st)===activeLevel.id);
  const floorDraft={...draft,strokes:visibleStrokes};
  const activeStairs=(draft.stairs||[]).filter(st=>st.fromLevelId===activeLevel.id);
  const activeStair=(draft.stairs||[]).find(st=>st.id===selectedStair);
  const selectedStairActive=!!activeStair&&(activeStair.fromLevelId===activeLevel.id||activeStair.toLevelId===activeLevel.id);
  const pointWorld=(p:PlanPoint)=>blueprintPixelToWorld(draft,p);
  const snapPoint=(p:PlanPoint,exclude?:string):PlanPoint=>snapBlueprintPoint(floorDraft,p,snap,exclude);
  // Never execute user validation inside a React state updater. Exceptions raised
  // by a React updater happen later during render and bypass the UI error handler.
  const update=(updater:(old:BlueprintPlan)=>BlueprintPlan)=>{const next=updater(draft);setDraft(next);setDirty(true);setRepairProposal(null);setNotice('')};
  const updateStrokes=(mutator:(strokes:BlueprintStroke[])=>BlueprintStroke[],snapshot=true)=>{
    if(snapshot){histories.current.push(clone(draft));if(histories.current.length>40)histories.current.shift();futures.current=[];}
    update(old=>({...old,strokes:mutator(clone(old.strokes))}));
  };
  const goBack=()=>{const prev=histories.current.pop();if(!prev)return;futures.current.push(clone(draft));update(()=>prev);};
  const goForward=()=>{const next=futures.current.pop();if(!next)return;histories.current.push(clone(draft));update(()=>next);};
  const resetView=(p=draft)=>setView({x:0,y:0,w:p.imageWidth,h:p.imageHeight});
  const persistDraft=()=>{
    try{
      saveBlueprintDraft(draft);setDirty(false);setNotice(locale==='es'?'Plano guardado. Podés reabrirlo y seguir editándolo.':'Blueprint saved. You can reopen it to continue editing.');
      return true;
    }catch(error){setNotice(String(error));return false;}
  };
  const switchPlan=(plan:BlueprintPlan)=>{
    if(dirty&&!persistDraft())return;
    setDraft(clone(plan));setActiveLevelId(BLUEPRINT_GROUND_ID);setSelectedStair(null);setDirty(false);setSelected(null);setCursorPoints([]);setCalibrationPoints([]);setTool('select');setViewMode('2d');setSelectedOpening(null);setInspectorTab('rooms');setRepairProposal(null);resetView(plan);histories.current=[];futures.current=[];setNotice('');
  };
  const onImport=async(file:File|undefined)=>{
    if(!file)return;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Only PNG, JPG and WEBP references are supported.');
      if(file.size>1_500_000)throw Error(L[41]);
      if(draft.strokes.length&&!window.confirm(L[45]))return;
      setWorking(true);
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
        const src=URL.createObjectURL(file),img=new Image();
        img.onload=()=>{URL.revokeObjectURL(src);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(src);reject(Error('Cannot decode image.'))};img.src=src;
      });
      if(image.naturalWidth<64||image.naturalHeight<64||image.naturalWidth>8192||image.naturalHeight>8192)throw Error('Image dimensions must be between 64 and 8192 px.');
      const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Cannot read image.'));r.readAsDataURL(file)});
      const next={...draft,imageDataUrl:data,imageWidth:image.naturalWidth,imageHeight:image.naturalHeight,strokes:[],calibration:undefined,unitsPerPixel:1};
      update(()=>next);resetView(next);setSelected(null);setCursorPoints([]);histories.current=[];futures.current=[];
      setNotice(`${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`);
    }catch(error){setNotice(String(error))}finally{setWorking(false)}
  };
  const finishOutline=()=>{
    try{
      const kind=tool==='room'||tool==='rectangle'?'room':'wall';
      const pts=cursorPoints;
      if(pts.length<(kind==='room'?3:2))throw Error('Add more corners to finish the outline.');
      const next:BlueprintStroke={id:uid(),kind,points:pts,name:`${kind==='room'?'Room':'Wall'} ${draft.strokes.length+1}`,levelId:activeLevel.id,openings:[],floor:kind==='room',ceiling:false};
      validateBlueprintPlan({...draft,strokes:[...draft.strokes,next]});
      updateStrokes(old=>[...old,next]);setSelected(next.id);setCursorPoints([]);setTool('select');
    }catch(error){setNotice(String(error))}
  };
  const makeClick=(raw:PlanPoint)=>{
    const p=snapPoint(raw);
    if(tool==='calibrate'){
      if(calibrationPoints.length===0){setCalibrationPoints([raw]);return}
      try{const next=calibrateBlueprint(draft,calibrationPoints[0],raw,calibrationUnits);
        validateBlueprintPlan(next);update(()=>next);setCalibrationPoints([]);setTool('select');
      }catch(error){setCalibrationPoints([]);setNotice((locale==='es'?'Calibración no aplicada: ':'Calibration not applied: ')+String(error instanceof Error?error.message:error));}
      return;
    }
    if(tool==='wall'||tool==='room'){
      if(tool==='room'&&cursorPoints.length>=3&&Math.hypot(cursorPoints[0][0]-p[0],cursorPoints[0][1]-p[1])<Math.max(10,view.w/60)){finishOutline();return}
      if(cursorPoints.length&&Math.hypot(cursorPoints.at(-1)![0]-p[0],cursorPoints.at(-1)![1]-p[1])<1)return;
      setCursorPoints(old=>[...old,p]);return;
    }
    if(tool==='rectangle'){
      if(!cursorPoints.length){setCursorPoints([p]);return}
      const a=cursorPoints[0],rect:BlueprintStroke={id:uid(),kind:'room',name:`Room ${draft.strokes.length+1}`,levelId:activeLevel.id,points:[a,[p[0],a[1]],p,[a[0],p[1]]],floor:true,ceiling:false,openings:[]};
      try{validateBlueprintPlan({...draft,strokes:[...draft.strokes,rect]});updateStrokes(old=>[...old,rect]);setSelected(rect.id);setTool('select')}catch(error){setNotice(String(error))}
      setCursorPoints([]);return;
    }
    if(tool==='stair'){
      const index=levels.findIndex(l=>l.id===activeLevel.id);if(index<0||index>=levels.length-1){setNotice(F.stairHelp);return;}
      const next=levels[index+1],rise=next.offsetZ-activeLevel.offsetZ;
      const steps=Math.max(8,Math.ceil(rise/16));
      const stair:BlueprintStair={id:uid(),name:`${F.stairs} ${(draft.stairs||[]).length+1}`,fromLevelId:activeLevel.id,toLevelId:next.id,start:snapPoint(raw),direction:0,width:80,length:Math.max(256,steps*20),steps};
      histories.current.push(clone(draft));futures.current=[];
      update(p=>({...p,stairs:[...(p.stairs||[]),stair]}));setSelectedStair(stair.id);setSelected(null);setInspectorTab('properties');setTool('select');return;
    }
    if(tool==='door'||tool==='window'){
      const hit=nearestEdge(floorDraft,raw);
      if(!hit||hit.distance>Math.max(24,view.w/45)){setNotice('Click closer to a wall segment.');return}
      const parent=draft.strokes.find(stroke=>stroke.id===hit.stroke)!;
      const a=pointWorld(parent.points[hit.edge]),b=pointWorld(parent.points[(hit.edge+1)%parent.points.length]);
      const length=Math.hypot(a[0]-b[0],a[1]-b[1]);
      const margin=draft.wallThickness+4;
      const ideal=tool==='door'?80:96;
      const maxWidth=Math.min(ideal,Math.floor((length-2*margin-8)/8)*8);
      if(maxWidth<24){setNotice('This wall is too short for a door/window; lengthen it or reduce its thickness.');return}
      const safeT=Math.max((margin+maxWidth/2)/length,Math.min(1-(margin+maxWidth/2)/length,hit.t));
      const sill=tool==='door'?0:Math.min(80,Math.max(0,draft.wallHeight-48));
      const opening:Omit<BlueprintOpening,'id'|'edge'>={t:safeT,kind:tool,width:maxWidth,height:tool==='door'?Math.min(128,draft.wallHeight-8):Math.min(80,draft.wallHeight-sill-8),sill};
      try{const next=addBlueprintOpening(draft,hit.stroke,hit.edge,opening);
        updateStrokes(()=>next.strokes);setSelected(hit.stroke);setInspectorTab('properties');setTool('select');setHoverOpening(null);
      }catch(error){setNotice(String(error instanceof Error?error.message:error))}
      return;
    }
    const hit=nearestEdge(floorDraft,raw);const chosen=hit&&hit.distance<Math.max(24,view.w/45)?hit.stroke:null;setSelected(chosen);setSelectedOpening(null);if(chosen)setInspectorTab('properties');
  };
  const onDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
    if(e.button===1||e.shiftKey){e.preventDefault();panning.current={x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId);return}
    if(e.button!==0)return;
    makeClick(getPoint(e.currentTarget,e));
  };
  const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
    if(openingDrag.current){
      const drag=openingDrag.current,raw=getPoint(e.currentTarget,e);
      const stroke=draft.strokes.find(st=>st.id===drag.stroke);
      if(!stroke)return;
      const a=stroke.points[drag.edge],b=stroke.points[(drag.edge+1)%stroke.points.length];
      const dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(.001,Math.min(.999,((raw[0]-a[0])*dx+(raw[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
      editOpening(drag.stroke,drag.id,{t},false);return;
    }
    if(tool==='door'||tool==='window'){
      const raw=getPoint(e.currentTarget,e),hit=nearestEdge(floorDraft,raw);
      if(hit&&hit.distance<=Math.max(24,view.w/45)){
        const st=draft.strokes.find(s=>s.id===hit.stroke)!;
        const a=st.points[hit.edge],b=st.points[(hit.edge+1)%st.points.length];
        setHoverOpening({stroke:hit.stroke,edge:hit.edge,t:hit.t,point:[a[0]+(b[0]-a[0])*hit.t,a[1]+(b[1]-a[1])*hit.t]});
      }else setHoverOpening(null);
    }
    if(panning.current){const rect=e.currentTarget.getBoundingClientRect(),pan=panning.current;
      setView({...pan.view,x:pan.view.x-(e.clientX-pan.x)*pan.view.w/rect.width,y:pan.view.y-(e.clientY-pan.y)*pan.view.h/rect.height});return;
    }
    if(dragging.current){const {stroke,index}=dragging.current;const point=snapPoint(getPoint(e.currentTarget,e),stroke);
      setDraft(old=>({...old,strokes:old.strokes.map(s=>s.id===stroke?{...s,points:s.points.map((p,i)=>i===index?point:p)}:s)}));setDirty(true);
    }
  };
  const onWheel=(e:ReactWheelEvent<SVGSVGElement>)=>{
    e.preventDefault();const pos=getPoint(e.currentTarget,e),scale=e.deltaY>0?1.15:1/1.15;
    setView(old=>{const ratio=Math.max(.05,Math.min(8,old.w*scale/draft.imageWidth)),w=draft.imageWidth*ratio,h=draft.imageHeight*ratio;
      const cx=(pos[0]-old.x)/old.w,cy=(pos[1]-old.y)/old.h;return {x:pos[0]-cx*w,y:pos[1]-cy*h,w,h}});
  };
  const finishOpeningDrag=()=>{openingDrag.current=null};
  const connections=useMemo(()=>{try{return blueprintWallConnections(floorDraft)}catch{return null}},[draft,activeLevelId]);
  const previewData=useMemo(()=>{try{const brushes=buildBlueprintBrushes(draft);return {brushes,error:''}}catch(error){
    let fallback:Brush[]=[];try{fallback=buildBlueprintBrushes({...draft,strokes:draft.strokes.map(st=>({...st,openings:[]}))})}catch{/* broken outline */}
    return {brushes:fallback,error:String(error instanceof Error?error.message:error)};
  }},[draft]);
  const save=()=>{
    try{
      saveBlueprint(draft);
      setDraft(old=>({...old,memberIds:useEditor.getState().project.blueprintPlans?.find(p=>p.id===old.id)?.memberIds||[],signatures:useEditor.getState().project.blueprintPlans?.find(p=>p.id===old.id)?.signatures||[]}));
      setDirty(false);setNotice(`Generated ${previewData.brushes.length} valid brushes. One Undo step.`);
    }catch(error){setNotice(String(error))}
  };
  const editOpening=(strokeId:string,openingId:string,patch:OpeningChange,snapshot=true)=>{
    try{
      const next=fitBlueprintOpening(draft,strokeId,openingId,patch);
      if(snapshot){histories.current.push(clone(draft));if(histories.current.length>40)histories.current.shift();futures.current=[];}
      update(()=>next);setSelected(strokeId);setSelectedOpening(openingId);
    }catch(error){setNotice(String(error instanceof Error?error.message:error));}
  };
  const fixOpenings=()=>{
    try{
      const next=repairBlueprintOpenings(draft);
      histories.current.push(clone(draft));futures.current=[];update(()=>next);
      setNotice(locale==='es'?'Aberturas ajustadas sin eliminar ninguna.':'Openings adjusted without deleting any.');
    }catch(error){setNotice(String(error instanceof Error?error.message:error));}
  };
  const previewWallRepair=()=>{
    try{
      const repaired=repairBlueprintWallConnections(floorDraft);
      const next={...draft,strokes:draft.strokes.map(st=>repaired.strokes.find(s=>s.id===st.id)||st)};
      const changed=next.strokes.some((s,i)=>JSON.stringify(s.points)!==JSON.stringify(draft.strokes[i].points));
      if(!changed){
        if(draft.smartWalls!==true)update(p=>({...p,smartWalls:true}));
        else setNotice(S.noChange);
        return;
      }
      setRepairProposal(next);setNotice(S.preview);
    }catch(error){setRepairProposal(null);setNotice(`${S.invalid} ${String(error instanceof Error?error.message:error)}`)}
  };
  const applyWallRepair=()=>{
    if(!repairProposal)return;
    histories.current.push(clone(draft));if(histories.current.length>40)histories.current.shift();futures.current=[];
    update(()=>repairProposal);setRepairProposal(null);setNotice(S.aligned);
  };
  const duplicatePlan=()=>{
    try{
      if(dirty&&!persistDraft())return;
      const next=importBlueprintAsset(exportBlueprintAsset(draft));next.name=draft.name+' copy';
      saveBlueprintDraft(next);switchPlan(next);
      setNotice(locale==='es'?'Copia independiente creada; sus brushes todavía no se generaron.':'Independent copy created; its brushes have not been generated.');
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const exportPlan=()=>{
    try{
      const asset=exportBlueprintAsset(draft);
      const blob=new Blob([JSON.stringify(asset,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=(draft.name.trim().replace(/[^a-z0-9_-]+/gi,'_').slice(0,55)||'blueprint')+'.svenblueprint.json';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
      setNotice(locale==='es'?'Copia editable exportada.':'Editable blueprint exported.');
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const importPlan=async(file?:File)=>{
    if(!file)return;
    try{
      if(file.size>4_000_000)throw Error('Blueprint document is larger than 4 MB.');
      if(dirty&&!persistDraft())return;
      const plan=importBlueprintAsset(JSON.parse(await file.text()));
      saveBlueprintDraft(plan);switchPlan(plan);
      setNotice(locale==='es'?'Plano editable importado.':'Editable blueprint imported.');
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const remove=(detach=false)=>{
    try{
      if(!saved)return;
      if(!window.confirm(detach?'Keep generated brushes and remove editing metadata?':'Delete this blueprint and its generated brushes?'))return;
      removeBlueprint(saved.id,detach);const fresh={...initialBlueprint(),texture:currentTexture||'SV_BRICK01'};setDraft(fresh);resetView(fresh);setDirty(false);setSelected(null);setCursorPoints([]);setCalibrationPoints([]);histories.current=[];futures.current=[];setViewMode('2d');setSelectedOpening(null);
    }catch(error){setNotice(String(error))}
  };
  const updateSelected=(fn:(stroke:BlueprintStroke)=>void)=>updateStrokes(strokes=>{const stroke=strokes.find(s=>s.id===selected);if(stroke)fn(stroke);return strokes});
  const addFloor=()=>{
    const existingRoofs=draft.strokes.some(st=>st.roof&&blueprintStrokeLevel(st)===levels.at(-1)?.id);
    if(existingRoofs&&!window.confirm(locale==='es'?'La planta superior tiene un techo inclinado. ¿Quitar ese techo para construir otra planta?':'The top floor has a pitched roof. Remove it before adding another floor?'))return;
    if(levels.length>=6){setNotice('Maximum 6 floors per blueprint.');return;}
    const last=levels.at(-1)!,next:BlueprintLevel={id:uid(),name:`${F.floor} ${levels.length+1}`,offsetZ:last.offsetZ+draft.wallHeight+draft.slabThickness};
    histories.current.push(clone(draft));futures.current=[];
    update(p=>({...p,levels:[...levels,next],strokes:p.strokes.map(st=>st.roof?{...st,roof:undefined}:st)}));setActiveLevelId(next.id);setSelected(null);setSelectedStair(null);setInspectorTab('rooms');
  };
  const removeFloor=()=>{
    if(activeLevel.id===BLUEPRINT_GROUND_ID)return;
    if(!window.confirm(locale==='es'?'¿Eliminar esta planta, sus habitaciones y las escaleras conectadas?':'Delete this floor, its rooms and connected stairs?'))return;
    histories.current.push(clone(draft));futures.current=[];
    update(p=>({...p,levels:blueprintLevels(p).filter(l=>l.id!==activeLevel.id),strokes:p.strokes.filter(s=>blueprintStrokeLevel(s)!==activeLevel.id),stairs:(p.stairs||[]).filter(s=>s.fromLevelId!==activeLevel.id&&s.toLevelId!==activeLevel.id)}));
    setActiveLevelId(BLUEPRINT_GROUND_ID);setSelected(null);setSelectedStair(null);setInspectorTab('rooms');
  };
  const editStair=(id:string,patch:Partial<BlueprintStair>,snapshot=true)=>{
    if(snapshot){histories.current.push(clone(draft));if(histories.current.length>40)histories.current.shift();futures.current=[];}
    update(p=>({...p,stairs:(p.stairs||[]).map(s=>s.id===id?{...s,...patch}:s)}));setSelectedStair(id);setSelected(null);
  };
  const selectedStroke=visibleStrokes.find(s=>s.id===selected);
  const width=draft.imageWidth,height=draft.imageHeight;
  useEffect(()=>{
    const keyboard=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]'))return;
      if(e.key==='Escape'&&cursorPoints.length){e.preventDefault();setCursorPoints([]);return}
      if(e.key==='Enter'&&(tool==='room'||tool==='wall')&&cursorPoints.length){e.preventDefault();finishOutline();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)goForward();else goBack()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();goForward()}
      if(e.key==='Backspace'&&cursorPoints.length){e.preventDefault();setCursorPoints(a=>a.slice(0,-1))}
    };
    window.addEventListener('keydown',keyboard,true);return()=>window.removeEventListener('keydown',keyboard,true);
  });
  const close=()=>{if(dirty&&!persistDraft()&&!window.confirm(locale==='es'?'No se pudo guardar este borrador. ¿Cerrar igualmente?':'Could not save this draft. Close anyway?'))return;onClose()};
  const placeInMap=()=>{
    try{
      if(!draft.strokes.length)throw Error('Draw at least one room or wall first.');
      validateBlueprintPlan(draft);buildBlueprintBrushes(draft);
      saveBlueprintDraft(draft);setDirty(false);setBlueprintPlacement(draft.id);onClose();
    }catch(error){setNotice(String(error instanceof Error?error.message:error));}
  };
  const applyNum=(key:'baseZ'|'wallHeight'|'wallThickness'|'slabThickness'|'unitsPerPixel',v:number)=>update(p=>({...p,[key]:safeNumber(v)}));
  const numeric=(key:'baseZ'|'wallHeight'|'wallThickness'|'slabThickness'|'unitsPerPixel',label:string,min:number,max:number)=>
    <label>{label}<input type="number" min={min} max={max} step={key==='unitsPerPixel'?.01:1} value={draft[key]} onChange={e=>applyNum(key,Number(e.target.value))}/></label>;
  const tools:{key:Tool;label:string;icon:typeof MousePointer2}[]=[
    {key:'select',label:L[11],icon:MousePointer2},{key:'calibrate',label:L[5],icon:Ruler},{key:'wall',label:L[6],icon:Route},
    {key:'room',label:L[7],icon:PanelsTopLeft},{key:'rectangle',label:L[8],icon:Square},{key:'door',label:L[9],icon:DoorOpen},{key:'window',label:L[10],icon:ScanEye},{key:'stair',label:F.stairs,icon:Footprints}
  ];
  return <div className="bp-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section role="dialog" aria-modal="true" aria-label="Blueprint to Map" className="bp-shell" onMouseDown={e=>e.stopPropagation()}>
    <header className="bp-head"><div className="bp-brand"><FileImage size={24}/><div><strong>{L[0]}</strong><small>{L[1]} · v1.8.14 Preview</small></div></div><button onClick={close} title={T.close}><X size={20}/></button></header>
    <div className="bp-body"><aside className="bp-sidebar">
      <div className="bp-label">{L[2]} ({savedPlans?.length||0})</div>
      <div className="bp-docs">{(savedPlans||[]).map(plan=><button key={plan.id} className={plan.id===draft.id?'active':''} onClick={()=>switchPlan(plan)}><FileImage size={15}/><span>{plan.name}<small>{plan.strokes.length} outlines · {plan.memberIds.length?T.saved:T.draft}</small></span></button>)}</div>
      <button className="bp-secondary bp-full" onClick={()=>switchPlan({...initialBlueprint(),texture:currentTexture||'SV_BRICK01'})}><Plus size={15}/>{L[3]}</button>
      <label className="bp-file bp-file-asset"><Upload size={15}/>{T.open}<input type="file" accept=".json,.svenblueprint.json,application/json" onChange={e=>{void importPlan(e.target.files?.[0]);e.currentTarget.value=''}}/></label>
      <button className="bp-secondary bp-full" onClick={duplicatePlan}><Copy size={15}/>{T.duplicate}</button>
      <button className="bp-secondary bp-full" onClick={exportPlan}><Download size={15}/>{T.export}</button>
      <label className="bp-file"><ImagePlus size={17}/>{working?'Loading...':L[4]}<input disabled={working} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void onImport(e.target.files?.[0]);e.currentTarget.value=''}}/></label>
      <label className="bp-check"><input type="checkbox" checked={showImage} onChange={e=>setShowImage(e.target.checked)}/>{L[16]}</label>
      <label>{L[20]}<input type="range" min="0" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
      <p className="bp-micro">{T.standalone}</p>
      <div className="bp-label">Calibration / Grid</div>
      <label>{L[19]}<input type="number" min="8" max="32768" value={calibrationUnits} onChange={e=>setCalibrationUnits(Number(e.target.value))}/></label>
      <div className="bp-micro">{draft.unitsPerPixel.toFixed(4)} u/px · {Math.round(draft.imageWidth*draft.unitsPerPixel)} × {Math.round(draft.imageHeight*draft.unitsPerPixel)} units</div>
      <p className="bp-micro">{locale==='es'?'Posición manual: también podés usar «Colocar en mapa» para elegir con un clic.':'Manual coordinates: or use Place in map to choose a point.'}</p><div className="bp-coordinate"><label>World origin X<input type="number" min="-32768" max="32768" value={draft.origin[0]} onChange={e=>update(p=>({...p,origin:[safeNumber(Number(e.target.value)),p.origin[1]]}))}/></label><label>World origin Y<input type="number" min="-32768" max="32768" value={draft.origin[1]} onChange={e=>update(p=>({...p,origin:[p.origin[0],safeNumber(Number(e.target.value))]}))}/></label></div>
      <label>{L[21]}<select value={snap} onChange={e=>setSnap(Number(e.target.value))}>{[1,2,4,8,16,32,64].map(n=><option value={n} key={n}>{n}</option>)}</select></label>
      <div className="bp-label">Geometry</div>
      {numeric('wallHeight',L[22],64,2048)}{numeric('wallThickness',L[23],4,128)}{numeric('slabThickness',L[24],4,64)}{numeric('baseZ',L[25],-16384,16384)}
      <label>{L[26]}<input maxLength={32} value={draft.texture} onChange={e=>update(p=>({...p,texture:e.target.value}))}/></label>
    </aside>
    <main className="bp-workspace">
      <div className="bp-levelbar"><label>{F.levels}<select value={activeLevel.id} onChange={e=>{setActiveLevelId(e.target.value);setSelected(null);setSelectedStair(null);setInspectorTab('rooms')}}>{levels.map(l=><option key={l.id} value={l.id}>{l.name} · Z {draft.baseZ+l.offsetZ}</option>)}</select></label>
        <button type="button" title={F.add} onClick={addFloor} disabled={levels.length>=6}><Plus size={15}/>{F.add}</button>
        {activeLevel.id!==BLUEPRINT_GROUND_ID&&<button type="button" title={F.remove} onClick={removeFloor}><Trash2 size={15}/>{F.remove}</button>}
        <label className="bp-level-all"><input type="checkbox" checked={allFloors} onChange={e=>setAllFloors(e.target.checked)}/>{F.all}</label>
        <label>{F.viewWalls}<select value={wallVis} onChange={e=>setWallVis(e.target.value as 'normal'|'fade'|'hide')}><option value="hide">{F.hide}</option><option value="fade">{F.fade}</option><option value="normal">{F.normal}</option></select></label>
      </div>
      <div className="bp-toolbar">{tools.map(({key,label,icon:Icon})=><button key={key} className={tool===key?'active':''} onClick={()=>{setTool(key);setCursorPoints([]);setCalibrationPoints([]);setNotice('')}} title={label}><Icon size={16}/><span>{label}</span></button>)}</div>
      <div className={'bp-canvas-wrap '+(viewMode==='split'?'bp-split':'')}>
        {(viewMode==='2d'||viewMode==='split')&&<svg ref={svgRef} className="bp-canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e=>{finishOpeningDrag();panning.current=null;dragging.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{/* none */}}} onPointerCancel={()=>{finishOpeningDrag();panning.current=null;dragging.current=null}} onWheel={onWheel} onContextMenu={e=>e.preventDefault()}>
        <defs><pattern id="bp-grid" width={snap/draft.unitsPerPixel} height={snap/draft.unitsPerPixel} patternUnits="userSpaceOnUse"><path d={`M ${snap/draft.unitsPerPixel} 0 L 0 0 0 ${snap/draft.unitsPerPixel}`} stroke="#476077" strokeWidth={Math.max(.4,view.w/1800)} fill="none"/></pattern></defs>
        <rect x="0" y="0" width={width} height={height} fill="#192635"/>
        {showImage&&draft.imageDataUrl&&<image href={draft.imageDataUrl} x="0" y="0" width={width} height={height} opacity={opacity} pointerEvents="none"/>}
        <rect x="0" y="0" width={width} height={height} fill="url(#bp-grid)" pointerEvents="none"/>
        {visibleStrokes.map(stroke=><g key={stroke.id}>
          {stroke.kind==='room'&&<polygon points={stroke.points.map(p=>p.join(',')).join(' ')} fill={stroke.id===selected?'#29c7e429':'#2b9fb813'} pointerEvents="none"/>}
          <polyline points={(stroke.kind==='room'?[...stroke.points,stroke.points[0]]:stroke.points).map(p=>p.join(',')).join(' ')} fill="none" stroke={stroke.id===selected?'#68e7f8':'#7dbdd6'} strokeWidth={Math.max(2,view.w/320)} strokeLinejoin="round" pointerEvents="none"/>
          {stroke.openings.map(opening=>{const a=stroke.points[opening.edge],b=stroke.points[(opening.edge+1)%stroke.points.length],x=a[0]+(b[0]-a[0])*opening.t,y=a[1]+(b[1]-a[1])*opening.t;return <circle key={opening.id} cx={x} cy={y} r={Math.max(6,view.w/135)} fill={opening.kind==='door'?'#fbbf68':'#b0eaa8'} stroke="#0a111c" strokeWidth={2} style={{cursor:'ew-resize'}} onPointerDown={e=>{if(tool!=='select')return;e.stopPropagation();histories.current.push(clone(draft));futures.current=[];openingDrag.current={stroke:stroke.id,id:opening.id,edge:opening.edge,backup:clone(draft.strokes)};setSelected(stroke.id);setSelectedOpening(opening.id);setInspectorTab('properties');e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{e.stopPropagation();finishOpeningDrag();try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}}/>})}
          {stroke.id===selected&&stroke.points.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={Math.max(5,view.w/180)} stroke="#071923" strokeWidth={2} fill="#f1f9fc" style={{cursor:'grab'}} onPointerDown={e=>{if(tool!=='select')return;e.stopPropagation();histories.current.push(clone(draft));futures.current=[];dragging.current={stroke:stroke.id,index:i};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{dragging.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}}/>)}
        </g>)}
        {(draft.stairs||[]).filter(st=>st.fromLevelId===activeLevel.id).map(stair=>{const points=blueprintStairRectangle(draft,stair).map(p=>blueprintWorldToPixel(draft,p));return <g key={stair.id} onPointerDown={e=>{if(tool!=='select')return;e.stopPropagation();setSelectedStair(stair.id);setSelected(null);setInspectorTab('properties')}} style={{cursor:'pointer'}}>
          <polygon points={points.map(p=>p.join(',')).join(' ')} fill={stair.id===selectedStair?'#b58ef050':'#b58ef025'} stroke={stair.id===selectedStair?'#e8bdff':'#b58ef0'} strokeWidth={Math.max(2,view.w/290)} strokeDasharray="7 4"/>
          <text x={(points[0][0]+points[2][0])/2} y={(points[0][1]+points[2][1])/2} textAnchor="middle" fill="#e8bbff" fontSize={Math.max(12,view.w/85)} pointerEvents="none">↑ {F.stairs}</text></g>})}
        {draft.smartWalls!==false&&connections?.sharedRanges.map(([a,b],i)=>{const p=blueprintWorldToPixel(draft,a),q=blueprintWorldToPixel(draft,b);return <line key={`connected-${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#67edaf" strokeWidth={Math.max(2.5,view.w/250)} strokeDasharray="8 4" opacity={.9} pointerEvents="none"/>})}
        {repairProposal?.strokes.filter(st=>blueprintStrokeLevel(st)===activeLevel.id).map(stroke=><polyline key={`repair-${stroke.id}`} points={(stroke.kind==='room'?[...stroke.points,stroke.points[0]]:stroke.points).map(p=>p.join(',')).join(' ')} fill="none" stroke="#77f6a6" strokeWidth={Math.max(2.5,view.w/300)} strokeDasharray="6 5" pointerEvents="none"/>)}
        {hoverOpening&&(tool==='door'||tool==='window')&&<circle cx={hoverOpening.point[0]} cy={hoverOpening.point[1]} r={Math.max(7,view.w/130)} fill="#fbce65" stroke="#091923" strokeWidth={3} strokeDasharray="3 2" pointerEvents="none"/>}
        {cursorPoints.length>0&&<polyline points={cursorPoints.map(p=>p.join(',')).join(' ')} fill="none" stroke="#ffe19b" strokeWidth={Math.max(2,view.w/360)} strokeDasharray="8 6" pointerEvents="none"/>}
        {cursorPoints.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={Math.max(3,view.w/220)} fill="#ffe19b" pointerEvents="none"/>)}
        {calibrationPoints.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={Math.max(7,view.w/120)} fill="#ffcf84" pointerEvents="none"/>)}
      </svg>}
        {(viewMode==='3d'||viewMode==='split')&&<Preview brushes={previewData.brushes} plan={draft} selectedOpening={selectedOpening} selectedStair={selectedStair}
          activeLevelId={activeLevel.id} allFloors={allFloors} wallVis={wallVis}
          hideCeilings={hideCeilings} hint={selectedStair?F.stairHelp:selectedOpening?H.zHint:F.hint}
          onSelect={(st,op)=>{setActiveLevelId(blueprintStrokeLevel(draft.strokes.find(s=>s.id===st)!));setSelected(st);setSelectedStair(null);setSelectedOpening(op);setInspectorTab('properties')}} onChange={(st,op,patch,first)=>editOpening(st,op,patch,first)}
          onSelectStair={id=>{setActiveLevelId((draft.stairs||[]).find(st=>st.id===id)?.fromLevelId||BLUEPRINT_GROUND_ID);setSelectedStair(id);setSelected(null);setSelectedOpening(null);setInspectorTab('properties')}} onChangeStair={(id,patch,first)=>editStair(id,patch,first)}/>}
        <div className="bp-canvas-buttons"><button title={L[33]} onClick={()=>resetView()}><Maximize2 size={16}/></button><button title="Zoom in" onClick={()=>setView(v=>({...v,x:v.x+v.w*.08,y:v.y+v.h*.08,w:v.w*.84,h:v.h*.84}))}><ZoomIn size={16}/></button><button title="Zoom out" onClick={()=>setView(v=>({...v,x:v.x-v.w*.1,y:v.y-v.h*.1,w:v.w*1.2,h:v.h*1.2}))}><ZoomOut size={16}/></button><button onClick={()=>setViewMode('2d')} title="2D" className={viewMode==='2d'?'active':''}>2D</button><button onClick={()=>setViewMode('3d')} title={L[15]} className={viewMode==='3d'?'active':''}><Box size={15}/>3D</button><button onClick={()=>setViewMode('split')} title={T.split} className={viewMode==='split'?'active':''}><Columns2 size={15}/></button></div>
      </div>
      <div className="bp-hint">{viewMode==='3d'?T.edit3d:tool==='calibrate'?(calibrationPoints.length===1?(locale==='es'?'Ahora hacé clic en el segundo punto, lejos del primero.':'Now click a second point away from the first.'):L[36]):tool==='wall'||tool==='room'||tool==='rectangle'?L[37]:tool==='door'||tool==='window'?L[38]:L[39]}
        {cursorPoints.length>0&&<><button onClick={finishOutline} disabled={cursorPoints.length<(tool==='room'?3:2)}>{L[17]}</button><button onClick={()=>setCursorPoints([])}>{L[18]}</button></>}
      </div>
    </main><aside className="bp-inspector" aria-label={L[27]}>
      <div className="bp-inspector-tabs" role="tablist" aria-label={L[27]}>
        {(['rooms','properties','connections'] as const).map(tab=><button type="button" key={tab} role="tab" aria-selected={inspectorTab===tab} className={inspectorTab===tab?'active':''} onClick={()=>setInspectorTab(tab)}>{tab==='rooms'?<PanelsTopLeft size={15}/>:tab==='properties'?<Square size={15}/>:<GitMerge size={15}/>}<span>{H[tab]}</span>{tab==='rooms'&&<small>{draft.strokes.length}</small>}</button>)}
      </div>
      <div className="bp-inspector-content" key={inspectorTab} role="tabpanel">
        {inspectorTab==='rooms'&&<>
          <label>{H.rename}<input value={draft.name} maxLength={100} onChange={e=>update(p=>({...p,name:e.target.value}))}/></label>
          <div className="bp-floor-settings"><strong><Layers3 size={15}/>{F.selected}</strong><label>{F.name}<input value={activeLevel.name} maxLength={80} onChange={e=>{const name=e.target.value;histories.current.push(clone(draft));futures.current=[];update(p=>({...p,levels:blueprintLevels(p).map(l=>l.id===activeLevel.id?{...l,name}:l)}))}}/></label>
            <label>{F.floor} Z <input type="number" step="8" min={activeLevel.id===BLUEPRINT_GROUND_ID?0:(levels[levels.findIndex(l=>l.id===activeLevel.id)-1].offsetZ+draft.wallHeight+draft.slabThickness)} max={levels.findIndex(l=>l.id===activeLevel.id)<levels.length-1?levels[levels.findIndex(l=>l.id===activeLevel.id)+1].offsetZ-draft.wallHeight-draft.slabThickness:8192} disabled={activeLevel.id===BLUEPRINT_GROUND_ID} value={activeLevel.offsetZ} onChange={e=>{const n=Number(e.target.value),index=levels.findIndex(l=>l.id===activeLevel.id);if(index<1)return;const low=levels[index-1].offsetZ+draft.wallHeight+draft.slabThickness,high=index<levels.length-1?levels[index+1].offsetZ-draft.wallHeight-draft.slabThickness:8192;histories.current.push(clone(draft));futures.current=[];update(p=>({...p,levels:blueprintLevels(p).map(l=>l.id===activeLevel.id?{...l,offsetZ:Math.max(low,Math.min(high,n))}:l)}))}}/></label>
            <p className="bp-micro">{locale==='es'?'La altura Z es relativa a la planta baja; el generador recalcula las escaleras al modificarla.':'Z is relative to the ground floor. Stairs are recalculated when it changes.'}</p>
          </div>
          <label className="bp-check"><input type="checkbox" checked={hideCeilings} onChange={e=>setHideCeilings(e.target.checked)}/>{T.ceilings}</label>
          <div className="bp-section-heading">{L[27]} ({visibleStrokes.length})</div>
          <div className="bp-room-list">
            {visibleStrokes.length===0&&<p className="bp-muted">{L[28]}</p>}
            {visibleStrokes.map((stroke,index)=><button type="button" key={stroke.id} className={stroke.id===selected?'active':''} onClick={()=>{setSelected(stroke.id);setSelectedStair(null);setSelectedOpening(null);setInspectorTab('properties')}}><span className="bp-room-icon">{stroke.kind==='room'?'▣':'╱'}</span><span className="bp-room-name"><strong>{stroke.name||`${H.rooms} ${index+1}`}</strong><small>{stroke.points.length} {H.vertices.split(' ')[0]} · {stroke.openings.length} {H.openings.toLowerCase()}</small></span><span className="bp-room-arrow">›</span></button>)}
          </div>
          <div className="bp-section-heading">{F.stairs} ({activeStairs.length})</div>
          <div className="bp-room-list">{activeStairs.map(st=><button type="button" key={st.id} className={selectedStair===st.id?'active':''} onClick={()=>{setSelectedStair(st.id);setSelected(null);setInspectorTab('properties');setViewMode('3d')}}><Footprints size={17}/><span className="bp-room-name"><strong>{st.name}</strong><small>{st.steps} {F.steps.toLowerCase()} · {st.length} u</small></span></button>)}</div>
        </>}
        {inspectorTab==='properties'&&<>
          <button type="button" className="bp-secondary bp-inspector-back" onClick={()=>setInspectorTab('rooms')}><PanelsTopLeft size={15}/>{H.goRooms}</button>
          {selectedStairActive&&activeStair&&<div className="bp-properties-body bp-stair-properties">
            <div className="bp-section-heading"><Footprints size={16}/>{F.stairs}</div>
            <label>{F.name}<input value={activeStair.name} maxLength={80} onChange={e=>editStair(activeStair.id,{name:e.target.value})}/></label>
            <div className="bp-coordinate"><label>{F.from}<input value={levels.find(l=>l.id===activeStair.fromLevelId)?.name||''} readOnly/></label><label>{F.to}<input value={levels.find(l=>l.id===activeStair.toLevelId)?.name||''} readOnly/></label></div>
            <div className="bp-coordinate"><label>{H.width}<input type="number" min="40" max="256" step="4" value={activeStair.width} onChange={e=>editStair(activeStair.id,{width:Number(e.target.value)})}/></label><label>{F.length}<input type="number" min="128" max="1024" step="4" value={activeStair.length} onChange={e=>editStair(activeStair.id,{length:Number(e.target.value)})}/></label></div>
            <div className="bp-coordinate"><label>{F.steps}<input type="number" min="8" max="48" value={activeStair.steps} onChange={e=>editStair(activeStair.id,{steps:Number(e.target.value)})}/></label><label>{F.direction}<select value={activeStair.direction} onChange={e=>editStair(activeStair.id,{direction:Number(e.target.value) as BlueprintStair['direction']})}>{[0,90,180,270].map(a=><option key={a} value={a}>{a}°</option>)}</select></label></div>
            <div className="bp-coordinate">{[0,1].map(axis=>{const xy=blueprintPixelToWorld(draft,activeStair.start);return <label key={axis}>{axis===0?'X':'Y'}<input type="number" value={Math.round(xy[axis])} onChange={e=>{const next:PlanPoint=[...xy];next[axis]=Number(e.target.value);editStair(activeStair.id,{start:blueprintWorldToPixel(draft,next)})}}/></label>})}</div>
            <p className="bp-micro">{F.stairHelp}</p>
            <button className="bp-danger bp-full" onClick={()=>{histories.current.push(clone(draft));futures.current=[];update(p=>({...p,stairs:(p.stairs||[]).filter(s=>s.id!==activeStair.id)}));setSelectedStair(null)}}><Trash2 size={16}/>{F.deleteStair}</button>
          </div>}
          {!selectedStairActive&&(!selectedStroke?<p className="bp-muted">{H.empty}</p>:<div className="bp-properties-body">
            <label>{H.rename}<input value={selectedStroke.name} maxLength={100} onChange={e=>updateSelected(stroke=>{stroke.name=e.target.value})}/></label>
            {selectedStroke.kind==='room'&&<div className="bp-quick-toggles"><label className="bp-check"><input type="checkbox" checked={selectedStroke.floor} onChange={e=>updateSelected(stroke=>{stroke.floor=e.target.checked})}/>{H.floor}</label><label className="bp-check"><input type="checkbox" checked={selectedStroke.ceiling} onChange={e=>updateSelected(stroke=>{stroke.ceiling=e.target.checked})}/>{H.ceiling}</label></div>}
            {selectedStroke.kind==='room'&&blueprintStrokeLevel(selectedStroke)===levels.at(-1)?.id&&<div className="bp-roof-settings"><label>{locale==='es'?'Cubierta de la habitación':'Room roof'}<select value={selectedStroke.roof?.kind||(selectedStroke.ceiling?'flat':'none')} onChange={e=>updateSelected(stroke=>{const kind=e.target.value;stroke.roof=kind==='gable'||kind==='shed'?{kind:kind as 'gable'|'shed',rise:80}:undefined;stroke.ceiling=kind!=='none'})}><option value="none">{locale==='es'?'Sin techo':'No roof'}</option><option value="flat">{locale==='es'?'Techo plano':'Flat roof'}</option><option value="shed">{locale==='es'?'Un agua':'Single slope'}</option><option value="gable">{locale==='es'?'Dos aguas':'Gable roof'}</option></select></label>
              {selectedStroke.roof&&<label>{locale==='es'?'Elevación de la cubierta (u)':'Roof rise (u)'}<input type="number" min="16" max="512" step="8" value={selectedStroke.roof.rise} onChange={e=>updateSelected(stroke=>{if(stroke.roof)stroke.roof.rise=Number(e.target.value)})}/></label>}
              <p className="bp-micro">{locale==='es'?'Las cubiertas inclinadas requieren una habitación rectangular; su geometría se valida antes de generar el MAP.':'Pitched roofs require rectangular rooms and are validated before MAP export.'}</p>
            </div>}
            <details className="bp-collapse"><summary>{H.vertices} ({selectedStroke.points.length})</summary>
              <div className="bp-vertices">{selectedStroke.points.map((p,i)=>{const w=pointWorld(p);return <div key={i}><b>{i+1}</b>{[0,1].map(axis=><label key={axis}>{axis===0?'X':'Y'}<input type="number" value={Math.round(w[axis]*100)/100} onChange={e=>updateSelected(stroke=>{const old=blueprintPixelToWorld(draft,stroke.points[i]);old[axis]=Number(e.target.value);stroke.points[i]=blueprintWorldToPixel(draft,old)})}/></label>)}</div>})}</div>
            </details>
            <div className="bp-section-heading">{H.openings} ({selectedStroke.openings.length})</div>
            {selectedStroke.openings.length===0&&<p className="bp-muted">{H.noOpenings}</p>}
            {selectedStroke.openings.map(opening=>{
              const start=pointWorld(selectedStroke.points[opening.edge]);
              const end=pointWorld(selectedStroke.points[(opening.edge+1)%selectedStroke.points.length]);
              const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
              const freeSlots=blueprintOpeningSpaces(draft,selectedStroke.id,opening.id);
              const maxWidth=Math.floor(Math.max(0,...freeSlots.map(([a,b])=>b-a)));
              const cornerGap=Math.min(opening.t*length-opening.width/2,(1-opening.t)*length-opening.width/2);
              return <div className={'bp-opening '+(selectedOpening===opening.id?'bp-opening-active':'')} key={opening.id}>
                <div className="bp-opening-title"><button type="button" className="bp-opening-select" onClick={()=>setSelectedOpening(opening.id)}><DoorOpen size={15}/>{opening.kind==='door'?L[9]:L[10]} · {H.wall} {opening.edge+1}</button><button title={H.remove} aria-label={H.remove} onClick={()=>updateSelected(stroke=>{stroke.openings=stroke.openings.filter(o=>o.id!==opening.id)})}><X size={14}/></button></div>
                <label className="bp-opening-wide">{H.position} ({Math.round(opening.t*100)}%)<input type="range" min="0.01" max="0.99" step="0.005" value={opening.t} onChange={e=>editOpening(selectedStroke.id,opening.id,{t:Number(e.target.value)})}/></label>
                <div className="bp-opening-numbers"><label>{H.width}<input type="number" min={24} value={opening.width} onChange={e=>editOpening(selectedStroke.id,opening.id,{width:Number(e.target.value)})}/></label><label>{H.height}<input type="number" min={32} value={opening.height} onChange={e=>editOpening(selectedStroke.id,opening.id,{height:Number(e.target.value)})}/></label></div>
                <div className="bp-opening-z"><label>{H.heightZ}<input type="number" min={0} max={Math.max(0,draft.wallHeight-opening.height-8)} step={2} value={opening.sill} onChange={e=>editOpening(selectedStroke.id,opening.id,{sill:Number(e.target.value)})}/></label><div className="bp-opening-z-buttons"><button type="button" title={H.lower} disabled={opening.sill<=0} onClick={()=>editOpening(selectedStroke.id,opening.id,{sill:opening.sill-8})}><MoveVertical size={14}/>{H.lower} −8</button><button type="button" title={H.raise} disabled={opening.sill>=draft.wallHeight-opening.height-8} onClick={()=>editOpening(selectedStroke.id,opening.id,{sill:opening.sill+8})}><MoveVertical size={14}/>{H.raise} +8</button></div></div>
                {opening.kind==='door'&&opening.height<72&&<p className="bp-opening-hint">{T.short}</p>}
                <small className="bp-opening-metrics">{T.maxWidth}: {maxWidth} u · {T.corner}: {Math.round(cornerGap)} u</small>
              </div>})}
            <div className="bp-actions"><button title={L[44]} aria-label={L[44]} onClick={()=>{updateStrokes(strokes=>{const i=strokes.findIndex(st=>st.id===selected);if(i>=0){const n=clone(strokes[i]);n.id=uid();n.name+=' copy';n.openings=n.openings.map(op=>({...op,id:uid()}));strokes.push(n);setSelected(n.id)}return strokes})}}><Copy size={16}/></button><button className="bp-danger" title={L[43]} aria-label={L[43]} onClick={()=>{updateStrokes(strokes=>strokes.filter(st=>st.id!==selected));setSelected(null);setInspectorTab('rooms')}}><Trash2 size={16}/></button></div>
            <p className="bp-micro">{H.zHint}</p>
          </div>)}
        </>}
        {inspectorTab==='connections'&&<>
          <div className="bp-connections"><strong><GitMerge size={15}/>{S.title}</strong>
            <label className="bp-check"><input type="checkbox" checked={draft.smartWalls!==false} onChange={e=>update(p=>({...p,smartWalls:e.target.checked}))}/>{S.on}</label>
            <p className="bp-micro"><Magnet size={13}/>{S.snap}</p>
            {draft.smartWalls!==false&&connections&&<div className="bp-wall-stats"><span><b>{connections.sharedSections}</b> {S.shared}</span><span><b>{Math.round(connections.sharedLength)}</b> u · {S.saved}</span><span><b>{connections.junctions}</b> {S.junctions}</span></div>}
            <button className="bp-secondary bp-full" onClick={previewWallRepair} disabled={!draft.strokes.length}><WandSparkles size={15}/>{S.repair}</button>
            {repairProposal&&<div className="bp-repair-preview"><b>{S.review}</b><p>{S.preview}</p><div><button onClick={applyWallRepair}><Check size={15}/>{S.apply}</button><button onClick={()=>{setRepairProposal(null);setNotice('')}}><X size={15}/>{S.cancel}</button></div></div>}
            <small>{draft.smartWalls!==false?S.hint:S.disabled}</small>
          </div>
          <label className="bp-check"><input type="checkbox" checked={hideCeilings} onChange={e=>setHideCeilings(e.target.checked)}/>{T.ceilings}</label>
        </>}
      </div>
      <div className="bp-info" aria-label={H.status}><strong>{previewData.brushes.length} / {BLUEPRINT_MAX_BRUSHES} brushes</strong><span>{draft.strokes.length} outlines · {draft.strokes.reduce((total,stroke)=>total+stroke.openings.length,0)} openings · {saved?.memberIds.length?T.saved:T.draft}</span>{previewData.error?<><p className="bp-error"><AlertTriangle size={15}/>{previewData.error}</p><button className="bp-secondary" onClick={fixOpenings}>{T.fit}</button></>:draft.strokes.length>0?<p className="bp-valid"><CheckCircle2 size={15}/>Convex Valve 220 geometry validated</p>:null}</div>
    </aside></div>
    <footer className="bp-foot"><span role="status">{notice||L[40]}</span><div><button disabled={!histories.current.length} onClick={goBack} title={L[31]}><Undo2 size={16}/></button><button disabled={!futures.current.length} onClick={goForward} title={L[32]}><Redo2 size={16}/></button>{saved&&<><button onClick={()=>remove(true)} title={L[13]}><Unlink2 size={15}/></button><button className="bp-danger" onClick={()=>remove(false)} title={L[14]}><Trash2 size={15}/></button></>}<button onClick={persistDraft} title={locale==='es'?'Guardar trazados e imagen sin generar brushes':'Save outlines and image without generating brushes'}><Save size={15}/>{locale==='es'?'Guardar plano':'Save blueprint'}</button><button onClick={placeInMap} disabled={!!previewData.error||previewData.brushes.length===0} title={locale==='es'?'Cerrar y elegir ubicación con clic en el visor 3D':'Close and click a position in the 3D viewport'}><MousePointer2 size={15}/>{locale==='es'?'Colocar en mapa':'Place in map'}</button><button className="bp-primary" onClick={save} disabled={!!previewData.error||previewData.brushes.length===0}><Save size={16}/>{L[12]}</button></div></footer>
  </section></div>;
}
