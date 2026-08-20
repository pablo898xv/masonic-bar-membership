#!/usr/bin/env bash
# Bring up a local stack that mirrors Firebase Hosting / Firestore / Auth / mail.
#
# Usage:
#   bash deploy/local/setup.sh                 # emulators + Mailpit; run Next.js on the host
#   bash deploy/local/setup.sh --hosting       # also start the Next.js Hosting stand-in container
#   bash deploy/local/setup.sh --reset-volumes # wipe emulator data, then recreate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RESET_VOLUMES=0
HOSTING=0
for arg in "$@"; do
  case "$arg" in
    --reset-volumes) RESET_VOLUMES=1 ;;
    --hosting) HOSTING=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 1
  }
}

need docker

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "==> Creating .env.local from .env.local.example"
  cp .env.local.example .env.local
fi

if [ ! -d node_modules ] && [ "$HOSTING" -eq 0 ]; then
  echo "==> npm install"
  npm install
fi

if [ "$RESET_VOLUMES" -eq 1 ]; then
  echo "==> Resetting Docker volumes"
  docker compose --profile hosting down -v
fi

COMPOSE_ARGS=(up -d --build)
if [ "$HOSTING" -eq 1 ]; then
  COMPOSE_ARGS=(--profile hosting up -d --build)
  echo "==> Starting Docker services (Firestore, Auth, Mailpit, Next.js Hosting stand-in)"
else
  echo "==> Starting Docker services (Firestore emulator, Auth emulator, Mailpit)"
fi

docker compose "${COMPOSE_ARGS[@]}"

echo "==> Waiting for Firestore emulator"
for i in $(seq 1 180); do
  if curl -sf http://127.0.0.1:8080 >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 180 ]; then
    echo "Firestore emulator did not become ready" >&2
    docker compose logs firebase | tail -50 >&2
    exit 1
  fi
done

if [ "$HOSTING" -eq 1 ]; then
  echo "==> Waiting for Next.js (Hosting stand-in)"
  for i in $(seq 1 90); do
    if curl -sf -H "Host: membership.ashlartechnologies.com" http://127.0.0.1/ >/dev/null 2>&1; then
      break
    fi
    sleep 2
    if [ "$i" -eq 90 ]; then
      echo "Web container did not become ready" >&2
      docker compose logs web | tail -80 >&2
      exit 1
    fi
  done
fi

echo
echo "Local Firebase-parity stack is ready."
echo
if [ "$HOSTING" -eq 1 ]; then
  echo "  App:           http://membership.ashlartechnologies.com"
  echo "  Admin:         http://membership.ashlartechnologies.com/admin"
else
  echo "  App:           npm run dev          →  http://127.0.0.1:3000"
  echo "  Admin:         http://127.0.0.1:3000/admin"
fi
echo "  Docker UI:     http://portainer.ashlartechnologies.com"
echo "  Traefik:       http://traefik.ashlartechnologies.com"
echo "  Mailpit:       http://relay.ashlartechnologies.com"
echo "  Emulator UI:   http://127.0.0.1:4000  (loopback only)"
echo
echo "Add to /etc/hosts:  127.0.0.1 ashlartechnologies.com www.ashlartechnologies.com membership.ashlartechnologies.com portainer.ashlartechnologies.com relay.ashlartechnologies.com traefik.ashlartechnologies.com"
echo
