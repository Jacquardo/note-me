import {
  DEFAULT_SETTINGS,
  NOTE_SCHEMA_VERSION
} from '../config/constants.js';

export function normalizeImportedNote(note = {}, importedAt = Date.now()) {
  return {
    id: String(note.id || generateImportId('note')),
    schemaVersion: Number(note.schemaVersion || NOTE_SCHEMA_VERSION),

    title: String(note.title || '').trim().slice(0, 160),
    category: String(note.category || '').trim().slice(0, 80),
    tags: normalizeTags(note.tags),

    color: normalizeColor(note.color || DEFAULT_SETTINGS.defaultNoteColor),
    backgroundImage: String(note.backgroundImage || ''),

    favorite: Boolean(note.favorite),
    content: String(note.content || '').slice(0, 100000),

    fileId: String(note.fileId || ''),
    fileName: String(note.fileName || ''),
    fileType: String(note.fileType || ''),
    fileSize: Number(note.fileSize || 0),

    createdAt: Number(note.createdAt || importedAt),
    updatedAt: Number(note.updatedAt || importedAt),
    deletedAt: note.deletedAt ? Number(note.deletedAt) : null,
    order: Number(note.order || note.createdAt || importedAt)
  };
}

export function generateImportId(prefix = 'id') {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTags(tags) {
  const rawTags = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');

  const normalized = rawTags
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 40));

  return [...new Set(normalized)].slice(0, 20);
}

function normalizeColor(color) {
  const value = String(color || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return DEFAULT_SETTINGS.defaultNoteColor;
}
