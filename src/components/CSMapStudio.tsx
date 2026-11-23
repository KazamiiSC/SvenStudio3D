import {useEffect,useRef,useState} from 'react';
import {Crosshair,Flag,Package,Shield,AlertTriangle,X,MapPin,Plus,CheckCircle2,MousePointer2,Target,Repeat2,Move,Eye,Navigation2,RotateCcw,Search,Layers3,Focus,ArrowRight} from 'lucide-react';
import {useEditor} from '../store';
import {transformedVertices} from '../engine/geometry';
import {cs16AnchorAtSurface} from '../engine/csMapPlacement';
import {cs16Inventory,cs16SelectionIds,cs16ItemSelected,inspectCS16Advanced,type CS16ObjectGroup} from '../engine/csMapIntegration';
import type {MapObject,Vec3} from '../engine/types';
import {cs16ApplyBatch,cs16Armoury,cs16CanApply,cs16Hostages,cs16ModeFromMapName,cs16NormalizeYaw,cs16Spawns,cs16Zone,CS16_ARMOURY_ITEMS,inspectCS16Layout,type CS16MapKind,type CS16Team,type CS16ZoneKind} from '../engine/csMapStudio';
import {inspectCS16Project} from '../engine/gameProfiles';
import {useCSMapPlacement} from '../csMapPlacementState';
import type {CS16PlacementAction,CS16PlacementRequest,CS16PlacementTool} from '../engine/csMapPlacement';
import {CSMapHF33Builder,CSMapHF33Audit} from './CSMapHF33';
import './csMapStudio.css';

type Words={title:string,subtitle:string,mode:string,spawns:string,objectives:string,equipment:string,audit:string,description:string,
 team:string,ct:string,t:string,count:string,columns:string,spacing:string,yaw:string,spawnHeight:string,center:string,selected:string,
 place:string,zone:string,width:string,depth:string,height:string,floor:string,weapon:string,hostages:string,notice:string,close:string,
 added:string,onlyCS:string,failed:string,noSelection:string,more:string,baseTip:string,zoneTip:string,modeTip:string,noIssues:string,limitations:string};
const WORDS:Record<string,Words>={
 es:{title:'CS Map Studio 3.0',subtitle:'Objetivos y entidades nativas · Counter-Strike 1.6',mode:'Tipo de mapa',spawns:'Apariciones CT / TT',objectives:'Objetivos y zonas',equipment:'Armas y rehenes',audit:'Revisión',description:'Creá entidades reales de CS 1.6 sobre la geometría de tu mapa.',team:'Equipo',ct:'Antiterroristas (CT)',t:'Terroristas (TT)',count:'Cantidad',columns:'Columnas',spacing:'Separación',yaw:'Orientación (yaw)',spawnHeight:'Z de aparición',center:'Centro X / Y / Z',selected:'Usar posición seleccionada',place:'Crear',zone:'Tipo de zona',width:'Ancho X',depth:'Largo Y',height:'Alto Z',floor:'Z del suelo',weapon:'Arma',hostages:'Rehenes',notice:'Resultado',close:'Cerrar',added:'Entidades agregadas al proyecto. Deshacer con Ctrl+Z.',onlyCS:'Solo disponible en perfil Counter-Strike 1.6 y editor MAP.',failed:'No se pudieron crear las entidades:',noSelection:'Seleccioná un objeto para copiar su posición.',more:'Ver Map Doctor para otros avisos',baseTip:'La posición Z del spawn debe estar aproximadamente 36 unidades por encima del suelo. Comprobá espacio y colisiones en el juego.',zoneTip:'La zona es un brush AAATRIGGER vinculado a la entidad. Si faltan texturas de herramientas, cargá zhlt.wad.',modeTip:'El tipo sirve para recomendaciones, no cambia automáticamente el nombre del BSP ni las reglas del juego.',noIssues:'Sin avisos básicos para este tipo de mapa.',limitations:'La revisión no simula rutas, navegación, colisiones reales, zonas de compra ni lógica del servidor. Probá el BSP en CS 1.6.'},
 en:{title:'CS Map Studio 3.0',subtitle:'Native objectives and entities · Counter-Strike 1.6',mode:'Map type',spawns:'CT / T spawns',objectives:'Objectives and zones',equipment:'Weapons and hostages',audit:'Review',description:'Create real CS 1.6 entities on top of your existing map geometry.',team:'Team',ct:'Counter-Terrorists (CT)',t:'Terrorists (T)',count:'Count',columns:'Columns',spacing:'Spacing',yaw:'Facing (yaw)',spawnHeight:'Spawn Z',center:'Center X / Y / Z',selected:'Use selected position',place:'Add',zone:'Zone type',width:'Width X',depth:'Depth Y',height:'Height Z',floor:'Floor Z',weapon:'Weapon',hostages:'Hostages',notice:'Result',close:'Close',added:'Entities added to the project. Undo with Ctrl+Z.',onlyCS:'Only available in the CS 1.6 profile and MAP editor.',failed:'Could not create entities:',noSelection:'Select a map object to copy its position.',more:'Open Map Doctor for additional warnings',baseTip:'Spawn Z should be about 36 units above the floor. Check clearance and collisions in game.',zoneTip:'Zones use an AAATRIGGER brush tied to a native entity. Load zhlt.wad if tool textures are missing.',modeTip:'Map type affects advice only; it does not automatically rename your BSP or change game rules.',noIssues:'No basic warnings for this map type.',limitations:'Checks do not simulate paths, navigation, real collisions, buy zones or server logic. Test the BSP in CS 1.6.'},
 ru:{title:'CS Map Studio 3.0',subtitle:'Цели и сущности Counter-Strike 1.6',mode:'Тип карты',spawns:'Точки CT / T',objectives:'Цели и зоны',equipment:'Оружие и заложники',audit:'Проверка',description:'Добавление сущностей CS 1.6 к геометрии карты.',team:'Команда',ct:'Спецназ (CT)',t:'Террористы (T)',count:'Количество',columns:'Колонки',spacing:'Интервал',yaw:'Направление (yaw)',spawnHeight:'Высота точки Z',center:'Центр X / Y / Z',selected:'Позиция выделенного',place:'Добавить',zone:'Тип зоны',width:'Ширина X',depth:'Длина Y',height:'Высота Z',floor:'Уровень пола Z',weapon:'Оружие',hostages:'Заложники',notice:'Результат',close:'Закрыть',added:'Сущности добавлены. Отмена Ctrl+Z.',onlyCS:'Доступно только в профиле CS 1.6 и редакторе MAP.',failed:'Не удалось создать:',noSelection:'Выберите объект, чтобы скопировать его координаты.',more:'Другие предупреждения в Map Doctor',baseTip:'Точка появления должна находиться примерно на 36 ед. выше пола. Проверяйте коллизии в игре.',zoneTip:'Зоны используют кисть AAATRIGGER с привязанной сущностью. При необходимости загрузите zhlt.wad.',modeTip:'Тип карты влияет только на подсказки, не переименовывает BSP.',noIssues:'Основных проблем нет.',limitations:'Проверка не моделирует пути, коллизии и правила сервера. Проверьте BSP в CS 1.6.'},
 ko:{title:'CS Map Studio 3.0',subtitle:'Counter-Strike 1.6 전용 목표 및 엔티티',mode:'맵 유형',spawns:'CT / T 스폰',objectives:'목표 및 구역',equipment:'무기 및 인질',audit:'검사',description:'기존 맵 지오메트리에 CS 1.6 엔티티를 추가합니다.',team:'팀',ct:'대테러부대 (CT)',t:'테러리스트 (T)',count:'개수',columns:'열',spacing:'간격',yaw:'방향 (yaw)',spawnHeight:'스폰 Z',center:'중심 X / Y / Z',selected:'선택 위치 사용',place:'추가',zone:'구역 유형',width:'너비 X',depth:'길이 Y',height:'높이 Z',floor:'바닥 Z',weapon:'무기',hostages:'인질',notice:'결과',close:'닫기',added:'엔티티가 추가되었습니다. Ctrl+Z로 취소.',onlyCS:'CS 1.6 프로필의 MAP 편집기에서만 사용할 수 있습니다.',failed:'생성 실패:',noSelection:'위치를 복사할 맵 오브젝트를 선택하세요.',more:'추가 경고는 Map Doctor 참조',baseTip:'스폰 Z는 바닥보다 약 36유닛 위여야 합니다. 게임에서 충돌을 확인하세요.',zoneTip:'구역은 엔티티에 연결된 AAATRIGGER 브러시입니다. 필요하면 zhlt.wad를 로드하세요.',modeTip:'유형은 안내에만 사용되며 BSP 이름을 바꾸지 않습니다.',noIssues:'기본 문제 없음.',limitations:'경로, 충돌, 구매 구역 및 서버 규칙은 시뮬레이션하지 않습니다. CS 1.6에서 BSP를 테스트하세요.'},
 zh:{title:'CS Map Studio 3.0',subtitle:'Counter-Strike 1.6 原生目标与实体',mode:'地图类型',spawns:'CT / T 出生点',objectives:'目标和区域',equipment:'武器与人质',audit:'检查',description:'在现有地图几何上创建 CS 1.6 实体。',team:'队伍',ct:'反恐精英 (CT)',t:'恐怖分子 (T)',count:'数量',columns:'列数',spacing:'间距',yaw:'朝向 (yaw)',spawnHeight:'出生点 Z',center:'中心 X / Y / Z',selected:'使用选中位置',place:'添加',zone:'区域类型',width:'宽 X',depth:'长 Y',height:'高 Z',floor:'地面 Z',weapon:'武器',hostages:'人质',notice:'结果',close:'关闭',added:'实体已添加。Ctrl+Z 撤销。',onlyCS:'仅适用于 CS 1.6 配置的 MAP 编辑器。',failed:'创建失败：',noSelection:'请选择一个地图对象以复制其位置。',more:'其他警告请查看 Map Doctor',baseTip:'出生点 Z 应高于地面约 36 单位。请在游戏内检查碰撞。',zoneTip:'区域使用关联实体的 AAATRIGGER 笔刷。缺少工具贴图时加载 zhlt.wad。',modeTip:'类型仅影响提示，不自动重命名 BSP。',noIssues:'未发现基本问题。',limitations:'不模拟路径、真实碰撞、购买区域或服务器规则。请在 CS 1.6 内测试 BSP。'},
 pt:{title:'CS Map Studio 3.0',subtitle:'Objetivos e entidades nativas · Counter-Strike 1.6',mode:'Tipo de mapa',spawns:'Spawns CT / TR',objectives:'Objetivos e zonas',equipment:'Armas e reféns',audit:'Verificação',description:'Crie entidades nativas do CS 1.6 sobre a geometria existente.',team:'Equipe',ct:'Contra-Terroristas (CT)',t:'Terroristas (TR)',count:'Quantidade',columns:'Colunas',spacing:'Espaçamento',yaw:'Direção (yaw)',spawnHeight:'Z do spawn',center:'Centro X / Y / Z',selected:'Usar posição selecionada',place:'Adicionar',zone:'Tipo de zona',width:'Largura X',depth:'Comprimento Y',height:'Altura Z',floor:'Z do chão',weapon:'Arma',hostages:'Reféns',notice:'Resultado',close:'Fechar',added:'Entidades adicionadas. Desfaça com Ctrl+Z.',onlyCS:'Disponível somente no perfil CS 1.6 e editor MAP.',failed:'Falha ao criar:',noSelection:'Selecione um objeto para copiar sua posição.',more:'Veja o Map Doctor para mais avisos',baseTip:'O Z do spawn deve ficar cerca de 36 unidades acima do chão. Confira colisões no jogo.',zoneTip:'As zonas usam brush AAATRIGGER ligado à entidade. Carregue zhlt.wad caso faltem texturas.',modeTip:'O tipo só afeta sugestões; não renomeia o BSP automaticamente.',noIssues:'Nenhum aviso básico para este modo.',limitations:'A verificação não simula caminhos, colisões, compra ou regras do servidor. Teste o BSP no CS 1.6.'}
};

/** Existing diagnostics use stable codes. Keep all new UI warnings localized. */
const WARNING_LABELS:Record<string,Record<string,string>>={
 es:{SPAWN_OVERLAP:'Hay puntos de aparición del mismo equipo demasiado cercanos.',OPPOSING_SPAWNS:'Hay puntos CT y TT superpuestos.',DE_BOMB:'El mapa de_ necesita al menos una zona de bomba válida.',CS_HOSTAGES:'El mapa cs_ necesita rehenes.',CS_RESCUE:'El mapa cs_ necesita una zona de rescate.',MIXED_OBJECTIVES:'Hay objetivos de otro tipo de mapa.',MISSING_TEAMS:'Agregá al menos un spawn CT y uno TT.'},
 en:{SPAWN_OVERLAP:'Some same-team spawn points are too close.',OPPOSING_SPAWNS:'CT and T spawn points overlap.',DE_BOMB:'A de_ map needs at least one valid bomb target.',CS_HOSTAGES:'A cs_ map needs hostages.',CS_RESCUE:'A cs_ map needs a rescue zone.',MIXED_OBJECTIVES:'This map contains objectives from a different game mode.',MISSING_TEAMS:'Add at least one CT and one T spawn.'},
 ru:{SPAWN_OVERLAP:'Точки появления одной команды слишком близко.',OPPOSING_SPAWNS:'Точки появления CT и T пересекаются.',DE_BOMB:'Для de_ нужна зона установки бомбы.',CS_HOSTAGES:'Для cs_ нужны заложники.',CS_RESCUE:'Для cs_ нужна зона спасения.',MIXED_OBJECTIVES:'Есть цели от другого режима.',MISSING_TEAMS:'Добавьте точки появления CT и T.'},
 ko:{SPAWN_OVERLAP:'같은 팀의 스폰 위치가 너무 가깝습니다.',OPPOSING_SPAWNS:'CT와 T 스폰 위치가 겹칩니다.',DE_BOMB:'de_ 맵에는 유효한 폭탄 설치 구역이 필요합니다.',CS_HOSTAGES:'cs_ 맵에는 인질이 필요합니다.',CS_RESCUE:'cs_ 맵에는 인질 구조 구역이 필요합니다.',MIXED_OBJECTIVES:'다른 게임 모드의 목표가 있습니다.',MISSING_TEAMS:'CT와 T 스폰을 하나 이상 추가하세요.'},
 zh:{SPAWN_OVERLAP:'同一队伍的出生点过近。',OPPOSING_SPAWNS:'CT 和 T 出生点重叠。',DE_BOMB:'de_ 地图需要有效的炸弹安装区。',CS_HOSTAGES:'cs_ 地图需要人质。',CS_RESCUE:'cs_ 地图需要人质营救区。',MIXED_OBJECTIVES:'地图中存在其他模式的目标。',MISSING_TEAMS:'至少添加一个 CT 和一个 T 出生点。'},
 pt:{SPAWN_OVERLAP:'Há spawns da mesma equipe muito próximos.',OPPOSING_SPAWNS:'Spawns CT e TR estão sobrepostos.',DE_BOMB:'Mapas de_ precisam de uma zona de bomba válida.',CS_HOSTAGES:'Mapas cs_ precisam de reféns.',CS_RESCUE:'Mapas cs_ precisam de zona de resgate.',MIXED_OBJECTIVES:'Há objetivos de outro modo de jogo.',MISSING_TEAMS:'Adicione pelo menos um spawn CT e um TR.'}
};
const ERROR_LABELS:Record<string,Record<string,string>>={
 es:{CS16_INVALID_COORDS:'Coordenadas fuera del rango permitido.',CS16_INVALID_AMOUNT:'Cantidad fuera del rango permitido.',CS16_INVALID_SPACING:'Separación u orientación inválidas.',CS16_INVALID_ZONE_SIZE:'Las dimensiones de la zona no son válidas.',CS16_INVALID_WEAPON:'El arma elegida no es compatible.'},
 en:{CS16_INVALID_COORDS:'Coordinates are outside the allowed range.',CS16_INVALID_AMOUNT:'Count is outside the allowed range.',CS16_INVALID_SPACING:'Invalid spacing or facing direction.',CS16_INVALID_ZONE_SIZE:'Invalid zone dimensions.',CS16_INVALID_WEAPON:'Unsupported weapon choice.'},
 ru:{CS16_INVALID_COORDS:'Координаты вне диапазона.',CS16_INVALID_AMOUNT:'Недопустимое количество.',CS16_INVALID_SPACING:'Неверный интервал или угол.',CS16_INVALID_ZONE_SIZE:'Неверные размеры зоны.',CS16_INVALID_WEAPON:'Оружие не поддерживается.'},
 ko:{CS16_INVALID_COORDS:'허용 범위를 벗어난 좌표입니다.',CS16_INVALID_AMOUNT:'허용 범위를 벗어난 수량입니다.',CS16_INVALID_SPACING:'간격 또는 방향이 잘못되었습니다.',CS16_INVALID_ZONE_SIZE:'구역 크기가 잘못되었습니다.',CS16_INVALID_WEAPON:'지원하지 않는 무기입니다.'},
 zh:{CS16_INVALID_COORDS:'坐标超出允许范围。',CS16_INVALID_AMOUNT:'数量超出允许范围。',CS16_INVALID_SPACING:'间距或朝向无效。',CS16_INVALID_ZONE_SIZE:'区域尺寸无效。',CS16_INVALID_WEAPON:'不支持的武器。'},
 pt:{CS16_INVALID_COORDS:'Coordenadas fora do intervalo permitido.',CS16_INVALID_AMOUNT:'Quantidade fora do intervalo permitido.',CS16_INVALID_SPACING:'Espaçamento ou orientação inválidos.',CS16_INVALID_ZONE_SIZE:'Dimensões da zona inválidas.',CS16_INVALID_WEAPON:'Arma não suportada.'}
};

const ZONES:{id:CS16ZoneKind;label:string}[]=[{id:'bomb_a',label:'Bombsite A'},{id:'bomb_b',label:'Bombsite B'},{id:'buy_ct',label:'Buyzone CT'},{id:'buy_t',label:'Buyzone T'},{id:'rescue',label:'Hostage Rescue'}];
const int=(n:number)=>Number.isFinite(n)?Math.round(n):0;


type NewWords={position:string,placeInMap:string,pickMap:string,pickHelp:string,paintHelp:string,repeat:string,
 cancel:string,ready:string,pickDone:string,placed:string,invalid:string,modeBlocked:string,preview:string,
 selectedHint:string,drag:string,manual:string,pickAPlace:string,placeConfirm:string,placementActive:string,
 floorOnly:string,zoneSize:string,spawnsHint:string,toolsHint:string,checkMap:string,clickMap:string,objectCount:string};
const NEW_WORDS:Record<string,NewWords>={
 es:{position:'Ubicación en el mapa',placeInMap:'Colocar en el mapa',pickMap:'Elegir ubicación',pickHelp:'Hacé clic en el suelo del mapa para copiar la ubicación al formulario.',paintHelp:'Hacé clic en el suelo para crear el objeto directamente. Esc para cancelar.',repeat:'Colocación continua',cancel:'Cancelar herramienta',ready:'Listo para colocar',pickDone:'Ubicación elegida',placed:'Objetos agregados',invalid:'No se pudo colocar; revisá los valores.',modeBlocked:'Seleccioná el perfil CS 1.6 y el editor MAP.',preview:'Vista previa 3D',selectedHint:'Podés usar un objeto seleccionado o elegir el suelo directamente.',drag:'Arrastrar panel',manual:'Crear en XYZ',pickAPlace:'Elegí un lugar del mapa',placeConfirm:'Clic izquierdo para colocar',placementActive:'Herramienta activa',floorOnly:'Solo superficies horizontales: paredes y techos no son válidos.',zoneSize:'Volumen de la zona',spawnsHint:'Grilla de spawns · usar piso plano y suficiente espacio libre.',toolsHint:'Elegí una herramienta y señalá dónde querés crearla.',checkMap:'Control de mapa',clickMap:'Clic en la superficie del mapa',objectCount:'objetos'},
 en:{position:'Map position',placeInMap:'Place on map',pickMap:'Pick position',pickHelp:'Click the map floor to copy the position into the form.',paintHelp:'Click a floor to create the object directly. Esc to cancel.',repeat:'Repeat placement',cancel:'Cancel tool',ready:'Ready to place',pickDone:'Position selected',placed:'Objects created',invalid:'Placement failed; check the values.',modeBlocked:'Use CS 1.6 profile in MAP editor.',preview:'3D preview',selectedHint:'Use an existing selection or pick a floor directly.',drag:'Drag panel',manual:'Create at XYZ',pickAPlace:'Pick a location in the map',placeConfirm:'Left click to place',placementActive:'Active tool',floorOnly:'Horizontal floors only; walls and ceilings are rejected.',zoneSize:'Zone volume',spawnsHint:'Spawn grid · use flat floor and enough free space.',toolsHint:'Choose a tool and point to where you want it.',checkMap:'Map checks',clickMap:'Click a map surface',objectCount:'objects'},
 ru:{position:'Положение на карте',placeInMap:'Разместить на карте',pickMap:'Выбрать позицию',pickHelp:'Щёлкните по полу, чтобы выбрать координаты.',paintHelp:'Щёлкните по полу для размещения. Esc — отмена.',repeat:'Повторять размещение',cancel:'Отменить инструмент',ready:'Готово к размещению',pickDone:'Координаты выбраны',placed:'Объекты добавлены',invalid:'Не удалось разместить. Проверьте параметры.',modeBlocked:'Выберите профиль CS 1.6 и редактор MAP.',preview:'3D-просмотр',selectedHint:'Можно выбрать объект или щёлкнуть по полу.',drag:'Перетащить панель',manual:'Создать по XYZ',pickAPlace:'Выберите место на карте',placeConfirm:'Левый щелчок — разместить',placementActive:'Активный инструмент',floorOnly:'Только горизонтальный пол, не стены и потолки.',zoneSize:'Объём зоны',spawnsHint:'Сетка точек — ровный пол и свободное место.',toolsHint:'Выберите инструмент и место размещения.',checkMap:'Проверка карты',clickMap:'Щёлкните по поверхности',objectCount:'объектов'},
 ko:{position:'맵 위치',placeInMap:'맵에 배치',pickMap:'위치 선택',pickHelp:'맵 바닥을 클릭하여 좌표를 복사하세요.',paintHelp:'바닥을 클릭하여 바로 배치합니다. Esc 취소.',repeat:'연속 배치',cancel:'도구 취소',ready:'배치 준비',pickDone:'위치 선택됨',placed:'오브젝트 생성됨',invalid:'배치 실패: 값을 확인하세요.',modeBlocked:'CS 1.6 프로필과 MAP 편집기를 사용하세요.',preview:'3D 미리보기',selectedHint:'선택한 오브젝트 또는 바닥 클릭으로 위치를 지정하세요.',drag:'패널 이동',manual:'XYZ 위치에 생성',pickAPlace:'맵에서 위치 선택',placeConfirm:'왼쪽 클릭으로 배치',placementActive:'활성 도구',floorOnly:'수평 바닥만 가능합니다. 벽/천장은 불가능합니다.',zoneSize:'구역 크기',spawnsHint:'스폰 격자 · 평평하고 충분히 넓은 공간을 사용하세요.',toolsHint:'도구를 선택한 뒤 위치를 지정하세요.',checkMap:'맵 검사',clickMap:'맵 표면 클릭',objectCount:'오브젝트'},
 zh:{position:'地图位置',placeInMap:'在地图中放置',pickMap:'选择位置',pickHelp:'点击地面，将坐标复制到表单。',paintHelp:'点击地面直接创建。按 Esc 取消。',repeat:'连续放置',cancel:'取消工具',ready:'准备放置',pickDone:'位置已选',placed:'已创建对象',invalid:'创建失败，请检查数值。',modeBlocked:'请在 MAP 编辑器使用 CS 1.6 配置。',preview:'3D 预览',selectedHint:'可使用已选对象，或直接点击地面。',drag:'拖动面板',manual:'按 XYZ 创建',pickAPlace:'在地图中选择位置',placeConfirm:'左键单击放置',placementActive:'活动工具',floorOnly:'仅允许水平地面，不允许墙壁和天花板。',zoneSize:'区域体积',spawnsHint:'出生点网格 · 选择平坦宽敞的地面。',toolsHint:'选择工具后指定创建位置。',checkMap:'地图检查',clickMap:'单击地图表面',objectCount:'对象'},
 pt:{position:'Posição no mapa',placeInMap:'Colocar no mapa',pickMap:'Escolher posição',pickHelp:'Clique no chão do mapa para copiar as coordenadas.',paintHelp:'Clique no chão para criar diretamente. Esc cancela.',repeat:'Colocação contínua',cancel:'Cancelar ferramenta',ready:'Pronto para colocar',pickDone:'Posição escolhida',placed:'Objetos criados',invalid:'Não foi possível colocar. Confira os valores.',modeBlocked:'Use o perfil CS 1.6 no editor MAP.',preview:'Prévia 3D',selectedHint:'Use o objeto selecionado ou clique diretamente no chão.',drag:'Arrastar painel',manual:'Criar no XYZ',pickAPlace:'Escolha um lugar no mapa',placeConfirm:'Clique esquerdo para colocar',placementActive:'Ferramenta ativa',floorOnly:'Apenas pisos horizontais; paredes e tetos não são válidos.',zoneSize:'Volume da zona',spawnsHint:'Grade de spawns · piso plano com espaço suficiente.',toolsHint:'Escolha uma ferramenta e a posição no mapa.',checkMap:'Verificação do mapa',clickMap:'Clique na superfície do mapa',objectCount:'objetos'}
};


const HF32:Record<string,{tab:string;all:string;ct:string;t:string;bomb:string;buy:string;rescue:string;hostage:string;weapon:string;
 search:string;empty:string;select:string;focus:string;selectGroup:string;count:string;linked:string;locked:string;
 shortcut:string;auto:string;markers:string;selected:string;missing:string;solid:string;zone:string;limit:string}>={
 es:{tab:'Administrar',all:'Todos',ct:'Spawns CT',t:'Spawns TT',bomb:'Bombsites',buy:'Zonas de compra',rescue:'Rescate',hostage:'Rehenes',weapon:'Armas',search:'Filtrar por nombre o clase...',empty:'No hay entidades de este tipo.',select:'Seleccionar',focus:'Enfocar',selectGroup:'Seleccionar grupo',count:'entidades',linked:'Incluye el brush vinculado',locked:'Oculto o bloqueado',shortcut:'Usá G para mover, R para rotar y C para escalar con las herramientas existentes.',auto:'Las posiciones se actualizan al mover objetos en 3D.',markers:'Marcadores 3D',selected:'Selección actual',missing:'No hay objetos seleccionables.',solid:'Posible spawn dentro de un brush sólido (revisar en juego).',zone:'Zona de brush sin geometría vinculada.',limit:'La prueba de volumen usa límites aproximados; comprobar en CS 1.6.'},
 en:{tab:'Manage',all:'All',ct:'CT spawns',t:'T spawns',bomb:'Bombsites',buy:'Buy zones',rescue:'Rescue',hostage:'Hostages',weapon:'Weapons',search:'Filter by name or class...',empty:'No entities of this type.',select:'Select',focus:'Frame',selectGroup:'Select group',count:'entities',linked:'Includes linked brush',locked:'Hidden or locked',shortcut:'Use the existing G move, R rotate and C scale tools.',auto:'Positions update when objects move in the 3D editor.',markers:'3D markers',selected:'Current selection',missing:'No selectable objects.',solid:'Possible spawn inside a solid brush (verify in game).',zone:'Brush zone has no linked geometry.',limit:'Volume checks use approximate bounds; verify in CS 1.6.'},
 ru:{tab:'Управление',all:'Все',ct:'Точки CT',t:'Точки T',bomb:'Точки бомбы',buy:'Зоны покупки',rescue:'Спасение',hostage:'Заложники',weapon:'Оружие',search:'Поиск по имени или классу...',empty:'Нет объектов этой категории.',select:'Выбрать',focus:'Показать',selectGroup:'Выбрать группу',count:'сущностей',linked:'Включая связанную кисть',locked:'Скрыт или заблокирован',shortcut:'Используйте существующие G (двигать), R (вращать), C (масштаб).',auto:'Координаты обновляются при перемещении в 3D.',markers:'Маркеры 3D',selected:'Текущее выделение',missing:'Нет доступных объектов.',solid:'Возможно, точка внутри твёрдой кисти; проверьте в игре.',zone:'Зона не имеет связанной кисти.',limit:'Проверка объёмов приблизительна; проверьте CS 1.6.'},
 ko:{tab:'관리',all:'전체',ct:'CT 스폰',t:'T 스폰',bomb:'폭탄 구역',buy:'구매 구역',rescue:'구출',hostage:'인질',weapon:'무기',search:'이름 또는 클래스 검색...',empty:'해당 유형의 엔티티가 없습니다.',select:'선택',focus:'카메라 이동',selectGroup:'그룹 선택',count:'엔티티',linked:'연결된 브러시 포함',locked:'숨김 또는 잠금',shortcut:'기존 G 이동, R 회전, C 크기 조절 도구를 사용하세요.',auto:'3D에서 이동하면 좌표가 자동 갱신됩니다.',markers:'3D 마커',selected:'현재 선택',missing:'선택 가능한 오브젝트가 없습니다.',solid:'스폰이 솔리드 브러시 내부에 있을 수 있음 (게임 확인).',zone:'연결된 브러시가 없는 구역입니다.',limit:'바운딩 검사 결과는 근사치입니다. CS 1.6에서 확인하세요.'},
 zh:{tab:'管理',all:'全部',ct:'CT 出生点',t:'T 出生点',bomb:'爆破区',buy:'购买区',rescue:'营救区',hostage:'人质',weapon:'武器',search:'按名称或类别筛选...',empty:'没有此类实体。',select:'选择',focus:'聚焦',selectGroup:'选择同组',count:'实体',linked:'包含关联笔刷',locked:'已隐藏或锁定',shortcut:'使用原有 G 移动、R 旋转、C 缩放工具。',auto:'在 3D 中移动后，坐标自动更新。',markers:'3D 标记',selected:'当前选择',missing:'没有可选择的对象。',solid:'出生点可能位于实体笔刷内部（请在游戏内确认）。',zone:'区域缺少关联笔刷。',limit:'体积检查仅为近似，需在 CS 1.6 验证。'},
 pt:{tab:'Gerenciar',all:'Todos',ct:'Spawns CT',t:'Spawns TR',bomb:'Bombsites',buy:'Zonas de compra',rescue:'Resgate',hostage:'Reféns',weapon:'Armas',search:'Filtrar por nome ou classe...',empty:'Nenhuma entidade deste tipo.',select:'Selecionar',focus:'Enquadrar',selectGroup:'Selecionar grupo',count:'entidades',linked:'Inclui o brush associado',locked:'Oculto ou bloqueado',shortcut:'Use as ferramentas existentes: G mover, R girar e C escalar.',auto:'As posições atualizam ao mover objetos no 3D.',markers:'Marcadores 3D',selected:'Seleção atual',missing:'Nenhum objeto selecionável.',solid:'Possível spawn dentro de brush sólido (verifique no jogo).',zone:'Zona sem brush associado.',limit:'Verificação volumétrica aproximada; confirme no CS 1.6.'}
};
const HF32_FACING:Record<string,{title:string;help:string;keyboard:string}>={
 es:{title:'Dirección de mirada',help:'Girás los spawns, armas y rehenes antes de colocarlos.',keyboard:'Durante la colocación: R gira 45°, Shift+R gira 15°. La flecha muestra la dirección.'},
 en:{title:'Facing direction',help:'Orient spawns, weapons and hostages before placement.',keyboard:'During placement: R turns 45°, Shift+R turns 15°. The arrow shows the direction.'},
 ru:{title:'Направление взгляда',help:'Направление точек появления, оружия и заложников.',keyboard:'При размещении: R — 45°, Shift+R — 15°. Стрелка показывает направление.'},
 ko:{title:'바라보는 방향',help:'배치 전 스폰, 무기, 인질의 방향을 설정합니다.',keyboard:'배치 중 R: 45° 회전, Shift+R: 15°. 화살표가 방향을 표시합니다.'},
 zh:{title:'朝向',help:'放置前设置出生点、武器与人质的方向。',keyboard:'放置时 R 旋转 45°，Shift+R 旋转 15°。箭头表示朝向。'},
 pt:{title:'Direção de visão',help:'Oriente spawns, armas e reféns antes de posicionar.',keyboard:'Durante a colocação: R gira 45°, Shift+R gira 15°. A seta mostra a direção.'}
};
const HF32_GROUPS:readonly (CS16ObjectGroup|'all')[]=['all','ct','t','bomb','buy','rescue','hostage','weapon'];

export function CSMapStudio({onClose,bspMode,walkMode,onDoctor}:{onClose:()=>void;bspMode:boolean;walkMode:boolean;onDoctor:()=>void}){
 const locale=useEditor(s=>s.locale),words=WORDS[locale]||WORDS.en,nw=NEW_WORDS[locale]||NEW_WORDS.en,iw=HF32[locale]||HF32.en,fw=HF32_FACING[locale]||HF32_FACING.en;
 const settings=useEditor(s=>s.settings),project=useEditor(s=>s.project),selected=useEditor(s=>s.selected),selectedIds=useEditor(s=>s.selectedIds),selectObjectIds=useEditor(s=>s.selectObjectIds),addObjects=useEditor(s=>s.addObjects);
 const request=useCSMapPlacement(s=>s.request),hover=useCSMapPlacement(s=>s.hover),picked=useCSMapPlacement(s=>s.picked),feedback=useCSMapPlacement(s=>s.feedback);
 const arm=useCSMapPlacement(s=>s.arm),cancel=useCSMapPlacement(s=>s.cancel);
 const [mode,setMode]=useState<CS16MapKind>(()=>cs16ModeFromMapName(settings.mapName));
 const [section,setSection]=useState<'spawns'|'objectives'|'equipment'|'manage'|'builder'|'audit'>('spawns');
 const [groupFilter,setGroupFilter]=useState<CS16ObjectGroup|'all'>('all'),[search,setSearch]=useState('');
 const studioVisible=useCSMapPlacement(s=>s.studioOpen),showMarkers=useCSMapPlacement(s=>s.showMarkers);
 const setStudioOpen=useCSMapPlacement(s=>s.setStudioOpen),setShowMarkers=useCSMapPlacement(s=>s.setShowMarkers);
 const [equipmentTool,setEquipmentTool]=useState<'armoury'|'hostages'>('armoury');
 const [team,setTeam]=useState<CS16Team>('ct'),[quantity,setQuantity]=useState(8);
 const [columns,setColumns]=useState(4),[spacing,setSpacing]=useState(80),[yaw,setYaw]=useState(180);
 const [coords,setCoords]=useState<Vec3>([0,0,64]),[zoneKind,setZoneKind]=useState<CS16ZoneKind>('bomb_a');
 const [size,setSize]=useState<Vec3>([256,256,96]),[armoury,setArmoury]=useState('4'),[weaponCount,setWeaponCount]=useState(1);
 const [hostageCount,setHostageCount]=useState(4),[repeat,setRepeat]=useState(false),[info,setInfo]=useState('');
 const [offset,setOffset]=useState({x:0,y:0});
 const drag=useRef<{x:number;y:number;ox:number;oy:number;rect:DOMRect}|null>(null);
 const usable=cs16CanApply(settings.gameProfile,bspMode,walkMode);
 const activeTool:CS16PlacementTool=section==='spawns'?'spawns':section==='objectives'?'zone':equipmentTool;
 useEffect(()=>{setStudioOpen(true);return()=>{useCSMapPlacement.getState().cancel();useCSMapPlacement.getState().setStudioOpen(false)}},[setStudioOpen]);
 useEffect(()=>{if(!usable)cancel()},[usable,cancel]);
 useEffect(()=>{if(picked){setCoords([...picked.at]);setInfo(`${nw.pickDone}: ${picked.at.join(' / ')}`)}},[picked?.seq]);
 useEffect(()=>{if(request?.action==='paint'&&request.tool!=='zone')setYaw(request.yaw)},[request?.yaw,request?.action,request?.tool]);
 const modify=()=>{if(request)cancel()};
 const updateYaw=(value:number)=>{if(!Number.isFinite(value))return;const angle=cs16NormalizeYaw(value);setYaw(angle);
  const current=useCSMapPlacement.getState().request;
  if(current&&current.action==='paint'&&current.tool!=='zone')arm({...current,yaw:angle});
 };
 const rotateYaw=(delta:number)=>updateYaw(yaw+delta);
 const updateCoord=(index:number,value:number)=>{modify();setCoords(prev=>prev.map((v,i)=>i===index?value:v) as Vec3)};
 const updateSize=(index:number,value:number)=>{modify();setSize(prev=>prev.map((v,i)=>i===index?value:v) as Vec3)};
 const setTab=(tab:typeof section)=>{cancel();setSection(tab);setInfo('')};
 const fromSelection=()=>{
  const o=project.objects.find(o=>o.id===selected);
  if(!o){setInfo(words.noSelection);return}
  const origin:Vec3=o.kind==='brush'?[o.position[0],o.position[1],Math.max(...transformedVertices(o).map(v=>v[2]))]:[...o.position];
  const at=o.kind==='brush'?cs16AnchorAtSurface(origin,[0,0,1],activeTool,useEditor.getState().snapping?useEditor.getState().snap:1):origin;
  if(!at){setInfo(nw.invalid);return}
  cancel();setCoords(at);setInfo(`${nw.pickDone}: ${at.join(' / ')}`);
 };
 const buildRequest=(action:CS16PlacementAction,tool:CS16PlacementTool=activeTool):CS16PlacementRequest=>({
  action,tool,repeat:action==='paint'&&repeat,team,quantity,columns,spacing,yaw,zoneKind,size:[...size],armoury,weaponCount,hostageCount
 });
 const startPlacement=(action:CS16PlacementAction,tool:CS16PlacementTool=activeTool)=>{
  if(!usable){setInfo(nw.modeBlocked);return}
  if(!Number.isFinite(quantity)||!Number.isFinite(columns)||!Number.isFinite(spacing)||size.some(v=>!Number.isFinite(v))){setInfo(nw.invalid);return}
  const editor=useEditor.getState();
  if(editor.hasPendingPlacement())editor.cancelPendingPlacement();
  arm(buildRequest(action,tool));setInfo('');
 };
 const apply=(make:()=>MapObject[])=>{
  cancel();if(!usable){setInfo(words.onlyCS);return}
  try{const objects=make();cs16ApplyBatch(project.objects,objects);addObjects(objects);setInfo(`${objects.length} · ${words.added}`)}
  catch(e){setInfo(`${words.failed} ${ERROR_LABELS[locale]?.[String(e instanceof Error?e.message:e)]??String(e instanceof Error?e.message:e)}`)}
 };
 const manual=()=>{
  if(activeTool==='spawns')apply(()=>cs16Spawns(team,quantity,coords,spacing,columns,yaw));
  else if(activeTool==='zone')apply(()=>cs16Zone(zoneKind,coords,size));
  else if(activeTool==='armoury')apply(()=>[cs16Armoury(coords,armoury,weaponCount,yaw)]);
  else apply(()=>cs16Hostages(hostageCount,coords,72,yaw));
 };
 const inventory=cs16Inventory(project.objects);
 const listed=inventory.filter(item=>(groupFilter==='all'||item.group===groupFilter)&&
   (!search.trim()||`${item.label} ${item.classname} ${item.position.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())));
 const selectItems=(group:CS16ObjectGroup|'all'|'single',id?:string,focus=false)=>{
  if(!usable)return;
  cancel();const ids=cs16SelectionIds(inventory,group,id);
  if(ids.length)selectObjectIds(ids,focus);else setInfo(iw.missing);
 };
 const spatialWarnings=inspectCS16Layout(project,mode),compatWarnings=inspectCS16Project(project),advancedWarnings=inspectCS16Advanced(project.objects);
 const setTool=(tool:'armoury'|'hostages')=>{cancel();setEquipmentTool(tool);setInfo('')};
 const close=()=>{cancel();onClose()};
 const onDragStart=(e:import('react').PointerEvent<HTMLElement>)=>{
  if(e.button!==0||(e.target as HTMLElement).closest('button,select,input'))return;
  drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y,rect:e.currentTarget.parentElement!.getBoundingClientRect()};
  e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
 };
 const onDragMove=(e:import('react').PointerEvent<HTMLElement>)=>{
  const d=drag.current;if(!d)return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;
  setOffset({x:d.ox+Math.max(8-d.rect.left,Math.min(window.innerWidth-d.rect.right-8,dx)),
    y:d.oy+Math.max(8-d.rect.top,Math.min(window.innerHeight-d.rect.bottom-8,dy))});
 };
 const stopDrag=()=>{drag.current=null};
 const spawnCt=project.objects.filter(o=>o.kind==='entity'&&o.classname==='info_player_start').length;
 const spawnT=project.objects.filter(o=>o.kind==='entity'&&o.classname==='info_player_deathmatch').length;
 const buttons=<div className="cs31-actions">
  <button type="button" className="cs31-pick" disabled={!usable} onClick={()=>startPlacement('pick')}><Crosshair size={16}/>{nw.pickMap}</button>
  <button type="button" className="cs31-place" disabled={!usable} onClick={()=>startPlacement('paint')}><MousePointer2 size={16}/>{nw.placeInMap}</button>
  <button type="button" className="cs31-manual" disabled={!usable} onClick={manual}><Plus size={15}/>{nw.manual}</button>
 </div>;
 return <div className="cs31-shell">
  <section className="cs31-window" role="dialog" aria-modal="false" aria-label={words.title} style={{transform:`translate(${offset.x}px,${offset.y}px)`}}>
   <header className="cs31-header" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} title={nw.drag}>
    <div className="cs31-logo"><Shield size={22}/></div>
    <div className="cs31-title"><strong>CS MAP STUDIO <em>3.0</em></strong><small>Counter-Strike 1.6 <span>· GoldSrc</span></small></div>
    <div className="cs31-grip" title={nw.drag}><Move size={16}/></div>
    <button className="cs31-close" type="button" onClick={close} title={words.close}><X size={18}/></button>
   </header>
   <div className="cs31-intro"><div className="cs31-chip">CS 1.6</div><label>{words.mode}<select value={mode} onChange={e=>{cancel();setMode(e.target.value as CS16MapKind)}}>{(['de','cs','fy','aim'] as const).map(kind=><option key={kind} value={kind}>{kind}_ · {kind==='de'?'Defuse':kind==='cs'?'Hostage':kind==='fy'?'Fight Yard':'Aim'}</option>)}</select></label><small>{nw.drag} <Move size={12}/></small></div>
   <div className="cs31-scoreboard" aria-label={nw.checkMap}>
    <button type="button" className="cs31-team ct" disabled={!usable||!spawnCt} title={iw.selectGroup} onClick={()=>selectItems('ct')}><Shield size={15}/> CT <b>{spawnCt}</b></button><span className="cs31-score-center"><Target size={14}/>{project.objects.length} {nw.objectCount}</span><button type="button" className="cs31-team tt" disabled={!usable||!spawnT} title={iw.selectGroup} onClick={()=>selectItems('t')}>T <b>{spawnT}</b><Flag size={15}/></button>
   </div>
   <nav className="cs31-tabs" aria-label={words.title}>
    {([{id:'spawns',Icon:MapPin,label:words.spawns},{id:'objectives',Icon:Flag,label:words.objectives},{id:'equipment',Icon:Package,label:words.equipment},{id:'manage',Icon:Layers3,label:iw.tab},{id:'builder',Icon:Layers3,label:({es:'Construir',en:'Build',ru:'Создать',ko:'생성',zh:'构建',pt:'Construir'} as Record<string,string>)[locale]},{id:'audit',Icon:CheckCircle2,label:words.audit}] as const).map(t=><button type="button" key={t.id} className={section===t.id?'active':''} aria-pressed={section===t.id} title={t.label} onClick={()=>setTab(t.id)}><t.Icon size={17}/><span>{t.label}</span></button>)}
   </nav>
   <div className="cs31-body">
    {section!=='audit'&&section!=='manage'&&section!=='builder'&&<>
     <div className="cs31-section-heading"><span className="cs31-step">01</span><div><strong>{section==='spawns'?words.spawns:section==='objectives'?words.objectives:words.equipment}</strong><small>{nw.toolsHint}</small></div></div>
     {section==='spawns'&&<>
      <div className="cs31-team-pick"><button type="button" className={team==='ct'?'active ct':''} onClick={()=>{modify();setTeam('ct')}}><Shield size={18}/> CT</button><button type="button" className={team==='t'?'active tt':''} onClick={()=>{modify();setTeam('t')}}><Flag size={18}/> TT</button></div>
      <div className="cs31-grid2"><label>{words.count}<input type="number" min={1} max={32} value={quantity} onChange={e=>{modify();setQuantity(e.target.valueAsNumber)}}/></label><label>{words.columns}<input type="number" min={1} max={8} value={columns} onChange={e=>{modify();setColumns(e.target.valueAsNumber)}}/></label><label>{words.spacing}<input type="number" min={64} max={512} step={8} value={spacing} onChange={e=>{modify();setSpacing(e.target.valueAsNumber)}}/></label></div>
      <p className="cs31-tip">{nw.spawnsHint}</p>
     </>}
     {section==='objectives'&&<><div className="cs31-zone-picker">{ZONES.map(z=><button type="button" key={z.id} className={zoneKind===z.id?'active':''} onClick={()=>{modify();setZoneKind(z.id)}}><span>{z.id==='bomb_a'?'A':z.id==='bomb_b'?'B':z.id==='rescue'?'H':z.id==='buy_ct'?'CT':'T'}</span>{z.label}</button>)}</div><p className="cs31-tip">{words.zoneTip}</p><div className="cs31-grid3">{([words.width,words.depth,words.height] as const).map((name,i)=><label key={i}>{name}<input type="number" min={32} max={i===2?512:2048} step={16} value={size[i]} onChange={e=>updateSize(i,e.target.valueAsNumber)}/></label>)}</div></>}
     {section==='equipment'&&<><div className="cs31-team-pick"><button type="button" className={equipmentTool==='armoury'?'active':''} onClick={()=>setTool('armoury')}><Package size={16}/>{words.weapon}</button><button type="button" className={equipmentTool==='hostages'?'active':''} onClick={()=>setTool('hostages')}><Shield size={16}/>{words.hostages}</button></div>{equipmentTool==='armoury'?<div className="cs31-grid2"><label>{words.weapon}<select value={armoury} onChange={e=>{modify();setArmoury(e.target.value)}}>{CS16_ARMOURY_ITEMS.map(w=><option value={w.value} key={w.value}>{w.name}</option>)}</select></label><label>{words.count}<input type="number" min={1} max={32} value={weaponCount} onChange={e=>{modify();setWeaponCount(e.target.valueAsNumber)}}/></label></div>:<div className="cs31-grid2"><label>{words.hostages}<input type="number" min={1} max={8} value={hostageCount} onChange={e=>{modify();setHostageCount(e.target.valueAsNumber)}}/></label></div>}</>}
     {activeTool!=='zone'&&<div className="cs32-facing">
      <div className="cs31-section-heading"><span className="cs31-step"><Target size={16}/></span><div><strong>{fw.title}</strong><small>{fw.help}</small></div></div>
      <div className="cs32-facing-grid">
       <div className="cs32-facing-compass" role="group" aria-label={fw.title}>
        {([0,90,180,270] as const).map(a=><button type="button" key={a} className={yaw===a?'active':''} aria-pressed={yaw===a} onClick={()=>updateYaw(a)} title={`${a}°`} style={{left:`${50+36*Math.cos(a*Math.PI/180)}%`,top:`${50-36*Math.sin(a*Math.PI/180)}%`}}>{a}°</button>)}
        <span className="cs32-facing-arrow" style={{transform:`translate(-50%,-50%) rotate(${-yaw}deg)`}}><ArrowRight size={22}/></span>
       </div>
       <div className="cs32-facing-inputs">
        <label>{words.yaw}<input type="number" min={0} max={359} step={1} value={Number.isFinite(yaw)?yaw:0} onChange={e=>updateYaw(e.target.valueAsNumber)}/></label>
        <input type="range" aria-label={fw.title} min="0" max="359" step="1" value={yaw} onChange={e=>updateYaw(Number(e.target.value))}/>
        <div className="cs32-facing-turn"><button type="button" onClick={()=>rotateYaw(-45)} title="-45°"><RotateCcw size={15}/>-45°</button><button type="button" onClick={()=>rotateYaw(45)} title="+45°"><RotateCcw size={15} style={{transform:'scaleX(-1)'}}/>+45°</button></div>
       </div>
      </div>
      <small className="cs31-tip">{fw.keyboard}</small>
     </div>}
     <div className="cs31-position">
      <div className="cs31-section-heading"><span className="cs31-step">02</span><div><strong>{nw.position}</strong><small>{nw.selectedHint}</small></div></div>
      <div className="cs31-grid3">{(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}<input type="number" value={Number.isFinite(coords[i])?coords[i]:''} onChange={e=>updateCoord(i,e.target.valueAsNumber)}/></label>)}</div>
      <button type="button" className="cs31-selection" onClick={fromSelection}><Navigation2 size={15}/>{words.selected}</button>
     </div>
     <label className="cs31-repeat"><input type="checkbox" checked={repeat} onChange={e=>{modify();setRepeat(e.target.checked)}}/><Repeat2 size={15}/>{nw.repeat}</label>
     {buttons}
     <small className="cs31-tip">{nw.floorOnly}</small>
    </>}
    {section==='builder'&&<CSMapHF33Builder locale={locale} mode={mode} usable={usable} bspMode={bspMode} walkMode={walkMode} onCancel={cancel}/>}
    {section==='manage'&&<>
     <div className="cs31-section-heading"><span className="cs31-step"><Layers3 size={16}/></span><div><strong>{iw.tab} · {inventory.length} {iw.count}</strong><small>{iw.shortcut}</small></div></div>
     <label className="cs32-marker-toggle"><input type="checkbox" checked={studioVisible&&showMarkers} onChange={e=>setShowMarkers(e.target.checked)}/><Eye size={15}/>{iw.markers}</label>
     <div className="cs32-filters" role="group" aria-label={iw.tab}>{HF32_GROUPS.map(group=>{
      const count=inventory.filter(item=>group==='all'||item.group===group).length;
      return <button type="button" key={group} className={groupFilter===group?'active':''} aria-pressed={groupFilter===group}
        onClick={()=>setGroupFilter(group)}>{iw[group]} <b>{count}</b></button>;
     })}</div>
     <label className="cs32-search"><Search size={15}/><input type="search" value={search} placeholder={iw.search} onChange={e=>setSearch(e.target.value)}/></label>
     <div className="cs32-group-row"><span>{listed.length} {iw.count} · {selectedIds.length} {iw.selected.toLowerCase()}</span><button type="button" disabled={!usable||!listed.some(item=>!item.hidden&&!item.locked)} onClick={()=>{
      const ids=new Set(listed.map(item=>item.id));const editable=inventory.filter(item=>ids.has(item.id));
      selectObjectIds(cs16SelectionIds(editable,'all'));cancel();
     }}><Layers3 size={14}/>{iw.selectGroup}</button></div>
     <div className="cs32-inventory" role="list">
      {listed.slice(0,160).map(item=>{
       const active=cs16ItemSelected(item,selectedIds),disabled=!usable||item.hidden||item.locked;
       return <div key={item.id} className={`cs32-item ${active?'selected':''}`} role="listitem">
        <span className={`cs32-pin cs32-pin-${item.group}`}/>
        <div className="cs32-item-body"><b title={item.label}>{item.label}</b><small>{item.classname} · {item.position.map(Math.round).join(' / ')}</small>{item.brushIds.length>0&&<small>{iw.linked} ({item.brushIds.length})</small>}</div>
        <button type="button" disabled={disabled} title={disabled?iw.locked:iw.select} aria-label={`${iw.select} ${item.label}`} onClick={()=>selectItems('single',item.id)}><MousePointer2 size={15}/></button>
        <button type="button" disabled={disabled} title={disabled?iw.locked:iw.focus} aria-label={`${iw.focus} ${item.label}`} onClick={()=>selectItems('single',item.id,true)}><Focus size={15}/></button>
       </div>;
      })}
      {!listed.length&&<p className="cs31-tip">{iw.empty}</p>}
      {listed.length>160&&<p className="cs31-tip">{listed.length-160} + · {iw.search}</p>}
     </div>
     <p className="cs31-tip">{iw.auto}</p>
    </>}
    {section==='audit'&&<CSMapHF33Audit locale={locale} mapName={settings.mapName||''} mode={mode}/>}
    {!usable&&<p className="cs31-alert"><AlertTriangle size={15}/>{nw.modeBlocked}</p>}
    {info&&<p className="cs31-status" role="status">{info}</p>}
    {feedback&&<p className="cs31-status" role="status">{feedback.key==='placed'?`${nw.placed}: ${feedback.count}`:feedback.key==='profile'?nw.modeBlocked:nw.invalid}</p>}
   </div>
   <footer className="cs31-footer">
    {request?<><div className="cs31-arm-status"><span className="cs31-pulse"/><div><b>{request.action==='pick'?nw.pickAPlace:nw.placementActive}</b><small>{request.action==='pick'?nw.pickHelp:nw.paintHelp}{hover?` · ${hover.map(Math.round).join(' / ')}`:''}</small></div></div><button type="button" onClick={cancel} title={nw.cancel}><RotateCcw size={17}/></button></>:<><span className="cs31-ready"><Eye size={14}/>{nw.preview}</span><small>{settings.mapName||'my_map'}.bsp</small></>}
   </footer>
  </section>
 </div>;
}
