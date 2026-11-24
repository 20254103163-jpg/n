/**
 * 100% Procedural Web Audio API Soundscape
 * Synthesizes filtered pink noise for coastal surf, rain, wind, and pentatonic chimes.
 * Also exposes a MediaStream destination so exported WebM videos include live procedural audio.
 */
export class ProceduralSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private oceanGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private active = false;

  private readonly pentatonicHz = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];

  isActive(): boolean {
    return this.active;
  }

  getAudioStream(): MediaStream | null {
    if (!this.active || !this.streamDest) return null;
    return this.streamDest.stream;
  }

  toggle(): boolean {
    if (this.active) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  start(): void {
    if (this.active) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.001;
      this.masterGain.connect(this.ctx.destination);

      this.streamDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDest);

      const bufferSize = this.ctx.sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
      }

      const oceanSource = this.ctx.createBufferSource();
      oceanSource.buffer = noiseBuffer;
      oceanSource.loop = true;
      const oceanFilter = this.ctx.createBiquadFilter();
      oceanFilter.type = 'lowpass';
      oceanFilter.frequency.value = 260;
      this.oceanGain = this.ctx.createGain();
      this.oceanGain.gain.value = 0.24;
      oceanSource.connect(oceanFilter);
      oceanFilter.connect(this.oceanGain);
      this.oceanGain.connect(this.masterGain);
      oceanSource.start();

      const rainSource = this.ctx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 2400;
      this.rainFilter.Q.value = 0.65;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0.05;
      rainSource.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      rainSource.start();

      const windSource = this.ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 480;
      this.windFilter.Q.value = 3.2;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.06;
      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSource.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    this.masterGain?.gain.cancelScheduledValues(now);
    this.masterGain?.gain.setTargetAtTime(0.45, now, 0.35);
    this.active = true;
  }

  stop(): void {
    if (!this.active || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.2);
    this.active = false;
  }

  update(rainIntensity: number, windAbsNorm: number, timeSec: number): void {
    if (!this.active || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.rainGain && this.rainFilter) {
      this.rainGain.gain.setTargetAtTime(0.02 + rainIntensity * 0.28, now, 0.15);
      this.rainFilter.frequency.setTargetAtTime(1600 + rainIntensity * 1400, now, 0.2);
    }

    if (this.windGain && this.windFilter) {
      this.windGain.gain.setTargetAtTime(0.03 + windAbsNorm * 0.14, now, 0.2);
      this.windFilter.frequency.setTargetAtTime(
        360 + windAbsNorm * 320 + Math.sin(timeSec * 0.7) * 45,
        now,
        0.25
      );
    }

    if (this.oceanGain) {
      const swell = 0.2 + Math.sin(timeSec * 0.55) * 0.06;
      this.oceanGain.gain.setTargetAtTime(swell, now, 0.2);
    }
  }

  playLanternChime(): void {
    if (!this.active || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freq = this.pentatonicHz[Math.floor(Math.random() * this.pentatonicHz.length)];

    const osc = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(freq * 2, now);

    const harmGain = this.ctx.createGain();
    harmGain.gain.value = 0.12;

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.11, now + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    osc.connect(env);
    harmonic.connect(harmGain);
    harmGain.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 2.5);
    harmonic.stop(now + 2.5);
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
