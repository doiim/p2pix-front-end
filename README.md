<p align="center">
  <img src="./src/assets/colored_logo.svg" alt="Logo P2Pix" width="40%"/>
</p>
<br />

This application aims to create a democratic and secure solution for the purchase and sale of ERC20 tokens, through the PIX, integrating the functionalities of smart contracts (smart contracts) of the blockchain with a receipt by digital signature. Allowing the integration of national financial system transactions to public blockchains, dispensing with custody through intermediaries.

# Table of Contents
* [Metamask Tutorial](#metamask-tutorial)
* [Recommended IDE Setup](#recommended-ide-setup)
* [Dependencies](#dependencies)
* [Build Setup](#build-setup)
* [Local development with passkeys](#local-development-with-passkeys)
* [Reown AppKit (doiim fork)](#reown-appkit-doiim-fork)
## Metamask Tutorial
### Installation

Install the Metamask extension at https://metamask.io/download/

### Enable Testnets on Metamask

Go to Settings -> Advanced -> Show Testnets

Now you can select the Goerli testnet.

### Add Polygon Mumbai to your Metamask

To add the Mumbai network, follow the instructions at:
https://www.youtube.com/watch?v=Jegmru0Q0j4

### Import the MBRL token

Go to Import Tokens and paste the following address: `0x294003F602c321627152c6b7DED3EAb5bEa853Ee`

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

### Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

### Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).


## Dependencies

### API + RPC

Copy `.env.example` to `.env` and set the per-network variables:

| Var | Purpose |
|---|---|
| `VITE_APP_API_URL` | zkPix middleware base URL (default `http://localhost:3001`) |
| `VITE_SEPOLIA_API_URL`, `VITE_MAINNET_API_URL`, `VITE_RSK_API_URL` | RPC endpoints per network (Alchemy, Infura, public RPC) |
| `VITE_SEPOLIA_TOKEN_ADDRESS`, `VITE_MAINNET_TOKEN_ADDRESS`, `VITE_RSK_TOKEN_ADDRESS` | BRZ token address per network |
| `VITE_SEPOLIA_SUBGRAPH_URL`, `VITE_MAINNET_SUBGRAPH_URL`, `VITE_RSK_SUBGRAPH_URL` | The Graph subgraph endpoints |

## Build Setup

The application can be tested by its trial version [https://p2pix-staging.vercel.app/](https://p2pix-staging.vercel.app/), the only requirement is to be running the smart contract of local way. To run the application locally, there are two different ways:

### Run with bun

```sh
# Pull the smart-contracts submodule (skip if you cloned with --recurse-submodules)
git submodule update --init

# Install front-end dependencies
bun install

# One-time bootstrap of the smart-contracts submodule (needed before wagmi:gen)
cd p2pix-smart-contracts && bun install && cd ..

# Generate ABI bindings from the submodule (run again whenever contracts change)
bun run wagmi:gen

# Type-Check, Compile and Minify for Production
bun run build

# Compile and Hot-Reload for Development (port 3000)
bun start

# Lint with [ESLint](https://eslint.org/)
bun run lint
```
### Run with docker-compose

```sh
# Pull the smart-contracts submodule (skip if you cloned with --recurse-submodules)
git submodule update --init

#1. Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/);
#2. Install [Docker Compose](https://docs.docker.com/compose/install/).

docker-compose up
```

## Local development with passkeys

For testing the **"Continue with Passkey"** flow against a local chain, use
`scripts/dev-local.sh`. It boots an anvil node, deploys the P2Pix contracts
(via the `p2pix-smart-contracts` submodule) **and** the ERC-4337 stack
(EntryPoint v0.6, Exactly's `WebauthnOwnerPlugin`, and the modular-account
factory — via the `vendor/erc-4337` submodule), then writes the deployed
addresses into `.env.local` before starting the front-end.

### Prerequisites

| Tool | Why |
|---|---|
| [bun](https://bun.sh) | Front-end install + run |
| [foundry](https://getfoundry.sh) (`forge` + `anvil`) | Local node + ERC-4337 deploy. The script aborts if `anvil` is missing and skips the 4337 stack (with a warning) if `forge` is missing |

`anvil` is used instead of `hardhat node` so the modular-account contracts
(~34KB, above EIP-170) can be deployed via `--disable-code-size-limit`.
P2Pix's hardhat-based deploy scripts still work because they target
`http://127.0.0.1:8545` via the `localhost` network in
`p2pix-smart-contracts/hardhat.config.ts`.

### Running

```sh
# Once: copy the env template and set VITE_REOWN_PROJECT_ID (https://cloud.reown.com).
cp .env.example .env.local   # or edit the existing .env.local

./scripts/dev-local.sh
```

What the script does, end-to-end:

1. Initialises any missing submodule (recursive — `vendor/erc-4337` has nested
   foundry libs).
2. Installs front-end deps (`bun install`) and smart-contract deps if needed.
3. Starts anvil in the background on `127.0.0.1:8545`, chainId `31337`,
   logging to `.anvil-node.log` (PID in `.anvil-node.pid`, both gitignored).
4. Deploys the P2Pix mock token, P2PIX, reputation and multicall contracts.
5. Deploys the ERC-4337 stack (`EntryPoint`, `UpgradeableModularAccount`,
   `WebauthnOwnerPlugin`, `WebauthnModularAccountFactory`). Addresses are
   written to `vendor/erc-4337/deployments/local.env`.
6. Patches `.env.local` with the deployed addresses:
   - `VITE_LOCAL_TOKEN_ADDRESS`, `VITE_LOCAL_P2PIX_ADDRESS`
   - `VITE_WEBAUTHN_PLUGIN_ADDRESS`, `VITE_WEBAUTHN_FACTORY_ADDRESS`,
     `VITE_ENTRYPOINT_ADDRESS` (from the 4337 deploy)
   - `VITE_PASSKEY_RP_ID=localhost` (only if currently empty)
7. Regenerates wagmi ABIs and starts the Vite dev server on
   `http://localhost:3000`. Ctrl-C stops both the front-end and anvil.

`LOCAL_FORK=1 ./scripts/dev-local.sh` forks Sepolia state into anvil instead
of running clean (needs `ALCHEMY_API_KEY` exported or set in
`p2pix-smart-contracts/.env`).

### Account modes (`VITE_ACCOUNT_KIND`)

The passkey connector supports two smart-account backends, controlled by
`VITE_ACCOUNT_KIND` (defaults to `exactly-mode` if unset):

| Mode | `VITE_ACCOUNT_KIND` | Smart-account contract | Needs local deploy? | Env vars required |
|---|---|---|---|---|
| **exactly-mode** (default) | unset or `exactly-mode` | Exactly's `WebauthnModularAccountFactory` / `WebauthnOwnerPlugin` (ERC-6900) | Yes — no public deployment exists, `dev-local.sh` deploys it locally | `VITE_WEBAUTHN_PLUGIN_ADDRESS`, `VITE_WEBAUTHN_FACTORY_ADDRESS`, `VITE_ENTRYPOINT_ADDRESS`, plus a bundler (`VITE_PIMLICO_API_KEY` or `VITE_BUNDLER_URL`) |
| **kernel** | `kernel` | ZeroDev's Kernel v0.3.1 (ERC-4337), deployed via CREATE2 on every chain already | No | Only a bundler (`VITE_PIMLICO_API_KEY` or `VITE_BUNDLER_URL`); `VITE_ENTRYPOINT_ADDRESS` is optional (defaults to the canonical EntryPoint v0.7) |

Use `kernel` if you only have a Pimlico API key and don't want to run
`dev-local.sh` to deploy the custom plugin/factory stack — it trades away the
recovery-owner management feature (`owners.ts`, exactly-mode only) for
zero-deployment setup. Sweep/recovery-by-signature works in both modes.

> **CI/CD demo build:** `.github/workflows/deploy.yml` (runs on Gitea Actions)
> builds with `VITE_ACCOUNT_KIND=kernel` and `VITE_PIMLICO_API_KEY` sourced
> from the `VITE_PIMLICO_API_KEY` repo secret — the demo has no live
> `exactly-mode` deployment, so it always runs kernel mode against Pimlico.
> `VITE_PASSKEY_RP_ID` is intentionally left unset there: the connector falls
> back to `window.location.hostname` at runtime, which is correct since the
> same build gets served from multiple targets (rsync, IPFS, Pinata).

### Bundler routing

The passkey connector picks the bundler at connect-time:

| Setting | Bundler used |
|---|---|
| `VITE_BUNDLER_URL` set (any value) | That URL, verbatim |
| chainId is `31337` and `VITE_PIMLICO_API_KEY` empty | **Local self-bundler**: a custom viem transport baked into the fork submits `EntryPoint.handleOps([userOp], beneficiary)` directly from anvil's account[0]. No external service needed. |
| chainId is `31337` and `VITE_PIMLICO_API_KEY` set | Pimlico (overrides local) |
| chainId ≠ `31337` and `VITE_PIMLICO_API_KEY` set | Pimlico HTTP at `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${key}` |
| chainId ≠ `31337` and `VITE_PIMLICO_API_KEY` empty | Throws — bundler not configured |

Get a Pimlico key from <https://dashboard.pimlico.io>. For local dev you
don't need one — the self-bundler is enough to relay passkey UserOps end-to-end
against the deployed local EntryPoint. If you'd prefer a "real" local bundler,
the `vendor/erc-4337/docker-compose.yml` has an
[alto](https://github.com/pimlico-labs/alto) service ready to run; point
`VITE_BUNDLER_URL` at it.

### Required env vars for the full passkey flow

| Var | Used for | Auto-set by `dev-local.sh`? |
|---|---|---|
| `VITE_REOWN_PROJECT_ID` | Wallet modal | No — get one at https://cloud.reown.com |
| `VITE_ACCOUNT_KIND` | Selects `exactly-mode` (default) or `kernel` — see [Account modes](#account-modes-vite_account_kind) | No |
| `VITE_PASSKEY_RP_ID` | WebAuthn relying party | Yes (`localhost`) — only if currently empty |
| `VITE_WEBAUTHN_PLUGIN_ADDRESS` | Plugin source-of-truth (exactly-mode only) | Yes |
| `VITE_WEBAUTHN_FACTORY_ADDRESS` | Counterfactual address derivation via `factory.getAddress()` (exactly-mode only) | Yes |
| `VITE_ENTRYPOINT_ADDRESS` | UserOp hashing + handleOps target (required for exactly-mode; optional for kernel) | Yes |
| `VITE_PIMLICO_API_KEY` | Pimlico bundler (sepolia/mainnet) | No — get one at https://dashboard.pimlico.io |
| `VITE_BUNDLER_URL` | Override for any of the above | No |

### What the script does **not** do

- Add the local network to MetaMask. Add it manually:
  RPC `http://127.0.0.1:8545`, chainId `31337`. The front-end exposes it as
  "Anvil (Local)" once `VITE_LOCAL_P2PIX_ADDRESS` is set.

### Backend Communication

Backend Repo: `https://gitea.kosmos.org/hueso/helpix`

Backend Endpoint: `https://api.p2pix.co/release/1279331`

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {api-key}" \
  -d '{"query": "{ depositAddeds { id seller token amount } }"}' \
https://api.studio.thegraph.com/query/113713/p-2-pix/sepolia

https://api.studio.thegraph.com/query/113713/p-2-pix/1

curl --request POST --url 'https://api.hm.bb.com.br/testes-portal-desenvolvedor/v1/boletos-pix/pagar?gw-app-key=95cad3f03fd9013a9d15005056825665' --header 'content-type: application/json' --data '{"pix":"00020101021226070503***63041654" }'

## Reown AppKit (doiim fork)

This project does **not** consume `@reown/appkit` from npm. It depends on the
**doiim fork** at <https://git.p2pix.co/doiim/reown-fork-appkit> (branch
`doiim/customizations`), wired in as a git submodule at `vendor/reown-appkit/`.
`package.json` points the `@reown/*` deps at the pre-built tarballs in
`vendor/reown-appkit/.pack/*.tgz` via `file:` resolution.

### Why a fork

The fork ships features the upstream Reown lacks:

| Customization | Effect on the connect modal |
|---|---|
| `connectMethodsOrder: ['passkey', …]` | Adds `'passkey'` as a first-class CTA at the top |
| `allWalletsPosition: 'top'` | "Search Wallet 140+" rendered above the wallet list |
| `excludeWalletNames: ['Brave Wallet']` | Hides wallets by display name (Brave injects via EIP-6963 with no stable id) |
| `@reown/appkit/passkey` subpath export | Framework-agnostic WebAuthn primitives — no `@simplewebauthn/browser` dependency |
| Modal `:host { position: fixed !important }` | Survives consumer stylesheets that apply `* { position: relative }` |
| `applyDoiimDefaults()` | Bakes opinionated modal defaults (passkey first, no Binance, light theme, analytics off) into every `createAppKit()` call |

User options passed to `createAppKit()` always win — defaults are a floor, not
a ceiling.

### Workflow: editing the fork

When you need to change something inside `vendor/reown-appkit/`:

```sh
# 1. Enter the submodule and create / switch to the working branch.
cd vendor/reown-appkit
git checkout doiim/customizations

# 2. Make changes (e.g. a new createAppKit default, a modal style tweak,
#    a UI string). Source lives under packages/<pkg>/src.

# 3. Rebuild + repack tarballs so the consumer can pick them up.
pnpm install                       # only needed the first time / after deps change
bash scripts/build-and-pack.sh     # outputs to vendor/reown-appkit/.pack/

# 4. Commit the source AND the regenerated .pack/*.tgz together — they
#    must move in lockstep so a fresh `git submodule update --init` in
#    a downstream clone gives a buildable state.
git add -A
git commit -m "feat(<pkg>): <summary>"
git push origin doiim/customizations

# 5. Bump the submodule pointer in this repo and reinstall.
cd ../..
git add vendor/reown-appkit
rm -rf node_modules ~/.bun/install/cache && rm bun.lock
bun install
```

> **Cache gotcha.** Bun content-addresses `file:` tarballs by lockfile hash.
> Re-running `bun install` after rebuilding the fork *without* clearing
> `bun.lock` and `~/.bun/install/cache` will silently reuse the previous
> tarball. The `rm -rf` step in #5 is mandatory whenever the fork's tarballs
> change but the version (`1.8.19`) doesn't.

### Workflow: rebasing onto upstream

The fork's `main` tracks upstream Reown. To pull upstream changes:

```sh
cd vendor/reown-appkit
git fetch origin
git checkout doiim/customizations
git rebase origin/main             # resolve conflicts in fork-only files
bash scripts/build-and-pack.sh     # rebuild
git add -A && git commit --amend --no-edit
git push --force-with-lease origin doiim/customizations
```

See `vendor/reown-appkit/README.md` for the full rebase recipe.

### Where the doiim-specific code lives

| Path inside `vendor/reown-appkit/` | What's there |
|---|---|
| `packages/appkit/src/utils/DoiimDefaults.ts` | `applyDoiimDefaults()` merger |
| `packages/appkit/exports/{vue,react,core,vue-core,react-core,index}.ts` | `createAppKit()` calls the merger |
| `packages/appkit/src/utils/PasskeyUtil.ts` | Framework-agnostic WebAuthn primitives |
| `packages/scaffold-ui/src/views/w3m-connect-view/` | `'passkey'` rendered as primary CTA |
| `packages/scaffold-ui/src/utils/ConnectorUtil.ts` | `excludeWalletNames` + passkey routing |
| `packages/scaffold-ui/src/modal/w3m-modal/styles.ts` | `:host { position: fixed !important }` |
| `packages/controllers/src/utils/PresetsUtil.ts` | Connector-icon mapping for `'passkey'` |
| `scripts/build-and-pack.sh` | Build orchestrator (pnpm → tsc → tarball) |