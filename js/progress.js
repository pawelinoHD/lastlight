// Lastlight — long-term progression: embers (XP), perks, bounties, feats, loot, crops, Umbral Nights
'use strict';
(function (LL) {
  const I = LL.I, B = LL.B;

  // ---------- perks ----------
  LL.PERKS = [
    { k: 'hardy', n: 'Hardy', max: 3, icon: 112, d: '+4 max vigor' },
    { k: 'fire', n: 'Inner Fire', max: 3, icon: 154, d: 'Lose warmth 20% slower' },
    { k: 'quick', n: 'Quick Hands', max: 3, icon: 134, d: 'Mine 15% faster' },
    { k: 'prospect', n: 'Prospector', max: 3, icon: 22, d: '20% chance of a double ore drop' },
    { k: 'brawl', n: 'Brawler', max: 3, icon: 137, d: '+1 melee damage' },
    { k: 'light', n: 'Light Step', max: 2, icon: 172, d: 'Fall 3 more blocks without harm' },
    { k: 'kindled', n: 'Kindled Soul', max: 2, icon: 27, d: 'Regenerate vigor faster' },
    { k: 'forager', n: 'Forager', max: 2, icon: 57, d: 'Food restores 50% more vigor' },
    { k: 'swift', n: 'Swift', max: 2, icon: 155, d: 'Move 8% faster' },
    { k: 'tinker', n: 'Tinker', max: 3, icon: 30, d: 'Tools wear 25% slower' },
    { k: 'scav', n: 'Scavenger', max: 2, icon: 63, d: 'Ruin caches hold an extra item' },
    { k: 'second', n: 'Second Wind', max: 1, icon: 117, d: 'Once a day, survive a killing blow' },
    { k: 'eyes', n: 'Night Eyes', max: 1, icon: 106, d: 'See much better in the dark' },
    { k: 'green', n: 'Green Thumb', max: 2, icon: 150, d: 'Crops grow 35% faster' },
  ];
  const P = LL.Prog = {};
  P.perk = (g, k) => (g.perks && g.perks[k]) || 0;
  P.need = lvl => 30 + lvl * 25;

  P.addXP = (g, n, why) => {
    if (!n) return;
    g.xp += n;
    g.ui.floatXP(n, why);
    let leveled = false;
    while (g.xp >= P.need(g.level)) { g.xp -= P.need(g.level); g.level++; g.pendingPerks++; leveled = true; }
    if (leveled) { LL.sfx.kindle(); g.ui.banner('Level ' + g.level, 'Choose a new perk'); setTimeout(() => P.offerPerk(g), 900); }
  };
  P.rollPerks = (g) => {
    const avail = LL.PERKS.filter(p => P.perk(g, p.k) < p.max);
    const out = [];
    while (out.length < 3 && avail.length) out.push(avail.splice(Math.random() * avail.length | 0, 1)[0]);
    return out;
  };
  P.offerPerk = (g) => {
    if (!g.pendingPerks || g.ui.perkOpen || g.state !== 'play' || g.player.dead) return;
    const opts = P.rollPerks(g);
    if (!opts.length) { g.pendingPerks = 0; return; }
    g.ui.showPerks(opts, (k) => {
      g.perks[k] = (g.perks[k] || 0) + 1; g.pendingPerks--;
      g.player.applyPerks();
      if (g.pendingPerks > 0) setTimeout(() => P.offerPerk(g), 400);
    });
  };

  // ---------- bounties ----------
  const T = (o) => o;
  const BOUNTIES = [
    T({ type: 'gather', id: 'log', n: 16, txt: 'Gather 16 logs', xp: 25, rw: [[I.EMBERBERRY, 4], [I.HAFT, 4]] }),
    T({ type: 'gather', id: 112, n: 8, txt: 'Pick 8 Emberberries', xp: 25, rw: [[150, 3], [I.HAFT, 4]] }),
    T({ type: 'gather', id: 4, n: 32, txt: 'Quarry 32 Cobbled Slate', xp: 35, rw: [[I.CINDERITE, 4], [26, 4]], req: g => g.flags.gotPick }),
    T({ type: 'gather', id: I.CINDERITE, n: 10, txt: 'Collect 10 Cinderite', xp: 35, rw: [[26, 6]], req: g => g.flags.gotPick }),
    T({ type: 'gather', id: 22, n: 6, txt: 'Mine 6 Copperite Ore', xp: 50, rw: [[I.COPPER_INGOT, 2], [I.LUMITE_SHARD, 2]], req: g => g.flags.placedHearth }),
    T({ type: 'gather', id: I.LUMITE_SHARD, n: 6, txt: 'Collect 6 Lumite Shards', xp: 40, rw: [[53, 2]], req: g => g.flags.gotPick }),
    T({ type: 'gather', id: I.HIDE, n: 4, txt: 'Collect 4 Bramble Hide', xp: 35, rw: [[I.ROAST_VENISON, 3]] }),
    T({ type: 'gather', id: 151, n: 8, txt: 'Harvest 8 Sunroot', xp: 40, rw: [[152, 3]], req: g => g.stats.planted > 0 }),
    T({ type: 'gather', id: I.SILK, n: 6, txt: 'Collect 6 Crawler Silk', xp: 60, rw: [[I.EMBER_INGOT, 2]], req: g => g.flags.visitedGloam }),
    T({ type: 'gather', id: I.VOIDGLASS, n: 3, txt: 'Claim 3 Voidglass', xp: 80, rw: [[I.EMBER_INGOT, 3]], req: g => g.flags.gotVoid }),
    T({ type: 'gather', id: I.SUNSTONE, n: 2, txt: 'Find 2 Sunstone', xp: 90, rw: [[I.GALE_ESSENCE, 1], [I.EMBER_INGOT, 2]], req: g => g.flags.visitedSky }),
    T({ type: 'slay', id: 'gloomling', n: 5, txt: 'Banish 5 gloomlings', xp: 50, rw: [[I.DUSK_PEARL, 1], [26, 4]] }),
    T({ type: 'slay', id: 'buck', n: 3, txt: 'Hunt 3 Bramblebucks', xp: 30, rw: [[I.HIDE, 2]] }),
    T({ type: 'slay', id: 'crawler', n: 5, txt: 'Slay 5 Gloam Crawlers', xp: 60, rw: [[I.SILK, 3]], req: g => g.flags.visitedGloam }),
    T({ type: 'slay', id: 'wisp', n: 3, txt: 'Unmake 3 Gale Wisps', xp: 80, rw: [[I.GALE_ESSENCE, 1]], req: g => g.flags.visitedSky }),
    T({ type: 'slay', id: 'brute', n: 1, txt: 'Fell a Gloom Brute', xp: 90, rw: [[I.EMBER_INGOT, 2], [I.DUSK_PEARL, 2]], req: g => g.day >= 4 }),
    T({ type: 'mine', id: 3, n: 48, txt: 'Dig through 48 slate', xp: 40, rw: [[I.COPPER_INGOT, 1], [I.CINDERITE, 4]], req: g => g.flags.gotPick }),
    T({ type: 'mine', id: 24, n: 3, txt: 'Mine 3 Emberite Ore', xp: 80, rw: [[I.LUMITE_SHARD, 4], [I.COPPER_INGOT, 3]], req: g => g.flags.gotCopper }),
    T({ type: 'craft', id: 26, n: 6, txt: 'Craft 6 lanterns', xp: 30, rw: [[I.CINDERITE, 4]], req: g => g.flags.gotPick }),
    T({ type: 'craft', id: 32, n: 16, txt: 'Lay 16 Slate Bricks', xp: 35, rw: [[I.COPPER_INGOT, 1]], req: g => g.flags.placedBench && g.flags.gotPick }),
    T({ type: 'craft', id: 152, n: 2, txt: 'Bake 2 Hearthbread', xp: 45, rw: [[150, 4], [I.EMBER_INGOT, 1]], req: g => g.stats.planted > 0 && g.flags.gotCopper }),
    T({ type: 'cache', id: 'cache', n: 1, txt: 'Open a ruin cache', xp: 40, rw: [[I.LUMITE_SHARD, 3]] }),
    T({ type: 'rift', id: 'rift', n: 1, txt: 'Close a Gloom Rift', xp: 70, rw: [[I.EMBER_INGOT, 2], [I.LUMITE_SHARD, 3]], req: g => g.flags.gotPick }),
    T({ type: 'trade', id: 'any', n: 3, txt: 'Trade with a Lantern Keeper 3 times', xp: 35, rw: [[I.COPPER_INGOT, 2]] }),
    T({ type: 'slay', id: 'boar', n: 2, txt: 'Hunt 2 Thornback Boars', xp: 40, rw: [[I.HIDE, 3]] }),
    T({ type: 'slay', id: 'lurker', n: 2, txt: 'Drive off 2 Mire Lurkers', xp: 55, rw: [[I.SPORE_SAC, 2], [76, 8]], req: g => g.day >= 2 }),
    T({ type: 'gather', id: I.MOTH_DUST, n: 4, txt: 'Catch 4 Glowmoth Dust', xp: 35, rw: [[53, 1]] }),
    T({ type: 'gather', id: I.CINDERITE, n: 6, txt: 'Crack Emberbeetles for 6 Cinderite', xp: 30, rw: [[79, 1]], req: g => g.stats.biomes && g.stats.biomes[5] }),
    T({ type: 'place', id: 'any', n: 60, txt: 'Place 60 blocks (build!)', xp: 35, rw: [[53, 1], [32, 8]], req: g => g.flags.placedBench }),
  ];
  P.rollBounties = (g) => {
    const rng = LL.mulberry32((g.seed ^ (g.day * 7919)) >>> 0);
    const pool = BOUNTIES.map((b, i) => [b, i]).filter(([b]) => !b.req || b.req(g));
    const out = [];
    while (out.length < 3 && pool.length) {
      const [b, i] = pool.splice(rng() * pool.length | 0, 1)[0];
      const scale = 1 + Math.min(1, (g.day - 1) * 0.05);
      out.push({ i, prog: 0, n: Math.round(b.n * (b.type === 'slay' || b.type === 'cache' ? 1 : scale)), done: false });
    }
    g.bounties = out; g.bountyDay = g.day;
  };
  P.bountyDef = b => BOUNTIES[b.i];
  P.bountyEvent = (g, type, id, n = 1) => {
    if (!g.bounties) return;
    for (const b of g.bounties) {
      if (b.done) continue;
      const d = BOUNTIES[b.i];
      if (d.type !== type) continue;
      const match = d.id === 'any' || d.id === id || (typeof d.id === 'string' && LL.GROUPS[d.id] && LL.GROUPS[d.id].includes(id));
      if (!match) continue;
      b.prog = Math.min(b.n, b.prog + n);
      if (b.prog >= b.n) {
        b.done = true;
        g.stats.bounties++;
        g.toast('Bounty complete: ' + d.txt, 'good');
        for (const [rid, rn] of d.rw) { const left = g.player.inv.add(rid, rn); if (left) g.spawnDrop(rid, left, g.player.pos.x, g.player.pos.y + 1, g.player.pos.z); }
        P.addXP(g, d.xp + g.day * 2, 'bounty');
        g.ui.refresh();
      }
      g.ui.trackBounties();
    }
  };

  // ---------- feats ----------
  const S = g => g.stats;
  LL.FEATS = [
    { k: 'lantern', n: 'First Light', d: 'Place a lantern', xp: 15, c: g => g.flags.placedLantern },
    { k: 'hearth', n: 'Hearthkeeper', d: 'Kindle a hearth', xp: 20, c: g => g.flags.placedHearth },
    { k: 'night1', n: 'Through the Dark', d: 'Survive your first night', xp: 25, c: g => S(g).nights >= 1 },
    { k: 'gloom10', n: 'Gloombane', d: 'Banish 10 gloomlings', xp: 40, p: g => [S(g).gloom, 10] },
    { k: 'gloom50', n: 'Dread of the Dark', d: 'Banish 50 gloomlings', xp: 120, p: g => [S(g).gloom, 50] },
    { k: 'deep', n: 'Delver', d: 'Go below height 12 in the Wildlands', xp: 30, c: g => S(g).minY <= 12 },
    { k: 'biomes', n: 'Wayfarer', d: 'Visit all six Wildlands biomes', xp: 80, p: g => [Object.keys(S(g).biomes).filter(b => +b >= 2 && +b <= 7).length, 6] },
    { k: 'cache1', n: 'Treasure Hunter', d: 'Open a ruin cache', xp: 25, p: g => [S(g).caches, 1] },
    { k: 'cache10', n: 'Archaeologist', d: 'Open 10 ruin caches', xp: 120, p: g => [S(g).caches, 10] },
    { k: 'bp', n: 'Lost Knowledge', d: 'Learn every blueprint', xp: 150, p: g => [Object.keys(g.known).length, LL.BLUEPRINTS.length] },
    { k: 'farm', n: 'Sower', d: 'Plant a seed', xp: 15, p: g => [S(g).planted, 1] },
    { k: 'harvest', n: 'Green Fields', d: 'Harvest 15 ripe sunroot', xp: 60, p: g => [S(g).harvest, 15] },
    { k: 'bread', n: 'Hearth Baker', d: 'Bake Hearthbread', xp: 30, c: g => g.flags.baked },
    { k: 'chest', n: 'Squirrel', d: 'Place a storage chest', xp: 15, c: g => g.flags.placedChest },
    { k: 'armor', n: 'Emberclad', d: 'Wear a full set of Emberite armor', xp: 100, c: g => g.player.equip.every((e, i) => e && e.id === 176 + i) },
    { k: 'umbral1', n: 'Umbral Survivor', d: 'Survive an Umbral Night', xp: 80, p: g => [S(g).umbral, 1] },
    { k: 'umbral3', n: 'Nightbreaker', d: 'Survive 3 Umbral Nights', xp: 200, p: g => [S(g).umbral, 3] },
    { k: 'brute', n: 'Giantslayer', d: 'Fell a Gloom Brute', xp: 50, p: g => [S(g).kills.brute || 0, 1] },
    { k: 'bounty10', n: 'Bounty Hunter', d: 'Complete 10 bounties', xp: 100, p: g => [S(g).bounties, 10] },
    { k: 'gloam', n: 'Into the Gloam', d: 'Enter the Gloam', xp: 50, c: g => g.flags.visitedGloam },
    { k: 'sky', n: 'Skyborn', d: 'Reach Skyreach', xp: 80, c: g => g.flags.visitedSky },
    { k: 'dawn', n: 'Dawnbringer', d: 'Defeat the Umbral Maw', xp: 300, c: g => g.flags.victory },
    { k: 'lvl10', n: 'Seasoned', d: 'Reach level 10', xp: 0, p: g => [g.level, 10] },
    { k: 'lvl25', n: 'Legend of the Last Light', d: 'Reach level 25', xp: 0, p: g => [g.level, 25] },
    { k: 'day10', n: 'Ten Long Nights', d: 'Reach day 10', xp: 80, p: g => [g.day, 10] },
    { k: 'day30', n: 'Old Soul', d: 'Reach day 30', xp: 200, p: g => [g.day, 30] },
    { k: 'mine', n: 'Tunneler', d: 'Mine 1,000 blocks', xp: 80, p: g => [S(g).mined, 1000] },
    { k: 'build', n: 'Builder', d: 'Place 500 blocks', xp: 80, p: g => [S(g).placed, 500] },
    { k: 'rift', n: 'Riftbreaker', d: 'Close a Gloom Rift', xp: 60, p: g => [S(g).rifts || 0, 1] },
    { k: 'trade', n: 'Haggler', d: 'Trade 10 times with Lantern Keepers', xp: 50, p: g => [S(g).trades || 0, 10] },
    { k: 'sunwell', n: 'Sunblessed', d: 'Receive a Sunwell blessing', xp: 25, p: g => [S(g).blessings || 0, 1] },
    { k: 'anvil', n: 'Mended', d: 'Repair a tool at an Ember Anvil', xp: 25, p: g => [S(g).repairs || 0, 1] },
    { k: 'bestiary', n: 'Bestiary', d: 'Defeat 10 different kinds of creature', xp: 150, p: g => [Object.keys(S(g).kills).length, 10] },
    { k: 'disc', n: 'Naturalist', d: 'Discover 50 different items', xp: 100, p: g => [Object.keys(S(g).seen).length, 50] },
  ];
  P.checkFeats = (g) => {
    for (const f of LL.FEATS) {
      if (g.feats[f.k]) continue;
      let ok = false;
      if (f.c) ok = !!f.c(g); else { const [a, b] = f.p(g); ok = a >= b; }
      if (ok) { g.feats[f.k] = g.day; g.ui.featToast(f); P.addXP(g, f.xp, 'feat'); }
    }
  };

  // ---------- loot ----------
  const LOOT = {
    wild: [[I.CINDERITE, 3, 6, 10], [22, 2, 4, 6], [I.COPPER_INGOT, 1, 3, 5], [I.LUMITE_SHARD, 2, 4, 6], [I.EMBERBERRY, 3, 6, 6], [150, 2, 4, 7], [I.HIDE, 1, 3, 4], [I.DUSK_PEARL, 1, 1, 2], [I.EMBER_INGOT, 1, 1, 1.5], [70, 6, 14, 5], [152, 1, 3, 3], [26, 3, 6, 4]],
    gloam: [[I.EMBER_INGOT, 1, 3, 6], [I.VOIDGLASS, 1, 2, 4], [I.SILK, 2, 4, 5], [I.GLOWCAP_FOOD, 2, 4, 4], [I.DUSK_PEARL, 1, 2, 4], [71, 6, 14, 4], [I.LUMITE_SHARD, 3, 6, 5], [I.GLOOM_HEART, 1, 1, 1.5]],
    sky: [[I.SUNSTONE, 1, 2, 4], [I.GALE_ESSENCE, 1, 1, 4], [I.CLOUDFRUIT, 2, 4, 5], [I.EMBER_INGOT, 1, 3, 5], [I.VOIDGLASS, 1, 1, 2], [53, 1, 3, 3]],
  };
  P.rollLoot = (g, dim, rng) => {
    const table = LOOT[dim] || LOOT.wild, tot = table.reduce((a, e) => a + e[3], 0);
    const out = [];
    const rolls = 3 + (rng() * 2 | 0) + P.perk(g, 'scav');
    for (let k = 0; k < rolls; k++) {
      let r = rng() * tot;
      for (const [id, a, b, w] of table) { r -= w; if (r <= 0) { out.push([id, a + (rng() * (b - a + 1) | 0)]); break; } }
    }
    // blueprints: guaranteed in your first cache, then a good chance
    const unknown = LL.BLUEPRINTS.filter(([bp, o]) => !g.known[o] && !g.player.inv.has(bp));
    const bpChance = g.stats.caches === 0 ? 1 : dim === 'wild' ? 0.4 : 0.55;
    if (unknown.length && rng() < bpChance) {
      const pref = unknown.find(([bp, o]) => o === I.COMPASS);
      out.push([(g.stats.caches === 0 && pref ? pref : unknown[rng() * unknown.length | 0])[0], 1]);
    }
    if (rng() < 0.3) { const tier = dim === 'wild' ? (rng() < 0.7 ? 0 : 1) : 2; out.push([170 + tier * 3 + (rng() * 3 | 0), 1]); }
    return out;
  };

  // ---------- crops ----------
  P.GROW = 75;
  P.tickCrops = (g, dt) => {
    const list = g.crops[g.dimKey] || [];
    const w = g.world, mult = 1 + 0.35 * P.perk(g, 'green');
    for (const c of list) {
      if (!w.isLoaded(c.x, c.z)) continue;
      const id = w.getBlock(c.x, c.y, c.z);
      if (id !== B.CROP0 && id !== B.CROP1) { c.gone = true; continue; }
      const lv = w.lightAt(c.x, c.y, c.z), light = Math.max((lv >> 4) * g.daylight, lv & 15);
      if (light < 8 && g.dimKey !== 'sky') continue;
      c.t -= dt * mult;
      if (c.t <= 0) { c.t = P.GROW; w.setBlock(c.x, c.y, c.z, id + 1); if (id + 1 === B.CROP2) c.gone = true; g.particles.burst(c.x + 0.5, c.y + 0.6, c.z + 0.5, [140, 230, 90], 5, 1); }
    }
    g.crops[g.dimKey] = list.filter(c => !c.gone);
  };
})(window.LL);
