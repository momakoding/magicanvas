<script setup lang="ts">
import { AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle } from "reka-ui";
import { confirmReq, settleConfirm } from "@/stores";
import UiButton from "./UiButton.vue";
</script>

<template>
  <AlertDialogRoot :open="!!confirmReq" @update:open="o => { if (!o) settleConfirm(false); }">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-host__overlay" />
      <AlertDialogContent class="dialog-host__panel">
        <header class="dialog-host__header"><AlertDialogTitle class="dialog-host__title">{{ confirmReq?.title }}</AlertDialogTitle></header>
        <div class="dialog-host__body"><AlertDialogDescription class="dialog-host__message">{{ confirmReq?.message }}</AlertDialogDescription></div>
        <footer class="dialog-host__footer">
          <UiButton size="sm" @click="settleConfirm(false)">取消</UiButton>
          <UiButton variant="primary" size="sm" @click="settleConfirm(true)">{{ confirmReq?.ok }}</UiButton>
        </footer>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style>
@reference "../../styles.css";

.dialog-host__overlay { @apply fixed inset-0 z-300 animate-fade bg-mask backdrop-blur-[4px]; }
.dialog-host__panel { @apply fixed left-1/2 top-1/2 z-301 flex w-[min(400px,calc(100%-40px))] -translate-1/2 animate-pop flex-col rounded-[20px] border-[2.5px] border-ink bg-white shadow-modal; }
.dialog-host__header { @apply border-b-[1.5px] border-dashed border-line-strong px-[18px] py-3.5; }
.dialog-host__title { @apply text-base font-extrabold; }
.dialog-host__body { @apply px-[18px] pb-3 pt-1.5; }
.dialog-host__message { @apply pb-1.5 pt-3.5 text-[13px] leading-[1.7] text-ink-muted; }
.dialog-host__footer { @apply flex items-center justify-end gap-2 border-t-[1.5px] border-dashed border-line-strong px-[18px] py-3; }
</style>
