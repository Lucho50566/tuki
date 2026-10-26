// Genera las capturas de Tuki: node tools/shots.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'shots');
const TMP = path.join(ROOT, '.shotjs');
const BASE = 'http://127.0.0.1:4280';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const api = async (method, url, body) => {
  const r = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(name, url, js, w = 390, h = 844) {
  const jsFile = path.join(TMP, name + '.js');
  writeFileSync(jsFile, js || '0');
  const file = path.join(OUT, name + '.png');
  await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(ROOT, '..', 'bin', 'shot.mjs'), url, file, 'file:' + jsFile, String(w), String(h)], { stdio: 'inherit' });
    p.on('exit', resolve);
  });
  console.log('  → ' + name + '.png');
}

const sess = (s) => JSON.stringify({ code: s.code, pid: s.pid, token: s.token });

(async () => {
  console.log('Preparando salas…');

  // Sala con historial
  const a = await api('POST', '/api/rooms', { name: 'Luciano', intensity: 'normal', handSize: 22 });
  const code = a.code;
  const b = await api('POST', `/api/rooms/${code}/join`, { name: 'Cami' });
  const A = { code, pid: a.playerId, token: a.token };
  const B = { code, pid: b.playerId, token: b.token };

  const stA0 = await api('GET', `/api/rooms/${code}?pid=${A.pid}&token=${A.token}`);
  // A juega 4 cartas
  for (let i = 0; i < 4; i++) {
    const st = await api('GET', `/api/rooms/${code}?pid=${A.pid}&token=${A.token}`);
    const cid = st.me.hand[0].id;
    await api('POST', `/api/rooms/${code}/play`, { ...A, cardId: cid });
    const stB = await api('GET', `/api/rooms/${code}?pid=${B.pid}&token=${B.token}`);
    const ev = stB.incoming[0];
    if (i < 3) {
      await api('POST', `/api/rooms/${code}/respond`, { ...B, eventId: ev.id, action: i === 2 ? 'wildcard' : 'done', note: 'hecho' });
      await sleep(60);
    }
  }
  // B juega una y A la cumple
  const stB2 = await api('GET', `/api/rooms/${code}?pid=${B.pid}&token=${B.token}`);
  await api('POST', `/api/rooms/${code}/play`, { ...B, cardId: stB2.me.hand[0].id });
  const stA2 = await api('GET', `/api/rooms/${code}?pid=${A.pid}&token=${A.token}`);
  await api('POST', `/api/rooms/${code}/respond`, { ...A, eventId: stA2.incoming[0].id, action: 'done' });
  // Deja una pendiente de A → B para la captura del desafío
  const stA3 = await api('GET', `/api/rooms/${code}?pid=${A.pid}&token=${A.token}`);
  await api('POST', `/api/rooms/${code}/play`, { ...A, cardId: stA3.me.hand[0].id });

  // Sala en lobby (solo A)
  const lobby = await api('POST', '/api/rooms', { name: 'Luciano', intensity: 'normal', handSize: 22 });
  const lobbyS = { code: lobby.code, pid: lobby.playerId, token: lobby.token };

  console.log('Capturando…');

  await shot('01-home', BASE + '/');

  await shot('02-sala', BASE + '/?sala=' + lobby.code, `
    (async () => {
      const s = ${sess(lobbyS)};
      sessionStorage.setItem('tuki.session', JSON.stringify({ ...s, name: 'Luciano' }));
      const st = await (await fetch('/api/rooms/' + s.code + '?pid=' + s.pid + '&token=' + s.token)).json();
      S.session = { ...s, name: 'Luciano' };
      S.state = st; S.sig = ''; render(); return st.status;
    })()
  `);

  await shot('03-mano', BASE + '/?sala=' + code, `
    (async () => {
      const s = ${sess(B)};
      sessionStorage.setItem('tuki.session', JSON.stringify({ ...s, name: 'Cami' }));
      const st = await (await fetch('/api/rooms/' + s.code + '?pid=' + s.pid + '&token=' + s.token)).json();
      S.session = { ...s, name: 'Cami' };
      S.state = st; S.sig = '';
      S.dismissed = new Set((st.incoming || []).map(e => e.id));
      S.seen = new Set((st.incoming || []).map(e => e.id));
      startStream(); render();
      return st.me.hand.length;
    })()
  `);

  await shot('04-desafio', BASE + '/?sala=' + code, `
    (async () => {
      const s = ${sess(B)};
      sessionStorage.setItem('tuki.session', JSON.stringify({ ...s, name: 'Cami' }));
      const st = await (await fetch('/api/rooms/' + s.code + '?pid=' + s.pid + '&token=' + s.token)).json();
      S.session = { ...s, name: 'Cami' };
      applyState(st, true);
      return st.incoming.length;
    })()
  `);

  await shot('05-recuerdos', BASE + '/?sala=' + code, `
    (async () => {
      const s = ${sess(B)};
      sessionStorage.setItem('tuki.session', JSON.stringify({ ...s, name: 'Cami' }));
      const st = await (await fetch('/api/rooms/' + s.code + '?pid=' + s.pid + '&token=' + s.token)).json();
      S.session = { ...s, name: 'Cami' };
      S.state = st; S.sig = ''; startStream(); render();
      setTimeout(() => document.querySelector('[data-act="memories"]').click(), 200);
      return st.memories.length;
    })()
  `);

  await shot('06-menu', BASE + '/?sala=' + code, `
    (async () => {
      const s = ${sess(B)};
      const st = await (await fetch('/api/rooms/' + s.code + '?pid=' + s.pid + '&token=' + s.token)).json();
      S.session = { ...s, name: 'Cami' };
      S.state = st; S.sig = ''; render();
      setTimeout(() => document.querySelector('[data-act="menu"]').click(), 200);
    })()
  `);

  rmSync(TMP, { recursive: true, force: true });
  console.log('\nListo.');
})();
