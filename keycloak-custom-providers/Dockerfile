## Stage 1: Build the provider JARs with Maven
FROM registry.access.redhat.com/ubi9/openjdk-17:latest AS builder

USER root
WORKDIR /build

COPY pom.xml .
COPY magic-link/pom.xml magic-link/
COPY themes/pom.xml themes/
COPY token-validation/pom.xml token-validation/

RUN mvn dependency:go-offline -B

COPY . .
RUN mvn clean package -DskipTests -B

## Stage 2: Build a custom Keycloak image with the providers
FROM registry.redhat.io/rhbk/keycloak-rhel9:22 AS keycloak

COPY --from=builder /build/magic-link/target/magic-link.jar /opt/keycloak/providers/
COPY --from=builder /build/themes/target/themes.jar /opt/keycloak/providers/
COPY --from=builder /build/token-validation/target/token-validation.jar /opt/keycloak/providers/

RUN /opt/keycloak/bin/kc.sh build

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
