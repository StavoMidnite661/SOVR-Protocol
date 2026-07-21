# SOVR Protocol API — production Dockerfile
# Build context: repo root.

FROM node:20-alpine AS deps
WORKDIR /app
# Install only what's needed to build the runtime
COPY packages/runtime/package.json packages/runtime/package-lock.json ./packages/runtime/
COPY packages/compiler/package.json packages/compiler/package-lock.json ./packages/compiler/
RUN cd packages/runtime && npm ci --omit=dev
RUN cd packages/compiler && npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY packages/runtime/package.json packages/runtime/package-lock.json ./packages/runtime/
COPY packages/compiler/package.json packages/compiler/package-lock.json ./packages/compiler/
RUN cd packages/runtime && npm ci
RUN cd packages/compiler && npm ci
COPY packages/ ./packages/
COPY 00_protocol-manifest.yaml 01_constitution.yaml 02_domain-model.yaml \
    03_command-catalog.yaml 04_event-catalog.yaml 05_state-machines.yaml \
    08_security-capabilities.yaml 09_saga-orchestration.yaml \
    11_governance-amendments.yaml 12_domain-contracts.yaml 13_compiler-adr.yaml \
    acceptance-tests.yaml compiler.yaml hybrid-boundary.yaml projection-engine.yaml \
    ./
COPY domains/ ./domains/
COPY protocol/ ./protocol/
RUN cd packages/runtime && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/packages/runtime/node_modules ./packages/runtime/node_modules
COPY --from=build /app/packages/runtime/dist ./packages/runtime/dist
COPY --from=build /app/packages/runtime/package.json ./packages/runtime/package.json
COPY --from=build /app/packages/runtime/src ./packages/runtime/src
COPY --from=build /app/00_protocol-manifest.yaml /app/01_constitution.yaml \
    /app/02_domain-model.yaml /app/03_command-catalog.yaml /app/04_event-catalog.yaml \
    /app/05_state-machines.yaml /app/08_security-capabilities.yaml /app/09_saga-orchestration.yaml \
    /app/11_governance-amendments.yaml /app/12_domain-contracts.yaml /app/13_compiler-adr.yaml \
    /app/acceptance-tests.yaml /app/compiler.yaml /app/hybrid-boundary.yaml /app/projection-engine.yaml ./
COPY --from=build /app/domains ./domains
COPY --from=build /app/protocol ./protocol
EXPOSE 3001
USER node
CMD ["node", "packages/runtime/dist/server/index.js"]
