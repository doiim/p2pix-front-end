import { isPasskeyCancelled } from '@doiim/passkeys';
import type { WalletPrompt } from '@/blockchain/swap';

/** The swap a flow's prompts belong to: `sell` goes in, `buy` comes out. */
type SwapPair = { sell: string; buy: string };

const LABELS: Record<WalletPrompt, (pair: SwapPair) => string> = {
  release: (pair) => `receber o ${pair.sell}`,
  approve: (pair) => `autorizar a CoW Swap a usar o ${pair.sell}`,
  sign: (pair) => `assinar a ordem de troca para ${pair.buy}`,
};

/**
 * Says up front that the wallet's next prompts all belong to this trade, for
 * wallets that cannot batch them into one. Null when there is a single prompt.
 */
export const promptsNotice = (prompts: WalletPrompt[], pair: SwapPair) =>
  prompts.length === 0
    ? null
    : `Sua carteira vai pedir até ${prompts.length} confirmações seguidas, todas desta troca: ${prompts
        .map((prompt, i) => `${i + 1}) ${LABELS[prompt](pair)}`)
        .join('; ')}.`;

// A rejection counts as the user's cancel only when the wallet says the user
// did it — EIP-1193 code 4001 or phrasing that names them. Relayers and
// paymasters reject too, and those are failures to retry, not cancellations.
export function isUserRejection(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if ('code' in e && e.code === 4001) return true;
  const msg = e instanceof Error ? e.message : '';
  return (
    /\buser (rejected|denied|cancel+ed|aborted|declined)/i.test(msg) ||
    /\b(rejected|denied|cancel+ed|declined) by the user/i.test(msg)
  );
}

/** A failure whose message is pt-BR copy written for the user, shown as-is. */
export class UserFacingError extends Error {}

/**
 * The pt-BR line for a failed wallet action: our own `UserFacingError` as
 * written, a cancel named as one, `fallback` for anything else. Wallet,
 * passkey and RPC errors arrive in English, so their message is never shown.
 */
export const walletErrorMessage = (e: unknown, fallback: string): string => {
  if (e instanceof UserFacingError) return e.message;
  if (isPasskeyCancelled(e) || isUserRejection(e)) {
    return 'Ação cancelada na carteira.';
  }
  return fallback;
};
