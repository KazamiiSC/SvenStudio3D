export type Vec3 = [number, number, number];
export type Primitive = 'box' | 'wedge' | 'cylinder' | 'cone' | 'pyramid' | 'icosphere' | 'archSegment' | 'poly';
export type PlaceableShape = 'box' | 'wedge' | 'cylinder' | 'cone' | 'pyramid' | 'icosphere' | 'arch' | 'vault' | 'stairs' | 'pipe';
export type Face = { indices: number[]; texture: string; uShift?: number; vShift?: number; uScale?: number; vScale?: number; rotation?: number; uAxis?: Vec3; vAxis?: Vec3 };
export type Brush = {
  id: string; kind: 'brush'; name: string; primitive: Primitive;
  position: Vec3; rotation: Vec3; scale: Vec3;
  vertices: Vec3[]; faces: Face[];
  hidden?: boolean; locked?: boolean; layer?: string; group?:string; entityId?: string;
};
export type PointEntity = {
  id: string; kind: 'entity'; name: string; classname: string; position: Vec3;
  props: Record<string, string>; hidden?: boolean; locked?: boolean; layer?: string; group?:string;
};
export type MapObject = Brush | PointEntity;
export type TextureAsset = { name: string; wad: string; width: number; height: number; dataUrl: string; sourceId?:string; thumbUrl?:string };
export type FgdClass = { studio?:string; name: string; type: 'point' | 'solid'; description: string; props: Record<string, { label: string; type: string; defaultValue?: string; options?: {value:string;label:string;defaultOn?:boolean}[] }> };
export type OpeningRecord = {id:string;kind:'door'|'window';wall:Brush;memberIds:string[];center:Vec3;options:{width:number;height:number;depth:number;frame:number;steps:number;cutOnly:boolean;doorLeaf:boolean}};
export type Project = { architectureOpenings?:OpeningRecord[]; version: 1; target?: 'svengine'; name: string; objects: MapObject[]; world: Record<string,string>; wadNames: string[]; graphPositions?: Record<string, [number,number]> };
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
