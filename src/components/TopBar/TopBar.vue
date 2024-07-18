<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useEtherStore } from "@/store/ether";
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { NetworkEnum } from "@/model/NetworkEnum";
import { connectProvider, requestNetworkChange } from "@/blockchain/provider";
import ethereumImage from "@/assets/ethereum.svg";
import polygonImage from "@/assets/polygon.svg";
import rootstockImage from "@/assets/rootstock.svg";

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

const getNetworkImage = (networkName: NetworkEnum): string => {
  let validImages = {
    Ethereum: ethereumImage,
    Polygon: polygonImage,
    Rootstock: rootstockImage,
    Localhost: ethereumImage,
  };

  return validImages[networkName];
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
        <div
          v-show="infoMenuOpenToggle"
          class="mt-10 absolute w-full text-gray-900 lg-view"
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
                <div class="redirect_button flex mr-4">
                  <div class="mr-6">
                    <img
                      alt="Twitter"
                      width="20"
                      height="20"
                      src="@/assets/twitterIcon.svg"
                      class="cursor-pointer"
                      onclick="location.href = 'https://www.twitter.com/doiim';"
                    />
                  </div>
                  <div class="mr-6">
                    <img
                      alt="Discord"
                      width="20"
                      height="20"
                      src="@/assets/discordIcon.svg"
                      class="cursor-pointer"
                    />
                  </div>
                  <img
                    alt="Github"
                    width="20"
                    height="20"
                    src="@/assets/githubIcon.svg"
                    class="cursor-pointer"
                    onclick="location.href = 'https://github.com/doiim';"
                  />
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
        class="default-button sm-view"
      >
        FAQ
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        class="default-button sm:whitespace-normal whitespace-nowrap lg-view"
      >
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </RouterLink>
      <RouterLink
        :to="sellerView ? '/' : '/seller'"
        v-if="!walletAddress"
        class="default-button sm:whitespace-normal whitespace-nowrap sm-view"
      >
        {{ sellerView ? "Quero comprar" : "Quero vender" }}
      </RouterLink>
      <div class="flex flex-col" v-if="walletAddress">
        <div
          ref="currencyRef"
          class="group top-bar-info cursor-pointer hover:bg-white h-10"
          @click="
            [
              (currencyMenuOpenToggle = !currencyMenuOpenToggle),
              (menuOpenToggle = false),
              (infoMenuOpenToggle = false),
            ]
          "
          @mouseover="currencyMenuHoverToggle = true"
          @mouseout="currencyMenuHoverToggle = false"
          :style="{
            backgroundColor: currencyMenuOpenToggle
              ? '#F9F9F9'
              : currencyMenuHoverToggle
              ? '#F9F9F9'
              : 'transparent',
          }"
        >
          <img
            alt="Choosed network image"
            :src="getNetworkImage(etherStore.networkName)"
            height="24"
            width="24"
          />
          <span
            class="default-text group-hover:text-gray-900 lg-view"
            :style="{
              color: currencyMenuOpenToggle
                ? '#000000'
                : currencyMenuHoverToggle
                ? '#000000'
                : 'rgb(249 250 251)',
            }"
          >
            {{ etherStore.networkName }}
          </span>
          <img
            class="text-gray-900"
            v-if="!currencyMenuHoverToggle && !currencyMenuOpenToggle"
            alt="Chevron Down"
            src="@/assets/chevronDown.svg"
          />
          <img
            v-if="currencyMenuOpenToggle"
            alt="Chevron Up"
            src="@/assets/chevronUp.svg"
          />
          <img
            v-if="currencyMenuHoverToggle && !currencyMenuOpenToggle"
            alt="Chevron Down Black"
            src="@/assets/chevronDownBlack.svg"
          />
        </div>
        <div
          v-show="currencyMenuOpenToggle"
          class="mt-10 pl-3 absolute w-full text-gray-900 lg-view"
        >
          <div class="mt-2">
            <div class="bg-white rounded-md z-10">
              <div
                class="menu-button gap-2 px-4 rounded-md cursor-pointer"
                @click="networkChange(NetworkEnum.rootstock)"
              >
                <img
                  alt="Rootstock image"
                  width="20"
                  height="20"
                  src="@/assets/rootstock.svg"
                />
                <span class="text-gray-900 py-4 text-end font-semibold text-sm">
                  Rootstock
                </span>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
              <div
                class="menu-button gap-2 px-4 rounded-md cursor-pointer"
                @click="networkChange(NetworkEnum.ethereum)"
              >
                <img
                  alt="Ethereum image"
                  width="20"
                  height="20"
                  src="@/assets/ethereum.svg"
                />
                <span class="text-gray-900 py-4 text-end font-semibold text-sm">
                  Ethereum
                </span>
              </div>
              <div class="w-full flex justify-center">
                <hr class="w-4/5" />
              </div>
              <div
                class="menu-button gap-2 px-4 rounded-md cursor-pointer"
                @click="networkChange(NetworkEnum.polygon)"
              >
                <img
                  alt="Polygon image"
                  width="20"
                  height="20"
                  src="@/assets/polygon.svg"
                />
                <span class="text-gray-900 py-4 text-end font-semibold text-sm">
                  Polygon
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
            class="top-bar-info cursor-pointer h-10"
            @click="
              [
                (menuOpenToggle = !menuOpenToggle),
                (currencyMenuOpenToggle = false),
                (infoMenuOpenToggle = false),
              ]
            "
            @mouseover="menuHoverToggle = true"
            @mouseout="menuHoverToggle = false"
            :style="{
              backgroundColor: menuOpenToggle
                ? '#F9F9F9'
                : menuHoverToggle
                ? '#F9F9F9'
                : 'transparent',
            }"
          >
            <img alt="Account image" src="@/assets/account.svg" />
            <span
              class="default-text"
              :style="{
                color: menuOpenToggle
                  ? '#000000'
                  : menuHoverToggle
                  ? '#000000'
                  : 'rgb(249 250 251)',
              }"
            >
              {{ formatWalletAddress() }}
            </span>
            <img
              class="text-gray-900"
              v-if="!menuHoverToggle && !menuOpenToggle"
              alt="Chevron Down"
              src="@/assets/chevronDown.svg"
            />
            <img
              v-if="menuOpenToggle"
              alt="Chevron Up"
              src="@/assets/chevronUp.svg"
            />
            <img
              v-if="menuHoverToggle && !menuOpenToggle"
              alt="Chevron Down Black"
              src="@/assets/chevronDownBlack.svg"
            />
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
              <img
                alt="Twitter"
                width="20"
                height="20"
                src="@/assets/twitterIcon.svg"
                class="mr-6"
                onclick="location.href = 'https://www.twitter.com/doiim';"
              />
              <img
                alt="Discord"
                width="20"
                height="20"
                src="@/assets/discordIcon.svg"
                class="mr-6"
              />
              <img
                alt="Github"
                width="20"
                height="20"
                src="@/assets/githubIcon.svg"
                onclick="location.href = 'https://github.com/doiim';"
              />
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
            class="menu-button gap-2 sm:px-4 rounded-md cursor-pointer py-2"
            @click="networkChange(NetworkEnum.rootstock)"
          >
            <img
              alt="Rootstock image"
              width="20"
              height="20"
              src="@/assets/rootstock.svg"
            />
            <span class="text-gray-900 py-4 text-end font-bold text-sm">
              Rootstock
            </span>
          </div>
          <div class="w-full flex justify-center pb-12">
            <hr class="w-4/5" />
          </div>
          <div
            class="menu-button gap-2 sm:px-4 rounded-md cursor-pointer py-2"
            @click="networkChange(NetworkEnum.ethereum)"
          >
            <img
              alt="Ethereum image"
              width="20"
              height="20"
              src="@/assets/ethereum.svg"
            />
            <span class="text-gray-900 py-4 text-end font-bold text-sm">
              Ethereum
            </span>
          </div>
          <div class="w-full flex justify-center">
            <hr class="w-4/5" />
          </div>
          <div
            class="menu-button gap-2 sm:px-4 rounded-md cursor-pointer py-2"
            @click="networkChange(NetworkEnum.polygon)"
          >
            <img
              alt="Polygon image"
              width="20"
              height="20"
              src="@/assets/polygon.svg"
            />
            <span class="text-gray-900 py-4 text-end font-bold text-sm">
              Polygon
            </span>
          </div>
          <div class="w-full flex justify-center pb-12">
            <hr class="w-4/5" />
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
