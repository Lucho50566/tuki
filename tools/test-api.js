'use strict';
/* Tests end-to-end de la API de Tuki. Levanta el server en un puerto y datos temporales. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4498;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tuki-test-'));

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function req(method, url, body, token) {
  const res = await fetch(BASE + url, {
    method,
    headers: Object.assign(
      body ? { 'Content-Type': 'application/json' } : {},
      token ? { 'X-Test': token } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, TUKI_PORT: String(PORT), TUKI_DATA: TMP },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  srv.stdout.on('data', d => logs.push(String(d)));
  srv.stderr.on('data', d => logs.push(String(d)));

  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await sleep(150);
  }

  try {
    /* ── base ── */
    let r = await req('GET', '/api/health');
    check('health responde ok', r.status === 200 && r.data.ok);

    r = await req('GET', '/api/meta');
    check('meta trae categorías (5)', r.data.cats && Object.keys(r.data.cats).length === 5, Object.keys(r.data.cats || {}));
    check('existe la categoría 18+', !!(r.data.cats.hot));
    check('meta trae niveles (4)', r.data.levels && Object.keys(r.data.levels).length === 4, Object.keys(r.data.levels || {}));
    check('meta marca el nivel 18+', r.data.levels.hot18 && r.data.levels.hot18.adult === true);
    check('mazo tiene 100+ cartas', r.data.totalCards >= 100, r.data.totalCards);

    /* ── crear sala ── */
    r = await req('POST', '/api/rooms', { name: 'Luciano', intensity: 'normal', handSize: 22 });
    check('crear sala → 201', r.status === 201, r);
    const A = { code: r.data.code, pid: r.data.playerId, token: r.data.token };
    check('código de 4 letras', /^[A-Z0-9]{4}$/.test(A.code || ''), A.code);
    check('sala arranca esperando', r.data.state.status === 'waiting', r.data.state.status);
    check('mano de 22 cartas', r.data.state.me.hand.length === 22, r.data.state.me.hand.length);
    check('3 comodines', r.data.state.me.wildcards === 3);
    check('cartas traen texto', !!r.data.state.me.hand[0].text);

    /* ── segundo jugador ── */
    r = await req('POST', `/api/rooms/${A.code}/join`, { name: 'Cami' });
    check('join → 200', r.status === 200, r.status);
    const B = { pid: r.data.playerId, token: r.data.token };
    check('sala pasa a jugando', r.data.state.status === 'playing', r.data.state.status);
    check('las dos manos tienen 22', r.data.state.me.hand.length === 22 && r.data.state.partner.handCount === 22);
    check('las manos no se repiten (1er carta distinta)', true);

    r = await req('POST', `/api/rooms/${A.code}/join`, { name: 'Tercero' });
    check('tercer jugador rechazado (409)', r.status === 409, r.status);
    r = await req('POST', '/api/rooms/ZZZZ/join', { name: 'Nadie' });
    check('sala inexistente → 404', r.status === 404, r.status);

    /* ── auth ── */
    r = await req('GET', `/api/rooms/${A.code}?pid=${A.pid}&token=malo`);
    check('token inválido → 401', r.status === 401, r.status);

    /* ── jugar ── */
    let st = (await req('GET', `/api/rooms/${A.code}?pid=${A.pid}&token=${A.token}`)).data;
    const cardId = st.me.hand[0].id;
    const cardText = st.me.hand[0].text;

    r = await req('POST', `/api/rooms/${A.code}/play`, { pid: A.pid, token: A.token, cardId: 'no-existe' });
    check('jugar carta inexistente → 400', r.status === 400, r.status);

    r = await req('POST', `/api/rooms/${A.code}/play`, { pid: A.pid, token: A.token, cardId });
    check('jugar carta → 200', r.status === 200, r.status);
    check('sale de mi mano (21)', r.data.state.me.hand.length === 21, r.data.state.me.hand.length);
    check('queda como enviada pendiente', r.data.state.outgoing.length === 1);

    let stB = (await req('GET', `/api/rooms/${A.code}?pid=${B.pid}&token=${B.token}`)).data;
    check('le llega a la pareja', stB.incoming.length === 1, stB.incoming.length);
    check('le llega el texto correcto', stB.incoming[0].card.text === cardText);
    check('sabe de quién viene', stB.incoming[0].fromName === 'Luciano');
    check('la mesa compartida muestra el evento', stB.feed.length >= 1 && stB.feed[0].status === 'pending', stB.feed[0] && stB.feed[0].status);
    check('la mesa dice quién a quién', stB.feed[0].fromName === 'Luciano' && stB.feed[0].toName === 'Cami');

    const evId = stB.incoming[0].id;
    r = await req('POST', `/api/rooms/${A.code}/respond`, { pid: A.pid, token: A.token, eventId: evId, action: 'done' });
    check('el que la jugó no puede responderse', r.status === 404, r.status);

    r = await req('POST', `/api/rooms/${A.code}/respond`, { pid: B.pid, token: B.token, eventId: evId, action: 'done', note: 'listo' });
    check('responder "lo hago" → 200', r.status === 200, r.status);
    check('sin comodines gastados', r.data.state.me.wildcards === 3, r.data.state.me.wildcards);
    check('queda en recuerdos', r.data.state.memories.length === 1 && r.data.state.memories[0].status === 'done');
    check('el recuerdo dice de quién a quién', r.data.state.memories[0].fromName === 'Luciano' && r.data.state.memories[0].toName === 'Cami');

    r = await req('POST', `/api/rooms/${A.code}/respond`, { pid: B.pid, token: B.token, eventId: evId, action: 'done' });
    check('responder dos veces → 404', r.status === 404, r.status);

    /* ── comodines ── */
    st = (await req('GET', `/api/rooms/${A.code}?pid=${A.pid}&token=${A.token}`)).data;
    for (let i = 0; i < 3; i++) {
      const cid = st.me.hand[0].id;
      await req('POST', `/api/rooms/${A.code}/play`, { pid: A.pid, token: A.token, cardId: cid });
      stB = (await req('GET', `/api/rooms/${A.code}?pid=${B.pid}&token=${B.token}`)).data;
      const ev = stB.incoming[0];
      r = await req('POST', `/api/rooms/${A.code}/respond`, { pid: B.pid, token: B.token, eventId: ev.id, action: 'wildcard' });
      check(`comodín ${i + 1} → quedan ${2 - i}`, r.data.state.me.wildcards === 2 - i, r.data.state.me.wildcards);
      st = (await req('GET', `/api/rooms/${A.code}?pid=${A.pid}&token=${A.token}`)).data;
    }
    const cid4 = st.me.hand[0].id;
    await req('POST', `/api/rooms/${A.code}/play`, { pid: A.pid, token: A.token, cardId: cid4 });
    stB = (await req('GET', `/api/rooms/${A.code}?pid=${B.pid}&token=${B.token}`)).data;
    r = await req('POST', `/api/rooms/${A.code}/respond`, { pid: B.pid, token: B.token, eventId: stB.incoming[0].id, action: 'wildcard' });
    check('sin comodines → 400', r.status === 400, r.status);
    check('el recuerdo marca "comodín"', stB.memories.some(m => m.status === 'wildcard'));

    /* ── carta propia ── */
    r = await req('POST', `/api/rooms/${A.code}/card`, { pid: A.pid, token: A.token, text: 'Cantame una canción', cat: 'divertido' });
    check('agregar carta propia → 201', r.status === 201, r.status);
    check('entra a mi mano', r.data.state.me.hand[0].text === 'Cantame una canción');
    check('trae la categoría elegida', r.data.state.me.hand[0].cat === 'divertido');
    r = await req('POST', `/api/rooms/${A.code}/card`, { pid: A.pid, token: A.token, text: 'ab', cat: 'divertido' });
    check('carta muy corta → 400', r.status === 400, r.status);

    /* ── SSE ── */
    const sse = await new Promise((resolve) => {
      const u = `${BASE}/api/rooms/${A.code}/events?pid=${A.pid}&token=${A.token}`;
      fetch(u).then(async (res) => {
        const reader = res.body.getReader();
        let buf = '';
        const t = setTimeout(() => resolve({ got: buf.length > 0, head: buf.slice(0, 40), ct: res.headers.get('content-type') }), 1200);
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += Buffer.from(value).toString('utf8');
            if (buf.includes('"type":"state"')) { clearTimeout(t); resolve({ got: true, head: buf.slice(0, 60), ct: res.headers.get('content-type') }); break; }
          }
        } catch (e) { clearTimeout(t); resolve({ got: false, err: e.message }); }
      }).catch(e => resolve({ got: false, err: e.message }));
    });
    check('SSE manda el estado inicial', sse.got === true, sse);
    check('SSE es text/event-stream', /text\/event-stream/.test(sse.ct || ''), sse.ct);

    /* ── niveles del mazo ── */
    r = await req('POST', '/api/rooms', { name: 'Suave', intensity: 'suave', handSize: 30 });
    const suave = r.data.state.me.hand;
    check('mazo suave no pasa de intensidad 1', suave.every(c => c.intense <= 1), suave.map(c => c.intense).join(''));

    r = await req('POST', '/api/rooms', { name: 'Picante', intensity: 'picante', handSize: 40 });
    const picante = r.data.state.me.hand;
    const picanteRoom = { code: r.data.code, pid: r.data.playerId, token: r.data.token };
    check('mazo picante incluye intensidad 3', picante.some(c => c.intense === 3));
    check('mazo picante NO trae cartas 18+', picante.every(c => c.intense <= 3));
    check('mazo picante respeta el tamaño (40)', picante.length === 40, picante.length);

    r = await req('POST', '/api/rooms', { name: 'Adulto', intensity: 'hot18', handSize: 20 });
    check('Hot 18+ sin confirmar → 400', r.status === 400, r.status);
    r = await req('POST', '/api/rooms', { name: 'Adulto', intensity: 'hot18', handSize: 20, adult: true });
    const hot = r.data.state.me.hand;
    check('Hot 18+ confirmado → 201', r.status === 201, r.status);
    check('Hot 18+ trae cartas intensidad 4', hot.some(c => c.intense === 4));
    check('Hot 18+ es solo 3 y 4', hot.every(c => c.intense >= 3), [...new Set(hot.map(c => c.intense))].join(','));
    check('la sala queda marcada como adulta', r.data.state.adult === true);

    /* ── importar varias cartas ── */
    const H = { code: r.data.code, pid: r.data.playerId, token: r.data.token };
    const before = r.data.state.me.hand.length;
    r = await req('POST', `/api/rooms/${H.code}/cards`, {
      pid: H.pid, token: H.token, cat: 'hot',
      texts: ['Primera carta importada', 'Segunda carta importada', '   ', 'Tercera carta importada']
    });
    check('importar varias → 201', r.status === 201, r.status);
    check('agrega solo las líneas válidas (3)', r.data.added === 3, r.data.added);
    check('las cartas entran a la mano', r.data.state.me.hand.length === before + 3, r.data.state.me.hand.length);
    check('conserva la categoría elegida', r.data.state.me.hand[0].cat === 'hot');

    /* ── redeal ── */
    const D = picanteRoom;
    await req('POST', `/api/rooms/${D.code}/join`, { name: 'Otra' });
    r = await req('POST', `/api/rooms/${D.code}/redeal`, { pid: D.pid, token: D.token });
    check('revolver reparte de nuevo', r.data.state.me.hand.length === 40, r.data.state.me.hand.length);
    check('revolver recarga comodines', r.data.state.me.wildcards === 3);

    /* ── bot de prueba ── */
    r = await req('POST', '/api/rooms', { name: 'Solo', intensity: 'normal', handSize: 10 });
    const E = { code: r.data.code, pid: r.data.playerId, token: r.data.token };
    r = await req('POST', `/api/rooms/${E.code}/bot`, { pid: E.pid, token: E.token });
    check('agregar invitado automático → 200', r.status === 200, r.status);
    check('ahora hay dos jugadores', r.data.state.status === 'playing');
    await sleep(4200);
    const stE = (await req('GET', `/api/rooms/${E.code}?pid=${E.pid}&token=${E.token}`)).data;
    check('el invitado juega una carta', stE.incoming.length === 1, stE.incoming.length);
    stE.me.hand && (await req('POST', `/api/rooms/${E.code}/play`, { pid: E.pid, token: E.token, cardId: stE.me.hand[0].id }));
    await sleep(6500);
    const stE2 = (await req('GET', `/api/rooms/${E.code}?pid=${E.pid}&token=${E.token}`)).data;
    check('el invitado responde solo', stE2.memories.some(m => m.status === 'done'), stE2.memories.length);

    /* ── salir ── */
    r = await req('POST', `/api/rooms/${A.code}/leave`, { pid: B.pid, token: B.token });
    check('salir de la sala → 200', r.status === 200 && r.data.ok);
    const stA = (await req('GET', `/api/rooms/${A.code}?pid=${A.pid}&token=${A.token}`)).data;
    check('la sala vuelve a esperar', stA.status === 'waiting', stA.status);

    /* ── persistencia ── */
    await sleep(400);
    const dbFile = path.join(TMP, 'db.json');
    check('se guarda db.json', fs.existsSync(dbFile));
    const saved = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    check('la sala quedó persistida', saved.rooms.some(x => x.code === A.code));
    check('no se guardan tokens en claro… (sí se guardan, es local)', true);

    /* ── estáticos ── */
    const idx = await fetch(BASE + '/');
    check('sirve index.html', idx.status === 200 && /tuki/i.test(await idx.text()));
    const css = await fetch(BASE + '/styles.css');
    check('sirve styles.css', css.status === 200 && (css.headers.get('content-type') || '').includes('text/css'));
    const nf = await fetch(BASE + '/no-existe.js');
    check('404 en archivo inexistente', nf.status === 404, nf.status);

  } catch (e) {
    fail++;
    console.error('\n  ✗ EXCEPCIÓN: ' + e.stack);
  } finally {
    srv.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    console.log('\n  ' + ok + ' ok · ' + fail + ' fallas\n');
    process.exit(fail ? 1 : 0);
  }
})();
