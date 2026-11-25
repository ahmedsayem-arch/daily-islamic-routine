import { Constants, EdgeTTS } from '@andresaya/edge-tts';
import { expandBanglaIslamicHonorifics } from '../src/utils/banglaHonorifics.ts';

export type SupportedTtsLang = 'bn-BD' | 'ar-SA' | 'en-US';

export const ALLOWED_MALE_VOICES = new Set<string>([
  'bn-IN-BashkarNeural',
  'bn-BD-PradeepNeural',
  'ar-SA-HamedNeural',
  'ar-EG-ShakirNeural',
  'ar-AE-HamdanNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural',
  'en-GB-RyanNeural',
]);

const DEFAULT_MALE_VOICE_BY_LANG: Record<SupportedTtsLang, string> = {
  'bn-BD': 'bn-IN-BashkarNeural',
  'ar-SA': 'ar-SA-HamedNeural',
  'en-US': 'en-US-AndrewNeural',
};

interface CachedAudioEntry {
  buffer: Uint8Array;
  createdAt: number;
}

const memoryCache = new Map<string, CachedAudioEntry>();
const MAX_CACHE_ENTRIES = 300;

export function normalizeLang(rawLang: unknown): SupportedTtsLang {
  if (typeof rawLang !== 'string') return 'bn-BD';
  const lower = rawLang.toLowerCase();
  if (lower.startsWith('ar')) return 'ar-SA';
  if (lower.startsWith('en')) return 'en-US';
  return 'bn-BD';
}

export function resolveMaleVoice(rawVoice: unknown, lang: SupportedTtsLang): string {
  if (typeof rawVoice === 'string' && ALLOWED_MALE_VOICES.has(rawVoice)) {
    return rawVoice;
  }
  return DEFAULT_MALE_VOICE_BY_LANG[lang];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatEdgeRate(rawRate: unknown, lang: SupportedTtsLang): string {
  const num = typeof rawRate === 'number' ? rawRate : Number(rawRate);
  const base = Number.isFinite(num) ? clamp(num, 0.7, 1.35) : 1.0;
  // Slightly calm, clear cadence for Bangla & Arabic Islamic narration
  const adjusted = lang === 'bn-BD' ? base * 0.94 : lang === 'ar-SA' ? base * 0.95 : base;
  const pct = Math.round((clamp(adjusted, 0.65, 1.35) - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function formatEdgePitch(rawPitch: unknown): string {
  const num = typeof rawPitch === 'number' ? rawPitch : Number(rawPitch);
  const basePitch = Number.isFinite(num) ? clamp(num, 0.65, 1.25) : 1.0;
  // Avoid vocoder pitch artifacts when user keeps pitch at natural 1.0
  if (Math.abs(basePitch - 1.0) < 0.03) return '+0Hz';
  const hzOffset = Math.round((basePitch - 1) * 32);
  return `${hzOffset >= 0 ? '+' : ''}${hzOffset}Hz`;
}

export interface MaleTtsRequest {
  text: string;
  lang?: string;
  voice?: string;
  rate?: string | number;
  pitch?: string | number;
  expandHonorifics?: boolean;
}

export async function synthesizeMaleTts(req: MaleTtsRequest): Promise<Uint8Array> {
  const lang = normalizeLang(req.lang);
  const expandHonorifics = req.expandHonorifics !== false;
  const prepared =
    lang === 'bn-BD'
      ? expandBanglaIslamicHonorifics(req.text, expandHonorifics)
      : req.text.replace(/\s+/g, ' ').trim();
  const cleanedText = prepared.slice(0, 800);
  if (!cleanedText) {
    throw new Error('Empty TTS text');
  }

  const voice = resolveMaleVoice(req.voice, lang);
  const rate = formatEdgeRate(req.rate, lang);
  const pitch = formatEdgePitch(req.pitch);

  const cacheKey = `96k|${voice}|${rate}|${pitch}|${cleanedText}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    memoryCache.delete(cacheKey);
    memoryCache.set(cacheKey, cached);
    return cached.buffer;
  }

  const generateAudio = async (): Promise<Uint8Array> => {
    const tts = new EdgeTTS();
    const res = await tts.generate(cleanedText, voice, {
      rate,
      pitch,
      volume: '+0%',
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      timeout: 15000,
    });
    return res.audio;
  };

  let audioBytes: Uint8Array;
  try {
    audioBytes = await generateAudio();
  } catch {
    audioBytes = await generateAudio();
  }

  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
  memoryCache.set(cacheKey, {
    buffer: audioBytes,
    createdAt: Date.now(),
  });

  return audioBytes;
}
