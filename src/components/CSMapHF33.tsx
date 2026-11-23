import {useState} from 'react';
import {AlertTriangle,CheckCircle2,Focus,Layers3,PackagePlus,ShieldCheck,FileText} from 'lucide-react';
import {useEditor} from '../store';
import {useMapDoctorState} from '../mapDoctorState';
import {createCS16StarterArena,canCreateCS16Starter} from '../engine/csMapStarterHF33';
import {inspectCS16HF33,inspectCS16BuildLog} from '../engine/csMapDoctorHF33';
import {isRecoveredBspProject} from '../engine/recoveredBspPreview';
import {cs16ApplyBatch,inspectCS16Layout,cs16ModeFromMapName,type CS16MapKind} from '../engine/csMapStudio';
import {inspectCS16Project} from '../engine/gameProfiles';
import {inspectCS16Advanced,cs16Inventory,cs16SelectionIds} from '../engine/csMapIntegration';
import type {Vec3} from '../engine/types';

type HF33Words={builder:string,subtitle:string,empty:string,countCT:string,countT:string,center:string,texture:string,
 texturesHint:string,create:string,success:string,error:string,undo:string,mode:string,limits:string,doctor:string,
 preflight:string,build:string,noBuild:string,clean:string,caution:string,focus:string,findings:string,
 compatible:string,warning:string,info:string,invalid:string};
const W:Record<string,HF33Words>={
 es:{builder:'Constructor de mapas',subtitle:'Arena cerrada editable · usa los brushes y entidades existentes.',empty:'Por seguridad solo puede generar sobre un proyecto vacío. Guardá el mapa actual o creá uno nuevo.',countCT:'Spawns CT',countT:'Spawns TT',center:'Centro del suelo (XYZ)',texture:'Textura de un WAD del juego',texturesHint:'Elegí una textura real de un WAD cargado de CS 1.6/valve. El editor no copia archivos WAD al juego automáticamente.',create:'Crear escenario editable',success:'Escenario generado',error:'No se pudo generar',undo:'Todo en una sola operación Ctrl+Z.',mode:'Modo',limits:'Estructura de prueba: 2048 × 1280 × 352 unidades, suelo, techo, cobertura y luces. No garantiza equilibrio ni ausencia de leaks en mapas modificados.',doctor:'CS Map Doctor 2.0',preflight:'Comprobaciones preventivas (aproximadas)',build:'Diagnóstico del último registro ZHLT',noBuild:'No hay registro de compilación de este mapa. Compilá con ZHLT para detectar errores reales.',clean:'Sin problemas detectados por estas reglas.',caution:'Estos controles no simulan colisiones compiladas, rutas ni la ejecución del juego.',focus:'Seleccionar y enfocar',findings:'hallazgos',compatible:'Revisá la textura/WAD antes de compilar.',warning:'Advertencia',info:'Aviso',invalid:'Seleccioná una textura válida (1 a 15 caracteres).'},
 en:{builder:'Map Builder',subtitle:'Editable enclosed arena · uses existing brushes and entities.',empty:'For safety, generation is allowed only in an empty project. Save the current map or create a new one.',countCT:'CT spawns',countT:'T spawns',center:'Floor center (XYZ)',texture:'Texture from a game WAD',texturesHint:'Choose a real texture from a loaded CS 1.6/valve WAD. The editor does not automatically copy WAD files into the game.',create:'Generate editable arena',success:'Arena created',error:'Could not generate',undo:'One undo action (Ctrl+Z).',mode:'Mode',limits:'Test layout: 2048 × 1280 × 352 units, floor, ceiling, cover and lights. Does not guarantee balancing or leak-free edits.',doctor:'CS Map Doctor 2.0',preflight:'Preflight checks (approximate)',build:'Last ZHLT log diagnostics',noBuild:'No compilation log for this map. Compile with ZHLT to inspect real errors.',clean:'No findings under these checks.',caution:'These checks do not simulate compiled collisions, routes, or gameplay.',focus:'Select and focus',findings:'findings',compatible:'Verify texture/WAD before compiling.',warning:'Warning',info:'Notice',invalid:'Select a valid texture name (1–15 characters).'},
 ru:{builder:'Конструктор карт',subtitle:'Редактируемая закрытая арена с существующими брашами и сущностями.',empty:'Генерация разрешена только на пустой карте. Сохраните текущую или создайте новую.',countCT:'Точки CT',countT:'Точки T',center:'Центр пола (XYZ)',texture:'Текстура из WAD игры',texturesHint:'Выберите текстуру из загруженного WAD CS 1.6/valve. WAD не копируются в игру автоматически.',create:'Создать арену',success:'Арена создана',error:'Ошибка создания',undo:'Одно действие отмены (Ctrl+Z).',mode:'Режим',limits:'Тестовая арена 2048 × 1280 × 352: пол, потолок, укрытия и свет. Баланс и отсутствие утечек не гарантируются.',doctor:'CS Map Doctor 2.0',preflight:'Предварительные проверки (приблизительно)',build:'Последний журнал ZHLT',noBuild:'Нет журнала компиляции карты. Запустите ZHLT для диагностики.',clean:'Проблемы не обнаружены.',caution:'Не заменяет проверку коллизий, маршрутов или игры.',focus:'Выбрать и найти',findings:'замечаний',compatible:'Проверьте текстуру и WAD перед сборкой.',warning:'Предупреждение',info:'Информация',invalid:'Имя текстуры: 1–15 допустимых символов.'},
 ko:{builder:'맵 빌더',subtitle:'기존 브러시와 엔티티를 활용한 편집 가능한 폐쇄형 경기장.',empty:'안전을 위해 빈 프로젝트에서만 생성합니다. 현재 맵을 저장하거나 새 프로젝트를 만드세요.',countCT:'CT 스폰',countT:'T 스폰',center:'바닥 중심 (XYZ)',texture:'게임 WAD 텍스처',texturesHint:'로드된 CS 1.6/valve WAD의 텍스처를 고르세요. WAD 파일은 게임에 자동 복사되지 않습니다.',create:'편집 가능한 경기장 생성',success:'경기장 생성됨',error:'생성 실패',undo:'한 번의 Ctrl+Z로 취소.',mode:'모드',limits:'시험용 2048 × 1280 × 352 경기장: 바닥, 천장, 엄폐물, 조명. 밸런스나 누출 방지를 보장하지 않습니다.',doctor:'CS Map Doctor 2.0',preflight:'사전 점검 (근사치)',build:'최신 ZHLT 로그 진단',noBuild:'이 맵의 컴파일 로그가 없습니다. 실제 오류는 ZHLT 컴파일 후 확인하세요.',clean:'점검 결과 문제가 없습니다.',caution:'컴파일된 충돌, 경로, 게임 실행은 시뮬레이션하지 않습니다.',focus:'선택 및 초점',findings:'점검 결과',compatible:'컴파일 전 텍스처/WAD를 확인하세요.',warning:'경고',info:'안내',invalid:'올바른 텍스처 이름을 입력하세요 (1~15자).'},
 zh:{builder:'地图构建器',subtitle:'可编辑的封闭场地，复用已有笔刷和实体。',empty:'为防止覆盖，仅允许在空项目中生成。请先保存当前地图或创建新项目。',countCT:'CT 出生点',countT:'T 出生点',center:'地面中心 (XYZ)',texture:'游戏 WAD 纹理',texturesHint:'请选择已加载的 CS 1.6/valve WAD 纹理。编辑器不会自动复制 WAD 到游戏。',create:'生成可编辑场地',success:'场地已生成',error:'生成失败',undo:'可通过一次 Ctrl+Z 撤销。',mode:'模式',limits:'测试场地 2048 × 1280 × 352：地面、天花板、掩体和灯光。不保证平衡或修改后无泄漏。',doctor:'CS Map Doctor 2.0',preflight:'编译前检查（估算）',build:'最近一次 ZHLT 日志诊断',noBuild:'没有此地图的编译日志。使用 ZHLT 编译以检查实际错误。',clean:'这些检查未发现问题。',caution:'不能代替编译后的碰撞、路线和游戏测试。',focus:'选择并聚焦',findings:'项结果',compatible:'编译前请确认纹理/WAD。',warning:'警告',info:'提示',invalid:'请输入有效纹理名（1–15 个字符）。'},
 pt:{builder:'Construtor de mapas',subtitle:'Arena fechada e editável, reutilizando brushes e entidades.',empty:'Por segurança, só é possível gerar em um projeto vazio. Salve o mapa atual ou crie outro.',countCT:'Spawns CT',countT:'Spawns TR',center:'Centro do piso (XYZ)',texture:'Textura de um WAD do jogo',texturesHint:'Escolha uma textura de um WAD carregado do CS 1.6/valve. O editor não copia WADs automaticamente para o jogo.',create:'Gerar arena editável',success:'Arena criada',error:'Falha ao gerar',undo:'Uma única ação Ctrl+Z.',mode:'Modo',limits:'Cenário de teste: 2048 × 1280 × 352 unidades, piso, teto, cobertura e luzes. Não garante equilíbrio nem ausência de vazamentos após alterações.',doctor:'CS Map Doctor 2.0',preflight:'Verificações preventivas (aproximadas)',build:'Diagnóstico do último registro ZHLT',noBuild:'Não há registro de compilação deste mapa. Compile com ZHLT para encontrar erros reais.',clean:'Nenhum problema encontrado nestas verificações.',caution:'Não simula colisões compiladas, rotas nem a jogabilidade.',focus:'Selecionar e focar',findings:'ocorrências',compatible:'Confira a textura/WAD antes de compilar.',warning:'Aviso',info:'Informação',invalid:'Informe uma textura válida (1 a 15 caracteres).'}
};
const ISSUE_LABELS:Record<string,Record<string,string>>={
 SPAWNS_FEW:{es:'Pocos spawns para este equipo (se recomiendan al menos 10; 16 por equipo para servidores de 32).',en:'Few spawns for this team (at least 10 recommended; 16 per team for 32-player servers).',ru:'Мало спавнов для команды (рекомендуется не менее 10; 16 для серверов на 32 игрока).',ko:'이 팀의 스폰이 적습니다(최소 10개 권장, 32인 서버는 팀당 16개).',zh:'该队出生点过少（建议至少 10 个；32 人服务器每队 16 个）。',pt:'Poucos spawns para este time (recomenda-se ao menos 10; 16 por time em servidores de 32).'},
 SPAWN_OUTSIDE_BUYZONE:{es:'Spawn fuera de la zona de compra de su equipo: los jugadores no podrán comprar al aparecer.',en:'Spawn outside its team buy zone: players cannot buy right after spawning.',ru:'Спавн вне зоны закупки своей команды: игроки не смогут купить оружие сразу.',ko:'팀 구매 구역 밖의 스폰입니다. 스폰 직후 구매할 수 없습니다.',zh:'出生点不在本队购买区内：玩家出生后无法购买。',pt:'Spawn fora da zona de compra do time: os jogadores não poderão comprar ao nascer.'},
 BSP_LIMIT_NEAR:{es:'El BSP compilado está cerca de un límite del GoldSrc clásico; revisá el registro (BSP limit).',en:'The compiled BSP is close to a classic GoldSrc limit; see the log (BSP limit).',ru:'Скомпилированный BSP близок к лимиту GoldSrc; см. журнал (BSP limit).',ko:'컴파일된 BSP가 GoldSrc 한도에 가깝습니다. 로그(BSP limit)를 확인하세요.',zh:'编译后的 BSP 接近经典 GoldSrc 上限；请查看日志（BSP limit）。',pt:'O BSP compilado está perto de um limite do GoldSrc clássico; veja o registro (BSP limit).'},
 NO_WORLD_BRUSHES:{es:'No hay geometría worldspawn.',en:'No world geometry.',ru:'Нет геометрии мира.',ko:'월드 지오메트리가 없습니다.',zh:'缺少世界几何体。',pt:'Não há geometria worldspawn.'},
 ENTITY_VOLUME:{es:'Revisá el número de entidades y límites del BSP.',en:'Review entity count and BSP limits.',ru:'Проверьте число сущностей и лимиты BSP.',ko:'엔티티 수 및 BSP 제한을 확인하세요.',zh:'检查实体数量和 BSP 限制。',pt:'Revise a quantidade de entidades e limites BSP.'},
 BRUSH_FACE_LIMIT:{es:'Brush con más de 32 caras; dividilo.',en:'Brush with over 32 faces; split it.',ru:'У браша более 32 граней; разделите его.',ko:'브러시 면이 32개를 초과합니다. 나누세요.',zh:'笔刷超过 32 个面；请拆分。',pt:'Brush com mais de 32 faces; divida-o.'},
 MIXED_SKY:{es:'Un mismo brush mezcla SKY con otras texturas.',en:'One brush mixes SKY with other textures.',ru:'Браш смешивает SKY с другими текстурами.',ko:'한 브러시에 SKY와 다른 텍스처가 섞여 있습니다.',zh:'同一笔刷混用了 SKY 和其他纹理。',pt:'Um brush mistura SKY com outras texturas.'},
 SPAWN_SOLID_HULL:{es:'Posible intersección entre el volumen del jugador y un sólido.',en:'Possible player hull intersection with a solid.',ru:'Возможное пересечение игрока с твёрдой геометрией.',ko:'플레이어 충돌 범위가 고체와 겹칠 수 있습니다.',zh:'玩家碰撞体可能与实体几何相交。',pt:'Possível interseção do jogador com um sólido.'},
 SPAWN_NO_FLOOR:{es:'Posible falta de suelo bajo este spawn (estimación del MAP, no del BSP compilado).',en:'Possible missing floor below this spawn (MAP estimate, not compiled BSP collision).',ru:'Возможно, под спавном нет пола (оценка MAP, а не коллизий BSP).',ko:'스폰 아래 바닥이 없을 수 있습니다(MAP 추정값이며 컴파일된 BSP 충돌이 아님).',zh:'出生点下方可能缺少地面（仅 MAP 估算，非已编译 BSP 碰撞）。',pt:'Possível falta de piso sob este spawn (estimativa do MAP, não do BSP compilado).'},
 BRUSH_ORPHAN:{es:'Brush enlazado a una entidad inexistente.',en:'Brush references a missing entity.',ru:'Браш ссылается на отсутствующую сущность.',ko:'존재하지 않는 엔티티를 참조하는 브러시입니다.',zh:'笔刷关联了不存在的实体。',pt:'Brush vinculado a uma entidade inexistente.'},
 ZONE_TEXTURE:{es:'La zona vinculada no usa AAATRIGGER en todas sus caras.',en:'Linked zone does not use AAATRIGGER on every face.',ru:'Не все грани зоны имеют AAATRIGGER.',ko:'영역의 모든 면이 AAATRIGGER가 아닙니다.',zh:'关联区域并非所有面都使用 AAATRIGGER。',pt:'A zona não usa AAATRIGGER em todas as faces.'},
 NO_LIGHTS:{es:'No hay entidades de iluminación; revisá la visibilidad del mapa.',en:'No light entities; review in-game visibility.',ru:'Нет источников света; проверьте карту в игре.',ko:'조명 엔티티가 없습니다. 게임에서 확인하세요.',zh:'缺少光源实体；请在游戏中检查。',pt:'Não há entidades de luz; confira no jogo.'},
 TEXTURE_NOT_LOADED:{es:'Textura ausente del catálogo WAD cargado (puede existir en disco).',en:'Texture not in loaded WAD catalogue (may exist on disk).',ru:'Текстуры нет в загруженных WAD (возможна на диске).',ko:'로드된 WAD 목록에 없습니다 (디스크에는 있을 수 있음).',zh:'已加载 WAD 中没有该纹理（磁盘上可能存在）。',pt:'Textura ausente dos WAD carregados (pode existir no disco).'},
 BSP_LEAK:{es:'El compilador detectó un leak; revisá el pointfile.',en:'Compiler detected a leak; inspect the pointfile.',ru:'Компилятор обнаружил утечку; проверьте pointfile.',ko:'컴파일러 누출 감지. 포인트 파일을 확인하세요.',zh:'编译器检测到泄漏；检查点文件。',pt:'Compilador detectou vazamento; confira o pointfile.'},
 LEAK_REPORTED:{es:'El registro informa un leak; revisá el pointfile.',en:'Log reports a leak; inspect the pointfile.',ru:'Журнал сообщает об утечке; проверьте pointfile.',ko:'로그에 누출이 보고되었습니다.',zh:'日志报告泄漏；检查点文件。',pt:'O registro indica vazamento; confira o pointfile.'},
 INVALID_BRUSH:{es:'ZHLT informa un brush inválido.',en:'ZHLT reports invalid brush geometry.',ru:'ZHLT обнаружил ошибку геометрии браша.',ko:'ZHLT가 잘못된 브러시를 보고했습니다.',zh:'ZHLT 报告笔刷几何无效。',pt:'ZHLT indicou geometria de brush inválida.'},
 INVALID_GEOMETRY:{es:'El registro informa geometría inválida.',en:'Log reports invalid geometry.',ru:'Журнал сообщает об ошибке геометрии.',ko:'로그에 잘못된 지오메트리가 보고되었습니다.',zh:'日志报告几何无效。',pt:'O registro indica geometria inválida.'},
 MIXED_CONTENTS:{es:'Un brush mezcla materiales incompatibles (agua, SKY, CLIP...).',en:'Brush mixes incompatible contents (water, SKY, CLIP...).',ru:'Браш смешивает несовместимые материалы.',ko:'브러시에 호환되지 않는 재질이 섞여 있습니다.',zh:'笔刷混用了不兼容的材质。',pt:'Brush mistura conteúdos incompatíveis.'},
 MISSING_TEXTURE:{es:'El compilador no encontró texturas o WAD.',en:'Compiler could not find textures or WADs.',ru:'Компилятор не нашёл текстуры или WAD.',ko:'컴파일러에서 텍스처/WAD를 찾지 못했습니다.',zh:'编译器无法找到纹理或 WAD。',pt:'Compilador não encontrou texturas ou WAD.'},
 WAD_MISSING:{es:'Revisá rutas WAD de CS 1.6 y valve.',en:'Check CS 1.6 and valve WAD paths.',ru:'Проверьте пути к WAD CS 1.6 и valve.',ko:'CS 1.6 및 valve WAD 경로를 확인하세요.',zh:'检查 CS 1.6 和 valve WAD 路径。',pt:'Verifique caminhos WAD do CS 1.6 e valve.'},
 ENGINE_LIMIT:{es:'Se alcanzó un límite GoldSrc/ZHLT.',en:'A GoldSrc/ZHLT limit was reported.',ru:'Достигнут лимит GoldSrc/ZHLT.',ko:'GoldSrc/ZHLT 제한에 도달했습니다.',zh:'触及 GoldSrc/ZHLT 限制。',pt:'Limite GoldSrc/ZHLT atingido.'},
 GOLDSRC_CAPACITY:{es:'ZHLT informa exceso de recursos; revisá el valor exacto.',en:'ZHLT reports a resource limit; review exact value.',ru:'ZHLT сообщает о превышении лимита ресурсов.',ko:'ZHLT 리소스 제한이 보고되었습니다.',zh:'ZHLT 报告资源超限；检查具体数值。',pt:'ZHLT indica limite de recursos; confira o valor.'},
 RAD_NO_PATCHES:{es:'RAD no creó parches de iluminación.',en:'RAD created no light patches.',ru:'RAD не создал патчи освещения.',ko:'RAD에서 라이트 패치를 만들지 않았습니다.',zh:'RAD 没有生成光照块。',pt:'RAD não criou patches de luz.'},
 RAD_CRASH:{es:'RAD terminó con un fallo; revisá el registro completo.',en:'RAD crashed; inspect the full log.',ru:'Сбой RAD; изучите журнал.',ko:'RAD 충돌. 전체 로그를 확인하세요.',zh:'RAD 崩溃；检查完整日志。',pt:'RAD falhou; confira o registro completo.'},
 VIS_FAILED:{es:'VIS falló; revisá portales, geometría y leaks.',en:'VIS failed; check portals, geometry and leaks.',ru:'Ошибка VIS; проверьте порталы, геометрию и утечки.',ko:'VIS 실패. 포털, 지오메트리 및 누출을 확인하세요.',zh:'VIS 失败；检查传送门、几何和泄漏。',pt:'VIS falhou; confira portais, geometria e vazamentos.'}
};

// Keep the existing native CS checks; HF33 adds to them rather than replacing them.
const COMMON:Record<string,Record<string,string>>={
 SPAWN_OVERLAP:{es:'Spawns del mismo equipo demasiado cerca.',en:'Same-team spawns are too close.',ru:'Точки одной команды слишком близко.',ko:'동일 팀 스폰이 너무 가깝습니다.',zh:'同队出生点过近。',pt:'Spawns da mesma equipe muito próximos.'},
 OPPOSING_SPAWNS:{es:'Spawns CT y TT superpuestos.',en:'CT and T spawns overlap.',ru:'Точки CT и T пересекаются.',ko:'CT와 T 스폰이 겹칩니다.',zh:'CT 和 T 出生点重叠。',pt:'Spawns CT e TR sobrepostos.'},
 MISSING_TEAMS:{es:'Faltan spawns CT o TT.',en:'CT or T spawns are missing.',ru:'Не хватает точек CT или T.',ko:'CT 또는 T 스폰이 없습니다.',zh:'缺少 CT 或 T 出生点。',pt:'Faltam spawns CT ou TR.'},
 DE_BOMB:{es:'El mapa de_ necesita un objetivo de bomba.',en:'de_ map needs a bomb objective.',ru:'Карта de_ требует точку установки бомбы.',ko:'de_ 맵에 폭탄 목표가 필요합니다.',zh:'de_ 地图需要爆破目标。',pt:'Mapa de_ requer um objetivo de bomba.'},
 CS_HOSTAGES:{es:'El mapa cs_ necesita rehenes.',en:'cs_ map needs hostages.',ru:'На карте cs_ нет заложников.',ko:'cs_ 맵에 인질이 필요합니다.',zh:'cs_ 地图需要人质。',pt:'Mapa cs_ requer reféns.'},
 CS_RESCUE:{es:'El mapa cs_ necesita zona de rescate.',en:'cs_ map needs a rescue zone.',ru:'На карте cs_ нет зоны спасения.',ko:'cs_ 맵에 구조 구역이 필요합니다.',zh:'cs_ 地图需要营救区。',pt:'Mapa cs_ precisa de zona de resgate.'},
 MIXED_OBJECTIVES:{es:'Hay objetivos de otro tipo de mapa.',en:'Objectives from a different map mode found.',ru:'Найдены цели другого режима.',ko:'다른 모드의 목표가 있습니다.',zh:'发现其他地图模式的目标。',pt:'Há objetivos de outro modo.'},
 CS16_CT_SPAWN:{es:'Falta info_player_start.',en:'Missing info_player_start.',ru:'Нет info_player_start.',ko:'info_player_start 누락.',zh:'缺少 info_player_start。',pt:'Falta info_player_start.'},
 CS16_T_SPAWN:{es:'Falta info_player_deathmatch.',en:'Missing info_player_deathmatch.',ru:'Нет info_player_deathmatch.',ko:'info_player_deathmatch 누락.',zh:'缺少 info_player_deathmatch。',pt:'Falta info_player_deathmatch.'},
 CS16_BOUNDS:{es:'Hay objetos fuera del rango práctico clásico.',en:'Objects extend beyond typical classic map bounds.',ru:'Объекты выходят за практические границы карты.',ko:'오브젝트가 일반적인 맵 범위를 벗어났습니다.',zh:'对象超出经典地图的常见范围。',pt:'Objetos fora dos limites práticos clássicos.'},
 CS16_SVEN_ONLY:{es:'Hay entidades potencialmente exclusivas de Sven Co-op.',en:'Potential Sven Co-op-only entities detected.',ru:'Обнаружены возможные сущности только для Sven Co-op.',ko:'Sven Co-op 전용 엔티티가 발견되었습니다.',zh:'检测到可能仅适用于 Sven Co-op 的实体。',pt:'Entidades possivelmente exclusivas de Sven Co-op.'},
 CS16_SPAWN_COUNT:{es:'Más de 32 spawns de un equipo.',en:'More than 32 spawns for one team.',ru:'Более 32 точек одной команды.',ko:'한 팀의 스폰이 32개를 초과합니다.',zh:'单队出生点超过 32 个。',pt:'Mais de 32 spawns de uma equipe.'},
 CS16_BOMB_SPAWN:{es:'Bombsite sin spawns válidos de ambos equipos.',en:'Bombsite without both team spawns.',ru:'Нет точек обеих команд для бомбы.',ko:'폭탄 구역에 양 팀 스폰이 없습니다.',zh:'爆破区缺少双方出生点。',pt:'Bombsite sem spawns de ambas as equipes.'},
 ZONE_NO_BRUSH:{es:'Zona sin brush vinculado.',en:'Zone without a linked brush.',ru:'Зона без связанного браша.',ko:'연결된 브러시가 없는 구역.',zh:'区域未关联笔刷。',pt:'Zona sem brush vinculado.'},
 SPAWN_INSIDE_BRUSH:{es:'Spawn posiblemente dentro de un sólido.',en:'Spawn possibly inside solid geometry.',ru:'Точка возможно внутри твёрдого браша.',ko:'스폰이 고체 내부에 있을 수 있습니다.',zh:'出生点可能位于实体几何内部。',pt:'Spawn possivelmente dentro de um sólido.'}
};
Object.assign(ISSUE_LABELS,COMMON);

// BSP recovery reconstructs editable render geometry, not the original
// GoldSrc player hulls. Do not mislabel official maps as having broken spawns.
const RECOVERED_NOTE:Record<string,string>={
 es:'Mapa recuperado de BSP: se omite la comprobación aproximada de suelo e intersecciones de spawns. La geometría editable no reproduce necesariamente los hulls de colisión originales; comprobá los cambios dentro del juego o compilando con ZHLT.',
 en:'Recovered BSP map: approximate spawn floor and solid-intersection checks are skipped. Editable geometry does not necessarily reproduce original collision hulls; verify changes in-game or with ZHLT.',
 ru:'Карта восстановлена из BSP: приближённые проверки пола и пересечений точек появления отключены. Редактируемая геометрия может отличаться от оригинальных коллизий; проверяйте изменения в игре или через ZHLT.',
 ko:'BSP 복원 맵: 스폰의 바닥 및 고체 충돌 추정 검사를 생략합니다. 편집 가능한 지오메트리는 원본 충돌 헐과 다를 수 있습니다. 게임 또는 ZHLT에서 확인하세요.',
 zh:'从 BSP 恢复的地图：跳过出生点地面和实体交叉的近似检查。可编辑几何可能与原始碰撞体不同，请在游戏中或通过 ZHLT 验证更改。',
 pt:'Mapa recuperado de BSP: verificações aproximadas de piso e interseção de spawns foram omitidas. A geometria editável pode diferir dos hulls de colisão originais; verifique as alterações no jogo ou no ZHLT.'
};
const words=(locale:string)=>W[locale]||W.en;

export function CSMapHF33Builder({locale,mode,usable,bspMode,walkMode,onCancel}:{locale:string;mode:CS16MapKind;usable:boolean;bspMode:boolean;walkMode:boolean;onCancel:()=>void}){
 const w=words(locale),project=useEditor(s=>s.project),settings=useEditor(s=>s.settings),addObjects=useEditor(s=>s.addObjects);
 const assets=useEditor(s=>s.textureAssets),[texture,setTexture]=useState('');
 const [ct,setCt]=useState(8),[tt,setTt]=useState(8),[center,setCenter]=useState<Vec3>([0,0,0]),[status,setStatus]=useState('');
 const suggestions=assets.filter(a=>!/^SV_|^(?:AAATRIGGER|SKY|NULL|ORIGIN|CLIP)$/i.test(a.name)&&!/svstudio/i.test(a.wad)).slice(0,80);
 const picked=texture.trim()||suggestions[0]?.name||'C1A0_LABFLR';
 const allowed=usable&&canCreateCS16Starter(settings.gameProfile,bspMode,walkMode,project.objects);
 const create=()=>{
  if(!allowed){setStatus(w.empty);return}
  try{
   onCancel();const added=createCS16StarterArena({mode,center,ctCount:ct,tCount:tt,texture:picked});
   cs16ApplyBatch(project.objects,added);addObjects(added);
   setStatus(`${w.success}: ${added.length}. ${w.undo}`);
  }catch(err){setStatus(`${w.error}: ${err instanceof Error?err.message:w.invalid}`)}
 };
 return <section className="cs33-builder">
  <div className="cs31-section-heading"><span className="cs31-step"><Layers3 size={16}/></span><div><strong>{w.builder} · {mode}_</strong><small>{w.subtitle}</small></div></div>
  <div className="cs33-mode-schematic" aria-label="CT, routes, T"><span>TT</span><i/><i/><i/><span>CT</span></div>
  <div className="cs31-grid2"><label>{w.countCT}<input type="number" min={1} max={16} value={ct} onChange={e=>setCt(e.target.valueAsNumber)}/></label><label>{w.countT}<input type="number" min={1} max={16} value={tt} onChange={e=>setTt(e.target.valueAsNumber)}/></label></div>
  <label>{w.center}</label><div className="cs31-grid3">{(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}<input aria-label={`${w.center} ${axis}`} type="number" step="64" value={center[i]} onChange={e=>setCenter(prev=>prev.map((v,j)=>i===j?e.target.valueAsNumber:v) as Vec3)}/></label>)}</div>
  <label>{w.texture}<input className="cs33-texture-input" type="text" maxLength={15} list="cs33-textures" value={texture} onChange={e=>setTexture(e.target.value)} placeholder={suggestions[0]?.name||'C1A0_LABFLR'}/></label>
  <datalist id="cs33-textures">{suggestions.map(a=><option key={`${a.wad}-${a.name}`} value={a.name}/>)}</datalist>
  <p className="cs31-tip">{w.texturesHint}</p><p className="cs31-tip">{w.limits}</p>
  {!allowed&&<p className="cs31-alert"><AlertTriangle size={16}/>{w.empty}</p>}
  <button type="button" className="cs33-generate" disabled={!allowed||!picked.trim()} onClick={create}><PackagePlus size={17}/>{w.create}</button>
  <small className="cs31-tip">{w.compatible}</small>{status&&<p className="cs31-status" role="status">{status}</p>}
 </section>;
}

export function CSMapHF33Audit({locale,mapName,mode}:{locale:string;mapName:string;mode?:CS16MapKind}){
 const w=words(locale),project=useEditor(s=>s.project),assets=useEditor(s=>s.textureAssets),select=useEditor(s=>s.selectObjectIds);
 const buildLines=useMapDoctorState(s=>s.lines),buildName=useMapDoctorState(s=>s.mapName);
 const recoveredBsp=isRecoveredBspProject(project);
 const custom=inspectCS16HF33(project,assets);
 const basic=inspectCS16Layout(project,mode||cs16ModeFromMapName(mapName)).map(f=>({code:f.code,severity:f.severity}));
 const profile=inspectCS16Project(project).map(f=>({code:f.code,severity:'warning' as const}));
 const advanced=inspectCS16Advanced(project.objects).filter(f=>!(recoveredBsp&&f.code==='SPAWN_INSIDE_BRUSH')&&!(f.code==='SPAWN_INSIDE_BRUSH'&&custom.some(e=>e.code==='SPAWN_SOLID_HULL'&&e.objectId===f.entityId))).map(f=>({code:f.code,severity:'warning' as const,objectId:f.entityId,detail:f.position.join(' / ')}));
 const check=[...basic,...profile,...advanced,...custom];
 const sameMap=!!buildName&&buildName.replace(/\.map$/i,'').toLowerCase()===mapName.replace(/\.map$/i,'').toLowerCase();
 const log=sameMap?inspectCS16BuildLog(buildLines):[];
 const find=(code:string)=>ISSUE_LABELS[code]?.[locale]||ISSUE_LABELS[code]?.en||code;
 const inventoried=cs16Inventory(project.objects);
 const render=(items:ReturnType<typeof inspectCS16HF33>,prefix:string)=><div className="cs33-findings">
  {items.slice(0,80).map((item,i)=>{
   const obj=item.objectId&&project.objects.find(o=>o.id===item.objectId);
   return <div className={`cs33-finding ${item.severity}`} key={`${prefix}-${item.code}-${i}`}>
    <span className="cs33-finding-icon">{item.severity==='error'?<AlertTriangle size={15}/>:item.severity==='warning'?<AlertTriangle size={15}/>:<ShieldCheck size={15}/>}</span>
    <div><b>{item.code}</b><small>{find(item.code)}{item.detail?` · ${item.detail}`:''}</small></div>
    {obj&&!obj.hidden&&!obj.locked&&<button type="button" aria-label={`${w.focus} ${obj.name}`} title={w.focus} onClick={()=>{const item=inventoried.find(entry=>entry.id===obj.id);select(item?cs16SelectionIds([item],'single',item.id):[obj.id],true)}}><Focus size={15}/></button>}
   </div>;
  })}
  {items.length>80&&<p className="cs31-tip">+{items.length-80} {w.findings}</p>}
 </div>;
 return <section className="cs33-doctor">
  <div className="cs31-section-heading"><span className="cs31-step"><ShieldCheck size={16}/></span><div><strong>{w.doctor}</strong><small>{w.caution}</small></div></div>
  {recoveredBsp&&<p className="cs31-tip" role="note">{RECOVERED_NOTE[locale]||RECOVERED_NOTE.en}</p>}
  <div className="cs33-report-header"><strong>{w.preflight}</strong><span>{check.length} {w.findings}</span></div>
  {check.length?render(check,'preflight'):<div className="cs31-ok"><CheckCircle2 size={16}/>{w.clean}</div>}
  <div className="cs33-report-header"><strong><FileText size={15}/>{w.build}</strong><span>{log.length} {w.findings}</span></div>
  {!sameMap||!buildLines.length?<p className="cs31-tip">{w.noBuild}</p>:log.length?render(log,'log'):<div className="cs31-ok"><CheckCircle2 size={16}/>{w.clean}</div>}
 </section>;
}
