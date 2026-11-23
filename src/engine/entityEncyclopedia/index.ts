import {LOGIC} from './logic';
import {BRUSHES} from './brushes';
import {WORLD} from './world';
import {ACTORS} from './actors';
import type {GuideCategory,GuideEntry} from './types';
export {GUIDE_CATEGORIES} from './types';
export type {GuideCategory,GuideEntry} from './types';

const ALL:Record<string,GuideEntry>={};
for(const part of [LOGIC,BRUSHES,WORLD,ACTORS])for(const [k,v] of Object.entries(part))ALL[k.toLowerCase()]=v;
// Classes whose canonical FGD spelling has upper-case letters.
const DISPLAY:Record<string,string>={ammo_9mmar:'ammo_9mmAR',ammo_argrenades:'ammo_ARgrenades',weapon_9mmar:'weapon_9mmAR'};

export const ENCYCLOPEDIA_CLASSES:string[]=Object.keys(ALL).map(k=>DISPLAY[k]??k).sort((a,b)=>a.localeCompare(b));
export function encyclopediaEntry(classname:string):GuideEntry|undefined{return ALL[classname.toLowerCase()];}

/** Search by class name, summary, ideas and tips (accent-insensitive). */
const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export function searchEncyclopedia(query:string,category?:GuideCategory|''):string[]{
  const q=fold(query.trim());
  return ENCYCLOPEDIA_CLASSES.filter(name=>{
    const e=ALL[name.toLowerCase()];
    if(category&&e.cat!==category)return false;
    if(!q)return true;
    const hay=fold([name,e.s,e.en,...(e.ideas??[]),...(e.tips??[]),...(e.ex??[]).flat()].join(' '));
    return q.split(/\s+/).every(w=>hay.includes(w));
  });
}
/** Classes that mention this one as related, so the guide can show "used together with". */
export function relatedTo(classname:string):string[]{
  const c=classname.toLowerCase();
  return ENCYCLOPEDIA_CLASSES.filter(n=>n.toLowerCase()!==c&&(ALL[n.toLowerCase()].rel??[]).some(r=>r.toLowerCase()===c)).slice(0,12);
}

/** Basics every mapper needs before reading individual entities. */
export const GUIDE_BASICS:{title:string;en:string;body:string[]}[]=[
  {title:'target y targetname: cómo se conectan las entidades',en:'target and targetname',body:[
    'Cada entidad puede tener un nombre (targetname). Otra entidad la activa poniendo ese nombre en su target.',
    'Ejemplo: func_button.target = puerta_1 → func_door.targetname = puerta_1. Al usar el botón, la puerta se abre.',
    'Varias entidades pueden compartir el mismo targetname: todas se activan juntas (por ejemplo todas las luces de una sala).',
    'Los nombres distinguen mayúsculas y no deberían tener espacios. Usá prefijos por zona: lab_puerta, lab_luz, lab_alarma.']},
  {title:'Activar, prender, apagar y alternar',en:'Use types: on, off, toggle',body:[
    'Activar una entidad normalmente la "alterna": una luz encendida se apaga, una puerta cerrada se abre.',
    'trigger_relay con triggerstate (Off / On / Toggle) fuerza el estado, útil para apagar todo de una vez sin prender lo que ya estaba apagado.',
    'killtarget elimina la entidad nombrada del mapa (no se puede deshacer en esa partida).']},
  {title:'master: bloquear hasta que se cumpla algo',en:'Masters',body:[
    'Muchas entidades (botones, puertas, triggers) tienen el campo master. Si apunta a un multisource, la entidad no funciona hasta que el multisource esté encendido.',
    'Así se hacen puertas que requieren energía, palancas en orden o botones que se habilitan tras un evento.']},
  {title:'delay, multi_manager y secuencias',en:'Delays and sequences',body:[
    'La mayoría de los activadores tiene delay: espera esos segundos antes de disparar su target.',
    'Para secuencias con varios pasos usá multi_manager (cada destino con su propio tiempo).',
    'El Simulador de lógica del Estudio de Gameplay reproduce la cadena paso a paso antes de compilar.']},
  {title:'spawnflags',en:'Spawnflags',body:[
    'Son casillas de opciones propias de cada entidad (Start On, Toggle, Not solid…). En el Inspector aparecen como checkboxes con su nombre del FGD.',
    'Si una entidad no se comporta como esperás, revisá primero los spawnflags.']},
  {title:'Brushes vs. entidades puntuales',en:'Brush vs point entities',body:[
    'Las entidades de brush (func_*, trigger_*) son geometría: seleccioná brushes y convertilos con "Vincular a entidad".',
    'Las puntuales (light, info_*, monster_*, ambient_*) son un punto en el mapa: se colocan con clic desde el explorador de entidades.',
    'Los brushes que giran (func_door_rotating, func_rotating, func_train) necesitan un brush con textura ORIGIN en su eje o centro.']},
  {title:'Probar sin compilar y antes de publicar',en:'Testing',body:[
    'Médico del mapa → Recorrido del jugador detecta ítems inalcanzables o detrás de puertas.',
    'El panel de Lógica avisa de targets que no existen.',
    'Compilá en modo Rápido mientras armás la lógica y en Final antes de compartir.']},
];
