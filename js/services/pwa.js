import { PWA } from '../config/constants.js';

let deferredInstallPrompt = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve({
      supported: false,
      registered: false
    });
  }

  return new Promise((resolve) => {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register(PWA.SERVICE_WORKER_PATH);

        watchServiceWorkerUpdates(registration);

        resolve({
          supported: true,
          registered: true,
          registration
        });
      } catch (error) {
        console.warn('Service worker non enregistré.', error);

        resolve({
          supported: true,
          registered: false,
          error
        });
      }
    });
  });
}

export function bindInstallPrompt(buttonEl) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();

    deferredInstallPrompt = event;

    if (buttonEl) {
      buttonEl.hidden = false;
      buttonEl.disabled = false;
    }

    window.dispatchEvent(
      new CustomEvent('notes-me:pwa-install-available')
    );
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;

    if (buttonEl) {
      buttonEl.hidden = true;
    }

    window.dispatchEvent(
      new CustomEvent('notes-me:pwa-installed')
    );
  });

  if (!buttonEl) {
    return;
  }

  buttonEl.addEventListener('click', async () => {
    const result = await promptInstall();

    if (!result.available) {
      window.dispatchEvent(
        new CustomEvent('notes-me:toast', {
          detail: {
            message: 'Installation indisponible pour le moment.',
            type: 'info'
          }
        })
      );

      return;
    }

    if (result.outcome === 'accepted') {
      buttonEl.hidden = true;
    }
  });
}

export async function promptInstall() {
  if (!deferredInstallPrompt) {
    return {
      available: false,
      outcome: null
    };
  }

  deferredInstallPrompt.prompt();

  const choice = await deferredInstallPrompt.userChoice;

  deferredInstallPrompt = null;

  return {
    available: true,
    outcome: choice.outcome,
    platform: choice.platform
  };
}

export function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return [];
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map((registration) => registration.unregister())
  );

  return registrations;
}

export function sendSkipWaiting() {
  if (!navigator.serviceWorker?.controller) {
    return false;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'SKIP_WAITING'
  });

  return true;
}

export function clearServiceWorkerCache() {
  if (!navigator.serviceWorker?.controller) {
    return false;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_CACHE'
  });

  return true;
}

function watchServiceWorkerUpdates(registration) {
  if (!registration) return;

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;

    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (
        newWorker.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        window.dispatchEvent(
          new CustomEvent('notes-me:pwa-update-available', {
            detail: {
              registration
            }
          })
        );
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(
      new CustomEvent('notes-me:pwa-controller-change')
    );
  });
}
