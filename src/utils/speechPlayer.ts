import { useEffect, useState } from 'react';
import { audioKeepAlive } from './audioKeepAlive';
import { expandBanglaIslamicHonorifics } from './banglaHonorifics';
import {
  clearMediaSession,
  registerMediaSessionHandlers,
  setMediaSessionMetadata,
  setMediaSessionPlaybackState,
} from './mediaSessionHelper';

export type SpeechLangCode = 'bn-BD' | 'ar-SA' | 'en-US';

export interface SpeechSegment {
  text: string;
  lang: SpeechLangCode;
}

export interface SpeechTrack {
  id: string;
  titleBn: string;
  subtitleBn: string;
  segments: SpeechSegment[];
}

export type SpeechStatus = 'idle' | 'playing' | 'paused';

export type VoiceProfileId = 'neural-natural' | 'neural-deep';

export type ArabicVoiceMode = 'online-deep' | 'neural-arabic-deep' | 'skip';

export interface VoiceProfileMeta {
  id: VoiceProfileId;
  labelBn: string;
  shortLabelBn: string;
  descBn: string;
  engine: 'neural';
}

export interface ArabicVoiceModeMeta {
  id: ArabicVoiceMode;
  labelBn: string;
  shortLabelBn: string;
  descBn: string;
  engine: 'neural' | 'skip';
}

export const VOICE_PROFILES: VoiceProfileMeta[] = [
  {
    id: 'neural-natural',
    labelBn: 'ভাস্কর ও অ্যান্ড্রু — স্পষ্ট ইসলামী ছেলে কণ্ঠ',
    shortLabelBn: 'স্পষ্ট ছেলে কণ্ঠ',
    descBn: 'অত্যন্ত পরিষ্কার, ধীর ও গম্ভীর কণ্ঠে হাদিস ও সীরাত পাঠ (অফলাইনেও ক্যাশ থাকে)',
    engine: 'neural',
  },
  {
    id: 'neural-deep',
    labelBn: 'প্রদীপ ও ব্রায়ান — বাংলাদেশি ছেলে কণ্ঠ',
    shortLabelBn: 'বাংলাদেশি ছেলে',
    descBn: 'বাংলাদেশি উচ্চারণে শান্ত ও গম্ভীর পুরুষ কণ্ঠ (বাংলা ও ইংরেজি)',
    engine: 'neural',
  },
];

export const ARABIC_VOICE_MODES: ArabicVoiceModeMeta[] = [
  {
    id: 'online-deep',
    labelBn: 'আরবি ছেলে কণ্ঠ — হামেদ (সৌদি আরব)',
    shortLabelBn: 'ছেলে আরবি',
    descBn: 'স্পষ্ট ও শুদ্ধ সৌদি পুরুষ কণ্ঠ (মেয়ে কণ্ঠ আসার কোনো সুযোগ নেই)',
    engine: 'neural',
  },
  {
    id: 'neural-arabic-deep',
    labelBn: 'গম্ভীর আরবি ছেলে কণ্ঠ — শাকির (মিশর)',
    shortLabelBn: 'গম্ভীর আরবি',
    descBn: 'গভীর ও গম্ভীর মিশরীয় পুরুষ কণ্ঠ',
    engine: 'neural',
  },
  {
    id: 'skip',
    labelBn: 'আরবি পঠন বন্ধ (শুধু বাংলা/ইংরেজি)',
    shortLabelBn: 'আরবি বন্ধ',
    descBn: 'হাদিস ও দুআর আরবি অংশ বাদ দিয়ে কেবল বাংলা/ইংরেজি পড়া হবে',
    engine: 'skip',
  },
];

export interface SpeechVoicePrefs {
  profile: VoiceProfileId;
  customVoiceUri: string;
  customEnglishVoiceUri: string;
  arabicMode: ArabicVoiceMode;
  customArabicVoiceUri: string;
  rate: number;
  pitch: number;
  expandHonorifics: boolean;
}

const DEFAULT_VOICE_PREFS: SpeechVoicePrefs = {
  profile: 'neural-natural',
  customVoiceUri: '',
  customEnglishVoiceUri: '',
  arabicMode: 'online-deep',
  customArabicVoiceUri: '',
  rate: 1.0,
  pitch: 1.0,
  expandHonorifics: true,
};

const VOICE_PREFS_STORAGE_KEY = 'noor_speech_voice_prefs_v4';
const MALE_TTS_CACHE_NAME = 'noor-male-tts-cache-v2';

function loadVoicePrefs(): SpeechVoicePrefs {
  try {
    const v4Raw = localStorage.getItem(VOICE_PREFS_STORAGE_KEY);
    if (v4Raw) {
      const parsed = JSON.parse(v4Raw) as Partial<SpeechVoicePrefs>;
      const validProfile = VOICE_PROFILES.some((p) => p.id === parsed.profile)
        ? (parsed.profile as VoiceProfileId)
        : DEFAULT_VOICE_PREFS.profile;
      const validArabic = ARABIC_VOICE_MODES.some((a) => a.id === parsed.arabicMode)
        ? (parsed.arabicMode as ArabicVoiceMode)
        : DEFAULT_VOICE_PREFS.arabicMode;
      return {
        profile: validProfile,
        customVoiceUri:
          typeof parsed.customVoiceUri === 'string' ? parsed.customVoiceUri : '',
        customEnglishVoiceUri:
          typeof parsed.customEnglishVoiceUri === 'string'
            ? parsed.customEnglishVoiceUri
            : '',
        arabicMode: validArabic,
        customArabicVoiceUri:
          typeof parsed.customArabicVoiceUri === 'string'
            ? parsed.customArabicVoiceUri
            : '',
        rate:
          typeof parsed.rate === 'number' && parsed.rate >= 0.7 && parsed.rate <= 1.35
            ? parsed.rate
            : 1.0,
        pitch:
          typeof parsed.pitch === 'number' && parsed.pitch >= 0.65 && parsed.pitch <= 1.35
            ? parsed.pitch
            : 1.0,
        expandHonorifics: parsed.expandHonorifics !== false,
      };
    }

    // Upgrade older prefs so users immediately switch away from female browser/Google defaults
    const legacyRaw =
      localStorage.getItem('noor_speech_voice_prefs_v3') ||
      localStorage.getItem('noor_speech_voice_prefs_v2') ||
      localStorage.getItem('noor_speech_voice_prefs_v1');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<SpeechVoicePrefs>;
      const migrated: SpeechVoicePrefs = {
        profile: 'neural-natural',
        customVoiceUri:
          typeof legacy.customVoiceUri === 'string' ? legacy.customVoiceUri : '',
        customEnglishVoiceUri:
          typeof legacy.customEnglishVoiceUri === 'string'
            ? legacy.customEnglishVoiceUri
            : '',
        arabicMode: legacy.arabicMode === 'skip' ? 'skip' : 'online-deep',
        customArabicVoiceUri:
          typeof legacy.customArabicVoiceUri === 'string'
            ? legacy.customArabicVoiceUri
            : '',
        rate:
          typeof legacy.rate === 'number' && legacy.rate >= 0.7 && legacy.rate <= 1.35
            ? legacy.rate
            : 1.0,
        pitch:
          typeof legacy.pitch === 'number' && parsedPitchOk(legacy.pitch)
            ? legacy.pitch!
            : 1.0,
        expandHonorifics: true,
      };
      localStorage.setItem(VOICE_PREFS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return DEFAULT_VOICE_PREFS;
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

function parsedPitchOk(pitch: unknown): pitch is number {
  return typeof pitch === 'number' && pitch >= 0.65 && pitch <= 1.35;
}

export interface SpeechPlayerSnapshot {
  status: SpeechStatus;
  isBuffering: boolean;
  tracks: SpeechTrack[];
  currentIndex: number;
  currentTrack: SpeechTrack | null;
  isSupported: boolean;
  noticeBn: string | null;
  voicePrefs: SpeechVoicePrefs;
  deviceVoicesCount: number;
}

interface FlatChunk {
  trackIndex: number;
  text: string;
  lang: SpeechLangCode;
}

function normalizeTextForSpeech(
  rawText: string,
  lang: SpeechLangCode,
  expandHonorifics = true
): string {
  if (lang === 'bn-BD') {
    return expandBanglaIslamicHonorifics(rawText, expandHonorifics);
  }
  if (lang === 'en-US' && expandHonorifics) {
    return rawText
      .replace(/ﷺ/g, ' peace and blessings be upon him ')
      .replace(/\(\s*pbuh\s*\)/gi, ' peace and blessings be upon him ')
      .replace(/\(\s*saws\s*\)/gi, ' sallallahu alayhi wa sallam ')
      .replace(/\(\s*ra\s*\)/gi, ' may Allah be pleased with him ')
      .replace(/\(\s*as\s*\)/gi, ' peace be upon him ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return rawText.replace(/\s+/g, ' ').trim();
}

function splitIntoSpeakableChunks(rawText: string, maxLen = 140): string[] {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = (cleaned.match(/[^।.?!؟\n]+[।.?!؟\n]*/g) || [cleaned])
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      const words = sentence.split(' ');
      let sub = '';
      for (const word of words) {
        if ((sub + ' ' + word).trim().length > maxLen) {
          if (sub) chunks.push(sub.trim());
          sub = word;
        } else {
          sub = (sub + ' ' + word).trim();
        }
      }
      if (sub) chunks.push(sub.trim());
    } else if ((buffer + ' ' + sentence).trim().length > maxLen) {
      if (buffer) chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = (buffer + ' ' + sentence).trim();
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

const FEMALE_ARABIC_VOICE_RE =
  /hoda|salma|laila|layla|mariam|zariyah|zeina|fatima|hala|rana|amira|noura|lina|google العربية|\bfemale\b|\bwoman\b|-x-(arz|sfb|ana)(?:-|$|\b)/i;
const MALE_VOICE_RE =
  /\bmale\b|\bman\b|pradeep|bashkar|tanvir|madhur|maged|tarik|naayf|hamed|shakir|bassel|hamdan|jamal|omar|david|mark|george|daniel|alex|aaron|guy|ryan|andrew|brian|christopher|eric|arthur|oliver|rishi|ravi|hemant|-x-(arc|ard|are|arm|bnm|bnb|iol|iom|tpd|rjs|gbd|aud|aub|ene|end)(?:-|$|\b)/i;
const FEMALE_GENERAL_VOICE_RE =
  /\bfemale\b|\bwoman\b|tanisha|nabanita|kalpana|heera|neerja|hoda|salma|laila|layla|samantha|victoria|karen|moira|tessa|fiona|zira|hazel|susan|catherine|aria|jenny|emma|ava|sonia|libby|google us english|google বাংলা|google हिन्दी|google uk english female|-x-(arz|ana|sfb|bnf|bna|ban|sfg|tpf|tpc|gba|gbc|iog|ena|enc)(?:-|$|\b)/i;

interface MatchedVoiceResult {
  voice: SpeechSynthesisVoice | null;
  isExplicitMale: boolean;
}

export function pickBestArabicDeviceVoice(
  voices: SpeechSynthesisVoice[],
  _prefs: SpeechVoicePrefs
): MatchedVoiceResult {
  const arVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ar'));
  if (!arVoices.length) return { voice: null, isExplicitMale: false };

  const nonFemale = arVoices.filter(
    (v) => !FEMALE_ARABIC_VOICE_RE.test(`${v.name} ${v.voiceURI}`)
  );
  const pool = nonFemale.length > 0 ? nonFemale : arVoices;

  const male = pool.find((v) => MALE_VOICE_RE.test(`${v.name} ${v.voiceURI}`));
  if (male) return { voice: male, isExplicitMale: true };

  const exactSa =
    pool.find((v) => v.lang.toLowerCase() === 'ar-sa' && v.localService) ||
    pool.find((v) => v.lang.toLowerCase() === 'ar-sa') ||
    pool.find((v) => v.localService);
  return { voice: exactSa || pool[0] || null, isExplicitMale: false };
}

export function pickBestGeneralDeviceVoice(
  voices: SpeechSynthesisVoice[],
  lang: SpeechLangCode,
  _prefs: SpeechVoicePrefs
): MatchedVoiceResult {
  if (!voices.length) return { voice: null, isExplicitMale: false };

  const prefix = lang.slice(0, 2).toLowerCase();

  const langMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  // Never assign a foreign-language female voice when target language isn't listed
  if (langMatches.length === 0) {
    return { voice: null, isExplicitMale: false };
  }

  const nonFemale = langMatches.filter(
    (v) => !FEMALE_GENERAL_VOICE_RE.test(`${v.name} ${v.voiceURI}`)
  );
  const maleSearchPool = nonFemale.length > 0 ? nonFemale : langMatches;

  const maleCandidate =
    maleSearchPool.find(
      (v) =>
        v.lang.toLowerCase() === lang.toLowerCase() &&
        MALE_VOICE_RE.test(`${v.name} ${v.voiceURI}`)
    ) || maleSearchPool.find((v) => MALE_VOICE_RE.test(`${v.name} ${v.voiceURI}`));

  if (maleCandidate) {
    return { voice: maleCandidate, isExplicitMale: true };
  }

  const bestNonFemale =
    maleSearchPool.find(
      (v) => v.lang.toLowerCase() === lang.toLowerCase() && v.localService
    ) ||
    maleSearchPool.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    maleSearchPool.find((v) => v.localService) ||
    maleSearchPool[0];

  return { voice: bestNonFemale || null, isExplicitMale: false };
}

function resolveNeuralVoiceName(
  lang: SpeechLangCode,
  prefs: SpeechVoicePrefs
): string {
  if (lang === 'ar-SA') {
    return prefs.arabicMode === 'neural-arabic-deep'
      ? 'ar-EG-ShakirNeural'
      : 'ar-SA-HamedNeural';
  }
  if (lang === 'en-US') {
    return prefs.profile === 'neural-deep'
      ? 'en-US-BrianNeural'
      : 'en-US-AndrewNeural';
  }
  return prefs.profile === 'neural-deep'
    ? 'bn-BD-PradeepNeural'
    : 'bn-IN-BashkarNeural';
}

function buildMaleTtsApiUrl(
  chunk: FlatChunk,
  prefs: SpeechVoicePrefs
): string {
  const voice = resolveNeuralVoiceName(chunk.lang, prefs);
  const params = new URLSearchParams({
    text: chunk.text,
    lang: chunk.lang,
    voice,
    rate: prefs.rate.toFixed(2),
    pitch: prefs.pitch.toFixed(2),
    expand: prefs.expandHonorifics ? '1' : '0',
    q: '96k',
  });
  return `/api/tts?${params.toString()}`;
}

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class SpeechNarrationManager {
  private listeners = new Set<() => void>();
  private beforeStartHooks = new Set<() => void>();
  private tracks: SpeechTrack[] = [];
  private flatChunks: FlatChunk[] = [];
  private chunkCursor = 0;
  private currentTrackIndex = 0;
  private status: SpeechStatus = 'idle';
  private isBuffering = false;
  private noticeBn: string | null = null;
  private sessionToken = 0;
  private neuralPlayAttemptId = 0;
  private voicePrefs: SpeechVoicePrefs = loadVoicePrefs();
  private neuralAudio: HTMLAudioElement | null = null;
  private isNeuralUnlocked = false;
  private unlockPromise: Promise<void> | null = null;
  private activeObjectUrl: string | null = null;
  private speechBlobUrlCache = new Map<string, string>();
  private prefetchedChunks = new Map<number, { objUrl: string; token: number }>();
  private prefetchingCursors = new Set<number>();
  private neuralPrefetchQueue: Array<{ cursor: number; url: string; token: number }> = [];
  private activeNeuralPrefetchCount = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private deviceVoicesCount = 0;
  private userPausedAt = 0;
  private lastHiddenAt = 0;
  private screenOffRecoveryCount = 0;
  private consecutiveNeuralFailures = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.deviceVoicesCount = window.speechSynthesis.getVoices().length;
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.deviceVoicesCount = window.speechSynthesis.getVoices().length;
        this.emit();
      });
    }
    if (typeof document !== 'undefined') {
      const unlockOnFirstGesture = () => {
        audioKeepAlive.primeOnGesture();
        if (this.isNeuralUnlocked) {
          detach();
          return;
        }
        if (this.status === 'idle') {
          void this.primeNeuralAudioOnGesture().then(() => {
            if (this.isNeuralUnlocked) detach();
          });
        }
      };
      const detach = () => {
        document.removeEventListener('pointerdown', unlockOnFirstGesture, true);
        document.removeEventListener('touchstart', unlockOnFirstGesture, true);
        document.removeEventListener('keydown', unlockOnFirstGesture, true);
      };
      document.addEventListener('pointerdown', unlockOnFirstGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener('touchstart', unlockOnFirstGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener('keydown', unlockOnFirstGesture, {
        capture: true,
        passive: true,
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.status === 'playing') {
          this.lastHiddenAt = Date.now();
          audioKeepAlive.pulse();
          this.syncMediaSession();
          const snapToken = this.sessionToken;
          for (const delay of [160, 550]) {
            window.setTimeout(() => {
              if (
                snapToken !== this.sessionToken ||
                this.status !== 'playing' ||
                Date.now() - this.userPausedAt < 1500
              ) {
                return;
              }
              const audio = this.neuralAudio;
              if (audio && audio.paused && !audio.ended && audio.src) {
                audioKeepAlive.pulse();
                void audio.play().catch(() => {});
              }
            }, delay);
          }
        }
      });
    }
  }

  private ensureNeuralAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.neuralAudio) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      this.neuralAudio = audio;
    }
    return this.neuralAudio;
  }

  private primeNeuralAudioOnGesture(): Promise<void> {
    if (this.isNeuralUnlocked) return Promise.resolve();
    if (this.unlockPromise) return this.unlockPromise;
    const audio = this.ensureNeuralAudio();
    if (!audio) return Promise.resolve();

    try {
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.src = SILENT_WAV_DATA_URI;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        const pending = p
          .then(() => {
            this.isNeuralUnlocked = true;
          })
          .catch(() => {
            // Silent unlock rejection handled gracefully by fallback
          })
          .finally(() => {
            if (this.unlockPromise === pending) {
              this.unlockPromise = null;
            }
          });
        this.unlockPromise = pending;
        return pending;
      }
      this.isNeuralUnlocked = true;
    } catch {
      // ignore
    }
    return Promise.resolve();
  }

  /**
   * Call synchronously inside click/tap handlers before any async fetch
   * so mobile browsers keep audio playback unlocked for neural voice tracks.
   */
  public primeOnUserGesture() {
    audioKeepAlive.primeOnGesture();
    void this.primeNeuralAudioOnGesture();
    audioKeepAlive.acquire('speech');
  }

  private rememberSpeechBlobUrl(key: string, objUrl: string) {
    if (this.speechBlobUrlCache.has(key)) {
      const existing = this.speechBlobUrlCache.get(key);
      if (existing && existing !== objUrl) {
        try {
          URL.revokeObjectURL(existing);
        } catch {
          // ignore
        }
      }
      this.speechBlobUrlCache.delete(key);
    }
    this.speechBlobUrlCache.set(key, objUrl);
    while (this.speechBlobUrlCache.size > 40) {
      const oldestKey = this.speechBlobUrlCache.keys().next().value;
      if (!oldestKey) break;
      const oldestUrl = this.speechBlobUrlCache.get(oldestKey);
      this.speechBlobUrlCache.delete(oldestKey);
      if (oldestUrl && oldestUrl !== this.activeObjectUrl) {
        try {
          URL.revokeObjectURL(oldestUrl);
        } catch {
          // ignore
        }
      }
    }
  }

  private getFastSpeechUrlSync(key: string): string | null {
    const hit = this.speechBlobUrlCache.get(key);
    if (!hit) return null;
    this.speechBlobUrlCache.delete(key);
    this.speechBlobUrlCache.set(key, hit);
    return hit;
  }

  private revokeActiveObjectUrl() {
    if (this.activeObjectUrl) {
      const isStillCached = Array.from(this.speechBlobUrlCache.values()).includes(
        this.activeObjectUrl
      );
      if (!isStillCached) {
        try {
          URL.revokeObjectURL(this.activeObjectUrl);
        } catch {
          // ignore
        }
      }
      this.activeObjectUrl = null;
    }
  }

  private clearPrefetchedChunks() {
    for (const entry of this.prefetchedChunks.values()) {
      const isStillCached = Array.from(this.speechBlobUrlCache.values()).includes(
        entry.objUrl
      );
      if (!isStillCached) {
        try {
          URL.revokeObjectURL(entry.objUrl);
        } catch {
          // ignore
        }
      }
    }
    this.prefetchedChunks.clear();
    this.prefetchingCursors.clear();
    this.neuralPrefetchQueue = [];
  }

  private syncMediaSession() {
    const track = this.tracks[this.currentTrackIndex];
    if (!track || this.status === 'idle') return;
    setMediaSessionMetadata({
      title: track.titleBn,
      artist: track.subtitleBn,
      album: 'Daily Islamic Routine',
    });
    setMediaSessionPlaybackState(this.status === 'playing' ? 'playing' : 'paused');
    registerMediaSessionHandlers({
      onPlay: () => this.resume(),
      onPause: () => {
        this.userPausedAt = Date.now();
        this.pause();
      },
      onPrev: this.currentTrackIndex > 0 ? () => this.prevTrack() : undefined,
      onNext:
        this.currentTrackIndex < this.tracks.length - 1
          ? () => this.nextTrack()
          : undefined,
      onStop: () => {
        this.userPausedAt = Date.now();
        this.stop();
      },
    });
  }

  private stopNeuralAudio(clearSrc = true) {
    this.neuralPlayAttemptId += 1;
    this.isBuffering = false;
    const audio = this.neuralAudio;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.onpause = null;
      audio.pause();
      if (clearSrc) {
        try {
          audio.removeAttribute('src');
          audio.load();
        } catch {
          // ignore
        }
      }
    }
    this.revokeActiveObjectUrl();
    this.clearPrefetchedChunks();
  }

  private cancelWebSpeech() {
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (this.isWebSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  isWebSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && ('Audio' in window || 'speechSynthesis' in window);
  }

  getDeviceVoices(): SpeechSynthesisVoice[] {
    if (!this.isWebSpeechSupported()) return [];
    const voices = window.speechSynthesis.getVoices();
    const score = (v: SpeechSynthesisVoice) => {
      const l = v.lang.toLowerCase();
      if (l.startsWith('bn')) return 0;
      if (l.startsWith('ar')) return 1;
      if (l.startsWith('en')) return 2;
      return 3;
    };
    return [...voices].sort((a, b) => score(a) - score(b));
  }

  getArabicVoices(): SpeechSynthesisVoice[] {
    if (!this.isWebSpeechSupported()) return [];
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('ar'));
  }

  getBanglaVoices(): SpeechSynthesisVoice[] {
    if (!this.isWebSpeechSupported()) return [];
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('bn'));
  }

  getEnglishVoices(): SpeechSynthesisVoice[] {
    if (!this.isWebSpeechSupported()) return [];
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('en'));
  }

  getBanglaAndOtherVoices(): SpeechSynthesisVoice[] {
    if (!this.isWebSpeechSupported()) return [];
    return this.getDeviceVoices().filter(
      (v) => !v.lang.toLowerCase().startsWith('ar')
    );
  }

  getActiveMatchedVoices(): {
    arabic: MatchedVoiceResult;
    bangla: MatchedVoiceResult;
    english: MatchedVoiceResult;
  } {
    const voices = this.getDeviceVoices();
    return {
      arabic: pickBestArabicDeviceVoice(voices, this.voicePrefs),
      bangla: pickBestGeneralDeviceVoice(voices, 'bn-BD', this.voicePrefs),
      english: pickBestGeneralDeviceVoice(voices, 'en-US', this.voicePrefs),
    };
  }

  getActiveMaleVoiceLabels(): {
    arabic: string;
    bangla: string;
    english: string;
  } {
    const matched = this.getActiveMatchedVoices();

    const arabic =
      this.voicePrefs.arabicMode === 'skip'
        ? 'বন্ধ'
        : this.voicePrefs.arabicMode === 'online-deep'
        ? 'হামেদ (ছেলে · সৌদি আরব)'
        : this.voicePrefs.arabicMode === 'neural-arabic-deep'
        ? 'শাকির (গম্ভীর ছেলে · মিশর)'
        : matched.arabic.voice?.name || 'ফোন আরবি TTS';

    const bangla =
      this.voicePrefs.profile === 'neural-natural'
        ? 'ভাস্কর (স্পষ্ট ইসলামী কণ্ঠ)'
        : this.voicePrefs.profile === 'neural-deep'
        ? 'প্রদীপ (বাংলাদেশি ছেলে কণ্ঠ)'
        : matched.bangla.voice?.name || 'ফোন বাংলা TTS';

    const english =
      this.voicePrefs.profile === 'neural-natural'
        ? 'অ্যান্ড্রু (ছেলে · ইংরেজি)'
        : this.voicePrefs.profile === 'neural-deep'
        ? 'ব্রায়ান (গম্ভীর ছেলে)'
        : matched.english.voice?.name || 'ফোন ইংরেজি TTS';

    return { arabic, bangla, english };
  }

  getVoicePrefs(): SpeechVoicePrefs {
    return this.voicePrefs;
  }

  updateVoicePrefs(patch: Partial<SpeechVoicePrefs>) {
    const next: SpeechVoicePrefs = {
      ...this.voicePrefs,
      ...patch,
    };
    this.voicePrefs = next;
    try {
      localStorage.setItem(VOICE_PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    this.emit();

    if (this.status === 'playing' && this.flatChunks.length > 0) {
      if (patch.expandHonorifics !== undefined && this.tracks.length > 0) {
        this.playQueue(this.tracks, this.currentTrackIndex);
        return;
      }
      this.sessionToken += 1;
      this.stopNeuralAudio(false);
      this.cancelWebSpeech();
      this.speakCurrentChunk(this.sessionToken);
    }
  }

  previewBanglaVoice(overridePrefs?: Partial<SpeechVoicePrefs>) {
    if (overridePrefs) {
      this.updateVoicePrefs(overridePrefs);
    }
    this.playQueue(
      [
        {
          id: 'voice-preview-bn',
          titleBn: 'বাংলা ছেলে কণ্ঠ নমুনা',
          subtitleBn:
            VOICE_PROFILES.find((p) => p.id === this.voicePrefs.profile)?.labelBn ||
            'নির্বাচিত বাংলা কণ্ঠ',
          segments: [
            {
              text: 'আসসালামু আলাইকুম। রাসূলুল্লাহ সা. বলেছেন, আল্লাহর যিকিরেই অন্তরসমূহ প্রশান্তি লাভ করে।',
              lang: 'bn-BD',
            },
          ],
        },
      ],
      0
    );
  }

  previewHonorificExpansion() {
    this.playQueue(
      [
        {
          id: 'voice-preview-honorifics',
          titleBn: 'সা., রা., আ., রহ. পূর্ণ উচ্চারণ নমুনা',
          subtitleBn:
            VOICE_PROFILES.find((p) => p.id === this.voicePrefs.profile)?.labelBn ||
            'স্পষ্ট ইসলামী পুরুষ কণ্ঠ',
          segments: [
            {
              text: 'হযরত আবূ হুরায়রা রা. এবং আয়িশা রা. থেকে বর্ণিত, নবী মুহাম্মাদ সা. এবং মূসা আ. ও ইমাম বুখারী রহ. সম্পর্কে বিশুদ্ধ বর্ণনা এসেছে।',
              lang: 'bn-BD',
            },
          ],
        },
      ],
      0
    );
  }

  previewEnglishVoice(overridePrefs?: Partial<SpeechVoicePrefs>) {
    if (overridePrefs) {
      this.updateVoicePrefs(overridePrefs);
    }
    this.playQueue(
      [
        {
          id: 'voice-preview-en',
          titleBn: 'ইংরেজি ছেলে কণ্ঠ নমুনা',
          subtitleBn:
            VOICE_PROFILES.find((p) => p.id === this.voicePrefs.profile)?.labelBn ||
            'নির্বাচিত ইংরেজি কণ্ঠ',
          segments: [
            {
              text: 'Assalamu Alaikum. Verily, in the remembrance of Allah do hearts find rest.',
              lang: 'en-US',
            },
          ],
        },
      ],
      0
    );
  }

  previewArabicVoice(overridePrefs?: Partial<SpeechVoicePrefs>) {
    if (overridePrefs) {
      this.updateVoicePrefs(overridePrefs);
    }
    if (this.voicePrefs.arabicMode === 'skip') {
      this.noticeBn =
        'আরবি পঠন বর্তমানে বন্ধ রাখা আছে; তাই কেবল বাংলা পঠন চালু থাকবে। আরবি শুনতে অন্য একটি আরবি ভয়েস মোড বেছে নিন।';
      this.emit();
      return;
    }
    this.playQueue(
      [
        {
          id: 'voice-preview-ar',
          titleBn: 'আরবি ছেলে কণ্ঠ নমুনা',
          subtitleBn:
            ARABIC_VOICE_MODES.find((a) => a.id === this.voicePrefs.arabicMode)?.labelBn ||
            'নির্বাচিত আরবি কণ্ঠ',
          segments: [
            {
              text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ، الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
              lang: 'ar-SA',
            },
          ],
        },
      ],
      0
    );
  }

  previewVoice(overridePrefs?: Partial<SpeechVoicePrefs>) {
    this.previewBanglaVoice(overridePrefs);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onBeforeStart(cb: () => void): () => void {
    this.beforeStartHooks.add(cb);
    return () => this.beforeStartHooks.delete(cb);
  }

  getSnapshot(): SpeechPlayerSnapshot {
    return {
      status: this.status,
      isBuffering: this.isBuffering,
      tracks: this.tracks,
      currentIndex: this.currentTrackIndex,
      currentTrack: this.tracks[this.currentTrackIndex] || null,
      isSupported: this.isSupported(),
      noticeBn: this.noticeBn,
      voicePrefs: this.voicePrefs,
      deviceVoicesCount: this.deviceVoicesCount,
    };
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  playQueue(tracks: SpeechTrack[], startIndex = 0) {
    if (!this.isSupported()) {
      this.noticeBn = 'এই ব্রাউজারে অডিও পঠন সুবিধা সাপোর্ট করছে না।';
      this.emit();
      return;
    }

    const validTracks = tracks.filter((t) =>
      t.segments.some((s) => s.text.trim().length > 0)
    );
    if (validTracks.length === 0) return;

    for (const hook of this.beforeStartHooks) hook();

    this.sessionToken += 1;
    const token = this.sessionToken;
    this.stopNeuralAudio(false);
    this.cancelWebSpeech();
    audioKeepAlive.acquire('speech');

    this.tracks = validTracks;
    this.currentTrackIndex = Math.max(0, Math.min(startIndex, validTracks.length - 1));
    this.flatChunks = [];

    validTracks.forEach((track, idx) => {
      if (idx < this.currentTrackIndex) return;
      for (const seg of track.segments) {
        const normalized = normalizeTextForSpeech(
          seg.text,
          seg.lang,
          this.voicePrefs.expandHonorifics
        );
        const pieces = splitIntoSpeakableChunks(normalized, 140);
        for (const piece of pieces) {
          this.flatChunks.push({
            trackIndex: idx,
            text: piece,
            lang: seg.lang,
          });
        }
      }
    });

    if (this.flatChunks.length === 0) return;

    this.chunkCursor = 0;
    this.status = 'playing';
    this.noticeBn = null;
    this.consecutiveNeuralFailures = 0;
    this.screenOffRecoveryCount = 0;
    const firstPlayable = this.flatChunks.find(
      (c) =>
        !(c.lang === 'ar-SA' && this.voicePrefs.arabicMode === 'skip') &&
        /[\p{L}\p{N}]/u.test(c.text)
    );
    this.isBuffering = Boolean(firstPlayable && this.shouldUseNeuralServerForChunk(firstPlayable));

    // Start prefetching upcoming chunks right away so screen lock transitions never wait on network
    this.prefetchUpcomingNeuralChunks(token, 16);

    if (this.isNeuralUnlocked) {
      this.emit();
      this.speakCurrentChunk(token);
      return;
    }

    // Unlock <audio> synchronously with an in-memory silent WAV before loading remote TTS so async POST/blob fallbacks never hit NotAllowedError on mobile/iframe
    const unlockP = this.primeNeuralAudioOnGesture();
    this.emit();
    void Promise.race([
      unlockP,
      new Promise<void>((resolve) => setTimeout(resolve, 90)),
    ]).then(() => {
      if (token === this.sessionToken && this.status === 'playing') {
        this.speakCurrentChunk(token);
      }
    });
  }

  private shouldUseNeuralServerForChunk(chunk: FlatChunk): boolean {
    if (chunk.lang === 'ar-SA') {
      return (
        this.voicePrefs.arabicMode === 'online-deep' ||
        this.voicePrefs.arabicMode === 'neural-arabic-deep'
      );
    }
    return (
      this.voicePrefs.profile === 'neural-natural' ||
      this.voicePrefs.profile === 'neural-deep'
    );
  }

  private isValidAudioCacheResponse(res: Response | undefined | null): res is Response {
    if (!res || !res.ok || res.type === 'opaque') return false;
    if (res.url && res.url.includes('__cookie_check')) return false;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    return (
      ctype.includes('audio') ||
      ctype.includes('mpeg') ||
      ctype.includes('mp3') ||
      ctype.includes('octet-stream')
    );
  }

  private async readCachedMaleTtsBlob(url: string): Promise<Blob | null> {
    try {
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(MALE_TTS_CACHE_NAME);
        const direct = await cache.match(url);
        if (direct) {
          if (this.isValidAudioCacheResponse(direct)) {
            const blob = await direct.blob();
            if (blob.size > 0) return blob;
          } else {
            await cache.delete(url).catch(() => {});
          }
        }
        const anyCached = await caches.match(url);
        if (this.isValidAudioCacheResponse(anyCached)) {
          const blob = await anyCached.blob();
          if (blob.size > 0) return blob;
        }
      }
    } catch {
      // Cache API unavailable
    }
    return null;
  }

  private async fetchAndCacheMaleTtsBlob(
    url: string,
    signal?: AbortSignal,
    cacheOnly = false,
    chunkMeta?: { text: string; lang: SpeechLangCode }
  ): Promise<Blob | null> {
    const cachedBlob = await this.readCachedMaleTtsBlob(url);
    if (cachedBlob) return cachedBlob;

    if (
      cacheOnly ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      return null;
    }

    let response: Response | null = null;
    const timeoutController =
      !signal && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutTimer =
      timeoutController && typeof setTimeout !== 'undefined'
        ? setTimeout(() => timeoutController.abort(), 12000)
        : null;
    const effectiveSignal = signal || timeoutController?.signal;

    try {
      if (url.length <= 1900) {
        try {
          const res = await fetch(url, {
            signal: effectiveSignal,
            credentials: 'same-origin',
          });
          if (this.isValidAudioCacheResponse(res)) {
            response = res;
          }
        } catch {
          // fall through to POST /api/tts fallback
        }
      }

      if (!response && chunkMeta) {
        try {
          const voice = resolveNeuralVoiceName(chunkMeta.lang, this.voicePrefs);
          const postRes = await fetch('/api/tts', {
            method: 'POST',
            signal: effectiveSignal,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunkMeta.text,
              lang: chunkMeta.lang,
              voice,
              rate: this.voicePrefs.rate.toFixed(2),
              pitch: this.voicePrefs.pitch.toFixed(2),
              expandHonorifics: this.voicePrefs.expandHonorifics,
            }),
          });
          if (this.isValidAudioCacheResponse(postRes)) {
            response = postRes;
          }
        } catch {
          // ignore
        }
      }
    } finally {
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
      }
    }

    if (!response) return null;

    try {
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(MALE_TTS_CACHE_NAME);
        await cache.put(url, response.clone());
      }
    } catch {
      // Ignore quota/cache errors
    }

    return await response.blob();
  }

  private storePrefetchedBlob(
    cursor: number,
    token: number,
    blob: Blob | null,
    urlKey?: string
  ) {
    if (!blob || blob.size === 0 || token !== this.sessionToken) return;
    const objUrl = URL.createObjectURL(blob);
    if (urlKey) {
      this.rememberSpeechBlobUrl(urlKey, objUrl);
    }
    const prev = this.prefetchedChunks.get(cursor);
    if (prev && prev.objUrl !== objUrl) {
      const stillCached = Array.from(this.speechBlobUrlCache.values()).includes(prev.objUrl);
      if (!stillCached) {
        try {
          URL.revokeObjectURL(prev.objUrl);
        } catch {
          // ignore
        }
      }
    }
    this.prefetchedChunks.set(cursor, {
      objUrl,
      token,
    });
  }

  private pumpNeuralPrefetchQueue(token: number) {
    while (
      this.activeNeuralPrefetchCount < 2 &&
      this.neuralPrefetchQueue.length > 0
    ) {
      const job = this.neuralPrefetchQueue.shift();
      if (!job || job.token !== this.sessionToken) continue;
      this.activeNeuralPrefetchCount += 1;
      void this.fetchAndCacheMaleTtsBlob(job.url)
        .then((blob) => {
          this.storePrefetchedBlob(job.cursor, job.token, blob, job.url);
        })
        .catch(() => {
          // Silent prefetch failure is harmless
        })
        .finally(() => {
          this.prefetchingCursors.delete(job.cursor);
          this.activeNeuralPrefetchCount = Math.max(
            0,
            this.activeNeuralPrefetchCount - 1
          );
          if (token === this.sessionToken && this.status === 'playing') {
            this.pumpNeuralPrefetchQueue(token);
          }
        });
    }
  }

  private prefetchUpcomingNeuralChunks(token: number, count = 16) {
    // Prune already-finished prefetched chunk slots
    for (const key of this.prefetchedChunks.keys()) {
      if (key < this.chunkCursor - 1) {
        this.prefetchedChunks.delete(key);
      }
    }

    let cursor = this.chunkCursor + 1;
    let queued = 0;
    while (cursor < this.flatChunks.length && queued < count) {
      const candidate = this.flatChunks[cursor];
      if (candidate.lang === 'ar-SA' && this.voicePrefs.arabicMode === 'skip') {
        cursor += 1;
        continue;
      }
      if (!this.shouldUseNeuralServerForChunk(candidate)) {
        cursor += 1;
        continue;
      }
      queued += 1;
      const existing = this.prefetchedChunks.get(cursor);
      if (existing && existing.token === token) {
        cursor += 1;
        continue;
      }
      if (this.prefetchingCursors.has(cursor)) {
        cursor += 1;
        continue;
      }
      const targetCursor = cursor;
      this.prefetchingCursors.add(targetCursor);
      const nextUrl = buildMaleTtsApiUrl(candidate, this.voicePrefs);

      const syncBlobHit = this.getFastSpeechUrlSync(nextUrl);
      if (syncBlobHit) {
        this.prefetchedChunks.set(targetCursor, { objUrl: syncBlobHit, token });
        this.prefetchingCursors.delete(targetCursor);
        cursor += 1;
        continue;
      }

      // Immediately resolve CacheStorage hits into RAM blob: URLs without consuming network slots
      void this.readCachedMaleTtsBlob(nextUrl).then((cachedBlob) => {
        if (token !== this.sessionToken || this.status !== 'playing') {
          this.prefetchingCursors.delete(targetCursor);
          return;
        }
        if (cachedBlob) {
          this.storePrefetchedBlob(targetCursor, token, cachedBlob, nextUrl);
          this.prefetchingCursors.delete(targetCursor);
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.prefetchingCursors.delete(targetCursor);
          return;
        }
        this.neuralPrefetchQueue.push({
          cursor: targetCursor,
          url: nextUrl,
          token,
        });
        this.pumpNeuralPrefetchQueue(token);
      });

      cursor += 1;
    }
  }

  private speakCurrentChunk(token: number) {
    if (token !== this.sessionToken || !this.isSupported()) return;

    while (
      this.chunkCursor < this.flatChunks.length &&
      ((this.flatChunks[this.chunkCursor].lang === 'ar-SA' &&
        this.voicePrefs.arabicMode === 'skip') ||
        !/[\p{L}\p{N}]/u.test(this.flatChunks[this.chunkCursor].text))
    ) {
      this.chunkCursor += 1;
    }

    if (this.chunkCursor >= this.flatChunks.length) {
      this.stop();
      return;
    }

    const chunk = this.flatChunks[this.chunkCursor];
    this.currentTrackIndex = chunk.trackIndex;
    audioKeepAlive.pulse();
    this.syncMediaSession();
    this.emit();

    if (this.shouldUseNeuralServerForChunk(chunk)) {
      const audio = this.ensureNeuralAudio();
      if (audio) {
        const prefetched = this.prefetchedChunks.get(this.chunkCursor);
        if (prefetched && prefetched.token === token) {
          this.prefetchedChunks.delete(this.chunkCursor);
          this.playNeuralSourceSync(audio, chunk, prefetched.objUrl, true, token);
          return;
        }

        const directUrl = buildMaleTtsApiUrl(chunk, this.voicePrefs);
        const fastBlobUrl = this.getFastSpeechUrlSync(directUrl);
        if (fastBlobUrl) {
          this.playNeuralSourceSync(audio, chunk, fastBlobUrl, true, token);
          return;
        }

        // Synchronous <audio> transition without async fetch gap preserves screen-off MediaSession
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          if (directUrl.length <= 1900) {
            this.playNeuralSourceSync(audio, chunk, directUrl, false, token);
            return;
          }
          void this.playOfflineCachedChunk(audio, chunk, token, false);
          return;
        }

        void this.playOfflineCachedChunk(audio, chunk, token, true);
        return;
      }
    }

    this.speakViaWebSpeech(chunk, token);
  }

  private handleNeuralFailure(
    audio: HTMLAudioElement,
    chunk: FlatChunk,
    isObjectUrl: boolean,
    token: number
  ) {
    if (token !== this.sessionToken || this.status !== 'playing') return;

    if (!isObjectUrl) {
      // Direct URL failed (offline / iframe cookie / transient network): recover via CacheStorage or POST -> blob: URL
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      void this.playOfflineCachedChunk(audio, chunk, token, !isOnline);
      return;
    }

    const isHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (isHidden) {
      this.consecutiveNeuralFailures += 1;
      if (this.consecutiveNeuralFailures >= 3) {
        audioKeepAlive.release('speech');
        this.status = 'paused';
        this.isBuffering = false;
        this.noticeBn = 'ইন্টারনেট বা অডিও সংযোগ বিচ্ছিন্ন হয়েছে। আবার চালু করতে প্লে ট্যাপ করুন।';
        setMediaSessionPlaybackState('paused');
        this.emit();
        return;
      }
      // Never fall back to Web Speech while screen is locked (OS blocks speechSynthesis)
      this.chunkCursor += 1;
      this.speakCurrentChunk(token);
      return;
    }
    this.speakViaWebSpeech(chunk, token);
  }

  private playNeuralSourceSync(
    audio: HTMLAudioElement,
    chunk: FlatChunk,
    srcUrl: string,
    isObjectUrl: boolean,
    token: number
  ) {
    if (token !== this.sessionToken || this.status !== 'playing') {
      if (isObjectUrl) {
        const isCached = Array.from(this.speechBlobUrlCache.values()).includes(srcUrl);
        if (!isCached) {
          try {
            URL.revokeObjectURL(srcUrl);
          } catch {
            // ignore
          }
        }
      }
      return;
    }

    const attemptId = ++this.neuralPlayAttemptId;
    let settledFailure = false;
    let ignoreTransientPause = true;
    this.isBuffering = !isObjectUrl;
    this.emit();
    this.revokeActiveObjectUrl();
    if (isObjectUrl) {
      this.activeObjectUrl = srcUrl;
    }
    audio.src = srcUrl;
    if (audio.error) {
      try {
        audio.load();
      } catch {
        // ignore
      }
    }

    audio.onplaying = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing'
      ) {
        return;
      }
      ignoreTransientPause = false;
      this.consecutiveNeuralFailures = 0;
      this.screenOffRecoveryCount = 0;
      this.isBuffering = false;
      this.isNeuralUnlocked = true;
      this.noticeBn = null;
      this.emit();
    };

    audio.onwaiting = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing'
      ) {
        return;
      }
      this.isBuffering = true;
      this.emit();
    };

    audio.onpause = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing' ||
        ignoreTransientPause ||
        audio.ended
      ) {
        return;
      }
      const isHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (
        isHidden &&
        Date.now() - this.userPausedAt > 1500 &&
        this.screenOffRecoveryCount < 2
      ) {
        this.screenOffRecoveryCount += 1;
        audioKeepAlive.pulse();
        void audio.play().catch(() => {});
      }
    };

    audio.onended = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing'
      ) {
        return;
      }
      ignoreTransientPause = true;
      this.isBuffering = false;
      this.chunkCursor += 1;
      this.speakCurrentChunk(token);
    };

    audio.onerror = () => {
      if (attemptId !== this.neuralPlayAttemptId || settledFailure) return;
      settledFailure = true;
      this.handleNeuralFailure(audio, chunk, isObjectUrl, token);
    };

    audio
      .play()
      .then(() => {
        ignoreTransientPause = false;
        this.isNeuralUnlocked = true;
        if (
          attemptId === this.neuralPlayAttemptId &&
          token === this.sessionToken &&
          this.status === 'playing'
        ) {
          this.isBuffering = false;
          this.emit();
          this.prefetchUpcomingNeuralChunks(token, 16);
        }
      })
      .catch((err: unknown) => {
        if (attemptId !== this.neuralPlayAttemptId || settledFailure) return;
        const name = err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
        if (name === 'AbortError') return;
        settledFailure = true;
        if (name === 'NotAllowedError') {
          this.isNeuralUnlocked = false;
          this.isBuffering = false;
          audioKeepAlive.release('speech');
          this.status = 'paused';
          this.noticeBn = 'অডিও চালু করতে আবার প্লে বাটনে ট্যাপ করুন।';
          setMediaSessionPlaybackState('paused');
          this.emit();
          return;
        }
        this.handleNeuralFailure(audio, chunk, isObjectUrl, token);
      });
  }

  private async playOfflineCachedChunk(
    audio: HTMLAudioElement,
    chunk: FlatChunk,
    token: number,
    cacheOnly = true
  ) {
    if (token !== this.sessionToken) return;
    try {
      const url = buildMaleTtsApiUrl(chunk, this.voicePrefs);
      let blob = await this.fetchAndCacheMaleTtsBlob(url, undefined, cacheOnly, {
        text: chunk.text,
        lang: chunk.lang,
      });

      if (
        (!blob || blob.size === 0) &&
        !cacheOnly &&
        token === this.sessionToken &&
        this.status === 'playing' &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        if (token !== this.sessionToken || this.status !== 'playing') return;
        blob = await this.fetchAndCacheMaleTtsBlob(url, undefined, false, {
          text: chunk.text,
          lang: chunk.lang,
        });
      }

      if (token !== this.sessionToken || this.status !== 'playing') return;
      if (blob && blob.size > 0) {
        const objUrl = URL.createObjectURL(blob);
        this.rememberSpeechBlobUrl(url, objUrl);
        this.playNeuralSourceSync(audio, chunk, objUrl, true, token);
        return;
      }
    } catch {
      // fall through
    }
    if (token === this.sessionToken && this.status === 'playing') {
      const isHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (isHidden) {
        this.consecutiveNeuralFailures += 1;
        if (this.consecutiveNeuralFailures >= 3) {
          audioKeepAlive.release('speech');
          this.status = 'paused';
          this.isBuffering = false;
          this.noticeBn = 'ইন্টারনেট বা অডিও সংযোগ বিচ্ছিন্ন হয়েছে। আবার চালু করতে প্লে ট্যাপ করুন।';
          setMediaSessionPlaybackState('paused');
          this.emit();
          return;
        }
        this.chunkCursor += 1;
        this.speakCurrentChunk(token);
      } else {
        this.speakViaWebSpeech(chunk, token);
      }
    }
  }

  private speakViaWebSpeech(chunk: FlatChunk, token: number) {
    if (token !== this.sessionToken) return;
    this.isBuffering = false;
    if (!this.isWebSpeechSupported()) {
      this.noticeBn =
        'অডিও সার্ভার বা ব্রাউজার ভয়েস পাওয়া যায়নি। অনুগ্রহ করে ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।';
      this.stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    this.activeUtterance = utterance;
    utterance.lang = chunk.lang;

    const baseLangRate = chunk.lang === 'ar-SA' ? 0.88 : 0.96;
    utterance.rate = Math.max(0.7, Math.min(1.35, baseLangRate * this.voicePrefs.rate));

    const voices = window.speechSynthesis.getVoices();

    if (chunk.lang === 'ar-SA') {
      const arMatched = pickBestArabicDeviceVoice(voices, this.voicePrefs);
      if (arMatched.voice) {
        utterance.voice = arMatched.voice;
        utterance.lang = arMatched.voice.lang || chunk.lang;
      }
      const multiplier = arMatched.isExplicitMale ? 0.9 : 0.72;
      utterance.pitch = Math.max(0.55, Math.min(0.92, this.voicePrefs.pitch * multiplier));
    } else {
      const matched = pickBestGeneralDeviceVoice(voices, chunk.lang, this.voicePrefs);
      if (matched.voice) {
        utterance.voice = matched.voice;
        utterance.lang = matched.voice.lang || chunk.lang;
      }
      const multiplier = matched.isExplicitMale ? 0.92 : 0.72;
      utterance.pitch = Math.max(0.55, Math.min(0.92, this.voicePrefs.pitch * multiplier));
    }

    utterance.onend = () => {
      if (this.activeUtterance === utterance) {
        this.activeUtterance = null;
      }
      if (token !== this.sessionToken) return;
      if (this.status !== 'playing') return;
      this.chunkCursor += 1;
      this.speakCurrentChunk(token);
    };

    utterance.onerror = (ev) => {
      if (this.activeUtterance === utterance) {
        this.activeUtterance = null;
      }
      if (token !== this.sessionToken) return;
      if (ev.error === 'interrupted' || ev.error === 'canceled') return;
      if (ev.error === 'not-allowed') {
        this.noticeBn = 'অডিও চালু করতে আবার প্লে বাটনে ট্যাপ করুন।';
        this.stop();
        return;
      }
      this.chunkCursor += 1;
      if (this.chunkCursor < this.flatChunks.length) {
        this.speakCurrentChunk(token);
      } else {
        this.noticeBn =
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'অফলাইনে এই অংশের অডিও এখনো সেভ করা হয়নি অথবা ফোনের TTS সেটিংসে বাংলা/আরবি ডাটা নেই।'
            : 'ভয়েস অডিও চালু করা যায়নি। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।';
        this.stop();
      }
    };

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
  }

  pause() {
    if (!this.isSupported() || this.status !== 'playing') return;
    this.userPausedAt = Date.now();
    this.sessionToken += 1;
    this.stopNeuralAudio();
    this.cancelWebSpeech();
    audioKeepAlive.release('speech');
    this.status = 'paused';
    this.isBuffering = false;
    setMediaSessionPlaybackState('paused');
    this.emit();
  }

  resume() {
    if (!this.isSupported() || this.status !== 'paused') return;
    for (const hook of this.beforeStartHooks) hook();
    audioKeepAlive.acquire('speech');
    this.sessionToken += 1;
    const token = this.sessionToken;
    this.status = 'playing';
    this.noticeBn = null;
    this.consecutiveNeuralFailures = 0;
    this.screenOffRecoveryCount = 0;
    const nextChunk = this.flatChunks[this.chunkCursor];
    this.isBuffering = Boolean(nextChunk && this.shouldUseNeuralServerForChunk(nextChunk));
    this.prefetchUpcomingNeuralChunks(token, 16);

    if (this.isNeuralUnlocked) {
      this.syncMediaSession();
      this.emit();
      this.speakCurrentChunk(token);
      return;
    }

    const unlockP = this.primeNeuralAudioOnGesture();
    this.syncMediaSession();
    this.emit();
    void Promise.race([
      unlockP,
      new Promise<void>((resolve) => setTimeout(resolve, 90)),
    ]).then(() => {
      if (token === this.sessionToken && this.status === 'playing') {
        this.speakCurrentChunk(token);
      }
    });
  }

  togglePlayPause() {
    if (this.status === 'playing') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  nextTrack() {
    if (this.currentTrackIndex < this.tracks.length - 1) {
      this.playQueue(this.tracks, this.currentTrackIndex + 1);
    } else {
      this.stop();
    }
  }

  prevTrack() {
    if (this.currentTrackIndex > 0) {
      this.playQueue(this.tracks, this.currentTrackIndex - 1);
    }
  }

  stop() {
    const wasActive = this.status !== 'idle';
    this.userPausedAt = Date.now();
    this.sessionToken += 1;
    this.stopNeuralAudio();
    this.cancelWebSpeech();
    audioKeepAlive.release('speech');
    this.status = 'idle';
    this.tracks = [];
    this.flatChunks = [];
    this.chunkCursor = 0;
    this.currentTrackIndex = 0;
    if (wasActive) {
      clearMediaSession();
    }
    this.emit();
  }

  clearNotice() {
    this.noticeBn = null;
    this.emit();
  }
}

export const speechPlayer = new SpeechNarrationManager();

export function useSpeechPlayer(): SpeechPlayerSnapshot {
  const [snap, setSnap] = useState<SpeechPlayerSnapshot>(() =>
    speechPlayer.getSnapshot()
  );

  useEffect(() => {
    setSnap(speechPlayer.getSnapshot());
    return speechPlayer.subscribe(() => {
      setSnap(speechPlayer.getSnapshot());
    });
  }, []);

  return snap;
}

export function buildBanglaSpeechChunksForAyah(rawText: string): string[] {
  const prefs = speechPlayer.getVoicePrefs();
  const normalized = expandBanglaIslamicHonorifics(rawText, prefs.expandHonorifics);
  return splitIntoSpeakableChunks(normalized, 140);
}

export function buildBanglaMaleTtsUrlForText(chunkText: string): string {
  const prefs = speechPlayer.getVoicePrefs();
  const voice = resolveNeuralVoiceName('bn-BD', prefs);
  const params = new URLSearchParams({
    text: chunkText,
    lang: 'bn-BD',
    voice,
    rate: prefs.rate.toFixed(2),
    pitch: prefs.pitch.toFixed(2),
    expand: prefs.expandHonorifics ? '1' : '0',
    q: '96k',
  });
  return `/api/tts?${params.toString()}`;
}

