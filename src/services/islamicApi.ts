import {
  ALL_SURAHS,
  buildEveryAyahUrl,
  CURATED_HADITHS,
} from '../data/islamicData';
import {
  APPROVED_FREE_BOOKS,
  RIYAD_BENGALI_BY_NUMBER,
  RIYAD_CURATED_HADITHS,
  SEERAH_CHAPTERS,
} from '../data/seerahAndRiyadData';
import type {
  AudioTrackItem,
  AyahRef,
  FullBookSection,
  HadithBookId,
  HadithEntry,
  IslamHouseBookItem,
  PrayerTimeEntry,
  QariReciter,
  QuranAyahPair,
} from '../types/islamic';

import { formatBengaliTransliteration } from '../utils/quranFormatting';
import { formatHijriFromParts, getFallbackHijriDate } from '../utils/timeFormat';

interface SurahCacheEntry {
  arabic: Map<number, string>;
  tajweedArabic: Map<number, string>;
  bengaliTranslit: Map<number, string>;
  bengali: Map<number, string>;
  english: Map<number, string>;
  globalNumbers: Map<number, number>;
}

const surahCache = new Map<number, SurahCacheEntry>();

export interface PrayerScheduleResult {
  prayers: PrayerTimeEntry[];
  imsakTime?: string;
  tahajjudStart?: string;
  hijriDateBn: string;
  hijriDateAr?: string;
  hijriParts?: { day: number; month: number; year: number };
  locationLabel: string;
  isLive: boolean;
}

function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0) + 1440) % 1440;
}

function minsToHhmm(totalMins: number): string {
  const norm = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeLastThirdStart(maghribHHMM: string, fajrHHMM: string): string {
  const maghribM = hhmmToMins(maghribHHMM);
  const fajrM = hhmmToMins(fajrHHMM);
  const nightDuration = fajrM >= maghribM ? fajrM - maghribM : 1440 - maghribM + fajrM;
  return minsToHhmm(maghribM + (nightDuration * 2) / 3);
}

export function computeSehriEndFromFajr(fajrHHMM: string): string {
  return minsToHhmm(hhmmToMins(fajrHHMM) - 10);
}

const FALLBACK_PRAYERS: PrayerTimeEntry[] = [
  { key: 'Fajr', labelBn: 'ফজর', time: '05:02' },
  { key: 'Sunrise', labelBn: 'সূর্যোদয়', time: '06:18' },
  { key: 'Dhuhr', labelBn: 'যোহর', time: '11:52' },
  { key: 'Asr', labelBn: 'আসর', time: '15:36' },
  { key: 'Maghrib', labelBn: 'মাগরিব', time: '17:24' },
  { key: 'Isha', labelBn: 'ইশা', time: '18:42' },
];

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  locationLabel: string,
  method = 1,
  school: 0 | 1 = 1
): Promise<PrayerScheduleResult> {
  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    // method=1 (Karachi) & school=1 (Hanafi) widely used across Bangladesh & South Asia
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Prayer API error');
    const json = await res.json();
    const timings = json?.data?.timings;
    const hijri = json?.data?.date?.hijri;

    if (!timings) throw new Error('Missing timings');

    const cleanTime = (val: string) => String(val).split(' ')[0].slice(0, 5);
    const fajrTime = cleanTime(timings.Fajr);
    const maghribTime = cleanTime(timings.Maghrib);
    const imsakTime = timings.Imsak ? cleanTime(timings.Imsak) : computeSehriEndFromFajr(fajrTime);
    const tahajjudStart = timings.Lastthird
      ? cleanTime(timings.Lastthird)
      : computeLastThirdStart(maghribTime, fajrTime);

    const fallbackHijri = getFallbackHijriDate(today);
    const hijriParts =
      hijri && hijri.day && hijri.year
        ? {
            day: Number(hijri.day),
            month: Number(hijri.month?.number || 1),
            year: Number(hijri.year),
          }
        : fallbackHijri.parts;
    const hijriFormatted =
      hijri && hijri.day && hijri.year
        ? formatHijriFromParts(
            hijriParts.day,
            hijriParts.month,
            hijriParts.year,
            hijri.month?.ar
          )
        : fallbackHijri;

    return {
      prayers: [
        { key: 'Fajr', labelBn: 'ফজর', time: fajrTime },
        { key: 'Sunrise', labelBn: 'সূর্যোদয়', time: cleanTime(timings.Sunrise) },
        { key: 'Dhuhr', labelBn: 'যোহর', time: cleanTime(timings.Dhuhr) },
        { key: 'Asr', labelBn: 'আসর', time: cleanTime(timings.Asr) },
        { key: 'Maghrib', labelBn: 'মাগরিব', time: maghribTime },
        { key: 'Isha', labelBn: 'ইশা', time: cleanTime(timings.Isha) },
      ],
      imsakTime,
      tahajjudStart,
      hijriDateBn: hijriFormatted.bn,
      hijriDateAr: hijriFormatted.ar,
      hijriParts,
      locationLabel,
      isLive: true,
    };
  } catch {
    const fallbackHijri = getFallbackHijriDate(new Date());
    return {
      prayers: FALLBACK_PRAYERS,
      imsakTime: computeSehriEndFromFajr('05:02'),
      tahajjudStart: computeLastThirdStart('17:24', '05:02'),
      hijriDateBn: fallbackHijri.bn,
      hijriDateAr: fallbackHijri.ar,
      hijriParts: fallbackHijri.parts,
      locationLabel,
      isLive: false,
    };
  }
}

async function ensureSurahCached(surahNumber: number): Promise<SurahCacheEntry> {
  const existing = surahCache.get(surahNumber);
  if (existing) return existing;

  const fullUrl = `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,quran-tajweed,bn.bengali,en.sahih,en.transliteration`;
  let res = await fetch(fullUrl);
  if (!res.ok) {
    res = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,bn.bengali`
    );
  }
  if (!res.ok) {
    throw new Error(`সূরা ${surahNumber} লোড করা যায়নি`);
  }
  const json = await res.json();
  const editions = json?.data;
  if (!Array.isArray(editions) || editions.length < 2) {
    throw new Error('অসম্পূর্ণ কুরআন ডেটা পাওয়া গেছে');
  }

  const findEdition = (id: string) =>
    editions.find((e: { edition?: { identifier?: string } }) => e?.edition?.identifier === id);

  const arabicEd = findEdition('quran-uthmani') || editions[0];
  const tajweedEd = findEdition('quran-tajweed');
  const bengaliEd = findEdition('bn.bengali') || editions[1];
  const englishEd = findEdition('en.sahih');
  const translitEd = findEdition('en.transliteration');

  const arabicMap = new Map<number, string>();
  const tajweedMap = new Map<number, string>();
  const translitMap = new Map<number, string>();
  const bengaliMap = new Map<number, string>();
  const englishMap = new Map<number, string>();
  const globalMap = new Map<number, number>();

  for (const a of arabicEd?.ayahs || []) {
    arabicMap.set(a.numberInSurah, a.text);
    globalMap.set(a.numberInSurah, a.number);
  }
  for (const t of tajweedEd?.ayahs || []) {
    tajweedMap.set(t.numberInSurah, t.text);
  }
  for (const b of bengaliEd?.ayahs || []) {
    bengaliMap.set(b.numberInSurah, b.text);
  }
  for (const en of englishEd?.ayahs || []) {
    englishMap.set(en.numberInSurah, en.text);
  }
  for (const tr of translitEd?.ayahs || []) {
    translitMap.set(tr.numberInSurah, formatBengaliTransliteration(tr.text));
  }

  const entry: SurahCacheEntry = {
    arabic: arabicMap,
    tajweedArabic: tajweedMap,
    bengaliTranslit: translitMap,
    bengali: bengaliMap,
    english: englishMap,
    globalNumbers: globalMap,
  };
  surahCache.set(surahNumber, entry);
  return entry;
}

export async function fetchSurahWithBengali(
  surahNumber: number,
  qari: QariReciter
): Promise<QuranAyahPair[]> {
  const entry = await ensureSurahCached(surahNumber);
  const pairs: QuranAyahPair[] = [];

  entry.arabic.forEach((arabicText, numberInSurah) => {
    pairs.push({
      numberInSurah,
      globalNumber: entry.globalNumbers.get(numberInSurah) || numberInSurah,
      arabic: arabicText,
      tajweedArabic: entry.tajweedArabic.get(numberInSurah),
      bengaliTranslit: entry.bengaliTranslit.get(numberInSurah),
      bengali: entry.bengali.get(numberInSurah) || '',
      english: entry.english.get(numberInSurah),
      audioUrl: buildEveryAyahUrl(qari.everyAyahFolder, surahNumber, numberInSurah),
    });
  });

  pairs.sort((a, b) => a.numberInSurah - b.numberInSurah);
  return pairs;
}

export async function buildPlaylistFromRefs(
  refs: AyahRef[],
  qari: QariReciter,
  programTitleBn: string
): Promise<AudioTrackItem[]> {
  const uniqueSurahs = Array.from(new Set(refs.map((r) => r.surah)));

  // Fetch all unique surahs needed in parallel (gracefully continue if one fails)
  await Promise.allSettled(uniqueSurahs.map((s) => ensureSurahCached(s)));

  return refs.map((ref, idx) => {
    const cached = surahCache.get(ref.surah);
    const surahMeta = ALL_SURAHS.find((s) => s.number === ref.surah);
    const surahName = ref.surahNameBn || (surahMeta ? `সূরা ${surahMeta.nameBn}` : `সূরা ${ref.surah}`);

    return {
      id: `${ref.surah}:${ref.ayah}:${idx}`,
      titleBn: `${surahName} · আয়াত ${ref.ayah}`,
      subtitleBn: `${programTitleBn} — ${qari.nameBn}`,
      arabic: cached?.arabic.get(ref.ayah),
      tajweedArabic: cached?.tajweedArabic.get(ref.ayah),
      bengaliTranslit: cached?.bengaliTranslit.get(ref.ayah),
      meaningBn: cached?.bengali.get(ref.ayah),
      englishMeaning: cached?.english.get(ref.ayah),
      audioUrl: buildEveryAyahUrl(qari.everyAyahFolder, ref.surah, ref.ayah),
      surah: ref.surah,
      ayah: ref.ayah,
    };
  });
}

interface RiyadRawHadith {
  id: number;
  idInBook: number;
  chapterId: number;
  arabic?: string;
  english?: { narrator?: string; text?: string };
}

interface FawazRawHadith {
  hadithnumber?: number | string;
  text?: string;
  grades?: Array<{ grade?: string }>;
  reference?: { book?: number; hadith?: number };
}

let riyadCache: RiyadRawHadith[] | null = null;
const fullBookCache = new Map<string, FawazRawHadith[]>();
const islamHouseCache = new Map<string, IslamHouseBookItem[]>();

async function fetchRiyadJson(): Promise<RiyadRawHadith[]> {
  if (riyadCache) return riyadCache;
  const res = await fetch(
    'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@main/db/by_book/other_books/riyad_assalihin.json'
  );
  if (!res.ok) throw new Error('Riyad fetch failed');
  const json = await res.json();
  const list = Array.isArray(json?.hadiths) ? json.hadiths : [];
  riyadCache = list;
  return list;
}

async function fetchFawazSectionSafe(url: string): Promise<FawazRawHadith[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.hadiths) ? json.hadiths : [];
  } catch {
    return [];
  }
}

async function fetchFawazFullEditionCached(editionKey: string): Promise<FawazRawHadith[]> {
  const cached = fullBookCache.get(editionKey);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${editionKey}.min.json`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json?.hadiths) ? json.hadiths : [];
    if (list.length > 0) fullBookCache.set(editionKey, list);
    return list;
  } catch {
    return [];
  }
}

export async function fetchHadithSection(
  bookId: HadithBookId | string,
  bookNameBn: string,
  sectionNumber: number,
  sectionTitleBn: string
): Promise<{ hadiths: HadithEntry[]; isFallback: boolean }> {
  try {
    // 1. Riyad as-Salihin
    if (bookId === 'riyad-salihin') {
      if (sectionNumber === 999) {
        return { hadiths: RIYAD_CURATED_HADITHS, isFallback: false };
      }
      const all = await fetchRiyadJson();
      const chapterItems = all
        .filter((h) => h.chapterId === sectionNumber)
        .slice(0, 60)
        .map((h): HadithEntry => {
          const engCombined = [h.english?.narrator, h.english?.text]
            .filter(Boolean)
            .join(' ')
            .trim();
          const bnMatch = RIYAD_BENGALI_BY_NUMBER[h.idInBook] || '';
          return {
            hadithnumber: h.idInBook,
            arabic: (h.arabic || '').trim(),
            text: bnMatch,
            english: engCombined,
            bookNameBn,
            chapterBn: sectionTitleBn,
            gradeBn: 'রিয়াদুস সালেহীন · সহীহ/হাসান',
          };
        });
      if (chapterItems.length === 0) throw new Error('Empty Riyad chapter');
      return { hadiths: chapterItems, isFallback: false };
    }

    // 2. HadeethEnc.com (Scholar-approved Trilingual Hadith Encyclopedia)
    if (bookId === 'hadeethenc') {
      const listRes = await fetch(
        `https://hadeethenc.com/api/v1/hadeeths/list/?language=bn&category_id=${sectionNumber}&page=1&per_page=15`
      );
      if (!listRes.ok) throw new Error('HadeethEnc list failed');
      const listJson = await listRes.json();
      const items: Array<{ id: string; title: string }> = Array.isArray(listJson?.data)
        ? listJson.data
        : [];
      if (items.length === 0) throw new Error('Empty HadeethEnc category');

      const details = await Promise.all(
        items.slice(0, 12).map(async (item): Promise<HadithEntry | null> => {
          try {
            const [bnRes, enRes] = await Promise.all([
              fetch(`https://hadeethenc.com/api/v1/hadeeths/one/?language=bn&id=${item.id}`),
              fetch(`https://hadeethenc.com/api/v1/hadeeths/one/?language=en&id=${item.id}`),
            ]);
            if (!bnRes.ok) return null;
            const bn = await bnRes.json();
            const en = enRes.ok ? await enRes.json() : null;
            return {
              hadithnumber: item.id,
              arabic: (bn.hadeeth_ar || '').trim(),
              text: (bn.hadeeth || item.title || '').trim(),
              english: (en?.hadeeth || '').trim() || undefined,
              explanationBn: (bn.explanation || '').trim() || undefined,
              bookNameBn: bn.attribution ? `${bookNameBn} (${bn.attribution})` : bookNameBn,
              chapterBn: sectionTitleBn,
              gradeBn: bn.grade || 'সহীহ',
            };
          } catch {
            return null;
          }
        })
      );

      const valid = details.filter((d): d is HadithEntry => Boolean(d && d.text));
      if (valid.length === 0) throw new Error('No HadeethEnc details');
      return { hadiths: valid, isFallback: false };
    }

    // 3. Muwatta Imam Malik (sections 403 on ben-malik; use cached full .min.json filtered by reference.book)
    if (bookId === 'ben-malik') {
      const [benAll, engAll, araAll] = await Promise.all([
        fetchFawazFullEditionCached('ben-malik'),
        fetchFawazFullEditionCached('eng-malik'),
        fetchFawazFullEditionCached('ara-malik').then((list) =>
          list.length > 0 ? list : fetchFawazFullEditionCached('ara-malik1')
        ),
      ]);

      const benSection = benAll
        .filter((h) => h.reference?.book === sectionNumber && typeof h.text === 'string' && h.text.trim().length > 10)
        .slice(0, 60);

      if (benSection.length === 0) throw new Error('Empty Malik section');

      const araMap = new Map<string, string>();
      for (const a of araAll) {
        if (a.hadithnumber != null && a.text) {
          araMap.set(String(a.hadithnumber), a.text.trim());
        }
      }
      const engMap = new Map<string, string>();
      for (const e of engAll) {
        if (e.hadithnumber != null && e.text) {
          engMap.set(String(e.hadithnumber), e.text.trim());
        }
      }

      const mapped: HadithEntry[] = benSection.map((h) => {
        const key = h.hadithnumber != null ? String(h.hadithnumber) : '';
        return {
          hadithnumber: h.hadithnumber ?? '',
          text: (h.text || '').trim(),
          arabic: key ? araMap.get(key) : undefined,
          english: key ? engMap.get(key) : undefined,
          bookNameBn,
          chapterBn: sectionTitleBn,
          gradeBn: h.grades?.[0]?.grade || 'মুয়াত্তা মালিক',
        };
      });

      return { hadiths: mapped, isFallback: false };
    }

    // 4. FawazAhmed0 Open CC0 Hadith API (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah, Nawawi)
    const slug = bookId.replace(/^ben-/, '');
    const base = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';

    const [benList, engList, araPrimary] = await Promise.all([
      fetchFawazSectionSafe(`${base}/ben-${slug}/sections/${sectionNumber}.min.json`),
      fetchFawazSectionSafe(`${base}/eng-${slug}/sections/${sectionNumber}.min.json`),
      fetchFawazSectionSafe(`${base}/ara-${slug}/sections/${sectionNumber}.min.json`),
    ]);

    const araList =
      araPrimary.length > 0
        ? araPrimary
        : await fetchFawazSectionSafe(`${base}/ara-${slug}1/sections/${sectionNumber}.min.json`);

    if (benList.length === 0) throw new Error('Empty Bengali section');

    const araMap = new Map<string, string>();
    for (const a of araList) {
      if (a.hadithnumber != null && a.text) {
        araMap.set(String(a.hadithnumber), a.text.trim());
      }
    }

    const engMap = new Map<string, string>();
    for (const e of engList) {
      if (e.hadithnumber != null && e.text) {
        engMap.set(String(e.hadithnumber), e.text.trim());
      }
    }

    const mapped: HadithEntry[] = benList
      .filter((h) => typeof h.text === 'string' && h.text.trim().length > 10)
      .slice(0, 60)
      .map((h) => {
        const numKey = h.hadithnumber != null ? String(h.hadithnumber) : '';
        return {
          hadithnumber: h.hadithnumber ?? '',
          text: (h.text || '').trim(),
          arabic: numKey ? araMap.get(numKey) : undefined,
          english: numKey ? engMap.get(numKey) : undefined,
          bookNameBn,
          chapterBn: sectionTitleBn,
          gradeBn: h.grades?.[0]?.grade || 'সংকলিত',
        };
      });

    if (mapped.length === 0) throw new Error('No valid hadith text');
    return { hadiths: mapped, isFallback: false };
  } catch {
    const fallback = bookId === 'riyad-salihin' ? RIYAD_CURATED_HADITHS : CURATED_HADITHS;
    return {
      hadiths: fallback,
      isFallback: true,
    };
  }
}

interface IslamHouseApiAttachment {
  size?: string;
  extension_type?: string;
  url?: string;
}

interface IslamHouseApiItem {
  id: number;
  title?: string;
  description?: string | null;
  attachments?: IslamHouseApiAttachment[];
}

export async function fetchIslamHouseBooks(
  category: 'all' | 'seerah' | 'hadith' | 'azkar' = 'all'
): Promise<{ books: IslamHouseBookItem[]; isLive: boolean }> {
  const cacheKey = `ih_${category}`;
  const cached = islamHouseCache.get(cacheKey);
  if (cached) {
    return { books: cached, isLive: true };
  }

  try {
    // Official IslamHouse Public API v3 endpoints (category 398191 = Prophet Muhammad (ﷺ) Seerah, 296381 = Hadith Mutun, 728014 = Dua/Azkar)
    const endpoint =
      category === 'seerah'
        ? 'https://api3.islamhouse.com/v3/paV29H2gm56kvLP/main/get-category-items/398191/books/bn/bn/1/25/json'
        : category === 'hadith'
        ? 'https://api3.islamhouse.com/v3/paV29H2gm56kvLP/main/get-category-items/296381/books/bn/bn/1/25/json'
        : 'https://api3.islamhouse.com/v3/paV29H2gm56kvLP/main/books/bn/bn/1/30/json';

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('IslamHouse fetch error');
    const json = await res.json();
    const rawList: IslamHouseApiItem[] = Array.isArray(json?.data) ? json.data : [];

    const mapped: IslamHouseBookItem[] = [];
    for (const item of rawList) {
      const pdfAtt =
        item.attachments?.find((a) => a.extension_type?.toUpperCase() === 'PDF' && a.url) ||
        item.attachments?.find((a) => Boolean(a.url));
      if (!item.title || !pdfAtt?.url) continue;

      const titleLower = item.title;
      const inferredCat: IslamHouseBookItem['category'] =
        category !== 'all'
          ? category
          : /নবী|রাসূল|সীরাত|রাহীক/.test(titleLower)
          ? 'seerah'
          : /হাদীস|হাদিস|সুন্নাহ|নওয়াবী|বুখারী|মুসলিম/.test(titleLower)
          ? 'hadith'
          : 'azkar';

      mapped.push({
        id: item.id,
        title: item.title.trim(),
        description: (item.description || item.title).trim(),
        category: inferredCat,
        categoryLabelBn:
          inferredCat === 'seerah'
            ? 'সীরাতুন নবী (সা.)'
            : inferredCat === 'hadith'
            ? 'হাদিস ও সুন্নাহ'
            : 'ইসলামিক আমল ও কিতাব',
        pdfUrl: pdfAtt.url,
        fileSize: pdfAtt.size,
        sourceLabelBn: 'IslamHouse অনুমোদিত মুক্ত কিতাব',
      });
    }

    const baseCurated =
      category === 'all'
        ? APPROVED_FREE_BOOKS
        : APPROVED_FREE_BOOKS.filter((b) => b.category === category);

    const seenIds = new Set<string>(baseCurated.map((b) => String(b.id)));
    const combined = [...baseCurated];
    for (const m of mapped) {
      if (!seenIds.has(String(m.id))) {
        seenIds.add(String(m.id));
        combined.push(m);
      }
    }

    islamHouseCache.set(cacheKey, combined);
    return { books: combined, isLive: true };
  } catch {
    const fallback =
      category === 'all'
        ? APPROVED_FREE_BOOKS
        : APPROVED_FREE_BOOKS.filter((b) => b.category === category);
    return { books: fallback, isLive: false };
  }
}

let fullRaheeqCache: FullBookSection[] | null = null;

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

function inferRaheeqSectionTitle(chunkText: string, index: number): string {
  for (const rule of RAHEEQ_TOPIC_RULES) {
    if (rule.pattern.test(chunkText)) {
      return rule.labelBn;
    }
  }
  return `সীরাত অধ্যায় — অংশ ${index + 1}`;
}

function cleanRaheeqBody(raw: string): string {
  // Start cleanly at Chapter 1
  const bodyMarker = 'আরবের ভৌগোলিক পরিচয় এবং বিভিন্ন জাতির অবস্থান';
  const startIdx = raw.indexOf(bodyMarker);
  const effectiveStart = startIdx >= 0 ? startIdx : Math.min(raw.length, 52000);

  // Stop before back-cover bibliography if near end
  const bibMarker = 'সহায়ক গ্রন্থসমূহ';
  const endCandidate = raw.indexOf(bibMarker, Math.max(effectiveStart + 100000, raw.length - 120000));
  const effectiveEnd = endCandidate > effectiveStart ? endCandidate : raw.length;

  let text = raw.slice(effectiveStart, effectiveEnd);

  // Strip running URL watermarks & repetitive OCR border noise
  text = text
    .replace(/https?:\/\/(?:www\.)?QuranerAlo\.com/gi, ' ')
    .replace(/https?:\/\/archive\.org\/details\/\S*/gi, ' ')
    .replace(/আর\s*রাহীকুল\s*মাখত[ূু]ম\s*\|?\s*\d*/g, ' ')
    .replace(/\b(?:allel|ele|elfelfeT|Slt|TEE|SUEY|TET|alfalfa|alfa)\b/gi, ' ')
    .replace(/[_=~*]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

export async function fetchFullWrittenRaheeqAlMakhtum(): Promise<{
  sections: FullBookSection[];
  isLive: boolean;
}> {
  if (fullRaheeqCache && fullRaheeqCache.length > 0) {
    return { sections: fullRaheeqCache, isLive: true };
  }

  try {
    const fileUrl =
      'https://archive.org/download/20200925_20200925_1744/' +
      encodeURIComponent('আর রাহীকুল মাখতূম - আল্লামা ছফিউর রহমান মোবারকপুরী_djvu.txt');

    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error('Full Seerah text fetch failed');
    const rawText = await res.text();
    const cleaned = cleanRaheeqBody(rawText);

    if (cleaned.length < 50000) throw new Error('Parsed book too short');

    // Split cleaned text into ~26,000 char parts strictly on sentence boundaries (`।`)
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
      const baseTitle = inferRaheeqSectionTitle(partText, idx);
      const seenCount = usedTitles.get(baseTitle) || 0;
      usedTitles.set(baseTitle, seenCount + 1);
      const titleBn = seenCount > 0 ? `${baseTitle} (পর্ব ${seenCount + 1})` : baseTitle;

      // Group every 4-5 Bengali sentences into clean readable paragraphs
      const sentences = partText
        .split(/(?<=।)\s+/)
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

    fullRaheeqCache = sections;
    return { sections, isLive: true };
  } catch {
    const fallbackSections: FullBookSection[] = SEERAH_CHAPTERS.map((ch) => ({
      id: ch.id,
      number: ch.number,
      titleBn: ch.titleBn,
      paragraphs: ch.paragraphsBn,
    }));
    return { sections: fallbackSections, isLive: false };
  }
}

