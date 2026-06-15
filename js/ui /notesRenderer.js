import {
  createBadge,
  createButton,
  createElement,
  isInteractiveElement
} from './dom.js';
import { createEmptyStateElement, getEmptyStateMessage } from './emptyState.js';
import { applyViewMode, getViewLabel } from './listViews.js';

export async function renderNotes({
  container, notes = [], state = {}, refs = {},
  onOpen, onEdit, onDelete, onRestore, onToggleFavorite
} = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  applyViewMode(container, state.viewMode || 'cards');
  if (refs.viewBadge) {
    refs.viewBadge.textContent = getViewLabel(state.viewMode || 'cards');
  }
  const fragment = document.createDocumentFragment();
  if (!notes.length) {
    const emptyMessage = getEmptyStateMessage({
      currentView: state.currentView,
      activeFilter: state.activeFilter,
      searchQuery: state.searchQuery,
      categoryFilter: state.categoryFilter
    });
    fragment.appendChild(createEmptyStateElement(emptyMessage.title, emptyMessage.message));
    container.replaceChildren(fragment);
    if (refs.loadMoreBtn) refs.loadMoreBtn.hidden = true;
    container.setAttribute('aria-busy', 'false');
    return;
  }
  const renderLimit = getSafeRenderLimit(state);
  const visibleNotes = notes.slice(0, renderLimit);
  for (const note of visibleNotes) {
    fragment.appendChild(createNoteCard({ note, state, onOpen, onEdit, onDelete, onRestore, onToggleFavorite }));
  }
  container.replaceChildren(fragment);
  if (refs.loadMoreBtn) {
    refs.loadMoreBtn.hidden = notes.length <= visibleNotes.length;
    refs.loadMoreBtn.onclick = () => {
      renderMoreNotes({ container, notes, state, refs, onOpen, onEdit, onDelete, onRestore, onToggleFavorite });
    };
  }
  state.renderedOffset = visibleNotes.length;
  state.hasMoreNotes = notes.length > visibleNotes.length;
  container.setAttribute('aria-busy', 'false');
  await yieldToBrowser();
}

export function renderMoreNotes({
  container, notes = [], state = {}, refs = {},
  onOpen, onEdit, onDelete, onRestore, onToggleFavorite
} = {}) {
  if (!container) return;
  const currentOffset = Number(state.renderedOffset || 0);
  const renderLimit = getSafeRenderLimit(state);
  const nextNotes = notes.slice(currentOffset, currentOffset + renderLimit);
  const fragment = document.createDocumentFragment();
  for (const note of nextNotes) {
    fragment.appendChild(createNoteCard({ note, state, onOpen, onEdit, onDelete, onRestore, onToggleFavorite }));
  }
  container.appendChild(fragment);
  const nextOffset = currentOffset + nextNotes.length;
  state.renderedOffset = nextOffset;
  state.hasMoreNotes = notes.length > nextOffset;
  if (refs.loadMoreBtn) refs.loadMoreBtn.hidden = !state.hasMoreNotes;
}

export function createNoteCard({
  note, state = {}, onOpen, onEdit, onDelete, onRestore, onToggleFavorite
} = {}) {
  const noteId = note?.id || '';
  const item = createElement('article', {
    className: `item ${note.deletedAt ? 'is-deleted' : ''}`.trim(),
    attrs: {
      tabindex: '0',
      role: 'button',
      'aria-label': `Ouvrir la note ${note.title || 'sans titre'}`
    },
    dataset: { noteId }
  });
  applyNoteStyle(item, note);
  const head = createNoteHead(note, onToggleFavorite);
  const badges = createNoteBadges(note);
  const content = createNoteContent(note);
  const attachmentZone = createAttachmentZone(note);
  const meta = createNoteMeta(note);
  const actions = createNoteActions(note, { onEdit, onDelete, onRestore });
  item.appendChild(head);
  item.appendChild(badges);
  item.appendChild(content);
  if (attachmentZone) item.appendChild(attachmentZone);
  item.appendChild(meta);
  item.appendChild(actions);
  item.addEventListener('click', (event) => {
    if (isInteractiveElement(event.target)) return;
    if (typeof onOpen === 'function') onOpen(noteId);
  });
  item.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isInteractiveElement(event.target)) return;
    event.preventDefault();
    if (typeof onOpen === 'function') onOpen(noteId);
  });
  return item;
}

function createNoteHead(note, onToggleFavorite) {
  const head = createElement('div', { className: 'note-head' });
  const title = createElement('h3', { className: 'note-title', textContent: note.title || 'Sans titre' });
  const actions = createElement('div', { className: 'head-actions' });
  const favoriteButton = createButton({
    className: `head-icon-btn ${note.favorite ? 'is-favorite' : ''}`.trim(),
    textContent: note.favorite ? '★' : '☆',
    ariaLabel: note.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
    onClick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      runCallbackSafely(() => {
        if (typeof onToggleFavorite === 'function') onToggleFavorite(note.id);
      });
    }
  });
  favoriteButton.setAttribute('aria-pressed', note.favorite ? 'true' : 'false');
  actions.appendChild(favoriteButton);
  head.appendChild(title);
  head.appendChild(actions);
  return head;
}

function createNoteBadges(note) {
  const badges = createElement('div', { className: 'note-badges' });
  if (note.favorite) badges.appendChild(createBadge('⭐ Favori'));
  if (note.category) badges.appendChild(createBadge(note.category));
  for (const tag of note.tags || []) {
    badges.appendChild(createBadge(`#${tag}`));  // ← parenthèses correctes
  }
  if (note.fileId || note.fileName) badges.appendChild(createBadge(getFileBadgeText(note)));
  if (note.deletedAt) badges.appendChild(createBadge('🗑️ Corbeille'));
  return badges;
}

function createNoteContent(note) {
  return createElement('p', { className: 'note-content', textContent: note.content || '' });
}

function createAttachmentZone(note) {
  if (!note.fileId && !note.fileName) return null;
  const zone = createElement('div', { className: 'note-attachment-zone' });
  const chip = createElement('span', {
    className: 'attachment-chip',
    textContent: getFileBadgeText(note),
    attrs: { title: note.fileName || 'Pièce jointe' }
  });
  zone.appendChild(chip);
  return zone;
}

function createNoteMeta(note) {
  return createElement('span', {
    className: 'note-meta',
    textContent: formatDate(note.updatedAt || note.createdAt)
  });
}

function createNoteActions(note, callbacks = {}) {
  const actions = createElement('div', { className: 'note-actions' });
  if (note.deletedAt) {
    const restoreButton = createButton({
      className: 'note-action-btn',
      textContent: '↩',
      ariaLabel: 'Restaurer la note',
      onClick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        runCallbackSafely(() => {
          if (typeof callbacks.onRestore === 'function') callbacks.onRestore(note.id);
        });
      }
    });
    actions.appendChild(restoreButton);
    return actions;
  }
  const editButton = createButton({
    className: 'note-action-btn',
    textContent: '✏️',
    ariaLabel: 'Modifier la note',
    onClick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      runCallbackSafely(() => {
        if (typeof callbacks.onEdit === 'function') callbacks.onEdit(note.id);
      });
    }
  });
  const deleteButton = createButton({
    className: 'note-action-btn danger',
    textContent: '🗑️',
    ariaLabel: 'Supprimer la note',
    onClick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      runCallbackSafely(() => {
        if (typeof callbacks.onDelete === 'function') callbacks.onDelete(note.id);
      });
    }
  });
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);
  return actions;
}

function applyNoteStyle(item, note) {
  const color = isValidHexColor(note.color) ? note.color : '#fff8a6';
  item.style.setProperty('--note-bg-light', color);
  item.style.setProperty('--note-bg-base', color);
  applyNoteBackgroundToElement(item, note);
  const rotation = getStableRotation(note.id);
  item.style.setProperty('--rot', `${rotation}deg`);
  const textColor = getReadableTextColor(color);
  item.style.setProperty('--note-text', textColor);
  if (textColor === '#ffffff') {
    item.style.setProperty('--note-chip-bg', 'rgba(0, 0, 0, 0.34)');
  } else {
    item.style.setProperty('--note-chip-bg', 'rgba(255, 255, 255, 0.58)');
  }
}

function applyNoteBackgroundToElement(item, note) {
  const backgroundValue = String(note.backgroundImage || '').trim();
  if (!backgroundValue) {
    item.style.removeProperty('--note-image-url');
    item.classList.remove('has-background-image');
    return;
  }
  const safeValue = cssEscapeUrl(backgroundValue);
  if (safeValue.startsWith('linear-gradient') || safeValue.startsWith('radial-gradient')) {
    item.style.setProperty('--note-image-url', safeValue);
  } else {
    item.style.setProperty('--note-image-url', `url("${safeValue}")`);
  }
  item.classList.add('has-background-image');
}

function runCallbackSafely(callback) {
  window.setTimeout(() => { callback(); }, 0);
}

function getSafeRenderLimit(state) {
  const base = Number(state?.pagination?.pageSize || state?.settings?.pageSize || 80);
  return Math.min(Math.max(base, 20), 300);
}

function getFileBadgeText(note) {
  return `${getFileIcon(note)} ${note.fileName || 'Fichier'}`;
}

function getFileIcon(note) {
  const type = String(note.fileType || '').toLowerCase();
  const name = String(note.fileName || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return '🖼️';
  if (type.includes('pdf') || name.endsWith('.pdf')) return '📕';
  if (/\.(doc|docx)$/.test(name)) return '📄';
  return '📎';
}

function formatDate(timestamp) {
  if (!timestamp) return 'Date inconnue';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toLocaleString('fr-FR');
  }
}

function getStableRotation(id = '') {
  const value = String(id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((value % 7) - 3) * 0.45;
}

function isValidHexColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || ''));
}

function getReadableTextColor(hexColor) {
  const hex = String(hexColor || '#fff8a6').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

function cssEscapeUrl(value) {
  return String(value || '').replace(/["\\]/g, '');
}

function yieldToBrowser() {
  return new Promise((resolve) => { window.requestAnimationFrame(() => resolve()); });
}
