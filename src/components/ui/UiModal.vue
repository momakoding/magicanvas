<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";

withDefaults(defineProps<{ title: string; size?: "sm" | "md" | "lg" }>(), { size: "lg" });
const emit = defineEmits<{ close: [] }>();
const titleId = useId();
const closeBtn = ref<HTMLButtonElement>();

// 展开的下拉列表优先吃掉 Esc
const onKey = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || document.querySelector("[role=listbox]")) return;
  e.stopPropagation(); emit("close");
};
onMounted(() => { document.addEventListener("keydown", onKey, true); closeBtn.value?.focus(); });
onBeforeUnmount(() => document.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="ui-modal" @mousedown.self="emit('close')">
    <div class="ui-modal__panel" :class="`ui-modal__panel--${size}`" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <header class="ui-modal__header">
        <h2 :id="titleId" class="ui-modal__title">{{ title }}</h2>
        <button ref="closeBtn" class="ui-modal__close" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <div class="ui-modal__body"><slot /></div>
      <footer v-if="$slots.footer" class="ui-modal__footer"><slot name="footer" /></footer>
    </div>
  </div>
</template>

<style>
@reference "../../styles.css";

.ui-modal { @apply fixed inset-0 z-200 flex animate-fade items-center justify-center bg-mask p-5 backdrop-blur-[4px]; }
.ui-modal__panel { @apply flex max-h-[min(760px,92vh)] animate-pop flex-col rounded-[20px] border-[2.5px] border-ink bg-white shadow-modal; }
.ui-modal__panel--sm { @apply w-[min(480px,100%)]; }
.ui-modal__panel--md { @apply w-[min(560px,100%)]; }
.ui-modal__panel--lg { @apply w-[min(640px,100%)]; }
.ui-modal__header { @apply flex items-center justify-between border-b-[1.5px] border-dashed border-line-strong px-[18px] py-3.5; }
.ui-modal__title { @apply text-base font-extrabold; }
.ui-modal__close { @apply size-[30px] cursor-pointer rounded-full text-xl leading-none text-ink-muted hover:bg-hover hover:text-pink-deep; }
.ui-modal__body { @apply flex-1 overflow-auto px-[18px] pb-3 pt-1.5; }
.ui-modal__footer { @apply flex items-center justify-end gap-2 border-t-[1.5px] border-dashed border-line-strong px-[18px] py-3; }
</style>
