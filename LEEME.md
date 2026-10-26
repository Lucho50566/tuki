# TUKI · el juego de cartas para dos

Versión digital del juego de pareja de **Kora**: cada uno tiene su mazo de desafíos y
**3 comodines**, no hay turnos ni ganador. Se juega cuando quieras, desde el teléfono.

> Las mecánicas están replicadas. **Los textos de las cartas son propios** (112 desafíos
> originales en español rioplatense), no una copia del mazo físico. Si querés usar el texto
> del mazo que compraste, se puede pegar completo desde *Mi mazo → Pegar varias*.

```
Iniciar Tuki.bat              →  http://localhost:4280  (en tu red)
Publicar Tuki (tunel).bat     →  URL pública https, para jugar desde cualquier lado
```

Sin dependencias: solo Node.js. No hace falta `npm install`.

---

## Cómo se juega

1. Uno **crea la sala** → le sale un código de 4 letras (ej. `T6LM`) y un QR/link.
2. La otra persona **entra con el código** (o abre el link) desde su teléfono.
3. Cada uno recibe **22 cartas** y **3 comodines** (se puede elegir 10 / 22 / 30).
4. Cuando quieras, **tocás una carta** y la jugás sobre tu pareja: le llega al instante,
   con vibración y sonido.
5. Del otro lado puede:
   - **Lo hago** → queda guardado en *La mesa*.
   - **Comodín** → se cancela el desafío, gasta uno de sus 3 (no vuelven).
6. No hay turnos: cualquiera puede jugar en cualquier momento. Tampoco hay ganador.

## Modos (intensidad del mazo)

| Modo | Qué entra | Para quién |
|---|---|---|
| **Suave** | tiernas y divertidas (nivel 1) | arrancar tranquilos |
| **Normal** | hasta nivel 2 (como el mazo clásico) | el día a día |
| **Picante** | todo lo atrevido (nivel 3) | subir la temperatura |
| **Hot 18+** | solo atrevidas + explícitas (nivel 3 y 4) | **adultos** |

El modo **Hot 18+** pide una confirmación antes de crear la sala (contenido sexual explícito,
para mayores). La sala queda marcada con el badge `18+` y el comodín sigue valiendo: nadie está
obligado a nada.

## Lo que se ve en las dos pantallas

- **El tablero**: arriba, los dos jugadores con sus cartas en mano y sus comodines.
- **Cada jugada aparece en las dos**: el que juega ve la carta grande con “esperando que
  responda…”, y cuando el otro contesta esa misma pantalla cambia a **“lo hizo”** o
  **“usó un comodín”**, con sonido y vibración.
- **La mesa**: historial compartido de todo (en juego, cumplidas y esquivadas), con fecha y
  quién se la jugó a quién.

## Tu propio mazo

Menú → **Agregar mi propio desafío**. Podés escribir una carta o **pegar hasta 60 de una**
(una por línea): entran a tu mano y al mazo de esa sala. Sirve para cargar el mazo físico
completo si lo tenés.

## Probar solo

En la pantalla de espera hay un botón **“Probar con un invitado automático”**: agrega un
jugador de prueba que te juega una carta a los segundos y acepta las que le mandás.
Sirve para ver todo el circuito sin necesidad de una segunda persona.

## Instalar en el teléfono (PWA)

Es una PWA: se puede agregar a la pantalla de inicio. Requiere **HTTPS** (o `localhost`),
así que por `http://192.168.x.x` el navegador no va a ofrecer instalarla.

```powershell
# levanta server + túnel y te imprime la URL pública
Publicar Tuki (tunel).bat
```

Con la URL `https://…` que devuelve, se abre desde el teléfono y se elige
“Agregar a pantalla de inicio”. El mismo túnel sirve para jugar a distancia.

Para una URL fija y host gratis 24/7, con las limitaciones de cada opción: **`DEPLOY.md`**.
La recomendada es **Hugging Face Spaces**: `python tools/deploy_hf.py <token>` crea el Space,
sube todo y devuelve la URL.

## Estructura

```
tuki/
  server.js              HTTP + API JSON + SSE + persistencia (data/db.json)
  public/
    index.html           shell
    styles.css           estilos (mobile-first, dark + dorado)
    app.js               cliente: vistas, SSE, overlays, sonido/vibración
    deck.js              mazo de 112 cartas + categorías + niveles
    qrcode.js            generador de QR local (sin CDN)
    sw.js                service worker (cachea el shell, nunca /api)
    manifest.webmanifest icon-192.png · icon-512.png · icon-maskable-512.png
  tools/
    test-api.js          72 tests de API
    test-ui.mjs          24 tests de UI real (2 navegadores, CDP)
    shots.mjs            capturas a shots/
    make_icons.py        regenera los iconos
    deploy_hf.py         publica en Hugging Face Spaces (arma deploy-hf/)
  data/db.json           salas y eventos
  deploy-hf/             carpeta lista para subir a un Space (la regenera el script)
  Dockerfile             para Render / Hugging Face / cualquier host con Docker
  render.yaml            blueprint de Render
  DEPLOY.md              cómo publicarlo gratis
```

### API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | estado |
| GET | `/api/meta` | URL de red, categorías, niveles, total de cartas |
| POST | `/api/rooms` | crear sala `{name, intensity, handSize, adult?}` |
| POST | `/api/rooms/:code/join` | entrar `{name}` |
| GET | `/api/rooms/:code?pid&token` | estado completo del jugador |
| GET | `/api/rooms/:code/events?pid&token` | SSE en vivo |
| POST | `/api/rooms/:code/play` | jugar `{pid, token, cardId}` |
| POST | `/api/rooms/:code/respond` | responder `{eventId, action: done\|wildcard, note?}` |
| POST | `/api/rooms/:code/card` | agregar una carta `{text, cat}` |
| POST | `/api/rooms/:code/cards` | importar varias `{texts: [...], cat}` |
| POST | `/api/rooms/:code/redeal` | nueva partida |
| POST | `/api/rooms/:code/bot` | invitado automático (solo prueba) |
| POST | `/api/rooms/:code/leave` | salir |

El estado incluye `feed` (la mesa compartida), `incoming`, `outgoing`, `memories`, los comodines
de cada uno y las cartas en mano del rival (solo el número).

La sesión se guarda en `sessionStorage` (por pestaña) y `localStorage` (persistente),
así que al recargar seguís en la partida.

## Tests

```
node tools/test-api.js     # 72 ok
node tools/test-ui.mjs     # 24 ok  (necesita el server corriendo en 4280)
```

El test de UI abre **dos navegadores headless separados** para simular los dos teléfonos:
crea la sala, entra con el link, juega una carta, verifica que llegue con el texto correcto,
la acepta, revisa la mesa y gasta un comodín.

## Capturas

`shots/01-home.png` · `02-sala.png` · `03-mano.png` · `04-desafio.png` ·
`05-recuerdos.png` · `06-menu.png` · `08-modo18.png`

```powershell
node tools/shots.mjs     # regenera todas
```

## Notas técnicas

- Realtime por **SSE** (no WebSocket): cada jugador tiene su stream y recibe su propio estado.
- Persistencia en `data/db.json` con escritura atómica (tmp + rename) y debounce de 250 ms.
  Las salas sin actividad se limpian a los 45 días.
- Fechas en hora local, no UTC.
- El sonido es sintetizado con WebAudio (no hay archivos de audio).
- `data/db.json` no se debe editar con el servidor corriendo: lo pisa el próximo guardado.
- El server escucha en `$PORT` si existe, si no en `4280`. Los datos van a `$TUKI_DATA`.

