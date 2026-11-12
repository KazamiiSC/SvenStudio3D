/**
 * Hammer / SvenCraft GoldSrc RMF importer (RMF 1.4, 1.6, 1.8 and 2.2).
 * It does not execute external code, read machine paths or change editor state.
 * RMF geometry is converted through the existing MAP reconstruction validator so
 * brushes/entities have precisely the same representation as native MAP imports.
 * Editor-only information is retained in Project.sourceEditor for .svstudio save.
 *
 * Binary layout independently cross-checked against Sledge.Formats.Map (MIT)
 * and independently verified Worldcraft RMF 1.6/1.8 documentation.
 */
import {inspectMapImport,type MapImportResult} from './importMap';
import type {Project,Vec3} from './types';

export type RmfVisgroup={id:number;name:string;color:[number,number,number,number];visible:boolean};
export type RmfCamera={eye:Vec3;look:Vec3;active:boolean};
export type RmfPathNode={id:number;name:string;position:Vec3;properties:Record<string,string>};
export type RmfPath={name:string;type:string;direction:number;nodes:RmfPathNode[]};
export type RmfGroupInfo={id:number;parentId:number|null;visgroupId:number;color:Vec3};
export type RmfObjectInfo={visgroupId:number;color:Vec3;groupPath:number[];sourceIndex:number;
  originalProperties?:Array<[string,string]>; originalOrigin?:Vec3; unusedEntityField?:number;
  surfaceData?:Array<{alignment:number;flags:number;contents:number;value:number}>};
export type RmfSourceEditor={format:'rmf';version:number;visgroups:RmfVisgroup[];cameras:RmfCamera[];paths:RmfPath[];
  groups:number;groupInfo:Record<string,RmfGroupInfo>;worldProperties:Array<[string,string]>;worldVisgroupId:number;worldColor:Vec3;objectInfo:Record<string,RmfObjectInfo>};
export type RmfImportResult=MapImportResult & {sourceEditor:RmfSourceEditor; summary:{version:number;brushes:number;entities:number;groups:number;visgroups:number;cameras:number;paths:number}};

type RmfFace={texture:string;points:[Vec3,Vec3,Vec3];uAxis?:Vec3;vAxis?:Vec3;rotation:number;uShift:number;vShift:number;uScale:number;vScale:number;alignment:number;flags:number;contents:number;value:number};
type RmfNode={type:string;visgroupId:number;color:Vec3;groupPath:number[];index:number;children:RmfNode[];faces?:RmfFace[];entity?:{classname:string;unused4:number;spawnflags:number;keys:Record<string,string>;pairs:Array<[string,string]>};origin?:Vec3};
class Cursor {
  private view:DataView;
  private data:Uint8Array;
  private decoder=new TextDecoder('windows-1252');
  pos=0;
  constructor(buffer:ArrayBuffer){this.view=new DataView(buffer);this.data=new Uint8Array(buffer)}
  get length(){return this.data.length}
  need(n:number){if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.length)throw Error(`RMF truncado o inválido en byte ${this.pos} (se requieren ${n} bytes).`)}
  skip(n:number){this.need(n);this.pos+=n}
  u8(){this.need(1);return this.data[this.pos++]}
  i32(){this.need(4);const val=this.view.getInt32(this.pos,true);this.pos+=4;return val}
  f32(){this.need(4);const val=this.view.getFloat32(this.pos,true);this.pos+=4;if(!Number.isFinite(val))throw Error(`RMF contiene una coordenada o medida no finita en ${this.pos-4}.`);return val}
  fixed(n:number){this.need(n);const s=this.data.subarray(this.pos,this.pos+n);this.pos+=n;const end=s.indexOf(0);return this.decoder.decode(end<0?s:s.subarray(0,end))}
  pchar(){return this.fixed(this.u8())}
  vec():Vec3{return [this.f32(),this.f32(),this.f32()]}
  count(name:string,max:number){const n=this.i32();if(n<0||n>max)throw Error(`Cantidad ${name} inválida en RMF: ${n}.`);return n}
}
const nfmt=(n:number)=>Object.is(n,-0)||Math.abs(n)<.0000005?'0':Number(n.toFixed(6)).toString();
const point=(p:Vec3)=>`( ${p.map(nfmt).join(' ')} )`;
const kv=(key:string,value:string)=>`"${key.replace(/["\r\n]/g,'_')}" "${value.replace(/["\r\n]/g,' ')}"`;
const validVersions=[1.4,1.6,1.8,2.2];
function parseRmf(buffer:ArrayBuffer){
  if(buffer.byteLength>120_000_000)throw Error('RMF supera el límite de seguridad de 120 MB.');
  const r=new Cursor(buffer);
  const f=r.f32();const foundVersion=validVersions.find(v=>Math.abs(f-v)<.0001);
  if(foundVersion===undefined)throw Error(`Versión RMF ${f} no compatible. Versiones admitidas: ${validVersions.join(', ')}.`);
  const version:number=foundVersion;
  if(r.fixed(3)!=='RMF')throw Error('El archivo no contiene una cabecera RMF válida.');
  const visgroups:RmfVisgroup[]=[];let groups=0,objects=0;
  const groupInfo:Record<string,RmfGroupInfo>={};
  if(version>0.9){
    for(let i=0,n=r.count('VisGroups',200000);i<n;i++){
      const name=r.fixed(128),color:[number,number,number,number]=[r.u8(),r.u8(),r.u8(),r.u8()];
      const id=r.i32(),visible=r.u8()!==0;r.skip(3);
      visgroups.push({id,name,color,visible});
    }
  }
  const paths:RmfPath[]=[];
  function readEntityData(){
    const classname=r.pchar(),unused4=r.i32(),spawnflags=r.i32(),keys:Record<string,string>={},pairs:Array<[string,string]>=[];
    for(let i=0,n=r.count('claves de entidad',200000);i<n;i++){
      const k=r.pchar(),v=r.pchar();if(k){keys[k]=v;pairs.push([k,v]);}
    }
    if(version>=1.6)r.skip(12);
    return {classname,unused4,spawnflags,keys,pairs};
  }
  function readFace():RmfFace{
    const texture=r.fixed(version<=1.6?40:260)||'NULL';
    let uAxis:Vec3|undefined,vAxis:Vec3|undefined,rotation:number,uShift:number,vShift:number;
    if(version>=2.2){uAxis=r.vec();uShift=r.f32();vAxis=r.vec();vShift=r.f32();rotation=r.f32()}
    else{rotation=r.f32();uShift=r.f32();vShift=r.f32()}
    const uScale=r.f32(),vScale=r.f32();
    let alignment=0,flags=0,contents=0,value=0;
    if(version>=1.4)alignment=r.i32();
    if(version>=1.8){flags=r.i32();contents=r.i32();value=r.i32()}
    const vertexCount=r.count('vértices de cara',16384);
    r.skip(vertexCount*12); // Hammer's face cache: planes are the authoritative data.
    const points:[Vec3,Vec3,Vec3]=[r.vec(),r.vec(),r.vec()];
    return {texture,points,uAxis,vAxis,rotation,uShift,vShift,uScale,vScale,alignment,flags,contents,value};
  }
  function readNode(depth:number,parentGroups:number[]):RmfNode{
    if(depth>96||++objects>500000)throw Error('RMF excede el límite de seguridad de objetos anidados.');
    const type=r.pchar();
    if(!['CMapWorld','CMapGroup','CMapSolid','CMapEntity'].includes(type))throw Error(`Tipo de objeto RMF no reconocido: ${type}.`);
    const visgroupId=r.i32(),color:Vec3=[r.u8(),r.u8(),r.u8()];
    const index=objects;
    const groupId=type==='CMapGroup'?++groups:0;
    const groupPath=groupId?[...parentGroups,groupId]:parentGroups;
    if(groupId)groupInfo[String(groupId)]={id:groupId,parentId:parentGroups.at(-1)??null,visgroupId,color};
    const node:RmfNode={type,visgroupId,color,index,groupPath,children:[]};
    for(let i=0,n=r.count('objetos hijos',500000);i<n;i++)node.children.push(readNode(depth+1,groupPath));
    if(type==='CMapSolid'){
      node.faces=[];
      for(let i=0,n=r.count('caras',4096);i<n;i++)node.faces.push(readFace());
    }
    if(type==='CMapWorld'||type==='CMapEntity'){
      node.entity=readEntityData();
      if(type==='CMapEntity'){
        r.skip(2);node.origin=r.vec();r.skip(4);
      }else{
        for(let i=0,n=r.count('rutas',10000);i<n;i++){
          const name=r.fixed(128),pathType=r.fixed(128),direction=r.i32();
          const nodes:RmfPathNode[]=[];
          for(let j=0,m=r.count('nodos de ruta',100000);j<m;j++){
            const position=r.vec(),id=r.i32(),nodeName=r.fixed(128),properties:Record<string,string>={};
            for(let k=0,c=r.count('propiedades de ruta',10000);k<c;k++)properties[r.pchar()]=r.pchar();
            nodes.push({id,name:nodeName,position,properties});
          }
          paths.push({name,type:pathType,direction,nodes});
        }
      }
    }
    return node;
  }
  const world=readNode(0,[]);
  if(world.type!=='CMapWorld'||!world.entity)throw Error('El RMF no contiene un worldspawn válido.');
  const cameras:RmfCamera[]=[];
  if(r.pos<r.length){
    if(r.fixed(8)!=='DOCINFO')throw Error(`Datos extra RMF no reconocidos en byte ${r.pos-8}.`);
    r.f32();const active=r.i32();
    for(let i=0,n=r.count('cámaras',100000);i<n;i++)cameras.push({eye:r.vec(),look:r.vec(),active:i===active});
  }
  if(r.pos!==r.length)throw Error(`RMF contiene ${r.length-r.pos} bytes sin interpretar. Se cancela para evitar pérdida de datos.`);
  return {world,version,visgroups,paths,cameras,groups,groupInfo};
}

/** Converts a native GoldSrc RMF to a validated SvenStudio project in memory. */
export function inspectRmfImport(buffer:ArrayBuffer,fileName='Imported RMF'):RmfImportResult{
  const doc=parseRmf(buffer);
  const worldSolids:RmfNode[]=[],entities:{node:RmfNode;solids:RmfNode[]}[]=[];
  function walk(node:RmfNode,out:RmfNode[]){
    if(node.type==='CMapEntity'){
      const solidChildren:RmfNode[]=[];
      for(const child of node.children)walk(child,solidChildren);
      entities.push({node,solids:solidChildren});
    }else if(node.type==='CMapSolid')out.push(node);
    else for(const child of node.children)walk(child,out);
  }
  walk(doc.world,worldSolids);
  // A direct conversion to MAP goes through the *existing* geometry
  // reconstruction/validation used for BSP Recovery and normal MAP imports.
  function solidText(solid:RmfNode){
    return `{\n${(solid.faces??[]).map(f=>{
      const plane=f.points.map(point).join(' ');
      const tex=f.texture.replace(/\\/g,'/').replace(/\s/g,'_');
      const uv=f.uAxis&&f.vAxis
        ?`[ ${f.uAxis.map(nfmt).join(' ')} ${nfmt(f.uShift)} ] [ ${f.vAxis.map(nfmt).join(' ')} ${nfmt(f.vShift)} ] ${nfmt(f.rotation)} ${nfmt(f.uScale)} ${nfmt(f.vScale)}`
        :`${nfmt(f.uShift)} ${nfmt(f.vShift)} ${nfmt(f.rotation)} ${nfmt(f.uScale)} ${nfmt(f.vScale)}`;
      return `${plane} ${tex} ${uv}`;
    }).join('\n')}\n}`;
  }
  function propsText(n:RmfNode,brushCount:number){
    const data=n.entity!;
    // ImportMap's parser handles ordinary MAP keyvalues; we restore the
    // complete original keyvalue dictionary below to avoid corrupting quotes.
    const props=[kv('classname',data.classname||'info_target')];
    if(n.type==='CMapEntity'&&brushCount===0&&n.origin)props.push(kv('origin',n.origin.map(nfmt).join(' ')));
    if(n.type==='CMapWorld'&&data.keys.wad)props.push(kv('wad',data.keys.wad));
    return props.join('\n');
  }
  const sourceBrushes=[...worldSolids,...entities.flatMap(e=>e.solids)];
  const mapSource=[`{\n${propsText(doc.world,worldSolids.length)}\n${worldSolids.map(solidText).join('\n')}\n}`,
    ...entities.map(({node,solids})=>`{\n${propsText(node,solids.length)}\n${solids.map(solidText).join('\n')}\n}`)].join('\n');
  const result=inspectMapImport(mapSource,fileName.replace(/\.rmf$/i,'.map'));
  if(result.report.skippedBrushes)throw Error(`El RMF contiene ${result.report.skippedBrushes} de ${result.report.totalBrushes} brushes que SvenStudio no puede reconstruir sin modificar su geometría. Se canceló la importación y no se cambió el mapa. ${result.report.skippedLocations.slice(0,4).join(' | ')}`);
  if(result.importedBrushes.length!==sourceBrushes.length)throw Error('La cantidad de brushes RMF no coincide con la geometría reconstruida.');
  const sourceEditor:RmfSourceEditor={format:'rmf',version:doc.version,visgroups:doc.visgroups,cameras:doc.cameras,paths:doc.paths,groups:doc.groups,groupInfo:doc.groupInfo,worldProperties:doc.world.entity!.pairs,worldVisgroupId:doc.world.visgroupId,worldColor:doc.world.color,objectInfo:{}};
  const visById=new Map(doc.visgroups.map(v=>[v.id,v]));
  // Hammer can assign a VisGroup to the container group rather than to each
  // individual child. Respect the visibility inherited through nested groups.
  const effectiveVisgroupId=(node:RmfNode):number=>{
    if(node.visgroupId>0)return node.visgroupId;
    for(let i=node.groupPath.length-1;i>=0;i--){
      const inherited=doc.groupInfo[String(node.groupPath[i])]?.visgroupId;
      if(inherited>0)return inherited;
    }
    return 0;
  };
  for(const {sourceBrushIndex,brush} of result.importedBrushes){
    const source=sourceBrushes[sourceBrushIndex];
    if(!source)throw Error(`No se encontró la cara original del brush RMF #${sourceBrushIndex}.`);
    const vis=visById.get(effectiveVisgroupId(source));
    if(vis){brush.layer=`VisGroup: ${vis.name}`;if(!vis.visible)brush.hidden=true}
    if(source.groupPath.length)brush.group=`RMF Group ${source.groupPath.at(-1)}`;
    sourceEditor.objectInfo[brush.id]={visgroupId:source.visgroupId,color:source.color,groupPath:[...source.groupPath],sourceIndex:source.index,
      surfaceData:source.faces?.map(f=>({alignment:f.alignment,flags:f.flags,contents:f.contents,value:f.value}))};
  }
  const importedEntities=result.project.objects.filter(o=>o.kind==='entity');
  if(importedEntities.length!==entities.length)throw Error(`Entidades RMF incompletas: ${importedEntities.length} de ${entities.length}.`);
  entities.forEach(({node},i)=>{
    const target=importedEntities[i],data=node.entity!,vis=visById.get(effectiveVisgroupId(node));
    if(target.kind!=='entity')throw Error('Error interno en el orden de entidades RMF.');
    const props={...data.keys};
    delete props.classname;
    // Origin on point entities is represented by position; preserve explicit
    // origin on brush entities (pivots and custom mapping workflows).
    if(!entities[i].solids.length)delete props.origin;
    if(!('spawnflags' in props)&&data.spawnflags!==0)props.spawnflags=String(data.spawnflags);
    target.props=props;
    target.classname=data.classname;
    target.name=data.classname;
    if(vis){target.layer=`VisGroup: ${vis.name}`;if(!vis.visible)target.hidden=true}
    if(node.groupPath.length)target.group=`RMF Group ${node.groupPath.at(-1)}`;
    sourceEditor.objectInfo[target.id]={visgroupId:node.visgroupId,color:node.color,groupPath:[...node.groupPath],sourceIndex:node.index,originalProperties:data.pairs,originalOrigin:node.origin,unusedEntityField:data.unused4};
  });
  const world:Record<string,string>={...doc.world.entity!.keys,classname:'worldspawn'};
  if(!('spawnflags' in world)&&doc.world.entity!.spawnflags!==0)world.spawnflags=String(doc.world.entity!.spawnflags);
  result.project.world=world;
  result.project.wadNames=(world.wad||'').split(';').filter(Boolean).map(p=>p.trim().split(/[\\/]/).at(-1)||p.trim());
  result.project.name=fileName.replace(/\.rmf$/i,'');
  result.project.sourceEditor=sourceEditor;
  return {...result,sourceEditor,summary:{version:doc.version,brushes:sourceBrushes.length,entities:entities.length,groups:doc.groups,visgroups:doc.visgroups.length,cameras:doc.cameras.length,paths:doc.paths.length}};
}
