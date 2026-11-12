/** Yaw rotation ring: X/Z world-plane bearings and wrap-safe drag updates. */
export function bspRingBearing(x:number,z:number,centerX:number,centerZ:number):number{
  return Math.atan2(x-centerX,z-centerZ);
}
/** Accumulate the shortest pointer-to-pointer arc without a 180-degree jump. */
export function bspRingDragAngle(previousAngle:number,previousBearing:number,nextBearing:number):number{
  const movement=nextBearing-previousBearing;
  return previousAngle+Math.atan2(Math.sin(movement),Math.cos(movement));
}

/** Compact twin-arc rotation handle. The broad invisible hit zone is deliberately
 * larger than the visible arcs so rotation never needs pixel-perfect clicks. */
export const BSP_RING_VISUAL = {
  innerRadius:20, outerRadius:26,
  grabInnerRadius:13, grabOuterRadius:35,
  arcDegrees:150, gapDegrees:30,
  segmentsPerArc:48
} as const;

/** Triangles for two opposing curved arrow strokes, in the XY plane.
 * Each arc has a subtle tapered arrow tip built into the stroke, with no
 * protruding straight arrow or claimed NPC forward direction. */
export function bspRotationArcTriangles():Float32Array{
  const {innerRadius,outerRadius,arcDegrees,segmentsPerArc}=BSP_RING_VISUAL;
  const radius=(innerRadius+outerRadius)/2;
  const halfWidth=(outerRadius-innerRadius)/2;
  const coords:number[]=[];
  const at=(base:number,step:number):[number,number,number,number]=>{
    const t=step/segmentsPerArc;
    const phase=(base+15+t*arcDegrees)*Math.PI/180;
    // Wider near the end for a recognizable circular-arrow head; narrow to
    // a point at its tip. The rest is a clean, gently thickened curved stroke.
    const width=t<.84?halfWidth:t<.90?halfWidth*(1+(.45*(t-.84)/.06)):halfWidth*1.45*(1-t)/.10;
    const cos=Math.cos(phase),sin=Math.sin(phase);
    return [(radius-width)*cos,(radius-width)*sin,(radius+width)*cos,(radius+width)*sin];
  };
  for(const base of [0,180]){
    for(let i=0;i<segmentsPerArc;i++){
      const [ix,iy,ox,oy]=at(base,i),[jx,jy,px,py]=at(base,i+1);
      coords.push(ix,iy,0, ox,oy,0, jx,jy,0, ox,oy,0, px,py,0, jx,jy,0);
    }
  }
  return new Float32Array(coords);
}
