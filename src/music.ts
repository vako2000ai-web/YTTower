import { loadJson, saveJson } from './records';

// Original procedural arrangement: marimba-like lead, bass, chords and light drums.
export class BackgroundMusic {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private step = 0;
  private enabled = false;
  private toggling = false;
  private readonly button = document.createElement('button');
  private readonly volume = document.createElement('input');

  constructor() {
    const panel = document.createElement('div');
    panel.className = 'music-controls';
    this.button.type = 'button';
    this.button.textContent = '♫ Включить музыку';
    this.button.setAttribute('aria-pressed', 'false');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '100';
    this.volume.setAttribute('aria-label', 'Громкость фоновой музыки');
    const saved = loadJson('yttower.music.volume');
    this.volume.value = String(typeof saved === 'number' ? Math.max(0, Math.min(100, saved)) : 35);
    panel.append(this.button, this.volume);
    document.body.append(panel);
    this.button.addEventListener('click', () => void this.toggle());
    this.volume.addEventListener('input', () => {
      saveJson('yttower.music.volume', Number(this.volume.value));
      this.master?.gain.setTargetAtTime(Number(this.volume.value) / 100 * 0.35, this.context!.currentTime, 0.05);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled && this.context) this.nextBeat = Math.max(this.nextBeat, this.context.currentTime);
    });
  }

  private async toggle() {
    if (this.toggling) return;
    this.toggling = true;
    this.button.disabled = true;
    try {
      if (this.enabled) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        await this.context?.suspend();
        this.enabled = false;
      } else {
        if (!this.context) {
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = Number(this.volume.value) / 100 * 0.35;
          const compressor = this.context.createDynamicsCompressor();
          this.master.connect(compressor);
          compressor.connect(this.context.destination);
        }
        await this.context.resume();
        this.nextBeat = this.context.currentTime + 0.05;
        this.enabled = true;
        this.schedule();
        this.timer = setInterval(() => this.schedule(), 50);
      }
      this.button.textContent = this.enabled ? '♫ Выключить музыку' : '♫ Включить музыку';
      this.button.setAttribute('aria-pressed', String(this.enabled));
    } catch {
      this.button.textContent = '♫ Повторить включение';
    } finally {
      this.toggling = false;
      this.button.disabled = false;
    }
  }

  private tone(midi: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const oscillator = this.context!.createOscillator();
    const envelope = this.context!.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  private drum(start: number, kick: boolean) {
    if (kick) {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.frequency.setValueAtTime(140, start);
      oscillator.frequency.exponentialRampToValueAtTime(45, start + 0.12);
      gain.gain.setValueAtTime(0.7, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain); gain.connect(this.master!);
      oscillator.start(start); oscillator.stop(start + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } else {
      const buffer = this.context!.createBuffer(1, this.context!.sampleRate * 0.06, this.context!.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = this.context!.createBufferSource();
      const filter = this.context!.createBiquadFilter();
      const gain = this.context!.createGain();
      noise.buffer = buffer;
      filter.type = 'highpass'; filter.frequency.value = 6500;
      gain.gain.value = 0.12;
      noise.connect(filter); filter.connect(gain); gain.connect(this.master!);
      noise.start(start);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }

  private schedule() {
    if (!this.context || !this.enabled) return;
    const interval = 60 / 124 / 2;
    this.nextBeat = Math.max(this.nextBeat, this.context.currentTime);
    const melody = [76, 79, 81, 79, 76, 74, 72, 74, 77, 81, 84, 81, 79, 77, 76, 74,
      79, 83, 86, 83, 81, 79, 76, 74, 76, 79, 84, 79, 76, 74, 72, -1];
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    while (this.nextBeat < this.context.currentTime + 0.2) {
      const index = this.step % 32;
      const chord = chords[Math.floor(index / 8)];
      if (melody[index] >= 0) {
        this.tone(melody[index], this.nextBeat, 0.22, 0.22, 'triangle');
        this.tone(melody[index] + 12, this.nextBeat, 0.09, 0.04);
      }
      if (index % 2 === 0) this.tone(chord[0] - 12 + (index % 4 === 2 ? 7 : 0), this.nextBeat, 0.3, 0.28, 'triangle');
      if (index % 4 === 2) for (const note of chord) this.tone(note, this.nextBeat, 0.16, 0.07, 'triangle');
      this.drum(this.nextBeat, index % 4 === 0);
      this.step++;
      this.nextBeat += interval;
    }
  }
}
