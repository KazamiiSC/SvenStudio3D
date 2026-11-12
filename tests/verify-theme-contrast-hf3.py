"""Optional browser contrast audit for SvenStudio Themes HF3.
Requires Python playwright and a local Chromium binary (CHROMIUM_PATH).
This uses source-class representative structures, NOT a full SvenStudio run.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,sys
base=Path(__file__).resolve().parents[1]
fixture=(base/'tests/interface-theme-hf3-fixture.html').read_text()
css=['style.css','uiPreview2.css'] + [
  'components/blueprintToMapStudio.css','components/coopPuzzleStudio.css',
  'components/encounterDesigner.css','components/gameplayDesigner.css',
  'components/missionEventsStudio.css',
  'interfaceThemes.css','interfaceThemeFixes.css','interfaceThemeComponents.css'
]
styles='\n'.join('<style>'+ (base/'src'/name).read_text()+'</style>' for name in css)
fixture=fixture.replace('<head>','<head>'+styles,1)
scan=r'''() => {
const parse=v=>{let m=v.match(/rgba?\(([^)]+)\)/); if(!m)return null;let x=m[1].replaceAll(',',' ').split(/\s+/).filter(x=>x!=''&&x!='/').map(Number);return x.length>=3?[x[0],x[1],x[2],x[3]===undefined?1:x[3]]:null};
const blend=(fg,bg)=>fg.slice(0,3).map((n,i)=>n*fg[3]+bg[i]*(1-fg[3]));
const actualBg=el=>{let stack=[];for(let node=el;node;node=node.parentElement){let bg=parse(getComputedStyle(node).backgroundColor);if(bg&&bg[3]>0)stack.push(bg)};let c=[255,255,255];for(let col of stack.reverse())c=blend(col,c);return c};
const lum=x=>{let channels=x.map(c=>c/255).map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]};
let failures=[];let count=0;let all=[];
for(let el of document.querySelectorAll('.audit-section :is(p,span,strong,small,label,h2,h3,h4,button,input,select,output)')){
 let rect=el.getBoundingClientRect();let s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden'||rect.width<2||rect.height<2||s.opacity==0)continue;
 let txt=(el.innerText||el.value||'').replace(/\s+/g,' ').trim();if(!txt)continue;
 let ink=parse(s.color);let bg=actualBg(el);if(!ink)continue;
 let fg=blend(ink,bg);let a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 let disabled=(el.matches(':disabled') || !!el.closest(':disabled'));
 let stage=!!el.closest('.npc-model-canvas,.terrain-canvas,.pf3d-stage,.sound-waveform,.bsp-canvas');
 if(stage)continue;
 count++;let label={text:txt.slice(0,45),className:typeof el.className==='string'?el.className:'',ratio:Math.round(ratio*100)/100,bg:bg.map(Math.round),fg:fg.map(Math.round),disabled};
 if(ratio<(disabled?2.7:4.5)){failures.push(label)}
 all.push(label)
}
const overflows=[...document.querySelectorAll('.audit-section')].map(el=>({name:el.className,diff:el.scrollWidth-el.clientWidth})).filter(e=>e.diff>8);
return {count,failures:failures.slice(0,100),overflow:overflows, worst:all.sort((a,b)=>a.ratio-b.ratio).slice(0,15)}
}'''
with sync_playwright() as p:
  chrome=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
  browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-gpu'])
  page=browser.new_page(viewport={'width':1366,'height':850})
  page.set_content(fixture)
  bad=[];evaluations=0;checks=0
  for theme in ['modern','win98','cyber','goldsrc','xp','midnight']:
    for accent in ['ice','nebula','ember','mint','orchid','gold']:
      page.evaluate('([theme,accent])=>{document.documentElement.dataset.svenTheme=theme;document.documentElement.dataset.svenAccent=accent}',[theme,accent])
      output=page.evaluate(scan);evaluations+=1;checks+=output['count']
      if output['failures']:bad.append((theme,accent,output['failures']))
  for theme in ['modern','win98','cyber','goldsrc','xp','midnight']:
    for size in [(1366,850),(1024,768),(800,650)]:
      page.set_viewport_size({'width':size[0],'height':size[1]})
      page.evaluate('t=>{document.documentElement.dataset.svenTheme=t;document.documentElement.dataset.svenAccent="ice"}',theme)
      output=page.evaluate(scan);evaluations+=1;checks+=output['count']
      if output['failures'] or output['overflow']:bad.append((theme,size,output['failures'],output['overflow']))
  browser.close()
print(f'HF3 theme contrast: {evaluations} combinations; {checks} text checks; {len(bad)} issues')
for issue in bad[:20]:print('FAIL',issue)
sys.exit(1 if bad else 0)
