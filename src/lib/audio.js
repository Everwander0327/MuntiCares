let audioCtx = null;
let unlocked = false;
let ringtoneInterval = null;
let nextRingTime = 0;
let ringCount = 0;

export const unlockAudio = () => {
  if (unlocked) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    unlocked = true;
  } catch {}
};

const scheduleRing = (time) => {
  if (!audioCtx) return;
  try {
    const playNote = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playNote(660, time, 0.7);
    playNote(880, time + 0.15, 0.5);
  } catch {}
};

export const playRingtone = () => {
  try {
    if (!audioCtx) unlockAudio();
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    if (!audioCtx) return;

    stopRingtone();

    const now = audioCtx.currentTime;
    nextRingTime = now + 0.1;
    ringCount = 0;

    const tick = () => {
      if (!audioCtx) return;
      const current = audioCtx.currentTime;
      while (nextRingTime < current + 0.5) {
        scheduleRing(nextRingTime);
        nextRingTime += 1.2;
        ringCount++;
        if (ringCount > 500) break;
      }
      ringtoneInterval = requestAnimationFrame(tick);
    };
    tick();
  } catch {}
};

export const stopRingtone = () => {
  try {
    if (ringtoneInterval) {
      cancelAnimationFrame(ringtoneInterval);
      ringtoneInterval = null;
    }
    nextRingTime = 0;
    ringCount = 0;
    if (audioCtx?.state === 'running') {
      audioCtx.suspend();
    }
  } catch {}
};

/**
 * Satisfying Apple-like / Dynamic Island pop chime for toasts
 */
export const playToastSound = (type = 'success') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    if (type === 'error') {
      // Soft double-tap alert for error
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      // Crisp 2-tone pop chime (bubble unroll + lock chime)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Higher sparkle chime on lock (0.12s later)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.1); // D6
      gain2.gain.setValueAtTime(0.25, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.32);
    }
  } catch {
    // Audio Context not permitted or supported
  }
};

