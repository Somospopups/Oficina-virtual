# 🤝 Reglas de la casa — para quien toque este código (humano o agente)

Este archivo es la fuente de verdad de cómo se diseña la Oficina Virtual.
Leelo completo antes de meter mano. Si algo de lo que hagás contradice una
regla de acá, está mal: cambiá tu código, no la regla.

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

## 🧊 El `index.html` es el único que puede llegar viejo

`style.css` y `game.js` se piden con `?t=` y cada dibujo con el hash de su
contenido, así que nunca se ven versiones viejas de eso. Pero **el `index.html`
que los carga lo sirve GitHub Pages con `cache-control: max-age=600`**: el
navegador puede tener uno guardado y mezclar **HTML viejo con CSS y JS nuevos**.
La pantalla queda rota de formas raras (botones corridos, textos de otra
versión) y la persona no tiene cómo darse cuenta.

Por eso el HTML lleva `<meta name="ov-build" content="vNNN">` y `game.js` lo
compara contra su `VERSION` al arrancar: si no coinciden, recarga **una sola
vez** con `?fresco=…` (otra URL = otra entrada de caché = descarga de verdad).

👉 **Al subir `VERSION` en `game.js` hay que subir también el `ov-build` del
`index.html`.** Si se separan, `tools/checlear-boton-e.js` falla.

## 😶 Emojis sobre fondo oscuro

Algunos emojis son grises o plateados (`📎`, `🔗`) y sobre el fondo oscuro de un
botón casi no se ven, al lado de uno amarillo como `🙂`. Si hay que aclararlos,
el brillo va **sobre el dibujito**, nunca sobre el `<button>`: un `filter` en el
botón le aclara también el fondo y el borde y lo saca de la línea de los demás.
Por eso el emoji viaja envuelto: `<button><i class="ico">📎</i></button>`.

## 🔢 Versionado y publicación

- Cada cambio sube el número de `VERSION` en `game.js` (v118, v119…) con la
  fecha. La pantalla de ingreso lo muestra y el equipo lo usa para confirmar
  que tiene la última versión.
- `git push` a `main` = **online** (GitHub Pages y Render se actualizan solos).
  Commits en español, cortos, estilo `feat(...)`, `fix(...)`, `chore(...)`.
- Si tocás un PNG de `sprites/`, corré `node tools/generar-assets.js` antes de
  publicar (hashes anti-caché) y `node tools/checlear-boton-e.js` para validar.

## ✅ Antes de commitear

1. `node --check game.js` (y `server.js` si lo tocaste).
1. `node tools/checlear-boton-e.js` y `node tools/chequear-sillas.js`.
2. Revisar en pantalla panorámica (modo `desktop-rails`, canvas > 900) que
   nada pise la oficina ni descuadre los rieles.
3. Revisar en móvil que la oficina siga libre (los controles van en sus
   franjas).
