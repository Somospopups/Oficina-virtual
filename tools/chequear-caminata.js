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

// ---------- ¿El ciclo hace caminar o hace saltar? ----------
// Un ciclo lateral es [zancada, paso, zancada, paso]. Las DOS zancadas tienen que
// llevar la pierna Delante distinta; si no, el personaje saca la misma pierna dos
// veces por ciclo y no camina: salta sobre una pierna. No se nota mirando un
// frame suelto (wl1 y wl3 son dos dibujos bien distintos por arriba, el brazo
// cambia de lugar), hay que mirar la silueta de las piernas.
//
// Se recorta desde debajo de la rodilla y se compara. Piernas casi iguales = se
// ve al caminar.
function piernas(png) {
  const { W, H, ch, buf } = png;
  const op = (x, y) => buf[(y * W + x) * ch + 3] > 128;
  let yTop = H, yBot = -1, xMin = W, xMax = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (op(x, y)) {
        if (y < yTop) yTop = y; if (y > yBot) yBot = y;
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      }
    }
  }
  if (yBot < yTop) return null;
  const desde = yTop + Math.floor((yBot - yTop + 1) * 0.62);
  const w = xMax - xMin + 1, h = yBot - desde + 1;
  const mask = new Uint8Array(w * h);
  for (let y = desde; y <= yBot; y++) {
    for (let x = xMin; x <= xMax; x++) if (op(x, y)) mask[(y - desde) * w + (x - xMin)] = 1;
  }
  return { mask, w, h };
}

// Medirlo por "cuanto se parecen las piernas" NO sirve: dos zancadas con la
// misma pierna adelante pueden ser muy distintas entre si (una con la rodilla
// doblada y otra recta) y dos zancadas con piernas alternadas pueden parecerse
// mucho. Lo que distingue una de la otra es la PIEL: si el ciclo camina, la
// segunda zancada es casi el ESPEJO de la primera. Por eso se comparan las dos
// zancadas tal cual y contra el espejo, y se mira el cociente. Calibrado con
// Ger, que esta dibujado a mano y alterna bien (0.62), contra los que saltan
// (Facu 0.18, Milo 0.30). Por debajo de 0.45 el personaje no esta caminando.

// Fraccion de pixeles que difieren entre dos siluetas de piernas, alineadas por
// el piso y centradas en x.
function difPiernas(a, b) {
  if (!a || !b) return 1;
  const W = Math.max(a.w, b.w), H = Math.max(a.h, b.h);
  const pon = (s) => {
    const o = new Uint8Array(W * H);
    const dx = ((W - s.w) / 2) | 0;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) o[(H - s.h + y) * W + dx + x] = s.mask[y * s.w + x];
    }
    return o;
  };
  const A = pon(a), B = pon(b);
  let d = 0, n = 0;
  for (let i = 0; i < A.length; i++) { if (A[i]) n++; if (A[i] !== B[i]) d++; }
  return d / Math.max(1, n);
}

// Cociente "las zancadas son iguales" / "las zancadas son espejo".
const MAX_SALTO = 0.45;
const espejo = (s) => {
  if (!s) return null;
  const o = new Uint8Array(s.mask.length);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) o[y * s.w + x] = s.mask[y * s.w + (s.w - 1 - x)];
  }
  return { mask: o, w: s.w, h: s.h };
};

function saltoEnCiclo(frames) {
  if (frames.length < 4) return null;   // ciclo de 2 frames: no hay dos zancadas
  const s = frames.map((f) => infoPiernas(f));
  const cocientes = [];
  for (let i = 0; i + 2 < frames.length; i += 2) {
    const directo = difPiernas(s[i], s[i + 2]);
    const espejado = difPiernas(s[i], espejo(s[i + 2]));
    cocientes.push(directo / Math.max(0.01, espejado));
  }
  return cocientes[0];
}

const cachePiernas = {};
function infoPiernas(nombre) {
  if (!cachePiernas[nombre]) {
    const f = path.join(raiz, 'sprites', `${nombre}.png`);
    cachePiernas[nombre] = fs.existsSync(f) ? piernas(decodePNG(f)) : null;
  }
  return cachePiernas[nombre];
}

// ---------- Hacia dónde mira ----------
// La señal es DÓNDE ESTÁ LA PIEL dentro de la cabeza, no los ojos.
//
// Se empezó por los ojos (blancos, dentro de una remera negra) y falló: con
// pelo grande y barba la cabeza es casi simétrica, el ojo cae en el medio y el
// frame se lee como "de frente". Con Milo pasaba siempre, y sus ciclos quedaban
// sin validar. La piel sí es asimétrica —nariz, pómulo, mandíbula se corren hacia
// donde mira— y funciona con pelo rizado, barba y ojos de 9 px por igual.
//
// La cabeza se aísla como la componente conexa mayor del tercio superior, porque
// en un perfil el 35% de arriba también trae el hombro y el brazo adelantado.

// Mayor componente conexa (8 vecinos) de un mapa de booleanos.
// Devuelve {n, pix}: cuántas celdas tiene la mayor y cuáles son.
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

function esPiel(r, g, b) {
  return r > 120 && r < 255 && g > 80 && b > 50 && (r - b) > 28 && (r - g) > 15;
}

function haciaDondeMira(png) {
  const { W, H, ch, buf } = png;
  const op = (x, y) => buf[(y * W + x) * ch + 3] > 128;

  // alto real de la figura
  let yTop = H, yBot = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (op(x, y)) { if (y < yTop) yTop = y; if (y > yBot) yBot = y; break; }
    }
  }
  if (yBot < yTop) return { lado: 'VACIO' };
  const lim = yTop + Math.max(8, Math.floor((yBot - yTop + 1) * 0.32));

  // cabeza = componente conexa mayor de la zona superior
  const mOp = new Uint8Array(W * lim);
  for (let y = yTop; y < lim; y++) for (let x = 0; x < W; x++) if (op(x, y)) mOp[y * W + x] = 1;
  const cabeza = mayorComponente(mOp, W, lim);
  if (!cabeza.n) return { lado: 'VACIO' };

  let hx0 = Infinity, hx1 = -1;
  for (const i of cabeza.pix) { const x = i % W; if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  const ancho = Math.max(1, hx1 - hx0 + 1);

  let sx = 0, n = 0;
  for (const i of cabeza.pix) {
    const y = (i / W) | 0, x = i % W;
    const o = (y * W + x) * ch;
    if (esPiel(buf[o], buf[o + 1], buf[o + 2])) { sx += x; n++; }
  }
  if (n < 15) return { lado: 'ESPALDA' };     // de espaldas no se ve piel en la cara
  const pos = (sx / n - hx0) / ancho;
  return { lado: pos > 0.5 ? 'DER' : 'IZQ', pos, piel: n };
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
const info = (nombre) => {
  if (!cache[nombre]) {
    const f = path.join(raiz, 'sprites', `${nombre}.png`);
    cache[nombre] = fs.existsSync(f)
      ? haciaDondeMira(decodePNG(f))
      : { lado: 'FALTA' };
  }
  return cache[nombre];
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

  // La prueba que decide es la PIEL (arriba): cada frame dice para dónde mira.
  // El reflejo de la firma queda como apoyo, porque con personajes de pose muy
  // cambiante (piernas juntas vs. zancada abierta) la diferencia de pose tapa la
  // de dirección y leía "coherente" sobre un ciclo realmente mezclado.
  const lados = frames.map((f) => info(f).lado);
  const leibles = lados.filter((l) => l === 'IZQ' || l === 'DER');
  const distintos = new Set(leibles);
  const esperado = dir === 'left' ? 'IZQ' : 'DER';
  const rel = sentidosRelativos(frames);
  const linea = `${frames.map((f, i) => `${f}(${lados[i]})`).join('  ')}  |  ${rel.join(',')}`;

  if (distintos.size > 1) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEZCLA           ${linea}`);
    console.log(`       hay frames mirando al lado contrario dentro del mismo ciclo:`);
    console.log(`       ${frames.filter((f, i) => lados[i] !== lados[0]).join(', ')} ->`);
    console.log(`       espejalos, o renombrá los archivos para que el nombre coincida`);
    malos++;
  } else if (distintos.size === 1 && [...distintos][0] !== esperado) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  AL REVES         ${linea}`);
    console.log(`       el ciclo se llama "${dir}" pero los frames miran al revés:`);
    console.log(`       espejá el conjunto entero, o renombrá _wl* <-> _wr*.`);
    malos++;
  } else if (distintos.size === 0) {
    console.log(`  ➖ ${char}/${dir.padEnd(5)}  ILEGIBLE         ${linea}`);
    console.log(`       no se ve piel en la cara de estos frames; no se puede reprobar.`);
  } else {
    // Que mire bien no alcanza: ademas tiene que alternar las piernas.
    const sal = saltoEnCiclo(frames);
    let salta = false;
    if (sal !== null && sal < MAX_SALTO) salta = true;
    if (salta) {
      console.log(`  ❌ ${char}/${dir.padEnd(5)}  SALTA            ${linea}`);
      console.log(`       las dos zancadas usan la misma pierna (cociente ${sal.toFixed(2)} < ${MAX_SALTO}):`);
      console.log(`       el personaje no camina, rebota sobre una sola pierna.`);
      malos++;
    } else {
      const dTxt = sal !== null ? `  piernas alternadas (${sal.toFixed(2)})` : '';
      console.log(`  ✅ ${char}/${dir.padEnd(5)}  ${esperado.padEnd(7)}         ${linea}${dTxt}`);
    }
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
