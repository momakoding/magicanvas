<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { AUTO } from "@shared";
import { Tip, UiButton, UiField, UiSelect } from "@/components/ui";
import { autoRatioOptions, makeSizeOptions, modelOptions, moveItem } from "./controls";
import { deleteSel, download, regenerate, imageUrl, isUpload, lastSel, nodeById, priceOf, spawn, studio, toScreen, toast, toggleFav } from "@/stores";

/** 每个选择组合各自保存写到一半的修改意见：切换选择、生成完成后自动选中新图，都不会把它清掉 */
const drafts = reactive(new Map<string, string>());
const key = computed(() => [...studio.sel].sort().join(","));   // 排序：调整参考图顺序不算换选择
const text = computed({ get: () => drafts.get(key.value) ?? "", set: v => { drafts.set(key.value, v); } });
const barEl = ref<HTMLElement>();
const barH = ref(300);
const win = ref({ w: innerWidth, h: innerHeight });
const onResize = () => (win.value = { w: innerWidth, h: innerHeight });
let ro: ResizeObserver | undefined;
onMounted(() => { addEventListener("resize", onResize); });
onBeforeUnmount(() => { removeEventListener("resize", onResize); ro?.disconnect(); });
watch(barEl, el => { ro?.disconnect(); if (el) { ro = new ResizeObserver(() => (barH.value = el.offsetHeight)); ro.observe(el); } });

const anchor = computed(() => lastSel());
const multi = computed(() => studio.sel.length > 1);
const parents = computed(() => studio.sel.map(nodeById).filter((n): n is NonNullable<typeof n> => !!n));
const pos = computed(() => {
  const n = anchor.value; if (!n) return {};
  const { x: cx, y: bottom } = toScreen(n.x + n.w / 2, n.y + n.h);
  return {
    left: Math.max(10, Math.min(win.value.w - 370, cx - 180)) + "px",
    top: Math.max(70, Math.min(win.value.h - barH.value - 10, bottom + 18)) + "px"
  };
});
/** 选「自动」时跟随第一张参考图的画幅 */
const ratio = computed(() => (studio.bar.ratio === AUTO ? parents.value[0]?.ratio ?? studio.settings!.defaultRatio : studio.bar.ratio));
const isAuto = computed(() => studio.bar.ratio === AUTO);
/** 画幅为「自动」时尺寸也交给接口决定，不显示尺寸下拉框 */
const total = computed(() => priceOf(studio.bar.model));
const sizeOptions = makeSizeOptions(ratio);
const caption = computed(() => (multi.value ? `合并 ${studio.sel.length} 张，按下方顺序作为参考` : (anchor.value ? (isUpload(anchor.value) ? `用户图片 · ${anchor.value.prompt}` : anchor.value.prompt) : "")));

function move(id: string, delta: number) {
  const next = moveItem(studio.sel, id, delta);
  if (next) studio.sel = next;
}
function compose(ps: typeof parents.value, t: string) {
  if (ps.length === 1) return isUpload(ps[0]) ? t : t ? `${ps[0].prompt}；${t}` : ps[0].prompt;
  return `${t || "融合所选画面"}（按顺序参考 ${ps.length} 张图）`;
}
function go() {
  const ps = parents.value, t = text.value.trim();
  if (!ps.length) return;
  if (!t && ps.length === 1) { document.getElementById("barInput")?.focus(); return; }
  const bar = studio.bar;
  void spawn({ parents: ps, prompt: compose(ps, t), model: bar.model, ratio: ratio.value, size: isAuto.value ? AUTO : bar.size, n: 1 });
  drafts.delete(key.value);
}
function reuse() { text.value = anchor.value!.prompt; document.getElementById("barInput")?.focus(); toast("已填入提示词，可直接改"); }
</script>

<template>
  <div v-if="anchor" id="bar" ref="barEl" class="action-bar" :style="pos">
    <div v-if="multi" class="action-bar__order">
      <div v-for="(n, i) in parents" :key="n.id" class="action-bar__chip">
        <img class="action-bar__chip-image" :src="imageUrl(n)" alt="" /><b class="action-bar__chip-index">{{ i + 1 }}</b>
        <span class="action-bar__chip-ops">
          <button class="action-bar__chip-move" :disabled="i === 0" aria-label="前移" @click="move(n.id, -1)">◀</button>
          <button class="action-bar__chip-move" :disabled="i === parents.length - 1" aria-label="后移" @click="move(n.id, 1)">▶</button>
        </span>
      </div>
    </div>
    <Tip :text="anchor.prompt"><div class="action-bar__caption">{{ caption }}</div></Tip>
    <UiField id="barInput" v-model="text" placeholder="接着改什么？例如：换成夜景" @keydown.enter="go()" />
    <div class="action-bar__row">
      <UiSelect v-model="studio.bar.model" class="action-bar__select" :options="modelOptions" label="模型" />
    </div>
    <div class="action-bar__row">
      <UiSelect v-model="studio.bar.ratio" class="action-bar__select" :options="autoRatioOptions" label="画幅" />
      <UiSelect v-if="!isAuto" v-model="studio.bar.size" class="action-bar__select action-bar__select--wide" :options="sizeOptions" label="画面尺寸" />
    </div>
    <UiButton variant="primary" @click="go()">生成 · ${{ total.toFixed(3) }}</UiButton>
    <div class="action-bar__row action-bar__row--tools">
      <UiButton v-if="!multi && !isUpload(anchor)" variant="ghost" @click="regenerate(anchor)">再来一版</UiButton>
      <UiButton variant="ghost" @click="toggleFav(parents)">{{ anchor.fav ? "已收藏" : "收藏" }}</UiButton>
      <UiButton v-if="!multi && !isUpload(anchor)" variant="ghost" @click="reuse">复用提示词</UiButton>
      <UiButton v-if="!multi" variant="ghost" @click="download(anchor)">下载</UiButton>
      <UiButton variant="ghost" @click="deleteSel">删除</UiButton>
    </div>
  </div>
</template>

<style>
@reference "../styles.css";

.action-bar { @apply fixed z-30 flex w-[360px] animate-pop flex-col gap-2 rounded-[18px] border-2 border-ink bg-white p-2.5 shadow-panel; }
.action-bar__caption { @apply line-clamp-2 text-xs leading-normal text-ink-muted; }
.action-bar__row { @apply flex items-center gap-1.5; }
.action-bar__row--tools { @apply flex-wrap justify-between; }
.action-bar__select { @apply min-w-0 flex-1; }
.action-bar__select--wide { @apply flex-[2.2]; }
.action-bar__order { @apply flex flex-wrap gap-2 empty:hidden; }
.action-bar__chip { @apply relative flex flex-col items-center gap-0.5; }
.action-bar__chip-image { @apply size-12 rounded-lg border-2 border-ink object-cover; }
.action-bar__chip-index { @apply absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-pink-deep text-[11px] text-white; }
.action-bar__chip-ops { @apply flex gap-0.5; }
.action-bar__chip-move { @apply h-4 w-[22px] cursor-pointer rounded-md bg-soft text-[10px] leading-none text-ink-muted enabled:hover:bg-pink enabled:hover:text-white disabled:cursor-default disabled:opacity-30; }
</style>