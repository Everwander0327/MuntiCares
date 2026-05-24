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
