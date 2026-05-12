import {
  DATE_FILTERS,
  SEARCH_TOKENS
} from '../config/constants.js';

export function parseSearchQuery(rawQuery = '') {
  const raw = String(rawQuery || '').trim();

  const result = {
    raw,
    text: [],
    phrases: [],
    tags: [],
    categories: [],
    favorite: null,
    hasFile: null,
    fileKind: null,
    status: null,
    created: null,
    updated: null
  };

  if (!raw) {
    return result;
  }

  const normalizedRaw = normalizeSearchText(raw);

  const phraseRegex = /"([^"]+)"/g;

  let cleaned = normalizedRaw.replace(phraseRegex, (_, phrase) => {
    const normalizedPhrase = normalizeSearchText(phrase).trim();

    if (normalizedPhrase) {
      result.phrases.push(normalizedPhrase);
    }

    return ' ';
  });

  const parts = cleaned.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith(SEARCH_TOKENS.TAG_PREFIX)) {
      const tag = part.slice(1).trim();

      if (tag) {
        result.tags.push(tag);
      }

      continue;
    }

    if (part.startsWith(SEARCH_TOKENS.CATEGORY_PREFIX)) {
      const category = part.replace(SEARCH_TOKENS.CATEGORY_PREFIX, '').trim();

      if (category) {
        result.categories.push(category);
      }

      continue;
    }

    if (SEARCH_TOKENS.FAVORITE_TRUE.includes(part)) {
      result.favorite = true;
      continue;
    }

    if (SEARCH_TOKENS.FAVORITE_FALSE.includes(part)) {
      result.favorite = false;
      continue;
    }

    if (part === SEARCH_TOKENS.HAS_FILE) {
      result.hasFile = true;
      continue;
    }

    if (part === SEARCH_TOKENS.HAS_IMAGE) {
      result.fileKind = 'image';
      continue;
    }

    if (part === SEARCH_TOKENS.HAS_PDF) {
      result.fileKind = 'pdf';
      continue;
    }

    if (part === SEARCH_TOKENS.IS_TRASH) {
      result.status = 'trash';
      continue;
    }

    if (part === SEARCH_TOKENS.IS_ACTIVE) {
      result.status = 'active';
      continue;
    }

    if (part.startsWith(SEARCH_TOKENS.CREATED_PREFIX)) {
      result.created = part.replace(SEARCH_TOKENS.CREATED_PREFIX, '');
      continue;
    }

    if (part.startsWith(SEARCH_TOKENS.UPDATED_PREFIX)) {
      result.updated = part.replace(SEARCH_TOKENS.UPDATED_PREFIX, '');
      continue;
    }

    result.text.push(part);
  }

  result.tags = unique(result.tags);
  result.categories = unique(result.categories);
  result.text = unique(result.text);

  return result;
}

export function noteMatchesAdvancedSearch(note, query) {
  const parsedQuery = typeof query === 'string' ? parseSearchQuery(query) : query;

  if (!parsedQuery) {
    return true;
  }

  const haystack = buildNoteSearchText(note);

  if (parsedQuery.text.some((word) => !haystack.includes(word))) {
    return false;
  }

  if (parsedQuery.phrases.some((phrase) => !haystack.includes(phrase))) {
    return false;
  }

  if (parsedQuery.tags.length) {
    const noteTags = (note.tags || []).map((tag) => normalizeSearchText(tag));

    if (parsedQuery.tags.some((tag) => !noteTags.includes(tag))) {
      return false;
    }
  }

  if (parsedQuery.categories.length) {
    const category = normalizeSearchText(note.category);

    if (!parsedQuery.categories.includes(category)) {
      return false;
    }
  }

  if (parsedQuery.favorite !== null && Boolean(note.favorite) !== parsedQuery.favorite) {
    return false;
  }

  if (parsedQuery.hasFile === true && !note.fileId) {
    return false;
  }

  if (parsedQuery.fileKind && getNoteFileKind(note) !== parsedQuery.fileKind) {
    return false;
  }

  if (parsedQuery.status === 'trash' && !note.deletedAt) {
    return false;
  }

  if (parsedQuery.status === 'active' && note.deletedAt) {
    return false;
  }

  if (parsedQuery.created && !matchesDateFilter(note.createdAt, parsedQuery.created)) {
    return false;
  }

  if (parsedQuery.updated && !matchesDateFilter(note.updatedAt || note.createdAt, parsedQuery.updated)) {
    return false;
  }

  return true;
}

export function filterNotesByAdvancedSearch(notes = [], rawQuery = '') {
  const query = parseSearchQuery(rawQuery);

  return notes.filter((note) => noteMatchesAdvancedSearch(note, query));
}

export function buildNoteSearchText(note = {}) {
  return normalizeSearchText([
    note.title,
    note.content,
    note.category,
    ...(note.tags || []),
    note.fileName
  ].filter(Boolean).join(' '));
}

export function normalizeSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function getNoteFileKind(note = {}) {
  const type = String(note.fileType || '').toLowerCase();
  const name = String(note.fileName || '').toLowerCase();

  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) {
    return 'image';
  }

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    type.includes('word') ||
    type.includes('document') ||
    /\.(doc|docx)$/.test(name)
  ) {
    return 'document';
  }

  return note.fileId ? 'file' : null;
}

export function matchesDateFilter(timestamp, filter) {
  if (!timestamp || !filter) {
    return true;
  }

  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  if (filter === DATE_FILTERS.TODAY) {
    return isSameDay(date, now);
  }

  if (filter === DATE_FILTERS.WEEK) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return date >= sevenDaysAgo;
  }

  if (filter === DATE_FILTERS.MONTH) {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  if (filter === DATE_FILTERS.YEAR) {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}
