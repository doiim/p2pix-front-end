import { useAppKit } from '@reown/appkit/vue';

export const useConnectWallet = () => {
  const { open } = useAppKit();
  return {
    connectWallet: (): void => {
      open();
    },
  };
};
