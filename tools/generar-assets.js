#!/usr/bin/env node
/* Versionado AUTOMÁTICO de los dibujos por contenido.
 *
 * El problema: los PNG se cargaban con un ?v= escrito a mano. Si se reemplaza
 * un dibujo y no se cambia ese número, el navegador lo saca del caché y muestra
 * el viejo (era lo que pasaba al entrar, tanto en el login como en la oficina).
 *
 * La solución: acá se calcula un hash corto del CONTENIDO de cada imagen y se
 * escribe assets.js. Si el dibujo cambia, la URL cambia sola y el navegador
 * descarga el nuevo. Si no cambia, la URL sigue igual y se aprovecha el caché.
 *
 * Se corre antes de cada publicación:   node tools/generar-assets.js
 * Y tools/checlear-boton-e.js falla si un PNG se cambió sin regenerarlo.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const CARPETAS = ['sprites', 'sprites/cat', '.'];
const EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

// Los JPG de "Oficina Virtual/" son los recortes originales de trabajo, no se
// sirven en la web: no entran en el mapa.
const IGNORAR = new Set(['bg_original.png']);

function recorrer(dir, prefijo) {
  let salida = [];
  for (const nombre of fs.readdirSync(dir)) {
    const ext = path.extname(nombre).toLowerCase();
    if (!EXT.has(ext)) continue;
    const rel = prefijo ? `${prefijo}/${nombre}` : nombre;
    if (IGNORAR.has(rel)) continue;
    salida.push(rel);
  }
  return salida;
}

let rutas = [];
for (const c of CARPETAS) {
  const dir = path.join(RAIZ, c);
  if (!fs.existsSync(dir)) continue;
  rutas = rutas.concat(recorrer(dir, c === '.' ? '' : c));
}
rutas = [...new Set(rutas)].sort();

const mapa = {};
for (const r of rutas) {
  const buf = fs.readFileSync(path.join(RAIZ, r));
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  mapa[r] = 'v=' + hash;
}

const salida = `/* Generado por tools/generar-assets.js — NO editar a mano.
 * Un hash distinto por dibujo: si el archivo cambia, la URL cambia y el
 * navegador deja de mostrar la versión vieja. */
window.ASSETS = ${JSON.stringify(mapa, null, 2)};
`;
fs.writeFileSync(path.join(RAIZ, 'assets.js'), salida);
console.log(`assets.js generado con ${rutas.length} dibujos.`);
