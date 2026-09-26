# 🏢 Oficina Virtual 2D — Equipo opencode

Entorno 2D multiplayer estilo videojuego (pixel art) donde el equipo trabaja e
interactúa en una oficina compartida, en tiempo real desde el navegador.

## ▶️ Cómo usarla

1. **Levantar el servidor**
   ```bash
   cd oficina-virtual
   npm install        # solo la primera vez (única dependencia: ws)
   node server.js     # escucha en 0.0.0.0:3000
   ```
2. **Compartir la URL** con el equipo. Todos entran al mismo link,
   eligen nombre + color y aparecen en la oficina.
   - Tip: se puede pre-cargar el nombre con `?name=Laura` en la URL.

## 🎮 Controles

| Tecla | Acción |
|---|---|
| `WASD` / flechas | Moverse (con colisiones contra muebles) |
| `Enter` | Abrir chat (Enter envía, Esc cancela) |
| `/w nombre msg` | Susurro / mensaje privado |
| `F` | Saludar 👋 al compañero más cercano |
| `1–5` | Cambiar estado: 💻 codeando · 🤝 reunión · ☕ café · 🌙 ausente · 🟢 disponible |
| `Z X C V B N M` | Emotes: 👋 😂 🎉 👍 🤔 🔥 ☕ |
| `H` | Ayuda |

## 🗺️ La oficina (réplica del local real)

El mapa está calcado de la foto del espacio del equipo, en versión pixel art cenital:

- **Ventanal** al fondo con vista a la ciudad (skyline generado por código) y
  parches de sol reflejados sobre el piso.
- **Porcelanato beige brillante** con juntas de pastillas grandes y paredes blancas.
- **Counter bajo la ventana**: estantes de madera abiertos + gabinete blanco, con
  la **estación de café** ☕ (acercarte cambia tu estado a "pausa café" solo).
- **Puestos de trabajo** blancos con canto de madera y monitor con terminal
  verde 💚: pararte en la silla te pone "codeando".
- Lamparitas colgantes, spots embutidos y entrada con felpudo.
- Burbujas de chat sobre la cabeza, nombres con emoji de estado, lista de
  compañeros online, sonidos sutiles y reconexión automática.

## 🔧 Técnica

- **Servidor**: Node.js puro (http estático) + `ws` (WebSockets). Estado
  autoritativo-lite: retransmite posiciones (20 Hz), chat, estados y emotes.
- **Cliente**: canvas 2D vanilla, sin frameworks. Todo el pixel art se genera
  por código (tilemap 44×30 pre-renderizado + sprites de personaje por
  dirección/frame). Interpolación suave de jugadores remotos.
- Archivos:
  - `server.js` — servidor HTTP + WebSocket
  - `public/index.html` — pantalla de ingreso, HUD y ayuda
  - `public/style.css` — estilos pixel
  - `public/game.js` — mapa, sprites, física, red y UI

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
- Minijuegos en la pausa café ☕
