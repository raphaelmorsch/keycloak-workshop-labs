package org.keycloak.experimental.token;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.FormParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.keycloak.TokenVerifier;
import org.keycloak.common.VerificationException;
import org.keycloak.crypto.SignatureVerifierContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.representations.AccessToken;
import org.keycloak.util.JsonSerialization;

import java.io.IOException;
import java.util.Base64;

public class TokenResource {

    private final KeycloakSession session;

    public TokenResource(KeycloakSession session) {
        this.session = session;
    }

    @GET
    @Produces(MediaType.TEXT_HTML)
    public Response getForm() {
        return Response.ok(buildHtml(null, null, null, null)).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Produces(MediaType.TEXT_HTML)
    public Response validateToken(@FormParam("token") String token) {
        if (token == null || token.isBlank()) {
            return Response.ok(buildHtml("Please paste a token.", null, null, "error")).build();
        }

        token = token.trim();

        try {
            RealmModel realm = session.getContext().getRealm();

            TokenVerifier<AccessToken> verifier = TokenVerifier.create(token, AccessToken.class)
                    .withDefaultChecks()
                    .realmUrl(getRealmUrl(realm));

            String kid = verifier.getHeader().getKeyId();
            SignatureVerifierContext signatureContext = session.getProvider(
                    org.keycloak.crypto.SignatureProvider.class,
                    verifier.getHeader().getAlgorithm().name()
            ).verifier(kid);
            verifier.verifierContext(signatureContext);

            verifier.verify();
            AccessToken accessToken = verifier.getToken();

            String headerJson = prettyPrint(decodeJwtPart(token, 0));
            String payloadJson = prettyPrint(decodeJwtPart(token, 1));

            String details = "Subject: " + accessToken.getSubject() + "\n"
                    + "Issued for: " + accessToken.getIssuedFor() + "\n"
                    + "Type: " + accessToken.getType() + "\n"
                    + "Key ID: " + kid + "\n\n"
                    + "--- HEADER ---\n" + headerJson + "\n\n"
                    + "--- PAYLOAD ---\n" + payloadJson;

            return Response.ok(buildHtml("Token is VALID", token, details, "success")).build();

        } catch (VerificationException e) {
            String payloadJson;
            try {
                payloadJson = prettyPrint(decodeJwtPart(token, 1));
            } catch (Exception ignored) {
                payloadJson = "(unable to decode payload)";
            }

            String details = "Error: " + e.getMessage() + "\n\n--- PAYLOAD ---\n" + payloadJson;
            return Response.ok(buildHtml("Token is INVALID", token, details, "error")).build();

        } catch (Exception e) {
            return Response.ok(buildHtml("Error processing token: " + e.getMessage(), token, null, "error")).build();
        }
    }

    private String getRealmUrl(RealmModel realm) {
        return session.getContext().getUri().getBaseUri() + "realms/" + realm.getName();
    }

    private String decodeJwtPart(String jwt, int part) {
        String[] parts = jwt.split("\\.");
        if (parts.length < 2 || part >= parts.length) return "{}";
        return new String(Base64.getUrlDecoder().decode(parts[part]));
    }

    private String prettyPrint(String json) {
        try {
            Object obj = JsonSerialization.readValue(json, Object.class);
            return JsonSerialization.writeValueAsPrettyString(obj);
        } catch (IOException e) {
            return json;
        }
    }

    private String buildHtml(String message, String tokenValue, String details, String status) {
        String statusColor = "success".equals(status) ? "#2e7d32" : "error".equals(status) ? "#c62828" : "#333";
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>JWT Token Validator</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f5f7; padding: 2rem; }
                        .container { max-width: 800px; margin: 0 auto; }
                        h1 { color: #151515; margin-bottom: 1.5rem; }
                        form { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 1.5rem; }
                        label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
                        textarea { width: 100%%; padding: 0.75rem; border: 1px solid #d2d2d2; border-radius: 4px; font-family: monospace; font-size: 0.85rem; resize: vertical; }
                        button { margin-top: 1rem; padding: 0.6rem 1.5rem; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
                        button:hover { background: #004d99; }
                        .result { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
                        .result h2 { color: %s; margin-bottom: 1rem; }
                        pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem; border-radius: 4px; overflow: auto; font-size: 0.8rem; white-space: pre-wrap; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>JWT Token Validator</h1>
                        <form method="post">
                            <label for="token">Paste a JWT token:</label>
                            <textarea id="token" name="token" rows="6" placeholder="eyJhbGciOiJSUzI1NiIs...">%s</textarea>
                            <button type="submit">Validate Token</button>
                        </form>
                        %s
                    </div>
                </body>
                </html>
                """.formatted(
                statusColor,
                tokenValue != null ? escapeHtml(tokenValue) : "",
                message != null ? "<div class=\"result\"><h2>" + escapeHtml(message) + "</h2>"
                        + (details != null ? "<pre>" + escapeHtml(details) + "</pre>" : "")
                        + "</div>" : ""
        );
    }

    private String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
