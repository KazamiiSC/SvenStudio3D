import {useState} from 'react';
import {AlertTriangle,Trash2,X} from 'lucide-react';
import {resetStudioBrowserData} from '../engine/studioReset';
import {useEditor} from '../store';

const WORDS:Record<string,{title:string;details:string;what:string;protected:string;confirm:string;action:string;cancel:string;done:string}>={
 es:{title:'CLEAN · SvenStudio 3D',details:'Se eliminarán permanentemente los datos locales de este navegador para comenzar desde cero.',what:'Autoguardados y copias de recuperación, WAD importados, prefabs internos, preferencias, rutas de compilación, ajustes y paneles guardados.',protected:'NO borra archivos exportados (.map, .bsp, .wad, .svprefab), carpetas externas, archivos de Sven Co-op ni los WAD que ya están en el disco.',confirm:'Escribí CLEAN para confirmar:',action:'CLEAN',cancel:'Cancelar',done:'La página se recargará sin los datos anteriores.'},
 en:{title:'CLEAN · SvenStudio 3D',details:'Permanently remove local data from this browser to start again.',what:'Autosaves and recovery snapshots, imported WADs, internal prefabs, preferences, build paths, settings and saved layouts.',protected:'Does NOT delete exported files, external directories, Sven Co-op files or on-disk WADs.',confirm:'Type CLEAN to confirm:',action:'CLEAN',cancel:'Cancel',done:'The page will reload with a fresh session.'},
 ru:{title:'CLEAN · SvenStudio 3D',details:'Удалить локальные данные браузера.',what:'Автосохранения, WAD, локальные шаблоны, параметры и конфигурации.',protected:'Внешние файлы, Sven Co-op и WAD на диске не удаляются.',confirm:'Введите CLEAN:',action:'CLEAN',cancel:'Отмена',done:'Страница перезагрузится.'},
 ko:{title:'CLEAN · SvenStudio 3D',details:'브라우저의 로컬 데이터를 영구 삭제합니다.',what:'자동 저장, WAD 캐시, 프리팹, 설정, 경로 및 화면 배치.',protected:'내보낸 파일, 외부 폴더, 게임 및 디스크 WAD는 삭제하지 않습니다.',confirm:'확인을 위해 CLEAN 입력:',action:'CLEAN',cancel:'취소',done:'페이지를 다시 불러옵니다.'},
 zh:{title:'CLEAN · SvenStudio 3D',details:'清除此浏览器中的本地数据。',what:'自动存档、WAD 缓存、预制件、设置和布局。',protected:'不删除导出的文件、外部文件夹、游戏或磁盘 WAD。',confirm:'输入 CLEAN 确认：',action:'CLEAN',cancel:'取消',done:'页面将重新加载。'},
 pt:{title:'CLEAN · SvenStudio 3D',details:'Remove os dados locais deste navegador.',what:'Salvamentos, WADs importados, prefabs internos, configurações, caminhos e layouts.',protected:'Não exclui arquivos exportados, pastas externas, arquivos do jogo nem WADs em disco.',confirm:'Digite CLEAN para confirmar:',action:'CLEAN',cancel:'Cancelar',done:'A página será recarregada.'}
};
export function StudioResetDialog({onClose}:{onClose:()=>void}){
 const locale=useEditor(s=>s.locale);
 const words=WORDS[locale]||WORDS.en;
 const [typed,setTyped]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const execute=async()=>{
   if(typed!=='CLEAN'||busy)return;
   setBusy(true);setError('');
   try{await resetStudioBrowserData();window.location.reload();}
   catch(err){setError(String(err instanceof Error?err.message:err));setBusy(false)}
 };
 return <div className="bw-backdrop" onMouseDown={onClose}>
   <section className="studio-reset-dialog" role="dialog" aria-modal="true" aria-label={words.title} onMouseDown={e=>e.stopPropagation()}>
    <header><h2><Trash2 size={21}/>{words.title}</h2><button onClick={onClose} disabled={busy} aria-label={words.cancel}><X size={20}/></button></header>
    <div className="studio-reset-body"><p>{words.details}</p><div className="studio-reset-warning"><AlertTriangle size={19}/><span>{words.what}</span></div>
    <p className="studio-reset-preserve">{words.protected}</p><label>{words.confirm}<input autoFocus value={typed} onChange={e=>setTyped(e.target.value)} spellCheck={false} autoComplete="off"/></label>
    {error&&<p role="alert" className="studio-reset-error">{error}</p>}</div>
    <footer><button type="button" onClick={onClose} disabled={busy}>{words.cancel}</button><button type="button" className="danger" disabled={busy||typed!=='CLEAN'} onClick={()=>void execute()}>{busy?'…':words.action}</button></footer>
   </section>
 </div>;
}
