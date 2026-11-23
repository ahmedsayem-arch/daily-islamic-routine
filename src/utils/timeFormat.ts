export function formatTime12h(hhmm: string): string {
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) return hhmm;
  const h24 = Number(parts[0]);
  const mins = Number(parts[1]);
  if (!Number.isFinite(h24) || !Number.isFinite(mins)) return hhmm;

  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`;
}

export function formatClock12h(date: Date): string {
  const h24 = date.getHours();
  const mins = date.getMinutes();
  const secs = date.getSeconds();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} ${period}`;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const AR_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function toArabicDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => AR_INDIC_DIGITS[Number(d)] ?? d);
}

const BANGLA_MONTHS = [
  'বৈশাখ',
  'জ্যৈষ্ঠ',
  'আষাঢ়',
  'শ্রাবণ',
  'ভাদ্র',
  'আশ্বিন',
  'কার্তিক',
  'অগ্রহায়ণ',
  'পৌষ',
  'মাঘ',
  'ফাল্গুন',
  'চৈত্র',
];

const BANGLA_WEEKDAYS = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
];

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export interface BanglaDateInfo {
  day: number;
  dayBn: string;
  monthIndex: number;
  monthNameBn: string;
  year: number;
  yearBn: string;
  weekdayBn: string;
  fullBn: string;
}

export interface EnglishDateInfo {
  day: number;
  monthIndex: number;
  monthNameEn: string;
  monthShortEn: string;
  year: number;
  weekdayEn: string;
  fullEn: string;
}

export interface HijriDateInfo {
  day: number;
  dayBn: string;
  dayAr: string;
  monthNumber: number;
  monthNameBn: string;
  monthShortBn: string;
  monthNameAr: string;
  year: number;
  yearBn: string;
  yearAr: string;
  fullBn: string;
  fullAr: string;
}

export function getBanglaDateInfo(date: Date): BanglaDateInfo {
  const gYear = date.getFullYear();
  const todayUtc = Date.UTC(gYear, date.getMonth(), date.getDate());
  const boishakhThisYearUtc = Date.UTC(gYear, 3, 14); // April 14

  let banglaYear: number;
  let startUtc: number;
  let falgunYear: number;

  if (todayUtc >= boishakhThisYearUtc) {
    banglaYear = gYear - 593;
    startUtc = boishakhThisYearUtc;
    falgunYear = gYear + 1;
  } else {
    banglaYear = gYear - 594;
    startUtc = Date.UTC(gYear - 1, 3, 14);
    falgunYear = gYear;
  }

  let dayOffset = Math.floor((todayUtc - startUtc) / 86_400_000);
  const monthLengths = [
    31, // বৈশাখ
    31, // জ্যৈষ্ঠ
    31, // আষাঢ়
    31, // শ্রাবণ
    31, // ভাদ্র
    31, // আশ্বিন
    30, // কার্তিক
    30, // অগ্রহায়ণ
    30, // পৌষ
    30, // মাঘ
    isGregorianLeapYear(falgunYear) ? 30 : 29, // ফাল্গুন
    30, // চৈত্র
  ];

  let monthIdx = 0;
  for (let i = 0; i < monthLengths.length; i++) {
    if (dayOffset < monthLengths[i]) {
      monthIdx = i;
      break;
    }
    dayOffset -= monthLengths[i];
  }

  const banglaDay = dayOffset + 1;
  const weekdayBn = BANGLA_WEEKDAYS[date.getDay()] || '';
  const monthNameBn = BANGLA_MONTHS[monthIdx];
  const dayBn = toBanglaDigits(banglaDay);
  const yearBn = toBanglaDigits(banglaYear);

  return {
    day: banglaDay,
    dayBn,
    monthIndex: monthIdx,
    monthNameBn,
    year: banglaYear,
    yearBn,
    weekdayBn,
    fullBn: `${weekdayBn}, ${dayBn} ${monthNameBn} ${yearBn} বঙ্গাব্দ`,
  };
}

/**
 * Official Bangladesh (Bangla Academy revised 2019) solar calendar conversion.
 */
export function getBanglaCalendarDateBn(date: Date): string {
  const info = getBanglaDateInfo(date);
  return `${info.weekdayBn}, ${info.dayBn} ${info.monthNameBn} ${info.yearBn}`;
}

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const EN_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_DAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function getEnglishDateInfo(date: Date): EnglishDateInfo {
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const monthNameEn = EN_MONTHS_FULL[monthIndex] || '';
  const monthShortEn = EN_MONTHS[monthIndex] || '';
  const weekdayEn = EN_DAYS_FULL[date.getDay()] || '';
  return {
    day,
    monthIndex,
    monthNameEn,
    monthShortEn,
    year,
    weekdayEn,
    fullEn: `${weekdayEn}, ${day} ${monthNameEn} ${year}`,
  };
}

export function getEnglishCalendarDate(date: Date): string {
  const dayName = EN_DAYS[date.getDay()] || '';
  const day = date.getDate();
  const month = EN_MONTHS[date.getMonth()] || '';
  const year = date.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

const HIJRI_MONTHS_BN = [
  'মুহররম',
  'সফর',
  'রবিউল আউয়াল',
  'রবিউস সানি',
  'জুমাদাল উলা',
  'জুমাদাল আখিরাহ',
  'রজব',
  'শাবান',
  'রমজান',
  'শাওয়াল',
  'জিলকদ',
  'জিলহজ',
];

const HIJRI_MONTHS_SHORT_BN = [
  'মুহরঃ',
  'সফর',
  'রবিঃ১',
  'রবিঃ২',
  'জুমঃ১',
  'জুমঃ২',
  'রজব',
  'শাবান',
  'রমজান',
  'শাওঃ',
  'জিলকদ',
  'জিলহজ',
];

const HIJRI_MONTHS_AR = [
  'مُحَرَّم',
  'صَفَر',
  'رَبِيع الأَوَّل',
  'رَبِيع الثَّانِي',
  'جُمَادَى الأُولَى',
  'جُمَادَى الآخِرَة',
  'رَجَب',
  'شَعْبَان',
  'رَمَضَان',
  'شَوَّال',
  'ذُو القَعْدَة',
  'ذُو الحِجَّة',
];

export function formatHijriFromParts(
  dayNum: number,
  monthNum: number,
  yearNum: number,
  monthArOverride?: string
): { bn: string; ar: string } {
  const idx = Math.max(0, Math.min(11, (monthNum || 1) - 1));
  const monthBn = HIJRI_MONTHS_BN[idx];
  const monthAr = monthArOverride || HIJRI_MONTHS_AR[idx];
  return {
    bn: `${toBanglaDigits(dayNum)} ${monthBn} ${toBanglaDigits(yearNum)} হিজরি`,
    ar: `${toArabicDigits(dayNum)} ${monthAr} ${toArabicDigits(yearNum)} هـ`,
  };
}

function getRawIntlHijriParts(date: Date): { day: number; month: number; year: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(date);
    const day = Number(parts.find((p) => p.type === 'day')?.value || 1);
    const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
    const year = Number(parts.find((p) => p.type === 'year')?.value || 1448);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      return { day, month, year };
    }
  } catch {
    // fallback below
  }
  return { day: 1, month: 1, year: 1448 };
}

export function getHijriDateInfo(date: Date, dayAdjustment = 0): HijriDateInfo {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayAdjustment);
  const { day, month, year } = getRawIntlHijriParts(target);
  const idx = Math.max(0, Math.min(11, month - 1));
  const monthNameBn = HIJRI_MONTHS_BN[idx];
  const monthShortBn = HIJRI_MONTHS_SHORT_BN[idx];
  const monthNameAr = HIJRI_MONTHS_AR[idx];
  const dayBn = toBanglaDigits(day);
  const dayAr = toArabicDigits(day);
  const yearBn = toBanglaDigits(year);
  const yearAr = toArabicDigits(year);

  return {
    day,
    dayBn,
    dayAr,
    monthNumber: month,
    monthNameBn,
    monthShortBn,
    monthNameAr,
    year,
    yearBn,
    yearAr,
    fullBn: `${dayBn} ${monthNameBn} ${yearBn} হিজরি`,
    fullAr: `${dayAr} ${monthNameAr} ${yearAr} هـ`,
  };
}

export function computeHijriAlignmentOffset(
  apiHijri: { day: number; month: number; year: number } | undefined,
  today: Date
): number {
  if (!apiHijri) return 0;
  for (const offset of [0, 1, -1, 2, -2]) {
    const candidate = getRawIntlHijriParts(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    );
    if (
      candidate.day === apiHijri.day &&
      candidate.month === apiHijri.month &&
      candidate.year === apiHijri.year
    ) {
      return offset;
    }
  }
  return 0;
}

export function getFallbackHijriDate(date: Date): {
  bn: string;
  ar: string;
  parts: { day: number; month: number; year: number };
} {
  const parts = getRawIntlHijriParts(date);
  const formatted = formatHijriFromParts(parts.day, parts.month, parts.year);
  return {
    bn: formatted.bn,
    ar: formatted.ar,
    parts,
  };
}
