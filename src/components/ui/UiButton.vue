<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ variant?: "default" | "primary" | "ghost" | "yellow"; size?: "md" | "sm" }>(), { variant: "default", size: "md" });
const classes = computed(() => props.variant === "ghost"
  ? ["ui-button--ghost"]
  : ["ui-button--solid", `ui-button--${props.size}`, { "ui-button--primary": props.variant === "primary", "ui-button--yellow": props.variant === "yellow" }]);
</script>

<template>
  <button type="button" class="ui-button" :class="classes"><slot /></button>
</template>

<style>
@reference "../../styles.css";

.ui-button { @apply inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50; }

.ui-button--solid { @apply h-[34px] gap-1.5 border-2 border-ink bg-white px-3.5 text-[13px] shadow-hard-2 transition duration-150 ease-pop hover:-translate-y-px hover:bg-cream active:translate-y-0.5 active:shadow-none; }
.ui-button--sm { @apply h-[30px] px-3 text-xs; }
.ui-button--primary { @apply bg-linear-to-br from-pink to-pink-deep text-white hover:brightness-105; }
.ui-button--yellow { @apply bg-highlight text-ink hover:bg-gold; }

.ui-button--ghost { @apply h-7 flex-none bg-soft px-2.5 text-xs text-ink-muted transition-colors duration-150 hover:bg-pink hover:text-white; }
</style>
