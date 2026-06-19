#!/usr/bin/env node
/**
 * Dependency-free brand asset generator (no canvas/sharp). Rasterizes the
 * Faith Companion mark — a candle-gold open book on warm-midnight ink — and
 * encodes PNGs with node:zlib. Produces PWA icons, the Apple touch icon, and a
 * social/OG card.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const NAVY = [23, 19, 7]; // #171307
const GOLD = [230, 195, 100]; // #e6c364
const GOLD_DEEP = [201, 168, 76]; // #c9a84c

// ---- tiny raster surface (RGBA) ----
function surface(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function px(s, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  const i = (y * s.w + x) * 4;
  s.data[i] = r;
  s.data[i + 1] = g;
  s.data[i + 2] = b;
  s.data[i + 3] = a;
}
function fillRect(s, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(s, xx, yy, c);
}
function fillRoundRect(s, x, y, w, h, r, c) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const dx = Math.min(xx, w - 1 - xx);
      const dy = Math.min(yy, h - 1 - yy);
      if (dx < r && dy < r) {
        const cx = r - dx, cy = r - dy;
        if (cx * cx + cy * cy > r * r) continue;
      }
      px(s, x + xx, y + yy, c);
    }
  }
}
function fillPoly(s, pts, c) {
  const ys = pts.map((p) => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(s.h - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k]));
      const xb = Math.min(s.w - 1, Math.round(xs[k + 1]));
      for (let x = xa; x <= xb; x++) px(s, x, y, c);
    }
  }
}

// The open-book mark, centered at (cx, cy), sized by u (≈ glyph half-width).
function drawMark(s, cx, cy, u) {
  const topRise = 0.16 * u;
  // Left page (slight upward curve toward the spine).
  fillPoly(
    s,
    [
      [cx - 1.05 * u, cy - 0.42 * u],
      [cx - 0.05 * u, cy - 0.62 * u],
      [cx - 0.05 * u, cy + 0.5 * u],
      [cx - 1.05 * u, cy + 0.62 * u],
    ],
    GOLD,
  );
  // Right page (mirror).
  fillPoly(
    s,
    [
      [cx + 0.05 * u, cy - 0.62 * u],
      [cx + 1.05 * u, cy - 0.42 * u],
      [cx + 1.05 * u, cy + 0.62 * u],
      [cx + 0.05 * u, cy + 0.5 * u],
    ],
    GOLD,
  );
  // Spine shadow.
  fillRect(s, Math.round(cx - 0.035 * u), Math.round(cy - 0.6 * u), Math.max(2, Math.round(0.07 * u)), Math.round(1.15 * u), NAVY);
  // Page text-lines (navy) for legibility at small sizes.
  const lh = 0.16 * u;
  for (let i = 0; i < 3; i++) {
    const ly = cy - 0.18 * u + i * lh;
    fillRect(s, Math.round(cx - 0.9 * u), Math.round(ly), Math.round(0.7 * u), Math.max(1, Math.round(0.035 * u)), NAVY);
    fillRect(s, Math.round(cx + 0.2 * u), Math.round(ly - 0.02 * u), Math.round(0.7 * u), Math.max(1, Math.round(0.035 * u)), NAVY);
  }
  void topRise;
}

function icon(size, { maskable } = {}) {
  const s = surface(size, size);
  if (maskable) {
    fillRect(s, 0, 0, size, size, NAVY); // full bleed for OS masking
  } else {
    fillRoundRect(s, 0, 0, size, size, Math.round(size * 0.22), NAVY);
  }
  drawMark(s, size / 2, size * 0.5, size * 0.3);
  // gold baseline rule under the book
  fillRect(s, Math.round(size * 0.3), Math.round(size * 0.7), Math.round(size * 0.4), Math.max(2, Math.round(size * 0.02)), GOLD_DEEP);
  return s;
}

function og() {
  const W = 1200, H = 630;
  const s = surface(W, H);
  fillRect(s, 0, 0, W, H, NAVY);
  // soft band
  fillRect(s, 0, H - 8, W, 8, GOLD_DEEP);
  drawMark(s, W / 2, H * 0.42, 150);
  // gold rule
  fillRect(s, Math.round(W / 2 - 140), Math.round(H * 0.74), 280, 4, GOLD);
  return s;
}

// ---- PNG encode (RGBA, 8-bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(s) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.w, 0);
  ihdr.writeUInt32BE(s.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // rows with filter byte 0
  const raw = Buffer.alloc(s.h * (1 + s.w * 4));
  for (let y = 0; y < s.h; y++) {
    raw[y * (1 + s.w * 4)] = 0;
    s.data.subarray(y * s.w * 4, (y + 1) * s.w * 4).forEach((b, i) => {
      raw[y * (1 + s.w * 4) + 1 + i] = b;
    });
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const out = (name, s) => {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), encodePNG(s));
  console.log("wrote public/" + name);
};

out("icon-192.png", icon(192));
out("icon-512.png", icon(512));
out("icon-maskable-512.png", icon(512, { maskable: true }));
out("apple-touch-icon.png", icon(180, { maskable: true }));
out("og-image.png", og());
console.log("done");
