/** Test helper: App.tsx and Viewport.tsx were split in v2.3 HF5 (src/app/*, src/components/viewport/*).
 * Source-text checks written before the split call withSplitParts(text,'App'|'Viewport') to search
 * the original file plus the modules extracted from it.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const PARTS={App:path.join(root,'src','app'),Viewport:path.join(root,'src','components','viewport')};
function partsText(name){
  const dir=PARTS[name];if(!dir||!fs.existsSync(dir))return '';
  return fs.readdirSync(dir).filter(f=>/\.tsx?$/.test(f)).sort().map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
}
function withSplitParts(text,name){return `${text}\n${partsText(name)}`;}
module.exports={withSplitParts,partsText};
