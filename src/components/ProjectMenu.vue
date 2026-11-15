<script setup lang="ts">
import { EditableArea, EditableInput, EditablePreview, EditableRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { ref } from "vue";
import { askConfirm, newProject, openProject, removeProject, renameProject, studio, toast } from "@/stores";

const open = ref(false);

async function run(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { toast((e as Error).message); }
}
const pick = (id: string) => run(async () => { await openProject(id); open.value = false; });
function rename(id: string, old: string, value: string | null | undefined) {
  const name = value?.trim();
  if (name && name !== old) void run(() => renameProject(id, name));
}
async function remove(id: string, name: string, count: number) {
  if (await askConfirm(`删除项目「${name}」及其 ${count} 张图片？此操作不可恢复。`, { title: "删除项目", ok: "删除" })) void run(() => removeProject(id));
}
/** 正在改名时，Esc 只取消改名，不关闭菜单 */
function onEscape(e: KeyboardEvent) {
  if ((e.target as HTMLElement | null)?.closest("input")) e.preventDefault();
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <UiPill interactive>
        <span>{{ studio.project?.name ?? "项目" }}</span><span class="project-menu__caret">▾</span>
      </UiPill>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="project-menu__panel" align="start" :side-offset="8" @escape-key-down="onEscape">
        <EditableRoot
          v-for="p in studio.projects" :key="p.id" v-slot="{ isEditing, edit }"
          class="project-menu__item" :class="{ 'project-menu__item--current': p.id === studio.project?.id }"
          :model-value="p.name" activation-mode="none" submit-mode="both" :max-length="60" select-on-focus
          @submit="v => rename(p.id, p.name, v)"
        >
          <EditableArea class="project-menu__area">
            <EditablePreview as-child><button class="project-menu__name" @click="pick(p.id)">{{ p.name }}</button></EditablePreview>
            <EditableInput class="project-menu__input" aria-label="项目名称" />
          </EditableArea>
          <template v-if="!isEditing">
            <span class="project-menu__count">{{ p.count }} 张</span>
            <button class="project-menu__action" @click="edit">改名</button>
            <button class="project-menu__action" @click="remove(p.id, p.name, p.count)">删除</button>
          </template>
        </EditableRoot>
        <button class="project-menu__create" @click="run(newProject)">＋ 新建项目</button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
@reference "../styles.css";

.project-menu__caret { @apply text-ink-subtle; }
.project-menu__panel { @apply z-60 flex min-w-[240px] animate-pop flex-col gap-1 rounded-2xl border-2 border-ink bg-white p-2 shadow-panel; }
.project-menu__item { @apply flex items-center gap-0.5 rounded-[10px] hover:bg-hover; }
.project-menu__item--current { @apply bg-rose; }
.project-menu__area { @apply flex min-w-0 flex-1 *:min-w-0 *:flex-1; }
.project-menu__name { @apply cursor-pointer truncate px-2.5 py-2 text-left text-[13px] font-bold; }
.project-menu__input { @apply mx-1 my-[3px] rounded-lg border-[1.5px] border-pink-deep bg-white px-2 py-[5px] text-[13px] font-bold; }
.project-menu__count { @apply pr-1 text-[11px] text-ink-subtle; }
.project-menu__action { @apply cursor-pointer rounded-lg px-1.5 py-1 text-[11px] text-ink-subtle hover:bg-white hover:text-pink-deep; }
.project-menu__create { @apply mt-1 cursor-pointer rounded-b-[10px] border-t border-dashed border-line-strong px-2.5 py-[9px] text-left text-[13px] font-extrabold text-pink-deep; }
</style>
