export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function byId(id) {
  return document.getElementById(id);
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.textContent !== undefined) {
    element.textContent = options.textContent;
  }

  if (options.htmlFor) {
    element.htmlFor = options.htmlFor;
  }

  if (options.type) {
    element.type = options.type;
  }

  if (options.id) {
    element.id = options.id;
  }

  if (options.value !== undefined) {
    element.value = options.value;
  }

  if (options.hidden !== undefined) {
    element.hidden = Boolean(options.hidden);
  }

  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      element.dataset[key] = value;
    }
  }

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === false || value === null || value === undefined) continue;

      if (value === true) {
        element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  if (options.style) {
    for (const [key, value] of Object.entries(options.style)) {
      element.style.setProperty(key, value);
    }
  }

  if (Array.isArray(options.children)) {
    appendChildren(element, options.children);
  }

  return element;
}

export function appendChildren(parent, children = []) {
  for (const child of children) {
    if (child === null || child === undefined) continue;

    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else {
      parent.appendChild(child);
    }
  }

  return parent;
}

export function replaceChildren(parent, children = []) {
  if (!parent) return null;

  parent.replaceChildren();

  appendChildren(parent, children);

  return parent;
}

export function setText(element, value = '') {
  if (element) {
    element.textContent = String(value);
  }

  return element;
}

export function setHidden(element, hidden = true) {
  if (element) {
    element.hidden = Boolean(hidden);
  }

  return element;
}

export function setDisabled(element, disabled = true) {
  if (element) {
    element.disabled = Boolean(disabled);
  }

  return element;
}

export function setPressed(element, pressed = false) {
  if (element) {
    element.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  return element;
}

export function toggleClass(element, className, force) {
  if (!element) return element;

  element.classList.toggle(className, force);

  return element;
}

export function createButton(options = {}) {
  const button = createElement('button', {
    type: options.type || 'button',
    className: options.className || 'btn btn-secondary',
    textContent: options.textContent || '',
    attrs: {
      'aria-label': options.ariaLabel
    },
    dataset: options.dataset
  });

  if (typeof options.onClick === 'function') {
    button.addEventListener('click', options.onClick);
  }

  return button;
}

export function createIconButton(label, text, onClick, extraClass = '') {
  return createButton({
    className: `note-action-btn ${extraClass}`.trim(),
    textContent: text,
    ariaLabel: label,
    onClick
  });
}

export function createBadge(text, className = 'badge') {
  return createElement('span', {
    className,
    textContent: text
  });
}

export function createOption(value, label, selected = false) {
  const option = createElement('option', {
    value,
    textContent: label
  });

  option.selected = Boolean(selected);

  return option;
}

export function clearNode(node) {
  if (node) {
    node.replaceChildren();
  }

  return node;
}

export function isInteractiveElement(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('button, a, input, textarea, select, label, [role="button"], [contenteditable="true"]')
  );
}

export function safeFocus(element, options = {}) {
  if (!element || typeof element.focus !== 'function') {
    return false;
  }

  requestAnimationFrame(() => {
    element.focus(options);
  });

  return true;
}

export function getFocusableElements(root = document) {
  return Array.from(
    root.querySelectorAll(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(',')
    )
  ).filter((element) => {
    return Boolean(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  });
}

export function trapFocus(container, event) {
  if (!container || event.key !== 'Tab') return;

  const focusable = getFocusableElements(container);

  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
