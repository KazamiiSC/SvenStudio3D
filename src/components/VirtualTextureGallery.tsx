import {useEffect,useMemo,useRef,useState} from 'react';
import {Star} from 'lucide-react';
import type {TextureAsset} from '../engine/types';
import {useT} from '../i18n';

/** Windowed WAD gallery. A map can load several thousand textures, but the DOM
 * and thumbnail decode budget remain proportional to the visible viewport.
 * Stable keys/order and independent scroll state prevent jumping on selection.
 */
import {textureGalleryWindow} from '../engine/textureGalleryWindow';

function galleryColumns(width:number){return width>760?5:width>575?4:width>385?3:width<225?1:2;}
export function VirtualTextureGallery({textures,resetKey,selected,onPick,isFavorite,onFavorite,onContextMenu}:{
  textures:TextureAsset[];resetKey:string;selected:string;onPick:(texture:TextureAsset)=>void;
  isFavorite:(texture:TextureAsset)=>boolean;onFavorite:(texture:TextureAsset)=>void;
  onContextMenu:(event:React.MouseEvent<HTMLDivElement>,texture:TextureAsset)=>void;
}){
  const t=useT();
  const ref=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:266,height:460});
  const [scroll,setScroll]=useState(0);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    const measure=()=>setSize(old=>{
      const next={width:element.clientWidth,height:element.clientHeight};
      return old.width===next.width&&old.height===next.height?old:next;
    });
    measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    observer?.observe(element);return()=>observer?.disconnect();
  },[]);
  // Changing the WAD/filter/search changes the underlying content; painting
  // never does, so scrolling stays exactly where the user left it.
  const signature=useMemo(()=>textures.length+':'+(textures[0]?.wad||'')+':'+(textures[0]?.name||'')+':'+(textures.at(-1)?.name||''),[textures]);
  useEffect(()=>{setScroll(0);if(ref.current)ref.current.scrollTop=0;},[signature,resetKey]);
  const columns=galleryColumns(size.width);
  const windowed=textureGalleryWindow(textures.length,columns,scroll,size.height);
  const visible=textures.slice(windowed.from,windowed.to);
  return <div className="texture-results assets-scroll virtual-texture-results" ref={ref} onScroll={e=>setScroll(e.currentTarget.scrollTop)}>
    <p className="texture-progress">{t('Showing textures')}: {textures.length} / {textures.length}</p>
    <div className="texture-grid virtual-texture-grid" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,paddingTop:windowed.top+8,paddingBottom:windowed.bottom+8}}>
      {visible.map(texture=><div key={texture.wad+':'+texture.name} className={`texture-tile ${selected===texture.name?'chosen':''}`} onContextMenu={e=>onContextMenu(e,texture)}>
        <button className="texture-apply" draggable onDragStart={e=>{e.dataTransfer.setData('application/x-svenstudio-texture',texture.name);e.dataTransfer.effectAllowed='copy'}} onClick={()=>onPick(texture)} title={`${texture.name} · ${texture.width}x${texture.height} · ${texture.wad}`}>
          <img src={texture.thumbUrl||texture.dataUrl} alt={texture.name} loading="lazy" decoding="async"/><span>{texture.name}</span>
        </button>
        <button className={`texture-favorite ${isFavorite(texture)?'active':''}`} onClick={()=>onFavorite(texture)} title={t('Toggle favorite')}><Star size={12} fill={isFavorite(texture)?'currentColor':'none'}/></button>
      </div>)}
    </div>
  </div>;
}
