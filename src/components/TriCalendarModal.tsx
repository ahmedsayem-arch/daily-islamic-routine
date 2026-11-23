import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  computeHijriAlignmentOffset,
  getBanglaDateInfo,
  getEnglishDateInfo,
  getHijriDateInfo,
  toBanglaDigits,
} from '../utils/timeFormat';

interface TriCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiHijriParts?: { day: number; month: number; year: number };
}

const WEEK_HEADERS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const TriCalendarModal: React.FC<TriCalendarModalProps> = ({
  isOpen,
  onClose,
  apiHijriParts,
}) => {
  const [today] = useState<Date>(() => new Date());
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const hijriOffset = useMemo(
    () => computeHijriAlignmentOffset(apiHijriParts, today),
    [apiHijriParts, today]
  );

  const monthCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{
      date: Date;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({
        date: new Date(viewYear, viewMonth, -i),
        inCurrentMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(viewYear, viewMonth, d),
        inCurrentMonth: true,
      });
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let t = 1; t <= trailing; t++) {
      cells.push({
        date: new Date(viewYear, viewMonth + 1, t),
        inCurrentMonth: false,
      });
    }

    return cells.map((cell) => ({
      ...cell,
      bangla: getBanglaDateInfo(cell.date),
      english: getEnglishDateInfo(cell.date),
      hijri: getHijriDateInfo(cell.date, hijriOffset),
    }));
  }, [viewYear, viewMonth, hijriOffset]);

  const monthBanner = useMemo(() => {
    const inMonth = monthCells.filter((c) => c.inCurrentMonth);
    const first = inMonth[0] || monthCells[0];
    const last = inMonth[inMonth.length - 1] || monthCells[monthCells.length - 1];

    const enHeader = `${first.english.monthNameEn} ${first.english.year}`;
    const bnHeader =
      first.bangla.monthNameBn === last.bangla.monthNameBn
        ? `${first.bangla.monthNameBn} ${first.bangla.yearBn} বঙ্গাব্দ`
        : `${first.bangla.monthNameBn} – ${last.bangla.monthNameBn} ${last.bangla.yearBn} বঙ্গাব্দ`;
    const hijriHeaderBn =
      first.hijri.monthNameBn === last.hijri.monthNameBn
        ? `${first.hijri.monthNameBn} ${first.hijri.yearBn} হিজরি`
        : `${first.hijri.monthNameBn} – ${last.hijri.monthNameBn} ${last.hijri.yearBn} হিজরি`;
    const hijriHeaderAr =
      first.hijri.monthNameAr === last.hijri.monthNameAr
        ? `${first.hijri.monthNameAr} ${first.hijri.yearAr} هـ`
        : `${first.hijri.monthNameAr} – ${last.hijri.monthNameAr} ${last.hijri.yearAr} هـ`;

    return { enHeader, bnHeader, hijriHeaderBn, hijriHeaderAr };
  }, [monthCells]);

  const selectedBangla = useMemo(() => getBanglaDateInfo(selectedDate), [selectedDate]);
  const selectedEnglish = useMemo(() => getEnglishDateInfo(selectedDate), [selectedDate]);
  const selectedHijri = useMemo(
    () => getHijriDateInfo(selectedDate, hijriOffset),
    [selectedDate, hijriOffset]
  );

  if (!isOpen) return null;

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
    setSelectedDate(now);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="সম্মিলিত বাংলা, ইংরেজি ও আরবি হিজরি ক্যালেন্ডার"
      onClick={onClose}
    >
      <div
        className="glass-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-4 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3.5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D6E52]/12 text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-lg">
                সব ক্যালেন্ডার · বাংলা, ইংরেজি ও আরবি হিজরি
              </h2>
              <p className="text-xs text-[#556A62] dark:text-[#9BB0A8]">
                যে কোনো তারিখে ট্যাপ করে বাংলা বঙ্গাব্দ, ইংরেজি ও হিজরি দিন দেখুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/5 text-[#0F1F1A] hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:text-white"
            aria-label="ক্যালেন্ডার বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected Date 3-Calendar Summary */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#0D6E52]/20 bg-[#0D6E52]/8 p-3 dark:border-[#6EE7B7]/20 dark:bg-[#0D6E52]/15">
            <p className="text-[11px] font-bold text-[#0D6E52] dark:text-[#6EE7B7]">
              বাংলা ক্যালেন্ডার (বঙ্গাব্দ)
            </p>
            <p className="mt-1 text-sm font-bold text-[#0F1F1A] dark:text-white">
              {selectedBangla.dayBn} {selectedBangla.monthNameBn} {selectedBangla.yearBn}
            </p>
            <p className="text-[11px] text-[#556A62] dark:text-[#A9C4BB]">
              {selectedBangla.weekdayBn} · বাংলা সন {selectedBangla.yearBn}
            </p>
          </div>

          <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/15 dark:bg-white/[0.05]">
            <p className="text-[11px] font-bold text-[#475A53] dark:text-[#CBE2DA]">
              ইংরেজি ক্যালেন্ডার
            </p>
            <p className="mt-1 text-sm font-bold text-[#0F1F1A] dark:text-white">
              {selectedEnglish.day} {selectedEnglish.monthNameEn} {selectedEnglish.year}
            </p>
            <p className="text-[11px] text-[#556A62] dark:text-[#A9C4BB]">
              {selectedEnglish.weekdayEn}
            </p>
          </div>

          <div className="rounded-2xl border border-[#D4A853]/30 bg-[#D4A853]/10 p-3 dark:border-[#E7C57B]/30 dark:bg-[#D4A853]/12">
            <p className="text-[11px] font-bold text-[#8E621A] dark:text-[#F6DC9B]">
              আরবি ক্যালেন্ডার (হিজরি)
            </p>
            <p className="mt-1 text-sm font-bold text-[#0F1F1A] dark:text-white">
              {selectedHijri.dayBn} {selectedHijri.monthNameBn} {selectedHijri.yearBn} হিজরি
            </p>
            <p className="text-[11px] text-[#7A5314] dark:text-[#E7C57B]">
              হিজরি সন {selectedHijri.yearBn}
            </p>
          </div>
        </div>

        {/* Month Header & Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-black/[0.025] px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div>
            <p className="text-sm font-bold text-[#0F1F1A] dark:text-white">
              {monthBanner.enHeader} · {monthBanner.bnHeader}
            </p>
            <p className="text-xs font-medium text-[#8E621A] dark:text-[#F6DC9B]">
              {monthBanner.hijriHeaderBn}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-white/10 dark:text-white"
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
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[#0F1F1A] hover:bg-black/5 dark:border-white/15 dark:bg-white/10 dark:text-white"
              aria-label="পরবর্তী মাস"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEK_HEADERS_BN.map((day, idx) => (
            <div
              key={day}
              className={`py-1.5 text-[11px] font-bold ${
                idx === 5
                  ? 'text-[#0D6E52] dark:text-[#6EE7B7]'
                  : 'text-[#556A62] dark:text-[#9BB0A8]'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 7-Column Multi-Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {monthCells.map((cell) => {
            const isToday = isSameDay(cell.date, today);
            const isSelected = isSameDay(cell.date, selectedDate);
            const isFriday = cell.date.getDay() === 5;

            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                onClick={() => {
                  setSelectedDate(cell.date);
                  if (!cell.inCurrentMonth) {
                    setViewYear(cell.date.getFullYear());
                    setViewMonth(cell.date.getMonth());
                  }
                }}
                className={`flex min-h-[58px] flex-col justify-between rounded-xl border p-1.5 text-left transition-colors sm:min-h-[68px] sm:p-2 ${
                  isSelected
                    ? 'border-[#0D6E52] bg-[#0D6E52]/12 dark:border-[#F6DC9B] dark:bg-[#D4A853]/20'
                    : isToday
                    ? 'border-[#D4A853] bg-[#D4A853]/12 dark:border-[#6EE7B7]/60 dark:bg-[#0D6E52]/20'
                    : cell.inCurrentMonth
                    ? 'border-black/8 bg-white/80 hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/35'
                    : 'border-transparent bg-black/[0.02] opacity-45 dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex w-full items-baseline justify-between gap-0.5">
                  <span
                    className={`font-mono-num text-xs font-bold sm:text-sm ${
                      isToday
                        ? 'text-[#0D6E52] dark:text-[#6EE7B7]'
                        : isFriday
                        ? 'text-[#063D34] dark:text-[#F6DC9B]'
                        : 'text-[#0F1F1A] dark:text-white'
                    }`}
                  >
                    {cell.english.day}
                  </span>
                </div>

                <div className="mt-1 flex w-full items-end justify-between gap-0.5 text-[9px] leading-tight sm:text-[10px]">
                  <span className="truncate font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
                    {cell.bangla.dayBn}
                    <span className="hidden sm:inline"> {cell.bangla.monthNameBn}</span>
                  </span>
                  <span className="truncate font-semibold text-[#7A5314] dark:text-[#E7C57B]">
                    {toBanglaDigits(cell.hijri.day)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#556A62] dark:text-[#9BB0A8]">
          <span>বড় সংখ্যা: ইংরেজি · নিচে বামে: বাংলা · নিচে ডানে: হিজরি</span>
          <span className="font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
            বাংলা, ইংরেজি ও হিজরি ক্যালেন্ডার
          </span>
        </div>
      </div>
    </div>
  );
};
