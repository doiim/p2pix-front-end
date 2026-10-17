<script setup lang="ts">
import { computed } from 'vue';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { TokenEnum } from '@/model/NetworkEnum';
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

// The configured ERC-20s, then the native coin (no token).
const options = computed(() =>
  [...Object.values(TokenEnum), undefined].map((token) => ({
    token,
    symbol: account.symbolOf(token),
    image: token
      ? getTokenImage(token)
      : getNetworkImage(user.network.value.name),
  })),
);
const selected = computed(() =>
  options.value.find((opt) => opt.token === form.token.value),
);
const maxText = computed(() =>
  formatTokenAmount(form.maxAmount.value, account.decimalsOf(form.token.value)),
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
          {{ form.symbol.value }}
        </span>
        <template #items="{ close }">
          <button
            v-for="opt in options"
            :key="opt.symbol"
            type="button"
            class="menu-item"
            @click="(close(), form.setToken(opt.token))"
          >
            <img :src="opt.image" :alt="opt.symbol" class="h-5 w-5" />
            {{ opt.symbol }}
          </button>
        </template>
      </DropdownChip>
    </div>
    <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
      <span>Disponível: {{ maxText }} {{ form.symbol.value }}</span>
      <button type="button" class="acct-link" @click="form.setMax()">
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
