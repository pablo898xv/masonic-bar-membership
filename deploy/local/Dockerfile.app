# syntax=docker/dockerfile:1
# Firebase Hosting + frameworksBackend stand-in: production Next.js (standalone).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-masonic-bar
ENV NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-masonic-bar.firebaseapp.com
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-masonic-bar.appspot.com
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0
ENV NEXT_PUBLIC_FIREBASE_APP_ID=1:0:web:demo
ARG NEXT_PUBLIC_BASE_URL=https://membership.ashlartechnologies.com
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/wallet-assets ./src/lib/wallet-assets

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
