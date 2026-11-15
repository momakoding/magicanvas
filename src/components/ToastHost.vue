<script setup lang="ts">
import { studio } from "@/stores";
</script>

<template>
  <div class="toast-host" :class="{ 'toast-host--show': studio.toastShow }" role="status">{{ studio.toastMsg }}</div>
</template>

<style>
@reference "../styles.css";

.toast-host { @apply pointer-events-none fixed bottom-7 left-1/2 z-[999] -translate-x-1/2 translate-y-5 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-white opacity-0 transition-all duration-[250ms] ease-pop; }
.toast-host--show { @apply translate-y-0 opacity-100; }
</style>