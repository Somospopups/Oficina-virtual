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

const SPEED = 320;
const SEND_MS = 140;

const STATUS_INFO = {
  codeando:   { emoji: '💻', label: 'Codeando' },
  reunion:    { emoji: '🤝', label: 'En reunión' },
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
// Sube o baja un color hacia blanco/negro. t>0 aclara, t<0 oscurece. Es la base
// de los degradados del sentado: cada superficie se modela con su tono, sus
// luces y sus sombras, igual que en los PNG de referencia.
function tone(hex, t) { return lerpColor(hex, t > 0 ? '#ffffff' : '#000000', Math.abs(t)); }
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

// ---------- Roster del equipo (ingreso por DNI) ----------
const ROSTER = [
  { dni: '33245911', name: 'Ger',  char: 'ger',  seat: 1 },
  { dni: '31923010', name: 'Facu', char: 'facu', seat: 2 },
  { dni: '34186736', name: 'Ovni', char: 'ovni', seat: 3 },
];
// Paleta muestreada de los PNG de referencia (sprites/*.png), no aproximada a ojo:
// así el chibi de grilla (fallback), el sentado y los PNG comparten los mismos
// tonos y no se nota de dónde salió cada uno.
const CHAR_DEF = {
  ger:  { skin: '#f5b984', skinD: '#d69a68', hair: '#2a1a12', beard: '#3a2418', beardStyle: 'goatee', shirt: '#201e24', pants: '#4c6886', shoe: '#141418', sole: '#d8d8dc', wide: false, hairStyle: 'spiky', dot: '#8a6a4a' },
  facu: { skin: '#f0a876', skinD: '#d08c5c', hair: '#0d0d12', beard: '#0d0d12', beardStyle: 'full',  shirt: '#2e6198', pants: '#537793', shoe: '#5a4432', sole: null,      wide: true,  hairStyle: 'full',  dot: '#2e6198' },
  ovni: { skin: '#f7b985', skinD: '#d89e6a', hair: '#1a1512', beard: '#241c18', beardStyle: 'goatee', shirt: '#fcb306', pants: '#25232d', shoe: '#e8e8e8', sole: '#9aa2ae', wide: false, hairStyle: 'cap',   dot: '#fcb306', jacket: true },
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
// ---------- Sprites de referencia (PNG) ----------
// Los 3 personajes vienen de las referencias del equipo como pixel art de alta
// resolución. Al reducirse en pantalla usan smoothing; el fallback por código sí
// conserva la grilla y el nearest-neighbor.
const charAssets = {};   // charKey -> { down, left, right, up, sit }
// Las poses sentadas de referencia nacen en estas orientaciones; se espejan
// automáticamente cuando alguien ocupa un puesto del lado opuesto.
const SIT_BASE_FACE = { ger: 'left', facu: 'right', ovni: 'right' };
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

// ---------- Llamada de la oficina: micro compartido (malla WebRTC) ----------
// Audio nada más, no video. La idea es poder DEJAR EL MICRO ABIERTO y hablar
// siempre con quien esté en la oficina, sin apretar para hablar. Con 3 personas
// son 3 conexiones (una por pareja) y el audio comprimido va unos 40 kbps cada
// una, así que el ancho de banda no es un problema.
//
// El STUN es el público de Google: gratis y sin servidor propio. No hay TURN, así
// que en redes simétricas o corporativas la conexión puede no cruzar. Por eso,
// si falla, avisamos en vez de dejar al usuario mirando un botón mudo.
//
// Malla completa (1,1,1) y no "hub": cada uno se conecta con cada uno. A los 3 no
// hay drama; a 8 esto ya no escala y ahí haría falta un servidor de reenvío.
const RTC_STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const rtcMesh = new Map();     // peerId -> { pc, polite, pendingIce[] }
const rtcMic = new Map();      // peerId -> true si tiene el micro abierto
const rtcNivel = new Map();    // peerId -> 0..1, para ver quién está hablando
const rtcVivo = new Map();     // peerId -> { audio, analyser, data, buf }
let rtcStream = null, rtcTrack = null, rtcOn = false, rtcAviso = false, rtcBloqueado = false;

// ---------- Compartir pantalla ----------
// Reusa la malla de audio: no es una red nueva, es agregar un track de video a las
// conexiones que ya están. Solo uno a la vez, y mudo (el audio lo lleva el micro
// aparte; mezclarlo se acopla y ademas es unaDecision de privacidad).
let rtcPantalla = null, rtcPantallaTrack = null, rtcComparto = false, rtcReneg = false, rtcRenegPend = false;
const rtcComparte = new Map();  // peerId -> true si está compartiendo pantalla
const rtcShareSid = new Map();  // peerId -> id del stream de su pantalla
const rtcShareVivo = new Map(); // peerId -> MediaStream recibido de su pantalla (se conserva al cortar: el re-share revive por replaceTrack sin ontrack nuevo)

// ---------- Cámaras ----------
// Mismo criterio que la pantalla: no es una red nueva, es otro track de video
// sobre la malla que ya existe. Se distingue de la pantalla por el id del
// MediaStream, que viaja en el aviso 'rtc-cam' (el msid se conserva entre pares).
let rtcCamStream = null, rtcCamTrack = null, rtcCamOn = false;
const rtcCamPeers = new Map();  // peerId -> true si tiene la cámara prendida
const rtcCamSid = new Map();    // peerId -> id del stream de su cámara
const rtcCamVivo = new Map();   // peerId -> MediaStream recibido de su cámara
const rtcVideoPend = new Map(); // peerId -> [streams de video sin clasificar aún]
const rtcCamOculto = new Set(); // cámaras remotas que elegí no ver (solo local)
const rtcMuteLocal = new Set(); // compañeros silenciados solo para mí

// Con quién tiene que haber conexión: si yo hablo, o me comparten el micro, o me
// comparten la pantalla. Ojo: esto es lo que hace que compartir pantalla funcione
// aunque nadie tenga el micro abierto.
function rtcConectaCon(peer) {
  return rtcOn || rtcComparto || rtcCamOn || !!rtcMic.get(peer) || !!rtcComparte.get(peer) || !!rtcCamPeers.get(peer);
}

function rtcNombreDe(peer) {
  const p = state.players.get(peer);
  return p ? p.name : 'un compañero';
}

async function rtcCompartir() {
  if (rtcComparto) { rtcDejarDeCompartir(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    toast('🖥 Este navegador no deja compartir pantalla. En iPhone e iPad no existe la función.');
    return;
  }
  if (rtcComparte.size) {
    // Ocupado de verdad = hay un video de pantalla ajeno en el aire. Si los
    // mapas quedaron sucios de una sesión anterior pero no se está mostrando
    // nada, se limpian y se deja compartir: si no, el botón quedaba muerto.
    if (document.getElementById('rtcVideo')) {
      toast('🖥 Ya hay alguien compartiendo pantalla. Solo una a la vez.');
      return;
    }
    rtcComparte.clear();
    rtcShareSid.clear();
  }
  let stream;
  try {
    // Abstractions: el usuario elige pantalla, ventana o pestaña. Si cancela, se
    // lanza y no pasa nada. Se pide buena resolución y hasta 30 fps: el
    // navegador después baja solo si la red no da.
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch { return; }
  rtcPantalla = stream;
  rtcPantallaTrack = stream.getVideoTracks()[0];
  if (!rtcPantallaTrack) { rtcDejarDeCompartir(); return; }
  // Pista para el codificador: es una pantalla con texto, priorizar nitidez
  // sobre fluidez (si no, el texto se ve borroso apenas la red aprieta).
  try { rtcPantallaTrack.contentHint = 'detail'; } catch { /* navegador viejo */ }
  rtcComparto = true;
  // Si el usuario corta desde el propio navegador (el cartelito de "Dejar de
  // compartir"), hay que enterarse igual.
  rtcPantallaTrack.onended = () => rtcDejarDeCompartir();
  // El sid viaja en el aviso, igual que en 'rtc-cam': es lo que permite
  // distinguir sin ambigüedad la pantalla de la cámara del mismo par.
  send({ type: 'rtc-share', on: true, from: state.myId, sid: stream.id });
  rtcConectarConTodos();
  renderCallUI();
  // MISMO mecanismo que la cámara (que nunca falla): si la conexión ya tiene
  // canal de pantalla de una vez anterior, se enchufa el track nuevo con
  // replaceTrack — CERO renegociación. Solo se renegocia con conexiones que
  // nunca tuvieron canal de pantalla.
  let necesitaReneg = false;
  for (const p of rtcMesh.values()) {
    if (p.nuevo) { necesitaReneg = true; continue; }
    if (p.shareSender) {
      try { p.shareSender.replaceTrack(rtcPantallaTrack); } catch { necesitaReneg = true; }
    } else necesitaReneg = true;
  }
  if (necesitaReneg) await rtcRenegociar();
  toast('🖥 Compartiendo tu pantalla. La ven en la ventana de video.');
}

function rtcDejarDeCompartir() {
  const track = rtcPantallaTrack;
  if (track) { try { track.stop(); } catch { /* ya estaba */ } }
  rtcPantalla = null; rtcPantallaTrack = null;
  if (!rtcComparto) return;
  rtcComparto = false;
  send({ type: 'rtc-share', on: false, from: state.myId });
  // Se desenchufa el track pero el canal QUEDA VIVO (replaceTrack a null),
  // igual que al apagar la cámara. Nada de removeTrack ni de renegociar: la
  // renegociación era la fuente de todos los bugs del re-share.
  for (const p of rtcMesh.values()) {
    if (p.shareSender) { try { p.shareSender.replaceTrack(null); } catch { /* ya cerrado */ } }
  }
  renderCallUI();
}

// Agrega o saca el track de pantalla y vuelve a ofertar. Solo comparte uno a la vez,
// así que las renegociaciones nunca se cruzan entre dos pares.
async function rtcRenegociar() {
  // Si ya hay una renegociación en curso NO se descarta: se anota y se corre
  // otra al terminar. Descartarla era el bug de "dejo de compartir y al
  // volver a compartir no sale": el track nuevo nunca llegaba a ofertarse.
  if (rtcReneg) { rtcRenegPend = true; return; }
  rtcReneg = true;
  try {
    for (const [peer, p] of rtcMesh) {
      try {
        // Conexión nueva donde el iniciador es el otro: su oferta va a llegar
        // apenas procese mi aviso; ofertar acá también generaría un choque.
        if (p.nuevo && !rtcIniciyo(peer)) continue;
        const yaEsta = rtcPantallaTrack && p.pc.getSenders().some((s) => s.track === rtcPantallaTrack);
        if (rtcPantallaTrack && !yaEsta) p.shareSender = p.pc.addTrack(rtcPantallaTrack, rtcPantalla);
        const camEsta = rtcCamTrack && p.pc.getSenders().some((s) => s.track === rtcCamTrack);
        if (rtcCamTrack && !camEsta) p.camSender = p.pc.addTrack(rtcCamTrack, rtcCamStream);
        const micEsta = rtcTrack && p.pc.getSenders().some((s) => s.track === rtcTrack);
        if (rtcTrack && !micEsta) p.pc.addTrack(rtcTrack, rtcStream);
        rtcAsegurarCanales(p);
        const of = await p.pc.createOffer();
        await p.pc.setLocalDescription(of);
        p.nuevo = false;
        send({ type: 'rtc-offer', to: peer, sdp: p.pc.localDescription, from: state.myId, reneg: 1, spec: 1 });
      } catch { /* se reintenta con el siguiente hello */ }
    }
  } finally {
    rtcReneg = false;
    if (rtcRenegPend) { rtcRenegPend = false; rtcRenegociar(); }
  }
}

function rtcVerPantalla(peer, stream) {
  const box = document.getElementById('videoBox');
  if (!box) return;
  // Nunca conviven el iframe de YouTube y el video de la pantalla.
  box.querySelectorAll('iframe').forEach((f) => f.remove());
  let v = document.getElementById('rtcVideo');
  if (!v) {
    v = document.createElement('video');
    v.id = 'rtcVideo';
    v.autoplay = true; v.playsInline = true; v.muted = true;  // mudo: el audio va por el micro
    box.appendChild(v);
  }
  v.srcObject = stream;
  // El play puede fallar: autoplay bloqueado (típico del navegador del TV) o
  // track todavía sin cuadros justo después de una renegociación (pasa al
  // RE-compartir). Un solo intento dejaba el botón de play clavado para
  // siempre: ahora se reintenta cuando llegan los primeros cuadros, cuando
  // hay metadata, y ante cualquier gesto (rtcDesbloquearPorGesto).
  const intentar = () => { if (v.isConnected && v.paused) v.play().catch(() => {}); };
  intentar();
  v.onloadedmetadata = intentar;
  const tr = stream.getVideoTracks()[0];
  if (tr) tr.onunmute = intentar;
  rtcComparte.set(peer, true);
  // El stream se conserva aunque corte: cuando vuelva a compartir, el track
  // revive por replaceTrack en este MISMO stream y no llega ontrack nuevo.
  rtcShareVivo.set(peer, stream);
  const panel = document.getElementById('videoPanel');
  if (panel) panel.classList.remove('hidden');
  const who = document.getElementById('videoWho');
  if (who) who.textContent = `🖥 ${rtcNombreDe(peer)} está compartiendo pantalla`;
  const note = document.getElementById('videoNote');
  if (note) note.textContent = 'Pantalla de un compañero: no se puede pausar ni sincronizar.';
  const tap = document.getElementById('videoTap');
  if (tap) tap.classList.add('hidden');
  aplicarFloat();
  renderCallUI();
}

function rtcOcultarPantalla() {
  rtcComparte.clear();
  rtcShareSid.clear();
  const v = document.getElementById('rtcVideo');
  if (v) { try { v.srcObject = null; } catch { /* ya no está */ } v.remove(); }
  const panel = document.getElementById('videoPanel');
  if (panel && !music.item) panel.classList.add('hidden');
  renderCallUI();
}

// ---------- Cámaras: prender, apagar y mostrar ----------
async function rtcCamToggle() { if (rtcCamOn) rtcCamApagar(); else rtcCamPrender(); }
async function rtcCamPrender() {
  if (rtcCamOn) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('📷 Este navegador no deja usar la cámara.'); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 480 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }, audio: false,
    });
  } catch { toast('📷 No se pudo abrir la cámara. Revisá el permiso del navegador.'); return; }
  rtcCamStream = stream;
  rtcCamTrack = stream.getVideoTracks()[0];
  if (!rtcCamTrack) { rtcCamApagar(); return; }
  rtcCamOn = true;
  rtcCamTrack.onended = () => rtcCamApagar();
  send({ type: 'rtc-cam', on: true, from: state.myId, sid: rtcCamStream.id });
  rtcConectarConTodos();
  renderCallUI(); renderCamStrip();
  // Si la conexión ya tiene un canal de cámara (de una vez anterior), se
  // enchufa el track nuevo con replaceTrack: cero renegociación. Solo se
  // renegocia con los pares que nunca tuvieron canal de cámara.
  let necesitaReneg = false;
  for (const p of rtcMesh.values()) {
    if (p.nuevo) { necesitaReneg = true; continue; }  // sin negociar aún: va por oferta
    if (p.camSender) {
      try { p.camSender.replaceTrack(rtcCamTrack); } catch { necesitaReneg = true; }
    } else necesitaReneg = true;
  }
  if (necesitaReneg) await rtcRenegociar();
  toast('📷 Cámara prendida: se ve en los cuadrados de la derecha.');
}
function rtcCamApagar() {
  // Apagar la cámara apaga SOLO la mía: el canal queda vivo (replaceTrack a
  // null) y las cámaras de los demás ni se enteran. Nada de renegociar ni de
  // tirar conexiones.
  const track = rtcCamTrack;
  if (track) { try { track.stop(); } catch { /* ya estaba */ } }
  rtcCamStream = null; rtcCamTrack = null;
  if (!rtcCamOn) return;
  rtcCamOn = false;
  send({ type: 'rtc-cam', on: false, from: state.myId });
  for (const p of rtcMesh.values()) {
    if (p.camSender) { try { p.camSender.replaceTrack(null); } catch { /* ya cerrado */ } }
  }
  renderCallUI(); renderCamStrip();
}
// Un video entrante puede ser cámara o pantalla: se decide por el id del stream
// que anunció el 'rtc-cam'. Si el aviso todavía no llegó, queda pendiente y se
// resuelve cuando llega (rtcResolverVideos).
function rtcVideoEntrante(peer, stream) {
  if (rtcCamSid.get(peer) === stream.id) { rtcCamVer(peer, stream); return; }
  if (rtcShareSid.get(peer) === stream.id) { rtcVerPantalla(peer, stream); return; }
  // Sin sid que coincida: solo se asume pantalla si el aviso viejo (sin sid)
  // lo dice y no hay riesgo de que sea la cámara llegando antes que su aviso.
  if (rtcComparte.get(peer) && !rtcShareSid.get(peer) && (!rtcCamPeers.get(peer) || rtcCamSid.has(peer))) { rtcVerPantalla(peer, stream); return; }
  const arr = rtcVideoPend.get(peer) || [];
  arr.push(stream); rtcVideoPend.set(peer, arr);
}
function rtcResolverVideos(peer) {
  const arr = rtcVideoPend.get(peer);
  if (!arr || !arr.length) return;
  const resto = [];
  for (const st of arr) {
    if (rtcCamSid.get(peer) === st.id) rtcCamVer(peer, st);
    else if (rtcShareSid.get(peer) === st.id) rtcVerPantalla(peer, st);
    else if (rtcComparte.get(peer) && !rtcShareSid.get(peer)) rtcVerPantalla(peer, st);
    else resto.push(st);
  }
  if (resto.length) rtcVideoPend.set(peer, resto); else rtcVideoPend.delete(peer);
}
function rtcCamVer(peer, stream) {
  rtcCamVivo.set(peer, stream);
  renderCamStrip();
}
// Tira de 3 cuadrados iguales en el margen derecho: vos + dos compañeros.
// Los <video> viven en el DOM y solo se les cambia el srcObject cuando hace
// falta, así el que ya está reproduciendo no parpadea en cada re-render.
// La tira es "pegajosa": aparece la primera vez que alguien prende una cámara
// y de ahí en más se queda (con los cuadros en "apagada" si hace falta). Si se
// escondiera al apagar, el botoncito 📷 del cuadro desaparecería con ella y no
// habría desde dónde volver a prenderla.
let camStripSticky = false;
function renderCamStrip() {
  const strip = document.getElementById('camStrip');
  if (!strip) return;
  const alguna = rtcCamOn || rtcCamPeers.size > 0 || camStripSticky;
  strip.hidden = !alguna;
  if (!alguna) return;
  camStripSticky = true;
  while (strip.children.length < 3) {
    const d = document.createElement('div');
    d.className = 'cam-slot off';
    const v = document.createElement('video');
    v.autoplay = true; v.playsInline = true; v.muted = true;
    const off = document.createElement('div'); off.className = 'cam-off'; off.textContent = '📷 apagada';
    const nom = document.createElement('div'); nom.className = 'cam-name';
    const ct = document.createElement('div'); ct.className = 'cam-ctls';
    const bc = document.createElement('button'); bc.type = 'button'; bc.className = 'cc cc-cam';
    const bm = document.createElement('button'); bm.type = 'button'; bm.className = 'cc cc-mic';
    ct.append(bc, bm);
    d.append(v, off, nom, ct);
    strip.appendChild(d);
  }
  const otros = [...state.players.values()]
    .filter((p) => p.id && p.id !== state.myId)
    .sort((a, b) => ((rtcCamPeers.get(b.id) ? 1 : 0) - (rtcCamPeers.get(a.id) ? 1 : 0)) || String(a.name).localeCompare(String(b.name)))
    .slice(0, state.spectating ? 3 : 2);
  // El espectador no tiene cuadro propio: ve a los (hasta) 3 de la oficina.
  const slots = state.spectating
    ? otros.map((p) => ({ id: p.id, name: p.name }))
    : [{ name: 'Vos', me: true }, ...otros.map((p) => ({ id: p.id, name: p.name }))];
  while (slots.length < 3) slots.push(null);
  slots.forEach((s, i) => {
    const el = strip.children[i];
    const v = el.querySelector('video');
    const nom = el.querySelector('.cam-name');
    const off = el.querySelector('.cam-off');
    const ct = el.querySelector('.cam-ctls');
    const bc = el.querySelector('.cc-cam');
    const bm = el.querySelector('.cc-mic');
    if (!s) {
      if (v.srcObject) v.srcObject = null;
      el.classList.add('off'); el.classList.remove('me');
      nom.textContent = ''; off.textContent = '·';
      if (ct) ct.hidden = true;
      return;
    }
    if (ct) ct.hidden = false;
    // El cuadro remoto se rige por el AVISO (rtc-cam), no por si hay stream:
    // el stream queda cacheado aunque apague, para revivir sin renegociar.
    const stream = s.me
      ? (rtcCamOn ? rtcCamStream : null)
      : ((rtcCamPeers.get(s.id) && !rtcCamOculto.has(s.id)) ? (rtcCamVivo.get(s.id) || null) : null);
    if (v.srcObject !== stream) {
      v.srcObject = stream;
      if (stream) {
        // Mismo criterio que la pantalla compartida: un solo play() que falla
        // deja la cámara clavada; se reintenta al primer cuadro y por gesto.
        const intentar = () => { if (v.isConnected && v.paused) v.play().catch(() => {}); };
        intentar();
        v.onloadedmetadata = intentar;
        const tr = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
        if (tr) tr.onunmute = intentar;
      }
    }
    el.classList.toggle('off', !stream);
    el.classList.toggle('me', !!s.me);
    nom.textContent = s.name;
    if (s.me) {
      // Mi cuadro: prendo/apago MI cámara y MI micro de la oficina.
      off.textContent = '📷 apagada';
      bc.textContent = '📷'; bc.classList.toggle('on', rtcCamOn);
      bc.title = rtcCamOn ? 'Apagar tu cámara' : 'Prender tu cámara';
      bc.onclick = (e) => { e.stopPropagation(); rtcCamToggle(); };
      bm.textContent = rtcOn ? '🎤' : '🔇'; bm.classList.toggle('on', rtcOn);
      bm.title = rtcOn ? 'Cerrar tu micro' : 'Abrir tu micro';
      bm.onclick = (e) => { e.stopPropagation(); rtcToggle(); };
    } else {
      // Cuadro de un compañero: apagar acá es SOLO local (dejar de verlo u
      // oírlo yo); su cámara y micro reales no se tocan.
      const id = s.id;
      const oculta = rtcCamOculto.has(id);
      off.textContent = oculta ? '📷 oculta por vos' : '📷 apagada';
      bc.textContent = '📷'; bc.classList.toggle('on', !oculta && !!rtcCamPeers.get(id));
      bc.title = oculta ? 'Volver a ver su cámara' : 'Dejar de ver su cámara (solo para vos)';
      bc.onclick = (e) => {
        e.stopPropagation();
        if (rtcCamOculto.has(id)) rtcCamOculto.delete(id); else rtcCamOculto.add(id);
        renderCamStrip();
      };
      const muteado = rtcMuteLocal.has(id);
      const suMic = !!rtcMic.get(id);
      bm.textContent = muteado ? '🔇' : '🎤';
      bm.classList.toggle('on', suMic && !muteado);
      bm.title = muteado ? 'Volver a escucharlo' : (suMic ? 'Silenciarlo (solo para vos)' : 'No tiene el micro abierto');
      bm.onclick = (e) => {
        e.stopPropagation();
        if (rtcMuteLocal.has(id)) rtcMuteLocal.delete(id); else rtcMuteLocal.add(id);
        const viv = rtcVivo.get(id);
        if (viv) { try { viv.audio.muted = rtcMuteLocal.has(id); } catch { /* ya no está */ } }
        renderCamStrip();
      };
    }
  });
  layoutDesktopAudio(); // recalcular alturas ahora que los cuadros existen
}

// El que tiene el id más chico alfabéticamente inicia. Así nunca se cruzan dos
// ofertas del mismo par a la vez, que es lo que rompe las conexiones (glare).
// Sin id propio no se inicia nunca: comparar '' contra cualquier cosa da true y
// los dos lados se creerian iniciadores.
function rtcIniciyo(peer) {
  const yo = String(state.myId || ''), el = String(peer || '');
  if (!yo || !el) return false;
  return yo < el;
}

function rtcPar(peer) {
  let p = rtcMesh.get(peer);
  if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: RTC_STUN });
  p = { pc, polite: !rtcIniciyo(peer), pendingIce: [], flujo: null, nuevo: true };
  // El track local se agrega SIEMPRE, aun muto, para que prender y apagar el
  // micro sea solo track.enabled y no una renegociación (que es lo que suele
  // fallar y cortar la llamada).
  if (rtcTrack) {
    try { p.pc.addTrack(rtcTrack, rtcStream); } catch { /* sin track */ }
  }
  // El de pantalla se agrega acá si ya se estaba compartiendo, para que la
  // conexión nazca completa y no haya que renegociar en el acto. El sender se
  // guarda: el re-share revive con replaceTrack sobre este mismo canal.
  if (rtcPantallaTrack) {
    try { p.shareSender = p.pc.addTrack(rtcPantallaTrack, rtcPantalla); } catch { /* sin track */ }
  }
  // Ídem la cámara: si ya estaba prendida, la conexión nace con el track puesto.
  if (rtcCamTrack) {
    try { p.camSender = p.pc.addTrack(rtcCamTrack, rtcCamStream); } catch { /* sin track */ }
  }
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ type: 'rtc-ice', to: peer, cand: e.candidate.toJSON(), from: state.myId, spec: 1 });
  };
  // El audio va al <audio> suelto; el video a la ventana que ya usa YouTube.
  pc.ontrack = (e) => {
    if (e.track.kind === 'video') rtcVideoEntrante(peer, e.streams[0] || new MediaStream([e.track]));
    else rtcConectarAudio(peer, e.streams[0] || new MediaStream([e.track]));
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') { rtcAviso = false; renderCallUI(); }
    if (pc.connectionState === 'failed' && !rtcAviso) {
      // Sin TURN esto pasa en redes simétricas o con firewalls corporativos. Es
      // el motivo por el que existe el mensaje: mejor un aviso claro que un
      // botón mudo sin explicación.
      rtcAviso = true;
      toast('⚠️ No se pudo conectar con alguien. Puede ser una red restrictiva (sin TURN no hay más).');
      renderCallUI();
    }
  };
  rtcMesh.set(peer, p);
  return p;
}

// Garantiza que la conexión tenga canales para RECIBIR aunque yo no emita
// nada: 1 de audio (micro) y 2 de video (cámara y pantalla). Sin esto, la
// oferta de alguien con todo apagado salía vacía y la pantalla del compañero
// no tenía por dónde viajar. Cuenta lo que ya hay (los addTrack también crean
// canales), así es idempotente y sirve igual para jugadores y espectadores.
function rtcAsegurarCanales(p) {
  try {
    let aud = 0, vid = 0;
    for (const t of p.pc.getTransceivers()) {
      const k = t.receiver && t.receiver.track ? t.receiver.track.kind : '';
      if (k === 'audio') aud++; else if (k === 'video') vid++;
    }
    while (aud < 1) { p.pc.addTransceiver('audio', { direction: 'recvonly' }); aud++; }
    while (vid < 2) { p.pc.addTransceiver('video', { direction: 'recvonly' }); vid++; }
  } catch { /* navegador viejo */ }
}

async function rtcOfrecer(peer) {
  const p = rtcPar(peer);
  try {
    rtcAsegurarCanales(p);
    const of = await p.pc.createOffer();
    await p.pc.setLocalDescription(of);
    p.nuevo = false;
    send({ type: 'rtc-offer', to: peer, sdp: p.pc.localDescription, from: state.myId, spec: 1 });
  } catch { /* se reconecta solo con el siguiente hello */ }
}

// Contestar una oferta que viene DIRIGIDA a mí (espectadores): acá el par se
// clava por el id del REMITENTE, que es único, así no pisa ninguna conexión
// entre jugadores.
async function rtcContestarDe(peer, sdp) {
  const p = rtcPar(peer);
  try {
    // Choque de ofertas (los dos ofertaron a la vez): el descortés ignora la
    // ajena y espera respuesta a la suya; el cortés da de baja la propia y
    // contesta. Sin esto las dos ofertas morían en silencio y no había video.
    if (p.pc.signalingState !== 'stable') {
      if (!p.polite) return;
      await p.pc.setLocalDescription({ type: 'rollback' });
    }
    await p.pc.setRemoteDescription(sdp);
    for (const c of p.pendingIce.splice(0)) { try { await p.pc.addIceCandidate(c); } catch { /* viejo */ } }
    const an = await p.pc.createAnswer();
    await p.pc.setLocalDescription(an);
    p.nuevo = false;
    send({ type: 'rtc-answer', to: peer, sdp: p.pc.localDescription, from: state.myId, spec: 1 });
  } catch { /* renegociar */ }
}

async function rtcContestar(peer, sdp) {
  const p = rtcPar(peer);
  try {
    // Mismo manejo de choque de ofertas que en rtcContestarDe: cortés cede,
    // descortés insiste. p.polite ya viene con lados opuestos desde rtcPar.
    if (p.pc.signalingState !== 'stable') {
      if (!p.polite) return;
      await p.pc.setLocalDescription({ type: 'rollback' });
    }
    await p.pc.setRemoteDescription(sdp);
    for (const c of p.pendingIce.splice(0)) { try { await p.pc.addIceCandidate(c); } catch { /* viejo */ } }
    const an = await p.pc.createAnswer();
    await p.pc.setLocalDescription(an);
    p.nuevo = false;
    send({ type: 'rtc-answer', to: peer, sdp: p.pc.localDescription, from: state.myId });
  } catch { /* renegociar */ }
}

async function rtcIce(peer, cand) {
  const p = rtcPar(peer);
  // Antes de tener remoteDescription no se puede agregar un candidato: se encola.
  if (!p.pc.remoteDescription) { p.pendingIce.push(cand); return; }
  try { await p.pc.addIceCandidate(cand); } catch { /* duplicado */ }
}

async function rtcIceRespuesta(msg) {
  const p = rtcMesh.get(msg.from);
  if (!p) return;
  // Solo si este pc está de verdad esperando una respuesta. Una respuesta
  // rezagada (de una oferta ya reemplazada) que se aplicara tarde podía
  // "completar" la negociación equivocada y dejar el video desactivado.
  if (p.pc.signalingState !== 'have-local-offer') return;
  try {
    await p.pc.setRemoteDescription(msg.sdp);
    for (const c of p.pendingIce.splice(0)) { try { await p.pc.addIceCandidate(c); } catch { /* viejo */ } }
  } catch { /* renegociar */ }
}

// Desde v67 TODA la señalización viaja "dirigida" (marca spec): solo la
// procesa el destinatario y la conexión se clava por el id del remitente,
// que es único. En el bus broadcast el camino viejo (sin marca, clave en
// msg.to) era ambiguo: la respuesta de una renegociación podía caer en la
// conexión equivocada y dejarla colgada (pantalla que no volvía al
// re-compartir). El camino viejo se conserva solo por compatibilidad con
// clientes sin refrescar.
function rtcEsSpec(msg) {
  return !!msg.spec || String(msg.to || '').startsWith('0tv') || String(msg.from || '').startsWith('0tv');
}

const rtcVistos = new Set();
function rtcVisto(msg) {
  // Deduplica SOLO lo que lleva oferta, respuesta o candidato. El hello es un
  // aviso de estado: chico e idempotente, y dedupearlo por par+tipo se tragaba el
  // segundo aviso, o sea abrir y volver a cerrar el micro.
  if (msg.type !== 'rtc-offer' && msg.type !== 'rtc-answer' && msg.type !== 'rtc-ice') return false;
  const sdp = msg.sdp ? (msg.sdp.sdp || '').slice(-60) : '';
  const k = msg.type + '|' + (msg.from || '') + '|' + (msg.to || '') + '|' + sdp + '|' + (msg.cand ? msg.cand.candidate : '');
  if (rtcVistos.has(k)) return true;
  rtcVistos.add(k);
  // Tope para que no crezca sin límite en una sesión larga.
  if (rtcVistos.size > 400) { const it = rtcVistos.values(); for (let i = 0; i < 200; i++) rtcVistos.delete(it.next().value); }
  return false;
}

// El boton de "tocá para escucharlos" se deriva del estado real de los <audio>, y
// no de una bandera. Con la bandera pasaba esto: si el navegador rechazaba el play y
// al rato se iba el unico companero, el boton se quedaba visible para siempre y ya
// no habia ningun audio que recuperar, asi que el click no hacia nada. Con esto solo
// aparece si hay de verdad algun <audio> en pausa.
function rtcRefrescarBloqueo() {
  let hayPausado = false;
  for (const v of rtcVivo.values()) { if (v.audio.paused) { hayPausado = true; break; } }
  if (hayPausado === rtcBloqueado) return;
  rtcBloqueado = hayPausado;
  renderCallUI();
}
function rtcReintentar(audio, peer) {
  audio.muted = peer !== undefined ? rtcMuteLocal.has(peer) : false;
  audio.volume = rtcVolumen();
  return audio.play().then(() => true).catch(() => false);
}
// Antes habia un boton 🔇 "tocá para escucharlos" cuando el navegador bloqueaba
// el autoplay. Ya no hace falta: cualquier click o tecla del usuario es un gesto
// válido, así que se reintenta solo y el audio se destraba sin que nadie lo note.
function rtcDesbloquearPorGesto() {
  // Videos pausados (pantalla compartida o cámaras): cualquier gesto es una
  // oportunidad de destrabarlos. En el TV el navegador es más estricto con el
  // autoplay y esto es lo que revive el video sin que el usuario haga nada raro.
  document.querySelectorAll('video').forEach((v) => {
    if (v.paused && v.srcObject) v.play().catch(() => { /* habrá otro gesto */ });
  });
  if (!rtcBloqueado || !rtcVivo.size) return;
  try {
    const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* medir el nivel es opcional */ }
  Promise.allSettled([...rtcVivo.entries()].map(([peer, v]) => rtcReintentar(v.audio, peer))).then(() => rtcRefrescarBloqueo());
}
window.addEventListener('pointerdown', rtcDesbloquearPorGesto, true);
window.addEventListener('keydown', rtcDesbloquearPorGesto, true);

function rtcConectarAudio(peer, stream) {
  let v = rtcVivo.get(peer);
  if (v) {
    v.audio.srcObject = stream;
    // El companero puede renegociar el stream. Si el <audio> quedo en pausa por el
    // bloqueo del navegador, hay que volver a pedir el play: si no, este audio se
    // queda mudo para siempre.
    if (v.audio.paused) rtcReintentar(v.audio, peer).then(() => rtcRefrescarBloqueo());
    v.audio.muted = rtcMuteLocal.has(peer);
  }
  else {
    const a = document.createElement('audio');
    a.autoplay = true; a.playsInline = true;
    a.muted = rtcMuteLocal.has(peer);
    a.srcObject = stream;
    // Chrome bloquea el audio si la pagina no tuvo gesto. Como estos <audio>
    // aparecen despues de entrar, a veces hay que pedir un click.
    a.play().then(() => rtcRefrescarBloqueo()).catch(() => rtcRefrescarBloqueo());
    document.body.appendChild(a);
    v = { audio: a, analyser: null, data: null, buf: null };
    rtcVivo.set(peer, v);
  }
  try {
    const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    if (!v.analyser) {
      const src = ctx.createMediaStreamSource(stream);
      v.analyser = ctx.createAnalyser();
      v.analyser.fftSize = 512;
      v.data = new Uint8Array(v.analyser.frequencyBinCount);
      v.buf = new Uint8Array(v.analyser.fftSize);
      src.connect(v.analyser);   // no se conecta al destino: acá no se oye, solo se mide
      v.src = src;
    }
  } catch { /* medir es opcional */ }
  if (v.audio.volume !== undefined) v.audio.volume = rtcVolumen();
}

function rtcVolumen() {
  const el = document.getElementById('callVol');
  return el ? Math.min(1.5, (+el.value || 100) / 100) : 1;
}
function rtcCallVolumen() {
  for (const v of rtcVivo.values()) { try { v.audio.volume = rtcVolumen(); } catch { /* ya no está */ } }
}

function rtcConectarConTodos() {
  // Solo garantiza que exista una conexión por compañero. Las OFERTAS salen
  // de UN solo lugar (rtcRenegociar): antes de acá salía una oferta sin el
  // track nuevo y enseguida otra con él, y la respuesta de la primera podía
  // completar la negociación de la segunda dejando el canal de video
  // desactivado (el clásico "la segunda vez no anda").
  for (const p of state.players.values()) {
    if (!p.id || p.id === state.myId) continue;
    if (rtcConectaCon(p.id)) rtcPar(p.id);
  }
}

// Cuando entra alguien nuevo a la oficina le repito mi estado de llamada. Los
// avisos de micro/cámara/pantalla son solo de prendido/apagado, así que sin
// esto el recién llegado no veía la pantalla que ya se estaba compartiendo ni
// las cámaras que ya estaban andando. El pequeño delay deja que el nuevo
// termine de procesar su 'welcome'; los avisos son idempotentes y solo el
// lado iniciador oferta, así que no hay choque.
function rtcSaludarNuevo(player) {
  if (!player || !player.id || player.id === state.myId) return;
  if (!rtcOn && !rtcCamOn && !rtcComparto) return;
  setTimeout(() => {
    if (rtcOn) send({ type: 'rtc-hello', mic: true, from: state.myId });
    if (rtcCamOn && rtcCamStream) send({ type: 'rtc-cam', on: true, from: state.myId, sid: rtcCamStream.id });
    if (rtcComparto && rtcPantalla) send({ type: 'rtc-share', on: true, from: state.myId, sid: rtcPantalla.id });
    rtcConectarConTodos();
    rtcRenegociar();
  }, 400);
}

async function rtcAbrir() {
  if (rtcOn || rtcStream) return;
  try {
    rtcStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    toast('🎤 No se pudo abrir el micro. Revisá el permiso del navegador.');
    return;
  }
  rtcTrack = rtcStream.getAudioTracks()[0];
  rtcOn = true;
  send({ type: 'rtc-hello', mic: true, from: state.myId });
  rtcConectarConTodos();
  // Si ya había conexiones vivas (por cámara o pantalla), el track nuevo se
  // suma renegociando: sin esto, reabrir el micro con las cámaras prendidas
  // dejaba a los compañeros sin escucharte.
  await rtcRenegociar();
  renderCallUI();
  if (!rtcAvisoHecho) {
    rtcAvisoHecho = true;
    toast('🎤 Micro abierto. Usá auriculares si podés: con parlantes se acopla.');
  }
}
let rtcAvisoHecho = false;
function rtcCerrar() {
  // Cerrar el micro cierra SOLO el micro: la cámara y la pantalla compartida
  // siguen andando sobre las mismas conexiones. Antes esto tiraba abajo toda
  // la malla y se caían las cámaras de todos.
  const track = rtcTrack;
  if (track) { try { track.stop(); } catch { /* ya estaba */ } }
  rtcStream = null; rtcTrack = null; rtcOn = false;
  send({ type: 'rtc-hello', mic: false, from: state.myId });
  // Sacar mi track de audio de las conexiones que quedan vivas.
  for (const p of rtcMesh.values()) {
    try {
      if (track) p.pc.getSenders().forEach((s) => { if (s.track === track) p.pc.removeTrack(s); });
    } catch { /* ya cerrado */ }
  }
  // Cortar únicamente los pares con los que ya no hay nada de por medio
  // (ni cámara ni pantalla, mía o suya).
  for (const [peer, p] of [...rtcMesh]) {
    if (rtcConectaCon(peer)) continue;
    send({ type: 'rtc-bye', to: peer, from: state.myId });
    try { p.pc.close(); } catch { /* ya cerrado */ }
    rtcMesh.delete(peer);
    const v = rtcVivo.get(peer);
    if (v) { try { v.audio.remove(); } catch { /* ya no está */ } rtcVivo.delete(peer); }
    rtcNivel.delete(peer);
  }
  rtcRefrescarBloqueo();
  renderCallUI();
  rtcRenegociar();
}
function rtcToggle() { if (rtcOn) rtcCerrar(); else rtcAbrir(); }

function rtcSalirDePeer(peer) {
  const p = rtcMesh.get(peer);
  if (p) { try { p.pc.close(); } catch { /* ya cerrado */ } rtcMesh.delete(peer); }
  const v = rtcVivo.get(peer);
  if (v) { try { v.audio.remove(); } catch { /* ya no está */ } rtcVivo.delete(peer); }
  rtcRefrescarBloqueo();
  const partia = rtcComparte.delete(peer);
  rtcShareSid.delete(peer);
  rtcMic.delete(peer); rtcNivel.delete(peer);
  rtcCamPeers.delete(peer); rtcCamSid.delete(peer); rtcCamVivo.delete(peer); rtcVideoPend.delete(peer); rtcShareVivo.delete(peer);
  renderCamStrip();
  // Si se va el que compartía, se cae la ventana: si no queda clavada mostrando la
  // última imagen de su pantalla.
  if (partia && !rtcComparto) rtcOcultarPantalla();
  renderCallUI();
}

// Nivel de voz: se mide pero NO se manda al destino (en source solo), así que no
// genera acoplamiento. Solo dispara un re-render de la lista cuando cambia el
// booleano de "está hablando", para no repintar 20 veces por segundo.
let rtcHablandoPrev = '';
setInterval(() => {
  if (!rtcVivo.size) return;
  let key = '';
  for (const [peer, v] of rtcVivo) {
    let lvl = 0;
    if (v.analyser) {
      v.analyser.getByteTimeDomainData(v.buf);
      let suma = 0;
      for (let i = 0; i < v.buf.length; i++) { const d = (v.buf[i] - 128) / 128; suma += d * d; }
      lvl = Math.min(1, Math.sqrt(suma / v.buf.length) * 6);
    }
    rtcNivel.set(peer, lvl);
    if (lvl > 0.06) key += peer;
  }
  if (key !== rtcHablandoPrev) { rtcHablandoPrev = key; renderPlayerList(); }
}, 140);

function renderCallUI() {
  const b = document.getElementById('micCallBtn');
  if (b) {
    b.classList.toggle('on', rtcOn);
    b.style.opacity = rtcOn ? '1' : '0.65';
    b.title = rtcOn ? 'Micro abierto: queda así hasta que lo cierres' : 'Abrir el micro de la oficina (tecla M)';
  }
  const cb = document.getElementById('camBtn');
  if (cb) {
    cb.classList.toggle('on', rtcCamOn);
    cb.style.opacity = rtcCamOn ? '1' : '0.65';
    cb.title = rtcCamOn ? 'Cámara prendida: tocá para apagarla' : 'Prender tu cámara: se ve en los cuadrados de la derecha';
  }
  const sh = document.getElementById('shareBtn');
  if (sh) {
    sh.classList.toggle('on', rtcComparto);
    // Si hay otro compartiendo, el botón se deshabilita: solo uno a la vez.
    const ocupado = rtcComparte.size > 0;
    sh.disabled = ocupado;
    sh.style.opacity = rtcComparto ? '1' : (ocupado ? '0.35' : '0.65');
    sh.title = ocupado ? 'Ya hay alguien compartiendo pantalla'
      : (rtcComparto ? 'Dejar de compartir (tecla S)' : 'Compartir tu pantalla con los de la oficina (tecla S)');
  }
  const vb = document.getElementById('callVolBox');
  if (vb) vb.classList.toggle('hidden', !rtcOn && !rtcVivo.size);
  const pl = document.getElementById('playerList');
  if (pl) pl.classList.toggle('mic-off', !rtcOn && !rtcVivo.size);
  renderCamStrip(); // que los botoncitos de cada cuadro reflejen mic/cámara al toque
}

function loadCharAssets() {
  const keys = Object.keys(CHAR_DEF);
  return Promise.all(keys.map((k) => new Promise((res) => {
    const loadSeat = () => {
      const sit = new Image();
      sit.onload = () => {
        if (!charAssets[k]) charAssets[k] = {};
        charAssets[k].sit = sit;
        delete sitFlipCache[`sit_${k}_left`];
        delete sitFlipCache[`sit_${k}_right`];
        for (const cacheKey of Object.keys(sitCache)) {
          if (cacheKey.startsWith(`vD_k${k}_`)) delete sitCache[cacheKey];
        }
        res();
      };
      sit.onerror = () => res(); // el sentado anterior queda como fallback
      sit.src = `sprites/${k}_sit.png?v=1.24.0`;
    };
    // Los de pie son recortes de "Oficina Virtual/De pie.jpg": el diseño aprobado
    // (chibi, cuerpo entero, sneakers a la vista). Antes se cargaba primero un
    // *_fino.png, que era otra variante: mucho más detalle, pero otra cara (cabeza
    // desproporcionada, ojos grandes, piercings) y con los pies cortados por el
    // borde del lienzo. Ese camino ya no se usa.
    const im = new Image();
    im.onload = () => {
      const r = flipCanvas(im);
      charAssets[k] = { down: im, left: r, right: r, up: oscurecer(im) };
      loadSeat();
    };
    im.onerror = () => { loadSeat(); }; // los sprites por código siguen disponibles
    im.src = `sprites/${k}.png?v=1.32.0`;
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
  if (assetsReady && charAssets[charKey] && charAssets[charKey].down) return charAssets[charKey][dir] || charAssets[charKey].down;
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

// ---------- Personajes sentados: curvas y degradados ----------
// El chibi de grilla (getSprite) queda como fallback si algún PNG no carga. El
// sentado NO usa grilla: se dibuja con curvas y degradados para que tenga el
// mismo acabado que los PNG de referencia, que son digital painting y no pixel
// art. Por eso tampoco lleva un contorno de línea: acá el borde oscuro es el
// lado en sombra de la forma.

// Rectángulo de esquinas redondeadas, vía path.
function rr(g, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.lineTo(x + w - k, y);
  g.quadraticCurveTo(x + w, y, x + w, y + k);
  g.lineTo(x + w, y + h - k);
  g.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  g.lineTo(x + k, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - k);
  g.lineTo(x, y + k);
  g.quadraticCurveTo(x, y, x + k, y);
  g.closePath();
}

function ell(g, cx, cy, rx, ry, rot) {
  g.beginPath();
  g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, Math.PI * 2);
}

// Degradado radial para superficies redondeadas. La luz entra por arriba-izquierda,
// igual que en la foto. Son 5 paradas y no 3 a propósito: con menos, cada superficie
// se lee como una mancha de dos tonos y el conjunto vuelve a parecer plano.
function gRad(g, cx, cy, r, col, opt) {
  const o = opt || {};
  const lz = o.luz == null ? 0.3 : o.luz;
  const sb = o.sombra == null ? 0.3 : o.sombra;
  const gr = g.createRadialGradient(cx - r * lz, cy - r * lz * 1.15, r * 0.05, cx, cy, r * 1.08);
  gr.addColorStop(0, tone(col, 0.3));
  gr.addColorStop(0.22, tone(col, 0.13));
  gr.addColorStop(0.52, col);
  gr.addColorStop(0.78, tone(col, -0.13));
  gr.addColorStop(1, tone(col, -sb));
  return gr;
}

// Degradado lineal para superficies planas (torso, brazos, jean).
function gLin(g, x0, y0, x1, y1, col, opt) {
  const o = opt || {};
  const f = o.fuerza == null ? 1 : o.fuerza;
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, tone(col, 0.22 * f));
  gr.addColorStop(0.3, tone(col, 0.08 * f));
  gr.addColorStop(0.55, col);
  gr.addColorStop(1, tone(col, -0.28 * f));
  return gr;
}

// El "contorno": no es una línea negra como en el chibi. En la referencia el borde
// oscuro es el lado en sombra del propio material, así que el stroke lleva el tono
// del material con alpha en vez de negro puro.
function borde(g, col, w) {
  g.lineWidth = w || 2;
  g.strokeStyle = tone(col, -0.5);
  g.globalAlpha = 0.5;
  g.stroke();
  g.globalAlpha = 1;
}

const SIT_W = 300, SIT_H = 352;

// ---------- Escenario: silla y monitor (van aparte, sin contorno) ----------
function sitEscenario(g) {
  rr(g, 42, 172, 40, 108, 16);
  g.fillStyle = gLin(g, 42, 172, 82, 280, '#2f353d', { fuerza: 0.9 });
  g.fill();
  rr(g, 48, 262, 150, 34, 12);
  g.fillStyle = gLin(g, 48, 262, 198, 296, '#3d444d');
  g.fill();
  rr(g, 116, 296, 26, 26, 6);
  g.fillStyle = gLin(g, 116, 296, 142, 322, '#2b3038');
  g.fill();
  g.fillStyle = '#14171b';
  g.beginPath(); g.ellipse(129, 330, 82, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(129, 330, 15, 10, 0, 0, Math.PI * 2); g.fill();

  rr(g, 198, 42, 76, 92, 8);
  g.fillStyle = gLin(g, 198, 42, 274, 134, '#22262e');
  g.fill();
  rr(g, 207, 51, 58, 74, 4);
  g.fillStyle = '#16241a'; g.fill();
  g.fillStyle = '#4caf6d';
  g.fillRect(213, 59, 30, 4); g.fillRect(213, 69, 44, 4); g.fillRect(213, 79, 24, 4);
  g.fillStyle = '#8ff0a2'; g.fillRect(213, 59, 16, 4);
  g.globalAlpha = 0.18; g.fillStyle = '#9fc0ff';
  g.fillRect(207, 51, 58, 20); g.globalAlpha = 1;   // reflejo en el cristal
  rr(g, 226, 134, 22, 140, 6);
  g.fillStyle = gLin(g, 226, 134, 248, 274, '#2f353d');
  g.fill();
  rr(g, 202, 268, 70, 16, 6);
  g.fillStyle = gLin(g, 202, 268, 272, 284, '#333a44');
  g.fill();
  rr(g, 204, 288, 76, 22, 5);
  g.fillStyle = gLin(g, 204, 288, 280, 310, '#4a525c');
  g.fill();
  g.fillStyle = '#6a7480';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) g.fillRect(210 + i * 24, 293 + j * 5, 18, 3);
}

// ---------- El personaje ----------
// Perfil 3/4 mirando a la derecha, sentado frente al monitor. La cabeza ronda el
// 40% del alto del cuerpo, que es lo que le da el aire chibi de la referencia.
function sitC(g, c, frame) {
  const bob = frame ? 2 : 0;              // micro cabeceo al tipear
  const hx = 150, hy = 92 + bob;          // centro de la cabeza
  const hrx = 50, hry = 54;

  // ---------- muslos: se van hacia atrás (izquierda) ----------
  g.beginPath();
  g.moveTo(196, 246 + bob);
  g.quadraticCurveTo(190, 292 + bob, 150, 298 + bob);
  g.lineTo(96, 300 + bob);
  g.quadraticCurveTo(72, 296 + bob, 74, 274 + bob);
  g.quadraticCurveTo(80, 250 + bob, 110, 246 + bob);
  g.closePath();
  g.fillStyle = gLin(g, 74, 246 + bob, 196, 300 + bob, c.pants);
  g.fill(); borde(g, c.pants, 2);
  g.strokeStyle = tone(c.pants, -0.35); g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(112, 262 + bob); g.quadraticCurveTo(104, 280 + bob, 112, 294 + bob); g.stroke();

  // ---------- brazo lejano (se asoma por detrás del torso) ----------
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(104, 190 + bob);
  g.quadraticCurveTo(120, 240 + bob, 168, 268 + bob);
  g.lineWidth = 24; g.strokeStyle = tone(c.shirt, -0.3); g.stroke();
  g.lineWidth = 21; g.strokeStyle = tone(c.shirt, -0.12); g.stroke();
  ell(g, 176, 272 + bob, 12, 10);
  g.fillStyle = gRad(g, 176, 272 + bob, 13, c.skin, { sombra: 0.28 }); g.fill();

  // ---------- torso ----------
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(120, 158 + bob);
    g.quadraticCurveTo(150, 148 + bob, 180, 158 + bob);
    g.quadraticCurveTo(202, 168 + bob, 200, 196 + bob);
    g.lineTo(194, 252 + bob);
    g.quadraticCurveTo(190, 264 + bob, 176, 266 + bob);
    g.lineTo(126, 266 + bob);
    g.quadraticCurveTo(112, 264 + bob, 108, 252 + bob);
    g.lineTo(102, 196 + bob);
    g.quadraticCurveTo(100, 168 + bob, 120, 158 + bob);
    g.closePath();
  };
  torsoPath();
  g.fillStyle = gLin(g, 102, 150 + bob, 200, 266 + bob, c.shirt);
  g.fill(); borde(g, c.shirt, 2);

  if (c.jacket) {
    rr(g, 130, 156 + bob, 42, 112, 8);
    g.fillStyle = gLin(g, 130, 156 + bob, 172, 268 + bob, '#7e8894');
    g.fill();
    g.strokeStyle = '#5a6470'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(168, 160 + bob); g.lineTo(168, 264 + bob); g.stroke();
    g.strokeStyle = '#a8b2be'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(136, 164 + bob); g.quadraticCurveTo(133, 210 + bob, 137, 256 + bob); g.stroke();
    g.strokeStyle = '#e8ecf2'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(145, 162 + bob); g.quadraticCurveTo(143, 190 + bob, 146, 208 + bob); g.stroke();
    g.beginPath(); g.moveTo(160, 162 + bob); g.quadraticCurveTo(163, 188 + bob, 159, 206 + bob); g.stroke();
    g.beginPath();
    g.moveTo(120, 158 + bob); g.quadraticCurveTo(126, 160 + bob, 130, 166 + bob);
    g.lineTo(132, 266 + bob); g.quadraticCurveTo(122, 266 + bob, 116, 264 + bob); g.closePath();
    g.fillStyle = gLin(g, 116, 158 + bob, 132, 266 + bob, '#e8a820'); g.fill();
    g.beginPath();
    g.moveTo(180, 158 + bob); g.quadraticCurveTo(174, 160 + bob, 170, 166 + bob);
    g.lineTo(168, 266 + bob); g.quadraticCurveTo(178, 266 + bob, 184, 264 + bob); g.closePath();
    g.fillStyle = gLin(g, 168, 158 + bob, 184, 266 + bob, '#c88a10'); g.fill();
  } else {
    g.strokeStyle = tone(c.shirt, 0.22); g.lineWidth = 3;
    g.beginPath(); g.moveTo(122, 196 + bob); g.quadraticCurveTo(130, 214 + bob, 124, 232 + bob); g.stroke();
    g.beginPath(); g.moveTo(180, 204 + bob); g.quadraticCurveTo(174, 222 + bob, 180, 240 + bob); g.stroke();
    g.strokeStyle = tone(c.shirt, -0.32);
    g.beginPath(); g.moveTo(136, 252 + bob); g.quadraticCurveTo(152, 256 + bob, 168, 252 + bob); g.stroke();
  }

  // oclusión de contacto: el brazo y la cintura proyectan sombra sobre el torso.
  // Sin esto las piezas quedan pegadas como calcomanías, que es lo que más delata
  // un dibujo plano frente a uno pintado.
  g.save();
  torsoPath(); g.clip();
  g.globalAlpha = 0.3; g.fillStyle = '#000000';
  ell(g, 190, 190 + bob, 30, 34); g.fill();
  g.globalAlpha = 0.22;
  ell(g, 128, 262 + bob, 34, 18); g.fill();
  g.globalAlpha = 1;
  g.restore();

  // ---------- cuello ----------
  rr(g, 134, 138 + bob, 34, 30, 8);
  g.fillStyle = gRad(g, 151, 152 + bob, 22, c.skinD, { sombra: 0.3 }); g.fill();

  // ---------- cabeza ----------
  ell(g, hx, hy, hrx, hry);
  g.fillStyle = gRad(g, hx, hy, hrx * 1.15, c.skin, { luz: 0.32, sombra: 0.32 });
  g.fill(); borde(g, c.skin, 2);
  // oreja del lado lejano: chiquita y al borde, no una ampolla en la mejilla
  ell(g, hx - hrx * 0.92, hy + hry * 0.2, 6, 9);
  g.fillStyle = tone(c.skin, -0.1); g.fill();
  g.strokeStyle = tone(c.skin, -0.42); g.lineWidth = 1.4; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
  // la mandíbula proyecta sombra sobre el cuello
  g.save();
  ell(g, hx, hy, hrx, hry); g.clip();
  g.globalAlpha = 0.28; g.fillStyle = '#000000';
  ell(g, hx, hy + hry * 1.12, hrx * 0.92, hry * 0.4); g.fill();
  g.globalAlpha = 1;
  g.restore();

  // ---------- pelo / gorra ----------
  const pelo = c.hair;
  const brilloPelo = () => {
    g.save(); g.clip();
    g.globalAlpha = 0.28; g.fillStyle = tone(pelo, 0.5);
    ell(g, hx - hrx * 0.32, hy - hry * 0.78, hrx * 0.5, hry * 0.18, -0.2); g.fill();
    g.globalAlpha = 1; g.restore();
  };
  if (c.hairStyle === 'spiky') {
    g.beginPath();
    g.moveTo(hx - hrx * 1.04, hy + hry * 0.12);
    g.quadraticCurveTo(hx - hrx * 1.08, hy - hry * 0.98, hx - hrx * 0.2, hy - hry * 1.04);
    g.quadraticCurveTo(hx + hrx * 0.55, hy - hry * 1.08, hx + hrx * 1.02, hy - hry * 0.38);
    g.quadraticCurveTo(hx + hrx * 0.94, hy + hry * 0.06, hx + hrx * 0.66, hy - hry * 0.2);
    g.quadraticCurveTo(hx + hrx * 0.1, hy - hry * 0.44, hx - hrx * 0.46, hy - hry * 0.18);
    g.quadraticCurveTo(hx - hrx * 0.82, hy - hry * 0.02, hx - hrx * 1.04, hy + hry * 0.12);
    g.closePath();
    g.fillStyle = gRad(g, hx, hy - hry * 0.72, hrx * 1.05, pelo, { luz: 0.34, sombra: 0.36 }); g.fill();
    g.strokeStyle = tone(pelo, -0.45); g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    brilloPelo();
    // mechones cortos, pegados al casquete. Altos y separados parecen cuernos.
    g.fillStyle = pelo;
    for (const [dx, dy, r] of [[-0.66, -0.92, 5], [-0.24, -1.0, 6], [0.2, -1.0, 5.5], [0.62, -0.86, 4.5]]) {
      g.beginPath();
      g.moveTo(hx + hrx * dx, hy + hry * dy + r);
      g.quadraticCurveTo(hx + hrx * dx - r * 0.7, hy + hry * dy - r * 0.5, hx + hrx * dx + r * 0.4, hy + hry * dy - r * 0.8);
      g.quadraticCurveTo(hx + hrx * dx + r, hy + hry * dy - r * 0.2, hx + hrx * dx + r, hy + hry * dy + r);
      g.closePath(); g.fill();
    }
  } else if (c.hairStyle === 'full') {
    g.beginPath();
    g.moveTo(hx - hrx * 1.08, hy + hry * 0.42);
    g.quadraticCurveTo(hx - hrx * 1.16, hy - hry * 1.08, hx, hy - hry * 1.1);
    g.quadraticCurveTo(hx + hrx * 1.16, hy - hry * 1.08, hx + hrx * 1.08, hy + hry * 0.38);
    g.quadraticCurveTo(hx + hrx * 0.92, hy - hry * 0.04, hx + hrx * 0.6, hy - hry * 0.24);
    g.quadraticCurveTo(hx, hy - hry * 0.52, hx - hrx * 0.58, hy - hry * 0.24);
    g.quadraticCurveTo(hx - hrx * 0.9, hy - hry * 0.04, hx - hrx * 1.08, hy + hry * 0.42);
    g.closePath();
    g.fillStyle = gRad(g, hx, hy - hry * 0.72, hrx * 1.05, pelo, { luz: 0.34, sombra: 0.36 }); g.fill();
    g.strokeStyle = tone(pelo, -0.45); g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    brilloPelo();
  } else {
    g.beginPath();
    g.moveTo(hx - hrx * 1.05, hy - hry * 0.02);
    g.quadraticCurveTo(hx - hrx * 1.1, hy - hry * 1.12, hx, hy - hry * 1.14);
    g.quadraticCurveTo(hx + hrx * 1.1, hy - hry * 1.12, hx + hrx * 1.05, hy - hry * 0.02);
    g.closePath();
    g.fillStyle = gRad(g, hx, hy - hry * 0.7, hrx, '#4d5763', { luz: 0.34, sombra: 0.32 }); g.fill();
    g.strokeStyle = tone('#4d5763', -0.45); g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    g.beginPath();
    g.moveTo(hx - hrx * 1.02, hy - hry * 0.1);
    g.quadraticCurveTo(hx - hrx * 1.5, hy - hry * 0.2, hx - hrx * 1.36, hy - hry * 0.45);
    g.quadraticCurveTo(hx - hrx * 1.15, hy - hry * 0.3, hx - hrx * 1.02, hy - hry * 0.42);
    g.closePath();
    g.fillStyle = gLin(g, hx - hrx * 1.5, hy - hry * 0.45, hx - hrx * 1.0, hy, '#3f4750');
    g.fill();
    g.fillStyle = pelo;
    g.beginPath(); g.moveTo(hx - hrx * 0.78, hy - hry * 0.2);
    g.quadraticCurveTo(hx - hrx * 0.84, hy + hry * 0.3, hx - hrx * 0.66, hy + hry * 0.4);
    g.quadraticCurveTo(hx - hrx * 0.6, hy + hry * 0.1, hx - hrx * 0.62, hy - hry * 0.2);
    g.closePath(); g.fill();
  }

  // ---------- cejas: gruesas y curvas. Finas se leen de caricatura ----------
  const ceja = (x0, y0, x1, y1, amp) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - amp, x1, y1);
    g.strokeStyle = tone(c.hair, 0.05); g.lineWidth = 6; g.lineCap = 'round';
    g.stroke();
  };
  ceja(hx - 30, hy - 8, hx - 12, hy - 10, 3);
  ceja(hx + 6, hy - 11, hx + 28, hy - 8, 4);

  // ---------- ojos: chiquitos a propósito, como en la referencia ----------
  const ojo = (ex, ey, rw, rh) => {
    ell(g, ex, ey, rw, rh);
    g.fillStyle = '#e8e2d8'; g.fill();
    g.strokeStyle = tone(c.skin, -0.45); g.lineWidth = 1.4; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    ell(g, ex + rw * 0.12, ey + rh * 0.06, rw * 0.66, rh * 0.8);
    g.fillStyle = '#4a6480'; g.fill();
    ell(g, ex + rw * 0.12, ey + rh * 0.06, rw * 0.34, rh * 0.52);
    g.fillStyle = '#151017'; g.fill();
    ell(g, ex - rw * 0.24, ey - rh * 0.36, rw * 0.2, rh * 0.22);
    g.fillStyle = '#ffffff'; g.fill();
  };
  ojo(hx - 19, hy + 7, 7, 5.5);
  ojo(hx + 16, hy + 4, 9, 7);

  // ---------- nariz: un botón en el borde derecho ----------
  g.beginPath();
  g.moveTo(hx + hrx * 0.8, hy + hry * 0.22);
  g.quadraticCurveTo(hx + hrx * 0.95, hy + hry * 0.32, hx + hrx * 0.78, hy + hry * 0.4);
  g.closePath();
  g.fillStyle = tone(c.skin, -0.04); g.fill();
  g.strokeStyle = tone(c.skin, -0.45); g.lineWidth = 1.4; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;

  // ---------- barba ----------
  if (c.beardStyle === 'full') {
    g.beginPath();
    g.moveTo(hx - hrx * 0.95, hy - hry * 0.05);
    g.quadraticCurveTo(hx - hrx * 0.9, hy + hry * 0.95, hx + hrx * 0.15, hy + hry * 1.04);
    g.quadraticCurveTo(hx + hrx * 0.98, hy + hry * 0.92, hx + hrx * 1.0, hy - hry * 0.05);
    g.quadraticCurveTo(hx + hrx * 0.4, hy + hry * 0.36, hx - hrx * 0.4, hy + hry * 0.3);
    g.closePath();
    g.fillStyle = gRad(g, hx, hy + hry * 0.5, hrx, c.beard, { luz: 0.3, sombra: 0.34 });
    g.fill();
    g.strokeStyle = tone(c.beard, -0.4); g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = '#17121a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx - 6, hy + hry * 0.56); g.lineTo(hx + 12, hy + hry * 0.56); g.stroke();
  } else {
    g.beginPath();
    g.moveTo(hx - 16, hy + hry * 0.46);
    g.quadraticCurveTo(hx, hy + hry * 0.36, hx + 16, hy + hry * 0.46);
    g.quadraticCurveTo(hx, hy + hry * 0.6, hx - 16, hy + hry * 0.46);
    g.closePath();
    g.fillStyle = tone(c.beard, 0.1); g.fill();
    g.beginPath();
    g.moveTo(hx - 20, hy + hry * 0.64);
    g.quadraticCurveTo(hx - 18, hy + hry * 1.02, hx + 4, hy + hry * 1.06);
    g.quadraticCurveTo(hx + 26, hy + hry * 1.0, hx + 22, hy + hry * 0.62);
    g.quadraticCurveTo(hx, hy + hry * 0.78, hx - 20, hy + hry * 0.64);
    g.closePath();
    g.fillStyle = gRad(g, hx, hy + hry * 0.85, 24, c.beard, { luz: 0.28, sombra: 0.32 });
    g.fill();
    g.strokeStyle = tone(c.beard, -0.4); g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = '#7a4a40'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx - 4, hy + hry * 0.62); g.lineTo(hx + 10, hy + hry * 0.62); g.stroke();
  }

  // ---------- brazo cercano: del hombro al teclado, con codo ----------
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(182, 178 + bob);
  g.quadraticCurveTo(212, 210 + bob, 222, 250 + bob);
  g.lineWidth = 30; g.strokeStyle = tone(c.shirt, -0.34); g.stroke();
  g.lineWidth = 26; g.strokeStyle = c.shirt; g.stroke();
  g.lineWidth = 8; g.strokeStyle = tone(c.shirt, 0.18); g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(174, 172 + bob); g.quadraticCurveTo(204, 204 + bob, 214, 244 + bob); g.stroke();
  g.globalAlpha = 1;
  g.beginPath();
  g.moveTo(222, 250 + bob);
  g.quadraticCurveTo(230, 272 + bob, 238, 286 + bob);
  g.lineWidth = 24; g.strokeStyle = tone(c.skin, -0.3); g.stroke();
  g.lineWidth = 21; g.strokeStyle = c.skin; g.stroke();
  ell(g, 244, 292 + bob, 17, 12, -0.2);
  g.fillStyle = gRad(g, 244, 292 + bob, 18, c.skin, { sombra: 0.3 }); g.fill();
  g.strokeStyle = tone(c.skin, -0.4); g.lineWidth = 2; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
  g.strokeStyle = tone(c.skin, -0.34); g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(238 + i * 6, 296 + bob);
    g.lineTo(241 + i * 6, 302 + bob);
    g.stroke();
  }
}

const sitCache = {};
const sitFlipCache = {};
function getSitSprite(charKey, face, occupied, frame = 0) {
  const seated = charAssets[charKey] && charAssets[charKey].sit;
  if (occupied && seated) {
    // El PNG incluye la silla gamer completa, tal como la referencia del equipo;
    // por eso no se le superpone el escenario genérico silla/monitor anterior.
    const baseFace = SIT_BASE_FACE[charKey] || 'right';
    if (face === baseFace) return seated;
    const flipKey = `sit_${charKey}_${face}`;
    if (!sitFlipCache[flipKey]) sitFlipCache[flipKey] = flipCanvas(seated);
    return sitFlipCache[flipKey];
  }

  // Fallback seguro: el personaje procedimental y su estación anterior se usan
  // solo si falta el PNG sentado de ese DNI.
  const key = `vD_k${charKey}_${face}_${occupied ? 1 : 0}_${frame}`;
  if (sitCache[key]) return sitCache[key];
  const out = document.createElement('canvas');
  out.width = SIT_W; out.height = SIT_H;
  const o = out.getContext('2d');
  const bg = document.createElement('canvas');
  bg.width = SIT_W; bg.height = SIT_H;
  const bgCtx = bg.getContext('2d');
  if (face === 'left') { bgCtx.translate(SIT_W, 0); bgCtx.scale(-1, 1); }
  sitEscenario(bgCtx);
  o.drawImage(bg, 0, 0);
  if (occupied) {
    const fig = document.createElement('canvas');
    fig.width = SIT_W; fig.height = SIT_H;
    const g = fig.getContext('2d');
    if (face === 'right') sitC(g, charOf(charKey), frame);
    else { g.translate(SIT_W, 0); g.scale(-1, 1); sitC(g, charOf(charKey), frame); }
    o.drawImage(fig, 0, 0);
  }
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
const state = { myId: null, myName: '', myColor: 0, players: new Map(), joined: false, spectating: false };
const spectatorWhisperBacklog = [];
const SPECTATOR_PIN_SALT = 'somospopups-observer-v1:';
const SPECTATOR_PIN_HASH = 'f18455ea0b372784dc5b59b1085cdeeefbbc6c7cbfc580e675a63af1a0e11a86';
let spectatorFailures = 0, spectatorLockUntil = 0, spectatorCheckBusy = false;
const keys = {};
let lastSend = 0, lastSeatState = null, audioCtx = null;

const bgImg = new Image();
let bgReady = false;
const bgCv = document.createElement('canvas');
const wideBackdropCv = document.createElement('canvas');
let backdropDirty = true;
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
  backdropDirty = true;
};
bgImg.src = 'bg_deep2.png';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const joinOverlay = document.getElementById('join');
const dniInput = document.getElementById('dniInput');
const colorsBox = document.getElementById('colors');
const joinBtn = document.getElementById('joinBtn');
const officePreviewImg = new Image();
let officePreviewReady = false;
officePreviewImg.onload = () => {
  officePreviewReady = true;
  const preview = document.getElementById('avatarPreview');
  if (preview && !preview.getAttribute('data-char')) previewChar(null);
};
officePreviewImg.src = 'sprites/office-icon.png?v=1.29.3';
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const playerListBox = document.getElementById('playerList');
const statusBar = document.getElementById('statusBar');
const hintBox = document.getElementById('hint');
const toastBox = document.getElementById('toast');
const helpOverlay = document.getElementById('help');
const clockBox = document.getElementById('clock');
const attachmentModal = document.getElementById('attachmentModal');
const attachmentModalTitle = document.getElementById('attachmentModalTitle');
const attachmentPreviewBox = document.getElementById('attachmentPreview');
const attachmentDownload = document.getElementById('attachmentDownload');
let activeAttachmentUrl = null;
// Numero de version: sube de 1 en 1, sin puntos (v38, v39, v40...). El contador
// viejo era el minor de v1.38.x, asi que v1.38.2 equivale a v38. Solo cambia game.js.
const VERSION = 'v70 · 27/09/2026';
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
// El espectador sigue siendo de solo lectura para la OFICINA: no chatea, no se
// mueve, no toca la radio ni los emotes. Pero SÍ participa de la llamada, porque
// para recibir audio (y para ver la pantalla que comparte otro) tiene que mandar
// la respuesta del offer y sus candidatos ICE, que es WebRTC bidireccional por
// naturaleza. Por eso la lista blanca.
//
// 'rtc-share' NO entra a propósito: es el aviso de "estoy compartiendo pantalla", y
// un espectador solo lo recibe, nunca lo manda. Si lo dejara pasar, un espectador
// podría anunciarse como compartidor.
const RTC_TIPOS = new Set(['rtc-hello', 'rtc-offer', 'rtc-answer', 'rtc-ice', 'rtc-bye']);
function send(o) {
  if (state.spectating && !RTC_TIPOS.has(o.type)) return;
  if (sendFn) { try { sendFn(o); } catch { /* offline */ } }
}
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

function layoutDesktopAudio() {
  const button = document.getElementById('musicBtn');
  const panel = document.getElementById('musicPanel');
  const call = document.getElementById('callBar');
  if (!button || !panel) return;
  const strip = document.getElementById('camStrip');
  const vol = document.getElementById('callVolBox');
  const chatP = document.getElementById('chatPanel');
  if (!document.body.classList.contains('desktop-rails')) {
    button.style.top = ''; button.style.right = ''; button.style.left = '';
    panel.style.top = ''; panel.style.right = ''; panel.style.left = '';
    if (call) { call.style.top = ''; call.style.right = ''; call.style.bottom = ''; }
    if (vol) { vol.style.top = ''; vol.style.right = ''; }
    if (chatP) { chatP.style.top = ''; chatP.style.bottom = ''; chatP.style.height = ''; }
    if (strip) {
      strip.style.top = ''; strip.style.right = ''; strip.style.bottom = ''; strip.style.overflowY = '';
      for (const el of strip.children) { el.style.height = ''; el.style.flex = ''; }
    }
    return;
  }
  const list = document.getElementById('playerList');
  const top = Math.ceil((list ? list.getBoundingClientRect().bottom : 100) + 10);
  button.style.top = top + 'px'; button.style.right = '12px'; button.style.left = 'auto';
  const buttonH = button.getBoundingClientRect().height || 36;
  // La barra de llamada va en la misma fila, a la izquierda de la radio 🎵
  if (call) {
    const buttonW = Math.ceil(button.getBoundingClientRect().width || 38);
    call.style.top = top + 'px'; call.style.bottom = 'auto';
    call.style.right = (12 + buttonW + 6) + 'px';
  }
  // El chat del riel izquierdo arranca pegado al reloj (sin espacio muerto) y
  // llega hasta abajo.
  if (chatP) {
    const tb = document.getElementById('topbar');
    const tbBot = tb ? tb.getBoundingClientRect().bottom : 50;
    chatP.style.top = Math.ceil(tbBot + 10) + 'px';
    chatP.style.bottom = '12px';
    chatP.style.height = 'auto';
  }
  // Debajo de la fila de botones se apilan, en orden y solo si están visibles:
  // volumen -> panel de la radio -> tira de cámaras. Todo dentro del riel,
  // nada invade la oficina.
  let cursorY = top + buttonH + 8;
  if (vol) {
    vol.style.top = cursorY + 'px'; vol.style.right = '12px';
    if (!vol.classList.contains('hidden')) cursorY += (vol.getBoundingClientRect().height || 34) + 8;
  }
  panel.style.top = cursorY + 'px'; panel.style.right = '12px'; panel.style.left = 'auto';
  if (!panel.classList.contains('hidden')) cursorY += (panel.getBoundingClientRect().height || 0) + 8;
  // La tira de cámaras arranca donde termina lo anterior. Las alturas van por
  // estilo inline: exactamente un tercio del alto libre para cada tarjeta, y
  // si no entran (ventana muy baja) la tira scrollea.
  if (strip) {
    strip.style.top = cursorY + 'px'; strip.style.right = '12px';
    strip.style.bottom = '12px'; strip.style.overflowY = 'auto';
    const avail = window.innerHeight - cursorY - 12;
    const gap = 10;
    const slotH = Math.max(110, Math.floor((avail - gap * 2) / 3));
    for (const el of strip.children) { el.style.height = slotH + 'px'; el.style.flex = '0 0 auto'; }
  }
}

function connect() {
  if (!USE_P2P) { connectWS(); return; }
  connectP2P().catch((e) => {
    busErr = String((e && e.message) || e || 'falló el inicio P2P');
    toast('⚠️ Falló el inicio de la oficina compartida; reintentando…');
    setTimeout(connect, 8000);
  });
}

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
  try {
    // toast() no puede interrumpir la conexión si el DOM todavía está cargando.
    toast('🌐 Conectando oficina P2P...');
    // En los reintentos se conserva la misma identidad; solo se abre de nuevo la red.
    if (!busKey) { busKey = await makeBusKeys(); myPub = busKey.pub; }
    busErr = '';
  } catch (e) {
    busErr = String((e && e.message) || e || 'no se pudo crear la firma');
    toast('⚠️ No se pudo iniciar P2P; reintentando...');
    setTimeout(connect, 8000);
    return;
  }
  sendFn = busSend;
  for (const host of BUS_RELAYS) openRelay(host);
  setTimeout(() => {
    if (busSockets.length) toast(`✅ P2P conectado (${busSockets.length} relays)`);
    else { toast('⚠️ Sin relays a la vista, reintentando...'); setTimeout(connect, 8000); }
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
      if (msg.id) {
        const isNewPlayer = !state.players.has(msg.id);
        upsertRemote(msg, false);
        if (state.spectating && isNewPlayer) renderPlayerList();
      }
      break;
    case 'welcome':
      state.myId = state.spectating ? state.myId : msg.id;
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
    case 'joined': upsertRemote(msg.player, true); renderPlayerList(); maybeMusicForNewcomer(); rtcSaludarNuevo(msg.player); break;
    case 'music': if (!dedupe(msg)) applyMusic(msg); break;

    // ---------- Llamada de la oficina ----------
    // El bus manda cada mensaje a los 6 relays, así que las ofertas llegan
    // repetidas. Por eso hay un dedupe propio por par y tipo: una oferta
    // renegociada a mitad de camino es lo que más rompe una conexión.
    case 'rtc-hello': {
      // Si el que saluda es un espectador (id '0tv...'), los que tienen algo
      // prendido se lo re-anuncian para que pueda conectarse aunque haya
      // entrado tarde. Idempotente para el resto.
      if (String(msg.from || '').startsWith('0tv')) {
        if (rtcCamOn && rtcCamStream) send({ type: 'rtc-cam', on: true, from: state.myId, sid: rtcCamStream.id });
        if (rtcComparto) send({ type: 'rtc-share', on: true, from: state.myId, sid: rtcPantalla ? rtcPantalla.id : undefined });
        if (rtcOn) send({ type: 'rtc-hello', mic: true, from: state.myId });
        break;
      }
      rtcMic.set(msg.from, !!msg.mic);
      if (msg.mic) {
        if ((rtcOn || state.spectating) && rtcIniciyo(msg.from) && !rtcMesh.has(msg.from)) rtcOfrecer(msg.from);
        else rtcPar(msg.from);
      } else if (!rtcConectaCon(msg.from)) {
        // Cerró el micro y no queda cámara ni pantalla de por medio: se corta.
        rtcSalirDePeer(msg.from);
      } else {
        // Cerró el micro pero su cámara (o pantalla) sigue: solo se limpia el audio.
        const v = rtcVivo.get(msg.from);
        if (v) { try { v.audio.remove(); } catch { /* ya no está */ } rtcVivo.delete(msg.from); }
        rtcNivel.delete(msg.from);
        rtcRefrescarBloqueo();
      }
      renderPlayerList(); renderCallUI();
      break;
    }
    case 'rtc-offer':
      if (rtcVisto(msg)) break;
      // Las ofertas "spec" (de/para espectadores) van dirigidas: solo las
      // procesa el destinatario y el par se clava por el id del remitente.
      // Cualquier mensaje que toque un id 0tv se trata como spec aunque
      // falte la marca: si no, una respuesta ajena pisa la malla real.
      if (rtcEsSpec(msg)) { if (msg.to === state.myId) rtcContestarDe(msg.from, msg.sdp); }
      else rtcContestar(msg.to, msg.sdp);
      break;
    case 'rtc-answer':
      if (rtcVisto(msg)) break;
      if (rtcEsSpec(msg) && msg.to !== state.myId) break;
      rtcIceRespuesta(msg);
      break;
    case 'rtc-ice':
      if (rtcVisto(msg)) break;
      if (rtcEsSpec(msg)) { if (msg.to === state.myId) rtcIce(msg.from, msg.cand); }
      else rtcIce(msg.to, msg.cand);
      break;
    case 'rtc-bye': if (!rtcVisto(msg)) rtcSalirDePeer(msg.from); break;
    case 'rtc-share': {
      if (msg.on) {
        rtcComparte.set(msg.from, true);
        if (msg.sid) rtcShareSid.set(msg.from, msg.sid);
        if (rtcConectaCon(msg.from) && rtcIniciyo(msg.from) && !rtcMesh.has(msg.from)) rtcOfrecer(msg.from);
        else rtcPar(msg.from);
        // Re-share sin renegociación: el video llega por el canal ya vivo y
        // NO hay ontrack nuevo. Se revive la ventana con el stream cacheado.
        if (rtcShareVivo.has(msg.from)) rtcVerPantalla(msg.from, rtcShareVivo.get(msg.from));
        rtcResolverVideos(msg.from);
        renderCallUI();
      } else {
        rtcComparte.delete(msg.from);
        rtcShareSid.delete(msg.from);
        // Solo comparte uno a la vez: el "off" limpia TODO sin condiciones.
        // Antes se ocultaba solo si el mapa quedaba vacío, y una entrada
        // vieja con otra clave dejaba la pantalla clavada para siempre.
        rtcOcultarPantalla();
      }
      break;
    }
    case 'rtc-cam': {
      if (msg.on) {
        rtcCamPeers.set(msg.from, true);
        if (msg.sid) rtcCamSid.set(msg.from, msg.sid);
        if (rtcConectaCon(msg.from) && rtcIniciyo(msg.from) && !rtcMesh.has(msg.from)) rtcOfrecer(msg.from);
        else rtcPar(msg.from);
        rtcResolverVideos(msg.from);
      } else {
        rtcCamPeers.delete(msg.from);
        // OJO: el stream NO se borra. Si vuelve a prender con replaceTrack no
        // llega ningún ontrack nuevo, y este mismo stream es el que revive.
      }
      renderCamStrip();
      break;
    }
    case 'left':
      state.players.delete(msg.id);
      // Se cuelga la conexión con ese par: si no, el <audio> sigue vivo ocupando
      // banda y el mic sigue marcado como conectado en la lista.
      rtcSalirDePeer(msg.id);
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
      if (isW && !mine && msg.to !== state.myName && !state.spectating) {
        if (!state.joined && spectatorWhisperBacklog.length < 120) spectatorWhisperBacklog.push(msg);
        break;
      }
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
  else if (cls === 'whisper') {
    const privateTo = state.spectating ? ' a ' + esc(to || 'equipo') : (from === state.myName ? ' a ' + esc(to) : '');
    div.innerHTML = `<b>${esc(from === state.myName ? 'vos' : from)}</b> ${esc(text)} <i>(privado${privateTo})</i>`;
  }
  else div.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
  if (att && att.data) {
    const owner = from || 'equipo';
    if (att.kind === 'img') {
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'chat-att-open';
      open.title = 'Abrir vista previa y descargar';
      const img = document.createElement('img');
      img.className = 'chat-att';
      img.src = `data:${att.mime || 'image/jpeg'};base64,${att.data}`;
      img.alt = 'Imagen adjunta de ' + owner;
      const label = document.createElement('span');
      label.className = 'chat-att-label'; label.textContent = '🔎 Previsualizar / descargar';
      open.append(img, label);
      open.onclick = () => openAttachmentPreview(att, owner);
      div.appendChild(open);
    } else if (att.kind === 'audio') {
      const au = document.createElement('audio');
      au.controls = true; au.className = 'chat-att-a';
      au.src = `data:${att.mime || 'audio/webm'};base64,${att.data}`;
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'chat-audio-open';
      open.textContent = '🔎 Abrir / descargar audio';
      open.onclick = () => openAttachmentPreview(att, owner);
      div.append(au, open);
    }
  }
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}
function attachmentMime(att) {
  return String(att.mime || (att.kind === 'img' ? 'image/jpeg' : 'audio/webm')).split(';')[0].trim().toLowerCase();
}
function attachmentExtension(mime) {
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav' })[mime] || '.bin';
}
// Zoom del visor de imágenes: ruedita del mouse, pellizco (pinch) en táctil,
// arrastre para pasear cuando está ampliada y doble click para acercar/alejar.
// Todo se cuelga del <img> (que nace nuevo en cada apertura), así no se
// acumulan listeners sobre la caja del modal.
function attachImageZoom(img) {
  let s = 1, tx = 0, ty = 0;
  const ptrs = new Map();
  let pinchD = 0, pinchS = 1, dragX = 0, dragY = 0;
  img.style.transformOrigin = 'center center';
  img.style.touchAction = 'none';
  img.style.cursor = 'zoom-in';
  const apply = () => {
    img.style.transform = s === 1 && !tx && !ty ? '' : `translate(${tx}px, ${ty}px) scale(${s})`;
    img.style.cursor = s > 1 ? 'grab' : 'zoom-in';
  };
  // Acerca hacia un punto de la pantalla manteniéndolo quieto bajo el cursor
  const zoomAt = (clientX, clientY, ns) => {
    ns = Math.min(8, Math.max(1, ns));
    const r = img.getBoundingClientRect();
    const cx0 = r.left + r.width / 2 - tx, cy0 = r.top + r.height / 2 - ty; // centro sin trasladar
    const Cx = clientX - cx0, Cy = clientY - cy0;
    const f = ns / s;
    tx = Cx - f * (Cx - tx); ty = Cy - f * (Cy - ty);
    s = ns;
    if (s === 1) { tx = 0; ty = 0; }
    apply();
  };
  img.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });
  img.addEventListener('dblclick', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, s > 1 ? 1 : 2.5); });
  img.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { img.setPointerCapture(e.pointerId); } catch { /* siga */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y) || 1; pinchS = s;
    } else if (ptrs.size === 1) { dragX = e.clientX; dragY = e.clientY; if (s > 1) img.style.cursor = 'grabbing'; }
  });
  img.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinchS * (d / pinchD));
    } else if (ptrs.size === 1 && s > 1) {
      tx += e.clientX - dragX; ty += e.clientY - dragY;
      dragX = e.clientX; dragY = e.clientY;
      apply();
    }
  });
  const soltar = (e) => { ptrs.delete(e.pointerId); if (s > 1) img.style.cursor = 'grab'; };
  img.addEventListener('pointerup', soltar);
  img.addEventListener('pointercancel', soltar);
}
function openAttachmentPreview(att, owner) {
  if (!attachmentModal || !attachmentPreviewBox || !attachmentDownload || !att || !att.data) return;
  try {
    const oldAudio = attachmentPreviewBox.querySelector('audio');
    if (oldAudio) oldAudio.pause();
    attachmentPreviewBox.innerHTML = '';
    if (activeAttachmentUrl) URL.revokeObjectURL(activeAttachmentUrl);
    const binary = atob(att.data), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const mime = attachmentMime(att);
    activeAttachmentUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    if (att.kind === 'img') {
      const img = document.createElement('img');
      img.src = activeAttachmentUrl; img.alt = 'Imagen enviada por ' + (owner || 'el equipo');
      img.draggable = false;
      attachImageZoom(img);
      attachmentPreviewBox.appendChild(img);
    } else if (att.kind === 'audio') {
      const audio = document.createElement('audio');
      audio.controls = true; audio.preload = 'metadata'; audio.src = activeAttachmentUrl;
      attachmentPreviewBox.appendChild(audio);
    } else return;
    if (attachmentModalTitle) attachmentModalTitle.textContent = (att.kind === 'img' ? 'Vista previa de imagen' : 'Vista previa de audio') + ' · ' + (owner || 'equipo');
    attachmentDownload.href = activeAttachmentUrl;
    attachmentDownload.download = 'oficina-' + (att.kind === 'img' ? 'imagen' : 'audio') + '-' + Date.now() + attachmentExtension(mime);
    attachmentModal.classList.remove('hidden');
  } catch (e) {
    toast('⚠️ No se pudo abrir el adjunto');
  }
}
function closeAttachmentPreview() {
  if (attachmentModal) attachmentModal.classList.add('hidden');
  if (attachmentPreviewBox) {
    const audio = attachmentPreviewBox.querySelector('audio');
    if (audio) audio.pause();
    attachmentPreviewBox.innerHTML = '';
  }
  if (activeAttachmentUrl) {
    const oldUrl = activeAttachmentUrl; activeAttachmentUrl = null;
    setTimeout(() => URL.revokeObjectURL(oldUrl), 30000);
  }
}

function sendChat(raw, att) {
  if (state.spectating) { toast('👁 Modo espectador: solo lectura'); return; }
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
// ---------- Radio y "mirar juntos" ----------
// El reproductor es UNO solo: el mismo iframe se mueve entre la caja escondida
// #ytBox (modo audio, 2x2 px, como estaba) y el panel #videoBox (modo video,
// visible). Nunca hay dos players: con dos, al pegar un link nuevo sonarían los
// dos a la vez.
//
// YouTube: postMessage del widget, el que ya usaba la radio.
// Vimeo:   su SDK oficial, que se carga la primera vez que alguien pega un link de
//          Vimeo. Cargarlo al arranque sumaría una petición externa siempre.
// Drive:   se puede VER pero no tiene ninguna API de control: no hay forma de
//          pausar, avanzar ni sincronizar, y Google ya no acepta los parámetros
//          autoplay/t. Por eso el aviso que se lee en el panel.
let ytFrame = null, ytCurKey = null, ytCurMode = null, ytPos = 0, ytLoadPromise = null;
let vmPlayer = null, vmLoading = null, wantVideo = false;
const music = { item: null, mode: 'audio', playing: false, amDJ: false, from: '', djPos: 0, djAt: 0 };

// Reconoce los tres proveedores. Devuelve { kind, id, live } o null.
function parseLink(url) {
  const u = (url || '').trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'yt', id: m[1], live: /youtube\.com\/(?:live\/|v\/)/.test(u) };
  m = u.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{6,})/);
  if (m) return { kind: 'vimeo', id: m[1], live: false };
  m = u.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/);
  if (m) return { kind: 'drive', id: m[1], live: false };
  return null;
}
function itemKey(it) { return it ? it.kind + ':' + it.id : ''; }
function kindLabel(k) { return k === 'yt' ? 'YouTube' : k === 'vimeo' ? 'Vimeo' : 'Drive'; }
function playerBox() {
  return music.mode === 'video'
    ? document.getElementById('videoBox')
    : document.getElementById('ytBox');
}
function dropFrame() {
  if (ytFrame) ytFrame.remove();
  ytFrame = null; ytCurKey = null; ytCurMode = null; vmPlayer = null;
}
function ytCmd(fn, args) {
  try { if (ytFrame) ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: fn, args: args || [] }), 'https://www.youtube.com'); } catch { /* iframe ocupado */ }
}
function embedUrl(it, start) {
  if (it.kind === 'yt') return `https://www.youtube.com/embed/${it.id}?enablejsapi=1&controls=1&playsinline=1&disablekb=1&rel=0&autoplay=1${it.live ? '' : '&start=' + Math.floor(start || 0)}`;
  if (it.kind === 'vimeo') return `https://player.vimeo.com/video/${it.id}?autoplay=1&dnt=1&title=0&byline=0&portrait=0${it.live ? '' : '&t=' + Math.floor(start || 0) + 's'}`;
  return `https://drive.google.com/file/d/${it.id}/preview`;
}
function playerEnsure(it, start) {
  const key = itemKey(it);
  if (ytFrame && ytCurKey === key) return Promise.resolve(ytFrame);
  if (ytLoadPromise) return ytLoadPromise;
  ytLoadPromise = new Promise((res) => {
    dropFrame();
    const f = document.createElement('iframe');
    f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    f.src = embedUrl(it, start);
    const done = () => {
      ytFrame = f; ytCurKey = key; ytCurMode = music.mode; ytLoadPromise = null;
      if (it.kind === 'yt') {
        const listen = () => ytPost(f, { event: 'listening', id: 'ofv', channel: 'widget' });
        listen(); setTimeout(listen, 700); setTimeout(listen, 1800); setTimeout(listen, 3500);
        try { ytPost(f, { event: 'command', func: 'setVolume', args: [60] }); } catch {}
      } else if (it.kind === 'vimeo') {
        ensureVimeo().then((V) => { if (V && V.Player && !vmPlayer) vmPlayer = new V.Player(f); });
      }
      res(f);
    };
    f.onload = done;
    f.onerror = () => { ytLoadPromise = null; res(null); };
    playerBox().appendChild(f);
    setTimeout(() => { if (!ytFrame) done(); }, 7000);
  });
  return ytLoadPromise;
}
// Un solo nombre para todo: el resto del código no pregunta qué proveedor es.
function playerCmd(fn, args) {
  if (!ytFrame || !ytCurKey) return;
  const kind = ytCurKey.split(':')[0];
  if (kind === 'yt') { ytCmd(fn, args); return; }
  if (kind !== 'vimeo') return;   // Drive no tiene API
  ensureVimeo().then((V) => {
    if (!V || !vmPlayer) return;
    try {
      if (fn === 'playVideo') vmPlayer.play().catch(() => {});
      else if (fn === 'pauseVideo') vmPlayer.pause().catch(() => {});
      else if (fn === 'stopVideo') { vmPlayer.pause().catch(() => {}); vmPlayer.setCurrentTime(0).catch(() => {}); }
      else if (fn === 'seekTo') vmPlayer.setCurrentTime(+args[0]).catch(() => {});
      else if (fn === 'setVolume') vmPlayer.setVolume(+args[0] / 100).catch(() => {});
    } catch { /* el player todavía no está listo */ }
  });
}
function ensureVimeo() {
  if (window.Vimeo && window.Vimeo.Player) {
    if (!vmPlayer && ytFrame) vmPlayer = new window.Vimeo.Player(ytFrame);
    return Promise.resolve(window.Vimeo);
  }
  if (!vmLoading) {
    vmLoading = new Promise((res) => {
      const s = document.createElement('script');
      s.src = 'https://player.vimeo.com/api/player.js';
      s.onload = () => res(window.Vimeo);
      s.onerror = () => res(null);
      document.head.appendChild(s);
    });
  }
  return vmLoading.then((V) => {
    if (V && V.Player && ytFrame && !vmPlayer) {
      vmPlayer = new V.Player(ytFrame);
      vmPlayer.on('timeupdate', (d) => { if (d && typeof d.seconds === 'number') ytPos = d.seconds; });
    }
    return V;
  });
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
// Dónde está el DJ ahora mismo: su última posición conocida más el tiempo que pasó
// desde que la mandó. Es lo mismo que ya hacía applyMusic, aislado para que el botón
// Sincronizar pueda consultarlo sin recibir un mensaje nuevo.
function djTarget() {
  return (music.djPos || 0) + (music.playing ? Math.max(0, (Date.now() - music.djAt) / 1000) : 0);
}
function sendMusic(act, pos) {
  const it = music.item;
  if (!it) return;
  music.amDJ = true; music.playing = act === 'play';
  music.djPos = pos || 0; music.djAt = Date.now();
  send({ type: 'music', act, kind: it.kind, id: it.id, live: !!it.live, mode: music.mode,
         pos: music.djPos, at: music.djAt, from: state.myName,
         nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) });
  updateMpNow();
}
function applyMusic(msg, silent) {
  // Tolerancia con un peer que tenga el juego viejo en una pestaña abierta: mandaba
  // `vid` en vez de kind/id/mode.
  const it = msg.kind ? { kind: msg.kind, id: msg.id, live: !!msg.live }
                      : (msg.vid ? { kind: 'yt', id: msg.vid, live: false } : null);
  if (!it) return;
  const mode = msg.mode === 'video' ? 'video' : 'audio';
  // El modo se compara contra el del FRAME, no contra music.mode: mpPlay ya dejó
  // music.mode en el valor nuevo antes de llegar acá, así que comparar con él
  // daba siempre igual y el iframe se quedaba escondido en la caja de audio.
  if (mode !== music.mode) music.mode = mode;
  if (mode !== ytCurMode) dropFrame();
  music.item = it; music.playing = msg.act === 'play';
  if (msg.from) music.from = msg.from;
  if (msg.act === 'play') { music.djPos = msg.pos || 0; music.djAt = msg.at || Date.now(); }
  showPanel(it);
  if (msg.act === 'stop') { playerCmd('stopVideo'); updateMpNow(); return; }
  if (msg.act === 'pause') { playerCmd('pauseVideo'); updateMpNow(); return; }
  const target = djTarget();
  (async () => {
    await playerEnsure(it, it.live ? 0 : target);
    if (!it.live) playerCmd('seekTo', [target, true]);
    playerCmd('playVideo');
  })();
  if (!silent && msg.act === 'play' && msg.from) {
    toast(music.mode === 'video' ? `🎬 ${msg.from} puso video para todos` : `🎵 ${msg.from} puso música para todos`);
  }
  updateMpNow();
}
function showPanel(it) {
  const p = document.getElementById('videoPanel');
  if (!p) return;
  if (music.mode !== 'video') { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  const who = document.getElementById('videoWho');
  if (who) who.textContent = `🎬 ${music.from || 'alguien'} · ${kindLabel(it.kind)}`;
  const note = document.getElementById('videoNote');
  if (note) {
    note.textContent = it.kind === 'drive'
      ? 'Google Drive no se puede sincronizar: solo se mira.'
      : (it.live
        ? 'Transmisión en vivo: no se puede volver atrás.'
        : 'Tus controles son locales. ⟲ para volver al DJ.');
  }
  // Vimeo en iOS no permite play() programático nunca, y Chrome bloquea el
  // autoplay con sonido hasta que el usuario hace un gesto. El aviso queda hasta
  // que toque. Drive ni tiene controles, así que no tiene sentido pedirlo.
  const tap = document.getElementById('videoTap');
  if (tap) tap.classList.toggle('hidden', it.kind === 'drive');
  aplicarFloat();
}
// Estado de la ventana: flotante y tamaño. Son COSAS LOCALES a propósito, no se
// difunden por la red. La oficina 2D no es una pantalla compartida: cada uno la ve
// en su monitor, así que cada uno la agranda como le sirva. En la TV del local
// sirve para ponerla grande, y en la PC del DJ queda en el rincón.
const VP_MIN_W = 240, VP_MIN_H = 190;
const VP_DEF_W = 660, VP_DEF_H = 430;
let videoFloat = false, videoBig = false, videoW = VP_DEF_W, videoH = VP_DEF_H;
function aplicarTamano() {
  const p = document.getElementById('videoPanel');
  if (!p) return;
  if (!videoFloat) { p.style.width = ''; p.style.height = ''; return; }
  const maxW = Math.max(VP_MIN_W, window.innerWidth - 16);
  const maxH = Math.max(VP_MIN_H, window.innerHeight - 16);
  videoW = Math.min(Math.max(VP_MIN_W, videoW), maxW);
  videoH = Math.min(Math.max(VP_MIN_H, videoH), maxH);
  p.style.width = videoW + 'px';
  p.style.height = videoH + 'px';
}
function aplicarFloat() {
  const p = document.getElementById('videoPanel');
  if (!p) return;
  p.classList.toggle('float', videoFloat);
  const bf = document.getElementById('videoFloat');
  if (bf) {
    bf.classList.toggle('on', videoFloat);
    bf.title = videoFloat ? 'Volver a la esquina' : 'Ventana flotante para que la vea toda la oficina';
  }
  aplicarTamano();
}
function setVideoFloat(v) {
  videoFloat = !!v;
  if (!videoFloat) videoBig = false;
  // Al volver a flotar se recentra: si quedó arrastrada a una esquina, el left/top
  // en linea lo dejarian corrida.
  const p = document.getElementById('videoPanel');
  if (p && v) { p.style.left = ''; p.style.top = ''; p.style.right = ''; p.style.transform = ''; }
  aplicarFloat();
  if (videoFloat) toast('🪟 Ventana flotante · arrastrala y estirala por los bordes');
}
// El botón grande es un preset, no un teto: después los tiradores mandan y cada
// uno queda con el tamaño que quiso.
function setVideoBig(big) {
  videoBig = !!big;
  if (big) {
    videoW = Math.min(1180, window.innerWidth - 40);
    videoH = Math.round(Math.min(videoW * 0.62, window.innerHeight - 120));
  } else { videoW = VP_DEF_W; videoH = VP_DEF_H; }
  aplicarTamano();
}
function videoSync() {
  const it = music.item;
  if (!it) return;
  if (it.kind === 'drive') { toast('Drive no se puede sincronizar: solo se mira'); return; }
  if (it.live) { playerCmd('playVideo'); toast('Es una transmisión en vivo'); return; }
  playerCmd('seekTo', [djTarget(), true]);
  playerCmd('playVideo');
  const tap = document.getElementById('videoTap');
  if (tap) tap.classList.add('hidden');
  toast('⟲ Sincronizado con el DJ');
}
function maybeMusicForNewcomer() {
  if (music.amDJ && music.playing && music.item) sendMusic('play', musicNowPos());
}
function updateMpNow() {
  const el = document.getElementById('mpNow');
  if (!el) return;
  const it = music.item;
  if (!it) el.textContent = 'Nada sonando';
  else if (music.playing) el.textContent = `Sonando para todos: ${kindLabel(it.kind)} · ${it.id}`;
  else el.textContent = `Pausado: ${kindLabel(it.kind)} · ${it.id}`;
}
function mpToggle() { const p = document.getElementById('musicPanel'); if (p) p.classList.toggle('hidden'); layoutDesktopAudio(); }
function setWantVideo(v) {
  wantVideo = !!v;
  const a = document.getElementById('mpAudio'), b = document.getElementById('mpView');
  if (a) a.classList.toggle('on', !wantVideo);
  if (b) b.classList.toggle('on', wantVideo);
}
function mpPlay() {
  const input = document.getElementById('musicUrl');
  const url = input ? input.value.trim() : '';
  let it = parseLink(url);
  if (it && itemKey(it) !== itemKey(music.item)) music.item = it;
  let pos = 0;
  if (!it) { it = music.item; pos = musicNowPos(); }
  if (!it) { toast('🎵 Pegá un link de YouTube, Vimeo o Google Drive'); return; }
  music.mode = wantVideo ? 'video' : 'audio';
  if (pos < 0.5) pos = 0;
  sendMusic('play', pos);
  applyMusic({ act: 'play', kind: it.kind, id: it.id, live: it.live, mode: music.mode,
              pos, at: music.djAt, from: state.myName }, true);
}
function mpPause() {
  if (!music.item) return;
  const pos = musicNowPos();
  sendMusic('pause', pos);
  applyMusic({ act: 'pause', kind: music.item.kind, id: music.item.id, mode: music.mode,
              pos, at: Date.now(), from: state.myName }, true);
}
function mpStop() {
  if (!music.item) return;
  sendMusic('stop', 0);
  applyMusic({ act: 'stop', kind: music.item.kind, id: music.item.id, mode: music.mode,
              pos: 0, at: Date.now(), from: state.myName }, true);
}
let toastTimer = null;
function toast(t) {
  const el = toastBox || document.getElementById('toast');
  if (!el) return; // no impedir que la red arranque si el HTML aún está parseándose
  el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Adjuntos: imágenes y audios de voz ----------
let pendingAtt = null, mediaRec = null, recChunks = [];
function takeAtt() { const a = pendingAtt; pendingAtt = null; updateAttChip(); return a; }
function clearAtt() { pendingAtt = null; updateAttChip(); }
function updateAttChip() {
  const chip = document.getElementById('attChip');
  if (!chip) return;
  if (typeof updateSendMic === 'function') updateSendMic();
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
let recSend = false, recT0 = 0, recLocked = false, recTimerInt = null;
// Botón derecho estilo WhatsApp: 🎤 cuando no hay nada que mandar, ➤ cuando hay
// texto o un adjunto pendiente.
function updateSendMic() {
  const sb = document.getElementById('sendBtn'), mb = document.getElementById('micBtn');
  if (!sb || !mb) return;
  if (mediaRec && mediaRec.state === 'recording') return; // durante la grabación manda recUI
  const hasContent = !!((chatInput && chatInput.value.trim()) || pendingAtt);
  sb.hidden = !hasContent;
  mb.hidden = hasContent;
}
function hideEmojiPicker() { const p = document.getElementById('emojiPicker'); if (p) p.hidden = true; }
function fmtRecTime(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
// Muestra/oculta la barra de grabación (reemplaza el input, como en WhatsApp).
function recUI(on) {
  const row = document.getElementById('chatRow'), bar = document.getElementById('recBar');
  const trash = document.getElementById('recTrash'), hint = document.getElementById('recHint');
  const mb = document.getElementById('micBtn');
  if (!row || !bar) return;
  row.classList.toggle('recording', on);
  bar.hidden = !on;
  if (on) {
    hideEmojiPicker();
    const t = document.getElementById('recTime');
    if (t) t.textContent = '0:00';
    if (recTimerInt) clearInterval(recTimerInt);
    recTimerInt = setInterval(() => { const tt = document.getElementById('recTime'); if (tt) tt.textContent = fmtRecTime(Date.now() - recT0); }, 200);
    if (trash) trash.hidden = true;
    if (hint) hint.textContent = '‹ cancelar · ↑ fijar';
    if (mb) mb.hidden = false;
  } else {
    if (recTimerInt) { clearInterval(recTimerInt); recTimerInt = null; }
    recLocked = false;
    if (mb) { mb.textContent = '🎤'; mb.classList.remove('rec'); }
    updateSendMic();
  }
}
// Deslizar hacia arriba fija la grabación (manos libres): el 🎤 pasa a ser ➤ y
// aparece el 🗑 para descartar, igual que el candadito de WhatsApp.
function recLock() {
  if (recLocked || !mediaRec || mediaRec.state !== 'recording') return;
  recLocked = true;
  const trash = document.getElementById('recTrash'), hint = document.getElementById('recHint');
  const mb = document.getElementById('micBtn');
  if (trash) trash.hidden = false;
  if (hint) hint.textContent = 'grabando…';
  if (mb) mb.textContent = '➤';
}
function cancelRec() { if (mediaRec && mediaRec.state === 'recording') { recSend = false; mediaRec.stop(); } }
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
      recUI(false);
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
    recT0 = Date.now(); recSend = true; recLocked = false;
    const mb = document.getElementById('micBtn');
    if (mb) mb.classList.add('rec');
    recUI(true);
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
      // El micro abierto se marca con una clase, no con un emoji pegado en el
      // texto: el ::before de .pl-row.mic lo dibuja y el del personaje queda
      // intacto. rtcMic solo tiene a los remotos; el propio se marca con rtcOn.
      const mic = isMe ? rtcOn : rtcMic.get(p.id);
      const hablando = p.id && (rtcNivel.get(p.id) || 0) > 0.06;
      const cls = ['pl-row'];
      if (isMe) cls.push('me');
      if (mic) cls.push('mic');
      if (hablando) cls.push('speaking');
      return `<div class="${cls.join(' ')}" data-id="${p.id || ''}"><span class="dot" style="background:${(CHAR_DEF[p.char] || CHAR_DEF.ger).dot}"></span>${esc(p.name)}${p.seated ? ' 🪑' : ''} <span class="pl-status">${st.emoji} ${st.label}</span></div>`;
    }).join('');
  renderCallUI();
  layoutDesktopAudio();
  renderCamStrip();
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
window.addEventListener('keydown', (e) => {
  if (attachmentModal && !attachmentModal.classList.contains('hidden')) {
    if (e.key === 'Escape') { closeAttachmentPreview(); e.preventDefault(); }
    return;
  }
  if (state.spectating) {
    if (e.key === 'Escape') { exitSpectatorMode(); e.preventDefault(); }
    return;
  }
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; chatInput.blur(); hideEmojiPicker(); updateSendMic(); e.preventDefault(); }
    if (e.key === 'Escape') { chatInput.value = ''; chatInput.blur(); hideEmojiPicker(); updateSendMic(); e.preventDefault(); }
    return; // al escribir en el chat no se mueven el personaje ni la página
  }
  if (!state.joined) return;
  const key = e.key.toLowerCase();
  const code = (e.code || '').toLowerCase();
  keys[key] = true;
  if (code) keys[code] = true; // KeyW/KeyA... funciona también con teclados en otra distribución
  if (['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s','keya','keyd','keyw','keys'].includes(key) ||
      ['arrowleft','arrowright','arrowup','arrowdown','keya','keyd','keyw','keys'].includes(code)) e.preventDefault();
  if (e.key === 'Enter') { chatInput.focus(); e.preventDefault(); return; }
  if (key === 'h') { helpOverlay.classList.toggle('hidden'); return; }
    if (key === 'p') { mpToggle(); return; }
    if (key === 'm') { rtcToggle(); return; }
    if (key === 's') { rtcCompartir(); return; }
  if (e.key === 'Escape') { helpOverlay.classList.add('hidden'); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 3) { setStatus(STATUS_KEYS[n - 1]); return; }
  if (n === 4) { doZumbido(); return; }
  const emoteMap = { z: '👋', x: '😂', c: '🎉', v: '👍', b: '🤔', n: '🔥', m: '☕' };
  const em = emoteMap[key];
  if (em) { send({ type: 'emote', id: state.myId, emote: em }); const me = state.players.get(state.myId); if (me) { me.emote = em; me.emoteUntil = performance.now() + 3000; } return; }
  if (key === 'f') {
    const near = nearestPlayer();
    send({ type: 'wave', id: state.myId, at: near ? near.name : null });
    const me = state.players.get(state.myId);
    if (me) { me.wave = true; me.waveUntil = performance.now() + 1500; }
    if (near) { addChat(null, `Saludaste a ${near.name} 👋`, 'system'); beep(600, 0.06); }
  }
}, true);
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
  if (e.code) keys[e.code.toLowerCase()] = false;
}, true);
window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

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
  g.imageSmoothingEnabled = !!(charKey && assetsReady && charAssets[charKey] && charAssets[charKey].down);
  g.clearRect(0, 0, pv.width, pv.height);
  if (!charKey) {
    if (officePreviewReady) {
      const x = Math.round((pv.width - officePreviewImg.width) / 2);
      const y = Math.round((pv.height - officePreviewImg.height) / 2);
      g.drawImage(officePreviewImg, x, y);
    }
    return;
  }
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
async function join() {
  if (state.spectating || spectatorCheckBusy) return;
  const dni = (dniInput.value || '').replace(/\D/g, '');
  if (/^\d{4}$/.test(dni)) {
    if (Date.now() < spectatorLockUntil) {
      dniError('Demasiados intentos. Esperá 30 segundos antes de volver a probar.');
      return;
    }
    spectatorCheckBusy = true;
    if (joinBtn) joinBtn.disabled = true;
    dniInput.disabled = true;
    let spectatorCodeValid = false, validationFailed = false;
    try { spectatorCodeValid = await verifySpectatorPin(dni); }
    catch { validationFailed = true; }
    spectatorCheckBusy = false;
    if (joinBtn) joinBtn.disabled = false;
    dniInput.disabled = false;
    if (validationFailed) {
      dniError('No pude validar el código de ingreso; probá de nuevo.');
      return;
    }
    if (spectatorCodeValid) {
      spectatorFailures = 0;
      dniError('');
      dniInput.value = '';
      enterSpectatorMode();
      return;
    }
    spectatorFailures++;
    if (spectatorFailures >= 5) {
      spectatorFailures = 0; spectatorLockUntil = Date.now() + 30000;
      dniError('Demasiados intentos. Esperá 30 segundos antes de volver a probar.');
      return;
    }
  }
  const entry = ROSTER.find((r) => r.dni === dni);
  if (!entry) { dniError('⛔ DNI no autorizado: la oficina es privada del equipo.'); return; }
  spectatorFailures = 0;
  const dup = [...state.players.values()].find((p) => p.char === entry.char && p.id !== state.myId && performance.now() - (p.seen || 0) < 9000);
  if (dup) { dniError(`⚠️ ${entry.name} ya está en la oficina desde otro dispositivo.`); return; }
  dniError('');
  state.spectating = false; document.body.classList.remove('spectator-mode');
  spectatorWhisperBacklog.length = 0;
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
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch {}
  send({ type: 'profile', id: state.myId, name: entry.name, char: entry.char, dni });
  sendMoveNow();
  if (seat) { setStatus('codeando', true); addChat(null, 'Te sentaste en tu puesto 💻 — WASD para levantarte', 'system'); }
  addChat(null, `¡Bienvenido/a a la oficina, ${entry.name}! Presioná H para la ayuda.`, 'system');
  beep(523, 0.09); setTimeout(() => beep(784, 0.12), 100);
  renderPlayerList();
}
async function verifySpectatorPin(pin) {
  const bytes = new TextEncoder().encode(SPECTATOR_PIN_SALT + pin);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === SPECTATOR_PIN_HASH;
}
function enterSpectatorMode() {
  state.spectating = true; state.joined = false; state.myName = '';
  // Identidad WebRTC propia (invisible para la oficina): con id el espectador
  // puede INICIAR conexiones y recibir cámaras, pantalla y audio. El prefijo
  // '0tv' lo hace iniciador siempre (ordena antes que cualquier nombre) y
  // permite reconocerlo para no ensuciar la malla de los jugadores.
  state.myId = '0tv' + Math.random().toString(36).slice(2, 7);
  document.body.classList.add('spectator-mode');
  // Toc toc: los que ya tienen cámara/pantalla/micro prendido se re-anuncian.
  send({ type: 'rtc-hello', mic: false, from: state.myId });
  joinOverlay.classList.add('hidden');
  const musicPanel = document.getElementById('musicPanel'); if (musicPanel) musicPanel.classList.add('hidden');
  // Mensajes públicos ya estaban en el chat; agrega también los /w recibidos antes del PIN.
  for (const msg of spectatorWhisperBacklog.splice(0)) addChat(msg.from, msg.text, 'whisper', msg.to, msg.att);
  renderPlayerList();
  addChat(null, '👁 Modo espectador · solo lectura · Esc para salir', 'system');
  toast('👁 Entraste como espectador · Esc para volver al ingreso');
}
function exitSpectatorMode() {
  if (!state.spectating) return;
  state.spectating = false; state.myId = null; state.myName = '';
  document.body.classList.remove('spectator-mode');
  if (attachmentModal && !attachmentModal.classList.contains('hidden')) closeAttachmentPreview();
  chatLog.innerHTML = ''; // no dejar susurros visibles para quien use luego el login
  spectatorWhisperBacklog.length = 0; state.players.clear(); renderPlayerList();
  rtcCerrar();   // salir de espectador deja el micro cerrado, como corresponde
  joinOverlay.classList.remove('hidden');
}

function ejectSelf(reason) {
  state.joined = false;
  state.players.delete(state.myId);
  sendFn = null;
  joinOverlay.classList.remove('hidden');
  dniError(reason);
}

// ---------- Bucle ----------
let lastT = performance.now();
function rebuildWideBackdrop() {
  backdropDirty = false;
  const W = canvas.width, H = canvas.height;
  if (!bgReady || W <= 900 || W / H <= 1.45) {
    wideBackdropCv.width = 0; wideBackdropCv.height = 0;
    return;
  }
  // Rellena las franjas laterales del monitor con la misma oficina, suavizada.
  // La escena central y los sprites siguen usando su escala original, sin estirarse.
  const bw = Math.max(1, Math.ceil(W / 4)), bh = Math.max(1, Math.ceil(H / 4));
  wideBackdropCv.width = bw; wideBackdropCv.height = bh;
  const g = wideBackdropCv.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.fillStyle = '#10131a'; g.fillRect(0, 0, bw, bh);
  const scale = Math.max(bw / bgCv.width, bh / bgCv.height);
  const dw = bgCv.width * scale, dh = bgCv.height * scale;
  g.save();
  g.filter = 'blur(8px)';
  g.drawImage(bgCv, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
  g.restore();
  g.fillStyle = 'rgba(8,10,18,0.34)'; g.fillRect(0, 0, bw, bh);
}
function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  backdropDirty = true;
  viewScale = Math.min(canvas.width / VW, canvas.height / VH);
  // En pantalla ancha (PC y TV) SIEMPRE hay rieles laterales. Si el aspecto de
  // la pantalla hace que la oficina no deje 220px por lado (caso típico: TV
  // 16:9), se achica la oficina hasta reservarlos. Así el TV, el monitor y
  // cualquier pantalla ancha se ven exactamente igual.
  if (canvas.width > 900 && (canvas.width - VW * viewScale) / 2 < 220) {
    viewScale = Math.min((canvas.width - 440) / VW, canvas.height / VH);
  }
  viewOX = (canvas.width - VW * viewScale) / 2;
  viewOY = (canvas.height - VH * viewScale) / 2;
  document.documentElement.style.setProperty('--desktop-rail-width', Math.max(0, Math.round(viewOX)) + 'px');
  document.body.classList.toggle('desktop-rails', canvas.width > 900);
  layoutDesktopAudio();
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
  const now = performance.now();
  const me = state.players.get(state.myId);
  // El movimiento propio solo existe al jugar; el suavizado remoto debe correr
  // también en login/espectador para que se vean los desplazamientos recibidos.
  if (me && state.joined) {
    let dx = 0, dy = 0;
    if (document.activeElement !== chatInput) {
      if (keys['arrowleft'] || keys['a'] || keys['keya']) dx -= 1;
      if (keys['arrowright'] || keys['d'] || keys['keyd']) dx += 1;
      if (keys['arrowup'] || keys['w'] || keys['keyw']) dy -= 1;
      if (keys['arrowdown'] || keys['s'] || keys['keys']) dy += 1;
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
      me.moving = true;
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

    if (me.moving && now - lastSend > SEND_MS) { lastSend = now; sendMoveNow(); }
    else if (!me.moving && now - lastSend > 1000) { lastSend = now; sendMoveNow(); }

    const z = me.seated ? { name: 'tu puesto', status: 'codeando' } : null;
    const zKey = z ? z.name : null;
    if (zKey !== lastSeatState) {
      lastSeatState = zKey;
      if (me.status === 'ausente') { /* 🏃 ausente: no resucitar automáticamente */ }
      else if (z) setStatus(z.status, true);
      else setStatus('disponible', true);
    }
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
  // En escritorio panorámico, usa las bandas como ambiente de la oficina en vez
  // de dejarlas vacías. Móvil conserva exactamente el encuadre de siempre.
  if (W > 900 && W / H > 1.45) {
    if (backdropDirty) rebuildWideBackdrop();
    if (wideBackdropCv.width && wideBackdropCv.height) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(wideBackdropCv, 0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
    }
  }
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

  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    if (p.status === 'ausente') continue; // 🏃 ¡Ya vengo!: el personaje se va de la escena (sigue en la lista y su puesto queda reservado)
    let topY, shR, fs;
    if (p.seated) {
      const ss = sitScale(p.y);
      const sframe = Math.floor(now / 280) % 2;
      const spr = getSitSprite(p.char || 'ger', p.x < VW / 2 ? 'left' : 'right', true, sframe);
      // Conserva la proporción natural de cada conjunto personaje + silla gamer.
      const h = 48 * ss, w = h * (spr.width / spr.height);
      ctx.imageSmoothingEnabled = true;              // sprites sentados de alta resolución
      ctx.imageSmoothingQuality = 'high';
      const bob = charAssets[p.char || 'ger'] && charAssets[p.char || 'ger'].sit ? (sframe ? h / SIT_H * 2 : 0) : 0;
      ctx.drawImage(spr, p.x - w / 2, p.y - h + bob, w, h);
      topY = p.y - h; shR = 15 * ss; fs = Math.round(3.1 * ss);
    } else {
      const spr = getSprite(p.char || 'ger', p.dir || 'down', 0);
      const conAsset = assetsReady && !!(charAssets[p.char || 'ger'] && charAssets[p.char || 'ger'].down);
      // La altura en pantalla no cambia respecto al sprite por código (44*s), pero
      // el ancho sale de la proporción real del sprite: los PNG de referencia son
      // mucho más esbeltos que el chibi de la grilla de 4x.
      //
      // Tope de altura: los PNG de referencia miden ~500px de alto, así que
      // reescalados por encima de su tamaño natural se ven blandos. La escala de
      // profundidad sigue mandando hasta llegar a 1:1 y después el personaje deja de
      // crecer. Los pies quedan siempre en p.y, así que sigue plantado en el piso, y
      // como shR y fs salen de la misma s, la sombra y el nombre encajan con el
      // tamaño nuevo. El tope es solo para los PNG: el chibi de la grilla es de
      // 128x176 y su look pixelado se banca cualquier escala.
      const sRaw = depthScale(p.y);
      const s = conAsset ? Math.min(sRaw, spr.height / 44) : sRaw;
      const h = 44 * s, w = h * (spr.width / spr.height);
      ctx.imageSmoothingEnabled = conAsset;              // ver nota arriba del setTransform
      if (conAsset) ctx.imageSmoothingQuality = 'high';

      // Caminata: el sprite se dibuja SIEMPRE con la misma forma, igual que
      // parado. Solo se mueve de posición (rebote y balanceo); no hay squash ni
      // estiramiento, que deformaban la silueta y lo hacían ver distinto de la
      // pose quieta. La foto de referencia es una pose única y su sombra entre las
      // piernas es tono opaco, así que no hay pasos que recortar: separar el sprite
      // en capas parte la ropa y deja artefactos.
      if (p.moving) {
        const ph = Math.floor(now / 150) % 2;
        const dy = ph ? -s * 0.4 : s * 0.1;
        const dx = ph ? s * 0.28 : -s * 0.28;
        ctx.drawImage(spr, p.x - w / 2 + dx, p.y - h + dy, w, h);
      } else {
        ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
      }
      if (p.wave && now < p.waveUntil) {
        ctx.save(); ctx.translate(p.x - w / 2, p.y - h); ctx.scale(w / 32, h / 44);
        drawWaveArm(ctx, p.color || 0, now);
        ctx.restore();
      }
      topY = p.y - h; shR = 11 * s * (spr.width / spr.height) * (32 / 44) * 1.9; fs = Math.round(3.1 * s);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, shR, shR * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    ctx.font = `${fs}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    const label = p.name;
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

  // Marco visual de escritorio: oscurece solo las bandas exteriores; el área de
  // la oficina queda intacta y sus límites coinciden con los paneles laterales.
  if (document.body.classList.contains('desktop-rails')) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const railLeft = Math.floor(viewOX), railRight = Math.ceil(W - viewOX);
    const left = ctx.createLinearGradient(0, 0, railLeft, 0);
    left.addColorStop(0, 'rgba(8,10,16,0.78)');
    left.addColorStop(0.88, 'rgba(8,10,16,0.72)');
    left.addColorStop(1, 'rgba(8,10,16,0.52)');
    ctx.fillStyle = left; ctx.fillRect(0, 0, railLeft, H);
    const right = ctx.createLinearGradient(W, 0, railRight, 0);
    right.addColorStop(0, 'rgba(8,10,16,0.78)');
    right.addColorStop(0.88, 'rgba(8,10,16,0.72)');
    right.addColorStop(1, 'rgba(8,10,16,0.52)');
    ctx.fillStyle = right; ctx.fillRect(railRight, 0, W - railRight, H);
    ctx.fillStyle = 'rgba(94,117,161,0.62)';
    ctx.fillRect(Math.max(0, railLeft - 2), 0, 2, H);
    ctx.fillRect(railRight, 0, 2, H);
  }
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
  if (mv) mv.oninput = () => playerCmd('setVolume', [+mv.value]);
  const bAudio = document.getElementById('mpAudio'); if (bAudio) bAudio.onclick = () => setWantVideo(false);
  const bView = document.getElementById('mpView'); if (bView) bView.onclick = () => setWantVideo(true);
  // El panel de "mirar juntos". Todo lo de adentro es local: ni cerrar el panel ni
  // tocar los controles del player mandan nada por la red, así que cada uno puede
  // pausar o avanzar sin desarmarle el video a los demás. Para volver al DJ está
  // el botón Sincronizar.
  const videoPanel = document.getElementById('videoPanel');
  const bClose = document.getElementById('videoClose');
  if (bClose) bClose.onclick = () => { if (videoPanel) videoPanel.classList.add('hidden'); playerCmd('pauseVideo'); };
  const bSync = document.getElementById('videoSync'); if (bSync) bSync.onclick = videoSync;
  const bTap = document.getElementById('videoTap');
  if (bTap) bTap.onclick = () => { bTap.classList.add('hidden'); playerCmd('playVideo'); };
  // Llamada de la oficina: micro, pantalla y volumen
  const bMic = document.getElementById('micCallBtn'); if (bMic) bMic.onclick = rtcToggle;
  const bShare = document.getElementById('shareBtn'); if (bShare) bShare.onclick = rtcCompartir;
  const bCam = document.getElementById('camBtn'); if (bCam) bCam.onclick = rtcCamToggle;
  const cVol = document.getElementById('callVol');
  if (cVol) cVol.oninput = rtcCallVolumen;
  const bFloat = document.getElementById('videoFloat'); if (bFloat) bFloat.onclick = () => setVideoFloat(!videoFloat);
  const bBig = document.getElementById('videoBig');
  if (bBig) bBig.onclick = () => { if (!videoFloat) setVideoFloat(true); else setVideoBig(!videoBig); };
  // Arrastre de la ventana flotante. Recién se separa del centro en el primer
  // movimiento, porque hasta entonces la coloca el transform translate(-50%,-50%)
  // y si se le fixara left/top de entrada quedaría corrida.
  const vHead = videoPanel ? videoPanel.querySelector('.vp-head') : null;
  if (vHead) {
    let drag = null;
    vHead.addEventListener('pointerdown', (e) => {
      if (!videoPanel.classList.contains('float')) return;
      if (e.target.closest('button')) return;
      const r = videoPanel.getBoundingClientRect();
      videoPanel.style.left = r.left + 'px';
      videoPanel.style.top = r.top + 'px';
      videoPanel.style.right = 'auto';
      videoPanel.style.transform = 'none';
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      videoPanel.classList.add('dragging');
      try { vHead.setPointerCapture(e.pointerId); } catch { /* sin capture */ }
      e.preventDefault();
    });
    vHead.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const w = videoPanel.offsetWidth, h = videoPanel.offsetHeight;
      const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - drag.dx));
      const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - drag.dy));
      videoPanel.style.left = x + 'px';
      videoPanel.style.top = y + 'px';
    });
    const fin = (e) => {
      if (!drag) return;
      drag = null;
      videoPanel.classList.remove('dragging');
      try { vHead.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    };
    vHead.addEventListener('pointerup', fin);
    vHead.addEventListener('pointercancel', fin);
  }
  // Redimensionar, como una ventana: tirador en el borde derecho, en el inferior y
  // en la esquina. Solo crecen hacia la derecha y hacia abajo, así que el borde
  // izquierdo y el de arriba quedan clavados donde estaban. Al agarrar cualquier
  // tirador se sueltan también el transform y el centrado, porque si no la caja
  // saltaría mientras se mide contra el rect real.
  if (videoPanel) {
    let rs = null;
    videoPanel.querySelectorAll('.vp-grip-r, .vp-grip-b, .vp-grip').forEach((g) => {
      g.addEventListener('pointerdown', (e) => {
        const r = videoPanel.getBoundingClientRect();
        videoPanel.style.left = r.left + 'px';
        videoPanel.style.top = r.top + 'px';
        videoPanel.style.right = 'auto';
        videoPanel.style.transform = 'none';
        rs = { dir: g.dataset.dir, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
        try { g.setPointerCapture(e.pointerId); } catch { /* sin capture */ }
        e.preventDefault(); e.stopPropagation();
      });
      g.addEventListener('pointermove', (e) => {
        if (!rs) return;
        if (rs.dir.indexOf('e') >= 0) videoW = rs.w + (e.clientX - rs.x);
        if (rs.dir.indexOf('s') >= 0) videoH = rs.h + (e.clientY - rs.y);
        aplicarTamano();
      });
      const finR = (e) => { if (rs) { rs = null; try { g.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ } } };
      g.addEventListener('pointerup', finR);
      g.addEventListener('pointercancel', finR);
      g.addEventListener('dblclick', (e) => { e.stopPropagation(); setVideoBig(!videoBig); });
    });
  }
  const attachmentClose = document.getElementById('attachmentClose');
  if (attachmentClose) attachmentClose.onclick = closeAttachmentPreview;
  if (attachmentModal) attachmentModal.addEventListener('click', (e) => { if (e.target === attachmentModal) closeAttachmentPreview(); });

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
  if (sendBtn) sendBtn.onclick = () => { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; hideEmojiPicker(); updateSendMic(); };
  const attBtn = document.getElementById('attBtn');
  const fileInput = document.getElementById('fileInput');
  if (attBtn && fileInput) { attBtn.onclick = () => fileInput.click(); fileInput.onchange = onFilePicked; }
  // Picker de emojis estilo WhatsApp (versión pixel, cortita y al pie)
  const emojiBtn = document.getElementById('emojiBtn'), emojiPicker = document.getElementById('emojiPicker');
  if (emojiBtn && emojiPicker) {
    const EMOJIS = ['😀', '😂', '😅', '😉', '😊', '😍', '😎', '🤔', '😴', '😢', '😡', '🙃', '👍', '👎', '👏', '🙏', '💪', '🔥', '🎉', '❤️', '☕', '🍕', '💻', '🐛', '🚀', '✅'];
    emojiPicker.innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join('');
    emojiBtn.onclick = () => { emojiPicker.hidden = !emojiPicker.hidden; };
    emojiPicker.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      chatInput.value = (chatInput.value + b.textContent).slice(0, 200);
      chatInput.focus(); updateSendMic();
    });
  }
  // Mic estilo WhatsApp: mantener apretado graba, soltar envía, deslizar a la
  // izquierda cancela, deslizar hacia arriba fija la grabación (manos libres).
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    let px = 0, py = 0;
    micBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (recLocked && mediaRec && mediaRec.state === 'recording') { stopRec(); return; } // ➤ del modo fijado
      px = e.clientX; py = e.clientY;
      try { micBtn.setPointerCapture(e.pointerId); } catch { /* siga */ }
      startRec();
    });
    micBtn.addEventListener('pointermove', (e) => {
      if (!mediaRec || mediaRec.state !== 'recording' || recLocked) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      if (dx < -60) { cancelRec(); toast('🎤 Grabación cancelada'); return; }
      if (dy < -50) recLock();
    });
    ['pointerup', 'pointercancel'].forEach((ev) => micBtn.addEventListener(ev, () => { if (!recLocked) stopRec(); }));
    micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const recTrash = document.getElementById('recTrash');
  if (recTrash) recTrash.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); cancelRec(); toast('🎤 Grabación cancelada'); });
  chatInput.addEventListener('input', updateSendMic);
  updateSendMic();

  // Tamaño de letra del chat: botones -/+ con la preferencia guardada en el
  // navegador. El estilo inline le gana al CSS, así vale en cualquier modo.
  const fsAplicar = () => {
    const v = +(localStorage.getItem('chatFs') || 0);
    if (v) chatLog.style.fontSize = v + 'px';
  };
  const fsPaso = (d) => {
    const actual = +(localStorage.getItem('chatFs') || 0) ||
      Math.round(parseFloat(getComputedStyle(chatLog).fontSize)) || 9;
    const v = Math.max(6, Math.min(14, actual + d));
    localStorage.setItem('chatFs', String(v));
    chatLog.style.fontSize = v + 'px';
  };
  const fsMenos = document.getElementById('fsMinus');
  const fsMas = document.getElementById('fsPlus');
  if (fsMenos) fsMenos.onclick = () => fsPaso(-1);
  if (fsMas) fsMas.onclick = () => fsPaso(1);
  fsAplicar();

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
