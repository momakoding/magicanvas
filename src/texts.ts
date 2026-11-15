/** 这里存储一些正常的文案，如果你想定制的话，新建一个text_constant.ts然后按照要求写就行 */
export const FALLBACK = {
  moderationBlocked: "你的输入被内容审核拦下了，换个说法再试。",
  drawingLabel: "正在绘制中…"
} as const;
export type TextKey = keyof typeof FALLBACK;
export type TextOverrides = Partial<Record<TextKey, string>>;

// 只匹配 text_constant.ts 这一个文件：它不存在时 glob 结果为空，构建和运行都不受影响
const overrides = (import.meta.glob("./text_constant.ts", { eager: true })["./text_constant.ts"] as
  | { default?: TextOverrides }
  | undefined)?.default ?? {};

/** 取一条文案：优先用 text_constant 里的覆写，没有就回到官方文案 */
export const text = (key: TextKey): string => overrides[key] ?? FALLBACK[key];
