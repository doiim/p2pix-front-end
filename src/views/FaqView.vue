<script setup lang="ts">
import type { Faq } from "@/model/Faq";
import { ref } from "vue";
import { marked } from "marked";
import faqContent from "@/utils/files/faqContent.json";

const faq = ref<Faq>(faqContent);

const selectedSection = ref<number>(0);

const setSelectedSection = (index: number) => {
  selectedSection.value = index;
};

const openItem = (index: number) => {
  faq.value[selectedSection.value].items[index].isOpen =
    !faq.value[selectedSection.value].items[index].isOpen;

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  faq.value[selectedSection.value].items[index].content = marked(
    faq.value[selectedSection.value].items[index].content
  );
};
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold sm:text-5xl text-3xl sm:max-w-[50rem] max-w-[90%]"
        >Perguntas Frequentes
      </span>
      <span class="text font-medium sm:text-base text-sm sm:max-w-[40rem] max-w-[90%]"
        >Não conseguiu uma resposta para sua dúvida? Acesse a comunidade do
        Discord para falar diretamente conosco.</span
      >
    </div>

    <div class="faq-container">
      <div class="sumario-section">
        <h1 class="sumario-title">Sumário</h1>
        <h3
          :class="index == selectedSection ? 'selected-sumario' : 'sumario'"
          v-for="(f, index) in faq"
          v-bind:key="f.name"
          @click="setSelectedSection(index)"
        >
          {{ f.name }}
        </h3>
      </div>

      <div class="content-section">
        <div
          v-for="(item, index) in faq[selectedSection].items"
          v-bind:key="item.title"
        >
          <div class="flex cursor-pointer" @click="openItem(index)">
            <img
              alt="plus"
              src="@/assets/plus.svg?url"
              class="icon"
              v-if="!item.isOpen"
            />
            <img
              alt="minus"
              src="@/assets/minus.svg?url"
              class="icon"
              v-if="item.isOpen"
            />
            <h4 class="item-title">{{ item.title }}</h4>
          </div>
          <div class="content" v-if="item.isOpen" v-html="item.content"></div>
          <div class="hr"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-8 sm:mt-16 px-4;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4 mb-8 sm:mb-12;
}

.text {
  @apply text-white text-center;
}

.faq-container {
  @apply flex flex-col sm:flex-row sm:justify-between w-full sm:w-10/12 max-w-7xl gap-8 sm:gap-0 mt-8 sm:mt-20;
}

.sumario-section {
  @apply w-full sm:w-auto sm:min-w-[200px];
}

.sumario-title {
  @apply text-xl sm:text-3xl text-white font-bold mb-4 sm:mb-0;
}

.sumario {
  @apply text-white mt-6 sm:mt-6 cursor-pointer text-sm sm:text-base;
}

.selected-sumario {
  @apply text-white font-bold mt-6 sm:mt-6 cursor-pointer text-sm sm:text-base;
}

.content-section {
  @apply w-full sm:w-4/6;
}

.icon {
  @apply mr-3 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6;
}

.item-title {
  @apply text-white font-semibold text-sm sm:text-base;
}

div.content {
  @apply pt-6 text-white text-sm sm:text-base;
}

.content :deep(ul) {
  @apply list-disc m-2 p-3;
}

.content :deep(ol) {
  @apply list-decimal m-2 p-3;
}

.content :deep(ol ul) {
  @apply list-disc m-1 p-1;
}

.content :deep(p) {
  @apply mb-2;
}

.hr {
  @apply border border-gray-700 my-6;
}

h3 {
  @apply text-white;
}

h2,
h4 {
  font-weight: 600;
}
</style>
