#!/usr/bin/env bash
# =============================================================================
# Notion Blog Mover — n8n Setup Script
# Installs n8n via Docker and imports the workflow automatically.
# Run once on your Mac Mini: bash setup-n8n-notion.sh
#
# TLS/HTTPS is NOT enabled by this script — run enable-n8n-tls.sh afterwards
# to provision a Tailscale cert and relaunch n8n with HTTPS.
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
N8N_PORT=5678
N8N_CONTAINER=n8n
N8N_VOLUME=n8n_data
N8N_BASE_URL="http://localhost:${N8N_PORT}"
WORKFLOW_FILE="$(dirname "$0")/notion-blog-mover.json"
CERT_DIR="${HOME}/.config/tailscale/certs"

# ── 1. Check Docker ───────────────────────────────────────────────────────────
info "Checking for Docker..."
if ! command -v docker &>/dev/null; then
  warn "Docker not found. Installing via Homebrew..."
  if ! command -v brew &>/dev/null; then
    error "Homebrew not found. Install it first: https://brew.sh"
  fi
  brew install --cask docker
  warn "Docker Desktop installed. Please open Docker Desktop and wait for it to start, then re-run this script."
  open -a Docker
  exit 0
fi

if ! docker info &>/dev/null; then
  warn "Docker is installed but not running. Starting Docker Desktop..."
  open -a Docker
  echo "Waiting for Docker to start..."
  for i in {1..30}; do
    sleep 2
    docker info &>/dev/null && break
    echo -n "."
  done
  echo ""
  docker info &>/dev/null || error "Docker didn't start in time. Please start it manually and re-run."
fi
info "Docker is running."

# ── 2. Start n8n container ────────────────────────────────────────────────────
info "Checking for existing n8n container..."
if docker ps -a --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$"; then
    info "n8n is already running."
  else
    info "Starting existing n8n container..."
    docker start ${N8N_CONTAINER}
  fi
else
  info "Creating and starting n8n container..."
  docker run -d \
    --name ${N8N_CONTAINER} \
    --restart unless-stopped \
    -p ${N8N_PORT}:5678 \
    -v ${N8N_VOLUME}:/home/node/.n8n \
    docker.n8n.io/n8nio/n8n
fi

# ── 3. Wait for n8n to be ready ───────────────────────────────────────────────
info "Waiting for n8n to be ready..."
for i in {1..30}; do
  sleep 2
  if curl -sf "${N8N_BASE_URL}/healthz" &>/dev/null; then
    break
  fi
  echo -n "."
done
echo ""
curl -sf "${N8N_BASE_URL}/healthz" &>/dev/null || error "n8n didn't become ready in time. Check: docker logs ${N8N_CONTAINER}"
info "n8n is ready at ${N8N_BASE_URL}"

# ── 4. First-run setup (owner account) ───────────────────────────────────────
info "Checking if n8n needs initial setup..."
SETUP_NEEDED=$(curl -sf "${N8N_BASE_URL}/api/v1/settings" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('yes' if not data.get('userManagement', {}).get('isInstanceOwnerSetUp', True) else 'no')
" 2>/dev/null || echo "unknown")

if [[ "$SETUP_NEEDED" == "yes" ]]; then
  warn "n8n needs an owner account created."
  echo ""
  read -rp "  Enter your email for n8n: " N8N_EMAIL
  read -rsp "  Enter a password for n8n: " N8N_PASSWORD
  echo ""
  read -rp "  First name: " N8N_FIRST
  read -rp "  Last name: "  N8N_LAST

  SETUP_RESP=$(curl -sf -X POST "${N8N_BASE_URL}/api/v1/owner/setup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${N8N_EMAIL}\",\"password\":\"${N8N_PASSWORD}\",\"firstName\":\"${N8N_FIRST}\",\"lastName\":\"${N8N_LAST}\"}")

  N8N_API_KEY=$(echo "$SETUP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('apiKey',''))" 2>/dev/null || echo "")
  info "Owner account created."
else
  warn "n8n already has an owner account set up."
  echo ""
  warn "You need your n8n API key to continue."
  warn "Get it from: ${N8N_BASE_URL}/settings/api"
  read -rsp "  Paste your n8n API key: " N8N_API_KEY
  echo ""
fi

[[ -z "$N8N_API_KEY" ]] && error "Could not obtain n8n API key. Get it from ${N8N_BASE_URL}/settings/api and re-run."

# ── 5. Create Notion credential ───────────────────────────────────────────────
echo ""
info "Setting up Notion API credential..."
warn "You need a Notion integration token."
warn "Get one from: https://www.notion.so/my-integrations"
warn "Make sure it has access to both '@cmdaltr Blog DB' and '@cmdaltr Blog'."
echo ""
read -rsp "  Paste your Notion integration token (starts with 'secret_'): " NOTION_TOKEN
echo ""

CRED_RESP=$(curl -sf -X POST "${N8N_BASE_URL}/api/v1/credentials" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d "{
    \"name\": \"Notion API Key\",
    \"type\": \"httpHeaderAuth\",
    \"data\": {
      \"name\": \"Authorization\",
      \"value\": \"Bearer ${NOTION_TOKEN}\"
    }
  }")

CRED_ID=$(echo "$CRED_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
[[ -z "$CRED_ID" ]] && error "Failed to create credential. Response: ${CRED_RESP}"
info "Credential created (ID: ${CRED_ID})."

# ── 6. Patch workflow JSON with credential ID ─────────────────────────────────
info "Preparing workflow JSON..."
[[ ! -f "$WORKFLOW_FILE" ]] && error "Workflow file not found at: ${WORKFLOW_FILE}\nMake sure notion-blog-mover.json is in the same folder as this script."

PATCHED_WORKFLOW=$(python3 - <<PYEOF
import json, sys

with open("${WORKFLOW_FILE}") as f:
    wf = json.load(f)

cred_block = {
    "id": "${CRED_ID}",
    "name": "Notion API Key"
}

for node in wf.get("nodes", []):
    if node.get("type") == "n8n-nodes-base.httpRequest":
        node.setdefault("credentials", {})
        node["credentials"]["httpHeaderAuth"] = cred_block

print(json.dumps(wf))
PYEOF
)

# ── 7. Import workflow via API ────────────────────────────────────────────────
info "Importing workflow into n8n..."
IMPORT_RESP=$(echo "$PATCHED_WORKFLOW" | curl -sf -X POST "${N8N_BASE_URL}/api/v1/workflows" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d @-)

WORKFLOW_ID=$(echo "$IMPORT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
[[ -z "$WORKFLOW_ID" ]] && error "Failed to import workflow. Response: ${IMPORT_RESP}"
info "Workflow imported (ID: ${WORKFLOW_ID})."

# ── 8. Activate workflow ──────────────────────────────────────────────────────
info "Activating workflow..."
curl -sf -X PATCH "${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d '{"active": true}' > /dev/null

info "Workflow activated — it will run every hour."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All done!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "  n8n UI:       ${N8N_BASE_URL}"
echo "  Workflow:     ${N8N_BASE_URL}/workflow/${WORKFLOW_ID}"
echo ""
echo "  The workflow checks Blog DB every hour and moves"
echo "  any page with Status = 'Ready' to @cmdaltr Blog."
echo ""
warn "n8n is running over HTTP. To enable HTTPS for Safari access, run:"
warn "  bash enable-n8n-tls.sh"
warn ""
warn "Remember: if you restart your Mac, run 'docker start n8n' or"
warn "set Docker Desktop to start on login."
echo ""
