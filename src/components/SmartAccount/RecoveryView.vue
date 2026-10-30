<script setup lang="ts">
import { ref } from 'vue';
import { formatEther, formatUnits } from 'viem';
import ChevronDown from '@/assets/chevronDown.svg';
import SendIcon from '@/assets/withdraw.svg';
import { sweepGasNote } from '@/blockchain/aa/sweep';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useRecoverySweep } from '@/composables/useRecoverySweep';
import { useUser } from '@/composables/useUser';

const recovery = useRecoverySweep();
const accountRouter = useAccountRouter();
const user = useUser();

const recipient = ref('');

const handleLogin = async () => {
  await recovery.login();
  if (recovery.error.value) user.showToast('error', recovery.error.value);
};

const handleSweep = async () => {
  const result = await recovery.sweep(recipient.value.trim());
  if (result) user.showToast('success', 'Fundos enviados!');
  else user.showToast('error', recovery.error.value ?? 'Falha ao enviar');
};
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      aria-label="Voltar"
      class="p-1 -ml-1 rounded-lg hover:bg-gray-100 cursor-pointer"
      @click="accountRouter.back()"
    >
      <ChevronDown aria-hidden="true" class="w-4 h-4 rotate-90" />
    </button>
    <h2 class="acct-title">Recuperar conta</h2>
  </div>
  <p class="text-sm text-gray-600">
    Use a passkey de backup para tirar os fundos de uma conta criada com e-mail
    ou Google, sem o login original.
  </p>

  <button
    v-if="!recovery.isLoggedIn.value"
    type="button"
    class="account-button"
    :disabled="recovery.busy.value"
    @click="handleLogin"
  >
    {{
      recovery.busy.value
        ? 'Aguardando a passkey…'
        : 'Entrar com passkey de backup'
    }}
  </button>

  <template v-else>
    <div class="flex flex-col gap-1">
      <span class="acct-label">Conta</span>
      <span class="font-mono text-xs text-gray-900 break-all">
        {{ recovery.address.value }}
      </span>
    </div>
    <ul
      v-if="recovery.balances.value"
      class="flex flex-col gap-1 text-sm text-gray-900"
    >
      <li class="flex justify-between">
        <span>ETH</span>
        <span class="font-semibold">
          {{ formatEther(recovery.balances.value.eth) }}
        </span>
      </li>
      <li
        v-for="token in recovery.balances.value.tokens"
        :key="token.address"
        class="flex justify-between"
      >
        <span>{{ token.symbol }}</span>
        <span class="font-semibold">
          {{
            token.decimals === undefined
              ? `${token.balance} (unidades brutas)`
              : formatUnits(token.balance, token.decimals)
          }}
        </span>
      </li>
      <li v-if="recovery.balances.value.skipped.length" class="text-red-700">
        Não foi possível ler: {{ recovery.balances.value.skipped.join(', ') }}
      </li>
    </ul>
    <div class="flex flex-col gap-1 pt-4 border-t border-gray-200">
      <label for="recovery-receiver" class="acct-label">
        Endereço de destino
      </label>
      <input
        id="recovery-receiver"
        v-model="recipient"
        type="text"
        spellcheck="false"
        autocomplete="off"
        placeholder="0x..."
        class="w-full min-h-11 px-3 py-1.5 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 outline-none"
      />
      <p class="text-xs text-gray-500">
        {{ sweepGasNote(user.network.value) }}
      </p>
    </div>
    <button
      type="button"
      class="account-button"
      :disabled="recovery.busy.value || !recipient.trim()"
      @click="handleSweep"
    >
      <SendIcon aria-hidden="true" />
      {{ recovery.busy.value ? 'Enviando…' : 'Enviar tudo' }}
    </button>
    <p
      v-if="recovery.lastUserOpHash.value"
      class="text-xs text-gray-500 break-all"
    >
      Operação enviada: {{ recovery.lastUserOpHash.value }}
    </p>
  </template>
</template>
