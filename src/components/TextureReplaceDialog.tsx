/** Find & replace brush-face textures. One Undo step; alignment (shift/scale/axes) is kept.
 * Opened from the Texture Browser (button and right-click menu). */
import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Replace,MousePointerClick,X,AlertTriangle} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {textureUsage,planTextureReplace,validTextureName,type TextureMatchMode,type TextureReplaceScope} from '../engine/textureReplace';

export function TextureReplaceDialog({initialFind='',initialReplace='',onClose}:{initialFind?:string;initialReplace?:string;onClose:()=>void}){
  const t=useT();
  const objects=useEditor(s=>s.project.objects);
  const selectedIds=useEditor(s=>s.selectedIds);
  const textures=useEditor(s=>s.textureAssets);
  const replaceTextures=useEditor(s=>s.replaceTextures);
  const selectBrushesWithTexture=useEditor(s=>s.selectBrushesWithTexture);
  const [find,setFind]=useState(initialFind);
  const [replace,setReplace]=useState(initialReplace);
  const [match,setMatch]=useState<TextureMatchMode>('exact');
  const [scope,setScope]=useState<TextureReplaceScope>('map');
  const [notice,setNotice]=useState('');
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true);},[onClose]);
  const usage=useMemo(()=>textureUsage(objects),[objects]);
  const loaded=useMemo(()=>new Map(textures.map(a=>[a.name.toLowerCase(),a])),[textures]);
  const preview=useMemo(()=>{
    if(!find.trim()||!replace.trim())return null;
    try{return planTextureReplace(objects,{find,replace,match,scope,selectedIds});}
    catch(error){return {error:String(error instanceof Error?error.message:error)};}
  },[objects,find,replace,match,scope,selectedIds]);
  const missing=replace.trim()&&validTextureName(replace)&&textures.length>0&&!loaded.has(replace.trim().toLowerCase());
  const sizeChange=(()=>{
    const a=loaded.get(find.trim().toLowerCase()),b=loaded.get(replace.trim().toLowerCase());
    return a&&b&&(a.width!==b.width||a.height!==b.height)?`${a.width}×${a.height} → ${b.width}×${b.height}`:'';
  })();
  const apply=()=>{
    try{
      const plan=replaceTextures({find,replace,match,scope});
      setNotice(plan.faces?`${t('Replaced')}: ${plan.faces} ${t('faces')} · ${plan.brushes} brushes. ${t('Ctrl+Z undoes it in one step.')}`:t('Nothing to replace.'));
    }catch(error){setNotice(String(error instanceof Error?error.message:error));}
  };
  const selectUsing=()=>{const count=selectBrushesWithTexture(find.trim());setNotice(`${t('Selected brushes')}: ${count}`);};
  const ready=preview&&!('error' in preview)&&preview.faces>0;
  return createPortal(<div className="modal-backdrop texture-replace-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="modal-card texture-replace-dialog" role="dialog" aria-modal="true" aria-labelledby="texture-replace-title">
      <div className="modal-title"><Replace size={18}/><span id="texture-replace-title">{t('Find and replace texture')}</span><button type="button" aria-label={t('Close')} onClick={onClose}><X size={18}/></button></div>
      <p className="modal-subtext">{t('Only the texture name changes; shift, scale, rotation and axes are kept. Hidden and locked brushes are skipped.')}</p>
      <label>{t('Find')}
        <input list="texture-replace-used" value={find} autoFocus spellCheck={false} onChange={e=>{setFind(e.target.value);setNotice('')}} placeholder="CRETE1"/>
        <datalist id="texture-replace-used">{usage.map(u=><option key={u.texture} value={u.texture}>{`${u.faces} ${t('faces')} · ${u.brushes} brushes`}</option>)}</datalist>
      </label>
      <div className="texture-replace-row">
        <label>{t('Match')}<select value={match} onChange={e=>setMatch(e.target.value as TextureMatchMode)}><option value="exact">{t('Exact name')}</option><option value="contains">{t('Name contains')}</option></select></label>
        <label>{t('Where')}<select value={scope} onChange={e=>setScope(e.target.value as TextureReplaceScope)}><option value="map">{t('Whole map')}</option><option value="selection" disabled={!selectedIds.length}>{`${t('Selection')} (${selectedIds.length})`}</option></select></label>
      </div>
      <label>{t('Replace with')}
        <input list="texture-replace-loaded" value={replace} spellCheck={false} onChange={e=>{setReplace(e.target.value);setNotice('')}} placeholder="CRETE4"/>
        <datalist id="texture-replace-loaded">{textures.slice(0,3000).map(a=><option key={`${a.wad}:${a.name}`} value={a.name}>{a.wad}</option>)}</datalist>
      </label>
      <div className="texture-replace-preview" aria-live="polite">
        {notice?null:preview&&'error' in preview?<span className="texture-replace-warning"><AlertTriangle size={14}/>{t(preview.error)}</span>:
          preview?<span>{preview.faces?`${preview.faces} ${t('faces')} · ${preview.brushes} brushes ${t('will change')}`:t('No face uses that texture here.')}{preview.skippedLocked?` · ${preview.skippedLocked} ${t('hidden or locked brushes skipped')}`:''}</span>:
          <span>{t('Write the texture to find and the new texture.')}</span>}
        {missing&&<span className="texture-replace-warning"><AlertTriangle size={14}/>{t('That texture is not in the loaded WADs; it would appear missing when compiling.')}</span>}
        {sizeChange&&<span>{t('Different size')}: {sizeChange}. {t('Texture scale is kept, so it will look larger or smaller.')}</span>}
        {notice&&<strong>{notice}</strong>}
      </div>
      <div className="modal-footer">
        <button type="button" onClick={selectUsing} disabled={!find.trim()}><MousePointerClick size={15}/>{t('Select brushes')}</button>
        <button type="button" className="primary-action" onClick={apply} disabled={!ready}><Replace size={15}/>{t('Replace')}</button>
      </div>
    </section>
  </div>,document.body);
}
