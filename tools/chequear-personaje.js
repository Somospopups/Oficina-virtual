#!/usr/bin/env node
/**
 * 🧍 chequear-personaje.js
 *
 * Problema que resuelve: una hoja de personaje puede cortarse "bien" (los
 * archivos existen y el juego no tira error) y aun así estar mal: un ciclo
 * respira porque un cuadro es más alto que otro, el perfil izquierdo mira a la
 * derecha porque la hoja salió al revés, o queda una franja del panel de la
 * hoja pegada al hombro. Nada de eso se ve en el código; se ve en los PNG.
 *
 * Qué hace: por cada personaje de CHAR_DEF revisa que existan las poses base,
 * que la altura de la figura sea constante dentro de cada ciclo (parado y
 * caminata), que los perfiles del parado miren para el lado que dicen, y que no
 * queden restos del fondo. Sale con código 1 si algo falla.
 *
 * Uso:
 *   node tools/chequear-personaje.js
 *   node tools/chequear-personaje.js ger        # sólo un personaje
 *
 * Complementa a chequear-caminata.js, que mira el sentido DENTRO de un ciclo de
 * caminata leído de game.js. Este mira alturas, perfiles del parado y limpieza.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { leer, caja, haciaDondeMira, limpieza } = require('./lib-png');

const raiz = path.resolve(__dirname, '..');
const sprites = path.join(raiz, 'sprites');

const TOL_ALTURA = 0.03;     // un ciclo se banca 3% de diferencia de alto
const TOL_LIMPIEZA = 0.96;   // 96% del opaco tiene que ser UN solo bulto
const TOL_ELENCO = 0.22;     // un personaje no se aleja más de 22% del del medio

function personajesDeGame() {
  const src = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
  const bloque = src.match(/const\s+CHAR_DEF\s*=\s*\{([\s\S]*?)\n\};/);
  if (!bloque) return [];
  return [...bloque[1].matchAll(/^\s{2}(\w+)\s*:/gm)].map((m) => m[1]);
}

function ciclosDeGame() {
  const src = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
  const vars = {};
  for (const m of src.matchAll(/\b(\w+)\s*=\s*img\('([^']+)'\)/g)) vars[m[1]] = m[2];
  for (const m of src.matchAll(/const\s+([\w,\s]+?)\s*=\s*img\(([^)]*)\)/g)) {
    const archivos = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .forEach((v, i) => { if (archivos[i]) vars[v] = archivos[i]; });
  }
  const ciclos = {};
  for (const bloque of src.matchAll(/walkSources\.(\w+)\s*=\s*\{([^}]*)\}/g)) {
    const [, char, cuerpo] = bloque;
    ciclos[char] = ciclos[char] || {};
    for (const d of cuerpo.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
      const frames = [...d[2].matchAll(/'([^']+)'|(\b\w+\b)/g)]
        .map((t) => (t[1] ? t[1] : vars[t[2]]))
        .filter(Boolean);
      if (frames.length) ciclos[char][d[1]] = frames;
    }
  }
  return ciclos;
}

const cache = new Map();
function info(nombre) {
  if (!cache.has(nombre)) {
    const p = leer(raiz, nombre);
    cache.set(nombre, p ? { png: p, caja: caja(p), lim: limpieza(p) } : null);
  }
  return cache.get(nombre);
}

const solo = process.argv[2];
const elenco = personajesDeGame().filter((c) => !solo || c === solo);
const caminata = ciclosDeGame();

let malos = 0;
const avisos = [];
const alturasParado = [];

console.log('🧍 Personajes: alturas, perfiles y limpieza\n');

for (const char of elenco) {
  console.log(`  ${char}`);

  // --- 1) el parado, que es la base de la escala de todo lo demás ---
  // El único obligatorio es el de frente. Los otros son opcionales: si no
  // existen, el juego los deriva (espaldas = frente apagado, perfil = frente
  // espejado). Si existen, tienen que medir lo mismo y mirar para su lado.
  const parado = { down: `${char}.png`, up: `${char}_up.png`, left: `${char}_izq.png`, right: `${char}_der.png` };
  const altos = {};
  let base = null;
  for (const [dir, archivo] of Object.entries(parado)) {
    const i = info(archivo.replace(/\.png$/, ''));
    if (!i || !i.caja) {
      if (dir === 'down') {
        console.log(`     ❌ falta el parado de frente  (${archivo})`);
        malos++;
      } else {
        console.log(`     ➖ sin parado ${dir.padEnd(5)}      (${archivo}); el juego lo deriva del frente`);
      }
      continue;
    }
    altos[dir] = i.caja.h;
    if (dir === 'down') base = i.caja.h;
  }
  if (base) {
    const max = Math.max(...Object.values(altos));
    const min = Math.min(...Object.values(altos));
    const dif = (max - min) / max;
    alturasParado.push({ char, alto: base });
    const linea = Object.entries(altos).map(([d, h]) => `${d}=${h}`).join('  ');
    if (dif > TOL_ALTURA) {
      // El parado son 4 poses distintas y el juego normaliza cada una contra su
      // alto base, así que una diferencia se banca. Se avisa igual: casi siempre
      // quiere decir que la hoja trajo algo de más (la sombra bajo los pies, el
      // borde del panel) en un solo cuadro. En la caminata, que sí es error, la
      // diferencia se ve porque los cuadros se intercambian a 60 por segundo.
      console.log(`     ⚠️  el parado no mide igual  ${linea}`);
      console.log(`         (${(dif * 100).toFixed(1)}% de diferencia; el juego lo absorbe, pero revisá la hoja)`);
    } else {
      console.log(`     ✅ parado             ${linea}`);
    }

    // --- 2) los perfiles del parado miran para el lado que prometen ---
    for (const [dir, esperado] of [['left', 'IZQ'], ['right', 'DER']]) {
      const archivo = parado[dir].replace(/\.png$/, '');
      if (!info(archivo) || !info(archivo).caja) continue;
      const r = haciaDondeMira(info(archivo).png);
      if (r.lado === esperado) {
        console.log(`     ✅ parado ${dir.padEnd(5)}       mira a ${esperado}`);
      } else if (r.lado === 'IZQ' || r.lado === 'DER') {
        console.log(`     ❌ parado ${dir.padEnd(5)}       mira a ${r.lado}, debería mirar a ${esperado}`);
        malos++;
      } else {
        console.log(`     ➖ parado ${dir.padEnd(5)}       no se puede leer (${r.lado}); no se reproba`);
      }
    }
  }

  // --- 3) cada ciclo de caminata con la altura constante ---
  for (const [dir, frames] of Object.entries(caminata[char] || {})) {
    const conCaja = frames.map((f) => ({ f, c: info(f) && info(f).caja })).filter((x) => x.c);
    if (conCaja.length < 2) continue;
    const max = Math.max(...conCaja.map((x) => x.c.h));
    const min = Math.min(...conCaja.map((x) => x.c.h));
    const dif = (max - min) / max;
    const linea = conCaja.map((x) => `${x.f}=${x.c.h}`).join('  ');
    if (dif > TOL_ALTURA) {
      console.log(`     ❌ caminata ${dir.padEnd(5)}   respira  ${linea}`);
      console.log(`        (${(dif * 100).toFixed(1)}%; el tope es ${(TOL_ALTURA * 100).toFixed(0)}%)`);
      malos++;
    } else {
      console.log(`     ✅ caminata ${dir.padEnd(5)}   ${min === max ? `${min}px` : `${min}-${max}px`}`);
    }
  }

  // --- 4) restos del fondo: una franja del panel o una mota de sombra ---
  for (const archivo of Object.values(parado)) {
    const nombre = archivo.replace(/\.png$/, '');
    const i = info(nombre);
    if (!i || !i.lim) continue;
    if (i.lim.razon < TOL_LIMPIEZA) {
      console.log(`     ❌ restos de fondo en ${archivo}  (${(i.lim.razon * 100).toFixed(1)}% es un solo bulto)`);
      malos++;
    }
  }
}

// --- 5) el elenco tiene que estar a escala comparable ---
if (alturasParado.length >= 2) {
  const altos = alturasParado.map((a) => a.alto).sort((a, b) => a - b);
  const mediana = altos[Math.floor(altos.length / 2)];
  console.log(`\n  Elenco (alto del parado de frente):`);
  for (const { char, alto } of alturasParado.sort((a, b) => b.alto - a.alto)) {
    const razon = alto / mediana;
    const marca = Math.abs(razon - 1) > TOL_ELENCO ? '❌' : '✅';
    console.log(`    ${marca} ${char.padEnd(6)} ${String(alto).padStart(4)}px   x${razon.toFixed(2)}`);
    if (Math.abs(razon - 1) > TOL_ELENCO) {
      malos++;
      avisos.push(`${char} mide ${alto}px y el resto del elenco está en torno a ${mediana}px: en pantalla se va a ver más grande o más chico que sus compañeros.`);
    }
  }
}

console.log('');
if (avisos.length) for (const a of avisos) console.log(`  ⚠️  ${a}\n`);
if (malos) {
  console.log(`❌ ${malos} problema(s) de personaje.`);
  console.log('   La causa casi siempre es la hoja, no el juego. Regenerarla con:');
  console.log('   py -3 tools/procesar-hoja-personaje.py <hoja.png> <char> [--layout ...] [--sin-sombra] [--voltear ...]');
  process.exit(1);
}
console.log('✅ Los personajes están a escala, con perfiles correctos y sin restos de fondo.');
