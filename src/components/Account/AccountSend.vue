<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  formatUnits,
  getAddress,
  isAddress,
  isAddressEqual,
  parseUnits,
  zeroAddress,
  type Hex,
} from 'viem';
import { useUser } from '@/composables/useUser';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { TokenEnum } from '@/model/NetworkEnum';
import type { AccountBalance } from '@/model/AccountBalance';

const props = defineProps<{ balances: AccountBalance[] }>();
const emit = defineEmits<{ close: []; sent: [] }>();

const user = useUser();
const passkeyAccount = usePasskeyAccount();
const step = ref<'form' | 'sending' | 'done' | 'failed'>('form');
const asset = ref(
  props.balances.find((balance) => balance.token === TokenEnum.BRZ) ??
    props.balances[0],
);
const amountInput = ref('');
const recipient = ref('');
const txHash = ref<Hex>();
const copied = ref(false);

const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;
const format = (value: bigint | null) =>
  value === null
    ? ''
    : `${Number(formatUnits(value, asset.value.decimals)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${asset.value.symbol}`;

const maxDecimals = computed(() => Math.min(asset.value.decimals, 6));
const amount = computed(() => {
  const text = amountInput.value.trim().replace(',', '.');
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals.value}})?$`);
  return pattern.test(text) ? parseUnits(text, asset.value.decimals) : null;
});

const amountError = computed(() => {
  if (!amountInput.value) return '';
  if (!amount.value)
    return `Informe um valor com até ${maxDecimals.value} casas decimais`;
  if (amount.value > asset.value.amount)
    return `Saldo insuficiente: você tem ${format(asset.value.amount)}`;
  return '';
});
const recipientValid = computed(
  () =>
    isAddress(recipient.value) &&
    !isAddressEqual(recipient.value, zeroAddress) &&
    !isAddressEqual(recipient.value, user.walletAddress.value ?? zeroAddress),
);
const canConfirm = computed(
  () => !!amount.value && !amountError.value && recipientValid.value,
);

const useMax = () => {
  const [whole, fraction = ''] = formatUnits(
    asset.value.amount,
    asset.value.decimals,
  ).split('.');
  amountInput.value = fraction
    ? `${whole},${fraction.slice(0, maxDecimals.value)}`
    : whole;
};

const paste = async () => {
  recipient.value = (await navigator.clipboard.readText()).trim();
};

const confirm = async () => {
  if (!amount.value) return;
  step.value = 'sending';
  const result = await passkeyAccount.send({
    token: asset.value.token ?? undefined,
    amount: amount.value,
    to: getAddress(recipient.value),
  });
  // A failed send may still land, so the filled form is never offered again:
  // a retry could pay twice.
  if (!result) {
    console.error(passkeyAccount.error.value);
    step.value = 'failed';
    return;
  }
  txHash.value = result.txHash;
  step.value = 'done';
  emit('sent');
};

const copyHash = async () => {
  await navigator.clipboard.writeText(txHash.value ?? '');
  copied.value = true;
  setTimeout(() => (copied.value = false), 1800);
};
</script>

<template>
  <template v-if="step === 'form'">
    <div>
      <h2 class="text-xl font-bold text-gray-900">Enviar</h2>
      <p class="text-sm text-gray-600">Escolha o token, o valor e o destino.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="balance in balances"
        :key="balance.symbol"
        type="button"
        :aria-pressed="balance === asset"
        class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-gray-900"
        :class="balance === asset ? 'bg-gray-300' : 'bg-gray-100'"
        @click="asset = balance"
      >
        <img :src="balance.image" alt="" class="w-5 h-5" />
        {{ balance.symbol }}
      </button>
    </div>
    <div class="flex flex-col gap-1">
      <label for="send-amount" class="text-sm font-medium text-gray-600">
        Valor
      </label>
      <input
        id="send-amount"
        v-model="amountInput"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0"
        :aria-invalid="!!amountError"
        class="send-field"
      />
      <div class="flex justify-between gap-2 text-xs">
        <span :class="amountError ? 'text-red-700' : 'text-gray-500'">
          {{ amountError || `Disponível: ${format(asset.amount)}` }}
        </span>
        <button
          type="button"
          class="font-semibold text-gray-900"
          @click="useMax"
        >
          Usar máximo
        </button>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex justify-between">
        <label for="send-recipient" class="text-sm font-medium text-gray-600">
          Endereço de destino
        </label>
        <button
          type="button"
          class="text-xs font-semibold text-gray-900"
          @click="paste"
        >
          Colar
        </button>
      </div>
      <input
        id="send-recipient"
        v-model.trim="recipient"
        spellcheck="false"
        autocomplete="off"
        placeholder="0x..."
        :aria-invalid="!!recipient && !recipientValid"
        class="send-field font-mono text-sm"
      />
      <p v-if="recipient && !recipientValid" class="text-xs text-red-700">
        Informe um endereço de destino válido
      </p>
    </div>
    <p class="text-xs text-gray-500">
      Envios apenas para a rede {{ user.network.value.name }}
    </p>
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="min-h-11 rounded-lg text-sm font-semibold text-gray-900 hover:bg-gray-100"
        @click="emit('close')"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="account-button disabled:opacity-40"
        :disabled="!canConfirm"
        @click="confirm"
      >
        Confirmar envio
      </button>
    </div>
  </template>

  <template v-else-if="step === 'done'">
    <p
      class="-mx-5 -mt-5 px-5 py-3 rounded-t-lg bg-amber-400 font-bold text-gray-900"
    >
      ✓ Tudo certo! Envio realizado
    </p>
    <div>
      <p class="flex items-center gap-2 text-3xl font-bold text-gray-900">
        <img :src="asset.image" alt="" class="w-7 h-7" />
        {{ format(amount) }}
      </p>
      <p class="text-sm text-gray-600">
        para <span class="font-mono">{{ short(recipient) }}</span>
      </p>
    </div>
    <dl class="flex flex-col divide-y divide-gray-100 text-sm text-gray-900">
      <div class="flex justify-between gap-2 py-2">
        <dt class="text-gray-600">Rede</dt>
        <dd>{{ user.network.value.name }}</dd>
      </div>
      <div class="flex justify-between gap-2 py-2">
        <dt class="text-gray-600">Hash</dt>
        <dd class="flex items-center gap-2">
          <span class="font-mono">{{ short(txHash ?? '') }}</span>
          <button
            type="button"
            aria-label="Copiar hash da transação"
            class="text-xs font-semibold"
            @click="copyHash"
          >
            {{ copied ? 'Copiado' : 'Copiar' }}
          </button>
        </dd>
      </div>
    </dl>
    <a
      :href="`${user.network.value.blockExplorers?.default.url}/tx/${txHash}`"
      target="_blank"
      rel="noopener noreferrer"
      class="account-button"
    >
      Ver no {{ user.network.value.blockExplorers?.default.name }}
    </a>
    <button
      type="button"
      class="min-h-11 rounded-lg bg-amber-400 text-sm font-semibold text-gray-900 hover:bg-amber-500"
      @click="emit('close')"
    >
      Fechar
    </button>
  </template>

  <template v-else>
    <div>
      <h2 class="text-xl font-bold text-gray-900">Enviando</h2>
      <p class="text-sm text-gray-600">
        {{ format(amount) }} para
        <span class="font-mono">{{ short(recipient) }}</span>
      </p>
    </div>
    <template v-if="step === 'failed'">
      <p role="alert" class="text-sm text-red-700">
        Não foi possível confirmar o envio. Aguarde alguns minutos e recarregue
        a página antes de enviar de novo.
      </p>
      <button type="button" class="account-button" @click="emit('close')">
        Fechar
      </button>
    </template>
    <template v-else>
      <span
        aria-hidden="true"
        class="self-center w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
      />
      <p class="text-sm text-gray-600">
        Assine com sua passkey ou na sua carteira quando o navegador pedir. Em
        seguida a transação é enviada para a rede.
      </p>
    </template>
  </template>
</template>

<style scoped>
@reference "tailwindcss";
.send-field {
  @apply w-full px-3 py-2.5 border border-gray-500 rounded-lg text-gray-900 aria-invalid:border-2 aria-invalid:border-red-700;
}
</style>
