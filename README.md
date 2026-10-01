# 🏢 Oficina Virtual 2D — Equipo opencode

Entorno 2D multiplayer estilo videojuego (pixel art) donde el equipo trabaja e
interactúa en una oficina compartida, en tiempo real desde el navegador.

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
WebSockets contra este servidor. Tip: `?name=Laura` pre-carga el nombre.

## 🖼️ Si tocás un dibujo, corré esto antes de publicar

```bash
node tools/generar-assets.js     # reescribe assets.js con el hash de cada PNG
node tools/checlear-boton-e.js   # falla si un dibujo quedó sin regenerar
```

Cada imagen se pide con un **hash de su propio contenido** (`sprites/ger_sit.png?v=6cc8f410`).
Así, al reemplazar un dibujo el navegador descarga el nuevo y **nunca muestra una
versión vieja** del caché, ni al entrar ni dentro de la oficina. No hay que subir
ningún `?v=` a mano: se calculan solos y el guard te avisa si se olvidó.

## 🎮 Controles

| Tecla | Acción |
|---|---|
| `WASD` / flechas | Moverse (con colisiones contra muebles) |
| `Enter` | Abrir chat · Enter envía · Shift+Enter salto de línea · Esc cancela |
| `/w nombre msg` | Susurro / mensaje privado |
| `F` | Saludar 👋 al compañero más cercano |
| `1–3` | Cambiar estado: 💻 codeando · 🤝 reunión · 🏃 ¡Ya vengo! |
| 🔔 | Notificaciones estilo Messenger (vienen prendidas): clic apagada→prende · clic prendida→opciones |
| `Z X C V B N M` | Emotes: 👋 😂 🎉 👍 🤔 🔥 ☕ |
| `H` | Ayuda |

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
  - `opciones.html` — panel de opciones
  - `sprites/` — sprites de personajes, michi y objetos
  - `tools/limpiar-fondo-sprites.js` — revisa los PNG de `sprites/` y saca el
    fondo claro opaco de los que salieron sin transparencia (los que ya están
    bien no se tocan). Uso: `node tools/limpiar-fondo-sprites.js --check` para
    revisar sin escribir, o sin `--check` para limpiar.

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
