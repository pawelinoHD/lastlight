// Lastlight — player, inventory, interaction
'use strict';
(function (LL) {
  const B = LL.B, I = LL.I, BLOCKS = LL.BLOCKS, RT = LL.RT;

  class Inventory {
    constructor() { this.s = new Array(36).fill(null); this.sel = 0; }
    add(id, n = 1, dur) {
      const max = LL.maxStack(id);
      if (max > 1) for (let i = 0; i < 36 && n; i++) { const t = this.s[i]; if (t && t.id === id && t.n < max) { const k = Math.min(n, max - t.n); t.n += k; n -= k; } }
      for (let i = 0; i < 36 && n; i++) {
        if (!this.s[i]) { const k = Math.min(n, max); const tool = LL.toolOf(id); this.s[i] = { id, n: k, dur: dur != null ? dur : (tool ? tool.dur : undefined) }; n -= k; }
      }
      return n;
    }
    matches(spec, id) { return typeof spec === 'string' ? LL.GROUPS[spec].includes(id) : spec === id; }
    count(spec) { let c = 0; for (const t of this.s) if (t && this.matches(spec, t.id)) c += t.n; return c; }
    has(id) { return this.count(id) > 0; }
    take(spec, n) {
      for (let i = 35; i >= 0 && n > 0; i--) { const t = this.s[i]; if (t && this.matches(spec, t.id)) { const k = Math.min(n, t.n); t.n -= k; n -= k; if (!t.n) this.s[i] = null; } }
      return n === 0;
    }
    held() { return this.s[this.sel]; }
    useHeld(n = 1) { const t = this.held(); if (!t) return; t.n -= n; if (t.n <= 0) this.s[this.sel] = null; }
    toJSON() { return { s: this.s, sel: this.sel }; }
    load(o) { this.s = o.s.map(x => x ? Object.assign({}, x) : null); while (this.s.length < 36) this.s.push(null); this.sel = o.sel || 0; }
  }
  LL.Inventory = Inventory;

  LL.raycast = function (world, ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tmx = dx ? (dx > 0 ? (x + 1 - ox) : (ox - x)) * tdx : Infinity;
    let tmy = dy ? (dy > 0 ? (y + 1 - oy) : (oy - y)) * tdy : Infinity;
    let tmz = dz ? (dz > 0 ? (z + 1 - oz) : (oz - z)) * tdz : Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 64 && t <= maxD; i++) {
      const id = world.getBlock(x, y, z);
      if (id && RT[id] !== 4) return { x, y, z, id, nx, ny, nz, t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  };
  function rayBox(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
    let tmin = 0, tmax = 100;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return -1; continue; }
      let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmin;
  }

  LL.mineTime = function (id, held) {
    const b = BLOCKS[id];
    if (!b || b.hard < 0) return Infinity;
    if (b.hard === 0) return 0.05;
    const tool = held && LL.toolOf(held.id);
    const right = !!(tool && b.tool === tool.kind);
    return b.hard * 1.5 / (right ? tool.speed : 1) * (LL.canHarvest(id, held) ? 1 : 3.3);
  };
  LL.canHarvest = function (id, held) {
    const b = BLOCKS[id];
    if (b.tool !== 'pick' || !b.tier) return true;
    const tool = held && LL.toolOf(held.id);
    return !!(tool && tool.kind === 'pick' && tool.tier >= b.tier);
  };

  class Player {
    constructor(game) {
      this.game = game;
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
      this.hw = 0.3; this.h = 1.8; this.eye = 1.62;
      this.yaw = 0; this.pitch = 0;
      this.vigor = 20; this.maxVigor = 20; this.warmth = 100;
      this.inv = new Inventory();
      this.dead = false; this.onGround = false; this.inWater = false;
      this.mine = null; this.mineP = 0; this.atkCd = 0; this.useCd = 0; this.hurtCd = 0; this.lastHurt = 99;
      this.swing = 0; this.bob = 0; this.gliding = false; this.eatT = 0;
      this.target = null; this.mobTarget = null;
      this.equip = [null, null, null]; this.djUsed = false;
      this.buildViewModel();
    }
    buildViewModel() {
      const cam = this.game.camera;
      this.vm = new THREE.Group(); cam.add(this.vm);
      this.vm.position.set(0.52, -0.5, -0.78);
      this.vmHeld = -1; this.vmMesh = null;
    }
    refreshViewModel() {
      const h = this.inv.held(), id = h ? h.id : 0;
      if (id === this.vmHeld) return;
      this.vmHeld = id;
      if (this.vmMesh) { this.vm.remove(this.vmMesh); this.vmMesh.material.dispose(); }
      let m;
      if (!id) {
        m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xc89a78 })); m.userData.base = new THREE.Color(0xc89a78);
        m.position.set(0.05, -0.05, 0.05); m.rotation.set(0.15, -0.2, 0);
      } else {
        m = LL.makeItemMesh(id, 0.32);
        if (m.userData.cube) { m.scale.setScalar(0.19); m.rotation.set(0.25, 0.7, 0); m.position.set(0.08, 0.0, 0); }
        else { m.scale.setScalar(0.26); m.rotation.set(0.1, -1.1, 0.25); m.position.set(0.06, 0.06, 0); }
      }
      m.renderOrder = 10; m.material.depthTest = false; m.material.depthWrite = false; m.material.transparent = true;
      this.vmMesh = m; this.vm.add(m);
    }
    perk(k) { return LL.Prog.perk(this.game, k); }
    applyPerks() { this.maxVigor = 20 + 4 * this.perk('hardy'); if (this.vigor > this.maxVigor) this.vigor = this.maxVigor; }
    armor() { let a = 0; for (const e of this.equip) if (e && LL.ITEMS[e.id].armor) a += LL.ITEMS[e.id].armor.val; return a; }
    hasDJ() { const f = this.equip[2]; return !!(f && LL.ITEMS[f.id].dj); }
    hurt(dmg, from, cause, kb = 6) {
      if (this.dead || this.hurtCd > 0 || this.game.godMode) return;
      if (cause !== 'the cold' && cause !== 'the void') dmg *= 1 - Math.min(0.6, this.armor() * 0.045);
      this.vigor -= dmg; this.hurtCd = 0.45; this.lastHurt = 0;
      if (from && kb) { const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1; this.vel.x += dx / l * kb * 0.7; this.vel.z += dz / l * kb * 0.7; this.vel.y = Math.max(this.vel.y, 4.5); }
      LL.sfx.hurt(); this.game.ui.hurtFlash();
      if (this.vigor <= 0 && this.perk('second') && this.game.secondDay !== this.game.day && cause !== 'the void') {
        this.vigor = 6; this.game.secondDay = this.game.day; this.game.toast('Second Wind! You refuse to fall.', 'good'); LL.sfx.kindle();
        this.game.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, [255, 200, 90], 30, 4);
      }
      if (this.vigor <= 0) { this.vigor = 0; this.game.onDeath(cause || 'the dark'); }
    }
    heal(n) { this.vigor = Math.min(this.maxVigor, this.vigor + n); }
    update(dt, inp) {
      const g = this.game, w = g.world;
      this.hurtCd -= dt; this.atkCd -= dt; this.useCd -= dt; this.lastHurt += dt; this.eatT -= dt;
      if (this.dead) return;
      // movement
      const fw = (inp.f ? 1 : 0) - (inp.b ? 1 : 0), st = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      const sprint = inp.sprint && fw > 0;
      let speed = (this.inWater ? 2.7 : sprint ? 6.3 : 4.3) * (1 + 0.08 * this.perk('swift'));
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      let wx = -s * fw + c * st, wz = -c * fw - s * st;
      const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
      const hasGlider = this.inv.has(I.GLIDER);
      this.gliding = hasGlider && inp.jump && !this.onGround && !this.inWater && this.vel.y < 0.5 && this.airT > 0.25;
      if (this.gliding) { speed = 9.5; if (!wl) { wx = -s * Math.cos(this.pitch); wz = -c * Math.cos(this.pitch); } }
      const acc = this.onGround ? 16 : (this.gliding ? 2.5 : 5);
      this.vel.x += (wx * speed - this.vel.x) * Math.min(1, acc * dt);
      this.vel.z += (wz * speed - this.vel.z) * Math.min(1, acc * dt);
      if (inp.jump && this.onGround && !this.inWater) { this.vel.y = 8.5; }
      else if (inp.jumpPressed && !this.onGround && !this.inWater && !this.djUsed && this.hasDJ() && (this.airT || 0) > 0.08) {
        this.vel.y = 8; this.djUsed = true; LL.sfx.place(42);
        g.particles.burst(this.pos.x, this.pos.y, this.pos.z, [140, 230, 255], 10, 2);
      }
      inp.jumpPressed = false;
      if (this.inWater && inp.jump) this.vel.y = Math.min(this.vel.y + 26 * dt, 3.6);
      const prevVy = this.vel.y;
      LL.physStep(w, this, dt, g.grav);
      if (this.gliding) { if (this.vel.y < -2.2) this.vel.y = -2.2; if (Math.random() < 0.3) g.particles.add(this.pos.x, this.pos.y + 1.6, this.pos.z, 0, 0, 0, [240, 250, 255], 0.5, 0); }
      this.airT = this.onGround ? 0 : (this.airT || 0) + dt;
      if (this.onGround) this.djUsed = false;
      const thr = Math.sqrt(14.5 * 14.5 + 2 * 28 * 3 * this.perk('light'));
      if (this.onGround && this.landVel < -thr && !this.inWater) {
        const dmg = Math.round((-this.landVel - thr) * 1.1);
        if (dmg > 0) { this.hurt(dmg, null, 'a long fall', 0); }
      }
      if (this.onGround && wl) { this.bob += dt * speed * 1.6; if (Math.floor(this.bob / Math.PI) !== this._step) { this._step = Math.floor(this.bob / Math.PI); const below = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z)); LL.sfx.step(below); } }
      if (this.pos.y < -12) g.onVoid();
      // targeting
      const cam = g.camera;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const ox = this.pos.x, oy = this.pos.y + this.eye, oz = this.pos.z;
      this.target = LL.raycast(w, ox, oy, oz, dir.x, dir.y, dir.z, 5);
      this.mobTarget = null;
      let best = this.target ? this.target.t : 3.6; if (best > 3.6) best = 3.6;
      for (const m of g.allMobs()) {
        if (m.dead) continue;
        const t = rayBox(ox, oy, oz, dir.x, dir.y, dir.z, m.pos.x - m.hw - 0.1, m.pos.y, m.pos.z - m.hw - 0.1, m.pos.x + m.hw + 0.1, m.pos.y + m.h, m.pos.z + m.hw + 0.1);
        if (t >= 0 && t < best) { best = t; this.mobTarget = m; }
      }
      if (this.mobTarget) this.target = null;
      // primary action
      if (inp.attack && g.inputLocked()) {
        if (this.mobTarget) { if (this.atkCd <= 0) this.attack(this.mobTarget, dir); this.mine = null; }
        else if (this.target) this.mineStep(dt);
        else { this.mine = null; if (inp.attackPressed) this.swing = 1; }
      } else { this.mine = null; this.mineP = 0; }
      inp.attackPressed = false;
      if (inp.use && g.inputLocked() && this.useCd <= 0) this.use();
      // view model
      this.refreshViewModel();
      this.swing = Math.max(0, this.swing - dt * 4);
      const sw = Math.sin(this.swing * Math.PI);
      const bobA = this.onGround ? Math.sin(this.bob) * 0.025 : 0;
      this.vm.position.set(0.52 + bobA, -0.5 - Math.abs(bobA) - sw * 0.12, -0.78 - sw * 0.1);
      this.vm.rotation.set(-sw * 0.9, sw * 0.3, 0);
      if (this.vmMesh) {
        const lv = w.lightAt(this.pos.x, this.pos.y + 1.5, this.pos.z);
        const b = LL.bright(Math.max((lv >> 4) * g.daylight, lv & 15, g.ambientLevel));
        const k = Math.min(1, b + 0.08); if (this.vmMesh.userData.base) this.vmMesh.material.color.copy(this.vmMesh.userData.base).multiplyScalar(k); else this.vmMesh.material.color.setScalar(k);
      }
    }
    attack(m, dir) {
      const h = this.inv.held(), tool = h && LL.toolOf(h.id);
      const dmg = (tool ? tool.dmg : 1) + this.perk('brawl');
      m.hurt(dmg, this.pos, tool && tool.kind === 'blade' ? 7 : 5);
      this.atkCd = tool && tool.kind === 'blade' ? 0.38 : 0.5;
      this.swing = 1;
      if (tool) this.wear();
    }
    wear() {
      const h = this.inv.held(); if (!h || h.dur == null) return;
      if (Math.random() < 0.25 * this.perk('tinker')) return;
      h.dur--; if (h.dur <= 0) { this.inv.s[this.inv.sel] = null; LL.sfx.breakTool(); this.game.toast(LL.itemName(h.id) + ' broke!', 'warn'); }
      this.game.ui.refresh();
    }
    mineStep(dt) {
      const t = this.target, g = this.game;
      const key = t.x + ',' + t.y + ',' + t.z;
      if (!this.mine || this.mine.key !== key || this.mine.id !== t.id) { this.mine = { key, id: t.id, x: t.x, y: t.y, z: t.z }; this.mineP = 0; }
      const time = LL.mineTime(t.id, this.inv.held()) / (1 + 0.15 * this.perk('quick'));
      if (time === Infinity) { if (this.swing <= 0) this.swing = 1; return; }
      this.mineP += dt / time;
      if (this.swing <= 0.05) { this.swing = 1; const c = LL.TAVG[LL.TSIDE[t.id]]; g.particles.burst(t.x + 0.5 + t.nx * 0.55, t.y + 0.5 + t.ny * 0.55, t.z + 0.5 + t.nz * 0.55, c, 3, 1.5); LL.sfx.dig(t.id, 0.5); }
      if (this.mineP >= 1) { this.breakBlock(t.x, t.y, t.z, t.id); this.mine = null; this.mineP = 0; }
    }
    breakBlock(x, y, z, id) {
      const g = this.game, held = this.inv.held(), b = BLOCKS[id];
      g.world.setBlock(x, y, z, 0);
      const c = LL.TAVG[LL.TSIDE[id]];
      g.particles.burst(x + 0.5, y + 0.5, z + 0.5, c, 14, 3);
      LL.sfx.dig(id, 1);
      if (LL.canHarvest(id, held) && b.drop != null) {
        const drops = typeof b.drop === 'function' ? b.drop(Math.random) : [[b.drop, 1]];
        const ore = [22, 23, 24, 25, 40, 44].includes(id) && Math.random() < 0.2 * this.perk('prospect');
        for (const [did, n] of drops) g.spawnDrop(did, ore ? n * 2 : n, x + 0.5, y + 0.3, z + 0.5);
        if (ore) g.toast('Prospector: double haul!', 'good');
      } else if (b.drop != null && b.tier) g.toast('You need a stronger pick for ' + b.name + '.', 'warn');
      if (id === B.BERRY_BUSH) g.world.setBlock(x, y, z, B.BARE_BUSH), g.regrow.push({ x, y, z, t: 240 });
      const tool = held && LL.toolOf(held.id);
      if (tool && b.hard > 0) this.wear();
      const above = g.world.getBlock(x, y + 1, z);
      if (RT[above] === 3) this.breakBlock(x, y + 1, z, above);
      if (id === B.HEARTH && g.hearth && g.hearth.x === x && g.hearth.y === y && g.hearth.z === z) { g.hearth = null; g.toast('Your hearth is gone. You will wake at the world\'s edge.', 'warn'); }
      g.onBlockBroken(id, x, y, z);
    }
    use() {
      const g = this.game, t = this.target, h = this.inv.held();
      this.useCd = 0.22;
      // interactive blocks first
      if (t) {
        const id = t.id;
        if (id === B.BENCH || id === B.KILN) { g.ui.openInventory(); return; }
        if (id === B.CACHE) { g.openCache(t); this.useCd = 0.5; return; }
        if (id === B.CHEST) { g.ui.openInventory(t.x + ',' + t.y + ',' + t.z); return; }
        if (id === B.WAY_GLOAM) { if (g.dimKey === 'wild') g.travel('gloam', t); else g.toast('The waystone is silent here.', 'warn'); this.useCd = 1; return; }
        if (id === B.WAY_SKY) { if (g.dimKey === 'wild') g.travel('sky', t); else g.toast('The waystone is silent here.', 'warn'); this.useCd = 1; return; }
        if (id === B.WAY_RETURN) { g.travel('wild', t); this.useCd = 1; return; }
        if (id === B.ALTAR || id === B.ALTAR_LIT) { g.useAltar(t, h); this.useCd = 1; return; }
        if (id === B.HEARTH) { g.setHearth(t.x, t.y, t.z); this.useCd = 0.6; return; }
      }
      if (!h) return;
      const it = LL.ITEMS[h.id];
      if (it.bp) {
        if (g.known[it.bp]) { g.toast('You already know this one.'); return; }
        g.known[it.bp] = true; this.inv.useHeld(1); LL.sfx.kindle(); this.useCd = 0.8;
        g.toast('Learned: ' + LL.itemName(it.bp) + '. Find it in your crafting list.', 'good'); LL.Prog.addXP(g, 30, 'blueprint'); g.ui.refresh(); return;
      }
      if (it.armor) {
        const sl = it.armor.slot, old = this.equip[sl];
        this.equip[sl] = h; this.inv.s[this.inv.sel] = old; LL.sfx.place(65); this.useCd = 0.5;
        g.toast('Equipped ' + it.name + ' (armor ' + this.armor() + ')'); g.ui.refresh(); return;
      }
      if (h.id === LL.I.SEED) {
        const soil = [B.TURF, B.LOAM, B.MIRE_TURF, B.SNOWY_TURF, B.SKYGRASS, B.MUD, B.MYCEL];
        if (t && t.ny === 1 && soil.includes(t.id) && !g.world.getBlock(t.x, t.y + 1, t.z)) {
          g.world.setBlock(t.x, t.y + 1, t.z, B.CROP0); g.addCrop(t.x, t.y + 1, t.z);
          this.inv.useHeld(1); this.swing = 1; LL.sfx.place(1); g.stats.planted++; g.ui.refresh();
          if (g.stats.planted === 1) g.toast('Sunroot grows only in light. Plant near lanterns or in the sun.', 'lore');
        }
        return;
      }
      if (it.food) {
        if (this.vigor >= this.maxVigor && !(it.warm && this.warmth < 95)) { if (!this._fullMsg) { g.toast('You are not hungry.'); this._fullMsg = true; setTimeout(() => this._fullMsg = false, 3000); } return; }
        this.heal(it.food * (1 + 0.5 * this.perk('forager'))); if (it.warm) this.warmth = Math.min(100, this.warmth + it.warm);
        this.inv.useHeld(1); LL.sfx.eat(); this.useCd = 0.7; this.swing = 1;
        g.particles.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, LL.rgb(it.color), 6, 1.5);
        g.ui.refresh(); return;
      }
      if (t && LL.isBlockItem(h.id)) {
        const nx = t.x + t.nx, ny = t.y + t.ny, nz = t.z + t.nz;
        let tx = nx, ty = ny, tz = nz;
        if (RT[t.id] === 3 && t.id !== B.SPORE_LAMP) { tx = t.x; ty = t.y; tz = t.z; }
        const cur = g.world.getBlock(tx, ty, tz);
        if (cur && RT[cur] !== 3 && RT[cur] !== 4) return;
        if (ty < 1 || ty >= LL.H) return;
        const id = h.id;
        if (RT[id] === 3) { const below = g.world.getBlock(tx, ty - 1, tz); if (!LL.SOLID[below]) return; }
        if (LL.SOLID[id]) {
          const box = (x, y, z, hw, hh) => tx + 1 > x - hw && tx < x + hw && ty + 1 > y && ty < y + hh && tz + 1 > z - hw && tz < z + hw;
          if (box(this.pos.x, this.pos.y, this.pos.z, this.hw, this.h)) return;
          for (const m of g.mobs) if (box(m.pos.x, m.pos.y, m.pos.z, m.hw, m.h)) return;
        }
        g.world.setBlock(tx, ty, tz, id);
        this.inv.useHeld(1); this.swing = 1; this.useCd = 0.2;
        LL.sfx.place(id); g.ui.refresh();
        g.onBlockPlaced(id, tx, ty, tz);
      }
    }
  }
  LL.Player = Player;
})(window.LL);
