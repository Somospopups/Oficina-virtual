/* ============================================================
   🏢 OFICINA VIRTUAL — escena en perspectiva (pixel art)
   Fondo = réplica profunda del estudio real.
   Multiplayer: WebSocket (servidor propio) o P2P Trystero (GitHub Pages).
   ============================================================ */
'use strict';

// ---------- Espacio virtual = dimensiones del fondo ----------
const VW = 1195, VH = 896;
let viewScale = 1, viewOX = 0, viewOY = 0;

// Rectángulo del ventanal (cielo dinámico)
const WIN = { x: 484, y: 291, w: 255, h: 84 };

// Piso caminable (trapecio en perspectiva, bien profundo)
const FLOOR = { yTop: 460, yBot: 890, xlTop: 505, xrTop: 720, xlBot: 280, xrBot: 935 };

// Los 4 puestos: marcados frente a cada teclado
const SEATS = [
  { x: 328, y: 683, face: 'left' },  // recalado: manos sobre el teclado delantero izq.
  { x: 510, y: 518, face: 'left' },
  { x: 710, y: 518, face: 'right' }, // recalado: manos sobre el teclado (el fondo no es simétrico)
  { x: 861, y: 683, face: 'right' }, // recalado: manos sobre el teclado delantero der.
];

// Zona café: frente al gabinete blanco bajo la ventana
const ZONES = [
  { name: 'Estación de café (junto a la ventana)', x0: 515, y0: 462, x1: 715, y1: 560, status: 'cafe' },
];

const SPEED = 320;
const SEND_MS = 140;

const STATUS_INFO = {
  codeando:   { emoji: '💻', label: 'Codeando' },
  reunion:    { emoji: '🤝', label: 'En reunión' },
  cafe:       { emoji: '☕', label: 'Pausa café' }, // solo automático (zona café)
  ausente:    { emoji: '🏃', label: '¡Ya vengo!' },
  disponible: { emoji: '🟢', label: 'Disponible' },
};
const STATUS_KEYS = ['codeando', 'reunion', 'ausente'];
const SHIRT_COLORS = ['#e05252', '#4a90d9', '#4caf6d', '#e6b422', '#9b59b6', '#e67e22', '#26a69a', '#ec6ea4'];
const HAIR_COLORS  = ['#3a2c20', '#1c1c22', '#6b4a2b', '#c9a24b', '#222831', '#513228', '#101418', '#8a5a3b'];

// ---------- Utils ----------
function rnd(x, y, i) { const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453; return s - Math.floor(s); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hex2rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function lerpColor(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
function depthScale(y) { return lerp(3.1, 20, clamp((y - FLOOR.yTop) / (FLOOR.yBot - FLOOR.yTop), 0, 1)); }
function sitScale(y) { return lerp(4.8, 9.8, clamp((y - 560) / 190, 0, 1)); }

// ---------- Volumetría y contorno (estilo chibi 2.5D) ----------
// Sube o baja un color hacia blanco/negro. t>0 aclara, t<0 oscurece.
function tone(hex, t) { return lerpColor(hex, t > 0 ? '#ffffff' : '#000000', Math.abs(t)); }

// Rectángulo con volumen: luz en el borde superior+izquierdo, sombra en el
// inferior+derecho, más una banda de sombra en la base. Es el helper que separa
// el arte plano de la referencia, donde cada superficie se modela con 2-3 tonos.
// depth = intensidad de esa banda inferior (0 la omite).
function vol(g, x, y, w, h, base, o) {
  const p = o || {};
  g.fillStyle = base; g.fillRect(x, y, w, h);
  // En colores muy oscuros (la remera negra de Ger) un bisel de 15% no se ve:
  // subimos la luz y bajamos la sombra según la luminancia del color base.
  const rgb = hex2rgb(base);
  const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  const k = lum < 70 ? 0.22 : 0.15;
  g.fillStyle = p.light || tone(base, k);
  g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = p.dark || tone(base, lum < 70 ? -0.14 : -0.24);
  g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
  if (p.depth) {
    const bh = Math.max(1, Math.round(h * 0.3));
    g.fillStyle = tone(base, -p.depth);
    g.fillRect(x + 1, y + h - 1 - bh, w - 2, bh);
  }
}

// Overlay de sombra: para lo que queda en penumbra (bajo el mentón, bajo el
// brazo al cuerpo, entre los muslos).
function shade(g, x, y, w, h, alpha, col) {
  g.fillStyle = col || '#000000';
  g.globalAlpha = alpha;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 1;
}

// Contorno negro de 1px alrededor de la silueta. Se hace por píxel real (fuera
// de la grilla) porque es un detalle fino, igual que en la referencia. Se corre al
// final, con el sprite ya completo, así que ve la forma exacta.
function pixelOutline(cv, col) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  // Hay que leer SIEMPRE del snapshot original. Si leyéramos de d mientras lo
  // escribimos, cada píxel recién pintado contaría como vecino y el contorno
  // crecería hacia afuera en cadena, rellenando el hueco entre las partes.
  const snap = new Uint8ClampedArray(d);
  const solid = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : snap[(y * W + x) * 4 + 3] > 8 ? 1 : 0);
  const ink = hex2rgb(col || '#151119');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        const i = (y * W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------- Ciclo día/noche (hora real) ----------
const SKY_STOPS = [
  { h: 0,   top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.25, amb: 0.34 },
  { h: 5,   top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.25, amb: 0.34 },
  { h: 6.5, top: '#ff8f5c', bot: '#ffd9a0', star: 0.2, patch: '#ffcf9e', patchA: 0.40, amb: 0.12 },
  { h: 9,   top: '#5ab6f0', bot: '#a8dcf6', star: 0,   patch: '#fff6d6', patchA: 0.30, amb: 0 },
  { h: 15,  top: '#4aa3e8', bot: '#9ed4f2', star: 0,   patch: '#fff2c8', patchA: 0.30, amb: 0 },
  { h: 18.5,top: '#ff7b4f', bot: '#ffc46b', star: 0.1, patch: '#ffd9a0', patchA: 0.40, amb: 0.10 },
  { h: 20,  top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.25, amb: 0.34 },
  { h: 24,  top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.25, amb: 0.34 },
];
function skyNow(hf) {
  let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hf >= SKY_STOPS[i].h && hf <= SKY_STOPS[i + 1].h) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (hf - a.h) / (b.h - a.h);
  return {
    top: lerpColor(a.top, b.top, t), bot: lerpColor(a.bot, b.bot, t),
    star: lerp(a.star, b.star, t), patch: lerpColor(a.patch, b.patch, t),
    patchA: lerp(a.patchA, b.patchA, t), amb: lerp(a.amb, b.amb, t),
  };
}
function phaseName(h) {
  if (h >= 5 && h < 8) return '🌅 Amanecer';
  if (h >= 8 && h < 13) return '☀️ Mañana';
  if (h >= 13 && h < 19) return '🌇 Tarde';
  return '🌙 Noche';
}

// Skyline del ventanal
const BUILDINGS = [];
(function () {
  let x = 0, i = 0;
  while (x < WIN.w + 20) {
    const w = 10 + Math.floor(rnd(i, 7, 1) * 16);
    const h = 16 + Math.floor(rnd(i, 3, 2) * 50);
    BUILDINGS.push({ x, w, h, brick: rnd(i, 11, 3) > 0.72 });
    x += w + 1 + Math.floor(rnd(i, 9, 5) * 4);
    i++;
  }
})();

// ---------- Roster del equipo (ingreso por DNI) ----------
const ROSTER = [
  { dni: '33245911', name: 'Ger',  char: 'ger',  seat: 1 },
  { dni: '31923010', name: 'Facu', char: 'facu', seat: 2 },
  { dni: '34186736', name: 'Ovni', char: 'ovni', seat: 3 },
];
const CHAR_DEF = {
  ger:  { skin: '#f0c8a0', skinD: '#d9a878', hair: '#5a3a24', beard: '#7a5a3a', beardStyle: 'goatee', shirt: '#1a1a1e', pants: '#4a6a94', shoe: '#22262e', sole: '#e8e8e8', wide: false, hairStyle: 'spiky', dot: '#8a6a4a' },
  facu: { skin: '#eebf96', skinD: '#d09a6a', hair: '#1c1c22', beard: '#17171c', beardStyle: 'full',  shirt: '#3f6fa8', pants: '#4a6a94', shoe: '#6b4a2b', sole: null,      wide: true,  hairStyle: 'full',  dot: '#3f6fa8' },
  ovni: { skin: '#f0c8a0', skinD: '#d9a878', hair: '#3a2c20', beard: '#2a2a30', beardStyle: 'goatee', shirt: '#e8a020', pants: '#22262e', shoe: '#e8e8e8', sole: '#9aa2ae', wide: false, hairStyle: 'cap',   dot: '#e8a020', jacket: true },
};
function charOf(key) { return CHAR_DEF[key] || CHAR_DEF.ger; }


// ---------- Detalle FINÍSIMO (grilla 4x): micro-píxeles de arte ----------
function detailStand(g, c, dir, frame) {
  const A = (col, al) => { g.fillStyle = col; g.globalAlpha = al == null ? 1 : al; };
  const step = frame === 1;
  const lx = step ? 32 : 40, rx = step ? 72 : 64; // piernas según frame
  // ojos: blanco + pupila + brillo + ceja
  if (dir === 'down') {
    A('#ffffff'); g.fillRect(50, 42, 6, 8); g.fillRect(74, 42, 6, 8);
    A('#26221e'); g.fillRect(52, 44, 4, 6); g.fillRect(76, 44, 4, 6);
    A('#ffffff'); g.fillRect(52, 44, 1, 1); g.fillRect(76, 44, 1, 1);
    A(c.hair); g.fillRect(48, 36, 10, 2); g.fillRect(72, 36, 10, 2);
    A(c.skinD); g.fillRect(62, 52, 4, 2);
    A(c.skin); g.fillRect(44, 46, 3, 6); g.fillRect(81, 46, 3, 6);
    A(c.skinD); g.fillRect(45, 48, 1, 2); g.fillRect(82, 48, 1, 2);
  } else if (dir === 'left') {
    A('#ffffff'); g.fillRect(48, 42, 6, 8); A('#26221e'); g.fillRect(48, 44, 4, 6); A('#ffffff'); g.fillRect(48, 44, 1, 1);
    A(c.hair); g.fillRect(46, 36, 10, 2); A(c.skinD); g.fillRect(44, 52, 3, 2); A(c.skin); g.fillRect(54, 46, 4, 6); A(c.skinD); g.fillRect(55, 48, 1, 2);
  } else if (dir === 'right') {
    A('#ffffff'); g.fillRect(76, 42, 6, 8); A('#26221e'); g.fillRect(78, 44, 4, 6); A('#ffffff'); g.fillRect(78, 44, 1, 1);
    A(c.hair); g.fillRect(74, 36, 10, 2); A(c.skinD); g.fillRect(81, 52, 3, 2); A(c.skin); g.fillRect(70, 46, 4, 6); A(c.skinD); g.fillRect(71, 48, 1, 2);
  }
  // pelo / gorra
  if (c.hairStyle === 'spiky') {
    A('#7a5a3a'); g.fillRect(46, 14, 3, 12); g.fillRect(58, 10, 3, 16); g.fillRect(70, 14, 3, 12);
    A('#4a2e1c'); g.fillRect(52, 12, 2, 10); g.fillRect(64, 12, 2, 10);
    A('#4a2e1c', 0.5); g.fillRect(44, 20, 40, 1);
  } else if (c.hairStyle === 'full') {
    A('#33333c'); g.fillRect(48, 14, 20, 4);
    A('#101014'); g.fillRect(56, 12, 2, 10); g.fillRect(66, 14, 2, 8);
    A('#101014', 0.5); g.fillRect(44, 18, 40, 1);
  } else {
    A('#454e5a'); g.fillRect(62, 14, 3, 16); g.fillRect(60, 10, 8, 4);
    A('#6a7480'); g.fillRect(38, 34, 52, 2);
    A('#39414b'); for (let x = 40; x <= 86; x += 6) g.fillRect(x, 36, 3, 1);
  }
  // barba
  if (c.beardStyle === 'full') {
    A('#000000', 0.25); for (let y = 52; y <= 72; y += 4) for (let x = 48; x <= 80; x += 5) g.fillRect(x, y, 1, 1);
    A('#2f2f36'); for (let y = 56; y <= 68; y += 6) for (let x = 50; x <= 76; x += 8) g.fillRect(x, y, 2, 1);
    A('#2a2a30'); g.fillRect(56, 52, 16, 2);
    A('#3a2a2a'); g.fillRect(58, 60, 12, 1);
  } else if (dir !== 'up') {
    A(c.beard, 0.8);
    if (dir === 'down') { for (let x = 52; x <= 76; x += 3) { g.fillRect(x, 62, 1, 1); g.fillRect(x + 1, 64, 1, 1); } g.fillRect(60, 68, 8, 2); A(c.beard, 0.5); g.fillRect(44, 56, 3, 8); g.fillRect(81, 56, 3, 8); }
    else if (dir === 'left') { for (let y = 56; y <= 66; y += 2) g.fillRect(42, y, 1, 1); g.fillRect(44, 68, 6, 2); }
    else { for (let y = 56; y <= 66; y += 2) g.fillRect(85, y, 1, 1); g.fillRect(78, 68, 6, 2); }
  }
  g.globalAlpha = 1;
  // torso: cuello, bastillas, costuras, pliegues
  const bx = (c.wide ? 7 : 8) * 4, bw = (c.wide ? 18 : 16) * 4;
  A('#000000', 0.35); g.fillRect(bx + 16, 72, bw - 32, 2);
  A('#000000', 0.25); g.fillRect(bx - 8, 80, 8, 2); g.fillRect(bx + bw, 80, 8, 2);
  A('#000000', 0.15); g.fillRect(bx, 74, 1, 24); g.fillRect(bx + bw - 1, 74, 1, 24);
  A('#000000', 0.12); g.fillRect(bx + 10, 96, 10, 1); g.fillRect(bx + bw - 22, 104, 12, 1);
  if (c.jacket) {
    A('#5a6470'); g.fillRect(62, 76, 3, 48);
    A('#8a94a2'); for (let y = 78; y <= 118; y += 4) g.fillRect(62, y, 3, 1);
    A('#d8dce2'); g.fillRect(62, 84, 4, 8);
    A('#d8dce2'); g.fillRect(56, 80, 3, 16); g.fillRect(68, 80, 3, 16); g.fillRect(56, 96, 3, 3); g.fillRect(68, 96, 3, 3);
    A('#c88a10'); g.fillRect(bx + 4, 112, 10, 2); g.fillRect(bx + bw - 14, 112, 10, 2); g.fillRect(bx, 124, bw, 2);
  }
  // jeans: costuras, bolsillos, bragueta, rodillas, dobladillo
  A('#3a5a85'); g.fillRect(lx + 2, 132, 2, 24); g.fillRect(rx + 20, 132, 2, 24);
  A('#3a5a85'); g.fillRect(lx + 4, 128, 8, 2); g.fillRect(rx + 12, 128, 8, 2);
  A('#2a4a75'); g.fillRect(62, 128, 2, 10);
  A('#000000', 0.12); g.fillRect(lx + 6, 150, 8, 1); g.fillRect(rx + 10, 150, 8, 1);
  A('#000000', 0.2); g.fillRect(lx, 160, 12, 2); g.fillRect(rx + 12, 160, 12, 2);
  // zapatos: cordones cruzados + dibujo de suela
  if (c.sole) {
    A('#ffffff', 0.9); g.fillRect(lx + 6, 162, 2, 1); g.fillRect(lx + 10, 164, 2, 1); g.fillRect(rx + 6, 162, 2, 1); g.fillRect(rx + 10, 164, 2, 1);
    A('#000000', 0.3); for (let x = lx; x <= lx + 12; x += 4) g.fillRect(x, 172, 2, 1); for (let x = rx + 4; x <= rx + 16; x += 4) g.fillRect(x, 172, 2, 1);
  }
  g.globalAlpha = 1;
}
// Detalle fino del sentado. Todo esto se dibuja en píxeles reales del canvas
// (192x224) y no en la grilla lógica 4x: los ojos miden 10-13px y multiplicados
// por 4 quedarían como manchas blancas de 40px.
function detailSit(g, c, frame) {
  const bob = frame ? 4 : 0;   // x4, igual que el desfase de la grilla

  // Ojo en píxeles reales: esclerótica -> iris -> pupila -> brillo. El iris se
  // lleva la mayor parte (como en la referencia) y la esclerótica queda de
  // orla; al revés se lee como un bloque blanco vacío.
  const eyePx = (x, y, w, h) => {
    g.fillStyle = '#efe9df'; g.fillRect(x, y + bob, w, h);
    const iw = Math.round(w * 0.68), ih = Math.round(h * 0.68);
    g.fillStyle = '#5a7a9e'; g.fillRect(x + 2, y + 2 + bob, iw, ih);
    const pw = Math.max(2, Math.round(iw * 0.55)), ph = Math.max(2, Math.round(ih * 0.6));
    g.fillStyle = '#181116'; g.fillRect(x + 2 + ((iw - pw) >> 1), y + 2 + bob + ((ih - ph) >> 1), pw, ph);
    g.fillStyle = '#ffffff'; g.fillRect(x + 3, y + 3 + bob, 2, 2);
  };
  const strand = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y + bob, w, h); };

  // ---------- ojos: el cercano más grande que el lejano, eso arma el 3/4 ----------
  eyePx(66, 81, 10, 11);   // ojo lejano
  eyePx(90, 78, 13, 14);   // ojo cercano

  // ---------- cejas: 2px, con el lejano un pelín más alto ----------
  g.fillStyle = tone(c.hair, -0.16); g.fillRect(66, 76 + bob, 10, 2);
  g.fillStyle = tone(c.hair, -0.16); g.fillRect(90, 73 + bob, 13, 2);
  g.fillStyle = tone(c.hair, 0.1);   g.fillRect(66, 76 + bob, 3, 1);

  // ---------- nariz: la punta asoma por el borde derecho ----------
  g.fillStyle = tone(c.skin, 0.12);  g.fillRect(118, 92 + bob, 6, 4);
  g.fillStyle = tone(c.skin, -0.36); g.fillRect(118, 96 + bob, 4, 2);
  g.fillStyle = tone(c.skin, -0.22); g.fillRect(115, 94 + bob, 3, 1);

  // ---------- boca: una insinuación dentro de la barba, no un bloque ----------
  if (c.beardStyle === 'full') {
    g.fillStyle = '#c8bfb2'; g.fillRect(85, 100 + bob, 8, 1);
    g.fillStyle = '#17121a'; g.fillRect(84, 101 + bob, 10, 2);
  } else {
    g.fillStyle = '#6b3f36'; g.fillRect(86, 100 + bob, 7, 2);
    g.fillStyle = '#4a2b26'; g.fillRect(86, 102 + bob, 7, 1);
  }

  // ---------- pelo: volumen con 2-3 mechones grandes, no rayas ----------
  if (c.hairStyle === 'spiky') {
    strand(70, 60, 3, 9, tone(c.hair, 0.16));
    strand(84, 57, 3, 12, tone(c.hair, 0.16));
    strand(102, 62, 2, 7, tone(c.hair, -0.3));
  } else if (c.hairStyle === 'full') {
    strand(68, 60, 3, 10, tone(c.hair, 0.14));
    strand(82, 57, 3, 13, tone(c.hair, 0.14));
    strand(101, 63, 2, 7, tone(c.hair, -0.34));
  } else {
    strand(64, 51, 15, 2, tone('#5a6470', 0.24));   // brillo de la gorra
    strand(64, 70, 32, 2, '#3f4750');                // costura del ala
  }

  // ---------- barba: masa con volumen; mechones solo en los costados ----------
  if (c.beardStyle === 'full') {
    strand(60, 99, 3, 13, tone(c.beard, 0.16));
    strand(108, 99, 3, 13, tone(c.beard, -0.22));
  } else {
    strand(64, 99, 3, 11, tone(c.beard, 0.18));
    strand(110, 99, 3, 11, tone(c.beard, -0.2));
  }

  // ---------- ropa: pliegues, costura, brillos ----------
  if (c.jacket) {
    g.fillStyle = '#eef2f8'; g.fillRect(72, 126 + bob, 2, 4);      // brillo del cierre
    g.fillStyle = '#5a6470'; g.fillRect(106, 122 + bob, 2, 26);    // costura del hoodie
    g.fillStyle = '#8a94a2'; g.fillRect(74, 122 + bob, 2, 26);
  } else {
    g.fillStyle = tone(c.shirt, 0.2);
    g.fillRect(68, 130 + bob, 10, 2); g.fillRect(104, 134 + bob, 8, 2);
    g.fillStyle = tone(c.shirt, -0.28);
    g.fillRect(80, 150 + bob, 8, 2); g.fillRect(96, 154 + bob, 6, 2);
  }
  g.fillStyle = tone(c.pants, 0.26); g.fillRect(80, 168 + bob, 12, 2);   // costura del jean
  g.fillStyle = tone(c.pants, -0.36); g.fillRect(56, 178 + bob, 10, 2);

  // ---------- brillo del monitor sobre el hombro y la sien ----------
  g.fillStyle = '#9fc0ff'; g.globalAlpha = 0.11;
  g.fillRect(121, 120 + bob, 2, 34);
  g.fillRect(106, 74 + bob, 14, 2);
  g.globalAlpha = 1;
}

// ---------- Sprites de referencia (PNG) ----------
// Los 3 personajes vienen recortados de la foto de referencia del equipo. Son
// digital painting, no pixel art: reescalan mejor con smoothing que con
// nearest-neighbor, así que NO pasan por la grilla de 4x ni por pixelOutline.
const charAssets = {};   // charKey -> { down, left, right, up }
let assetsReady = false;

function flipCanvas(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return cv;
}

// La foto no tiene a nadie de espaldas, así que no hay referencia para la vista
// "up". La aproximamos con el mismo sprite oscurecido: es un truco viejo de
// juegos 2D y funciona porque el jugador casi nunca camina hacia arriba y, cuando
// lo hace, no tiene a quién comparar. Si algún día se dibuja la vista de espaldas
// en serio, se reemplaza esta línea por el sprite correspondiente.
function oscurecer(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(24,26,38,0.45)';
  g.fillRect(0, 0, src.width, src.height);
  return cv;
}

function loadCharAssets() {
  const keys = Object.keys(CHAR_DEF);
  return Promise.all(keys.map((k) => new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const r = flipCanvas(im);
      charAssets[k] = { down: im, left: r, right: r, up: oscurecer(im) };
      res();
    };
    im.onerror = () => res();   // si falta el PNG, se sigue con el sprite por código
    im.src = `sprites/${k}.png`;
  }))).then(() => {
    assetsReady = true;
    const p = document.getElementById('avatarPreview');
    if (p) { const b = p.getAttribute('data-char'); if (b) previewChar(b); }
  });
}

// ---------- Sprites de pie (64x88: grilla fina) ----------
const spriteCache = {};
function getSprite(charKey, dir, frame) {
  // Si cargó el PNG de referencia, manda ese: es el aspecto pedido.
  if (assetsReady && charAssets[charKey]) return charAssets[charKey][dir] || charAssets[charKey].down;
  const key = `s${charKey}_${dir}_${frame}`;
  if (spriteCache[key]) return spriteCache[key];
  const c = charOf(charKey);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 176;
  const g = cv.getContext('2d');
  g.scale(4, 4); // misma silueta calibrada, dibujada en grilla finísima 4x
  const step = frame === 1;
  const bx = c.wide ? 7 : 8, bw = c.wide ? 18 : 16; // torso
  // piernas y zapatos
  g.fillStyle = c.pants;
  if (step) { g.fillRect(8, 32, 6, 8); g.fillRect(18, 32, 6, 8); }
  else { g.fillRect(10, 32, 6, 8); g.fillRect(16, 32, 6, 8); }
  g.fillStyle = c.shoe;
  if (step) { g.fillRect(8, 40, 6, 2); g.fillRect(18, 40, 6, 2); }
  else { g.fillRect(10, 40, 6, 2); g.fillRect(16, 40, 6, 2); }
  if (c.sole) { g.fillStyle = c.sole; if (step) { g.fillRect(8, 41, 6, 1); g.fillRect(18, 41, 6, 1); } else { g.fillRect(10, 41, 6, 1); g.fillRect(16, 41, 6, 1); } }
  // torso
  g.fillStyle = c.shirt; g.fillRect(bx, 18, bw, 14);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(bx, 28, bw, 4);
  if (c.jacket) { // campera amarilla abierta sobre hoodie gris
    g.fillStyle = '#8a94a2'; g.fillRect(13, 18, 6, 14);
    g.fillStyle = '#6a7482'; g.fillRect(15, 18, 2, 14);
    g.fillStyle = '#d8dce2'; g.fillRect(14, 20, 1, 4); g.fillRect(17, 20, 1, 4);
    g.fillStyle = '#c88a10'; g.fillRect(bx, 18, 2, 14); g.fillRect(bx + bw - 2, 18, 2, 14);
  }
  // brazos + manos
  g.fillStyle = c.shirt; g.fillRect(bx - 2, 20, 2, 10); g.fillRect(bx + bw, 20, 2, 10);
  if (c.jacket) { g.fillStyle = '#d8dce2'; g.fillRect(bx - 2, 28, 2, 2); g.fillRect(bx + bw, 28, 2, 2); }
  g.fillStyle = c.skin; g.fillRect(bx - 2, 30, 2, 2); g.fillRect(bx + bw, 30, 2, 2);
  // cabeza
  g.fillStyle = c.skin; g.fillRect(10, 6, 12, 12);
  g.fillStyle = c.skinD; g.fillRect(10, 16, 12, 2);
  // pelo / gorra
  g.fillStyle = c.hair;
  if (c.hairStyle === 'spiky') {
    if (dir === 'up') { g.fillRect(10, 4, 12, 12); g.fillStyle = c.skin; g.fillRect(12, 14, 8, 2); }
    else if (dir === 'down') {
      g.fillRect(10, 4, 12, 4); g.fillRect(10, 6, 2, 6); g.fillRect(20, 6, 2, 6);
      g.fillRect(11, 2, 2, 3); g.fillRect(15, 1, 2, 4); g.fillRect(19, 2, 2, 3);
    } else if (dir === 'left') { g.fillRect(10, 4, 12, 4); g.fillRect(16, 4, 6, 9); g.fillRect(12, 2, 3, 3); g.fillRect(17, 1, 3, 3); }
    else { g.fillRect(10, 4, 12, 4); g.fillRect(10, 4, 6, 9); g.fillRect(12, 2, 3, 3); g.fillRect(17, 1, 3, 3); }
  } else if (c.hairStyle === 'full') {
    if (dir === 'up') { g.fillRect(10, 4, 12, 12); g.fillStyle = c.skin; g.fillRect(12, 14, 8, 2); }
    else if (dir === 'down') { g.fillRect(10, 3, 12, 5); g.fillRect(9, 5, 3, 8); g.fillRect(20, 5, 3, 8); g.fillRect(12, 2, 8, 2); }
    else if (dir === 'left') { g.fillRect(10, 3, 12, 5); g.fillRect(15, 3, 7, 10); }
    else { g.fillRect(10, 3, 12, 5); g.fillRect(10, 3, 7, 10); }
  } else { // gorra al revés
    g.fillStyle = '#5a6470';
    if (dir === 'up') { g.fillRect(9, 3, 14, 7); g.fillStyle = '#454e5a'; g.fillRect(9, 9, 14, 2); g.fillStyle = '#3a424c'; g.fillRect(10, 11, 12, 3); }
    else if (dir === 'down') { g.fillRect(9, 3, 14, 6); g.fillStyle = '#454e5a'; g.fillRect(9, 8, 14, 2); g.fillStyle = c.hair; g.fillRect(10, 10, 2, 4); g.fillRect(20, 10, 2, 4); }
    else if (dir === 'left') { g.fillRect(9, 3, 14, 6); g.fillStyle = '#454e5a'; g.fillRect(9, 8, 14, 2); g.fillStyle = '#3a424c'; g.fillRect(21, 6, 5, 3); g.fillStyle = c.hair; g.fillRect(20, 10, 2, 4); }
    else { g.fillRect(9, 3, 14, 6); g.fillStyle = '#454e5a'; g.fillRect(9, 8, 14, 2); g.fillStyle = '#3a424c'; g.fillRect(6, 6, 5, 3); g.fillStyle = c.hair; g.fillRect(10, 10, 2, 4); }
  }
  // barba
  if (c.beardStyle === 'full') {
    g.fillStyle = c.beard;
    if (dir === 'down') { g.fillRect(10, 12, 12, 7); g.fillRect(12, 19, 8, 2); g.fillStyle = '#26221e'; g.fillRect(14, 14, 4, 2); }
    else if (dir === 'left') { g.fillRect(10, 10, 8, 9); g.fillRect(10, 19, 6, 2); }
    else if (dir === 'right') { g.fillRect(14, 10, 8, 9); g.fillRect(16, 19, 6, 2); }
  } else if (dir !== 'up') {
    g.fillStyle = c.beard;
    if (dir === 'down') { g.fillRect(13, 14, 6, 1); g.fillRect(14, 16, 4, 3); }
    else if (dir === 'left') { g.fillRect(10, 14, 3, 4); g.fillRect(10, 13, 4, 1); }
    else { g.fillRect(19, 14, 3, 4); g.fillRect(18, 13, 4, 1); }
  }
  // cara
  if (dir === 'down') {
    g.fillStyle = '#26221e'; g.fillRect(12, 10, 2, 3); g.fillRect(18, 10, 2, 3);
    if (c.beardStyle === 'full') { g.fillRect(12, 8, 2, 1); g.fillRect(18, 8, 2, 1); }
    if (c.beardStyle !== 'full') { g.fillStyle = '#b06a4a'; g.fillRect(14, 14, 4, 1); }
  } else if (dir === 'left') { g.fillStyle = '#26221e'; g.fillRect(12, 10, 2, 3); }
  else if (dir === 'right') { g.fillStyle = '#26221e'; g.fillRect(18, 10, 2, 3); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  detailStand(g, c, dir, frame);
  spriteCache[key] = cv;
  return cv;
}

// ---------- Personajes sentados: variantes (48x56) ----------
// SIT_VARIANT: 'A' gamer pro | 'B' hoodie | 'C' perfil realista (OFICIAL) | 'D' chibi
let SIT_VARIANT = 'C';

function chairCommon(g) {
  vol(g, 8, 37, 5, 12, '#2b3038');        // costados del respaldo
  vol(g, 36, 37, 5, 12, '#2b3038');
  vol(g, 12, 38, 26, 4, '#333a44');       // travesaño, pasa por detrás de la espalda
  vol(g, 12, 41, 28, 6, '#3a4048', { depth: 0.3 }); // asiento
  vol(g, 24, 47, 4, 5, '#2b3038');        // columna
  g.fillStyle = '#14171b';                // base en cruz + ruedas
  g.fillRect(14, 51, 24, 2); g.fillRect(14, 51, 2, 4); g.fillRect(36, 51, 2, 4); g.fillRect(24, 53, 4, 2);
  g.fillStyle = '#4a525c'; g.fillRect(12, 41, 28, 1);
}
function sitA(g, shirt, hair, frame) {
  g.fillStyle = '#1d2126'; g.fillRect(30, 6, 14, 34);
  g.fillStyle = '#2b3038'; g.fillRect(32, 8, 10, 30);
  g.fillStyle = '#14171b'; g.fillRect(32, 10, 10, 2); g.fillRect(32, 16, 10, 2);
  g.fillStyle = '#e8e8e8'; g.fillRect(35, 12, 4, 3);
  const bob = frame ? 1 : 0;
  g.fillStyle = '#39424e'; g.fillRect(12, 40, 14, 6); // muslos (los pies van bajo el escritorio: no se dibujan)
  g.fillStyle = shirt; g.fillRect(14, 26 + bob, 18, 15);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(14, 36 + bob, 18, 5);
  g.fillStyle = shirt;
  g.fillRect(6, 30 + bob + (frame ? 0 : 2), 12, 4);
  g.fillRect(8, 34 + bob + (frame ? 2 : 0), 12, 4);
  g.fillStyle = '#f0c8a0';
  g.fillRect(2, 30 + bob + (frame ? 0 : 2), 4, 4);
  g.fillRect(4, 34 + bob + (frame ? 2 : 0), 4, 4);
  g.fillStyle = '#f0c8a0'; g.fillRect(16, 10 + bob, 14, 14);
  g.fillStyle = hair; g.fillRect(18, 8 + bob, 12, 4); g.fillRect(26, 10 + bob, 4, 8);
  g.fillStyle = '#14161c'; g.fillRect(16, 8 + bob, 14, 3); g.fillRect(22, 12 + bob, 5, 6);
  g.fillRect(16, 18 + bob, 6, 2); g.fillRect(14, 18 + bob, 2, 3);
  g.fillStyle = '#26221e'; g.fillRect(18, 16 + bob, 2, 2);
  chairCommon(g);
}
function sitB(g, shirt, hair, frame) {
  const sway = frame ? 1 : 0;
  g.fillStyle = '#1d2126'; g.fillRect(8, 18, 6, 26); g.fillRect(34, 18, 6, 26);
  g.fillStyle = '#2b3038'; g.fillRect(9, 20, 4, 22); g.fillRect(35, 20, 4, 22);
  g.fillStyle = shirt; g.fillRect(12, 24 + sway, 24, 18);
  g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(12, 36 + sway, 24, 6);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(16, 22 + sway, 16, 5);
  g.fillStyle = shirt;
  g.fillRect(8, 26 + sway + (frame ? 0 : 1), 5, 8);
  g.fillRect(35, 26 + sway + (frame ? 1 : 0), 5, 8);
  g.fillStyle = hair; g.fillRect(16, 8 + sway, 16, 15);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(18, 10 + sway, 12, 3);
  g.fillStyle = '#14161c'; g.fillRect(16, 6 + sway, 16, 3); g.fillRect(13, 12 + sway, 4, 7); g.fillRect(31, 12 + sway, 4, 7);
  chairCommon(g);
}
// Cabeza chibi: octógono (esquinas achaflanadas 2px) para que lea redonda en vez
// de cuadrada, más volumen suave (luz arriba-izquierda, sombra abajo-derecha).
// k controla cuánto se dibuja la sombra propia: 0 para la base, 0.5 encima.
function headShape(g, x, y, w, h, col, k) {
  g.fillStyle = col;
  g.fillRect(x + 2, y, w - 4, h);
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillRect(x, y + 2, w, h - 4);
  const f = k || 0;
  if (!f) return;
  g.fillStyle = tone(col, 0.13 * f);
  g.fillRect(x + 2, y, w - 4, 1);
  g.fillRect(x + 1, y + 1, 1, h - 3);
  g.fillStyle = tone(col, -0.18 * f);
  g.fillRect(x + 2, y + h - 2, w - 4, 2);
  g.fillRect(x + w - 2, y + 1, 1, h - 3);
}

// Mechones: triángulos que crecen desde la base del pelo hacia arriba. Se usan
// en lugar de columnas sueltas, que se leen como púas pegadas.
function tufts(g, x, y, w, col, n, depth) {
  for (let i = 0; i < n; i++) {
    const tx = x + Math.round((i * (w - 1)) / (n - 1));
    const h = depth - (i % 2);
    g.fillStyle = col;
    g.fillRect(tx, y - h + 1, 1, h);
    g.fillRect(tx - 1, y - h + 2, 1, h - 1);
    g.fillRect(tx + 1, y - h + 2, 1, h - 1);
  }
}

//OFICIAL: perfil 3/4 realista, manos SOBRE el teclado. Estilo chibi 2.5D.
function sitC(g, c, frame) {
  const bob = frame ? 1 : 0; // micro cabeceo mientras tipea

  chairCommon(g);

  // ---------- monitor: es adonde mira ----------
  vol(g, 33, 3 + bob, 12, 12, '#20242c');
  g.fillStyle = '#16241a'; g.fillRect(34, 4 + bob, 10, 10);
  g.fillStyle = '#4caf6d'; g.fillRect(35, 5 + bob, 5, 1); g.fillRect(35, 7 + bob, 7, 1); g.fillRect(35, 9 + bob, 4, 1);
  g.fillStyle = '#8ff0a2'; g.fillRect(35, 5 + bob, 3, 1);
  g.fillStyle = '#2b3038'; g.fillRect(34, 14 + bob, 10, 2);
  vol(g, 37, 16 + bob, 4, 18, '#2b3038');
  vol(g, 34, 34 + bob, 11, 3, '#2b3038');
  // teclado
  vol(g, 34, 37, 12, 4, '#464e58');
  g.fillStyle = '#6a7480';
  g.fillRect(35, 38, 4, 1); g.fillRect(40, 38, 4, 1); g.fillRect(35, 39, 9, 1);

  // ---------- brazo lejano (el del fondo, apenas asoma) ----------
  g.fillStyle = c.shirt; g.fillRect(15, 30 + bob, 4, 6);
  g.fillStyle = tone(c.shirt, -0.3); g.fillRect(15, 34 + bob, 4, 2);
  vol(g, 17, 36 + bob, 6, 3, c.skinD);   // mano al fondo

  // ---------- cuadril / muslos (sentado, van hacia atrás) ----------
  vol(g, 13, 40 + bob, 15, 6, c.pants, { depth: 0.32 });
  g.fillStyle = c.pants; g.fillRect(10, 43 + bob, 5, 4);
  g.fillStyle = tone(c.pants, -0.3); g.fillRect(10, 46 + bob, 5, 1);
  g.fillStyle = tone(c.pants, 0.22); g.fillRect(15, 41 + bob, 11, 1);   // luz en el muslo

  // ---------- torso ----------
  // Hombros anchos y redondeados arriba del bloque, para que no lea como un
  // rectángulo plano.
  g.fillStyle = c.shirt; g.fillRect(15, 29 + bob, 15, 3);
  vol(g, 14, 31 + bob, 17, 12, c.shirt, { depth: 0.26 });
  g.fillStyle = tone(c.shirt, 0.16); g.fillRect(15, 30 + bob, 15, 1);
  // dos pliegues suaves: en la remera negra el volumen puro no se ve, así que
  // el relieve se marca con reflejos en vez de sombras.
  g.fillStyle = tone(c.shirt, 0.12); g.fillRect(18, 35 + bob, 5, 1);
  g.fillStyle = tone(c.shirt, 0.12); g.fillRect(24, 38 + bob, 4, 1);
  if (c.jacket) {
    // hoodie gris en el medio con las dos solapas de la campera abierta encima
    g.fillStyle = '#7e8894'; g.fillRect(18, 30 + bob, 9, 12);
    g.fillStyle = '#a8b2be'; g.fillRect(19, 31 + bob, 1, 6);
    g.fillStyle = '#5a6470'; g.fillRect(26, 30 + bob, 1, 12);
    g.fillStyle = '#c88a10'; g.fillRect(16, 30 + bob, 2, 12);   // solapa izquierda
    g.fillStyle = '#e8a820'; g.fillRect(16, 30 + bob, 1, 12);
    g.fillStyle = '#c88a10'; g.fillRect(27, 30 + bob, 2, 12);   // solapa derecha
    g.fillStyle = '#b87c08'; g.fillRect(28, 30 + bob, 1, 12);
  }
  shade(g, 14, 35 + bob, 3, 8, 0.2);     // sombra del brazo izquierdo
  shade(g, 28, 35 + bob, 3, 8, 0.2);     // sombra del brazo derecho
  g.fillStyle = tone(c.shirt, -0.3); g.fillRect(17, 34 + bob, 1, 6);   // costuras de armpila
  g.fillStyle = tone(c.shirt, -0.3); g.fillRect(28, 34 + bob, 1, 6);

  // ---------- brazo cercano: del hombro al teclado ----------
  g.fillStyle = c.shirt; g.fillRect(27, 30 + bob, 4, 4);
  g.fillStyle = c.shirt; g.fillRect(29, 33 + bob, 4, 3);
  g.fillStyle = tone(c.shirt, 0.22); g.fillRect(27, 30 + bob, 4, 1);
  // mano: nudillos arriba, dedos abajo apoyados en el teclado
  g.fillStyle = c.skin; g.fillRect(31, 36 + bob, 5, 2);
  g.fillStyle = c.skinD; g.fillRect(31, 38 + bob, 5, 1);
  g.fillStyle = tone(c.skin, -0.3); g.fillRect(32, 38 + bob, 1, 1);
  g.fillStyle = tone(c.skin, -0.3); g.fillRect(34, 38 + bob, 1, 1);

  // ---------- cuello ----------
  g.fillStyle = c.skinD; g.fillRect(20, 26 + bob, 5, 4);
  shade(g, 20, 26 + bob, 5, 2, 0.35);     // penumbra del mentón

  // ---------- cabeza ----------
  // Piel: 19x16 en x=12..30, y=12..27. Arriba hasta y=19 es frente/casco, los
  // ojos van en y=20..23 y la barba arranca en y=24: nunca se pisan.
  headShape(g, 12, 12 + bob, 19, 16, c.skin, 1);
  g.fillStyle = c.skinD; g.fillRect(12, 21 + bob, 2, 3);          // oreja del lado lejano
  g.fillStyle = tone(c.skin, -0.32); g.fillRect(12, 22 + bob, 1, 1);
  shade(g, 14, 25 + bob, 16, 2, 0.2);                            // mentón en penumbra

  // pelo / gorra
  const hy = 19 + bob;   // base del pelo: la frente queda visible
  if (c.hairStyle === 'spiky') {
    headShape(g, 12, hy - 6, 19, 8, c.hair, 0.5);
    tufts(g, 15, hy - 6, 13, c.hair, 3, 3);
    g.fillStyle = c.hair; g.fillRect(12, hy - 3, 2, 5); g.fillRect(30, hy - 3, 2, 5);
  } else if (c.hairStyle === 'full') {
    headShape(g, 12, hy - 6, 19, 8, c.hair, 0.5);
    tufts(g, 15, hy - 6, 13, c.hair, 3, 2);
    g.fillStyle = c.hair; g.fillRect(12, hy - 4, 3, 8); g.fillRect(29, hy - 4, 2, 8);
  } else { // gorra gris, visera atrás
    headShape(g, 11, hy - 7, 21, 9, '#5a6470', 0.5);
    tufts(g, 16, hy - 6, 11, '#5a6470', 2, 1);
    g.fillStyle = '#454e5a'; g.fillRect(11, hy - 1, 21, 2);   // ala de la gorra
    g.fillStyle = '#3a424c'; g.fillRect(30, hy - 3, 3, 3);   // visera atrás
    g.fillStyle = '#7a848f'; g.fillRect(14, hy - 6, 7, 1);   // brillo
    g.fillStyle = c.hair; g.fillRect(14, hy + 1, 2, 4); g.fillRect(29, hy + 1, 2, 4);
  }

  // ---------- barba (siempre bajo los ojos) ----------
  if (c.beardStyle === 'full') {
    headShape(g, 14, 24 + bob, 15, 5, c.beard, 0.6);
    g.fillStyle = tone(c.beard, 0.24); g.fillRect(17, 25 + bob, 6, 1);
  } else {
    // Goatee: mentón redondeado + bigote separado por la boca. Con dos barras
    // rectas (bigote + mentón) se leía como una banda horizontal cruzando la cara.
    headShape(g, 17, 25 + bob, 13, 4, c.beard, 0.6);
    g.fillStyle = c.beard; g.fillRect(19, 24 + bob, 8, 1);
    g.fillStyle = tone(c.beard, 0.22); g.fillRect(19, 25 + bob, 4, 1);
  }
}
function sitD(g, shirt, hair, frame) {
  const hop = frame ? 1 : 0;
  g.fillStyle = '#1d2126'; g.fillRect(30, 12, 14, 30);
  g.fillStyle = '#2b3038'; g.fillRect(32, 14, 10, 26);
  g.fillStyle = '#e8e8e8'; g.fillRect(34, 18, 3, 2); g.fillRect(38, 18, 2, 2);
  g.fillStyle = shirt; g.fillRect(16, 30 + hop, 16, 12);
  g.fillStyle = shirt; g.fillRect(6, 33 + hop + (frame ? 0 : 1), 12, 4);
  g.fillStyle = '#f0c8a0'; g.fillRect(3, 33 + hop + (frame ? 0 : 1), 4, 4);
  g.fillStyle = '#f0c8a0'; g.fillRect(10, 6 + hop, 24, 24);
  g.fillStyle = hair; g.fillRect(12, 4 + hop, 22, 6); g.fillRect(28, 6 + hop, 6, 10);
  g.fillStyle = '#26221e'; g.fillRect(15, 16 + hop, 4, 6);
  g.fillStyle = '#ffffff'; g.fillRect(16, 17 + hop, 2, 2);
  g.fillStyle = '#f28b8b'; g.fillRect(12, 23 + hop, 3, 2);
  g.fillStyle = '#b06a4a'; g.fillRect(18, 25 + hop, 3, 1);
  chairCommon(g);
}

const sitCache = {};
function getSitSprite(charKey, face, occupied, frame = 0) {
  const key = `vC_k${charKey}_${face}_${occupied ? 1 : 0}_${frame}`;
  if (sitCache[key]) return sitCache[key];
  const c = charOf(charKey);
  const mk = () => { const cv = document.createElement('canvas'); cv.width = 192; cv.height = 224; return cv; };

  // El escenario (silla + monitor) y el personaje van en canvas separados: el
  // contorno de 1px se aplica solo a la silueta humana, porque la silla y el
  // monitor son parte del lugar y no deben quedar "delineados".
  const bg = mk(), fig = mk();
  const b = bg.getContext('2d'), g = fig.getContext('2d');

  b.save(); b.scale(4, 4);
  if (!occupied) {
    b.fillStyle = '#1d2126'; b.fillRect(30, 6, 14, 34);
    b.fillStyle = '#2b3038'; b.fillRect(32, 8, 10, 30);
    b.fillStyle = '#e8e8e8'; b.fillRect(35, 12, 4, 3);
    b.fillStyle = '#2b3038'; b.fillRect(14, 34, 20, 6);
  }
  chairCommon(b);
  b.restore();

  if (occupied) {
    if (face === 'left') {
      g.save(); g.scale(4, 4); sitC(g, c, frame); g.restore();
      detailSit(g, c, frame);
    } else {
      g.save(); g.translate(192, 0); g.scale(-4, 4); sitC(g, c, frame); g.restore();
      g.save(); g.translate(192, 0); g.scale(-1, 1); detailSit(g, c, frame); g.restore();
    }
    pixelOutline(fig);
  }

  const out = mk();
  const o = out.getContext('2d');
  o.drawImage(bg, 0, 0);
  o.drawImage(fig, 0, 0);
  sitCache[key] = out;
  return out;
}

function drawWaveArm(g, colorIdx, time) {
  const shirt = SHIRT_COLORS[colorIdx % 8];
  const osc = Math.sin(time * 0.015) > 0 ? 0 : 2;
  g.fillStyle = shirt; g.fillRect(26 + osc, 12, 2, 10);
  g.fillStyle = '#f0c8a0'; g.fillRect(26 + osc, 10, 2, 2);
}

// ---------- Estado / DOM ----------
const state = { myId: null, myName: '', myColor: 0, players: new Map(), joined: false };
const keys = {};
let lastSend = 0, lastZone = null, audioCtx = null;

const bgImg = new Image();
let bgReady = false;
const bgCv = document.createElement('canvas');
function pxAt(g, x, y) { const d = g.getImageData(x, y, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; }
bgImg.onload = () => {
  bgCv.width = bgImg.width; bgCv.height = bgImg.height;
  const g = bgCv.getContext('2d');
  g.drawImage(bgImg, 0, 0);
  const PEGS = [[472, 664, 28, 56], [743, 664, 28, 56], [421, 778, 30, 60], [794, 778, 30, 60], [608, 592, 20, 22]];
  for (const [x, y, w, h] of PEGS) {
    const gh = g.createLinearGradient(x, 0, x + w, 0);
    gh.addColorStop(0, pxAt(g, x - 4, y + (h >> 1)));
    gh.addColorStop(1, pxAt(g, x + w + 4, y + (h >> 1)));
    g.fillStyle = gh; g.fillRect(x, y, w, h);
    const gv = g.createLinearGradient(0, y, 0, y + h);
    gv.addColorStop(0, pxAt(g, x + (w >> 1), y - 4));
    gv.addColorStop(1, pxAt(g, x + (w >> 1), y + h + 4));
    g.globalAlpha = 0.5; g.fillStyle = gv; g.fillRect(x, y, w, h); g.globalAlpha = 1;
  }
  bgReady = true;
};
bgImg.src = 'bg_deep2.png';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const joinOverlay = document.getElementById('join');
const dniInput = document.getElementById('dniInput');
const colorsBox = document.getElementById('colors');
const joinBtn = document.getElementById('joinBtn');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const playerListBox = document.getElementById('playerList');
const statusBar = document.getElementById('statusBar');
const hintBox = document.getElementById('hint');
const toastBox = document.getElementById('toast');
const helpOverlay = document.getElementById('help');
const clockBox = document.getElementById('clock');
const VERSION = 'v1.17.0 · 27/09/2026'; // fuente de verdad de la versión (vive en game.js)
const versionTag = document.getElementById('versionTag');
if (versionTag) versionTag.textContent = '⚙ ' + VERSION;
console.log('%c🏢 Oficina Virtual ' + VERSION, 'color:#7ee787;font-weight:bold');

function beep(freq, dur, vol = 0.04, type = 'square') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, audioCtx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(gn); gn.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* sin audio */ }
}

// ---------- Red: WS (servidor) o P2P (Trystero, sin servidor) ----------
let ws = null, reconnectTimer = null, sendFn = null;
const USE_P2P = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('p2p');
function send(o) { if (sendFn) { try { sendFn(o); } catch { /* offline */ } } }
function wsUrl() { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; }

function myPublic() {
  const me = state.players.get(state.myId);
  if (!me) return null;
  return {
    id: me.id, name: me.name, char: me.char, color: me.color, x: me.x, y: me.y, dir: me.dir,
    moving: me.moving, seated: me.seated, status: me.status, joinTs: state.joinTs || 0,
    bubble: me.bubble, bubbleUntil: me.bubbleUntil, emote: me.emote, emoteUntil: me.emoteUntil,
    wave: me.wave, waveUntil: me.waveUntil,
  };
}
function sendMoveNow() { const p = myPublic(); if (p) send(Object.assign({ type: 'move' }, p)); }

function connect() { if (USE_P2P) connectP2P(); else connectWS(); }

function connectWS() {
  ws = new WebSocket(wsUrl());
  sendFn = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  ws.onopen = () => {
    toast('✅ Conectado a la oficina');
    if (state.joined) { send({ type: 'profile', id: state.myId, name: state.myName, color: state.myColor }); sendMoveNow(); }
  };
  ws.onclose = () => {
    sendFn = null;
    if (state.joined) { toast('🔌 Desconectado. Reintentando...'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connectWS, 2000); }
  };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handleMsg(m); };
}

// ---------- P2P SIN WebRTC: bus de relays Nostr ----------
// Conexión 100% saliente (wss): atraviesa cualquier NAT, 4G, firewall o Brave.
// Los relays hacen de "canal de radio público": nadie llama a nadie directo.
const BUS_RELAYS = ['relay.damus.io', 'nos.lol', 'relay.primal.net', 'relay.nostr.band', 'nostr.mom', 'relay.snort.social'];
const BUS_ROOM = 'oficina-somospopups-v1';
let busSockets = [];
const busSub = 's' + Math.random().toString(36).slice(2, 8);
let myPub = '', busKey = null, busErr = '';
let p2pPeerCount = 0;
let busSent = 0, busRecv = 0;
const seenEvents = new Set();

// ---------- Firma BIP340 propia (sin CDNs ni dependencias; probada contra relays reales) ----------
const B_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const B_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const B_G = { x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n, y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n };
const bMod = (a, b = B_P) => { const r = a % b; return r >= 0n ? r : b + r; };
function bInv(a, b = B_P) {
  let [old_r, r] = [bMod(a, b), b], [old_x, x] = [1n, 0n];
  while (r !== 0n) { const q = old_r / r; [old_r, r] = [r, old_r - q * r]; [old_x, x] = [x, old_x - q * x]; }
  return bMod(old_x, b);
}
function bAdd(p, q) {
  if (!p) return q; if (!q) return p;
  if (p.x === q.x && bMod(p.y + q.y) === 0n) return null;
  const l = (p.x === q.x && p.y === q.y) ? bMod(3n * p.x * p.x * bInv(2n * p.y)) : bMod((q.y - p.y) * bInv(bMod(q.x - p.x)));
  const x = bMod(l * l - p.x - q.x);
  return { x, y: bMod(l * (p.x - x) - p.y) };
}
function bMul(k, p = B_G) { let r = null; while (k > 0n) { if (k & 1n) r = bAdd(r, p); p = bAdd(p, p); k >>= 1n; } return r; }
const bHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const bUnhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const b2i = (b) => BigInt('0x' + (bHex(b) || '0'));
const bI2b32 = (n) => bUnhex(n.toString(16).padStart(64, '0'));
async function bSha(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return new Uint8Array(d); }
async function bTagged(tag, ...chunks) {
  const t = await bSha(new TextEncoder().encode(tag));
  const all = new Uint8Array(64 + chunks.reduce((n, c) => n + c.length, 0));
  all.set(t, 0); all.set(t, 32);
  let o = 64; for (const c of chunks) { all.set(c, o); o += c.length; }
  return bSha(all);
}
async function makeBusKeys() {
  const sec = crypto.getRandomValues(new Uint8Array(32));
  const d = bMod(b2i(sec), B_N);
  const Pp = bMul(d);
  return { pub: bHex(bI2b32(Pp.x)), d, even: Pp.y % 2n === 0n };
}
async function busSign(msgHex, key) {
  const msg = bUnhex(msgHex);
  const dF = key.even ? key.d : B_N - key.d;
  const px = bI2b32(bMul(key.d).x);
  const rand = crypto.getRandomValues(new Uint8Array(32));
  let k = bMod(b2i(rand), B_N); if (k === 0n) k = 1n;
  const R = bMul(k);
  const kF = R.y % 2n === 0n ? k : B_N - k;
  const rx = bI2b32(R.x);
  const e = bMod(b2i(await bTagged('BIP0340/challenge', rx, px, msg)), B_N);
  const s = bMod(kF + e * dF, B_N);
  return bHex(rx) + bHex(bI2b32(s));
}
async function busEventId(pub, created, kind, tags, content) {
  const ser = JSON.stringify([0, pub, created, kind, tags, content]);
  return bHex(await bSha(new TextEncoder().encode(ser)));
}

function bytesHex(b) { return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function updateNetLabel() {
  const now = performance.now();
  p2pPeerCount = [...state.players.values()].filter((p) => p.id !== state.myId && p.seen && now - p.seen < 9000).length;
}
async function connectP2P() {
  toast('🌐 Conectando oficina P2P...');
  try {
    busKey = await makeBusKeys();
    myPub = busKey.pub;
  } catch (e) {
    busErr = String((e && e.message) || e);
    toast('⚠️ No se pudo generar la clave P2P, reintentando...');
    setTimeout(connectP2P, 8000);
    return;
  }
  sendFn = busSend;
  for (const host of BUS_RELAYS) openRelay(host);
  setTimeout(() => {
    if (busSockets.length) toast(`✅ P2P conectado (${busSockets.length} relays)`);
    else { toast('⚠️ Sin relays a la vista, reintentando...'); setTimeout(connectP2P, 8000); }
  }, 3500);
}
function openRelay(host) {
  let ws;
  try { ws = new WebSocket('wss://' + host); } catch { return; }
  const alive = { ws, host, rx: 0, st: 'abriendo' };
  ws.onopen = () => {
    alive.st = 'ok';
    busSockets.push(alive);
    ws.send(JSON.stringify(['REQ', busSub, { kinds: [20001], '#o': [BUS_ROOM], since: Math.floor(Date.now() / 1000) - 60 }]));
    if (state.joined) sendMoveNow();
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m[0] !== 'EVENT' || !m[2]) return;
    const e = m[2];
    if (e.pubkey === myPub || seenEvents.has(e.id)) return;
    seenEvents.add(e.id); if (seenEvents.size > 800) seenEvents.clear();
    alive.rx++; busRecv++;
    let payload; try { payload = JSON.parse(e.content); } catch { return; }
    if (!payload || !payload.type) return;
    payload._pid = e.pubkey;
    handleMsg(payload);
  };
  ws.onclose = () => { alive.st = 'cerrado'; busSockets = busSockets.filter((s) => s !== alive); setTimeout(() => openRelay(host), 5000); };
  ws.onerror = () => { alive.st = 'error'; try { ws.close(); } catch { /* ya muerto */ } };
}
function busSend(o) {
  if (!busKey || !busSockets.length) return;
  const content = JSON.stringify(o);
  const created = Math.floor(Date.now() / 1000);
  const tags = [['o', BUS_ROOM]];
  (async () => {
    try {
      const id = await busEventId(myPub, created, 20001, tags, content);
      const sig = await busSign(id, busKey);
      busSent++;
      const evt = JSON.stringify(['EVENT', { id, pubkey: myPub, created_at: created, kind: 20001, tags, content, sig }]);
      for (const s of busSockets) { try { if (s.ws.readyState === 1) s.ws.send(evt); } catch { /* relay caído */ } }
    } catch (e) { busErr = String((e && e.message) || e); }
  })();
}
function renderNetPanel() {
  const el = document.getElementById('netPanel');
  if (!el || el.classList.contains('hidden')) return;
  const relays = BUS_RELAYS.map((h) => {
    const s = busSockets.find((x) => x.host === h);
    const st = s ? (s.st === 'ok' ? `<span class="ok">🟢 rx ${s.rx}</span>` : `<span class="bad">${s.st}</span>`) : '<span class="bad">—</span>';
    return `${h}: ${st}`;
  }).join('<br>');
  el.innerHTML = `<div class="np-title">🛰 RED P2P (tocá el reloj para cerrar)</div>${relays}<br>` +
    `enviados: ${busSent} · recibidos: ${busRecv}<br>peers: ${p2pPeerCount} · firma: ${busKey ? '<span class="ok">ok</span>' : '<span class="bad">no</span>'}<br>` +
    (busErr ? `<span class="bad">error: ${busErr.slice(0, 60)}</span><br>` : '') +
    `versión: ${VERSION}`;
}
function netToggle() {
  const el = document.getElementById('netPanel');
  if (el) { el.classList.toggle('hidden'); renderNetPanel(); }
}
let globalErrShown = false;
window.addEventListener('error', (e) => {
  if (globalErrShown) return;
  globalErrShown = true;
  toast('⚠️ Error JS: ' + String(e.message || '').slice(0, 70));
});
window.addEventListener('pagehide', () => { if (state.joined) send({ type: 'bye', id: state.myId, name: state.myName }); });
// latido independiente de la animación: con la pestaña en segundo plano el navegador
// congela los cuadros, pero este intervalo sigue avisando "sigo acá" cada 4 s
setInterval(() => { if (state.joined) sendMoveNow(); }, 4000);
let lastRelayWarn = 0;
setInterval(() => {
  if (USE_P2P && state.joined && busSockets.length === 0 && Date.now() - lastRelayWarn > 30000) {
    lastRelayWarn = Date.now();
    toast('⚠️ Sin relays P2P: tu oficina está en modo local. Revisá Shields/bloqueadores o la conexión.');
  }
}, 10000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.joined) sendMoveNow(); });

const seenNonces = new Set();
function dedupe(msg) {
  if (!msg.nonce) return false;
  if (seenNonces.has(msg.nonce)) return true;
  seenNonces.add(msg.nonce);
  if (seenNonces.size > 400) seenNonces.clear();
  return false;
}
function handleMsg(msg) {
  switch (msg.type) {
    case 'move':
      if (msg.id && msg.id === state.myId) {
        // doble sesión del mismo DNI (P2P): el que entró último se va
        if (msg.joinTs && state.joinTs && msg.joinTs !== state.joinTs && state.joinTs > msg.joinTs) {
          ejectSelf('⚠️ Tu DNI se abrió en otro dispositivo. Cerrá una de las dos pestañas.');
        }
        break;
      }
      if (msg.id) upsertRemote(msg, false);
      break;
    case 'welcome':
      state.myId = msg.id;
      for (const p of msg.players) upsertRemote(p, true);
      renderPlayerList();
      break;
    case 'state': {
      for (const p of msg.players) if (p.id !== state.myId) upsertRemote(p, false);
      const ids = new Set(msg.players.map((p) => p.id));
      for (const id of [...state.players.keys()]) if (id !== state.myId && !ids.has(id)) state.players.delete(id);
      renderPlayerList();
      break;
    }
    case 'joined': upsertRemote(msg.player, true); renderPlayerList(); maybeMusicForNewcomer(); break;
    case 'music': if (!dedupe(msg)) applyMusic(msg); break;
    case 'left':
      state.players.delete(msg.id);
      addChat(null, `${msg.name} salió de la oficina`, 'system');
      renderPlayerList();
      break;
    case 'bye': {
      const p = state.players.get(msg.id);
      if (p) { state.players.delete(msg.id); addChat(null, `${p.name} salió de la oficina`, 'system'); renderPlayerList(); }
      break;
    }
    case 'system': addChat(null, msg.text, 'system'); break;
    case 'chat': {
      if (dedupe(msg)) break;
      const mine = msg.from === state.myName, isW = !!msg.to;
      if (isW && !mine && msg.to !== state.myName) break;
      addChat(msg.from, msg.text, isW ? 'whisper' : 'normal', msg.to, msg.att);
      if (!mine && (!isW || msg.to === state.myName)) beep(isW ? 880 : 520, 0.07);
      break;
    }
    case 'status': { const p = state.players.get(msg.id); if (p) p.status = msg.status; renderPlayerList(); break; }
    case 'emote': { const p = state.players.get(msg.id); if (p) { p.emote = msg.emote; p.emoteUntil = performance.now() + 3000; } break; }
    case 'nudge': { if (!dedupe(msg)) localZumb(msg.from || 'Alguien', false, msg.id); break; }
    case 'wave': {
      const p = state.players.get(msg.id);
      if (p) { p.wave = true; p.waveUntil = performance.now() + 1500; }
      if (msg.at && msg.at === state.myName) { addChat(null, `${p ? p.name : 'Alguien'} te saludó 👋`, 'system'); beep(740, 0.09); }
      break;
    }
    case 'profile': { const p = state.players.get(msg.id); if (p) { p.name = msg.name; p.char = msg.char || p.char; p.color = msg.color; } renderPlayerList(); break; }
    case 'auth-fail':
      ejectSelf(msg.reason === 'dup' ? '⚠️ Ese DNI ya está en la oficina (doble sesión).' : '⛔ DNI no autorizado.');
      break;
    case 'arealive':
      if (msg.id === state.myId && state.joined) send({ type: 'imalive', id: state.myId, nonce: msg.nonce, joinTs: state.joinTs });
      break;
    case 'imalive':
      if (pendingProbe && pendingProbe.nonce === msg.nonce) { const cb = pendingProbe.cb; pendingProbe = null; cb(true); }
      break;
  }
}

function upsertRemote(p, snap) {
  let cur = state.players.get(p.id);
  if (!cur) {
    cur = { ...p, tx: p.x, ty: p.y };
    state.players.set(p.id, cur);
    if (state.joined && p.id !== state.myId) { addChat(null, `${p.name} entró a la oficina`, 'system'); beep(660, 0.08); if (USE_P2P) maybeMusicForNewcomer(); }
  }
  cur.pid = p._pid || cur.pid;
  cur.seen = performance.now();
  cur.joinTs = p.joinTs || cur.joinTs;
  cur.name = p.name; cur.char = p.char || cur.char; cur.color = p.color; cur.dir = p.dir;
  cur.moving = p.moving; cur.status = p.status; cur.seated = !!p.seated;
  cur.tx = p.x; cur.ty = p.y;
  if (snap || p.seated) { cur.x = p.x; cur.y = p.y; }
  if (p.bubble && cur.bubble !== p.bubble) { cur.bubble = p.bubble; cur.bubbleUntil = performance.now() + 5000; }
  resolveSeatConflict();
}

// ---------- UI ----------
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function addChat(from, text, cls, to, att) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + cls;
  if (cls === 'system') div.textContent = '· ' + text;
  else if (cls === 'whisper') div.innerHTML = `<b>${esc(from === state.myName ? 'vos' : from)}</b> ${esc(text)} <i>(privado${from === state.myName ? ' a ' + esc(to) : ''})</i>`;
  else div.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
  if (att && att.data) {
    if (att.kind === 'img') {
      const img = document.createElement('img');
      img.className = 'chat-att';
      img.src = `data:${att.mime || 'image/jpeg'};base64,${att.data}`;
      img.onclick = () => window.open(img.src, '_blank');
      div.appendChild(img);
    } else if (att.kind === 'audio') {
      const au = document.createElement('audio');
      au.controls = true; au.className = 'chat-att-a';
      au.src = `data:${att.mime || 'audio/webm'};base64,${att.data}`;
      div.appendChild(au);
    }
  }
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function sendChat(raw, att) {
  const text = raw.trim();
  if (!text && !att) return;
  if (att && att.data && att.data.length > 200000) { toast('⚠️ Adjunto demasiado pesado para el bus P2P'); return; }
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const w = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
  if (w) { send({ type: 'chat', id: state.myId, from: state.myName, text: w[2], to: w[1], nonce, att }); addChat(state.myName, w[2], 'whisper', w[1], att); }
  else if (text.startsWith('/')) addChat(null, 'Comando desconocido. Usá /w nombre mensaje', 'system');
  else { send({ type: 'chat', id: state.myId, from: state.myName, text, nonce, att }); addChat(state.myName, text, 'normal', null, att); }
}
let myStatus = 'disponible';
let shakeUntil = 0, zumbCd = 0;
function buildStatusBar() {
  statusBar.innerHTML = '';
  STATUS_KEYS.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'status-btn'; b.dataset.status = k;
    b.innerHTML = `${STATUS_INFO[k].emoji} ${STATUS_INFO[k].label} <span class="key">${i + 1}</span>`;
    b.onclick = () => setStatus(k);
    statusBar.appendChild(b);
  });
  const z = document.createElement('button');
  z.className = 'status-btn zumbido';
  z.innerHTML = '💨 Zumbido! <span class="key">4</span>';
  z.onclick = () => doZumbido();
  statusBar.appendChild(z);
}
function setStatus(k, silent) {
  if (k === myStatus) k = 'disponible'; // tocar el estado activo te devuelve a disponible
  myStatus = k; send({ type: 'status', id: state.myId, status: k });
  const me = state.players.get(state.myId); if (me) me.status = k;
  document.querySelectorAll('.status-btn').forEach((b) => b.classList.toggle('active', b.dataset.status === k));
  renderPlayerList();
  if (!silent) beep(440, 0.05, 0.03, 'sine');
}

// ---------- Zumbido! (nudge estilo Messenger, con pedo) ----------
function fartSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const R = Math.random;
    const dur = 0.55 + R() * 0.35;               // cada pedo sale distinto
    const base = 75 + R() * 55;                  // tono grave base
    // 1) cuerpo: serrucho grave que cae, con temblor irregular (el "brrrr")
    const o = audioCtx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.32, t + dur);
    const wob = audioCtx.createOscillator(); wob.type = 'square';
    wob.frequency.value = 17 + R() * 12;         // rateo del temblor
    const wobG = audioCtx.createGain(); wobG.gain.value = base * 0.22;
    wob.connect(wobG); wobG.connect(o.frequency);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // salpicadura: modulá la amplitud para el "tret-tret"
    const spl = audioCtx.createOscillator(); spl.type = 'square';
    spl.frequency.value = 21 + R() * 10;
    const splG = audioCtx.createGain(); splG.gain.value = 0.16;
    spl.connect(splG); splG.connect(g.gain);
    o.connect(g); g.connect(audioCtx.destination);
    // 2) aire: ruido pasado por banda estrecha que se abre y se cierra
    const nb = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    const ns = audioCtx.createBufferSource(); ns.buffer = nb;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(base * 3, t);
    bp.frequency.exponentialRampToValueAtTime(base * 1.1, t + dur);
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.30, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
    ns.connect(bp); bp.connect(ng); ng.connect(audioCtx.destination);
    // 3) colita final: el "pfft" agudo del cierre
    const tail = audioCtx.createBufferSource();
    const tb = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.09), audioCtx.sampleRate);
    const td = tb.getChannelData(0);
    for (let i = 0; i < td.length; i++) td[i] = (R() * 2 - 1) * (1 - i / td.length);
    tail.buffer = tb;
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const tg = audioCtx.createGain(); tg.gain.value = 0.0;
    tg.gain.setValueAtTime(0.0001, t + dur - 0.02);
    tg.gain.exponentialRampToValueAtTime(0.18, t + dur + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.09);
    tail.connect(hp); hp.connect(tg); tg.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.05);
    wob.start(t); wob.stop(t + dur);
    spl.start(t); spl.stop(t + dur);
    ns.start(t); ns.stop(t + dur);
    tail.start(t + dur - 0.02); tail.stop(t + dur + 0.1);
  } catch { /* sin audio, igual sacude */ }
}
function localZumb(name, mine, pid) {
  fartSound();
  shakeUntil = performance.now() + 650;
  addChat(null, mine ? '💨 ¡Mandaste un zumbido!' : `💨 ¡Zumbido de ${name}!`, 'system');
}
function doZumbido() {
  const now = performance.now();
  if (now < zumbCd) { toast('💨 El zumbido se está recargando…'); return; }
  zumbCd = now + 2500;
  send({ type: 'nudge', id: state.myId, from: state.myName, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) });
  localZumb(state.myName, true, state.myId);
}

// ---------- Radio de la oficina (YouTube sincronizado, SIN el script oficial: lo bloquean los navegadores) ----------
// Controlamos el iframe embed directo por postMessage (protocolo público del player).
let ytFrame = null, ytCurVid = null, ytPos = 0, ytLoadPromise = null;
const music = { vid: null, playing: false, amDJ: false };
function parseVid(url) {
  const m = (url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function ytCmd(fn, args) {
  try { if (ytFrame) ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: fn, args: args || [] }), 'https://www.youtube.com'); } catch { /* iframe ocupado */ }
}
function ytEnsure(vid, autoplay, start) {
  if (ytFrame && ytCurVid === vid) return Promise.resolve(ytFrame);
  if (ytLoadPromise) return ytLoadPromise;
  ytLoadPromise = new Promise((res) => {
    const box = document.getElementById('ytBox');
    if (ytFrame) { ytFrame.remove(); ytFrame = null; ytCurVid = null; }
    const f = document.createElement('iframe');
    f.setAttribute('allow', 'autoplay; encrypted-media');
    f.src = `https://www.youtube.com/embed/${vid}?enablejsapi=1&controls=0&playsinline=1&disablekb=1&autoplay=${autoplay ? 1 : 0}${start ? '&start=' + Math.floor(start) : ''}`;
    const done = () => {
      ytFrame = f; ytCurVid = vid; ytLoadPromise = null;
      const listen = () => ytPost(f, { event: 'listening', id: 'ofv', channel: 'widget' });
      listen(); setTimeout(listen, 700); setTimeout(listen, 1800); setTimeout(listen, 3500);
      try { ytPost(f, { event: 'command', func: 'setVolume', args: [60] }); } catch {}
      res(f);
    };
    f.onload = done;
    f.onerror = () => { ytLoadPromise = null; res(null); };
    box.appendChild(f);
    setTimeout(() => { if (!ytFrame) done(); }, 7000);
  });
  return ytLoadPromise;
}
function ytPost(f, obj) { try { f.contentWindow.postMessage(JSON.stringify(obj), 'https://www.youtube.com'); } catch { /* aún no listo */ } }
window.addEventListener('message', (ev) => {
  let host = '';
  try { host = new URL(ev.origin).hostname; } catch { return; }
  if (host !== 'www.youtube.com' && host !== 'youtube.com') return;
  let d = ev.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
  if (d && d.event === 'infoDelivery' && d.info && typeof d.info.currentTime === 'number') ytPos = d.info.currentTime;
});
function musicNowPos() { return ytPos; }
function sendMusic(act, vid, pos) {
  music.amDJ = true; music.vid = vid; music.playing = act === 'play';
  send({ type: 'music', act, vid, pos, at: Date.now(), from: state.myName, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) });
  updateMpNow();
}
function applyMusic(msg, silent) {
  const target = msg.pos + Math.max(0, (Date.now() - msg.at) / 1000);
  music.vid = msg.vid; music.playing = msg.act === 'play';
  if (msg.act === 'stop') { ytCmd('stopVideo'); updateMpNow(); return; }
  if (msg.act === 'pause') { ytCmd('pauseVideo'); updateMpNow(); return; }
  (async () => {
    if (ytCurVid !== msg.vid) {
      await ytEnsure(msg.vid, true, target);
    } else {
      await ytEnsure(msg.vid, true, 0);
      ytCmd('seekTo', [target, true]);
      ytCmd('playVideo');
    }
  })();
  if (!silent && msg.act === 'play' && msg.from) toast(`🎵 ${msg.from} puso música para todos`);
  updateMpNow();
}
function maybeMusicForNewcomer() {
  if (music.amDJ && music.playing && music.vid) sendMusic('play', music.vid, musicNowPos());
}
function updateMpNow() {
  const el = document.getElementById('mpNow');
  if (!el) return;
  el.textContent = music.playing && music.vid ? `Sonando para todos: youtu.be/${music.vid}` : 'Nada sonando';
}
function mpToggle() { const p = document.getElementById('musicPanel'); if (p) p.classList.toggle('hidden'); }
function mpPlay() {
  const input = document.getElementById('musicUrl');
  const url = input ? input.value.trim() : '';
  let vid = parseVid(url);
  let pos = 0;
  if (vid && vid !== music.vid) pos = 0;
  if (!vid) { vid = music.vid; pos = musicNowPos(); }
  if (!vid) { toast('🎵 Pegá primero un link de YouTube'); return; }
  sendMusic('play', vid, pos);
  applyMusic({ act: 'play', vid, pos, at: Date.now(), from: state.myName }, true);
}
function mpPause() {
  if (!music.vid) return;
  const pos = musicNowPos();
  sendMusic('pause', music.vid, pos);
  applyMusic({ act: 'pause', vid: music.vid, pos, at: Date.now(), from: state.myName }, true);
}
function mpStop() {
  if (!music.vid) return;
  sendMusic('stop', music.vid, 0);
  applyMusic({ act: 'stop', vid: music.vid, pos: 0, at: Date.now(), from: state.myName }, true);
}
let toastTimer = null;
function toast(t) { toastBox.textContent = t; toastBox.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2600); }

// ---------- Adjuntos: imágenes y audios de voz ----------
let pendingAtt = null, mediaRec = null, recChunks = [];
function takeAtt() { const a = pendingAtt; pendingAtt = null; updateAttChip(); return a; }
function clearAtt() { pendingAtt = null; updateAttChip(); }
function updateAttChip() {
  const chip = document.getElementById('attChip');
  if (!chip) return;
  if (!pendingAtt) { chip.classList.add('hidden'); chip.innerHTML = ''; return; }
  chip.classList.remove('hidden');
  chip.innerHTML = pendingAtt.kind === 'img'
    ? `<img src="data:${pendingAtt.mime};base64,${pendingAtt.data}"> 🖼️ imagen lista <button onclick="clearAtt()">✕</button>`
    : `🎤 audio listo (~${Math.max(1, Math.round(pendingAtt.data.length * 0.75 / 1024))} KB) <button onclick="clearAtt()">✕</button>`;
}
function onFilePicked(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) { toast('📎 Por ahora solo imágenes 🖼️'); return; }
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    const max = 360;
    const sc = Math.min(1, max / Math.max(im.width, im.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(im.width * sc));
    cv.height = Math.max(1, Math.round(im.height * sc));
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    const dataUrl = cv.toDataURL('image/jpeg', 0.65);
    pendingAtt = { kind: 'img', mime: 'image/jpeg', data: dataUrl.split(',')[1] };
    URL.revokeObjectURL(url);
    updateAttChip();
    toast('🖼️ Imagen lista: tocá ➤ para enviar');
  };
  im.onerror = () => toast('⚠️ No pude leer esa imagen');
  im.src = url;
}
function pickMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (!window.MediaRecorder) return '';
  for (const m of opts) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* siga */ } }
  return '';
}
let recSend = false, recT0 = 0;
function startRec() {
  if (mediaRec && mediaRec.state === 'recording') return;
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('⚠️ Tu navegador no soporta grabar audio'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    recChunks = [];
    const mime = pickMime();
    mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : { audioBitsPerSecond: 16000 });
    mediaRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const mb = document.getElementById('micBtn');
      if (mb) mb.classList.remove('rec');
      const dur = Date.now() - recT0;
      const blob = new Blob(recChunks, { type: mediaRec.mimeType || 'audio/webm' });
      if (!recSend || dur < 800) { if (recSend) toast('⚠️ Muy corto: mantené 🎤 apretado mientras hablás'); return; }
      if (blob.size > 150 * 1024) { toast('⚠️ Audio demasiado largo (máx ~30 s)'); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const att = { kind: 'audio', mime: blob.type || 'audio/webm', data: String(fr.result).split(',')[1] };
        sendChat('', att);
        toast('🎤 Audio enviado');
      };
      fr.readAsDataURL(blob);
    };
    mediaRec.start();
    recT0 = Date.now(); recSend = true;
    const mb = document.getElementById('micBtn');
    if (mb) mb.classList.add('rec');
    toast('🎤 Grabando… soltá para enviar');
    setTimeout(() => { if (mediaRec && mediaRec.state === 'recording') mediaRec.stop(); }, 30000);
  }).catch(() => toast('⚠️ Sin permiso de micrófono'));
}
function stopRec() { if (mediaRec && mediaRec.state === 'recording') mediaRec.stop(); }
function renderPlayerList() {
  const list = [...state.players.values()];
  playerListBox.innerHTML = '<div class="pl-title">👥 En la oficina (' + list.length + ')</div>' +
    list.map((p) => {
      const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
      const isMe = p.id === state.myId;
      return `<div class="pl-row${isMe ? ' me' : ''}"><span class="dot" style="background:${(CHAR_DEF[p.char] || CHAR_DEF.ger).dot}"></span>${esc(p.name)}${isMe ? ' (vos)' : ''}${p.seated ? ' 🪑' : ''} <span class="pl-status">${st.emoji} ${st.label}</span></div>`;
    }).join('');
}

// ---------- Movimiento en perspectiva ----------
function walkable(x, y) {
  if (y < FLOOR.yTop + 10 || y > FLOOR.yBot - 6) return false;
  const t = (y - FLOOR.yTop) / (FLOOR.yBot - FLOOR.yTop);
  const xl = lerp(FLOOR.xlTop, FLOOR.xlBot, t) + 24;
  const xr = lerp(FLOOR.xrTop, FLOOR.xrBot, t) - 24;
  return x >= xl && x <= xr;
}
function seatNear(x, y, r = 110) {
  let best = null, bd = r;
  for (const s of SEATS) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function seatOwner(s, exceptId) {
  for (const p of state.players.values()) {
    if (p.id !== exceptId && p.seated && Math.hypot(p.x - s.x, p.y - s.y) < 50) return p;
  }
  return null;
}
function resolveSeatConflict() {
  const me = state.players.get(state.myId);
  if (!me || !me.seated || !state.joined) return;
  const myS = SEATS.find((s) => Math.hypot(me.x - s.x, me.y - s.y) < 50);
  if (!myS) return;
  for (const p of state.players.values()) {
    if (p.id === state.myId || !p.seated) continue;
    if (Math.hypot(p.x - myS.x, p.y - myS.y) < 50 && (p.joinTs || 0) && (state.joinTs || 0) && p.joinTs < state.joinTs) {
      me.seated = false;
      me.x = myS.x + (myS.x < VW / 2 ? 90 : -90);
      me.y = myS.y + 40;
      toast(`😅 ${p.name} llegó antes a ese puesto`);
      sendMoveNow();
      return;
    }
  }
}
function freeSeat() {
  for (const s of SEATS) {
    let taken = false;
    for (const p of state.players.values()) if (Math.hypot(p.x - s.x, p.y - s.y) < 80) { taken = true; break; }
    if (!taken) return s;
  }
  return null;
}
function nearAnySeat(x, y) { return SEATS.some((s) => Math.hypot(s.x - x, s.y - y) < 55); }
function zoneAt(x, y) {
  for (const z of ZONES) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
  return null;
}

window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; chatInput.blur(); }
    if (e.key === 'Escape') { chatInput.value = ''; chatInput.blur(); }
    e.stopPropagation(); return;
  }
  if (!state.joined) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter') { chatInput.focus(); e.preventDefault(); return; }
  if (e.key.toLowerCase() === 'h') { helpOverlay.classList.toggle('hidden'); return; }
  if (e.key.toLowerCase() === 'p') { mpToggle(); return; }
  if (e.key === 'Escape') { helpOverlay.classList.add('hidden'); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 3) { setStatus(STATUS_KEYS[n - 1]); return; }
  if (n === 4) { doZumbido(); return; }
  const emoteMap = { z: '👋', x: '😂', c: '🎉', v: '👍', b: '🤔', n: '🔥', m: '☕' };
  const em = emoteMap[e.key.toLowerCase()];
  if (em) { send({ type: 'emote', id: state.myId, emote: em }); const me = state.players.get(state.myId); if (me) { me.emote = em; me.emoteUntil = performance.now() + 3000; } return; }
  if (e.key.toLowerCase() === 'f') {
    const near = nearestPlayer();
    send({ type: 'wave', id: state.myId, at: near ? near.name : null });
    const me = state.players.get(state.myId);
    if (me) { me.wave = true; me.waveUntil = performance.now() + 1500; }
    if (near) { addChat(null, `Saludaste a ${near.name} 👋`, 'system'); beep(600, 0.06); }
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function nearestPlayer(maxDist = 220) {
  const me = state.players.get(state.myId); if (!me) return null;
  let best = null, bd = maxDist;
  for (const p of state.players.values()) {
    if (p.id === state.myId) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ---------- Join (autenticación por DNI) ----------
function previewChar(charKey) {
  const pv = document.getElementById('avatarPreview');
  if (!pv) return;
  const g = pv.getContext('2d');
  pv.setAttribute('data-char', charKey || '');
  // El sprite puede ser el PNG de referencia (digital painting) o el chibi de la
  // grilla. Los de arriba llevan antialiasing y reescalan bien con smoothing; los
  // de abajo son pixel art duro y necesitan nearest-neighbor. Por eso el modo se
  // decide acá y no en el render de la escena.
  g.imageSmoothingEnabled = !!(charKey && assetsReady && charAssets[charKey]);
  g.clearRect(0, 0, pv.width, pv.height);
  if (!charKey) return;
  const spr = getSprite(charKey, 'down', 0);
  const h = 132, w = h * (spr.width / spr.height);
  g.drawImage(spr, (pv.width - w) / 2, (pv.height - h) / 2, w, h);
}
function dniError(msg) {
  const e = document.getElementById('dniError');
  if (!e) return;
  e.textContent = msg || '';
  e.classList.toggle('show', !!msg);
}
function seatFor(entry) {
  const pref = SEATS[entry.seat];
  const taken = (s) => { for (const p of state.players.values()) if (p.id !== state.myId && Math.hypot(p.x - s.x, p.y - s.y) < 80) return true; return false; };
  if (pref && !taken(pref)) return pref;
  for (const s of SEATS) if (!taken(s)) return s;
  return null;
}
function join() {
  const dni = (dniInput.value || '').replace(/\D/g, '');
  const entry = ROSTER.find((r) => r.dni === dni);
  if (!entry) { dniError('⛔ DNI no autorizado: la oficina es privada del equipo.'); return; }
  const dup = [...state.players.values()].find((p) => p.char === entry.char && p.id !== state.myId && performance.now() - (p.seen || 0) < 9000);
  if (dup) { dniError(`⚠️ ${entry.name} ya está en la oficina desde otro dispositivo.`); return; }
  dniError('');
  state.myChar = entry.char; state.myName = entry.name; state.joined = true; state.joinTs = state.joinTs || Date.now();
  if (USE_P2P) state.myId = entry.char;
  const seat = seatFor(entry);
  const sx = seat ? seat.x : VW / 2, sy = seat ? seat.y : 820;
  const me = {
    id: state.myId || 'me', name: entry.name, char: entry.char, color: 0,
    x: sx, y: sy, tx: sx, ty: sy,
    dir: seat ? seat.face : 'up', moving: false, seated: !!seat,
    status: seat ? 'codeando' : 'disponible',
    bubble: null, bubbleUntil: 0, emote: null, emoteUntil: 0, wave: false, waveUntil: 0,
  };
  if (state.myId) state.players.set(state.myId, me);
  joinOverlay.classList.add('hidden');
  send({ type: 'profile', id: state.myId, name: entry.name, char: entry.char, dni });
  sendMoveNow();
  if (seat) { setStatus('codeando', true); addChat(null, 'Te sentaste en tu puesto 💻 — WASD para levantarte', 'system'); }
  addChat(null, `¡Bienvenido/a a la oficina, ${entry.name}! Presioná H para la ayuda.`, 'system');
  beep(523, 0.09); setTimeout(() => beep(784, 0.12), 100);
  renderPlayerList();
}
function ejectSelf(reason) {
  state.joined = false;
  state.players.delete(state.myId);
  sendFn = null;
  joinOverlay.classList.remove('hidden');
  dniError(reason);
}

// ---------- Bucle ----------
let lastT = performance.now(), animT = 0;
function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  viewScale = Math.min(canvas.width / VW, canvas.height / VH);
  viewOX = (canvas.width - VW * viewScale) / 2;
  viewOY = (canvas.height - VH * viewScale) / 2;
  ctx.imageSmoothingEnabled = false;
  layoutMobile();
}
function layoutMobile() {
  const mob = window.matchMedia('(max-width: 900px)').matches;
  const stickEl = document.getElementById('stick');
  const chatEl = document.getElementById('chatPanel');
  if (!mob) {
    if (stickEl) stickEl.style.bottom = '';
    if (chatEl) { chatEl.style.top = ''; chatEl.style.bottom = ''; }
    return;
  }
  // diseño congelado v1.11.1: escena centrada, chat bajo la imagen (sin meterse
  // en la columna del stick) y stick centrado en la franja que queda abajo
  const sceneBottom = viewOY + VH * viewScale;
  const h = canvas.height;
  const stickH = 92;
  const band = h - sceneBottom;
  const stickBottom = Math.max(10, (band - stickH) / 2);
  if (stickEl) stickEl.style.bottom = stickBottom + 'px';
  if (chatEl) {
    chatEl.style.top = (sceneBottom + 6) + 'px';
    chatEl.style.bottom = ''; // el CSS móvil lo deja a 8px del borde, al lado del stick
  }
}
window.addEventListener('resize', resize);

const skyCv = document.createElement('canvas');
skyCv.width = WIN.w; skyCv.height = WIN.h;
function drawSky(now, hf, sky) {
  const g = skyCv.getContext('2d');
  const W = WIN.w, H = WIN.h;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky.top); grad.addColorStop(1, sky.bot);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  if (sky.star > 0.02) {
    for (let i = 0; i < 60; i++) {
      const sx = rnd(i, 1, 2) * W, sy = rnd(i, 2, 3) * (H * 0.5);
      const tw = 0.5 + 0.5 * Math.sin(now * 0.003 + i * 2.1);
      g.fillStyle = `rgba(255,255,255,${(sky.star * tw * 0.9).toFixed(2)})`;
      g.fillRect(sx, sy, 1, 1);
    }
  }
  if (hf >= 6 && hf <= 19) {
    const t = (hf - 6) / 13;
    const sx = t * W, sy = H * 0.75 - Math.sin(Math.PI * t) * H * 0.55;
    g.fillStyle = 'rgba(255,215,106,0.35)'; g.beginPath(); g.arc(sx, sy, 8, 0, 7); g.fill();
    g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
  } else {
    const hn = (hf >= 19 ? hf - 19 : hf + 5) / 11;
    const mx = hn * W, my = H * 0.7 - Math.sin(Math.PI * hn) * H * 0.5;
    g.fillStyle = '#e8ecf2'; g.beginPath(); g.arc(mx, my, 5, 0, 7); g.fill();
    g.fillStyle = '#c9cfda'; g.fillRect(mx - 2, my - 2, 2, 2);
  }
  const cloudA = 0.85 - sky.star * 0.6;
  for (let i = 0; i < 4; i++) {
    const cx = ((now * 0.004 * (1 + i * 0.3) + i * 73) % (W + 40)) - 20;
    const cy = 8 + i * 10;
    g.fillStyle = `rgba(255,255,255,${cloudA.toFixed(2)})`;
    g.fillRect(cx, cy, 24, 4); g.fillRect(cx + 4, cy - 2, 14, 2); g.fillRect(cx + 6, cy + 4, 12, 2);
  }
  const night = sky.star;
  for (const b of BUILDINGS) {
    g.fillStyle = night > 0.5 ? '#1c2438' : (b.brick ? '#b07860' : '#9aa0a8');
    g.fillRect(b.x, H - b.h, b.w, b.h);
    for (let wy = H - b.h + 3; wy < H - 3; wy += 4) {
      for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 3) {
        const on = rnd(wx, wy, 21) > 0.45;
        if (night > 0.4) { if (on) { g.fillStyle = `rgba(255,215,106,${(0.4 + night * 0.6).toFixed(2)})`; g.fillRect(wx, wy, 1, 2); } }
        else { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, 1, 2); }
      }
    }
  }
  g.fillStyle = '#e8e8ec';
  g.fillRect(0, 0, W, 3); g.fillRect(0, H - 4, W, 4);
  g.fillRect(W / 3 - 2, 0, 4, H); g.fillRect(2 * W / 3 - 2, 0, 4, H);
}

function update(dt) {
  const me = state.players.get(state.myId);
  if (!me || !state.joined) return;
  let dx = 0, dy = 0;
  if (document.activeElement !== chatInput) {
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
  }
  if (state.stick && state.stick.active) {
    if (Math.abs(state.stick.x) > 0.12) dx += state.stick.x;
    if (Math.abs(state.stick.y) > 0.12) dy += state.stick.y;
  }
  const want = dx !== 0 || dy !== 0;

  if (me.seated && want) {
    me.seated = false;
    const toward = me.x < VW / 2 ? 1 : -1;
    let nx = me.x + toward * 120, ny = me.y + 40;
    ny = clamp(ny, FLOOR.yTop + 12, FLOOR.yBot - 8);
    if (!walkable(nx, ny)) nx = me.x + toward * 40;
    me.x = nx; me.y = ny;
    sendMoveNow();
    lastSend = performance.now();
  }
  if (want && !me.seated) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    const sp = SPEED * clamp(depthScale(me.y) / 12, 0.35, 1.6);
    const nx = me.x + dx * sp * dt, ny = me.y + dy * sp * dt;
    if (walkable(nx, me.y)) me.x = nx;
    if (walkable(me.x, ny)) me.y = ny;
    me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    me.moving = true; animT += dt * 1000;
  } else {
    me.moving = false;
    if (!me.seated) {
      const seat = seatNear(me.x, me.y);
      if (seat) {
        const occ = seatOwner(seat, state.myId);
        if (occ) {
          const t = performance.now();
          if (!me.seatWarn || t - me.seatWarn > 4000) { me.seatWarn = t; toast(`🪑 Ese puesto es de ${occ.name}`); }
        } else {
          me.seated = true; me.dir = seat.face; me.x = seat.x; me.y = seat.y;
          sendMoveNow();
          lastSend = performance.now();
        }
      }
    }
  }
  me.tx = me.x; me.ty = me.y;

  const now = performance.now();
  if (me.moving && now - lastSend > SEND_MS) { lastSend = now; sendMoveNow(); }
  else if (!me.moving && now - lastSend > 1000) { lastSend = now; sendMoveNow(); }

  const z = me.seated ? { name: 'tu puesto', status: 'codeando' } : (nearAnySeat(me.x, me.y) ? null : zoneAt(me.x, me.y));
  const zKey = z ? z.name : null;
  if (zKey !== lastZone) {
    lastZone = zKey;
    if (me.status === 'ausente') { /* 🏃 ausente: no resucitar automáticamente */ }
    else if (z) {
      setStatus(z.status, true);
      if (z.name !== 'tu puesto') toast(`📍 ${z.name} — ${STATUS_INFO[z.status].emoji} ${STATUS_INFO[z.status].label}`);
    } else setStatus('disponible', true);
  }

  for (const p of state.players.values()) {
    if (p.id === state.myId) continue;
    if (p.seated) { p.x = p.tx; p.y = p.ty; continue; }
    const k = Math.min(1, dt * 12);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
  }

  // P2P: podar compañeros silenciosos y refrescar el 📡
  if (USE_P2P) {
    updateNetLabel();
    for (const p of [...state.players.values()]) {
      if (p.id !== state.myId && p.seen && now - p.seen > 75000) {
        state.players.delete(p.id);
        addChat(null, `${p.name} salió de la oficina`, 'system');
        renderPlayerList();
      }
    }
  }

  const near = nearestPlayer();
  if (near) {
    hintBox.innerHTML = `Cerca de <b>${esc(near.name)}</b> — <span class="key">F</span> saludar · <span class="key">/w ${esc(near.name)} msg</span> susurrar`;
    hintBox.classList.add('show');
  } else hintBox.classList.remove('show');
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c0e14';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOX, viewOY);

  // Los PNG de referencia son digital painting con antialiasing: reescalados con
  // nearest-neighbor se ven serrados. Todo lo demás (fondo, escenario, chibi de
  // la grilla) es pixel art duro y depende de nearest, así que el modo se decide
  // por personaje dentro del loop de jugadores.

  const now = performance.now();
  // sacudón de zumbido (estilo Messenger, pero con pedo)
  if (now < shakeUntil) {
    ctx.translate(Math.round((Math.random() - 0.5) * 14), Math.round((Math.random() - 0.5) * 14));
  }
  const d = new Date();
  const hf = d.getHours() + d.getMinutes() / 60;
  const sky = skyNow(hf);

  if (bgReady) ctx.drawImage(bgCv, 0, 0, VW, VH);
  else { ctx.fillStyle = '#20242e'; ctx.fillRect(0, 0, VW, VH); }

  // Marca visible de la zona café (decal en el piso)
  {
    const z = ZONES[0];
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,106,0.30)'; ctx.fillStyle = 'rgba(255,190,80,0.07)';
    ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
    ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    ctx.setLineDash([]);
    ctx.font = '18px serif'; ctx.textAlign = 'center';
    ctx.fillText('☕', (z.x0 + z.x1) / 2, z.y0 + 24 + Math.sin(now / 400) * 3);
    ctx.restore();
  }

  drawSky(now, hf, sky);
  ctx.drawImage(skyCv, WIN.x, WIN.y);

  if (sky.patchA > 0.02) {
    ctx.globalAlpha = sky.patchA;
    ctx.fillStyle = sky.patch;
    ctx.beginPath();
    ctx.moveTo(509, 458); ctx.lineTo(719, 458); ctx.lineTo(820, 700); ctx.lineTo(410, 700);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (sky.amb > 0.01) {
    ctx.fillStyle = `rgba(8,11,32,${(sky.amb * 0.55).toFixed(2)})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(90,140,255,${(0.10 * sky.amb * 3).toFixed(2)})`;
    ctx.fillRect(19, 345, 245, 140); ctx.fillRect(341, 345, 98, 75);
    ctx.fillRect(775, 345, 98, 75); ctx.fillRect(962, 345, 210, 140);
    ctx.fillStyle = `rgba(59,130,246,${(0.14 * sky.amb * 3).toFixed(2)})`;
    ctx.fillRect(0, 209, 318, 51); ctx.fillRect(327, 262, 140, 33);
    ctx.fillRect(757, 262, 140, 33); ctx.fillRect(906, 209, 289, 51);
    for (const [lx, ly] of [[313, 51], [878, 51], [420, 158], [789, 158], [477, 205], [733, 205]]) {
      const rg = ctx.createRadialGradient(lx, ly, 3, lx, ly, 70);
      rg.addColorStop(0, `rgba(255,224,160,${(0.5 * sky.amb * 2).toFixed(2)})`);
      rg.addColorStop(1, 'rgba(255,224,160,0)');
      ctx.fillStyle = rg; ctx.fillRect(lx - 70, ly - 70, 140, 140);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const frame = Math.floor(animT / 160) % 2;
  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    if (p.status === 'ausente') continue; // 🏃 ¡Ya vengo!: el personaje se va de la escena (sigue en la lista y su puesto queda reservado)
    let topY, shR, fs;
    if (p.seated) {
      const ss = sitScale(p.y);
      const sframe = Math.floor(now / 280) % 2;
      const spr = getSitSprite(p.char || 'ger', p.x < VW / 2 ? 'left' : 'right', true, sframe);
      const w = 41 * ss, h = 48 * ss;
      ctx.imageSmoothingEnabled = false;   // el sentado es pixel art de grilla
      ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
      topY = p.y - h; shR = 15 * ss; fs = Math.round(3.1 * ss);
    } else {
      const s = depthScale(p.y);
      const f = p.id === state.myId ? (p.moving ? frame : 0) : (p.moving ? Math.floor(now / 160) % 2 : 0);
      const spr = getSprite(p.char || 'ger', p.dir || 'down', f);
      // La altura en pantalla no cambia respecto al sprite por código (44*s), pero
      // el ancho sale de la proporción real del sprite: los PNG de referencia son
      // mucho más esbeltos que el chibi de la grilla de 4x.
      const h = 44 * s, w = h * (spr.width / spr.height);
      const conAsset = assetsReady && !!charAssets[p.char || 'ger'];
      ctx.imageSmoothingEnabled = conAsset;              // ver nota arriba del setTransform
      if (conAsset) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
      if (p.wave && now < p.waveUntil) {
        ctx.save(); ctx.translate(p.x - w / 2, p.y - h); ctx.scale(w / 32, h / 44);
        drawWaveArm(ctx, p.color || 0, now);
        ctx.restore();
      }
      topY = p.y - h; shR = 11 * s * (spr.width / spr.height) * (32 / 44) * 1.9; fs = Math.round(3.1 * s);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, shR, shR * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
    ctx.font = `${fs}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    const label = `${st.emoji} ${p.name}`;
    const ly = topY - fs * 0.6;
    ctx.lineWidth = fs * 0.28; ctx.strokeStyle = 'rgba(10,12,18,0.9)';
    ctx.strokeText(label, p.x, ly);
    ctx.fillStyle = p.id === state.myId ? '#ffd76a' : '#ffffff';
    ctx.fillText(label, p.x, ly);

    if (p.emote && now < p.emoteUntil) {
      const bounce = Math.sin((p.emoteUntil - now) / 120) * 6;
      ctx.font = `${Math.round(fs * 2)}px serif`;
      ctx.fillText(p.emote, p.x + fs * 3, ly - fs * 1.4 + bounce);
    }
    if (p.bubble && now < p.bubbleUntil) drawBubble(ctx, p.bubble, p.x, ly - fs * 0.8, fs);
  }

  clockBox.textContent = `${phaseName(hf)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` + (USE_P2P ? ` · 📡${p2pPeerCount}` : '');
}

function drawBubble(g2, text, cx, bottomY, fs) {
  g2.font = `${fs}px "Press Start 2P", monospace`;
  const maxW = fs * 16;
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (g2.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (!lines.length) lines.push(text.slice(0, 24));
  const lh = fs * 1.5;
  let bw = 0;
  for (const l of lines) bw = Math.max(bw, g2.measureText(l).width);
  bw += fs * 1.6; const bh = lines.length * lh + fs;
  const x = Math.round(cx - bw / 2), y = Math.round(bottomY - bh);
  g2.fillStyle = 'rgba(16,19,26,0.95)'; g2.fillRect(x - 3, y - 3, bw + 6, bh + 6);
  g2.fillStyle = '#fffdf5'; g2.fillRect(x, y, bw, bh);
  g2.beginPath(); g2.moveTo(cx - 6, y + bh); g2.lineTo(cx + 6, y + bh); g2.lineTo(cx, y + bh + 9); g2.closePath();
  g2.fillStyle = '#fffdf5'; g2.fill();
  g2.fillStyle = '#1c2129'; g2.textAlign = 'center';
  lines.forEach((l, i) => g2.fillText(l, cx, y + fs + i * lh));
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  requestAnimationFrame(loop); // agendado primero: un error en un cuadro no congela el juego
  try { update(dt); } catch (err) { /* un tropiezo no frena la oficina */ }
  try { render(); } catch (err) { /* idem */ }
}

function init() {
  if (USE_P2P) state.myId = 'me' + Math.random().toString(36).slice(2, 8);
  // Los PNG de referencia tardan un instante en venir. Mientras tanto la escena
  // arranca con el chibi de la grilla y en cuanto llegan se usan solos: getSprite
  // chequea assetsReady en cada llamada y el caché del chibi no estorba.
  loadCharAssets();
  resize();
  buildStatusBar();
  renderPlayerList();
  const mb = document.getElementById('musicBtn'); if (mb) mb.onclick = mpToggle;
  const bp1 = document.getElementById('mpPlay'); if (bp1) bp1.onclick = mpPlay;
  const bp2 = document.getElementById('mpPause'); if (bp2) bp2.onclick = mpPause;
  const bp3 = document.getElementById('mpStop'); if (bp3) bp3.onclick = mpStop;
  const mv = document.getElementById('mpVol');
  if (mv) mv.oninput = () => ytCmd('setVolume', [+mv.value]);

  // stick táctil (móvil)
  state.stick = { x: 0, y: 0, active: false };
  const stickEl = document.getElementById('stick'), knobEl = document.getElementById('stickKnob');
  if (stickEl && knobEl) {
    let sid = null;
    const setFrom = (e) => {
      const r = stickEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let vx = e.clientX - cx, vy = e.clientY - cy;
      const max = r.width / 2 - 12;
      const dd = Math.hypot(vx, vy) || 1;
      if (dd > max) { vx = vx / dd * max; vy = vy / dd * max; }
      knobEl.style.transform = `translate(${vx}px, ${vy}px)`;
      state.stick.x = vx / max; state.stick.y = vy / max; state.stick.active = true;
    };
    stickEl.addEventListener('pointerdown', (e) => { sid = e.pointerId; try { stickEl.setPointerCapture(sid); } catch {} setFrom(e); e.preventDefault(); });
    stickEl.addEventListener('pointermove', (e) => { if (sid === e.pointerId) setFrom(e); });
    const end = () => { sid = null; state.stick.x = 0; state.stick.y = 0; state.stick.active = false; knobEl.style.transform = ''; };
    stickEl.addEventListener('pointerup', end);
    stickEl.addEventListener('pointercancel', end);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
  }

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.onclick = () => { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; };
  const attBtn = document.getElementById('attBtn');
  const fileInput = document.getElementById('fileInput');
  if (attBtn && fileInput) { attBtn.onclick = () => fileInput.click(); fileInput.onchange = onFilePicked; }
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); startRec(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => micBtn.addEventListener(ev, stopRec));
    micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // panel de diagnóstico: tocar el reloj lo abre/cierra
  const np = document.getElementById('netPanel');
  clockBox.addEventListener('click', () => { if (np) { np.classList.toggle('hidden'); renderNetPanel(); } });
  setInterval(renderNetPanel, 2000);
  const q = new URLSearchParams(location.search);
  if (q.get('dni')) dniInput.value = q.get('dni');
  joinBtn.onclick = join;
  dniInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  dniInput.addEventListener('input', () => {
    const entry = ROSTER.find((r) => r.dni === dniInput.value.replace(/\D/g, ''));
    previewChar(entry ? entry.char : null);
    dniError('');
  });
  connect();
  requestAnimationFrame(loop);
}
init();
