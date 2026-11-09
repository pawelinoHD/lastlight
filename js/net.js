// Lastlight — multiplayer client
'use strict';
(function (LL) {
  const $ = id => document.getElementById(id);
  const V3 = THREE.Vector3;

  function hue(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; }
  function tagSprite(name, col) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = 'bold 30px Nunito, sans-serif'; const w = Math.min(250, x.measureText(name).width + 24);
    x.fillStyle = 'rgba(15,10,8,0.7)'; x.fillRect(128 - w / 2, 8, w, 46);
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 128, 32);
    const t = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(2, 0.5, 1); s.renderOrder = 20; return s;
  }
  function box(w, h, d, color, x, y, z, parent, mat, pivotTop) {
    const g = new THREE.BoxGeometry(w, h, d); if (pivotTop) g.translate(0, -h / 2, 0);
    const c = new THREE.Color(color), cols = [], sh = [0.8, 0.8, 1, 0.55, 0.9, 0.9];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) cols.push(c.r * sh[f], c.g * sh[f], c.b * sh[f]);
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); return m;
  }

  class Remote {
    constructor(game, id, name) {
      this.game = game; this.id = id; this.name = name; this.dim = null;
      this.pos = new V3(0, -999, 0); this.tgt = new V3(0, -999, 0); this.yaw = 0; this.pitch = 0; this.walk = 0; this.swing = 0; this.dead = false; this.seen = false;
      const hcol = 'hsl(' + hue(name) + ',55%,55%)';
      this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const g = this.group = new THREE.Group();
      const shirt = new THREE.Color('hsl(' + hue(name) + ',65%,40%)').getHex(), dark = new THREE.Color('hsl(' + ((hue(name) + 200) % 360) + ',30%,25%)').getHex();
      this.body = box(0.5, 0.7, 0.28, shirt, 0, 1.1, 0, g, this.mat);
      this.head = new THREE.Group(); this.head.position.y = 1.45; g.add(this.head);
      box(0.44, 0.44, 0.44, 0xc89a78, 0, 0.22, 0, this.head, this.mat);
      box(0.46, 0.14, 0.46, 0x3a2a1c, 0, 0.42, 0, this.head, this.mat);
      box(0.08, 0.06, 0.02, 0x1a1a1a, -0.1, 0.24, 0.225, this.head, this.mat); box(0.08, 0.06, 0.02, 0x1a1a1a, 0.1, 0.24, 0.225, this.head, this.mat);
      this.armL = box(0.18, 0.66, 0.18, shirt, -0.34, 1.42, 0, g, this.mat, true);
      this.armR = box(0.18, 0.66, 0.18, shirt, 0.34, 1.42, 0, g, this.mat, true);
      this.legL = box(0.2, 0.76, 0.2, dark, -0.13, 0.76, 0, g, this.mat, true);
      this.legR = box(0.2, 0.76, 0.2, dark, 0.13, 0.76, 0, g, this.mat, true);
      this.tag = tagSprite(name, hcol); this.tag.position.y = 2.25; g.add(this.tag);
      g.visible = false; game.scene.add(g);
      this.proxy = { pos: this.pos, vel: new V3(), dead: false, remote: id, hurt: (dmg, from, cause, kb) => LL.Net.send({ t: 'phurt', to: id, dmg, fx: from ? from.x : 0, fy: from ? from.y : 0, fz: from ? from.z : 0, cause, kb }) };
    }
    state(m) {
      this.dim = m.dim; this.tgt.set(m.x, m.y, m.z); this.yaw = m.yaw; this.pitch = m.pitch; this.dead = !!m.dead; this.proxy.dead = this.dead;
      if (m.sw) this.swing = 1;
      if (!this.seen || this.pos.distanceTo(this.tgt) > 12) { this.pos.copy(this.tgt); this.seen = true; }
    }
    update(dt) {
      const g = this.game, here = this.seen && this.dim === g.dimKey && !this.dead && g.state === 'play';
      this.group.visible = here; if (!here) return;
      const before = this.pos.clone();
      this.pos.lerp(this.tgt, Math.min(1, dt * 12));
      const sp = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / Math.max(dt, 1e-3);
      this.walk += sp * dt * 3;
      const sw = Math.sin(this.walk) * Math.min(1, sp / 3);
      this.legL.rotation.x = sw * 0.8; this.legR.rotation.x = -sw * 0.8;
      this.swing = Math.max(0, this.swing - dt * 4);
      this.armL.rotation.x = -sw * 0.7; this.armR.rotation.x = sw * 0.7 - Math.sin(this.swing * Math.PI) * 1.6;
      this.head.rotation.x = -this.pitch * 0.8;
      this.group.position.copy(this.pos); this.group.rotation.y = this.yaw + Math.PI;
      const lv = g.world.lightAt(this.pos.x, this.pos.y + 1, this.pos.z);
      this.mat.color.setScalar(Math.min(1, LL.bright(Math.max((lv >> 4) * g.daylight, lv & 15, g.ambientLevel)) + 0.12));
    }
    remove() { this.game.scene.remove(this.group); }
  }

  const Net = LL.Net = {
    ws: null, id: 0, name: '', players: new Map(), chatOpen: false, sendT: 0, mobT: 0, lastChest: {},
    connect(url, name) {
      return new Promise((resolve, reject) => {
        let ws;
        try { ws = new WebSocket(url); } catch (e) { return reject(e); }
        this.ws = ws; let welcomed = false;
        const to = setTimeout(() => { if (!welcomed) { ws.close(); reject(new Error('No answer from the server.')); } }, 8000);
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name }));
        ws.onerror = () => { if (!welcomed) { clearTimeout(to); reject(new Error('Could not connect to ' + url)); } };
        ws.onclose = () => { if (welcomed) this.onClose(); };
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.t === 'welcome') { welcomed = true; clearTimeout(to); this.id = m.id; this.name = m.name; for (const p of m.players) { const r = this.addPlayer(p.id, p.name); if (p.state) r.state(p.state); } resolve(m); return; }
          this.onMessage(m);
        };
      });
    },
    send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
    close() { const ws = this.ws; this.ws = null; if (ws) { ws.onclose = null; ws.close(); } this.players.forEach(p => p.remove()); this.players.clear(); this.clearPuppets(); },
    onClose() {
      const g = LL.game; this.ws = null;
      this.players.forEach(p => p.remove()); this.players.clear(); this.clearPuppets();
      if (g.mp && g.state !== 'title') { g.toast('Lost connection to the server.', 'warn'); g.onDisconnect(); }
    },
    addPlayer(id, name) { let r = this.players.get(id); if (!r) { r = new Remote(LL.game, id, name); this.players.set(id, r); } return r; },
    clearPuppets() { const g = LL.game; (g.puppets || []).forEach(m => m.remove()); g.puppets = []; },
    onMessage(m) {
      const g = LL.game;
      switch (m.t) {
        case 'join': this.addPlayer(m.id, m.name); this.chatLine(null, m.name + ' joined the world.'); LL.sfx.pickup(); break;
        case 'leave': { const r = this.players.get(m.id); if (r) { r.remove(); this.players.delete(m.id); } g.puppets = (g.puppets || []).filter(p => { if (p.owner === m.id) { p.remove(); return false; } return true; }); this.chatLine(null, m.name + ' left.'); break; }
        case 'pos': { const r = this.players.get(m.id); if (r) r.state(m); break; }
        case 'set': g.remoteSet(m.dim, m.x, m.y, m.z, m.id); break;
        case 'chest': g.remoteChest(m.dim, m.key, m.slots); break;
        case 'opened': g.opened[m.key] = 1; break;
        case 'victory': g.remoteVictory(m.name); break;
        case 'time': g.remoteTime(m.day, m.phase); break;
        case 'chat': this.chatLine(m.name, m.text); break;
        case 'mobs': this.puppetSync(m); break;
        case 'mhit': { const mob = g.mobs.find(x => x.uid === m.mid); if (mob && !mob.dead) mob.hurt(m.dmg, { x: m.fx, z: m.fz }, m.kb, m.from); break; }
        case 'mdrops': { for (const [id, n] of m.items) g.spawnDrop(id, n, m.x, m.y + 0.5, m.z); g.onKill(m.type); if (m.type === 'gloomling' || m.type === 'brute') g.stats.gloom++; break; }
        case 'phurt': if (!g.player.dead) g.player.hurt(m.dmg, { x: m.fx, y: m.fy, z: m.fz }, m.cause, m.kb); break;
      }
    },
    puppetSync(m) {
      const g = LL.game; g.puppets = g.puppets || [];
      const mine = g.puppets.filter(p => p.owner === m.from);
      if (m.dim !== g.dimKey) { mine.forEach(p => p.remove()); g.puppets = g.puppets.filter(p => p.owner !== m.from); return; }
      const seen = new Set();
      for (const s of m.list) {
        let p = mine.find(x => x.uid === s.u);
        if (!p) { if (!LL.MOBDEF[s.ty]) continue; p = new LL.Mob(s.ty, s.x, s.y, s.z, g); p.puppet = true; p.owner = m.from; p.uid = s.u; g.puppets.push(p); }
        p.ptgt = p.ptgt || new V3(); p.ptgt.set(s.x, s.y, s.z); p.yaw = s.yw; p.hp = s.hp; p.phase = s.ph || 0; p.pseen = performance.now();
        seen.add(s.u);
      }
      for (const p of mine) if (!seen.has(p.uid)) { p.remove(); }
      g.puppets = g.puppets.filter(p => !p.dead);
    },
    tick(dt) {
      const g = LL.game; if (!this.ws || g.state !== 'play') return;
      const P = g.player;
      this.sendT -= dt;
      if (this.sendT <= 0) {
        this.sendT = 0.1;
        this.send({ t: 'pos', dim: g.dimKey, x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2), pitch: +P.pitch.toFixed(2), sw: P.swing > 0.8 ? 1 : 0, dead: P.dead ? 1 : 0 });
      }
      this.mobT -= dt;
      if (this.mobT <= 0 && this.players.size) {
        this.mobT = 0.12;
        const list = g.mobs.filter(m => !m.dead).map(m => ({ u: m.uid, ty: m.type, x: +m.pos.x.toFixed(2), y: +m.pos.y.toFixed(2), z: +m.pos.z.toFixed(2), yw: +m.yaw.toFixed(2), hp: Math.ceil(m.hp), ph: m.phase || 0 }));
        this.send({ t: 'mobs', dim: g.dimKey, list });
      }
      this.players.forEach(r => r.update(dt));
      const now = performance.now();
      for (const p of g.puppets || []) { if (now - p.pseen > 2000) p.remove(); else p.update(dt); }
      g.puppets = (g.puppets || []).filter(p => !p.dead);
      $('online').textContent = (this.players.size + 1) + ' online';
    },
    // ---------- chat ----------
    chatLine(name, text) {
      const box = $('chatlog'); const d = document.createElement('div');
      if (name) { const b = document.createElement('b'); b.textContent = name + ': '; b.style.color = 'hsl(' + hue(name) + ',60%,65%)'; d.appendChild(b); d.appendChild(document.createTextNode(text)); }
      else { d.className = 'sys'; d.textContent = text; }
      box.appendChild(d); while (box.children.length > 8) box.removeChild(box.firstChild);
      d.dataset.t = Date.now(); box.classList.add('active'); clearTimeout(this._fade); this._fade = setTimeout(() => { if (!this.chatOpen) box.classList.remove('active'); }, 8000);
    },
    openChat() {
      const g = LL.game; this.chatOpen = true; g.releasePointer();
      $('chatlog').classList.add('active'); const i = $('chatin'); i.classList.remove('hidden'); i.value = ''; setTimeout(() => i.focus(), 0);
    },
    closeChat(sendIt) {
      const i = $('chatin'), g = LL.game;
      if (sendIt && i.value.trim()) this.send({ t: 'chat', text: i.value.trim() });
      i.classList.add('hidden'); i.blur(); this.chatOpen = false;
      this._fade = setTimeout(() => $('chatlog').classList.remove('active'), 5000);
      g.lockPointer();
    },
    renderList(show) {
      const el = $('plist'); el.classList.toggle('hidden', !show); if (!show) return;
      const dn = { wild: 'Wildlands', gloam: 'Gloam', sky: 'Skyreach' };
      const rows = [['★ ' + this.name, dn[LL.game.dimKey]]].concat([...this.players.values()].map(r => [r.name, r.dead ? 'fallen' : (dn[r.dim] || '…')]));
      el.innerHTML = '<b>Players online</b>' + rows.map(([n, d]) => '<div><span>' + n.replace(/</g, '') + '</span><i>' + d + '</i></div>').join('');
    },
  };
  $('chatin').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') Net.closeChat(true); else if (e.key === 'Escape') Net.closeChat(false); });
})(window.LL);
