import {
  LIMITS,
  STORES
} from '../config/constants.js';

import {
  deleteFromStore,
  getFromStore,
  openDatabase,
  putInStore
} from './database.js';

export async function saveNoteVersion(version) {
  const normalizedVersion = normalizeVersion(version);

  await putInStore(STORES.VERSIONS, normalizedVersion);
  await pruneOldVersionsForNote(normalizedVersion.noteId);

  return normalizedVersion;
}

export async function getVersionFromDB(versionId) {
  if (!versionId) return null;

  return getFromStore(STORES.VERSIONS, versionId);
}

export async function getVersionsForNote(noteId) {
  if (!noteId) return [];

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.VERSIONS, 'readonly');
    const store = transaction.objectStore(STORES.VERSIONS);
    const index = store.index('noteId');
    const request = index.getAll(noteId);

    request.onsuccess = () => {
      const versions = request.result || [];

      versions.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      resolve(versions);
    };

    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteVersionFromDB(versionId) {
  if (!versionId) {
    throw new Error('Identifiant de version manquant.');
  }

  return deleteFromStore(STORES.VERSIONS, versionId);
}

export async function deleteVersionsForNote(noteId) {
  const versions = await getVersionsForNote(noteId);

  for (const version of versions) {
    await deleteVersionFromDB(version.id);
  }

  return true;
}

export async function clearVersionsFromDB() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.VERSIONS, 'readwrite');
    const store = transaction.objectStore(STORES.VERSIONS);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function pruneOldVersionsForNote(noteId) {
  const versions = await getVersionsForNote(noteId);

  if (versions.length <= LIMITS.HISTORY_MAX_VERSIONS_PER_NOTE) {
    return false;
  }

  const versionsToDelete = versions.slice(LIMITS.HISTORY_MAX_VERSIONS_PER_NOTE);

  for (const version of versionsToDelete) {
    await deleteVersionFromDB(version.id);
  }

  return true;
}

export function normalizeVersion(version = {}) {
  const now = Date.now();

  if (!version.noteId && !version.snapshot?.id) {
    throw new Error('Une version doit être liée à une note.');
  }

  const noteId = String(version.noteId || version.snapshot.id);

  return {
    id: String(version.id || generateId()),
    noteId,
    reason: String(version.reason || 'update'),
    createdAt: Number(version.createdAt || now),
    snapshot: structuredCloneSafe(version.snapshot || {})
  };
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `version-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
