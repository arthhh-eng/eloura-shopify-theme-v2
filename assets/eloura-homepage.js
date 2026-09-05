/* Progressive enhancement: content remains visible without JS or in Theme Editor. */
(() => {
  if (window.elouraHomepageReveals) return;
  window.elouraHomepageReveals = true;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      if (!isIntersecting) return;
      target.classList.remove('eh-reveal-pending');
      pending.delete(target);
      observer.unobserve(target);
    });
  }, {threshold: 0.05}) : null;

  function initAngleViewer(viewer) {
    if (viewer.dataset.angleViewerReady) return;
    viewer.dataset.angleViewerReady = 'true';

    const slides = [...viewer.querySelectorAll('[data-angle-slide]')];
    const dots = [...viewer.querySelectorAll('[data-angle-dot]')];
    const previous = viewer.querySelector('[data-angle-previous]');
    const next = viewer.querySelector('[data-angle-next]');
    const status = viewer.querySelector('[data-angle-status]');
    const stage = viewer.querySelector('[data-angle-stage]');
    if (!slides.length || !stage) return;

    slides.forEach(slide => {
      const image = slide.querySelector('img');
      if (image) image.draggable = false;
    });

    let index = 0;
    let pointerStart = null;
    let activePointer = null;

    function showAngle(nextIndex, announce = true) {
      index = Math.max(0, Math.min(slides.length - 1, nextIndex));
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
      viewer.style.setProperty('--eh-drag-x', '0px');
      if (announce && status) {
        status.textContent = `${index + 1} / ${slides.length}: ${slides[index].dataset.angleName || ''}`;
      }
    }

    previous?.addEventListener('click', () => showAngle(index - 1));
    next?.addEventListener('click', () => showAngle(index + 1));
    dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => showAngle(dotIndex)));

    viewer.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showAngle(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showAngle(index + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        showAngle(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        showAngle(slides.length - 1);
      }
    });

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      activePointer = event.pointerId;
      pointerStart = event.clientX;
      stage.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
      if (pointerStart === null || event.pointerId !== activePointer) return;
      const offset = Math.max(-18, Math.min(18, event.clientX - pointerStart));
      viewer.style.setProperty('--eh-drag-x', `${offset}px`);
    });
    const finishPointer = event => {
      if (pointerStart === null || event.pointerId !== activePointer) return;
      const distance = pointerStart - event.clientX;
      if (Math.abs(distance) >= 32) showAngle(index + (distance > 0 ? 1 : -1));
      else viewer.style.setProperty('--eh-drag-x', '0px');
      pointerStart = null;
      activePointer = null;
    };
    stage.addEventListener('pointerup', finishPointer);
    stage.addEventListener('pointercancel', finishPointer);
    showAngle(0, false);
  }

  function initAngleViewers() {
    document.querySelectorAll('[data-angle-viewer]').forEach(initAngleViewer);
  }

  function init() {
    initAngleViewers();
    if (!observer || motion.matches || window.Shopify?.designMode) return;
    document.querySelectorAll('[data-eloura-home][data-motion="true"] [data-eh-reveal]').forEach(el => {
      if (el.dataset.ehInitialized) return;
      el.dataset.ehInitialized = 'true';
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('eh-reveal-ready', 'eh-reveal-pending');
      pending.add(el);
      observer.observe(el);
    });
  }
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    pending.forEach(el => el.classList.remove('eh-reveal-pending'));
    pending.clear();
    observer?.disconnect();
  });
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('focusin', event => {
    const el = event.target.closest('[data-eh-reveal]');
    if (!el) return;
    el.classList.remove('eh-reveal-pending');
    pending.delete(el);
    observer?.unobserve(el);
  });
  document.addEventListener('shopify:section:unload', () => {
    pending.forEach(el => { if (!el.isConnected) { observer?.unobserve(el); pending.delete(el); } });
  });
  init();
})();
