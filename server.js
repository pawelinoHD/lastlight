// Lastlight multiplayer server — no dependencies. Run: node server.js [port] [--seed text] [--world file.json]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = +(args.find(a => /^\d+$/.test(a)) || process.env.PORT || 8840);
const ROOT = __dirname;
const WORLD_FILE = path.resolve(opt('--world', path.join(ROOT, 'world.json')));
const DAY_LEN = 600;

// ---------- world state ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
let W;
try { W = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8')); console.log('Loaded world from', WORLD_FILE); }
catch (e) {
  const s = opt('--seed', null);
  W = { seed: s ? (/^-?\d+$/.test(s) ? (+s | 0) : hashStr(s)) : (Math.random() * 2147483647) | 0, edits: { wild: {}, gloam: {}, sky: {} }, chests: {}, opened: {}, day: 1, phase: 0.04, victory: false, players: {} };
  console.log('Created a new world with seed', W.seed);
}
for (const k of ['wild', 'gloam', 'sky']) W.edits[k] = W.edits[k] || {};
W.chests = W.chests || {}; W.opened = W.opened || {}; W.players = W.players || {};
let dirty = false;
function saveWorld() {
  if (!dirty) return;
  const tmp = WORLD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(W));
  fs.renameSync(tmp, WORLD_FILE);
  dirty = false;
}
setInterval(saveWorld, 20000);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { try { dirty = true; saveWorld(); console.log('World saved. Bye.'); } catch (e) { console.error(e); } process.exit(0); });

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/index.html';
  if (u === '/status') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); return res.end(JSON.stringify({ lastlight: true, players: clients.size, day: W.day })); }
  const file = path.normalize(path.join(ROOT, u));
  if (!file.startsWith(ROOT + path.sep) || /world\.json|server\.js/.test(path.basename(file))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------- minimal WebSocket ----------
const clients = new Map(); // id -> client
let nextId = 1;
function wsSend(c, obj) {
  if (c.closed) return;
  const data = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
  let head;
  if (data.length < 126) head = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
  try { c.sock.write(Buffer.concat([head, data])); } catch (e) { }
}
function broadcast(obj, except) { const s = JSON.stringify(obj); for (const c of clients.values()) if (c !== except && c.name) wsSend(c, s); }

server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { id: nextId++, sock, buf: Buffer.alloc(0), frag: [], name: null, closed: false, state: null };
  clients.set(c.id, c);
  sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); parse(c); });
  const bye = () => { if (c.closed) return; c.closed = true; clients.delete(c.id); if (c.name) { broadcast({ t: 'leave', id: c.id, name: c.name }); console.log(c.name + ' left (' + clients.size + ' online)'); } };
  sock.on('close', bye); sock.on('error', bye);
});
function parse(c) {
  for (;;) {
    const b = c.buf; if (b.length < 2) return;
    const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > 16 * 1024 * 1024) { c.sock.destroy(); return; }
    const mo = off; if (masked) off += 4;
    if (b.length < off + len) return;
    const payload = Buffer.from(b.subarray(off, off + len));
    if (masked) for (let i = 0; i < len; i++) payload[i] ^= b[mo + (i & 3)];
    c.buf = b.subarray(off + len);
    if (op === 8) { try { c.sock.end(Buffer.from([0x88, 0])); } catch (e) { } return; }
    if (op === 9) { try { c.sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) { } continue; }
    if (op === 1 || op === 0) {
      c.frag.push(payload);
      if (fin) { const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; try { handle(c, JSON.parse(msg)); } catch (e) { console.error('bad message', e.message); } }
    }
  }
}

// ---------- protocol ----------
function cleanName(n) { n = String(n || '').replace(/[^\w \-]/g, '').trim().slice(0, 16); return n || 'Wanderer'; }
function handle(c, m) {
  if (!c.name) {
    if (m.t !== 'hello') return;
    let name = cleanName(m.name);
    const taken = n => [...clients.values()].some(o => o.name && o.name.toLowerCase() === n.toLowerCase());
    let k = 2; const base = name; while (taken(name)) name = base + k++;
    c.name = name;
    c.look = {}; if (m.look && typeof m.look === 'object') for (const k of ['skin', 'hair', 'style', 'eyes', 'shirt', 'pants']) c.look[k] = Math.max(0, Math.min(9, m.look[k] | 0));
    const others = [...clients.values()].filter(o => o !== c && o.name).map(o => ({ id: o.id, name: o.name, state: o.state, look: o.look }));
    wsSend(c, { t: 'welcome', id: c.id, name, world: { seed: W.seed, edits: W.edits, chests: W.chests, opened: W.opened, day: W.day, phase: W.phase, victory: W.victory, dayLen: DAY_LEN }, pdata: W.players[name.toLowerCase()] || null, players: others });
    broadcast({ t: 'join', id: c.id, name, look: c.look }, c);
    console.log(name + ' joined (' + clients.size + ' online)');
    return;
  }
  switch (m.t) {
    case 'pos': c.state = m; m.id = c.id; broadcast(m, c); break;
    case 'set': {
      const dim = W.edits[m.dim]; if (!dim) return;
      const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
      if (y < 0 || y >= 96) return;
      const key = (x >> 4) + ',' + (z >> 4), idx = (x & 15) + (z & 15) * 16 + y * 256;
      (dim[key] || (dim[key] = {}))[idx] = id;
      dirty = true; m.from = c.id; broadcast(m, c); break;
    }
    case 'chest': (W.chests[m.dim] || (W.chests[m.dim] = {}))[m.key] = m.slots; if (m.slots == null) delete W.chests[m.dim][m.key]; dirty = true; broadcast(m, c); break;
    case 'opened': W.opened[m.key] = 1; dirty = true; broadcast(m, c); break;
    case 'victory': if (!W.victory) { W.victory = true; dirty = true; broadcast({ t: 'victory', name: c.name }, c); } break;
    case 'psave': W.players[c.name.toLowerCase()] = m.data; dirty = true; break;
    case 'chat': { const text = String(m.text || '').slice(0, 200); if (text) { broadcast({ t: 'chat', id: c.id, name: c.name, text }); console.log('<' + c.name + '> ' + text); } break; }
    default:
      // routed relays (mob sync, cross-player hits)
      m.from = c.id;
      if (m.to) { const o = clients.get(m.to); if (o) wsSend(o, m); }
      else broadcast(m, c);
  }
}

// ---------- shared clock ----------
let tick = 0;
setInterval(() => {
  if (![...clients.values()].some(c => c.name)) return;
  W.phase += 1 / DAY_LEN;
  if (W.phase >= 1) { W.phase -= 1; W.day++; dirty = true; }
  if (++tick % 2 === 0) broadcast({ t: 'time', day: W.day, phase: W.phase });
}, 1000);

server.listen(PORT, () => {
  console.log('\n  LASTLIGHT server running on port ' + PORT);
  console.log('  Play here:        http://localhost:' + PORT);
  for (const [nm, list] of Object.entries(os.networkInterfaces())) {
    if (/vmware|virtualbox|vethernet|hyper-v|wsl|docker|loopback/i.test(nm)) continue;
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log('  Friends on LAN:   http://' + a.address + ':' + PORT + '   (' + nm + ')');
  }
  console.log('  World file:       ' + WORLD_FILE + '\n  Press Ctrl+C to save and stop.\n');
});
