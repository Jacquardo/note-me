export function now() {
  return Date.now();
}

export function toDate(value) {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(timestamp, options = {}) {
  if (!timestamp) return options.fallback || 'Date inconnue';

  const date = toDate(Number(timestamp));

  if (!date) return options.fallback || 'Date inconnue';

  try {
    return new Intl.DateTimeFormat(options.locale || 'fr-FR', {
      dateStyle: options.dateStyle || 'medium',
      timeStyle: options.timeStyle || 'short'
    }).format(date);
  } catch (error) {
    return date.toLocaleString(options.locale || 'fr-FR');
  }
}

export function formatDateOnly(timestamp, options = {}) {
  if (!timestamp) return options.fallback || 'Date inconnue';

  const date = toDate(Number(timestamp));

  if (!date) return options.fallback || 'Date inconnue';

  try {
    return new Intl.DateTimeFormat(options.locale || 'fr-FR', {
      dateStyle: options.dateStyle || 'medium'
    }).format(date);
  } catch (error) {
    return date.toLocaleDateString(options.locale || 'fr-FR');
  }
}

export function formatTimeOnly(timestamp, options = {}) {
  if (!timestamp) return options.fallback || 'Heure inconnue';

  const date = toDate(Number(timestamp));

  if (!date) return options.fallback || 'Heure inconnue';

  try {
    return new Intl.DateTimeFormat(options.locale || 'fr-FR', {
      timeStyle: options.timeStyle || 'short'
    }).format(date);
  } catch (error) {
    return date.toLocaleTimeString(options.locale || 'fr-FR');
  }
}

export function formatRelativeDate(timestamp, options = {}) {
  const date = toDate(Number(timestamp));

  if (!date) return options.fallback || 'Date inconnue';

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) {
    return 'À l’instant';
  }

  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes > 0
      ? `Il y a ${diffMinutes} min`
      : `Dans ${Math.abs(diffMinutes)} min`;
  }

  if (Math.abs(diffHours) < 24) {
    return diffHours > 0
      ? `Il y a ${diffHours} h`
      : `Dans ${Math.abs(diffHours)} h`;
  }

  if (Math.abs(diffDays) < 7) {
    return diffDays > 0
      ? `Il y a ${diffDays} j`
      : `Dans ${Math.abs(diffDays)} j`;
  }

  return formatDateOnly(timestamp, options);
}

export function isSameDay(a, b = new Date()) {
  const dateA = toDate(a);
  const dateB = toDate(b);

  if (!dateA || !dateB) return false;

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function isToday(value) {
  return isSameDay(value, new Date());
}

export function isThisWeek(value) {
  const date = toDate(value);

  if (!date) return false;

  const nowDate = new Date();
  const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  return date >= sevenDaysAgo && date <= nowDate;
}

export function isThisMonth(value) {
  const date = toDate(value);

  if (!date) return false;

  const nowDate = new Date();

  return (
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth()
  );
}

export function isThisYear(value) {
  const date = toDate(value);

  if (!date) return false;

  const nowDate = new Date();

  return date.getFullYear() === nowDate.getFullYear();
}

export function startOfDay(value = Date.now()) {
  const date = toDate(value) || new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

export function endOfDay(value = Date.now()) {
  const date = toDate(value) || new Date();

  date.setHours(23, 59, 59, 999);

  return date;
}

export function toIsoString(timestamp = Date.now()) {
  const date = toDate(timestamp);

  return date ? date.toISOString() : new Date().toISOString();
}
