export const VIEW_LABELS = {
  cards: 'Vue cartes',
  list: 'Vue liste',
  compact: 'Vue compacte',
  table: 'Vue tableau'
};

export const VIEW_CLASSES = [
  'view-cards',
  'view-list',
  'view-compact',
  'view-table'
];

export function applyViewMode(listElement, viewMode = 'cards') {
  if (!listElement) return 'cards';
  const normalized = normalizeViewMode(viewMode);
  listElement.classList.remove(...VIEW_CLASSES);
  listElement.classList.add(`view-${normalized}`);
  return normalized;
}

export function normalizeViewMode(viewMode = 'cards') {
  return Object.keys(VIEW_LABELS).includes(viewMode) ? viewMode : 'cards';
}

export function getViewLabel(viewMode = 'cards') {
  return VIEW_LABELS[normalizeViewMode(viewMode)];
}

export function syncViewModeSelect(selectElement, viewMode = 'cards') {
  if (!selectElement) return;
  selectElement.value = normalizeViewMode(viewMode);
}

export function syncViewBadge(badgeElement, viewMode = 'cards') {
  if (!badgeElement) return;
  badgeElement.textContent = getViewLabel(viewMode);
}

export function setViewMode({ listElement, selectElement, badgeElement, viewMode }) {
  const normalized = applyViewMode(listElement, viewMode);
  syncViewModeSelect(selectElement, normalized);
  syncViewBadge(badgeElement, normalized);
  return normalized;
}

export function getRenderLimitForView(viewMode = 'cards', pageSize = 80) {
  const normalized = normalizeViewMode(viewMode);
  const size = Number(pageSize || 80);
  if (normalized === 'compact') return Math.max(size, 140);
  if (normalized === 'table') return Math.max(size, 120);
  return size;
}
