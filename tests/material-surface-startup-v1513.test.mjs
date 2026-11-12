import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const babelParse=source=>parse(source,{sourceType:'module',plugins:['typescript','jsx']});

test('Material & Surface Studio parses as TSX with Vite React Babel (no duplicate Brush)',()=>{
 const file=read('src/components/MaterialSurfaceStudio.tsx');
 assert.doesNotThrow(()=>babelParse(file));
 assert.match(file,/Brush as BrushIcon/);
 assert.match(file,/import type \{Brush,TextureAsset\}/);
 assert.match(file,/<BrushIcon size=\{15\}\/>/);
 assert.match(file,/o is Brush/);
});

test('the v1.5.12 duplicate Brush import is rejected, verifying this parser catches the crash',()=>{
 const source=read('src/components/MaterialSurfaceStudio.tsx');
 const broken=source.replace('Brush as BrushIcon','Brush').replace('<BrushIcon','<Brush');
 assert.throws(()=>babelParse(broken),/Identifier 'Brush' has already been declared/);
});

test('Material & Surface Studio wiring and the editor parse with Babel TSX',()=>{
 for(const file of ['src/App.tsx','src/components/Panels.tsx','src/components/MapPackagerStudio.tsx']){
  assert.doesNotThrow(()=>babelParse(read(file)),`Failed: ${file}`);
 }
});
