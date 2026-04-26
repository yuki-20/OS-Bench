#!/usr/bin/env node
// Pure-Node icon generator (no native deps). Generates branded PNG + ICO + ICNS-named PNG
// for the Tauri bundle.
//
// Run:  node scripts/gen-icons.js
//
// Replace these with proper artwork before shipping a real product. The .icns file is
// just a renamed PNG — for actual macOS builds, use a proper iconutil pipeline.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "apps/bench-desktop/src-tauri/icons");
fs.mkdirSync(outDir, { recursive: true });

const BRAND = [30, 27, 75, 255];   // ink-900
const ACCENT = [79, 70, 229, 255]; // brand-600
const INK = [255, 255, 255, 255];

// CRC table (RFC 1952) ----------------------------------------------------
const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = (crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
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

// Render a size×size image into a raw RGBA pixel buffer (no filter bytes).
function paint(size) {
  const px = Buffer.alloc(size * size * 4);
  // background = brand
  for (let i = 0; i < size * size; i++) {
    px[i * 4 + 0] = BRAND[0];
    px[i * 4 + 1] = BRAND[1];
    px[i * 4 + 2] = BRAND[2];
    px[i * 4 + 3] = BRAND[3];
  }
  // accent rounded border (simple approximation: rectangular border, corners clipped)
  const pad = Math.max(2, Math.floor(size / 8));
  const stroke = Math.max(1, Math.floor(size / 16));
  const radius = Math.floor(size / 6);
  function setPixel(x, y, c) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    px[o] = c[0];
    px[o + 1] = c[1];
    px[o + 2] = c[2];
    px[o + 3] = c[3];
  }
  function inRoundedRect(x, y) {
    if (x < pad || y < pad || x >= size - pad || y >= size - pad) return false;
    // corners
    const cx1 = pad + radius, cy1 = pad + radius;
    const cx2 = size - pad - 1 - radius, cy2 = size - pad - 1 - radius;
    if (x < cx1 && y < cy1) {
      const dx = cx1 - x, dy = cy1 - y;
      return dx * dx + dy * dy <= radius * radius;
    }
    if (x > cx2 && y < cy1) {
      const dx = x - cx2, dy = cy1 - y;
      return dx * dx + dy * dy <= radius * radius;
    }
    if (x < cx1 && y > cy2) {
      const dx = cx1 - x, dy = y - cy2;
      return dx * dx + dy * dy <= radius * radius;
    }
    if (x > cx2 && y > cy2) {
      const dx = x - cx2, dy = y - cy2;
      return dx * dx + dy * dy <= radius * radius;
    }
    return true;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRoundedRect(x, y) && !inRoundedRect(x - stroke, y) && !inRoundedRect(x + stroke, y) && !inRoundedRect(x, y - stroke) && !inRoundedRect(x, y + stroke)) {
        // we are NOT inside; skip
      }
    }
  }
  // Ring stroke: pixel is in stroke if it's inside outer rounded rect AND not inside inner rounded rect
  function inInner(x, y) {
    return (
      x >= pad + stroke &&
      y >= pad + stroke &&
      x < size - pad - stroke &&
      y < size - pad - stroke &&
      inRoundedRect(x, y)
    );
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRoundedRect(x, y) && !inInner(x, y)) {
        setPixel(x, y, ACCENT);
      }
    }
  }
  // "OB" mark — draw a filled square block in the center to suggest a logo without fonts
  const markSize = Math.floor(size * 0.48);
  const mx0 = Math.floor((size - markSize) / 2);
  const my0 = Math.floor((size - markSize) / 2);
  // O: ring on left half
  const halfW = Math.floor(markSize / 2) - 2;
  const ringStroke = Math.max(1, Math.floor(size / 22));
  const ocx = mx0 + halfW / 2;
  const ocy = my0 + markSize / 2;
  const orad = halfW / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - ocx;
      const dy = y - ocy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= orad * orad && d2 >= (orad - ringStroke) * (orad - ringStroke)) {
        setPixel(x, y, INK);
      }
    }
  }
  // B: simple two stacked rounded bumps on right half (approximate)
  const bx0 = mx0 + halfW + 4;
  const bx1 = bx0 + halfW;
  for (let y = my0; y < my0 + markSize; y++) {
    for (let x = bx0; x <= bx0 + ringStroke; x++) setPixel(x, y, INK);
  }
  // top bump
  const bumpRadius = Math.floor(markSize / 4) - 1;
  const bumpCx1 = bx0 + bumpRadius + ringStroke;
  const bumpCy1 = my0 + bumpRadius + 1;
  const bumpCx2 = bx0 + bumpRadius + ringStroke;
  const bumpCy2 = my0 + markSize - bumpRadius - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inBump1 =
        (x - bumpCx1) ** 2 + (y - bumpCy1) ** 2 <= bumpRadius ** 2 &&
        (x - bumpCx1) ** 2 + (y - bumpCy1) ** 2 >= (bumpRadius - ringStroke) ** 2;
      const inBump2 =
        (x - bumpCx2) ** 2 + (y - bumpCy2) ** 2 <= bumpRadius ** 2 &&
        (x - bumpCx2) ** 2 + (y - bumpCy2) ** 2 >= (bumpRadius - ringStroke) ** 2;
      if (inBump1 || inBump2) setPixel(x, y, INK);
    }
  }
  return px;
}

function makePng(size) {
  const px = paint(size);
  // build raw image data with filter bytes (filter type 0 = None per scanline)
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function makeIco(sizes) {
  // ICONDIR (6) + n * ICONDIRENTRY (16) + n * PNG bytes
  const pngs = sizes.map((s) => ({ s, data: makePng(s) }));
  const dirHeader = Buffer.alloc(6);
  dirHeader.writeUInt16LE(0, 0);          // reserved
  dirHeader.writeUInt16LE(1, 2);          // type 1=ICO
  dirHeader.writeUInt16LE(pngs.length, 4); // count

  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((p, i) => {
    const e = i * 16;
    entries.writeUInt8(p.s >= 256 ? 0 : p.s, e + 0);   // width (0 = 256)
    entries.writeUInt8(p.s >= 256 ? 0 : p.s, e + 1);   // height
    entries.writeUInt8(0, e + 2);                       // colors
    entries.writeUInt8(0, e + 3);                       // reserved
    entries.writeUInt16LE(1, e + 4);                    // planes
    entries.writeUInt16LE(32, e + 6);                   // bits per pixel
    entries.writeUInt32LE(p.data.length, e + 8);        // bytes in image data
    entries.writeUInt32LE(offset, e + 12);              // image offset
    offset += p.data.length;
  });
  return Buffer.concat([dirHeader, entries, ...pngs.map((p) => p.data)]);
}

const sizes = [
  { name: "32x32.png", s: 32 },
  { name: "128x128.png", s: 128 },
  { name: "icon.png", s: 256 },
];
for (const { name, s } of sizes) {
  const buf = makePng(s);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log("wrote", name, buf.length, "bytes");
}

const ico = makeIco([16, 24, 32, 48, 64, 128, 256]);
fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
console.log("wrote icon.ico", ico.length, "bytes");

// Tauri also references icon.icns. Ship a PNG-with-extension placeholder so the bundle
// step doesn't error on Windows builds. Replace with a proper .icns for macOS bundling.
fs.writeFileSync(path.join(outDir, "icon.icns"), makePng(512));
console.log("wrote icon.icns (placeholder)");

console.log("done →", outDir);
