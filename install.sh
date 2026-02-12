#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/maty-millien/pushit.git"
INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/pushit"
CONFIG_FILE="$CONFIG_DIR/.env"
TMPDIR=""

# --- Colors (degrade gracefully) ---

if [ -t 1 ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  PURPLE='\033[0;35m'
  RESET='\033[0m'
else
  BOLD='' DIM='' RED='' GREEN='' YELLOW='' BLUE='' PURPLE='' RESET=''
fi

# --- Helpers ---

info()  { printf "${BLUE}::${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$1"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$1" >&2; exit 1; }

cleanup() {
  if [ -n "$TMPDIR" ] && [ -d "$TMPDIR" ]; then
    rm -rf "$TMPDIR"
  fi
}
trap cleanup EXIT INT TERM

# --- Banner ---

printf "\n"
printf "${PURPLE}${BOLD}  pushit installer${RESET}\n"
printf "${DIM}  AI-powered git commits${RESET}\n"
printf "\n"

# --- Prerequisites ---

info "Checking prerequisites..."

command -v git >/dev/null 2>&1 || fail "git is required but not installed. Install it from https://git-scm.com"
command -v curl >/dev/null 2>&1 || fail "curl is required but not installed."

ok "git and curl found"

# --- Bun ---

if command -v bun >/dev/null 2>&1; then
  ok "Bun found ($(bun --version))"
else
  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  command -v bun >/dev/null 2>&1 || fail "Bun installation failed. Install manually from https://bun.sh"
  ok "Bun installed ($(bun --version))"
fi

# --- API Key ---

info "Configuring OpenRouter API key..."

EXISTING_KEY=""
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_KEY=$(sed -n 's/^OPENROUTER_API_KEY=//p' "$CONFIG_FILE" 2>/dev/null || true)
fi

if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != "your-api-key-here" ]; then
  MASKED="${EXISTING_KEY:0:6}...${EXISTING_KEY: -4}"
  printf "  Existing key found: ${DIM}%s${RESET}\n" "$MASKED"
  printf "  Keep existing key? [Y/n] "
  read -r KEEP_KEY </dev/tty || KEEP_KEY="y"
  if [ -z "$KEEP_KEY" ] || [[ "$KEEP_KEY" =~ ^[Yy] ]]; then
    API_KEY="$EXISTING_KEY"
    ok "Keeping existing key"
  else
    printf "  Enter your OpenRouter API key: "
    read -r API_KEY </dev/tty || fail "Failed to read input"
    [ -n "$API_KEY" ] || fail "API key cannot be empty. Get one at https://openrouter.ai/keys"
  fi
else
  printf "  Get your key at: ${BLUE}https://openrouter.ai/keys${RESET}\n"
  printf "  Enter your OpenRouter API key: "
  read -r API_KEY </dev/tty || fail "Failed to read input"
  [ -n "$API_KEY" ] || fail "API key cannot be empty"
fi

# --- Clone & Build ---

info "Building pushit..."

TMPDIR=$(mktemp -d)
git clone --depth 1 --quiet "$REPO" "$TMPDIR/pushit"
cd "$TMPDIR/pushit"
bun install --frozen-lockfile --silent
bun build src/index.ts --compile --outfile pushit --minify --bytecode

ok "Build complete"

# --- Install binary ---

info "Installing binary to $INSTALL_DIR..."

mkdir -p "$INSTALL_DIR"
mv pushit "$INSTALL_DIR/pushit"
chmod +x "$INSTALL_DIR/pushit"

ok "Binary installed"

# --- Save config ---

info "Saving configuration..."

mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" <<EOF
# OpenRouter API Configuration
# Get your API key from: https://openrouter.ai/keys
OPENROUTER_API_KEY=$API_KEY
EOF
chmod 600 "$CONFIG_FILE"

ok "Config saved to $CONFIG_FILE"

# --- PATH check ---

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  printf "\n"
  warn "$INSTALL_DIR is not in your PATH"
  printf "  Add this to your shell config (~/.bashrc, ~/.zshrc, etc.):\n"
  printf "\n"
  printf "    ${BOLD}export PATH=\"%s:\$PATH\"${RESET}\n" "$INSTALL_DIR"
  printf "\n"
fi

# --- Done ---

printf "\n"
printf "${GREEN}${BOLD}  pushit installed successfully!${RESET}\n"
printf "\n"
printf "  ${DIM}Usage:${RESET}\n"
printf "    pushit            ${DIM}# generate commit from changes${RESET}\n"
printf "    pushit --dry-run  ${DIM}# test without committing${RESET}\n"
printf "\n"
