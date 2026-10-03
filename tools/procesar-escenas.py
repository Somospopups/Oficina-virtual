#!/usr/bin/env python3
"""Procesa las escenas nuevas (Oficina/v1.jpg = oficina, V2.jpg = balcón).

- Saca el verde de pantalla (los vidrios y el cielo quedan transparentes para
  dibujar el cielo dinámico atrás, como el ventanal actual).
- El verde de verdad es brillante y saturado (g>140, g-r>60, g-b>50): las
  plantas y las maderas no entran.
- Guarda sprites/bg_ofi.png + sprites/bg_balcon.png (+ .webp livianos).

Uso: python tools/procesar-escenas.py
"""
import os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(__file__), '..')


def es_verde(p):
    r, g, b = p
    return g > 140 and (g - r) > 60 and (g - b) > 50


def procesar(src, dst_base):
    im = Image.open(os.path.join(RAIZ, src)).convert('RGB')
    w, h = im.size
    px = im.load()
    rgba = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    n = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if es_verde(p):
                n += 1
                continue
            rgba.putpixel((x, y), p + (255,))
    for ext, kw in (('png', {}), ('webp', {'quality': 88, 'method': 6})):
        ruta = os.path.join(RAIZ, 'sprites', f'{dst_base}.{ext}')
        rgba.save(ruta, **kw)
        print(f'{dst_base}.{ext}: {os.path.getsize(ruta)//1024}KB', end='  ')
    print(f'(transparente {100*n//(w*h)}%)')


if __name__ == '__main__':
    procesar('Oficina/v1.jpg', 'bg_ofi')
    procesar('Oficina/V2.jpg', 'bg_balcon')
