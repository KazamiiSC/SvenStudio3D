import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
const css=readFileSync(new URL('../src/interfaceThemes.css',import.meta.url),'utf8');
const root=postcss.parse(css);
const themes=['modern','win98','xp','goldsrc','cyber','midnight'];
function palette(theme){const vars={};root.walkRules(r=>{
 if(r.selector===':root[data-sven-theme]'||r.selector===`:root[data-sven-theme="${theme}"]`||r.selector===':root[data-sven-accent="nebula"]'||r.selector===':root[data-sven-accent]')r.walkDecls(d=>{if(d.prop.startsWith('--'))vars[d.prop]=d.value});
 });function resolve(k,seen=new Set()){assert.ok(!seen.has(k),'Cyclic token '+k);seen.add(k);assert.ok(vars[k],'Missing '+k);return vars[k].replace(/var\((--[\w-]+)\)/g,(_,n)=>resolve(n,new Set(seen)))}return resolve;}
function lum(hex){assert.match(hex,/^#[\da-f]{6}$/i);const a=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722}
function contrast(a,b){a=lum(a);b=lum(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
test('all six palettes provide readable surface, title, field, selection and disabled pairs',()=>{
 for(const t of themes){const p=palette(t);for(const [ink,bg] of [['text','panel'],['text','panel2'],['text','input'],['text','control'],['text','selection'],['muted','selection'],['muted','control-hover'],['header-text','header'],['disabled-ink','disabled-bg'],['warning-ink','warning-bg'],['danger-ink','danger-bg'],['success-ink','success-bg']])assert.ok(contrast(p('--theme-'+ink),p('--theme-'+bg))>=4.5,`${t}: ${ink}/${bg}`)}
});
test('skin identity and accent are independent, without important declarations',()=>{
 root.walkDecls(d=>assert.ok(!d.important));
 for(const t of themes.filter(t=>t!=='modern'))assert.ok(css.includes(`[data-sven-theme="${t}"]`));
 for(const a of ['nebula','ice','ember','mint','orchid','gold'])assert.ok(css.includes(`[data-sven-accent="${a}"]`));
 root.walkRules(r=>{if(/^:root\[data-sven-theme="/.test(r.selector)&&!r.selector.includes(' '))r.walkDecls('--theme-accent',()=>assert.fail('A skin must not overwrite the accent preference'))});
});
test('disabled controls retain opaque readable text and native disabled behavior',()=>{
 assert.match(css,/:disabled\s*\{[^}]*opacity:1/s);
 assert.match(css,/--theme-disabled-ink/);
 assert.doesNotMatch(css,/pointer-events\s*:\s*none/);
});
test('classic radius is a token, not another specificity layer',()=>{
 assert.match(css,/--skin-radius:0px/);
 assert.match(readFileSync(new URL('../src/style.css',import.meta.url),'utf8'),/border-radius:var\(--skin-radius,/);
});

