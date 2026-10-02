<script setup lang="ts">
import { marked } from 'marked';

const currentVersion = import.meta.env.APP_VERSION as string;
const versions = (import.meta.env.APP_RELEASES ?? []) as {
  tag: string;
  title?: string;
  releaseDate: string;
  cid?: string;
  notes?: string;
}[];

const isCurrent = (tag: string): boolean =>
  currentVersion === tag || currentVersion.startsWith(`${tag}+`);

const ipfsUrl = (cid: string): string => `ipfs://${cid}`;

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Release notes are markdown, never HTML: raw HTML in a note renders as
// visible text, and links only carry schemes we choose to allow. v-html then
// receives only markup this renderer itself emits. Kept inline (no dependency)
// on purpose.
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
// RFC 3986 scheme, then our allow-list: unknown schemes degrade to text
// instead of reaching a browser URL parser or an external handler.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(?:https?|mailto|ipfs):/i;
const safeHref = (href: string): boolean =>
  !HAS_SCHEME.test(href) || SAFE_SCHEME.test(href);

marked.use({
  renderer: {
    html: ({ text }) => escapeHtml(text),
    checkbox: ({ checked }) => (checked ? '☑ ' : '☐ '),
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!safeHref(href)) return label;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${t}>${label}</a>`;
    },
    image({ href, title, text }) {
      if (!safeHref(href)) return escapeHtml(text ?? '');
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}"${t}>`;
    },
  },
});

const releaseNotes = (md?: string): string =>
  md ? (marked.parse(md, { breaks: true, gfm: true }) as string) : '';
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold text-5xl max-w-[50rem]">
        Versões do P2Pix
      </span>
      <span class="text font-medium text-base max-w-[40rem]">
        Visualize todas as versões do P2Pix. Cada versão está disponível no IPFS
        para acesso permanente e descentralizado.
      </span>
      <div v-if="currentVersion" class="mt-4">
        <span class="text-gray-400 text-sm">
          Versão atual:
          <span class="font-semibold text-white">{{ currentVersion }}</span>
        </span>
      </div>
    </div>

    <div class="versions-container">
      <div v-for="version in versions" :key="version.tag" class="version-card">
        <div class="version-header">
          <h3 class="version-tag">
            <a
              v-if="version.cid"
              :href="ipfsUrl(version.cid)"
              target="_blank"
              rel="noopener noreferrer"
              class="ipfs-link"
            >
              {{ version.tag }}
            </a>
            <span v-else>{{ version.tag }}</span>
          </h3>
          <span v-if="isCurrent(version.tag)" class="current-badge">
            Atual
          </span>
        </div>
        <p v-if="version.title" class="version-title">
          {{ version.title }}
        </p>
        <div class="version-info">
          <p class="version-date">
            <span class="label">Data de lançamento:</span>
            {{ formatDate(version.releaseDate) }}
          </p>
          <div
            v-if="version.notes"
            class="version-notes"
            v-html="releaseNotes(version.notes)"
          ></div>
          <div class="version-actions">
            <a
              v-if="version.cid"
              :href="ipfsUrl(version.cid)"
              target="_blank"
              rel="noopener noreferrer"
              class="ipfs-button"
            >
              Abrir no IPFS
            </a>
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
@reference "tailwindcss";
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

.version-title {
  @apply text-gray-400 text-sm mt-1;
}

.ipfs-link {
  @apply hover:text-amber-500 transition-colors;
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

.version-notes {
  @apply text-gray-300 text-sm leading-relaxed;

  :deep(ul) {
    @apply list-disc pl-5 space-y-1;
  }

  :deep(ol) {
    @apply list-decimal pl-5 space-y-1;
  }

  :deep(a) {
    @apply text-amber-500 hover:underline;
  }

  :deep(strong) {
    @apply text-white font-semibold;
  }

  :deep(code) {
    @apply bg-gray-900 px-1 py-0.5 rounded text-amber-400 text-xs;
  }

  :deep(p) {
    @apply mb-2 last:mb-0;
  }
}

.label {
  @apply text-gray-400 font-medium;
}

.version-actions {
  @apply flex justify-center sm:justify-start items-center gap-4 pt-2 w-full;
}

.ipfs-button {
  @apply px-4 py-2 bg-amber-500 text-gray-900 font-semibold rounded hover:bg-amber-600 transition-colors text-sm;
}

.empty-state {
  @apply text-center py-12;
}
</style>
