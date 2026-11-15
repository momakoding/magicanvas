<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { TooltipProvider } from "reka-ui";
import { ActionBar, CanvasView, DialogHost, FailDetailModal, LibraryDrawer, SeedPopover, ToastHost, TopBar, UiButton } from "@/components";
import { init, removeSel, setSel, studio } from "@/stores";

function onKey(e: KeyboardEvent) {
  // 弹窗打开或正在输入时，不触发画布快捷键
  const a = document.activeElement;
  if (
    /INPUT|TEXTAREA|SELECT/.test(a?.tagName ?? "") ||
    a?.closest("[role=combobox],[role=listbox],[role=dialog],[role=alertdialog]") ||
    document.querySelector("[role=dialog], [role=alertdialog]")
  )
    return;
  if (e.key === "Delete" || e.key === "Backspace") void removeSel();
  if (e.key === "Escape") {
    setSel([]);
    studio.seed.open = false;
    studio.libOpen = false;
  }
}
onMounted(() => {
  addEventListener("keydown", onKey);
  void init();
});
onBeforeUnmount(() => removeEventListener("keydown", onKey));
</script>

<template>
  <TooltipProvider :delay-duration="250" :skip-delay-duration="150">
    <div v-if="studio.fatal" class="app__fatal" role="alert">
      <h2 class="app__fatal-title">后端启动失败</h2>
      <p>{{ studio.fatal }}</p>
      <UiButton @click="init">重试</UiButton>
    </div>
    <template v-else-if="studio.ready">
      <CanvasView />
      <TopBar />
      <ActionBar />
      <SeedPopover />
      <LibraryDrawer />
    </template>
    <FailDetailModal
      v-if="studio.failDetail"
      :text="studio.failDetail"
      @close="studio.failDetail = null"
    />
    <ToastHost />
    <DialogHost />
  </TooltipProvider>
</template>

<style>
@reference "./styles.css";

.app__fatal {
  @apply fixed inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-ink-muted;
}
.app__fatal-title {
  @apply text-xl font-bold text-ink;
}
</style>
