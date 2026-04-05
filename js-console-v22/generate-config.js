const fs = require('fs');
const path = require('path');

const distConfig = path.join(__dirname, 'dist', 'keycloak.json');
const mountedConfig = process.env.KC_CONFIG_PATH || '/config/keycloak.json';

if (fs.existsSync(mountedConfig)) {
  console.log(`[config] Using mounted ConfigMap: ${mountedConfig}`);
  const content = fs.readFileSync(mountedConfig, 'utf8');
  fs.writeFileSync(distConfig, content);
} else if (process.env.KC_AUTH_URL && process.env.KC_REALM && process.env.KC_CLIENT_ID) {
  const config = {
    realm: process.env.KC_REALM,
    'auth-server-url': process.env.KC_AUTH_URL,
    'ssl-required': process.env.KC_SSL_REQUIRED || 'external',
    resource: process.env.KC_CLIENT_ID,
    'public-client': true,
  };
  console.log(`[config] Generating keycloak.json from environment variables:`);
  console.log(`         realm       = ${config.realm}`);
  console.log(`         auth-url    = ${config['auth-server-url']}`);
  console.log(`         client-id   = ${config.resource}`);
  fs.writeFileSync(distConfig, JSON.stringify(config, null, 2) + '\n');
} else {
  console.log(`[config] No env vars or ConfigMap found — using built-in keycloak.json`);
}
