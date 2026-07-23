import { useAppKit } from '@reown/appkit/vue';

/**
 * Single entry point for opening the Reown AppKit connect modal.
 * Replaces the inline `connectAccount` helper that had been copy-pasted across
 * BuyerSearchComponent, SellerComponent, and SellerSearchComponent.
 */
export const useConnectWallet = () => {
  const { open } = useAppKit();
  return {
    connectWallet: (): void => {
      open();
    },
  };
};
