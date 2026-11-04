import type {MapObject,PointEntity,Vec3} from './types';
import {uid} from './types';
export type AudioEntityKind='ambient_generic'|'ambient_music'|'env_sound';
export type SoundAsset={source:string;path:string;name:string;extension:string;category:string};
export type SoundOptions={volume:number;loop:boolean;startSilent:boolean;radius:'small'|'medium'|'large'|'everywhere';roomType:number;reverbRadius:number};
export const DEFAULT_SOUND_OPTIONS:SoundOptions={volume:10,loop:false,startSilent:false,radius:'medium',roomType:0,reverbRadius:128};
export const SOUND_TYPES:AudioEntityKind[]=['ambient_generic','ambient_music','env_sound'];
export const AUDIO_EXTENSIONS=['wav','mp3','ogg','flac','aif','aiff','wma','mid','midi','mod','xm','it','s3m'];
export function validSoundReference(p:string){return !!p&&p.length<=320&&!p.includes('\\')&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..')&&AUDIO_EXTENSIONS.includes(p.split('.').pop()?.toLowerCase()||'')}
const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;
export function makeAudioEntity(classname:AudioEntityKind,position:Vec3,file='',options:Partial<SoundOptions>={}):PointEntity{
  const opts={...DEFAULT_SOUND_OPTIONS,...options};
  const common={id:uid(),kind:'entity' as const,name:classname,classname,position:[...position] as Vec3,layer:'Audio'};
  if(classname==='env_sound')return {...common,props:{radius:String(Math.round(clamp(opts.reverbRadius,0,8192))),roomtype:String(Math.round(clamp(opts.roomType,0,28))),spawnflags:'0'}};
  if(file&&!validSoundReference(file))throw Error('Sound path must be relative to Sven Co-op /sound and use a compatible extension.');
  const volume=String(clamp(opts.volume,0,10));
  if(classname==='ambient_music')return {...common,props:{message:file,volume,spawnflags:String((opts.startSilent?1:0)|(opts.loop?2:0))}};
  const flags=(opts.radius==='everywhere'?1:opts.radius==='small'?2:opts.radius==='large'?8:4)|(opts.startSilent?16:0);
  // Explicit playmode is important for auto-starting loops in Sven Co-op.
  return {...common,props:{message:file,health:volume,playmode:opts.loop?'2':'1',spawnflags:String(flags)}};
}
export function soundInfluence(entity:PointEntity):number|null{
  if(entity.classname==='ambient_music')return null; // music is global, not spatial
  if(entity.classname==='env_sound')return clamp(Number(entity.props.radius||0),0,8192)||0;
  if(entity.classname!=='ambient_generic')return null;
  const flags=Number(entity.props.spawnflags||0);
  if(flags&1)return null; // global sound
  if([5,6].includes(Number(entity.props.playmode))&&Number(entity.props.linearmax)>0)return Number(entity.props.linearmax);
  return flags&2?384:flags&8?1536:768; // editor-only approximate radius
}
export type AudioIssue={severity:'warning'|'error';entityId:string;message:string};
export function validateAudio(entities:MapObject[],available?:Set<string>):AudioIssue[]{
  const issues:AudioIssue[]=[];
  for(const object of entities){
    if(object.kind!=='entity'||!SOUND_TYPES.includes(object.classname as AudioEntityKind))continue;
    const fail=(severity:'warning'|'error',message:string)=>issues.push({severity,entityId:object.id,message:`${object.classname}: ${message}`});
    if(object.classname==='env_sound'){
      const radius=Number(object.props.radius||0),type=Number(object.props.roomtype||0);
      if(!Number.isFinite(radius)||radius<0||radius>8192)fail('error','radius must be 0–8192.');
      if(!Number.isInteger(type)||type<0||type>28)fail('error','roomtype must be 0–28.');
      continue;
    }
    const file=object.props.message?.trim()||'';
    if(!file)fail('error','message (sound path) is empty.');
    else if(!validSoundReference(file)&&!file.startsWith('!'))fail('error',`invalid sound path: ${file}`);
    else if(available&&validSoundReference(file)&&!available.has(file.toLowerCase()))fail('warning',`sound is not in scanned folders: ${file}`);
    const volume=Number(object.props[object.classname==='ambient_music'?'volume':'health']??10);
    if(!Number.isFinite(volume)||volume<0||volume>10)fail('warning','volume should be between 0 and 10.');
  }
  return issues;
}
