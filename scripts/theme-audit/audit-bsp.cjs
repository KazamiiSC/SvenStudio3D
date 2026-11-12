const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');const {themes,sizes,metrics,boot}=require('./audit-browser.cjs');
const project=path.resolve(__dirname,'../..'),out=path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),'visual-bsp');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});const p=await browser.newPage({viewport:{width:1920,height:1080}});p.setDefaultTimeout(6000);await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.addInitScript(()=>localStorage.setItem('svenstudio:welcome-guide-v1','seen'));
const rows=[],errors=[],exports=[];p.on('pageerror',e=>errors.push(e.message));
async function load(){await p.setViewportSize({width:1920,height:1080});await boot(p);await p.getByRole('button',{name:'Editor BSP',exact:true}).click();await p.locator('input[accept=".bsp"]').setInputFiles(path.join(project,'tests/fixtures/maptest1_lighting_v159.bsp'));await p.locator('.bsp-viewer').waitFor();await p.locator('input[accept=".wad"]').setInputFiles(path.join(project,'public/svstudio.wad'));await p.waitForTimeout(250);}
async function face(){await p.getByRole('button',{name:'Caras',exact:true}).click();const c=p.locator('.bsp-canvas canvas');await c.click({position:{x:Math.min(450,(await c.boundingBox()).width/2),y:280}});}
const targets=[
 ['bsp-editor','.bsp-viewer',async()=>{}],
 ['bsp-viewer','.bsp-viewer',async()=>p.getByRole('button',{name:'Visor BSP',exact:true}).click()],
 ['bsp-entity-properties','.bsp-viewer',async()=>p.locator('.bsp-browser-tile').filter({hasText:'info_player_start'}).click()],
 ['bsp-faces','.bsp-viewer',face],
 ['bsp-regions','.bsp-viewer',async()=>{await p.getByRole('button',{name:'Regiones',exact:true}).click();await p.locator('.bsp-canvas canvas').click({position:{x:450,y:280}})}],
 ['bsp-texture','.bsp-texture-studio-panel',face],
 ['bsp-wad','.bsp-wad-library-panel',face],
 ['bsp-lightmap','.bsp-lightmap-studio',async()=>{await face();await p.getByRole('button',{name:'Abrir Lightmap Studio',exact:true}).click();}],
 ['bsp-models','.bsp-library',async()=>p.getByRole('button',{name:'Modelos',exact:true}).click()],
 ['bsp-recovery','.bsp-recovery',async()=>{await p.getByRole('button',{name:'Visor BSP',exact:true}).click();await p.getByTitle('Recuperación BSP',{exact:true}).click()}],
 ['bsp-flight','.bsp-viewer',async()=>p.getByRole('button',{name:'Ajustes de vuelo',exact:true}).click()]
];
for(const [theme,label] of Object.entries(themes)){
 await p.setViewportSize({width:1920,height:1080});await boot(p);await p.locator('.top-appearance-button').click();await p.locator('.studio-theme-card').filter({hasText:label}).click();await p.keyboard.press('Escape');
 for(const [name,selector,action] of targets){
  try{await load();await action();await p.locator(selector).first().waitFor({state:'visible'});
   for(const [width,height] of sizes){await p.setViewportSize({width,height});await p.waitForTimeout(150);const m=await metrics(p,selector);let screenshot;if(width===1366){screenshot=`${theme}--${name}--${width}x${height}.png`;await p.screenshot({path:path.join(out,screenshot)});}rows.push({theme,window:name,width,height,status:'OPENED',...m,screenshot});}
   if(name==='bsp-lightmap'){const pixels=await p.locator('.bsp-lightmap-preview canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {width:c.width,height:c.height,rgbSum:a.reduce((n,v,i)=>n+(i%4===3?0:v),0)}});rows[rows.length-1].previewPixels=pixels;}
   console.log(theme,name,'OPENED');
  }catch(e){rows.push({theme,window:name,status:'NOT_OPENED',reason:e.message.split('\n')[0]});console.log(theme,name,'NOT_OPENED');}
  fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({rows,errors,exports},null,2));
 }
 try{await load();await p.locator('.bsp-browser-tile').filter({hasText:'info_player_start'}).click();await p.getByRole('tab',{name:'Edición RAW',exact:true}).click();await p.getByRole('textbox',{name:'angles value',exact:true}).fill('0 90 0');await p.getByRole('textbox',{name:'angles value',exact:true}).press('Tab');const [d]=await Promise.all([p.waitForEvent('download'),p.locator('.bsp-export-button').click()]);const dest=path.join(out,`${theme}--export.bsp`);await d.saveAs(dest);exports.push({theme,name:d.suggestedFilename(),bytes:fs.statSync(dest).size,change:'info_player_start angles: 0 90 0 (test copy only)'});}catch(e){exports.push({theme,error:e.message.split('\n')[0]})}
 fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({rows,errors,exports},null,2));
}
await browser.close();console.log('Rows',rows.length);
})().catch(e=>{console.error(e);process.exitCode=1});

