#!/usr/bin/env python3
"""Preview fiel de la oficina: fondo + personajes a escala real + oclusión de muebles.

Reproduce la matemática de game.js (escalaFigura / sitScale / oclusión) sin
abrir el navegador, para calibrar asientos y muebles mirando una imagen.

Los datos NO se copian: se leen de game.js, así el preview no se despega del
juego (el mismo criterio que tools/chequear-sillas.js).

Uso: python3 tools/preview-escena.py [salida.png]
     python3 tools/preview-escena.py --sentados      # sólo un personaje por puesto
"""
from PIL import Image, ImageDraw
import json, os, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(RAIZ, 'sprites')
GAME = os.path.join(RAIZ, 'game.js')


def escenas_de_game():
    """Saca el objeto ESCENAS de game.js (fuente única de verdad)."""
    js = r"""
const fs = require('fs');
const s = fs.readFileSync(process.argv[1], 'utf8');
const i = s.indexOf('const ESCENAS = ');
const j = s.indexOf('\n};', i) + 3;
const E = eval('(' + s.slice(i, j).replace('const ESCENAS = ', '').replace(/;\s*$/, '') + ')');
console.log(JSON.stringify(E));
"""
    out = subprocess.run(['node', '-e', js, GAME], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def alto(y, fig, y_top, y_bot):
    t = max(0.0, min(1.0, (y - y_top) / (y_bot - y_top)))
    return fig[0] + (fig[1] - fig[0]) * t


def cargar(n):
    return Image.open(os.path.join(SPR, n)).convert('RGBA')


def sombra(dst, x, y, h, w_ratio):
    sh_r = 11 * (h / 44) * w_ratio * (32 / 44) * 1.9
    sh = Image.new('RGBA', (int(sh_r * 2) + 4, int(sh_r * 0.64) + 4), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([2, 2, sh.width - 3, sh.height - 3], fill=(0, 0, 0, 56))
    dst.alpha_composite(sh, (int(x - sh.width / 2), int(y + 4 - sh.height / 2)))


def poner(dst, spr, x, y, h):
    w = round(spr.width * h / spr.height)
    s = spr.resize((w, int(h)), Image.LANCZOS)
    sombra(dst, x, y, h, spr.width / spr.height)
    dst.alpha_composite(s, (int(x - w / 2), int(y - h)))


def ocluir(dst, bg, o, y_pies):
    """Vuelve a pintar el mueble por encima del personaje que quedó detrás."""
    if y_pies >= o['y1']:
        return
    y1 = min(o['y1'], y_pies + 8)
    if y1 <= o['y0']:
        return
    rec = bg.crop((o['x0'], o['y0'], o['x1'], y1))
    dst.alpha_composite(rec, (o['x0'], o['y0']))


# un personaje distinto por puesto, para verlos a todos juntos
SPRITES = ['ger', 'facu', 'ovni', 'ove', 'milo']


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else '/tmp/escena.png'
    solo_sentados = '--sentados' in sys.argv
    E = escenas_de_game()['ofi']
    F = E['piso']
    bg = Image.open(os.path.join(SPR, 'bg_ofi_dia.jpg')).convert('RGBA')
    dst = bg.copy()
    pers = []
    for n, s in enumerate(E['sillas']):
        char = SPRITES[n % len(SPRITES)]
        if s['tipo'] == 'pc' or char == 'milo':
            spr = cargar(f'{char}_sit.png')
        else:
            spr = cargar(f'{char}_puf1.png')
        h = alto(s['y'], F['fig'], F['yTop'], F['yBot']) * 0.82
        pers.append((s['y'], s, spr, h))
    if not solo_sentados:
        for x, y, char in [(990, 760, 'ger'), (600, 700, 'facu'), (1330, 470, 'ovni'), (300, 520, 'ove')]:
            pers.append((y, {'x': x, 'y': y}, cargar(f'{char}.png'), alto(y, F['fig'], F['yTop'], F['yBot'])))
    for y, s, spr, h in sorted(pers, key=lambda p: p[0]):
        poner(dst, spr, s['x'], s['y'], h)
        propio = s.get('mueble')
        for o in F['obst']:
            if propio and o.get('id') == propio:
                continue
            ocluir(dst, bg, o, y)
    dst.convert('RGB').save(out, quality=93)
    print(f'listo: {out}  ({len(E["sillas"])} puestos, {len(F["obst"])} muebles)')


if __name__ == '__main__':
    main()
