import {
  DEFAULT_SETTINGS,
  STORES
} from '../config/constants.js';

import {
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  putInStore
} from './database.js';

export async function getAllSettings() {
  const records = await getAllFromStore(STORES.SETTINGS);
  const settings = {
    ...DEFAULT_SETTINGS
  };

  for (const record of records) {
    if (!record || typeof record.key !== 'string') continue;

    settings[record.key] = record.value;
  }

  return settings;
}

export async function getSetting(key) {
  if (!key) {
    throw new Error('Clé de paramètre manquante.');
  }

  const record = await getFromStore(STORES.SETTINGS, key);

  if (record) {
    return record.value;
  }

  return DEFAULT_SETTINGS[key];
}

export async function setSetting(key, value) {
  if (!key) {
    throw new Error('Clé de paramètre manquante.');
  }

  const record = {
    key,
    value,
    updatedAt: Date.now()
  };

  await putInStore(STORES.SETTINGS, record);

  return value;
}

export async function setSettings(settings = {}) {
  const entries = Object.entries(settings);

  for (const [key, value] of entries) {
    await setSetting(key, value);
  }

  return getAllSettings();
}

export async function deleteSetting(key) {
  if (!key) {
    throw new Error('Clé de paramètre manquante.');
  }

  return deleteFromStore(STORES.SETTINGS, key);
}

export async function resetSettingsToDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await setSetting(key, value);
  }

  return {
    ...DEFAULT_SETTINGS
  };
}
