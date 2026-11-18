// news-image-20261117 — "Sum up 17 November's world news in one image"
// Newspaper front page, 1024x1024 PNG, drawn from scratch with Node 22 stdlib only.
// No network, no deps. Deterministic: same input -> same bytes, every run.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Every glyph is 7 rows of 5 cells ('#' = ink, '.' = empty).
// All text is rendered uppercase (newspaper style); lowercase input is folded.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".....", "..##.", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", ".#..#", "#...#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
};

type RGB = [number, number, number];

const INK: RGB = [17, 17, 17];
const PAPER: RGB = [253, 252, 247];
const RED: RGB = [178, 24, 24];
const DARK: RGB = [20, 20, 22];
const GREY: RGB = [110, 110, 108];
const LIGHTGREY: RGB = [226, 224, 216];
const WHITE: RGB = [255, 255, 255];
const AMBER: RGB = [255, 176, 32];

const W = 1024;
const H = 1024;

function normText(s: string): string {
  return s
    .toUpperCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ");
}

class Canvas {
  data: Buffer;
  constructor() {
    this.data = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = PAPER[0];
      this.data[i * 3 + 1] = PAPER[1];
      this.data[i * 3 + 2] = PAPER[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w);
    const y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * W + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.data[i] = c[0];
        this.data[i + 1] = c[1];
        this.data[i + 2] = c[2];
        i += 3;
      }
    }
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, t, h, c);
  }
  // Bresenham line.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  // Midpoint circle outline.
  circle(cx: number, cy: number, r: number, c: RGB): void {
    let x = r;
    let y = 0;
    let err = 0;
    while (x >= y) {
      this.set(cx + x, cy + y, c);
      this.set(cx + y, cy + x, c);
      this.set(cx - y, cy + x, c);
      this.set(cx - x, cy + y, c);
      this.set(cx - x, cy - y, c);
      this.set(cx - y, cy - x, c);
      this.set(cx + y, cy - x, c);
      this.set(cx + x, cy - y, c);
      y += 1;
      err += 1 + 2 * y;
      if (2 * (err - x) + 1 > 0) {
        x -= 1;
        err += 1 - 2 * x;
      }
    }
  }
  // Filled disc.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }
  // Filled triangle (scanline).
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minY = Math.max(0, Math.min(y0, y1, y2));
    const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const xa = Math.max(0, Math.floor(Math.min(...xs)));
        const xb = Math.min(W - 1, Math.ceil(Math.max(...xs)));
        this.fillRect(xa, y, xb - xa + 1, 1, c);
      }
    }
  }

  // --- text ---------------------------------------------------------------
  textWidth(s: string, scale: number): number {
    const t = normText(s);
    if (t.length === 0) return 0;
    return t.length * 6 * scale - scale;
  }
  text(x: number, y: number, s: string, scale: number, c: RGB): void {
    const t = normText(s);
    let cx = x;
    for (const ch of t) {
      const g = FONT[ch] || FONT[" "];
      for (let row = 0; row < 7; row++) {
        const bits = g[row];
        for (let col = 0; col < 5; col++) {
          if (bits[col] === "#") {
            this.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }
  textCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(cx - Math.floor(this.textWidth(s, scale) / 2), y, s, scale, c);
  }
  // Greedy word wrap to a max pixel width. Returns lines.
  wrap(s: string, scale: number, maxW: number): string[] {
    const words = normText(s).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (this.textWidth(trial, scale) <= maxW || cur === "") {
        cur = trial;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  // Draw wrapped lines; returns y just below the last line.
  textBlock(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, gap = 4): number {
    const lines = this.wrap(s, scale, maxW);
    const lh = 7 * scale + gap;
    lines.forEach((ln, i) => this.text(x, y + i * lh, ln, scale, c));
    return y + lines.length * lh;
  }
}

// ---------------------------------------------------------------------------
// PNG encoding (pure stdlib: zlib deflate + manual chunk assembly, CRC32).
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    cv.data.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// PART 2 — newspaper front-page layout (17 November 2026).
// Geometry: 1024x1024, 28px side margins, content x 28..996 (968 wide).
// Every section is cursor-driven: each draw function returns the y just below
// what it drew, so text can never collide with the next block.
// ---------------------------------------------------------------------------
const MX = 28; // left margin
const MX1 = 996; // right edge of content
const CW = MX1 - MX; // 968

// Centered wrapped block: each line centered on cx. Returns y below last line.
function centeredBlock(cv: Canvas, cx: number, y: number, s: string, scale: number, maxW: number, c: RGB, gap = 4): number {
  const lines = cv.wrap(s, scale, maxW);
  const lh = 7 * scale + gap;
  lines.forEach((ln, i) => cv.textCentered(cx, y + i * lh, ln, scale, c));
  return y + lines.length * lh;
}

// Small red kicker label with a solid square bullet.
function kicker(cv: Canvas, x: number, y: number, s: string): void {
  cv.fillRect(x, y + 2, 10, 10, RED);
  cv.text(x + 16, y, s, 2, RED);
}

// --- icons (all vector, drawn from the part-1 primitives) -------------------
function drawRadar(cv: Canvas, cx: number, cy: number, r: number): void {
  const rings = [r, Math.floor(r * 0.72), Math.floor(r * 0.45)];
  for (const rr of rings) cv.circle(cx, cy, rr, INK);
  cv.hline(cx - r, cy, r * 2, INK);
  cv.vline(cx, cy - r, r * 2, INK);
  // sweep line, 45 degrees up-right
  const sx = Math.floor(r * 0.7);
  cv.line(cx, cy, cx + sx, cy - sx, RED);
  // blips: two red contacts, one dark
  cv.disc(cx + Math.floor(r * 0.4), cy - Math.floor(r * 0.3), 5, RED);
  cv.disc(cx - Math.floor(r * 0.55), cy + Math.floor(r * 0.2), 4, RED);
  cv.disc(cx + Math.floor(r * 0.1), cy + Math.floor(r * 0.55), 4, INK);
}

function drawBridge(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const deckY = y + Math.floor(h * 0.35);
  const towerL = x + Math.floor(w * 0.18);
  const towerR = x + Math.floor(w * 0.82);
  // towers
  cv.vline(towerL, y, deckY - y + 12, INK, 3);
  cv.vline(towerR, y, deckY - y + 12, INK, 3);
  // intact deck on both sides
  cv.hline(x, deckY, Math.floor(w * 0.32), INK, 3);
  cv.hline(x + Math.floor(w * 0.68), deckY, Math.floor(w * 0.32), INK, 3);
  // collapsed middle: arch pieces falling into the strait (red)
  const midX = x + Math.floor(w / 2);
  cv.line(x + Math.floor(w * 0.32), deckY, midX - 14, deckY + Math.floor(h * 0.42), RED);
  cv.line(midX + 14, deckY + Math.floor(h * 0.3), x + Math.floor(w * 0.68), deckY, RED);
  // water
  const wy = y + h - 6;
  for (let i = 0; i < 3; i++) {
    const yy = wy - i * 4;
    for (let xx = x; xx < x + w - 16; xx += 24) {
      cv.line(xx, yy, xx + 8, yy - 2, GREY);
      cv.line(xx + 8, yy - 2, xx + 16, yy, GREY);
    }
  }
}

function drawGlobe(cv: Canvas, cx: number, cy: number, r: number): void {
  cv.circle(cx, cy, r, INK);
  cv.circle(cx, cy, Math.floor(r * 0.6), INK);
  cv.hline(cx - r, cy, r * 2, INK);
  cv.vline(cx, cy - r, r * 2, INK);
  cv.line(cx - r + 4, cy - Math.floor(r * 0.55), cx + r - 4, cy - Math.floor(r * 0.55), GREY);
  cv.line(cx - r + 4, cy + Math.floor(r * 0.55), cx + r - 4, cy + Math.floor(r * 0.55), GREY);
}

function drawDownArrow(cv: Canvas, x: number, y: number, w: number, h: number, c: RGB): void {
  const mid = x + Math.floor(w / 2);
  cv.fillRect(mid - 3, y, 6, Math.floor(h * 0.55), c);
  cv.triangle(mid - Math.floor(w / 2), y + Math.floor(h * 0.5), mid + Math.floor(w / 2), y + Math.floor(h * 0.5), mid, y + h, c);
}

// --- masthead ---------------------------------------------------------------
function drawMasthead(cv: Canvas): number {
  cv.textCentered(512, 18, "THE WORLD TODAY", 7, INK);
  cv.fillRect(MX, 76, CW, 5, RED);
  cv.textCentered(512, 88, "TUESDAY, 17 NOVEMBER 2026", 3, INK);
  // One-sentence day summary (NEWS-FACTS.md section 7, verbatim, verified safe).
  const stand =
    "ON TUESDAY 17 NOVEMBER 2026, THE WORLD EDGED TOWARD WIDER WAR AS IRAN STRUCK " +
    "A US RADAR BASE IN BAHRAIN AND UKRAINE COLLAPSED PART OF THE CRIMEAN BRIDGE, " +
    "WHILE TRUMP MET THE QUAD IN MANILA AND WALL STREET SHED 849 POINTS AHEAD OF " +
    "NVIDIA'S RESULTS.";
  const y = centeredBlock(cv, 512, 116, stand, 2, CW, INK, 4);
  cv.fillRect(MX, y + 8, CW, 3, INK);
  cv.fillRect(MX, y + 13, CW, 1, INK);
  return y + 16;
}

// --- lead story: Iran drones hit US radar in Bahrain ------------------------
function drawLead(cv: Canvas, y0: number): number {
  const textW = 632;
  const boxX = 676;
  const boxW = 320;
  kicker(cv, MX, y0, "MIDDLE EAST");
  let y = y0 + 22;
  y = cv.textBlock(MX, y, "IRAN DRONES HIT US RADAR IN BAHRAIN", 4, textW, INK, 4);
  y += 8;
  y = cv.textBlock(MX, y, "THIRD BAHRAIN STRIKE IN FIVE DAYS; US HIT BACK AT QESHM", 2, textW, INK, 4);
  y += 6;
  y = cv.textBlock(MX, y, "NO CASUALTIES, BAHRAIN SAYS. TRUMP: IRAN WILL PAY A PRICE.", 2, textW, GREY, 4);
  // stat row: three mini-stats across the text column
  y += 10;
  const stats: [string, string][] = [
    ["3RD", "STRIKE ON US TARGETS IN BAHRAIN IN FIVE DAYS"],
    ["0", "CASUALTIES OR DAMAGE REPORTED"],
    ["QESHM", "US JETS HIT IRGC MISSILE SITE TUESDAY EVENING"],
  ];
  let statBottom = y;
  stats.forEach(([big, label], i) => {
    const sx = MX + i * 216;
    cv.text(sx, y, big, 3, RED);
    const b = cv.textBlock(sx, y + 27, label, 1, 200, INK, 3);
    if (b > statBottom) statBottom = b;
  });
  const yEnd = statBottom + 4;
  // radar illustration box, spanning the full lead height
  cv.fillRect(boxX, y0, boxW, 2, INK);
  cv.fillRect(boxX, yEnd - 2, boxW, 2, INK);
  cv.fillRect(boxX, y0, 2, yEnd - y0, INK);
  cv.fillRect(boxX + boxW - 2, y0, 2, yEnd - y0, INK);
  const rcx = boxX + Math.floor(boxW / 2);
  const rcy = y0 + Math.floor((yEnd - y0) / 2) - 8;
  drawRadar(cv, rcx, rcy, 78);
  cv.textCentered(rcx, yEnd - 20, "US RADAR - SHEIKH ISA AIR BASE", 1, GREY);
  return yEnd;
}

// --- two-column zone: Crimean Bridge (left) + Trump/Quad (right) ------------
function drawColumns(cv: Canvas, y0: number): number {
  const colW = 472;
  const leftX = MX;
  const rightX = 524;
  // left: Ukraine smashes Crimean Bridge
  kicker(cv, leftX, y0, "UKRAINE");
  let ly = y0 + 22;
  ly = cv.textBlock(leftX, ly, "UKRAINE SMASHES CRIMEAN BRIDGE", 3, colW, INK, 4);
  ly += 6;
  ly = cv.textBlock(leftX, ly, "ROAD ARCH COLLAPSED INTO THE KERCH STRAIT; SECOND NIGHT IN A ROW", 2, colW, INK, 4);
  ly += 4;
  ly = cv.textBlock(leftX, ly, "RUSSIA HIT KYIV BRIDGES IN REPLY", 2, colW, GREY, 4);
  ly += 10;
  drawBridge(cv, leftX, ly, colW, 56);
  ly += 56;
  // right: Trump at the Quad summit in Manila
  kicker(cv, rightX, y0, "DIPLOMACY");
  let ry = y0 + 22;
  ry = cv.textBlock(rightX, ry, "TRUMP AT QUAD SUMMIT IN MANILA", 3, colW, INK, 4);
  ry += 6;
  ry = cv.textBlock(rightX, ry, "FIRST QUAD LEADERS' MEETING IN TWO YEARS", 2, colW, INK, 4);
  ry += 4;
  ry = cv.textBlock(rightX, ry, "XI, TRUMP AND PUTIN MEET THURSDAY IN SHENZHEN", 2, colW, GREY, 4);
  ry += 10;
  drawGlobe(cv, rightX + 24, ry + 22, 20);
  const gy = cv.textBlock(rightX + 56, ry, "LEADERS: TRUMP, MODI, ALBANESE, TAKAICHI", 1, colW - 56, INK, 3);
  ry = Math.max(ry + 46, gy);
  const yEnd = Math.max(ly, ry);
  // gutter rule between the columns
  cv.fillRect(512, y0, 1, yEnd - y0, LIGHTGREY);
  return yEnd;
}

// --- markets strip: dark band, four cells -----------------------------------
function drawMarkets(cv: Canvas, y0: number): number {
  const bandH = 96;
  cv.fillRect(MX, y0, CW, bandH, DARK);
  cv.text(MX + 16, y0 + 10, "MARKETS - TUESDAY CLOSE", 2, WHITE);
  // [label, big number, sub-line, isDown]
  const cells: [string, string, string, boolean][] = [
    ["DOW", "-849", "-1.64%", true],
    ["S&P 500", "-1.03%", "LOWEST SINCE 29 JULY", true],
    ["NASDAQ", "-0.74%", "TECH SELLS OFF", true],
    ["VIX", "25.46", "+11.13%", false],
  ];
  cells.forEach((cell, i) => {
    const x = MX + 16 + i * 242;
    if (i > 0) cv.fillRect(x - 12, y0 + 34, 1, 52, GREY);
    cv.text(x, y0 + 34, cell[0], 2, LIGHTGREY);
    if (cell[3]) {
      drawDownArrow(cv, x, y0 + 54, 16, 18, RED);
    } else {
      // VIX spiked: up triangle in amber
      cv.triangle(x, y0 + 72, x + 16, y0 + 72, x + 8, y0 + 54, AMBER);
    }
    cv.text(x + 22, y0 + 52, cell[1], 4, WHITE);
    cv.text(x, y0 + 80, cell[2], 1, LIGHTGREY);
  });
  return y0 + bandH;
}

// --- bottom grid: 6 small stories, 2 columns x 3 rows -----------------------
function drawBottomGrid(cv: Canvas, y0: number): number {
  // [kicker, headline, deck]
  const cells: [string, string, string][] = [
    ["BRITAIN", "UK SANCTIONS 8 ISRAELI SETTLEMENT FIRMS", "ASSET FREEZES; AID-BLOCKING GROUP TZAV 9 ALSO HIT"],
    ["JAPAN", "JAPAN SCRAMBLES JETS OVER RUSSIAN PLANES", "TWO PLANES NEAR FUKUOKA; TOKYO PROTESTED"],
    ["YEMEN", "HOUTHIS ADVANCE AS GOVERNMENT FORCES RETREAT", "TROOPS PULLED BACK TO DEFEND ADEN"],
    ["CLIMATE - COP31", "DRAFT DEAL: $120BN A YEAR FOR CLIMATE BY 2035", "FASTER FOSSIL-FUEL PHASE-OUT SOUGHT"],
    ["FRANCE", "DEPARDIEU PLEADS GUILTY TO SEXUAL ASSAULT", "ACTOR DROPS APPEAL IN PARIS COURT"],
    ["SPORT", "INDIA WIN U19 ASIA CUP; GERMANY 5-0 NETHERLANDS", "LAST-BALL THRILLER IN OMAN"],
  ];
  const cellH = 60;
  const rowGap = 6;
  const colW = 472;
  cells.forEach((cell, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = MX + col * (colW + 24);
    const y = y0 + row * (cellH + rowGap);
    cv.fillRect(x, y, colW, 1, LIGHTGREY);
    cv.fillRect(x, y + 6, 8, 8, RED);
    cv.text(x + 12, y + 5, cell[0], 1, RED);
    cv.textBlock(x, y + 16, cell[1], 2, colW, INK, 3);
    // deck sits just under the headline, wherever the headline ends
    const lines = cv.wrap(cell[1], 2, colW).length;
    const deckY = y + 16 + lines * (14 + 3) + 2;
    cv.text(x, deckY, cell[2], 1, GREY);
  });
  return y0 + 3 * cellH + 2 * rowGap;
}

function drawFooter(cv: Canvas, y: number): void {
  cv.textCentered(
    512,
    y,
    "THE WORLD TODAY - TUESDAY 17 NOVEMBER 2026 - 11 STORIES FROM A DAY OF WAR, DIPLOMACY AND A MARKET ROUT",
    1,
    GREY,
  );
}

// --- main -------------------------------------------------------------------
function main(): void {
  const cv = new Canvas();
  let y = drawMasthead(cv);
  y += 12;
  y = drawLead(cv, y);
  cv.fillRect(MX, y + 10, CW, 3, INK);
  y += 22;
  y = drawColumns(cv, y);
  y += 12;
  y = drawMarkets(cv, y);
  y += 12;
  y = drawBottomGrid(cv, y);
  drawFooter(cv, y + 6);
  const png = encodePNG(cv);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  const outPath = path.join(outDir, "entry.png");
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, png);
  } catch (err) {
    console.error(`failed to write ${outPath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();


