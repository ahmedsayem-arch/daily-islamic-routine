import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  BookText,
  ChevronLeft,
  ChevronRight,
  Mic,
  Pause,
  Play,
  Search,
  Share2,
  Volume2,
} from 'lucide-react';
import { CURATED_HADITHS, HADITH_BOOKS } from '../data/islamicData';
import { fetchHadithSection } from '../services/islamicApi';
import type { ActiveTab, AppSettings, HadithBookMeta, HadithEntry } from '../types/islamic';
import {
  type SpeechSegment,
  speechPlayer,
  type SpeechTrack,
  useSpeechPlayer,
} from '../utils/speechPlayer';
import { SmoothStage } from './SmoothTransition';
import { VoiceSelectorSection } from './VoiceSelectorSection';

interface HadithViewProps {
  arabicFontSize?: number;
  onUpdateSettings?: (patch: Partial<AppSettings>) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

interface HadithLangPrefs {
  arabic: boolean;
  bengali: boolean;
  english: boolean;
}

interface LastHadithPos {
  bookId: string;
  sectionNum: number;
}

export const HadithView: React.FC<HadithViewProps> = ({
  arabicFontSize = 26,
  onUpdateSettings,
  onNavigateTab,
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedSectionNum, setSelectedSectionNum] = useState<number | null>(null);
  const [lastPos, setLastPos] = useState<LastHadithPos | null>(() => {
    try {
      const raw = localStorage.getItem('noor_last_hadith_pos_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as LastHadithPos;
        if (parsed?.bookId && typeof parsed.sectionNum === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [hadiths, setHadiths] = useState<HadithEntry[]>(CURATED_HADITHS);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(false);

  const [bookQuery, setBookQuery] = useState('');
  const [sectionQuery, setSectionQuery] = useState('');
  const [query, setQuery] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  const [langPrefs, setLangPrefs] = useState<HadithLangPrefs>(() => {
    try {
      const raw = localStorage.getItem('noor_hadith_langs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          arabic: typeof parsed.arabic === 'boolean' ? parsed.arabic : true,
          bengali: typeof parsed.bengali === 'boolean' ? parsed.bengali : true,
          english: typeof parsed.english === 'boolean' ? parsed.english : false,
        };
      }
    } catch {
      // ignore
    }
    return { arabic: true, bengali: true, english: false };
  });

  const [savedKeys, setSavedKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('noor_saved_hadiths');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const speechSnap = useSpeechPlayer();

  const selectedBook = useMemo(
    () => HADITH_BOOKS.find((b) => b.id === selectedBookId) || null,
    [selectedBookId]
  );

  const selectedSectionIndex = useMemo(() => {
    if (!selectedBook || selectedSectionNum === null) return -1;
    return selectedBook.sections.findIndex((s) => s.sectionNumber === selectedSectionNum);
  }, [selectedBook, selectedSectionNum]);

  const activeSection =
    selectedBook && selectedSectionIndex >= 0
      ? selectedBook.sections[selectedSectionIndex]
      : null;

  useEffect(() => {
    try {
      localStorage.setItem('noor_hadith_langs_v1', JSON.stringify(langPrefs));
    } catch {
      // ignore
    }
  }, [langPrefs]);

  useEffect(() => {
    if (!selectedBook || !activeSection) return;
    let active = true;
    setLoading(true);

    const pos: LastHadithPos = {
      bookId: selectedBook.id,
      sectionNum: activeSection.sectionNumber,
    };
    setLastPos(pos);
    try {
      localStorage.setItem('noor_last_hadith_pos_v1', JSON.stringify(pos));
    } catch {
      // ignore
    }

    fetchHadithSection(
      selectedBook.id,
      selectedBook.nameBn,
      activeSection.sectionNumber,
      activeSection.titleBn
    ).then((res) => {
      if (active) {
        setHadiths(res.hadiths);
        setIsFallback(res.isFallback);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedBook, activeSection]);

  const scrollTopSmooth = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const handleOpenBook = (book: HadithBookMeta) => {
    setSelectedBookId(book.id);
    setSelectedSectionNum(null);
    setSectionQuery('');
    setQuery('');
    scrollTopSmooth();
  };

  const handleOpenSection = (bookId: string, sectionNumber: number) => {
    setSelectedBookId(bookId);
    setSelectedSectionNum(sectionNumber);
    setQuery('');
    scrollTopSmooth();
  };

  const toggleLang = (key: keyof HadithLangPrefs) => {
    setLangPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.arabic && !next.bengali && !next.english) {
        return prev;
      }
      return next;
    });
  };

  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return HADITH_BOOKS;
    return HADITH_BOOKS.filter(
      (b) =>
        b.nameBn.toLowerCase().includes(q) ||
        b.compilerBn.toLowerCase().includes(q) ||
        (b.badgeBn && b.badgeBn.toLowerCase().includes(q))
    );
  }, [bookQuery]);

  const filteredSections = useMemo(() => {
    if (!selectedBook) return [];
    const q = sectionQuery.trim().toLowerCase();
    if (!q) return selectedBook.sections;
    return selectedBook.sections.filter(
      (sec, idx) =>
        sec.titleBn.toLowerCase().includes(q) ||
        String(sec.sectionNumber).includes(q) ||
        String(idx + 1).includes(q)
    );
  }, [selectedBook, sectionQuery]);

  const filteredHadiths = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hadiths;
    return hadiths.filter(
      (h) =>
        h.text.toLowerCase().includes(q) ||
        (h.arabic && h.arabic.includes(q)) ||
        (h.english && h.english.toLowerCase().includes(q)) ||
        String(h.hadithnumber).includes(q) ||
        h.chapterBn.toLowerCase().includes(q)
    );
  }, [hadiths, query]);

  const toggleSave = (key: string) => {
    setSavedKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem('noor_saved_hadiths', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleCopyHadith = async (h: HadithEntry, key: string) => {
    const parts: string[] = [];
    if (langPrefs.arabic && h.arabic) parts.push(h.arabic);
    if (langPrefs.bengali && h.text) parts.push(h.text);
    if ((langPrefs.english || !h.text) && h.english) parts.push(h.english);
    parts.push(`— ${h.bookNameBn}, হাদিস ${h.hadithnumber}`);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const buildHadithSpeechTrack = (h: HadithEntry, trackId: string): SpeechTrack => {
    const segments: SpeechSegment[] = [];
    if (langPrefs.arabic && h.arabic) {
      segments.push({ text: h.arabic, lang: 'ar-SA' });
    }
    if (langPrefs.bengali && h.text) {
      segments.push({ text: h.text, lang: 'bn-BD' });
    }
    if ((langPrefs.english || !h.text) && h.english) {
      segments.push({ text: h.english, lang: 'en-US' });
    }
    if (segments.length === 0) {
      if (h.text) segments.push({ text: h.text, lang: 'bn-BD' });
      else if (h.arabic) segments.push({ text: h.arabic, lang: 'ar-SA' });
      else if (h.english) segments.push({ text: h.english, lang: 'en-US' });
    }
    return {
      id: trackId,
      titleBn: `${h.bookNameBn} · হাদিস ${h.hadithnumber}`,
      subtitleBn: h.chapterBn,
      segments,
    };
  };

  const handlePlaySingleHadith = (h: HadithEntry, key: string) => {
    if (speechSnap.currentTrack?.id === key && speechSnap.status !== 'idle') {
      speechPlayer.togglePlayPause();
      return;
    }
    const track = buildHadithSpeechTrack(h, key);
    speechPlayer.playQueue([track], 0);
  };

  const handlePlayAllHadiths = () => {
    if (!selectedBook || filteredHadiths.length === 0) return;
    const queue = filteredHadiths.map((h, i) =>
      buildHadithSpeechTrack(h, `${selectedBook.id}-${h.hadithnumber}-${i}`)
    );
    speechPlayer.playQueue(queue, 0);
  };

  const dailySpotlight = CURATED_HADITHS[new Date().getDate() % CURATED_HADITHS.length];
  const hadithArabicSize = Math.min(34, Math.max(20, arabicFontSize - 2));

  const lastVisitedBook = useMemo(
    () => (lastPos ? HADITH_BOOKS.find((b) => b.id === lastPos.bookId) || null : null),
    [lastPos]
  );
  const lastVisitedSection = useMemo(
    () =>
      lastVisitedBook && lastPos
        ? lastVisitedBook.sections.find((s) => s.sectionNumber === lastPos.sectionNum) ||
          lastVisitedBook.sections[0]
        : null,
    [lastVisitedBook, lastPos]
  );

  const stageKey = !selectedBook
    ? 'hadith-books'
    : selectedSectionNum === null || !activeSection
    ? `hadith-chapters-${selectedBook.id}`
    : `hadith-reader-${selectedBook.id}-${activeSection.sectionNumber}`;

  return (
    <div className="space-y-5">
      <SmoothStage stageKey={stageKey}>
        {!selectedBook ? (
          /* STEP 1: HADITH BOOK DIRECTORY (কুরআন ও সীরাহর মতো আগে কিতাব নির্বাচন) */
          <div className="space-y-5">
            {/* Daily Hadith Spotlight */}
            <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/25 bg-[#063D34] bg-gradient-to-br from-[#08463B] via-[#052B24] to-[#031714] p-6 text-white shadow-[0_18px_44px_rgba(4,28,23,0.25)] md:p-8">
              <div
                className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75"
                aria-hidden="true"
              />
              <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="max-w-4xl">
                  <p className="text-xs font-semibold text-[#F2D58E]">
                    আজকের নির্বাচিত হাদিস · {dailySpotlight.bookNameBn} · হাদিস{' '}
                    {dailySpotlight.hadithnumber}
                  </p>
                  {dailySpotlight.arabic && (
                    <p
                      dir="rtl"
                      className="font-arabic mt-3 text-right text-xl leading-loose text-[#F6DC9B] md:text-2xl"
                    >
                      {dailySpotlight.arabic}
                    </p>
                  )}
                  <blockquote className="mt-2 text-base font-medium leading-relaxed text-[#F8FBF9] md:text-xl">
                    “{dailySpotlight.text}”
                  </blockquote>
                  <p className="mt-2.5 text-xs text-[#B9D5CC]">
                    {dailySpotlight.chapterBn} · {dailySpotlight.gradeBn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlaySingleHadith(dailySpotlight, 'spotlight-hadith')}
                    className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#C2923B] px-4 text-xs font-bold text-[#041D18] shadow-md"
                  >
                    {speechSnap.currentTrack?.id === 'spotlight-hadith' &&
                    speechSnap.status === 'playing' ? (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>বিরতি</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        <span>অডিও শুনুন</span>
                      </>
                    )}
                  </button>

                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('seerah')}
                      className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E7C57B]/35 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20"
                    >
                      <BookOpen className="h-4 w-4 text-[#E7C57B]" />
                      <span>সীরাত ও কিতাব</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* 10 Hadith Books Grid */}
            <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-xl">
                    বিশুদ্ধ হাদিস গ্রন্থসমূহ ({HADITH_BOOKS.length}টি ফ্রী কিতাব)
                  </h2>
                  <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    কুরআন ও সীরাহর মতো পছন্দের কিতাবে চাপ দিয়ে ভেতরের অধ্যায়গুলো দেখুন
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {lastVisitedBook && lastVisitedSection && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenSection(lastVisitedBook.id, lastVisitedSection.sectionNumber)
                      }
                      className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-3.5 text-xs font-bold text-[#F6DC9B] shadow-xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]">
                        সর্বশেষ: {lastVisitedBook.nameBn}
                      </span>
                    </button>
                  )}

                  <div className="relative w-full sm:w-60">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
                    <input
                      type="search"
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                      placeholder="হাদিস কিতাব খুঁজুন..."
                      aria-label="হাদিস কিতাব খুঁজুন"
                      className="min-h-[42px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-9 pr-3 text-xs text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
                    />
                  </div>
                </div>
              </div>

              {filteredBooks.length === 0 ? (
                <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                  <BookText className="mx-auto h-8 w-8 text-[#7A8E86]" />
                  <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                    এই নামে কোনো হাদিস কিতাব পাওয়া যায়নি।
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBooks.map((book, idx) => {
                    const isLastBook = lastVisitedBook?.id === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => handleOpenBook(book)}
                        className={`flex flex-col justify-between rounded-3xl border p-5 text-left shadow-xs transition-all ${
                          isLastBook
                            ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.06] dark:border-[#E7C57B]/45 dark:bg-[#063D34]/45'
                            : 'border-black/10 bg-white/85 hover:border-[#0D6E52]/45 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/45'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#063D34] to-[#0D6E52] font-mono-num text-xs font-bold text-[#F6DC9B] shadow-xs">
                              {idx + 1}
                            </div>
                            <span className="font-mono-num rounded-xl bg-[#0D6E52]/10 px-2.5 py-1 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                              {book.sections.length}টি অধ্যায়
                            </span>
                          </div>

                          <h3 className="mt-3.5 text-base font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {book.nameBn}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                            {book.compilerBn}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-3 text-xs dark:border-white/10">
                          <span className="font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
                            {book.badgeBn || 'সহীহ সংকলন'}
                          </span>
                          <span className="flex items-center gap-1 font-bold text-[#063D34] dark:text-[#F6DC9B]">
                            <span>অধ্যায়সমূহ</span>
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : selectedSectionNum === null || !activeSection ? (
          /* STEP 2: SELECTED BOOK'S CHAPTER DIRECTORY (অধ্যায় সূচী) */
          <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookId(null);
                    setSelectedSectionNum(null);
                    setSectionQuery('');
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>সকল কিতাব ({HADITH_BOOKS.length})</span>
                </button>

                <div>
                  <p className="text-[11px] font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                    {selectedBook.nameBn} · {selectedBook.sections.length}টি অধ্যায়
                  </p>
                  <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-lg">
                    অধ্যায় নির্বাচন করুন
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const targetSec =
                    lastPos && lastPos.bookId === selectedBook.id
                      ? lastPos.sectionNum
                      : selectedBook.sections[0].sectionNumber;
                  handleOpenSection(selectedBook.id, targetSec);
                }}
                className="flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {lastPos && lastPos.bookId === selectedBook.id
                    ? 'সর্বশেষ অধ্যায় খুলুন'
                    : 'প্রথম অধ্যায় খুলুন'}
                </span>
              </button>
            </div>

            {/* Chapter Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
              <input
                type="search"
                value={sectionQuery}
                onChange={(e) => setSectionQuery(e.target.value)}
                placeholder="অধ্যায় খুঁজুন (নাম বা নম্বর)..."
                aria-label="অধ্যায় খুঁজুন"
                className="min-h-[46px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
              />
            </div>

            {filteredSections.length === 0 ? (
              <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                <BookText className="mx-auto h-8 w-8 text-[#7A8E86]" />
                <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                  এই নামে কোনো অধ্যায় পাওয়া যায়নি।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSections.map((sec) => {
                  const realIdx = selectedBook.sections.findIndex(
                    (s) => s.sectionNumber === sec.sectionNumber
                  );
                  const isLastSec =
                    lastPos?.bookId === selectedBook.id &&
                    lastPos?.sectionNum === sec.sectionNumber;

                  return (
                    <button
                      key={sec.sectionNumber}
                      type="button"
                      onClick={() => handleOpenSection(selectedBook.id, sec.sectionNumber)}
                      className={`flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        isLastSec
                          ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] shadow-xs dark:border-[#E7C57B]/45 dark:bg-[#063D34]/60'
                          : 'border-black/8 bg-white/75 hover:border-[#0D6E52]/35 hover:bg-[#0D6E52]/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            isLastSec
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                          }`}
                        >
                          {realIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {sec.titleBn}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                            {selectedBook.nameBn}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#7A8E86]" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* STEP 3: SELECTED CHAPTER HADITH READER */
          <div className="space-y-4">
            {/* Reader Top Back & Prev/Next Chapter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSectionNum(null);
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>সকল অধ্যায়</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookId(null);
                    setSelectedSectionNum(null);
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 text-xs font-semibold text-[#475A53] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.04] dark:text-[#9BB0A8]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>সকল কিতাব</span>
                </button>
              </div>

              {selectedBook.sections.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedSectionIndex <= 0}
                    onClick={() => {
                      const prevSec = selectedBook.sections[selectedSectionIndex - 1];
                      if (prevSec) handleOpenSection(selectedBook.id, prevSec.sectionNumber);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>পূর্বের অধ্যায়</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedSectionIndex >= selectedBook.sections.length - 1}
                    onClick={() => {
                      const nextSec = selectedBook.sections[selectedSectionIndex + 1];
                      if (nextSec) handleOpenSection(selectedBook.id, nextSec.sectionNumber);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                  >
                    <span>পরের অধ্যায়</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Reader Content Card */}
            <section className="glass-card rounded-3xl p-5 md:p-7">
              <div className="flex flex-col justify-between gap-4 border-b border-black/8 pb-4 dark:border-white/10 lg:flex-row lg:items-center">
                <div>
                  <p className="text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                    {selectedBook.nameBn} · অধ্যায় {selectedSectionIndex + 1} /{' '}
                    {selectedBook.sections.length}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                    {activeSection.titleBn}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    {selectedBook.compilerBn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayAllHadiths}
                    disabled={loading || filteredHadiths.length === 0}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm disabled:opacity-50"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span className="whitespace-nowrap">অধ্যায়ের সব হাদিস শুনুন</span>
                  </button>

                  <div className="relative flex-1 sm:w-56 sm:flex-none">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="হাদিস বা নম্বর খুঁজুন..."
                      aria-label="হাদিস খুঁজুন"
                      className="min-h-[44px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
                    />
                  </div>
                </div>
              </div>

              {/* Language, Font Size & Voice Toolbar */}
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/8 bg-black/[0.025] px-3.5 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-bold text-[#475A53] dark:text-[#9BB0A8]">
                      ভাষা:
                    </span>
                    {[
                      { key: 'arabic' as const, label: 'আরবি (মূল)' },
                      { key: 'bengali' as const, label: 'বাংলা অনুবাদ' },
                      { key: 'english' as const, label: 'English' },
                    ].map((opt) => {
                      const active = langPrefs[opt.key];
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleLang(opt.key)}
                          className={`min-h-[36px] rounded-xl border px-3 text-xs font-bold transition-colors ${
                            active
                              ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                              : 'border-black/10 bg-white/80 text-[#475A53] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onUpdateSettings && (
                      <div className="flex items-center gap-1.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              arabicFontSize: Math.max(20, arabicFontSize - 2),
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/80 font-bold text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                          aria-label="আরবি ফন্ট ছোট করুন"
                        >
                          -
                        </button>
                        <span className="font-mono-num w-5 text-center">{arabicFontSize}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              arabicFontSize: Math.min(42, arabicFontSize + 2),
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/80 font-bold text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                          aria-label="আরবি ফন্ট বড় করুন"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowVoicePanel((v) => !v)}
                      className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                        showVoicePanel
                          ? 'border-[#0D6E52] bg-[#0D6E52]/15 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34] dark:text-[#F6DC9B]'
                          : 'border-[#0D6E52]/25 bg-white text-[#0D6E52] hover:bg-[#0D6E52]/10 dark:border-[#E7C57B]/30 dark:bg-white/[0.05] dark:text-[#F6DC9B]'
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>{showVoicePanel ? 'ভয়েস সেকশন বন্ধ' : 'ভয়েস নির্বাচন'}</span>
                    </button>
                  </div>
                </div>

                {showVoicePanel && <VoiceSelectorSection compact />}
              </div>

              {selectedBook.id === 'riyad-salihin' && activeSection.sectionNumber !== 999 && (
                <p className="mt-3 text-xs text-[#0D6E52] dark:text-[#E7C57B]">
                  টিপস: এই অধ্যায়টি আরবি ও ইংরেজিতে সম্পূর্ণ রয়েছে (প্রসিদ্ধ হাদিসগুলোতে বাংলাও যুক্ত আছে)। পূর্ণ বাংলা, আরবি ও ইংরেজির জন্য প্রথম অধ্যায় বা "বিশুদ্ধ হাদিস বিশ্বকোষ" দেখুন।
                </p>
              )}

              {isFallback && (
                <p className="mt-3 text-xs text-[#C2923B]">
                  দ্রষ্টব্য: এই মুহূর্তে অনলাইন সংযোগ না পাওয়ায় সংরক্ষিত বিশুদ্ধ হাদিস প্রদর্শিত হচ্ছে।
                </p>
              )}

              {loading ? (
                <div className="mt-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]"
                    />
                  ))}
                </div>
              ) : filteredHadiths.length === 0 ? (
                <div className="mt-8 rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                  <BookText className="mx-auto h-8 w-8 text-[#7A8E86]" />
                  <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                    আপনার অনুসন্ধানের সাথে মিলে এমন কোনো হাদিস পাওয়া যায়নি।
                  </p>
                </div>
              ) : (
                <div className="mt-6 divide-y divide-black/8 dark:divide-white/8">
                  {filteredHadiths.map((h, i) => {
                    const key = `${selectedBook.id}-${h.hadithnumber}-${i}`;
                    const isSaved = savedKeys.includes(key);
                    const isThisPlaying =
                      speechSnap.currentTrack?.id === key && speechSnap.status === 'playing';

                    return (
                      <article
                        key={key}
                        className={`py-5 transition-colors ${
                          isThisPlaying
                            ? 'rounded-2xl bg-gradient-to-r from-[#0D6E52]/10 to-[#D4A853]/10 px-4'
                            : ''
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                            <span className="font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                              {h.bookNameBn}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">হাদিস {h.hadithnumber}</span>
                            {h.gradeBn && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="rounded-md bg-[#0D6E52]/10 px-2 py-0.5 text-[10px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                                  {h.gradeBn}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handlePlaySingleHadith(h, key)}
                              className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
                                isThisPlaying
                                  ? 'bg-[#063D34] text-[#F6DC9B]'
                                  : 'bg-[#0D6E52]/10 text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]'
                              }`}
                              aria-label={isThisPlaying ? 'বিরতি' : 'হাদিস অডিও শুনুন'}
                            >
                              {isThisPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                              <span>{isThisPlaying ? 'বিরতি' : 'শুনুন'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSave(key)}
                              className={`flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl transition-colors ${
                                isSaved
                                  ? 'text-[#C2923B]'
                                  : 'text-[#7A8E86] hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                              aria-label="সংরক্ষণ করুন"
                            >
                              <Bookmark
                                className="h-4 w-4"
                                fill={isSaved ? 'currentColor' : 'none'}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyHadith(h, key)}
                              className="flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/5"
                              aria-label="কপি করুন"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">
                                {copiedId === key ? 'কপি হয়েছে' : 'কপি'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {langPrefs.arabic && h.arabic && (
                          <p
                            dir="rtl"
                            className="font-arabic mb-3 text-right text-[#0F1F1A] dark:text-[#F0F5F3]"
                            style={{ fontSize: `${hadithArabicSize}px`, lineHeight: 2.05 }}
                          >
                            {h.arabic}
                          </p>
                        )}

                        {langPrefs.bengali && h.text && (
                          <p className="text-base leading-relaxed text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {h.text}
                          </p>
                        )}

                        {(langPrefs.english || !h.text) && h.english && (
                          <p className="mt-2.5 text-sm leading-relaxed text-[#475A53] dark:text-[#B4C8C0]">
                            {h.english}
                          </p>
                        )}

                        {langPrefs.bengali && h.explanationBn && (
                          <div className="mt-3 rounded-2xl border border-black/8 bg-black/[0.025] p-3 text-xs leading-relaxed text-[#475A53] dark:border-white/8 dark:bg-white/[0.03] dark:text-[#9BB0A8]">
                            <span className="font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                              সংক্ষিপ্ত ব্যাখ্যা:{' '}
                            </span>
                            {h.explanationBn}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Bottom Chapter Pagination */}
              {selectedBook.sections.length > 1 && (
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-black/8 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    disabled={selectedSectionIndex <= 0}
                    onClick={() => {
                      const prevSec = selectedBook.sections[selectedSectionIndex - 1];
                      if (prevSec) handleOpenSection(selectedBook.id, prevSec.sectionNumber);
                    }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 px-4 text-xs font-bold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>পূর্ববর্তী অধ্যায়</span>
                  </button>

                  <span className="font-mono-num text-xs font-semibold text-[#475A53] dark:text-[#9BB0A8]">
                    {selectedSectionIndex + 1} / {selectedBook.sections.length}
                  </span>

                  <button
                    type="button"
                    disabled={selectedSectionIndex >= selectedBook.sections.length - 1}
                    onClick={() => {
                      const nextSec = selectedBook.sections[selectedSectionIndex + 1];
                      if (nextSec) handleOpenSection(selectedBook.id, nextSec.sectionNumber);
                    }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] disabled:opacity-40"
                  >
                    <span>পরবর্তী অধ্যায়</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </SmoothStage>
    </div>
  );
};
