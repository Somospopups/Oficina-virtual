# 📦 Protocolo obligatorio para entregar cambios con `PUBLICAR.bat`

Este documento explica cómo debe trabajar cualquier IA o agente que modifique este repositorio para el propietario. El propietario **no programa, no usa terminal, no copia archivos a mano y no resuelve conflictos**. La IA hace todo el trabajo técnico y entrega un ZIP que se publica con doble clic.

> **Comportamiento elegido por el propietario:** preparar el BAT directamente. No pedir aprobación previa ni mostrar preview, salvo que el propietario lo solicite expresamente.

## 1. Regla de seguridad

- Nunca pedir ni usar tokens, contraseñas, cookies o claves pegadas en el chat.
- Si aparece un token en una conversación, indicar que se revoque y no usarlo.
- El BAT usa `git push` y deja que Git Credential Manager abra el inicio de sesión oficial de GitHub.
- No guardar credenciales en el ZIP, el bundle, los commits ni el repositorio.

## 2. Antes de modificar

1. Leer completo [`AGENTE.md`](AGENTE.md).
2. Trabajar siempre desde el último `origin/main`, no desde una copia antigua:

```bash
git remote add origin https://github.com/Somospopups/Oficina-virtual.git 2>/dev/null || true
git fetch origin main
git reset --hard origin/main
```

3. Confirmar la versión actual en `game.js` y el sello de `index.html`.
4. No reescribir, revertir ni mezclar cambios recientes que no pertenecen a la tarea.

## 3. Si se reemplazan sprites

- Eliminar el fondo y entregar PNG RGBA con transparencia real.
- Quitar sombras de presentación que no pertenezcan al sprite del juego.
- No deformar la proporción de la figura.
- Conservar la lógica de altura del personaje existente como referencia.
- Usar los nombres que ya consume el juego: por ejemplo `ger.png`, `ovni_sit.png`, etc.
- Los sprites sentados incluyen la silla.
- Si se modifica un `_sit.png`, revisar las advertencias de `AGENTE.md`: las animaciones sentadas de ese personaje pueden requerir realineación.
- No editar `assets.js` manualmente. Regenerarlo siempre con:

```bash
node tools/generar-assets.js
```

## 4. Versionado obligatorio

Cada publicación incrementa la versión exactamente una vez. Deben coincidir:

```html
<!-- index.html -->
<meta name="ov-build" content="vNNN">
```

```js
// game.js
const VERSION = 'vNNN · DD/MM/AAAA';
```

Usar la fecha local de Argentina. No reutilizar una versión ya publicada.

## 5. Verificaciones antes de entregar

Un solo comando corre todo:

```bash
npm test
```

(`npm test` = `node tools/chequear-todo.js`: sintaxis de game/server/tools,
fondos de los PNG, `generar-assets` + `git diff --exit-code -- assets.js`,
`checlear-boton-e`, `chequear-sillas`, `chequear-caminata`, `git diff --check`
y `git status`. Se detiene en el primero que falla. Es lo mismo que corre
`.github/workflows/chequeos.yml` en cada push a `main`.)

A mano, si hace falta aislar algo:

```bash
node tools/limpiar-fondo-sprites.js --check
node tools/generar-assets.js
node tools/checlear-boton-e.js
git diff --check
```

Si la tarea afecta sillas, roster u otra función con chequeador propio, ejecutar también ese chequeador. No preparar el ZIP si falla una prueba.

## 6. Commit limpio

Configurar identidad solo dentro del repositorio y crear un commit claro:

```bash
git config user.name "Arena Agent"
git config user.email "arena-agent@users.noreply.github.com"
git add <archivos modificados>
git commit -m "tipo(area): descripción breve (vNNN)"
```

El commit debe contener únicamente los archivos de la tarea, más `game.js`, `index.html` y `assets.js` cuando corresponda.

## 7. Crear el bundle de una sola actualización

El commit debe estar basado en el último `origin/main`. Crear un bundle que contenga únicamente el nuevo commit:

```bash
BASE=$(git rev-parse HEAD^)
git bundle create cambio-vNNN.bundle HEAD ^$BASE
```

El bundle permite publicar sin entregar todo el repositorio y sin guardar credenciales.

## 8. Estructura exacta de entrega

Entregar un ZIP con una carpeta de este estilo:

```text
actualizacion-vNNN/
├── PUBLICAR.bat
├── cambio-vNNN.bundle
└── LEEME.txt
```

El ZIP debe llamarse de forma descriptiva, por ejemplo:

```text
actualizacion-facu-v144.zip
```

## 9. Plantilla obligatoria de `PUBLICAR.bat`

Sustituir `NNN`, el nombre del bundle y la descripción. Mantener las comprobaciones y el manejo de errores.

```bat
@echo off
setlocal
chcp 65001 >nul
title Publicar Oficina Virtual vNNN
color 0A
echo.
echo  ==============================================
echo    OFICINA VIRTUAL - PUBLICAR vNNN
 echo ==============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo No encuentro Git. Se abrira la pagina oficial para instalarlo.
  start https://git-scm.com/download/win
  echo Instalalo con las opciones normales y despues volve a abrir este archivo.
  pause
  exit /b 1
)

set "TMPDIR=%TEMP%\oficina-virtual-publicar-vNNN"
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"

echo [1/4] Descargando la oficina actual...
git clone https://github.com/Somospopups/Oficina-virtual.git "%TMPDIR%"
if errorlevel 1 goto :error

cd /d "%TMPDIR%"
echo [2/4] Aplicando la actualizacion...
git fetch "%~dp0cambio-vNNN.bundle" HEAD
if errorlevel 1 goto :error

git -c user.name="Arena Agent" -c user.email="arena-agent@users.noreply.github.com" cherry-pick FETCH_HEAD
if errorlevel 1 (
  git cherry-pick --abort >nul 2>nul
  echo.
  echo La oficina cambio desde que se preparo esta actualizacion.
  echo No se publico nada. Pedi a la IA que prepare una version nueva.
  pause
  exit /b 1
)

echo [3/4] Publicando en GitHub...
git push origin main
if errorlevel 1 goto :error

echo [4/4] Listo.
echo.
echo La version vNNN fue publicada correctamente.
echo GitHub Pages puede tardar uno o dos minutos en actualizarse.
rmdir /s /q "%TMPDIR%" >nul 2>nul
pause
exit /b 0

:error
echo.
echo No se pudo completar la publicacion. No se perdio ningun archivo.
echo Mostrale este mensaje a la IA para que lo resuelva.
pause
exit /b 1
```

## 10. Qué hace el propietario

La respuesta final debe ser simple:

1. Descargar el ZIP.
2. Extraerlo.
3. Hacer doble clic en `PUBLICAR.bat`.
4. Confirmar la cuenta si GitHub abre el navegador.
5. Esperar el mensaje de publicación correcta.

No pedirle que abra una terminal, ejecute comandos, edite código, cree commits o copie archivos dentro del repositorio.

## 11. Si el BAT encuentra un conflicto

- El BAT debe abortar el cherry-pick y no publicar nada.
- La IA debe volver a descargar `origin/main`, reaplicar la tarea, incrementar a una versión nueva si la anterior llegó a publicarse y generar otro ZIP.
- Nunca indicar al propietario que resuelva el conflicto manualmente.

## 12. Frase que el propietario puede usar con otra IA

> Revisá primero `AGENTE.md` y `PUBLICAR_CAMBIOS.md`. Hacé el cambio completo, ejecutá todos los chequeos y entregame un ZIP con `PUBLICAR.bat`; yo no voy a editar código ni ejecutar comandos manualmente.
