/** World Builder v1.9: pure, deterministic terrain operations.
 * The operations never mutate the project or generate unvalidated MAP brushes.
 * The existing terrain.ts remains the only geometry/export implementation.
 */
import type {TerrainDraft} from './terrain';

export type WorldPreset='flat'|'hills'|'mountains'|'valley'|'canyon'|'island'|'crater'|'dunes'|'plateau';
export type TerrainTransform='smooth'|'terrace'|'normalize'|'mirrorX'|'mirrorY'|'rotate90';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const round=(n:number)=>{const result=Math.round(n*100)/100;return result===0?0:result;};
const hash=(x:number,y:number,seed:number)=>{
  let h=Math.imul(x|0,0x1f123bb5)^Math.imul(y|0,0x5f356495)^Math.imul(seed|0,0x45d9f3b);
  h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/0xffffffff;
};
const noise=(x:number,y:number,seed:number)=>{
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
  const smooth=(t:number)=>t*t*(3-2*t),a=smooth(u),b=smooth(v);
  const row=(yi:number)=>hash(i,yi,seed)*(1-a)+hash(i+1,yi,seed)*a;
  return (row(j)*(1-b)+row(j+1)*b)*2-1;
};
function fractal(x:number,y:number,seed:number):number{
  let sum=0,scale=0,f=1,amp=1;
  for(let i=0;i<5;i++){sum+=noise(x*f,y*f,seed+i*127)*amp;scale+=amp;f*=2;amp*=0.5;}
  return sum/scale;
}
/** Preserve established elevation constraints and count. No Math.random(). */
export function generateWorldHeights(resolution:number,preset:WorldPreset,amplitude:number,seed:number):number[]{
  if(!Number.isInteger(resolution)||resolution<1||resolution>64||!Number.isFinite(seed)||!Number.isFinite(amplitude)||amplitude<0||amplitude>512)
    throw Error('Invalid World Builder generator settings.');
  const output:number[]=[];
  for(let j=0;j<=resolution;j++)for(let i=0;i<=resolution;i++){
    const x=i/resolution*2-1,y=j/resolution*2-1;
    const distance=Math.hypot(x,y),wave=fractal((x+2)*1.65,(y+2)*1.65,seed);
    const detail=fractal((x+2)*4.3,(y+2)*4.3,seed+41);
    let height=0;
    switch(preset){
      case 'flat':height=0;break;
      case 'hills':height=wave*0.8+detail*0.16;break;
      case 'mountains':height=Math.pow(clamp((wave+0.9)/1.8,0,1),1.75)*1.5-0.34;break;
      case 'valley':height=clamp(Math.abs(x+Math.sin(y*3+seed)*0.23)*1.25,0,1.2)-0.5+detail*0.14;break;
      case 'canyon':height=(0.55-Math.exp(-Math.pow((x-Math.sin(y*2+seed)*0.2)/0.30,2)))*1.35+detail*0.10;break;
      case 'island':height=clamp(1-distance*1.15,-0.65,1)+wave*0.24;break;
      case 'crater':height=-Math.exp(-Math.pow((distance-0.04)/0.46,4))+Math.exp(-Math.pow((distance-0.67)/0.13,2))*0.47+detail*0.08;break;
      case 'dunes':height=Math.sin(x*8+y*3+wave*2)*0.47+wave*0.24;break;
      case 'plateau':height=clamp((0.8-distance)*6,-0.45,0.75)+detail*0.08;break;
      default:throw Error('Unknown World Builder landscape preset.');
    }
    output.push(round(clamp(height*amplitude,-512,512)));
  }
  return output;
}

/** Sample an RGBA raster by bilinear interpolation, using visible RGB (not alpha)
 * and ignoring hidden fully-transparent pixels. Image X,Y increase right/down,
 * matching the top-down terrain grid coordinate convention.
 */
export function heightsFromRgba(pixels:Uint8ClampedArray,width:number,height:number,resolution:number,minHeight:number,maxHeight:number,invert=false):number[]{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>4096||height>4096||pixels.length!==width*height*4)
    throw Error('Invalid heightmap image dimensions.');
  if(!Number.isInteger(resolution)||resolution<1||resolution>64||![minHeight,maxHeight].every(Number.isFinite)||minHeight< -512||maxHeight>512||minHeight>=maxHeight)
    throw Error('Heightmap elevation range must be ascending and between -512 and 512.');
  const sample=(x:number,y:number)=>{
    const idx=(y*width+x)*4,alpha=pixels[idx+3]/255;
    if(alpha<0.05)return 0.5;
    return (pixels[idx]*0.2126+pixels[idx+1]*0.7152+pixels[idx+2]*0.0722)/255;
  };
  return Array.from({length:(resolution+1)**2},(_,index)=>{
    const ix=index%(resolution+1),iy=Math.floor(index/(resolution+1));
    const px=ix/resolution*(width-1),py=iy/resolution*(height-1);
    const x=Math.floor(px),y=Math.floor(py),u=px-x,v=py-y;
    const lum0=sample(x,y)*(1-u)+sample(Math.min(width-1,x+1),y)*u;
    const lum1=sample(x,Math.min(height-1,y+1))*(1-u)+sample(Math.min(width-1,x+1),Math.min(height-1,y+1))*u;
    const lum=lum0*(1-v)+lum1*v;
    return round(clamp(minHeight+(invert?1-lum:lum)*(maxHeight-minHeight),-512,512));
  });
}
export function sampleTerrainHeight(heights:number[],resolution:number,u:number,v:number):number{
  if(!Number.isInteger(resolution)||resolution<1||heights.length!==(resolution+1)**2)throw Error('Invalid terrain grid.');
  const x=clamp(u,0,1)*resolution,y=clamp(v,0,1)*resolution;
  const i=Math.floor(x),j=Math.floor(y),dx=x-i,dy=y-j;
  const at=(a:number,b:number)=>heights[clamp(b,0,resolution)*(resolution+1)+clamp(a,0,resolution)];
  return (at(i,j)*(1-dx)+at(i+1,j)*dx)*(1-dy)+(at(i,j+1)*(1-dx)+at(i+1,j+1)*dx)*dy;
}
export function transformWorldHeights(draft:TerrainDraft,operation:TerrainTransform,options:{passes?:number;terraceStep?:number}={}):number[]{
  const n=draft.resolution,original=draft.heights;
  if(!Number.isInteger(n)||n<1||original.length!==(n+1)**2||original.some(h=>!Number.isFinite(h)))throw Error('Invalid terrain grid.');
  let next=[...original];
  const at=(data:number[],i:number,j:number)=>data[clamp(j,0,n)*(n+1)+clamp(i,0,n)];
  switch(operation){
    case 'smooth': {
      const passes=clamp(Math.round(options.passes??1),1,8);
      for(let p=0;p<passes;p++){
        const source=next;
        next=source.map((h,index)=>{
          const i=index%(n+1),j=Math.floor(index/(n+1));
          return round(clamp(h*0.5+(at(source,i-1,j)+at(source,i+1,j)+at(source,i,j-1)+at(source,i,j+1))*0.125,-512,512));
        });
      }
      break;
    }
    case 'terrace': {
      const step=options.terraceStep??32;
      if(!Number.isFinite(step)||step<1||step>256)throw Error('Terrace step must be 1–256 units.');
      next=original.map(h=>round(clamp(Math.round(h/step)*step,-512,512)));
      break;
    }
    case 'normalize': {
      const min=Math.min(...original),max=Math.max(...original);
      if(max-min<0.001)return next;
      const center=(min+max)/2,scale=Math.min(1,512/((max-min)/2));
      next=original.map(h=>round(clamp((h-center)*scale,-512,512)));
      break;
    }
    case 'mirrorX':next=original.map((_,k)=>at(original,n-k%(n+1),Math.floor(k/(n+1))));break;
    case 'mirrorY':next=original.map((_,k)=>at(original,k%(n+1),n-Math.floor(k/(n+1))));break;
    case 'rotate90':next=original.map((_,k)=>at(original,Math.floor(k/(n+1)),n-k%(n+1)));break;
    default:throw Error('Unknown terrain operation.');
  }
  return next;
}
export function worldTerrainStats(heights:number[]){
  const min=Math.min(...heights),max=Math.max(...heights);
  return {min:round(min),max:round(max),range:round(max-min)};
}

/** World Builder Studio: controlled ridges, riverbeds and escarpments. 
 * These change only a height grid; closed convex brush generation remains in terrain.ts.
 * Caves cannot be subtracted from a heightmap: use the path-based Cave Tunnel instead.
 */
export type WorldFeature='ridge'|'riverbed'|'cliff';
export function applyWorldFeature(draft:TerrainDraft,feature:WorldFeature,options:{height:number;width:number;seed:number;direction:'x'|'y'}):number[]{
  const {height,width,seed,direction}=options;
  const n=draft.resolution;
  if(!Number.isInteger(n)||n<1||n>64||draft.heights.length!==(n+1)**2||draft.heights.some(h=>!Number.isFinite(h)))throw Error('Invalid World Builder terrain grid.');
  if(!Number.isFinite(height)||height<8||height>256||!Number.isFinite(width)||width<16||width>2048||!Number.isFinite(seed)||!['x','y'].includes(direction)||!['ridge','riverbed','cliff'].includes(feature))
    throw Error('Invalid landform parameters.');
  const crossExtent=direction==='x'?draft.depth:draft.width;
  return draft.heights.map((h,k)=>{
    const u=k%(n+1)/n,v=Math.floor(k/(n+1))/n;
    const along=direction==='x'?u:v,across=direction==='x'?v:u;
    const bend=Math.sin(along*5.8+seed*.31)*0.09+Math.sin(along*11.2+seed*.73)*.025;
    const offset=(across-.5-bend)*crossExtent;
    const d=Math.abs(offset)/width;
    const rolloff=Math.exp(-d*d*2.7);
    const bump=feature==='cliff'?height*(1/(1+Math.exp(-offset/Math.max(6,width/5)))-.5)*2:(feature==='riverbed'?-height:height)*rolloff;
    return round(clamp(h+bump,-512,512));
  });
}
