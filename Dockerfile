# ── Dev stage ────────────────────────────────────────────────────────────────
# Runs the Vite dev server inside Docker with full HMR / hot-reload support.
# The server binds to 0.0.0.0:5173 (configured in vite.config.ts) so it is
# reachable from your host browser at http://localhost:5173.
#
# Quick start:
#   docker compose up          – start (or restart) the dev server
#   docker compose up --build  – rebuild the image after changing package.json
#
# Manual usage (without Compose):
#   docker build -t aca-game-dev .
#   docker run --rm -it -p 5173:5173 -v "$(pwd)":/app aca-game-dev

FROM node:22-bullseye-slim

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates gpg \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
# Copy manifests first so Docker can cache this layer between code-only rebuilds.
COPY package.json package-lock.json* ./
# `npm ci` is faster and stricter than `npm install` — it respects the lockfile exactly.
RUN npm ci

# ── Copy source ───────────────────────────────────────────────────────────────
# When developing with -v $(pwd):/app the bind-mount overwrites this layer,
# giving you live HMR without rebuilding the image on every source change.
# The COPY is kept so the image also works standalone (e.g. CI preview).
COPY . .

# Vite dev server port (matches server.port in vite.config.ts)
EXPOSE 5173

# Host / port / polling are all configured in vite.config.ts — no flags needed here.
CMD ["npx", "vite"]
