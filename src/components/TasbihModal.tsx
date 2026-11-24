import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hand,
  Info,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { TASBIH_PRESETS } from '../data/islamicData';
import type { TasbihPreset } from '../types/islamic';
import {
  computeHijriAlignmentOffset,
  getBanglaDateInfo,
  getEnglishDateInfo,
  getHijriDateInfo,
  toBanglaDigits,
} from '../utils/timeFormat';

interface TasbihModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiHijriParts?: { day: number; month: number; year: number };
}

interface TasbihLogEntry {
  id: string;
  tasbihId: string;
  labelBn: string;
  count: number;
  timestamp: number;
  source: 'tap' | 'manual';
}

interface TasbihDayLog {
  counts: Record<string, number>;
  customLabels?: Record<string, string>;
  entries: TasbihLogEntry[];
}

type TasbihLogsMap = Record<string, TasbihDayLog>;
type ModalTab = 'counter' | 'calendar';

const LOGS_STORAGE_KEY = 'noor_tasbih_logs_v1';
const TOTAL_STORAGE_KEY = 'noor_tasbih_total';
const WEEK_HEADERS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const QUICK_MANUAL_AMOUNTS = [10, 33, 34, 100, 500, 1000];

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatTimestamp12h(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const mins = d.getMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${toBanglaDigits(h12)}:${toBanglaDigits(String(mins).padStart(2, '0'))} ${period}`;
}

function sumDayCounts(dayLog?: TasbihDayLog): number {
  if (!dayLog?.counts) return 0;
  return Object.values(dayLog.counts).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function loadTasbihLogs(): TasbihLogsMap {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TasbihLogsMap) : {};
  } catch {
    return {};
  }
}

function saveTasbihLogs(logs: TasbihLogsMap) {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore storage errors
  }
}

export const TasbihModal: React.FC<TasbihModalProps> = ({
  isOpen,
  onClose,
  apiHijriParts,
}) => {
  const [activeModalTab, setActiveModalTab] = useState<ModalTab>('counter');
  const [selectedId, setSelectedId] = useState<string>(TASBIH_PRESETS[0].id);
  const [count, setCount] = useState<number>(0);
  const [target, setTarget] = useState<number>(33);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const [logs, setLogs] = useState<TasbihLogsMap>(() => loadTasbihLogs());
  const [totalLifetime, setTotalLifetime] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(TOTAL_STORAGE_KEY) || '0');
    } catch {
      return 0;
    }
  });

  // Manual entry form state ("হাতে পড়া যোগ করুন")
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualTasbihId, setManualTasbihId] = useState<string>(TASBIH_PRESETS[0].id);
  const [manualCustomLabel, setManualCustomLabel] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('33');
  const [manualDateKey, setManualDateKey] = useState<string>(() => getLocalDateKey(new Date()));
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

  // Calendar tab state
  const [today] = useState<Date>(() => new Date());
  const todayKey = useMemo(() => getLocalDateKey(today), [today]);
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getLocalDateKey(new Date()));
  const [infoPreset, setInfoPreset] = useState<TasbihPreset | null>(null);

  const preset = TASBIH_PRESETS.find((p) => p.id === selectedId) || TASBIH_PRESETS[0];

  const hijriOffset = useMemo(
    () => computeHijriAlignmentOffset(apiHijriParts, today),
    [apiHijriParts, today]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (infoPreset) setInfoPreset(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, infoPreset]);

  useEffect(() => {
    if (!manualFeedback) return;
    const t = setTimeout(() => setManualFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [manualFeedback]);

  const persistLifetime = (nextTotal: number) => {
    const safe = Math.max(0, nextTotal);
    setTotalLifetime(safe);
    try {
      localStorage.setItem(TOTAL_STORAGE_KEY, String(safe));
    } catch {
      // ignore
    }
  };

  const playGentleTap = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.055);
    } catch {
      // ignore
    }
  };

  const handleTap = () => {
    playGentleTap();
    setCount((c) => c + 1);
    persistLifetime(totalLifetime + 1);

    const nowTs = Date.now();
    const key = getLocalDateKey(new Date(nowTs));

    setLogs((prev) => {
      const dayLog: TasbihDayLog = prev[key] || { counts: {}, entries: [] };
      const nextCounts = {
        ...dayLog.counts,
        [preset.id]: (dayLog.counts[preset.id] || 0) + 1,
      };

      const entries = [...(dayLog.entries || [])];
      const latest = entries[0];
      // Coalesce consecutive tap recitations of the same zikr within 10 minutes
      if (
        latest &&
        latest.source === 'tap' &&
        latest.tasbihId === preset.id &&
        nowTs - latest.timestamp < 10 * 60 * 1000
      ) {
        entries[0] = {
          ...latest,
          count: latest.count + 1,
          timestamp: nowTs,
        };
      } else {
        entries.unshift({
          id: `tap-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
          tasbihId: preset.id,
          labelBn: preset.labelBn,
          count: 1,
          timestamp: nowTs,
          source: 'tap',
        });
      }

      const nextLogs: TasbihLogsMap = {
        ...prev,
        [key]: {
          ...dayLog,
          counts: nextCounts,
          entries,
        },
      };
      saveTasbihLogs(nextLogs);
      return nextLogs;
    });
  };

  const handleSelectPreset = (id: string) => {
    const found = TASBIH_PRESETS.find((p) => p.id === id);
    setSelectedId(id);
    setManualTasbihId(id);
    setCount(0);
    if (found) setTarget(found.defaultTarget);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.floor(Number(manualAmount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const isCustom = manualTasbihId === 'custom';
    const customName = manualCustomLabel.trim();
    if (isCustom && !customName) return;

    const presetObj = TASBIH_PRESETS.find((p) => p.id === manualTasbihId);
    const effectiveId = isCustom ? `custom:${customName}` : presetObj?.id || TASBIH_PRESETS[0].id;
    const effectiveLabel = isCustom ? customName : presetObj?.labelBn || TASBIH_PRESETS[0].labelBn;
    const targetDateKey = manualDateKey || todayKey;
    const nowTs = Date.now();

    setLogs((prev) => {
      const dayLog: TasbihDayLog = prev[targetDateKey] || { counts: {}, entries: [] };
      const nextCounts = {
        ...dayLog.counts,
        [effectiveId]: (dayLog.counts[effectiveId] || 0) + parsedAmount,
      };
      const nextCustomLabels = isCustom
        ? { ...(dayLog.customLabels || {}), [effectiveId]: customName }
        : dayLog.customLabels;

      const entries: TasbihLogEntry[] = [
        {
          id: `manual-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
          tasbihId: effectiveId,
          labelBn: effectiveLabel,
          count: parsedAmount,
          timestamp: nowTs,
          source: 'manual',
        },
        ...(dayLog.entries || []),
      ];

      const nextLogs: TasbihLogsMap = {
        ...prev,
        [targetDateKey]: {
          counts: nextCounts,
          customLabels: nextCustomLabels,
          entries,
        },
      };
      saveTasbihLogs(nextLogs);
      return nextLogs;
    });

    persistLifetime(totalLifetime + parsedAmount);

    if (targetDateKey === todayKey && effectiveId === selectedId) {
      setCount((c) => c + parsedAmount);
    }

    setSelectedDateKey(targetDateKey);
    const parsedTarget = parseLocalDateKey(targetDateKey);
    setViewYear(parsedTarget.getFullYear());
    setViewMonth(parsedTarget.getMonth());

    setManualFeedback(
      `${effectiveLabel} — ${toBanglaDigits(parsedAmount)} বার হাতে পড়া হিসেবে যুক্ত হয়েছে`
    );
    if (isCustom) {
      setManualCustomLabel('');
    }
  };

  const handleDeleteEntry = (dateKey: string, entryId: string) => {
    const dayLog = logs[dateKey];
    if (!dayLog) return;
    const targetEntry = dayLog.entries?.find((en) => en.id === entryId);
    if (!targetEntry) return;

    setLogs((prev) => {
      const current = prev[dateKey];
      if (!current) return prev;
      const nextEntries = (current.entries || []).filter((en) => en.id !== entryId);
      const nextCounts = { ...current.counts };
      const updatedVal = Math.max(0, (nextCounts[targetEntry.tasbihId] || 0) - targetEntry.count);
      if (updatedVal === 0) {
        delete nextCounts[targetEntry.tasbihId];
      } else {
        nextCounts[targetEntry.tasbihId] = updatedVal;
      }

      const nextLogs: TasbihLogsMap = {
        ...prev,
        [dateKey]: {
          ...current,
          counts: nextCounts,
          entries: nextEntries,
        },
      };
      saveTasbihLogs(nextLogs);
      return nextLogs;
    });

    persistLifetime(totalLifetime - targetEntry.count);
  };

  const todayTotal = useMemo(() => sumDayCounts(logs[todayKey]), [logs, todayKey]);
  const todaySelectedPresetTotal = logs[todayKey]?.counts?.[preset.id] || 0;

  // Calendar month cells
  const monthCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: new Date(viewYear, viewMonth, -i), inCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(viewYear, viewMonth, d), inCurrentMonth: true });
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let t = 1; t <= trailing; t++) {
      cells.push({ date: new Date(viewYear, viewMonth + 1, t), inCurrentMonth: false });
    }

    return cells.map((cell) => {
      const key = getLocalDateKey(cell.date);
      return {
        ...cell,
        key,
        dayTotal: sumDayCounts(logs[key]),
        hijri: getHijriDateInfo(cell.date, hijriOffset),
      };
    });
  }, [viewYear, viewMonth, logs, hijriOffset]);

  const monthStats = useMemo(() => {
    let totalCount = 0;
    let activeDays = 0;
    for (const cell of monthCells) {
      if (cell.inCurrentMonth && cell.dayTotal > 0) {
        totalCount += cell.dayTotal;
        activeDays += 1;
      }
    }
    return { totalCount, activeDays };
  }, [monthCells]);

  const monthTitleBn = useMemo(() => {
    const sample = new Date(viewYear, viewMonth, 1);
    const enInfo = getEnglishDateInfo(sample);
    const hijriInfo = getHijriDateInfo(sample, hijriOffset);
    return {
      en: `${enInfo.monthNameEn} ${enInfo.year}`,
      hijri: `${hijriInfo.monthNameBn} ${hijriInfo.yearBn} হিজরি`,
    };
  }, [viewYear, viewMonth, hijriOffset]);

  const selectedDateObj = useMemo(() => parseLocalDateKey(selectedDateKey), [selectedDateKey]);
  const selectedBangla = useMemo(() => getBanglaDateInfo(selectedDateObj), [selectedDateObj]);
  const selectedEnglish = useMemo(() => getEnglishDateInfo(selectedDateObj), [selectedDateObj]);
  const selectedHijri = useMemo(
    () => getHijriDateInfo(selectedDateObj, hijriOffset),
    [selectedDateObj, hijriOffset]
  );

  const selectedDayLog = logs[selectedDateKey];
  const selectedDayTotal = sumDayCounts(selectedDayLog);

  const selectedDayBreakdown = useMemo(() => {
    if (!selectedDayLog?.counts) return [];
    return Object.entries(selectedDayLog.counts)
      .filter(([, val]) => (Number(val) || 0) > 0)
      .map(([id, val]) => {
        const foundPreset = TASBIH_PRESETS.find((p) => p.id === id);
        const labelBn =
          foundPreset?.labelBn ||
          selectedDayLog.customLabels?.[id] ||
          (id.startsWith('custom:') ? id.replace('custom:', '') : id);
        return {
          id,
          labelBn,
          arabic: foundPreset?.arabic || '',
          count: Number(val) || 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [selectedDayLog]);

  if (!isOpen) return null;

  const progressPct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progressPct / 100) * circumference;

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDateKey(getLocalDateKey(now));
  };

  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#04100C]/65 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ডিজিটাল তাসবিহ কাউন্টার ও ক্যালেন্ডার"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#0D6E52]/20 bg-white shadow-2xl dark:border-[#244238] dark:bg-[#0D1A16] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Royal Emerald Header */}
        <div className="relative shrink-0 overflow-hidden bg-[#063D34] bg-gradient-to-br from-[#063D34] to-[#0B5D4E] px-5 py-4 text-white">
          <div className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">ডিজিটাল তাসবিহ</h2>
              <div className="font-mono-num flex flex-wrap items-center gap-x-3 text-xs text-[#E7C57B]">
                <span>আজ: {toBanglaDigits(todayTotal)} বার</span>
                <span className="text-white/45">•</span>
                <span>সর্বমোট: {toBanglaDigits(totalLifetime)} বার</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={soundEnabled ? 'ট্যাপ শব্দ বন্ধ করুন' : 'ট্যাপ শব্দ চালু করুন'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              {activeModalTab === 'counter' && (
                <button
                  type="button"
                  onClick={() => setCount(0)}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="রিসেট করুন"
                  title="বর্তমান রাউন্ড রিসেট"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="বন্ধ করুন"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 2-Tab Segmented Switcher */}
          <div className="relative z-10 mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-black/25 p-1">
            <button
              type="button"
              onClick={() => setActiveModalTab('counter')}
              className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all ${
                activeModalTab === 'counter'
                  ? 'bg-gradient-to-r from-[#E7C57B] to-[#C8963E] text-[#041D18] shadow-sm'
                  : 'text-[#DCEBE5] hover:bg-white/10'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>গণনা ও হাতে যোগ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('calendar')}
              className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all ${
                activeModalTab === 'calendar'
                  ? 'bg-gradient-to-r from-[#E7C57B] to-[#C8963E] text-[#041D18] shadow-sm'
                  : 'text-[#DCEBE5] hover:bg-white/10'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>তাসবিহ ক্যালেন্ডার</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeModalTab === 'counter' ? (
            <div>
              {/* Preset Selector */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {TASBIH_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPreset(item.id)}
                    className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                      selectedId === item.id
                        ? 'bg-[#063D34] text-[#E7C57B] shadow-sm dark:bg-[#195E4B] dark:text-white'
                        : 'bg-[#F1F5F3] text-[#475A53] hover:text-[#0F1F1A] dark:bg-[#13241E] dark:text-[#A3BDB4]'
                    }`}
                  >
                    {item.labelBn}
                  </button>
                ))}
              </div>

              {/* Main Tasbih Display Card (Larger Main Text, Meaning Below, Side Info Icon) */}
              <div className="relative mb-5 rounded-2xl border border-[#0D6E52]/15 bg-[#F6F9F8] px-10 py-4 text-center dark:border-[#1F352E] dark:bg-[#08120F]">
                <button
                  type="button"
                  onClick={() => setInfoPreset(preset)}
                  className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-[#0D6E52]/20 bg-white text-[#0D6E52] shadow-xs transition-colors hover:bg-[#0D6E52] hover:text-white dark:border-[#E7C57B]/30 dark:bg-[#13241E] dark:text-[#F6DC9B] dark:hover:bg-[#E7C57B] dark:hover:text-[#041D18]"
                  aria-label="এই তাসবিহর ফজিলত ও নিয়ম দেখুন"
                  title="কত বারের কী ফজিলত দেখুন"
                >
                  <Info className="h-4 w-4" />
                </button>

                <p
                  dir="rtl"
                  className={`font-arabic font-semibold text-[#0F1F1A] dark:text-[#F0F5F3] ${
                    preset.arabic.length > 80
                      ? 'text-xl leading-[2.0] sm:text-2xl'
                      : 'text-[28px] leading-[1.85] sm:text-3xl'
                  }`}
                >
                  {preset.arabic}
                </p>

                <p className="mt-2 text-base font-bold text-[#063D34] dark:text-[#6EE7B7] sm:text-lg">
                  {preset.labelBn}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-[#475A53] dark:text-[#A9C4BB] sm:text-sm">
                  অর্থ: {preset.meaningBn}
                </p>

                {todaySelectedPresetTotal > 0 && (
                  <p className="font-mono-num mt-2 text-[11px] font-bold text-[#B08438] dark:text-[#F6DC9B]">
                    আজ এটি পড়া হয়েছে: {toBanglaDigits(todaySelectedPresetTotal)} বার
                  </p>
                )}
              </div>

              {/* Luminous Tactile Dial */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleTap}
                  className="relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-b from-[#FFFFFF] to-[#EDF3F0] shadow-[0_12px_35px_rgba(6,61,52,0.14)] ring-1 ring-[#0D6E52]/10 dark:from-[#132620] dark:to-[#0A1612] dark:ring-[#34B38A]/20"
                  aria-label="তাসবিহ গণনা করতে ট্যাপ করুন"
                >
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
                    <defs>
                      <linearGradient id="tasbihGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0D6E52" />
                        <stop offset="100%" stopColor="#D4A853" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-[#E2E8E5] dark:text-[#1E342D]"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke="url(#tasbihGrad)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      className="transition-[stroke-dashoffset] duration-150"
                    />
                  </svg>
                  <div className="relative flex flex-col items-center">
                    <span className="font-mono-num text-5xl font-bold text-[#063D34] dark:text-[#F0F5F3]">
                      {count}
                    </span>
                    <span className="font-mono-num mt-1 text-xs font-medium text-[#B08438] dark:text-[#E7C57B]">
                      লক্ষ্য: {target}
                    </span>
                  </div>
                </motion.button>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {[10, 33, 34, 100, 1000].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTarget(t)}
                      className={`font-mono-num min-h-[38px] rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                        target === t
                          ? 'bg-[#063D34] text-[#E7C57B] dark:bg-[#238E6D] dark:text-white'
                          : 'bg-[#F1F5F3] text-[#475A53] hover:text-[#0F1F1A] dark:bg-[#13241E] dark:text-[#A3BDB4]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Entry ("হাতে পড়ে যোগ করুন") Section */}
              <div className="mt-5 border-t border-[#0D6E52]/10 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm((v) => !v);
                    setManualDateKey(todayKey);
                    setManualTasbihId(selectedId);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-[#D4A853]/35 bg-[#D4A853]/10 px-4 text-left text-xs font-bold text-[#063D34] transition-colors hover:bg-[#D4A853]/18 dark:border-[#E7C57B]/30 dark:bg-[#E7C57B]/10 dark:text-[#F6DC9B]"
                >
                  <span className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                    <span>হাতে পড়া তাসবিহ যোগ করুন</span>
                  </span>
                  <Plus
                    className={`h-4 w-4 transition-transform ${showManualForm ? 'rotate-45' : ''}`}
                  />
                </button>

                {manualFeedback && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#0D6E52]/25 bg-[#0D6E52]/10 px-3.5 py-2.5 text-xs font-semibold text-[#063D34] dark:border-[#6EE7B7]/30 dark:bg-[#0D6E52]/25 dark:text-[#E8FFF6]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#6EE7B7]" />
                    <span>{manualFeedback}</span>
                  </div>
                )}

                {showManualForm && (
                  <form
                    onSubmit={handleManualSubmit}
                    className="mt-3 space-y-3 rounded-2xl border border-black/10 bg-[#F6F9F8] p-4 dark:border-white/10 dark:bg-[#08120F]"
                  >
                    <div>
                      <label
                        htmlFor="manual-tasbih-select"
                        className="mb-1 block text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]"
                      >
                        কোন তাসবিহ পড়েছেন?
                      </label>
                      <select
                        id="manual-tasbih-select"
                        value={manualTasbihId}
                        onChange={(e) => setManualTasbihId(e.target.value)}
                        className="min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#0F1F1A] focus:border-[#0D6E52] focus:outline-none dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                      >
                        {TASBIH_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.labelBn}
                          </option>
                        ))}
                        <option value="custom">অন্যান্য (নিজস্ব যিকির লিখুন)</option>
                      </select>
                    </div>

                    {manualTasbihId === 'custom' && (
                      <div>
                        <label
                          htmlFor="manual-custom-label"
                          className="mb-1 block text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]"
                        >
                          যিকিরের নাম লিখুন
                        </label>
                        <input
                          id="manual-custom-label"
                          type="text"
                          value={manualCustomLabel}
                          onChange={(e) => setManualCustomLabel(e.target.value)}
                          placeholder="যেমন: হসবুনাল্লাহু ওয়া নি'মাল ওয়াকীল"
                          className="min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#0F1F1A] focus:border-[#0D6E52] focus:outline-none dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="manual-tasbih-count"
                        className="mb-1.5 block text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]"
                      >
                        কতবার পড়েছেন?
                      </label>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {QUICK_MANUAL_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setManualAmount(String(amt))}
                            className={`font-mono-num min-h-[32px] rounded-lg border px-2.5 text-xs font-bold transition-colors ${
                              Number(manualAmount) === amt
                                ? 'border-[#063D34] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                                : 'border-black/10 bg-white text-[#475A53] dark:border-white/10 dark:bg-[#13241E] dark:text-[#A3BDB4]'
                            }`}
                          >
                            +{toBanglaDigits(amt)}
                          </button>
                        ))}
                      </div>
                      <input
                        id="manual-tasbih-count"
                        type="number"
                        min={1}
                        max={100000}
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder="সংখ্যা লিখুন..."
                        className="font-mono-num min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-[#0F1F1A] focus:border-[#0D6E52] focus:outline-none dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="manual-tasbih-date"
                        className="mb-1.5 block text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]"
                      >
                        কোন তারিখে পড়েছেন?
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setManualDateKey(todayKey)}
                          className={`min-h-[36px] rounded-xl px-3 text-xs font-bold transition-colors ${
                            manualDateKey === todayKey
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'border border-black/10 bg-white text-[#475A53] dark:border-white/10 dark:bg-[#13241E] dark:text-[#A3BDB4]'
                          }`}
                        >
                          আজকে
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualDateKey(yesterdayKey)}
                          className={`min-h-[36px] rounded-xl px-3 text-xs font-bold transition-colors ${
                            manualDateKey === yesterdayKey
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'border border-black/10 bg-white text-[#475A53] dark:border-white/10 dark:bg-[#13241E] dark:text-[#A3BDB4]'
                          }`}
                        >
                          গতকাল
                        </button>
                        <input
                          id="manual-tasbih-date"
                          type="date"
                          value={manualDateKey}
                          max={todayKey}
                          onChange={(e) => setManualDateKey(e.target.value || todayKey)}
                          className="font-mono-num min-h-[36px] flex-1 rounded-xl border border-black/10 bg-white px-2.5 text-xs font-semibold text-[#0F1F1A] dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-xs font-bold text-[#F6DC9B] shadow-md transition-opacity hover:opacity-95"
                    >
                      <Plus className="h-4 w-4" />
                      <span>ক্যালেন্ডারে যোগ করুন</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* CALENDAR & PER-DATE TASBIH LOG TAB */
            <div className="space-y-4">
              {/* Month Navigation + Stats */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-[#F6F9F8] px-3.5 py-2.5 dark:border-white/10 dark:bg-[#08120F]">
                <div>
                  <p className="text-sm font-bold text-[#0F1F1A] dark:text-white">
                    {monthTitleBn.en}
                  </p>
                  <p className="text-[11px] font-medium text-[#8E621A] dark:text-[#F6DC9B]">
                    {monthTitleBn.hijri}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                    aria-label="পূর্ববর্তী মাস"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goToday}
                    className="min-h-[36px] rounded-xl bg-[#0D6E52] px-3 text-xs font-bold text-white hover:bg-[#0A5A43] dark:bg-[#E7C57B] dark:text-[#041D18]"
                  >
                    আজকে
                  </button>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-[#13241E] dark:text-white"
                    aria-label="পরবর্তী মাস"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Monthly Quick Summary */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-[#0D6E52]/15 bg-[#0D6E52]/[0.06] px-3.5 py-2.5 dark:border-[#6EE7B7]/20 dark:bg-[#0D6E52]/15">
                  <p className="text-[11px] font-semibold text-[#475A53] dark:text-[#A9C4BB]">
                    এই মাসে মোট যিকির
                  </p>
                  <p className="font-mono-num mt-0.5 text-base font-bold text-[#063D34] dark:text-[#F6DC9B]">
                    {toBanglaDigits(monthStats.totalCount)} বার
                  </p>
                </div>
                <div className="rounded-2xl border border-[#D4A853]/25 bg-[#D4A853]/10 px-3.5 py-2.5 dark:border-[#E7C57B]/25 dark:bg-[#D4A853]/10">
                  <p className="text-[11px] font-semibold text-[#475A53] dark:text-[#A9C4BB]">
                    সক্রিয় দিন
                  </p>
                  <p className="font-mono-num mt-0.5 text-base font-bold text-[#063D34] dark:text-[#F6DC9B]">
                    {toBanglaDigits(monthStats.activeDays)} দিন
                  </p>
                </div>
              </div>

              {/* 7-Column Calendar Grid */}
              <div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEK_HEADERS_BN.map((day, idx) => (
                    <div
                      key={day}
                      className={`py-1 text-[11px] font-bold ${
                        idx === 5
                          ? 'text-[#0D6E52] dark:text-[#6EE7B7]'
                          : 'text-[#556A62] dark:text-[#9BB0A8]'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {monthCells.map((cell) => {
                    const isToday = cell.key === todayKey;
                    const isSelected = cell.key === selectedDateKey;
                    const hasCount = cell.dayTotal > 0;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          setSelectedDateKey(cell.key);
                          if (!cell.inCurrentMonth) {
                            setViewYear(cell.date.getFullYear());
                            setViewMonth(cell.date.getMonth());
                          }
                        }}
                        className={`flex min-h-[54px] flex-col justify-between rounded-xl border p-1.5 text-left transition-colors ${
                          isSelected
                            ? 'border-[#0D6E52] bg-[#0D6E52]/14 ring-1 ring-[#0D6E52]/30 dark:border-[#F6DC9B] dark:bg-[#D4A853]/20 dark:ring-[#F6DC9B]/30'
                            : isToday
                            ? 'border-[#D4A853] bg-[#D4A853]/12 dark:border-[#6EE7B7]/55 dark:bg-[#0D6E52]/20'
                            : cell.inCurrentMonth
                            ? 'border-black/8 bg-white hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-[#13241E]/80'
                            : 'border-transparent bg-black/[0.02] opacity-40 dark:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex w-full items-start justify-between">
                          <span
                            className={`font-mono-num text-xs font-bold ${
                              isToday
                                ? 'text-[#0D6E52] dark:text-[#6EE7B7]'
                                : 'text-[#0F1F1A] dark:text-white'
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                          <span className="text-[9px] text-[#8A7548] dark:text-[#D4A853]/80">
                            {toBanglaDigits(cell.hijri.day)}
                          </span>
                        </div>

                        {hasCount ? (
                          <span className="font-mono-num mt-1 block w-full truncate rounded-md bg-[#063D34] px-1 py-0.5 text-center text-[9px] font-bold text-[#F6DC9B] dark:bg-[#0D6E52]">
                            {toBanglaDigits(cell.dayTotal)}
                          </span>
                        ) : (
                          <span className="h-3" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Date Detail Card */}
              <div className="rounded-2xl border border-black/10 bg-[#F6F9F8] p-4 dark:border-white/10 dark:bg-[#08120F]">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-black/8 pb-3 dark:border-white/10">
                  <div>
                    <p className="text-sm font-bold text-[#0F1F1A] dark:text-white">
                      {selectedDateKey === todayKey ? 'আজ · ' : ''}
                      {selectedEnglish.day} {selectedEnglish.monthNameEn} {selectedEnglish.year}
                    </p>
                    <p className="text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                      {selectedBangla.dayBn} {selectedBangla.monthNameBn} · {selectedHijri.fullBn}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-mono-num block text-sm font-bold text-[#0D6E52] dark:text-[#F6DC9B]">
                      মোট {toBanglaDigits(selectedDayTotal)} বার
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setManualDateKey(selectedDateKey);
                        setShowManualForm(true);
                        setActiveModalTab('counter');
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#0D6E52] underline dark:text-[#6EE7B7]"
                    >
                      <Plus className="h-3 w-3" />
                      <span>এই দিনে হাতে পড়া যোগ</span>
                    </button>
                  </div>
                </div>

                {selectedDayBreakdown.length === 0 ? (
                  <div className="py-5 text-center">
                    <p className="text-xs text-[#556A62] dark:text-[#9BB0A8]">
                      এই তারিখে কোনো তাসবিহ রেকর্ড করা হয়নি।
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setManualDateKey(selectedDateKey);
                        setShowManualForm(true);
                        setActiveModalTab('counter');
                      }}
                      className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B]"
                    >
                      <Hand className="h-3.5 w-3.5" />
                      <span>হাতে পড়া তাসবিহ যোগ করুন</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {/* Per-Tasbih Count Summary */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]">
                        কোন তাসবিহ কতবার পড়া হয়েছে:
                      </p>
                      {selectedDayBreakdown.map((item) => {
                        const sharePct =
                          selectedDayTotal > 0
                            ? Math.max(8, Math.round((item.count / selectedDayTotal) * 100))
                            : 0;
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-black/8 bg-white p-2.5 dark:border-white/10 dark:bg-[#13241E]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-[#0F1F1A] dark:text-white">
                                  {item.labelBn}
                                </p>
                                {item.arabic && (
                                  <p
                                    dir="rtl"
                                    className="font-arabic truncate text-sm text-[#0D6E52] dark:text-[#E7C57B]"
                                  >
                                    {item.arabic}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono-num shrink-0 rounded-lg bg-[#0D6E52]/10 px-2.5 py-1 text-xs font-bold text-[#063D34] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                                {toBanglaDigits(item.count)} বার
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0D6E52] to-[#D4A853]"
                                style={{ width: `${sharePct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timestamped Activity Log */}
                    {selectedDayLog?.entries && selectedDayLog.entries.length > 0 && (
                      <div className="border-t border-black/8 pt-3 dark:border-white/10">
                        <p className="mb-2 flex items-center gap-1 text-[11px] font-bold text-[#475A53] dark:text-[#9BB0A8]">
                          <Clock className="h-3 w-3" />
                          <span>সময় ও বিবরণ ({toBanglaDigits(selectedDayLog.entries.length)})</span>
                        </p>
                        <div className="space-y-1.5">
                          {selectedDayLog.entries.map((en) => (
                            <div
                              key={en.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-black/6 bg-white/80 px-3 py-2 text-xs dark:border-white/8 dark:bg-[#13241E]/70"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#0F1F1A] dark:text-white">
                                  {en.labelBn}{' '}
                                  <span className="font-mono-num text-[#0D6E52] dark:text-[#6EE7B7]">
                                    +{toBanglaDigits(en.count)}
                                  </span>
                                </p>
                                <p className="text-[10px] text-[#556A62] dark:text-[#9BB0A8]">
                                  {formatTimestamp12h(en.timestamp)} ·{' '}
                                  {en.source === 'manual' ? 'হাতে পড়া' : 'ডিজিটাল ট্যাপ'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(selectedDateKey, en.id)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                                aria-label="হিসাব থেকে মুছুন"
                                title="এই এন্ট্রি মুছুন"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tasbih Fazilat & Hisnul Muslim Info Sheet */}
      {infoPreset && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${infoPreset.labelBn} এর ফজিলত ও নিয়ম`}
          onClick={() => setInfoPreset(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[#D4A853]/35 bg-white shadow-2xl dark:border-[#244238] dark:bg-[#0D1A16] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-[#063D34] px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#F6DC9B]">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>হিসনুল মুসলিম ও হাদিসের আলোকে ফজিলত</span>
                </p>
                <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
                  {infoPreset.labelBn}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInfoPreset(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="বন্ধ করুন"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Arabic + Meaning Summary */}
              <div className="rounded-2xl border border-[#0D6E52]/15 bg-[#F6F9F8] p-4 text-center dark:border-[#1F352E] dark:bg-[#08120F]">
                <p
                  dir="rtl"
                  className={`font-arabic font-semibold text-[#0F1F1A] dark:text-[#F0F5F3] ${
                    infoPreset.arabic.length > 80
                      ? 'text-lg leading-[1.95]'
                      : 'text-2xl leading-[1.85]'
                  }`}
                >
                  {infoPreset.arabic}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#475A53] dark:text-[#A9C4BB]">
                  অর্থ: {infoPreset.meaningBn}
                </p>
              </div>

              {/* Recommended Recitation Schedule */}
              <div className="rounded-2xl border border-[#D4A853]/30 bg-[#D4A853]/10 p-3.5 dark:border-[#E7C57B]/25 dark:bg-[#D4A853]/12">
                <p className="text-[11px] font-bold text-[#8E621A] dark:text-[#F6DC9B]">
                  কতবার ও কখন পড়া উত্তম:
                </p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#0F1F1A] dark:text-[#F0F5F3]">
                  {infoPreset.recommendedCountsBn}
                </p>
              </div>

              {/* Count-based Fazilat List */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-[#063D34] dark:text-[#6EE7B7]">
                  কত বারের কী ফজিলত:
                </p>
                {infoPreset.fazilatPointsBn.map((point, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-black/8 bg-[#F6F9F8] p-3.5 dark:border-white/10 dark:bg-[#08120F]"
                  >
                    <span className="inline-block rounded-lg bg-[#063D34] px-2.5 py-0.5 text-[11px] font-bold text-[#F6DC9B] dark:bg-[#0D6E52]">
                      {point.countBadgeBn}
                    </span>
                    <p className="mt-2 text-xs leading-relaxed text-[#0F1F1A] dark:text-[#E2EFEA]">
                      {point.detailBn}
                    </p>
                    <p className="mt-1.5 text-[10px] font-semibold text-[#556A62] dark:text-[#9BB0A8]">
                      সূত্র: {point.referenceBn}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px] font-medium text-[#556A62] dark:text-[#9BB0A8]">
                মাসনুন তথ্যসূত্র: {infoPreset.hisnulReferenceBn}
              </p>
            </div>

            <div className="border-t border-black/8 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#0D1A16]">
              <button
                type="button"
                onClick={() => setInfoPreset(null)}
                className="min-h-[42px] w-full rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-xs font-bold text-[#F6DC9B]"
              >
                বুঝেছি · গণনায় ফিরুন
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
