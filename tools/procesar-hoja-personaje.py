#!/usr/bin/env python3
"""Corta la hoja de un personaje y escribe sus sprites en sprites/.

El corte se guía por un manifiesto (plantillas/personaje.json), que es el
contrato de la grilla. Si la hoja no es un relleno de la plantilla sino algo
generado a mano o corrido de eje, se le pasa un layout propio con --layout.

Uso:
    py -3 tools/procesar-hoja-personaje.py <hoja.png> <char>
    py -3 tools/procesar-hoja-personaje.py <hoja.png> <char> --layout ruta.json
    py -3 tools/procesar-hoja-personaje.py <hoja.png> --detectar

Pasos, en orden:

  1. Recorta cada celda achicada un poco, para no comerse el borde negro.
  2. Saca el fondo POR RELLENO desde las cuatro esquinas. Así sólo se va lo
     que está CONECTADO con el borde: un blanco encerrado en negro (la suela
     de un sneaker, el blanco de un ojo) se queda opaco. El color de fondo es
     la mediana del anillo exterior de la celda, así que sirve con magenta,
     con blanco o con lo que traiga la hoja.
  3. Rampa de alfa por distancia al fondo, para no dejar la escalera de
     colores del aliasing en el contorno.
  4. Recorta a la figura.
  5. Reescala con VECINO MÁS CERCANO al alto de referencia. Es pixel art: con
     suavizado queda borroso.

La escala se calcula UNA sola vez, contra el parado de frente, y se aplica
igual a todos los cuadros. Si cada cuadro se forzara a su propia altura, un
frame con la pierna levantada achicaría al personaje y "respiraría" al
caminar.
"""
import argparse
import fnmatch
import json
import os
import sys

import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFIESTO = os.path.join(RAIZ, 'plantillas', 'personaje.json')
SPRITES = os.path.join(RAIZ, 'sprites')

PAD_PLANTILLA = 8        # se ensancha la celda de la plantilla, que es holgada
PAD_AJUSTADO = 1         # una celda medida apretada al contorno no se toca
CELDA_PLANTILLA = 200    # por debajo de este ancho la celda viene ajustada
FILL_T = 60              # tolerancia del relleno: con esto se va la sombra suave
T0, T1 = 30, 90          # rampa de alfa en el borde de la figura
ALTO_MINIMO = 24         # por debajo de esto la celda se considera vacía
ALTO_JUEGO = 490         # alto de figura con el que el juego dibuja

# Hojas con fondo blanco claro dibujan una sombra cian bajo los pies. En los
# perfiles caminando queda encerrada entre las piernas, el relleno no la
# alcanza, y el color es parecido al del fondo: ni la rampa ni el relleno la
# sacan. Se va por color. Se pide a mano porque una remera celeste caería.
SIN_SOMBRA = False

# Algunas hojas dibujan un solo perfil y el otro falta. Acá se dice cuáles
# celdas se espejan en horizontal para generar el lado que falta. Van por id,
# con comodín: --voltear "parado_izq,caminata_izq_*". Si se volteara "izq" a
# secas se romperían silla/sofa/mesa, que en la hoja sí traen los dos lados.
VOLTEAR = []


def hace_falta_voltear(cid):
    return any(fnmatch.fnmatch(cid, p) for p in VOLTEAR)


def es_sombra(rgba):
    """Cian claro y desaturado: el rastro que deja la hoja bajo los pies.

    El jean es azul más oscuro, la suela es blanca (R y B casi iguales) y el
    magenta tiene R y B iguales: ninguno de los tres entra.
    """
    r = rgba[:, :, 0].astype(np.int16)
    g = rgba[:, :, 1].astype(np.int16)
    b = rgba[:, :, 2].astype(np.int16)
    return (b - r > 20) & (b > 170) & (g > 150)


def cv2_mod():
    try:
        import cv2
        return cv2
    except Exception:
        sys.exit('Falta opencv-python. Instalar con:  pip install opencv-python')


# ---------- fondo ----------

def color_fondo(rgba):
    """Mediana del anillo exterior de la celda: ahí casi seguro está el fondo."""
    borde = np.concatenate([
        rgba[0, :, :3].reshape(-1, 3), rgba[-1, :, :3].reshape(-1, 3),
        rgba[:, 0, :3].reshape(-1, 3), rgba[:, -1, :3].reshape(-1, 3),
    ]).astype(np.float32)
    return np.median(borde, axis=0)


def quitar_fondo(im):
    cv2 = cv2_mod()
    rgba = np.array(im.convert('RGBA'))
    h, w = rgba.shape[:2]
    fondo = color_fondo(rgba)
    bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)

    lleno = np.zeros((h + 2, w + 2), np.uint8)
    for esquina in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        cv2.floodFill(bgr, lleno, esquina, 0,
                      loDiff=(FILL_T,) * 3, upDiff=(FILL_T,) * 3,
                      flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY)
    es_fondo = lleno[1:-1, 1:-1].astype(bool)

    dist = np.linalg.norm(rgba[:, :, :3].astype(np.float32) - fondo, axis=2)
    rampa = np.clip((dist - T0) / float(T1 - T0), 0.0, 1.0)
    alfa = np.where(es_fondo, (rampa * 255).astype(np.uint8), 255)
    # La sombra bajo los pies y el halo del panel quedan agarrados al borde de la
    # figura: el relleno los marca como fondo, pero la rampa les dejaría alfa.
    # Donde el relleno llegó y el color está cerca del fondo, se va entero.
    alfa = np.where(es_fondo & (dist < FILL_T), 0, alfa)
    if SIN_SOMBRA:
        alfa = np.where(es_sombra(rgba), 0, alfa)

    out = rgba.copy()
    out[:, :, 3] = np.minimum(out[:, :, 3], alfa)
    return Image.fromarray(out, 'RGBA')


def recortar_figura(im):
    alfa = np.array(im.getchannel('A'))
    ys, xs = np.where(alfa > 16)
    if len(ys) == 0:
        return None
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def escalar(im, factor):
    """Vecino más cercano: conserva los bloques del pixel art."""
    ancho = max(1, round(im.width * factor))
    alto = max(1, round(im.height * factor))
    if (ancho, alto) == im.size:
        return im
    return im.resize((ancho, alto), Image.NEAREST)


# ---------- manifiesto ----------

def cargar_celdas(ruta, img):
    with open(ruta, encoding='utf-8') as f:
        data = json.load(f)
    celdas = data['celdas']
    lienzo = data.get('lienzo')
    if lienzo and (lienzo['w'] != img.width or lienzo['h'] != img.height):
        sx, sy = img.width / lienzo['w'], img.height / lienzo['h']
        for c in celdas:
            c['x'], c['w'] = c['x'] * sx, c['w'] * sx
            c['y'], c['h'] = c['y'] * sy, c['h'] * sy
        print(f'  manifiesto escalado de {lienzo["w"]}x{lienzo["h"]} '
              f'a {img.width}x{img.height}')
    return celdas


def nombre_salida(char, c):
    """Archivo de sprites/ que le corresponde a una celda, o None si no se usa."""
    sec, ori, cid = c['seccion'], c['orientacion'], c['id']
    if sec == 'parado':
        return {'down': f'{char}.png', 'up': f'{char}_up.png',
                'left': f'{char}_izq.png', 'right': f'{char}_der.png'}[ori]
    if sec == 'caminata':
        n = cid.rsplit('_', 1)[-1]
        return {'down': f'{char}_walk{n}.png', 'up': f'{char}_wu{n}.png',
                'left': f'{char}_wl{n}.png', 'right': f'{char}_wr{n}.png'}[ori]
    if sec == 'silla':
        # Siempre con la dirección explícita, nunca el canónico _sit.png. Ese
        # archivo lo gobierna el juego (SIT_BASE_FACE dice si hay que espejarlo)
        # y tiene que seguir midiendo lo mismo que los cuadros de las animaciones
        # sentado (cafe, birra), que son de otra hoja. Si una hoja nueva trae las
        # dos cosas juntas, recién ahí se apunta CHAR_SPRITES a _sit_left.
        return f'{char}_sit_{ori}.png'
    if sec in ('sofa', 'mesa'):
        return f'{char}_{sec}_{ori}.png'
    if sec == 'interaccion':
        return f'{char}_acc_{cid.split("_", 1)[1]}.png'
    if sec == 'transicion':
        return f'{char}_{cid}.png'
    if sec == 'expresion':
        return f'{char}_{cid}.png'
    return None


# ---------- corte ----------

def recortar_celda(img, c):
    """Ensancha la celda, saca el fondo y devuelve sólo la figura.

    Se ensancha en vez de achicar: el relleno desde las esquinas necesita que
    las esquinas del recorte caigan en fondo. Pero una celda ya medida apretada
    al contorno no se ensancha, o se come el borde del panel de la hoja.
    """
    pad = PAD_PLANTILLA if c['w'] >= CELDA_PLANTILLA else PAD_AJUSTADO
    x = max(0, int(round(c['x'] - pad)))
    y = max(0, int(round(c['y'] - pad)))
    w = min(img.width - x, int(round(c['w'] + 2 * pad)))
    h = min(img.height - y, int(round(c['h'] + 2 * pad)))
    if w <= 4 or h <= 4:
        return None
    trozo = img.crop((x, y, x + w, y + h))
    fig = recortar_figura(quitar_fondo(trozo))
    return solos(fig) if fig is not None else None


def solos(im):
    """Deja sólo los bultos grandes: tira los restos de borde y los sueltos."""
    cv2 = cv2_mod()
    alfa = np.array(im.getchannel('A'))
    n, etiquetas, stats, _ = cv2.connectedComponentsWithStats((alfa > 16).astype(np.uint8), 8)
    if n <= 2:
        return im
    areas = [stats[i][4] for i in range(1, n)]
    minima = max(40, int(max(areas) * 0.05))
    mascara = np.isin(etiquetas, [i for i in range(1, n) if stats[i][4] >= minima])
    rgba = np.array(im)
    rgba[:, :, 3] = np.where(mascara, rgba[:, :, 3], 0)
    return Image.fromarray(rgba, 'RGBA')


def procesar(hoja, char, ruta_layout):
    img = Image.open(hoja)
    print(f'hoja: {os.path.basename(hoja)}  {img.width}x{img.height}  {img.mode}')
    celdas = cargar_celdas(ruta_layout, img)

    # 1) El parado de frente fija el alto de todo el personaje.
    ref = next((c for c in celdas if c['id'] == 'parado_frente'), None)
    if ref is None:
        sys.exit('El manifiesto no tiene la celda parado_frente.')
    fig_ref = recortar_celda(img, ref)
    if fig_ref is None:
        sys.exit('La celda parado_frente salió vacía: ¿está dibujada?')
    factor = ALTO_JUEGO / fig_ref.height
    print(f'referencia: parado_frente mide {fig_ref.height}px de alto  '
          f'-> escala x{factor:.2f}')

    os.makedirs(SPRITES, exist_ok=True)
    escritos, vacias, volteadas = [], [], []
    for c in celdas:
        destino = nombre_salida(char, c)
        if not destino:
            continue
        fig = fig_ref if c is ref else recortar_celda(img, c)
        if fig is None or fig.height < ALTO_MINIMO:
            vacias.append(c['id'])
            continue
        if hace_falta_voltear(c['id']):
            fig = fig.transpose(Image.FLIP_LEFT_RIGHT)
            volteadas.append(c['id'])
        out = escalar(fig, factor)
        out.save(os.path.join(SPRITES, destino))
        escritos.append((destino, out.size))

    print(f'\nescritos: {len(escritos)}')
    for nombre, size in escritos:
        print(f'  {nombre:26} {size[0]}x{size[1]}')
    if volteadas:
        print(f'\nESPEJADAS EN HORIZONTAL ({len(volteadas)}): {", ".join(volteadas)}')
    if vacias:
        print(f'\nCELDAS VACÍAS ({len(vacias)}): {", ".join(vacias)}')
        print('  -> revisar la hoja: esas poses no se dibujaron.')

    # Qué le falta a la hoja respecto de lo que el juego espera.
    if os.path.abspath(ruta_layout) != os.path.abspath(MANIFIESTO) and os.path.exists(MANIFIESTO):
        with open(MANIFIESTO, encoding='utf-8') as f:
            esperadas = {c['id'] for c in json.load(f)['celdas']}
        dadas = {c['id'] for c in celdas}
        faltan = sorted(esperadas - dadas)
        if faltan:
            print(f'\nNO ESTÁN EN ESTA HOJA ({len(faltan)}): {", ".join(faltan)}')
            print('  -> el juego se queda con lo que ya tenía para esas poses.')
    return escritos, vacias


# ---------- detección (hojas que no siguen la plantilla) ----------

def detectar(img):
    """Encuentra las figuras de una hoja y propone un layout agrupado por filas."""
    cv2 = cv2_mod()
    rgba = np.array(img.convert('RGBA'))
    alfa = rgba[:, :, 3]
    if alfa.min() == 255:
        fondo = color_fondo(rgba)
        dist = np.linalg.norm(rgba[:, :, :3].astype(np.float32) - fondo, axis=2)
        binario = (dist > T1).astype(np.uint8)
    else:
        binario = (alfa > 16).astype(np.uint8)

    binario = cv2.morphologyEx(binario, cv2.MORPH_CLOSE,
                               cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    n, _, stats, _ = cv2.connectedComponentsWithStats(binario, 8)
    cajas = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 300 or w < 12 or h < 24:
            continue
        if w > img.width * 0.5 or h > img.height * 0.5:
            continue
        cajas.append((int(x), int(y), int(w), int(h)))

    cajas.sort(key=lambda b: (b[1] + b[3] / 2, b[0]))
    filas = []
    for b in cajas:
        cy = b[1] + b[3] / 2
        for fila in filas:
            if abs(cy - fila['cy']) < max(28, b[3] * 0.45):
                fila['items'].append(b)
                fila['cy'] = (fila['cy'] * fila['n'] + cy) / (fila['n'] + 1)
                fila['n'] += 1
                break
        else:
            filas.append({'cy': cy, 'items': [b], 'n': 1})

    print(f'figuras detectadas: {len(cajas)} en {len(filas)} filas')
    propuesta = []
    for k, fila in enumerate(sorted(filas, key=lambda f: f['cy'])):
        items = sorted(fila['items'], key=lambda b: b[0])
        print(f'  fila {k:2d}  n={len(items):2d}  y~{int(fila["cy"]):4d}  '
              f'x={[b[0] for b in items]}  altos={[b[3] for b in items]}')
        for j, (x, y, w, h) in enumerate(items):
            propuesta.append({'id': f'f{k}_{j}', 'seccion': 'pendiente',
                              'orientacion': 'down', 'x': x, 'y': y, 'w': w, 'h': h})
    salida = os.path.join(RAIZ, 'plantillas', 'layout-detectado.json')
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump({'lienzo': {'w': img.width, 'h': img.height}, 'celdas': propuesta},
                  f, ensure_ascii=False, indent=2)
    print(f'\npropuesta escrita en {salida}')
    return propuesta


def main():
    global SIN_SOMBRA, VOLTEAR
    ap = argparse.ArgumentParser()
    ap.add_argument('hoja')
    ap.add_argument('char', nargs='?')
    ap.add_argument('--layout', default=MANIFIESTO)
    ap.add_argument('--detectar', action='store_true')
    ap.add_argument('--sin-sombra', action='store_true',
                    help='saca la sombra cian bajo los pies de hojas con fondo claro')
    ap.add_argument('--voltear', default='',
                    help='ids de celdas a espejar en horizontal, con comodín. '
                         'Ej: --voltear "parado_izq,caminata_izq_*"')
    a = ap.parse_args()
    SIN_SOMBRA = a.sin_sombra
    VOLTEAR = [p.strip() for p in a.voltear.split(',') if p.strip()]
    if a.detectar:
        detectar(Image.open(a.hoja))
        return
    if not a.char:
        sys.exit('Falta la clave del personaje. Ej: procesar-hoja-personaje.py hoja.png ger')
    procesar(a.hoja, a.char, a.layout)


if __name__ == '__main__':
    main()
