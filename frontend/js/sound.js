/* =========================================================================
   sound.js — tiny Web-Audio sound effects.
   Honors the `sounds` preference from settings.
   No MP3 files — every sound is synthesised so the project ships with
   zero extra binaries.
   ========================================================================= */
(function (global) {
  const PREF_KEY = 'sh_prefs_v1';

  function soundsOn() {
    try {
      const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return p.sounds !== false; // default ON
    } catch { return true; }
  }

  let ctx = null;
  /** Browsers require a user gesture before AudioContext can run. */
  function ensureCtx() {
    if (ctx) return ctx;
    const Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { ctx = null; }
    return ctx;
  }

  /** Play one note. `type` is an OscillatorNode wave type. */
  function note(freq, durMs, type = 'sine', gain = 0.15, delayMs = 0) {
    const ac = ensureCtx();
    if (!ac) return;
    const start = ac.currentTime + delayMs / 1000;
    const end = start + durMs / 1000;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(ac.destination);
    // Quick attack/decay envelope
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(start);
    osc.stop(end);
  }

  const SOUNDS = {
    log:          () => note(660, 120, 'sine', 0.18),
    badge:        () => { note(523, 100); note(659, 100, 'sine', 0.15, 100); note(784, 200, 'sine', 0.18, 200); },
    levelup:      () => { note(523, 80); note(659, 80, 'sine', 0.18, 80); note(784, 80, 'sine', 0.18, 160); note(1046, 220, 'sine', 0.22, 240); },
    error:        () => { note(220, 80, 'sawtooth', 0.12); note(180, 140, 'sawtooth', 0.12, 80); },
    purchase:     () => { note(880, 80); note(1175, 180, 'triangle', 0.18, 80); },
    message:      () => note(880, 80, 'triangle', 0.10),
    undo:         () => { note(440, 80, 'sine', 0.14); note(330, 120, 'sine', 0.14, 80); },
    // v5
    notification: () => { note(740, 90, 'triangle', 0.14); note(988, 140, 'triangle', 0.14, 90); },
    mystery:      () => { note(523, 90); note(659, 90, 'sine', 0.16, 90); note(784, 90, 'sine', 0.18, 180); note(1046, 90, 'sine', 0.20, 270); note(1318, 260, 'sine', 0.22, 360); }
  };

  function play(name) {
    if (!soundsOn()) return;
    const fn = SOUNDS[name];
    if (fn) fn();
  }

  /** Some browsers need a fresh resume after the tab is restored. */
  function initOnFirstGesture() {
    const handler = () => {
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
    document.addEventListener('click', handler, { once: false });
    document.addEventListener('keydown', handler, { once: false });
  }
  initOnFirstGesture();

  global.sound = { play, soundsOn };
})(window);
