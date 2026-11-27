import type { FullBookSection } from '../src/types/islamic';

export interface ServerSurahAyah {
  n: number;
  g: number;
  ar: string;
  tj?: string;
  bn: string;
  en?: string;
  tr?: string;
}

export interface ServerSurahPayload {
  surah: number;
  ayahs: ServerSurahAyah[];
}

const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
  89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
  12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

function getGlobalAyahNum(surah: number, ayah: number): number {
  let offset = 0;
  for (let i = 0; i < Math.min(surah - 1, SURAH_AYAH_COUNTS.length); i += 1) {
    offset += SURAH_AYAH_COUNTS[i];
  }
  return offset + Math.max(1, ayah);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 1. Quran Surah Cache & Proxy ----------
const surahCache = new Map<number, ServerSurahPayload>();
const surahInFlight = new Map<number, Promise<ServerSurahPayload>>();

export async function fetchSurahServer(surahNum: number): Promise<ServerSurahPayload> {
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    throw new Error('Invalid surah number');
  }
  const hit = surahCache.get(surahNum);
  if (hit) return hit;

  const existing = surahInFlight.get(surahNum);
  if (existing) return existing;

  const task = (async (): Promise<ServerSurahPayload> => {
    // Tier 1: AlQuran Cloud multi-edition
    for (const url of [
      `https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,quran-tajweed,bn.bengali,en.sahih,en.transliteration`,
      `https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,bn.bengali`,
    ]) {
      try {
        const res = await fetchWithTimeout(url, 8000);
        if (!res.ok) continue;
        const json = (await res.json()) as {
          data?: Array<{
            edition?: { identifier?: string };
            ayahs?: Array<{ numberInSurah: number; number: number; text: string }>;
          }>;
        };
        const editions = json?.data;
        if (!Array.isArray(editions) || editions.length < 2) continue;

        const findEd = (id: string) =>
          editions.find((e) => e?.edition?.identifier === id);
        const arEd = findEd('quran-uthmani') || editions[0];
        const tjEd = findEd('quran-tajweed');
        const bnEd = findEd('bn.bengali') || editions[1];
        const enEd = findEd('en.sahih');
        const trEd = findEd('en.transliteration');

        const tjMap = new Map((tjEd?.ayahs || []).map((a) => [a.numberInSurah, a.text]));
        const bnMap = new Map((bnEd?.ayahs || []).map((a) => [a.numberInSurah, a.text]));
        const enMap = new Map((enEd?.ayahs || []).map((a) => [a.numberInSurah, a.text]));
        const trMap = new Map((trEd?.ayahs || []).map((a) => [a.numberInSurah, a.text]));

        const ayahs: ServerSurahAyah[] = (arEd?.ayahs || []).map((a) => ({
          n: a.numberInSurah,
          g: a.number || getGlobalAyahNum(surahNum, a.numberInSurah),
          ar: a.text,
          tj: tjMap.get(a.numberInSurah),
          bn: bnMap.get(a.numberInSurah) || '',
          en: enMap.get(a.numberInSurah),
          tr: trMap.get(a.numberInSurah),
        }));

        if (ayahs.length > 0) {
          const payload: ServerSurahPayload = { surah: surahNum, ayahs };
          surahCache.set(surahNum, payload);
          return payload;
        }
      } catch {
        // try next source
      }
    }

    // Tier 2: FawazAhmed0 jsDelivr CDN Quran API
    const cdnBase = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions';
    const [arRes, bnRes, enRes] = await Promise.allSettled([
      fetchWithTimeout(`${cdnBase}/ara-quranuthmani/${surahNum}.min.json`, 8000),
      fetchWithTimeout(`${cdnBase}/ben-muhiuddinkhan/${surahNum}.min.json`, 8000),
      fetchWithTimeout(`${cdnBase}/eng-ummmuhammad/${surahNum}.min.json`, 8000),
    ]);

    const parseChapter = async (
      settled: PromiseSettledResult<Response>
    ): Promise<Array<{ verse: number; text: string }>> => {
      if (settled.status !== 'fulfilled' || !settled.value.ok) return [];
      const data = (await settled.value.json()) as {
        chapter?: Array<{ verse: number; text: string }>;
      };
      return Array.isArray(data?.chapter) ? data.chapter : [];
    };

    const [arList, bnList, enList] = await Promise.all([
      parseChapter(arRes),
      parseChapter(bnRes),
      parseChapter(enRes),
    ]);

    if (arList.length > 0) {
      const bnMap = new Map(bnList.map((x) => [x.verse, x.text]));
      const enMap = new Map(enList.map((x) => [x.verse, x.text]));
      const ayahs: ServerSurahAyah[] = arList.map((a) => ({
        n: a.verse,
        g: getGlobalAyahNum(surahNum, a.verse),
        ar: a.text,
        bn: bnMap.get(a.verse) || '',
        en: enMap.get(a.verse),
      }));
      const payload: ServerSurahPayload = { surah: surahNum, ayahs };
      surahCache.set(surahNum, payload);
      return payload;
    }

    throw new Error(`Unable to load surah ${surahNum}`);
  })();

  surahInFlight.set(surahNum, task);
  try {
    return await task;
  } finally {
    surahInFlight.delete(surahNum);
  }
}

// ---------- 2. Tafsir Cache & Proxy ----------
const TAFSIR_EDITIONS_MAP: Record<string, { slug: string; quranComId: number }> = {
  zakaria: { slug: 'bn-tafsir-abu-bakr-zakaria', quranComId: 166 },
  ibn_kathir: { slug: 'bn-tafseer-ibn-e-kaseer', quranComId: 164 },
  ahsanul_bayaan: { slug: 'bn-tafsir-ahsanul-bayaan', quranComId: 165 },
};

const tafsirCache = new Map<string, Record<number, string>>();
const tafsirInFlight = new Map<string, Promise<Record<number, string>>>();

export async function fetchTafsirServer(
  surahNum: number,
  editionId = 'zakaria'
): Promise<Record<number, string>> {
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    throw new Error('Invalid surah number');
  }
  const meta = TAFSIR_EDITIONS_MAP[editionId] || TAFSIR_EDITIONS_MAP.zakaria;
  const key = `${meta.slug}:${surahNum}`;
  const hit = tafsirCache.get(key);
  if (hit) return hit;

  const existing = tafsirInFlight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<Record<number, string>> => {
    try {
      const cdnRes = await fetchWithTimeout(
        `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${meta.slug}/${surahNum}.json`,
        8000
      );
      if (cdnRes.ok) {
        const payload = (await cdnRes.json()) as unknown;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { ayahs?: unknown[] })?.ayahs)
          ? (payload as { ayahs: unknown[] }).ayahs
          : [];
        const map: Record<number, string> = {};
        for (const item of list) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as { ayah?: number | string; verse_key?: string; text?: string };
          let ayahNum = Number(rec.ayah);
          if (!Number.isFinite(ayahNum) && typeof rec.verse_key === 'string') {
            ayahNum = Number(rec.verse_key.split(':')[1]);
          }
          if (Number.isFinite(ayahNum) && ayahNum > 0 && typeof rec.text === 'string' && rec.text.trim()) {
            map[ayahNum] = rec.text.trim();
          }
        }
        if (Object.keys(map).length > 0) {
          tafsirCache.set(key, map);
          return map;
        }
      }
    } catch {
      // fall through
    }

    const qRes = await fetchWithTimeout(
      `https://api.quran.com/api/v4/tafsirs/${meta.quranComId}/by_chapter/${surahNum}?per_page=300`,
      8000
    );
    if (qRes.ok) {
      const json = (await qRes.json()) as {
        tafsirs?: Array<{ verse_key?: string; text?: string }>;
      };
      const map: Record<number, string> = {};
      for (const item of json?.tafsirs || []) {
        const ayahNum = Number((item.verse_key || '').split(':')[1]);
        if (Number.isFinite(ayahNum) && ayahNum > 0 && typeof item.text === 'string' && item.text.trim()) {
          map[ayahNum] = item.text.trim();
        }
      }
      if (Object.keys(map).length > 0) {
        tafsirCache.set(key, map);
        return map;
      }
    }

    throw new Error(`Unable to load tafsir ${surahNum}`);
  })();

  tafsirInFlight.set(key, task);
  try {
    return await task;
  } finally {
    tafsirInFlight.delete(key);
  }
}

// ---------- 3. Seerah Raheeq Full Book Cache & Proxy ----------
const RAHEEQ_TOPIC_RULES: Array<{ pattern: RegExp; labelBn: string }> = [
  { pattern: /আরবের ভৌগোলিক পরিচয়/, labelBn: 'আরবের ভৌগোলিক পরিচয় ও বিভিন্ন জাতি' },
  { pattern: /আরবদের ধর্মীয় অবস্থা|আইয়ামে জাহেলিয়াহ/, labelBn: 'ইসলাম-পূর্ব আরবের ধর্মীয় ও সামাজিক অবস্থা' },
  { pattern: /নবীর পবিত্র বংশ|ইবরাহীম \(আ\.\).*ইসমাইল/, labelBn: 'রাসূল (সা.)-এর পবিত্র বংশ ও ইবরাহীম (আ.)' },
  { pattern: /হস্তী বাহিনীর|আবদুল মুত্তালিব/, labelBn: 'আবদুল মুত্তালিব, আবরাহা ও জন্মের প্রেক্ষাপট' },
  { pattern: /হালীমা সা’দিয়া|শৈশবকাল|দুধমাতা/, labelBn: 'পবিত্র জন্ম, দুধপান ও শৈশবকাল' },
  { pattern: /হিলফুল ফুযুল|হাজরে আসওয়াদ|খাদিজা/, labelBn: 'যৌবনকাল, সত্যবাদিতা ও বিবাহ' },
  { pattern: /হেরা গুহা|ওহী নাযিল|জিবরাঈল/, labelBn: 'হেরা গুহা ও প্রথম ওহী নাযিল' },
  { pattern: /গোপন দাওয়াত|প্রকাশ্য দাওয়াত/, labelBn: 'ইসলামের প্রাথমিক ও প্রকাশ্য দাওয়াত' },
  { pattern: /কোরায়শদের নির্যাতন|বেলাল|আবিসিনিয়া/, labelBn: 'কুরাইশদের নির্যাতন ও আবিসিনিয়ায় হিজরত' },
  { pattern: /ওমর ইবনুল খাত্তাব|বয়কট|শোআবে আবী তালেব/, labelBn: 'শোআবে আবী তালিবে বয়কট ও সাহাবীদের ত্যাগ' },
  { pattern: /শোকের বছর|তায়েফ/, labelBn: 'শোকের বছর ও তায়েফের হৃদয়বিদারক সফর' },
  { pattern: /মেরাজ|ইসরা/, labelBn: 'ইসরা ও মেরাজ এবং দাওয়াতের নতুন দিগন্ত' },
  { pattern: /আকাবার.*বাইয়াত|মদীনায় ইসলাম/, labelBn: 'আকাবার বাইয়াত ও আনসারদের অঙ্গীকার' },
  { pattern: /মদীনায় হিজরত|ছাওর গুহা|সোরাকা/, labelBn: 'মদীনায় ঐতিহাসিক হিজরত' },
  { pattern: /মসজিদে নববী|মদীনার সনদ|মাদানী জীবন/, labelBn: 'মদীনায় ইসলামী রাষ্ট্র ও সমাজ গঠন' },
  { pattern: /বদর.*যুদ্ধ|বদরের প্রান্তর|ফোরকান/, labelBn: 'বদরের মহাযুদ্ধ ও আল্লাহর সাহায্য' },
  { pattern: /ওহুদ.*যুদ্ধ|ওহুদের পাদদেশ|হামযা/, labelBn: 'ওহুদের যুদ্ধ ও কঠিন পরীক্ষা' },
  { pattern: /রাজী|বীরে মাউনা|বনী নযীর/, labelBn: 'বনী নযীর ও বিভিন্ন সামরিক অভিযান' },
  { pattern: /খন্দক|আহযাব|পরিখা/, labelBn: 'খন্দক বা আহযাবের যুদ্ধ ও বনু কুরাইযা' },
  { pattern: /হোদায়বিয়া|হুদায়বিয়া|বাইয়াতে রেজওয়ান/, labelBn: 'হুদায়বিয়ার সন্ধি ও বিজয়ের সূচনা' },
  { pattern: /বাদশাহদের প্রতি|চিঠি প্রেরণ|হেরাক্লিয়াস/, labelBn: 'বিশ্বনেতাদের প্রতি ইসলামের দাওয়াত' },
  { pattern: /খায়বর|খায়বার|জাফর/, labelBn: 'খায়বার বিজয় ও জাফর (রা.)-এর প্রত্যাবর্তন' },
  { pattern: /মুতার যুদ্ধ|যায়েদ ইবনে হারেসা/, labelBn: 'মুতার ঐতিহাসিক যুদ্ধ ও ওমরাহ কাযা' },
  { pattern: /মক্কা বিজয়|বায়তুল্লায় প্রবেশ/, labelBn: 'মক্কা বিজয় ও সত্যের পূর্ণ প্রতিষ্ঠা' },
  { pattern: /হোনায়েন|তায়েফ অবরোধ/, labelBn: 'হুনাইনের যুদ্ধ ও তায়েফ অভিযান' },
  { pattern: /তবুক|তাবুক/, labelBn: 'তাবুকের কষ্টসাধ্য অভিযান' },
  { pattern: /বিদায় হজ্জ|আরাফা/, labelBn: 'বিদায় হজ্জ ও মানবতার মহাসন্দ' },
  { pattern: /অন্তিম যাত্রা|রফীকে|ওফাত/, labelBn: 'রফীকে আ’লার সান্নিধ্যে ওফাত ও পবিত্র চরিত্র' },
];

function cleanRaheeqBody(raw: string): string {
  const bodyMarker = 'আরবের ভৌগোলিক পরিচয় এবং বিভিন্ন জাতির অবস্থান';
  const startIdx = raw.indexOf(bodyMarker);
  const effectiveStart = startIdx >= 0 ? startIdx : Math.min(raw.length, 52000);

  const bibMarker = 'সহায়ক গ্রন্থসমূহ';
  const endCandidate = raw.indexOf(
    bibMarker,
    Math.max(effectiveStart + 100000, raw.length - 120000)
  );
  const effectiveEnd = endCandidate > effectiveStart ? endCandidate : raw.length;

  return raw
    .slice(effectiveStart, effectiveEnd)
    .replace(/https?:\/\/(?:www\.)?QuranerAlo\.com/gi, ' ')
    .replace(/https?:\/\/archive\.org\/details\/\S*/gi, ' ')
    .replace(/আর\s*রাহীকুল\s*মাখত[ূু]ম\s*\|?\s*\d*/g, ' ')
    .replace(/\b(?:allel|ele|elfelfeT|Slt|TEE|SUEY|TET|alfalfa|alfa)\b/gi, ' ')
    .replace(/[_=~*]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let raheeqServerCache: FullBookSection[] | null = null;
let raheeqInFlight: Promise<{ sections: FullBookSection[]; isLive: boolean }> | null = null;

export async function fetchRaheeqSectionsServer(): Promise<{
  sections: FullBookSection[];
  isLive: boolean;
}> {
  if (raheeqServerCache && raheeqServerCache.length > 0) {
    return { sections: raheeqServerCache, isLive: true };
  }
  if (raheeqInFlight) return raheeqInFlight;

  raheeqInFlight = (async () => {
    try {
      const fileUrl =
        'https://archive.org/download/20200925_20200925_1744/' +
        encodeURIComponent('আর রাহীকুল মাখতূম - আল্লামা ছফিউর রহমান মোবারকপুরী_djvu.txt');
      const res = await fetchWithTimeout(fileUrl, 15000);
      if (!res.ok) throw new Error(`archive.org returned ${res.status}`);
      const rawText = await res.text();
      const cleaned = cleanRaheeqBody(rawText);
      if (cleaned.length < 50000) throw new Error('Parsed Raheeq too short');

      const TARGET_CHUNK_SIZE = 26000;
      const rawParts: string[] = [];
      let cursor = 0;
      while (cursor < cleaned.length) {
        if (cleaned.length - cursor <= TARGET_CHUNK_SIZE + 4000) {
          rawParts.push(cleaned.slice(cursor).trim());
          break;
        }
        let cut = cleaned.indexOf('।', cursor + TARGET_CHUNK_SIZE);
        if (cut === -1 || cut - cursor > TARGET_CHUNK_SIZE + 5000) {
          cut = cleaned.indexOf(' ', cursor + TARGET_CHUNK_SIZE);
        }
        if (cut === -1) cut = cleaned.length - 1;
        rawParts.push(cleaned.slice(cursor, cut + 1).trim());
        cursor = cut + 1;
      }

      const usedTitles = new Map<string, number>();
      const sections: FullBookSection[] = rawParts.map((partText, idx) => {
        let baseTitle = `সীরাত অধ্যায় — অংশ ${idx + 1}`;
        for (const rule of RAHEEQ_TOPIC_RULES) {
          if (rule.pattern.test(partText)) {
            baseTitle = rule.labelBn;
            break;
          }
        }
        const seenCount = usedTitles.get(baseTitle) || 0;
        usedTitles.set(baseTitle, seenCount + 1);
        const titleBn = seenCount > 0 ? `${baseTitle} (পর্ব ${seenCount + 1})` : baseTitle;

        const sentences = (partText.match(/[^।]+।?/g) || [partText])
          .map((s) => s.trim())
          .filter((s) => s.length > 4);

        const paragraphs: string[] = [];
        for (let i = 0; i < sentences.length; i += 5) {
          paragraphs.push(sentences.slice(i, i + 5).join(' '));
        }

        return {
          id: `raheeq-part-${idx + 1}`,
          number: idx + 1,
          titleBn,
          paragraphs: paragraphs.length > 0 ? paragraphs : [partText],
        };
      });

      raheeqServerCache = sections;
      return { sections, isLive: true };
    } catch {
      return { sections: [], isLive: false };
    }
  })();

  try {
    return await raheeqInFlight;
  } finally {
    raheeqInFlight = null;
  }
}

// ---------- 4. Quran & Ruqyah Ayah Audio Proxy ----------
const ALLOWED_EVERYAYAH_FOLDERS = new Set<string>([
  'Alafasy_128kbps',
  'MaherAlMuaiqly128kbps',
  'Ghamadi_40kbps',
  'Yasser_Ad-Dussary_128kbps',
  'Nasser_Alqatami_128kbps',
  'ahmed_ibn_ali_al_ajamy_128kbps',
  'Fares_Abbad_64kbps',
  'Abdurrahmaan_As-Sudais_192kbps',
  'Muhammad_Jibreel_128kbps',
  'Abdul_Basit_Murattal_192kbps',
]);

const ALLOWED_ISLAMIC_EDITIONS = new Set<string>([
  'ar.alafasy',
  'ar.mahermuaiqly',
  'ar.saadalghamdi',
  'ar.yasseraldossari',
  'ar.nasseralqatami',
  'ar.ahmedajamy',
  'ar.faresabbad',
  'ar.abdurrahmaansudais',
  'ar.muhammadjibreel',
  'ar.abdulbasitmurattal',
]);

const audioCache = new Map<string, Uint8Array>();
const audioInFlight = new Map<string, Promise<Uint8Array>>();
const MAX_AUDIO_CACHE_ENTRIES = 220;

function putAudioCache(key: string, data: Uint8Array) {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, data);
  while (audioCache.size > MAX_AUDIO_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (!oldest) break;
    audioCache.delete(oldest);
  }
}

export async function fetchQuranAudioServer(params: {
  surah: number;
  ayah: number;
  folder?: string;
  edition?: string;
}): Promise<Uint8Array> {
  const { surah, ayah } = params;
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Invalid surah');
  }
  const maxAyah = SURAH_AYAH_COUNTS[surah - 1] || 286;
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > maxAyah) {
    throw new Error('Invalid ayah');
  }

  const safeFolder =
    params.folder && ALLOWED_EVERYAYAH_FOLDERS.has(params.folder)
      ? params.folder
      : 'Alafasy_128kbps';
  const safeEdition =
    params.edition && ALLOWED_ISLAMIC_EDITIONS.has(params.edition)
      ? params.edition
      : 'ar.alafasy';

  const cacheKey = `${safeFolder}:${surah}:${ayah}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    audioCache.delete(cacheKey);
    audioCache.set(cacheKey, cached);
    return cached;
  }

  const existing = audioInFlight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<Uint8Array> => {
    const sss = String(surah).padStart(3, '0');
    const aaa = String(ayah).padStart(3, '0');
    const globalNum = getGlobalAyahNum(surah, ayah);

    const candidateUrls = [
      `https://everyayah.com/data/${safeFolder}/${sss}${aaa}.mp3`,
      `https://cdn.islamic.network/quran/audio/128/${safeEdition}/${globalNum}.mp3`,
    ];
    if (safeEdition !== 'ar.alafasy') {
      candidateUrls.push(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalNum}.mp3`);
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetchWithTimeout(url, 9000);
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > 256) {
          putAudioCache(cacheKey, buf);
          return buf;
        }
      } catch {
        // try next source
      }
    }

    throw new Error('Unable to fetch Quran ayah audio');
  })();

  audioInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    audioInFlight.delete(cacheKey);
  }
}
