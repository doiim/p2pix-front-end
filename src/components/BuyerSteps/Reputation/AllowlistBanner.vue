<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Address, ChainContract, Hex } from 'viem';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import { findAllowlistProof, readAllowlistRoot } from '@/blockchain/allowlist';
import { shortHex } from '@/utils/allowlist';
import { shortAddress } from '@/utils/shortAddress';
import { formatTokens } from '@/utils/reputation';
import ChevronDown from '@/assets/chevronDown.svg';
import ValidIcon from '@/assets/validIcon.svg';

const props = defineProps<{
  seller: string;
  networkName: string;
  limitTokens: bigint | null;
}>();
defineEmits<{ ignore: [] }>();

const user = useUser();
const buyer = useWalletAddress();
const details = ref(false);
const tag = ref<'how' | 'check' | null>(null);
const toggle = (next: 'how' | 'check') =>
  (tag.value = tag.value === next ? null : next);

const contract = computed(
  () => (user.network.value.contracts?.p2pix as ChainContract).address,
);

// Read only when "Verificação" is opened: the list already passed the check in the search card.
const evidence = ref<{ root: Hex; proof: Hex[] } | null>(null);
watch(
  () => tag.value === 'check' && !evidence.value,
  async (needed) => {
    if (!needed || !buyer.value) return;
    const seller = props.seller as Address;
    const [root, proof] = await Promise.all([
      readAllowlistRoot(seller),
      findAllowlistProof(seller, buyer.value as Address),
    ]).catch(() => []);
    if (root && proof) evidence.value = { root, proof };
  },
);
</script>

<template>
  <div class="flex flex-col gap-2 pt-3">
    <div class="flex items-start gap-3">
      <ValidIcon class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="m-0 break-words text-sm font-semibold text-gray-900">
          Limite liberado por {{ shortAddress(seller, 6, '…') }}
        </p>
        <p class="m-0 text-sm text-gray-500">
          Nas ofertas dele em {{ networkName }},
          {{
            limitTokens === null
              ? 'o limite de reputação não vale.'
              : `seu limite de R$ ${formatTokens(limitTokens)} não vale.`
          }}
        </p>
      </div>
      <button
        type="button"
        class="flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gray-900 cursor-pointer"
        :aria-expanded="details"
        @click="details = !details"
      >
        Detalhes
        <ChevronDown
          class="h-3 w-3 transition-transform"
          :class="{ 'scale-y-[-1]': details }"
        />
      </button>
    </div>
    <div v-if="details" class="flex flex-col gap-3">
      <div class="flex gap-6">
        <button
          type="button"
          class="flex min-h-11 items-center gap-1 text-sm font-semibold text-gray-900 cursor-pointer"
          :aria-expanded="tag === 'how'"
          @click="toggle('how')"
        >
          Como funciona
          <ChevronDown
            class="h-3 w-3 transition-transform"
            :class="{ 'scale-y-[-1]': tag === 'how' }"
          />
        </button>
        <button
          type="button"
          class="flex min-h-11 items-center gap-1 text-sm font-semibold text-gray-900 cursor-pointer"
          :aria-expanded="tag === 'check'"
          @click="toggle('check')"
        >
          Verificação
          <ChevronDown
            class="h-3 w-3 transition-transform"
            :class="{ 'scale-y-[-1]': tag === 'check' }"
          />
        </button>
      </div>

      <div
        v-if="tag === 'how'"
        class="m-0 flex flex-col gap-2 rounded-lg bg-gray-100 p-3 text-sm text-gray-900 sm:p-4"
      >
        <p class="m-0">
          O vendedor colocou seu endereço na lista dele. O arquivo traz a prova,
          e o contrato confere a prova na hora da reserva.
        </p>
        <p class="m-0">
          Vale só nas ofertas deste vendedor, em {{ networkName }}, e só na
          carteira da lista.
        </p>
        <p class="m-0">
          Se o vendedor gravar uma lista nova, este arquivo deixa de valer: peça
          o novo.
        </p>
        <p class="m-0">A prova vai na sua reserva e fica pública.</p>
        <p class="m-0">
          Você também pode chamar <span class="font-mono">lock()</span> direto
          no contrato com a mesma prova, sem este app.
        </p>
      </div>

      <dl
        v-if="tag === 'check'"
        class="m-0 flex flex-col gap-2 rounded-lg bg-gray-100 p-3 text-sm sm:p-4"
      >
        <div>
          <dt class="text-gray-500">Rede</dt>
          <dd class="m-0 text-gray-900">{{ networkName }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Contrato</dt>
          <dd class="m-0 font-mono text-gray-900">
            P2Pix {{ shortHex(contract) }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500">Leitura</dt>
          <dd class="m-0 font-mono text-gray-900">
            sellerAllowList({{ shortHex(seller) }})
          </dd>
        </div>
        <div>
          <dt class="text-gray-500">Raiz</dt>
          <dd class="m-0 font-mono text-gray-900">
            {{ evidence ? shortHex(evidence.root) : 'lendo…' }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500">Folha</dt>
          <dd class="m-0 text-gray-900">
            <span class="font-mono">{{ shortHex(buyer ?? '') }}</span> (você),
            sem hash
          </dd>
        </div>
        <div>
          <dt class="text-gray-500">Prova</dt>
          <dd v-if="evidence" class="m-0 text-gray-900">
            <ol class="m-0 list-decimal pl-5 font-mono">
              <li v-for="item in evidence.proof" :key="item">
                {{ shortHex(item) }}
              </li>
            </ol>
          </dd>
          <dd v-else class="m-0 text-gray-900">lendo…</dd>
        </div>
        <div v-if="evidence">
          <dt class="text-gray-500">Resultado</dt>
          <dd class="m-0 flex items-center gap-1 text-gray-900">
            <ValidIcon class="h-4 w-4" aria-hidden="true" /> confere com a raiz
          </dd>
        </div>
        <p class="m-0 text-gray-600">
          A prova vai na sua reserva e fica pública. O item 1 é o endereço de
          outro comprador da lista.
        </p>
      </dl>
    </div>
    <button
      type="button"
      class="min-h-11 self-start text-sm text-gray-900 underline cursor-pointer"
      @click="$emit('ignore')"
    >
      Comprar sem a lista
    </button>
  </div>
</template>
