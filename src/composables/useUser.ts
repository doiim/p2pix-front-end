import { ref } from 'vue';
import type { Participant } from '../utils/bbPay';
import { DEFAULT_NETWORK, Networks } from '@/config/networks';
import { TokenEnum, NetworkConfig } from '@/model/NetworkEnum';

export type Toast = { type: 'success' | 'error'; message: string };

/** How long a toast stays on screen — shared by every toast in the app. */
const TOAST_MS = 3_000;

const network = ref(DEFAULT_NETWORK);
const selectedToken = ref<TokenEnum>(TokenEnum.BRZ);
const sellerView = ref(false);
const seller = ref<Participant>({} as Participant);
const sellerId = ref('');
const toast = ref<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Client-only state: the chain/token the UI is pointed
 * at, and the in-progress seller registration. Anything fetched from a
 * subgraph, RPC or the BB Pay API lives in the vue-query cache instead.
 */
export function useUser() {
  const setSelectedToken = (token: TokenEnum) => {
    selectedToken.value = token;
  };

  const setNetwork = (chain: NetworkConfig) => {
    network.value = chain;
  };

  const setNetworkById = (id: number) => {
    const chain = Networks.find((n) => n.id === id);
    if (chain) {
      network.value = chain;
    }
  };

  const setSellerView = (view: boolean) => {
    sellerView.value = view;
  };

  const setSeller = (newSeller: Participant) => {
    seller.value = newSeller;
  };

  const setSellerId = (id: string) => {
    sellerId.value = id;
  };

  const showToast = (type: Toast['type'], message: string): void => {
    toast.value = { type, message };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.value = null), TOAST_MS);
  };

  return {
    // State
    network,
    selectedToken,
    sellerView,
    seller,
    sellerId,
    toast,

    // Actions
    setSelectedToken,
    setNetwork,
    setNetworkById,
    setSellerView,
    setSeller,
    setSellerId,
    showToast,
  };
}
