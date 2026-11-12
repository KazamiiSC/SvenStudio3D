const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');const {themes,boot,open}=require('./audit-browser.cjs');
const cases=['visual','visual-bsp','visual-extra'].flatMap(d=>JSON.parse(fs.readFileSync(path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),d,'matrix.json'))).rows).concat(JSON.parse(fs.readFileSync(path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),'visual-more/matrix.json'))).rows).filter(r=>r.clipped?.length&&r.window!=='map');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});const p=await browser.newPage({viewport:{width:1920,height:1080}});p.setDefaultTimeout(4000);await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.addInitScript(()=>localStorage.setItem('svenstudio:welcome-guide-v1','seen'));const results=[];
for(const [theme,label] of Object.entries(themes)){
 await p.setViewportSize({width:1920,height:1080});await boot(p);await p.locator('.top-appearance-button').click();await p.locator('.studio-theme-card').filter({hasText:label}).click();await p.keyboard.press('Escape');
 for(const r of cases.filter(r=>r.theme===theme)){
  await p.setViewportSize({width:1920,height:1080});await boot(p);
  try{
   if(r.window==='appearance')await open(p,'appearance');
   else if(r.window==='world')await open(p,'Estudio de Construcción de Mundos');
   else if(['mission','events'].includes(r.window)){await open(p,'Misiones y campañas');if(r.window==='events')await p.locator('.me-modes button').nth(1).click();}
   else if(r.window==='encounters'){await open(p,'NPC y rutas');await p.getByRole('button',{name:'Smart NPC Encounters 2.0',exact:true}).click();}
   else if(['light-textures','sky-enclosure'].includes(r.window)){await open(p,'Iluminación y entorno');if(r.window==='light-textures')await p.locator('.al-tabs button').nth(1).click();else await p.locator('.sky-enclosure-builder').scrollIntoViewIfNeeded();}
   else if(r.window==='bsp-entity-properties'){await p.getByRole('button',{name:'Editor BSP',exact:true}).click();await p.locator('input[accept=".bsp"]').setInputFiles(path.resolve(__dirname,'../../tests/fixtures/maptest1_lighting_v159.bsp'));await p.locator('.bsp-browser-tile').filter({hasText:'info_player_start'}).click();}
   await p.setViewportSize({width:r.width,height:r.height});
   for(const c of r.clipped){const control=p.getByRole('button').filter({hasText:c.text}).first();await control.scrollIntoViewIfNeeded();let rect=await control.boundingBox();let reachable=rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=r.width+1&&rect.y+rect.height<=r.height+1;results.push({theme,window:r.window,width:r.width,height:r.height,text:c.text,reachableAfterScroll:!!reachable,rect});}
  }catch(e){results.push({theme,window:r.window,width:r.width,height:r.height,error:e.message.split('\n')[0]});}
  fs.writeFileSync(path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),'reachability.json'),JSON.stringify(results,null,2));
 }
 console.log(theme,'scroll reachability checked');
}
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
