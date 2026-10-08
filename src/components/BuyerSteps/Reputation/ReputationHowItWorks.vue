<script setup lang="ts">
import { computed } from 'vue';
import type { Address } from 'viem';
import { formatTokens, shortWallet } from '@/utils/reputation';
import type { AccountKind } from '@/utils/reputation';

const props = defineProps<{
  limitTokens: bigint;
  nextLimitTokens: bigint | null;
  newWalletLimitTokens: bigint;
  offerBinds: boolean;
  accountKind: AccountKind;
  account: Address;
  networkName: string;
}>();

// Buying the full limit is impossible in one purchase when a smaller offer binds.
const nextTokens = computed(() =>
  props.offerBinds ? null : props.nextLimitTokens,
);

const accountLine = computed(() =>
  props.accountKind === 'smartAccount'
    ? `Limite da sua conta inteligente ${shortWallet(props.account)} em ${props.networkName}. Ela não herda a reputação de outras carteiras, e cada rede tem a sua.`
    : `Limite da carteira ${shortWallet(props.account)} em ${props.networkName}. Cada endereço e cada rede têm sua própria reputação.`,
);
</script>

<template>
  <div>
    <p v-if="nextTokens !== null" class="m-0 text-sm text-gray-600">
      Comprando
      <span class="whitespace-nowrap">R$ {{ formatTokens(limitTokens) }}</span>
      (o máximo) e concluindo a compra, seu limite passa para cerca de
      <strong class="font-semibold text-gray-900 whitespace-nowrap"
        >R$ {{ formatTokens(nextTokens) }}</strong
      >.
    </p>
    <ul
      class="mt-2 first:mt-0 pl-4 list-disc text-xs text-gray-600 [&>li+li]:mt-1.5"
    >
      <li class="text-gray-600">
        Cada compra acima de <span class="whitespace-nowrap">R$ 100</span> é
        conferida pelo contrato P2Pix contra o limite do seu endereço nesta
        rede.
      </li>
      <li class="text-gray-600">
        Toda carteira começa com
        <span class="whitespace-nowrap"
          >R$ {{ formatTokens(newWalletLimitTokens) }}</span
        >
        por compra. Cada compra concluída soma o valor ao seu crédito e aumenta
        o limite; o aumento desacelera em valores altos.
      </li>
      <li class="text-gray-600">
        Se uma reserva expira sem o Pix e é devolvida ao vendedor, seu crédito é
        dividido por dois; se o resultado ficar abaixo de
        <span class="whitespace-nowrap">R$ 100</span>, ele passa a ser
        <span class="whitespace-nowrap">R$ 100</span>.
      </li>
      <li class="text-gray-600">
        O teto é de <span class="whitespace-nowrap">R$ 1.000.000</span> por
        compra, para qualquer reputação. O limite vale por compra, não é um
        total diário.
      </li>
      <li class="text-gray-600">
        A reputação é pública: qualquer pessoa pode consultar o crédito de um
        endereço.
      </li>
      <li class="text-gray-600">
        O administrador do contrato P2Pix pode trocar o módulo de reputação; por
        isso este app lê o limite direto do contrato.
      </li>
      <li class="text-gray-600">
        Você também pode chamar
        <code class="font-mono text-xs text-gray-900">lock()</code> direto no
        contrato, sem este app; o limite é o mesmo.
      </li>
    </ul>
    <p class="mt-3 text-xs text-gray-600">{{ accountLine }}</p>
  </div>
</template>
