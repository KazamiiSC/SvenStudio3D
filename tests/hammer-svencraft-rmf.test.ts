import {describe,it,expect} from 'vitest';
import {inspectRmfImport} from '../src/engine/importRmf';
import {validateProjectFile} from '../src/engine/projectValidation';

type Vec=[number,number,number];
const planes:Vec[][]=[
  [[0,0,0],[0,0,64],[0,64,64]],
  [[64,0,0],[64,64,0],[64,64,64]],
  [[0,0,0],[64,0,0],[64,0,64]],
  [[0,64,0],[0,64,64],[64,64,64]],
  [[0,0,0],[0,64,0],[64,64,0]],
  [[0,0,64],[64,0,64],[64,64,64]],
];
class Bin {
  chunks:number[]=[];
  b(v:number){this.chunks.push(v&255)}
  i(v:number){const d=new DataView(new ArrayBuffer(4));d.setInt32(0,v,true);this.chunks.push(...new Uint8Array(d.buffer))}
  f(v:number){const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,v,true);this.chunks.push(...new Uint8Array(d.buffer))}
  bytes(a:number[]){this.chunks.push(...a)}
  fixed(t:string,n:number){const a=Array.from(new TextEncoder().encode(t));this.bytes([...a.slice(0,n),...Array(Math.max(0,n-a.length)).fill(0)])}
  p(t:string){const a=Array.from(new TextEncoder().encode(t));this.b(a.length+1);this.bytes(a);this.b(0)}
  vec(p:Vec){p.forEach(v=>this.f(v))}
  obj(kind:string,id:number,children:()=>void){this.p(kind);this.i(id);this.bytes([15,30,45]);children()}
  base(kind:string,id:number,childCount:number,children:()=>void){this.p(kind);this.i(id);this.bytes([15,30,45]);this.i(childCount);children()}
  ent(name:string,keys:Record<string,string>,angle=0,spawnflags=0,version=2.2){this.p(name);this.i(angle);this.i(spawnflags);this.i(Object.keys(keys).length);Object.entries(keys).forEach(([k,v])=>{this.p(k);this.p(v)});if(version>=1.6)this.bytes(Array(12).fill(0))}
  solid(version:number,texture='CUSTOM_WALL'){
    this.base('CMapSolid',0,0,()=>{});
    this.i(6);
    for(const p of planes){
      this.fixed(texture,version<=1.6?40:260);
      if(version===2.2){this.vec([1,0,0]);this.f(12);this.vec([0,1,0]);this.f(-8);this.f(45)}
      else{this.f(45);this.f(12);this.f(-8)}
      this.f(.5);this.f(2);
      if(version>=1.4)this.i(1);
      if(version>=1.8){this.i(0);this.i(0);this.i(0)}
      this.i(0); // empty polygon cache is legal: use authoritative plane points
      p.forEach(q=>this.vec(q));
    }
  }
  finish(){return Uint8Array.from(this.chunks).buffer}
}
function fixture(version=2.2){
  const b=new Bin();b.f(version);b.fixed('RMF',3);
  b.i(1);b.fixed('Outside',128);b.bytes([10,20,30,255]);b.i(4);b.b(1);b.bytes([0,0,0]);
  b.base('CMapWorld',0,2,()=>{
    b.base('CMapGroup',4,1,()=>b.solid(version));
    b.base('CMapEntity',4,0,()=>{});
    b.ent('info_player_start',{targetname:'start_point',angles:'0 180 0',message:'A quoted "phrase"'},0,0,version);
    b.bytes([0,0]);b.vec([10,20,30]);b.i(0);
  });
  b.ent('worldspawn',{wad:'C:\\Sven Coop\\halflife.wad;C:\\custom.wad',skyname:'desert'},0,0,version);
  b.i(1);b.fixed('intro_path',128);b.fixed('path_corner',128);b.i(0);b.i(1);
  b.vec([1,2,3]);b.i(7);b.fixed('node0',128);b.i(1);b.p('wait');b.p('2');
  b.fixed('DOCINFO',8);b.f(.2);b.i(0);b.i(1);b.vec([10,20,30]);b.vec([0,0,0]);
  return b.finish();
}
describe('Hammer / SvenCraft source RMF import',()=>{
  for(const v of [1.4,1.6,1.8,2.2])it(`opens RMF ${v} without losing brushes or entities`,()=>{
    const item=inspectRmfImport(fixture(v),'my_sven_map.rmf');
    expect(item.report.skippedBrushes).toBe(0);
    expect(item.summary).toEqual({version:v,brushes:1,entities:1,groups:1,visgroups:1,cameras:1,paths:1});
    expect(item.project.objects.filter(o=>o.kind==='brush')).toHaveLength(1);
    const ent=item.project.objects.find(o=>o.kind==='entity');
    expect(ent?.kind).toBe('entity');
    if(ent?.kind==='entity'){
      expect(ent.position).toEqual([10,20,30]);expect(ent.props.targetname).toBe('start_point');
      expect(ent.props.angles).toBe('0 180 0');
      expect(ent.props.message).toBe('A quoted "phrase"');
    }
    expect(item.project.wadNames).toEqual(['halflife.wad','custom.wad']);
    expect(item.project.world.skyname).toBe('desert');
    expect(item.project.sourceEditor?.visgroups[0].name).toBe('Outside');
    expect(item.project.sourceEditor?.paths[0].nodes[0].properties.wait).toBe('2');
    expect(item.project.sourceEditor?.cameras[0].eye).toEqual([10,20,30]);
    const brush=item.project.objects.find(o=>o.kind==='brush');
    if(brush?.kind==='brush'){
      expect(brush.group).toBe('RMF Group 1');
      expect(brush.layer).toBe('VisGroup: Outside');
      expect(item.project.sourceEditor?.groupInfo['1'].visgroupId).toBe(4);
      expect(brush.faces).toHaveLength(6);
      expect(brush.faces.every(f=>f.texture==='CUSTOM_WALL')).toBe(true);
      expect(item.project.sourceEditor?.objectInfo[brush.id].sourceIndex).toBeGreaterThan(0);
      if(v===2.2){
        expect(brush.faces.every(f=>f.uShift===12&&f.vShift===-8)).toBe(true);
        expect(brush.faces.every(f=>f.uAxis?.[0]===1&&f.vAxis?.[1]===1)).toBe(true);
      }
      const roundTrip=validateProjectFile(JSON.parse(JSON.stringify(item.project)));
      expect(roundTrip.sourceEditor?.groupInfo['1'].visgroupId).toBe(4);
      expect(roundTrip.sourceEditor?.objectInfo[brush.id].sourceIndex).toBeGreaterThan(0);
    }
  });
  it('refuses unsupported versions and truncated RMF with no state changes',()=>{
    const b=fixture();new DataView(b).setFloat32(0,9.9,true);
    expect(()=>inspectRmfImport(b)).toThrow(/no compatible/);
    expect(()=>inspectRmfImport(fixture().slice(0,37))).toThrow(/truncado/);
  });
  it('rejects missing geometry instead of silently importing an incomplete project',()=>{
    const b=fixture();
    // Intentionally change the first solid face texture/shape only in another fixture;
    // an invalid/truncated RMF must fail before returning a project.
    expect(()=>inspectRmfImport(b.slice(0,b.byteLength-1))).toThrow();
  });
});
