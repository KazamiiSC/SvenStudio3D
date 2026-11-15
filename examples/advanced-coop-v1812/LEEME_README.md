# SvenStudio 3D v1.8.12 — BLACK MESA: COOPERATIVE SECURITY DRILL

Mapa de pruebas integrado para **Co-op Puzzle Builder**, **Smart NPC Encounters 2.0**, **Mission & Campaign Studio** y **Dynamic Events Studio**.

## Archivos

- `sv_coop_systems_validation.map` — mapa Valve 220 para importar o compilar.
- `sv_coop_systems_validation.svenstudio.json` — proyecto editable, con metadatos de ambos puzles, misión, encuentro NPC y eventos.
- `svstudio.wad` — texturas de ejemplo, necesario para compilar si no está en las rutas del editor.
- `BUILD_REPORT.json` — informe de exportación e importación MAP, puzles y oleadas.

## Recorrido de prueba (1–4 jugadores)

1. Extraé **SvenStudio 3D v1.8.12** en una carpeta nueva. Abrí `SvenStudio3D.bat`, importá el proyecto `.svenstudio.json` e indicá `svstudio.wad` si no lo encuentra.
2. En **Estudios → Co-op Puzzle Builder**, abrí *Restore three generator circuits*: tres consolas físicas, `func_button` de un solo uso, contador `game_counter` y salida `test_entry_gate`. Revisá la posición de cada consola y su destino. No requieren un jugador distinto por consola.
3. Compilá con **SC-CSG, SC-BSP, SC-VIS, SC-RAD** y guardá el BSP como `sv_coop_systems_validation.bsp`, preferentemente en `svencoop/maps/`. Desde Sven Co-op usá `map sv_coop_systems_validation`.
4. **Sala de inicio / energía:** recogé el equipo del vestíbulo. Pulsá las **tres consolas** distribuidas por la sala. Al activarlas todas, debe abrirse el primer portón (`test_entry_gate`), avanzar la primera misión, aparecer el aviso de energía y encenderse una luz de confirmación. Las consolas permanecen activadas.
5. **Sala de combate:** cruzá el primer portón. El volumen `trigger_once` inicia el encuentro. Oleada 1: **4 HECU** con alarma; oleada 2: **3 zombis**; oleada 3: **2 Alien Grunts** con alarma final. La baja del último enemigo abre `test_gate_open` y completa el segundo objetivo.
6. **Extracción / controles sincronizados:** tras el segundo portón, hay **dos consolas separadas**. Pulsalas con una diferencia máxima de **5 segundos**. El `multisource` debe recibir ambas señales solapadas; `trigger_relay` dispara una sola vez el resultado y la última misión presenta el mensaje de éxito. En modo cooperativo, cada jugador puede encargarse de un control. Un jugador hábil también podría activarlas en el intervalo: **no existe verificación de identidad de jugadores**.
7. Volvé a SvenStudio, abrí **Co-op Puzzle Builder → Map audit** para revisar el mapa. Probá guardar, reabrir, duplicar los puzles en una copia del proyecto y Undo/Redo. **No edites manualmente piezas generadas** salvo que primero las desvincules.

## Inspección técnica de entidades

- Energía: `func_button` (3, `wait=-1`) → `game_counter` (`health=3`) → `multi_manager` → `test_entry_gate` y relay de misión, con evento de iluminación.
- Encuentro: `trigger_once` → `multi_manager` → `squadmaker` (`trigger_condition=4`) → `game_counter` por oleada → próxima oleada. Tras el combate → puerta y segundo objetivo.
- Extracción: `func_button` (2, `wait=5`) → `multisource` → `trigger_relay` (On, remove on fire) → `multi_manager` → último objetivo → mensaje de éxito.
- **Problemas de spawn:** si faltan NPC, verificá que no haya monstruos escondidos y que los cuerpos no bloqueen `m_imaxlivechildren` antes de concluir que falló el contador.

## Estado de la validación

Este paquete está validado mediante pruebas TypeScript, lógica estructural, MAP Valve 220, geometría y referencias. **No incluye un BSP compilado ni garantiza aún el comportamiento dentro del motor**: debés comprobar en Sven Co-op ambas puertas, el contador de los tres interruptores, el intervalo de los botones, las oleadas y los avisos.

**Sin plugins ni AngelScript adicional.** El mapa usa solamente entidades compatibles con Sven Co-op y su WAD adjunto. Conservá una copia de v1.8.11 y de tus proyectos antes de instalar la Preview.
