import {
  EMPTY_STATE_MESSAGES,
  FILTERS
} from '../config/constants.js';

export function getEmptyStateMessage(context = {}) {
  const {
    currentView,
    activeFilter,
    searchQuery,
    categoryFilter
  } = context;

  if (currentView === 'trash') {
    return EMPTY_STATE_MESSAGES.TRASH;
  }

  if (searchQuery && String(searchQuery).trim()) {
    return EMPTY_STATE_MESSAGES.SEARCH;
  }

  if (categoryFilter) {
    return EMPTY_STATE_MESSAGES.CATEGORY;
  }

  if (activeFilter === FILTERS.FAVORITES || activeFilter === 'favorites') {
    return EMPTY_STATE_MESSAGES.FAVORITES;
  }

  if (activeFilter === FILTERS.WITH_FILE || activeFilter === 'with-file') {
    return EMPTY_STATE_MESSAGES.WITH_FILE;
  }

  if (activeFilter === FILTERS.RECENT || activeFilter === 'recent') {
    return EMPTY_STATE_MESSAGES.RECENT;
  }

  return EMPTY_STATE_MESSAGES.DEFAULT;
}

export function renderEmptyState(container, context = {}) {
  if (!container) return null;

  const message = getEmptyStateMessage(context);
  const element = createEmptyStateElement(message.title, message.message);

  container.replaceChildren(element);

  return element;
}

export function createEmptyStateElement(titleText, messageText, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = options.className || 'empty-state';
  wrapper.setAttribute('role', 'status');

  const title = document.createElement('h3');
  title.textContent = titleText || EMPTY_STATE_MESSAGES.DEFAULT.title;

  const message = document.createElement('p');
  message.textContent = messageText || EMPTY_STATE_MESSAGES.DEFAULT.message;

  wrapper.appendChild(title);
  wrapper.appendChild(message);

  if (options.actionText && typeof options.onAction === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-primary';
    action.textContent = options.actionText;
    action.addEventListener('click', options.onAction);

    wrapper.appendChild(action);
  }

  return wrapper;
}

export function createErrorStateElement(error, options = {}) {
  const message = error?.message || EMPTY_STATE_MESSAGES.ERROR.message;

  return createEmptyStateElement(
    options.title || EMPTY_STATE_MESSAGES.ERROR.title,
    message,
    options
  );
}
