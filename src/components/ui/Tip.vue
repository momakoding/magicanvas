<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from "reka-ui";

/** 悬停提示：包住唯一一个子元素，不额外生成节点。需要外层有 TooltipProvider */
withDefaults(defineProps<{ text?: string; side?: "top" | "right" | "bottom" | "left" }>(), { side: "top" });
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child><slot /></TooltipTrigger>
    <TooltipPortal>
      <TooltipContent v-if="text" class="tip__content" :side="side" :side-offset="8" :collision-padding="8">
        {{ text }}
        <TooltipArrow class="tip__arrow" :width="12" :height="6" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style>
@reference "../../styles.css";

.tip__content { @apply pointer-events-none z-400 max-w-[280px] animate-fade break-all rounded-[10px] bg-ink px-2.5 py-1.5 text-xs font-semibold leading-normal text-white; }
.tip__arrow { @apply fill-ink; }
</style>
