/**
 * googleDriveSync.js
 * Module de synchronisation des notes avec Google Drive (appDataFolder).
 * Les donnÃ©es sont stockÃ©es dans un fichier JSON privÃ©, invisible
 * dans le Drive de l'utilisateur, liÃ© au compte Google connectÃ©.
 *
 * DÃ©pendances : Google Identity Services (GIS) dÃ©jÃ  chargÃ© dans index.html
 */

// â”€â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DRIVE_FILE_NAME = 'notes-me-data.json';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API_BASE  = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD    = 'https://www.googleapis.com/upload/drive/v3';

// â”€â”€â”€ Ã‰tat interne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _tokenClient  = null;
let _accessToken  = null;
let _tokenExpiry  = 0;       // timestamp ms
let _cachedFileId = null;    // id du fichier Drive mis en cache

// â”€â”€â”€ Initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Ã€ appeler une fois aprÃ¨s connexion Google rÃ©ussie.
 * @param {string} clientId  - Votre OAuth 2.0 Client ID Google Cloud
 */
export function initDriveSync(clientId) {
  if (!window.google?.accounts?.oauth2) {
    console.error('[DriveSync] Google Identity Services non chargÃ©.');
    return;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id : clientId,
    scope     : DRIVE_SCOPE,
    callback  : ''           // sera remplacÃ© dynamiquement
  });
}

// â”€â”€â”€ Gestion du token d'accÃ¨s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Demande ou renouvelle silencieusement un access token Drive.
 * @returns {Promise<string>} access token
 */
export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      return reject(new Error('[DriveSync] tokenClient non initialisÃ©. Appelez initDriveSync() d\'abord.'));
    }

    _tokenClient.callback = (response) => {
      if (response.error) {
        return reject(new Error(`[DriveSync] Token error: ${response.error}`));
      }
      _accessToken = response.access_token;
      // Les tokens GIS expirent en 3600 s â€“ on garde une marge de 60 s
      _tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
      resolve(_accessToken);
    };

    // prompt: '' â†’ silencieux si dÃ©jÃ  autorisÃ©, sinon popup
    _tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Renvoie un token valide (le renouvelle si expirÃ©).
 */
async function getValidToken() {
  if (!_accessToken || Date.now() >= _tokenExpiry) {
    await requestAccessToken();
  }
  return _accessToken;
}

// â”€â”€â”€ Helpers Drive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function authHeader() {
  return { Authorization: `Bearer ${await getValidToken()}` };
}

/**
 * Cherche le fichier notes-me-data.json dans appDataFolder.
 * @returns {Promise<string|null>} fileId ou null
 */
async function findDriveFileId() {
  if (_cachedFileId) return _cachedFileId;

  const url = `${DRIVE_API_BASE}/files`
    + `?spaces=appDataFolder`
    + `&q=name='${DRIVE_FILE_NAME}'`
    + `&fields=files(id)`;

  const resp = await fetch(url, { headers: await authHeader() });
  if (!resp.ok) throw new Error(`[DriveSync] list error ${resp.status}`);

  const { files } = await resp.json();
  _cachedFileId = files?.length ? files[0].id : null;
  return _cachedFileId;
}

// â”€â”€â”€ API publique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Charge les notes depuis Drive.
 * @returns {Promise<object|null>} { notes: [...], trashedNotes: [...] } ou null si aucun fichier
 */
export async function loadNotesFromDrive() {
  try {
    const fileId = await findDriveFileId();
    if (!fileId) {
      console.info('[DriveSync] Aucun fichier trouvÃ© â€“ premier dÃ©marrage.');
      return null;
    }

    const resp = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      { headers: await authHeader() }
    );
    if (!resp.ok) throw new Error(`[DriveSync] download error ${resp.status}`);

    const data = await resp.json();
    console.info('[DriveSync] Notes chargÃ©es depuis Drive.');
    return data;
  } catch (err) {
    console.error('[DriveSync] loadNotesFromDrive :', err);
    return null;
  }
}

/**
 * Sauvegarde les notes dans Drive (crÃ©e ou met Ã  jour le fichier).
 * @param {{ notes: any[], trashedNotes: any[] }} notesData
 * @returns {Promise<void>}
 */
export async function saveNotesToDrive(notesData) {
  const token   = await getValidToken();
  const body    = JSON.stringify(notesData);
  const fileId  = await findDriveFileId();

  if (fileId) {
    // â”€â”€ Mise Ã  jour (PATCH media only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const resp = await fetch(
      `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`,
      {
        method  : 'PATCH',
        headers : {
          Authorization  : `Bearer ${token}`,
          'Content-Type' : 'application/json'
        },
        body
      }
    );
    if (!resp.ok) throw new Error(`[DriveSync] update error ${resp.status}`);
  } else {
    // â”€â”€ CrÃ©ation (multipart : metadata + contenu) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const metadata = JSON.stringify({
      name    : DRIVE_FILE_NAME,
      parents : ['appDataFolder']
    });

    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file',     new Blob([body],     { type: 'application/json' }));

    const resp = await fetch(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
      {
        method  : 'POST',
        headers : { Authorization: `Bearer ${token}` },
        body    : form
      }
    );
    if (!resp.ok) throw new Error(`[DriveSync] create error ${resp.status}`);

    const created = await resp.json();
    _cachedFileId = created.id;   // mise en cache immÃ©diate
  }

  console.info('[DriveSync] Notes sauvegardÃ©es dans Drive.');
}

/**
 * Supprime le fichier Drive (utile en cas de reset).
 * @returns {Promise<void>}
 */
export async function deleteDriveFile() {
  const fileId = await findDriveFileId();
  if (!fileId) return;

  await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method  : 'DELETE',
    headers : await authHeader()
  });
  _cachedFileId = null;
  console.info('[DriveSync] Fichier Drive supprimÃ©.');
}

/**
 * RÃ©voque le token courant (Ã  appeler lors du logout).
 */
export function revokeDriveToken() {
  if (_accessToken) {
    google.accounts.oauth2.revoke(_accessToken, () => {
      console.info('[DriveSync] Token rÃ©voquÃ©.');
    });
    _accessToken  = null;
    _tokenExpiry  = 0;
    _cachedFileId = null;
  }
}
