import {withSplitParts} from './support/splitParts.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=withSplitParts(read('src/App.tsx'),'App');
const css=read('src/style.css');
test('Help has text credits but no visual partner logos',()=>{
  const start=app.indexOf('function AboutModal(');
  const end=app.indexOf('function ',start+10);
  const help=app.slice(start,end<0?undefined:end);
  assert.match(help,/help-credits/);
  assert.match(help,/This project was made with the help of GPT-6 Astra/);
  assert.doesNotMatch(help,/help-credits-logos|help-astra-logo-image|help-kz-logo|gpt6-astra-logo\.png|kz-sheez-logo\.png/);
  assert.doesNotMatch(css,/\.help-credits-logos|\.help-astra-logo-image|\.help-kz-logo/);
});
test('Help title shows the current release rather than old 1.5.10',()=>{
  const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version.split('.').slice(0,2).join('.');
  assert.ok(app.includes(`SvenStudio 3D v${version} · {t('What is new`),'v2.5 help hero shows the current version');
  assert.doesNotMatch(app,/v1\.5\.10/);
});
