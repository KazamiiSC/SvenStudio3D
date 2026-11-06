import type {Brush,MapObject,PointEntity} from './types';

/**
 * Detaching is an object ownership change, not a geometry operation.
 * A solid entity is represented by a PointEntity and brushes referencing its id;
 * brushes without entityId are exported inside worldspawn (Valve 220).
 */
export type BrushDetachPlan={
  brushIds:string[];
  removedEntities:PointEntity[];
  affectedEntityIds:string[];
};

/** Prepare a complete, atomic edit before touching the project.
 * Targets may be individual brush IDs, entity IDs or a mixed selection.
 * wholeEntity=true expands any chosen attached brush to all brushes using its entity.
 * Unlinked world brushes are ignored. Locked items are never silently edited.
 */
export function planBrushEntityDetach(objects:readonly MapObject[],targetIds:readonly string[],wholeEntity=false):BrushDetachPlan{
  const targetSet=new Set(targetIds);
  const entities=new Map(objects.filter((o):o is PointEntity=>o.kind==='entity').map(o=>[o.id,o]));
  const brushes=objects.filter((o):o is Brush=>o.kind==='brush');
  const touchedEntities=new Set<string>();
  for(const o of objects){
    if(!targetSet.has(o.id))continue;
    if(o.kind==='brush'&&o.entityId)touchedEntities.add(o.entityId);
    if(o.kind==='entity'&&brushes.some(b=>b.entityId===o.id))touchedEntities.add(o.id);
  }
  const chosen=new Set<string>();
  for(const brush of brushes){
    if(!brush.entityId)continue;
    if(targetSet.has(brush.id)||(touchedEntities.has(brush.entityId)&&(wholeEntity||targetSet.has(brush.entityId))))chosen.add(brush.id);
  }
  if(!chosen.size)return {brushIds:[],removedEntities:[],affectedEntityIds:[]};
  const affected=brushes.filter(b=>chosen.has(b.id));
  if(affected.some(b=>b.locked))throw new Error('Unlock the linked brushes before converting them to worldspawn.');
  const remaining=new Set(brushes.filter(b=>b.entityId&&!chosen.has(b.id)).map(b=>b.entityId!));
  const affectedEntityIds=[...new Set(affected.map(b=>b.entityId!))];
  const removedEntities=affectedEntityIds.filter(id=>!remaining.has(id)&&entities.has(id)).map(id=>entities.get(id)!);
  if(removedEntities.some(e=>e.locked))throw new Error('Unlock the brush entity before removing its final brush.');
  return {brushIds:affected.map(b=>b.id),removedEntities,affectedEntityIds};
}

/** Does not modify geometry, face UV, names, layers or grouping. */
export function detachBrushEntities(objects:readonly MapObject[],targetIds:readonly string[],wholeEntity=false):{
  objects:MapObject[];
  plan:BrushDetachPlan;
}{
  const plan=planBrushEntityDetach(objects,targetIds,wholeEntity);
  if(!plan.brushIds.length)return {objects:[...objects],plan};
  const detach=new Set(plan.brushIds),remove=new Set(plan.removedEntities.map(e=>e.id));
  return {plan,objects:objects.flatMap(o=>{
    if(remove.has(o.id))return [];
    return [o.kind==='brush'&&detach.has(o.id)?{...o,entityId:undefined}:o];
  })};
}
