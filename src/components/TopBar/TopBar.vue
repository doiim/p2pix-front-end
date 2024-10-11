<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useEtherStore } from "@/store/ether";
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { NetworkEnum } from "@/model/NetworkEnum";
import { connectProvider, requestNetworkChange } from "@/blockchain/provider";
import { getNetworkImage } from "@/utils/imagesPath";
import { Networks } from "@/model/Networks";
// Store reference
const etherStore = useEtherStore();

const { walletAddress, sellerView } = storeToRefs(etherStore);

const menuOpenToggle = ref<boolean>(false);
const menuHoverToggle = ref<boolean>(false);

const infoMenuOpenToggle = ref<boolean>(false);
const currencyMenuOpenToggle = ref<boolean>(false);
const currencyMenuHoverToggle = ref<boolean>(false);
const infoMenuRef = ref<any>(null);
const walletAddressRef = ref<any>(null);
const currencyRef = ref<any>(null);

//Methods
const connectMetaMask = async (): Promise<void> => {
  await connectProvider();
};

const formatWalletAddress = (): string => {
  const walletAddressLength = walletAddress.value.length;
  const initialText = walletAddress.value.substring(0, 5);
  const finalText = walletAddress.value.substring(
    walletAddressLength - 4,
    walletAddressLength
  );
  return `${initialText}...${finalText}`;
};

const disconnectUser = (): void => {
  etherStore.setWalletAddress("");
  closeMenu();
  window.location.reload();
};

const closeMenu = (): void => {
  menuOpenToggle.value = false;
};

const networkChange = async (network: NetworkEnum): Promise<void> => {
  currencyMenuOpenToggle.value = false;
  const change = await requestNetworkChange(network);
  if (change) etherStore.setNetworkName(network);
};

onClickOutside(walletAddressRef, () => {
  menuHoverToggle.value = false;
  menuOpenToggle.value = false;
});

onClickOutside(currencyRef, () => {
  currencyMenuOpenToggle.value = false;
  currencyMenuHoverToggle.value = false;
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
        class="logo lg-view"
        src="@/assets/logo.svg"
        width="75"
        height="75"
      />
      <img
        alt="P2Pix logo"
        class="logo sm-view w-10/12"
        src="@/assets/logo2.svg"
        width="40"
        height="40"
      />
    </RouterLink>

    <div class="flex sm:gap-4 gap-2 items-center">
      <div class="flex flex-col">
        <button
          ref="infoMenuRef"
          class="default-button lg-view cursor-pointer"
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
        <div
          v-show="infoMenuOpenToggle"
          class="mt-10 absolute w-full text-gray-900 lg-view"
        >
          <div class="mt-2">
            <div class="bg-white rounded-md z-10 -left-36 w-52">
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
                <div class="redirect_button flex mr-4">
                  <div class="mr-6">
                    <a href="https://www.twitter.com/doiim">
                      <img
                        alt="Twitter"
                        width="20"
                        height="20"
                        src="@/assets/twitterIcon.svg"
                        class="cursor-pointer"
                      />
                    </a>
                  </div>
                  <div class="mr-6">
                    <a href="https://www.linkedin.com/company/doiim/">
                      <img
                        alt="LinkedIn"
                        width="20"
                        height="20"
                        src="@/assets/linkedinIcon.svg"
                        class="cursor-pointer"
                        href="https://www.linkedin.com/company/doiim/"
                      />
                    </a>
                  </div>
                  <div class="mr-6">
                    <a href="https://www.github.com/doiim">
                      <img
                        alt="Github"
                        width="20"
                        height="20"
                        src="@/assets/githubIcon.svg"
                        class="cursor-pointer"
                      />
                    </a>
                  </div>
                </div>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <RouterLink
        :to="'/faq'"
        v-if="!walletAddress"
        class="default-button sm-view"
      >
        FAQ
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        class="default-button sm:whitespace-normal whitespace-nowrap lg-view w-40 sm:w-44 md:w-36"
      >
      <div class="topbar-text topbar-link text-center mx-auto inline-block">
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </div>
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        v-if="!walletAddress"
        class="default-button sm:whitespace-normal whitespace-nowrap sm-view w-40 sm:w-44 md:w-36"
      >
      <div class="topbar-text topbar-link text-center mx-auto inline-block">
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </div>
       
      </RouterLink>
      <div class="flex flex-col relative" v-if="walletAddress">
        <div
          ref="currencyRef"
          class="top-bar-info cursor-pointer h-10 group hover:bg-gray-50 transition-all duration-500 ease-in-out"
          :class="{'bg-gray-50': currencyMenuOpenToggle}"
          @mouseover="currencyMenuHoverToggle = true"
          @mouseout="currencyMenuHoverToggle = false"
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
          <span
            class="default-text text-gray-50 group-hover:text-gray-900 transition-all duration-500 ease-in-out"
            :class="{'!text-gray-900': currencyMenuOpenToggle}"
          >
            {{ Networks[etherStore.networkName].chainName }}
          </span>
          <div
            class="transition-all duration-500 ease-in-out mt-1"
            :class="{'scale-y-[-1]': currencyMenuOpenToggle}"
          >
            <svg viewBox="0 0 16 16" class="h-4 w-4 text-white group-hover:text-gray-900" :class="{'!text-gray-900': currencyMenuOpenToggle}">
              <use href="@/assets/chevron.svg#chevronDown"></use>
            </svg>
          </div>
        </div>
        <div
          v-show="currencyMenuOpenToggle"
          class="mt-10 absolute text-gray-900 lg-view min-w-max left-0"
        >
          <div class="mt-2 bg-white rounded-md shadow-lg ">
            <div
              v-for="(chainData, network) in Networks"
              class="menu-button p-4 gap-2 cursor-pointer hover:bg-gray-200 flex items-center !justify-start whitespace-nowrap transition-colors duration-150 ease-in-out"
              @click="networkChange(network)"
            >
              <img
                :alt="chainData.chainName + ' image'"
                width="20"
                height="20"
                :src="getNetworkImage(NetworkEnum[network])"
                class="mr-2 ml-1"
              />
              <span class="text-gray-900 font-semibold text-sm">
                {{ chainData.chainName }}
              </span>

            </div>
            <div class="w-full flex justify-center">
              <hr class="w-4/5" />
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        v-if="!walletAddress"
        class="border-amber-500 border-2 rounded default-button lg-view"
        @click="connectMetaMask()"
      >
        Conectar carteira
      </button>
      <button
        type="button"
        v-if="!walletAddress"
        class="border-amber-500 border-2 rounded default-button sm-view"
        @click="connectMetaMask()"
      >
        Conectar
      </button>
      <div v-if="walletAddress" class="account-info">
        <div class="flex flex-col">
          <div
            ref="walletAddressRef"
            class="top-bar-info cursor-pointer h-10 group hover:bg-gray-50 transition-all duration-500 ease-in-out"
            :class="{'bg-gray-50': menuOpenToggle}"
            @mouseover="menuHoverToggle = true"
            @mouseout="menuHoverToggle = false"
            @click="
              [
                (menuOpenToggle = !menuOpenToggle),
                (currencyMenuOpenToggle = false),
                (infoMenuOpenToggle = false),
              ]
            "
          >
            <img alt="Account image" src="@/assets/account.svg" />
            <span
              class="default-text text-gray-50 group-hover:text-gray-900 transition-all duration-500 ease-in-out"
              :class="{'!text-gray-900': menuOpenToggle}"
            >
              {{ formatWalletAddress() }}
            </span>
            <div
              class="transition-all duration-500 ease-in-out mt-1"
              :class="{'scale-y-[-1]': menuOpenToggle}"
            >
              <svg viewBox="0 0 16 16" class="h-4 w-4 text-white group-hover:text-gray-900" :class="{'!text-gray-900': menuOpenToggle}">
                <use href="@/assets/chevron.svg#chevronDown"></use>
              </svg>
            </div>
          </div>
          <div
            v-show="menuOpenToggle"
            class="mt-10 absolute w-full text-gray-900 lg-view"
          >
            <div class="pl-4 mt-2">
              <div class="bg-white rounded-md z-10">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-show="menuOpenToggle"
      class="mobile-menu fixed w-4/5 text-gray-900 sm-view"
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
          <div class="menu-button pb-10">
            <div class="redirect_button flex">
              <a href="https://www.twitter.com/doiim/">
                <img
                  alt="Twitter"
                  width="20"
                  height="20"
                  src="@/assets/twitterIcon.svg"
                  class="mr-6"
                  onclick="location.href = 'https://www.twitter.com/doiim';"
                />
              </a>
              <a href="https://www.linkedin.com/company/doiim/">
                <img
                  alt="LinkedIn"
                  width="20"
                  height="20"
                  src="@/assets/linkedinIcon.svg"
                  class="mr-6"
                />
              </a>
              <a href="https://github.com/doiim/">
                <img
                  alt="Github"
                  width="20"
                  height="20"
                  src="@/assets/githubIcon.svg"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-show="currencyMenuOpenToggle"
      class="mobile-menu fixed w-4/5 text-gray-900 sm-view"
    >
      <div class="pl-4 mt-2 h-full">
        <div class="bg-white rounded-md z-10 h-full">
          <div
            v-for="(chainData, network) in Networks"
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

.topbar-text {
  @apply text-gray-50 font-semibold sm:text-base mt-0.5 transition-all duration-500;
}
.topbar-link {
  @apply mt-0.5 hover:border-b-2 border-b-2 border-transparent hover:!border-white ;
}

.account-info {
  @apply flex items-center gap-6;
}

.default-text {
  @apply text-gray-50 font-semibold text-base;
}

.top-bar-info {
  @apply flex justify-between gap-2 px-4 py-2 border-amber-500 border-2 sm:rounded rounded-lg;
}

.redirect_button {
  @apply py-5 text-gray-900 sm:font-semibold font-bold sm:text-xs text-sm w-full;
}

.menu-button {
  @apply flex sm:text-center sm:justify-center hover:bg-gray-200 ml-8 sm:ml-0;
}

a:hover {
  @apply bg-gray-200 rounded;
}

.lg-view {
  display: inline-block;
}
.sm-view {
  display: none;
}

.mobile-menu {
  margin-top: 1400px;
  bottom: 0px;
  height: auto;
}

@media screen and (max-width: 500px) {
  .lg-view {
    display: none;
  }

  .sm-view {
    display: inline-block;
  }
}
</style>