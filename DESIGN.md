# P2Pix Design Principles

General design philosophy for every dApp we ship. These are the _guidelines_ — the repo-specific _facts_ (what P2Pix actually does today) live in [`ARCHITECTURE.md`](./ARCHITECTURE.md); the documented trust deviations (where it relies on third parties) live in [`SECURITY.md`](./SECURITY.md). Keep them in sync: guidelines here say what we aim for; ARCHITECTURE.md says what we shipped, and SECURITY.md says what we trust.

Above all, every guideline serves one goal — passing the **walkaway test** from the [EF Mandate](https://ethereum.org/content/foundation/mandate/index.md) (defined in section B).

## A. Core principles

The [EF Mandate](https://ethereum.org/content/foundation/mandate/index.md) rests on **two pillars** — a technical one and a social one — and every choice we make is reviewed against both. This section is the technical pillar; section B is the social one.

### The technical pillar — CROPS

Every architectural choice is reviewed against four pillars — **CROPS**, the baseline for any dApp we ship:

- **Censorship Resistance** — no single party can block or alter the flow; no centralized intermediary or kill switch, and no privileged whitelists or blacklists.
- **Open Source & Free, as in Freedom** — public, auditable, forkable; no proprietary "black boxes." **License commitment:** permissive licenses are acceptable and viral copyleft is preferred, but _source-available_ licenses are not tolerated, and neither we nor our dependencies may move away from an open-source/copyleft license in the future.
- **Privacy** — permissionless and available to all; minimize metadata, and be explicit about confidentiality and selective disclosure (see section C.5).
- **Security** — self-custody, verifiable signing; **simplicity** (minimize code and dependencies, because a system is not trustless if only a few can understand it), **governance minimization**, and no forced migrations that expose users to new risk.

CROPS is an **indivisible, non-negotiable whole**, not a checklist: none of the four corners may be traded for another, and none may be deferred to a "later, once it's mature." It also is not satisfied layer-by-layer — per the mandate we think through **higher-order effects**. A design that looks CROPS-clean at the layer in hand but pushes a chokepoint — forced intermediation, extraction, or some other anti-sovereign pattern — into another layer is **rejected**. Intermediaries must be **eliminated, not relocated**.

Each choice is reviewed against these pillars both before the architecture plan and before every release; the review must name the chosen default, any accepted compromise, and the user's escape path. When a trade-off is unavoidable, **document it explicitly in user-facing copy** — and name the user's escape path (how they route around the trusted party if it disappears). Don't silently relax the principle. Where two technically credible paths compete, **pick the one that removes points of leverage, not the one that ships faster**: prefer the option that is **fully CROPS from the beginning**, even when it is harder to get off the ground, because adoption can be earned over time but principled ground once ceded is far harder to regain.

## B. The social pillar — how we choose to work

The mandate's second pillar governs _how_ we work, not just _what_ we build. It answers to the same goal: the **walkaway test**.

**The walkaway test.** Our ultimate aim is that this dApp and its protocol and core application layers keep working reliably for the people already using them, even if we and today's maintainers disappear tomorrow. Every guideline here answers to that test — it is why we prefer cryptographic anchors over servers, why we eliminate intermediaries instead of entrenching them, and why the user's keys, data, and exit path come first.

- **Principled alignment.** We optimize for principle-upholding resilience, not user count. A billion users in a centralized silo is a failure of mission, not a success; so is designing capture or uncompetitive extraction into a default. We do not wrap a chokepoint in the language of CROPS.
- **Discipline.** We do it right and well: rigorous, honest about trade-offs, and candid when we get a big thing wrong. We share findings early and ship only what is mission-critically reliable.
- **Right association.** Who we work with is itself a principled choice. We prefer individuals, teams, and dependencies that share these principles, make their work legible through open documentation, and actively work toward independence from us.
- **Big picture.** Ethereum's promise is bigger than any one asset class or subculture. We build for self-sovereignty as a whole — censorship resistance, openness, privacy, and security for anyone, not just a niche — and we keep our horizon wider than the moment's market.

**Subtraction as success.** Following the mandate's operating approach, our bias is to make ourselves _less_ necessary over time: hand functions off to users or the community as soon as they can carry them, keep work upstream, reusable, and compounding, and treat any dependency on our team that a user cannot walk away from as a defect to remove.

**Keep users sovereign inside a hostile environment.** "Safety" shipped as a default restriction — silently blocking contracts, steering flow to preferred venues or counterparties, unmodifiable preinstalled allow/deny lists, or an AI copilot that flags actions with an uninspectable model and phones home — is paternalism and a hidden chokepoint. The goal is **not to sanitize the environment; it is to keep the user sovereign inside it**: offer transparent, independently verifiable, user-controlled defenses (plural community-maintained lists with clear override paths; private-by-default tooling), never a restriction the user did not opt into and cannot opt out of.

## C. Upgrades to adopt in every dApp we build

### 1. Close the read-path trust hole

**Problem:** A single backend or JSON-RPC node serving on-chain values is a trusted oracle.

**General solution (guideline):** read-only data must be _verifiable_, not _authoritative_.

- **Deterministic, replayable reads.** Where practical, expose data as a deterministic function of the chain state (e.g., derive token metadata from on-chain events) and let a light client produce it.
- **Ship a light client (preferred).** Integrate a minimal client (e.g., **Helios** in Go, or equivalent) to read & verify directly against full nodes, not through our API. Treat any RPC we ourselves run as _an_ fallback, not _the_ fallback.
- **Support multiple independent RPC providers** (and let users configure their own), so failure or corruption of one doesn't mean "trust us."
- **Read-path metadata hygiene.** Route read traffic through user-chosen / privacy-respecting RPC and avoid correlating queries with a persistent session or identifiable header, so reads cannot be used to profile a user's addresses or activity.

**The rule:** never tell the user "here's the truth" — give them the _means to confirm it_.

### 2. Decentralize distribution (hosting / identity)

**Problem:** Single domain/host/CDN is a choke point for censorship, tampering, and logineye observation.

**General solution (guideline):** reference content by **low-trust, content-hash-based identifiers**, not by trusted servers.

- **IPFS / content-addressed hosting** as the primary distribution: deploy to _multiple_ independent providers, and advertise the content hash explicitly (e.g., `ipfs://<CID>`). Gateways are interchangeable; the _hash_ is the anchor.
- **ENS + content-hash pinning** so identity (which dApp, which release) is anchored on-chain and resolvable without depending on any single registrar or gateway.
- **Onion (Tor) mirror** for privacy-first audiences, as a first-class hosting option — not an afterthought.

**The rule:** the service address (URL) is _replaceable_; the **content hash and ENS anchor are what users should trust**.

### 3. Minimize browser metadata structurally

**Problem:** Even with no JavaScript, browser-level leaks are real: Referer, timing, third-party fonts/CDNs, fingerprinting signals.

**General solution (guideline):** structural minimization, not policy minimization.

- **Referrer-policy: no-referrer** on every response; no cross-origin referers leaking to wallets.
- **No third-party anything.** All fonts, stylesheets, images, QR images, and any icons are _self-hosted_, with **content hashes and integrity attributes** where cacheable material crosses boundaries.
- **No tracking calls, no beacon, no analytics endpoints**, no "telemetry consent" dialogs — assume any endpoint is a leak.
- **Strict CSP, SRI, TLS-only**, HSTS + HPKP — prefer simple, auditable headers over complex middleware.

- **Nonce-based CSP + Subresource Integrity.** Emit a per-response `nonce` in `script-src`/`style-src` (no `unsafe-inline`) so only our own inline scripts run, and add `integrity` hashes on any cacheable third-party asset.
- **Dependency provenance.** Pin and hash build dependencies; record a signed provenance (SLSA/Sigstore) attestation so the wallet's transaction preview is derivable from the released source.

**The rule:** metadata minimization is a _build_ responsibility, not a _policy_ promise users must opt into.

### 4. Eliminate single roots of trust in the build pipeline

**Problem:** The user ultimately trusts the front-end bundle they load — the HTML template, the wallet/SDK libraries, and the deploy output.

**General solution (guideline):** reproducible, signed, auditable artifacts.

- **Reproducible builds** — the exact output bytes are recomputing from source deterministically.
- **Cryptographically signed releases** — include a manifest hash that users (or gatekeepers) can verify against the source snapshot.
- **Pin critical dependencies** to specific, reviewed versions.
- **Automated provenance checks** in CI so what the user approves is what gets signed — the wallet's own transaction preview must be derivable from the released source.

**The rule:** doubt the build pipeline even more than the network: it's the last place a trusted party can substitute malicious bytes.

### 5. Decide explicitly on cryptographic confidentiality (zk)

**Problem:** Pseudonymity ≠ confidentiality. Currently our transactions are public on-chain.

**General solution (guideline):** confidentiality is a **scope choice**, must be explicit.

- **Privacy is permissionless.** Per the mandate, privacy is not total concealment; it is the freedom to choose what to disclose, to whom, on one's own terms. Selective disclosure sits on top of a base of freely available, unconditional privacy — so metadata minimization is the floor, not a premium feature.
- If confidentiality is required → integrate **zero-knowledge** (e.g., Noir for on-chain proof verification, or deploy behind a zk-rollup), plus mixers/stealth schemes only if they're non-custodial and verifiable.
- If confidentiality is not required → say so: **we guarantee metadata privacy (telemetry, session graph), not on-chain transaction content privacy.** Never conflate the two in user copy.

**The rule:** define _what_ "privacy" means (metadata? content? identities?) and bound it, per build. Don't imply protections you haven't built.

### 6. Signing safety (wallet / UserOp)

**Problem:** A signature is the one moment a user accepts irreversible consequences. Wallet prompts are the last line of defense.

**General solution (guideline):** make signing _verifiable and informed_.

- **Sign-In with Ethereum (EIP-4361) for any off-chain auth** so login messages are bound to a domain, nonce, and expiry — never sign raw opaque bytes.
- **No blind signing.** The wallet must show the human-meaningful action (recipient, amount, contract, function); if the app cannot present it, block the flow.
- **Transaction simulation.** Prefer a pre-flight simulation so the user sees the net effect before approving a UserOp / tx.
- **chainId guard.** Reject signatures/transactions whose `chainId` is missing or mismatched (no cross-chain replay).
- **Approval hygiene.** Minimize token approvals (exact amounts, revocable), and never request blanket ERC-20 allowances by default.

**The rule:** the signature is the user's sovereign act — the UI must make its meaning unambiguous, never convenient-to-hide.

### 7. Eliminate intermediaries; keep a credible zero option

**Problem:** RPC servers, relays, bundlers, indexers, and oracle signers are each a potential dominant chokepoint: they can censor, extract, or impose terms, and a single one winning is a durable, non-competitive grip on the flow.

**General solution (guideline):** disintermediation is the north star.

- **Eliminate where possible.** Prefer the design that removes the intermediary function entirely over one that merely adds competitors to it.
- **Guarantee the zero option.** For every affordance that has an intermediated path, an intermediary-free path must be _built_, and it must stay **credible and accessible** — a present exit for users already exploited by an intermediary, and a constraint against the abuse expanding. Do not skip this step.
- **Bounded, plural, replaceable.** Where an intermediary is structurally unavoidable, keep the role open to many independent providers, verifiable, and swappable without deep surgery on the app; record what it sees, what it can block, and the user's escape in `SECURITY.md`.

**The rule:** where you cannot remove the middleman, prove he is optional.

## E. (Optional) The general "dApp checklist" to adopt

The following checklist is a good "hello world" spec for any future dApp:

- [ ] **Self-custody everywhere** — no backend key custody, ever.
- [ ] **No centralized relay / session node** — eliminate any third-party connection hub.
- [ ] **Zero telemetry endpoints** — structurally no data emission; detect it in CI.
- [ ] **Open standards + readable artifacts** — public, forkable, documented.
- [ ] **License commitment** — permissive is acceptable, copyleft preferred; no source-available-only, and no future move away from an open-source/copyleft license.
- [ ] **Verifiable data layer** — no single-oracle reads; light client or deterministic replay preferred.
- [ ] **Content-hash distribution + ENS anchoring** — addresses are interchangeable; hash is the trust root.
- [ ] **Structural metadata hardening** — no-referrer, CSP, no third-party assets, TLS-only.
- [ ] **Reproducible, signed releases** — build bytes are reproducible and signed.
- [ ] **Explicit privacy boundaries** — what exactly do we _not_ promise (content vs metadata)?
- [ ] **Signing safety** — EIP-4361 auth, no blind signing, tx simulation, chainId guard, minimal approvals.
- [ ] **Read-path metadata hygiene** — privacy-respecting RPC, no session-correlated queries.
- [ ] **Zero option** — every intermediated affordance has a credible, accessible intermediary-free path.
- [ ] **User-controlled defenses** — no paternalistic defaults (silent blocks, curated lists, opaque AI) without an opt-out.
- [ ] **Cross-layer review** — no CROPS-clean-at-one-layer while a chokepoint moves into another.
- [ ] **Two-pillar review before ship** — CROPS (Censorship Resistance, Open Source & Free, Privacy, Security) and the social pillar, each signed off with escape path.
- [ ] **Walkaway test** — the dApp keeps working for current users if the team disappears.
- [ ] **Subtraction / no team lock-in** — functions hand off; nothing depends on us to keep running.
- [ ] **Deviation-by-consent** — any rule exception documented, not implicit.

When in doubt, recall the core rule: don't just trust — audit.

## G. Bottom line for adoption

These guidelines are the **default operating mode for any dApp we ship**. The core requirement: stop trusting any point-servers (backend, RPC, relay, hosting, build) and start trusting **cryptographic anchors** (content hashes, ENS, signatures) and **verifiable code paths** (light clients, reproducible builds).

Held together by two pillars from the [EF Mandate](https://ethereum.org/content/foundation/mandate/index.md): the technical **CROPS** — Censorship Resistance, Open Source & Free, Privacy, Security — and the **social pillar** (principled alignment, discipline, right association, big picture). Both are reviewed before the architecture plan and again before every release. A deviation is only acceptable when its compromise is named and the user's escape path is documented.

The measure of all of it is the **walkaway test**: the dApp must keep working for the people already using it even if we disappear. Subtraction is success — the more this can run, and be forked, without us, the closer we are to done.
