# =====================================================================
# HealthNexus backend image. Multi-stage build; runs as NON-ROOT (D1 §9.6).
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
ENV ENABLE_DEV_AUTH=false
ENV ALLOW_DEV_CODES=false
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Drop privileges — never run the container as root.
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
