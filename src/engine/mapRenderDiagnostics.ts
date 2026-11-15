/** Read-only HF17 HF3 diagnostics. Never edits MAP, renderer state or project data. */
export type BrushChunkReadout={
  brushes:number;
  batchedBrushes:number;
  batchDrawMeshes:number;
  sourceTriangles:number;
  eligibleForChunk:boolean;
  batchingEnabled:boolean;
  nullFaces?:number;
  hiddenNullFaces?:number;
};
const activeChunks=new Map<symbol,BrushChunkReadout>();
export function updateBrushChunkReadout(key:symbol,value:BrushChunkReadout):void{activeChunks.set(key,value)}
export function clearBrushChunkReadout(key:symbol):void{activeChunks.delete(key)}
export function getBrushBatchSummary():{
  brushChunks:number;smallChunks:number;brushes:number;batchedBrushes:number;
  notBatchedBrushes:number;batchDrawMeshes:number;batchedTriangles:number;batchingEnabled:boolean;
  nullFaces:number;hiddenNullFaces:number;
}{
  let smallChunks=0,brushes=0,batchedBrushes=0,batchDrawMeshes=0,batchedTriangles=0,batchingEnabled=false;
  let nullFaces=0,hiddenNullFaces=0;
  for(const chunk of activeChunks.values()){
    brushes+=chunk.brushes;batchedBrushes+=chunk.batchedBrushes;
    batchDrawMeshes+=chunk.batchDrawMeshes;batchedTriangles+=chunk.sourceTriangles;
    nullFaces+=chunk.nullFaces??0;hiddenNullFaces+=chunk.hiddenNullFaces??0;
    if(!chunk.eligibleForChunk)smallChunks++;
    batchingEnabled ||= chunk.batchingEnabled;
  }
  return {brushChunks:activeChunks.size,smallChunks,brushes,batchedBrushes,
    notBatchedBrushes:Math.max(0,brushes-batchedBrushes),batchDrawMeshes,batchedTriangles,batchingEnabled,
    nullFaces,hiddenNullFaces};
}
export type MapRenderSample={
  timestamp:string;fps:number;frameMs:number;drawCalls:number;triangles:number;lines:number;
  geometries:number;gpuTextures:number;wadAssets:number;
  pixelWidth:number;pixelHeight:number;dpr:number;
  renderer:string;browser:string;brushes:number;entities:number;
  mode:string;batchReturn:ReturnType<typeof getBrushBatchSummary>;
};
export function formatMapRenderReport(s:MapRenderSample):string{
  const b=s.batchReturn;
  return [
    'SVENSTUDIO 3D v2.1 · HF17 HF5 · MAP RENDER DIAGNOSTIC',
    `Capture: ${s.timestamp}`,
    `Mode: ${s.mode}`,
    `FPS (wall clock): ${s.fps}`,
    `Average frame interval: ${s.frameMs.toFixed(2)} ms (NOT GPU execution time)`,
    `WebGL draw calls (complete previous frame, all passes): ${s.drawCalls}`,
    `WebGL triangles (previous frame): ${s.triangles}`,
    `WebGL lines (previous frame): ${s.lines}`,
    `WebGL geometries: ${s.geometries}`,
    `WebGL textures resident: ${s.gpuTextures}`,
    `Texture assets registered: ${s.wadAssets}`,
    `Canvas framebuffer: ${s.pixelWidth}x${s.pixelHeight} / device pixel ratio ${s.dpr.toFixed(2)}`,
    `MAP objects: ${s.brushes} brushes, ${s.entities} entities`,
    `Opaque batching enabled: ${b.batchingEnabled}`,
    `Brush chunks: ${b.brushChunks}, too small to batch: ${b.smallChunks}`,
    `Brushes in chunks: ${b.brushes}, batched: ${b.batchedBrushes}, not batched: ${b.notBatchedBrushes}`,
    `NULL tool faces in brush chunks: ${b.nullFaces} (skipped by hidden-NULL mode: ${b.hiddenNullFaces})`,
    ...(b.nullFaces>=300 ? [b.hiddenNullFaces>0
      ? 'NULL preview: hidden tool surfaces are omitted from rendering; measure FPS at the same camera to evaluate the gain.'
      : 'NULL preview: many NULL tool surfaces remain renderable. If this is a recovered BSP→MAP, enable Hide NULL faces to test FPS.'] : []),
    `Actual merged draw meshes: ${b.batchDrawMeshes}, merged triangles: ${b.batchedTriangles}`,
    `Renderer: ${s.renderer}`,
    `Browser: ${s.browser}`,
    '',
    'Important: WebGL counters include the complete previous frame (including helper passes), not GPU execution time.',
    'Compare two captures at the SAME camera position, with batching enabled and disabled.',
    'No map, BSP, WAD, texture or game file was modified by this diagnostic.',
  ].join('\n');
}
