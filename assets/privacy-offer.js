(() => {
  const consentRoot = document.querySelector('[data-eloura-consent]');
  const consentDialog = document.querySelector('[data-eloura-consent-dialog]');
  const offerRoot = document.querySelector('[data-eloura-offer]');
  const offerDialog = document.querySelector('[data-eloura-offer-dialog]');
  const consentUiKey = 'eloura:cookie-consent-ui:v1';
  const offerKey = 'eloura:first-order-offer:v4';
  const offerDays = 30;
  // Wait before offering the code so it never lands on top of the consent choice.
  const offerDelay = 20000;
  let activeRoot = null;
  let activeDialog = null;
  let offerTimer = 0;
  let returnFocus = null;

  const focusable = (root) => [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => !el.hidden && el.offsetParent !== null);
  const lock = () => document.body.classList.add('eloura-modal-open');
  const unlock = () => { if (!activeRoot) document.body.classList.remove('eloura-modal-open'); };

  const openModal = (root, dialog) => {
    if (!root || !dialog) return;
    returnFocus = document.activeElement;
    activeRoot = root;
    activeDialog = dialog;
    root.hidden = false;
    lock();
    requestAnimationFrame(() => dialog.focus());
  };

  const closeModal = (root, restoreFocus = true) => {
    if (!root) return;
    root.hidden = true;
    if (activeRoot === root) {
      activeRoot = null;
      activeDialog = null;
    }
    unlock();
    if (restoreFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  };

  const offerWasSeen = () => {
    try {
      if (sessionStorage.getItem(offerKey)) return true;
      const stored = Number(localStorage.getItem(offerKey) || 0);
      return stored > Date.now() - offerDays * 86400000;
    } catch (_) {
      return false;
    }
  };

  const markOfferSeen = () => {
    try {
      sessionStorage.setItem(offerKey, '1');
      localStorage.setItem(offerKey, String(Date.now()));
    } catch (_) {}
  };

  const markConsentUiChoice = () => {
    try {
      localStorage.setItem(consentUiKey, '1');
    } catch (_) {}
  };

  const consentUiChoiceWasMade = () => {
    try {
      return localStorage.getItem(consentUiKey) === '1';
    } catch (_) {
      return false;
    }
  };

  const scheduleOffer = () => {
    if (!offerRoot || offerTimer || offerWasSeen() || window.Shopify?.designMode) return;
    offerTimer = window.setTimeout(function tryOpen() {
      // Don't stack on another modal or an open drawer (cart, chat, menu); try again shortly.
      if (activeRoot || document.querySelector('dialog[open]')) {
        offerTimer = window.setTimeout(tryOpen, 5000);
        return;
      }
      openModal(offerRoot, offerDialog);
      markOfferSeen();
    }, offerDelay);
  };

  const showConsent = () => {
    if (!consentRoot || window.Shopify?.designMode) return;
    openModal(consentRoot, consentDialog);
  };

  const loadConsentApi = (callback) => {
    if (window.Shopify?.customerPrivacy?.setTrackingConsent) return callback();
    if (!window.Shopify?.loadFeatures) return callback(new Error('Shopify Customer Privacy API unavailable'));
    window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], callback);
  };

  const currentConsent = () => {
    const privacy = window.Shopify?.customerPrivacy;
    if (!privacy || typeof privacy.currentVisitorConsent !== 'function') return null;
    return privacy.currentVisitorConsent();
  };

  const hasRecordedConsent = () => {
    const current = currentConsent();
    const keys = ['analytics', 'marketing', 'preferences'];
    return Boolean(current && keys.every((key) => current[key] === 'yes' || current[key] === 'no'));
  };

  const saveConsent = (accepted) => {
    loadConsentApi((loadError) => {
      const privacy = window.Shopify?.customerPrivacy;
      if (loadError || !privacy?.setTrackingConsent) {
        console.warn('[eloura] Shopify Customer Privacy API is unavailable; consent window remains open.', loadError || 'missing API');
        return;
      }

      const consent = accepted
        ? { analytics: true, marketing: true, preferences: true }
        : { analytics: false, marketing: false, preferences: false };

      privacy.setTrackingConsent(consent, (result) => {
        if (result && result.error) {
          console.warn('[eloura] Consent choice was not saved by Shopify.', result);
          return;
        }

        markConsentUiChoice();
        closeModal(consentRoot, false);
        scheduleOffer();
      });
    });
  };

  consentRoot?.querySelector('[data-consent-accept]')?.addEventListener('click', () => saveConsent(true));
  consentRoot?.querySelector('[data-consent-reject]')?.addEventListener('click', () => saveConsent(false));
  offerRoot?.querySelectorAll('[data-offer-close]').forEach((button) => button.addEventListener('click', () => closeModal(offerRoot)));

  offerRoot?.querySelector('[data-copy-code]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText('eloura10');
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = 'eloura10';
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    button.textContent = button.dataset.copiedLabel;
    window.setTimeout(() => { button.textContent = button.dataset.copyLabel; }, 1600);
  });

  document.addEventListener('keydown', (event) => {
    if (!activeRoot) return;

    if (event.key === 'Escape' && activeRoot === offerRoot) {
      event.preventDefault();
      closeModal(offerRoot);
      return;
    }

    if (event.key !== 'Tab') return;
    const items = focusable(activeRoot);
    if (!items.length) {
      event.preventDefault();
      activeDialog?.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const focused = document.activeElement;

    if (!activeRoot.contains(focused)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && (focused === first || focused === activeDialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && focused === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // The consent window ships hidden and only opens when Shopify says this visitor still needs to choose.
  // If the Customer Privacy API can't load (blocker, slow network), the store stays usable.
  loadConsentApi((error) => {
    const privacy = window.Shopify?.customerPrivacy;
    if (error || !privacy) {
      console.warn('[eloura] Customer Privacy API could not be initialized; consent window not shown.', error || 'missing API');
      scheduleOffer();
      return;
    }

    const choiceRecorded = consentUiChoiceWasMade() && hasRecordedConsent();
    const bannerNeeded = typeof privacy.shouldShowBanner === 'function' ? privacy.shouldShowBanner() : !hasRecordedConsent();

    if (!choiceRecorded && bannerNeeded) {
      showConsent();
    } else {
      scheduleOffer();
    }
  });
})();
