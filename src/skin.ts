import { PLACEHOLDER_URI } from "@/assets";

/** 关于页里附加的段落，皮肤可以用它放自己的说明与版权声明 */
export interface AboutSection { title: string; paragraphs: string[] }

export interface Skin {
  brand: string;
  /** 品牌名后面的副标题，没有就留空 */
  subtitle: string;
  tagline: string;
  mascotUri: string;
  drawingUri: string;
  aboutSections: AboutSection[];
}

/** 皮肤只是一个放在项目根目录 skin/ 里的数据包（skin.json 加图片），不含任何代码。skin/ 被 gitignore，不会进入本仓库 */
const DEFAULT_SKIN: Skin = {
  brand: "Image Canvas",
  subtitle: "",
  tagline: "一块用来生成图片的无限画布。在画布上写下想法，它会把想法画出来；生成的图片可以继续拖动、收藏，也可以当作参考图接着生成。",
  mascotUri: PLACEHOLDER_URI,
  drawingUri: "/img/drawing.svg",
  aboutSections: []
};

// 两个 glob 在 skin/ 不存在时都为空，构建和运行都不受影响
const configs = import.meta.glob<unknown>("../skin/skin.json", { eager: true, import: "default" });
const files = import.meta.glob<string>("../skin/*.{svg,png,gif,webp,jpg}", { eager: true, query: "?url", import: "default" });

const asString = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);
const asFile = (value: unknown): string | undefined => {
  const name = asString(value);
  return name ? files[`../skin/${name}`] : undefined;
};
const asSections = (value: unknown): AboutSection[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const { title, paragraphs } = item as Record<string, unknown>;
    const lines = Array.isArray(paragraphs) ? paragraphs.filter((p): p is string => typeof p === "string") : [];
    return typeof title === "string" && lines.length ? [{ title, paragraphs: lines }] : [];
  });
};

const raw = configs["../skin/skin.json"];
const config = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

export const skin: Skin = {
  brand: asString(config.brand) ?? DEFAULT_SKIN.brand,
  subtitle: asString(config.subtitle) ?? DEFAULT_SKIN.subtitle,
  tagline: asString(config.tagline) ?? DEFAULT_SKIN.tagline,
  mascotUri: asFile(config.mascot) ?? DEFAULT_SKIN.mascotUri,
  drawingUri: asFile(config.drawing) ?? DEFAULT_SKIN.drawingUri,
  aboutSections: asSections(config.aboutSections)
};

/** 浏览器标签页标题 */
export const skinTitle = skin.subtitle ? `${skin.brand} · ${skin.subtitle}` : skin.brand;
