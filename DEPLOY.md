# Publicar Tuki gratis, con URL fija

Ningún host gratuito publica una app con servidor **sin crear una cuenta**. El túnel de
Cloudflare es el único camino sin cuenta, y depende de que la PC esté prendida.

La opción recomendada es **Hugging Face Spaces**: gratis, sin tarjeta, URL fija para siempre
y acepta Docker. Duerme el Space después de 48 h sin uso; la primera visita lo despierta en
unos segundos.

---

## Opción A · Hugging Face Spaces (recomendada)

URL final: `https://<tu-usuario>-tuki.hf.space`

### A.1 Con token (lo hago yo)

1. Crear cuenta en <https://huggingface.co/join> (email + contraseña, sin tarjeta).
2. Ir a <https://huggingface.co/settings/tokens> → **New token** → tipo **Write** → nombre `tuki`.
3. Copiar el token (`hf_...`) y pasarlo.

Con eso alcanza para correr:

```powershell
python tools/deploy_hf.py hf_xxxxxxxx
```

El script crea el Space (`<usuario>/tuki`), sube `server.js`, `public/`, el `Dockerfile` y el
`README.md`, espera el build y devuelve la URL. Cuando termine, el token se puede revocar.

### A.2 A mano (sin compartir token)

1. Correr `python tools/deploy_hf.py` → arma la carpeta **`deploy-hf/`**.
2. En <https://huggingface.co/new-space> → nombre `tuki` → SDK **Docker** → template **Blank** → público.
3. En la pestaña **Files** → *Add file* → *Upload files* → arrastrar **todo el contenido** de
   `deploy-hf/` (el `Dockerfile` y el `README.md` incluidos; la carpeta `public/` también).
4. Esperar el build. La app queda en `https://<usuario>-tuki.hf.space`.

> El `README.md` de esa carpeta ya trae el encabezado YAML que HF necesita (`sdk: docker`,
> `app_port: 8080`). Si lo pisás, el Space deja de arrancar.

### Límites del plan gratis

- 2 vCPU / 16 GB, se duerme a las 48 h sin visitas.
- **El disco es efímero**: al reiniciar se borran las salas en curso (`/data/db.json`).
  Alcanza para jugar; si querés persistencia real hace falta un plan pago o una base externa.
- El código del Space es público.

---

## Opción B · Render

URL: `https://tuki-xxxx.onrender.com`. Requiere cuenta de GitHub + Render (sin tarjeta).
Se duerme a los 15 min y tarda ~50 s en despertar.

1. Subir la carpeta `tuki/` a un repo de GitHub.
2. En <https://render.com> → **New → Blueprint** → elegir el repo. `render.yaml` hace el resto.

---

## Opción C · Túnel (sin cuenta, depende de tu PC)

```
Publicar Tuki (tunel).bat
```

Da una URL `https://algo.trycloudflare.com` que cambia en cada arranque y solo vive mientras
la PC esté prendida. Sirve para probar o para jugar un rato, no para dejarlo publicado.

Con un dominio propio en Cloudflare se puede dejar una URL fija:

```powershell
cloudflared tunnel login
cloudflared tunnel create tuki
cloudflared tunnel route dns tuki tuki.tudominio.com
cloudflared tunnel run --url http://localhost:4280 tuki
```

---

## Notas técnicas

- El server escucha en `$PORT` si existe (HF/Render lo inyectan); si no, en `4280`.
- Los datos van a `$TUKI_DATA` (por defecto `./data`; en Docker, `/data`).
- El QR y el link de cada sala se arman con el dominio desde el que se abrió la página, así que
  funcionan igual en local, por túnel o en el host que elijas.
- El contenedor corre como UID 1000 (requisito de HF). `/data` queda con permisos 777.
