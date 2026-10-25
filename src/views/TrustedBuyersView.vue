<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { zeroHash } from 'viem';
import { useUser } from '@/composables/useUser';
import { useTrustedBuyers } from '@/composables/useTrustedBuyers';
import { getCurrentAccount } from '@/blockchain/provider';
import { entryLabel } from '@/utils/allowlistStorage';
import AllowlistHeader from '@/components/Allowlist/AllowlistHeader.vue';
import AddBuyerCard from '@/components/Allowlist/AddBuyerCard.vue';
import BuyerListPanel from '@/components/Allowlist/BuyerListPanel.vue';
import ConfirmListCard, {
  type ConfirmRow,
} from '@/components/Allowlist/ConfirmListCard.vue';
import ReceivedListsCard from '@/components/Allowlist/ReceivedListsCard.vue';
import CloseIcon from '@/assets/closeAlertIcon.svg';
import router from '@/router/index';

const user = useUser();
const list = useTrustedBuyers();
const confirmDeactivate = ref(false);

onMounted(() => {
  // walletAddress is set a tick after mount on reload; the connector is not.
  if (!getCurrentAccount().address) router.push({ name: 'home' });
});
watch(user.walletAddress, (address) => {
  if (!address) router.push({ name: 'home' });
});

const FILES_GONE: ConfirmRow = {
  kind: 'info',
  text: 'Os arquivos já enviados deixam de valer',
};

const saveRows = computed<ConfirmRow[]>(() => [
  ...list.added.value.map((entry) => ({
    kind: 'in' as const,
    text: `${entryLabel(entry)} entra`,
  })),
  ...list.leaving.value.map((entry) => ({
    kind: 'out' as const,
    text: `${entryLabel(entry)} sai`,
  })),
  ...(list.isActive.value ? [FILES_GONE] : []),
]);

const returning = (count: number) => {
  if (count === 1) return '1 comprador volta ao limite de reputação';
  if (count) return `${count} compradores voltam ao limite de reputação`;
  return 'Quem está na lista volta ao limite de reputação';
};

const deactivateRows = computed<ConfirmRow[]>(() => [
  {
    kind: 'out',
    text: returning(list.savedOnChain.value ? list.saved.value.length : 0),
  },
  FILES_GONE,
  { kind: 'ok', text: 'Os endereços continuam neste navegador' },
]);

const deactivate = async () => {
  if (await list.deactivate()) confirmDeactivate.value = false;
};
</script>

<template>
  <div class="page">
    <div
      v-if="list.justSaved.value"
      class="flex w-full max-w-6xl items-center justify-between gap-4 rounded-lg bg-amber-400 px-6 py-3"
      role="status"
    >
      <p class="text-lg font-semibold text-gray-900">
        Tudo certo! Sua lista foi gravada na rede.
      </p>
      <button
        type="button"
        class="shrink-0 p-1 cursor-pointer"
        aria-label="Fechar aviso"
        @click="list.justSaved.value = false"
      >
        <CloseIcon />
      </button>
    </div>

    <div class="flex flex-col items-center gap-4 text-center text-white">
      <h1 class="font-extrabold sm:text-5xl text-3xl">
        Compradores confiáveis
      </h1>
      <p class="max-w-[36rem] font-medium sm:text-xl text-sm">
        Libere quem você conhece para comprar das suas ofertas acima do limite
        de reputação.
      </p>
    </div>

    <AllowlistHeader :list="list" @deactivate="confirmDeactivate = true" />

    <div
      v-if="list.readFailed.value"
      class="flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 text-gray-900"
      role="alert"
    >
      <p>Não foi possível ler a lista na rede.</p>
      <button
        type="button"
        class="rounded-lg border-2 border-amber-400 px-4 py-2 font-semibold hover:bg-amber-400/10 cursor-pointer"
        @click="list.reload"
      >
        Tentar de novo
      </button>
    </div>

    <div
      class="grid w-full max-w-6xl items-start gap-8"
      :class="{ 'lg:grid-cols-[minmax(0,26rem)_1fr]': !list.isForeign.value }"
    >
      <template v-if="!list.isForeign.value">
        <ConfirmListCard
          v-if="list.reviewing.value"
          :title="
            list.draft.value.length
              ? 'Gravar a nova lista'
              : 'Desativar a lista'
          "
          :rows="saveRows"
          :root="list.draftRoot.value"
          :busy="list.busy.value"
          @back="list.reviewing.value = false"
          @sign="list.save"
        />
        <AddBuyerCard
          v-else
          :list="list"
          @review="list.reviewing.value = true"
        />
      </template>
      <BuyerListPanel :list="list" />
    </div>

    <div class="w-full max-w-6xl">
      <ReceivedListsCard />
    </div>

    <div
      v-if="confirmDeactivate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="confirmDeactivate = false"
    >
      <div class="w-full max-w-xl">
        <ConfirmListCard
          title="Desativar a lista"
          :rows="deactivateRows"
          :root="zeroHash"
          :busy="list.busy.value"
          @back="confirmDeactivate = false"
          @sign="deactivate"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.page {
  @apply mt-16 mb-16 flex w-full flex-col items-center gap-8 px-4;
}
</style>
