import {
  getFocusableElements,
  safeFocus,
  trapFocus
} from './dom.js';

let activeModalStack = [];
let lastFocusedElement = null;

export function openModal(modal, focusTarget = null) {
  if (!modal) return false;

  if (!activeModalStack.length) {
    lastFocusedElement = document.activeElement;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  if (!activeModalStack.includes(modal)) {
    activeModalStack.push(modal);
  }

  const target =
    focusTarget ||
    modal.querySelector('[autofocus]') ||
    getFocusableElements(modal)[0] ||
    modal;

  if (!modal.hasAttribute('tabindex')) {
    modal.setAttribute('tabindex', '-1');
  }

  safeFocus(target);

  return true;
}

export function closeModal(modal) {
  if (!modal) return false;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  activeModalStack = activeModalStack.filter((item) => item !== modal);

  if (!activeModalStack.length) {
    document.body.classList.remove('modal-open');

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      safeFocus(lastFocusedElement);
    }

    lastFocusedElement = null;
  } else {
    const topModal = activeModalStack[activeModalStack.length - 1];
    safeFocus(getFocusableElements(topModal)[0] || topModal);
  }

  return true;
}

export function closeTopModal() {
  const modal = activeModalStack[activeModalStack.length - 1];

  if (!modal) return false;

  return closeModal(modal);
}

export function closeAllModals() {
  const modals = [...activeModalStack];

  for (const modal of modals.reverse()) {
    closeModal(modal);
  }
}

export function getTopModal() {
  return activeModalStack[activeModalStack.length - 1] || null;
}

export function isModalOpen(modal) {
  return Boolean(modal?.classList.contains('open'));
}

export function bindModalSystem(root = document) {
  root.addEventListener('keydown', (event) => {
    const topModal = getTopModal();

    if (!topModal) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeTopModal();
      return;
    }

    trapFocus(topModal, event);
  });

  root.addEventListener('click', (event) => {
    const modal = event.target instanceof Element
      ? event.target.closest('.modal.open')
      : null;

    if (!modal) return;

    if (event.target === modal) {
      closeModal(modal);
    }
  });
}

export function bindCloseButton(button, modal) {
  if (!button || !modal) return;

  button.addEventListener('click', () => {
    closeModal(modal);
  });
}

export function createConfirmDialog({
  modal,
  titleElement,
  messageElement,
  okButton,
  cancelButton
}) {
  return function confirm({
    title = 'Confirmation',
    message = 'Êtes-vous sûr ?',
    okText = 'Confirmer',
    cancelText = 'Annuler',
    danger = true
  } = {}) {
    if (!modal || !okButton || !cancelButton) {
      return Promise.resolve(window.confirm(message));
    }

    titleElement.textContent = title;
    messageElement.textContent = message;
    okButton.textContent = okText;
    cancelButton.textContent = cancelText;
    okButton.classList.toggle('btn-danger', danger);
    okButton.classList.toggle('btn-primary', !danger);

    return new Promise((resolve) => {
      const cleanup = () => {
        okButton.removeEventListener('click', onOk);
        cancelButton.removeEventListener('click', onCancel);
        closeModal(modal);
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      okButton.addEventListener('click', onOk);
      cancelButton.addEventListener('click', onCancel);

      openModal(modal, cancelButton);
    });
  };
}
