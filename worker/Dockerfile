# Creator video worker.
#
# Runs outside Vercel (long-running, needs FFmpeg). Deploy this image to a
# container host such as Railway, Fly.io, or Render. See worker/README.md.

FROM node:22-bookworm-slim

# FFmpeg + FFprobe for media probing and proxy generation.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies against the lockfile for reproducible builds.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Build TypeScript.
COPY tsconfig.json ./
COPY src ./src
RUN npm install --no-audit --no-fund typescript@6.0.2 @types/node \
  && ./node_modules/.bin/tsc \
  && npm prune --omit=dev

ENV NODE_ENV=production

# No inbound ports — the worker polls the database and exits on SIGTERM.
CMD ["node", "dist/index.js"]
