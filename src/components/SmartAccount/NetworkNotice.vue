<script setup lang="ts">
import { useUser } from '@/composables/useUser';
import { getNetworkImage } from '@/utils/imagesPath';

const user = useUser();
</script>

<template>
  <div class="acct-network flex-col">
    <p class="flex items-center gap-1">
      Envios apenas para a rede
      <img
        :src="getNetworkImage(user.network.value.name)"
        alt=""
        class="w-3.5 h-3.5 ml-1"
      />
      <strong class="font-semibold text-gray-900">
        {{ user.network.value.name }}
      </strong>
    </p>
    <p>Envios por outras redes serão perdidos.</p>
  </div>
</template>
