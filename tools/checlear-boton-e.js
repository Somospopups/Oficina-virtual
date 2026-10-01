// Guard de los controles táctiles en el celu (v108).
//
// Desde v108 los controles son UN solo círculo CENTRADO en el lado derecho: el
// aro es el joystick y la E de acción va chiquita en el centro. Como el pulgar
// cae en el medio casi siempre, el botón no se queda con el gesto: si el dedo
// arranca en la E y después arrastra, el gesto pasa al joystick (hub). Tap en el
// centro = acción, arrastre desde el centro = moverse.
//
// La tira de cámaras, en el celu, es una línea horizontal en la franja entre la
// oficina y el chat, y el chat baja lo justo para hacerle lugar.
//
// Antes de v107 el botón de la E tenía display:none en la regla base y
// display:block solo en la media query: al perderse esa línea el botón
// desaparecía del celu sin romper nada visible.
//
// También se chequea el bug que desarmaba el layout del celu: layoutDesktopAudio
// (que se llama en CADA mensaje del server, desde renderPlayerList) limpiaba el
// estilo del chat y de la tira, y el layout del celu no se sostenía.
//
// Sin dependencias: revisa el texto, no ejecuta el layout. La prueba de verdad
// es verificar-v107.js (navegador real, con la cámara encendida) y
// verificar-joystick.js (dedo de verdad sobre el aro, sobre la E y arrancando
// desde el centro).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.resolve(__dirname, '..');
const RAIZ = raiz;
const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

let malas = 0;
const ok = (c, et) => { console.log(`  ${c ? '✅' : '❌'} ${et}`); if (!c) malas++; };

console.log('🕹️ Controles táctiles en el celu + dibujos siempre frescos (v111)\n');

const movilTemprano = css.slice(css.indexOf('@media (max-width: 900px)'), css.indexOf('@media (max-width: 900px)') + 4000);
// el ÚLTIMO media query del celu que tenga reglas de la tira (puede haber
// media queries más al final para otra cosa, como los cuatro botones de arriba)
let movilTarde = '';
{
  let i = css.indexOf('@media (max-width: 900px)');
  while (i !== -1) {
    const bloque = css.slice(i, css.indexOf('\n}', i) + 2);
    if (/#camStrip\s*\{/.test(bloque)) movilTarde = bloque;   // el bloque con la regla de la tira, no uno que solo la mencione
    i = css.indexOf('@media (max-width: 900px)', i + 1);
  }
}

// 1) los dos controles tienen que prenderse en el celu
ok(/#stick\s*\{[^}]*display:\s*block/.test(movilTemprano), 'la regla móvil de #stick tiene display:block');
ok(/#btnE\s*\{[^}]*display:\s*block/.test(movilTemprano), 'la regla móvil de #btnE tiene display:block');
ok(/#btnE\s*\{[^}]*z-index:\s*36/.test(movilTemprano), 'la E va por encima del aro (que el toque del centro sea la E)');
ok(/#btnE\s*\{[^}]*width:\s*42px/.test(movilTemprano), 'la E arranca chica: si se come el centro, no se mueve');
ok(/relojEl\.style\.maxWidth = \(anchoLibre >= 60 \? anchoLibre : 60\)/.test(js),
   'el reloj se acota justo hasta la barra de botones (nunca debajo, nunca recortado de más)');
ok(/:root \{ --alto-barra: 34px; \}/.test(css) &&
   /#micCallBtn, #camBtn, #shareBtn, #musicBtn \{\s*width: var\(--alto-barra\); height: var\(--alto-barra\)/.test(css) &&
   /#clock \{[^}]*height: var\(--alto-barra\)/.test(css),
   'los cuatro botones miden lo mismo que el renglón de la hora: no sobresalen');
ok(/#statusBar, #playerList \{ display: none !important; \}/.test(css),
   'en el celu no están los botones de estado ni el panel de jugadores (se usan tocando al personaje)');
ok(/const FILM_IDEAL = 140/.test(js), 'los cuadros de cámara están arriba y más grandes (140px)');
ok(/const AIRE = 12/.test(js), 'un solo aire para los tres cortes de arriba (barra, cámaras, oficina)');
ok(/Math\.min\(MAX, esMovil\(\) \? Math\.max\(1, todos\.length\) : 3\)/.test(js),
   'en el celu la fila muestra solo la gente que hay: sin cuadros vacíos que parezcan agujeros');
ok(/const barraBottom = callBarEl \? callBarEl\.getBoundingClientRect\(\)\.bottom/.test(js) &&
   /stripEl\.style\.top = tiraTop \+ 'px'/.test(js),
   'la fila de cámaras se ancla abajo de la barra de arriba, no a la oficina');
ok(/viewOY = zonaTop/.test(js) && /const zonaTop = tiraBottom \+ AIRE/.test(js),
   'la oficina va pegada bajo los cuadros, con el mismo aire que arriba');
ok(/callBarEl\.insertBefore\(musicEl, callBarEl\.firstChild\)/.test(js) && /topEl\.appendChild\(musicEl\)/.test(js),
   'los cuatro botones de arriba comparten una sola barra en el celu (separación igual) y el escritorio no se toca');
ok(/#callBar \{ gap: 6px; align-items: center; \}/.test(css), 'la separación entre los cuatro botones es la misma para todos');
ok(/#stick\s*\{[^}]*width:\s*118px/.test(movilTemprano), 'el aro arranca en 118px: chico pero con aro libre de 41px para el pulgar');

// 2) la tira de cámaras en fila: la regla tiene que ir en el media query DEL FIN
ok(/#camStrip\s*\{[^}]*flex-direction:\s*row/.test(movilTarde),
   'la tira de cámaras en fila está en el media query del final del archivo');
ok(/#camStrip\s*\{[^}]*width:\s*auto/.test(movilTarde),
   'la tira no hereda los 110px de la columna del riel (si no, se ve un cuadro solo)');
ok(!/#camStrip\s*\{[^}]*flex-direction:\s*row/.test(movilTemprano.slice(0, movilTemprano.indexOf('#camStrip .cam-slot'))),
   'no queda una regla de tira en el media query de arriba, que la pisa la base');

// 3) la E en el centro del aro, y el aro centrado en el lado derecho
ok(/btnEEl\.style\.left = Math\.round\(stickLeft \+ \(sS - eFinal\) \/ 2\)/.test(js),
   'la E se centra horizontalmente en el aro');
ok(/btnEEl\.style\.top = Math\.round\(stickTop \+ \(sS - eFinal\) \/ 2\)/.test(js),
   'la E se centra verticalmente en el aro');
// v111: el círculo se centra en la franja que queda DEBAJO de la fila de
// cámaras, para no invadirle el renglón (antes se solapaba con los cuadros).
ok(/const stickTop = Math\.round\(chatTop - 6 \+ \(libre - sS\) \/ 2\)/.test(js) &&
   /const libre = altoChat \+ 6/.test(js),
   'el control va CENTRADO en la franja del chat, abajo a la derecha, no pegado a la esquina');
ok(/STICK_MAX = 118, STICK_MIN = 106, E_PORC = 0\.30/.test(js),
   'el aro mide hasta 118 y nunca baja de 106 (por debajo el pulgar no llega)');
ok(/const tiraBottom = hayCam && film >= FILM_MIN \? tiraTop \+ film : barraBottom \+ AIRE/.test(js),
   'el layoutMobile sabe hasta dónde baja la fila de cámaras antes de ubicar el círculo');
ok(/chatEl\.style\.right = \(vw - stickLeft \+ CHAT_GAP\) \+ 'px'/.test(js),
   'el chat cede el ancho justo para que el aro no lo pise');

// 4) el hub: tap en el centro = acción, arrastre desde el centro = joystick
ok(/const HUECO = 9/.test(js), 'el gesto cambia de acción a joystick a los 9px de arrastre');
ok(/if \(!esStick && Math\.hypot\(e\.clientX - ex0, e\.clientY - ey0\) > HUECO\) esStick = true/.test(js),
   'arrastrar desde la E pasa el gesto al joystick');
ok(/if \(esStick\) \{ setFrom\(e\); e\.preventDefault\(\); \}/.test(js),
   'el joystick se mueve desde el gesto que arrancó en la E');
ok(/if \(esStick\) \{ end\(\); return; \}[\s\S]{0,120}accionE\(\)/.test(js),
   'solo un toque (sin arrastre) dispara la acción de la E');
ok(!/btnEEl\.addEventListener\('touchstart'/.test(js),
   'la E ya no dispara con touchstart: si no, el arrastre desde el centro no llega al joystick');

// 5) display:block explícito en el celu y limpieza al salir de móvil
const fnLayout = js.slice(js.indexOf('function layoutMobile'));
const ramaNoMovil = fnLayout.slice(0, fnLayout.indexOf('return;'));
ok(/btnEEl\.style\.display = '';/.test(ramaNoMovil), 'al salir de móvil se limpia el display inline');
ok(/chatEl\.style\.right = ''/.test(ramaNoMovil), 'al salir de móvil el chat recupera su ancho');
ok(/btnEEl\.style\.display = 'block';/.test(fnLayout.slice(ramaNoMovil.length)),
   'en el celu el display se pone en block explícito, nunca en \'\'');

// 6) la tira: fila en la franja, y el chat baja lo justo
ok(/stripEl\.style\.flexDirection = 'row'/.test(js), 'la tira se pone en fila');
ok(/stripEl\.style\.width = \(vw - 16\) \+ 'px'/.test(js), 'la fila de cámaras usa todo el ancho (el joystick ya no está al lado)');
ok(!/HUECO_TIRA|filmAncho/.test(js),
   'los cuadros ya no se encogen para que entren 3: la fila se desliza');
ok(/const altoChat = Math\.round\(Math\.max\(CHAT_MIN, Math\.min\(CHAT_MAX, h - tiraBottom - AIRE - ESCENA_MIN - 12\)\)/.test(js) &&
   /const chatTop = h - 8 - altoChat/.test(js),
   'el chat se queda con el alto justo para no invadir los cuadros ni la oficina');
ok(/else\s*\{\s*stripEl\.style\.display = 'none'/.test(js), 'si no entra, la tira se esconde');
ok(/backdropDirty = true/.test(js), 'al mover la oficina se repinta el fondo (si no queda el viejo)');

// 6b) fila deslizable y el que habla siempre primero
ok(/const MAX = esMovil\(\) \? 8 : 3/.test(js), 'en el celu la fila hace lugar para hasta 8 cámaras');
ok(/strip\.scrollLeft = 0/.test(js), 'cuando cambia el primero la fila vuelve al principio');
ok(/\(b\.me \? 1 : 0\) - \(a\.me \? 1 : 0\)/.test(js), 'si nadie habla, tu cuadro queda primero');
ok(/niveles\.sort\(\(a, b\) => b\[1\] - a\[1\]\)/.test(js) &&
   /key \+= peer;\s*\n\s*if \(key !== rtcHablandoPrev\)/.test(js) &&
   /if \(key !== rtcHablandoPrev\)[\s\S]{0,400}renderCamStrip\(\)/.test(js),
   'el detector de voz reordena la fila cuando cambia el hablante');
ok(/overflow-x:\s*auto/.test(css), 'la fila se desliza con el dedo');
ok(/scroll-snap-type:\s*x proximity/.test(css), 'la fila se acomoda al deslizar');

// 7) el layout del celu no se puede desarmar desde el layout de escritorio
const fnEscritorio = js.slice(js.indexOf('function esMovil'), js.indexOf('function layoutMobile'));
const iMovil = fnEscritorio.indexOf('if (esMovil())');
const iLimpiaChat = fnEscritorio.indexOf("chatP.style.top = ''");
ok(iMovil !== -1 && iLimpiaChat !== -1 && fnEscritorio.indexOf('layoutMobile();', iMovil) < iLimpiaChat,
   'en el celu layoutDesktopAudio recalcula con layoutMobile y solo limpia el chat si NO es el celu');
ok(/if \(cambio\) layoutMobile\(\)/.test(js),
   'prender o apagar la cámara recalcula la franja del celu');

// 8) los textos de la cámara no dicen "a la derecha" (ya no es así en el celu)
ok(!/cuadrados de la derecha/.test(html) && !/cuadrados de la derecha/.test(js),
   'el botón de la cámara no promete "los cuadrados de la derecha"');
ok(/id="btnE"/.test(html) && /id="stick"/.test(html) && /id="camStrip"/.test(html),
   'los tres controles siguen en el HTML');

// 9) los dibujos NUNCA pueden salir viejos del caché: cada PNG se pide con un
// hash de su propio contenido (assets.js, generado por tools/generar-assets.js).
ok(/assets\.js\?t=/.test(html), 'el mapa de hashes de los dibujos se carga siempre fresco');
ok(/function urlAsset\(ruta\)/.test(js), 'las imágenes se piden con urlAsset()');
ok(!/\?v=1\.|\?v=2['"`]/.test(js), 'no queda ningún ?v= escrito a mano (se olvidaría al cambiar un dibujo)');
ok(/const ASSET_T = 't=' \+ Date\.now\(\)/.test(js) && /\|\| ASSET_T/.test(js),
   'si el index.html llega viejo al caché, igual se piden los dibujos frescos (respaldo)');
ok(fs.existsSync(path.join(RAIZ, 'assets.js')), 'assets.js existe en el repo');
if (fs.existsSync(path.join(RAIZ, 'assets.js'))) {
  const crudo = fs.readFileSync(path.join(RAIZ, 'assets.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const mapa = JSON.parse(crudo.replace(/^window\.ASSETS\s*=\s*/, '').replace(/;\s*$/, ''));
  let desfasados = [], faltan = [];
  for (const [ruta, v] of Object.entries(mapa)) {
    const f = path.join(RAIZ, ruta);
    if (!fs.existsSync(f)) { faltan.push(ruta); continue; }
    const real = 'v=' + crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
    if (real !== v) desfasados.push(ruta);
  }
  ok(!faltan.length, 'todos los dibujos del mapa existen', faltan.join(', '));
  ok(!desfasados.length, 'el hash de cada dibujo coincide con su contenido (nada de dibujos viejos)',
     desfasados.length ? 'desfasados: ' + desfasados.join(', ') + ' — correr node tools/generar-assets.js' : Object.keys(mapa).length + ' dibujos con hash correcto');
}

// ---------- Que el index.html no pueda llegar viejo ----------
// Si el sello del html y la VERSION de game.js se separan, el guardian de
// game.js recargaria en loop (o no recargaria nunca). Tiene que coincidir.
const selloHtml = (html.match(/<meta name="ov-build" content="([^"]+)"/) || [])[1];
const verJs = (js.match(/const VERSION = '(v\d+)/) || [])[1];
ok(!!selloHtml, 'el index.html lleva el sello <meta name="ov-build">');
ok(!!verJs, 'game.js tiene su VERSION');
ok(selloHtml === verJs, 'el sello del html y la VERSION de game.js coinciden',
   selloHtml === verJs ? selloHtml : `html=${selloHtml} vs js=${verJs} — actualizá los dos`);
ok(/name="ov-build"/.test(js) && /location\.replace/.test(js),
   'game.js detecta el html viejo y lo recarga');
ok(/sessionStorage/.test(js.slice(js.indexOf('htmlFresco'), js.indexOf('htmlFresco') + 1400)),
   'la recarga se hace una sola vez (sin bucle)');

// ---------- Los emojis del chat se tienen que ver ----------
ok(/<i class="ico">📎<\/i>/.test(html), 'el 📎 va envuelto para poder aclararlo');
ok(/#chatAux button \.ico[^}]*filter:[^}]*brightness/.test(css),
   'el brillo se le aplica al dibujito, no al botón (si no, se aclara el fondo)');
ok(!/#attBtn\s*\{[^}]*filter/.test(css),
   'el filtro NO está en el botón entero (rompería la uniformidad con el 🙂)');

console.log('');
if (malas) {
  console.log(`❌ ${malas} problema(s) con los controles del celu.`);
  process.exit(1);
}
console.log('✅ Aro centrado a la derecha con la E en el centro, hub para el dedo, cámaras en fila y layout estable.');
