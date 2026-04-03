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

// --- Initialize ---

keycloak
  .init({ onLoad: 'login-required' })
  .then((authenticated) => {
    if (authenticated) {
      updateProfile();
      logEvent('Initialized — user is authenticated', 'success');
    } else {
      logEvent('Initialized — user is NOT authenticated', 'info');
    }
  })
  .catch((err) => {
    logEvent(`Init error: ${err}`, 'error');
    console.error('Keycloak init failed', err);
  });

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
