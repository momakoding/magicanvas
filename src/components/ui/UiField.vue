<script setup lang="ts">
import { ref } from "vue";

defineProps<{ multiline?: boolean }>();
const [model, modifiers] = defineModel<string, "trim">({
  set: v => (modifiers.trim ? v.trim() : v)
});
const el = ref<HTMLInputElement | HTMLTextAreaElement>();
defineExpose({ focus: () => el.value?.focus() });
</script>

<template>
  <textarea v-if="multiline" ref="el" v-model="model" class="ui-field ui-field--multiline" />
  <input v-else ref="el" v-model="model" class="ui-field" />
</template>

<style>
@reference "../../styles.css";

.ui-field { @apply w-full rounded-xl border-[1.5px] border-line-strong bg-white px-2.5 py-2 text-[13px] leading-normal focus:border-pink-deep; }
.ui-field--multiline { @apply cursor-text resize-none; }
</style>
