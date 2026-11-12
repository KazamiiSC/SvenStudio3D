/** GPU-only BSP diffuse UV editing. Never touches original baked lightmap UV1. */
export type BspTexAxis=readonly [number,number,number,number];
/** Geometry positions are [game X, game Z, -game Y] in R3F. */
export function bspBatchedUvVertex(x:number,y:number,z:number,s:BspTexAxis,t:BspTexAxis,width:number,height:number):[number,number]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid texture dimensions.');
  const gameX=x,gameY=-z,gameZ=y;
  return [(s[0]*gameX+s[1]*gameY+s[2]*gameZ+s[3])/width,
    -(t[0]*gameX+t[1]*gameY+t[2]*gameZ+t[3])/height];
}
/** Each triangle contributes exactly three vertices in buildBspScene(). */
export function bspFaceIdVertexRanges(ids:Uint32Array):Map<number,number[]>{
  const map=new Map<number,number[]>();
  for(let tri=0;tri<ids.length;tri++){
    const id=ids[tri],indices=map.get(id)||[];
    indices.push(tri*3,tri*3+1,tri*3+2);map.set(id,indices);
  }
  return map;
}
