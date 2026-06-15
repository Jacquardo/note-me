import {
  DEFAULT_SETTINGS,
  LIMITS,
  VIEW_MODES
} from '../config/constants.js';
import {
  getAllSettings,
  resetSettingsToDefaults,
  setSetting,
  setSettings
} from '../db/settingsRepository.js';

export async function restoreSettings() {
  try {
    return await getAllSettings();
  } catch (error) {
    console.warn('Impossible de restaurer les paramètres.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function bindSettingsUI(options = {}) {
  const refs = options.refs || getDefaultRefs();
  const onSave = options.onSave;
  const onReset = options.onReset;
  refs.saveSettingsBtn?.addEventListener('click', async () => {
    const settings = readSettingsForm(refs);
    await saveSettings(settings);
    if (typeof onSave === 'function') onSave(settings);
  });
  refs.resetSettingsBtn?.addEventListener('click', async () => {
    const settings = await resetSettingsToDefaults();
    fillSettingsForm(refs, settings);
    if (typeof onReset === 'function') onReset(settings);
  });
}

export function fillSettingsForm(refs = getDefaultRefs(), settings = DEFAULT_SETTINGS) {
  if (refs.defaultViewModeSelect) {
    refs.defaultViewModeSelect.value = settings.viewMode || VIEW_MODES.CARDS;
  }
  if (refs.pageSizeInput) {
    refs.pageSizeInput.value = Number(settings.pageSize || DEFAULT_SETTINGS.pageSize);
  }
  if (refs.confirmBeforeDeleteInput) {
    refs.confirmBeforeDeleteInput.checked = Boolean(settings.confirmBeforeDelete);
  }
  if (refs.compactAnimationsInput) {
    refs.compactAnimationsInput.checked = Boolean(settings.compactAnimations);
  }
}

export function readSettingsForm(refs = getDefaultRefs()) {
  return {
    viewMode: normalizeViewMode(refs.defaultViewModeSelect?.value),
    pageSize: clamp(
      Number(refs.pageSizeInput?.value || DEFAULT_SETTINGS.pageSize),
      LIMITS.PAGE_SIZE_MIN,
      LIMITS.PAGE_SIZE_MAX
    ),
    confirmBeforeDelete: Boolean(refs.confirmBeforeDeleteInput?.checked),
    compactAnimations: Boolean(refs.compactAnimationsInput?.checked)
  };
}

export async function saveSettings(settings = {}) {
  const normalized = {
    ...DEFAULT_SETTINGS,
    ...settings,
    viewMode: normalizeViewMode(settings.viewMode),
    pageSize: clamp(
      Number(settings.pageSize || DEFAULT_SETTINGS.pageSize),
      LIMITS.PAGE_SIZE_MIN,
      LIMITS.PAGE_SIZE_MAX
    )
  };
  await setSettings(normalized);
  applySettingsToDocument(normalized);
  return normalized;
}

export async function saveSetting(key, value) {
  await setSetting(key, value);
  return value;
}

export function applySettingsToDocument(settings = {}) {
  if (settings.theme) {
    document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : 'dark');
  }
  document.documentElement.classList.toggle('compact-animations', Boolean(settings.compactAnimations));
}

export function normalizeViewMode(viewMode) {
  return Object.values(VIEW_MODES).includes(viewMode) ? viewMode : VIEW_MODES.CARDS;
}

export function getDefaultRefs() {
  return {
    defaultViewModeSelect: document.getElementById('defaultViewModeSelect'),
    pageSizeInput: document.getElementById('pageSizeInput'),
    confirmBeforeDeleteInput: document.getElementById('confirmBeforeDeleteInput'),
    compactAnimationsInput: document.getElementById('compactAnimationsInput'),
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn')
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
