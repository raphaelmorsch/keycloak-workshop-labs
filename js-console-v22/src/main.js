import Keycloak from 'keycloak-js';

const keycloak = new Keycloak('./keycloak.json');

const events = [];
const MAX_EVENTS = 10;

// DOM references
const outputEl = document.getElementById('output');
const eventsEl = document.getElementById('events');
const profileSection = document.getElementById('profile-section');
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');

// --- Helpers ---

function showOutput(data) {
  if (typeof data === 'object' && data !== null) {
    outputEl.textContent = JSON.stringify(data, null, 2);
  } else {
    outputEl.textContent = String(data);
  }
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function logEvent(name, type = 'info') {
  events.push({ time: formatTime(new Date()), name, type });
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  renderEvents();
}

function renderEvents() {
  eventsEl.innerHTML = events
    .slice()
    .reverse()
    .map(
      (e) =>
        `<div class="event-entry">
          <span class="event-time">${e.time}</span>
          <span class="event-name ${e.type}">${e.name}</span>
        </div>`
    )
    .join('');
}

function updateProfile() {
  if (!keycloak.idTokenParsed) return;

  profileSection.style.display = '';

  const parsed = keycloak.idTokenParsed;

  if (parsed.picture || parsed.avatar_url) {
    profileAvatar.src = parsed.picture || parsed.avatar_url;
    profileAvatar.style.display = '';
  } else {
    profileAvatar.style.display = 'none';
  }

  profileName.textContent = parsed.name || parsed.preferred_username || 'Authenticated User';
  profileEmail.textContent = parsed.email || '';
}

// --- Keycloak lifecycle events ---

keycloak.onReady = (authenticated) => {
  logEvent(`onReady (authenticated=${authenticated})`, authenticated ? 'success' : 'info');
};

keycloak.onAuthSuccess = () => {
  logEvent('onAuthSuccess', 'success');
};

keycloak.onAuthError = (errorData) => {
  logEvent(`onAuthError: ${JSON.stringify(errorData)}`, 'error');
};

keycloak.onAuthRefreshSuccess = () => {
  logEvent('onAuthRefreshSuccess', 'success');
  updateProfile();
};

keycloak.onAuthRefreshError = () => {
  logEvent('onAuthRefreshError', 'error');
};

keycloak.onAuthLogout = () => {
  logEvent('onAuthLogout', 'info');
  profileSection.style.display = 'none';
};

keycloak.onTokenExpired = () => {
  logEvent('onTokenExpired — refreshing…', 'info');
  keycloak.updateToken(30).catch(() => {
    logEvent('Failed to refresh token after expiry', 'error');
  });
};

// --- Initialize with full diagnostics ---

async function initKeycloak() {
  const config = await fetch('./keycloak.json').then((r) => r.json());
  const baseUrl = config['auth-server-url'].replace(/\/+$/, '');
  const realmUrl = `${baseUrl}/realms/${config.realm}`;

  const urlParams = new URLSearchParams(window.location.search);
  const isPostRedirect = urlParams.has('code') && urlParams.has('state');

  logEvent(`App origin: ${window.location.origin}`, 'info');
  logEvent(`Keycloak URL: ${realmUrl}`, 'info');

  if (isPostRedirect) {
    logEvent('Post-login redirect detected (code + state in URL)', 'info');
  }

  // Step 1: Can we reach the realm endpoint?
  let realmInfo;
  try {
    const resp = await fetch(realmUrl);
    if (!resp.ok) {
      logEvent(`Discovery FAILED: HTTP ${resp.status}`, 'error');
      showOutput(
        `Keycloak realm endpoint returned HTTP ${resp.status}.\n\n`
        + `URL: ${realmUrl}\n\n`
        + `Possible fixes:\n`
        + `  1. Realm "${config.realm}" might not exist — create it in the admin console\n`
        + `  2. URL may need /auth prefix — try: ${baseUrl}/auth/realms/${config.realm}\n`
        + `  3. Keycloak server might be down`
      );
      return;
    }
    realmInfo = await resp.json();
    logEvent(`Discovery OK: realm "${realmInfo.realm}"`, 'success');
  } catch (e) {
    logEvent(`Discovery BLOCKED (CORS or network)`, 'error');
    showOutput(
      `Cannot reach Keycloak from the browser.\n\n`
      + `URL tried: ${realmUrl}\n`
      + `Error: ${e.message}\n\n`
      + `FIX: In Keycloak Admin Console:\n`
      + `  → Clients → "${config.resource}" → Settings\n`
      + `  → "Web Origins" field → add:  ${window.location.origin}\n`
      + `     (or use  +  to allow all valid redirect URIs)\n\n`
      + `Also check "Valid Redirect URIs" includes:\n`
      + `  ${window.location.origin}/*`
    );
    return;
  }

  // Step 2: If we're post-redirect, check the token endpoint is reachable
  if (isPostRedirect && realmInfo['token-endpoint']) {
    const tokenUrl = realmInfo['token-endpoint'];
    logEvent(`Token endpoint: ${tokenUrl}`, 'info');
    try {
      const probe = await fetch(tokenUrl, { method: 'POST', body: 'grant_type=probe' });
      logEvent(`Token endpoint reachable (HTTP ${probe.status})`, 'success');
    } catch (e) {
      logEvent(`Token endpoint BLOCKED by CORS!`, 'error');
      showOutput(
        `Keycloak login succeeded but the token exchange is blocked by CORS.\n\n`
        + `Token endpoint: ${tokenUrl}\n`
        + `App origin: ${window.location.origin}\n\n`
        + `FIX: In Keycloak Admin Console:\n`
        + `  → Clients → "${config.resource}" → Settings\n`
        + `  → "Web Origins" field → add:  ${window.location.origin}\n`
        + `     (or use  +  to allow all valid redirect URIs)\n\n`
        + `  → Save → try again`
      );
      return;
    }
  }

  // Step 3: Initialize the adapter
  logEvent('Calling keycloak.init()...', 'info');
  try {
    const authenticated = await keycloak.init({ onLoad: 'login-required' });
    if (authenticated) {
      updateProfile();
      logEvent('Initialized — user is authenticated', 'success');
    } else {
      logEvent('Initialized — user is NOT authenticated', 'info');
    }
  } catch (err) {
    let hint = '';
    if (isPostRedirect) {
      hint = '\n\nYou were redirected back from Keycloak with an auth code, '
        + 'but the token exchange failed.\n\n'
        + `Check the browser DevTools Console (F12) for CORS or network errors.\n\n`
        + `Also verify in Keycloak Admin:\n`
        + `  → Clients → "${config.resource}"\n`
        + `  → "Web Origins" includes: ${window.location.origin}  (or  + )\n`
        + `  → "Valid Redirect URIs" includes: ${window.location.origin}/*`;
    }
    logEvent(`Init FAILED: ${err || 'undefined (no error details from adapter)'}`, 'error');
    showOutput(`Keycloak init failed.\n\nError: ${err || 'undefined'}${hint}`);
    console.error('Keycloak init failed', err);
  }
}

initKeycloak();

// --- Button handlers ---

document.getElementById('btn-login').addEventListener('click', () => {
  keycloak.login();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  keycloak.logout();
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  keycloak
    .updateToken(-1)
    .then((refreshed) => {
      if (refreshed) {
        logEvent('Token refreshed successfully', 'success');
      } else {
        logEvent('Token still valid, no refresh needed', 'info');
      }
    })
    .catch(() => {
      logEvent('Failed to refresh token', 'error');
    });
});

document.getElementById('btn-id-token-parsed').addEventListener('click', () => {
  showOutput(keycloak.idTokenParsed || 'No ID token available');
});

document.getElementById('btn-access-token-parsed').addEventListener('click', () => {
  showOutput(keycloak.tokenParsed || 'No access token available');
});

document.getElementById('btn-id-token').addEventListener('click', () => {
  showOutput(keycloak.idToken || 'No ID token available');
});

document.getElementById('btn-access-token').addEventListener('click', () => {
  showOutput(keycloak.token || 'No access token available');
});

document.getElementById('btn-refresh-token').addEventListener('click', () => {
  showOutput(keycloak.refreshToken || 'No refresh token available');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  outputEl.innerHTML = '<p class="text-muted">Click an action above to inspect tokens…</p>';
});
