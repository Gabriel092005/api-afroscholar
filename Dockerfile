# ===== BUILD =====
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# O prisma.config.ts exige DATABASE_URL durante o `prisma generate` (apenas gera código, não conecta).
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# O .dockerignore exclui .env, .env.dev, node_modules, uploads, logs, etc.
COPY . .

# O "postbuild" copia o motor do Prisma (query engine .node) para dentro de build/
RUN npm run build

# ===== PRODUÇÃO =====
FROM node:20-alpine AS production

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/usr/src/app/uploads

COPY --from=build /usr/src/app/build ./build
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/package-lock.json ./package-lock.json
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts

# @prisma/client e prisma são dependencies (o generated bundlado usa @prisma/client/runtime/library)
RUN npm ci --omit=dev --ignore-scripts

RUN mkdir -p $UPLOAD_DIR

EXPOSE 3333

CMD ["node", "build/server.js"]