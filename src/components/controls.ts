import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { AUTO, RATIOS, SIZES, sizeLabel } from "@shared";
import { studio } from "@/stores";

/** UiSelect 的一个选项 */
export interface Opt { value: string; label: string }

/** 模型下拉框：id 加单张估算价格 */
export const modelOptions = computed<Opt[]>(() => studio.settings!.models.map(m => ({ value: m.id, label: `${m.id} · $${m.price.toFixed(3)}` })));

/** 画幅下拉框。auto 版带「自动」（跟随参考图）；plain 版给设置弹窗用，默认画幅必须是具体值 */
export const autoRatioOptions: Opt[] = [{ value: AUTO, label: "自动" }, ...RATIOS.map(r => ({ value: r, label: r }))];
export const plainRatioOptions: Opt[] = RATIOS.map(r => ({ value: r, label: r }));

/** 尺寸下拉框：像素标签随画幅变，ratio 是当前的画幅 */
export const makeSizeOptions = (ratio: MaybeRefOrGetter<string>) =>
  computed<Opt[]>(() => SIZES.map(s => ({ value: s, label: sizeLabel(toValue(ratio), s) })));

/** 把列表里的一项向前/向后移一位；不在列表里或已在边界时不动，返回 undefined */
export function moveItem(list: string[], id: string, delta: number): string[] | undefined {
  const next = [...list], i = next.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= next.length) return undefined;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
