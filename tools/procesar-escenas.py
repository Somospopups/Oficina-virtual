#!/usr/bin/env python3
"""Prepara los fondos de las escenas: la oficina y la terraza.

Las escenas nuevas ya vienen PINTADAS completas (cielo, sol, nubes y noche van
adentro del dibujo), asi que ya no hay verde de pantalla que sacar: el cielo lo
elige el juego cruzando las variantes por hora, no una capa transparente detras.

Lo que hace este script:

1. Normaliza el tamano de cada escena (todas las variantes de una escena tienen
   que medir exactamente lo mismo, o al cruzar de una a otra el mundo salta un
   pixel y los chibis se corren).
2. Escribe los dos formatos que sirve el juego, en `sprites/`:
   el WebP liviano que se baja siempre y el JPG de rescate si el navegador no
   soporta WebP. No queda ningun PNG de fondo: sin transparencia que cuidar
   pesarian ~9 MB de mas.

Salida:

    sprites/bg_ofi_dia.webp        sprites/bg_ofi_dia.jpg
    sprites/bg_ofi_noche.webp      sprites/bg_ofi_noche.jpg
    sprites/bg_terraza_dia.webp    sprites/bg_terraza_dia.jpg
    sprites/bg_terraza_atardecer.webp   sprites/bg_terraza_atardecer.jpg
    sprites/bg_terraza_noche.webp  sprites/bg_terraza_noche.jpg

Uso:
    python3 tools/procesar-escenas.py          # reescribe los fondos
    python3 tools/procesar-escenas.py --check  # no escribe, sólo informa
"""
import os
import sys
from PIL import Image

RAIZ = os.path.join(os.path.dirname(__file__), '..')

# Una escena = un tamano fijo + sus variantes de hora. La oficina tiene dia y
# noche; la terraza, ademas, atardecer (es la que mas se mira: da al oeste).
ESCENAS = {
    'oficina': {
        'ancho': 1983, 'alto': 793,
        'variantes': {
            'dia': 'oficina-dia.jpg',
            'noche': 'oficina-noche.jpg',
        },
    },
    'terraza': {
        'ancho': 2039, 'alto': 771,
        'variantes': {
            'dia': 'terraza-dia.jpg',
            'atardecer': 'terraza-atardecer.jpg',
            'noche': 'terraza-noche.jpg',
        },
    },
}
PREFIJO = {'oficina': 'bg_ofi', 'terraza': 'bg_terraza'}
# Calidad de salida. El WebP baja siempre: 88 se ve identico a ojo y pesa ~10x
# menos que el PNG. El JPG es sólo rescate, un punto mas de calidad.
WEBP_Q, JPG_Q = 88, 90


def ajustar(im, W, H):
    """Lleva el dibujo a WxH sin deformarlo.

    Si sobra se recorta por el centro; si falta (paso de 2038 a 2039 px en la
    terraza del dia) se extiende repitiendo la ultima fila/columna, asi no se
    abre una raya transparente al costado.
    """
    im = im.convert('RGB')
    if im.size == (W, H):
        return im
    # sobra: recorte centrado
    if im.width > W or im.height > H:
        x = max(0, (im.width - W) // 2)
        y = max(0, (im.height - H) // 2)
        im = im.crop((x, y, x + min(W, im.width), y + min(H, im.height)))
    if im.size == (W, H):
        return im
    lienzo = Image.new('RGB', (W, H))
    lienzo.paste(im, (0, 0))
    px = lienzo.load()
    # extiende la ultima columna y la ultima fila
    for y in range(im.height):
        ultimo = px[im.width - 1, y]
        for x in range(im.width, W):
            px[x, y] = ultimo
    for y in range(im.height, H):
        for x in range(W):
            px[x, y] = px[x, y - 1]
    return lienzo


def procesar(solo_check):
    if solo_check:
        print('--check: no se escribe nada')
    for escena, cfg in ESCENAS.items():
        W, H = cfg['ancho'], cfg['alto']
        for nombre, origen in cfg['variantes'].items():
            src = os.path.join(RAIZ, 'Oficina', origen)
            if not os.path.exists(src):
                print(f'  falta la fuente {origen}')
                return 1
            base = os.path.join(RAIZ, 'sprites', f'{PREFIJO[escena]}_{nombre}')
            if solo_check:
                faltan = [e for e in ('webp', 'jpg') if not os.path.exists(base + '.' + e)]
                estado = 'faltan ' + ', '.join(faltan) if faltan else 'ok'
                print(f'  {os.path.basename(base)}: {estado}')
                continue
            im = ajustar(Image.open(src), W, H)
            im.save(base + '.webp', 'WEBP', quality=WEBP_Q, method=6)
            im.save(base + '.jpg', 'JPEG', quality=JPG_Q, subsampling=0)
            kb = (os.path.getsize(base + '.webp') + os.path.getsize(base + '.jpg')) // 1024
            print(f'  {os.path.basename(base)}: {W}x{H} · {kb}KB (webp+jpg)')
    return 0


if __name__ == '__main__':
    sys.exit(procesar('--check' in sys.argv))
