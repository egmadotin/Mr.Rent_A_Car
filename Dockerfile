# Production image: installs the workspace, generates Prisma, builds the Next.js app and serves it with `next start`.
# Used by docker-compose.prod.yml (see deploy/README.md).
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CI=true

# dependencies first (cached unless a package.json or the lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm db:generate
# the build needs a DATABASE_URL to exist; it doesn't connect
RUN cd apps/web && DATABASE_URL=postgresql://build:build@localhost:5432/build npx next build --no-lint

ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
EXPOSE 3000
# apply new migrations, then serve
CMD ["sh", "-c", "pnpm db:migrate && cd apps/web && npx next start -p 3000"]
