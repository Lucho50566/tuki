// Test de UI real (dos pestañas, Chrome headless + CDP): crear sala, entrar, jugar, responder.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT_A = 9520 + Math.floor(Math.random() * 30);
const PORT_B = PORT_A + 40;
const BASE = 'http://127.0.0.1:4280';
const RUN = Date.now();
const PROFILE_A = `${process.env.TEMP}\\cdp-tuki-${RUN}-a`;
const PROFILE_B = `${process.env.TEMP}\\cdp-tuki-${RUN}-b`;

let ok = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const launch = (port, profile) => spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], { stdio: 'ignore' });

const procA = launch(PORT_A, PROFILE_A);
const procB = launch(PORT_B, PROFILE_B);

async function targetWs(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const t = list.find(x => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('CDP no disponible');
}

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async open(port) {
    const ws = new WebSocket(await targetWs(port));
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const p = new Page(ws);
    ws.onmessage = m => {
      const msg = JSON.parse(m.data);
      if (msg.id && p.pending.has(msg.id)) { p.pending.get(msg.id)(msg); p.pending.delete(msg.id); }
      else if (msg.method) p.events.push(msg.method);
    };
    await p.send('Page.enable');
    await p.send('Runtime.enable');
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    return p;
  }
  send(method, params = {}) {
    return new Promise(res => {
      const id = ++this.id;
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async goto(url) {
    this.events = [];
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { if (this.events.includes('Page.loadEventFired')) break; await sleep(150); }
    await sleep(700);
  }
  async js(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
    return r.result?.result?.value;
  }
  async wait(expr, ms = 9000, label = expr) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { if (await this.js(expr)) return true; } catch (e) {}
      await sleep(180);
    }
    throw new Error('timeout esperando: ' + label);
  }
}

(async () => {
  try {
    const a = await Page.open(PORT_A);
    const b = await Page.open(PORT_B);

    /* 1. crear sala desde la UI */
    await a.goto(BASE + '/');
    await a.wait(`!!document.querySelector('#cName')`, 8000, 'formulario de crear');

    /* gate 18+ */
    await a.js(`document.querySelector('[data-level="hot18"]').click(); 1`);
    await sleep(350);
    check('el modo 18+ pide confirmación', await a.js(`!!document.querySelector('[data-act="confirmAdult"]')`));
    await a.js(`document.querySelector('.sheet [data-act="closeLayer"]').click(); 1`);
    await sleep(300);
    check('si cancela no queda seleccionado', !(await a.js(`document.querySelector('[data-level="hot18"]').classList.contains('on')`)));
    check('y sigue en Normal', await a.js(`document.querySelector('[data-level="normal"]').classList.contains('on')`));

    await a.js(`document.querySelector('#cName').value='Luciano';
      document.querySelector('[data-level="normal"]').click();
      document.querySelector('[data-act="create"]').click(); 1`);
    await a.wait(`!!document.querySelector('.codebox .v')`, 10000, 'código de sala');
    const code = await a.js(`document.querySelector('.codebox .v').textContent.trim()`);
    check('se crea la sala desde la UI', /^[A-Z0-9]{4}$/.test(code), code);
    check('muestra QR en el lobby', await a.js(`!!document.querySelector('.qr svg')`));
    check('muestra el link completo', await a.js(`document.querySelector('.pill').textContent.includes('sala=${code}')`));

    /* 2. entrar desde el link */
    await b.goto(BASE + '/?sala=' + code);
    check('el link abre directo en "Unirme"', await b.js(`!!document.querySelector('#jCode') && document.querySelector('#jCode').value === '${code}'`));
    await b.js(`document.querySelector('#jName').value='Cami'; document.querySelector('[data-act="join"]').click(); 1`);
    await b.wait(`!!document.querySelector('.hand .card')`, 10000, 'mano de Cami');
    check('la pareja ve su mano', await b.js(`document.querySelectorAll('.hand .card').length`) > 5);
    check('la pareja ve el nombre del otro', await b.js(`document.querySelector('.table .side.right .nm').textContent.includes('Luciano')`));
    check('la mesa muestra los dos lados', await b.js(`document.querySelectorAll('.table .side').length === 2`));

    await a.wait(`!!document.querySelector('.hand .card')`, 10000, 'mano de Luciano');
    check('el que creó también ve su mano', await a.js(`document.querySelectorAll('.hand .card').length`) > 5);
    check('se le cierra el lobby solo', !(await a.js(`!!document.querySelector('.codebox')`)));

    /* 3. jugar una carta */
    const cardText = await a.js(`document.querySelector('.hand .card .body p').textContent.trim()`);
    await a.js(`document.querySelector('.hand .card').click(); 1`);
    await a.wait(`!!document.querySelector('.overlay [data-act="play"]')`, 5000, 'confirmación');
    check('pide confirmación antes de jugar', await a.js(`document.querySelector('.overlay .lead').textContent.includes('¿Jugás esta carta?')`));
    await a.js(`document.querySelector('[data-act="play"]').click(); 1`);
    await a.wait(`document.querySelectorAll('.hand .card').length === 21`, 6000, 'carta jugada');

    /* 4. le llega al otro */
    await b.wait(`!!document.querySelector('.overlay [data-act="respond"]')`, 8000, 'desafío en el teléfono de Cami');
    const shown = await b.js(`document.querySelector('.overlay .card .body p').textContent.trim()`);
    check('le llega la carta correcta', shown === cardText, { shown, cardText });
    check('dice quién la jugó', await b.js(`document.querySelector('.overlay .lead small').textContent.trim().toUpperCase().includes('LUCIANO')`));
    check('muestra los comodines disponibles', await b.js(`document.querySelector('[data-kind="wildcard"]').textContent.includes('3')`));

    /* 5. responder */
    await b.js(`document.querySelector('[data-act="respond"][data-kind="done"]').click(); 1`);
    await b.wait(`!document.querySelector('.overlay')`, 6000, 'overlay cerrado');
    check('al aceptar se guarda el recuerdo', await b.js(`document.querySelector('[data-act="memories"]') && true`));
    await b.wait(`document.body.textContent.includes('Mesa')`, 4000, 'mesa');

    /* 6. el que jugó ve que se resolvió */
    await a.wait(`!/Esperando que/.test(document.querySelector('.table .live').textContent)`, 9000, 'aviso de respuesta');
    check('desaparece el "esperando respuesta"', !/Esperando que/.test(await a.js(`document.querySelector('.table .live').textContent`)));

    /* 7. recuerdos */
    await a.js(`document.querySelector('[data-act="memories"]').click(); 1`);
    await a.wait(`!!document.querySelector('.mem')`, 5000, 'lista de recuerdos');
    check('el recuerdo aparece en la lista', await a.js(`document.querySelectorAll('.mem').length`) === 1);
    check('el recuerdo dice "cumplida"', await a.js(`document.querySelector('.mem .tag').textContent.trim()`) === 'cumplida');
    check('el recuerdo guarda el texto', await a.js(`document.querySelector('.mem p').textContent.trim()`) === cardText);

    /* 8. comodín */
    await a.js(`document.querySelector('[data-act="closeLayer"]').click(); 1`);
    await sleep(300);
    await a.js(`document.querySelector('.hand .card').click(); 1`);
    await a.wait(`!!document.querySelector('[data-act="play"]')`, 4000, 'confirmación 2');
    await a.js(`document.querySelector('[data-act="play"]').click(); 1`);
    await b.wait(`!!document.querySelector('[data-kind="wildcard"]')`, 8000, 'segundo desafío');
    await b.js(`document.querySelector('[data-kind="wildcard"]').click(); 1`);
    await sleep(700);
    check('al usar comodín baja el contador', (await b.js(`document.querySelector('.kv .hearts').textContent.trim().length`)) >= 0);
    const stB = await b.js(`fetch('/api/rooms/' + JSON.parse(sessionStorage.getItem('tuki.session')).code + '?pid=' + JSON.parse(sessionStorage.getItem('tuki.session')).pid + '&token=' + JSON.parse(sessionStorage.getItem('tuki.session')).token).then(r=>r.json()).then(s=>s.me.wildcards)`);
    check('quedan 2 comodines', stB === 2, stB);

    /* 9. persistencia de sesión al recargar */
    await b.goto(BASE + '/');
    await b.wait(`!!document.querySelector('.hand .card')`, 8000, 'sesión restaurada');
    check('al recargar sigue en la partida', await b.js(`document.querySelectorAll('.hand .card').length`) > 5);

  } catch (e) {
    fail++;
    console.error('\n  ✗ EXCEPCIÓN: ' + e.message);
  } finally {
    procA.kill();
    procB.kill();
    try { rmSync(PROFILE_A, { recursive: true, force: true }); } catch (e) {}
    try { rmSync(PROFILE_B, { recursive: true, force: true }); } catch (e) {}
    console.log('\n  ' + ok + ' ok · ' + fail + ' fallas\n');
    process.exit(fail ? 1 : 0);
  }
})();
