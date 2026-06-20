# GYF web — dev image (Next.js dev server via Bun workspaces).
#
# Goal: the host stays disposable. JS deps install inside the image / a named volume —
# never on the host — so the working tree can be deleted and rebuilt from git. Source is
# bind-mounted at run time for hot reload; node_modules is a container-only volume because
# the host (darwin) and container (linux) resolve different native binaries.
#
# Build context is the repo root: app is a Bun workspace that depends on packages/*.
# Pin to the host's Bun major (1.3) so bun.lock's text lockfile format parses identically.
FROM oven/bun:1.3

WORKDIR /repo

# Manifests first so the install layer caches across source edits.
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY app/package.json ./app/package.json
COPY packages ./packages

RUN bun install --frozen-lockfile

# Source is COPYed for standalone runs and overlaid by a bind mount in dev compose.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["bun", "run", "--filter", "@gyf/web", "dev"]
