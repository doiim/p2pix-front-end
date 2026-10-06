# Showing the buyer's limit per purchase: design and implementation plan

> **Status:** planning only. No source files were changed. Written on 2026-10-06 against branch `reputation` at `854551f`, with the `p2pix-smart-contracts` submodule at `c4414b4`.
> **Language:** the plan is in English. Everything the user sees is in **pt-BR**, matching the app (`index.html:2` is `<html lang="pt-BR">`, and there is no i18n library). Each string has an English gloss.
> **Number check:** every number below comes from a BigInt copy of `Reputation.limiter` (Solmate `sqrt` replicated op for op, EVM `div(x, 0) = 0`, floor division, `/WAD` truncation of the credit). On 2026-10-06, `P2PIX.reputation()`, `limiter(0)`, `limiter(1000)` and `defaultLockBlocks()` were read live with `eth_call` on all four networks. The selectors `0x4d2b1791`, `0x1c18f846` and `0xe10bf1cc` were recomputed with keccak256.

## 1. Summary

The on-chain reputation rule caps how much a buyer can lock in **one purchase**. The buyer cannot see that cap today until they type too much. Even then the number shown is usually wrong: the existing check in `BuyerSearchComponent.vue` passes raw wei to `limiter`, ignores the 100-token bypass, and ignores the 1,000,000-token cap. As a result:

- buyers with any credit are shown about 1,000,256 BRZ on Arbitrum One and 1,000,001 BRZ on the other networks, so the UI lets through amounts the chain will refuse;
- new buyers on **Ethereum mainnet**, Sepolia and Rootstock Testnet are blocked above **1 BRZ**, while the contract allows 100.

**The plan:**

- **A limit line.** The amount card gets one quiet line, **"ⓘ Seu limite por compra: 2.256 BRZ"**, that is always visible.
- **A toggletip.** Tapping the line opens a panel that explains the number: your credit, how the limit grows, and how to verify it on-chain.
- **When the amount is too high.** The line turns red and offers a one-tap **"Usar 2.256 BRZ"**. Pressing **"Confirmar Oferta"** with that amount re-checks the chain, then opens the same explanation instead of starting a transaction that would fail. This is the "tooltip when trying to buy" moment.
- **Where the numbers come from.** Every number is read live from the contracts over the RPC the app already uses: `userRecord`, `reputation()` and `limiter`. The app does not keep its own copy of the formula. This matters because **two different curves are deployed today** (§2.4).
- **No new trust.** The design adds no dependency, no endpoint and no settings page.

---

## 2. How reputation works

### 2.1 In plain words (for designers)

- Each purchase on P2Pix is a **lock**. The buyer reserves tokens from one seller's offer, pays the Pix, and then releases the tokens to themselves.
- If the buyer completes a purchase and releases it themselves, which this app always does, the contract adds the amount bought to the buyer's **credit**.
- Credit sets the **limit per purchase**:
  - A new wallet starts with a small limit.
  - Each completed purchase raises the limit. At first the limit grows by about 2 BRZ for every 1 BRZ bought; it grows more slowly at high values.
  - No reputation can ever lift the limit above **1,000,000 BRZ per purchase**.
- **Purchases of 100 BRZ or less never use reputation.** They are always allowed.
- **Expired purchases halve your credit.** If a purchase expires without the Pix and its tokens are returned to the seller, the credit is cut in half, but never below 100 BRZ. So any credit up to 200 BRZ ends at exactly 100. Quirk: a wallet with **less than 100** BRZ of credit, including a brand-new wallet, goes **up** to 100. A new wallet whose first reservation expires therefore gets a higher limit: 201 BRZ on BASE-1 networks and 456 on Arbitrum.
- **The limit applies to each purchase, not to a day or a running total.**
- **Each address and each network has its own credit:**
  - A MetaMask address and a passkey smart account are two separate reputations.
  - Arbitrum One and Ethereum are two separate reputations.

### 2.2 The exact rule `lock()` enforces

`p2pix-smart-contracts/contracts/p2pix.sol:141-199`. The relevant branch is at `:167-186`.

```
if merkleProof.length != 0:                          // :167  seller allow-list path
    _merkleVerify(...)                               //       no reputation check, no cap
else if amount > REPUTATION_LOWERBOUND               // :174  amount > 100e18
     and msg.sender == _msgSender():                 // :175  not relayed by a trusted forwarder
    userCredit = userRecord[_castAddrToKey(sender)]  // :178-180 raw wei
    spendLimit = _limiter(userCredit / WAD)          // :181  whole tokens, floored
    if amount > spendLimit * WAD                     // :183
       or amount > LOCKAMOUNT_UPPERBOUND:            // :184  1e24 = 1,000,000 tokens
        revert AmountNotAllowed()                    // :185  selector 0x1c18f846
```

- **The key.** `_castAddrToKey(addr) = uint256(uint160(addr)) << 12` (`contracts/core/BaseUtils.sol:164-171`). In TypeScript: `BigInt(addr) << 12n`.
- **`userRecord`.** A public mapping, `mapping(uint256 => uint256) public userRecord` (`p2pix.sol:28`).
- **`_limiter`.** It makes a raw `staticcall`, with selector `0x4d2b1791`, to whatever address is stored in `reputation`. If that call fails, it reverts with `StaticCallFailed()` (`0xe10bf1cc`) (`contracts/core/OwnerSettings.sol:209-240`).
  - **Caveat: an address with no code does not fail.** If `reputation` is ever set to the zero address or an EOA, the `staticcall` *succeeds* with empty return data. Nothing is copied to memory, and `_spendLimit := mload(0x00)` reads leftover scratch memory, probably the mapping key from the `userRecord` lookup, a huge number. The on-chain limit is then undefined, and probably only the 1,000,000 cap applies. It is **not** `StaticCallFailed`. The UI's own `eth_call` to such an address returns `0x`, which viem reports as a zero-data error and maps to L8. L8 never blocks, so the UI is still never stricter than the chain.
- **`reputation`.** A public getter (`OwnerSettings.sol:24`). The owner can replace it at any time with `setReputation` (`OwnerSettings.sol:95-102`, `onlyOwner`), which emits `ReputationUpdated(address)` (`contracts/core/EventAndErrors.sol:68`).
- **Equality passes.** The contract reverts only on `>`, so an amount exactly equal to the limit is allowed.
- **Order of checks in `lock()`** (`:148-160`):
  1. `unlockExpired(expiredLocks)`. This app always passes `[]` (`buyerMethods.ts:112`, `:138`), so its own lock never halves the buyer's credit inside the same transaction.
  2. `getValid`, which reverts with `InvalidDeposit` when the seller paused the offer.
  3. `getBalance < amount`, which reverts with `NotEnoughTokens` (`0x22bbb43c`).
  4. The reputation branch above.

  So a refusal *for the limit* can only happen when the chosen offer still covers the amount. If the offer shrank as well, the user gets `NotEnoughTokens`, and the UI must not blame reputation.
- **The effective maximum for one lock sent from this app:**
  ```
  maxTokens = max(100, min(limiter(floor(userRecord / 1e18)), 1_000_000))
  ```
  - It is **inclusive**.
  - It is also bounded by the chosen seller's remaining balance.
  - It is also bounded by `uint80`, about 1,208,925 tokens. That bound is irrelevant because the 1,000,000 cap is lower.

### 2.3 Formula and constants

`p2pix-smart-contracts/contracts/Reputation.sol:8-30`:

```
limiter(c) = BASE + (maxLimit * c) / sqrt(magicValue + c*c)     // integer floor division, floor sqrt
maxLimit   = 1e6                                                 // :8
magicValue = 2.5e11  (= 500,000²)                                // :10
BASE       = 256 in source at HEAD                               // :25
```

- **Shape.** The formula is equivalent to `BASE + 2c / sqrt(1 + (c/500000)²)`. That is roughly `BASE + 2c` while `c` is well below 500k, and it approaches `BASE + 1,000,000` as `c` grows.
- **`sqrt`.** It is Solmate's floor square root (`:34-78`).
- **What can be read on-chain.** `maxLimit` and `magicValue` are `public constant`, so the module has getters for them. BASE is a bare literal with no getter, so the only way to read it is `limiter(0)`.

Constants from `p2pix-smart-contracts/contracts/core/Constants.sol`. They are `internal constant`, so **no function returns them**:

| Constant | Line | Value | Whole tokens |
|---|---|---|---|
| `WAD` | `:49` | `1e18` | the 18-decimals scalar ("The scalar of BRZ token") |
| `REPUTATION_LOWERBOUND` | `:52-53` | `1e2 ether` | 100 (bypass threshold, and the floor after halving) |
| `LOCKAMOUNT_UPPERBOUND` | `:54-55` | `1e6 ether` | 1,000,000 (hard cap per lock) |
| `MAXBALANCE_UPPERBOUND` | `:50-51` | `1e8 ether` | 100,000,000 (seller deposit cap; not used by this UI) |

All four configured tokens use 18 decimals, and so does the whole app (`parseEther` in `src/blockchain/buyerMethods.ts:103`).

### 2.4 Two curves are live today

Submodule commit `baab36e` (2026-09-15, "raise initial reputation changüí") changed BASE from 1 to 256. Only Arbitrum runs the new curve. Values read with `eth_call` on 2026-10-06:

| Network (env) | P2PIX `reputation()` returns | `limiter(0)` | `limiter(1000)` | `defaultLockBlocks` | Address source |
|---|---|---|---|---|---|
| Ethereum (production) | `0x9c64be539ebd1feee8909e93e5b756158874ce44` | **1** | 2001 | 1,000 (≈3.3 h) | matches `ignition/deployments/chain-1/deployed_addresses.json` |
| Arbitrum One (production) | `0xc40356e14842e951a2a1f156d5be28cc6e4c2697` | **256** | 2256 | 350,000 (`block.number` is L1-based there: ≈48 days) | matches `ignition/deployments/chain-42161/deployed_addresses.json` |
| Sepolia (development) | `0x1bb52d8d843b6fdd2c55db14ecb90118408acc97` | **1** | 2001 | 1,000 | Reputation is in no artifact (only P2PIX and MockToken); read on-chain only |
| Rootstock Testnet (development) | `0x0de833adca15155be05cb715cf01dfee5acd17ca` | **1** | 2001 | **10** (minutes) | Reputation is in no artifact (only P2PIX and MockToken); read on-chain only |

**Source does not prove what is deployed.** The Arbitrum artifact was committed in `7ac08f3` (2026-06-29), before `baab36e` (2026-09-15) changed BASE to 256 in source. Yet the Arbitrum module returns 256. Either the module was deployed from uncommitted source or the artifact was rewritten later. The deployed bytecode was not compared with source; only `limiter` outputs were checked. The lock rule in `p2pix.sol` was read from source only; no `lock` was simulated against the deployed P2PIX contracts. This is one more reason to read on-chain.

Consequences:

- **Never hard-code "256".** A new wallet's effective limit is **256 BRZ on Arbitrum One** and **100 BRZ** (the bypass) on Ethereum, Sepolia and Rootstock Testnet.
- **The UI must not hard-code the module address or the formula.** Read `reputation()` from P2PIX, then call `limiter` on the address it returns.

### 2.5 Limit tables

Credit and limits are in whole tokens. "Effective" includes the 100 bypass and the 1,000,000 cap. All three tables were recomputed on 2026-10-06 with the BigInt replica and match.

| Credit | `limiter`, BASE 256 (Arbitrum) | `limiter`, BASE 1 (Ethereum / Sepolia / RSK-t) | Effective, BASE 1 |
|---:|---:|---:|---:|
| 0 | 256 | 1 | **100** |
| 1 | 258 | 3 | **100** |
| 10 | 276 | 21 | **100** |
| 49 | 354 | 99 | **100** |
| 50 | 356 | 101 | 101 |
| 100 | 456 | 201 | 201 |
| 250 | 756 | 501 | 501 |
| 500 | 1,256 | 1,001 | 1,001 |
| 1,000 | 2,256 | 2,001 | 2,001 |
| 5,000 | 10,255 | 10,000 | 10,000 |
| 10,000 | 20,252 | 19,997 | 19,997 |
| 50,000 | 99,759 | 99,504 | 99,504 |
| 100,000 | 196,372 | 196,117 | 196,117 |
| 500,000 | 707,363 | 707,108 | 707,108 |
| 1,000,000 | 894,683 | 894,428 | 894,428 |
| 10,000,000 | 999,008 | 998,753 | 998,753 |

On BASE 256 the effective limit equals `limiter` across this whole range, because every value is above 100 and below 1,000,000.

Minimum credit needed to reach a target limit:

| Target limit | Credit, BASE 256 | Credit, BASE 1 |
|---:|---:|---:|
| 500 | 122 | 250 |
| 1,000 | 372 | 500 |
| 3,000 | 1,373 | 1,500 |
| 5,000 | 2,373 | 2,500 |
| 10,000 | 4,873 | 5,000 |
| 100,000 | 50,122 | 50,252 |
| 1,000,000 (cap) | 22,092,000 | 353,107,168 |

If the buyer buys the maximum every time and releases it themselves, the limit grows like this:

| Curve | Ladder |
|---|---|
| BASE 256 | 256 → 768 → 2,303 → 6,909 → 20,723 → 62,055 → 183,146 → 483,733 |
| BASE 1 | 100 → 201 → 603 → 1,809 → 5,426 → 16,276 → 48,772 → 144,831 |

### 2.6 How credit grows and shrinks

- **Growth** happens in `release()` (`p2pix.sol:243-256`), and only when the release is not relayed (`_msgSender() == msg.sender`):
  - If the buyer releases: `userRecord[buyer] += amountWei`.
  - If someone else releases: the caller and the buyer each get `amountWei >> 1`.
  - A release relayed through a forwarder credits nobody.
  - This app always releases as the buyer, so the buyer gets full credit. Both rails check this before releasing (`buyerMethods.ts:212-214`, `:245-247`).
  - The NatSpec at `p2pix.sol:205-211` about "relayerPremium" is stale.
- **Shrink** happens in `unlockExpired()` (`p2pix.sol:273-321`, halving at `:298-306`). For each expired lock that is returned, `rec = rec >> 1`, and if the result is ≤ 100e18 it is set to exactly 100e18.
  - **Anyone** can call `unlockExpired`, and `lock` and `withdraw` call it too. So the limit can drop between the moment the UI reads it and the moment the buyer signs.
  - Any record up to 200e18 + 1 wei ends at exactly 100 tokens:
    - below 100, it is **raised** to 100;
    - at 100, it is **held**;
    - between 100 and 200, it is **lowered** to 100.
  - **Copy must never say "expiring always lowers your limit".**
  - The limit can also **rise** between read and sign. Examples: the buyer completes a purchase in another tab, or a credit-0 wallet has an expired lock returned (credit 0 → 100, effective limit 100 → 201 on BASE 1, 256 → 456 on Arbitrum). The re-read before blocking (§3.6) covers both directions.

### 2.7 Bypasses and edge rules

| Path | Effect on chain | Reachable from this app? | UI consequence |
|---|---|---|---|
| Amount ≤ 100 tokens | no reputation check (100.00 passes; 100.01 is checked) | yes | effective limit is never below 100; the panel notes it |
| Merkle allow-list proof | no reputation check and **no cap** | **no**: the app always sends `[]` (`buyerMethods.ts:112`, `:138`) | never mentioned to users |
| ERC-2771 trusted forwarder | no check and no cap; a forwarded release earns no credit | **no**: the app uses no forwarder | never mentioned |
| Passkey / e-mail smart account (ERC-4337) | `msg.sender` is the Kernel account, which is not a forwarder, so **the check applies** | yes | the limit belongs to the smart-account address |
| Hard cap of 1,000,000 | reverts for every reputation | yes | own message when it is the binding bound |
| Several open locks | each is checked on its own; open locks don't use up the limit, and credit changes only on release or return | **yes**. When an Active lock exists, the app only nudges ("Existe uma compra em aberto. Continuar?", `HomeView.vue:115-127`, `:173-178`, `CustomAlert.vue:31-32`). The alert can be dismissed and a second lock started. | never subtract open locks from the limit; copy always says "por compra" |
| Offer smaller than the amount at lock time | `NotEnoughTokens`, checked **before** reputation (§2.2) | yes (the offer can shrink after the liquidity read) | not a reputation refusal; keep today's behaviour and never show L9 for it |
| Offer paused by the seller | `InvalidDeposit`, before reputation | yes: `getBalance` ignores the valid bit, so a paused offer still counts as liquidity (`p2pix.sol:435-455`, `events.ts:120-139`) | same as above |
| `reputation` points at an address with no code | undefined limit on-chain (§2.2 caveat) | only if the owner misconfigures it | L8; never block |

### 2.8 Which address and which network

- **Which address.** The key is the address that calls `lock`. In this app that is `useUser().walletAddress` (`src/composables/useUser.ts:8`), set through `getEffectiveWalletAddress` (`src/blockchain/aa/operations.ts:93-100`):
  - On the smart-account rail it is the **Kernel account**.
  - On the EOA rail it is the **connector EOA**.
  - On a network without an `aa` block (Rootstock Testnet today), `getEffectiveWalletAddress` falls back to the connector address, and `lock` goes over the EOA rail from that address. So the rule "read the address that will call `lock`" still holds.
  - The effective address is written only once it has resolved. It starts as `null`, and on an account or network change the previous value stays until the new one resolves (`TopBar.vue:61-116`). It is set to `null` if resolution fails.
  - Never use `getContract().account` (`src/blockchain/provider.ts:51-52`). It is the wallet client's first address, the connector's own account. On the smart-account rail that is the Reown EOA signer, or whatever account the passkey connector exposes (`@doiim/passkeys`, not inspected here). It is not the Kernel account that calls `lock`.
- **Which network.** Reads go through the **selected** network's public client (`provider.ts:22-25`), even when the wallet is on another chain. That is the network the purchase will run on after "Trocar rede".

### 2.9 What the app does today (and why the numbers it shows are wrong)

The code is in `src/components/BuyerSteps/BuyerSearchComponent.vue` (BSC). Problems in order of impact:

1. **Wrong units** (BSC:97-102). Raw `userRecord` wei is passed to `limiter`, but the contract divides by 1e18 first (`p2pix.sol:181`). Any buyer with credit sees about **1,000,256** (Arbitrum) or **1,000,001** (other networks). This includes every wallet that had a reservation returned, since that leaves at least 100e18. So the UI never blocks them, and amounts between the real limit and that number fail at simulation (EOA) or bundler estimation (smart account).
2. **No 100 bypass and no cap.** On BASE-1 networks, **including Ethereum mainnet in production**, a new wallet is shown "Limite máximo: 1 BRZ", and the button is disabled for anything above 1. The contract allows 100.
3. **Race on the button.** BSC:131 sets `enableConfirmButton = !exceeds` after `verifyLiquidity` has run. This can enable the button when no offer exists. The watchers at BSC:210-217 can also re-enable it while the amount is over the limit.
4. **Errors are swallowed into made-up values** (BSC:67-70, 84-87, 105-108). A failed read becomes credit 0 or "Limite máximo: 0 BRZ".
5. **Three sequential RPC calls per keystroke.** The debounce at BSC:262 builds a new debounced function on every event, so it never debounces. The limit does not depend on the amount anyway.
6. **A refused lock is silent.** `HomeView.vue:63-79` logs the error, returns to the search step, and the typed amount resets to 0. No code in `src` decodes reverts.
7. **The form can submit from the wrong button.** The token pill (BSC:268) is a `<button>` with no `type`, so inside the `<form>` it is a submit button. It comes before the CTA in tree order, so under the HTML implicit-submission rules it is also the form's *default* button. Pressing Enter in either field, or clicking the pill, can run `handleSubmit` while "Confirmar Oferta" is disabled.
   - The browser's constraint validation runs first. The amount is `required`, and the CPF is `required` with a `pattern`. So the bypass happens only once both fields are valid.
   - From there, `emitConfirmButton` emits `tokenBuy` whenever an offer exists, whatever the reputation check said.
   - Clicking the pill also opens the token dropdown.
   - (The CTA is `CustomButton`, which renders `type="button"`. BSC:400 passes `type="submit"`, which Vue applies to the root `<button>` as a fallthrough attribute and which overrides it.)
   - **Confirm this in a browser.**

---

## 3. Design brief for Claude Design

> Copy everything from here to the end of §3 into Claude Design. It is self-contained.

### 3.1 Product context

**P2Pix** is a non-custodial dApp for buying Brazilian-real stablecoins (shown as **BRZ**) with **Pix**, Brazil's instant payment system.

**How a purchase works:**
1. The buyer types an amount.
2. The app picks a seller's on-chain offer on the selected network.
3. The buyer reserves ("lock") the tokens.
4. The buyer pays the Pix QR.
5. The buyer releases the tokens to their own wallet.

**The rule this design surfaces.** A smart contract caps how much one wallet can reserve **in a single purchase**, based on that wallet's reputation on that network:

- New wallets start at **256 BRZ** on Arbitrum One and **100 BRZ** on Ethereum and the testnets.
- Every completed purchase raises the limit.
- Purchases of 100 BRZ or less are always allowed.
- Nobody can reserve more than **1.000.000 BRZ** at once.

**The audience** includes first-time crypto buyers on phones. The UI language is **Brazilian Portuguese**.

**Goal:** answer *"how much can I buy?"* before the user types too much, and explain it at the moment they try to buy, **without adding noise** to a form that is short and calm today.

### 3.2 Visual language (exact tokens)

**Platform and type**

- **Framework:** Tailwind v4, stock palette, through `@tailwindcss/vite` and `@import "tailwindcss"` (`src/assets/main.css:2`). `tailwind.config.js` is a v3 leftover. v4 does not load it, because there is no `@config`, and it is empty anyway. Hex values are sRGB conversions of v4's OKLCH values; they are not v3 hex values. The existing SVG icons and `.custom-divide` hard-code v3 hex values (`#6B7280`, `#EF4444`, `#10B981`, `#d1d5db`).
- **Theme:** one designed theme, white cards on a dark indigo gradient, with no dark/light switch. **But the OS dark mode leaks in.**
  - `base.css:37-49` changes the body text colour to `rgba(235,235,235,.64)` under `prefers-color-scheme: dark`.
  - Tailwind v4's preflight makes `<button>` inherit `color`.
  - v4's `dark:` variant follows the OS setting (`SpinnerComponent.vue:16`).
  - So **every new text element and text button must set an explicit colour class**, or it turns near-white on the white card for dark-mode users. Mock the light-mode look only.
- **Font:** the system UI stack (SF Pro, Segoe UI, Roboto). Inter is first in the stack but no webfont is loaded (`base.css:66`), so it renders only where Inter is installed locally.
  - Body text is 15px with line-height 1.6.
  - Tailwind's `text-*` sizes are rem on a 16px root.

| Role | Value |
|---|---|
| Page background | `radial-gradient(ellipse at 50% -50%, #312E81 60%, #181E2A 80%)` |
| Glass container (`.main-container`, `main.css:26-28`) | no fill; 1px border gray-500 `#6a7282`; backdrop blur 12px; radius 8px; `shadow-lg` + `drop-shadow-lg`; max-width 512px **only from 768px** (`md:max-w-lg`), full width below; padding 32×24 (≥640px) / 16×16 (<640px); 16px gap between children. The page `<main>` adds 12 / 16 / 32px padding at <640 / ≥640 / ≥768px (`App.vue:12`) |
| Cards | `#ffffff`; radius 8px; padding 40×20 (desktop) / 24×20 (mobile) |
| Text, primary | gray-900 `#101828` (17.8:1 on white) |
| Text, labels / body secondary | gray-600 `#4a5565` (7.6:1 on white, 6.9:1 on gray-100) |
| Text, secondary values ("~ R$") | gray-500 `#6a7282` (4.8:1 on white; **do not use on gray-100**: 4.4:1) |
| Captions | gray-400 `#99a1af` (decorative only) |
| Divider | 1px `#d1d5db` |
| Subtle surface | gray-100 `#f3f4f6`; gray-200 `#e5e7eb`; gray-300 `#d1d5dc` |
| Primary action | amber-400 `#ffb900` fill + 2px border, gray-900 text, 16px semibold, padding 16 (≈60px tall), radius 8. Hover: amber-500 `#fe9a00` + scale 1.02. Disabled: 70% opacity |
| Button loading (`CustomButton` `loading`) | the label is **replaced** by a 20px ring (2px gray-900, transparent top, spinning); the button is `disabled`, so it shows 70% opacity and cannot hold focus |
| Outline action | transparent, 2px border `#ffb900`, gray-900 text; hover fill `#ffb900` at 10%. The amber border is only 1.7:1 on white; the label carries the meaning |
| Secondary action | gray-200 fill, 2px gray-300 border; hover gray-300 / gray-400 |
| Ghost action | transparent; hover gray-100 |
| `CustomButton` sizes | `sm`: 12px text, `px-2 py-1`, ≈28px tall. `md`: 14px, `px-3 py-2`, ≈40px. `xl` (default): 16px, `p-4`, ≈60px. **No size reaches 44px below `xl`**, so a 44px mobile target needs an extra `min-h-11` |
| Token pill | gray-300 fill, hover gray-200, radius 24, padding 8; 32px token icon (16px on mobile), "BRZ" 18px medium, chevron |
| Error text, existing lines | red-500 `#fb2c36`, 14px, centred (**3.8:1, below AA**) |
| Error text, **new** status line | red-700 `#c10007` (6.4:1) |
| Warning text | amber-800 `#973c00` (7.1:1) |
| Success | emerald-500 `#00bc7d` (existing tooltip border; **2.5:1 on white, so not for text**); emerald-600 `#009966` (bar fill, 3.3:1 on gray-100); emerald-700 `#007a55` (5.4:1) for any new success **text** |
| Focus ring | 2px indigo-800 `#372aac` (10:1) |
| Radii | 4 (chips), 8 (cards, buttons), 12 (dropdowns, popovers), 24 (pills) |
| Shadows | dropdowns: `shadow-md` + `drop-shadow-md`; container: `shadow-lg` |
| Icons (self-hosted SVG) | `info.svg` 14px `#6B7280` (circled i); `invalidIcon.svg` 16px `#EF4444` (x-circle); `validIcon.svg` 16px `#10B981`; `chevronDown.svg` 16px `currentColor`. The first three have hard-coded fills and cannot be recoloured by a class |
| "Copiado!" chip (existing, `TransactionTable.vue:144`) | emerald-500 12px semibold on white, 4px radius, `shadow-sm`. At **2.5:1 it fails AA**, so the new chip uses emerald-700 text |
| Spinner (existing `SpinnerComponent`) | 16px ring, gray-200 track (gray-600 in OS dark mode), **white** head, spinning. On the white card the head is invisible, so for the new L2 row use a 16px ring with a gray-300 track and a gray-600 head |
| Motion | dropdowns fade and slide 10px over 0.3s; page changes fade and slide 15px. **No existing CSS respects `prefers-reduced-motion`**; the new pieces must (`motion-reduce:`) |

**Type sizes**

| Element | Size and weight |
|---|---|
| Hero | 48px (30px mobile), extrabold, white |
| Hero subtitle | 16px (14px mobile), medium, white |
| Amount input | 20px semibold |
| Secondary rows | 14px |
| Captions | 12px |

### 3.3 The buy screen today (desktop ≥768px, wallet connected, new wallet on Ethereum, real copy)

```
[P2Pix logo]                         Menu   Quero vender   [(net) Ethereum v]  [0x1a2...9f3e v]
                                                            pills: 2px amber-500 border, 40px tall

                        Adquira cripto com apenas um Pix          <- 48px extrabold white
          Digite um valor, confira a oferta, conecte sua carteira e
                     receba os tokens após realizar o Pix         <- 16px medium white

  +-- glass container (blur, 1px #6a7282, r8, max-w 512, px32 py24, gap16) --+
  | +-- white card r8 px40 py20 -------------------------------------------+ |
  | | 150                                             ( (o) BRZ  v )       | |  20px semibold | gray-300 pill
  | | -------------------------------------------------------------------- | |  1px #d1d5db
  | | ~ R$ 150.00                                            (eth)(arb)    | |  14px #6a7282 | 24px icons of networks with an offer >= amount
  | |  O valor excede o limite permitido pela sua reputação. Limite        | |  ONLY reputation UI today:
  | |  máximo: 1 BRZ                                                       | |  red-500, ~0.5s after typing; number wrong (contract allows 100)
  | +----------------------------------------------------------------------+ |
  | +-- white card r8 px40 py16 -------------------------------------------+ |
  | | Digite seu CPF ou CNPJ (somente números)                             | |  18px (14px mobile)
  | +----------------------------------------------------------------------+ |
  | [                           Confirmar Oferta                           ] |  amber-400; disabled = 70% (disabled here)
  +--------------------------------------------------------------------------+
```

The same buyer with any credit would see no message at all below about 1,000,001 BRZ. The network icons appear only when a wallet is connected and the amount is above 0, because guests never compute offers (BSC:185). "Menu" and "Quero vender" show only from 768px (`md:`). Between 640 and 767px the top bar has no text links, and the glass container is full width.

**Other existing messages in the amount card** (red-500, 14px, centred):

| Copy | English gloss |
|---|---|
| "Por favor utilize no máximo 2 casas decimais" | please use at most 2 decimals |
| "Atualmente não há liquidez nas redes selecionadas para sua demanda" | no liquidity for this amount |
| "Carregando liquidez das redes." + 16px `SpinnerComponent` (this row is gray-900, not red; it replaces the "~ R$" row while loading) | loading liquidity |

**Other states of the screen**

- **Not connected:** the CTA reads "Conectar carteira" (connect wallet).
- **Mobile (<640px):**
  - The same stack at full width.
  - Top bar: `[logo] … [(net icon) v] [Entrar]`; the network name is hidden below 640px.
  - At every width, a wallet on another chain shows the fixed bottom bar "Rede incorreta! Troque para {rede}. [Trocar rede]" (red-500, `z-50`, about 72px tall, `ToasterComponent.vue:46-61`). On a phone it can cover the CTA.
  - Hero 30px.
  - The amount card's inner width is about 256px on a 360px phone.

### 3.4 What to design

Four pieces, all in the existing amount card and buy flow. **No new page, no modal, no new route.**

1. **Limit line.** A new third row in the amount card, under "~ R$ …". It replaces the red reputation error.
   - **Left: the trigger.** A text button: `ⓘ` + sentence + small chevron.
   - **Right: the quick-fill.** An outline **"Usar X BRZ"** button, shown only when the amount is over the limit.
2. **Details panel** (a toggletip).
   - It opens **inline** under the limit line, inside the amount card, on tap, click or Enter. It never opens on hover.
   - It has a small caret pointing up at the ⓘ.
   - It has two collapsed disclosures: **"Como funciona"** and **"Como verificar"**.
3. **"Trying to buy" behaviour.** "Confirmar Oferta" is **never disabled because of reputation**.
   - Pressing it while over the limit:
     1. shows the button's loading spinner while the app re-reads the chain (≤ 1s typical);
     2. then opens the details panel in its *over* variant;
     3. moves focus to "Usar X BRZ".
   - No transaction starts.
   - If a stale limit lets the contract refuse anyway, the user lands back on this screen with the amount kept and a red "recusou" line.
4. **Purchase complete.** One extra line on the confirmation screen: the new limit.

### 3.5 Copy deck (pt-BR, with English gloss)

**Placeholders**

| Placeholder | Meaning | Format / values |
|---|---|---|
| `{max}` | effective limit | pt-BR integer: `Intl.NumberFormat('pt-BR')` → "2.256", "1.000.000" |
| `{valor}` | typed amount | pt-BR, up to 2 decimals: "1.500", "2.256,01" |
| `{alvo}` | quick-fill target | min(limit, largest offer on this network), floored to 0,01 |
| `{rede}` | network name | "Ethereum", "Arbitrum One", "Sepolia", "Rootstock Testnet" |
| `{curto}` | short address | `0x1a2...9f3e` (first 5 + "..." + last 4, as in the top bar) |
| `{novo}` | new-wallet limit | `max(100, min(limiter(0), 1e6))`: 256 on Arbitrum One, 100 elsewhere today |
| `{credito}` | credit | whole tokens, floored like the contract |
| `{proximo}` | effective limit after buying `{max}` | read on-chain, bounds applied |
| `{pct}` | share of the limit used | floored integer; "<1" when it is between 0 and 1 |
| `{excesso}` | amount − limit | pt-BR, up to 2 decimals |
| `{oferta}` | largest offer on this network | pt-BR, floored to 0,01; excludes the buyer's own offers |
| `{conta}` | account kind | "carteira" or "conta inteligente" |
| `{bloco}` | block the snapshot was read at | integer; the L2 block number on Arbitrum |
| `{atual}` / `{antigo}` | limit after / before the last purchase | used only by `confirmed.newLimit` (do **not** reuse `{novo}` there) |

**Limit line**

| Key | pt-BR | English gloss |
|---|---|---|
| `line.guest` | ⓘ Carteiras novas: até **{novo} BRZ** por compra | New wallets: up to {novo} BRZ per purchase |
| `line.guestOver` | ⓘ Carteiras novas: até **{novo} BRZ** por compra. Conecte para ver o seu limite. | …Connect to see your limit. (shown in gray, never red) |
| `line.guestUnknown` | ⓘ Como funciona o limite por compra | How the per-purchase limit works (guest read failed) |
| `line.loading` | Verificando seu limite… | Checking your limit… |
| `line.ready` | ⓘ Seu limite por compra: **{max} BRZ** | Your per-purchase limit: {max} BRZ |
| `line.atLimit` | ⓘ Você vai usar todo o seu limite por compra (**{max} BRZ**) | You'll use your whole per-purchase limit |
| `line.over` | ⊗ **{valor} BRZ** passa do seu limite por compra de **{max} BRZ**. | {valor} BRZ is over your per-purchase limit of {max} BRZ. |
| `line.overCap` | ⊗ O contrato aceita no máximo **1.000.000 BRZ** por compra. | The contract accepts at most 1,000,000 BRZ per purchase. |
| `line.error` | Não foi possível verificar seu limite agora. **Tentar de novo** | Couldn't check your limit right now. Try again |
| `line.module` | O módulo de reputação de {rede} não respondeu. Compras de até 100 BRZ continuam disponíveis. **Tentar de novo** | The reputation module on {rede} didn't respond. Purchases up to 100 BRZ still work. |
| `line.refused` | ⊗ O contrato recusou esta compra: seu limite atual é de **{max} BRZ**. | The contract refused this purchase: your current limit is {max} BRZ. |
| `line.refusedUnknown` | ⊗ O contrato recusou esta compra porque o valor passa do seu limite. **Tentar de novo** | …refused because the amount is over your limit. |

**Actions**

| Key | pt-BR | English gloss |
|---|---|---|
| `action.fill` | Usar {alvo} BRZ | Use {alvo} BRZ. `aria-label`: "Preencher com {alvo} BRZ, o máximo desta compra" |
| `action.retry` | Tentar de novo | Try again |

**Details panel**

| Key | pt-BR | English gloss |
|---|---|---|
| `panel.title` | Seu limite por compra em {rede} | Your per-purchase limit on {rede} |
| `panel.titleGuest` | Limite por compra em {rede} | Per-purchase limit on {rede} |
| `panel.usage` | Esta compra usa {valor} de {max} BRZ ({pct}%). | This purchase uses {valor} of {max} BRZ. `pct` is floored; show "<1%" when it is between 0 and 1 |
| `panel.usageEmpty` | Digite um valor para ver quanto do limite ele usa. | Type an amount to see how much of the limit it uses. |
| `panel.usageOver` | Esta compra passa {excesso} BRZ do seu limite. | This purchase is {excesso} BRZ over your limit. |
| `panel.free` | Compras de até 100 BRZ não usam reputação. | Purchases up to 100 BRZ don't use reputation. (shown when 0 < amount ≤ 100) |
| `panel.why` | Seu crédito de reputação em {rede} é de **{credito} BRZ**, calculado pelo contrato a partir do seu histórico de compras. | Your reputation credit on {rede} is {credito} BRZ, computed by the contract from your purchase history. (Not "from purchases you completed": an expired reservation alone sets the credit to 100.) |
| `panel.whyOver` | O contrato P2Pix recusa compras acima deste limite. Ele vem da sua reputação em {rede} (crédito: {credito} BRZ). | The contract refuses purchases above this limit; it comes from your reputation (credit…). |
| `panel.new256` | Esta {conta} ainda não tem crédito de reputação em {rede}. Toda carteira começa com {novo} BRZ por compra. | This {account} has no reputation credit on {rede} yet. Every wallet starts at {novo} BRZ per purchase. (Used when `{novo}` > 100, which is Arbitrum today; never hard-code 256.) |
| `panel.new100` | Esta {conta} ainda não tem crédito de reputação em {rede}. Compras de até 100 BRZ não precisam de reputação. | …Purchases up to 100 BRZ need no reputation. (Used when `{novo}` = 100.) |
| `panel.next` | Comprando {max} BRZ (o máximo) e concluindo a compra, seu limite passa para cerca de **{proximo} BRZ**. | Buying {max} BRZ (the maximum) and completing it, your limit goes to about {proximo} BRZ. |
| `panel.capReached` | Você atingiu o máximo do contrato: 1.000.000 BRZ por compra. | You reached the contract's maximum. |
| `panel.offer` | Maior oferta em {rede} agora: **{oferta} BRZ**. Cada compra usa uma única oferta. | Largest offer on {rede} now: {oferta} BRZ. Each purchase uses one offer. (only when offer < limit) |
| `panel.refused` | Seu limite mudou desde a última leitura. Isso acontece, por exemplo, quando uma reserva expirada é devolvida: o crédito cai pela metade (nunca abaixo de 100 BRZ). | Your limit changed since the last read, e.g. when an expired reservation is returned… |
| `panel.error` | Não conseguimos ler sua reputação em {rede}. Você pode continuar: o contrato confere o limite e, se o valor passar dele, a compra é recusada antes da assinatura, sem custo. | We couldn't read your reputation. You can continue: the contract checks the limit and refuses before you sign, at no cost. **Holds only if the refusal surfaces at pre-sign simulation (EOA) or bundler estimation (smart account).** Confirmed for EOA by reading the code (`buyerMethods.ts:134-140`); unverified for the smart-account rail (§5.4). If that check fails, drop "antes da assinatura, sem custo". |
| `panel.guest` | O P2Pix limita o valor de cada compra pela reputação da carteira em cada rede. Carteiras sem histórico compram até {novo} BRZ por compra, e cada compra concluída aumenta esse limite. Conecte sua carteira para ver o seu. | P2Pix caps each purchase by the wallet's reputation on each network… |
| `panel.accountEoa` | Limite da carteira {curto} em {rede}. Cada endereço e cada rede têm sua própria reputação. | Limit of wallet {curto} on {rede}. Each address and network has its own reputation. |
| `panel.accountAa` | Limite da sua conta inteligente {curto} em {rede}. Ela não herda a reputação de outras carteiras, e cada rede tem a sua. | Limit of your smart account… It doesn't inherit other wallets' reputation, and each network has its own. |
| `panel.howTitle` | Como funciona | How it works |
| `panel.verifyTitle` | Como verificar | How to verify |

In `panel.new256` and `panel.new100`, `{conta}` is "carteira" (wallet) or "conta inteligente" (smart account).

**"Como funciona" bullets** (12px gray-600)

| pt-BR | English gloss |
|---|---|
| Cada compra acima de 100 BRZ é conferida pelo contrato P2Pix contra o limite do seu endereço nesta rede. | Every purchase above 100 BRZ is checked by the contract. |
| Toda carteira começa com {novo} BRZ por compra. Cada compra concluída soma o valor ao seu crédito e aumenta o limite; o aumento desacelera em valores altos. | Every wallet starts at {novo}; each completed purchase raises it; growth slows at high values. |
| Se uma reserva expira sem o Pix e é devolvida ao vendedor, seu crédito é dividido por dois; se o resultado ficar abaixo de 100 BRZ, ele passa a ser 100 BRZ. | An expired, returned reservation halves your credit; if the result is under 100 BRZ it becomes 100 BRZ. (Worded so it stays true when the credit was under 100 and goes **up**.) |
| O teto é de 1.000.000 BRZ por compra, para qualquer reputação. O limite vale por compra, não é um total diário. | Cap of 1,000,000 per purchase; per purchase, not a daily total. |
| A reputação é pública: qualquer pessoa pode consultar o crédito de um endereço. | Reputation is public. |
| O administrador do contrato P2Pix pode trocar o módulo de reputação; por isso este app lê o limite direto do contrato. | The contract owner can swap the reputation module, which is why the app reads it from the contract. |
| Você também pode chamar `lock()` direto no contrato, sem este app; o limite é o mesmo. | You can call `lock()` without this app; the limit is the same. |

**"Como verificar" block**

- Style: 12px monospace, gray-900 on white, wrapping.
- Rows:
  - Rede: Arbitrum One (42161) · bloco #{bloco}
  - Contrato P2Pix: `0xB9dE24aB263c812A080488Edab0382701C754BBc`
  - Módulo de reputação (lido de `P2Pix.reputation()`): `0xC40356e14842e951A2A1F156d5be28cC6E4C2697`
  - Chave: endereço << 12 (= `_castAddrToKey(endereço)`)
  - `userRecord(chave)` = 1000000000000000000000 (1.000 BRZ; the raw value is in wei)
  - `limiter(1000)` = 2.256
- Button: **[Copiar comandos]**, secondary, sm (plus `min-h-11` on mobile). It shows a "Copiado!" chip: **emerald-700** 12px semibold on white, 4px radius, `shadow-sm`. This is the existing chip's shape, but not its emerald-500, which is 2.5:1.
- It copies:

  ```
  cast call <P2PIX> "_castAddrToKey(address)(uint256)" <ENDERECO> --rpc-url <SEU_RPC>
  cast call <P2PIX> "userRecord(uint256)(uint256)" <CHAVE> --block <BLOCO> --rpc-url <SEU_RPC>
  cast call <P2PIX> "reputation()(address)" --block <BLOCO> --rpc-url <SEU_RPC>
  cast call <REPUTACAO> "limiter(uint256)(uint256)" <CREDITO> --block <BLOCO> --rpc-url <SEU_RPC>
  ```

  - The first line has the contract compute the key itself. `_castAddrToKey` is `public pure` (`BaseUtils.sol:164-171`), so the user does not have to trust the app's `<< 12`.
  - `<CREDITO>` is `userRecord` divided by 10^18, rounded down.
  - `--block` needs an **archive** RPC once the block is more than about 128 blocks old; many free endpoints refuse. The block also states the caveat: "Para conferir depois, remova `--block` ou use um RPC de arquivo." (To check later, drop `--block` or use an archive RPC.)
- **Copy fallback.** `navigator.clipboard` needs a secure context, and some IPFS gateway origins are not secure. When it is missing, select the command text and say "Selecionado — copie com Ctrl+C" (Selected — copy with Ctrl+C). Never fail silently.
- No explorer links.
- The Arbitrum addresses above come from `ignition/deployments/chain-42161/deployed_addresses.json` and match the on-chain `reputation()`. Use them for mocks; the app shows whatever the chain returns.

**Purchase complete**

| Key | pt-BR | English gloss |
|---|---|---|
| `confirmed.newLimit` | Seu novo limite por compra em {rede}: **{atual} BRZ** (antes {antigo} BRZ). | Your new per-purchase limit on {rede}: … (before …) |

**Screen-reader only (polite live region; announced on state changes, never per keystroke)**

| pt-BR | English gloss |
|---|---|
| "Verificando seu limite…" | Checking your limit… |
| "Valor dentro do seu limite." | Amount within your limit. |
| `line.over` text | — |
| "Valor ajustado para {alvo} BRZ." | Amount set to {alvo} BRZ. |
| "Não foi possível verificar seu limite agora." | Couldn't check your limit right now. |

The CTA copy is unchanged: **"Confirmar Oferta"** / **"Conectar carteira"**.

### 3.6 States

**Limit line.** It takes one row, and one state shows at a time.

| # | When | Left text (style) | Right | CTA |
|---|---|---|---|---|
| L0 | Liquidity still loading on page open | row hidden (the existing "Carregando liquidez…" row is enough) | — | existing |
| L1 | Not connected | `line.guest`, gray-600 / value gray-900 semibold | — | "Conectar carteira" |
| L1b | Not connected, amount > `{novo}` | `line.guestOver`, **gray** (we don't know their credit) | — | "Conectar carteira" |
| L2 | Reading (first load, network or account change, retry) | `line.loading` + 16px spinner, gray-600 | — | not blocked by this |
| L3 | Ready, amount empty, ≤ limit, or bad decimals | `line.ready` | — | existing rules |
| L4 | Amount exactly = limit (2.256 or 2.256,00) | `line.atLimit`, neutral, **not** amber or red | — | enabled |
| L5 | Amount > limit (2.256,01 and up) | `line.over`, red-700 + `invalidIcon` 16px | **[Usar {alvo} BRZ]**; **omitted** when this network has no offer at all from another seller (then `{alvo}` does not exist) | enabled if an offer covers the amount; pressing it opens the panel (see below) |
| L6 | Amount > 1.000.000 and the cap is the smaller bound (or the read failed) | `line.overCap`, red-700 | **[Usar 1.000.000 BRZ]** (or `{alvo}`) | as L5 |
| L7 | RPC read failed | `line.error`, amber-800; "Tentar de novo" is underlined, medium | — | **unchanged**: never blocked by a failed read |
| L8 | Module failed: `limiter` reverted or returned no data (`reputation()` is not a contract), **or** a lock came back with `StaticCallFailed` (amount kept) | `line.module`, amber-800 | — | unchanged |
| L9 | Came back after the contract refused with `AmountNotAllowed` (only that error; `NotEnoughTokens` and `InvalidDeposit` keep today's behaviour) | `line.refused`, red-700; amount kept; panel opens automatically | **[Usar {alvo} BRZ]** | enabled |

**Precedence in the amount card:**

1. The existing decimals error.
2. The limit line's red states (L5, L6, L9). While one is showing, the existing "não há liquidez" line is suppressed (BSC:362 already does this).
3. The existing liquidity line.

**Details panel contents by state.** Order from top to bottom:

1. Title.
2. Big value.
3. Bar.
4. Usage line.
5. Divider.
6. "Why" paragraph.
7. "Next" paragraph.
8. Offer line (only when the offer is below the limit).
9. Account line.
10. Disclosures.

| State | Border / bar | Body |
|---|---|---|
| Ready, no amount | bar empty, gray-300 track | `panel.usageEmpty`, `panel.why`, `panel.next` |
| Within (e.g. 1.500 of 2.256) | bar emerald-600, 66% | `panel.usage`, `panel.why`, `panel.next` |
| ≤ 100 | bar emerald-600 | `panel.usage` + `panel.free` |
| At limit | bar emerald-600, 100% | `panel.usage` ("…(100%)"), `panel.next` |
| Over | bar red-700, full | `panel.usageOver`, `panel.whyOver`, `panel.next` |
| New wallet (credit 0) | as above | `panel.new256` or `panel.new100` replaces `panel.why` |
| Cap reached (limit = 1.000.000) | as above | `panel.capReached`; no `panel.next` |
| Offer binds (largest offer < limit) | as above | add `panel.offer`; **no `panel.next`** (see "Liquidity smaller than the limit") |
| Module failed (L8) | no value, no bar | `line.module` text + [Tentar de novo]; "Como funciona" stays available |
| Refused (L9) | bar red-700 | `panel.refused` + fresh value, or `line.refusedUnknown` |
| Read failed | no value, no bar | `panel.error` + [Tentar de novo] |
| Guest | no bar | big value "{novo} BRZ" under `panel.titleGuest`, then `panel.guest` |
| Reading | skeleton bars: 16px tall, radius 4, gray-200, pulse off under reduced motion | — |

**"Confirmar Oferta" press, by state.** The "tooltip when trying to buy".

| Limit state | What happens |
|---|---|
| Not connected | Opens the wallet modal (unchanged). |
| Amount ≤ 100 BRZ | Proceeds immediately. No check is needed. |
| L3 / L4 (within) | Proceeds immediately on cached data. No added latency. |
| L5 / L6 (over) | Button shows its spinner. The app re-reads the chain. If **still over**, the panel opens (over variant), focus moves to [Usar X], and the live region reads `line.over`. If **now within**, the purchase proceeds. |
| L2 (reading) | Spinner; wait up to 4s, then decide as above. On timeout, proceed. |
| L7 / L8 (unknown) | Proceeds; the contract decides. A refusal comes back as L9, or as L8 for `StaticCallFailed`. |

Rules for the re-read:
- If the amount, the network or the address changes while the re-read is in flight, drop the result and neither proceed nor block. The button returns to idle, and the next press decides on the new data.
- While the re-read is running the button is `disabled`, so a second press is impossible. Once the token pill has `type="button"` (§5.7 step 1), Enter in a field does nothing either: implicit submission does not fire when the default button is disabled.

**Interacting states**

- **Liquidity smaller than the limit.**
  - `{alvo}` uses the smaller value.
  - The panel shows `panel.offer` with the **binding number in semibold**.
  - If the amount is within the limit but above every offer, only the existing "não há liquidez" line shows. Its CTA stays disabled, as today.
  - `panel.next` ("Comprando {max} BRZ (o máximo)…") cannot happen in one purchase when the offer binds. In that case **hide `panel.next`**. If the team wants it, use `limiter(credit + alvo)` instead. `{alvo}` comes from public offer data and the limit, so it is still privacy-neutral.
- **Network switch.**
  - The line goes to L2, then shows the new value.
  - The panel title changes network.
  - **Never** show the previous network's number under the new network's name.
- **Account switch.** Same as a network switch. On login, `walletAddress` stays `null` (guest line) until the effective address resolves, then goes straight to the Kernel address on the smart-account rail. A network switch clears the AA cache and re-resolves it (`TopBar.vue:61-116`), so the line may briefly read a (new network, old address) pair. The cache key drops that response when the address changes.
- **Wallet on the wrong chain** (the existing "Rede incorreta!" bar). Show the limit for the network selected in the app. No extra text. Passkey users don't see the bar on networks with an `aa` block (`ToasterComponent.vue:20-24`).
- **Smart account vs wallet.** Same visuals; only the account line differs (`panel.accountAa` / `panel.accountEoa`). Typical surprise: a MetaMask buyer with history logs in with a passkey and sees `{novo}` again.
- **Open purchase (Active lock).** The existing "Existe uma compra em aberto. Continuar?" alert shows over this screen (`HomeView.vue:173-178`). The limit line still shows the **full** per-purchase limit, because open locks don't consume it. Nothing extra is needed. After that lock is released, the post-release refresh picks up the higher limit.
- **Expired lock not yet returned.** Credit is unchanged until someone calls `unlockExpired`, which then halves it or sets it to 100. The UI cannot see this coming without the subgraph lock list; see open question 5. Today's number is still what the contract enforces right now.
- **Offer shrinks or is paused before the lock.** The contract reverts with `NotEnoughTokens` or `InvalidDeposit` before it reaches the reputation check (§2.2). That is not L9. Keep today's behaviour, because a generic failure message is out of scope.
- **Network without a deployment.** This cannot happen in the selector. `networks.ts:16-21` builds every network from its Ignition artifact with a non-null assertion, so a missing artifact breaks startup instead of reaching this screen. A wallet on an unsupported chain makes the app fall back to `DEFAULT_NETWORK` (`TopBar.vue:97-110`): Ethereum in production, Sepolia in development. The line then reads that network.

**Purchase complete screen.** Under "Tokens recebidos / 2256 BRZ", add `confirmed.newLimit`:
- text 14px gray-600, value semibold gray-900;
- leave the line out if the read fails.

**Mock data presets.** The addresses and credits are illustrative. On 2026-10-06 Arbitrum's `lockCounter()` was 0 and its subgraph listed no deposits, so every real Arbitrum buyer has credit 0 and sees 256 today. Ethereum's `lockCounter()` was 5.

| Frame | Network / BASE | Account | Credit | Limit shown | Typed | Largest offer here | Next (`panel.next`) |
|---|---|---|---:|---:|---:|---:|---:|
| P1 within | Arbitrum One / 256 | wallet `0x1a2...9f3e` | 1.000 | 2.256 | 1.500 | 5.000 | 6.767 |
| P2 at limit | Arbitrum One / 256 | wallet | 1.000 | 2.256 | 2.256 | 5.000 | 6.767 |
| P3 over | Arbitrum One / 256 | wallet | 1.000 | 2.256 | 3.000 | 5.000 | 6.767 |
| P4 over, offer binds | Arbitrum One / 256 | wallet | 1.000 | 2.256 | 3.000 | 1.500 | hidden (`{alvo}` = 1.500; the optional variant shows `limiter(1000 + 1500)` = 5.255) |
| P5 new smart account, over | Arbitrum One / 256 | conta inteligente `0x7c4...e21a` | 0 | 256 | 400 | 5.000 | 768 |
| P6 new wallet, BASE 1, over | Sepolia / 1 | wallet | 0 | 100 | 150 | 2.000 | 201 |
| P7 guest | Arbitrum One | not connected | — | "Carteiras novas: até 256" | 0 | — | — |
| P8 read failed | Arbitrum One | wallet | — | `line.error` | 1.500 | 5.000 | — |
| P9 refused | Arbitrum One | wallet | 500 (after one expiry) | 1.256 (was 2.256) | 3.000 kept | 5.000 | 3.767 |
| P10 purchase complete | Arbitrum One | wallet | 3.256 | "6.767 (antes 2.256)" | bought 2.256 | — | — |

### 3.7 Wireframes: desktop (≥640px)

**D1. Connected, idle.** The only new element is row 3. No network icons show at amount 0.
```
  +-- glass container ---------------------------------------------------+
  | +-- card bg-white r8 px40 py20 ------------------------------------+ |
  | | 0                                            ( (o) BRZ  v )      | |
  | | ---------------------------------------------------------------- | |
  | | ~ R$ 0,00                                                        | |
  | | (i) Seu limite por compra: 2.256 BRZ  v                          | |  14px gray-600; value semibold gray-900
  | +------------------------------------------------------------------+ |  trigger: text button, chevron 12px
  | +-- card ----------------------------------------------------------+ |
  | | Digite seu CPF ou CNPJ (somente números)                         | |
  | +------------------------------------------------------------------+ |
  | [            Confirmar Oferta  (disabled 70%: amount is 0)          ] |
  +----------------------------------------------------------------------+
```

**D2. Within the limit, panel open (P1).** The panel is inline, so the CPF card and CTA move down.
```
  | | 1500                                         ( (o) BRZ  v )      | |
  | | ---------------------------------------------------------------- | |
  | | ~ R$ 1.500,00                                          (arb)     | |
  | | (i) Seu limite por compra: 2.256 BRZ  ^          aria-expanded   | |
  | |  /\                                                              | |  caret 8px, gray-100
  | | +-- panel bg-gray-100 r8 p16 (12 on mobile) --------------------+ | |
  | | | Seu limite por compra em Arbitrum One        14 medium 600    | | |
  | | | 2.256 BRZ                                    20 semibold 900  | | |
  | | | [=====================.........]   6px bar emerald-600 66%    | | |
  | | | Esta compra usa 1.500 de 2.256 BRZ (66%).    14 gray-900      | | |
  | | | ------------------------------------------------------------- | | |
  | | | Seu crédito de reputação em Arbitrum One é de 1.000 BRZ,      | | |  14 gray-600, numbers semibold 900
  | | | calculado a partir das compras que você concluiu.             | | |
  | | | Comprando 2.256 BRZ (o máximo) e concluindo a compra, seu     | | |
  | | | limite passa para cerca de 6.767 BRZ.                         | | |
  | | | Limite da carteira 0x1a2...9f3e em Arbitrum One. Cada         | | |  12 gray-600
  | | | endereço e cada rede têm sua própria reputação.               | | |
  | | | Como funciona v          Como verificar v                     | | |  12 medium gray-600 underline
  | | +--------------------------------------------------------------+ | |
  | +------------------------------------------------------------------+ |
  | | Digite seu CPF ou CNPJ (somente números)                         | |
  | [                        Confirmar Oferta                          ] |
```

**D3. Over the limit, panel closed (P3).** No ring, no relabel: one red line and one fix.
```
  | | 3000  <- red-700                             ( (o) BRZ  v )      | |
  | | ---------------------------------------------------------------- | |
  | | ~ R$ 3.000,00                                          (arb)     | |
  | | (x) 3.000 BRZ passa do seu limite por      [ Usar 2.256 BRZ ]    | |  red-700 14px | outline amber sm
  | |     compra de 2.256 BRZ.                                         | |
  | +------------------------------------------------------------------+ |
  | | Digite seu CPF ou CNPJ (somente números)                         | |
  | [                        Confirmar Oferta                          ] |  still enabled (an offer >= 3.000 exists)
```

**D4. The user pressed "Confirmar Oferta" in D3.** After a 0.3–1s spinner on the button, the panel opens in its over variant and focus lands on the quick-fill.
```
  | | (x) 3.000 BRZ passa do seu limite por      [[ Usar 2.256 BRZ ]]  | |  2px indigo-800 focus ring
  | |     compra de 2.256 BRZ.                                         | |
  | |  /\                                                              | |
  | | +-- panel bg-gray-100 ------------------------------------------+ | |
  | | | Seu limite por compra em Arbitrum One                         | | |
  | | | 2.256 BRZ                                                     | | |
  | | | [###############################]     bar red-700 full        | | |
  | | | Esta compra passa 744 BRZ do seu limite.                      | | |
  | | | ------------------------------------------------------------- | | |
  | | | O contrato P2Pix recusa compras acima deste limite. Ele vem   | | |
  | | | da sua reputação em Arbitrum One (crédito: 1.000 BRZ).        | | |
  | | | Comprando 2.256 BRZ (o máximo) e concluindo a compra, seu     | | |
  | | | limite passa para cerca de 6.767 BRZ.                         | | |
  | | | Limite da carteira 0x1a2...9f3e em Arbitrum One. ...          | | |
  | | | Como funciona v          Como verificar v                     | | |
  | | +--------------------------------------------------------------+ | |
```

**D5. Not connected (P7).** Guests never get network icons (BSC:185).
```
  | | 0                                            ( (o) BRZ  v )      | |
  | | ---------------------------------------------------------------- | |
  | | ~ R$ 0,00                                                        | |
  | | (i) Carteiras novas: até 256 BRZ por compra  v                   | |  on Ethereum/Sepolia: "até 100 BRZ"
  | +------------------------------------------------------------------+ |
  | [                        Conectar carteira                         ] |
```

**D6. Limit-line variants** (same slot):
```
  | | Verificando seu limite…  (spin)                                  | |  L2
  | | (i) Você vai usar todo o seu limite por compra (2.256 BRZ)       | |  L4, neutral
  | | (x) O contrato aceita no máximo        [ Usar 1.000.000 BRZ ]    | |  L6
  | |     1.000.000 BRZ por compra.                                    | |
  | | Não foi possível verificar seu limite agora. Tentar de novo      | |  L7, amber-800, link underlined
  | | O módulo de reputação de Arbitrum One não respondeu. Compras de  | |  L8, amber-800
  | | até 100 BRZ continuam disponíveis. Tentar de novo                | |
  | | (x) O contrato recusou esta compra: seu    [ Usar 1.256 BRZ ]    | |  L9, red-700; panel auto-opens
  | |     limite atual é de 1.256 BRZ.                                 | |
```

**D7. Purchase complete (P10).**
```
  | +-- card bg-white px40 py20 ---------------------------------------+ |
  | | Tokens recebidos                                                 | |
  | | 2256 BRZ                                                         | |  existing 24px
  | | Seu novo limite por compra em Arbitrum One: 6.767 BRZ            | |  NEW 14 gray-600, value semibold 900
  | | (antes 2.256 BRZ).                                               | |
  | | Não encontrou os tokens? ...                                     | |  existing
```

### 3.8 Wireframes: mobile (<640px, 360px wide, about 256px inside the card)

```
 M1 collapsed, within (P1)              M2 expanded after tapping the line
 +-- glass px16 py16 ---------------+   +----------------------------------+
 | +-- card px24 py20 ------------+ |   | +------------------------------+ |
 | | 1500          ((o)BRZ v)     | |   | | 1500          ((o)BRZ v)     | |
 | | ---------------------------- | |   | | ---------------------------- | |
 | | ~ R$ 1.500,00        (arb)   | |   | | ~ R$ 1.500,00        (arb)   | |
 | | (i) Seu limite por compra:   | |   | | (i) Seu limite por compra:   | |
 | |     2.256 BRZ            v   | |   | |     2.256 BRZ            ^   | |
 | +------------------------------+ |   | | +-- bg-gray-100 r8 p12 ----+ | |
 | | Digite seu CPF ou CNPJ (s... | |   | | | 2.256 BRZ                | | |
 | [       Confirmar Oferta       ] |   | | | [=========......]  66%   | | |
 +----------------------------------+   | | | Esta compra usa 1.500 de | | |
   the whole line is a 44px-tall        | | | 2.256 BRZ (66%).         | | |
   tap target                           | | | Crédito em Arbitrum One: | | |
                                        | | | 1.000 BRZ. Comprando o   | | |
                                        | | | máximo, seu limite passa | | |
                                        | | | para cerca de 6.767 BRZ. | | |
                                        | | | Como funciona v          | | |
                                        | | | Como verificar v         | | |
                                        | | +--------------------------+ | |
                                        | +------------------------------+ |
                                        | | CPF ou CNPJ...               | |
                                        | [       Confirmar Oferta       ] |
                                        +----------------------------------+

 M3 over (P5, smart account)            M4 new wallet on Sepolia (P6)
 +----------------------------------+   +----------------------------------+
 | +------------------------------+ |   | +------------------------------+ |
 | | 400 (red-700)  ((o)BRZ v)    | |   | | 150 (red-700)  ((o)BRZ v)    | |
 | | ---------------------------- | |   | | ---------------------------- | |
 | | ~ R$ 400,00          (arb)   | |   | | ~ R$ 150,00          (sep)   | |
 | | (x) 400 BRZ passa do seu     | |   | | (x) 150 BRZ passa do seu     | |
 | |     limite por compra de     | |   | |     limite por compra de     | |
 | |     256 BRZ.                 | |   | |     100 BRZ.                 | |
 | | [      Usar 256 BRZ       ]  | |   | | [      Usar 100 BRZ       ]  | |
 | +------------------------------+ |   | +------------------------------+ |
 | | CPF ou CNPJ...               | |   |  expanded panel says:           |
 | [       Confirmar Oferta       ] |   |  "Esta carteira ainda não       |
 +----------------------------------+   |  concluiu compras em Sepolia.   |
   quick-fill wraps to its own line,    |  Compras de até 100 BRZ não     |
   full width, min 44px tall            |  precisam de reputação.         |
                                        |  Comprando 100 BRZ (o máximo)   |
                                        |  e concluindo a compra, seu     |
                                        |  limite passa para cerca de     |
                                        |  201 BRZ."                      |
                                        +----------------------------------+

 M5 "Como verificar" expanded
 | | v Como verificar                 | |
 | | +-- white r8 p12 mono 12px ----+ | |
 | | | Rede      Arbitrum One       | | |
 | | | Bloco     #{bloco}           | | |
 | | | P2Pix     0xB9dE…4BBc        | | |
 | | | Reputação 0xC403…2697        | | |
 | | |   (lido de P2Pix.reputation) | | |
 | | | Chave     endereço << 12     | | |
 | | | Crédito   1.000 BRZ          | | |
 | | | Limite    limiter(1000)=2256 | | |
 | | +------------------------------+ | |
 | | [ Copiar comandos ]  Copiado!    | |
```

### 3.9 Optional comparison frame: desktop floating popover

**Mock this only as a variant to compare.** The plan ships the inline panel.

**Placement and size**
- Same content as the inline panel.
- An `absolute` child of the amount card, **above** the card (`bottom-full mb-3`), so it covers only the hero text.
- 320px wide.

**Look**
- White fill, 12px radius, 2px border.
- Border colour: gray-300 (neutral), emerald-500 (within), red-500 (over), amber-500 (error).
- `shadow-md`; the caret points down at the ⓘ.

**Why this is not the default**
- It needs a flip rule when there is no room above.
- It competes with the token dropdown (also `z-50` in the same card).
- Mobile needs the inline version anyway, so it would be a second presentation to build and test.

### 3.10 Interaction and accessibility rules

- **Trigger: the limit line.**
  - It is a `<button type="button" aria-expanded aria-controls="rep-details">`.
  - It opens and closes on click, tap, Enter or Space. **Never on hover and never on focus.**
  - Esc closes the panel and returns focus to the trigger.
  - Focus ring: 2px indigo-800.
  - On mobile it is at least 44px tall.
  - It sets `cursor-pointer` and an explicit text colour (gray-600 / gray-900). Tailwind v4 buttons default to `cursor: default` and inherit `color`, which turns near-white in OS dark mode (§3.2).
  - Every new button inside the `<form>` must be `type="button"`. `CustomButton` already renders `type="button"` unless a `type` attribute falls through, as `type="submit"` does on the CTA.
- **Panel.**
  - `<div id="rep-details" role="region" aria-labelledby="rep-details-title">`. It is **not** `role="tooltip"`, because it contains buttons.
  - It follows the trigger in DOM order, so Tab flows into it.
  - "Como funciona" and "Como verificar" are native `<details>`.
- **Opening moves focus only in two cases:**
  - after a blocked "Confirmar Oferta" press, focus goes to [Usar X];
  - after a refused lock (L9), focus goes to [Usar X].
  - When no quick-fill exists (no offer on this network), focus goes to the trigger instead.
- **Amount input.**
  - **It has no accessible name today**: only `placeholder="0"` (BSC:254-266). Add `aria-label="Quantidade de {token}"` (amount of {token}), or the description below has nothing to describe.
  - `aria-describedby="rep-status"`, which points to the limit line's sentence.
  - `aria-invalid="true"` in L5, L6 and L9.
  - **No `max` attribute.** A native browser bubble would pre-empt the design.
- **Live region.**
  - One sr-only `aria-live="polite"` region.
  - It speaks only on transitions (loaded, became over, back within, read failed, quick-fill applied), after 500ms idle. Never per keystroke.
- **Quick-fill.**
  - It sets the amount to `{alvo}`, re-runs the offer selection, and announces "Valor ajustado para…".
  - Focus moves to the amount input. The button disappears because the state is no longer over.
  - It **never** submits.
- **Busy CTA.** While re-reading on press, the button shows `CustomButton`'s spinner and `aria-busy="true"`, and the live region says "Verificando seu limite…".
  - `loading` also sets `disabled`. A focused button that becomes disabled loses focus in most browsers.
  - So after the re-read, focus is placed explicitly: on [Usar X] if the amount is still over, nowhere special if the purchase proceeds.
- **Mobile layout.**
  - The quick-fill wraps to its own full-width row. `size="md"` plus `min-h-11` gives 44px; `sm` is only about 28px.
  - When focus moves to [Usar X] or the panel opens after a press, scroll it into view with `block: 'nearest'`. Add `scroll-margin-bottom` of about 88px so the fixed "Rede incorreta!" bar (about 72px, `z-50`) cannot cover it.
  - The inline panel pushes the CPF card and the CTA below the fold on a 360×640 screen. That is acceptable, because the panel opens only on request or after a blocked press, and focus lands above it.
- **Colour is never the only signal.**
  - Over states use icon + text + the quick-fill.
  - The bar is `aria-hidden`; the usage sentence says the same thing.
- **Contrast.**
  - New text on white uses gray-600, gray-900, red-700, amber-800 or emerald-700 (the "Copiado!" chip), always as an explicit class.
  - Inside the gray-100 panel, never gray-500 or lighter.
- **Reduced motion:** no slide and no skeleton pulse.

### 3.11 Do not

- **Don't add a settings page, a new route, a modal, a bottom sheet, or a "Reputação" item in the wallet menu.**
- **Don't make it hover-only, and don't hide it below 640px.** The existing `BalanceCard` tooltip does both, and it is not a model to copy.
- **Don't show the raw `limiter` value** ("1" on Ethereum or Sepolia). Show the effective limit, which is at least 100.
- **Don't hard-code 256** as "everyone's" starting limit.
- **Don't say** "diário", "total", "nível", "score", or anything that suggests a daily cap or a gamified rank.
- **Don't say** "expirar sempre reduz seu limite".
- **Don't invent a number when a read fails** (no "0", no "256"), and **don't disable the buy button because a read failed.**
- **Don't put a red ring on the card, relabel the CTA, or auto-open anything while typing.**
- **Don't include** a curve chart, other networks' limits, explorer links, third-party fonts or icon sets, or a confetti/gamified "level up".
- **Don't use gray-500 text on the gray-100 panel**, and don't use emerald-500 for text anywhere.
- **Don't subtract open purchases from the limit.** The limit is per purchase, and open locks don't consume it.
- **Don't blame reputation for other refusals** (`NotEnoughTokens`, `InvalidDeposit`).

---

## 4. Decision record

### 4.1 Options compared

| Criterion | **A. Limit line + toggletip on the amount card** | B. Gate on "Confirmar Oferta" (popover/sheet on submit) | C. Chip + progress meter + full "Reputação" view | D. Settings entry or page |
|---|---|---|---|---|
| Correct vs contract | Mirrors the rule. As proposed, it disabled the CTA on cached data, so a stale-low value could block a valid buy. | Mirrors the rule. Fresh read before blocking; never disables. | Mirrors the rule. Holds the CTA on cached data. | Shows the number only, nothing at buy time. |
| First-time buyer clarity | Number always visible; fix offered at the moment of excess. | Learns at click; status line quiet. | Most information; the curve and milestones can intimidate. | Far from the moment of need. |
| Mobile (no hover) | Status line + inline panel. | New bottom-sheet pattern (`<dialog showModal>`). | Inline; its button hover hint is lost on touch. | OK, but elsewhere. |
| Visual noise | Medium: auto-open on focus, card ring, CTA relabel. | Lowest. | Highest: meter, chip, curve, modal. | None in the form. |
| Trust-minimal data | On-chain, plus a local formula copy for estimates. | On-chain only (`limiter(credit+X)`). | Local formula for curve and milestones; "Outras redes" sends the address to more RPCs. | Same reads. |
| Implementation cost | Three presentations (float above, inline fallback, mobile inline). | `<dialog>` + sheet + submit rewiring. | Most: chip, meter, curve SVG, modal + Teleport. | New route; `ARCHITECTURE.md` §1 Routing row goes stale. |

### 4.2 Choice: **A, trimmed**, with ideas grafted from B and C

**Why A.** The user's question is *"how much can I buy?"*. Only an always-visible number in the place where the amount is typed answers it before the mistake. A is also what the user leaned toward: something tooltip-like in the buy flow, not a settings page. The trims and grafts remove A's weaknesses.

**Kept from A**
- The always-visible limit line.
- The one-tap "Usar X BRZ".
- The usage bar inside the panel.
- The state matrix and message precedence.
- red-700 / amber-800 for AA contrast.
- The account and network line.

**Dropped from A**

| Dropped | Why |
|---|---|
| Auto-open on focus, and hover-open | noise; WCAG 1.4.13 complexity |
| Floating popover as default | three presentations; collision with the token dropdown; kept only as the §3.9 comparison frame |
| Red ring on the card | noise |
| CTA disable + relabel | stale-low risk; disabled buttons cannot host feedback |
| Local formula copy, "conclua mais X BRZ" estimates, curve-drift detection | second source of truth; open question 4 |

**Grafted from B (gate)**
- "Confirmar Oferta" is **never disabled for reputation**. A press while over triggers a **fresh read before blocking**, then the explanation. This is the "tooltip when trying to buy".
- **On-chain previews only:** `limiter(credit + max)`, so no client-side formula.
- Handling a refused lock **with the amount preserved** (L9).
- Fixing the token pill / implicit-submission bug, and making button state a single `computed`.

**Grafted from C (meter)**
- The post-purchase "Seu novo limite" line, which closes the learning loop.
- The panel opens only on explicit activation.
- The panel names the account type.

**Rejected from C**

| Rejected | Why |
|---|---|
| Mini curve | noise; needs a local formula |
| "Outras redes" | sends the address to extra RPC endpoints, a Privacy line in the PR |
| Wallet-menu "Reputação" modal | a settings surface by another name |
| Hover hint on a held button | — |

**Why not a settings page (D)**
- It answers the question away from the purchase, after the user has already hit the wall.
- It adds a route, which makes the `ARCHITECTURE.md` §1 Routing row stale.
- The temptation to show "all networks" would send the user's address to RPCs they did not select.
- Everything a settings page would show fits in the panel's "Como funciona" and "Como verificar".

**Why not a hover tooltip like `BalanceCard.vue:90-103`.** That tooltip:
- is hidden below 640px (`:182-186`);
- cannot be reached by keyboard or touch;
- carries an `aria-describedby="tooltip"` that points at an id which doesn't exist.

---

## 5. Implementation plan (later, not now)

### 5.1 Data path decision: read `limiter` on-chain and do not copy the formula

**Choice.** Call `limiter` on the address `P2PIX.reputation()` returns, at a pinned block. Mirror only the two `internal constant` bounds.

**Why**

- **Two curves are deployed (§2.4).** The owner can swap the module at any time (`OwnerSettings.sol:95-102`). `_limiter` makes a static call to exactly that address (`:209-240`).
  - Reading it is the only way to show what the contract will enforce.
  - A client-side copy would be a second source of truth. It is already wrong on 3 of the 4 networks if BASE is taken from source.
- **Previews stay on-chain and privacy-neutral.** "Next limit if you buy the max" is one lazy `limiter(credit + maxTokens)` call.
  - The argument is derived from public data, so the RPC learns nothing it doesn't already know.
  - The limit reads never carry the **typed amount**. It reaches the RPC (EOA `simulateContract`) or the bundler (UserOp) only when the user actually submits a lock, as today. A per-amount preview would send amounts the user only considers; see open question 6.
- **Fewer requests than today.** A snapshot is three requests: `eth_blockNumber` and two Multicall3 `eth_call`s. The lazy `limiter(credit + max)` adds one. That happens once per (chain, address), **plus one snapshot per blocked press**, instead of three sequential `eth_call`s per input event.

### 5.2 Reads (all over the existing wagmi public client: `src/blockchain/provider.ts:22-25`)

```ts
const key = BigInt(account) << 12n;                         // BaseUtils.sol:164-171
const blockNumber = await client.getBlockNumber();          // L2 block on Arbitrum; not Multicall3.getBlockNumber
const [creditWei, reputation] = await client.multicall({    // same pattern as src/blockchain/events.ts:127
  allowFailure: false,
  blockNumber,
  contracts: [
    { address: p2pix, abi: p2PixAbi, functionName: 'userRecord', args: [key] },
    { address: p2pix, abi: p2PixAbi, functionName: 'reputation' },
  ],
});
// reputation === zeroAddress -> 'module' error (validate shape; never cast)
const credit = creditWei / 10n ** 18n;                      // p2pix.sol:181 floors the same way
const [limiterValue, base] = await client.multicall({
  allowFailure: false,
  blockNumber,
  contracts: [
    { address: reputation, abi: reputationAbi, functionName: 'limiter', args: [credit] },
    { address: reputation, abi: reputationAbi, functionName: 'limiter', args: [0n] },
  ],
});
// Lazily, when the panel first opens and maxTokens < 1_000_000:
//   readContract(reputation, 'limiter', [credit + maxTokens], { blockNumber })
//   then apply max(100, min(·, 1e6)) before showing it as {proximo}
```

- **Classify errors by batch.** A failure in the `limiter` batch (revert, or zero data from an address with no code) is `'module'`. A failure in the `userRecord` / `reputation` batch, in `getBlockNumber`, or in transport is `'rpc'`. A revert from `userRecord` must not be mislabelled as a module failure.
- **Freshness.** `getBlockNumber` is cached for the client's polling interval (4s by default). On a blocked press, use `getBlockNumber({ cacheTime: 0 })`.
- **After a release, pin to the receipt.** `releaseLock` returns the receipt, which `HomeView.vue:94` currently discards. Read at `max(latest, receipt.blockNumber)`, so a lagging load-balanced node cannot return the old credit for `confirmed.newLimit`.
- **Pinned-block reads need recent state.** Reads at `blockNumber` are fine for a block just fetched, but very old blocks need an archive node. Never reuse a stored block number for a later read.

**Guest (not connected).** Read only `reputation()` and `limiter(0)`, cached per chain. Nothing user-specific is sent.

### 5.3 New module and composable

**`src/blockchain/reputation.ts`** holds the reads, the pure rule, and revert decoding. Reads live in `src/blockchain/` by convention (`events.ts`, `wallet.ts`).

```ts
// Mirrors p2pix-smart-contracts/contracts/core/Constants.sol:52-55; internal constants, no getter.
export const REPUTATION_LOWERBOUND = 100n * 10n ** 18n;
export const LOCKAMOUNT_UPPERBOUND = 1_000_000n * 10n ** 18n;

export type ReputationSnapshot = {
  chainId: number;
  account: Address;       // useUser().walletAddress: Kernel on the AA rail, EOA otherwise
  blockNumber: bigint;
  p2pix: Address;
  reputation: Address;    // as returned by P2PIX.reputation() at blockNumber
  credit: bigint;         // whole tokens, floor(userRecord / 1e18)
  limiterValue: bigint;   // Reputation.limiter(credit)
  base: bigint;           // Reputation.limiter(0): new-wallet value on this deployment
  maxTokens: bigint;      // max(100, min(limiterValue, 1_000_000))
};

export type AmountVerdict = 'free' | 'within' | 'atLimit' | 'overLimit' | 'overCap';

export const readReputationSnapshot: (client: PublicClient, p2pix: Address, account: Address) => Promise<ReputationSnapshot>;
export const readNewWalletMax: (client: PublicClient, p2pix: Address) => Promise<bigint>;   // max(100, min(limiter(0), 1e6))
export const readLimitAfter: (client: PublicClient, s: ReputationSnapshot, extraTokens: bigint) => Promise<bigint>;
export const classifyAmount: (amountWei: bigint, maxTokens: bigint) => AmountVerdict;       // ">" reverts, "=" passes
export const lockRevertName: (err: unknown) => 'AmountNotAllowed' | 'StaticCallFailed' | null;
```

**`src/composables/useReputationLimit.ts`** keeps module-level refs, the same pattern as `useUser` (`src/composables/useUser.ts:8-18`).

```ts
type ReputationState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; snapshot: ReputationSnapshot }
  | { status: 'error'; key: string; kind: 'rpc' | 'module' };

export function useReputationLimit(): {
  state: Readonly<Ref<ReputationState>>;
  newWalletMax: Readonly<Ref<bigint | null>>;     // guest line, per selected chain
  previousMaxTokens: Readonly<Ref<bigint | null>>; // for "antes {antigo}" after a purchase
  refresh: (opts?: { minBlock?: bigint }) => Promise<void>; // re-read for the current (chain, walletAddress); minBlock after a release
  limitAfterMax: () => Promise<bigint | null>;     // lazy limiter(credit + maxTokens), cached per snapshot
};
```

**How the composable behaves**

- **Cache key:** `${chainId}:${p2pix}:${account.toLowerCase()}`. Responses whose key no longer matches are dropped.
- **Stored in memory only.** No `localStorage`, nothing across sessions. The module can be swapped (`setReputation`).
- **Watches** `[network, walletAddress]` with `immediate: true`. There is **no polling and no per-keystroke read**.
- **Refresh triggers:**
  - address change;
  - network change;
  - a blocked "Confirmar Oferta" press;
  - a refused lock;
  - a successful release;
  - "Tentar de novo".
- **Errors are mapped, not swallowed.**
  - A zero `reputation()` address, or a `BaseError.walk` hit on `ContractFunctionRevertedError` / `ContractFunctionZeroDataError` **in the `limiter` batch** → `'module'`.
  - Anything else, including the same error types in the `userRecord` / `reputation` batch → `'rpc'`.
  - The error is `console.error`ed and shown (L7 / L8). Never coerce it to 0.

The `export const …: …;` lines above are signatures, not code. In a `.ts` file each needs its implementation.

**`src/components/BuyerSteps/ReputationLimit.vue`** renders the limit line and the panel. It is a separate component because it names a real concept and keeps `BuyerSearchComponent.vue` (451 lines) readable.
- Props: `amountText`, `maxOffer`, `refusal`.
  - **`maxOffer` must come from `depositsValidList`** (this network, `seller !== walletAddress`, max `remaining`), **not** from `selectedDeposits`. `verifyNetworkLiquidity` keeps only deposits with `remaining >= amount` (`src/utils/networkLiquidity.ts:9-20`), so above every offer it is empty, and that is exactly when the quick-fill needs the largest offer.
  - Floor `{alvo}` to 0,01 from the on-chain wei value, not from the float `remaining`.
- Emits: `fill(amountText)`.
- Exposes: `openFromSubmit()`.

### 5.4 Files to change (anchors at `854551f`)

**`src/components/BuyerSteps/BuyerSearchComponent.vue`**

| Lines | Change |
|---|---|
| `:14-16`, `:40-41`, `:50-137`, `:165` | Delete the old reputation imports (`getContract`, `reputationAbi` and `Address` are used only by this code), state, reads and check (units bug, swallowed errors, race), and the `checkReputationLimit(...)` call in `handleInputEvent`. |
| `:254-266` | Amount input: `v-model` a string, compared with `parseEther(...)` the same way `buyerMethods.ts:103` does. Add an `aria-label` (it has none today), `aria-describedby="rep-status"`, `:aria-invalid`, and `text-red-700` when over. Drop the per-event `debounce(...)` at `:262`; nothing per keystroke hits the network any more. |
| `:268` | Token pill: add `type="button"`. This fixes pill-click and Enter submitting the form (§2.9 item 7). |
| `:35`, `:153-217` | `enableConfirmButton` becomes one `computed`: wallet, amount > 0, valid decimals, an offer on this network. **No reputation term.** Delete the imperative setters and the watchers at `:210-217`. |
| `:338` | After the "~ R$" row, insert `<ReputationLimit>` (row 3). Hide it while `loadingNetworkLiquidity`. |
| `:326` | `~ R$ {{ tokenValue.toFixed(2) }}` becomes pt-BR currency (open question 2). |
| `:356-369` | Keep the liquidity line; its guard at `:362` becomes "not in a red limit state". |
| `:370-382` | Delete; replaced by the limit line. |
| `:227-234` | `handleSubmit`: when connected and amount > 100, apply the press rules in §3.6. On a confirmed "over", call `openFromSubmit()` and do **not** emit `tokenBuy`. |
| `:398-403` | CTA: bind `:loading` during the re-read. `loading` also disables the button and hides its label (`CustomButton.vue:42-47`); see §3.10 for focus. Keep the fallthrough `type="submit"`. |

**`src/views/HomeView.vue`**

| Lines | Change |
|---|---|
| `:63-79` (catch in `confirmBuyClick`) | `lockRevertName(err)`. On `AmountNotAllowed` or `StaticCallFailed`, set `searchRefusal = { amount, reason }`, call `refresh()`, and return to Search. Other errors keep today's behaviour (out of scope), including `NotEnoughTokens` and `InvalidDeposit`, which the contract checks first. |
| `:164-167` | Pass `:refusal="searchRefusal"` to `SearchComponent`, so the amount is kept and L9 shows for `AmountNotAllowed`, or L8 for `StaticCallFailed`. Clear it on the next press or amount edit. |
| `:93-105` | Record `previousMaxTokens` before `releaseLock`. Keep the receipt it returns (`:94` discards it today), and call `refresh({ minBlock: receipt.blockNumber })`. |

**`src/components/BuyerSteps/BuyConfirmedComponent.vue:93-97`**
- Add the `confirmed.newLimit` line under "Tokens recebidos".
- Omit it when the state is not `ready`.

**`src/blockchain/buyerMethods.ts`:** no change.
- The EOA rail already simulates before signing (`:134-140`).
- On the AA rail (`:106-128` → `sendAaOperation`, `src/blockchain/aa/operations.ts:127-193`), the revert surfaces in bundler gas estimation. `lockRevertName` must walk the viem error chain and `decodeErrorResult({ abi: p2PixAbi, data })` on any revert data it finds.
- **Verify on Sepolia with a passkey account.** If the AA error carries no decodable data, fall back to today's behaviour and never claim reputation was the cause.

**`ARCHITECTURE.md:81`:** see §6.

### 5.5 ABI / wagmi generation

- No `wagmi.config.ts` change. `bun run wagmi:gen` (the hardhat plugin over the submodule, `wagmi.config.ts:1-12`) already emits `p2PixAbi` and `reputationAbi`; the current code imports both (BSC:15, `provider.ts:1`).
  - `p2PixAbi` contains `userRecord`, `reputation`, `_castAddrToKey`, and the `AmountNotAllowed` / `StaticCallFailed` errors, because P2PIX inherits `EventAndErrors`.
  - `reputationAbi` contains `limiter`.
- `src/blockchain/abi.ts` is gitignored (`.gitignore:37`) and was absent from this checkout. **Run `bun run wagmi:gen` first and confirm these names before coding.**
- No submodule bump is needed.

### 5.6 Tests

Vitest runs with happy-dom and includes `tests/**/*.{test,spec}.ts` (`vitest.config.ts`). The `tests/` directory does not exist yet. The tests use real implementations; the only stub is at the RPC boundary.

| File | What it pins |
|---|---|
| `tests/reputation/classify.test.ts` | Boundary cases (below). |
| `tests/reputation/constants.test.ts` | Reads `p2pix-smart-contracts/contracts/core/Constants.sol` as text and asserts `REPUTATION_LOWERBOUND = 1e2 ether` and `LOCKAMOUNT_UPPERBOUND = 1e6 ether`. The mirror then breaks loudly if a submodule bump changes them. |
| `tests/reputation/units.test.ts` | Key and credit derivation (below). |
| `tests/reputation/snapshot.test.ts` | Read sequence (below), using a viem client with a `custom` transport at the RPC boundary, the one place a stub is unavoidable. |
| `tests/reputation/errors.test.ts` | `lockRevertName` on real viem error objects built from `p2PixAbi` with data `0x1c18f846` and `0xe10bf1cc`. It returns `null` on unrelated errors, including `NotEnoughTokens` (`0x22bbb43c`) and `InvalidDeposit`, which `lock()` checks before reputation. |

Cases for `classify.test.ts`:
- `100.00` is `free`; `100.01` is checked.
- `L.00` is `atLimit`; `L.01` is `overLimit`.
- BASE-1 at credit 0 and credit 49 gives `maxTokens = 100`; credit 50 gives 101.
- With `maxTokens = 100`, an amount of exactly 100 is `free`, not `atLimit`. `free` wins, so L4 never shows at 100.
- An amount above `1e24` gives `overCap` only when `maxTokens = 1e6`; otherwise the smaller bound (`overLimit`) wins.
- Input strings are parsed exactly (`"2256.01"`).

Cases for `units.test.ts`:
- `key(addr) = BigInt(addr) << 12n`.
- `credit = floor(wei / 1e18)`, e.g. `1999999999999999999n → 1n`.
- Regression: `limiter` is called with **whole tokens**, not wei (BSC:97-102).

Cases for `snapshot.test.ts`:
- Both batches are pinned to one block.
- A zero `reputation()` address gives `'module'`, and so does `0x` (zero data) from `limiter`.
- A revert in the `userRecord` / `reputation` batch gives `'rpc'`, not `'module'`.
- A transport failure gives `'rpc'`, never a 0 value.
- A stale-key response is dropped.
- After a release, a node answering below `minBlock` is not accepted.

**Manual check, no new CI network calls**
- `bun run type-check`, `bun run lint`, `bun run format:check`, `bun run test`, `bun run build`.
- On Sepolia (BASE 1), with an EOA and with a passkey:
  - amounts 50, 100, 100.01, L, L+0.01;
  - a network switch;
  - a wallet on the wrong chain;
  - the RPC blocked in devtools **after** liquidity has loaded, then "Tentar de novo" or an account switch: expect L7 with the CTA still enabled. Blocking it from page load also kills the liquidity reads (same RPC), which leaves no offer and a disabled CTA for an unrelated reason.
- **L9 and the halving on Rootstock Testnet.** There `defaultLockBlocks` is 10, so a lock expires within minutes. Lock, let it expire, return it with `unlockExpired`, and check the lowered (or, below 200 credit, floored) limit. Then submit the stale amount and check L9.
- On an Arbitrum PR preview (BASE 256), read-only: see 256 for a fresh address. An over-limit press must stop before any wallet prompt. This needs an Arbitrum offer above 256; on 2026-10-06 the Arbitrum subgraph listed none.
- **Check the subgraphs first.** Probed from this environment on 2026-10-06, the Ethereum, Sepolia and Rootstock Testnet subgraph URLs in `networks.ts` answered `{"message":"Not found"}`, and only Arbitrum's answered. Without liquidity, none of the buy-flow checks can run. Confirm from a browser.

### 5.7 Step order

1. **Prerequisites in BSC** (small, reviewable alone):
   - token pill `type="button"`;
   - `computed` button state;
   - delete the race and the per-keystroke reads.

   Shipped alone, this step leaves no reputation UI until step 4. That is acceptable, because the old message was wrong (§2.9). Otherwise, ship steps 1 to 4 together.
2. `src/blockchain/reputation.ts` plus the classify, constants, units and errors tests.
3. `useReputationLimit` plus the snapshot tests.
4. `ReputationLimit.vue`, wired into BSC (row 3; delete `:370-382`).
5. "Confirmar Oferta" press flow (`handleSubmit`).
6. HomeView: refusal decoding, amount kept (L9), refresh after release; the BuyConfirmed line.
7. "Como verificar" disclosure with "Copiar comandos".
8. Edit `ARCHITECTURE.md` §4 (below).
9. Full verification (§5.6).

---

## 6. Security and privacy review notes (AGENTS.md gate)

**The gate question was asked for this plan too** (AGENTS.md: "even a one-sentence plan"). The answer is no: this file adds no call, dependency, config or doc edit. **It fires for the implementation**, on four triggers:
- fetch behaviour changes (per-keystroke reads become cached reads);
- new calls are added (`eth_blockNumber`, `limiter(0)`, the lazy `limiter(credit + max)`);
- `ARCHITECTURE.md` §4 must be edited;
- that edit is itself a gated doc change.

**What is new that someone must trust: nothing.**

- **Same parties.** The reads are `userRecord`, `reputation` and `limiter` (plus `eth_blockNumber`):
  - they go to the same configured RPCs through the same client;
  - they are already listed at `ARCHITECTURE.md:81`.
- **No new package.** The panel is built with existing pieces: `<details>`, `CustomButton`, the self-hosted `info.svg` / `invalidIcon.svg`.
- **No new address and no config change.** No Reputation address goes into `src/config/`; it is read from `P2PIX.reputation()`.
  - This is consistent with the AGENTS.md address rule. The P2Pix address still comes from the submodule artifact, and the module address is never written into code. At runtime the app follows the same on-chain pointer the contract follows.
- **No new stored data.** The snapshot lives in memory only.
- **Less data to the RPC, not more.**
  - The limit reads never carry the typed amount; a lock carries it only on submit, as today.
  - The guest teaser sends nothing user-specific. Guests already reach the same RPC for liquidity on page load (`HomeView.vue:156`).
  - The number of reads drops.
  - A blocked press triggers one re-read, so the RPC can infer that an over-limit attempt happened, but not the amount. This replaces today's per-keystroke reads, which leaked more.
- **The UI is never stricter than the contract**, given an honest RPC.
  - A lying or broken RPC could make the panel block a valid purchase. That is the existing single-RPC trust ("Verifiable data layer ❌", "Read-path metadata hygiene ❌"), and today's code already depends on it for liquidity and for disabling the button.
  - The escape stays the same: your own RPC (a rebuild), or `lock()` called directly.

So, per AGENTS.md, **the implementation PR records nothing per pillar**: silence is the review working.

**Changes that would flip the outcome.** If any of these is adopted, the PR needs one line per pillar it touches:

| Change | Pillars | Assessment |
|---|---|---|
| A tooltip/popover library (floating-ui, tippy, floating-vue) | Security (more dependencies, against simplicity); Open Source (licence check) | avoidable, so **a regression** |
| A Reputation address in `src/config/networks.ts` | Security | a second trust root that drifts after `setReputation`; **regression** |
| A per-amount preview via `limiter(credit + typedAmount)` | Privacy | the RPC learns amounts the user considers but never buys; a disclosed, bounded addition |
| "Outras redes" reads | Privacy | the address goes to RPC endpoints of networks the user didn't select; bounded and user-initiated, still must be written |
| An explorer link containing the user's address | Privacy | IP and address go to a new party, the explorer; "Structural metadata hardening" is ⚠️ in `SECURITY.md` |
| Reputation from the subgraph or any API | Censorship Resistance, Security | a new source of truth for money limits; **reject** |
| Persisting the snapshot (`localStorage`, IndexedDB) | Privacy | links address, network and limit on the device across sessions; also a stale-value risk after `setReputation`; must be written |

**Mandate and DESIGN.md alignment**
- **User-controlled defenses (§B; Mandate VI.3).** The UI mirrors the contract rule exactly and is never stricter:
  - it never blocks on a failed read;
  - it re-reads before blocking.
- **Means to confirm (§C.1).** "Como verificar" shows the block, both addresses, the key and the `cast` commands.
- **Zero option (§C.7).** The copy says `lock()` works without this app.
- **Simplicity (Mandate IV, Security).** No formula copy and no dependency.

**Required doc edits when implemented**

`ARCHITECTURE.md` §4, "RPC for authority" (line 81). Replace the reputation sentence with:

> The buyer's per-purchase limit is read in two Multicall3 batches pinned to the same block: `userRecord(addr << 12)` and `reputation()` on P2Pix, then `limiter(credit)` and `limiter(0)` on the module P2Pix reports. `limiter(credit + max)` is read lazily for the "next limit" preview. The contract's 100- and 1,000,000-token bounds (`Constants.sol`, no getter) are mirrored as constants. The result is cached in memory per (chain, effective address) and re-read on address or network change, on a blocked purchase attempt, after a refused lock, and after release. The contract remains the enforcer: the UI never blocks on a failed read, and it re-reads before blocking (`src/blockchain/reputation.ts`, `src/composables/useReputationLimit.ts`).

**Scorecard drift to avoid.** An earlier draft of this sentence said "Pre-sign simulation (EOA) … stay[s] authoritative". `SECURITY.md:69` rates "Signing safety ⚠️ … no documented tx simulation", and `ARCHITECTURE.md` is what substantiates scorecard rows. Writing "simulation" there would make that note stale, and could be misread as satisfying `DESIGN.md` §C.6's user-visible "Transaction simulation", which an `eth_call` revert pre-check is not. So keep the sentence above. If the team prefers to mention `simulateContract`, the same PR must also reword `SECURITY.md:69` (e.g. "revert pre-check via `eth_call` on the EOA rail; no user-visible simulation"), keeping ⚠️.

Other docs:
- **`ARCHITECTURE.md` §1:** no change. The State row (module-scoped refs in composables) still holds; there is no new route and no new UI dependency.
- **`SECURITY.md`:** no change for this feature, as long as the `ARCHITECTURE.md` sentence stays as written above. The scorecard rows "Verifiable data layer ❌", "Read-path metadata hygiene ❌" and "Signing safety ⚠️" stay as they are. A weakness counts as fixed only once `ARCHITECTURE.md` says so.
- **Existing gap made visible (separate change, separate review).** `SECURITY.md` doesn't list the **P2Pix contract owner** as a trusted party. The owner can:
  - through `setReputation` (`OwnerSettings.sol:95-102`): change every buyer's limit, block every lock above 100 BRZ (a reverting module), or effectively lift every limit to the cap (a module with no code, §2.2);
  - through `setTrustedFowarders` (sic, `OwnerSettings.sol:45-85`): let relayed locks skip both the reputation check and the cap;
  - add signers (add-only), and set allowed tokens and the lock duration.

---

## 7. Open questions for the team

1. **Over-limit CTA.** Chosen: keep it enabled, and on press re-read and explain. Alternative: disable it and relabel it "Valor acima do seu limite", which is simpler but can block on a stale value.
2. **Number format.** Switch "~ R$ 0.00" (BSC:326, `toFixed`) to `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` in the same change? Otherwise "2.256 BRZ" sits next to "R$ 2256.00" and reads as a decimal. The mocks assume yes.
3. **Contrast.** Move the existing red-500 error lines (3.8:1) to red-700 in the same pass?
4. **"How much more do I need" estimates** ("conclua mais 373 BRZ para comprar 3.000"). These need a client-side copy of the curve, cross-checked against on-chain `limiter`. Worth a second copy of the maths?
5. **Pending expiry penalty (v2).** The buyer may have expired, unreturned locks whose return will halve their credit. Warn them? This needs the existing subgraph lock list as an index, plus on-chain `getLocksStatus`. It is a projection of contract logic and best-effort, because of indexer lag.
6. **Per-amount growth preview** ("concluindo esta compra, seu limite passa para…"). It needs either the local formula (question 4) or sending the typed amount to the RPC, which is a Privacy line. The plan uses only "if you buy the maximum".
7. **Curve alignment.** Is BASE 1 on Ethereum, Sepolia and Rootstock Testnet intentional, or should those networks get the BASE-256 module (`setReputation`)? It is a contract-side decision; the UI handles both.
8. **Guest teaser.** Keep it always visible, or show it only once the amount exceeds `{novo}`?
9. **"Como verificar" in v1?** It is copy-only, but it adds text to translate and keep accurate.
10. **Allow-lists.** If seller allow-lists (merkle proofs) ever get UI, those buyers bypass reputation and the cap, and the limit line would have to say so per offer.

**Noticed in passing, outside this feature**

- **Mainnet BRZ address.** The mainnet BRZ address in `src/config/networks.ts:29` (`0xC403…2697`) is the same address as Arbitrum's `Reputation#Reputation` artifact.
  - Read on mainnet on 2026-10-06: `name()` "P2Pix", `symbol()` "BRL", `decimals()` 18, and `allowedERC20s` true on the mainnet P2PIX.
  - It is probably the same deployer at the same nonce on both chains; not verified.
  - Confirm it is the intended token.
- **Liquidity reads across networks (confirmed by reading the code).** `getNetworksLiquidity` loops over every network (`events.ts:19-25`) but always passes the **selected** network's token address (`:21`). `getValidDeposits` then calls `getBalance` on each network's P2PIX address through the **selected** chain's client (`:72`, `:113`, `:121`, `:127`).
  - So other networks' offers and icons are wrong, and probably come back empty.
  - The selected network's own offers, which are the only ones `{alvo}` uses, are read correctly.
- **Paused offers count as liquidity.** `getBalance` ignores the valid bit (`p2pix.sol:435-455`). A paused seller can be picked, and the lock then reverts with `InvalidDeposit`.
- **Lock durations (verified 2026-10-06).** `defaultLockBlocks` is:
  - 350,000 on Arbitrum, where Solidity's `block.number` follows L1 blocks (Arbitrum docs, not re-verified here), so about 48 days;
  - 1,000 on Ethereum and Sepolia, about 3.3 hours;
  - 10 on Rootstock Testnet.

  An Arbitrum buyer who never pays keeps the seller's tokens locked, and their own penalty pending, for weeks.
- **Subgraph availability.** See §5.6: three of the four subgraph URLs answered "Not found" from this environment.
- **CPF / CNPJ field.** It is required by the form but its value is never used (BSC:38, `:388`).
