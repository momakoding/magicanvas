<script setup lang="ts">
import { computed } from "vue";
import { AUTO, nodeSize } from "@shared";
import { UiButton, UiField, UiSelect } from "@/components/ui";
import { autoRatioOptions, makeSizeOptions, modelOptions, moveItem } from "./controls";
import { dragPointer } from "@/lib";
import { DRAFT_W, anyNodeById, imageUrl, isReady, priceOf, removeDraft, spawn, studio, toWorld, toast, type Draft } from "@/stores";

const props = defineProps<{ draft: Draft }>();
const draft = props.draft;

const inputs = computed(() => draft.inputs.map(anyNodeById).filter((n): n is NonNullable<typeof n> => !!n && isReady(n)));
/** 选「自动」时跟随第一张参考图的画幅，没有参考图就用默认画幅 */
const ratio = computed(() => (draft.ratio === AUTO ? inputs.value[0]?.ratio ?? studio.settings!.defaultRatio : draft.ratio));
const isAuto = computed(() => draft.ratio === AUTO);
const total = computed(() => priceOf(draft.model));
const sizeOptions = makeSizeOptions(ratio);

function move(id: string, delta: number) {
  const next = moveItem(draft.inputs, id, delta);
  if (next) draft.inputs = next;
}
function drop(id: string) { draft.inputs = draft.inputs.filter(i => i !== id); }

function onDragStart(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation(); studio.seed.open = false;
  const el = e.currentTarget as HTMLElement, sx = e.clientX, sy = e.clientY, ox = draft.x, oy = draft.y;
  const start = toWorld(sx, sy);
  dragPointer(e, el, {
    move: ev => {
      const to = toWorld(ev.clientX, ev.clientY);
      draft.x = ox + to.x - start.x; draft.y = oy + to.y - start.y;
    }
  });
}

function go() {
  const ps = inputs.value, t = draft.text.trim();
  if (!ps.length && !t) return toast("写点提示词，或者连入参考图");
  if (ps.length < 2 && !t) return toast("写一句想怎么画");
  const prompt = t || `融合所选画面（按顺序参考 ${ps.length} 张图）`, [w, h] = nodeSize(ratio.value);
  void spawn({
    parents: ps, prompt, model: draft.model, ratio: ratio.value, size: isAuto.value ? AUTO : draft.size, n: 1,
    // 新节点顶替创作节点的位置，不跳到别处
    at: { x: draft.x + w / 2, y: draft.y + h / 2 }, exact: true
  });
  removeDraft(draft.id);
}
</script>

<template>
  <div
    class="draft-node" :class="{ 'draft-node--linking': studio.link?.target === draft.id }" :data-id="draft.id"
    :style="{ left: draft.x + 'px', top: draft.y + 'px', width: DRAFT_W + 'px' }"
    @pointerdown.stop="studio.seed.open = false" @dblclick.stop @wheel.stop
  >
    <div class="draft-node__header" @pointerdown="onDragStart">
      <b>创作节点</b>
      <button class="draft-node__close" aria-label="删除创作节点" @pointerdown.stop @click="removeDraft(draft.id)">×</button>
    </div>
    <div class="draft-node__inputs">
      <span v-if="!inputs.length" class="draft-node__placeholder">把图片右侧的圆点拖到这里，接入参考图</span>
      <div v-for="(n, i) in inputs" :key="n.id" class="draft-node__chip">
        <img class="draft-node__chip-image" :src="imageUrl(n)" alt="" draggable="false" /><b class="draft-node__chip-index">{{ i + 1 }}</b>
        <span class="draft-node__chip-ops">
          <button class="draft-node__chip-btn" :disabled="i === 0" aria-label="前移" @click="move(n.id, -1)">◀</button>
          <button class="draft-node__chip-btn" aria-label="移除" @click="drop(n.id)">×</button>
          <button class="draft-node__chip-btn" :disabled="i === inputs.length - 1" aria-label="后移" @click="move(n.id, 1)">▶</button>
        </span>
      </div>
    </div>
    <UiField v-model="draft.text" multiline rows="3" placeholder="想怎么画？多张参考图按编号顺序使用" @keydown.enter.exact.prevent="go" />
    <div class="draft-node__row">
      <UiSelect v-model="draft.model" class="draft-node__select" :options="modelOptions" label="模型" />
    </div>
    <div class="draft-node__row">
      <UiSelect v-model="draft.ratio" class="draft-node__select" :options="autoRatioOptions" label="画幅" />
      <UiSelect v-if="!isAuto" v-model="draft.size" class="draft-node__select draft-node__select--wide" :options="sizeOptions" label="画面尺寸" />
    </div>
    <UiButton variant="primary" size="sm" @click="go">生成 · ${{ total.toFixed(3) }}</UiButton>
  </div>
</template>

<style>
@reference "../styles.css";

.draft-node { @apply absolute z-[5] flex cursor-default flex-col gap-2 rounded-[18px] border-[2.5px] border-ink bg-white px-2.5 pb-2.5 shadow-hard-5; }
.draft-node--linking { @apply border-pink-deep shadow-active; }
.draft-node__header { @apply -mx-2.5 flex h-[34px] cursor-grab items-center justify-between border-b-[1.5px] border-dashed border-line-strong pl-3 pr-2 text-[12.5px]; }
.draft-node__close { @apply size-6 cursor-pointer rounded-full text-[17px] leading-none text-ink-muted hover:bg-hover hover:text-pink-deep; }
.draft-node__inputs { @apply flex h-[76px] flex-none items-center gap-2.5 overflow-x-auto overflow-y-hidden px-1 pt-2; }
.draft-node__placeholder { @apply text-xs text-ink-subtle; }
.draft-node__chip { @apply relative flex flex-none flex-col items-center gap-0.5; }
.draft-node__chip-image { @apply size-11 rounded-lg border-2 border-ink object-cover; }
.draft-node__chip-index { @apply absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-pink-deep text-[11px] text-white; }
.draft-node__chip-ops { @apply flex gap-px; }
.draft-node__chip-btn { @apply size-4 cursor-pointer rounded-[5px] bg-soft text-[9px] leading-none text-ink-muted enabled:hover:bg-pink enabled:hover:text-white disabled:cursor-default disabled:opacity-30; }
.draft-node__row { @apply flex items-center gap-1.5; }
.draft-node__select { @apply min-w-0 flex-1; }
.draft-node__select--wide { @apply flex-[2.2]; }
</style>