const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');
const out=path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),'visual');fs.mkdirSync(out,{recursive:true});
const themes={win98:'Windows 98',xp:'Windows XP',goldsrc:'GoldSrc Workshop',modern:'Modern Dark',cyber:'Cyber Neon',midnight:'Midnight Minimal'};
const sizes=[[1920,1080],[1600,900],[1366,768],[1280,720],[1024,768]];
const targets=[
 ['map',null,'.app-shell'],['appearance','appearance','.layout-modal'],
 ['prefabs','Estudio de Prefabricados','.pfstudio-dialog'],['blueprint','Blueprint to Map · Planos','.bp-shell'],
 ['world','Estudio de Construcción de Mundos','.terrain-shell'],['gameplay','Lógica de juego','.gs-shell,.gs-v3-shell,.gs-v31-shell,.gds-root'],
 ['mission','Misiones y campañas','.me-studio'],['npc','NPC y rutas','.npc-shell'],
 ['lighting','Iluminación y entorno','.lighting-studio'],['sound','Editor de audio','.sound-studio'],
 ['cinematic','Cámaras cinematográficas','.cine-shell'],['doctor','Diagnóstico del mapa','.map-doctor'],
 ['buildtogether','BuildTogether','.buildtogether-dialog,.modal-card'],['smartbuild','Configuración de compilación','.sb-shell'],
 ['packager','Empaquetador de mapas','.mp-shell'],['controls','Controles de cámara y gizmo','.controls-card'],
 ['entityappearance','Apariencia de entidades','.modal-card'],['visibility','Visibilidad','.visibility-manager'],
 ['materials','tab:Material & Surface Studio','.material-studio'],['decals','tab:Decal Studio','.decal-studio'],
 ['wad','tab:Explorador de texturas','.asset-panel'],['models','tab:Model Browser (.mdl)','.model-browser'],
 ['texture','uv','.texture-studio-panel'],['truelighting','True Lighting','.true-light-panel'],
 ['filemenu','file','.topbar-floating-menu'],['studiosmenu','studios','.topbar-floating-menu'],['workspacemenu','workspace','.topbar-floating-menu']
];
async function metrics(page,root){return page.evaluate(selector=>{
 const host=document.querySelector(selector);if(!host)return {missing:selector};
 const rgb=s=>{const a=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [a[0],a[1],a[2],a[3]??1]};
 const luminance=c=>c.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
 function background(el){if(!el)return [255,255,255,1];let st=getComputedStyle(el),c=rgb(st.backgroundColor);const gradient=st.backgroundImage.match(/rgba?\([^)]+\)/);if(gradient)c=rgb(gradient[0]);if(c[3]>=.99)return c;let p=background(el.parentElement);return c.map((v,i)=>i<3?v*c[3]+p[i]*(1-c[3]):1)}
 const low=[],clipped=[],seen=new Set();let inspected=0,disabled=0,scroll=[];
 for(const el of host.querySelectorAll('*')){
  const r=el.getBoundingClientRect(),c=getComputedStyle(el);if(r.width<1||r.height<1||c.visibility==='hidden'||c.display==='none'||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;
  if(el.scrollHeight>el.clientHeight+3&&['auto','scroll'].includes(c.overflowY)){const old=el.scrollTop;el.scrollTop=old===0?1:0;scroll.push({class:el.className,moves:el.scrollTop!==old});el.scrollTop=old;}
  if(el.matches(':disabled'))disabled++;
  if(el.closest('canvas,svg,.entity-world-label,.npc-model-canvas,.pf3d-stage,.model-preview,.texture-studio-preview,.ss-home,.me-map,.gds-map-area'))continue;
  const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();if(!text)continue;
  const hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)));if(hit&&!el.contains(hit)&&!hit.contains(el))continue;
  inspected++;const fg=rgb(c.color),bg=background(el),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const key=el.className+'|'+text.slice(0,35);if(ratio<4.5&&!seen.has(key)){seen.add(key);low.push({class:el.className,text:text.slice(0,90),ratio:+ratio.toFixed(2),fg:c.color,bg:bg.slice(0,3),disabled:el.matches(':disabled')});}
  if(el.matches('button,input,select,textarea')&&(r.right>innerWidth+1||r.left< -1||r.bottom>innerHeight+1||r.top< -1))clipped.push({class:el.className,text:text.slice(0,50)});
 }
 const r=host.getBoundingClientRect();return {inspected,disabled,lowContrast:low.slice(0,50),clipped:clipped.slice(0,30),scroll,rect:{x:r.x,y:r.y,width:r.width,height:r.height},outside:r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1};
},root)}
async function boot(p){await p.goto(process.env.SVEN_AUDIT_URL || 'http://127.0.0.1:5173',{waitUntil:'domcontentloaded',timeout:30000});await p.locator('.ss-home-start').click();}
async function open(p,action){
 if(!action)return;
 if(action==='appearance')return p.locator('.top-appearance-button').click();
 if(action.startsWith('tab:'))return p.locator('.asset-tabs button').filter({has:p.locator('nothing')}).count().then(()=>p.locator(`.asset-tabs button[title="${action.slice(4)}"]`).click());
 if(action==='uv')return p.locator('.viewport-uv-toggle').count().then(async n=>{if(n)await p.locator('.viewport-uv-toggle').click();else await p.getByRole('button',{name:'Texture Studio',exact:true}).click()});
 if(action==='file')return p.getByRole('button',{name:'Archivo',exact:true}).click();
 if(action==='studios')return p.locator('[aria-controls="sven-studios-menu"]').click();
 if(action==='workspace')return p.locator('[aria-controls="sven-workspace-menu"]').click();
 await p.locator('[aria-controls="sven-studios-menu"]').click();let item=p.getByRole('menuitem',{name:action,exact:true});
 if(!await item.count()){await p.keyboard.press('Escape');await p.setViewportSize({width:1366,height:768});await p.locator('.titlebar-more').click();item=p.getByRole('menuitem',{name:action,exact:true});}
 await item.click();
}
module.exports={themes,sizes,metrics,boot,open};
if(require.main===module)(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});
 const p=await browser.newPage({viewport:{width:1920,height:1080}});p.setDefaultTimeout(5000); await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.addInitScript(()=>localStorage.setItem('svenstudio:welcome-guide-v1','seen'));
 const rows=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const [theme,label] of Object.entries(themes)){
  if(process.env.ONLY_THEME&&theme!==process.env.ONLY_THEME)continue;
  await p.setViewportSize({width:1920,height:1080});await boot(p);await p.locator('.top-appearance-button').click();await p.locator('.studio-theme-card').filter({hasText:label}).click();await p.keyboard.press('Escape');
  for(const [name,action,selector] of targets){
   await p.setViewportSize({width:1920,height:1080});await boot(p);
   try{await open(p,action);await p.locator(selector).first().waitFor({state:'visible'});}
   catch(e){rows.push({theme,window:name,status:'NOT_OPENED',reason:e.message.split('\n')[0]});fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({rows,errors},null,2));console.log(theme,name,'NOT_OPENED');continue;}
   for(const [width,height] of sizes){
    await p.setViewportSize({width,height});await p.waitForTimeout(120);
    const m=await metrics(p,selector);let screenshot;
    if(width===1366||name==='map'){screenshot=`${theme}--${name}--${width}x${height}.png`;await p.screenshot({path:path.join(out,screenshot)});}
    rows.push({theme,window:name,width,height,status:'OPENED',...m,screenshot});
   }
   fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({rows,errors},null,2));console.log(theme,name,'OPENED');
  }
 }
 await browser.close();console.log('Rows',rows.length);
})().catch(e=>{console.error(e);process.exitCode=1});





