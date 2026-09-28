/* Native scrolling drives one sticky scene. No wheel/touch interception or animation library. */
if (!customElements.get('eloura-immersive-intro')) {
  customElements.define('eloura-immersive-intro', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.ei-track');
      this.stage = this.querySelector('.ei-stage');
      this.scenes = [...this.querySelectorAll('[data-scene]')];
      this.products = this.scenes.filter(scene => scene.dataset.scene === 'product');
      this.end = this.querySelector('.ei-end');
      this.key = `eloura-intro:${this.dataset.section}:v1`;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.schedule = () => {
        if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
      };
      this.configure = this.configure.bind(this);
      this.querySelector('.ei-skip').addEventListener('click', event => {
        event.preventDefault();
        this.finish();
        this.end.focus({ preventScroll: true });
        this.end.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, options);
      this.querySelector('.ei-replay')?.addEventListener('click', () => {
        this.classList.remove('is-skipped');
        this.remember(false);
        this.configure();
        this.scrollIntoView({ behavior: 'instant', block: 'start' });
        this.querySelector('.ei-skip').focus({ preventScroll: true });
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
      this.scenes.forEach(scene => {
        scene.style.removeProperty('opacity');
        scene.querySelectorAll('[data-story], .ei-bottle, .ei-angle, .ei-atmosphere').forEach(node => {
          node.style.removeProperty('opacity'); node.style.removeProperty('transform');
        });
      });
      this.style.removeProperty('--ei-control');
    }
    configure() {
      this.root?.removeEventListener('scroll', this.schedule);
      const wrapper = this.closest('.page-wrapper');
      // This theme scrolls its wrapper on desktop and the document on mobile.
      // Cookie/dialog scroll locks temporarily set overflow:hidden; they must not change the scroll root.
      this.root = wrapper && matchMedia('(min-width: 990px)').matches ? wrapper : window;
      this.root.addEventListener('scroll', this.schedule, { passive: true });
      if (this.motion.matches || innerHeight < 560 || !this.products.length) {
        this.simplify(); return;
      }
      this.classList.add('is-enhanced');
      // Long translations, custom copy and zoom get a readable static fallback.
      const tooTall = this.products.some(scene => {
        const copy = scene.querySelector('.ei-copy');
        return copy.offsetHeight + 310 > this.stage.clientHeight && innerWidth < 750;
      });
      if (tooTall) { this.simplify(); return; }
      this.schedule();
    }
    paint() {
      if (!this.classList.contains('is-enhanced') || this.classList.contains('is-skipped')) return;
      const clamp = value => Math.max(0, Math.min(1, value));
      const rootTop = this.root === window ? 0 : this.root.getBoundingClientRect().top;
      const distance = this.track.offsetHeight - this.stage.offsetHeight;
      const progress = clamp((rootTop - this.track.getBoundingClientRect().top) / Math.max(1, distance));
      const width = .78 / this.products.length;
      const ranges = [[0, .10], ...this.products.map((_, i) => [.10 + i * width, .10 + (i + 1) * width]), [.88, 1]];
      this.style.setProperty('--ei-progress', progress);
      this.style.setProperty('--ei-control', progress < .09 ? '#fff' : '#171717');
      this.scenes.forEach((scene, index) => {
        const [start, end] = ranges[index];
        const local = clamp((progress - start) / (end - start));
        const opacity = index === 0 ? 1 - clamp((progress - .075) / .035)
          : clamp((progress - start + .015) / .025) * (index === this.scenes.length - 1 ? 1 : 1 - clamp((progress - end + .01) / .025));
        scene.style.opacity = opacity;
        if (scene.dataset.scene === 'product') {
          const bottle = scene.querySelector('.ei-bottle');
          const scale = bottle.classList.contains('ei-bottle--hydra') ? .88 : 1;
          bottle.style.transform = `translateY(${(1-local)*14}px) rotate(${(local-.5)*5}deg) scale(${scale*(.97 + .03*Math.sin(local*Math.PI))})`;
          const pose = 2 * Math.sin(Math.PI * local);
          const angles = [...bottle.querySelectorAll('.ei-angle')];
          angles.forEach((image, angle) => { image.style.opacity = angles.length === 1 ? 1 : clamp(1 - Math.abs(pose - angle)); });
          scene.querySelector('.ei-atmosphere').style.transform = `scale(${.88+local*.15}) rotate(${local*12}deg)`;
          const story = [...scene.querySelectorAll('[data-story]')];
          const beat = local * 4;
          story.forEach((line, step) => {
            const incoming = step === 0 ? 1 : clamp((beat-step) / .18);
            const outgoing = step === 3 ? 1 : 1-clamp((beat-step-.90)/.18);
            line.style.opacity = incoming*outgoing;
            line.style.transform = `translateY(${(1-incoming)*9}px)`;
          });
        }
        if (scene.dataset.scene === 'group') {
          scene.querySelectorAll('.ei-bottle').forEach((bottle, i) => {
            const scale = bottle.classList.contains('ei-bottle--hydra') ? .88 : 1;
            bottle.style.transform = `translate(${(i-1)*(1-local)*24}px, ${(1-local)*(i===1?28:12)}px) scale(${scale})`;
          });
        }
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
