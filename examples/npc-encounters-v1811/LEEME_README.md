# SvenStudio 3D v1.8.11 — Mapa de prueba Smart NPC Encounters 2.0

## Archivos

- `sv_encounter_validation.map` — mapa de prueba Valve 220 listo para importar o compilar.
- `sv_encounter_validation.svenstudio.json` — proyecto editable que incluye metadata de **Mission & Campaign**, **Dynamic Events** y **Smart NPC Encounters 2.0**.
- `svstudio.wad` — WAD real empleado por los brushes de este mapa.
- `BUILD_REPORT.json` — resumen de validación del generador.

## Recorrido previsto

1. Abrí el `.svenstudio.json` en SvenStudio 3D v1.8.11. Para obtener las texturas correctas, cargá `svstudio.wad` en Asset Library si no está cargado. Abrí **NPC & AI Studio → Smart NPC Encounters 2.0** y verificá las tres oleadas. Visitá **Misiones y campañas** y **Eventos dinámicos**: hay una misión de dos etapas y dos alarmas vinculadas.
2. Compilá con las herramientas oficiales **SC-CSG, SC-BSP, SC-VIS, SC-RAD**. Usá el nombre `sv_encounter_validation` para generar el BSP. Comprobá que no haya leaks ni errores de recursos. En caso de compilar el `.map` directamente, agregá la ubicación de `svstudio.wad` en la búsqueda de WADs del compilador.
3. Copiá el BSP a `svencoop/maps/` si el compilador no lo hace automáticamente. Iniciá Sven Co-op y cargá `map sv_encounter_validation` desde consola o el menú correspondiente.
4. **Vestíbulo de inicio:** cuatro `info_player_start`, iluminación, armas, munición y botiquines. Avanzá por el portón central al recinto de combate. El texto HUD introduce el ejercicio.
5. **Recinto principal:** al cruzar el trigger de entrada, comienza la **oleada 1**: cuatro HECU `monster_human_grunt`. Se activa el aviso de seguridad y una luz de alarma. Tras eliminar los cuatro, empieza la **oleada 2**: tres zombis `monster_zombie`. Al vencerlos, comienza la **oleada 3**: dos Alien Grunts `monster_alien_grunt`, con otra alarma.
6. **Última baja:** debe aparecer el mensaje de sector asegurado, completarse el primer objetivo de la misión y abrirse el portón del extremo opuesto (`test_gate_open`). Cruzá hasta extracción para completar el segundo objetivo y mostrar el texto final de éxito.

## Qué comprueba este mapa

- Geometría con luces y coberturas; escala y colisiones de tres sectores.
- `trigger_once` y `multi_manager` para iniciar y encadenar NPC.
- `squadmaker` con hasta 4 puntos de aparición por oleada, `monstercount` y `m_imaxlivechildren`.
- `trigger_condition 4` (muerte) de NPC → `game_counter` → siguiente oleada.
- Vínculo a **dos eventos temporizados** de Dynamic Events Studio (avisos y luces).
- Completar objetivo de Mission & Campaign Studio y apertura automática de `func_door`.
- Guardar / volver a abrir el proyecto; borrar y regenerar el encuentro en una copia del mapa; Undo/Redo.

## Si una oleada no continúa

- Revisá en el juego si todavía queda algún NPC vivo escondido; **los cuerpos pueden ocupar un cupo de `m_imaxlivechildren` hasta desaparecer**.
- Si faltan NPC, examiná los puntos de aparición: una zona obstruida puede evitar que `squadmaker` termine de generar el total esperado. El contador sólo avanza cuando recibe el evento de muerte de *cada NPC realmente creado*.
- No vuelvas a activar repetidamente el target de inicio: la prueba está diseñada para ejecutarse una vez.
- Verificá que las texturas se cargaron, el BSP se construyó sin leaks y que la iluminación/colisiones coinciden con el recinto.
- Para depurar, verificá los targets `test_gate_open`, `test_briefing`, `test_alarm_message`, `test_final_message`, `test_victory` y los nombres generados `sv_en_*`, `sv_ew_*` usando el inspector de entidades. Los identificadores concretos están dentro del `.map` y del proyecto.

## Estado de la validación

El mapa pasó validación de convexidad y exportación/reimportación MAP Valve 220 (**70 brushes sin pérdidas** en la revisión inicial), y el proyecto JSON pasó el validador de SvenStudio. **No se ejecutó una compilación BSP de Windows ni se jugó este mapa dentro de Sven Co-op en el entorno donde se creó**. Los efectos, la puerta móvil, el comportamiento de NPC y la continuidad de oleadas requieren confirmación práctica.

La versión v1.8.11 es una Preview: guardá una copia del mapa antes de experimentar. No requiere plugins ni scripts externos, pero usa entidades nativas de Sven Co-op y un WAD incluido.
