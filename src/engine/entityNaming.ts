import type {MapObject,PointEntity} from './types';

/** Human-readable name used only in SvenStudio. A linked brush may carry
 * a unique alias even if its owning entity has the default classname name. */
export function entityDisplayName(entity:PointEntity,objects:readonly MapObject[]):string{
  const direct=(entity.editorAlias||entity.name).trim();
  if(direct&&direct.toLowerCase()!==entity.classname.toLowerCase())return direct;
  const brushes=objects.filter(o=>o.kind==='brush'&&o.entityId===entity.id);
  const named=brushes.find(o=>o.editorAlias?.trim()||o.name.trim()&&!/^(drawn block|box|brush|wall|door|button|new brush|block)(?:\s+\d+)?$/i.test(o.name.trim()));
  return (named?.editorAlias||named?.name)?.trim()||entity.props.targetname?.trim()||direct||entity.classname;
}
export function connectionSearchText(entity:PointEntity,objects:readonly MapObject[]):string{
  const brushes=objects.filter(o=>o.kind==='brush'&&o.entityId===entity.id);
  return [entity.editorAlias,entity.name,entity.classname,entity.props.targetname,...brushes.flatMap(b=>[b.editorAlias,b.name])].filter(Boolean).join(' ').toLocaleLowerCase();
}
export function entityConnectionLabel(entity:PointEntity,objects:readonly MapObject[]):string{
  const name=entityDisplayName(entity,objects);
  const classSuffix=name.toLowerCase()===entity.classname.toLowerCase()?'':` · ${entity.classname}`;
  return `${name}${classSuffix}${entity.props.targetname?` (#${entity.props.targetname})`:' (auto targetname)'}`;
}
