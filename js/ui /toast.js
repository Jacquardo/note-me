let toastId = 0;

export function showToast(message, type = 'info', options = {}) {
  const region = getToastRegion();

  if (!region) {
    logFallback(message, type);
    return null;
  }

  const toast = document.createElement('div');
  const id = `toast-${Date.now()}-${toastId++}`;

  toast.id = id;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const content = document.createElement('span');
  content.className = 'toast-message';
  content.textContent = String(message || '');

  const closeButton = document.createElement('button');
  closeButton.className = 'toast-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Fermer la notification');

  toast.appendChild(content);
  toast.appendChild(closeButton);
  region.appendChild(toast);

  const remove = () => removeToast(toast);

  closeButton.addEventListener('click', remove);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const duration = Number(options.duration ?? getDefaultDuration(type));

  if (duration > 0) {
    window.setTimeout(remove, duration);
  }

  return {
    id,
    element: toast,
    close: remove
  };
}

export function showSuccess(message, options = {}) {
  return showToast(message, 'success', options);
}

export function showError(message, options = {}) {
  return showToast(message, 'error', options);
}

export function showWarning(message, options = {}) {
  return showToast(message, 'warning', options);
}

export function showInfo(message, options = {}) {
  return showToast(message, 'info', options);
}

export function clearToasts() {
  const region = getToastRegion();

  if (!region) return;

  region.replaceChildren();
}

export function bindToastEvents() {
  window.addEventListener('notes-me:toast', (event) => {
    const detail = event.detail || {};

    showToast(detail.message || '', detail.type || 'info', detail.options || {});
  });
}

function getToastRegion() {
  let region = document.getElementById('toastRegion');

  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }

  return region;
}

function removeToast(toast) {
  if (!toast || !toast.isConnected) return;

  toast.classList.remove('visible');

  window.setTimeout(() => {
    toast.remove();
  }, 220);
}

function getDefaultDuration(type) {
  if (type === 'error') return 6000;
  if (type === 'warning') return 5000;

  return 3500;
}

function logFallback(message, type) {
  const method = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';

  console[method](message);
}
