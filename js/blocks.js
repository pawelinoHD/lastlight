// Lastlight — procedural textures, blocks, items, recipes
'use strict';
(function (LL) {
  const TS = 16, AN = 16;
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = TS * AN;
  const actx = atlas.getContext('2d');
  LL.atlasCanvas = atlas;
  const T = LL.T = {};
  const TAVG = LL.TAVG = [];
  let tc = 0;

  function rgb(h) { if (Array.isArray(h)) return h; const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  LL.rgb = rgb;

  class P {
    constructor(seed) { this.d = new Uint8ClampedArray(TS * TS * 4); this.r = LL.mulberry32(seed * 9973 + 7); }
    rnd(a, b) { return a + (b - a) * this.r(); }
    ri(a, b) { return Math.floor(this.rnd(a, b + 1)); }
    set(x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= TS || y >= TS) return; const i = (y * TS + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a === undefined ? 255 : a; }
    get(x, y) { x = ((x % 16) + 16) % 16; y = ((y % 16) + 16) % 16; const i = (y * TS + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
    j(c, v) { c = rgb(c); const k = (this.r() - 0.5) * 2 * v; return [c[0] + k, c[1] + k, c[2] + k]; }
    fill(c, v = 10) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) this.set(x, y, this.j(c, v)); return this; }
    speck(c, p, v = 8) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (this.r() < p) this.set(x, y, this.j(c, v)); return this; }
    mul(x, y, f) { x = ((x % 16) + 16) % 16; y = ((y % 16) + 16) % 16; const c = this.get(x, y); this.set(x, y, [c[0] * f, c[1] * f, c[2] * f], c[3]); }
    clear() { this.d.fill(0); return this; }
  }

  function tile(name, fn) {
    const i = tc++;
    const p = new P(i + 1);
    fn(p);
    actx.putImageData(new ImageData(p.d, TS, TS), (i % AN) * TS, Math.floor(i / AN) * TS);
    let r = 0, g = 0, b = 0, n = 0;
    for (let k = 0; k < p.d.length; k += 4) if (p.d[k + 3] > 128) { r += p.d[k]; g += p.d[k + 1]; b += p.d[k + 2]; n++; }
    TAVG[i] = n ? [r / n, g / n, b / n] : [128, 128, 128];
    T[name] = i;
    return i;
  }

  // ---------- painters ----------
  const loam = p => p.fill('#6b4a2f', 12).speck('#523823', 0.18).speck('#8a6446', 0.07).speck('#a39484', 0.02);
  function band(p, c, depth, v = 10) {
    c = rgb(c);
    for (let x = 0; x < 16; x++) {
      const h = depth + (p.r() < 0.5 ? 1 : 0) + (p.r() < 0.25 ? 1 : 0);
      for (let y = 0; y < h; y++) p.set(x, y, p.j(c, v));
      p.set(x, h, p.j([c[0] * 0.72, c[1] * 0.72, c[2] * 0.72], 5));
    }
  }
  const slate = p => {
    p.fill('#5d6470', 6);
    for (let k = 0; k < 6; k++) {
      const y0 = p.ri(0, 15), br = p.ri(3, 12), f = p.r() < 0.6 ? 0.8 : 1.14;
      for (let x = 0; x < 16; x++) if (p.r() < 0.88) p.mul(x, y0 + (x > br ? 1 : 0), f);
    }
    p.speck('#4a505b', 0.07);
  };
  function cobble(p, stone, mortar) {
    p.fill(mortar, 5); stone = rgb(stone);
    for (let k = 0; k < 10; k++) {
      const cx = p.rnd(0, 16), cy = p.rnd(0, 16), r = p.rnd(2.2, 3.8);
      const col = p.j(stone, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const sx = ((x + 0.5 - cx + 24) % 16) - 8, sy = ((y + 0.5 - cy + 24) % 16) - 8;
        if (sx * sx + sy * sy < r * r) {
          let f = 1; if (sx + sy < -r * 0.7) f = 1.18; else if (sx + sy > r * 0.7) f = 0.78;
          p.set(x, y, p.j([col[0] * f, col[1] * f, col[2] * f], 5));
        }
      }
    }
  }
  function logSide(p, c) {
    p.fill(c, 7);
    for (let x = 0; x < 16; x++) if (x % 3 === 0 || p.r() < 0.12) for (let y = 0; y < 16; y++) if (p.r() < 0.85) p.mul(x, y, 0.78);
    for (let k = 0; k < 2; k++) { const x = p.ri(1, 13), y = p.ri(1, 13); p.mul(x, y, 0.6); p.mul(x + 1, y, 0.7); p.mul(x, y + 1, 0.7); }
  }
  function logTop(p, bark, inner, ring) {
    bark = rgb(bark); inner = rgb(inner); ring = rgb(ring);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const c = d > 6.4 ? bark : (Math.floor(d * 1.2) % 2 === 0 ? ring : inner);
      p.set(x, y, p.j(c, 6));
    }
  }
  function planks(p, c) {
    p.fill(c, 5);
    for (let y = 0; y < 16; y++) {
      const row = y >> 2;
      if ((y & 3) === 3) { for (let x = 0; x < 16; x++) p.mul(x, y, 0.66); continue; }
      p.mul((row * 7 + 3) % 16, y, 0.68);
    }
    for (let k = 0; k < 28; k++) { const x = p.ri(0, 15), y = p.ri(0, 15); if ((y & 3) !== 3) p.mul(x, y, p.r() < 0.5 ? 0.9 : 1.08); }
  }
  function leaves(p, c, hole = 0.3) {
    c = rgb(c);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (p.r() < hole) p.set(x, y, [0, 0, 0], 0);
      else { const f = p.r() < 0.15 ? 1.25 : (p.r() < 0.3 ? 0.78 : 1); p.set(x, y, p.j([c[0] * f, c[1] * f, c[2] * f], 14)); }
    }
  }
  function ore(p, base, light, main, n = 5) {
    base(p);
    for (let k = 0; k < n; k++) {
      let x = p.ri(1, 14), y = p.ri(1, 14);
      const sz = p.ri(2, 4);
      for (let m = 0; m < sz; m++) { p.set(x, y, p.j(m === 0 ? light : main, 10)); x += p.ri(-1, 1); y += p.ri(-1, 1); }
      p.set(x, y + 1, p.j([30, 30, 34], 4));
    }
  }
  function bricks(p, c, mortar, bw = 8, bh = 4) {
    p.fill(mortar, 5);
    for (let row = 0; row < 16 / bh; row++) {
      const off = (row % 2) * (bw / 2);
      for (let b = -1; b < 16 / bw + 1; b++) {
        const col = p.j(c, 14);
        for (let y = row * bh; y < row * bh + bh - 1; y++)
          for (let x = b * bw + off; x < b * bw + off + bw - 1; x++)
            if (x >= 0 && x < 16) p.set(x, y, p.j(col, 5));
      }
    }
  }
  function blades(p, cols, n = 10) {
    p.clear();
    for (let k = 0; k < n; k++) {
      const x = p.ri(1, 14), h = p.ri(5, 13), c = cols[k % cols.length], lean = p.rnd(-0.3, 0.3);
      for (let i = 0; i < h; i++) p.set(x + lean * i, 15 - i, p.j(c, 12));
    }
  }
  function flower(p, stem, petal, center) {
    blades(p, [stem], 4);
    const cx = p.ri(6, 9), cy = p.ri(4, 6);
    for (let y = 15; y > cy; y--) p.set(cx, y, rgb(stem));
    [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]].forEach(([dx, dy], i) => { if (i < 4 || p.r() < 0.5) p.set(cx + dx, cy + dy, p.j(petal, 14)); });
    p.set(cx, cy, rgb(center));
  }
  function frame(p, c, inset = 0) { c = rgb(c); for (let i = inset; i < 16 - inset; i++) { p.set(i, inset, c); p.set(i, 15 - inset, c); p.set(inset, i, c); p.set(15 - inset, i, c); } }
  const gloamrock = p => p.fill('#3a3246', 9).speck('#504466', 0.1).speck('#2a2434', 0.12);
  const cloudstone = p => { p.fill('#ece8de', 5); for (let k = 0; k < 6; k++) { const cx = p.ri(0, 15), cy = p.ri(0, 15), f = p.r() < 0.5 ? 0.93 : 1.04; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y < 5) p.mul(cx + x, cy + y, f); } };
  function rune(p, c) {
    p.fill('#706d78', 6); frame(p, '#55525c'); frame(p, '#8a8794', 1);
    c = rgb(c);
    const pts = [[7, 3], [8, 3], [6, 4], [9, 4], [5, 5], [10, 5], [4, 6], [11, 6], [4, 7], [11, 7], [4, 8], [11, 8], [5, 9], [10, 9], [6, 10], [9, 10], [7, 11], [8, 11]];
    pts.forEach(([x, y]) => p.set(x, y, c));
    for (let y = 5; y <= 9; y++) { p.set(7, y, [255, 255, 255]); p.set(8, y, c); }
  }

  // ---------- tiles ----------
  tile('loam', loam);
  tile('turf_top', p => p.fill('#4f8a3a', 10).speck('#64a24a', 0.25).speck('#3d7030', 0.18));
  tile('turf_side', p => { loam(p); band(p, '#4f8a3a', 3); });
  tile('slate', slate);
  tile('cobble', p => cobble(p, '#6c7380', '#3f434c'));
  tile('drift_side', p => logSide(p, '#8b7d6b'));
  tile('drift_top', p => logTop(p, '#6e6253', '#c9b48e', '#a8936e'));
  tile('drift_planks', p => planks(p, '#b39a73'));
  tile('drift_leaves', p => leaves(p, '#4a8a3c'));
  tile('rose_side', p => logSide(p, '#5a2c26'));
  tile('rose_top', p => logTop(p, '#4a221e', '#b0604c', '#8c4436'));
  tile('rose_planks', p => planks(p, '#a2503e'));
  tile('rose_leaves', p => leaves(p, '#c43a4a', 0.18));
  tile('frost_side', p => logSide(p, '#38404e'));
  tile('frost_top', p => logTop(p, '#2a3140', '#9aa8b8', '#728196'));
  tile('frost_planks', p => planks(p, '#7d8da0'));
  tile('frost_leaves', p => { leaves(p, '#2c6a66', 0.16); p.speck('#e8f4ff', 0.06, 6); });
  tile('sand', p => p.fill('#d9c68f', 9).speck('#c4ae76', 0.15).speck('#efe0b0', 0.08));
  tile('ash', p => p.fill('#8a8580', 10).speck('#5a5552', 0.14).speck('#c86032', 0.012, 20));
  tile('snow', p => p.fill('#eaf1f8', 5).speck('#cfdcec', 0.12));
  tile('snow_side', p => { loam(p); band(p, '#eaf1f8', 4, 5); });
  tile('ice', p => { p.fill('#9ccbef', 7); for (let k = 0; k < 3; k++) { let x = p.ri(0, 15), y = p.ri(0, 15); for (let i = 0; i < 7; i++) { p.set(x, y, [225, 240, 255]); x++; y += p.ri(-1, 1); } } });
  tile('water', p => { p.fill('#2d5fb0', 8); for (let k = 0; k < 6; k++) { const y = p.ri(0, 15), x0 = p.ri(0, 12); for (let x = x0; x < x0 + 4; x++) p.set(x, y, [90, 150, 220]); } });
  tile('mud', p => p.fill('#4a3a2c', 9).speck('#36291e', 0.2).speck('#6e6458', 0.04));
  tile('clay', p => p.fill('#96a0af', 6).speck('#8590a0', 0.15));
  tile('corestone', p => p.fill('#2a2830', 10).speck('#4e4a58', 0.2).speck('#141218', 0.2));
  tile('copper_ore', p => ore(p, slate, '#ffcf9a', '#d9803c', 6));
  tile('cinder_ore', p => ore(p, slate, '#ff6a2a', '#1c1614', 6));
  tile('ember_ore', p => ore(p, slate, '#fff0a0', '#ff8a1e', 5));
  // Lumite: a cracked geode with a cluster of mint-teal crystal prisms growing up from inside
  tile('lumite', p => {
    p.fill('#40444f', 6).speck('#33363f', 0.2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, (y - 8) * 1.1);
      if (d < 6.3) p.set(x, y, p.j([22, 30, 40], 4));
      else if (d < 7.2) p.set(x, y, p.j([78, 84, 98], 6));
    }
    const prisms = [[4, 4], [6, 8], [8, 10], [10, 7], [12, 4]];
    for (const [cx, h] of prisms) {
      for (let x = cx - 2; x <= cx + 2; x++) for (let y = 13 - h - 2; y <= 13; y++) { const c = p.get(x, y); if (c[0] < 40) p.set(x, y, [26, 64, 62]); }
    }
    for (const [cx, h] of prisms) {
      for (let i = 0; i < h; i++) {
        const y = 13 - i;
        p.set(cx - 1, y, [190, 255, 232]); p.set(cx, y, [96, 232, 196]); p.set(cx + 1, y, [38, 150, 136]);
      }
      p.set(cx - 1, 13 - h, [96, 232, 196]); p.set(cx, 13 - h, [235, 255, 248]); p.set(cx + 1, 13 - h, [60, 190, 170]);
      p.set(cx, 12 - h, [235, 255, 248]);
    }
  });
  // Shardstone: pale weathered stone with faint glowing hairline cracks (what Shardfields spires are made of)
  tile('shardstone', p => {
    p.fill('#a6a2b2', 7).speck('#8c889a', 0.16).speck('#c0bccc', 0.08);
    for (let k = 0; k < 3; k++) {
      let x = p.ri(1, 14), y = p.ri(0, 4);
      for (let i = 0; i < 12; i++) { p.set(x, y, [118, 226, 204]); if (p.r() < 0.5) p.set(x + 1, y, [84, 150, 146]); y++; x += p.ri(-1, 1); if (y > 15) break; }
    }
  });
  tile('lantern', p => {
    p.clear(); const fr = rgb('#3a3028');
    for (let y = 3; y < 13; y++) for (let x = 4; x < 12; x++) { const d = Math.hypot(x - 7.5, y - 7.5); p.set(x, y, d < 2.2 ? [255, 246, 205] : d < 3.6 ? [255, 205, 100] : [235, 140, 45]); }
    frame(p, fr); for (let i = 1; i < 15; i++) { p.set(i, 1, [96, 76, 54]); p.set(i, 14, [96, 76, 54]); }
    for (let y = 2; y < 14; y++) { p.set(3, y, fr); p.set(12, y, fr); }
  });
  tile('hearth_side', p => {
    cobble(p, '#7a6e66', '#3c3430');
    for (let y = 6; y < 16; y++) for (let x = 3; x < 13; x++) {
      const inArch = y > 8 || Math.hypot(x - 7.5, (y - 9) * 1.3) < 4.8;
      if (!inArch) continue;
      const f = (y - 6) / 10;
      p.set(x, y, y > 12 ? p.j([255, 120 + (p.r() * 90), 30], 20) : p.j([40 + f * 120, 18 + f * 30, 10], 10));
    }
  });
  tile('hearth_top', p => { cobble(p, '#7a6e66', '#3c3430'); for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) p.set(x, y, p.r() < 0.5 ? p.j([255, 110, 30], 30) : p.j([90, 30, 20], 20)); });
  tile('glass', p => { p.clear(); frame(p, '#cfe6ee'); p.set(4, 4, [255, 255, 255]); p.set(5, 3, [255, 255, 255]); p.set(3, 5, [255, 255, 255]); p.set(10, 11, [220, 240, 250]); p.set(11, 10, [220, 240, 250]); });
  tile('kiln_bricks', p => bricks(p, '#a8543a', '#cdb8a0'));
  tile('bench_top', p => { planks(p, '#9a7a52'); frame(p, '#5a4026'); for (let i = 3; i < 9; i++) p.set(i, 5, [150, 150, 160]); p.set(3, 4, [120, 120, 130]); p.set(3, 6, [120, 120, 130]); for (let i = 9; i < 13; i++) p.set(i, 10, [90, 60, 40]); p.set(12, 9, [170, 170, 180]); p.set(12, 11, [170, 170, 180]); });
  tile('bench_side', p => { planks(p, '#8a6a44'); for (let y = 0; y < 16; y++) { p.set(1, y, [70, 48, 28]); p.set(14, y, [70, 48, 28]); } for (let x = 4; x < 12; x++) p.set(x, 6, [60, 40, 24]); p.set(7, 8, [200, 170, 90]); p.set(8, 8, [200, 170, 90]); });
  tile('kiln_front', p => { bricks(p, '#a8543a', '#cdb8a0'); for (let y = 7; y < 14; y++) for (let x = 4; x < 12; x++) p.set(x, y, y > 10 ? p.j([255, 130, 40], 30) : p.j([40, 20, 14], 6)); });
  tile('kiln_top', p => { bricks(p, '#a8543a', '#cdb8a0'); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) p.set(x, y, p.j([30, 18, 14], 6)); });
  tile('gloamrock', gloamrock);
  tile('mycel_top', p => p.fill('#6e468c', 12).speck('#9664b4', 0.2).speck('#d8a8f0', 0.03));
  tile('mycel_side', p => { gloamrock(p); band(p, '#6e468c', 3, 12); });
  tile('stem', p => { p.fill('#d8cebc', 6); for (let x = 0; x < 16; x += 2) for (let y = 0; y < 16; y++) if (p.r() < 0.5) p.mul(x, y, 0.92); });
  tile('cap', p => { p.fill('#24a8a8', 12); for (let k = 0; k < 5; k++) { const cx = p.ri(1, 14), cy = p.ri(1, 14); for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x * x + y * y < 2) p.set(cx + x, cy + y, [175, 255, 240]); } });
  tile('void_ore', p => ore(p, gloamrock, '#c8a0ff', '#16101e', 6));
  tile('cloudstone', cloudstone);
  tile('skygrass_top', p => p.fill('#a6d897', 10).speck('#c4e8a8', 0.2).speck('#e8d878', 0.05));
  tile('skygrass_side', p => { cloudstone(p); band(p, '#a6d897', 3); });
  tile('sun_ore', p => ore(p, cloudstone, '#ffffff', '#ffb630', 6));
  tile('aur_side', p => { p.fill('#e8e2d2', 5); for (let k = 0; k < 9; k++) { const x = p.ri(0, 13), y = p.ri(0, 15); p.set(x, y, [60, 50, 40]); p.set(x + 1, y, [60, 50, 40]); if (p.r() < 0.4) p.set(x + 2, y, [210, 170, 70]); } });
  tile('aur_top', p => logTop(p, '#e8e2d2', '#f2e4b0', '#d4b870'));
  tile('aur_leaves', p => leaves(p, '#e2b440', 0.2));
  tile('way_gloam', p => rune(p, '#b070ff'));
  tile('way_sky', p => rune(p, '#ffc440'));
  tile('way_return', p => rune(p, '#60e890'));
  tile('shrine', p => bricks(p, '#ece2c4', '#d4ae58'));
  tile('altar', p => { bricks(p, '#ece2c4', '#d4ae58'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3) p.set(x, y, [120, 100, 70]); else if (d < 4) p.set(x, y, [212, 174, 88]); else if (d < 6.5 && (Math.round(Math.atan2(y - 7.5, x - 7.5) * 4 / Math.PI) % 2 === 0)) p.set(x, y, [200, 160, 70]); } });
  tile('altar_lit', p => { bricks(p, '#fff4d4', '#ffd060'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3) p.set(x, y, [255, 255, 230]); else if (d < 4.2) p.set(x, y, [255, 200, 80]); } });
  tile('tallgrass', p => blades(p, ['#5a9a40', '#4a8434', '#6cae4c'], 11));
  tile('emberbloom', p => flower(p, '#3e7a30', '#ff4a2a', '#ffd040'));
  tile('frostbell', p => flower(p, '#2e6a5e', '#7ac0ff', '#ffffff'));
  tile('bush', p => {
    p.clear();
    for (let y = 4; y < 16; y++) for (let x = 1; x < 15; x++) { const d = Math.hypot((x - 7.5) / 7, (y - 10.5) / 6); if (d < 1 && p.r() < 0.85) p.set(x, y, p.j('#2f6a2a', 18)); }
    for (let k = 0; k < 9; k++) { const x = p.ri(2, 12), y = p.ri(6, 14); p.set(x, y, [255, 140, 40]); p.set(x + 1, y, [220, 90, 20]); p.set(x, y - 1, [255, 210, 130]); }
  });
  tile('bare_bush', p => { p.clear(); for (let y = 4; y < 16; y++) for (let x = 1; x < 15; x++) { const d = Math.hypot((x - 7.5) / 7, (y - 10.5) / 6); if (d < 1 && p.r() < 0.6) p.set(x, y, p.j('#3a5a2a', 18)); } });
  tile('glowcap', p => { p.clear(); [[4, 9, 2], [10, 7, 3], [7, 11, 1.5]].forEach(([cx, cy, r]) => { for (let y = cy; y < 16; y++) p.set(cx, y, [220, 210, 190]); for (let y = -2; y <= 0; y++) for (let x = -r - 1; x <= r + 1; x++) if (Math.abs(x) <= r + 1 + y) p.set(cx + x, cy + y, p.j([70, 230, 220], 20)); }); });
  tile('dead_shrub', p => { p.clear(); const c = [70, 54, 40]; let pts = [[8, 15]]; for (let k = 0; k < 18; k++) { const [x, y] = pts[p.ri(0, pts.length - 1)]; const nx = x + p.ri(-1, 1), ny = y - 1; if (ny < 3) continue; p.set(nx, ny, p.j(c, 10)); pts.push([nx, ny]); } });
  tile('windbloom', p => { flower(p, '#5aa070', '#ffffff', '#ff8ac0'); p.speck([255, 200, 230], 0.0); });
  tile('slate_bricks', p => { bricks(p, '#68707c', '#454a54', 8, 8); });
  for (let k = 0; k < 5; k++) tile('crack' + k, p => { p.clear(); for (let l = 0; l < 2 + k * 2; l++) { let x = p.ri(2, 13), y = p.ri(2, 13); for (let i = 0; i < 3 + k * 2; i++) { p.set(x, y, [10, 8, 8], 210); x += p.ri(-1, 1); y += p.ri(-1, 1); } } });
  tile('mire_top', p => p.fill('#647040', 10).speck('#7a8a4c', 0.2).speck('#4a5430', 0.15));
  tile('mire_side', p => { p.fill('#4a3a2c', 9).speck('#36291e', 0.2); band(p, '#647040', 3); });
  tile('charred_side', p => { p.fill('#2c2826', 6); for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y++) if (p.r() < 0.7) p.mul(x, y, 0.7); for (let k = 0; k < 4; k++) { const x = p.ri(1, 14), y = p.ri(1, 14); p.set(x, y, [255, 110, 40]); p.set(x, y + 1, [180, 60, 20]); } });
  tile('charred_top', p => logTop(p, '#2c2826', '#4a403a', '#1c1816'));
  tile('lumite_lamp', p => { p.clear(); frame(p, '#cfe6ee'); for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 4.5) p.set(x, y, d < 2 ? [230, 255, 255] : [110, 230, 255]); } });
  tile('spore_lamp', p => { p.clear(); for (let y = 0; y < 5; y++) p.set(7, y, [120, 80, 140]); p.set(8, 2, [120, 80, 140]); for (let y = 4; y < 15; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot((x - 7.5) / 5.5, (y - 9.5) / 5.5); if (d < 1) p.set(x, y, d < 0.45 ? [255, 210, 255] : p.j([220, 110, 255], 25)); } });
  tile('pine_needles', p => { leaves(p, '#2c6a66', 0.1); });
  tile('ruin_brick', p => { bricks(p, '#646c74', '#3e434a'); p.speck('#4f7a3a', 0.1, 12); for (let k = 0; k < 2; k++) { let x = p.ri(0, 15), y = p.ri(0, 15); for (let i = 0; i < 5; i++) { p.mul(x, y, 0.55); x += p.ri(-1, 1); y++; } } });
  tile('gloam_bricks', p => { bricks(p, '#4a3a5e', '#221a2c'); p.speck('#8a5ab8', 0.03, 10); });
  function chestBody(p, wood, band, lock) { planks(p, wood); frame(p, band); for (let x = 0; x < 16; x++) { p.set(x, 5, rgb(band)); } if (lock) { for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) p.set(x, y, rgb(lock)); } }
  tile('cache_side', p => chestBody(p, '#4e3222', '#d4ae58', '#7af0ff'));
  tile('cache_top', p => { planks(p, '#4e3222'); frame(p, '#d4ae58'); for (let i = 0; i < 16; i++) { p.set(i, i, [212, 174, 88]); p.set(15 - i, i, [212, 174, 88]); } });
  tile('cache_open', p => { p.fill('#120c08', 4); frame(p, '#d4ae58'); frame(p, '#4e3222', 1); });
  tile('chest_side', p => chestBody(p, '#9a7448', '#5a3e22', '#c8c8d0'));
  tile('chest_top', p => { planks(p, '#9a7448'); frame(p, '#5a3e22'); });
  tile('crop0', p => { p.clear(); for (let k = 0; k < 4; k++) { const x = 2 + k * 4; for (let i = 0; i < 4; i++) p.set(x + (i > 2 ? 1 : 0), 15 - i, p.j('#6cba4a', 14)); } });
  tile('crop1', p => { p.clear(); for (let k = 0; k < 4; k++) { const x = 2 + k * 4; for (let i = 0; i < 9; i++) p.set(x + (i % 3 === 2 ? 1 : 0), 15 - i, p.j('#5aa840', 14)); p.set(x - 1, 9, rgb('#7ac85a')); p.set(x + 1, 8, rgb('#7ac85a')); } });
  tile('crop2', p => { p.clear(); for (let k = 0; k < 4; k++) { const x = 2 + k * 4; for (let i = 0; i < 12; i++) p.set(x + (i % 3 === 2 ? 1 : 0), 15 - i, p.j('#4a9a38', 14)); p.set(x - 1, 6, rgb('#8ad86a')); p.set(x + 1, 5, rgb('#8ad86a')); p.set(x, 3, [255, 200, 70]); p.set(x + 1, 3, [255, 220, 110]); p.set(x, 4, [240, 170, 50]); for (let y = 13; y < 16; y++) { p.set(x, y, [235, 140, 50]); p.set(x + 1, y, [210, 110, 40]); } } });
  tile('ward_side', p => { p.fill('#5a5868', 6); frame(p, '#3a3846'); frame(p, '#7a788a', 1); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot((x - 7.5) / 5, (y - 7.5) / 3); if (d < 1 && d > 0.7) p.set(x, y, [200, 235, 255]); } for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) p.set(x, y, Math.hypot(x - 7.5, y - 7.5) < 1.5 ? [255, 255, 255] : [120, 200, 255]); });
  tile('ward_top', p => { p.fill('#5a5868', 6); frame(p, '#3a3846'); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) p.set(x, y, [150, 220, 255]); });
  tile('thatch', p => { p.fill('#c8a85a', 8); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if ((x + (y >> 1)) % 3 === 0) p.mul(x, y, 0.82); if (p.r() < 0.08) p.mul(x, y, 1.15); } for (let x = 0; x < 16; x++) { p.mul(x, 7, 0.7); p.mul(x, 15, 0.7); } });
  tile('mossy_cobble', p => { cobble(p, '#6c7380', '#3f434c'); for (let k = 0; k < 7; k++) { let x = p.ri(0, 15), y = p.ri(0, 15); for (let i = 0; i < 6; i++) { p.set(x, y, p.j('#4f7a3a', 18)); x += p.ri(-1, 1); y += p.ri(-1, 1); } } });
  tile('basalt_side', p => { p.fill('#34323a', 6); for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) { p.mul(x, y, 0.65); p.mul(x + 1, y, 1.12); } p.speck('#4a4650', 0.08); });
  tile('basalt_top', p => { p.fill('#34323a', 6); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const hx = (x + (Math.floor(y / 5) % 2) * 2.5) % 5, hy = y % 5; if (hx < 0.8 || hy < 0.8) p.mul(x, y, 0.62); } });
  tile('peat', p => p.fill('#3a2a1e', 8).speck('#2a1c12', 0.25).speck('#5a4a2a', 0.08).speck('#6a5a30', 0.04));
  tile('ice_bricks', p => { bricks(p, '#a8d4f2', '#e8f4ff'); p.speck('#ffffff', 0.04); });
  tile('mud_bricks', p => bricks(p, '#6e5640', '#4a3a2a'));
  tile('anvil_top', p => { p.fill('#2c2a30', 4); for (let y = 3; y < 13; y++) for (let x = 1; x < 15; x++) p.set(x, y, p.j(y < 5 ? [120, 116, 128] : [80, 76, 88], 6)); for (let x = 4; x < 12; x++) p.set(x, 8, [255, 140, 50]); p.set(7, 7, [255, 220, 120]); p.set(8, 9, [255, 200, 90]); });
  tile('anvil_side', p => { p.fill('#3a3640', 5); for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.j([96, 92, 104], 6)); for (let y = 5; y < 11; y++) for (let x = 4; x < 12; x++) p.set(x, y, p.j([70, 66, 78], 6)); for (let y = 11; y < 16; y++) for (let x = 2; x < 14; x++) p.set(x, y, p.j([84, 80, 92], 6)); for (let x = 5; x < 11; x++) p.set(x, 7, [255, 130, 40]); });
  tile('sunwell_top', p => { p.fill('#d8cfb4', 5); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 2.5) p.set(x, y, [255, 252, 220]); else if (d < 4.2) p.set(x, y, [255, 210, 90]); else if (d < 5) p.set(x, y, [180, 140, 60]); else if (d < 7.5 && Math.round(Math.atan2(y - 7.5, x - 7.5) * 6 / Math.PI) % 2 === 0) p.set(x, y, [230, 200, 120]); } });
  tile('sunwell_side', p => { p.fill('#d8cfb4', 5); frame(p, '#a89a74'); for (let x = 2; x < 14; x++) { p.set(x, 3, [255, 210, 90]); p.set(x, 12, [255, 210, 90]); } for (let y = 4; y < 12; y++) { p.set(7, y, [255, 230, 140]); p.set(8, y, [255, 230, 140]); } });
  tile('rift', p => { p.fill('#0c0812', 4); for (let k = 0; k < 3; k++) { const ph = k * 2.1; for (let t = 0; t < 40; t++) { const a = ph + t * 0.25, r = 1 + t * 0.17; p.set(7.5 + Math.cos(a) * r, 7.5 + Math.sin(a) * r, t > 30 ? [60, 20, 90] : [170, 70, 255]); } } p.set(7, 7, [255, 120, 240]); p.set(8, 8, [255, 120, 240]); });
  tile('stall_top', p => { planks(p, '#8a6440'); frame(p, '#5a3e22'); for (let x = 3; x < 6; x++) for (let y = 4; y < 7; y++) p.set(x, y, [220, 90, 40]); for (let x = 9; x < 12; x++) for (let y = 9; y < 12; y++) p.set(x, y, [110, 200, 120]); p.set(11, 4, [96, 232, 196]); p.set(4, 11, [255, 200, 80]); });
  tile('stall_side', p => { planks(p, '#8a6440'); for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) p.set(x, y, (x >> 2) % 2 ? [200, 60, 50] : [240, 220, 190]); });



  LL.atlasTexture = function () {
    const t = new THREE.CanvasTexture(atlas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  };

  // ---------- blocks ----------
  const B = LL.B = {};
  const BLOCKS = LL.BLOCKS = [];
  const SOLID = LL.SOLID = new Uint8Array(256), OPQ = LL.OPQ = new Uint8Array(256), RT = LL.RT = new Uint8Array(256);
  const EMIT = LL.EMIT = new Uint8Array(256), ATT = LL.ATT = new Uint8Array(256), LEAFY = LL.LEAFY = new Uint8Array(256);
  const TTOP = LL.TTOP = new Uint16Array(256), TBOT = LL.TBOT = new Uint16Array(256), TSIDE = LL.TSIDE = new Uint16Array(256);
  // rt: 1 cube, 2 cutout cube, 3 cross plant, 4 liquid
  function def(id, key, name, o) {
    const d = Object.assign({ id, key, name, solid: true, rt: 1, light: 0, att: 0, hard: 1, tool: null, tier: 0, drop: id, tiles: null, place: true }, o);
    B[key] = id; BLOCKS[id] = d;
    const [t, b, s] = Array.isArray(d.tiles) ? (d.tiles.length === 3 ? d.tiles : [d.tiles[0], d.tiles[0], d.tiles[1]]) : [d.tiles, d.tiles, d.tiles];
    TTOP[id] = T[t]; TBOT[id] = T[b]; TSIDE[id] = T[s];
    SOLID[id] = d.solid ? 1 : 0; RT[id] = d.rt; OPQ[id] = (d.rt === 1) ? 1 : 0;
    EMIT[id] = d.light; ATT[id] = d.att; LEAFY[id] = d.leafy ? 1 : 0;
  }
  BLOCKS[0] = { id: 0, key: 'AIR', name: 'Air', solid: false, rt: 0 }; B.AIR = 0;
  const leafDrop = (sapChance) => (r) => r() < sapChance ? [[100, 1]] : [];
  def(1, 'LOAM', 'Loam', { tiles: 'loam', hard: 0.6, tool: 'shovel' });
  def(2, 'TURF', 'Meadow Turf', { tiles: ['turf_top', 'loam', 'turf_side'], hard: 0.7, tool: 'shovel', drop: 1 });
  def(3, 'SLATE', 'Slate', { tiles: 'slate', hard: 3.2, tool: 'pick', tier: 1, drop: 4 });
  def(4, 'COBBLE', 'Cobbled Slate', { tiles: 'cobble', hard: 3.4, tool: 'pick', tier: 1 });
  def(5, 'DRIFT_LOG', 'Driftwood Log', { tiles: ['drift_top', 'drift_side'], hard: 2.2, tool: 'axe' });
  def(6, 'DRIFT_PLANKS', 'Driftwood Planks', { tiles: 'drift_planks', hard: 1.8, tool: 'axe' });
  def(7, 'DRIFT_LEAVES', 'Canopy Leaves', { tiles: 'drift_leaves', rt: 2, leafy: 1, att: 1, hard: 0.25, drop: leafDrop(0.08) });
  def(8, 'ROSE_LOG', 'Rosewood Log', { tiles: ['rose_top', 'rose_side'], hard: 2.2, tool: 'axe' });
  def(9, 'ROSE_PLANKS', 'Rosewood Planks', { tiles: 'rose_planks', hard: 1.8, tool: 'axe' });
  def(10, 'ROSE_LEAVES', 'Rosewood Leaves', { tiles: 'rose_leaves', rt: 2, leafy: 1, att: 1, hard: 0.25, drop: (r) => r() < 0.06 ? [[112, 1]] : r() < 0.08 ? [[100, 1]] : [] });
  def(11, 'FROST_LOG', 'Frostpine Log', { tiles: ['frost_top', 'frost_side'], hard: 2.2, tool: 'axe' });
  def(12, 'FROST_PLANKS', 'Frostpine Planks', { tiles: 'frost_planks', hard: 1.8, tool: 'axe' });
  def(13, 'FROST_LEAVES', 'Frostpine Needles', { tiles: 'frost_leaves', rt: 2, leafy: 1, att: 1, hard: 0.25, drop: leafDrop(0.08) });
  def(14, 'SAND', 'Dune Sand', { tiles: 'sand', hard: 0.6, tool: 'shovel' });
  def(15, 'ASH', 'Ashsoil', { tiles: 'ash', hard: 0.6, tool: 'shovel' });
  def(16, 'SNOW', 'Snowpack', { tiles: 'snow', hard: 0.4, tool: 'shovel' });
  def(17, 'ICE', 'Rime Ice', { tiles: 'ice', hard: 0.9, tool: 'pick' });
  def(18, 'WATER', 'Water', { tiles: 'water', rt: 4, solid: false, att: 2, hard: -1, drop: null, place: false });
  def(19, 'MUD', 'Bog Mud', { tiles: 'mud', hard: 0.7, tool: 'shovel' });
  def(20, 'CLAY', 'River Clay', { tiles: 'clay', hard: 0.8, tool: 'shovel' });
  def(21, 'CORESTONE', 'Corestone', { tiles: 'corestone', hard: -1, drop: null });
  def(22, 'COPPER_ORE', 'Copperite Ore', { tiles: 'copper_ore', hard: 4, tool: 'pick', tier: 2 });
  def(23, 'CINDER_ORE', 'Cinderite Ore', { tiles: 'cinder_ore', hard: 3.5, tool: 'pick', tier: 1, drop: (r) => [[101, 1 + (r() < 0.3 ? 1 : 0)]] });
  def(24, 'EMBER_ORE', 'Emberite Ore', { tiles: 'ember_ore', hard: 5, tool: 'pick', tier: 3, light: 5 });
  def(25, 'LUMITE', 'Lumite Cluster', { tiles: 'lumite', hard: 2.5, tool: 'pick', tier: 1, light: 12, drop: (r) => [[106, 2 + (r() < 0.5 ? 1 : 0)]] });
  def(26, 'LANTERN', 'Cinder Lantern', { tiles: 'lantern', rt: 2, hard: 0.4, light: 14 });
  def(27, 'HEARTH', 'Hearth', { tiles: ['hearth_top', 'cobble', 'hearth_side'], hard: 3, tool: 'pick', light: 15 });
  def(28, 'GLASS', 'Glass', { tiles: 'glass', rt: 2, hard: 0.4, drop: null });
  def(29, 'KILN_BRICKS', 'Fired Bricks', { tiles: 'kiln_bricks', hard: 3.5, tool: 'pick', tier: 1 });
  def(30, 'BENCH', "Tinker's Bench", { tiles: ['bench_top', 'drift_planks', 'bench_side'], hard: 1.8, tool: 'axe' });
  def(31, 'KILN', 'Kiln', { tiles: ['kiln_top', 'kiln_bricks', 'kiln_front'], hard: 3, tool: 'pick', light: 9 });
  def(32, 'SLATE_BRICKS', 'Slate Bricks', { tiles: 'slate_bricks', hard: 3.5, tool: 'pick', tier: 1 });
  def(33, 'MIRE_TURF', 'Mire Turf', { tiles: ['mire_top', 'mud', 'mire_side'], hard: 0.7, tool: 'shovel', drop: 19 });
  def(34, 'CHARRED_LOG', 'Charred Log', { tiles: ['charred_top', 'charred_side'], hard: 1.8, tool: 'axe' });
  def(35, 'SNOWY_TURF', 'Snowy Turf', { tiles: ['snow', 'loam', 'snow_side'], hard: 0.7, tool: 'shovel', drop: 1 });
  def(36, 'GLOAMROCK', 'Gloamrock', { tiles: 'gloamrock', hard: 3.4, tool: 'pick', tier: 1 });
  def(37, 'MYCEL', 'Mycel Turf', { tiles: ['mycel_top', 'gloamrock', 'mycel_side'], hard: 1, tool: 'shovel', drop: 36 });
  def(38, 'SHROOM_STEM', 'Shroomstalk', { tiles: 'stem', hard: 1.4, tool: 'axe' });
  def(39, 'SHROOM_CAP', 'Glowing Cap', { tiles: 'cap', hard: 0.8, tool: 'axe', light: 10, drop: (r) => r() < 0.3 ? [[115, 1]] : [[39, 1]] });
  def(40, 'VOID_ORE', 'Voidglass Vein', { tiles: 'void_ore', hard: 6, tool: 'pick', tier: 4, drop: () => [[107, 1]] });
  def(41, 'SPORE_LAMP', 'Spore Lantern', { tiles: 'spore_lamp', rt: 3, solid: false, hard: 0.2, light: 13 });
  def(42, 'CLOUDSTONE', 'Cloudstone', { tiles: 'cloudstone', hard: 1.6, tool: 'pick' });
  def(43, 'SKYGRASS', 'Skygrass', { tiles: ['skygrass_top', 'cloudstone', 'skygrass_side'], hard: 1, tool: 'shovel', drop: 42 });
  def(44, 'SUN_ORE', 'Sunstone Seam', { tiles: 'sun_ore', hard: 5, tool: 'pick', tier: 4, light: 7, drop: () => [[108, 1]] });
  def(45, 'AUR_LOG', 'Aurelia Log', { tiles: ['aur_top', 'aur_side'], hard: 2.2, tool: 'axe' });
  def(46, 'AUR_LEAVES', 'Aurelia Leaves', { tiles: 'aur_leaves', rt: 2, leafy: 1, att: 1, hard: 0.25, drop: (r) => r() < 0.1 ? [[116, 1]] : [] });
  def(47, 'WAY_GLOAM', 'Gloam Waystone', { tiles: 'way_gloam', hard: 4, tool: 'pick', light: 8 });
  def(48, 'WAY_SKY', 'Sky Waystone', { tiles: 'way_sky', hard: 4, tool: 'pick', light: 8 });
  def(49, 'WAY_RETURN', 'Homeward Waystone', { tiles: 'way_return', hard: -1, light: 8, drop: null });
  def(50, 'SHRINE', 'Dawn Masonry', { tiles: 'shrine', hard: -1, drop: null });
  def(51, 'ALTAR', 'Dawn Altar', { tiles: ['altar', 'shrine', 'shrine'], hard: -1, drop: null, light: 6 });
  def(52, 'ALTAR_LIT', 'Kindled Altar', { tiles: ['altar_lit', 'shrine', 'shrine'], hard: -1, drop: null, light: 15 });
  def(53, 'LUMITE_LAMP', 'Lumite Lamp', { tiles: 'lumite_lamp', rt: 2, hard: 0.5, light: 15 });
  def(54, 'TALLGRASS', 'Tallgrass', { tiles: 'tallgrass', rt: 3, solid: false, hard: 0, drop: (r) => { const v = r(); return v < 0.14 ? [[150, 1]] : v < 0.19 ? [[100, 1]] : []; } });
  def(55, 'EMBERBLOOM', 'Emberbloom', { tiles: 'emberbloom', rt: 3, solid: false, hard: 0 });
  def(56, 'FROSTBELL', 'Frostbell', { tiles: 'frostbell', rt: 3, solid: false, hard: 0 });
  def(57, 'BERRY_BUSH', 'Emberberry Bush', { tiles: 'bush', rt: 3, solid: false, hard: 0.1, drop: (r) => [[112, 2 + (r() < 0.5 ? 1 : 0)]] });
  def(58, 'GLOWCAP', 'Glowcap', { tiles: 'glowcap', rt: 3, solid: false, hard: 0, light: 7, drop: () => [[115, 1]] });
  def(59, 'DEAD_SHRUB', 'Dead Shrub', { tiles: 'dead_shrub', rt: 3, solid: false, hard: 0, drop: (r) => r() < 0.5 ? [[100, 1]] : [] });
  def(60, 'WINDBLOOM', 'Windbloom', { tiles: 'windbloom', rt: 3, solid: false, hard: 0 });
  def(61, 'BARE_BUSH', 'Picked Bush', { tiles: 'bare_bush', rt: 3, solid: false, hard: 0, drop: null });
  def(62, 'ROCK_PINE', 'Frostpine Needles', { tiles: 'pine_needles', rt: 2, leafy: 1, att: 1, hard: 0.25, drop: leafDrop(0.08) });
  def(63, 'CACHE', 'Ruin Cache', { tiles: ['cache_top', 'cache_top', 'cache_side'], hard: -1, light: 6, drop: null });
  def(64, 'CACHE_OPEN', 'Emptied Cache', { tiles: ['cache_open', 'cache_top', 'cache_side'], hard: 1.5, tool: 'axe', drop: null });
  def(65, 'CHEST', 'Storage Chest', { tiles: ['chest_top', 'chest_top', 'chest_side'], hard: 1.6, tool: 'axe' });
  def(66, 'CROP0', 'Sunroot Sprout', { tiles: 'crop0', rt: 3, solid: false, hard: 0, drop: () => [[150, 1]], place: false });
  def(67, 'CROP1', 'Sunroot (growing)', { tiles: 'crop1', rt: 3, solid: false, hard: 0, drop: () => [[150, 1]], place: false });
  def(68, 'CROP2', 'Ripe Sunroot', { tiles: 'crop2', rt: 3, solid: false, hard: 0, drop: (r) => [[151, 2 + (r() < 0.5 ? 1 : 0)], [150, 1 + (r() < 0.4 ? 1 : 0)]], place: false });
  def(69, 'WARD', 'Warding Totem', { tiles: ['ward_top', 'ward_top', 'ward_side'], hard: 3, tool: 'pick', tier: 1, light: 11 });
  def(70, 'RUIN_BRICK', 'Weathered Bricks', { tiles: 'ruin_brick', hard: 3.5, tool: 'pick', tier: 1 });
  def(71, 'GLOAM_BRICKS', 'Umbral Bricks', { tiles: 'gloam_bricks', hard: 3.5, tool: 'pick', tier: 1 });
  def(72, 'SHARDSTONE', 'Shardstone', { tiles: 'shardstone', hard: 2.2, tool: 'pick', tier: 1, light: 4, drop: (r) => r() < 0.3 ? [[106, 1]] : [[72, 1]] });
  def(73, 'THATCH', 'Thatch', { tiles: 'thatch', hard: 0.6, tool: 'axe' });
  def(74, 'MOSSY_COBBLE', 'Mossy Cobble', { tiles: 'mossy_cobble', hard: 3.4, tool: 'pick', tier: 1 });
  def(75, 'BASALT', 'Basalt', { tiles: ['basalt_top', 'basalt_side'], hard: 3.6, tool: 'pick', tier: 1 });
  def(76, 'PEAT', 'Peat', { tiles: 'peat', hard: 0.8, tool: 'shovel' });
  def(77, 'ICE_BRICKS', 'Ice Bricks', { tiles: 'ice_bricks', hard: 1.5, tool: 'pick' });
  def(78, 'MUD_BRICKS', 'Mud Bricks', { tiles: 'mud_bricks', hard: 2.5, tool: 'pick', tier: 1 });
  def(79, 'EMBER_ANVIL', 'Ember Anvil', { tiles: ['anvil_top', 'anvil_side'], hard: 4, tool: 'pick', tier: 1, light: 6 });
  def(80, 'SUNWELL', 'Sunwell', { tiles: ['sunwell_top', 'sunwell_side'], hard: -1, light: 13, drop: null });
  def(81, 'GLOOM_RIFT', 'Gloom Rift', { tiles: 'rift', hard: 6, tool: 'pick', tier: 1, drop: null });
  def(82, 'TRADE_STALL', 'Trade Stall', { tiles: ['stall_top', 'drift_planks', 'stall_side'], hard: -1, drop: null });


  // ---------- items ----------
  const I = LL.I = {};
  const ITEMS = LL.ITEMS = [];
  function item(id, key, name, o) { I[key] = id; ITEMS[id] = Object.assign({ id, key, name, stack: 64 }, o); }
  item(100, 'HAFT', 'Haft', { shape: 'stick', color: '#8a6440', desc: 'A sturdy handle for tools.' });
  item(101, 'CINDERITE', 'Cinderite', { shape: 'lump', color: '#3a2a26', fuel: true, desc: 'Burns slow and hot. Kiln fuel.' });
  item(102, 'CHARCOAL', 'Charcoal', { shape: 'lump', color: '#2a2a2a', fuel: true, desc: 'Kiln fuel, baked from logs.' });
  item(103, 'COPPER_INGOT', 'Copper Ingot', { shape: 'ingot', color: '#d9803c' });
  item(105, 'EMBER_INGOT', 'Emberite Ingot', { shape: 'ingot', color: '#ff8a1e', desc: 'Still warm to the touch.' });
  item(106, 'LUMITE_SHARD', 'Lumite Shard', { shape: 'gem', color: '#60e8c4', desc: 'Holds a little captured light.' });
  item(107, 'VOIDGLASS', 'Voidglass', { shape: 'gem', color: '#5a2a8a', desc: 'Light falls into it and never comes back.' });
  item(108, 'SUNSTONE', 'Sunstone', { shape: 'gem', color: '#ffb630', desc: 'A splinter of the old sun.' });
  item(109, 'GALE_ESSENCE', 'Gale Essence', { shape: 'orb', color: '#b8ecff', desc: 'A wisp\'s heart. It will not sit still.' });
  item(110, 'SILK', 'Crawler Silk', { shape: 'spool', color: '#dfe8e8', desc: 'Strong, light, faintly sticky.' });
  item(111, 'HIDE', 'Bramble Hide', { shape: 'cloth', color: '#8a6440' });
  item(112, 'EMBERBERRY', 'Emberberry', { shape: 'berry', color: '#ff7a24', food: 2, warm: 14, desc: 'Spicy. Warms you from inside.' });
  item(113, 'RAW_VENISON', 'Raw Venison', { shape: 'meat', color: '#c84a4a', food: 2, desc: 'Better roasted in a kiln.' });
  item(114, 'ROAST_VENISON', 'Roast Venison', { shape: 'meat', color: '#9a5a2a', food: 7, warm: 8 });
  item(115, 'GLOWCAP_FOOD', 'Glowcap', { shape: 'shroom', color: '#40d8d0', food: 3, desc: 'Tastes like rain.' });
  item(116, 'CLOUDFRUIT', 'Cloudfruit', { shape: 'berry', color: '#ffe080', food: 5, warm: 5 });
  item(117, 'HEARTFIRE', 'Heartfire', { shape: 'flame', color: '#ff9a2a', stack: 1, desc: 'Place it on the Dawn Altar in Skyreach.' });
  item(118, 'COAT', 'Bramble Coat', { shape: 'coat', color: '#7a5a3a', stack: 1, desc: 'Carried: you lose warmth half as fast.' });
  item(119, 'GLIDER', 'Silk Glider', { shape: 'glider', color: '#e8f0f0', stack: 1, desc: 'Carried: hold Space while falling to glide.' });
  item(120, 'DUSK_PEARL', 'Dusk Pearl', { shape: 'orb', color: '#7a3aa8', desc: 'What a gloomling leaves behind.' });
  item(150, 'SEED', 'Sunroot Seed', { shape: 'seed', color: '#c8a050', desc: 'Right-click soil to plant. Grows only in light.' });
  item(151, 'SUNROOT', 'Sunroot', { shape: 'root', color: '#e89a3a', food: 3, warm: 3 });
  item(152, 'HEARTHBREAD', 'Hearthbread', { shape: 'bread', color: '#c88a40', food: 8, warm: 12, desc: 'Dense, warm and filling.' });
  item(153, 'COMPASS', 'Ruin Compass', { shape: 'compass', color: '#d9803c', stack: 1, desc: 'Carried: points to the nearest unopened ruin.' });
  item(154, 'HEATSTONE', 'Heatstone', { shape: 'orb', color: '#ff5a2a', stack: 1, desc: 'Carried: you lose warmth 40% slower.' });
  item(155, 'BOOTS_SPRING', 'Springstep Boots', { shape: 'boots', color: '#60e8c4', stack: 1, armor: { slot: 2, val: 2 }, dj: true, desc: 'Wear them to jump again in mid-air.' });
  item(156, 'LUMITE_BLADE', 'Lumite Blade', { shape: 'blade', color: '#60e8c4', stack: 1, tool: { kind: 'blade', tier: 3, speed: 2, dmg: 8, dur: 420 } });
  item(157, 'GLOOM_HEART', 'Gloom Heart', { shape: 'orb', color: '#3a1050', desc: 'Torn from a Gloom Brute. Still beating.' });
  item(158, 'MOTH_DUST', 'Glowmoth Dust', { shape: 'lump', color: '#d8f080', desc: 'Shimmering scales. Makes lamps without Lumite.' });
  item(159, 'SPORE_SAC', 'Spore Sac', { shape: 'orb', color: '#9a6ac8', desc: 'Right-click a crop or picked bush to make it grow at once.' });
  const BPS = LL.BLUEPRINTS = [[160, 153], [161, 155], [162, 69], [163, 154], [164, 156]];
  BPS.forEach(([id, out]) => item(id, 'BP_' + out, 'Blueprint', { shape: 'scroll', color: '#e8d8b0', bp: out, desc: 'Right-click to learn how to craft it.' }));
  [['Hide', '#8a6440', [1, 2, 1]], ['Copper', '#d9803c', [2, 3, 2]], ['Emberite', '#ff8a1e', [3, 5, 3]]].forEach(([n, c, v], t) => {
    ['Cap', 'Vest', 'Boots'].forEach((k, slot) => item(170 + t * 3 + slot, (n + '_' + k).toUpperCase(), n + ' ' + (t ? ['Helm', 'Cuirass', 'Greaves'][slot] : k), { shape: ['helm', 'vest', 'boots'][slot], color: c, stack: 1, armor: { slot, val: v[slot] } }));
  });

  const TIERS = [
    { name: 'Wooden', mat: 'planks', color: '#a8865a', speed: 2, dur: 60 },
    { name: 'Slate', mat: 4, color: '#8a909c', speed: 4, dur: 140 },
    { name: 'Copper', mat: 103, color: '#e08a44', speed: 6, dur: 260 },
    { name: 'Emberite', mat: 105, color: '#ff9a2a', speed: 9, dur: 640 },
  ];
  const KINDS = [
    { k: 'pick', n: 'Pick', shape: 'pick', dmg: [2, 3, 3, 4] },
    { k: 'axe', n: 'Hatchet', shape: 'axe', dmg: [3, 4, 5, 6] },
    { k: 'shovel', n: 'Spade', shape: 'shovel', dmg: [1, 2, 2, 3] },
    { k: 'blade', n: 'Blade', shape: 'blade', dmg: [4, 5, 7, 9] },
  ];
  LL.TIERS = TIERS;
  TIERS.forEach((t, ti) => KINDS.forEach((k, ki) => {
    const id = 130 + ti * 4 + ki;
    item(id, (t.name + '_' + k.k).toUpperCase(), t.name + ' ' + k.n, { shape: k.shape, color: t.color, stack: 1, tool: { kind: k.k, tier: ti + 1, speed: t.speed, dmg: k.dmg[ti], dur: t.dur } });
  }));
  // block items
  for (const b of BLOCKS) if (b && b.id) { ITEMS[b.id] = { id: b.id, key: b.key, name: b.name, stack: 64, block: true }; }
  LL.BLUEPRINTS.forEach(([id, out]) => { ITEMS[id].name = 'Blueprint: ' + ITEMS[out].name; });

  LL.isBlockItem = id => id < 100 && BLOCKS[id] && BLOCKS[id].place;
  LL.maxStack = id => (ITEMS[id] ? ITEMS[id].stack : 64);
  LL.toolOf = id => (ITEMS[id] && ITEMS[id].tool) || null;
  LL.itemName = id => (ITEMS[id] ? ITEMS[id].name : '?');

  // ---------- icons ----------
  const SHAPES = {
    ingot: ['................', '................', '................', '................', '................', '......oooooo....', '.....olllllmo...', '....olllllmmo...', '...ommmmmmmdo...', '...ommmmmmddo...', '...oddddddddo...', '....oooooooo....', '................', '................', '................', '................'],
    gem: ['................', '................', '......oooo......', '.....ollmmo.....', '....ollwlmmo....', '...olllmmmmdo...', '...ommmmmmddo...', '....ommmmddo....', '.....ommmdo.....', '......omdo......', '.......oo.......', '................', '................', '................', '................', '................'],
    lump: ['................', '................', '................', '.....ooooo......', '....ollmmmo.....', '...olmmmdmmoo...', '...ommdmmmmdmo..', '..ommmmmmdmmmo..', '..odmmmmmmmddo..', '...oddmmmdddo...', '....ooodddoo....', '.......ooo......', '................', '................', '................', '................'],
    stick: ['............oo..', '...........olmo.', '..........olmdo.', '.........olmdo..', '........olmdo...', '.......olmdo....', '......olmdo.....', '.....olmdo......', '....olmdo.......', '...olmdo........', '..olmdo.........', '..omddo.........', '...oo...........', '................', '................', '................'],
    orb: ['................', '......oooo......', '....oolllmoo....', '...olwwllmmmo...', '...olwlllmmmo...', '..ollllmmmmmdo..', '..ollmmmmmmmdo..', '..ommmmmmmmddo..', '..ommmmmmmdddo..', '...ommmmmdddo...', '...oommdddddo...', '....oodddddoo...', '......oooo......', '................', '................', '................'],
    meat: ['................', '......oooo......', '.....ommmmo.....', '....ommllmmo....', '....omlllmmdo...', '....ommmmmmdo...', '.....ommmmddo...', '......ommddo....', '.......oddo.....', '........owwo....', '.......owwwwo...', '........owwo....', '.........oo.....', '................', '................', '................'],
    berry: ['................', '........kk......', '.......k........', '....oo.k.oo.....', '...ommo.ommo....', '...olmmoolmmo...', '...ommmoommmo...', '....oomooomo....', '......ommo......', '.....olmmmo.....', '.....ommmmo.....', '......oooo......', '................', '................', '................', '................'],
    cloth: ['................', '...oo......oo...', '..ommoooooommo..', '..omllllllmmmo..', '...omlmmmmmmo...', '...ommmmmmmmo...', '...ommmmmdmmo...', '...ommmmmmmmo...', '..ommmmmmmmmdo..', '..odmmmmmmmddo..', '...oo.oooo.oo...', '................', '................', '................', '................', '................'],
    spool: ['................', '....oooooooo....', '....oHHHHHHo....', '.....ollllo.....', '.....omllmo.....', '.....ollllo.....', '.....omllmo.....', '.....ollllo.....', '....oHHHHHHo....', '....oooooooo....', '................', '................', '................', '................', '................', '................'],
    shroom: ['................', '................', '.....oooooo.....', '...oollwllmoo...', '..olllmmlmmmmo..', '..ommmmmmmmmdo..', '...ooowwwwooo...', '......owwo......', '......owwo......', '.....owwwwo.....', '......oooo......', '................', '................', '................', '................', '................'],
    coat: ['................', '....oo....oo....', '...ommoooommo...', '..ommmlllmmmmo..', '.ommmmllmmmmmmo.', '.omo.ommmmo.omo.', '.omo.ommmmo.omo.', '.oo..ommdmo..oo.', '.....ommdmo.....', '.....ommdmo.....', '.....oooooo.....', '................', '................', '................', '................', '................'],
    glider: ['................', '.......oo.......', '......ohho......', '....oomhhmoo....', '..oommmhhmmmoo..', '.ollllmhhmllllo.', 'ommmmmmhhmmmmmmo', 'oddddo.hh.oddddo', '.oo....hh....oo.', '.......hh.......', '.......HH.......', '................', '................', '................', '................', '................'],
    flame: ['.......o........', '......omo.......', '......omlo......', '.....omllo..o...', '....omllwlo.omo.', '...omllwwlmoomo.', '...omlwwwlmmmmo.', '..omllwwwllmmdo.', '..omllwwwlllmdo.', '..ommllwllmmmdo.', '...ommllllmmdo..', '....oommmmddo...', '......oooooo....', '................', '................', '................'],
    pick: ['................', '....dmmmmmmd....', '...mlllllllldm..', '..mm.....hh.mm..', '..m.....hh...m..', '.......hh....d..', '......hh........', '.....hh.........', '....hh..........', '...hh...........', '..hh............', '.hh.............', 'HH..............', '................', '................', '................'],
    axe: ['................', '........mmm.....', '.......mllmm....', '......mllllmm...', '......mlllhhm...', '.......mhhlmd...', '......hhmmmd....', '.....hh.........', '....hh..........', '...hh...........', '..hh............', '.hh.............', 'HH..............', '................', '................', '................'],
    shovel: ['...........mmm..', '..........mllmm.', '.........mllllm.', '..........mlldm.', '.........h.mdm..', '........hh......', '.......hh.......', '......hh........', '.....hh.........', '....hh..........', '...hh...........', '..hh............', '.hh.............', 'HH..............', '................', '................'],
    blade: ['............mmm.', '...........mlmm.', '..........mlmm..', '.........mlmm...', '........mlmm....', '.......mlmm.....', '..d...mlmm......', '...d.mlmm.......', '....dlmm........', '.....hd.........', '....h..d........', '...h............', '..H.............', '................', '................', '................'],
    seed: ['................', '................', '................', '......oo........', '.....olmo.......', '.....ommo...oo..', '......oo...olmo.', '...........ommo.', '....oo......oo..', '...olmo.........', '...ommo..oo.....', '....oo..olmo....', '........ommo....', '.........oo.....', '................', '................'],
    root: ['.....k..k.......', '......kkk.......', '.....kkkk.......', '.....oooo.......', '....ollmmo......', '....olmmmo......', '....ommmdo......', '.....ommdo......', '.....ommdo......', '......omdo......', '......omo.......', '.......o........', '................', '................', '................', '................'],
    bread: ['................', '................', '................', '....oooooooo....', '...ollllllmmo...', '..ollwlllwlmmo..', '..olllllllmmmo..', '..ommmmmmmmmdo..', '..oddddddddddo..', '...oooooooooo...', '................', '................', '................', '................', '................', '................'],
    compass: ['................', '.....oooooo.....', '...oommmmmmoo...', '..ommwwwwwwmmo..', '..omwwwwrwwwmo..', '.omwwwwrrwwwwmo.', '.omwwwrrrwwwwmo.', '.omwwwwHwwwwwmo.', '.omwwwwHHwwwwmo.', '..omwwwHwwwwmo..', '..ommwwwwwwmmo..', '...oommmmmmoo...', '.....oooooo.....', '................', '................', '................'],
    scroll: ['................', '..oooooooooo....', '.ollllllllllo...', '.olmmmmmmmmlo...', '..ommHHHHmmo....', '..ommmmmmmmo....', '..ommHHHmmmo....', '..ommmmmmmmo....', '..ommHHHHHmo....', '..ommmmmmmmo....', '.olmmmmmmmmlo...', '.ollllllllllo...', '..oooooooooo....', '................', '................', '................'],
    helm: ['................', '................', '.....oooooo.....', '....ollllmmo....', '...ollmmmmmdo...', '...olmmmmmmdo...', '...ommmmmmmdo...', '...omo....odo...', '...omo....odo...', '...oo......oo...', '................', '................', '................', '................', '................', '................'],
    vest: ['................', '...oo......oo...', '..ommoooooommo..', '..omlllllllmmo..', '..omlmmmmmmmmo..', '...ommmmmmmmo...', '...ommmmmmmdo...', '...ommmmmmmdo...', '...ommmmmmmdo...', '...oddddddddo...', '....oooooooo....', '................', '................', '................', '................', '................'],
    boots: ['................', '................', '...oooo..oooo...', '...olmo..olmo...', '...ommo..ommo...', '...ommo..ommo...', '...ommoo.ommoo..', '...ommmmoommmmo.', '...oddddooddddo.', '....oooo..oooo..', '................', '................', '................', '................', '................', '................'],
  };
  const iconCache = {};
  function shade(c, f) { return [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)]; }
  LL.icon = function (id) {
    if (iconCache[id]) return iconCache[id];
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const it = ITEMS[id];
    if (!it) return cv;
    if (it.block) {
      const b = BLOCKS[id];
      const tsrc = (t) => [(t % AN) * TS, Math.floor(t / AN) * TS];
      if (b.rt === 3 || b.rt === 4) {
        const [sx, sy] = tsrc(TSIDE[id]); c.drawImage(atlas, sx, sy, 16, 16, 0, 0, 32, 32);
      } else {
        const faces = [[TTOP[id], [14 / 16, -7 / 16, 14 / 16, 7 / 16, 2, 9], 0], [TSIDE[id], [14 / 16, 7 / 16, 0, 15 / 16, 2, 9], 0.25], [TSIDE[id], [14 / 16, -7 / 16, 0, 15 / 16, 16, 16], 0.42]];
        for (const [t, m, dark] of faces) {
          const [sx, sy] = tsrc(t);
          c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
          c.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16.1, 16.1);
          if (dark) { c.fillStyle = 'rgba(0,0,0,' + dark + ')'; c.globalCompositeOperation = 'source-atop'; c.fillRect(0, 0, 16, 16); c.globalCompositeOperation = 'source-over'; }
        }
        c.setTransform(1, 0, 0, 1, 0, 0);
      }
    } else {
      const mask = SHAPES[it.shape] || SHAPES.lump;
      const base = rgb(it.color);
      const pal = { m: base, l: shade(base, 1.35), d: shade(base, 0.68), o: shade(base, 0.32), w: [255, 250, 232], h: [122, 86, 52], H: [78, 53, 32], k: [60, 110, 50], r: [220, 60, 50] };
      const img = c.createImageData(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = (mask[y] || '')[x];
        if (!ch || ch === '.') continue;
        const col = pal[ch] || base; const i = (y * 16 + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = 16; tmp.getContext('2d').putImageData(img, 0, 0);
      c.drawImage(tmp, 0, 0, 32, 32);
    }
    iconCache[id] = cv;
    return cv;
  };
  const iconURLs = {};
  LL.iconURL = id => iconURLs[id] || (iconURLs[id] = LL.icon(id).toDataURL());

  // ---------- recipes ----------
  LL.GROUPS = {
    log: [5, 8, 11, 45, 34],
    planks: [6, 9, 12],
    fuel: [101, 102, 76],
  };
  LL.GROUP_NAME = { log: 'Any Log', planks: 'Any Planks', fuel: 'Fuel' };
  const R = LL.RECIPES = [];
  function rec(st, cat, out, n, ins, bp) { R.push({ st, cat, out, n, ins, bp: !!bp }); }
  rec('hand', 'build', 6, 4, [[5, 1]]);
  rec('hand', 'build', 9, 4, [[8, 1]]);
  rec('hand', 'build', 12, 4, [[11, 1]]);
  rec('hand', 'build', 6, 4, [[45, 1]]);
  rec('hand', 'build', 6, 2, [[34, 1]]);
  rec('hand', 'mats', 100, 4, [['planks', 2]]);
  rec('hand', 'build', 30, 1, [['planks', 6]]);
  rec('hand', 'build', 26, 2, [['fuel', 1], [100, 1]]);
  const toolIns = [[3, 2], [3, 2], [1, 2], [2, 1]];
  TIERS.forEach((t, ti) => KINDS.forEach((k, ki) => {
    const [mn, hn] = toolIns[ki];
    rec('bench', 'tools', 130 + ti * 4 + ki, 1, [[t.mat, mn], [100, hn]]);
  }));
  rec('bench', 'build', 31, 1, [[4, 8], ['fuel', 1]]);
  rec('bench', 'build', 27, 1, [[4, 6], ['fuel', 3]]);
  rec('bench', 'build', 32, 4, [[4, 4]]);
  rec('bench', 'build', 53, 1, [[106, 2], [28, 1]]);
  rec('bench', 'gear', 118, 1, [[111, 6]]);
  rec('bench', 'gear', 119, 1, [[110, 6], [100, 3], [111, 2]]);
  rec('bench', 'quest', 47, 1, [[32, 6], [105, 2], [120, 2]]);
  rec('bench', 'quest', 48, 1, [[32, 4], [107, 4], [106, 4], [105, 2]]);
  rec('bench', 'quest', 117, 1, [[108, 4], [109, 3], [107, 2], [105, 2]]);
  rec('kiln', 'smelt', 103, 1, [[22, 1], ['fuel', 1]]);
  rec('kiln', 'smelt', 105, 1, [[24, 1], ['fuel', 1]]);
  rec('kiln', 'smelt', 28, 2, [[14, 2], ['fuel', 1]]);
  rec('kiln', 'smelt', 29, 4, [[20, 2], ['fuel', 1]]);
  rec('kiln', 'smelt', 114, 2, [[113, 2], ['fuel', 1]]);
  rec('kiln', 'smelt', 102, 2, [['log', 1]]);
  rec('kiln', 'smelt', 4, 1, [[36, 1], ['fuel', 1]]);
  rec('bench', 'build', 65, 1, [['planks', 8]]);
  rec('kiln', 'smelt', 152, 2, [[151, 3], ['fuel', 1]]);
  [3, 5, 3].forEach((n, s) => rec('bench', 'gear', 170 + s, 1, [[111, n]]));
  [4, 6, 3].forEach((n, s) => rec('bench', 'gear', 173 + s, 1, [[103, n], [111, 1]]));
  [4, 6, 3].forEach((n, s) => rec('bench', 'gear', 176 + s, 1, [[105, n], [103, 2]]));
  rec('bench', 'gear', 153, 1, [[103, 2], [106, 2]], true);
  rec('bench', 'gear', 155, 1, [[111, 3], [103, 2], [106, 3]], true);
  rec('bench', 'build', 69, 1, [[70, 4], [157, 1], [106, 2]], true);
  rec('kiln', 'gear', 154, 1, [[101, 8], [103, 1]], true);
  rec('bench', 'tools', 156, 1, [[106, 6], [103, 1], [100, 1]], true);
  rec('hand', 'build', 73, 4, [[150, 6]]);
  rec('hand', 'build', 74, 4, [[4, 4], [150, 1]]);
  rec('bench', 'build', 77, 4, [[17, 4]]);
  rec('kiln', 'smelt', 78, 4, [[19, 4], ['fuel', 1]]);
  rec('bench', 'build', 79, 1, [[105, 3], [4, 6]]);
  rec('bench', 'build', 53, 1, [[158, 3], [28, 1]]);


})(window.LL);
