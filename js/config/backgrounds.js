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
    thumbnail: `/assets/img${i + 1}.png`,  // ← absolu depuis la racine
    value: `/assets/img${i + 1}.png`        // ← identique
  }))
];

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
  const background = getBackgroundByValue(value);
  return background ? background.value : '';
}
