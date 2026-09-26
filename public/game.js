/* ============================================================
   🏢 OFICINA VIRTUAL — escena en perspectiva (pixel art)
   Fondo = réplica del estudio real. Personajes con profundidad,
   sentados en sus puestos, ventanal con ciclo día/noche real.
   ============================================================ */
'use strict';

// ---------- Espacio virtual = dimensiones del fondo ----------
const VW = 1195, VH = 896;
let viewScale = 1, viewOX = 0, viewOY = 0;

// Rectángulo del ventanal (para el cielo dinámico)
const WIN = { x: 484, y: 291, w: 255, h: 84 };

// Piso caminable (trapecio en perspectiva, bien profundo)
const FLOOR = { yTop: 460, yBot: 890, xlTop: 505, xrTop: 720, xlBot: 280, xrBot: 935 };

// Los 4 puestos: uno por escritorio, bien separados
const SEATS = [
  { x: 233, y: 747, face: 'left' },
  { x: 420, y: 560, face: 'left' },
  { x: 784, y: 560, face: 'right' },
  { x: 962, y: 747, face: 'right' },
];

// Zona café: frente al gabinete blanco bajo la ventana
const ZONES = [
  { name: 'Estación de café (junto a la ventana)', x0: 510, y0: 400, x1: 720, y1: 520, status: 'cafe' },
];

const SPEED = 320;           // px virtuales / segundo
const SEND_MS = 70;

const STATUS_INFO = {
  codeando:   { emoji: '💻', label: 'Codeando' },
  reunion:    { emoji: '🤝', label: 'En reunión' },
  cafe:       { emoji: '☕', label: 'Pausa café' },
  ausente:    { emoji: '🌙', label: 'Ausente' },
  disponible: { emoji: '🟢', label: 'Disponible' },
};
const STATUS_KEYS = ['codeando', 'reunion', 'cafe', 'ausente', 'disponible'];
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

// ---------- Ciclo día/noche ----------
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
    const w = 18 + Math.floor(rnd(i, 7, 1) * 26);
    const h = 30 + Math.floor(rnd(i, 3, 2) * 90);
    BUILDINGS.push({ x, w, h, brick: rnd(i, 11, 3) > 0.72 });
    x += w + 2 + Math.floor(rnd(i, 9, 5) * 6);
    i++;
  }
})();

// ---------- Sprites (resolución 2x para que combinen con el fondo) ----------
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
  // piernas
  g.fillStyle = pants;
  if (step) { g.fillRect(8, 32, 6, 8); g.fillRect(18, 32, 6, 8); }
  else { g.fillRect(10, 32, 6, 8); g.fillRect(16, 32, 6, 8); }
  g.fillStyle = shoe;
  if (step) { g.fillRect(8, 40, 6, 2); g.fillRect(18, 40, 6, 2); }
  else { g.fillRect(10, 40, 6, 2); g.fillRect(16, 40, 6, 2); }
  // torso
  g.fillStyle = shirt; g.fillRect(8, 18, 16, 14);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(8, 28, 16, 4);
  g.fillStyle = shirt; g.fillRect(6, 20, 2, 10); g.fillRect(24, 20, 2, 10);
  g.fillStyle = skin; g.fillRect(6, 30, 2, 2); g.fillRect(24, 30, 2, 2);
  // cabeza
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

// Silla gamer + persona sentada (o silla vacía)
const sitCache = {};
function getSitSprite(colorIdx, face, occupied) {
  const key = `c${colorIdx}_${face}_${occupied ? 1 : 0}`;
  if (sitCache[key]) return sitCache[key];
  const cv = document.createElement('canvas');
  cv.width = 40; cv.height = 48;
  const g = cv.getContext('2d');
  const draw = (gg) => {
    // respaldo (mirando a la izquierda)
    gg.fillStyle = '#1d2126'; gg.fillRect(22, 4, 14, 30);
    gg.fillStyle = '#2b3038'; gg.fillRect(24, 6, 10, 26);
    gg.fillStyle = '#14171b'; gg.fillRect(24, 8, 10, 2); gg.fillRect(24, 14, 10, 2);
    gg.fillStyle = '#e8e8e8'; gg.fillRect(27, 10, 4, 3); // logo
    if (occupied) {
      const shirt = SHIRT_COLORS[colorIdx % 8], hair = HAIR_COLORS[colorIdx % 8];
      // torso de espaldas-al-frente mirando al monitor
      gg.fillStyle = shirt; gg.fillRect(10, 20, 14, 14);
      gg.fillStyle = shirt; gg.fillRect(2, 24, 10, 4);          // brazo al teclado
      gg.fillStyle = '#f0c8a0'; gg.fillRect(0, 24, 4, 4);       // mano
      gg.fillStyle = '#f0c8a0'; gg.fillRect(10, 8, 12, 12);     // cabeza
      gg.fillStyle = hair; gg.fillRect(12, 6, 10, 4); gg.fillRect(18, 8, 4, 8); // pelo nuca
      gg.fillStyle = '#14161c'; gg.fillRect(14, 6, 4, 2); gg.fillRect(14, 6, 2, 6); // auriculares
    } else {
      gg.fillStyle = '#2b3038'; gg.fillRect(12, 30, 16, 6);     // asiento
    }
    // asiento + base
    gg.fillStyle = '#1d2126'; gg.fillRect(10, 34, 24, 6);
    gg.fillStyle = '#3a4048'; gg.fillRect(6, 32, 4, 8); gg.fillRect(34, 32, 4, 8); // apoyabrazos
    gg.fillStyle = '#14171b'; gg.fillRect(20, 40, 4, 4);
    gg.fillRect(10, 44, 24, 2); gg.fillRect(10, 44, 2, 4); gg.fillRect(32, 44, 2, 4); gg.fillRect(20, 46, 4, 2);
  };
  if (face === 'left') draw(g);
  else { g.translate(40, 0); g.scale(-1, 1); draw(g); }
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
  // parchea artefactos blancos del piso con degradados del propio piso
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
function wsUrl() { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; }
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function connect() {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => { toast('✅ Conectado a la oficina'); if (state.joined) send({ type: 'profile', name: state.myName, color: state.myColor }); };
  ws.onclose = () => { if (state.joined) { toast('🔌 Desconectado. Reintentando...'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2000); } };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handleMsg(m); };
}
function handleMsg(msg) {
  switch (msg.type) {
    case 'welcome': state.myId = msg.id; for (const p of msg.players) upsertRemote(p, true); renderPlayerList(); break;
    case 'state': {
      for (const p of msg.players) if (p.id !== state.myId) upsertRemote(p, false);
      const ids = new Set(msg.players.map((p) => p.id));
      for (const id of [...state.players.keys()]) if (id !== state.myId && !ids.has(id)) state.players.delete(id);
      renderPlayerList(); break;
    }
    case 'joined': upsertRemote(msg.player, true); if (msg.player.name !== state.myName) beep(660, 0.08); renderPlayerList(); break;
    case 'left': state.players.delete(msg.id); addChat(null, `${msg.name} salió de la oficina`, 'system'); renderPlayerList(); break;
    case 'system': addChat(null, msg.text, 'system'); break;
    case 'chat': {
      const mine = msg.from === state.myName, isW = !!msg.to;
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
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function sendChat(raw) {
  const text = raw.trim(); if (!text) return;
  const w = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
  if (w) send({ type: 'chat', text: w[2], to: w[1] });
  else if (text.startsWith('/')) addChat(null, 'Comando desconocido. Usá /w nombre mensaje', 'system');
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
  myStatus = k; send({ type: 'status', status: k });
  const me = state.players.get(state.myId); if (me) me.status = k;
  document.querySelectorAll('.status-btn').forEach((b) => b.classList.toggle('active', b.dataset.status === k));
  renderPlayerList();
  if (!silent) beep(440, 0.05, 0.03, 'sine');
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
  g.drawImage(getSitSprite(i, 'left', true), 0, 0, 40, 48, (pv.width - 80) / 2, (pv.height - 96) / 2, 80, 96);
}
function join() {
  const name = (nameInput.value || '').trim() || ('Invitado' + Math.floor(Math.random() * 99));
  state.myName = name; state.myColor = selectedColor; state.joined = true;
  const seat = freeSeat();
  const sx = seat ? seat.x : VW / 2, sy = seat ? seat.y : 1000;
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
      g.fillRect(sx, sy, 2, 2);
    }
  }
  if (hf >= 6 && hf <= 19) {
    const t = (hf - 6) / 13;
    const sx = t * W, sy = H * 0.75 - Math.sin(Math.PI * t) * H * 0.55;
    g.fillStyle = 'rgba(255,215,106,0.35)'; g.beginPath(); g.arc(sx, sy, 16, 0, 7); g.fill();
    g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(sx, sy, 9, 0, 7); g.fill();
  } else {
    const hn = (hf >= 19 ? hf - 19 : hf + 5) / 11;
    const mx = hn * W, my = H * 0.7 - Math.sin(Math.PI * hn) * H * 0.5;
    g.fillStyle = '#e8ecf2'; g.beginPath(); g.arc(mx, my, 9, 0, 7); g.fill();
    g.fillStyle = '#c9cfda'; g.fillRect(mx - 4, my - 4, 4, 4);
  }
  const cloudA = 0.85 - sky.star * 0.6;
  for (let i = 0; i < 4; i++) {
    const cx = ((now * 0.006 * (1 + i * 0.3) + i * 173) % (W + 80)) - 40;
    const cy = 20 + i * 22;
    g.fillStyle = `rgba(255,255,255,${cloudA.toFixed(2)})`;
    g.fillRect(cx, cy, 46, 8); g.fillRect(cx + 8, cy - 5, 26, 5); g.fillRect(cx + 12, cy + 8, 22, 4);
  }
  const night = sky.star;
  for (const b of BUILDINGS) {
    g.fillStyle = night > 0.5 ? '#1c2438' : (b.brick ? '#b07860' : '#9aa0a8');
    g.fillRect(b.x, H - b.h, b.w, b.h);
    for (let wy = H - b.h + 4; wy < H - 4; wy += 6) {
      for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 5) {
        const on = rnd(wx, wy, 21) > 0.45;
        if (night > 0.4) { if (on) { g.fillStyle = `rgba(255,215,106,${(0.4 + night * 0.6).toFixed(2)})`; g.fillRect(wx, wy, 2, 3); } }
        else { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, 2, 3); }
      }
    }
  }
  // marco y parantes
  g.fillStyle = '#e8e8ec';
  g.fillRect(0, 0, W, 6); g.fillRect(0, H - 8, W, 8);
  g.fillRect(W / 3 - 4, 0, 8, H); g.fillRect(2 * W / 3 - 4, 0, 8, H);
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
    send({ type: 'move', x: me.x, y: me.y, dir: me.dir, moving: true, seated: false });
    lastSend = performance.now();
  }
  if (want && !me.seated) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    const sp = SPEED * clamp(depthScale(me.y) / 12, 0.35, 1.6); // perspectiva: lejos se camina "más lento"
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
        send({ type: 'move', x: me.x, y: me.y, dir: me.dir, moving: false, seated: true });
        lastSend = performance.now();
      }
    }
  }
  me.tx = me.x; me.ty = me.y;

  const now = performance.now();
  if (me.moving && now - lastSend > SEND_MS) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: true, seated: false });
  } else if (!me.moving && now - lastSend > 400) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: false, seated: me.seated });
  }

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
  const d = new Date();
  const hf = d.getHours() + d.getMinutes() / 60;
  const sky = skyNow(hf);

  // fondo
  if (bgReady) ctx.drawImage(bgCv, 0, 0, VW, VH);
  else { ctx.fillStyle = '#20242e'; ctx.fillRect(0, 0, VW, VH); }

  // ventanal dinámico
  drawSky(now, hf, sky);
  ctx.drawImage(skyCv, WIN.x, WIN.y);

  // tinte del reflejo en el piso según la hora
  if (sky.patchA > 0.02) {
    ctx.globalAlpha = sky.patchA;
    ctx.fillStyle = sky.patch;
    ctx.beginPath();
    ctx.moveTo(509, 458); ctx.lineTo(719, 458); ctx.lineTo(820, 700); ctx.lineTo(410, 700);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // ambiente nocturno + luces
  if (sky.amb > 0.01) {
    ctx.fillStyle = `rgba(8,11,32,${(sky.amb * 0.55).toFixed(2)})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    // glow monitores (4 puestos)
    ctx.fillStyle = `rgba(90,140,255,${(0.10 * sky.amb * 3).toFixed(2)})`;
    ctx.fillRect(19, 345, 245, 140); ctx.fillRect(341, 345, 98, 75);
    ctx.fillRect(775, 345, 98, 75); ctx.fillRect(962, 345, 210, 140);
    // glow LEDs estantes
    ctx.fillStyle = `rgba(59,130,246,${(0.14 * sky.amb * 3).toFixed(2)})`;
    ctx.fillRect(0, 209, 318, 51); ctx.fillRect(327, 262, 140, 33);
    ctx.fillRect(757, 262, 140, 33); ctx.fillRect(906, 209, 289, 51);
    // lamparitas en profundidad
    for (const [lx, ly] of [[313, 51], [878, 51], [420, 158], [789, 158], [477, 205], [733, 205]]) {
      const rg = ctx.createRadialGradient(lx, ly, 3, lx, ly, 70);
      rg.addColorStop(0, `rgba(255,224,160,${(0.5 * sky.amb * 2).toFixed(2)})`);
      rg.addColorStop(1, 'rgba(255,224,160,0)');
      ctx.fillStyle = rg; ctx.fillRect(lx - 70, ly - 70, 140, 140);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // personajes ordenados por profundidad
  const frame = Math.floor(animT / 160) % 2;
  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    let topY, shR, fs;
    if (p.seated) {
      const ss = sitScale(p.y);
      const spr = getSitSprite(p.color || 0, p.x < VW / 2 ? 'left' : 'right', true);
      const w = 40 * ss, h = 48 * ss;
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
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, shR, shR * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    // nombre + estado
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

  clockBox.textContent = `${phaseName(hf)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  resize();
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
