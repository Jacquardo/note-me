// js/google-drive-sync.js

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const NOTES_FILE_NAME = 'notes-me-data.json';

let accessToken = null;
let tokenClient = null;
let notesFileId = null;

function getClientId() {
  return document.body?.dataset?.googleClientId || '';
}

function waitForGoogleIdentity() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;

    const timer = setInterval(() => {
      attempts += 1;

      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
        reject(new Error('Google Identity Services non chargé.'));
      }
    }, 100);
  });
}

export async function initGoogleDriveAuth() {
  await waitForGoogleIdentity();

  const clientId = getClientId();

  if (!clientId) {
    throw new Error('Client ID Google manquant dans body[data-google-client-id].');
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response?.error) {
        console.error('Erreur OAuth Google:', response);
        return;
      }

      accessToken = response.access_token;
      window.dispatchEvent(new CustomEvent('google-drive-token-ready'));
    }
  });
}

export function requestGoogleDriveAccess(prompt = '') {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Drive Auth non initialisé.'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response?.error) {
        reject(response);
        return;
      }

      if (!response?.access_token) {
        reject(new Error('Access token Google Drive manquant.'));
        return;
      }

      accessToken = response.access_token;
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({
      prompt
    });
  });
}

async function ensureAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  try {
    return await requestGoogleDriveAccess('');
  } catch (error) {
    /*
      Si l'accès silencieux échoue, on demande explicitement le consentement.
      C'est normal la première fois que l'utilisateur autorise Google Drive.
    */
    return requestGoogleDriveAccess('consent');
  }
}

async function googleFetch(url, options = {}) {
  await ensureAccessToken();

  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    accessToken = null;

    await requestGoogleDriveAccess('');

    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  return response;
}

async function findNotesFile() {
  const query = encodeURIComponent(
    `name='${NOTES_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`
  );

  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)`;

  const response = await googleFetch(url);

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Erreur recherche fichier Drive:', details);
    throw new Error('Impossible de rechercher le fichier de notes Google Drive.');
  }

  const data = await response.json();
  const file = data.files?.[0] || null;

  notesFileId = file?.id || null;

  return file;
}

async function createNotesFile(initialData = []) {
  const metadata = {
    name: NOTES_FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json'
  };

  const boundary = `notes_me_boundary_${Date.now()}`;

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(Array.isArray(initialData) ? initialData : [], null, 2),
    `--${boundary}--`
  ].join('\r\n');

  const response = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Erreur création fichier Drive:', details);
    throw new Error('Impossible de créer le fichier de notes Google Drive.');
  }

  const file = await response.json();

  notesFileId = file.id;

  return file;
}

export async function loadNotesFromGoogleDrive() {
  await ensureAccessToken();

  const file = await findNotesFile();

  if (!file) {
    await createNotesFile([]);
    return [];
  }

  const response = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${notesFileId}?alt=media`
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Erreur chargement notes Drive:', details);
    throw new Error('Impossible de charger les notes depuis Google Drive.');
  }

  const text = await response.text();

  if (!text.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('JSON de notes invalide:', error);
    return [];
  }
}

export async function saveNotesToGoogleDrive(notes) {
  await ensureAccessToken();

  if (!notesFileId) {
    const existingFile = await findNotesFile();

    if (!existingFile) {
      await createNotesFile(notes);
      return;
    }
  }

  const response = await googleFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${notesFileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify(Array.isArray(notes) ? notes : [], null, 2)
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Erreur sauvegarde notes Drive:', details);
    throw new Error('Impossible d’enregistrer les notes dans Google Drive.');
  }
}

export function clearGoogleDriveSession() {
  accessToken = null;
  notesFileId = null;
}
