# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy lock files dahulu (layer cache)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev --no-audit --no-fund && \
    npx prisma generate

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install dumb-init untuk proper signal handling di container
RUN apk add --no-cache dumb-init

WORKDIR /app

# Jalankan sebagai non-root user (keamanan)
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

# Copy hasil build dari stage deps
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy source code
COPY --chown=nodejs:nodejs prisma   ./prisma
COPY --chown=nodejs:nodejs src      ./src
COPY --chown=nodejs:nodejs package*.json ./

# Buat direktori yang dibutuhkan runtime
RUN mkdir -p uploads/books uploads/skripsi uploads/avatar logs && \
    chown -R nodejs:nodejs uploads logs

USER nodejs

EXPOSE 5000

# Health check built-in
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# dumb-init memastikan SIGTERM diteruskan ke Node.js dengan benar
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
