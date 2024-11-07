<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useEtherStore } from "@/store/ether";
import { ref, watch } from "vue";
import { onClickOutside } from "@vueuse/core";
import { NetworkEnum } from "@/model/NetworkEnum";
import { getNetworkImage } from "@/utils/imagesPath";
import { Networks } from "@/model/Networks";

import { useOnboard } from "@web3-onboard/vue";

import ChevronDown from "@/assets/chevronDown.svg";
import Account from "@/assets/account.svg";
import TwitterIcon from "@/assets/twitterIcon.svg";
import LinkedinIcon from "@/assets/linkedinIcon.svg";
import GithubIcon from "@/assets/githubIcon.svg";
import { connectProvider } from "@/blockchain/provider";

// Store reference
const etherStore = useEtherStore();

const { walletAddress, sellerView } = storeToRefs(etherStore);

const menuOpenToggle = ref<boolean>(false);
const infoMenuOpenToggle = ref<boolean>(false);
const currencyMenuOpenToggle = ref<boolean>(false);
const infoMenuRef = ref<any>(null);
const walletAddressRef = ref<any>(null);
const currencyRef = ref<any>(null);

const { connectedWallet, connectedChain, setChain, disconnectWallet } =
  useOnboard();

const connnectWallet = async (): Promise<void> => {
  const { connectWallet } = useOnboard();
  await connectWallet();
};

watch(connectedWallet, async (newVal: any) => {
  connectProvider(newVal.provider);
  const addresses = await newVal.provider.request({ method: "eth_accounts" });
  etherStore.setWalletAddress(addresses.shift());
});

watch(connectedChain, (newVal: any) => {
  etherStore.setNetworkId(newVal?.id);
});

const formatWalletAddress = (): string => {
  const walletAddressLength = walletAddress.value.length;
  const initialText = walletAddress.value.substring(0, 5);
  const finalText = walletAddress.value.substring(
    walletAddressLength - 4,
    walletAddressLength
  );
  return `${initialText}...${finalText}`;
};

const disconnectUser = async (): Promise<void> => {
  etherStore.setWalletAddress("");
  await disconnectWallet({ label: connectedWallet.value?.label || "" });
  closeMenu();
};

const closeMenu = (): void => {
  menuOpenToggle.value = false;
};

const networkChange = async (network: NetworkEnum): Promise<void> => {
  currencyMenuOpenToggle.value = false;
  try {
    await setChain({
      chainId: Networks[network].chainId,
      wallet: connectedWallet.value?.label || "",
    });
    etherStore.setNetworkId(network);
  } catch (error) {
    console.log("Error changing network", error);
  }
};

onClickOutside(walletAddressRef, () => {
  menuOpenToggle.value = false;
});

onClickOutside(currencyRef, () => {
  currencyMenuOpenToggle.value = false;
});

onClickOutside(infoMenuRef, () => {
  infoMenuOpenToggle.value = false;
});
</script>

<template>
  <header class="z-20">
    <RouterLink :to="'/'" class="default-button">
      <img
        alt="P2Pix logo"
        class="logo hidden md:inline-block"
        width="200"
        height="75"
        src="@/assets/logo.svg?url"
      />
      <img
        alt="P2Pix logo"
        class="logo inline-block md:hidden w-10/12"
        width="40"
        height="40"
        src="@/assets/logo2.svg?url"
      />
    </RouterLink>

    <div class="flex sm:gap-4 gap-2 items-center">
      <div class="flex flex-col">
        <div
          v-show="infoMenuOpenToggle"
          class="mt-10 absolute w-full text-gray-900 hidden md:inline-block"
        >
          <div class="mt-2">
            <div class="bg-white rounded-md z-10 -left-32 w-52">
              <div class="menu-button gap-2 px-4 rounded-md cursor-pointer">
                <span class="text-gray-900 py-4 text-end font-semibold text-sm">
                  Documentação
                </span>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
              <RouterLink
                :to="'/faq'"
                class="menu-button gap-2 px-4 rounded-md cursor-pointer"
              >
                <span
                  class="text-gray-900 py-4 text-end font-semibold text-sm whitespace-nowrap"
                >
                  Perguntas frequentes
                </span>
              </RouterLink>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
              <div
                class="sm:text-center sm:justify-center ml-8 sm:ml-0 gap-2 px-4 rounded-md float-right"
              >
                <div class="redirect_button">
                  <a
                    href="https://www.twitter.com/doiim"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <TwitterIcon
                      alt="Twitter"
                      width="20"
                      height="20"
                      class="cursor-pointer"
                    />
                  </a>
                  <a
                    href="https://www.linkedin.com/company/doiim/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkedinIcon
                      alt="LinkedIn"
                      width="20"
                      height="20"
                      class="cursor-pointer"
                    />
                  </a>
                  <a
                    href="https://www.github.com/doiim"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GithubIcon
                      alt="Github"
                      width="20"
                      height="20"
                      class="cursor-pointer"
                    />
                  </a>
                </div>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
            </div>
          </div>
        </div>
        <div
          ref="infoMenuRef"
          class="default-button hidden md:inline-block cursor-pointer"
          @click="
            [
              (infoMenuOpenToggle = !infoMenuOpenToggle),
              (menuOpenToggle = false),
              (currencyMenuOpenToggle = false),
            ]
          "
        >
          <h1
            class="text-gray-50 font-semibold sm:text-base"
            :style="{
              'border-bottom': infoMenuOpenToggle
                ? '2px solid white'
                : 'transparent',
            }"
          >
            Menu
          </h1>
        </div>
      </div>
      <RouterLink
        :to="'/faq'"
        v-if="!walletAddress"
        class="default-button inline-block md:hidden"
      >
        FAQ
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        class="default-button sm:whitespace-normal whitespace-nowrap hidden md:inline-block"
      >
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        v-if="!walletAddress"
        class="default-button sm:whitespace-normal whitespace-nowrap inline-block md:hidden"
      >
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </RouterLink>
      <div class="flex flex-col" v-if="walletAddress">
        <div
          ref="currencyRef"
          class="group top-bar-info cursor-pointer h-10"
          @click="
            [
              (currencyMenuOpenToggle = !currencyMenuOpenToggle),
              (menuOpenToggle = false),
              (infoMenuOpenToggle = false),
            ]
          "
        >
          <img
            alt="Choosed network image"
            :src="getNetworkImage(NetworkEnum[etherStore.networkName])"
            height="24"
            width="24"
          />
          <span class="default-text hidden md:inline-block">
            {{ Networks[etherStore.networkName].chainName }}
          </span>
          <ChevronDown
            class="pr-4 sm:pr-0 transition-all duration-300 ease-in-out"
            :class="{ 'scale-y-[-1]': currencyMenuOpenToggle }"
            alt="Chevron Down"
          />
        </div>
        <div
          v-show="currencyMenuOpenToggle"
          class="mt-10 pl-3 absolute w-full text-gray-900 hidden md:inline-block"
        >
          <div class="mt-2">
            <div class="bg-white rounded-md z-10">
              <div
                v-for="(chainData, network) in Networks"
                :key="network"
                class="menu-button gap-2 px-4 rounded-md cursor-pointer"
                @click="networkChange(network)"
              >
                <img
                  :alt="chainData.chainName + ' image'"
                  width="20"
                  height="20"
                  :src="getNetworkImage(NetworkEnum[network])"
                />
                <span class="text-gray-900 py-4 text-end font-semibold text-sm">
                  {{ chainData.chainName }}
                </span>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        v-if="!walletAddress"
        class="border-amber-500 border-2 rounded default-button hidden md:inline-block"
        @click="connnectWallet()"
      >
        Conectar carteira
      </button>
      <button
        type="button"
        v-if="!walletAddress"
        class="border-amber-500 border-2 rounded default-button inline-block md:hidden"
        @click="connnectWallet()"
      >
        Conectar
      </button>
      <div v-if="walletAddress" class="account-info">
        <div class="flex flex-col">
          <div
            ref="walletAddressRef"
            class="top-bar-info cursor-pointer h-10"
            @click="
              [
                (menuOpenToggle = !menuOpenToggle),
                (currencyMenuOpenToggle = false),
                (infoMenuOpenToggle = false),
              ]
            "
          >
            <Account alt="Account image" />
            <span class="default-text">
              {{ formatWalletAddress() }}
            </span>
            <ChevronDown
              class="pr-4 sm:pr-0 transition-all duration-300 ease-in-out"
              :class="{ 'scale-y-[-1]': menuOpenToggle }"
              alt="Chevron Down"
            />
          </div>
          <div
            v-show="menuOpenToggle"
            class="mt-10 absolute w-full text-gray-900 hidden md:inline-block"
          >
            <div class="pl-4 mt-2">
              <div class="bg-white rounded-md z-10">
                <RouterLink
                  onclick="closeMenu()"
                  to="/manage_bids"
                  class="redirect_button menu-button"
                >
                  Gerenciar Ofertas
                </RouterLink>
                <div class="w-full flex justify-center">
                  <hr class="w-4/5" />
                </div>
                <button
                  onclick="disconnectUser()"
                  class="redirect_button menu-button"
                >
                  Desconectar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-show="menuOpenToggle"
      class="mobile-menu fixed w-4/5 text-gray-900 inline-block md:hidden"
    >
      <div class="pl-4 mt-2 h-full">
        <div class="bg-white rounded-md z-10 h-full">
          <div class="menu-button" @click="closeMenu()">
            <RouterLink
              :to="sellerView ? '/' : '/seller'"
              class="redirect_button mt-2"
            >
              {{ sellerView ? "Quero comprar" : "Quero vender" }}
            </RouterLink>
          </div>
          <div class="w-full flex justify-center">
            <hr class="w-4/5" />
          </div>
          <div class="menu-button" @click="closeMenu()">
            <RouterLink to="/manage_bids" class="redirect_button">
              Gerenciar Ofertas
            </RouterLink>
          </div>
          <div class="w-full flex justify-center">
            <hr class="w-4/5" />
          </div>
          <div class="menu-button" @click="disconnectUser">
            <RouterLink to="/" class="redirect_button">
              Desconectar
            </RouterLink>
          </div>
          <div class="w-full flex justify-center">
            <hr class="w-4/5" />
          </div>
          <div class="redirect_button mx-10">
            <a
              href="https://www.twitter.com/doiim/"
              target="_blank"
              rel="noreferrer"
            >
              <TwitterIcon alt="Twitter" width="20" height="20" />
            </a>
            <a
              href="https://www.linkedin.com/company/doiim/"
              target="_blank"
              rel="noreferrer"
            >
              <LinkedinIcon alt="LinkedIn" width="20" height="20" />
            </a>
            <a
              href="https://github.com/doiim/"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon alt="Github" width="20" height="20" />
            </a>
          </div>
        </div>
      </div>
    </div>
    <div
      v-show="currencyMenuOpenToggle"
      class="mobile-menu fixed w-4/5 text-gray-900 inline-block sm:hidden"
    >
      <div class="pl-4 mt-2 h-full">
        <div class="bg-white rounded-md z-10 h-full">
          <div
            v-for="(chainData, network) in Networks"
            :key="network"
            class="menu-button gap-2 sm:px-4 rounded-md cursor-pointer py-2"
            @click="networkChange(network)"
          >
            <img
              :alt="chainData.chainName + 'image'"
              width="20"
              height="20"
              :src="getNetworkImage(NetworkEnum[network])"
            />
            <span class="text-gray-900 py-4 text-end font-bold text-sm">
              {{ chainData.chainName }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
header {
  @apply flex flex-row justify-between w-full items-center;
}

.default-button {
  @apply sm:px-4 px-3 py-2 rounded text-gray-50 font-semibold sm:text-base text-xs hover:bg-transparent;
}

.account-info {
  @apply flex items-center gap-6;
}

.default-text {
  @apply text-gray-50 font-semibold text-base;
}

.top-bar-info {
  @apply flex justify-between gap-2 px-4 py-2 border-amber-500 border-2 sm:rounded rounded-lg items-center;
}

.redirect_button {
  @apply py-5 px-4 text-gray-900 flex sm:font-semibold font-bold sm:text-xs text-sm justify-between;
}

.menu-button {
  @apply flex sm:text-center sm:justify-center hover:bg-gray-200 hover:rounded-lg w-full;
}

a:hover {
  @apply bg-gray-200 rounded;
}

.mobile-menu {
  margin-top: 1400px;
  bottom: 0px;
  height: auto;
}
</style>
