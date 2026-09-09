class ElouraFaq extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === 'true') return;

    this.dataset.initialized = 'true';
    this.buttons = Array.from(this.querySelectorAll('[data-faq-button]'));
    this.buttons.forEach((button) => button.addEventListener('click', () => this.toggle(button)));
  }

  toggle(activeButton) {
    const shouldOpen = activeButton.getAttribute('aria-expanded') !== 'true';

    this.buttons.forEach((button) => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const isActive = button === activeButton && shouldOpen;

      button.setAttribute('aria-expanded', String(isActive));
      if (panel) {
        panel.setAttribute('aria-hidden', String(!isActive));
        panel.inert = !isActive;
      }
    });
  }
}

if (!customElements.get('eloura-faq')) {
  customElements.define('eloura-faq', ElouraFaq);
}
