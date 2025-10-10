<script setup lang="ts">
import { ref, computed } from "vue";
import { onClickOutside } from "@vueuse/core";
import CustomButton from "./CustomButton.vue";

const props = withDefaults(
  defineProps<{
    walletAddress: string | null;
    variant?: "primary" | "secondary" | "outline";
    showMenu?: boolean;
  }>(),
  {
    variant: "primary",
    showMenu: true,
  }
);

const emit = defineEmits<{
  connect: [];
  disconnect: [];
  viewTransactions: [];
}>();

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const isConnected = computed(() => {
  return !!props.walletAddress;
});

const formattedAddress = computed(() => {
  if (!props.walletAddress) return "";
  
  const address = props.walletAddress;
  const length = address.length;
  const start = address.substring(0, 5);
  const end = address.substring(length - 4, length);
  
  return `${start}...${end}`;
});

const handleConnect = () => {
  emit("connect");
};

const handleDisconnect = () => {
  menuOpen.value = false;
  emit("disconnect");
};

const handleViewTransactions = () => {
  menuOpen.value = false;
  emit("viewTransactions");
};

const toggleMenu = () => {
  if (isConnected.value && props.showMenu) {
    menuOpen.value = !menuOpen.value;
  }
};

onClickOutside(menuRef, () => {
  menuOpen.value = false;
});
</script>

<template>
  <div class="wallet-connect-container">
    <CustomButton
      v-if="!isConnected"
      text="Conectar carteira"
      :variant="variant"
      @button-clicked="handleConnect"
    />
    
    <div v-else ref="menuRef" class="wallet-connected">
      <button
        type="button"
        class="wallet-button"
        @click="toggleMenu"
      >
        <span class="wallet-address">{{ formattedAddress }}</span>
        <div class="wallet-indicator"></div>
      </button>
      
      <transition name="menu-fade">
        <div v-if="menuOpen && showMenu" class="wallet-menu">
          <button
            type="button"
            class="menu-item"
            @click="handleViewTransactions"
          >
            <span>Ver transações</span>
          </button>
          <button
            type="button"
            class="menu-item disconnect"
            @click="handleDisconnect"
          >
            <span>Desconectar</span>
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.wallet-connect-container {
  @apply relative inline-block;
}

.wallet-connected {
  @apply relative;
}

.wallet-button {
  @apply flex items-center gap-3 px-4 py-2 bg-white border-2 border-amber-400 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer;
}

.wallet-address {
  @apply text-gray-900 font-semibold text-sm;
}

.wallet-indicator {
  @apply w-2 h-2 bg-emerald-500 rounded-full;
}

.wallet-menu {
  @apply absolute top-full right-0 mt-2 bg-white rounded-lg border border-gray-300 shadow-lg z-50 min-w-[200px] overflow-hidden;
}

.menu-item {
  @apply w-full px-4 py-3 text-left text-gray-900 font-medium text-sm hover:bg-gray-100 transition-colors cursor-pointer border-none;
}

.menu-item.disconnect {
  @apply text-red-500 hover:bg-red-50;
}

/* Animação */
.menu-fade-enter-active,
.menu-fade-leave-active {
  @apply transition-all duration-200;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  @apply opacity-0 -translate-y-2;
}
</style>

