<script setup lang="ts">
import { useRoute } from 'vue-router';
import TopBar from '@/components/TopBar/TopBar.vue';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import ToasterComponent from '@/components/ui/ToasterComponent.vue';
import VersionFooter from '@/components/ui/VersionFooter.vue';

const route = useRoute();
</script>

<template>
  <main class="p-3 sm:p-4 md:p-8">
    <TopBar />
    <RouterView v-slot="{ Component }">
      <template v-if="Component">
        <Transition name="page" mode="out-in" appear>
          <div :key="route.fullPath">
            <Suspense>
              <template #default>
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
    <ToasterComponent />
    <VersionFooter />
  </main>
</template>
