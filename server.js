/**
 * Oficina Virtual 2D — Servidor multiplayer
 * Node.js + ws. Sirve los archivos estáticos y sincroniza jugadores en tiempo real.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname; // el sitio vive en la raíz (compatible con GitHub Pages)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// ---------- Static file server ----------
// Streaming (no se carga el archivo entero en memoria por request) con
// ETag + Cache-Control por tipo:
// - dibujos con hash de contenido (assets.js): inmutables 1 año.
// - css/js versionados con ?v=: 1 hora + revalidación.
// - index.html: 10 minutos (es el único que puede llegar viejo: el sello
//   ov-build de game.js lo detecta y fuerza la recarga).
const CACHE = {
  '.png': 'public, max-age=31536000, immutable',
  '.jpg': 'public, max-age=31536000, immutable',
  '.jpeg': 'public, max-age=31536000, immutable',
  '.gif': 'public, max-age=31536000, immutable',
  '.webp': 'public, max-age=31536000, immutable',
  '.svg': 'public, max-age=31536000, immutable',
  '.ico': 'public, max-age=31536000, immutable',
  '.css': 'public, max-age=3600, must-revalidate',
  '.js': 'public, max-age=3600, must-revalidate',
};
function etagDe(st) {
  return `"${st.size.toString(36)}-${Number(st.mtimeMs).toString(36)}"`;
}
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  // path.normalize ya colapsa los "..", así que con startsWith alcanza hoy; se
  // le exige igual el separador, porque sin él entraría cualquier directorio
  // hermano que empiece igual ("Oficina-virtual-copia\..."). Defensa simple,
  // sin lógica nueva que pueda romper el serveo normal.
  const dentro = filePath === PUBLIC_DIR || filePath.startsWith(PUBLIC_DIR + path.sep);
  if (!dentro) {
    res.writeHead(403); return res.end('Forbidden');
  }
  const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep)[0];
  if (rel === 'node_modules' || rel === '.git') {
    res.writeHead(404); return res.end('Not Found');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const tag = etagDe(st);
    if (req.headers['if-none-match'] === tag) {
      res.writeHead(304); return res.end();
    }
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'ETag': tag,
      'Cache-Control': CACHE[ext] || 'public, max-age=600',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const flujo = fs.createReadStream(filePath);
    flujo.on('error', () => { try { res.destroy(); } catch {} });
    flujo.pipe(res);
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
// No va el DNI en crudo: llega el hash y acá se compara. Mismo salt que en
// game.js. Es privacidad (esto es un repo público), no seguridad: un DNI de 8
// dígitos se fuerza bruta. AGENTE.md lo explica.
const ROSTER_DNI_SALT = 'somospopups-dni-v1:';
const ROSTER = [
  { dniHash: 'b1107acec716b2b2fb97d22981b837e7e06820b04eb9e547f5ddfc8ac49d7462', name: 'Ger',  char: 'ger'  },
  { dniHash: '3287864555e7cb9d27c8d35d1061d2a0bdb49443d15437f20380a73525ede609', name: 'Facu', char: 'facu' },
  { dniHash: '06c9e59af9a354f49c5f4e256cfcd7d4234d72548168a5f255d7042d0080f2cc', name: 'Ovni', char: 'ovni' },
  // visita: entra igual que todos; game.js es el que no la lista en gris cuando no está.
  { dniHash: '8d3e12b8ee8286deb18b955aa7ca2e0b4313815025769398ce8adde55a8e37f1', name: 'Milo', char: 'milo', visita: true },
  { dniHash: '94f949db2a43a11784e6eb9ee9d1dede14710bf804fa413ef2368765ce17f07f', name: 'Ove',  char: 'ove'  },
];

function dniHashDe(dni) {
  return crypto.createHash('sha256').update(ROSTER_DNI_SALT + dni, 'utf8').digest('hex');
}

function publicState() {
  return [...players.values()].filter((p) => p.authed).map((p) => ({
    id: p.id, name: p.name, char: p.char, color: p.color, joinTs: p.joinTs,
    x: p.x, y: p.y, dir: p.dir, moving: p.moving, seated: !!p.seated,
    status: p.status, fightMode: !!p.fightMode, poleOn: !!p.poleOn, bubble: p.bubble, bubbleUntil: p.bubbleUntil,
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
  // Se limpia en 'close': si no, cada conexión dejaba un timer de 50 ms vivo
  // para siempre y la fuga crecía con cada persona que entraba y salía.
  const stateTimer = setInterval(() => {
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
        // El cliente manda el hash. Si llega en crudo (pestaña con el JS viejo
        // todavía abierta) lo hasheamos acá y compara igual: nadie queda fuera
        // durante el paso de versión.
        const limpio = String(msg.dni || '').replace(/\D/g, '');
        const hash = msg.dniHash
          ? String(msg.dniHash).toLowerCase()
          : (limpio ? dniHashDe(limpio) : '');
        const entry = ROSTER.find((r) => r.dniHash === hash);
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
        p.fightMode = !!msg.fightMode;
        if (p.char === 'ger') p.poleOn = !!msg.poleOn;   // la bailarina es sólo de Ger
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
        if (['cafe', 'birra'].includes(msg.anim)) broadcast({ type: 'anim', id, anim: msg.anim });
        break;
      }
      case 'fight-mode': {
        p.fightMode = !!msg.active;
        broadcast({ type: 'fight-mode', id, active: p.fightMode });
        break;
      }
      // Bailarina del caño: la prende y apaga sólo Ger; el resto la ve.
      case 'pole': {
        if (p.char !== 'ger') break;
        p.poleOn = !!msg.active;
        broadcast({ type: 'pole', id, active: p.poleOn });
        break;
      }
      case 'fight-hit': {
        const hit = Math.max(1, Math.min(5, Number(msg.hit) || 1));
        broadcast({ type: 'fight-hit', id, hit });
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
    clearInterval(stateTimer);
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
