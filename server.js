/**
 * Oficina Virtual 2D — Servidor multiplayer
 * Node.js + ws. Sirve los archivos estáticos y sincroniza jugadores en tiempo real.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname; // el sitio vive en la raíz (compatible con GitHub Pages)

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
  const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep)[0];
  if (rel === 'node_modules' || rel === '.git') {
    res.writeHead(404); return res.end('Not Found');
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

// Roster del equipo: solo se entra con DNI registrado.
// ⚠️ Tiene que ser EL MISMO que el ROSTER de game.js. Si acá falta alguien, en
// modo servidor (Render o local) le rebota el DNI aunque en GitHub Pages entre
// bien, porque en P2P el DNI se valida contra game.js.
const ROSTER = [
  { dni: '33245911', name: 'Ger',  char: 'ger'  },
  { dni: '31923010', name: 'Facu', char: 'facu' },
  { dni: '34186736', name: 'Ovni', char: 'ovni' },
  // visita: entra igual que todos; game.js es el que no la lista en gris cuando no está.
  { dni: '54472249', name: 'Milo', char: 'milo', visita: true },
  { dni: '32769127', name: 'Ove',  char: 'ove'  },
];

function publicState() {
  return [...players.values()].filter((p) => p.authed).map((p) => ({
    id: p.id, name: p.name, char: p.char, color: p.color, joinTs: p.joinTs,
    x: p.x, y: p.y, dir: p.dir, moving: p.moving, seated: !!p.seated,
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
    id, name: 'Anónimo', char: null, authed: false, color: 0, joinTs: Date.now(),
    x: 597, y: 820, // spawn: centro del pasillo, coords virtuales del fondo
    dir: 'down', moving: false, seated: false,
    status: 'disponible',
    bubble: null, bubbleUntil: 0,
    emote: null, emoteUntil: 0,
    wave: false, waveUntil: 0,
    lastMove: Date.now(),
  };
  players.set(id, player);

  // entra como "fantasma" hasta autenticarse con DNI
  ws.send(JSON.stringify({ type: 'welcome', id, players: publicState() }));

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
        const entry = ROSTER.find((r) => r.dni === String(msg.dni || '').replace(/\D/g, ''));
        if (!entry) { ws.send(JSON.stringify({ type: 'auth-fail', reason: 'dni' })); return; }
        const dup = [...players.values()].some((q) => q.authed && q.char === entry.char && q.id !== id);
        if (dup) { ws.send(JSON.stringify({ type: 'auth-fail', reason: 'dup' })); return; }
        p.authed = true; p.name = entry.name; p.char = entry.char;
        broadcast({ type: 'joined', player: publicState().find((q) => q.id === id) }, ws);
        broadcast({ type: 'system', text: `${p.name} entró a la oficina` });
        broadcast({ type: 'profile', id, name: p.name, char: p.char, color: p.color });
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
        p.seated = !!msg.seated;
        p.lastMove = Date.now();
        break;
      }
      case 'status': {
        if (['codeando', 'reunion', 'ausente', 'disponible'].includes(msg.status)) {
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
      // Animaciones de personaje (hoy: el cafecito en la silla). Se reenvía
      // tal cual, con lista blanca de nombres para que nadie invente una.
      case 'anim': {
        if (['cafe'].includes(msg.anim)) broadcast({ type: 'anim', id, anim: msg.anim });
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
    if (p && p.authed) broadcast({ type: 'left', id, name: p.name });
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
