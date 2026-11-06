/** Visual-only preview options. These values never affect the GoldSrc MAP export. */
export type WalkPreviewSettings={spawn:'entity'|'camera';walkSpeed:number;runMultiplier:number;crouchMultiplier:number;flashlight:boolean;flashlightPower:number;noclip:boolean;showHud:boolean;safeFullscreen:boolean;rendered:boolean;showModels:boolean;interactions:boolean};
export type GoldSrcPreviewSettings={enabled:boolean;waterAnimation:boolean;transparency:boolean;exposure:number;ambientFill:number};
export const DEFAULT_WALK_PREVIEW:WalkPreviewSettings={spawn:'entity',walkSpeed:210,runMultiplier:1.62,crouchMultiplier:.5,flashlight:false,flashlightPower:60000,noclip:false,showHud:true,safeFullscreen:false,rendered:true,showModels:true,interactions:true};
export const DEFAULT_GOLDSRC_PREVIEW:GoldSrcPreviewSettings={enabled:true,waterAnimation:true,transparency:true,exposure:1,ambientFill:.36};
export const limit=(value:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
export function normalizeWalkPreview(value:Partial<WalkPreviewSettings>|null|undefined):WalkPreviewSettings{
 const v=value||{};
 return {spawn:v.spawn==='camera'?'camera':'entity',walkSpeed:limit(Number(v.walkSpeed??210),60,600),runMultiplier:limit(Number(v.runMultiplier??1.62),1,4),crouchMultiplier:limit(Number(v.crouchMultiplier??.5),.15,1),flashlight:v.flashlight===true,flashlightPower:limit(Number(v.flashlightPower??60000),10000,120000),noclip:v.noclip===true,showHud:v.showHud!==false,safeFullscreen:v.safeFullscreen===true,rendered:v.rendered!==false,showModels:v.showModels!==false,interactions:v.interactions!==false};
}
export function normalizeGoldSrcPreview(value:Partial<GoldSrcPreviewSettings>|null|undefined):GoldSrcPreviewSettings{
 const v=value||{};
 return {enabled:v.enabled!==false,waterAnimation:v.waterAnimation!==false,transparency:v.transparency!==false,exposure:limit(Number(v.exposure??1),.5,2),ambientFill:limit(Number(v.ambientFill??.36),0,1.5)};
}
export function readPreviewSettings<T>(key:string,normalize:(data:Partial<T>|null|undefined)=>T):T{
 try{return normalize(JSON.parse(localStorage.getItem(`svenstudio:${key}`)||'null'))}catch{return normalize(null)}
}
export function savePreviewSettings<T>(key:string,value:T){try{localStorage.setItem(`svenstudio:${key}`,JSON.stringify(value))}catch{/* Private session */}}
export type GoldSrcMaterialKind='opaque'|'masked'|'glass'|'water'|'additive';
/** GoldSrc transparent prefix {, water prefix ! or *, and special entity rendermode. */
export function goldSrcMaterial(textureName:string,entity?:{classname?:string;props?:Record<string,string>}):{kind:GoldSrcMaterialKind;opacity:number;alphaTest:number;depthWrite:boolean}{
 const name=textureName.toLowerCase().trim(),cl=entity?.classname?.toLowerCase()||'',mode=Number(entity?.props?.rendermode||0),amount=Number(entity?.props?.renderamt);
 let kind:GoldSrcMaterialKind='opaque';
 if(name.startsWith('{'))kind='masked';
 else if(name.startsWith('!')||name.startsWith('*')||cl==='func_water')kind='water';
 else if(/glass|window|translucent/i.test(name)||cl==='func_illusionary'||mode===2||mode===3||mode===4)kind='glass';
 if(mode===5)kind='additive';
 const defaultOpacity=kind==='water'?.73:kind==='glass'?.4:kind==='additive'?.6:1;
 const opacity=Number.isFinite(amount)&&mode>0?limit(amount/255,.05,1):defaultOpacity;
 return {kind,opacity,alphaTest:kind==='masked'?.5:0,depthWrite:kind!=='water'&&kind!=='glass'&&kind!=='additive'};
}
/** Position and velocity in Three world units (Y up); independent from map state. */
export function noclipDisplacement(yaw:number,pitch:number,forward:number,strafe:number,vertical:number,speed:number,dt:number):[number,number,number]{
 const f=limit(forward,-1,1),s=limit(strafe,-1,1),v=limit(vertical,-1,1);
 const forwardDir:[number,number,number]=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
 const raw:[number,number,number]=[forwardDir[0]*f+Math.cos(yaw)*s,forwardDir[1]*f+v,forwardDir[2]*f+Math.sin(yaw)*s];
 const len=Math.hypot(...raw)||1,scale=limit(speed,1,4000)*limit(dt,0,.1)/len;
 return raw.map(n=>n*scale) as [number,number,number];
}
