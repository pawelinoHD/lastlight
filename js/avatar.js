// Lastlight — player character: pixel-art textured model with armor, held item and animation
'use strict';
(function (LL) {
  const OPTIONS = LL.LOOK_OPTIONS = {
    skin: ['#f2c9a0', '#e0ac7e', '#c68b5c', '#9c6a42', '#6e4a30', '#4a3120'],
    hair: ['#2a1d14', '#5a3a22', '#9a6a36', '#d8b060', '#e8e0d0', '#a02a1e', '#3a3a52', '#6a8a3a'],
    style: ['Short', 'Long', 'Tuft', 'Braid'],
    eyes: ['#3a6aa8', '#4a8a3a', '#6a4a2a', '#8a3ab8', '#2a2a2a'],
    shirt: ['#b0412e', '#3e6a9a', '#4f7a3a', '#c88a2a', '#6a3a8a', '#2e5a5a', '#d8d0c0', '#3a3a3a'],
    pants: ['#3a3a52', '#5a4030', '#2e3a2a', '#4a4a4a', '#6a5a3a', '#1e2a3a'],
  };
  LL.DEFAULT_LOOK = { skin: 1, hair: 1, style: 0, eyes: 0, shirt: 0, pants: 0 };
  LL.cleanLook = (o) => { const L = Object.assign({}, LL.DEFAULT_LOOK); if (o && typeof o === 'object') for (const k in L) { const v = o[k] | 0; if (v >= 0 && v < OPTIONS[k].length) L[k] = v; } return L; };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const sh = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

  // paint w×h pixel textures for one box: faces in BoxGeometry order +x, -x, +y, -y, +z(front), -z(back)
  function faceTex(w, h, fn) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), img = c.createImageData(w, h);
    const px = (x, y, col) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; };
    fn(px, w, h);
    c.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
  }
  const fill = (px, w, h, col, v = 0) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = v ? 1 + ((x * 7 + y * 13) % 5 - 2) * v : 1; px(x, y, sh(col, k)); } };

  function skinParts(look) {
    const C = {}; for (const k of ['skin', 'hair', 'eyes', 'shirt', 'pants']) C[k] = rgb(OPTIONS[k][look[k]]);
    const boot = [74, 52, 34], belt = [58, 40, 26], buckle = [220, 180, 90];
    const style = look.style;
    const head = [
      faceTex(8, 8, (px, w, h) => { fill(px, w, h, C.skin); for (let y = 0; y < (style === 1 || style === 3 ? 6 : 3); y++) for (let x = 0; x < 8; x++) if (style !== 1 && style !== 3 || x > 2 || y < 3) px(x, y, sh(C.hair, 1 - (x % 3) * 0.04)); px(4, 4, sh(C.skin, 0.8)); }),
      faceTex(8, 8, (px, w, h) => { fill(px, w, h, C.skin); for (let y = 0; y < (style === 1 || style === 3 ? 6 : 3); y++) for (let x = 0; x < 8; x++) if (style !== 1 && style !== 3 || x < 5 || y < 3) px(x, y, sh(C.hair, 1 - (x % 3) * 0.04)); px(3, 4, sh(C.skin, 0.8)); }),
      faceTex(8, 8, (px, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px(x, y, sh(C.hair, 1 - ((x + y) % 3) * 0.05)); }),
      faceTex(8, 8, (px, w, h) => fill(px, w, h, C.skin)),
      faceTex(8, 8, (px, w, h) => {
        fill(px, w, h, C.skin);
        for (let x = 0; x < 8; x++) { px(x, 0, C.hair); px(x, 1, C.hair); }
        if (style === 2) { px(3, 2, C.hair); px(4, 2, C.hair); }
        if (style === 1 || style === 3) { px(0, 2, C.hair); px(7, 2, C.hair); px(0, 3, C.hair); px(7, 3, C.hair); }
        px(1, 3, sh(C.hair, 0.8)); px(2, 3, sh(C.hair, 0.8)); px(5, 3, sh(C.hair, 0.8)); px(6, 3, sh(C.hair, 0.8));
        px(1, 4, [245, 245, 240]); px(2, 4, C.eyes); px(5, 4, C.eyes); px(6, 4, [245, 245, 240]);
        px(3, 5, sh(C.skin, 0.85)); px(4, 5, sh(C.skin, 0.85));
        px(3, 6, [150, 80, 70]); px(4, 6, [150, 80, 70]);
        px(1, 5, sh(C.skin, 1.05)); px(6, 5, sh(C.skin, 1.05));
      }),
      faceTex(8, 8, (px, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px(x, y, y < (style === 1 || style === 3 ? 8 : 6) ? sh(C.hair, 1 - ((x * 3 + y) % 4) * 0.04) : C.skin); }),
    ];
    const torsoFront = (px, w, h) => {
      fill(px, w, h, C.shirt, 0.02);
      px(3, 0, C.skin); px(4, 0, C.skin); px(3, 1, C.skin); px(4, 1, C.skin); px(2, 0, sh(C.shirt, 0.7)); px(5, 0, sh(C.shirt, 0.7));
      for (let x = 0; x < 8; x++) px(x, 9, belt); px(3, 9, buckle); px(4, 9, buckle);
      for (let y = 10; y < 12; y++) for (let x = 0; x < 8; x++) px(x, y, sh(C.shirt, 0.85));
      for (let y = 2; y < 9; y++) px(4, y, sh(C.shirt, 0.85));
    };
    const torso = [
      faceTex(4, 12, (px, w, h) => { fill(px, w, h, C.shirt, 0.02); for (let x = 0; x < 4; x++) px(x, 9, belt); }),
      faceTex(4, 12, (px, w, h) => { fill(px, w, h, C.shirt, 0.02); for (let x = 0; x < 4; x++) px(x, 9, belt); }),
      faceTex(8, 4, (px, w, h) => { fill(px, w, h, C.shirt); px(3, 1, C.skin); px(4, 1, C.skin); px(3, 2, C.skin); px(4, 2, C.skin); }),
      faceTex(8, 4, (px, w, h) => fill(px, w, h, C.pants)),
      faceTex(8, 12, torsoFront),
      faceTex(8, 12, (px, w, h) => { fill(px, w, h, C.shirt, 0.02); for (let x = 0; x < 8; x++) px(x, 9, belt); if (style === 3) for (let y = 0; y < 6; y++) { px(3, y, C.hair); px(4, y, sh(C.hair, 0.85)); } }),
    ];
    const arm = (px, w, h) => { fill(px, w, h, C.shirt, 0.02); for (let x = 0; x < w; x++) px(x, 7, sh(C.shirt, 0.75)); for (let y = 8; y < 12; y++) for (let x = 0; x < w; x++) px(x, y, C.skin); };
    const armParts = [faceTex(4, 12, arm), faceTex(4, 12, arm), faceTex(4, 4, (px, w, h) => fill(px, w, h, C.shirt)), faceTex(4, 4, (px, w, h) => fill(px, w, h, C.skin)), faceTex(4, 12, arm), faceTex(4, 12, arm)];
    const leg = (px, w, h) => { fill(px, w, h, C.pants, 0.02); for (let y = 9; y < 12; y++) for (let x = 0; x < w; x++) px(x, y, y === 9 ? sh(boot, 1.2) : boot); };
    const legParts = [faceTex(4, 12, leg), faceTex(4, 12, leg), faceTex(4, 4, (px, w, h) => fill(px, w, h, C.pants)), faceTex(4, 4, (px, w, h) => fill(px, w, h, sh(boot, 0.7))), faceTex(4, 12, leg), faceTex(4, 12, leg)];
    return { head, torso, armParts, legParts, C };
  }
  const matsOf = texs => texs.map(t => new THREE.MeshBasicMaterial({ map: t }));

  class Avatar {
    constructor(scene, look) {
      this.scene = scene; this.mats = []; this.walk = 0; this.swing = 0; this.t = Math.random() * 10;
      this.group = new THREE.Group(); scene.add(this.group);
      this.setLook(look || LL.DEFAULT_LOOK);
    }
    box(w, h, d, texs, parent, x, y, z, pivotTop) {
      const g = new THREE.BoxGeometry(w, h, d); if (pivotTop) g.translate(0, -h / 2, 0);
      const ms = Array.isArray(texs) ? matsOf(texs) : [new THREE.MeshBasicMaterial({ color: texs })];
      ms.forEach(m => this.mats.push(m));
      const m = new THREE.Mesh(g, ms.length === 1 ? ms[0] : ms); m.position.set(x, y, z); parent.add(m); return m;
    }
    clear() { while (this.group.children.length) { const c = this.group.children.pop(); c.traverse(o => { if (o.geometry && !o.isSprite && !o.userData.cube) o.geometry.dispose(); }); } this.mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); this.mats = []; this.heldId = -1; this.armorKey = ''; }
    setLook(look) {
      this.look = LL.cleanLook(look);
      this.clear();
      const P = skinParts(this.look), g = this.group;
      this.legL = this.box(0.24, 0.76, 0.24, P.legParts, g, -0.125, 0.76, 0, true);
      this.legR = this.box(0.24, 0.76, 0.24, P.legParts, g, 0.125, 0.76, 0, true);
      this.torso = this.box(0.5, 0.72, 0.26, P.torso, g, 0, 1.12, 0);
      this.headPivot = new THREE.Group(); this.headPivot.position.y = 1.48; g.add(this.headPivot);
      this.head = this.box(0.46, 0.46, 0.46, P.head, this.headPivot, 0, 0.23, 0);
      if (this.look.style === 2) this.box(0.14, 0.12, 0.14, OPTIONS.hair[this.look.hair], this.headPivot, 0.04, 0.5, 0.05);
      if (this.look.style === 1) this.box(0.48, 0.3, 0.1, OPTIONS.hair[this.look.hair], this.headPivot, 0, 0.0, -0.22);
      this.armL = this.box(0.2, 0.72, 0.2, P.armParts, g, -0.36, 1.46, 0, true);
      this.armR = this.box(0.2, 0.72, 0.2, P.armParts, g, 0.36, 1.46, 0, true);
      this.hand = new THREE.Group(); this.hand.position.set(0, -0.66, 0.06); this.armR.add(this.hand);
      this.armorGroup = new THREE.Group(); g.add(this.armorGroup);
    }
    setHeld(id) {
      if (id === this.heldId) return; this.heldId = id;
      while (this.hand.children.length) { const c = this.hand.children.pop(); if (c.material) c.material.dispose(); }
      if (!id) return;
      const m = LL.makeItemMesh(id, 0.3);
      if (m.userData.cube) { m.scale.setScalar(0.22); m.position.set(0, -0.04, 0.08); }
      else { m.scale.setScalar(0.5); m.rotation.set(0.2, Math.PI / 2 - 0.7, -Math.PI / 4); m.position.set(0, 0.02, 0.16); }
      this.heldMesh = m; this.hand.add(m);
    }
    setArmor(ids) {
      const key = (ids || []).join(','); if (key === this.armorKey) return; this.armorKey = key;
      const ag = this.armorGroup; while (ag.children.length) { const c = ag.children.pop(); if (c.geometry) c.geometry.dispose(); }
      this.armorParts = [];
      const col = id => id && LL.ITEMS[id] ? LL.ITEMS[id].color : null;
      const [hd, bd, ft] = ids || [];
      const plate = c => { const base = rgb(c); const t = faceTex(8, 8, (px, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const edge = x === 0 || y === 0 || x === 7 || y === 7; px(x, y, sh(base, edge ? 0.62 : y < 3 ? 1.18 : 1 - y * 0.03)); } px(1, 1, sh(base, 1.45)); px(2, 1, sh(base, 1.3)); px(1, 6, sh(base, 0.5)); px(6, 6, sh(base, 0.5)); px(6, 1, sh(base, 0.5)); }); return [t, t, t, t, t, t]; };
      const add = (w, h, d, c, parent, x, y, z) => { const m = this.box(w, h, d, plate(c), parent, x, y, z); this.armorParts.push(m); return m; };
      if (col(hd)) { add(0.52, 0.2, 0.52, col(hd), this.headPivot, 0, 0.42, 0); add(0.52, 0.14, 0.08, col(hd), this.headPivot, 0, 0.3, -0.23); }
      if (col(bd)) { add(0.56, 0.5, 0.32, col(bd), ag, 0, 1.24, 0); add(0.24, 0.2, 0.24, col(bd), this.armL, 0, -0.08, 0); add(0.24, 0.2, 0.24, col(bd), this.armR, 0, -0.08, 0); }
      if (col(ft)) { add(0.28, 0.24, 0.28, col(ft), this.legL, 0, -0.63, 0); add(0.28, 0.24, 0.28, col(ft), this.legR, 0, -0.63, 0); }
    }
    // s: {pos, yaw, pitch, speed, onGround, swing(0..1), light(0..1)}
    update(dt, s) {
      this.t += dt;
      this.walk += Math.min(s.speed, 7) * dt * 2.6;
      const amp = Math.min(1, s.speed / 3.5);
      const sw = Math.sin(this.walk) * amp;
      const air = !s.onGround && !s.swimming;
      this.legL.rotation.x = air ? 0.35 : sw * 0.75; this.legR.rotation.x = air ? -0.25 : -sw * 0.75;
      const swing = Math.sin(Math.min(1, s.swing) * Math.PI);
      this.armL.rotation.x = air ? -0.4 : -sw * 0.6; this.armL.rotation.z = air ? -0.3 : -0.04;
      this.armR.rotation.x = (air ? -0.4 : sw * 0.6) - swing * 1.7 - (this.heldId ? 0.25 : 0); this.armR.rotation.z = air ? 0.3 : 0.04; this.armR.rotation.y = -swing * 0.3;
      const breathe = Math.sin(this.t * 2) * 0.008;
      this.torso.scale.y = 1 + breathe;
      this.headPivot.rotation.x = -s.pitch * 0.85;
      this.group.position.set(s.pos.x, s.pos.y + Math.abs(Math.cos(this.walk)) * 0.04 * amp, s.pos.z);
      this.group.rotation.y = s.yaw + Math.PI;
      const k = s.light != null ? s.light : 1;
      for (const m of this.mats) { if (m.map) m.color.setScalar(k); else { m.userData.base = m.userData.base || m.color.clone(); m.color.copy(m.userData.base).multiplyScalar(k); } }
      if (s.hurt) for (const m of this.mats) m.color.setRGB(1, 0.4, 0.4);
    }
    set visible(v) { this.group.visible = v; }
    get visible() { return this.group.visible; }
    remove() { this.clear(); this.scene.remove(this.group); }
  }
  LL.Avatar = Avatar;

  // 2D front-view preview for the character customizer
  LL.drawLookPreview = function (canvas, look) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
    const P = skinParts(LL.cleanLook(look)), S = canvas.height / 32;
    const draw = (tex, x, y, w, h) => c.drawImage(tex.image, x * S, y * S, w * S, h * S);
    const ox = (canvas.width / S - 16) / 2;
    draw(P.head[4], ox + 4, 0, 8, 8);
    draw(P.torso[4], ox + 4, 8, 8, 12);
    draw(P.armParts[4], ox, 8, 4, 12); draw(P.armParts[4], ox + 12, 8, 4, 12);
    draw(P.legParts[4], ox + 4, 20, 4, 12); draw(P.legParts[4], ox + 8, 20, 4, 12);
    Object.values(P).forEach(v => Array.isArray(v) && v.forEach(t => t.dispose && t.dispose()));
  };
})(window.LL);
