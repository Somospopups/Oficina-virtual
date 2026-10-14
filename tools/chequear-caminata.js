#!/usr/bin/env node
/**
 * 🧭 chequear-caminata.js
 *
 * Problema que resuelve: en un ciclo de caminata, todos los frames tienen que
 * mirar para el MISMO lado. Si uno se escapa del lado, el personaje da media vuelta
 * a mitad de la animación. Pasó con Ger: `ger_wl2.png` y `ger_wr2.png` estaban
 * guardados al revés, así que el ciclo de la izquierda era IZQ -> DER -> IZQ -> DER
 * y el personaje giraba dos veces por vuelta (v100).
 *
 * Qué hace: lee los ciclos de caminata directamente de `game.js` (así el chequeo
 * cubre los frames que se agreguen después), y de cada PNG deduce hacia dónde mira
 * el personaje mirando de dónde están los ojos dentro de la cabeza. Si un ciclo
 * mezcla direcciones, lo dice y sale con código 1.
 *
 * Uso:
 *   node tools/chequear-caminata.js          # revisa y avisa
 *
 * No depende de librerías externas (lee los PNG a mano, como limpiar-fondo-sprites.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { decodePNG, haciaDondeMira, sentidos, MIN_OJO_LATERAL } = require('./lib-png');

// ---------- Ciclos, leídos de game.js ----------
function leerCiclos(raiz) {
  const src = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
  // nombre de variable -> archivo PNG, para los frames declarados aparte
  const vars = {};
  for (const m of src.matchAll(/\b(\w+)\s*=\s*img\('([^']+)'\)/g)) vars[m[1]] = m[2];
  for (const m of src.matchAll(/const\s+([\w,\s]+?)\s*=\s*img\(([^)]*)\)/g)) {
    const archivos = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .forEach((v, i) => { if (archivos[i]) vars[v] = archivos[i]; });
  }
  const ciclos = [];
  for (const bloque of src.matchAll(/walkSources\.(\w+)\s*=\s*\{([^}]*)\}/g)) {
    const [, char, cuerpo] = bloque;
    for (const d of cuerpo.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
      const dir = d[1];
      const frames = [...d[2].matchAll(/'([^']+)'|(\b\w+\b)/g)]
        .map((t) => (t[1] ? t[1] : vars[t[2]]))
        .filter(Boolean);
      if (frames.length) ciclos.push({ char, dir, frames });
    }
  }
  return ciclos;
}

// ---------- CLI ----------
const raiz = path.resolve(__dirname, '..');
const ciclos = leerCiclos(raiz);
if (!ciclos.length) {
  console.log('No encontré ciclos de caminata en game.js.');
  process.exit(0);
}

const cache = {};
const info = (nombre, minOjo) => {
  const k = nombre + '|' + minOjo;
  if (!cache[k]) {
    const f = path.join(raiz, 'sprites', `${nombre}.png`);
    cache[k] = fs.existsSync(f)
      ? haciaDondeMira(decodePNG(f), minOjo)
      : { lado: 'FALTA', pos: 0.5, area: 0 };
  }
  return cache[k];
};

let malos = 0;
console.log('🧭 Sentido de los frames de caminata\n');
for (const { char, dir, frames } of ciclos) {
  const lateral = dir === 'left' || dir === 'right';
  if (!lateral) {
    const rel = sentidos(raiz, frames);
    const linea = frames.map((f, i) => `${f}(${rel ? rel[i] : '?'})`).join('  ');
    console.log(`  ➖ ${char}/${dir.padEnd(5)}  (de espaldas o de frente, no se juzga)  ${linea}`);
    continue;
  }

  // 1) la prueba que decide: todos los frames del ciclo mirando para el mismo lado
  const rel = sentidos(raiz, frames);
  const alReves = frames.filter((f, i) => rel && rel[i] === 'al reves');

  // 2) dato de apoyo: hacia dónde mira (solo informativo; con pelo grande o
  //    ojos chicos no siempre se puede leer, y no debe frenar el chequeo)
  const minOjo = MIN_OJO_LATERAL;
  const ojos = frames.map((f) => ({ f, ...info(f, minOjo) }));
  const lados = new Set(ojos.filter((r) => r.lado === 'IZQ' || r.lado === 'DER').map((r) => r.lado));
  const esperado = dir === 'left' ? 'IZQ' : 'DER';
  const dato = lados.size === 1 ? [...lados][0] : (lados.size ? '?' : 'ilegible');

  const linea = `${ojos.map((r) => `${r.f}(${r.lado})`).join('  ')}  |  ${rel.map((r) => r).join(',')}`;

  if (alReves.length) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEDIA VUELTA   ${linea}`);
    console.log(`       estos frames están del lado contrario al resto: el personaje gira`);
    console.log(`       a mitad del ciclo -> ${alReves.join(', ')}`);
    malos++;
    continue;
  }
  if (dato === esperado) {
    console.log(`  ✅ ${char}/${dir.padEnd(5)}  ${dato.padEnd(7)}         ${linea}`);
  } else if (lados.size > 1) {
    console.log(`  ❌ ${char}/${dir.padEnd(5)}  MEZCLA           ${linea}`);
    console.log(`       hay frames mirando a los dos lados dentro del mismo ciclo`);
    malos++;
  } else {
    console.log(`  ➖ ${char}/${dir.padEnd(5)}  ${dato.padEnd(7)}         ${linea}`);
    console.log(`       todos los frames son coherentes, pero no se puede leer de qué`);
    console.log(`       lado miran (pelo grande o ojos chicos). No se puede reprobar.`);
  }
}

console.log('');
if (malos) {
  console.log(`❌ ${malos} ciclo(s) con el personaje girando.`);
  console.log('   Arreglo: intercambiar los archivos de sprites/ para que el nombre');
  console.log('   (_wl* = izquierda, _wr* = derecha) coincida con el dibujo, y subir el');
  console.log('   ?v= de game.js para que los navegadores no sirvan los PNG viejos.');
  process.exit(1);
}
console.log('✅ Todos los ciclos miran para un solo lado.');
