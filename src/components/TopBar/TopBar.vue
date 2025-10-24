<script setup lang="ts">
import { ref, watch } from "vue";
import { useUser } from "@/composables/useUser";
import { onClickOutside } from "@vueuse/core";
import { getNetworkImage } from "@/utils/imagesPath";
import { Networks } from "@/config/networks";
import { useOnboard } from "@web3-onboard/vue";

import ChevronDown from "@/assets/chevronDown.svg";
import TwitterIcon from "@/assets/twitterIcon.svg";
import LinkedinIcon from "@/assets/linkedinIcon.svg";
import GithubIcon from "@/assets/githubIcon.svg";
import { connectProvider } from "@/blockchain/provider";
import { DEFAULT_NETWORK } from "@/config/networks";
import type { NetworkConfig } from "@/model/NetworkEnum";

// Use the new composable
const user = useUser();
const { walletAddress, sellerView, network } = user;

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
  user.setWalletAddress(addresses.shift());
});

watch(connectedChain, (newVal: any) => {
  // Check if connected chain is valid, otherwise default to Sepolia
  if (
    !newVal ||
    !Object.values(Networks).some(
      (network) => network.id === Number(newVal.id)
    )
  ) {
    console.log(
      "Invalid or unsupported network detected, defaulting to Sepolia"
    );
    user.setNetwork(DEFAULT_NETWORK);
    return;
  }
  user.setNetworkById(newVal?.id);
});

const formatWalletAddress = (): string => {
  if (!walletAddress.value)
    throw new Error("Wallet not connected");
  const walletAddressLength = walletAddress.value.length;
  const initialText = walletAddress.value.substring(0, 5);
  const finalText = walletAddress.value.substring(
    walletAddressLength - 4,
    walletAddressLength
  );
  return `${initialText}...${finalText}`;
};

const disconnectUser = async (): Promise<void> => {
  user.setWalletAddress(null);
  await disconnectWallet({ label: connectedWallet.value?.label || "" });
  closeMenu();
};

const closeMenu = (): void => {
  menuOpenToggle.value = false;
};

const networkChange = async (network: NetworkConfig): Promise<void> => {
  currencyMenuOpenToggle.value = false;
  const chainId = network.id.toString(16)
  try {
    await setChain({
      chainId: `0x${chainId}`,
      wallet: connectedWallet.value?.label || "",
    });
    user.setNetwork(network);
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
        <button
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
            class="topbar-text topbar-link"
            :style="{
              'border-bottom': infoMenuOpenToggle
                ? '2px solid white'
                : '2px solid transparent',
            }"
          >
            Menu
          </h1>
        </button>
        <transition name="dropdown">
          <div
            v-show="infoMenuOpenToggle"
            class="mt-10 absolute w-full text-gray-900 hidden lg:inline-block"
          >
            <div class="mt-2">
              <div class="bg-white rounded-md z-10 -left-36 w-52">
                <RouterLink
                  :to="'/explore'"
                  class="menu-button gap-2 px-4 rounded-md cursor-pointer"
                >
                  <span
                    class="text-gray-900 py-4 text-end font-semibold text-sm whitespace-nowrap"
                  >
                    Explorar Transações
                  </span>
                </RouterLink>
                <div class="w-full flex justify-center">
                  <hr class="w-4/5" />
                </div>
                <div class="menu-button gap-2 px-4 rounded-md cursor-pointer">
                  <span
                    class="text-gray-900 py-4 text-end font-semibold text-sm"
                  >
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
                  class="sm:text-center sm:justify-center ml-8 sm:ml-0 gap-2 px-4 rounded-md"
                >
                  <div class="redirect_button flex justify-around">
                    <a href="https://www.twitter.com/doiim">
                      <img
                        alt="Twitter"
                        width="20"
                        height="20"
                        src="@/assets/twitterIcon.svg?url"
                        class="cursor-pointer"
                      />
                    </a>
                    <a href="https://www.linkedin.com/company/doiim/">
                      <img
                        alt="LinkedIn"
                        width="20"
                        height="20"
                        src="@/assets/linkedinIcon.svg?url"
                        class="cursor-pointer"
                        href="https://www.linkedin.com/company/doiim/"
                      />
                    </a>
                    <a href="https://www.github.com/doiim">
                      <img
                        alt="Github"
                        width="20"
                        height="20"
                        src="@/assets/githubIcon.svg?url"
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
        </transition>
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
        class="default-button whitespace-nowrap w-40 sm:w-44 md:w-36 hidden md:inline-block"
      >
        <div class="topbar-text topbar-link text-center mx-auto inline-block">
          {{ sellerView ? "Quero comprar" : "Quero vender" }}
        </div>
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        v-if="!walletAddress"
        class="default-button sm:whitespace-normal whitespace-nowrap inline-block md:hidden w-40 sm:w-44 md:w-36"
      >
        <div class="topbar-text topbar-link text-center mx-auto inline-block">
          {{ sellerView ? "Quero comprar" : "Quero vender" }}
        </div>
      </RouterLink>
      <div class="flex flex-col relative" v-if="walletAddress">
        <div
          ref="currencyRef"
          class="top-bar-info cursor-pointer h-10 group hover:bg-gray-50 transition-all duration-500 ease-in-out"
          :class="{ 'bg-gray-50': currencyMenuOpenToggle }"
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
            :src="getNetworkImage(network.name)"
            height="24"
            width="24"
          />
          <span
            class="default-text hidden sm:inline-block text-gray-50 group-hover:text-gray-900 transition-all duration-500 ease-in-out whitespace-nowrap text-ellipsis overflow-hidden"
            :class="{ '!text-gray-900': currencyMenuOpenToggle }"
          >
            {{
              user.network.value.name || "Invalid Chain"
            }}
          </span>
          <div
            class="transition-all duration-500 ease-in-out mt-1"
            :class="{ 'scale-y-[-1]': currencyMenuOpenToggle }"
          >
            <ChevronDown
              viewBox="0 0 16 16"
              class="h-4 w-4 text-white group-hover:text-gray-900"
              :class="{ '!text-gray-900': currencyMenuOpenToggle }"
            />
          </div>
        </div>
        <transition name="dropdown">
          <div
            v-show="currencyMenuOpenToggle"
            class="mt-10 absolute text-gray-900 min-w-max left-0 hidden md:inline-block"
          >
            <div
              class="mt-2 bg-white rounded-md border border-gray-300 drop-shadow-md shadow-md overflow-clip"
            >
              <div
                v-for="network in Networks"
                :key="network.id"
                class="menu-button p-4 gap-2 cursor-pointer hover:bg-gray-200 flex items-center !justify-start whitespace-nowrap transition-colors duration-150 ease-in-out"
                @click="networkChange(network)"
              >
                <img
                  :alt="network.name + ' image'"
                  width="20"
                  height="20"
                  :src="getNetworkImage(network.name)"
                  class="mr-2 ml-1"
                />
                <span class="text-gray-900 font-semibold text-sm">
                  {{ network.name }}
                </span>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
            </div>
          </div>
        </transition>
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
        <div class="flex flex-col relative">
          <div
            ref="walletAddressRef"
            class="top-bar-info cursor-pointer h-10 group hover:bg-gray-50 transition-all duration-500 ease-in-out"
            :class="{ 'bg-gray-50': menuOpenToggle }"
            @click="
              [
                (menuOpenToggle = !menuOpenToggle),
                (currencyMenuOpenToggle = false),
                (infoMenuOpenToggle = false),
              ]
            "
          >
            <img alt="Account image" src="@/assets/account.svg?url" />
            <span
              class="default-text text-gray-50 group-hover:text-gray-900 transition-all duration-500 ease-in-out truncate text-ellipsis"
              :class="{ '!text-gray-900': menuOpenToggle }"
            >
              {{ formatWalletAddress() }}
            </span>
            <div
              class="transition-all duration-500 ease-in-out mt-1"
              :class="{ 'scale-y-[-1]': menuOpenToggle }"
            >
              <ChevronDown
                viewBox="0 0 16 16"
                class="h-4 w-4 text-white group-hover:text-gray-900"
                :class="{ '!text-gray-900': menuOpenToggle }"
              />
            </div>
          </div>
          <transition name="dropdown">
            <div
              v-show="menuOpenToggle"
              class="mt-10 absolute w-full text-gray-900 hidden md:inline-block"
            >
              <div class="pl-4 mt-2">
                <div
                  class="bg-white rounded-md z-10 border border-gray-300 drop-shadow-md shadow-md overflow-clip"
                >
                  <RouterLink
                    to="/manage_bids"
                    class="redirect_button menu-button"
                    @click="closeMenu()"
                  >
                    Gerenciar Ofertas
                  </RouterLink>
                  <div class="w-full flex justify-center">
                    <hr class="w-4/5" />
                  </div>
                  <RouterLink
                    to="/"
                    class="redirect_button menu-button"
                    @click="disconnectUser"
                  >
                    Desconectar
                  </RouterLink>
                </div>
              </div>
            </div>
          </transition>
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
      class="mobile-menu fixed w-4/5 text-gray-900 inline-block md:hidden"
    >
      <div class="pl-4 mt-2 h-full">
        <div class="bg-white rounded-md z-10 h-full">
          <div
            v-for="network in Networks"
            :key="network.id"
            class="menu-button gap-2 sm:px-4 rounded-md cursor-pointer py-2 px-4"
            @click="networkChange(network)"
          >
            <img
              :alt="network.name + 'image'"
              width="20"
              height="20"
              :src="getNetworkImage(network.name)"
            />
            <span class="text-gray-900 py-4 text-end font-bold text-sm">
              {{ network.name }}
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

.topbar-text {
  @apply text-gray-50 font-semibold sm:text-base mt-0.5 transition-all duration-500;
}
.topbar-link {
  @apply mt-0.5 hover:border-b-2 border-b-2 border-transparent hover:!border-white;
}

.account-info {
  @apply flex items-center gap-6;
}

.default-text {
  @apply text-gray-50 font-semibold text-base;
}

.top-bar-info {
  @apply flex justify-between items-center gap-2 px-4 py-2 border-amber-500 border-2 sm:rounded rounded-lg;
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
