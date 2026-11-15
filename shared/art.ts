/** 程序化占位插画（SVG）。未配置接口时，后端用它代替真实生成，方便演示。 */
const PALETTES = [
  ["#ffd1e1", "#f69ab4", "#c5c6ea", "#fff2b2"],
  ["#c5c6ea", "#8e92d6", "#ffd1e1", "#fff6dd"],
  ["#ffe9c7", "#ffb38a", "#f69ab4", "#c5e8d9"],
  ["#d6f0ff", "#8fb8f0", "#c5c6ea", "#ffd1e1"],
  ["#2a1f3d", "#6a4c93", "#ec5698", "#ffd37a"],
  ["#e4f6e9", "#8fd1a6", "#fff2b2", "#f69ab4"]
];

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function star(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r, ang = (Math.PI / 5) * i - Math.PI / 2;
    d += (i ? "L" : "M") + (cx + Math.cos(ang) * rad).toFixed(1) + " " + (cy + Math.sin(ang) * rad).toFixed(1);
  }
  return d + "Z";
}

export function makeArtSvg(seed: number, ratio: string): string {
  const [a, b] = ratio.split(":").map(Number);
  const w = a >= b ? 640 : Math.round(640 * a / b), h = a >= b ? Math.round(640 * b / a) : 640;
  const r = rng(seed), pal = PALETTES[Math.floor(r() * PALETTES.length)], dark = pal[0] === "#2a1f3d";
  const m = Math.min(w, h);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
  s += `<defs><linearGradient id="g" x1="0" y1="0" x2="${r().toFixed(2)}" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[2]}"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="${(m / 10).toFixed(0)}"/></filter></defs>`;
  s += `<rect width="${w}" height="${h}" fill="url(#g)"/><g filter="url(#b)" opacity=".8">`;
  for (let i = 0; i < 5; i++) s += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(m * (0.2 + r() * 0.3)).toFixed(0)}" fill="${pal[Math.floor(r() * 4)]}"/>`;
  s += `</g>`;
  s += `<circle cx="${(w * (0.28 + r() * 0.44)).toFixed(0)}" cy="${(h * (0.25 + r() * 0.2)).toFixed(0)}" r="${(m * (0.13 + r() * 0.08)).toFixed(0)}" fill="${pal[3]}" stroke="#362436" stroke-width="${(m / 110).toFixed(1)}"/>`;
  for (let i = 0; i < 3 + Math.floor(r() * 4); i++) s += `<path d="${star(r() * w, r() * h * 0.6, 6 + r() * 12)}" fill="${dark ? "#fff6dd" : "#fff"}" opacity="${(0.6 + r() * 0.4).toFixed(2)}"/>`;
  for (let k = 0; k < 2; k++) {
    const y = h * (0.62 + k * 0.14 + r() * 0.05);
    s += `<path d="M0 ${y.toFixed(0)} Q${(w * 0.25).toFixed(0)} ${(y - h * (0.1 + r() * 0.1)).toFixed(0)} ${(w * 0.5).toFixed(0)} ${y.toFixed(0)} T${w} ${(y - h * 0.02).toFixed(0)} V${h} H0Z" fill="${pal[k ? 2 : 1]}" stroke="#362436" stroke-width="${(m / 150).toFixed(1)}"/>`;
  }
  return s + `</svg>`;
}
