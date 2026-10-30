<script setup lang="ts">
import { computed } from 'vue';
import { useUser } from '@/composables/useUser';
import type { TrustedBuyers } from '@/composables/useTrustedBuyers';
import {
  pickAllowlistFile,
  type AllowlistEntry,
} from '@/utils/allowlistStorage';
import { shortHex } from '@/utils/allowlist';
import AllowlistDropZone from './AllowlistDropZone.vue';
import BuyerCard, { type BuyerStatus } from './BuyerCard.vue';
import InvalidIcon from '@/assets/invalidIcon.svg';

const props = defineProps<{ list: TrustedBuyers }>();
const user = useUser();

type Card = { entry: AllowlistEntry; status: BuyerStatus };

const cards = computed((): Card[] => {
  const list = props.list;
  const savedStatus = list.savedOnChain.value ? 'onchain' : 'offchain';
  const savedCard = (entry: AllowlistEntry): Card => ({
    entry,
    status: list.isRemoved(entry.address) ? 'leaving' : savedStatus,
  });
  return [
    ...list.saved.value.map(savedCard),
    ...list.added.value.map((entry): Card => ({ entry, status: 'new' })),
  ];
});

const importFile = async (file: File) => {
  const error = props.list.importFile(await file.text(), file.name);
  if (error) user.showToast('error', error);
};

const chooseFile = async () => {
  const file = await pickAllowlistFile();
  if (file) await importFile(file);
};
</script>

<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-white">Lista neste navegador</h2>
      <div v-if="!list.isForeign.value" class="flex gap-2">
        <button type="button" class="ghost-button" @click="chooseFile">
          Importar arquivo
        </button>
        <button
          v-if="cards.length"
          type="button"
          class="ghost-button"
          @click="list.download"
        >
          Baixar lista (.json)
        </button>
      </div>
    </div>

    <div
      v-if="list.isForeign.value"
      class="flex flex-col gap-5 rounded-lg bg-white p-6 text-gray-900"
    >
      <p>
        O contrato guarda só a raiz, não os endereços. Para ver ou editar a
        lista, traga o arquivo que você baixou quando gravou.
      </p>
      <AllowlistDropZone @file="importFile" />

      <div v-if="list.mismatch.value" class="flex flex-col gap-3">
        <div class="flex items-start gap-3">
          <InvalidIcon class="mt-1 shrink-0 [&_path]:fill-red-600" />
          <div>
            <p class="font-semibold">O arquivo não é da lista atual</p>
            <p class="text-sm text-gray-600">
              Cada lista tem uma raiz, um resumo de 32 bytes. Para abrir os
              endereços aqui, a raiz do arquivo precisa ser igual à da rede.
            </p>
          </div>
        </div>
        <div
          class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
        >
          <div class="root-box flex-1">
            <p class="text-sm text-gray-600">Raiz na rede</p>
            <p class="font-mono text-lg font-bold">
              {{ shortHex(list.onChainRoot.value ?? '') }}
            </p>
            <p class="text-sm text-gray-600">
              Lista ativa · {{ user.network.value.name }}
            </p>
          </div>
          <span class="not-equal" aria-label="diferente de">≠</span>
          <div class="root-box flex-1 border-red-200! bg-red-50!">
            <p class="text-sm text-gray-600">Raiz do arquivo</p>
            <p class="font-mono text-lg font-bold text-red-700">
              {{ shortHex(list.mismatch.value.root) }}
            </p>
            <p class="truncate text-sm text-gray-600">
              {{ list.mismatch.value.fileName }} ·
              {{ list.mismatch.value.count }}
              {{ list.mismatch.value.count === 1 ? 'endereço' : 'endereços' }}
            </p>
          </div>
        </div>
      </div>

      <p>
        Não tem o arquivo?
        <button
          type="button"
          class="ml-2 font-semibold underline cursor-pointer"
          @click="list.startFresh"
        >
          Começar lista nova
        </button>
      </p>
      <p class="text-sm text-gray-500">
        Uma lista nova substitui a atual quando você gravar, e os arquivos já
        enviados deixam de valer.
      </p>
    </div>

    <template v-else>
      <div
        v-if="list.justSaved.value && list.savedOnChain.value"
        class="rounded-lg bg-white p-6 text-gray-900"
      >
        <p class="text-lg font-semibold">
          Envie o arquivo novo aos compradores
        </p>
        <p class="text-gray-600">
          Os arquivos antigos deixaram de valer quando a raiz mudou. Baixe a
          lista (.json) e mande por onde vocês já conversam. O arquivo leva os
          endereços e os apelidos.
        </p>
      </div>

      <div v-if="!cards.length && list.isActive.value" class="empty">
        <p class="text-lg font-semibold">Nenhum endereço neste navegador</p>
        <p>
          Adicione o endereço de quem você conhece ou importe o arquivo que você
          baixou quando gravou.
        </p>
      </div>

      <div v-else-if="!cards.length" class="empty">
        <p class="text-lg font-semibold">Nenhum endereço ainda</p>
        <ol class="list-decimal space-y-2 pl-6">
          <li>Adicione o endereço de quem você conhece.</li>
          <li>
            Grave a lista na rede. O contrato guarda só a raiz, não os
            endereços.
          </li>
          <li>
            Baixe a lista e envie aos compradores. Com o arquivo, eles compram
            das suas ofertas sem o limite de reputação.
          </li>
        </ol>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2">
        <BuyerCard
          v-for="card in cards"
          :key="card.entry.address"
          :entry="card.entry"
          :status="card.status"
          @remove="list.remove(card.entry.address)"
          @undo="list.undo(card.entry.address)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.ghost-button {
  @apply rounded-lg border border-gray-400 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 cursor-pointer;
}

.empty {
  @apply flex flex-col gap-3 rounded-lg border border-dashed border-gray-400 p-6 text-white;
}

.root-box {
  @apply rounded-lg border border-gray-200 p-4;
}

.not-equal {
  @apply flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full bg-red-50 text-xl font-bold text-red-600;
}
</style>
