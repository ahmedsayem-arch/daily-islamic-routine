/**
 * Keeps the browser audio session & OS Media AudioFocus alive across gaps between
 * Ayah MP3s or TTS speech chunks when the device screen is turned off, without
 * producing any audible sound.
 *
 * Uses BOTH:
 * 1. A continuously looping 1-second 16-bit PCM near-silent WAV <audio> element
 *    (required by Android Chrome, Samsung Internet, and iOS Safari so OS AudioFocus
 *    and background network/JS execution never drop during <audio> src transitions).
 * 2. A Web Audio API AudioContext buffer loop as secondary mixer keep-alive.
 */
class BackgroundAudioKeepAlive {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private keepAliveAudio: HTMLAudioElement | null = null;
  private silentWavBlobUrl: string | null = null;
  private isAudioUnlocked = false;
  private activeOwners = new Set<'quran' | 'speech'>();
  private visibilityListenerAttached = false;
  private releaseTimer: number | null = null;

  private getSilentWavUrl(): string {
    if (this.silentWavBlobUrl) return this.silentWavBlobUrl;
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') return '';

    // 1 second @ 8000 Hz mono 16-bit PCM = 16000 bytes of sample data + 44 byte WAV header.
    // Alternating +/-1 LSB (-90 dBFS, played at volume 0.01 = -130 dBFS) prevents
    // Android/Chrome zero-sample silence optimization while remaining physically inaudible.
    const sampleRate = 8000;
    const numSamples = sampleRate;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeAscii = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < numSamples; i += 1) {
      view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    this.silentWavBlobUrl = URL.createObjectURL(blob);
    return this.silentWavBlobUrl;
  }

  private ensureKeepAliveAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.keepAliveAudio) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.01;
      audio.muted = false;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      const src = this.getSilentWavUrl();
      if (src) {
        audio.src = src;
      }
      this.keepAliveAudio = audio;
    }
    return this.keepAliveAudio;
  }

  private clearReleaseTimer() {
    if (this.releaseTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  private attachVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;
    this.visibilityListenerAttached = true;

    const handleWakeCheck = () => {
      if (this.activeOwners.size > 0) {
        this.ensureRunning();
      }
    };

    document.addEventListener('visibilitychange', handleWakeCheck);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWakeCheck);
    }
  }

  private ensureRunning() {
    if (typeof window === 'undefined') return;
    this.clearReleaseTimer();
    this.attachVisibilityListener();

    // 1. Continuous looping silent <audio> bridge (critical for mobile screen-off AudioFocus)
    try {
      const el = this.ensureKeepAliveAudioElement();
      if (el && el.paused) {
        const playPromise = el.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              this.isAudioUnlocked = true;
              if (this.activeOwners.size === 0 && !el.paused) {
                el.pause();
              }
            })
            .catch(() => {
              // Autoplay blocked before gesture; will unlock on acquire()
            });
        } else {
          this.isAudioUnlocked = true;
        }
      }
    } catch {
      // Ignore HTMLAudio restrictions
    }

    // 2. Web Audio API silent mixer loop
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

  /**
   * Call during a user gesture (tap/click) to pre-unlock the silent keep-alive
   * HTMLAudioElement before any playback starts.
   */
  primeOnGesture() {
    if (this.isAudioUnlocked) return;
    const el = this.ensureKeepAliveAudioElement();
    if (!el || this.activeOwners.size > 0) return;
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          this.isAudioUnlocked = true;
          if (this.activeOwners.size === 0) {
            el.pause();
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  acquire(owner: 'quran' | 'speech') {
    this.clearReleaseTimer();
    this.activeOwners.add(owner);
    this.ensureRunning();
  }

  pulse() {
    if (this.activeOwners.size > 0) {
      this.clearReleaseTimer();
      this.ensureRunning();
    }
  }

  release(owner: 'quran' | 'speech') {
    this.activeOwners.delete(owner);
    if (this.activeOwners.size > 0) return;

    this.clearReleaseTimer();
    if (typeof window !== 'undefined') {
      this.releaseTimer = window.setTimeout(() => {
        this.releaseTimer = null;
        if (this.activeOwners.size === 0) {
          if (this.keepAliveAudio && !this.keepAliveAudio.paused) {
            this.keepAliveAudio.pause();
          }
          if (this.ctx && this.ctx.state === 'running') {
            void this.ctx.suspend().catch(() => {});
          }
        }
      }, 280);
    } else {
      if (this.keepAliveAudio && !this.keepAliveAudio.paused) {
        this.keepAliveAudio.pause();
      }
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
    }
  }
}

export const audioKeepAlive = new BackgroundAudioKeepAlive();
