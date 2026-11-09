// Lastlight — game orchestration
'use strict';
(function (LL) {
  const $ = id => document.getElementById(id);
  const B = LL.B, I = LL.I, BIO = LL.BIO;
  const SAVE_KEY = 'lastlight_save_v1', SET_KEY = 'lastlight_settings_v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  };

  const G = LL.game = {
    DAY_LEN: 600, state: 'title', paused: false,
    settings: { rd: 8, sens: 1, fov: 75, bright: 0.35, vol: 0.7, music: 0.5 },
    mobs: [], puppets: [], drops: [], projectiles: [], regrow: [], mp: false,
    daylight: 1, ambientLevel: 0, grav: 1, warmRate: 0,
    flags: {}, stats: { gloom: 0, mined: 0, placed: 0 },
    inp: { f: 0, b: 0, l: 0, r: 0, jump: 0, sprint: 0, attack: false, use: false, attackPressed: false },
  };

  // ---------- renderer & scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  $('game').appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = G.scene = new THREE.Scene();
  const camera = G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  LL.atlasTex = LL.atlasTexture();
  LL.makeMaterials(LL.atlasTex);
  G.particles = new LL.Particles(scene);
  G.ui = LL.UI;

  window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });

  // sky objects
  function glowTex(inner, outer, size = 128, core = 0.25) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner); g.addColorStop(core, inner); g.addColorStop(core + 0.05, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); return t;
  }
  const sky = new THREE.Group(); scene.add(sky);
  const sunMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,250,220,1)', 'rgba(255,170,60,0.35)'), fog: false, depthWrite: false, transparent: true });
  const sun = new THREE.Sprite(sunMat); sun.scale.setScalar(90); sky.add(sun);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(225,232,255,1)', 'rgba(140,160,255,0.15)', 128, 0.18), fog: false, depthWrite: false, transparent: true }));
  moon.scale.setScalar(60); sky.add(moon);
  const starGeo = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 900; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * r * 500, Math.abs(u) * 500, Math.sin(a) * r * 500); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  sky.add(stars);
  sun.renderOrder = moon.renderOrder = stars.renderOrder = -1;
  // clouds
  const cloudCanvas = document.createElement('canvas'); cloudCanvas.width = cloudCanvas.height = 128;
  { const cx = cloudCanvas.getContext('2d'), n = new LL.Simplex(99), img = cx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = Math.cos(x / 128 * Math.PI * 2), ny = Math.sin(x / 128 * Math.PI * 2), nz = Math.cos(y / 128 * Math.PI * 2), nw = Math.sin(y / 128 * Math.PI * 2);
      const v = n.noise3D(nx * 1.6 + nz * 0.7, ny * 1.6 + nw * 0.7, nz * 1.6 + nw * 1.2) * 0.6 + n.noise3D(nx * 4, ny * 4 + nz * 3, nw * 4) * 0.4;
      const i = (y * 128 + x) * 4; const a = v > 0.28 ? 230 : 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a;
    }
    cx.putImageData(img, 0, 0); }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas); cloudTex.magFilter = THREE.NearestFilter; cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.repeat.set(6, 6);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  clouds.rotation.x = -Math.PI / 2; scene.add(clouds);
  // spores (gloam ambience)
  const sporeGeo = new THREE.BufferGeometry(); const spP = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) { spP[i * 3] = (Math.random() - 0.5) * 50; spP[i * 3 + 1] = (Math.random() - 0.5) * 30; spP[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(spP, 3));
  const spores = new THREE.Points(sporeGeo, new THREE.PointsMaterial({ color: 0xd890ff, size: 0.09, transparent: true, opacity: 0.8 }));
  spores.frustumCulled = false; scene.add(spores);

  // selection + cracks
  const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
  hl.visible = false; scene.add(hl);
  const crackGeos = [];
  for (let k = 0; k < 5; k++) {
    const g = new THREE.BoxGeometry(1.006, 1.006, 1.006), uv = g.attributes.uv, t = LL.T['crack' + k];
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((t % 16) + uv.getX(i)) / 16, 1 - (Math.floor(t / 16) + 1 - uv.getY(i)) / 16);
    crackGeos.push(g);
  }
  const crack = new THREE.Mesh(crackGeos[0], new THREE.MeshBasicMaterial({ map: LL.atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  crack.visible = false; scene.add(crack);

  // ---------- settings ----------
  function loadSettings() { try { Object.assign(G.settings, JSON.parse(store.get(SET_KEY) || '{}')); } catch (e) { } applySettings(); }
  function applySettings() {
    const s = G.settings;
    camera.fov = s.fov; camera.updateProjectionMatrix();
    LL.sfx.setVolume(s.vol); LL.sfx.setMusic(s.music);
    [['setRD', 'rd', 'vRD', v => v], ['setSens', 'sens', 'vSens', v => (+v).toFixed(1)], ['setFov', 'fov', 'vFov', v => v], ['setBright', 'bright', 'vBright', v => Math.round(v * 100) + '%'], ['setVol', 'vol', 'vVol', v => Math.round(v * 100) + '%'], ['setMusic', 'music', 'vMusic', v => Math.round(v * 100) + '%']].forEach(([el, k, lab, f]) => { $(el).value = s[k]; $(lab).textContent = f(s[k]); });
    store.set(SET_KEY, JSON.stringify(s));
  }
  ['setRD:rd', 'setSens:sens', 'setFov:fov', 'setBright:bright', 'setVol:vol', 'setMusic:music'].forEach(p => { const [el, k] = p.split(':'); $(el).addEventListener('input', e => { G.settings[k] = +e.target.value; applySettings(); }); });

  // ---------- helpers exposed to other modules ----------
  G.toast = (m, k) => LL.UI.toast(m, k);
  G.inputLocked = () => document.pointerLockElement === canvas;
  G.releasePointer = () => { if (document.pointerLockElement) document.exitPointerLock(); };
  G.lockPointer = () => {
    const fail = () => { if (G.state === 'play' && !LL.UI.panel) showPause(true); };
    const plain = () => { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch (e) { fail(); } };
    // Raw mouse input avoids Chrome's accelerated deltas, which can jump wildly on Windows.
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(err => { if (err && err.name === 'NotSupportedError') plain(); else fail(); });
    } catch (e) { plain(); }
    G.mouseSkip = 2;
  };
  G.closePanels = (relock) => {
    if (!LL.UI.panel) return;
    LL.UI.panel = null; $('invpanel').classList.add('hidden'); $('journal').classList.add('hidden');
    LL.UI.returnCursor(); LL.UI.tip(null);
    if (relock) G.lockPointer();
  };
  G.spawnDrop = (id, n, x, y, z, dur) => { if (!id || !n) return; G.drops.push(new LL.Drop(G, id, n, dur, x, y, z)); };
  G.spawnProjectile = (kind, pos, vel) => G.projectiles.push(new LL.Projectile(G, kind, pos, vel));
  G.spawnMob = (type, x, y, z) => { const m = new LL.Mob(type, x, y, z, G); G.mobs.push(m); return m; };
  G.nearStations = () => {
    const p = G.player.pos, r = { hand: true, bench: false, kiln: false };
    for (let y = -2; y <= 3; y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
      const id = G.world.getBlock(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z);
      if (id === B.BENCH) r.bench = true; else if (id === B.KILN) r.kiln = true;
    }
    return r;
  };

  // ---------- long-term state ----------
  const Prog = LL.Prog;
  function freshProgress(o) {
    o = o || {};
    G.xp = o.xp || 0; G.level = o.level || 1; G.perks = o.perks || {}; G.pendingPerks = o.pendingPerks || 0;
    G.bounties = o.bounties || null; G.bountyDay = o.bountyDay || 0; G.feats = o.feats || {}; G.known = o.known || {};
    G.chests = o.chests || {}; G.crops = o.crops || {}; G.opened = o.opened || {}; G.wards = o.wards || {};
    G.secondDay = o.secondDay || 0; G.umbralActive = !!o.umbralActive; G.umbralDied = !!o.umbralDied;
    const st = Object.assign({ gloom: 0, mined: 0, placed: 0 }, o.stats || G.stats || {});
    G.stats = Object.assign({ caches: 0, harvest: 0, planted: 0, bounties: 0, umbral: 0, nights: 0, minY: 999, biomes: {}, kills: {}, seen: {} }, st);
  }
  const ORE_XP = { 23: 2, 22: 4, 24: 8, 25: 3, 40: 12, 44: 12 };
  const KILL_XP = { gloomling: 6, crawler: 8, wisp: 10, brute: 30, buck: 3, maw: 300 };
  G.onKill = type => {
    G.stats.kills[type] = (G.stats.kills[type] || 0) + 1;
    Prog.addXP(G, KILL_XP[type] || 0, 'kill');
    Prog.bountyEvent(G, 'slay', type, 1);
  };
  G.chestSlots = key => { if (!key) return null; const c = G.chests[G.dimKey] || (G.chests[G.dimKey] = {}); return c[key] || (c[key] = new Array(27).fill(null)); };
  G.addCrop = (x, y, z) => { (G.crops[G.dimKey] || (G.crops[G.dimKey] = [])).push({ x, y, z, t: Prog.GROW }); };
  G.nearWard = (pos, r) => {
    const list = G.wards[G.dimKey]; if (!list) return null;
    for (const w of list) if (Math.abs(w.x - pos.x) < r && Math.abs(w.z - pos.z) < r && Math.abs(w.y - pos.y) < 12) return w;
    return null;
  };
  G.openCache = (t) => {
    const key = G.dimKey + ':' + t.x + ',' + t.y + ',' + t.z;
    G.world.setBlock(t.x, t.y, t.z, B.CACHE_OPEN);
    if (G.opened[key]) return;
    G.opened[key] = 1;
    if (G.mp) Net.send({ t: 'opened', key });
    const rng = LL.mulberry32(LL.chash(t.x, t.y * 31 + t.z, G.seed));
    const loot = Prog.rollLoot(G, G.dimKey, rng);
    loot.forEach(([id, n], i) => setTimeout(() => G.spawnDrop(id, n, t.x + 0.5, t.y + 1.1, t.z + 0.5), i * 120));
    G.particles.burst(t.x + 0.5, t.y + 1, t.z + 0.5, [255, 210, 110], 30, 4);
    LL.sfx.kindle();
    G.stats.caches++;
    G.toast('You pry open the cache.', 'good');
    Prog.addXP(G, 20 + (G.dimKey === 'wild' ? 0 : 20), 'cache');
    Prog.bountyEvent(G, 'cache', 'cache', 1);
    G.compassT = 0;
  };
  function nearestRuin() {
    const gen = G.world.gen; if (!gen.ruinAt) return null;
    const P = G.player, pcx = Math.floor(P.pos.x) >> 4, pcz = Math.floor(P.pos.z) >> 4;
    let best = null, bd = 1e9;
    for (let r = 0; r <= 22; r++) {
      if (best && r * 16 > bd + 16) break;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ru = gen.ruinAt(pcx + dx, pcz + dz); if (!ru) continue;
        if (G.opened[G.dimKey + ':' + ru.x + ',' + ru.y + ',' + ru.z]) continue;
        const ch = G.world.getChunk(pcx + dx, pcz + dz);
        if (ch && G.world.getBlock(ru.x, ru.y, ru.z) !== B.CACHE) continue;
        const d = Math.hypot(ru.x + 0.5 - P.pos.x, ru.z + 0.5 - P.pos.z);
        if (d < bd) { bd = d; best = ru; }
      }
    }
    return best;
  }

  // ---------- flags / progression ----------
  G.setFlag = (f, msg) => {
    if (G.flags[f]) return;
    G.flags[f] = true;
    const q = LL.QUESTS.find(q => q.f === f);
    if (q) { G.toast('✓ ' + q.t, 'good'); LL.sfx.craft(); }
    if (msg) setTimeout(() => G.toast(msg, 'lore'), 1200);
  };
  G.checkFlags = () => {
    const inv = G.player && G.player.inv; if (!inv) return;
    if (inv.count('log') >= 1) G.setFlag('gotLog');
    for (let t = 0; t < 4; t++) if (inv.has(130 + t * 4)) G.setFlag('gotPick');
    if (inv.has(I.COPPER_INGOT)) G.setFlag('gotCopper');
    if (inv.has(B.EMBER_ORE) || inv.has(I.EMBER_INGOT)) G.setFlag('gotEmberOre', 'Emberite hums with old heat. Smelt it in the Kiln.');
    if (inv.count(I.DUSK_PEARL) >= 2 || inv.has(B.WAY_GLOAM)) G.setFlag('gotPearls');
    if (inv.has(I.VOIDGLASS)) G.setFlag('gotVoid');
    if (inv.has(I.GLIDER)) G.setFlag('gotGlider', 'Hold Space while falling to glide.');
    if (inv.has(I.HEARTFIRE)) G.setFlag('gotHeartfire', 'The Heartfire is burning in your pack. Take it to the Dawn Altar.');
  };
  G.onPickup = (id, n = 1) => {
    if (id === I.SUNSTONE && !G.flags.sunHint) { G.flags.sunHint = true; G.toast('Sunstone. A splinter of the old sun.', 'lore'); }
    if (!G.stats.seen[id]) { G.stats.seen[id] = 1; Prog.addXP(G, 5, 'discovery'); G.toast('New discovery: ' + LL.itemName(id)); }
    Prog.bountyEvent(G, 'gather', id, n);
  };
  G.onCrafted = (id, n) => {
    G.checkFlags();
    if (id === I.HEARTHBREAD) G.flags.baked = true;
    if (!G.stats.seen[id]) { G.stats.seen[id] = 1; Prog.addXP(G, 5, 'discovery'); }
    Prog.bountyEvent(G, 'craft', id, n || 1);
  };
  G.onBlockBroken = (id, x, y, z) => {
    G.stats.mined++;
    if (ORE_XP[id]) Prog.addXP(G, ORE_XP[id], 'ore');
    Prog.bountyEvent(G, 'mine', id, 1);
    if (id === B.CROP2) G.stats.harvest++;
    if (id === B.CHEST) {
      const c = G.chests[G.dimKey], key = x + ',' + y + ',' + z;
      if (c && c[key]) { for (const st of c[key]) if (st) G.spawnDrop(st.id, st.n, x + 0.5, y + 0.5, z + 0.5, st.dur); delete c[key]; if (G.mp) Net.send({ t: 'chest', dim: G.dimKey, key, slots: null }); }
    }
    if (id === B.WARD && G.wards[G.dimKey]) G.wards[G.dimKey] = G.wards[G.dimKey].filter(w => !(w.x === x && w.y === y && w.z === z));
  };
  G.onBlockPlaced = (id, x, y, z) => {
    G.stats.placed++;
    Prog.bountyEvent(G, 'place', 'any', 1);
    if (id === B.LANTERN) G.flags.placedLantern = true;
    if (id === B.CHEST) G.flags.placedChest = true;
    if (id === B.WARD) { (G.wards[G.dimKey] || (G.wards[G.dimKey] = [])).push({ x, y, z }); G.toast('The totem hums. No darkness will rise within 20 blocks.', 'good'); }
    if (id === B.BENCH) G.setFlag('placedBench');
    if (id === B.HEARTH) { G.setFlag('placedHearth'); if (G.dimKey === 'wild') G.setHearth(x, y, z); }
  };
  G.setHearth = (x, y, z) => {
    if (G.dimKey !== 'wild') { G.toast('A hearth here cannot hold your spirit. Only in the Wildlands.', 'warn'); return; }
    G.hearth = { x, y, z }; G.toast('Your hearth is kindled. You will wake here.', 'good');
  };

  // ---------- multiplayer glue ----------
  const Net = LL.Net;
  G.allMobs = () => (G.puppets.length ? G.mobs.concat(G.puppets) : G.mobs);
  G.targetFor = (mob) => {
    const P = G.player;
    if (!G.mp || !Net.players.size) return P;
    const now = performance.now();
    if (mob._tc && now - mob._tcT < 500) return mob._tc;
    let best = P.dead ? null : P, bd = P.dead ? 1e9 : mob.pos.distanceTo(P.pos);
    for (const r of Net.players.values()) {
      if (r.dim !== G.dimKey || r.dead || !r.seen) continue;
      const d = mob.pos.distanceTo(r.pos);
      if (d < bd) { bd = d; best = r.proxy; }
    }
    mob._tc = best || P; mob._tcT = now;
    return mob._tc;
  };
  function writeEdit(dim, x, y, z, id) {
    const e = G.edits[dim] || (G.edits[dim] = {}), key = (x >> 4) + ',' + (z >> 4);
    (e[key] || (e[key] = {}))[(x & 15) + (z & 15) * 16 + y * 256] = id;
  }
  G.remoteSet = (dim, x, y, z, id) => {
    if (dim === G.dimKey && G.world && G.world.getChunk(x >> 4, z >> 4)) {
      const old = G.world.getBlock(x, y, z);
      G.world.setBlock(x, y, z, id, true);
      if (!id && old && G.player.pos.distanceTo(new THREE.Vector3(x, y, z)) < 24) { G.particles.burst(x + 0.5, y + 0.5, z + 0.5, LL.TAVG[LL.TSIDE[old]], 10, 3); LL.sfx.dig(old, 0.5); }
    } else writeEdit(dim, x, y, z, id);
    const W = G.wards[dim] || (G.wards[dim] = []);
    if (id === B.WARD) W.push({ x, y, z }); else G.wards[dim] = W.filter(w => !(w.x === x && w.y === y && w.z === z));
    if (id === B.CROP0) (G.crops[dim] || (G.crops[dim] = [])).push({ x, y, z, t: Prog.GROW });
  };
  G.syncChest = key => {
    if (!G.mp) return;
    const slots = G.chestSlots(key), sj = JSON.stringify(slots), k = G.dimKey + ':' + key;
    if (Net.lastChest[k] !== sj) { Net.lastChest[k] = sj; Net.send({ t: 'chest', dim: G.dimKey, key, slots }); }
  };
  G.remoteChest = (dim, key, slots) => {
    const c = G.chests[dim] || (G.chests[dim] = {});
    Net.lastChest[dim + ':' + key] = JSON.stringify(slots);
    if (slots == null) delete c[key]; else c[key] = slots;
    if (LL.UI.panel === 'inv' && LL.UI.chestKey === key && dim === G.dimKey) LL.UI.refresh();
  };
  G.remoteVictory = (name) => {
    if (G.flags.victory) return;
    G.flags.victory = true;
    LL.sfx.kindle(); LL.UI.banner('Dawn Rekindled', name + ' rekindled the old sun!');
    Net.chatLine(null, name + ' defeated the Umbral Maw. The sun burns bright again.');
  };
  G.remoteTime = (day, phase) => {
    if (G.dimKey === 'wild' && G.dayFrac != null && G.phase < G.dayFrac && phase >= G.dayFrac && day === G.day) { G.phase = phase; onDusk(); }
    if (day > G.day) { G.day = day; G.phase = phase; onDawn(); }
    else if (day === G.day && Math.abs(phase - G.phase) > 0.003) G.phase = phase;
  };
  G.onDisconnect = () => {
    G.mp = false; G.state = 'title'; showPause(false);
    if (G.world) G.world.dispose(); clearEntities();
    ['hud', 'death', 'perkpick', 'invpanel', 'journal'].forEach(id => $(id).classList.add('hidden'));
    $('title').classList.remove('hidden'); $('mpstatus').textContent = 'Disconnected from the server.';
    $('btnContinue').disabled = !hasSave();
  };
  function deriveFromEdits(edits) {
    const wards = {}, crops = {};
    for (const dim in edits) for (const key in edits[dim]) {
      const [cx, cz] = key.split(',').map(Number), e = edits[dim][key];
      for (const i in e) {
        const id = e[i]; if (id !== B.WARD && id !== B.CROP0 && id !== B.CROP1) continue;
        const idx = +i, p = { x: cx * 16 + (idx & 15), y: idx >> 8, z: cz * 16 + ((idx >> 4) & 15) };
        if (id === B.WARD) (wards[dim] || (wards[dim] = [])).push(p);
        else (crops[dim] || (crops[dim] = [])).push(Object.assign(p, { t: Prog.GROW }));
      }
    }
    return { wards, crops };
  }

  // ---------- world lifecycle ----------
  function clearEntities() {
    G.mobs.forEach(m => m.remove()); G.mobs = [];
    G.drops.forEach(d => d.remove()); G.drops = [];
    G.projectiles.forEach(p => p.remove(false)); G.projectiles = [];
    G.particles.clear();
    G.boss = null; LL.UI.bossHide();
  }
  function enterDim(dimKey, arrival) {
    if (G.world) G.world.dispose();
    clearEntities();
    G.dimKey = dimKey;
    G.world = new LL.World(dimKey, G.seed, G.edits[dimKey] || (G.edits[dimKey] = {}), scene);
    G.world.onSet = (x, y, z, id) => { if (G.mp) Net.send({ t: 'set', dim: dimKey, x, y, z, id }); };
    Net.clearPuppets();
    const d = G.world.dim;
    G.dimName = d.name; G.grav = d.grav;
    G.arrival = arrival;
    if (dimKey === 'sky') G.altarPos = { x: 0.5, y: G.world.gen.shrineY, z: 0.5 };
    G.state = 'loading';
    $('loading').classList.remove('hidden');
    $('loadtitle').textContent = dimKey === 'wild' ? 'Shaping the Wildlands…' : dimKey === 'gloam' ? 'Descending into the Gloam…' : 'Rising to Skyreach…';
    $('loadsub').textContent = d.name;
    G.player.pos.set(arrival.x, arrival.y != null ? arrival.y : 80, arrival.z);
    G.player.vel.set(0, 0, 0);
    G.loadT = 0;
  }
  function finishLoading() {
    const P = G.player, w = G.world, a = G.arrival;
    const x = Math.floor(a.x), z = Math.floor(a.z);
    if (a.y == null || a.find) {
      let y = -1;
      if (G.dimKey === 'gloam') {
        const col = w.gen.column(x, z);
        for (let yy = Math.max(col.h + 1, 14); yy < col.c - 2; yy++) if (LL.SOLID[w.getBlock(x, yy - 1, z)] && !w.getBlock(x, yy, z) && !w.getBlock(x, yy + 1, z)) { y = yy; break; }
        if (y < 0) { // carve a safe pocket
          y = Math.max(col.h + 1, 15);
          for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(x + dx, y + dy, z + dz, 0);
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(x + dx, y - 1, z + dz, B.MYCEL);
        }
      } else y = w.surfaceAt(x, z) + 1;
      if (y <= 0) y = 70;
      P.pos.set(x + 0.5, y, z + 0.5);
    }
    // never start inside something
    for (let k = 0; k < 40 && LL.boxBlocked(w, P.pos.x, P.pos.y, P.pos.z, P.hw, P.h); k++) P.pos.y += 1;
    if (a.placeReturn) {
      const rx = Math.floor(P.pos.x) + 2, ry = Math.floor(P.pos.y), rz = Math.floor(P.pos.z);
      if (w.getBlock(rx, ry, rz) !== B.WAY_RETURN) {
        w.setBlock(rx, ry, rz, B.WAY_RETURN);
        if (!LL.SOLID[w.getBlock(rx, ry - 1, rz)]) w.setBlock(rx, ry - 1, rz, G.dimKey === 'gloam' ? B.GLOAMROCK : B.CLOUDSTONE);
      }
      G.arrivals[G.dimKey] = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
    }
    G.state = 'play';
    $('loading').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('fade').style.opacity = 0;
    if (a.banner) LL.UI.banner(a.banner[0], a.banner[1]);
    LL.UI.refresh(); LL.UI.trackBounties(); G.compassT = 0;
    if (G.pendingPerks) setTimeout(() => Prog.offerPerk(G), 1500);
  }

  G.travel = (to, wayBlock) => {
    if (G.boss) { G.toast('The Maw holds this place shut.', 'warn'); return; }
    LL.sfx.portal();
    $('fade').style.opacity = 1;
    const P = G.player;
    setTimeout(() => {
      if (G.dimKey === 'wild') G.ret = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      let arr;
      if (to === 'wild') arr = Object.assign({}, G.ret || { x: G.spawn.x, z: G.spawn.z, find: true }, { banner: ['The Wildlands', 'Home, under a dimming sun'] });
      else if (to === 'gloam') {
        arr = G.arrivals.gloam ? Object.assign({}, G.arrivals.gloam) : { x: Math.floor(P.pos.x), z: Math.floor(P.pos.z), find: true, placeReturn: true };
        arr.banner = ['The Gloam', 'Where the light went to die'];
      } else {
        arr = G.arrivals.sky ? Object.assign({}, G.arrivals.sky) : { x: 0.5, y: null, z: -2.5, find: true, placeReturn: true };
        arr.banner = ['Skyreach', 'The last place the sun still touches'];
      }
      enterDim(to, arr);
      if (to === 'gloam') G.setFlag('visitedGloam', 'It is cold here. Bring lanterns and food.');
      if (to === 'sky') G.setFlag('visitedSky', 'Far below the clouds there is nothing. The Dawn Altar stands at the center.');
      save();
    }, 650);
  };

  // ---------- boss & victory ----------
  G.useAltar = (t, held) => {
    if (G.flags.victory) { G.toast('The dawn burns here, steady and bright.', 'lore'); return; }
    if (G.boss) return;
    if (t.id === B.ALTAR) {
      if (!held || held.id !== I.HEARTFIRE) { G.toast('The altar is cold. It is waiting for a Heartfire.', 'lore'); return; }
      G.player.inv.useHeld(1); LL.UI.refresh();
      G.world.setBlock(t.x, t.y, t.z, B.ALTAR_LIT);
      G.altarKindled = true;
    }
    LL.sfx.roar();
    LL.UI.banner('The Umbral Maw', 'The dark has come to put the fire out');
    const A = G.altarPos;
    G.boss = G.spawnMob('maw', A.x, A.y + 10, A.z);
    G.boss.phaseT = 6;
  };
  G.onBossDefeated = () => {
    G.boss = null; LL.UI.bossHide();
    G.flags.victory = true;
    if (G.mp) Net.send({ t: 'victory' });
    G.mobs.forEach(m => { if (m.def.hostile && !m.dead && !m.def.boss) m.die(); });
    LL.sfx.kindle();
    LL.UI.banner('Dawn Rekindled', 'The old sun burns bright again');
    setTimeout(() => {
      $('victoryText').textContent = 'You rekindled the sun on day ' + G.day + '. From now on the days will be long and the nights short. Gloomlings will hide in the deepest caves. The world is yours to build in.';
      $('victory').classList.remove('hidden'); G.releasePointer(); G.paused = !G.mp;
    }, 4000);
    save();
  };
  $('btnVictory').onclick = () => { $('victory').classList.add('hidden'); G.paused = false; G.lockPointer(); };

  // ---------- death ----------
  G.onDeath = (cause) => {
    const P = G.player; P.dead = true;
    if (G.umbralActive) G.umbralDied = true;
    if (G.boss) { G.boss.remove(); G.boss = null; LL.UI.bossHide(); }
    G.releasePointer(); G.closePanels(false);
    $('deathCause').textContent = 'Slain by ' + cause + ' on day ' + G.day + '. ' + (G.hearth ? 'Your hearth still burns.' : 'With no hearth, you will wake where you first arrived.');
    setTimeout(() => $('death').classList.remove('hidden'), 700);
  };
  $('btnRespawn').onclick = () => {
    const P = G.player;
    $('death').classList.add('hidden');
    P.dead = false; P.vigor = P.maxVigor; P.warmth = 80;
    const h = G.hearth;
    const arr = h ? { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 } : { x: G.spawn.x, z: G.spawn.z, find: true };
    if (G.dimKey !== 'wild') enterDim('wild', arr);
    else { P.pos.set(arr.x, arr.y != null ? arr.y : G.world.surfaceAt(Math.floor(arr.x), Math.floor(arr.z)) + 1, arr.z); P.vel.set(0, 0, 0); for (let k = 0; k < 40 && LL.boxBlocked(G.world, P.pos.x, P.pos.y, P.pos.z, P.hw, P.h); k++) P.pos.y++; }
    G.lockPointer();
  };
  G.onVoid = () => {
    const P = G.player;
    if (G.dimKey === 'sky') {
      P.hurt(6, null, 'the endless fall', 0);
      if (P.dead) return;
      const a = G.arrivals.sky || { x: 0.5, y: G.world.gen.shrineY, z: -2.5 };
      P.pos.set(a.x, a.y + 0.5, a.z); P.vel.set(0, 0, 0);
      G.toast('The wind catches you and throws you back to the shrine.', 'lore');
    } else { P.vigor = 0.1; P.hurt(99, null, 'the void', 0); }
  };

  // ---------- save / load ----------
  function save() {
    if (!G.player || G.state === 'title') return;
    const P = G.player;
    if (G.mp) { Net.send({ t: 'psave', data: playerData() }); return; }
    const data = {
      v: 1, seed: G.seed, dim: G.dimKey, pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, pitch: P.pitch, vigor: P.vigor, warmth: P.warmth,
      inv: P.inv.toJSON(), phase: G.phase, day: G.day, flags: G.flags, stats: G.stats, hearth: G.hearth, ret: G.ret, spawn: G.spawn,
      edits: G.edits, arrivals: G.arrivals, altarKindled: G.altarKindled,
      equip: P.equip, xp: G.xp, level: G.level, perks: G.perks, pendingPerks: G.pendingPerks, bounties: G.bounties, bountyDay: G.bountyDay, feats: G.feats, known: G.known,
      chests: G.chests, crops: G.crops, opened: G.opened, wards: G.wards, secondDay: G.secondDay, umbralActive: G.umbralActive, umbralDied: G.umbralDied,
    };
    if (!store.set(SAVE_KEY, JSON.stringify(data))) G.toast('Could not save (storage full or blocked).', 'warn');
  }
  G.save = save;
  function playerData() {
    const P = G.player;
    return {
      dim: G.dimKey, pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, pitch: P.pitch, vigor: P.vigor, warmth: P.warmth, inv: P.inv.toJSON(), equip: P.equip,
      flags: G.flags, stats: G.stats, hearth: G.hearth, ret: G.ret, spawn: G.spawn, arrivals: G.arrivals, altarKindled: G.altarKindled,
      xp: G.xp, level: G.level, perks: G.perks, pendingPerks: G.pendingPerks, bounties: G.bounties, bountyDay: G.bountyDay, feats: G.feats, known: G.known, secondDay: G.secondDay, umbralDied: G.umbralDied,
    };
  }
  async function startMP(url, name) {
    const m = await Net.connect(url, name);
    const W = m.world, pd = m.pdata;
    G.mp = true; G.DAY_LEN = W.dayLen || 600;
    G.seed = W.seed; G.edits = W.edits; G.phase = W.phase; G.day = W.day;
    const der = deriveFromEdits(W.edits);
    const shared = { chests: W.chests, opened: W.opened, wards: der.wards, crops: der.crops };
    G.stats = { gloom: 0, mined: 0, placed: 0 };
    if (pd) {
      G.flags = pd.flags || {}; G.hearth = pd.hearth; G.ret = pd.ret; G.spawn = pd.spawn; G.arrivals = pd.arrivals || {}; G.altarKindled = pd.altarKindled;
      freshProgress(Object.assign({}, pd, shared, { umbralActive: false }));
      newPlayer();
      const P = G.player; P.inv.load(pd.inv); if (pd.equip) P.equip = pd.equip.map(e => e ? Object.assign({}, e) : null); P.applyPerks();
      P.vigor = pd.vigor; P.warmth = pd.warmth; P.yaw = pd.yaw || 0; P.pitch = pd.pitch || 0;
    } else {
      G.flags = {}; G.hearth = null; G.ret = null; G.arrivals = {}; G.altarKindled = false;
      freshProgress(shared);
      newPlayer();
      const s = new (LL.DIMS.wild.Gen)(G.seed).findSpawn();
      G.spawn = { x: s.x + Math.round(Math.random() * 8 - 4), z: s.z + Math.round(Math.random() * 8 - 4) };
      G.player.inv.add(I.EMBERBERRY, 3);
    }
    G.flags.victory = !!W.victory;
    G.umbralActive = G.isUmbralDay(G.day) && G.phase >= Math.max(0.36, 0.6 - (G.day - 1) * 0.025);
    if (!G.bounties || G.bountyDay !== G.day) Prog.rollBounties(G);
    $('title').classList.add('hidden');
    if (pd) enterDim(pd.dim || 'wild', { x: pd.pos[0], y: pd.pos[1], z: pd.pos[2], banner: ['Welcome back, ' + m.name, 'Day ' + G.day + ' · ' + (Net.players.size + 1) + ' online'] });
    else enterDim('wild', { x: G.spawn.x, z: G.spawn.z, find: true, banner: ['Welcome, ' + m.name, 'Day ' + G.day + ' · ' + (Net.players.size + 1) + ' online'] });
    Net.chatLine(null, 'Connected as ' + m.name + '. Press T to chat, hold Tab for the player list.');
    G.lockPointer();
  }
  function hasSave() { return !!store.get(SAVE_KEY); }

  function newPlayer() {
    if (G.player) { camera.remove(G.player.vm); }
    G.player = new LL.Player(G);
  }
  function startNew(seedStr) {
    G.seed = seedStr ? (/^-?\d+$/.test(seedStr) ? (+seedStr | 0) : LL.hashStr(seedStr) | 0) : (Math.random() * 2147483647) | 0;
    G.edits = { wild: {}, gloam: {}, sky: {} }; G.flags = {}; G.stats = { gloom: 0, mined: 0, placed: 0 };
    G.phase = 0.04; G.day = 1; G.hearth = null; G.ret = null; G.arrivals = {}; G.altarKindled = false;
    freshProgress(null);
    newPlayer();
    Prog.rollBounties(G);
    const tmp = new (LL.DIMS.wild.Gen)(G.seed);
    const s = tmp.findSpawn(); G.spawn = { x: s.x, z: s.z };
    G.player.inv.add(I.EMBERBERRY, 3);
    enterDim('wild', { x: s.x, z: s.z, find: true, banner: ['Day 1', 'The sun is weaker than it was yesterday'] });
    setTimeout(() => G.toast('Follow the goal in the top-left. Press J for your journal.', 'lore'), 5000);
  }
  function loadSave() {
    let d; try { d = JSON.parse(store.get(SAVE_KEY)); } catch (e) { return false; }
    if (!d) return false;
    G.seed = d.seed; G.edits = d.edits || { wild: {}, gloam: {}, sky: {} }; G.flags = d.flags || {}; G.stats = d.stats || { gloom: 0, mined: 0, placed: 0 };
    G.phase = d.phase || 0; G.day = d.day || 1; G.hearth = d.hearth; G.ret = d.ret; G.spawn = d.spawn; G.arrivals = d.arrivals || {}; G.altarKindled = d.altarKindled;
    freshProgress(d);
    newPlayer();
    const P = G.player; P.inv.load(d.inv); if (d.equip) P.equip = d.equip.map(e => e ? Object.assign({}, e) : null); P.applyPerks(); P.vigor = d.vigor;
    if (!G.bounties || G.bountyDay !== G.day) Prog.rollBounties(G); P.warmth = d.warmth; P.yaw = d.yaw || 0; P.pitch = d.pitch || 0;
    enterDim(d.dim || 'wild', { x: d.pos[0], y: d.pos[1], z: d.pos[2], banner: ['Day ' + G.day, LL.DIMS[d.dim || 'wild'].name] });
    return true;
  }

  // ---------- menus ----------
  function showPause(on) {
    if (on && (G.state !== 'play' || G.player.dead || LL.UI.perkOpen || !$('victory').classList.contains('hidden'))) return;
    G.paused = on && !G.mp; $('pause').classList.toggle('hidden', !on);
    $('pauseTitle').textContent = G.mp ? 'Menu' : 'Paused';
    $('pauseNote').classList.toggle('hidden', !G.mp);
    if (on) save();
  }
  $('btnResume').onclick = () => { showPause(false); G.lockPointer(); };
  G.pauseOpen = () => !$('pause').classList.contains('hidden');
  $('btnQuit').onclick = () => {
    save(); showPause(false); G.state = 'title';
    if (G.mp) { G.mp = false; setTimeout(() => Net.close(), 200); }
    if (G.world) G.world.dispose(); clearEntities();
    $('hud').classList.add('hidden'); $('title').classList.remove('hidden');
    $('btnContinue').disabled = !hasSave();
  };
  $('btnNew').onclick = () => {
    const nb = $('btnNew');
    if (hasSave() && !nb.dataset.armed) {
      nb.dataset.armed = '1'; nb.textContent = 'Overwrite save?'; nb.classList.add('warn');
      $('mpstatus').textContent = '';
      clearTimeout(nb._t); nb._t = setTimeout(() => { delete nb.dataset.armed; nb.textContent = 'New World'; nb.classList.remove('warn'); }, 4000);
      return;
    }
    delete nb.dataset.armed; nb.textContent = 'New World'; nb.classList.remove('warn');
    LL.sfx.init(); $('title').classList.add('hidden'); startNew($('seed').value.trim()); G.lockPointer();
  };
  $('btnContinue').onclick = () => { LL.sfx.init(); $('title').classList.add('hidden'); if (!loadSave()) { $('title').classList.remove('hidden'); return; } G.lockPointer(); };
  $('btnHelp').onclick = () => $('helpbox').classList.toggle('hidden');
  try { $('mpname').value = store.get('lastlight_name') || ''; $('mpserver').value = store.get('lastlight_server') || ''; } catch (e) { }
  if (window.LASTLIGHT_STATIC) {
    const mpRow = $('mpbox').querySelector('.row'); mpRow.hidden = true; mpRow.style.display = 'none';
    $('mpstatus').textContent = 'Multiplayer needs a Lastlight server. Ask your host for their link (from Lastlight-Online.bat) and open it in your browser.';
  } else if (location.protocol.startsWith('http')) fetch('/status').then(r => r.json()).then(j => { if (j.lastlight) { $('mpserver').value = location.host; $('mpstatus').textContent = 'This page is a Lastlight server · ' + j.players + ' online · day ' + j.day; $('mpbox').classList.add('here'); } }).catch(() => { });
  $('btnJoin').onclick = async () => {
    const name = $('mpname').value.trim(), addr = $('mpserver').value.trim();
    if (!name) { $('mpstatus').textContent = 'Pick a name first.'; $('mpname').focus(); return; }
    if (!addr) { $('mpstatus').textContent = 'Enter the server address (e.g. 192.168.1.20:8840).'; return; }
    store.set('lastlight_name', name); store.set('lastlight_server', addr);
    const secure = /^https:\/\//.test(addr) || /^wss:\/\//.test(addr) || /trycloudflare\.com|ngrok|\.ts\.net/.test(addr) || (location.protocol === 'https:' && !/^http:\/\//.test(addr));
    const url = /^wss?:\/\/.*\/ws$/.test(addr) ? addr : ((secure ? 'wss://' : 'ws://') + addr.replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '') + '/ws');
    LL.sfx.init(); $('mpstatus').textContent = 'Connecting…'; $('btnJoin').disabled = true;
    try { await startMP(url, name); $('mpstatus').textContent = ''; }
    catch (e) { $('mpstatus').textContent = e.message || 'Could not connect.'; }
    $('btnJoin').disabled = false;
  };
  $('mpname').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('mpserver').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('btnContinue').disabled = !hasSave();
  { const e = $('embers'); for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 'em'; d.style.left = Math.random() * 100 + '%'; d.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px'); d.style.animationDuration = (6 + Math.random() * 10) + 's'; d.style.animationDelay = (-Math.random() * 15) + 's'; e.appendChild(d); } }

  // ---------- input ----------
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'sprint' };
  document.addEventListener('keydown', e => {
    if (G.state !== 'play') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = KEYMAP[e.code]; if (k) { G.inp[k] = 1; if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) G.inp.jumpPressed = true; } }
    const P = G.player;
    if (e.code === 'KeyE') { if (LL.UI.panel === 'inv') G.closePanels(true); else if (!G.paused && !P.dead) LL.UI.openInventory(); }
    if (e.code === 'KeyP' && !G.paused && !P.dead && G.pendingPerks) Prog.offerPerk(G);
    if (G.mp && (e.code === 'KeyT' || e.code === 'Enter') && !LL.UI.panel && !Net.chatOpen) { e.preventDefault(); G.inp.f = G.inp.b = G.inp.l = G.inp.r = G.inp.jump = 0; Net.openChat(); }
    if (G.mp && e.code === 'Tab') { e.preventDefault(); Net.renderList(true); }
    if (e.code === 'KeyJ') { if (!G.paused && !P.dead) LL.UI.toggleJournal(); }
    if (e.code === 'Escape' && LL.UI.panel) { G.closePanels(false); showPause(true); }
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) { P.inv.sel = n - 1; LL.UI.refresh(); LL.UI.showItemName(); } }
    if (e.code === 'KeyQ' && G.inputLocked()) {
      const h = P.inv.held(); if (h) {
        const n = e.ctrlKey ? h.n : 1;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const d = new LL.Drop(G, h.id, n, h.dur, P.pos.x + dir.x * 0.6, P.pos.y + 1.3, P.pos.z + dir.z * 0.6);
        d.vel.set(dir.x * 6, dir.y * 6 + 2, dir.z * 6); d.age = -1; G.drops.push(d);
        P.inv.useHeld(n); LL.UI.refresh();
      }
    }
  });
  document.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) G.inp[k] = 0; if (e.code === 'Tab') Net.renderList(false); });
  window.addEventListener('blur', () => { for (const k in G.inp) if (typeof G.inp[k] === 'number') G.inp[k] = 0; G.inp.attack = G.inp.use = false; });
  canvas.addEventListener('mousedown', () => { if (G.state === 'play' && !G.inputLocked() && !LL.UI.panel && !G.pauseOpen() && !G.player.dead && !Net.chatOpen) G.lockPointer(); });
  document.addEventListener('mousedown', e => {
    if (!G.inputLocked()) return;
    if (e.button === 0) { G.inp.attack = true; G.inp.attackPressed = true; }
    if (e.button === 2) { G.inp.use = true; G.player.useCd = 0; }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) G.inp.attack = false; if (e.button === 2) G.inp.use = false; });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    if (!G.inputLocked() || !G.player) return;
    // Drop the first events after locking (they carry the cursor's jump to the centre)
    // and single-event spikes far larger than the movement just before them.
    if (G.mouseSkip > 0) { G.mouseSkip--; return; }
    const mx = e.movementX, my = e.movementY, mag = Math.abs(mx) + Math.abs(my), prev = G.lastMouseMag || 0;
    G.lastMouseMag = mag;
    if (mag > 220 && mag > prev * 6 + 60) return;
    const s = 0.0022 * G.settings.sens;
    G.player.yaw -= mx * s; G.player.pitch -= my * s;
    G.player.pitch = Math.max(-1.55, Math.min(1.55, G.player.pitch));
  });
  document.addEventListener('wheel', e => {
    if (!G.inputLocked()) return;
    const P = G.player; P.inv.sel = (P.inv.sel + (e.deltaY > 0 ? 1 : 8)) % 9; LL.UI.refresh(); LL.UI.showItemName();
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    if (!G.inputLocked()) { G.inp.attack = G.inp.use = false; if (G.state === 'play' && !LL.UI.panel && !LL.UI.perkOpen && !Net.chatOpen && !G.player.dead && $('victory').classList.contains('hidden')) showPause(true); }
    else if (G.pauseOpen()) showPause(false);
  });
  window.addEventListener('beforeunload', () => { if (G.state === 'play') save(); });

  // ---------- environment ----------
  const C = (h) => new THREE.Color(h);
  const SKY = { day: C(0x8cbfe8), dusk: C(0xe0824c), night: C(0x070b1a), gloam: C(0x150c20), sky: C(0xa8d6f6), water: C(0x1a3a6a) };
  const tmpC = new THREE.Color();
  function environment(dt) {
    const U = LL.uni, s = G.settings, d = G.dimKey;
    let bg;
    const R = s.rd;
    let far = (R - 0.6) * 16, near = far * 0.45;
    if (d === 'wild') {
      G.dayFrac = G.flags.victory ? 0.72 : Math.max(0.36, 0.6 - (G.day - 1) * 0.025);
      const ph = G.phase, df = G.dayFrac;
      const elev = ph < df ? Math.sin(Math.PI * ph / df) : -Math.sin(Math.PI * (ph - df) / (1 - df));
      G.elev = elev;
      const dl = LL.sstep(-0.1, 0.22, elev);
      G.daylight = 0.13 + dl * 0.87;
      const duskAmt = Math.max(0, 1 - Math.abs(elev - 0.05) / 0.28);
      bg = tmpC.copy(SKY.night).lerp(SKY.day, dl).lerp(SKY.dusk, duskAmt * 0.6);
      // sun moves east→west over the day arc
      const a = ph < df ? Math.PI * ph / df : Math.PI + Math.PI * (ph - df) / (1 - df);
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.25).normalize();
      sun.position.copy(dir).multiplyScalar(400); moon.position.copy(dir).multiplyScalar(-400);
      const age = G.flags.victory ? 0 : Math.min(1, (G.day - 1) / 14);
      sunMat.color.setRGB(1, 0.95 - age * 0.25, 0.85 - age * 0.45);
      sun.scale.setScalar(90 - age * 20 + (G.flags.victory ? 20 : 0));
      sun.visible = true; moon.visible = true; stars.visible = true;
      stars.material.opacity = 1 - dl;
      U.skyTint.value.setRGB(1, 1 - duskAmt * 0.15, 1 - duskAmt * 0.3);
      clouds.visible = true; clouds.position.y = 128; clouds.material.opacity = 0.25 + dl * 0.55;
      clouds.material.color.copy(bg).lerp(C(0xffffff), dl * 0.8);
      spores.visible = false; G.ambientLevel = Prog.perk(G, 'eyes') ? 3 : 0; U.ambient.value = 0.015 + s.bright * 0.05 + Prog.perk(G, 'eyes') * 0.06;
      if (G.umbralActive) { bg.lerp(C(0x2a0a3a), 0.6 * (1 - dl)); }
    } else if (d === 'gloam') {
      G.daylight = 0; bg = tmpC.copy(SKY.gloam); far *= 0.75; near = far * 0.25;
      sun.visible = moon.visible = stars.visible = clouds.visible = false;
      spores.visible = true; G.ambientLevel = 2.5; U.ambient.value = 0.055 + s.bright * 0.06 + Prog.perk(G, 'eyes') * 0.05;
      U.skyTint.value.setRGB(1, 1, 1);
    } else {
      G.daylight = 0.95; bg = tmpC.copy(SKY.sky);
      sun.visible = true; moon.visible = false; stars.visible = false;
      sun.position.set(150, 330, 120); sunMat.color.setRGB(1, 0.92, 0.7); sun.scale.setScalar(110);
      clouds.visible = true; clouds.position.y = 6; clouds.material.opacity = 0.95; clouds.material.color.setRGB(1, 0.98, 0.94);
      spores.visible = false; G.ambientLevel = 0; U.ambient.value = 0.03 + s.bright * 0.05;
      U.skyTint.value.setRGB(1, 0.97, 0.9);
    }
    // underwater
    const P = G.player;
    const headId = G.world.getBlock(Math.floor(P.pos.x), Math.floor(P.pos.y + P.eye), Math.floor(P.pos.z));
    const under = LL.RT[headId] === 4;
    $('underwater').style.display = under ? 'block' : 'none';
    if (under) { bg = tmpC.copy(SKY.water).multiplyScalar(0.4 + G.daylight * 0.6); far = 18; near = 2; }
    scene.background = bg; U.fogColor.value.copy(bg);
    U.fogNear.value = near; U.fogFar.value = far;
    U.daylight.value = G.daylight;
    U.gamma.value = 1 - s.bright * 0.35;
    U.time.value += dt;
    sky.position.copy(camera.position);
    cloudTex.offset.set((camera.position.x / 1600 * 6 + U.time.value * 0.002) % 1, (-camera.position.z / 1600 * 6) % 1);
    clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
    if (spores.visible) { spores.position.copy(camera.position); spores.rotation.y += dt * 0.02; spores.position.y += Math.sin(U.time.value * 0.3) * 0.5; }
  }

  // ---------- warmth & vitals ----------
  let hearthScanT = 0, nearHearth = false;
  function vitals(dt) {
    const P = G.player, w = G.world;
    if (P.dead) return;
    hearthScanT -= dt;
    if (hearthScanT <= 0) {
      hearthScanT = 0.5; nearHearth = false;
      const px = Math.floor(P.pos.x), py = Math.floor(P.pos.y), pz = Math.floor(P.pos.z);
      for (let y = -3; y <= 3 && !nearHearth; y++) for (let z = -5; z <= 5 && !nearHearth; z++) for (let x = -5; x <= 5; x++) { const id = w.getBlock(px + x, py + y, pz + z); if (id === B.HEARTH || id === B.ALTAR_LIT) { nearHearth = true; break; } }
    }
    const lv = w.lightAt(P.pos.x, P.pos.y + 1, P.pos.z), sky = (lv >> 4) * G.daylight, blk = lv & 15;
    let rate;
    const biome = G.biome;
    if (nearHearth) rate = 9;
    else if (G.dimKey === 'gloam') rate = blk >= 11 ? 0.2 : -0.75;
    else if (G.dimKey === 'sky') rate = 0.4;
    else {
      const night = G.daylight < 0.5;
      const cold = biome === BIO.PINE;
      if (sky >= 11) rate = cold ? -0.7 : 0.5;
      else rate = night ? (cold ? -1.4 : -0.55) : (cold ? -0.8 : -0.2);
      if (blk >= 11) rate = Math.max(rate, 0.15);
      if (G.flags.victory && rate < 0) rate *= 0.4;
    }
    if (P.inWater) rate -= 1.4;
    if (rate < 0 && P.inv.has(I.COAT)) rate *= 0.5;
    if (rate < 0 && P.inv.has(I.HEATSTONE)) rate *= 0.6;
    if (rate < 0) rate *= 1 - 0.2 * Prog.perk(G, 'fire');
    G.warmRate = rate;
    P.warmth = Math.max(0, Math.min(100, P.warmth + rate * dt));
    G.coldT = (G.coldT || 0) + dt;
    if (P.warmth <= 0 && G.coldT > 4) { G.coldT = 0; P.hurt(1, null, 'the cold', 0); if (!G.coldHint) { G.coldHint = true; G.toast('You are freezing. Find fire, or eat Emberberries.', 'warn'); } }
    G.regenT = (G.regenT || 0) + dt;
    if (G.regenT > 5 / (1 + 0.6 * Prog.perk(G, 'kindled'))) { G.regenT = 0; if (P.warmth > 55 && P.lastHurt > 6 && P.vigor < P.maxVigor) P.heal(nearHearth ? 2 : 1); }
  }

  // ---------- spawning ----------
  let spawnT = 0, passiveT = 0;
  function spawning(dt) {
    const P = G.player, w = G.world;
    for (const m of G.mobs) if (!m.dead && !m.def.boss && m.pos.distanceTo(P.pos) > 70) m.remove();
    G.mobs = G.mobs.filter(m => !m.dead);
    spawnT -= dt; passiveT -= dt;
    if (spawnT > 0 || P.dead) return;
    spawnT = G.umbralActive ? 0.45 : 0.8;
    const hostiles = G.mobs.filter(m => m.def.hostile).length + G.puppets.filter(m => m.def.hostile && m.pos.distanceTo(P.pos) < 48).length;
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 24;
    const x = Math.floor(P.pos.x + Math.cos(a) * r), z = Math.floor(P.pos.z + Math.sin(a) * r);
    if (!w.isLoaded(x, z)) return;
    if (G.dimKey === 'sky') {
      if (hostiles < 4 && !G.boss && Math.random() < 0.25) { const y = P.pos.y + 4 + Math.random() * 6; if (!LL.boxBlocked(w, x + 0.5, y, z + 0.5, 0.4, 1)) G.spawnMob('wisp', x + 0.5, y, z + 0.5); }
      return;
    }
    // find standable spot in vertical window
    const startY = Math.floor(P.pos.y) + (Math.random() < 0.5 ? 14 : 4);
    let y = -1;
    for (let yy = startY; yy > Math.max(1, P.pos.y - 24); yy--) {
      if (LL.SOLID[w.getBlock(x, yy - 1, z)] && !LL.SOLID[w.getBlock(x, yy, z)] && !LL.SOLID[w.getBlock(x, yy + 1, z)] && LL.RT[w.getBlock(x, yy, z)] !== 4) { y = yy; break; }
    }
    if (y < 0) return;
    const lv = w.lightAt(x, y + 0.5, z), light = Math.max((lv >> 4) * G.daylight, lv & 15);
    let cap = G.flags.victory ? 3 : 7 + Math.min(4, Math.floor(G.day / 3));
    if (G.umbralActive) cap = Math.round(cap * 1.8) + 2;
    const warded = !!G.nearWard({ x: x + 0.5, y, z: z + 0.5 }, 20);
    if (G.dimKey === 'wild') {
      if (light < (G.umbralActive ? 7 : 5) && hostiles < cap && !warded) {
        if (G.flags.victory && y > 30 && !G.umbralActive) return;
        const bruteChance = G.umbralActive ? 0.3 : (G.day >= 5 && G.daylight < 0.5 ? 0.07 : 0);
        if (Math.random() < bruteChance && G.mobs.filter(m => m.type === 'brute').length < 3) { G.spawnMob('brute', x + 0.5, y, z + 0.5); }
        else if (Math.random() < (G.umbralActive ? 0.9 : 0.55)) G.spawnMob('gloomling', x + 0.5, y, z + 0.5);
      } else if (light >= 10 && passiveT <= 0) {
        passiveT = 3;
        const below = w.getBlock(x, y - 1, z);
        const passive = G.mobs.filter(m => m.def.passive).length;
        if (passive < 6 && (below === B.TURF || below === B.SNOWY_TURF || below === B.MIRE_TURF)) {
          const n = 1 + (Math.random() * 3 | 0);
          for (let i = 0; i < n; i++) G.spawnMob('buck', x + 0.5 + Math.random(), y, z + 0.5 + Math.random());
        }
      }
    } else if (G.dimKey === 'gloam') {
      if (light < 9 && hostiles < cap && !warded) G.spawnMob(Math.random() < 0.6 ? 'crawler' : 'gloomling', x + 0.5, y, z + 0.5);
    }
  }

  // ---------- day events ----------
  G.isUmbralDay = d => G.flags.victory ? d % 7 === 0 : d % 4 === 0;
  function onDusk() {
    if (G.isUmbralDay(G.day)) {
      G.umbralActive = true; G.umbralDied = false;
      LL.UI.banner('Umbral Night', 'They are coming for your light. Hold until dawn.');
      LL.sfx.roar();
      G.toast('Gloom Brutes snuff out lanterns. Keep them away from your light!', 'warn');
    } else if (!G.flags.victory) LL.UI.banner('Nightfall', 'Night ' + G.day + '. The dark lingers longer each time');
  }
  function onDawn() {
    const P = G.player;
    LL.UI.banner('Day ' + G.day, G.flags.victory ? 'The sun rises warm and whole' : 'The sun rises weaker still');
    if (!P.dead) { G.stats.nights++; Prog.addXP(G, 15 + G.day * 2, 'dawn'); }
    if (G.umbralActive) {
      G.umbralActive = false;
      if (!G.umbralDied && !P.dead) {
        G.stats.umbral++;
        Prog.addXP(G, 80 + G.day * 5, 'umbral');
        const rw = [[I.DUSK_PEARL, 3], [I.EMBER_INGOT, 2], [I.LUMITE_SHARD, 4]];
        for (const [id, n] of rw) { const left = P.inv.add(id, n); if (left) G.spawnDrop(id, left, P.pos.x, P.pos.y + 1, P.pos.z); }
        G.toast('You held back the Umbral Night! Rewards added to your pack.', 'good');
        LL.UI.refresh();
      } else G.toast('The Umbral Night has passed. You did not see it through.', 'warn');
      G.mobs.forEach(m => { if (m.type === 'brute') m.remove(); });
    }
    Prog.rollBounties(G); LL.UI.trackBounties();
    G.toast('New bounties are posted. Press J to see them.', 'lore');
  }
  let slowT = 0;
  function slowTick(dt) {
    slowT += dt; if (slowT < 1) return; slowT = 0;
    const P = G.player;
    if (G.dimKey === 'wild' && P.pos.y < G.stats.minY) G.stats.minY = Math.floor(P.pos.y);
    if (G.dimKey === 'wild' && G.biome != null && !G.stats.biomes[G.biome]) { G.stats.biomes[G.biome] = 1; if (G.biome >= 2) Prog.addXP(G, 15, 'biome'); }
    Prog.tickCrops(G, 1);
    Prog.checkFeats(G);
    G.umbralNext = G.isUmbralDay(G.day) && G.phase < G.dayFrac && G.dimKey === 'wild';
    G.compassT = (G.compassT || 0) - 1;
    if (P.inv.has(I.COMPASS)) {
      if (G.compassT <= 0) { G.compassT = 4; G.compassTarget = nearestRuin(); }
    } else G.compassTarget = null;
  }
  function compassHud() {
    const t = G.compassTarget, P = G.player;
    if (!t) return LL.UI.compass(null);
    const dx = t.x + 0.5 - P.pos.x, dz = t.z + 0.5 - P.pos.z;
    const ang = Math.atan2(dx, -dz) + P.yaw;
    LL.UI.compass({ ang, dist: Math.round(Math.hypot(dx, dz)), dy: t.y - P.pos.y, name: LL.ruinTypeName[t.type] || 'Ruin' });
  }

  // ---------- main loop ----------
  let last = performance.now(), saveT = 0, prevBiome = -1, ambT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.state === 'loading') {
      const P = G.player;
      G.world.tick(P.pos.x, P.pos.z, Math.min(G.settings.rd, 4), 40);
      let n = 0, tot = 0; const pcx = Math.floor(P.pos.x) >> 4, pcz = Math.floor(P.pos.z) >> 4;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { tot++; const c = G.world.getChunk(pcx + dx, pcz + dz); if (c && c.meshes) n++; }
      $('loadfill').style.width = (n / tot * 100) + '%';
      if (G.world.readyAround(P.pos.x, P.pos.z, 2)) finishLoading();
      camera.position.set(P.pos.x, P.pos.y + 1.6, P.pos.z);
      environment(dt);
      renderer.render(scene, camera);
      return;
    }
    if (G.state !== 'play') { renderer.render(scene, camera); return; }
    const P = G.player;
    if (G.mp) Net.tick(dt);
    if (!G.paused || G.mp) {
      if (G.dimKey === 'wild') {
        const before = G.phase < G.dayFrac;
        G.phase += dt / G.DAY_LEN;
        if (G.phase >= 1) { G.phase -= 1; G.day++; onDawn(); save(); }
        const after = G.phase < G.dayFrac;
        if (before && !after) onDusk();
      }
      environment(dt);
      if (!G.world.isLoaded(P.pos.x, P.pos.z)) { /* wait for terrain */ }
      else P.update(dt, LL.UI.panel ? { f: 0, b: 0, l: 0, r: 0, jump: 0, sprint: 0 } : G.inp);
      for (const m of G.mobs) if (!m.dead) m.update(dt);
      G.mobs = G.mobs.filter(m => !m.dead);
      for (const d of G.drops) d.update(dt); G.drops = G.drops.filter(d => !d.dead);
      for (const p of G.projectiles) p.update(dt); G.projectiles = G.projectiles.filter(p => !p.dead);
      spawning(dt);
      vitals(dt);
      slowTick(dt);
      // regrow bushes
      for (const r of G.regrow) { r.t -= dt; if (r.t <= 0 && G.world.getBlock(r.x, r.y, r.z) === B.BARE_BUSH) G.world.setBlock(r.x, r.y, r.z, B.BERRY_BUSH); }
      G.regrow = G.regrow.filter(r => r.t > 0);
      // biome banner
      G.biome = G.world.biomeAt(P.pos.x, P.pos.z);
      G.biomeName = LL.BIONAME[G.biome];
      if (G.biome !== prevBiome && G.biomeName) { if (prevBiome !== -1 && G.dimKey === 'wild') LL.UI.banner(G.biomeName, ''); prevBiome = G.biome; }
      // ambient particles
      ambT -= dt;
      if (ambT <= 0) {
        ambT = 0.08;
        const px = P.pos.x + (Math.random() - 0.5) * 20, py = P.pos.y + Math.random() * 6, pz = P.pos.z + (Math.random() - 0.5) * 20;
        if (G.dimKey === 'wild' && G.biome === BIO.ASH) G.particles.add(px, py, pz, (Math.random() - 0.5) * 0.4, 0.3, 0, Math.random() < 0.2 ? [255, 120, 40] : [80, 76, 72], 3, -0.05);
        else if (G.dimKey === 'wild' && G.biome === BIO.PINE) G.particles.add(px, py + 4, pz, 0.3, -1, 0, [240, 246, 255], 4, 0.05);
        else if (G.dimKey === 'wild' && G.daylight < 0.4 && Math.random() < 0.3) G.particles.add(px, py, pz, (Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5, [200, 255, 120], 2.5, 0);
      }
      G.world.tick(P.pos.x, P.pos.z, G.settings.rd, 7);
      saveT += dt; if (saveT > 30) { saveT = 0; save(); }
      const mood = G.dimKey === 'gloam' ? 'gloam' : G.dimKey === 'sky' ? 'sky' : (G.daylight < 0.4 ? 'night' : 'day');
      LL.music(dt, mood);
    }
    // camera
    const sprintFov = (G.inp.sprint && G.inp.f && !LL.UI.panel) ? 6 : 0;
    camera.fov += (G.settings.fov + sprintFov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
    const bob = P.onGround ? Math.sin(P.bob * 2) * 0.04 : 0;
    camera.position.set(P.pos.x, P.pos.y + P.eye + bob, P.pos.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
    // highlight & crack
    const t = P.target;
    if (t && !P.dead && !LL.UI.panel) {
      hl.visible = true;
      const rt = LL.RT[t.id];
      hl.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      hl.scale.set(rt === 3 ? 0.7 : 1, rt === 3 ? 0.9 : 1, rt === 3 ? 0.7 : 1);
      if (rt === 3) hl.position.y = t.y + 0.45;
      if (P.mine && P.mineP > 0) { crack.visible = true; crack.position.copy(hl.position); crack.geometry = crackGeos[Math.min(4, Math.floor(P.mineP * 5))]; }
      else crack.visible = false;
    } else { hl.visible = false; crack.visible = false; }
    const lvp = G.world.lightAt(P.pos.x, P.pos.y + 1, P.pos.z);
    G.particles.update(G.paused ? 0 : dt, Math.min(1, LL.bright(Math.max((lvp >> 4) * G.daylight, lvp & 15, G.ambientLevel)) + 0.25));
    LL.UI.hud(dt);
    if (G.state === 'play') compassHud();
    renderer.render(scene, camera);
  }

  LL.UI.init(G);
  loadSettings();
  requestAnimationFrame(frame);
  window.LLG = G;
  G._dbg = { slowTick, nearestRuin, onDawn, onDusk, spawning, vitals, save, startMP };
})(window.LL);
