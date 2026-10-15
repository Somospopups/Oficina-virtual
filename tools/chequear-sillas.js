#!/usr/bin/env node
/**
 * 🪑 Reparto de escritorios al entrar
 *
 * Regla: la oficina tiene 4 puestos y el equipo es más grande. El que entra se
 * sienta en el suyo; si se lo ocuparon, en cualquiera libre; y si están los
 * CUATRO ocupados entra DE PIE — nunca sentado arriba de otro.
 *
 * Para que el chequeo no se despegue del juego, no copia la lógica: la saca
 * tal cual de game.js y la corre acá con compañeros de mentira.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.join(__dirname, '..', 'game.js');
const src = fs.readFileSync(GAME, 'utf8');

// ---------- Extraer de game.js las piezas que gobiernan las sillas ----------
function sacarFuncion(nombre) {
  const ini = src.indexOf(`\nfunction ${nombre}(`);
  if (ini === -1) fallar(`no encontré la función ${nombre}() en game.js`);
  const finLinea = src.indexOf('\n', ini + 1);
  const primera = src.slice(ini + 1, finLinea);
  if (primera.includes('}')) return primera;   // una línea (piso, sillas...): no hay más que sacar
  const fin = src.indexOf('\n}', ini);
  if (fin === -1) fallar(`no pude cerrar la función ${nombre}() en game.js`);
  return src.slice(ini + 1, fin + 2);
}
function sacarConst(nombre) {
  const re = new RegExp(`^const ${nombre}\\s*=[\\s\\S]*?;$`, 'm');
  const m = src.match(re);
  if (!m) fallar(`no encontré la constante ${nombre} en game.js`);
  return m[0];
}

const fallos = [];
function fallar(msg) { console.error(`\n❌ ${msg}\n`); process.exit(1); }
function ok(cond, msg, extra) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}${extra && !cond ? ` — ${extra}` : ''}`);
  if (!cond) fallos.push(msg);
}

// escenaId es un `let` del juego y las funciones de abajo lo leen: hay que
// declararlo en el mismo script o se van de scope.
const piezas = [
  sacarConst('ESCENAS'),
  `let escenaId = 'ofi'; let escenaFade = 0;`,
  sacarConst('PRESENCIA_MS'),
  sacarFuncion('escena'), sacarFuncion('piso'), sacarFuncion('sillas'),
  sacarFuncion('dimW'), sacarFuncion('dimH'), sacarFuncion('mitadX'),
  sacarFuncion('escalaFigura'), sacarFuncion('depthScale'), sacarFuncion('sitScale'),
  sacarFuncion('pisoAncho'),
  sacarFuncion('lerp'), sacarFuncion('clamp'), sacarFuncion('enPoli'), sacarFuncion('walkable'),
  sacarFuncion('presente'), sacarFuncion('seatOwner'), sacarFuncion('seatFor'), sacarFuncion('puntoDePie'),
].join('\n');

const caja = { state: { players: new Map(), myId: 'yo' }, performance: { now: () => 100000 }, console };
vm.createContext(caja);
vm.runInContext(
  piezas + '\nthis.api = { ESCENAS, escenaId: null, setEscena: (v) => { escenaId = v; }, seatFor, puntoDePie, walkable, piso, sillas, dimW, dimH, escalaFigura, sitScale, depthScale, pisoAncho, escena };',
  caja,
);
const api = caja.api;
const { ESCENAS, seatFor, puntoDePie, walkable, piso, sillas, dimW, dimH, escalaFigura, sitScale, depthScale, pisoAncho, escena } = api;

const jugadores = caja.state.players;
const NOW = 100000;
const SEATS = ESCENAS.ofi.sillas;
const sentar = (id, i) => jugadores.set(id, { id, name: id, seated: true, x: SEATS[i].x, y: SEATS[i].y, seen: NOW });
const parar = (id, x, y) => jugadores.set(id, { id, name: id, seated: false, x, y, seen: NOW });

console.log('\n🪑 Reparto de escritorios al entrar\n');

console.log('Con lugar disponible');
ok(seatFor({ seat: 0 }) === SEATS[0], 'oficina vacía: cada uno va a SU puesto');
sentar('ger', 0);
const otro = seatFor({ seat: 0 });
ok(otro && otro !== SEATS[0], 'si le ocuparon el puesto, se sienta en otro libre');
sentar('facu', 1); sentar('ovni', 2);
ok(seatFor({}) === SEATS[3], 'el que no tiene puesto fijo agarra el que queda');

console.log('\nOficina llena: se entra DE PIE');
sentar('milo', 3);
ok(seatFor({}) === null, 'con los 4 ocupados no se asigna silla (sin puesto fijo)');
ok(seatFor({ seat: 0 }) === null, 'con los 4 ocupados tampoco vale el puesto propio');
ok(seatFor(null) === null, 'seatFor(null) no explota (lo usa resolveSeatConflict)');

const d1 = puntoDePie();
ok(walkable(d1.x, d1.y), 'el que entra parado cae en piso caminable');
parar('a', d1.x, d1.y);
const d2 = puntoDePie();
ok(Math.hypot(d2.x - d1.x, d2.y - d1.y) >= 70, 'dos que entran parados no se enciman');
ok(walkable(d2.x, d2.y), 'el segundo también cae en piso caminable');

parar('b', d2.x, d2.y);
const varios = [d1, d2];
for (let i = 0; i < 6; i++) { const d = puntoDePie(); varios.push(d); parar('c' + i, d.x, d.y); }
ok(varios.every((p) => walkable(p.x, p.y)), 'hasta 8 parados siguen todos dentro del piso');

console.log('\nQuién ocupa de verdad una silla');
jugadores.clear();
parar('paseante', SEATS[1].x, SEATS[1].y);
ok(seatFor({ seat: 1 }) === SEATS[1], 'el que pasa caminando por delante NO reserva el escritorio');

jugadores.clear();
sentar('fantasma', 2);
jugadores.get('fantasma').seen = NOW - 30000;
ok(seatFor({ seat: 2 }) === SEATS[2], 'el que se desconectó sin avisar libera su silla');
jugadores.get('fantasma').seen = NOW - 2000;
ok(seatFor({ seat: 2 }) !== SEATS[2], '...pero al que sigue conectado no se lo levanta');

console.log('\nLa pantalla avisa');
ok(/Los cuatro escritorios están ocupados/.test(src), 'se le explica por chat al que entra de pie');
ok(/no quedan puestos: quedás de pie/.test(src), 'y también si lo levantan de un puesto ya tomado');

console.log('\nEscala de la figura en cada escena');
// Cada escena acota su alto de cabeza a pies en `fig`. No hay un número
// "correcto" universal (cada cuadro tiene su cámara), pero hay rangos sanos:
// si alguien pone 5 o 5000 por un typos, el chibi queda microscópico o se come
// la pantalla. La rampa además tiene que crecer de atrás hacia adelante.
for (const [k, E] of Object.entries(ESCENAS)) {
  const [a, b] = E.piso.fig;
  ok(a > 60 && a < E.h * 0.6, `${k}: el alto al fondo del piso es razonable`, `fig[0]=${a} alto=${E.h}`);
  ok(b > a && b < E.h * 0.9, `${k}: el alto al frente del piso es razonable y crece`, `fig=[${a},${b}] alto=${E.h}`);
  const razon = b / a;
  ok(razon > 1.6 && razon < 4.5, `${k}: la rampa de perspectiva es creíble`, `fig crece ${razon.toFixed(2)}x`);
}

// En cada escena, la figura crece de atrás hacia adelante y el sentado mide
// menos que el parado al mismo pie.
for (const k of Object.keys(ESCENAS)) {
  api.setEscena(k);
  const yFondo = piso().yTop + 40, yFrente = piso().yBot - 20;
  ok(escalaFigura(yFondo) < escalaFigura(yFrente), `${k}: la figura crece al acercarse`);
  ok(sitScale(yFrente) < escalaFigura(yFrente), `${k}: el sentado mide menos que el parado`);
  ok(depthScale(yFondo) < depthScale(yFrente), `${k}: la velocidad también crece al acercarse`);
  ok(walkable(ESCENAS[k].spawn.x, ESCENAS[k].spawn.y), `${k}: el spawn es caminable`);
  ok(ESCENAS[k].sillas.every((s) => s.x >= 0 && s.x <= ESCENAS[k].w && s.y >= 0 && s.y <= ESCENAS[k].h && s.tipo), `${k}: las interacciones quedan dentro de la escena y tienen tipo`);
  // La puerta se cruza en los dos sentidos: la zona tiene que ser alcanzable en
  // ESTA escena y el punto de llegada, caminable en la OTRA.
  const pu = ESCENAS[k].puerta;
  const otra = ESCENAS[pu.hacia];
  api.setEscena(pu.hacia);
  ok(walkable(pu.ax, pu.ay), `${k}: el punto de llegada de la puerta es caminable`);
  api.setEscena(k);
  ok(!!otra && otra.puerta.hacia === k, `${k}: la puerta va y vuelve (${k} ⇄ ${pu.hacia})`);
}

console.log('\nLa terraza no tiene escritorios');
api.setEscena('terr');
jugadores.clear();
ok(sillas().filter((s) => s.tipo === 'pc').length === 0, 'la terraza no reparte escritorios (solo tiene sofá)');
const dt = puntoDePie();
ok(walkable(dt.x, dt.y) && dt.x === ESCENAS.terr.spawn.x, 'el que entra a la terraza cae en su punto de aparición');

if (fallos.length) {
  console.error(`\n❌ ${fallos.length} problema(s) en el reparto de escritorios.\n`);
  process.exit(1);
}
console.log('\n✅ Nadie se sienta arriba de otro: con la oficina llena se entra de pie.\n');
