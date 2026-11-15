# SvenStudio 3D — sitio web actualizado para v2.1

**Entrega:** 15 de noviembre de 2026. Sitio estático HTML, CSS y JavaScript, sin compilación ni dependencias npm.

## Qué se actualizó

- Se mantuvo el estilo visual oscuro/cian y la estructura principal de la web entregada en `website.rar`.
- Se retiraron todas las **capturas antiguas**, miniaturas de respaldo y referencias de imágenes alojadas en GitHub user-attachments. Se conservó únicamente el **logo de Sven Co-op** como elemento identificativo de la sección del juego y el ícono SVG del sitio.
- Se integraron las **21 capturas de `Imagenes.rar`** y la **imagen adicional `SvenStudio 3D.png`** (22 imágenes distintas). Todas están incluidas en el ZIP; no dependen de un servidor de imágenes externo.
- La portada utiliza la nueva captura de bienvenida.
- La galería contiene las 22 capturas, filtros por tipo, contador, vista ampliada, navegación con flechas del teclado y enlace a **PNG original** por imagen.
- Se documentaron **42 áreas, estudios y herramientas principales** según el código fuente y la documentación del ZIP de SvenStudio 3D v2.1: funciones, descripciones, búsqueda y filtros.
- Se mantuvieron el cambio de idioma **español / inglés**, el diseño responsive y los enlaces a GitHub Releases y Sven Co-op en Steam.

## Archivos

- `index.html`: sitio principal.
- `site-v21.css`: estilos añadidos para directorio de funciones, galería y visor de imágenes.
- `site-v21.js`: idioma, búsqueda, filtros, navegación móvil, lightbox y teclado.
- `content-v21.json`: inventario editable de las 42 funciones y 22 capturas usadas.
- `assets/screenshots/*.webp`: imágenes optimizadas para la carga de la web, en alta definición.
- `assets/screenshots/originals/*.png`: capturas originales sin alterar (21 PNG del RAR más `SvenStudio 3D.png`).
- `assets/sven-coop-logo.png`: logo del juego; `assets/svenstudio-mark.svg`: icono de sitio.
- `.nojekyll`, `robots.txt` y `sitemap.xml`: archivos para publicación estática.

## Cómo abrir o publicar

1. Extraé completamente el ZIP.
2. Abrí `website/index.html` en Chrome o Firefox para ver la web sin instalar nada. También podés servir la carpeta como sitio estático local.
3. Para actualizar GitHub Pages, publicá el **contenido dentro de `website/`** en la raíz del sitio o en la carpeta elegida para Pages. Debe quedar `index.html` en la raíz pública, junto con `site-v21.css`, `site-v21.js` y `assets/`.
4. Conservá toda la carpeta `assets/screenshots/` para que funcione la galería y el enlace a PNG originales.

**Importante:** esta página **presenta** SvenStudio 3D, no ejecuta el editor ni contiene el paquete de instalación del programa. El botón de descarga lleva al repositorio original en GitHub Releases.

## Fuente de las descripciones

La base de referencia es el ZIP `SvenStudio3D_v2.1_PORTABLE_WINDOWS_X64_PRIMERA_INSTALACION (1).zip` facilitado para esta tarea. Se revisaron su README, los documentos técnicos v2.1 / HF10–HF22 y los componentes en `src/components`.

Algunos estudios ofrecen *vistas previas* o herramientas de reconstrucción aproximadas; la web no afirma que reemplacen las pruebas dentro de Sven Co-op, ni que las ediciones BSP recalculen automáticamente visibilidad, colisiones o nueva iluminación. Se mantiene la advertencia sobre pruebas y las limitaciones del producto.

## Comprobaciones de esta entrega

- 22/22 imágenes WebP y 22/22 PNG originales presentes.
- 42 fichas con descripciones y tres detalles cada una en ES y EN.
- Todos los enlaces locales del HTML apuntan a archivos incluidos.
- Búsqueda de herramientas, filtros, idiomas, lightbox, anterior/siguiente, Escape y menú móvil comprobados con Chromium automatizado, sin errores JavaScript.
- Sin desbordamiento horizontal a 390 px tras corregir filtros desplazables.

No se han modificado los archivos de la aplicación de SvenStudio 3D: el archivo ZIP del programa se utilizó exclusivamente como fuente para documentar la web.
