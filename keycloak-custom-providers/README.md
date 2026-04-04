# Keycloak Custom Providers (KC 22 / Quarkus / RHBK)

Custom SPIs migrated from the old JBoss-based Keycloak 4.x to **Keycloak 22** (Quarkus distribution).

## What's Included

### 1. Magic Link Authenticator (`magic-link`)
Passwordless authentication — user enters email, receives a magic link, clicks it to sign in.
- **Provider ID:** `magic-form`
- **Type:** Authentication SPI (`AuthenticatorFactory`)

### 2. Sunrise Login Theme (`themes`)
Custom login theme extending the default `keycloak` theme with a warm gradient background and custom button styles.
- **Theme name:** `sunrise`
- **Type:** Login theme

### 3. JWT Token Validator (`token-validation`)
A realm REST resource that provides a web UI to paste and validate JWT tokens against the realm's signing keys.
- **Provider ID:** `jwt`
- **Type:** Realm Resource Provider
- **URL:** `https://<keycloak>/realms/<realm>/jwt`

## Key Changes from the Old (JBoss) Version

| Aspect | Old (KC 4.x / JBoss) | New (KC 22 / Quarkus) |
|---|---|---|
| Java version | 8 | 17 |
| JAX-RS namespace | `javax.ws.rs` | `jakarta.ws.rs` |
| Deployment | `jboss-deployment-structure.xml` + WildFly deployments | JARs in `/opt/keycloak/providers/` + `kc.sh build` |
| User API | `getUserByEmail(email, realm)` | `getUserByEmail(realm, email)` |
| Theme parent | `base` + Bootstrap 2 | `keycloak` + custom CSS |
| Build image | `redhat-sso73-openshift:1.0` | `quay.io/keycloak/keycloak:22.0` |

## Prerequisites

- **Java 17** and **Maven 3.8+**
- **Podman** or **Docker** for building the container image
- **oc** CLI logged into your OpenShift cluster

## Build Locally (verify compilation)

```bash
cd keycloak-custom-providers
mvn clean package -DskipTests
```

This produces three JARs:
- `magic-link/target/magic-link.jar`
- `themes/target/themes.jar`
- `token-validation/target/token-validation.jar`

## Deploy to OpenShift

### Step 1: Create a BuildConfig (Docker strategy)

```bash
oc new-build --name custom-keycloak \
  --binary \
  --strategy docker \
  -n <your-namespace>
```

### Step 2: Start the build

From the `keycloak-custom-providers/` directory:

```bash
oc start-build custom-keycloak --from-dir . --follow -n <your-namespace>
```

This will:
1. Upload the source to OpenShift
2. Run the multi-stage Dockerfile (Maven build → Keycloak image with providers)
3. Push the resulting image to the internal registry as `custom-keycloak:latest`

### Step 3: Deploy the custom Keycloak

```bash
oc new-app custom-keycloak:latest \
  -n <your-namespace> \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HOSTNAME_STRICT=false \
  -e KC_PROXY=edge \
  --name=custom-keycloak

oc expose svc/custom-keycloak --port=8080 -n <your-namespace>
```

> **Note:** For production, set proper admin credentials and configure
> `KC_HOSTNAME`, `KC_DB`, etc. See the
> [Keycloak Server Configuration](https://www.keycloak.org/server/all-config) docs.

### Step 4: Override the start command (if needed)

The Dockerfile `ENTRYPOINT` is `kc.sh`. By default OpenShift will run the
container without arguments, so you need a Deployment patch to pass `start`:

```bash
oc set env deploy/custom-keycloak JAVA_OPTS_APPEND="-Djgroups.dns.query=custom-keycloak"

oc patch deploy/custom-keycloak --type=json -p='[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": ["start-dev"]}
]'
```

Use `start` (with `KC_HOSTNAME`, TLS, and a database) for production, or
`start-dev` for workshop/development purposes.

### Alternative: Use the RHBK Image

If you have access to the Red Hat registry, replace the base image in the
Dockerfile:

```dockerfile
# Instead of:
FROM quay.io/keycloak/keycloak:22.0 AS keycloak

# Use RHBK:
FROM registry.redhat.io/rhbk/keycloak-rhel9:22 AS keycloak
```

Then create a pull secret and link it to the builder:

```bash
oc create secret docker-registry rhregistry \
  --docker-server=registry.redhat.io \
  --docker-username=<user> \
  --docker-password=<password>

oc secrets link builder rhregistry
```

## Using the Providers

### Magic Link Authenticator

1. Go to **Authentication** in the admin console
2. Duplicate the **browser** flow
3. Add an execution → choose **Magic Link**
4. Set it as **Required** (and remove/disable the default Username Password Form)
5. Bind the new flow to the **Browser flow** in the realm settings

### Sunrise Theme

1. Go to **Realm Settings → Themes**
2. Set **Login theme** to **sunrise**

### JWT Token Validator

Navigate to:

```
https://<keycloak-host>/realms/<realm-name>/jwt
```

Paste any access token or ID token obtained from this realm and click
**Validate Token** to see whether it is valid and inspect its contents.
