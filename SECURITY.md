# Security Policy

## Reporting a vulnerability

Report security issues **privately** — do not open public issues or PRs for them. Include: a description, the affected component, steps to reproduce, and the impact. We aim to acknowledge ASAP and agree on a fix and coordinated-disclosure timeline with you.

## Scope

- This front-end (`P2Pix-Front-End`).
- The P2Pix smart contracts (see the `p2pix-smart-contracts` submodule).
- The P2Pix oracle (`api.p2pix.co`).

## Trusted parties and what they see

P2Pix is self-custodial for signing, but releasing an escrow relies on third-party infrastructure. Each party is listed plainly below, with no silent trust: what it is, what it sees or can block, and how to escape it. Treat every endpoint as a potential metadata leak (per `DESIGN.md`) — each receives at least your IP and origin, and the chain ones also your addresses and queries. All requests come from **first-party** code in this front-end.

### Reown AppKit, doiim fork (`@doiim/reown-appkit*`)

- **What it is:** wallet connection, passkey and email/social login, built on the WalletConnect relay.
- **What it sees or can block:** relays connections; loads cloud feature flags and wallet/asset images on page load.
- **Escape path:** use an injected or passkey signer; self-host the relay and cloud endpoints, or build without AppKit.

### WalletConnect relay (`wss://relay.walletconnect.com`, …)

- **What it is:** transport for WalletConnect sessions.
- **What it sees or can block:** your IP and session topic.
- **Escape path:** self-host a relay or use an injected wallet.

### Reown AUTH email/social login (Reown-managed signer)

- **What it is:** email/social login lowers onboarding friction; the smart account is owned by a Reown-managed key.
- **What it sees or can block:** Reown, not you, controls the login key.
- **Escape path:** `/sweep` drains the smart account to any address (needs BRZ for gas); the key itself cannot be exported.

### Alchemy RPC + The Graph (reads)

- **What it is:** the read layer — RPC and indexed events, read only through the endpoints the app configures.
- **What it sees or can block:** your addresses, read requests and query parameters. Reads go to the configured RPCs in `src/config/networks.ts` (Alchemy) and the per-network subgraphs — Alchemy and The Graph are what still observe read metadata; with `reownRpcFallback: false` they never fall through to Reown's Blockchain API (`rpc.walletconnect.org`).
- **Escape path:** point the app at a different RPC provider or your own user-configurable endpoints, and at your own subgraph — a config change and rebuild.

### Pimlico bundler + paymaster (ERC-4337)

- **What it is:** gas sponsorship / ERC-20 paymaster that improves UX for the smart-account rail (non-custodial), called when a user sends a UserOp or requests a paymaster quote.
- **What it sees or can block:** the relayer observes UserOp traffic, sender address and fee-token balances.
- **Escape path:** any alternative ERC-4337 bundler/paymaster can relay the UserOp.

### P2Pix oracle + BB Pay

- **What it is:** bridges off-chain Pix settlement to onchain release.
- **What it sees or can block:** fiat transits P2Pix's BB Pay account for the settlement window before BB settles it to the seller's registered account — a custody deviation, not self-custody. Releasing escrowed funds is gated on a P2Pix-signed attestation — the single trusted signer we have not yet removed. If it is unavailable trades halt.
- **Escape path:** none today (an open gap — see Design-baseline compliance). Two routes end release's dependence on the P2Pix oracle: a **Bacen-issued attestation** — the primary plan, tracked as an open upstream request at [bacen/pix-api#61](https://github.com/bacen/pix-api/issues/61) — or **zkPix** (zkTLS), the fallback.

## Design-baseline compliance

✅ met · ⚠️ partial or unverified · ❌ open gap. Ratings follow the shipped behavior in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the entries above; they are updated on every release, and a ⚠️ stays ⚠️ until `ARCHITECTURE.md` substantiates the item.

| Baseline item (from `DESIGN.md`) | Status | Evidence / open gap |
| --- | --- | --- |
| Self-custody everywhere | ✅ | Signing is client-side on both rails (`ARCHITECTURE.md` §2); no backend key custody. Crypto escrow is non-custodial; fiat transits P2Pix's BB Pay account during settlement — a named custody deviation, see the oracle entry. |
| No centralized relay / session node | ⚠️ | WalletConnect relay is the default connection hub, and email/social login uses a Reown-managed signer; injected wallets and passkeys avoid both. |
| Zero telemetry endpoints | ✅ | The app ships no analytics; the AppKit fork removes Reown's analytics pipeline and stubs Coinbase telemetry (`ARCHITECTURE.md` §1). |
| Open standards + readable artifacts | ⚠️ | This front-end is public under MIT; the release oracle (`api.p2pix.co`) is closed. |
| License commitment | ✅ | MIT here (permissive, accepted); no source-available component in this front-end. A no-relicense pledge is not yet recorded. |
| Verifiable data layer | ❌ | Reads are single-source per concern (Alchemy RPC, The Graph); no light client or deterministic replay. |
| Content-hash distribution + ENS anchoring | ⚠️ | IPFS pin + IPNS anchored by a DNS TXT record; ENS and a `.onion` mirror are not shipped. |
| Structural metadata hardening | ⚠️ | Not substantiated in `ARCHITECTURE.md`; AppKit contacts cloud feature-flag and wallet/asset-image endpoints on load. |
| Reproducible, signed releases | ❌ | Rebuilding a tag to its recorded CID is an open gap (`ARCHITECTURE.md` §6); releases are not signed. |
| Explicit privacy boundaries | ✅ | Metadata-only guarantee; on-chain content is public (`DESIGN.md` §C.5). |
| Signing safety | ⚠️ | Exact-amount approvals, chainId checks and wallet-visible actions; no EIP-4361 (no off-chain auth) and no documented tx simulation. |
| Read-path metadata hygiene | ❌ | Reads go through the configured shared RPC/indexer endpoints (Alchemy, The Graph) with no user-configurable option in the shipped app; Reown's Blockchain API is no longer a read provider (`reownRpcFallback: false`). |
| Zero option | ❌ | Contract writes are callable directly (✓), but escrow release has no intermediary-free path today; the Bacen ask ([bacen/pix-api#61](https://github.com/bacen/pix-api/issues/61)) is the primary route to one. |
| User-controlled defenses | ✅ | No default blocklists, venue steering, or opaque AI in the shipped app. |
| Cross-layer review | ✅ | No documented relocation of a chokepoint between layers. |
| Two-pillar review before ship | ⚠️ | This document is the record; there is no automated CI gate yet. |
| Walkaway test | ❌ | Release halts if the P2Pix oracle is unavailable, and deploy/rebuild depends on our CI, DNS, and manual CID notes. |
| Subtraction / no team lock-in | ⚠️ | Deploy pipeline and oracle are team-run; handoff paths are not yet documented. |
| Deviation-by-consent | ✅ | Every deviation is listed here with its escape path. |

## Safe harbor

Good-faith research that does not harm users or break the law is welcome. We will not pursue action against researchers who follow this policy.
