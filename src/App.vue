<script setup lang="ts">
import { useRoute } from 'vue-router';
import TopBar from "@/components/TopBar/TopBar.vue";
import SpinnerComponent from "@/components/SpinnerComponent.vue";

const route = useRoute();
</script>

<template>
  <TopBar />
  <RouterView v-slot="{ Component }">
    <template v-if="Component">
      <Transition name="page" mode="out-in" appear>
        <div :key="route.fullPath">          
          <Suspense >
            <template #default >
              <component :is="Component" />
            </template>
            <template #fallback>
              <div class="flex w-full h-full justify-center items-center">
                <SpinnerComponent :width="'16'" :height="'16'" />
              </div>
            </template>
          </Suspense>        
        </div>
      </Transition>      
    </template>
  </RouterView>
</template>
