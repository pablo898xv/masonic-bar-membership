#!/usr/bin/env bash
# Copy this laptop's Membership Manager tree onto UAT (10.0.1.8).
#
# Usage (from repo root):
#   bash deploy/uat/sync.sh              # code + Apple Wallet certs, rebuild web
#   bash deploy/uat/sync.sh --no-build   # files only
#   bash deploy/uat/sync.sh --data       # also replace UAT emulator data with local
#   bash deploy/uat/sync.sh --no-certs
#
# SSH host defaults to ashtechukdc1h1 (see ~/.ssh/config). Override with UAT_HOST.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

UAT_HOST="${UAT_HOST:-ashtechukdc1h1}"
BUILD=1
SYNC_CERTS=1
SYNC_DATA=0

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --no-certs) SYNC_CERTS=0 ;;
    --data) SYNC_DATA=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
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

need ssh
need tar
need scp

ssh -o BatchMode=yes -o ConnectTimeout=8 "$UAT_HOST" 'true' >/dev/null

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REV="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
DIRTY=""
if git -C "$ROOT" status --porcelain 2>/dev/null | grep -q .; then
  DIRTY=" dirty"
fi

TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "==> Packing repo (${REV}${DIRTY})"
export COPYFILE_DISABLE=1
TAR_FLAGS=()
if [ "$(uname -s)" = Darwin ]; then
  TAR_FLAGS+=(--no-xattrs --no-mac-metadata)
fi
tar "${TAR_FLAGS[@]}" -C "$ROOT" -czf "$TMPDIR/code.tgz" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./.data' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='./.DS_Store' \
  --exclude='./.agents' \
  --exclude='./.claude' \
  --exclude='./.cursor' \
  --exclude='./coverage' \
  --exclude='./certs' \
  --exclude='./.firebase' \
  .

if [ "$SYNC_CERTS" -eq 1 ]; then
  if [ ! -f "$ROOT/certs/apple-wallet/pass.pem" ]; then
    echo "No local Apple Wallet PEMs at certs/apple-wallet; leaving UAT certs as-is."
    SYNC_CERTS=0
  else
    tar "${TAR_FLAGS[@]}" -C "$ROOT/certs" -czf "$TMPDIR/certs.tgz" apple-wallet
  fi
fi

if [ "$SYNC_DATA" -eq 1 ]; then
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running; cannot export local emulator data." >&2
    exit 1
  fi
  if ! docker exec masonic-firebase true >/dev/null 2>&1; then
    echo "Local masonic-firebase is not running. Start it with: bash deploy/local/setup.sh" >&2
    exit 1
  fi
  echo "==> Exporting local Firestore/Auth emulators"
  docker exec masonic-firebase sh -c 'rm -rf /tmp/fbexport && mkdir -p /tmp/fbexport && cd /firebase && firebase emulators:export /tmp/fbexport --force --project demo-masonic-bar'
  docker exec masonic-firebase tar czf - -C /tmp/fbexport . > "$TMPDIR/fbexport.tgz"
fi

echo "==> Uploading to ${UAT_HOST}"
scp -o BatchMode=yes "$TMPDIR/code.tgz" "$UAT_HOST:/tmp/mbm-code.tgz"
if [ "$SYNC_CERTS" -eq 1 ]; then
  scp -o BatchMode=yes "$TMPDIR/certs.tgz" "$UAT_HOST:/tmp/mbm-certs.tgz"
fi
if [ "$SYNC_DATA" -eq 1 ]; then
  scp -o BatchMode=yes "$TMPDIR/fbexport.tgz" "$UAT_HOST:/tmp/mbm-fbexport.tgz"
fi

# Extract in place so Docker bind mounts on ~/masonic-bar-membership stay valid.
# .env and .env.local are not in the tarball, so UAT secrets are left alone.
ssh -o BatchMode=yes "$UAT_HOST" "REV='$REV' STAMP='$STAMP' DIRTY='$DIRTY' SYNC_CERTS='$SYNC_CERTS' SYNC_DATA='$SYNC_DATA' BUILD='$BUILD' bash -s" << 'REMOTE'
set -euo pipefail
DEST="$HOME/masonic-bar-membership"
mkdir -p "$DEST"
tar xzf /tmp/mbm-code.tgz -C "$DEST"
rm -f /tmp/mbm-code.tgz

if [ ! -f "$DEST/.env" ] && [ -f "$DEST/deploy/hyperv/compose.env" ]; then
  cp "$DEST/deploy/hyperv/compose.env" "$DEST/.env"
fi
if [ ! -f "$DEST/.env.local" ] && [ -f "$DEST/.env.local.example" ]; then
  cp "$DEST/.env.local.example" "$DEST/.env.local"
fi

# Public links (QR, email, payments) must use the live domain.
# 0.0.0.0 is the container bind address and must never appear in member-facing URLs.
ensure_public_base_url() {
  local file="$1"
  [ -f "$file" ] || return 0
  if grep -q '^NEXT_PUBLIC_BASE_URL=' "$file"; then
    sed -i 's|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=https://membership.ashlartechnologies.com|' "$file"
  else
    printf '\nNEXT_PUBLIC_BASE_URL=https://membership.ashlartechnologies.com\n' >> "$file"
  fi
}
ensure_public_base_url "$DEST/.env"
ensure_public_base_url "$DEST/.env.local"

if [ "$SYNC_CERTS" = 1 ]; then
  mkdir -p "$DEST/certs"
  tar xzf /tmp/mbm-certs.tgz -C "$DEST/certs"
  rm -f /tmp/mbm-certs.tgz
  chmod 755 "$DEST/certs" "$DEST/certs/apple-wallet"
  chmod 644 "$DEST/certs/apple-wallet/"* 2>/dev/null || true
fi

printf 'synced_at=%s\ncommit=%s%s\n' "$STAMP" "$REV" "$DIRTY" > "$DEST/.uat-sync-revision"

# Snapshot live emulator data before any compose work. App deploys must not
# recreate Firebase — a rebuild of that image previously imported the last
# on-disk export and dropped venues/logos/bank fields that only existed in memory.
if docker exec masonic-firebase true >/dev/null 2>&1; then
  echo "==> Exporting UAT Firestore/Auth"
  docker exec masonic-firebase sh -c 'mkdir -p /firebase/data/snapshot && firebase emulators:export /firebase/data/snapshot --force --project "${FIREBASE_PROJECT_ID:-demo-masonic-bar}"' \
    || echo "Warning: could not export emulator data; leaving the existing volume snapshot as-is." >&2
fi

if [ "$SYNC_DATA" = 1 ]; then
  echo "==> Replacing UAT emulator data"
  cd "$DEST"
  docker compose stop firebase
  docker run --rm --entrypoint sh \
    -v masonic-bar-membership_firebase_data:/data \
    -v /tmp:/backup \
    masonic-bar-membership-firebase \
    -c 'rm -rf /data/* /data/.[!.]*; mkdir -p /data/snapshot; tar xzf /backup/mbm-fbexport.tgz -C /data/snapshot'
  rm -f /tmp/mbm-fbexport.tgz
  docker compose --profile hosting up -d firebase
fi

if [ "$BUILD" = 1 ]; then
  echo "==> Rebuilding UAT web image and applying Traefik edge config"
  cd "$DEST"
  docker compose --profile hosting build web
  docker compose --profile hosting up -d --no-deps web
  docker compose --profile hosting up -d traefik mailpit portainer
else
  echo "==> Skipping container rebuild"
fi

echo "UAT files at $DEST (commit ${REV}${DIRTY})"
REMOTE

if [ "$BUILD" -eq 1 ]; then
  echo "==> Waiting for membership on 10.0.1.8"
  ok=0
  for i in $(seq 1 60); do
    if curl -sfk -H "Host: membership.ashlartechnologies.com" https://10.0.1.8/ >/dev/null 2>&1 \
      || curl -sf -o /dev/null -H 'Host: membership.ashlartechnologies.com' --connect-timeout 3 "http://10.0.1.8/" 2>/dev/null; then
      ok=1
      break
    fi
    sleep 2
  done
  if [ "$ok" -ne 1 ]; then
    echo "UAT web did not answer HTTP 200 yet. Check: ssh ${UAT_HOST} 'docker compose -f ~/masonic-bar-membership/docker-compose.yml logs web | tail'" >&2
    exit 1
  fi
fi

echo
echo "Local tree is on UAT (${UAT_HOST} / 10.0.1.8), revision ${REV}${DIRTY}."
echo "App: https://membership.ashlartechnologies.com"
echo
