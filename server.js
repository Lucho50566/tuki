'use strict';
/**
 * Tuki digital — servidor sin dependencias (Node built-in).
 * Sala compartida para dos personas: cada una con su mano de desafíos y 3 comodines.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const DECK = require('./public/deck.js');

const PORT = Number(process.env.PORT || process.env.TUKI_PORT || 4280);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.TUKI_DATA || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const VERSION = '1.0.0';
const MAX_AGE_DAYS = 45;

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ─────────────────────────── estado ─────────────────────────── */
let db = { rooms: [] };
try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db || !Array.isArray(db.rooms)) db = { rooms: [] };
} catch (e) {
  console.error('db.json ilegible, arranco vacío:', e.message);
  db = { rooms: [] };
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DB_FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('no pude guardar db:', e.message); }
  }, 250);
}

function prune() {
  const cut = Date.now() - MAX_AGE_DAYS * 864e5;
  const before = db.rooms.length;
  db.rooms = db.rooms.filter(r => (r.updatedAt || r.createdAt || 0) > cut);
  if (db.rooms.length !== before) save();
}
prune();

/* ─────────────────────────── helpers ────────────────────────── */
const rid = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[crypto.randomInt(abc.length)];
    if (!db.rooms.some(r => r.code === s)) return s;
  }
  return 'T' + crypto.randomInt(1000, 9999);
}

function findRoom(code) {
  return db.rooms.find(r => r.code === String(code || '').toUpperCase()) || null;
}
function auth(room, pid, token) {
  if (!room) return null;
  return room.players.find(p => p.id === pid && p.token === token) || null;
}
function other(room, pid) {
  return room.players.find(p => p.id !== pid) || null;
}
function playerName(room, pid) {
  const p = room.players.find(x => x.id === pid);
  return p ? p.name : 'tu pareja';
}

function dealRoom(room, handSize) {
  const deck = DECK.shuffle(DECK.build(room.intensity, room.custom || []));
  room.handSize = handSize || room.handSize || 22;
  const n = Math.min(room.handSize, Math.floor(deck.length / Math.max(1, room.players.length)));
  room.deck = deck.slice(n * room.players.length);
  room.players.forEach((p, idx) => {
    p.hand = deck.slice(idx * n, idx * n + n).map(k => k.id);
    p.wildcards = 3;
  });
  room.round = (room.round || 0) + 1;
  room.updatedAt = now();
}

function cardOf(room, id) {
  const base = DECK.cards.find(k => k.id === id);
  if (base) return base;
  return (room.custom || []).find(k => k.id === id) || { id, cat: 'complice', intense: 2, text: '(carta borrada)' };
}

function safeCard(room, id) {
  const k = cardOf(room, id);
  return { id: k.id, cat: k.cat, intense: k.intense, text: k.text };
}

function stateFor(room, me) {
  const partner = other(room, me.id);
  const pendingIn = room.events.filter(e => e.to === me.id && e.status === 'pending');
  const pendingOut = room.events.filter(e => e.from === me.id && e.status === 'pending');
  const memories = room.events
    .filter(e => e.status !== 'pending')
    .slice(-60)
    .reverse()
    .map(e => ({
      id: e.id,
      card: e.card,
      fromName: playerName(room, e.from),
      toName: playerName(room, e.to),
      mine: e.from === me.id ? 'out' : 'in',
      status: e.status,
      note: e.note || '',
      at: e.at
    }));

  return {
    code: room.code,
    intensity: room.intensity,
    intensityLabel: (DECK.levels[room.intensity] || {}).label || room.intensity,
    adult: !!(DECK.levels[room.intensity] || {}).adult,
    handSize: room.handSize,
    round: room.round || 1,
    status: room.players.length < 2 ? 'waiting'
      : (me.hand.length === 0 && pendingIn.length === 0 ? 'empty' : 'playing'),
    me: { id: me.id, name: me.name, wildcards: me.wildcards, hand: me.hand.map(id => safeCard(room, id)) },
    partner: partner ? {
      id: partner.id,
      name: partner.name,
      wildcards: partner.wildcards,
      handCount: partner.hand.length,
      online: !!(partner.seenAt && now() - partner.seenAt < 45000)
    } : null,
    incoming: pendingIn.map(e => ({ id: e.id, card: e.card, fromName: playerName(room, e.from), at: e.at })),
    outgoing: pendingOut.map(e => ({ id: e.id, card: e.card, toName: playerName(room, e.to), at: e.at })),
    memories,
    feed: room.events.slice(-12).reverse().map(e => ({
      id: e.id,
      card: e.card,
      fromName: playerName(room, e.from),
      toName: playerName(room, e.to),
      mine: e.from === me.id ? 'out' : 'in',
      status: e.status,
      at: e.at
    })),
    serverNow: now()
  };
}

/* ─────────────────────────── SSE ────────────────────────────── */
const streams = new Map(); // roomCode -> Set<{pid,res}>

function broadcast(room) {
  const set = streams.get(room.code);
  if (!set) return;
  for (const client of Array.from(set)) {
    const p = auth(room, client.pid, client.token);
    if (!p) continue;
    try {
      client.res.write('data: ' + JSON.stringify({ type: 'state', state: stateFor(room, p) }) + '\n\n');
    } catch (e) {
      set.delete(client);
    }
  }
}

/* ─────────────────────────── HTTP ───────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg'
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 200000) { reject(new Error('payload grande')); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('json inválido')); }
    });
    req.on('error', reject);
  });
}

function lanUrl() {
  const nets = os.networkInterfaces();
  const found = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const wifi = /wi-?fi|wlan|ethernet|en0|eth0/i.test(name);
      const priv = /^192\.168\.(0|1|2)\./.test(n.address) || /^10\./.test(n.address);
      let score = 0;
      if (wifi) score += 3;
      if (priv) score += 3;
      if (/^169\.254\./.test(n.address)) score -= 10;
      if (/vEthernet|VirtualBox|VMware|Hyper-V|Loopback|Tailscale/i.test(name)) score -= 8;
      found.push({ address: n.address, score });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const ip = (found[0] || {}).address || 'localhost';
  return 'http://' + ip + ':' + PORT;
}

const clean = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);

/* ── invitado automático (para probar solo) ─────────────────── */
const BOT_NOTES = ['Hecho, amor', 'Cumplido', 'Obvio que sí', 'Ya está ✦', 'Me salió bien'];
const botTimers = new Set();

function scheduleBotReply(room) {
  const bot = room.players.find(p => p.bot);
  if (!bot) return;
  for (const ev of room.events) {
    if (ev.status !== 'pending' || ev.to !== bot.id || botTimers.has(ev.id)) continue;
    botTimers.add(ev.id);
    setTimeout(() => {
      const r = findRoom(room.code);
      if (!r) return;
      const e = r.events.find(x => x.id === ev.id);
      if (!e || e.status !== 'pending') return;
      e.status = 'done';
      e.at = now();
      e.resolvedAt = now();
      e.note = BOT_NOTES[Math.floor(Math.random() * BOT_NOTES.length)];
      r.updatedAt = now();
      save();
      broadcast(r);
    }, 3200 + Math.random() * 2600);
  }
}

function botPlay(room) {
  const bot = room.players.find(p => p.bot);
  const human = room.players.find(p => !p.bot);
  if (!bot || !human || !bot.hand.length) return;
  const id = bot.hand.splice(Math.floor(Math.random() * bot.hand.length), 1)[0];
  room.events.push({
    id: rid(8), cardId: id, card: safeCard(room, id), from: bot.id, to: human.id,
    status: 'pending', at: now(), note: ''
  });
  room.updatedAt = now();
  save();
  broadcast(room);
}


/* ─────────────────────────── rutas API ─────────────────────── */
async function api(req, res, url) {
  const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (seg[0] === 'health') return json(res, 200, { ok: true, version: VERSION, rooms: db.rooms.length });

  if (seg[0] === 'meta') {
    return json(res, 200, {
      version: VERSION,
      url: lanUrl(),
      cats: DECK.cats,
      levels: DECK.levels,
      totalCards: DECK.cards.length
    });
  }

  // POST /api/rooms  → crear
  if (seg[0] === 'rooms' && seg.length === 1 && req.method === 'POST') {
    const b = await body(req);
    const name = clean(b.name) || 'Yo';
    const intensity = DECK.levels[b.intensity] ? b.intensity : 'normal';
    if (DECK.levels[intensity].adult && b.adult !== true) {
      return json(res, 400, { error: 'El modo Hot 18+ requiere confirmar que los dos son mayores de edad' });
    }
    const handSize = Math.max(5, Math.min(40, Number(b.handSize) || 22));
    const room = {
      code: newCode(),
      createdAt: now(),
      updatedAt: now(),
      intensity,
      handSize,
      round: 0,
      custom: [],
      players: [],
      events: []
    };
    const p = { id: rid(6), name, token: rid(16), hand: [], wildcards: 3, joinedAt: now(), seenAt: now() };
    room.players.push(p);
    dealRoom(room, handSize);
    db.rooms.push(room);
    save();
    return json(res, 201, { code: room.code, playerId: p.id, token: p.token, url: lanUrl(), state: stateFor(room, p) });
  }

  // rutas con código
  if (seg[0] === 'rooms' && seg.length >= 2) {
    const room = findRoom(seg[1]);
    if (!room) return json(res, 404, { error: 'Sala no encontrada' });

    // POST /rooms/:code/join
    if (seg[2] === 'join' && req.method === 'POST') {
      const b = await body(req);
      const name = clean(b.name) || 'Mi amor';
      let p = room.players.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (p) {
        p.token = rid(16);
        p.seenAt = now();
      } else {
        if (room.players.length >= 2) return json(res, 409, { error: 'La sala ya tiene dos jugadores' });
        p = { id: rid(6), name, token: rid(16), hand: [], wildcards: 3, joinedAt: now(), seenAt: now() };
        room.players.push(p);
        // repartir de nuevo para que las manos queden parejas
        room.events = [];
        dealRoom(room, room.handSize);
      }
      room.updatedAt = now();
      save();
      broadcast(room);
      return json(res, 200, { code: room.code, playerId: p.id, token: p.token, state: stateFor(room, p) });
    }

    // a partir de acá se necesita token
    if (req.method === 'POST') return json(res, 400, { error: 'ruta inválida' });
    const q = url.searchParams;

    const me = auth(room, q.get('pid'), q.get('token'));
    if (!me) return json(res, 401, { error: 'Sesión inválida' });

    // GET /rooms/:code?pid&token
    if (seg.length === 2) {
      me.seenAt = now();
      return json(res, 200, stateFor(room, me));
    }

    // GET /rooms/:code/events (SSE)
    if (seg[2] === 'events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write('retry: 3000\n\n');
      const client = { pid: me.id, token: q.get('token'), res };
      if (!streams.has(room.code)) streams.set(room.code, new Set());
      const set = streams.get(room.code);
      // reemplazar conexiones viejas del mismo jugador
      for (const c of Array.from(set)) if (c.pid === me.id) { try { c.res.end(); } catch (e) {} set.delete(c); }
      set.add(client);
      me.seenAt = now();
      res.write('data: ' + JSON.stringify({ type: 'state', state: stateFor(room, me) }) + '\n\n');
      const ping = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (e) {}
      }, 20000);
      req.on('close', () => {
        clearInterval(ping);
        set.delete(client);
      });
      return;
    }
    return json(res, 404, { error: 'ruta inválida' });
  }

  return json(res, 404, { error: 'no existe' });
}

/* POSTs con body (se resuelven antes de consumir) */
async function apiPost(req, res, url) {
  const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (!(seg[0] === 'rooms' && seg.length >= 3 && req.method === 'POST')) return false;
  const room = findRoom(seg[1]);
  if (!room) { json(res, 404, { error: 'Sala no encontrada' }); return true; }
  if (seg[2] === 'join' || seg[2] === 'events') return false;

  const b = await body(req);
  const me = auth(room, b.pid, b.token);
  if (!me) { json(res, 401, { error: 'Sesión inválida' }); return true; }
  me.seenAt = now();
  const action = seg[2];

  if (action === 'play') {
    const partner = other(room, me.id);
    if (!partner) { json(res, 409, { error: 'Todavía falta que entre tu pareja' }); return true; }
    const idx = me.hand.indexOf(b.cardId);
    if (idx < 0) { json(res, 400, { error: 'Esa carta no está en tu mano' }); return true; }
    const card = safeCard(room, b.cardId);
    me.hand.splice(idx, 1);
    room.events.push({
      id: rid(8), cardId: card.id, card, from: me.id, to: partner.id,
      status: 'pending', at: now()
    });
    room.updatedAt = now();
    save();
    broadcast(room);
    scheduleBotReply(room);
    return json(res, 200, { ok: true, state: stateFor(room, me) });
  }

  if (action === 'bot') {
    if (room.players.length >= 2) { json(res, 409, { error: 'La sala ya está completa' }); return true; }
    const bot = {
      id: 'bot' + rid(3), name: 'Invitado', token: 'bot', hand: [], wildcards: 3,
      bot: true, joinedAt: now(), seenAt: now()
    };
    room.players.push(bot);
    room.events = [];
    dealRoom(room, room.handSize);
    save();
    broadcast(room);
    setTimeout(() => {
      const r = findRoom(room.code);
      if (r) botPlay(r);
    }, 2800);
    return json(res, 200, { ok: true, state: stateFor(room, me) });
  }

  if (action === 'respond') {
    const ev = room.events.find(e => e.id === b.eventId && e.to === me.id && e.status === 'pending');
    if (!ev) { json(res, 404, { error: 'Ese desafío ya no está pendiente' }); return true; }
    const kind = b.action === 'wildcard' ? 'wildcard' : 'done';
    if (kind === 'wildcard') {
      if (me.wildcards <= 0) { json(res, 400, { error: 'No te quedan comodines' }); return true; }
      me.wildcards -= 1;
    }
    ev.status = kind;
    ev.at = now();
    ev.resolvedAt = now();
    if (b.note) ev.note = String(b.note).slice(0, 160);
    room.updatedAt = now();
    save();
    broadcast(room);
    return json(res, 200, { ok: true, state: stateFor(room, me) });
  }

  if (action === 'redeal') {
    dealRoom(room, room.handSize);
    room.events = room.events.filter(e => e.status !== 'pending');
    save();
    broadcast(room);
    return json(res, 200, { ok: true, state: stateFor(room, me) });
  }

  if (action === 'card') {
    const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (text.length < 4) { json(res, 400, { error: 'Escribí un desafío un poco más largo' }); return true; }
    const cat = DECK.cats[b.cat] ? b.cat : 'complice';
    const card = { id: 'x' + rid(4), cat, intense: DECK.levels[room.intensity].max, text };
    room.custom.push(card);
    // la carta propia entra directo a la mano de quien la creó
    me.hand.unshift(card.id);
    room.updatedAt = now();
    save();
    broadcast(room);
    return json(res, 201, { ok: true, card, state: stateFor(room, me) });
  }

  // importar varias cartas de una (una por línea) — sirve para cargar un mazo propio
  if (action === 'cards') {
    const cat = DECK.cats[b.cat] ? b.cat : 'complice';
    const max = DECK.levels[room.intensity].max;
    const lines = (Array.isArray(b.texts) ? b.texts : String(b.texts || '').split('\n'))
      .map(t => String(t).replace(/^[\s\-–•*·]+/, '').replace(/\s+/g, ' ').trim())
      .filter(t => t.length >= 4)
      .slice(0, 60);
    if (!lines.length) { json(res, 400, { error: 'No encontré cartas para agregar' }); return true; }
    const novas = lines.map(text => {
      const card = { id: 'x' + rid(4), cat, intense: max, text: text.slice(0, 160) };
      room.custom.push(card);
      me.hand.unshift(card.id);
      return card;
    });
    room.updatedAt = now();
    save();
    broadcast(room);
    return json(res, 201, { ok: true, added: novas.length, state: stateFor(room, me) });
  }

  if (action === 'leave') {
    room.players = room.players.filter(p => p.id !== me.id);
    room.events = room.events.filter(e => e.from !== me.id && e.to !== me.id);
    room.updatedAt = now();
    save();
    broadcast(room);
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'acción desconocida' });
  return true;
}

/* ─────────────────────────── estáticos ─────────────────────── */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/admin') rel = '/index.html';
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('403'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!path.extname(rel)) {
        const index = path.join(PUBLIC, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return fs.createReadStream(index).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    const ext = path.extname(file).toLowerCase();
    const etag = '"' + st.size.toString(16) + '-' + st.mtimeMs.toString(16) + '"';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'ETag': etag,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname.startsWith('/api/')) {
    apiPost(req, res, url).then(handled => {
      if (!handled) return api(req, res, url);
    }).catch(e => {
      console.error('API error:', e.message);
      if (!res.headersSent) json(res, 500, { error: e.message });
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  TUKI · juego de cartas para dos');
  console.log('  ─────────────────────────────────');
  console.log('  Local:   http://localhost:' + PORT);
  console.log('  Red:     ' + lanUrl());
  console.log('  Datos:   ' + DB_FILE);
  console.log('');
  console.log('  Ctrl+C para parar.');
  console.log('');
});

process.on('SIGINT', () => { console.log('\nChau.'); process.exit(0); });
