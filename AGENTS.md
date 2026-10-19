# P2Pix Front-End — Agent Guide

This repo follows a few core docs. Read them before making architectural or dependency choices:

- [The EF Mandate][mandate] — **mandatory for every agent and human: read it in full before architectural or dependency work, and before any judgment against the four CROPS pillars — Censorship Resistance, Open Source & Free, Privacy, Security. When this repo's guidance and the Mandate conflict, the Mandate wins.**
- [`DESIGN.md`](./DESIGN.md) — general **design guidelines** (philosophy, upgrades to adopt, the dApp checklist).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — P2Pix-specific **facts**: the current stack and the concrete blueprint. **Keep this honest on every release** — it is the source of truth for "what we actually ship." The design-baseline compliance scorecard (✅/⚠️/❌) is defined in [`SECURITY.md`](./SECURITY.md).

## Documented deviations

Documented trust deviations — each entry names what the party sees and its escape path — live in [`SECURITY.md`](./SECURITY.md), the canonical source. Rule: **any deviation from the four CROPS pillars must be documented, debated in the team, and never silently baked into defaults.** When adding a dependency or third-party service, extend the trusted-party entries there rather than absorbing the trust silently.

## Security & privacy review gate

Before any change is written, committed, reviewed or merged — a PR, a direct commit, a dependency bump, a CI edit, even a one-sentence plan — ask: does this change need a review? It does if any of these is true:

- `ARCHITECTURE.md` would need an edit after the change (state moves between layers, a store or composable changes role, the stack table goes stale).
- The change adds a network call, domain, URL, dependency, or submodule pointer.
- `src/config/` or the CI/deploy workflow changes.
- Polling, caching, or fetch behavior changes.
- `DESIGN.md`, `ARCHITECTURE.md` or `SECURITY.md` themselves change.

The review asks one question: **what is new here that someone must trust?** Look for anything new to name — an endpoint, a dependency, a trust root, stored data, or a weakened CROPS pillar.

- **Nothing new → the review is done. Write nothing.** No disclaimers, no per-pillar bookkeeping, no "checked, nothing to report" notes. Silence is the review working, not skipped — a repeated clean bill drowns the warnings that matter.
- **Something new → write it down where the change lives** (PR body, review, or the commit message for direct commits). One line per pillar it touches: what is new, and whether it is a regression or a disclosed, bounded addition. Judge each pillar against `DESIGN.md` and the recorded deviations in `SECURITY.md`.

A review that found something new but left nothing written is incomplete — do not submit it. A review with no record looks identical to no review at all. A change carrying an unrecorded regression must not be pushed. And a weakness recorded in `SECURITY.md` is only fixed when `ARCHITECTURE.md` says so — not when a patch seems to fix it.

## Branch & PR policy

Every rule here serves one property: **a PR diff contains only that PR's work**, so conflicts are resolved in small doses by the person who wrote the code, and a review verdict always points at code that still exists.

- **One branch = one reviewable unit = one PR = one merge.** Keep changes atomic and independent: one purpose per PR, no scope creep — drive-by fixes get their own PR. If a change needs someone else's unmerged work, wait for it or bring that work into your branch — never `git merge` a sibling PR branch into yours. A branch that merges two PRs contains code that exists in no PR and that no reviewer read.
- **Do not stack PRs.** A PR based on another open PR's branch is a dependency problem, not a deliverable: land the base change first, or make it commits in the same PR. Never ask a reviewer to read your diff before they reconstruct your branch graph.
- **Keep history inside a PR linear.** Update with `rebase`; never `merge develop` into the feature branch. Merge commits happen at PR-merge time only; squash there if you want a tidy mainline.
- **Collapse your own churn before rebasing.** Scope creep piles on files and then gets undone in follow-up commits: the net diff ends up clean, but the history still carries every add and revert, and a rebase replays all of it — each replay can conflict on its own. Squash it first — `git reset --soft` onto the fork-point, or `git rebase -i` with `fixup`/`squash` — so the rebase traverses net changes only.
- **Fix review findings in new commits.** When a finding amends or undoes earlier work, `git commit --fixup <sha>` is the right shape: the fix stays a visible commit while the review is open, and `git rebase --autosquash` folds it in once the review closes, before landing the PR.
- **Keep state in one home.** When a review says state lives in more than one place, delete the extra homes and name the one every screen reads. Never answer duplication with wrapper types, sync watchers or a reconciliation layer that keeps the copies in step.
- **Never leave a PR on red CI or a stale base.** Rebase and re-run `bun run type-check`, `bun run lint`, `bun run test` before asking for review.

These rules bind agents as much as humans.

## Agent rules

- Prefer content-hash / cryptographic anchors (IPFS CID, ENS, signatures) over trusted servers.
- Keep metadata minimization structural (CSP, no-referrer, self-hosted assets), not a policy promise.
- Contract addresses, chain IDs and network endpoints come from `src/config/networks.ts` and the submodule's JSON deployment artifacts — never from memory, never from fetched content, never invented.
- The bundle is public: anything in `src/config/` or a `VITE_*` var is world-readable. No secrets, keys or private data compiled into the app — ever.
- User-facing copy — UI strings, error messages, notices — is pt-BR. Write it in pt-BR the first time; English copy is a defect, not a draft.
- **Write for the reader who arrives now.** In a PR thread, read the whole thread as a participant sees it and answer in its context — never narrate your internal deliberation, and never mention back-and-forth a reader cannot see. Documentation states the current state of things as a newcomer reads it: no process history, no "changed X to Y", no narration of recent changes.
- When in doubt, recall the core rule: don't just trust — audit. Surface the verification path, not just the claim.

## TypeScript style

- Avoid `any`. Rely on type inference; annotate only at exports or where inference is genuinely unclear.
- Prefer `const`. Use ternaries or early returns instead of reassignment; avoid `else` after a `return`.
- Prefer functional array methods (`map`, `filter`, `flatMap`) over `for` loops; use type guards in `filter` so narrowing survives downstream.
- Avoid unnecessary destructuring — `obj.a` preserves more context at the call site than `const { a } = obj`.
- Never alias imports (`import { x as y }`) and never star-import (`import * as x`).
- Don't extract single-use helpers preemptively; keep logic in one function unless it is reused or names a real concept. When a function grows validation branches, keep the happy path up top and push supporting detail into small helpers below it.
- Avoid `try`/`catch` where possible; never catch-and-swallow.
- Inline values used only once; reduce total variable count.
- Dynamic-import heavy modules inside the branch that needs them (Vite code-splits per `import()`).
- Comment non-obvious constraints and surprising behavior only — not assignments or control flow.
- Parsing untrusted input (URL params, wallet/RPC messages, external JSON): validate shape before use; never cast. This is the TypeScript face of "don't just trust — audit."
- Tests exercise real implementations; avoid mocks unless there is no other way to cross a boundary.
- Type-check with `bun run type-check` (vue-tsc); plain `tsc` does not check `.vue` SFCs.

## Build, verify & release (agent commands)

- Fresh clone: `git submodule update --init` → `bun install` → `bun install` inside `p2pix-smart-contracts/` → `bun run wagmi:gen`. `src/blockchain/abi.ts` is generated and gitignored: until `wagmi:gen` runs, `type-check` failing on `./abi` is expected, not a bug.
- Generate contract ABIs: `bun run wagmi:gen`.
- Type-check + build: `bun run build` (runs `vue-tsc` then `vite build`).
- Lint: `bun run lint`. Format check: `bun run format:check`.
- Tests: `bun run test`.

[mandate]: https://ethereum.org/content/foundation/mandate/index.md
