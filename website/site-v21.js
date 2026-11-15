/* SvenStudio 3D — v2.1 website interactions. No external JS / APIs required. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const shots = $$('.shot[data-shot]');
  const cards = $$('.catalog-card');
  const search = $('#tool-search');
  const modal = $('#lightbox');
  const viewer = $('#lightbox-img');
  let lang = 'es';
  let toolCategory = 'all';
  let galleryCategory = 'all';
  let currentShot = null;
  let priorFocus = null;
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const translated = (element) => element?.dataset?.[lang] || element?.textContent || '';

  function updateToolGrid() {
    const query = normalize(search?.value);
    let shown = 0;
    cards.forEach((card) => {
      const matchCategory = toolCategory === 'all' || card.dataset.category === toolCategory;
      const matchSearch = !query || normalize(card.dataset.catalogSearch).includes(query);
      card.hidden = !(matchCategory && matchSearch);
      if (!card.hidden) shown++;
    });
    const count = $('#tool-count');
    if (count) count.textContent = `${shown} ${lang === 'es' ? (shown === 1 ? 'herramienta' : 'herramientas') : (shown === 1 ? 'tool' : 'tools')}`;
    if ($('#tools-empty')) $('#tools-empty').hidden = shown !== 0;
  }
  function updateGallery() {
    let visible = 0;
    shots.forEach((shot) => {
      shot.hidden = galleryCategory !== 'all' && shot.dataset.category !== galleryCategory;
      if (!shot.hidden) visible++;
    });
    const count = $('#gallery-count');
    if (count) count.textContent = `${visible} ${lang === 'es' ? (visible === 1 ? 'captura' : 'capturas') : (visible === 1 ? 'screenshot' : 'screenshots')}`;
  }
  function setLanguage(value) {
    lang = value === 'en' ? 'en' : 'es';
    document.documentElement.lang = lang;
    $$('[data-es][data-en]').forEach((element) => {
      element.textContent = element.dataset[lang];
    });
    $$('[data-placeholder-es][data-placeholder-en]').forEach((element) => {
      element.placeholder = element.dataset[`placeholder${lang === 'es' ? 'Es' : 'En'}`];
    });
    const control = $('#lang');
    if (control) {
      control.textContent = lang === 'es' ? 'ES / EN' : 'EN / ES';
      control.setAttribute('aria-label', lang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish');
    }
    $('#hamb')?.setAttribute('aria-label', lang === 'es' ? 'Abrir menú' : 'Open menu');
    shots.forEach((shot) => { shot.setAttribute('aria-label', translated(shot.querySelector('.shot-desc strong span'))); });
    updateToolGrid();
    updateGallery();
    if (currentShot) showShot(currentShot);
    try { window.localStorage.setItem('svenstudio-web-lang',''+lang); } catch { /* private mode */ }
  }
  try { lang = window.localStorage.getItem('svenstudio-web-lang') === 'en' ? 'en' : 'es'; } catch { /* private mode */ }
  setLanguage(lang);
  $('#lang')?.addEventListener('click',() => setLanguage(lang === 'es' ? 'en' : 'es'));

  const nav = $('#main-nav');
  const menu = $('#hamb');
  const closeNav = () => { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded','false'); };
  menu?.addEventListener('click',() => {
    const opened = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded',String(opened));
  });
  $$('#main-nav a').forEach((a) => a.addEventListener('click',closeNav));

  $$('[data-tool-filter]').forEach((button) => {
    button.addEventListener('click',() => {
      toolCategory = button.dataset.toolFilter;
      $$('[data-tool-filter]').forEach((b) => {
        const active = b === button;
        b.classList.toggle('active',active);
        b.setAttribute('aria-pressed',String(active));
      });
      updateToolGrid();
    });
  });
  search?.addEventListener('input',updateToolGrid);
  $$('[data-gallery-filter]').forEach((button) => {
    button.addEventListener('click',() => {
      galleryCategory = button.dataset.galleryFilter;
      $$('[data-gallery-filter]').forEach((b) => {
        const active = b === button;
        b.classList.toggle('active',active);
        b.setAttribute('aria-pressed',String(active));
      });
      updateGallery();
    });
  });

  function showShot(shot) {
    currentShot = shot;
    const source = shot.querySelector('img');
    const name = translated(shot.querySelector('.shot-desc strong span'));
    const description = translated(shot.querySelector('.shot-desc small span'));
    viewer.src = source.getAttribute('src');
    viewer.alt = description;
    $('#lightbox-name').textContent = name;
    $('#lightbox-desc').textContent = description;
    const sequence = shots.filter((item) => !item.hidden);
    const idx = sequence.indexOf(shot);
    const actual = idx < 0 ? shots.indexOf(shot) + 1 : idx + 1;
    $('#lightbox-index').textContent = `${actual} / ${idx < 0 ? shots.length : sequence.length}`;
    const original = $('#lightbox-original');
    original.href = shot.dataset.original;
    original.download = shot.dataset.original.split('/').at(-1);
  }
  function openShot(shot) {
    priorFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    showShot(shot);
    $('#close-lightbox').focus();
  }
  function closeShot() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
    viewer.removeAttribute('src');
    currentShot = null;
    priorFocus?.focus?.();
  }
  function stepShot(delta) {
    if (!currentShot) return;
    const visible = shots.filter((item) => !item.hidden);
    const sequence = visible.includes(currentShot) ? visible : shots;
    const index = sequence.indexOf(currentShot);
    showShot(sequence[(index + delta + sequence.length) % sequence.length]);
  }
  shots.forEach((shot) => shot.addEventListener('click',() => openShot(shot)));
  $$('[data-show-shot]').forEach((button) => button.addEventListener('click',() => {
    const shot = shots.find((item) => item.dataset.imageId === button.dataset.showShot);
    if (shot) openShot(shot);
  }));
  $('#close-lightbox')?.addEventListener('click',closeShot);
  $('#lightbox-prev')?.addEventListener('click',() => stepShot(-1));
  $('#lightbox-next')?.addEventListener('click',() => stepShot(1));
  modal?.addEventListener('click',(event) => { if (event.target === modal) closeShot(); });
  document.addEventListener('keydown',(event) => {
    if (!modal?.classList.contains('open')) {
      if (event.key === 'Escape') closeNav();
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); closeShot(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepShot(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); stepShot(1); }
    if (event.key === 'Tab') {
      const controls = $$('#lightbox button, #lightbox a').filter((n) => !n.disabled);
      const first = controls[0],last = controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault();last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
    }
  });

  if (window.matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches) {
    const hero = $('.hero'),preview = $('#hero-window');
    let raf = 0;
    hero?.addEventListener('pointermove',(event) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const box = hero.getBoundingClientRect();
        const x = (event.clientX-box.left-box.width/2)/box.width;
        const y = (event.clientY-box.top-box.height/2)/box.height;
        preview?.style.setProperty('--float-x', `${(x*7).toFixed(1)}px`);
        preview?.style.setProperty('--float-y', `${(y*5).toFixed(1)}px`);
        raf = 0;
      });
    });
    hero?.addEventListener('pointerleave',() => {
      preview?.style.setProperty('--float-x','0px');
      preview?.style.setProperty('--float-y','0px');
    });
  }
})();
