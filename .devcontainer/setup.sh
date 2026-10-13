#!/usr/bin/env bash
# Runs once when the codespace is created.
set -euo pipefail

echo "==> Installing pnpm"
npm install -g pnpm@10.28.0

echo "==> Creating apps/web/.env from .env.example"
if [ ! -f apps/web/.env ]; then
  cp .env.example apps/web/.env
fi
# In Codespaces the site is reached through a forwarded https address, not localhost.
if [ -n "${CODESPACE_NAME:-}" ]; then
  APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  sed -i "s#^APP_URL=.*#APP_URL=${APP_URL}#" apps/web/.env
fi
grep -q '^DEV_SHOW_LOGIN_LINK=' apps/web/.env || echo 'DEV_SHOW_LOGIN_LINK=true' >> apps/web/.env

echo "==> Installing packages"
pnpm install

echo "==> Waiting for the database"
for i in $(seq 1 30); do
  (echo > /dev/tcp/127.0.0.1/5432) >/dev/null 2>&1 && break
  sleep 2
done

echo "==> Creating database tables and demo data"
pnpm --filter @spagai/web exec prisma migrate deploy
pnpm db:seed

echo "==> Setup finished. The website starts automatically."
