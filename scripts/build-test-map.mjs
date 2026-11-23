// Builds svenstudio_test.map: a 12-room Sven Co-op test map made with SvenStudio's own kits and
// stock Sven Co-op assets (halflife.wad, sprites, sounds, models). Usage:
//   runtime\node.exe --experimental-transform-types --no-warnings --experimental-loader ./scripts/bsp-test-resolver.mjs scripts/build-test-map.mjs <outDir> <svencoopDir>
import fs from 'node:fs';
import path from 'node:path';
import {createBrush} from '../src/engine/geometry.ts';
import {buildKit} from '../src/engine/svenKits.ts';
import {exportMap,validateProject} from '../src/engine/exportMap.ts';

const [,,outDir='release/testmap',gameDir='C:/Program Files (x86)/Steam/steamapps/common/Sven Co-op/svencoop']=process.argv;
const NAME='svenstudio_test';
const C=1024,H=384,T=16,COLS=4,ROWS=3,DOOR=176;
const objects=[];let n=0;
const id=()=>`t${++n}`;
const box=(min,max,tex,extra={})=>{const center=min.map((v,i)=>(v+max[i])/2),size=max.map((v,i)=>v-min[i]);const b=createBrush('box',center,size,extra.name||'block');b.id=id();b.faces.forEach(f=>f.texture=tex);b.layer=extra.layer||'Test map';objects.push(b);return b;};
const ent=(classname,pos,props={})=>{const e={id:id(),kind:'entity',name:classname,classname,position:[...pos],props:{...props},layer:'Test map'};objects.push(e);return e;};
// buildKit returns fresh uids already; keep them (unique) instead of renaming.
const addKit=(kid,opts,at,tex='C1A0_LABW2')=>{const r=buildKit(kid,opts,at,objects,tex);objects.push(...r.objects);return r;};
const cellMin=(c,r)=>[c*C,r*C];const cellCenter=(c,r)=>[c*C+C/2,r*C+C/2];
const outdoor=new Set(['0,2','1,2']);
const ZONES=[['Hub / weapons','Lights','Doors','NPCs'],['Puzzles','Effects','Water','Mechanisms'],['Outdoor: rain & storm','Outdoor: snow','Props & turrets','Teleport & exit']];

// ---- Shell: floors, ceilings (sky outdoors), outer walls, partition walls with doorways ----
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
  const [x,y]=cellMin(c,r);const out=outdoor.has(`${c},${r}`);
  const floorTex=out?(c===1?'FROSTFLOOR':'OUT_DIRT1'):(r===1&&c===2?'C1A0_LABFLRB':'C1A0_LABFLR');
  box([x,y,-T],[x+C,y+C,0],floorTex);
  box([x,y,H],[x+C,y+C,H+T],out?'SKY':'CRETE3_CEIL01');
}
const W=COLS*C,D=ROWS*C;
box([-T,-T,-T],[0,D+T,H+T],'C1A0_LABW1');box([W,-T,-T],[W+T,D+T,H+T],'C1A0_LABW1');
box([0,-T,-T],[W,0,H+T],'C1A0_LABW1');box([0,D,-T],[W,D+T,H+T],'C1A0_LABW1');
// Vertical partitions (x = const) with a doorway in the middle of every cell side.
const wallWithDoor=(axis,at,from,to,tex)=>{const mid=(from+to)/2,a=mid-DOOR/2,b=mid+DOOR/2;
  const seg=(s,e)=>axis==='x'?box([at-T/2,s,0],[at+T/2,e,H],tex):box([s,at-T/2,0],[e,at+T/2,H],tex);
  seg(from,a);seg(b,to);axis==='x'?box([at-T/2,a,DOOR],[at+T/2,b,H],tex):box([a,at-T/2,DOOR],[b,at+T/2,H],tex);};
for(let c=1;c<COLS;c++)for(let r=0;r<ROWS;r++)wallWithDoor('x',c*C,r*C,(r+1)*C,'C1A0_LABW4');
for(let r=1;r<ROWS;r++)for(let c=0;c<COLS;c++)wallWithDoor('y',r*C,c*C,(c+1)*C,'C1A0_LABW4');

// ---- Lighting: one ceiling light per indoor room, sun outdoors ----
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const [cx,cy]=cellCenter(c,r);
  if(!outdoor.has(`${c},${r}`)){ent('light',[cx,cy,H-24],{_light:'255 245 225 380'});ent('light',[cx-300,cy-300,H-24],{_light:'255 245 225 160'});ent('light',[cx+300,cy+300,H-24],{_light:'255 245 225 160'});}
  // Room name on a wall-mounted text when entering.
  ent('env_sprite',[cx,cy,H-8],{model:'sprites/glow01.spr',scale:'0.15',rendermode:'3',renderamt:'120',spawnflags:'1'});
}
ent('light_environment',[C/2,2*C+C/2,H-40],{_light:'255 240 210 220',angles:'-60 45 0',pitch:'-60',_diffuse_light:'120 140 170 80'});

// ---- 0,0 Hub: spawns, all weapons, ammo, items, welcome text, music ----
{const [x,y]=cellMin(0,0);
  for(let i=0;i<8;i++){const p=[x+200+(i%4)*96,y+200+Math.floor(i/4)*96,37];ent(i<2?'info_player_start':'info_player_deathmatch',p,{angles:'0 45 0'});}
  const weapons=['weapon_crowbar','weapon_pipewrench','weapon_medkit','weapon_9mmhandgun','weapon_357','weapon_eagle','weapon_uzi','weapon_9mmAR','weapon_shotgun','weapon_crossbow','weapon_m16','weapon_m249','weapon_sniperrifle','weapon_rpg','weapon_gauss','weapon_egon','weapon_hornetgun','weapon_handgrenade','weapon_satchel','weapon_tripmine','weapon_snark','weapon_sporelauncher','weapon_displacer','weapon_minigun','weapon_shockrifle','weapon_grapple'];
  weapons.forEach((w,i)=>ent(w,[x+120+(i%9)*90,y+C-260+Math.floor(i/9)*80,16],{angles:'0 270 0'}));
  const ammo=['ammo_9mmclip','ammo_9mmAR','ammo_ARgrenades','ammo_buckshot','ammo_357','ammo_crossbow','ammo_rpgclip','ammo_gaussclip','ammo_556','ammo_762','ammo_sporeclip','ammo_uziclip'];
  ammo.forEach((a,i)=>ent(a,[x+C-120,y+140+i*56,16]));
  ['item_battery','item_battery','item_healthkit','item_healthkit','item_longjump','item_airtank'].forEach((it,i)=>ent(it,[x+C-240,y+140+i*70,16]));
  ent('trigger_auto',[x+64,y+64,32],{target:'welcome_mm',triggerstate:'1'});
  ent('multi_manager',[x+96,y+64,32],{targetname:'welcome_mm',welcome_text:'2',music:'1'});
  ent('game_text',[x+128,y+64,32],{targetname:'welcome_text',message:'SvenStudio 3D test map\\nEvery room tests a different system.\\nFollow the doorways!',x:'-1',y:'0.25',effect:'2',color:'100 220 255',color2:'255 255 255',fadein:'0.03',fadeout:'1',holdtime:'6',fxtime:'0.25',channel:'1',spawnflags:'1'});
  ent('ambient_music',[x+160,y+64,32],{targetname:'music',message:'media/Half-Life01.mp3',volume:'7',spawnflags:'1'});
  ent('infodecal',[x+4,y+C/2,96],{texture:'{lambda01'});
  addKit('soundscape',{preset:'office',radius:480,oneShots:2},[x+C/2,y+C/2,0]);
}
// ---- 1,0 Lights: styles, spots, texture light, beacon, flame ----
{const [x,y]=cellMin(1,0);
  const styles=[['1','Flicker A'],['10','Fluorescent'],['2','Slow pulse'],['4','Fast strobe'],['6','Flicker B'],['5','Gentle pulse']];
  styles.forEach(([st],i)=>{const p=[x+150+i*140,y+160,200];ent('light',p,{_light:['255 80 80','80 255 80','80 120 255','255 255 120','255 140 40','200 80 255'][i]+' 260',style:st});ent('env_glow',[p[0],p[1],p[2]+40],{model:'sprites/glow01.spr',scale:'0.4',rendermode:'3',renderamt:'180',rendercolor:'255 255 255'});});
  ent('light_spot',[x+C/2,y+C-200,H-40],{_light:'120 200 255 900',_cone:'25',_cone2:'40',angles:'-90 0 0',pitch:'-90'});
  ent('light',[x+200,y+C-200,64],{targetname:'switch_lamp',_light:'255 220 120 300',spawnflags:'1'});
  const b=ent('func_button',[x+120,y+C-140,56],{target:'switch_lamp',wait:'1',sounds:'14',angles:'0 0 0'});box([x+104,y+C-148,48],[x+108,y+C-132,64],'C1A0_LABW2').entityId=b.id;
  box([x+C/2-64,y+C/2-64,H-4],[x+C/2+64,y+C/2+64,H],'+0~C2A4_LGT1');
  addKit('rotatingLight',{color:'255 40 20',speed:240,startOn:true,sound:true},[x+C-200,y+C/2,0]);
  addKit('flame',{scale:1.2,hurt:false,sound:true,light:true},[x+C/2,y+C/2+150,0]);
  addKit('sparks',{maxDelay:1.5,startOn:true},[x+C/2+200,y+C/2,0]);
}
// ---- 2,0 Doors: every opening mode ----
{const [x,y]=cellMin(2,0);
  const doors=[['proximity',{}],['button',{double:true}],['handle',{style:'rotating'}],['use',{glass:true}],['locked',{}],['key',{keyName:'key_red',keyLabel:'Red key',keyDistance:160}],['npcOnly',{}]];
  doors.forEach(([open,extra],i)=>addKit(open==='key'?'keyDoor':'door',{width:72,height:112,open,...extra,yaw:'0'},[x+120+i*130,y+C/2+120,0],'LAB1_DOOR1'));
}
// ---- 3,0 NPCs: allies, retina scanner, monster maker behind a button ----
{const [x,y]=cellMin(3,0);
  ent('monster_barney',[x+200,y+200,0],{angles:'0 45 0'});ent('monster_scientist',[x+300,y+200,0],{angles:'0 90 0'});
  addKit('retinaScanner',{npc:'monster_scientist',width:72,height:112,npcDistance:200},[x+C/2,y+C-180,0],'C1A0_LABW2');
  ent('monstermaker',[x+C-200,y+260,8],{targetname:'zombie_maker',monstertype:'monster_headcrab',monstercount:'3',delay:'2',m_imaxlivechildren:'2'});
  const b=ent('func_button',[x+C-120,y+120,56],{target:'zombie_maker',wait:'3',sounds:'1',angles:'0 0 0'});box([x+C-128,y+112,48],[x+C-112,y+128,64],'C1A0_LABW2').entityId=b.id;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)ent('info_node',[x+180+i*200,y+180+j*200,16],{});
}
// ---- 0,1 Puzzles ----
{const [x,y]=cellMin(0,1);
  addKit('orderedLevers',{levers:3,spacing:96,door:false},[x+250,y+200,0]);
  addKit('pressurePlates',{plates:2,spacing:200,size:64,door:false},[x+C-300,y+200,0]);
  addKit('timedDoor',{seconds:6,distance:200,alarm:true},[x+250,y+C-200,0],'LAB1_DOOR1');
  addKit('randomEvent',{count:3,button:true,demo:true},[x+C/2,y+C/2,0]);
  addKit('loop',{interval:2,startOn:false,button:true,payload:'spark'},[x+C-250,y+C/2,0]);
  addKit('checkpoint',{mode:'spawns',spawns:2,zone:128,message:'Checkpoint reached!'},[x+C-250,y+C-200,0]);
}
// ---- 1,1 Effects ----
{const [x,y]=cellMin(1,1);
  addKit('steam',{height:120,hurt:false,sound:true},[x+150,y+150,0]);
  addKit('drips',{height:H-40,interval:1},[x+300,y+150,0]);
  addKit('landmine',{magnitude:60},[x+C-150,y+150,0]);
  addKit('explosion',{magnitude:80,repeatable:true,button:true},[x+C/2,y+C/2+200,0]);
  addKit('laser',{length:400,color:'255 0 0',damage:0,startOn:true},[x+150,y+C/2,0]);
  addKit('bubbles',{width:64,depth:64,height:200,density:3},[x+C-150,y+C-150,0]);
  ent('env_sound',[x+C/2,y+C/2,64],{radius:'400',roomtype:'7'});
}
// ---- 2,1 Water + fog ----
{const [x,y]=cellMin(2,1);
  addKit('waterPool',{width:320,depth:320,height:96,renderamt:120,texture:'!WATERBLUE',contents:'-3'},[x+250,y+250,0]);
  addKit('healingPool',{width:160,depth:160,height:32,heal:5,texture:'!WATERBLUE'},[x+C-200,y+200,0]);
  addKit('waterfall',{width:96,height:300,texture:'!WATERBLUE',sound:true,yaw:'0'},[x+C/2,y+C-120,0]);
  ent('env_fog',[x+C/2,y+C/2,64],{targetname:'fog',rendercolor:'120 130 140',iuser2:'64',iuser3:'900',spawnflags:'1'});
  const b=ent('func_button',[x+120,y+C-140,56],{target:'fog',wait:'1',sounds:'14',angles:'0 0 0'});box([x+104,y+C-148,48],[x+108,y+C-132,64],'C1A0_LABW2').entityId=b.id;
}
// ---- 3,1 Mechanisms ----
{const [x,y]=cellMin(3,1);
  addKit('elevator',{floors:2,floorHeight:192,width:128,depth:128,speed:100,doors:true,yaw:'0'},[x+200,y+300,0],'GENERIC015V');
  box([x+80,y+380,184],[x+320,y+600,192],'C1A0_LABFLR');
  addKit('fan',{orientation:'wall',radius:64,speed:300,push:true,pain:false,button:true,yaw:'0'},[x+C-220,y+200,0]);
  addKit('gear',{radius:64,teeth:10,thickness:16,speed:30},[x+C/2+150,y+C-200,0]);
  addKit('pendulum',{length:200,distance:60,speed:60,damage:0,yaw:'0'},[x+C-200,y+C-250,H-230]);
}
// ---- 0,2 Outdoor: rain, storm, day/night ----
{const [x,y]=cellMin(0,2);
  addKit('rain',{width:768,depth:768,height:H-40,density:5,sound:true},[x+C/2,y+C/2,0]);
  addKit('storm',{width:768,height:H-20,minDelay:5,maxDelay:12,flash:true},[x+C/2,y+C/2,0]);
  addKit('dayNight',{daySky:'desert',nightSky:'night',period:90,lamps:4},[x+C/2,y+200,0]);
}
// ---- 1,2 Outdoor: snow ----
{const [x,y]=cellMin(1,2);addKit('snow',{width:768,depth:768,height:H-40,density:4},[x+C/2,y+C/2,0]);
  for(let i=0;i<5;i++)addKit('breakable',{kind:'crate',width:48,depth:48,height:48,health:20,spawn:'1'},[x+200+i*120,y+C-200,0],'BCRATE02');}
// ---- 2,2 Props & turrets ----
{const [x,y]=cellMin(2,2);
  addKit('vending',{drink:'6',capacity:10,heal:1,glass:true,yaw:'0'},[x+150,y+C-100,0],'C1A0_LABW2');
  addKit('breakable',{kind:'glass',width:128,depth:4,height:96,health:10,spawn:'0'},[x+400,y+C-120,0],'GLASS_BRIGHT');
  addKit('breakable',{kind:'metal',width:64,depth:16,height:96,health:60,spawn:'2'},[x+560,y+C-120,0],'C1A0_LABW2');
  addKit('breakable',{kind:'computer',width:48,depth:32,height:48,health:20,spawn:'4'},[x+700,y+C-120,0],'+0LAB1_COMP9A');
  addKit('monitor',{width:40,color:'80 180 255',yaw:'0'},[x+840,y+C-120,0],'C1A0_LABW2');
  addKit('securityCamera',{cameras:2,hold:6,spacing:300,height:300,yaw:'0'},[x+C/2,y+200,0],'C1A0_LABW2');
  addKit('turret',{weapon:'gun',mode:'player',yawRange:60,pitchRange:25,damage:5,yaw:'0'},[x+C-200,y+C/2,0],'C1A0_LABW2');
  addKit('mortarField',{width:256,depth:256,height:H-40,spread:96,count:2,button:true},[x+250,y+C/2,0]);
}
// ---- 3,2 Teleport & exit ----
{const [x,y]=cellMin(3,2);
  addKit('teleporter',{distance:500,size:64,twoWay:true,color:'90 200 255',yaw:'0'},[x+200,y+150,0]);
  addKit('changelevel',{map:NAME,mode:'button',countdown:5,keepInventory:true,width:128,depth:64,yaw:'0'},[x+C-200,y+C-160,0]);
  ent('infodecal',[x+C-4,y+C/2,96],{texture:'{bigshot1'});ent('infodecal',[x+C-4,y+C/2+60,110],{texture:'{crack2'});
}

const wadDir=gameDir.replace(/\\/g,'/');
const project={version:1,name:NAME,objects,world:{skyname:'desert',message:'SvenStudio 3D test map',mapversion:'220',light:'8'},wadNames:['halflife.wad','zhlt.wad','decals.wad']};
const problems=validateProject(project).filter(x=>/error/i.test(x));
if(problems.length)console.warn('validation:',problems.slice(0,10));
const map=exportMap(project,[`${wadDir}/halflife.wad`,`${wadDir}/zhlt.wad`,`${wadDir}/decals.wad`]);
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,`${NAME}.map`),map);
const ents=objects.filter(o=>o.kind==='entity');
const classes=[...new Set(ents.map(e=>e.classname))].sort();
const readme=[`${NAME} — SvenStudio 3D test map`,'',`${objects.length-ents.length} brushes, ${ents.length} entities, ${classes.length} entity classes.`,'','Rooms (4 x 3 grid, start in the top-left hub):',...ZONES.flatMap((row,r)=>row.map((z,c)=>`  [${c+1},${r+1}] ${z}`)),'','Entity classes:',classes.join(', '),''].join('\n');
fs.writeFileSync(path.join(outDir,'README.txt'),readme);
console.log(JSON.stringify({brushes:objects.length-ents.length,entities:ents.length,classes:classes.length}));
