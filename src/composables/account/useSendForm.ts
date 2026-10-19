import { computed, ref } from 'vue';
import {
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
} from 'viem';

import { getCurrentAccount } from '@/blockchain/provider';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { useUser } from '@/composables/useUser';
import { TokenEnum } from '@/model/NetworkEnum';

const CTA_LABELS = {
  ADD_AMOUNT: 'Adicionar valor',
  INCORRECT_VALUE: 'Valor inválido',
  INSUFFICIENT_FUNDS: 'Saldo insuficiente',
  ADD_ADDRESS: 'Adicionar endereço',
  INVALID_ADDRESS: 'Endereço inválido',
  PREVIEW_SEND: 'Revisar envio',
} as const;

type SendCta = keyof typeof CTA_LABELS;

/** Parse a user-typed decimal (`,` or `.`) into wei; null when invalid. */
const parseAmount = (input: string, decimals: number): bigint | null => {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) return null;
  if ((text.split('.')[1] ?? '').length > decimals) return null;
  return parseUnits(text, decimals);
};

// The token selected across the app, or BRZ when this network does not list it.
const defaultToken = (): TokenEnum => {
  const user = useUser();
  return user.network.value.tokens[user.selectedToken.value]
    ? user.selectedToken.value
    : TokenEnum.BRZ;
};

// Module-level draft: the send and preview screens are separate components on
// the same stack and must see the same values. No token means the native coin.
const token = ref<TokenEnum | undefined>(defaultToken());
const amountInput = ref('');
const receiver = ref('');
export function useSendForm() {
  const account = usePasskeyAccount();
  const { showToast } = useUser();

  const self = computed(() =>
    [account.smartAccountAddress.value, getCurrentAccount().address]
      .filter((a): a is `0x${string}` => Boolean(a))
      .map((a) => a.toLowerCase()),
  );
  const decimals = computed(() => account.decimalsOf(token.value));
  const symbol = computed(() => account.symbolOf(token.value));
  const amount = computed(() => parseAmount(amountInput.value, decimals.value));

  /** Spendable maximum: the full balance; sponsored operations spend no ETH. */
  const maxAmount = computed(() => account.balanceOf(token.value));

  const receiverAddress = computed(() => {
    const text = receiver.value.trim();
    if (!isAddress(text) || text.toLowerCase() === zeroAddress) return null;
    return self.value.includes(text.toLowerCase()) ? null : getAddress(text);
  });

  const cta = computed<SendCta>(() => {
    if (amountInput.value.trim() === '' || amount.value === 0n) {
      return 'ADD_AMOUNT';
    }
    if (amount.value === null) return 'INCORRECT_VALUE';
    if (amount.value > maxAmount.value) {
      return 'INSUFFICIENT_FUNDS';
    }
    if (receiver.value.trim() === '') return 'ADD_ADDRESS';
    if (receiverAddress.value === null) return 'INVALID_ADDRESS';
    return 'PREVIEW_SEND';
  });
  const ctaLabel = computed(() => CTA_LABELS[cta.value]);

  const amountText = computed(() =>
    amount.value === null
      ? ''
      : `${formatTokenAmount(amount.value, decimals.value)} ${symbol.value}`,
  );
  const setToken = (next?: TokenEnum): void => {
    if (token.value !== next) amountInput.value = '';
    token.value = next;
  };

  const setMax = (): void => {
    amountInput.value = formatUnits(maxAmount.value, decimals.value);
  };

  const pasteAddress = async (): Promise<void> => {
    try {
      receiver.value = (await navigator.clipboard.readText()).trim();
    } catch {
      showToast('error', 'Não foi possível ler a área de transferência');
    }
  };

  const reset = (): void => {
    token.value = defaultToken();
    amountInput.value = '';
    receiver.value = '';
  };

  return {
    token,
    amountInput,
    receiver,
    symbol,
    amount,
    amountText,
    maxAmount,
    receiverAddress,
    cta,
    ctaLabel,
    setToken,
    setMax,
    pasteAddress,
    reset,
  };
}
