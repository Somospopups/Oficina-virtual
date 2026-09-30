// Guard de los controles táctiles en el celu.
//
// Desde v107 los controles son UN solo círculo contra el borde inferior
// derecho: el joystick es el aro y la E de acción va en el centro. La tira de
// cámaras, en el celu, es una línea horizontal en la franja entre la oficina y
// el chat, y el chat baja lo justo para hacerle lugar.
//
// El botón de la E arrancó con display:none en la regla base y display:block
// solo en la media query de móvil. Cuando esa línea se perdió al editar el
// bloque, el botón desapareció por completo en el celu sin romper nada visible:
// no había error, solo no estaba. Y el JS que lo posicionaba hacia display=''
// en el caso normal, que es lo mismo que none, así que el fallo se escondía dos
// veces.
//
// También se chequea el bug que desarmaba el layout del celu: layoutDesktopAudio
// (que se llama en CADA mensaje del server, desde renderPlayerList) limpiaba el
// estilo del chat y de la tira, y el layout del celu no se sostenía.
//
// Sin dependencias: revisa el texto, no ejecuta el layout. La prueba de verdad
// es verificar-v107.js (navegador real, con la cámara encendida) y
// verificar-joystick.js (dedo de verdad sobre el aro y sobre la E).
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

let malas = 0;
const ok = (c, et) => { console.log(`  ${c ? '✅' : '❌'} ${et}`); if (!c) malas++; };

console.log('🕹️ Controles táctiles en el celu (v107)\n');

const movil = css.slice(css.indexOf('@media (max-width: 900px)'));

// 1) los dos controles tienen que prenderse en el celu
ok(/#stick\s*\{[^}]*display:\s*block/.test(movil), 'la regla móvil de #stick tiene display:block');
ok(/#btnE\s*\{[^}]*display:\s*block/.test(movil), 'la regla móvil de #btnE tiene display:block');
ok(/#btnE\s*\{[^}]*z-index:\s*36/.test(movil), 'la E va por encima del aro (que el toque sea de la E)');
ok(/#camStrip\s*\{[^}]*flex-direction:\s*row/.test(movil), 'la tira de cámaras es una fila en el celu');

// 2) la E en el centro del joystick, y el grupo contra el borde de abajo
ok(/btnEEl\.style\.left = Math\.round\(stickLeft \+ \(sS - eS\) \/ 2\)/.test(js),
   'la E se centra horizontalmente en el joystick');
ok(/btnEEl\.style\.top = Math\.round\(stickTop \+ \(sS - eS\) \/ 2\)/.test(js),
   'la E se centra verticalmente en el joystick');
ok(/const stickTop = Math\.round\(h - MARGEN - sS\)/.test(js),
   'el control se ancla contra el borde de abajo (queda bajito)');

// 3) display:block explícito en el celu y limpieza al salir de móvil
const fnLayout = js.slice(js.indexOf('function layoutMobile'));
const ramaNoMovil = fnLayout.slice(0, fnLayout.indexOf('return;'));
ok(/btnEEl\.style\.display = '';/.test(ramaNoMovil), 'al salir de móvil se limpia el display inline');
ok(/btnEEl\.style\.display = 'block';/.test(fnLayout.slice(ramaNoMovil.length)),
   'en el celu el display se pone en block explícito, nunca en \'\'');

// 4) la tira de cámaras: fila en la franja, y el chat baja lo justo
ok(/stripEl\.style\.flexDirection = 'row'/.test(js), 'la tira se pone en fila');
ok(/chatTop = sceneBottom \+ 6 \+ film \+ 6/.test(js), 'el chat baja lo justo para hacerle lugar a la tira');
ok(/const film = Math\.round\(Math\.min\(FILM_IDEAL, banda - CHAT_MIN\)\)/.test(js),
   'la tira se achica antes de dejarle sin aire al chat');
ok(/else\s*\{\s*stripEl\.style\.display = 'none'/.test(js), 'si no entra, la tira se esconde');

// 5) el layout del celu no se puede desarmar desde el layout de escritorio
const fnEscritorio = js.slice(js.indexOf('function esMovil'), js.indexOf('function layoutMobile'));
const iMovil = fnEscritorio.indexOf('if (esMovil())');
const iLimpiaChat = fnEscritorio.indexOf("chatP.style.top = ''");
ok(iMovil !== -1 && iLimpiaChat !== -1 && fnEscritorio.indexOf('layoutMobile();', iMovil) < iLimpiaChat,
   'en el celu layoutDesktopAudio recalcula con layoutMobile y recien después, y solo si no es el celu, limpia el chat');
ok(/if \(esMovil\(\)\) \{[\s\S]{0,700}?return;/.test(fnEscritorio),
   'en el celu layoutDesktopAudio sale antes de tocar los estilos de escritorio');
ok(/if \(cambio\) layoutMobile\(\)/.test(js),
   'prender o apagar la cámara recalcula la franja del celu');

// 6) los textos de la cámara no dicen "a la derecha" (ya no es así en el celu)
ok(!/cuadrados de la derecha/.test(html) && !/cuadrados de la derecha/.test(js),
   'el botón de la cámara no promete "los cuadrados de la derecha"');
ok(/id="btnE"/.test(html) && /id="stick"/.test(html) && /id="camStrip"/.test(html),
   'los tres controles siguen en el HTML');

console.log('');
if (malas) {
  console.log(`❌ ${malas} problema(s) con los controles del celu.`);
  process.exit(1);
}
console.log('✅ Control único abajo a la derecha con la E en el centro, cámaras en fila y layout estable.');
