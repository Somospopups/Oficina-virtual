/* ============================================================
   🏢 OFICINA VIRTUAL 2D — cliente (pixel art, multiplayer)
   ============================================================ */
'use strict';

// ---------- Constantes ----------
const TILE = 16;                 // tamaño lógico de tile (px)
let SCALE = 3;                   // zoom (se ajusta según pantalla)
const MAP_W = 20, MAP_H = 24;
const SPEED = 72;                // px/segundo (mundo)
const SEND_MS = 70;              // frecuencia de envío de posición

// Leyenda del mapa:
// '#' pared  '=' vidrio  '.' piso  'F' alfombra  'd' felpudo
// 'D' escritorio  'C' silla  'T' mesa reunión  'c' silla reunión
// 'K' mesada  'M' máquina café  'P' planta  'S' sofá  'B' biblioteca  'W' pizarra
// Réplica de la oficina real (aviso de Marketplace):
// ventanal con vista a la ciudad arriba, counter con estantes de madera
// y gabinete blanco bajo la ventana, porcelanato brillante, entrada abajo.
const MAP_ROWS = [
'#VVVVVVVVVVVVVVVVVV#',
'#..HHHHHHHWWWWMWW..#',
'#LL.LL.LL.LL.LL.LL.#',
'#LL.LL.LL.LL.LL.LL.#',
'#.....s.......s....#',
'#..................#',
'#...DD...DD...DD...#',
'#...CC...CC...CC...#',
'#..................#',
'#..................#',
'#...DD...DD...DD...#',
'#...CC...CC...CC...#',
'#..................#',
'#..................#',
'#...DD...DD...DD...#',
'#...CC...CC...CC...#',
'#..................#',
'#..................#',
'#.....l.......l....#',
'#..................#',
'#..................#',
'#..................#',
'#..................#',
'#########dd#########',
];

// Normalizar por si alguna fila quedó corta/larga
const MAP = MAP_ROWS.map((r) => (r + '#'.repeat(MAP_W)).slice(0, MAP_W));

const SOLID = new Set(['#', 'V', 'H', 'W', 'M', 'D']);

// Zonas (en tiles, inclusivas) → estado automático
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

// ---------- Pre-render del mapa (pixel art) ----------
function buildMapCanvas() {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * TILE; cv.height = MAP_H * TILE;
  const g = cv.getContext('2d');

  const t = document.createElement('canvas');
  t.width = TILE; t.height = TILE;

  function drawFloorTile(g2, tx, ty) {
    // Porcelanato beige brillante (como la oficina real)
    g2.fillStyle = '#e6ddca';
    g2.fillRect(0, 0, 16, 16);
    // brillo diagonal sutil
    g2.fillStyle = 'rgba(255,255,255,0.10)';
    g2.fillRect(0, 2 + Math.floor(rnd(tx, ty, 3) * 9), 16, 3);
    // pastillas grandes: juntas cada 2 tiles
    g2.fillStyle = '#cfc5ae';
    if (tx % 2 === 0) g2.fillRect(0, 0, 1, 16);
    if (ty % 2 === 0) g2.fillRect(0, 0, 16, 1);
  }

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return '#';
    return MAP[ty][tx];
  }

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const c = MAP[ty][tx];
      const g2 = t.getContext('2d');
      g2.clearRect(0, 0, 16, 16);
      drawFloorTile(g2, tx, ty);

      switch (c) {
        case '#': {
          // Pared blanca (como la oficina real)
          g2.fillStyle = '#f4f2ec'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 16, 2);
          g2.fillStyle = '#d9d4c6'; g2.fillRect(0, 14, 16, 2);
          g2.fillStyle = 'rgba(0,0,0,0.03)';
          g2.fillRect(Math.floor(rnd(tx, ty, 1) * 16), 4, 1, 8);
          break;
        }
        case 'V': {
          // Ventanal con vista a la ciudad
          g2.fillStyle = '#8ecdf0'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#a8dcf6'; g2.fillRect(0, 0, 16, 6);
          const h = 6 + Math.floor(rnd(tx, 0, 9) * 7);
          if (rnd(tx, 2, 5) > 0.5) { g2.fillStyle = '#c4c9cf'; g2.fillRect(9, Math.max(0, 16 - h - 3), 7, h + 3); }
          g2.fillStyle = rnd(tx, 1, 4) > 0.5 ? '#9aa0a8' : '#b07860';
          g2.fillRect(0, 16 - h, 16, h);
          g2.fillStyle = 'rgba(255,255,255,0.35)';
          for (let wy = 16 - h + 2; wy < 13; wy += 3) g2.fillRect(2, wy, 12, 1);
          // marco blanco + parantes
          g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 16, 2); g2.fillRect(0, 13, 16, 3);
          if (tx % 3 === 0) g2.fillRect(0, 0, 2, 16);
          break;
        }
        case 'H': {
          // Counter bajo la ventana: estantes de madera abiertos
          g2.fillStyle = '#a9793f'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#c19055'; g2.fillRect(0, 0, 16, 3);
          g2.fillStyle = '#6b4a24'; g2.fillRect(2, 5, 12, 4); g2.fillRect(2, 11, 12, 4);
          g2.fillStyle = '#8a6132'; g2.fillRect(2, 9, 12, 1); g2.fillRect(2, 15, 12, 1);
          break;
        }
        case 'W': {
          // Gabinete blanco del counter
          g2.fillStyle = '#f7f6f2'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#e2dfd6'; g2.fillRect(0, 0, 1, 16); g2.fillRect(0, 3, 16, 1);
          g2.fillStyle = '#b9b5aa'; g2.fillRect(7, 8, 2, 1);
          break;
        }
        case 'M': {
          // Máquina de café sobre el counter blanco
          g2.fillStyle = '#f7f6f2'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = '#e2dfd6'; g2.fillRect(0, 3, 16, 1);
          g2.fillStyle = '#22252b'; g2.fillRect(3, 4, 10, 9);
          g2.fillStyle = '#3a3f47'; g2.fillRect(4, 5, 8, 3);
          g2.fillStyle = '#ff5c5c'; g2.fillRect(11, 10, 1, 1);
          g2.fillStyle = '#f2ede2'; g2.fillRect(6, 10, 4, 3);
          g2.fillStyle = '#5b3a1e'; g2.fillRect(7, 10, 2, 1);
          break;
        }
        case 'D': {
          // Escritorio blanco con canto de madera clara
          g2.fillStyle = '#fbfaf6'; g2.fillRect(0, 2, 16, 10);
          g2.fillStyle = '#e8e4da'; g2.fillRect(0, 2, 16, 1);
          g2.fillStyle = '#b98a52'; g2.fillRect(0, 11, 16, 2);
          if (tileAt(tx - 1, ty) !== 'D') {
            g2.fillStyle = '#23262e'; g2.fillRect(3, 0, 11, 8);
            g2.fillStyle = '#0d1117'; g2.fillRect(4, 1, 9, 6);
            g2.fillStyle = '#7dff9e';
            g2.fillRect(5, 2, 5, 1); g2.fillRect(5, 4, 7, 1); g2.fillRect(5, 5, 3, 1);
            g2.fillStyle = '#23262e'; g2.fillRect(7, 8, 3, 2); g2.fillRect(5, 10, 7, 1);
          } else {
            g2.fillStyle = '#d8d2c4'; g2.fillRect(4, 5, 6, 4);
            g2.fillStyle = '#b0a894'; g2.fillRect(4, 6, 6, 1);
          }
          break;
        }
        case 'C': {
          // Silla clara moderna
          g2.fillStyle = '#cfd3d8'; g2.fillRect(4, 3, 8, 5);
          g2.fillStyle = '#e2e5e9'; g2.fillRect(4, 3, 8, 2);
          g2.fillStyle = '#b6bbc2'; g2.fillRect(3, 8, 10, 4);
          g2.fillStyle = '#8d939b'; g2.fillRect(7, 12, 2, 3); g2.fillRect(5, 14, 6, 1);
          break;
        }
        case 'L': {
          // Parche de sol sobre el porcelanato (reflejo del ventanal)
          g2.fillStyle = 'rgba(255,246,214,0.75)'; g2.fillRect(0, 0, 16, 16);
          g2.fillStyle = 'rgba(160,215,255,0.25)'; g2.fillRect(0, 0, 16, 6);
          break;
        }
        case 'l': {
          // Lamparita colgante vista desde arriba
          g2.fillStyle = 'rgba(255,214,140,0.20)'; g2.beginPath(); g2.arc(8, 8, 8, 0, 7); g2.fill();
          g2.fillStyle = 'rgba(255,232,180,0.35)'; g2.beginPath(); g2.arc(8, 8, 5, 0, 7); g2.fill();
          g2.fillStyle = '#fff8e6'; g2.beginPath(); g2.arc(8, 8, 2, 0, 7); g2.fill();
          g2.fillStyle = '#c9c9c9'; g2.fillRect(7, 7, 1, 1);
          break;
        }
        case 's': {
          // Spot embutido en el techo
          g2.fillStyle = 'rgba(255,240,200,0.18)'; g2.beginPath(); g2.arc(8, 8, 6, 0, 7); g2.fill();
          g2.fillStyle = '#ffffff'; g2.beginPath(); g2.arc(8, 8, 2, 0, 7); g2.fill();
          break;
        }
        case 'd': {
          // Entrada con felpudo
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

// ---------- Sprites de personajes ----------
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

  // piernas
  g.fillStyle = pants;
  if (step) { g.fillRect(4, 16, 3, 4); g.fillRect(9, 16, 3, 4); }
  else { g.fillRect(5, 16, 3, 4); g.fillRect(8, 16, 3, 4); }
  g.fillStyle = shoe;
  if (step) { g.fillRect(4, 20, 3, 1); g.fillRect(9, 20, 3, 1); }
  else { g.fillRect(5, 20, 3, 1); g.fillRect(8, 20, 3, 1); }

  // torso
  g.fillStyle = shirt; g.fillRect(4, 9, 8, 7);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(4, 14, 8, 2);
  // brazos
  g.fillStyle = shirt; g.fillRect(3, 10, 1, 5); g.fillRect(12, 10, 1, 5);
  g.fillStyle = skin; g.fillRect(3, 15, 1, 1); g.fillRect(12, 15, 1, 1);

  // cabeza
  g.fillStyle = skin; g.fillRect(5, 3, 6, 6);
  g.fillStyle = skinD; g.fillRect(5, 8, 6, 1);
  // pelo según dirección
  g.fillStyle = hair;
  if (dir === 'up') {
    g.fillRect(5, 2, 6, 6);
    g.fillStyle = skin; g.fillRect(6, 7, 4, 1);
  } else if (dir === 'down') {
    g.fillRect(5, 2, 6, 2);
    g.fillRect(5, 3, 1, 3); g.fillRect(10, 3, 1, 3);
    // ojos + boca
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

// Brazo saludando (se dibuja encima del sprite)
function drawWaveArm(g, colorIdx, dir, time) {
  const shirt = SHIRT_COLORS[colorIdx % SHIRT_COLORS.length];
  const osc = Math.sin(time * 0.015) > 0 ? 0 : 1;
  g.fillStyle = shirt;
  if (dir === 'left') { g.fillRect(2 - osc, 6, 1, 5); g.fillStyle = '#f0c8a0'; g.fillRect(2 - osc, 5, 1, 1); }
  else { g.fillRect(13 + osc, 6, 1, 5); g.fillStyle = '#f0c8a0'; g.fillRect(13 + osc, 5, 1, 1); }
}

// ---------- Estado global ----------
const state = {
  myId: null,
  myName: '',
  myColor: 0,
  players: new Map(),   // id -> {name,color,x,y,tx,ty,dir,moving,status,bubble,bubbleUntil,emote,emoteUntil,wave,waveUntil}
  joined: false,
};
const keys = {};
let lastSend = 0;
let lastZone = null;
let mapCanvas = null;
let audioCtx = null;

// ---------- DOM ----------
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

// ---------- Audio (beeps sutiles) ----------
function beep(freq, dur, vol = 0.04, type = 'square') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, audioCtx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(gn); gn.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* sin audio, no pasa nada */ }
}

// ---------- Red ----------
let ws = null;
let reconnectTimer = null;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function connect() {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    toast('✅ Conectado a la oficina');
    if (state.joined) {
      send({ type: 'profile', name: state.myName, color: state.myColor });
    }
  };
  ws.onclose = () => {
    if (state.joined) {
      toast('🔌 Desconectado. Reintentando...');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    }
  };
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    handleMsg(msg);
  };
}

function handleMsg(msg) {
  switch (msg.type) {
    case 'welcome': {
      state.myId = msg.id;
      for (const p of msg.players) upsertRemote(p, true);
      renderPlayerList();
      break;
    }
    case 'state': {
      for (const p of msg.players) {
        if (p.id === state.myId) continue;
        upsertRemote(p, false);
      }
      // eliminar desconectados
      const ids = new Set(msg.players.map((p) => p.id));
      for (const id of [...state.players.keys()]) {
        if (id !== state.myId && !ids.has(id)) state.players.delete(id);
      }
      renderPlayerList();
      break;
    }
    case 'joined': {
      upsertRemote(msg.player, true);
      if (msg.player.name !== state.myName) { beep(660, 0.08); }
      renderPlayerList();
      break;
    }
    case 'left': {
      state.players.delete(msg.id);
      addChat(null, `${msg.name} salió de la oficina`, 'system');
      renderPlayerList();
      break;
    }
    case 'system': {
      addChat(null, msg.text, 'system');
      break;
    }
    case 'chat': {
      const mine = msg.from === state.myName;
      const isWhisper = !!msg.to;
      if (isWhisper && !mine && msg.to !== state.myName) break; // no es para mí
      addChat(msg.from, msg.text, isWhisper ? 'whisper' : 'normal', msg.to);
      if (!mine && (!isWhisper || msg.to === state.myName)) beep(isWhisper ? 880 : 520, 0.07);
      break;
    }
    case 'status': {
      const p = state.players.get(msg.id);
      if (p) p.status = msg.status;
      renderPlayerList();
      break;
    }
    case 'emote': {
      const p = state.players.get(msg.id);
      if (p) { p.emote = msg.emote; p.emoteUntil = performance.now() + 3000; }
      break;
    }
    case 'wave': {
      const p = state.players.get(msg.id);
      if (p) { p.wave = true; p.waveUntil = performance.now() + 1500; }
      if (msg.at && msg.at === state.myName) {
        addChat(null, `${p ? p.name : 'Alguien'} te saludó 👋`, 'system');
        beep(740, 0.09);
      }
      break;
    }
    case 'profile': {
      const p = state.players.get(msg.id);
      if (p) { p.name = msg.name; p.color = msg.color; }
      renderPlayerList();
      break;
    }
  }
}

function upsertRemote(p, snap) {
  let cur = state.players.get(p.id);
  if (!cur) {
    cur = { ...p, tx: p.x, ty: p.y };
    state.players.set(p.id, cur);
  } else {
    cur.name = p.name; cur.color = p.color; cur.dir = p.dir;
    cur.moving = p.moving; cur.status = p.status;
    cur.tx = p.x; cur.ty = p.y;
    if (snap) { cur.x = p.x; cur.y = p.y; }
    if (p.bubble && (!cur.bubble || cur.bubble !== p.bubble)) {
      cur.bubble = p.bubble; cur.bubbleUntil = performance.now() + 5000;
    }
  }
}

// ---------- UI: chat ----------
function addChat(from, text, cls, to) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + cls;
  if (cls === 'system') div.textContent = '· ' + text;
  else if (cls === 'whisper') {
    const who = from === state.myName ? `a ${to}` : from;
    div.innerHTML = `<b>${esc(from === state.myName ? 'vos' : from)}</b> ${esc(text)} <i>(${esc(who === from ? 'privado' : who)})</i>`;
  } else div.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sendChat(raw) {
  const text = raw.trim();
  if (!text) return;
  const w = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
  if (w) {
    send({ type: 'chat', text: w[2], to: w[1] });
  } else if (text.startsWith('/')) {
    addChat(null, `Comando desconocido. Usá /w nombre mensaje`, 'system');
    return;
  } else {
    send({ type: 'chat', text });
  }
}

// ---------- UI: estado / toast / hint ----------
let myStatus = 'disponible';
function buildStatusBar() {
  statusBar.innerHTML = '';
  STATUS_KEYS.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'status-btn';
    b.dataset.status = k;
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
  document.querySelectorAll('.status-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.status === k));
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
      return `<div class="pl-row${isMe ? ' me' : ''}">
        <span class="dot" style="background:${SHIRT_COLORS[p.color % SHIRT_COLORS.length]}"></span>
        ${esc(p.name)}${isMe ? ' (vos)' : ''} <span class="pl-status">${st.emoji} ${st.label}</span></div>`;
    }).join('');
}

// ---------- Zonas y estado automático ----------
function zoneAt(tx, ty) {
  const tile = (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) ? MAP[ty][tx] : '#';
  if (tile === 'C') return { name: 'tu escritorio', status: 'codeando' };
  for (const z of ZONES) {
    if (tx >= z.x0 && tx <= z.x1 && ty >= z.y0 && ty <= z.y1) return z;
  }
  return null;
}

// ---------- Colisiones ----------
function solidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return SOLID.has(MAP[ty][tx]);
}
function canMove(x, y) {
  // caja del jugador: 10px de ancho, 6px de alto en los pies
  return !solidAtPx(x - 4, y - 2) && !solidAtPx(x + 4, y - 2) &&
         !solidAtPx(x - 4, y + 2) && !solidAtPx(x + 4, y + 2);
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

  // estados con 1-5
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 5) { setStatus(STATUS_KEYS[n - 1]); return; }

  // emotes
  const emoteMap = { z: '👋', x: '😂', c: '🎉', v: '👍', b: '🤔', n: '🔥', m: '☕' };
  const em = emoteMap[e.key.toLowerCase()];
  if (em) { send({ type: 'emote', emote: em }); const me = state.players.get(state.myId); if (me) { me.emote = em; me.emoteUntil = performance.now() + 3000; } return; }

  // saludar al más cercano
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

// ---------- Flujo de entrada a la oficina ----------
let selectedColor = 0;
function buildColorPicker() {
  colorsBox.innerHTML = '';
  SHIRT_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'color-btn' + (i === 0 ? ' sel' : '');
    b.style.background = c;
    b.title = 'Color ' + (i + 1);
    b.onclick = () => {
      selectedColor = i;
      document.querySelectorAll('.color-btn').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      previewAvatar(i);
    };
    colorsBox.appendChild(b);
  });
  previewAvatar(0);
}
function previewAvatar(i) {
  const pv = document.getElementById('avatarPreview');
  const g = pv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, pv.width, pv.height);
  const s = getSprite(i, 'down', 0);
  g.drawImage(s, 0, 0, 16, 22, (pv.width - 64) / 2, (pv.height - 88) / 2, 64, 88);
}

function join() {
  const name = (nameInput.value || '').trim() || ('Invitado' + Math.floor(Math.random() * 99));
  state.myName = name;
  state.myColor = selectedColor;
  state.joined = true;
  const me = {
    id: state.myId || 'me', name, color: selectedColor,
    x: 10 * TILE, y: 21 * TILE, tx: 10 * TILE, ty: 21 * TILE,
    dir: 'up', moving: false, status: 'disponible',
    bubble: null, bubbleUntil: 0, emote: null, emoteUntil: 0, wave: false, waveUntil: 0,
  };
  if (state.myId) state.players.set(state.myId, me);
  joinOverlay.classList.add('hidden');
  send({ type: 'profile', name, color: selectedColor });
  addChat(null, `¡Bienvenido/a a la oficina, ${name}! Presioná H para ver la ayuda.`, 'system');
  beep(523, 0.09); setTimeout(() => beep(784, 0.12), 100);
  renderPlayerList();
}

// ---------- Bucle principal ----------
let lastT = performance.now();
let animT = 0;

function resize() {
  SCALE = window.innerHeight >= 760 ? 3 : 2;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

function update(dt) {
  const me = state.players.get(state.myId);
  if (!me || !state.joined) return;

  // movimiento propio
  let dx = 0, dy = 0;
  if (document.activeElement !== chatInput) {
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
  }
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    const step = SPEED * dt;
    const nx = me.x + dx * step, ny = me.y + dy * step;
    if (canMove(nx, me.y)) me.x = nx;
    if (canMove(me.x, ny)) me.y = ny;
    me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    me.moving = true;
    animT += dt * 1000;
  } else {
    me.moving = false;
  }
  me.tx = me.x; me.ty = me.y;

  // envío de posición
  const now = performance.now();
  if (moving && now - lastSend > SEND_MS) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, moving });
  } else if (!moving && now - lastSend > 400) {
    lastSend = now;
    send({ type: 'move', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, moving: false });
  }

  // zona → estado automático
  const ttx = Math.floor(me.x / TILE), tty = Math.floor((me.y + 2) / TILE);
  const z = zoneAt(ttx, tty);
  const zKey = z ? z.name : null;
  if (zKey !== lastZone) {
    lastZone = zKey;
    if (z) {
      setStatus(z.status, true);
      if (z.name !== 'tu escritorio') toast(`📍 Entraste a: ${z.name} — estado: ${STATUS_INFO[z.status].emoji} ${STATUS_INFO[z.status].label}`);
    } else {
      setStatus('disponible', true);
    }
  }

  // interpolación de remotos
  for (const p of state.players.values()) {
    if (p.id === state.myId) continue;
    const k = Math.min(1, dt * 12);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  }

  // hint de proximidad
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

  const worldW = MAP_W * TILE * SCALE, worldH = MAP_H * TILE * SCALE;
  const me = state.players.get(state.myId);
  const focus = me || { x: MAP_W * TILE / 2, y: MAP_H * TILE / 2 };
  const camX = worldW <= W ? (worldW - W) / 2 / SCALE : clamp(focus.x - W / SCALE / 2, 0, MAP_W * TILE - W / SCALE);
  const camY = worldH <= H ? (worldH - H) / 2 / SCALE : clamp(focus.y - H / SCALE / 2, 0, MAP_H * TILE - H / SCALE);

  // mapa
  ctx.drawImage(mapCanvas, Math.round(-camX * SCALE), Math.round(-camY * SCALE), worldW, worldH);

  const now = performance.now();
  const frame = Math.floor(animT / 160) % 2;

  // jugadores ordenados por Y (profundidad)
  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    const sx = Math.round((p.x - camX) * SCALE) - 8 * SCALE;
    const sy = Math.round((p.y - camY) * SCALE) - 18 * SCALE;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx + 8 * SCALE, sy + 21 * SCALE, 5 * SCALE, 2 * SCALE, 0, 0, Math.PI * 2);
    ctx.fill();

    let f = 0;
    if (p.id === state.myId) f = p.moving ? frame : 0;
    else f = p.moving ? Math.floor(now / 160) % 2 : 0;

    const spr = getSprite(p.color || 0, p.dir || 'down', f);
    ctx.drawImage(spr, 0, 0, 16, 22, sx, sy, 16 * SCALE, 22 * SCALE);

    if (p.wave && now < p.waveUntil) {
      ctx.save();
      ctx.translate(sx, sy); ctx.scale(SCALE, SCALE);
      drawWaveArm(ctx, p.color || 0, p.dir || 'down', now);
      ctx.restore();
    }

    // nombre + estado (espacio pantalla)
    const st = STATUS_INFO[p.status] || STATUS_INFO.disponible;
    ctx.font = `${Math.max(11, SCALE * 4)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    const label = `${st.emoji} ${p.name}`;
    const lx = sx + 8 * SCALE, ly = sy - 6 * SCALE;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,12,18,0.9)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = p.id === state.myId ? '#ffd76a' : '#ffffff';
    ctx.fillText(label, lx, ly);

    // emote flotante
    if (p.emote && now < p.emoteUntil) {
      const bounce = Math.sin((p.emoteUntil - now) / 120) * 4;
      ctx.font = `${SCALE * 9}px serif`;
      ctx.fillText(p.emote, lx + 14 * SCALE, ly - 12 * SCALE + bounce);
    }

    // burbuja de chat
    if (p.bubble && now < p.bubbleUntil) {
      drawBubble(ctx, p.bubble, lx, ly - 14 * SCALE, SCALE);
    }
  }
}

function drawBubble(g2, text, cx, bottomY, scale) {
  g2.font = `${Math.max(11, scale * 4)}px "Press Start 2P", monospace`;
  // cortar texto largo en 2 líneas
  const maxW = 220;
  let lines = [];
  const words = text.split(' ');
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g2.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (lines.length === 0) lines = [text.slice(0, 28)];
  const lh = Math.max(13, scale * 5);
  let bw = 0;
  for (const l of lines) bw = Math.max(bw, g2.measureText(l).width);
  bw += 16; const bh = lines.length * lh + 12;
  const x = Math.round(cx - bw / 2), y = Math.round(bottomY - bh);

  g2.fillStyle = 'rgba(16,19,26,0.95)';
  g2.fillRect(x - 3, y - 3, bw + 6, bh + 6);
  g2.fillStyle = '#fffdf5';
  g2.fillRect(x, y, bw, bh);
  // colita
  g2.beginPath();
  g2.moveTo(cx - 6, y + bh); g2.lineTo(cx + 6, y + bh); g2.lineTo(cx, y + bh + 8);
  g2.closePath();
  g2.fillStyle = 'rgba(16,19,26,0.95)'; g2.fill();
  g2.beginPath();
  g2.moveTo(cx - 4, y + bh); g2.lineTo(cx + 4, y + bh); g2.lineTo(cx, y + bh + 5);
  g2.closePath(); g2.fillStyle = '#fffdf5'; g2.fill();

  g2.fillStyle = '#1c2129';
  g2.textAlign = 'center';
  lines.forEach((l, i) => g2.fillText(l, cx, y + 12 + i * lh + lh * 0.4));
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- Arranque ----------
function init() {
  resize();
  mapCanvas = buildMapCanvas();
  buildStatusBar();
  buildColorPicker();
  renderPlayerList();

  // prefill por URL: ?name=Laura
  const q = new URLSearchParams(location.search);
  if (q.get('name')) nameInput.value = q.get('name');

  joinBtn.onclick = join;
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

  connect();
  requestAnimationFrame(loop);
}

init();
