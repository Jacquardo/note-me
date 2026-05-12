import {
  LIMITS,
  NOTE_SCHEMA_VERSION,
  STORES
} from '../config/constants.js';

import {
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  openDatabase,
  putInStore
} from './database.js';

export async function getAllNotesFromDB() {
  const notes = await getAllFromStore(STORES.NOTES);

  return notes
    .map(normalizeNote)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function getNoteFromDB(noteId) {
  if (!noteId) return null;

  const note = await getFromStore(STORES.NOTES, noteId);

  return note ? normalizeNote(note) : null;
}

export async function saveNoteToDB(note) {
  const normalizedNote = normalizeNote(note);
  validateNote(normalizedNote);

  await putInStore(STORES.NOTES, normalizedNote);

  return normalizedNote;
}

export async function saveNotesToDB(notes = []) {
  const db = await openDatabase();
  const normalizedNotes = notes.map(normalizeNote);

  for (const note of normalizedNotes) {
    validateNote(note);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.NOTES, 'readwrite');
    const store = transaction.objectStore(STORES.NOTES);

    for (const note of normalizedNotes) {
      store.put(note);
    }

    transaction.oncomplete = () => resolve(normalizedNotes);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Import des notes annulé.'));
  });
}

export async function deleteNoteFromDB(noteId) {
  if (!noteId) {
    throw new Error('Identifiant de note manquant.');
  }

  return deleteFromStore(STORES.NOTES, noteId);
}

export async function softDeleteNoteInDB(noteId) {
  const note = await getNoteFromDB(noteId);

  if (!note) {
    throw new Error('Note introuvable.');
  }

  const updatedNote = {
    ...note,
    deletedAt: Date.now(),
    updatedAt: Date.now()
  };

  await saveNoteToDB(updatedNote);

  return updatedNote;
}

export async function restoreNoteInDB(noteId) {
  const note = await getNoteFromDB(noteId);

  if (!note) {
    throw new Error('Note introuvable.');
  }

  const updatedNote = {
    ...note,
    deletedAt: null,
    updatedAt: Date.now()
  };

  await saveNoteToDB(updatedNote);

  return updatedNote;
}

export async function getActiveNotesFromDB() {
  const notes = await getAllNotesFromDB();

  return notes.filter((note) => !note.deletedAt);
}

export async function getTrashNotesFromDB() {
  const notes = await getAllNotesFromDB();

  return notes.filter((note) => Boolean(note.deletedAt));
}

export async function clearNotesFromDB() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.NOTES, 'readwrite');
    const store = transaction.objectStore(STORES.NOTES);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function normalizeNote(note = {}) {
  const now = Date.now();

  return {
    id: String(note.id || generateId()),
    schemaVersion: Number(note.schemaVersion || NOTE_SCHEMA_VERSION),

    title: limitString(note.title, LIMITS.TITLE_MAX_LENGTH),
    category: limitString(note.category, LIMITS.CATEGORY_MAX_LENGTH),
    tags: normalizeTags(note.tags),

    color: normalizeColor(note.color || '#fff8a6'),
    backgroundImage: String(note.backgroundImage || ''),

    favorite: Boolean(note.favorite),
    content: limitString(note.content, LIMITS.CONTENT_MAX_LENGTH),

    fileId: String(note.fileId || ''),
    fileName: String(note.fileName || ''),
    fileType: String(note.fileType || ''),
    fileSize: Number(note.fileSize || 0),

    createdAt: Number(note.createdAt || now),
    updatedAt: Number(note.updatedAt || note.createdAt || now),
    deletedAt: note.deletedAt ? Number(note.deletedAt) : null,
    order: Number(note.order || note.createdAt || now)
  };
}

export function validateNote(note) {
  if (!note.id) {
    throw new Error('La note doit avoir un identifiant.');
  }

  if (!note.title.trim() && !note.content.trim()) {
    throw new Error('La note doit contenir un titre ou un contenu.');
  }

  if (note.title.length > LIMITS.TITLE_MAX_LENGTH) {
    throw new Error(`Le titre dépasse ${LIMITS.TITLE_MAX_LENGTH} caractères.`);
  }

  if (note.content.length > LIMITS.CONTENT_MAX_LENGTH) {
    throw new Error(`Le contenu dépasse ${LIMITS.CONTENT_MAX_LENGTH} caractères.`);
  }

  if (note.tags.length > LIMITS.TAGS_MAX_COUNT) {
    throw new Error(`Une note ne peut pas contenir plus de ${LIMITS.TAGS_MAX_COUNT} tags.`);
  }

  return true;
}

function normalizeTags(tags) {
  const rawTags = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');

  const normalized = rawTags
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((tag) => limitString(tag, LIMITS.TAG_MAX_LENGTH));

  return [...new Set(normalized)].slice(0, LIMITS.TAGS_MAX_COUNT);
}

function limitString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeColor(value) {
  const color = String(value || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  return '#fff8a6';
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
