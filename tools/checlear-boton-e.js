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
const movilTarde = css.slice(css.lastIndexOf('@media (max-width: 900px)'));

// 1) los dos controles tienen que prenderse en el celu
ok(/#stick\s*\{[^}]*display:\s*block/.test(movilTemprano), 'la regla móvil de #stick tiene display:block');
ok(/#btnE\s*\{[^}]*display:\s*block/.test(movilTemprano), 'la regla móvil de #btnE tiene display:block');
ok(/#btnE\s*\{[^}]*z-index:\s*36/.test(movilTemprano), 'la E va por encima del aro (que el toque del centro sea la E)');
ok(/#btnE\s*\{[^}]*width:\s*42px/.test(movilTemprano), 'la E arranca chica: si se come el centro, no se mueve');
ok(/#stick\s*\{[^}]*width:\s*130px/.test(movilTemprano), 'el aro arranca grande: tiene que quedar ancho para el pulgar');

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
ok(/const libre = h - tiraBottom - 8/.test(js) &&
   /const stickTop = Math\.round\(tiraBottom \+ \(libre - sS\) \/ 2\)/.test(js),
   'el control va CENTRADO en la franja derecha, debajo de la fila de cámaras, no pegado a la esquina');
ok(/STICK_MAX = 118, STICK_MIN = 106, E_PORC = 0\.30/.test(js),
   'el aro mide hasta 118 y nunca baja de 106 (por debajo el pulgar no llega)');
ok(/tiraBottom = chatTop - abajo/.test(js) && /let tiraBottom = sceneBottom/.test(js),
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
ok(/stripEl\.style\.width = anchoLibre \+ 'px'/.test(js), 'la tira llega hasta el borde del aro y no lo pisa');
ok(/const FILM_IDEAL = 88/.test(js), 'los cuadros de video se agrandan (88px)');
ok(!/HUECO_TIRA|filmAncho/.test(js),
   'los cuadros ya no se encogen para que entren 3: la fila se desliza');
ok(/const FILM_ARRIBA = 8/.test(js) && /chatTop = sceneBottom \+ FILM_ARRIBA \+ film \+ abajo/.test(js),
   'el chat baja lo justo para hacerle lugar a la tira, con aire entre los dos');
ok(/else\s*\{\s*stripEl\.style\.display = 'none'/.test(js), 'si no entra, la tira se esconde');

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

console.log('');
if (malas) {
  console.log(`❌ ${malas} problema(s) con los controles del celu.`);
  process.exit(1);
}
console.log('✅ Aro centrado a la derecha con la E en el centro, hub para el dedo, cámaras en fila y layout estable.');
