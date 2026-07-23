<p align="center">
  <img src="./src/assets/colored_logo.svg" alt="Logo P2Pix" width="40%"/>
</p>
<br />

This application aims to create a democratic and secure solution for the purchase and sale of ERC20 tokens, through the PIX, integrating the functionalities of smart contracts (smart contracts) of the blockchain with a receipt by digital signature. Allowing the integration of national financial system transactions to public blockchains, dispensing with custody through intermediaries.

# Table of Contents

- [Metamask Tutorial](#metamask-tutorial)
- [Recommended IDE Setup](#recommended-ide-setup)
- [Dependencies](#dependencies)
- [Build Setup](#build-setup)
- [Local development with passkeys](#local-development-with-passkeys)
- [Reown AppKit (doiim fork)](#reown-appkit-doiim-fork)

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
   1. Run `Extensions: Show Built-in Extensions` from VSCode's command palette
   2. Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

### Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Dependencies

### API + RPC

Copy `.env.example` to `.env` and set the per-network variables:

| Var                                                                                  | Purpose                                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `VITE_APP_API_URL`                                                                   | zkPix middleware base URL (default `http://localhost:3001`) |
| `VITE_SEPOLIA_API_URL`, `VITE_MAINNET_API_URL`, `VITE_RSK_API_URL`                   | RPC endpoints per network (Alchemy, Infura, public RPC)     |
| `VITE_SEPOLIA_TOKEN_ADDRESS`, `VITE_MAINNET_TOKEN_ADDRESS`, `VITE_RSK_TOKEN_ADDRESS` | BRZ token address per network                               |
| `VITE_SEPOLIA_SUBGRAPH_URL`, `VITE_MAINNET_SUBGRAPH_URL`, `VITE_RSK_SUBGRAPH_URL`    | The Graph subgraph endpoints                                |

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

All AA owners use Kernel v0.3.1 and EntryPoint 0.7. Passkeys use a WebAuthn
owner; Reown AUTH is first migrated to an EOA and then wrapped as a Kernel
owner. There is no Exactly-mode or EntryPoint 0.6 rail.

### Prerequisites

| Tool                                                | Why                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [bun](https://bun.sh)                               | Installs the app and launches Alto                                                                                                                                   |
| [foundry](https://getfoundry.sh) (`anvil` + `cast`) | Local Sepolia state fork and contract checks                                                                                                                         |
| Sepolia RPC                                         | Supplies the canonical EntryPoint/Kernel deployments. Set `LOCAL_FORK_RPC_URL`, `VITE_SEPOLIA_API_URL`, or `ALCHEMY_API_KEY`; otherwise the script uses a public RPC |

### Running

```sh
# Set VITE_REOWN_PROJECT_ID in .env.local first.
cp .env.example .env.local

./scripts/dev-local.sh
```

The script starts Anvil at `:8545`, verifies the canonical EntryPoint and
Kernel contracts, starts `@pimlico/alto@0.0.20` at `:4337`, deploys P2Pix,
updates the local P2Pix/RPC/bundler variables, regenerates ABIs and starts
Vite. Ctrl-C stops all three processes.

Local UserOperations have no paymaster. The app uses Anvil's development RPC
to fund only the active counterfactual Kernel account before submission.
Production never takes that path.

### Sponsorship gate

Production first-lock sponsorship is fail-closed:

1. the backend grants an exact order and returns `authorizationId`;
2. the client calls `pm_sponsorUserOperation`, sends that ID as paymaster
   metadata and appends a tagged digest to Kernel `callData`;
3. the Pimlico sponsorship-policy webhook receives the UserOperation, decodes
   the exact P2Pix call and atomically consumes the matching grant.

The branch is not production-ready until the backend ledger and Pimlico
webhook are deployed and enabled. A browser-only `sponsorshipPolicyId` is not
an authorization boundary.

### Backend Communication

Backend Repo: `https://gitea.kosmos.org/hueso/helpix`

Backend Endpoint: `https://api.p2pix.co/release/1279331`

## Reown AppKit (doiim fork)

This project consumes the published `@doiim/reown-appkit*` packages from npm.
The fork source lives at
<https://git.p2pix.co/doiim/reown-fork-appkit>; it is not a submodule here.

### Why a fork

The fork ships features the upstream Reown lacks:

| Customization                                | Effect on the connect modal                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `connectMethodsOrder: ['passkey', …]`        | Adds `'passkey'` as a first-class CTA at the top                                                                          |
| `allWalletsPosition: 'top'`                  | "Search Wallet 140+" rendered above the wallet list                                                                       |
| `excludeWalletNames: ['Brave Wallet']`       | Hides wallets by display name (Brave injects via EIP-6963 with no stable id)                                              |
| `@reown/appkit/passkey` subpath export       | Framework-agnostic WebAuthn primitives — no `@simplewebauthn/browser` dependency                                          |
| Modal `:host { position: fixed !important }` | Survives consumer stylesheets that apply `* { position: relative }`                                                       |
| `applyDoiimDefaults()`                       | Bakes opinionated modal defaults (passkey first, no Binance, light theme, analytics off) into every `createAppKit()` call |

User options passed to `createAppKit()` always win — defaults are a floor, not
a ceiling.

When the fork changes, publish a new `@doiim/*` version, bump the direct
versions and matching transitive `overrides` in `package.json`, then regenerate
`bun.lock`. Keeping those versions aligned prevents upstream `@reown/*`
packages from being mixed into the fork's dependency graph.
