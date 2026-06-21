# syntax=docker/dockerfile:1.6
# Imagem do `web` (Next 14 + custom server com Socket.IO em server.js).
#
# NOTA (importante): NÃO usamos `output: standalone`. Standalone só inclui o que o Next
# traça — e o `socket.io` é usado pelo server.js (custom server), fora do grafo do Next,
# então ficaria de fora e a imagem subiria quebrada. Por isso carregamos as deps de fato.
# Debian slim (não alpine) p/ evitar dores com binários nativos (sharp, three, etc.).

# ───────────────────────── Stage 1: builder ─────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# DATABASE_URL placeholder: só p/ o `prisma generate` não reclamar durante o build.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="mongodb://placeholder:27017/build"

# openssl/ca-certificates: o Prisma precisa pra gerar/rodar o engine no Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# npm install (não `npm ci`): resolve sem exigir o lock 100% sincronizado e tolera
# conflitos de peer (wagmi/aptos/web3 no mesmo projeto). Para beta é o caminho confiável.
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npx --yes prisma generate && npm run build

# ───────────────────────── Stage 2: runtime ─────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN useradd --create-home --uid 10001 zaeon
# Copia o app já buildado + node_modules (inclui socket.io e o client Prisma gerado)
COPY --from=builder /app ./
USER zaeon

EXPOSE 3000
# start do package.json: NODE_ENV=production node server.js
CMD ["node", "server.js"]
