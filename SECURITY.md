# Security Policy

## Reporting a vulnerability

Report security issues **privately** — do not open public issues or PRs for them. Include: a description, the affected component, steps to reproduce, and the impact. We aim to acknowledge ASAP and agree on a fix and coordinated-disclosure timeline with you.

## Scope

- This front-end (`P2Pix-Front-End`).
- The P2Pix smart contracts (see the `p2pix-smart-contracts` submodule).
- The P2Pix prover (`api.p2pix.co`).

## Trust we rely on

P2Pix is self-custodial for signing on injected and WalletConnect EOAs and WebAuthn passkey wallets, but releasing an escrow relies on infrastructure run by third parties. We disclose each one here plainly, with no silent trust.

- **Reown AppKit, doiim fork (`@doiim/reown-appkit*`), over the WalletConnect relay**
  - _Rationale:_ Broad wallet compatibility plus passkey and email/social login; passkey & injected EOA still sign locally.
  - _Disclosure:_ Connection relays through WalletConnect; signing stays on your device. AppKit also contacts Reown's cloud and the WalletConnect relay on page load — see [Outbound network requests](#outbound-network-requests-what-the-app-phones-home-to). The fork removes Reown's analytics pipeline and stubs Coinbase telemetry.
  - _Escape path:_ Injected & passkey signers need no relay; a user can self-host a WalletConnect relay or use a direct EIP-1193 wallet. Reown's Vue composables are re-exported under neutral names in `src/config/appkit.ts` (a few modules still import AppKit directly), so an injected-only build without AppKit (with optional self-hosted passkey login) is a code-level escape path.

- **Reown AUTH email/social login is a Reown-managed signer**
  - _Rationale:_ Lowers fiat-onboarding friction; the Kernel account is owned by the Reown-managed EOA signer.
  - _Disclosure:_ Email/social login keys are managed by Reown, not you.
  - _Escape path:_ `/sweep` drains the smart account's ETH and BRZ to any address (needs BRZ for gas); exporting the Reown-managed key itself is not documented.

- **Primus attestors sign the proof of Pix payment; the P2Pix prover (`api.p2pix.co`) produces it**
  - _Rationale:_ Bridges off-chain Pix settlement to on-chain release with the bank's own confirmation, replayed through zkTLS, in place of a key P2Pix holds.
  - _Disclosure:_ Release of escrowed funds is gated on an attestation signed by a Primus network attestor: a node on Primus's whitelist, run in a TEE, with no slashing today. The contract accepts the attestors in `validAttestors`, a set the owner edits (add and remove) and anyone can read; an attestor that colludes with the prover can forge a proof, so the attestor set is the forgeable point. The prover holds the BB Pay credentials: the attested request carries its mTLS client certificate and a read-only OAuth token, which the attestor's TEE sees. The charge is tied to P2Pix's convênio through the convênio query in the attested URL, which the attestor signs verbatim. If the prover is unavailable, in-flight trades stall: release is possible only until the lock expires, after which the escrow returns to the seller's deposit and a buyer who already paid the Pix has no on-chain recovery. The buyer's Pix is paid into P2Pix's BB Pay account and BB settles it to the seller's registered account automatically in the same flow, so P2Pix holds the fiat only transiently; the convênio holder can refund a paid charge after release, so fiat custody stays with P2Pix. The charge's split (all of it to the seller) is set by the prover at creation and is not attested; the seller's fiat depends on P2Pix's charge creation as it already does on its refund power. The proof, once submitted, is public on the P2Pix chain and in the Primus task record on Base Sepolia: the charge's number, amount, Pix `txId`, participant number and lock id.
  - _Escape path:_ Compare `validAttestors` with Primus's node registry. An alternate release path (prover walkaway) is an open gap — see [Known open gaps](#known-open-gaps).

- **Pimlico bundler + paymaster (ERC-4337 infrastructure)**
  - _Rationale:_ Gas sponsorship / ERC-20 paymaster improves UX; non-custodial.
  - _Disclosure:_ The relayer observes transaction traffic.
  - _Escape path:_ Any ERC-4337 bundler can relay the UserOp; the endpoint is a literal in `src/config/networks.ts`, so routing around Pimlico requires editing it and rebuilding (UI switch is an open gap).

- **Reown Blockchain API / Alchemy RPC + The Graph subgraph for reads**
  - _Rationale:_ Convenience; the chain, not the indexer, is the point of truth.
  - _Disclosure:_ On every configured chain the AppKit adapter routes JSON-RPC reads to Reown's Blockchain API (`rpc.walletconnect.org`); the Alchemy URLs in `src/config/networks.ts` are used only by the passkey connector's inline client. RPC and subgraph URLs are fixed in that file; changing them requires a rebuild. The subgraph is an index, not authoritative.
  - _Escape path:_ Pass `customRpcUrls`/`transports` to `WagmiAdapter` and rebuild to put another RPC first (Reown's API stays as a fallback; a UI switch is an open gap); the chain is authoritative — primary source is always on-chain.

- **Vite + Vue SPA, not static HTML**
  - _Rationale:_ Rich client UX (passkeys, AA, live reads).
  - _Disclosure:_ This is a JS-heavy client; tagged releases have their CID recorded in `git notes --ref=ipfs`, branch builds do not.
  - _Escape path:_ Tagged releases are pinned to an IPFS CID (see ARCHITECTURE.md); a user can build from source and self-host, but rebuilds are not yet reproducible (open gap).

- **IPFS distribution via `git notes` CID, no ENS anchor**
  - _Rationale:_ Per-tag CIDs are recorded and verifiable; branch builds carry no recorded CID.
  - _Disclosure:_ The CID is the trust anchor; the IPNS name is anchored by DNSLink on `p2pix.co` (DNS-trusted); ENS pinning is a TODO, not yet wired.
  - _Escape path:_ CID is the trust root today; ENS anchoring is a tracked upgrade.

- **No native zk confidentiality (currently)**
  - _Rationale:_ Scope, not a defect.
  - _Disclosure:_ On-chain transaction content is public; we guarantee metadata privacy, not content privacy, and say so in user copy (see §C.5 of `DESIGN.md`).
  - _Escape path:_ N/A — this scope statement covers on-chain content privacy only; metadata exposure is inventoried under [Outbound network requests](#outbound-network-requests-what-the-app-phones-home-to) and tracked as open gaps.

## Outbound network requests (what the app phones home to)

Every request below is triggered by **first-party** code in this front-end (not by a user-chosen wallet extension). Per `DESIGN.md`'s metadata-leak principle, treat any endpoint as a potential metadata leak: each receives at least your IP address and `Origin`, and the chain/transaction-graph ones receive your addresses and query parameters.

- **`https://api.web3modal.org`** (Reown cloud) — _page load_
  - _Trigger:_ `setupAppKit()` in `src/main.ts` → AppKit init.
  - _Purpose:_ Remote feature flags (`fetchProjectConfig`), allowed-origins check (email login is enabled), wallet/network/asset image prefetch.
  - _Data exposed:_ Client IP, `Origin`, Reown project id, requested asset/wallet ids.
  - _Escape path:_ Build with `features.email: false` / `headless` and self-host the AppKit cloud endpoints (code-level; UI switch is an open gap).

- **`https://rpc.walletconnect.org`** (Reown Blockchain API) — _page load, and every on-chain read_
  - _Trigger:_ AppKit init (`BlockchainApiController`), then every `readContract` / `multicall` on every configured chain.
  - _Purpose:_ Resolves a WalletConnect client id; JSON-RPC reads — the AppKit wagmi adapter substitutes Reown's Blockchain API for the configured RPC on every chain it serves, which includes all four configured here (see the Read-only layer in ARCHITECTURE.md).
  - _Data exposed:_ Client IP, `Origin`, project id, read requests (addresses, calldata).
  - _Escape path:_ Pass `customRpcUrls`/`transports` to `WagmiAdapter` and rebuild to put another RPC first; Reown's API stays as a fallback (code-level; UI switch is an open gap).

- **WalletConnect relay** (`wss://relay.walletconnect.com`, …) — _page load + on connect_
  - _Trigger:_ Existing-session reconnect sync, and whenever a WalletConnect session connects.
  - _Purpose:_ Relay transport for WalletConnect sessions.
  - _Data exposed:_ Client IP, session topic.
  - _Escape path:_ Self-host a WalletConnect relay or use an injected EIP-1193 wallet (no relay needed).

- **`https://*.g.alchemy.com/v2/…`** (Alchemy RPC) — _passkey connector's inline client only_
  - _Trigger:_ The passkey connector's inline client, which is handed the default network's URL (mainnet in production, Sepolia in development); the wagmi public client does not use these URLs.
  - _Purpose:_ EVM JSON-RPC reads made by the passkey connector.
  - _Data exposed:_ Read requests (addresses, calldata) made by the passkey connector.
  - _Escape path:_ Edit the RPC in `src/config/networks.ts` and rebuild (code-level; UI switch is an open gap).

- **`https://api.pimlico.io/v2/<chain>/rpc`** (Pimlico) — _on user action (send / quote)_
  - _Trigger:_ User sends a UserOp or requests a paymaster quote.
  - _Purpose:_ ERC-4337 bundler + ERC-20 paymaster.
  - _Data exposed:_ UserOp traffic, sender address, fee-token balances.
  - _Escape path:_ Any ERC-4337 bundler/paymaster can be used; the endpoint is a literal in `src/config/networks.ts`, so a rebuild is required (UI switch is an open gap).

- **`https://api.studio.thegraph.com/query/…`** (The Graph) — _on user action (reads)_
  - _Trigger:_ User reads indexed events.
  - _Purpose:_ Subgraph index of on-chain events.
  - _Data exposed:_ Query (read) parameters, addresses.
  - _Escape path:_ Index, not authoritative; the chain is the source of truth. Pointing at another subgraph requires a rebuild; only `subgraphUrls[0]` is used (open gap).

- **`https://api.p2pix.co` / `https://demo.api.p2pix.co`** (P2Pix prover) — _on user action (trade)_
  - _Trigger:_ Seller registration (`/register`), buyer charge creation (`/request`), release polling (`/release`).
  - _Purpose:_ Pix charge creation and the proof of Pix payment.
  - _Data exposed:_ The seller's CPF/CNPJ, bank account, branch and ISPB; the trade amount; the participant number; the lock id and chain; the solicitation number.
  - _Escape path:_ No alternate path today (prover walkaway open gap).

Neither the build output nor any config in this repo sets a `connect-src` CSP; whether a deployment adds one at the gateway is outside this repo — see open gaps.

## Known open gaps

- **Prover walkaway path** fails today — no alternate release if `api.p2pix.co` is down.
- **Reproducible build + signed release manifest** — CID pinned, but no rebuild cross-check or signed manifest.
- **Configurable-infra switch** — endpoints overridable in code, not yet in UI.
- **ENS anchor** — not yet wired.
- **`.onion` mirror** — not yet wired.
- **Gateway-enforced strict CSP / SRI** — not implemented in this repo.
- **Page-load telemetry to Reown cloud** — `api.web3modal.org` and `rpc.walletconnect.org` are contacted on page load before any wallet is connected; not yet suppressible via UI (email/`headless` build switch is code-only).
- **Signing & wallet hardening** — allowance-revoke UI, human-readable signing preview (no blind signing), explicit chainId assertion inside the write methods, simulation on `deposit`/`approve`, dependency provenance. (Approvals are already exact-amount; see the signing rails in ARCHITECTURE.md.)

## Design-baseline compliance

✅ met · ⚠️ partial or unverified · ❌ open gap. Ratings follow the shipped behavior in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the [Trust we rely on](#trust-we-rely-on) entries above; they are updated on every release, and a ⚠️ stays ⚠️ until `ARCHITECTURE.md` substantiates the item. Items not yet met are also tracked under [Known open gaps](#known-open-gaps).

| Baseline item (from `DESIGN.md`) | Status | Evidence / open gap |
| --- | --- | --- |
| Self-custody everywhere | ✅ | Signing is client-side on both rails (`ARCHITECTURE.md` §2); no backend key custody. Crypto escrow is non-custodial; fiat transits P2Pix's BB Pay account during settlement — a named custody deviation, see the prover entry. |
| No centralized relay / session node | ⚠️ | WalletConnect relay is the default connection hub, and email/social login uses a Reown-managed signer; injected wallets and passkeys avoid both. |
| Zero telemetry endpoints | ✅ | The app ships no analytics; the AppKit fork removes Reown's analytics pipeline and stubs Coinbase telemetry (`ARCHITECTURE.md` §1). |
| Open standards + readable artifacts | ⚠️ | This front-end is public under MIT; the release prover (`api.p2pix.co`) is closed. |
| License commitment | ✅ | MIT here (permissive, accepted); no source-available component in this front-end. A no-relicense pledge is not yet recorded. |
| Verifiable data layer | ❌ | Reads are single-source per concern (Reown Blockchain API / Alchemy RPC, The Graph); no light client or deterministic replay. |
| Content-hash distribution + ENS anchoring | ⚠️ | IPFS pin + IPNS anchored by a DNS TXT record; ENS and a `.onion` mirror are not shipped. |
| Structural metadata hardening | ⚠️ | Not substantiated in `ARCHITECTURE.md`; AppKit contacts cloud feature-flag and wallet/asset-image endpoints on load. |
| Reproducible, signed releases | ❌ | Rebuilding a tag to its recorded CID is an open gap (`ARCHITECTURE.md` §6); releases are not signed. |
| Explicit privacy boundaries | ✅ | Metadata-only guarantee; on-chain content is public (`DESIGN.md` §C.5). |
| Signing safety | ⚠️ | Exact-amount approvals, chainId checks and wallet-visible actions; no EIP-4361 (no off-chain auth) and no documented tx simulation. |
| Read-path metadata hygiene | ❌ | Reads go through shared RPC/indexer endpoints with no user-configurable option in the shipped app. |
| Zero option | ⚠️ | Contract writes are callable directly (✓), and release verifies a plural attestor set, readable on-chain (`validAttestors`). Still missing: an intermediary-free release path — the proof exists only while the prover is up (prover walkaway open gap); a Bacen-issued attestation ([bacen/pix-api#61](https://github.com/bacen/pix-api/issues/61)) remains the route to one. |
| User-controlled defenses | ✅ | No default blocklists, venue steering, or opaque AI in the shipped app. |
| Cross-layer review | ⚠️ | The zkPix design places the forgeable point in the `validAttestors` set and the prover's BB Pay credentials — a disclosed relocation of the chokepoint, not an elimination. |
| Two-pillar review before ship | ⚠️ | This document is the record; there is no automated CI gate yet. |
| Walkaway test | ❌ | Release halts if the P2Pix prover is unavailable, and deploy/rebuild depends on our CI, DNS, and manual CID notes. |
| Subtraction / no team lock-in | ⚠️ | Deploy pipeline and prover are team-run; handoff paths are not yet documented. |
| Deviation-by-consent | ✅ | Every deviation is listed here with its escape path. |

## Safe harbor

Good-faith research that does not harm users or break the law is welcome. We will not pursue action against researchers who follow this policy.
