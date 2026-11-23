export type TajweedCategory =
  | 'silent'
  | 'madd-normal'
  | 'madd-permissible'
  | 'madd-obligatory'
  | 'qalqalah'
  | 'ghunnah'
  | 'ikhfa'
  | 'idgham';

export interface TajweedSegment {
  text: string;
  category?: TajweedCategory;
}

const CODE_TO_CATEGORY: Record<string, TajweedCategory> = {
  h: 'silent', // Hamzatul Wasl
  s: 'silent', // Silent letter
  l: 'silent', // Lam Shamsiyyah
  u: 'silent', // Idgham without Ghunnah
  n: 'madd-normal', // Madd Normal 2
  p: 'madd-permissible', // Madd Permissible 2/4/6
  m: 'madd-obligatory', // Madd Necessary 6
  o: 'madd-obligatory', // Madd Obligatory 4-5
  q: 'qalqalah', // Qalqalah
  g: 'ghunnah', // Ghunnah
  f: 'ikhfa', // Ikhfa
  c: 'ikhfa', // Ikhfa Shafawi
  a: 'idgham', // Idgham with Ghunnah
  d: 'idgham', // Idgham Mutajanisayn / Mutaqaribayn
  w: 'ikhfa', // Idgham Shafawi
  i: 'idgham', // Iqlab
};

export const TAJWEED_COLOR_CLASSES: Record<TajweedCategory, string> = {
  silent: 'text-[#6D827A] dark:text-[#7E968E]',
  'madd-normal': 'text-[#B45309] dark:text-[#FBBF24]',
  'madd-permissible': 'text-[#C2410C] dark:text-[#FB923C]',
  'madd-obligatory': 'text-[#BE123C] dark:text-[#FB7185]',
  qalqalah: 'text-[#0369A1] dark:text-[#38BDF8]',
  ghunnah: 'text-[#047857] dark:text-[#34D399]',
  ikhfa: 'text-[#7E22CE] dark:text-[#C084FC]',
  idgham: 'text-[#0F766E] dark:text-[#2DD4BF]',
};

export const TAJWEED_LEGEND: Array<{
  category: TajweedCategory;
  labelBn: string;
}> = [
  { category: 'ghunnah', labelBn: 'গুন্নাহ / ইদগাম' },
  { category: 'qalqalah', labelBn: 'কলকলাহ' },
  { category: 'madd-obligatory', labelBn: 'লম্বা মদ (৪–৬)' },
  { category: 'madd-normal', labelBn: 'মদ (২)' },
  { category: 'ikhfa', labelBn: 'ইখফা' },
  { category: 'silent', labelBn: 'সাইলেন্ট / ওয়াসল' },
];

/**
 * Stack-based parser for AlQuran Cloud `quran-tajweed` markup like:
 * `[h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ`
 */
export function parseTajweedText(raw: string): TajweedSegment[] {
  if (!raw) return [];

  const segments: TajweedSegment[] = [];
  const stack: Array<TajweedCategory | undefined> = [];
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    const currentCat = stack[stack.length - 1];
    const last = segments[segments.length - 1];
    if (last && last.category === currentCat) {
      last.text += buffer;
    } else {
      segments.push({ text: buffer, category: currentCat });
    }
    buffer = '';
  };

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '[') {
      const match = raw.slice(i).match(/^\[([a-zA-Z]+)(?::\d+)?\[/);
      if (match) {
        flush();
        const code = match[1].toLowerCase();
        stack.push(CODE_TO_CATEGORY[code]);
        i += match[0].length;
        continue;
      }
    }
    if (ch === ']' && stack.length > 0) {
      flush();
      stack.pop();
      i += 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }

  flush();
  return segments;
}

const INDEPENDENT_VOWELS: Record<string, string> = {
  aaa: 'আ',
  aa: 'আ',
  a: 'আ',
  eee: 'ঈ',
  ee: 'ঈ',
  ii: 'ঈ',
  i: 'ই',
  ooo: 'ঊ',
  oo: 'ঊ',
  uu: 'ঊ',
  u: 'উ',
  e: 'এ',
  o: 'ও',
};

const MATRA_VOWELS: Record<string, string> = {
  aaa: 'া',
  aa: 'া',
  a: 'া',
  eee: 'ী',
  ee: 'ী',
  ii: 'ী',
  i: 'ি',
  ooo: 'ূ',
  oo: 'ূ',
  uu: 'ূ',
  u: 'ু',
  e: 'ে',
  o: 'ো',
};

const CONSONANT_MAP: Array<[string, string]> = [
  ['sh', 'শ'],
  ['kh', 'খ'],
  ['gh', 'গ'],
  ['th', 'স'],
  ['dh', 'য'],
  ['zh', 'য'],
  ['ch', 'চ'],
  ['ll', 'ল্ল'],
  ['mm', 'ম্ম'],
  ['nn', 'ন্ন'],
  ['bb', 'ব্ব'],
  ['dd', 'দ্দ'],
  ['tt', 'ত্ত'],
  ['ss', 'স্স'],
  ['kk', 'ক্ক'],
  ['qq', 'ক্ক'],
  ['ff', 'ফ্ফ'],
  ['jj', 'জ্জ'],
  ['zz', 'য্য'],
  ['rr', 'রর'],
  ['b', 'ব'],
  ['c', 'স'],
  ['d', 'দ'],
  ['f', 'ফ'],
  ['g', 'গ'],
  ['h', 'হ'],
  ['j', 'জ'],
  ['k', 'ক'],
  ['l', 'ল'],
  ['m', 'ম'],
  ['n', 'ন'],
  ['p', 'প'],
  ['q', 'ক'],
  ['r', 'র'],
  ['s', 'স'],
  ['t', 'ত'],
  ['v', 'ভ'],
  ['x', 'ক্স'],
  ['z', 'য'],
];

function transliterateWordToBengali(word: string): string {
  // Handle common Arabic prefixes/tokens cleanly and fix known AlQuran Cloud OCR typo (lyyaaka -> iyyaaka)
  const lower = word.toLowerCase().replace(/^lyyaa/, 'iyyaa');
  if (!/[a-z]/.test(lower)) return word;

  let out = '';
  let i = 0;
  let lastWasConsonant = false;
  let atSyllableStart = true;

  const isVowelAt = (idx: number) => 'aeiou'.includes(lower[idx] || '');

  while (i < lower.length) {
    const ch = lower[i];

    // Glottal / Ayn apostrophe acts as syllable separator
    if (ch === "'" || ch === '’' || ch === '‘') {
      lastWasConsonant = false;
      atSyllableStart = true;
      i += 1;
      continue;
    }

    if (ch === '-' || ch === ';' || ch === ',' || ch === '.' || ch === ':') {
      out += ch;
      lastWasConsonant = false;
      atSyllableStart = true;
      i += 1;
      continue;
    }

    // Handle 'y' semi-vowel
    if (ch === 'y') {
      if (lower.slice(i, i + 2) === 'yy') {
        out += atSyllableStart ? 'ইয়্য' : 'য়্য';
        lastWasConsonant = true;
        atSyllableStart = false;
        i += 2;
        continue;
      }
      if (lastWasConsonant && !isVowelAt(i + 1)) {
        out += 'য়';
        lastWasConsonant = true;
        atSyllableStart = false;
        i += 1;
        continue;
      }
      if (atSyllableStart) {
        if (lower.slice(i, i + 3) === 'yoo' || lower.slice(i, i + 2) === 'yu') {
          out += 'ইউ';
          lastWasConsonant = false;
          atSyllableStart = false;
          i += lower.slice(i, i + 3) === 'yoo' ? 3 : 2;
          continue;
        }
        out += 'ইয়';
        lastWasConsonant = true;
        atSyllableStart = false;
        i += 1;
        continue;
      }
      // Mid-word single 'y'
      out += isVowelAt(i + 1) ? 'য়' : 'য়';
      lastWasConsonant = true;
      atSyllableStart = false;
      i += 1;
      continue;
    }

    // Handle 'w' semi-vowel
    if (ch === 'w') {
      if (lower.slice(i, i + 2) === 'ww') {
        out += 'ওয়';
        lastWasConsonant = true;
        atSyllableStart = false;
        i += 2;
        continue;
      }
      if (atSyllableStart || !lastWasConsonant || isVowelAt(i + 1)) {
        // Post-vowel 'aw' at end or before consonant (e.g. nawm, yawm)
        if (!atSyllableStart && !lastWasConsonant && !isVowelAt(i + 1)) {
          out += 'ও';
          lastWasConsonant = false;
        } else {
          out += 'ওয়';
          lastWasConsonant = true;
        }
        atSyllableStart = false;
        i += 1;
        continue;
      }
      out += 'ও';
      lastWasConsonant = false;
      atSyllableStart = false;
      i += 1;
      continue;
    }

    // Handle Diphthongs ai / au
    if ((ch === 'a' || ch === 'e') && (lower[i + 1] === 'i' || lower[i + 1] === 'y')) {
      const nextAfter = lower[i + 2];
      if (!nextAfter || !isVowelAt(i + 2)) {
        out += lastWasConsonant ? 'াই' : 'আই';
        lastWasConsonant = false;
        atSyllableStart = false;
        i += 2;
        continue;
      }
    }
    if (ch === 'a' && (lower[i + 1] === 'u' || lower[i + 1] === 'w')) {
      const nextAfter = lower[i + 2];
      if (!nextAfter || !isVowelAt(i + 2)) {
        out += lastWasConsonant ? 'াও' : 'আও';
        lastWasConsonant = false;
        atSyllableStart = false;
        i += 2;
        continue;
      }
    }

    // Handle vowels (longest match)
    const vowelMatch = lower.slice(i).match(/^(aaa|aa|eee|ee|ii|ooo|oo|uu|a|e|i|o|u)/);
    if (vowelMatch) {
      const tok = vowelMatch[1];
      out += lastWasConsonant ? MATRA_VOWELS[tok] : INDEPENDENT_VOWELS[tok];
      lastWasConsonant = false;
      atSyllableStart = false;
      i += tok.length;
      continue;
    }

    // Handle consonants (longest match)
    let matchedConsonant = false;
    for (const [latin, bn] of CONSONANT_MAP) {
      if (lower.startsWith(latin, i)) {
        out += bn;
        lastWasConsonant = true;
        atSyllableStart = false;
        i += latin.length;
        matchedConsonant = true;
        break;
      }
    }
    if (matchedConsonant) continue;

    out += word[i];
    lastWasConsonant = false;
    atSyllableStart = false;
    i += 1;
  }

  return out;
}

/**
 * Converts Quranic Latin transliteration (AlQuran Cloud `en.transliteration`)
 * into clean Bengali pronunciation (আরবীর বাংলা উচ্চারণ).
 */
export function formatBengaliTransliteration(latinText: string): string {
  if (!latinText) return '';
  return latinText
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateWordToBengali(part)))
    .join('')
    .replace(/আ্ল্/g, 'আল')
    .replace(/;;+/g, ';');
}
