import { computed, ref, type Ref } from 'vue';
import type { Address } from 'viem';
import { useClipboard } from '@vueuse/core';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';

export type AccountView =
  | 'account'
  | 'send'
  | 'sendStatus'
  | 'receive'
  | 'recovery';

// Module-level: every screen in the card shares one stack.
const stack = ref<AccountView[]>(['account']);

export function useAccountRouter() {
  const current = computed<AccountView>(
    () => stack.value[stack.value.length - 1] ?? 'account',
  );

  const push = (view: AccountView): void => {
    stack.value = [...stack.value, view];
  };
  const back = (): void => {
    if (stack.value.length > 1) stack.value = stack.value.slice(0, -1);
  };
  const reset = (): void => {
    stack.value = ['account'];
  };

  return { current, push, back, reset };
}

export function useCopyAddress(
  source: Ref<Address | null> = usePasskeyAccount().smartAccountAddress,
) {
  const { showToast } = useUser();
  const { copy, isSupported } = useClipboard({ legacy: true });
  return async (): Promise<void> => {
    if (!source.value) return;
    if (!isSupported.value) {
      showToast('error', 'Copie o endereço manualmente');
      return;
    }
    await copy(source.value);
    showToast('success', 'Endereço copiado!');
  };
}
