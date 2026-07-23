import { useAppKit } from '@doiim/reown-appkit/vue';

export const useConnectWallet = () => {
  const { open } = useAppKit();
  return {
    connectWallet: (): void => {
      open();
    },
  };
};
