// Lastlight — HUD, inventory, chests, crafting, journal, perks
'use strict';
(function (LL) {
  const $ = id => document.getElementById(id);
  const I = LL.I, B = LL.B;

  LL.QUESTS = [
    { f: 'gotLog', t: 'Gather wood', h: 'Hold the left mouse button on a tree trunk. Any kind of log works.' },
    { f: 'placedBench', t: "Build a Tinker's Bench", h: 'Press E. Turn logs into planks, craft a bench, select it on your hotbar and right-click to place it.' },
    { f: 'gotPick', t: 'Craft a pick', h: 'Stand near your bench, press E and craft a Wooden Pick (it needs Hafts, made from planks).' },
    { f: 'placedHearth', t: 'Kindle a Hearth before nightfall', h: 'Mine slate for cobble and dig up Cinderite (black ore with red sparks). A Hearth warms you, holds back gloomlings and becomes your respawn point.' },
    { f: 'gotCopper', t: 'Smelt copper', h: 'Copperite (orange ore) needs a Slate Pick. Build a Kiln near your bench and smelt it with Cinderite or Charcoal.' },
    { f: 'gotEmberOre', t: 'Find Emberite deep below', h: 'Glowing orange ore near the bottom of the world, below height 21. It needs a Copper Pick. Buried vaults often hide nearby.' },
    { f: 'gotPearls', t: 'Collect 2 Dusk Pearls', h: 'Gloomlings drop them. They come out at night and in dark caves. Light keeps them back, so fight them at the edge of your light.' },
    { f: 'visitedGloam', t: 'Open the way to the Gloam', h: 'Craft a Gloam Waystone (Slate Bricks, Emberite Ingots, Dusk Pearls), place it in the Wildlands and right-click it.' },
    { f: 'gotVoid', t: 'Claim Voidglass', h: 'Dark violet veins in Gloamrock. They need an Emberite Pick. You will want at least 6.' },
    { f: 'gotGlider', t: 'Weave a Silk Glider', h: 'Gloam Crawlers drop silk. Skyreach is a land of very long falls.' },
    { f: 'visitedSky', t: 'Ascend to Skyreach', h: 'Craft a Sky Waystone and use it from the Wildlands.' },
    { f: 'gotHeartfire', t: 'Forge the Heartfire', h: 'You need Sunstone (golden seams in the islands), Gale Essence (from Gale Wisps), Voidglass and Emberite Ingots.' },
    { f: 'victory', t: 'Rekindle the Dawn', h: 'Place the Heartfire on the Dawn Altar at the heart of Skyreach. Something will try to stop you.' },
  ];

  const UI = LL.UI = {
    game: null, cursor: null, panel: null, tab: 'all', jtab: 'goals', lastObj: '', chestKey: null, perkOpen: false,
    init(game) {
      this.game = game;
      const hb = $('hotbar');
      for (let i = 0; i < 9; i++) hb.appendChild(this.makeSlot('inv', i, true));
      const grid = $('invgrid');
      for (let i = 9; i < 36; i++) grid.appendChild(this.makeSlot('inv', i));
      const ih = $('invhot');
      for (let i = 0; i < 9; i++) ih.appendChild(this.makeSlot('inv', i));
      const eq = $('equip');
      ['Head', 'Body', 'Feet'].forEach((n, i) => { const s = this.makeSlot('equip', i); s.title = n; s.classList.add('eq'); s.insertAdjacentHTML('beforeend', '<span class="eql">' + n + '</span>'); eq.appendChild(s); });
      const cg = $('chestgrid');
      for (let i = 0; i < 27; i++) cg.appendChild(this.makeSlot('chest', i));
      document.querySelectorAll('#crafttabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; document.querySelectorAll('#crafttabs button').forEach(x => x.classList.toggle('on', x === b)); this.renderCrafting(); LL.sfx.ui(); });
      document.querySelectorAll('#jtabs button').forEach(b => b.onclick = () => { this.jtab = b.dataset.tab; this.renderJournal(); LL.sfx.ui(); });
      document.addEventListener('mousemove', e => { const c = $('cursorItem'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; const t = $('tooltip'); t.style.left = Math.min(window.innerWidth - 290, e.clientX + 16) + 'px'; t.style.top = (e.clientY + 12) + 'px'; });
      $('invclose').onclick = () => game.closePanels(true);
      $('jclose').onclick = () => game.closePanels(true);
    },
    // ---------- slots ----------
    arr(c) { const g = this.game; if (c === 'inv') return g.player.inv.s; if (c === 'equip') return g.player.equip; return g.chestSlots(this.chestKey); },
    accept(c, i, st) { if (!st) return true; if (c === 'equip') { const a = LL.ITEMS[st.id].armor; return !!a && a.slot === i; } return true; },
    makeSlot(c, i, hud) {
      const d = document.createElement('div'); d.className = 'slot'; d.dataset.c = c; d.dataset.i = i; if (hud) d.dataset.hud = 1;
      d.innerHTML = '<img draggable="false"><span class="n"></span><div class="dur"><i></i></div>' + (hud ? '<span class="k">' + (i + 1) + '</span>' : '');
      if (!hud) {
        d.addEventListener('mousedown', e => { e.preventDefault(); this.slotClick(c, i, e.button, e.shiftKey); });
        d.addEventListener('contextmenu', e => e.preventDefault());
        d.addEventListener('mouseenter', () => this.tipSlot(c, i));
        d.addEventListener('mouseleave', () => this.tip(null));
      }
      return d;
    },
    fillSlot(el, st) {
      const img = el.querySelector('img'), n = el.querySelector('.n'), dur = el.querySelector('.dur');
      if (!st) { img.style.visibility = 'hidden'; n.textContent = ''; dur.style.display = 'none'; return; }
      img.src = LL.iconURL(st.id); img.style.visibility = 'visible';
      n.textContent = st.n > 1 ? st.n : '';
      const tool = LL.toolOf(st.id);
      if (tool && st.dur != null && st.dur < tool.dur) { dur.style.display = 'block'; const f = st.dur / tool.dur; dur.firstChild.style.width = (f * 100) + '%'; dur.firstChild.style.background = f > 0.5 ? '#7ed957' : f > 0.2 ? '#f2c94c' : '#e0524a'; }
      else dur.style.display = 'none';
    },
    refresh() {
      const g = this.game, inv = g.player.inv;
      document.querySelectorAll('#hotbar .slot').forEach((el, i) => { this.fillSlot(el, inv.s[i]); el.classList.toggle('sel', i === inv.sel); });
      if (this.panel === 'inv') {
        document.querySelectorAll('#invpanel .slot').forEach(el => { const a = this.arr(el.dataset.c); if (a) this.fillSlot(el, a[+el.dataset.i]); });
        $('armorval').textContent = g.player.armor();
        if (this.chestKey && g.syncChest) g.syncChest(this.chestKey);
        this.renderCrafting();
      }
      const c = $('cursorItem');
      if (this.cursor) { c.style.display = 'block'; c.querySelector('img').src = LL.iconURL(this.cursor.id); c.querySelector('span').textContent = this.cursor.n > 1 ? this.cursor.n : ''; }
      else c.style.display = 'none';
      g.checkFlags();
    },
    showItemName() {
      const h = this.game.player.inv.held(), el = $('itemname');
      el.textContent = h ? LL.itemName(h.id) : '';
      el.classList.remove('show'); void el.offsetWidth; if (h) el.classList.add('show');
    },
    moveInto(st, arr, lo, hi, c) {
      let n = st.n; const max = LL.maxStack(st.id);
      for (let k = lo; k < hi && n; k++) if (arr[k] && arr[k].id === st.id && arr[k].n < max) { const m = Math.min(n, max - arr[k].n); arr[k].n += m; n -= m; }
      for (let k = lo; k < hi && n; k++) if (!arr[k] && this.accept(c, k, st)) { arr[k] = Object.assign({}, st, { n }); n = 0; }
      return n;
    },
    slotClick(c, i, btn, shift) {
      const s = this.arr(c); if (!s) return;
      LL.sfx.ui();
      if (shift && s[i] && !this.cursor) {
        const st = s[i]; s[i] = null; let left;
        const inv = this.game.player.inv.s;
        if (c === 'chest') left = this.moveInto(st, inv, 0, 36, 'inv');
        else if (c === 'equip') left = this.moveInto(st, inv, 9, 36, 'inv') && this.moveInto(st, inv, 0, 9, 'inv');
        else if (this.chestKey) left = this.moveInto(st, this.arr('chest'), 0, 27, 'chest');
        else if (LL.ITEMS[st.id].armor && !this.game.player.equip[LL.ITEMS[st.id].armor.slot]) left = this.moveInto(st, this.game.player.equip, 0, 3, 'equip');
        else left = i < 9 ? this.moveInto(st, inv, 9, 36, 'inv') : this.moveInto(st, inv, 0, 9, 'inv');
        if (left) s[i] = Object.assign({}, st, { n: left });
        return this.refresh();
      }
      const cur = this.cursor, sl = s[i];
      if (btn === 2) {
        if (!cur && sl) { const k = Math.ceil(sl.n / 2); this.cursor = Object.assign({}, sl, { n: k }); sl.n -= k; if (!sl.n) s[i] = null; }
        else if (cur && this.accept(c, i, cur) && (!sl || (sl.id === cur.id && sl.n < LL.maxStack(sl.id)))) { if (!sl) s[i] = Object.assign({}, cur, { n: 1 }); else sl.n++; cur.n--; if (!cur.n) this.cursor = null; }
      } else {
        if (!cur) { this.cursor = sl; s[i] = null; }
        else if (!this.accept(c, i, cur)) { this.game.toast('That does not go there.', 'warn'); }
        else if (!sl) { s[i] = cur; this.cursor = null; }
        else if (sl.id === cur.id && LL.maxStack(sl.id) > 1) { const max = LL.maxStack(sl.id), k = Math.min(cur.n, max - sl.n); sl.n += k; cur.n -= k; if (!cur.n) this.cursor = null; }
        else { s[i] = cur; this.cursor = sl; }
      }
      this.refresh(); this.tipSlot(c, i);
    },
    returnCursor() {
      if (!this.cursor) return;
      const g = this.game, left = g.player.inv.add(this.cursor.id, this.cursor.n, this.cursor.dur);
      if (left) g.spawnDrop(this.cursor.id, left, g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z, this.cursor.dur);
      this.cursor = null; this.refresh();
    },
    tipSlot(c, i) { const a = this.arr(c); const st = a && a[i]; if (!st || this.cursor) return this.tip(null); this.tip(this.itemTip(st.id, st)); },
    itemTip(id, st) {
      const it = LL.ITEMS[id]; let h = '<b>' + it.name + '</b>';
      const tool = it.tool;
      if (tool) h += '<div class="tt-sub">' + ['', 'Wood', 'Slate', 'Copper', 'Emberite'][tool.tier] + ' tier · ' + tool.dmg + ' damage' + (st && st.dur != null ? ' · ' + st.dur + '/' + tool.dur + ' uses' : '') + '</div>';
      if (it.armor) h += '<div class="tt-sub">Armor ' + it.armor.val + ' · ' + ['Head', 'Body', 'Feet'][it.armor.slot] + ' (right-click to wear)</div>';
      if (it.food) h += '<div class="tt-sub">Restores ' + it.food + ' vigor' + (it.warm ? ' · +' + it.warm + ' warmth' : '') + ' (right-click)</div>';
      if (it.desc) h += '<div class="tt-d">' + it.desc + '</div>';
      if (it.block) { const b = LL.BLOCKS[id]; if (b.light) h += '<div class="tt-d">Gives off light.</div>'; if (b.tier > 1) h += '<div class="tt-d">Needs a ' + ['', 'Wooden', 'Slate', 'Copper', 'Emberite'][b.tier] + ' Pick or better.</div>'; }
      return h;
    },
    tip(html) { const t = $('tooltip'); if (!html) { t.style.display = 'none'; return; } t.innerHTML = html; t.style.display = 'block'; },

    // ---------- panels ----------
    openInventory(chestKey) {
      const g = this.game; if (g.player.dead) return;
      this.chestKey = chestKey || null;
      $('chestwrap').classList.toggle('hidden', !this.chestKey);
      $('invright').classList.toggle('hidden', !!this.chestKey);
      this.panel = 'inv'; $('invpanel').classList.remove('hidden'); $('journal').classList.add('hidden');
      g.releasePointer();
      if (this.chestKey) LL.sfx.place(65);
      this.stations = g.nearStations();
      $('stations').innerHTML = [['hand', 'By hand', true], ['bench', "Tinker's Bench", this.stations.bench], ['kiln', 'Kiln', this.stations.kiln]].map(([k, n, on]) => '<span class="st ' + (on ? 'on' : '') + '">' + (on ? '● ' : '○ ') + n + '</span>').join('');
      this.refresh();
    },
    toggleJournal() {
      const g = this.game;
      if (this.panel === 'journal') return g.closePanels(true);
      this.panel = 'journal'; $('journal').classList.remove('hidden'); $('invpanel').classList.add('hidden');
      g.releasePointer();
      this.renderJournal();
    },
    renderJournal() {
      const g = this.game, f = g.flags, P = LL.Prog;
      document.querySelectorAll('#jtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.jtab));
      const pend = $('jtabs').querySelector('[data-tab=perks] i'); if (pend) pend.textContent = g.pendingPerks ? ' (' + g.pendingPerks + ')' : '';
      let h = '';
      if (this.jtab === 'goals') {
        h += '<div class="lore">The sun has been going out for a hundred years. Each night lasts a little longer than the one before, and gloomlings come out of the dark. They say the old sun\'s fire can still be rekindled on the Dawn Altar, high in Skyreach, if anyone can reach it.</div><ul class="jlist">';
        let firstOpen = true;
        h += LL.QUESTS.map(q => {
          const done = !!f[q.f]; const cls = done ? 'done' : (firstOpen ? 'cur' : 'todo');
          if (!done && firstOpen) firstOpen = false;
          return '<li class="' + cls + '"><span class="ck">' + (done ? '✓' : (cls === 'cur' ? '◆' : '·')) + '</span><div><b>' + q.t + '</b>' + (cls === 'cur' ? '<p>' + q.h + '</p>' : '') + '</div></li>';
        }).join('') + '</ul>';
        const st = g.stats;
        h += '<div class="jstats">Day ' + g.day + ' · Level ' + g.level + ' · ' + st.gloom + ' gloomlings banished · ' + st.caches + ' caches opened · ' + st.mined + ' mined · ' + st.placed + ' placed</div>';
      } else if (this.jtab === 'bounties') {
        h += '<p class="jsub">Three new bounties are posted every dawn. Finish them before the next sunrise for embers and supplies.</p>';
        h += (g.bounties || []).map(b => {
          const d = P.bountyDef(b);
          return '<div class="bty ' + (b.done ? 'done' : '') + '"><div class="bt-top"><b>' + d.txt.replace(/\d+/, b.n) + '</b><span>' + (b.done ? 'Complete ✓' : b.prog + ' / ' + b.n) + '</span></div><div class="bt-bar"><i style="width:' + (b.prog / b.n * 100) + '%"></i></div><div class="bt-rw">Reward: <span class="emb">' + (d.xp + g.day * 2) + ' embers</span> ' + d.rw.map(([id, n]) => '<span class="ing ok"><img src="' + LL.iconURL(id) + '">' + n + '</span>').join('') + '</div></div>';
        }).join('') || '<p class="jsub">No bounties yet. They arrive at dawn.</p>';
      } else if (this.jtab === 'feats') {
        const n = LL.FEATS.filter(x => g.feats[x.k]).length;
        h += '<p class="jsub">' + n + ' / ' + LL.FEATS.length + ' feats · ' + Object.keys(g.stats.seen).length + ' items discovered</p><div class="feats">';
        h += LL.FEATS.map(x => {
          const done = g.feats[x.k];
          let prog = '';
          if (!done && x.p) { const [a, b] = x.p(g); prog = '<div class="bt-bar"><i style="width:' + Math.min(100, a / b * 100) + '%"></i></div><small>' + Math.min(a, b) + ' / ' + b + '</small>'; }
          return '<div class="feat ' + (done ? 'done' : '') + '"><b>' + (done ? '★ ' : '☆ ') + x.n + '</b><small>' + x.d + (done ? ' · day ' + done : '') + '</small>' + prog + '</div>';
        }).join('') + '</div>';
      } else {
        h += '<p class="jsub">Level ' + g.level + ' · ' + Math.floor(g.xp) + ' / ' + P.need(g.level) + ' embers to next level.' + (g.pendingPerks ? ' <button class="btn small" id="pickNow">Choose a perk (' + g.pendingPerks + ')</button>' : '') + '</p><div class="feats">';
        h += LL.PERKS.map(p => { const r = P.perk(g, p.k); return '<div class="feat ' + (r ? 'done' : '') + '"><b><img class="pi" src="' + LL.iconURL(p.icon) + '">' + p.n + ' <span class="rk">' + '◆'.repeat(r) + '◇'.repeat(p.max - r) + '</span></b><small>' + p.d + '</small></div>'; }).join('') + '</div>';
      }
      $('jbody').innerHTML = h;
      const pn = $('pickNow'); if (pn) pn.onclick = () => { g.closePanels(false); P.offerPerk(g); };
    },
    canCraft(r) {
      const inv = this.game.player.inv, st = this.stations || {};
      const stOk = r.st === 'hand' || st[r.st];
      const have = r.ins.every(([s, n]) => inv.count(s) >= n);
      return { stOk, have, ok: stOk && have };
    },
    renderCrafting() {
      const list = $('craftlist'), g = this.game, inv = g.player.inv;
      const recs = LL.RECIPES.filter(r => (!r.bp || g.known[r.out]) && (this.tab === 'all' || r.cat === this.tab || (this.tab === 'build' && r.cat === 'mats')));
      const scored = recs.map(r => ({ r, c: this.canCraft(r) })).sort((a, b) => (b.c.ok - a.c.ok) || (b.c.stOk - a.c.stOk));
      const html = scored.map(({ r, c }) => {
        const ri = LL.RECIPES.indexOf(r);
        const ins = r.ins.map(([s, n]) => {
          const ok = inv.count(s) >= n;
          const icon = typeof s === 'string' ? LL.GROUPS[s][0] : s;
          const name = typeof s === 'string' ? LL.GROUP_NAME[s] : LL.itemName(s);
          return '<span class="ing ' + (ok ? 'ok' : 'no') + '" title="' + name + '"><img src="' + LL.iconURL(icon) + '">' + n + '</span>';
        }).join('');
        const stTag = r.st === 'hand' ? '' : '<span class="need ' + (c.stOk ? '' : 'no') + '">' + (r.st === 'bench' ? 'Bench' : 'Kiln') + '</span>';
        const bpTag = r.bp ? '<span class="need bp">Blueprint</span>' : '';
        return '<div class="rec ' + (c.ok ? 'ok' : c.stOk ? 'miss' : 'far') + '" data-r="' + ri + '"><img class="out" src="' + LL.iconURL(r.out) + '"><div class="rinfo"><div class="rn">' + LL.itemName(r.out) + (r.n > 1 ? ' <i>×' + r.n + '</i>' : '') + stTag + bpTag + '</div><div class="ings">' + ins + '</div></div></div>';
      }).join('');
      const unknown = LL.BLUEPRINTS.filter(([, o]) => !g.known[o]).length;
      const foot = unknown ? '<div class="bphint">' + unknown + ' more recipes are lost. Find blueprints in ruin caches.</div>' : '';
      if (list._html !== html + foot) {
        list.innerHTML = html + foot; list._html = html + foot;
        list.querySelectorAll('.rec').forEach(el => {
          const r = LL.RECIPES[+el.dataset.r];
          el.onmousedown = e => { e.preventDefault(); this.craft(r, e.shiftKey ? 16 : 1); };
          el.onmouseenter = () => this.tip(this.itemTip(r.out) + '<div class="tt-d">' + (this.canCraft(r).stOk ? 'Click to craft · Shift-click for many' : 'Needs a ' + (r.st === 'bench' ? "Tinker's Bench" : 'Kiln') + ' within 4 blocks') + '</div>');
          el.onmouseleave = () => this.tip(null);
        });
      }
    },
    craft(r, times) {
      const g = this.game, inv = g.player.inv;
      let made = 0;
      for (let k = 0; k < times; k++) {
        if (!this.canCraft(r).ok) break;
        for (const [s, n] of r.ins) inv.take(s, n);
        const left = inv.add(r.out, r.n);
        if (left) g.spawnDrop(r.out, left, g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z);
        made++;
      }
      if (made) { LL.sfx.craft(); g.onCrafted(r.out, made * r.n); }
      else if (!this.canCraft(r).stOk) g.toast('You need to be near a ' + (r.st === 'bench' ? "Tinker's Bench" : 'Kiln') + '.', 'warn');
      this.refresh();
    },

    // ---------- perks ----------
    showPerks(opts, cb) {
      const g = this.game;
      this.perkOpen = true; g.paused = true; g.closePanels(false); g.releasePointer();
      $('perkpick').classList.remove('hidden');
      $('perkLvl').textContent = 'Level ' + g.level;
      $('perkcards').innerHTML = opts.map(p => { const r = LL.Prog.perk(g, p.k); return '<button class="pcard" data-k="' + p.k + '"><img src="' + LL.iconURL(p.icon) + '"><b>' + p.n + '</b><span>' + p.d + '</span><em>' + '◆'.repeat(r + 1) + '◇'.repeat(p.max - r - 1) + '</em></button>'; }).join('');
      $('perkcards').querySelectorAll('.pcard').forEach(b => b.onclick = () => {
        $('perkpick').classList.add('hidden'); this.perkOpen = false; g.paused = false;
        LL.sfx.craft(); cb(b.dataset.k); this.toast('Perk gained: ' + LL.PERKS.find(p => p.k === b.dataset.k).n, 'good');
        if (!g.pendingPerks) g.lockPointer();
      });
    },

    // ---------- HUD bits ----------
    toast(msg, kind) {
      const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
      const box = $('toasts'); box.appendChild(el);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4400);
    },
    featToast(f) {
      const el = document.createElement('div'); el.className = 'feattoast';
      el.innerHTML = '<small>Feat unlocked</small><b>★ ' + f.n + '</b><span>' + f.d + (f.xp ? ' · +' + f.xp + ' embers' : '') + '</span>';
      document.body.appendChild(el); LL.sfx.kindle();
      setTimeout(() => el.classList.add('out'), 4200); setTimeout(() => el.remove(), 5000);
    },
    floatXP(n) {
      const el = document.createElement('div'); el.className = 'xpfloat'; el.textContent = '+' + n + ' embers';
      el.style.left = (50 + (Math.random() - 0.5) * 8) + '%';
      $('hud').appendChild(el); setTimeout(() => el.remove(), 1600);
    },
    trackBounties() {
      const g = this.game, el = $('bounties');
      if (!g.bounties || !g.bounties.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<div class="k">Bounties</div>' + g.bounties.map(b => { const d = LL.Prog.bountyDef(b); return '<div class="' + (b.done ? 'done' : '') + '">' + (b.done ? '✓ ' : '• ') + d.txt.replace(/\d+/, b.n) + ' <span>' + (b.done ? '' : b.prog + '/' + b.n) + '</span></div>'; }).join('');
    },
    compass(info) {
      const el = $('compass');
      if (!info) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      $('cneedle').style.transform = 'rotate(' + info.ang + 'rad)';
      $('cdist').textContent = info.name + ' · ' + info.dist + 'm' + (info.dy < -6 ? ' ↓' : info.dy > 6 ? ' ↑' : '');
    },
    banner(title, sub) {
      const el = $('banner'); el.innerHTML = '<div class="bt">' + title + '</div>' + (sub ? '<div class="bs">' + sub + '</div>' : '');
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
    boss(f) { $('bossbar').classList.remove('hidden'); $('bossfill').style.width = Math.max(0, f * 100) + '%'; },
    bossHide() { $('bossbar').classList.add('hidden'); },
    hurtFlash() { const el = $('hurt'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); },
    hud(dt) {
      const g = this.game, P = g.player;
      this._t = (this._t || 0) + dt; if (this._t < 0.1) return; this._t = 0;
      $('vigfill').style.width = (P.vigor / P.maxVigor * 100) + '%';
      $('vigval').textContent = Math.ceil(P.vigor);
      $('warmfill').style.width = P.warmth + '%';
      $('warmval').textContent = Math.round(P.warmth);
      $('warmth').classList.toggle('cold', P.warmth < 25);
      $('warmth').classList.toggle('rising', g.warmRate > 0.05);
      $('warmth').classList.toggle('falling', g.warmRate < -0.05);
      $('frost').style.opacity = Math.max(0, (35 - P.warmth) / 35) * 0.85;
      $('vignette').style.opacity = P.vigor < 6 ? 0.55 + Math.sin(performance.now() / 300) * 0.15 : 0;
      $('xpfill').style.width = (g.xp / LL.Prog.need(g.level) * 100) + '%';
      $('lvl').textContent = g.level;
      $('lvl').classList.toggle('pend', g.pendingPerks > 0);
      const a = P.armor(); $('armorhud').textContent = a ? '⛨ ' + a : '';
      $('umbral').classList.toggle('hidden', !g.umbralActive);
      const q = LL.QUESTS.find(q => !g.flags[q.f]);
      const key = q ? q.t : 'done';
      if (key !== this.lastObj) {
        this.lastObj = key;
        $('obtitle').textContent = q ? q.t : 'The dawn holds';
        $('obhint').textContent = q ? q.h : 'The sun burns bright again. Hunt bounties, raid ruins, earn every feat and survive the Umbral Nights.';
        $('objective').classList.remove('pop'); void $('objective').offsetWidth; $('objective').classList.add('pop');
      }
      const c = $('dial').getContext('2d'), W = 64;
      c.clearRect(0, 0, W, W);
      if (g.dimKey === 'wild') {
        const df = g.dayFrac, ph = g.phase;
        c.lineWidth = 6;
        c.strokeStyle = '#f3b54a'; c.beginPath(); c.arc(32, 32, 26, -Math.PI / 2, -Math.PI / 2 + df * Math.PI * 2); c.stroke();
        c.strokeStyle = g.umbralNext ? '#8a3ab8' : '#3a4a7a'; c.beginPath(); c.arc(32, 32, 26, -Math.PI / 2 + df * Math.PI * 2, Math.PI * 1.5); c.stroke();
        const an = -Math.PI / 2 + ph * Math.PI * 2;
        c.fillStyle = ph < df ? '#fff1b0' : '#cfd8ff'; c.beginPath(); c.arc(32 + Math.cos(an) * 26, 32 + Math.sin(an) * 26, 6, 0, 7); c.fill();
        const isDay = ph < df, left = isDay ? (df - ph) : (1 - ph);
        const mins = Math.ceil(left * g.DAY_LEN / 60);
        $('dayinfo').innerHTML = 'Day ' + g.day + '<br><small>' + (isDay ? (g.umbralNext ? '<b style="color:#d8a8ff">Umbral Night</b> in ~' : 'Dusk in ~') : 'Dawn in ~') + mins + ' min</small>';
      } else {
        c.fillStyle = g.dimKey === 'gloam' ? '#7a4aa8' : '#ffd060'; c.beginPath(); c.arc(32, 32, 14, 0, 7); c.fill();
        $('dayinfo').innerHTML = g.dimKey === 'gloam' ? 'No sky<br><small>Time is lost here</small>' : 'Eternal noon<br><small>Mind the edges</small>';
      }
      $('dimname').textContent = g.dimName + ' · ' + (g.biomeName || '');
      const pp = P.pos; $('coords').textContent = Math.floor(pp.x) + ', ' + Math.floor(pp.y) + ', ' + Math.floor(pp.z);
    },
  };
})(window.LL);
