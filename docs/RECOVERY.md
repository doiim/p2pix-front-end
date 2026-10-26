# Recovery runbook

How the operator helping a user gets funds out when a third party is down or gone. The user-facing steps are in the app's FAQ ("Como recuperar meus fundos?"). Every path here is checked against the code in this repo; paths that were not run against real infrastructure say so. The trust entries behind each party live in [`SECURITY.md`](../SECURITY.md); how the pieces are wired is in [`ARCHITECTURE.md`](../ARCHITECTURE.md) §2.

**Not yet verified on mainnet or testnet:** a real authenticator signing the recovery UserOp, a real bundler/paymaster accepting it, and the Magic reveal dashboard. The end-to-end paths below are the intended behavior until someone runs them.

## What can go wrong

- **Magic down or gone** (email/Google login only): no session, no signing with the Magic-held key.
- **Pimlico down** (bundler and sponsorship paymaster): the app cannot relay a UserOp.
- **Non-AA network:** a chain without the smart-account rail (`aa` unset in `src/config/networks.ts`, today Rootstock Testnet, or the Pimlico sponsorship policy id is not configured). There is no Kernel there.

Passkey and injected-wallet users do not depend on Magic; for them only the Pimlico column applies (passkeys exist only on AA networks).

## The paths

### (a) Backup passkey (Magic accounts, AA network)

Setup, while Magic still works:

1. Log in with email/Google on an AA network (Ethereum, Arbitrum One, Sepolia).
2. In the account panel beside the offer card, press "Adicionar passkey de backup". It is shown only for a Magic user on an AA network whose account has no backup yet.
3. Approve the authenticator prompt. The app registers a discoverable passkey whose `userHandle` holds your smart-account address (and the chain id), then sends one root-signed UserOp (through the Magic AA context, `sendRawAaCalls`) that installs the Kernel WebAuthn validator as a **secondary** validator (`installModule`, granted the `execute` selector). That is full control of the account: `execute` reaches self-calls, so the passkey can also install modules or replace the root signer (see `SECURITY.md`).
4. There is one backup slot per account **per network**: a backup installed on one network does not recover funds on another, so repeat the setup on every network that holds funds. If one exists on the current network the button is hidden and the app refuses to install; registering again would replace it. Known limit: the app cannot replace or remove a backup yet, so a lost authenticator leaves the slot taken.

Recovery, with no Magic session and no wallet connected:

1. Press "Entrar" and pick "Perdeu o acesso ao e-mail? Recuperar com passkey de backup". The recovery screen opens in the account panel on the home page.
2. "Entrar com passkey de backup": the authenticator picks the credential, and the `userHandle` gives the account address. If the handle names a chain, the selected network follows it.
3. The app checks on-chain that the backup validator is installed, then shows the balances.
4. Enter a destination address and press "Enviar tudo": ETH and every token the network declares leave in one UserOp signed by the passkey. The payer depends on the network (`aa.sponsorSweep` in `src/config/networks.ts`): on Arbitrum One P2Pix sponsors the gas and everything is swept; elsewhere (Ethereum, Sepolia) the account pays in its own ETH, no paymaster, and the sweep keeps back the estimated cost (call, verification and pre-verification gas times the max fee, plus 20% headroom). If the ETH balance cannot cover it, the send fails and shows the ETH the account needs.

Needs: your authenticator (or its sync provider), the RPC, Pimlico, and, outside Arbitrum One, a little ETH in the account for gas. Expect roughly 0.6M gas per passkey-signed UserOp: P-256 is verified in EVM code (Daimo verifier), with no RIP-7212 precompile.

### (b) Magic key export

1. "Exportar chave" in the account panel, shown for any Magic login on a network with the smart-account rail. The key is the same on every network, so a user on a network without the panel switches to one that has it.
2. Magic's own reveal UI opens; the key is shown inside Magic's iframe and the app never sees it.

Needs Magic to be up and its dashboard setting for the reveal flow enabled. Not yet verified. On a non-AA network this key **is** the account: import it into any wallet and the funds are yours. On an AA network it is the Kernel account's root signer, not the account holding the funds: to move them you still need to sign a UserOp with it and relay it, either through another bundler or via path (d).

### (c) Passkey users

A passkey login owns its Kernel account directly. "Enviar" in the account panel sends its ETH or tokens, one at a time, to any address, and needs Pimlico. If Pimlico is down, use path (d).

### (d) Last resort: no bundler at all

Any funded EOA can submit a UserOp itself, on chains where EntryPoint v0.7 is deployed:

- EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (`entryPoint07Address` in `viem/account-abstraction`, the address the Kernel accounts here are built against).
- Kernel WebAuthn validator (backup passkey): `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69` (`KERNEL_WEBAUTHN_VALIDATOR` in `@doiim/passkeys`).

Operator steps (no tool for this ships in the app; this is a manual procedure and not yet verified):

1. Rebuild the account with the same libraries the app uses (permissionless Kernel v0.3.1 and `toKernelBackupPasskeyAccount` from `@doiim/passkeys/smart-account`, or the ECDSA owner key from path (b)).
2. Prepare a UserOp with the calls you need (ETH transfer, ERC-20 `transfer`) and **no paymaster**, so the account pays its own gas in ETH: it needs ETH of its own (or an EntryPoint deposit). Set gas limits by hand; a passkey-signed op needs about 0.6M.
3. Sign it with the passkey or the owner key.
4. From any EOA with ETH for gas, call `handleOps([userOp], beneficiary)` on the EntryPoint above. A bundler is only a convenience: `handleOps` is public.

If the account holds tokens but no ETH, there is no paymaster to quote and step 2 cannot pay; send ETH to the account first.

### (e) Non-AA networks (Magic EOA)

The Magic EOA is the account and there is no Kernel, no backup passkey and no account panel. The only exit is (b). Export the key while Magic works; after that nothing else recovers it. Prefer a passkey or injected wallet for funds you cannot afford to have gated by Magic.

## Matrix

Network = AA network (Kernel account) or non-AA. "Bkp" = backup passkey installed on that same network before the outage. Rows with Pimlico up/down apply to AA networks only.

| Magic | Network | Pimlico | What works                                                                                                                                                                                                               |
| ----- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| up    | AA      | up      | User: "Enviar" in the account panel, or (a) setup now, or export (b). Operator: nothing.                                                                                                                                 |
| up    | AA      | down    | User: export (b); a backup passkey cannot be installed or used (both need a relay). Operator: relay through another bundler (config change and rebuild of `bundlerUrl`, `SECURITY.md`) or use (d) with the exported key. |
| down  | AA      | up      | User: with Bkp, (a) recovery from "Entrar". Without Bkp, only a key exported earlier plus a relayer. Operator: help (d) with an earlier export; no server-side recovery exists.                                          |
| down  | AA      | down    | User: with Bkp or an earlier export, (d) is the only way. Operator: walk the user through (d); needs ETH in the account and a funded EOA.                                                                                |
| up    | non-AA  | up/down | User: export (b); Pimlico is not involved. Operator: nothing.                                                                                                                                                            |
| down  | non-AA  | up/down | User: only a key exported earlier. Without it the funds are gated by Magic. Operator: nothing can be done; there is no backup path here.                                                                                 |
| n/a   | AA      | up      | Passkey or injected-wallet user: (c) "Enviar" in the account panel, or use the wallet directly.                                                                                                                          |
| n/a   | AA      | down    | Passkey user: (d) with the passkey. Injected-wallet user: the EOA rail does not use Pimlico, so nothing changes.                                                                                                         |

## Operator checklist

1. Which login, which network, is a backup passkey installed (`isBackupPasskeyInstalled`, or the account panel's notice "Sua conta ainda não tem passkey de backup")?
2. Is the chain AA (`aa.bundlerUrl` set and the sponsorship policy configured)?
3. Is the network sponsored for the sweep (`aa.sponsorSweep`, Arbitrum One), or does the account hold ETH for its own gas (also needed for (d))?
4. Never ask a user for a seed or a private key; the export UI is Magic's, and the key goes straight into the user's own wallet.
