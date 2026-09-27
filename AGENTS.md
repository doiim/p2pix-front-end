# P2Pix Front-End — Agent Guide

This repo follows a few core docs. Read them before making architectural or dependency choices:

- [`DESIGN.md`](./DESIGN.md) — general **design guidelines** (philosophy, upgrades to adopt, the dApp checklist).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — P2Pix-specific **facts**: the current stack and the concrete blueprint. **Keep this honest on every release** — it is the source of truth for "what we actually ship." The design-baseline compliance scorecard (✅/⚠️/❌) is defined in [`SECURITY.md`](./SECURITY.md).

## EF Mandate

Abide closely by the [EF Mandate](https://ethereum.org/content/foundation/mandate/index.md). Its CROPS properties — Censorship Resistance, Open Source & Free, Privacy, Security — are non-negotiable and take precedence over convenience. When this repo's guidance and the Mandate conflict, the Mandate wins.

## Documented deviations

Documented trust deviations (mandatory disclosure copy + escape paths) live in [`SECURITY.md`](./SECURITY.md) — the canonical source. Rule: **any deviation from the four CROPS pillars must be documented, debated in the team, and never silently baked into defaults.** When adding a dependency or third-party service, extend the table in `SECURITY.md` rather than absorbing the trust silently.

## Security & privacy review gate

Before any architectural or dependency change, check it against the four CROPS pillars (Censorship Resistance, Open Source & Free, Privacy, Security) in `DESIGN.md` and the recorded deviations in `SECURITY.md`. Do not silently add a trusted third party, and do not claim a known open gap is resolved unless `ARCHITECTURE.md` says otherwise.

## Agent rules

- Prefer content-hash / cryptographic anchors (IPFS CID, ENS, signatures) over trusted servers.
- Keep metadata minimization structural (CSP, no-referrer, self-hosted assets), not a policy promise.
- When in doubt, recall the core rule: don't just trust — audit. Surface the verification path, not just the claim.

## Build, verify & release (agent commands)

- Generate contract ABIs: `bun run wagmi:gen`
- Type-check + build: `bun run build` (runs `vue-tsc` then `vite build`).
- Lint: `bun run lint`. Format check: `bun run format:check`.
- Tests: `bun run test`.
