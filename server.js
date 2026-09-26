/**
 * Oficina Virtual 2D — Servidor multiplayer
 * Node.js + ws. Sirve los archivos estáticos y sincroniza jugadores en tiempo real.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- Static file server ----------
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- Game state ----------
const players = new Map(); // id -> player
let nextId = 1;

function broadcast(obj, exceptWs = null) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client !== exceptWs && client.readyState === 1) client.send(msg);
  });
}

function publicState() {
  return [...players.values()].map((p) => ({
    id: p.id, name: p.name, color: p.color,
    x: p.x, y: p.y, dir: p.dir, moving: p.moving,
    status: p.status, bubble: p.bubble, bubbleUntil: p.bubbleUntil,
    emote: p.emote, emoteUntil: p.emoteUntil, wave: p.wave, waveUntil: p.waveUntil,
  }));
}

// ---------- WebSocket server ----------
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const id = 'p' + nextId++;
  ws.playerId = id;

  // Nuevo jugador aparece en la entrada (spawn)
  const player = {
    id, name: 'Anónimo', color: 0,
    x: 21.5 * 16, y: 27 * 16, // spawn: puerta de entrada (en tiles * TILE)
    dir: 'down', moving: false,
    status: 'disponible',
    bubble: null, bubbleUntil: 0,
    emote: null, emoteUntil: 0,
    wave: false, waveUntil: 0,
    lastMove: Date.now(),
  };
  players.set(id, player);

  ws.send(JSON.stringify({ type: 'welcome', id, players: publicState() }));
  broadcast({ type: 'joined', player: publicState().find((p) => p.id === id) }, ws);
  broadcast({ type: 'system', text: `${player.name} entró a la oficina` });

  // Broadcast periódico de estado (20 Hz) — posiciones suaves para todos
  setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'state', players: publicState(), t: Date.now() }));
    }
  }, 50);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = players.get(id);
    if (!p) return;

    switch (msg.type) {
      case 'profile': {
        if (typeof msg.name === 'string' && msg.name.trim()) {
          const old = p.name;
          p.name = msg.name.trim().slice(0, 16);
          p.color = Number.isInteger(msg.color) ? ((msg.color % 8) + 8) % 8 : 0;
          broadcast({ type: 'system', text: `${old === 'Anónimo' ? '' : old + ' ahora se llama '}${p.name} 💼` });
          broadcast({ type: 'profile', id, name: p.name, color: p.color });
        }
        break;
      }
      case 'move': {
        const nx = Number(msg.x), ny = Number(msg.y);
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          // anti-teleport básico: máximo ~8 tiles/actualización
          const dx = nx - p.x, dy = ny - p.y;
          if (dx * dx + dy * dy < (8 * 16) ** 2) { p.x = nx; p.y = ny; }
          else { p.x = nx; p.y = ny; } // igual sincronizamos (el servidor confía, mapa pequeño)
        }
        if (['up', 'down', 'left', 'right'].includes(msg.dir)) p.dir = msg.dir;
        p.moving = !!msg.moving;
        p.lastMove = Date.now();
        break;
      }
      case 'status': {
        if (['codeando', 'reunion', 'cafe', 'ausente', 'disponible'].includes(msg.status)) {
          p.status = msg.status;
          broadcast({ type: 'status', id, status: p.status });
        }
        break;
      }
      case 'chat': {
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) break;
        p.bubble = text;
        p.bubbleUntil = Date.now() + 5000;
        const whisperTo = msg.to || null; // nombre de destino para /w
        broadcast({ type: 'chat', from: p.name, text, to: whisperTo, id });
        break;
      }
      case 'emote': {
        const emotes = ['👋', '😂', '🎉', '❤️', '👍', '🤔', '🔥', '☕'];
        if (emotes.includes(msg.emote)) {
          p.emote = msg.emote;
          p.emoteUntil = Date.now() + 3000;
          broadcast({ type: 'emote', id, emote: msg.emote });
        }
        break;
      }
      case 'wave': {
        p.wave = true;
        p.waveUntil = Date.now() + 1500;
        broadcast({ type: 'wave', id, at: msg.at || null });
        break;
      }
    }
  });

  ws.on('close', () => {
    const p = players.get(id);
    players.delete(id);
    if (p) broadcast({ type: 'left', id, name: p.name });
  });
});

// Limpieza de burbujas/emotes viejos (para no mandar basura eterna)
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.bubbleUntil && now > p.bubbleUntil) { p.bubble = null; p.bubbleUntil = 0; }
    if (p.emoteUntil && now > p.emoteUntil) { p.emote = null; p.emoteUntil = 0; }
    if (p.waveUntil && now > p.waveUntil) { p.wave = false; p.waveUntil = 0; }
  }
}, 500);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏢 Oficina Virtual corriendo en http://0.0.0.0:${PORT}`);
});
