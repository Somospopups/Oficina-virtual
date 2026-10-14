# Cómo meter un personaje nuevo

Esto es para Germán. No hace falta tocar código: se genera una hoja de sprites,
se corre un script y el personaje entra solo.

---

## 1. La plantilla

`plantillas/personaje.png` es la hoja en blanco, de 2048×2048, con fondo magenta
(`#FF00FF`) y **54 celdas rotuladas**. Ese archivo es el contrato: el script de
corte se guía por las medidas de `plantillas/personaje.json`, así que la hoja
tiene que respetar esa grilla.

`plantillas/personaje.json` también se puede leer a mano para saber qué va en
cada celda.

---

## 2. El prompt para generar la hoja

Copiar y pegar esto tal cual en el generador de imágenes, y cambiar sólo lo que
va entre corchetes:

```
Hoja de sprites de personaje para un juego de oficina, estilo chibi pixel art.

Mismo personaje en todas las celdas: [NOMBRE], [descripción: pelo, barba,
remera, pantalón, zapatos]. Paleta consistente en toda la hoja.

La hoja es una grilla de 8 columnas por 7 filas sobre fondo magenta plano
#FF00FF, sin sombras ni degradados en el fondo. Cada celda mide 237x238 px y
entre celda y celda hay un margen magenta de 24 px en horizontal y 40 px en
vertical. El borde de cada celda cae FUERA de la figura: la figura tiene que
quedar entera dentro de su celda, con aire magenta alrededor.

REGLAS OBLIGATORIAS, si no la hoja no sirve:

- El alto de la figura tiene que ser IDENTICO en todos los cuadros de un mismo
  ciclo (los 4 de parado, los 4 de caminata por dirección, los 4 de la silla).
  Que la cabeza llegue siempre a la misma altura y los pies siempre al mismo
  nivel. Es lo más importante de toda la hoja.
- Los pies van pegados al borde inferior de la figura, no flotando.
- NO dibujar sombra, reflejo ni halo bajo los pies. Nada de elipses celestes.
- En los perfiles: "izquierda" mira hacia la IZQUIERDA de la pantalla (la cara
  del lado izquierdo), "derecha" hacia la DERECHA. No dibujar los dos perfiles
  igual.
- Nada de texto, ni rótulos, ni recuadros, ni marcos dentro de las celdas.

Distribución, fila por fila, de izquierda a derecha:

FILA 1 — QUIETO: de frente, de espalda, perfil izquierdo, perfil derecho.
        Después CAMINATA de frente, cuadros 1 a 4.
FILA 2 — CAMINATA de espalda, cuadros 1 a 4. Después CAMINATA de perfil
        izquierdo, cuadros 1 a 4.
FILA 3 — CAMINATA de perfil derecho, cuadros 1 a 4. Después SENTADO en silla
        de escritorio: de frente, de espalda, perfil izquierdo, perfil
        derecho. La silla va adentro de la celda, con las patas abajo.
FILA 4 — SENTADO en sofá: de frente, de espalda, perfil izquierdo, perfil
        derecho. Después SENTADO en mesa de reuniones: de frente, de espalda,
        perfil izquierdo, perfil derecho. El mueble va adentro de la celda.
FILA 5 — INTERACCIONES de pie, de frente: tomando café, con el celular,
        pensando, saludando con la mano, escribiendo en un laptop, mirando una
        pantalla, hablando, relajado con las manos atrás.
FILA 6 — TRANSICIONES: los 4 cuadros de sentarse (de pie → bajando → casi
        sentado → sentado) y los 4 cuadros de levantarse (sentado → empezando
        a pararse → casi parado → de pie). De perfil, con la silla.
FILA 7 — EXPRESIONES: cara y torso de [NOMBRE] con 6 caras distintas
        (enojado, sorprendido, feliz, concentrado, aburrido, muerto de risa).

Estilo: chibi, cabeza grande (un tercio del cuerpo), contorno oscuro marcado,
pocos colores planos, sin antialiasing suave.
```

El resultado tiene que salir **2048×2048**. Si el generador tira otra medida,
pedir que respete esa medida o escalarla despues sin perder la grilla.

---

## 3. Cortar la hoja

Guardar el PNG en cualquier lado y correr, desde la carpeta del repo:

```
py -3 tools/procesar-hoja-personaje.py "C:\ruta\de\la\hoja.png" CLAVE
```

`CLAVE` es la del personaje (`ger`, `facu`, `ovni`, `milo`, `ove`, o una nueva).
El script escribe los PNG en `sprites/` con los nombres que ya usa el juego.

Si la hoja no sigue la grilla exacta (se corrió, se dibujó a mano, vino con
paneles), se le pasa un layout propio:

```
py -3 tools/procesar-hoja-personaje.py hoja.png CLAVE --layout plantillas/layout-german.json
```

Y hay dos ajustes que se piden a mano según la hoja:

- `--sin-sombra` — saca la sombra celeste que algunos generadores dejan bajo los
  pies. Se usa con hojas de fondo claro. Con fondo magenta no hace falta.
- `--voltear "celda,celda_*"` — espeja en horizontal las celdas que falten.
  Útil cuando la hoja sólo trae un perfil. Van los ids del manifiesto, con
  comodín. Ojo: no poner `silla_izq` ni `sofa_izq` si esa sección sí trae los
  dos lados, porque los rompería.

Al terminar el script dice qué celdas salieron vacías y cuáles del manifiesto
no estaban en esa hoja. Eso no rompe nada: el juego se queda con lo que ya
tenía para esas poses.

---

## 4. meterlo en el juego

Abrir `game.js` y buscar `CHAR_SPRITES`. Cada personaje es una línea:

```js
const CHAR_SPRITES = {
  ger:  { up: 'ger_up',  izq: 'ger_izq',  der: 'ger_der' },
  facu: {},
  ovni: { up: 'ovni_up' },
  milo: { up: 'milo_up' },
  ove:  { up: 'ove_up' },
};
```

Los campos son los archivos de `sprites/`, sin `.png`. Lo que falte se deriva
del de frente: la espalda es el frente apagado y el perfil es el frente
espejado. Si la hoja trajo los perfiles dibujados (izq y der), se listan ahí y
el juego los usa en vez de los espejados.

Si el personaje es nuevo de verdad, hay que agregarlo además en `CHAR_DEF`
(paleta, para el muñeco de respaldo) y en `walkSources` (los frames de
caminata), más el `CHAR_SPRITES` de arriba.

---

## 5. Chequear antes de cerrar

```
npm test
```

Eso corre todo, incluido `tools/chequear-personaje.js`, que revisa:

- que la altura de la figura sea constante dentro de cada ciclo de caminata
  (si un cuadro es más alto, el personaje "respira" al caminar);
- que los perfiles del parado miren para el lado que dicen;
- que no queden restos del fondo pegados a la figura;
- que todos los personajes del elenco estén a escala comparable.

---

## Cosas a tener en cuenta

- **Las animaciones sentado** (`ger_cafe1..4`, `ger_birra1..4`) son de otra hoja
  y tienen que medir lo mismo que `{personaje}_sit.png`. Por eso la plantilla
  escribe el sentado como `sit_left` / `sit_right` / `sit_up` / `sit_down` y
  **nunca** toca `_sit.png`: ese lo gobierna el juego hasta que una hoja traiga
  las dos cosas juntas.
- **`expr_1`** en la hoja de Ger no era una pose: era un arco de salto con
  figuras chicas. Si una sección no sirve, se la saca del layout y listo.
- **`birra` y `coca`** no están en la plantilla como celdas propias: son
  interacciones con objeto en la mano. Si el personaje no las tiene, no pasa
  nada, el juego usa las que ya existan para ese personaje.
