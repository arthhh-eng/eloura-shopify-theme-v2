if (!customElements.get('eloura-review-carousel')) {
  customElements.define('eloura-review-carousel', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.eloura-reviews__track');
      this.controls = this.querySelector('.eloura-reviews__controls');
      this.prev = this.querySelector('[data-review-prev]');
      this.next = this.querySelector('[data-review-next]');
      this.toggle = this.querySelector('[data-review-toggle]');
      this.dots = [...this.querySelectorAll('[data-review-dot]')];
      if (!this.track || !this.controls) return;
      this.abort?.abort();
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.delay = Number(this.dataset.autoplay) || 0;
      this.userPaused = false;
      this.holds = new Set();

      this.prev.addEventListener('click', () => this.step(-1, true), options);
      this.next.addEventListener('click', () => this.step(1, true), options);
      this.dots.forEach((dot, index) => dot.addEventListener('click', () => this.goTo(index, true), options));
      this.toggle?.addEventListener('click', () => this.setUserPaused(!this.userPaused), options);
      this.track.addEventListener('scroll', () => this.update(), { ...options, passive: true });
      this.track.addEventListener('pointerdown', event => {
        this.interrupt();
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        this.drag = { x: event.clientX, left: this.track.scrollLeft, moved: false };
        this.track.setPointerCapture(event.pointerId);
      }, options);
      this.track.addEventListener('pointermove', event => {
        if (!this.drag) return;
        const dx = event.clientX - this.drag.x;
        if (!this.drag.moved && Math.abs(dx) < 4) return;
        this.drag.moved = true;
        this.track.classList.add('is-animating', 'is-dragging');
        this.track.scrollLeft = this.drag.left - dx;
      }, options);
      const endDrag = () => {
        if (!this.drag) return;
        const { moved, left } = this.drag;
        this.drag = null;
        this.track.classList.remove('is-dragging');
        if (!moved) {
          this.track.classList.remove('is-animating');
          return;
        }
        const positions = this.positions();
        let index = this.currentIndex(positions);
        const delta = this.track.scrollLeft - left;
        if (Math.abs(delta) > 40 && index === this.indexAt(left, positions)) index += Math.sign(delta);
        this.goTo(index, true);
      };
      this.track.addEventListener('dragstart', event => event.preventDefault(), options);
      this.track.addEventListener('pointerup', endDrag, options);
      this.track.addEventListener('pointercancel', endDrag, options);
      this.track.addEventListener('wheel', event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) this.interrupt(); }, { ...options, passive: true });
      this.track.addEventListener('keydown', event => {
        if (event.target !== this.track) return;
        const keys = { ArrowLeft: -1, ArrowRight: 1 };
        if (event.key in keys) this.step(keys[event.key], true);
        else if (event.key === 'Home') this.goTo(0, true);
        else if (event.key === 'End') this.goTo(this.positions().length - 1, true);
        else return;
        event.preventDefault();
      }, options);

      this.addEventListener('mouseenter', () => this.hold('hover'), options);
      this.addEventListener('mouseleave', () => this.release('hover'), options);
      this.addEventListener('focusin', () => this.hold('focus'), options);
      this.addEventListener('focusout', event => { if (!this.contains(event.relatedTarget)) this.release('focus'); }, options);
      document.addEventListener('visibilitychange', () => document.hidden ? this.hold('hidden') : this.release('hidden'), options);
      this.reducedMotion.addEventListener('change', () => this.refreshAutoplay(), options);

      document.addEventListener('shopify:block:select', event => {
        const card = event.target.closest?.('.eloura-reviews__card');
        if (!card || !this.contains(card)) return;
        this.hold('editor');
        const cards = [...this.track.children];
        this.goTo(Math.min(cards.indexOf(card), this.positions().length - 1), false, true);
      }, options);
      document.addEventListener('shopify:block:deselect', () => this.release('editor'), options);

      this.resizeObserver = new ResizeObserver(() => this.update());
      this.resizeObserver.observe(this.track);
      this.intersectionObserver = new IntersectionObserver(([entry]) => entry.isIntersecting ? this.release('offscreen') : this.hold('offscreen'));
      this.intersectionObserver.observe(this);
      this.update();
      this.refreshAutoplay();
    }

    disconnectedCallback() {
      this.abort?.abort();
      this.resizeObserver?.disconnect();
      this.intersectionObserver?.disconnect();
      this.stopTimer();
      cancelAnimationFrame(this.frame);
    }

    positions() {
      const max = Math.max(0, this.track.scrollWidth - this.track.clientWidth);
      if (max < 12) return [0];
      const start = parseFloat(getComputedStyle(this.track).paddingLeft) || 0;
      const list = [];
      for (const card of this.track.children) {
        const left = Math.min(Math.max(card.offsetLeft - start, 0), max);
        if (!list.length || left - list[list.length - 1] > 2) list.push(left);
        if (left >= max) break;
      }
      return list.length ? list : [0];
    }

    currentIndex(positions = this.positions()) {
      return this.indexAt(this.track.scrollLeft, positions);
    }

    indexAt(left, positions) {
      return positions.reduce((best, value, index) => Math.abs(value - left) < Math.abs(positions[best] - left) ? index : best, 0);
    }

    update() {
      const positions = this.positions();
      const scrollable = positions.length > 1;
      const index = this.animating ? this.targetIndex : this.currentIndex(positions);
      this.controls.hidden = !scrollable;
      if (this.toggle && this.toggle.hidden === this.autoplayEnabled()) this.refreshAutoplay();
      this.prev.disabled = index <= 0;
      this.next.disabled = index >= positions.length - 1;
      this.dots.forEach((dot, i) => {
        dot.hidden = i >= positions.length;
        dot.setAttribute('aria-current', String(i === index));
      });
    }

    step(direction, fromUser) {
      this.goTo(this.currentIndex() + direction, fromUser);
    }

    goTo(index, fromUser, instant = false) {
      const positions = this.positions();
      this.targetIndex = Math.max(0, Math.min(index, positions.length - 1));
      if (fromUser) this.interrupt();
      this.scrollToLeft(positions[this.targetIndex], instant ? 0 : 520);
    }

    scrollToLeft(left, duration) {
      cancelAnimationFrame(this.frame);
      const from = this.track.scrollLeft;
      const distance = left - from;
      if (this.reducedMotion.matches || duration === 0 || Math.abs(distance) < 1) {
        this.animating = false;
        this.track.classList.remove('is-animating');
        this.track.scrollLeft = left;
        this.update();
        return;
      }
      this.animating = true;
      this.track.classList.add('is-animating');
      const startTime = performance.now();
      const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const tick = now => {
        const progress = Math.min((now - startTime) / duration, 1);
        this.track.scrollLeft = from + distance * ease(progress);
        if (progress < 1) {
          this.frame = requestAnimationFrame(tick);
        } else {
          this.animating = false;
          this.track.classList.remove('is-animating');
          this.update();
        }
      };
      this.frame = requestAnimationFrame(tick);
      this.update();
    }

    interrupt() {
      if (this.animating) {
        cancelAnimationFrame(this.frame);
        this.animating = false;
        this.track.classList.remove('is-animating');
      }
      if (this.autoplayEnabled() && !this.userPaused) this.setUserPaused(true);
    }

    autoplayEnabled() {
      return this.delay > 0 && !this.reducedMotion.matches && this.positions().length > 1;
    }

    refreshAutoplay() {
      const enabled = this.autoplayEnabled();
      if (this.toggle) this.toggle.hidden = !enabled;
      this.restartTimer();
    }

    setUserPaused(paused) {
      this.userPaused = paused;
      if (this.toggle) {
        this.toggle.classList.toggle('is-paused', paused);
        this.toggle.setAttribute('aria-label', paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
      }
      this.restartTimer();
    }

    hold(reason) {
      this.holds.add(reason);
      this.restartTimer();
    }

    release(reason) {
      this.holds.delete(reason);
      this.restartTimer();
    }

    stopTimer() {
      clearInterval(this.timer);
      this.timer = null;
    }

    restartTimer() {
      this.stopTimer();
      if (!this.autoplayEnabled() || this.userPaused || this.holds.size) return;
      this.timer = setInterval(() => {
        const positions = this.positions();
        const next = this.currentIndex(positions) + 1;
        if (next < positions.length) {
          this.goTo(next, false);
        } else {
          this.targetIndex = 0;
          this.scrollToLeft(0, 900);
        }
      }, this.delay);
    }
  });
}
