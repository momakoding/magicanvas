<script setup lang="ts">
import { computed, ref } from "vue";
import CanvasNode from "@/components/CanvasNode.vue";
import { skin } from "@/skin";
import DraftNode from "@/components/DraftNode.vue";
import { dragPointer } from "@/lib";
import { DRAFT_ANCHOR, nodeById, removeLink, setSel, setView, studio, toWorld, uploadImages, type NodeView } from "@/stores";

const vp = ref<HTMLElement>();
const world = ref<HTMLElement>();
const panning = ref(false);

const worldStyle = computed(() => ({ transform: `translate(${studio.view.x}px,${studio.view.y}px) scale(${studio.view.s})` }));
const bgStyle = computed(() => ({
  backgroundSize: `${24 * studio.view.s}px ${24 * studio.view.s}px`,
  backgroundPosition: `${studio.view.x}px ${studio.view.y}px`
}));

interface Pt { x: number; y: number }
interface LinkView { key: string; pid: string; cid: string; d: string; hot: boolean; ex: number; ey: number; badge?: { x: number; y: number; n: number } }

/** 三次贝塞尔上取点，用来放合并顺序的数字角标 */
function bezPoint(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t, c = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: c[0] * p0.x + c[1] * c1.x + c[2] * c2.x + c[3] * p1.x, y: c[0] * p0.y + c[1] * c1.y + c[2] * c2.y + c[3] * p1.y };
}

/** 节点右侧中点到目标左侧中点的连线：曲线 path 加上角标位置，order 省略时不画角标 */
function buildLink(pid: string, cid: string, from: Pt, to: Pt, hot: boolean, order?: number): LinkView {
  const k = Math.max(50, Math.abs(to.x - from.x) / 2);
  const c1 = { x: from.x + k, y: from.y }, c2 = { x: to.x - k, y: to.y };
  return {
    key: `${pid}>${cid}`, pid, cid, ex: to.x, ey: to.y, hot,
    d: `M${from.x} ${from.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`,
    badge: order ? { ...bezPoint(from, c1, c2, to, 0.8), n: order } : undefined
  };
}
const rightMid = (n: NodeView): Pt => ({ x: n.x + n.w, y: n.y + n.h / 2 });

const links = computed<LinkView[]>(() => {
  const out: LinkView[] = [];
  studio.nodes.forEach(n => n.parents.forEach((pid, idx) => {
    const p = nodeById(pid); if (!p) return;
    const to = { x: n.x, y: n.y + n.h / 2 };
    out.push(buildLink(pid, n.id, rightMid(p), to, studio.sel.includes(n.id) || studio.sel.includes(pid), n.parents.length > 1 ? idx + 1 : undefined));
  }));
  // 创作节点的入线：编号就是送给模型的参考图顺序，只有一张时也标出来
  studio.drafts.forEach(draft => draft.inputs.forEach((pid, idx) => {
    const p = nodeById(pid); if (!p) return;
    const to = { x: draft.x, y: draft.y + DRAFT_ANCHOR };
    out.push(buildLink(pid, draft.id, rightMid(p), to, studio.sel.includes(pid), idx + 1));
  }));
  return out;
});

/** 拖线过程中的临时曲线：起点是源节点右侧中点，终点吸附到悬停节点左侧中点，否则跟随光标 */
const tempPath = computed(() => {
  const drag = studio.link, from = drag && nodeById(drag.from); if (!drag || !from) return "";
  const toNode = drag.target ? nodeById(drag.target) : undefined;
  const draft = drag.target ? studio.drafts.find(d => d.id === drag.target) : undefined;
  const to = toNode ? { x: toNode.x, y: toNode.y + toNode.h / 2 } : draft ? { x: draft.x, y: draft.y + DRAFT_ANCHOR } : { x: drag.x, y: drag.y };
  return buildLink(drag.from, "", rightMid(from), to, false).d;
});

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  studio.seed.open = false;
  const el = vp.value!, sx = e.clientX, sy = e.clientY, ox = studio.view.x, oy = studio.view.y;
  let moved = false;
  dragPointer(e, el, {
    move: ev => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true;
      setView({ ...studio.view, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
    },
    up: () => {
      panning.value = false;
      if (!moved && !e.shiftKey) setSel([]);
    },
    cancel: () => (panning.value = false)
  });
  panning.value = true;
}
function onWheel(e: WheelEvent) {
  const view = studio.view, zoom = Math.max(0.25, Math.min(2, view.s * Math.exp(-e.deltaY * 0.0015))), ratio = zoom / view.s;
  setView({ x: e.clientX - (e.clientX - view.x) * ratio, y: e.clientY - (e.clientY - view.y) * ratio, s: zoom });
}
function onDrop(e: DragEvent) {
  const files = [...(e.dataTransfer?.files ?? [])];
  if (!files.length) return;
  void uploadImages(files, toWorld(e.clientX, e.clientY));
}
function onDblClick(e: MouseEvent) {
  if (e.target !== vp.value && e.target !== world.value) return;
  Object.assign(studio.seed, { open: true, sx: e.clientX, sy: e.clientY, at: toWorld(e.clientX, e.clientY) });
}
</script>

<template>
  <div class="canvas-view" :class="{ 'canvas-view--panning': panning }" ref="vp" :style="bgStyle" @pointerdown="onDown" @wheel.prevent="onWheel" @dblclick="onDblClick" @dragover.prevent @drop.prevent="onDrop">
    <div ref="world" class="canvas-view__world" :class="{ 'canvas-view__world--animated': studio.animating }" :style="worldStyle">
      <svg class="canvas-view__links">
        <template v-for="l in links" :key="l.key">
          <path class="canvas-view__link" :class="{ 'canvas-view__link--hot': l.hot }" :d="l.d" />
          <path class="canvas-view__link-hit" :d="l.d" @pointerdown.stop @dblclick.stop="removeLink(l.pid, l.cid)"><title>双击删除这条连线</title></path>
          <circle class="canvas-view__link-end" :cx="l.ex" :cy="l.ey" r="4" />
          <g v-if="l.badge" class="canvas-view__badge">
            <circle class="canvas-view__badge-circle" :cx="l.badge.x" :cy="l.badge.y" r="10" />
            <text class="canvas-view__badge-text" :x="l.badge.x" :y="l.badge.y">{{ l.badge.n }}</text>
          </g>
        </template>
        <path v-if="tempPath" class="canvas-view__link canvas-view__link--hot" :d="tempPath" />
      </svg>
      <CanvasNode v-for="n in studio.nodes" :key="n.id" :node="n" />
      <DraftNode v-for="d in studio.drafts" :key="d.id" :draft="d" />
    </div>
  </div>

  <div v-show="studio.ready && !studio.nodes.length" class="canvas-view__empty">
    <img class="canvas-view__empty-image" :src="skin.mascotUri" alt="" />双击画布，写下第一个想法
  </div>
  <div class="canvas-view__hint">
    <kbd class="canvas-view__key">双击</kbd> 空白处写提示词 &nbsp; <kbd class="canvas-view__key">点击</kbd> 选中图后继续生成<br />
    <kbd class="canvas-view__key">Shift</kbd>+点击 依次选多张，合并时按选择顺序 &nbsp;     <kbd class="canvas-view__key">滚轮</kbd> 缩放 &nbsp; <kbd class="canvas-view__key">Del</kbd> 删除：移入资料库<br />
    <kbd class="canvas-view__key">拖入</kbd> 图片文件上传，作为参考图生成 &nbsp; <kbd class="canvas-view__key">拖右侧圆点</kbd> 连线：落在图上是关联，落在创作节点上是接入参考图，落在空白处新建创作节点；双击连线删除
  </div>
</template>

<style>
@reference "../styles.css";

.canvas-view {
  @apply fixed inset-0 cursor-grab touch-none bg-app;
  background-image: radial-gradient(rgba(56, 39, 56, 0.16) 1.3px, transparent 1.4px);
  background-size: 24px 24px;
}
.canvas-view--panning { @apply cursor-grabbing; }
/* 不要加 will-change: transform：浏览器会按初始倍率栅格化后再拉伸，缩放时边框、文字和连线出现锯齿 */
.canvas-view__world { @apply absolute left-0 top-0 origin-top-left; }
.canvas-view__world--animated { @apply transition-transform duration-[450ms] ease-pop; }

.canvas-view__links { @apply pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible; }
.canvas-view__link { @apply fill-none stroke-pink-deep stroke-2 opacity-55 [stroke-dasharray:2_6] [stroke-linecap:round]; }
.canvas-view__link--hot { @apply stroke-[2.5] opacity-100 [stroke-dasharray:none]; }
.canvas-view__link-hit { @apply cursor-pointer fill-none stroke-transparent stroke-[14] opacity-100 [pointer-events:stroke] [stroke-dasharray:none]; }
.canvas-view__link-end { @apply fill-pink-deep; }
.canvas-view__badge-circle { @apply fill-white stroke-pink-deep stroke-2; }
.canvas-view__badge-text { @apply fill-pink-deep text-[11px] font-extrabold [dominant-baseline:central] [text-anchor:middle]; }

.canvas-view__empty { @apply pointer-events-none fixed left-1/2 top-1/2 z-[2] -translate-1/2 text-center text-sm text-ink-muted; }
.canvas-view__empty-image { @apply mx-auto mb-2 block w-[110px] animate-float; }
.canvas-view__hint { @apply pointer-events-none fixed bottom-4 left-4 z-[5] text-xs leading-[1.7] text-ink-subtle; }
.canvas-view__key { @apply rounded-[5px] border border-line-strong bg-white px-[5px] font-[inherit] text-[11px]; }
</style>