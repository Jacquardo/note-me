import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  FILTERS,
  SORT_MODES,
  STORAGE_KEYS,
  VIEW_MODES,
  getActiveNotes,
  getFavoriteNotes,
  getNoteById,
  getTrashNotes,
  hydrateRefs,
  refs,
  resetEditorDraft,
  resetPagination,
  setCurrentTheme,
  setEditorDraft,
  setSettings,
  setState,
  state,
  unregisterObjectUrl,
  updatePagination,
  upsertNoteInState
} from './state.js';
// ── Authentification Google ───────────────────────────────
import { initAuth, signOut } from './auth.js';
import { migrateBackgroundImagePaths } from './db/migrations.js';
// Ligne 27, après l'import de migrations.js, ajouter :
import {
  NOTE_BACKGROUNDS,
  getBackgroundByValue
} from './config/backgrounds.js';

import {
  initGoogleDriveAuth,
  loadNotesFromGoogleDrive,
  saveNotesToGoogleDrive,
  clearGoogleDriveSession
} from './google-drive-sync.js';

const CONTINUOUS_SYNC_INTERVAL_MS = 45 * 1000;

let continuousSyncTimer = null;
let continuousSyncStarted = false;
let isPullingFromGoogleDrive = false;
let isPushingToGoogleDrive = false;
let isGoogleDriveSyncAvailable = false;
let authLifecycleBound = false;
let activeConfirmationPromise = null;


document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  for (const url of state.activeObjectUrls) {
    URL.revokeObjectURL(url);
  }
});

async function init() {
  try {
    await initAuth();
  } catch (authError) {
    console.error('Erreur authentification Google :', authError);
    return;
  }

  try {
    await initGoogleDriveAuth();
    isGoogleDriveSyncAvailable = true;
  } catch (driveError) {
    isGoogleDriveSyncAvailable = false;
    console.warn('Google Drive Sync non initialisé. Mode local uniquement.', driveError);
  }

  hydrateRefs();
  bindEssentialUi();

  try {
    setState({ isLoading: true });
    await loadOptionalModules();
    restoreLocalPreferences();
    await initDatabase();
    await restoreSettings();
    bindApplicationUi();
    await loadNotes();
    await renderApp();

    if (isGoogleDriveSyncAvailable) {
      startContinuousSync();
    }

    setState({ isReady: true, isLoading: false });
    showToast(`Notes Me V${APP_VERSION} est prêt.`, 'success', { duration: 1800 });
    handleInitialUrlActions();
  } catch (error) {
    console.error('Erreur critique au démarrage :', error);
    setState({ isLoading: false });
    showToast(
      'Impossible de démarrer Notes Me. Le menu reste disponible, mais certaines fonctions peuvent être désactivées.',
      'error',
      { duration: 8000 }
    );
    renderFatalError(error);
  }
}

function bindEssentialUi() {
  bindMainMenu();
  bindTheme();
  bindBasicModalButtons();
  bindKeyboardShortcuts();
  bindLogout();
  bindAuthLifecycle();
  bindFilterPanel();
}

 function bindFilterPanel() {
  const filterToggleBtn = refs.filterToggleBtn || document.getElementById('filterToggleBtn');
  const filterPanel = document.getElementById('filterPanel');
  if (!filterToggleBtn || !filterPanel) return;

  filterToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !filterPanel.hidden;
    filterPanel.hidden = isOpen;
    filterPanel.setAttribute('aria-hidden', String(isOpen));
    filterToggleBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!filterPanel.hidden &&
        !filterToggleBtn.contains(e.target) &&
        !filterPanel.contains(e.target)) {
      filterPanel.hidden = true;
      filterPanel.setAttribute('aria-hidden', 'true');
      filterToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ── Ouverture / téléchargement de pièce jointe ─────────── */


async function openAttachment(note) {
  if (!note?.fileId) return;

  try {
    const filesRepository = state.modules.filesRepository;
    if (!filesRepository || typeof filesRepository.getFileFromDB !== 'function') {
      showToast('Service de fichiers indisponible.', 'error');
      return;
    }

    const fileRecord = await filesRepository.getFileFromDB(note.fileId);
    if (!fileRecord?.blob) {
      showToast('Fichier introuvable.', 'error');
      return;
    }

    const url  = URL.createObjectURL(fileRecord.blob);
    registerObjectUrl(url);
    const type = (note.fileType || fileRecord.type || '').toLowerCase();
    const name = note.fileName  || fileRecord.name || 'fichier';

    if (type.startsWith('image/')) {
      if (refs.imageViewer)      refs.imageViewer.src = url;
      if (refs.downloadImageBtn) refs.downloadImageBtn.onclick = () => triggerDownload(url, name);
      openModal(refs.imageModal);

    } else if (type === 'application/pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');

    } else if (type.startsWith('video/') || type.startsWith('audio/')) {
      openMediaModal(url, name, type);

    } else {
      triggerDownload(url, name);
      setTimeout(() => unregisterObjectUrl(url), 3000);
    }

  } catch (err) {
    console.error('Erreur ouverture fichier :', err);
    showToast("Impossible d'ouvrir le fichier.", 'error');
  }
}
function openMediaModal(url, fileName, mimeType) {
  const viewer      = refs.mediaViewer;
  const titleEl     = refs.mediaModalTitle;
  const downloadBtn = refs.downloadMediaBtn;
  const modal       = refs.mediaModal;
  if (!viewer || !modal) return;

  viewer.innerHTML = '';

  if (mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.src      = url;
    video.controls = true;
    video.style.maxWidth = '100%';
    video.style.borderRadius = '12px';
    viewer.appendChild(video);
  } else {
    const audio = document.createElement('audio');
    audio.src      = url;
    audio.controls = true;
    audio.style.width = '100%';
    viewer.appendChild(audio);
  }

  if (titleEl)     titleEl.textContent = fileName;
  if (downloadBtn) downloadBtn.onclick = () => triggerDownload(url, fileName);

  openModal(modal);
}

function triggerDownload(url, fileName) {
  const a = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getFileIcon(mimeType) {
  const t = (mimeType || '').toLowerCase();
  if (t.startsWith('image/'))                  return '🖼️';
  if (t === 'application/pdf')                 return '📄';
  if (t.startsWith('video/'))                  return '🎬';
  if (t.startsWith('audio/'))                  return '🎵';
  if (t.includes('word') || t.includes('doc')) return '📝';
  if (t.includes('sheet') || t.includes('xls'))return '📊';
  if (t.includes('zip') || t.includes('rar'))  return '📦';
  return '📎';
}
// ─────────────────────────────────────────────────────────────
// Déconnexion Google
// ─────────────────────────────────────────────────────────────

function bindLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (!logoutBtn || logoutBtn.dataset.bound === 'true') return;

  logoutBtn.dataset.bound = 'true';

  logoutBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    setMenuOpen(false);

    const confirmed = await askConfirmation(
      'Se déconnecter',
      'Vous allez être déconnecté de Notes Me. Vos données locales restent intactes.'
    );

    if (!confirmed) return;

    signOut();

    showToast('Vous avez été déconnecté.', 'info');
  });
}

function bindAuthLifecycle() {
  if (authLifecycleBound) {
    return;
  }

  authLifecycleBound = true;

  window.addEventListener('notes-me-authenticated', async () => {
    try {
      await initGoogleDriveAuth();
      isGoogleDriveSyncAvailable = true;

      await loadNotes();
      resetPagination();
      await renderApp();

      startContinuousSync();

      showToast('Synchronisation Google Drive réactivée.', 'success');
    } catch (error) {
      isGoogleDriveSyncAvailable = false;

      console.warn('Impossible de réactiver Google Drive après connexion.', error);

      showToast(
        'Connexion réussie, mais Google Drive n’est pas disponible pour le moment.',
        'warning',
        { duration: 5000 }
      );
    }
  });

  window.addEventListener('notes-me-signed-out', async () => {
    stopContinuousSync();

    isGoogleDriveSyncAvailable = false;

    clearGoogleDriveSession();

    setState({
      notes: [],
      filteredNotes: []
    });

    resetPagination();

    try {
      await renderApp();
    } catch (error) {
      console.warn('Impossible de rafraîchir l’interface après déconnexion.', error);
    }
  });
}

function bindApplicationUi() {
  bindModals();
  bindEditor();
  bindFiltersAndSearch();
  bindViewControls();
  bindImportExport();
  bindSettings();
  bindPwa();
}

async function loadOptionalModules() {
  const moduleLoaders = {
    database: () => import('./db/database.js'),
    notesRepository: () => import('./db/notesRepository.js'),
    filesRepository: () => import('./db/filesRepository.js'),
    versionsRepository: () => import('./db/versionsRepository.js'),
    settingsRepository: () => import('./db/settingsRepository.js'),

    exportZip: () => import('./services/exportZip.js'),
    importZip: () => import('./services/importZip.js'),
    search: () => import('./services/search.js'),
    history: () => import('./services/history.js'),
    pwa: () => import('./services/pwa.js'),

    toast: () => import('./ui/toast.js'),
    notesRenderer: () => import('./ui/notesRenderer.js'),
    listViews: () => import('./ui/listViews.js'),
    emptyState: () => import('./ui/emptyState.js'),
    accessibility: () => import('./ui/accessibility.js'),
    settingsPanel: () => import('./ui/settingsPanel.js'),
    modals: () => import('./ui/modals.js')
  };

  const entries = Object.entries(moduleLoaders);

  await Promise.allSettled(
    entries.map(async ([name, loader]) => {
      try {
        state.modules[name] = await loader();
      } catch (error) {
        state.modules[name] = null;
        console.info(`Module optionnel non chargé : ${name}`, error);
      }
    })
  );
}

async function initDatabase() {
  const databaseModule = state.modules.database;

  if (!databaseModule || typeof databaseModule.openDatabase !== 'function') {
    console.info('Base IndexedDB non initialisée, le module database.js sera ajouté ensuite.');
    return;
  }

  state.db = await databaseModule.openDatabase();
}

async function restoreSettings() {
  const settingsRepository = state.modules.settingsRepository;

  let storedSettings = null;

  if (settingsRepository && typeof settingsRepository.getAllSettings === 'function') {
    try {
      storedSettings = await settingsRepository.getAllSettings();
    } catch (error) {
      console.warn('Impossible de charger les paramètres IndexedDB.', error);
    }
  }

  setSettings({
    ...DEFAULT_SETTINGS,
    ...(storedSettings || {}),
    theme: localStorageSafeGet(STORAGE_KEYS.THEME) || storedSettings?.theme || DEFAULT_SETTINGS.theme,
    viewMode: localStorageSafeGet(STORAGE_KEYS.VIEW_MODE) || storedSettings?.viewMode || DEFAULT_SETTINGS.viewMode,
    defaultSort: localStorageSafeGet(STORAGE_KEYS.SORT_MODE) || storedSettings?.defaultSort || DEFAULT_SETTINGS.defaultSort
  });

  state.viewMode = state.settings.viewMode;
  state.sortMode = state.settings.defaultSort;
  state.pagination.pageSize = Number(state.settings.pageSize || DEFAULT_SETTINGS.pageSize);

  applyTheme(state.settings.theme);
  applyViewMode(state.viewMode);
  syncSettingsForm();
}

function restoreLocalPreferences() {
  const localTheme = localStorageSafeGet(STORAGE_KEYS.THEME);
  const localViewMode = localStorageSafeGet(STORAGE_KEYS.VIEW_MODE);
  const localSortMode = localStorageSafeGet(STORAGE_KEYS.SORT_MODE);
  const localActiveFilter = localStorageSafeGet(STORAGE_KEYS.ACTIVE_FILTER);

  if (localTheme) {
    state.settings.theme = localTheme;
  }

  if (localViewMode && Object.values(VIEW_MODES).includes(localViewMode)) {
    state.viewMode = localViewMode;
    state.settings.viewMode = localViewMode;
  }

  if (localSortMode && Object.values(SORT_MODES).includes(localSortMode)) {
    state.sortMode = localSortMode;
    state.settings.defaultSort = localSortMode;
  }

  if (localActiveFilter && Object.values(FILTERS).includes(localActiveFilter)) {
    state.activeFilter = localActiveFilter;
  }
}

async function loadNotes() {
  const notesRepository = state.modules.notesRepository;

  let localNotes = [];

  if (notesRepository && typeof notesRepository.getAllNotesFromDB === 'function') {
    try {
      const notes = await notesRepository.getAllNotesFromDB();
      localNotes = Array.isArray(notes) ? notes : [];
    } catch (error) {
      console.warn('Impossible de charger les notes locales IndexedDB.', error);
    }
  }

  if (!isGoogleDriveSyncAvailable) {
    setSyncStatus('Mode local', 'error');

    setState({
      notes: localNotes,
      filteredNotes: []
    });

    return state.notes;
  }

  try {
    setSyncStatus('Chargement Google Drive...', 'syncing');
    showToast('Chargement des notes Google Drive...', 'info', { duration: 1800 });

const googleNotes = await loadNotesFromGoogleDrive();

// ✅ Une seule déclaration, avec migration intégrée
let finalNotes = migrateBackgroundImagePaths(
  Array.isArray(googleNotes) ? googleNotes : []
);

if (finalNotes.length === 0 && localNotes.length > 0) {
  finalNotes = localNotes;
  await saveNotesToGoogleDrive(finalNotes);
  showToast('Notes locales migrées vers Google Drive.', 'success');
}

    setState({
      notes: finalNotes,
      filteredNotes: []
    });

    if (notesRepository && typeof notesRepository.saveNoteToDB === 'function') {
      for (const note of finalNotes) {
        await notesRepository.saveNoteToDB(note);
      }
    }

    setSyncStatus('Synchronisé avec Google Drive', 'success');

    return state.notes;
  } catch (error) {
    console.error('Erreur de chargement Google Drive :', error);

    setSyncStatus('Mode local', 'error');

    showToast(
      'Google Drive indisponible. Chargement depuis la copie locale.',
      'warning',
      { duration: 5000 }
    );

    setState({
      notes: localNotes,
      filteredNotes: []
    });

    return state.notes;
  }
}

let googleDriveSyncQueue = Promise.resolve();

function persistNotesToGoogleDrive() {
  if (!isGoogleDriveSyncAvailable) {
    setSyncStatus('Mode local', 'error');

    showToast(
      'Note enregistrée localement. Google Drive n’est pas disponible.',
      'warning',
      { duration: 4000 }
    );

    return Promise.resolve();
  }

  googleDriveSyncQueue = googleDriveSyncQueue
    .catch(() => {})
    .then(async () => {
      try {
        isPushingToGoogleDrive = true;

        setSyncStatus('Synchronisation Google Drive...', 'syncing');

        await saveNotesToGoogleDrive(state.notes);

        setSyncStatus('Synchronisé avec Google Drive', 'success');
      } catch (error) {
        console.error('Erreur synchronisation Google Drive :', error);

        setSyncStatus('Erreur de synchronisation', 'error');

        showToast(
          'Note enregistrée localement, mais pas encore synchronisée avec Google Drive.',
          'warning',
          { duration: 5000 }
        );
      } finally {
        isPushingToGoogleDrive = false;
      }
    });

  return googleDriveSyncQueue;
}

function startContinuousSync() {
  if (!isGoogleDriveSyncAvailable) {
    return;
  }

  if (continuousSyncStarted) {
    return;
  }

  continuousSyncStarted = true;

  continuousSyncTimer = window.setInterval(() => {
    if (document.hidden) return;
    if (navigator.onLine === false) return;

    syncFromGoogleDrive({
      silent: true
    });
  }, CONTINUOUS_SYNC_INTERVAL_MS);

  window.addEventListener('online', handleOnlineSync);
  window.addEventListener('focus', handleFocusSync);
  document.addEventListener('visibilitychange', handleVisibilitySync);
}


function stopContinuousSync() {
  continuousSyncStarted = false;

  if (continuousSyncTimer) {
    window.clearInterval(continuousSyncTimer);
    continuousSyncTimer = null;
  }

  window.removeEventListener('online', handleOnlineSync);
  window.removeEventListener('focus', handleFocusSync);
  document.removeEventListener('visibilitychange', handleVisibilitySync);
}

function handleOnlineSync() {
  syncFromGoogleDrive({
    silent: false
  });
}

function handleFocusSync() {
  syncFromGoogleDrive({
    silent: true
  });
}

function handleVisibilitySync() {
  if (!document.hidden) {
    syncFromGoogleDrive({
      silent: true
    });
  }
}

async function syncFromGoogleDrive({ silent = false } = {}) {
  if (!isGoogleDriveSyncAvailable) {
    return;
  }

  if (isPullingFromGoogleDrive) {
    return;
  }

  if (isPushingToGoogleDrive) {
    return;
  }

  if (state.isSaving) {
    return;
  }

  if (refs.editorModal?.classList.contains('open')) {
    return;
  }

  if (navigator.onLine === false) {
    setSyncStatus('Mode hors ligne', 'error');
    return;
  }

  isPullingFromGoogleDrive = true;

  try {
    if (!silent) {
      showToast('Synchronisation Google Drive...', 'info', { duration: 1400 });
    }

    setSyncStatus('Synchronisation Google Drive...', 'syncing');

await googleDriveSyncQueue.catch(() => {});

const remoteNotes = await loadNotesFromGoogleDrive();
    const safeRemoteNotes = Array.isArray(remoteNotes) ? remoteNotes : [];
    const safeLocalNotes = Array.isArray(state.notes) ? state.notes : [];

    const mergedNotes = mergeNotesByUpdatedAt(safeLocalNotes, safeRemoteNotes);

    const localChanged = !areNotesEquivalent(safeLocalNotes, mergedNotes);
    const remoteChanged = !areNotesEquivalent(safeRemoteNotes, mergedNotes);

    if (localChanged) {
      setState({
        notes: mergedNotes,
        filteredNotes: []
      });

      await cacheNotesLocally(mergedNotes);

      resetPagination();
      await renderApp();
    }

    if (remoteChanged) {
      await saveNotesToGoogleDrive(mergedNotes);
    }

    setSyncStatus('Synchronisé avec Google Drive', 'success');
  } catch (error) {
    console.error('Erreur synchronisation continue Google Drive :', error);

    setSyncStatus('Erreur de synchronisation', 'error');

    if (!silent) {
      showToast(
        'Impossible de synchroniser avec Google Drive pour le moment.',
        'warning',
        { duration: 5000 }
      );
    }
  } finally {
    isPullingFromGoogleDrive = false;
  }
}

function mergeNotesByUpdatedAt(localNotes = [], remoteNotes = []) {
  const notesMap = new Map();

  for (const note of remoteNotes) {
    if (!note?.id) continue;

    notesMap.set(note.id, note);
  }

  for (const localNote of localNotes) {
    if (!localNote?.id) continue;

    const remoteNote = notesMap.get(localNote.id);

    if (!remoteNote) {
      notesMap.set(localNote.id, localNote);
      continue;
    }

    const localTime = getNoteSyncTimestamp(localNote);
    const remoteTime = getNoteSyncTimestamp(remoteNote);

    if (localTime >= remoteTime) {
      notesMap.set(localNote.id, localNote);
    }
  }

  return Array.from(notesMap.values()).sort((a, b) => {
    const dateA = Number(a.updatedAt || a.createdAt || 0);
    const dateB = Number(b.updatedAt || b.createdAt || 0);

    return dateB - dateA;
  });
}

function getNoteSyncTimestamp(note) {
  return Number(note.updatedAt || note.deletedAt || note.createdAt || 0);
}

function areNotesEquivalent(a = [], b = []) {
  return getNotesSignature(a) === getNotesSignature(b);
}

function getNotesSignature(notes = []) {
  return JSON.stringify(
    [...notes]
      .map((note) => ({
        id: note.id,
        title: note.title || '',
        category: note.category || '',
        tags: Array.isArray(note.tags) ? note.tags : [],
        color: note.color || '',
        backgroundImage: note.backgroundImage || '',
        favorite: Boolean(note.favorite),
        content: note.content || '',
        fileId: note.fileId || '',
        fileName: note.fileName || '',
        fileType: note.fileType || '',
        fileSize: Number(note.fileSize || 0),
        createdAt: Number(note.createdAt || 0),
        updatedAt: Number(note.updatedAt || 0),
        deletedAt: note.deletedAt || null,
        order: Number(note.order || 0)
      }))
      .sort((noteA, noteB) => String(noteA.id).localeCompare(String(noteB.id)))
  );
}

async function cacheNotesLocally(notes = []) {
  const notesRepository = state.modules.notesRepository;

  if (!notesRepository || typeof notesRepository.saveNoteToDB !== 'function') {
    return;
  }

  for (const note of notes) {
    await notesRepository.saveNoteToDB(note);
  }
}

async function renderApp() {
  updateStats();
  updateListTitle();
  updateCategoryFilterOptions();
  updateFilterButtons();
  applyViewMode(state.viewMode);

  const notes = filterAndSortNotes();
  state.filteredNotes = notes;

  const rendererModule = state.modules.notesRenderer;

  if (rendererModule && typeof rendererModule.renderNotes === 'function') {
    await rendererModule.renderNotes({
      container: refs.list,
      notes,
      state,
      refs,
      onOpen: openNote,
      onEdit: editNote,
      onDelete: deleteNote,
      onRestore: restoreNote,
      onToggleFavorite: toggleFavorite,
      onOpenAttachment: (note) => openAttachment(note),
      onLoadMore: loadMoreNotes
    });

    return;
  }

  renderNotesFallback(notes);
}

function setSyncStatus(message, type = 'info') {
  const block = document.getElementById('syncStatusBlock');
  const text = document.getElementById('syncStatusText');

  if (!block || !text) return;

  block.hidden = false;
  text.textContent = message;

  block.dataset.status = type;
}

function filterAndSortNotes() {
  let notes = state.currentView === 'trash' ? getTrashNotes() : getActiveNotes();

  if (state.activeFilter === FILTERS.FAVORITES) {
    notes = notes.filter((note) => note.favorite);
  }

  if (state.activeFilter === FILTERS.WITH_FILE) {
    notes = notes.filter((note) => note.fileId);
  }

  if (state.activeFilter === FILTERS.RECENT) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    notes = notes.filter((note) => Number(note.createdAt || 0) >= sevenDaysAgo);
  }

  if (state.categoryFilter) {
    const category = normalizeText(state.categoryFilter);
    notes = notes.filter((note) => normalizeText(note.category) === category);
  }

  const searchModule = state.modules.search;

  if (state.searchQuery.trim()) {
    if (
      searchModule &&
      typeof searchModule.parseSearchQuery === 'function' &&
      typeof searchModule.noteMatchesAdvancedSearch === 'function'
    ) {
      const parsedQuery = searchModule.parseSearchQuery(state.searchQuery);
      notes = notes.filter((note) => searchModule.noteMatchesAdvancedSearch(note, parsedQuery));
    } else {
      const query = normalizeText(state.searchQuery);

      notes = notes.filter((note) => {
        const haystack = normalizeText([
          note.title,
          note.content,
          note.category,
          ...(note.tags || []),
          note.fileName
        ].filter(Boolean).join(' '));

        return haystack.includes(query);
      });
    }
  }

  return sortNotes(notes, state.sortMode);
}

function sortNotes(notes, sortMode) {
  const sorted = [...notes];

  if (sortMode === SORT_MODES.UPDATED) {
    sorted.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
  } else if (sortMode === SORT_MODES.OLDEST) {
    sorted.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  } else if (sortMode === SORT_MODES.TITLE) {
    sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr'));
  } else if (sortMode === SORT_MODES.CATEGORY) {
    sorted.sort((a, b) => String(a.category || '').localeCompare(String(b.category || ''), 'fr'));
  } else if (sortMode === SORT_MODES.CUSTOM) {
    sorted.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  } else {
    sorted.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  return sorted;
}

function renderNotesFallback(notes) {
  if (!refs.list) return;

  refs.list.setAttribute('aria-busy', 'true');

  const pageSize = Number(state.pagination.pageSize || DEFAULT_SETTINGS.pageSize);
  const offset = Number(state.pagination.offset || 0);
  const firstPage = offset === 0;
  const visibleNotes = notes.slice(offset, offset + pageSize);

  const fragment = document.createDocumentFragment();

  if (notes.length === 0 && firstPage) {
    fragment.appendChild(createEmptyStateElement());
  } else {
    for (const note of visibleNotes) {
      fragment.appendChild(createNoteElementFallback(note));
    }
  }

  if (firstPage) {
    refs.list.replaceChildren(fragment);
  } else {
    refs.list.appendChild(fragment);
  }

  const nextOffset = offset + visibleNotes.length;
  const hasMore = nextOffset < notes.length;

  updatePagination(nextOffset, hasMore);

  if (refs.loadMoreBtn) {
    refs.loadMoreBtn.hidden = !hasMore;
  }

  refs.list.setAttribute('aria-busy', 'false');
}

function applyNoteBackgroundToElement(element, note) {
  if (!element || !note) return;

  const backgroundValue = String(note.backgroundImage || '').trim();

  if (!backgroundValue) {
    element.style.removeProperty('--note-image-url');
    element.classList.remove('has-background-image');
    return;
  }

  const safeValue = backgroundValue.replace(/["\\]/g, '');

  let imageValue;
  if (safeValue.startsWith('linear-gradient') || safeValue.startsWith('radial-gradient')) {
    imageValue = safeValue;
  } else {
    // Résoudre en URL absolue pour éviter l'ambiguïté de résolution dans notes.css
    const anchor = document.createElement('a');
    anchor.href = safeValue;
    imageValue = `url("${anchor.href}")`;
  }

  element.style.setProperty('--note-image-url', imageValue);
  element.classList.add('has-background-image');
}

function createNoteElementFallback(note) {
  const item = document.createElement('article');

  item.className = 'item';
  item.tabIndex = 0;
  item.dataset.noteId = note.id;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Ouvrir la note ${note.title || 'sans titre'}`);

  if (note.color) {
    item.style.setProperty('--note-bg-light', note.color);
    item.style.setProperty('--note-bg-base', note.color);
  }

  applyNoteBackgroundToElement(item, note);

  if (note.deletedAt) {
    item.classList.add('is-deleted');
  }

  const head = document.createElement('div');
  head.className = 'note-head';

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.textContent = note.title || 'Sans titre';

  const headActions = document.createElement('div');
  headActions.className = 'head-actions';

  const favoriteBtn = document.createElement('button');
  favoriteBtn.className = `head-icon-btn ${note.favorite ? 'is-favorite' : ''}`;
  favoriteBtn.type = 'button';
  favoriteBtn.textContent = note.favorite ? '★' : '☆';
  favoriteBtn.setAttribute('aria-label', note.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris');
  favoriteBtn.setAttribute('aria-pressed', note.favorite ? 'true' : 'false');

  favoriteBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  toggleFavorite(note.id);
});

  headActions.appendChild(favoriteBtn);
  head.appendChild(title);
  head.appendChild(headActions);

  const badges = document.createElement('div');
  badges.className = 'note-badges';

  if (note.category) {
    badges.appendChild(createBadge(note.category));
  }

  for (const tag of note.tags || []) {
    badges.appendChild(createBadge(`#${tag}`));
  }

  if (note.fileId || note.fileName) {
    badges.appendChild(createBadge(note.fileName ? `📎 ${note.fileName}` : '📎 Fichier'));
  }

  if (note.deletedAt) {
    badges.appendChild(createBadge('🗑️ Corbeille'));
  }

  const content = document.createElement('p');
  content.className = 'note-content';
  content.textContent = note.content || '';

  const meta = document.createElement('span');
  meta.className = 'note-meta';
  meta.textContent = formatDate(note.updatedAt || note.createdAt);

  const actions = document.createElement('div');
  actions.className = 'note-actions';

  if (note.deletedAt) {
    const restoreBtn = createActionButton('Restaurer', '↩');

    restoreBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  restoreNote(note.id);
});

    actions.appendChild(restoreBtn);
  } else {
    const editBtn = createActionButton('Modifier', '✏️');

    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      editNote(note.id);
    });

    const deleteBtn = createActionButton('Supprimer', '🗑️', true);

    deleteBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  deleteNote(note.id);
});

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  }

  item.appendChild(head);
  item.appendChild(badges);
  item.appendChild(content);
  item.appendChild(meta);
  item.appendChild(actions);

  item.addEventListener('click', () => openNote(note.id));

  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openNote(note.id);
    }
  });

  return item;
}


function createBadge(text) {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;

  return badge;
}

function createActionButton(label, text, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `note-action-btn ${danger ? 'danger' : ''}`;
  button.setAttribute('aria-label', label);
  button.textContent = text;

  return button;
}

function createEmptyStateElement() {
  const emptyStateModule = state.modules.emptyState;

  if (emptyStateModule && typeof emptyStateModule.getEmptyStateMessage === 'function') {
    const message = emptyStateModule.getEmptyStateMessage({
      currentView: state.currentView,
      activeFilter: state.activeFilter,
      searchQuery: state.searchQuery,
      categoryFilter: state.categoryFilter
    });

    return buildEmptyState(message.title, message.message);
  }

  if (state.currentView === 'trash') {
    return buildEmptyState('Corbeille vide', 'Aucune note supprimée pour le moment.');
  }

  if (state.searchQuery.trim()) {
    return buildEmptyState('Aucun résultat', 'Aucune note ne correspond à cette recherche.');
  }

  if (state.activeFilter === FILTERS.FAVORITES) {
    return buildEmptyState('Aucun favori', 'Ajoute une étoile à une note pour la retrouver ici.');
  }

  return buildEmptyState('Aucune note', 'Crée ta première note pour commencer.');
}

function buildEmptyState(titleText, messageText) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const title = document.createElement('h3');
  title.textContent = titleText;

  const message = document.createElement('p');
  message.textContent = messageText;

  empty.appendChild(title);
  empty.appendChild(message);

  return empty;
}

function bindMainMenu() {
  if (!refs.menuToggleBtn || !refs.topNavMenu) {
    console.warn('Menu principal introuvable dans le DOM.');
    return;
  }

  if (refs.menuToggleBtn.dataset.bound === 'true') {
    return;
  }

  refs.menuToggleBtn.dataset.bound = 'true';

  refs.menuToggleBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    setMenuOpen(!state.isMenuOpen);
  });

  refs.topNavMenu.addEventListener('click', (event) => {
    event.stopPropagation();

    const clickedButton = event.target.closest('button');

    if (!clickedButton) return;

    const keepOpenButtons = [
      'themeToggleBtn',
      'installAppBtn'
    ];

    if (!keepOpenButtons.includes(clickedButton.id)) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('click', (event) => {
    if (!state.isMenuOpen) return;

    const target = event.target;

    if (
      refs.topNavMenu.contains(target) ||
      refs.menuToggleBtn.contains(target)
    ) {
      return;
    }

    setMenuOpen(false);
  });
}

function setMenuOpen(isOpen) {
  if (!refs.menuToggleBtn || !refs.topNavMenu) return;

  state.isMenuOpen = Boolean(isOpen);

  refs.topNavMenu.classList.toggle('open', state.isMenuOpen);
  refs.topNavMenu.setAttribute('aria-hidden', state.isMenuOpen ? 'false' : 'true');

  refs.menuToggleBtn.setAttribute('aria-expanded', state.isMenuOpen ? 'true' : 'false');
  refs.menuToggleBtn.setAttribute(
    'aria-label',
    state.isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'
  );
}

function bindTheme() {
  if (refs.themeToggleBtn?.dataset.bound === 'true') {
    return;
  }

  if (refs.themeToggleBtn) {
    refs.themeToggleBtn.dataset.bound = 'true';
  }

  refs.themeToggleBtn?.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';

    applyTheme(nextTheme);

    await persistSetting('theme', nextTheme);

    showToast(nextTheme === 'dark' ? 'Thème sombre activé.' : 'Thème clair activé.', 'success');
  });
}

function applyTheme(theme) {
  const appliedTheme = setCurrentTheme(theme);

  if (refs.themeToggleBtn) {
    const icon  = refs.themeToggleBtn.querySelector('.theme-icon');
    const label = refs.themeToggleBtn.querySelector('#themeBtnLabel');
    if (icon)  icon.textContent  = appliedTheme === 'dark' ? '🌙' : '☀️';
    if (label) label.textContent = appliedTheme === 'dark' ? 'Thème sombre' : 'Thème clair';
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', appliedTheme === 'dark' ? '#07111f' : '#edf4fb');
  }
}                          // ← accolade fermante manquante à ajouter

function bindBasicModalButtons() {
  if (document.body.dataset.basicButtonsBound === 'true') {
    return;
  }

  document.body.dataset.basicButtonsBound = 'true';

  refs.openBtn?.addEventListener('click', () => openEditor());

  refs.settingsBtn?.addEventListener('click', openSettings);
  refs.helpBtn?.addEventListener('click', openHelp);

  refs.closeEditorModalBtn?.addEventListener('click', closeEditor);
  refs.cancelEditBtn?.addEventListener('click', closeEditor);

  refs.closeSettingsModalBtn?.addEventListener('click', closeSettings);
  refs.closeHelpModalBtn?.addEventListener('click', closeHelp);
  refs.closeNoteModalBtn?.addEventListener('click', closeNoteModal);
  refs.closeImageModalBtn?.addEventListener('click', closeImageModal);
}

function bindModals() {
  if (document.body.dataset.modalsBound === 'true') {
    return;
  }

  document.body.dataset.modalsBound = 'true';

  document.addEventListener('click', (event) => {
    const modal = event.target.closest?.('.modal.open');

    if (modal && event.target === modal) {
      closeModal(modal);
    }
  });
}

function bindEditor() {
  if (document.body.dataset.editorBound === 'true') {
    return;
  }

  document.body.dataset.editorBound = 'true';

  refs.saveNoteBtn?.addEventListener('click', saveCurrentNote);
  refs.attachBtn?.addEventListener('click', () => refs.fileInput?.click());
  refs.fileInput?.addEventListener('change', handleFileSelection);
  refs.removeFileBtn?.addEventListener('click', removeSelectedFile);

  refs.titleInput?.addEventListener('input', syncEditorDraftFromForm);
  refs.categoryInput?.addEventListener('input', syncEditorDraftFromForm);
  refs.tagsInput?.addEventListener('input', syncEditorDraftFromForm);
  refs.contentInput?.addEventListener('input', syncEditorDraftFromForm);
  refs.colorPaletteInput?.addEventListener('input', handleColorInput);

  refs.favoriteToggleBtn?.addEventListener('click', () => {
    const currentValue = refs.favoriteInput?.value === 'true';
    setFavoriteInEditor(!currentValue);
    syncEditorDraftFromForm();
  });

  refs.emojiToggleBtn?.addEventListener('click', () => {
    if (!refs.emojiPanel) return;

    const isHidden = refs.emojiPanel.classList.toggle('hidden');
    refs.emojiToggleBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
  });

  for (const tab of refs.emojiTabs || []) {
    tab.addEventListener('click', () => activateEmojiGroup(tab.dataset.group));
  }

  for (const button of refs.emojiButtons || []) {
    button.addEventListener('click', () => insertEmoji(button.dataset.emoji || button.textContent));
  }

  for (const option of refs.colorOptions || []) {
    option.addEventListener('click', () => {
      const color = option.dataset.color || DEFAULT_SETTINGS.defaultNoteColor;
      setEditorColor(color);
      syncEditorDraftFromForm();
    });
  }
  
  initBackgroundPicker();  // ← ajouter 2 espaces d'indentation

  refs.backgroundToggleBtn?.addEventListener('click', () => {
    if (!refs.backgroundPickerPanel) return;  // ← 4 espaces
    const hidden = refs.backgroundPickerPanel.classList.toggle('hidden');
    refs.backgroundToggleBtn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  });  // ← 2 espaces pour la fermeture
  
 
  const applyBackgroundBtn = refs.applyBackgroundBtn || document.getElementById('applyBackgroundBtn');
applyBackgroundBtn?.addEventListener('click', () => {
  const val = applyBackgroundBtn.dataset.pendingValue ?? '';
  const name = applyBackgroundBtn.dataset.pendingName
    || (getBackgroundByValue(val)?.name || 'Aucun fond');

  setEditorBackground(val, name); // ← ligne ajoutée : met à jour backgroundImageInput

  if (refs.backgroundPickerPanel) refs.backgroundPickerPanel.classList.add('hidden');
  if (refs.backgroundToggleBtn) refs.backgroundToggleBtn.setAttribute('aria-expanded', 'false');
  delete applyBackgroundBtn.dataset.pendingValue;
  delete applyBackgroundBtn.dataset.pendingName;
  applyBackgroundBtn.textContent = '✔ Fond appliqué';
  applyBackgroundBtn.disabled = true;
  setTimeout(() => {
    applyBackgroundBtn.classList.add('hidden');
    applyBackgroundBtn.textContent = '✅ Appliquer ce fond';
    applyBackgroundBtn.disabled = false;
  }, 1500);
  syncEditorDraftFromForm(); // ← lit maintenant la bonne valeur depuis backgroundImageInput
});
} 

function bindFiltersAndSearch() {
  if (document.body.dataset.filtersBound === 'true') {
    return;
  }

  document.body.dataset.filtersBound = 'true';

  refs.searchInput?.addEventListener('input', debounce(async () => {
    state.searchQuery = refs.searchInput.value || '';
    resetPagination();
    await renderApp();
  }, 180));

  refs.categoryFilter?.addEventListener('change', async () => {
    state.categoryFilter = refs.categoryFilter.value || '';
    resetPagination();
    await renderApp();
  });

  refs.sortSelect?.addEventListener('change', async () => {
    state.sortMode = refs.sortSelect.value || SORT_MODES.RECENT;
    localStorageSafeSet(STORAGE_KEYS.SORT_MODE, state.sortMode);
    await persistSetting('defaultSort', state.sortMode);
    resetPagination();
    await renderApp();
  });

  refs.filterAllBtn?.addEventListener('click', () => setActiveFilter(FILTERS.ALL));
  refs.filterFavBtn?.addEventListener('click', () => setActiveFilter(FILTERS.FAVORITES));
  refs.filterWithFileBtn?.addEventListener('click', () => setActiveFilter(FILTERS.WITH_FILE));
  refs.filterRecentBtn?.addEventListener('click', () => setActiveFilter(FILTERS.RECENT));

  refs.toggleTrashViewBtn?.addEventListener('click', async () => {
    state.currentView = state.currentView === 'trash' ? 'active' : 'trash';
    resetPagination();
    await renderApp();
  });

  refs.emptyTrashBtn?.addEventListener('click', emptyTrash);
  refs.loadMoreBtn?.addEventListener('click', loadMoreNotes);
}

async function setActiveFilter(filter) {
  state.activeFilter = filter;
  localStorageSafeSet(STORAGE_KEYS.ACTIVE_FILTER, filter);
  resetPagination();
  await renderApp();
}

function bindViewControls() {
  if (document.body.dataset.viewControlsBound === 'true') {
    return;
  }

  document.body.dataset.viewControlsBound = 'true';

  if (refs.viewModeSelect) {
    refs.viewModeSelect.value = state.viewMode;

    refs.viewModeSelect.addEventListener('change', async () => {
      const nextMode = refs.viewModeSelect.value || VIEW_MODES.CARDS;

      state.viewMode = nextMode;
      state.settings.viewMode = nextMode;

      localStorageSafeSet(STORAGE_KEYS.VIEW_MODE, nextMode);
      await persistSetting('viewMode', nextMode);

      applyViewMode(nextMode);
      resetPagination();
      await renderApp();
    });
  }

  if (refs.sortSelect) {
    refs.sortSelect.value = state.sortMode;
  }
}

function bindImportExport() {
  if (document.body.dataset.importExportBound === 'true') {
    return;
  }

  document.body.dataset.importExportBound = 'true';

  refs.exportZipBtn?.addEventListener('click', exportZip);
  refs.importZipBtn?.addEventListener('click', () => refs.importZipInput?.click());
  refs.importZipInput?.addEventListener('change', importZip);
}

function bindSettings() {
  if (document.body.dataset.settingsBound === 'true') {
    return;
  }

  document.body.dataset.settingsBound = 'true';

  refs.saveSettingsBtn?.addEventListener('click', saveSettingsFromForm);
  refs.resetSettingsBtn?.addEventListener('click', resetSettings);
}

function bindKeyboardShortcuts() {
  if (document.body.dataset.keyboardBound === 'true') {
    return;
  }

  document.body.dataset.keyboardBound = 'true';

  document.addEventListener('keydown', async (event) => {
    const target = event.target;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);

    if (event.key === 'Escape') {
      closeTopMostModal();
      setMenuOpen(false);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      if (refs.editorModal?.classList.contains('open')) {
        event.preventDefault();
        await saveCurrentNote();
      }

      return;
    }

    if (!isTyping && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openEditor();
    }
  });
}

function bindPwa() {
  const pwaModule = state.modules.pwa;

  if (pwaModule && typeof pwaModule.registerServiceWorker === 'function') {
    pwaModule.registerServiceWorker();
  } else if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('Service worker non enregistré :', error);
      });
    });
  }

  if (pwaModule && typeof pwaModule.bindInstallPrompt === 'function') {
    pwaModule.bindInstallPrompt(refs.installAppBtn);
  }
}

function handleInitialUrlActions() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('action') === 'new-note') {
    openEditor();
  }

  if (params.get('filter') === 'favorites') {
    setActiveFilter(FILTERS.FAVORITES);
  }
}

function initBackgroundPicker() {
  const panel = refs.backgroundPickerPanel || document.getElementById('backgroundPickerPanel');

  if (!panel || panel.dataset.bound === 'true') {
    return;
  }

  panel.dataset.bound = 'true';
  panel.replaceChildren();

  for (const background of NOTE_BACKGROUNDS) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = background.value
      ? 'background-option'
      : 'background-option background-option-empty';

    button.dataset.background = background.value;
    button.setAttribute('aria-label', `Choisir le fond : ${background.name}`);

const preview = document.createElement('span');
preview.className = 'background-option-preview';

if (background.value) {
  preview.style.backgroundImage = `url("${background.value}")`;
} else {
  preview.textContent = 'Aucun';
}

const label = document.createElement('span');
label.className = 'background-option-label';
label.textContent = background.name;
    

    button.appendChild(preview);
    button.appendChild(label);

button.setAttribute('role', 'option');
button.setAttribute('aria-selected', 'false');
button.addEventListener('click', () => {
  setPendingBackground(background.value, background.name);
});

    panel.appendChild(button);
  }

  setEditorBackground(
  refs.backgroundImageInput?.value || '',
  getBackgroundByValue(refs.backgroundImageInput?.value || '')?.name || 'Aucun fond'
);
}

function setEditorBackground(value = '', label = '') {
  const normalizedValue = String(value || '').trim();
  const normalizedLabel = label
  || getBackgroundByValue(normalizedValue)?.name
  || 'Aucun fond';

  if (refs.backgroundImageInput) {
    refs.backgroundImageInput.value = normalizedValue;
  }

  if (refs.activeBackgroundName) {
    refs.activeBackgroundName.textContent = normalizedLabel;
  }

  setEditorDraft({
    backgroundImage: normalizedValue
  });

  const panel = refs.backgroundPickerPanel || document.getElementById('backgroundPickerPanel');

  if (panel) {
    for (const button of panel.querySelectorAll('.background-option')) {
      const isActive = button.dataset.background === normalizedValue;   // ← 6 espaces
      button.classList.toggle('active', isActive);
      button.classList.remove('pending');
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }                                                                   // ← 4 espaces
  }
  updatePreview();
}

/**
 * Marque un fond comme "en attente" sans l'appliquer.
 * Affiche le bouton #applyBackgroundBtn pour confirmer.
 */
function setPendingBackground(value = '', name = '') {
  const panel = refs.backgroundPickerPanel || document.getElementById('backgroundPickerPanel');
  if (panel) {
    for (const btn of panel.querySelectorAll('.background-option')) {
      const isPending = btn.dataset.background === value;
      btn.classList.toggle('pending', isPending);
      btn.setAttribute('aria-selected', isPending ? 'true' : 'false');
    }
  }
  const applyBtn = refs.applyBackgroundBtn || document.getElementById('applyBackgroundBtn');
  if (applyBtn) {
    applyBtn.dataset.pendingValue = value;
    applyBtn.dataset.pendingName = name || getBackgroundByValue(value)?.name || 'Aucun fond'; // ← fix
    applyBtn.classList.remove('hidden');
    applyBtn.textContent = '✅ Appliquer ce fond';
    applyBtn.disabled = false;
  }
}

/** Remet le bouton #applyBackgroundBtn à son état initial. */
function resetApplyBackgroundBtn() {
  const btn = refs.applyBackgroundBtn || document.getElementById('applyBackgroundBtn');
  if (!btn) return;
  btn.classList.add('hidden');
  btn.textContent = '✅ Appliquer ce fond';
  btn.disabled = false;
  delete btn.dataset.pendingValue;
  delete btn.dataset.pendingName;
  const panel = refs.backgroundPickerPanel || document.getElementById('backgroundPickerPanel');
  if (panel) {
    for (const b of panel.querySelectorAll('.background-option.pending')) {
      b.classList.remove('pending');
      b.setAttribute('aria-selected', 'false');
    }
  }
}

function openEditor(note = null) {
  resetEditorDraft();

  state.editingNoteId = note ? note.id : null;

  if (note) {
    setEditorDraft({
      title: note.title || '',
      category: note.category || '',
      tags: Array.isArray(note.tags) ? note.tags.join(', ') : '',
      color: note.color || DEFAULT_SETTINGS.defaultNoteColor,
      backgroundImage: note.backgroundImage || '',
      favorite: Boolean(note.favorite),
      content: note.content || '',
      fileId: note.fileId || '',
      fileName: note.fileName || '',
      fileType: note.fileType || '',
      fileSize: note.fileSize || 0
    });
  }

  syncEditorFormFromDraft();

  if (refs.editorModalTitle) {
    refs.editorModalTitle.textContent = note ? 'Modifier la note' : 'Nouvelle note';
  }

  openModal(refs.editorModal, refs.titleInput);
}

function closeEditor() {
  closeModal(refs.editorModal);
  removeSelectedFile(false);
  resetEditorDraft();
  resetApplyBackgroundBtn();
}

function syncEditorDraftFromForm() {
  setEditorDraft({
    title: refs.titleInput?.value || '',
    category: refs.categoryInput?.value || '',
    tags: refs.tagsInput?.value || '',
    color: refs.colorInput?.value || refs.colorPaletteInput?.value || DEFAULT_SETTINGS.defaultNoteColor,
    // ✅ FIX : fallback sur le draft existant si l'input est absent
    backgroundImage: refs.backgroundImageInput?.value || state.editorDraft?.backgroundImage || '',
    favorite: refs.favoriteInput?.value === 'true',
    content: refs.contentInput?.value || ''
  });
  updatePreview();
}

function syncEditorFormFromDraft() {
  const draft = state.editorDraft;

  if (refs.titleInput) refs.titleInput.value = draft.title || '';
  if (refs.categoryInput) refs.categoryInput.value = draft.category || '';
  if (refs.tagsInput) refs.tagsInput.value = draft.tags || '';
  if (refs.contentInput) refs.contentInput.value = draft.content || '';
  
  setEditorBackground(draft.backgroundImage || '');

  setEditorColor(draft.color || DEFAULT_SETTINGS.defaultNoteColor);
  setFavoriteInEditor(Boolean(draft.favorite));
  updateAttachmentInfo();
  updatePreview();
}

function handleColorInput() {
  const color = refs.colorPaletteInput?.value || DEFAULT_SETTINGS.defaultNoteColor;
  setEditorColor(color);
  syncEditorDraftFromForm();
}

function setEditorColor(color) {
  const normalizedColor = color || DEFAULT_SETTINGS.defaultNoteColor;

  if (refs.colorInput) refs.colorInput.value = normalizedColor;
  if (refs.colorPaletteInput) refs.colorPaletteInput.value = normalizedColor;
  if (refs.activeColorPreview) refs.activeColorPreview.style.background = normalizedColor;
  if (refs.activeColorCode) refs.activeColorCode.textContent = normalizedColor;

  for (const option of refs.colorOptions || []) {
    option.classList.toggle('active', option.dataset.color === normalizedColor);
  }
}

function setFavoriteInEditor(isFavorite) {
  if (refs.favoriteInput) {
    refs.favoriteInput.value = isFavorite ? 'true' : 'false';
  }

  if (refs.favoriteToggleBtn) {
    refs.favoriteToggleBtn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    refs.favoriteToggleBtn.textContent = isFavorite ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
  }
}

function activateEmojiGroup(groupName) {
  for (const tab of refs.emojiTabs || []) {
    const isActive = tab.dataset.group === groupName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }

  for (const group of refs.emojiGroups || []) {
    group.classList.toggle('hidden', group.dataset.emojiGroup !== groupName);
  }
}

function insertEmoji(emoji) {
  if (!emoji || !refs.contentInput) return;

  const input = refs.contentInput;
  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;
  const currentValue = input.value;

  input.value = `${currentValue.slice(0, start)}${emoji}${currentValue.slice(end)}`;
  input.focus();
  input.selectionStart = start + emoji.length;
  input.selectionEnd = start + emoji.length;

  syncEditorDraftFromForm();
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const filesRepository = state.modules.filesRepository;

  if (filesRepository && typeof filesRepository.validateUserFile === 'function') {
    const validation = filesRepository.validateUserFile(file);

    if (!validation.valid) {
      showToast(validation.message || 'Fichier non accepté.', 'error');
      refs.fileInput.value = '';
      return;
    }
  }

  state.selectedFile = file;

  setEditorDraft({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  });

  updateAttachmentInfo();
  showToast('Fichier ajouté à la note.', 'success');
}

function removeSelectedFile(showMessage = true) {
  state.selectedFile = null;
  state.selectedFileRecord = null;

  setEditorDraft({
    fileId: '',
    fileName: '',
    fileType: '',
    fileSize: 0
  });

  if (refs.fileInput) {
    refs.fileInput.value = '';
  }

  updateAttachmentInfo();

  if (showMessage) {
    showToast('Pièce jointe retirée.', 'info');
  }
}

function updateAttachmentInfo() {
  const hasAttachment = Boolean(state.editorDraft.fileName);

  if (refs.attachmentInfo) {
    refs.attachmentInfo.hidden = !hasAttachment;
  }

  if (refs.attachmentName) {
    refs.attachmentName.textContent = state.editorDraft.fileName || '';
  }
}

function updatePreview() {
  if (!refs.notePreview) return;

  const draft = state.editorDraft;

  const note = {
    id: 'preview',
    title: draft.title || 'Sans titre',
    category: draft.category,
    tags: parseTags(draft.tags),
    color: draft.color,
    backgroundImage: draft.backgroundImage,
    favorite: draft.favorite,
    content: draft.content || 'Aperçu du contenu de la note.',
    fileId: draft.fileId || state.selectedFile?.name,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  refs.notePreview.replaceChildren(createNoteElementFallback(note));
}

async function saveCurrentNote() {
  if (state.isSaving) return;

  syncEditorDraftFromForm();

  const draft = state.editorDraft;
  const now = Date.now();

  if (!draft.title.trim() && !draft.content.trim()) {
    showToast('Ajoute au moins un titre ou un contenu.', 'warning');
    refs.titleInput?.focus();
    return;
  }

  setState({
    isSaving: true
  });

  try {
    const existingNote = state.editingNoteId ? getNoteById(state.editingNoteId) : null;

    if (existingNote) {
      await snapshotNote(existingNote, 'before-update');
    }

    let fileId = draft.fileId;
    let fileName = draft.fileName;
    let fileType = draft.fileType;
    let fileSize = draft.fileSize;

    if (state.selectedFile) {
      const savedFile = await saveSelectedFile(state.selectedFile);

      if (savedFile) {
        fileId = savedFile.id;
        fileName = savedFile.name;
        fileType = savedFile.type;
        fileSize = savedFile.size;
      }
    }

const note = {
  id: existingNote?.id || generateId(),
  title: draft.title.trim(),
  category: draft.category.trim(),
  tags: parseTags(draft.tags),
  color: draft.color || DEFAULT_SETTINGS.defaultNoteColor,
  backgroundImage: draft.backgroundImage || '',
  favorite: Boolean(draft.favorite),
  content: draft.content.trim(),
  fileId: fileId || '',
  fileName: fileName || '',
  fileType: fileType || '',
  fileSize: Number(fileSize || 0),
  createdAt: existingNote?.createdAt || now,
  updatedAt: now,
  deletedAt: existingNote?.deletedAt || null,
  order: existingNote?.order || now
};

    const notesRepository = state.modules.notesRepository;

    if (notesRepository && typeof notesRepository.saveNoteToDB === 'function') {
      await notesRepository.saveNoteToDB(note);
    }

    upsertNoteInState(note);

     await persistNotesToGoogleDrive();

    closeEditor();
    resetPagination();
    await renderApp();

     showToast(existingNote ? 'Note modifiée.' : 'Note créée.', 'success');
    
  } catch (error) {
    console.error('Erreur lors de la sauvegarde :', error);
    showToast('Impossible d’enregistrer la note.', 'error');
  } finally {
    setState({
      isSaving: false
    });
  }
}

async function saveSelectedFile(file) {
  const filesRepository = state.modules.filesRepository;

  const fileRecord = {
    id: generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    createdAt: Date.now()
  };

  if (filesRepository && typeof filesRepository.saveFileToDB === 'function') {
    await filesRepository.saveFileToDB(fileRecord);
  }

  return fileRecord;
}

async function snapshotNote(note, reason) {
  const historyModule = state.modules.history;

  if (historyModule && typeof historyModule.snapshotNote === 'function') {
    await historyModule.snapshotNote(note, reason);
  }
}

function openNote(noteId) {
  const note = getNoteById(noteId);

  if (!note) {
    showToast('Note introuvable.', 'error');
    return;
  }

  state.viewingNoteId = noteId;

  if (!refs.noteModalContent) return;

  refs.noteModalContent.replaceChildren();

  const title = document.createElement('h2');
  title.id = 'noteModalTitle';
  title.className = 'modal-title';
  title.textContent = note.title || 'Sans titre';

  const badges = document.createElement('div');
  badges.className = 'note-badges';

  if (note.category) {
    badges.appendChild(createBadge(note.category));
  }

  for (const tag of note.tags || []) {
    badges.appendChild(createBadge(`#${tag}`));
  }

  // ✅ Chip cliquable qui ouvre/télécharge le fichier
if (note.fileName || note.fileId) {
  const attachChip = document.createElement('button');
  attachChip.type      = 'button';
  attachChip.className = 'attachment-chip-btn';
  attachChip.setAttribute('title', note.fileName || 'Pièce jointe');
  attachChip.setAttribute('aria-label', `Ouvrir : ${note.fileName || 'Pièce jointe'}`);

  // Icône selon le type de fichier
  const noteType = (note.fileType || '').toLowerCase();
  const noteName = (note.fileName || '').toLowerCase();
  let icon = '📎';
  if      (noteType.startsWith('image/')  || /\.(png|jpe?g|gif|webp)$/.test(noteName))  icon = '🖼️';
  else if (noteType === 'application/pdf' || noteName.endsWith('.pdf'))                   icon = '📕';
  else if (noteType.startsWith('video/')  || /\.(mp4|webm|mov|avi)$/.test(noteName))    icon = '🎬';
  else if (noteType.startsWith('audio/')  || /\.(mp3|wav|ogg|aac|m4a)$/.test(noteName)) icon = '🎵';
  else if (/\.(doc|docx)$/.test(noteName))                                               icon = '📄';
  else if (/\.(xls|xlsx)$/.test(noteName))                                               icon = '📊';

  const iconSpan  = document.createElement('span');
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = icon;

  const labelSpan = document.createElement('span');
  labelSpan.className  = 'attach-label';
  labelSpan.textContent = note.fileName || 'Pièce jointe';

  attachChip.appendChild(iconSpan);
  attachChip.appendChild(labelSpan);

  attachChip.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAttachment(note);
  });

  badges.appendChild(attachChip);
}

  const content = document.createElement('p');
  content.textContent = note.content || '';

  const meta = document.createElement('span');
  meta.className = 'modal-meta';
  meta.textContent = `Modifiée le ${formatDate(note.updatedAt || note.createdAt)}`;

  const actions = document.createElement('div');
  actions.className = 'modal-subactions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary';
  editBtn.type = 'button';
  editBtn.textContent = '✏️ Modifier';
  editBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  editNote(note.id);
});

  actions.appendChild(editBtn);

  refs.noteModalContent.appendChild(title);
  refs.noteModalContent.appendChild(badges);
  refs.noteModalContent.appendChild(content);
  refs.noteModalContent.appendChild(meta);
  refs.noteModalContent.appendChild(actions);

  openModal(refs.noteModal, refs.closeNoteModalBtn);
}

function closeNoteModal() {
  closeModal(refs.noteModal);
  state.viewingNoteId = null;
}

function closeImageModal() {
  closeModal(refs.imageModal);

  if (refs.imageViewer?.src?.startsWith('blob:')) {
    unregisterObjectUrl(refs.imageViewer.src);
  }

  if (refs.imageViewer) {
    refs.imageViewer.removeAttribute('src');
  }
}

function closeMediaModal() {
  const viewer = refs.mediaViewer;
  if (viewer) {
    const media = viewer.querySelector('video, audio');
    if (media) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    viewer.innerHTML = '';
  }
  closeModal(refs.mediaModal);
}

function editNote(noteId) {
  const note = getNoteById(noteId);

  if (!note) {
    showToast('Note introuvable.', 'error');
    return;
  }

  openEditor(note);
}

async function deleteNote(noteId) {
  const note = getNoteById(noteId);

  if (!note) return;

  const confirmed = await askConfirmation(
    'Supprimer la note',
    'La note sera déplacée dans la corbeille. Tu pourras la restaurer plus tard.'
  );

  if (!confirmed) return;

  try {
    await snapshotNote(note, 'before-delete');

    const updatedNote = {
      ...note,
      deletedAt: Date.now(),
      updatedAt: Date.now()
    };

    const notesRepository = state.modules.notesRepository;

    if (notesRepository && typeof notesRepository.saveNoteToDB === 'function') {
      await notesRepository.saveNoteToDB(updatedNote);
    }

  upsertNoteInState(updatedNote);

  await persistNotesToGoogleDrive();

  resetPagination();
  await renderApp();

  showToast('Note déplacée dans la corbeille.', 'success');
    
  } catch (error) {
    console.error('Erreur suppression note :', error);
    showToast('Impossible de supprimer la note.', 'error');
  }
}

async function restoreNote(noteId) {
  const note = getNoteById(noteId);

  if (!note) return;

  try {
    const updatedNote = {
      ...note,
      deletedAt: null,
      updatedAt: Date.now()
    };

    const notesRepository = state.modules.notesRepository;

    if (notesRepository && typeof notesRepository.saveNoteToDB === 'function') {
      await notesRepository.saveNoteToDB(updatedNote);
    }

    upsertNoteInState(updatedNote);

   await persistNotesToGoogleDrive();

   resetPagination();
   await renderApp();

  showToast('Note restaurée.', 'success');
    
  } catch (error) {
    console.error('Erreur restauration note :', error);
    showToast('Impossible de restaurer la note.', 'error');
  }
}

async function toggleFavorite(noteId) {
  const note = getNoteById(noteId);

  if (!note) return;

  try {
    const updatedNote = {
      ...note,
      favorite: !note.favorite,
      updatedAt: Date.now()
    };

    const notesRepository = state.modules.notesRepository;

    if (notesRepository && typeof notesRepository.saveNoteToDB === 'function') {
      await notesRepository.saveNoteToDB(updatedNote);
    }

    upsertNoteInState(updatedNote);

  await persistNotesToGoogleDrive();

  resetPagination();
  await renderApp();

showToast(updatedNote.favorite ? 'Note ajoutée aux favoris.' : 'Note retirée des favoris.', 'success');
    
  } catch (error) {
    console.error('Erreur favori :', error);
    showToast('Impossible de modifier le favori.', 'error');
  }
}

async function emptyTrash() {
  const trashNotes = getTrashNotes();

  if (!trashNotes.length) {
    showToast('La corbeille est déjà vide.', 'info');
    return;
  }

  const confirmed = await askConfirmation(
    'Vider la corbeille',
    'Cette action supprimera définitivement les notes présentes dans la corbeille.'
  );

  if (!confirmed) return;

  try {
    const notesRepository = state.modules.notesRepository;

    if (notesRepository && typeof notesRepository.deleteNoteFromDB === 'function') {
      for (const note of trashNotes) {
        await notesRepository.deleteNoteFromDB(note.id);
      }
    }

    state.notes = state.notes.filter((note) => !note.deletedAt);

await persistNotesToGoogleDrive();

resetPagination();
await renderApp();

showToast('Corbeille vidée.', 'success');
    
  } catch (error) {
    console.error('Erreur vidage corbeille :', error);
    showToast('Impossible de vider la corbeille.', 'error');
  }
}

async function exportZip() {
  const exportModule = state.modules.exportZip;

  if (!exportModule || typeof exportModule.exportBackupZip !== 'function') {
    showToast('Le module export ZIP est indisponible.', 'warning');
    return;
  }

  try {
    if (refs.exportZipBtn) refs.exportZipBtn.disabled = true;

    showToast('Préparation de l’export ZIP...', 'info');

    await exportModule.exportBackupZip();

    showToast('Export ZIP terminé.', 'success');
  } catch (error) {
    console.error('Erreur export ZIP :', error);
    showToast('Impossible de créer l’export ZIP.', 'error');
  } finally {
    if (refs.exportZipBtn) refs.exportZipBtn.disabled = false;
  }
}

async function importZip(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const importModule = state.modules.importZip;

  if (!importModule || typeof importModule.importBackupZip !== 'function') {
    showToast('Le module import ZIP est indisponible.', 'warning');
    refs.importZipInput.value = '';
    return;
  }

  try {
    await importModule.importBackupZip(file);

    const notesRepository = state.modules.notesRepository;
    let importedNotes = [];

    if (notesRepository && typeof notesRepository.getAllNotesFromDB === 'function') {
      const notes = await notesRepository.getAllNotesFromDB();
      importedNotes = Array.isArray(notes) ? notes : [];
    }

    setState({
      notes: importedNotes,
      filteredNotes: []
    });

    await persistNotesToGoogleDrive();

    resetPagination();
    await renderApp();

    showToast('Import ZIP terminé et synchronisé avec Google Drive.', 'success');
  } catch (error) {
    console.error('Erreur import ZIP :', error);
    showToast('Impossible d’importer le ZIP.', 'error');
  } finally {
    refs.importZipInput.value = '';
  }
}
  
function openSettings() {
  syncSettingsForm();
  openModal(refs.settingsModal, refs.defaultViewModeSelect);
}

function closeSettings() {
  closeModal(refs.settingsModal);
}

function syncSettingsForm() {
  if (refs.defaultViewModeSelect) refs.defaultViewModeSelect.value = state.settings.viewMode || VIEW_MODES.CARDS;
  if (refs.pageSizeInput) refs.pageSizeInput.value = Number(state.settings.pageSize || DEFAULT_SETTINGS.pageSize);
  if (refs.confirmBeforeDeleteInput) refs.confirmBeforeDeleteInput.checked = Boolean(state.settings.confirmBeforeDelete);
  if (refs.compactAnimationsInput) refs.compactAnimationsInput.checked = Boolean(state.settings.compactAnimations);
}

async function saveSettingsFromForm() {
  const settings = {
    viewMode: refs.defaultViewModeSelect?.value || VIEW_MODES.CARDS,
    pageSize: clamp(Number(refs.pageSizeInput?.value || DEFAULT_SETTINGS.pageSize), 20, 300),
    confirmBeforeDelete: Boolean(refs.confirmBeforeDeleteInput?.checked),
    compactAnimations: Boolean(refs.compactAnimationsInput?.checked)
  };

  setSettings(settings);

  state.viewMode = settings.viewMode;
  state.pagination.pageSize = settings.pageSize;

  for (const [key, value] of Object.entries(settings)) {
    await persistSetting(key, value);
  }

  localStorageSafeSet(STORAGE_KEYS.VIEW_MODE, settings.viewMode);

  applyViewMode(settings.viewMode);
  closeSettings();

  resetPagination();
  await renderApp();

  showToast('Paramètres enregistrés.', 'success');
}

async function resetSettings() {
  setSettings({
    ...DEFAULT_SETTINGS
  });

  applyTheme(DEFAULT_SETTINGS.theme);
  applyViewMode(DEFAULT_SETTINGS.viewMode);
  syncSettingsForm();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await persistSetting(key, value);
  }

  showToast('Paramètres réinitialisés.', 'success');
}

async function persistSetting(key, value) {
  const settingsRepository = state.modules.settingsRepository;

  state.settings[key] = value;

  if (settingsRepository && typeof settingsRepository.setSetting === 'function') {
    try {
      await settingsRepository.setSetting(key, value);
    } catch (error) {
      console.warn(`Impossible de sauvegarder le paramètre ${key}.`, error);
    }
  }
}

function openHelp() {
  openModal(refs.helpModal, refs.closeHelpModalBtn);
}

function closeHelp() {
  closeModal(refs.helpModal);
}

function openModal(modal, focusTarget = null) {
  if (!modal) return;

  state.lastFocusedElement = document.activeElement;

  modal.classList.add('open');
  modal.removeAttribute('hidden');
  modal.setAttribute('aria-hidden', 'false');

  document.body.classList.add('modal-open');

  const target =
    focusTarget ||
    modal.querySelector('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');

  requestAnimationFrame(() => {
    target?.focus();
  });
}

function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  if (!document.querySelector('.modal.open')) {
    document.body.classList.remove('modal-open');
  }

  if (
    state.lastFocusedElement &&
    typeof state.lastFocusedElement.focus === 'function' &&
    document.contains(state.lastFocusedElement)
  ) {
    state.lastFocusedElement.focus();
  }

  state.lastFocusedElement = null;
}

function closeTopMostModal() {
  const openModals = Array.from(document.querySelectorAll('.modal.open'));

  if (!openModals.length) return;

  closeModal(openModals[openModals.length - 1]);
}

async function askConfirmation(title, message) {
  if (!state.settings.confirmBeforeDelete) {
    return true;
  }

  if (
    !refs.confirmModal ||
    !refs.confirmTitle ||
    !refs.confirmMessage ||
    !refs.confirmOkBtn ||
    !refs.confirmCancelBtn
  ) {
    return window.confirm(message || 'Êtes-vous sûr ?');
  }

  if (activeConfirmationPromise) {
    return activeConfirmationPromise;
  }

  setMenuOpen(false);

  activeConfirmationPromise = new Promise((resolve) => {
    const modal = refs.confirmModal;
    const confirmTitle = refs.confirmTitle;
    const confirmMessage = refs.confirmMessage;
    const okButton = refs.confirmOkBtn;
    const cancelButton = refs.confirmCancelBtn;

    let resolved = false;

    const finish = (value) => {
      if (resolved) return;

      resolved = true;

      okButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdropClick, true);
      document.removeEventListener('keydown', onKeyDown, true);

      closeModal(modal);

      activeConfirmationPromise = null;

      resolve(value);
    };

    const onConfirm = (event) => {
      event.preventDefault();
      event.stopPropagation();

      finish(true);
    };

    const onCancel = (event) => {
      event.preventDefault();
      event.stopPropagation();

      finish(false);
    };

    const onBackdropClick = (event) => {
      if (event.target !== modal) return;

      event.preventDefault();
      event.stopPropagation();

      finish(false);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();

      finish(false);
    };

    confirmTitle.textContent = title || 'Confirmation';
    confirmMessage.textContent = message || 'Êtes-vous sûr ?';

    okButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdropClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        openModal(modal, cancelButton);
      });
    });
  });

  return activeConfirmationPromise;
}

function loadMoreNotes() {
  renderNotesFallback(state.filteredNotes);
}

function applyViewMode(viewMode) {
  const normalizedViewMode = Object.values(VIEW_MODES).includes(viewMode) ? viewMode : VIEW_MODES.CARDS;

  state.viewMode = normalizedViewMode;

  if (refs.list) {
    refs.list.classList.remove('view-cards', 'view-list', 'view-compact', 'view-table');
    refs.list.classList.add(`view-${normalizedViewMode}`);
  }

  if (refs.viewModeSelect) {
    refs.viewModeSelect.value = normalizedViewMode;
  }

  if (refs.viewBadge) {
    const labels = {
      cards: 'Vue cartes',
      list: 'Vue liste',
      compact: 'Vue compacte',
      table: 'Vue tableau'
    };

    refs.viewBadge.textContent = labels[normalizedViewMode] || 'Vue active';
  }
}

function updateStats() {
  if (refs.activeCount) refs.activeCount.textContent = String(getActiveNotes().length);
  if (refs.favoriteCount) refs.favoriteCount.textContent = String(getFavoriteNotes().length);
  if (refs.trashCount) refs.trashCount.textContent = String(getTrashNotes().length);
}

function updateListTitle() {
  if (!refs.listTitle) return;

  if (state.currentView === 'trash') {
    refs.listTitle.textContent = 'Corbeille';
  } else if (state.activeFilter === FILTERS.FAVORITES) {
    refs.listTitle.textContent = 'Notes favorites';
  } else if (state.activeFilter === FILTERS.WITH_FILE) {
    refs.listTitle.textContent = 'Notes avec fichier';
  } else if (state.activeFilter === FILTERS.RECENT) {
    refs.listTitle.textContent = 'Notes récentes';
  } else {
    refs.listTitle.textContent = 'Mes notes';
  }

  if (refs.toggleTrashViewBtn) {
    refs.toggleTrashViewBtn.textContent = state.currentView === 'trash' ? '📝 Voir les notes' : '🗑️ Voir la corbeille';
  }
}

function updateFilterButtons() {
  const map = {
    [FILTERS.ALL]: refs.filterAllBtn,
    [FILTERS.FAVORITES]: refs.filterFavBtn,
    [FILTERS.WITH_FILE]: refs.filterWithFileBtn,
    [FILTERS.RECENT]: refs.filterRecentBtn
  };

  for (const [filter, button] of Object.entries(map)) {
    if (!button) continue;

    const active = state.activeFilter === filter;

    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function updateCategoryFilterOptions() {
  if (!refs.categoryFilter) return;

  const currentValue = refs.categoryFilter.value;
  const categories = [...new Set(
    state.notes
      .filter((note) => !note.deletedAt && note.category)
      .map((note) => note.category.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'fr'));

  refs.categoryFilter.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Toutes catégories';
  refs.categoryFilter.appendChild(allOption);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    refs.categoryFilter.appendChild(option);
  }

  refs.categoryFilter.value = categories.includes(currentValue) ? currentValue : '';
  state.categoryFilter = refs.categoryFilter.value;

  updateCategorySuggestions(categories);
}

function updateCategorySuggestions(categories) {
  if (!refs.categorySuggestions) return;

  refs.categorySuggestions.replaceChildren();

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    refs.categorySuggestions.appendChild(option);
  }
}

function showToast(message, type = 'info', options = {}) {
  const toastModule = state.modules.toast;

  if (toastModule && typeof toastModule.showToast === 'function') {
    toastModule.showToast(message, type, options);
    return;
  }

  if (!refs.toastRegion) {
    console[type === 'error' ? 'error' : 'log'](message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const content = document.createElement('span');
  content.className = 'toast-message';
  content.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Fermer la notification');

  toast.appendChild(content);
  toast.appendChild(close);
  refs.toastRegion.appendChild(toast);

  const remove = () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 200);
  };

  close.addEventListener('click', remove);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(remove, options.duration ?? 3500);
}

function renderFatalError(error) {
  if (!refs.list) return;

  const empty = buildEmptyState(
    'Erreur de démarrage',
    error?.message || 'Une erreur inattendue empêche le chargement de l’application.'
  );

  refs.list.replaceChildren(empty);
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, ''))
    .filter((tag, index, array) => array.indexOf(tag) === index);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function formatDate(timestamp) {
  if (!timestamp) return 'Date inconnue';

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toLocaleString('fr-FR');
  }
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function debounce(callback, wait = 200) {
  let timeout = null;

  return (...args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function localStorageSafeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function localStorageSafeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Impossible d’écrire ${key} dans localStorage.`, error);
  }
}
