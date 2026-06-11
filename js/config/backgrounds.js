/**
 * Configuration de tous les fonds disponibles pour les notes.
 * Remplace backgroundImages.js et l'ancien backgrounds.js.
 */

// ── Fonds dégradés et motifs ──────────────────────────────────────────────────
export const BACKGROUND_IMAGES = [
  {
    id: 'gradient-sunset',
    name: 'Coucher de soleil',
    value: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 50%, #c44569 100%)'
  },
  {
    id: 'gradient-ocean',
    name: 'Océan',
    value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    id: 'gradient-forest',
    name: 'Forêt',
    value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)'
  },
  {
    id: 'gradient-autumn',
    name: 'Automne',
    value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    id: 'gradient-mint',
    name: 'Menthe',
    value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 'gradient-warm',
    name: 'Chaleureux',
    value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    id: 'pattern-dots',
    name: 'Pois',
    value: 'radial-gradient(circle, #ddd 1px, transparent 1px)',
    backgroundSize: '20px 20px'
  },
  {
    id: 'pattern-stripes',
    name: 'Rayures',
    value: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0)',
    backgroundSize: '40px 40px',
    backgroundPosition: '0 0, 20px 20px'
  }
];

// ── Fonds images ──────────────────────────────────────────────────────────────
export const NOTE_BACKGROUNDS = [
  {
    id: '',
    name: 'Aucun fond',
    thumbnail: '',
    value: ''
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `img${i + 1}`,
    name: `Fond ${i + 1}`,
    thumbnail: `/assets/img${i + 1}.png`,
    value: `/assets/img${i + 1}.png`
  }))
];

// ── Fonctions utilitaires ─────────────────────────────────────────────────────
export function getBackgroundById(id) {
  return NOTE_BACKGROUNDS.find((bg) => bg.id === id) || NOTE_BACKGROUNDS[0];
}

export function getBackgroundByValue(value) {
  return NOTE_BACKGROUNDS.find((bg) => bg.value === value) || NOTE_BACKGROUNDS[0];
}

export function isKnownBackground(value) {
  return NOTE_BACKGROUNDS.some((bg) => bg.value === value);
}

export function normalizeBackgroundValue(value) {
  if (!value) return '';
  return getBackgroundByValue(value)?.value || '';
}
