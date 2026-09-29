# P2Pix Front-End — Agent Guide

This repo follows a few core docs. Read them before making architectural or dependency choices:

- [The EF Mandate][mandate] — **mandatory for every agent and human: read it in full before architectural or dependency work, and before any CROPS judgment. When this repo's guidance and the Mandate conflict, the Mandate wins.**
- [`DESIGN.md`](./DESIGN.md) — general **design guidelines** (philosophy, upgrades to adopt, the dApp checklist).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — P2Pix-specific **facts**: the current stack and the concrete blueprint. **Keep this honest on every release** — it is the source of truth for "what we actually ship." The design-baseline compliance scorecard (✅/⚠️/❌) is defined in [`SECURITY.md`](./SECURITY.md).

## Documented deviations

Documented trust deviations (mandatory disclosure copy + escape paths) live in [`SECURITY.md`](./SECURITY.md) — the canonical source. Rule: **any deviation from the four CROPS pillars must be documented, debated in the team, and never silently baked into defaults.** When adding a dependency or third-party service, extend the table in `SECURITY.md` rather than absorbing the trust silently.

## Security & privacy review gate

The gate fires on the **change, not the venue** — before code is written, committed, reviewed, or merged, wherever that happens: a PR, a direct commit, a dependency or submodule bump, a URL or CI edit, or a plan that is still one sentence. It applies when any of these is true:

- `ARCHITECTURE.md` would need an edit after the change merges (state moves between layers, a store or composable changes role, the stack table goes stale).
- A new network call, domain, URL, dependency, or submodule pointer appears.
- `src/config/` or the CI/deploy workflow changes.
- Polling, caching, or fetch behavior changes.
- `DESIGN.md`, `ARCHITECTURE.md` or `SECURITY.md` themselves change.

Run the gate and, **only when it surfaces a delta, write the result where the change lives** (PR body, review, or the commit message for direct commits):

1. Check it against the four CROPS pillars — Censorship Resistance, Open Source & Free, Privacy, Security — using `DESIGN.md` and the recorded deviations in `SECURITY.md`.
2. Per pillar, one line: **no-change** or **regression**, naming anything new (endpoint, dependency, trust root, persistence).
3. If all four pillars come back no-change with nothing new to name, **post nothing** — no `CROPS: no-change` disclaimer, no per-pillar breakdown. The breakdown exists to surface deltas; four identical `no-change` lines are noise, not diligence. A silent no-change result is a correctly-run gate, not a skipped one.
4. Never silently add a trusted third party; never claim a known open gap is resolved unless `ARCHITECTURE.md` says so.

A review of a gated change that surfaced a delta, with no recorded gate result, is incomplete and must not be submitted; a gated-class commit carrying an unrecorded regression must not be pushed. A skipped gate is invisible in the diff — which is exactly why a *delta* must be visible in the artifact.

## Agent rules

- Prefer content-hash / cryptographic anchors (IPFS CID, ENS, signatures) over trusted servers.
- Keep metadata minimization structural (CSP, no-referrer, self-hosted assets), not a policy promise.
- When in doubt, recall the core rule: don't just trust — audit. Surface the verification path, not just the claim.

## Build, verify & release (agent commands)

- Generate contract ABIs: `bun run wagmi:gen`
- Type-check + build: `bun run build` (runs `vue-tsc` then `vite build`).
- Lint: `bun run lint`. Format check: `bun run format:check`.
- Tests: `bun run test`.

[mandate]: https://ethereum.org/content/foundation/mandate/index.md
