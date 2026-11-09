// Lastlight — world generation, chunk storage, lighting and meshing
'use strict';
(function (LL) {
  const B = LL.B;
  const CS = 16, H = 96, CA = CS * CS;
  LL.CS = CS; LL.H = H;
  const { SOLID, OPQ, RT, EMIT, ATT, TTOP, TBOT, TSIDE, LEAFY } = LL;
  const fbm2 = LL.fbm2, clamp = LL.clamp, sstep = LL.sstep, chash = LL.chash;
  const BIO = LL.BIO = { OCEAN: 0, BEACH: 1, MEADOW: 2, ROSE: 3, PINE: 4, ASH: 5, MIRE: 6, SHARD: 7, GLOAM: 8, SKY: 9 };
  LL.BIONAME = ['Brine Shallows', 'Saltshore', 'Meadowlands', 'Rosewood', 'Pinefrost', 'Ashlands', 'Mirelands', 'Shardfields', 'The Gloam', 'Skyreach'];
  const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  LL.ckey = ckey;

  class Chunk {
    constructor(cx, cz) { this.cx = cx; this.cz = cz; this.blocks = new Uint8Array(CA * H); this.light = null; this.lightTop = H; this.meshes = null; this.dirty = true; this.maxY = 0; }
    calcMaxY() { const b = this.blocks; for (let y = H - 1; y >= 0; y--) { const o = y * CA; for (let i = 0; i < CA; i++) if (b[o + i]) { this.maxY = y; return; } } this.maxY = 0; }
  }

  // ---------- shared structure helpers ----------
  function disc(put, x, y, z, r, id, rng, holes = 0.25) {
    const R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dz * dz;
      if (d <= r * r && !(d > (r - 1) * (r - 1) && rng() < holes)) put(x + dx, y, z + dz, id, true);
    }
  }
  function blob(put, x, y, z, r, id, rng, holes = 0.12) {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dy * dy * 1.4 + dz * dz;
      if (d <= r * r && !(d > r * r * 0.55 && rng() < holes)) put(x + dx, y + dy, z + dz, id, true);
    }
  }
  const TREES = {
    [BIO.MEADOW]: (x, y, z, r, put) => { const h = 4 + (r() * 3 | 0); for (let i = 0; i < h; i++) put(x, y + i, z, B.DRIFT_LOG); blob(put, x, y + h - 1, z, 2.7, B.DRIFT_LEAVES, r); put(x, y + h + 1, z, B.DRIFT_LEAVES, true); },
    [BIO.ROSE]: (x, y, z, r, put) => {
      const h = 5 + (r() * 3 | 0);
      for (let i = 0; i < h; i++) put(x, y + i, z, B.ROSE_LOG);
      const bx = r() < 0.5 ? 1 : -1, bz = r() < 0.5 ? 1 : -1;
      put(x + bx, y + h - 2, z, B.ROSE_LOG); put(x + bx * 2, y + h - 1, z, B.ROSE_LOG);
      put(x, y + h - 3, z + bz, B.ROSE_LOG);
      disc(put, x, y + h - 1, z, 3.5, B.ROSE_LEAVES, r);
      disc(put, x + bx, y + h, z, 3.0, B.ROSE_LEAVES, r);
      disc(put, x, y + h + 1, z, 1.8, B.ROSE_LEAVES, r);
    },
    [BIO.PINE]: (x, y, z, r, put) => {
      const h = 7 + (r() * 5 | 0);
      for (let i = 0; i < h; i++) put(x, y + i, z, B.FROST_LOG);
      for (let yy = 2; yy < h; yy++) { const t = h - yy; const rad = (t % 2 === 0) ? Math.min(3.2, 1.2 + t * 0.32) : Math.max(1, t * 0.22); disc(put, x, y + yy, z, rad, B.FROST_LEAVES, r, 0.15); }
      put(x, y + h, z, B.FROST_LEAVES, true); put(x, y + h + 1, z, B.FROST_LEAVES, true);
    },
    [BIO.ASH]: (x, y, z, r, put) => {
      if (r() < 0.4) { const h = 3 + (r() * 7 | 0); for (let i = 0; i < h; i++) { put(x, y + i - 1, z, B.BASALT); if (i < h / 2) { if (r() < 0.7) put(x + 1, y + i - 1, z, B.BASALT); if (r() < 0.5) put(x, y + i - 1, z + 1, B.BASALT); } } return; }
      const h = 3 + (r() * 4 | 0);
      for (let i = 0; i < h; i++) put(x, y + i, z, B.CHARRED_LOG);
      for (let k = 0; k < 2; k++) { const dx = r() < 0.5 ? 1 : -1, dz = r() < 0.5 ? (r() < 0.5 ? 1 : -1) : 0; const by = y + h - 1 - (r() * 2 | 0); put(x + dx, by, z + dz, B.CHARRED_LOG); put(x + dx * 2, by + 1, z + dz * 2, B.CHARRED_LOG); }
    },
    [BIO.MIRE]: (x, y, z, r, put) => {
      const h = 4 + (r() * 2 | 0);
      for (let i = 0; i < h + 1; i++) put(x, y + i, z, B.DRIFT_LOG);
      disc(put, x, y + h, z, 3.4, B.DRIFT_LEAVES, r, 0.1); disc(put, x, y + h + 1, z, 2.2, B.DRIFT_LEAVES, r, 0.1);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const d = Math.sqrt(dx * dx + dz * dz); if (d > 2.2 && d < 3.5 && r() < 0.5) { const len = 1 + (r() * 3 | 0); for (let k = 1; k <= len; k++) put(x + dx, y + h - k, z + dz, B.DRIFT_LEAVES, true); } }
    },
    [BIO.SHARD]: (x, y, z, r, put) => { const h = 2 + (r() * 4 | 0); for (let i = 0; i < h; i++) put(x, y + i - 1, z, B.SHARDSTONE); if (r() < 0.12) put(x, y + h - 1, z, B.LUMITE); if (r() < 0.5) put(x + 1, y - 1, z, B.SHARDSTONE); if (r() < 0.4) put(x, y, z - 1, B.SHARDSTONE); },
  };
  const TREE_DENS = [0, 0, 0.07, 0.45, 0.38, 0.14, 0.25, 0.05];

  function veins(bl, rng, id, count, y0, y1, size, host) {
    for (let k = 0; k < count; k++) {
      let x = rng() * 16 | 0, y = (y0 + rng() * (y1 - y0)) | 0, z = rng() * 16 | 0;
      for (let s = 0; s < size; s++) {
        if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < H) { const j = x + z * CS + y * CA; if (bl[j] === host) bl[j] = id; }
        x += (rng() * 3 | 0) - 1; y += (rng() * 3 | 0) - 1; z += (rng() * 3 | 0) - 1;
      }
    }
  }
  function makePut(ch) {
    const bl = ch.blocks, ox = ch.cx * CS, oz = ch.cz * CS;
    return (x, y, z, id, soft) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= H) return;
      const j = lx + lz * CS + y * CA, cur = bl[j];
      if (cur === 0 || (!soft && (LEAFY[cur] || RT[cur] === 3))) bl[j] = id;
    };
  }

  // ---------- ruins ----------
  function ruinRng(cx, cz, seed) { return LL.mulberry32(chash(cx, cz, seed + 4242)); }
  function buildRuin(ch, ru) {
    const bl = ch.blocks, ox = ch.cx * CS, oz = ch.cz * CS;
    const r = LL.mulberry32(ru.seed);
    const set = (lx, y, lz, id) => { if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= H - 1) return; bl[lx + lz * CS + y * CA] = id; };
    const get = (lx, y, lz) => bl[lx + lz * CS + y * CA];
    const h = ru.h, W = ru.wall || B.RUIN_BRICK;
    if (ru.type === 'tower') {
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = h + 1; y < h + 10; y++) set(8 + dx, y, 8 + dz, 0);
      const wallH = 4 + (r() * 4 | 0);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        for (let y = h - 3; y <= h; y++) set(8 + dx, y, 8 + dz, y === h ? W : (get(8 + dx, y, 8 + dz) ? get(8 + dx, y, 8 + dz) : B.SLATE));
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
          const top = wallH - (r() * 3 | 0);
          for (let y = h + 1; y <= h + top; y++) if (r() < 0.85 - (y - h) * 0.04) set(8 + dx, y, 8 + dz, W);
        }
      }
      set(8, h + 1, 10, 0); set(8, h + 2, 10, 0);
      set(9, h + 1, 7, B.LUMITE);
    } else if (ru.type === 'vault') {
      const y0 = ru.y;
      // spiral stair shaft (2x2)
      const corners = [[2, 2], [3, 2], [3, 3], [2, 3]];
      for (let y = y0; y <= h + 3; y++) for (const [x, z] of corners) set(x, y, z, 0);
      for (let y = y0; y < h + 1; y++) { const [x, z] = corners[(y - y0) % 4]; set(x, y, z, W); }
      for (let x = 1; x <= 4; x++) for (let z = 1; z <= 4; z++) if (x === 1 || x === 4 || z === 1 || z === 4) { set(x, h, z, W); if ((x + z) % 3 === 0) set(x, h + 1, z, W); }
      set(1, h + 2, 1, W); set(1, h + 3, 1, B.LANTERN);
      // room
      for (let x = 4; x <= 12; x++) for (let z = 1; z <= 10; z++) for (let y = y0 - 1; y <= y0 + 4; y++) {
        const edge = x === 4 || x === 12 || z === 1 || z === 10 || y === y0 - 1 || y === y0 + 4;
        set(x, y, z, edge ? (r() < 0.08 ? B.COBBLE : W) : 0);
      }
      for (let y = y0; y <= y0 + 1; y++) for (let z = 2; z <= 3; z++) set(4, y, z, 0);
      for (let y = y0; y < h + 1; y++) { const [x, z] = corners[(y - y0) % 4]; set(x, y, z, W); }
      set(5, y0, 9, B.LUMITE); set(11, y0, 9, B.LUMITE); set(11, y0, 2, B.LUMITE);
      for (let x = 6; x <= 10; x += 4) for (let y = y0; y <= y0 + 3; y++) set(x, y, 6, W);
    } else if (ru.type === 'camp') {
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 4; dx++) for (let y = h + 1; y < h + 7; y++) set(8 + dx, y, 8 + dz, 0);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) set(8 + dx, h, 8 + dz, B.COBBLE);
      set(8, h, 8, B.CHARRED_LOG);
      set(5, h + 1, 8, B.DRIFT_LOG); set(8, h + 1, 5, B.DRIFT_LOG); set(8, h + 1, 11, B.ROSE_LOG);
      set(6, h + 1, 6, B.BERRY_BUSH); set(10, h + 1, 5, B.LANTERN);
    } else if (ru.type === 'shrine') {
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { set(8 + dx, h, 8 + dz, W); for (let y = h + 1; y < h + 7; y++) set(8 + dx, y, 8 + dz, 0); }
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const ph = 3 + (r() * 3 | 0); for (let y = h + 1; y <= h + ph; y++) set(8 + dx, y, 8 + dz, W); set(8 + dx, h + ph + 1, 8 + dz, B.SPORE_LAMP); }
    } else if (ru.type === 'cairn') {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { for (let y = h + 1; y < h + 6; y++) set(8 + dx, y, 8 + dz, 0); if (Math.abs(dx) === 2 || Math.abs(dz) === 2) { if (r() < 0.7) set(8 + dx, h + 1, 8 + dz, W); if (r() < 0.35) set(8 + dx, h + 2, 8 + dz, W); } }
    }
    else if (ru.type === 'village') {
      for (let z = 1; z <= 14; z++) for (let x = 1; x <= 14; x++) {
        for (let y = h + 1; y <= h + 10; y++) set(x, y, z, 0);
        set(x, h, z, (x === 8 || z === 8) && r() < 0.7 ? B.MOSSY_COBBLE : B.TURF);
        for (let y = h - 3; y < h; y++) if (!get(x, y, z)) set(x, y, z, B.LOAM);
      }
      const hut = (x0, z0, kind) => {
        const plank = kind === 'B' ? B.ROSE_PLANKS : B.DRIFT_PLANKS;
        for (let z = z0; z <= z0 + 4; z++) for (let x = x0; x <= x0 + 4; x++) {
          set(x, h, z, B.DRIFT_PLANKS);
          const edge = x === x0 || x === x0 + 4 || z === z0 || z === z0 + 4;
          if (!edge) continue;
          const corner = (x === x0 || x === x0 + 4) && (z === z0 || z === z0 + 4);
          for (let y = h + 1; y <= h + 3; y++) {
            if (corner) { set(x, y, z, B.DRIFT_LOG); continue; }
            const mid = x === x0 + 2 || z === z0 + 2;
            set(x, y, z, r() < 0.08 ? 0 : (y === h + 2 && mid ? B.GLASS : plank));
          }
        }
        set(x0 + 2, h + 1, z0 + 4, 0); set(x0 + 2, h + 2, z0 + 4, 0);
        for (let z = z0 - 1; z <= z0 + 5; z++) for (let x = x0 - 1; x <= x0 + 5; x++) set(x, h + 4, z, B.THATCH);
        for (let z = z0; z <= z0 + 4; z++) for (let x = x0; x <= x0 + 4; x++) set(x, h + 5, z, B.THATCH);
        for (let z = z0 + 1; z <= z0 + 3; z++) for (let x = x0 + 1; x <= x0 + 3; x++) set(x, h + 6, z, B.THATCH);
        if (kind === 'A') set(x0 + 3, h + 1, z0 + 1, B.LANTERN);
        if (kind === 'B') { set(x0 + 1, h + 1, z0 + 1, B.BENCH); set(x0 + 3, h + 1, z0 + 1, B.CHEST); }
        if (kind === 'C') { set(x0 + 1, h + 1, z0 + 1, B.KILN); set(x0 + 3, h + 1, z0 + 1, B.LANTERN); }
      };
      hut(2, 2, 'A'); hut(9, 2, 'B'); hut(2, 9, 'C');
      for (let z = 10; z <= 12; z++) for (let x = 10; x <= 12; x++) { const c = x === 11 && z === 11; set(x, h, z, c ? B.WATER : B.MOSSY_COBBLE); if (!c) set(x, h + 1, z, B.MOSSY_COBBLE); }
      set(11, h - 1, 11, B.WATER); set(11, h - 2, 11, B.WATER);
      for (const x of [10, 12]) for (let y = h + 2; y <= h + 3; y++) set(x, y, 11, B.DRIFT_LOG);
      for (let x = 10; x <= 12; x++) set(x, h + 4, 11, B.THATCH);
      set(11, h + 1, 8, B.DRIFT_PLANKS); set(12, h + 1, 8, B.TRADE_STALL); set(13, h + 1, 8, B.DRIFT_PLANKS);
      set(11, h + 2, 8, B.DRIFT_LOG); set(13, h + 2, 8, B.DRIFT_LOG); set(11, h + 3, 8, B.DRIFT_LOG); set(13, h + 3, 8, B.DRIFT_LOG);
      for (let z = 7; z <= 9; z++) for (let x = 10; x <= 14; x++) set(x, h + 4, z, B.THATCH);
      set(8, h + 1, 7, B.COBBLE); set(8, h + 2, 7, B.DRIFT_LOG); set(8, h + 3, 7, B.DRIFT_LOG); set(8, h + 4, 7, B.LANTERN);
      set(5, h + 1, 12, B.BERRY_BUSH); set(6, h + 1, 13, B.EMBERBLOOM);
    } else if (ru.type === 'nest') {
      for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
        const d = Math.hypot(dx, dz); if (d >= 7.2) continue;
        const depth = d < 6 ? Math.round((1 - d / 6) * 4) : 0;
        for (let y = h - depth + 1; y <= h + 9; y++) set(8 + dx, y, 8 + dz, 0);
        set(8 + dx, h - depth, 8 + dz, d < 6 ? (r() < 0.5 ? B.BASALT : B.ASH) : B.ASH);
      }
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + r() * 0.4, rr = 4.5 + r() * 1.2;
        const x = Math.round(8 + Math.cos(a) * rr), z = Math.round(8 + Math.sin(a) * rr);
        const floor = h - Math.round((1 - Math.min(1, Math.hypot(x - 8, z - 8) / 6)) * 4);
        const tall = 2 + (r() * 4 | 0);
        for (let y = floor + 1; y <= floor + tall; y++) set(x, y, z, B.BASALT);
      }
      set(8, h - 3, 8, B.GLOOM_RIFT);
    } else if (ru.type === 'circle') {
      for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) if (Math.hypot(dx, dz) < 7.5) for (let y = h + 1; y <= h + 9; y++) set(8 + dx, y, 8 + dz, 0);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, x = Math.round(8 + Math.cos(a) * 5), z = Math.round(8 + Math.sin(a) * 5);
        if (r() < 0.2) { set(x, h + 1, z, B.MOSSY_COBBLE); set(Math.round(8 + Math.cos(a) * 6), h + 1, Math.round(8 + Math.sin(a) * 6), B.MOSSY_COBBLE); continue; }
        const tall = 2 + (r() * 3 | 0);
        for (let y = h + 1; y <= h + tall; y++) set(x, y, z, r() < 0.6 ? B.MOSSY_COBBLE : B.COBBLE);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(8 + dx, h, 8 + dz, B.MOSSY_COBBLE);
      for (let k = 0; k < 6; k++) { const a = r() * Math.PI * 2, rr = 2 + r() * 2; set(Math.round(8 + Math.cos(a) * rr), h + 1, Math.round(8 + Math.sin(a) * rr), r() < 0.5 ? B.EMBERBLOOM : B.TALLGRASS); }
      set(8, h, 8, B.SUNWELL);
    } else if (ru.type === 'forge') {
      for (let z = 3; z <= 11; z++) for (let x = 3; x <= 13; x++) {
        for (let y = h + 1; y <= h + 9; y++) set(x, y, z, 0);
        set(x, h, z, B.BASALT);
        if (x === 3 || x === 13 || z === 3 || z === 11) {
          const top = 1 + (r() * 3 | 0);
          for (let y = h + 1; y <= h + top; y++) set(x, y, z, r() < 0.35 ? B.KILN_BRICKS : B.BASALT);
        }
      }
      for (let y = h + 1; y <= h + 3; y++) for (const x of [7, 8]) set(x, y, 11, 0);
      for (let y = h + 1; y <= h + 7; y++) for (let x = 4; x <= 5; x++) for (let z = 4; z <= 5; z++) set(x, y, z, B.KILN_BRICKS);
      set(4, h + 1, 6, B.KILN); set(8, h + 1, 7, B.EMBER_ANVIL); set(6, h + 1, 10, B.LANTERN);
      set(11, h + 1, 9, B.CINDER_ORE); set(12, h + 1, 9, B.CINDER_ORE); set(12, h + 2, 9, B.CINDER_ORE); set(10, h + 1, 10, B.COPPER_ORE);
    } else if (ru.type === 'bog') {
      const b = ru.base, f = b + 3;
      for (let z = 4; z <= 13; z++) for (let x = 4; x <= 12; x++) for (let y = b + 1; y <= f + 7; y++) set(x, y, z, 0);
      for (const [x, z] of [[6, 6], [10, 6], [6, 10], [10, 10]]) for (let y = b - 1; y < f; y++) set(x, y, z, B.DRIFT_LOG);
      for (let z = 6; z <= 10; z++) for (let x = 6; x <= 10; x++) {
        set(x, f, z, B.DRIFT_PLANKS);
        if (x === 6 || x === 10 || z === 6 || z === 10) for (let y = f + 1; y <= f + 2; y++) set(x, y, z, r() < 0.45 ? B.MUD_BRICKS : B.DRIFT_PLANKS);
      }
      set(8, f + 1, 10, 0); set(8, f + 2, 10, 0);
      for (let z = 5; z <= 11; z++) for (let x = 5; x <= 11; x++) set(x, f + 3, z, B.THATCH);
      for (let z = 6; z <= 10; z++) for (let x = 6; x <= 10; x++) set(x, f + 4, z, B.THATCH);
      for (let z = 7; z <= 9; z++) for (let x = 7; x <= 9; x++) set(x, f + 5, z, B.THATCH);
      for (let k = 1; k <= 3; k++) set(8, f - k, 10 + k, B.DRIFT_PLANKS);
      set(7, f + 1, 7, B.LANTERN); set(9, f + 1, 7, B.GLOWCAP);
    } else if (ru.type === 'caravan') {
      for (let z = 3; z <= 14; z++) for (let x = 2; x <= 14; x++) for (let y = h + 1; y <= h + 8; y++) set(x, y, z, 0);
      const wagon = (x0, z0) => {
        for (let z = z0; z <= z0 + 2; z++) for (let x = x0; x <= x0 + 4; x++) set(x, h + 1, z, B.FROST_PLANKS);
        for (const x of [x0 + 1, x0 + 3]) { set(x, h + 1, z0 - 1, B.DRIFT_LOG); set(x, h + 1, z0 + 3, B.DRIFT_LOG); }
        for (let x = x0; x <= x0 + 4; x++) { set(x, h + 2, z0, r() < 0.3 ? B.ICE : B.THATCH); set(x, h + 2, z0 + 2, r() < 0.3 ? B.ICE : B.THATCH); set(x, h + 3, z0 + 1, r() < 0.3 ? B.ICE : B.THATCH); set(x, h + 3, z0, B.SNOW); set(x, h + 3, z0 + 2, B.SNOW); }
      };
      wagon(3, 6); wagon(9, 10);
      for (let k = 0; k < 8; k++) { const x = 2 + (r() * 12 | 0), z = 3 + (r() * 11 | 0); if (!get(x, h + 1, z)) set(x, h + 1, z, r() < 0.4 ? B.ICE_BRICKS : B.SNOW); }
    }
    if (!ru.noCache) set(ru.x - ox, ru.y, ru.z - oz, B.CACHE);
  }
  LL.ruinTypeName = { tower: 'Ruined Watchtower', vault: 'Buried Vault', camp: 'Abandoned Camp', shrine: 'Umbral Shrine', cairn: 'Sky Cairn', village: 'Hollowstead', nest: 'Gloom Nest', circle: 'Sunwell Circle', forge: 'Ash Forge', bog: 'Bog Hut', caravan: 'Frozen Caravan' };

  // ---------- Wildlands ----------
  function WildGen(seed) {
    const N = i => new LL.Simplex(seed * 31 + i * 1013);
    const nC = N(1), nT = N(2), nM = N(3), nH = N(4), nD = N(5), nR = N(6), nA = N(7), nB = N(8), nV = N(9), nCl = N(10);
    const SEA = this.sea = 44;
    const column = this.column = function (x, z) {
      const c = fbm2(nC, x / 720, z / 720, 4);
      const t = fbm2(nT, x / 640 + 31.7, z / 640 - 17.3, 3);
      const m = fbm2(nM, x / 520 - 50.1, z / 520 + 90.4, 3);
      const hills = fbm2(nH, x / 170, z / 170, 4);
      const det = fbm2(nD, x / 38, z / 38, 3);
      let r = 1 - Math.abs(nR.noise2D(x / 250, z / 250)); r = r * r * r;
      const mount = clamp((-t - 0.1) * 3, 0, 1) * 0.9 + clamp((hills - 0.12) * 2.2, 0, 1) * 0.7;
      let h = 49 + c * 20 + hills * 9 + det * 2.5 + r * mount * 30;
      if (c < -0.08) h -= (-0.08 - c) * 45;
      const mire = sstep(0.17, 0.3, m) * sstep(-0.3, -0.2, t) * sstep(-0.12, 0.0, c);
      h = h * (1 - mire * 0.85) + (SEA + 1 + det * 1.6) * mire * 0.85;
      const hi = Math.max(4, Math.min(H - 10, Math.floor(h)));
      let b;
      if (hi < SEA - 1) b = BIO.OCEAN;
      else if (hi <= SEA + 1 && mire < 0.5) b = BIO.BEACH;
      else if (t < -0.2) b = BIO.PINE;
      else if (t > 0.2 && m < 0) b = BIO.ASH;
      else if (mire > 0.5) b = BIO.MIRE;
      else if (m < -0.22) b = BIO.SHARD;
      else if (t > 0.04) b = BIO.ROSE;
      else b = BIO.MEADOW;
      return { h: hi, b };
    };
    this.generate = function (ch) {
      const cx = ch.cx, cz = ch.cz, bl = ch.blocks, cols = new Array(CA);
      const rng = LL.mulberry32(chash(cx, cz, seed));
      for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
        const wx = cx * CS + lx, wz = cz * CS + lz;
        const col = column(wx, wz); cols[lx + lz * CS] = col;
        const h = col.h, b = col.b;
        let top, fill;
        switch (b) {
          case BIO.OCEAN: top = nCl.noise2D(wx / 30, wz / 30) > 0.35 ? B.CLAY : B.SAND; fill = B.SAND; break;
          case BIO.BEACH: top = B.SAND; fill = B.SAND; break;
          case BIO.PINE: top = B.SNOWY_TURF; fill = B.LOAM; break;
          case BIO.ASH: top = B.ASH; fill = B.ASH; break;
          case BIO.MIRE: top = h <= SEA ? B.MUD : B.MIRE_TURF; fill = B.MUD; break;
          default: top = B.TURF; fill = B.LOAM;
        }
        if (h > 76 && b !== BIO.ASH) { top = (b === BIO.PINE || h > 83) ? B.SNOW : B.SLATE; fill = B.SLATE; }
        if (h < SEA && b !== BIO.OCEAN && b !== BIO.MIRE) { top = B.SAND; fill = B.SAND; }
        let i = lx + lz * CS;
        const yMax = Math.max(h, SEA);
        for (let y = 0; y <= yMax; y++, i += CA) {
          let id;
          if (y === 0) id = B.CORESTONE;
          else if (y < 3) id = rng() < 0.5 ? B.CORESTONE : B.SLATE;
          else if (y < h - 3) id = (b === BIO.ASH && y > h - 12) ? B.BASALT : B.SLATE;
          else if (y < h) id = (b === BIO.MIRE && y < h - 1) ? B.PEAT : fill;
          else if (y === h) id = top;
          else id = (b === BIO.PINE && y === SEA) ? B.ICE : B.WATER;
          bl[i] = id;
        }
        const protect = h <= SEA + 2 ? h - 6 : h + 1;
        for (let y = 4; y <= h && y < protect; y++) {
          const a = nA.noise3D(wx / 46, y / 22, wz / 46);
          let carve = false;
          if (a > -0.12 && a < 0.12) { const b2 = nB.noise3D(wx / 46, y / 22, wz / 46); if (a * a + b2 * b2 < 0.013) carve = true; }
          if (!carve && y < 36 && nV.noise3D(wx / 72, y / 28, wz / 72) > 0.58) carve = true;
          if (carve) bl[lx + lz * CS + y * CA] = 0;
        }
      }
      veins(bl, rng, B.CINDER_ORE, 9, 6, 72, 7, B.SLATE);
      veins(bl, rng, B.COPPER_ORE, 7, 4, 54, 5, B.SLATE);
      veins(bl, rng, B.EMBER_ORE, 3, 3, 21, 4, B.SLATE);
      if (cols[136].b === BIO.ASH) { veins(bl, rng, B.CINDER_ORE, 8, 30, 80, 6, B.SLATE); veins(bl, rng, B.COPPER_ORE, 3, 30, 70, 5, B.SLATE); }
      for (let k = 0; k < 24; k++) {
        const x = rng() * 16 | 0, z = rng() * 16 | 0;
        for (let y = 5; y < 34; y++) { const j = x + z * CS + y * CA; if (bl[j] === B.SLATE && bl[j + CA] === 0) { if (rng() < 0.3) bl[j] = B.LUMITE; break; } }
      }
      // trees (including those overhanging from neighbouring chunks)
      const put = makePut(ch);
      for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        const r = LL.mulberry32(chash(ncx, ncz, seed + 77));
        for (let a = 0; a < 12; a++) {
          const lx = r() * 16 | 0, lz = r() * 16 | 0, roll = r(), st = (r() * 1e9) | 0;
          const wx = ncx * 16 + lx, wz = ncz * 16 + lz;
          const col = (ncx === cx && ncz === cz) ? cols[lx + lz * CS] : column(wx, wz);
          if (col.h <= SEA || col.h > 80) continue;
          if (roll >= (TREE_DENS[col.b] || 0)) continue;
          TREES[col.b](wx, col.h + 1, wz, LL.mulberry32(st), put);
        }
      }
      // ground plants
      const pr = LL.mulberry32(chash(cx, cz, seed + 555));
      ch._ruin = this.ruinAt(cx, cz);
      for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
        const col = cols[lx + lz * CS], v = pr();
        if (col.h <= SEA || col.h + 1 >= H) continue;
        const j = lx + lz * CS + (col.h + 1) * CA;
        if (bl[j] !== 0) continue;
        const below = bl[j - CA];
        if (!(below === B.TURF || below === B.MIRE_TURF || below === B.SNOWY_TURF || below === B.ASH)) continue;
        let id = 0;
        switch (col.b) {
          case BIO.MEADOW: id = v < 0.13 ? B.TALLGRASS : v < 0.15 ? B.EMBERBLOOM : v < 0.157 ? B.BERRY_BUSH : 0; break;
          case BIO.ROSE: id = v < 0.18 ? B.TALLGRASS : v < 0.22 ? B.BERRY_BUSH : v < 0.24 ? B.EMBERBLOOM : 0; break;
          case BIO.PINE: id = v < 0.03 ? B.FROSTBELL : v < 0.05 ? B.TALLGRASS : 0; break;
          case BIO.ASH: id = v < 0.04 ? B.DEAD_SHRUB : 0; break;
          case BIO.MIRE: id = v < 0.2 ? B.TALLGRASS : v < 0.235 ? B.GLOWCAP : 0; break;
          case BIO.SHARD: id = v < 0.06 ? B.TALLGRASS : v < 0.065 ? B.BERRY_BUSH : 0; break;
        }
        if (id) bl[j] = id;
      }
      if (ch._ruin) buildRuin(ch, ch._ruin);
    };
    this.ruinAt = function (cx, cz) {
      const r = ruinRng(cx, cz, seed);
      if (r() > 0.085) return null;
      const tr = r(), sd = (r() * 1e9) | 0;
      const col = column(cx * CS + 8, cz * CS + 8);
      const bio = col.b, h = col.h;
      if (col.h > 78 || bio === BIO.OCEAN || bio === BIO.BEACH) return null;
      let type;
      if (bio === BIO.ASH && tr < 0.45) type = 'forge';
      else if (bio === BIO.MIRE && tr < 0.45) type = 'bog';
      else if (bio === BIO.PINE && tr < 0.4) type = 'caravan';
      else {
        const t2 = (tr * 7.31) % 1;
        type = t2 < 0.2 ? 'tower' : t2 < 0.35 ? 'vault' : t2 < 0.47 ? 'camp' : t2 < 0.65 ? ((bio === BIO.MEADOW || bio === BIO.ROSE || bio === BIO.SHARD) ? 'village' : 'tower') : t2 < 0.84 ? 'nest' : 'circle';
      }
      if (type === 'bog') { const base = Math.max(h, SEA); return { type, h, base, y: base + 4, x: cx * CS + 9, z: cz * CS + 9, seed: sd }; }
      if (col.h <= SEA + 1) return null;
      const X = cx * CS, Z = cz * CS;
      if (type === 'village') return { type, h, y: h + 1, x: X + 3, z: Z + 3, seed: sd, stall: { x: X + 12, y: h + 1, z: Z + 8 } };
      if (type === 'nest') return { type, h, y: h - 4, x: X + 8, z: Z + 8, seed: sd, rift: { x: X + 8, y: h - 3, z: Z + 8 } };
      if (type === 'circle') return { type, h, y: h, x: X + 8, z: Z + 8, seed: sd, noCache: true };
      if (type === 'forge') return { type, h, y: h + 1, x: X + 11, z: Z + 6, seed: sd };
      if (type === 'caravan') return { type, h, y: h + 2, x: X + 5, z: Z + 7, seed: sd };
      if (type === 'vault') { const y0 = Math.max(8, h - 14); return { type, h, y: y0, x: cx * CS + 8, z: cz * CS + 6, seed: sd }; }
      if (type === 'camp') return { type, h, y: h + 1, x: cx * CS + 11, z: cz * CS + 8, seed: sd };
      return { type, h, y: h + 1, x: cx * CS + 8, z: cz * CS + 8, seed: sd };
    };
    this.findSpawn = function () {
      for (let r = 0; r < 4000; r += 8) {
        for (let a = 0; a < 16; a++) {
          const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
          const c = column(x, z);
          if ((c.b === BIO.MEADOW || c.b === BIO.ROSE) && c.h > SEA + 2 && c.h < 70) return { x: x + 0.5, z: z + 0.5 };
        }
      }
      return { x: 0.5, z: 0.5 };
    };
  }

  // ---------- The Gloam ----------
  function GloamGen(seed) {
    const N = i => new LL.Simplex(seed * 17 + i * 911);
    const nF = N(1), nD = N(2), nC = N(3), n3 = N(4), nP = N(5);
    const WL = this.sea = 13;
    const column = this.column = (x, z) => {
      const f = Math.floor(19 + fbm2(nF, x / 90, z / 90, 3) * 13 + fbm2(nD, x / 24, z / 24, 2) * 2.5);
      const c = Math.floor(76 + fbm2(nC, x / 80, z / 80, 3) * 14);
      return { h: f, c: Math.max(f + 10, Math.min(H - 4, c)), b: BIO.GLOAM, pillar: nP.noise2D(x / 26, z / 26) > 0.74 };
    };
    this.generate = function (ch) {
      const cx = ch.cx, cz = ch.cz, bl = ch.blocks, cols = new Array(CA);
      const rng = LL.mulberry32(chash(cx, cz, seed));
      for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
        const wx = cx * CS + lx, wz = cz * CS + lz;
        const col = column(wx, wz); cols[lx + lz * CS] = col;
        let i = lx + lz * CS;
        for (let y = 0; y < H; y++, i += CA) {
          let id = 0;
          if (y === 0 || y >= H - 1) id = B.CORESTONE;
          else if (y <= col.h || y >= col.c || col.pillar) id = B.GLOAMROCK;
          else if (n3.noise3D(wx / 38, y / 24, wz / 38) > 0.52) id = B.GLOAMROCK;
          else if (y <= WL) id = B.WATER;
          bl[i] = id;
        }
      }
      for (let i = CA; i < CA * (H - 2); i++) if (bl[i] === B.GLOAMROCK && bl[i + CA] === 0) bl[i] = B.MYCEL;
      veins(bl, rng, B.VOID_ORE, 4, 12, 85, 3, B.GLOAMROCK);
      veins(bl, rng, B.EMBER_ORE, 5, 5, 85, 4, B.GLOAMROCK);
      veins(bl, rng, B.CINDER_ORE, 5, 5, 85, 6, B.GLOAMROCK);
      veins(bl, rng, B.COPPER_ORE, 3, 5, 85, 5, B.GLOAMROCK);
      const put = makePut(ch);
      for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        const r = LL.mulberry32(chash(ncx, ncz, seed + 91));
        for (let a = 0; a < 7; a++) {
          const lx = r() * 16 | 0, lz = r() * 16 | 0, roll = r(), st = (r() * 1e9) | 0;
          const wx = ncx * 16 + lx, wz = ncz * 16 + lz;
          const col = (ncx === cx && ncz === cz) ? cols[lx + lz * CS] : column(wx, wz);
          if (col.h <= WL || col.pillar || roll > 0.32) continue;
          const tr = LL.mulberry32(st);
          const room = col.c - col.h - 4;
          const h = Math.min(room - 3, 4 + (tr() * 7 | 0)); if (h < 3) continue;
          const R = 2 + (tr() * 3 | 0), y = col.h + 1;
          for (let i = 0; i < h; i++) put(wx, y + i, wz, B.SHROOM_STEM);
          for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d <= R && d > R - 1.4) put(wx + dx, y + h - 1, wz + dz, B.SHROOM_CAP, true);
            if (d <= R - 0.5) put(wx + dx, y + h, wz + dz, B.SHROOM_CAP, true);
            if (d <= R - 1.6) put(wx + dx, y + h + 1, wz + dz, B.SHROOM_CAP, true);
          }
        }
      }
      const pr = LL.mulberry32(chash(cx, cz, seed + 5));
      for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
        const col = cols[lx + lz * CS], v = pr();
        const j = lx + lz * CS + (col.h + 1) * CA;
        if (col.h > WL && bl[j] === 0 && bl[j - CA] === B.MYCEL && v < 0.06) bl[j] = B.GLOWCAP;
        if (v > 0.985) { for (let y = col.c - 1; y > col.h + 3; y--) { const k = lx + lz * CS + y * CA; if (bl[k] === 0 && bl[k + CA] !== 0) { bl[k] = B.SPORE_LAMP; break; } } }
      }
      const ru = this.ruinAt(cx, cz);
      if (ru) buildRuin(ch, ru);
    };
    this.ruinAt = function (cx, cz) {
      const r = ruinRng(cx, cz, seed);
      if (r() > 0.12) return null;
      const sd = (r() * 1e9) | 0;
      const col = column(cx * CS + 8, cz * CS + 8);
      if (col.h <= WL + 1 || col.pillar || col.c - col.h < 10) return null;
      return { type: 'shrine', h: col.h, y: col.h + 1, x: cx * CS + 8, z: cz * CS + 8, seed: sd, wall: B.GLOAM_BRICKS };
    };
    this.findSpawn = () => ({ x: 0.5, z: 0.5 });
  }

  // ---------- Skyreach ----------
  function SkyGen(seed) {
    const N = i => new LL.Simplex(seed * 13 + i * 577);
    const nC = N(1), nS = N(2), n3 = N(3), nI = N(4);
    this.sea = -100;
    const colInfo = (x, z) => {
      const center = 50 + nC.noise2D(x / 180, z / 180) * 14;
      const spread = 11 + (nS.noise2D(x / 120, z / 120) + 1) * 6;
      let mask = fbm2(nI, x / 140, z / 140, 3);
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 48) mask += (1 - dist / 48) * 0.7;
      return { center, spread, mask };
    };
    const dens = (ci, x, y, z) => {
      const dy = (y - ci.center) / ci.spread;
      const pen = dy > 0 ? dy * dy * 3.2 : dy * dy * 0.7;
      return n3.noise3D(x / 55, y / 30, z / 55) * 0.55 + (ci.mask - 0.05) * 1.4 - pen;
    };
    let S = 52;
    { const ci = colInfo(0, 0); for (let y = 90; y > 10; y--) if (dens(ci, 0, y, 0) > 0.15) { S = y + 1; break; } }
    this.shrineY = S;
    this.column = (x, z) => ({ h: S, b: BIO.SKY });
    this.generate = function (ch) {
      const cx = ch.cx, cz = ch.cz, bl = ch.blocks;
      const rng = LL.mulberry32(chash(cx, cz, seed));
      for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
        const wx = cx * CS + lx, wz = cz * CS + lz;
        const ci = colInfo(wx, wz);
        const y0 = Math.max(2, Math.floor(ci.center - ci.spread * 2.2)), y1 = Math.min(H - 2, Math.ceil(ci.center + ci.spread * 0.9));
        for (let y = y0; y <= y1; y++) if (dens(ci, wx, y, wz) > 0.15) bl[lx + lz * CS + y * CA] = B.CLOUDSTONE;
      }
      for (let i = 0; i < CA * (H - 1); i++) if (bl[i] === B.CLOUDSTONE && bl[i + CA] === 0) bl[i] = B.SKYGRASS;
      veins(bl, rng, B.SUN_ORE, 5, 15, 85, 3, B.CLOUDSTONE);
      const put = makePut(ch);
      for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        const r = LL.mulberry32(chash(ncx, ncz, seed + 31));
        for (let a = 0; a < 6; a++) {
          const lx = r() * 16 | 0, lz = r() * 16 | 0, roll = r(), st = (r() * 1e9) | 0;
          const wx = ncx * 16 + lx, wz = ncz * 16 + lz;
          if (roll > 0.3 || (Math.abs(wx) < 12 && Math.abs(wz) < 12)) continue;
          const ci = colInfo(wx, wz);
          let top = -1;
          for (let y = Math.min(H - 2, Math.ceil(ci.center + ci.spread)); y > ci.center - ci.spread; y--) if (dens(ci, wx, y, wz) > 0.15) { top = y; break; }
          if (top < 0 || dens(ci, wx, top - 2, wz) <= 0.15) continue;
          const tr = LL.mulberry32(st), h = 5 + (tr() * 3 | 0);
          for (let i = 1; i <= h; i++) put(wx, top + i, wz, B.AUR_LOG);
          blob(put, wx, top + h, wz, 2.6, B.AUR_LEAVES, tr);
        }
      }
      const pr = LL.mulberry32(chash(cx, cz, seed + 8));
      for (let i = 0; i < CA * (H - 1); i++) if (bl[i] === B.SKYGRASS && bl[i + CA] === 0) { const v = pr(); if (v < 0.1) bl[i + CA] = B.TALLGRASS; else if (v < 0.13) bl[i + CA] = B.WINDBLOOM; }
      const ru = this.ruinAt(cx, cz);
      if (ru) buildRuin(ch, ru);
      // the Dawn Shrine
      if (cx >= -1 && cx <= 0 && cz >= -1 && cz <= 0) {
        for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
          const wx = cx * CS + lx, wz = cz * CS + lz, d = Math.sqrt(wx * wx + wz * wz);
          if (d > 9.5) continue;
          for (let y = S - 6; y < S + 12; y++) {
            const j = lx + lz * CS + y * CA;
            if (y < S - 1) { if (d < 9.5 - (S - 1 - y) * 0.9) bl[j] = B.CLOUDSTONE; }
            else if (y === S - 1) bl[j] = d < 7.5 ? B.SHRINE : B.SKYGRASS;
            else bl[j] = 0;
          }
          const ang = Math.atan2(wz, wx);
          const seg = Math.round(ang / (Math.PI / 4));
          if (Math.abs(d - 6.5) < 0.6 && Math.abs(ang - seg * Math.PI / 4) < 0.08) {
            for (let y = S; y < S + 4; y++) bl[lx + lz * CS + y * CA] = B.SHRINE;
            bl[lx + lz * CS + (S + 4) * CA] = B.LANTERN;
          }
          if (wx === 0 && wz === 0) bl[lx + lz * CS + S * CA] = B.ALTAR;
        }
      }
    };
    this.findSpawn = () => ({ x: 0.5, z: -2.5 });
    this.ruinAt = function (cx, cz) {
      if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) return null;
      const r = ruinRng(cx, cz, seed);
      if (r() > 0.12) return null;
      const sd = (r() * 1e9) | 0;
      const x = cx * CS + 8, z = cz * CS + 8, ci = colInfo(x, z);
      let top = -1;
      for (let y = Math.min(H - 8, Math.ceil(ci.center + ci.spread)); y > ci.center - ci.spread; y--) if (dens(ci, x, y, z) > 0.15) { top = y; break; }
      if (top < 0 || dens(ci, x, top - 3, z) <= 0.15) return null;
      return { type: 'cairn', h: top, y: top + 1, x, z, seed: sd };
    };
  }

  LL.DIMS = {
    wild: { name: 'The Wildlands', sky: true, grav: 1, Gen: WildGen, salt: 0 },
    gloam: { name: 'The Gloam', sky: false, grav: 1, Gen: GloamGen, salt: 7771 },
    sky: { name: 'Skyreach', sky: true, grav: 0.62, Gen: SkyGen, salt: 4242 },
  };

  // ---------- meshing ----------
  const PAD = 14, RW = CS + 2 * PAD, RA = RW * RW, RN = RA * (H + 2);
  const rIds = new Uint8Array(RN), rSky = new Uint8Array(RN), rBlk = new Uint8Array(RN), Q = new Int32Array(RN);
  const SHADE = [0.74, 0.74, 1, 0.52, 0.87, 0.87];
  const AOF = [0.4, 0.62, 0.81, 1];
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const AOFF = [1, RA, RW];
  const FACES = DIRS.map((n) => {
    const a = n[0] ? 0 : n[1] ? 1 : 2, s = n[a];
    let U, V; if (a === 0) { U = 2; V = 1; } else if (a === 1) { U = 0; V = 2; } else { U = 0; V = 1; }
    const e = k => [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0];
    const eU = e(U), eV = e(V);
    const cr = [eU[1] * eV[2] - eU[2] * eV[1], eU[2] * eV[0] - eU[0] * eV[2], eU[0] * eV[1] - eU[1] * eV[0]];
    return { a, s, U, V, flip: cr[a] * s < 0, offA: AOFF[a] * s, offU: AOFF[U], offV: AOFF[V] };
  });

  function bfs(L, qh, qt, top) {
    const maxLayer = top + 1;
    while (qh !== qt) {
      const i = Q[qh++]; if (qh === RN) qh = 0;
      const v = L[i] - 1; if (v <= 0) continue;
      const layer = (i / RA) | 0, r = i - layer * RA, rz = (r / RW) | 0, rx = r - rz * RW;
      for (let n = 0; n < 6; n++) {
        let j;
        switch (n) {
          case 0: if (rx >= RW - 1) continue; j = i + 1; break;
          case 1: if (rx <= 0) continue; j = i - 1; break;
          case 2: if (rz >= RW - 1) continue; j = i + RW; break;
          case 3: if (rz <= 0) continue; j = i - RW; break;
          case 4: if (layer >= maxLayer) continue; j = i + RA; break;
          default: if (layer <= 1) continue; j = i - RA;
        }
        const id = rIds[j];
        if (OPQ[id]) continue;
        const nv = v - ATT[id];
        if (nv > L[j]) { L[j] = nv; Q[qt++] = j; if (qt === RN) qt = 0; }
      }
    }
  }

  function newGroup() { return { pos: [], uv: [], lt: [], sh: [], idx: [] }; }

  function buildChunkMesh(world, ch) {
    const cx = ch.cx, cz = ch.cz;
    const nb = new Array(9);
    let maxY = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = world.ensureChunk(cx + dx, cz + dz); nb[(dz + 1) * 3 + dx + 1] = c; if (c.maxY > maxY) maxY = c.maxY; }
    const top = Math.min(H - 1, maxY + 1);
    for (let rz = 0; rz < RW; rz++) {
      const wz = rz - PAD, ncz = wz < 0 ? 0 : wz >= CS ? 2 : 1, lz = wz - (ncz - 1) * CS;
      for (let rx = 0; rx < RW; rx++) {
        const wx = rx - PAD, ncx = wx < 0 ? 0 : wx >= CS ? 2 : 1, lx = wx - (ncx - 1) * CS;
        const src = nb[ncz * 3 + ncx].blocks;
        let si = lx + lz * CS, di = rx + rz * RW + RA;
        for (let y = 0; y <= top; y++) { rIds[di] = src[si]; si += CA; di += RA; }
        rIds[di] = 0;
        rIds[rx + rz * RW] = B.CORESTONE;
      }
    }
    const used = RA * (top + 3);
    rSky.fill(0, 0, used); rBlk.fill(0, 0, used);
    let qt = 0;
    if (world.dim.sky) {
      for (let c = 0; c < RA; c++) {
        rSky[c + (top + 2) * RA] = 15;
        for (let L = top + 1; L >= 1; L--) { const i = c + L * RA; if (rIds[i] !== 0) break; rSky[i] = 15; Q[qt++] = i; }
      }
      bfs(rSky, 0, qt, top);
    }
    qt = 0;
    for (let i = RA; i < RA * (top + 2); i++) { const e = EMIT[rIds[i]]; if (e) { rBlk[i] = e; Q[qt++] = i; } }
    if (qt) bfs(rBlk, 0, qt, top);

    // store light for gameplay queries
    if (!ch.light) ch.light = new Uint8Array(CA * H);
    const lt = ch.light;
    for (let y = 0; y <= top; y++) for (let lz = 0; lz < CS; lz++) {
      let ri = PAD + (lz + PAD) * RW + (y + 1) * RA, li = lz * CS + y * CA;
      for (let lx = 0; lx < CS; lx++, ri++, li++) lt[li] = (rSky[ri] << 4) | rBlk[ri];
    }
    ch.lightTop = top;

    const G = [newGroup(), newGroup(), newGroup()];
    const aos = [0, 0, 0, 0], p = [0, 0, 0];
    for (let y = 0; y <= ch.maxY; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const ri = (lx + PAD) + (lz + PAD) * RW + (y + 1) * RA;
      const id = rIds[ri]; if (!id) continue;
      const rt = RT[id];
      if (rt === 3) {
        const g = G[1], base = g.pos.length / 3, tile = TSIDE[id];
        const tu = (tile % 16) / 16, tv = Math.floor(tile / 16);
        const sl = rSky[ri] / 15, bl = Math.max(rBlk[ri], EMIT[id]) / 15;
        const q = [[0.15, 0.15, 0.85, 0.85], [0.85, 0.15, 0.15, 0.85]];
        for (const [a0, b0, a1, b1] of q) {
          const b = g.pos.length / 3;
          g.pos.push(lx + a0, y, lz + b0, lx + a1, y, lz + b1, lx + a1, y + 1, lz + b1, lx + a0, y + 1, lz + b0);
          const u0 = tu + 0.001, u1 = tu + 1 / 16 - 0.001, v0 = 1 - (tv + 1) / 16 + 0.001, v1 = 1 - tv / 16 - 0.001;
          g.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let k = 0; k < 4; k++) { g.lt.push(sl, bl); g.sh.push(0.92); }
          g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        continue;
      }
      const g = rt === 4 ? G[2] : rt === 2 ? G[1] : G[0];
      const em = EMIT[id];
      for (let d = 0; d < 6; d++) {
        const F = FACES[d], ni = ri + F.offA, nid = rIds[ni];
        if (OPQ[nid]) continue;
        if (rt === 4) { if (RT[nid] === 4) continue; }
        else if (rt === 2) { if (nid === id && !LEAFY[id]) continue; }
        const tile = d === 2 ? TTOP[id] : d === 3 ? TBOT[id] : TSIDE[id];
        const tcol = tile % 16, trow = Math.floor(tile / 16);
        const base = g.pos.length / 3;
        const lowerTop = rt === 4 && RT[rIds[ri + RA]] !== 4;
        for (let c = 0; c < 4; c++) {
          const u = (c === 1 || c === 2) ? 1 : 0, v = c >= 2 ? 1 : 0;
          p[0] = lx; p[1] = y; p[2] = lz;
          if (F.s > 0) p[F.a] += 1;
          p[F.U] += u; p[F.V] += v;
          let py = p[1];
          if (lowerTop && py === y + 1) py -= 0.12;
          let ao = 3, sl, bl;
          if (rt === 4) { sl = rSky[ni]; bl = rBlk[ni]; }
          else {
            const du = u ? F.offU : -F.offU, dv = v ? F.offV : -F.offV;
            const s1 = ni + du, s2 = ni + dv, s3 = ni + du + dv;
            const o1 = OPQ[rIds[s1]], o2 = OPQ[rIds[s2]], o3 = OPQ[rIds[s3]];
            ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + o3);
            let cnt = 1; sl = rSky[ni]; bl = rBlk[ni];
            if (!o1) { sl += rSky[s1]; bl += rBlk[s1]; cnt++; }
            if (!o2) { sl += rSky[s2]; bl += rBlk[s2]; cnt++; }
            if (!o3 && !(o1 && o2)) { sl += rSky[s3]; bl += rBlk[s3]; cnt++; }
            sl /= cnt; bl /= cnt;
          }
          if (em > bl) bl = em;
          g.pos.push(p[0], py, p[2]);
          g.uv.push((tcol + 0.002 + u * 0.996) / 16, 1 - (trow + 1 - (0.002 + v * 0.996)) / 16);
          g.lt.push(sl / 15, bl / 15);
          g.sh.push(SHADE[d] * AOF[ao]);
          aos[c] = ao;
        }
        const alt = aos[0] + aos[2] < aos[1] + aos[3];
        let t;
        if (!alt) t = F.flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
        else t = F.flip ? [1, 3, 2, 1, 0, 3] : [1, 2, 3, 1, 3, 0];
        for (let k = 0; k < 6; k++) g.idx.push(base + t[k]);
      }
    }
    // swap meshes
    world.removeMeshes(ch);
    const mats = LL.mats;
    const list = [];
    [[G[0], mats.opaque], [G[1], mats.cutout], [G[2], mats.water]].forEach(([g, mat], gi) => {
      if (!g.pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('light', new THREE.Float32BufferAttribute(g.lt, 2));
      geo.setAttribute('shade', new THREE.Float32BufferAttribute(g.sh, 1));
      geo.setIndex(g.idx);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(cx * CS, 0, cz * CS);
      m.matrixAutoUpdate = false; m.updateMatrix();
      if (gi === 2) m.renderOrder = 2;
      world.scene.add(m); list.push(m);
    });
    ch.meshes = list;
    ch.dirty = false;
  }

  // ---------- World ----------
  const SPIRAL = [];
  for (let z = -14; z <= 14; z++) for (let x = -14; x <= 14; x++) SPIRAL.push([x, z, x * x + z * z]);
  SPIRAL.sort((a, b) => a[2] - b[2]);

  class World {
    constructor(dimKey, seed, edits, scene) {
      this.key = dimKey; this.dim = LL.DIMS[dimKey];
      this.seed = (seed + this.dim.salt) | 0;
      this.gen = new this.dim.Gen(this.seed);
      this.chunks = new Map();
      this.edits = edits;
      this.scene = scene;
      this.soon = [];
      this._lk = -1; this._lc = null;
    }
    getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
    ensureChunk(cx, cz) {
      const k = ckey(cx, cz);
      let c = this.chunks.get(k);
      if (!c) {
        c = new Chunk(cx, cz);
        this.gen.generate(c);
        const e = this.edits[cx + ',' + cz];
        if (e) for (const i in e) c.blocks[+i] = e[i];
        c.calcMaxY();
        this.chunks.set(k, c);
      }
      return c;
    }
    getBlock(x, y, z) {
      if (y < 0 || y >= H) return 0;
      const cx = x >> 4, cz = z >> 4, k = ckey(cx, cz);
      let c;
      if (k === this._lk) c = this._lc; else { c = this.chunks.get(k); this._lk = k; this._lc = c; }
      if (!c) return 0;
      return c.blocks[(x & 15) + (z & 15) * CS + y * CA];
    }
    isLoaded(x, z) { const c = this.getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4); return !!(c && c.meshes); }
    setBlock(x, y, z, id, remote) {
      if (y < 0 || y >= H) return;
      const cx = x >> 4, cz = z >> 4, ch = this.ensureChunk(cx, cz);
      const lx = x & 15, lz = z & 15, i = lx + lz * CS + y * CA;
      const old = ch.blocks[i];
      if (old === id) return;
      ch.blocks[i] = id;
      if (id && y > ch.maxY) ch.maxY = y;
      const k = cx + ',' + cz;
      (this.edits[k] || (this.edits[k] = {}))[i] = id;
      if (!remote && this.onSet) this.onSet(x, y, z, id);
      ch.dirty = true;
      buildChunkMesh(this, ch);
      const lightish = EMIT[old] || EMIT[id];
      const opChange = OPQ[old] !== OPQ[id];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const distX = dx < 0 ? lx : dx > 0 ? 15 - lx : 0, distZ = dz < 0 ? lz : dz > 0 ? 15 - lz : 0;
        const dist = Math.max(distX, distZ);
        if (dist <= 1 || (lightish && dist < 15) || (opChange && dist < 7)) {
          const n = this.getChunk(cx + dx, cz + dz);
          if (n && n.meshes) { n.dirty = true; if (this.soon.indexOf(n) < 0) this.soon.push(n); }
        }
      }
    }
    lightAt(x, y, z) {
      x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
      if (y >= H) return this.dim.sky ? 240 : 0;
      if (y < 0) return 0;
      const c = this.getChunk(x >> 4, z >> 4);
      if (!c || !c.light) return this.dim.sky ? 240 : 0;
      if (y > c.lightTop) return this.dim.sky ? 240 : 0;
      return c.light[(x & 15) + (z & 15) * CS + y * CA];
    }
    removeMeshes(ch) {
      if (!ch.meshes) return;
      for (const m of ch.meshes) { this.scene.remove(m); m.geometry.dispose(); }
      ch.meshes = null;
    }
    tick(px, pz, R, budget) {
      const t0 = performance.now();
      while (this.soon.length && performance.now() - t0 < budget * 0.5) {
        const c = this.soon.shift(); if (c.dirty && this.chunks.get(ckey(c.cx, c.cz)) === c) buildChunkMesh(this, c);
      }
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      let built = 0;
      for (const [dx, dz, d2] of SPIRAL) {
        if (d2 > R * R) break;
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (!c || !c.meshes || c.dirty) {
          buildChunkMesh(this, this.ensureChunk(pcx + dx, pcz + dz));
          built++;
          if (performance.now() - t0 > budget) break;
        }
      }
      if ((this._unloadT = (this._unloadT || 0) + 1) % 60 === 0) {
        for (const [k, c] of this.chunks) {
          const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
          if (d > R + 2 && c.meshes) this.removeMeshes(c);
          if (d > R + 5) { this.removeMeshes(c); this.chunks.delete(k); }
        }
        this._lk = -1;
      }
      return built;
    }
    readyAround(px, pz, r) {
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const c = this.getChunk(pcx + dx, pcz + dz); if (!c || !c.meshes) return false; }
      return true;
    }
    dispose() { for (const c of this.chunks.values()) this.removeMeshes(c); this.chunks.clear(); }
    surfaceAt(x, z) { for (let y = H - 1; y > 0; y--) if (SOLID[this.getBlock(x, y, z)]) return y; return -1; }
    biomeAt(x, z) { return this.gen.column(Math.floor(x), Math.floor(z)).b; }
  }
  LL.World = World;
  LL.buildChunkMesh = buildChunkMesh;

  // ---------- materials ----------
  LL.makeMaterials = function (atlasTex) {
    const U = LL.uni = {
      atlas: { value: atlasTex }, daylight: { value: 1 }, fogColor: { value: new THREE.Color(0x8fc0e8) },
      fogNear: { value: 40 }, fogFar: { value: 90 }, ambient: { value: 0.03 }, time: { value: 0 },
      skyTint: { value: new THREE.Color(1, 1, 1) }, blockTint: { value: new THREE.Color(1.0, 0.82, 0.58) }, gamma: { value: 1 },
    };
    const vs = `
      attribute vec2 light; attribute float shade;
      varying vec2 vUv; varying vec2 vLight; varying float vShade; varying float vFog;
      uniform float time; uniform float wave;
      void main(){
        vUv=uv; vLight=light; vShade=shade;
        vec3 p=position;
        vec4 wp=modelMatrix*vec4(p,1.0);
        if(wave>0.5){ wp.y += sin(time*1.6+wp.x*0.8+wp.z*0.6)*0.045 - 0.04; }
        vec4 mv=viewMatrix*wp; vFog=length(mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`;
    const fs = `
      uniform sampler2D atlas; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      uniform float ambient; uniform float alphaTest; uniform float opacity; uniform vec3 skyTint; uniform vec3 blockTint; uniform float gamma;
      varying vec2 vUv; varying vec2 vLight; varying float vShade; varying float vFog;
      float curve(float l){ return pow(0.8, (1.0-l)*15.0); }
      void main(){
        vec4 t=texture2D(atlas,vUv);
        if(t.a<alphaTest) discard;
        float s=curve(vLight.x)*daylight; float b=vLight.y>0.0?curve(vLight.y):0.0;
        vec3 lc=max(skyTint*s, blockTint*b*1.05) + vec3(ambient);
        lc=pow(lc, vec3(gamma));
        vec3 c=t.rgb*lc*vShade;
        float f=smoothstep(fogNear,fogFar,vFog);
        gl_FragColor=vec4(mix(c,fogColor,f), opacity<1.0? mix(opacity,1.0,f*0.5) : 1.0);
      }`;
    const mk = (extra, params) => new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({}, U, { alphaTest: { value: extra.alphaTest }, opacity: { value: extra.opacity }, wave: { value: extra.wave } }),
      vertexShader: vs, fragmentShader: fs,
    }, params));
    LL.mats = {
      opaque: mk({ alphaTest: 0, opacity: 1, wave: 0 }, {}),
      cutout: mk({ alphaTest: 0.5, opacity: 1, wave: 0 }, { side: THREE.DoubleSide }),
      water: mk({ alphaTest: 0, opacity: 0.72, wave: 1 }, { transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    };
    return LL.mats;
  };
  LL.bright = l => Math.pow(0.8, 15 - l);
})(window.LL);
