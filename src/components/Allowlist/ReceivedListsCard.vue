<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Hex } from 'viem';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import { useCopyAddress } from '@/composables/account/useAccountRouter';
import { readAllowlistRoot } from '@/blockchain/allowlist';
import { isOnAllowlist, sameAddress, shortHex } from '@/utils/allowlist';
import {
  addressesOf,
  parseAllowlistFile,
  pickAllowlistFile,
  readReceivedAllowlists,
  writeReceivedAllowlists,
  type ReceivedAllowlist,
} from '@/utils/allowlistStorage';
import CopyIcon from '@/assets/copyPix.svg';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const user = useUser();
const walletAddress = useWalletAddress();
const copyAddress = useCopyAddress(walletAddress);

const lists = ref<ReceivedAllowlist[]>(readReceivedAllowlists());
// Not in the design: collapsed until asked for, or when a list is already here.
const open = ref(lists.value.length > 0);
watch(lists, (next) => {
  if (next.length) open.value = true;
});
/** On-chain root per seller, keyed by lowercase address. */
const roots = ref<Record<string, Hex | null>>({});

const keyOf = (list: ReceivedAllowlist) => list.seller.toLowerCase();

const loadRoots = async () => {
  const chainId = user.network.value.id;
  const sellers = lists.value.filter((list) => list.chainId === chainId);
  const entries = await Promise.all(
    sellers.map(async (list) => [
      keyOf(list),
      await readAllowlistRoot(list.seller).catch(() => null),
    ]),
  );
  roots.value = Object.fromEntries(entries);
};

watch([() => user.network.value.id, lists], () => void loadRoots(), {
  immediate: true,
});

const includesMe = (list: ReceivedAllowlist): boolean =>
  !!walletAddress.value &&
  isOnAllowlist(addressesOf(list.entries), walletAddress.value);

const networkStatus = (list: ReceivedAllowlist) => {
  if (list.chainId !== user.network.value.id) return 'Outra rede';
  const root = roots.value[keyOf(list)];
  if (root === undefined) return 'Lendo a rede…';
  if (root === null) return 'Não foi possível ler a rede';
  return root === list.root ? 'Ativa na rede' : 'Não é a lista atual';
};

const persist = (next: ReceivedAllowlist[]) => {
  lists.value = next;
  writeReceivedAllowlists(next);
};

const importFile = async () => {
  const picked = await pickAllowlistFile();
  if (!picked) return;
  const file = parseAllowlistFile(await picked.text());
  if (!file) {
    user.showToast(
      'error',
      'Arquivo inválido. Peça ao vendedor o .json da lista.',
    );
    return;
  }
  const others = lists.value.filter(
    (list) =>
      list.chainId !== file.chainId || !sameAddress(list.seller, file.seller),
  );
  persist([
    ...others,
    { ...file, fileName: picked.name, importedAt: Date.now() },
  ]);
  user.showToast('success', 'Lista importada');
};

const remove = (target: ReceivedAllowlist) =>
  persist(lists.value.filter((list) => list !== target));
</script>

<template>
  <section class="flex w-full flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-white">
          Listas que você recebeu
        </h2>
        <p class="text-sm text-gray-300">
          Para comprar acima do limite de quem já confia em você.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" class="ghost-button" @click="importFile">
          Importar arquivo do vendedor
        </button>
        <button
          type="button"
          class="text-sm font-semibold text-white underline cursor-pointer"
          :aria-expanded="open"
          @click="open = !open"
        >
          {{ open ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>
    </div>
    <template v-if="open">
      <div class="flex flex-col gap-3 rounded-lg bg-white p-6 text-gray-900">
        <p class="text-gray-600">
          Mande este endereço ao vendedor. Depois que ele gravar a lista,
          importe o arquivo que ele enviar: nas ofertas dele, o limite de
          reputação deixa de valer para você.
        </p>
        <div class="flex items-center gap-2 rounded-lg bg-gray-100 p-3">
          <span class="flex-1 break-all font-mono text-sm">
            {{ walletAddress }}
          </span>
          <button
            type="button"
            class="rounded-md p-1 hover:bg-gray-200 cursor-pointer"
            aria-label="Copiar endereço"
            @click="copyAddress"
          >
            <CopyIcon class="h-4 w-auto [&_path]:stroke-current" />
          </button>
        </div>

        <ul v-if="lists.length" class="divide-y divide-gray-200">
          <li
            v-for="list in lists"
            :key="`${list.chainId}-${list.seller}`"
            class="flex flex-wrap items-center gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="font-semibold">
                Vendedor
                <span class="font-mono">{{ shortHex(list.seller) }}</span>
              </p>
              <p class="truncate text-sm text-gray-500">
                {{ list.fileName }} · {{ networkStatus(list) }}
              </p>
            </div>
            <StatusBadge
              :status="includesMe(list) ? 'completed' : 'pending'"
              :custom-text="includesMe(list) ? 'Você está' : 'Você não está'"
            />
            <button
              type="button"
              class="min-h-11 px-2 text-sm font-semibold text-red-700 hover:opacity-70 cursor-pointer"
              @click="remove(list)"
            >
              Remover
            </button>
          </li>
        </ul>
        <p v-else class="py-2 text-center text-sm text-gray-400">
          Nenhuma lista importada
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.ghost-button {
  @apply rounded-lg border border-gray-400 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 cursor-pointer;
}
</style>
