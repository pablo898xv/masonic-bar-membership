#!/usr/bin/env bash
# Bring up a local stack that mirrors Firebase Hosting / Firestore / Auth / mail.
#
# Usage:
#   bash deploy/local/setup.sh           # idempotent bootstrap
#   bash deploy/local/setup.sh --reset-volumes  # wipe emulator data, then recreate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RESET_VOLUMES=0
for arg in "$@"; do
  case "$arg" in
    --reset-volumes) RESET_VOLUMES=1 ;;
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

if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install
fi

if [ "$RESET_VOLUMES" -eq 1 ]; then
  echo "==> Resetting Docker volumes"
  docker compose down -v
fi

echo "==> Starting Docker services (Firestore emulator, Auth emulator, Mailpit)"
docker compose up -d --build

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

echo
echo "Local Firebase-parity stack is ready."
echo
echo "  App:           npm run dev          →  http://127.0.0.1:3000"
echo "  Admin:         http://127.0.0.1:3000/admin"
echo "  Emulator UI:   http://127.0.0.1:4000"
echo "  Firestore:     127.0.0.1:8080"
echo "  Auth:          127.0.0.1:9099"
echo "  Mailpit:       http://127.0.0.1:8125"
echo
