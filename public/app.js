'use strict';
/* ============================================================
   TUKI — cliente
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const layer = $('#layer');
const SS = 'tuki.session';        // por pestaña
const LS = 'tuki.session.last';   // persistente

let META = { url: location.origin, cats: {}, levels: {}, totalCards: 75 };

const S = {
  meta: null,
  session: null,
  state: null,
  sig: '',
  es: null,
  seen: new Set(),
  dismissed: new Set(),
  handScroll: 0,
  homeTab: 'create',
  codeParam: ''
};

/* ── utilidades ─────────────────────────────────────────── */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Error ' + res.status));
  return data;
}

function saveSession(s) {
  S.session = s;
  try { sessionStorage.setItem(SS, JSON.stringify(s)); } catch (e) {}
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {}
}
function loadSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(store === sessionStorage ? SS : LS);
      if (raw) { const s = JSON.parse(raw); if (s && s.code && s.token) return s; }
    } catch (e) {}
  }
  return null;
}
function clearSession() {
  S.session = null;
  try { sessionStorage.removeItem(SS); localStorage.removeItem(LS); } catch (e) {}
  if (S.es) { S.es.close(); S.es = null; }
}

/* ── sonido y vibración ─────────────────────────────────── */
let AC = null;
function audio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function chime() {
  const ctx = audio(); if (!ctx) return;
  const t0 = ctx.currentTime;
  [784, 1046.5, 1318.5].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = t0 + i * 0.085;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.6);
  });
}
function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern || [70, 50, 90]); } catch (e) {}
}

/* ── QR ─────────────────────────────────────────────────── */
function qrSvg(text) {
  try {
    const len = String(text).length;
    const type = len <= 25 ? 3 : len <= 47 ? 4 : len <= 77 ? 5 : len <= 114 ? 6 : 8;
    const q = qrcode(type, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2 });
  } catch (e) {
    console.warn('qr falló', e);
    return '';
  }
}
function shareLink() {
  if (!S.state) return META.url;
  const host = location.hostname;
  const esLan = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const base = esLan ? META.url : location.origin;
  return base.replace(/\/$/, '') + '/?sala=' + S.state.code;
}

/* ── tarjetas ───────────────────────────────────────────── */
function cardHTML(card, opts = {}) {
  const cat = (DECK.cats[card.cat] || DECK.cats.complice);
  const stars = [1, 2, 3].map(i => `<i class="${i <= card.intense ? 'on' : ''}"></i>`).join('');
  const num = opts.num ? String(opts.num).padStart(2, '0') : '';
  return `
    <div class="card ${esc(card.cat)} ${opts.mini ? 'mini' : ''}">
      <div class="top"><span class="cat">${esc(cat.label)}</span><span class="num">${num}</span></div>
      <div class="body"><p>${esc(card.text)}</p></div>
      <div class="foot"><span class="mk">tuki</span><span class="stars">${stars}</span></div>
    </div>`;
}
function cardButton(card, i) {
  return `<button class="card ${esc(card.cat)}" data-act="pick" data-id="${esc(card.id)}" aria-label="Jugar carta ${i + 1}">
      <div class="top"><span class="cat">${esc((DECK.cats[card.cat] || {}).label || '')}</span><span class="num">${String(i + 1).padStart(2, '0')}</span></div>
      <div class="body"><p>${esc(card.text)}</p></div>
      <div class="foot"><span class="mk">tuki</span><span class="stars">${[1, 2, 3].map(n => `<i class="${n <= card.intense ? 'on' : ''}"></i>`).join('')}</span></div>
    </button>`;
}

/* ── inicio ─────────────────────────────────────────────── */
function renderHome() {
  const isCreate = S.homeTab === 'create';
  const levels = Object.entries(META.levels || {});
  app.innerHTML = `
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">para dos</div>
      <div class="wordmark">tuki</div>
      <div class="rule"></div>
      <p class="tag">Un mazo de desafíos y tres comodines cada uno.<br>Sin turnos, sin ganador: se juega cuando quieras.</p>
    </section>

    <div class="seg" data-act="tab" style="margin-bottom:16px">
      <button data-tab="create" class="${isCreate ? 'on' : ''}">Crear sala</button>
      <button data-tab="join" class="${!isCreate ? 'on' : ''}">Unirme</button>
    </div>

    ${isCreate ? `
    <div class="panel">
      <h3>Empecemos</h3>
      <p class="sub">Se crea una sala con un código de 4 letras. Tu pareja entra desde su teléfono con ese código.</p>
      <div class="field"><label>Tu nombre</label><input class="input" id="cName" maxlength="18" placeholder="Ej: Luciano" autocomplete="given-name"></div>
      <div class="field"><label>Intensidad del mazo</label>
        <div class="chips" data-act="level">
          ${levels.map(([k, v]) => `<button class="chip ${(S._level || 'normal') === k ? 'on' : ''}" data-level="${k}">${esc(v.label)}<small>${esc(v.hint)}</small>${v.adult ? '<span class="badge badge18" style="margin-left:6px">18+</span>' : ''}</button>`).join('')}
        </div>
      </div>
      <div class="field"><label>Cartas por persona</label>
        <div class="chips" data-act="size">
          <button class="chip" data-size="10">10<small>rápida</small></button>
          <button class="chip on" data-size="22">22<small>clásica</small></button>
          <button class="chip" data-size="30">30<small>larga</small></button>
        </div>
      </div>
      <button class="btn primary" data-act="create">Crear sala</button>
    </div>` : `
    <div class="panel">
      <h3>Entrar a una sala</h3>
      <p class="sub">Pedile el código de 4 letras a quien creó la sala. O abrí el link que te mandó.</p>
      <div class="field"><label>Código</label><input class="input code" id="jCode" maxlength="4" placeholder="ABCD" value="${esc(S.codeParam)}" autocomplete="off" autocapitalize="characters"></div>
      <div class="field"><label>Tu nombre</label><input class="input" id="jName" maxlength="18" placeholder="Ej: Cami"></div>
      <button class="btn primary" data-act="join">Entrar</button>
    </div>`}

    <div class="panel">
      <h3>¿Cómo se juega?</h3>
      <p class="sub" style="margin-bottom:10px">Cada uno arranca con su mazo: cartas de desafío y <b style="color:var(--gold)">3 comodines</b>.</p>
      <div class="kv"><span>1</span><span style="color:#e8dbe4;text-align:right">Cuando quieras, jugá una carta sobre tu pareja.</span></div>
      <div class="kv"><span>2</span><span style="color:#e8dbe4;text-align:right">Le llega al instante al teléfono. Tiene que cumplirla.</span></div>
      <div class="kv"><span>3</span><span style="color:#e8dbe4;text-align:right">Si no quiere, gasta un comodín. Son 3, no vuelven.</span></div>
      <div class="kv"><span>4</span><span style="color:#e8dbe4;text-align:right">No hay turnos ni ganador. Queda el recuerdo.</span></div>
    </div>
    <p class="footnote">Desafíos de texto propio · ${META.totalCards} cartas · funciona en la misma wifi</p>
  </div>`;

  const cName = $('#cName');
  if (cName) {
    cName.value = localStorage.getItem('tuki.name') || '';
    setTimeout(() => cName.focus(), 120);
  }
  const jName = $('#jName');
  if (jName) {
    jName.value = localStorage.getItem('tuki.name') || '';
    S._level = S._level || 'normal';
    S._size = S._size || 22;
    if (S.codeParam) setTimeout(() => jName.focus(), 120);
    else setTimeout(() => $('#jCode').focus(), 120);
  }
}

/* ── lobby ──────────────────────────────────────────────── */
function renderLobby() {
  const st = S.state;
  const link = shareLink();
  app.innerHTML = `
  <div class="wrap">
    <div class="topbar" style="padding-left:0;padding-right:0">
      <div class="wordmark">tuki</div>
      <div class="spacer"></div>
      <button class="iconbtn" data-act="menu" aria-label="Opciones">${ICO('dots')}</button>
    </div>
    <div class="lobby">
      <div class="codebox">
        <div class="k">Código de la sala</div>
        <div class="v">${esc(st.code)}</div>
        <div class="hint">Tu pareja entra con este código</div>
        <div class="qr">${qrSvg(link)}</div>
        <div class="hint" style="margin-top:12px"><span class="pill">${esc(link)}</span></div>
        <div class="row mt">
          <button class="btn ghost small" data-act="copy" style="width:100%">${ICO('copy')} Copiar link</button>
          <button class="btn ghost small" data-act="share" style="width:100%">${ICO('send')} Compartir</button>
        </div>
      </div>
      <div class="waiting"><span class="dotpulse"></span> Esperando a que entre tu pareja…</div>
      <div class="panel mt">
        <h3>Tu mano está lista</h3>
        <p class="sub">${st.me.hand.length} cartas y 3 comodines. Repartimos de nuevo cuando entre.</p>
        <div class="deckstack" aria-hidden="true"><i>t</i><i>t</i><i>t</i></div>
        <button class="btn ghost small" data-act="bot">Probar con un invitado automático</button>
      </div>
    </div>
  </div>`;
}

/* ── juego ──────────────────────────────────────────────── */
function renderGame() {
  const st = S.state;
  const p = st.partner || { name: 'Tu pareja', wildcards: 3, handCount: 0, online: false };
  const mine = st.me;
  const incoming = st.incoming || [];
  const outgoing = st.outgoing || [];

  const hearts = n => [0, 1, 2].map(i => `<i class="${i < n ? '' : 'off'}"></i>`).join('');

  app.innerHTML = `
  <div class="topbar">
    <div class="wordmark">tuki</div>
    <span class="roompill">${esc(st.code)}</span>
    <div class="spacer"></div>
    <button class="iconbtn" data-act="memories" aria-label="Recuerdos">${ICO('book')}</button>
    <button class="iconbtn" data-act="menu" aria-label="Opciones">${ICO('dots')}</button>
  </div>

  <div class="wrap game">
    ${incoming.length ? `
      <div class="banner" data-act="openIncoming">
        <span class="ico">${ICO('spark')}</span>
        <span class="tx"><b>${esc(incoming[0].fromName)}</b> te jugó una carta. ${incoming.length > 1 ? `(+${incoming.length - 1} más)` : ''}</span>
        <span style="color:var(--gold)">›</span>
      </div>` : ''}

    <div class="table">
      <div class="side">
        <div class="avatar">${esc((mine.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="nm">${esc(mine.name)}<span class="you">vos</span></div>
        <div class="mini">${mine.hand.length} cartas</div>
        <div class="hearts" title="Tus comodines">${hearts(mine.wildcards)}</div>
      </div>
      <div class="vs">·</div>
      <div class="side right">
        <div class="avatar">${esc((p.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="nm">${esc(p.name)} ${p.online ? '' : '<span class="badge" style="font-size:8px">off</span>'}</div>
        <div class="mini">${p.handCount} cartas</div>
        <div class="hearts" title="Comodines de ${esc(p.name)}">${hearts(p.wildcards)}</div>
      </div>
      <div class="live" ${incoming.length ? 'data-act="openIncoming" style="cursor:pointer;color:#ffe4bb"' : ''}>
        ${incoming.length
          ? `<span class="dot wait"></span> ${esc(incoming[0].fromName)} te jugó una carta · tocá para verla`
          : outgoing.length
            ? `<span class="spinner"></span> Esperando que ${esc(outgoing[0].toName)} responda…`
            : st.status === 'empty'
              ? 'Se quedaron sin cartas'
              : `<span class="dot"></span> ${esc(p.name)} tiene ${p.handCount} · vos ${mine.hand.length}`}
      </div>
    </div>

    <div class="handhead">
      <span class="t">Tu mano</span>
      <span class="c">${mine.hand.length} carta${mine.hand.length === 1 ? '' : 's'}</span>
    </div>

    ${st.status === 'empty' ? `
      <div class="empty">
        <span class="big">Se quedaron sin cartas</span>
        Se acabó el mazo de esta partida. Pueden revolver y repartir de nuevo, con los comodines recargados.
        <div class="mt"><button class="btn primary" data-act="redeal">Nueva partida</button></div>
      </div>` : mine.hand.length === 0 ? `
      <div class="empty">
        <span class="big">Ya jugaste todas</span>
        Ahora le toca a ${esc(p.name)}. Si querés seguir, revolvé el mazo.
        <div class="mt"><button class="btn ghost" data-act="redeal">Nueva partida</button></div>
      </div>` : `
      <div class="hand" id="hand">
        ${mine.hand.map((c, i) => cardButton(c, i)).join('')}
      </div>
      <p class="footnote" style="margin-top:0">Tocá una carta para jugarla. Le llega al instante.</p>`}

    <div class="divider"></div>
    <div class="kv"><span>Tus comodines</span><span class="hearts">${hearts(mine.wildcards)}</span></div>
    <div class="kv"><span>Mazo</span><span>${esc(st.intensityLabel || st.intensity)} ${st.adult ? '<span class="badge badge18">18+</span>' : ''} · ronda ${st.round}</span></div>
    <div class="kv" style="border:0"><span>Mesa</span><button class="link" data-act="memories" style="font-size:13.5px">${st.memories.length} recuerdo${st.memories.length === 1 ? '' : 's'} →</button></div>
  </div>`;

  const hand = $('#hand');
  if (hand) {
    hand.scrollLeft = S.handScroll || 0;
    hand.addEventListener('scroll', () => { S.handScroll = hand.scrollLeft; }, { passive: true });
  }
}

/* ── íconos ─────────────────────────────────────────────── */
function ICO(name) {
  const p = {
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-7 18-3.5-7.5L3 10z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    hour: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    card: '<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'
  }[name] || '';
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

/* ── capas (overlays) ───────────────────────────────────── */
function closeLayer() { layer.innerHTML = ''; delete layer.dataset.view; }

function openSheet(html) {
  delete layer.dataset.view;
  layer.innerHTML = `<div class="sheet" data-act="closeLayer"><div class="inner" data-stop>${html}</div></div>`;
}

function showIncoming(ev) {
  const st = S.state;
  const n = st.me.wildcards;
  layer.innerHTML = `
  <div class="overlay">
    <div class="lead"><small>${esc(ev.fromName)} te jugó</small>¿Lo hacés ahora?</div>
    ${cardHTML(ev.card)}
    <div class="acts">
      <button class="btn primary" data-act="respond" data-ev="${esc(ev.id)}" data-kind="done">${ICO('check')} Lo hago</button>
      <div class="row">
        <button class="btn ghost" data-act="respond" data-ev="${esc(ev.id)}" data-kind="wildcard" ${n > 0 ? '' : 'disabled'}>
          Comodín (${n})
        </button>
        <button class="btn ghost" data-act="dismiss">Después</button>
      </div>
    </div>
  </div>`;
  chime();
  buzz();
}

function confirmPlay(card) {
  const p = S.state.partner;
  layer.innerHTML = `
  <div class="overlay">
    <div class="lead"><small>Para ${esc(p ? p.name : 'tu pareja')}</small>¿Jugás esta carta?</div>
    ${cardHTML(card)}
    <div class="acts">
      <button class="btn primary" data-act="play" data-id="${esc(card.id)}">Jugar ahora</button>
      <button class="btn ghost" data-act="closeLayer">Mejor no</button>
    </div>
  </div>`;
}

function openMemories() {
  const st = S.state;
  const list = (st.feed && st.feed.length) ? st.feed : st.memories;
  const pend = list.filter(m => m.status === 'pending').length;
  openSheet(`
    <button class="iconbtn x" data-act="closeLayer" aria-label="Cerrar">${ICO('close')}</button>
    <h2>La mesa</h2>
    <p class="sub">Todo lo que pasa entre los dos, en las dos pantallas.${pend ? ` <b style="color:var(--gold)">${pend} en juego.</b>` : ''} ${list.length ? '' : 'Todavía no hay nada: jugá la primera carta.'}</p>
    <div class="timeline">
      ${list.map(m => `
        <div class="mem ${esc(m.card.cat)} ${m.status === 'pending' ? 'pending' : ''}">
          <div class="mh">
            <span class="who">${m.mine === 'out' ? 'Vos → ' + esc(m.toName) : esc(m.fromName) + ' → vos'}</span>
            <span class="tag ${m.status === 'pending' ? 'live' : m.status === 'wildcard' ? 'wild' : 'done'}">${m.status === 'pending' ? 'en juego' : m.status === 'wildcard' ? 'comodín' : 'cumplida'}</span>
          </div>
          <p>${esc(m.card.text)}</p>
          <div class="when">${fmtDate(m.at)}</div>
        </div>`).join('')}
    </div>
  `);
}

function showSent(ev) {
  S.sentId = ev.id;
  layer.dataset.view = 'sent:' + ev.id;
  layer.innerHTML = `
  <div class="overlay">
    <div class="lead"><small>Para ${esc(ev.toName)}</small>Se la jugaste</div>
    ${cardHTML(ev.card)}
    <div class="acts">
      <div class="waiting"><span class="spinner"></span> Esperando que ${esc(ev.toName)} responda…</div>
      <button class="btn ghost" data-act="closeSent">Cerrar</button>
    </div>
  </div>`;
}

function sentResolved(ev) {
  const done = ev.status === 'done';
  layer.dataset.view = 'sent:' + ev.id;
  layer.innerHTML = `
  <div class="overlay">
    <div class="lead"><small>${esc(ev.toName)}</small>${done ? 'Lo hizo' : 'Usó un comodín'}</div>
    ${cardHTML(ev.card)}
    <div class="acts">
      <div class="waiting" style="color:${done ? '#9fe0b6' : '#ffb3c4'}">${done ? 'Guardado en recuerdos' : 'Queda sin hacer'}</div>
      <button class="btn primary" data-act="closeSent">Listo</button>
    </div>
  </div>`;
  chime();
  buzz(done ? [30, 50, 30] : [60, 40, 60]);
  const id = ev.id;
  setTimeout(() => { if (layer.dataset.view === 'sent:' + id) closeLayer(); }, 3200);
}

function openMenu() {
  const st = S.state;
  const link = shareLink();
  openSheet(`
    <button class="iconbtn x" data-act="closeLayer" aria-label="Cerrar">${ICO('close')}</button>
    <h2>La sala</h2>
    <p class="sub">Código <b style="color:var(--gold)">${esc(st.code)}</b> · ${esc((META.levels[st.intensity] || {}).label || st.intensity)}</p>
    <div class="qr" style="margin:0 0 16px">${qrSvg(link)}</div>
    <span class="pill" style="display:block;text-align:center">${esc(link)}</span>
    <div class="row mt">
      <button class="btn ghost small" data-act="copy" style="width:100%">${ICO('copy')} Copiar</button>
      <button class="btn ghost small" data-act="share" style="width:100%">${ICO('send')} Compartir</button>
    </div>
    <div class="divider"></div>
    <button class="btn ghost" data-act="addCard" style="margin-bottom:10px">${ICO('plus')} Agregar mi propio desafío</button>
    <button class="btn ghost" data-act="redeal" style="margin-bottom:10px">${ICO('card')} Nueva partida (revolver)</button>
    <button class="btn danger" data-act="leave">${ICO('out')} Salir de la sala</button>
    <p class="footnote">Tuki digital · versión ${esc(META.version || '1.0')}</p>
  `);
}

function openAddCard() {
  openSheet(`
    <button class="iconbtn x" data-act="closeLayer" aria-label="Cerrar">${ICO('close')}</button>
    <h2>Tu desafío</h2>
    <p class="sub">Se suma a tu mano y al mazo de esta sala. Podés escribir una o pegar varias.</p>
    <div class="seg sm" data-act="cardMode" style="margin-bottom:16px">
      <button data-mode="one" class="on">Una carta</button>
      <button data-mode="many">Pegar varias</button>
    </div>
    <div id="oneMode">
    <div class="field">
      <label>Texto de la carta</label>
      <textarea class="input" id="ncText" rows="4" maxlength="160" placeholder="Ej: Contame algo que te dé orgullo de mí."></textarea>
    </div>
    </div>
    <div id="manyMode" hidden>
      <div class="field">
        <label>Una carta por línea (máx. 60)</label>
        <textarea class="input" id="ncMany" rows="7" placeholder="Pegá acá tu mazo completo, una carta por renglón."></textarea>
      </div>
    </div>
    <div class="field"><label>Categoría</label>
      <div class="chips" data-act="newCat">
        ${Object.entries(DECK.cats).map(([k, v], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cat="${k}">${esc(v.label)}</button>`).join('')}
      </div>
    </div>
    <button class="btn primary" data-act="saveCard" id="saveCardBtn">Agregar a mi mano</button>
    <p class="footnote" style="margin-top:12px">Las cartas que agregás son solo de esta sala. Quedan en tu mano.</p>
  `);
  S._newCat = 'tierno';
  S._cardMode = 'one';
}

function openAdultGate() {
  openSheet(`
    <button class="iconbtn x" data-act="closeLayer" aria-label="Cerrar">${ICO('close')}</button>
    <h2>Modo Hot 18+</h2>
    <div class="adult-note">
      Este mazo tiene <b>contenido sexual explícito</b>. Es solo para mayores de 18 y para jugar entre dos
      personas adultas que están de acuerdo. El comodín sigue valiendo: nadie está obligado a nada.
    </div>
    <button class="btn primary" data-act="confirmAdult">Confirmo: los dos somos mayores</button>
    <button class="btn ghost" data-act="closeLayer" style="margin-top:10px">Volver</button>
  `);
}

function fmtDate(ts) {
  const d = new Date(ts);
  const hoy = new Date();
  const sameDay = d.toDateString() === hoy.toDateString();
  const hh = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return 'Hoy ' + hh;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) + ' · ' + hh;
}

/* ── acciones ───────────────────────────────────────────── */
const actions = {
  tab(elm, e) {
    const b = (e && e.target.closest('[data-tab]')) || elm;
    S.homeTab = b.dataset.tab;
    renderHome();
  },
  level(elm, e) {
    const chip = (e && e.target.closest('[data-level]')) || elm;
    const lv = chip.dataset.level;
    const def = META.levels[lv] || {};
    if (def.adult && !S._adult) return openAdultGate();
    S._level = lv;
    chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
  },
  size(elm, e) {
    const chip = (e && e.target.closest('[data-size]')) || elm;
    S._size = Number(chip.dataset.size);
    chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
  },
  async create() {
    const name = ($('#cName') || {}).value || '';
    if (!name.trim()) return toast('Poné tu nombre');
    audio();
    const btn = $('[data-act="create"]');
    btn.disabled = true;
    try {
      localStorage.setItem('tuki.name', name.trim());
      const r = await api('POST', '/api/rooms', {
        name: name.trim(), intensity: S._level || 'normal', handSize: S._size || 22,
        adult: S._adult === true
      });
      saveSession({ code: r.code, pid: r.playerId, token: r.token, name: name.trim() });
      S.state = r.state; S.sig = '';
      startStream();
      render();
      history.replaceState(null, '', '/?sala=' + r.code);
    } catch (e) { toast(e.message); }
    finally { if (btn) btn.disabled = false; }
  },
  async join() {
    const name = ($('#jName') || {}).value || '';
    const code = (($('#jCode') || {}).value || '').trim().toUpperCase();
    if (!code || code.length < 4) return toast('Falta el código de la sala');
    if (!name.trim()) return toast('Poné tu nombre');
    audio();
    const btn = $('[data-act="join"]');
    btn.disabled = true;
    try {
      localStorage.setItem('tuki.name', name.trim());
      const r = await api('POST', `/api/rooms/${code}/join`, { name: name.trim() });
      saveSession({ code: r.code, pid: r.playerId, token: r.token, name: name.trim() });
      S.state = r.state; S.sig = '';
      startStream();
      render();
      history.replaceState(null, '', '/?sala=' + r.code);
    } catch (e) { toast(e.message); }
    finally { if (btn) btn.disabled = false; }
  },
  pick(elm) {
    const card = (S.state.me.hand || []).find(c => c.id === elm.dataset.id);
    if (card) confirmPlay(card);
  },
  async play(elm) {
    const id = elm.dataset.id;
    closeLayer();
    try {
      const r = await api('POST', `/api/rooms/${S.state.code}/play`, {
        pid: S.session.pid, token: S.session.token, cardId: id
      });
      applyState(r.state, true);
      const ev = (r.state.outgoing || [])[r.state.outgoing.length - 1];
      if (ev) showSent(ev);
    } catch (e) { toast(e.message); }
  },
  closeSent() { S.sentId = null; closeLayer(); },
  async respond(elm) {
    const ev = elm.dataset.ev, kind = elm.dataset.kind;
    closeLayer();
    try {
      const r = await api('POST', `/api/rooms/${S.state.code}/respond`, {
        pid: S.session.pid, token: S.session.token, eventId: ev, action: kind
      });
      applyState(r.state, true);
      toast(kind === 'wildcard' ? 'Gastaste un comodín. Quedan ' + r.state.me.wildcards + '.' : 'Guardado en recuerdos');
      if (kind === 'done') { buzz([40, 40, 40]); }
    } catch (e) { toast(e.message); }
  },
  dismiss() {
    const ev = S.state.incoming[0];
    if (ev) S.dismissed.add(ev.id);
    closeLayer();
  },
  openIncoming() {
    const ev = S.state.incoming[0];
    if (ev) showIncoming(ev);
  },
  closeLayer() { closeLayer(); },
  memories() { openMemories(); },
  menu() { openMenu(); },
  addCard() { openAddCard(); },
  newCat(elm, e) {
    const chip = (e && e.target.closest('[data-cat]')) || elm;
    S._newCat = chip.dataset.cat;
    chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
  },
  cardMode(elm, e) {
    const btn = (e && e.target.closest('[data-mode]')) || elm;
    const mode = btn.dataset.mode;
    S._cardMode = mode;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    const one = $('#oneMode'), many = $('#manyMode');
    if (one) one.hidden = mode !== 'one';
    if (many) many.hidden = mode !== 'many';
    const saveBtn = $('#saveCardBtn');
    if (saveBtn) saveBtn.textContent = mode === 'many' ? 'Agregar todas a mi mano' : 'Agregar a mi mano';
  },
  confirmAdult() {
    const nm = ($('#cName') || {}).value;
    if (nm) localStorage.setItem('tuki.name', nm.trim());
    S._adult = true;
    S._level = 'hot18';
    closeLayer();
    renderHome();
    toast('Modo Hot 18+ activado');
  },
  async saveCard() {
    const many = S._cardMode === 'many';
    const raw = many
      ? (($('#ncMany') || {}).value || '')
      : (($('#ncText') || {}).value || '');
    if (!many && raw.trim().length < 4) return toast('Escribí el desafío');
    if (many && raw.split('\n').filter(l => l.trim().length >= 4).length === 0) return toast('Pegá al menos una carta');
    try {
      const path = many ? 'cards' : 'card';
      const body = many
        ? { pid: S.session.pid, token: S.session.token, texts: raw.split('\n'), cat: S._newCat || 'tierno' }
        : { pid: S.session.pid, token: S.session.token, text: raw.trim(), cat: S._newCat || 'tierno' };
      const r = await api('POST', `/api/rooms/${S.state.code}/${path}`, body);
      closeLayer();
      applyState(r.state, true);
      toast(many ? `Agregué ${r.added} cartas a tu mano` : 'Tu carta está en la mano');
      setTimeout(() => { const h = $('#hand'); if (h) h.scrollLeft = 0; }, 60);
    } catch (e) { toast(e.message); }
  },
  async redeal() {
    closeLayer();
    if (!confirm('¿Revolver el mazo y repartir de nuevo? Se recargan los comodines.')) return;
    try {
      const r = await api('POST', `/api/rooms/${S.state.code}/redeal`, {
        pid: S.session.pid, token: S.session.token
      });
      applyState(r.state, true);
      toast('Mazo nuevo');
    } catch (e) { toast(e.message); }
  },
  async bot() {
    try {
      const r = await api('POST', `/api/rooms/${S.state.code}/bot`, {
        pid: S.session.pid, token: S.session.token
      });
      applyState(r.state, true);
    } catch (e) { toast(e.message); }
  },
  async leave() {
    if (!confirm('¿Salir de la sala? Tu mano se pierde.')) return;
    try {
      await api('POST', `/api/rooms/${S.state.code}/leave`, { pid: S.session.pid, token: S.session.token });
    } catch (e) {}
    clearSession();
    S.state = null;
    closeLayer();
    history.replaceState(null, '', '/');
    render();
  },
  copy() {
    const link = shareLink();
    navigator.clipboard.writeText(link).then(() => toast('Link copiado'), () => toast(link));
  },
  share() {
    const link = shareLink();
    if (navigator.share) navigator.share({ title: 'Tuki', text: 'Juguemos a Tuki', url: link }).catch(() => {});
    else actions.copy();
  }
};

app.addEventListener('click', e => {
  const elm = e.target.closest('[data-act]');
  if (!elm) return;
  const fn = actions[elm.dataset.act];
  if (fn) { e.preventDefault(); fn(elm, e); }
});

layer.addEventListener('click', e => {
  if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
  const elm = e.target.closest('[data-act]');
  if (elm) {
    const fn = actions[elm.dataset.act];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(elm, e); }
    return;
  }
  if (e.target.classList.contains('sheet')) closeLayer();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLayer(); return; }
  if (!S.state || S.state.status === 'waiting') return;
  const hand = $('#hand');
  if (!hand) return;
  const cards = Array.from(hand.querySelectorAll('[data-act="pick"]'));
  if (e.key === 'ArrowRight') { hand.scrollBy({ left: 300, behavior: 'smooth' }); }
  if (e.key === 'ArrowLeft') { hand.scrollBy({ left: -300, behavior: 'smooth' }); }
});

/* ── estado ─────────────────────────────────────────────── */
function applyState(st, force) {
  const prev = S.state;
  const sig = JSON.stringify({ ...st, serverNow: 0 });
  if (!force && sig === S.sig) return;
  S.sig = sig;

  S.state = st;

  if (S.sentId) {
    const ev = (st.feed || []).find(e => e.id === S.sentId);
    if (ev && ev.status !== 'pending') {
      S.sentId = null;
      if (layer.dataset.view === 'sent:' + ev.id) sentResolved(ev);
      else {
        toast(ev.toName + (ev.status === 'done' ? ' lo hizo ✦' : ' usó un comodín'));
        chime();
        buzz(ev.status === 'done' ? [30, 50, 30] : [60, 40, 60]);
      }
    }
  }

  if (!prev) {
    const pend = st.incoming || [];
    if (pend.length) {
      pend.slice(0, -1).forEach(e => S.seen.add(e.id));
      const newest = pend[pend.length - 1];
      S.seen.add(newest.id);
      if (!S.dismissed.has(newest.id)) setTimeout(() => showIncoming(newest), 350);
    }
  } else {
    const fresh = (st.incoming || []).filter(e => !S.seen.has(e.id));
    (st.incoming || []).forEach(e => S.seen.add(e.id));
    if (fresh.length && !S.dismissed.has(fresh[0].id)) {
      setTimeout(() => showIncoming(fresh[fresh.length - 1]), 120);
    }
    if (prev.status === 'waiting' && st.status !== 'waiting' && st.partner) {
      toast('¡' + st.partner.name + ' entró!');
      chime();
      buzz([30, 60, 30]);
      closeLayer();
    }
  }
  render();
}

function startStream() {
  if (!S.session) return;
  if (S.es) S.es.close();
  const { code, pid, token } = S.session;
  const es = new EventSource(`/api/rooms/${code}/events?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`);
  S.es = es;
  es.onmessage = ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state') applyState(msg.state);
    } catch (e) {}
  };
  es.onerror = () => { /* el navegador reintenta solo */ };
}

function render() {
  if (!S.state) return renderHome();
  if (S.state.status === 'waiting') return renderLobby();
  return renderGame();
}

/* ── arranque ───────────────────────────────────────────── */
async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try { META = await api('GET', '/api/meta'); } catch (e) {}

  const url = new URL(location.href);
  S.codeParam = (url.searchParams.get('sala') || '').toUpperCase().slice(0, 4);
  if (S.codeParam) S.homeTab = 'join';

  S.session = loadSession();
  // Si el link apunta a otra sala (ej: dos personas probando en el mismo navegador),
  // no retomamos la sesión guardada: mostramos el formulario para entrar.
  if (S.session && S.codeParam && S.session.code !== S.codeParam) S.session = null;

  if (S.session) {
    try {
      const st = await api('GET', `/api/rooms/${S.session.code}?pid=${encodeURIComponent(S.session.pid)}&token=${encodeURIComponent(S.session.token)}`);
      S.state = st;
      startStream();
      render();
      return;
    } catch (e) {
      clearSession();
    }
  }
  render();
}

boot();
