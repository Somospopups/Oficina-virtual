// Guard de los controles táctiles en móvil: el joystick (#stick) y el botón de
// acción (#btnE) tienen que verse SIEMPRE y quedar apilados, stick arriba y E
// abajo, en la misma columna.
//
// El botón arrancó con display:none en la regla base y display:block solo en la
// media query de móvil. Cuando esa línea se perdió al editar el bloque, el
// botón desapareció por completo en el celu sin romper nada visible: no había
// error, solo no estaba. Y el JS que lo posicionaba hacia display='' en el caso
// normal, que es lo mismo que none, así que el fallo se escondía dos veces.
//
// Sin dependencias: revisa el texto, no ejecuta el layout. La prueba de verdad
// es verificar-stick-e.js, que abre un navegador de verdad y mide las cajas.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');

let malas = 0;
const ok = (c, et) => { console.log(`  ${c ? '✅' : '❌'} ${et}`); if (!c) malas++; };

console.log('🕹️ Controles táctiles en móvil\n');

// 1) las reglas móviles tienen que prender los dos controles
const movil = css.slice(css.indexOf('@media (max-width: 900px)'));
ok(/#stick\s*\{[^}]*display:\s*block/.test(movil),
   'la regla móvil de #stick tiene display:block');
ok(/#btnE\s*\{[^}]*display:\s*block/.test(movil),
   'la regla móvil de #btnE tiene display:block');
ok(/#btnE\s*\{[^}]*right:\s*\d+px/.test(movil),
   'la regla móvil de #btnE lo ancla a la derecha (columna del joystick)');

// 2) el JS no debe limpiar el display en el camino normal: '' cae en none
const fnLayout = js.slice(js.indexOf('function layoutMobile'));
const ramaNoMovil = fnLayout.slice(0, fnLayout.indexOf('return;'));
ok(/btnEEl\.style\.display = '';/.test(ramaNoMovil),
   'al salir de móvil se limpia el display inline (sirve al girar el celu)');
ok(/btnEEl\.style\.display = 'block';/.test(fnLayout.slice(ramaNoMovil.length)),
   'en el celu el display se pone en block explícito, nunca en \'\'');

// 3) la columna: stick arriba, E abajo, sin depender de la lista de estados
ok(/stickEl\.style\.top = top \+ 'px'/.test(js),
   'el joystick se ancla por su borde superior en la columna');
ok(/btnEEl\.style\.top = \(top \+ sS \+ gap\) \+ 'px'/.test(js),
   'el botón E se ancla DEBAJO del joystick, con separación');
ok(/btnEEl\.style\.right = Math\.round\(margen \+ \(sS - eS\) \/ 2\) \+ 'px'/.test(js),
   'el botón E queda centrado bajo el joystick');
ok(!/getElementById\('statusBar'\)[\s\S]{0,200}btnEEl/.test(js.slice(js.indexOf('function layoutMobile'))),
   'la posición de la E ya no depende de la lista de estados');

// 4) si el celu es bajo, los dos se achican juntos en vez de pisar el chat
ok(/if \(totalFull > banda - 8\)/.test(js) && /Math\.max\(0\.5, \(banda - 8\) \/ totalFull\)/.test(js),
   'en una pantalla chica se achican stick y E juntos, con piso del 50%');

console.log('');
if (malas) {
  console.log(`❌ ${malas} problema(s) con los controles del celu.`);
  process.exit(1);
}
console.log('✅ Stick y E quedan visibles y apilados: stick arriba, E abajo.');
