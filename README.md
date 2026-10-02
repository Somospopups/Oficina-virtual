# 🏢 Oficina Virtual 2D — Equipo opencode

[![Chequeos](https://github.com/Somospopups/Oficina-virtual/actions/workflows/chequeos.yml/badge.svg)](https://github.com/Somospopups/Oficina-virtual/actions/workflows/chequeos.yml)

Entorno 2D multiplayer estilo videojuego (pixel art) donde el equipo trabaja e
interactúa en una oficina compartida, en tiempo real desde el navegador.

> 🤖 **IA o agente de programación:** antes de analizar o modificar este
> repositorio, leé [`AGENTS.md`](AGENTS.md), [`AGENTE.md`](AGENTE.md) y
> [`PUBLICAR_CAMBIOS.md`](PUBLICAR_CAMBIOS.md). Ahí están las reglas obligatorias
> del proyecto, los chequeos y el método de entrega con `PUBLICAR.bat`.

> ⛔ **Reglas de la casa para tocar este código** (humanos y agentes): están en
> [`AGENTE.md`](AGENTE.md). La más importante es la de oro: **nada de lo nuevo
> puede invadir la pantalla de la oficina — todo vive dentro de los márgenes
> laterales.**

## 🌐 Opción 1 (recomendada, SIN servidor): GitHub Pages

El sitio vive en la **raíz del repo** y el multiplayer funciona **P2P (WebRTC
vía Trystero)**: los navegadores se conectan directo entre sí, sin servidor.

1. En el repo: **Settings → Pages → Deploy from a branch → `main` + `/ (root)` → Save**
2. Esperar 1 min → URL pública: `https://<usuario>.github.io/<repo>/`
3. Compartir esa URL con el equipo. Listo, se abre como cualquier página.

## 🖥️ Opción 2: servidor propio (WebSocket)

```bash
npm install          # única dependencia: ws
node server.js       # escucha en 0.0.0.0:3000 (o $PORT)
```

Compartís `http://tu-host:3000`. En este modo la sincronización usa
WebSockets contra este servidor. Tip: `?dni=30111222` pre-carga el DNI de quien
abre la URL. Es un atajo para tu propio equipo, no lo compartas: queda en el
historial del navegador.

## 🖼️ Si tocás un dibujo, corré esto antes de publicar

```bash
node tools/generar-assets.js     # reescribe assets.js con el hash de cada PNG
node tools/checlear-boton-e.js   # falla si un dibujo quedó sin regenerar
```

O **`npm test`**, que corre todos los chequeos del repo de una (`node --check`,
dibujos, sillas, caminata, whitespace). Es el mismo comando que ejecuta GitHub
Actions en cada push a `main`, y es lo que hay que dejar verde antes de tocar
`PUBLICAR.bat`.

Cada imagen se pide con un **hash de su propio contenido** (`sprites/ger_sit.png?v=6cc8f410`).
Así, al reemplazar un dibujo el navegador descarga el nuevo y **nunca muestra una
versión vieja** del caché, ni al entrar ni dentro de la oficina. No hay que subir
ningún `?v=` a mano: se calculan solos y el guard te avisa si se olvidó.

## 🎮 Controles

Esta tabla es la que está dentro del juego con `H` (`index.html`); si cambiás una,
cambiá la otra.

| Tecla / botón | Acción |
|---|---|
| `WASD` / flechas | Moverse (con colisiones contra muebles; estando sentado te levantás) |
| `E` | Acción contextual: sentarte 🪑 en el escritorio · ☕ cafecito (velocidad extra) · ❤ acariciar a Michi |
| `Enter` | Abrir chat · Enter envía · Shift+Enter salto de línea · Esc cancela |
| `/w nombre msg` | Susurro / mensaje privado |
| `1–3` | Cambiar estado: 💻 codeando · 🤝 reunión · 🏃 ¡Ya vengo! (tocá el activo para volver a 💻) |
| `4` | 💨 Zumbido: sacude toda la oficina, estilo Messenger |
| `P` | 📻 Radio de la oficina: pegás un link de YouTube y suena sincronizado para todos |
| `M` | 🎤 Micro de la oficina: se queda abierto; cerralo con la misma tecla |
| `Z X C V B N` | Emotes: 👋 😂 🎉 👍 🤔 🔥 |
| `H` | Mostrar/ocultar la ayuda |
| Click en la cabeza de un compañero | Menú radial: 👋 Saludar · 💬 Susurrar · 💨 Zumbido |
| Click en tu propia cabeza | Estados, animaciones (si estás sentado 🪑), 🥊 modo pelea y 💃 bailarina (solo Ger parado), 💨 zumbido |
| 📷 / 🖥️ (columna derecha) | Prender cámara · compartir pantalla (uno a la vez) |
| Reloj (hora · clima · versión) | Hora: 📡 panel de la red · Versión: busca actualización y vuelve a entrar solo |
| 🔔 (barra de arriba) | Notificaciones estilo Messenger (vienen prendidas): clic apagada→prende · clic prendida→opciones |
| Nombre en 🟢 En la oficina | Historial de esa persona (los que no están ahora, en gris al final) |

**No hay atajo para la cámara ni la pantalla:** van por los botones. Los únicos
atajos de letras son `WASD`/flechas, `E`, `Enter`, `H`, `P`, `M`, `1`–`4` y
`Z X C V B N`.

## 🗺️ La oficina (réplica del local real)

El mapa está calcado de la foto del espacio del equipo, en versión pixel art cenital:

- **Ventanal** al fondo con vista a la ciudad (skyline generado por código) y
  parches de sol reflejados sobre el piso.
- **Porcelanato beige brillante** con juntas de pastillas grandes y paredes blancas.
- **Counter bajo la ventana**: estantes de madera abiertos + gabinete blanco.
- **Puestos de trabajo** blancos con canto de madera y monitor con terminal
  verde 💚: pararte en la silla te pone "codeando".
- Lamparitas colgantes, spots embutidos y entrada con felpudo.
- Burbujas de chat sobre la cabeza, nombres con emoji de estado, lista de
  compañeros online, sonidos sutiles y reconexión automática.
- **🔔 Notificaciones estilo Messenger (MSN)**: carteles del sistema operativo en
  Windows/Mac (Notification API) por chat, privados, entradas/salidas, zumbidos,
  cámaras, pantalla compartida, video/radio y llamada. Cada aviso lleva el sprite
  del compañero como ícono, un sonidito retro sintetizado distinto por evento y el
  título de la pestaña titilando como la barra de tareas de XP. Vienen PRENDIDAS
  por defecto y todo se maneja desde UNA campana 🔔: apagada la prendés de un
  click; prendida abre las opciones (qué tipos avisan, o apagarlas del todo).
  Anti-spam por persona, no se apilan: se reemplazan. Si el navegador bloquea
  los carteles, quedan el sonido + título.

## 🔧 Técnica

- **Servidor**: Node.js puro (http estático) + `ws` (WebSockets). Estado
  autoritativo-lite: retransmite posiciones (20 Hz), chat, estados y emotes.
- **Cliente**: canvas 2D vanilla, sin frameworks. Todo el pixel art se genera
  por código (tilemap 44×30 pre-renderizado + sprites de personaje por
  dirección/frame). Interpolación suave de jugadores remotos.
- **Sprites con altura pareja**: los PNG de `sprites/` llegaron en tandas con
  lienzos de distinto alto (el de frente mide 493 px; espalda y caminata, 700).
  Al cargar, `game.js` recorta cada figura por su canal alfa y la reescala a un
  alto común por personaje, así el personaje no cambia de tamaño al girar,
  caminar o frenar. Si se agregan PNG nuevos, no hace falta tocarlos: se
  normalizan solos.
- Archivos:
  - `server.js` — servidor HTTP + WebSocket
  - `index.html` / `style.css` / `game.js` — la oficina (se sirve tal cual desde
    la raíz, igual en GitHub Pages que con `node server.js`)
  - `sprites/` — sprites de personajes, michi y objetos
  - `tools/limpiar-fondo-sprites.js` — revisa los PNG de `sprites/` y saca el
    fondo claro opaco de los que salieron sin transparencia (los que ya están
    bien no se tocan). Uso: `node tools/limpiar-fondo-sprites.js --check` para
    revisar sin escribir, o sin `--check` para limpiar.
  - `tools/chequear-todo.js` — el que corre `npm test`: junta todos los
    chequeos y para en el primero que falla (también es el de la CI).

## 🚀 Despliegue para el equipo

Cualquier host con Node ≥ 18 sirve (VPS, Railway, Render, Fly.io):
```bash
npm install --omit=dev && PORT=3000 node server.js
```
El cliente usa URLs relativas (`/ws`), así que funciona detrás de proxies
HTTPS sin cambios (wss automático).

### Ideas para después
- Webhook de opencode/GitHub → notificación en el chat de la oficina
- "Salas" privadas por proyecto
