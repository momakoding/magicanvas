<script setup lang="ts">
import { computed, ref } from "vue";
import { Tip, UiButton, UiField } from "@/components/ui";
import { focusNode, imageUrl, isReady, isUpload, matches, nodeById, setSel, studio, uploadImages } from "@/stores";

const picker = ref<HTMLInputElement>();
const over = ref(false);

const all = computed(() => studio.nodes.filter(isReady).sort((a, b) => b.t - a.t));
const tabAll = computed(() => all.value.filter(n => (studio.libTab === "upload") === isUpload(n)));
const list = computed(() => tabAll.value.filter(matches));
const emptyText = computed(() => (studio.libTab === "upload" && !tabAll.value.length ? "还没有上传图片，点上方按钮或把图片拖进来" : "没有匹配的图"));

function pick(id: string) {
  const n = nodeById(id); if (!n) return;
  setSel([id]); focusNode(n);
}
function onPicked() {
  const el = picker.value!;
  void uploadImages([...(el.files ?? [])]);
  el.value = "";
}
function onDrop(e: DragEvent) {
  over.value = false;
  const files = [...(e.dataTransfer?.files ?? [])];
  if (!files.length) return;
  studio.libTab = "upload";
  void uploadImages(files);
}
</script>

<template>
  <aside
    class="library-drawer" :class="{ 'library-drawer--open': studio.libOpen, 'library-drawer--over': over }" aria-label="资料库"
    @dragover.prevent="over = true" @dragleave.self="over = false" @drop.prevent="onDrop"
  >
    <div class="library-drawer__head">
      <Tip text="收起" side="bottom"><button class="library-drawer__close" aria-label="收起资料库" @click="studio.libOpen = false">›</button></Tip>
      <h2 class="library-drawer__title">资料库</h2>
      <span></span>
    </div>
    <div class="library-drawer__tabs" role="tablist">
      <button class="library-drawer__tab" :class="{ 'library-drawer__tab--active': studio.libTab === 'gen' }" role="tab" :aria-selected="studio.libTab === 'gen'" @click="studio.libTab = 'gen'">生成图片</button>
      <button class="library-drawer__tab" :class="{ 'library-drawer__tab--active': studio.libTab === 'upload' }" role="tab" :aria-selected="studio.libTab === 'upload'" @click="studio.libTab = 'upload'">用户图片</button>
    </div>
    <UiField v-model.trim="studio.query" :placeholder="studio.libTab === 'upload' ? '搜索文件名…' : '搜索提示词…'" />
    <div class="library-drawer__row">
      <span class="library-drawer__segment">
        <button class="library-drawer__segment-btn" :class="{ 'library-drawer__segment-btn--active': studio.filter === 'all' }" @click="studio.filter = 'all'">全部</button>
        <button class="library-drawer__segment-btn" :class="{ 'library-drawer__segment-btn--active': studio.filter === 'fav' }" @click="studio.filter = 'fav'">收藏</button>
      </span>
      <span class="library-drawer__stats">{{ list.length }} / {{ tabAll.length }} 张</span>
    </div>
    <div class="library-drawer__upload">
      <UiButton size="sm" :style="{ visibility: studio.libTab === 'upload' ? 'visible' : 'hidden' }" :tabindex="studio.libTab === 'upload' ? 0 : -1" @click="picker?.click()">上传图片</UiButton>
      <input ref="picker" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="onPicked" />
    </div>
    <div class="library-drawer__grid">
      <Tip v-for="n in list" :key="n.id" :text="n.prompt" side="left">
        <button class="library-drawer__tile" @click="pick(n.id)"><img class="library-drawer__thumb" :src="imageUrl(n)" alt="" /><span v-if="n.fav" class="library-drawer__star">★</span></button>
      </Tip>
      <div v-if="!list.length" class="library-drawer__empty">{{ emptyText }}</div>
    </div>
  </aside>
</template>

<style>
@reference "../styles.css";

.library-drawer { @apply fixed inset-y-0 right-0 z-60 flex w-[360px] translate-x-[105%] flex-col gap-2.5 border-l-[1.5px] border-line-strong bg-[rgba(255,245,248,0.97)] px-4 pb-4 pt-3 shadow-[-12px_0_40px_rgba(56,39,56,0.12)] backdrop-blur-[14px] transition-transform duration-300 ease-pop; }
.library-drawer--open { @apply translate-x-0; }
.library-drawer--over { @apply outline-[3px] -outline-offset-8 outline-pink-deep outline-dashed; }

.library-drawer__head { @apply mb-1 grid grid-cols-[34px_1fr_34px] items-center; }
.library-drawer__title { @apply text-center text-[15px] font-extrabold tracking-[0.02em]; }
.library-drawer__close { @apply size-[34px] cursor-pointer rounded-full border-2 border-ink bg-white text-xl font-extrabold leading-none shadow-hard-2 transition duration-150 ease-pop hover:translate-x-0.5 hover:bg-cream; }

.library-drawer__tabs { @apply grid grid-cols-2 border-b-[1.5px] border-line-strong; }
.library-drawer__tab { @apply -mb-[1.5px] h-[34px] cursor-pointer border-b-[3px] border-transparent text-[13px] font-extrabold text-ink-subtle hover:text-ink; }
.library-drawer__tab--active { @apply border-pink-deep text-pink-deep hover:text-pink-deep; }

.library-drawer__row { @apply flex items-center justify-between; }
.library-drawer__segment { @apply inline-flex rounded-full bg-soft p-0.5; }
.library-drawer__segment-btn { @apply h-6 cursor-pointer rounded-full px-2.5 text-xs font-bold text-ink-muted; }
.library-drawer__segment-btn--active { @apply bg-white text-pink-deep shadow-[0_1px_4px_rgba(56,39,56,0.15)]; }
.library-drawer__stats { @apply text-xs text-ink-muted; }
.library-drawer__upload { @apply h-[30px] flex-none; }

.library-drawer__grid { @apply grid flex-1 grid-cols-3 content-start gap-2 overflow-auto; }
.library-drawer__tile { @apply relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-line-strong p-0 hover:border-pink-deep; }
.library-drawer__thumb { @apply block size-full object-cover; }
.library-drawer__star { @apply absolute right-1 top-0.5 text-[13px] text-gold [text-shadow:0_1px_0_#fff]; }
.library-drawer__empty { @apply col-span-full py-[30px] text-center text-[12.5px] text-ink-subtle; }
</style>