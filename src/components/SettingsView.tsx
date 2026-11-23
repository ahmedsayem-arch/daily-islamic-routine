import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Headphones,
  Languages,
  MapPin,
  Mic,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  X,
} from 'lucide-react';
import {
  CITY_PRESETS,
  PRAYER_CALCULATION_METHODS,
  QARI_RECITERS,
} from '../data/islamicData';
import type { NotificationPermState } from '../hooks/usePrayerNotifications';
import type {
  AppSettings,
  AppThemeId,
  PrayerTimeEntry,
  QariReciter,
} from '../types/islamic';
import { PWAInstallButton } from './PWAInstallButton';
import { TajweedArabicText } from './TajweedArabicText';
import { VoiceSelectorSection } from './VoiceSelectorSection';
import { TAJWEED_COLOR_CLASSES, TAJWEED_LEGEND } from '../utils/quranFormatting';
import {
  APP_THEMES,
  ARABIC_FONT_OPTIONS,
  getArabicFontCss,
} from '../utils/playerThemes';
import {
  ARABIC_VOICE_MODES,
  useSpeechPlayer,
  VOICE_PROFILES,
} from '../utils/speechPlayer';
import { formatTime12h } from '../utils/timeFormat';

interface SettingsViewProps {
  appTheme: AppThemeId;
  selectedQari: QariReciter;
  selectedCityId: string;
  isLooping: boolean;
  settings: AppSettings;
  prayers: PrayerTimeEntry[];
  notifPermission: NotificationPermState;
  onChangeTheme: (theme: AppThemeId) => void;
  onChangeQari: (qari: QariReciter) => void;
  onChangeCityId: (cityId: string) => void;
  onToggleLoop: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleMasterNotification: () => void;
  onResetDefaults: () => void;
}

type PickerModalType =
  | null
  | 'theme'
  | 'font'
  | 'fontSize'
  | 'display'
  | 'qari'
  | 'voice'
  | 'city'
  | 'method'
  | 'school'
  | 'lead'
  | 'prayers'
  | 'routines';

const PRAYER_REMINDER_LIST: Array<{
  key: keyof AppSettings['prayerReminders'];
  labelBn: string;
}> = [
  { key: 'Fajr', labelBn: 'ফজর' },
  { key: 'Dhuhr', labelBn: 'যোহর' },
  { key: 'Asr', labelBn: 'আসর' },
  { key: 'Maghrib', labelBn: 'মাগরিব' },
  { key: 'Isha', labelBn: 'ইশা' },
];

const ROUTINE_REMINDER_LIST: Array<{
  key: keyof AppSettings['routineReminders'];
  labelBn: string;
  descBn: string;
}> = [
  {
    key: 'morningAzkar',
    labelBn: 'সকালের মাসনুন যিকির',
    descBn: 'আয়াতুল কুরসি, ৩ কুল ও সকালের দুআ',
  },
  {
    key: 'eveningAzkar',
    labelBn: 'সন্ধ্যার যিকির ও ৩৩ আয়াত',
    descBn: 'সন্ধ্যার হেফাজতের আমল ও রুকাইয়া',
  },
  {
    key: 'sleepSunnah',
    labelBn: 'রাতের আমল ও সূরা মুলক',
    descBn: 'সূরা বাকারার শেষ ২ আয়াত ও তাসবিহ',
  },
];

const LEAD_TIME_OPTIONS = [
  { mins: 0, label: 'ঠিক ওয়াক্তে' },
  { mins: 5, label: '৫ মিনিট আগে' },
  { mins: 10, label: '১০ মিনিট আগে' },
  { mins: 15, label: '১৫ মিনিট আগে' },
];

const FONT_SIZE_PRESETS = [22, 24, 26, 28, 32, 36, 40];

function getPermissionStatusLabel(perm: NotificationPermState): string {
  switch (perm) {
    case 'granted':
      return 'ব্রাউজার অনুমতি: অনুমোদিত';
    case 'denied':
      return 'ব্রাউজার অনুমতি: বন্ধ (অ্যাপের ভেতরে অ্যালার্ট পাবেন)';
    case 'unsupported':
      return 'অ্যাপ-ভিত্তিক রিমাইন্ডার সক্রিয়';
    default:
      return 'চালু করলে সময়মতো রিমাইন্ডার পাবেন';
  }
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appTheme,
  selectedQari,
  selectedCityId,
  isLooping,
  settings,
  prayers,
  notifPermission,
  onChangeTheme,
  onChangeQari,
  onChangeCityId,
  onToggleLoop,
  onUpdateSettings,
  onToggleMasterNotification,
  onResetDefaults,
}) => {
  const [activeModal, setActiveModal] = useState<PickerModalType>(null);
  const [resetDone, setResetDone] = useState(false);
  const speechSnap = useSpeechPlayer();

  const activeVoiceProfile = useMemo(
    () =>
      VOICE_PROFILES.find((v) => v.id === speechSnap.voicePrefs.profile) ||
      VOICE_PROFILES[0],
    [speechSnap.voicePrefs.profile]
  );

  const activeArabicVoiceMode = useMemo(
    () =>
      ARABIC_VOICE_MODES.find((a) => a.id === speechSnap.voicePrefs.arabicMode) ||
      ARABIC_VOICE_MODES[0],
    [speechSnap.voicePrefs.arabicMode]
  );

  const activeThemeMeta = useMemo(
    () => APP_THEMES.find((t) => t.id === appTheme) || APP_THEMES[0],
    [appTheme]
  );

  const activeFontMeta = useMemo(
    () =>
      ARABIC_FONT_OPTIONS.find((f) => f.id === settings.arabicFont) ||
      ARABIC_FONT_OPTIONS[0],
    [settings.arabicFont]
  );

  const activeCity = useMemo(
    () => CITY_PRESETS.find((c) => c.id === selectedCityId) || CITY_PRESETS[0],
    [selectedCityId]
  );

  const activeMethod = useMemo(
    () =>
      PRAYER_CALCULATION_METHODS.find((m) => m.id === settings.prayerMethod) ||
      PRAYER_CALCULATION_METHODS[0],
    [settings.prayerMethod]
  );

  const displaySummary = useMemo(() => {
    const parts: string[] = [];
    if (settings.showArabic) parts.push('আরবি');
    if (settings.showBengaliTransliteration) parts.push('উচ্চারণ');
    if (settings.showBengaliTranslation) parts.push('বাংলা');
    if (settings.showEnglishTranslation) parts.push('English');
    if (settings.tajweedColorCoding) parts.push('তাজবীদ');
    return parts.length > 0 ? parts.join(' · ') : 'কোনোটিই নির্বাচিত নয়';
  }, [settings]);

  const activePrayerCount = useMemo(
    () => PRAYER_REMINDER_LIST.filter((p) => settings.prayerReminders[p.key]).length,
    [settings.prayerReminders]
  );

  const activeRoutineSummary = useMemo(() => {
    const activeItems = ROUTINE_REMINDER_LIST.filter(
      (r) => settings.routineReminders[r.key].enabled
    );
    if (activeItems.length === 0) return 'সব বন্ধ আছে';
    return `${activeItems.length}টি আমল চালু · ${activeItems
      .map((r) => formatTime12h(settings.routineReminders[r.key].time))
      .join(', ')}`;
  }, [settings.routineReminders]);

  const activeLeadLabel =
    LEAD_TIME_OPTIONS.find((o) => o.mins === settings.prayerLeadMinutes)?.label ||
    'ঠিক ওয়াক্তে';

  const handleReset = () => {
    onResetDefaults();
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2200);
  };

  const rowButtonClass =
    'flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-2.5 text-left transition-colors hover:border-[#0D6E52]/35 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35';

  return (
    <div className="space-y-5">
      {/* Settings Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/25 bg-[#063D34] bg-gradient-to-br from-[#08463B] via-[#052B24] to-[#031714] p-6 text-white shadow-[0_18px_44px_rgba(4,28,23,0.25)] md:p-7">
        <div
          className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold text-[#F2D58E]">
              সহজ ট্যাপ-টু-সিলেক্ট নিয়ন্ত্রণ
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
              অ্যাপ সেটিংস ও পছন্দসমূহ
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#D0E2DC] md:text-sm">
              যেকোনো অপশনে চাপ দিলেই তালিকা খুলে যাবে। আপনার পছন্দ অনুযায়ী থিম, ফন্ট, ক্বারী ও নোটিফিকেশন সহজেই বাছাই করুন।
            </p>
          </div>

          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Card 1: Appearance, Theme Color & Quran Reading */}
        <section className="glass-card space-y-2.5 rounded-3xl p-5 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2.5 border-b border-black/8 pb-3 dark:border-white/10">
            <Palette className="h-5 w-5 text-[#0D6E52] dark:text-[#E7C57B]" />
            <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
              থিম কালার ও কুরআন পাঠ
            </h2>
          </div>

          {/* 1. Theme Color Selector */}
          <button
            type="button"
            onClick={() => setActiveModal('theme')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-7 w-7 shrink-0 rounded-full border border-black/15 shadow-xs dark:border-white/25"
                style={{
                  background: `linear-gradient(135deg, ${activeThemeMeta.bgSwatch} 55%, ${activeThemeMeta.accentSwatch} 55%)`,
                }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  অ্যাপের কালার (থিম)
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activeThemeMeta.descBn}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-lg bg-[#0D6E52]/10 px-2.5 py-1 text-xs font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                {activeThemeMeta.labelBn}
              </span>
              <ChevronRight className="h-4 w-4 text-[#475A53] dark:text-[#9BB0A8]" />
            </div>
          </button>

          {/* 2. Arabic Font Selector */}
          <button
            type="button"
            onClick={() => setActiveModal('font')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <BookOpen className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  আরবি কুরআন ফন্ট
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activeFontMeta.nameBn}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                dir="rtl"
                className="text-base text-[#063D34] dark:text-[#F6DC9B]"
                style={{ fontFamily: getArabicFontCss(settings.arabicFont) }}
              >
                الْحَمْدُ لِلَّهِ
              </span>
              <ChevronRight className="h-4 w-4 text-[#475A53] dark:text-[#9BB0A8]" />
            </div>
          </button>

          {/* 3. Arabic Font Size Selector */}
          <button
            type="button"
            onClick={() => setActiveModal('fontSize')}
            className={rowButtonClass}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                আরবি লিপির আকার
              </p>
              <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                কুরআন ও ভিজ্যুয়াল প্লেয়ারের সাইজ
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono-num rounded-lg bg-[#0D6E52]/10 px-2.5 py-1 text-xs font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                {settings.arabicFontSize} px
              </span>
              <ChevronRight className="h-4 w-4 text-[#475A53] dark:text-[#9BB0A8]" />
            </div>
          </button>

          {/* 4. Language & Tajweed Display Selector */}
          <button
            type="button"
            onClick={() => setActiveModal('display')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Languages className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  ভাষা ও তাজবীদ কালার
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {displaySummary}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>
        </section>

        {/* Card 2: Audio Qari, City & Prayer Schedule Settings */}
        <section className="glass-card space-y-2.5 rounded-3xl p-5 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2.5 border-b border-black/8 pb-3 dark:border-white/10">
            <Headphones className="h-5 w-5 text-[#0D6E52] dark:text-[#E7C57B]" />
            <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
              ক্বারী, শহর ও নামাজের হিসাব
            </h2>
          </div>

          {/* 1. Qari / Raqi Picker */}
          <button
            type="button"
            onClick={() => setActiveModal('qari')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Headphones className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  পছন্দের ক্বারী ও রাক্বী
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {selectedQari.nameBn} · {selectedQari.countryBn}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>

          {/* 1b. Speech Narration Voice Picker */}
          <button
            type="button"
            onClick={() => setActiveModal('voice')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Mic className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  অডিও ভয়েস (হাদিস / সীরাত / যিকির)
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  আরবি: {activeArabicVoiceMode.shortLabelBn} · বাংলা: {activeVoiceProfile.shortLabelBn}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>

          {/* 2. City Picker */}
          <button
            type="button"
            onClick={() => setActiveModal('city')}
            className={rowButtonClass}
          >
            <div className="flex min-w-0 items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  ডিফল্ট শহর
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activeCity.nameBn} ({activeCity.country})
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>

          {/* 3. Prayer Calculation Method Picker */}
          <button
            type="button"
            onClick={() => setActiveModal('method')}
            className={rowButtonClass}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                নামাজের হিসাব পদ্ধতি
              </p>
              <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                {activeMethod.nameBn}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>

          {/* 4. Asr School (Mazhab) Picker */}
          <button
            type="button"
            onClick={() => setActiveModal('school')}
            className={rowButtonClass}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                আসরের ওয়াক্তের মাযহাব
              </p>
              <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                {settings.prayerSchool === 1
                  ? 'হানাফি (বাংলাদেশ প্রচলিত)'
                  : 'শাফেয়ী / হাম্বলি / মালিকি'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
          </button>

          {/* 5. Audio Loop Quick Toggle */}
          <div className={rowButtonClass}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                অডিও পুনরাবৃত্তি (Loop)
              </p>
              <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                রুকাইয়া বা সূরা শেষ হলে আবার চলবে
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleLoop}
              className={`min-h-[38px] min-w-[78px] shrink-0 rounded-xl px-3 text-xs font-bold transition-colors ${
                isLooping
                  ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                  : 'border border-black/10 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
              }`}
            >
              {isLooping ? 'চালু' : 'বন্ধ'}
            </button>
          </div>
        </section>

        {/* Card 3: Prayer & Daily Routine Notifications */}
        <section className="glass-card space-y-3 rounded-3xl p-5 lg:col-span-12">
          <div className="flex flex-col justify-between gap-3 border-b border-black/8 pb-3.5 dark:border-white/10 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              {settings.notificationsEnabled ? (
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              ) : (
                <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-[#7A8E86]" />
              )}
              <div>
                <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  নামাজ ও আমলের নোটিফিকেশন
                </h2>
                <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {getPermissionStatusLabel(notifPermission)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleMasterNotification}
              className={`flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
                settings.notificationsEnabled
                  ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm'
                  : 'border border-black/10 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
              }`}
            >
              {settings.notificationsEnabled ? (
                <>
                  <Bell className="h-4 w-4" />
                  <span>চালু আছে (বন্ধ করুন)</span>
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" />
                  <span>বন্ধ (চালু করুন)</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {/* Lead time Picker */}
            <button
              type="button"
              onClick={() => setActiveModal('lead')}
              className={rowButtonClass}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  নামাজের কত আগে রিমাইন্ডার
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activeLeadLabel}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
            </button>

            {/* Notification Sound Toggle */}
            <div className={rowButtonClass}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Volume2 className="h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                    নোটিফিকেশন শব্দ
                  </p>
                  <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    অ্যালার্টের সাথে মৃদু ধ্বনি বাজবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ notificationSound: !settings.notificationSound })
                }
                className={`min-h-[38px] min-w-[78px] shrink-0 rounded-xl px-3 text-xs font-bold transition-colors ${
                  settings.notificationSound
                    ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                    : 'border border-black/10 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
                }`}
              >
                {settings.notificationSound ? 'চালু' : 'বন্ধ'}
              </button>
            </div>

            {/* 5 Daily Prayers Individual Selector */}
            <button
              type="button"
              onClick={() => setActiveModal('prayers')}
              className={rowButtonClass}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  ৫ ওয়াক্ত নামাজের রিমাইন্ডার
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activePrayerCount}টি ওয়াক্ত চালু আছে (চাপ দিয়ে নির্বাচন করুন)
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
            </button>

            {/* Daily Azkar & Ruqyah Time Selector */}
            <button
              type="button"
              onClick={() => setActiveModal('routines')}
              className={rowButtonClass}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  দৈনিক যিকির ও রুকাইয়ার সময়
                </p>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  {activeRoutineSummary}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
            </button>
          </div>
        </section>

        {/* Card 4: Data Management & App Reset */}
        <section className="glass-card rounded-3xl p-5 lg:col-span-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <div>
                <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  তথ্য সংরক্ষণ ও ডিফল্ট সেটিংস
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                  আপনার নামাজের রুটিন, ফেভারিট আয়াত এবং সকল ব্যক্তিগত পছন্দ কেবল আপনার নিজস্ব ডিভাইসেই নিরাপদভাবে সংরক্ষিত থাকে।
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <PWAInstallButton variant="surface" />

              <button
                type="button"
                onClick={handleReset}
                className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/85 px-4 text-xs font-bold text-[#0F1F1A] transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
              >
                <RotateCcw className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                <span>{resetDone ? 'ডিফল্ট রিসেট সম্পন্ন' : 'সেটিংস ডিফল্ট করুন'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* UNIFIED TAP-TO-SELECT MODAL */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-xs sm:items-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-card flex max-h-[82vh] w-full max-w-lg flex-col rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-black/8 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                {activeModal === 'theme' && 'অ্যাপের কালার (থিম) নির্বাচন করুন'}
                {activeModal === 'font' && 'আরবি কুরআন ফন্ট নির্বাচন করুন'}
                {activeModal === 'fontSize' && 'আরবি লিপির আকার নির্ধারণ করুন'}
                {activeModal === 'display' && 'ভাষা ও তাজবীদ কালার নির্বাচন করুন'}
                {activeModal === 'qari' && 'পছন্দের ক্বারী ও রাক্বী বাছাই করুন'}
                {activeModal === 'voice' && 'পঠন ও অডিও ভয়েস পরিবর্তন করুন'}
                {activeModal === 'city' && 'ডিফল্ট শহর নির্বাচন করুন'}
                {activeModal === 'method' && 'নামাজের হিসাব পদ্ধতি বাছাই করুন'}
                {activeModal === 'school' && 'আসরের ওয়াক্তের মাযহাব'}
                {activeModal === 'lead' && 'নামাজের কত আগে রিমাইন্ডার চান?'}
                {activeModal === 'prayers' && '৫ ওয়াক্ত নামাজের রিমাইন্ডার'}
                {activeModal === 'routines' && 'দৈনিক যিকির ও রুকাইয়ার সময়'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {activeModal === 'theme' &&
                APP_THEMES.map((themeOpt) => {
                  const selected = appTheme === themeOpt.id;
                  return (
                    <button
                      key={themeOpt.id}
                      type="button"
                      onClick={() => {
                        onChangeTheme(themeOpt.id);
                        setActiveModal(null);
                      }}
                      className={`flex min-h-[58px] w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all ${
                        selected
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 dark:border-[#E7C57B]/75 dark:bg-[#063D34]/75'
                          : 'border-black/8 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className="h-9 w-9 shrink-0 rounded-full border border-black/15 shadow-xs dark:border-white/25"
                        style={{
                          background: `linear-gradient(135deg, ${themeOpt.bgSwatch} 55%, ${themeOpt.accentSwatch} 55%)`,
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {themeOpt.labelBn}
                        </p>
                        <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                          {themeOpt.descBn}
                        </p>
                      </div>
                      {selected && (
                        <Check className="h-5 w-5 shrink-0 text-[#0D6E52] dark:text-[#F6DC9B]" />
                      )}
                    </button>
                  );
                })}

              {activeModal === 'font' &&
                ARABIC_FONT_OPTIONS.map((fontOpt) => {
                  const selected = settings.arabicFont === fontOpt.id;
                  return (
                    <button
                      key={fontOpt.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ arabicFont: fontOpt.id });
                        setActiveModal(null);
                      }}
                      className={`flex w-full flex-col gap-1 rounded-2xl border p-3.5 text-left transition-all ${
                        selected
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 dark:border-[#E7C57B]/75 dark:bg-[#063D34]/75'
                          : 'border-black/8 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {fontOpt.nameBn}
                        </span>
                        {selected && (
                          <Check className="h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#F6DC9B]" />
                        )}
                      </div>
                      <p
                        dir="rtl"
                        className="text-right text-xl text-[#063D34] dark:text-[#F6DC9B]"
                        style={{ fontFamily: getArabicFontCss(fontOpt.id), lineHeight: 1.75 }}
                      >
                        الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
                      </p>
                      <p className="text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                        {fontOpt.descBn}
                      </p>
                    </button>
                  );
                })}

              {activeModal === 'fontSize' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {FONT_SIZE_PRESETS.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onUpdateSettings({ arabicFontSize: sz })}
                        className={`font-mono-num min-h-[42px] flex-1 rounded-xl border px-3 text-xs font-bold transition-colors ${
                          settings.arabicFontSize === sz
                            ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/60'
                            : 'border-black/10 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'
                        }`}
                      >
                        {sz} px
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          arabicFontSize: Math.max(20, settings.arabicFontSize - 2),
                        })
                      }
                      className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-black/10 bg-black/[0.03] font-bold text-[#0F1F1A] dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={20}
                      max={42}
                      step={2}
                      value={settings.arabicFontSize}
                      onChange={(e) =>
                        onUpdateSettings({ arabicFontSize: Number(e.target.value) })
                      }
                      className="h-2 flex-1 cursor-pointer accent-[#0D6E52] dark:accent-[#D4A853]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          arabicFontSize: Math.min(42, settings.arabicFontSize + 2),
                        })
                      }
                      className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-black/10 bg-black/[0.03] font-bold text-[#0F1F1A] dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
                    >
                      +
                    </button>
                  </div>

                  <div className="rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.03]">
                    <TajweedArabicText
                      plainArabic="بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
                      tajweedArabic="بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h:3[ٱ][l[ل]رَّح[p[ِي]مِ"
                      enableTajweed={settings.tajweedColorCoding}
                      className="font-arabic text-[#0F1F1A] dark:text-[#F0F5F3]"
                      style={{ fontSize: `${settings.arabicFontSize}px`, lineHeight: 2.0 }}
                    />
                  </div>
                </div>
              )}

              {activeModal === 'display' && (
                <div className="space-y-2.5">
                  {[
                    {
                      key: 'tajweedColorCoding' as const,
                      title: 'তাজবীদ কালার কোডিং',
                      desc: 'গুন্নাহ, কলকলাহ, মদ, ইখফা অক্ষরে আলাদা রঙ',
                    },
                    {
                      key: 'showArabic' as const,
                      title: 'আরবি (মূল আয়াত)',
                      desc: 'কুরআনের উসমানি আরবি লিপি প্রদর্শন',
                    },
                    {
                      key: 'showBengaliTransliteration' as const,
                      title: 'আরবীর বাংলা উচ্চারণ',
                      desc: 'আরবি আয়াতের সাথে বাংলায় উচ্চারণ',
                    },
                    {
                      key: 'showBengaliTranslation' as const,
                      title: 'বাংলা অনুবাদ',
                      desc: 'আয়াতের বাংলা অর্থ প্রদর্শন',
                    },
                    {
                      key: 'showEnglishTranslation' as const,
                      title: 'ইংরেজি অনুবাদ (English)',
                      desc: 'Sahih International ইংরেজি অর্থ প্রদর্শন',
                    },
                  ].map((opt) => {
                    const enabled = settings[opt.key];
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => onUpdateSettings({ [opt.key]: !enabled })}
                        className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                          enabled
                            ? 'border-[#0D6E52] bg-[#0D6E52]/10 dark:border-[#E7C57B]/50 dark:bg-[#063D34]/60'
                            : 'border-black/8 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.03]'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {opt.title}
                          </p>
                          <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                            {opt.desc}
                          </p>
                        </div>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            enabled
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'bg-black/8 text-[#475A53] dark:bg-white/10 dark:text-[#9BB0A8]'
                          }`}
                        >
                          {enabled ? 'চালু' : 'বন্ধ'}
                        </span>
                      </button>
                    );
                  })}

                  {settings.tajweedColorCoding && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-2xl border border-black/8 bg-black/[0.025] p-3 text-[11px] font-semibold dark:border-white/10 dark:bg-white/[0.03]">
                      {TAJWEED_LEGEND.map((item) => (
                        <span
                          key={item.category}
                          className={TAJWEED_COLOR_CLASSES[item.category]}
                        >
                          ● {item.labelBn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModal === 'qari' &&
                QARI_RECITERS.map((qari) => {
                  const active = selectedQari.id === qari.id;
                  return (
                    <button
                      key={qari.id}
                      type="button"
                      onClick={() => {
                        onChangeQari(qari);
                        setActiveModal(null);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                        active
                          ? 'border-[#E7C57B]/70 bg-gradient-to-br from-[#063D34] to-[#0A5749] text-white'
                          : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-bold ${
                            active ? 'text-[#F6DC9B]' : 'text-[#0F1F1A] dark:text-[#F0F5F3]'
                          }`}
                        >
                          {qari.nameBn}
                        </p>
                        <p
                          className={`text-xs ${
                            active ? 'text-[#D6ECE5]' : 'text-[#475A53] dark:text-[#9BB0A8]'
                          }`}
                        >
                          {qari.styleBn} · {qari.countryBn}
                        </p>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#F6DC9B]" />}
                    </button>
                  );
                })}

              {activeModal === 'voice' && <VoiceSelectorSection />}

              {activeModal === 'city' &&
                CITY_PRESETS.map((city) => {
                  const active = selectedCityId === city.id;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => {
                        onChangeCityId(city.id);
                        setActiveModal(null);
                      }}
                      className={`flex min-h-[50px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition-colors ${
                        active
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                          : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      <span>
                        {city.nameBn} ({city.country})
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}

              {activeModal === 'method' &&
                PRAYER_CALCULATION_METHODS.map((m) => {
                  const active = settings.prayerMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ prayerMethod: m.id });
                        setActiveModal(null);
                      }}
                      className={`flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold transition-colors sm:text-sm ${
                        active
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                          : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      <span>{m.nameBn}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}

              {activeModal === 'school' &&
                [
                  { id: 1 as const, label: 'হানাফি (বাংলাদেশ প্রচলিত)' },
                  { id: 0 as const, label: 'শাফেয়ী / হাম্বলি / মালিকি' },
                ].map((opt) => {
                  const active = settings.prayerSchool === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ prayerSchool: opt.id });
                        setActiveModal(null);
                      }}
                      className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition-colors ${
                        active
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                          : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}

              {activeModal === 'lead' &&
                LEAD_TIME_OPTIONS.map((opt) => {
                  const active = settings.prayerLeadMinutes === opt.mins;
                  return (
                    <button
                      key={opt.mins}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ prayerLeadMinutes: opt.mins });
                        setActiveModal(null);
                      }}
                      className={`flex min-h-[50px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition-colors ${
                        active
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                          : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}

              {activeModal === 'prayers' &&
                PRAYER_REMINDER_LIST.map((item) => {
                  const enabled = settings.prayerReminders[item.key];
                  const prayerTime = prayers.find((p) => p.key === item.key)?.time || '--:--';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          prayerReminders: {
                            ...settings.prayerReminders,
                            [item.key]: !enabled,
                          },
                        })
                      }
                      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-2 text-left dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {item.labelBn}
                        </p>
                        <p className="font-mono-num text-xs text-[#475A53] dark:text-[#9BB0A8]">
                          আজকের সময়: {formatTime12h(prayerTime)}
                        </p>
                      </div>
                      <span
                        className={`min-w-[68px] rounded-xl px-3 py-1.5 text-center text-xs font-bold ${
                          enabled
                            ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                            : 'border border-black/10 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
                        }`}
                      >
                        {enabled ? 'চালু' : 'বন্ধ'}
                      </span>
                    </button>
                  );
                })}

              {activeModal === 'routines' &&
                ROUTINE_REMINDER_LIST.map((item) => {
                  const cfg = settings.routineReminders[item.key];
                  return (
                    <div
                      key={item.key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-black/[0.025] p-3.5 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {item.labelBn}
                        </p>
                        <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                          {item.descBn} ·{' '}
                          <span className="font-mono-num font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                            {formatTime12h(cfg.time)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2.5 dark:border-white/15 dark:bg-[#0B1714]">
                          <Clock className="h-3.5 w-3.5 text-[#0D6E52] dark:text-[#E7C57B]" />
                          <input
                            type="time"
                            value={cfg.time}
                            onChange={(e) =>
                              onUpdateSettings({
                                routineReminders: {
                                  ...settings.routineReminders,
                                  [item.key]: {
                                    ...cfg,
                                    time: e.target.value,
                                  },
                                },
                              })
                            }
                            aria-label={`${item.labelBn} সময়`}
                            className="font-mono-num min-h-[38px] bg-transparent text-xs font-bold text-[#0F1F1A] focus:outline-none dark:text-[#F0F5F3]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              routineReminders: {
                                ...settings.routineReminders,
                                [item.key]: {
                                  ...cfg,
                                  enabled: !cfg.enabled,
                                },
                              },
                            })
                          }
                          className={`min-h-[38px] min-w-[66px] rounded-xl px-3 text-xs font-bold ${
                            cfg.enabled
                              ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                              : 'border border-black/10 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
                          }`}
                        >
                          {cfg.enabled ? 'চালু' : 'বন্ধ'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            {(activeModal === 'fontSize' ||
              activeModal === 'display' ||
              activeModal === 'voice' ||
              activeModal === 'prayers' ||
              activeModal === 'routines') && (
              <div className="mt-4 flex shrink-0 justify-end border-t border-black/8 pt-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="min-h-[42px] rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-5 text-xs font-bold text-[#F6DC9B]"
                >
                  সম্পন্ন
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
