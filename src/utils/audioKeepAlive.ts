/**
 * Keeps the browser audio thread alive across brief gaps between tracks or TTS chunks
 * while the device screen is locked, without producing any audible output.
 */
class BackgroundAudioKeepAlive {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private activeOwners = new Set<'quran' | 'speech'>();
  private visibilityListenerAttached = false;

  private attachVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;
    this.visibilityListenerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (this.activeOwners.size > 0) {
        this.ensureRunning();
      }
    });
  }

  private ensureRunning() {
    if (typeof window === 'undefined') return;
    this.attachVisibilityListener();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => {});
      }
      if (!this.source) {
        const sampleRate = this.ctx.sampleRate || 44100;
        const buffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
        const channel = buffer.getChannelData(0);
        // Ultra-low sub-quantization floor (-120dB) prevents browsers from
        // optimizing away the audio graph as pure silence while remaining silent.
        channel[0] = 1e-6;

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.01;

        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
        this.source = src;
      }
    } catch {
      // Ignore Web Audio restrictions
    }
  }

  acquire(owner: 'quran' | 'speech') {
    this.activeOwners.add(owner);
    this.ensureRunning();
  }

  release(owner: 'quran' | 'speech') {
    this.activeOwners.delete(owner);
    if (
      this.activeOwners.size === 0 &&
      this.ctx &&
      this.ctx.state === 'running'
    ) {
      void this.ctx.suspend().catch(() => {});
    }
  }
}

export const audioKeepAlive = new BackgroundAudioKeepAlive();
