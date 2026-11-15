<script setup lang="ts">
import { SelectContent, SelectIcon, SelectItem, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from "reka-ui";

defineOptions({ inheritAttrs: false });
defineProps<{ options: { value: string; label: string }[]; label?: string }>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger class="ui-select__trigger" :aria-label="label" v-bind="$attrs">
      <SelectValue class="ui-select__value" />
      <SelectIcon class="ui-select__icon">▾</SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ui-select__content" position="popper" :side-offset="6" :collision-padding="8">
        <SelectViewport class="ui-select__viewport">
          <SelectItem v-for="o in options" :key="o.value" :value="o.value" class="ui-select__item">
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
@reference "../../styles.css";

.ui-select__trigger { @apply inline-flex h-[30px] min-w-0 cursor-pointer items-center justify-between gap-2 rounded-full border border-line-strong bg-white px-2.5 text-xs font-bold transition-colors duration-150 hover:bg-hover data-[state=open]:border-pink-deep; }
.ui-select__value { @apply truncate; }
.ui-select__icon { @apply flex-none text-[10px] text-ink-subtle; }
.ui-select__content { @apply z-400 max-h-[min(300px,var(--reka-select-content-available-height))] min-w-(--reka-select-trigger-width) animate-pop overflow-hidden rounded-[14px] border-2 border-ink bg-white p-1 shadow-[0_3px_0_var(--color-ink),var(--shadow-float)]; }
.ui-select__viewport { @apply flex flex-col gap-0.5; }
.ui-select__item { @apply flex cursor-pointer select-none items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none data-highlighted:bg-hover data-[state=checked]:bg-rose data-[state=checked]:text-pink-deep; }
</style>
