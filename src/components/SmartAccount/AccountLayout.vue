<script setup lang="ts">
import { computed } from 'vue';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import AccountCard from './AccountCard.vue';

// A step inside the offer card (QR code, loading, receipt) names the hero itself.
defineProps<{ selling: boolean; title?: string; subtitle?: string }>();

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const showPanel = computed(
  () => account.isReady.value || accountRouter.current.value === 'recovery',
);
</script>

<template>
  <div class="flex flex-col items-center w-full mt-10 sm:mt-16">
    <div class="flex flex-col items-center gap-4 text-white text-center">
      <h1
        class="font-extrabold sm:text-5xl text-3xl sm:max-w-[29rem] max-w-[20rem]"
      >
        {{
          title ??
          (selling
            ? 'Venda cripto e receba em Pix'
            : 'Adquira cripto com apenas um Pix')
        }}
      </h1>
      <!-- subtitle '' = a step with no subtitle; undefined = the page's default. -->
      <p
        v-if="subtitle !== ''"
        class="font-medium sm:text-base text-sm max-w-[30rem]"
      >
        {{
          subtitle ??
          (selling
            ? 'Digite um valor, escolha o token e envie sua oferta para a rede'
            : 'Digite um valor, confira a oferta, conecte sua carteira e receba os tokens após realizar o Pix')
        }}
      </p>
    </div>
    <!-- Alerts sit in the flow above the cards, as wide as the row (card, or card + panel); :empty hides
         the box when no alert renders (Vue leaves only comment nodes). -->
    <div
      class="w-full max-w-[30.25rem] mt-10 empty:hidden"
      :class="{ 'lg:max-w-[53.125rem]': showPanel }"
    >
      <slot name="banner" />
    </div>
    <!-- Reversed so the account panel sits left of the offer card on wide
         screens and below it when the row wraps. -->
    <div
      class="offer-row flex flex-row-reverse flex-wrap justify-center items-start gap-x-6 max-lg:gap-y-4 max-lg:mt-10 w-full"
    >
      <div class="flex flex-col items-center w-full md:max-w-[30.25rem]">
        <slot />
      </div>
      <AccountCard v-if="showPanel" />
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

/* Stacked on phones, the row owns the spacing between the two cards. */
.offer-row :deep(.main-container) {
  @apply max-lg:mt-0;
}
</style>
