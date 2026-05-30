# GrillMyCode Action — Container Image
#
# Builds the runtime environment for the GrillMyCode GitHub Action.
#
# Stages / layers (in order):
#   1. Base image    — node:26-slim (Debian-based, minimal footprint)
#   2. System deps   — git (repository operations), curl + ca-certificates
#                      (downloading the rmcm binary), corepack/pnpm (package
#                      manager used by this project), and the rmcm binary itself
#                      (strips comments from source files before AI review).
#   3. Dependencies  — Production-only Node dependencies installed via pnpm
#                      with a frozen lockfile so the image is fully reproducible.
#   4. Source code   — The action's src/ directory and the entrypoint shell
#                      script are copied in and made executable.
#
# The container is invoked by GitHub Actions via the ENTRYPOINT defined in
# action.yml, which calls /entrypoint.sh → node src/main.js.

FROM node:26-slim

# Install git, corepack, pnpm, and the rmcm binary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL \
        "https://github.com/NSCC-ITC-Assessment/comment-remover/releases/download/grill-my-code/rmcm-linux-x86_64" \
        -o /usr/local/bin/rmcm \
    && chmod +x /usr/local/bin/rmcm \
    && npm install -g corepack \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# Copy package files and install production dependencies
WORKDIR /action
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Fetch and bundle gitignore templates so stack-detection has them at runtime.
# This re-fetches every template from github/gitignore to ensure the image
# ships with up-to-date patterns, even if the committed JSON is stale.
COPY scripts/ ./scripts/
RUN --mount=type=secret,id=GITHUB_TOKEN,env=GITHUB_TOKEN \
    node scripts/fetch-gitignore-templates.js

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]