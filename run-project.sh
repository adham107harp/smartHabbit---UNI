#!/usr/bin/env bash
# SmartHabbit — one-shot launcher (Linux / macOS)
# Starts the backend (port 3000) and a static server for the frontend (port 5500),
# waits for both to be ready, then opens the browser. Ctrl+C kills both.

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[smarthabbit]${NC} $*"; }
fail() { echo -e "${RED}[smarthabbit]${NC} $*"; exit 1; }
ok()   { echo -e "${GREEN}[smarthabbit]${NC} $*"; }

# --- Pre-flight --------------------------------------------------------------

command -v node >/dev/null 2>&1 || fail "Node.js is required (https://nodejs.org)"
command -v npm  >/dev/null 2>&1 || fail "npm is required"

# --- Install backend deps once -----------------------------------------------

if [ ! -d backend/node_modules ]; then
  log "Installing backend dependencies (one-time)..."
  ( cd backend && npm install --silent )
fi

# --- Backend -----------------------------------------------------------------

log "Starting backend on http://localhost:3000 ..."
( cd backend && npm run dev ) &
BACK_PID=$!

# Poll /health until the API answers, up to 30s
for i in $(seq 1 60); do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    ok "Backend ready."
    break
  fi
  sleep 0.5
done

if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
  fail "Backend didn't come up in time. Check the log above."
fi

# --- Frontend ----------------------------------------------------------------

log "Starting frontend on http://localhost:5500 ..."
( cd frontend && npx --yes http-server -p 5500 -s -c-1 ) &
FRONT_PID=$!

sleep 1
URL="http://localhost:5500/index.html"
ok "Open: ${URL}"

# Open in browser (xdg-open on Linux, open on macOS)
if command -v xdg-open >/dev/null 2>&1; then
  ( xdg-open "$URL" >/dev/null 2>&1 ) || true
elif command -v open >/dev/null 2>&1; then
  ( open "$URL" >/dev/null 2>&1 ) || true
fi

# --- Cleanup on Ctrl+C -------------------------------------------------------

cleanup() {
  log "Stopping servers..."
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
  wait "$BACK_PID" 2>/dev/null || true
  wait "$FRONT_PID" 2>/dev/null || true
  ok "Bye."
}
trap cleanup EXIT INT TERM

# Wait until either process exits
wait -n "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
