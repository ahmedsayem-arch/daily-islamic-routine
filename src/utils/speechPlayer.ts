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

function splitIntoSpeakableChunks(rawText: string, maxLen = 360): string[] {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned
    .split(/(?<=[।.?!؟\n])\s+/)
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
  private noticeBn: string | null = null;
  private sessionToken = 0;
  private neuralPlayAttemptId = 0;
  private voicePrefs: SpeechVoicePrefs = loadVoicePrefs();
  private neuralAudioA: HTMLAudioElement | null = null;
  private neuralAudioB: HTMLAudioElement | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private unlockedSlots = { A: false, B: false };
  private slotObjectUrls: { A: string | null; B: string | null } = {
    A: null,
    B: null,
  };
  private preloadedStandby: {
    slot: 'A' | 'B';
    cursor: number;
    objUrl: string;
    token: number;
  } | null = null;
  private prefetchedChunks = new Map<number, { objUrl: string; token: number }>();
  private prefetchingCursors = new Set<number>();
  private activeFetchController: AbortController | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private deviceVoicesCount = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.deviceVoicesCount = window.speechSynthesis.getVoices().length;
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.deviceVoicesCount = window.speechSynthesis.getVoices().length;
        this.emit();
      });
    }
  }

  private createNeuralAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    return audio;
  }

  private ensureNeuralSlot(slot: 'A' | 'B'): HTMLAudioElement | null {
    if (slot === 'A') {
      if (!this.neuralAudioA) this.neuralAudioA = this.createNeuralAudioElement();
      return this.neuralAudioA;
    }
    if (!this.neuralAudioB) this.neuralAudioB = this.createNeuralAudioElement();
    return this.neuralAudioB;
  }

  private getActiveNeuralAudio(): HTMLAudioElement | null {
    return this.ensureNeuralSlot(this.activeSlot);
  }

  private getStandbySlot(): 'A' | 'B' {
    return this.activeSlot === 'A' ? 'B' : 'A';
  }

  private primeNeuralAudioOnGesture() {
    for (const slot of ['A', 'B'] as const) {
      if (this.unlockedSlots[slot]) continue;
      const audio = this.ensureNeuralSlot(slot);
      if (!audio) continue;
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.src = SILENT_WAV_DATA_URI;
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this.unlockedSlots[slot] = true;
            if (slot !== this.activeSlot) {
              audio.pause();
            }
          }).catch(() => {
            // ignore silent unlock rejection
          });
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Call synchronously inside click/tap handlers before any async fetch
   * so mobile browsers keep audio playback unlocked for neural voice tracks.
   */
  public primeOnUserGesture() {
    this.primeNeuralAudioOnGesture();
    audioKeepAlive.acquire('speech');
  }

  private revokeSlotObjectUrl(slot: 'A' | 'B') {
    const url = this.slotObjectUrls[slot];
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      this.slotObjectUrls[slot] = null;
    }
  }

  private clearPrefetchedChunks() {
    if (this.preloadedStandby) {
      this.preloadedStandby = null;
    }
    for (const entry of this.prefetchedChunks.values()) {
      try {
        URL.revokeObjectURL(entry.objUrl);
      } catch {
        // ignore
      }
    }
    this.prefetchedChunks.clear();
    this.prefetchingCursors.clear();
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
      onPause: () => this.pause(),
      onPrev: this.currentTrackIndex > 0 ? () => this.prevTrack() : undefined,
      onNext:
        this.currentTrackIndex < this.tracks.length - 1
          ? () => this.nextTrack()
          : undefined,
      onStop: () => this.stop(),
    });
  }

  private stopNeuralAudio() {
    this.neuralPlayAttemptId += 1;
    if (this.activeFetchController) {
      this.activeFetchController.abort();
      this.activeFetchController = null;
    }
    for (const slot of ['A', 'B'] as const) {
      const el = slot === 'A' ? this.neuralAudioA : this.neuralAudioB;
      if (el) {
        el.onended = null;
        el.onerror = null;
        el.pause();
        try {
          el.removeAttribute('src');
          el.load();
        } catch {
          // ignore
        }
      }
      this.revokeSlotObjectUrl(slot);
    }
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
      this.stopNeuralAudio();
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
    this.stopNeuralAudio();
    this.cancelWebSpeech();
    this.primeNeuralAudioOnGesture();
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
        const pieces = splitIntoSpeakableChunks(normalized, 360);
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
    this.emit();
    this.speakCurrentChunk(this.sessionToken);
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

  private async fetchAndCacheMaleTtsBlob(
    url: string,
    signal?: AbortSignal
  ): Promise<Blob | null> {
    try {
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(MALE_TTS_CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) {
          return await cached.blob();
        }
      }
    } catch {
      // Cache API unavailable; fall through to network fetch
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return null;
    }

    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const ctype = response.headers.get('content-type') || '';
    if (!ctype.includes('audio')) return null;

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

  private preloadNextChunkIntoStandby(token: number) {
    let nextCursor = this.chunkCursor + 1;
    while (
      nextCursor < this.flatChunks.length &&
      this.flatChunks[nextCursor].lang === 'ar-SA' &&
      this.voicePrefs.arabicMode === 'skip'
    ) {
      nextCursor += 1;
    }
    if (nextCursor >= this.flatChunks.length) return;
    const ready = this.prefetchedChunks.get(nextCursor);
    if (!ready || ready.token !== token) return;
    if (
      this.preloadedStandby &&
      this.preloadedStandby.cursor === nextCursor &&
      this.preloadedStandby.token === token
    ) {
      return;
    }

    const standbySlot = this.getStandbySlot();
    const standbyEl = this.ensureNeuralSlot(standbySlot);
    if (!standbyEl) return;

    this.prefetchedChunks.delete(nextCursor);
    this.revokeSlotObjectUrl(standbySlot);
    this.slotObjectUrls[standbySlot] = ready.objUrl;
    standbyEl.onended = null;
    standbyEl.onerror = null;
    standbyEl.src = ready.objUrl;
    try {
      standbyEl.load();
    } catch {
      // ignore
    }
    this.preloadedStandby = {
      slot: standbySlot,
      cursor: nextCursor,
      objUrl: ready.objUrl,
      token,
    };
  }

  private prefetchUpcomingNeuralChunks(token: number, count = 3) {
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
      if (
        this.preloadedStandby &&
        this.preloadedStandby.cursor === cursor &&
        this.preloadedStandby.token === token
      ) {
        cursor += 1;
        continue;
      }
      const existing = this.prefetchedChunks.get(cursor);
      if (existing && existing.token === token) {
        if (queued === 1) {
          this.preloadNextChunkIntoStandby(token);
        }
        cursor += 1;
        continue;
      }
      if (this.prefetchingCursors.has(cursor)) {
        cursor += 1;
        continue;
      }
      const targetCursor = cursor;
      const isImmediateNext = queued === 1;
      this.prefetchingCursors.add(targetCursor);
      const nextUrl = buildMaleTtsApiUrl(candidate, this.voicePrefs);
      void this.fetchAndCacheMaleTtsBlob(nextUrl)
        .then((blob) => {
          if (!blob || blob.size === 0 || token !== this.sessionToken) return;
          const prev = this.prefetchedChunks.get(targetCursor);
          if (prev) {
            try {
              URL.revokeObjectURL(prev.objUrl);
            } catch {
              // ignore
            }
          }
          this.prefetchedChunks.set(targetCursor, {
            objUrl: URL.createObjectURL(blob),
            token,
          });
          if (isImmediateNext && this.status === 'playing') {
            this.preloadNextChunkIntoStandby(token);
          }
        })
        .catch(() => {
          // Silent prefetch failure is harmless
        })
        .finally(() => {
          this.prefetchingCursors.delete(targetCursor);
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
    this.syncMediaSession();
    this.emit();

    if (this.shouldUseNeuralServerForChunk(chunk)) {
      if (
        this.preloadedStandby &&
        this.preloadedStandby.cursor === this.chunkCursor &&
        this.preloadedStandby.token === token
      ) {
        const pre = this.preloadedStandby;
        this.preloadedStandby = null;
        this.activeSlot = pre.slot;
        const standbyAudio = this.ensureNeuralSlot(pre.slot);
        if (standbyAudio) {
          this.playNeuralObjectUrlSync(standbyAudio, pre.slot, chunk, pre.objUrl, token, true);
          return;
        }
      }

      const audio = this.getActiveNeuralAudio();
      if (audio) {
        const prefetched = this.prefetchedChunks.get(this.chunkCursor);
        if (prefetched && prefetched.token === token) {
          this.prefetchedChunks.delete(this.chunkCursor);
          this.playNeuralObjectUrlSync(
            audio,
            this.activeSlot,
            chunk,
            prefetched.objUrl,
            token,
            false
          );
          return;
        }
        void this.speakViaMaleNeuralApi(audio, this.activeSlot, chunk, token);
        this.prefetchUpcomingNeuralChunks(token, 3);
        return;
      }
    }

    this.speakViaWebSpeech(chunk, token);
  }

  private playNeuralObjectUrlSync(
    audio: HTMLAudioElement,
    slot: 'A' | 'B',
    chunk: FlatChunk,
    objUrl: string,
    token: number,
    alreadyLoadedOnElement: boolean
  ) {
    if (token !== this.sessionToken || this.status !== 'playing') {
      if (!alreadyLoadedOnElement) {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          // ignore
        }
      }
      return;
    }

    const attemptId = ++this.neuralPlayAttemptId;
    if (!alreadyLoadedOnElement) {
      this.revokeSlotObjectUrl(slot);
      this.slotObjectUrls[slot] = objUrl;
      audio.src = objUrl;
    }

    audio.onended = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing'
      ) {
        return;
      }
      this.chunkCursor += 1;
      this.speakCurrentChunk(token);
    };

    audio.onerror = () => {
      if (
        attemptId !== this.neuralPlayAttemptId ||
        token !== this.sessionToken ||
        this.status !== 'playing'
      ) {
        return;
      }
      this.speakViaWebSpeech(chunk, token);
    };

    audio
      .play()
      .then(() => {
        this.unlockedSlots[slot] = true;
        if (
          attemptId === this.neuralPlayAttemptId &&
          token === this.sessionToken &&
          this.status === 'playing'
        ) {
          this.prefetchUpcomingNeuralChunks(token, 3);
        }
      })
      .catch((err: unknown) => {
        if (attemptId !== this.neuralPlayAttemptId) return;
        const name = err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
        if (name === 'AbortError') return;
        if (token === this.sessionToken && this.status === 'playing') {
          this.speakViaWebSpeech(chunk, token);
        }
      });
  }

  private async speakViaMaleNeuralApi(
    audio: HTMLAudioElement,
    slot: 'A' | 'B',
    chunk: FlatChunk,
    token: number
  ) {
    if (token !== this.sessionToken) return;

    if (this.activeFetchController) {
      this.activeFetchController.abort();
    }
    const controller = new AbortController();
    this.activeFetchController = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 18000);

    try {
      const url = buildMaleTtsApiUrl(chunk, this.voicePrefs);
      let blob = await this.fetchAndCacheMaleTtsBlob(url, controller.signal);
      if ((!blob || blob.size === 0) && typeof navigator !== 'undefined' && navigator.onLine !== false) {
        blob = await this.fetchAndCacheMaleTtsBlob(url, controller.signal);
      }
      window.clearTimeout(timeoutId);

      if (token !== this.sessionToken || this.status !== 'playing') return;
      if (!blob || blob.size === 0) {
        this.speakViaWebSpeech(chunk, token);
        return;
      }

      const objUrl = URL.createObjectURL(blob);
      this.playNeuralObjectUrlSync(audio, slot, chunk, objUrl, token, false);
    } catch {
      window.clearTimeout(timeoutId);
      if (token !== this.sessionToken || this.status !== 'playing') return;
      this.speakViaWebSpeech(chunk, token);
    }
  }

  private speakViaWebSpeech(chunk: FlatChunk, token: number) {
    if (token !== this.sessionToken) return;
    if (!this.isWebSpeechSupported()) {
      this.noticeBn =
        'ইন্টারনেট সংযোগ না থাকায় এবং ডিভাইস TTS ভয়েস না থাকায় অডিও চালু করা যায়নি।';
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
          'অফলাইনে এই অংশের অডিও এখনো সেভ করা হয়নি অথবা ফোনের TTS সেটিংসে বাংলা/আরবি ডাটা নেই।';
        this.stop();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  pause() {
    if (!this.isSupported() || this.status !== 'playing') return;
    this.sessionToken += 1;
    this.stopNeuralAudio();
    this.cancelWebSpeech();
    audioKeepAlive.release('speech');
    this.status = 'paused';
    setMediaSessionPlaybackState('paused');
    this.emit();
  }

  resume() {
    if (!this.isSupported() || this.status !== 'paused') return;
    for (const hook of this.beforeStartHooks) hook();
    this.primeNeuralAudioOnGesture();
    audioKeepAlive.acquire('speech');
    this.sessionToken += 1;
    this.status = 'playing';
    this.syncMediaSession();
    this.emit();
    this.speakCurrentChunk(this.sessionToken);
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
  return splitIntoSpeakableChunks(normalized, 360);
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

