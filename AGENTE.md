# 🤝 Reglas de la casa — para quien toque este código (humano o agente)

Este archivo es la fuente de verdad de cómo se diseña la Oficina Virtual.
Leelo completo antes de meter mano. Si algo de lo que hagás contradice una
regla de acá, está mal: cambiá tu código, no la regla.

## 📦 Entrega para el propietario: ZIP + `PUBLICAR.bat`

Antes de preparar o publicar cualquier cambio, leer también
[`PUBLICAR_CAMBIOS.md`](PUBLICAR_CAMBIOS.md). El propietario no programa ni usa
terminal: el agente hace el cambio completo, ejecuta los chequeos y entrega un
ZIP con `PUBLICAR.bat` y un bundle Git. Por decisión del propietario, se prepara
el BAT directamente y solo se muestra un preview cuando él lo pide expresamente.
Nunca se piden ni se guardan tokens o contraseñas en el chat o en los archivos.

## ⛔ REGLA DE ORO: nada invade la pantalla de la oficina

**El canvas central es de la oficina, y solo de la oficina.** Ningún botón,
panel, cartel, badge ni aviso nuevo puede pisarse con la escena del juego.

Todo lo que se agregue vive **dentro de los márgenes laterales** (los rieles):

- **Riel izquierdo** (modo `desktop-rails`): reloj / paneles de diagnóstico /
  chat.
- **Riel derecho**: lista de compañeros arriba, fila de botones en el medio
  (🎵 🔔 🎤 📷 💻) y tira de cámaras abajo.
- **En móvil** no hay rieles: vale la misma idea — los controles van en las
  franjas que ya existen (barra de arriba, stick, chat), nunca tapando la
  oficina.

Los paneles que se abren y cierran (radio, notificaciones, red) también se
abren **anclados dentro de su riel**, no flotando sobre la oficina. Y todo
panel **se cierra tocando cualquier parte fuera de él** (o con Esc): nunca
puede quedar clavado hasta que el usuario adivine qué botón lo apaga. Si un
panel nuevo no se cierra así, es un bug.

Corolario: **antes de agregar un elemento visible, preguntate en qué riel
vive**. Si la respuesta es "encima de la oficina, pero por un ratito", la
respuesta es no.

## 📦 Botones del rail derecho: todos iguales

- La fila de botones del rail derecho tiene **un solo tamaño: 38×38**. Está
  fijado en el bloque uniforme de `style.css` (`#micCallBtn, #camBtn,
  #shareBtn, #musicBtn, #notifBtn`). Si agregás un botón, lo sumás a ese
  selector — nada de tamaños, fuentes o paddings propios.
- **Un solo botón por feature.** Si la feature tiene opciones, el click del
  botón las abre (como hace la 🔔 con su panel). No se agregan botones
  secundarios al rail (tuercas, cruces, etc.).
- La posición de la fila la calcula `layoutDesktopAudio()` en `game.js` de
  derecha a izquierda: cada botón apoya su borde derecho a 6px del anterior.
  Los botones nuevos se stackean ahí, no se posicionan a mano.

## 🪑 Escritorios: nadie se sienta arriba de otro

La oficina tiene **4 puestos** y el equipo es más grande. El reparto al entrar
lo hace `seatFor()` y el orden es siempre este:

1. El puesto propio (`seat` del `ROSTER`), si está libre.
2. Cualquier otro que esté libre.
3. **Ninguno: se entra DE PIE** en la entrada del pasillo (`puntoDePie()`), y se
   le avisa por chat que espere a que se libere uno y toque `E`.

Un puesto cuenta como ocupado **solo** si hay alguien **sentado** ahí y **sigue
conectado** (`seatOwner()` + `presente()`, ventana de `PRESENCIA_MS`). Dos
corolarios que ya costaron bugs:

- El que pasa **caminando** por delante de un escritorio no lo reserva.
- El que se desconecta de golpe **no deja la silla trabada**: a los 10s sin
  señal su puesto vuelve a estar disponible.

Si tocás esto, corré `node tools/chequear-sillas.js` — saca las funciones de
`game.js` y las prueba con compañeros de mentira, así el chequeo no se despega
del juego.

## 🪪 El ROSTER está en DOS lados

`game.js` y `server.js` tienen cada uno su `ROSTER` y **tienen que coincidir**.
En GitHub Pages (P2P) el DNI se valida contra `game.js`; en Render o en el
servidor local, contra `server.js`. Si sumás a alguien en uno solo, entra en un
modo y le rebota el DNI en el otro.

**En los dos archivos figura el `dniHash`, nunca el DNI.** Desde v152 el
número no está escrito en el repo (que es público) ni sale en claro por el bus:
quien lo tipea, `game.js` calcula
`SHA-256('somospopups-dni-v1:' + dni)` y compara contra el de cada fila
(`dniHashDe()` / `entryPorDni()` en `game.js`, `dniHashDe()` en `server.js`).
Sumar a alguien = su `dniHash` en **los dos** lados, más su clave en
`HIST_PUB`; `tools/checlear-boton-e.js` falla si las listas no son idénticas,
si cambia el salt o si aparece un `dni: '<número>'` otra vez.

>⚠️ **Es privacidad, no seguridad.** Un DNI tiene 8 dígitos y se fuerza bruta
>en minutos con una PC normal: lo que se evita es que el documento de todos
>quede publicado en el repo y en los relays, no que alguien se haga pasar por
>otro. Si algún día hace falta seguridad de verdad, eso se resuelve en el
>servidor (o en otro medio de ingreso), no acá.
>
>**Y no se toca `histClaveDe(dni)`:** la clave del historial sigue
>derivándose del DNI **en crudo**, con `'ov-hist-v1:'`, y sólo en el equipo.
>Si pasás eso a hasheado, las firmas dejan de coincidir con `HIST_PUB` y se
>pierde todo el historial ya publicado.

## 📏 Los controles del chat miden todos lo mismo

El campo de escribir, el micrófono/enviar y los botones de clip y emoji son
**una sola fila visual**: tienen que medir **exactamente lo mismo de alto** y
salir de la variable `--chat-ctl` (hoy 30px). Nada de escribir alturas a mano:
antes había dos sueltas (38px el campo y el micro, 28px el clip y el emoji)
repetidas en cinco reglas, y se veían desparejos.

La única altura en píxeles que queda permitida ahí es el `max-height` del
`<textarea>`, que es el tope de ~5 renglones cuando crece el mensaje.

El clip y el emoji van en su propia fila, **con aire antes de la línea** que
arranca `#chatRow` (`#chatAux` necesita `padding-bottom`): apoyados sobre la
línea quedan pegoteados. Y su borde izquierdo se alinea con el del campo de
escribir — el padding lateral de `#chatAux` acompaña al de `#chatRow`.

`node tools/checlear-boton-e.js` verifica todo esto.

## 🕘 El historial NO puede viajar por el bus

El bus P2P usa el **kind 20001**, que es **efímero**: los relays no lo archivan
y encima la suscripción sólo pide los últimos 60 segundos. Sirve para el
tiempo real y para nada más. Si alguna vez hay que guardar algo que sobreviva,
no se cuelga del bus.

El historial de asistencia resuelve eso así, y conviene repetir el patrón:

- **Cada uno es dueño de sus propias sesiones.** Las guarda en `localStorage`
  (`ovHistorial`) y nadie escribe las del otro: no hay forma de contar dos
  veces lo mismo ni de que dos versiones se peleen.
- **Se comparten como kind 30078**, que los relays sí guardan: uno por persona,
  y cada publicación reemplaza a la anterior. Sin servidor, que es la
  condición porque el sitio vive en GitHub Pages.
- **La identidad sale del DNI**, no del bus: `makeBusKeys()` sortea una clave
  nueva en cada carga y así no habría a quién atribuirle una sesión. Las claves
  públicas están escritas en `HIST_PUB` para no hacer cinco multiplicaciones de
  curva en cada arranque. **Si entra alguien nuevo al ROSTER hay que agregarlo
  ahí también** (el checker avisa si falta). Ojo: acá el DNI va **en crudo**
  (`histClaveDe`), porque la clave derivada es la que firman las sesiones; el
  `ROSTER` en cambio guarda sólo el hash (ver la sección del ROSTER).

Tres reglas que ya costaron un bug cada una:

1. **Recargar la página no es una visita nueva.** Si la sesión anterior terminó
   hace menos de 5 minutos se retoma esa misma (`HIST_PEGAR`), y una visita de
   menos de un minuto se descarta (`HIST_MINIMO`). Si no, la "última vez" de
   alguien que refrescó termina siendo un pestañeo de 10 segundos.
2. **Una sesión sin cierre no sigue corriendo para siempre.** Cuando a alguien
   se le cae el navegador, la sesión queda abierta: se corta en su último
   latido. El fin "efectivo" (`efe`) se calcula una sola vez y lo usan por
   igual la línea de pantalla y los totales — si se separan, una desconexión le
   regala horas a la persona.
3. **El historial está oculto y no tiene panel propio.** Aparece al tocar el
   nombre de alguien en 👥 En la oficina, y se cierra con Esc o tocando afuera.
   Dos detalles que no son opcionales: el toque se escucha con **`pointerdown`**
   (la lista se redibuja con cada mensaje de la red, así que entre el apretar y
   el soltar la fila puede ser reemplazada y el `click` nunca llega), y el
   cierre por "tocaste afuera" va en **fase de captura** (si corriera después,
   el redibujo ya dejó huérfano al elemento tocado, `contains()` da false y
   cerraría justo lo que acabás de abrir).
4. **El equipo que no está va en gris al final de la lista**, para que también
   se le pueda tocar el nombre. Ojo con dos tiempos que no son bugs: a quien
   se acaba de ir lo siguen reenviando los relays (la suscripción pide los
   últimos 60 s) y en P2P recién se lo poda tras **75 s** de silencio, así que
   tarda un rato en pasarse al gris.
5. **Las visitas no se listan en gris.** Quien no es de la oficina (hoy Milo)
   va en el `ROSTER` con `visita: true` — en `game.js` **y** en `server.js`,
   que tienen que seguir siendo iguales. Entra y se lo ve como a cualquiera
   mientras está; cuando no está, `renderPlayerList` lo saltea. No alcanza con
   sacarlo del `ROSTER`: ahí le rebotaría el DNI y no podría entrar.
6. **En el celu no se ve nada de esto**: desde v113 el `@media (max-width:900px)`
   oculta `#playerList` entero (los estados se ponen tocando al personaje y ese
   lugar lo usan las cámaras). El historial se sigue guardando y compartiendo
   desde el celu, pero no hay dónde abrirlo. Si alguna vez se quiere, el lugar
   natural es el menú que aparece al tocar un personaje.

**Para probar el P2P hay que aislar DOS etiquetas, no una:** `HIST_TAG` y
también `BUS_ROOM`. Si se cambia sólo la primera, las pruebas entran a la sala
real y los relays reenvían fantasmas de corridas anteriores; el guard de
"ya está en la oficina desde otro dispositivo" rechaza el ingreso **en
silencio** y el test parece pasar mientras mide cualquier cosa. Conviene
afirmar siempre `state.joined` después de entrar.

## 🧊 El `index.html` es el único que puede llegar viejo

`style.css`, `game.js` y `assets.js` se piden con `?v=vNNN` (la versión: se
cachean dentro de la versión y siempre bajan los nuevos al publicar, sin
`document.write`) y cada dibujo con el hash de su contenido, así que nunca
se ven versiones viejas de eso. Pero **el `index.html`
que los carga lo sirve GitHub Pages con `cache-control: max-age=600`**: el
navegador puede tener uno guardado y mezclar **HTML viejo con CSS y JS nuevos**.
La pantalla queda rota de formas raras (botones corridos, textos de otra
versión) y la persona no tiene cómo darse cuenta.

Por eso el HTML lleva `<meta name="ov-build" content="vNNN">` y `game.js` lo
compara contra su `VERSION` al arrancar: si no coinciden, recarga **una sola
vez** con `?fresco=…` (otra URL = otra entrada de caché = descarga de verdad).

👉 **Al subir `VERSION` en `game.js` hay que subir también el `ov-build` del
`index.html` y los `?v=` de `style.css`, `assets.js` y `game.js`.** Si se
separan, `tools/checlear-boton-e.js` falla.

El reloj muestra sólo hora · clima · versión. Tocando la versión se busca
actualización sin salir: si el sello publicado es más nuevo, recarga con
`?fresco=` y vuelve a entrar solo con el DNI que vive en `sessionStorage`
(la pestaña, nunca sale del equipo). `versionRefrescar()` + bandera
`ovAuto` en el arranque + `aplicarVuelta()`, que recupera posición exacta
(validada con `walkable`) y estado.

## 😶 Emojis sobre fondo oscuro

Algunos emojis son grises o plateados (`📎`, `🔗`) y sobre el fondo oscuro de un
botón casi no se ven, al lado de uno amarillo como `🙂`. Si hay que aclararlos,
el brillo va **sobre el dibujito**, nunca sobre el `<button>`: un `filter` en el
botón le aclara también el fondo y el borde y lo saca de la línea de los demás.
Por eso el emoji viaja envuelto: `<button><i class="ico">📎</i></button>`.

## ☕🍺 Animaciones sentado (tomar algo en la silla)

La tabla `ANIMS` de `game.js` es la única fuente:

```js
const ANIMS = {
  cafe:  { titulo: '☕ Tomar un café',   quien: { ger: 4 } },
  birra: { titulo: '🍺 Tomar una birra', quien: { ger: 4 } },
};
```

**Para sumar una animación** (o una persona a una que ya existe): dejar los
`sprites/<char>_<nombre>1..4.png` y agregar la entrada. Nada más. El guion
(`ANIM_GUION`), el fundido, la carga, el menú, el chequeador y la prueba e2e
salen todos de esa tabla. Lo único que hay que tocar aparte es la **lista
blanca de `server.js`**, que tiene que decir exactamente los mismos nombres
(`checlear-boton-e.js` lo verifica).

Los dibujos **traen la silla adentro**, como los `_sit.png`, así que:

- La acción aparece en el menú **sólo si estás sentado**. De pie no hay qué
  mostrar y por eso ni se ofrece.
- Tienen que estar **alineados contra el `_sit.png` de esa persona**, o al
  arrancar la animación el personaje pega un salto. Los prepara
  `preparar-animacion.py` (fuera del repo):

  ```
  python3 e2e/preparar-animacion.py <hoja 2x2.jpg> <char> <nombre>
  ```

  Saca el fondo verde, usa **una sola escala** para los cuatro y los ubica
  **por máxima coincidencia de máscara**, no por la caja de la figura (la taza
  estirada hacia adelante corre el centro y la silla se movería sola).
- **Iguala el color contra el `_sit.png`** con un ajuste lineal por canal
  (media y desvío) sobre los píxeles opacos en común. Cada tanda de arte sale
  con otro brillo: los del café venían a 2 sobre 255 y los de la birra a 9, y
  9 ya se ve como un fogonazo al empezar. Si la tanda ya coincidía, la
  ganancia da ~1 y no cambia nada. **Ojo: no medir eso sobre la silla sola**,
  que es casi negra y cualquier diferencia chica dispara la ganancia y quema
  el resto de la figura. (Para *diagnosticar* sí sirve mirar el respaldo, que
  es idéntico en toda pose; para *corregir*, la superposición entera.)
- Si se redibuja un `_sit.png`, hay que **rehacer todos sus cuadros** con él.
- Al dibujar, el alto en pantalla es fijo (`48 * sitScale`) y el ancho sale de
  la proporción del PNG: lo que alinea es **la caja del lienzo**. Por eso los
  cuatro salen del mismo tamaño que el `_sit.png`, aunque sobre transparencia.
- El cruce de 180 ms (`ANIM_FUNDIDO`) con la pose sentada es lo que tapa el
  salto de entrada y salida. Mientras dura la animación, el sentado no lleva
  el rebote de respiración: sumaría un temblor arriba del cruce.

Cada tanda pesa ~2 MB, así que **no** se baja con el resto de los dibujos:
`animCargar()` espera a `assetsReady`, baja **de a un PNG** y **de a una tanda
por vez** (`animBajando`). Las propias se piden al sentarse. Las de los demás
no: serían N personas por M animaciones. Cuando llega el aviso de que otro
está tomando algo se piden en el momento y **la animación arranca cuando
llegan**, aunque sea unos segundos tarde; es mejor verla corrida que no verla.

Viaja por la red como `{ type: 'anim', anim: '<nombre>' }`, con lista blanca
en `server.js` para que nadie invente animaciones desde la consola.

El menú de acciones es radial: el radio de la elipse **crece con la cantidad
de ítems** (`rx`), que con siete pastillas en el radio fijo de antes se
pisaban entre ellas. La prueba `e2e/animaciones.js` compara los rectángulos y
falla si se superponen.

## 💃 Bailarina del caño (sólo Ger)

Prop de fondo en loop (6 poses, `sprites/pole1..6.png` + `.webp`) que prende
y apaga sólo Ger desde su menú **parado**, pero la ven todos. Los 6 lienzos
miden lo mismo con el caño en la misma x —los genera
`tools/procesar-bailarina.py` desde la hoja `bailarina.png` (fondo verde
afuera, caño detectado y clavado por cuadro): si un cuadro mide distinto, el
caño salta y `checlear-boton-e.js` falla. Viaja como el modo pelea (aviso
`pole` + bandera `poleOn` en el estado para el que entra tarde, y se apaga
si Ger se va); `server.js` sólo se lo cree a Ger.

## 👁 Vista previa de escenas (sólo Ger, privada)

Oficina nueva + balcón (`sprites/bg_ofi/bg_balcon`, verdes afuera para el
cielo dinámico, hechos con `tools/procesar-escenas.py`). Ger la prende de su
menú y camina lo nuevo ÉL SOLO: el resto lo ve como 👁 en la lista y no lo
dibuja (ni él a ellos). La puerta de vidrio del fondo cruza ofi ⇄ balcón con
la E parado cerca (`puertaCerca` + `cruzarPuerta`, con fundido; nada de
cruzar caminando). Los límites son los polígonos rojos del dueño
(`Oficina/v1rojo.jpg`, `v3rojo.jpg`) tal cual en `poli` (+ `obst` del mueble
y la columna). Todo lo nuevo pasa por `piso()`/`sillas()`/`dimW()`/
`dimH()`/`mitadX()`: con la previa apagada devuelven el mundo viejo intacto.
El cielo es el mismo de siempre (`pintarCielo`, con sol, nubes, lluvia, nieve
y rayos) pintado a pantalla completa detrás de cada escena. En la previa
sólo queda la 🚪 (`drawPrevMarcas`). Al abrirlo a todos: sacar
el gate de Ger y sincronizar la escena.

## 🚶 El dibujo de pie (`sprites/<char>.png`)

Es el sprite quieto de frente, y además **manda sobre todos los demás de pie**:

- `normalizarFigura()` recorta cada PNG a su figura y **reescala los cuadros de
  caminata y el de espaldas al alto de figura de este**. Si éste cambia de
  alto, se mueve todo.
- El tope de escala sale de acá: `s = min(depthScale(y), baseH / 44)`, con
  `baseH` = alto de figura de este PNG. Hoy son 493 px (Ger y Ove), 508
  (Facu y Ovni) y 564 (Milo), o sea que adelante de todo el tope realmente
  recorta: sin él, Ger se dibujaría 880 px en vez de 493, un 78% más grande.

**Por eso, al reemplazarlo hay que dejarlo con el mismo alto de figura que
tenía**, o el personaje cambia de tamaño en la oficina y queda desparejo con
el resto del equipo. Lo hace solo:

```
python3 e2e/preparar-parado.py <dibujo.jpg> <char>             # sólo mide
python3 e2e/preparar-parado.py <dibujo.jpg> <char> --escribir  # lo escribe
```

Saca el fondo verde, recorta, lleva la figura al alto del que estaba y compara
el brillo contra él (misma pose, así que la comparación es válida). En la v134
el Ger de pie nuevo dio +2,3/255 contra el viejo y -0,3 / -1,6 contra
`ger_walk2/4`: misma tanda que la caminata, no hizo falta tocarle el color.

La caminata de Ger sale de `ger_walk2/3/4` (de frente), `ger_wl1..3` /
`ger_wr1..3` (de perfil) y `ger_wu1..2` (de espaldas), y **sigue siendo de la
tanda vieja**. Medido al mismo alto, la cabeza del dibujo de pie es un 10% más
ancha que la de los cuadros de caminata; con el dibujo anterior ya era un 8%,
así que el salto no empeoró. Si alguna vez se redibuja la caminata, conviene
hacerla con el mismo molde que el de pie.

## ⏳ Mientras cargan los dibujos (13 MB)

`sprites/` pesa 13 MB y el fondo 1,75 MB más. Después de un refresco forzado
(Ctrl+Shift+R) se baja todo de nuevo, y durante esos segundos la oficina se ve
negra y a medio armar. Dos cosas que hay que respetar para que eso no parezca
una pantalla rota:

1. **El tope de escala del personaje sale de SU propio sprite** (`ca.down`),
   nunca de la bandera global `assetsReady`, que recién se prende cuando
   terminaron de bajar los dibujos de los cinco. Si se mira la global, el que
   ya tiene su sprite se dibuja sin tope y aparece hasta **78% más grande**,
   gigante arriba de una oficina todavía en negro. Pasó en la v130.
2. **Nada pesado se baja mientras carga lo importante.** El navegador abre 6
   conexiones por dominio: los 2 MB del café le robaban la mitad del caño al
   fondo y a los sprites. `animCargar()` espera `assetsReady` y después baja
   de a uno con `fetchPriority='low'`.

Y mientras tanto, `dibujarCarga()` pone un cartel arriba del canvas que dice
cuántos personajes llegaron y si falta el fondo. Es información real, no una
barra inventada.

## 📺 Espectador y pantalla compartida

El espectador (`0tv…`) siempre es el iniciador WebRTC y nunca abre micro:
sus pares se crean "de oído" con los avisos y quedan `nuevo` hasta que él
oferta. `rtcAsegurarOferta()` es la única que oferta (micro, cámara y
pantalla): si el par ya existe pero nunca se negoció, oferta igual. Sin eso
los dos lados esperan la oferta del otro y el espectador ve negro (pasó en
la v160). No ofertar a mano desde otro lado: se generan choques.

En espectador la pantalla compartida toma TODO (`#videoPanel.share-full`,
que pone `rtcVerPantalla` y saca `rtcOcultarPantalla`): es la TV del local.
Al cortar se esconde sola; al salir del modo espectador también.

Si no se ven ni se escuchan: tocá el reloj → el panel muestra la malla por
compañero (`connected` / `failed` / a medio negociar, con 🎤📷🖥 de lo que
está llegando) y el botón ⟲ reintenta sin tocar micros ni cámaras. `failed`
parejo entre redes distintas = falta TURN: se configura en el servidor con
`TURN_URLS` + `TURN_USER` + `TURN_PASS` (el cliente lo pide en `/turn.json`);
sin eso sólo hay STUN y hay NATs que no cruzan.

## 🔢 Versionado y publicación

- Cada cambio sube el número de `VERSION` en `game.js` (v118, v119…) con la
  fecha. La pantalla de ingreso lo muestra y el equipo lo usa para confirmar
  que tiene la última versión.
- `git push` a `main` = **online** (GitHub Pages y Render se actualizan solos).
  Commits en español, cortos, estilo `feat(...)`, `fix(...)`, `chore(...)`.
- Si tocás un PNG de `sprites/`, corré `node tools/generar-assets.js` antes de
  publicar (hashes anti-caché) y `node tools/checlear-boton-e.js` para validar.

## ✅ Antes de commitear

1. **`npm test`** — corre todo el resto de una: `tools/chequear-todo.js`
   (`node --check` de game/server/tools, fondos de los PNG, `generar-assets`,
   `checlear-boton-e`, `chequear-sillas`, `chequear-caminata`, `git diff --check`
   y que la base siga siendo `origin/main`, que es la sección 2 de
   `PUBLICAR_CAMBIOS.md`).
   Es el mismo comando que corre GitHub Actions (`.github/workflows/chequeos.yml`).
1. Si querés correrlos de a uno: `node --check game.js` (y `server.js` si lo
   tocaste), `node tools/checlear-boton-e.js`, `node tools/chequear-sillas.js`.
2. Revisar en pantalla panorámica (modo `desktop-rails`, canvas > 900) que
   nada pise la oficina ni descuadre los rieles.
3. Revisar en móvil que la oficina siga libre (los controles van en sus
   franjas).
