const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),crypto=require('crypto');const {themes,sizes,metrics,boot}=require('./audit-browser.cjs');
const out=path.join(process.env.THEME_AUDIT_DIR || path.resolve(__dirname,'../../verification/rerun'),'visual-switching');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});const p=await browser.newPage({viewport:{width:1920,height:1080}});p.setDefaultTimeout(6000);await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.addInitScript(()=>localStorage.setItem('svenstudio:welcome-guide-v1','seen'));await boot(p);const rows=[],errors=[],pixels=[];p.on('pageerror',e=>errors.push(e.message));
const choose=async(theme)=>{await p.locator('.top-appearance-button').click();await p.locator('.studio-theme-card').filter({hasText:themes[theme]}).click();await p.keyboard.press('Escape')};
for(const theme of Object.keys(themes)){
 await p.setViewportSize({width:1920,height:1080});await choose(theme);await p.waitForTimeout(600);
 // Raw canvas pixels, captured inside RAF before WebGL's drawing buffer is discarded.
 const data=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.querySelector('.viewport-frame canvas');const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;const ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const bytes=ctx.getImageData(0,0,copy.width,copy.height).data;resolve({png:copy.toDataURL(),nonTransparent:bytes.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0),width:copy.width,height:copy.height})})));
 fs.writeFileSync(path.join(out,theme+'--canvas.png'),Buffer.from(data.png.split(',')[1],'base64'));pixels.push({theme,width:data.width,height:data.height,nonTransparent:data.nonTransparent,sha256:crypto.createHash('sha256').update(Buffer.from(data.png.split(',')[1],'base64')).digest('hex')});
 for(const [width,height] of sizes){await p.setViewportSize({width,height});await p.waitForTimeout(150);const m=await metrics(p,'.app-shell');const header=await p.evaluate(()=>{const h=document.querySelector('.titlebar').getBoundingClientRect(),b=document.querySelector('.top-compile').getBoundingClientRect();return {mode:document.querySelector('.titlebar').dataset.headerMode,compileVisible:b.left>=0&&b.right<=innerWidth&&b.bottom<=h.bottom,inputColor:getComputedStyle(document.querySelector('.project-title input')).color}});const screenshot=`${theme}--map--${width}x${height}.png`;await p.screenshot({path:path.join(out,screenshot)});rows.push({theme,window:'map',width,height,status:'OPENED',...m,header,screenshot});}
 await p.setViewportSize({width:1920,height:1080});await p.locator('.top-appearance-button').click();await p.locator('.theme-choice.theme-gold').click();await p.keyboard.press('Escape');await boot(p);
 const state=await p.evaluate(()=>({theme:document.documentElement.dataset.svenTheme,accent:document.documentElement.dataset.svenAccent}));rows.push({theme,window:'theme-persistence',state,passed:state.theme===theme&&state.accent==='gold'});
 await p.locator('.top-appearance-button').click();await p.locator('.theme-choice.theme-nebula').click();await p.keyboard.press('Escape');
 for(const language of ['es','en','ru','ko','zh','pt']){
  await p.setViewportSize({width:1920,height:1080});await p.locator('.language-picker select').selectOption(language);await p.setViewportSize({width:1024,height:768});await p.waitForTimeout(150);
  const header=await p.evaluate(()=>{const b=document.querySelector('.top-compile').getBoundingClientRect();return {mode:document.querySelector('.titlebar').dataset.headerMode,compileVisible:b.left>=0&&b.right<=innerWidth}});rows.push({theme,language,window:'localized-header',width:1024,height:768,header});
 }
 await p.setViewportSize({width:1920,height:1080});await p.locator('.language-picker select').selectOption('es');
 await p.locator('[aria-controls="sven-studios-menu"]').click();await p.keyboard.press('Escape');rows.push({theme,window:'menu-keyboard',passed:await p.locator('[aria-controls="sven-studios-menu"]').evaluate(e=>document.activeElement===e)});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,pixels,errors},null,2));console.log(theme,'switching, persistence, keyboard, 6 languages');
}
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

