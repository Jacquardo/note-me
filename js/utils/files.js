export function downloadBlob(blob, filename = 'download') {
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');

    link.href = url;
    link.download = sanitizeFileName(filename);
    link.rel = 'noopener';

    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export function downloadText(text, filename = 'document.txt', type = 'text/plain;charset=UTF-8') {
  const blob = new Blob([String(text || '')], {
    type
  });

  downloadBlob(blob, filename);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));

    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));

    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));

    reader.readAsDataURL(file);
  });
}

export function blobToFile(blob, filename, options = {}) {
  return new File([blob], sanitizeFileName(filename), {
    type: options.type || blob.type || 'application/octet-stream',
    lastModified: options.lastModified || Date.now()
  });
}

export function createObjectUrl(blob) {
  if (!blob) return '';

  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url) {
  if (!url || !String(url).startsWith('blob:')) return;

  URL.revokeObjectURL(url);
}

export function getFileExtension(filename = '') {
  const parts = String(filename).toLowerCase().split('.');

  return parts.length > 1 ? parts.pop().trim() : '';
}

export function getBaseFileName(filename = '') {
  const safeName = String(filename || '').split(/[\\/]/).pop() || '';

  const index = safeName.lastIndexOf('.');

  if (index <= 0) return safeName;

  return safeName.slice(0, index);
}

export function sanitizeFileName(fileName = 'fichier') {
  return String(fileName)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'fichier';
}

export function sanitizeZipPath(path = '') {
  return String(path)
    .normalize('NFC')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => sanitizeFileName(part))
    .filter(Boolean)
    .join('/');
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (value < 1024) {
    return `${value} o`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} Ko`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${Math.round((value / 1024 / 1024) * 10) / 10} Mo`;
  }

  return `${Math.round((value / 1024 / 1024 / 1024) * 10) / 10} Go`;
}

export function getFileKindFromName(filename = '') {
  const extension = getFileExtension(filename);

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return 'image';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) {
    return 'document';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'spreadsheet';
  }

  if (['txt', 'md', 'json'].includes(extension)) {
    return 'text';
  }

  return 'file';
}

export function getFileKindFromMime(type = '') {
  const mime = String(type || '').toLowerCase();

  if (mime.startsWith('image/')) {
    return 'image';
  }

  if (mime === 'application/pdf') {
    return 'pdf';
  }

  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime === 'application/msword'
  ) {
    return 'document';
  }

  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv'
  ) {
    return 'spreadsheet';
  }

  if (mime.startsWith('text/') || mime.includes('json')) {
    return 'text';
  }

  return 'file';
}

export function getFileKind(file = {}) {
  return getFileKindFromMime(file.type) || getFileKindFromName(file.name);
}

export function getFileIcon(file = {}) {
  const kind = typeof file === 'string'
    ? getFileKindFromName(file)
    : getFileKind(file);

  const icons = {
    image: '🖼️',
    pdf: '📕',
    document: '📄',
    spreadsheet: '📊',
    text: '📝',
    file: '📎'
  };

  return icons[kind] || icons.file;
}

export function isImageFile(file = {}) {
  return getFileKind(file) === 'image';
}

export function isPdfFile(file = {}) {
  return getFileKind(file) === 'pdf';
}

export function fileToSerializableMeta(file = {}) {
  return {
    name: file.name || '',
    type: file.type || '',
    size: Number(file.size || 0),
    lastModified: Number(file.lastModified || 0)
  };
}
