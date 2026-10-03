if (!customElements.get('eloura-review-carousel')) {
  customElements.define('eloura-review-carousel', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.eloura-reviews__track');
      this.controls = this.querySelector('.eloura-reviews__controls');
      this.prev = this.querySelector('[data-review-prev]');
      this.next = this.querySelector('[data-review-next]');
      if (!this.track || !this.controls) return;
      this.abort?.abort();
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.prev.addEventListener('click', () => this.move(-1), options);
      this.next.addEventListener('click', () => this.move(1), options);
      this.track.addEventListener('scroll', () => this.update(), { ...options, passive: true });
      this.track.addEventListener('keydown', event => {
        if (event.target !== this.track) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home' || event.key === 'End') {
          this.track.scrollTo({ left: event.key === 'Home' ? 0 : this.track.scrollWidth, behavior: 'auto' });
        } else this.move(event.key === 'ArrowLeft' ? -1 : 1);
      }, options);
      document.addEventListener('shopify:block:select', event => {
        const card = event.target.closest('.eloura-reviews__card');
        if (card && this.contains(card)) {
          this.track.scrollBy({ left: card.getBoundingClientRect().left - this.track.getBoundingClientRect().left, behavior: 'auto' });
        }
      }, options);
      this.observer = new ResizeObserver(() => this.update());
      this.observer.observe(this.track);
      this.update();
    }
    update() {
      const max = this.track.scrollWidth - this.track.clientWidth;
      this.controls.hidden = max <= 2;
      this.prev.disabled = this.track.scrollLeft <= 2;
      this.next.disabled = this.track.scrollLeft >= max - 2;
    }
    move(direction) {
      const card = this.track.firstElementChild;
      if (!card) return;
      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      this.track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    disconnectedCallback() {
      this.abort?.abort();
      this.observer?.disconnect();
    }
  });
}
