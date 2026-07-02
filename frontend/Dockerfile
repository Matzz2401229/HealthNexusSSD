# =====================================================================
# HealthNexus frontend image. Builds the React PWA, serves it on 3000.
# Runs as NON-ROOT.
# =====================================================================
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# `dist` is static; `serve` hosts the built PWA. nginx sits in front for TLS.
CMD ["serve", "-s", "dist", "-l", "3000"]
