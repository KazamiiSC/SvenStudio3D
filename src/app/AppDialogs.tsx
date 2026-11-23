/** Editor dialogs extracted from App.tsx (v2.3 HF5): camera/gizmo controls, help guide and build output. */
import {Suspense,lazy,useEffect,useRef,useState} from 'react';
import {Crosshair,FolderOpen,PackagePlus,Play,Info,CheckCircle2,Terminal,ShieldCheck,Keyboard,BookOpen,Boxes} from 'lucide-react';
const EntityGuideBrowser=lazy(()=>import('../components/EntityGuideBrowser').then(m=>({default:m.EntityGuideBrowser})));
import {useEditor} from '../store';
import {helpV23} from '../engine/helpV23';
import {helpWhatsNew} from '../engine/helpWhatsNew';
import {useMapDoctorState} from '../mapDoctorState';
import {CONTROL_ACTIONS,displayBinding,keyEventBinding,isBrowserReservedBinding} from '../engine/controls';
import type {ShortcutAction} from '../engine/controls';
import {useT,translate} from '../i18n';
import {studioGuide} from '../engine/studioGuide';
import {editorManual,EDITOR_SHORTCUT_GROUPS,actionTitlesEs,actionTitlesEn} from '../engine/editorManual';
import {helpV21} from '../engine/helpV21';
import {releaseGuide} from '../engine/editorReleaseGuide';
import {localizedActionTitle} from '../engine/editorManualIntl';

/** v2.4: camera/gizmo settings and keyboard shortcuts are two sections of the Editor Preferences window. */
export function CameraControlsSettings(){
  const t=useT();
  const controls=useEditor(s=>s.controls),setControls=useEditor(s=>s.setControls),resetControls=useEditor(s=>s.resetControls);
  const locale=useEditor(s=>s.locale);const guide=studioGuide(locale);
  const sliders=(items:readonly (readonly [keyof typeof controls,string,number,number,number])[])=>items.map(([id,label,min,max,step])=><label key={String(id)} className="pref-slider"><span>{t(label)}</span><input type="range" min={min} max={max} step={step} value={Number(controls[id])} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{String(controls[id])}</output></label>);
  return <>
    <section className="pref-card controls-quick-reference" aria-label={guide.guideTitle}>
      <header><strong>{guide.guideTitle}</strong><small>{guide.capture}</small></header>
      <p className="controls-browser-warning">{guide.browserWarning}</p>
      <div className="controls-reference-grid">
        <div><strong>{t('Camera navigation')}</strong><p>{guide.cameraKeys}</p></div>
        <div><strong>{t('Gizmo / Transform')}</strong><p>{guide.transformKeys}</p></div>
        <div><strong>{t('Fly / Walk mode')}</strong><p>{t('Gameplay Test')}: F5 / Shift+P · {t('Fly / Walk mode')}: {displayBinding(controls.shortcuts.fly||'Shift+KeyF')} · F: {t('Flashlight')} · H: HUD · N: noclip · E: {guide.interact}.</p></div>
        <div><strong>{t('Camera views')}</strong><p>{t('Front view')}: {displayBinding(controls.shortcuts.front||'')} · {t('Right view')}: {displayBinding(controls.shortcuts.right||'')} · {t('Top view')}: {displayBinding(controls.shortcuts.top||'')} · {t('Orthographic / Perspective')}: {displayBinding(controls.shortcuts.projection||'')} · {t('Frame all')}: {displayBinding(controls.shortcuts.frameAll||'')}.</p></div>
      </div>
    </section>
    <section className="pref-card">
      <header><strong>{t('Camera navigation')}</strong><small>{t('Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.')}</small></header>
      <label className="pref-row"><span><b>{t('Navigation preset')}</b></span><select value={controls.cameraPreset} onChange={e=>setControls({cameraPreset:e.target.value as 'blender'|'classic'})}>
        <option value="blender">{t('Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom')}</option>
        <option value="classic">{t('Classic — RMB orbit · MMB zoom · LMB pan')} · RMB look</option>
      </select></label>
      {sliders([['orbitSensitivity','Orbit sensitivity',.15,4,.05],['panSensitivity','Pan sensitivity',.15,4,.05],['zoomSensitivity','Zoom sensitivity',.15,4,.05],['flySpeed','Fly speed (units/sec)',10,3000,10]] as const)}
      <div className="pref-chips">
        <label><input type="checkbox" checked={controls.invertOrbit} onChange={e=>setControls({invertOrbit:e.target.checked})}/>{t('Invert orbit rotation')}</label>
        <label><input type="checkbox" checked={controls.cameraDamping} onChange={e=>setControls({cameraDamping:e.target.checked})}/>{t('Smooth camera motion')}</label>
        <label><input type="checkbox" checked={controls.zoomToCursor} onChange={e=>setControls({zoomToCursor:e.target.checked})}/>{t('Zoom toward mouse cursor')}</label>
      </div>
      <details className="pref-more"><summary>{t('Advanced camera options')}</summary>
        {sliders([['dampingFactor','Camera smoothing',.02,.25,.01],['perspectiveFov','Perspective field of view',35,100,1],['minCameraDistance','Minimum camera distance',1,500,1],['maxCameraDistance','Maximum camera distance',500,250000,500],['flyLookSensitivity','Fly mouse sensitivity',.2,3,.05],['flyBoostMultiplier','Fast flight multiplier (Shift)',1,8,.25],['flySlowMultiplier','Slow flight multiplier (Ctrl)',.05,1,.05]] as const)}
        <p className="modal-subtext">{t('These options affect only the editor camera. They do not change map geometry or the BSP.')}</p>
      </details>
    </section>
    <section className="pref-card">
      <header><strong>{t('Gizmo / Transform')}</strong><small>{t('G starts mouse-follow Move. R and C toggle the Rotate and Scale gizmos; press again to return to Select. Drag a gizmo handle to edit the brush.')}</small></header>
      <label className="pref-row"><span><b>{t('Gizmo orientation')}</b></span><select value={controls.gizmoSpace} onChange={e=>setControls({gizmoSpace:e.target.value as 'local'|'world'})}><option value="world">{t('Global / World')}</option><option value="local">{t('Local / Object')}</option></select></label>
      {sliders([['rotationSnapDegrees','Rotation snap (0 = off)',0,90,5],['scaleSnapStep','Scale snap (0 = off)',0,1,.05],['gizmoSize','Gizmo size',.15,2,.05]] as const)}
      <p className="modal-subtext">{t('Translate uses the Grid / Snap controls in the editor toolbar. Rotation and scale snaps are optional. Multi-selection pivots use World axes.')}</p>
      <details className="pref-more"><summary>{t('Mouse transform modifiers')}</summary>
        <p className="modal-subtext">{t('G uses mouse-follow Move with Shift/Ctrl/Alt and X/Y/Z axis constraints. R/C show gizmos: drag a handle to rotate/scale, or press the shortcut again to select normally.')}</p>
        {sliders([['transformFineFactor','Shift precision',.02,1,.01],['transformRotationStep','Ctrl rotation step (degrees)',1,90,1],['transformScaleStep','Ctrl scale step',.01,.5,.01]] as const)}
        <p className="modal-subtext">{t('Alt + mouse: Move = world height (Z), Rotate = two-axis trackball, Scale = temporarily use center pivot. Ctrl works with the gizmo too.')}</p>
      </details>
    </section>
    <section className="pref-card">
      <header><strong>{t('Smart Snapping 2.0')}</strong><small>{t('Magnetism affects only moving brushes and entities with G or the move gizmo. Hold Shift to ignore magnetic snapping. Existing grid snapping stays available; maps and BSP data are unchanged until you confirm the move.')}</small></header>
      <label className="pref-toggle"><input type="checkbox" checked={controls.smartSnapEnabled} onChange={e=>setControls({smartSnapEnabled:e.target.checked})}/><span><b>{t('Enable magnetic geometry snapping')}</b></span></label>
      <label className="pref-row"><span><b>{t('Magnetic targets')}</b></span><select value={controls.smartSnapMode} onChange={e=>setControls({smartSnapMode:e.target.value as 'all'|'face'|'vertex'|'edge'})}>
        <option value="all">{t('Faces, vertices and edges')}</option><option value="face">{t('Faces and surfaces')}</option><option value="vertex">{t('Vertices only')}</option><option value="edge">{t('Edges only')}</option>
      </select></label>
      <label className="pref-slider"><span>{t('Magnetic distance (pixels)')}</span><input type="range" min="6" max="24" step="1" value={controls.smartSnapPixels} onChange={e=>setControls({smartSnapPixels:Number(e.target.value)})}/><output>{controls.smartSnapPixels}px</output></label>
    </section>
    <div className="pref-actions"><button onClick={()=>resetControls()}>{t('Reset to Blender defaults')}</button></div>
  </>;
}
export function ShortcutSettings(){
  const t=useT();
  const controls=useEditor(s=>s.controls);
  const setShortcut=useEditor(s=>s.setShortcut);
  const [capture,setCapture]=useState<ShortcutAction|null>(null);
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const shown=CONTROL_ACTIONS.filter(a=>!query||`${t(a.label)} ${a.label} ${controls.shortcuts[a.id]||''}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <section className="pref-card">
      <header><strong>{t('Custom keyboard shortcuts')}</strong><small>{t('Click a shortcut and press your preferred key combination. Backspace clears it; Esc cancels. Conflicting shortcuts are automatically unassigned.')}</small></header>
      <input className="pref-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search shortcuts…')} aria-label={t('Search shortcuts…')}/>
      <div className="binding-grid">{shown.map(action=><div key={action.id} className="binding-action-slot">
        {!query&&(['fly','front','orbitLeft','zoomIn','quadView'].includes(action.id))&&<div className="binding-section">{t(action.id==='fly'?'Fly / Walk mode':action.id==='front'?'Camera views':action.id==='orbitLeft'?'Camera movement':action.id==='quadView'?'Editor tools':'Camera zoom')}</div>}
        <div className="binding-row">
        <span title={t(action.description)}>{t(action.label)}</span>
        <button className={capture===action.id?'capturing':''} onClick={()=>{setCapture(action.id);setNotice(t('Press a key combination…'))}}
          onKeyDown={e=>{
            if(capture!==action.id)return;
            e.stopPropagation();e.preventDefault();
            if(e.code==='Escape'){setCapture(null);setNotice(t('Shortcut recording cancelled.'));return}
            const code=e.code==='Backspace'?'':keyEventBinding(e.nativeEvent);
            if(!code&&e.code!=='Backspace')return;
            if(isBrowserReservedBinding(code)){
              setNotice(t('This shortcut is reserved by your browser or operating system. Choose another key.'));
              return;
            }
            setShortcut(action.id,code);setCapture(null);setNotice(`${action.label} set to ${code?displayBinding(code):'unassigned'}.`);
          }}>
          {capture===action.id?t('Press a key…'):controls.shortcuts[action.id]?displayBinding(controls.shortcuts[action.id]):t('Unassigned')}
        </button>
        </div>
      </div>)}</div>
      <p className="controls-note" aria-live="polite">{notice||t('Changes are saved automatically in this browser.')}</p>
    </section>
  </>;
}export function AboutModal({onClose,initialTab='manual',initialClass}:{onClose:()=>void;initialTab?:'manual'|'entities';initialClass?:string}){
  const [helpTab,setHelpTab]=useState<'manual'|'entities'>(initialTab);
  const t=useT();
  const locale=useEditor(s=>s.locale);
  const controls=useEditor(s=>s.controls);
  const manual=editorManual(locale);
  const release=releaseGuide(locale);
  const v21Help=helpV21(locale);
  const v23Help=helpV23(locale);
  const whatsNew=helpWhatsNew(locale);
  // v2.5: fixed side index that follows the section you are reading.
  const helpScroll=useRef<HTMLDivElement>(null);
  const [helpActive,setHelpActive]=useState('new');
  useEffect(()=>{
    const root=helpScroll.current;if(!root)return;
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(visible)setHelpActive(visible.target.id.replace('manual-',''));},{root,rootMargin:'0px 0px -65% 0px'});
    root.querySelectorAll('[id^="manual-"]').forEach(el=>observer.observe(el));
    return()=>observer.disconnect();
  },[helpTab]);
  const shortcutGroups=[
    {id:'transform',title:translate(locale,'Transform and framing'),actions:EDITOR_SHORTCUT_GROUPS.transform},
    {id:'views',title:translate(locale,'Views and projection'),actions:EDITOR_SHORTCUT_GROUPS.views},
    {id:'orbit',title:translate(locale,'Orbit, pan and zoom'),actions:EDITOR_SHORTCUT_GROUPS.orbit},
    {id:'tools',title:translate(locale,'Editor tools'),actions:EDITOR_SHORTCUT_GROUPS.tools}
  ];
  const textList=(items:readonly string[])=><ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul>;
  const section=(id:string,title:string,items:readonly string[])=><section id={`manual-${id}`} className="help-feature-card manual-block" key={id}><h4>{title}</h4>{textList(items)}</section>;
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card about-card help-dialog help-dialog-current help-v25" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Help')}>
    <header className="help-hero"><Info size={22}/><div><strong>{t('Sven Studio guide')}</strong><small>SvenStudio 3D v2.5 · {t('What is new, where everything is and how to use it')}</small></div>
      <nav className="help-tabs" role="tablist" aria-label={t('Help')}>
        <button type="button" role="tab" aria-selected={helpTab==='manual'} className={helpTab==='manual'?'active':''} onClick={()=>setHelpTab('manual')}><BookOpen size={15}/>{t('Editor guide')}</button>
        <button type="button" role="tab" aria-selected={helpTab==='entities'} className={helpTab==='entities'?'active':''} onClick={()=>setHelpTab('entities')}><Boxes size={15}/>{t('Entity guide')}</button>
      </nav>
      <button type="button" className="help-close" title={t('Close')} aria-label={t('Close')} onClick={onClose}>×</button></header>
    {helpTab==='entities'?<Suspense fallback={<div className="eg-loading">{t('Loading…')}</div>}><EntityGuideBrowser initialClass={initialClass} onPlace={onClose}/></Suspense>:
    <div className="help-layout">
      <nav className="help-index help-sidebar" aria-label={({es:'Índice de la guía',en:'Guide navigation',ru:'Навигация по руководству',ko:'도움말 탐색',zh:'帮助导航',pt:'Navegação do guia'} as Record<string,string>)[locale]}>
        {[
          ['new',whatsNew.title],['start',manual.firstTitle],['camera',manual.cameraTitle],['edit',manual.editTitle],['uv',manual.uvTitle],
          ['shapes',manual.shapesTitle],['walk',manual.walkTitle],['shortcuts',manual.shortcutsTitle],
          ['studios',manual.studiosTitle],['v23',v23Help.title],['v21',v21Help.title],['current',release.title],['workspace',manual.workspaceTitle],['technical',manual.technicalTitle],['contact',manual.noticeTitle]
        ].map(([id,label])=><a key={id} href={`#manual-${id}`} className={helpActive===id?'active':''} aria-current={helpActive===id?'true':undefined} onClick={event=>{event.preventDefault();document.getElementById(`manual-${id}`)?.scrollIntoView({block:'start',behavior:'smooth'});}}>{label}</a>)}
      </nav>
    <div className="help-scroll" tabIndex={0} ref={helpScroll}>
      <div className="help-credits" role="group" aria-label={t('Project credits')}>

        <p>{t('This project was made with the help of GPT-6 Astra.')}</p>
      </div>
      <div className="help-summary"><h4>{t('Editor summary')}</h4><p>{manual.intro}</p></div>
      <section className="help-feature-card manual-block manual-whats-new" id="manual-new" aria-label={whatsNew.title}>
        <h3>{whatsNew.title}</h3><p>{whatsNew.intro}</p>
        <button type="button" className="manual-tour-button" onClick={()=>{onClose();window.setTimeout(()=>document.dispatchEvent(new Event('svenstudio:start-tour')),250);}}>{whatsNew.tourButton}</button>
        <div className="help-feature-grid manual-guide-grid">{whatsNew.cards.map(card=><section key={card.title} className="help-feature-card manual-studio-card"><h4>{card.title}</h4><p className="manual-where"><strong>{whatsNew.whereLabel}:</strong> {card.where}</p><p>{card.description}</p></section>)}</div>
      </section>
      <section className="help-camera-note manual-fullscreen" role="note"><h4>{manual.fullTitle}</h4><p>{manual.full}</p></section>
      <div className="help-feature-grid manual-guide-grid">
        {section('start',manual.firstTitle,manual.first)}
        {section('camera',manual.cameraTitle,manual.camera)}
        {section('edit',manual.editTitle,manual.edit)}
        {section('uv',manual.uvTitle,manual.uv)}
        {section('shapes',manual.shapesTitle,manual.shapes)}
        {section('walk',manual.walkTitle,manual.walk)}
      </div>
      <section className="help-feature-card manual-block" aria-label="True Lighting help"><h4>True Lighting · SC-RAD / SDHLT</h4><p>{({
        es:'En Estudios → True Lighting elegí SC-RAD o SDHLT antes de compilar. El cálculo puede reducir el rendimiento temporalmente. En vista ampliada WASD controla solo la cámara BSP, Q/E cambia la altura, Esc o F8 libera el cursor. Reducí o cerrá la vista para volver al editor.',
        en:'Open Studios → True Lighting, select SC-RAD or SDHLT before baking. Compilation may temporarily reduce performance. In expanded view WASD controls only the BSP camera, Q/E adjusts height, Esc or F8 releases the cursor. Minimize or close the preview to return to the editor.',
        ru:'Откройте Студии → True Lighting и выберите SC-RAD или SDHLT перед пересчётом. Компиляция может снизить производительность. В развёрнутом просмотре WASD управляет камерой BSP, Q/E — высотой, Esc или F8 освобождает курсор.',
        ko:'Studios → True Lighting에서 컴파일 전 SC-RAD 또는 SDHLT를 선택하세요. 처리 중 성능이 저하될 수 있습니다. 확대 화면에서는 WASD가 BSP 카메라만 이동하고 Q/E는 높이를 조절하며 Esc 또는 F8로 마우스를 해제합니다.',
        zh:'在“工作室 → True Lighting”中选择 SC-RAD 或 SDHLT 后再烘焙。编译可能暂时降低性能。放大预览时 WASD 仅移动 BSP 相机，Q/E 调整高度，Esc 或 F8 释放鼠标。',
        pt:'Abra Estúdios → True Lighting e selecione SC-RAD ou SDHLT antes de compilar. O processo pode reduzir o desempenho. Na prévia ampliada, WASD move só a câmera BSP, Q/E ajusta a altura; Esc ou F8 libera o cursor.'
      } as Record<string,string>)[locale]}</p></section>
      <section className="help-feature-card manual-block" aria-label="Path and Structure Studio help"><h4>Path &amp; Structure Studio</h4><p>{({
        es:'En Estudios → Terrenos y geometría → Caminos y estructuras podés dibujar recorridos XYZ. Los conductos rectangulares y las tuberías octogonales ahora pueden subir y girar en 3D. El modo Cables permite ajustar diámetro, caída entre anclajes, cantidad y separación. Previsualizá, colocá con clic sobre el mapa y editá los recorridos guardados. Codos complejos pueden generar muchos brushes. Railway Builder 2.0 genera redes path_track, desvíos, estaciones y una plantilla func_tracktrain con ORIGIN y controles. Probá el tren compilado en Sven Co-op.',
        en:'In Studios → Terrain & Shape → Paths & Structures, draw editable XYZ routes. Hollow rectangular ducts and octagonal pipes can climb and turn in 3D. Suspended cables allow diameter, sag, strand count and spacing. Preview, place by clicking the MAP viewport and reopen saved routes. Complex bends may create many brushes. Railway Builder 2.0 adds path_track networks, turnouts, station platforms and an optional func_tracktrain template with ORIGIN and player controls. Test it in Sven Co-op.',
        ru:'В Студии → Рельеф → Пути и конструкции рисуйте маршруты XYZ. Полые каналы и трубы могут подниматься и поворачивать в 3D. Кабели поддерживают диаметр, провисание, количество и шаг. Размещайте кликом и редактируйте сохранённые пути; проверяйте сложные изгибы в игре. Railway Builder 2.0 добавляет path_track, стрелки, платформы и шаблон func_tracktrain с ORIGIN и управлением.',
        ko:'스튜디오 → 지형 → 경로 및 구조물에서 XYZ 경로를 편집하세요. 직사각형 덕트와 팔각 파이프를 3D로 올리고 회전할 수 있습니다. 케이블에는 지름, 처짐, 개수와 간격 설정이 있습니다. 지도에서 배치하고 저장된 경로를 다시 편집할 수 있습니다. 복잡한 굴곡은 게임에서 확인하세요. Railway Builder 2.0은 path_track, 분기점, 역 및 ORIGIN/플레이어 제어가 있는 func_tracktrain 템플릿을 생성합니다.',
        zh:'在工作室 → 地形 → 路径与结构中编辑 XYZ 路线。空心风管和八角管可以沿 3D 路线升降转弯。悬挂电缆提供直径、下垂量、数量和间距设置。点击地图放置并可再次编辑已保存路径；请在游戏中检查复杂弯道。Railway Builder 2.0 可创建 path_track 网络、道岔、车站以及包含 ORIGIN 和玩家控制的 func_tracktrain 模板。',
        pt:'Em Estúdios → Terreno → Rotas e Estruturas, desenhe percursos XYZ. Dutos ocos retangulares e tubos octogonais sobem e giram em 3D. Os cabos permitem diâmetro, curvatura, quantidade e espaçamento. Coloque clicando no mapa e edite rotas salvas. Confira curvas complexas no jogo. O Railway Builder 2.0 cria redes path_track, desvios, estações e um modelo func_tracktrain com ORIGIN e controles.'
      } as Record<string,string>)[locale]}</p></section>
      <section className="help-feature-card manual-block" aria-label="Mission and events studios help"><h4>Mission &amp; Campaign Studio · Dynamic Events Studio</h4><p>{({
        es:'Estudios → Misiones y campañas: creá objetivos conectados mediante trigger_relay y mensajes game_text. Conectá un botón, trigger o entidad existente al relay de finalización de cada objetivo. Vinculá secuencias creadas en Estudios → Eventos dinámicos para disparar efectos mediante multi_manager y tiempos configurables. El tiempo de la vista previa es ilustrativo; no simula una partida. Al guardar se crean entidades nativas editables y protegidas contra cambios manuales. Deshacer restaura la operación completa del mapa. v1.8.10: elegí targets desde el mapa, creá rutas de éxito/fracaso, contadores game_counter e inspeccioná la lógica. Eventos incluye arrastre en timeline, duplicación y desplazamiento de acciones. Los scripts y checkpoints no se generan automáticamente.',
        en:'Studios → Mission & Campaign: connect objectives through native trigger_relay and game_text messages. Wire an existing button, trigger or entity to each completion relay. Link sequences created in Studios → Dynamic Events to schedule multi_manager actions on existing entity targetnames. Timeline preview is illustrative, not an in-game simulation. Saving generates native entities protected against accidental replacement; map Undo restores the full operation. v1.8.10: pick targets from the map, add success/failure branches and game_counter gates, inspect the local logic, drag timeline cues, duplicate and shift actions. Scripts and checkpoints are not generated automatically.',
        ru:'Студии → Миссии: соединяйте задачи через trigger_relay и сообщения game_text. Подключайте кнопки и триггеры к реле завершения. Студия событий создаёт multi_manager с временными действиями на существующие targetname. Предпросмотр времени не моделирует игровой процесс. Созданные сущности сохраняются с защитой от ручных изменений. v1.8.10: выбор targetname на карте, ветви успеха/неудачи, game_counter и перетаскиваемая временная линия. Скрипты и точки сохранения не создаются автоматически.',
        ko:'스튜디오 → 미션: trigger_relay와 game_text로 목표를 연결하세요. 버튼이나 트리거를 각 완료 릴레이에 연결해야 합니다. 동적 이벤트는 기존 targetname을 multi_manager로 시간에 따라 실행합니다. 타임라인은 실제 게임 시뮬레이션이 아닙니다. 저장된 엔티티는 수동 수정으로부터 보호됩니다. v1.8.10: 맵에서 타겟 선택, 성공/실패 분기, game_counter, 드래그 가능한 타임라인을 지원합니다. 스크립트와 체크포인트는 자동 생성하지 않습니다.',
        zh:'工作室 → 任务：使用 trigger_relay 和 game_text 连接目标。需要把按钮或触发器连到各完成继电器。动态事件工作室通过 multi_manager 按时间触发现有 targetname。时间线只是预览，不模拟实际游戏。保存的原生实体受到手工修改保护。v1.8.10 支持地图目标选择、成功/失败分支、game_counter 和拖动时间线。不会自动生成脚本或检查点。',
        pt:'Estúdios → Missões: conecte objetivos usando trigger_relay e mensagens game_text. Ligue botões e gatilhos aos relés de conclusão. Eventos dinâmicos cria ações temporizadas multi_manager para targetnames existentes. A prévia não simula o jogo. Entidades são protegidas contra substituição de alterações manuais; Desfazer reverte a operação. v1.8.10: escolha alvos no mapa, crie ramificações, contadores game_counter e arraste ações na linha do tempo. Scripts e checkpoints não são gerados automaticamente.'
      } as Record<string,string>)[locale]}</p></section>
      <section className="help-feature-card manual-block" aria-label="Blueprint to Map help"><h4>Blueprint to Map</h4><p>{({
        es:'Estudios → Blueprint to Map. Importá un PNG/JPG/WEBP de hasta 1,5 MB como referencia. Calibrá la escala marcando dos puntos y su distancia en unidades GoldSrc. Trazá muros, habitaciones poligonales o rectangulares; hacé clic cerca de los muros para abrir huecos de puerta o ventana. Enter termina trazados, Esc cancela, rueda acerca/aleja y Shift+arrastrar desplaza. Editá vértices, suelo, techo y medidas. La vista previa 3D revisa los brushes antes de generar. El proyecto guarda la imagen y la edición paramétrica; el MAP solo contiene los brushes. No genera entidades. Ejemplo sv_blueprint_validation en examples/blueprint-to-map-v1813.',
        en:'Studios → Blueprint to Map. Import a PNG/JPG/WEBP reference (up to 1.5 MB). Calibrate by selecting two known points and entering their GoldSrc distance. Trace walls and polygon or rectangle rooms, then add door/window cutouts near wall segments. Enter finishes, Esc cancels, wheel zooms and Shift+drag pans. Edit outline vertices, floor, ceiling and dimensions. The 3D preview validates brushes before generation. Project JSON stores the image and parametric layout; MAP exports brushes only. No gameplay entities. Example: examples/blueprint-to-map-v1813.',
        ru:'Студии → Blueprint to Map: загрузите изображение PNG/JPG/WEBP до 1,5 MB. Укажите две точки и расстояние для масштаба. Рисуйте стены и комнаты, добавляйте дверные/оконные проёмы, редактируйте вершины и смотрите 3D. Проект сохраняет рисунок, а MAP только геометрию.',
        ko:'Studios → Blueprint to Map: PNG/JPG/WEBP 기준 이미지(최대 1.5 MB)를 불러와 두 점의 거리로 축척을 설정합니다. 벽과 방 윤곽, 문/창 개구부, 바닥과 천장을 만들고 3D로 확인하세요. 이미지와 편집 데이터는 프로젝트 JSON에만 저장됩니다.',
        zh:'工作室 → Blueprint to Map：导入 PNG/JPG/WEBP 参考图（最多 1.5 MB），用两点距离校准。绘制墙与房间、门窗开口、地板和天花板，并用 3D 预览检查。图像保存在项目 JSON 中，MAP 仅导出几何。',
        pt:'Estúdios → Blueprint to Map: importe uma planta PNG/JPG/WEBP de até 1,5 MB. Calibre usando dois pontos e a distância. Trace paredes, salas, vãos de portas/janelas, piso e teto. Edite vértices e veja a prévia 3D. A imagem fica no JSON; o MAP exporta apenas brushes.'
      } as Record<string,string>)[locale]??'Blueprint to Map — trace floor plans into valid GoldSrc brushes.'}</p></section>
      <section className="help-feature-card manual-block" aria-label="Co-op Puzzle Builder and Encounter Director help"><h4>Co-op Puzzle Builder · Encounter Director</h4><p>{({
        es:'En Estudios → Co-op Puzzle Builder podés generar entre dos y seis consolas func_button. Restaurar energía crea interruptores persistentes y un game_counter; Acceso simultáneo utiliza multisource, botones temporizados y un trigger_relay de un solo uso. Elegí los puntos XYZ, vinculá un target de puerta, un objetivo de misión y/o una secuencia de eventos. Guardar protege los brushes y las conexiones, y Undo revierte todo el cambio. La pestaña Diagnóstico inspecciona referencias, salidas, misiones y encuentros. En NPC & AI Studio → Smart NPC Encounters consultá Encounter Director para estimaciones de carga y posibles bloqueos de spawns. No distingue jugadores diferentes ni simula IA; probá el BSP compilado. El mapa sv_coop_systems_validation está en examples/advanced-coop-v1812.',
        en:'Open Studios → Co-op Puzzle Builder to create two to six native func_button consoles. Restore power uses persistent switches and game_counter; Simultaneous access uses multisource, timed buttons and a one-shot trigger_relay. Edit XYZ positions and link a door, a mission stage and/or a Dynamic Events sequence. Save protects generated geometry and links; Undo reverts the complete operation. Map Audit checks reference integrity and encounter configuration. NPC & AI Studio → Smart NPC Encounters includes an Encounter Director planning report. The editor does not distinguish unique players or simulate NPC AI; test a compiled BSP. Example: examples/advanced-coop-v1812.',
        ru:'Студии → Co-op Puzzle Builder: от двух до шести кнопок func_button, постоянные переключатели game_counter или таймер multisource с одноразовым trigger_relay. Настройте XYZ, связь с дверью, задачей и событием. Сохранение и Undo защищают сущности. Диагностика проверяет связи и волны. Encounter Director доступен в NPC & AI Studio. Уникальность игроков и ИИ не симулируются; проверьте BSP в Sven Co-op.',
        ko:'Studios → Co-op Puzzle Builder: func_button 콘솔 2–6개를 만들고 독립 스위치 + game_counter 또는 타이머 버튼 + multisource + 일회용 trigger_relay를 선택하세요. XYZ, 문 대상, 미션 및 이벤트를 연결합니다. 저장과 Undo, 맵 진단 및 NPC Encounter Director를 제공합니다. 플레이어 고유성 및 NPC AI는 시뮬레이션하지 않으므로 게임에서 BSP를 테스트하세요.',
        zh:'工作室 → Co-op Puzzle Builder：创建 2–6 个 func_button 控制台，可选持久开关 + game_counter 或定时按钮 + multisource + 一次性 trigger_relay。可编辑 XYZ，并连接门、任务和事件。提供安全保存、撤销、地图诊断和 NPC Encounter Director。不会区分不同玩家，也不模拟 NPC AI；请在游戏中测试 BSP。',
        pt:'Estúdios → Co-op Puzzle Builder: crie de dois a seis consoles func_button. Energia usa interruptores permanentes e game_counter; Acesso simultâneo usa botões temporizados, multisource e trigger_relay de uso único. Edite XYZ, conecte porta, objetivo e evento. Salvar, Desfazer e Diagnóstico protegem a lógica; Encounter Director fica em NPC & AI Studio. Não identifica jogadores diferentes nem simula IA; teste o BSP no jogo.'
      } as Record<string,string>)[locale]}</p></section>
      <section className="help-feature-card manual-shortcuts" id="manual-shortcuts">
        <h4>{manual.shortcutsTitle}</h4><p>{manual.shortcutsHint}</p>
        {shortcutGroups.map(group=><div key={group.id} className="manual-shortcut-group"><h5>{group.title}</h5><div className="manual-shortcut-grid">{group.actions.map(id=>{
          return <div className="manual-shortcut-row" key={id}><span>{locale==='es'?actionTitlesEs[id]:localizedActionTitle(locale,id,actionTitlesEn[id])}</span><kbd>{displayBinding(controls.shortcuts[id])||'—'}</kbd></div>;
        })}</div></div>)}
      </section>
      <h3 className="help-feature-heading" id="manual-studios">{manual.studiosTitle}</h3>
      <div className="help-feature-grid manual-guide-grid">{manual.studios.map(studio=><section className="help-feature-card manual-studio-card" key={studio.title}><h4>{studio.title}</h4><p>{studio.description}</p></section>)}</div>
      <section className="help-feature-card manual-block" id="manual-v23" aria-label={v23Help.title}>
        <h3>{v23Help.title}</h3><p>{v23Help.intro}</p>
        <div className="help-feature-grid manual-guide-grid">{v23Help.cards.map(card=><section key={card.title} className="help-feature-card manual-studio-card"><h4>{card.title}</h4><p>{card.description}</p></section>)}</div>
      </section>
      <section className="help-feature-card manual-block" id="manual-v21" aria-label={v21Help.title}>
        <h3>{v21Help.title}</h3><p>{v21Help.intro}</p>
        <div className="help-feature-grid manual-guide-grid">{v21Help.cards.map(card=><section key={card.title} className="help-feature-card manual-studio-card"><h4>{card.title}</h4><p>{card.description}</p></section>)}</div>
      </section>
      <section className="help-feature-card manual-block" id="manual-current" aria-label={release.title}>
        <h3>{release.title}</h3><p>{release.intro}</p>
      </section>
      <div className="help-feature-grid manual-guide-grid">{release.cards.map(card=><section className="help-feature-card manual-studio-card" key={card.title}><h4>{card.title}</h4><p>{card.description}</p></section>)}</div>
      <div className="help-feature-grid manual-guide-grid">
        {section('workspace',manual.workspaceTitle,manual.workspace)}
        {section('technical',manual.technicalTitle,manual.technical)}
      </div>
      <section className="help-feature-card manual-contact" id="manual-contact">
        <h4>{manual.noticeTitle}</h4><p>{manual.notice}</p>
        <h5>{manual.linksTitle}</h5><p>{manual.contact} · Steam: <a href="https://steamcommunity.com/id/KazamiiSC" target="_blank" rel="noreferrer noopener">steamcommunity.com/id/KazamiiSC</a></p>
      </section>
    </div>
    </div>}
  </div></div>;
}
export function BuildOutputModal({onClose,onCancel,onDoctor,onOpenFolder,onInstall,onPlay,installed=false,hasOutput,allowInstall=true}:{onClose:()=>void;onCancel:()=>void;onDoctor:()=>void;onOpenFolder:()=>void;onInstall:()=>void;onPlay:()=>void;installed?:boolean;hasOutput:boolean;allowInstall?:boolean}){
  const t=useT();
  const locale=useEditor(s=>s.locale);
  const game=useEditor(s=>s.settings.gameProfile==='cs16')?'CS 1.6':'Sven Co-op';
  const captions=({es:['Abrir carpeta',`Instalar en ${game}`,'Probar en el juego','Instalar y probar'],en:['Open output folder',`Install in ${game}`,'Test in game','Install and test'],ru:['Открыть папку',`Установить в ${game}`,'Проверить в игре','Установить и проверить'],ko:['결과 폴더 열기',`${game}에 설치`,'게임에서 테스트','설치 후 테스트'],zh:['打开输出文件夹',`安装到 ${game}`,'在游戏中测试','安装并测试'],pt:['Abrir pasta',`Instalar no ${game}`,'Testar no jogo','Instalar e testar']} as const)[locale];
  const logs=useEditor(s=>s.logs),clear=useEditor(s=>s.clearLogs),busy=useEditor(s=>s.compileBusy);
  const leakPoints=useMapDoctorState(s=>s.trace.length);
  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight})},[logs]);
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card build-output-modal" role="dialog" aria-modal="true" aria-label={t('Output')} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-title"><Terminal size={19}/><span>{t('Output')} · {logs.length}</span>{busy&&<span className="building"><span className="pulse-dot"/> {t('Building...')}</span>}<button onClick={onClose} aria-label={t('Close')}>×</button></div>
      <div className="console-logs" ref={scrollRef}>
        {logs.map((line,i)=><div key={i} className={`${/error|failed|invalid|leak/i.test(line)?'error-log':/success|finished|complete|imported/i.test(line)?'good-log':''}`}><span className="log-index">{String(i+1).padStart(3,'0')}</span>{line}</div>)}
      </div>
      <div className="modal-footer"><button onClick={clear}>{t('Clear')}</button>{busy&&<button onClick={onCancel}>{t('Stop Build')}</button>}{hasOutput&&!busy&&<><button onClick={onOpenFolder}><FolderOpen size={15}/>{captions[0]}</button>{allowInstall&&!installed&&<button onClick={onInstall}><PackagePlus size={15}/>{captions[1]}</button>}{allowInstall&&<button className="play-in-game" onClick={onPlay}><Play size={15}/>{installed?captions[2]:captions[3]}</button>}</>}{leakPoints>1&&!busy&&<button className="go-to-leak" onClick={()=>{useMapDoctorState.getState().setTraceVisible(true);useMapDoctorState.getState().focusTrace(0);onClose();}}><Crosshair size={15}/>{t('Go to leak')}</button>}<button onClick={onDoctor}><ShieldCheck size={15}/> {t('Open Map Doctor')}</button><button className="primary-action" onClick={onClose}>{t('Close')}</button></div>
    </section>
  </div>;
}
