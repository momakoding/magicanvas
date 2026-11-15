import type { ModelDef } from "./types";

/** 首次使用时的模型列表。price 为单张估算价格（美元），可在设置里改。 */
export const DEFAULT_MODELS: ModelDef[] = [
  { id: "image-2.5", price: 0.093 },
  { id: "NanoBanana", price: 0.045 },
  { id: "gpt-image-2", price: 0.08 }
];

/** 画幅选项。具体哪个模型支持哪些画幅，接入真实接口时在后端再映射。 */
export const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

/** 画面尺寸档位。像素数由画幅和档位换算，按 32 取整，只是估算。 */
export const SIZES = ["1K", "2K", "4K"];
const SIZE_SCALE: Record<string, number> = { "1K": 1, "2K": 2, "4K": 4 };

/** 画幅和尺寸都选「自动」时，由接口自己决定（size 以 "auto" 发给接口）。前端用参考图的画幅摆放节点。 */
export const AUTO = "auto";
export const validSize = (s: string) => s === AUTO || SIZES.includes(s);

/** 把 "a:b" 画幅拆成宽高两个数 */
export const ratioWH = (ratio: string): [number, number] => ratio.split(":").map(Number) as [number, number];

export function pixelSize(ratio: string, size: string): [number, number] {
  const [a, b] = ratioWH(ratio), area = (1024 * (SIZE_SCALE[size] ?? 1)) ** 2;
  const r = (n: number) => Math.max(32, Math.round(n / 32) * 32);
  return [r(Math.sqrt(area * a / b)), r(Math.sqrt(area * b / a))];
}
export const sizeLabel = (ratio: string, size: string) => {
  if (size === AUTO) return "自动";
  const [w, h] = pixelSize(ratio, size);
  return `${size} · ${w}×${h}`;
};

/** 画布节点的目标面积：按它换算长宽，不同画幅视觉份量接近 */
const NODE_AREA = 48000;

/** 按固定面积换算画布上的节点尺寸，不同画幅视觉份量接近。 */
export function nodeSize(ratio: string): [number, number] {
  const [a, b] = ratioWH(ratio);
  const s = Math.sqrt(NODE_AREA / (a * b));
  return [Math.round(a * s), Math.round(b * s)];
}

/** 按图片实际宽高比换算节点尺寸（面积同 nodeSize），最小不小于 48px */
export function imageNodeSize(pw: number, ph: number): [number, number] {
  const s = Math.sqrt(NODE_AREA / (pw * ph));
  return [Math.max(48, Math.round(pw * s)), Math.max(48, Math.round(ph * s))];
}
