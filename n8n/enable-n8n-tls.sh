#!/usr/bin/env bash
# =============================================================================
# enable-n8n-tls.sh — Enable HTTPS for n8n
#
# Usage:
#   bash enable-n8n-tls.sh tailscale    — Tailscale cert (trusted on all
#                                         Tailnet devices automatically)
#   bash enable-n8n-tls.sh self-signed  — Self-signed cert trusted via macOS
#                                         Keychain (works offline, localhost only)
#
# Run after setup-n8n-notion.sh. Requires Docker running and n8n container
# already created.
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── Argument ──────────────────────────────────────────────────────────────────
MODE="${1:-}"
if [[ "$MODE" != "tailscale" && "$MODE" != "self-signed" ]]; then
  echo "Usage: bash enable-n8n-tls.sh <tailscale|self-signed>"
  echo ""
  echo "  tailscale   — provision cert via Tailscale (trusted on all Tailnet devices)"
  echo "  self-signed — generate self-signed cert trusted via macOS Keychain (localhost only)"
  exit 1
fi

# ── Config ────────────────────────────────────────────────────────────────────
N8N_PORT=5678
N8N_CONTAINER=n8n
N8N_VOLUME=n8n_data
CERT_DIR="${HOME}/.config/n8n/certs"
mkdir -p "${CERT_DIR}"

# ── Shared: check Docker ──────────────────────────────────────────────────────
info "Checking Docker..."
docker info &>/dev/null || error "Docker is not running. Start Docker Desktop and re-run."
docker ps -a --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$" \
  || error "n8n container not found. Run setup-n8n-notion.sh first."
info "Docker and n8n container confirmed."

# =============================================================================
# MODE: self-signed
# =============================================================================
if [[ "$MODE" == "self-signed" ]]; then
  CERT="${CERT_DIR}/localhost.crt"
  KEY="${CERT_DIR}/localhost.key"

  # ── Generate cert ───────────────────────────────────────────────────────────
  info "Generating self-signed cert for localhost..."
  command -v openssl &>/dev/null || error "openssl not found. Install via: brew install openssl"

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "${KEY}" \
    -out    "${CERT}" \
    -days   3650 \
    -subj   "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    2>/dev/null

  info "Self-signed cert generated (valid 10 years, no renewal needed)."

  # ── Trust in macOS Keychain ─────────────────────────────────────────────────
  info "Trusting cert in macOS System Keychain (requires sudo)..."
  warn "You will be prompted for your Mac password."
  echo ""

  existing=$(security find-certificate -c "localhost" -a /Library/Keychains/System.keychain 2>/dev/null | grep -c "localhost" || true)
  if [[ "$existing" -gt 0 ]]; then
    warn "Existing localhost cert found — removing old entry..."
    sudo security delete-certificate -c "localhost" /Library/Keychains/System.keychain 2>/dev/null || true
  fi

  sudo security add-trusted-cert \
    -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    "${CERT}"

  info "Cert trusted — Safari will accept https://localhost without warnings."

  ACTIVE_CERT="/certs/localhost.crt"
  ACTIVE_KEY="/certs/localhost.key"
  PRIMARY_HOST="localhost"
  WEBHOOK_URL="https://localhost:${N8N_PORT}"
  FINAL_URL="https://localhost:${N8N_PORT}"
fi

# =============================================================================
# MODE: tailscale
# =============================================================================
if [[ "$MODE" == "tailscale" ]]; then
  CERT="${CERT_DIR}/tailscale.crt"
  KEY="${CERT_DIR}/tailscale.key"

  # ── Check Tailscale ─────────────────────────────────────────────────────────
  info "Checking Tailscale..."
  command -v tailscale &>/dev/null || error "Tailscale not found. Install from https://tailscale.com/download"
  tailscale status &>/dev/null || error "Tailscale is not connected. Run 'tailscale up' first."

  TS_HOSTNAME=$(tailscale status --json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['Self']['DNSName'].rstrip('.'))
" 2>/dev/null || echo "")
  [[ -z "$TS_HOSTNAME" ]] && error "Could not determine Tailscale hostname."
  info "Tailscale hostname: ${TS_HOSTNAME}"

  # ── Provision cert ──────────────────────────────────────────────────────────
  info "Provisioning Tailscale TLS certificate..."
  tailscale cert \
    --cert-file "${CERT}" \
    --key-file  "${KEY}" \
    "${TS_HOSTNAME}" \
    || error "Cert provisioning failed. Enable HTTPS at: https://login.tailscale.com/admin/dns"

  info "Tailscale cert provisioned."

  ACTIVE_CERT="/certs/tailscale.crt"
  ACTIVE_KEY="/certs/tailscale.key"
  PRIMARY_HOST="${TS_HOSTNAME}"
  WEBHOOK_URL="https://${TS_HOSTNAME}:${N8N_PORT}"
  FINAL_URL="https://${TS_HOSTNAME}:${N8N_PORT}"

  # ── Set up cert renewal via launchd ────────────────────────────────────────
  info "Setting up automatic cert renewal..."
  RENEWAL_SCRIPT="${HOME}/.config/n8n/renew-tailscale-cert.sh"
  PLIST_PATH="${HOME}/Library/LaunchAgents/com.homelab.n8n-cert-renewal.plist"

  cat > "${RENEWAL_SCRIPT}" <<RENEW
#!/usr/bin/env bash
# Renews Tailscale cert for n8n and restarts container only if cert changed
set -euo pipefail
CERT_DIR="${CERT_DIR}"
TS_HOSTNAME="${TS_HOSTNAME}"
BEFORE=\$(md5 -q "\${CERT_DIR}/tailscale.crt" 2>/dev/null || echo "none")
tailscale cert \\
  --cert-file "\${CERT_DIR}/tailscale.crt" \\
  --key-file  "\${CERT_DIR}/tailscale.key" \\
  "\${TS_HOSTNAME}" 2>/dev/null || true
AFTER=\$(md5 -q "\${CERT_DIR}/tailscale.crt" 2>/dev/null || echo "none")
if [[ "\$BEFORE" != "\$AFTER" ]]; then
  docker restart n8n
fi
RENEW
  chmod +x "${RENEWAL_SCRIPT}"

  cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.homelab.n8n-cert-renewal</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RENEWAL_SCRIPT}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${HOME}/.config/n8n/cert-renewal.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/.config/n8n/cert-renewal.log</string>
</dict>
</plist>
PLIST

  launchctl unload "${PLIST_PATH}" 2>/dev/null || true
  launchctl load "${PLIST_PATH}"
  info "Cert renewal scheduled daily at 03:00 via launchd."
fi

# ── Shared: stop, remove, relaunch n8n ───────────────────────────────────────
info "Stopping existing n8n container..."
docker ps --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$" && docker stop ${N8N_CONTAINER} || true
docker ps -a --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$" && docker rm ${N8N_CONTAINER}
info "Old container removed (data volume preserved)."

info "Launching n8n with HTTPS..."
docker run -d \
  --name ${N8N_CONTAINER} \
  --restart unless-stopped \
  -p ${N8N_PORT}:5678 \
  -v ${N8N_VOLUME}:/home/node/.n8n \
  -v "${CERT_DIR}:/certs:ro" \
  -e N8N_PROTOCOL=https \
  -e N8N_SSL_CERT="${ACTIVE_CERT}" \
  -e N8N_SSL_KEY="${ACTIVE_KEY}" \
  -e N8N_HOST="${PRIMARY_HOST}" \
  -e WEBHOOK_URL="${WEBHOOK_URL}" \
  docker.n8n.io/n8nio/n8n

# ── Shared: wait for ready ────────────────────────────────────────────────────
info "Waiting for n8n to be ready..."
for i in {1..30}; do
  sleep 2
  curl -sk "https://localhost:${N8N_PORT}/healthz" &>/dev/null && break
  echo -n "."
done
echo ""
curl -sk "https://localhost:${N8N_PORT}/healthz" &>/dev/null \
  || error "n8n didn't become ready. Check: docker logs ${N8N_CONTAINER}"
info "n8n is ready."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  HTTPS enabled (${MODE})!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "  n8n UI:  ${FINAL_URL}"
echo ""
if [[ "$MODE" == "self-signed" ]]; then
  warn "Cert is trusted on this Mac only (System Keychain)."
  warn "For remote access from iPad/iPhone, run: bash enable-n8n-tls.sh tailscale"
else
  warn "Cert renews automatically at 03:00 daily via launchd."
  warn "For offline/localhost access, also run: bash enable-n8n-tls.sh self-signed"
fi
echo ""
