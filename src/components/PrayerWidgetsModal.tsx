import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { CITY_PRESETS } from '../data/islamicData';
import {
  dispatchSystemNotification,
  type InAppNotificationAlert,
} from '../hooks/usePrayerNotifications';
import type { PrayerScheduleResult } from '../services/islamicApi';
import type { AppSettings, PrayerTimeEntry } from '../types/islamic';
import {
  getActiveWaqtStatus,
  getWidgetReminderSummary,
} from '../utils/prayerScheduleHelper';
import {
  formatClock12h,
  formatTime12h,
  getBanglaDateInfo,
  getEnglishDateInfo,
} from '../utils/timeFormat';

export type WidgetLayoutStyle = 'compact' | 'full' | 'lockscreen';
export type WidgetColorTheme = 'emerald' | 'midnight' | 'light';

export interface WidgetPrefs {
  layout: WidgetLayoutStyle;
  theme: WidgetColorTheme;
  showBanglaDate: boolean;
  showHijriDate: boolean;
  showSunnahTimes: boolean;
  showReminders: boolean;
}

const DEFAULT_WIDGET_PREFS: WidgetPrefs = {
  layout: 'full',
  theme: 'emerald',
  showBanglaDate: true,
  showHijriDate: true,
  showSunnahTimes: true,
  showReminders: true,
};

const WIDGET_PREFS_STORAGE_KEY = 'noor_widget_prefs_v1';

export function loadWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGET_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFS;
    return { ...DEFAULT_WIDGET_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIDGET_PREFS;
  }
}

export function saveWidgetPrefs(prefs: WidgetPrefs): void {
  try {
    localStorage.setItem(WIDGET_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

const FIVE_PRAYERS: Array<{
  key: PrayerTimeEntry['key'];
  settingKey: keyof AppSettings['prayerReminders'];
  labelBn: string;
}> = [
  { key: 'Fajr', settingKey: 'Fajr', labelBn: 'ফজর' },
  { key: 'Dhuhr', settingKey: 'Dhuhr', labelBn: 'যোহর' },
  { key: 'Asr', settingKey: 'Asr', labelBn: 'আসর' },
  { key: 'Maghrib', settingKey: 'Maghrib', labelBn: 'মাগরিব' },
  { key: 'Isha', settingKey: 'Isha', labelBn: 'ইশা' },
];

const THEME_PALETTES: Record<
  WidgetColorTheme,
  {
    labelBn: string;
    cardClass: string;
    innerCardClass: string;
    titleColor: string;
    mutedColor: string;
    accentColor: string;
    dividerColor: string;
    activeRowClass: string;
    canvasBgStart: string;
    canvasBgEnd: string;
    canvasPanel: string;
    canvasText: string;
    canvasMuted: string;
    canvasAccent: string;
  }
> = {
  emerald: {
    labelBn: 'পান্না সবুজ',
    cardClass:
      'border-[#E7C57B]/30 bg-gradient-to-br from-[#073E34] via-[#052922] to-[#031612] text-white',
    innerCardClass: 'border-white/12 bg-black/25',
    titleColor: 'text-white',
    mutedColor: 'text-[#C6DDD6]',
    accentColor: 'text-[#F6DC9B]',
    dividerColor: 'border-white/12',
    activeRowClass: 'border-[#E7C57B]/65 bg-[#0D6E52]/55 text-white',
    canvasBgStart: '#073E34',
    canvasBgEnd: '#031612',
    canvasPanel: 'rgba(0, 0, 0, 0.28)',
    canvasText: '#FFFFFF',
    canvasMuted: '#C6DDD6',
    canvasAccent: '#F6DC9B',
  },
  midnight: {
    labelBn: 'তাহাজ্জুদ ডার্ক',
    cardClass:
      'border-white/15 bg-gradient-to-br from-[#121917] via-[#0B100F] to-[#060807] text-white',
    innerCardClass: 'border-white/10 bg-white/[0.04]',
    titleColor: 'text-[#F3F7F5]',
    mutedColor: 'text-[#9EB2AB]',
    accentColor: 'text-[#E7C57B]',
    dividerColor: 'border-white/10',
    activeRowClass: 'border-[#E7C57B]/60 bg-[#E7C57B]/12 text-[#F6DC9B]',
    canvasBgStart: '#121917',
    canvasBgEnd: '#060807',
    canvasPanel: 'rgba(255, 255, 255, 0.05)',
    canvasText: '#F3F7F5',
    canvasMuted: '#9EB2AB',
    canvasAccent: '#E7C57B',
  },
  light: {
    labelBn: 'পরিচ্ছন্ন সাদা',
    cardClass:
      'border-[#0D6E52]/20 bg-gradient-to-br from-[#FFFFFF] via-[#F7FAF9] to-[#EDF4F1] text-[#0F1F1A]',
    innerCardClass: 'border-[#0D6E52]/12 bg-white/85',
    titleColor: 'text-[#0F1F1A]',
    mutedColor: 'text-[#475A53]',
    accentColor: 'text-[#0D6E52]',
    dividerColor: 'border-[#0D6E52]/12',
    activeRowClass: 'border-[#0D6E52] bg-[#0D6E52]/10 text-[#063D34]',
    canvasBgStart: '#FFFFFF',
    canvasBgEnd: '#EBF3F0',
    canvasPanel: 'rgba(13, 110, 82, 0.07)',
    canvasText: '#0F1F1A',
    canvasMuted: '#475A53',
    canvasAccent: '#0D6E52',
  },
};

interface PrayerWidgetCardProps {
  schedule: PrayerScheduleResult;
  settings: AppSettings;
  prefs: WidgetPrefs;
  now: Date;
}

export const PrayerWidgetCard: React.FC<PrayerWidgetCardProps> = ({
  schedule,
  settings,
  prefs,
  now,
}) => {
  const palette = THEME_PALETTES[prefs.theme];
  const activeWaqt = useMemo(() => getActiveWaqtStatus(schedule, now), [schedule, now]);
  const reminderSummary = useMemo(
    () => getWidgetReminderSummary(schedule, settings, now),
    [schedule, settings, now]
  );

  const banglaDate = getBanglaDateInfo(now);
  const englishDate = getEnglishDateInfo(now);
  const liveClock = formatClock12h(now);

  const dateLineParts: string[] = [englishDate.fullEn];
  if (prefs.showHijriDate) dateLineParts.push(schedule.hijriDateBn);
  if (prefs.showBanglaDate) dateLineParts.push(`${banglaDate.dayBn} ${banglaDate.monthNameBn}`);

  const isLockscreen = prefs.layout === 'lockscreen';
  const isCompact = prefs.layout === 'compact';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border shadow-xl transition-colors ${
        palette.cardClass
      } ${isLockscreen ? 'mx-auto max-w-sm p-6' : 'p-5 sm:p-6'}`}
    >
      <div
        className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-35"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4">
        {/* Header: Location, Clock & Dates */}
        <div
          className={`flex flex-wrap items-start justify-between gap-2 ${
            isLockscreen ? 'flex-col items-center text-center' : ''
          }`}
        >
          <div className={isLockscreen ? 'w-full text-center' : 'min-w-0 flex-1'}>
            <div
              className={`flex flex-wrap items-center gap-1.5 text-xs font-semibold ${
                isLockscreen ? 'justify-center' : ''
              } ${palette.accentColor}`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{schedule.locationLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{liveClock}</span>
            </div>
            <p className={`mt-1 text-xs leading-relaxed ${palette.mutedColor}`}>
              {dateLineParts.join(' · ')}
            </p>
          </div>

          {!isLockscreen && (
            <div className="shrink-0 text-right">
              <p className={`text-[11px] font-medium ${palette.mutedColor}`}>
                {activeWaqt.remainingLabelBn}
              </p>
              <p className={`font-mono-num text-xl font-bold ${palette.accentColor}`}>
                {activeWaqt.remainingCountdown}
              </p>
            </div>
          )}
        </div>

        {/* Active Prayer Spotlight */}
        <div
          className={`rounded-2xl border p-3.5 ${palette.innerCardClass} ${
            isLockscreen ? 'text-center' : ''
          }`}
        >
          <div
            className={`flex flex-wrap items-baseline justify-between gap-2 ${
              isLockscreen ? 'flex-col items-center' : ''
            }`}
          >
            <div>
              <p className={`text-sm font-bold sm:text-base ${palette.titleColor}`}>
                {activeWaqt.activeTitleBn}
              </p>
              <p className={`font-mono-num mt-0.5 text-xs font-semibold ${palette.accentColor}`}>
                {activeWaqt.activeRangeBn}
              </p>
            </div>
            <div className={isLockscreen ? 'mt-1 text-center' : 'text-right'}>
              <p className={`text-[11px] ${palette.mutedColor}`}>
                পরবর্তী: <strong className={palette.titleColor}>{activeWaqt.nextTitleBn}</strong>
              </p>
              <p className={`font-mono-num text-xs font-semibold ${palette.accentColor}`}>
                {isLockscreen
                  ? `${activeWaqt.remainingCountdown} বাকি`
                  : `${activeWaqt.nextStartsIn} পর`}
              </p>
            </div>
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/20 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#34B38A] to-[#E7C57B] transition-[width] duration-500"
              style={{ width: `${activeWaqt.progressPct}%` }}
            />
          </div>
        </div>

        {/* 5 Daily Prayer Times Schedule (shown in Full & Lockscreen layouts) */}
        {!isCompact && (
          <div
            className={`grid gap-2 ${
              isLockscreen ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-5'
            }`}
          >
            {FIVE_PRAYERS.map((p) => {
              const entry = schedule.prayers.find((x) => x.key === p.key);
              const timeStr = entry ? formatTime12h(entry.time) : '—';
              const isCurrent = activeWaqt.activeId === p.key.toLowerCase();
              const isBellOn =
                settings.notificationsEnabled && settings.prayerReminders[p.settingKey];

              return (
                <div
                  key={p.key}
                  className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 transition-colors sm:flex-col sm:items-start sm:gap-1 ${
                    isCurrent ? palette.activeRowClass : palette.innerCardClass
                  } ${isLockscreen ? '!flex-row !items-center' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${palette.titleColor}`}>
                      {p.labelBn}
                    </span>
                    {prefs.showReminders && (
                      <span
                        className={isBellOn ? palette.accentColor : `${palette.mutedColor} opacity-45`}
                        title={isBellOn ? 'রিমাইন্ডার চালু' : 'রিমাইন্ডার বন্ধ'}
                      >
                        {isBellOn ? (
                          <Bell className="h-3 w-3" />
                        ) : (
                          <BellOff className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono-num text-xs font-bold ${
                      isCurrent ? palette.accentColor : palette.titleColor
                    }`}
                  >
                    {timeStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sunnah Boundaries: Tahajjud, Sehri End, Sunrise, Iftar */}
        {prefs.showSunnahTimes && (
          <div
            className={`grid grid-cols-2 gap-2 border-t pt-3 text-xs sm:grid-cols-4 ${palette.dividerColor}`}
          >
            <div>
              <span className={`block text-[10px] ${palette.mutedColor}`}>তাহাজ্জুদ</span>
              <span className={`font-mono-num font-bold ${palette.titleColor}`}>
                {formatTime12h(activeWaqt.tahajjudStart)}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] ${palette.mutedColor}`}>সেহরি শেষ</span>
              <span className={`font-mono-num font-bold ${palette.accentColor}`}>
                {formatTime12h(activeWaqt.sehriEnd)}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] ${palette.mutedColor}`}>সূর্যোদয়</span>
              <span className={`font-mono-num font-bold ${palette.titleColor}`}>
                {formatTime12h(activeWaqt.sunrise)}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] ${palette.mutedColor}`}>ইফতার</span>
              <span className={`font-mono-num font-bold ${palette.accentColor}`}>
                {formatTime12h(activeWaqt.iftarTime)}
              </span>
            </div>
          </div>
        )}

        {/* Active Prayer & Amol Reminder Footer */}
        {prefs.showReminders && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs ${palette.dividerColor}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {settings.notificationsEnabled ? (
                <Bell className={`h-3.5 w-3.5 shrink-0 ${palette.accentColor}`} />
              ) : (
                <BellOff className={`h-3.5 w-3.5 shrink-0 ${palette.mutedColor}`} />
              )}
              <p className={`truncate ${palette.mutedColor}`}>
                {settings.notificationsEnabled && reminderSummary.nextUpcoming ? (
                  <>
                    পরবর্তী রিমাইন্ডার:{' '}
                    <strong className={palette.titleColor}>
                      {reminderSummary.nextUpcoming.labelBn} ({reminderSummary.nextUpcoming.time12Bn})
                    </strong>
                    {reminderSummary.nextUpcoming.leadNoteBn
                      ? ` · ${reminderSummary.nextUpcoming.leadNoteBn}`
                      : ''}
                  </>
                ) : (
                  'রিমাইন্ডার বন্ধ আছে — চালু করলে নামাজ ও আমলের অ্যালার্ট পাবেন'
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

async function exportWidgetToPng(
  schedule: PrayerScheduleResult,
  settings: AppSettings,
  prefs: WidgetPrefs,
  now: Date
): Promise<void> {
  const isLock = prefs.layout === 'lockscreen';
  const width = isLock ? 1080 : 1200;
  const height = isLock ? 1620 : 900;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette = THEME_PALETTES[prefs.theme];
  const activeWaqt = getActiveWaqtStatus(schedule, now);
  const reminderSummary = getWidgetReminderSummary(schedule, settings, now);
  const banglaDate = getBanglaDateInfo(now);
  const englishDate = getEnglishDateInfo(now);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, palette.canvasBgStart);
  grad.addColorStop(1, palette.canvasBgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent border strip
  ctx.fillStyle = palette.canvasAccent;
  ctx.fillRect(0, 0, width, 10);

  const padX = 72;
  let y = isLock ? 120 : 88;

  // Brand + Location Header
  ctx.fillStyle = palette.canvasAccent;
  ctx.font = 'bold 28px "Hind Siliguri", sans-serif';
  ctx.fillText(`Daily Islamic Routine · ${schedule.locationLabel}`, padX, y);
  y += 48;

  // Dates
  ctx.fillStyle = palette.canvasMuted;
  ctx.font = '500 26px "Hind Siliguri", sans-serif';
  ctx.fillText(englishDate.fullEn, padX, y);
  y += 40;

  if (prefs.showHijriDate) {
    ctx.fillText(`হিজরি: ${schedule.hijriDateBn}`, padX, y);
    y += 40;
  }
  if (prefs.showBanglaDate) {
    ctx.fillText(`বাংলা: ${banglaDate.fullBn}`, padX, y);
    y += 44;
  }

  y += 18;

  // Spotlight Box
  const boxHeight = 165;
  ctx.fillStyle = palette.canvasPanel;
  ctx.beginPath();
  ctx.roundRect(padX, y, width - padX * 2, boxHeight, 28);
  ctx.fill();

  ctx.fillStyle = palette.canvasText;
  ctx.font = 'bold 40px "Hind Siliguri", sans-serif';
  ctx.fillText(activeWaqt.activeTitleBn, padX + 36, y + 66);

  ctx.fillStyle = palette.canvasAccent;
  ctx.font = '600 30px "JetBrains Mono", "Hind Siliguri", monospace';
  ctx.fillText(activeWaqt.activeRangeBn, padX + 36, y + 118);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.canvasMuted;
  ctx.font = '500 22px "Hind Siliguri", sans-serif';
  ctx.fillText(`পরবর্তী: ${activeWaqt.nextTitleBn}`, width - padX - 36, y + 60);
  ctx.fillStyle = palette.canvasAccent;
  ctx.font = 'bold 34px "JetBrains Mono", monospace';
  ctx.fillText(activeWaqt.remainingCountdown, width - padX - 36, y + 114);
  ctx.textAlign = 'left';

  y += boxHeight + 38;

  // 5 Prayers List / Grid
  ctx.fillStyle = palette.canvasAccent;
  ctx.font = 'bold 26px "Hind Siliguri", sans-serif';
  ctx.fillText('আজকের ৫ ওয়াক্ত নামাজের সময়সূচি', padX, y);
  y += 28;

  const rowH = isLock ? 96 : 74;
  const cols = isLock ? 1 : 2;
  const colGap = 24;
  const cardW = cols === 1 ? width - padX * 2 : (width - padX * 2 - colGap) / 2;

  FIVE_PRAYERS.forEach((p, idx) => {
    const entry = schedule.prayers.find((x) => x.key === p.key);
    const timeStr = entry ? formatTime12h(entry.time) : '—';
    const isCurrent = activeWaqt.activeId === p.key.toLowerCase();
    const isBellOn = settings.notificationsEnabled && settings.prayerReminders[p.settingKey];

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = padX + col * (cardW + colGap);
    const ry = y + row * (rowH + 16);

    ctx.fillStyle = palette.canvasPanel;
    ctx.beginPath();
    ctx.roundRect(rx, ry, cardW, rowH, 20);
    ctx.fill();

    if (isCurrent) {
      ctx.strokeStyle = palette.canvasAccent;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = isCurrent ? palette.canvasAccent : palette.canvasText;
    ctx.font = 'bold 30px "Hind Siliguri", sans-serif';
    ctx.fillText(`${p.labelBn}${isBellOn ? ' · রিমাইন্ডার চালু' : ''}`, rx + 28, ry + rowH / 2 + 10);

    ctx.textAlign = 'right';
    ctx.fillStyle = palette.canvasAccent;
    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.fillText(timeStr, rx + cardW - 28, ry + rowH / 2 + 10);
    ctx.textAlign = 'left';
  });

  const rowsUsed = Math.ceil(FIVE_PRAYERS.length / cols);
  y += rowsUsed * (rowH + 16) + 28;

  if (prefs.showSunnahTimes) {
    ctx.fillStyle = palette.canvasMuted;
    ctx.font = '600 24px "Hind Siliguri", sans-serif';
    ctx.fillText(
      `তাহাজ্জুদ: ${formatTime12h(activeWaqt.tahajjudStart)}  ·  সেহরি শেষ: ${formatTime12h(
        activeWaqt.sehriEnd
      )}  ·  সূর্যোদয়: ${formatTime12h(activeWaqt.sunrise)}  ·  ইফতার: ${formatTime12h(
        activeWaqt.iftarTime
      )}`,
      padX,
      y
    );
    y += 48;
  }

  if (prefs.showReminders) {
    ctx.fillStyle = palette.canvasAccent;
    ctx.font = '600 25px "Hind Siliguri", sans-serif';
    const remText =
      settings.notificationsEnabled && reminderSummary.nextUpcoming
        ? `পরবর্তী রিমাইন্ডার: ${reminderSummary.nextUpcoming.labelBn} (${reminderSummary.nextUpcoming.time12Bn})`
        : 'নামাজ ও আমলের রিমাইন্ডার অ্যাপ সেটিংস থেকে চালু করুন';
    ctx.fillText(remText, padX, height - 64);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prayer-widget-${now.toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

interface StandaloneWidgetViewProps {
  schedule: PrayerScheduleResult;
  settings: AppSettings;
  selectedCityId: string;
  onChangeCityId: (cityId: string) => void;
  onToggleNotifications: () => void;
  onExitWidgetMode: () => void;
  onInAppAlert: (alert: InAppNotificationAlert) => void;
}

export const StandaloneWidgetView: React.FC<StandaloneWidgetViewProps> = ({
  schedule,
  settings,
  selectedCityId,
  onChangeCityId,
  onToggleNotifications,
  onExitWidgetMode,
  onInAppAlert,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [prefs, setPrefs] = useState<WidgetPrefs>(() => loadWidgetPrefs());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const updatePrefs = (patch: Partial<WidgetPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveWidgetPrefs(next);
      return next;
    });
  };

  const handlePinNotificationWidget = async () => {
    const activeWaqt = getActiveWaqtStatus(schedule, now);
    const rem = getWidgetReminderSummary(schedule, settings, now);
    const title = `${activeWaqt.activeTitleBn} · ${schedule.locationLabel}`;
    const body = `${schedule.hijriDateBn} | পরবর্তী: ${activeWaqt.nextTitleBn} (${activeWaqt.remainingCountdown} পর)${
      rem.nextUpcoming ? ` · রিমাইন্ডার: ${rem.nextUpcoming.labelBn} ${rem.nextUpcoming.time12Bn}` : ''
    }`;
    const sent = await dispatchSystemNotification(title, body, 'noor-live-prayer-widget');
    if (sent) {
      onInAppAlert({
        id: `widget-pin-${Date.now()}`,
        title: 'নোটিফিকেশন বারে উইজেট আপডেট হয়েছে',
        body,
      });
    } else {
      onToggleNotifications();
    }
  };

  const handleDownloadPng = async () => {
    setExporting(true);
    try {
      await exportWidgetToPng(schedule, settings, prefs, now);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-sanctuary-canvas min-h-screen px-4 py-5 text-[#0F1F1A] dark:text-[#F0F5F3]">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExitWidgetMode}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>সম্পূর্ণ অ্যাপ খুলুন</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCityId}
              onChange={(e) => onChangeCityId(e.target.value)}
              aria-label="শহর পরিবর্তন করুন"
              className="min-h-[42px] rounded-xl border border-black/10 bg-white/90 px-3 text-xs font-semibold text-[#0F1F1A] dark:border-white/15 dark:bg-[#0B1C18] dark:text-white"
            >
              {CITY_PRESETS.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.nameBn}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const order: WidgetColorTheme[] = ['emerald', 'midnight', 'light'];
                const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
                updatePrefs({ theme: next });
              }}
              className="min-h-[42px] rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#0F1F1A] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B]"
            >
              থিম: {THEME_PALETTES[prefs.theme].labelBn}
            </button>
          </div>
        </div>

        <PrayerWidgetCard
          schedule={schedule}
          settings={settings}
          prefs={prefs}
          now={now}
        />

        <div className="glass-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {(['compact', 'full', 'lockscreen'] as WidgetLayoutStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => updatePrefs({ layout: style })}
                className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition-colors ${
                  prefs.layout === style
                    ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                    : 'border border-black/10 bg-white/75 text-[#475A53] dark:border-white/15 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                }`}
              >
                {style === 'compact'
                  ? 'কম্প্যাক্ট'
                  : style === 'full'
                  ? '৫ ওয়াক্ত ও রিমাইন্ডার'
                  : 'লক-স্ক্রিন'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePinNotificationWidget}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#0D6E52]/25 bg-[#0D6E52]/10 px-3.5 text-xs font-bold text-[#063D34] dark:border-[#E7C57B]/35 dark:bg-[#0D6E52]/30 dark:text-[#F6DC9B]"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>নোটিফিকেশন বারে পাঠান</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={exporting}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E7C57B] to-[#C8963E] px-3.5 text-xs font-bold text-[#041815]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exporting ? 'তৈরি হচ্ছে...' : 'ছবি সেভ'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrayerWidgetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: PrayerScheduleResult;
  settings: AppSettings;
  onToggleNotifications: () => void;
  onOpenStandaloneWidget: () => void;
  onInAppAlert: (alert: InAppNotificationAlert) => void;
}

export const PrayerWidgetsModal: React.FC<PrayerWidgetsModalProps> = ({
  isOpen,
  onClose,
  schedule,
  settings,
  onToggleNotifications,
  onOpenStandaloneWidget,
  onInAppAlert,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [prefs, setPrefs] = useState<WidgetPrefs>(() => loadWidgetPrefs());
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const updatePrefs = (patch: Partial<WidgetPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveWidgetPrefs(next);
      return next;
    });
  };

  const reminderSummary = useMemo(
    () => getWidgetReminderSummary(schedule, settings, now),
    [schedule, settings, now]
  );

  if (!isOpen) return null;

  const widgetUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?widget=1`
      : '/?widget=1';

  const handleCopyWidgetUrl = async () => {
    try {
      await navigator.clipboard.writeText(widgetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyScheduleText = async () => {
    const banglaDate = getBanglaDateInfo(now);
    const englishDate = getEnglishDateInfo(now);
    const lines = [
      `🕌 ${schedule.locationLabel} — আজকের নামাজের সময়সূচি`,
      `📅 ${englishDate.fullEn}`,
      `🌙 ${schedule.hijriDateBn} · ${banglaDate.fullBn}`,
      '',
      ...FIVE_PRAYERS.map((p) => {
        const entry = schedule.prayers.find((x) => x.key === p.key);
        return `• ${p.labelBn}: ${entry ? formatTime12h(entry.time) : '—'}`;
      }),
      '',
      settings.notificationsEnabled && reminderSummary.nextUpcoming
        ? `🔔 পরবর্তী রিমাইন্ডার: ${reminderSummary.nextUpcoming.labelBn} (${reminderSummary.nextUpcoming.time12Bn})`
        : '🔔 নামাজ ও আমলের রিমাইন্ডার: অ্যাপে সক্রিয় রাখুন',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSendNotificationWidget = async () => {
    const activeWaqt = getActiveWaqtStatus(schedule, now);
    const title = `${activeWaqt.activeTitleBn} · ${schedule.locationLabel}`;
    const body = `${schedule.hijriDateBn} | পরবর্তী: ${activeWaqt.nextTitleBn} (${activeWaqt.remainingCountdown} পর)${
      reminderSummary.nextUpcoming
        ? ` · রিমাইন্ডার: ${reminderSummary.nextUpcoming.labelBn} ${reminderSummary.nextUpcoming.time12Bn}`
        : ''
    }`;

    const sent = await dispatchSystemNotification(title, body, 'noor-live-prayer-widget');
    if (sent) {
      onInAppAlert({
        id: `widget-notif-${Date.now()}`,
        title: 'নোটিফিকেশন বারে লাইভ উইজেট পাঠানো হয়েছে',
        body,
      });
    } else {
      if (!settings.notificationsEnabled) {
        onToggleNotifications();
      } else {
        onInAppAlert({
          id: `widget-notif-fallback-${Date.now()}`,
          title: 'অ্যাপের ভেতরে উইজেট অ্যালার্ট চালু',
          body,
        });
      }
    }
  };

  const handleDownloadPng = async () => {
    setExportingPng(true);
    try {
      await exportWidgetToPng(schedule, settings, prefs, now);
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="নামাজ, তারিখ ও রিমাইন্ডার উইজেট"
      onClick={onClose}
    >
      <div
        className="glass-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-black/8 bg-white/80 px-5 py-4 dark:border-white/10 dark:bg-[#071612]/90">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#063D34] to-[#0D6E52] text-[#F6DC9B]">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-lg">
                নামাজ, তারিখ ও রিমাইন্ডার উইজেট
              </h2>
              <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                লাইভ ওয়াক্ত, তিন ক্যালেন্ডার ও রিমাইন্ডার কাস্টমাইজ করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/10"
            aria-label="বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Studio Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Style & Theme Pickers */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'compact', label: 'কম্প্যাক্ট (৪×২)' },
                  { id: 'full', label: '৫ ওয়াক্ত ও রিমাইন্ডার' },
                  { id: 'lockscreen', label: 'লক-স্ক্রিন কার্ড' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updatePrefs({ layout: item.id })}
                  className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold transition-colors ${
                    prefs.layout === item.id
                      ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-xs'
                      : 'border border-black/10 bg-black/[0.03] text-[#475A53] hover:bg-black/5 dark:border-white/12 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['emerald', 'midnight', 'light'] as WidgetColorTheme[]).map((themeId) => (
                <button
                  key={themeId}
                  type="button"
                  onClick={() => updatePrefs({ theme: themeId })}
                  className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    prefs.theme === themeId
                      ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]'
                      : 'border-black/10 bg-white/70 text-[#475A53] dark:border-white/12 dark:bg-white/[0.03] dark:text-[#9BB0A8]'
                  }`}
                >
                  {THEME_PALETTES[themeId].labelBn}
                </button>
              ))}
            </div>
          </div>

          {/* Live Interactive Widget Preview */}
          <PrayerWidgetCard
            schedule={schedule}
            settings={settings}
            prefs={prefs}
            now={now}
          />

          {/* Display Field Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'showHijriDate' as const, label: 'হিজরি তারিখ' },
                { key: 'showBanglaDate' as const, label: 'বাংলা তারিখ' },
                { key: 'showSunnahTimes' as const, label: 'তাহাজ্জুদ · সেহরি · ইফতার' },
                { key: 'showReminders' as const, label: 'রিমাইন্ডার স্ট্যাটাস' },
              ]
            ).map((opt) => {
              const active = prefs[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => updatePrefs({ [opt.key]: !active })}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                      : 'border-black/10 bg-black/[0.025] text-[#475A53] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Upcoming Reminder Strip */}
          <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                <h3 className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  উইজেটের দৈনিক রিমাইন্ডার তালিকা
                </h3>
              </div>

              <button
                type="button"
                onClick={onToggleNotifications}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
                  settings.notificationsEnabled
                    ? 'bg-[#063D34] text-[#F6DC9B]'
                    : 'border border-black/10 bg-white text-[#475A53] dark:border-white/15 dark:bg-white/[0.05] dark:text-[#9BB0A8]'
                }`}
              >
                {settings.notificationsEnabled ? (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    <span>রিমাইন্ডার চালু</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-3.5 w-3.5" />
                    <span>চালু করুন</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {reminderSummary.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    item.isNextUpcoming && item.enabled
                      ? 'border-[#0D6E52]/40 bg-[#0D6E52]/10 dark:border-[#E7C57B]/45 dark:bg-[#063D34]/60'
                      : 'border-black/8 bg-white/75 dark:border-white/8 dark:bg-white/[0.02]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                      {item.labelBn}
                    </p>
                    <p className="text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                      {item.enabled ? item.leadNoteBn : 'বন্ধ আছে'}
                    </p>
                  </div>
                  <span className="font-mono-num shrink-0 font-bold text-[#0D6E52] dark:text-[#F6DC9B]">
                    {item.time12Bn}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Real Working Widget Output Actions */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSendNotificationWidget}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>নোটিফিকেশন বারে লাইভ উইজেট দেখুন</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={exportingPng}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E7C57B] to-[#C8963E] px-4 text-xs font-bold text-[#041815] shadow-sm disabled:opacity-60"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>{exportingPng ? 'ছবি তৈরি হচ্ছে...' : 'লক-স্ক্রিন ছবি (PNG) ডাউনলোড'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStandaloneWidget}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/85 px-4 text-xs font-bold text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
              <span>মিনি উইজেট মোডে খুলুন</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyWidgetUrl}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
              >
                {copiedLink ? <Check className="h-4 w-4 text-[#0D6E52]" /> : <Copy className="h-4 w-4" />}
                <span>{copiedLink ? 'লিংক কপি হয়েছে' : 'উইজেট লিংক'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyScheduleText}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
              >
                {copiedText ? <Check className="h-4 w-4 text-[#0D6E52]" /> : <Sparkles className="h-4 w-4" />}
                <span>{copiedText ? 'টেক্সট কপি হয়েছে' : 'সময় কপি'}</span>
              </button>
            </div>
          </div>

          {/* Honest Browser/PWA vs Native Widget Guidance */}
          <div className="rounded-2xl border border-[#0D6E52]/20 bg-[#0D6E52]/[0.06] p-4 text-xs leading-relaxed text-[#243B34] dark:border-[#E7C57B]/20 dark:bg-[#063D34]/45 dark:text-[#D5EAE3]">
            <div className="flex items-start gap-2.5">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#F6DC9B]" />
              <div className="space-y-1">
                <p className="font-bold text-[#063D34] dark:text-[#F6DC9B]">
                  ফোনের হোম স্ক্রিনে উইজেট ব্যবহারের নিয়ম
                </p>
                <p>
                  ব্রাউজার ও ওয়েব অ্যাপ (PWA) থেকে Android বা iPhone-এর মূল হোম স্ক্রিনে সরাসরি নেটিভ উইজেট বসানো যায় না। তবে এখান থেকে ৩ভাবে উইজেট ব্যবহার করতে পারবেন: (১) <strong>মিনি উইজেট মোড</strong> খুলে ব্রাউজার মেনু থেকে <em>Add to Home screen</em> দিলে এক ট্যাপেই শুধু নামাজ-তারিখ-রিমাইন্ডার দেখাবে, (২) <strong>নোটিফিকেশন বারে লাইভ উইজেট</strong> ফোনের নোটিফিকেশন শেডে চলমান ওয়াক্ত দেখাবে, এবং (৩) <strong>লক-স্ক্রিন PNG ছবি</strong> সেভ করে ফোনের লক স্ক্রিনে রাখতে পারবেন।
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
