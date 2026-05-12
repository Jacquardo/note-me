import {
  APP_BACKUP_FORMAT,
  EXPORT_ZIP,
  IMPORT_STRATEGIES,
  LIMITS
} from '../config/constants.js';

import {
  getAllNotesFromDB,
  getNoteFromDB,
  saveNoteToDB
} from '../db/notesRepository.js';

import {
  saveFileToDB,
  sanitizeFileName
} from '../db/filesRepository.js';

import { generateImportId, normalizeImportedNote } from './importZipUtils.js';

export async function importBackupZip(file, options = {}) {
  if (!window.JSZip) {
    throw new Error('JSZip est introuvable. Vérifie que vendor/jszip.min.js est bien chargé.');
  }

  if (!file) {
    throw new Error('Aucun fichier ZIP sélectionné.');
  }

  if (file.size > LIMITS.ZIP_MAX_IMPORT_SIZE) {
    throw new Error('Le fichier ZIP est trop volumineux.');
  }

  const strategy = options.strategy || IMPORT_STRATEGIES.MERGE;
  const zip = await JSZip.loadAsync(file);

  const manifest = await readManifest(zip);
  const notes = await readNotes(zip);

  validateBackup(manifest, notes);

  const importedAt = Date.now();
  const existingNotes = await getAllNotesFromDB();
  const existingIds = new Set(existingNotes.map((note) => note.id));

  let importedNotesCount = 0;
  let importedFilesCount = 0;
  let skippedNotesCount = 0;

  for (const rawNote of notes) {
    const normalizedNote = normalizeImportedNote(rawNote, importedAt);

    if (strategy === IMPORT_STRATEGIES.SKIP_EXISTING && existingIds.has(normalizedNote.id)) {
      skippedNotesCount += 1;
      continue;
    }

    if (strategy === IMPORT_STRATEGIES.MERGE && existingIds.has(normalizedNote.id)) {
      normalizedNote.id = generateImportId('note');
      normalizedNote.createdAt = importedAt;
      normalizedNote.updatedAt = importedAt;
      normalizedNote.order = importedAt;
    }

    if (rawNote.exportedFilePath) {
      const zipFile = zip.file(rawNote.exportedFilePath);

      if (zipFile) {
        const blob = await zipFile.async('blob');
        const fileId = normalizedNote.fileId || generateImportId('file');
        const fileName = sanitizeFileName(rawNote.fileName || extractFileName(rawNote.exportedFilePath));

        const fileRecord = {
          id: fileId,
          noteId: normalizedNote.id,
          name: fileName,
          type: rawNote.fileType || blob.type || '',
          size: rawNote.fileSize || blob.size || 0,
          blob,
          createdAt: importedAt
        };

        await saveFileToDB(fileRecord);

        normalizedNote.fileId = fileId;
        normalizedNote.fileName = fileRecord.name;
        normalizedNote.fileType = fileRecord.type;
        normalizedNote.fileSize = fileRecord.size;

        importedFilesCount += 1;
      }
    }

    const existingNote = await getNoteFromDB(normalizedNote.id);

    if (strategy === IMPORT_STRATEGIES.REPLACE || !existingNote || strategy === IMPORT_STRATEGIES.MERGE) {
      await saveNoteToDB(normalizedNote);
      importedNotesCount += 1;
    }
  }

  return {
    importedNotesCount,
    importedFilesCount,
    skippedNotesCount,
    manifest
  };
}

async function readManifest(zip) {
  const manifestFile = zip.file(EXPORT_ZIP.MANIFEST_FILE);

  if (!manifestFile) {
    return null;
  }

  const raw = await manifestFile.async('string');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Le fichier manifest.json est invalide.');
  }
}

async function readNotes(zip) {
  const notesFile = zip.file(EXPORT_ZIP.NOTES_FILE);

  if (!notesFile) {
    throw new Error('Le fichier notes.json est introuvable dans le ZIP.');
  }

  const raw = await notesFile.async('string');

  try {
    const notes = JSON.parse(raw);

    if (!Array.isArray(notes)) {
      throw new Error('notes.json doit contenir un tableau.');
    }

    return notes;
  } catch (error) {
    throw new Error('Le fichier notes.json est invalide.');
  }
}

function validateBackup(manifest, notes) {
  if (manifest && manifest.format && manifest.format !== APP_BACKUP_FORMAT) {
    console.warn('Format de sauvegarde différent du format attendu.', manifest.format);
  }

  if (!Array.isArray(notes)) {
    throw new Error('La sauvegarde ne contient aucune liste de notes.');
  }

  if (notes.length > 20000) {
    throw new Error('La sauvegarde contient trop de notes.');
  }

  return true;
}

function extractFileName(path = '') {
  const parts = String(path).split('/');

  return parts[parts.length - 1] || 'fichier';
}
