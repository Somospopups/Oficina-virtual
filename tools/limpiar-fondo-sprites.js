#!/usr/bin/env node
/**
 * 🧹 limpiar-fondo-sprites.js
 *
 * Problema que resuelve: algunos PNG de `sprites/` salieron del generador con un
 * fondo claro OPACO (blanco o gris con ruido) en vez de transparencia. En la
 * oficina esos frames se ven como un rectángulo blanco/gris que "agranda" al
 * personaje (pasó con ger_up, ger_wl2 y ger_wr2 en la v97).
 *
 * Qué hace: rellena desde el borde del lienzo y vuelve transparente solo lo que
 * es fondo. El contorno oscuro del personaje frena el relleno, así que los
 * blancos internos (suelas, ojos, remera) quedan intactos. Los archivos que ya
 * tienen fondo transparente NO se tocan.
 *
 * Uso:
 *   node tools/limpiar-fondo-sprites.js             # revisa y limpia sprites/
 *   node tools/limpiar-fondo-sprites.js --check     # solo reporta, no escribe
 *   node tools/limpiar-fondo-sprites.js sprites/x.png
 *
 * No depende de librerías externas (lee y escribe PNG a mano).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- Lectura / escritura de PNG (RGBA de 8 bits) ----------
function decodePNG(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: no es un PNG`);
  let o = 8, W = 0, H = 0, depth = 0, color = 0;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8);
    const data = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); depth = data[8]; color = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8) throw new Error(`${file}: solo se soporta 8 bits por canal`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[color];
  if (!ch) throw new Error(`${file}: tipo de color ${color} no soportado (usá RGBA)`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ch, stride = W * ch;
  const out = Buffer.alloc(H * stride);
  let pos = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    line.copy(cur);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, bb = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (ft === 1) v += a; else if (ft === 2) v += bb; else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) {
        const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[x] = v & 255;
    }
  }
  // normaliza a RGBA
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const s = i * ch, d = i * 4;
    if (ch === 4) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = out[s + 3]; }
    else if (ch === 3) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255; }
    else if (ch === 1) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255; }
    else { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1]; }
  }
  return { W, H, buf: rgba };
}
let CRC_T = null;
function crc32(buf) {
  if (!CRC_T) {
    CRC_T = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_T[(crc ^ buf[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
}
function encodePNG(W, H, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Detección y limpieza ----------
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function pdist(a, b) {
  const dr = (lin(a[0]) - lin(b[0])) * 255, dg = (lin(a[1]) - lin(b[1])) * 255, db = (lin(a[2]) - lin(b[2])) * 255;
  return Math.sqrt(dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11);
}
// Cuánto del marco es "fondo claro opaco" (0..1). >25% ⇒ hay fondo para limpiar.
function marcoClaroOpaco({ W, H, buf }) {
  let claro = 0, n = 0;
  const chk = (x, y) => {
    const i = (y * W + x) * 4, a = buf[i + 3];
    n++;
    if (a > 200 && lum(buf[i], buf[i + 1], buf[i + 2]) >= 140 && sat(buf[i], buf[i + 1], buf[i + 2]) <= 60) claro++;
  };
  for (let x = 0; x < W; x++) for (let y = 0; y < 3; y++) { chk(x, y); chk(x, H - 1 - y); }
  for (let y = 0; y < H; y++) for (let x = 0; x < 3; x++) { chk(x, y); chk(W - 1 - x, y); }
  return claro / n;
}
const TOL = 62, T0 = 18;
function limpiar({ W, H, buf }) {
  const out = new Uint8Array(buf);
  const idx = (x, y) => y * W + x;
  const rgb = (id) => [out[id * 4], out[id * 4 + 1], out[id * 4 + 2]];
  // 1) semillas: colores claros del marco
  const seeds = [];
  const seed = (x, y) => {
    const id = idx(x, y), a = out[id * 4 + 3];
    if (a <= 8) return;
    const [r, g, b] = rgb(id);
    if (lum(r, g, b) < 140 || sat(r, g, b) > 50) return;
    if (!seeds.some((s) => pdist([r, g, b], s) < 26)) seeds.push([r, g, b]);
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, 1); seed(x, H - 1); seed(x, H - 2); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(1, y); seed(W - 1, y); seed(W - 2, y); }
  // 2) relleno desde el borde: solo avanza por pixeles claros o ya transparentes
  const seen = new Uint8Array(W * H);
  const q = [];
  for (let x = 0; x < W; x++) q.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) q.push(0, y, W - 1, y);
  let quitados = 0;
  for (let head = 0; head < q.length; head += 2) {
    const x = q[head], y = q[head + 1];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const id = idx(x, y);
    if (seen[id]) continue;
    const a = out[id * 4 + 3];
    if (a <= 8) { seen[id] = 1; out[id * 4 + 3] = 0; quitados++; q.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1); continue; }
    const [r, g, b] = rgb(id);
    if (lum(r, g, b) < 120 || sat(r, g, b) > 70) continue; // contorno/cuerpo: frena
    let dmin = 1e9;
    for (const s of seeds) dmin = Math.min(dmin, pdist([r, g, b], s));
    if (dmin > TOL) continue;
    seen[id] = 1;
    const na = dmin <= T0 ? 0 : Math.round(255 * (dmin - T0) / (TOL - T0));
    if (na < out[id * 4 + 3]) { out[id * 4 + 3] = na; }
    if (na < 250) quitados++;
    q.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return { buf: out, quitados };
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const soloCheck = args.includes('--check');
const explicitos = args.filter((a) => !a.startsWith('--'));
const raiz = path.resolve(__dirname, '..');
const archivos = explicitos.length
  ? explicitos
  : fs.readdirSync(path.join(raiz, 'sprites'))
      .filter((f) => f.endsWith('.png'))
      .map((f) => path.join('sprites', f));

let limpiados = 0;
for (const rel of archivos) {
  const file = path.isAbsolute(rel) ? rel : path.join(raiz, rel);
  const img = decodePNG(file);
  const pct = marcoClaroOpaco(img);
  const nombre = path.relative(raiz, file);
  if (pct <= 0.25) {
    console.log(`✔ ${nombre.padEnd(30)} sin fondo opaco (marco claro ${(pct * 100).toFixed(1)}%) — no se toca`);
    continue;
  }
  const { buf, quitados } = limpiar(img);
  let cambiados = 0;
  for (let i = 0; i < img.W * img.H; i++) if (Math.abs(buf[i * 4 + 3] - img.buf[i * 4 + 3]) > 24) cambiados++;
  const after = marcoClaroOpaco({ W: img.W, H: img.H, buf });
  const linea = `🧹 ${nombre.padEnd(30)} marco claro ${(pct * 100).toFixed(0)}% → ${(after * 100).toFixed(0)}%`
    + ` · alpha cambiada en ${(100 * cambiados / (img.W * img.H)).toFixed(1)}% de los pixeles (${quitados} del fondo)`;
  if (soloCheck) { console.log(linea + ' [--check: no se escribió]'); continue; }
  fs.writeFileSync(file, encodePNG(img.W, img.H, buf));
  console.log(linea + ' ✅');
  limpiados++;
}
if (!soloCheck) console.log(limpiados ? `\nListo: ${limpiados} sprite(s) limpiados.` : '\nNada para limpiar.');
