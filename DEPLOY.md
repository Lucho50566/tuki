# Publicar Tuki gratis

## Lo que probamos (26/10/2026)

- **Hugging Face Spaces**: los Spaces con Docker ya **no son gratis**. La API devuelve
  `402 Payment Required` → *“hosting Gradio and Docker Spaces on free cpu-basic requires a PRO
  subscription”*. Descartado (a menos que se pague PRO).
- **Render**: sigue teniendo plan **free** para servicios Node, sin tarjeta. Se duerme a los
  15 minutos sin visitas y despierta en ~50 s. **Es el camino recomendado.**
- **Túnel de Cloudflare**: gratis y sin cuenta, pero la URL cambia y depende de que la PC esté prendida.

## Opción A · Render (recomendada)

El repo ya está publicado: <https://github.com/Lucho50566/tuki>

1. Abrir <https://render.com/deploy?repo=https://github.com/Lucho50566/tuki>
2. Entrar con **GitHub** (un clic) y autorizar el repo.
3. **Apply / Deploy**. Render lee `render.yaml` y crea el servicio solo.

Queda en `https://tuki-xxxx.onrender.com` (el nombre lo asigna Render).

- Plan free: 512 MB, se duerme a los 15 min, despierta en ~50 s.
- El disco es efímero: al reiniciar se pierden las salas en curso (no los archivos).
- Si querés que no se duerma, el plan pago más barato (~US$7/mes) lo mantiene despierto.

## Opción B · Sin cuenta (túnel)

```
Publicar Tuki (tunel).bat
```

Da una URL `https://algo.trycloudflare.com` que cambia en cada arranque y solo vive mientras
la PC esté prendida. Sirve para probar o jugar un rato, no para dejarlo publicado.

Con un dominio propio en Cloudflare se puede dejar una URL fija:

```powershell
cloudflared tunnel login
cloudflared tunnel create tuki
cloudflared tunnel route dns tuki tuki.tudominio.com
cloudflared tunnel run --url http://localhost:4280 tuki
```

## Opción C · Otras

- **Koyeb** free: un servicio, también se duerme; se conecta al mismo repo de GitHub.
- **Cloudflare Workers**: gratis y siempre despierto, pero hay que reescribir el server
  (no existe `fs`; la persistencia iría a KV/Durable Objects).
- **VPS propio**: `node server.js` + Caddy/Nginx como proxy. Es lo más estable si ya tenés uno.

## Notas técnicas

- El server escucha en `$PORT` si existe (Render lo inyecta); si no, en `4280`.
- Los datos van a `$TUKI_DATA` (por defecto `./data`).
- El QR y el link de cada sala se arman con el dominio desde el que se abrió la página, así que
  funcionan igual en local, por túnel o en Render.
