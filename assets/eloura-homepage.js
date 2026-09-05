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
  function init() {
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
