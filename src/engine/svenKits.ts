/** v2.6 Sven kits: complete GoldSrc/Svengine setups taken from classic TWHL tutorials
 * (doors, keys, checkpoints, elevators, effects, weather…). Every kit returns plain brushes and
 * entities with keyvalues from sven-coop.fgd; nothing here touches the store.
 * Local frame: origin = floor point under the cursor, X = across, Y = depth (front is -Y), Z = up.
 * `yaw` (0/90/180/270) turns the whole kit around the origin. */
import {createBrush,transformedVertices} from './geometry';
import {uid,type Brush,type MapObject,type PointEntity,type Vec3} from './types';

export type KitStudio='architecture'|'gameplay'|'smart'|'npc'|'effects'|'weather'|'sound'|'prefab'|'cinematic'|'mission'|'puzzle'|'world';
export type KitFieldType='number'|'select'|'bool'|'text';
export type KitField={key:string;label:string;type:KitFieldType;min?:number;max?:number;step?:number;options?:[string,string][];when?:(o:KitOptions)=>boolean};
export type KitOptions=Record<string,number|string|boolean>;
export type KitId='door'|'keyDoor'|'npcDoor'|'checkpoint'|'randomEvent'|'loop'|'elevator'|'fan'|'gear'|'rotatingLight'|'pendulum'|'retinaScanner'
  |'steam'|'sparks'|'drips'|'flame'|'landmine'|'explosion'|'bubbles'|'laser'|'rain'|'snow'|'waterfall'|'healingPool'|'waterPool'|'soundscape'
  |'vending'|'breakable'|'monitor'|'turret'|'mortarField'|'teleporter'|'securityCamera'|'changelevel'|'storm'|'dayNight'|'orderedLevers'|'pressurePlates'|'timedDoor'
  |'building'|'roof'|'columnGrid'|'corridor'|'vents'|'fireEscape'|'freightLift'|'cave'|'cliff'|'river'|'vegetation'|'rubble'|'terrainRoad'
  |'furniture'|'labRoom'|'pipes'|'trims'|'fence'|'signage'|'combatArena'|'sniperNest'|'trap'|'hoverPlatform'|'lightRow'|'windowLight'|'fireZone';
export type KitDefinition={id:KitId;studio:KitStudio;title:string;description:string;tutorial:string;fields:KitField[];defaults:KitOptions};

const num=(o:KitOptions,k:string,d=0)=>{const v=Number(o[k]);return Number.isFinite(v)?v:d;};
const str=(o:KitOptions,k:string,d='')=>typeof o[k]==='string'&&o[k]!==''?String(o[k]):d;
const flag=(o:KitOptions,k:string)=>o[k]===true||o[k]==='true';
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const shapeField:KitField={key:'shape',label:'Shape',type:'select',options:[['straight','Straight'],['L','L'],['U','U'],['S','S'],['zigzag','Zigzag']]};
const yawField:KitField={key:'yaw',label:'Facing (°)',type:'select',options:[['0','0°'],['90','90°'],['180','180°'],['270','270°']]};

const doorFields:KitField[]=[
  {key:'width',label:'Width',type:'number',min:32,max:512,step:8},{key:'height',label:'Height',type:'number',min:64,max:512,step:8},
  {key:'thickness',label:'Thickness',type:'number',min:4,max:32},
  {key:'style',label:'Movement',type:'select',options:[['sliding','Sliding'],['rotating','Swinging (hinge)']]},
  {key:'open',label:'How it opens',type:'select',options:[['proximity','Proximity (walk up)'],['use','Press USE on the door'],['button','Button on both sides'],['handle','Turning handle'],['key','Needs a key item'],['locked','Locked forever'],['npcOnly','Only NPCs can open it']]},
  {key:'double',label:'Double door',type:'bool'},{key:'glass',label:'Glass window in the leaf',type:'bool'},{key:'frame',label:'Add frame',type:'bool'},
  {key:'speed',label:'Speed',type:'number',min:10,max:1000},{key:'wait',label:'Close after (s, -1 = stays open)',type:'number',min:-1,max:60},
  {key:'movesnd',label:'Sound',type:'select',options:[['0','None'],['1','Servo (sliding)'],['2','Pneumatic'],['5','Power hydraulic'],['8','Snappy metal'],['9','Squeaky']]},
  {key:'keyName',label:'Key item name',type:'text',when:o=>o.open==='key'},{key:'keyLabel',label:'Key name on the HUD',type:'text',when:o=>o.open==='key'},
  {key:'consumeKey',label:'The key is used up',type:'bool',when:o=>o.open==='key'},
  {key:'keyDistance',label:'Key distance in front',type:'number',min:32,max:4096,step:16,when:o=>o.open==='key'},yawField];
const doorDefaults:KitOptions={width:64,height:112,thickness:8,style:'sliding',open:'proximity',double:false,glass:false,frame:true,speed:100,wait:3,movesnd:'1',keyName:'key_red',keyLabel:'Red key',consumeKey:false,keyDistance:192,yaw:'0'};

export const KIT_DEFINITIONS:KitDefinition[]=[
  {id:'door',studio:'architecture',title:'Advanced door',description:'Sliding or swinging door with frame, glass, double leaves and the trigger already wired (proximity, USE, buttons, handle, key, locked or NPC only).',tutorial:'Doors · Adding Glass to Doors · Proximity Doors · Permanently locked doors',fields:doorFields,defaults:doorDefaults},
  {id:'keyDoor',studio:'gameplay',title:'Key + locked door',description:'item_inventory key and a door with Svengine inventory rules. Without the key a HUD message tells players what they need.',tutorial:'Keys · Security Cards · Creating a Locked Door',fields:doorFields,defaults:{...doorDefaults,open:'key',style:'sliding',movesnd:'2'}},
  {id:'npcDoor',studio:'npc',title:'NPC-only door',description:'Door that opens for monsters but never for players (m_iOpenFlags = no clients).',tutorial:'Retina Scanners and Other NPC-Only Locked Doors',fields:doorFields,defaults:{...doorDefaults,open:'npcOnly'}},
  {id:'checkpoint',studio:'gameplay',title:'Checkpoint',description:'Players who reach the zone move the respawn point forward. Uses only standard entities (new info_player_deathmatch spawns), or the point_checkpoint script.',tutorial:'Checkpoint system for spawnpoints',fields:[
    {key:'mode',label:'Type',type:'select',options:[['spawns','Move spawn points (no script)'],['script','point_checkpoint (needs map script)']]},
    {key:'spawns',label:'New spawn points',type:'number',min:1,max:16,when:o=>o.mode!=='script'},{key:'previous',label:'Previous spawn group (targetname, optional)',type:'text',when:o=>o.mode!=='script'},
    {key:'zone',label:'Zone size',type:'number',min:32,max:2048,step:16},{key:'message',label:'HUD message',type:'text'},yawField],defaults:{mode:'spawns',spawns:4,previous:'',zone:192,message:'Checkpoint reached!',yaw:'0'}},
  {id:'randomEvent',studio:'gameplay',title:'Random event',description:'trigger_random picks one of several outputs each time it fires (or by itself every few seconds). Each output is a relay you can connect in Logic.',tutorial:'Random entity triggering · Random Event Generator · Simulating Randomness',fields:[
    {key:'count',label:'Outputs',type:'number',min:2,max:16},{key:'timed',label:'Fire by itself (timed)',type:'bool'},
    {key:'minDelay',label:'Min. delay (s)',type:'number',min:.1,max:600,step:.5,when:o=>flag(o,'timed')},{key:'maxDelay',label:'Max. delay (s)',type:'number',min:.1,max:600,step:.5,when:o=>flag(o,'timed')},
    {key:'unique',label:'Never repeat the same output',type:'bool',when:o=>!flag(o,'timed')},{key:'button',label:'Add a button that fires it',type:'bool'},{key:'demo',label:'Demo HUD text per output',type:'bool'}],
    defaults:{count:3,timed:false,minDelay:3,maxDelay:7,unique:false,button:true,demo:true}},
  {id:'loop',studio:'gameplay',title:'Controllable loop',description:'Repeats an action every N seconds and can be switched on/off with a button (timed trigger_random, no multi_manager tricks).',tutorial:'Multi_manager Looping Made Easy · Controllable Looping',fields:[
    {key:'interval',label:'Every (s)',type:'number',min:.1,max:600,step:.1},{key:'startOn',label:'Starts on',type:'bool'},{key:'button',label:'On/off button',type:'bool'},
    {key:'payload',label:'Action',type:'select',options:[['spark','Sparks'],['sound','Sound'],['relay','Empty relay (connect it)']]}],defaults:{interval:2,startOn:true,button:true,payload:'spark'}},
  {id:'elevator',studio:'smart',title:'Elevator',description:'func_train platform with path_corner stops, a call button per floor and optional sliding doors that open on arrival.',tutorial:'Elevators using func_train · Elevator No. 2 · Elevator Doors that move',fields:[
    {key:'floors',label:'Floors',type:'number',min:2,max:8},{key:'floorHeight',label:'Floor height',type:'number',min:64,max:1024,step:8},
    {key:'width',label:'Platform width',type:'number',min:64,max:512,step:8},{key:'depth',label:'Platform depth',type:'number',min:64,max:512,step:8},
    {key:'speed',label:'Speed',type:'number',min:16,max:600},{key:'doors',label:'Doors on every floor',type:'bool'},yawField],defaults:{floors:2,floorHeight:192,width:128,depth:128,speed:120,doors:true,yaw:'0'}},
  {id:'fan',studio:'smart',title:'Fan',description:'func_rotating blades with origin brush, optional wind (trigger_push), pain and an on/off switch.',tutorial:'Fans · Rotating Objects',fields:[
    {key:'orientation',label:'Mount',type:'select',options:[['ceiling','Ceiling / floor'],['wall','Wall']]},{key:'radius',label:'Radius',type:'number',min:16,max:512,step:8},
    {key:'speed',label:'Speed',type:'number',min:10,max:2000},{key:'push',label:'Wind push',type:'bool'},{key:'pain',label:'Hurts when touched',type:'bool'},{key:'button',label:'On/off switch',type:'bool'},yawField],
    defaults:{orientation:'wall',radius:64,speed:300,push:true,pain:false,button:true,yaw:'0'}},
  {id:'gear',studio:'smart',title:'Gear',description:'Toothed wheel (func_rotating) built from convex brushes around an origin brush.',tutorial:'Making Rotating Gears',fields:[
    {key:'radius',label:'Radius',type:'number',min:16,max:512,step:8},{key:'teeth',label:'Teeth',type:'number',min:4,max:24},{key:'thickness',label:'Thickness',type:'number',min:4,max:128},
    {key:'speed',label:'Speed',type:'number',min:1,max:500},{key:'reverse',label:'Reverse direction',type:'bool'}],defaults:{radius:64,teeth:10,thickness:16,speed:30,reverse:false}},
  {id:'rotatingLight',studio:'smart',title:'Rotating alarm light',description:'Spinning beacon: solid housing plus additive beams that rotate together, a glow sprite and an optional alarm sound, all switched by one name.',tutorial:'Rotating Lights · Rotating Billboards',fields:[
    {key:'color',label:'Color (R G B)',type:'text'},{key:'speed',label:'Speed',type:'number',min:10,max:1000},{key:'startOn',label:'Starts on',type:'bool'},{key:'sound',label:'Alarm sound',type:'bool'}],defaults:{color:'255 60 20',speed:200,startOn:true,sound:false}},
  {id:'pendulum',studio:'smart',title:'Pendulum',description:'func_pendulum arm and weight hung from an origin-brush pivot; can hurt players.',tutorial:'Security Cameras (func_pendulum) · Rotating Objects',fields:[
    {key:'length',label:'Length',type:'number',min:32,max:1024,step:8},{key:'distance',label:'Swing (°)',type:'number',min:5,max:170},{key:'speed',label:'Speed',type:'number',min:5,max:500},
    {key:'damage',label:'Damage',type:'number',min:0,max:500},yawField],defaults:{length:192,distance:60,speed:60,damage:0,yaw:'0'}},
  {id:'retinaScanner',studio:'npc',title:'Retina scanner',description:'Players walk up, the scientist or guard walks to the scanner, plays the retina animation and the door opens. Players cannot open that door themselves.',tutorial:'Creating a Retinal Scanner · Retina Scanners and Other NPC-Only Locked Doors',fields:[
    {key:'npc',label:'NPC',type:'select',options:[['monster_scientist','Scientist'],['monster_barney','Security guard']]},{key:'width',label:'Door width',type:'number',min:48,max:256,step:8},
    {key:'height',label:'Door height',type:'number',min:72,max:256,step:8},{key:'npcDistance',label:'NPC start distance',type:'number',min:48,max:2048,step:16},yawField],defaults:{npc:'monster_scientist',width:64,height:112,npcDistance:160,yaw:'0'}},
  {id:'steam',studio:'effects',title:'Steam jet',description:'Stacked steam sprites (additive) with a hiss and an optional burn zone.',tutorial:'Realistic Steam · Using Sprites',fields:[{key:'height',label:'Height',type:'number',min:16,max:512,step:8},{key:'hurt',label:'Burns players',type:'bool'},{key:'sound',label:'Sound',type:'bool'}],defaults:{height:96,hurt:false,sound:true}},
  {id:'sparks',studio:'effects',title:'Sparks',description:'env_spark that sparks randomly (always on, or toggled by name).',tutorial:'Detailing Maps',fields:[{key:'maxDelay',label:'Max. delay (s)',type:'number',min:.1,max:30,step:.1},{key:'startOn',label:'Starts on',type:'bool'}],defaults:{maxDelay:2,startOn:true}},
  {id:'drips',studio:'effects',title:'Dripping water',description:'Drops falling from the ceiling (env_shooter with sprites/wdrip2.spr) refired by a timer.',tutorial:'Cool-Looking Dripping Water · Rope, Waterfalls and Dripping Water',fields:[{key:'height',label:'Drop height',type:'number',min:16,max:1024,step:8},{key:'interval',label:'Every (s)',type:'number',min:.2,max:30,step:.1}],defaults:{height:128,interval:1.2}},
  {id:'flame',studio:'effects',title:'Flame',description:'Fire sprite, warm light, crackle sound and optional burn damage.',tutorial:'Flame Effect',fields:[{key:'scale',label:'Size',type:'number',min:.2,max:8,step:.1},{key:'hurt',label:'Burns players',type:'bool'},{key:'sound',label:'Sound',type:'bool'},{key:'light',label:'Light',type:'bool'}],defaults:{scale:1,hurt:true,sound:true,light:true}},
  {id:'landmine',studio:'effects',title:'Land mine',description:'Small mine; stepping on it fires an explosion and a screen shake.',tutorial:'Land Mine Effect',fields:[{key:'magnitude',label:'Explosion magnitude',type:'number',min:10,max:500}],defaults:{magnitude:120}},
  {id:'explosion',studio:'effects',title:'Explosion',description:'env_explosion + env_shake + sparks fired together by one name (or a button).',tutorial:'Basics of entity interactivity · More Complex Triggers',fields:[{key:'magnitude',label:'Explosion magnitude',type:'number',min:10,max:500},{key:'repeatable',label:'Repeatable',type:'bool'},{key:'button',label:'Add a button',type:'bool'}],defaults:{magnitude:150,repeatable:false,button:true}},
  {id:'bubbles',studio:'effects',title:'Bubbles',description:'env_bubbles volume for tanks and underwater areas.',tutorial:'Beam and Sprite Effects',fields:[{key:'width',label:'Width',type:'number',min:16,max:2048,step:8},{key:'depth',label:'Depth',type:'number',min:16,max:2048,step:8},{key:'height',label:'Height',type:'number',min:16,max:2048,step:8},{key:'density',label:'Density',type:'number',min:1,max:20}],defaults:{width:64,depth:64,height:128,density:2}},
  {id:'laser',studio:'effects',title:'Laser beam',description:'env_laser aimed at an info_target; can hurt and be switched by name.',tutorial:'Laser and Beam Effects',fields:[{key:'length',label:'Length',type:'number',min:16,max:4096,step:8},{key:'color',label:'Color (R G B)',type:'text'},{key:'damage',label:'Damage / s',type:'number',min:0,max:1000},{key:'startOn',label:'Starts on',type:'bool'},yawField],defaults:{length:256,color:'255 0 0',damage:0,startOn:true,yaw:'0'}},
  {id:'rain',studio:'weather',title:'Rain',description:'Grid of env_shooter emitters throwing sprites/rain.spr downwards, refired by a timer. Svengine has no env_weather.',tutorial:'Rain · Half-Life Rain',fields:[{key:'width',label:'Area width',type:'number',min:64,max:4096,step:64},{key:'depth',label:'Area depth',type:'number',min:64,max:4096,step:64},{key:'height',label:'Emitter height',type:'number',min:64,max:2048,step:16},{key:'density',label:'Drops per emitter',type:'number',min:1,max:20},{key:'sound',label:'Rain sound',type:'bool'}],defaults:{width:512,depth:512,height:384,density:6,sound:true}},
  {id:'snow',studio:'weather',title:'Snow',description:'Same as rain with sprites/snow.spr, slow flakes and wide variance.',tutorial:'Adding weather effects - Snow, rain',fields:[{key:'width',label:'Area width',type:'number',min:64,max:4096,step:64},{key:'depth',label:'Area depth',type:'number',min:64,max:4096,step:64},{key:'height',label:'Emitter height',type:'number',min:64,max:2048,step:16},{key:'density',label:'Flakes per emitter',type:'number',min:1,max:20}],defaults:{width:512,depth:512,height:384,density:4}},
  {id:'waterfall',studio:'weather',title:'Waterfall',description:'Falling sheet (func_conveyor scrolling down, translucent), splash pool (func_water), mist sprite and sound.',tutorial:'Rope, Waterfalls and Dripping Water · The Complete Guide to Water',fields:[{key:'width',label:'Width',type:'number',min:16,max:1024,step:8},{key:'height',label:'Height',type:'number',min:32,max:2048,step:8},{key:'texture',label:'Water texture',type:'text'},{key:'sound',label:'Sound',type:'bool'},yawField],defaults:{width:96,height:256,texture:'!waterblue',sound:true,yaw:'0'}},
  {id:'healingPool',studio:'weather',title:'Healing pool',description:'func_water pool with a trigger_hurt of negative damage that heals players inside (Xen style), plus a hum.',tutorial:'Creating healing pools like in Xen',fields:[{key:'width',label:'Width',type:'number',min:32,max:2048,step:8},{key:'depth',label:'Depth',type:'number',min:32,max:2048,step:8},{key:'height',label:'Water depth',type:'number',min:8,max:512,step:8},{key:'heal',label:'Heal per second',type:'number',min:1,max:100},{key:'texture',label:'Water texture',type:'text'}],defaults:{width:128,depth:128,height:32,heal:5,texture:'!waterblue'}},
  {id:'waterPool',studio:'weather',title:'Water volume',description:'Translucent func_water with wave height and an env_sound for underwater echo.',tutorial:'The Complete Guide to Water · Water',fields:[{key:'width',label:'Width',type:'number',min:32,max:4096,step:8},{key:'depth',label:'Depth',type:'number',min:32,max:4096,step:8},{key:'height',label:'Water depth',type:'number',min:8,max:2048,step:8},{key:'renderamt',label:'Opacity (0-255)',type:'number',min:20,max:255},{key:'texture',label:'Water texture',type:'text'},{key:'contents',label:'Liquid',type:'select',options:[['-3','Water'],['-4','Slime'],['-5','Lava']]}],defaults:{width:256,depth:256,height:96,renderamt:120,texture:'!waterblue',contents:'-3'}},
  {id:'soundscape',studio:'sound',title:'Soundscape',description:'Ambience for a zone: a looping base sound, random one-shots fired by a timer and an env_sound room preset.',tutorial:'Soundscapes · ambient_generic · Basics Of Sound Design',fields:[
    {key:'preset',label:'Preset',type:'select',options:[['cave','Cave'],['industrial','Industrial'],['outdoor','Outdoor wind'],['office','Office / lab'],['alien','Xen / alien']]},{key:'radius',label:'Zone radius',type:'number',min:64,max:4096,step:32},
    {key:'oneShots',label:'Random sounds',type:'number',min:0,max:6}],defaults:{preset:'cave',radius:512,oneShots:3}},
  {id:'vending',studio:'prefab',title:'Vending machine',description:'Machine body, a USE button and an env_beverage that drops cans (each heals). Breakable glass front optional.',tutorial:'Vending Machine · How To Make A Pop Machine',fields:[
    {key:'drink',label:'Drink',type:'select',options:[['6','Random'],['0','Cola'],['1','Lemon-lime'],['3','Orange'],['5','Moxie']]},{key:'capacity',label:'Cans',type:'number',min:1,max:100},
    {key:'heal',label:'Health per can',type:'number',min:0,max:100},{key:'glass',label:'Breakable glass front',type:'bool'},yawField],defaults:{drink:'6',capacity:10,heal:1,glass:true,yaw:'0'}},
  {id:'breakable',studio:'prefab',title:'Breakable object',description:'func_breakable glass pane, crate, metal panel or computer with material gibs, HUD info and an item spawned on break.',tutorial:'Glass · New Glass · Gib Item List · Glass and Transparency',fields:[
    {key:'kind',label:'Object',type:'select',options:[['glass','Glass pane'],['crate','Wooden crate'],['metal','Metal panel'],['computer','Computer']]},
    {key:'width',label:'Width',type:'number',min:8,max:1024,step:8},{key:'depth',label:'Depth',type:'number',min:2,max:1024,step:2},{key:'height',label:'Height',type:'number',min:8,max:1024,step:8},
    {key:'health',label:'Strength',type:'number',min:1,max:5000},{key:'spawn',label:'Spawn on break',type:'select',options:[['0','Nothing'],['1','Battery'],['2','Healthkit'],['4','9mm Clip'],['9','Shotgun Shells'],['17','Hand grenade']]},yawField],
    defaults:{kind:'crate',width:48,depth:48,height:48,health:30,spawn:'0',yaw:'0'}},
  {id:'monitor',studio:'prefab',title:'Breakable monitor',description:'Computer screen with a glowing sprite that switches off (killtarget) when the monitor is broken.',tutorial:'Unpluggable TV · Using Sprites',fields:[
    {key:'width',label:'Width',type:'number',min:16,max:256,step:4},{key:'color',label:'Color (R G B)',type:'text'},yawField],defaults:{width:40,color:'80 180 255',yaw:'0'}},
  {id:'turret',studio:'gameplay',title:'Turret / mounted gun',description:'func_tank family (gun, laser, rocket or mortar) with base, barrel and origin pivot. Automatic, or controllable by players through func_tankcontrols.',tutorial:'Grunts and Guns · Tankrockets · Controlling Turrets Through Cameras',fields:[
    {key:'weapon',label:'Weapon',type:'select',options:[['gun','Machine gun'],['laser','Laser'],['rocket','Rockets'],['mortar','Mortar']]},
    {key:'mode',label:'Who fires',type:'select',options:[['player','Players (use the controls)'],['auto','Automatic (shoots enemies)']]},
    {key:'yawRange',label:'Yaw range (°)',type:'number',min:5,max:180},{key:'pitchRange',label:'Pitch range (°)',type:'number',min:0,max:90},{key:'damage',label:'Damage',type:'number',min:1,max:500},yawField],
    defaults:{weapon:'gun',mode:'player',yawRange:60,pitchRange:25,damage:12,yaw:'0'}},
  {id:'mortarField',studio:'gameplay',title:'Mortar strike',description:'func_mortar_field brush placed in the sky; a button (or any trigger) drops shells randomly on the area below.',tutorial:'Mortar Madness · Creating a Usable And Destructible Mortar',fields:[
    {key:'width',label:'Area width',type:'number',min:64,max:4096,step:64},{key:'depth',label:'Area depth',type:'number',min:64,max:4096,step:64},{key:'height',label:'Sky height',type:'number',min:64,max:4096,step:32},
    {key:'spread',label:'Spread radius',type:'number',min:16,max:2048},{key:'count',label:'Shells per strike',type:'number',min:1,max:20},{key:'button',label:'Add a button',type:'bool'}],defaults:{width:512,depth:512,height:512,spread:192,count:3,button:true}},
  {id:'teleporter',studio:'gameplay',title:'Teleporter',description:'Glowing pad (trigger_teleport) and its info_teleport_destination with hum and sprites; optional return pad.',tutorial:'Teleporters · Basic Teleporter with Effects',fields:[
    {key:'distance',label:'Destination distance',type:'number',min:96,max:16384,step:32},{key:'size',label:'Pad size',type:'number',min:32,max:256,step:8},
    {key:'twoWay',label:'Return pad at the destination',type:'bool'},{key:'color',label:'Color (R G B)',type:'text'},yawField],defaults:{distance:512,size:64,twoWay:true,color:'90 200 255',yaw:'0'}},
  {id:'securityCamera',studio:'cinematic',title:'Security cameras',description:'Console with one button per camera; each button shows a trigger_camera view aimed at an info_target, freezing the player for the hold time.',tutorial:'Security Cameras · trigger_camera',fields:[
    {key:'cameras',label:'Cameras',type:'number',min:1,max:6},{key:'hold',label:'Hold time (s)',type:'number',min:1,max:120},{key:'spacing',label:'Distance between cameras',type:'number',min:64,max:4096,step:32},{key:'height',label:'Camera height',type:'number',min:32,max:1024,step:8},yawField],
    defaults:{cameras:2,hold:8,spacing:384,height:128,yaw:'0'}},
  {id:'changelevel',studio:'mission',title:'Next map (series)',description:'Sven-style level change: trigger_changelevel with keep_inventory and a share of players required. Svengine has no info_landmark; players start at the next map spawns.',tutorial:'Changing Levels · In Depth: Level Transitions · Globals',fields:[
    {key:'map',label:'Next map name (without .bsp)',type:'text'},{key:'mode',label:'How it starts',type:'select',options:[['touch','Walk into the zone'],['button','Button with countdown'],['end','End the game (last map)']]},
    {key:'percent',label:'Players needed inside (%)',type:'number',min:0,max:100,when:o=>o.mode==='touch'},{key:'countdown',label:'Countdown (s)',type:'number',min:0,max:60,when:o=>o.mode!=='touch'},
    {key:'keepInventory',label:'Players keep their weapons',type:'bool',when:o=>o.mode!=='end'},{key:'width',label:'Zone width',type:'number',min:32,max:2048,step:16},{key:'depth',label:'Zone depth',type:'number',min:32,max:2048,step:16},yawField],
    defaults:{map:'mymap2',mode:'touch',percent:50,countdown:5,keepInventory:true,width:128,depth:64,yaw:'0'}},
  {id:'storm',studio:'weather',title:'Thunderstorm',description:'Random lightning bolts (env_beam) from the sky, a light flash, thunder and a small screen shake, fired by a timer.',tutorial:'Half-Life Rain · Beam and Sprite Effects · Random entity triggering',fields:[
    {key:'width',label:'Area width',type:'number',min:128,max:8192,step:64},{key:'height',label:'Sky height',type:'number',min:128,max:4096,step:32},
    {key:'minDelay',label:'Min. delay (s)',type:'number',min:1,max:120},{key:'maxDelay',label:'Max. delay (s)',type:'number',min:1,max:300},{key:'flash',label:'Light flash',type:'bool'}],defaults:{width:1024,height:768,minDelay:6,maxDelay:16,flash:true}},
  {id:'dayNight',studio:'weather',title:'Day / night cycle',description:'Switches between a day sky and a night sky (trigger_changesky) and turns named lamps on at night, on a repeating timer.',tutorial:'Changing the sky in your map · Dynamic skies',fields:[
    {key:'daySky',label:'Day sky',type:'text'},{key:'nightSky',label:'Night sky',type:'text'},{key:'period',label:'Full cycle (s)',type:'number',min:20,max:3600},{key:'lamps',label:'Night lamps',type:'number',min:0,max:12}],defaults:{daySky:'desert',nightSky:'night',period:120,lamps:4}},
  {id:'orderedLevers',studio:'puzzle',title:'Levers in order',description:'Each lever only works after the previous one (multisource masters). Wrong order plays the locked sound; the last lever opens the door.',tutorial:'Multisource · Multisource and env_globals',fields:[
    {key:'levers',label:'Levers',type:'number',min:2,max:8},{key:'spacing',label:'Spacing',type:'number',min:32,max:512,step:16},{key:'door',label:'Add the door they open',type:'bool'}],defaults:{levers:3,spacing:96,door:true}},
  {id:'pressurePlates',studio:'puzzle',title:'Pressure plates (co-op)',description:'Several players must stand on every plate at the same time: each plate turns its multisource input on when entered and off when left.',tutorial:'Multisource · Basics of entity interactivity',fields:[
    {key:'plates',label:'Plates',type:'number',min:2,max:8},{key:'spacing',label:'Spacing',type:'number',min:64,max:1024,step:16},{key:'size',label:'Plate size',type:'number',min:32,max:256,step:8},{key:'door',label:'Add the door they open',type:'bool'}],defaults:{plates:2,spacing:192,size:64,door:true}},
  {id:'timedDoor',studio:'puzzle',title:'Timed door',description:'A button opens a door for a few seconds with an alarm and an on-screen countdown; the team has to get through in time.',tutorial:'Perfect Timing with Doors · Multi_manager',fields:[
    {key:'seconds',label:'Open for (s)',type:'number',min:2,max:60},{key:'distance',label:'Button distance',type:'number',min:64,max:2048,step:32},{key:'alarm',label:'Alarm sound',type:'bool'}],defaults:{seconds:8,distance:256,alarm:true}},
  // ---------- v2.6 creation tools: architecture (Smart Build) ----------
  {id:'building',studio:'smart',title:'Multi-storey building',description:'Walls with windows on every floor, floor slabs, a stair between floors, an entrance and a roof (flat, gable or parapet).',tutorial:'Hallways · Stairs · Texture Application',fields:[
    {key:'floors',label:'Floors',type:'number',min:1,max:8},{key:'floorHeight',label:'Floor height',type:'number',min:96,max:512,step:8},{key:'width',label:'Width',type:'number',min:256,max:4096,step:32},{key:'depth',label:'Depth',type:'number',min:256,max:4096,step:32},
    {key:'windows',label:'Windows per side',type:'number',min:0,max:12},{key:'roof',label:'Roof',type:'select',options:[['flat','Flat'],['gable','Gable'],['parapet','Flat with parapet']]},{key:'stairs',label:'Stairs between floors',type:'bool'},yawField],
    defaults:{floors:2,floorHeight:160,width:512,depth:384,windows:3,roof:'gable',stairs:true,yaw:'0'}},
  {id:'roof',studio:'smart',title:'Roof',description:'Gable, hip, dome or flat roof with eaves, sized to a room footprint.',tutorial:'Curved Architecture · Spiral Staircase',fields:[
    {key:'type',label:'Type',type:'select',options:[['gable','Gable'],['hip','Hip (pyramid)'],['dome','Dome'],['flat','Flat with eaves']]},{key:'width',label:'Width',type:'number',min:64,max:4096,step:32},{key:'depth',label:'Depth',type:'number',min:64,max:4096,step:32},
    {key:'height',label:'Roof height',type:'number',min:16,max:1024,step:8},{key:'eave',label:'Eave',type:'number',min:0,max:128,step:4},yawField],defaults:{type:'gable',width:384,depth:256,height:128,eave:16,yaw:'0'}},
  {id:'columnGrid',studio:'smart',title:'Columns and beams',description:'Grid of columns with beams on top and an optional roof slab: halls, warehouses, car parks.',tutorial:'Hallways · From The Frame Up',fields:[
    {key:'cols',label:'Columns X',type:'number',min:1,max:20},{key:'rows',label:'Columns Y',type:'number',min:1,max:20},{key:'spacing',label:'Spacing',type:'number',min:64,max:2048,step:32},{key:'height',label:'Height',type:'number',min:64,max:2048,step:16},
    {key:'size',label:'Column size',type:'number',min:8,max:256,step:8},{key:'round',label:'Round columns',type:'bool'},{key:'beams',label:'Beams',type:'bool'},{key:'slab',label:'Roof slab',type:'bool'}],defaults:{cols:4,rows:3,spacing:256,height:256,size:32,round:false,beams:true,slab:false}},
  {id:'corridor',studio:'smart',title:'Corridor along a path',description:'Closed corridor (floor, walls, ceiling) following a straight, L, U, S or zigzag path, with ceiling lights every few cells.',tutorial:'Hallways · The Hallway',fields:[shapeField,
    {key:'length',label:'Length',type:'number',min:128,max:8192,step:64},{key:'width',label:'Width',type:'number',min:64,max:512,step:16},{key:'height',label:'Height',type:'number',min:72,max:512,step:8},{key:'lightEvery',label:'Light every (cells, 0 = none)',type:'number',min:0,max:20},yawField],
    defaults:{shape:'L',length:1024,width:128,height:128,lightEvery:2,yaw:'0'}},
  {id:'vents',studio:'smart',title:'Ventilation ducts',description:'Crawl-size duct (players crouch) along a path, with breakable grates at both ends.',tutorial:'Hallways · Glass (breakables)',fields:[shapeField,{key:'length',label:'Length',type:'number',min:128,max:8192,step:64},{key:'size',label:'Inner size',type:'number',min:40,max:128,step:8},{key:'grates',label:'Breakable grates at the ends',type:'bool'},yawField],
    defaults:{shape:'L',length:768,size:48,grates:true,yaw:'0'}},
  {id:'fireEscape',studio:'smart',title:'Fire escape / stair tower',description:'Exterior zig-zag stairs with landings and railings for several floors, or a ladder (func_ladder).',tutorial:'Stairs · The Art of Ladder Making · Ladders',fields:[
    {key:'floors',label:'Floors',type:'number',min:1,max:10},{key:'floorHeight',label:'Floor height',type:'number',min:96,max:512,step:8},{key:'width',label:'Stair width',type:'number',min:48,max:256,step:8},{key:'kind',label:'Type',type:'select',options:[['stairs','Stairs with landings'],['ladder','Ladder']]},yawField],
    defaults:{floors:3,floorHeight:160,width:64,kind:'stairs',yaw:'0'}},
  {id:'freightLift',studio:'smart',title:'Freight lift with cage',description:'Industrial lift: func_train platform with railings that move with it, a bar cage around the shaft and a call button per floor.',tutorial:'Elevators using func_train · Elevator No. 2',fields:[
    {key:'floors',label:'Floors',type:'number',min:2,max:8},{key:'floorHeight',label:'Floor height',type:'number',min:64,max:1024,step:8},{key:'width',label:'Platform width',type:'number',min:64,max:512,step:8},{key:'depth',label:'Platform depth',type:'number',min:64,max:512,step:8},{key:'speed',label:'Speed',type:'number',min:16,max:600},yawField],
    defaults:{floors:2,floorHeight:192,width:160,depth:160,speed:90,yaw:'0'}},
  // ---------- World Builder ----------
  {id:'cave',studio:'world',title:'Cave / tunnel',description:'Organic tunnel along a path: irregular rock walls, floor and ceiling made of rotated convex blocks (seeded, so the preview is what you get).',tutorial:'Using Complex brushes (Realistic Cliffs) · Terrain',fields:[shapeField,{key:'length',label:'Length',type:'number',min:256,max:8192,step:64},{key:'width',label:'Width',type:'number',min:96,max:768,step:16},{key:'height',label:'Height',type:'number',min:96,max:768,step:16},{key:'roughness',label:'Roughness',type:'number',min:0,max:64},{key:'seed',label:'Seed',type:'number',min:1,max:9999},yawField],
    defaults:{shape:'S',length:1536,width:192,height:176,roughness:24,seed:7,yaw:'0'}},
  {id:'cliff',studio:'world',title:'Cliff / canyon wall',description:'Layered rock wall: rows of rotated blocks that step back as they rise. Use two facing walls for a canyon.',tutorial:'Using Complex brushes (Realistic Cliffs) · Random Terrain Generation',fields:[{key:'length',label:'Length',type:'number',min:128,max:8192,step:64},{key:'height',label:'Height',type:'number',min:64,max:4096,step:32},{key:'layers',label:'Layers',type:'number',min:1,max:12},{key:'roughness',label:'Roughness',type:'number',min:0,max:96},{key:'seed',label:'Seed',type:'number',min:1,max:9999},yawField],
    defaults:{length:768,height:384,layers:4,roughness:32,seed:3,yaw:'0'}},
  {id:'river',studio:'world',title:'River / lake',description:'Channel dug below the ground with banks, a ground border and func_water, along a path or as a round lake.',tutorial:'The Complete Guide to Water · Terrain',fields:[{key:'shape',label:'Shape',type:'select',options:[['straight','Straight river'],['L','L river'],['S','S river'],['lake','Lake']]},{key:'length',label:'Length / diameter',type:'number',min:256,max:8192,step:64},{key:'width',label:'Width',type:'number',min:64,max:1024,step:32},{key:'depth',label:'Water depth',type:'number',min:16,max:512,step:8},{key:'texture',label:'Water texture',type:'text'},yawField],
    defaults:{shape:'S',length:1536,width:192,depth:64,texture:'!WATERBLUE',yaw:'0'}},
  {id:'vegetation',studio:'world',title:'Vegetation',description:'Trees, bushes or grass made of brushes: trunk plus crossed see-through cards ({ textures, func_illusionary), randomly spread.',tutorial:'Trees · Evolving Grass',fields:[{key:'kind',label:'Type',type:'select',options:[['tree','Trees'],['bush','Bushes'],['grass','Grass']]},{key:'count',label:'Count',type:'number',min:1,max:64},{key:'radius',label:'Spread radius',type:'number',min:0,max:4096,step:32},{key:'size',label:'Size',type:'number',min:16,max:512,step:8},{key:'foliage',label:'Foliage texture',type:'text'},{key:'seed',label:'Seed',type:'number',min:1,max:9999}],
    defaults:{kind:'tree',count:5,radius:256,size:160,foliage:'{GRASS2',seed:5}},
  {id:'rubble',studio:'world',title:'Rubble and ruins',description:'Broken wall pieces, fallen beams and debris blocks at random angles for destroyed areas.',tutorial:'Detailing Maps',fields:[{key:'count',label:'Pieces',type:'number',min:3,max:80},{key:'radius',label:'Spread radius',type:'number',min:32,max:2048,step:16},{key:'walls',label:'Broken wall pieces',type:'number',min:0,max:8},{key:'seed',label:'Seed',type:'number',min:1,max:9999}],defaults:{count:18,radius:160,walls:2,seed:11}},
  {id:'terrainRoad',studio:'world',title:'Road on the terrain',description:'Road slabs along a path that follow the height of the ground under them (sampled from the existing brushes when you click).',tutorial:'Terrain · Advanced Terrain Creation',fields:[shapeField,{key:'length',label:'Length',type:'number',min:128,max:8192,step:64},{key:'width',label:'Width',type:'number',min:32,max:512,step:16},{key:'thickness',label:'Thickness',type:'number',min:2,max:32},yawField],
    defaults:{shape:'S',length:1024,width:128,thickness:4,yaw:'0'}},
  // ---------- Interiors (Prefab Studio) ----------
  {id:'furniture',studio:'prefab',title:'Furniture',description:'Parametric table, chair, shelf, desk, bed, cabinet or locker, built from a few clean brushes.',tutorial:'Detailing Maps · Chairs, Scientists and Barneys',fields:[{key:'kind',label:'Type',type:'select',options:[['table','Table'],['chair','Chair'],['shelf','Shelf'],['desk','Desk'],['bed','Bed'],['cabinet','Cabinet'],['locker','Locker']]},
    {key:'width',label:'Width',type:'number',min:16,max:256,step:4},{key:'depth',label:'Depth',type:'number',min:16,max:256,step:4},{key:'height',label:'Height',type:'number',min:16,max:256,step:4},{key:'solid',label:'Solid (func_wall)',type:'bool'},yawField],
    defaults:{kind:'desk',width:96,depth:48,height:40,solid:false,yaw:'0'}},
  {id:'labRoom',studio:'prefab',title:'Furnished laboratory',description:'Fills a room with benches along the walls, computer consoles, monitors and stools, leaving the doorway free.',tutorial:'Detailing Maps · Lighting Theory',fields:[{key:'width',label:'Room width',type:'number',min:256,max:2048,step:32},{key:'depth',label:'Room depth',type:'number',min:256,max:2048,step:32},{key:'consoles',label:'Consoles',type:'number',min:0,max:12},{key:'seed',label:'Seed',type:'number',min:1,max:9999}],defaults:{width:512,depth:384,consoles:3,seed:2}},
  {id:'pipes',studio:'prefab',title:'Pipes and cables',description:'Pipe run along a path with elbows, valves and supports; or thin cables.',tutorial:'Detailing Maps · Polygon Reduction Methods',fields:[shapeField,{key:'length',label:'Length',type:'number',min:64,max:8192,step:32},{key:'diameter',label:'Diameter',type:'number',min:2,max:128,step:2},{key:'height',label:'Height above floor',type:'number',min:0,max:1024,step:8},{key:'valves',label:'Valve every (cells, 0 = none)',type:'number',min:0,max:20},{key:'supports',label:'Supports',type:'bool'},yawField],
    defaults:{shape:'L',length:768,diameter:16,height:96,valves:3,supports:true,yaw:'0'}},
  {id:'trims',studio:'prefab',title:'Baseboards and mouldings',description:'Skirting boards at the floor and crown moulding at the ceiling around a room.',tutorial:'Detailing Maps · Texture Application',fields:[{key:'width',label:'Room width',type:'number',min:64,max:4096,step:16},{key:'depth',label:'Room depth',type:'number',min:64,max:4096,step:16},{key:'height',label:'Room height',type:'number',min:64,max:1024,step:8},{key:'size',label:'Trim size',type:'number',min:2,max:32},{key:'crown',label:'Crown moulding',type:'bool'}],defaults:{width:512,depth:384,height:160,size:8,crown:true}},
  {id:'fence',studio:'prefab',title:'Fence / railing / bars',description:'Railing with posts, see-through chain-link fence, bars or grating panels along a path.',tutorial:'Glass and Transparency · Render Properties',fields:[shapeField,{key:'length',label:'Length',type:'number',min:64,max:8192,step:32},{key:'height',label:'Height',type:'number',min:16,max:512,step:8},{key:'kind',label:'Type',type:'select',options:[['railing','Railing'],['chainlink','Chain-link fence'],['bars','Bars'],['grate','Grating']]},yawField],
    defaults:{shape:'straight',length:512,height:96,kind:'chainlink',yaw:'0'}},
  {id:'signage',studio:'prefab',title:'Signs and floor arrows',description:'Lit EXIT sign, warning panel or a floor arrow pointing the way.',tutorial:'Texture Lighting · Decals',fields:[{key:'kind',label:'Type',type:'select',options:[['exit','EXIT sign'],['panel','Wall panel / sign'],['arrow','Floor arrow']]},{key:'texture',label:'Sign texture',type:'text'},{key:'size',label:'Size',type:'number',min:16,max:256,step:8},yawField],defaults:{kind:'exit',texture:'+0EXIT',size:48,yaw:'0'}},
  // ---------- Gameplay ----------
  {id:'combatArena',studio:'gameplay',title:'Combat arena',description:'Covers at different heights, monster makers started by a trigger at the entrance, and a supply corner with weapons, ammo and health.',tutorial:'NPC and Item Placement Theory · Map Layout Theory',fields:[{key:'size',label:'Arena size',type:'number',min:256,max:4096,step:64},{key:'covers',label:'Covers',type:'number',min:0,max:40},{key:'monster',label:'Enemies',type:'select',options:[['monster_human_grunt','Human grunts'],['monster_alien_slave','Vortigaunts'],['monster_zombie','Zombies'],['monster_headcrab','Headcrabs'],['monster_alien_grunt','Alien grunts']]},{key:'makers',label:'Spawners',type:'number',min:0,max:8},{key:'seed',label:'Seed',type:'number',min:1,max:9999}],
    defaults:{size:1024,covers:10,monster:'monster_human_grunt',makers:2,seed:4}},
  {id:'sniperNest',studio:'gameplay',title:'Sniper tower',description:'Tower with a ladder, a railed platform and a sniper rifle with ammo on top.',tutorial:'Ladders · NPC and Item Placement Theory',fields:[{key:'height',label:'Tower height',type:'number',min:96,max:1024,step:16},{key:'size',label:'Platform size',type:'number',min:64,max:384,step:16},yawField],defaults:{height:256,size:128,yaw:'0'}},
  {id:'trap',studio:'gameplay',title:'Trap',description:'Spikes, ceiling crusher, flamethrower, laser grid or a floor that collapses when stepped on.',tutorial:'Land Mine Effect · Laser and Beam Effects · Glass',fields:[{key:'kind',label:'Type',type:'select',options:[['spikes','Spike pit'],['crusher','Ceiling crusher'],['flame','Flamethrower'],['lasers','Laser grid'],['collapse','Collapsing floor']]},{key:'width',label:'Width',type:'number',min:32,max:1024,step:16},{key:'depth',label:'Depth',type:'number',min:32,max:1024,step:16},{key:'height',label:'Room height',type:'number',min:64,max:1024,step:8},{key:'interval',label:'Cycle (s)',type:'number',min:.5,max:30,step:.5},{key:'damage',label:'Damage',type:'number',min:1,max:1000}],
    defaults:{kind:'crusher',width:128,depth:128,height:192,interval:3,damage:200}},
  {id:'hoverPlatform',studio:'gameplay',title:'Moving platform',description:'func_train platform that loops between path_corners around a rectangle, waiting at each stop.',tutorial:'Elevators using func_train · Angular Velocity and Rotating func_trains',fields:[{key:'length',label:'Route length',type:'number',min:128,max:8192,step:64},{key:'width',label:'Route width',type:'number',min:0,max:8192,step:64},{key:'size',label:'Platform size',type:'number',min:32,max:512,step:16},{key:'speed',label:'Speed',type:'number',min:8,max:1000},{key:'wait',label:'Wait at stops (s)',type:'number',min:0,max:30}],defaults:{length:512,width:256,size:128,speed:100,wait:1}},
  // ---------- Lighting & effects ----------
  {id:'lightRow',studio:'effects',title:'Row of ceiling lights',description:'Fluorescent lamp brushes (texture lights) with a light entity under each, every N units along a path.',tutorial:'Light · Texture Lighting · Lighting Theory',fields:[shapeField,{key:'length',label:'Length',type:'number',min:64,max:8192,step:32},{key:'spacing',label:'Spacing',type:'number',min:32,max:2048,step:16},{key:'height',label:'Ceiling height',type:'number',min:32,max:2048,step:8},{key:'texture',label:'Lamp texture',type:'text'},{key:'brightness',label:'Brightness',type:'number',min:10,max:2000},yawField],
    defaults:{shape:'straight',length:768,spacing:192,height:160,texture:'+0~FIFTS_LGHT01',brightness:220,yaw:'0'}},
  {id:'windowLight',studio:'effects',title:'Window with daylight',description:'Window frame and glass, a light_spot shining in and a soft volumetric beam (additive func_illusionary).',tutorial:'Volumetric Lighting · Realistic Shadows · Glass',fields:[{key:'width',label:'Window width',type:'number',min:32,max:512,step:8},{key:'height',label:'Window height',type:'number',min:32,max:512,step:8},{key:'sill',label:'Sill height',type:'number',min:0,max:256,step:8},{key:'beam',label:'Volumetric beam',type:'bool'},yawField],defaults:{width:128,height:96,sill:48,beam:true,yaw:'0'}},
  {id:'fireZone',studio:'effects',title:'Fire zone',description:'Several fires spread over an area with flickering light, crackle and burn damage.',tutorial:'Flame Effect · Detailing Maps',fields:[{key:'count',label:'Fires',type:'number',min:1,max:24},{key:'radius',label:'Spread radius',type:'number',min:16,max:2048,step:16},{key:'hurt',label:'Burns players',type:'bool'},{key:'seed',label:'Seed',type:'number',min:1,max:9999}],defaults:{count:5,radius:192,hurt:true,seed:9}},
];
export const kitDefinition=(id:KitId)=>KIT_DEFINITIONS.find(k=>k.id===id)!;
export const kitsForStudio=(studio:KitStudio)=>KIT_DEFINITIONS.filter(k=>k.studio===studio);

/* ---------- building helpers ---------- */
type Ctx={out:MapObject[];used:Set<string>;texture:string;group:string;yaw:number;origin:Vec3;existing:readonly MapObject[]};
function newCtx(existing:readonly MapObject[],texture:string,group:string,yaw:number,origin:Vec3=[0,0,0]):Ctx{
  const used=new Set<string>();
  for(const o of existing)if(o.kind==='entity'){const n=o.props.targetname?.trim();if(n)used.add(n);}
  return {out:[],used,texture,group,yaw,origin,existing};
}
function name(c:Ctx,prefix:string){for(let n=1;n<100000;n++){const v=`${prefix}_${String(n).padStart(2,'0')}`;if(!c.used.has(v)){c.used.add(v);return v;}}throw Error('No free targetname.');}
/** Axis-aligned box in kit space; returned in kit space and turned by `finish`. */
function box(c:Ctx,label:string,center:Vec3,size:Vec3,texture=c.texture,owner?:PointEntity):Brush{
  const b=createBrush('box',[...center],size.map(v=>Math.max(1,v)) as Vec3,label);
  b.faces.forEach(f=>f.texture=texture);b.layer='Kits';b.group=c.group;if(owner)b.entityId=owner.id;c.out.push(b);return b;
}
function ent(c:Ctx,classname:string,position:Vec3,props:Record<string,string>):PointEntity{
  const clean=Object.fromEntries(Object.entries(props).filter(([,v])=>v!==''&&v!==undefined));
  const e:PointEntity={id:uid(),kind:'entity',name:classname,classname,position:[...position],props:clean,layer:'Kits',group:c.group};c.out.push(e);return e;
}
const originBrush=(c:Ctx,owner:PointEntity,at:Vec3,s=8)=>box(c,`${owner.classname} / origin`,at,[s,s,s],'ORIGIN',owner);
/** Brush entity position = centre of its brushes (as the editor does for tied brushes). */
function centreOn(c:Ctx,e:PointEntity){
  const own=c.out.filter((o):o is Brush=>o.kind==='brush'&&o.entityId===e.id);if(!own.length)return;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const b of own)for(const v of transformedVertices(b))for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],v[i]);hi[i]=Math.max(hi[i],v[i]);}
  e.position=[0,1,2].map(i=>(lo[i]+hi[i])/2) as Vec3;
}
/** Rotation-axis flag for an axis given in kit space, after the kit is turned by yaw. */
const axisFlags=(c:Ctx,local:'x'|'y',xFlag:number,yFlag:number)=>{const swap=c.yaw===90||c.yaw===270;return (local==='x')!==swap?xFlag:yFlag;};
const rot=(p:Vec3,yaw:number):Vec3=>{const r=yaw*Math.PI/180,cs=Math.round(Math.cos(r)*1e9)/1e9,sn=Math.round(Math.sin(r)*1e9)/1e9;return [p[0]*cs-p[1]*sn,p[0]*sn+p[1]*cs,p[2]];};
const fixed=(v:number)=>Math.round(v*1e4)/1e4;
/** Turn by yaw, move to the origin and bake rotations into vertices (keeps every brush axis-aligned for 90° steps). */
function finish(c:Ctx,origin:Vec3):MapObject[]{
  for(const e of c.out)if(e.kind==='entity')centreOnIfOwner(c,e);
  return c.out.map(o=>{
    if(o.kind==='entity'){
      const p=rot(o.position,c.yaw);const props={...o.props};
      if(props.angles&&c.yaw){const a=props.angles.split(/\s+/).map(Number);a[1]=((a[1]||0)+c.yaw)%360;props.angles=a.join(' ');}
      return {...o,position:p.map((v,i)=>fixed(v+origin[i])) as Vec3,props};
    }
    const world=transformedVertices({...o,rotation:[o.rotation[0],o.rotation[1],o.rotation[2]]}).map(v=>rot(v,c.yaw));
    const pos=rot(o.position,c.yaw);
    return {...o,position:pos.map((v,i)=>fixed(v+origin[i])) as Vec3,rotation:[0,0,0],scale:[1,1,1],vertices:world.map(v=>v.map((x,i)=>fixed(x-pos[i])) as Vec3)} as Brush;
  });
}
function centreOnIfOwner(c:Ctx,e:PointEntity){if(c.out.some(o=>o.kind==='brush'&&o.entityId===e.id)&&!e.props.__keepPosition)centreOn(c,e);delete e.props.__keepPosition;}
const text=(c:Ctx,at:Vec3,targetname:string,message:string,color='100 200 255')=>ent(c,'game_text',at,{targetname,message,x:'-1',y:'0.3',effect:'0',color,color2:'240 110 0',fadein:'0.3',fadeout:'0.8',holdtime:'2.5',channel:'2',spawnflags:'1'});
const relay=(c:Ctx,at:Vec3,targetname:string,target='')=>ent(c,'trigger_relay',at,{targetname,target,triggerstate:'2',delay:'0'});
const trigger=(c:Ctx,classname:string,center:Vec3,size:Vec3,props:Record<string,string>)=>{const e=ent(c,classname,center,props);box(c,`${classname} / volume`,center,size,'AAATRIGGER',e);return e;};
function button(c:Ctx,at:Vec3,target:string,props:Record<string,string>={}):PointEntity{
  const e=ent(c,'func_button',at,{target,speed:'5',wait:'1',sounds:'9',angles:'0 90 0',lip:'2',spawnflags:'0',...props});
  box(c,'func_button / plate',at,[16,4,16],c.texture,e);return e;
}
function timer(c:Ctx,at:Vec3,targetname:string,target:string,min:number,max:number,startOn:boolean){
  return ent(c,'trigger_random',at,{targetname,target_count:'1',target1:target,min_delay:String(min),max_delay:String(max),spawnflags:String(8|(startOn?1:0))});
}

/* ---------- doors ---------- */
function buildDoor(c:Ctx,o:KitOptions,at:Vec3=[0,0,0],forcedName?:string):{name:string;leaves:PointEntity[]}{
  const w=clamp(num(o,'width',64),16,1024),h=clamp(num(o,'height',112),32,1024),t=clamp(num(o,'thickness',8),2,64);
  const rotating=o.style==='rotating',double=flag(o,'double'),glass=flag(o,'glass'),mode=str(o,'open','proximity');
  const classname=rotating?'func_door_rotating':'func_door';
  const doorName=forcedName||name(c,'door');
  const [ox,oy,oz]=at;
  if(flag(o,'frame')){
    for(const s of [-1,1])box(c,'door / frame side',[ox+s*(w/2+4),oy,oz+h/2+4],[8,t+8,h+8]);
    box(c,'door / frame header',[ox,oy,oz+h+4],[w+16,t+8,8]);
  }
  const base:Record<string,string>={speed:String(num(o,'speed',100)),wait:String(num(o,'wait',3)),movesnd:str(o,'movesnd','0'),stopsnd:o.movesnd&&o.movesnd!=='0'?'1':'0'};
  if(rotating)base.distance='90';else base.lip='4';
  const leaves:PointEntity[]=[];
  const leafCount=double?2:1,leafW=double?w/2:w;
  for(let i=0;i<leafCount;i++){
    const cx=ox+(double?(i===0?-w/4:w/4):0);
    const dir=double?(i===0?180:0):0;
    const hingeX=double?(i===0?ox-w/2:ox+w/2):ox-w/2;
    const make=(part:string,extra:Record<string,string>)=>{
      const e=ent(c,classname,[cx,oy,oz+h/2],{...base,...extra});
      if(rotating){e.props.spawnflags=String((double&&i===1?2:0)|Number(extra.spawnflags||0));originBrush(c,e,[hingeX,oy,oz+h/2]);}
      else{e.props.angles=`0 ${dir} 0`;}
      leaves.push(e);return e;
    };
    if(glass&&leafW>=32&&h>=64){
      const solid=make('leaf',{});
      const b=8,paneW=leafW-2*b-2;
      box(c,'door / leaf stile',[cx-leafW/2+b/2,oy,oz+h/2],[b,t,h],c.texture,solid);
      box(c,'door / leaf stile',[cx+leafW/2-b/2,oy,oz+h/2],[b,t,h],c.texture,solid);
      box(c,'door / leaf bottom',[cx,oy,oz+h*0.3],[leafW-2*b,t,h*0.6],c.texture,solid);
      box(c,'door / leaf top',[cx,oy,oz+h-b/2],[leafW-2*b,t,b],c.texture,solid);
      const pane=make('glass',{rendermode:'2',renderamt:'90',lip:rotating?'':String(4-(leafW-paneW))});
      box(c,'door / glass pane',[cx,oy,oz+h*0.6+(h*0.4-b)/2],[paneW,Math.max(2,t/2),h*0.4-b],c.texture,pane);
    }else{
      const leaf=make('leaf',{});box(c,'door / leaf',[cx,oy,oz+h/2],[leafW-2,t,h-2],c.texture,leaf);
    }
  }
  // Wiring: the first leaf is the "master"; others always follow its name.
  const [master,...followers]=leaves;
  const setAll=(p:Record<string,string>)=>leaves.forEach(l=>Object.assign(l.props,p));
  const front:Vec3=[ox,oy-t/2-2,oz];
  /** A single leaf is driven by itself (USE, key, lock). Several leaves (double / glass) must move
   * together, so they share one name and a panel button carries the rule instead. */
  const masterDriven=(extra:Record<string,string>,backButton=false)=>{
    if(!followers.length){Object.assign(master.props,extra);return;}
    const {spawnflags:_ignored,wait:_w,...rule}=extra;void _ignored;void _w;
    setAll({targetname:doorName});
    button(c,[ox+w/2+28,front[1]-2,oz+48],doorName,rule);
    if(backButton){const back=button(c,[ox-w/2-28,oy+t/2+4,oz+48],doorName,rule);back.props.angles='0 270 0';}
  };
  if(mode==='proximity'){setAll({targetname:doorName});trigger(c,'trigger_multiple',[ox,oy,oz+h/2],[w+64,t+160,h],{target:doorName,wait:'1'});}
  else if(mode==='use')masterDriven({spawnflags:String(Number(master.props.spawnflags||0)|256)},true);
  else if(mode==='button'){setAll({targetname:doorName});
    button(c,[ox+w/2+28,front[1]-2,oz+48],doorName);const back=button(c,[ox-w/2-28,oy+t/2+4,oz+48],doorName);back.props.angles='0 270 0';}
  else if(mode==='handle'){setAll({targetname:doorName});
    const lever=ent(c,'func_rot_button',[ox+w/2+28,front[1]-4,oz+48],{target:doorName,speed:'120',wait:'2',distance:'90',sounds:'21',spawnflags:String(axisFlags(c,'y',64,128))});
    box(c,'handle / grip',[ox+w/2+28+8,front[1]-4,oz+48],[16,4,4],c.texture,lever);originBrush(c,lever,[ox+w/2+28,front[1]-4,oz+48],4);
  }else if(mode==='key'){
    const keyName=str(o,'keyName','key_red').replace(/[^\w-]/g,'_'),label=str(o,'keyLabel','Key');
    const fail=name(c,`${doorName}_needkey`);
    masterDriven({spawnflags:String(Number(master.props.spawnflags||0)|256),item_name_required:keyName,target_on_fail:fail,locked_sound:'2',unlocked_sound:'9',...(flag(o,'consumeKey')?{pass_destroy_item_name:keyName}:{})});
    text(c,[ox,oy-48,oz+h+24],fail,`${label}`,'255 160 60');
    const d=clamp(num(o,'keyDistance',192),16,8192);
    ent(c,'item_inventory',[ox,oy-d,oz+16],{targetname:`${keyName}_item`,item_name:keyName,display_name:label,description:label,model:'models/w_security.mdl',holder_keep_on_death:'1',holder_timelimit:'0',spawnflags:'0'});
  }else if(mode==='locked'){
    const lock=name(c,`${doorName}_lock`);
    masterDriven({spawnflags:String(Number(master.props.spawnflags||0)|256),master:lock,locked_sound:'12',wait:'-1'});
    ent(c,'multisource',[ox,oy-32,oz+h+24],{targetname:lock});
  }else if(mode==='npcOnly'){masterDriven({m_iOpenFlags:'2'});}
  else if(mode==='scripted'){setAll({targetname:doorName,spawnflags:String(Number(master.props.spawnflags||0)|512)});}
  leaves.forEach(l=>centreOn(c,l));
  return {name:doorName,leaves};
}

/* ---------- v2.6 creation helpers ---------- */
/** Any primitive (box, cylinder, pyramid, wedge…) with an optional rotation in degrees (baked by finish). */
function prim(c:Ctx,kind:'box'|'cylinder'|'pyramid'|'wedge'|'cone',label:string,center:Vec3,size:Vec3,texture=c.texture,owner?:PointEntity,rotation:Vec3=[0,0,0]):Brush{
  const b=createBrush(kind,[...center],size.map(v=>Math.max(1,v)) as Vec3,label);b.rotation=[...rotation];
  b.faces.forEach(f=>f.texture=texture);b.layer='Kits';b.group=c.group;if(owner)b.entityId=owner.id;c.out.push(b);return b;
}
/** Seeded random so previews and placement build the same shapes. */
function seeded(seed:number){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
/** Grid cells covered by a path shape (straight, L, U, S, zigzag, ring, lake) of total length L. */
function pathCells(shape:string,length:number,cell:number):Set<string>{
  const L=Math.max(cell,length),pts:[number,number][]=shape==='L'?[[0,0],[0,L/2],[L/2,L/2]]:shape==='U'?[[0,0],[0,L/3],[L/3,L/3],[L/3,0]]:shape==='S'?[[0,0],[0,L/3],[L/3,L/3],[L/3,2*L/3]]
    :shape==='zigzag'?[[0,0],[0,L/4],[L/4,L/4],[L/4,L/2],[L/2,L/2],[L/2,3*L/4]]:[[0,0],[0,L]];
  const cells=new Set<string>();
  if(shape==='lake'||shape==='ring'){const r=Math.max(1,Math.round(L/2/cell));for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const d=Math.hypot(i,j);if(shape==='lake'?d<=r+.3:Math.abs(d-r)<.75)cells.add(`${i},${j}`);}return cells;}
  for(let k=0;k+1<pts.length;k++){const [a,b]=[pts[k],pts[k+1]];const steps=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/cell));
    for(let s=0;s<=steps;s++){const x=a[0]+(b[0]-a[0])*s/steps,y=a[1]+(b[1]-a[1])*s/steps;cells.add(`${Math.round(x/cell)},${Math.round(y/cell)}`);}}
  return cells;
}
const cellList=(cells:Set<string>)=>[...cells].map(k=>k.split(',').map(Number) as [number,number]);
/** Top of the solid under (x,y) in world space, from existing brushes (null if nothing). */
function floorAt(objects:readonly MapObject[],x:number,y:number,below:number):number|null{
  let best:number|null=null;
  for(const o of objects){if(o.kind!=='brush'||o.entityId)continue;const v=transformedVertices(o);
    let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;for(const p of v){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);}
    if(x<minx||x>maxx||y<miny||y>maxy)continue;
    let hi=Infinity,lo=-Infinity,ok=true;
    const cen=v.reduce((s,p)=>[s[0]+p[0]/v.length,s[1]+p[1]/v.length,s[2]+p[2]/v.length],[0,0,0]);
    for(const f of o.faces){const [a,b,d]=f.indices.slice(0,3).map(i=>v[i]);if(!a||!b||!d)continue;const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
      let n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];if(n[0]*(cen[0]-a[0])+n[1]*(cen[1]-a[1])+n[2]*(cen[2]-a[2])>0)n=n.map(q=>-q);
      const dd=n[0]*a[0]+n[1]*a[1]+n[2]*a[2],rhs=dd-n[0]*x-n[1]*y;if(Math.abs(n[2])<1e-6){if(rhs<-1e-3){ok=false;break;}continue;}if(n[2]>0)hi=Math.min(hi,rhs/n[2]);else lo=Math.max(lo,rhs/n[2]);}
    if(ok&&hi>lo&&hi<=below+1&&(best===null||hi>best))best=hi;}
  return best;
}
/* ---------- the kits ---------- */
function build(c:Ctx,id:KitId,o:KitOptions){
  switch(id){
    case 'door':case 'keyDoor':case 'npcDoor':buildDoor(c,o);break;
    case 'checkpoint':{
      const zone=clamp(num(o,'zone',192),32,4096),msg=str(o,'message','Checkpoint!');
      const base=name(c,'checkpoint');
      if(o.mode==='script'){
        ent(c,'point_checkpoint',[0,0,36],{targetname:base,m_flDelayBeforeStart:'3',m_flDelayBetweenRevive:'1',m_flDelayBeforeReactivation:'60',m_fSpawnEffect:'1',minhullsize:'-16 -16 -36',maxhullsize:'16 16 36'});
        break;
      }
      const spawns=`${base}_spawn`,mm=`${base}_mm`,txt=`${base}_text`;
      const n=clamp(Math.round(num(o,'spawns',4)),1,32),cols=Math.min(4,n);
      for(let i=0;i<n;i++){const col=i%cols,row=Math.floor(i/cols);
        ent(c,'info_player_deathmatch',[(col-(cols-1)/2)*48,zone/2+40+row*48,37],{targetname:spawns,angles:'0 90 0',spawnflags:'2'});}
      const mmProps:Record<string,string>={targetname:mm,[spawns]:'0',[txt]:'0.1'};
      const prev=str(o,'previous').trim();if(prev)mmProps[prev]='0';
      ent(c,'multi_manager',[0,-zone/2-24,24],mmProps);
      text(c,[24,-zone/2-24,24],txt,msg);
      trigger(c,'trigger_once',[0,0,64],[zone,zone,128],{target:mm});
      break;}
    case 'randomEvent':{
      const base=name(c,'random'),count=clamp(Math.round(num(o,'count',3)),2,16),timed=flag(o,'timed');
      const props:Record<string,string>={targetname:base,target_count:String(count)};
      let flags=0;if(timed){flags|=8|1;props.min_delay=String(num(o,'minDelay',3));props.max_delay=String(num(o,'maxDelay',7));}
      else if(flag(o,'unique'))flags|=16|4;
      props.spawnflags=String(flags);
      for(let i=1;i<=count;i++){const out=`${base}_out${i}`;props[`target${i}`]=out;
        const x=(i-(count+1)/2)*40;
        if(flag(o,'demo')){relay(c,[x,48,16],out,`${out}_text`);text(c,[x,80,16],`${out}_text`,`Event ${i}`);}else relay(c,[x,48,16],out);}
      ent(c,'trigger_random',[0,0,16],props);
      if(flag(o,'button'))button(c,[0,-32,48],base);
      break;}
    case 'loop':{
      const base=name(c,'loop'),tick=`${base}_tick`,iv=clamp(num(o,'interval',2),.1,3600);
      timer(c,[0,0,16],base,tick,iv,iv,flag(o,'startOn'));
      if(o.payload==='spark'){ent(c,'env_spark',[0,48,64],{targetname:tick,MaxDelay:'0',angles:'0 0 0'});}
      else if(o.payload==='sound'){ent(c,'ambient_generic',[0,48,64],{targetname:tick,message:'buttons/blip1.wav',health:'10',playmode:'1',spawnflags:'48'});}
      else relay(c,[0,48,16],tick);
      if(flag(o,'button'))button(c,[0,-32,48],base,{sounds:'14'});
      break;}
    case 'elevator':{
      const floors=clamp(Math.round(num(o,'floors',2)),2,8),fh=clamp(num(o,'floorHeight',192),32,4096),w=clamp(num(o,'width',128),32,1024),d=clamp(num(o,'depth',128),32,1024);
      const base=name(c,'elevator');
      const train=ent(c,'func_train',[0,0,4],{targetname:base,target:`${base}_up1`,speed:String(num(o,'speed',120)),dmg:'0'});
      box(c,'elevator / platform',[0,0,4],[w,d,8],c.texture,train);originBrush(c,train,[0,0,4]);
      train.props.__keepPosition='1';
      // Up trip stops at every floor, then the way back down. Each stop waits for a button.
      const stops:{name:string;floor:number}[]=[];
      for(let f=0;f<floors;f++)stops.push({name:`${base}_up${f+1}`,floor:f});
      for(let f=floors-2;f>=1;f--)stops.push({name:`${base}_down${f+1}`,floor:f});
      stops.forEach((s,i)=>{const next=stops[(i+1)%stops.length];
        ent(c,'path_corner',[0,0,s.floor*fh+4],{targetname:s.name,target:next.name,spawnflags:'1',wait:'0',message:flag(o,'doors')?`${base}_door${s.floor+1}`:''});});
      for(let f=0;f<floors;f++){
        const z=f*fh;
        button(c,[w/2+20,-d/2-6,z+56],base,{wait:'2'});
        if(flag(o,'doors'))buildDoor(c,{width:Math.min(w-16,96),height:Math.min(112,fh-24),thickness:8,style:'sliding',open:'scripted',double:true,glass:false,frame:true,speed:120,wait:3,movesnd:'2'},[0,-d/2-8,z],`${base}_door${f+1}`);
      }
      break;}
    case 'fan':{
      const r=clamp(num(o,'radius',64),8,1024),wall=o.orientation==='wall',base=name(c,'fan');
      const spin=ent(c,'func_rotating',[0,0,0],{targetname:flag(o,'button')?base:'',speed:String(num(o,'speed',300)),sounds:'2',volume:'8',fanfriction:'20',
        spawnflags:String(1|256|(flag(o,'pain')?32:0)|(wall?axisFlags(c,'y',4,8):0))});
      const cz=wall?r+16:0;
      if(wall){box(c,'fan / blade',[0,0,cz],[r*2,4,r*0.35],c.texture,spin);box(c,'fan / blade',[0,0,cz],[r*0.35,4,r*2],c.texture,spin);box(c,'fan / hub',[0,0,cz],[r*0.4,10,r*0.4],c.texture,spin);}
      else{box(c,'fan / blade',[0,0,cz-8],[r*2,r*0.35,4],c.texture,spin);box(c,'fan / blade',[0,0,cz-8],[r*0.35,r*2,4],c.texture,spin);box(c,'fan / hub',[0,0,cz-8],[r*0.4,r*0.4,10],c.texture,spin);}
      originBrush(c,spin,[0,0,wall?cz:cz-8]);
      if(flag(o,'push')){
        const props:Record<string,string>={targetname:flag(o,'button')?base:'',speed:String(Math.round(num(o,'speed',300)*0.8)),angles:wall?'0 270 0':'90 0 0'};
        trigger(c,'trigger_push',wall?[0,-r*2,cz]:[0,0,-r*2],wall?[r*2,r*4-8,r*2]:[r*2,r*2,r*4-16],props);
      }
      if(flag(o,'button'))button(c,[r+32,-8,48],base,{sounds:'14'});
      break;}
    case 'gear':{
      const r=clamp(num(o,'radius',64),8,1024),n=clamp(Math.round(num(o,'teeth',10)),3,32),t=clamp(num(o,'thickness',16),2,256);
      const g=ent(c,'func_rotating',[0,0,t/2],{speed:String(num(o,'speed',30)),spawnflags:String(1|(flag(o,'reverse')?2:0)),sounds:'0'});
      const hub=createBrush('cylinder',[0,0,t/2],[r*1.7,r*1.7,t],'gear / wheel');hub.faces.forEach(f=>f.texture=c.texture);hub.layer='Kits';hub.group=c.group;hub.entityId=g.id;c.out.push(hub);
      for(let i=0;i<n;i++){const a=i*360/n,rad=a*Math.PI/180;const tooth=box(c,'gear / tooth',[Math.cos(rad)*r*0.9,Math.sin(rad)*r*0.9,t/2],[r*0.35,Math.max(4,2*Math.PI*r/n*0.45),t],c.texture,g);tooth.rotation=[0,0,a];}
      originBrush(c,g,[0,0,t/2]);
      break;}
    case 'rotatingLight':{
      const base=name(c,'beacon'),color=str(o,'color','255 60 20'),on=flag(o,'startOn');
      const sp=String(num(o,'speed',200));
      box(c,'beacon / base',[0,0,4],[24,24,8]);
      const housing=ent(c,'func_rotating',[0,0,16],{targetname:base,speed:sp,spawnflags:String((on?1:0)|64),sounds:'0'});
      box(c,'beacon / housing',[0,0,16],[16,16,16],c.texture,housing);originBrush(c,housing,[0,0,16]);
      const beams=ent(c,'func_rotating',[0,0,16],{targetname:base,speed:sp,spawnflags:String((on?1:0)|64),sounds:'0',rendermode:'5',renderamt:'110',rendercolor:color});
      box(c,'beacon / beam',[48,0,16],[80,4,10],c.texture,beams);box(c,'beacon / beam',[-48,0,16],[80,4,10],c.texture,beams);originBrush(c,beams,[0,0,16]);
      ent(c,'env_sprite',[0,0,28],{targetname:base,model:'sprites/glow01.spr',scale:'0.4',rendermode:'3',renderamt:'200',rendercolor:color,spawnflags:on?'1':'0'});
      if(flag(o,'sound'))ent(c,'ambient_generic',[0,0,40],{targetname:base,message:'ambience/siren.wav',health:'8',playmode:'2',spawnflags:on?'4':'20'});
      break;}
    case 'pendulum':{
      const len=clamp(num(o,'length',192),16,4096),base=name(c,'pendulum');
      const p=ent(c,'func_pendulum',[0,0,0],{targetname:base,speed:String(num(o,'speed',60)),distance:String(num(o,'distance',60)),dmg:String(num(o,'damage',0)),damp:'0',spawnflags:String(1|axisFlags(c,'y',64,128))});
      box(c,'pendulum / arm',[0,0,len/2+24],[4,4,len-24],c.texture,p);box(c,'pendulum / weight',[0,0,24],[32,16,32],c.texture,p);
      originBrush(c,p,[0,0,len+8]);box(c,'pendulum / ceiling mount',[0,0,len+20],[32,32,8]);
      break;}
    case 'retinaScanner':{
      const base=name(c,'retina'),npc=str(o,'npc','monster_scientist'),dist=clamp(num(o,'npcDistance',160),32,8192);
      const door=buildDoor(c,{width:num(o,'width',64),height:num(o,'height',112),thickness:8,style:'sliding',open:'scripted',double:false,glass:false,frame:true,speed:80,wait:5,movesnd:'2'},[0,0,0]);
      const w=num(o,'width',64);
      box(c,'retina / scanner panel',[w/2+28,-6,56],[16,4,24]);
      ent(c,npc,[w/2+28,-dist,0],{targetname:`${base}_npc`,angles:'0 90 0',spawnflags:'0'});
      const seq=ent(c,'scripted_sequence',[w/2+28,-30,0],{targetname:`${base}_seq`,m_iszEntity:`${base}_npc`,m_iszPlay:'retina',m_fMoveTo:'1',m_flRadius:'1024',target:door.name,angles:'0 90 0',spawnflags:'32'});
      trigger(c,'trigger_once',[0,-dist/2-24,64],[Math.max(128,w+96),Math.max(64,dist-48),128],{target:seq.props.targetname});
      break;}
    case 'steam':{
      const h=clamp(num(o,'height',96),16,2048),base=name(c,'steam');
      for(let i=0;i<3;i++)ent(c,'env_sprite',[0,0,16+i*h/3],{targetname:base,model:'sprites/steam1.spr',framerate:'12',scale:String(0.6+i*0.5),rendermode:'5',renderamt:String(140-i*35),spawnflags:'1'});
      if(flag(o,'sound'))ent(c,'ambient_generic',[0,0,24],{targetname:base,message:'ambience/steamjet1.wav',health:'7',playmode:'2',spawnflags:'2'});
      if(flag(o,'hurt'))trigger(c,'trigger_hurt',[0,0,h/2],[48,48,h],{targetname:base,dmg:'10',damagetype:'8'});
      break;}
    case 'sparks':ent(c,'env_spark',[0,0,32],{targetname:name(c,'sparks'),MaxDelay:String(num(o,'maxDelay',2)),angles:'0 0 0',spawnflags:flag(o,'startOn')?'96':'32'});break;
    case 'drips':{
      const h=clamp(num(o,'height',128),16,4096),base=name(c,'drip'),iv=clamp(num(o,'interval',1.2),.1,60);
      ent(c,'env_shooter',[0,0,h],{targetname:base,shootmodel:'sprites/wdrip2.spr',m_iGibs:'1',delay:'0',m_flVelocity:'40',m_flVariance:'0.05',m_flGibLife:'2',angles:'90 0 0',scale:'0.4',rendermode:'5',renderamt:'200',spawnflags:'1'});
      timer(c,[0,0,h+24],`${base}_timer`,base,iv*0.6,iv*1.4,true);
      ent(c,'ambient_generic',[0,0,24],{message:'ambience/drips.wav',health:'5',playmode:'2',spawnflags:'2'});
      break;}
    case 'flame':{
      const s=clamp(num(o,'scale',1),.1,10),base=name(c,'flame');
      ent(c,'env_sprite',[0,0,24*s],{targetname:base,model:'sprites/fire.spr',framerate:'15',scale:String(s),rendermode:'5',renderamt:'255',spawnflags:'1'});
      if(flag(o,'light'))ent(c,'light',[0,0,48*s],{_light:'255 140 40 160',_fade:'1',_falloff:'0',style:'6'});
      if(flag(o,'sound'))ent(c,'ambient_generic',[0,0,24],{targetname:base,message:'ambience/burning1.wav',health:'6',playmode:'2',spawnflags:'2'});
      if(flag(o,'hurt'))trigger(c,'trigger_hurt',[0,0,24*s],[32*s,32*s,48*s],{targetname:base,dmg:'8',damagetype:'8'});
      break;}
    case 'landmine':{
      const base=name(c,'mine');
      box(c,'mine / body',[0,0,2],[16,16,4]);
      ent(c,'env_explosion',[0,0,8],{targetname:base,iMagnitude:String(num(o,'magnitude',120)),spawnflags:'0'});
      ent(c,'env_shake',[0,0,16],{targetname:base,amplitude:'8',radius:'600',duration:'1.5',frequency:'40'});
      trigger(c,'trigger_once',[0,0,12],[32,32,24],{target:base});
      break;}
    case 'explosion':{
      const base=name(c,'boom'),rep=flag(o,'repeatable');
      ent(c,'env_explosion',[0,0,24],{targetname:base,iMagnitude:String(num(o,'magnitude',150)),spawnflags:rep?'2':'0'});
      ent(c,'env_shake',[0,0,40],{targetname:base,amplitude:'10',radius:'800',duration:'2',frequency:'60'});
      ent(c,'env_spark',[16,0,24],{targetname:base,MaxDelay:'0',angles:'0 0 0'});
      if(flag(o,'button'))button(c,[0,-160,48],base,{wait:rep?'3':'-1'});
      break;}
    case 'bubbles':{
      const w=num(o,'width',64),d=num(o,'depth',64),h=num(o,'height',128);
      trigger(c,'env_bubbles',[0,0,h/2],[w,d,h],{targetname:name(c,'bubbles'),density:String(num(o,'density',2)),frequency:'2',current:'0'});
      break;}
    case 'laser':{
      const base=name(c,'laser'),len=clamp(num(o,'length',256),16,8192);
      ent(c,'env_laser',[0,0,48],{targetname:base,LaserTarget:`${base}_end`,renderamt:'200',rendercolor:str(o,'color','255 0 0'),width:'12',NoiseAmplitude:'0',texture:'sprites/laserbeam.spr',TextureScroll:'35',damage:String(num(o,'damage',0)),spawnflags:String((flag(o,'startOn')?1:0)|32)});
      ent(c,'info_target',[0,len,48],{targetname:`${base}_end`});
      break;}
    case 'rain':case 'snow':{
      const snow=id==='snow',w=clamp(num(o,'width',512),64,8192),d=clamp(num(o,'depth',512),64,8192),h=clamp(num(o,'height',384),32,4096);
      const base=name(c,snow?'snow':'rain'),cell=128;
      const nx=Math.max(1,Math.round(w/cell)),ny=Math.max(1,Math.round(d/cell));
      if(nx*ny>256)throw Error('Area too large: more than 256 emitters. Reduce width or depth.');
      for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)
        ent(c,'env_shooter',[(ix-(nx-1)/2)*w/nx,(iy-(ny-1)/2)*d/ny,h],{targetname:base,shootmodel:snow?'sprites/snow.spr':'sprites/rain.spr',m_iGibs:String(clamp(Math.round(num(o,'density',5)),1,40)),delay:'0.1',
          m_flVelocity:snow?'30':'500',m_flVariance:snow?'0.9':'0.25',m_flGibLife:snow?'6':'1.2',angles:'90 0 0',scale:snow?'0.3':'0.5',rendermode:'5',renderamt:snow?'220':'140',spawnflags:'1'});
      timer(c,[0,0,h+24],`${base}_timer`,base,snow?1.5:0.5,snow?2.5:0.9,true);
      if(!snow&&flag(o,'sound'))ent(c,'ambient_generic',[0,0,48],{message:'ambience/water_flowing1.wav',health:'7',playmode:'2',spawnflags:'4'});
      break;}
    case 'waterfall':{
      const w=clamp(num(o,'width',96),16,2048),h=clamp(num(o,'height',256),32,4096),tex=str(o,'texture','!waterblue');
      const fall=ent(c,'func_conveyor',[0,0,h/2],{speed:'150',angles:'90 0 0',spawnflags:'3',rendermode:'2',renderamt:'150'});
      box(c,'waterfall / sheet',[0,0,h/2+8],[w,4,h-16],tex,fall);
      const pool=ent(c,'func_water',[0,0,8],{skin:'-3',WaveHeight:'2',rendermode:'2',renderamt:'130'});
      box(c,'waterfall / splash pool',[0,-w*0.4,8],[w*1.6,w,16],tex,pool);
      ent(c,'env_sprite',[0,-24,24],{model:'sprites/steam1.spr',scale:String(Math.max(.5,w/96)),rendermode:'5',renderamt:'80',framerate:'10',spawnflags:'1'});
      if(flag(o,'sound'))ent(c,'ambient_generic',[0,-24,32],{message:'ambience/waterfall1.wav',health:'9',playmode:'2',spawnflags:'4'});
      break;}
    case 'healingPool':{
      const w=num(o,'width',128),d=num(o,'depth',128),h=num(o,'height',32),tex=str(o,'texture','!waterblue');
      const water=ent(c,'func_water',[0,0,h/2],{skin:'-3',WaveHeight:'1',rendermode:'2',renderamt:'150',rendercolor:'120 255 160'});
      box(c,'healing pool / water',[0,0,h/2],[w,d,h],tex,water);
      trigger(c,'trigger_hurt',[0,0,h/2],[w-8,d-8,h],{dmg:String(-Math.abs(num(o,'heal',5))),damagetype:'0'});
      ent(c,'ambient_generic',[0,0,h+16],{message:'ambience/alien_hollow.wav',health:'5',playmode:'2',spawnflags:'2'});
      break;}
    case 'waterPool':{
      const w=num(o,'width',256),d=num(o,'depth',256),h=num(o,'height',96),tex=str(o,'texture','!waterblue');
      const water=ent(c,'func_water',[0,0,h/2],{skin:str(o,'contents','-3'),WaveHeight:'3.2',rendermode:'2',renderamt:String(clamp(num(o,'renderamt',120),1,255))});
      box(c,'water / volume',[0,0,h/2],[w,d,h],tex,water);
      if(str(o,'contents','-3')==='-3')ent(c,'env_sound',[0,0,h/2],{radius:String(Math.round(Math.max(w,d)/2)),roomtype:'15'});
      break;}
    case 'vending':{
      const base=name(c,'vending'),dispenser=`${base}_can`;
      box(c,'vending / body',[0,0,48],[48,32,96]);
      ent(c,'env_beverage',[0,-20,16],{targetname:dispenser,health:String(num(o,'capacity',10)),skin:str(o,'drink','6'),weapons:String(num(o,'heal',1)),angles:'0 270 0'});
      button(c,[14,-18,56],dispenser,{sounds:'7',wait:'1'});
      if(flag(o,'glass')){const g=ent(c,'func_breakable',[-6,-17,64],{material:'0',health:'15',rendermode:'2',renderamt:'110'});box(c,'vending / glass front',[-6,-17,64],[28,2,48],c.texture,g);}
      break;}
    case 'breakable':{
      const kind=str(o,'kind','crate'),w=clamp(num(o,'width',48),2,4096),d=clamp(num(o,'depth',48),2,4096),h=clamp(num(o,'height',48),2,4096);
      const material={glass:'0',crate:'1',metal:'2',computer:'6'}[kind]??'1';
      const b=ent(c,'func_breakable',[0,0,h/2],{targetname:name(c,`break_${kind}`),material,health:String(num(o,'health',30)),spawnobject:str(o,'spawn','0'),explosion:'1',
        ...(kind==='glass'?{rendermode:'2',renderamt:'100'}:{}),displayname:kind==='crate'?'Crate':'',spawnflags:kind==='crate'?'32':'0'});
      box(c,`breakable / ${kind}`,[0,0,h/2],kind==='glass'?[w,Math.min(d,4),h]:[w,d,h],c.texture,b);
      break;}
    case 'monitor':{
      const w=clamp(num(o,'width',40),8,512),h=Math.round(w*0.75),base=name(c,'monitor');
      box(c,'monitor / stand',[0,4,4],[w*0.4,12,8]);
      const m=ent(c,'func_breakable',[0,0,8+h/2],{targetname:base,material:'6',health:'20',killtarget:`${base}_screen`});
      box(c,'monitor / case',[0,0,8+h/2],[w,12,h],c.texture,m);
      ent(c,'env_sprite',[0,-8,8+h/2],{targetname:`${base}_screen`,model:'sprites/glow01.spr',scale:String(Math.max(.2,w/80)),rendermode:'3',renderamt:'160',rendercolor:str(o,'color','80 180 255'),spawnflags:'1'});
      break;}
    case 'turret':{
      const weapon=str(o,'weapon','gun'),player=o.mode!=='auto',base=name(c,'turret');
      const cls={gun:'func_tank',laser:'func_tanklaser',rocket:'func_tankrocket',mortar:'func_tankmortar'}[weapon]??'func_tank';
      box(c,'turret / base',[0,0,16],[32,32,32]);
      const props:Record<string,string>={targetname:base,angles:'0 270 0',yawrate:'60',yawrange:String(num(o,'yawRange',60)),yawtolerance:'15',pitchrate:'40',pitchrange:String(num(o,'pitchRange',25)),pitchtolerance:'5',
        barrel:'40',barrelz:'0',firerate:weapon==='gun'?'8':weapon==='laser'?'4':'0.5',bullet_damage:String(num(o,'damage',12)),persistence:'2',firespread:weapon==='gun'?'1':'0',
        spawnflags:String(player?32:1),maxRange:'2048'};
      if(weapon==='gun'){props.bullet='2';props.spriteflash='sprites/muzzleflash1.spr';props.spritescale='0.6';}
      if(weapon==='mortar')props.iMagnitude=String(Math.max(50,num(o,'damage',12)*8));
      if(weapon==='laser'){props.laserentity=`${base}_laser`;ent(c,'env_laser',[0,-40,48],{targetname:`${base}_laser`,renderamt:'200',rendercolor:'255 40 40',width:'10',texture:'sprites/laserbeam.spr',damage:String(num(o,'damage',12)*5),spawnflags:'0'});}
      const tank=ent(c,cls,[0,0,48],props);
      box(c,'turret / body',[0,0,48],[24,24,16],c.texture,tank);box(c,'turret / barrel',[0,-24,48],[6,32,6],c.texture,tank);originBrush(c,tank,[0,0,48]);
      if(player){const ctl=ent(c,'func_tankcontrols',[0,28,40],{target:base});box(c,'turret / controls',[0,28,40],[32,24,64],'AAATRIGGER',ctl);}
      break;}
    case 'mortarField':{
      const w=num(o,'width',512),d=num(o,'depth',512),h=clamp(num(o,'height',512),32,8192),base=name(c,'mortar');
      trigger(c,'func_mortar_field',[0,0,h],[w,d,16],{targetname:base,m_flSpread:String(num(o,'spread',192)),m_iCount:String(num(o,'count',3)),m_fControl:'0'});
      if(flag(o,'button'))button(c,[0,-d/2-32,48],base,{wait:'5',sounds:'1'});
      break;}
    case 'teleporter':{
      const dist=clamp(num(o,'distance',512),64,65536),pad=clamp(num(o,'size',64),16,512),color=str(o,'color','90 200 255'),base=name(c,'teleport');
      const padAt=(y:number,dest:string,label:string)=>{
        box(c,`teleporter / ${label} pad`,[0,y,2],[pad,pad,4]);
        trigger(c,'trigger_teleport',[0,y,40],[pad-8,pad-8,72],{target:dest,teleport_cooldown:'1'});
        ent(c,'env_sprite',[0,y,24],{model:'sprites/glow01.spr',scale:String(pad/64),rendermode:'3',renderamt:'180',rendercolor:color,spawnflags:'1'});
        ent(c,'ambient_generic',[0,y,32],{message:'ambience/alien_powernode.wav',health:'5',playmode:'2',spawnflags:'2'});
      };
      padAt(0,`${base}_dest`,'start');
      ent(c,'info_teleport_destination',[0,dist,1],{targetname:`${base}_dest`,angles:'0 90 0'});
      if(flag(o,'twoWay')){padAt(dist+pad+96,`${base}_back`,'return');ent(c,'info_teleport_destination',[0,-pad-48,1],{targetname:`${base}_back`,angles:'0 270 0'});}
      break;}
    case 'securityCamera':{
      const n=clamp(Math.round(num(o,'cameras',2)),1,8),sp=clamp(num(o,'spacing',384),32,8192),h=clamp(num(o,'height',128),16,4096),hold=String(num(o,'hold',8)),base=name(c,'seccam');
      box(c,'security / console',[0,0,20],[Math.max(48,n*24+16),24,40]);
      for(let i=0;i<n;i++){
        const cam=`${base}_cam${i+1}`,x=(i-(n-1)/2)*sp,y=sp;
        button(c,[(i-(n-1)/2)*24,-14,44],cam,{sounds:'14',wait:'1'});
        box(c,'security / camera housing',[x,y,h+8],[12,20,10]);
        ent(c,'info_target',[x,y-sp*0.6,24],{targetname:`${cam}_look`});
        ent(c,'trigger_camera',[x,y-14,h],{targetname:cam,target:`${cam}_look`,wait:hold,spawnflags:'4',angles:'0 270 0'});
      }
      break;}    case 'changelevel':{
      const map=str(o,'map','mymap2').trim(),mode=str(o,'mode','touch'),w=clamp(num(o,'width',128),16,4096),d=clamp(num(o,'depth',64),16,4096);
      if(mode!=='end'&&!/^[\w-]{1,64}$/.test(map))throw Error('Enter a valid next map name (letters, numbers, - and _).');
      const base=name(c,'changelevel'),keep=flag(o,'keepInventory')?'1':'0',cd=clamp(num(o,'countdown',5),0,600);
      if(mode==='touch'){trigger(c,'trigger_changelevel',[0,0,64],[w,d,128],{map,keep_inventory:keep,percent_of_players:String(clamp(num(o,'percent',50),0,100))});break;}
      const mm=`${base}_mm`,txt=`${base}_text`;
      text(c,[24,0,24],txt,mode==='end'?`The end! (${cd}s)`:`Next map: ${map} (${cd}s)`,'255 220 120');
      if(mode==='end')ent(c,'game_end',[48,0,24],{targetname:base});
      else trigger(c,'trigger_changelevel',[0,0,64],[w,d,128],{targetname:base,map,keep_inventory:keep,spawnflags:'2'});
      ent(c,'multi_manager',[-24,0,24],{targetname:mm,[txt]:'0',[base]:String(cd)});
      button(c,[0,-d/2-24,48],mm,{wait:'-1',sounds:'3'});
      break;}    case 'storm':{
      const w=clamp(num(o,'width',1024),64,16384),h=clamp(num(o,'height',768),64,8192),base=name(c,'storm'),mm=`${base}_strike`;
      const bolts=3;const mmProps:Record<string,string>={targetname:mm};
      for(let i=0;i<bolts;i++){const a=i/bolts*Math.PI*2,x=Math.cos(a)*w*0.3,y=Math.sin(a)*w*0.3,bolt=`${base}_bolt${i+1}`;
        ent(c,'info_target',[x,y,h],{targetname:`${bolt}_sky`});ent(c,'info_target',[x*0.8,y*0.8,8],{targetname:`${bolt}_ground`});
        ent(c,'env_beam',[x,y,h-16],{targetname:bolt,LightningStart:`${bolt}_sky`,LightningEnd:`${bolt}_ground`,renderamt:'255',rendercolor:'200 210 255',Radius:'256',life:'0.4',BoltWidth:'40',NoiseAmplitude:'90',texture:'sprites/laserbeam.spr',TextureScroll:'35',StrikeTime:'0',damage:'0',spawnflags:'0'});
        mmProps[`${bolt}#${i}`]=String(i*0.35);}
      ent(c,'ambient_generic',[0,0,h/2],{targetname:`${base}_thunder`,message:'crystal2/thunder.wav',health:'10',playmode:'1',spawnflags:'49'});mmProps[`${base}_thunder`]='0.3';
      ent(c,'env_shake',[0,0,64],{targetname:`${base}_shake`,amplitude:'3',radius:String(w),duration:'1.2',frequency:'30',spawnflags:'1'});mmProps[`${base}_shake`]='0.35';
      if(flag(o,'flash')){ent(c,'light',[0,0,h*0.8],{targetname:`${base}_flash`,_light:'210 220 255 900',spawnflags:'1'});mmProps[`${base}_flash`]='0';mmProps[`${base}_flash#1`]='0.25';}
      ent(c,'multi_manager',[0,24,32],mmProps);
      const lo=clamp(num(o,'minDelay',6),1,600);timer(c,[0,48,32],`${base}_timer`,mm,lo,Math.max(lo,num(o,'maxDelay',16)),true);
      break;}
    case 'dayNight':{
      const base=name(c,'daynight'),period=clamp(num(o,'period',120),10,7200),mm=`${base}_cycle`,lamps=`${base}_lamps`;
      ent(c,'trigger_changesky',[0,0,32],{targetname:`${base}_day`,skyname:str(o,'daySky','desert'),spawnflags:'5'});
      ent(c,'trigger_changesky',[24,0,32],{targetname:`${base}_night`,skyname:str(o,'nightSky','night'),spawnflags:'5'});
      const n=clamp(Math.round(num(o,'lamps',4)),0,32);
      for(let i=0;i<n;i++)ent(c,'light',[(i-(n-1)/2)*128,96,96],{targetname:lamps,_light:'255 200 120 220',spawnflags:'1'});
      const mmProps:Record<string,string>={targetname:mm,[`${base}_day`]:'0',[`${base}_night`]:String(period/2)};if(n){mmProps[`${lamps}`]=String(period/2);mmProps[`${lamps}#1`]=String(period-0.1);}
      ent(c,'multi_manager',[48,0,32],mmProps);
      timer(c,[72,0,32],`${base}_timer`,mm,period,period,true);
      break;}
    case 'orderedLevers':{
      const n=clamp(Math.round(num(o,'levers',3)),2,16),sp=clamp(num(o,'spacing',96),16,2048),base=name(c,'levers');
      const doorName=`${base}_door`,ok=`${base}_ok`;
      for(let i=0;i<n;i++){const x=(i-(n-1)/2)*sp,last=i===n-1,next=last?(flag(o,'door')?doorName:ok):`${base}_ms${i+2}`;
        box(c,'lever / base',[x,8,40],[24,8,48]);
        const lever=ent(c,'func_button',[x,0,48],{target:next,master:i>0?`${base}_ms${i+1}`:'',wait:'-1',speed:'40',angles:'0 90 0',lip:'4',sounds:'14',locked_sound:'2',spawnflags:'0'});
        box(c,'lever / handle',[x,0,48],[8,6,24],c.texture,lever);
        if(i>0)ent(c,'multisource',[x,-24,16],{targetname:`${base}_ms${i+1}`});
        text(c,[x,-48,16],`${base}_step${i+1}`,`${i+1}/${n}`);}
      text(c,[0,-72,16],ok,'Correct order!');
      if(flag(o,'door'))buildDoor(c,{width:96,height:112,thickness:8,style:'sliding',open:'scripted',double:false,glass:false,frame:true,speed:100,wait:-1,movesnd:'5'},[0,-sp*1.5,0],doorName);
      break;}
    case 'pressurePlates':{
      const n=clamp(Math.round(num(o,'plates',2)),2,16),sp=clamp(num(o,'spacing',192),32,4096),sz=clamp(num(o,'size',64),16,512),base=name(c,'plates'),ms=`${base}_ms`;
      for(let i=0;i<n;i++){const x=(i-(n-1)/2)*sp;box(c,'plate',[x,0,2],[sz,sz,4]);
        trigger(c,'trigger_multiple',[x,0,40],[sz-8,sz-8,72],{target:ms,wait:'0',spawnflags:String(16|32)});
        ent(c,'env_sprite',[x,0,8],{model:'sprites/glow01.spr',scale:'0.3',rendermode:'3',renderamt:'150',rendercolor:'80 255 120',spawnflags:'1'});}
      const doorName=`${base}_door`;
      ent(c,'multisource',[0,-32,16],{targetname:ms,target:flag(o,'door')?doorName:`${base}_ok`});
      text(c,[24,-32,16],`${base}_ok`,'All plates pressed!');
      if(flag(o,'door'))buildDoor(c,{width:128,height:128,thickness:8,style:'sliding',open:'scripted',double:true,glass:false,frame:true,speed:80,wait:-1,movesnd:'6'},[0,-sp,0],doorName);
      break;}
    case 'timedDoor':{
      const secs=clamp(num(o,'seconds',8),1,300),dist=clamp(num(o,'distance',256),32,8192),base=name(c,'timed'),doorName=`${base}_door`,mm=`${base}_mm`;
      buildDoor(c,{width:96,height:112,thickness:8,style:'sliding',open:'scripted',double:false,glass:false,frame:true,speed:200,wait:secs,movesnd:'2'},[0,0,0],doorName);
      const mmProps:Record<string,string>={targetname:mm,[doorName]:'0'};
      const steps=Math.min(10,Math.floor(secs));for(let k=0;k<steps;k++){const left=secs-k;const tn=`${base}_t${left}`;text(c,[k*12-60,-96,16],tn,`${left}`,'255 120 80');mmProps[tn]=String(k);}
      if(flag(o,'alarm')){ent(c,'ambient_generic',[0,-32,96],{targetname:`${base}_alarm`,message:'ambience/siren.wav',health:'8',playmode:'2',spawnflags:'20'});mmProps[`${base}_alarm`]='0';mmProps[`${base}_alarm#1`]=String(secs);}
      ent(c,'multi_manager',[24,-96,16],mmProps);
      button(c,[0,-dist,48],mm,{wait:String(secs+1),sounds:'3'});
      break;}    case 'building':{
      const F=clamp(Math.round(num(o,'floors',2)),1,16),fh=clamp(num(o,'floorHeight',160),64,1024),W=clamp(num(o,'width',512),128,8192),D=clamp(num(o,'depth',384),128,8192),T=16;
      const nw=clamp(Math.round(num(o,'windows',3)),0,24),win=64,sill=48;
      // A wall from a to b along X (y fixed) or along Y (x fixed), with window/door holes.
      const wall=(axis:'x'|'y',fixed:number,a:number,b:number,z0:number,z1:number,holes:{c:number;w:number;lo:number;hi:number}[])=>{
        const sorted=[...holes].sort((p,q)=>p.c-q.c);let cur=a;
        const put=(s:number,e:number,lo:number,hi:number)=>{if(e-s<1||hi-lo<1)return;axis==='x'?box(c,'building / wall',[(s+e)/2,fixed,(lo+hi)/2],[e-s,T,hi-lo]):box(c,'building / wall',[fixed,(s+e)/2,(lo+hi)/2],[T,e-s,hi-lo]);};
        for(const h of sorted){put(cur,h.c-h.w/2,z0,z1);put(h.c-h.w/2,h.c+h.w/2,z0,h.lo);put(h.c-h.w/2,h.c+h.w/2,h.hi,z1);cur=h.c+h.w/2;}
        put(cur,b,z0,z1);};
      for(let f=0;f<F;f++){
        const z0=f*fh,z1=(f+1)*fh;
        const holes=(len:number,door:boolean)=>{const list:{c:number;w:number;lo:number;hi:number}[]=[];
          for(let k=0;k<nw;k++){const cc=-len/2+(k+1)*len/(nw+1);if(door&&Math.abs(cc)<80)continue;list.push({c:cc,w:win,lo:z0+sill,hi:z0+sill+win});}
          if(door)list.push({c:0,w:96,lo:z0,hi:z0+112});return list;};
        wall('x',-D/2+T/2,-W/2,W/2,z0,z1,holes(W,f===0));wall('x',D/2-T/2,-W/2,W/2,z0,z1,holes(W,false));
        wall('y',-W/2+T/2,-D/2+T,D/2-T,z0,z1,holes(D-2*T,false));wall('y',W/2-T/2,-D/2+T,D/2-T,z0,z1,holes(D-2*T,false));
        // Floor slab (with a stair hole above the stairs on upper floors).
        const stairW=64,stairL=Math.min(D-2*T-32,Math.ceil(fh/16)*24);
        if(f===0)box(c,'building / floor',[0,0,-4],[W,D,8]);
        else if(flag(o,'stairs')){const hx=-W/2+T+stairW;box(c,'building / slab',[(hx+W/2-T)/2,0,z0-4],[W/2-T-hx,D-2*T,8]);
          const y0=-D/2+T+stairL;box(c,'building / slab',[-W/2+T+stairW/2,(y0+D/2-T)/2,z0-4],[stairW,D/2-T-y0,8]);}
        else box(c,'building / slab',[0,0,z0-4],[W-2*T,D-2*T,8]);
        if(flag(o,'stairs')&&f<F-1){const steps=Math.ceil(fh/16),run=stairL/steps;
          for(let k=0;k<steps;k++){const top=z0+(k+1)*fh/steps;box(c,'building / step',[-W/2+T+stairW/2,-D/2+T+run*(k+.5),(z0+top)/2],[stairW,run,top-z0]);}}
        ent(c,'light',[0,0,z1-24],{_light:'255 240 220 220'});
      }
      const top=F*fh,roof=str(o,'roof','gable');
      box(c,'building / roof slab',[0,0,top+4],[W,D,8]);
      if(roof==='parapet'){for(const s of [-1,1]){box(c,'building / parapet',[0,s*(D/2-T/2),top+28],[W,T,40]);box(c,'building / parapet',[s*(W/2-T/2),0,top+28],[T,D-2*T,40]);}}
      if(roof==='gable'){const h=Math.min(D/2,Math.max(48,D*0.3)),e=16,ang=Math.atan2(h,D/2)*180/Math.PI,len=Math.hypot(D/2,h)+e;
        for(const s of [-1,1])prim(c,'box','building / roof',[0,s*(D/4),top+8+h/2],[W+2*e,len,8],c.texture,undefined,[s*ang,0,0]);
        for(const sx of [-1,1]){const steps=6;for(let k=0;k<steps;k++){const z=top+8+k*h/steps,wid=D*(1-(k+.5)/steps);box(c,'building / gable',[sx*(W/2-T/2),0,z+h/steps/2],[T,Math.max(8,wid),h/steps]);}}
      }
      break;}
    case 'roof':{
      const W=clamp(num(o,'width',384),32,8192),D=clamp(num(o,'depth',256),32,8192),h=clamp(num(o,'height',128),8,2048),e=clamp(num(o,'eave',16),0,256),type=str(o,'type','gable');
      if(type==='gable'){const ang=Math.atan2(h,D/2)*180/Math.PI,len=Math.hypot(D/2,h)+e;for(const s of [-1,1])prim(c,'box','roof / slope',[0,s*D/4,h/2],[W+2*e,len,8],c.texture,undefined,[s*ang,0,0]);
        for(const sx of [-1,1]){const steps=8;for(let k=0;k<steps;k++){const z=k*h/steps,wid=D*(1-(k+.5)/steps);box(c,'roof / gable end',[sx*(W/2-4),0,z+h/steps/2],[8,Math.max(4,wid),h/steps]);}}}
      else if(type==='hip')prim(c,'pyramid','roof / hip',[0,0,h/2],[W+2*e,D+2*e,h]);
      else if(type==='dome'){const r=Math.min(W,D)/2,steps=8;for(let k=0;k<steps;k++){const z0=k*h/steps,rr=r*Math.cos(Math.asin(Math.min(1,(k+.5)/steps)));prim(c,'cylinder','roof / dome ring',[0,0,z0+h/steps/2],[rr*2,rr*2,h/steps]);}}
      else box(c,'roof / flat',[0,0,4],[W+2*e,D+2*e,8]);
      break;}
    case 'columnGrid':{
      const nx=clamp(Math.round(num(o,'cols',4)),1,40),ny=clamp(Math.round(num(o,'rows',3)),1,40),sp=clamp(num(o,'spacing',256),16,8192),h=clamp(num(o,'height',256),16,8192),sz=clamp(num(o,'size',32),4,512);
      const x0=-(nx-1)*sp/2,y0=-(ny-1)*sp/2;
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const p:Vec3=[x0+i*sp,y0+j*sp,h/2];flag(o,'round')?prim(c,'cylinder','column',p,[sz,sz,h]):box(c,'column',p,[sz,sz,h]);}
      if(flag(o,'beams')){for(let j=0;j<ny;j++)box(c,'beam',[0,y0+j*sp,h+8],[(nx-1)*sp+sz,sz*.75,16]);for(let i=0;i<nx;i++)box(c,'beam',[x0+i*sp,0,h+24],[sz*.75,(ny-1)*sp+sz,16]);}
      if(flag(o,'slab'))box(c,'roof slab',[0,0,h+40],[(nx-1)*sp+sz*2,(ny-1)*sp+sz*2,16]);
      break;}
    case 'corridor':case 'vents':{
      const vent=id==='vents',s=vent?clamp(num(o,'size',48),24,256)+0:clamp(num(o,'width',128),32,1024),h=vent?s:clamp(num(o,'height',128),48,1024),T=vent?8:16;
      const cells=pathCells(str(o,'shape','L'),num(o,'length',1024),s);const list=cellList(cells);const has=(i:number,j:number)=>cells.has(`${i},${j}`);
      const tex=vent?'DUCT_WALL01':c.texture,floorTex=vent?'DUCT_FLR01':c.texture;
      const every=Math.round(num(o,'lightEvery',2));let k=0;
      const ends:[number,number,number,number][]=[];
      for(const [i,j] of list){const x=i*s,y=j*s;
        box(c,'corridor / floor',[x,y,-T/2],[s,s,T],floorTex);box(c,'corridor / ceiling',[x,y,h+T/2],[s,s,T],tex);
        for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]] as const){if(has(i+di,j+dj))continue;
          const nb=list.filter(([a,b])=>Math.abs(a-i)+Math.abs(b-j)===1).length;
          if(vent&&flag(o,'grates')&&nb===1&&!(has(i-di,j-dj)===false)){ends.push([x+di*(s/2+T/2),y+dj*(s/2+T/2),di,dj]);continue;}
          box(c,'corridor / wall',[x+di*(s/2+T/2),y+dj*(s/2+T/2),h/2],[di?T:s+2*T,dj?T:s+2*T,h+2*T],tex);}
        if(!vent&&every>0&&k++%every===0){box(c,'corridor / lamp',[x,y,h-2],[32,16,4],'+0~FIFTS_LGHT01');ent(c,'light',[x,y,h-16],{_light:'255 240 220 140'});}
      }
      for(const [x,y,di,dj] of ends){const g=ent(c,'func_breakable',[x,y,h/2],{material:'2',health:'20',rendermode:'4',renderamt:'255'});box(c,'vent / grate',[x,y,h/2],[di?4:s,dj?4:s,h],'{GRATE1',g);}
      break;}
    case 'fireEscape':{
      const F=clamp(Math.round(num(o,'floors',3)),1,20),fh=clamp(num(o,'floorHeight',160),64,1024),w=clamp(num(o,'width',64),32,512);
      if(o.kind==='ladder'){const h=F*fh;const l=ent(c,'func_ladder',[0,-8,h/2],{});box(c,'ladder / volume',[0,-8,h/2],[w,8,h],'AAATRIGGER',l);
        for(let z=16;z<h;z+=16)box(c,'ladder / rung',[0,-10,z],[w,2,2]);for(const s of [-1,1])box(c,'ladder / rail',[s*w/2,-10,h/2],[4,4,h]);break;}
      const steps=Math.ceil(fh/2/16),run=12*1.5;
      for(let f=0;f<F;f++){const z0=f*fh;
        for(let half=0;half<2;half++){const dir=half===0?1:-1,zb=z0+half*fh/2,startY=half===0?0:steps*run;
          for(let k=0;k<steps;k++){const top=zb+(k+1)*fh/2/steps;box(c,'stairs / step',[half===0?0:w+16,startY+dir*run*(k+.5),top-4],[w,run,8]);}
          const ly=half===0?steps*run+w/2:-w/2;box(c,'stairs / landing',[(w+16)/2,ly,zb+fh/2-4],[2*w+16,w,8]);
          box(c,'stairs / railing',[(w+16)/2,ly+(half===0?w/2:-w/2),zb+fh/2+18],[2*w+16,4,36]);}
        for(const s of [-1,1])box(c,'stairs / post',[s>0?2*w+16:-w/2,0,(f+.5)*fh],[6,6,fh]);}
      break;}
    case 'freightLift':{
      const floors=clamp(Math.round(num(o,'floors',2)),2,8),fh=clamp(num(o,'floorHeight',192),32,4096),w=clamp(num(o,'width',160),32,1024),d=clamp(num(o,'depth',160),32,1024);
      const base=name(c,'freight');
      const train=ent(c,'func_train',[0,0,4],{targetname:base,target:`${base}_up1`,speed:String(num(o,'speed',90))});
      box(c,'lift / platform',[0,0,4],[w,d,8],'GENERIC015V',train);
      for(const s of [-1,1]){box(c,'lift / railing',[s*(w/2-2),0,40],[4,d,4],c.texture,train);box(c,'lift / railing',[0,s*(d/2-2),40],[w,4,4],c.texture,train);}
      originBrush(c,train,[0,0,4]);train.props.__keepPosition='1';
      const stops:string[]=[];for(let f=0;f<floors;f++)stops.push(`${base}_up${f+1}`);for(let f=floors-2;f>=1;f--)stops.push(`${base}_down${f+1}`);
      const floorOf=(n:string)=>Number(n.replace(/^.*_(up|down)/,''))-1;
      stops.forEach((st,i)=>ent(c,'path_corner',[0,0,floorOf(st)*fh+4],{targetname:st,target:stops[(i+1)%stops.length],spawnflags:'1',wait:'0'}));
      const H=floors*fh;const g=w/2+12,gd=d/2+12;
      for(let x=-g;x<=g;x+=32)for(const s of [-1,1])if(!(s<0&&Math.abs(x)<64))box(c,'lift / cage bar',[x,s*gd,H/2],[4,4,H],'{BARS');
      for(let y=-gd;y<=gd;y+=32)for(const s of [-1,1])box(c,'lift / cage bar',[s*g,y,H/2],[4,4,H],'{BARS');
      for(let f=0;f<floors;f++)button(c,[g+20,-gd,f*fh+56],base,{wait:'2'});
      break;}
    case 'cave':{
      const s=clamp(num(o,'width',192),64,1024),h=clamp(num(o,'height',176),64,1024),rough=clamp(num(o,'roughness',24),0,128),rnd=seeded(num(o,'seed',7));
      const cells=pathCells(str(o,'shape','S'),num(o,'length',1536),s);const list=cellList(cells);const has=(i:number,j:number)=>cells.has(`${i},${j}`);
      const j=(a:number)=>(rnd()-.5)*2*a;
      for(const [i,k] of list){const x=i*s,y=k*s;
        prim(c,'box','cave / floor',[x+j(4),y+j(4),-12+j(rough*.2)],[s+24,s+24,24],c.texture,undefined,[j(rough*.15),j(rough*.15),j(30)]);
        prim(c,'box','cave / ceiling',[x,y,h+20+j(rough*.5)],[s+32,s+32,40],c.texture,undefined,[j(rough*.25),j(rough*.25),j(45)]);
        for(const [di,dk] of [[1,0],[-1,0],[0,1],[0,-1]] as const){if(has(i+di,k+dk))continue;
          for(let part=0;part<2;part++){const off=(part-.5)*s*.5;const cx=x+di*(s/2+20)+(dk?off:0)+j(rough*.4),cy=y+dk*(s/2+20)+(di?off:0)+j(rough*.4);
            prim(c,'box','cave / rock',[cx,cy,h/2+j(rough*.3)],[di?48+j(rough*.5):s*.6+24,dk?48+j(rough*.5):s*.6+24,h+48],c.texture,undefined,[j(rough*.3),j(rough*.3),j(40)]);}}}
      break;}
    case 'cliff':{
      const L=clamp(num(o,'length',768),64,16384),H=clamp(num(o,'height',384),32,8192),layers=clamp(Math.round(num(o,'layers',4)),1,24),rough=clamp(num(o,'roughness',32),0,256),rnd=seeded(num(o,'seed',3));
      const lh=H/layers,j=(a:number)=>(rnd()-.5)*2*a;
      for(let l=0;l<layers;l++){const inset=l*(24+rough*.4),n=Math.max(1,Math.round(L/128));
        for(let k=0;k<n;k++){const x=-L/2+(k+.5)*L/n;prim(c,'box','cliff / rock',[x+j(rough*.3),inset+j(rough*.3),l*lh+lh/2],[L/n+24+j(rough*.4),64+j(rough*.6),lh+16],c.texture,undefined,[j(rough*.12),j(rough*.12),j(18)]);}}
      break;}
    case 'river':{
      const s=clamp(num(o,'width',192),32,2048),dep=clamp(num(o,'depth',64),8,1024),tex=str(o,'texture','!WATERBLUE'),T=16;
      const cells=pathCells(str(o,'shape','S'),num(o,'length',1536),s);const list=cellList(cells);const has=(i:number,j:number)=>cells.has(`${i},${j}`);
      const water=ent(c,'func_water',[0,0,-dep/2],{skin:'-3',WaveHeight:'2',rendermode:'2',renderamt:'140'});
      for(const [i,j] of list){const x=i*s,y=j*s;box(c,'river / bed',[x,y,-dep-T-8],[s,s,T]);box(c,'river / water',[x,y,-dep/2-4],[s,s,dep-8],tex,water);
        for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]] as const){if(has(i+di,j+dj))continue;
          box(c,'river / bank',[x+di*(s/2+T/2),y+dj*(s/2+T/2),(-dep-8)/2],[di?T:s+2*T,dj?T:s+2*T,dep+8]);
          box(c,'river / ground',[x+di*(s/2+T+32),y+dj*(s/2+T+32),-T/2],[di?64:s+2*T+128,dj?64:s+2*T+128,T]);}}
      break;}
    case 'vegetation':{
      const kind=str(o,'kind','tree'),n=clamp(Math.round(num(o,'count',5)),1,128),r=clamp(num(o,'radius',256),0,8192),sz=clamp(num(o,'size',160),8,1024),fol=str(o,'foliage','{GRASS2'),rnd=seeded(num(o,'seed',5));
      const leaves=ent(c,'func_illusionary',[0,0,0],{rendermode:'4',renderamt:'255'});
      for(let k=0;k<n;k++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r,x=Math.cos(a)*d,y=Math.sin(a)*d,sc=.75+rnd()*.5,yaw=rnd()*90;
        if(kind==='tree'){const h=sz*sc;prim(c,'cylinder','tree / trunk',[x,y,h*.3],[12*sc,12*sc,h*.6]);
          for(const rot of [yaw,yaw+90])prim(c,'box','tree / leaves',[x,y,h*.7],[h*.7,2,h*.6],fol,leaves,[0,0,rot]);}
        else{const h=(kind==='bush'?sz*.4:sz*.2)*sc,w=kind==='bush'?sz*.5*sc:sz*.35*sc;for(const rot of [yaw,yaw+60,yaw+120])prim(c,'box',`${kind} / card`,[x,y,h/2],[w,2,h],fol,leaves,[0,0,rot]);}}
      break;}
    case 'rubble':{
      const n=clamp(Math.round(num(o,'count',18)),1,200),r=clamp(num(o,'radius',160),16,4096),walls=clamp(Math.round(num(o,'walls',2)),0,16),rnd=seeded(num(o,'seed',11));
      for(let k=0;k<n;k++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r,sz=8+rnd()*40;prim(c,'box','rubble / chunk',[Math.cos(a)*d,Math.sin(a)*d,sz*.35],[sz,sz*(.5+rnd()),sz*(.4+rnd()*.6)],c.texture,undefined,[(rnd()-.5)*50,(rnd()-.5)*50,rnd()*180]);}
      for(let k=0;k<walls;k++){const a=rnd()*Math.PI*2,d=rnd()*r*.6,h=48+rnd()*96;prim(c,'box','rubble / broken wall',[Math.cos(a)*d,Math.sin(a)*d,h/2-8],[96+rnd()*96,16,h],c.texture,undefined,[(rnd()-.5)*20,(rnd()-.5)*12,rnd()*180]);}
      if(walls)prim(c,'box','rubble / fallen beam',[0,0,24],[r*1.2,12,12],'GENERIC015V',undefined,[0,18,rnd()*180]);
      break;}
    case 'terrainRoad':{
      const s=clamp(num(o,'width',128),16,1024),th=clamp(num(o,'thickness',4),1,64);
      const cells=pathCells(str(o,'shape','S'),num(o,'length',1024),s);
      const yawR=c.yaw*Math.PI/180;
      for(const [i,j] of cellList(cells)){const x=i*s,y=j*s;
        const wx=c.origin[0]+x*Math.cos(yawR)-y*Math.sin(yawR),wy=c.origin[1]+x*Math.sin(yawR)+y*Math.cos(yawR);
        const fz=c.existing.length?floorAt(c.existing,wx,wy,c.origin[2]+512):null;const z=(fz??c.origin[2])-c.origin[2];
        box(c,'road / slab',[x,y,z+th/2],[s+2,s+2,th]);}
      break;}
    case 'furniture':{
      const kind=str(o,'kind','desk'),W=clamp(num(o,'width',96),8,1024),D=clamp(num(o,'depth',48),8,1024),H=clamp(num(o,'height',40),8,1024);
      const owner=flag(o,'solid')?ent(c,'func_wall',[0,0,H/2],{}):undefined;const b=(l:string,p:Vec3,sz:Vec3,t=c.texture)=>box(c,`${kind} / ${l}`,p,sz,t,owner);const leg=4;
      if(kind==='table'||kind==='desk'){b('top',[0,0,H-2],[W,D,4]);if(kind==='table')for(const sx of [-1,1])for(const sy of [-1,1])b('leg',[sx*(W/2-leg),sy*(D/2-leg),(H-4)/2],[leg,leg,H-4]);
        else{for(const sx of [-1,1])b('side',[sx*(W/2-2),0,(H-4)/2],[4,D,H-4]);b('drawers',[W/2-20,0,(H-4)/2],[32,D-8,H-12]);b('back',[0,D/2-2,(H-4)/2+4],[W-8,4,H-12]);}}
      else if(kind==='chair'){const seat=H*.45;b('seat',[0,0,seat],[W,D,4]);for(const sx of [-1,1])for(const sy of [-1,1])b('leg',[sx*(W/2-3),sy*(D/2-3),seat/2],[3,3,seat]);b('back',[0,D/2-2,seat+(H-seat)/2],[W,3,H-seat]);}
      else if(kind==='shelf'){for(const sx of [-1,1])b('side',[sx*(W/2-2),0,H/2],[4,D,H]);b('back',[0,D/2-1,H/2],[W-8,2,H]);const n=Math.max(2,Math.round(H/32));for(let k=0;k<=n;k++)b('board',[0,0,Math.min(H-2,k*H/n+2)],[W-8,D-2,4]);}
      else if(kind==='bed'){b('base',[0,0,8],[W,D,16]);b('mattress',[0,0,20],[W-8,D-8,8],'C1A0_LABW1');b('headboard',[0,D/2-3,H/2],[W,6,H]);}
      else{b('body',[0,0,H/2],[W,D,H]);for(const sx of kind==='locker'?[0]:[-1,1])b('door',[sx*W/4,-D/2-1,H/2],[kind==='locker'?W-6:W/2-4,2,H-6],'GENERIC015V');
        if(kind==='locker')for(let k=0;k<3;k++)b('vent',[0,-D/2-2,H-16-k*6],[W*.5,1,2],'C1A0_LABW4');}
      break;}
    case 'labRoom':{
      const W=clamp(num(o,'width',512),128,4096),D=clamp(num(o,'depth',384),128,4096),rnd=seeded(num(o,'seed',2)),bench=40;
      box(c,'lab / bench',[-W/2+bench/2+8,0,20],[bench,D-160,40]);box(c,'lab / bench',[0,D/2-bench/2-8,20],[W-160,bench,40]);box(c,'lab / bench',[W/2-bench/2-8,0,20],[bench,D-160,40]);
      const n=clamp(Math.round(num(o,'consoles',3)),0,24);
      for(let k=0;k<n;k++){const x=-W/2+120+k*(W-240)/Math.max(1,n-1||1);box(c,'lab / console',[x,D/2-bench-24,28],[48,24,56],'+0LAB1_COMP9A');
        ent(c,'env_sprite',[x,D/2-bench-38,48],{model:'sprites/glow01.spr',scale:'0.15',rendermode:'3',renderamt:'120',rendercolor:'80 200 255',spawnflags:'1'});}
      for(let k=0;k<Math.max(2,n);k++){const x=(rnd()-.5)*(W-200),y=(rnd()-.5)*(D-200);prim(c,'cylinder','lab / stool seat',[x,y,24],[20,20,4]);prim(c,'cylinder','lab / stool leg',[x,y,11],[4,4,22]);}
      ent(c,'light',[0,0,120],{_light:'230 240 255 260'});
      break;}
    case 'pipes':{
      const d=clamp(num(o,'diameter',16),2,256),z=clamp(num(o,'height',96),0,4096),seg=Math.max(64,d*4);
      const cells=pathCells(str(o,'shape','L'),num(o,'length',768),seg);const list=cellList(cells);const has=(i:number,j:number)=>cells.has(`${i},${j}`);
      const every=Math.round(num(o,'valves',3));let k=0;
      for(const [i,j] of list){const x=i*seg,y=j*seg;
        const ex=has(i+1,j)||has(i-1,j),ey=has(i,j+1)||has(i,j-1);
        if(has(i+1,j))prim(c,'cylinder','pipe',[x+seg/2,y,z],[d,d,seg],'C1A0_LABW4',undefined,[0,90,0]);
        if(has(i,j+1))prim(c,'cylinder','pipe',[x,y+seg/2,z],[d,d,seg],'C1A0_LABW4',undefined,[90,0,0]);
        if(ex&&ey)prim(c,'cylinder','pipe / elbow',[x,y,z],[d*1.3,d*1.3,d*1.3],'C1A0_LABW4');
        if(every>0&&k++%every===1){prim(c,'cylinder','pipe / valve wheel',[x,y,z+d],[d*1.6,d*1.6,3],'GENERIC015V');prim(c,'box','pipe / valve stem',[x,y,z+d/2],[3,3,d],'GENERIC015V');}
        if(flag(o,'supports')&&z>d&&k%2===0)box(c,'pipe / support',[x,y,(z-d/2)/2],[6,6,Math.max(2,z-d/2)]);}
      break;}
    case 'trims':{
      const W=clamp(num(o,'width',512),32,16384),D=clamp(num(o,'depth',384),32,16384),H=clamp(num(o,'height',160),16,4096),t=clamp(num(o,'size',8),1,64);
      for(const [z,label] of [[t/2,'baseboard'],...(flag(o,'crown')?[[H-t/2,'crown moulding']]:[])] as [number,string][]){
        for(const s of [-1,1]){box(c,`trim / ${label}`,[0,s*(D/2-t/4),z],[W,t/2,t]);box(c,`trim / ${label}`,[s*(W/2-t/4),0,z],[t/2,D-t,t]);}}
      break;}
    case 'fence':{
      const H=clamp(num(o,'height',96),8,2048),kind=str(o,'kind','chainlink'),seg=64;
      const cells=pathCells(str(o,'shape','straight'),num(o,'length',512),seg);const list=cellList(cells);const has=(i:number,j:number)=>cells.has(`${i},${j}`);
      const panelTex=kind==='chainlink'?'{FENCE':kind==='bars'?'{BARS':'{GRATE1';
      const see=kind==='railing'?undefined:ent(c,'func_wall',[0,0,H/2],{rendermode:'4',renderamt:'255'});
      for(const [i,j] of list){const x=i*seg,y=j*seg;box(c,'fence / post',[x,y,H/2],[4,4,H],'GENERIC015V');
        for(const [di,dj] of [[1,0],[0,1]] as const){if(!has(i+di,j+dj))continue;const cx=x+di*seg/2,cy=y+dj*seg/2;
          if(kind==='railing'){for(const zz of [H-4,H*.5])box(c,'railing / rail',[cx,cy,zz],[di?seg:4,dj?seg:4,4],'GENERIC015V');}
          else box(c,'fence / panel',[cx,cy,H/2],[di?seg-4:2,dj?seg-4:2,H-4],panelTex,see);}}
      break;}
    case 'signage':{
      const kind=str(o,'kind','exit'),sz=clamp(num(o,'size',48),8,512),tex=str(o,'texture','+0EXIT');
      if(kind==='arrow'){box(c,'arrow / shaft',[0,-sz*.2,1],[sz*.25,sz*.8,2],tex);for(const s of [-1,1])prim(c,'box','arrow / head',[s*sz*.15,sz*.25,1],[sz*.25,sz*.45,2],tex,undefined,[0,0,s*40]);}
      else{box(c,'sign',[0,0,kind==='exit'?sz*2.5:sz*1.5],[sz,4,kind==='exit'?sz*.5:sz],tex);if(kind==='exit')ent(c,'light',[0,-24,sz*2.5],{_light:'255 60 40 60'});}
      break;}
    case 'combatArena':{
      const S=clamp(num(o,'size',1024),128,8192),n=clamp(Math.round(num(o,'covers',10)),0,80),rnd=seeded(num(o,'seed',4)),base=name(c,'arena');
      for(let k=0;k<n;k++){const x=(rnd()-.5)*S*.75,y=(rnd()-.5)*S*.75,tall=rnd()<.4,w=48+rnd()*96;box(c,'arena / cover',[x,y,(tall?96:48)/2],[rnd()<.5?w:16,rnd()<.5?16:w,tall?96:48],tall?'C1A0_LABW4':'BCRATE02');}
      const makers=clamp(Math.round(num(o,'makers',2)),0,16);
      for(let k=0;k<makers;k++){const a=k/Math.max(1,makers)*Math.PI*2;ent(c,'monstermaker',[Math.cos(a)*S*.4,Math.sin(a)*S*.4,8],{targetname:`${base}_makers`,monstertype:str(o,'monster','monster_human_grunt'),monstercount:'4',m_imaxlivechildren:'2',delay:'3'});}
      if(makers)trigger(c,'trigger_once',[0,-S/2+48,64],[256,64,128],{target:`${base}_makers`});
      const sx=-S/2+64,sy=-S/2+64;['weapon_9mmAR','weapon_shotgun','ammo_9mmAR','ammo_buckshot','item_healthkit','item_battery'].forEach((cl,k)=>ent(c,cl,[sx+(k%3)*40,sy+Math.floor(k/3)*40,16],{}));
      break;}
    case 'sniperNest':{
      const H=clamp(num(o,'height',256),48,4096),S=clamp(num(o,'size',128),48,1024);
      for(const sx of [-1,1])for(const sy of [-1,1])box(c,'tower / leg',[sx*(S/2-6),sy*(S/2-6),H/2],[12,12,H]);
      box(c,'tower / platform',[0,0,H+4],[S,S,8]);for(const s of [-1,1]){box(c,'tower / rail',[0,s*(S/2-2),H+28],[S,4,40]);box(c,'tower / rail',[s*(S/2-2),0,H+28],[4,S,40]);}
      const l=ent(c,'func_ladder',[0,-S/2-6,H/2],{});box(c,'tower / ladder',[0,-S/2-6,H/2+8],[32,8,H+16],'AAATRIGGER',l);for(let z=16;z<H;z+=16)box(c,'tower / rung',[0,-S/2-8,z],[32,2,2]);
      ent(c,'weapon_sniperrifle',[0,0,H+16],{});ent(c,'ammo_762',[20,0,H+16],{});ent(c,'ammo_762',[-20,0,H+16],{});
      break;}
    case 'trap':{
      const kind=str(o,'kind','crusher'),W=clamp(num(o,'width',128),16,4096),D=clamp(num(o,'depth',128),16,4096),H=clamp(num(o,'height',192),32,4096),iv=clamp(num(o,'interval',3),.2,600),dmg=String(num(o,'damage',200)),base=name(c,`trap_${kind}`);
      if(kind==='spikes'){const n=Math.max(1,Math.round(W/32)),m=Math.max(1,Math.round(D/32));for(let i=0;i<n;i++)for(let j=0;j<m;j++)prim(c,'pyramid','spike',[-W/2+(i+.5)*W/n,-D/2+(j+.5)*D/m,12],[20,20,24],'GENERIC015V');
        trigger(c,'trigger_hurt',[0,0,24],[W,D,40],{dmg,damagetype:'4'});}
      else if(kind==='crusher'){const cr=ent(c,'func_door',[0,0,H-24],{targetname:base,angle:'-2',speed:'300',wait:'0.5',lip:'4',dmg,spawnflags:'32',movesnd:'5',stopsnd:'4'});box(c,'crusher / block',[0,0,H-24],[W,D,48],'C1A0_LABW4',cr);timer(c,[0,0,H-64],`${base}_timer`,base,iv,iv,true);}
      else if(kind==='flame'){box(c,'flame / nozzle',[0,0,16],[24,24,32],'GENERIC015V');ent(c,'env_sprite',[0,0,64],{targetname:base,model:'sprites/fire.spr',scale:'1.5',rendermode:'5',renderamt:'255',framerate:'15',spawnflags:'0'});
        trigger(c,'trigger_hurt',[0,0,72],[64,64,96],{targetname:base,dmg:String(Math.max(5,Number(dmg)/10)),damagetype:'8',spawnflags:'2'});ent(c,'ambient_generic',[0,0,48],{targetname:base,message:'ambience/flameburst1.wav',health:'8',playmode:'2',spawnflags:'18'});timer(c,[24,0,16],`${base}_timer`,base,iv,iv,true);}
      else if(kind==='lasers'){for(let k=0;k<4;k++){const z=20+k*20,y=-D/2+(k+.5)*D/4;ent(c,'env_laser',[-W/2,y,z],{targetname:base,LaserTarget:`${base}_t${k}`,renderamt:'200',rendercolor:'255 0 0',width:'8',damage:dmg,texture:'sprites/laserbeam.spr',spawnflags:'1'});ent(c,'info_target',[W/2,y,z],{targetname:`${base}_t${k}`});}timer(c,[0,0,16],`${base}_timer`,base,iv,iv,true);}
      else{const fl=ent(c,'func_breakable',[0,0,-4],{targetname:base,material:'1',health:'1',spawnflags:'1'});box(c,'collapse / floor',[0,0,-4],[W,D,8],'BCRATE02',fl);trigger(c,'trigger_once',[0,0,40],[W-16,D-16,64],{target:base,delay:'0.6'});box(c,'collapse / pit',[0,0,-H/2-8],[W+32,D+32,8]);}
      break;}
    case 'hoverPlatform':{
      const L=clamp(num(o,'length',512),0,16384),Wd=clamp(num(o,'width',256),0,16384),S=clamp(num(o,'size',128),16,1024),base=name(c,'platform');
      const t=ent(c,'func_train',[0,0,4],{targetname:'',target:`${base}_p1`,speed:String(num(o,'speed',100))});box(c,'platform',[0,0,4],[S,S,8],'GENERIC015V',t);originBrush(c,t,[0,0,4]);t.props.__keepPosition='1';
      const pts:[number,number][]=Wd>0?[[0,0],[0,L],[Wd,L],[Wd,0]]:[[0,0],[0,L]];
      pts.forEach(([x,y],k)=>ent(c,'path_corner',[x,y,4],{targetname:`${base}_p${k+1}`,target:`${base}_p${(k+1)%pts.length+1}`,wait:String(num(o,'wait',1))}));
      break;}
    case 'lightRow':{
      const sp=clamp(num(o,'spacing',192),16,4096),z=clamp(num(o,'height',160),16,8192),tex=str(o,'texture','+0~FIFTS_LGHT01'),br=clamp(num(o,'brightness',220),1,5000);
      const cells=pathCells(str(o,'shape','straight'),num(o,'length',768),sp);
      for(const [i,j] of cellList(cells)){const x=i*sp,y=j*sp;box(c,'lamp',[x,y,z-2],[48,16,4],tex);ent(c,'light',[x,y,z-20],{_light:`255 240 220 ${br}`});}
      break;}
    case 'windowLight':{
      const w=clamp(num(o,'width',128),16,2048),h=clamp(num(o,'height',96),16,2048),sill=clamp(num(o,'sill',48),0,2048),f=8;
      box(c,'window / sill',[0,0,sill-f/2],[w+2*f,16,f]);box(c,'window / header',[0,0,sill+h+f/2],[w+2*f,16,f]);for(const s of [-1,1])box(c,'window / jamb',[s*(w/2+f/2),0,sill+h/2],[f,16,h]);
      const g=ent(c,'func_illusionary',[0,0,sill+h/2],{rendermode:'2',renderamt:'70'});box(c,'window / glass',[0,0,sill+h/2],[w,2,h],'GLASS_BRIGHT',g);
      ent(c,'light_spot',[0,-24,sill+h],{_light:'255 245 220 600',_cone:'35',_cone2:'60',angles:'-40 270 0',pitch:'-40'});
      if(flag(o,'beam')){const b=ent(c,'func_illusionary',[0,-96,sill],{rendermode:'5',renderamt:'25'});prim(c,'box','window / light beam',[0,-96,sill+h/2-48],[w,160,h],'GLASS_BRIGHT',b,[-35,0,0]);}
      break;}
    case 'fireZone':{
      const n=clamp(Math.round(num(o,'count',5)),1,64),r=clamp(num(o,'radius',192),0,8192),rnd=seeded(num(o,'seed',9)),base=name(c,'fires');
      for(let k=0;k<n;k++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r,x=Math.cos(a)*d,y=Math.sin(a)*d,s=.6+rnd()*.9;
        ent(c,'env_sprite',[x,y,24*s],{model:'sprites/fire.spr',scale:String(s.toFixed(2)),rendermode:'5',renderamt:'255',framerate:'15',spawnflags:'1'});
        if(k%2===0)ent(c,'light',[x,y,48],{_light:'255 140 40 140',style:'6'});
        if(flag(o,'hurt'))trigger(c,'trigger_hurt',[x,y,24*s],[40*s,40*s,48*s],{dmg:'6',damagetype:'8'});}
      ent(c,'ambient_generic',[0,0,48],{targetname:`${base}_sound`,message:'ambience/burning1.wav',health:'8',playmode:'2',spawnflags:'4'});
      break;}
    case 'soundscape':{
      const presets:Record<string,{loop:string;room:string;shots:string[]}>={
        cave:{loop:'ambience/aliencave1.wav',room:'24',shots:['ambience/water1.wav','ambience/waterrun.wav','ambience/sandfall2.wav','ambience/squeeks1.wav']},
        industrial:{loop:'ambience/industrial1.wav',room:'18',shots:['ambience/steamburst1.wav','ambience/hammer.wav','doors/doorstop5.wav','ambience/loader_step1.wav']},
        outdoor:{loop:'ambience/wind1.wav',room:'0',shots:['ambience/hawk1.wav','ambience/wren1.wav','crystal2/thunder.wav','ambience/wind2.wav']},
        office:{loop:'ambience/computalk1.wav',room:'2',shots:['buttons/blip1.wav','ambience/sparks.wav','ambience/fluorescent.wav','buttons/button3.wav']},
        alien:{loop:'ambience/alien_hollow.wav',room:'26',shots:['ambience/alien_creeper.wav','ambience/alien_powernode.wav','ambience/alien_squit.wav','ambience/alien_purrmachine.wav']},
      };
      const p=presets[str(o,'preset','cave')]??presets.cave,r=clamp(num(o,'radius',512),32,8192),base=name(c,'soundscape');
      ent(c,'ambient_generic',[0,0,64],{targetname:`${base}_loop`,message:p.loop,health:'6',playmode:'2',spawnflags:r>700?'8':'4'});
      ent(c,'env_sound',[0,24,64],{radius:String(Math.round(r)),roomtype:p.room});
      const n=clamp(Math.round(num(o,'oneShots',3)),0,8);
      if(n){
        const rnd:Record<string,string>={targetname:`${base}_random`,target_count:String(n),min_delay:'4',max_delay:'12',spawnflags:'9'};
        for(let i=0;i<n;i++){const a=i/n*Math.PI*2,shot=`${base}_shot${i+1}`;rnd[`target${i+1}`]=shot;
          ent(c,'ambient_generic',[Math.cos(a)*r*0.6,Math.sin(a)*r*0.6,64],{targetname:shot,message:p.shots[i%p.shots.length],health:'7',playmode:'1',spawnflags:'48'});}
        ent(c,'trigger_random',[0,-24,64],rnd);
      }
      break;}
  }
}

export type KitBuild={objects:MapObject[];summary:{brushes:number;entities:number;classnames:string[]}};
/** Builds a kit at `origin`; `existing` is used only to keep every targetname unique. */
export function buildKit(id:KitId,options:KitOptions,origin:Vec3,existing:readonly MapObject[],texture='SV_BRICK01'):KitBuild{
  const def=kitDefinition(id);if(!def)throw Error(`Unknown kit ${id}.`);
  const o={...def.defaults,...options};
  const yaw=((Math.round(num(o,'yaw',0)/90)*90)%360+360)%360;
  const c=newCtx(existing,texture||'SV_BRICK01',`Kit ${def.title} ${Math.random().toString(36).slice(2,7)}`,yaw,origin);
  build(c,id,o);
  const objects=finish(c,origin);
  const ents=objects.filter((x):x is PointEntity=>x.kind==='entity');
  return {objects,summary:{brushes:objects.length-ents.length,entities:ents.length,classnames:[...new Set(ents.map(e=>e.classname))].sort()}};
}
/** Brushes for previews: real brushes plus a small marker cube for every point entity. */
export function kitPreviewBrushes(objects:readonly MapObject[]):Brush[]{
  const owners=new Set(objects.filter((o):o is Brush=>o.kind==='brush').map(b=>b.entityId).filter(Boolean));
  const out:Brush[]=[];
  // Point-entity markers grow with the spread of the kit so emitter-only kits (rain, sounds) stay visible.
  const pts=objects.filter(o=>o.kind!=='brush'&&!owners.has(o.id)).map(o=>o.position);
  let extent=0;for(const a of pts)for(const b of pts)extent=Math.max(extent,Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));
  const size=Math.round(Math.min(40,Math.max(12,extent/20)));
  for(const o of objects){
    if(o.kind==='brush'){out.push(o);continue;}
    if(owners.has(o.id))continue;
    const b=createBrush('box',[...o.position],[size,size,size],o.classname);b.faces.forEach(f=>f.texture='NULL');out.push(b);
  }
  return out;
}
