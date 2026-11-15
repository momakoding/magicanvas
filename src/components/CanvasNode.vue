<script setup lang="ts">
import { computed, ref } from "vue";
import { Tip, UiButton } from "@/components/ui";
import { pixelSize } from "@shared";
import { dragPointer } from "@/lib";
import { text } from "@/texts";
import { addDraftInput, addLink, createDraft, discardNode, editNode, fitToImage, imageUrl, isDraftId, isFiltering, isUpload, isReady, matches, persistNodes, retryNode, setSel, studio, toWorld, toggleFav, type NodeView } from "@/stores";

const props = defineProps<{ node: NodeView }>();
const dragging = ref(false);
const el = ref<HTMLElement>();

const order = computed(() => {
  const i = studio.sel.indexOf(props.node.id);
  return i >= 0 && studio.sel.length > 1 ? String(i + 1) : undefined;
});
const dim = computed(() => isFiltering() && isReady(props.node) && !matches(props.node));
const tag = computed(() => {
  if (isUpload(props.node)) return "用户图片";
  if (props.node.size === "auto") return `${props.node.model} · 自动`;
  const [w, h] = pixelSize(props.node.ratio, props.node.size ?? "1K");
  return `${props.node.model} · ${w}×${h}`;
});

/** 按图片真实比例校正节点大小 */
function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  fitToImage(props.node, img.naturalWidth, img.naturalHeight);
}

/** 从右侧圆点拖出一条线，松手时落在哪个节点上就连到哪个节点 */
function onPortDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation(); e.preventDefault(); studio.seed.open = false;
  const from = props.node.id, sx = e.clientX, sy = e.clientY;
  /** 拖线跟随光标；终点吸到当前悬停的节点上 */
  const track = (ev: PointerEvent) => {
    const hit = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-id]");
    const id = hit?.dataset.id ?? "";
    const at = toWorld(ev.clientX, ev.clientY);
    studio.link = { from, x: at.x, y: at.y, target: id && id !== from ? id : "" };
  };
  dragPointer(e, window, {
    move: track,
    up: ev => {
      const link = studio.link, to = link?.target; studio.link = null;
      if (!link) return;
      if (to) return isDraftId(to) ? addDraftInput(to, from) : addLink(from, to);
      // 落在空白处：拖得够远才算，在这里新建一个创作节点，并接入源图
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 24) return;
      createDraft({ x: link.x + 36, y: link.y }, [from]);
    }
  });
  track(e);
}

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation(); studio.seed.open = false;
  const n = props.node, target = el.value!, sx = e.clientX, sy = e.clientY;
  // 已选中的节点一起拖，没选中的只拖自己
  const group = studio.sel.includes(n.id) ? studio.sel.map(id => studio.nodes.find(x => x.id === id)!).filter(Boolean) : [n];
  const origin = group.map(g => [g, g.x, g.y] as const);
  let moved = false;
  const start = toWorld(sx, sy);
  dragPointer(e, target, {
    move: ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true; dragging.value = true;
      const to = toWorld(ev.clientX, ev.clientY);
      origin.forEach(([g, ox, oy]) => { g.x = ox + to.x - start.x; g.y = oy + to.y - start.y; });
    },
    up: () => {
      dragging.value = false;
      if (moved) { void persistNodes(group); return; }
      if (e.shiftKey) setSel(studio.sel.includes(n.id) ? studio.sel.filter(i => i !== n.id) : [...studio.sel, n.id]);
      else setSel([n.id]);
    },
    cancel: () => (dragging.value = false)
  });
}
</script>

<template>
  <div
    ref="el" class="canvas-node"
    :data-id="node.id"
    :class="{
      'canvas-node--pending': node.pending, 'canvas-node--failed': !!node.failed, 'canvas-node--linking': studio.link?.target === node.id,
      'canvas-node--selected': studio.sel.includes(node.id), 'canvas-node--fav': node.fav, 'canvas-node--dim': dim, 'canvas-node--dragging': dragging
    }"
    :style="{ left: node.x + 'px', top: node.y + 'px', width: node.w + 'px', height: node.h + 'px' }"
    @pointerdown="onDown"
  >
    <span v-if="order" class="canvas-node__order">{{ order }}</span>
    <img v-if="isReady(node)" class="canvas-node__image" :src="imageUrl(node)" alt="" draggable="false" @load="onLoad" />
    <div v-else-if="node.failed" class="canvas-node__fail" @pointerdown.stop>
      <template v-if="node.failKind === 'moderation'">
        <Tip :text="node.failed"><strong class="canvas-node__blocked">{{ text("moderationBlocked") }}</strong></Tip>
      </template>
      <template v-else>
        <b class="canvas-node__fail-title">{{ node.failKind === 'overloaded' || node.failKind === 'rate_limit' ? '服务繁忙' : '生成失败' }}</b>
        <span class="canvas-node__fail-text">{{ node.failed }}</span>
      </template>
      <button v-if="node.failDetail" class="canvas-node__fail-detail" @click.stop="studio.failDetail = node.failDetail!">查看详情</button>
      <span class="canvas-node__fail-actions">
        <UiButton variant="ghost" @click.stop="editNode(node)">返回编辑</UiButton>
        <UiButton variant="ghost" @click.stop="retryNode(node)">重试</UiButton>
        <UiButton variant="ghost" @click.stop="discardNode(node)">删除</UiButton>
      </span>
    </div>
    <template v-else-if="node.pending">
      <img class="canvas-node__drawing" src="/img/drawing.svg" alt="" draggable="false" />
      <span class="canvas-node__drawing-label">{{ text("drawingLabel") }}</span>
    </template>
    <button class="canvas-node__fav" aria-label="收藏" @pointerdown.stop @click.stop="toggleFav([node])">★</button>
    <span class="canvas-node__tag">{{ tag }}</span>
    <Tip v-if="isReady(node)" text="拖到另一张图上连线" side="right"><span class="canvas-node__port" @pointerdown="onPortDown"></span></Tip>
  </div>
</template>

<style>
@reference "../styles.css";

.canvas-node {
  @apply absolute cursor-pointer select-none rounded-2xl border-[2.5px] border-ink bg-white shadow-hard-5 hover:border-pink-deep;
  transition: box-shadow 0.15s, transform 0.15s var(--ease-pop), opacity 0.2s, left 0.3s var(--ease-pop), top 0.3s var(--ease-pop), width 0.3s var(--ease-pop), height 0.3s var(--ease-pop);
}
.canvas-node--selected, .canvas-node--linking { @apply border-pink-deep shadow-active; }
.canvas-node--dim { @apply opacity-25; }
.canvas-node--dragging { @apply cursor-grabbing transition-none; }
.canvas-node--failed { @apply border-danger bg-danger-soft shadow-[0_5px_0_var(--color-danger)] hover:border-danger; }
.canvas-node--pending {
  @apply animate-shimmer bg-[length:200%_100%];
  background-image: linear-gradient(110deg, #fce1ec 30%, #fff5f9 50%, #fce1ec 70%);
}

.canvas-node__image { @apply pointer-events-none block size-full rounded-[13px] object-cover; }
.canvas-node__order { @apply absolute -left-2.5 -top-2.5 z-[2] flex size-6 items-center justify-center rounded-full border-2 border-ink bg-pink-deep text-xs font-extrabold text-white; }

.canvas-node__port { @apply absolute -right-3 top-1/2 z-[3] -mt-2.5 size-5 scale-[0.7] cursor-crosshair rounded-full border-[2.5px] border-ink bg-white opacity-0 transition duration-150 ease-pop hover:bg-pink; }
.canvas-node:hover .canvas-node__port, .canvas-node--selected .canvas-node__port { @apply scale-100 opacity-100; }

.canvas-node__fav { @apply absolute right-1.5 top-1.5 hidden size-[26px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink bg-white/90 text-[13px] leading-none text-ink-subtle; }
.canvas-node:hover .canvas-node__fav, .canvas-node--fav .canvas-node__fav { @apply flex; }
.canvas-node--fav .canvas-node__fav { @apply text-gold; }

.canvas-node__tag { @apply absolute bottom-1.5 left-1.5 rounded-full border-[1.5px] border-ink bg-cream px-[7px] py-px text-[10px] font-extrabold opacity-0 transition-opacity duration-150; }
.canvas-node:hover .canvas-node__tag, .canvas-node--selected .canvas-node__tag { @apply opacity-100; }

.canvas-node__fail { @apply absolute inset-0 flex cursor-default flex-col items-center justify-center gap-1.5 p-2.5 text-center; }
.canvas-node__fail-title { @apply text-[13px] text-danger; }
.canvas-node__fail-text { @apply line-clamp-3 break-all text-[11px] leading-[1.4] text-ink-muted; }
.canvas-node__fail-actions { @apply flex flex-wrap justify-center gap-1; }
.canvas-node__fail-detail { @apply cursor-pointer text-[11px] text-pink-deep underline; }
.canvas-node__blocked { @apply rounded-md bg-danger-strong px-2.5 py-1.5 text-[13px] leading-normal text-highlight; }

.canvas-node__drawing { @apply pointer-events-none absolute left-1/2 top-1/2 size-[70%] -translate-1/2 object-contain; }
.canvas-node__drawing-label { @apply pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-highlight px-2 py-0.5 text-xs font-bold text-[#ff4f9a]; }
</style>