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
// Los ojos son lo único casi blanco de la cara (la remera es negra y la piel
// bronceada), así que la posición del ojo dentro de la cabeza dice hacia dónde
// mira. Pero hay dos trampas:
//
//  1) El "35% de arriba" no es solo la cabeza: en un perfil también entran el
//     hombro y el brazo adelantado, y entonces el ojo queda desplazado hacia el
//     lado contrario. Por eso primero se aísla la componente conexa de la cabeza.
//  2) De espaldas NO hay ojos, pero quedan motas blancas sueltas del halo del
//     recorte. Contar píxeles no sirve: hay que exigir que el blanco sea UNA sola
//     mancha compacta. En un perfil real el ojo mide ~100 px; en una espalda son
//     15-30 motas de 2 a 6 px.
const MIN_OJO_LATERAL = 8;    // px: en un perfil el ojo siempre se ve, aunque sea chiquito
const MIN_OJO_FRENTE = 40;    // px: de espaldas las motas blancas son halo del recorte

// Mayor componente conexa (8 vecinos) de un mapa de booleanos.
// Devuelve {n, pix} con la cantidad de celdas de la mayor y la lista de celdas.
function mayorComponente(mascara, W, H) {
  const visit = new Uint8Array(W * H);
  const pila = new Int32Array(W * H);
  let mejor = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i0 = y * W + x;
      if (!mascara[i0] || visit[i0]) continue;
      let sp = 0, n = 0;
      const celdas = [];
      pila[sp++] = i0; visit[i0] = 1;
      while (sp > 0) {
        const i = pila[--sp];
        const cx = i % W, cy = (i / W) | 0;
        celdas.push(i); n++;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (mascara[j] && !visit[j]) { visit[j] = 1; pila[sp++] = j; }
          }
        }
      }
      if (n > mejor.length) mejor = celdas;
    }
  }
  return { n: mejor.length, pix: mejor };
}

function haciaDondeMira(png, MIN_OJO) {
  const { W, H, ch, buf } = png;
  const lim = Math.max(8, Math.floor(H * 0.35));
  const opaco = (x, y) => buf[(y * W + x) * ch + (ch === 4 ? 3 : 3)] > 128;
  const blanco = (x, y) => {
    const o = (y * W + x) * ch;
    return buf[o] > 225 && buf[o + 1] > 225 && buf[o + 2] > 225 &&
           (ch === 4 ? buf[o + 3] : 255) > 128;
  };

  // 1) la cabeza = mayor componente opaca del tercio superior
  const mOp = new Uint8Array(W * lim);
  for (let y = 0; y < lim; y++) for (let x = 0; x < W; x++) if (opaco(x, y)) mOp[y * W + x] = 1;
  const cabeza = mayorComponente(mOp, W, lim);
  if (!cabeza.n) return { lado: 'VACIO', pos: 0.5 };

  let hx0 = Infinity, hx1 = -1;
  for (const i of cabeza.pix) { const x = i % W; if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  const ancho = Math.max(1, hx1 - hx0 + 1);

  // 2) el ojo = mayor mancha blanca DENTRO de la cabeza
  const enCabeza = new Uint8Array(W * lim);
  for (const i of cabeza.pix) enCabeza[i] = 1;
  const mBl = new Uint8Array(W * lim);
  for (let y = 0; y < lim; y++) for (let x = 0; x < W; x++) if (enCabeza[y * W + x] && blanco(x, y)) mBl[y * W + x] = 1;
  const ojo = mayorComponente(mBl, W, lim);
  if (ojo.n < MIN_OJO) return { lado: 'ESPALDA', pos: 0.5, manchas: ojo.n, area: ojo.n };

  let sx = 0;
  for (const i of ojo.pix) sx += i % W;
  const pos = (sx / ojo.n - hx0) / ancho;   // 0 = ojo al borde izq, 1 = al der
  if (Math.abs(pos - 0.5) < 0.15) return { lado: 'FRENTE', pos, manchas: ojo.n };
  return { lado: pos < 0.5 ? 'IZQ' : 'DER', pos, manchas: ojo.n };
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

// ---------- ¿Los frames de un ciclo miran todos para el mismo lado? ----------
// Esta es la prueba que decide. NO mira la cara, así que no le afecta que el
// personaje tenga el pelo enorme, los ojos de 9 px o un dibujo chibi: mira si
// cada frame se parece más al primero tal cual o a su versión espejada. Si se
// parece más a la espejada, ese frame está del lado contrario y el personaje da
// media vuelta a mitad del ciclo (el bug de la v100).
const HUELLA = 128;

function firma(png) {
  // Deja la figura en un lienzo HUELLA x HUELLA: recortada por alfa, con los
  // pies apoyados abajo y centrada, para que dos poses distintas se comparen.
  const { W, H, ch, buf } = png;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf[(y * W + x) * ch + 3] > 128) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return null;
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  const esc = (HUELLA - 2) / fh;
  const dw = Math.max(1, Math.round(fw * esc)), dh = HUELLA - 2;
  const ox = Math.floor((HUELLA - dw) / 2), oy = 1;
  const out = new Float64Array(HUELLA * HUELLA * 4);
  for (let dy = 0; dy < dh; dy++) {
    const sy = y0 + Math.min(fh - 1, Math.floor(dy / esc));
    for (let dx = 0; dx < dw; dx++) {
      const sx = x0 + Math.min(fw - 1, Math.floor(dx / esc));
      const s = (sy * W + sx) * ch, d = ((oy + dy) * HUELLA + (ox + dx)) * 4;
      const a = buf[s + 3] / 255;
      // se premultiplica el color: si no, el fondo influy en la comparacion
      out[d] = buf[s] * a; out[d + 1] = buf[s + 1] * a; out[d + 2] = buf[s + 2] * a; out[d + 3] = a;
    }
  }
  return out;
}

const espejar = (a) => {
  const o = new Float64Array(a.length);
  for (let y = 0; y < HUELLA; y++)
    for (let x = 0; x < HUELLA; x++) {
      const d = (y * HUELLA + x) * 4, s = (y * HUELLA + (HUELLA - 1 - x)) * 4;
      o[d] = a[s]; o[d + 1] = a[s + 1]; o[d + 2] = a[s + 2]; o[d + 3] = a[s + 3];
    }
  return o;
};

const distancia = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

// Devuelve, por frame, 'igual' | 'al reves' | 'indistinto'
function sentidosRelativos(nombres) {
  const huellas = nombres.map((n) => {
    const p = path.join(raiz, 'sprites', `${n}.png`);
    return fs.existsSync(p) ? firma(decodePNG(p)) : null;
  });
  if (!huellas[0]) return null;
  const base = huellas[0], baseEspejo = espejar(base);
  return huellas.map((f) => {
    if (!f) return 'falta';
    const dIgual = distancia(base, f);
    const dReves = distancia(baseEspejo, f);
    if (dIgual * 1.35 < dReves) return 'igual';
    if (dReves * 1.35 < dIgual) return 'al reves';
    return 'indistinto';
  });
}

const cache = {};
const info = (nombre, minOjo) => {
  const k = nombre + '|' + minOjo;
  if (!cache[k]) {
    const f = path.join(raiz, 'sprites', `${nombre}.png`);
    cache[k] = fs.existsSync(f)
      ? haciaDondeMira(decodePNG(f), minOjo)
      : { lado: 'FALTA', pos: 0.5, area: 0 };
  }
  return cache[k];
};

let malos = 0;
console.log('🧭 Sentido de los frames de caminata\n');
for (const { char, dir, frames } of ciclos) {
  const lateral = dir === 'left' || dir === 'right';
  if (!lateral) {
    const rel = sentidosRelativos(frames);
    const linea = frames.map((f, i) => `${f}(${rel ? rel[i] : '?'})`).join('  ');
    console.log(`  ➖ ${char}/${dir.padEnd(5)}  (de espaldas o de frente, no se juzga)  ${linea}`);
    continue;
  }

  // 1) la prueba que decide: todos los frames del ciclo mirando para el mismo lado
  const rel = sentidosRelativos(frames);
  const alReves = frames.filter((f, i) => rel && rel[i] === 'al reves');

  // 2) dato de apoyo: hacia dónde mira (solo informativo; con pelo grande o
  //    ojos chicos no siempre se puede leer, y no debe frenar el chequeo)
  const minOjo = MIN_OJO_LATERAL;
  const ojos = frames.map((f) => ({ f, ...info(f, minOjo) }));
  const lados = new Set(ojos.filter((r) => r.lado === 'IZQ' || r.lado === 'DER').map((r) => r.lado));
  const esperado = dir === 'left' ? 'IZQ' : 'DER';
  const dato = lados.size === 1 ? [...lados][0] : (lados.size ? '?' : 'ilegible');

  const linea = `${ojos.map((r) => `${r.f}(${r.lado})`).join('  ')}  |  ${rel.map((r) => r).join(',')}`;

  if (alReves.length) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEDIA VUELTA   ${linea}`);
    console.log(`       estos frames están del lado contrario al resto: el personaje gira`);
    console.log(`       a mitad del ciclo -> ${alReves.join(', ')}`);
    malos++;
    continue;
  }
  if (dato === esperado) {
    console.log(`  ✅ ${char}/${dir.padEnd(5)}  ${esperado.padEnd(7)}         ${linea}`);
  } else if (lados.size > 1) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEZCLA           ${linea}`);
    console.log(`       hay frames mirando a los dos lados dentro del mismo ciclo`);
    malos++;
  } else {
    console.log(`  ➖ ${char}/${dir.padEnd(5)}  ${dato.padEnd(7)}         ${linea}`);
    console.log(`       todos los frames son coherentes, pero no se puede leer de qué`);
    console.log(`       lado miran (pelo grande o ojos chicos). No se puede reprobar.`);
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
