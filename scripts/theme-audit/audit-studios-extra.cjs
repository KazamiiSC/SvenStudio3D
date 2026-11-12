const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');const {themes,sizes,metrics,boot,open}=require('./audit-browser.cjs');
const out=path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),process.env.EXTRA_MORE?'visual-more':'visual-extra');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});const p=await browser.newPage({viewport:{width:1920,height:1080}});p.setDefaultTimeout(6000);await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.addInitScript(()=>localStorage.setItem('svenstudio:welcome-guide-v1','seen'));
const rows=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
const targets=[
 ['events','.me-studio',async()=>{await open(p,'Misiones y campañas');await p.locator('.me-modes button').nth(1).click()}],
 ['puzzle','.cpz-shell',async()=>{await open(p,'Misiones y campañas');await p.getByRole('button',{name:'Co-op Puzzle Builder',exact:true}).click()}],
 ['encounters','.enc-shell',async()=>{await open(p,'NPC y rutas');await p.getByRole('button',{name:'Smart NPC Encounters 2.0',exact:true}).click()}],
 ['customnpc','.custom-npc-shell',async()=>{await open(p,'NPC y rutas');await p.getByRole('button',{name:'Importar NPC personalizado (AngelScript)',exact:true}).click()}],
 ['converter','.audio-converter',async()=>{await open(p,'Editor de audio');await p.locator('.sound-convert-entry').click()}],
 ['rocks','.terrain-shell',async()=>{await open(p,'Estudio de Construcción de Mundos');await p.locator('.terrain-tabs button').nth(1).click()}],
 ['paths','.terrain-shell',async()=>{await open(p,'Estudio de Construcción de Mundos');await p.locator('.terrain-tabs button').nth(2).click()}],
 ['curves','.terrain-shell',async()=>{await open(p,'Estudio de Construcción de Mundos');await p.locator('.terrain-tabs button').nth(3).click()}],
 ['workshop','.bw-dialog',async()=>p.evaluate(()=>document.dispatchEvent(new CustomEvent('svenstudio:open-studio',{detail:'workshop'})))],
 ['shapes','.shape-palette-panel',async()=>p.locator('.shape-palette-toggle').click()],
 ['entityguide','.entity-guide-dialog',async()=>p.locator('.entity-guide-icon').first().click()],
 ['help','.help-dialog,.about-card',async()=>open(p,'Ayuda')],
 ['architecture','.shape-palette-panel',async()=>{await p.locator('.shape-palette-toggle').click();await p.getByRole('button',{name:'Architecture Mode',exact:true}).click()}],
 ['architecturelegacy','.shape-palette-panel',async()=>{await p.locator('.shape-palette-toggle').click();await p.getByRole('button',{name:'Architecture Mode',exact:true}).click();await p.locator('.arch-mode-legacy>summary').click()}],
 ['light-textures','.lighting-studio',async()=>{await open(p,'Iluminación y entorno');await p.locator('.al-tabs button').nth(1).click()}],
 ['light-rad','.lighting-studio',async()=>{await open(p,'Iluminación y entorno');await p.locator('.al-tabs button').nth(2).click()}],
 ['light-styles','.lighting-studio',async()=>{await open(p,'Iluminación y entorno');await p.locator('.al-tabs button').nth(3).click()}],
 ['sky-enclosure','.lighting-studio',async()=>{await open(p,'Iluminación y entorno');await p.locator('.sky-enclosure-builder').scrollIntoViewIfNeeded()}],
 ['hud','.hud-editor-panel',async()=>p.locator('.hud-editor-toggle').click()],
 ['folderpicker','.folder-picker',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-path button').first().click()}],
 ['buildoutput','.build-output-modal',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-output-nav').click()}],
 ['smartbuild-textures','.sb-shell',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-nav button').nth(1).click()}],
 ['smartbuild-destination','.sb-shell',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-nav button').nth(2).click()}],
 ['smartbuild-resources','.sb-shell',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-nav button').nth(3).click()}],
 ['smartbuild-advanced','.sb-shell',async()=>{await open(p,'Configuración de compilación');await p.locator('.sb-nav button').nth(4).click()}]
];
for(const [theme,label] of Object.entries(themes)){
 await p.setViewportSize({width:1920,height:1080});await boot(p);await p.locator('.top-appearance-button').click();await p.locator('.studio-theme-card').filter({hasText:label}).click();await p.keyboard.press('Escape');
 for(const [name,selector,action] of (process.env.EXTRA_MORE?targets.slice(12):targets.slice(0,12))){
  if(process.env.ONLY_WINDOWS&&!process.env.ONLY_WINDOWS.split(',').includes(name))continue;
  await p.setViewportSize({width:1920,height:1080});await boot(p);
  try{await action();await p.locator(selector).first().waitFor({state:'visible'});
   for(const [width,height] of sizes){await p.setViewportSize({width,height});await p.waitForTimeout(120);let screenshot;const m=await metrics(p,selector);if(width===1366){screenshot=`${theme}--${name}--${width}x${height}.png`;await p.screenshot({path:path.join(out,screenshot)});}rows.push({theme,window:name,width,height,status:'OPENED',...m,screenshot});}
   console.log(theme,name,'OPENED');
  }catch(e){rows.push({theme,window:name,status:'NOT_OPENED',reason:e.message.split('\n')[0]});console.log(theme,name,'NOT_OPENED');}
  fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({rows,errors},null,2));
 }
}
await browser.close();console.log('Rows',rows.length);
})().catch(e=>{console.error(e);process.exitCode=1});
