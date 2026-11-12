/** Pure window calculation for large texture libraries (WAD3). */
export function textureGalleryWindow(count:number,columns:number,scroll:number,viewport:number){
  const cols=Math.max(1,Math.floor(columns)),rows=Math.ceil(count/cols),rowHeight=124;
  const first=Math.max(0,Math.floor(Math.max(0,scroll)/rowHeight)-3);
  const last=Math.min(rows,Math.ceil((scroll+Math.max(150,viewport))/rowHeight)+4);
  return {first,last,from:first*cols,to:Math.min(count,last*cols),top:first*rowHeight,bottom:Math.max(0,(rows-last)*rowHeight),rows};
}
