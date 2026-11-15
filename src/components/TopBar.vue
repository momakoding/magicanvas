<script setup lang="ts">
import { computed } from "vue";
import ProjectMenu from "./ProjectMenu.vue";
import { AboutDialog } from "./about-dialog";
import { SettingsDialog } from "./settings-dialog";
import { UiButton, UiPill } from "@/components/ui";
import { MASCOT_URI } from "@/assets";
import { fit, isReady, projectCost, studio } from "@/stores";

const count = computed(() => studio.nodes.filter(isReady).length);
const cost = computed(() => projectCost());
// 命令式打开设置弹窗：每次点击创建一个新实例，关闭后实例自行销毁
const openSettings = () => new SettingsDialog().open();
const openAbout = () => new AboutDialog().open();
</script>

<template>
  <div class="top-bar__dock top-bar__dock--left">
    <UiPill class="top-bar__brand"><img class="top-bar__mascot" :src="MASCOT_URI" alt="" />Image Canvas</UiPill>
    <ProjectMenu />
  </div>
  <div class="top-bar__dock top-bar__dock--right">
    <UiPill>项目花费 ${{ cost.toFixed(3) }}</UiPill>
    <UiButton size="sm" @click="fit">适应视图</UiButton>
    <UiButton size="sm" @click="studio.libOpen = !studio.libOpen">资料库 <b>{{ count }}</b></UiButton>
    <UiButton size="sm" @click="openSettings">设置</UiButton>
    <UiButton size="sm" @click="openAbout">关于</UiButton>
  </div>
</template>

<style>
@reference "../styles.css";

.top-bar__dock { @apply fixed top-4 z-50 flex items-center gap-2; }
.top-bar__dock--left { @apply left-4; }
.top-bar__dock--right { @apply right-4; }
.top-bar__brand { @apply gap-2 font-extrabold tracking-[-0.02em]; }
.top-bar__mascot { @apply size-[30px] rounded-[10px] border-2 border-ink bg-mascot object-contain p-px shadow-hard-2; }
</style>
