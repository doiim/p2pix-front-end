<script setup lang="ts">
import { ref, onMounted } from "vue";
import { appVersions, getIpfsUrl, getLatestVersion } from "@/utils/versions";
import type { AppVersion } from "@/model/AppVersion";

const versions = ref<AppVersion[]>([]);
const latestVersion = ref<AppVersion | null>(null);
const currentVersion = __APP_VERSION__;

onMounted(() => {
  versions.value = [...appVersions].sort((a, b) => 
    new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  );
  latestVersion.value = getLatestVersion();
});

const openIpfsVersion = (ipfsHash: string) => {
  const url = getIpfsUrl(ipfsHash);
  window.open(url, "_blank", "noopener,noreferrer");
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold text-5xl max-w-[50rem]">
        Versões do P2Pix
      </span>
      <span class="text font-medium text-base max-w-[40rem]">
        Visualize todas as versões do P2Pix. Cada versão está
        disponível no IPFS para acesso permanente e descentralizado.
      </span>
      <div v-if="currentVersion" class="mt-4">
        <span class="text-gray-400 text-sm">
          Versão atual: <span class="font-semibold text-white">{{ currentVersion }}</span>
        </span>
      </div>
    </div>

    <div class="versions-container">
      <div
        v-for="version in versions"
        :key="version.tag"
        class="version-card"
      >
        <div class="version-header">
          <h3 class="version-tag">{{ version.tag }}</h3>
          <span
            v-if="version.tag === currentVersion"
            class="current-badge"
          >
            Atual
          </span>
        </div>
        <div class="version-info">
          <p class="version-date">
            <span class="label">Data de lançamento:</span>
            {{ formatDate(version.releaseDate) }}
          </p>
          <p v-if="version.description" class="version-description">
            {{ version.description }}
          </p>
          <div class="version-actions">
            <button
              @click="openIpfsVersion(version.ipfsHash)"
              class="ipfs-button"
            >
              Abrir no IPFS
            </button>
          </div>
        </div>
      </div>

      <div v-if="versions.length === 0" class="empty-state">
        <p class="text-gray-400">Nenhuma versão cadastrada ainda.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-16 px-4;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4 mb-12;
}

.text {
  @apply text-white text-center;
}

.versions-container {
  @apply w-full max-w-4xl space-y-4;
}

.version-card {
  @apply bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-amber-500 transition-colors;
}

.version-header {
  @apply flex items-center justify-between mb-4;
}

.version-tag {
  @apply text-2xl font-bold text-white;
}

.current-badge {
  @apply px-3 py-1 bg-amber-500 text-gray-900 text-xs font-semibold rounded-full;
}

.version-info {
  @apply space-y-3;
}

.version-date {
  @apply text-gray-300 text-sm;
}

.label {
  @apply text-gray-400 font-medium;
}

.version-description {
  @apply text-gray-300 text-sm;
}

.version-actions {
  @apply flex justify-center sm:justify-start items-center gap-4 pt-2 w-full;
}

.ipfs-button {
  @apply px-4 py-2 bg-amber-500 text-gray-900 font-semibold rounded hover:bg-amber-600 transition-colors text-sm;
}

.ipfs-hash {
  @apply text-gray-400 text-xs font-mono break-all;
}

.empty-state {
  @apply text-center py-12;
}
</style>


