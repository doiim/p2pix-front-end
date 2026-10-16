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
import { NATIVE_TOKEN, type SendToken } from '@/model/NetworkEnum';

const CTA_LABELS = {
  SELECT_TOKEN: 'Selecionar token',
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

// Module-level draft: the send and preview screens are separate components on
// the same stack and must see the same values.
const token = ref<SendToken | null>(null);
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
  const decimals = computed(() =>
    account.decimalsOf(token.value ?? NATIVE_TOKEN),
  );
  const symbol = computed(() =>
    token.value ? account.symbolOf(token.value) : '',
  );
  const amount = computed(() => parseAmount(amountInput.value, decimals.value));

  /** Spendable maximum: the full balance; sponsored operations spend no ETH. */
  const maxAmount = computed(() =>
    token.value === null ? null : account.balanceOf(token.value),
  );

  const receiverAddress = computed(() => {
    const text = receiver.value.trim();
    if (!isAddress(text) || text.toLowerCase() === zeroAddress) return null;
    return self.value.includes(text.toLowerCase()) ? null : getAddress(text);
  });

  const cta = computed<SendCta>(() => {
    if (token.value === null) return 'SELECT_TOKEN';
    if (amountInput.value.trim() === '' || amount.value === 0n) {
      return 'ADD_AMOUNT';
    }
    if (amount.value === null) return 'INCORRECT_VALUE';
    if (maxAmount.value !== null && amount.value > maxAmount.value) {
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
  const setToken = (next: SendToken): void => {
    if (token.value !== next) amountInput.value = '';
    token.value = next;
  };

  const setMax = (): void => {
    if (maxAmount.value !== null) {
      amountInput.value = formatUnits(maxAmount.value, decimals.value);
    }
  };

  const pasteAddress = async (): Promise<void> => {
    try {
      receiver.value = (await navigator.clipboard.readText()).trim();
    } catch {
      showToast('error', 'Não foi possível ler a área de transferência');
    }
  };

  const reset = (): void => {
    token.value = null;
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
