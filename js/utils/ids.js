export function generateId(prefix = 'id') {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function generateNoteId() {
  return generateId('note');
}

export function generateFileId() {
  return generateId('file');
}

export function generateVersionId() {
  return generateId('version');
}

export function generateSettingId() {
  return generateId('setting');
}

export function generateShortId(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  const safeLength = Math.max(4, Math.min(Number(length || 8), 32));

  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const values = new Uint32Array(safeLength);

    globalThis.crypto.getRandomValues(values);

    for (const value of values) {
      result += alphabet[value % alphabet.length];
    }

    return result;
  }

  for (let index = 0; index < safeLength; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return result;
}

export function generateTimestampId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${generateShortId(6)}`;
}

export function isValidId(value) {
  return typeof value === 'string' && value.trim().length >= 4;
}

export function ensureId(object, prefix = 'id') {
  if (!object || typeof object !== 'object') {
    return {
      id: generateId(prefix)
    };
  }

  if (!isValidId(object.id)) {
    object.id = generateId(prefix);
  }

  return object;
}
