<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NumberFieldInput, NumberFieldRoot, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from "reka-ui";
import { Tip, UiButton, UiField, UiModal, UiSelect } from "@/components/ui";
import { makeSizeOptions, plainRatioOptions } from "./controls";
import type { ModelDef } from "@shared";
import { api } from "@/api";
import { applySettings, studio } from "@/stores";

const emit = defineEmits<{ close: [] }>();

/* 弹窗里改的是副本，点「保存」才提交 */
const s0 = studio.settings!;
const baseUrl = ref(s0.baseUrl);
const apiKey = ref("");
const clearKey = ref(false);
const showKey = ref(false);
const models = ref<ModelDef[]>(s0.models.map(m => ({ ...m })));
const defaultModel = ref(s0.defaultModel);
const defaultRatio = ref(s0.defaultRatio);
const defaultSize = ref(s0.defaultSize);

const detected = ref<string[]>([]);
const filter = ref("");
const status = ref("");
const statusBad = ref(false);
const busy = ref(false);
const err = ref("");
const newModel = ref("");
const first = ref<InstanceType<typeof UiField>>();

const sizeOptions = makeSizeOptions(defaultRatio);
const have = computed(() => new Set(models.value.map(m => m.id)));
const shown = computed(() => detected.value.filter(id => !filter.value || id.toLowerCase().includes(filter.value.trim().toLowerCase())));
const addable = computed(() => shown.value.filter(id => !have.value.has(id)));
const keySaved = computed(() => s0.apiKeySet);
const hintOff = computed(() => s0.apiKeySet || !!baseUrl.value);
const keyPlaceholder = computed(() => (keySaved.value && !clearKey.value ? "已保存，留空则保持不变" : "sk-…"));

function setStatus(msg: string, bad = false) { status.value = msg; statusBad.value = bad; }

async function detect() {
  if (busy.value) return;
  busy.value = true; setStatus("检测中…");
  try {
    detected.value = (await api.detectModels({ baseUrl: baseUrl.value, apiKey: apiKey.value })).models;
    filter.value = ""; setStatus(`检测到 ${detected.value.length} 个模型`);
  } catch (e) {
    detected.value = []; setStatus((e as Error).message, true);
  } finally { busy.value = false; }
}
function add(id: string) {
  id = id.trim();
  if (!id || have.value.has(id)) return false;
  models.value.push({ id, price: 0 });
  if (models.value.length === 1) defaultModel.value = id;
  return true;
}
function addManual() {
  if (!newModel.value.trim()) return;
  if (!add(newModel.value)) setStatus("这个模型已经在列表里", true); else setStatus("");
  newModel.value = "";
}
function remove(i: number) {
  const [gone] = models.value.splice(i, 1);
  if (gone.id === defaultModel.value) defaultModel.value = models.value[0]?.id ?? "";
}
function clearSavedKey() { clearKey.value = true; apiKey.value = ""; }

async function save() {
  err.value = "";
  if (!models.value.length) { err.value = "至少需要一个模型"; return; }
  const url = baseUrl.value.trim();
  if (url && !/^https?:\/\//i.test(url)) { err.value = "基地址需要以 http:// 或 https:// 开头"; return; }
  try {
    await applySettings({
      baseUrl: url,
      models: models.value.map(m => ({ id: m.id, price: Number(m.price) || 0 })),
      defaultModel: defaultModel.value, defaultRatio: defaultRatio.value, defaultSize: defaultSize.value,
      // 没动过 Key 就不提交，后端保持原值
      apiKey: clearKey.value ? "" : apiKey.value.trim() ? apiKey.value.trim() : undefined
    });
    emit("close");
  } catch (e) { err.value = (e as Error).message; }
}

onMounted(() => first.value?.focus());
</script>

<template>
  <UiModal title="设置" size="lg" @close="emit('close')">
    <section class="settings-modal__section">
      <h3 class="settings-modal__heading">接口 <small class="settings-modal__note">请求由内置后端转发，Key 只保存在后端，不会回传给页面</small></h3>
      <label class="settings-modal__field"><span class="settings-modal__label">基地址</span>
        <UiField ref="first" v-model="baseUrl" placeholder="https://api.example.com/v1" spellcheck="false" autocomplete="off" />
      </label>
      <label class="settings-modal__field"><span class="settings-modal__label">API Key</span>
        <span class="settings-modal__password">
          <UiField v-model="apiKey" :type="showKey ? 'text' : 'password'" :placeholder="keyPlaceholder" spellcheck="false" autocomplete="off" @input="clearKey = false" />
          <UiButton variant="ghost" @click="showKey = !showKey">{{ showKey ? "隐藏" : "显示" }}</UiButton>
          <UiButton v-if="keySaved && !clearKey" variant="ghost" @click="clearSavedKey">清除</UiButton>
        </span>
      </label>
      <p class="settings-modal__hint" :class="{ 'settings-modal__hint--off': hintOff }" :aria-hidden="hintOff">基地址和 Key 都留空时，生成的是演示图。</p>
      <div class="settings-modal__row">
        <UiButton size="sm" :disabled="busy" @click="detect">检测可用模型</UiButton>
        <span class="settings-modal__status" :class="{ 'settings-modal__status--bad': statusBad }" role="status">{{ status }}</span>
      </div>
      <div v-if="detected.length">
        <div class="settings-modal__row settings-modal__row--between settings-modal__filter">
          <UiField v-model="filter" class="settings-modal__grow" :placeholder="`筛选 ${detected.length} 个模型，例如 image`" spellcheck="false" />
          <UiButton size="sm" :disabled="!addable.length" @click="addable.forEach(add)">添加筛选结果 ({{ addable.length }})</UiButton>
        </div>
        <div class="settings-modal__list">
          <div v-for="id in shown" :key="id" class="settings-modal__item">
            <Tip :text="id"><span class="settings-modal__model-id">{{ id }}</span></Tip>
            <span v-if="have.has(id)" class="settings-modal__added">已添加</span>
            <UiButton v-else variant="ghost" @click="add(id)">添加</UiButton>
          </div>
          <p v-if="!shown.length" class="settings-modal__empty">没有匹配的模型</p>
        </div>
      </div>
    </section>

    <section class="settings-modal__section">
      <h3 class="settings-modal__heading">模型列表 <small class="settings-modal__note">选中圆点为默认模型，价格是每张的估算值</small></h3>
      <RadioGroupRoot v-model="defaultModel" orientation="vertical" aria-label="默认模型">
        <div v-for="(m, i) in models" :key="m.id" class="settings-modal__item">
          <RadioGroupItem :value="m.id" class="settings-modal__radio" :aria-label="`设为默认：${m.id}`"><RadioGroupIndicator class="settings-modal__radio-dot" /></RadioGroupItem>
          <Tip :text="m.id"><span class="settings-modal__model-id">{{ m.id }}</span></Tip>
          <NumberFieldRoot v-model="m.price" class="settings-modal__price" :min="0" :step="0.001" :format-options="{ maximumFractionDigits: 4 }">
            $<NumberFieldInput class="settings-modal__price-input" :aria-label="`${m.id} 单价`" />
          </NumberFieldRoot>
          <UiButton variant="ghost" @click="remove(i)">移除</UiButton>
        </div>
      </RadioGroupRoot>
      <p v-if="!models.length" class="settings-modal__empty">还没有模型，请检测或手动添加。</p>
      <div class="settings-modal__row settings-modal__add">
        <UiField v-model="newModel" class="settings-modal__grow" placeholder="手动添加模型名，回车确认" spellcheck="false" @keydown.enter.prevent="addManual" />
        <UiButton size="sm" @click="addManual">添加</UiButton>
      </div>
    </section>

    <section class="settings-modal__section">
      <h3 class="settings-modal__heading">画面默认值</h3>
      <div class="settings-modal__row settings-modal__row--between">
        <label class="settings-modal__field settings-modal__field--inline"><span>默认画幅</span>
          <UiSelect v-model="defaultRatio" :options="plainRatioOptions" label="默认画幅" />
        </label>
        <label class="settings-modal__field settings-modal__field--inline"><span>默认尺寸</span>
          <UiSelect v-model="defaultSize" :options="sizeOptions" label="默认尺寸" />
        </label>
      </div>
    </section>

    <template #footer>
      <span class="settings-modal__error" role="alert">{{ err }}</span>
      <UiButton size="sm" @click="emit('close')">取消</UiButton>
      <UiButton variant="primary" size="sm" @click="save">保存</UiButton>
    </template>
  </UiModal>
</template>

<style>
@reference "../styles.css";

.settings-modal__section { @apply border-b border-line py-3 last:border-b-0; }
.settings-modal__heading { @apply mb-2.5 text-[13px] font-extrabold; }
.settings-modal__note { @apply ml-1.5 font-semibold text-ink-subtle; }
.settings-modal__field { @apply mb-2 flex items-center gap-3 text-[12.5px] font-bold; }
.settings-modal__field > .settings-modal__label { @apply w-16 flex-none text-ink-muted; }
.settings-modal__field--inline { @apply mb-0; }
.settings-modal__password { @apply flex flex-1 items-center gap-1.5; }
.settings-modal__hint { @apply -mt-0.5 mb-2.5 ml-[76px] text-[11.5px] text-ink-subtle; }
.settings-modal__hint--off { @apply invisible; }
.settings-modal__status { @apply text-xs text-ink-muted; }
.settings-modal__status--bad { @apply text-danger; }
.settings-modal__row { @apply flex items-center gap-2; }
.settings-modal__row--between { @apply justify-between; }
.settings-modal__grow { @apply flex-1; }
.settings-modal__filter { @apply mb-1.5 mt-2.5; }
.settings-modal__add { @apply mt-2; }
.settings-modal__list { @apply max-h-[170px] overflow-auto rounded-xl border-[1.5px] border-line-strong p-1; }
.settings-modal__item { @apply flex min-h-[38px] items-center gap-2.5 rounded-lg px-2 py-[5px] hover:bg-soft; }
.settings-modal__model-id { @apply min-w-0 flex-1 truncate text-[12.5px] font-bold; }
.settings-modal__added { @apply text-[11.5px] text-ink-subtle; }
.settings-modal__empty { @apply p-3 text-center text-[12.5px] text-ink-subtle; }
.settings-modal__error { @apply mr-auto text-xs text-danger; }
.settings-modal__radio { @apply inline-flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-white hover:bg-hover; }
.settings-modal__radio-dot { @apply size-2 rounded-full bg-pink-deep; }
.settings-modal__price { @apply flex items-center gap-1 text-xs text-ink-muted; }
.settings-modal__price-input { @apply h-7 w-[84px] cursor-text rounded-lg border border-line-strong px-2 text-xs; }
</style>