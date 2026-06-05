let ctx: AudioContext | null = null;
let musicInterval: any = null;
let isMusicPlaying = false;
let isMuted = false;

function getContext(): AudioContext | null {
  if (isMuted) return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

export const gameAudio = {
  toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return isMuted;
  },

  isMuted() {
    return isMuted;
  },

  playTill() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    // Pitch drop
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);

    // Dust noise burst
    const noise = c.createBufferSource();
    const noiseGain = c.createGain();
    const filter = c.createBiquadFilter();

    const bufferSize = c.sampleRate * 0.1;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);

    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.linearRampToValueAtTime(0.01, now + 0.1);

    noise.start(now);
    noise.stop(now + 0.1);
  },

  playWater() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    // Noise splash
    const noise = c.createBufferSource();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    const bufferSize = c.sampleRate * 0.25;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);

    noise.start(now);
    noise.stop(now + 0.25);
  },

  playChop() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    // Woody knock
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    // Leaves rustle
    const noise = c.createBufferSource();
    const noiseGain = c.createGain();
    const filter = c.createBiquadFilter();

    const buffer = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);

    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.linearRampToValueAtTime(0.005, now + 0.15);

    noise.start(now);
    noise.stop(now + 0.15);
  },

  playMine() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    // High clink
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    // Stone breaking thump
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.18);

    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

    osc2.connect(gain2);
    gain2.connect(c.destination);
    osc2.start(now);
    osc2.stop(now + 0.18);
  },

  playSwing() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    const noise = c.createBufferSource();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    const buffer = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);

    noise.start(now);
    noise.stop(now + 0.1);
  },

  playHit() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  },

  playCoin() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(988, now); // B5
    osc.frequency.setValueAtTime(1318, now + 0.08); // E6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  },

  playLevelUp() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.1;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  playSleep() {
    const c = getContext();
    if (!c) return;
    const now = c.currentTime;

    // Simple warm chord sequence: Cmaj -> Fmaj -> Gmaj -> Cmaj
    const chords = [
      [261.63, 329.63, 392.00], // C
      [349.23, 440.00, 523.25], // F
      [392.00, 493.88, 587.33], // G
      [523.25, 659.25, 783.99], // C
    ];

    chords.forEach((chord, chordIdx) => {
      const chordTime = now + chordIdx * 0.4;
      chord.forEach((freq) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, chordTime);

        gain.gain.setValueAtTime(0.08, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.38);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(chordTime);
        osc.stop(chordTime + 0.38);
      });
    });
  },

  startMusic() {
    if (isMusicPlaying || isMuted) return;
    const c = getContext();
    if (!c) return;
    isMusicPlaying = true;

    // VERY quiet, ambient cozy farm arpeggiator in background
    // C-major & F-major & G-major progressions
    const notes = [
      261.63, 329.63, 392.00, 523.25, // C maj
      293.66, 349.23, 440.00, 587.33, // D min / F maj
      392.00, 493.88, 587.33, 783.99, // G maj
      349.23, 440.00, 523.25, 698.46, // F maj
    ];

    let stepIdx = 0;
    musicInterval = setInterval(() => {
      const ctxActive = getContext();
      if (!ctxActive || ctxActive.state === "suspended") return;
      const t = ctxActive.currentTime;

      const chordOffset = Math.floor(stepIdx / 4) % 4;
      const noteOffset = stepIdx % 4;
      const freq = notes[chordOffset * 4 + noteOffset];

      const osc = ctxActive.createOscillator();
      const gain = ctxActive.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      // Super quiet, non-obtrusive
      gain.gain.setValueAtTime(0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

      osc.connect(gain);
      gain.connect(ctxActive.destination);

      osc.start(t);
      osc.stop(t + 0.6);

      stepIdx = (stepIdx + 1) % 16;
    }, 400);
  },

  stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    isMusicPlaying = false;
  },
};
