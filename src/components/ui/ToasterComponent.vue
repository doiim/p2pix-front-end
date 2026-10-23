<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useConnection, useSwitchChain } from '@wagmi/vue';
import { useUser } from '@/composables/useUser';

const user = useUser();
const { network, toast } = user;
const connection = useConnection();
const switchChain = useSwitchChain();

const isWrongNetwork = ref(false);
const targetNetworkName = computed(() => network.value.name);

const checkNetwork = () => {
  const chainId = connection.chainId.value;
  isWrongNetwork.value =
    connection.isConnected.value &&
    chainId !== undefined &&
    chainId !== network.value.id;
};

const switchNetwork = async () => {
  try {
    await switchChain.mutateAsync({ chainId: network.value.id });
  } catch (error) {
    console.error('Failed to switch network:', error);
  }
};

onMounted(checkNetwork);
watch(connection.chainId, checkNetwork);
watch(connection.isConnected, checkNetwork);
watch(network, checkNetwork, { immediate: true });
</script>

<template>
  <transition name="slide-up" appear>
    <div
      v-if="isWrongNetwork"
      class="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-4 flex justify-between items-center z-50"
    >
      <div>
        <span class="font-bold">Rede incorreta!</span>
        <span> Troque para {{ targetNetworkName }}.</span>
      </div>
      <button
        @click="switchNetwork"
        class="bg-white text-red-500 px-4 py-2 rounded font-bold hover:bg-gray-100 transition-colors"
      >
        Trocar rede
      </button>
    </div>
  </transition>

  <p
    v-if="toast"
    :role="toast.type === 'error' ? 'alert' : 'status'"
    class="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
    :class="toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'"
  >
    {{ toast.message }}
  </p>
</template>

<style scoped>
@reference "tailwindcss";
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>
