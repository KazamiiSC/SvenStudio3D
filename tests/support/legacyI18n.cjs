/** Test helper for translation checks written before v2.3 HF4.
 * Translations moved from src/i18n.ts into src/locales/<lang>.json. Older tests search the
 * source text for `Object.assign(es,{'key':'value'})`; this rebuilds that text from the JSON
 * files (one key per line, in the quote/spacing styles those tests use).
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const LANGS=['en','es','ru','ko','zh','pt'];
let cached=null;
function dictionary(lang){return JSON.parse(fs.readFileSync(path.join(root,'src','locales',`${lang}.json`),'utf8'));}
function single(text){return `'${String(text).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n')}'`;}
function legacyI18nSource(){
  if(cached)return cached;
  const parts=[fs.readFileSync(path.join(root,'src','i18n.ts'),'utf8')];
  for(const lang of LANGS){
    for(const [key,value] of Object.entries(dictionary(lang))){
      parts.push(`Object.assign(${lang},{${single(key)}:${single(value)}});`);
      parts.push(`Object.assign(${lang},{${JSON.stringify(key)}:${JSON.stringify(value)}});`);
      parts.push(`Object.assign(${lang}, {${JSON.stringify(key)}: ${JSON.stringify(value)}});`);
    }
  }
  cached=parts.join('\n');
  return cached;
}
module.exports={legacyI18nSource,dictionary,LANGS};
