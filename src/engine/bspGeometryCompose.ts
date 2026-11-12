/** Loss-aware, validated BSP composition through recovered Valve 220 MAPs.
 * Geometry comes from SurfDecomp's original plane definitions, not a second
 * lossy editor-brush export. A complete CSG/BSP/VIS/RAD build is required.
 */
import {inspectMapImport,type MapImportReport} from './importMap';
import {composeRecoveredMapSource} from './bspRecoveredMapSource';
import type {Vec3} from './types';

export interface GeometryComposeResult {
  source:string;
  report:{primary:MapImportReport;secondary:MapImportReport;combined:MapImportReport;brushes:number;entities:number;warnings:string[];partial:boolean;lostBrushes:number};
}
export class CombinedMapVerificationError extends Error {
  constructor(public readonly report:MapImportReport,public readonly expected:number){
    super('Combined MAP verification failed');
    this.name='CombinedMapVerificationError';
  }
}
const validVec=(offset:readonly number[]):offset is Vec3=>offset.length===3&&offset.every(v=>Number.isFinite(v)&&Math.abs(v)<=32768);
const safeName=(value:string)=>/^[A-Za-z0-9_]{0,32}$/.test(value);

/** Partially reconstructed brushes are only omitted after explicit user consent. */
export function composeRecoveredBspGeometry(primaryMap:string,secondaryMap:string,offset:readonly number[],prefix:string,name='composed_map',options:{allowPartial?:boolean}={}):GeometryComposeResult{
  if(!validVec(offset))throw Error('Enter three numeric coordinates within ±32768.');
  if(!safeName(prefix))throw Error('Prefix must be 0–32 ASCII letters, numbers or underscores.');
  const a=inspectMapImport(primaryMap,'primary.map');
  const b=inspectMapImport(secondaryMap,'secondary.map');
  for(const [label,report] of [['Primary',a.report],['Secondary',b.report]] as const){
    if(report.skippedBrushes&&!options.allowPartial)throw Error(`${label} BSP recovery omitted ${report.skippedBrushes} brushes; merging is blocked to avoid losing geometry.`);
    if(report.totalBrushes===0)throw Error(`${label} BSP recovery produced no brushes.`);
  }
  // The source MAP already contains the plane equations and Valve 220 texture
  // axes. Do not reconstruct them into polygon meshes and serialize again: the
  // rounding on large SurfDecomp maps can make once-valid solids unrecoverable.
  const source=composeRecoveredMapSource(primaryMap,secondaryMap,a,b,offset,prefix,!!options.allowPartial);
  const verified=inspectMapImport(source,`${name}.map`);
  const expected=a.report.importedBrushes+b.report.importedBrushes;
  if(verified.report.skippedBrushes||verified.report.totalBrushes!==expected)
    throw new CombinedMapVerificationError(verified.report,expected);
  const entityCount=a.project.objects.filter(o=>o.kind==='entity').length+b.project.objects.filter(o=>o.kind==='entity').length;
  const verifiedEntities=verified.project.objects.filter(o=>o.kind==='entity').length;
  if(verifiedEntities!==entityCount)throw Error('Merged MAP failed the entity count safety check. Nothing was exported.');
  const lostBrushes=a.report.skippedBrushes+b.report.skippedBrushes;
  const warnings=[
    ...(lostBrushes?[`PARTIAL RECOVERY: ${lostBrushes} source brushes could not be reconstructed and were omitted. Inspect the merged geometry before using it.`]:[]),
    'This is a reconstructed MAP, not a direct binary BSP merge. Recompile CSG/BSP/VIS/RAD before playing.',
    'Original baked lightmaps, PVS, clipnodes and exact brush topology are not preserved.',
    'Verify external WAD paths, models, sounds, scripts and map-specific events before publishing.',
    ...(offset.every(v=>v===0)?['The source map has zero offset. Geometry from both BSPs may overlap; inspect the placement before compilation.']:[]),
  ];
  const spawnClasses=new Set(['info_player_start','info_player_deathmatch','info_player_coop']);
  const spawnCount=[...a.project.objects,...b.project.objects].filter(o=>o.kind==='entity'&&spawnClasses.has(o.classname)).length;
  if(spawnCount>1)warnings.push('Multiple player spawns are present; inspect their placement and spawnflags.');
  return {source,report:{primary:a.report,secondary:b.report,combined:verified.report,brushes:verified.report.totalBrushes,entities:verifiedEntities,warnings,partial:lostBrushes>0,lostBrushes}};
}
