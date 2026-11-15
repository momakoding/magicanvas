<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { UiButton, UiField, UiSelect } from "@/components/ui";
import { makeSizeOptions, modelOptions, plainRatioOptions } from "./controls";
import { priceOf, spawn, studio } from "@/stores";

const text = ref("");
const area = ref<InstanceType<typeof UiField>>();
const form = ref({ model: "", ratio: "1:1", size: "1K" });

// 每次打开都回到默认值，再由用户当场改
watch(() => studio.seed.open, async open => {
  if (!open) return;
  const settings = studio.settings!;
  form.value = { model: settings.defaultModel, ratio: settings.defaultRatio, size: settings.defaultSize };
  text.value = ""; await nextTick(); area.value?.focus();
});

const pos = computed(() => ({
  left: Math.min(innerWidth - 340, studio.seed.sx - 20) + "px",
  top: Math.min(innerHeight - 260, studio.seed.sy + 10) + "px"
}));
const total = computed(() => priceOf(form.value.model));
const sizeOptions = makeSizeOptions(() => form.value.ratio);

function submit() {
  const t = text.value.trim(); if (!t) return;
  studio.seed.open = false;
  void spawn({ parents: [], prompt: t, at: studio.seed.at, ...form.value, n: 1 });
}
</script>

<template>
  <div v-if="studio.seed.open" class="seed-popover" :style="pos">
    <UiField
      ref="area" v-model="text" multiline rows="3" placeholder="想画什么？回车生成，Shift+回车换行"
      @keydown.enter.exact.prevent="submit" @keydown.esc="studio.seed.open = false"
    />
    <div class="seed-popover__row">
      <UiSelect v-model="form.model" class="seed-popover__select" :options="modelOptions" label="模型" />
    </div>
    <div class="seed-popover__row">
      <UiSelect v-model="form.ratio" class="seed-popover__select" :options="plainRatioOptions" label="画幅" />
      <UiSelect v-model="form.size" class="seed-popover__select seed-popover__select--wide" :options="sizeOptions" label="画面尺寸" />
    </div>
    <UiButton variant="primary" size="sm" @click="submit">生成 · ${{ total.toFixed(3) }}</UiButton>
  </div>
</template>

<style>
@reference "../styles.css";

.seed-popover { @apply fixed z-40 flex w-[320px] animate-pop flex-col gap-2 rounded-[18px] border-2 border-ink bg-white p-2.5 shadow-panel; }
.seed-popover__row { @apply flex items-center gap-1.5; }
.seed-popover__select { @apply min-w-0 flex-1; }
.seed-popover__select--wide { @apply flex-[2.2]; }
</style>