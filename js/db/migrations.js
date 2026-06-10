import {
  DEFAULT_SETTINGS,
  NOTE_SCHEMA_VERSION,
  STORES
} from '../config/constants.js';

export function runMigrations(db, oldVersion, transaction) {
  if (oldVersion < 1) {
    createInitialStores(db);
  }

  if (oldVersion < 10) {
    createVersionsStore(db);
  }

  if (oldVersion < 11) {
    createSettingsStore(db);
    seedDefaultSettings(transaction);
  }

  ensureRequiredStores(db);
}

function createInitialStores(db) {
  if (!db.objectStoreNames.contains(STORES.NOTES)) {
    const notes = db.createObjectStore(STORES.NOTES, {
      keyPath: 'id'
    });

    safeCreateIndex(notes, 'createdAt', 'createdAt');
    safeCreateIndex(notes, 'updatedAt', 'updatedAt');
    safeCreateIndex(notes, 'category', 'category');
    safeCreateIndex(notes, 'favorite', 'favorite');
    safeCreateIndex(notes, 'deletedAt', 'deletedAt');
    safeCreateIndex(notes, 'order', 'order');
    safeCreateIndex(notes, 'schemaVersion', 'schemaVersion');
  }

  if (!db.objectStoreNames.contains(STORES.FILES)) {
    const files = db.createObjectStore(STORES.FILES, {
      keyPath: 'id'
    });

    safeCreateIndex(files, 'createdAt', 'createdAt');
    safeCreateIndex(files, 'name', 'name');
    safeCreateIndex(files, 'type', 'type');
    safeCreateIndex(files, 'size', 'size');
    safeCreateIndex(files, 'noteId', 'noteId');
  }
}

function createVersionsStore(db) {
  if (!db.objectStoreNames.contains(STORES.VERSIONS)) {
    const versions = db.createObjectStore(STORES.VERSIONS, {
      keyPath: 'id'
    });

    safeCreateIndex(versions, 'noteId', 'noteId');
    safeCreateIndex(versions, 'createdAt', 'createdAt');
    safeCreateIndex(versions, 'reason', 'reason');
  }
}

function createSettingsStore(db) {
  if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
    const settings = db.createObjectStore(STORES.SETTINGS, {
      keyPath: 'key'
    });

    safeCreateIndex(settings, 'updatedAt', 'updatedAt');
  }
}

/**
 * Corrige les anciens chemins relatifs de backgroundImage.
 * À appeler sur les notes après leur chargement (Google Drive ou IndexedDB).
 * 
 * Ancien : ./assets/img1.png
 * Nouveau : /assets/img1.png
 */
export function migrateBackgroundImagePaths(notes = []) {
  let migrated = 0;

  const result = notes.map(note => {
    if (
      typeof note.backgroundImage === 'string' &&
      note.backgroundImage.startsWith('./assets/img')
    ) {
      migrated++;
      return {
        ...note,
        backgroundImage: note.backgroundImage.replace(/^\.\//, '/')
      };
    }
    return note;
  });

  if (migrated > 0) {
    console.info(`[Migration] ${migrated} note(s) avec backgroundImage corrigé(s).`);
  }

  return result;
}

function ensureRequiredStores(db) {
  if (!db.objectStoreNames.contains(STORES.NOTES)) {
    const notes = db.createObjectStore(STORES.NOTES, {
      keyPath: 'id'
    });

    safeCreateIndex(notes, 'createdAt', 'createdAt');
    safeCreateIndex(notes, 'updatedAt', 'updatedAt');
    safeCreateIndex(notes, 'category', 'category');
    safeCreateIndex(notes, 'favorite', 'favorite');
    safeCreateIndex(notes, 'deletedAt', 'deletedAt');
    safeCreateIndex(notes, 'order', 'order');
    safeCreateIndex(notes, 'schemaVersion', 'schemaVersion');
  }

  if (!db.objectStoreNames.contains(STORES.FILES)) {
    const files = db.createObjectStore(STORES.FILES, {
      keyPath: 'id'
    });

    safeCreateIndex(files, 'createdAt', 'createdAt');
    safeCreateIndex(files, 'name', 'name');
    safeCreateIndex(files, 'type', 'type');
    safeCreateIndex(files, 'size', 'size');
    safeCreateIndex(files, 'noteId', 'noteId');
  }

  if (!db.objectStoreNames.contains(STORES.VERSIONS)) {
    const versions = db.createObjectStore(STORES.VERSIONS, {
      keyPath: 'id'
    });

    safeCreateIndex(versions, 'noteId', 'noteId');
    safeCreateIndex(versions, 'createdAt', 'createdAt');
    safeCreateIndex(versions, 'reason', 'reason');
  }

  if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
    const settings = db.createObjectStore(STORES.SETTINGS, {
      keyPath: 'key'
    });

    safeCreateIndex(settings, 'updatedAt', 'updatedAt');
  }
}

function seedDefaultSettings(transaction) {
  if (!transaction) return;

  try {
    const settingsStore = transaction.objectStore(STORES.SETTINGS);
    const now = Date.now();

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      settingsStore.put({
        key,
        value,
        updatedAt: now
      });
    }
  } catch (error) {
    console.warn('Impossible d’initialiser les paramètres par défaut.', error);
  }
}

function safeCreateIndex(store, indexName, keyPath, options = {}) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}

export function normalizeNoteForMigration(note) {
  const now = Date.now();

  return {
    id: note.id,
    schemaVersion: note.schemaVersion || NOTE_SCHEMA_VERSION,
    title: String(note.title || ''),
    category: String(note.category || ''),
    tags: normalizeTags(note.tags),
    color: note.color || '#fff8a6',
    backgroundImage: note.backgroundImage || '',
    favorite: Boolean(note.favorite),
    content: String(note.content || ''),
    fileId: note.fileId || '',
    fileName: note.fileName || '',
    fileType: note.fileType || '',
    fileSize: Number(note.fileSize || 0),
    createdAt: Number(note.createdAt || now),
    updatedAt: Number(note.updatedAt || note.createdAt || now),
    deletedAt: note.deletedAt || null,
    order: Number(note.order || note.createdAt || now)
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim().replace(/^#/, ''))
      .filter(Boolean);
  }

  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);
}
