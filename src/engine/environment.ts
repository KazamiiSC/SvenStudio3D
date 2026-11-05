/** Native Svengine environment entities. Preview numbers are deliberately only approximations of SC-RAD. */
import {uid} from './types';
import type {MapObject,PointEntity,Vec3} from './types';
export type EnvironmentKind='light'|'light_spot'|'light_environment'|'env_fog'|'trigger_changesky';
export type EnvironmentPreset='day'|'sunset'|'night';
export const LIGHT_PRESETS:Record<EnvironmentPreset,{label:string;light:string;ambient:string;pitch:string;skyHint:string}>={
  day:{label:'Daylight',light:'255 244 216 420',ambient:'170 200 255 80',pitch:'-55',skyHint:'desert'},
  sunset:{label:'Sunset',light:'255 140 77 320',ambient:'174 103 135 65',pitch:'-18',skyHint:'Select a sunset sky installed in gfx/env'},
  night:{label:'Moonlight',light:'122 171 255 110',ambient:'65 82 135 35',pitch:'-38',skyHint:'Select a night sky installed in gfx/env'}
};
export const isEnvironmentKind=(kind:string):kind is EnvironmentKind=>['light','light_spot','light_environment','env_fog','trigger_changesky'].includes(kind);
export function sanitizeRgb(values:number[]):[number,number,number]{return [0,1,2].map(i=>Math.max(0,Math.min(255,Math.round(Number.isFinite(values[i])?values[i]:255)))) as [number,number,number]}
export function lightString(rgb:number[],brightness:number):string{
  return [...sanitizeRgb(rgb),Math.max(1,Math.min(100000,Math.round(Number.isFinite(brightness)?brightness:200)))].join(' ');
}
export function parseLight(value:string|undefined):{rgb:[number,number,number];brightness:number}{
 const parts=(value||'255 255 255 200').trim().split(/\s+/).map(Number);
 return {rgb:sanitizeRgb(parts),brightness:Number.isFinite(parts[3])?Math.max(1,parts[3]):200};
}
export function rgbHex(rgb:number[]):string{return '#'+sanitizeRgb(rgb).map(v=>v.toString(16).padStart(2,'0')).join('')}
export function hexRgb(hex:string):[number,number,number]{const code=/^#[a-f\d]{6}$/i.test(hex)?hex:'#ffffff';return [1,3,5].map(i=>parseInt(code.slice(i,i+2),16)) as [number,number,number]}
export function makeEnvironment(kind:EnvironmentKind,position:Vec3,overrides:Record<string,string>={}):PointEntity{
 const props:Record<EnvironmentKind,Record<string,string>>={
  light:{_light:'255 240 210 350'},
  light_spot:{_light:'255 242 212 420',_cone:'30',_cone2:'55',pitch:'-45',angles:'0 0 0'},
  light_environment:{_light:'255 244 216 420',_diffuse_light:'170 200 255 80',pitch:'-45',angles:'0 0 0',_spread:'6'},
  env_fog:{rendercolor:'115 141 176',iuser2:'256',iuser3:'2048',spawnflags:'0'},
  trigger_changesky:{skyname:'desert',targetname:`change_sky_${uid().slice(0,8)}`}
 };
 return {id:uid(),kind:'entity',classname:kind,name:kind,position:[...position],props:{...props[kind],...overrides},layer:kind==='env_fog'||kind==='trigger_changesky'?'Environment':'Lighting'};
}
export type EnvironmentIssue={entityId:string;severity:'error'|'warning';message:string};
export function validateEnvironment(objects:MapObject[]):EnvironmentIssue[]{
 const problems:EnvironmentIssue[]=[];
 for(const obj of objects){if(obj.kind!=='entity'||!isEnvironmentKind(obj.classname))continue;
  const p=obj.props,issue=(severity:'error'|'warning',message:string)=>problems.push({entityId:obj.id,severity,message:`${obj.name}: ${message}`});
  if(obj.classname.startsWith('light')){
   const nums=(p._light||'').trim().split(/\s+/).map(Number);
   if(nums.length!==4||nums.some(x=>!Number.isFinite(x))||nums.slice(0,3).some(x=>x<0||x>255)||nums[3]<=0)issue('error','_light must be R G B brightness (RGB 0–255, brightness > 0)');
  }
  if(obj.classname==='light_spot'){
    const a=Number(p._cone),b=Number(p._cone2);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||a>b||b>180)issue('error','Spotlight angles must satisfy 0 < _cone <= _cone2 <= 180');
  }
  if(obj.classname==='env_fog'){
    const start=Number(p.iuser2),end=Number(p.iuser3);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<=start)issue('error','Fog distance must satisfy 0 < iuser2 < iuser3');
    const rgb=(p.rendercolor||'').split(/\s+/).map(Number);
    if(rgb.length!==3||rgb.some(x=>!Number.isFinite(x)||x<0||x>255))issue('error','rendercolor must be 3 RGB values from 0–255');
  }
  if(obj.classname==='trigger_changesky'&&!p.skyname?.trim()&&!p.color?.trim())issue('error','Sky trigger needs skyname or color');
 }
 return problems;
}
/** This is a neutral editing backdrop, not a skybox texture or simulated baked lightmap. */
export function skyPreviewColor(skyname:string):string{
 const s=skyname.toLowerCase();if(/night|dark|moon|space|star/.test(s))return '#090e23';
 if(/sunset|dusk|evening|dawn/.test(s))return '#593d64';
 if(/cliff|cloud/.test(s))return '#354c67';return '#283b56';
}
