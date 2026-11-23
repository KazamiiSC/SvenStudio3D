/** Counter-Strike 1.6 spectator overview: overviews/<map>.bmp + overviews/<map>.txt.
 *
 * Geometry follows the Half-Life SDK (cl_dll/hud_spectator.cpp, DrawOverviewLayer) with ROTATED 1:
 * the 1024x768 image covers 8192/ZOOM world units horizontally and 6144/ZOOM vertically,
 * centred on ORIGIN; moving right increases world X, moving down decreases world Y.
 * The engine splits the BMP into 8x6 tiles, so the size is fixed at 1024x768 (8-bit palette).
 *
 * Pure: no DOM, no filesystem. Floors are rasterized top-down and coloured by height.
 */
import type {Brush,MapObject,Vec3} from './types';
import {transformedVertices} from './geometry';

export const OVERVIEW_WIDTH=1024,OVERVIEW_HEIGHT=768;
const TOOL_TEXTURES=/^(?:sky|clip|null|aaatrigger|origin|hint|skip|bevel|solidhint|black_hidden|clipbevel|clipbevelbrush|cliphull\d|translucent|noclip|playerclip|enemyclip)$/i;
// Brush entities that are not walkable surfaces players see.
const NON_SOLID_ENTITIES=/^(?:trigger_|func_buyzone|func_bomb_target|func_hostage_rescue|func_escapezone|func_vip_safetyzone|func_ladder|env_|func_illusionary)/i;

export type OverviewParams={zoom:number;origin:Vec3;height:number;ceiling:number;bounds:{min:Vec3;max:Vec3}};
export type OverviewOptions={ceiling?:number;margin?:number};
type Floor={points:[number,number][];z:number};

function sub(a:Vec3,b:Vec3):Vec3{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a:Vec3,b:Vec3):Vec3{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function len(a:Vec3){return Math.hypot(a[0],a[1],a[2]);}

/** Up-facing faces of solid, visible brushes (outward normal decided from the brush centroid). */
export function overviewFloors(objects:readonly MapObject[]):Floor[]{
  const entities=new Map(objects.filter(o=>o.kind==='entity').map(o=>[o.id,o]));
  const floors:Floor[]=[];
  for(const object of objects){
    if(object.kind!=='brush'||object.hidden)continue;
    const owner=object.entityId?entities.get(object.entityId):undefined;
    if(owner&&owner.kind==='entity'&&NON_SOLID_ENTITIES.test(owner.classname))continue;
    const vertices=transformedVertices(object as Brush);
    if(vertices.length<4)continue;
    const centroid=vertices.reduce<Vec3>((acc,v)=>[acc[0]+v[0]/vertices.length,acc[1]+v[1]/vertices.length,acc[2]+v[2]/vertices.length],[0,0,0]);
    for(const face of object.faces){
      if(face.indices.length<3||TOOL_TEXTURES.test(face.texture||'')||face.bspPrefabGeneratedCap)continue;
      const pts=face.indices.map(i=>vertices[i]).filter(Boolean);
      if(pts.length<3)continue;
      let normal=cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]));
      const n=len(normal);if(n<1e-6)continue;
      normal=[normal[0]/n,normal[1]/n,normal[2]/n];
      const center=pts.reduce<Vec3>((acc,v)=>[acc[0]+v[0]/pts.length,acc[1]+v[1]/pts.length,acc[2]+v[2]/pts.length],[0,0,0]);
      const outward=(center[0]-centroid[0])*normal[0]+(center[1]-centroid[1])*normal[1]+(center[2]-centroid[2])*normal[2];
      const nz=outward<0?-normal[2]:normal[2];
      if(nz<0.35)continue; // floors and walkable slopes only
      floors.push({points:pts.map(p=>[p[0],p[1]]),z:center[2]});
    }
  }
  return floors;
}

/** ZOOM/ORIGIN that fit every floor below the ceiling cut into the image, with a margin. */
export function overviewParams(objects:readonly MapObject[],options:OverviewOptions={}):OverviewParams|null{
  const spawns=objects.filter(o=>o.kind==='entity'&&/^info_player_(?:start|deathmatch)$/.test(o.classname));
  const ceiling=options.ceiling??(spawns.length?Math.max(...spawns.map(s=>s.position[2]))+192:Infinity);
  const floors=overviewFloors(objects).filter(f=>f.z<=ceiling);
  if(!floors.length)return null;
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const f of floors){for(const [x,y] of f.points){min[0]=Math.min(min[0],x);max[0]=Math.max(max[0],x);min[1]=Math.min(min[1],y);max[1]=Math.max(max[1],y);}min[2]=Math.min(min[2],f.z);max[2]=Math.max(max[2],f.z);}
  const margin=options.margin??0.92;
  const width=Math.max(64,max[0]-min[0]),depth=Math.max(64,max[1]-min[1]);
  const zoom=Math.round(Math.min(8192/width,6144/depth)*margin*100)/100;
  const origin:Vec3=[Math.round((min[0]+max[0])/2),Math.round((min[1]+max[1])/2),Math.round(min[2])];
  return {zoom,origin,height:Math.round(min[2]),ceiling,bounds:{min,max}};
}

/** World XY -> overview pixel (ROTATED 1). */
export function worldToOverviewPixel(x:number,y:number,p:OverviewParams):[number,number]{
  const scale=p.zoom/8; // pixels per world unit (8/zoom units per pixel)
  return [(x-(p.origin[0]-4096/p.zoom))*scale,((p.origin[1]+3072/p.zoom)-y)*scale];
}

/** 256-colour palette: 0 background, 1..240 height ramp, 250 outline, 251 spawn T, 252 spawn CT, 253 bombsite. */
export function overviewPalette():Uint8Array{
  const pal=new Uint8Array(256*3);
  const stops:[number,[number,number,number]][]=[[0,[22,40,72]],[0.35,[34,110,140]],[0.65,[86,168,112]],[0.85,[214,196,104]],[1,[236,232,214]]];
  for(let i=1;i<=240;i++){
    const t=(i-1)/239;let k=0;while(k<stops.length-2&&t>stops[k+1][0])k++;
    const [t0,c0]=stops[k],[t1,c1]=stops[k+1],u=(t-t0)/(t1-t0||1);
    for(let c=0;c<3;c++)pal[i*3+c]=Math.round(c0[c]+(c1[c]-c0[c])*u);
  }
  pal.set([18,22,28],250*3);pal.set([226,72,64],251*3);pal.set([72,140,236],252*3);pal.set([255,150,40],253*3);
  return pal;
}

function fillPolygon(buf:Uint8Array,poly:[number,number][],color:number){
  let minY=Infinity,maxY=-Infinity;for(const [,y] of poly){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const y0=Math.max(0,Math.floor(minY)),y1=Math.min(OVERVIEW_HEIGHT-1,Math.ceil(maxY));
  for(let y=y0;y<=y1;y++){
    const sy=y+0.5,xs:number[]=[];
    for(let i=0;i<poly.length;i++){
      const [ax,ay]=poly[i],[bx,by]=poly[(i+1)%poly.length];
      if((ay<=sy&&by>sy)||(by<=sy&&ay>sy))xs.push(ax+(sy-ay)/(by-ay)*(bx-ax));
    }
    xs.sort((a,b)=>a-b);
    for(let k=0;k+1<xs.length;k+=2){
      const from=Math.max(0,Math.ceil(xs[k]-0.5)),to=Math.min(OVERVIEW_WIDTH-1,Math.floor(xs[k+1]-0.5));
      if(to>=from)buf.fill(color,y*OVERVIEW_WIDTH+from,y*OVERVIEW_WIDTH+to+1);
    }
  }
}
function line(buf:Uint8Array,[x0,y0]:[number,number],[x1,y1]:[number,number],color:number){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
  for(let s=0;s<=steps;s++){const x=Math.round(x0+(x1-x0)*s/steps),y=Math.round(y0+(y1-y0)*s/steps);if(x>=0&&y>=0&&x<OVERVIEW_WIDTH&&y<OVERVIEW_HEIGHT)buf[y*OVERVIEW_WIDTH+x]=color;}
}

/** Palette-index image (row 0 = top). */
export function renderOverview(objects:readonly MapObject[],p:OverviewParams):Uint8Array{
  const buf=new Uint8Array(OVERVIEW_WIDTH*OVERVIEW_HEIGHT);
  const floors=overviewFloors(objects).filter(f=>f.z<=p.ceiling).sort((a,b)=>a.z-b.z); // painter's: higher floors on top
  const span=Math.max(1,p.bounds.max[2]-p.bounds.min[2]);
  for(const f of floors){
    const poly=f.points.map(([x,y])=>worldToOverviewPixel(x,y,p));
    const color=1+Math.round(((f.z-p.bounds.min[2])/span)*239);
    fillPolygon(buf,poly,color);
    for(let i=0;i<poly.length;i++)line(buf,poly[i],poly[(i+1)%poly.length],250);
  }
  // Bombsite footprints (func_bomb_target brushes) as orange rectangles, drawn twice for visibility.
  const bombsites=new Set(objects.filter(o=>o.kind==='entity'&&o.classname==='func_bomb_target').map(o=>o.id));
  for(const o of objects){
    if(o.kind!=='brush'||!o.entityId||!bombsites.has(o.entityId))continue;
    const vs=transformedVertices(o);if(!vs.length)continue;
    const xs=vs.map(v=>v[0]),ys=vs.map(v=>v[1]);
    const a=worldToOverviewPixel(Math.min(...xs),Math.max(...ys),p),b=worldToOverviewPixel(Math.max(...xs),Math.min(...ys),p);
    for(const inset of [0,1]){const corners:[number,number][]=[[a[0]+inset,a[1]+inset],[b[0]-inset,a[1]+inset],[b[0]-inset,b[1]-inset],[a[0]+inset,b[1]-inset]];
      for(let i=0;i<4;i++)line(buf,corners[i],corners[(i+1)%4],253);}
  }
  for(const o of objects){
    if(o.kind!=='entity'||!/^info_player_(?:start|deathmatch)$/.test(o.classname))continue;
    const [cx,cy]=worldToOverviewPixel(o.position[0],o.position[1],p);
    const color=o.classname==='info_player_start'?252:251; // CT start / T deathmatch
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=Math.round(cx)+dx,y=Math.round(cy)+dy;if(x>=0&&y>=0&&x<OVERVIEW_WIDTH&&y<OVERVIEW_HEIGHT)buf[y*OVERVIEW_WIDTH+x]=color;}
  }
  return buf;
}

/** 8-bit BI_RGB bitmap (bottom-up rows), as GoldSrc overviews use. */
export function encodeBmp8(indices:Uint8Array,palette:Uint8Array,width=OVERVIEW_WIDTH,height=OVERVIEW_HEIGHT):Uint8Array{
  const rowSize=Math.ceil(width/4)*4,dataSize=rowSize*height,offset=14+40+256*4,size=offset+dataSize;
  const out=new Uint8Array(size),view=new DataView(out.buffer);
  out[0]=0x42;out[1]=0x4d;view.setUint32(2,size,true);view.setUint32(10,offset,true);
  view.setUint32(14,40,true);view.setInt32(18,width,true);view.setInt32(22,height,true);view.setUint16(26,1,true);view.setUint16(28,8,true);
  view.setUint32(30,0,true);view.setUint32(34,dataSize,true);view.setInt32(38,2835,true);view.setInt32(42,2835,true);view.setUint32(46,256,true);view.setUint32(50,256,true);
  for(let i=0;i<256;i++){out[54+i*4]=palette[i*3+2];out[54+i*4+1]=palette[i*3+1];out[54+i*4+2]=palette[i*3];}
  for(let y=0;y<height;y++)out.set(indices.subarray(y*width,(y+1)*width),offset+(height-1-y)*rowSize);
  return out;
}

export function overviewTxt(mapName:string,p:OverviewParams):string{
  const f=(n:number)=>n.toFixed(2);
  return `// overview description file for ${mapName}.bsp (generated by SvenStudio 3D)\n\nglobal\n{\n\tZOOM\t${f(p.zoom)}\n\tORIGIN\t${f(p.origin[0])}\t${f(p.origin[1])}\t${f(p.origin[2])}\n\tROTATED\t1\n}\n\nlayer\n{\n\tIMAGE\t"overviews/${mapName}.bmp"\n\tHEIGHT\t${f(p.height)}\n}\n`;
}

/** Both files, ready to stage into overviews/. Null when the map has no floors yet. */
export function buildCsOverview(mapName:string,objects:readonly MapObject[],options:OverviewOptions={}){
  const params=overviewParams(objects,options);
  if(!params)return null;
  const bmp=encodeBmp8(renderOverview(objects,params),overviewPalette());
  return {params,bmp,txt:overviewTxt(mapName,params)};
}
