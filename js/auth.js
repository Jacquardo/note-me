// js/auth.js

// ─────────────────────────────────────────────────────────
// Authentification Google avec Google Identity Services
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
    await waitForGoogleIdentityServices();

    setupGoogleSignIn();

    const storedUser = loadStoredUser();

    if (storedUser) {
      currentUser = storedUser;

      hideLoginOverlay();
      updateUserUI(currentUser);
      setAppAccessibilityState(true);

      window.dispatchEvent(
        new CustomEvent('notes-me-authenticated', {
          detail: currentUser
        })
      );

      return currentUser;
    }

    showLoginOverlay();
    setAppAccessibilityState(false);

    return new Promise((resolve, reject) => {
      pendingAuthResolve = resolve;
      pendingAuthReject = reject;
    });
  } catch (error) {
    console.error('Erreur initialisation Google Sign-In :', error);

    showLoginOverlay();
    setAppAccessibilityState(false);

    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// Configuration Google Sign-In
// ─────────────────────────────────────────────────────────

function setupGoogleSignIn() {
  if (googleInitialized) {
    renderGoogleButton();
    return;
  }

  const clientId = getClientId();

  if (!clientId) {
    throw new Error('Client ID Google manquant.');
  }

  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services indisponible.');
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false,
    ux_mode: 'popup'
  });

  googleInitialized = true;

  renderGoogleButton();
  promptOneTap();
}

function renderGoogleButton() {
  const buttonContainer = document.getElementById('googleSignInBtn');

  if (!buttonContainer) {
    return;
  }

  buttonContainer.replaceChildren();

  try {
    google.accounts.id.renderButton(buttonContainer, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: Math.min(280, Math.max(220, buttonContainer.clientWidth || 280)),
      locale: 'fr',
      ux_mode: 'popup'
    });

    window.setTimeout(() => {
      const hasContent = buttonContainer.children.length > 0;

      if (!hasContent) {
        showGoogleButtonFallback(buttonContainer);
      }
    }, 1500);
  } catch (error) {
    console.error('Impossible de rendre le bouton Google :', error);
    showGoogleButtonFallback(buttonContainer);
  }
}

function showGoogleButtonFallback(container) {
  container.replaceChildren();

  const message = document.createElement('p');
  message.className = 'google-signin-fallback';
  message.textContent = 'Connexion Google indisponible. Ouvrez cette page dans Chrome et vérifiez que JavaScript est autorisé.';

  container.appendChild(message);
}

function promptOneTap() {
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

function getClientId() {
  return document.body?.dataset?.googleClientId || FALLBACK_CLIENT_ID;
}

function waitForGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(timer);
        reject(new Error('Google Identity Services non chargé.'));
      }
    }, 100);
  });
}

// ─────────────────────────────────────────────────────────
// Traitement de la réponse Google
// ─────────────────────────────────────────────────────────

function handleCredentialResponse(response) {
  if (!response?.credential) {
    rejectPendingAuth(new Error('Réponse Google invalide.'));
    return;
  }

  const decoded = parseJwt(response.credential);

  if (!decoded?.sub) {
    rejectPendingAuth(new Error('Token Google invalide.'));
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

  saveStoredUser(currentUser);

  hideLoginOverlay();
  updateUserUI(currentUser);
  setAppAccessibilityState(true);

  window.dispatchEvent(
    new CustomEvent('notes-me-authenticated', {
      detail: currentUser
    })
  );

  if (pendingAuthResolve) {
    pendingAuthResolve(currentUser);
    pendingAuthResolve = null;
    pendingAuthReject = null;
  }
}

function rejectPendingAuth(error) {
  if (pendingAuthReject) {
    pendingAuthReject(error);
    pendingAuthReject = null;
    pendingAuthResolve = null;
  }

  console.error(error);
}

// ─────────────────────────────────────────────────────────
// Session locale
// ─────────────────────────────────────────────────────────

function saveStoredUser(user) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Impossible de sauvegarder la session utilisateur.', error);
  }
}

function loadStoredUser() {
  let stored = null;

  try {
    stored = localStorage.getItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.warn('Impossible de lire la session utilisateur.', error);
    return null;
  }

  if (!stored) {
    return null;
  }

  try {
    const user = JSON.parse(stored);

    if (!user?.token || !user?.id) {
      removeStoredUser();
      return null;
    }

    const decoded = parseJwt(user.token);

    if (!decoded?.sub || decoded.sub !== user.id) {
      removeStoredUser();
      return null;
    }

    if (isJwtExpired(decoded)) {
      removeStoredUser();
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
    removeStoredUser();
    return null;
  }
}

function removeStoredUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.warn('Impossible de supprimer la session utilisateur.', error);
  }
}

function isJwtExpired(decodedToken) {
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
  removeStoredUser();

  updateUserUI(null);
  showLoginOverlay();
  setAppAccessibilityState(false);

  window.dispatchEvent(new CustomEvent('notes-me-signed-out'));

  try {
    renderGoogleButton();
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

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');

  if (!overlay) {
    return;
  }

  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');

  if (!overlay) {
    return;
  }

  overlay.setAttribute('hidden', '');
  overlay.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = '';
}

function setAppAccessibilityState(isAuthenticated) {
  const app = document.getElementById('app');

  if (!app) {
    return;
  }

  if (isAuthenticated) {
    app.removeAttribute('aria-hidden');
  } else {
    app.setAttribute('aria-hidden', 'true');
  }
}

// ─────────────────────────────────────────────────────────
// UI, infos utilisateur dans le header
// ─────────────────────────────────────────────────────────

function updateUserUI(user) {
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

    return;
  }

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

// ─────────────────────────────────────────────────────────
// Utilitaire JWT, décodage client uniquement
// ─────────────────────────────────────────────────────────

function parseJwt(token) {
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
