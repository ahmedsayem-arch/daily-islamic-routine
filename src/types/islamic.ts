export type ActiveTab = 'routine' | 'quran' | 'hadith' | 'seerah' | 'ruqyah' | 'settings';

export type RoutinePeriod =
  | 'dawn'
  | 'day'
  | 'evening'
  | 'night'
  | 'fajr'
  | 'dhuhr'
  | 'asr'
  | 'maghrib'
  | 'isha';

export type RoutineWaqt = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PrayerReminderToggles {
  Fajr: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
}

export interface RoutineReminderItem {
  enabled: boolean;
  time: string;
}

export type AppThemeId = 'emerald' | 'daylight' | 'tahajjud' | 'cream';

export type ArabicFontId = 'scheherazade' | 'amiri_quran' | 'noto_naskh' | 'lateef';

export interface FavoriteGroup {
  id: string;
  name: string;
  createdAt: number;
}

export interface FavoriteAyahEntry {
  key: string;
  surah: number;
  ayah: number;
  surahNameBn: string;
  arabic: string;
  tajweedArabic?: string;
  bengaliTranslit?: string;
  bengali: string;
  english?: string;
  groupIds?: string[];
  savedAt: number;
}

export interface AppSettings {
  arabicFontSize: number;
  arabicFont: ArabicFontId;
  tajweedColorCoding: boolean;
  showArabic: boolean;
  showBengaliTransliteration: boolean;
  showBengaliTranslation: boolean;
  showEnglishTranslation: boolean;
  prayerMethod: number;
  prayerSchool: 0 | 1;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  prayerLeadMinutes: number;
  prayerReminders: PrayerReminderToggles;
  routineReminders: {
    morningAzkar: RoutineReminderItem;
    eveningAzkar: RoutineReminderItem;
    sleepSunnah: RoutineReminderItem;
  };
}

export interface RoutineSubPart {
  id: string;
  label: string;
}

export interface RoutineTask {
  id: string;
  title: string;
  subtitle: string;
  period: RoutinePeriod;
  waqt?: RoutineWaqt;
  timeHint: string;
  points: number;
  linkedTab?: ActiveTab;
  ruqyahSubTab?: 'ruqyah' | 'manzil' | 'azkar';
  azkarTimeFilter?: 'all' | 'morning' | 'evening';
  subParts?: RoutineSubPart[];
}

export interface PrayerTimeEntry {
  key: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
  labelBn: string;
  time: string;
}

export interface CityPreset {
  id: string;
  nameBn: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface QariReciter {
  id: string;
  nameBn: string;
  nameEn: string;
  everyAyahFolder: string;
  alquranCloudEdition: string;
  styleBn: string;
  bitrateLabel: string;
  countryBn: string;
}

export interface SurahSummary {
  number: number;
  nameAr: string;
  nameBn: string;
  meaningBn: string;
  ayahCount: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface QuranAyahPair {
  numberInSurah: number;
  globalNumber: number;
  arabic: string;
  tajweedArabic?: string;
  bengaliTranslit?: string;
  bengali: string;
  english?: string;
  audioUrl: string;
}

export interface AzkarEntry {
  id: string;
  category: 'morning' | 'evening' | 'both' | 'sleep' | 'prayer' | 'daily';
  titleBn: string;
  arabic: string;
  transliterationBn: string;
  meaningBn: string;
  virtueBn?: string;
  reference: string;
  repeatTarget: number;
  audioRefs?: Array<{ surah: number; ayah: number }>;
}

export interface AyahRef {
  surah: number;
  ayah: number;
  surahNameBn: string;
}

export interface AudioTrackItem {
  id: string;
  titleBn: string;
  subtitleBn: string;
  arabic?: string;
  tajweedArabic?: string;
  bengaliTranslit?: string;
  meaningBn?: string;
  englishMeaning?: string;
  audioUrl: string;
  surah: number;
  ayah: number;
}

export interface RuqyahProgram {
  id: string;
  titleBn: string;
  subtitleBn: string;
  durationHint: string;
  purposeBn: string;
  category: 'shariah' | 'nazar' | 'manzil' | 'sakina' | 'shifa';
  verses: AyahRef[];
}

export type HadithBookId =
  | 'riyad-salihin'
  | 'hadeethenc'
  | 'ben-bukhari'
  | 'ben-muslim'
  | 'ben-abudawud'
  | 'ben-tirmidhi'
  | 'ben-nasai'
  | 'ben-ibnmajah'
  | 'ben-malik'
  | 'ben-nawawi';

export interface HadithBookMeta {
  id: HadithBookId;
  nameBn: string;
  compilerBn: string;
  badgeBn?: string;
  sections: Array<{ sectionNumber: number; titleBn: string }>;
}

export interface HadithEntry {
  hadithnumber: number | string;
  text: string;
  arabic?: string;
  english?: string;
  explanationBn?: string;
  bookNameBn: string;
  chapterBn: string;
  gradeBn?: string;
}

export interface SeerahChapter {
  id: string;
  number: number;
  titleBn: string;
  periodBn: string;
  summaryBn: string;
  paragraphsBn: string[];
  lessonsBn: string[];
  sourceBn: string;
}

export interface FullBookSection {
  id: string;
  number: number;
  titleBn: string;
  paragraphs: string[];
}

export interface IslamHouseBookItem {
  id: number | string;
  title: string;
  description: string;
  category: 'seerah' | 'hadith' | 'azkar';
  categoryLabelBn: string;
  pdfUrl: string;
  fileSize?: string;
  sourceLabelBn: string;
}

export interface TasbihPreset {
  id: string;
  arabic: string;
  labelBn: string;
  meaningBn: string;
  defaultTarget: number;
}
