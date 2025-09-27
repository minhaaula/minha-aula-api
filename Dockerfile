ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable


# --- Dev image
FROM base AS dev
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm i || true
COPY . .
EXPOSE 3000
CMD ["npm","run","start:dev"]


# --- Build image
FROM base AS build
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci || npm i --frozen-lockfile=false
COPY tsconfig*.json ./
COPY src ./src
COPY docs ./docs
RUN npm run build


# --- Prod runtime
FROM node:${NODE_VERSION}-bookworm AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs ./docs
EXPOSE 3000
CMD ["node","dist/main.js"]
