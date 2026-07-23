#!/usr/bin/env bash
# Bootstrap P2Pix on one local Kernel / EntryPoint 0.7 rail.
#
# The local chain forks Sepolia state while retaining chainId 31337. That gives
# Anvil the canonical EntryPoint and Kernel v0.3.1 deployments; Alto provides a
# real ERC-4337 v0.7 bundler at http://127.0.0.1:4337.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SC_DIR="$ROOT/p2pix-smart-contracts"
ENV_FILE="$ROOT/.env.local"
NODE_LOG="$ROOT/.anvil-node.log"
NODE_PID_FILE="$ROOT/.anvil-node.pid"
ALTO_LOG="$ROOT/.alto.log"
ALTO_PID_FILE="$ROOT/.alto.pid"
ENTRYPOINT07="0x0000000071727De22E5E9d8BAf0edAc6f37da032"
ENTRYPOINT07_SENDER_CREATOR="0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C"
KERNEL_META_FACTORY="0xd703aaE79538628d27099B8c4f621bE4CCd142d5"
KERNEL_FACTORY="0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419"
KERNEL_ACCOUNT_LOGIC="0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D"
KERNEL_WEBAUTHN_VALIDATOR="0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69"
KERNEL_ECDSA_VALIDATOR="0x845ADb2C711129d4f3966735eD98a9F09fC4cE57"
P256_FALLBACK_VERIFIER="0xc2b78104907F722DaBac4C69f826a522B2754De4"
ANVIL_ACCOUNT_0_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
# Keep Alto's utility/beneficiary separate from Anvil's heavily pre-funded
# default accounts. PimlicoSimulations computes a beneficiary balance delta;
# using the 10,000 ETH default account makes filterOps underflow on Anvil.
ALTO_UTILITY_PK="0x7c85211829437e4e42df0cd40d5b3d514ed817ca2b731f52d9b1a6e7ed58eaf1"

stop_process() {
  local pid_file="$1"
  local label="$2"
  if [[ ! -f "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(<"$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "→ stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

cleanup() {
  stop_process "$ALTO_PID_FILE" "Alto"
  stop_process "$NODE_PID_FILE" "Anvil"
}
trap cleanup EXIT INT TERM

wait_for_rpc() {
  local url="$1"
  local method="$2"
  local log_file="$3"
  for i in {1..60}; do
    if curl --silent --fail \
      -H 'content-type: application/json' \
      --data "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":[],\"id\":1}" \
      "$url" >/dev/null; then
      return
    fi
    sleep 0.5
  done
  echo "✗ $url did not become ready; see $log_file" >&2
  exit 1
}

echo "→ syncing missing submodules without resetting existing checkouts"
git -C "$ROOT" submodule init
for sm in $(git -C "$ROOT" submodule status | awk '/^-/ {print $2}'); do
  git -C "$ROOT" submodule update --init --recursive -- "$sm"
done

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "→ installing front-end dependencies"
  (cd "$ROOT" && bun install)
fi
if [[ ! -d "$SC_DIR/node_modules" ]]; then
  echo "→ installing smart-contract dependencies"
  (cd "$SC_DIR" && bun install)
fi

for command_name in anvil cast curl bun; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "✗ $command_name is required" >&2
    exit 1
  fi
done

FORK_RPC_URL="${LOCAL_FORK_RPC_URL:-${VITE_SEPOLIA_API_URL:-}}"
if [[ -z "$FORK_RPC_URL" && -n "${ALCHEMY_API_KEY:-}" ]]; then
  FORK_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
fi
if [[ -z "$FORK_RPC_URL" && -f "$SC_DIR/.env" ]]; then
  ALCHEMY_API_KEY="$(sed -n 's/^ALCHEMY_API_KEY=//p' "$SC_DIR/.env" | tr -d '\"' | head -1)"
  if [[ -n "$ALCHEMY_API_KEY" && "$ALCHEMY_API_KEY" != "{INSERT_API_KEY}" ]]; then
    FORK_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
  fi
fi
FORK_RPC_URL="${FORK_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"

echo "→ starting Anvil fork with local chainId 31337 (logs: $NODE_LOG)"
(
  exec anvil \
    --host 127.0.0.1 \
    --port 8545 \
    --chain-id 31337 \
    --fork-url "$FORK_RPC_URL" \
    --disable-code-size-limit
) >"$NODE_LOG" 2>&1 &
echo $! >"$NODE_PID_FILE"
wait_for_rpc "http://127.0.0.1:8545" "eth_chainId" "$NODE_LOG"

for contract_address in \
  "$ENTRYPOINT07" \
  "$ENTRYPOINT07_SENDER_CREATOR" \
  "$KERNEL_META_FACTORY" \
  "$KERNEL_FACTORY" \
  "$KERNEL_ACCOUNT_LOGIC" \
  "$KERNEL_WEBAUTHN_VALIDATOR" \
  "$KERNEL_ECDSA_VALIDATOR" \
  "$P256_FALLBACK_VERIFIER"; do
  if [[ "$(cast code --rpc-url http://127.0.0.1:8545 "$contract_address")" == "0x" ]]; then
    echo "✗ required Kernel/EntryPoint contract missing at $contract_address" >&2
    exit 1
  fi
done

normalize_address() {
  tr '[:upper:]' '[:lower:]'
}

if [[ "$(cast call --rpc-url http://127.0.0.1:8545 "$KERNEL_META_FACTORY" \
  'approved(address)(bool)' "$KERNEL_FACTORY")" != "true" ]]; then
  echo "✗ Kernel MetaFactory has not approved the expected factory" >&2
  exit 1
fi
if [[ "$(cast call --rpc-url http://127.0.0.1:8545 "$KERNEL_FACTORY" \
  'implementation()(address)' | normalize_address)" != \
  "$(printf '%s' "$KERNEL_ACCOUNT_LOGIC" | normalize_address)" ]]; then
  echo "✗ Kernel factory points to an unexpected implementation" >&2
  exit 1
fi

ALTO_UTILITY_ADDRESS="$(cast wallet address --private-key "$ALTO_UTILITY_PK")"
cast rpc \
  --rpc-url http://127.0.0.1:8545 \
  anvil_setBalance \
  "$ALTO_UTILITY_ADDRESS" \
  0xDE0B6B3A7640000 >/dev/null

echo "→ starting Alto EntryPoint 0.7 bundler (logs: $ALTO_LOG)"
(
  cd "$ROOT"
  exec bunx @pimlico/alto@0.0.20 \
    --entrypoints "$ENTRYPOINT07" \
    --executor-private-keys "$ANVIL_ACCOUNT_0_PK" \
    --utility-private-key "$ALTO_UTILITY_PK" \
    --rpc-url http://127.0.0.1:8545 \
    --port 4337 \
    --safe-mode false \
    --min-entity-stake 0 \
    --min-entity-unstake-delay 0 \
    --max-block-range 100 \
    --enable-cors true \
    --enable-debug-endpoints true \
    --utility-wallet-monitor false \
    --refilling-wallets false \
    --log-level warn
) >"$ALTO_LOG" 2>&1 &
echo $! >"$ALTO_PID_FILE"
wait_for_rpc "http://127.0.0.1:4337" "eth_supportedEntryPoints" "$ALTO_LOG"

echo "→ resetting and deploying local P2Pix contracts"
cat >"$SC_DIR/deploys/localhost.json" <<'JSON'
{
  "signers": [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  ],
  "p2pix": "",
  "token": ""
}
JSON
(cd "$SC_DIR" && bun run deploy1:localhost)
(cd "$SC_DIR" && bun run deploy2:localhost)

TOKEN_ADDR="$(node -e "console.log(require('$SC_DIR/deploys/localhost.json').token)")"
P2PIX_ADDR="$(node -e "console.log(require('$SC_DIR/deploys/localhost.json').p2pix)")"
if [[ -z "$TOKEN_ADDR" || -z "$P2PIX_ADDR" ]]; then
  echo "✗ deploy did not write token/P2Pix addresses" >&2
  exit 1
fi
[[ -f "$ENV_FILE" ]] || {
  echo "✗ $ENV_FILE missing — create it from the project template" >&2
  exit 1
}

sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed_inplace -E "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

echo "→ wiring .env.local to Kernel/Alto"
upsert_env VITE_LOCAL_TOKEN_ADDRESS "$TOKEN_ADDR"
upsert_env VITE_LOCAL_P2PIX_ADDRESS "$P2PIX_ADDR"
upsert_env VITE_LOCAL_RPC_URL "http://127.0.0.1:8545"
upsert_env VITE_BUNDLER_URL "http://127.0.0.1:4337"
if grep -q '^VITE_PASSKEY_RP_ID=[[:space:]]*$' "$ENV_FILE"; then
  upsert_env VITE_PASSKEY_RP_ID "localhost"
fi

echo "→ generating wagmi ABIs"
(cd "$ROOT" && bun run wagmi:gen)

cat <<INFO

ℹ  Local AA is Kernel v0.3.1 + EntryPoint 0.7:
   Anvil RPC:  http://127.0.0.1:8545 (chainId 31337, Sepolia state fork)
   Alto RPC:   http://127.0.0.1:4337
   EntryPoint: $ENTRYPOINT07

   The app dev-funds only the active counterfactual Kernel account through
   Anvil's local RPC. No verifying paymaster or Exactly-mode contract is used.

INFO

echo "→ starting front-end on http://localhost:3000"
(cd "$ROOT" && bun start)
