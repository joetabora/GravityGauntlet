type WaveType = OscillatorType;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export class AudioManager {
  private context?: AudioContext;

  private musicTimer?: number;

  private unlocked = false;

  private musicStep = 0;

  private masterGain?: GainNode;

  private ensureContext() {
    if (!this.context) {
      const audioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audioCtor) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      this.context = new audioCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.context.destination);
    }
    return this.context;
  }

  async unlock() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.unlocked = true;
  }

  startMusic() {
    if (!this.unlocked) {
      return;
    }
    if (this.musicTimer) {
      return;
    }
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      const ctx = this.context;
      if (!ctx || ctx.state !== 'running') {
        return;
      }
      const baseFreq = 220;
      const pattern = [0, 3, 7, 12, 7, 3, 0, -5];
      const freq = baseFreq * 2 ** (pattern[this.musicStep % pattern.length] / 12);
      this.playTone(freq, 0.25, 'square', 0.12);
      if (this.musicStep % 2 === 0) {
        this.playTone(freq / 2, 0.3, 'sawtooth', 0.08);
      }
      this.musicStep += 1;
    }, 420);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }
  }

  playCollision(magnitude: number) {
    if (!this.unlocked) {
      return;
    }
    const intensity = clamp(magnitude, 0.3, 2);
    const freq = 200 + intensity * 90;
    this.playTone(freq, 0.2, 'triangle', 0.18);
  }

  playPowerUp(type: string) {
    if (!this.unlocked) {
      return;
    }
    const freq = type === 'shield' ? 880 : type === 'gravity-reversal' ? 660 : 520;
    this.playTone(freq, 0.3, 'sine', 0.2);
    this.playTone(freq * 1.5, 0.18, 'square', 0.12);
  }

  playRoundWin() {
    if (!this.unlocked) {
      return;
    }
    const base = 440;
    this.playTone(base, 0.4, 'square', 0.25);
    window.setTimeout(() => this.playTone(base * 1.5, 0.4, 'triangle', 0.18), 120);
    window.setTimeout(() => this.playTone(base * 2, 0.5, 'sine', 0.14), 240);
  }

  private playTone(frequency: number, duration: number, wave: WaveType, gainValue: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }
    const oscillator = ctx.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }
}

export const audioManager = new AudioManager();

