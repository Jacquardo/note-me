import { DB_NAME, DB_VERSION } from '../config/constants.js';
import { runMigrations } from './migrations.js';

let dbInstance = null;
let openingPromise = null;

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (openingPromise) {
    return openingPromise;
  }

  openingPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB n’est pas disponible dans ce navigateur.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      const oldVersion = event.oldVersion || 0;

      runMigrations(db, oldVersion, transaction);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;

        window.dispatchEvent(
          new CustomEvent('notes-me:db-version-change')
        );
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Impossible d’ouvrir la base IndexedDB.'));
    };

    request.onblocked = () => {
      reject(
        new Error(
          'La mise à jour de la base est bloquée. Ferme les autres onglets Notes Me puis recharge la page.'
        )
      );
    };
  }).finally(() => {
    openingPromise = null;
  });

  return openingPromise;
}

export async function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function deleteDatabase() {
  await closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error('Suppression de la base impossible.'));
    request.onblocked = () => reject(new Error('Suppression bloquée par un autre onglet.'));
  });
}

export async function withStore(storeName, mode, callback) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let settled = false;

    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      const result = callback(store, transaction);

      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error || new Error(`Erreur transaction ${storeName}.`));
        }
      };

      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error || new Error(`Transaction annulée ${storeName}.`));
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}

export async function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFromStore(storeName) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getFromStore(storeName, key) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function putInStore(storeName, value) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteFromStore(storeName, key) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearStore(storeName) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}
