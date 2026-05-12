import { getAllFilesFromDB } from '../db/filesRepository.js';
import { getAllNotesFromDB } from '../db/notesRepository.js';
import { getAllSettings } from '../db/settingsRepository.js';

export async function getStorageEstimate() {
  if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return {
      supported: false,
      usage: 0,
      quota: 0,
      percent: null
    };
  }

  const estimate = await navigator.storage.estimate();

  const usage = Number(estimate.usage || 0);
  const quota = Number(estimate.quota || 0);

  return {
    supported: true,
    usage,
    quota,
    percent: quota ? Math.round((usage / quota) * 100) : null,
    usageLabel: formatBytes(usage),
    quotaLabel: formatBytes(quota)
  };
}

export async function persistStorage() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
    return {
      supported: false,
      persisted: false
    };
  }

  const persisted = await navigator.storage.persist();

  return {
    supported: true,
    persisted
  };
}

export async function isStoragePersisted() {
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
    return false;
  }

  return navigator.storage.persisted();
}

export async function getAppStorageSummary() {
  const [estimate, notes, files, settings] = await Promise.all([
    getStorageEstimate(),
    getAllNotesFromDB().catch(() => []),
    getAllFilesFromDB().catch(() => []),
    getAllSettings().catch(() => ({}))
  ]);

  const activeNotes = notes.filter((note) => !note.deletedAt);
  const trashNotes = notes.filter((note) => note.deletedAt);
  const favoriteNotes = notes.filter((note) => note.favorite && !note.deletedAt);

  const filesSize = files.reduce((total, file) => total + Number(file.size || file.blob?.size || 0), 0);

  return {
    estimate,
    notes: {
      total: notes.length,
      active: activeNotes.length,
      trash: trashNotes.length,
      favorites: favoriteNotes.length
    },
    files: {
      total: files.length,
      size: filesSize,
      sizeLabel: formatBytes(filesSize)
    },
    settings
  };
}

export function shouldWarnStorage(estimate) {
  if (!estimate || !estimate.supported || !estimate.quota) {
    return false;
  }

  return Number(estimate.percent || 0) >= 80;
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (value < 1024) {
    return `${value} o`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} Ko`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${Math.round((value / 1024 / 1024) * 10) / 10} Mo`;
  }

  return `${Math.round((value / 1024 / 1024 / 1024) * 10) / 10} Go`;
}
