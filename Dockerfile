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

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]