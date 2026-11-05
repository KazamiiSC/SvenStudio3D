import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Download,FileAudio,Headphones,Upload,X,AlertTriangle} from 'lucide-react';
import {convertAudioBuffer,safeWavName,WAV_PRESETS,type WavSpec} from '../engine/audioConversion';
import {useEditor} from '../store';
import {useT} from '../i18n';

export function AudioConverter({onClose,onInstalled}:{onClose:()=>void;onInstalled:(path:string,preset:keyof typeof WAV_PRESETS)=>void}){
  const t=useT(),gameDir=useEditor(s=>s.settings.gameDir),logs=useEditor(s=>s.appendLogs);
  const [file,setFile]=useState<File|null>(null),[preset,setPreset]=useState<keyof typeof WAV_PRESETS>('effects');
  const [loopCue,setLoopCue]=useState(false);
  const [customName,setCustomName]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<ArrayBuffer|null>(null);
  const lastUrl=useRef<string|null>(null);
  const [previewUrl,setPreviewUrl]=useState('');
  useEffect(()=>{if(!result){setPreviewUrl('');return;}const url=URL.createObjectURL(new Blob([result],{type:'audio/wav'}));setPreviewUrl(url);return()=>URL.revokeObjectURL(url)},[result]);
  useEffect(()=>()=>{if(lastUrl.current)URL.revokeObjectURL(lastUrl.current)},[]);
  const changeFile=(f:File|null)=>{setFile(f);setResult(null);setStatus('');setCustomName(f?safeWavName(f.name).replace(/\.wav$/,''):'')};
  const convert=async()=>{if(!file)return;setBusy(true);setStatus('');try{
    const output=await convertAudioBuffer(file,WAV_PRESETS[preset] as WavSpec,loopCue);
    setResult(output);setStatus(`${t('Converted successfully')} · ${(output.byteLength/1024).toFixed(0)} KiB`);
  }catch(err){setStatus(String(err))}finally{setBusy(false)}};
  const outputName=safeWavName(customName||file?.name||'custom_sound');
  const download=()=>{if(!result)return;
    if(lastUrl.current)URL.revokeObjectURL(lastUrl.current);
    const url=URL.createObjectURL(new Blob([result],{type:'audio/wav'}));lastUrl.current=url;
    const a=document.createElement('a');a.href=url;a.download=outputName;a.click();};
  const install=async()=>{if(!result)return;setBusy(true);try{
    if(!gameDir)throw Error(t('Configure the game directory in Build Settings first.'));
    const url='/api/assets/converted-audio?'+new URLSearchParams({gameDir,name:outputName}).toString();
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'audio/wav'},body:new Blob([result],{type:'audio/wav'})});
    const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
    setStatus(`${t('Installed in Sven Co-op')}: sound/${data.path}`);
    logs([`Audio converted and installed: sound/${data.path} (${preset})`]);onInstalled(data.path,preset);
  }catch(err){setStatus(String(err))}finally{setBusy(false)}};
  return <div className="modal-backdrop converter-backdrop" onMouseDown={onClose}><section className="audio-converter" role="dialog" aria-modal="true" aria-label={t('Audio Converter')} onMouseDown={e=>e.stopPropagation()}>
    <header className="converter-header"><span className="converter-icon"><FileAudio size={23}/></span><div><strong>{t('Audio Converter')}</strong><small>{t('Convert audio inside Sven Studio · no external application required')}</small></div><button onClick={onClose} aria-label={t('Close')}><X size={20}/></button></header>
    <div className="converter-content">
      <label className="converter-file"><Upload size={26}/><strong>{file?file.name:t('Select an audio file')}</strong><small>WAV, MP3, OGG, AAC — {t('as supported by your browser')} · 32 MiB max.</small><input type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac" onChange={e=>changeFile(e.target.files?.[0]||null)}/></label>
      <div className="converter-settings"><h3>{t('Output preset')} · Svengine</h3><div className="converter-presets">
        {([['effects','Sound effect','mono · 22050 Hz · PCM 16-bit'],['voice','NPC voice / lip-sync','mono · 11025 Hz · PCM 8-bit'],['ambient','Ambient HD','mono · 44100 Hz · PCM 16-bit'],['music','Music / stereo','stereo · 44100 Hz · PCM 16-bit']] as const).map(([key,label,detail])=>
          <button className={preset===key?'active':''} key={key} onClick={()=>{setPreset(key);setResult(null)}}><strong>{t(label)}</strong><small>{detail}</small></button>)}
      </div></div>
      <label className="converter-name">{t('Output filename')} <div><input value={customName} maxLength={65} onChange={e=>{setCustomName(e.target.value);setResult(null)}}/><span>.wav</span></div></label>
      <label className="converter-loop-check"><input type="checkbox" checked={loopCue} onChange={e=>{setLoopCue(e.target.checked);setResult(null)}}/>{t('Include WAV loop cue point for looping sound effects')}</label>
      <p className="converter-help"><AlertTriangle size={15}/>{t('The browser must be able to decode the source format. For best compatibility, use mono PCM WAV for effects and NPC voices. For long music tracks, Svengine also supports OGG/MP3 directly.')}</p>
      {status&&<p className="converter-status" role="status"><CheckCircle2 size={15}/>{status}</p>}
      {previewUrl&&<div className="converter-preview"><strong>{t('Listen to the converted WAV before installing')}</strong><audio controls preload="metadata" src={previewUrl}/><small>{t('If this preview sounds wrong, do not install the file.')}</small></div>}
      <div className="converter-buttons"><button className="sound-primary" disabled={!file||busy} onClick={convert}><Headphones size={16}/>{busy?t('Converting...'):t('Convert to WAV')}</button><button disabled={!result||busy} onClick={download}><Download size={16}/>{t('Download WAV')}</button><button disabled={!result||busy||!gameDir} onClick={install}><Upload size={16}/>{t('Install in Sven Co-op')}</button></div>
      <small className="converter-footnote">{t('Install saves to svencoop_addon/sound/svenstudio_imports/ without overwriting files. New sounds appear in Sound Browser after Refresh. Converted files can be used by ambient_generic or ambient_music.')}</small>
    </div>
  </section></div>;
}
