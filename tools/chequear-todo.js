#!/usr/bin/env node
/* chequear-todo.js — un solo comando con todos los chequeos del repo.
 *
 * Para: `npm test`. También corre en GitHub Actions (.github/workflows).
 * La idea es que nadie tenga que acordarse el orden: si esto sale verde,
 * el repo está publicable.
 *
 * Orden importa: generar-assets va antes de checlear-boton-e (que compara los
 * hashes de los dibujos), y checlear es el último porque es el más completo.
 *
 * Sin dependencias: sólo node, git (si no está, se avisa y se saltea) y los
 * tools que ya estaban. No hace `npm install`.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const node = process.execPath;

let fallos = 0;
let salteados = 0;

function paso(titulo, cmd, args) {
  console.log(`\n\x1b[1m▶ ${titulo}\x1b[0m`);
  const r = spawnSync(cmd, args, { cwd: raiz, stdio: 'inherit', shell: false });
  if (r.error && r.error.code === 'ENOENT') {
    console.log(`  ⚠️  no se encontró "${cmd}": se saltea`);
    salteados++;
    return true;
  }
  if (r.status !== 0) {
    console.log(`\n\x1b[31m✗ falló: ${cmd} ${args.join(' ')}\x1b[0m`);
    fallos++;
    return false;
  }
  return true;
}

function git(args) {
  return paso(`git ${args.join(' ')}`, 'git', args);
}

const sinGit = spawnSync('git', ['--version'], { cwd: raiz, stdio: 'ignore' }).status !== 0;

// 1. Sintaxis. Un error de sintaxis rompe todo el juego en el navegador, así
//    que va primero: es lo más barato de detectar.
console.log('\x1b[1m🔎 Chequeos del repo\x1b[0m');
for (const f of ['game.js', 'server.js']) {
  if (!paso(`node --check ${f}`, node, ['--check', f])) break;
}
if (fs.existsSync(path.join(raiz, 'tools'))) {
  for (const f of fs.readdirSync(path.join(raiz, 'tools')).filter((x) => x.endsWith('.js'))) {
    if (!paso(`node --check tools/${f}`, node, ['--check', path.join('tools', f)])) break;
  }
}

// 2. Fondos de los PNG: los que salieron opacos hay que limpiarlos.
paso('limpiar-fondo-sprites --check (PNG sin transparencia)',
  node, [path.join('tools', 'limpiar-fondo-sprites.js'), '--check']);

// 3. assets.js tiene que reflejar el contenido REAL de cada dibujo. Se
//    regenera y se mira si git vio un cambio: si cambió, alguien tocó un PNG
//    y no lo regeneró (o assets.js está desactualizado en el repo).
if (paso('generar-assets.js (reescribe assets.js)', node, [path.join('tools', 'generar-assets.js')])) {
  if (sinGit) { console.log('  ⚠️  sin git no se puede comparar assets.js'); salteados++; }
  else git(['diff', '--exit-code', '--', 'assets.js']);
}

// 4. El guard completo: controles, dibujos, historial, roster, sello de versión.
paso('checlear-boton-e.js (guard general)', node, [path.join('tools', 'checlear-boton-e.js')]);

// 5. Reparto de escritorios.
paso('chequear-sillas.js (reparto de puestos)', node, [path.join('tools', 'chequear-sillas.js')]);

// 6. Frames de caminata mirando todos para el mismo lado.
paso('chequear-caminata.js (frames de caminata)', node, [path.join('tools', 'chequear-caminata.js')]);

// 7. git: nada de espacios/sobrantes en las líneas, y el árbol sin cambios
//    sueltos que se nos hayan pasado por alto.
if (sinGit) { console.log('\n\x1b[33m⚠️  git no está disponible: se saltean los chequeos de git\x1b[0m'); salteados++; }
else {
  git(['diff', '--check']);
  git(['status', '--porcelain']);
}

console.log('');
if (fallos) {
  console.log(`\x1b[31m✗ ${fallos} chequeo(s) fallaron${salteados ? `, ${salteados} salteados` : ''}. No publicar.\x1b[0m`);
  process.exit(1);
}
console.log(`\x1b[32m✅ Todo verde${salteados ? ` (${salteados} chequeo(s) salteados)` : ''}. Publicable.\x1b[0m`);
