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
const zlib = require('zlib');

const raiz = path.resolve(__dirname, '..');
const RAIZ = raiz;
const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const srv = fs.readFileSync(path.join(raiz, 'server.js'), 'utf8');

let malas = 0;
const ok = (c, et) => { console.log(`  ${c ? '✅' : '❌'} ${et}`); if (!c) malas++; };

console.log('🕹️ Guard general: controles táctiles, dibujos frescos, historial y ROSTER\n');

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

// 8b) la pantalla compartida le llega al espectador: el iniciador oferta
// aunque el par ya exista sin negociar (antes los dos lados esperaban la
// oferta del otro y el espectador veía negro), y en espectador se ve en
// grande hasta que se corta la transmisión.
ok(/function rtcAsegurarOferta\(peer\)/.test(js) && /rtcAsegurarOferta\(msg\.from\)/.test(js),
   'el iniciador oferta aunque el par exista sin negociar');
ok(/panel\.classList\.toggle\('share-full', state\.spectating\)/.test(js) &&
   /panel\.classList\.remove\('share-full'\)/.test(js),
   'la pantalla se agranda sola en el espectador y sale del modo al cortar');
ok(/body\.spectator-mode #videoPanel\.share-full/.test(css) && /height: 100vh/.test(css),
   'el modo grande del espectador ocupa toda la pantalla');

// 8e) el reloj muestra hora · clima · versión, y la versión actualiza sin
// salir: busca el sello publicado y si hay algo nuevo recarga y reingresa.
ok(/['"]clockHora['"]/.test(js) && /['"]clockVer['"]/.test(js) && /['"]clockSep['"]/.test(js) && /#clockVer/.test(css),
   'el reloj muestra hora y versión por separado (el · no se subraya)');
ok(/function versionRefrescar\(\)/.test(js) && /ov-build/.test(js) && /\?fresco=/.test(js),
   'la versión busca actualización y recarga en fresco');
ok(/sessionStorage\.setItem\('ovDni'/.test(js) && /ovAuto/.test(js),
   'tras actualizar se vuelve a entrar solo con el DNI de la pestaña');

// 8c) el 📷 es el interruptor de la videoconferencia: muestra y al volver a
// presionar desaparece (nada de tira pegajosa que quede siempre visible).
ok(/camStripAbierta/.test(js) && !/camStripSticky/.test(js),
   'la tira de cámaras es un toggle, no queda pegada');
ok(/camStripAbierta && rtcCamOn\) \{\s*\n\s*camStripAbierta = false/.test(js),
   'al volver a presionar se ocultan las cámaras');

// 8d) la llamada se diagnostica y se repara: el panel de red muestra la malla
// por compañero con botón de reintento, la caída se reintenta sola con ICE
// restart, y hay TURN opcional por entorno (sin credenciales en el repo).
ok(/rtcMallaLineas\(\)/.test(js) && /npRetry/.test(js),
   'el panel de red muestra la malla por compañero y reintenta');
ok(/restartIce/.test(js) && /rtcProgramarReintento/.test(js),
   'la llamada caída se reintenta sola con ICE restart');
ok(/turn\.json/.test(js) && /turn\.json/.test(srv) && /TURN_URLS/.test(srv),
   'hay TURN opcional por variables de entorno');

// 9) los dibujos NUNCA pueden salir viejos del caché: cada PNG se pide con un
// hash de su propio contenido (assets.js, generado por tools/generar-assets.js).
// El mapa y los .css/.js se versionan con ?v= (sin document.write bloqueante).
ok(/assets\.js\?(t=|v=)/.test(html), 'el mapa de hashes de los dibujos se carga versionado');
ok(!/document\.write/.test(html), 'el HTML no usa document.write (bloqueante)');
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

// ---------- Los controles del chat, todos de la misma altura ----------
// El campo de escribir, el micro/enviar y los botones de clip y emoji tienen
// que medir EXACTAMENTE lo mismo, y salir de una sola variable. Antes eran dos
// alturas sueltas (38 y 28) escritas a mano y se veian desparejos.
ok(/:root \{ --chat-ctl: \d+px; \}/.test(css), 'existe una sola altura para los controles del chat (--chat-ctl)');
const usaVar = (sel) => {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}'));
  return !!m && /var\(--chat-ctl\)/.test(m[0]);
};
ok(usaVar('#chatAux button'), 'el clip y el emoji toman su alto de --chat-ctl');
ok(usaVar('#chatPill button'), 'el micro y el enviar toman su alto de --chat-ctl');
ok(usaVar('#chatRow #chatInput'), 'el campo de escribir toma su alto de --chat-ctl');
ok(usaVar('#recBar'), 'la barra de grabacion tambien (no salta al grabar)');
ok(/body\.desktop-rails #chatPill button \{[^}]*var\(--chat-ctl\)/.test(css),
   'en pantalla panoramica tampoco se escribe el alto a mano');
// Ojo: 'max-height: 96px' en el campo es legitimo (el tope de ~5 renglones del
// textarea que crece solo). Lo que no puede haber es height/min-height a mano.
ok(!/#(chatPill|chatRow #chatInput|recBar|chatAux)[^{]*\{[^}]*(?<![a-z-])(min-)?height:\s*\d+px/.test(css),
   'ningun control del chat fija su altura a mano (solo el tope del textarea)');

// El clip y el emoji no pueden quedar apoyados sobre la linea que arranca #chatRow
const auxRegla = (css.match(/#chatAux \{[^}]*\}/) || [''])[0];
const padAux = (auxRegla.match(/padding:\s*([^;]+);/) || [])[1] || '';
const partes = padAux.trim().split(/\s+/);
const abajo = parseFloat(partes.length >= 3 ? partes[2] : partes[0]);
ok(abajo > 0, `el clip y el emoji tienen aire antes de la linea (padding-bottom: ${partes.length >= 3 ? partes[2] : partes[0]})`,
   abajo > 0 ? '' : 'en 0 quedan apoyados encima de la linea');

// ---------- Historial de la oficina ----------
// El bus usa kind 20001, que es EFIMERO: los relays no lo guardan. El historial
// tiene que viajar por un kind que si se archive, o no habria nada que mostrar.
{
  const kind = +(js.match(/const HIST_KIND = (\d+)/) || [])[1];
  ok(kind && !(kind >= 20000 && kind <= 29999),
     `el historial usa un kind que los relays guardan (${kind})`,
     'entre 20000 y 29999 son efimeros: el dato se perderia');
}
// Cada persona del ROSTER necesita su clave para que se le puedan atribuir las
// sesiones. Si entra alguien nuevo y no se agrega aca, su historial no existe.
{
  const chars = [...js.matchAll(/\{ dniHash: '[0-9a-f]{64}',\s*name: '[^']+',\s*char: '(\w+)'/g)].map((m) => m[1]);
  const bloque = (js.match(/const HIST_PUB = \{[^}]*\}/) || [''])[0];
  const faltan = chars.filter((c) => !new RegExp(`\\b${c}:\\s*'[0-9a-f]{64}'`).test(bloque));
  ok(chars.length > 0 && faltan.length === 0,
     'todos los del ROSTER tienen su clave en HIST_PUB',
     faltan.length ? `les falta a: ${faltan.join(', ')}` : '');
}
// El ROSTER no puede volver a guardar DNI en crudo: el repo es publico y, en
// modo P2P, el 'profile' sale por los relays (tambien publicos). Guardamos el
// SHA-256 de (salt + dni). Es PRIVACIDAD, no seguridad: un DNI son 8 digitos y
// se fuerza bruta; lo que no puede ser es que quede escrito en el repo.
{
  const enCrudo = (t) => (t.match(/\bdni\s*:\s*'\d{7,8}'/g) || []).length;
  const malas = enCrudo(js) + enCrudo(srv);
  ok(malas === 0, 'ningun DNI en crudo en el ROSTER (game.js ni server.js)',
     malas ? `aparecen ${malas} entradas con dni: '<numero>': usá dniHash` : '');
}
// game.js y server.js tienen la misma lista de hashes y el mismo salt. Si se
// desincronizan, en modo servidor le rebota a alguien que entra bien en GitHub
// Pages (alli el ROSTER es el de game.js).
{
  const hashes = (t) => [...t.matchAll(/\{ dniHash: '([0-9a-f]{64})'/g)].map((m) => m[1]);
  const g = hashes(js), s = hashes(srv);
  const salt = (t) => (t.match(/ROSTER_DNI_SALT = '([^']+)'/) || [])[1];
  ok(g.length > 0 && g.length === s.length,
     `el ROSTER tiene las mismas ${g.length} personas en game.js y en server.js`,
     `game.js=${g.length} server.js=${s.length}`);
  ok(JSON.stringify(g) === JSON.stringify(s),
     'los hashes del ROSTER son identicos, en el mismo orden, en game.js y en server.js',
     'agrega la persona en los DOS archivos y con el mismo hash');
  ok(!!salt(js) && salt(js) === salt(srv),
     'el salt de los DNI es el mismo en game.js y en server.js',
     `game.js=${salt(js)} server.js=${salt(srv)}`);
}
// El historial esta OCULTO: no tiene boton ni panel propio, aparece al tocar
// el nombre de alguien en la lista de companeros.
ok(!/histBtn|histPanel/.test(html) && !/histBtn|histPanel/.test(css) && !/histBtn|histPanel/.test(js),
   'el historial no tiene boton ni panel propio (va oculto en la lista)');
ok(/histDetalle\(p\.char\)/.test(js) && /histAbiertos\.has\(p\.char\)/.test(js),
   'el detalle solo se dibuja en la fila que esta desplegada');
ok(/playerListBox\.addEventListener\('pointerdown'/.test(js) && /histAlternarFila/.test(js),
   'tocar un nombre de la lista abre y cierra su historial',
   'tiene que ser pointerdown: la lista se redibuja y un click se perderia');
ok(/\.pl-hist\s*\{/.test(css) && /flex: 0 0 100%/.test(css),
   'el detalle ocupa el ancho de la fila y queda adentro del riel');
// El equipo que no esta tiene que figurar igual: si no, solo se podria mirar
// el historial de los que justo estan conectados.
ok(/const fuera = ROSTER\.filter/.test(js) && /pl-row ausente/.test(js) && /\.pl-row\.ausente/.test(css),
   'los que no estan aparecen en gris al final y tambien se les puede tocar');
// Las visitas (gente que no es de la oficina) entran y se las ve, pero no se
// las lista en gris cuando no estan.
ok(/visita: true/.test(js) && /!dentro\.has\(r\.char\) && !r\.visita/.test(js),
   'las visitas quedan afuera de la lista gris',
   'si se agrega una visita al ROSTER, marcarla visita:true en game.js Y en server.js');
// ---- Animaciones sentado (cafe, birra, lo que venga) ----
// Los dibujos traen la silla adentro: de pie no hay que ofrecerlas.
// El tope de escala no puede depender de assetsReady (bandera global, se
// prende recien cuando bajaron los dibujos de los cinco): el que ya tiene el
// suyo se dibujaria gigante mientras cargan los demas.
ok(/const s = ca\.down \? Math\.min\(sRaw, baseH \/ 44\) : sRaw;/.test(js)
   && !/const conAsset = assetsReady/.test(js),
   'el tope de escala sale del sprite propio, no de assetsReady');
// Y nada pesado puede pelearle las conexiones a la oficina mientras carga.
ok(/if \(!assetsReady \|\| animBajando\) \{ setTimeout\(\(\) => animCargar/.test(js)
   && /fetchPriority/.test(js),
   'los dibujos de las animaciones esperan a que cargue la oficina y bajan de a uno');
ok(/function dibujarCarga/.test(js) && /Cargando la oficina/.test(js),
   'hay cartel de carga mientras faltan dibujos');

ok(/if \(p\.seated\) for \(const n of animDe\(p\.char\)\)/.test(js),
   'las animaciones se ofrecen solo estando sentado');

// La tabla de animaciones de game.js manda: de ahi salen los chequeos.
const anims = [];
{
  const tabla = (js.match(/const ANIMS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  for (const m of tabla.matchAll(/(\w+):\s*\{[^}]*quien:\s*\{([^}]*)\}/g)) {
    const quien = [...m[2].matchAll(/(\w+)\s*:\s*(\d+)/g)].map((q) => [q[1], Number(q[2])]);
    anims.push({ nombre: m[1], quien });
  }
  ok(anims.length > 0 && anims.every((a) => a.quien.length > 0), 'se pudo leer la tabla ANIMS');
}
// Cada personaje de la tabla tiene que tener sus 4 PNG, o la accion aparece
// en el menu y despues no pasa nada.
{
  const faltan = [];
  for (const a of anims) for (const [char, n] of a.quien) {
    for (let i = 1; i <= n; i++) {
      const f = `${char}_${a.nombre}${i}.png`;
      if (!fs.existsSync(path.join(raiz, 'sprites', f))) faltan.push(f);
    }
  }
  ok(faltan.length === 0, 'estan todos los dibujos de los que figuran en ANIMS',
     faltan.length ? 'faltan: ' + faltan.join(', ') : '');
}
// Cada cuadro de animación tiene su gemelo liviano en WebP (~10% del PNG):
// animCargar() lo pide primero y cae al PNG si el navegador no lo entiende.
// Sin el .webp, la tanda baja los ~2 MB del PNG.
{
  const faltan = [];
  for (const a of anims) for (const [char, n] of a.quien) {
    for (let i = 1; i <= n; i++) {
      const f = `${char}_${a.nombre}${i}.webp`;
      if (!fs.existsSync(path.join(raiz, 'sprites', f))) faltan.push(f);
    }
  }
  ok(faltan.length === 0, 'cada cuadro de animación tiene su WebP liviano',
     faltan.length ? 'faltan: ' + faltan.join(', ') : '');
}
// La bailarina del caño (sólo Ger): 6 cuadros en PNG + WebP. Tienen que estar
// los 12 y medir exactamente lo mismo: el caño queda clavado sólo si los 6
// lienzos son idénticos.
{
  const faltan = [];
  for (let i = 1; i <= 6; i++) for (const ext of ['png', 'webp']) {
    if (!fs.existsSync(path.join(raiz, 'sprites', `pole${i}.${ext}`))) faltan.push(`pole${i}.${ext}`);
  }
  ok(faltan.length === 0, 'están los 12 dibujos de la bailarina (PNG + WebP)',
     faltan.length ? 'faltan: ' + faltan.join(', ') : '');
}
{
  const tams = new Set();
  for (let i = 1; i <= 6; i++) {
    try {
      const b = fs.readFileSync(path.join(raiz, 'sprites', `pole${i}.png`));
      tams.add(b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));   // ancho x alto del IHDR
    } catch {}
  }
  ok(tams.size === 1, 'los 6 cuadros de la bailarina miden lo mismo (el caño no salta)',
     [...tams].join(', '));
}
// El caño queda clavado porque POLE.xRel apunta a su columna real: si se
// reprocesa la hoja y el caño cae en otra x, el juego lo dibujaría corrido.
// Se decodifica el PNG (zlib propio, sin dependencias) y se busca la banda
// gris vertical en cada cuadro.
{
  const leerPng = (f) => {
    const b = fs.readFileSync(path.join(raiz, 'sprites', f));
    if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('no es PNG');
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    const tipo = b[25], prof = b[24];
    if (prof !== 8 || (tipo !== 2 && tipo !== 6)) throw new Error('sólo RGB(A) 8 bits');
    const ch = tipo === 6 ? 4 : 3;
    let pos = 33, datos = [];
    while (pos < b.length) {
      const n = b.readUInt32BE(pos), tipoC = b.toString('ascii', pos + 4, pos + 8);
      if (tipoC === 'IDAT') datos.push(b.subarray(pos + 8, pos + 8 + n));
      pos += 12 + n;
    }
    const crudo = zlib.inflateSync(Buffer.concat(datos));
    const px = Buffer.alloc(w * h * ch);
    const fila = w * ch;
    let p = 0;
    for (let y = 0; y < h; y++) {
      const filtro = crudo[p++];
      for (let x = 0; x < fila; x++) {
        const izq = x >= ch ? px[y * fila + x - ch] : 0;
        const arr = y > 0 ? px[(y - 1) * fila + x] : 0;
        const dia = (x >= ch && y > 0) ? px[(y - 1) * fila + x - ch] : 0;
        let v = crudo[p++];
        if (filtro === 1) v += izq;
        else if (filtro === 2) v += arr;
        else if (filtro === 3) v += (izq + arr) >> 1;
        else if (filtro === 4) {
          const q = arr + izq - dia, pa = Math.abs(q - izq), pb = Math.abs(q - arr), pc = Math.abs(q - dia);
          v += pa <= pb && pa <= pc ? izq : (pb <= pc ? arr : dia);
        }
        px[y * fila + x] = v & 255;
      }
    }
    return { w, h, ch, px };
  };
  const esGris = (r, g, b2, a) => a > 16 && (Math.max(r, g, b2) - Math.min(r, g, b2)) < 36 && ((r + g + b2) / 3) > 45 && ((r + g + b2) / 3) < 225;
  const centros = [];
  for (let i = 1; i <= 6; i++) {
    const { w, h, ch, px } = leerPng(`pole${i}.png`);
    const todas = [];
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = 0; y < h; y++) {
        const o = (y * w + x) * ch;
        if (esGris(px[o], px[o + 1], px[o + 2], ch === 4 ? px[o + 3] : 255)) n++;
      }
      todas.push(n > h * 0.28);
    }
    let ini = -1, anchas = [];
    for (let x = 0; x <= w; x++) {
      if (x < w && todas[x]) { if (ini < 0) ini = x; }
      else { if (ini >= 0) { anchas.push([ini, x - 1]); ini = -1; } }
    }
    anchas.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    centros.push(anchas.length ? (anchas[0][0] + anchas[0][1]) / 2 / w : -1);
  }
  const m = js.match(/xRel:\s*([\d.]+)\s*\/\s*([\d.]+)/);
  const xRel = m ? (Number(m[1]) / Number(m[2])) : NaN;
  const iguales = centros.every((c) => Math.abs(c - centros[0]) * 669 < 1.5);
  ok(centros.every((c) => c > 0) && iguales,
     'el caño está en la misma columna en los 6 cuadros',
     centros.map((c) => (c * 669).toFixed(1)).join(', '));
  ok(Number.isFinite(xRel) && Math.abs(xRel - centros[0]) * 669 < 1.5,
     'POLE.xRel apunta a la columna real del caño',
     `juego=${m ? m[0] : '?'} real=${(centros[0] * 669).toFixed(1)}/669`);
}
ok(/case 'pole'/.test(srv) && /p\.char !== 'ger'/.test(srv),
   'el servidor sólo le cree la bailarina a Ger');
ok(/Bailarina/.test(js) && /polePedir/.test(js),
   'la bailarina está en el menú (sólo Ger, parado)');
// El alto en pantalla es fijo y el ancho sale de la proporcion del PNG: si un
// cuadro no mide lo mismo que el _sit.png, el personaje salta al animarse.
{
  const malos = [];
  const medir = (f) => {
    const b = fs.readFileSync(path.join(raiz, 'sprites', f));
    return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);   // ancho x alto del IHDR
  };
  for (const a of anims) for (const [char, n] of a.quien) {
    let base;
    try { base = medir(`${char}_sit.png`); } catch { continue; }
    for (let i = 1; i <= n; i++) {
      try { if (medir(`${char}_${a.nombre}${i}.png`) !== base) malos.push(`${char}_${a.nombre}${i}.png`); } catch {}
    }
  }
  ok(malos.length === 0, 'los cuadros de las animaciones miden lo mismo que el sprite sentado',
     malos.length ? 'no coinciden: ' + malos.join(', ') : '');
}
// La lista blanca del servidor tiene que tener las mismas animaciones que la
// tabla: una de mas es un agujero, una de menos es una accion que no viaja.
{
  const blanca = (srv.match(/\[([^\]]*)\]\.includes\(msg\.anim\)/) || [])[1] || '';
  const enSrv = [...blanca.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
  const enJs = anims.map((a) => a.nombre).sort();
  ok(enSrv.length > 0 && enSrv.join() === enJs.join(),
     'el servidor reenvia exactamente las animaciones de la tabla',
     `server: [${enSrv}] vs game: [${enJs}]`);
}

ok(/histCerrarConEsc/.test(js) && /histCerrarSiFuera/.test(js)
   && /addEventListener\('keydown', histCerrarConEsc\)/.test(js)
   && /addEventListener\('pointerdown', histCerrarSiFuera, true\)/.test(js),
   'el historial se cierra con Esc y tocando afuera',
   'el de afuera va en captura: si no, el redibujo de la lista cierra lo recien abierto');
// Los totales y la linea de "ultima vez" tienen que salir del MISMO fin de
// sesion: si no, una desconexion le regala horas a la persona.
ok(/t \+= Math\.max\(0, s\.efe/.test(js) && /efe: s\.fin != null/.test(js),
   'los totales usan el mismo fin de sesion que se muestra en pantalla');

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
