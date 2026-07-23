#!/usr/bin/env bash
# Bootstrap the P2Pix front-end for local development.
#
#   ./scripts/dev-local.sh           # vanilla anvil node (chainId 31337)
#   LOCAL_FORK=1 ./scripts/dev-local.sh   # fork Sepolia (needs ALCHEMY_API_KEY in submodule .env)
#
# Anvil (not hardhat node) is used so the ERC-4337 stack — whose
# UpgradeableModularAccount is ~34KB — can be deployed without hitting
# hardhat's EIP-170 contract size cap. p2pix's hardhat-based deploys still
# work because they use the `localhost` network (RPC at 127.0.0.1:8545).
#
# Steps: submodule → install → anvil node (bg) → deploy1+2 → 4337 deploy →
#        patch .env.local with deployed addresses → wagmi:gen → bun start.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SC_DIR="$ROOT/p2pix-smart-contracts"
ENV_FILE="$ROOT/.env.local"
NODE_LOG="$ROOT/.anvil-node.log"
NODE_PID_FILE="$ROOT/.anvil-node.pid"

cleanup() {
  if [[ -f "$NODE_PID_FILE" ]]; then
    local pid
    pid="$(cat "$NODE_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "→ stopping anvil node (pid $pid)"
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$NODE_PID_FILE"
  fi
}
trap cleanup EXIT INT TERM

echo "→ syncing submodule (init only — won't reset existing checkouts)"
# `update --init` would reset every submodule HEAD to the commit recorded in
# the parent repo's index, blowing away local fork commits in vendor/reown-appkit
# before they're bumped here. We init missing submodules but leave initialized
# ones alone — the dev is responsible for keeping them on the right SHA.
git -C "$ROOT" submodule init
for sm in $(git -C "$ROOT" submodule status | awk '/^-/ {print $2}'); do
  echo "  initializing $sm (recursive)"
  git -C "$ROOT" submodule update --init --recursive -- "$sm"
done

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "→ installing front-end deps"
  (cd "$ROOT" && bun install)
fi

if [[ ! -d "$SC_DIR/node_modules" ]]; then
  echo "→ installing smart-contract deps"
  (cd "$SC_DIR" && bun install)
fi

echo "→ resetting deploys/localhost.json"
cat > "$SC_DIR/deploys/localhost.json" <<'JSON'
{
  "signers": [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  ],
  "p2pix": "",
  "token": ""
}
JSON

if ! command -v anvil >/dev/null 2>&1; then
  echo "✗ anvil not found — install foundry: https://getfoundry.sh" >&2
  exit 1
fi

echo "→ starting anvil node (logs: $NODE_LOG)"
ANVIL_ARGS=(--host 127.0.0.1 --port 8545 --chain-id 31337 --disable-code-size-limit)
if [[ "${LOCAL_FORK:-0}" == "1" ]]; then
  if [[ -z "${ALCHEMY_API_KEY:-}" ]]; then
    if [[ -f "$SC_DIR/.env" ]] && grep -q '^ALCHEMY_API_KEY=' "$SC_DIR/.env"; then
      ALCHEMY_API_KEY="$(grep '^ALCHEMY_API_KEY=' "$SC_DIR/.env" | cut -d= -f2- | tr -d '"')"
    fi
  fi
  if [[ -z "${ALCHEMY_API_KEY:-}" || "$ALCHEMY_API_KEY" == "{INSERT_API_KEY}" ]]; then
    echo "✗ LOCAL_FORK=1 needs ALCHEMY_API_KEY (env var or p2pix-smart-contracts/.env)" >&2
    exit 1
  fi
  ANVIL_ARGS+=(--fork-url "https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY")
fi

(anvil "${ANVIL_ARGS[@]}" >"$NODE_LOG" 2>&1) &
echo $! > "$NODE_PID_FILE"

echo "→ waiting for RPC on 127.0.0.1:8545"
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" \
      -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
      http://127.0.0.1:8545 | grep -q "200"; then
    break
  fi
  sleep 0.5
  if [[ $i == 30 ]]; then
    echo "✗ anvil node did not come up; see $NODE_LOG" >&2
    exit 1
  fi
done

echo "→ deploying mock token"
(cd "$SC_DIR" && bun run deploy1:localhost)

echo "→ deploying P2PIX + reputation + multicall"
(cd "$SC_DIR" && bun run deploy2:localhost)

TOKEN_ADDR="$(node -e "console.log(require('$SC_DIR/deploys/localhost.json').token)")"
P2PIX_ADDR="$(node -e "console.log(require('$SC_DIR/deploys/localhost.json').p2pix)")"

if [[ -z "$TOKEN_ADDR" || -z "$P2PIX_ADDR" ]]; then
  echo "✗ deploy did not write addresses to deploys/localhost.json" >&2
  exit 1
fi

echo "→ patching .env.local (token=$TOKEN_ADDR, p2pix=$P2PIX_ADDR)"
[[ -f "$ENV_FILE" ]] || { echo "✗ $ENV_FILE missing — create from template"; exit 1; }

# Portable in-place sed (BSD/macOS + GNU).
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}
sed_inplace -E "s|^VITE_LOCAL_TOKEN_ADDRESS=.*|VITE_LOCAL_TOKEN_ADDRESS=$TOKEN_ADDR|" "$ENV_FILE"
sed_inplace -E "s|^VITE_LOCAL_P2PIX_ADDRESS=.*|VITE_LOCAL_P2PIX_ADDRESS=$P2PIX_ADDR|" "$ENV_FILE"

ERC4337_DIR="$ROOT/vendor/erc-4337"
if [[ -d "$ERC4337_DIR" && -f "$ERC4337_DIR/script/DeployAll.s.sol" ]]; then
  if command -v forge >/dev/null 2>&1; then
    echo "→ deploying ERC-4337 stack (EntryPoint + WebauthnOwnerPlugin + factory)"
    if (cd "$ERC4337_DIR" && mkdir -p deployments && \
        forge script script/DeployAll.s.sol \
          --rpc-url http://127.0.0.1:8545 \
          --broadcast \
          --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
          --disable-code-size-limit \
          -vv); then
      PLUGIN_ADDR="$(grep '^WEBAUTHN_PLUGIN_ADDRESS=' "$ERC4337_DIR/deployments/local.env" | cut -d= -f2)"
      FACTORY_ADDR="$(grep '^WEBAUTHN_ACCOUNT_FACTORY=' "$ERC4337_DIR/deployments/local.env" | cut -d= -f2)"
      ENTRYPOINT_ADDR="$(grep '^ENTRYPOINT_ADDRESS=' "$ERC4337_DIR/deployments/local.env" | cut -d= -f2)"
      if [[ -n "$PLUGIN_ADDR" ]]; then
        echo "→ patching .env.local (webauthn plugin=$PLUGIN_ADDR, factory=$FACTORY_ADDR, entrypoint=$ENTRYPOINT_ADDR, rpId=localhost)"
        sed_inplace -E "s|^VITE_WEBAUTHN_PLUGIN_ADDRESS=.*|VITE_WEBAUTHN_PLUGIN_ADDRESS=$PLUGIN_ADDR|" "$ENV_FILE"
        sed_inplace -E "s|^VITE_WEBAUTHN_FACTORY_ADDRESS=.*|VITE_WEBAUTHN_FACTORY_ADDRESS=$FACTORY_ADDR|" "$ENV_FILE"
        sed_inplace -E "s|^VITE_ENTRYPOINT_ADDRESS=.*|VITE_ENTRYPOINT_ADDRESS=$ENTRYPOINT_ADDR|" "$ENV_FILE"
        if grep -q '^VITE_PASSKEY_RP_ID=[[:space:]]*$' "$ENV_FILE"; then
          sed_inplace -E "s|^VITE_PASSKEY_RP_ID=.*|VITE_PASSKEY_RP_ID=localhost|" "$ENV_FILE"
        fi
      fi
    else
      echo "⚠  ERC-4337 deploy failed — passkey wiring skipped (front-end still boots)."
    fi
  else
    echo "⚠  forge not found — skipping ERC-4337 deploy. Install foundry: https://getfoundry.sh"
  fi
fi

echo "→ generating wagmi ABIs"
(cd "$ROOT" && bun run wagmi:gen)

if ! grep -q '^VITE_REOWN_PROJECT_ID=.\+' "$ENV_FILE"; then
  echo "⚠  VITE_REOWN_PROJECT_ID is empty — wallet connect won't open the modal."
  echo "   Get one at https://cloud.reown.com and add it to .env.local."
fi

cat <<'INFO'

ℹ  The front-end exposes an "Anvil (Local)" network (chainId 31337) when
   VITE_LOCAL_P2PIX_ADDRESS is set in .env.local. Sepolia stays on 11155111.
   In Metamask: Add network manually → http://127.0.0.1:8545, chainId 31337.
   LOCAL_FORK=1 is only useful if you want Sepolia state forked into the node.

   ERC-4337 / passkey addresses written to .env.local after deploy:
     VITE_WEBAUTHN_PLUGIN_ADDRESS   — WebauthnOwnerPlugin contract
     VITE_WEBAUTHN_FACTORY_ADDRESS  — WebauthnAccountFactory contract
     VITE_ENTRYPOINT_ADDRESS        — ERC-4337 EntryPoint contract

INFO

echo "→ starting front-end on http://localhost:3000 (Ctrl-C stops front + anvil node)"
(cd "$ROOT" && bun start)
