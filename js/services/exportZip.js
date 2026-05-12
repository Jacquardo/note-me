import {
  APP_BACKUP_FORMAT,
  APP_NAME,
  APP_VERSION,
  EXPORT_ZIP,
  STORAGE_KEYS
} from '../config/constants.js';

import { getAllNotesFromDB } from '../db/notesRepository.js';
import { getFileFromDB } from '../db/filesRepository.js';

export async function exportBackupZip() {
  if (!window.JSZip) {
    throw new Error('JSZip est introuvable. Vérifie que vendor/jszip.min.js est bien chargé.');
  }

  const zip = new JSZip();
  const notes = await getAllNotesFromDB();

  const manifest = {
    app: APP_NAME,
    version: APP_VERSION,
    format: APP_BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    notesCount: notes.length,
    filesCount: 0
  };

  const exportedNotes = [];
  let filesCount = 0;

  for (const note of notes) {
    const exportedNote = {
      ...note
    };

    if (note.fileId) {
      try {
        const fileRecord = await getFileFromDB(note.fileId);

        if (fileRecord?.blob) {
          const safeName = sanitizeZipFileName(fileRecord.name || note.fileName || `${note.fileId}.bin`);
          const zipPath = `${EXPORT_ZIP.FILES_DIR}/${note.fileId}-${safeName}`;

          zip.file(zipPath, fileRecord.blob);

          exportedNote.exportedFilePath = zipPath;
          exportedNote.fileName = fileRecord.name || note.fileName || safeName;
          exportedNote.fileType = fileRecord.type || note.fileType || '';
          exportedNote.fileSize = fileRecord.size || note.fileSize || 0;

          filesCount += 1;
        }
      } catch (error) {
        console.warn(`Fichier non exporté pour la note ${note.id}.`, error);
      }
    }

    exportedNotes.push(exportedNote);
  }

  manifest.filesCount = filesCount;

  zip.file(EXPORT_ZIP.MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  zip.file(EXPORT_ZIP.NOTES_FILE, JSON.stringify(exportedNotes, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: EXPORT_ZIP.COMPRESSION,
    compressionOptions: {
      level: EXPORT_ZIP.COMPRESSION_LEVEL
    }
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `notes-me-backup-${date}.zip`;

  downloadBlob(blob, filename);
  saveLastBackupDate();

  return {
    filename,
    notesCount: notes.length,
    filesCount
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.rel = 'noopener';

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function sanitizeZipFileName(fileName = 'fichier') {
  return String(fileName)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'fichier';
}

function saveLastBackupDate() {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_AT, new Date().toISOString());
  } catch (error) {
    console.warn('Impossible de sauvegarder la date du dernier export.', error);
  }
}
