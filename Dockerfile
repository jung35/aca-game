# ── Dev stage ────────────────────────────────────────────────────────────────
# Runs `vite --host` so the dev server is reachable from outside the container.
# Mount the project root as a volume so hot-reload works on every file save.
#
# Usage:
#   docker build -t aca-game-dev .
#   docker run --rm -it -p 5173:5173 -v $(pwd):/app aca-game-dev
#
# Or just:
#   docker compose up

FROM node:22-bullseye-slim

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
  git curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
# Copy manifests first so Docker can cache this layer between rebuilds.
COPY package.json package-lock.json* ./
RUN npm install

# ── Copy source ───────────────────────────────────────────────────────────────
# When developing with -v $(pwd):/app this layer is overwritten by the mount,
# but it lets the image work standalone (e.g. CI preview) without a volume.
COPY . .

# Vite dev server port
EXPOSE 5173

# --host   → bind to 0.0.0.0 so the port is reachable from the host / WSL2
# --port   → explicit so it never auto-increments to an unexpected port
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
