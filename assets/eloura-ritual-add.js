import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';
import { fetchConfig } from '@theme/utilities';

/**
 * Adds the Routine page's ritual offer to the cart without leaving the page, so it
 * behaves like every other Add to cart button (the cart drawer opens and updates).
 * Without JavaScript, or if anything here fails, the plain form still posts to /cart/add.
 */
class ElouraRitualAdd extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.form?.addEventListener('submit', this.#onSubmit);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.#onSubmit);
  }

  /** @param {SubmitEvent} event */
  #onSubmit = (event) => {
    const form = this.form;
    if (!form || !window.Theme?.routes?.cart_add_url) return;
    event.preventDefault();

    const button = form.querySelector('[type="submit"]');
    button?.setAttribute('aria-busy', 'true');

    const formData = new FormData(form);
    const sectionIds = [...document.querySelectorAll('cart-items-component')]
      .map((element) => element instanceof HTMLElement && element.dataset.sectionId)
      .filter(Boolean);
    if (sectionIds.length) formData.append('sections', sectionIds.join(','));

    const quantity = Number(formData.get('quantity')) || 1;
    const deferred = CartLinesUpdateEvent.createPromise();

    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'add',
        context: 'product',
        lines: [{ merchandiseId: /** @type {string} */ (formData.get('id')), quantity }],
        promise: deferred.promise,
      })
    );

    const config = fetchConfig('javascript', { body: formData });

    fetch(window.Theme.routes.cart_add_url, { ...config, headers: { ...config.headers, Accept: 'text/html' } })
      .then((response) => response.json())
      .then(async (response) => {
        const ajaxCart = await fetch(`${window.Theme.routes.cart_url}.json`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        }).then((cartResponse) => cartResponse.json());

        const didError = Boolean(response.status);
        if (didError) {
          this.dispatchEvent(
            new CartErrorEvent({
              error: response.message || 'Add to cart failed',
              code: 'INVALID',
              detail: { description: response.description, errors: response.errors },
            })
          );
        }

        deferred.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart),
          detail: {
            didError,
            items: ajaxCart.items,
            source: 'eloura-ritual-add',
            sourceId: this.id,
            itemCount: quantity,
            sections: didError ? undefined : response.sections,
          },
        });

        const message = this.querySelector('[data-ritual-error]');
        if (message) message.textContent = didError ? response.description || response.message || '' : '';
      })
      .catch((error) => {
        deferred.reject(error);
        form.submit();
      })
      .finally(() => button?.removeAttribute('aria-busy'));
  };
}

if (!customElements.get('eloura-ritual-add')) {
  customElements.define('eloura-ritual-add', ElouraRitualAdd);
}
