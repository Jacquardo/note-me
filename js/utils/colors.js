export function isValidHexColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '').trim());
}

export function normalizeHexColor(color, fallback = '#fff8a6') {
  const value = String(color || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];

    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return fallback;
}

export function hexToRgb(hexColor) {
  const hex = normalizeHexColor(hexColor).replace('#', '');

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

export function rgbToHex(r, g, b) {
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

export function getLuminance(hexColor) {
  const { r, g, b } = hexToRgb(hexColor);

  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getReadableTextColor(backgroundColor, options = {}) {
  const darkColor = options.dark || '#111827';
  const lightColor = options.light || '#ffffff';
  const threshold = Number(options.threshold ?? 0.55);

  const { r, g, b } = hexToRgb(backgroundColor);
  const perceivedBrightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return perceivedBrightness > threshold ? darkColor : lightColor;
}

export function getContrastRatio(colorA, colorB) {
  const luminanceA = getLuminance(colorA);
  const luminanceB = getLuminance(colorB);

  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}

export function mixColors(colorA, colorB, weight = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  const ratio = Math.min(Math.max(Number(weight), 0), 1);

  return rgbToHex(
    Math.round(a.r * (1 - ratio) + b.r * ratio),
    Math.round(a.g * (1 - ratio) + b.g * ratio),
    Math.round(a.b * (1 - ratio) + b.b * ratio)
  );
}

export function lightenColor(color, amount = 0.15) {
  return mixColors(color, '#ffffff', amount);
}

export function darkenColor(color, amount = 0.15) {
  return mixColors(color, '#000000', amount);
}

export function applyNoteColorVariables(element, color) {
  if (!element) return;

  const normalized = normalizeHexColor(color);
  const textColor = getReadableTextColor(normalized);

  element.style.setProperty('--note-bg-light', lightenColor(normalized, 0.12));
  element.style.setProperty('--note-bg-base', normalized);
  element.style.setProperty('--note-text', textColor);

  if (textColor === '#ffffff') {
    element.style.setProperty('--note-chip-bg', 'rgba(0, 0, 0, 0.34)');
  } else {
    element.style.setProperty('--note-chip-bg', 'rgba(255, 255, 255, 0.58)');
  }
}

export function randomColorFromPalette(palette = []) {
  if (!Array.isArray(palette) || !palette.length) {
    return '#fff8a6';
  }

  const item = palette[Math.floor(Math.random() * palette.length)];

  return typeof item === 'string' ? item : item.value;
}

function toHexChannel(value) {
  const normalized = Math.min(255, Math.max(0, Number(value || 0)));

  return normalized.toString(16).padStart(2, '0');
}
