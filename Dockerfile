FROM node:22-slim AS app
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Dev dependencies are needed for the build (Vite, TypeScript), then removed.
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev
# SQLite database and uploaded product photos live here: mount a volume on /data.
ENV DB_PATH=/data/novashop.db UPLOAD_DIR=/data/uploads PORT=3001
VOLUME /data
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
