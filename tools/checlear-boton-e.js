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
ok(/function aplicarVuelta\(\)/.test(js) && /walkable\(x, y\)/.test(js) && /setStatus\(v\.status, true\)/.test(js),
   'al volver recupera posición validada y estado');

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
  ok(anims.length === 0, 'la tabla ANIMS quedó vacía para reconstruir las acciones desde cero');
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

// La bailarina del caño se sacó: ni los dibujos en sprites/, ni el código en
// game.js, ni el caso en el servidor.
{
  const quedan = [];
  for (let i = 1; i <= 6; i++) for (const ext of ['png', 'webp']) {
    const f = path.join(raiz, 'sprites', `pole${i}.${ext}`);
    if (fs.existsSync(f)) quedan.push(`pole${i}.${ext}`);
  }
  ok(quedan.length === 0, 'no quedan dibujos de la bailarina en sprites/',
     quedan.length ? 'quedan: ' + quedan.join(', ') : '');
}
ok(!/polePedir|drawPole|poleFijar|poleAplicar|case 'pole'/.test(js),
   'game.js ya no tiene código de la bailarina');
ok(!/case 'pole'/.test(srv), 'el servidor ya no reenvía la bailarina');

// ---------- Escenas: dos mundos pintados, cada uno con lo suyo ----------
// La geometría se LEE del juego, nunca se duplica acá: un chequeo que copia
// números deja de avisar justo cuando más falta hace.
{
  const prov = [];
  // Ancho x alto de un archivo, sin dependencias: PNG (IHDR), JPEG (SOF) o
  // WebP (VP8X / VP8 / VP8L), que es como entrega PIL.
  const medir = (f) => {
    const b = fs.readFileSync(f);
    if (b.readUInt32BE(0) === 0x89504e47) return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    if (b[0] === 0xff && b[1] === 0xd8) {
      let p = 2;
      while (p < b.length - 9) {
        if (b[p] !== 0xff) { p++; continue; }
        const m = b[p + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return `${b.readUInt16BE(p + 7)}x${b.readUInt16BE(p + 5)}`;
        }
        p += 2 + b.readUInt16BE(p + 2);
      }
      return '?';
    }
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const tag = b.toString('ascii', 12, 16);
      if (tag === 'VP8X') return `${b.readUIntLE(24, 3) + 1}x${b.readUIntLE(27, 3) + 1}`;
      if (tag === 'VP8 ') return `${b.readUInt16LE(26) & 0x3fff}x${b.readUInt16LE(28) & 0x3fff}`;
      if (tag === 'VP8L') { const n = b.readUInt32LE(21); return `${(n & 0x3fff) + 1}x${((n >> 14) & 0x3fff) + 1}`; }
    }
    return '?';
  };
  const tomar = (n) => {
    const ini = js.indexOf(`const ${n} = `);
    if (ini < 0) { prov.push(`sin ${n}`); return null; }
    let j = ini + `const ${n} = `.length;
    while (j < js.length && /\s/.test(js[j])) j++;
    let prof = 0, fin = -1;
    for (let k = j; k < js.length && fin < 0; k++) {
      const c = js[k];
      if (c === '{' || c === '[') prof++;
      else if (c === '}' || c === ']') { prof--; if (!prof) fin = k; }
    }
    if (fin < 0) { prov.push(`${n} ilegible`); return null; }
    try { return Function(`return (${js.slice(j, fin + 1)});`)(); }
    catch (e) { prov.push(`${n} ilegible: ${e.message}`); return null; }
  };
  const E = tomar('ESCENAS');
  ok(!!E && !!E.ofi && !!E.terr, 'ESCENAS tiene la oficina y la terraza');
  const enPoli = (poli, x, y) => {
    let dentro = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      const xi = poli[i][0], yi = poli[i][1], xj = poli[j][0], yj = poli[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  };
  const enPiso = (F, x, y) => {
    if (!F) return false;
    if (y < F.yTop + 10 || y > F.yBot - 6) return false;
    if (F.poli && !enPoli(F.poli, x, y)) return false;
    return !(F.obst || []).some((o) => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
  };
  for (const [k, E2] of Object.entries(E || {})) {
    if (!E2.w || !E2.h || !E2.piso || !E2.spawn || !E2.puerta) { prov.push(`${k}: le falta piso/spawn/puerta`); continue; }
    if (!Array.isArray(E2.piso.poli) || !Array.isArray(E2.piso.fig)) prov.push(`${k}: piso sin polígono ni fig`);
    if (!Array.isArray(E2.cielo) || E2.cielo.length < 2) prov.push(`${k}: menos de 2 variantes de cielo`);
    // Las variantes de cielo miden lo mismo o el fundido del cambio de hora
    // salta de tamaño. Se mira el .webp, que es el que se sirve.
    const tams = new Set();
    for (const c of E2.cielo || []) {
      const fw = path.join(raiz, 'sprites', c.base + '.webp');
      const fj = path.join(raiz, 'sprites', c.base + '.jpg');
      if (!fs.existsSync(fw)) prov.push(`falta sprites/${c.base}.webp`);
      if (!fs.existsSync(fj)) prov.push(`falta sprites/${c.base}.jpg`);
      if (fs.existsSync(fw)) tams.add(medir(fw) + '/' + E2.w + 'x' + E2.h);
    }
    if (tams.size > 1) prov.push(`${k}: las variantes miden distinto (${[...tams].join(', ')})`);
    (E2.sillas || []).forEach((s, i) => { if (!enPiso(E2.piso, s.x, s.y)) prov.push(`${k} silla${i + 1} en mueble/fuera`); });
    if (!enPiso(E2.piso, E2.spawn.x, E2.spawn.y)) prov.push(`${k}: spawn no pisables`);
    // La puerta: su zona tiene que ser alcanzable caminando en ESTA escena y su
    // destino pisables en la OTRA. Sin esto no se vuelve o se cae al vacío.
    const otra = E[E2.puerta.hacia];
    if (!otra) { prov.push(`${k}: la puerta va hacia "${E2.puerta.hacia}", que no existe`); continue; }
    let entra = false;
    for (let x = E2.puerta.x0; x <= E2.puerta.x1 && !entra; x += 10) {
      for (let y = E2.puerta.y0; y <= E2.puerta.y1 && !entra; y += 10) entra = enPiso(E2.piso, x, y);
    }
    if (!entra) prov.push(`a la puerta de ${k} no se llega caminando`);
    if (!enPiso(otra.piso, E2.puerta.ax, E2.puerta.ay)) prov.push(`el destino de la puerta de ${k} no es pisable`);
  }
  // La cafetera: la máquina está pintada en el arte, pero la zona de pie tiene
  // que ser pisables y no caer adentro de un mueble.
  const cafe = js.match(/const CAFE = \{[^}]*?x:\s*(\d+),\s*y:\s*(\d+),/);
  if (!cafe) prov.push('sin CAFE');
  else if (E && E.ofi && !enPiso(E.ofi.piso, Number(cafe[1]), Number(cafe[2]))) prov.push('la zona de pie de la cafetera no es pisable');
  ok(!prov.length, 'escenas, cielos, puertas y cafetera cuadran entre sí', prov.join(', '));
}
ok(/escena: escenaId/.test(js) && /escena: p\.escena \|\| 'ofi'/.test(srv),
   'la escena de cada uno viaja en el estado (oficina y terraza no se pisan)');
ok(/msg\.escena === 'ofi'/.test(srv) && /msg\.escena === 'terr'/.test(srv),
   'el servidor valida la escena con lista blanca');
ok(!/prevAqui|prevPedir|bg_ofi\.png|bg_balcon\.png|\bSPAWN_OFI\b|\bPISO_OFI\b/.test(js),
   'ya no quedan restos de la vista previa ni del mundo viejo');
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
  ok(enSrv.length === 0 && enSrv.join() === enJs.join(),
     'el servidor no reenvía acciones eliminadas',
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
