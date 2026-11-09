// Lastlight — synthesized sound: materials, creature voices, positional audio, ambience and music
'use strict';
(function (LL) {
  let ctx = null, master = null, lowpass = null, sfxBus = null, ambBus = null, musicBus = null, verbIn = null;
  let white = null, brown = null, volume = 0.7, musicVol = 0.5;
  const L = { x: 0, y: 0, z: 0, yaw: 0 };
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeNoise(kind) {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function makeVerb(sec) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const v = ctx.createConvolver(); v.buffer = b; return v;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = volume;
    lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(lowpass); lowpass.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.8; ambBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.55; musicBus.connect(master);
    const verb = makeVerb(2.6), verbOut = ctx.createGain(); verbOut.gain.value = 0.32;
    verbIn = ctx.createGain(); verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
    white = makeNoise('white'); brown = makeNoise('brown');
    buildAmbience();
  }
  const T = () => ctx.currentTime;

  // ---------- voices ----------
  // out(): a panner+gain node chain feeding the sfx bus (and optionally the reverb)
  function out(vol, pan = 0, wet = 0.15, bus) {
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
    node.connect(bus || sfxBus);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(verbIn); }
    return g;
  }
  function burst(o) {
    const t = T() + (o.at || 0), dur = o.dur || 0.1;
    const s = ctx.createBufferSource(); s.buffer = o.brown ? brown : white; s.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.atk || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || out(1, o.pan, o.wet));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(o) {
    const t = T() + (o.at || 0), dur = o.dur || 0.2;
    const os = ctx.createOscillator(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide || dur));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibRate || 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.05); }
    let node = os;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.atk || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(o.dest || out(1, o.pan, o.wet));
    os.start(t); os.stop(t + dur + 0.05);
  }

  // ---------- materials ----------
  function mat(id) {
    const b = LL.BLOCKS[id]; if (!b || !id) return 'none';
    if (LL.RT[id] === 3) return 'plant';
    if (b.leafy) return 'leaves';
    if ([17, 28, 53, 25, 77, 40, 44, 72].includes(id)) return 'crystal';
    if (id === 14 || id === 15) return 'sand';
    if (id === 16 || id === 35) return 'snow';
    if (id === 79 || id === 22 || id === 24) return 'metal';
    if (b.tool === 'axe' || id === 73) return 'wood';
    if (b.tool === 'shovel') return 'dirt';
    if (id === 18) return 'water';
    return 'stone';
  }
  function matSound(m, k, pan) {
    // k: 0..1 strength
    switch (m) {
      case 'stone': burst({ f: rand(2200, 3200), q: 2.5, dur: 0.05 + k * 0.04, vol: 0.18 + k * 0.25, pan }); tone({ f: rand(110, 140), f2: 60, dur: 0.07 + k * 0.05, vol: 0.12 + k * 0.2, pan, wet: 0.05 }); break;
      case 'metal': tone({ f: rand(900, 1200), dur: 0.25, vol: 0.12 + k * 0.15, type: 'triangle', pan, wet: 0.3 }); burst({ f: 3000, q: 3, dur: 0.05, vol: 0.2 + k * 0.2, pan }); break;
      case 'wood': burst({ f: rand(500, 800), q: 4, dur: 0.07 + k * 0.05, vol: 0.2 + k * 0.25, pan }); tone({ f: rand(190, 240), f2: 150, dur: 0.06 + k * 0.04, vol: 0.12 + k * 0.15, type: 'triangle', pan }); break;
      case 'dirt': burst({ f: rand(500, 800), type: 'lowpass', q: 0.7, dur: 0.09 + k * 0.06, vol: 0.25 + k * 0.25, brown: true, rate: 2, pan }); break;
      case 'sand': for (let i = 0; i < 4; i++) burst({ at: i * 0.025, f: rand(2500, 4500), q: 0.8, dur: 0.04, vol: 0.08 + k * 0.1, pan }); break;
      case 'snow': for (let i = 0; i < 4; i++) burst({ at: i * 0.03, f: rand(900, 1500), type: 'lowpass', dur: 0.05, vol: 0.12 + k * 0.12, pan }); break;
      case 'leaves': case 'plant': burst({ f: rand(3500, 5500), type: 'highpass', q: 0.5, dur: 0.12 + k * 0.08, vol: 0.06 + k * 0.1, atk: 0.03, pan }); break;
      case 'crystal': [rand(1800, 2200), rand(2700, 3200), rand(3900, 4400)].forEach((f, i) => tone({ f, dur: 0.25 + k * 0.3, vol: (0.06 + k * 0.06) / (i + 1), at: i * 0.01, pan, wet: 0.4 })); burst({ f: 6000, q: 1, dur: 0.03, vol: 0.1, pan }); break;
      case 'water': burst({ f: 700, f2: 300, q: 1, dur: 0.25, vol: 0.2, pan, wet: 0.2 }); break;
    }
  }

  // ---------- creature voices ----------
  const VOICES = {
    gloomling: { idle: p => { burst({ f: 900, f2: 1700, q: 6, dur: 0.6, vol: 0.12, atk: 0.2, wet: 0.5, ...p }); tone({ f: 70, dur: 0.5, vol: 0.06, type: 'sawtooth', lp: 300, ...p }); }, hurt: p => burst({ f: 1500, f2: 600, q: 4, dur: 0.25, vol: 0.25, ...p }), attack: p => burst({ f: 600, f2: 2400, q: 3, dur: 0.18, vol: 0.25, ...p }), die: p => { burst({ f: 2000, f2: 200, q: 2, dur: 0.9, vol: 0.25, atk: 0.05, wet: 0.6, ...p }); } },
    brute: { idle: p => tone({ f: 55, f2: 45, dur: 1.2, vol: 0.25, type: 'sawtooth', lp: 250, vib: 4, ...p }), hurt: p => tone({ f: 90, f2: 60, dur: 0.4, vol: 0.3, type: 'sawtooth', lp: 400, ...p }), attack: p => { tone({ f: 70, f2: 40, dur: 0.5, vol: 0.35, type: 'sawtooth', lp: 500, ...p }); burst({ f: 300, q: 1, dur: 0.3, vol: 0.3, brown: true, ...p }); }, die: p => tone({ f: 80, f2: 30, dur: 1.5, vol: 0.35, type: 'sawtooth', lp: 400, wet: 0.5, ...p }) },
    buck: { idle: p => tone({ f: 420, f2: 360, dur: 0.35, vol: 0.12, type: 'sawtooth', lp: 1400, vib: 25, vibRate: 18, ...p }), hurt: p => tone({ f: 600, f2: 420, dur: 0.3, vol: 0.18, type: 'sawtooth', lp: 1800, vib: 30, vibRate: 20, ...p }), die: p => tone({ f: 500, f2: 250, dur: 0.6, vol: 0.18, type: 'sawtooth', lp: 1500, ...p }) },
    boar: { idle: p => { for (let i = 0; i < 2; i++) tone({ at: i * 0.18, f: 115, f2: 80, dur: 0.14, vol: 0.2, type: 'sawtooth', lp: 650, ...p }); }, hurt: p => tone({ f: 260, f2: 140, dur: 0.3, vol: 0.25, type: 'sawtooth', lp: 1200, ...p }), attack: p => { tone({ f: 150, f2: 90, dur: 0.25, vol: 0.3, type: 'sawtooth', lp: 800, ...p }); burst({ f: 400, q: 1, dur: 0.2, vol: 0.2, brown: true, ...p }); }, die: p => tone({ f: 200, f2: 70, dur: 0.7, vol: 0.25, type: 'sawtooth', lp: 900, ...p }) },
    crawler: { idle: p => { for (let i = 0; i < 6; i++) burst({ at: i * 0.045, f: 4000, q: 6, dur: 0.02, vol: 0.12, ...p }); }, hurt: p => burst({ f: 2500, f2: 900, q: 3, dur: 0.2, vol: 0.25, ...p }), attack: p => { for (let i = 0; i < 3; i++) burst({ at: i * 0.03, f: 3000, q: 4, dur: 0.03, vol: 0.25, ...p }); }, die: p => { for (let i = 0; i < 10; i++) burst({ at: i * 0.05, f: 3500 - i * 250, q: 5, dur: 0.03, vol: 0.15, ...p }); } },
    wisp: { idle: p => burst({ f: 700, f2: 2400, q: 2, dur: 0.8, vol: 0.12, atk: 0.3, wet: 0.5, ...p }), hurt: p => tone({ f: 1400, f2: 900, dur: 0.2, vol: 0.15, ...p }), attack: p => burst({ f: 400, f2: 3000, q: 1.5, dur: 0.4, vol: 0.25, atk: 0.05, ...p }), die: p => burst({ f: 3000, f2: 200, q: 1.5, dur: 1, vol: 0.25, wet: 0.6, ...p }) },
    lurker: { idle: p => { tone({ f: 85, dur: 0.35, vol: 0.18, type: 'square', lp: 400, vib: 20, vibRate: 30, ...p }); }, hurt: p => tone({ f: 160, f2: 90, dur: 0.3, vol: 0.22, type: 'square', lp: 700, ...p }), attack: p => { burst({ f: 700, f2: 250, q: 1, dur: 0.35, vol: 0.3, wet: 0.2, ...p }); tone({ f: 120, f2: 70, dur: 0.3, vol: 0.2, type: 'square', lp: 500, ...p }); }, die: p => tone({ f: 120, f2: 50, dur: 0.8, vol: 0.22, type: 'square', lp: 500, ...p }) },
    beetle: { idle: p => { for (let i = 0; i < 3; i++) burst({ at: i * 0.07, f: 5000, q: 8, dur: 0.015, vol: 0.12, ...p }); }, hurt: p => { burst({ f: 6000, type: 'highpass', dur: 0.4, vol: 0.18, atk: 0.01, ...p }); burst({ f: 2500, q: 4, dur: 0.05, vol: 0.2, ...p }); }, attack: p => burst({ f: 3500, q: 5, dur: 0.06, vol: 0.25, ...p }), die: p => burst({ f: 5000, type: 'highpass', dur: 0.8, vol: 0.2, ...p }) },
    wraith: { idle: p => tone({ f: 620, f2: 880, glide: 1.4, dur: 1.6, vol: 0.09, vib: 14, vibRate: 5, atk: 0.4, wet: 0.8, ...p }), hurt: p => tone({ f: 900, f2: 500, dur: 0.4, vol: 0.14, vib: 20, wet: 0.5, ...p }), attack: p => { tone({ f: 1100, f2: 400, dur: 0.5, vol: 0.15, vib: 25, wet: 0.6, ...p }); burst({ f: 2000, type: 'highpass', dur: 0.4, vol: 0.12, ...p }); }, die: p => tone({ f: 900, f2: 120, dur: 1.6, vol: 0.15, vib: 18, wet: 0.9, ...p }) },
    moth: { idle: p => { for (let i = 0; i < 8; i++) burst({ at: i * 0.035, f: 1800, q: 1, dur: 0.02, vol: 0.04, ...p }); }, hurt: p => tone({ f: 2200, f2: 3000, dur: 0.1, vol: 0.08, ...p }), die: p => tone({ f: 2500, f2: 1200, dur: 0.25, vol: 0.08, wet: 0.4, ...p }) },
    sporekin: { idle: p => { tone({ f: 1100, f2: 1500, dur: 0.12, vol: 0.08, ...p }); }, hurt: p => { tone({ f: 1500, f2: 1900, dur: 0.12, vol: 0.12, ...p }); burst({ f: 900, type: 'lowpass', dur: 0.3, vol: 0.15, atk: 0.02, ...p }); }, die: p => burst({ f: 700, type: 'lowpass', dur: 0.6, vol: 0.2, atk: 0.05, wet: 0.4, ...p }) },
    skyray: { idle: p => tone({ f: 210, f2: 260, glide: 1, dur: 1.2, vol: 0.08, vib: 4, atk: 0.4, wet: 0.7, ...p }), hurt: p => tone({ f: 420, f2: 300, dur: 0.3, vol: 0.12, wet: 0.4, ...p }), die: p => tone({ f: 300, f2: 120, dur: 1.2, vol: 0.12, wet: 0.7, ...p }) },
    keeper: { idle: p => { tone({ f: 180, f2: 225, dur: 0.22, vol: 0.1, type: 'triangle', lp: 900, ...p }); tone({ at: 0.24, f: 225, f2: 200, dur: 0.3, vol: 0.1, type: 'triangle', lp: 900, ...p }); } },
    maw: { idle: p => tone({ f: 48, dur: 2, vol: 0.3, type: 'sawtooth', lp: 200, vib: 3, ...p }), hurt: p => tone({ f: 120, f2: 70, dur: 0.5, vol: 0.3, type: 'sawtooth', lp: 500, wet: 0.5, ...p }), attack: p => tone({ f: 80, f2: 40, dur: 1.2, vol: 0.4, type: 'sawtooth', lp: 400, wet: 0.5, ...p }), die: p => tone({ f: 100, f2: 25, dur: 3, vol: 0.45, type: 'sawtooth', lp: 500, wet: 0.9, ...p }) },
  };
  // where is a world position relative to the listener: returns {pan, vol} or null if out of earshot
  function place3d(pos, range = 32) {
    if (!pos) return { pan: 0, vol: 1 };
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = (pos.y || L.y) - L.y, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > range) return null;
    const rx = Math.cos(L.yaw) * dx - Math.sin(L.yaw) * dz; // listener's right-axis component
    return { pan: d > 0.5 ? Math.max(-0.9, Math.min(0.9, rx / Math.max(d, 1))) : 0, vol: 1 / (1 + d / 7) };
  }
  function voice(type, kind, pos) {
    if (!ctx) return;
    const v = VOICES[type === 'settler' ? 'keeper' : type]; if (!v || !v[kind]) return;
    const p3 = place3d(pos, type === 'maw' ? 60 : 30); if (!p3) return;
    const dest = out(p3.vol, p3.pan, kind === 'die' ? 0.3 : 0.15);
    v[kind]({ dest, pan: p3.pan });
  }

  // ---------- ambience ----------
  const amb = {};
  function loop(buf, f, type, q) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(ambBus); s.start();
    return { s, fl, g };
  }
  function buildAmbience() {
    amb.wind = loop(brown, 500, 'lowpass');
    amb.gust = loop(white, 800, 'bandpass', 0.6);
    amb.water = loop(brown, 350, 'lowpass');
    // gloam drone: two detuned low sines
    amb.drone = ctx.createGain(); amb.drone.gain.value = 0; amb.drone.connect(ambBus);
    [55, 55.7, 82.4].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f > 60 ? 0.25 : 0.5; o.connect(g); g.connect(amb.drone); o.start(); });
    amb.t = 0; amb.next = {};
  }
  function ease(param, v, k = 0.04) { param.value += (v - param.value) * k; }
  function ambience(dt, s) {
    if (!ctx) return;
    amb.t += dt;
    const outdoors = s.skyLight >= 10, day = s.daylight > 0.55, night = s.daylight < 0.35;
    // wind: stronger high up, in Pinefrost and Skyreach, muffled underground
    let wind = s.dim === 'gloam' ? 0.02 : outdoors ? 0.12 : 0.03;
    if (s.biome === 4 || s.dim === 'sky') wind *= 2.2;
    wind *= 1 + Math.max(0, (s.y - 60) / 40);
    const gustMod = 0.6 + 0.4 * Math.sin(amb.t * 0.23) * Math.sin(amb.t * 0.071 + 1);
    ease(amb.wind.g.gain, Math.min(0.5, wind * gustMod));
    amb.wind.fl.frequency.value = 350 + gustMod * 500;
    ease(amb.gust.g.gain, s.dim === 'sky' || s.biome === 4 ? 0.02 * gustMod : 0.004);
    amb.gust.fl.frequency.value = 600 + gustMod * 900;
    ease(amb.water.g.gain, s.inWater ? 0.35 : s.nearWater ? 0.06 : 0);
    ease(amb.drone.gain, s.dim === 'gloam' ? 0.05 : s.umbral ? 0.03 : 0, 0.02);
    lowpass.frequency.value = s.underwater ? 650 : 20000;
    // scattered events
    const every = (k, sec, fn) => { if ((amb.next[k] = (amb.next[k] || 0) - dt) <= 0) { amb.next[k] = sec * rand(0.6, 1.4); fn(); } };
    const pan = () => rand(-0.8, 0.8);
    if (s.dim === 'wild' && outdoors && day && (s.biome === 2 || s.biome === 3 || s.biome === 7)) every('bird', 2.8, () => {
      const base = rand(2400, 4200), p = pan(), n = 2 + (Math.random() * 4 | 0);
      for (let i = 0; i < n; i++) tone({ at: i * rand(0.07, 0.12), f: base * rand(0.9, 1.15), f2: base * rand(1.2, 1.6), dur: 0.07, vol: 0.035, dest: out(1, p, 0.3, ambBus) });
    });
    if (s.dim === 'wild' && night && outdoors && s.biome !== 4) every('cricket', 0.9, () => {
      const p = pan(), f = rand(4200, 4800);
      for (let i = 0; i < 3; i++) burst({ at: i * 0.05, f, q: 25, dur: 0.035, vol: 0.05, dest: out(1, p, 0.1, ambBus) });
    });
    if (s.dim === 'wild' && s.biome === 6) every('frog', 3.5, () => { const p = pan(); tone({ f: rand(110, 160), dur: 0.25, vol: 0.06, type: 'square', lp: 500, vib: 25, vibRate: 28, dest: out(1, p, 0.2, ambBus) }); });
    if (s.dim === 'wild' && s.biome === 5) every('crackle', 0.4, () => burst({ f: rand(2000, 6000), q: 3, dur: 0.012, vol: 0.06, dest: out(1, pan(), 0, ambBus) }));
    if (s.dim === 'gloam') every('drip', 2.2, () => { const f = rand(700, 1600); tone({ f, f2: f * 1.6, glide: 0.05, dur: 0.18, vol: 0.06, dest: out(1, pan(), 0.9, ambBus) }); });
    if (s.dim === 'sky') every('chime', 6, () => { const r = [523, 587, 659, 784, 880], p = pan(); for (let i = 0; i < 3; i++) tone({ at: i * 0.22, f: r[Math.random() * 5 | 0] * 2, dur: 1.4, vol: 0.025, type: 'triangle', dest: out(1, p, 0.8, ambBus) }); });
    if (s.umbral) every('heart', 1.1, () => { tone({ f: 55, f2: 40, dur: 0.18, vol: 0.12, dest: out(1, 0, 0.1, ambBus) }); tone({ at: 0.24, f: 50, f2: 38, dur: 0.16, vol: 0.09, dest: out(1, 0, 0.1, ambBus) }); });
    if (s.nearFire) every('fire', 0.25, () => burst({ f: rand(1500, 5000), q: 2, dur: 0.015, vol: 0.05, dest: out(1, rand(-0.3, 0.3), 0, ambBus) }));
  }

  LL.sfx = {
    init,
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setMusic(v) { musicVol = v; if (musicBus) musicBus.gain.value = v * 0.55; },
    listener(pos, yaw) { L.x = pos.x; L.y = pos.y; L.z = pos.z; L.yaw = yaw; },
    ambience,
    mob: voice,
    dig(id, k = 0.5) { if (ctx) matSound(mat(id), k * 0.6, rand(-0.1, 0.1)); },
    breakBlock(id, pos) { if (!ctx) return; const p = place3d(pos, 24) || { pan: 0 }; const m = mat(id); matSound(m, 1, p.pan); for (let i = 0; i < 3; i++) burst({ at: 0.04 + i * 0.05, f: m === 'stone' ? 1800 : 700, q: 1, dur: 0.05, vol: 0.06, pan: p.pan, brown: m !== 'stone' }); },
    place(id) { if (!ctx) return; tone({ f: 95, f2: 60, dur: 0.09, vol: 0.22 }); matSound(mat(id), 0.4, 0); },
    step(id, sprint) { if (!ctx || !id) return; const m = mat(id), k = sprint ? 0.32 : 0.2; const pan = (amb.stepSide = !amb.stepSide) ? -0.15 : 0.15;
      if (m === 'stone' || m === 'metal' || m === 'crystal') burst({ f: rand(1800, 2600), q: 1.5, dur: 0.035, vol: 0.06 * k * 4, pan, wet: 0.05 });
      else if (m === 'wood') { burst({ f: rand(400, 600), q: 2, dur: 0.05, vol: 0.07 * k * 4, pan }); tone({ f: 140, f2: 110, dur: 0.05, vol: 0.04 * k * 4, type: 'triangle', pan }); }
      else matSound(m, k * 0.5, pan); },
    land(id, v) { if (!ctx) return; tone({ f: 80, f2: 45, dur: 0.15, vol: Math.min(0.4, v * 0.03) }); matSound(mat(id), 0.6, 0); },
    splash(big) { if (!ctx) return; burst({ f: 1200, f2: 300, q: 0.8, dur: big ? 0.6 : 0.3, vol: big ? 0.35 : 0.18, atk: 0.01, wet: 0.2 }); for (let i = 0; i < 5; i++) tone({ at: 0.05 + i * 0.05, f: rand(500, 1300), f2: rand(900, 2000), glide: 0.04, dur: 0.06, vol: 0.04 }); },
    hit(v = 1) { if (!ctx) return; burst({ f: 1400 * v, q: 1.2, dur: 0.07, vol: 0.3 }); tone({ f: 160 * v, f2: 80 * v, dur: 0.1, vol: 0.25, type: 'triangle' }); },
    hurt() { if (!ctx) return; tone({ f: 220, f2: 120, dur: 0.22, vol: 0.3, type: 'sawtooth', lp: 1200 }); burst({ f: 600, q: 1, dur: 0.12, vol: 0.2, brown: true }); },
    pickup() { if (!ctx) return; const f = rand(880, 990); tone({ f, dur: 0.07, vol: 0.09, type: 'triangle' }); tone({ at: 0.05, f: f * 1.5, dur: 0.09, vol: 0.07, type: 'triangle', wet: 0.2 }); },
    eat() { if (!ctx) return; for (let i = 0; i < 3; i++) burst({ at: i * 0.11, f: rand(600, 900), q: 2, dur: 0.07, vol: 0.2, brown: true, rate: 2 }); },
    craft() { if (!ctx) return; tone({ f: 523, dur: 0.12, vol: 0.12, type: 'triangle' }); tone({ at: 0.08, f: 784, dur: 0.2, vol: 0.1, type: 'triangle', wet: 0.3 }); burst({ f: 3000, q: 4, dur: 0.04, vol: 0.12 }); },
    trade() { if (!ctx) return; for (let i = 0; i < 4; i++) tone({ at: i * 0.05, f: 1800 + i * 300, dur: 0.12, vol: 0.06, type: 'triangle', wet: 0.4 }); },
    levelUp() { if (!ctx) return; [392, 494, 587, 784].forEach((f, i) => tone({ at: i * 0.1, f, dur: 0.9, vol: 0.1, type: 'triangle', wet: 0.6 })); },
    breakTool() { if (!ctx) return; burst({ f: 2500, q: 3, dur: 0.3, vol: 0.4 }); tone({ f: 300, f2: 90, dur: 0.3, vol: 0.2, type: 'square', lp: 1500 }); },
    portal() { if (!ctx) return; tone({ f: 110, f2: 440, dur: 2.2, vol: 0.22, wet: 0.8 }); tone({ f: 165, f2: 495, dur: 2.2, vol: 0.14, type: 'triangle', at: 0.1, wet: 0.8 }); burst({ f: 300, f2: 3000, type: 'bandpass', q: 0.7, dur: 2, vol: 0.2, atk: 0.8, wet: 0.6 }); },
    roar() { if (!ctx) return; tone({ f: 70, f2: 40, dur: 1.3, vol: 0.45, type: 'sawtooth', lp: 400, vib: 6, wet: 0.5 }); burst({ f: 400, type: 'lowpass', dur: 1.2, vol: 0.35, brown: true, wet: 0.4 }); },
    kindle() { if (!ctx) return; [261, 329, 392, 523, 659, 784].forEach((f, i) => tone({ at: i * 0.15, f, dur: 2.5, vol: 0.09, type: 'triangle', wet: 0.7 })); },
    ui() { if (!ctx) return; tone({ f: 700, dur: 0.04, vol: 0.05, type: 'triangle' }); },
  };

  // ---------- music: soft pad chords with a sparse melody, mood by place and time ----------
  const MOODS = {
    day: { chords: [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]], mel: [523, 587, 659, 784, 880], wave: 'triangle' },
    night: { chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 233, 293.7], [164.8, 196, 246.9]], mel: [440, 523, 587, 659], wave: 'sine' },
    gloam: { chords: [[146.8, 174.6, 220], [130.8, 155.6, 196], [138.6, 164.8, 207.7]], mel: [293.7, 311, 349, 415], wave: 'sine' },
    sky: { chords: [[392, 493.9, 587.3], [349.2, 440, 523.3], [329.6, 415.3, 493.9], [293.7, 370, 440]], mel: [784, 880, 988, 1175], wave: 'triangle' },
    umbral: { chords: [[110, 130.8, 155.6], [103.8, 123.5, 146.8]], mel: [220, 233, 261.6], wave: 'sine' },
  };
  let mt = 0, chordI = 0, phraseLeft = 0, rest = 6, noteT = 0, curMood = 'day';
  function pad(freqs, dur) {
    freqs.forEach(f => [-4, 4].forEach(det => {
      const t = T(), o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(musicBus); const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(verbIn);
      o.start(t); o.stop(t + dur + 0.1);
    }));
  }
  LL.music = function (dt, mood) {
    if (!ctx || musicVol <= 0) return;
    curMood = MOODS[mood] ? mood : 'day';
    const M = MOODS[curMood];
    mt -= dt; noteT -= dt;
    if (mt <= 0) {
      if (rest > 0) { rest -= 1; mt = 1; return; }
      if (phraseLeft <= 0) { phraseLeft = 4 + (Math.random() * 4 | 0); }
      const ch = M.chords[chordI++ % M.chords.length];
      pad(ch, 9);
      mt = 8; phraseLeft--;
      if (phraseLeft <= 0) rest = 10 + Math.random() * 25;
    }
    if (noteT <= 0 && rest <= 0 && Math.random() < 0.6) {
      noteT = [0.6, 0.9, 1.2, 1.8][Math.random() * 4 | 0];
      const f = M.mel[Math.random() * M.mel.length | 0] * (Math.random() < 0.15 ? 0.5 : 1);
      tone({ f, dur: 1.8, vol: 0.05, type: M.wave, dest: musicBus });
      const s = ctx.createGain(); s.gain.value = 1;
      tone({ at: 0.01, f, dur: 1.8, vol: 0.03, type: M.wave, dest: verbIn });
    } else if (noteT <= 0) noteT = 0.8;
  };
})(window.LL);
