// Lastlight — creatures, drops, projectiles, particles
'use strict';
(function (LL) {
  const B = LL.B, I = LL.I;
  const V3 = THREE.Vector3;

  // ---------- physics ----------
  function sweep(world, e, axis, d) {
    if (d === 0) return false;
    const p = e.pos;
    if (axis === 0) p.x += d; else if (axis === 1) p.y += d; else p.z += d;
    const x0 = Math.floor(p.x - e.hw), x1 = Math.floor(p.x + e.hw - 1e-7);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + e.h - 1e-7);
    const z0 = Math.floor(p.z - e.hw), z1 = Math.floor(p.z + e.hw - 1e-7);
    let hit = false;
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!LL.SOLID[world.getBlock(x, y, z)]) continue;
      hit = true;
      if (axis === 0) { if (d > 0) p.x = Math.min(p.x, x - e.hw - 1e-4); else p.x = Math.max(p.x, x + 1 + e.hw + 1e-4); }
      else if (axis === 1) { if (d > 0) p.y = Math.min(p.y, y - e.h - 1e-4); else p.y = Math.max(p.y, y + 1); }
      else { if (d > 0) p.z = Math.min(p.z, z - e.hw - 1e-4); else p.z = Math.max(p.z, z + 1 + e.hw + 1e-4); }
    }
    return hit;
  }
  LL.boxBlocked = function (world, x, y, z, hw, h) {
    for (let yy = Math.floor(y); yy <= Math.floor(y + h - 1e-7); yy++) for (let zz = Math.floor(z - hw); zz <= Math.floor(z + hw - 1e-7); zz++) for (let xx = Math.floor(x - hw); xx <= Math.floor(x + hw - 1e-7); xx++) if (LL.SOLID[world.getBlock(xx, yy, zz)]) return true;
    return false;
  };
  LL.physStep = function (world, e, dt, grav) {
    const wid = world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y + Math.min(0.5, e.h * 0.5)), Math.floor(e.pos.z));
    e.inWater = LL.RT[wid] === 4;
    if (!e.fly) {
      e.vel.y -= (e.inWater ? 9 : 28) * grav * dt;
      if (e.inWater) { e.vel.y = Math.max(e.vel.y, -3); }
    }
    if (e.vel.y < -55) e.vel.y = -55;
    const mx = Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z)) * dt;
    const steps = Math.max(1, Math.ceil(mx / 0.4));
    e.onGround = false; e.hitWall = false; e.landVel = 0;
    const sd = dt / steps;
    for (let s = 0; s < steps; s++) {
      const vy = e.vel.y;
      if (sweep(world, e, 1, vy * sd)) { if (vy < 0) { e.onGround = true; e.landVel = vy; } e.vel.y = 0; }
      if (sweep(world, e, 0, e.vel.x * sd)) { e.vel.x = 0; e.hitWall = true; }
      if (sweep(world, e, 2, e.vel.z * sd)) { e.vel.z = 0; e.hitWall = true; }
    }
  };

  // ---------- model helpers ----------
  const FSH = [0.8, 0.8, 1, 0.55, 0.9, 0.9];
  function cuboid(w, h, d, hex, ox = 0, oy = 0, oz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(ox, oy, oz);
    const c = new THREE.Color(hex), cols = [];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) cols.push(c.r * FSH[f], c.g * FSH[f], c.b * FSH[f]);
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }
  function part(parent, mat, w, h, d, hex, x, y, z, pivotY) {
    const g = cuboid(w, h, d, hex, 0, pivotY !== undefined ? -h / 2 : 0, 0);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); return m;
  }
  const eyeMat = hex => new THREE.MeshBasicMaterial({ color: hex, fog: true });

  const BUILD = {
    gloomling(m) {
      const g = m.group, mat = m.mat;
      m.body = part(g, mat, 0.62, 0.95, 0.42, 0x1f1630, 0, 1.05, 0);
      m.head = part(g, mat, 0.56, 0.5, 0.5, 0x281c3c, 0, 1.78, 0);
      const em = eyeMat(0xff5ae0); m.extraMats.push(em);
      part(m.head, em, 0.12, 0.06, 0.02, 0, -0.13, 0.02, 0.26); part(m.head, em, 0.12, 0.06, 0.02, 0, 0.13, 0.02, 0.26);
      m.armL = part(g, mat, 0.13, 0.95, 0.13, 0x1a1228, -0.4, 1.45, 0, 0.45);
      m.armR = part(g, mat, 0.13, 0.95, 0.13, 0x1a1228, 0.4, 1.45, 0, 0.45);
      m.legL = part(g, mat, 0.18, 0.6, 0.18, 0x16101f, -0.16, 0.6, 0, 0.3);
      m.legR = part(g, mat, 0.18, 0.6, 0.18, 0x16101f, 0.16, 0.6, 0, 0.3);
      for (let i = 0; i < 4; i++) part(g, mat, 0.08, 0.25, 0.08, 0x3a2456, (i - 1.5) * 0.14, 2.1 + (i % 2) * 0.06, -0.05).rotation.z = (i - 1.5) * 0.3;
    },
    brute(m) {
      const g = m.group, mat = m.mat;
      m.body = part(g, mat, 1.1, 1.2, 0.8, 0x1a1226, 0, 1.55, 0);
      part(g, mat, 1.3, 0.5, 0.9, 0x22183a, 0, 2.2, -0.05);
      m.head = part(g, mat, 0.6, 0.55, 0.6, 0x241a36, 0, 2.35, 0.35);
      const em = eyeMat(0xff4ab0), core = eyeMat(0xb04aff); m.extraMats.push(em, core);
      part(m.head, em, 0.14, 0.07, 0.02, 0, -0.15, 0.03, 0.31); part(m.head, em, 0.14, 0.07, 0.02, 0, 0.15, 0.03, 0.31);
      part(m.body, core, 0.35, 0.35, 0.05, 0, 0, 0.1, 0.41);
      m.armL = part(g, mat, 0.32, 1.5, 0.32, 0x16101f, -0.75, 2.1, 0, 0.75);
      m.armR = part(g, mat, 0.32, 1.5, 0.32, 0x16101f, 0.75, 2.1, 0, 0.75);
      m.legL = part(g, mat, 0.36, 0.95, 0.36, 0x120c1a, -0.3, 0.95, 0, 0.5);
      m.legR = part(g, mat, 0.36, 0.95, 0.36, 0x120c1a, 0.3, 0.95, 0, 0.5);
      for (let i = 0; i < 5; i++) part(g, mat, 0.12, 0.4, 0.12, 0x3a2456, (i - 2) * 0.24, 2.6, -0.3).rotation.z = (i - 2) * 0.25;
    },
    buck(m) {
      const g = m.group, mat = m.mat;
      m.body = part(g, mat, 0.7, 0.6, 1.2, 0x7a5a3a, 0, 0.95, 0);
      part(g, mat, 0.5, 0.14, 1.0, 0x4f7a3a, 0, 1.3, -0.05);
      for (let i = 0; i < 5; i++) part(g, mat, 0.12, 0.12, 0.12, i % 2 ? 0xc43a4a : 0x5a9a40, (i % 2 ? 0.12 : -0.14), 1.42, -0.4 + i * 0.2);
      m.head = part(g, mat, 0.38, 0.4, 0.5, 0x86643f, 0, 1.38, 0.74);
      part(m.head, mat, 0.22, 0.2, 0.2, 0x5a4026, 0, -0.08, 0.32);
      const ant = 0xe0d0a8;
      [-1, 1].forEach(s => { part(m.head, mat, 0.06, 0.4, 0.06, ant, 0.14 * s, 0.38, -0.05); part(m.head, mat, 0.25, 0.06, 0.06, ant, 0.24 * s, 0.5, -0.05); part(m.head, mat, 0.06, 0.2, 0.06, ant, 0.34 * s, 0.6, -0.05); });
      const em = eyeMat(0x111111); m.extraMats.push(em);
      part(m.head, em, 0.04, 0.06, 0.06, 0, -0.19, 0.06, 0.12); part(m.head, em, 0.04, 0.06, 0.06, 0, 0.19, 0.06, 0.12);
      m.legs = [[-0.24, 0.45], [0.24, 0.45], [-0.24, -0.45], [0.24, -0.45]].map(([x, z]) => part(g, mat, 0.15, 0.7, 0.15, 0x5a4026, x, 0.7, z, 0.35));
      part(g, mat, 0.18, 0.18, 0.12, 0xf0ead8, 0, 1.1, -0.65);
    },
    crawler(m) {
      const g = m.group, mat = m.mat;
      m.body = part(g, mat, 1.0, 0.42, 0.8, 0x1d3434, 0, 0.55, -0.1);
      m.head = part(g, mat, 0.6, 0.36, 0.45, 0x264444, 0, 0.55, 0.5);
      const em = eyeMat(0x5afff0); m.extraMats.push(em);
      [[-0.18, 0.08], [0.18, 0.08], [-0.08, 0.16], [0.08, 0.16]].forEach(([x, y]) => part(m.head, em, 0.08, 0.08, 0.02, 0, x, y - 0.05, 0.23));
      for (let i = 0; i < 4; i++) part(m.body, em, 0.1, 0.03, 0.1, 0, -0.3 + i * 0.2, 0.22, -0.1 + (i % 2) * 0.2);
      m.legs = [];
      for (let i = 0; i < 6; i++) {
        const s = i < 3 ? -1 : 1, z = -0.35 + (i % 3) * 0.32;
        const pivot = new THREE.Group(); pivot.position.set(0.45 * s, 0.6, z); g.add(pivot);
        const l = part(pivot, mat, 0.7, 0.08, 0.08, 0x142626, 0.35 * s, 0.1, 0); l.rotation.z = 0.5 * s;
        const l2 = part(pivot, mat, 0.08, 0.6, 0.08, 0x142626, 0.68 * s, -0.15, 0);
        pivot.userData.s = s; m.legs.push(pivot);
      }
    },
    wisp(m) {
      const g = m.group, mat = m.mat;
      const core = eyeMat(0xe8faff); m.extraMats.push(core);
      m.body = part(g, core, 0.42, 0.42, 0.42, 0, 0, 0.45, 0);
      const shell = new THREE.MeshBasicMaterial({ color: 0x9adfff, transparent: true, opacity: 0.35, depthWrite: false }); m.extraMats.push(shell);
      m.shell = part(g, shell, 0.8, 0.8, 0.8, 0, 0, 0.45, 0);
      m.orbs = [];
      for (let i = 0; i < 3; i++) m.orbs.push(part(g, mat, 0.16, 0.16, 0.16, 0xcfefff, 0, 0.45, 0));
      m.tail = [];
      for (let i = 0; i < 4; i++) m.tail.push(part(g, shell, 0.3 - i * 0.06, 0.3 - i * 0.06, 0.3 - i * 0.06, 0, 0, 0.45 - i * 0.25, -0.2 - i * 0.2));
    },
    maw(m) {
      const g = m.group, mat = m.mat;
      m.body = part(g, mat, 3, 3, 3, 0x140c1e, 0, 1.6, 0);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const s = part(g, mat, 0.4, 1.4, 0.4, 0x2a1840, Math.cos(a) * 1.8, 1.6, Math.sin(a) * 1.8); s.rotation.z = Math.cos(a) * 0.9; s.rotation.x = -Math.sin(a) * 0.9; }
      const white = eyeMat(0xfff0f8), pupil = eyeMat(0xb02aff), mouth = eyeMat(0xff3a6a);
      m.extraMats.push(white, pupil, mouth);
      m.eye = part(g, white, 1.4, 1.0, 0.1, 0, 0, 2.0, 1.52);
      m.pupil = part(m.eye, pupil, 0.45, 0.6, 0.06, 0, 0, 0, 0.06);
      m.mouth = part(g, mouth, 1.8, 0.25, 0.1, 0, 0, 0.9, 1.52);
      m.ring = new THREE.Group(); g.add(m.ring); m.ring.position.y = 1.6;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(m.ring, pupil, 0.3, 0.3, 0.3, 0, Math.cos(a) * 3, 0, Math.sin(a) * 3); }
    },
  };

  const DEF = LL.MOBDEF = {
    gloomling: { name: 'Gloomling', hp: 12, speed: 3.2, hw: 0.3, h: 1.9, hostile: true, dmg: 3, reach: 1.5, cd: 1.0, avoidLight: true, drops: r => r() < 0.65 ? [[I.DUSK_PEARL, 1]] : [] },
    brute: { name: 'Gloom Brute', hp: 36, speed: 2.5, hw: 0.55, h: 2.6, hostile: true, dmg: 6, reach: 2.0, cd: 1.5, avoidLight: true, tough: true, drops: r => [[I.GLOOM_HEART, 1], [I.DUSK_PEARL, 1 + (r() < 0.5 ? 1 : 0)]] },
    buck: { name: 'Bramblebuck', hp: 10, speed: 2.2, hw: 0.42, h: 1.4, passive: true, drops: r => [[I.RAW_VENISON, 1 + (r() < 0.5 ? 1 : 0)], ...(r() < 0.7 ? [[I.HIDE, 1 + (r() < 0.4 ? 1 : 0)]] : [])] },
    crawler: { name: 'Gloam Crawler', hp: 14, speed: 4.4, hw: 0.55, h: 0.8, hostile: true, dmg: 4, reach: 1.7, cd: 0.9, drops: r => [[I.SILK, 1 + (r() < 0.5 ? 1 : 0)]] },
    wisp: { name: 'Gale Wisp', hp: 10, speed: 4, hw: 0.35, h: 0.9, hostile: true, fly: true, drops: r => [[I.GALE_ESSENCE, 1]] },
    maw: { name: 'The Umbral Maw', hp: 240, speed: 5, hw: 1.6, h: 3.2, hostile: true, fly: true, boss: true, drops: () => [] },
  };

  let mobUid = 0;
  class Mob {
    constructor(type, x, y, z, game) {
      this.uid = ++mobUid;
      this.type = type; this.def = DEF[type]; this.game = game;
      this.hp = this.def.hp; this.hw = this.def.hw; this.h = this.def.h; this.fly = !!this.def.fly;
      this.pos = new V3(x, y, z); this.vel = new V3(); this.yaw = Math.random() * 6.28;
      this.onGround = false; this.t = Math.random() * 10; this.cd = 0; this.hurtT = 0; this.wanderT = 0; this.wdir = 0; this.fleeT = 0;
      this.dead = false; this.walk = 0; this.shield = 0; this.phase = 0; this.phaseT = 8; this.shootT = 2; this.id0 = Math.random() * 6.28;
      this.group = new THREE.Group();
      this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      this.extraMats = [];
      BUILD[type](this);
      game.scene.add(this.group);
      this.group.position.copy(this.pos);
    }
    remove() { if (this.puppet && this.def.boss) this.game.ui.bossHide(); this.dead = true; this.game.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.mat.dispose(); this.extraMats.forEach(m => m.dispose()); }
    hurt(dmg, from, kb = 6, attacker) {
      if (this.dead) return;
      if (this.puppet) {
        LL.Net.send({ t: 'mhit', to: this.owner, mid: this.uid, dmg, fx: from ? from.x : this.pos.x, fz: from ? from.z : this.pos.z, kb });
        this.hurtT = 0.3; LL.sfx.hit(this.def.boss ? 0.5 : 1);
        this.game.particles.burst(this.pos.x, this.pos.y + this.h * 0.6, this.pos.z, [140, 80, 200], 6, 2.5);
        return;
      }
      this.lastAttacker = attacker || null;
      if (this.shield > 0 && this.type !== 'maw') dmg *= 0.5;
      this.hp -= dmg; this.hurtT = 0.3;
      if (from) { const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1; const k = this.def.boss ? kb * 0.15 : kb; this.vel.x += dx / l * k; this.vel.z += dz / l * k; if (!this.fly) this.vel.y = Math.max(this.vel.y, 4.5); }
      if (this.def.passive) this.fleeT = 5;
      LL.sfx.hit(this.def.boss ? 0.5 : 1);
      this.game.particles.burst(this.pos.x, this.pos.y + this.h * 0.6, this.pos.z, this.type === 'buck' ? [200, 60, 60] : [140, 80, 200], 6, 2.5);
      if (this.hp <= 0) this.die();
    }
    die() {
      if (this.dying || this.dead) return; this.dying = true;
      const g = this.game, r = Math.random;
      this.game.particles.burst(this.pos.x, this.pos.y + this.h * 0.5, this.pos.z, this.type === 'gloomling' || this.type === 'maw' ? [40, 20, 60] : [220, 220, 230], this.def.boss ? 80 : 18, this.def.boss ? 8 : 3);
      const drops = this.def.drops(r);
      if (this.lastAttacker) LL.Net.send({ t: 'mdrops', to: this.lastAttacker, items: drops, type: this.type, x: this.pos.x, y: this.pos.y, z: this.pos.z });
      else {
        for (const [id, n] of drops) g.spawnDrop(id, n, this.pos.x, this.pos.y + 0.5, this.pos.z);
        if (this.type === 'gloomling' || this.type === 'brute') g.stats.gloom++;
        g.onKill(this.type);
      }
      if (this.def.boss) g.onBossDefeated(this);
      this.remove();
    }
    update(dt) {
      if (this.puppet) return this.puppetUpdate(dt);
      const g = this.game, w = g.world, P = this._tgt = g.targetFor(this);
      this.t += dt; this.cd -= dt; this.hurtT -= dt; this.shield -= dt;
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dy = (P.pos.y + 0.9) - (this.pos.y + this.h * 0.5);
      const dist = Math.hypot(dx, dz);
      const lv = w.lightAt(this.pos.x, this.pos.y + 0.5, this.pos.z);
      const light = Math.max((lv >> 4) * g.daylight, lv & 15);
      let wantX = 0, wantZ = 0, speed = this.def.speed;
      const alive = !P.dead;
      if (this.type === 'gloomling' || this.type === 'crawler' || this.type === 'brute') {
        const burnAt = this.type === 'brute' ? 13 : 10;
        if (this.type === 'brute') { this.snuffT = (this.snuffT || 0) - dt; if (this.snuffT <= 0) { this.snuffT = 0.8; this.snuff(); } }
        if (this.type !== 'crawler' && light >= burnAt && this.shield <= 0) {
          this.burnT = (this.burnT || 0) + dt;
          if (this.burnT > 0.25) { this.burnT = 0; this.hp -= 1; g.particles.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [30, 20, 40], 3, 1.5, -0.5); if (this.hp <= 0) { this.remove(); return; } }
        }
        if (alive && dist < 26 && Math.abs(dy) < 12) {
          wantX = dx / (dist || 1); wantZ = dz / (dist || 1);
          if (this.def.avoidLight && this.shield <= 0) {
            const nx = this.pos.x + wantX * 0.9, nz = this.pos.z + wantZ * 0.9;
            const nl = w.lightAt(nx, this.pos.y + 0.5, nz), nlight = Math.max((nl >> 4) * g.daylight, nl & 15);
            const limit = this.type === 'brute' ? 12 : 8;
            if (nlight >= limit && nlight > light) { wantX = 0; wantZ = 0; this.balk = (this.balk || 0) + dt; }
            if (light >= burnAt) { wantX = -dx / (dist || 1); wantZ = -dz / (dist || 1); }
          }
          if (dist < this.def.reach && Math.abs(dy) < 1.8 && this.cd <= 0) { this.cd = this.def.cd; P.hurt(this.def.dmg, this.pos, this.def.name); this.attackAnim = 0.3; }
          if (dist < 0.6) { wantX *= 0.2; wantZ *= 0.2; }
        } else this.wander(dt);
        const ward = g.nearWard(this.pos, 16);
        if (ward && this.shield <= 0) { const wx = this.pos.x - ward.x, wz = this.pos.z - ward.z, wl = Math.hypot(wx, wz) || 1; wantX = wx / wl; wantZ = wz / wl; this.wdir = null; }
      } else if (this.type === 'buck') {
        if (this.fleeT > 0 && alive) { this.fleeT -= dt; wantX = -dx / (dist || 1); wantZ = -dz / (dist || 1); speed *= 1.9; }
        else this.wander(dt);
      } else if (this.type === 'wisp') {
        this.flyAI(dt, dx, dz, dist, dy, alive); return this.anim(dt, lv);
      } else if (this.type === 'maw') {
        this.mawAI(dt, dx, dz, dist, dy, alive); return this.anim(dt, lv);
      }
      if (wantX || wantZ) { this.yaw = Math.atan2(wantX, wantZ); }
      else if (this.wdir !== null && this.wanderMove) { wantX = Math.sin(this.wdir); wantZ = Math.cos(this.wdir); speed *= 0.45; this.yaw = this.wdir; }
      const acc = this.onGround ? 10 : 2;
      this.vel.x += (wantX * speed - this.vel.x) * Math.min(1, acc * dt);
      this.vel.z += (wantZ * speed - this.vel.z) * Math.min(1, acc * dt);
      if (this.hitWall && this.onGround && (wantX || wantZ)) this.vel.y = 8.2;
      if (this.inWater) this.vel.y = Math.min(this.vel.y + 30 * dt, 2.5);
      if (dist < this.hw + 0.35 && Math.abs(dy) < 1.5 && dist > 0.001) { const push = (this.hw + 0.35 - dist) * 6; this.vel.x -= dx / dist * push; this.vel.z -= dz / dist * push; }
      LL.physStep(w, this, dt, g.grav);
      if (this.pos.y < -20) { this.remove(); return; }
      this.anim(dt, lv);
    }
    puppetUpdate(dt) {
      const g = this.game;
      this.t += dt; this.hurtT -= dt;
      if (this.ptgt) {
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.lerp(this.ptgt, Math.min(1, dt * 10));
        this.vel.set((this.pos.x - ox) / Math.max(dt, 1e-3), 0, (this.pos.z - oz) / Math.max(dt, 1e-3));
      }
      if (this.def.boss) g.ui.boss(this.hp / this.def.hp);
      this.anim(dt, g.world.lightAt(this.pos.x, this.pos.y + 0.5, this.pos.z));
    }
    snuff() {
      const g = this.game, w = g.world;
      const px = Math.floor(this.pos.x), py = Math.floor(this.pos.y), pz = Math.floor(this.pos.z);
      for (let y = 0; y <= 3; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
        const id = w.getBlock(px + x, py + y, pz + z);
        if (id === B.LANTERN || id === B.LUMITE_LAMP) {
          w.setBlock(px + x, py + y, pz + z, 0);
          g.spawnDrop(id, 1, px + x + 0.5, py + y + 0.5, pz + z + 0.5);
          g.particles.burst(px + x + 0.5, py + y + 0.5, pz + z + 0.5, [40, 20, 60], 14, 2.5);
          LL.sfx.roar(); g.toast('A Gloom Brute snuffed out a lantern!', 'warn');
          return;
        }
      }
    }
    wander(dt) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 4; this.wanderMove = Math.random() < 0.6; this.wdir = Math.random() * Math.PI * 2; }
    }
    flyAI(dt, dx, dz, dist, dy, alive) {
      const g = this.game, P = this._tgt || g.player;
      let tx, ty, tz;
      if (alive && dist < 34) {
        const a = this.t * 0.4 + this.id0;
        tx = P.pos.x + Math.cos(a) * 9; tz = P.pos.z + Math.sin(a) * 9; ty = P.pos.y + 3.5 + Math.sin(this.t * 1.3) * 1.2;
        this.shootT -= dt;
        if (this.shootT <= 0 && dist < 26) {
          this.shootT = 2.6 + Math.random() * 1.2;
          const o = new V3(this.pos.x, this.pos.y + 0.45, this.pos.z), t = new V3(P.pos.x, P.pos.y + 1.0, P.pos.z);
          const v = t.sub(o).normalize().multiplyScalar(13);
          g.spawnProjectile('gust', o, v);
        }
      } else { tx = this.pos.x + Math.sin(this.t * 0.3) * 4; tz = this.pos.z + Math.cos(this.t * 0.3) * 4; ty = this.pos.y; }
      const vx = tx - this.pos.x, vy = ty - this.pos.y, vz = tz - this.pos.z, l = Math.hypot(vx, vy, vz) || 1;
      const sp = Math.min(this.def.speed, l * 2);
      this.vel.x += (vx / l * sp - this.vel.x) * Math.min(1, 3 * dt);
      this.vel.y += (vy / l * sp - this.vel.y) * Math.min(1, 3 * dt);
      this.vel.z += (vz / l * sp - this.vel.z) * Math.min(1, 3 * dt);
      this.yaw = Math.atan2(dx, dz);
      LL.physStep(g.world, this, dt, 0);
    }
    mawAI(dt, dx, dz, dist, dy, alive) {
      const g = this.game, P = g.player, A = g.altarPos;
      this.phaseT -= dt;
      if (!alive) { this.vel.multiplyScalar(0.9); this.group.position.copy(this.pos); return; }
      let tx, ty, tz, sp = this.def.speed;
      if (this.phase === 0) { // circle & shoot
        const a = this.t * 0.35;
        tx = A.x + Math.cos(a) * 11; tz = A.z + Math.sin(a) * 11; ty = A.y + 9 + Math.sin(this.t) * 1.5;
        this.shootT -= dt;
        if (this.shootT <= 0) {
          this.shootT = this.hp < this.def.hp * 0.5 ? 1.3 : 2.0;
          for (let k = -1; k <= 1; k++) {
            const o = new V3(this.pos.x, this.pos.y + 1.6, this.pos.z), t = new V3(P.pos.x + k * 2, P.pos.y + 1, P.pos.z);
            g.spawnProjectile('shade', o, t.sub(o).normalize().multiplyScalar(9));
          }
        }
        if (this.phaseT <= 0) { this.phase = 1; this.phaseT = 2.4; LL.sfx.roar(); g.toast('The Maw dives!', 'warn'); }
      } else if (this.phase === 1) { // dive at player
        tx = P.pos.x; ty = P.pos.y; tz = P.pos.z; sp = 13;
        if (Math.hypot(dx, dz) < 2.2 && Math.abs(P.pos.y - this.pos.y) < 3 && this.cd <= 0) { this.cd = 1.2; P.hurt(5, this.pos, 'The Umbral Maw', 14); }
        if (this.phaseT <= 0) { this.phase = 2; this.phaseT = 4.5; }
      } else { // grounded, vulnerable
        tx = this.pos.x; tz = this.pos.z; ty = this.pos.y; sp = 0;
        this.vel.y -= 20 * dt;
        if (this.phaseT <= 0) {
          this.phase = 0; this.phaseT = 7 + Math.random() * 3;
          if (this.hp < this.def.hp * 0.7) { for (let k = 0; k < 2; k++) { const m = g.spawnMob('gloomling', A.x + (Math.random() - 0.5) * 10, A.y + 1, A.z + (Math.random() - 0.5) * 10); if (m) m.shield = 25; } g.toast('Shadows spill from the Maw.', 'warn'); }
        }
      }
      if (this.phase !== 2) {
        const vx = tx - this.pos.x, vy = ty - this.pos.y, vz = tz - this.pos.z, l = Math.hypot(vx, vy, vz) || 1;
        const s = Math.min(sp, l * 2.5);
        this.vel.x += (vx / l * s - this.vel.x) * Math.min(1, 2.5 * dt);
        this.vel.y += (vy / l * s - this.vel.y) * Math.min(1, 2.5 * dt);
        this.vel.z += (vz / l * s - this.vel.z) * Math.min(1, 2.5 * dt);
      } else { this.vel.x *= 0.9; this.vel.z *= 0.9; }
      this.yaw = Math.atan2(dx, dz);
      LL.physStep(g.world, this, dt, 0);
      g.ui.boss(this.hp / this.def.hp);
    }
    anim(dt, lv) {
      const g = this.game;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.walk += sp * dt * 3;
      const sw = Math.sin(this.walk) * Math.min(1, sp / 2);
      if (this.legL) { this.legL.rotation.x = sw * 0.8; this.legR.rotation.x = -sw * 0.8; }
      if (this.armL) { this.armL.rotation.x = -sw * 0.6 + (this.attackAnim > 0 ? -1.4 : -0.2); this.armR.rotation.x = sw * 0.6 + (this.attackAnim > 0 ? -1.4 : -0.2); this.attackAnim -= dt; }
      if (this.legs && this.type === 'buck') this.legs.forEach((l, i) => l.rotation.x = (i === 0 || i === 3 ? sw : -sw) * 0.7);
      if (this.legs && this.type === 'crawler') this.legs.forEach((l, i) => { l.rotation.y = Math.sin(this.walk * 1.5 + i) * 0.35; });
      if (this.type === 'wisp') {
        this.orbs.forEach((o, i) => { const a = this.t * 3 + i * 2.09; o.position.set(Math.cos(a) * 0.6, 0.45 + Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.6); });
        this.shell.rotation.y += dt * 2; this.shell.rotation.x += dt * 1.3;
        this.tail.forEach((t, i) => { t.position.x = Math.sin(this.t * 4 - i) * 0.15 * i; });
      }
      if (this.type === 'maw') { this.ring.rotation.y += dt * 1.2; this.body.rotation.y = Math.sin(this.t) * 0.1; this.pupil.position.x = Math.sin(this.t * 0.7) * 0.3; this.mouth.scale.y = this.phase === 1 ? 3 : 1; }
      if (this.type === 'gloomling') this.group.position.y += Math.sin(this.t * 3) * 0.02;
      // lighting tint
      const l = Math.max((lv >> 4) * g.daylight, lv & 15, g.ambientLevel);
      const b = Math.min(1, LL.bright(l) + 0.06);
      if (this.hurtT > 0) this.mat.color.setRGB(1, 0.35, 0.35); else this.mat.color.setScalar(this.type === 'maw' ? Math.max(0.5, b) : b);
      this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.group.rotation.y = this.yaw;
    }
  }
  LL.Mob = Mob;

  // ---------- item drops ----------
  const geoCache = {}, matCache = {};
  function blockGeo(id) {
    if (geoCache[id]) return geoCache[id];
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv;
    const tiles = [LL.TSIDE[id], LL.TSIDE[id], LL.TTOP[id], LL.TBOT[id], LL.TSIDE[id], LL.TSIDE[id]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k, t = tiles[f];
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, ((t % 16) + 0.01 + u * 0.98) / 16, 1 - (Math.floor(t / 16) + 1 - (0.01 + v * 0.98)) / 16);
    }
    return (geoCache[id] = g);
  }
  function iconMat(id) {
    if (matCache[id]) return matCache[id];
    const t = new THREE.CanvasTexture(LL.icon(id)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return (matCache[id] = t);
  }
  LL.makeItemMesh = function (id, size = 0.28) {
    const it = LL.ITEMS[id];
    if (it && it.block && LL.RT[id] !== 3 && LL.RT[id] !== 4) {
      const m = new THREE.Mesh(blockGeo(id), new THREE.MeshBasicMaterial({ map: LL.atlasTex, alphaTest: 0.5, side: THREE.DoubleSide }));
      m.scale.setScalar(size); m.userData.cube = true; return m;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: iconMat(id), alphaTest: 0.5, side: THREE.DoubleSide }));
    m.scale.setScalar(size * 1.5); return m;
  };

  class Drop {
    constructor(game, id, n, dur, x, y, z) {
      this.game = game; this.id = id; this.n = n; this.dur = dur;
      this.pos = new V3(x, y, z); this.vel = new V3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3);
      this.hw = 0.12; this.h = 0.24; this.age = 0; this.dead = false;
      this.mesh = LL.makeItemMesh(id); game.scene.add(this.mesh);
    }
    update(dt) {
      const g = this.game; this.age += dt;
      this.vel.x *= Math.pow(0.05, dt); this.vel.z *= Math.pow(0.05, dt);
      LL.physStep(g.world, this, dt, g.grav);
      const P = g.player;
      const d = Math.hypot(P.pos.x - this.pos.x, P.pos.y + 0.8 - this.pos.y, P.pos.z - this.pos.z);
      if (this.age > 0.5 && !P.dead && d < 2.4) {
        if (d < 0.9) {
          const left = P.inv.add(this.id, this.n, this.dur);
          if (left < this.n) { LL.sfx.pickup(); g.ui.refresh(); g.onPickup(this.id, this.n - left); }
          this.n = left;
          if (!left) return this.remove();
        } else { const k = 9 * dt / d; this.pos.x += (P.pos.x - this.pos.x) * k; this.pos.y += (P.pos.y + 0.6 - this.pos.y) * k; this.pos.z += (P.pos.z - this.pos.z) * k; }
      }
      if (this.age > 300 || this.pos.y < -30) return this.remove();
      const lv = g.world.lightAt(this.pos.x, this.pos.y + 0.2, this.pos.z);
      const b = LL.bright(Math.max((lv >> 4) * g.daylight, lv & 15, g.ambientLevel));
      this.mesh.material.color.setScalar(Math.min(1, b + 0.1));
      this.mesh.position.set(this.pos.x, this.pos.y + 0.18 + Math.sin(this.age * 3) * 0.05, this.pos.z);
      if (this.mesh.userData.cube) this.mesh.rotation.y = this.age * 1.5;
      else this.mesh.quaternion.copy(g.camera.quaternion);
    }
    remove() { this.dead = true; this.game.scene.remove(this.mesh); this.mesh.material.dispose(); }
  }
  LL.Drop = Drop;

  // ---------- projectiles ----------
  class Projectile {
    constructor(game, kind, pos, vel) {
      this.game = game; this.kind = kind; this.pos = pos.clone(); this.vel = vel.clone(); this.life = 6; this.dead = false;
      const col = kind === 'gust' ? 0xcff4ff : 0x7a2aff;
      this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
      game.scene.add(this.mesh);
    }
    update(dt) {
      const g = this.game, P = this._tgt || g.player;
      this.life -= dt;
      if (this.kind === 'shade' && !P.dead) {
        const t = new V3(P.pos.x, P.pos.y + 1, P.pos.z).sub(this.pos).normalize().multiplyScalar(9);
        this.vel.lerp(t, Math.min(1, dt * 0.9));
      }
      this.pos.addScaledVector(this.vel, dt);
      this.mesh.position.copy(this.pos); this.mesh.rotation.x += dt * 5; this.mesh.rotation.y += dt * 7;
      if (Math.random() < 0.5) g.particles.add(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, this.kind === 'gust' ? [220, 245, 255] : [120, 50, 220], 0.4, 0);
      if (LL.SOLID[g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))] || this.life <= 0) return this.remove(true);
      const dx = P.pos.x - this.pos.x, dy = P.pos.y + 0.9 - this.pos.y, dz = P.pos.z - this.pos.z;
      if (!P.dead && Math.abs(dx) < 0.6 && Math.abs(dy) < 1.1 && Math.abs(dz) < 0.6) {
        if (this.kind === 'gust') { P.hurt(2, this.pos, 'a Gale Wisp', 0); const l = Math.hypot(this.vel.x, this.vel.z) || 1; P.vel.x += this.vel.x / l * 11; P.vel.z += this.vel.z / l * 11; P.vel.y = 7; }
        else P.hurt(4, this.pos, 'The Umbral Maw');
        this.remove(true);
      }
    }
    remove(burst) {
      this.dead = true; this.game.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose();
      if (burst) this.game.particles.burst(this.pos.x, this.pos.y, this.pos.z, this.kind === 'gust' ? [220, 245, 255] : [120, 50, 220], 10, 3);
    }
  }
  LL.Projectile = Projectile;

  // ---------- particles ----------
  class Particles {
    constructor(scene) {
      this.max = 900; this.list = [];
      this.geo = new THREE.BufferGeometry();
      this.posA = new Float32Array(this.max * 3); this.colA = new Float32Array(this.max * 3);
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.posA, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.colA, 3));
      this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, sizeAttenuation: true }));
      this.pts.frustumCulled = false;
      scene.add(this.pts);
    }
    add(x, y, z, vx, vy, vz, c, life, grav = 1) { if (this.list.length >= this.max) this.list.shift(); this.list.push({ x, y, z, vx, vy, vz, c, life, grav }); }
    burst(x, y, z, c, n, sp = 2, grav = 1) {
      for (let i = 0; i < n; i++) { const j = 0.85 + Math.random() * 0.3; this.add(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp, [c[0] * j, c[1] * j, c[2] * j], 0.5 + Math.random() * 0.6, grav); }
    }
    update(dt, bright) {
      const L = this.list; let w = 0;
      for (let i = 0; i < L.length; i++) {
        const p = L[i]; p.life -= dt; if (p.life <= 0) continue;
        p.vy -= 14 * p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        L[w++] = p;
      }
      L.length = w;
      for (let i = 0; i < w; i++) {
        const p = L[i];
        this.posA[i * 3] = p.x; this.posA[i * 3 + 1] = p.y; this.posA[i * 3 + 2] = p.z;
        this.colA[i * 3] = p.c[0] / 255 * bright; this.colA[i * 3 + 1] = p.c[1] / 255 * bright; this.colA[i * 3 + 2] = p.c[2] / 255 * bright;
      }
      this.geo.setDrawRange(0, w);
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    }
    clear() { this.list.length = 0; }
  }
  LL.Particles = Particles;
})(window.LL);
