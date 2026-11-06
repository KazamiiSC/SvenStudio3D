import type {FgdClass,MapObject,PointEntity} from './types';

/** Advisory only: all editable values remain native Svengine/GoldSrc keyvalues.
 * A loaded FGD is the authority for additional classes and property choices.
 */
export type EntityGuide = {
 category:string;
 summary:string;
 steps:string[];
 example:string;
 keys:string[];
 caution?:string;
};
const known:Record<string,EntityGuide>={
 func_button:{category:'interaction',summary:'Botón que dispara su target cuando un jugador lo usa, toca o activa según sus flags.',steps:['Poné un targetname en la entidad que querés activar.','Asigná ese nombre al target del botón.','Elegí un sonido en sounds o un WAV personalizado en noise.','Usá el flag Don’t move si querés un botón fijo.'],example:'func_button.target = door_01 → func_door.targetname = door_01',keys:['target','sounds','noise','wait','speed','spawnflags'],caution:'No alcanza con que ambas entidades estén juntas: los nombres target y targetname deben coincidir.'},
 func_door:{category:'movement',summary:'Brush sólido que se desplaza en línea recta al recibir activación.',steps:['Convertí el brush en func_door y poné un targetname.','Conectá el target de un botón o trigger a ese nombre.','Elegí Subir (angle = -1), Bajar (-2) o un ángulo horizontal.','Ajustá speed, wait y lip; configurá sonidos de movimiento y parada.'],example:'func_button.target = door_01 → func_door.targetname = door_01; angle = -1',keys:['targetname','angle','speed','wait','lip','movesnd','stopsnd','noise1','noise2'],caution:'Dejá espacio libre para el recorrido de la puerta. wait = -1 la mantiene abierta.'},
 func_door_rotating:{category:'movement',summary:'Puerta que gira sobre su eje; útil para hojas con bisagras.',steps:['Elegí la posición del origen/eje con cuidado.','Asigná targetname si debe responder a un botón.','Configurá el eje de giro, distance y speed según el FGD.','Elegí los sonidos de movimiento y parada disponibles.'],example:'func_button.target = puerta_giratoria → func_door_rotating.targetname = puerta_giratoria',keys:['targetname','distance','speed','wait','movesnd','stopsnd','noise1','noise2','spawnflags']},
 func_train:{category:'movement',summary:'Plataforma/objeto que recorre una secuencia de nodos path_corner.',steps:['Creá path_corner con targetname únicos.','Enlazá el target de cada nodo al siguiente.','Configurá el target inicial de func_train.','Probá la trayectoria y los tiempos en el juego.'],example:'func_train.target = parada_01 → path_corner.targetname = parada_01',keys:['target','targetname','speed','sounds','noise']},
 func_plat:{category:'movement',summary:'Plataforma elevadora que se mueve entre niveles.',steps:['Asigná altura y velocidad con las propiedades del FGD.','Comprobá el espacio de movimiento y activación.','Usá sonidos compatibles con las opciones de la entidad.'],example:'Plataforma elevadora con speed y wait configurados',keys:['height','speed','wait','sounds']},
 func_wall:{category:'brush',summary:'Convierte geometría de mundo en una entidad sólida con propiedades de render.',steps:['Vinculá uno o varios brushes.','Ajustá renderamt/rendermode si necesitás transparencia.','Probá la iluminación y visibilidad en el BSP compilado.'],example:'func_wall con renderamt para crear una superficie semitransparente',keys:['rendermode','renderamt','rendercolor','targetname']},
 func_breakable:{category:'interaction',summary:'Brush que puede romperse por daño o activación, según sus flags y keyvalues.',steps:['Definí health y material.','Agregá un target si debe activar algo al romperse.','Configurá el sonido/efecto disponible desde el FGD.'],example:'func_breakable.target = alarma_01',keys:['health','material','target','spawnflags']},
 func_rotating:{category:'movement',summary:'Brush que gira sobre un eje, como ventiladores o mecanismos.',steps:['Configurá la velocidad y el eje de rotación.','Usá targetname para controlarlo mediante triggers, si corresponde.','Comprobá colisiones y sonido en el juego.'],example:'func_rotating con speed y targetname configurados',keys:['speed','targetname','spawnflags','sounds']},
 trigger_once:{category:'logic',summary:'Volumen que activa su target una sola vez al cumplir las condiciones de activación.',steps:['Dibujá el volumen con textura TRIGGER.','Definí target hacia una entidad con targetname.','Ajustá flags/filtros para elegir quién puede activarlo.'],example:'trigger_once.target = puerta_01',keys:['target','delay','spawnflags']},
 trigger_multiple:{category:'logic',summary:'Volumen capaz de dispararse repetidamente.',steps:['Creá el volumen de activación.','Asigná target hacia otra entidad.','Ajustá wait para controlar el tiempo entre activaciones.'],example:'trigger_multiple.target = alarma_01; wait = 2',keys:['target','wait','delay','spawnflags']},
 trigger_relay:{category:'logic',summary:'Retransmite activaciones hacia uno o varios destinos que comparten targetname.',steps:['Poné un targetname al relay.','Apuntá el target del botón o trigger a ese nombre.','Configurá el target del relay al destino final.'],example:'botón → relay_01 → door_01',keys:['targetname','target','delay','triggerstate']},
 multi_manager:{category:'logic',summary:'Secuencia temporal de objetivos para activar varias entidades.',steps:['Poné un targetname al multi_manager.','Agregá las salidas y sus demoras según el FGD.','Conectá un botón/trigger a su targetname.'],example:'botón → multi_manager → luces, sonidos y puertas',keys:['targetname','spawnflags']},
 ambient_generic:{category:'audio',summary:'Reproduce un sonido ambiental, puntual o activable desde otra entidad.',steps:['Elegí el archivo en message (relativo a sound/).','Elegí volumen y flags de repetición desde el FGD.','Usá targetname para activarlo con botón o trigger.'],example:'func_button.target = sonido_01 → ambient_generic.targetname = sonido_01',keys:['message','targetname','health','spawnflags']},
 ambient_music:{category:'audio',summary:'Reproduce música ambiental según los recursos y configuración del mod.',steps:['Elegí un archivo compatible en message.','Configurá repetición/volumen con el FGD.','Usá targetname para controlarlo si la clase lo admite.'],example:'ambient_music.message = music/tema.wav',keys:['message','targetname','spawnflags']},
 env_sprite:{category:'effects',summary:'Muestra un sprite o efecto visual en el mapa.',steps:['Elegí el sprite/modelo indicado por el FGD.','Ajustá su escala y propiedades visuales.','Si es activable, conectá su targetname.'],example:'env_sprite para una luz indicadora',keys:['model','scale','rendermode','renderamt','targetname']},
 light:{category:'lighting',summary:'Luz puntual para la compilación de iluminación del mapa.',steps:['Ajustá el color y la intensidad de _light.','Compilá con SC-RAD para ver el resultado en el juego.'],example:'light._light = 255 220 180 200',keys:['_light','style','targetname']},
 light_environment:{category:'lighting',summary:'Iluminación del cielo y ambiente en exteriores.',steps:['Configurá _light y los parámetros de cielo del FGD.','Usá superficies SKY y compilá con SC-RAD.'],example:'light_environment para escenas exteriores',keys:['_light','pitch','_diffuse_light']},
 path_corner:{category:'path',summary:'Nodo de recorrido para trenes, cámaras u otros sistemas que usen path_corner.',steps:['Asigná targetname al nodo.','Usá target para enlazar con el siguiente nodo.','Asegurate de que la ruta termine o cierre correctamente.'],example:'path_corner A.target = nodo_B',keys:['targetname','target','wait','speed']},
 path_waypoint:{category:'path',summary:'Punto de navegación relacionado con sistemas de rutas de Svengine.',steps:['Asigná un nombre distinguible.','Conectá las referencias de acuerdo con el controlador que utilices.','Validá el comportamiento de la IA dentro del juego.'],example:'Un waypoint dentro de una ruta de NPC',keys:['targetname','target']},
 info_player_start:{category:'spawn',summary:'Posición y orientación inicial de un jugador.',steps:['Ubicá el punto sobre un suelo válido.','Dejá espacio libre alrededor del jugador.','Probá el spawn en Sven Co-op.'],example:'info_player_start sobre el piso de la primera habitación',keys:['angles']},
 monster_zombie:{category:'npc',summary:'NPC enemigo con comportamiento administrado por el motor.',steps:['Ubicá el NPC en una posición válida.','Configurá sus atributos desde el FGD.','Probá sus reacciones y navegación dentro del juego.'],example:'monster_zombie colocado con el NPC Browser',keys:['targetname','target','health','spawnflags']},
 squadmaker:{category:'npc',summary:'Generador de NPC con control de cantidad y activación.',steps:['Elegí la clase NPC a generar.','Configurá cantidad/intervalos y flags desde el FGD.','Opcionalmente activalo mediante targetname.'],example:'trigger_once.target = spawner_01',keys:['targetname','monstertype','monstercount','delay','spawnflags']},
};
export const builtInGuideClasses = Object.keys(known);
const fallback=(name:string,type?:FgdClass['type']):EntityGuide=>{
 const prefix=name.split('_')[0];
 const categories:Record<string,[string,string,string]>= {
  func:['brush','Entidad vinculada a brushes. Su comportamiento depende de sus keyvalues.','Seleccioná sus brushes y revisá los controles que define el FGD.'],
  trigger:['logic','Entidad de lógica o volumen activador.','Revisá target, filtros y flags en el FGD.'],
  monster:['npc','NPC controlado por Svengine.','Configurá sus atributos y validá su comportamiento en el juego.'],
  env:['effects','Entidad de efecto ambiental o visual.','Revisá sus parámetros específicos en el FGD.'],
  game:['logic','Entidad de lógica de juego.','Revisá condiciones, activaciones y efectos en el FGD.'],
  info:['information','Punto de referencia o configuración para otro sistema.','Comprobá qué sistemas usan esta entidad y sus keyvalues.'],
  item:['item','Objeto recogible o interactivo.','Revisá modelos y flags compatibles.'],
  weapon:['item','Arma recogible.','Configurá sus opciones a través del FGD.'],
  ammo:['item','Munición recogible.','Revisá sus parámetros en el FGD.'],
  light:['lighting','Entidad de iluminación.','Verificá el resultado después de compilar con SC-RAD.'],
  ambient:['audio','Entidad de sonido ambiental.','Revisá su archivo y parámetros de reproducción.'],
  path:['path','Nodo de ruta o recorrido.','Conectá sus referencias según el controlador que usa esta ruta.'],
 };
 const info=categories[prefix]??(type==='solid'?categories.func:undefined)??['other','Entidad definida por el FGD cargado.','Consultá sus keyvalues y descripción antes de usarla.'];
 return {category:info[0],summary:info[1],steps:[info[2],'Probá el comportamiento real en Sven Co-op.'],example:`${name}: consultar definición FGD`,keys:[]};
};
export function guideForClass(classname:string,definition?:FgdClass):EntityGuide{
 const guide=known[classname.toLowerCase()]??fallback(classname,definition?.type);
 return {...guide,keys:guide.keys.filter((key,i,list)=>list.indexOf(key)===i)};
}
export function guideKeys(classname:string,definition?:FgdClass):string[]{
 const guide=guideForClass(classname,definition);
 const nativeKeys=Object.keys(definition?.props??{});
 return [...new Set([...guide.keys.filter(k=>!definition||k in definition.props||k==='target'||k==='targetname'),...nativeKeys.filter(k=>/^(sound|noise|message|move|stop|speed|wait|angle|lip|target|delay|health|distance|height)/i.test(k))])].slice(0,24);
}
/** Capabilities are inferred from actual FGD keys, not invented behavior.
 * These labels indicate available editing controls, not a simulation of Svengine.
 */
export function entityCapabilities(definition?:FgdClass,locale='es'):string[]{
 if(!definition)return [];
 const keys=new Set(Object.keys(definition.props));
 const has=(...names:string[])=>names.some(x=>keys.has(x));
 const results:string[]=[];
 if(has('target','targetname'))results.push('Conexiones y activación entre entidades');
 if(has('speed','distance','height','lip','wait'))results.push('Movimiento, recorrido o temporización');
 if([...keys].some(x=>/^(noise\d*|.*sound.*|message)$/.test(x)))results.push('Reproducción o configuración de sonido');
 if(has('rendermode','renderamt','rendercolor','scale','model'))results.push('Aspecto, modelo o renderizado');
 if(has('health','dmg','damage','material'))results.push('Vida, daño o materiales');
 if(has('monstertype','monstercount','squadname'))results.push('Configuración o generación de NPC');
 if(has('target','path','path_name','m_iszPathName'))results.push('Referencias a otras entidades o rutas');
 if(has('_light','_diffuse_light','_ambient'))results.push('Iluminación');
 if(has('spawnflags'))results.push('Opciones adicionales (spawnflags)');
 if(locale!=='es'){
  const englishCapabilities:Record<string,string>={
   'Conexiones y activación entre entidades':'Entity targets and connections',
   'Movimiento, recorrido o temporización':'Movement, travel or timing settings',
   'Reproducción o configuración de sonido':'Sound file or playback controls',
   'Aspecto, modelo o renderizado':'Appearance, models or rendering',
   'Vida, daño o materiales':'Health, damage or material',
   'Configuración o generación de NPC':'NPC settings or spawning',
   'Referencias a otras entidades o rutas':'Entity or path references',
   'Iluminación':'Lighting',
   'Opciones adicionales (spawnflags)':'Additional flags (spawnflags)',
  };
  return [...new Set(results.map(s=>englishCapabilities[s]??s))];
 }
 return [...new Set(results)];
}

/** Known native sound-override keys are whitelisted, so a guide never creates an invented key. */
export function editableSoundKeys(classname:string,definition?:FgdClass):string[]{
 const c=classname.toLowerCase();
 const knownKeys:Record<string,string[]>={func_button:['noise','locked_sound_override','unlocked_sound_override'],func_door:['noise1','noise2','locked_sound_override','unlocked_sound_override'],func_door_rotating:['noise1','noise2'],ambient_generic:['message'],ambient_music:['message']};
 const fromFgd=Object.entries(definition?.props??{}).filter(([key,f])=>f.type==='sound'||(f.type==='string'&&/^(noise\d*|message|.*sound_override)$/.test(key))).map(([key])=>key);
 return [...new Set([...(knownKeys[c]??[]),...fromFgd])];
}
export function linkedTargets(objects:MapObject[],excludeId?:string):PointEntity[]{
 return objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.id!==excludeId&&!!o.props.targetname?.trim());
}
export function entityGuideWarnings(entity:PointEntity,objects:MapObject[]):string[]{
 const warnings:string[]=[];const target=entity.props.target?.trim();
 if(target&&['func_button','trigger_once','trigger_multiple','trigger_relay','multi_manager','func_breakable'].includes(entity.classname)){
  if(!objects.some(o=>o.kind==='entity'&&o.id!==entity.id&&o.props.targetname===target))warnings.push(`No existe un targetname igual a «${target}».`);
 }
 if(entity.classname==='func_door'&&entity.props.angle==='-1')warnings.push('La puerta sube: comprobá que tenga espacio libre sobre ella.');
 return warnings;
}

// English explanations for non-Spanish UI locales. Technical fields are never translated.
// FGD text is used verbatim when provided by the user's game SDK.
const english:Record<string,[string,string[],string]>={
 func_button:['Activates another entity when pressed or triggered.',['Assign targetname to the destination entity.','Set this button’s target to that name.','Choose a built-in sound or a custom noise WAV.'],'Button → door, lights or relay'],
 func_door:['Solid brush that slides in a configurable direction.',['Link a button to this door’s targetname.','Use angle = -1 to move up, -2 to move down.','Set speed, wait, lip and move/stop sounds.'],'Button → sliding door'],
 func_door_rotating:['Door that swings around a rotation axis.',['Check the hinge/origin and rotation axis.','Link its targetname to a button or trigger.','Configure angle/distance, speed and sounds using the FGD.'],'Button → hinged door'],
 func_train:['Moving brush following path_corner nodes.',['Place path_corner nodes with unique names.','Connect each node to the next.','Set the first path in func_train.target.'],'Train → path_corner route'],
 func_plat:['Moving platform or lift.',['Check its travel distance and speed in the FGD.','Ensure clear space in the moving direction.'],'Elevator platform'],
 func_wall:['Solid brush entity with rendering options.',['Assign brushes to the entity.','Configure rendering properties when needed.'],'Transparent func_wall'],
 func_breakable:['Breakable brush entity.',['Set health and material.','Set target to trigger another entity when broken.'],'Breakable panel activates alarm'],
 func_rotating:['Rotating brush, e.g. fan or mechanism.',['Set the rotation axis and speed.','Use targetname for activation when supported.'],'Motorized fan'],
 trigger_once:['Trigger volume that fires once.',['Create the trigger volume.','Connect its target to the destination targetname.','Check player/NPC activation flags.'],'Trigger → door'],
 trigger_multiple:['Repeatable trigger volume.',['Create a trigger volume.','Configure target and wait.','Check activation flags and filters.'],'Repeatable alarm'],
 trigger_relay:['Relays an activation to another target.',['Set relay targetname.','Connect button.target to relay targetname.','Connect relay.target to the final destination.'],'Button → relay → door'],
 multi_manager:['Timed multi-target sequence.',['Give the sequence a targetname.','Configure outputs and delays using native properties.','Trigger the sequence from a button.'],'Button → timed lights and sounds'],
 ambient_generic:['Ambient or triggerable sound entity.',['Set message to a sound file path relative to sound/.','Configure volume and looping flags.','Use targetname to trigger it from a button.'],'Button → ambient_generic'],
 ambient_music:['Ambient music playback.',['Choose a compatible sound file.','Set volume, looping and targetname as supported by the FGD.'],'Music zone'],
 env_sprite:['Displays a sprite effect.',['Choose a sprite model and rendering properties.','Connect targetname if the entity supports activation.'],'Indicator sprite'],
 light:['Point light compiled by SC-RAD.',['Set _light brightness and color.','Compile the map to see baked lighting.'],'Room light'],
 light_environment:['Sky/outdoor light.',['Set sky and light properties.','Use SKY surfaces and compile with SC-RAD.'],'Sunlight in outdoor map'],
 path_corner:['Route node for trains and other controllers.',['Set a unique targetname.','Link target to the next node.'],'Node A → node B'],
 path_waypoint:['Navigation waypoint.',['Give the waypoint a unique name.','Connect it according to the associated controller.'],'NPC waypoint'],
 info_player_start:['Player spawn point.',['Place it above a valid floor.','Leave space for the player hull.'],'Player spawn'],
 monster_zombie:['NPC controlled by Svengine.',['Place the NPC on navigable ground.','Configure attributes in the FGD.','Test the AI in the actual game.'],'Zombie spawn'],
 squadmaker:['Spawner that creates NPCs.',['Choose the monster type.','Set count and timing with the FGD.','Use targetname for trigger activation if available.'],'Trigger → squadmaker'],
};
export function localizedGuideForClass(classname:string,definition:FgdClass|undefined,locale:string):EntityGuide{
 const guide=guideForClass(classname,definition);
 if(locale==='es')return guide;
 const entry=english[classname.toLowerCase()];
 if(entry)return {...guide,summary:entry[0],steps:entry[1],example:entry[2],caution:undefined};
 const category=guide.category;
 return {...guide,summary:definition?.description||`Entity defined by the game FGD (${category}).`,steps:[`Inspect the ${classname} class and its native keyvalues.`, 'Test its behavior in Sven Co-op.'],example:`${classname}: consult FGD`,caution:undefined};
}
