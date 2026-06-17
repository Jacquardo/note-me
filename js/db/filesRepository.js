import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  LIMITS,
  STORES
} from '../config/constants.js';

import {
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  openDatabase,
  putInStore
} from './database.js';

export async function getAllFilesFromDB() {
  return getAllFromStore(STORES.FILES);
}

export async function getFileFromDB(fileId) {
  if (!fileId) return null;

  return getFromStore(STORES.FILES, fileId);
}

export async function saveFileToDB(fileRecord) {
  const normalizedFile = normalizeFileRecord(fileRecord);
  validateFileRecord(normalizedFile);

  await putInStore(STORES.FILES, normalizedFile);

  return normalizedFile;
}

export async function saveFilesToDB(files = []) {
  const db = await openDatabase();
  const normalizedFiles = files.map(normalizeFileRecord);

  for (const file of normalizedFiles) {
    validateFileRecord(file);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILES, 'readwrite');
    const store = transaction.objectStore(STORES.FILES);

    for (const file of normalizedFiles) {
      store.put(file);
    }

    transaction.oncomplete = () => resolve(normalizedFiles);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Import des fichiers annulé.'));
  });
}

export async function deleteFileFromDB(fileId) {
  if (!fileId) {
    throw new Error('Identifiant de fichier manquant.');
  }

  return deleteFromStore(STORES.FILES, fileId);
}

export async function clearFilesFromDB() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILES, 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function validateUserFile(file) {
  if (!file) {
    return {
      valid: false,
      message: 'Aucun fichier sélectionné.'
    };
  }

  if (file.size > LIMITS.FILE_MAX_SIZE) {
    return {
      valid: false,
      message: `Le fichier dépasse la limite autorisée de ${formatBytes(LIMITS.FILE_MAX_SIZE)}.`
    };
  }

  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      message: 'Extension non autorisée. Formats acceptés : PDF, DOC, DOCX, PNG, JPG.'
    };
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      message: 'Type MIME non autorisé.'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

export function normalizeFileRecord(fileRecord = {}) {
  const now = Date.now();

  return {
    id: String(fileRecord.id || generateId()),
    noteId: String(fileRecord.noteId || ''),
    name: sanitizeFileName(fileRecord.name || 'fichier'),
    type: String(fileRecord.type || ''),
    size: Number(fileRecord.size || fileRecord.blob?.size || 0),
    blob: fileRecord.blob || null,
    createdAt: Number(fileRecord.createdAt || now)
  };
}

export function validateFileRecord(fileRecord) {
  if (!fileRecord.id) {
    throw new Error('Le fichier doit avoir un identifiant.');
  }

  if (!fileRecord.blob) {
    throw new Error('Le fichier ne contient aucun Blob.');
  }

  if (fileRecord.size > LIMITS.FILE_MAX_SIZE) {
    throw new Error(`Le fichier dépasse ${formatBytes(LIMITS.FILE_MAX_SIZE)}.`);
  }

  const extension = getFileExtension(fileRecord.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('Extension de fichier non autorisée.');
  }

  if (fileRecord.type && !ALLOWED_MIME_TYPES.includes(fileRecord.type)) {
    throw new Error('Type de fichier non autorisé.');
  }

  return true;
}

export function getFileExtension(filename = '') {
  const parts = String(filename).toLowerCase().split('.');

  return parts.length > 1 ? parts.pop().trim() : '';
}

export function sanitizeFileName(fileName = 'fichier') {
  return String(fileName)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'fichier';
}

export function getFileKind(fileRecord = {}) {
  const type = String(fileRecord.type || '').toLowerCase();
  const name = String(fileRecord.name || '').toLowerCase();

  if (type.startsWith('image/')  || /\.(png|jpe?g|gif|webp)$/.test(name))   return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf'))                    return 'pdf';
  if (type.startsWith('video/')  || /\.(mp4|webm|mov|avi)$/.test(name))     return 'video';
  if (type.startsWith('audio/')  || /\.(mp3|wav|ogg|aac|m4a)$/.test(name))  return 'audio';
  if (type.includes('word')      || /\.(doc|docx)$/.test(name))              return 'document';
  if (type.includes('sheet')     || /\.(xls|xlsx)$/.test(name))             return 'spreadsheet';
  return 'file';
}

export function createObjectUrlFromFileRecord(fileRecord) {
  if (!fileRecord?.blob) return '';

  return URL.createObjectURL(fileRecord.blob);
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (value < 1024) {
    return `${value} o`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} Ko`;
  }

  return `${Math.round((value / 1024 / 1024) * 10) / 10} Mo`;
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
