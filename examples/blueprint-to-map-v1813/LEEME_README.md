# SvenStudio 3D v1.8.13 — Blueprint to Map: mapa de pruebas

Este ejemplo prueba **geométricamente** el editor de planos. No contiene misiones ni NPC. Las únicas entidades son `info_player_start` y 4 luces necesarias para recorrer el resultado en Sven Co-op.

## Contenido

- `sv_blueprint_validation.svenstudio.json`: proyecto editable con la imagen y sus trazados.
- `sv_blueprint_validation.map`: MAP Valve 220 exportado, sin metadatos privados.
- `sv_blueprint_validation_reference.png`: plano raster del que se trazó la geometría.
- `svstudio.wad`: WAD usado por las superficies.
- `BUILD_REPORT.json`: validación automática del MAP.

## Cómo probar

1. Extraé el paquete en una carpeta con acceso de escritura.
2. Abrí SvenStudio 3D v1.8.13 y cargá `sv_blueprint_validation.svenstudio.json`.
3. Si no encuentra la textura, cargá `svstudio.wad` desde Biblioteca de texturas.
4. En **Estudios → Blueprint to Map**, seleccioná *Black Mesa · Room & Corridor Blueprint*. Deberías ver cuatro contornos, los dos huecos de puertas y el hueco de una ventana. Abrí la vista previa 3D y cambiá el ancho de un hueco para comprobar la regeneración; guardá una copia del proyecto antes de alterar el original.
5. Usá **Compilar** con los compiladores originales de Sven Co-op SC-CSG/BSP/VIS/RAD. El `.bsp` debe quedar en `svencoop/maps/sv_blueprint_validation.bsp`.
6. Abrí Sven Co-op y ejecutá en consola: `map sv_blueprint_validation`.
7. Comprobá que el jugador aparezca dentro de la instalación, que exista una habitación exterior cerrada, que las paredes interiores tengan huecos geométricos y que se pueda atravesar la puerta central. La ventana es un hueco, **no un cristal colocado automáticamente**.

### Limitaciones

Este paquete **no incluye BSP compilado**; la prueba real de iluminación, leaks, colisiones y texturas requiere ejecutarlo en tu instalación de Sven Co-op. La geometría del archivo MAP se validó y reimportó completa, pero esto no garantiza que no existan problemas de compilación o encuentros entre brushes al probarlo en el motor.

La imagen original es una referencia del editor, no una textura incluida en el BSP.
