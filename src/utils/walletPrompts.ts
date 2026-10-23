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
