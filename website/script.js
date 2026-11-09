'use strict';

// This is a static landing page. It does not contain or run the SvenStudio editor.
const copy = {
  en: {
    skip:'Skip to content',navFeatures:'Features',navGallery:'Showcase',navHow:'How it works',navDownload:'Downloads',navGet:'Get SvenStudio',
    heroEyebrow:'A NEW WAY TO BUILD FOR SVEN CO-OP',heroLine1:'Your worlds.',heroLine2:'Your vision.',heroLine3:'Your editor.',heroDescription:'A powerful, approachable 3D map editor built for Sven Co-op and the GoldSrc / Svengine ecosystem. Create, texture, light and compile — all through a modern local browser workspace.',heroCta:'Download for Windows',heroSecondary:'Explore the editor',heroMeta2:'6 interface languages',heroMeta3:'Local-first workflow',
    featuresKicker:'BUILT FOR CREATORS',featuresTitle:'Everything your next map needs.',featuresDescription:'From your first brush to complex gameplay systems, work with tools designed around the way you build.',
    feature1Title:'Advanced 3D editing',feature1Desc:'Create and edit brushes, vertices and faces with precise gizmos, CSG operations, snapping and reusable prefabs.',
    feature2Title:'Textures without the friction',feature2Desc:'Browse WAD textures, adjust UV alignment directly and fine-tune surfaces with Texture Studio 2.0.',
    feature3Title:'See your lighting come alive',feature3Desc:'Inspect compiled RGB lightmaps with True Lighting and configure SC-RAD or experimental SDHLT options.',
    feature4Title:'Build the world behind the world',feature4Desc:'Edit native FGD entities, inspect logic in Gameplay Studio and configure NPCs, sounds and cameras.',
    feature5Title:'Create together',feature5Desc:'BuildTogether enables shared editing sessions, remote cursors and collaborative map creation over a private network.',
    feature6Title:'From editor to game',feature6Desc:'Explore BSP files, run SC compilation tools and catch problems using Map Doctor and visual leak tracing.',
    showcaseKicker:'INSIDE THE WORKSPACE',showcaseTitle:'Made to be explored.',showcaseDesc:'Real screenshots from the SvenStudio 3D project. Select any image to see it in detail.',gallery1:'The 3D workspace',gallery2:'True Lighting',gallery3:'BSP Viewer',gallery4:'Terrain & shapes',gallery5:'Gameplay Studio',gallery6:'BuildTogether',showcaseFooter:'More images and technical details are available in the project README.',showcaseLink:'See the full gallery',
    workflowKicker:'YOUR CREATIVE PIPELINE',workflowTitle:'A simple start. Serious possibilities.',workflowDesc:'SvenStudio is downloaded and started locally on Windows. This website is a showcase — not an online editor.',
    step1Title:'Download & extract',step1Desc:'Get the complete Windows archive from the official Releases page and extract the full package.',step2Title:'Launch your workspace',step2Desc:'Run SvenStudio3D.bat. The editor opens locally in your browser, with no separate system-wide Node.js install for the complete package.',step3Title:'Create, compile, play',step3Desc:'Build your world, configure Sven Co-op SDK resources and compile your map. Test the result in-game.',
    downloadEyebrow:'YOUR NEXT WORLD STARTS HERE',downloadTitle1:'Start building',downloadTitle2:'something bigger.',downloadDesc:'Get SvenStudio 3D for Windows x64. Official releases include the files needed to run the local editor. Sven Co-op and its SDK are used for in-game testing and map compilation.',downloadCta:'Go to latest release',downloadGithub:'View source on GitHub',releaseDefault:'Latest published release on GitHub',downloadNote:'Always verify compiled maps in Sven Co-op. Some advanced features are experimental.',
    questionTitle:'Made for the Sven Co-op community.',questionText:'Explore documentation, follow development or report an issue. SvenStudio 3D is an independent community project and is not affiliated with Valve or the Sven Co-op team.',questionLink:'Project issues & feedback',footerTagline:'A better way to imagine worlds for Sven Co-op.',footerProject:'PROJECT',footerReleases:'Releases',footerIssues:'Issues',footerCommunity:'COMMUNITY',footerDocs:'Documentation',footerCredit:'Created by KZ-Sheez · AI-assisted development',backTop:'Back to top',releaseVersion:'Latest published release:'
  },
  es: {
    skip:'Ir al contenido',navFeatures:'Funciones',navGallery:'Galería',navHow:'Cómo funciona',navDownload:'Descargas',navGet:'Descargar SvenStudio',
    heroEyebrow:'UNA NUEVA FORMA DE CREAR MAPAS PARA SVEN CO-OP',heroLine1:'Tus mundos.',heroLine2:'Tu visión.',heroLine3:'Tu editor.',heroDescription:'Un potente editor de mapas 3D, fácil de usar y creado para Sven Co-op y el ecosistema GoldSrc / Svengine. Construí, aplicá texturas, iluminá y compilá desde un espacio de trabajo moderno que se ejecuta localmente en tu navegador.',heroCta:'Descargar para Windows',heroSecondary:'Conocer el editor',heroMeta2:'6 idiomas de interfaz',heroMeta3:'Trabajo local',
    featuresKicker:'PENSADO PARA CREADORES',featuresTitle:'Todo lo que necesita tu próximo mapa.',featuresDescription:'Desde tu primer brush hasta sistemas de juego complejos, con herramientas que se adaptan a tu forma de construir.',
    feature1Title:'Edición 3D avanzada',feature1Desc:'Creá y editá brushes, vértices y caras con gizmos precisos, operaciones CSG, ajuste a la grilla y prefabs reutilizables.',
    feature2Title:'Texturas sin complicaciones',feature2Desc:'Explorá texturas WAD, ajustá las UV directamente y perfeccioná superficies con Texture Studio 2.0.',
    feature3Title:'Iluminación que cobra vida',feature3Desc:'Inspeccioná mapas de luz RGB compilados con True Lighting y configurá SC-RAD o las opciones experimentales de SDHLT.',
    feature4Title:'Dale vida a tus mapas',feature4Desc:'Editá entidades FGD originales, inspeccioná la lógica en Gameplay Studio y configurá NPC, sonidos y cámaras.',
    feature5Title:'Construyan juntos',feature5Desc:'BuildTogether permite sesiones de edición compartida, cursores remotos y creación colaborativa mediante una red privada.',
    feature6Title:'Del editor al juego',feature6Desc:'Explorá archivos BSP, ejecutá las herramientas de compilación SC y detectá problemas con Map Doctor y el trazado visual de leaks.',
    showcaseKicker:'CONOCÉ EL ESPACIO DE TRABAJO',showcaseTitle:'Un editor para explorar.',showcaseDesc:'Capturas reales del proyecto SvenStudio 3D. Seleccioná cualquier imagen para verla en detalle.',gallery1:'Editor de mapas 3D',gallery2:'True Lighting',gallery3:'Visor BSP',gallery4:'Terrenos y formas',gallery5:'Gameplay Studio',gallery6:'BuildTogether',showcaseFooter:'Hay más imágenes y detalles técnicos en el README del proyecto.',showcaseLink:'Ver galería completa',
    workflowKicker:'TU PROCESO CREATIVO',workflowTitle:'Fácil de empezar. Listo para crear.',workflowDesc:'SvenStudio se descarga y ejecuta localmente en Windows. Esta página es una presentación, no un editor online.',
    step1Title:'Descargá y extraé',step1Desc:'Descargá el paquete completo para Windows desde Releases y extraé todos sus archivos.',step2Title:'Iniciá el editor',step2Desc:'Ejecutá SvenStudio3D.bat. El editor se abre localmente en el navegador y el paquete completo no exige instalar Node.js globalmente.',step3Title:'Creá, compilá y jugá',step3Desc:'Construí tu mundo, configurá los recursos de Sven Co-op SDK y compilá el mapa. Probá el resultado dentro del juego.',
    downloadEyebrow:'TU PRÓXIMO MUNDO COMIENZA ACÁ',downloadTitle1:'Empezá a construir',downloadTitle2:'algo mucho más grande.',downloadDesc:'Descargá SvenStudio 3D para Windows x64. Las versiones completas incluyen los archivos necesarios para ejecutar el editor local. Sven Co-op y su SDK se utilizan para probar y compilar mapas.',downloadCta:'Ir a la última versión',downloadGithub:'Ver código en GitHub',releaseDefault:'Última versión publicada en GitHub',downloadNote:'Comprobá siempre los mapas compilados dentro de Sven Co-op. Algunas funciones avanzadas son experimentales.',
    questionTitle:'Creado para la comunidad de Sven Co-op.',questionText:'Consultá la documentación, seguí el desarrollo o reportá problemas. SvenStudio 3D es un proyecto independiente de la comunidad y no está afiliado a Valve ni al equipo de Sven Co-op.',questionLink:'Problemas y sugerencias',footerTagline:'Una mejor forma de imaginar mundos para Sven Co-op.',footerProject:'PROYECTO',footerReleases:'Versiones',footerIssues:'Problemas',footerCommunity:'COMUNIDAD',footerDocs:'Documentación',footerCredit:'Creado por KZ-Sheez · Desarrollo asistido por IA',backTop:'Volver arriba',releaseVersion:'Última versión publicada:'
  }
};

const languageToggle = document.querySelector('#language-toggle');
const releaseStatus = document.querySelector('#release-status');
let currentRelease = null;
let language = 'en'; // Match the project's English-first home page.

function applyLanguage(next) {
  language = next === 'es' ? 'es' : 'en';
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (Object.hasOwn(copy[language], key)) element.textContent = copy[language][key];
  });
  languageToggle.textContent = language === 'en' ? 'ES / EN' : 'ES / EN';
  languageToggle.setAttribute('aria-label', language === 'en' ? 'Cambiar a español' : 'Switch to English');
  languageToggle.title = language === 'en' ? 'Cambiar a español' : 'Switch to English';
  if (currentRelease) releaseStatus.textContent = `${copy[language].releaseVersion} ${currentRelease}`;
  document.title = language === 'en' ? 'SvenStudio 3D — Official Website' : 'SvenStudio 3D — Página oficial';
  try { window.localStorage.setItem('svenstudio-website-language', language); } catch (_) { /* Privacy mode */ }
}

try { language = window.localStorage.getItem('svenstudio-website-language') === 'es' ? 'es' : 'en'; } catch (_) { /* Privacy mode */ }
applyLanguage(language);
languageToggle.addEventListener('click', () => applyLanguage(language === 'en' ? 'es' : 'en'));

const mobileToggle = document.querySelector('#mobile-toggle');
const mainNav = document.querySelector('#main-nav');
function closeNav() { mainNav.classList.remove('open'); mobileToggle.setAttribute('aria-expanded', 'false'); }
mobileToggle.addEventListener('click', () => {
  const opening = !mainNav.classList.contains('open');
  mainNav.classList.toggle('open', opening);
  mobileToggle.setAttribute('aria-expanded', String(opening));
});
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
window.addEventListener('resize', () => { if (window.innerWidth > 850) closeNav(); });

document.querySelector('#year').textContent = String(new Date().getFullYear());

// Optional best-effort release version lookup. Links work even if the GitHub API is unavailable.
(async function showLatestRelease() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://api.github.com/repos/KazamiiSC/SvenStudio3D/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal
    });
    if (!response.ok) return;
    const result = await response.json();
    if (typeof result.tag_name !== 'string' || !/^v?[a-z0-9][a-z0-9._-]{0,45}$/i.test(result.tag_name)) return;
    currentRelease = result.tag_name;
    releaseStatus.textContent = `${copy[language].releaseVersion} ${currentRelease}`;
  } catch (_) { /* Fallback already displayed */ }
  finally { clearTimeout(timeout); }
})();

const galleryButtons = Array.from(document.querySelectorAll('.gallery-card'));
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const lightboxClose = document.querySelector('#lightbox-close');
let activeImageIndex = 0;
let lastTrigger = null;
function showImage(index) {
  activeImageIndex = (index + galleryButtons.length) % galleryButtons.length;
  const button = galleryButtons[activeImageIndex];
  lightboxImage.src = button.dataset.full;
  lightboxImage.alt = button.querySelector('img').alt;
  lightboxCaption.textContent = button.dataset.title;
}
function openLightbox(index, trigger) {
  lastTrigger = trigger;
  showImage(index);
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}
function closeLightbox() {
  if (!lightbox.classList.contains('open')) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  lightboxImage.removeAttribute('src');
  if (lastTrigger) lastTrigger.focus();
}
galleryButtons.forEach((button, index) => button.addEventListener('click', () => openLightbox(index, button)));
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', event => {
  if (!lightbox.classList.contains('open')) { if (event.key === 'Escape') closeNav(); return; }
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowRight') showImage(activeImageIndex + 1);
  if (event.key === 'ArrowLeft') showImage(activeImageIndex - 1);
  if (event.key === 'Tab') { event.preventDefault(); lightboxClose.focus(); }
});
