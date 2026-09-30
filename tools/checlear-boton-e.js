// Guard del boton de accion (E) en movil.
//
// El boton arranco con display:none en la regla base y display:block solo en la
// media query de movil. Cuando esa linea se perdio al editar el bloque, el
// boton desaparecio por completo en el celu sin romper nada visible: no habia
// error, solo no estaba. Y el JS que lo posiciona hacia display='' en el caso
// normal, que es lo mismo que none, asi que el fallo se escondia dos veces.
//
// Sin dependencias: revisa el texto, no ejecuta el layout.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');

let malas = 0;
const ok = (c, et) => { console.log(`  ${c ? '✅' : '❌'} ${et}`); if (!c) malas++; };

console.log('🅴 Boton de accion (E) en movil\n');

// 1) la regla movil tiene que volver a prenderlo
const movil = css.slice(css.indexOf('@media (max-width: 900px)'));
const reglaE = movil.slice(movil.search(/#btnE\s*\{/));
ok(/#btnE\s*\{[^}]*display:\s*block/.test(reglaE),
   'la regla movil de #btnE tiene display:block');
ok(/#btnE\s*\{[^}]*50vw/.test(reglaE),
   'la regla movil de #btnE lo centra sobre la columna de estados');

// 2) el JS no debe limpiar el display en el camino normal: '' cae en none
const caminoNormal = js.slice(js.indexOf('btnEEl.style.display = \'block\';', js.indexOf('const disponible')));
ok(!/btnEEl\.style\.display = '';/.test(caminoNormal),
   'el camino con espacio pone display:block y no lo limpia a \'\'');
ok(/btnEEl\.style\.top = \(r\.bottom \+ \d+\) \+ 'px';/.test(js),
   'el boton se ancla abajo de la lista, midiendo su alto real');

// 3) al pasar a horizontal hay que limpiar el estado inline
ok(/!mob\)[\s\S]{0,200}btnEEl\.style\.display = ''/.test(js),
   'al salir de movil se limpia el display inline (sirve al girar el celu)');

console.log('');
if (malas) {
  console.log(`❌ ${malas} problema(s) con el boton E: en el celu no se ve.`);
  process.exit(1);
}
console.log('✅ El boton E se muestra y queda debajo de la lista de estados.');
