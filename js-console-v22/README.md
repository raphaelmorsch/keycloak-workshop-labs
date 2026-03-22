# Keycloak JS Console (v22)

A modern single-page application demonstrating the **Keycloak 22 JavaScript adapter** (`keycloak-js`).

## Features

- Login / Logout via Keycloak
- Silent SSO check (no full-page redirect on load)
- Inspect ID Token, Access Token, and Refresh Token (parsed JSON & raw)
- Force token refresh
- Real-time Keycloak lifecycle event log
- Automatic token refresh on expiry

## Prerequisites

- **Node.js** 18+
- **Keycloak 22** running (default: `http://localhost:8180`)

## Keycloak Setup

1. Create a realm called `demojs` (or adjust `public/keycloak.json`).
2. Create a client:
   - **Client ID**: `js-console`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `public`
   - **Valid Redirect URIs**: `http://localhost:8080/*`
   - **Web Origins**: `http://localhost:8080`
3. If your Keycloak is running on a different host/port, update `auth-server-url` in `public/keycloak.json`.

> **Note:** Starting from Keycloak 17+ (Quarkus distribution), the default context path
> no longer includes `/auth`. If you are using the legacy WildFly distribution or have
> configured the `/auth` prefix, update `auth-server-url` accordingly
> (e.g. `http://localhost:8180/auth`).

## Quick Start

```bash
npm install
npm run dev
```

The app will open at [http://localhost:8080](http://localhost:8080).

## Build for Production

```bash
npm run build
```

The output is in the `dist/` folder — serve it with any static file server.

## Key Differences from the Old `js-console`

| Aspect | Old (`js-console`) | New (`js-console-v22`) |
|---|---|---|
| Adapter source | `<script>` from Keycloak server | `keycloak-js` npm package (v22) |
| Promise API | `.success()` / `.error()` (removed) | Standard `.then()` / `.catch()` |
| Init mode | `login-required` (full redirect) | `check-sso` with silent iframe |
| UI framework | PatternFly 3 (vendored) | Modern vanilla CSS |
| Build tool | None (static HTML) | Vite |
| Token expiry | Manual refresh only | Auto-refresh via `onTokenExpired` |
