FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json turbo.json tsconfig.base.json ./
COPY prisma ./prisma
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/sim-engine/package.json packages/sim-engine/package.json
COPY packages/tool-adapters/package.json packages/tool-adapters/package.json

RUN npm install

COPY . .

RUN npm run db:generate

EXPOSE 4001
CMD ["npm", "run", "dev", "--workspace=@second-space/worker"]
