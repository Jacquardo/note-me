import { LIMITS } from '../config/constants.js';

import {
  getVersionsForNote,
  saveNoteVersion
} from '../db/versionsRepository.js';

import {
  getNoteFromDB,
  saveNoteToDB
} from '../db/notesRepository.js';

export async function snapshotNote(note, reason = 'update') {
  if (!note || !note.id) {
    return null;
  }

  const version = {
    id: generateId('version'),
    noteId: note.id,
    reason,
    createdAt: Date.now(),
    snapshot: cloneForHistory(note)
  };

  await saveNoteVersion(version);

  return version;
}

export async function snapshotNoteById(noteId, reason = 'update') {
  const note = await getNoteFromDB(noteId);

  if (!note) {
    throw new Error('Note introuvable.');
  }

  return snapshotNote(note, reason);
}

export async function listNoteVersions(noteId) {
  return getVersionsForNote(noteId);
}

export async function restoreNoteVersion(version) {
  if (!version?.snapshot) {
    throw new Error('Version invalide.');
  }

  const currentNote = await getNoteFromDB(version.noteId);

  if (currentNote) {
    await snapshotNote(currentNote, 'before-restore-version');
  }

  const restoredNote = {
    ...version.snapshot,
    id: version.noteId,
    updatedAt: Date.now()
  };

  await saveNoteToDB(restoredNote);

  return restoredNote;
}

export async function restoreNoteVersionById(noteId, versionId) {
  const versions = await getVersionsForNote(noteId);
  const version = versions.find((item) => item.id === versionId);

  if (!version) {
    throw new Error('Version introuvable.');
  }

  return restoreNoteVersion(version);
}

export async function getLatestVersion(noteId) {
  const versions = await getVersionsForNote(noteId);

  return versions[0] || null;
}

export function shouldCreateSnapshot(previousNote, nextNote) {
  if (!previousNote || !nextNote) {
    return false;
  }

  const previousComparable = getComparableNote(previousNote);
  const nextComparable = getComparableNote(nextNote);

  return JSON.stringify(previousComparable) !== JSON.stringify(nextComparable);
}

export function getHistoryLimit() {
  return LIMITS.HISTORY_MAX_VERSIONS_PER_NOTE;
}

function getComparableNote(note) {
  return {
    title: note.title || '',
    category: note.category || '',
    tags: note.tags || [],
    color: note.color || '',
    backgroundImage: note.backgroundImage || '',
    favorite: Boolean(note.favorite),
    content: note.content || '',
    fileId: note.fileId || '',
    fileName: note.fileName || '',
    fileType: note.fileType || '',
    fileSize: Number(note.fileSize || 0),
    deletedAt: note.deletedAt || null
  };
}

function cloneForHistory(note) {
  const clone = {
    ...note
  };

  delete clone.exportedFilePath;

  if (typeof structuredClone === 'function') {
    return structuredClone(clone);
  }

  return JSON.parse(JSON.stringify(clone));
}

function generateId(prefix = 'id') {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
