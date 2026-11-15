<script setup lang="ts">
withDefaults(defineProps<{ interactive?: boolean }>(), { interactive: false });
</script>

<template>
  <component :is="interactive ? 'button' : 'span'" class="ui-pill" :class="{ 'ui-pill--interactive': interactive }"><slot /></component>
</template>

<style>
@reference "../../styles.css";

.ui-pill { @apply inline-flex h-[38px] items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white/90 px-3 py-[5px] text-[12.5px] font-bold shadow-pill backdrop-blur-[10px]; }
.ui-pill--interactive { @apply cursor-pointer hover:bg-hover; }
</style>
