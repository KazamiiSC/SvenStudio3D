/** v2.6 Map CFG editor + AngelScript assistant (inside Map Packager). The generated files are
 * added to the package ZIP; the user can also copy them. */
import {useMemo} from 'react';
import {Copy,FileCode2} from 'lucide-react';
import {useT} from '../i18n';
import {CFG_SETTINGS,CFG_WEAPONS,SCRIPT_FEATURES,generateMapCfg,generateMapScript,type CfgOptions,type ScriptFeature} from '../engine/mapScriptCfg';

export type MapScriptCfgState={cfgOn:boolean;cfg:CfgOptions;scriptOn:boolean;features:ScriptFeature[];welcome:string;respawn:number};
export function mapScriptCfgFiles(name:string,s:MapScriptCfgState){
  const files:{path:string;content:string}[]=[];
  const script=s.scriptOn&&s.features.length?generateMapScript(name,s.features,{welcome:s.welcome,respawn:s.respawn}):null;
  if(script)files.push({path:`scripts/maps/${name}.as`,content:script});
  if(s.cfgOn||script)files.push({path:`maps/${name}.cfg`,content:generateMapCfg(name,s.cfg,script?name:null)});
  return files;
}
export function MapScriptCfgPanel({name,state,setState}:{name:string;state:MapScriptCfgState;setState:(s:MapScriptCfgState)=>void}){
  const t=useT();
  const files=useMemo(()=>mapScriptCfgFiles(name||'mymap',state),[name,state]);
  const set=(patch:Partial<MapScriptCfgState>)=>setState({...state,...patch});
  const setting=(k:string,v:string)=>set({cfg:{...state.cfg,settings:{...state.cfg.settings,[k]:v}}});
  const weapon=(w:string,on:boolean)=>set({cfg:{...state.cfg,weapons:on?[...state.cfg.weapons,w]:state.cfg.weapons.filter(x=>x!==w)}});
  return <details className="mp-script-cfg" open>
    <summary><FileCode2 size={14}/>{t('Map CFG and script')}</summary>
    <label className="mp-check"><input type="checkbox" checked={state.cfgOn} onChange={e=>set({cfgOn:e.target.checked})}/>{t('Include a map CFG')} (maps/{name}.cfg)</label>
    {state.cfgOn&&<>
      <div className="mp-cfg-grid">{CFG_SETTINGS.map(s=><label key={s.key} title={t(s.help)}>{t(s.label)}
        {s.type==='bool'?<input type="checkbox" checked={(state.cfg.settings[s.key]??s.default)==='1'} onChange={e=>setting(s.key,e.target.checked?'1':'0')}/>
        :s.type==='select'?<select value={state.cfg.settings[s.key]??s.default} onChange={e=>setting(s.key,e.target.value)}>{s.options!.map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select>
        :<input type="number" value={state.cfg.settings[s.key]??s.default} onChange={e=>setting(s.key,e.target.value)}/>}</label>)}</div>
      <strong className="mp-sub">{t('Starting weapons')}</strong>
      <div className="mp-weapons">{CFG_WEAPONS.map(w=><label key={w}><input type="checkbox" checked={state.cfg.weapons.includes(w)} onChange={e=>weapon(w,e.target.checked)}/>{w.replace('weapon_','')}</label>)}</div>
      <label className="mp-check"><input type="checkbox" checked={state.cfg.nosuit} onChange={e=>set({cfg:{...state.cfg,nosuit:e.target.checked}})}/>{t('Start without the HEV suit (nosuit)')}</label>
      <label className="mp-check"><input type="checkbox" checked={state.cfg.nomedkit} onChange={e=>set({cfg:{...state.cfg,nomedkit:e.target.checked}})}/>{t('No medkit (nomedkit)')}</label>
      <label>{t('Extra CFG lines')}<textarea rows={2} spellCheck={false} value={state.cfg.extra} onChange={e=>set({cfg:{...state.cfg,extra:e.target.value}})} placeholder="ammo_buckshot 2"/></label>
    </>}
    <label className="mp-check"><input type="checkbox" checked={state.scriptOn} onChange={e=>set({scriptOn:e.target.checked})}/>{t('Include an AngelScript map script')} (scripts/maps/{name}.as)</label>
    {state.scriptOn&&<>{SCRIPT_FEATURES.map(f=><label key={f.id} className="mp-check" title={t(f.help)}><input type="checkbox" checked={state.features.includes(f.id)} onChange={e=>set({features:e.target.checked?[...state.features,f.id]:state.features.filter(x=>x!==f.id)})}/>{t(f.label)}</label>)}
      {state.features.includes('welcome')&&<label>{t('Welcome message')}<input value={state.welcome} maxLength={120} onChange={e=>set({welcome:e.target.value})}/></label>}
      {state.features.includes('respawnTimer')&&<label>{t('Respawn delay (s)')}<input type="number" min={0} max={600} value={state.respawn} onChange={e=>set({respawn:Math.max(0,Math.min(600,e.target.valueAsNumber||0))})}/></label>}</>}
    {files.map(f=><div key={f.path} className="mp-file-preview"><div><code>{f.path}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(f.content)}><Copy size={12}/>{t('Copy')}</button></div><pre>{f.content}</pre></div>)}
  </details>;
}
