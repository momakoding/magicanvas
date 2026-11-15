<script setup lang="ts">
import { UiButton, UiModal } from "@/components/ui";
import { toast } from "@/stores";

const props = defineProps<{ text: string }>();
const emit = defineEmits<{ close: [] }>();

async function copy() {
  try { await navigator.clipboard.writeText(props.text); toast("已复制"); }
  catch { toast("复制失败，请手动选中文字复制"); }
}
</script>

<template>
  <UiModal title="错误详情" size="md" @close="emit('close')">
    <pre class="fail-detail__text">{{ text }}</pre>
    <template #footer>
      <UiButton size="sm" @click="copy">复制</UiButton>
      <UiButton variant="primary" size="sm" @click="emit('close')">关闭</UiButton>
    </template>
  </UiModal>
</template>

<style>
@reference "../styles.css";

.fail-detail__text { @apply my-2.5 select-text whitespace-pre-wrap break-all rounded-[10px] bg-soft px-3 py-2.5 font-mono text-xs leading-[1.6]; }
</style>