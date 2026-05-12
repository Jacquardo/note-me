export function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function normalizeWhitespace(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(value = '', maxLength = 120, suffix = '…') {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - suffix.length)).trim()}${suffix}`;
}

export function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripHtml(value = '') {
  const template = document.createElement('template');

  template.innerHTML = String(value || '');

  return template.content.textContent || '';
}

export function slugify(value = '') {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseTags(value = '', options = {}) {
  const maxCount = Number(options.maxCount || 20);
  const maxLength = Number(options.maxLength || 40);

  const rawTags = Array.isArray(value)
    ? value
    : String(value || '').split(',');

  const tags = rawTags
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((tag) => tag.slice(0, maxLength));

  return [...new Set(tags)].slice(0, maxCount);
}

export function tagsToString(tags = []) {
  if (!Array.isArray(tags)) return '';

  return tags.filter(Boolean).join(', ');
}

export function capitalize(value = '') {
  const text = String(value || '').trim();

  if (!text) return '';

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function countWords(value = '') {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length;
}

export function countCharacters(value = '') {
  return String(value || '').length;
}

export function highlightText(value = '', query = '') {
  const text = String(value || '');
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return escapeHtml(text);
  }

  const escapedText = escapeHtml(text);
  const escapedQuery = escapeRegExp(normalizedQuery);

  return escapedText.replace(
    new RegExp(`(${escapedQuery})`, 'gi'),
    '<mark>$1</mark>'
  );
}

export function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function compareText(a = '', b = '', locale = 'fr') {
  return String(a || '').localeCompare(String(b || ''), locale, {
    sensitivity: 'base'
  });
}

export function isBlank(value = '') {
  return String(value || '').trim().length === 0;
}

export function removeControlCharacters(value = '') {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '');
}

export function safeText(value = '', maxLength = 100000) {
  return removeControlCharacters(String(value || '')).slice(0, maxLength);
}
