#!/usr/bin/env bash
# Install Docker Engine and start the Firebase Hosting-parity stack.
# Run inside the Ubuntu Hyper-V guest, from the repo root:
#
#   bash deploy/hyperv/bootstrap.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 1
  }
}

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this script as a normal user with sudo, not as root." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine (no Desktop license)"
  need sudo
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ca-certificates curl
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo
  echo "Docker is installed. Log out and back in (or reboot) so group 'docker' applies,"
  echo "then run this script again."
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable. Either start it or log out/in after the first run." >&2
  echo "  sudo systemctl enable --now docker" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "==> Creating .env.local from .env.local.example"
  cp .env.local.example .env.local
fi

# Advertise the VM IP in the public base URL when we can detect it.
VM_IP="$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)"
if [ -n "${VM_IP}" ]; then
  if grep -q '^NEXT_PUBLIC_BASE_URL=' .env.local; then
    sed -i "s|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=http://membership.ashlartechnologies.com|" .env.local
  else
    printf '\nNEXT_PUBLIC_BASE_URL=http://membership.ashlartechnologies.com\n' >> .env.local
  fi
fi

echo "==> Writing Compose publish settings for Hyper-V"
cp deploy/hyperv/compose.env .env

if command -v ufw >/dev/null 2>&1; then
  echo "==> Allowing HTTP/HTTPS (SSH kept as-is)"
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

echo "==> Building and starting Hosting-parity stack"
docker compose --profile hosting up -d --build

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

REACH="${VM_IP:-127.0.0.1}"
DOMAIN=ashlartechnologies.com
echo
echo "Firebase Hosting-parity stack is running on this VM."
echo "Public sites are on ports 80 and 443 only."
echo
echo "  App:           http://membership.${DOMAIN}  (also http://${DOMAIN} and http://www.${DOMAIN})"
echo "  Admin:         http://membership.${DOMAIN}/admin"
echo "  Docker UI:     http://portainer.${DOMAIN}"
echo "  Traefik:       http://traefik.${DOMAIN}"
echo "  Mailpit:       http://relay.${DOMAIN}"
echo
echo "On Windows, add this line to C:\\Windows\\System32\\drivers\\etc\\hosts:"
echo "  ${REACH}  ${DOMAIN} www.${DOMAIN} membership.${DOMAIN} portainer.${DOMAIN} relay.${DOMAIN} traefik.${DOMAIN}"
echo
echo "HTTPS works on the same hostnames (self-signed cert until Google/real DNS)."
echo "Stop with: docker compose --profile hosting down"
echo
