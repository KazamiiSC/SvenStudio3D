#!/usr/bin/env python3
"""Chromium visual CSS fixtures for SvenStudio v1.5.21.

Uses real style.css and representative (not React-rendered) header/ribbon/HUD
markup. A separate Windows DPI/manual application test is still required.
Run with python scripts/verify-adaptive-css-v1521.py (playwright + chromium).
"""
import html,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'docs'/'verification-v1521'/'screenshots-css'
OUTPUT.mkdir(parents=True,exist_ok=True)
CASES=[('1920x1080_100',1920,1080,100),('1920x1080_125',1536,864,125),('1920x1080_150',1280,720,150),('2560x1440_125',2048,1152,125),('1366x768_100',1366,768,100),('1920x1080_200',960,540,200)]


def density(w):return 'minimal' if w<1060 else 'tight' if w<1450 else 'compact' if w<1740 else 'wide'

def frame(width,height,mode,editing):
    compact=width<1650
    ribbon_groups=[('TRANSFORM',('Mover','Rotar','Escalar')),('VISTA',('Malla','Grilla','Etiquetas','Gizmo','Ver ocultos')),('SVENGINE · EDICIÓN DE GEOMETRÍA',('Objeto','Vértice','Arista','Cara')),('TOOLS',('Measure',)),('GRILLA',('Ajustar','32u','1u')),('EDITAR',('Deshacer','Rehacer','Duplicar','Eliminar')),('ESTUDIOS',('Formas','Visibilidad','Diseño','Terrain','Gameplay','NPC','Together','Decals','Doctor','Package'))]
    groups=''.join('<div class="ribbon-group"><div class="ribbon-tools">'+''.join(f'<button class="tool-button" title="{html.escape(x)}"><span style="font-size:20px">◈</span><small>{html.escape(x)}</small></button>' for x in entries)+'</div><small class="ribbon-caption"><span class="ribbon-drag-handle">⠿</span>'+html.escape(label)+'</small></div>' for label,entries in ribbon_groups)
    hud=('hud-editing hud-selected' if editing else '')
    return f'''<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/src/style.css"/>
    <style>html,body,#root{{min-height:0}}.app-shell{{min-height:0}}.app-shell .titlebar{{isolation:initial}}.visual-dock{{display:flex;flex:1;min-height:0;gap:5px;padding:3px}}.visual-panel{{flex:0 0 245px;border:1px solid #344e6b;border-radius:8px;background:#192440;padding:13px;overflow:hidden}}.visual-viewport{{flex:1;min-width:0;position:relative;background:#0c1b2b;overflow:hidden;border:1px solid #3d5678;border-radius:10px}}.demo-brush{{position:absolute;left:18%;top:32%;width:42%;height:44%;background:repeating-linear-gradient(45deg,#a87567,#a87567 14px,#936153 14px,#936153 28px);transform:skewY(-11deg);opacity:.9}}.fixture-title{{position:absolute;bottom:12px;right:20px;color:#a4b9d5;font-size:11px}}.fixture-hud{{top:125px;left:55%}}.fixture-hud .hud-widget-content{{zoom:1}}.fixture-hud .shape-palette{{width:355px}}.fixture-hud .shape-palette-toggle{{padding:8px 13px}}.statusbar{{justify-content:space-between}}</style></head>
    <body><div id="root"><div class="app-shell accent-cyan adaptive-ui-enabled"><header class="titlebar" data-header-mode="{mode}">
    <div class="titlebar-leading"><button class="brand"><span class="brand-logo">◈</span><span>SVEN<span class="brand-light">STUDIO</span></span><span class="brand-tag">3D</span><span class="version-label">v1.5.21</span></button><div class="top-divider"></div><div class="menu-parent"><button class="top-nav">Archivo⌄</button></div><button class="top-nav">Ayuda</button><button class="top-nav fullscreen-nav">⛶ <span>Pantalla completa</span></button><button class="top-nav bt-top-button">♧ BuildTogether</button><div class="titlebar-more-parent"><button class="top-nav titlebar-more" title="Más acciones">☷ <span>Más</span></button></div></div>
    <div class="project-title"><span class="project-status"></span><input value="Untitled Map — Adaptive UI Test" title="Nombre del mapa"/><span class="version-label">Autosaved</span></div>
    <div class="titlebar-right"><div class="bsp-tab-switch"><button>MAP Editor</button><button>◉ BSP Viewer</button><button>▶ Gameplay Test</button></div><div class="studio-menu-parent"><button class="studio-menu-button">Estudios⌄</button></div><label class="language-picker">◉<select><option>Español</option></select></label><div class="studio-menu-parent workspace-menu-parent"><button class="studio-menu-button workspace-menu-button">Área de trabajo⌄</button></div><button class="top-build-settings">⚙ Configuración de compilación</button><button class="top-compile" title="Compilar mapa">▶ Compilar mapa</button></div>
    </header><main class="sven-workstack" style="display:flex;flex-direction:column;flex:1;min-height:0"><div class="studio-body toolbar-top {'adaptive-compact' if compact else ''}"><div class="ribbon-shell"><div class="toolbar-dock-heading"><span class="drag-grip">⠿ HERRAMIENTAS</span><select class="pane-side-select"><option>Arriba</option></select></div><div class="ribbon">{groups}</div></div>
    <div class="visual-dock"><div class="visual-panel"><h4>BIBLIOTECA DE RECURSOS</h4><p>Explorador de entidades</p><p>info_player_start</p><p>monster_zombie</p></div><div class="visual-viewport viewport-frame"><div class="demo-brush"></div><div class="hud-widget hud-shapes fixture-hud {hud}" style="left:clamp(0px,55%,max(0px,calc(100% - {130 if editing else 355}px)))" data-hud-id="shapes">{'<div class="hud-widget-bar"><button class="hud-widget-drag">⠿ Formas</button><button class="hud-widget-resize">⤢</button></div>' if editing else ''}<div class="hud-widget-content"><div class="shape-palette {'shape-palette-hud-editing' if editing else ''}"><button class="shape-palette-toggle">◈ Formas ⌄</button></div></div></div><div class="fixture-title">Prueba de CSS · {'Editar HUD' if editing else 'HUD normal'}</div></div><div class="visual-panel"><h4>PROPIEDADES</h4><p>worldspawn</p><p>skyname: desert</p></div></div></div></main><footer class="statusbar"><div>● Listo · Svengine · Valve 220</div><div>SvenStudio 3D v1.5.21</div></footer></div></div></body></html>'''


def metrics(page):
 return page.evaluate('''()=>{
  const sel=s=>document.querySelector(s),r=e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,right:q.right,bottom:q.bottom,width:q.width,height:q.height}};
  const head=r(sel('.titlebar')),lead=r(sel('.titlebar-leading')),name=r(sel('.project-title')),right=r(sel('.titlebar-right'));
  const ribbon=sel('.ribbon'),rr=r(ribbon),caps=[...document.querySelectorAll('.ribbon-caption')].map(r);
  const hud=sel('.hud-shapes'),hr=r(hud),vp=r(sel('.viewport-frame'));
  return {head,lead,name,right,ribbon:rr,hud:hr,viewport:vp, visibleHeader:lead.right<=name.x+1 && name.right<=right.x+1 && right.right<=head.right+1 && lead.x>=head.x-1,
    captionVerticalOk:caps.every(c=>c.bottom<rr.bottom-4),hudInViewport:hr.right<=vp.right+1&&hr.bottom<=vp.bottom+1,hudBorder:getComputedStyle(hud).borderColor,
    docScrollX:document.documentElement.scrollWidth>window.innerWidth+1,docScrollY:document.documentElement.scrollHeight>window.innerHeight+1,clientWidth:window.innerWidth,captionLast:caps[caps.length-1],
    ribbonScrollWidth:ribbon.scrollWidth,ribbonClientWidth:ribbon.clientWidth};
 }''')

CSS=(ROOT/'src/style.css').read_text(encoding='utf-8')
CSS=CSS.replace("@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750;800&display=swap');",'')
results=[]
with sync_playwright() as p:
 browser_path=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(executable_path=browser_path,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for key,w,h,scale in CASES:
  for editing in (False,True):
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   doc=OUTPUT/(key+('_edit' if editing else '_normal')+'.html')
   markup=frame(w,h,density(w),editing).replace('<link rel="stylesheet" href="/src/style.css"/>','<style>'+CSS+'</style>')
   doc.write_text(markup,encoding='utf-8')
   page.set_content(markup,wait_until='domcontentloaded')
   page.screenshot(path=str(OUTPUT/(key+('_edit' if editing else '_normal')+'.png')),animations='disabled')
   obj=metrics(page);obj.update({'case':key,'physical':f'{int(w*scale/100)}x{int(h*scale/100)}','scale':scale,'editing':editing})
   results.append(obj)
   print(key,'editing',editing, 'header',obj['visibleHeader'],'caption',obj['captionVerticalOk'],'hud',obj['hudInViewport'],'scroll',obj['docScrollX'],obj['docScrollY'],flush=True)
   page.close()
 browser.close()
(OUTPUT.parent/'css_visual_results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('OUTPUT:',OUTPUT)
