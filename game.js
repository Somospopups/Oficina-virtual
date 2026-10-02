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
// Cuánto vale la última señal de vida de un compañero. El que está sentado
// avisa una vez por segundo, así que 10s es de sobra: pasado ese rato lo damos
// por ido y su silla vuelve a estar disponible.
const PRESENCIA_MS = 10000;

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
// Guardamos el SHA-256 de (ROSTER_DNI_SALT + dni), nunca el DNI en crudo: este
// repo es público y en modo P2P el 'profile' sale por los relays. El que tipea
// su DNI se lo hashea en el momento y se compara con esto. OJO con dos límites:
//   · es PRIVACIDAD, no seguridad — un DNI tiene 8 dígitos y se fuerza bruta;
//   · histClaveDe() sigue derivando la clave del historial del DNI tipeado,
//     en crudo y sólo en este equipo: si acá se cambia eso se rompe todo el
//     historial ya publicado (las firmas dejarían de coincidir con HIST_PUB).
// El mismo bloque, con los mismos hashes, vive en server.js (AGENTE.md).
const ROSTER = [
  { dniHash: 'b1107acec716b2b2fb97d22981b837e7e06820b04eb9e547f5ddfc8ac49d7462', name: 'Ger',  char: 'ger',  seat: 1 },
  { dniHash: '3287864555e7cb9d27c8d35d1061d2a0bdb49443d15437f20380a73525ede609', name: 'Facu', char: 'facu', seat: 2 },
  { dniHash: '06c9e59af9a354f49c5f4e256cfcd7d4234d72548168a5f255d7042d0080f2cc', name: 'Ovni', char: 'ovni', seat: 3 },
  // "visita": entra y figura como cualquiera mientras está, pero cuando no
  // está no se lo lista en gris, porque no es de la oficina.
  { dniHash: '8d3e12b8ee8286deb18b955aa7ca2e0b4313815025769398ce8adde55a8e37f1', name: 'Milo', char: 'milo', seat: 0, visita: true },  // escritorio delantero izq. (el único libre)
  { dniHash: '94f949db2a43a11784e6eb9ee9d1dede14710bf804fa413ef2368765ce17f07f', name: 'Ove',  char: 'ove'  },  // sin puesto fijo: se sienta en el que quede libre
];
// ---------- VERSIONADO DE LOS DIBUJOS POR CONTENIDO ----------
// Antes cada PNG se pedía con un ?v= escrito a mano: si se reemplazaba el
// dibujo y no se cambiaba ese número, el navegador lo sacaba del caché y se
// veía la versión vieja (pasaba al entrar, en el login y en la oficina). Ahora
// la URL se arma con el hash del contenido que genera tools/generar-assets.js:
// cambia el dibujo -> cambia la URL -> se descarga el nuevo. Siempre.
//
// Respaldo: si el navegador tuviera cacheado un index.html viejo (sin el
// assets.js), en vez de un hash fijo se usa la marca de tiempo de esta carga.
// Es peor para el tráfico, pero garantiza que nunca se vea un dibujo viejo.
const ASSET_T = 't=' + Date.now();
function urlAsset(ruta) {
  const v = (window.ASSETS && window.ASSETS[ruta]) || ASSET_T;
  return ruta + '?' + v;
}

// Paleta muestreada de los PNG de referencia (sprites/*.png), no aproximada a ojo:
// así el chibi de grilla (fallback), el sentado y los PNG comparten los mismos
// tonos y no se nota de dónde salió cada uno.
const CHAR_DEF = {
  ger:  { skin: '#f5b984', skinD: '#d69a68', hair: '#2a1a12', beard: '#3a2418', beardStyle: 'goatee', shirt: '#201e24', pants: '#4c6886', shoe: '#141418', sole: '#d8d8dc', wide: false, hairStyle: 'spiky', dot: '#8a6a4a' },
  facu: { skin: '#f0a876', skinD: '#d08c5c', hair: '#0d0d12', beard: '#0d0d12', beardStyle: 'full',  shirt: '#2e6198', pants: '#537793', shoe: '#5a4432', sole: null,      wide: true,  hairStyle: 'full',  dot: '#2e6198' },
  ovni: { skin: '#f7b985', skinD: '#d89e6a', hair: '#1a1512', beard: '#241c18', beardStyle: 'goatee', shirt: '#fcb306', pants: '#25232d', shoe: '#e8e8e8', sole: '#9aa2ae', wide: false, hairStyle: 'cap',   dot: '#fcb306', jacket: true },
  milo: { skin: '#f2b083', skinD: '#d4946a', hair: '#7a4a2a', beard: '#7a4a2a', beardStyle: null, shirt: '#f4f4f6', pants: '#17171d', shoe: '#101014', sole: '#e0e0e4', wide: false, hairStyle: 'full', dot: '#b98a55', kid: true },
  ove:  { skin: '#e8a878', skinD: '#c78a5e', hair: '#241a14', beard: '#2e211a', beardStyle: 'goatee', shirt: '#201e24', pants: '#4a6480', shoe: '#141418', sole: '#d8d8dc', wide: false, hairStyle: 'spiky', dot: '#4a6480' },
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
const SIT_BASE_FACE = { ger: 'left', facu: 'right', ovni: 'right', milo: 'right', ove: 'left' };
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

// ---------- Normalizado de frames ----------
// Los PNG del equipo llegaron en tandas con lienzos de distinto alto (el de
// frente mide 493 px; la espalda y los frames de caminata, 700). Si cada frame
// se dibuja con el alto de SU lienzo, el personaje cambia de tamaño al girar o
// al caminar: en la v97 la espalda se veía hasta 42% más alta que el frente, y
// además el tope de escala se recalculaba con cada cambio de dirección.
// Acá cada imagen se recorta a su figura (el canal alfa) y se reescala a un alto
// común por personaje, así el alto en pantalla es el mismo en todas las poses.
// Se mide una sola vez, cuando termina de cargar cada PNG.
function cajaDeFigura(img) {
  try {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        if (d[(y * cv.width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch { return null; }   // sin permiso para leer píxeles: se usa la imagen tal cual
}
// Devuelve un canvas donde la figura ocupa TODO el alto (pies en el borde de
// abajo, que es donde el render los apoya) y el ancho es el natural de la pose.
function normalizarFigura(img, altoFigura) {
  const caja = cajaDeFigura(img);
  if (!caja) return { img, alto: img.height };
  const alto = altoFigura || caja.h;
  const ancho = Math.max(1, Math.round(caja.w * (alto / caja.h)));
  const cv = document.createElement('canvas');
  cv.width = ancho; cv.height = alto;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, caja.x, caja.y, caja.w, caja.h, 0, 0, ancho, alto);
  return { img: cv, alto };
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
let rtcPantalla = null, rtcPantallaTrack = null, rtcPantallaAudioTrack = null, rtcComparto = false, rtcReneg = false, rtcRenegPend = false;
const rtcComparte = new Map();  // peerId -> true si está compartiendo pantalla
const rtcShareSid = new Map();  // peerId -> id del stream de su pantalla
const rtcShareVivo = new Map(); // peerId -> MediaStream recibido de su pantalla (se conserva al cortar: el re-share revive por replaceTrack sin ontrack nuevo)
const rtcShareAudio = new Map(); // peerId -> <audio> con el sonido de sistema de su pantalla

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
      // Audio del sistema: el navegador muestra la casilla "Compartir audio"
      // en el diálogo (pestañas siempre; pantalla entera según el sistema).
      // Sin procesar: es música/video, no una voz para limpiar.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch { return; }
  rtcPantalla = stream;
  rtcPantallaTrack = stream.getVideoTracks()[0];
  rtcPantallaAudioTrack = stream.getAudioTracks()[0] || null;
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
    if (rtcPantallaAudioTrack) {
      if (p.shareAudioSender) {
        try { p.shareAudioSender.replaceTrack(rtcPantallaAudioTrack); } catch { necesitaReneg = true; }
      } else necesitaReneg = true;
    }
  }
  if (necesitaReneg) await rtcRenegociar();
  toast(rtcPantallaAudioTrack
    ? '🖥 Compartiendo pantalla CON audio del sistema.'
    : '🖥 Compartiendo tu pantalla. Tip: marcá "Compartir audio" en el diálogo para que se escuche el sonido.');
}

function rtcDejarDeCompartir() {
  const track = rtcPantallaTrack;
  if (track) { try { track.stop(); } catch { /* ya estaba */ } }
  if (rtcPantallaAudioTrack) { try { rtcPantallaAudioTrack.stop(); } catch { /* ya estaba */ } }
  rtcPantalla = null; rtcPantallaTrack = null; rtcPantallaAudioTrack = null;
  if (!rtcComparto) return;
  rtcComparto = false;
  send({ type: 'rtc-share', on: false, from: state.myId });
  // Se desenchufa el track pero el canal QUEDA VIVO (replaceTrack a null),
  // igual que al apagar la cámara. Nada de removeTrack ni de renegociar: la
  // renegociación era la fuente de todos los bugs del re-share.
  for (const p of rtcMesh.values()) {
    if (p.shareSender) { try { p.shareSender.replaceTrack(null); } catch { /* ya cerrado */ } }
    if (p.shareAudioSender) { try { p.shareAudioSender.replaceTrack(null); } catch { /* ya cerrado */ } }
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
        const audPantEsta = rtcPantallaAudioTrack && p.pc.getSenders().some((s) => s.track === rtcPantallaAudioTrack);
        if (rtcPantallaAudioTrack && !audPantEsta) p.shareAudioSender = p.pc.addTrack(rtcPantallaAudioTrack, rtcPantalla);
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

// Sonido de sistema de la pantalla compartida: un <audio> aparte por
// compañero, con el mismo volumen general de la llamada. El elemento se
// conserva al cortar (el canal queda vivo y el re-share lo revive solo).
function rtcAudioPantalla(peer, stream) {
  let a = rtcShareAudio.get(peer);
  if (!a) {
    a = document.createElement('audio');
    a.autoplay = true; a.playsInline = true;
    document.body.appendChild(a);
    rtcShareAudio.set(peer, a);
  }
  if (a.srcObject !== stream) a.srcObject = stream;
  a.muted = rtcMuteLocal.has(peer);
  a.volume = rtcVolumen();
  a.play().catch(() => { /* lo revive el gesto */ });
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
  toast('📷 Cámara prendida: se ve en los cuadros de video.');
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
let camStripPrimero = '';   // quién está primero en la fila, para scrollear cuando cambia
function renderCamStrip() {
  const strip = document.getElementById('camStrip');
  if (!strip) return;
  const alguna = rtcCamOn || rtcCamPeers.size > 0 || camStripSticky;
  // La tira, en el celu, ocupa la franja entre la oficina y el chat y empuja el
  // chat hacia abajo: si aparece o desaparece, hay que recalcular el layout.
  const cambio = strip.hidden !== !alguna;
  strip.hidden = !alguna;
  if (!alguna) { if (cambio) { camStripPrimero = ''; layoutMobile(); } return; }
  camStripSticky = true;
  // En el celu la fila scrollea, así que entra más gente que en el escritorio
  // (donde la tira es una columna con un tercio del alto del riel).
  const MAX = esMovil() ? 8 : 3;
  while (strip.children.length < MAX) {
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
  // Orden: primero el que está HABLANDO, que es lo que uno quiere ver, y tiene
  // que quedar SIEMPRE a la izquierda. Después, los que tienen la cámara
  // prendida; al final, el resto por nombre. El nivel de voz ya lo mide
  // rtcNivel (analyser sobre el audio de cada uno).
  const nivelDe = (id) => (id ? (rtcNivel.get(id) || 0) : 0);
  const hablando = (id) => nivelDe(id) > 0.06;
  const todos = state.spectating
    ? [...state.players.values()].filter((p) => p.id && p.name)
    : [{ id: state.myId, name: 'Vos', me: true }, ...[...state.players.values()].filter((p) => p.id && p.id !== state.myId)];
  todos.sort((a, b) => (hablando(b.id) ? 1 : 0) - (hablando(a.id) ? 1 : 0)
    || nivelDe(b.id) - nivelDe(a.id)
    || (b.me ? 1 : 0) - (a.me ? 1 : 0)        // si nadie habla, tu cuadro primero, como siempre
    || (rtcCamPeers.get(b.id) ? 1 : 0) - (rtcCamPeers.get(a.id) ? 1 : 0)
    || String(a.name).localeCompare(String(b.name)));
  // Ni más que la gente que hay: los cuadros de sobra se esconden. Antes en el
  // celu se mostraba un mínimo de 3 aunque estuvieras solo, y quedaban huecos
  // vacíos en la fila, que se veían como agujeros entre los cuadros. Ahora en el
  // celu se ve solo la gente que hay.
  const cuantos = Math.min(MAX, esMovil() ? Math.max(1, todos.length) : 3);
  const slots = todos.slice(0, MAX).map((p) => (p.me ? { name: p.name, me: true } : { id: p.id, name: p.name }));
  while (slots.length < MAX) slots.push(null);
  slots.forEach((s, i) => {
    const el = strip.children[i];
    el.hidden = i >= cuantos;
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
        const sa = rtcShareAudio.get(id);
        if (sa) { try { sa.muted = rtcMuteLocal.has(id); } catch { /* ya no está */ } }
        renderCamStrip();
      };
    }
  });
  // Si cambió quién está primero (habla otro), la fila vuelve al principio: el
  // que habla tiene que quedar a la vista, a la izquierda de todos.
  const primero = slots[0] ? (slots[0].me ? 'me' : slots[0].id) : '';
  if (primero !== camStripPrimero) { camStripPrimero = primero; strip.scrollLeft = 0; }
  layoutDesktopAudio(); // recalcular alturas ahora que los cuadros existen
  if (cambio) layoutMobile(); // y en el celu, la franja de la tira y el chat
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
  if (rtcPantallaAudioTrack) {
    try { p.shareAudioSender = p.pc.addTrack(rtcPantallaAudioTrack, rtcPantalla); } catch { /* sin track */ }
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
    const st = e.streams[0] || new MediaStream([e.track]);
    if (e.track.kind === 'video') { rtcVideoEntrante(peer, st); return; }
    // Audio: puede ser el micro o el sonido de sistema de la pantalla. El del
    // micro viaja en un stream SOLO de audio; el de pantalla comparte stream
    // con el video (mismo sid que anuncia 'rtc-share').
    if (rtcShareSid.get(peer) === st.id || st.getVideoTracks().length > 0) rtcAudioPantalla(peer, st);
    else rtcConectarAudio(peer, st);
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
    while (aud < 2) { p.pc.addTransceiver('audio', { direction: 'recvonly' }); aud++; }  // micro + audio de pantalla
    while (vid < 2) { p.pc.addTransceiver('video', { direction: 'recvonly' }); vid++; }  // cámara + pantalla
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
  document.querySelectorAll('video, audio').forEach((v) => {
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
  for (const a of rtcShareAudio.values()) { try { a.volume = rtcVolumen(); } catch { /* ya no está */ } }
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
  const sa = rtcShareAudio.get(peer);
  if (sa) { try { sa.remove(); } catch { /* ya no está */ } rtcShareAudio.delete(peer); }
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
  const niveles = [];
  for (const [peer, v] of rtcVivo) {
    let lvl = 0;
    if (v.analyser) {
      v.analyser.getByteTimeDomainData(v.buf);
      let suma = 0;
      for (let i = 0; i < v.buf.length; i++) { const d = (v.buf[i] - 128) / 128; suma += d * d; }
      lvl = Math.min(1, Math.sqrt(suma / v.buf.length) * 6);
    }
    rtcNivel.set(peer, lvl);
    if (lvl > 0.06) niveles.push([peer, lvl]);
  }
  // Del más fuerte al más suave: el primero es el que se pone a la izquierda.
  niveles.sort((a, b) => b[1] - a[1]);
  for (const [peer] of niveles) key += peer;
  if (key !== rtcHablandoPrev) {
    rtcHablandoPrev = key;
    renderPlayerList();
    renderCamStrip();   // en el celu, el que habla pasa a la izquierda de la fila
  }
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
    cb.title = rtcCamOn ? 'Cámara prendida: tocá para apagarla' : 'Prender tu cámara: aparece en los cuadros de video';
  }
  const sh = document.getElementById('shareBtn');
  if (sh) {
    sh.classList.toggle('on', rtcComparto);
    // Si hay otro compartiendo, el botón se deshabilita: solo uno a la vez.
    const ocupado = rtcComparte.size > 0;
    sh.disabled = ocupado;
    sh.style.opacity = rtcComparto ? '1' : (ocupado ? '0.35' : '0.65');
    sh.title = ocupado ? 'Ya hay alguien compartiendo pantalla'
      : (rtcComparto ? 'Dejar de compartir' : 'Compartir tu pantalla con los de la oficina');
  }
  const vb = document.getElementById('callVolBox');
  if (vb) vb.classList.toggle('hidden', !rtcOn && !rtcVivo.size);
  const pl = document.getElementById('playerList');
  if (pl) pl.classList.toggle('mic-off', !rtcOn && !rtcVivo.size);
  renderCamStrip(); // que los botoncitos de cada cuadro reflejen mic/cámara al toque
}

// Caminata "muñeco de papel": frames armados recortando el MISMO PNG original
// (cero pérdida de calidad, cero redibujo). Se corta a la altura de la cadera
// y se flexiona una pierna por vez: más corta (rodilla levantada) y un pelín
// adelantada. Para los personajes que no tienen hoja de animación propia.
function buildPasoFrames(im) {
  const W = im.width, H = im.height;
  const hipY = Math.round(H * 0.70);
  const lh = H - hipY;
  const lift = Math.max(3, Math.round(H * 0.045));
  const adel = Math.max(1, Math.round(W * 0.02));
  const mk = (lado) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(im, 0, 0, W, hipY, 0, 0, W, hipY);              // cabeza + torso intactos
    const mitad = Math.floor(W / 2);
    if (lado < 0) {
      g.drawImage(im, 0, hipY, mitad, lh, adel, hipY, mitad, lh - lift);        // izq. flexionada
      g.drawImage(im, mitad, hipY, W - mitad, lh, mitad, hipY, W - mitad, lh);  // der. plantada
    } else {
      g.drawImage(im, 0, hipY, mitad, lh, 0, hipY, mitad, lh);
      g.drawImage(im, mitad, hipY, W - mitad, lh, mitad - adel, hipY, W - mitad, lh - lift);
    }
    return cv;
  };
  return [mk(-1), im, mk(1), im];  // paso izq → apoyo → paso der → apoyo
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
      sit.src = urlAsset(`sprites/${k}_sit.png`);
    };
    // Los de pie son recortes de "Oficina Virtual/De pie.jpg": el diseño aprobado
    // (chibi, cuerpo entero, sneakers a la vista). Antes se cargaba primero un
    // *_fino.png, que era otra variante: mucho más detalle, pero otra cara (cabeza
    // desproporcionada, ojos grandes, piercings) y con los pies cortados por el
    // borde del lienzo. Ese camino ya no se usa.
    const im = new Image();
    im.onload = () => {
      // Primero se normaliza el sprite base: define el alto de figura de este
      // personaje (todas las direcciones y los frames de caminata se miden contra
      // él para que el tamaño no cambie nunca).
      const base = normalizarFigura(im);
      const r = flipCanvas(base.img);
      charAssets[k] = { down: base.img, left: r, right: r, up: oscurecer(base.img), baseH: base.alto };
      if (k === 'milo' || k === 'ger' || k === 'ovni' || k === 'ove') {
        // Milo, Ger y Ovni tienen espalda REAL dibujada (no la silueta
        // oscurecida). Ovni la gano en la v101: hasta la v100 su pose de "arriba"
        // era el propio frente apagado, asi que se alejaba de vos y te miraba.
        const esp = new Image();
        esp.onload = () => { charAssets[k].up = normalizarFigura(esp, base.alto).img; };
        esp.src = urlAsset(`sprites/${k}_up.png`);
      }
      // Si el personaje tiene hoja propia con las 4 direcciones (Ger, Milo y
      // Ovni), sus PNG se normalizan contra su sprite de frente. Si no, se arma
      // la caminata muneco-de-papel desde su unico PNG: el frente sale bien, pero
      // de espaldas es la silueta oscurecida y de perfil el frente espejado, asi
      // que camina mirando al reves. Ovni conserva el frente de papel (el
      // dibujo original del personaje) y usa su hoja para el resto.
      if (walkSources[k]) {
        if (k === 'ovni') walkAssets[k] = { down: buildPasoFrames(base.img) };
        normalizarCaminata(k, base.alto);
      } else {
        walkAssets[k] = {
          down: buildPasoFrames(base.img),
          up: buildPasoFrames(charAssets[k].up),
          left: buildPasoFrames(r),
          right: buildPasoFrames(r),
        };
      }
      loadSeat();
    };
    im.onerror = () => { loadSeat(); }; // los sprites por código siguen disponibles
    im.src = urlAsset(`sprites/${k}.png`);
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

// ---------- Estado / DOM ----------
const state = { myId: null, myName: '', myColor: 0, players: new Map(), joined: false, spectating: false };
const spectatorWhisperBacklog = [];
const SPECTATOR_PIN_SALT = 'somospopups-observer-v1:';
const SPECTATOR_PIN_HASH = 'f18455ea0b372784dc5b59b1085cdeeefbbc6c7cbfc580e675a63af1a0e11a86';
// Mismo esquema que el PIN de espectador, para el ingreso al ROSTER.
const ROSTER_DNI_SALT = 'somospopups-dni-v1:';
async function dniHashDe(dni) {
  return bHex(await bSha(new TextEncoder().encode(ROSTER_DNI_SALT + dni)));
}
async function entryPorDni(dni) {
  if (!dni) return null;
  const h = await dniHashDe(dni);
  return ROSTER.find((r) => r.dniHash === h) || null;
}
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
bgImg.src = urlAsset('bg_deep2.png');

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
officePreviewImg.src = urlAsset('sprites/office-icon.png');
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
const VERSION = 'v154 · 02/10/2026';

// ---------- El index.html es el único que puede llegar viejo ----------
// Todo lo demás se pide siempre fresco: style.css y game.js con ?t=, y cada
// dibujo con el hash de su contenido. Pero el index.html que los carga lo sirve
// GitHub Pages con cache-control: max-age=600, así que el navegador puede tener
// uno guardado de hace rato y mezclar HTML VIEJO con CSS y JS NUEVOS. Ahí la
// pantalla queda rota de formas raras (botones corridos, textos de otra
// versión) y la persona no tiene manera de darse cuenta: le dirías "hacé
// Ctrl+F5", pero primero tiene que sospechar que ese es el problema.
//
// Por eso el HTML lleva un sello <meta name="ov-build"> y acá lo comparamos. Si
// no es de esta versión, recargamos UNA vez con la URL cambiada: otra URL es
// otra entrada del caché, así que esa sí se descarga de verdad.
(function htmlFresco() {
  const meta = document.querySelector('meta[name="ov-build"]');
  const enHtml = meta ? (meta.content || '').trim() : '';   // sin meta = html anterior a v124
  const enJs = VERSION.split(' ')[0];
  if (enHtml === enJs) { try { sessionStorage.removeItem('ovHtmlViejo'); } catch { /* incógnito */ } return; }
  try {
    if (sessionStorage.getItem('ovHtmlViejo') === enJs) return; // ya recargamos por esta versión: no insistir
    sessionStorage.setItem('ovHtmlViejo', enJs);
  } catch { return; }   // sin sessionStorage no arriesgamos un bucle de recargas
  const u = new URL(location.href);
  u.searchParams.set('fresco', Date.now().toString(36));
  location.replace(u.toString());
})();
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
    moving: me.moving, seated: me.seated, status: me.status, fightMode: !!me.fightMode, joinTs: state.joinTs || 0,
    bubble: me.bubble, bubbleUntil: me.bubbleUntil, emote: me.emote, emoteUntil: me.emoteUntil,
  };
}
function sendMoveNow() { const p = myPublic(); if (p) send(Object.assign({ type: 'move' }, p)); }

function esMovil() { return window.matchMedia('(max-width: 900px)').matches; }
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
    const nbtnR = document.getElementById('notifBtn');
    if (nbtnR) { nbtnR.style.top = ''; nbtnR.style.right = ''; nbtnR.style.left = ''; }
    panel.style.top = ''; panel.style.right = ''; panel.style.left = '';
    if (call) { call.style.top = ''; call.style.right = ''; call.style.bottom = ''; }
    if (vol) { vol.style.top = ''; vol.style.right = ''; }
    if (esMovil()) {
      // En el celu el chat, la tira de cámaras y los controles se acomodan JUNTOS
      // en layoutMobile (la tira va en la franja entre la oficina y el chat, y
      // el chat baja para hacerle lugar). Si se limpian los estilos acá, cada
      // mensaje del server que llega a renderPlayerList borra esa posición y el
      // chat vuelve a su sitio: el layout del celu no se sostenía.
      layoutMobile();
      return;
    }
    if (chatP) { chatP.style.top = ''; chatP.style.bottom = ''; chatP.style.height = ''; }
    if (strip) {
      strip.style.left = ''; strip.style.top = ''; strip.style.right = ''; strip.style.bottom = '';
      strip.style.width = ''; strip.style.height = ''; strip.style.overflowY = ''; strip.style.flexDirection = ''; strip.style.display = '';
      for (const el of strip.children) { el.style.width = ''; el.style.height = ''; el.style.flex = ''; }
    }
    return;
  }
  const list = document.getElementById('playerList');
  const top = Math.ceil((list ? list.getBoundingClientRect().bottom : 100) + 10);
  button.style.top = top + 'px'; button.style.right = '12px'; button.style.left = 'auto';
  const buttonH = button.getBoundingClientRect().height || 36;
  // La fila del rail derecho se arma de derecha a izquierda: 🎵 radio, 🔔
  // notificaciones, y al final la barra de llamada. Cada botón apoya su borde
  // derecho a 6px del anterior y todos miden exactamente lo mismo (el CSS lo
  // fija en 34×34: la regla de la oficina es que el rail se vea parejo).
  let filaRight = 12 + Math.ceil(button.getBoundingClientRect().width || 38) + 6;
  const nbtnF = document.getElementById('notifBtn');
  if (nbtnF) {
    const w = Math.ceil(nbtnF.getBoundingClientRect().width || 34);
    nbtnF.style.top = top + 'px';
    nbtnF.style.right = filaRight + 'px';
    filaRight += w + 6;
  }
  // La barra de llamada va en la misma fila, a la izquierda de todo lo anterior
  if (call) {
    call.style.top = top + 'px'; call.style.bottom = 'auto';
    call.style.right = filaRight + 'px';
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
    if (histClave) histPublicar();
    if (histAbiertos.size) histPedir();
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m[0] !== 'EVENT' || !m[2]) return;
    const e = m[2];
    // El historial viaja por la misma conexión pero es otra cosa: se desvía
    // antes de todo lo demás (si no, handleMsg intentaría leerlo como si fuera
    // un movimiento o un mensaje de chat).
    if (m[1] === histSub || e.kind === HIST_KIND) { histRecibir(e); return; }
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
window.addEventListener('pagehide', () => {
  if (state.joined) send({ type: 'bye', id: state.myId, name: state.myName });
  histTerminarSesion();
});
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
        notify('mic', rtcNombreDe(msg.from), 'abrió su micrófono: se armó la llamada', (state.players.get(msg.from) || {}).char);
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
        notify('share', rtcNombreDe(msg.from), 'está compartiendo su pantalla', (state.players.get(msg.from) || {}).char);
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
        notify('cam', rtcNombreDe(msg.from), 'prendió su cámara', (state.players.get(msg.from) || {}).char);
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
      notify('joinleave', msg.name, 'salió de la oficina', null, 'leave');
      renderPlayerList();
      break;
    case 'bye': {
      const p = state.players.get(msg.id);
      if (p) { state.players.delete(msg.id); addChat(null, `${p.name} salió de la oficina`, 'system'); notify('joinleave', p.name, 'salió de la oficina', p.char, 'leave'); renderPlayerList(); }
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
      if (!mine) {
        const remitente = state.players.get(msg.id);
        const cuerpo = (msg.text && msg.text.trim()) ||
          (msg.att ? (msg.att.kind === 'img' ? '\u{1F5BC}\uFE0F Te mandó una imagen' : '\u{1F3A4} Te mandó un audio de voz') : '');
        if (isW) { if (msg.to === state.myName) notify('whisper', msg.from + ' · privado', cuerpo, remitente && remitente.char); }
        else notify('chat', msg.from, cuerpo, remitente && remitente.char);
      }
      break;
    }
    case 'status': { const p = state.players.get(msg.id); if (p) p.status = msg.status; renderPlayerList(); break; }
    case 'emote': { const p = state.players.get(msg.id); if (p) { p.emote = msg.emote; p.emoteUntil = performance.now() + 3000; } break; }
    case 'cat-pet': catAplicarMimo(msg.id); break;
    case 'cafe': cafeAplicar(msg.id); break;
    case 'anim': animAplicar(msg.id, msg.anim); break;
    case 'fight-mode': fightModoAplicar(msg.id, msg.active); break;
    case 'fight-hit': fightGolpeAplicar(msg.id, msg.hit); break;
    case 'nudge': {
      if (dedupe(msg)) break;
      localZumb(msg.from || 'Alguien', false, msg.id);
      // snd = null: el aviso sonoro es el pedo de localZumb, no se le suma otro
      notify('nudge', msg.from || 'Alguien', 'te mandó un zumbido: ¡sacudió toda la oficina!', null, null);
      break;
    }
    // 'wave' eliminado: el saludo de cercanía quedaba feo. Los mensajes de
    // clientes viejos caen al vacío sin romper nada.
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
    if (state.joined && p.id !== state.myId) { addChat(null, `${p.name} entró a la oficina`, 'system'); beep(660, 0.08); if (USE_P2P) maybeMusicForNewcomer(); notify('joinleave', p.name, 'entró a la oficina', p.char, 'join'); }
  }
  cur.pid = p._pid || cur.pid;
  cur.seen = performance.now();
  cur.joinTs = p.joinTs || cur.joinTs;
  cur.name = p.name; cur.char = p.char || cur.char; cur.color = p.color; cur.dir = p.dir;
  cur.moving = p.moving; cur.status = p.status; cur.seated = !!p.seated; cur.fightMode = !!p.fightMode;
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
  // Tocar el estado que ya está activo te devuelve a 🟢 disponible. OJO: eso
  // vale solo cuando lo pide la persona (botón, tecla 1-3 o menú del celu). Las
  // llamadas del sistema van con silent y NO deben alternar: al entrar sentado
  // se pedía 'codeando' dos veces (una en join y otra en el primer update) y la
  // segunda lo apagaba, así que todos figuraban "Disponible" sentados.
  if (k === myStatus && !silent) k = 'disponible';
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
    if (msg.from !== state.myName) {
      notify('video', msg.from, music.mode === 'video' ? 'puso un video para mirar juntos' : 'puso música en la radio de la oficina');
    }
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

// ---------- Notificaciones estilo Messenger (Windows / macOS / Android) ----------
// Espíritu MSN 2000: la oficina te busca aunque estés en otra ventana. Cada
// evento puede salir por tres vías a la vez:
//   1) cartel del sistema operativo (Notification API, igual que el MSN),
//   2) sonidito retro sintetizado (WebAudio, sin archivos),
//   3) el título de la pestaña titilando como la barra de tareas de XP.
// Se prende/apaga con el 🔔 de la barra de arriba; el ⚙ elige qué eventos
// avisan. Si el navegador bloquea los carteles, quedan andando el sonido y el
// título titilante igual.
const NOTIF_KINDS = {
  chat:      { emoji: '\u{1F4AC}', label: 'Mensajes del chat',        cd: 4000   },
  whisper:   { emoji: '\u{1F92B}', label: 'Mensajes privados',        cd: 2500   },
  joinleave: { emoji: '\u{1F6AA}', label: 'Entradas y salidas',       cd: 5000   },
  nudge:     { emoji: '\u{1F4A8}', label: 'Zumbidos',                 cd: 1000   },
  cam:       { emoji: '\u{1F4F7}', label: 'Cámaras prendidas',        cd: 60000  },
  share:     { emoji: '\u{1F4BB}', label: 'Pantalla compartida',      cd: 30000  },
  video:     { emoji: '\u{1F3AC}', label: 'Video / radio',            cd: 15000  },
  mic:       { emoji: '\u{1F3A4}', label: 'Llamada (micro abierto)',  cd: 120000 },
};
const NOTIF_CFG_KEY = 'ovNotifs';
let notifCfg = { on: true, bgOnly: true, sound: true,
  kinds: { chat: 1, whisper: 1, joinleave: 1, nudge: 1, cam: 1, share: 1, video: 1, mic: 1 } };
try {
  const guardada = JSON.parse(localStorage.getItem(NOTIF_CFG_KEY) || 'null');
  if (guardada) notifCfg = { ...notifCfg, ...guardada, kinds: { ...notifCfg.kinds, ...(guardada.kinds || {}) } };
} catch { /* cfg rota: van los defaults */ }
const notifUltimo = new Map();            // "kind:quien" -> ts (anti-spam: los relays P2P repiten)
let notifSinVer = 0, notifFlashTimer = null;
const NOTIF_TITLE_BASE = document.title;

function notifGuardar() { try { localStorage.setItem(NOTIF_CFG_KEY, JSON.stringify(notifCfg)); } catch { /* incógnito */ } }
function notifHayApi() { return typeof Notification !== 'undefined'; }
function notifPermiso() { return notifHayApi() ? Notification.permission : 'denied'; }

// Soniditos retro, todos sintetizados. Cada uno imita un alerta del Messenger.
function notifSnd(kind) {
  if (!notifCfg.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(() => {}); return; }
    const t = audioCtx.currentTime;
    const nota = (f, t0, d, v = 0.10, type = 'triangle', f1) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + t0);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + t0 + d);
      g.gain.setValueAtTime(0.0001, t + t0);
      g.gain.exponentialRampToValueAtTime(v, t + t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + t0 + d);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + t0); o.stop(t + t0 + d + 0.02);
    };
    switch (kind) {
      case 'chat':    nota(1318, 0, 0.10); nota(1975, 0.07, 0.16, 0.09); break;             // "pling" de mensaje nuevo
      case 'whisper': nota(1760, 0, 0.09); nota(2217, 0.08, 0.09); nota(2637, 0.16, 0.14, 0.08); break;
      case 'join':    nota(660, 0, 0.22, 0.08, 'sine', 1320); break;                        // barrido "se conectó"
      case 'leave':   nota(1320, 0, 0.25, 0.07, 'sine', 620); break;                        // barrido "se fue"
      case 'cam':     nota(2093, 0, 0.05, 0.12, 'square'); nota(2793, 0.06, 0.07, 0.10, 'square'); break; // obturador
      case 'share':   nota(784, 0, 0.10); nota(988, 0.10, 0.16); break;
      case 'video':   nota(523, 0, 0.09); nota(659, 0.09, 0.09); nota(784, 0.18, 0.18); break; // arpegio "a mirar"
      case 'mic':     for (let i = 0; i < 3; i++) { nota(988, i * 0.12, 0.05, 0.09, 'square'); nota(784, i * 0.12 + 0.05, 0.05, 0.09, 'square'); } break; // ring viejito
    }
  } catch { /* sin audio */ }
}

// Título titilante: el "botón parpadeante de la barra de tareas", versión pestaña.
// Cuenta los avisos sin ver y se calma solo cuando la ventana recupera el foco.
function notifFlashTitulo(texto) {
  texto = String(texto).slice(0, 60);
  notifSinVer++;
  document.title = `(${notifSinVer}) ${texto}`;
  if (!notifFlashTimer) {
    let prendido = false, ultimo = texto;
    notifFlashTimer = setInterval(() => {
      prendido = !prendido;
      document.title = prendido ? `\u26A1 (${notifSinVer}) ${ultimo}` : NOTIF_TITLE_BASE;
    }, 900);
  }
}
function notifLimpiarFlash() {
  notifSinVer = 0;
  clearInterval(notifFlashTimer); notifFlashTimer = null;
  document.title = NOTIF_TITLE_BASE;
}
window.addEventListener('focus', notifLimpiarFlash);
document.addEventListener('visibilitychange', () => { if (!document.hidden) notifLimpiarFlash(); });

// El cartel lleva de ícono el sprite sentado del que avisa (ya vive en un
// canvas: el toDataURL es gratis). Si todavía no cargó, el ícono de la oficina.
function notifIcono(charKey) {
  try {
    const cv = charKey && charAssets[charKey] && charAssets[charKey].sit;
    if (cv && cv.toDataURL) return cv.toDataURL();
  } catch { /* sprite sin cargar */ }
  return 'sprites/office-icon.png';
}

// Corazón del sistema. `kind` es una clave de NOTIF_KINDS; `snd` permite que un
// mismo kind suene distinto (joinleave suena 'join' o 'leave'), y con snd=null
// se silencia el extra (el zumbido ya suena a pedo por localZumb).
function notify(kind, quien, cuerpo, charKey, snd) {
  if (!notifCfg.on || !notifCfg.kinds[kind]) return;
  if (notifCfg.bgOnly && !document.hidden && document.hasFocus()) return; // la estás mirando: ya te enteraste
  const clave = kind + ':' + (quien || '');
  const ahora = Date.now();
  if (ahora - (notifUltimo.get(clave) || 0) < NOTIF_KINDS[kind].cd) return; // anti-spam por persona y tema
  notifUltimo.set(clave, ahora);
  const k = NOTIF_KINDS[kind];
  const titulo = `${k.emoji} ${quien || 'Oficina Virtual'}`;
  notifFlashTitulo(titulo);
  if (snd !== null) notifSnd(snd || kind);
  if (notifPermiso() !== 'granted') return; // sin cartel del SO: quedan el sonido y el título titilante
  try {
    const n = new Notification(titulo, {
      body: String(cuerpo || '').slice(0, 160),
      icon: notifIcono(charKey),
      tag: 'ov-' + kind + '-' + (quien || ''), // un cartel por tema y persona: se reemplaza, no se apilan
      renotify: true,
    });
    n.onclick = () => { try { window.focus(); } catch { /* ya estaba al frente */ } n.close(); };
  } catch { /* Safari viejo solo acepta el constructor con callback */ }
}

// Todo se maneja desde la campana: apagada → un click la prende (el permiso
// del navegador se pide en ese gesto); prendida → un click abre/cierra el
// panel de opciones (desde el panel también se apagan). Así el rail derecho no
// se llena de botones: hay UNA sola campana.
function notifToggle() {
  if (notifCfg.on) {
    notifArmarPanel();
    const p = document.getElementById('notifPanel');
    if (p) p.classList.toggle('hidden');
    return;
  }
  notifPrender();
}
function notifPrender() {
  notifCfg.on = true; notifGuardar(); notifRenderBtn();
  if (!notifHayApi()) {
    toast('🔔 Prendidas: sonido + título titilante (este navegador no hace carteles)');
    return;
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(() => {
      notifRenderBtn();
      if (Notification.permission === 'granted') { toast('🔔 ¡Notificaciones prendidas! Te avisan en Windows/Mac aunque estés en otra ventana'); notifPrueba(); }
      else toast('🔔 Prendidas sin carteles (los bloqueó el navegador): quedan el sonido y el título titilante');
    });
    return;
  }
  if (Notification.permission === 'granted') { toast('🔔 ¡Notificaciones prendidas!'); notifPrueba(); }
  else toast('🔔 Prendidas sin carteles (bloqueados por el navegador): sonido + título titilante');
}
function notifApagar() {
  notifCfg.on = false; notifGuardar(); notifRenderBtn();
  const p = document.getElementById('notifPanel'); if (p) p.classList.add('hidden');
  toast('🔕 Notificaciones apagadas');
}

// Cartelito de bienvenida para confirmar que el navegador realmente los muestra.
function notifPrueba() {
  if (notifPermiso() !== 'granted') return;
  try {
    const n = new Notification('\u{1F514} Oficina Virtual', {
      body: '¡Listo! Te aviso por acá, estilo Messenger \u{1F389}',
      icon: 'sprites/office-icon.png', tag: 'ov-prueba',
    });
    n.onclick = () => { try { window.focus(); } catch { } n.close(); };
  } catch { /* no pasa nada */ }
}

function notifRenderBtn() {
  const b = document.getElementById('notifBtn'); if (!b) return;
  const perm = notifPermiso();
  b.textContent = notifCfg.on ? '🔔' : '🔕';
  b.classList.toggle('off', !notifCfg.on);
  b.title = !notifCfg.on
    ? 'Notificaciones apagadas: un click las prende (avisos estilo Messenger aunque estés en otra ventana)'
    : perm === 'granted'
      ? 'Notificaciones prendidas: carteles + sonido. Click: opciones (desde ahí también se apagan)'
      : perm === 'denied'
        ? 'Carteles bloqueados por el navegador (candado → Notificaciones → Permitir). Igual suena y titila el título. Click: opciones'
        : 'Notificaciones prendidas. Click: opciones';
}

// Panel con un casillero por tipo de aviso. Se arma una sola vez.
function notifArmarPanel() {
  const p = document.getElementById('notifPanel');
  if (!p || p.dataset.armado) return;
  p.dataset.armado = '1';
  let html = '<div class="np-title">\u{1F514} NOTIFICACIONES · estilo Messenger</div>';
  html += `<label><input type="checkbox" id="npOn"${notifCfg.on ? ' checked' : ''}> \u{1F514} Notificaciones prendidas</label>`;
  html += '<div class="np-sep"></div>';
  for (const [k, v] of Object.entries(NOTIF_KINDS)) {
    html += `<label><input type="checkbox" data-kind="${k}"${notifCfg.kinds[k] ? ' checked' : ''}> ${v.emoji} ${v.label}</label>`;
  }
  html += '<div class="np-sep"></div>';
  html += `<label><input type="checkbox" id="npBg"${notifCfg.bgOnly ? ' checked' : ''}> \u{1FA9F} Solo si estoy en otra ventana</label>`;
  html += `<label><input type="checkbox" id="npSnd"${notifCfg.sound ? ' checked' : ''}> \u{1F50A} Con sonidito retro</label>`;
  html += '<div class="np-note">Los carteles salen por Windows/Mac igual que los del MSN. Si el navegador los bloquea, quedan el sonido y el título de la pestaña titilando.</div>';
  p.innerHTML = html;
  p.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'npOn') { if (t.checked) notifPrender(); else notifApagar(); return; }
    if (t.dataset && t.dataset.kind) notifCfg.kinds[t.dataset.kind] = t.checked ? 1 : 0;
    else if (t.id === 'npBg') notifCfg.bgOnly = t.checked;
    else if (t.id === 'npSnd') notifCfg.sound = t.checked;
    notifGuardar();
  });
}
function notifPanelAbierto() {
  const p = document.getElementById('notifPanel');
  return !!(p && !p.classList.contains('hidden'));
}
function notifCerrarPanel() {
  const p = document.getElementById('notifPanel');
  if (p) p.classList.add('hidden');
}
// Tocar en cualquier parte fuera del panel lo cierra. La campana queda afuera
// porque ella misma abre/cierra con su click (son eventos distintos: este es
// pointerdown y el de la campana es click; si también cerrara acá, un toque
// sobre ella abriría y cerraría en el mismo gesto).
function notifCerrarSiFuera(e) {
  if (!notifPanelAbierto()) return;
  const p = document.getElementById('notifPanel');
  const b = document.getElementById('notifBtn');
  const t = e.target;
  if (!t || (p && p.contains(t)) || (b && b.contains(t))) return;
  notifCerrarPanel();
}
function notifCerrarConEsc(e) {
  if (e.key === 'Escape' && notifPanelAbierto()) notifCerrarPanel();
}

// ---------- Historial de la oficina: quién entró y cuánto se quedó ----------
// Hace falta un lugar donde el dato SOBREVIVA, y el bus P2P no sirve: usa el
// kind 20001, que es efímero (los relays no lo archivan) y encima la
// suscripción sólo pide los últimos 60 segundos. Así que el historial va por
// un carril aparte:
//   · cada uno lleva su propia bitácora en localStorage, que es la fuente de
//     verdad de SUS sesiones (nadie escribe las del otro: no hay forma de
//     contar dos veces lo mismo ni de que dos versiones se peleen);
//   · y la publica como kind 30078, que los relays SI guardan — uno por
//     persona, y cada publicación reemplaza a la anterior.
// Al abrir el panel se piden las cinco bitácoras y se juntan. No hace falta
// servidor, que es la condición: el sitio vive en GitHub Pages.
const HIST_KEY = 'ovHistorial';
const HIST_KIND = 30078;            // "addressable": se guarda y se reemplaza
const HIST_TAG = 'oficina-somospopups-historial-v1';
const HIST_MAX = 200;               // sesiones guardadas por persona
const HIST_DIAS = 90;               // y hasta cuántos días para atrás
const HIST_LATIDO = 30000;          // cada cuánto se marca "sigo acá"
const HIST_PEGAR = 300000;          // hasta 5 min de corte: sigue siendo la misma visita
const HIST_MINIMO = 60000;          // menos de 1 min no cuenta como visita
// Clave pública de cada uno, derivada de su DNI de forma determinística. Se
// calculan una sola vez y quedan escritas acá para no hacer cinco
// multiplicaciones de curva en cada carga de la página. Si entra alguien nuevo
// al ROSTER hay que agregarlo también acá: tools/checlear-boton-e.js avisa.
const HIST_PUB = {
  ger:  '6a94f3851c1f0eeaec51df5b30bcc0883082ff6b764680973626e36a632e8f1b',
  facu: '2328b4f52f763c95e0bbf486be0cb3c192d27af79aac2b1729345a9e63d7e6d8',
  ovni: '678f273f605aeb806fd3e0a8ed31c7fd289781a4cb971f43b024dc7a7610b8c2',
  milo: '2e12758c7bda259edb0ccd7f390d21af218cfb652648b5ccc78458a2ada903b7',
  ove:  '0c94de18c9477fff197637812f9bb5edc21cd41aee4abe8336025170c6a84d6e',
};
const histSub = 'h' + Math.random().toString(36).slice(2, 8);
let histPedidoEn = 0, histReintento = 0;
let histLocal = null;                  // { v, s: [{ i, f, u }] }  ms
const histRemoto = new Map();          // char -> { ses, ts }
let histClave = null, histTimer = 0, histUltimaPub = 0, histActiva = false;
const histAbiertos = new Set();        // filas desplegadas en el panel

function histCargar() {
  if (histLocal) return histLocal;
  try { histLocal = JSON.parse(localStorage.getItem(HIST_KEY) || 'null'); } catch { histLocal = null; }
  if (!histLocal || !Array.isArray(histLocal.s)) histLocal = { v: 1, s: [] };
  return histLocal;
}
function histGuardar() {
  const h = histCargar();
  const corte = Date.now() - HIST_DIAS * 86400000;
  h.s = h.s.filter((x) => x && x.i > corte).slice(-HIST_MAX);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch { /* incógnito */ }
}
// La identidad para el historial NO es la del bus: esa se sortea en cada carga
// (makeBusKeys) y entonces no habría a quién atribuirle una sesión. Esta sale
// del DNI, así que es siempre la misma persona aunque cambie de dispositivo.
async function histClaveDe(dni) {
  const h = await bSha(new TextEncoder().encode('ov-hist-v1:' + dni));
  let d = bMod(b2i(h), B_N); if (d === 0n) d = 1n;
  const P = bMul(d);
  return { pub: bHex(bI2b32(P.x)), d, even: P.y % 2n === 0n };
}
async function histIniciar(dni) {
  try { histClave = await histClaveDe(dni); } catch { return; }
  histEmpezarSesion();
}
// Si el navegador se cerró de golpe (o se fue la luz), la sesión anterior
// quedó abierta. No se descarta ni se deja viva para siempre: se cierra con el
// último latido, que es lo último que de verdad se supo de esa persona.
function histEmpezarSesion() {
  if (histActiva) return;
  const h = histCargar();
  for (const s of h.s) if (s.f == null) s.f = s.u || s.i;
  const ahora = Date.now();
  // Recargar la página, perder el wifi un minuto o cerrar y volver a abrir no
  // son "otra visita": si la anterior terminó recién, se retoma esa misma
  // sesión en lugar de partir la jornada en pedacitos (si no, la "última vez"
  // de alguien que refrescó termina siendo un pestañeo de 10 segundos).
  const prev = h.s[h.s.length - 1];
  if (prev && prev.f != null && ahora - prev.f < HIST_PEGAR) { prev.f = null; prev.u = ahora; }
  else h.s.push({ i: ahora, f: null, u: ahora });
  histActiva = true;
  histGuardar();
  histPublicar();
  clearInterval(histTimer);
  histTimer = setInterval(histLatir, HIST_LATIDO);
}
function histLatir() {
  const h = histCargar();
  const ult = h.s[h.s.length - 1];
  if (!ult || ult.f != null) return;
  ult.u = Date.now();
  histGuardar();
  if (Date.now() - histUltimaPub > 120000) histPublicar();
  if (histAbiertos.size) renderPlayerList();
}
function histTerminarSesion() {
  const h = histCargar();
  const ult = h.s[h.s.length - 1];
  if (ult && ult.f == null) {
    ult.f = Date.now();
    // Pasar menos de un minuto no es haber estado en la oficina: casi siempre
    // es una recarga o un clic sin querer. Se descarta para no ensuciar.
    if (ult.f - ult.i < HIST_MINIMO) h.s.pop();
    histGuardar(); histPublicar();
  }
  histActiva = false;
  clearInterval(histTimer); histTimer = 0;
}
// Formato compacto para que el evento quede chico: [arranque en segundos,
// cuánto duró en segundos]; -1 quiere decir "todavía adentro".
async function histPublicar() {
  if (!histClave || !busSockets.length) return;
  histUltimaPub = Date.now();
  const h = histCargar();
  const s = h.s.map((x) => [Math.floor(x.i / 1000), x.f == null ? -1 : Math.max(0, Math.round((x.f - x.i) / 1000))]);
  const content = JSON.stringify({ v: 1, c: state.myChar, s });
  const created = Math.floor(Date.now() / 1000);
  const tags = [['d', HIST_TAG]];
  try {
    const id = await busEventId(histClave.pub, created, HIST_KIND, tags, content);
    const sig = await busSign(id, histClave);
    const evt = JSON.stringify(['EVENT', { id, pubkey: histClave.pub, created_at: created, kind: HIST_KIND, tags, content, sig }]);
    for (const so of busSockets) { try { if (so.ws.readyState === 1) so.ws.send(evt); } catch { /* relay caído */ } }
  } catch { /* el historial nunca puede romper la oficina */ }
}
function histPedir() {
  histPedidoEn = Date.now();
  const req = JSON.stringify(['REQ', histSub, { kinds: [HIST_KIND], authors: Object.values(HIST_PUB), '#d': [HIST_TAG] }]);
  for (const so of busSockets) { try { if (so.ws.readyState === 1) so.ws.send(req); } catch { /* relay caído */ } }
  // Si no contesta nadie, hay que repintar igual para que deje de decir
  // "buscando…" y pase a "todavía sin registro".
  clearTimeout(histReintento);
  histReintento = setTimeout(() => { if (histAbiertos.size) renderPlayerList(); }, 6500);
}
function histRecibir(e) {
  if (!e || e.kind !== HIST_KIND) return;
  const char = Object.keys(HIST_PUB).find((c) => HIST_PUB[c] === e.pubkey);
  if (!char) return;
  let c; try { c = JSON.parse(e.content); } catch { return; }
  if (!c || !Array.isArray(c.s)) return;
  const prev = histRemoto.get(char);
  if (prev && prev.ts >= e.created_at) return;   // me llegó una copia más vieja
  histRemoto.set(char, {
    ses: c.s.map(([i, d]) => ({ ini: i * 1000, fin: d < 0 ? null : (i + d) * 1000 })),
    ts: e.created_at * 1000,
  });
  if (histAbiertos.size) renderPlayerList();
}
// Lo propio sale de localStorage, que siempre está más fresco que el relay.
function histDatos(char) {
  if (char === state.myChar && histCargar().s.length) {
    return { ses: histCargar().s.map((x) => ({ ini: x.i, fin: x.f })), ts: Date.now() };
  }
  return histRemoto.get(char) || null;
}
function histDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
}
function histHora(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// El día sólo se nombra cuando NO es hoy: repetir "hoy" en cada renglón comía
// el ancho del riel y empujaba todo a tres líneas.
function histDia(ms) {
  const d = new Date(ms), hoy = new Date(), ayer = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return '';
  if (d.toDateString() === ayer.toDateString()) return 'ayer ';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} `;
}
function histMedianoche() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function histLunes() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - ((d.getDay() + 6) % 7) * 86400000; }
// Suma sólo la parte de cada sesión que cae DESPUES del corte: una jornada que
// arrancó ayer a las 23 y terminó hoy a la 1 aporta una hora a cada día, no dos
// a uno solo.
function histTotal(ses, desde) {
  let t = 0;
  for (const s of ses) t += Math.max(0, s.efe - Math.max(s.ini, desde));
  return t;
}
function histEstaAdentro(char) {
  return [...state.players.values()].some((p) => p.char === char
    && (p.id === state.myId || (p.seen && performance.now() - p.seen < 9000)));
}
// El historial no tiene panel propio: está escondido adentro de la lista de
// compañeros y sólo aparece cuando tocás un nombre. Por defecto no se ve nada.
function histDetalle(char) {
  const d = histDatos(char);
  if (!d || !d.ses.length) {
    const buscando = Date.now() - histPedidoEn < 6000;
    return `<div class="pl-hist"><span class="hx-sin">${buscando ? 'buscando…' : 'todavía sin registro'}</span></div>`;
  }
  const adentro = histEstaAdentro(char);
  // Una sesión sin hora de fin puede ser "está adentro ahora mismo" o "se le
  // cayó el navegador y nunca cerró". En el segundo caso lo último confiable
  // es su última publicación (d.ts), no el reloj de ahora.
  const ses = d.ses.slice().sort((a, b) => a.ini - b.ini)
    .map((s) => ({ ini: s.ini, fin: s.fin, efe: s.fin != null ? s.fin : (adentro ? Date.now() : Math.max(s.ini, d.ts)) }));
  const ult = ses[ses.length - 1];
  let linea;
  if (ult.fin == null && adentro) {
    linea = `<span class="hx-on">desde ${histDia(ult.ini)}${histHora(ult.ini)}</span> · <b>${histDur(Date.now() - ult.ini)}</b>`;
  } else if (ult.fin == null) {
    linea = `${histDia(ult.ini)}${histHora(ult.ini)} · <b>~${histDur(ult.efe - ult.ini)}</b> <span class="hx-aprox">(se cortó)</span>`;
  } else {
    linea = `${histDia(ult.ini)}${histHora(ult.ini)}→${histHora(ult.fin)} · <b>${histDur(ult.fin - ult.ini)}</b>`;
  }
  const previas = ses.slice(0, -1).slice(-6).reverse().map((s) =>
    `<div class="hx-ses">${histDia(s.ini)}${histHora(s.ini)}→${histHora(s.efe)} <span class="hx-g">${histDur(s.efe - s.ini)}</span></div>`
  ).join('');
  return '<div class="pl-hist">' +
    `<div class="hx-det">${linea}</div>` +
    `<div class="hx-tot">hoy <b>${histDur(histTotal(ses, histMedianoche()))}</b> · semana <b>${histDur(histTotal(ses, histLunes()))}</b></div>` +
    (previas ? `<div class="hx-lista">${previas}</div>` : '') + '</div>';
}
function histAlternarFila(char) {
  if (!char) return;
  if (histAbiertos.has(char)) histAbiertos.delete(char);
  else { histAbiertos.add(char); histPedir(); }   // al abrir, se le pide a los relays
  renderPlayerList();
}
// Igual que el resto de los paneles de la oficina: se cierra tocando afuera o
// con Esc. OJO: este va en fase de CAPTURA (ver donde se registra), asi que
// corre antes de que la lista se redibuje y el elemento tocado siga vivo.
function histCerrarFilas() { if (!histAbiertos.size) return; histAbiertos.clear(); renderPlayerList(); }
function histCerrarSiFuera(e) {
  if (!histAbiertos.size) return;
  const t = e.target;
  if (t && playerListBox && playerListBox.contains(t)) return;
  histCerrarFilas();
}
function histCerrarConEsc(e) { if (e.key === 'Escape' && histAbiertos.size) histCerrarFilas(); }

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
// El chatInput es un <textarea>: crece solo hasta ~5 líneas (96px) y después
// scrollea por dentro, así se puede leer completo y corregir antes de mandar.
// TODO cambio programático del texto pasa por acá (borrar al enviar/cancelar,
// insertar emojis, pre-cargar "/w nombre ..."), además del evento input.
function chatAutoGrow() {
  const i = document.getElementById('chatInput');
  if (!i || i.tagName !== 'TEXTAREA') return;
  if (getComputedStyle(i).display === 'none') return; // grabando: se ve otra cosa
  i.style.height = 'auto';
  const max = 96;
  i.style.height = Math.min(i.scrollHeight, max) + 'px';
  i.style.overflowY = i.scrollHeight > max + 2 ? 'auto' : 'hidden';
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
  const aux = document.getElementById('chatAux'); if (aux) aux.classList.toggle('hidden', on);
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
  // Los que no están ahora van en gris al final. Su historial se sigue
  // guardando y compartiendo igual, así que también se les puede tocar el
  // nombre; si no, sólo se podría mirar a los que justo están conectados.
  // Las visitas quedan afuera de esa lista: entran y se las ve como a
  // cualquiera, pero cuando no están no tienen por qué figurar.
  const dentro = new Set(list.map((p) => p.char));
  const fuera = ROSTER.filter((r) => !dentro.has(r.char) && !r.visita);
  const filaAusente = (r) => {
    const abierto = histAbiertos.has(r.char);
    return `<div class="pl-row ausente${abierto ? ' abierta' : ''}" data-char="${r.char}" title="Tocá para ver cuándo estuvo">` +
      `<span class="dot" style="background:${(CHAR_DEF[r.char] || CHAR_DEF.ger).dot}"></span>${esc(r.name)}` +
      `<span class="pl-flecha">${abierto ? '▾' : '▸'}</span>` +
      (abierto ? histDetalle(r.char) : '') + '</div>';
  };
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
      const abierto = histAbiertos.has(p.char);
      if (abierto) cls.push('abierta');
      return `<div class="${cls.join(' ')}" data-id="${p.id || ''}" data-char="${p.char || ''}" title="Tocá para ver cuándo entró y cuánto estuvo">` +
        `<span class="dot" style="background:${(CHAR_DEF[p.char] || CHAR_DEF.ger).dot}"></span>${esc(p.name)}` +
        `<span class="pl-flecha">${abierto ? '▾' : '▸'}</span>${p.seated ? ' 🪑' : ''} ` +
        `<span class="pl-status">${st.emoji} ${st.label}</span>` +
        (abierto ? histDetalle(p.char) : '') + '</div>';
    }).join('') +
    (fuera.length ? '<div class="pl-sep">no están ahora</div>' + fuera.map(filaAusente).join('') : '');
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
function seatLibreCerca() {
  const me = state.players.get(state.myId);
  if (!me || me.seated || !state.joined) return null;
  const s = seatNear(me.x, me.y);
  return s && !seatOwner(s, state.myId) ? s : null;
}
function sentarseE() {
  // E = botón de acción: sentarse en el escritorio cercano (ya no es automático)
  const me = state.players.get(state.myId);
  if (!me || me.seated) return false;
  const seat = seatNear(me.x, me.y);
  if (!seat) return false;
  const occ = seatOwner(seat, state.myId);
  if (occ) { toast(`🪑 Ese puesto es de ${occ.name}`); return true; }
  me.seated = true; me.dir = seat.face; me.x = seat.x; me.y = seat.y;
  me.moving = false; me.tx = me.x; me.ty = me.y;
  for (const n of animDe(me.char)) animCargar(me.char, n);   // sentado ya se pueden pedir: que estén bajadas
  sendMoveNow();
  return true;
}
// Un puesto está ocupado solo si hay alguien SENTADO ahí y además sigue vivo.
// Antes bastaba con estar cerca: el que pasaba caminando frente a un escritorio
// lo "reservaba" sin querer. Y un compañero fantasma (se le cortó la luz, cerró
// la pestaña de golpe) podía dejar la silla trabada hasta 75s.
function presente(p) { return !p.seen || performance.now() - p.seen < PRESENCIA_MS; }
function seatOwner(s, exceptId) {
  for (const p of state.players.values()) {
    if (p.id !== exceptId && p.seated && presente(p) && Math.hypot(p.x - s.x, p.y - s.y) < 50) return p;
  }
  return null;
}
// Dónde pararse al entrar cuando no quedan puestos: en la entrada del pasillo,
// corriéndose al costado si ya hay alguien justo ahí (que no se amontonen).
function puntoDePie() {
  const bx = VW / 2, by = 820;
  const libre = (x, y) => {
    if (!walkable(x, y)) return false;
    for (const p of state.players.values()) {
      if (p.id === state.myId || !presente(p)) continue;
      if (Math.hypot(p.x - x, p.y - y) < 70) return false;
    }
    return true;
  };
  if (libre(bx, by)) return { x: bx, y: by };
  for (let i = 1; i <= 6; i++) {
    for (const lado of [-1, 1]) {
      const x = bx + lado * i * 75;
      if (libre(x, by)) return { x, y: by };
    }
  }
  return { x: bx, y: by };
}
function resolveSeatConflict() {
  const me = state.players.get(state.myId);
  if (!me || !me.seated || !state.joined) return;
  const myS = SEATS.find((s) => Math.hypot(me.x - s.x, me.y - s.y) < 50);
  if (!myS) return;
  for (const p of state.players.values()) {
    if (p.id === state.myId || !p.seated) continue;
    if (Math.hypot(p.x - myS.x, p.y - myS.y) < 50 && (p.joinTs || 0) && (state.joinTs || 0) && p.joinTs < state.joinTs) {
      // El puesto ya era suyo (entró antes). Si queda algún escritorio libre me
      // corro ahí; si están todos ocupados me quedo DE PIE al lado, nunca
      // encimado.
      const otro = seatFor(null);
      if (otro) {
        me.x = otro.x; me.y = otro.y; me.dir = otro.face; me.seated = true;
        toast(`😅 ${p.name} llegó antes: te corriste al puesto de al lado`);
      } else {
        me.seated = false;
        let nx = myS.x + (myS.x < VW / 2 ? 90 : -90);
        let ny = clamp(myS.y + 40, FLOOR.yTop + 12, FLOOR.yBot - 8);
        if (!walkable(nx, ny)) { nx = myS.x; ny = clamp(myS.y + 70, FLOOR.yTop + 12, FLOOR.yBot - 8); }
        if (!walkable(nx, ny)) { const d = puntoDePie(); nx = d.x; ny = d.y; }
        me.x = nx; me.y = ny;
        toast(`😅 ${p.name} llegó antes y no quedan puestos: quedás de pie`);
      }
      me.tx = me.x; me.ty = me.y; me.moving = false;
      sendMoveNow();
      return;
    }
  }
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
    if (e.key === 'Enter' && !e.shiftKey) { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; chatAutoGrow(); chatInput.blur(); hideEmojiPicker(); updateSendMic(); e.preventDefault(); }
    // Shift+Enter: sin preventDefault, el <textarea> agrega el salto de línea solo
    if (e.key === 'Escape') { chatInput.value = ''; chatAutoGrow(); chatInput.blur(); hideEmojiPicker(); updateSendMic(); e.preventDefault(); }
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
    // OJO: nada de atajos con W/A/S/D — son las teclas de movimiento.
    // Compartir pantalla va solo por el botón 💻.
  if (e.key === 'Escape') { helpOverlay.classList.add('hidden'); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 3) { setStatus(STATUS_KEYS[n - 1]); return; }
  if (n === 4) { doZumbido(); return; }
  if (key === 'e') { accionE(); return; }
  const emoteMap = { z: '👋', x: '😂', c: '🎉', v: '👍', b: '🤔', n: '🔥' };
  const em = emoteMap[key];
  if (em) { send({ type: 'emote', id: state.myId, emote: em }); const me = state.players.get(state.myId); if (me) { me.emote = em; me.emoteUntil = performance.now() + 3000; } return; }
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
// Primero el puesto propio; si lo agarraron, cualquiera que esté libre; y si
// están los cuatro ocupados devuelve null => se entra DE PIE (nunca sentado
// arriba de otro). Usa el mismo criterio que seatOwner: cuenta solo a los que
// están realmente sentados y siguen conectados.
function seatFor(entry) {
  const pref = SEATS[entry && entry.seat != null ? entry.seat : -1];
  if (pref && !seatOwner(pref, state.myId)) return pref;
  for (const s of SEATS) if (!seatOwner(s, state.myId)) return s;
  return null;
}
async function join() {
  if (state.spectating || spectatorCheckBusy) return;
  // Si las notificaciones quedaron prendidas de otra sesión pero el navegador
  // nunca confirmó el permiso, se pide ahora, dentro del gesto de este click.
  if (notifCfg.on && notifHayApi() && Notification.permission === 'default') {
    try { Notification.requestPermission().then(notifRenderBtn); } catch { /* navegador viejo */ }
  }
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
  const entry = await entryPorDni(dni);
  if (!entry) { dniError('⛔ DNI no autorizado: la oficina es privada del equipo.'); return; }
  spectatorFailures = 0;
  const dup = [...state.players.values()].find((p) => p.char === entry.char && p.id !== state.myId && performance.now() - (p.seen || 0) < 9000);
  if (dup) { dniError(`⚠️ ${entry.name} ya está en la oficina desde otro dispositivo.`); return; }
  dniError('');
  state.spectating = false; document.body.classList.remove('spectator-mode');
  spectatorWhisperBacklog.length = 0;
  state.myChar = entry.char; state.myName = entry.name; state.joined = true; state.joinTs = state.joinTs || Date.now();
  histIniciar(dni);   // arranca a contar esta sesión (y cierra la anterior si quedó colgada)
  if (USE_P2P) state.myId = entry.char;
  const seat = seatFor(entry);
  const pie = seat ? null : puntoDePie();   // oficina llena: se entra parado
  const sx = seat ? seat.x : pie.x, sy = seat ? seat.y : pie.y;
  const me = {
    id: state.myId || 'me', name: entry.name, char: entry.char, color: 0,
    x: sx, y: sy, tx: sx, ty: sy,
    dir: seat ? seat.face : 'up', moving: false, seated: !!seat,
    status: seat ? 'codeando' : 'disponible',
    bubble: null, bubbleUntil: 0, emote: null, emoteUntil: 0, wave: false, waveUntil: 0,
  };
  if (state.myId) state.players.set(state.myId, me);
  if (me.seated) for (const n of animDe(me.char)) animCargar(me.char, n);   // entró ya sentado: ídem sentarseE
  joinOverlay.classList.add('hidden');
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch {}
  // El ROSTER no guarda el DNI: mandamos el hash. En servidor lo valida
  // server.js contra el suyo; en P2P a los demás no les hace falta (usan
  // name/char/color), y antes salía EN CLARO por los relays públicos.
  send({ type: 'profile', id: state.myId, name: entry.name, char: entry.char, dniHash: entry.dniHash });
  sendMoveNow();
  if (seat) { setStatus('codeando', true); addChat(null, 'Te sentaste en tu puesto 💻 — WASD para levantarte', 'system'); }
  else {
    addChat(null, '🪑 Los cuatro escritorios están ocupados: entrás de pie. Cuando alguno se libere, acercate y tocá E para sentarte', 'system');
    toast('🪑 No quedan puestos: entrás de pie');
  }
  addChat(null, `¡Bienvenido/a a la oficina, ${entry.name}! Presioná H para la ayuda.`, 'system');
  try {
    if (!localStorage.getItem('ovNotifBienvenida')) {
      localStorage.setItem('ovNotifBienvenida', '1');
      addChat(null, '🔔 Las notificaciones estilo Messenger ya vienen PRENDIDAS: si no las querés, tocá la campana de arriba', 'system');
    }
  } catch { /* incógnito: no se insiste */ }
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
  const btnEEl = document.getElementById('btnE');
  const knobEl = document.getElementById('stickKnob');
  // Los cuatro botones de arriba (radio, micro, cámara y pantalla) tienen que
  // quedar con la MISMA separación entre ellos. El de la radio vivía dentro de
  // #topbar y los otros tres en #callBar, así que cada grupo ponía su propio
  // gap y entre la radio y el micro quedaba un hueco distinto (7px contra 6px).
  // Se moves el mismo botón de un contenedor al otro según el modo: en el celu
  // los cuatro van juntos en una sola fila; en escritorio vuelve a su lugar de
  // siempre, arriba a la izquierda junto al reloj.
  const musicEl = document.getElementById('musicBtn');
  const topEl = document.getElementById('topbar');
  const callBarEl = document.getElementById('callBar');
  if (musicEl && topEl && callBarEl) {
    const destino = mob ? callBarEl : topEl;
    if (musicEl.parentElement !== destino) {
      if (mob) callBarEl.insertBefore(musicEl, callBarEl.firstChild);
      else topEl.appendChild(musicEl);
    }
  }
  const relojEl = document.getElementById('clock');
  if (relojEl) relojEl.style.maxWidth = '';
  if (!mob) {
    if (stickEl) { stickEl.style.top = ''; stickEl.style.bottom = ''; stickEl.style.width = ''; stickEl.style.height = ''; }
    if (knobEl) { knobEl.style.width = ''; knobEl.style.height = ''; knobEl.style.margin = ''; }
    if (btnEEl) {
      btnEEl.style.top = ''; btnEEl.style.bottom = ''; btnEEl.style.left = ''; btnEEl.style.right = '';
      btnEEl.style.width = ''; btnEEl.style.height = ''; btnEEl.style.lineHeight = ''; btnEEl.style.fontSize = '';
      btnEEl.style.display = '';
    }
    if (chatEl) { chatEl.style.top = ''; chatEl.style.bottom = ''; chatEl.style.right = ''; }
    return;
  }
  // ---- v113: la pantalla del celu, de arriba hacia abajo:
  //   1) la barra con el reloj y los cuatro botones
  //   2) la FILA DE CÁMARAS, que subió de la franja de abajo (entre la oficina y
  //      el chat) a la de arriba: los cuadros de estado y el panel de jugadores
  //      ya no se muestran en el celu, así que ese espacio quedó libre y los
  //      cuadros se agrandan (de 88px a 116px) y usan todo el ancho.
  //   3) la oficina, centrada en lo que queda en el medio
  //   4) el chat a la izquierda y el círculo con el joystick a la derecha
  const h = canvas.height;
  const vw = window.innerWidth;
  const stripEl = document.getElementById('camStrip');

  // ---- El círculo: el aro es el joystick y la E va chiquita en el centro.
  // Chiquita a propósito: si se come el centro, el pulgar cae siempre en la E y
  // el personaje no se mueve (que es lo que pasó con la E de 46px).
  const MARGEN = 10, CHAT_GAP = 6;
  const STICK_MAX = 118, STICK_MIN = 106, E_PORC = 0.30;   // aro libre (118-35)/2 = 41px de radio
  let sS = Math.round(Math.max(STICK_MIN, Math.min(STICK_MAX, vw * 0.33)));
  const stickLeft = Math.round(vw - MARGEN - sS);
  // El chat cede el ancho justo para que el círculo no lo pise.
  if (chatEl) chatEl.style.right = (vw - stickLeft + CHAT_GAP) + 'px';

  // ---- Reparto vertical. La barra de arriba manda (los cuatro botones no
  // tienen que sobresalir por debajo del reloj), después los cuadros de las
  // cámaras, la oficina en el medio y el chat abajo.
  const barraBottom = callBarEl ? callBarEl.getBoundingClientRect().bottom : 46;
  const FILM_IDEAL = 140, FILM_MIN = 56;
  // Un solo aire para todos los cortes: barra -> fila de cámaras -> oficina. Con
  // el mismo margen en los tres, los bloques se leen parejos.
  const AIRE = 12;
  // La oficina nunca se comprime más de lo que ya se comprime por el ancho: si
  // la franja del medio es más corta que su alto natural, se achica (pero no de
  // más). Así los cuadros de las cámaras pueden usar el alto que necesitan sin
  // deformar la oficina.
  const ESCENA_MIN = Math.round(Math.min(280, VH * vw / VW));
  const CHAT_MAX = 300, CHAT_MIN = 150;
  const hayCam = stripEl && !stripEl.hidden;
  const tiraTop = Math.round(barraBottom + AIRE);
  // Los cuadros de las cámaras se quedan con su alto ideal (116px, antes eran
  // 88 abajo) y el chat toma lo que sobre, nunca menos de CHAT_MIN. Así, en los
  // celus de altura normal los cuadros van bien grandes y el chat igual crece
  // porque la franja de abajo ahora la tienen ellos dos.
  const paraFilm = hayCam ? h - tiraTop - 8 - ESCENA_MIN - 12 - CHAT_MIN : 0;
  const film = Math.round(Math.max(FILM_MIN, Math.min(FILM_IDEAL, paraFilm)));
  const tiraBottom = hayCam && film >= FILM_MIN ? tiraTop + film : barraBottom + AIRE;
  const altoChat = Math.round(Math.max(CHAT_MIN, Math.min(CHAT_MAX, h - tiraBottom - AIRE - ESCENA_MIN - 12)));
  const chatTop = h - 8 - altoChat;

  // La fila de cámaras: ahora arriba, con todo el ancho (el joystick ya no está
  // al lado, está abajo). Scrollea con el dedo si entra más gente.
  if (stripEl) {
    if (!hayCam) {
      stripEl.style.display = '';
    } else if (film >= FILM_MIN) {
      stripEl.style.display = '';
      stripEl.style.left = '8px';
      stripEl.style.right = 'auto';
      stripEl.style.top = tiraTop + 'px';
      stripEl.style.width = (vw - 16) + 'px';
      stripEl.style.height = film + 'px';
      stripEl.style.flexDirection = 'row';
      for (const el of stripEl.children) {
        el.style.width = film + 'px';
        el.style.height = film + 'px';
        el.style.flex = '0 0 auto';
      }
    } else {
      stripEl.style.display = 'none';
    }
  }

  // La oficina se dibuja en la franja del medio. Antes se centraba en toda la
  // pantalla y por eso quedaba aire abajo; ahora se centra entre los cuadros y
  // el chat, así que la pantalla se reparte parejo.
  // La oficina se pega justo debajo de la fila de cámaras (mismo aire que el de
  // arriba) y el sobrante queda entre la oficina y el chat, que es la separación
  // natural entre la oficina y la zona de mensajes.
  const zonaTop = tiraBottom + AIRE;
  const zonaAlto = Math.max(160, chatTop - AIRE - zonaTop);
  const escala = Math.min(vw / VW, zonaAlto / VH);
  viewScale = escala;
  viewOX = (vw - VW * escala) / 2;
  viewOY = zonaTop;
  backdropDirty = true;   // el fondo se repinta con la oficina en su nuevo lugar

  // El círculo, centrado en la franja del chat (abajo a la derecha), así queda
  // al nivel del chat y sin invadir los cuadros de arriba.
  const libre = altoChat + 6;
  if (libre < sS + 10) sS = Math.max(80, Math.round(libre - 10));
  const stickTop = Math.round(chatTop - 6 + (libre - sS) / 2);
  if (stickEl) {
    stickEl.style.top = stickTop + 'px';
    stickEl.style.bottom = 'auto';
    stickEl.style.left = stickLeft + 'px';
    stickEl.style.right = 'auto';
    stickEl.style.width = sS + 'px';
    stickEl.style.height = sS + 'px';
  }
  const eFinal = Math.round(sS * E_PORC);
  if (knobEl) {
    // el knob va centrado con márgenes negativos: hay que recalcularlo para que
    // siga centrado en el aro nuevo
    const kS = Math.round(sS * 0.30);
    knobEl.style.width = kS + 'px';
    knobEl.style.height = kS + 'px';
    knobEl.style.margin = (-kS / 2) + 'px 0 0 ' + (-kS / 2) + 'px';
  }
  if (btnEEl) {
    // display:block explicito, nunca ''. La regla base es display:none, asi que
    // limpiar el estilo lo dejaba invisible en el celu (ya paso).
    btnEEl.style.display = 'block';
    btnEEl.style.left = Math.round(stickLeft + (sS - eFinal) / 2) + 'px';
    btnEEl.style.right = 'auto';
    btnEEl.style.top = Math.round(stickTop + (sS - eFinal) / 2) + 'px';
    btnEEl.style.bottom = 'auto';
    btnEEl.style.width = eFinal + 'px';
    btnEEl.style.height = eFinal + 'px';
    btnEEl.style.lineHeight = (eFinal - 4) + 'px';
    btnEEl.style.fontSize = Math.round(eFinal * 0.37) + 'px';
  }
  if (chatEl) {
    chatEl.style.top = Math.round(chatTop) + 'px';
    chatEl.style.bottom = ''; // el CSS móvil lo deja a 8px del borde, al lado de los controles
  }
  // El reloj se come justo el ancho que sobra hasta la barra de los cuatro
  // botones: así entra entero siempre que pueda, y solo se recorta (con
  // puntitos) en las pantallas más angostas.
  if (relojEl && callBarEl) {
    const barraX = callBarEl.getBoundingClientRect().left;
    const relojX = relojEl.getBoundingClientRect().left;
    const anchoLibre = Math.floor(barraX - relojX - 6);
    relojEl.style.maxWidth = (anchoLibre >= 60 ? anchoLibre : 60) + 'px';
  }
}
window.addEventListener('resize', resize);

const skyCv = document.createElement('canvas');
skyCv.width = WIN.w; skyCv.height = WIN.h;
// ---------- Clima real de Córdoba en el ventanal ----------
// Open-Meteo: gratis, sin API key y con CORS abierto. Se consulta cada 10
// minutos; si falla, el ventanal queda como siempre (despejado). Como todos
// consultan el mismo clima, todos ven lo mismo sin mensajes de por medio.
const clima = { tipo: 'despejado', nubes: 0, ok: false, rayo: 0, om: null, wt: null };
// Doble fuente: Open-Meteo (modelo) + wttr.in (observación). El modelo a veces
// no ve la lluvia que está cayendo de verdad, así que combinamos y gana la
// condición MÁS severa. Ambas gratis, sin API key y con CORS abierto.
const CLIMA_RANGO = { despejado: 0, niebla: 1, llovizna: 2, nieve: 3, lluvia: 3, tormenta: 4 };
function climaCombinar() {
  const fu = [clima.om, clima.wt].filter(Boolean);
  if (!fu.length) return;
  let peor = fu[0];
  for (const f of fu) if (CLIMA_RANGO[f.tipo] > CLIMA_RANGO[peor.tipo]) peor = f;
  clima.tipo = peor.tipo;
  clima.nubes = Math.max(...fu.map((f) => f.nubes));
  clima.ok = true;
}
function climaTipoWMO(c) {
  if (c >= 95) return 'tormenta';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'lluvia';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'nieve';
  if (c >= 51 && c <= 57) return 'llovizna';
  if (c === 45 || c === 48) return 'niebla';
  return 'despejado';
}
function climaTipoWWO(c, mm) {
  // Códigos WorldWeatherOnline (los que usa wttr.in) + mm de precipitación
  if ([200, 386, 389, 392, 395].includes(c)) return 'tormenta';
  if ([179, 182, 185, 227, 230, 320, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377].includes(c)) return 'nieve';
  if ([299, 302, 305, 308, 356, 359].includes(c) || mm >= 2) return 'lluvia';
  if ([176, 263, 266, 281, 284, 293, 296, 311, 314, 317, 353].includes(c)) return mm >= 1 ? 'lluvia' : 'llovizna';
  if (mm > 0) return 'llovizna';
  if ([143, 248, 260].includes(c)) return 'niebla';
  return 'despejado';
}
function climaTraer() {
  fetch('https://api.open-meteo.com/v1/forecast?latitude=-31.42&longitude=-64.18&current=weather_code,cloud_cover,precipitation')
    .then((r) => r.json())
    .then((j) => {
      if (!j || !j.current) return;
      let tipo = climaTipoWMO(j.current.weather_code | 0);
      if (tipo === 'despejado' && (j.current.precipitation || 0) > 0) tipo = 'llovizna';
      clima.om = { tipo, nubes: (j.current.cloud_cover || 0) / 100 };
      climaCombinar();
    })
    .catch(() => { /* sin esta fuente: queda la otra o ventanal normal */ });
  fetch('https://wttr.in/-31.42,-64.18?format=j1')
    .then((r) => r.json())
    .then((j) => {
      const c = j && j.current_condition && j.current_condition[0];
      if (!c) return;
      clima.wt = { tipo: climaTipoWWO(+c.weatherCode || 0, parseFloat(c.precipMM) || 0), nubes: (+c.cloudcover || 0) / 100 };
      climaCombinar();
    })
    .catch(() => { /* idem */ });
}
climaTraer();
setInterval(climaTraer, 10 * 60 * 1000);
function climaTipo() { return clima.tipo; }
function climaEmoji() {
  if (!clima.ok) return '';
  const t = climaTipo();
  if (t === 'tormenta') return '⛈';
  if (t === 'lluvia') return '🌧';
  if (t === 'llovizna') return '🌦';
  if (t === 'nieve') return '❄️';
  if (t === 'niebla') return '🌫';
  if (clima.nubes > 0.65) return '☁️';
  return '';
}

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
    // Con cielo cubierto el sol apenas se adivina detrás de las nubes
    g.globalAlpha = clima.ok ? Math.max(0.06, 1 - clima.nubes * 0.92) : 1;
    g.fillStyle = 'rgba(255,215,106,0.35)'; g.beginPath(); g.arc(sx, sy, 8, 0, 7); g.fill();
    g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
    g.globalAlpha = 1;
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
  // Cielo encapotado: velo gris sobre cielo y sol según la cobertura REAL de
  // nubes; con lluvia/tormenta el gris es más oscuro y plomizo.
  if (clima.ok && clima.nubes > 0.25) {
    const tw = climaTipo();
    const plomizo = tw === 'tormenta' || tw === 'lluvia' || tw === 'llovizna';
    const a = clima.nubes * (plomizo ? 0.72 : 0.55) * (1 - sky.star * 0.55);
    g.fillStyle = plomizo ? `rgba(86,94,110,${a.toFixed(2)})` : `rgba(150,158,170,${a.toFixed(2)})`;
    g.fillRect(0, 0, W, H);
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
  // ---- Clima real por encima del skyline (y debajo del marco) ----
  if (clima.ok) {
    const tipo = climaTipo();
    const extra = Math.round(clima.nubes * 10);
    const oscura = tipo === 'tormenta' || tipo === 'lluvia' || tipo === 'llovizna';
    for (let i = 0; i < extra; i++) {
      const cx = ((now * (0.005 + i * 0.0012) + i * 53) % (W + 80)) - 40;
      const cy = 3 + rnd(i, 51, 8) * (H * 0.5);
      g.fillStyle = oscura ? 'rgba(64,72,88,0.8)' : `rgba(214,220,230,${(0.5 + clima.nubes * 0.3).toFixed(2)})`;
      g.fillRect(cx, cy, 44, 6); g.fillRect(cx + 7, cy - 3, 28, 3); g.fillRect(cx + 10, cy + 6, 24, 3);
    }
    if (tipo === 'niebla') {
      g.fillStyle = 'rgba(190,198,208,0.30)'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(190,198,208,0.40)'; g.fillRect(0, H * 0.4, W, H * 0.6);
    }
    if (tipo === 'lluvia' || tipo === 'llovizna' || tipo === 'tormenta') {
      const nGotas = tipo === 'llovizna' ? 26 : 60;
      g.strokeStyle = tipo === 'llovizna' ? 'rgba(190,210,235,0.35)' : 'rgba(170,195,230,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < nGotas; i++) {
        const rx = (rnd(i, 61, 4) * W + now * (0.12 + rnd(i, 67, 2) * 0.1)) % W;
        const ry = (rnd(i, 71, 6) * H + now * (0.25 + rnd(i, 73, 3) * 0.15)) % H;
        g.moveTo(rx, ry); g.lineTo(rx - 1.5, ry + 5);
      }
      g.stroke();
    }
    if (tipo === 'nieve') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 34; i++) {
        const rx = (rnd(i, 81, 4) * W + Math.sin(now * 0.001 + i) * 6 + now * 0.01) % W;
        const ry = (rnd(i, 83, 6) * H + now * (0.02 + rnd(i, 87, 3) * 0.02)) % H;
        g.fillRect(rx, ry, 1.5, 1.5);
      }
    }
    if (tipo === 'tormenta') {
      // Relámpago: destello local, no hace falta sincronizarlo (es ambiente)
      if (now > clima.rayo && Math.random() < 0.005) clima.rayo = now + 160;
      if (now < clima.rayo) {
        g.fillStyle = `rgba(240,245,255,${(0.5 + Math.random() * 0.3).toFixed(2)})`;
        g.fillRect(0, 0, W, H);
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
      const cafeBoost = me.cafeUntil && performance.now() < me.cafeUntil ? 1.45 : 1;
      const sp = SPEED * cafeBoost * clamp(depthScale(me.y) / 12, 0.35, 1.6);
      const nx = me.x + dx * sp * dt, ny = me.y + dy * sp * dt;
      if (walkable(nx, me.y)) me.x = nx;
      if (walkable(me.x, ny)) me.y = ny;
      me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      me.moving = true;
    } else {
      // Ya no hay auto-sentado: sentarse es con E cerca de un escritorio.
      me.moving = false;
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
        notify('joinleave', p.name, 'salió de la oficina', p.char, 'leave');
        renderPlayerList();
      }
    }
  }

  const near = nearestPlayer();
  if (near) {
    hintBox.innerHTML = `Cerca de <b>${esc(near.name)}</b> — <span class="key">/w ${esc(near.name)} msg</span> susurrar`;
    hintBox.classList.add('show');
  } else if (state.joined && cafeCerca()) {
    const soyMilo = (state.players.get(state.myId) || {}).char === 'milo';
    hintBox.innerHTML = soyMilo
      ? `🥤 <b>Cafetera</b> — <span class="key">E</span> una coquita bien fría`
      : `☕ <b>Cafetera</b> — <span class="key">E</span> tomar un cafecito`;
    hintBox.classList.add('show');
  } else if (state.joined && seatLibreCerca()) {
    hintBox.innerHTML = `🪑 <b>Escritorio</b> — <span class="key">E</span> sentarte`;
    hintBox.classList.add('show');
  } else if (state.joined && catCerca()) {
    hintBox.innerHTML = `🐈 <b>Michi</b> — <span class="key">E</span> acariciar`;
    hintBox.classList.add('show');
  } else hintBox.classList.remove('show');
  // El botón de acción del celu brilla cuando hay algo para hacer cerca
  const be = document.getElementById('btnE');
  if (be) be.classList.toggle('activo', !!(state.joined && (cafeCerca() || seatLibreCerca() || catCerca())));
}

// ---------- Cafetera: un cafecito da energía (velocidad) por un rato ----------
// Apoyada sobre la credenza, a la derecha de la biblioteca. Con E cerca de
// ella tomás un café: buff de velocidad por 25 s y tacita al lado del
// personaje. El evento 'cafe' viaja por el bus para que todos vean el buff
// ajeno y la máquina preparando.
const CAFE = { x: 512, y: 465, brewUntil: 0 };
const CAFE_MS = 25000;
function cafeCerca() {
  // Radio chico a propósito: hay que pegarse BIEN a la cafetera (muy atrás,
  // contra el ventanal) para que la E no le robe la acción al escritorio cercano.
  const me = state.players.get(state.myId);
  return me && Math.hypot(me.x - CAFE.x, me.y - CAFE.y) < 48;
}
// Botón de acción (tecla E en PC, botón redondo en el celu).
// Prioridad: cafetera > escritorio > Michi.
function accionE() {
  if (!state.joined) return;
  if (cafeCerca()) { cafeTomar(); return; }
  // Sentarse conserva prioridad: aun en modo pelea, al acercarse a cualquier PC
  // la E usa la silla. Lejos de un escritorio, la misma E tira el golpe siguiente.
  if (sentarseE()) return;
  const me = state.players.get(state.myId);
  if (me && me.fightMode && !me.seated) { fightGolpePedir(); return; }
  catMimar();
}
function cafeTomar() {
  if (!state.joined || !cafeCerca()) return;
  send({ type: 'cafe', id: state.myId });
  cafeAplicar(state.myId);
}
function cafeAplicar(id) {
  const p = state.players.get(id);
  if (!p) return;
  p.cafeUntil = performance.now() + CAFE_MS;
  if (p.char === 'milo') p.tomaUntil = performance.now() + 2200;  // Milo es niño: toma una coquita 🥤
  CAFE.brewUntil = performance.now() + 2600;
  beep(620, 0.05, 0.03); setTimeout(() => beep(760, 0.06, 0.03), 110);  // ¡café listo!
}
// ---------- Animaciones sentado (tomar algo en la silla) ----------
// Cuatro dibujos por animación y por persona: agarra lo que sea, dos sorbos,
// y lo baja con cara de gusto. Sólo existen sentado, porque el PNG trae la
// silla adentro (igual que `<char>_sit.png`, y alineados contra ese mismo
// dibujo para que no pegue un salto al empezar).
//
// Para sumar una animación: dejar los `sprites/<char>_<nombre>1..4.png`
// (preparados con preparar-animacion.py, que los alinea contra el sentado) y
// agregar la entrada acá. Nada más.
const ANIMS = {
  cafe:  { titulo: '☕ Tomar un café',   quien: { ger: 4 } },
  birra: { titulo: '🍺 Tomar una birra', quien: { ger: 4 } },
};
// Guion compartido: [qué dibujo, cuánto dura].
const ANIM_GUION = [[1, 520], [2, 440], [3, 700], [2, 340], [4, 940]];
const ANIM_MS = ANIM_GUION.reduce((t, [, ms]) => t + ms, 0);
const ANIM_FUNDIDO = 180;    // ms de cruce con el sentado normal, en cada punta
const ANIM_ESPERA = 20000;   // hasta cuánto se espera a que bajen los dibujos
const animImgs = {};         // `${char}_${nombre}` -> [Image]
const animFlip = {};         // `${char}_${nombre}_${face}_${i}` -> canvas espejado
let animBajando = false;     // una tanda por vez: nunca dos bajando a la par

function animHay(char, nombre) { return !!(ANIMS[nombre] && ANIMS[nombre].quien[char]); }
function animDe(char) { return Object.keys(ANIMS).filter((n) => animHay(char, n)); }

// Cada tanda son ~2 MB. El navegador abre 6 conexiones por dominio: si se
// piden mientras todavía bajan la oficina y los dibujos de todos, le roban la
// mitad del caño a lo importante y el que entra ve la oficina en negro. Por
// eso esperan a assetsReady, bajan DE A UNO y de a una tanda por vez.
function animCargar(char, nombre) {
  const k = `${char}_${nombre}`;
  if (!animHay(char, nombre) || animImgs[k]) return;
  if (!assetsReady || animBajando) { setTimeout(() => animCargar(char, nombre), 500); return; }
  animBajando = true;
  const fs = [];
  animImgs[k] = fs;
  const siguiente = (i) => {
    if (i > ANIMS[nombre].quien[char]) { animBajando = false; return; }
    const im = new Image();
    if ('fetchPriority' in im) im.fetchPriority = 'low';
    im.onload = im.onerror = () => siguiente(i + 1);
    im.src = urlAsset(`sprites/${char}_${nombre}${i}.png`);
    fs.push(im);
  };
  siguiente(1);
}
function animLista(char, nombre) {
  const fs = animImgs[`${char}_${nombre}`];
  // El largo también: bajan de a uno, y `[].every` sobre una lista a medio
  // llenar da true y la animación arrancaría con dos dibujos.
  return !!fs && animHay(char, nombre) && fs.length === ANIMS[nombre].quien[char]
    && fs.every((im) => im.complete && im.naturalWidth);
}
function animCuadro(char, nombre, face, i) {
  const im = animImgs[`${char}_${nombre}`][i];
  if (face === (SIT_BASE_FACE[char] || 'right')) return im;
  const k = `${char}_${nombre}_${face}_${i}`;
  if (!animFlip[k]) animFlip[k] = flipCanvas(im);
  return animFlip[k];
}
// Qué dibujar en este instante: el cuadro del guion y cuánto pesa contra el
// sentado normal (0 = sentado, 1 = animación). Null si no hay nada.
function animEstado(p, now, face) {
  if (!p.animIni || !p.animNombre || !p.seated) return null;
  const t = now - p.animIni;
  if (t < 0 || t > ANIM_MS) { if (t > ANIM_MS) p.animIni = 0; return null; }
  if (!animLista(p.char, p.animNombre)) return null;   // todavía bajando
  let acum = 0, idx = 0;
  for (const [n, ms] of ANIM_GUION) { idx = n - 1; if (t < acum + ms) break; acum += ms; }
  const mezcla = Math.min(1, t / ANIM_FUNDIDO, (ANIM_MS - t) / ANIM_FUNDIDO);
  return { spr: animCuadro(p.char, p.animNombre, face, idx), mezcla };
}
// Nadie tiene bajados los dibujos de los demás (serían N personas por M
// animaciones), así que al llegar el aviso de que alguien está tomando algo
// se piden en el momento y la animación ARRANCA CUANDO LLEGAN, aunque sea
// unos segundos tarde. Es mejor verla corrida que no verla nunca.
function animAplicar(id, nombre) {
  const p = state.players.get(id);
  if (!p || !animHay(p.char, nombre)) return;
  if (animLista(p.char, nombre)) { p.animNombre = nombre; p.animIni = performance.now(); return; }
  animCargar(p.char, nombre);
  const desde = performance.now();
  const esperar = () => {
    if (!state.players.get(id)) return;                       // se fue
    if (animLista(p.char, nombre)) { p.animNombre = nombre; p.animIni = performance.now(); return; }
    if (performance.now() - desde < ANIM_ESPERA) setTimeout(esperar, 200);
  };
  setTimeout(esperar, 200);
}
// Lo pide el menú de acciones del propio personaje. Va por el bus para que el
// resto lo vea, igual que el café de la cafetera.
function animPedir(nombre) {
  const me = state.players.get(state.myId);
  if (!me) return;
  if (!me.seated) { toast('🪑 Esto es sentado: buscá una silla'); return; }
  if (!animHay(me.char, nombre)) { toast('🎬 Todavía no hay dibujos de este personaje'); return; }
  if (me.animIni && performance.now() - me.animIni < ANIM_MS) return;  // ya está tomando
  if (!animLista(me.char, nombre)) {
    // Si tarda, avisar: un botón que no hace nada parece roto.
    setTimeout(() => { if (!animLista(me.char, nombre)) toast('⏳ Bajando los dibujos…'); }, 400);
  }
  send({ type: 'anim', id: state.myId, anim: nombre });
  animAplicar(state.myId, nombre);
}

const miloToma = new Image();
miloToma.src = urlAsset('sprites/milo_toma.png');
const cafeImg = new Image();
cafeImg.src = urlAsset('sprites/cafetera.png');
function drawCafetera(now) {
  const g = ctx;
  const bx = CAFE.x, by = 389;  // sobre el sill del ventanal, donde estaba la maceta
  const brewing = performance.now() < CAFE.brewUntil;
  if (cafeImg.complete && cafeImg.naturalWidth) {
    const h = 40, w = h * (cafeImg.naturalWidth / cafeImg.naturalHeight);
    const sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cafeImg, bx - w / 2, by - h, w, h);
    g.imageSmoothingEnabled = sm;
  } else {
    // Fallback mientras carga el sprite
    g.fillStyle = '#232833'; g.fillRect(bx - 11, by - 26, 22, 26);
    g.fillStyle = '#2f3644'; g.fillRect(bx - 11, by - 26, 22, 4);
  }
  g.fillStyle = brewing ? '#ff5a5a' : '#54d16e';                      // LED de estado
  if (!brewing || Math.floor(now / 220) % 2) g.fillRect(bx + 11, by - 38, 2, 2);
  const puffs = brewing ? 3 : (Math.floor(now / 4000) % 3 === 0 ? 1 : 0);  // vapor
  g.fillStyle = 'rgba(235,240,248,0.6)';
  for (let i = 0; i < puffs; i++) {
    const t = ((now * 0.001 + i * 0.4) % 1.2) / 1.2;
    g.globalAlpha = 0.55 * (1 - t);
    g.fillRect(bx - 2 + Math.sin((t * 4 + i) * 3) * 2.5, by - 42 - t * 10, 2, 2);
  }
  g.globalAlpha = 1;
}

// ---------- Michi, el gato de la oficina ----------
// Simulación DETERMINÍSTICA por reloj: cada cliente calcula el mismo objetivo
// a partir del mismo segmento de Date.now(), así el gato está en el mismo
// lugar para todos SIN mandar mensajes. Lo único que viaja por el bus es la
// caricia ('cat-pet'), que lo pone a seguir un rato al que lo mimó.
const CAT_SEG = 26000;
const cat = { x: 612, y: 560, dir: 1, petBy: null, petUntil: 0, heartsUntil: 0, lastMiau: 0 };
function catPlan(nowMs, nocturno) {
  if (nocturno) return { goal: { x: 622, y: 706 }, pose: 'sleep' };  // de noche duerme en medio del pasillo, bien visible
  const i = Math.floor(nowMs / CAT_SEG);
  const r = rnd(i, 29, 3);
  if (r < 0.30) return { goal: { x: 575 + rnd(i, 31, 7) * 80, y: 590 + rnd(i, 37, 1) * 80 }, pose: 'sleep' };  // siesta al solcito
  const y = lerp(FLOOR.yTop + 130, FLOOR.yBot - 110, rnd(i, 17, 9));
  const t2 = (y - FLOOR.yTop) / (FLOOR.yBot - FLOOR.yTop);
  const xl = lerp(FLOOR.xlTop, FLOOR.xlBot, t2) + 46;
  const xr = lerp(FLOOR.xrTop, FLOOR.xrBot, t2) - 46;
  return { goal: { x: lerp(xl, xr, rnd(i, 13, 5)), y }, pose: r < 0.55 ? 'sit' : 'idle' };
}
function catFrame(nocturno) {
  let goal = null, pose = 'idle';
  if (cat.petBy && performance.now() < cat.petUntil) {
    const p = state.players.get(cat.petBy);
    if (p && p.status !== 'ausente') { goal = { x: p.x - 34, y: Math.min(FLOOR.yBot - 60, p.y + 4) }; pose = 'sit'; }
  }
  if (!goal) { const pl = catPlan(Date.now(), nocturno); goal = pl.goal; pose = pl.pose; }
  cat.x += (goal.x - cat.x) * 0.045;
  cat.y += (goal.y - cat.y) * 0.045;
  const moviendo = Math.hypot(goal.x - cat.x, goal.y - cat.y) > 7;
  if (moviendo) cat.dir = goal.x > cat.x ? 1 : -1;
  return moviendo ? 'walk' : pose;
}
function catCerca() {
  const me = state.players.get(state.myId);
  return me && Math.hypot(me.x - cat.x, me.y - cat.y) < 130;
}
function catMimar() {
  if (!state.joined || !catCerca()) return;
  send({ type: 'cat-pet', id: state.myId });
  catAplicarMimo(state.myId);
}
function catAplicarMimo(id) {
  cat.petBy = id;
  cat.petUntil = performance.now() + 9000;
  cat.heartsUntil = performance.now() + 3000;
  beep(430, 0.05); setTimeout(() => beep(350, 0.07), 130);  // ronroneo cortito
}
// Frames de caminata por personaje y dirección. Quieto usa SIEMPRE el sprite
// original; estos solo aparecen al moverse. Si falta la dirección se usa 'down'.
// Los PNG se guardan crudos acá y se normalizan cuando carga el sprite base del
// personaje (normalizarCaminata), para que todas las poses compartan el mismo
// alto de figura y el personaje no cambie de tamaño al empezar a caminar.
//
// REGLA AL AGREGAR FRAMES: el nombre tiene que decir hacia dónde mira el dibujo.
// _wl* mira a la IZQUIERDA y _wr* a la DERECHA, TODOS los frames de un mismo ciclo
// miran para el mismo lado. Ger venía con ger_wl2.png y ger_wr2.png guardados al
// revés, así que al caminar a la izquierda el ciclo era IZQ -> DER -> IZQ -> DER y
// el personaje daba media vuelta dos veces por vuelta (v100). Se corrigió
// intercambiando los dos archivos, no las referencias, para que el nombre no
// vuelva a mentir. Se verifica con: node tools/chequear-caminata.js
const walkAssets = {};
const walkSources = {};
// Secuencia de pelea de Ger: guardia, golpes y patada. Se carga con los demás
// movimientos y sólo se dibuja mientras dura la acción.
const fightFrames = [];
{
  // El ?v= se sube cada vez que cambia el CONTENIDO de un PNG con este nombre, o
  // el navegador sigue mostrando el viejo desde su caché. Al intercambiar
  // ger_wl2.png y ger_wr2.png cambiaron de contenido: el hash de assets.js se
  // encarga solo, ya no hay que subir un ?v= a mano
  const img = (n) => { const i = new Image(); i.src = urlAsset(`sprites/${n}.png`); return i; };
  for (let i = 1; i <= 6; i++) fightFrames.push(img(`ger_pelea${i}`));
  const g2 = img('ger_walk2'), g3 = img('ger_walk3'), g4 = img('ger_walk4');
  const gl1 = img('ger_wl1'), gl2 = img('ger_wl2'), gl3 = img('ger_wl3');
  const gr1 = img('ger_wr1'), gr2 = img('ger_wr2'), gr3 = img('ger_wr3');
  walkSources.ger = {
    down: [g2, g3, g4, g3],
    up: [img('ger_wu1'), img('ger_wu2')],
    left: [gl1, gl2, gl3, gl2],
    right: [gr1, gr2, gr3, gr2],
  };
  const l1 = img('milo_wl1'), l2 = img('milo_wl2'), l3 = img('milo_wl3');
  const r1 = img('milo_wr1'), r2 = img('milo_wr2'), r3 = img('milo_wr3');
  walkSources.milo = {
    down: [img('milo_wf1'), img('milo_wf2')],
    up: [img('milo_wu1'), img('milo_wu2')],
    left: [l1, l2, l3, l2],
    right: [r1, r2, r3, r2],
  };
  // Ovni (v101). No tiene 'down' a proposito: el frente sigue siendo el recorte
  // de papel sobre su PNG original, que es el dibujo bueno del personaje. La
  // hoja cubre solo las direcciones que antes no existian.
  const ol1 = img('ovni_wl1'), ol2 = img('ovni_wl2'), ol3 = img('ovni_wl3');
  const or1 = img('ovni_wr1'), or2 = img('ovni_wr2'), or3 = img('ovni_wr3');
  walkSources.ovni = {
    up: [img('ovni_wu1'), img('ovni_wu2')],
    left: [ol1, ol2, ol3, ol2],
    right: [or1, or2, or3, or2],
  };
  // Ove: hoja propia con las 4 direcciones. El perfil de la hoja mira a la
  // IZQUIERDA (wl) y el derecho es su espejo (wr), igual que Ger y Milo.
  const el1 = img('ove_wl1'), el2 = img('ove_wl2'), el3 = img('ove_wl3');
  const er1 = img('ove_wr1'), er2 = img('ove_wr2'), er3 = img('ove_wr3');
  walkSources.ove = {
    down: [img('ove_walk1'), img('ove_walk2'), img('ove_walk3'), img('ove_walk2')],
    up: [img('ove_wu1'), img('ove_wu2')],
    left: [el1, el2, el3, el2],
    right: [er1, er2, er3, er2],
  };
}
// Reescala todos los frames de caminata de un personaje al alto de su figura de
// referencia. Los que todavía no cargaron se normalizan solos al llegar.
function normalizarCaminata(k, alto) {
  const src = walkSources[k];
  if (!src) return;
  // No se pisa lo que ya haya: Ovni precarga 'down' con el recorte de papel y
  // esta funcion solo completa las direcciones que trae en walkSources.
  walkAssets[k] = walkAssets[k] || {};
  for (const dir of Object.keys(src)) {
    // El orden del ciclo es fijo (zancada → paso → ...), así que cada frame tiene
    // su lugar y el hueco queda en null hasta que la imagen termina de cargar: el
    // render, mientras tanto, usa el sprite quieto. Nada de dibujar el PNG crudo.
    const slots = walkAssets[k][dir] = new Array(src[dir].length).fill(null);
    src[dir].forEach((im, i) => {
      const aplicar = () => { slots[i] = normalizarFigura(im, alto).img; };
      if (im.complete && im.naturalWidth) aplicar();
      else im.addEventListener('load', aplicar, { once: true });
    });
  }
}

const FIGHT_FRAME_MS = 180;
const FIGHT_HIT_MS = 360;
function fightModoAplicar(id, activo) {
  const p = state.players.get(id);
  if (!p || p.char !== 'ger') return;
  p.fightMode = !!activo;
  if (!p.fightMode) { p.fightIni = 0; p.fightHit = 0; }
}
function fightModoPedir() {
  const me = state.players.get(state.myId);
  if (!me || me.char !== 'ger') return;
  if (me.seated) { toast('🥊 Primero levantate de la silla'); return; }
  const activo = !me.fightMode;
  send({ type: 'fight-mode', id: state.myId, active: activo });
  fightModoAplicar(state.myId, activo);
  toast(activo ? '🥊 Modo pelea activado · E para golpear' : '🕊️ Modo pelea desactivado');
}
function fightGolpeAplicar(id, golpe) {
  const p = state.players.get(id);
  if (!p || p.char !== 'ger' || !p.fightMode || p.seated) return;
  p.fightHit = Math.max(1, Math.min(5, Number(golpe) || 1));
  p.fightIni = performance.now();
}
function fightGolpePedir() {
  const me = state.players.get(state.myId);
  if (!me || !me.fightMode || me.seated) return;
  // Recorre puñetazos, guardia alta, patada y golpe largo en cada toque de E.
  const golpe = ((me.fightNext || 0) % 5) + 1;
  me.fightNext = golpe;
  send({ type: 'fight-hit', id: state.myId, hit: golpe });
  fightGolpeAplicar(state.myId, golpe);
}
function fightSprite(p, now) {
  if (!p || p.char !== 'ger' || !p.fightMode || p.seated) return null;
  let idx = 0; // guardia permanente mientras el modo está activado
  if (p.fightIni) {
    const t = now - p.fightIni;
    if (t >= 0 && t < FIGHT_HIT_MS) idx = p.fightHit || 1;
    else if (t >= FIGHT_HIT_MS) p.fightIni = 0;
  }
  const im = fightFrames[Math.max(0, Math.min(5, idx))];
  return im && im.complete && im.naturalWidth ? im : null;
}

// Sprites de Michi (hoja del usuario, recortada y con fondo transparente)
const catImgs = {};
for (const n of ['sleep', 'sit', 'stand_f', 'stand_l', 'stand_r', 'walk_l1', 'walk_l2', 'walk_l3', 'walk_r1', 'walk_r2', 'walk_r3', 'happy']) {
  const i = new Image(); i.src = urlAsset(`sprites/cat/${n}.png`); catImgs[n] = i;
}
function catMiau() {
  // Maullido sintetizado: sube ("mia...") y baja ("...au")
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t0);
    o.frequency.exponentialRampToValueAtTime(830, t0 + 0.16);
    o.frequency.exponentialRampToValueAtTime(310, t0 + 0.55);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(0.045, t0 + 0.06);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(gn); gn.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + 0.65);
  } catch { /* sin audio */ }
}
function drawCat(now, nocturno) {
  const pose = catFrame(nocturno);
  // Maullido de vez en cuando (determinístico por reloj: todos lo ven/escuchan a la vez).
  // Ventana de 9 s; ~15% de probabilidad → un miau por minuto aprox. Dormido no maúlla.
  const miauBkt = Math.floor(Date.now() / 9000);
  const miauT = Date.now() - miauBkt * 9000;
  const maullando = pose !== 'sleep' && rnd(miauBkt, 53, 11) < 0.15 && miauT < 1400;
  if (maullando && cat.lastMiau !== miauBkt) { cat.lastMiau = miauBkt; catMiau(); }
  const u = clamp(depthScale(cat.y) / 12, 0.65, 1.8) * 6.0;
  const g = ctx;
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(cat.x, cat.y + 1.5 * u, 7.5 * u, 2.2 * u, 0, 0, Math.PI * 2); g.fill();
  // Pose → sprite: dormido / caminando (ciclo de 3 frames por dirección) /
  // feliz con corazón (recién mimado) / sentado / parado de frente
  const corazon = performance.now() < cat.heartsUntil;
  let nombre, hpx;
  if (pose === 'sleep') { nombre = 'sleep'; hpx = 11; }
  else if (pose === 'walk') { nombre = (cat.dir > 0 ? 'walk_r' : 'walk_l') + (1 + Math.floor(now / 160) % 3); hpx = 14; }
  else if (corazon) { nombre = 'happy'; hpx = 16; }
  else if (pose === 'sit') { nombre = 'sit'; hpx = 15; }
  else { nombre = 'stand_f'; hpx = 15; }
  const img = catImgs[nombre];
  if (img && img.complete && img.naturalWidth) {
    let h = hpx * u;
    if (nombre === 'sleep') h *= 1 + Math.sin(now * 0.002) * 0.04;  // respira
    const w = h * (img.naturalWidth / img.naturalHeight);
    const sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, cat.x - w / 2, cat.y - h + 2 * u, w, h);
    g.imageSmoothingEnabled = sm;
  } else {
    // Fallback mientras cargan los sprites
    g.fillStyle = '#8d8d99'; g.fillRect(cat.x - 6 * u, cat.y - 5 * u, 12 * u, 6 * u);
  }
  if (performance.now() < cat.heartsUntil) {
    const k = 1 - (cat.heartsUntil - performance.now()) / 3000;
    g.globalAlpha = 1 - k;
    g.fillStyle = '#ff6b81';
    g.font = `${Math.round(8 * u)}px monospace`;
    g.fillText('❤', cat.x + 6 * u, cat.y - (16 + k * 14) * u);
    g.fillText('❤', cat.x - 9 * u, cat.y - (12 + k * 18) * u);
    g.globalAlpha = 1;
  }
  if (pose === 'sleep') {
    const zt = (now % 1500) / 1500;
    g.globalAlpha = 0.7 * (1 - zt);
    g.fillStyle = '#cfe3ff';
    g.font = `${Math.round(6 * u)}px monospace`;
    g.fillText('z', cat.x + 8 * u, cat.y - (10 + zt * 8) * u);
    g.globalAlpha = 1;
  }
  if (maullando) {
    const k = miauT / 1400;
    g.globalAlpha = 0.95 * (1 - k * k);
    g.font = `bold ${Math.round(6.5 * u)}px monospace`;
    g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 3;
    g.fillStyle = '#ffd9a0';
    const mx = cat.x - 11 * u, my = cat.y - (18 + k * 4) * u;
    g.strokeText('miau~', mx, my);
    g.fillText('miau~', mx, my);
    g.globalAlpha = 1;
  }
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

  drawCafetera(now);
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

  const nocturno = sky.amb > 0.24;
  let catDibujado = false;
  const list = [...state.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!p.name) continue;
    if (p.status === 'ausente') continue; // 🏃 ¡Ya vengo!: el personaje se va de la escena (sigue en la lista y su puesto queda reservado)
    if (!catDibujado && cat.y < p.y) { drawCat(now, nocturno); catDibujado = true; }
    let topY, shR, fs;
    if (p.seated) {
      const ss = sitScale(p.y);
      const sframe = Math.floor(now / 280) % 2;
      const face = p.x < VW / 2 ? 'left' : 'right';
      const spr = getSitSprite(p.char || 'ger', face, true, sframe);
      // Conserva la proporción natural de cada conjunto personaje + silla gamer.
      const h = 48 * ss * ((CHAR_DEF[p.char || 'ger'] || {}).kid ? 0.9 : 1), w = h * (spr.width / spr.height);
      ctx.imageSmoothingEnabled = true;              // sprites sentados de alta resolución
      ctx.imageSmoothingQuality = 'high';
      const bob = charAssets[p.char || 'ger'] && charAssets[p.char || 'ger'].sit ? (sframe ? h / SIT_H * 2 : 0) : 0;
      const taza = animEstado(p, now, face);
      if (taza) {
        // Los dibujos de la animación están alineados contra el sentado, así que van
        // en la misma caja. El sentado va siempre opaco y la animación se apoya
        // encima con su alfa: el cruce de 180 ms evita el salto sin que el fondo
        // se transparente en el medio (antes se atenuaban los dos a la vez y la
        // opacidad combinada bajaba a 0,75).
        // El sentado no lleva el rebote de respiración mientras tanto: sumaría
        // un temblor vertical arriba del cruce.
        const wt = h * (taza.spr.width / taza.spr.height);
        ctx.globalAlpha = 1;
        ctx.drawImage(spr, p.x - w / 2, p.y - h, w, h);
        if (taza.mezcla > 0) {
          ctx.globalAlpha = taza.mezcla;
          ctx.drawImage(taza.spr, p.x - wt / 2, p.y - h, wt, h);
          ctx.globalAlpha = 1;
        }
      } else ctx.drawImage(spr, p.x - w / 2, p.y - h + bob, w, h);
      topY = p.y - h; shR = 15 * ss; fs = Math.round(3.1 * ss);
    } else {
      const spr = getSprite(p.char || 'ger', p.dir || 'down', 0);
      const ca = charAssets[p.char || 'ger'] || {};
      const conAsset = !!ca.down;   // ídem: lo que importa es si ESTE ya llegó
      // La altura en pantalla no cambia respecto al sprite por código (44*s).
      // El tope de escala sale SIEMPRE del alto de figura del sprite base (de
      // frente), no del sprite de la dirección actual: la espalda mide 700 px
      // contra 493 del frente, así que con el tope por dirección el personaje se
      // dibujaba hasta 42% más alto al caminar hacia arriba. Como todos los PNG
      // pasan por normalizarFigura(), la figura ocupa todo el lienzo y el mismo
      // 44*s da el mismo alto de cabeza a pies en cualquier pose.
      const sRaw = depthScale(p.y);
      const baseH = ca.baseH || spr.height;
      // El tope sale del sprite DE ESTA persona, no de assetsReady, que recién
      // se prende cuando terminaron de bajar los dibujos de los cinco (13 MB).
      // Mirando la bandera global, el que ya tenía su sprite se dibujaba sin
      // tope mientras cargaba el resto: salía GIGANTE arriba de la oficina
      // todavía en negro, y parecía que se había roto todo.
      const s = ca.down ? Math.min(sRaw, baseH / 44) : sRaw;
      // Ciclo de caminata real si el personaje tiene frames: zancada derecha →
      // paso → zancada izquierda → paso. El tamaño (s) sale del sprite base
      // para que no cambie la altura al arrancar o frenar.
      let dspr = fightSprite(p, now) || spr;
      const peleando = dspr !== spr;
      const wa = walkAssets[p.char || 'ger'];
      if (!peleando && p.moving && wa) {
        const arr = wa[p.dir] || wa.down;
        if (arr && arr.length) {
          const wi = arr[Math.floor(now / 160) % arr.length];
          // Los frames normalizados son canvas (sin .complete/.naturalWidth): basta
          // con que el hueco esté lleno. El hueco vacío cae al sprite quieto.
          if (wi && wi.width) dspr = wi;
        }
      }
      if (!p.moving && p.char === 'milo' && p.tomaUntil && now < p.tomaUntil && miloToma.complete && miloToma.naturalWidth) {
        dspr = miloToma;  // 🥤 coquita en mano
      }
      const kid = (CHAR_DEF[p.char || 'ger'] || {}).kid ? 0.78 : 1;
      const h = 44 * s * kid, w = h * (dspr.width / dspr.height);
      ctx.imageSmoothingEnabled = conAsset;              // ver nota arriba del setTransform
      if (conAsset) ctx.imageSmoothingQuality = 'high';

      // Todos los frames se dibujan en la misma caja: los pies en p.y y el centro
      // en p.x. El movimiento de piernas ya viene dentro de los frames, así que no
      // se le suma rebote ni balanceo artificial (eso movía el sprite de costado y
      // se sumaba al cambio de tamaño que veía el equipo).
      ctx.drawImage(dspr, p.x - w / 2, p.y - h, w, h);
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
    if (p.cafeUntil && now < p.cafeUntil) {
      // Barrita de energía al tomar el café: se llena rápido y desaparece
      const el = CAFE_MS - (p.cafeUntil - now);  // ms desde que tomó
      if (el < 1500) {
        const bw = fs * 7, bh = Math.max(2, fs * 0.7);
        const ex = p.x - bw / 2, ey = ly - fs * 2;
        const fill = Math.min(1, el / 900);
        ctx.globalAlpha = el > 1100 ? 1 - (el - 1100) / 400 : 1;
        ctx.fillStyle = 'rgba(10,12,18,0.85)'; ctx.fillRect(ex - 1, ey - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(ex, ey, bw, bh);
        ctx.fillStyle = fill < 1 ? '#ffd76a' : '#6ee56e';
        ctx.fillRect(ex, ey, bw * fill, bh);
        ctx.globalAlpha = 1;
      }
    }
    if (p.bubble && now < p.bubbleUntil) drawBubble(ctx, p.bubble, p.x, ly - fs * 0.8, fs);
  }
  if (!catDibujado) drawCat(now, nocturno);

  const ce = climaEmoji();
  clockBox.textContent = `${phaseName(hf)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` + (ce ? ` · ${ce}` : '') + (USE_P2P ? ` · 📡${p2pPeerCount}` : '');

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
  try { dibujarCarga(); } catch (err) { /* idem */ }
}

// Mientras bajan los 13 MB de dibujos, la oficina se ve negra y a medio armar.
// Sin un cartel eso parece una pantalla rota, sobre todo después de un refresco
// forzado (Ctrl+Shift+R), que vuelve a bajar todo. El cartel dice la verdad:
// cuántos personajes ya llegaron y si falta el fondo.
function dibujarCarga() {
  if (assetsReady && bgReady) return;
  const listos = Object.keys(charAssets).filter((k) => charAssets[k] && charAssets[k].sit).length;
  const total = Object.keys(CHAR_DEF).length;
  const g = ctx;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width, ch = canvas.height;
  const fs = Math.max(11, Math.round(cw / 70));
  g.font = `${fs}px "Press Start 2P", monospace`;
  g.textAlign = 'center';
  const txt = `Cargando la oficina… ${listos}/${total}` + (bgReady ? '' : ' + fondo');
  const w = g.measureText(txt).width + fs * 2, h = fs * 2.6;
  const x = cw / 2, y = ch * 0.2;   // arriba: no tapa al personaje ni los botones
  g.fillStyle = 'rgba(10,12,18,0.88)';
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.strokeStyle = '#ffd76a'; g.lineWidth = 2;
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle = '#ffd76a';
  g.fillText(txt, x, y + fs * 0.38);
  g.restore();
}

function init() {
  if (USE_P2P) state.myId = 'me' + Math.random().toString(36).slice(2, 8);
  // Los PNG de referencia tardan un instante en venir. Mientras tanto la escena
  // arranca con el chibi de la grilla y en cuanto llegan se usan solos: getSprite
  // chequea assetsReady en cada llamada y el caché del chibi no estorba.
  loadCharAssets();
  resize();
  buildStatusBar();
  // layoutMobile() mide la lista de estados para colgarle el botón de acción
  // debajo, así que tiene que correr DESPUÉS de armarla: antes de este cambio
  // el botón se anclaba al pie de la pantalla y no dependía del orden.
  layoutMobile();
  renderPlayerList();
  const mb = document.getElementById('musicBtn'); if (mb) mb.onclick = mpToggle;
  const nbtn = document.getElementById('notifBtn'); if (nbtn) nbtn.onclick = notifToggle;
  document.addEventListener('pointerdown', notifCerrarSiFuera);
  document.addEventListener('keydown', notifCerrarConEsc);
  // En CAPTURA, no en burbuja: al tocar un nombre, el handler de la lista
  // despliega el historial y redibuja la lista entera. Si este corriera
  // despues, el elemento tocado ya estaria reemplazado, playerList.contains()
  // daria false y creeria que tocaste afuera... cerrando lo que acabas de
  // abrir. En captura corre antes del redibujo, con el elemento todavia vivo.
  document.addEventListener('pointerdown', histCerrarSiFuera, true);
  document.addEventListener('keydown', histCerrarConEsc);
  // pointerdown y no click: la lista se redibuja entera cada vez que llega un
  // mensaje de la red, asi que la fila puede ser reemplazada entre el apretar y
  // el soltar. Cuando eso pasa no hay 'click' sobre la fila y el toque se
  // pierde. Con pointerdown es un solo evento y siempre llega.
  if (playerListBox) playerListBox.addEventListener('pointerdown', (ev) => {
    const fila = ev.target && ev.target.closest && ev.target.closest('.pl-row');
    if (fila) histAlternarFila(fila.dataset.char);
  });
  notifRenderBtn();
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

  // ---------- Menú de acciones estilo Sims: clic/tap sobre un personaje ----------
  const accMenu = document.getElementById('accMenu');
  const accCerrar = () => { if (accMenu) { accMenu.classList.add('hidden'); accMenu.innerHTML = ''; } };
  function alturaDe(p) {
    const kid = (CHAR_DEF[p.char || 'ger'] || {}).kid;
    if (p.seated) return 48 * sitScale(p.y) * (kid ? 0.9 : 1);
    const spr = charAssets[p.char || 'ger'] && charAssets[p.char || 'ger'].down;
    const sRaw = depthScale(p.y);
    // Mismo tope que en el render: el alto de figura del sprite base.
    const baseH = (charAssets[p.char || 'ger'] || {}).baseH || (spr ? spr.height : 44);
    const s = spr ? Math.min(sRaw, baseH / 44) : sRaw;
    return 44 * s * (kid ? 0.78 : 1);
  }
  function accAbrir(items, titulo, cx, cy) {
    if (!accMenu) return;
    accMenu.innerHTML = '';
    accMenu.classList.remove('hidden');
    const poner = (el, x, y) => {
      el.style.left = Math.max(84, Math.min(window.innerWidth - 84, x)) + 'px';
      el.style.top = Math.max(22, Math.min(window.innerHeight - 26, y)) + 'px';
    };
    // Nombre arriba, y las acciones flotando en elipse alrededor (estilo Sims)
    const t = document.createElement('div');
    t.className = 'am-title'; t.textContent = titulo;
    accMenu.appendChild(t);
    poner(t, cx, cy - 84);
    const n = items.length;
    // El radio crece con la cantidad: a partir de siete acciones, en la
    // elipse de siempre las pastillas de arriba se pisaban entre ellas.
    const rx = Math.max(128, Math.round(55 / Math.sin(Math.PI / (n + 1))));
    items.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = 'am-item'; d.textContent = it.t;
      d.addEventListener('click', (ev) => { ev.stopPropagation(); accCerrar(); it.f(); });
      accMenu.appendChild(d);
      const ang = -Math.PI / 2 + (i + 1) * (2 * Math.PI / (n + 1));
      poner(d, cx + Math.cos(ang) * rx, cy + Math.sin(ang) * 76);
      d.style.animationDelay = (40 + i * 50) + 'ms';
    });
    // En una pantalla angosta la elipse no entra: el recorte contra los bordes
    // amontona las pastillas y dos terminan pisadas (en el celular pasaba con
    // seis). Las que se tocan se separan a lo alto. Se mide con offsetWidth,
    // que es el tamaño real: getBoundingClientRect() da el de la animación de
    // entrada, que arranca achicada.
    const els = [...accMenu.querySelectorAll('.am-item')];
    const pos = els.map((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]);
    const caja = (el, p) => ({
      i: p[0] - el.offsetWidth / 2, d: p[0] + el.offsetWidth / 2,
      a: p[1] - el.offsetHeight / 2, b: p[1] + el.offsetHeight / 2,
    });
    for (let pase = 0; pase < 8; pase++) {
      const cs = els.map((el, k) => caja(el, pos[k]));
      let movio = false;
      for (let k = 0; k < els.length; k++) for (let j = k + 1; j < els.length; j++) {
        const sy = Math.min(cs[k].b, cs[j].b) - Math.max(cs[k].a, cs[j].a);
        if (Math.min(cs[k].d, cs[j].d) - Math.max(cs[k].i, cs[j].i) <= 0 || sy <= 0) continue;
        const paso = (sy + 6) / 2 * (cs[k].a <= cs[j].a ? -1 : 1);
        pos[k][1] += paso; pos[j][1] -= paso;
        poner(els[k], pos[k][0], pos[k][1]); poner(els[j], pos[j][0], pos[j][1]);
        cs[k] = caja(els[k], pos[k]); cs[j] = caja(els[j], pos[j]);
        movio = true;
      }
      if (!movio) break;
    }
  }
  canvas.addEventListener('click', (e) => {
    if (!state.joined) return;
    accCerrar();
    const r = canvas.getBoundingClientRect();
    const wx = ((e.clientX - r.left) * (canvas.width / r.width) - viewOX) / viewScale;
    const wy = ((e.clientY - r.top) * (canvas.height / r.height) - viewOY) / viewScale;
    // ¿Tocó a Michi?
    const uCat = clamp(depthScale(cat.y) / 12, 0.65, 1.8) * 6.0;
    if (Math.abs(wx - cat.x) < 9 * uCat && wy > cat.y - 17 * uCat && wy < cat.y + 3 * uCat) {
      accAbrir([
        { t: '❤ Acariciar', f: () => { if (catCerca()) catMimar(); else toast('🐈 Acercate más a Michi'); } },
      ], '🐈 Michi', e.clientX, e.clientY);
      return;
    }
    // ¿Tocó la cabeza de alguien? (mitad superior del cuerpo; el más cercano primero)
    const list = [...state.players.values()].filter((p) => p.name && p.status !== 'ausente').sort((a, b) => b.y - a.y);
    for (const p of list) {
      const h = alturaDe(p);
      if (Math.abs(wx - p.x) < h * 0.28 && wy > p.y - h * 1.05 && wy < p.y - h * 0.35) {
        if (p.id === state.myId) {
          const items = STATUS_KEYS.map((k) => ({ t: `${STATUS_INFO[k].emoji} ${STATUS_INFO[k].label}`, f: () => setStatus(k) }));
          // Las animaciones aparecen sólo cuando estás sentado: los dibujos
          // traen la silla adentro, de pie no habría qué mostrar.
          if (p.seated) for (const n of animDe(p.char)) items.push({ t: ANIMS[n].titulo, f: () => animPedir(n) });
          if (!p.seated && p.char === 'ger') items.push({
            t: p.fightMode ? '🕊️ Desactivar pelea' : '🥊 Activar modo pelea',
            f: fightModoPedir,
          });
          items.push({ t: '💨 Zumbido', f: doZumbido });
          accAbrir(items, p.name, e.clientX, e.clientY);
        } else {
          accAbrir([
            { t: '👋 Saludar', f: () => { send({ type: 'emote', id: state.myId, emote: '👋' }); const me = state.players.get(state.myId); if (me) { me.emote = '👋'; me.emoteUntil = performance.now() + 3000; } } },
            { t: '💬 Susurrar', f: () => { chatInput.value = `/w ${p.name} `; chatAutoGrow(); chatInput.focus(); } },
            { t: '💨 Zumbido', f: doZumbido },
          ], p.name, e.clientX, e.clientY);
        }
        return;
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (accMenu && !accMenu.classList.contains('hidden') && !accMenu.contains(e.target) && e.target !== canvas) accCerrar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') accCerrar(); });

  // Controles táctiles (móvil): UN solo círculo. El aro es el joystick y en el
  // centro está la E de acción (la misma E que en PC).
  const btnEEl = document.getElementById('btnE');
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
    const end = () => { sid = null; state.stick.x = 0; state.stick.y = 0; state.stick.active = false; knobEl.style.transform = ''; };
    stickEl.addEventListener('pointerdown', (e) => { sid = e.pointerId; try { stickEl.setPointerCapture(sid); } catch {} setFrom(e); e.preventDefault(); });
    stickEl.addEventListener('pointermove', (e) => { if (sid === e.pointerId) setFrom(e); });
    stickEl.addEventListener('pointerup', end);
    stickEl.addEventListener('pointercancel', end);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);

    // La E vive en el CENTRO del aro, y el pulgar cae en el medio casi siempre.
    // Por eso el botón no se queda con el gesto: si el dedo empieza en la E y
    // después se arrastra, el gesto pasa al joystick. Tap en el centro = acción,
    // arrastre desde el centro = moverse. Con esto no hay forma de tocar el
    // control y que no pase nada.
    if (btnEEl) {
      let eid = null, ex0 = 0, ey0 = 0, esStick = false;
      const HUECO = 9;   // px de arrastre para decidir que es joystick
      btnEEl.addEventListener('pointerdown', (e) => {
        eid = e.pointerId; ex0 = e.clientX; ey0 = e.clientY; esStick = false;
        try { btnEEl.setPointerCapture(eid); } catch {}
        e.preventDefault();
      });
      btnEEl.addEventListener('pointermove', (e) => {
        if (eid !== e.pointerId) return;
        if (!esStick && Math.hypot(e.clientX - ex0, e.clientY - ey0) > HUECO) esStick = true;
        if (esStick) { setFrom(e); e.preventDefault(); }
      });
      const finE = (e) => {
        if (eid !== e.pointerId) return;
        eid = null;
        if (esStick) { end(); return; }   // fue joystick: no hay acción
        accionE();                        // fue un toque: la acción de la E
      };
      btnEEl.addEventListener('pointerup', finE);
      btnEEl.addEventListener('pointercancel', (e) => { if (eid === e.pointerId) { eid = null; end(); } });
    }
  }

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.onclick = () => { sendChat(chatInput.value, takeAtt()); chatInput.value = ''; chatAutoGrow(); hideEmojiPicker(); updateSendMic(); };
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
      chatAutoGrow();
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
  chatInput.addEventListener('input', () => { updateSendMic(); chatAutoGrow(); });
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
  dniInput.addEventListener('input', async () => {
    // Va por hash igual que el ingreso: antes, tipear cualquier DNI de 8 dígitos
    // te mostraba de quién era el puesto (un "oráculo" del roster).
    const escrito = dniInput.value.replace(/\D/g, '');
    const entry = await entryPorDni(escrito);
    if (dniInput.value.replace(/\D/g, '') !== escrito) return; // siguió tipeando
    previewChar(entry ? entry.char : null);
    dniError('');
  });
  connect();
  requestAnimationFrame(loop);
}
init();
