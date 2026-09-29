<p align="center">
  <img src="./src/assets/colored_logo.svg" alt="Logo P2Pix" width="40%"/>
</p>
<br />

This application aims to create a democratic and secure solution for the purchase and sale of ERC20 tokens, through the PIX, integrating the functionalities of smart contracts (smart contracts) of the blockchain with a receipt by digital signature. Allowing the integration of national financial system transactions to public blockchains, dispensing with custody through intermediaries.

# Design, security & trust

P2Pix is a **self-custody** dApp: for injected-EOA and WebAuthn passkey wallets, keys and signing stay on your device. Email/social login (Reown AUTH) is the exception — it uses a Reown-managed signer, not self-custody (see Trusted parties below). Because releasing an escrow still relies on several **trusted third parties**, each one is listed plainly in [Trusted parties & attestation](#trusted-parties--attestation) and in [`SECURITY.md`](./SECURITY.md); a trust-minimized version is in active development — see [Roadmap: trust minimization](#roadmap-trust-minimization).

# Table of Contents

- [Design, security & trust](#design-security--trust)
- [Recommended IDE Setup](#recommended-ide-setup)
- [Dependencies](#dependencies)
- [Build Setup](#build-setup)
- [Trusted parties & attestation](#trusted-parties--attestation)
- [Roadmap: trust minimization](#roadmap-trust-minimization)

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

### Environment variables

Create a `.env` file with the three variables the build reads:

| Var | Purpose |
| --- | --- |
| `VITE_APP_ENV` | `production` selects Ethereum mainnet + Arbitrum One and the production oracle (`api.p2pix.co`); any other value selects Sepolia and the demo hosts |
| `VITE_REOWN_PROJECT_ID` | Reown AppKit project id (required; the app throws at startup without it) |
| `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` | Pimlico sponsorship policy; enables the smart-account rail and therefore passkey login |

RPC, bundler and subgraph URLs and token addresses are set in `src/config/networks.ts` (see [`ARCHITECTURE.md`](./ARCHITECTURE.md)); contract addresses — and which networks are listed at all — come from the smart-contracts submodule's `deploys/*.json`, so an un-deployed network is not offered.

## Build Setup

The application is built and distributed by our CI/CD pipeline; a staging build is served from our self-hosted server and also pinned to IPFS with an IPNS pointer. To run the application locally:

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

### Versioning

Release flow:

```sh
git tag -a 0.x.y -m "Release version x.y.z"      # tag the release commit
bun run build                                      # build dist/
ipfs add -r dist                                   # pin build, get CID
git notes --ref=ipfs add -m "<cid>" x.y.z         # record CID as deploy metadata (no tag rewrite)
git push origin 0.x.y refs/notes/ipfs:refs/notes/ipfs
```

The CID is recorded per tag: anyone can check that the build they loaded matches the note. CIDs live in `git notes --ref=ipfs` — never in the repo or the tag message — so history stays clean and a wrong CID is fixed with `git notes --ref=ipfs add -f` (no force-push of tags). The Versions page derives its list from `git tag` and links each release to IPFS.

## Trusted parties & attestation

P2Pix is self-custodial for signing on injected-EOA and WebAuthn passkey wallets, but releasing an escrow still depends on infrastructure run by third parties (Reown AUTH email/social login is a Reown-managed signer, not you). We disclose every one of these plainly, with no silent trust:

- **What we rely on, and your escape paths** — [`SECURITY.md`](./SECURITY.md).
- **The design principles behind these tradeoffs** — [`DESIGN.md`](./DESIGN.md).
- **How the oracle, zkPix, and the rest of the stack actually work** — [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Roadmap: trust minimization

PIX is **fiat** settlement, so _some_ trust is structurally unavoidable. Two routes end release's dependence on the P2Pix oracle:

- **Bacen-issued attestation** — the primary plan: Banco Central signs the Pix confirmation itself. This is an open upstream request, [bacen/pix-api#61](https://github.com/bacen/pix-api/issues/61), and the deployed contracts already accept it once Bacen's signer is added on-chain.
- **zkPix (zkTLS)** — the fallback: a cryptographic proof of the bank's own confirmation, rather than blind trust in a P2Pix key.
