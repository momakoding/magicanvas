<script setup lang="ts">
import { UiButton, UiModal } from "@/components/ui";
import { skin, skinTitle } from "@/skin";

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <UiModal :title="`关于 ${skin.brand}`" size="sm" @close="emit('close')">
    <section class="about-modal__section about-modal__hero">
      <img class="about-modal__mascot" :src="skin.mascotUri" alt="" />
      <div>
        <h3 class="about-modal__heading about-modal__heading--tight">{{ skinTitle }}</h3>
        <p class="about-modal__text">{{ skin.tagline }}</p>
      </div>
    </section>

    <section class="about-modal__section">
      <h3 class="about-modal__heading">作者</h3>
      <p class="about-modal__text">Momakoding 团队，主要开发者 Saša</p>
    </section>

    <section class="about-modal__section">
      <h3 class="about-modal__heading">开源协议</h3>
      <p class="about-modal__text">本项目的源代码以 <a class="about-modal__link" href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT</a> 协议开放，可以自由学习、使用、修改和商用。</p>
    </section>

    <section v-for="section in skin.aboutSections" :key="section.title" class="about-modal__section">
      <h3 class="about-modal__heading">{{ section.title }}</h3>
      <p v-for="(line, i) in section.paragraphs" :key="i" class="about-modal__text">{{ line }}</p>
    </section>

    <template #footer>
      <UiButton variant="primary" size="sm" @click="emit('close')">关闭</UiButton>
    </template>
  </UiModal>
</template>

<style>
@reference "../styles.css";

.about-modal__section { @apply border-b border-line py-3 last:border-b-0; }
.about-modal__hero { @apply flex items-center gap-3.5; }
.about-modal__mascot { @apply size-[72px] flex-none rounded-[18px] border-2 border-ink bg-mascot object-contain shadow-hard-3; }
.about-modal__heading { @apply mb-2.5 text-[13px] font-extrabold; }
.about-modal__heading--tight { @apply mb-1 text-[15px]; }
.about-modal__text { @apply text-[13px] leading-[1.7] text-ink-muted; }
.about-modal__link { @apply cursor-pointer font-bold text-pink-deep underline; }
</style>