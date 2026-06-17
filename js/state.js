export const APP_VERSION = '11.0.0';

export const STORAGE_KEYS = {
  THEME: 'notes-me-theme',
  VIEW_MODE: 'notes-me-view-mode',
  SORT_MODE: 'notes-me-sort-mode',
  ACTIVE_FILTER: 'notes-me-active-filter'
};

export const VIEW_MODES = {
  CARDS: 'cards',
  LIST: 'list',
  COMPACT: 'compact',
  TABLE: 'table'
};

export const FILTERS = {
  ALL: 'all',
  FAVORITES: 'favorites',
  WITH_FILE: 'with-file',
  RECENT: 'recent'
};

export const SORT_MODES = {
  RECENT: 'recent',
  UPDATED: 'updated',
  OLDEST: 'oldest',
  TITLE: 'title',
  CATEGORY: 'category',
  CUSTOM: 'custom'
};

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  viewMode: VIEW_MODES.CARDS,
  defaultSort: SORT_MODES.RECENT,
  defaultCategory: '',
  pageSize: 80,
  confirmBeforeDelete: true,
  compactAnimations: false,
  defaultNoteColor: '#fff8a6'
};

export const state = {
  appVersion: APP_VERSION,
  db: null,
  modules: {},
  notes: [],
  filteredNotes: [],
  renderedOffset: 0,
  hasMoreNotes: false,
  currentView: 'active',
  activeFilter: FILTERS.ALL,
  searchQuery: '',
  categoryFilter: '',
  sortMode: SORT_MODES.RECENT,
  viewMode: VIEW_MODES.CARDS,
  settings: { ...DEFAULT_SETTINGS },
  isReady: false,
  isLoading: false,
  isSaving: false,
  isMenuOpen: false,
  editingNoteId: null,
  viewingNoteId: null,
  selectedFile: null,
  selectedFileRecord: null,
  activeObjectUrls: new Set(),
  editorDraft: {
    title: '',
    category: '',
    tags: '',
    color: DEFAULT_SETTINGS.defaultNoteColor,
    backgroundImage: '',
    favorite: false,
    content: '',
    fileId: '',
    fileName: '',
    fileType: '',
    fileSize: 0
  },
  pagination: {
    pageSize: DEFAULT_SETTINGS.pageSize,
    offset: 0
  },
  lastFocusedElement: null
};

export const refs = {};

export function hydrateRefs() {
  const ids = [
    'mediaModal', 'closeMediaModalBtn', 'mediaViewer', 'downloadMediaBtn', 'mediaModalTitle', 'filterToggleBtn', 'app', 'mainContent', 'menuToggleBtn', 'topNavMenu', 'openBtn',
    'exportZipBtn', 'importZipBtn', 'importZipInput', 'installAppBtn',
    'toggleTrashViewBtn', 'emptyTrashBtn', 'settingsBtn', 'themeToggleBtn',
    'helpBtn', 'searchInput', 'categoryFilter', 'sortSelect', 'viewModeSelect',
    'filterAllBtn', 'filterFavBtn', 'filterWithFileBtn', 'filterRecentBtn',
    'activeCount', 'favoriteCount', 'trashCount', 'listTitle', 'viewBadge',
    'list', 'loadMoreBtn', 'toastRegion', 'noteModal', 'closeNoteModalBtn',
    'noteModalContent', 'noteModalTitle', 'editorModal', 'closeEditorModalBtn',
    'editorModalTitle', 'emojiToggleBtn', 'emojiPanel', 'attachBtn', 'fileInput',
    'titleInput', 'categoryInput', 'categorySuggestions', 'tagsInput',
    'colorPaletteInput', 'colorInput', 'activeColorPreview', 'activeColorCode',
    'colorPicker', 'backgroundToggleBtn', 'activeBackgroundName',
    'backgroundImageInput', 'backgroundPickerPanel', 'favoriteToggleBtn',
    'favoriteInput', 'contentInput', 'attachmentInfo', 'attachmentName',
    'removeFileBtn', 'notePreview', 'cancelEditBtn', 'saveNoteBtn',
    'imageModal', 'closeImageModalBtn', 'downloadImageBtn', 'imageViewer',
    'settingsModal', 'closeSettingsModalBtn', 'defaultViewModeSelect',
    'pageSizeInput', 'confirmBeforeDeleteInput', 'compactAnimationsInput',
    'resetSettingsBtn', 'saveSettingsBtn', 'helpModal', 'closeHelpModalBtn',
    'confirmModal', 'confirmTitle', 'confirmMessage', 'confirmCancelBtn', 'confirmOkBtn'
  ];

  for (const id of ids) {
    refs[id] = document.getElementById(id);
  }

  refs.emojiTabs = Array.from(document.querySelectorAll('.emoji-tab'));
  refs.emojiButtons = Array.from(document.querySelectorAll('.emoji-btn'));
  refs.emojiGroups = Array.from(document.querySelectorAll('.emoji-group'));
  refs.colorOptions = Array.from(document.querySelectorAll('.color-option'));

  return refs;
}

export function getRef(key) {
  return refs[key] || null;
}

export function setState(partialState = {}) {
  Object.assign(state, partialState);
  return state;
}

export function setSettings(partialSettings = {}) {
  state.settings = { ...state.settings, ...partialSettings };
  return state.settings;
}

export function resetEditorDraft() {
  state.editingNoteId = null;
  state.selectedFile = null;
  state.selectedFileRecord = null;
  state.editorDraft = {
    title: '',
    category: '',
    tags: '',
    color: state.settings.defaultNoteColor || DEFAULT_SETTINGS.defaultNoteColor,
    backgroundImage: '',
    favorite: false,
    content: '',
    fileId: '',
    fileName: '',
    fileType: '',
    fileSize: 0
  };
  return state.editorDraft;
}

export function setEditorDraft(partialDraft = {}) {
  state.editorDraft = { ...state.editorDraft, ...partialDraft };
  return state.editorDraft;
}

export function revokeObjectUrls() {
  for (const url of state.activeObjectUrls) {
    URL.revokeObjectURL(url);
  }
  state.activeObjectUrls.clear();
}

export function registerObjectUrl(url) {
  if (url) state.activeObjectUrls.add(url);
  return url;
}

export function unregisterObjectUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  state.activeObjectUrls.delete(url);
}

export function getActiveNotes() {
  return state.notes.filter((note) => !note.deletedAt);
}

export function getTrashNotes() {
  return state.notes.filter((note) => Boolean(note.deletedAt));
}

export function getFavoriteNotes() {
  return state.notes.filter((note) => !note.deletedAt && note.favorite);
}

export function getNotesWithFile() {
  return state.notes.filter((note) => !note.deletedAt && note.fileId);
}

export function getNoteById(noteId) {
  return state.notes.find((note) => note.id === noteId) || null;
}

export function upsertNoteInState(note) {
  if (!note || !note.id) return state.notes;
  const index = state.notes.findIndex((item) => item.id === note.id);
  if (index >= 0) {
    state.notes[index] = note;
  } else {
    state.notes.unshift(note);
  }
  return state.notes;
}

export function removeNoteFromState(noteId) {
  state.notes = state.notes.filter((note) => note.id !== noteId);
  state.filteredNotes = state.filteredNotes.filter((note) => note.id !== noteId);
  return state.notes;
}

export function resetPagination() {
  state.pagination.offset = 0;
  state.renderedOffset = 0;
  state.hasMoreNotes = false;
}

export function updatePagination(nextOffset, hasMore) {
  state.pagination.offset = nextOffset;
  state.renderedOffset = nextOffset;
  state.hasMoreNotes = Boolean(hasMore);
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || state.settings.theme || 'dark';
}

export function setCurrentTheme(theme) {
  const normalizedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  state.settings.theme = normalizedTheme;
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, normalizedTheme);
  } catch (error) {
    console.warn('Impossible de sauvegarder le thème dans localStorage.', error);
  }
  return normalizedTheme;
}
