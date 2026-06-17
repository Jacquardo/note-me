export const APP_NAME = 'Notes Me';

export const APP_VERSION = '11.0.0';

export const APP_BACKUP_FORMAT = 'notes-me-zip-v1';

export const DB_NAME = 'NotesMeStudioDB';

export const DB_VERSION = 11;

export const STORES = {
  NOTES:    'notes',
  FILES:    'files',
  VERSIONS: 'noteVersions',
  SETTINGS: 'settings'
};

export const STORAGE_KEYS = {
  THEME:              'notes-me-theme',
  VIEW_MODE:          'notes-me-view-mode',
  SORT_MODE:          'notes-me-sort-mode',
  ACTIVE_FILTER:      'notes-me-active-filter',
  LAST_BACKUP_AT:     'notes-me-last-backup-at'
};

export const VIEW_MODES = {
  CARDS:   'cards',
  LIST:    'list',
  COMPACT: 'compact',
  TABLE:   'table'
};

export const FILTERS = {
  ALL:       'all',
  FAVORITES: 'favorites',
  WITH_FILE: 'with-file',
  RECENT:    'recent'
};

export const SORT_MODES = {
  RECENT:   'recent',
  UPDATED:  'updated',
  OLDEST:   'oldest',
  TITLE:    'title',
  CATEGORY: 'category',
  CUSTOM:   'custom'
};

export const NOTE_COLORS = [
  { name: 'Jaune',  value: '#fff8a6' },
  { name: 'Vert',   value: '#b9ffc0' },
  { name: 'Bleu',   value: '#c6e9ff' },
  { name: 'Rose',   value: '#ffd8e3' },
  { name: 'Orange', value: '#ffd5a3' },
  { name: 'Lilas',  value: '#e7d8ff' }
];

export const DEFAULT_SETTINGS = {
  theme:                    'dark',
  viewMode:                 VIEW_MODES.CARDS,
  defaultSort:              SORT_MODES.RECENT,
  defaultCategory:          '',
  pageSize:                 80,
  confirmBeforeDelete:      true,
  compactAnimations:        false,
  defaultNoteColor:         '#fff8a6',
  autoBackupReminder:       true,
  autoBackupReminderDays:   7
};

export const LIMITS = {
  TITLE_MAX_LENGTH:               160,
  CATEGORY_MAX_LENGTH:            80,
  TAG_MAX_LENGTH:                 40,
  TAGS_MAX_COUNT:                 20,
  CONTENT_MAX_LENGTH:             100000,
  FILE_MAX_SIZE:                  12 * 1024 * 1024,
  ZIP_MAX_IMPORT_SIZE:            250 * 1024 * 1024,
  PAGE_SIZE_MIN:                  20,
  PAGE_SIZE_MAX:                  300,
  PAGE_SIZE_DEFAULT:              80,
  HISTORY_MAX_VERSIONS_PER_NOTE:  30
};

export const MAX_FILE_SIZE = LIMITS.FILE_MAX_SIZE;

/* ── Types de fichiers autorisés ────────────────────────── */

export const ALLOWED_EXTENSIONS = [
  // Documents
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  // Audio
  'mp3',
  'wav',
  'ogg',
  'aac',
  'm4a',
  // Vidéo
  'mp4',
  'webm',
  'mov'
];

export const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  // Vidéo
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo'
];

export const FILE_KINDS = {
  IMAGE:       'image',
  PDF:         'pdf',
  DOCUMENT:    'document',
  SPREADSHEET: 'spreadsheet',
  AUDIO:       'audio',
  VIDEO:       'video',
  FILE:        'file',
  UNKNOWN:     'unknown'
};

export const SEARCH_TOKENS = {
  TAG_PREFIX:      '#',
  CATEGORY_PREFIX: 'category:',
  FAVORITE_TRUE:   ['fav:true', 'favorite:true'],
  FAVORITE_FALSE:  ['fav:false', 'favorite:false'],
  HAS_FILE:        'has:file',
  HAS_IMAGE:       'has:image',
  HAS_PDF:         'has:pdf',
  IS_TRASH:        'is:trash',
  IS_ACTIVE:       'is:active',
  CREATED_PREFIX:  'created:',
  UPDATED_PREFIX:  'updated:'
};

export const DATE_FILTERS = {
  TODAY: 'today',
  WEEK:  'week',
  MONTH: 'month',
  YEAR:  'year'
};

export const EMPTY_STATE_MESSAGES = {
  DEFAULT: {
    title:   'Aucune note',
    message: 'Crée ta première note pour commencer.'
  },
  TRASH: {
    title:   'Corbeille vide',
    message: 'Aucune note supprimée pour le moment.'
  },
  SEARCH: {
    title:   'Aucun résultat',
    message: 'Aucune note ne correspond à cette recherche. Essaie avec un autre mot-clé ou un filtre différent.'
  },
  FAVORITES: {
    title:   'Aucun favori',
    message: 'Ajoute une étoile à une note pour la retrouver ici.'
  },
  WITH_FILE: {
    title:   'Aucune pièce jointe',
    message: 'Aucune note avec fichier joint pour le moment.'
  },
  CATEGORY: {
    title:   'Aucune note dans cette catégorie',
    message: 'Cette catégorie ne contient pas encore de note.'
  },
  RECENT: {
    title:   'Aucune note récente',
    message: 'Aucune note créée ces derniers jours.'
  },
  ERROR: {
    title:   'Erreur',
    message: 'Une erreur est survenue pendant le chargement.'
  }
};

export const PWA = {
  CACHE_VERSION:        'v11.0.0',
  CACHE_NAME:           'notes-me-v11.0.0',
  SERVICE_WORKER_PATH:  './sw.js',
  MANIFEST_PATH:        './manifest.webmanifest'
};

export const EXPORT_ZIP = {
  MANIFEST_FILE:      'manifest.json',
  NOTES_FILE:         'notes.json',
  FILES_DIR:          'files',
  COMPRESSION:        'DEFLATE',
  COMPRESSION_LEVEL:  6
};

export const IMPORT_STRATEGIES = {
  MERGE:          'merge',
  REPLACE:        'replace',
  SKIP_EXISTING:  'skip-existing'
};

export const MODAL_IDS = {
  NOTE:     'noteModal',
  EDITOR:   'editorModal',
  IMAGE:    'imageModal',
  MEDIA:    'mediaModal',
  SETTINGS: 'settingsModal',
  HELP:     'helpModal',
  CONFIRM:  'confirmModal'
};

export const SHORTCUTS = {
  NEW_NOTE: 'n',
  SAVE:     's',
  ESCAPE:   'Escape'
};

export const EMOJI_GROUPS = {
  RECENT: [
    '⭐', '✅', '📌', '📎', '⚠️', '💡', '📞', '📅', '💶', '🧾'
  ],
  SMILEYS: [
    '😀', '🙂', '😍', '🤔', '🙏', '😅', '😎', '😭', '😡', '👍'
  ],
  SYMBOLS: [
    '€', '→', '←', '↑', '↓', '✓', '✕', '•', '★', '§'
  ],
  WORK: [
    '📁', '📄', '📊', '📈', '📉', '🧮', '🖊️', '📬', '🔒', '🔑'
  ]
};

export const NOTE_DEFAULTS = {
  title:           '',
  category:        '',
  tags:            [],
  color:           DEFAULT_SETTINGS.defaultNoteColor,
  backgroundImage: '',
  favorite:        false,
  content:         '',
  fileId:          '',
  fileName:        '',
  fileType:        '',
  fileSize:        0,
  deletedAt:       null
};

export const NOTE_SCHEMA_VERSION = 2;

export function createDefaultNote(now = Date.now()) {
  return {
    id:            '',
    schemaVersion: NOTE_SCHEMA_VERSION,
    ...NOTE_DEFAULTS,
    createdAt: now,
    updatedAt: now,
    order:     now
  };
}
