#!/usr/bin/env python3
"""Procesa la hoja de la bailarina (bailarina.png, 3x2 sobre fondo verde).

- Corta los 6 cuadros (orden de la hoja -> pole1..6).
- Saca el verde (chroma key; sombras oscuras y caño se conservan).
- Detecta el caño en cada cuadro (columna gris vertical) y los compone
  sobre un lienzo común con el caño en la MISMA x: en pantalla el caño
  queda clavado y sólo se mueve la bailarina.
- Guarda sprites/pole1..6.png + .webp (livianos).

Uso: python tools/procesar-bailarina.py
"""
import os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(__file__), '..')
HOJA = os.path.join(RAIZ, 'bailarina.png')
COLS, FILAS = 3, 2


def es_verde(p):
    r, g, b = p
    return g > 90 and (g - r) > 25 and (g - b) > 15


def es_gris(p):
    r, g, b = p
    bri = (r + g + b) // 3
    return (max(p) - min(p)) < 36 and 45 < bri < 225


def main():
    hoja = Image.open(HOJA).convert('RGB')
    cw, chh = hoja.width // COLS, hoja.height // FILAS
    celdas = []
    for f in range(FILAS):
        for c in range(COLS):
            celdas.append(hoja.crop((c * cw, f * chh, (c + 1) * cw, (f + 1) * chh)))

    # Caño por cuadro: columnas con continuidad vertical gris.
    polos = []
    for idx, cel in enumerate(celdas):
        px = cel.load()
        mejor, mejor_x, mejor_n = 0, cw // 2, 0
        x = 0
        while x < cw:
            if sum(1 for y in range(chh) if es_gris(px[x, y])) > chh * 0.28:
                x0 = x
                while x < cw and sum(1 for y in range(chh) if es_gris(px[x, y])) > chh * 0.28:
                    x += 1
                if x - x0 > mejor:
                    mejor, mejor_x, mejor_n = x - x0, (x0 + x) // 2, x - x0
            else:
                x += 1
        polos.append(mejor_x)
        print(f'cuadro {idx + 1}: caño x={mejor_x} ancho={mejor_n}')
        assert mejor_n >= 4, f'no se encontró el caño en el cuadro {idx + 1}'

    # Lienzo común: el caño en la misma x para los 6.
    polo_x = max(polos)
    ancho = polo_x + max(cw - p for p in polos)

    # Base del caño por cuadro: fila más baja con metal en la banda del caño.
    # Sin esto el pie del caño salta hasta 19 px entre cuadros (se ve en los
    # pies). Se alinea abajo: el lienzo crece lo necesario y arriba se pierde
    # sólo caño (que sigue de largo fuera de la hoja).
    bases = []
    for cel, px0 in zip(celdas, polos):
        px = cel.load()
        base = max((y for y in range(chh) for x in range(px0 - 8, px0 + 8)
                    if es_gris(px[x, y])), default=chh - 1)
        bases.append(base)
    base_y = max(bases)
    alto = chh + (base_y - min(bases))
    print(f'lienzo: {ancho}x{alto}, caño en x={polo_x}, base en y={base_y}')

    for idx, (cel, px0, b0) in enumerate(zip(celdas, polos, bases)):
        rgba = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
        px_cel = cel.load()
        # Pega con key de verde directo sobre el lienzo.
        dx = polo_x - px0
        dy = base_y - b0
        for y in range(chh):
            for x in range(cw):
                p = px_cel[x, y]
                if not es_verde(p):
                    rgba.putpixel((x + dx, y + dy), p + (255,))
        base = f'pole{idx + 1}'
        rgba.save(os.path.join(RAIZ, 'sprites', base + '.png'))
        rgba.save(os.path.join(RAIZ, 'sprites', base + '.webp'), 'WEBP', quality=85, method=6)
        s_png = os.path.getsize(os.path.join(RAIZ, 'sprites', base + '.png')) // 1024
        s_wbp = os.path.getsize(os.path.join(RAIZ, 'sprites', base + '.webp')) // 1024
        print(f'{base}: {s_png}KB png / {s_wbp}KB webp')


if __name__ == '__main__':
    main()
