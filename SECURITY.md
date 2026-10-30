# Security Policy

## Reporting a vulnerability

Report security issues **privately** — do not open public issues or PRs for them. Include: a description, the affected component, steps to reproduce, and the impact. We aim to acknowledge ASAP and agree on a fix and coordinated-disclosure timeline with you.

## Scope

- This front-end (`P2Pix-Front-End`).
- The P2Pix smart contracts (see the `p2pix-smart-contracts` submodule).
- The P2Pix prover (`api.p2pix.co`).

## Trust we rely on

P2Pix is self-custodial for signing on injected and WalletConnect EOAs and WebAuthn passkey wallets, but releasing an escrow relies on infrastructure run by third parties. We disclose each one here plainly, with no silent trust.

### Primus attestors sign the proof of Pix payment; the P2Pix prover (`api.p2pix.co`) produces it
  - _Rationale:_ Bridges off-chain Pix settlement to on-chain release with the bank's own confirmation, replayed through zkTLS, in place of a key P2Pix holds.
  - _Disclosure:_ Release of escrowed funds is gated on an attestation signed by a Primus network attestor: a node on Primus's whitelist, run in a TEE, with no slashing today. The contract accepts the attestors in `validAttestors`, a set the owner edits (add and remove) and anyone can read; an attestor that colludes with the prover can forge a proof, so the attestor set is the forgeable point. The prover holds the BB Pay credentials: the attested request carries its mTLS client certificate and a read-only OAuth token, which the attestor's TEE sees. The charge is tied to P2Pix's convênio through the convênio query in the attested URL, which the attestor signs verbatim. If the prover is unavailable, in-flight trades stall: release is possible only until the lock expires, after which the escrow returns to the seller's deposit and a buyer who already paid the Pix has no on-chain recovery. The buyer's Pix is paid into P2Pix's BB Pay account and BB settles it to the seller's registered account automatically in the same flow, so P2Pix holds the fiat only transiently; the convênio holder can refund a paid charge after release, so fiat custody stays with P2Pix. The charge's split (all of it to the seller) is set by the prover at creation and is not attested; the seller's fiat depends on P2Pix's charge creation as it already does on its refund power. The proof, once submitted, is public on the P2Pix chain and in the Primus task record on Base Sepolia: the charge's number, amount, Pix `txId`, participant number and lock id.
  - _Escape path:_ Compare `validAttestors` with Primus's node registry. An alternate release path (prover walkaway) is an open gap — see [Known open gaps](#known-open-gaps).

### Pimlico bundler + paymaster (ERC-4337 infrastructure)

- _Rationale:_ Gas sponsorship / ERC-20 paymaster improves UX; non-custodial.
- _Disclosure:_ The relayer observes transaction traffic.
- _Escape path:_ Any ERC-4337 bundler can relay the UserOp; the endpoint is a literal in `src/config/networks.ts`, so routing around Pimlico requires editing it and rebuilding (UI switch is an open gap).

### CoW Protocol order book (`api.cow.fi`) — optional swap

- **What it is:** CoW Protocol's order book, used only on Arbitrum One (and Sepolia for testing) and only when the buyer picks a swap token (USDT, USDC or DAI) instead of BRZ, or the seller pays with one of them instead of BRZ. The app requests quotes from it and posts the user's order; independent solvers settle the order through the GPv2Settlement contract. Orders are built, hashed and signed client-side (EIP-712 on the EOA rail, an on-chain pre-signature from the smart account); the API supplies only a price, and the order uid it returns must equal the locally computed one.
- **What it sees or can block:** the requester's IP, the user's address (the zero address before a wallet is connected), the token pair, amounts and timing — quotes are requested as the user types, before any wallet action. It can refuse, delay or never settle an order; it cannot move more than the signed sell limit or pay anyone but the user, and an unfilled order expires after 30 minutes with the tokens still in the user's account.
- **Escape path:** release never depends on the swap — a quote or order failure delivers BRZ and the buyer keeps it ("Ficar com BRZ") or trades it on any DEX. A live order can be withdrawn on-chain (`setPreSignature(uid, false)` or `invalidateOrder(uid)` on GPv2Settlement), not only through the API.

### WalletConnect relay (`wss://relay.walletconnect.com`, …)

- **What it is:** transport for WalletConnect sessions.
- **What it sees or can block:** your IP and session topic.
- **Escape path:** self-host a relay or use an injected wallet.

### Magic email/Google login (`magic-sdk`, `@magic-ext/oauth2`, MIT)

- **What it is:** email and Google login through our own Magic account. The Magic-held login key is an EOA that owns the user's Kernel smart account (smart-account rail, `ARCHITECTURE.md` §2). Enabled only when `VITE_MAGIC_PUBLISHABLE_KEY` is set; the publishable key is public and ships in the bundle.
- **What it sees or can block:** Magic holds the login key (custodial-ish: you do not hold it and it cannot be exported by this app), sees your email or Google identity, IP and the messages it is asked to sign, and can block or lose access to the key. Signing is not on-device for this login, unlike injected and passkey wallets.
- **Escape path:** on chains with the smart-account rail, Enviar, in the account panel on `/` and `/seller`, sends each of the smart account's tokens, one at a time, to any address (needs BRZ for gas). On chains without it (e.g. Rootstock Testnet) the Magic EOA itself is your account — there is no Kernel and Enviar does not apply, and the key stays with Magic. Prefer a passkey or injected wallet for funds you cannot afford to have gated by Magic.

### Google OAuth (Magic social login)

- **What it is:** the identity provider behind "Continue with Google". The OAuth client is ours, configured in Magic; Google is redirected to and back, and Magic completes the login.
- **What it sees or can block:** Google sees that you log in to P2Pix and your IP; it can suspend the account or the OAuth client, which blocks this login method.
- **Escape path:** log in with a passkey or an injected wallet. A Google or Magic login does not carry over: funds in the Magic-owned smart account leave via Enviar in the account panel.

### Passkey (`@doiim/passkeys`; no third party beyond the RPC and Pimlico)

- **What it is:** WebAuthn login through `@doiim/passkeys` 0.5.0-alpha.0 (MIT, maintained by doiim; github.com/doiim/passkeys), pinned to an exact version, plus permissionless Kernel v0.3.1. It is a new supply-chain root: a doiim-maintained package whose own dependencies are `ox` ^0.11 and `permissionless`. The key stays in your authenticator. There is no server: the public key is recovered from the WebAuthn signature (P-256 recovery), and the on-chain reads (code, nonce, ETH balance) choose between the two candidate keys; if still ambiguous, a second assertion restricted to that credential settles it. `localStorage` (`doiim:passkey*`) is a cache and session pointer only — never used as `allowCredentials`.
- **What it sees or can block:** no operator beyond the configured RPC (Alchemy, reads above) and the Pimlico bundler/paymaster below. The credential is bound to the RP id, and passkeys are enabled only on owned origins: `p2pix.co`, `demo.p2pix.co` and their subdomains, `localhost` in development, or the host named by `VITE_PASSKEY_RP_ID` (which must serve `https://<rpId>/.well-known/webauthn`). They are disabled on IPFS gateways (every CID shares one origin and could ask the passkey to sign), on ENS gateways without that override, on IP literals and on lookalike domains.
- **Escape path:** Enviar in the account panel, or use an injected wallet.

### Alchemy RPC + The Graph (reads)

- **What it is:** the read layer — RPC and indexed events.
- **What it sees or can block:** your addresses, read requests and query parameters.
- **Escape path:** point the app at your own RPC and subgraph — a config change and rebuild.

## Outbound network requests (what the app phones home to)

Every request below is triggered by **first-party** code in this front-end (not by a user-chosen wallet extension). Per `DESIGN.md`'s metadata-leak principle, treat any endpoint as a potential metadata leak: each receives at least your IP address and `Origin`, and the chain/transaction-graph ones receive your addresses and query parameters.

- **WalletConnect relay** (`wss://relay.walletconnect.com`, …) — _page load + on connect_
  - _Trigger:_ Existing-session reconnect sync, and whenever a WalletConnect session connects.
  - _Purpose:_ Relay transport for WalletConnect sessions.
  - _Data exposed:_ Client IP, session topic.
  - _Escape path:_ Self-host a WalletConnect relay or use an injected EIP-1193 wallet (no relay needed).

- **`https://*.g.alchemy.com/v2/…`** (Alchemy RPC) — _every on-chain read_
  - _Trigger:_ Every app-side EVM read: the wagmi public client's per-chain transport (`http(<first RPC URL>)` in `src/wallet/wagmi.ts`, from `src/config/networks.ts`), the passkey connector's inline client, and Magic's provider — each is handed the configured network's Alchemy URL. There is no other read fallback.
  - _Purpose:_ EVM JSON-RPC reads — balances, contract reads, simulations.
  - _Data exposed:_ Read requests (addresses, calldata) made by the app on your behalf.
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

- **`https://api.cow.fi/arbitrum_one`** (CoW Protocol order book) — _on user action (swap token picked)_
  - _Trigger:_ Buy or sell form with a swap token selected on Arbitrum One (quotes while typing), order post, and order status polling every 10 s while it is live.
  - _Purpose:_ Price quotes and order relay to solvers; settlement is on-chain.
  - _Data exposed:_ Address (zero address before connecting), token pair, amounts, timing.
  - _Escape path:_ Pick BRZ — no request is made. The endpoint is `swap.apiUrl` in `src/config/networks.ts`.

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
- **Signing & wallet hardening** — allowance-revoke UI, human-readable signing preview (no blind signing), explicit chainId assertion inside the write methods, simulation on `deposit`/`approve`, dependency provenance. (Approvals are already exact-amount; see the signing rails in ARCHITECTURE.md.)

### Pinata (release pinning)

- **What it is:** a second pin of every release, uploaded from CI over HTTPS as a CAR (`uploads.pinata.cloud`, `car=true`) — the same bytes our kubo node holds.
- **What it sees or can block:** the full build bytes and CI's IP; it can refuse or drop the pin. Availability only, never content: the CID is computed in CI with a pinned kubo and checked against the CID Pinata reports back, so a wrong pin fails the deploy instead of shipping.
- **Escape path:** the CAR is a plain file — pin it at any other service or self-hosted node. Our kubo node and `ipfs://<CID>` remain authoritative.

## Design-baseline compliance

✅ met · ⚠️ partial or unverified · ❌ open gap. Ratings follow the shipped behavior in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the [Trust we rely on](#trust-we-rely-on) entries above; they are updated on every release, and a ⚠️ stays ⚠️ until `ARCHITECTURE.md` substantiates the item. Items not yet met are also tracked under [Known open gaps](#known-open-gaps).

| Baseline item (from `DESIGN.md`) | Status | Evidence / open gap |
| --- | --- | --- |
| Self-custody everywhere | ✅ | Signing is client-side on both rails (`ARCHITECTURE.md` §2); no backend key custody. Crypto escrow is non-custodial; fiat transits P2Pix's BB Pay account during settlement — a named custody deviation, see the prover entry. |
| No centralized relay / session node | ⚠️ | WalletConnect relay is the mobile connection hub, and Magic holds the email/Google login key; injected wallets and passkeys avoid both. |
| Zero telemetry endpoints | ✅ | The app ships no analytics. WalletConnect telemetry is disabled; the remaining wallet-related endpoints are the WalletConnect relay (only on use) and Magic, listed above. |
| Open standards + readable artifacts | ✅ | Both public and forkable: this front-end under MIT, the release prover (`zkPix`) under AGPL — see `ARCHITECTURE.md` §Prover. |
| License commitment | ✅ | MIT here (permissive, accepted); dependencies are MIT or Apache-2.0 (`@doiim/passkeys`, `magic-sdk`, `@walletconnect/*`); the release prover is AGPL — copyleft, preferred — and outside this front-end. No source-available component in this front-end. A no-relicense pledge is not yet recorded. |
| Verifiable data layer | ❌ | Reads are single-source per concern (Alchemy RPC, The Graph); no light client or deterministic replay. |
| Content-hash distribution + ENS anchoring | ⚠️ | IPFS pin + IPNS anchored by a DNS TXT record; ENS and a `.onion` mirror are not shipped. |
| Structural metadata hardening | ⚠️ | The connect UI loads no remote wallet lists or images; Magic loads its own iframe when email/Google login is used. |
| Reproducible, signed releases | ❌ | Rebuilding a tag to its recorded CID is an open gap; releases are not signed. |
| Explicit privacy boundaries | ✅ | Metadata-only guarantee; on-chain content is public |
| Signing safety | ⚠️ | Exact-amount approvals, chainId checks and wallet-visible actions; CoW swap orders are built locally with the buyer as receiver, their EIP-712 domain pins the chain and settlement contract, and the relayer approval covers exactly the order's sell limit. No EIP-4361 (no off-chain auth) and no documented tx simulation. |
| Read-path metadata hygiene | ❌ | Reads go through shared RPC/indexer endpoints with no user-configurable option in the shipped app. |
| Zero option | ❌ | Contract writes are callable directly (✓), but escrow release has no intermediary-free path today; the Bacen ask ([bacen/pix-api#61](https://github.com/bacen/pix-api/issues/61)) is the primary route to one. The optional CoW swap has one: keep the released BRZ. |
| User-controlled defenses | ✅ | No default blocklists, venue steering, or opaque AI in the shipped app. |
| Cross-layer review | ⚠️ | The zkPix design places the forgeable point in the `validAttestors` set and the prover's BB Pay credentials — a disclosed relocation of the chokepoint, not an elimination. |
| Two-pillar review before ship | ⚠️ | This document is the record; there is no automated CI gate yet. |
| Walkaway test | ❌ | Release halts if the P2Pix prover is unavailable, and deploy/rebuild depends on our CI, DNS, and manual CID notes. |
| Subtraction / no team lock-in | ⚠️ | Deploy pipeline and prover are team-run; handoff paths are not yet documented. |
| Deviation-by-consent | ✅ | Every deviation is listed here with its escape path. |

## Safe harbor

Good-faith research that does not harm users or break the law is welcome. We will not pursue action against researchers who follow this policy.
