export const NOTE_BACKGROUNDS = [
  {
    id: '',
    name: 'Aucun fond',
    thumbnail: '',
    value: ''
  },
  {
    id: 'img1',
    name: 'Fond 1',
    thumbnail: 'assets/img1.png',
    value: 'assets/img1.png'
  },
  {
    id: 'img2',
    name: 'Fond 2',
    thumbnail: 'assets/img2.png',
    value: 'assets/img2.png'
  },
  {
    id: 'img3',
    name: 'Fond 3',
    thumbnail: 'assets/img3.png',
    value: 'assets/img3.png'
  },
  {
    id: 'img4',
    name: 'Fond 4',
    thumbnail: 'assets/img4.png',
    value: 'assets/img4.png'
  },
  {
    id: 'img5',
    name: 'Fond 5',
    thumbnail: 'assets/img5.png',
    value: 'assets/img5.png'
  },
  {
    id: 'img6',
    name: 'Fond 6',
    thumbnail: 'assets/img6.png',
    value: 'assets/img6.png'
  },
  {
    id: 'img7',
    name: 'Fond 7',
    thumbnail: 'assets/img7.png',
    value: 'assets/img7.png'
  },
  {
    id: 'img8',
    name: 'Fond 8',
    thumbnail: 'assets/img8.png',
    value: 'assets/img8.png'
  },
  {
    id: 'img9',
    name: 'Fond 9',
    thumbnail: 'assets/img9.png',
    value: 'assets/img9.png'
  },
  {
    id: 'img10',
    name: 'Fond 10',
    thumbnail: 'assets/img10.png',
    value: 'assets/img10.png'
  }
];

export function getBackgroundById(id) {
  return NOTE_BACKGROUNDS.find((background) => background.id === id) || NOTE_BACKGROUNDS[0];
}

export function getBackgroundByValue(value) {
  return NOTE_BACKGROUNDS.find((background) => background.value === value) || NOTE_BACKGROUNDS[0];
}

export function isKnownBackground(value) {
  return NOTE_BACKGROUNDS.some((background) => background.value === value);
}

export function normalizeBackgroundValue(value) {
  if (!value) return '';

  const background = getBackgroundByValue(value);

  return background ? background.value : '';
}
