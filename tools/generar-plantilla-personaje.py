#!/usr/bin/env python3
"""Genera la plantilla de hoja de personaje + su manifiesto.

La plantilla es el CONTRATO entre el dueño (que rellena las celdas con su
generador) y el juego (que las corta con procesar-hoja-personaje.py). Si algún
día hay que cambiar el reparto de celdas, se cambia acá y se regenera todo:
el manifiesto es lo que leen el corte y el chequeo, así que nunca hay que
volver a medir nada a mano.

Uso:
    py -3 tools/generar-plantilla-personaje.py

Escribe:
    plantillas/personaje.png    la hoja en blanco, con los rótulos puestos
    plantillas/personaje.json   las 54 celdas, con su rectángulo exacto
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'plantillas')

# Geometría de la hoja. Si cambia una de estas cifras, cambia el manifiesto.
ANCHO = ALTO = 2048
MARGEN_ARRIBA = 76      # deja aire para el título
MARGEN = 32             # izquierda / derecha / abajo
COLS, FILAS = 8, 7
CELDA_W, CELDA_H = 237, 238
BANDA_ROTULO = 26       # alto del rótulo sobre cada celda
AIRE_ROTULO = 4         # aire entre el rótulo y la celda
MEDIANIL_X = 12
MEDIANIL_Y = 10

MAGENTA = (255, 0, 255)
BORDE = (18, 18, 22)
ROTULO = (255, 255, 255)
TITULO = (12, 12, 16)

PASO_X = CELDA_W + MEDIANIL_X
PASO_Y = BANDA_ROTULO + AIRE_ROTULO + CELDA_H + MEDIANIL_Y


# El reparto. Cada entrada es (id, rótulo, sección, orientación).
# La orientación sólo importa en los perfiles: 'left' y 'right' le dicen al
# chequeo para qué lado tiene que mirar el dibujo.
def _filas():
    f = []

    # Fila 1: parado + caminata de frente
    for i, (sid, rot) in enumerate([('frente', 'PARADO FRENTE'), ('espalda', 'PARADO ESPALDA'),
                                    ('izq', 'PARADO IZQ ←'), ('der', 'PARADO DER →')]):
        f.append((f'parado_{sid}', rot, 'parado', {'frente': 'down', 'espalda': 'up',
                                                   'izq': 'left', 'der': 'right'}[sid]))
    for n in range(1, 5):
        f.append((f'caminata_frente_{n}', f'CAM FRENTE {n}', 'caminata', 'down'))
    # Fila 2: caminata espalda + izquierda
    for n in range(1, 5):
        f.append((f'caminata_espalda_{n}', f'CAM ESPALDA {n}', 'caminata', 'up'))
    for n in range(1, 5):
        f.append((f'caminata_izq_{n}', f'CAM IZQ {n} ←', 'caminata', 'left'))
    # Fila 3: caminata derecha + silla de oficina
    for n in range(1, 5):
        f.append((f'caminata_der_{n}', f'CAM DER {n} →', 'caminata', 'right'))
    for sid, rot, ori in [('frente', 'SILLA FRENTE', 'down'), ('espalda', 'SILLA ESPALDA', 'up'),
                          ('izq', 'SILLA IZQ ←', 'left'), ('der', 'SILLA DER →', 'right')]:
        f.append((f'silla_{sid}', rot, 'silla', ori))
    # Fila 4: sofá + mesa de reuniones
    for pre, nombre in [('sofa', 'SOFÁ'), ('mesa', 'MESA')]:
        for sid, rot, ori in [('frente', 'FRENTE', 'down'), ('espalda', 'ESPALDA', 'up'),
                              ('izq', 'IZQ ←', 'left'), ('der', 'DER →', 'right')]:
            f.append((f'{pre}_{sid}', f'{nombre} {rot}', pre, ori))
    # Fila 5: interacciones de pie
    for n, (sid, rot) in enumerate([('cafe', 'CAFÉ ☕'), ('birra', 'BIRRA 🍺'), ('celular', 'CELULAR 📱'),
                                    ('saludar', 'SALUDAR 👋'), ('escribir', 'ESCRIBIR ⌨'),
                                    ('pantalla', 'PANTALLA 🖥'), ('pensar', 'PENSAR 🤔'),
                                    ('relajado', 'RELAJADO 😌')], 1):
        f.append((f'acc_{sid}', rot, 'interaccion', 'down'))
    # Fila 6: transiciones
    for n in range(1, 5):
        f.append((f'sentarse_{n}', f'SENTARSE {n}', 'transicion', 'down'))
    for n in range(1, 5):
        f.append((f'levantarse_{n}', f'LEVANTARSE {n}', 'transicion', 'down'))
    # Fila 7: expresiones (6) + 2 huecos libres
    for n in range(1, 7):
        f.append((f'expr_{n}', f'EXPR {n}', 'expresion', 'down'))
    return f


CELDA_ID = _filas()
assert len(CELDA_ID) == 54, len(CELDA_ID)


def celda_xy(i):
    """Esquina superior izquierda de la celda i (0-based, fila mayor)."""
    col, fil = i % COLS, i // COLS
    x = MARGEN + col * PASO_X
    y_top = MARGEN_ARRIBA + fil * PASO_Y          # borde superior de la banda
    y = y_top + BANDA_ROTULO + AIRE_ROTULO        # borde superior de la celda
    return x, y, y_top


def fuente(tam):
    for ruta in [r'C:\Windows\Fonts\arialbd.ttf', r'C:\Windows\Fonts\arial.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(ruta, tam)
        except Exception:
            continue
    return ImageFont.load_default()


def generar():
    os.makedirs(SALIDA, exist_ok=True)
    im = Image.new('RGB', (ANCHO, ALTO), MAGENTA)
    d = ImageDraw.Draw(im)

    f_rot = fuente(15)
    f_tit = fuente(26)
    f_sub = fuente(15)

    d.text((MARGEN, 22), 'HOJA DE SPRITES — PERSONAJE', font=f_tit, fill=TITULO)
    d.text((MARGEN, 54), 'Dibujo chibi, cuerpo entero. Los PIES VAN PEGADOS AL BORDE INFERIOR de cada celda. '
                         'Mismo alto de figura en todos los cuadros. Fondo magenta, sin sombras ni marcos.',
           font=f_sub, fill=TITULO)

    manifiesto = []
    for i, (sid, rot, sec, ori) in enumerate(CELDA_ID):
        x, y, y_rot = celda_xy(i)
        d.text((x + 2, y_rot + 4), rot, font=f_rot, fill=ROTULO)
        # El borde queda SOBRE el límite de la celda: el corte escanea el
        # interior con un pequeño margen, así que nunca lo toma por tinta.
        d.rectangle([x - 1, y - 1, x + CELDA_W, y + CELDA_H], outline=BORDE, width=2)
        manifiesto.append({
            'id': sid, 'seccion': sec, 'orientacion': ori,
            'x': x, 'y': y, 'w': CELDA_W, 'h': CELDA_H,
        })

    png = os.path.join(SALIDA, 'personaje.png')
    js = os.path.join(SALIDA, 'personaje.json')
    im.save(png)
    with open(js, 'w', encoding='utf-8') as f:
        json.dump({
            'descripcion': 'Plantilla de hoja de personaje. Fuente de verdad del corte.',
            'lienzo': {'w': ANCHO, 'h': ALTO},
            'fondo': '#ff00ff',
            'alto_objetivo_figura': 490,
            'notas': [
                'Los pies van pegados al borde inferior de la celda.',
                'El alto de figura debe ser IDENTICO en todos los cuadros de un mismo ciclo.',
                'Los perfiles: izquierda mira a la izquierda de la pantalla, derecha a la derecha.',
                'Las celdas de silla/sofa/mesa llevan el mueble adentro, con las patas abajo.',
            ],
            'celdas': manifiesto,
        }, f, ensure_ascii=False, indent=2)

    print(f'plantilla: {png}')
    print(f'manifiesto: {js}')
    print(f'celdas: {len(manifiesto)}  celda: {CELDA_W}x{CELDA_H}  '
          f'figura útil: ~{CELDA_H - 14}px  escala al juego: ~{490 / (CELDA_H - 14):.1f}x')


if __name__ == '__main__':
    generar()
