/** Editor-only heuristic for legacy WAD3 0x43 decals with an opaque,
 * near-white backdrop. WAD3 0x40 index-alpha decals do NOT use this heuristic.
 * Flood from image edges so white details enclosed by artwork are preserved. */
export function inferOpaqueDecalBackdrop(pixels:Uint8Array,width:number,height:number,palette:Uint8Array):Uint8Array|null{
  if(width<3||height<3||pixels.length!==width*height||palette.length<768)return null;
  const corners=[pixels[0],pixels[width-1],pixels[(height-1)*width],pixels[pixels.length-1]];
  const background=corners.find(color=>corners.filter(c=>c===color).length>=3);
  if(background===undefined)return null;
  const r=palette[background*3],g=palette[background*3+1],b=palette[background*3+2];
  if(Math.min(r,g,b)<195||Math.max(r,g,b)-Math.min(r,g,b)>46)return null;
  let border=0,matches=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(y===0||y===height-1||x===0||x===width-1){border++;if(pixels[y*width+x]===background)matches++;}
  }
  if(matches/border<.60)return null;
  const mask=new Uint8Array(pixels.length),stack:number[]=[];
  for(let x=0;x<width;x++){stack.push(x,(height-1)*width+x);}
  for(let y=0;y<height;y++){stack.push(y*width,y*width+width-1);}
  let area=0;
  while(stack.length){
    const i=stack.pop()!;if(mask[i]||pixels[i]!==background)continue;
    mask[i]=1;area++;
    const x=i%width,y=Math.floor(i/width);
    if(x>0)stack.push(i-1);if(x+1<width)stack.push(i+1);
    if(y>0)stack.push(i-width);if(y+1<height)stack.push(i+width);
  }
  return area/pixels.length>=.12?mask:null;
}
