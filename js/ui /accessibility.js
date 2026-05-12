import {
  getFocusableElements,
  safeFocus,
  trapFocus
} from './dom.js';

export function bindGlobalAccessibility() {
  bindKeyboardFocusClass();
  bindModalFocusTrap();
  bindSkipLink();
  bindPwaAnnouncements();
}

export function enhanceNoteAccessibility(noteElement, note, onOpen) {
  if (!noteElement) return;

  noteElement.tabIndex = 0;
  noteElement.setAttribute('role', 'button');
  noteElement.setAttribute('aria-label', `Ouvrir la note ${note?.title || 'sans titre'}`);

  noteElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (typeof onOpen === 'function') {
        onOpen(note?.id);
      } else {
        noteElement.click();
      }
    }
  });
}

export function enhanceToggleButton(button, isPressed, labelWhenPressed, labelWhenNotPressed) {
  if (!button) return;

  button.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
  button.setAttribute('aria-label', isPressed ? labelWhenPressed : labelWhenNotPressed);
}

export function announce(message, type = 'polite') {
  const region = getLiveRegion(type);

  region.textContent = '';

  window.setTimeout(() => {
    region.textContent = String(message || '');
  }, 20);
}

export function focusFirstIn(container) {
  const focusable = getFocusableElements(container);
  const target = focusable[0] || container;

  safeFocus(target);
}

export function bindModalFocusTrap(root = document) {
  root.addEventListener('keydown', (event) => {
    const modal = document.querySelector('.modal.open');

    if (!modal) return;

    trapFocus(modal, event);
  });
}

export function bindKeyboardFocusClass() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      document.documentElement.classList.add('keyboard-navigation');
    }
  });

  document.addEventListener('mousedown', () => {
    document.documentElement.classList.remove('keyboard-navigation');
  });
}

export function bindSkipLink() {
  const skipLink = document.querySelector('.skip-link');
  const main = document.getElementById('mainContent');

  if (!skipLink || !main) return;

  skipLink.addEventListener('click', () => {
    safeFocus(main);
  });
}

export function bindPwaAnnouncements() {
  window.addEventListener('notes-me:pwa-update-available', () => {
    announce('Une mise à jour de Notes Me est disponible.', 'polite');
  });

  window.addEventListener('notes-me:pwa-installed', () => {
    announce('Notes Me est installée.', 'polite');
  });
}

export function setBusy(element, busy = true) {
  if (element) {
    element.setAttribute('aria-busy', busy ? 'true' : 'false');
  }
}

export function setExpanded(button, expanded = false) {
  if (button) {
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function getLiveRegion(type = 'polite') {
  const id = type === 'assertive' ? 'a11yAssertiveRegion' : 'a11yPoliteRegion';
  let region = document.getElementById(id);

  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.className = 'sr-only';
    region.setAttribute('aria-live', type === 'assertive' ? 'assertive' : 'polite');
    region.setAttribute('aria-atomic', 'true');

    document.body.appendChild(region);
  }

  return region;
}
