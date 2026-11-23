import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Bell,
  BellOff,
  Calendar,
  Check,
  Clock,
  Compass,
  MapPin,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { TriCalendarModal } from './TriCalendarModal';
import {
  CITY_PRESETS,
  DEFAULT_ROUTINE_TASKS,
  HERO_MEDINA_IMG,
} from '../data/islamicData';
import { RIYAD_CURATED_HADITHS } from '../data/seerahAndRiyadData';
import {
  computeLastThirdStart,
  computeSehriEndFromFajr,
  type PrayerScheduleResult,
} from '../services/islamicApi';
import type {
  ActiveTab,
  AppThemeId,
  RoutinePeriod,
  RoutineTask,
  RoutineWaqt,
} from '../types/islamic';
import { APP_THEMES } from '../utils/playerThemes';
import {
  formatClock12h,
  formatTime12h,
  getBanglaDateInfo,
  getEnglishDateInfo,
} from '../utils/timeFormat';

interface DailyRoutineViewProps {
  isDark: boolean;
  appTheme: AppThemeId;
  selectedCityId: string;
  schedule: PrayerScheduleResult;
  notificationsEnabled: boolean;
  onToggleTheme: () => void;
  onChangeCityId: (cityId: string) => void;
  onUseLocation: () => void;
  onToggleNotifications: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenAmol?: (
    subTab: 'ruqyah' | 'manzil' | 'azkar',
    azkarFilter?: 'all' | 'morning' | 'evening'
  ) => void;
  onOpenTasbih: () => void;
}

const WAQT_FILTERS: Array<{ id: 'all' | RoutineWaqt; label: string }> = [
  { id: 'all', label: 'সকল ওয়াক্ত' },
  { id: 'fajr', label: 'ফজর' },
  { id: 'dhuhr', label: 'যোহর' },
  { id: 'asr', label: 'আসর' },
  { id: 'maghrib', label: 'মাগরিব' },
  { id: 'isha', label: 'ইশা' },
];

function resolveTaskWaqt(task: RoutineTask): RoutineWaqt {
  if (task.waqt) return task.waqt;
  switch (task.period) {
    case 'fajr':
    case 'dawn':
      return 'fajr';
    case 'dhuhr':
    case 'day':
      return 'dhuhr';
    case 'asr':
      return 'asr';
    case 'maghrib':
    case 'evening':
      return 'maghrib';
    case 'isha':
    case 'night':
    default:
      return 'isha';
  }
}

const BN_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function timeToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

function secondsToHMS(diffSecs: number): string {
  const clamped = Math.max(0, Math.floor(diffSecs));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function addMinutesHHMM(hhmm: string, deltaMins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h || 0) * 60 + (m || 0) + deltaMins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

interface WaqtSlotItem {
  id: string;
  labelBn: string;
  rangeTextBn: string;
  subNoteBn?: string;
  isActive: boolean;
}

interface ActiveWaqtStatus {
  activeTitleBn: string;
  activeRangeBn: string;
  remainingLabelBn: string;
  remainingCountdown: string;
  progressPct: number;
  nextTitleBn: string;
  nextRangeBn: string;
  nextStartsIn: string;
  tahajjudStart: string;
  sehriEnd: string;
  sunrise: string;
  iftarTime: string;
  slots: WaqtSlotItem[];
}

function getActiveWaqtStatus(
  schedule: PrayerScheduleResult,
  now: Date
): ActiveWaqtStatus {
  const getT = (key: PrayerScheduleResult['prayers'][number]['key'], fallback: string) =>
    schedule.prayers.find((p) => p.key === key)?.time || fallback;

  const fajr = getT('Fajr', '05:02');
  const sunrise = getT('Sunrise', '06:18');
  const dhuhr = getT('Dhuhr', '11:52');
  const asr = getT('Asr', '15:36');
  const maghrib = getT('Maghrib', '17:24');
  const isha = getT('Isha', '18:42');

  const sehriEnd = schedule.imsakTime || computeSehriEndFromFajr(fajr);
  const tahajjudStart = schedule.tahajjudStart || computeLastThirdStart(maghrib, fajr);
  const duhaStart = addMinutesHHMM(sunrise, 15);
  const duhaEnd = addMinutesHHMM(dhuhr, -5);

  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const sTahajjud = timeToSeconds(tahajjudStart);
  const sSehriEnd = timeToSeconds(sehriEnd);
  const sFajr = timeToSeconds(fajr);
  const sSunrise = timeToSeconds(sunrise);
  const sDhuhr = timeToSeconds(dhuhr);
  const sAsr = timeToSeconds(asr);
  const sMaghrib = timeToSeconds(maghrib);
  const sIsha = timeToSeconds(isha);

  const daySecs = 24 * 3600;
  const spanBetween = (startS: number, endS: number, curS: number) => {
    const total = endS >= startS ? endS - startS : daySecs - startS + endS;
    const elapsed = curS >= startS ? curS - startS : daySecs - startS + curS;
    const rem = Math.max(0, total - elapsed);
    const pct = total > 0 ? Math.max(4, Math.min(98, Math.round((elapsed / total) * 100))) : 50;
    return { rem, pct };
  };

  let activeId = 'isha';
  let activeTitleBn = 'এশার ওয়াক্ত চলছে';
  let activeRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
  let remainingLabelBn = 'শেষ রাত / ফজরের আগে বাকি';
  let remainingCountdown = '00:00:00';
  let progressPct = 50;
  let nextTitleBn = 'তাহাজ্জুদ';
  let nextRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
  let nextStartsIn = '00:00:00';

  if (nowSecs >= sFajr && nowSecs < sSunrise) {
    activeId = 'fajr';
    const { rem, pct } = spanBetween(sFajr, sSunrise, nowSecs);
    activeTitleBn = 'ফজরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি (সূর্যোদয়)';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'যোহর';
    nextRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    nextStartsIn = secondsToHMS(sDhuhr - nowSecs);
  } else if (nowSecs >= sSunrise && nowSecs < sDhuhr) {
    activeId = 'duha';
    const { rem, pct } = spanBetween(sSunrise, sDhuhr, nowSecs);
    activeTitleBn = 'ইশরাক ও চাশতের সময়';
    activeRangeBn = `${formatTime12h(duhaStart)} হতে ${formatTime12h(duhaEnd)}`;
    remainingLabelBn = 'যোহর শুরু হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'যোহর';
    nextRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    nextStartsIn = secondsToHMS(sDhuhr - nowSecs);
  } else if (nowSecs >= sDhuhr && nowSecs < sAsr) {
    activeId = 'dhuhr';
    const { rem, pct } = spanBetween(sDhuhr, sAsr, nowSecs);
    activeTitleBn = 'যোহরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'আসর';
    nextRangeBn = `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (nowSecs >= sAsr && nowSecs < sMaghrib) {
    activeId = 'asr';
    const { rem, pct } = spanBetween(sAsr, sMaghrib, nowSecs);
    activeTitleBn = 'আসরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`;
    remainingLabelBn = 'ইফতার ও মাগরিবের বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'মাগরিব ও ইফতার';
    nextRangeBn = `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (nowSecs >= sMaghrib && nowSecs < sIsha) {
    activeId = 'maghrib';
    const { rem, pct } = spanBetween(sMaghrib, sIsha, nowSecs);
    activeTitleBn = 'মাগরিব ও ইফতারের সময় চলছে';
    activeRangeBn = `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'এশা';
    nextRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (
    (sTahajjud < sFajr && nowSecs >= sTahajjud && nowSecs < sFajr) ||
    (sTahajjud > sIsha && (nowSecs >= sTahajjud || nowSecs < sFajr))
  ) {
    activeId = 'tahajjud';
    const { rem, pct } = spanBetween(sTahajjud, sFajr, nowSecs);
    const toSehri = nowSecs <= sSehriEnd ? sSehriEnd - nowSecs : daySecs - nowSecs + sSehriEnd;
    activeTitleBn = 'তাহাজ্জুদ ও সেহরির সময় চলছে';
    activeRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
    remainingLabelBn =
      nowSecs < sSehriEnd
        ? `সেহরির শেষ (${formatTime12h(sehriEnd)}) পর্যন্ত বাকি`
        : 'ফজর শুরু হতে বাকি';
    remainingCountdown = nowSecs < sSehriEnd ? secondsToHMS(toSehri) : secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'ফজর';
    nextRangeBn = `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`;
    nextStartsIn = secondsToHMS(rem);
  } else {
    activeId = 'isha';
    const { rem, pct } = spanBetween(sIsha, sFajr, nowSecs);
    const toTahajjud =
      sTahajjud >= nowSecs ? sTahajjud - nowSecs : daySecs - nowSecs + sTahajjud;
    activeTitleBn = 'এশার ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
    remainingLabelBn = 'তাহাজ্জুদ শুরু হতে বাকি';
    remainingCountdown = secondsToHMS(toTahajjud);
    progressPct = pct;
    nextTitleBn = 'তাহাজ্জুদ';
    nextRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
    nextStartsIn = secondsToHMS(rem > 0 ? toTahajjud : 0);
  }

  const slots: WaqtSlotItem[] = [
    {
      id: 'tahajjud',
      labelBn: 'তাহাজ্জুদ',
      rangeTextBn: `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`,
      subNoteBn: 'শেষ তৃতীয়াংশ',
      isActive: activeId === 'tahajjud',
    },
    {
      id: 'sehri',
      labelBn: 'সেহরির শেষ সময়',
      rangeTextBn: `${formatTime12h(sehriEnd)} পর্যন্ত`,
      subNoteBn: `ফজর শুরু ${formatTime12h(fajr)}`,
      isActive: activeId === 'tahajjud' && nowSecs < sSehriEnd,
    },
    {
      id: 'fajr',
      labelBn: 'ফজর',
      rangeTextBn: `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`,
      subNoteBn: `সূর্যোদয় ${formatTime12h(sunrise)}`,
      isActive: activeId === 'fajr',
    },
    {
      id: 'dhuhr',
      labelBn: 'যোহর',
      rangeTextBn: `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`,
      isActive: activeId === 'dhuhr',
    },
    {
      id: 'asr',
      labelBn: 'আসর',
      rangeTextBn: `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`,
      isActive: activeId === 'asr',
    },
    {
      id: 'iftar',
      labelBn: 'ইফতারের সময়',
      rangeTextBn: `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`,
      subNoteBn: `ইফতার শুরু ${formatTime12h(maghrib)}`,
      isActive: activeId === 'maghrib',
    },
    {
      id: 'maghrib',
      labelBn: 'মাগরিব',
      rangeTextBn: `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`,
      isActive: activeId === 'maghrib',
    },
    {
      id: 'isha',
      labelBn: 'ইশা',
      rangeTextBn: `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`,
      subNoteBn: `তাহাজ্জুদ শুরু ${formatTime12h(tahajjudStart)}`,
      isActive: activeId === 'isha',
    },
  ];

  return {
    activeTitleBn,
    activeRangeBn,
    remainingLabelBn,
    remainingCountdown,
    progressPct,
    nextTitleBn,
    nextRangeBn,
    nextStartsIn,
    tahajjudStart,
    sehriEnd,
    sunrise,
    iftarTime: maghrib,
    slots,
  };
}

export const DailyRoutineView: React.FC<DailyRoutineViewProps> = ({
  isDark,
  appTheme,
  selectedCityId,
  schedule,
  notificationsEnabled,
  onToggleTheme,
  onChangeCityId,
  onUseLocation,
  onToggleNotifications,
  onNavigateTab,
  onOpenAmol,
  onOpenTasbih,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [heroImgError, setHeroImgError] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getDateKey(new Date()));
  const [waqtFilter, setWaqtFilter] = useState<'all' | RoutineWaqt>('all');

  const [customTasks, setCustomTasks] = useState<RoutineTask[]>(() => {
    try {
      const saved = localStorage.getItem('noor_custom_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [completedByDate, setCompletedByDate] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('noor_routine_completed');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskWaqt, setNewTaskWaqt] = useState<RoutineWaqt>('fajr');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allTasks = useMemo(() => [...DEFAULT_ROUTINE_TASKS, ...customTasks], [customTasks]);
  const completedIds = completedByDate[selectedDateKey] || [];

  const isSubPartDone = (ids: string[], task: RoutineTask, subId: string): boolean => {
    return ids.includes(subId) || ids.includes(task.id);
  };

  const isTaskFullyDone = (ids: string[], task: RoutineTask): boolean => {
    if (task.subParts && task.subParts.length > 0) {
      return ids.includes(task.id) || task.subParts.every((s) => ids.includes(s.id));
    }
    return ids.includes(task.id);
  };

  const countUnitsForIds = (ids: string[]): number => {
    return allTasks.reduce((sum, task) => {
      if (task.subParts && task.subParts.length > 0) {
        if (ids.includes(task.id)) return sum + task.subParts.length;
        return sum + task.subParts.filter((s) => ids.includes(s.id)).length;
      }
      return sum + (ids.includes(task.id) ? 1 : 0);
    }, 0);
  };

  const totalUnits = useMemo(
    () =>
      allTasks.reduce(
        (sum, task) => sum + (task.subParts && task.subParts.length > 0 ? task.subParts.length : 1),
        0
      ),
    [allTasks]
  );

  const saveCompletedForDay = (updated: string[]) => {
    setCompletedByDate((prev) => {
      const nextMap = { ...prev, [selectedDateKey]: updated };
      try {
        localStorage.setItem('noor_routine_completed', JSON.stringify(nextMap));
      } catch {
        // ignore
      }
      return nextMap;
    });
  };

  const toggleSubPart = (task: RoutineTask, subId: string) => {
    const current = completedByDate[selectedDateKey] || [];
    const subIds = task.subParts?.map((s) => s.id) || [];

    // Expand legacy whole-task id into individual sub-part ids first
    let expanded = current.includes(task.id)
      ? Array.from(new Set([...current.filter((id) => id !== task.id), ...subIds]))
      : [...current];

    if (expanded.includes(subId)) {
      expanded = expanded.filter((id) => id !== subId);
    } else {
      expanded.push(subId);
    }
    saveCompletedForDay(expanded);
  };

  const toggleTask = (task: RoutineTask) => {
    const current = completedByDate[selectedDateKey] || [];
    if (task.subParts && task.subParts.length > 0) {
      const subIds = task.subParts.map((s) => s.id);
      const allDone = isTaskFullyDone(current, task);
      const cleaned = current.filter((id) => id !== task.id && !subIds.includes(id));
      const updated = allDone ? cleaned : [...cleaned, ...subIds];
      saveCompletedForDay(updated);
      return;
    }

    const exists = current.includes(task.id);
    const updated = exists ? current.filter((id) => id !== task.id) : [...current, task.id];
    saveCompletedForDay(updated);
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    const newTask: RoutineTask = {
      id: `custom_${Date.now()}`,
      title: trimmed,
      subtitle: 'ব্যক্তিগত দৈনিক আমল',
      period: newTaskWaqt as RoutinePeriod,
      waqt: newTaskWaqt,
      timeHint: 'ব্যক্তিগত লক্ষ্য',
      points: 10,
    };
    const next = [...customTasks, newTask];
    setCustomTasks(next);
    setNewTaskTitle('');
    setIsAddingTask(false);
    try {
      localStorage.setItem('noor_custom_tasks', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleRemoveCustomTask = (id: string) => {
    const next = customTasks.filter((t) => t.id !== id);
    setCustomTasks(next);
    try {
      localStorage.setItem('noor_custom_tasks', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const resetToday = () => {
    saveCompletedForDay([]);
  };

  const filteredTasks = useMemo(
    () =>
      waqtFilter === 'all'
        ? allTasks
        : allTasks.filter((t) => resolveTaskWaqt(t) === waqtFilter),
    [allTasks, waqtFilter]
  );

  const completedUnits = countUnitsForIds(completedIds);
  const completionPct = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  const activeWaqt = getActiveWaqtStatus(schedule, now);

  const liveClockStr = formatClock12h(now);

  const weekDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        key: getDateKey(d),
        dayName: BN_DAYS[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 6,
      };
    });
  }, []);

  const banglaDate = getBanglaDateInfo(now);
  const englishDate = getEnglishDateInfo(now);

  return (
    <div className="space-y-6">
      {/* Subtle Top Bismillah & All-3-Calendar Strip (Bangla Year, English, Arabic Hijri) */}
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-[#2E423B] dark:text-[#D5EAE3]">
            <span className="font-bold text-[#063D34] dark:text-[#F6DC9B]">
              {schedule.locationLabel}
            </span>
            <span aria-hidden="true" className="text-[#8FA49C]">·</span>
            <span>বাংলা: {banglaDate.fullBn}</span>
            <span aria-hidden="true" className="text-[#8FA49C]">·</span>
            <span>ইংরেজি: {englishDate.fullEn}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-[#475A53] dark:text-[#A9C4BB]">
            <span>হিজরি: {schedule.hijriDateBn}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0D6E52]/25 bg-white px-3 text-xs font-bold text-[#063D34] shadow-sm transition-colors hover:border-[#0D6E52]/50 hover:bg-[#0D6E52]/5 dark:border-[#E7C57B]/30 dark:bg-white/10 dark:text-[#F6DC9B] dark:hover:bg-white/15"
          >
            <Calendar className="h-3.5 w-3.5 text-[#0D6E52] dark:text-[#6EE7B7]" />
            <span>সব ক্যালেন্ডার</span>
          </button>

          <p
            dir="rtl"
            className="font-arabic shrink-0 text-base font-semibold leading-normal text-[#063D34] dark:text-[#F6DC9B] sm:text-lg"
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        </div>
      </div>

      {/* Redesigned Sanctuary Hero Thumbnail Card */}
      <section className="relative overflow-hidden rounded-3xl border border-[#0D6E52]/20 bg-[#06241E] shadow-xl dark:border-[#E7C57B]/20">
        {!heroImgError ? (
          <img
            src={HERO_MEDINA_IMG}
            alt="মসজিদ প্রাঙ্গণ ও সোনালী আলো"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        ) : (
          <div className="bg-islamic-lattice absolute inset-0 bg-gradient-to-br from-[#083D34] via-[#051E1A] to-[#030F0D]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[#041B16]/88 via-[#072A22]/78 to-[#041410]/94" />

        <div className="relative z-10 p-3 sm:p-4">
          {/* Compact Single-Line Controls Bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#E0EFEA]">
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#E7C57B]" />
                <label htmlFor="city-select" className="sr-only">
                  শহর নির্বাচন করুন
                </label>
                <select
                  id="city-select"
                  value={selectedCityId}
                  onChange={(e) => onChangeCityId(e.target.value)}
                  className="min-h-[32px] rounded-lg border border-white/20 bg-[#0A2E25] px-2 text-xs font-semibold text-white focus:outline-none"
                >
                  {CITY_PRESETS.map((city) => (
                    <option key={city.id} value={city.id} className="bg-[#06241E] text-white">
                      {city.nameBn}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onUseLocation}
                className="flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-white/20 bg-[#0A2E25] px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-[#114236]"
              >
                <Compass className="h-3 w-3 text-[#6EE7B7]" />
                <span>GPS</span>
              </button>

              <span className="font-mono-num inline-flex items-center gap-1 text-xs font-semibold text-[#F6DC9B] sm:pl-1">
                <Clock className="h-3 w-3" />
                {liveClockStr}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleNotifications}
                className={`flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                  notificationsEnabled
                    ? 'border-[#6EE7B7]/45 bg-[#0D6E52] text-[#E8FFF6] hover:bg-[#0A5A43]'
                    : 'border-white/20 bg-[#0A2E25] text-[#D7EAE3] hover:bg-[#114236]'
                }`}
                aria-label={
                  notificationsEnabled
                    ? 'নামাজ ও আমলের নোটিফিকেশন চালু আছে'
                    : 'নামাজ ও আমলের নোটিফিকেশন বন্ধ আছে'
                }
              >
                {notificationsEnabled ? (
                  <>
                    <Bell className="h-3 w-3 text-[#6EE7B7]" />
                    <span>রিমাইন্ডার চালু</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3 text-[#F6DC9B]" />
                    <span>রিমাইন্ডার বন্ধ</span>
                  </>
                )}
              </button>

              <PWAInstallButton />

              <button
                type="button"
                onClick={onToggleTheme}
                className="flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E7C57B]/35 bg-[#0A2E25] px-2.5 text-[11px] font-semibold text-[#F6DC9B] transition-colors hover:bg-[#114236]"
                title="থিম বদলাতে ট্যাপ করুন"
              >
                {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                <span>{APP_THEMES.find((t) => t.id === appTheme)?.labelBn || 'থিম'}</span>
              </button>
            </div>
          </div>

          {/* Compact Live Active Waqt Spotlight + Next Waqt Summary */}
          <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-12">
            {/* Active Current Waqt Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#E7C57B]/35 bg-[#06221C]/90 p-3.5 lg:col-span-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-[#F6DC9B]">
                    বর্তমান চলমান ওয়াক্ত
                  </span>
                  <h2 className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                    {activeWaqt.activeTitleBn}
                  </h2>
                  <p className="font-mono-num text-xs font-bold text-[#6EE7B7] sm:text-sm">
                    {activeWaqt.activeRangeBn}
                  </p>
                </div>

                <div className="text-right">
                  <span className="block text-[10px] text-[#A9D1C4]">
                    {activeWaqt.remainingLabelBn}
                  </span>
                  <span className="font-mono-num text-xl font-bold tracking-tight text-[#F6DC9B] sm:text-2xl">
                    {activeWaqt.remainingCountdown}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#34B38A] to-[#F6DC9B] transition-all duration-700"
                  style={{ width: `${activeWaqt.progressPct}%` }}
                />
              </div>
            </div>

            {/* Upcoming & Essential Daily Boundaries */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/15 bg-[#06221C]/85 p-3.5 lg:col-span-5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-[#A9C4BB]">
                    পরবর্তী ওয়াক্ত · <strong className="text-white">{activeWaqt.nextTitleBn}</strong>
                  </p>
                  <p className="font-mono-num text-[11px] font-medium text-[#CBE2DA]">
                    {activeWaqt.nextRangeBn}
                  </p>
                </div>
                <span className="font-mono-num shrink-0 text-xs font-bold text-[#F6DC9B]">
                  {activeWaqt.nextStartsIn} পর
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-4 gap-1.5 border-t border-white/10 pt-2 text-[11px]">
                <div>
                  <p className="text-[10px] text-[#A9C4BB]">তাহাজ্জুদ</p>
                  <p className="font-mono-num font-bold text-white">
                    {formatTime12h(activeWaqt.tahajjudStart)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#A9C4BB]">সেহরি শেষ</p>
                  <p className="font-mono-num font-bold text-[#F6DC9B]">
                    {formatTime12h(activeWaqt.sehriEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#A9C4BB]">সূর্যোদয়</p>
                  <p className="font-mono-num font-bold text-white">
                    {formatTime12h(activeWaqt.sunrise)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#A9C4BB]">ইফতার</p>
                  <p className="font-mono-num font-bold text-[#6EE7B7]">
                    {formatTime12h(activeWaqt.iftarTime)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Compact 8-Slot Time Ranges (From - To) */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {activeWaqt.slots.map((slot) => (
              <div
                key={slot.id}
                className={`rounded-xl border px-2.5 py-1.5 transition-colors ${
                  slot.isActive
                    ? 'border-[#E7C57B] bg-[#0E4034] shadow-sm'
                    : 'border-white/12 bg-[#07261F]/85'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={`truncate text-[11px] font-bold ${
                      slot.isActive ? 'text-[#F6DC9B]' : 'text-[#CFE3DC]'
                    }`}
                  >
                    {slot.labelBn}
                  </p>
                  {slot.isActive && (
                    <span className="shrink-0 text-[9px] font-bold text-[#6EE7B7]">চলছে</span>
                  )}
                </div>
                <p className="font-mono-num mt-0.5 text-[11.5px] font-bold leading-tight text-white">
                  {slot.rangeTextBn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Quranic Ayah + Daily Sahih Hadith Pair */}
      {(() => {
        const daySeed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
        const dailyHadith =
          RIYAD_CURATED_HADITHS[daySeed % RIYAD_CURATED_HADITHS.length] ||
          RIYAD_CURATED_HADITHS[0];

        return (
          <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {/* Daily Quran Ayah Card */}
            <div className="relative flex flex-col justify-between gap-2.5 overflow-hidden rounded-2xl border border-[#E7C57B]/25 bg-[#07362E] bg-gradient-to-br from-[#07362E] to-[#041B17] p-4 text-white shadow-[0_12px_28px_rgba(4,24,21,0.22)] sm:p-5">
              <div className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative z-10">
                <p className="text-[11px] font-semibold text-[#E7C57B]">
                  আজকের কুরআনের আয়াত · সূরা আর-রাদ ১৩:২৮
                </p>
                <p
                  dir="rtl"
                  className="font-arabic mt-2.5 text-right text-xl leading-[2.0] text-[#F6DC9B] sm:text-2xl"
                >
                  أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
                </p>
              </div>
              <p className="relative z-10 text-xs leading-relaxed text-[#D6E8E1] sm:text-sm">
                “জেনে রেখো, আল্লাহর যিকিরেই কেবল অন্তরসমূহ প্রশান্তি লাভ করে।”
              </p>
            </div>

            {/* Daily Sahih Hadith Card */}
            <div className="relative flex flex-col justify-between gap-2.5 overflow-hidden rounded-2xl border border-[#E7C57B]/25 bg-[#07362E] bg-gradient-to-br from-[#083A31] to-[#041B17] p-4 text-white shadow-[0_12px_28px_rgba(4,24,21,0.22)] sm:p-5">
              <div className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative z-10">
                <p className="text-[11px] font-semibold text-[#E7C57B]">
                  আজকের সহীহ হাদিস · {dailyHadith.gradeBn} ({dailyHadith.chapterBn})
                </p>
                {dailyHadith.arabic && (
                  <p
                    dir="rtl"
                    className="font-arabic mt-2.5 text-right text-lg leading-[1.95] text-[#F6DC9B] sm:text-xl"
                  >
                    {dailyHadith.arabic}
                  </p>
                )}
              </div>
              <p className="relative z-10 text-xs leading-relaxed text-[#D6E8E1] sm:text-sm">
                {dailyHadith.text}
              </p>
            </div>
          </section>
        );
      })()}

      {/* Clean Featured Digital Tasbih Card */}
      <section>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.16 }}
          onClick={onOpenTasbih}
          className="glass-card group flex w-full items-center justify-between gap-4 rounded-2xl border border-[#0D6E52]/20 p-4 text-left transition-colors hover:border-[#E7C57B]/55 dark:border-[#E7C57B]/20 sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D6E52] to-[#063D34] text-[#F6DC9B] shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-base">
                ডিজিটাল তাসবিহ ও স্মার্ট যিকির কাউন্টার
              </h2>
              <p className="mt-0.5 truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                সুবহানাল্লাহ · আলহামদুলিল্লাহ · আল্লাহু আকবার · লা ইলাহা ইল্লাল্লাহ
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E7C57B] to-[#C8963E] px-3.5 py-2 text-xs font-bold text-[#041815] shadow-sm">
            <span>গণনা শুরু</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </motion.button>
      </section>

      {/* Interactive Routine Tracker Section */}
      <section className="glass-card rounded-3xl p-5 md:p-7">
        <div className="flex flex-col justify-between gap-4 border-b border-[#0D6E52]/10 pb-5 dark:border-white/10 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                দৈনিক আমল ও ইবাদত রুটিন
              </h2>
              <span className="font-mono-num text-sm font-bold text-[#0D6E52] dark:text-[#F6DC9B]">
                {completedUnits}/{totalUnits} ({completionPct}%)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
              প্রতিটি ওয়াক্ত ও রাকাত আলাদাভাবে টিক দিন · আপনার অগ্রগতি ডিভাইসে সংরক্ষিত থাকবে
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingTask((v) => !v)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 py-2 text-xs font-semibold text-[#F6DC9B] shadow-sm transition-opacity hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span className="whitespace-nowrap">নিজস্ব আমল যোগ করুন</span>
            </button>
            <button
              type="button"
              onClick={resetToday}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#0D6E52]/15 text-[#475A53] transition-colors hover:bg-[#F1F5F3] dark:border-white/15 dark:text-[#A3BDB4] dark:hover:bg-white/10"
              aria-label="আজকের রুটিন রিসেট করুন"
              title="আজকের রুটিন রিসেট"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#E6ECE9] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#34B38A] via-[#0D6E52] to-[#F6DC9B] transition-[width] duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Add Custom Routine Inline Form */}
        {isAddingTask && (
          <form
            onSubmit={handleAddCustomTask}
            className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#0D6E52]/20 bg-[#F4F8F6] p-4 dark:border-[#E7C57B]/20 dark:bg-black/30 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="যেমন: পিতা-মাতার জন্য দুআ বা সূরা ওয়াকিয়াহ পাঠ..."
              className="min-h-[44px] flex-1 rounded-xl border border-[#E2E8E5] bg-white px-3.5 text-sm text-[#0F1F1A] placeholder:text-[#7D9089] focus:border-[#0D6E52] focus:outline-none dark:border-white/15 dark:bg-[#091815] dark:text-[#F0F5F3]"
            />
            <select
              value={newTaskWaqt}
              onChange={(e) => setNewTaskWaqt(e.target.value as RoutineWaqt)}
              aria-label="ওয়াক্ত নির্বাচন"
              className="min-h-[44px] rounded-xl border border-[#E2E8E5] bg-white px-3 text-sm text-[#0F1F1A] dark:border-white/15 dark:bg-[#091815] dark:text-[#F0F5F3]"
            >
              <option value="fajr">ফজর</option>
              <option value="dhuhr">যোহর</option>
              <option value="asr">আসর</option>
              <option value="maghrib">মাগরিব</option>
              <option value="isha">ইশা</option>
            </select>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#F6DC9B] to-[#C8963E] px-5 text-sm font-bold text-[#041815]"
            >
              সংরক্ষণ
            </button>
          </form>
        )}

        {/* 7-Day Horizontal Date Scroller */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {weekDates.map((d) => {
            const active = selectedDateKey === d.key;
            const dayDoneUnits = countUnitsForIds(completedByDate[d.key] || []);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDateKey(d.key)}
                className={`flex min-h-[58px] min-w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 transition-all ${
                  active
                    ? 'border-[#E7C57B]/70 bg-gradient-to-b from-[#0A4E41] to-[#052922] text-white shadow-md'
                    : 'border-[#0D6E52]/10 bg-[#F6F9F8] text-[#475A53] hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#A3BDB4]'
                }`}
              >
                <span className={`text-[11px] font-medium ${active ? 'text-[#F6DC9B]' : ''}`}>
                  {d.isToday ? 'আজ' : d.dayName}
                </span>
                <span className="font-mono-num text-base font-bold">{d.dayNum}</span>
                <span
                  className={`font-mono-num text-[10px] ${
                    active ? 'text-[#D6F5EA]' : 'text-[#7A8E86]'
                  }`}
                >
                  {dayDoneUnits}/{totalUnits}
                </span>
              </button>
            );
          })}
        </div>

        {/* Per-Waqt Filter Segmented Bar */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-[#EFF3F1] p-1.5 dark:bg-black/30">
          {WAQT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setWaqtFilter(f.id)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-all ${
                waqtFilter === f.id
                  ? 'bg-white text-[#063D34] shadow-sm dark:bg-[#10332B] dark:text-[#F6DC9B]'
                  : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8] dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Interactive Tap Checklist Rows with Per-Rakat Sub-Parts */}
        <div className="mt-4 divide-y divide-[#0D6E52]/10 dark:divide-white/10">
          {filteredTasks.map((task) => {
            const hasSubParts = Boolean(task.subParts && task.subParts.length > 0);
            const isDone = isTaskFullyDone(completedIds, task);
            const donePartsCount = hasSubParts
              ? task.subParts!.filter((s) => isSubPartDone(completedIds, task, s.id)).length
              : 0;
            const isPartial = hasSubParts && donePartsCount > 0 && !isDone;
            const isCustom = task.id.startsWith('custom_');

            return (
              <div key={task.id} className="py-3.5">
                <div className="flex min-h-[54px] items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <motion.span
                      whileTap={{ scale: 0.85 }}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isDone
                          ? 'border-[#E7C57B]/70 bg-gradient-to-br from-[#0D6E52] to-[#063D34] text-[#F6DC9B] shadow-sm'
                          : isPartial
                          ? 'border-[#0D6E52] bg-[#0D6E52]/15 text-[#0D6E52] dark:border-[#E7C57B]/60 dark:text-[#F6DC9B]'
                          : 'border-[#C5D1CC] bg-white dark:border-white/20 dark:bg-white/[0.04]'
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : isPartial ? (
                        <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                      ) : null}
                    </motion.span>

                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold transition-colors md:text-base ${
                          isDone
                            ? 'text-[#7A8E86] line-through dark:text-[#6B827A]'
                            : 'text-[#0F1F1A] dark:text-[#F0F5F3]'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                        {task.timeHint} ·{' '}
                        {isPartial
                          ? `${donePartsCount}টি অংশ আদায় হয়েছে`
                          : isDone && hasSubParts
                          ? 'সব অংশ আদায় হয়েছে'
                          : task.subtitle}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {task.id === 'hadith_study' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('hadith')}
                          className="min-h-[38px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-2.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                        >
                          হাদিস
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('seerah')}
                          className="min-h-[38px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-2.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                        >
                          সীরাত
                        </button>
                      </>
                    ) : task.id === 'evening_azkar' && onOpenAmol ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenAmol('azkar', 'evening')}
                          className="min-h-[38px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-2.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                        >
                          সন্ধ্যার আমল
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAmol('manzil', 'all')}
                          className="min-h-[38px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-2.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                        >
                          ৩৩ আয়াত
                        </button>
                      </>
                    ) : task.linkedTab === 'ruqyah' && task.ruqyahSubTab && onOpenAmol ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAmol(task.ruqyahSubTab!, task.azkarTimeFilter || 'all')
                        }
                        className="min-h-[40px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-3.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                      >
                        হিসনুল মুসলিম
                      </button>
                    ) : task.linkedTab ? (
                      <button
                        type="button"
                        onClick={() => onNavigateTab(task.linkedTab!)}
                        className="min-h-[40px] whitespace-nowrap rounded-xl border border-[#0D6E52]/20 bg-[#F4F8F6] px-3.5 text-xs font-semibold text-[#0D6E52] transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/25 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/15"
                      >
                        খুলুন
                      </button>
                    ) : null}
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomTask(task.id)}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#7A8E86] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                        aria-label="মুছে ফেলুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Individual Rakat / Prayer Part Check Buttons */}
                {hasSubParts && (
                  <div className="mt-2.5 flex flex-wrap gap-2 pl-10">
                    {task.subParts!.map((part) => {
                      const partDone = isSubPartDone(completedIds, task, part.id);
                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => toggleSubPart(task, part.id)}
                          className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                            partDone
                              ? 'border-[#0D6E52] bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm dark:border-[#E7C57B]/60'
                              : 'border-[#D5E0DC] bg-[#F7FAF9] text-[#2F463F] hover:border-[#0D6E52]/40 dark:border-white/15 dark:bg-white/[0.04] dark:text-[#C5D8D1] dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              partDone
                                ? 'border-[#F6DC9B] bg-[#F6DC9B] text-[#041815]'
                                : 'border-[#9FB3AC] dark:border-white/30'
                            }`}
                          >
                            {partDone && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span className="whitespace-nowrap">{part.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <TriCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        apiHijriParts={schedule.hijriParts}
      />
    </div>
  );
};
