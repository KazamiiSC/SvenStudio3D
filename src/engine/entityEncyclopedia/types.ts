/** v2.6 Entity Guide (Help → Entity guide). Written from the Sven Co-op FGD, the official
 * Sven Co-op entity documentation and the TWHL / Half-Life mapping tutorials.
 * Spanish is the full text; `en` is a one-line English summary for the other UI languages.
 * Keyvalue names are always native (never translated). */
export type GuideCategory='logic'|'trigger'|'brush'|'movement'|'effects'|'audio'|'lighting'|'info'|'path'|'game'|'player'|'item'|'weapon'|'ammo'|'npc'|'ally'|'corpse'|'xen'|'compile'|'script';
export type GuideEntry={
  cat:GuideCategory;
  /** What it is, in one or two sentences (Spanish). */
  s:string;
  /** One-line English summary. */
  en:string;
  /** How it works / how to set it up, step by step. */
  how?:string[];
  /** Ideas: what you can build with it. */
  ideas?:string[];
  /** Worked examples: [title, wiring recipe]. */
  ex?:[string,string][];
  /** Pitfalls and tips. */
  tips?:string[];
  /** Most important keyvalues: [key, explanation]. */
  keys?:[string,string][];
  /** Related classes. */
  rel?:string[];
};
export const GUIDE_CATEGORIES:{id:GuideCategory;es:string;en:string}[]=[
  {id:'logic',es:'Lógica y relés',en:'Logic & relays'},
  {id:'trigger',es:'Triggers (volúmenes)',en:'Trigger volumes'},
  {id:'movement',es:'Brushes que se mueven',en:'Moving brushes'},
  {id:'brush',es:'Brushes especiales',en:'Special brushes'},
  {id:'effects',es:'Efectos visuales',en:'Visual effects'},
  {id:'audio',es:'Sonido y música',en:'Sound & music'},
  {id:'lighting',es:'Iluminación',en:'Lighting'},
  {id:'game',es:'Reglas de juego y texto',en:'Game rules & text'},
  {id:'player',es:'Jugadores y spawns',en:'Players & spawns'},
  {id:'info',es:'Puntos de referencia',en:'Reference points'},
  {id:'path',es:'Rutas y nodos',en:'Paths & nodes'},
  {id:'item',es:'Ítems',en:'Items'},
  {id:'weapon',es:'Armas',en:'Weapons'},
  {id:'ammo',es:'Munición',en:'Ammo'},
  {id:'npc',es:'NPC enemigos',en:'Enemy NPCs'},
  {id:'ally',es:'NPC aliados',en:'Allied NPCs'},
  {id:'corpse',es:'Cadáveres y decorado',en:'Corpses & props'},
  {id:'xen',es:'Flora de Xen',en:'Xen flora'},
  {id:'compile',es:'Compilación y texturas',en:'Compile & textures'},
  {id:'script',es:'Scripts y datos',en:'Scripts & data'},
];
