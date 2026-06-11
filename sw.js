const CACHE_VERSION = 'v11.0.2'; // ← version incrémentée pour vider le cache stale
const CACHE_NAME = `notes-me-${CACHE_VERSION}`;

const REQUIRED_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/logo.png'
];

const OPTIONAL_ASSETS = [
  'css/variables.css',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/notes.css',
  'css/modals.css',
  'css/responsive.css',
  'js/app.js',
  'js/state.js',
  'js/config/constants.js',
  'js/config/backgrounds.js',   // ← plus de backgroundImages.js
  'js/db/database.js',
  'js/db/migrations.js',
  'js/db/notesRepository.js',
  'js/db/filesRepository.js',
  'js/db/versionsRepository.js',
  'js/db/settingsRepository.js',
  'js/services/exportZip.js',
  'js/services/importZip.js',
  'js/services/search.js',
  'js/services/storage.js',
  'js/services/history.js',
  'js/services/pwa.js',
  'js/ui/dom.js',
  'js/ui/toast.js',
  'js/ui/modals.js',
  'js/ui/notesRenderer.js',
  'js/ui/listViews.js',
  'js/ui/emptyState.js',
  'js/ui/accessibility.js',
  'js/ui/settingsPanel.js',
  'js/utils/debounce.js',
  'js/utils/dates.js',
  'js/utils/files.js',
  'js/utils/colors.js',
  'js/utils/ids.js',
  'js/utils/text.js',
  'vendor/sortable.min.js',
  'vendor/jszip.min.js',
  '/assets/img1.png',   // ← slash initial ajouté pour cohérence
  '/assets/img2.png',
  '/assets/img3.png',
  '/assets/img4.png',
  '/assets/img5.png',
  '/assets/img6.png',
  '/assets/img7.png',
  '/assets/img8.png',
  '/assets/img9.png',
  '/assets/img10.png'
];
