import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useEditor} from '../store';
import {getBrushBatchSummary,formatMapRenderReport,type MapRenderSample} from '../engine/mapRenderDiagnostics';

type MonitorDom={badge:HTMLButtonElement;panel:HTMLElement;details:HTMLElement;copy:HTMLButtonElement;download:HTMLButtonElement;close:HTMLButtonElement};
const diagnosticCopy={
  es:{title:'Diagnóstico MAP · HF17 HF5',help:'No modifica el mapa. Revisá las caras NULL ocultas y compará el mismo lugar con agrupación activada y desactivada.',copy:'Copiar informe',download:'Descargar TXT',close:'Cerrar',tip:'FPS · clic para diagnóstico'},
  en:{title:'MAP diagnostics · HF17 HF5',help:'Read-only. Check hidden NULL faces and compare batching at the same camera position.',copy:'Copy report',download:'Download TXT',close:'Close',tip:'FPS · click for diagnostics'},
  ru:{title:'Диагностика MAP · HF17 HF5',help:'Только чтение. Проверьте скрытые грани NULL и сравните группировку при одной позиции камеры.',copy:'Копировать отчёт',download:'Скачать TXT',close:'Закрыть',tip:'FPS · диагностика'},
  ko:{title:'MAP 진단 · HF17 HF5',help:'읽기 전용. 숨겨진 NULL 면과 동일한 카메라 위치에서의 브러시 병합 효과를 비교하세요.',copy:'보고서 복사',download:'TXT 다운로드',close:'닫기',tip:'FPS · 진단 열기'},
  zh:{title:'MAP 诊断 · HF17 HF5',help:'只读。检查隐藏的 NULL 面，并在相同相机位置比较笔刷合批效果。',copy:'复制报告',download:'下载 TXT',close:'关闭',tip:'FPS · 点击诊断'},
  pt:{title:'Diagnóstico MAP · HF17 HF5',help:'Somente leitura. Confira as faces NULL ocultas e compare o agrupamento na mesma câmera.',copy:'Copiar relatório',download:'Baixar TXT',close:'Fechar',tip:'FPS · clique para diagnóstico'},
} as const;

/** HF17 HF5: FPS and read-only WebGL draw statistics. Updates the DOM once
 * per second, never the React scene or Zustand store. A single
 * gl.info.reset() runs at the start of each tick to include all render passes;
 * no readPixels(), GPU timer queries or costly scene traversal. */
export function MapPerformanceMonitor(){
  const {gl}=useThree();
  const dom=useRef<MonitorDom|null>(null);
  const values=useRef({frames:0,start:0});
  const last=useRef<MapRenderSample|null>(null);
  const rendererName=useRef('WebGL renderer not reported');
  const priorAutoReset=useRef<boolean|null>(null);
  const lastCompletedRender=useRef({drawCalls:0,triangles:0,lines:0});
  useEffect(()=>{
    const frame=gl.domElement.closest<HTMLElement>('.viewport-frame');
    const parent=frame?.querySelector<HTMLElement>('[data-map-fps-mount]');
    if(!parent||!frame)return;
    try{
      const context=gl.getContext();
      const extension=context.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_RENDERER_WEBGL:number}|null;
      rendererName.current=String(context.getParameter(extension?.UNMASKED_RENDERER_WEBGL??context.RENDERER)||'WebGL');
    }catch{rendererName.current='WebGL renderer not reported'}
    // R3F renders after useFrame; helpers such as GizmoHelper can render
    // another pass and otherwise reset THREE.WebGLInfo. Disable auto-reset
    // while this monitor is mounted and reset exactly once at the START of
    // each animation tick. The next tick can then read all passes of the
    // completed previous frame, not just its last overlay (9 draw calls).
    priorAutoReset.current=gl.info.autoReset;
    gl.info.autoReset=false;
    gl.info.reset();
    const state=useEditor.getState();
    const language=state.locale as keyof typeof diagnosticCopy;
    const words=diagnosticCopy[language]||diagnosticCopy.en;
    const badge=document.createElement('button');
    badge.type='button';badge.className='map-performance-monitor';
    badge.setAttribute('aria-label',words.tip);badge.title=words.tip;
    badge.setAttribute('data-map-performance','true');badge.textContent='— FPS';
    const panel=document.createElement('section');panel.className='map-render-diagnostic';
    panel.setAttribute('role','region');panel.setAttribute('aria-label',words.title);panel.hidden=true;
    const heading=document.createElement('strong');heading.textContent=words.title;
    const help=document.createElement('p');help.textContent=words.help;
    const details=document.createElement('pre');details.textContent='—';
    const actions=document.createElement('div');actions.className='map-render-diagnostic-actions';
    const copy=document.createElement('button');copy.type='button';copy.textContent=words.copy;
    const download=document.createElement('button');download.type='button';download.textContent=words.download;
    const close=document.createElement('button');close.type='button';close.textContent=words.close;
    actions.append(copy,download,close);panel.append(heading,help,details,actions);
    const report=()=>last.current?formatMapRenderReport(last.current):'';
    const hide=()=>{panel.hidden=true;badge.setAttribute('aria-expanded','false')};
    badge.setAttribute('aria-expanded','false');
    badge.addEventListener('click',()=>{
      const show=panel.hidden;panel.hidden=!show;badge.setAttribute('aria-expanded',String(show));
      if(show&&last.current)details.textContent=formatMapRenderReport(last.current);
    });
    close.addEventListener('click',hide);
    copy.addEventListener('click',()=>{const data=report();if(!data)return;
      if(!navigator.clipboard?.writeText){download.click();return;}
      void navigator.clipboard.writeText(data).catch(()=>{download.click()});
    });
    download.addEventListener('click',()=>{
      const data=report();if(!data)return;
      const uri=URL.createObjectURL(new Blob([data],{type:'text/plain;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=uri;anchor.download='SvenStudio_HF17_HF4_MAP_Render_Diagnostic.txt';
      document.body.append(anchor);anchor.click();anchor.remove();
      // Revocation after the synchronous click avoids dropping the download.
      window.setTimeout(()=>URL.revokeObjectURL(uri),500);
    });
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!panel.hidden){hide();event.stopPropagation()}};
    window.addEventListener('keydown',onKey);
    parent.append(badge);frame.append(panel);
    dom.current={badge,panel,details,copy,download,close};
    values.current={frames:0,start:0};
    return()=>{
      window.removeEventListener('keydown',onKey);
      if(priorAutoReset.current!==null){gl.info.autoReset=priorAutoReset.current;gl.info.reset();priorAutoReset.current=null;}
      badge.remove();panel.remove();if(dom.current?.badge===badge)dom.current=null;
    };
  },[gl]);
  useFrame(({clock})=>{
    const nodes=dom.current;if(!nodes)return;
    // This callback runs before the main R3F render and before helper passes.
    // Sample the completed previous frame, then clear counters for this tick.
    // In particular, do not sample the *current* incomplete frame.
    lastCompletedRender.current={drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,lines:gl.info.render.lines};
    gl.info.reset();
    const v=values.current;
    if(v.start===0)v.start=clock.elapsedTime;
    v.frames++;
    const elapsed=clock.elapsedTime-v.start;
    if(elapsed<1)return;
    const fps=Math.round(v.frames/Math.max(.01,elapsed));
    nodes.badge.textContent=`${fps} FPS`;
    const state=useEditor.getState();
    const objects=state.project.objects;
    last.current={
      timestamp:new Date().toISOString(),fps,frameMs:1000*Math.max(.01,elapsed)/v.frames,
      drawCalls:lastCompletedRender.current.drawCalls,triangles:lastCompletedRender.current.triangles,lines:lastCompletedRender.current.lines,
      geometries:gl.info.memory.geometries,gpuTextures:gl.info.memory.textures,wadAssets:state.textureAssets.length,
      pixelWidth:gl.domElement.width,pixelHeight:gl.domElement.height,dpr:gl.getPixelRatio(),
      renderer:rendererName.current,browser:navigator.userAgent,
      brushes:objects.filter(o=>o.kind==='brush').length,entities:objects.filter(o=>o.kind==='entity').length,
      mode:state.wireframe?'Wireframe':state.solidShading?'Solid':'Textured',
      batchReturn:getBrushBatchSummary(),
    };
    if(!nodes.panel.hidden)nodes.details.textContent=formatMapRenderReport(last.current);
    v.frames=0;v.start=clock.elapsedTime;
  },-1000);
  return null;
}
