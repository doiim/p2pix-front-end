import { computed, ref } from 'vue';
import {
  type Address,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
} from 'viem';

import { getCurrentAccount } from '@/blockchain/provider';
import {
  usePasskeyAccount,
  type SendResult,
} from '@/composables/usePasskeyAccount';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { useUser } from '@/composables/useUser';
import type { NetworkConfig } from '@/model/NetworkEnum';

type SendCta =
  | 'ADD_AMOUNT'
  | 'INCORRECT_VALUE'
  | 'INSUFFICIENT_FUNDS'
  | 'ADD_ADDRESS'
  | 'INVALID_ADDRESS'
  | 'SEND';

/** Parse a user-typed decimal (`,` or `.`) into wei; null when invalid. */
const parseAmount = (input: string, decimals: number): bigint | null => {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) return null;
  if ((text.split('.')[1] ?? '').length > decimals) return null;
  return parseUnits(text, decimals);
};

// Module-level draft: the send and status screens are separate components on
// the same stack and must see the same values. No token means the native coin,
// so the draft starts on the token selected across the app.
const token = ref<string | undefined>(useUser().selectedToken.value);
const amountInput = ref('');
const receiver = ref('');
// Kept outside any screen: switching Comprar/Vender remounts the panel while
// the passkey prompt is open, and the receipt must survive that.
const lastSent = ref<
  | (SendResult & {
      token?: string;
      amountText: string;
      to: Address;
      network: NetworkConfig;
    })
  | null
>(null);
export function useSendForm() {
  const account = usePasskeyAccount();
  const { showToast, selectedToken, network } = useUser();

  const self = computed(() =>
    [account.smartAccountAddress.value, getCurrentAccount().address]
      .filter((a): a is `0x${string}` => Boolean(a))
      .map((a) => a.toLowerCase()),
  );
  const decimals = computed(() => account.decimalsOf(token.value));
  const symbol = computed(() => account.symbolOf(token.value));
  const amount = computed(() => parseAmount(amountInput.value, decimals.value));

  /**
   * Spendable maximum: the full balance. Smart-account sends are sponsored; a
   * regular wallet pays gas in the native coin, so it refuses sending all of it.
   */
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
    return 'SEND';
  });

  const amountText = computed(() =>
    amount.value === null
      ? ''
      : `${formatTokenAmount(amount.value, decimals.value)} ${symbol.value}`,
  );
  const setToken = (next?: string): void => {
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

  /** Sends the draft; on success the draft resets and `lastSent` holds it. */
  const submit = async (): Promise<boolean> => {
    const to = receiverAddress.value;
    if (account.busy.value || amount.value === null || !to) return false;
    lastSent.value = null;
    // The receipt names the network the send went out on, even after a switch.
    const sent = {
      token: token.value,
      amountText: amountText.value,
      to,
      network: network.value,
    };
    const result = await account.send({
      token: token.value,
      amount: amount.value,
      to,
    });
    if (!result) return false;
    lastSent.value = { ...result, ...sent };
    reset();
    return true;
  };

  const reset = (): void => {
    token.value = selectedToken.value;
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
    lastSent,
    submit,
    setToken,
    setMax,
    pasteAddress,
    reset,
  };
}
