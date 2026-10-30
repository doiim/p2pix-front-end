<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChainContract } from 'viem';
import { useClipboard } from '@vueuse/core';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import type { TrustedBuyers } from '@/composables/useTrustedBuyers';
import { shortHex } from '@/utils/allowlist';
import ChevronDown from '@/assets/chevronDown.svg';
import ValidIcon from '@/assets/validIcon.svg';
import InfoIcon from '@/assets/info.svg';

const props = defineProps<{ list: TrustedBuyers }>();
defineEmits<{ deactivate: [] }>();

const user = useUser();
const walletAddress = useWalletAddress();
const open = ref<'how' | 'check' | null>(null);
const toggle = (panel: 'how' | 'check') =>
  (open.value = open.value === panel ? null : panel);

const contract = computed(
  () => (user.network.value.contracts?.p2pix as ChainContract).address,
);
const explorer = computed(() => user.network.value.blockExplorers?.default.url);
const castCommand = computed(
  () =>
    `cast call ${contract.value} "sellerAllowList(address)(bytes32)" ${walletAddress.value} --rpc-url <SEU_RPC_ARBITRUM>`,
);
const { copy, copied, isSupported } = useClipboard({ legacy: true });

const comparison = computed(() => {
  const list = props.list;
  if (list.onChainRoot.value === null) return null;
  if (!list.isActive.value) {
    return 'A raiz na rede é zero: não há lista ativa. A raiz calculada é a da lista deste navegador.';
  }
  return list.savedOnChain.value
    ? 'As duas raízes são iguais: a lista deste navegador é a que está na rede.'
    : 'As raízes são diferentes: a lista deste navegador não é a que está na rede.';
});

/** Root of the list in this browser, or of the edits when there are any. */
const localRoot = computed(() =>
  props.list.hasPending.value
    ? props.list.draftRoot.value
    : props.list.savedRoot.value,
);
</script>

<template>
  <div class="flex w-full flex-col items-center gap-4">
    <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
      <span
        v-if="list.isActive.value && list.onChainRoot.value"
        class="root-pill"
      >
        <ValidIcon v-if="list.savedOnChain.value" class="shrink-0" />
        <InfoIcon v-else class="shrink-0 [&_path]:fill-gray-300" />
        <span class="font-semibold">Raiz</span>
        <span class="font-mono font-semibold">
          {{ shortHex(list.onChainRoot.value) }}
        </span>
      </span>
      <button
        type="button"
        class="toggle"
        :aria-expanded="open === 'how'"
        @click="toggle('how')"
      >
        <span class="font-semibold">Como funciona</span>
        <ChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'scale-y-[-1]': open === 'how' }"
        />
      </button>
      <button
        type="button"
        class="toggle"
        :aria-expanded="open === 'check'"
        @click="toggle('check')"
      >
        <span class="font-semibold">Verificação</span>
        <ChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'scale-y-[-1]': open === 'check' }"
        />
      </button>
      <button
        v-if="list.isActive.value"
        type="button"
        class="toggle"
        :disabled="list.busy.value"
        @click="$emit('deactivate')"
      >
        <span class="font-semibold">Desativar lista</span>
      </button>
    </div>

    <div v-if="open === 'how'" class="panel space-y-3">
      <p>
        Quem está na lista reserva das suas ofertas sem o limite de reputação.
        Os demais continuam comprando dentro do próprio limite: ninguém é
        bloqueado.
      </p>
      <p>
        A lista vale para todas as suas ofertas nesta rede. Em outra rede, grave
        outra lista.
      </p>
      <p>
        O contrato guarda só a raiz, um resumo de 32 bytes. Os endereços e
        apelidos ficam neste navegador e no arquivo que você baixa.
      </p>
      <p>
        Você envia o arquivo (.json) aos compradores. Ele traz a prova de cada
        um, só funciona na carteira de quem está na lista e deixa de valer
        sempre que você grava uma lista nova.
      </p>
      <p>
        A lista não é secreta: quem recebe o arquivo vê todos os endereços e
        apelidos, e a compra feita pela lista mostra na rede o endereço do
        comprador e pode mostrar outro endereço da lista.
      </p>
      <p>
        Você também pode chamar <span class="font-mono">setRoot()</span> direto
        no contrato, sem este app.
      </p>
    </div>

    <div v-if="open === 'check'" class="panel">
      <dl class="grid gap-3 sm:grid-cols-2">
        <div>
          <dt class="label">Rede</dt>
          <dd class="font-semibold">{{ user.network.value.name }}</dd>
        </div>
        <div>
          <dt class="label">Contrato</dt>
          <dd class="font-mono">
            <a
              v-if="explorer"
              :href="`${explorer}/address/${contract}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gray-900! underline"
            >
              P2Pix {{ shortHex(contract) }}
            </a>
            <template v-else>P2Pix {{ shortHex(contract) }}</template>
          </dd>
        </div>
        <div>
          <dt class="label">Leitura</dt>
          <dd class="font-mono">
            sellerAllowList({{ shortHex(walletAddress ?? '') }})
          </dd>
        </div>
        <div>
          <dt class="label">Na rede</dt>
          <dd class="font-mono break-all">
            {{
              list.onChainRoot.value ??
              (list.readFailed.value ? 'não foi possível ler' : 'lendo…')
            }}
          </dd>
        </div>
        <div>
          <dt class="label">Calculada</dt>
          <dd class="font-mono break-all">{{ localRoot }}</dd>
        </div>
        <div>
          <dt class="label">Folha</dt>
          <dd>bytes32(uint160(endereço)), sem hash</dd>
        </div>
        <div>
          <dt class="label">Árvore</dt>
          <dd>keccak256, pares ordenados</dd>
        </div>
      </dl>
      <p v-if="comparison" class="mt-3 text-gray-600">{{ comparison }}</p>
      <button
        v-if="isSupported"
        type="button"
        class="mt-3 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-100 cursor-pointer"
        @click="copy(castCommand)"
      >
        {{ copied ? 'Comando copiado' : 'Copiar comando' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.root-pill {
  @apply flex items-center gap-2 rounded-full border border-gray-400 px-4 py-2 text-white;
}

.toggle {
  @apply flex items-center gap-2 text-white cursor-pointer hover:opacity-80 disabled:opacity-50;
}

.panel {
  @apply w-full max-w-3xl rounded-lg bg-white p-5 text-sm text-gray-900;
}

.label {
  @apply text-xs font-medium text-gray-500;
}
</style>
