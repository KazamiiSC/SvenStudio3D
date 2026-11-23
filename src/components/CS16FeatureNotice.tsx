import {Info,X} from 'lucide-react';
import {useEditor} from '../store';
const MSG:Record<string,{title:string;message:string;close:string}>={
 es:{title:'Herramienta exclusiva de Sven Co-op',message:'Este estudio utiliza entidades o extensiones de Svengine incompatibles con Counter-Strike 1.6. No se ejecuta en este perfil para evitar modificar el mapa con entidades incorrectas. Podés seguir editando geometría, texturas y entidades de CS con el FGD correspondiente.',close:'Cerrar'},
 en:{title:'Sven Co-op-only tool',message:'This studio uses Svengine entities or extensions not supported by Counter-Strike 1.6. It is disabled in this profile to avoid inserting incompatible entities. You can still edit geometry, textures and CS entities using its FGD.',close:'Close'},
 ru:{title:'Инструмент только для Sven Co-op',message:'Студия использует несовместимые с CS 1.6 сущности Svengine. В профиле CS она отключена.',close:'Закрыть'},
 ko:{title:'Sven Co-op 전용 도구',message:'이 도구의 Svengine 엔티티는 CS 1.6과 호환되지 않아 CS 프로필에서는 비활성화됩니다.',close:'닫기'},
 zh:{title:'仅限 Sven Co-op 的工具',message:'该工具依赖 CS 1.6 不支持的 Svengine 实体，已在 CS 配置中禁用。',close:'关闭'},
 pt:{title:'Ferramenta exclusiva do Sven Co-op',message:'Este estudo usa entidades Svengine incompatíveis com o CS 1.6. Fica desativado nesse perfil para evitar entidades inválidas.',close:'Fechar'}
};
export function CS16FeatureNotice({onClose}:{onClose:()=>void}){
 const locale=useEditor(s=>s.locale),m=MSG[locale]||MSG.en;
 return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" role="dialog" aria-modal="true" aria-label={m.title} onMouseDown={e=>e.stopPropagation()}>
  <div className="modal-title"><Info size={19}/><strong>{m.title}</strong><button onClick={onClose}><X size={18}/></button></div>
  <p className="modal-subtext">{m.message}</p><div className="modal-footer"><button className="primary-action" onClick={onClose}>{m.close}</button></div>
 </div></div>;
}
