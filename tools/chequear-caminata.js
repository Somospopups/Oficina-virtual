#!/usr/bin/env node
/**
 * 🧭 chequear-caminata.js
 *
 * Problema que resuelve: en un ciclo de caminata, todos los frames tienen que
 * mirar para el MISMO lado. Si uno se escapa del lado, el personaje da media vuelta
 * a mitad de la animación. Pasó con Ger: `ger_wl2.png` y `ger_wr2.png` estaban
 * guardados al revés, así que el ciclo de la izquierda era IZQ -> DER -> IZQ -> DER
 * y el personaje giraba dos veces por vuelta (v100).
 *
 * Qué hace: lee los ciclos de caminata directamente de `game.js` (así el chequeo
 * cubre los frames que se agreguen después), y de cada PNG deduce hacia dónde mira
 * el personaje mirando de dónde están los ojos dentro de la cabeza. Si un ciclo
 * mezcla direcciones, lo dice y sale con código 1.
 *
 * Uso:
 *   node tools/chequear-caminata.js          # revisa y avisa
 *   node tools/chequear-caminata.js --fix    # solo informa qué archivos están
 *                                            # intercambiados (no los cambia)
 *
 * No depende de librerías externas (lee los PNG a mano, como limpiar-fondo-sprites.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- Lectura de PNG (RGBA de 8 bits) ----------
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
  if (!ch) throw new Error(`${file}: tipo de color ${color} no soportado`);
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
  return { W, H, ch, buf: out };
}

// ---------- Hacia dónde mira ----------
// Los ojos son lo único casi blanco en la cabeza (la remera es negra y la piel
// bronceada), así que su posición dentro del ancho de la cabeza dice hacia dónde
// está la cara. Se mira solo el 35% de arriba, que es donde vive la cabeza.
function haciaDondeMira(png) {
  const { W, H, ch, buf } = png;
  const lim = Math.floor(H * 0.35);
  let x0 = Infinity, x1 = -1;
  const px = (x, y) => {
    const o = (y * W + x) * ch;
    return [buf[o], buf[o + 1], buf[o + 2], ch === 4 ? buf[o + 3] : 255];
  };
  for (let y = 0; y < lim; y++) {
    for (let x = 0; x < W; x++) {
      if (px(x, y)[3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
  }
  if (x1 < x0) return { lado: 'VACIO', pos: 0.5 };
  const ancho = x1 - x0 + 1;
  let sx = 0, n = 0;
  for (let y = 0; y < lim; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = px(x, y);
      if (a > 128 && r > 225 && g > 225 && b > 225) { sx += x; n++; }
    }
  }
  if (n < 6) return { lado: 'ESPALDA', pos: 0.5 };   // de espaldas no hay ojos: no se juzga
  const pos = (sx / n - x0) / ancho;                 // 0 = ojo al borde izq, 1 = al der
  if (Math.abs(pos - 0.5) < 0.12) return { lado: 'FRENTE', pos };
  return { lado: pos < 0.5 ? 'IZQ' : 'DER', pos };
}

// ---------- Ciclos, leídos de game.js ----------
function leerCiclos(raiz) {
  const src = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
  // nombre de variable -> archivo PNG, para los frames declarados aparte
  const vars = {};
  for (const m of src.matchAll(/\b(\w+)\s*=\s*img\('([^']+)'\)/g)) vars[m[1]] = m[2];
  for (const m of src.matchAll(/const\s+([\w,\s]+?)\s*=\s*img\(([^)]*)\)/g)) {
    const archivos = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .forEach((v, i) => { if (archivos[i]) vars[v] = archivos[i]; });
  }
  const ciclos = [];
  for (const bloque of src.matchAll(/walkSources\.(\w+)\s*=\s*\{([^}]*)\}/g)) {
    const [, char, cuerpo] = bloque;
    for (const d of cuerpo.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
      const dir = d[1];
      const frames = [...d[2].matchAll(/'([^']+)'|(\b\w+\b)/g)]
        .map((t) => (t[1] ? t[1] : vars[t[2]]))
        .filter(Boolean);
      if (frames.length) ciclos.push({ char, dir, frames });
    }
  }
  return ciclos;
}

// ---------- CLI ----------
const raiz = path.resolve(__dirname, '..');
const ciclos = leerCiclos(raiz);
if (!ciclos.length) {
  console.log('No encontré ciclos de caminata en game.js.');
  process.exit(0);
}

const cache = {};
const info = (nombre) => {
  if (!cache[nombre]) {
    const f = path.join(raiz, 'sprites', `${nombre}.png`);
    cache[nombre] = fs.existsSync(f)
      ? haciaDondeMira(decodePNG(f))
      : { lado: 'FALTA', pos: 0.5 };
  }
  return cache[nombre];
};

let malos = 0;
console.log('🧭 Dirección de los frames de caminata\n');
for (const { char, dir, frames } of ciclos) {
  const res = frames.map((f) => ({ f, ...info(f) }));
  // ESPALDA y FALTA no cuentan: solo importan los frames que se ven de perfil/frente
  const juzgables = res.filter((r) => r.lado === 'IZQ' || r.lado === 'DER');
  const lados = new Set(juzgables.map((r) => r.lado));
  const linea = res.map((r) => `${r.f}(${r.lado})`).join('  ');
  if (lados.size <= 1) {
    const nombre = [...lados][0] || '(sin frames juzgables)';
    const esperado = dir === 'left' ? 'IZQ' : dir === 'right' ? 'DER' : null;
    const mal = esperado && [...lados][0] && [...lados][0] !== esperado;
    console.log(`  ${mal ? '⚠️ ' : '✅ '}${char}/${dir.padEnd(5)}  ${nombre.padEnd(7)}  ${linea}`);
    if (mal) malos++;
  } else {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEZCLA      ${linea}`);
    console.log(`       el personaje da media vuelta a mitad del ciclo`);
    // qué archivos habría que intercambiar
    const mayor = lado => juzgables.filter(r => r.lado === lado).map(r => r.f);
    console.log(`       para el ciclo "${dir}" deberían mirar todos ${dir === 'left' ? 'a la IZQ' : 'a la DER'}`);
    console.log(`       hoy en este ciclo: miran IZQ -> [${mayor('IZQ').join(', ')}] · miran DER -> [${mayor('DER').join(', ')}]`);
    malos++;
  }
}

console.log('');
if (malos) {
  console.log(`❌ ${malos} ciclo(s) con el personaje girando.`);
  console.log('   Arreglo: intercambiar los archivos de sprites/ para que el nombre');
  console.log('   (_wl* = izquierda, _wr* = derecha) coincida con el dibujo, y subir el');
  console.log('   ?v= de game.js para que los navegadores no sirvan los PNG viejos.');
  process.exit(1);
}
console.log('✅ Todos los ciclos miran para un solo lado.');
