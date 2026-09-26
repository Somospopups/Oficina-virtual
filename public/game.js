/* ============================================================
   🏢 OFICINA VIRTUAL 2D — cliente pixel art multiplayer
   Réplica del estudio: escritorios de madera con monitores duales,
   sillas gamer, estantes con LED, ventanal con ciclo día/noche real.
   ============================================================ */
'use strict';

// ---------- Constantes ----------
const TILE = 16;
let SCALE = 3;
const MAP_W = 20, MAP_H = 24;
const SPEED = 72;
const SEND_MS = 70;

// Leyenda:
// '#' pared  'V' ventanal (cielo dinámico)  '.' piso  'L' parche de sol
// 'D' escritorio izq  'E' escritorio der  'C' silla gamer
// 'H' estante de madera bajo ventana  'W' gabinete blanco  'M' café
// 'q'/'p' estantes de pared con LED  'o'/'O' posters  'P' planta
// 'l' lamparita  's' spot  'd' entrada
const MAP_ROWS = [
'#VVVVVVVVVVVVVVVVVV#',
'#..HHHHHHHWWWWMWW..#',
'#LL.LL.LL.LL.LL.LL.#',
'oLL.LL.LL.LL.LL.LL.O',
'o.....s.......s....O',
'#..................#',
'qDD..............EEp',
'qDDC............CEEp',
'qDD..............EEp',
'qDD..............EEp',
'qDDC............CEEp',
'qDD..............EEp',
'qDD..............EEp',
'qDDC............CEEp',
'qDD..............EEp',
'#..................#',
'#.P..............P.#',
'#..................#',
'#.....l.......l....#',
'#..................#',
'#..................#',
'#..................#',
'#..................#',
'#########dd#########',
];
const MAP = MAP_ROWS.map((r) => (r + '#'.repeat(MAP_W)).slice(0, MAP_W));

const SOLID = new Set(['#', 'V', 'H', 'W', 'M', 'D', 'E', 'q', 'p', 'o', 'O', 'P']);

// Puestos de trabajo (sillas): al entrar, te sentás en el primero libre
const SEATS = [
  { tx: 3, ty: 7, face: 'left' },
  { tx: 3, ty: 10, face: 'left' },
  { tx: 3, ty: 13, face: 'left' },
  { tx: 16, ty: 7, face: 'right' },
  { tx: 16, ty: 10, face: 'right' },
  { tx: 16, ty: 13, face: 'right' },
];

const ZONES = [
  { name: 'Estación de café (junto a la ventana)', x0: 9, y0: 1, x1: 17, y1: 4, status: 'cafe' },
];

const STATUS_INFO = {
  codeando:    { emoji: '💻', label: 'Codeando' },
  reunion:     { emoji: '🤝', label: 'En reunión' },
  cafe:        { emoji: '☕', label: 'Pausa café' },
  ausente:     { emoji: '🌙', label: 'Ausente' },
  disponible:  { emoji: '🟢', label: 'Disponible' },
};
const STATUS_KEYS = ['codeando', 'reunion', 'cafe', 'ausente', 'disponible'];

const SHIRT_COLORS = ['#e05252', '#4a90d9', '#4caf6d', '#e6b422', '#9b59b6', '#e67e22', '#26a69a', '#ec6ea4'];
const HAIR_COLORS  = ['#3a2c20', '#1c1c22', '#6b4a2b', '#c9a24b', '#222831', '#513228', '#101418', '#8a5a3b'];

// ---------- Utilidades ----------
function rnd(x, y, i) {
  const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hex2rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function lerpColor(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------- Ciclo día/noche (hora real local) ----------
const SKY_STOPS = [
  { h: 0,    top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.30, amb: 0.28 },
  { h: 5,    top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.30, amb: 0.28 },
  { h: 6.5,  top: '#ff8f5c', bot: '#ffd9a0', star: 0.2, patch: '#ffcf9e', patchA: 0.50, amb: 0.10 },
  { h: 9,    top: '#5ab6f0', bot: '#a8dcf6', star: 0,   patch: '#fff6d6', patchA: 0.65, amb: 0 },
  { h: 15,   top: '#4aa3e8', bot: '#9ed4f2', star: 0,   patch: '#fff2c8', patchA: 0.65, amb: 0 },
  { h: 18.5, top: '#ff7b4f', bot: '#ffc46b', star: 0.1, patch: '#ffd9a0', patchA: 0.50, amb: 0.08 },
  { h: 20,   top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.30, amb: 0.28 },
  { h: 24,   top: '#070b1e', bot: '#141c33', star: 1,   patch: '#39456b', patchA: 0.30, amb: 0.28 },
];
function skyNow(hourF) {
  let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hourF >= SKY_STOPS[i].h && hourF <= SKY_STOPS[i + 1].h) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (hourF - a.h) / (b.h - a.h);
  return {
    top: lerpColor(a.top, b.top, t),
    bot: lerpColor(a.bot, b.bot, t),
    star: a.star + (b.star - a.star) * t,
    patch: lerpColor(a.patch, b.patch, t),
    patchA: a.patchA + (b.patchA - a.patchA) * t,
    amb: a.amb + (b.amb - a.amb) * t,
  };
}
function phaseName(h) {
  if (h >= 5 && h < 8) return '🌅 Amanecer';
  if (h >= 8 && h < 13) return '☀️ Mañana';
  if (h >= 13 && h < 19) return '🌇 Tarde';
  return '🌙 Noche';
}

// Skyline precalculado (edificios del ventanal)
const BUILDINGS = [];
(function () {
  let x = 0;
  let i = 0;
  while (x < 288 + 16) {
    const w = 8 + Math.floor(rnd(i, 7, 1) * 10);
    const h = 5 + Math.floor(rnd(i, 3, 2) * 9);
    BUILDINGS.push({ x, w, h, brick: rnd(i, 11, 3) > 0.7, win: rnd(i, 5, 4) });
    x += w + 1 + Math.floor(rnd(i, 9, 5) * 3);
    i++;
  }
})();

// ---------- Pre-render del mapa ----------
function buildMapCanvas() {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * TILE; cv.height = MAP_H * TILE;
  const g = cv.getContext('2d');
  const t = document.createElement('canvas');
  t.width = TILE; t.height = TILE;

  function drawFloorTile(g2, tx, ty) {
    g2.fillStyle = '#e6ddca';
    g2.fillRect(0, 0, 16, 16);
    g2.fillStyle = 'rgba(255,255,255,0.10)';
    g2.fillRect(0, 2 + Math.floor(rnd(tx, ty, 3) * 9), 16, 3);
    g2.fillStyle = '#cfc5ae';
    if (tx % 2 === 0) g2.fillRect(0, 0, 1, 16);
    if (ty % 2 === 0) g2.fillRect(0, 0, 16, 1);
  }
  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return '#';
    return MAP[ty][tx];
  }
  // líneas de código de colores para monitores
  function codeScreen(g2, x, y, w, h, seed) {
    g2.fillStyle = '#10131c'; g2.fillRect(x, y, w, h);
    const cols = ['#7dd3fc', '#f472b6', '#a3e635', '#fbbf24', '#c084fc', '#f87171'];
    for (let ly = y + 1; ly < y + h - 1; ly += 2) {
      let lx = x + 1;
      const indent = Math.floor(rnd(seed, ly, 8) * 3);
      lx += indent;
      const segs = 1 + Math.floor(rnd(seed, ly, 9) * 3);
      for (let s = 0; s < segs; s++) {
        const sw = 2 + Math.floor(rnd(seed, ly + s, 10) * 5);
        g2.fillStyle = cols[Math.floor(rnd(seed, ly + s, 11) * cols.length)];
        g2.fillRect(lx, ly, sw, 1);
        lx += sw + 1;
        if (lx > x + w - 2) break;
      }
    }
  }

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const c = MAP[ty][tx];
      const g2 = t.getContext('2d');
      g2.clearRect(0, 0, 16, 16);
      drawFloorTile(g2, tx, ty);

      switch (c) {
        case '#': {
          g2.fillStyle = '#efedea'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 16, 2);
          g2.fillStyle = '#d9d4c6'; g2.fillRect(0, 14, 16, 2);
          break;
        }
        case 'V': {
          g2.fillStyle = '#0d1117'; g2.fillRect(0, 0, 16, 16); // agujero: el cielo se dibuja dinámico encima
          break;
        }
        case 'o': case 'O': {
          // Posters en las paredes ("GOOD CODE BETTER DAYS" / "</>")
          g2.fillStyle = '#efedea'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#14161c'; g2.fillRect(3, 1, 10, 14);
          if (c === 'o') {
            g2.fillStyle = '#f5f5f0';
            g2.fillRect(5, 3, 6, 1); g2.fillRect(5, 6, 5, 1); g2.fillRect(5, 9, 6, 1); g2.fillRect(5, 12, 4, 1);
          } else {
            g2.fillStyle = '#f472b6';
            g2.fillRect(5, 6, 1, 4); g2.fillRect(6, 5, 1, 1); g2.fillRect(6, 10, 1, 1);
            g2.fillRect(9, 6, 1, 4); g2.fillRect(8, 5, 1, 1); g2.fillRect(8, 10, 1, 1);
            g2.fillStyle = '#f5f5f0'; g2.fillRect(7, 4, 1, 8);
          }
          break;
        }
        case 'q': case 'p': {
          // Estante de pared con LED azul + plantas colgantes
          g2.fillStyle = '#efedea'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#b98a52'; g2.fillRect(0, 6, 16, 3);
          g2.fillStyle = '#8a6132'; g2.fillRect(0, 8, 16, 1);
          g2.fillStyle = '#3b82f6'; g2.fillRect(0, 9, 16, 1);           // tira LED
          g2.fillStyle = 'rgba(59,130,246,0.35)'; g2.fillRect(0, 10, 16, 3); // glow
          // objetos encima
          if (rnd(tx, ty, 1) > 0.5) { g2.fillStyle = '#3e8948'; g2.fillRect(2, 2, 5, 4); g2.fillStyle = '#5aa860'; g2.fillRect(3, 1, 3, 2); g2.fillStyle = '#4c9c56'; g2.fillRect(3, 6, 1, 6); g2.fillRect(5, 6, 1, 4); }
          else { g2.fillStyle = '#1c1c22'; g2.fillRect(3, 2, 3, 4); g2.fillRect(7, 1, 3, 5); g2.fillStyle = '#e6b422'; g2.fillRect(11, 3, 2, 3); }
          break;
        }
        case 'H': {
          // Estante de madera bajo la ventana con libros
          g2.fillStyle = '#a9793f'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#c19055'; g2.fillRect(0, 0, 16, 2);
          g2.fillStyle = '#6b4a24'; g2.fillRect(1, 3, 14, 5); g2.fillRect(1, 10, 14, 5);
          const bc = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e0e0e0'];
          for (let sh = 0; sh < 2; sh++) {
            let bx = 2;
            for (let b = 0; b < 4; b++) {
              const w = 1 + Math.floor(rnd(tx, ty, sh * 9 + b) * 2);
              g2.fillStyle = bc[Math.floor(rnd(tx, ty, sh * 17 + b * 5) * bc.length)];
              g2.fillRect(bx, 4 + sh * 7, w, 4);
              bx += w + 1;
              if (bx > 13) break;
            }
          }
          break;
        }
        case 'W': {
          g2.fillStyle = '#f7f6f2'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#e2dfd6'; g2.fillRect(0, 0, 1, 16); g2.fillRect(0, 3, 16, 1);
          g2.fillStyle = '#b9b5aa'; g2.fillRect(7, 8, 2, 1);
          break;
        }
        case 'M': {
          g2.fillStyle = '#f7f6f2'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#e2dfd6'; g2.fillRect(0, 3, 16, 1);
          g2.fillStyle = '#22252b'; g2.fillRect(3, 4, 10, 9);
          g2.fillStyle = '#3a3f47'; g2.fillRect(4, 5, 8, 3);
          g2.fillStyle = '#ff5c5c'; g2.fillRect(11, 10, 1, 1);
          g2.fillStyle = '#f2ede2'; g2.fillRect(6, 10, 4, 3);
          g2.fillStyle = '#5b3a1e'; g2.fillRect(7, 10, 2, 1);
          break;
        }
        case 'D': case 'E': {
          // Escritorio de madera con setup dual
          const left = (c === 'D');
          g2.fillStyle = '#b98a52'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#c99a62'; g2.fillRect(0, 0, 16, 2);
          g2.fillStyle = '#8a6132'; g2.fillRect(0, 14, 16, 2);
          // monitores duales apoyados contra la pared
          if (left) {
            codeScreen(g2, 0, 1, 7, 9, tx * 3 + ty);
            codeScreen(g2, 8, 1, 7, 9, tx * 5 + ty + 40);
            g2.fillStyle = '#1c1c22'; g2.fillRect(7, 10, 2, 2);
            // teclado RGB + mouse
            g2.fillStyle = '#14161c'; g2.fillRect(3, 11, 8, 3);
            for (let kx = 4; kx < 11; kx++) g2.fillStyle = `hsl(${(kx * 47 + ty * 30) % 360},80%,60%)`, g2.fillRect(kx, 12, 1, 1);
            g2.fillStyle = '#14161c'; g2.fillRect(12, 11, 2, 3);
          } else {
            codeScreen(g2, 1, 1, 7, 9, tx * 3 + ty + 80);
            codeScreen(g2, 9, 1, 7, 9, tx * 5 + ty + 120);
            g2.fillStyle = '#1c1c22'; g2.fillRect(7, 10, 2, 2);
            g2.fillStyle = '#14161c'; g2.fillRect(5, 11, 8, 3);
            for (let kx = 6; kx < 13; kx++) g2.fillStyle = `hsl(${(kx * 47 + ty * 30) % 360},80%,60%)`, g2.fillRect(kx, 12, 1, 1);
            g2.fillStyle = '#14161c'; g2.fillRect(2, 11, 2, 3);
          }
          break;
        }
        case 'C': {
          // Silla gamer negra (vacía)
          g2.fillStyle = '#1d2126'; g2.fillRect(4, 2, 8, 9);      // respaldo alto
          g2.fillStyle = '#2b3038'; g2.fillRect(5, 3, 6, 7);
          g2.fillStyle = '#1d2126'; g2.fillRect(3, 8, 10, 4);     // asiento
          g2.fillStyle = '#3a4048'; g2.fillRect(2, 8, 1, 3); g2.fillRect(13, 8, 1, 3); // apoyabrazos
          g2.fillStyle = '#14171b'; g2.fillRect(7, 12, 2, 2);
          g2.fillRect(4, 14, 8, 1); g2.fillRect(4, 14, 1, 2); g2.fillRect(11, 14, 1, 2); g2.fillRect(7, 15, 2, 1);
          break;
        }
        case 'P': {
          g2.fillStyle = '#2b2e33'; g2.fillRect(5, 10, 6, 6);
          g2.fillStyle = '#3e8948'; g2.fillRect(4, 4, 8, 6); g2.fillRect(6, 1, 4, 4); g2.fillRect(2, 6, 3, 3); g2.fillRect(11, 6, 3, 3);
          g2.fillStyle = '#5aa860'; g2.fillRect(5, 3, 3, 2); g2.fillRect(9, 5, 2, 2);
          break;
        }
        case 'L': break; // parche de sol: se dibuja dinámico según la hora
        case 'l': {
          g2.fillStyle = 'rgba(255,214,140,0.20)'; g2.beginPath(); g2.arc(8, 8, 8, 0, 7); g2.fill();
          g2.fillStyle = 'rgba(255,232,180,0.35)'; g2.beginPath(); g2.arc(8, 8, 5, 0, 7); g2.fill();
          g2.fillStyle = '#fff8e6'; g2.beginPath(); g2.arc(8, 8, 2, 0, 7); g2.fill();
          g2.fillStyle = '#c9c9c9'; g2.fillRect(7, 7, 1, 1);
          break;
        }
        case 's': {
          g2.fillStyle = 'rgba(255,240,200,0.18)'; g2.beginPath(); g2.arc(8, 8, 6, 0, 7); g2.fill();
          g2.fillStyle = '#ffffff'; g2.beginPath(); g2.arc(8, 8, 2, 0, 7); g2.fill();
          break;
        }
        case 'd': {
          g2.fillStyle = '#cfc5ae'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#8d939b'; g2.fillRect(1, 2, 14, 12);
          g2.fillStyle = '#a5abb3'; g2.fillRect(3, 4, 10, 2); g2.fillRect(3, 8, 10, 2);
          break;
        }
      }
      g.drawImage(t, tx * TILE, ty * TILE);
    }
  }
  return cv;
}

// ---------- Sprites ----------
const spriteCache = {};
function getSprite(colorIdx, dir, frame) {
  const key = `${colorIdx}_${dir}_${frame}`;
  if (spriteCache[key]) return spriteCache[key];
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 22;
  const g = cv.getContext('2d');
  const shirt = SHIRT_COLORS[colorIdx % SHIRT_COLORS.length];
  const hair = HAIR_COLORS[colorIdx % HAIR_COLORS.length];
  const skin = '#f0c8a0', skinD = '#d9a878', pants = '#39424e', shoe = '#22262e';
  const step = frame === 1;
  g.fillStyle = pants;
  if (step) { g.fillRect(4, 16, 3, 4); g.fillRect(9, 16, 3, 4); }
  else { g.fillRect(5, 16, 3, 4); g.fillRect(8, 16, 3, 4); }
  g.fillStyle = shoe;
  if (step) { g.fillRect(4, 20, 3, 1); g.fillRect(9, 20, 3, 1); }
  else { g.fillRect(5, 20, 3, 1); g.fillRect(8, 20, 3, 1); }
  g.fillStyle = shirt; g.fillRect(4, 9, 8, 7);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(4, 14, 8, 2);
  g.fillStyle = shirt; g.fillRect(3, 10, 1, 5); g.fillRect(12, 10, 1, 5);
  g.fillStyle = skin; g.fillRect(3, 15, 1, 1); g.fillRect(12, 15, 1, 1);
  g.fillStyle = skin; g.fillRect(5, 3, 6, 6);
  g.fillStyle = skinD; g.fillRect(5, 8, 6, 1);
  g.fillStyle = hair;
  if (dir === 'up') {
    g.fillRect(5, 2, 6, 6);
    g.fillStyle = skin; g.fillRect(6, 7, 4, 1);
  } else if (dir === 'down') {
    g.fillRect(5, 2, 6, 2); g.fillRect(5, 3, 1, 3); g.fillRect(10, 3, 1, 3);
    g.fillStyle = '#26221e'; g.fillRect(6, 5, 1, 2); g.fillRect(9, 5, 1, 2);
    g.fillStyle = '#b06a4a'; g.fillRect(7, 7, 2, 1);
  } else if (dir === 'left') {
    g.fillRect(5, 2, 6, 2); g.fillRect(8, 3, 3, 4);
    g.fillStyle = '#26221e'; g.fillRect(6, 5, 1, 2);
  } else {
    g.fillRect(5, 2, 6, 2); g.fillRect(5, 3, 3, 4);
    g.fillStyle = '#26221e'; g.fillRect(9, 5, 1, 2);
  }
  spriteCache[key] = cv;
  return cv;
}

// Persona SENTADA en silla gamer, mirando al escritorio
const sitCache = {};
function getSitSprite(colorIdx, face) {
  const key = `${colorIdx}_${face}`;
  if (sitCache[key]) return sitCache[key];
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 22;
  const g = cv.getContext('2d');
  const draw = (gg) => {
    const shirt = SHIRT_COLORS[colorIdx % SHIRT_COLORS.length];
    const hair = HAIR_COLORS[colorIdx % HAIR_COLORS.length];
    // silla: respaldo alto a la derecha (mirando a la izquierda)
    gg.fillStyle = '#1d2126'; gg.fillRect(9, 2, 4, 12);
    gg.fillStyle = '#2b3038'; gg.fillRect(10, 3, 2, 10);
    gg.fillStyle = '#1d2126'; gg.fillRect(4, 12, 9, 3);   // asiento
    gg.fillStyle = '#14171b'; gg.fillRect(7, 15, 2, 3); gg.fillRect(4, 18, 8, 1);
    gg.fillRect(4, 18, 1, 2); gg.fillRect(11, 18, 1, 2);
    // persona: cabeza + torso mirando a la izquierda
    gg.fillStyle = shirt; gg.fillRect(4, 8, 6, 5);        // torso
    gg.fillStyle = shirt; gg.fillRect(2, 9, 3, 2);        // brazo al teclado
    gg.fillStyle = '#f0c8a0'; gg.fillRect(1, 9, 2, 2);    // mano
    gg.fillStyle = '#f0c8a0'; gg.fillRect(4, 3, 6, 5);    // cabeza
    gg.fillStyle = hair; gg.fillRect(5, 2, 5, 2); gg.fillRect(8, 3, 2, 4); // pelo (nuca)
    gg.fillStyle = '#26221e'; gg.fillRect(5, 5, 1, 1);    // ojo
    // auriculares
    gg.fillStyle = '#14161c'; gg.fillRect(7, 3, 2, 1); gg.fillRect(7, 3, 1, 3);
  };
  if (face === 'left') draw(g);
  else {
    g.translate(16, 0); g.scale(-1, 1); draw(g);
  }
  sitCache[key] = cv;
  return cv;
}

function drawWaveArm(g, colorIdx, dir, time) {
  const shirt = SHIRT_COLORS[colorIdx % SHIRT_COLORS.length];
  const osc = Math.sin(time * 0.015) > 0 ? 0 : 1;
  g.fillStyle = shirt;
  if (dir === 'left') { g.fillRect(2 - osc, 6, 1, 5); g.fillStyle = '#f0c8a0'; g.fillRect(2 - osc, 5, 1, 1); }
  else { g.fillRect(13 + osc, 6, 1, 5); g.fillStyle = '#f0c8a0'; g.fillRect(13 + osc, 5, 1, 1); }
}

// ---------- Estado ----------
const state = { myId: null, myName: '', myColor: 0, players: new Map(), joined: false };
const keys = {};
let lastSend = 0, lastZone = null, mapCanvas = null, audioCtx = null;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const joinOverlay = document.getElementById('join');
const nameInput = document.getElementById('nameInput');
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

// ---------- Audio ----------
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

// ---------- Red ----------
let ws = null, reconnectTimer = null;
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function connect() {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    toast('✅ Conectado a la oficina');
    if (state.joined) send({ type: 'profile', name: state.myName, color: state.myColor });
  };
  ws.onclose = () => {
    if (state.joined) { toast('🔌 Desconectado. Reintentando...'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2000); }
  };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handleMsg(m); };
}

function handleMsg(msg) {
  switch (msg.type) {
    case 'welcome':
      state.myId = msg.id;
      for (const p of msg.players) upsertRemote(p, true);
      renderPlayerList();
      break;
    case 'state':
      for (const p of msg.players) { if (p.id !== state.myId) upsertRemote(p, false); }
      const ids = new Set(msg.players.map((p) => p.id));
      for (const id of [...state.players.keys()]) if (id !== state.myId && !ids.has(id)) state.players.delete(id);
      renderPlayerList();
      break;
    case 'joined':
      upsertRemote(msg.player, true);
      if (msg.player.name !== state.myName) beep(660, 0.08);
      renderPlayerList();
      break;
    case 'left':
      state.players.delete(msg.id);
      addChat(null, `${msg.name} salió de la oficina`, 'system');
      renderPlayerList();
      break;
    case 'system': addChat(null, msg.text, 'system'); break;
    case 'chat': {
      const mine = msg.from === state.myName;
      const isW = !!msg.to;
      if (isW && !mine && msg.to !== state.myName) break;
      addChat(msg.from, msg.text, isW ? 'whisper' : 'normal', msg.to);
      if (!mine && (!isW || msg.to === state.myName)) beep(isW ? 880 : 520, 0.07);
      break;
    }
    case 'status': { const p = state.players.get(msg.id); if (p) p.status = msg.status; renderPlayerList(); break; }
    case 'emote': { const p = state.players.get(msg.id); if (p) { p.emote = msg.emote; p.emoteUntil = performance.now() + 3000; } break; }
    case 'wave': {
      const p = state.players.get(msg.id);
      if (p) { p.wave = true; p.waveUntil = performance.now() + 1500; }
      if (msg.at && msg.at === state.myName) { addChat(null, `${p ? p.name : 'Alguien'} te saludó 👋`, 'system'); beep(740, 0.09); }
      break;
    }
    case 'profile': { const p = state.players.get(msg.id); if (p) { p.name = msg.name; p.color = msg.color; } renderPlayerList(); break; }
  }
}

function upsertRemote(p, snap) {
  let cur = state.players.get(p.id);
  if (!cur) { cur = { ...p, tx: p.x, ty: p.y }; state.players.set(p.id, cur); }
  else {
    cur.name = p.name; cur.color = p.color; cur.dir = p.dir;
    cur.moving = p.moving; cur.status = p.status; cur.seated = !!p.seated;
    cur.tx = p.x; cur.ty = p.y;
    if (snap || p.seated) { cur.x = p.x; cur.y = p.y; }
    if (p.bubble && cur.bubble !== p.bubble) { cur.bubble = p.bubble; cur.bubbleUntil = performance.now() + 5000; }
  }
}

// ---------- UI ----------
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function addChat(from, text, cls, to) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + cls;
  if (cls === 'system') div.textContent = '· ' + text;
  else if (cls === 'whisper') div.innerHTML = `<b>${esc(from === state.myName ? 'vos' : from)}</b> ${esc(text)} <i>(privado${from === state.myName ? ' a ' + esc(to) : ''})</i>`;
  else div.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function sendChat(raw) {
  const text = raw.trim();
  if (!text) return;
  const w = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
  if (w) send({ type: 'chat', text: w[2], to: w[1] });
  else if (text.startsWith('/')) { addChat(null, 'Comando desconocido. Usá /w nombre mensaje', 'system'); return; }
  else send({ type: 'chat', text });
}

let myStatus = 'disponible';
function buildStatusBar() {
  statusBar.innerHTML = '';
  STATUS_KEYS.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'status-btn'; b.dataset.status = k;
    b.innerHTML = `${STATUS_INFO[k].emoji} ${STATUS_INFO[k].label} <span class="key">${i + 1}</span>`;
    b.onclick = () => setStatus(k);
    statusBar.appendChild(b);
  });
}
function setStatus(k, silent) {
  myStatus = k;
  send({ type: 'status', status: k });
  const me = state.players.get(state.myId);
  if (me) me.status = k;
  document.querySelectorAll('.status-btn').forEach((b) => b.classList.toggle('active', b.dataset.status === k));
  renderPlayerList();
  if (!silent) beep(440, 0.05, 0.03, 'sine');
}
let toastTimer = null;
function toast(text) {
  toastBox.textContent = text;
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2600);
}
function renderPlayerList() {
  const list = [...state.players.values()];
  playerListBox.innerHTML = '<div class="pl-title">👥 En la oficina (' + list.length + ')</div>' +
    list.map((p) => {
      const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
      const isMe = p.id === state.myId;
      return `<div class="pl-row${isMe ? ' me' : ''}"><span class="dot" style="background:${SHIRT_COLORS[p.color % SHIRT_COLORS.length]}"></span>${esc(p.name)}${isMe ? ' (vos)' : ''}${p.seated ? ' 🪑' : ''} <span class="pl-status">${st.emoji} ${st.label}</span></div>`;
    }).join('');
}

function zoneAt(tx, ty) {
  const tile = (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) ? MAP[ty][tx] : '#';
  if (tile === 'C') return { name: 'tu puesto', status: 'codeando' };
  for (const z of ZONES) if (tx >= z.x0 && tx <= z.x1 && ty >= z.y0 && ty <= z.y1) return z;
  return null;
}

// ---------- Colisiones ----------
function solidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return SOLID.has(MAP[ty][tx]);
}
function canMove(x, y) {
  return !solidAtPx(x - 4, y - 2) && !solidAtPx(x + 4, y - 2) && !solidAtPx(x - 4, y + 2) && !solidAtPx(x + 4, y + 2);
}

// ---------- Asientos ----------
function seatAtTile(tx, ty) { return SEATS.find((s) => s.tx === tx && s.ty === ty) || null; }
function freeSeat() {
  for (const s of SEATS) {
    const cx = s.tx * TILE + 8, cy = s.ty * TILE + 8;
    let taken = false;
    for (const p of state.players.values()) {
      if (Math.hypot(p.x - cx, p.y - cy) < 12) { taken = true; break; }
    }
    if (!taken) return s;
  }
  return null;
}

// ---------- Entrada ----------
window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') { sendChat(chatInput.value); chatInput.value = ''; chatInput.blur(); }
    if (e.key === 'Escape') { chatInput.value = ''; chatInput.blur(); }
    e.stopPropagation();
    return;
  }
  if (!state.joined) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter') { chatInput.focus(); e.preventDefault(); return; }
  if (e.key.toLowerCase() === 'h') { helpOverlay.classList.toggle('hidden'); return; }
  if (e.key === 'Escape') { helpOverlay.classList.add('hidden'); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 5) { setStatus(STATUS_KEYS[n - 1]); return; }
  const emoteMap = { z: '👋', x: '😂', c: '🎉', v: '👍', b: '🤔', n: '🔥', m: '☕' };
  const em = emoteMap[e.key.toLowerCase()];
  if (em) { send({ type: 'emote', emote: em }); const me = state.players.get(state.myId); if (me) { me.emote = em; me.emoteUntil = performance.now() + 3000; } return; }
  if (e.key.toLowerCase() === 'f') {
    const near = nearestPlayer();
    send({ type: 'wave', at: near ? near.name : null });
    const me = state.players.get(state.myId);
    if (me) { me.wave = true; me.waveUntil = performance.now() + 1500; }
    if (near) { addChat(null, `Saludaste a ${near.name} 👋`, 'system'); beep(600, 0.06); }
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function nearestPlayer(maxDist = 2.6 * TILE) {
  const me = state.players.get(state.myId);
  if (!me) return null;
  let best = null, bd = maxDist;
  for (const p of state.players.values()) {
    if (p.id === state.myId) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ---------- Join ----------
let selectedColor = 0;
function buildColorPicker() {
  colorsBox.innerHTML = '';
  SHIRT_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'color-btn' + (i === 0 ? ' sel' : '');
    b.style.background = c;
    b.onclick = () => { selectedColor = i; document.querySelectorAll('.color-btn').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); previewAvatar(i); };
    colorsBox.appendChild(b);
  });
  previewAvatar(0);
}
function previewAvatar(i) {
  const pv = document.getElementById('avatarPreview');
  const g = pv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, pv.width, pv.height);
  g.drawImage(getSitSprite(i, 'left'), 0, 0, 16, 22, (pv.width - 64) / 2, (pv.height - 88) / 2, 64, 88);
}

function join() {
  const name = (nameInput.value || '').trim() || ('Invitado' + Math.floor(Math.random() * 99));
  state.myName = name; state.myColor = selectedColor; state.joined = true;
  // ¡te sentás directo en tu puesto!
  const seat = freeSeat();
  const sx = seat ? seat.tx * TILE + 8 : 10 * TILE;
  const sy = seat ? seat.ty * TILE + 8 : 21 * TILE;
  const me = {
    id: state.myId || 'me', name, color: selectedColor,
    x: sx, y: sy, tx: sx, ty: sy,
    dir: seat ? seat.face : 'up', moving: false, seated: !!seat,
    status: seat ? 'codeando' : 'disponible',
    bubble: null, bubbleUntil: 0, emote: null, emoteUntil: 0, wave: false, waveUntil: 0,
  };
  if (state.myId) state.players.set(state.myId, me);
  joinOverlay.classList.add('hidden');
  send({ type: 'profile', name, color: selectedColor });
  send({ type: 'move', x: sx, y: sy, dir: me.dir, moving: false, seated: me.seated });
  if (seat) { myStatus = 'codeando'; setStatus('codeando', true); addChat(null, `Te sentaste en tu puesto 💻 — WASD para levantarte`, 'system'); }
  addChat(null, `¡Bienvenido/a a la oficina, ${name}! Presioná H para la ayuda.`, 'system');
  beep(523, 0.09); setTimeout(() => beep(784, 0.12), 100);
  renderPlayerList();
}

// ---------- Bucle ----------
let lastT = performance.now(), animT = 0;
function resize() {
  SCALE = window.innerHeight >= 760 ? 3 : 2;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

const skyCv = document.createElement('canvas');
skyCv.width = 18 * TILE; skyCv.height = TILE;

function drawSky(now, hourF, sky) {
  const g = skyCv.getContext('2d');
  const W = skyCv.width, H = skyCv.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky.top); grad.addColorStop(1, sky.bot);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // estrellas
  if (sky.star > 0.02) {
    for (let i = 0; i < 40; i++) {
      const sx = rnd(i, 1, 2) * W, sy = rnd(i, 2, 3) * (H - 6);
      const tw = 0.5 + 0.5 * Math.sin(now * 0.003 + i * 2.1);
      g.fillStyle = `rgba(255,255,255,${(sky.star * tw * 0.9).toFixed(2)})`;
      g.fillRect(sx, sy, 1, 1);
    }
  }
  // sol / luna
  if (hourF >= 6 && hourF <= 19) {
    const t = (hourF - 6) / 13;
    const sx = t * W, sy = 11 - Math.sin(Math.PI * t) * 8;
    g.fillStyle = 'rgba(255,215,106,0.35)'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
    g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(sx, sy, 2, 0, 7); g.fill();
  } else {
    const hn = (hourF >= 19 ? hourF - 19 : hourF + 5) / 11;
    const mx = hn * W, my = 10 - Math.sin(Math.PI * hn) * 7;
    g.fillStyle = '#e8ecf2'; g.beginPath(); g.arc(mx, my, 2, 0, 7); g.fill();
    g.fillStyle = '#c9cfda'; g.fillRect(mx - 1, my - 1, 1, 1);
  }
  // nubes que derivan
  const cloudA = 0.85 - sky.star * 0.6;
  for (let i = 0; i < 3; i++) {
    const cx = ((now * 0.004 * (1 + i * 0.3) + i * 97) % (W + 40)) - 20;
    const cy = 3 + i * 3;
    g.fillStyle = `rgba(255,255,255,${cloudA.toFixed(2)})`;
    g.fillRect(cx, cy, 12, 2); g.fillRect(cx + 2, cy - 1, 7, 1); g.fillRect(cx + 3, cy + 2, 6, 1);
  }
  // skyline
  const night = sky.star;
  for (const b of BUILDINGS) {
    g.fillStyle = night > 0.5 ? '#1c2438' : (b.brick ? '#b07860' : '#9aa0a8');
    g.fillRect(b.x, H - 3 - b.h, b.w, b.h + 3);
    // ventanas del edificio
    for (let wy = H - 2 - b.h; wy < H - 4; wy += 2) {
      for (let wx = b.x + 1; wx < b.x + b.w - 1; wx += 2) {
        const on = rnd(wx, wy, 21) > 0.45;
        if (night > 0.4) { if (on) { g.fillStyle = `rgba(255,215,106,${(0.5 + night * 0.5).toFixed(2)})`; g.fillRect(wx, wy, 1, 1); } }
        else { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, 1, 1); }
      }
    }
  }
  // marco del ventanal
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 3, W, 3);
  for (let x = 0; x <= W; x += 48) g.fillRect(x, 0, 2, H);
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
  const wantMove = dx !== 0 || dy !== 0;

  // levantarse de la silla
  if (me.seated && wantMove) {
    me.seated = false;
    // pequeño paso al pasillo para no quedar trabado en el escritorio
    const push = me.dir === 'left' ? [6, 0] : me.dir === 'right' ? [-6, 0] : [0, 6];
    if (canMove(me.x + push[0], me.y + push[1])) { me.x += push[0]; me.y += push[1]; }
    send({ type: 'move', x: me.x, y: me.y, dir: me.dir, moving: true, seated: false });
    lastSend = performance.now();
  }

  if (wantMove && !me.seated) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    const step = SPEED * dt;
    const nx = me.x + dx * step, ny = me.y + dy * step;
    if (canMove(nx, me.y)) me.x = nx;
    if (canMove(me.x, ny)) me.y = ny;
    me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    me.moving = true;
    animT += dt * 1000;
  } else {
    me.moving = false;
    // sentarse si te quedás quieto sobre una silla
    if (!me.seated) {
      const ttx = Math.floor(me.x / TILE), tty = Math.floor(me.y / TILE);
      const seat = seatAtTile(ttx, tty);
      if (seat) {
        me.seated = true;
        me.dir = seat.face;
        me.x = seat.tx * TILE + 8; me.y = seat.ty * TILE + 8;
        send({ type: 'move', x: me.x, y: me.y, dir: me.dir, moving: false, seated: true });
        lastSend = performance.now();
      }
    }
  }
  me.tx = me.x; me.ty = me.y;

  const now = performance.now();
  if (me.moving && now - lastSend > SEND_MS) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, moving: true, seated: false });
  } else if (!me.moving && now - lastSend > 400) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, moving: false, seated: me.seated });
  }

  // zona → estado automático
  const ttx = Math.floor(me.x / TILE), tty = Math.floor((me.y + 2) / TILE);
  const z = me.seated ? { name: 'tu puesto', status: 'codeando' } : zoneAt(ttx, tty);
  const zKey = z ? z.name : null;
  if (zKey !== lastZone) {
    lastZone = zKey;
    if (z) {
      setStatus(z.status, true);
      if (z.name !== 'tu puesto') toast(`📍 ${z.name} — estado: ${STATUS_INFO[z.status].emoji} ${STATUS_INFO[z.status].label}`);
    } else setStatus('disponible', true);
  }

  for (const p of state.players.values()) {
    if (p.id === state.myId) continue;
    if (p.seated) { p.x = p.tx; p.y = p.ty; continue; }
    const k = Math.min(1, dt * 12);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
  }

  const near = nearestPlayer();
  if (near) {
    hintBox.innerHTML = `Cerca de <b>${esc(near.name)}</b> — <span class="key">F</span> saludar · <span class="key">/w ${esc(near.name)} msg</span> susurrar`;
    hintBox.classList.add('show');
  } else hintBox.classList.remove('show');
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, W, H);
  if (!mapCanvas) return;

  const now = performance.now();
  const d = new Date();
  const hourF = d.getHours() + d.getMinutes() / 60;
  const sky = skyNow(hourF);

  const worldW = MAP_W * TILE * SCALE, worldH = MAP_H * TILE * SCALE;
  const me = state.players.get(state.myId);
  const focus = me || { x: MAP_W * TILE / 2, y: MAP_H * TILE / 2 };
  const camX = worldW <= W ? (worldW - W) / 2 / SCALE : clamp(focus.x - W / SCALE / 2, 0, MAP_W * TILE - W / SCALE);
  const camY = worldH <= H ? (worldH - H) / 2 / SCALE : clamp(focus.y - H / SCALE / 2, 0, MAP_H * TILE - H / SCALE);

  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // mapa base
  ctx.drawImage(mapCanvas, 0, 0);

  // ventanal dinámico (hora real)
  drawSky(now, hourF, sky);
  ctx.drawImage(skyCv, TILE, 0);

  // parches de sol / reflejo nocturno en el piso
  ctx.globalAlpha = sky.patchA;
  ctx.fillStyle = sky.patch;
  for (let ty = 2; ty <= 3; ty++) {
    for (let tx = 1; tx <= 18; tx++) {
      if (MAP[ty][tx] === 'L') ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  ctx.globalAlpha = 1;

  // ambiente nocturno + glow de LEDs y lamparitas
  if (sky.amb > 0.01) {
    ctx.fillStyle = `rgba(8,11,32,${sky.amb.toFixed(2)})`;
    ctx.fillRect(0, 0, MAP_W * TILE, MAP_H * TILE);
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of [[6.5, 18.5], [13.5, 18.5]]) {
      const rg = ctx.createRadialGradient(lx * TILE, ly * TILE, 2, lx * TILE, ly * TILE, 26);
      rg.addColorStop(0, `rgba(255,214,140,${(0.35 * sky.amb).toFixed(2)})`);
      rg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(lx * TILE - 26, ly * TILE - 26, 52, 52);
    }
    // glow LED de los estantes
    ctx.fillStyle = `rgba(59,130,246,${(0.10 * sky.amb * 4).toFixed(2)})`;
    ctx.fillRect(0, 6 * TILE, TILE, 9 * TILE);
    ctx.fillRect((MAP_W - 1) * TILE, 6 * TILE, TILE, 9 * TILE);
    ctx.globalCompositeOperation = 'source-over';
  }

  // jugadores ordenados por Y
  const frame = Math.floor(animT / 160) % 2;
  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    const px = p.x, py = p.y;
    const sx = px - 8, sy = py - 18;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, py + 3, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.seated) {
      const face = px < MAP_W * TILE / 2 ? 'left' : 'right';
      ctx.drawImage(getSitSprite(p.color || 0, face), sx, sy - 2);
    } else {
      const f = p.id === state.myId ? (p.moving ? frame : 0) : (p.moving ? Math.floor(now / 160) % 2 : 0);
      ctx.drawImage(getSprite(p.color || 0, p.dir || 'down', f), sx, sy);
      if (p.wave && now < p.waveUntil) drawWaveArm(ctx, p.color || 0, p.dir || 'down', now);
    }

    // nombre + estado
    const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
    ctx.font = `${Math.max(4, 4)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    const label = `${st.emoji} ${p.name}`;
    const lx = px, ly = sy - 4;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(10,12,18,0.9)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = p.id === state.myId ? '#ffd76a' : '#ffffff';
    ctx.fillText(label, lx, ly);

    if (p.emote && now < p.emoteUntil) {
      const bounce = Math.sin((p.emoteUntil - now) / 120) * 1.5;
      ctx.font = '9px serif';
      ctx.fillText(p.emote, lx + 10, ly - 6 + bounce);
    }
    if (p.bubble && now < p.bubbleUntil) drawBubble(ctx, p.bubble, lx, ly - 5);
  }
  ctx.restore();

  // reloj HUD
  clockBox.textContent = `${phaseName(hourF)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function drawBubble(g2, text, cx, bottomY) {
  g2.font = '4px "Press Start 2P", monospace';
  const maxW = 70;
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (g2.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (!lines.length) lines.push(text.slice(0, 20));
  const lh = 5;
  let bw = 0;
  for (const l of lines) bw = Math.max(bw, g2.measureText(l).width);
  bw += 6; const bh = lines.length * lh + 4;
  const x = Math.round(cx - bw / 2), y = Math.round(bottomY - bh);
  g2.fillStyle = 'rgba(16,19,26,0.95)'; g2.fillRect(x - 1, y - 1, bw + 2, bh + 2);
  g2.fillStyle = '#fffdf5'; g2.fillRect(x, y, bw, bh);
  g2.beginPath(); g2.moveTo(cx - 2, y + bh); g2.lineTo(cx + 2, y + bh); g2.lineTo(cx, y + bh + 3); g2.closePath();
  g2.fillStyle = '#fffdf5'; g2.fill();
  g2.fillStyle = '#1c2129'; g2.textAlign = 'center';
  lines.forEach((l, i) => g2.fillText(l, cx, y + 4 + i * lh));
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function init() {
  resize();
  mapCanvas = buildMapCanvas();
  buildStatusBar();
  buildColorPicker();
  renderPlayerList();
  const q = new URLSearchParams(location.search);
  if (q.get('name')) nameInput.value = q.get('name');
  joinBtn.onclick = join;
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  connect();
  requestAnimationFrame(loop);
}
init();
