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
  { name: 'Estación de café (junto a la ventana)', x0: 510, y0: 400, x1: 720, y1: 520, status: 'cafe' },
];

const SPEED = 320;
const SEND_MS = 70;

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

// ---------- Sprites de pie (32x44) ----------
const spriteCache = {};
function getSprite(colorIdx, dir, frame) {
  const key = `s${colorIdx}_${dir}_${frame}`;
  if (spriteCache[key]) return spriteCache[key];
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 44;
  const g = cv.getContext('2d');
  const shirt = SHIRT_COLORS[colorIdx % 8], hair = HAIR_COLORS[colorIdx % 8];
  const skin = '#f0c8a0', skinD = '#d9a878', pants = '#39424e', shoe = '#22262e';
  const step = frame === 1;
  g.fillStyle = pants;
  if (step) { g.fillRect(8, 32, 6, 8); g.fillRect(18, 32, 6, 8); }
  else { g.fillRect(10, 32, 6, 8); g.fillRect(16, 32, 6, 8); }
  g.fillStyle = shoe;
  if (step) { g.fillRect(8, 40, 6, 2); g.fillRect(18, 40, 6, 2); }
  else { g.fillRect(10, 40, 6, 2); g.fillRect(16, 40, 6, 2); }
  g.fillStyle = shirt; g.fillRect(8, 18, 16, 14);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(8, 28, 16, 4);
  g.fillStyle = shirt; g.fillRect(6, 20, 2, 10); g.fillRect(24, 20, 2, 10);
  g.fillStyle = skin; g.fillRect(6, 30, 2, 2); g.fillRect(24, 30, 2, 2);
  g.fillStyle = skin; g.fillRect(10, 6, 12, 12);
  g.fillStyle = skinD; g.fillRect(10, 16, 12, 2);
  g.fillStyle = hair;
  if (dir === 'up') {
    g.fillRect(10, 4, 12, 12);
    g.fillStyle = skin; g.fillRect(12, 14, 8, 2);
  } else if (dir === 'down') {
    g.fillRect(10, 4, 12, 4); g.fillRect(10, 6, 2, 6); g.fillRect(20, 6, 2, 6);
    g.fillStyle = '#26221e'; g.fillRect(12, 10, 2, 4); g.fillRect(18, 10, 2, 4);
    g.fillStyle = '#b06a4a'; g.fillRect(14, 14, 4, 2);
  } else if (dir === 'left') {
    g.fillRect(10, 4, 12, 4); g.fillRect(16, 6, 6, 8);
    g.fillStyle = '#26221e'; g.fillRect(12, 10, 2, 4);
  } else {
    g.fillRect(10, 4, 12, 4); g.fillRect(10, 6, 6, 8);
    g.fillStyle = '#26221e'; g.fillRect(18, 10, 2, 4);
  }
  spriteCache[key] = cv;
  return cv;
}

// ---------- Personajes sentados: variantes (48x56) ----------
// SIT_VARIANT: 'A' gamer pro | 'B' hoodie | 'C' perfil realista (OFICIAL) | 'D' chibi
let SIT_VARIANT = 'C';

function chairCommon(g) {
  g.fillStyle = '#1d2126'; g.fillRect(12, 40, 28, 6);
  g.fillStyle = '#3a4048'; g.fillRect(8, 38, 4, 8); g.fillRect(36, 38, 4, 8);
  g.fillStyle = '#14171b'; g.fillRect(24, 46, 4, 5);
  g.fillRect(14, 51, 24, 2); g.fillRect(14, 51, 2, 4); g.fillRect(36, 51, 2, 4); g.fillRect(24, 53, 4, 2);
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
function sitC(g, shirt, hair, frame) { // OFICIAL: perfil realista, manos SOBRE el teclado
  g.fillStyle = '#1d2126'; g.fillRect(32, 4, 10, 6);
  g.fillStyle = '#2b3038'; g.fillRect(32, 10, 8, 28);
  g.fillStyle = '#14171b'; for (let y = 12; y < 36; y += 4) g.fillRect(33, y, 6, 1);
  g.fillStyle = '#39424e'; g.fillRect(10, 40, 16, 6); // muslos (los pies van bajo el escritorio: no se dibujan)
  g.fillStyle = shirt;
  g.fillRect(16, 26, 16, 6); g.fillRect(14, 30, 18, 6); g.fillRect(14, 36, 18, 5);
  g.fillStyle = shirt;
  g.fillRect(8, 28, 10, 4);
  g.fillRect(4, 30, 8, 3);
  g.fillRect(10, 32, 10, 4);
  g.fillRect(6, 34, 8, 3);
  g.fillStyle = '#f0c8a0';
  g.fillRect(0, 29 + (frame ? 0 : 1), 5, 3);
  g.fillRect(2, 33 + (frame ? 1 : 0), 5, 3);
  g.fillStyle = '#f0c8a0'; g.fillRect(16, 10, 13, 14);
  g.fillRect(14, 16, 2, 3);
  g.fillStyle = hair; g.fillRect(18, 8, 12, 4); g.fillRect(26, 10, 4, 9);
  g.fillStyle = '#26221e'; g.fillRect(18, 15, 2, 2);
  g.fillStyle = '#b06a4a'; g.fillRect(16, 21, 3, 1);
  chairCommon(g);
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
function getSitSprite(colorIdx, face, occupied, frame = 0) {
  const key = `v${SIT_VARIANT}_c${colorIdx}_${face}_${occupied ? 1 : 0}_${frame}`;
  if (sitCache[key]) return sitCache[key];
  const cv = document.createElement('canvas');
  cv.width = 48; cv.height = 56;
  const g = cv.getContext('2d');
  const shirt = SHIRT_COLORS[colorIdx % 8], hair = HAIR_COLORS[colorIdx % 8];
  const draw = (gg) => {
    if (!occupied) {
      gg.fillStyle = '#1d2126'; gg.fillRect(30, 6, 14, 34);
      gg.fillStyle = '#2b3038'; gg.fillRect(32, 8, 10, 30);
      gg.fillStyle = '#e8e8e8'; gg.fillRect(35, 12, 4, 3);
      gg.fillStyle = '#2b3038'; gg.fillRect(14, 34, 20, 6);
      chairCommon(gg);
      return;
    }
    if (SIT_VARIANT === 'B') sitB(gg, shirt, hair, frame);
    else if (SIT_VARIANT === 'C') sitC(gg, shirt, hair, frame);
    else if (SIT_VARIANT === 'D') sitD(gg, shirt, hair, frame);
    else sitA(gg, shirt, hair, frame);
  };
  if (face === 'left') draw(g);
  else { g.translate(48, 0); g.scale(-1, 1); draw(g); }
  sitCache[key] = cv;
  return cv;
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
const VERSION = 'v1.6.2 · 26/09/2026'; // fuente de verdad de la versión (vive en game.js)
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
    id: me.id, name: me.name, color: me.color, x: me.x, y: me.y, dir: me.dir,
    moving: me.moving, seated: me.seated, status: me.status,
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

const P2P_STRATS = ['nostr', 'mqtt'];
const p2pRooms = [];
let p2pPeerCount = 0;
function updateNetLabel() {
  p2pPeerCount = p2pRooms.reduce((n, r) => { try { return n + r.getPeers().length; } catch { return n; } }, 0);
}
function p2pSend(o) { for (const r of p2pRooms) { try { if (r._sendG) r._sendG(o); } catch { /* room caído */ } } }
async function connectP2P() {
  toast('🌐 Modo sin servidor: conectando P2P...');
  for (const s of P2P_STRATS) joinStrategy(s, 0);
}
async function joinStrategy(strat, attempt) {
  try {
    const mod = await import(`https://esm.run/trystero/${strat}`);
    const room = mod.joinRoom({ appId: 'oficina-virtual-somospopups-v1' }, 'oficina-principal');
    p2pRooms.push(room);
    const [sendG, recvG] = room.makeAction('g');
    room._sendG = sendG;
    if (!sendFn) sendFn = p2pSend;
    recvG((m, peerId) => { if (m && m.type) { m._pid = strat + ':' + peerId; handleMsg(m); } });
    room.onPeerJoin(() => { sendMoveNow(); maybeMusicForNewcomer(); updateNetLabel(); });
    room.onPeerLeave(() => { updateNetLabel(); }); // el podado por silencio despide con cartel
    updateNetLabel();
    toast(`✅ Conectado P2P (${strat})`);
    if (state.joined) { send({ type: 'profile', id: state.myId, name: state.myName, color: state.myColor }); sendMoveNow(); }
  } catch (e) {
    if (attempt < 4) setTimeout(() => joinStrategy(strat, attempt + 1), 4000);
  }
}

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
      if (msg.id && msg.id !== state.myId) upsertRemote(msg, false);
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
    case 'system': addChat(null, msg.text, 'system'); break;
    case 'chat': {
      if (dedupe(msg)) break;
      const mine = msg.from === state.myName, isW = !!msg.to;
      if (isW && !mine && msg.to !== state.myName) break;
      addChat(msg.from, msg.text, isW ? 'whisper' : 'normal', msg.to);
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
    case 'profile': { const p = state.players.get(msg.id); if (p) { p.name = msg.name; p.color = msg.color; } renderPlayerList(); break; }
  }
}

function upsertRemote(p, snap) {
  let cur = state.players.get(p.id);
  if (!cur) {
    cur = { ...p, tx: p.x, ty: p.y };
    state.players.set(p.id, cur);
    if (state.joined && p.id !== state.myId) { addChat(null, `${p.name} entró a la oficina`, 'system'); beep(660, 0.08); }
  }
  cur.pid = p._pid || cur.pid;
  cur.seen = performance.now();
  cur.name = p.name; cur.color = p.color; cur.dir = p.dir;
  cur.moving = p.moving; cur.status = p.status; cur.seated = !!p.seated;
  cur.tx = p.x; cur.ty = p.y;
  if (snap || p.seated) { cur.x = p.x; cur.y = p.y; }
  if (p.bubble && cur.bubble !== p.bubble) { cur.bubble = p.bubble; cur.bubbleUntil = performance.now() + 5000; }
}

// ---------- UI ----------
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function addChat(from, text, cls, to) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + cls;
  if (cls === 'system') div.textContent = '· ' + text;
  else if (cls === 'whisper') div.innerHTML = `<b>${esc(from === state.myName ? 'vos' : from)}</b> ${esc(text)} <i>(privado${from === state.myName ? ' a ' + esc(to) : ''})</i>`;
  else div.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function sendChat(raw) {
  const text = raw.trim(); if (!text) return;
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const w = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
  if (w) send({ type: 'chat', id: state.myId, from: state.myName, text: w[2], to: w[1], nonce });
  else if (text.startsWith('/')) addChat(null, 'Comando desconocido. Usá /w nombre mensaje', 'system');
  else send({ type: 'chat', id: state.myId, from: state.myName, text, nonce });
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

// ---------- Radio de la oficina (YouTube sincronizado para todos) ----------
let ytReady = false, ytPlayer = null, pendingMusic = null;
const music = { vid: null, playing: false, amDJ: false };
function parseVid(url) {
  const m = (url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
window.onYouTubeIframeAPIReady = () => {
  ytReady = true;
  ytPlayer = new YT.Player('ytBox', {
    width: 2, height: 2,
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
    events: {
      onReady: () => { try { ytPlayer.setVolume(60); } catch {} if (pendingMusic) { const p = pendingMusic; pendingMusic = null; applyMusic(p, true); } },
    },
  });
};
function musicNowPos() { try { return ytPlayer && ytPlayer.getCurrentTime ? (ytPlayer.getCurrentTime() || 0) : 0; } catch { return 0; } }
function sendMusic(act, vid, pos) {
  music.amDJ = true; music.vid = vid; music.playing = act === 'play';
  send({ type: 'music', act, vid, pos, at: Date.now(), from: state.myName, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) });
  updateMpNow();
}
function applyMusic(msg, silent) {
  const target = msg.pos + Math.max(0, (Date.now() - msg.at) / 1000);
  music.vid = msg.vid; music.playing = msg.act === 'play';
  if (!ytReady || !ytPlayer || !ytPlayer.seekTo) { pendingMusic = msg; return; }
  try {
    if (msg.act === 'stop') { ytPlayer.stopVideo(); updateMpNow(); return; }
    const cur = ytPlayer.getVideoData ? (ytPlayer.getVideoData().video_id || null) : null;
    if (msg.act === 'pause') { if (cur === msg.vid) ytPlayer.pauseVideo(); updateMpNow(); return; }
    if (cur !== msg.vid) ytPlayer.loadVideoById({ videoId: msg.vid, startSeconds: target });
    else { ytPlayer.seekTo(target, true); ytPlayer.playVideo(); }
  } catch { /* iframe ocupado */ }
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
  if (!vid) { toast(' Pegá primero un link de YouTube'); return; }
  if (!ytReady) { toast('🎵 La radio se está cargando… probá en unos segundos'); return; }
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
function renderPlayerList() {
  const list = [...state.players.values()];
  playerListBox.innerHTML = '<div class="pl-title">👥 En la oficina (' + list.length + ')</div>' +
    list.map((p) => {
      const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
      const isMe = p.id === state.myId;
      return `<div class="pl-row${isMe ? ' me' : ''}"><span class="dot" style="background:${SHIRT_COLORS[p.color % 8]}"></span>${esc(p.name)}${isMe ? ' (vos)' : ''}${p.seated ? ' 🪑' : ''} <span class="pl-status">${st.emoji} ${st.label}</span></div>`;
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
function freeSeat() {
  for (const s of SEATS) {
    let taken = false;
    for (const p of state.players.values()) if (Math.hypot(p.x - s.x, p.y - s.y) < 80) { taken = true; break; }
    if (!taken) return s;
  }
  return null;
}
function zoneAt(x, y) {
  for (const z of ZONES) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
  return null;
}

window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') { sendChat(chatInput.value); chatInput.value = ''; chatInput.blur(); }
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
  g.drawImage(getSitSprite(i, 'left', true, 0), 0, 0, 48, 56, (pv.width - 96) / 2, (pv.height - 112) / 2, 96, 112);
}
function join() {
  const name = (nameInput.value || '').trim() || ('Invitado' + Math.floor(Math.random() * 99));
  state.myName = name; state.myColor = selectedColor; state.joined = true;
  const seat = freeSeat();
  const sx = seat ? seat.x : VW / 2, sy = seat ? seat.y : 820;
  const me = {
    id: state.myId || 'me', name, color: selectedColor,
    x: sx, y: sy, tx: sx, ty: sy,
    dir: seat ? seat.face : 'up', moving: false, seated: !!seat,
    status: seat ? 'codeando' : 'disponible',
    bubble: null, bubbleUntil: 0, emote: null, emoteUntil: 0, wave: false, waveUntil: 0,
  };
  if (state.myId) state.players.set(state.myId, me);
  joinOverlay.classList.add('hidden');
  send({ type: 'profile', id: state.myId, name, color: selectedColor });
  sendMoveNow();
  if (seat) { setStatus('codeando', true); addChat(null, 'Te sentaste en tu puesto 💻 — WASD para levantarte', 'system'); }
  addChat(null, `¡Bienvenido/a a la oficina, ${name}! Presioná H para la ayuda.`, 'system');
  beep(523, 0.09); setTimeout(() => beep(784, 0.12), 100);
  renderPlayerList();
}

// ---------- Bucle ----------
let lastT = performance.now(), animT = 0;
function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  viewScale = Math.min(canvas.width / VW, canvas.height / VH);
  viewOX = (canvas.width - VW * viewScale) / 2;
  viewOY = (canvas.height - VH * viewScale) / 2;
  ctx.imageSmoothingEnabled = false;
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
        me.seated = true; me.dir = seat.face; me.x = seat.x; me.y = seat.y;
        sendMoveNow();
        lastSend = performance.now();
      }
    }
  }
  me.tx = me.x; me.ty = me.y;

  const now = performance.now();
  if (me.moving && now - lastSend > SEND_MS) { lastSend = now; sendMoveNow(); }
  else if (!me.moving && now - lastSend > 400) { lastSend = now; sendMoveNow(); }

  const z = me.seated ? { name: 'tu puesto', status: 'codeando' } : zoneAt(me.x, me.y);
  const zKey = z ? z.name : null;
  if (zKey !== lastZone) {
    lastZone = zKey;
    if (z) {
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

  // P2P: podar compañeros silenciosos
  if (USE_P2P) {
    for (const p of [...state.players.values()]) {
      if (p.id !== state.myId && p.seen && now - p.seen > 9000) {
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
    let topY, shR, fs;
    if (p.seated) {
      const ss = sitScale(p.y);
      const sframe = Math.floor(now / 280) % 2;
      const spr = getSitSprite(p.color || 0, p.x < VW / 2 ? 'left' : 'right', true, sframe);
      const w = 41 * ss, h = 48 * ss;
      ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
      topY = p.y - h; shR = 15 * ss; fs = Math.round(3.1 * ss);
    } else {
      const s = depthScale(p.y);
      const f = p.id === state.myId ? (p.moving ? frame : 0) : (p.moving ? Math.floor(now / 160) % 2 : 0);
      const spr = getSprite(p.color || 0, p.dir || 'down', f);
      const w = 32 * s, h = 44 * s;
      ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
      if (p.wave && now < p.waveUntil) {
        ctx.save(); ctx.translate(p.x - w / 2, p.y - h); ctx.scale(w / 32, h / 44);
        drawWaveArm(ctx, p.color || 0, now);
        ctx.restore();
      }
      topY = p.y - h; shR = 11 * s; fs = Math.round(3.1 * s);
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
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function init() {
  if (USE_P2P) state.myId = 'me' + Math.random().toString(36).slice(2, 8);
  resize();
  buildStatusBar();
  buildColorPicker();
  renderPlayerList();
  const mb = document.getElementById('musicBtn'); if (mb) mb.onclick = mpToggle;
  const bp1 = document.getElementById('mpPlay'); if (bp1) bp1.onclick = mpPlay;
  const bp2 = document.getElementById('mpPause'); if (bp2) bp2.onclick = mpPause;
  const bp3 = document.getElementById('mpStop'); if (bp3) bp3.onclick = mpStop;
  const mv = document.getElementById('mpVol');
  if (mv) mv.oninput = () => { try { if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(+mv.value); } catch {} };
  const q = new URLSearchParams(location.search);
  if (q.get('name')) nameInput.value = q.get('name');
  joinBtn.onclick = join;
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  connect();
  requestAnimationFrame(loop);
}
init();
