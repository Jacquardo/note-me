// js/auth.js

// ─────────────────────────────────────────────────────────
// Gestion de l'authentification Google avec Google Identity Services
// Ce module sert à identifier l'utilisateur.
// Il ne donne pas accès à Google Drive.
// Pour Google Drive, il faut utiliser google.accounts.oauth2 séparément.
// ─────────────────────────────────────────────────────────

const FALLBACK_CLIENT_ID = '180670406711-3t7e475knnbt8lckloot895qqu7hu9s0.apps.googleusercontent.com';
const AUTH_STORAGE_KEY = 'notes_me_user_session';

let currentUser = null;
let googleInitialized = false;
let pendingAuthResolve = null;
let pendingAuthReject = null;

/**
 * Lance l'authentification au démarrage de l'application.
 * Si une session locale valide existe, elle est restaurée.
 * Sinon, l'écran de connexion Google reste affiché.
 *
 * @returns {Promise<object|null>}
 */
export async function initAuth() {
  try {
    await _waitForGoogleIdentityServices();
    _setupGoogleSignIn();

    const storedUser = _loadStoredUser();

    if (storedUser) {
      currentUser = storedUser;

      _hideLoginOverlay();
      _updateUserUI(currentUser);

      return currentUser;
    }

    _showLoginOverlay();

    return new Promise((resolve, reject) => {
      pendingAuthResolve = resolve;
      pendingAuthReject = reject;
    });
  } catch (error) {
    console.error('Erreur initialisation Google Sign-In :', error);
    _showLoginOverlay();
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// Configuration Google Sign-In
// ─────────────────────────────────────────────────────────

function _setupGoogleSignIn() {
  if (googleInitialized) {
    return;
  }

  const clientId = _getClientId();

  if (!clientId) {
    throw new Error('Client ID Google manquant.');
  }

  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services indisponible.');
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: _handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false,
    ux_mode: 'popup'
  });

  const buttonContainer = document.getElementById('googleSignInBtn');

  if (buttonContainer) {
    buttonContainer.replaceChildren();

    google.accounts.id.renderButton(buttonContainer, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280,
      locale: 'fr',
      ux_mode: 'popup'
    });
  }

  googleInitialized = true;

  try {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        console.info(
          'One Tap non disponible :',
          notification.getNotDisplayedReason?.() ||
          notification.getSkippedReason?.() ||
          'raison inconnue'
        );
      }
    });
  } catch (error) {
    console.info('One Tap non lancé.', error);
  }
}

function _getClientId() {
  return document.body?.dataset?.googleClientId || FALLBACK_CLIENT_ID;
}

function _waitForGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;

    const timer = setInterval(() => {
      attempts += 1;

      if (window.google?.accounts?.id) {
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

// ─────────────────────────────────────────────────────────
// Traitement de la réponse Google
// ─────────────────────────────────────────────────────────

function _handleCredentialResponse(response) {
  if (!response?.credential) {
    const error = new Error('Réponse Google invalide.');

    if (pendingAuthReject) {
      pendingAuthReject(error);
      pendingAuthReject = null;
      pendingAuthResolve = null;
    }

    return;
  }

  const decoded = _parseJwt(response.credential);

  if (!decoded?.sub) {
    const error = new Error('Token Google invalide.');

    if (pendingAuthReject) {
      pendingAuthReject(error);
      pendingAuthReject = null;
      pendingAuthResolve = null;
    }

    return;
  }

  currentUser = {
    id: decoded.sub,
    name: decoded.name || decoded.email || 'Utilisateur Google',
    email: decoded.email || '',
    picture: decoded.picture || '',
    token: response.credential,
    loginAt: Date.now()
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));

  _hideLoginOverlay();
  _updateUserUI(currentUser);

  if (pendingAuthResolve) {
    pendingAuthResolve(currentUser);
    pendingAuthResolve = null;
    pendingAuthReject = null;
  }
}

// ─────────────────────────────────────────────────────────
// Session locale
// ─────────────────────────────────────────────────────────

function _loadStoredUser() {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const user = JSON.parse(stored);

    if (!user?.token || !user?.id) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    const decoded = _parseJwt(user.token);

    if (!decoded?.sub || decoded.sub !== user.id) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    if (_isJwtExpired(decoded)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return {
      id: user.id,
      name: user.name || decoded.name || decoded.email || 'Utilisateur Google',
      email: user.email || decoded.email || '',
      picture: user.picture || decoded.picture || '',
      token: user.token,
      loginAt: user.loginAt || Date.now()
    };
  } catch (error) {
    console.warn('Session locale invalide.', error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function _isJwtExpired(decodedToken) {
  if (!decodedToken?.exp) {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return Number(decodedToken.exp) <= nowInSeconds;
}

// ─────────────────────────────────────────────────────────
// Déconnexion
// ─────────────────────────────────────────────────────────

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

  try {
    _setupGoogleSignIn();
  } catch (error) {
    console.warn('Impossible de réinitialiser le bouton Google.', error);
  }
}

// ─────────────────────────────────────────────────────────
// Accesseurs
// ─────────────────────────────────────────────────────────

/**
 * Retourne l'utilisateur connecté ou null.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Vrai si un utilisateur est connecté.
 */
export function isAuthenticated() {
  return currentUser !== null;
}

// ─────────────────────────────────────────────────────────
// UI, overlay de connexion
// ─────────────────────────────────────────────────────────

function _showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');

  if (!overlay) {
    return;
  }

  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';
}

function _hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');

  if (!overlay) {
    return;
  }

  overlay.setAttribute('hidden', '');
  overlay.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────
// UI, infos utilisateur dans le header
// ─────────────────────────────────────────────────────────

function _updateUserUI(user) {
  const userInfoBlock = document.getElementById('userInfoBlock');
  const userName = document.getElementById('userDisplayName');
  const userAvatar = document.getElementById('userAvatar');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!userInfoBlock) {
    return;
  }

  if (user) {
    if (userName) {
      userName.textContent = user.name || user.email || 'Utilisateur';
    }

    if (userAvatar) {
      userAvatar.src = user.picture || '';
      userAvatar.alt = `Avatar de ${user.name || user.email || 'utilisateur'}`;
    }

    userInfoBlock.removeAttribute('hidden');

    if (logoutBtn) {
      logoutBtn.removeAttribute('hidden');
    }
  } else {
    if (userName) {
      userName.textContent = '';
    }

    if (userAvatar) {
      userAvatar.removeAttribute('src');
      userAvatar.alt = 'Avatar utilisateur';
    }

    userInfoBlock.setAttribute('hidden', '');

    if (logoutBtn) {
      logoutBtn.setAttribute('hidden', '');
    }
  }
}

// ─────────────────────────────────────────────────────────
// Utilitaire JWT, décodage client uniquement
// ─────────────────────────────────────────────────────────

function _parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];

    if (!base64Url) {
      return {};
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((character) => {
          return '%' + ('00' + character.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );

    return JSON.parse(json);
  } catch (error) {
    console.warn('Impossible de décoder le JWT Google.', error);
    return {};
  }
}
