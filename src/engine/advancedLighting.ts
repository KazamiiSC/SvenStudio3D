/** Sven Co-op compile-time lighting helpers. Every generated key is a native MAP
 * keyvalue, not an editor-only approximation or a custom compiler argument. */
import type {PointEntity,Vec3} from './types';

export type RadField={key:string;label:string;category:'Bounces'|'Quality'|'Color'|'Shadows';kind:'number'|'rgb'|'choice';min?:number;max?:number;choices?:readonly {value:string;label:string}[];help:string};
const yesNo=[{value:'',label:'Compiler default'},{value:'1',label:'Yes'},{value:'-1',label:'No'}] as const;
export const RAD_FIELDS:readonly RadField[]=[
 {key:'rad_bounce',label:'Radiosity bounces',category:'Bounces',kind:'number',min:0,max:100,help:'Higher values add indirect bounced light. 0 keeps the compiler default.'},
 {key:'rad_texreflectgamma',label:'Reflection gamma',category:'Bounces',kind:'number',min:0.01,max:10,help:'Gamma used when calculating light reflected off textures.'},
 {key:'rad_texreflectscale',label:'Reflection scale',category:'Bounces',kind:'number',min:0.01,max:10,help:'How much color and intensity surfaces reflect.'},
 {key:'rad_chop',label:'Normal patch size',category:'Quality',kind:'number',min:1,max:1024,help:'Smaller values increase radiosity detail and memory use.'},
 {key:'rad_texchop',label:'Emissive patch size',category:'Quality',kind:'number',min:1,max:1024,help:'Radiosity patch size for luminous textures.'},
 {key:'rad_smooth',label:'Smoothing angle',category:'Quality',kind:'number',min:0,max:180,help:'Angle threshold for smoothing shading at adjoining surfaces.'},
 {key:'rad_blur',label:'Shadow blur',category:'Quality',kind:'number',min:0.01,max:16,help:'Enlarges lightmap samples to soften baked shadows.'},
 {key:'rad_gamma',label:'Final light gamma',category:'Color',kind:'number',min:0.01,max:10,help:'Global gamma applied to the finished lightmap.'},
 {key:'rad_scale',label:'Global light scale',category:'Color',kind:'number',min:0.01,max:20,help:'Overall brightness multiplier for baked lighting.'},
 {key:'rad_ambient',label:'World ambient RGB (0–1)',category:'Color',kind:'rgb',min:0,max:1,help:'Fractional R G B components, e.g. 0.05 0.06 0.08.'},
 {key:'rad_sky',label:'Skylight in shade',category:'Color',kind:'number',min:0,max:10,help:'How much ambient sky light affects outside shade.'},
 {key:'rad_minlight',label:'Minimum final light',category:'Color',kind:'number',min:0,max:255,help:'Floor for final light intensity, 0–255.'},
 {key:'rad_fade',label:'Global light falloff',category:'Color',kind:'number',min:0.01,max:100,help:'Higher values make point lights fall off sooner.'},
 {key:'rad_texlightgap',label:'Emissive light gap',category:'Shadows',kind:'number',min:0,max:128,help:'Moves texture lights away from their faces to reduce leaks.'},
 {key:'rad_softsky',label:'Smooth skylight',category:'Shadows',kind:'choice',choices:yesNo,help:'Smooth light_environment diffusion.'},
 {key:'rad_rgbtransfers',label:'Colored shadow transfers',category:'Shadows',kind:'choice',choices:yesNo,help:'Enable RGB transfers used by custom shadows.'},
 {key:'rad_customshadowwithbounce',label:'Custom shadows with bounce',category:'Shadows',kind:'choice',choices:yesNo,help:'Include bounced light in custom shadow calculations.'}
] as const;
export type RadValues=Record<string,string>;
export const RAD_PRESETS:Record<'interior'|'final'|'softSky',RadValues>={
 interior:{rad_bounce:'4',rad_chop:'64',rad_texchop:'32',rad_smooth:'50',rad_blur:'1.5'},
 final:{rad_bounce:'6',rad_chop:'48',rad_texchop:'24',rad_smooth:'50',rad_blur:'2'},
 softSky:{rad_bounce:'4',rad_sky:'0.5',rad_softsky:'1',rad_blur:'2'}
};
export function radFromProps(props:Record<string,string>):RadValues{
 return Object.fromEntries(RAD_FIELDS.map(f=>[f.key,props[f.key]||'']));
}
/** Validation is deliberately strict: never emit unverified/unsafe compiler options. */
export function validateRadValues(values:RadValues):string[]{
 const errors:string[]=[];
 for(const field of RAD_FIELDS){
  const raw=(values[field.key]||'').trim();if(!raw)continue;
  if(field.kind==='choice'){
   if(!field.choices?.some(c=>c.value===raw))errors.push(`${field.key}: unknown choice.`);
  }else if(field.kind==='rgb'){
   const nums=raw.split(/\s+/);
   if(nums.length!==3||nums.some(v=>!Number.isFinite(Number(v))||Number(v)<(field.min??0)||Number(v)>(field.max??1)))errors.push(`${field.key}: expected three numbers between 0 and 1.`);
  }else if(!Number.isFinite(Number(raw))||Number(raw)<(field.min??0)||Number(raw)>(field.max??100000)){
   errors.push(`${field.key}: value must be within ${field.min}–${field.max}.`);
  }else if(['rad_bounce','rad_chop','rad_texchop','rad_minlight'].includes(field.key)&&!Number.isInteger(Number(raw))){
   errors.push(`${field.key}: expected an integer.`);
  }
 }
 return errors;
}
/** Update ONLY the controlled RAD keys. Empty fields remove overrides while
 * preserving unrelated info_compile_parameters settings and spawnflags. */
export function mergeRadProps(existing:Record<string,string>,values:RadValues):Record<string,string>{
 const errors=validateRadValues(values);if(errors.length)throw Error(errors.join('\n'));
 const next={...existing};
 for(const {key} of RAD_FIELDS){const value=(values[key]||'').trim();if(value)next[key]=value;else delete next[key];}
 return next;
}
export type TextureLightKind='light_surface'|'info_texlights';
export type TextureLightDraft={texture:string;brightness:number;color:[number,number,number];autoColor:boolean;gap:string;maxDistance:string;targetname?:string};
/** GoldSrc WAD3 texture names are limited to 15 characters, including
 * animated prefixes (+0...), transparent ({...), water (!...), and special (~...). */
export function validateTextureName(name:string):string|null{
 if(!/^[a-zA-Z0-9_+~!{}*.$%-]{1,15}$/.test(name)||['classname','origin','spawnflags','targetname','wad','angle'].includes(name.toLowerCase()))
  return 'Use an existing WAD texture name (1–15 characters, no spaces or quotes).';
 return null;
}
export function validateTextureDraft(draft:TextureLightDraft,kind:TextureLightKind):string[]{
 const errors:string[]=[];const nameIssue=validateTextureName(draft.texture.trim());if(nameIssue)errors.push(nameIssue);
 if(!Number.isFinite(draft.brightness)||draft.brightness<=0||draft.brightness>100000)errors.push('Brightness must be from 1 to 100000.');
 if(draft.color.some(n=>!Number.isInteger(n)||n<0||n>255))errors.push('RGB components must be integers from 0 to 255.');
 if(kind==='light_surface'&&draft.gap&&!['0.0','3.0','12.0'].includes(draft.gap))errors.push('Texture gap must be 0.0, 3.0 or 12.0.');
 if(kind==='light_surface'&&draft.maxDistance&&(!Number.isFinite(Number(draft.maxDistance))||Number(draft.maxDistance)<=0||Number(draft.maxDistance)>131072))errors.push('Filter distance must be positive and <= 131072.');
 if(draft.targetname&&!/^[a-zA-Z0-9_\-]{1,64}$/.test(draft.targetname))errors.push('Targetname must be 1–64 letters, digits, underscores or hyphens.');
 return errors;
}
export function textureLightProps(kind:TextureLightKind,draft:TextureLightDraft):Record<string,string>{
 const errors=validateTextureDraft(draft,kind);if(errors.length)throw Error(errors.join('\n'));
 const texture=draft.texture.trim();const rgb=draft.color.join(' ');
 if(kind==='info_texlights')return {[texture]:`${rgb} ${Math.round(draft.brightness)}`};
 return {_tex:texture,_light:`255 255 255 ${Math.round(draft.brightness)}`,...(!draft.autoColor?{_texcolor:rgb}:{}),...(draft.gap?{_texlightgap:draft.gap}:{}),...(draft.maxDistance?{_frange:draft.maxDistance}:{}),...(draft.targetname?{targetname:draft.targetname}: {})};
}
/** Texture lookup in SC-RAD is case-insensitive. Reuse an existing key's
 * spelling instead of creating a second conflicting entry. */
export function mergeTexlightsProps(existing:Record<string,string>,draft:TextureLightDraft):Record<string,string>{
 const patch=textureLightProps('info_texlights',draft);
 const key=Object.keys(patch)[0];
 const oldKey=Object.keys(existing).find(other=>other.toLowerCase()===key.toLowerCase());
 return {...existing,[oldKey||key]:patch[key]};
}
export function createLightingEntity(id:string,classname:TextureLightKind|'info_compile_parameters'|'light_shadow'|'light_bounce',position:Vec3,props:Record<string,string>):PointEntity{
 return {id,kind:'entity',name:classname,classname,position:[...position],props:{...props},layer:'Lighting'};
}
export type StyleDraft={targetname:string;style:string;pattern:string;initiallyDark:boolean};
export const LIGHT_STYLES=[
 ['0','Normal'],['10','Fluorescent flicker'],['2','Slow, strong pulse'],['11','Slow pulse (no black)'],['5','Gentle pulse'],['1','Flicker A'],['6','Flicker B'],['3','Candle A'],['7','Candle B'],['8','Candle C'],['4','Fast strobe'],['9','Slow strobe'],['12','Underwater']
] as const;
export function validateStyleDraft(draft:StyleDraft):string[]{
 const result:string[]=[];
 if(draft.targetname&&!/^[\w-]{1,64}$/.test(draft.targetname))result.push('Targetname must contain only letters, digits, underscores or hyphens.');
 if(!LIGHT_STYLES.some(([style])=>style===draft.style))result.push('Unknown GoldSrc light style.');
 if(draft.pattern&&!/^[a-z]{1,64}$/.test(draft.pattern))result.push('Custom pattern must be 1–64 lowercase a–z characters.');
 if(draft.pattern&&!draft.targetname.trim())result.push('Custom patterns require a targetname.');
 if(draft.initiallyDark&&!draft.targetname.trim())result.push('Initially dark requires a targetname.');
 return result;
}
export function styleFromProps(props:Record<string,string>):StyleDraft{
 return {targetname:props.targetname||'',style:props.style||'0',pattern:props.pattern||'',initiallyDark:(Number(props.spawnflags||'0')&1)!==0};
}
/** Preserve ALL unrelated spawnflag bits, e.g. bit 2/remove on spawn. */
export function mergeStyleProps(existing:Record<string,string>,draft:StyleDraft):Record<string,string>{
 const errors=validateStyleDraft(draft);if(errors.length)throw Error(errors.join('\n'));
 const result={...existing},original=Number(result.spawnflags||'0');const flags=Number.isSafeInteger(original)&&original>=0?original:0;
 if(draft.targetname.trim())result.targetname=draft.targetname.trim();else delete result.targetname;
 if(draft.style!=='0')result.style=draft.style;else delete result.style;
 if(draft.pattern)result.pattern=draft.pattern;else delete result.pattern;
 result.spawnflags=String(draft.initiallyDark?(flags|1):(flags&~1));
 return result;
}
export function validateShadowTarget(objects:readonly {kind:string;classname?:string;props?:Record<string,string>}[],target:string):string[]{
 const matches=objects.filter(o=>o.kind==='entity'&&o.props?.targetname===target);
 if(!target.trim())return ['Select a target brush entity with a targetname.'];
 if(!matches.length)return [`No entity with targetname "${target}" exists in this map.`];
 if(!matches.some(o=>(Number(o.props?.zhlt_lightflags||'0')&2)!==0))return [`${target}: set ZHLT Lightflags to Opaque (bit 2) on the target brush entity.`];
 return [];
}
