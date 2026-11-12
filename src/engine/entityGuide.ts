import type {FgdClass,MapObject,PointEntity} from './types';
import {readDoorOrientation} from './doorDirection.ts';

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
 func_door:{category:'movement',summary:'Brush sólido que se desplaza en línea recta al recibir activación.',steps:['Convertí el brush en func_door y poné un targetname.','Conectá el target de un botón o trigger a ese nombre.','Elegí Subir (angles = 0 -1 0), Bajar (0 -2 0) o un ángulo horizontal.','Ajustá speed, wait y lip; configurá sonidos de movimiento y parada.'],example:'func_button.target = door_01 → func_door.targetname = door_01; angles = 0 -1 0',keys:['targetname','angles','speed','wait','lip','movesnd','stopsnd','noise1','noise2'],caution:'Dejá espacio libre para el recorrido de la puerta. wait = -1 la mantiene abierta.'},
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

/** Verified Sven Co-op mapping concepts. More detailed keys always come from the loaded FGD.
 * Examples are small wiring patterns, not a guarantee of a gameplay result.
 * Avoid promising specific support for AngelScript or custom class names.
 */
const extended:Record<string,EntityGuide>={
 ammo_556:{category:'item',summary:'Caja de munición de 5,56 mm que los jugadores pueden recoger si poseen un arma compatible.',steps:['Colocá la caja sobre suelo accesible.','Probá que el arma del jugador utilice esa munición y que se pueda recoger.','Revisá los flags de recogida y respawn en el FGD.'],example:'ammo_556 en una zona de suministros junto a un arma compatible.',keys:['targetname','spawnflags']},
 ammo_9mmar:{category:'item',summary:'Munición de 9 mm utilizada por armas compatibles como Glock, MP5 y Uzi.',steps:['Colocá la caja sobre una superficie accesible.','Probá la recogida con un arma que utilice munición de 9 mm.','Si usás flags para limitar la recogida, revisá sus nombres en el FGD.'],example:'ammo_9mmAR junto a una zona de reabastecimiento.',keys:['spawnflags','targetname']},
 info_target:{category:'information',summary:'Punto de referencia que otras entidades pueden seguir o usar como destino, por ejemplo cámaras, láseres o portales.',steps:['Colocá info_target en el punto deseado.','Asignale targetname, como mira_camara.','Usá ese nombre en el campo correspondiente de la entidad que necesite la referencia.'],example:'info_target.targetname = mira_camara; una trigger_camera referencia mira_camara.',keys:['targetname']},
 info_teleport_destination:{category:'information',summary:'Destino de teletransporte utilizado por sistemas de teleportación compatibles.',steps:['Colocalo sobre suelo seguro, dejando espacio alrededor.','Asignale targetname único.','Conectá el teletransportador con ese destino mediante las opciones de su FGD.'],example:'Destino sala_02 para el teletransporte de una sala a otra.',keys:['targetname','angles']},
 info_node:{category:'information',summary:'Nodo de navegación terrestre que el sistema de IA puede usar en el mapa.',steps:['Distribuí nodos en superficies transitables.','Evitá puntos incrustados en paredes.','Probá el recorrido de NPCs con el BSP compilado.'],example:'info_node en ambos extremos de un pasillo.',keys:[]},
 info_node_air:{category:'information',summary:'Nodo de navegación aérea para sistemas de IA que puedan utilizarlo.',steps:['Ubicalo en un espacio libre apto para vuelo.','Separalo de paredes y otros obstáculos.','Probá el movimiento de las criaturas voladoras en el juego.'],example:'info_node_air en un hangar amplio.',keys:[]},
 info_player_coop:{category:'spawn',summary:'Punto de aparición de jugadores cooperativos.',steps:['Creá suficientes puntos separados entre sí.','Dejá altura y espacio para la colisión del jugador.','Probá la aparición de varios jugadores simultáneos en Sven Co-op.'],example:'info_player_coop distribuido en una sala de inicio.',keys:['angles']},
 env_explosion:{category:'effects',summary:'Efecto de explosión activable en un punto del mapa.',steps:['Colocá el efecto donde debería producirse la explosión.','Configurá magnitud y flags declarados por el FGD.','Activá su targetname con un botón, trigger o relay.'],example:'trigger_once.target = explos_01 → env_explosion.targetname = explos_01',keys:['targetname','iMagnitude','spawnflags']},
 env_fade:{category:'effects',summary:'Crea una transición de pantalla por fundido cuando se activa.',steps:['Configurá duración y color del fundido en el FGD.','Asigná un targetname para dispararlo con un trigger.','Probá su alcance y efectos sobre jugadores cooperativos.'],example:'trigger_once.target = fundido_inicio → env_fade.targetname = fundido_inicio',keys:['targetname','duration','holdtime','rendercolor','renderamt']},
 env_shake:{category:'effects',summary:'Efecto de vibración de cámara en jugadores dentro del alcance configurado.',steps:['Ajustá amplitud, frecuencia, duración y radio según los keyvalues disponibles.','Asigná un targetname para activarlo por la lógica del mapa.','Probá el resultado en una partida cooperativa.'],example:'trigger_relay.target = temblor_01 → env_shake.targetname = temblor_01',keys:['targetname','amplitude','frequency','duration','radius']},
 env_beam:{category:'effects',summary:'Haz visual entre puntos o entidades configuradas.',steps:['Colocá entidades de referencia si el FGD las requiere.','Asigná los endpoints y el aspecto del haz según las propiedades.','Probá su render y activación en Sven Co-op.'],example:'env_beam enlazado a dos info_target.',keys:['LightningStart','LightningEnd','texture','rendercolor','targetname']},
 env_laser:{category:'effects',summary:'Láser visual y potencialmente dañino con destino controlable.',steps:['Colocá un punto de destino como info_target.','Configurá el punto de disparo, destino y propiedades visuales.','Verificá el comportamiento de daño y activación en el juego.'],example:'env_laser dirigido hacia info_target.targetname = laser_destino.',keys:['LaserTarget','texture','targetname','damage']},
 env_fog:{category:'effects',summary:'Configuración de niebla para el entorno según el motor y el FGD.',steps:['Ajustá los valores de color, distancias y densidad que declare el FGD.','Probá la mezcla con el sky y la iluminación del mapa.','Comprobá los resultados dentro de Sven Co-op.'],example:'env_fog para una sala exterior de baja visibilidad.',keys:['targetname','rendercolor']},
 env_message:{category:'effects',summary:'Presenta un mensaje al jugador cuando una entidad activa su nombre.',steps:['Definí el texto/mensaje o su entrada declarada en el FGD.','Asigná un targetname.','Activala desde un trigger_relay o botón y verificá que el mensaje aparezca.'],example:'trigger_once.target = mensaje_entrada → env_message.targetname = mensaje_entrada',keys:['message','targetname']},
 game_text:{category:'logic',summary:'Muestra texto de interfaz de juego con configuración visual y tiempo.',steps:['Configurá el mensaje y su estilo en los keyvalues.','Asigná un targetname.','Activá el mensaje desde un trigger o secuencia de misión.'],example:'trigger_once.target = intro_texto → game_text.targetname = intro_texto',keys:['message','targetname','holdtime','fadein','fadeout']},
 game_counter:{category:'logic',summary:'Cuenta activaciones y puede disparar otro objetivo al llegar al límite.',steps:['Configurá el límite de cuenta según el FGD.','Asigná targetname al contador para recibir activaciones.','Usá su target para enlazar la acción al completarse.'],example:'Dos botones activan counter_01; game_counter.target = puerta_01.',keys:['targetname','target','frags','spawnflags']},
 multisource:{category:'logic',summary:'Combina estados de activación de varios emisores; su resultado depende de los enlaces y usos.',steps:['Definí el targetname de multisource.','Conectá las fuentes mediante los keyvalues de activación apropiados.','Configurá la salida y probá los estados en Sven Co-op.'],example:'Varios func_button enlazados a multisource para habilitar una puerta.',keys:['targetname','target']},
 trigger_teleport:{category:'logic',summary:'Volumen de teleportación que transporta entidades admitidas al destino configurado.',steps:['Dibujá un brush de trigger donde deba comenzar el teletransporte.','Creá info_teleport_destination con targetname único.','Enlazá target y probá la orientación/colisión en el destino.'],example:'trigger_teleport.target = destino_a → info_teleport_destination.targetname = destino_a',keys:['target','spawnflags']},
 trigger_hurt:{category:'logic',summary:'Volumen que aplica daño según el tipo y la intensidad configurados.',steps:['Dibujá un volumen de trigger alrededor del área peligrosa.','Configurá dmg y damagetype a partir del FGD.','Revisá flags y probá el daño en el juego.'],example:'trigger_hurt sobre lava con daño de tipo BURN.',keys:['dmg','damagetype','spawnflags']},
 trigger_push:{category:'logic',summary:'Volumen que empuja jugadores o entidades en una dirección.',steps:['Dibujá el volumen de trigger.','Orientalo y definí la velocidad del empuje.','Comprobá quién es afectado según los flags del FGD.'],example:'trigger_push detrás de un ventilador.',keys:['speed','angles','spawnflags']},
 trigger_camera:{category:'effects',summary:'Cámara que puede cambiar temporalmente la vista de jugadores.',steps:['Colocá la cámara y definí su orientación.','Si necesitás un punto de mira, creá info_target.','Conectá un botón o trigger y verificá la salida de la cámara.'],example:'trigger_once → trigger_camera mirando a info_target.',keys:['targetname','target','wait','speed','spawnflags']},
 trigger_auto:{category:'logic',summary:'Dispara una activación al inicio del mapa o al cumplirse las condiciones de disparo configuradas.',steps:['Configurá el nombre de destino en target.','Revisá los ajustes de retardo y activación.','Probá el orden de ejecución con otras entidades del inicio.'],example:'trigger_auto.target = intro_secuencia → multi_manager.targetname = intro_secuencia',keys:['target','delay','spawnflags']},
 game_player_equip:{category:'logic',summary:'Entrega equipamiento cuando es activada por lógica de juego compatible.',steps:['Revisá el equipamiento requerido y las propiedades admitidas.','Asigná un nombre si debe activarse por un trigger.','Probá la entrega a varios jugadores.'],example:'game_player_equip para un conjunto de armas de inicio.',keys:['targetname','spawnflags']},
 func_illusionary:{category:'brush',summary:'Brush visible sin la colisión de una pared normal, útil para ciertos efectos decorativos.',steps:['Seleccioná un brush y vinculalo a func_illusionary.','Ajustá rendermode/renderamt si necesitás transparencia.','Probá visibilidad y colisiones en el BSP.'],example:'func_illusionary para una decoración que se pueda atravesar.',keys:['rendermode','renderamt','rendercolor']},
 func_water:{category:'brush',summary:'Entidad de brush para agua con comportamiento y aspecto dependientes del motor y del FGD.',steps:['Prepará un volumen cerrado de agua.','Configurá textura, render y propiedades del agua.','Probá su superficie y comportamiento en Sven Co-op.'],example:'func_water con textura de agua dentro de una piscina.',keys:['rendermode','renderamt','WaveHeight']},
 func_ladder:{category:'brush',summary:'Zona de escalera para que los jugadores asciendan o desciendan.',steps:['Prepará el brush de escalera en una zona vertical.','Asigná la clase func_ladder.','Probá la subida y bajada desde ambos extremos.'],example:'func_ladder en el conducto vertical de mantenimiento.',keys:[]},
 light_spot:{category:'lighting',summary:'Fuente de luz direccional concentrada para el cálculo de iluminación SC-RAD.',steps:['Colocá el foco en su posición.','Ajustá ángulos, cono, color y potencia según el FGD.','Compilá con SC-RAD y verificá la dirección del haz.'],example:'light_spot iluminando un cartel o una puerta.',keys:['_light','_cone','_cone2','angles','pitch']},
 path_track:{category:'path',summary:'Nodo de ruta para trenes y sistemas que sigan path_track.',steps:['Colocá varios nodos de pista.','Asigná targetname único y enlazá target al siguiente nodo.','Verificá que el controlador utilice path_track.'],example:'path_track nodo_01 → nodo_02 → nodo_03.',keys:['targetname','target']},
 item_healthkit:{category:'item',summary:'Botiquín recogible que recupera salud según las reglas del juego.',steps:['Colocalo donde el jugador pueda alcanzarlo.','Probá recogida y reaparición en Sven Co-op.'],example:'item_healthkit junto a una zona de descanso.',keys:['spawnflags','targetname']},
 item_battery:{category:'item',summary:'Batería recogible relacionada con la armadura del jugador.',steps:['Colocala en una ubicación accesible.','Comprobá el resultado en un jugador con traje y condiciones compatibles.'],example:'item_battery en un almacén de suministros.',keys:['spawnflags','targetname']},
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
 const guide=known[classname.toLowerCase()]??extended[classname.toLowerCase()]??fallback(classname,definition?.type);
 const props=definition?.props??{};
 // Unknown classes still get a concrete usage path without making up keyvalues.
 if(!known[classname.toLowerCase()]&&!extended[classname.toLowerCase()]&&definition){
  const keys=Object.keys(props);
  const steps:string[]=[definition.type==='solid'?'Seleccioná un brush válido y asignale esta clase.':'Elegí la clase y colocala sobre una superficie del mapa.'];
  if(keys.includes('targetname'))steps.push('Si otra entidad necesita activarla o localizarla, asigná un targetname único.');
  if(keys.includes('target'))steps.push('Si debe activar otra entidad, configurá target con el targetname de su destino.');
  if(keys.includes('model'))steps.push('Revisá el modelo compatible en model y comprobá que el recurso esté disponible en el juego.');
  if(keys.includes('spawnflags'))steps.push('Revisá las opciones spawnflags disponibles y dejá activas solamente las necesarias.');
  if(keys.includes('_light'))steps.push('Ajustá _light y compilá con SC-RAD antes de evaluar la iluminación.');
  steps.push('Revisá los keyvalues definidos en tu FGD y probá el resultado en Sven Co-op.');
  const example=keys.includes('targetname')&&keys.includes('target')?`${classname}.targetname = control_01; ${classname}.target = destino_01 (otro objeto con targetname = destino_01)`:
   keys.includes('targetname')?`${classname}.targetname = ejemplo_01 (para referenciarla desde otra entidad)`:
   `${classname}: colocar ${definition.type==='solid'?'un brush asociado':'una entidad puntual'} en una zona de prueba y revisar el FGD.`;
  return {...guide,summary:definition.description&&definition.description!==classname?`${definition.description}. ${guide.summary}`:guide.summary,steps,example,keys:[]};
 }
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
 if(entity.classname==='func_door'){
  const orientation=readDoorOrientation(entity.props);
  if(orientation.direction==='up')warnings.push('La puerta sube: comprobá que tenga espacio libre sobre ella.');
  if(orientation.direction==='down')warnings.push('La puerta baja: comprobá que tenga espacio libre debajo.');
  if(orientation.conflict)warnings.push('Valores angle y angles contradictorios: elegí una dirección en Movimiento de la puerta para unificarlos.');
 }
 return warnings;
}

// English explanations for non-Spanish UI locales. Technical fields are never translated.
// FGD text is used verbatim when provided by the user's game SDK.
const english:Record<string,[string,string[],string]>={
 func_button:['Activates another entity when pressed or triggered.',['Assign targetname to the destination entity.','Set this button’s target to that name.','Choose a built-in sound or a custom noise WAV.'],'Button → door, lights or relay'],
 func_door:['Solid brush that slides in a configurable direction.',['Link a button to this door’s targetname.','Use angles = 0 -1 0 to move up, or 0 -2 0 to move down.','Set speed, wait, lip and move/stop sounds.'],'Button → sliding door'],
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
