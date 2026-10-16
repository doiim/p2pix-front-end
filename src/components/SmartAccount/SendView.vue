<script setup lang="ts">
import { computed } from 'vue';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { sendableTokens } from '@/config/networks';
import { NATIVE_TOKEN } from '@/model/NetworkEnum';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import { useUser } from '@/composables/useUser';
import CustomButton from '@/components/ui/CustomButton.vue';
import FormCard from '@/components/ui/FormCard.vue';
import DropdownChip from './DropdownChip.vue';

const accountRouter = useAccountRouter();
const account = usePasskeyAccount();
const user = useUser();
const form = useSendForm();

const options = computed(() =>
  sendableTokens(user.network.value).map((token) => ({
    token,
    image:
      token === NATIVE_TOKEN
        ? getNetworkImage(user.network.value.name)
        : getTokenImage(token),
  })),
);
const selected = computed(() =>
  options.value.find((opt) => opt.token === form.token.value),
);
const maxText = computed(() =>
  form.maxAmount.value === null
    ? '…'
    : formatTokenAmount(
        form.maxAmount.value,
        account.decimalsOf(form.token.value ?? NATIVE_TOKEN),
      ),
);
</script>

<template>
  <FormCard no-border>
    <div class="flex items-center justify-between gap-3">
      <input
        v-model="form.amountInput.value"
        type="text"
        inputmode="decimal"
        placeholder="0"
        aria-label="Valor"
        class="min-w-0 flex-1 border-none text-lg text-gray-900 outline-none"
        :class="{
          'text-xl font-semibold': form.amountInput.value !== '',
          'text-red-500': form.cta.value === 'INSUFFICIENT_FUNDS',
        }"
      />
      <DropdownChip label="Selecionar token">
        <img
          v-if="selected"
          :src="selected.image"
          :alt="form.symbol.value"
          class="h-5 w-5"
        />
        <span class="text-sm font-medium text-gray-900 sm:text-lg">
          {{ form.symbol.value || 'Token' }}
        </span>
        <template #items="{ close }">
          <button
            v-for="opt in options"
            :key="opt.token"
            type="button"
            class="menu-item"
            @click="(close(), form.setToken(opt.token))"
          >
            <img
              :src="opt.image"
              :alt="account.symbolOf(opt.token)"
              class="h-5 w-5"
            />
            {{ account.symbolOf(opt.token) }}
          </button>
        </template>
      </DropdownChip>
    </div>
    <div
      v-if="form.token.value"
      class="mt-2 flex items-center justify-between text-xs text-gray-400"
    >
      <span>Disponível: {{ maxText }} {{ form.symbol.value }}</span>
      <button
        type="button"
        class="acct-link"
        :disabled="form.maxAmount.value === null"
        @click="form.setMax()"
      >
        Usar máximo
      </button>
    </div>
  </FormCard>

  <FormCard no-border>
    <div class="flex items-center gap-3">
      <input
        v-model="form.receiver.value"
        type="text"
        spellcheck="false"
        autocomplete="off"
        placeholder="Endereço de destino (0x...)"
        aria-label="Endereço de destino"
        class="min-w-0 flex-1 truncate border-none text-sm text-gray-900 outline-none"
      />
      <button type="button" class="acct-link" @click="form.pasteAddress()">
        Colar
      </button>
    </div>
  </FormCard>

  <template v-if="form.cta.value === 'INSUFFICIENT_FUNDS'">
    <CustomButton
      text="Receber fundos"
      @button-clicked="accountRouter.push('receive')"
    />
    <span class="text-center text-sm text-red-500">Saldo insuficiente</span>
  </template>
  <CustomButton
    v-else
    :text="form.ctaLabel.value"
    :is-disabled="form.cta.value !== 'PREVIEW_SEND'"
    @button-clicked="accountRouter.push('sendPreview')"
  />
</template>
