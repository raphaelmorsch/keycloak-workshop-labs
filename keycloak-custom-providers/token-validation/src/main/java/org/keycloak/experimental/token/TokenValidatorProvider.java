package org.keycloak.experimental.token;

import org.keycloak.models.KeycloakSession;
import org.keycloak.services.resource.RealmResourceProvider;

public class TokenValidatorProvider implements RealmResourceProvider {

    private final KeycloakSession session;

    public TokenValidatorProvider(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public Object getResource() {
        return new TokenResource(session);
    }

    @Override
    public void close() {
    }
}
