/**
 * Expands Bengali Islamic honorific abbreviations (সা., সঃ, রা., রাঃ, আ., রহ., ﷺ, etc.)
 * and normalizes digitized Hadith/Tafsir punctuation so neural TTS voices pronounce them
 * clearly and completely instead of reading raw abbreviation letters.
 */

const FEMALE_COMPANION_RE =
  /(?:আয়িশা|আয়েশা|আয়েশা|আয়িশাহ|ফাতিমা|ফাতেমা|খাদীজা|খাদিজা|হাফসা|হাফছা|যয়নব|জয়নব|জয়নব|যায়নাব|সুমাইয়া|সুমাইয়া|আসমা|উম্মু|উম্মে|হালিমা|সাদিয়া|সাদিয়া|মায়মূনা|মায়মুনা|জুওয়াইরিয়া|জুয়াইরিয়া|সাফিয়্যা|সাফিয়া|সফিয়্যাহ|রুকাইয়া|রুকাইয়া|হিন্দা|রামলা|খাওলা|খাওলাহ|বারাকা|মারিয়া|মারিয়া|নুসাইবা|হুমায়রা)\s*$/;

const DUAL_COMPANION_RE = /(?:উভয়ে|দুজন|পিতা-পুত্র)\s*$/;
const PLURAL_COMPANION_RE = /(?:তাঁরা|সাহাবীগণ|সাহাবাগণ|সাহাবায়ে\s+কেরাম|সাহাবাদের)\s*$/;

function pickRadiyallahuPhrase(beforeText: string, matchedToken: string): string {
  const token = matchedToken.replace(/\s+/g, ' ').trim();
  if (/আনহা/.test(token)) return 'রাদিয়াল্লাহু আনহা';
  if (/আনহুমা/.test(token)) return 'রাদিয়াল্লাহু আনহুমা';
  if (/আনহুম/.test(token)) return 'রাদিয়াল্লাহু আনহুম';

  const context = beforeText.slice(-45).replace(/[(\[‘“"'\-]/g, ' ').trim();
  if (FEMALE_COMPANION_RE.test(context)) return 'রাদিয়াল্লাহু আনহা';
  if (DUAL_COMPANION_RE.test(context)) return 'রাদিয়াল্লাহু আনহুমা';
  if (PLURAL_COMPANION_RE.test(context)) return 'রাদিয়াল্লাহু আনহুম';
  return 'রাদিয়াল্লাহু আনহু';
}

function attachHonorificCleanly(
  text: string,
  pattern: RegExp,
  resolver: (before: string, match: string) => string
): string {
  return text.replace(pattern, (fullMatch: string, ...args: unknown[]) => {
    const offset = typeof args[args.length - 2] === 'number' ? (args[args.length - 2] as number) : 0;
    const prefixCapture = typeof args[0] === 'string' ? args[0] : '';
    const beforeEnd = offset + prefixCapture.length;
    const beforeStart = Math.max(0, beforeEnd - 50);
    const before = text.slice(beforeStart, beforeEnd);
    const afterStart = offset + fullMatch.length;
    const after = text.slice(afterStart, afterStart + 12);
    const phrase = resolver(before, fullMatch);
    const hasAttachedSuffix = /^-(?:এর|কে|র|তে|এ|ও)/.test(after);
    const leadingSpace = prefixCapture ? `${prefixCapture}` : ' ';
    const trailingSpace = hasAttachedSuffix ? '' : ' ';
    return `${leadingSpace}${phrase}${trailingSpace}`;
  });
}

export function expandBanglaIslamicHonorifics(
  rawText: string,
  expandAbbreviations = true
): string {
  if (!rawText) return '';

  let out = rawText
    // Normalize glottal/ayn curly quotes inside Bengali transliterated words
    .replace(/তা[‘’']আলা/g, 'তাআলা')
    .replace(/(?<=[\u0980-\u09FF])[‘’'](?=[\u0980-\u09FF])/g, '')
    .replace(
      /[‘’'](?=(?:আলাইহি|আয়িশা|আয়েশা|আয়িশাহ|উমার|ওমর|আলী|আব্বাস|আলক্বামাহ|আবদুল্লাহ|আব্দুল্লাহ|আনহু|আনহা|ইমরান|আমর|আতা|আত্বা))/g,
      ''
    )
    // Convert typography visarga colons on labels/verbs into true colons so TTS pauses naturally
    .replace(
      /(বলেন|বর্ণনা|বাণী|অধ্যায়|পরিচ্ছেদ|ফযীলত|গুরুত্ব|যেমন|অর্থ|ব্যাখ্যা|উল্লেখ্য|প্রকাশনী|ফাউন্ডেশন|সূত্র|হাদীস|স্থান|বিশেষতঃ|বস্তুতঃ|প্রায়ঃ|মূলতঃ)(?:ঃ)/g,
      (full, word) => (full.endsWith('তঃঃ') ? full : `${word}:`)
    )
    .replace(
      /(বলেন|বর্ণনা|বাণী|অধ্যায়|পরিচ্ছেদ|ফযীলত|গুরুত্ব|যেমন|অর্থ|ব্যাখ্যা|উল্লেখ্য|প্রকাশনী|ফাউন্ডেশন|সূত্র|হাদীস|স্থান)ঃ/g,
      '$1:'
    );

  if (expandAbbreviations) {
    // 1. Unicode honorific ligatures
    out = out
      .replace(/ﷺ/g, ' সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম ')
      .replace(/ﷻ/g, ' জাল্লা জালালুহু ')
      .replace(/ؓ/g, ' রাদিয়াল্লাহু আনহু ')
      .replace(/ؑ/g, ' আলাইহিস সালাম ')
      .replace(/ؒ/g, ' রাহিমাহুল্লাহ ');

    // 2. Prophet Muhammad (ﷺ): parenthesized/bracketed (including malformed "(সঃ" or "সঃ)") and bare forms
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)+(?:সা\.?\s*আ\.?|সাঃ\s*আঃ|সা\.?\s*ওয়া\.?|সাল্লা\.?|সা\.?|সাঃ|স\.|সঃ|স|দ\.|দঃ)(?:\s*\))+(?=$|[\s,;।.!?\-’”"'\)\]])/g,
      () => 'সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম'
    );
    out = attachHonorificCleanly(
      out,
      /(\s|^)(?:\(\s*)+(?:সা\.?\s*আ\.?|সাঃ\s*আঃ|সা\.?\s*ওয়া\.?|সাল্লা\.?|সা\.?|সাঃ|স\.|সঃ|স|দ\.|দঃ)(?=$|[\s,;।.!?\-’”"'])/g,
      () => 'সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম'
    );
    out = attachHonorificCleanly(
      out,
      /(^|[\s‘“"'\-])(?:সা\.?\s*আ\.?|সাঃ\s*আঃ|সা\.?\s*ওয়া\.?|সাল্লা\.?|সা\.|সাঃ|স\.|সঃ|দঃ)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      () => 'সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম'
    );

    // 3. Companions (রা., রাঃ, রাযি.) with female/plural context detection
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)+(?:রা\.?\s*আ\.?|রাঃ\s*আঃ|রাযি\.?\s*আনহুমা|রাযি\.?\s*আনহুম|রাযি\.?\s*আনহা|রাযি\.?\s*আনহু|রা\.?\s*আনহুমা|রা\.?\s*আনহুম|রা\.?\s*আনহা|রা\.?\s*আনহু|রাঃ\s*আনহুমা|রাঃ\s*আনহুম|রাঃ\s*আনহা|রাঃ\s*আনহু|রাযি\.?|রাযিঃ|রা\.?|রাঃ|রা)(?:\s*\))+(?=$|[\s,;।.!?\-’”"'\)\]])/g,
      (before, match) => pickRadiyallahuPhrase(before, match)
    );
    out = attachHonorificCleanly(
      out,
      /(\s|^)(?:\(\s*)+(?:রাযি\.?|রাযিঃ|রা\.?|রাঃ|রা)(?=$|[\s,;।.!?\-’”"'])/g,
      (before, match) => pickRadiyallahuPhrase(before, match)
    );
    out = attachHonorificCleanly(
      out,
      /(^|[\s‘“"'\-])(?:রা\.?\s*আ\.?|রাঃ\s*আঃ|রাযি\.?\s*আনহুমা|রাযি\.?\s*আনহুম|রাযি\.?\s*আনহা|রাযি\.?\s*আনহু|রা\.?\s*আনহুমা|রা\.?\s*আনহুম|রা\.?\s*আনহা|রা\.?\s*আনহু|রাঃ\s*আনহুমা|রাঃ\s*আনহুম|রাঃ\s*আনহা|রাঃ\s*আনহু|রাযি\.|রাযিঃ|রা\.|রাঃ)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      (before, match) => pickRadiyallahuPhrase(before, match)
    );

    // 4. Prophets & Angels (আ., আঃ, আ.সা.)
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)+(?:আ\.?\s*সা\.?|আঃ\s*সাঃ|আ\.?|আঃ|আ)(?:\s*\))+(?=$|[\s,;।.!?\-’”"'\)\]])/g,
      () => 'আলাইহিস সালাম'
    );
    out = attachHonorificCleanly(
      out,
      /(^|[\s‘“"'\-])(?:আ\.?\s*সা\.?|আঃ\s*সাঃ|আঃ)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      () => 'আলাইহিস সালাম'
    );
    // Bare "আ." only when preceded by a 2+ letter Bengali word (e.g. "মূসা আ.") to avoid matching person initials like "আ. রহিম"
    out = out.replace(
      /(?<=[\u0980-\u09FF]{2}\s)আ\.(?=$|[\s),;।.!?\-’”"'])/g,
      'আলাইহিস সালাম'
    );

    // 5. Scholars & Muhaddithun (রহ., রহঃ, রাহি., হাফি., দা.বা.)
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)+(?:রহ\.?\s*আ\.?|রহঃ\s*আঃ|রাহি\.?|রাহিঃ|রহ\.?|রহঃ|রহ)(?:\s*\))+(?=$|[\s,;।.!?\-’”"'\)\]])/g,
      () => 'রাহিমাহুল্লাহ'
    );
    out = attachHonorificCleanly(
      out,
      /(^|[\s‘“"'\-])(?:রাহি\.|রাহিঃ|রহ\.|রহঃ)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      () => 'রাহিমাহুল্লাহ'
    );
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)*(?:হাফি\.|হাফিঃ|হাফিজ\.)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      () => 'হাফিজাহুল্লাহ'
    );
    out = attachHonorificCleanly(
      out,
      /(\s|^|[\u0980-\u09FF‘“"'\-])(?:\(\s*)*(?:দা\.?\s*বা\.?|দাঃ\s*বাঃ)(?:\s*\))*(?=$|[\s),;।.!?\-’”"'])/g,
      () => 'দামাত বারাকাতুহুম'
    );

    // 6. Common Hadith / Islamic citation abbreviations
    out = out
      .replace(/(^|[\s(\[‘“"'\-])হা[ঃ.](?=\s*[০-৯0-9])/g, '$1হাদীস নম্বর ')
      .replace(/(^|[\s(\[‘“"'\-])নং(?=$|[\s)\],;।.!?\-])/g, '$1নম্বর')
      .replace(/(^|[\s(\[‘“"'\-])(?:খ্রি\.|খ্রিঃ|খৃ\.|খৃঃ)(?=$|[\s)\],;।.!?\-])/g, '$1খ্রিস্টাব্দ')
      .replace(/(^|[\s(\[‘“"'\-])(?:হি\.|হিঃ)(?=$|[\s)\],;।.!?\-])/g, '$1হিজরী');

    // Clean hyphenated suffix spacing so TTS reads "সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম এর" smoothly
    out = out.replace(
      /(সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম|রাদিয়াল্লাহু আনহুমা|রাদিয়াল্লাহু আনহুম|রাদিয়াল্লাহু আনহা|রাদিয়াল্লাহু আনহু|আলাইহিস সালাম|রাহিমাহুল্লাহ|হাফিজাহুল্লাহ)-(এর|কে|তে|র|এ|ও)(?=$|[\s),;।.!?\-’”"'])/g,
      '$1 $2'
    );
  }

  return out
    .replace(/[·•—–|/]+/g, ', ')
    .replace(/\[\s*[০-৯0-9]+\s*\]/g, ' ')
    .replace(/\[([^\]]+)\]/g, ', $1, ')
    .replace(/\s+([,;।.?!:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
