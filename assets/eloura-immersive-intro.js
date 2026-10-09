/* Native scrolling drives one sticky scene (brand, then the three products). No wheel/touch interception or animation library. */
if (!customElements.get('eloura-immersive-intro')) {
  customElements.define('eloura-immersive-intro', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.ei-track');
      this.stage = this.querySelector('.ei-stage');
      this.scenes = [...this.querySelectorAll('[data-scene]')];
      this.brand = this.querySelector('[data-scene="brand"]');
      this.trio = this.querySelector('[data-scene="trio"]');
      this.items = [...this.querySelectorAll('.ei-trio-item')];
      this.key = `eloura-intro:${this.dataset.section}:v1`;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.schedule = () => {
        if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
      };
      this.configure = this.configure.bind(this);
      this.querySelector('.ei-replay')?.addEventListener('click', () => {
        this.classList.remove('is-skipped');
        this.remember(false);
        this.configure();
        this.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, options);
      window.addEventListener('resize', this.configure, options);
      this.motion.addEventListener('change', this.configure, options);
      document.addEventListener('shopify:block:select', event => {
        if (this.contains(event.target)) this.simplify();
      }, options);
      try {
        if (this.dataset.session === 'true' && !window.Shopify?.designMode && sessionStorage.getItem(this.key)) {
          this.classList.add('is-skipped');
        }
      } catch (_) { /* Storage can be unavailable in private browsing. */ }
      this.querySelector('.ei-replay')?.removeAttribute('hidden');
      this.configure();
      document.fonts?.ready.then(() => { if (this.isConnected) this.configure(); });
    }
    remember(done) {
      if (this.dataset.session !== 'true' || window.Shopify?.designMode) return;
      try { done ? sessionStorage.setItem(this.key, '1') : sessionStorage.removeItem(this.key); } catch (_) { /* Optional preference. */ }
    }
    finish() { this.remember(true); }
    simplify() {
      this.classList.remove('is-enhanced');
      this.scenes.forEach(scene => { scene.style.removeProperty('opacity'); scene.classList.remove('is-active'); });
      this.items.forEach(item => { item.style.removeProperty('opacity'); item.style.removeProperty('transform'); });
    }
    configure() {
      this.root?.removeEventListener('scroll', this.schedule);
      const wrapper = this.closest('.page-wrapper');
      // This theme scrolls its wrapper on desktop and the document on mobile.
      // Cookie/dialog scroll locks temporarily set overflow:hidden; they must not change the scroll root.
      this.root = wrapper && matchMedia('(min-width: 990px)').matches ? wrapper : window;
      this.root.addEventListener('scroll', this.schedule, { passive: true });
      if (this.motion.matches || innerHeight < 560 || !this.trio || !this.items.length) {
        this.simplify(); return;
      }
      this.classList.add('is-enhanced');
      // Long translations, custom copy and zoom get a readable static fallback.
      const list = this.trio.querySelector('.ei-trio-list');
      if (list.offsetHeight + 132 > this.stage.clientHeight) { this.simplify(); return; }
      this.schedule();
    }
    paint() {
      if (!this.classList.contains('is-enhanced') || this.classList.contains('is-skipped')) return;
      const clamp = value => Math.max(0, Math.min(1, value));
      const rootTop = this.root === window ? 0 : this.root.getBoundingClientRect().top;
      const distance = this.track.offsetHeight - this.stage.offsetHeight;
      const progress = clamp((rootTop - this.track.getBoundingClientRect().top) / Math.max(1, distance));
      // One short scroll: the brand screen fades out, then CLEAR | HYDRA | BARRIER settle in and hold.
      this.style.setProperty('--ei-progress', progress);
      this.brand.style.opacity = 1 - clamp((progress - .08) / .22);
      const trioOpacity = clamp((progress - .15) / .2);
      this.trio.style.opacity = trioOpacity;
      // Products only take taps once they are clearly visible, so a tap on the brand screen never opens a page.
      this.trio.classList.toggle('is-active', trioOpacity > .6);
      this.items.forEach((item, index) => {
        const local = clamp((progress - .18 - index * .05) / .25);
        item.style.opacity = local;
        item.style.transform = `translateY(${(1 - local) * 24}px)`;
      });
      if (progress >= .995) this.finish();
    }
    disconnectedCallback() {
      this.abort?.abort();
      this.root?.removeEventListener('scroll', this.schedule);
      cancelAnimationFrame(this.frame);
    }
  });
}
