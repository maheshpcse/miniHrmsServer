FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --chown=node:node . .
RUN mkdir -p uploads && chown node:node uploads
ENV NODE_ENV=production HOST=0.0.0.0 DB_CLIENT=mysql2
USER node
CMD ["node", "index.js"]
