import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const sources=walk(path.join(root,'src')).filter(f=>/\.tsx?$/.test(f));
const locales=Object.fromEntries(['es','pt','ru','ko','zh'].map(l=>[l,JSON.parse(fs.readFileSync(path.join(root,'src','locales',`${l}.json`),'utf8'))]));

test('UI text is not hard-coded as Spanish/English only (pt, ru, ko and zh would get English)',()=>{
  const offenders=[];
  for(const f of sources){
    const text=fs.readFileSync(f,'utf8');
    for(const m of text.matchAll(/\blocale===?'es'\?'(?:[^'\\\n]|\\.)*'\s*:\s*'((?:[^'\\\n]|\\.)*)'(?!\s*[?:+.[])/g))
      if(!/^[a-z]{2}$/.test(m[1]))offenders.push(`${path.relative(root,f)}: ${m[1]}`);
  }
  assert.deepEqual(offenders,[],'Use translate(locale,"English text") / t() and add the text to src/locales');
});

test('every translate(locale,...) key used in src exists in every non-English locale',()=>{
  const missing=[];
  for(const f of sources){
    const text=fs.readFileSync(f,'utf8');
    for(const m of text.matchAll(/\btranslate\(locale,'((?:[^'\\\n]|\\.)*)'\)/g)){
      const key=m[1].replace(/\\'/g,"'");
      for(const [lang,dict] of Object.entries(locales))if(!(key in dict))missing.push(`${lang}: ${key}`);
    }
  }
  assert.deepEqual(missing,[]);
});
