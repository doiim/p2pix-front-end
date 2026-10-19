import { computed, ref } from 'vue';
import { useClipboard } from '@vueuse/core';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';

export type AccountView = 'account' | 'send' | 'sendPreview' | 'receive';

const TITLES: Record<AccountView, string> = {
  account: 'Minha conta',
  send: 'Enviar',
  sendPreview: 'Revisar envio',
  receive: 'Receber',
};

// Module-level: every screen in the card shares one stack.
const stack = ref<AccountView[]>(['account']);

export function useAccountRouter() {
  const current = computed<AccountView>(
    () => stack.value[stack.value.length - 1] ?? 'account',
  );
  const canGoBack = computed(() => stack.value.length > 1);
  const title = computed(() => TITLES[current.value]);

  const push = (view: AccountView): void => {
    stack.value = [...stack.value, view];
  };
  const back = (): void => {
    if (stack.value.length > 1) stack.value = stack.value.slice(0, -1);
  };
  const reset = (): void => {
    stack.value = ['account'];
  };

  return { current, canGoBack, title, push, back, reset };
}

export function useCopyAddress() {
  const { smartAccountAddress } = usePasskeyAccount();
  const { showToast } = useUser();
  const { copy, isSupported } = useClipboard({ legacy: true });
  return async (): Promise<void> => {
    if (!smartAccountAddress.value) return;
    if (!isSupported.value) {
      showToast('error', 'Copie o endereço manualmente');
      return;
    }
    await copy(smartAccountAddress.value);
    showToast('success', 'Endereço copiado!');
  };
}
