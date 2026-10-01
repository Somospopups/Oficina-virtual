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
abren **anclados dentro de su riel**, no flotando sobre la oficina.

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
2. Revisar en pantalla panorámica (modo `desktop-rails`, canvas > 900) que
   nada pise la oficina ni descuadre los rieles.
3. Revisar en móvil que la oficina siga libre (los controles van en sus
   franjas).
