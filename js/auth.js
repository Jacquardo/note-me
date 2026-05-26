// js/auth.js
// ─────────────────────────────────────────────────────────
// Gestion de l'authentification Google (Google Identity Services)
// Remplacez CLIENT_ID par votre identifiant Google Cloud
// ─────────────────────────────────────────────────────────

const CLIENT_ID = '180670406711-3t7e475knnbt8lckloot895qqu7hu9s0.apps.googleusercontent.com'; // ← À remplacer
const AUTH_STORAGE_KEY = 'notes_me_user_session';

let currentUser = null;

// ── Initialisation ────────────────────────────────────────
/**
 * Lance l'auth au démarrage de l'app.
 * Résout avec l'utilisateur si déjà connecté, null sinon.
 * @returns {Promise<object|null>}
 */
export function initAuth() {
  return new Promise((resolve) => {
    // Vérifier une session existante en localStorage
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
        _updateUserUI(currentUser);
        resolve(currentUser);
        return;
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }

    // Attendre que la lib Google soit chargée
    const waitForGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(waitForGoogle);
        _setupGoogleSignIn(resolve);
      }
    }, 100);
  });
}

// ── Setup Google Sign-In ──────────────────────────────────
function _setupGoogleSignIn(resolve) {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => {
      _handleCredentialResponse(response);
      resolve(currentUser);
    },
    auto_select: true,
    cancel_on_tap_outside: false,
  });

  _showLoginOverlay();

  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280,
      locale: 'fr',
    }
  );

  // Déclenche le One Tap si disponible
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // One Tap non disponible, le bouton manuel prend le relais
    }
  });
}

// ── Traitement de la réponse Google ──────────────────────
function _handleCredentialResponse(response) {
  const decoded = _parseJwt(response.credential);
  currentUser = {
    id:      decoded.sub,
    name:    decoded.name,
    email:   decoded.email,
    picture: decoded.picture,
    token:   response.credential,
    loginAt: Date.now(),
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
  _hideLoginOverlay();
  _updateUserUI(currentUser);
}

// ── Déconnexion ───────────────────────────────────────────
/**
 * Déconnecte l'utilisateur et affiche l'écran de connexion.
 */
export function signOut() {
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
  currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  _updateUserUI(null);
  _showLoginOverlay();
}

// ── Accesseurs ────────────────────────────────────────────
/** Retourne l'utilisateur connecté ou null */
export function getCurrentUser() {
  return currentUser;
}

/** Vrai si un utilisateur est connecté */
export function isAuthenticated() {
  return currentUser !== null;
}

// ── UI : overlay de connexion ─────────────────────────────
function _showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  // Bloquer le scroll du body
  document.body.style.overflow = 'hidden';
}

function _hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.setAttribute('hidden', '');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ── UI : infos utilisateur dans le header ────────────────
function _updateUserUI(user) {
  const userInfoBlock = document.getElementById('userInfoBlock');
  const userName      = document.getElementById('userDisplayName');
  const userAvatar    = document.getElementById('userAvatar');
  const logoutBtn     = document.getElementById('logoutBtn');

  if (!userInfoBlock) return;

  if (user) {
    if (userName)   userName.textContent = user.name;
    if (userAvatar) {
      userAvatar.src = user.picture || '';
      userAvatar.alt = `Avatar de ${user.name}`;
    }
    userInfoBlock.removeAttribute('hidden');
    if (logoutBtn) logoutBtn.removeAttribute('hidden');
  } else {
    userInfoBlock.setAttribute('hidden', '');
    if (logoutBtn) logoutBtn.setAttribute('hidden', '');
  }
}

// ── Utilitaire JWT (décodage client uniquement) ───────────
function _parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json      = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}
