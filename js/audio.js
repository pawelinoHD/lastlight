// Lastlight — procedural sound and music
'use strict';
(function (LL) {
  let ctx = null, master = null, musicGain = null, noiseBuf = null, volume = 0.7, musicVol = 0.5;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol * 0.5; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(dur, freq, q, vol, type = 'bandpass', when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type = 'sine', when = 0, slide = 0, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  const matFreq = id => {
    const b = LL.BLOCKS[id]; if (!b) return 800;
    if (b.tool === 'pick') return 1800; if (b.tool === 'axe') return 600; if (b.leafy || LL.RT[id] === 3) return 3000; return 900;
  };
  LL.sfx = {
    init,
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setMusic(v) { musicVol = v; if (musicGain) musicGain.gain.value = v * 0.5; },
    dig(id, v) { noise(0.09 + v * 0.06, matFreq(id), 1.2, 0.25 * v + 0.1); },
    place(id) { noise(0.1, matFreq(id) * 0.7, 1, 0.35); tone(140, 0.08, 0.15, 'sine'); },
    step(id) { if (!id) return; noise(0.06, matFreq(id) * 0.8, 1, 0.07); },
    hit(v = 1) { tone(220 * v, 0.12, 0.25, 'square', 0, 0.5); noise(0.08, 1200, 1, 0.2); },
    hurt() { tone(180, 0.25, 0.35, 'sawtooth', 0, 0.45); },
    pickup() { tone(880 + Math.random() * 200, 0.08, 0.12, 'triangle'); tone(1320, 0.1, 0.08, 'triangle', 0.05); },
    eat() { for (let i = 0; i < 3; i++) noise(0.07, 700, 2, 0.2, 'bandpass', i * 0.1); },
    craft() { tone(523, 0.12, 0.14, 'triangle'); tone(784, 0.18, 0.12, 'triangle', 0.08); },
    breakTool() { noise(0.3, 2500, 3, 0.4); tone(300, 0.3, 0.2, 'square', 0, 0.3); },
    portal() { tone(110, 2.2, 0.25, 'sine', 0, 4); tone(165, 2.2, 0.15, 'triangle', 0.1, 3); noise(2, 600, 0.5, 0.25, 'lowpass'); },
    roar() { tone(70, 1.2, 0.5, 'sawtooth', 0, 0.6); noise(1.2, 300, 0.7, 0.4, 'lowpass'); },
    kindle() { [261, 329, 392, 523, 659, 784].forEach((f, i) => tone(f, 2.5, 0.12, 'triangle', i * 0.18)); },
    ui() { tone(660, 0.05, 0.06, 'triangle'); },
  };
  // gentle generative music: sparse pentatonic plucks, mood per dimension/time
  const scales = { day: [261.6, 293.7, 329.6, 392, 440, 523.2, 587.3], night: [220, 261.6, 293.7, 329.6, 392, 440], gloam: [146.8, 174.6, 196, 220, 261.6, 293.7], sky: [392, 440, 523.2, 587.3, 659.3, 784, 880] };
  let nextNote = 0, phraseLeft = 0, rest = 8;
  LL.music = function (dt, mood) {
    if (!ctx || musicVol <= 0) return;
    nextNote -= dt;
    if (nextNote > 0) return;
    if (phraseLeft <= 0) { if (rest > 0) { rest -= 1; nextNote = 1; return; } phraseLeft = 5 + (Math.random() * 8 | 0); rest = 10 + Math.random() * 20; }
    const sc = scales[mood] || scales.day;
    const f = sc[Math.random() * sc.length | 0] * (Math.random() < 0.2 ? 0.5 : 1);
    tone(f, 2.2, 0.09, mood === 'gloam' ? 'sine' : 'triangle', 0, 0, musicGain);
    if (Math.random() < 0.35) tone(f * 1.5, 1.8, 0.04, 'sine', 0.02, 0, musicGain);
    phraseLeft--; nextNote = [0.4, 0.6, 0.8, 1.2][Math.random() * 4 | 0];
  };
})(window.LL);
