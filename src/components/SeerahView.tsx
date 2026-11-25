import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Library,
  Mic,
  Pause,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { APPROVED_FREE_BOOKS, SEERAH_CHAPTERS } from '../data/seerahAndRiyadData';
import {
  fetchFullWrittenRaheeqAlMakhtum,
  fetchIslamHouseBooks,
} from '../services/islamicApi';
import type {
  ActiveTab,
  FullBookSection,
  IslamHouseBookItem,
  SeerahChapter,
} from '../types/islamic';
import { speechPlayer, type SpeechTrack, useSpeechPlayer } from '../utils/speechPlayer';
import { VoiceSelectorSection } from './VoiceSelectorSection';
import { SmoothStage } from './SmoothTransition';

interface SeerahViewProps {
  externalChapterIdx?: number | null;
  onNavigateTab?: (tab: ActiveTab) => void;
  routeIntent?: {
    topTab: 'books' | 'library';
    selectedBook: 'full-book' | 'seerah' | null;
    readerOpen: boolean;
    selectedFullIdx?: number;
    selectedSeerahIdx?: number;
    seq: number;
  } | null;
  onReaderStateChange?: (state: {
    topTab: 'books' | 'library';
    selectedBook: 'full-book' | 'seerah' | null;
    readerOpen: boolean;
    selectedFullIdx: number;
    selectedSeerahIdx: number;
  }) => void;
}

type SeerahBookId = 'full-book' | 'seerah';

export const SeerahView: React.FC<SeerahViewProps> = ({
  externalChapterIdx = null,
  onNavigateTab,
  routeIntent = null,
  onReaderStateChange,
}) => {
  const [topTab, setTopTab] = useState<'books' | 'library'>(
    routeIntent?.topTab || 'books'
  );
  const [selectedBook, setSelectedBook] = useState<SeerahBookId | null>(
    routeIntent?.selectedBook ?? null
  );
  const [readerOpen, setReaderOpen] = useState<boolean>(
    routeIntent?.readerOpen ?? false
  );
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  // Full Written Book State (Ar-Raheeq Al-Makhtum Unicode Text)
  const [fullSections, setFullSections] = useState<FullBookSection[]>([]);
  const [fullBookLoading, setFullBookLoading] = useState<boolean>(true);
  const [isLiveFullBook, setIsLiveFullBook] = useState<boolean>(false);
  const [selectedFullIdx, setSelectedFullIdx] = useState<number>(() => {
    if (typeof routeIntent?.selectedFullIdx === 'number' && routeIntent.selectedFullIdx >= 0) {
      return routeIntent.selectedFullIdx;
    }
    try {
      const saved = Number(localStorage.getItem('noor_last_full_seerah_idx') || '0');
      return saved >= 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [fullSearchQuery, setFullSearchQuery] = useState<string>('');

  // 12 Curated Chapters State
  const [selectedSeerahIdx, setSelectedSeerahIdx] = useState<number>(() => {
    if (
      typeof routeIntent?.selectedSeerahIdx === 'number' &&
      routeIntent.selectedSeerahIdx >= 0 &&
      routeIntent.selectedSeerahIdx < SEERAH_CHAPTERS.length
    ) {
      return routeIntent.selectedSeerahIdx;
    }
    try {
      const saved = Number(localStorage.getItem('noor_last_seerah_idx') || '0');
      return saved >= 0 && saved < SEERAH_CHAPTERS.length ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [seerahSearchQuery, setSeerahSearchQuery] = useState<string>('');

  useEffect(() => {
    if (
      externalChapterIdx !== null &&
      externalChapterIdx >= 0 &&
      externalChapterIdx < SEERAH_CHAPTERS.length
    ) {
      setTopTab('books');
      setSelectedBook('seerah');
      setSelectedSeerahIdx(externalChapterIdx);
      setReaderOpen(true);
    }
  }, [externalChapterIdx]);

  useEffect(() => {
    if (!routeIntent) return;
    setTopTab(routeIntent.topTab);
    setSelectedBook(routeIntent.selectedBook);
    setReaderOpen(routeIntent.readerOpen);
    if (typeof routeIntent.selectedFullIdx === 'number' && routeIntent.selectedFullIdx >= 0) {
      setSelectedFullIdx(routeIntent.selectedFullIdx);
    }
    if (
      typeof routeIntent.selectedSeerahIdx === 'number' &&
      routeIntent.selectedSeerahIdx >= 0 &&
      routeIntent.selectedSeerahIdx < SEERAH_CHAPTERS.length
    ) {
      setSelectedSeerahIdx(routeIntent.selectedSeerahIdx);
    }
  }, [routeIntent]);

  useEffect(() => {
    onReaderStateChange?.({
      topTab,
      selectedBook,
      readerOpen,
      selectedFullIdx,
      selectedSeerahIdx,
    });
  }, [topTab, selectedBook, readerOpen, selectedFullIdx, selectedSeerahIdx, onReaderStateChange]);

  useEffect(() => {
    try {
      localStorage.setItem('noor_last_seerah_idx', String(selectedSeerahIdx));
    } catch {
      // ignore
    }
  }, [selectedSeerahIdx]);

  useEffect(() => {
    try {
      localStorage.setItem('noor_last_full_seerah_idx', String(selectedFullIdx));
    } catch {
      // ignore
    }
  }, [selectedFullIdx]);

  // Preload full written book sections on mount so book directory shows count & opens fast
  useEffect(() => {
    if (fullSections.length > 0) return;
    let active = true;
    setFullBookLoading(true);
    fetchFullWrittenRaheeqAlMakhtum().then((res) => {
      if (!active) return;
      setFullSections(res.sections);
      setIsLiveFullBook(res.isLive);
      setSelectedFullIdx((prev) => (prev >= res.sections.length ? 0 : prev));
      setFullBookLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fullSections.length]);

  const filteredFullSections = useMemo(() => {
    const q = fullSearchQuery.trim().toLowerCase();
    if (!q) return fullSections;
    return fullSections.filter(
      (sec) =>
        sec.titleBn.toLowerCase().includes(q) ||
        String(sec.number).includes(q) ||
        sec.paragraphs.some((p) => p.toLowerCase().includes(q))
    );
  }, [fullSections, fullSearchQuery]);

  const filteredSeerahChapters = useMemo(() => {
    const q = seerahSearchQuery.trim().toLowerCase();
    if (!q) return SEERAH_CHAPTERS;
    return SEERAH_CHAPTERS.filter(
      (ch) =>
        ch.titleBn.toLowerCase().includes(q) ||
        ch.periodBn.toLowerCase().includes(q) ||
        ch.summaryBn.toLowerCase().includes(q) ||
        String(ch.number).includes(q)
    );
  }, [seerahSearchQuery]);

  // Free Approved Islamic Books (IslamHouse.com Library)
  const [bookCategory, setBookCategory] = useState<'all' | 'seerah' | 'hadith' | 'azkar'>('all');
  const [books, setBooks] = useState<IslamHouseBookItem[]>(APPROVED_FREE_BOOKS);
  const [booksLoading, setBooksLoading] = useState<boolean>(false);
  const [bookQuery, setBookQuery] = useState<string>('');

  useEffect(() => {
    if (topTab !== 'library') return;
    let active = true;
    setBooksLoading(true);
    fetchIslamHouseBooks(bookCategory).then((res) => {
      if (active) {
        setBooks(res.books);
        setBooksLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [topTab, bookCategory]);

  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.categoryLabelBn.toLowerCase().includes(q)
    );
  }, [books, bookQuery]);

  const speechSnap = useSpeechPlayer();

  const buildFullBookTrack = (sec: FullBookSection): SpeechTrack => ({
    id: sec.id,
    titleBn: `আর-রাহীকুল মাখতূম · অংশ ${sec.number}`,
    subtitleBn: sec.titleBn,
    segments: [
      {
        text: `${sec.titleBn}। ${sec.paragraphs.join(' ')}`,
        lang: 'bn-BD',
      },
    ],
  });

  const handlePlayFullSection = (sec: FullBookSection) => {
    if (speechSnap.currentTrack?.id === sec.id && speechSnap.status !== 'idle') {
      speechPlayer.togglePlayPause();
      return;
    }
    speechPlayer.playQueue([buildFullBookTrack(sec)], 0);
  };

  const buildSeerahTrack = (ch: SeerahChapter): SpeechTrack => {
    const fullText = [
      `অধ্যায় ${ch.number}: ${ch.titleBn}।`,
      ch.summaryBn,
      ...ch.paragraphsBn,
      `শিক্ষণীয় দিক: ${ch.lessonsBn.join(' ')}`,
    ].join(' ');
    return {
      id: ch.id,
      titleBn: `সীরাত · অধ্যায় ${ch.number}: ${ch.titleBn}`,
      subtitleBn: ch.periodBn,
      segments: [{ text: fullText, lang: 'bn-BD' }],
    };
  };

  const handlePlaySingleSeerah = (ch: SeerahChapter) => {
    if (speechSnap.currentTrack?.id === ch.id && speechSnap.status !== 'idle') {
      speechPlayer.togglePlayPause();
      return;
    }
    speechPlayer.playQueue([buildSeerahTrack(ch)], 0);
  };

  const handlePlayAllSeerah = (startIdx = selectedSeerahIdx) => {
    const queue = SEERAH_CHAPTERS.map(buildSeerahTrack);
    speechPlayer.playQueue(queue, startIdx);
  };

  const handlePlayBookSummary = (book: IslamHouseBookItem) => {
    const trackId = `book-${book.id}`;
    if (speechSnap.currentTrack?.id === trackId && speechSnap.status !== 'idle') {
      speechPlayer.togglePlayPause();
      return;
    }
    speechPlayer.playQueue(
      [
        {
          id: trackId,
          titleBn: book.title,
          subtitleBn: book.categoryLabelBn,
          segments: [{ text: `${book.title}। ${book.description}`, lang: 'bn-BD' }],
        },
      ],
      0
    );
  };

  const scrollTopSmooth = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const handleSelectBook = (bookId: SeerahBookId) => {
    setSelectedBook(bookId);
    setReaderOpen(false);
    scrollTopSmooth();
  };

  const handleOpenFullSection = (idx: number) => {
    setSelectedFullIdx(idx);
    setReaderOpen(true);
    scrollTopSmooth();
  };

  const handleOpenSeerahChapter = (idx: number) => {
    setSelectedSeerahIdx(idx);
    setReaderOpen(true);
    scrollTopSmooth();
  };

  const activeFullSection =
    fullSections[selectedFullIdx] || fullSections[0] || null;
  const isActiveFullPlaying =
    activeFullSection &&
    speechSnap.currentTrack?.id === activeFullSection.id &&
    speechSnap.status === 'playing';

  const activeSeerah = SEERAH_CHAPTERS[selectedSeerahIdx] || SEERAH_CHAPTERS[0];
  const isActiveSeerahPlaying =
    speechSnap.currentTrack?.id === activeSeerah.id && speechSnap.status === 'playing';

  return (
    <div className="space-y-5">
      {/* Top Switcher (mirrors QuranView top bar: Books vs Free PDF Library) */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2">
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTopTab('books');
              setSelectedBook(null);
              setReaderOpen(false);
            }}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all sm:flex-none ${
              topTab === 'books'
                ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm'
                : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/5'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span className="whitespace-nowrap">সীরাত কিতাবসমূহ (২)</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('library')}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all sm:flex-none ${
              topTab === 'library'
                ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm'
                : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/5'
            }`}
          >
            <Library className="h-4 w-4" />
            <span className="whitespace-nowrap">অন্যান্য ফ্রী কিতাব</span>
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => setShowVoicePanel((v) => !v)}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-xs font-semibold text-[#063D34] hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.05] dark:text-[#F6DC9B]"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>ভয়েস নির্বাচন</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('hadith')}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#0D6E52]/20 px-3 text-xs font-semibold text-[#0D6E52] hover:bg-[#0D6E52]/10 dark:border-[#E7C57B]/30 dark:text-[#F6DC9B]"
            >
              <span>হাদিস শরীফ (১০টি ফ্রী কিতাব)</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Inline Voice Selection Section */}
      {showVoicePanel && (
        <section className="glass-card rounded-3xl p-4 md:p-5">
          <VoiceSelectorSection compact />
        </section>
      )}

      <SmoothStage
        stageKey={
          topTab === 'library'
            ? 'library'
            : !selectedBook
            ? 'book-directory'
            : !readerOpen
            ? `chapters-${selectedBook}`
            : `reader-${selectedBook}-${
                selectedBook === 'full-book' ? selectedFullIdx : selectedSeerahIdx
              }`
        }
      >
      {topTab === 'library' ? (
        /* APPROVED FREE ISLAMIC BOOKS LIBRARY */
        <section className="glass-card space-y-5 rounded-3xl p-5 md:p-7">
          <div className="flex flex-col justify-between gap-4 border-b border-black/8 pb-4 dark:border-white/10 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                অনুমোদিত ফ্রী বাংলা ইসলামিক কিতাব লাইব্রেরি
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                IslamHouse.com-এর অনুমোদিত মুক্ত বিতরণযোগ্য বাংলা কিতাব। এছাড়া হাদিস ট্যাবে সিহাহ সিত্তাহ, মুয়াত্তা মালিক ও রিয়াদুস সালেহীন সরাসরি লিখিত আকারে পড়তে ও শুনতে পারবেন।
              </p>
            </div>

            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
              <input
                type="search"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="কিতাব খুঁজুন..."
                aria-label="কিতাব খুঁজুন"
                className="min-h-[44px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
              />
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all' as const, label: 'সব কিতাব' },
              { id: 'seerah' as const, label: 'সীরাত ও নবী জীবনী' },
              { id: 'hadith' as const, label: 'হাদিস ও সুন্নাহ' },
              { id: 'azkar' as const, label: 'দুআ ও দৈনন্দিন আমল' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setBookCategory(cat.id)}
                className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition-colors ${
                  bookCategory === cat.id
                    ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                    : 'border-black/10 bg-black/[0.025] text-[#475A53] hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#9BB0A8]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {booksLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-36 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]"
                />
              ))}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
              <FileText className="mx-auto h-8 w-8 text-[#7A8E86]" />
              <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                এই নাম বা বিষয়ে কোনো কিতাব পাওয়া যায়নি।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredBooks.map((book) => {
                const trackId = `book-${book.id}`;
                const isPlayingThis =
                  speechSnap.currentTrack?.id === trackId && speechSnap.status === 'playing';
                return (
                  <article
                    key={book.id}
                    className="flex flex-col justify-between rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm transition-colors hover:border-[#0D6E52]/35 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-lg bg-[#0D6E52]/10 px-2.5 py-1 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                          {book.categoryLabelBn}
                        </span>
                        {book.fileSize && (
                          <span className="font-mono-num text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                            PDF · {book.fileSize}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2.5 text-base font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                        {book.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                        {book.description}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/6 pt-3 dark:border-white/8">
                      <button
                        type="button"
                        onClick={() => handlePlayBookSummary(book)}
                        className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#0D6E52]/10 px-3 text-xs font-bold text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]"
                      >
                        {isPlayingThis ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                        <span>{isPlayingThis ? 'বিরতি' : 'বিবরণ শুনুন'}</span>
                      </button>

                      <a
                        href={book.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-3.5 text-xs font-bold text-[#F6DC9B] shadow-sm transition-opacity hover:opacity-95"
                      >
                        <span>ফ্রী PDF পড়ুন</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : !selectedBook ? (
        /* STEP 1: BOOK DIRECTORY (আগে কিতাবের নাম) */
        <div className="space-y-5">
          {/* Seerah Hero Banner */}
          <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/25 bg-[#063D34] bg-gradient-to-br from-[#08463B] via-[#052B24] to-[#031714] p-6 text-white shadow-[0_18px_44px_rgba(4,28,23,0.25)] md:p-8">
            <div
              className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold text-[#F2D58E]">
                  সীরাতুন নবী সাল্লাল্লাহু আলাইহি ওয়াসাল্লাম · কিতাব ও অধ্যায় তালিকা
                </p>
                <h1 className="mt-1.5 text-2xl font-bold text-white md:text-3xl">
                  সীরাত গ্রন্থাগার ও লিখিত কিতাবসমূহ
                </h1>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#D0E2DC] md:text-sm">
                  কুরআনের সূরা তালিকার মতো আগে পছন্দের সীরাত কিতাব নির্বাচন করুন, এরপর অধ্যায় বেছে নিয়ে পরিষ্কার বাংলায় পড়ুন ও শুনুন।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 md:hidden">
                <button
                  type="button"
                  onClick={() => setShowVoicePanel((v) => !v)}
                  className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl border border-[#F6DC9B]/40 bg-white/10 px-4 text-xs font-bold text-[#F6DC9B] backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Mic className="h-4 w-4" />
                  <span>ভয়েস নির্বাচন</span>
                </button>
              </div>
            </div>
          </section>

          {/* Book List Cards */}
          <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  সীরাত কিতাব নির্বাচন করুন
                </h2>
                <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  কিতাবে চাপ দিলে ভেতরের সকল অধ্যায় দেখতে পারবেন
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Book 1: Ar-Raheeq Al-Makhtum (Full Book) */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#0D6E52]/25 bg-white/85 p-5 shadow-sm transition-all hover:border-[#0D6E52]/55 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/45">
                <button
                  type="button"
                  onClick={() => handleSelectBook('full-book')}
                  className="flex-1 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm">
                      <BookMarked className="h-6 w-6" />
                    </div>
                    <span className="rounded-xl bg-[#0D6E52]/10 px-3 py-1 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                      {fullBookLoading
                        ? 'লোড হচ্ছে...'
                        : `${fullSections.length}টি লিখিত অংশ`}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                    আর-রাহীকুল মাখতূম (সম্পূর্ণ লিখিত গ্রন্থ)
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                    আল্লামা সফিউর রহমান মুবারকপুরী (রহ.)
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                    বিশ্ববিখ্যাত সীরাতগ্রন্থের পরিষ্কার ইউনিকোড বাংলা সংস্করণ। আইয়ামে জাহেলিয়াত থেকে রাসূল (সা.)-এর ওফাত পর্যন্ত প্রতিটি পর্ব ধারাবাহিকভাবে পড়ুন ও অডিওতে শুনুন।
                  </p>
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3.5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSelectBook('full-book')}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-xs"
                  >
                    <span>অধ্যায় ও অংশসমূহ দেখুন</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {activeFullSection && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBook('full-book');
                        setReaderOpen(true);
                        scrollTopSmooth();
                      }}
                      className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3.5 text-xs font-bold text-[#0F1F1A] hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
                    >
                      <span>পড়া চালিয়ে যান ({activeFullSection.number})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Book 2: Concise Seerah (12 Chapters) */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#D4A853]/35 bg-white/85 p-5 shadow-sm transition-all hover:border-[#D4A853]/70 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/50">
                <button
                  type="button"
                  onClick={() => handleSelectBook('seerah')}
                  className="flex-1 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B8872E] to-[#8C6117] text-white shadow-sm">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <span className="rounded-xl bg-[#D4A853]/15 px-3 py-1 text-[11px] font-bold text-[#8B621B] dark:text-[#F6DC9B]">
                      {SEERAH_CHAPTERS.length}টি সংক্ষিপ্ত অধ্যায়
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                    সংক্ষিপ্ত সীরাতুন নবী (সা.)
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#8B621B] dark:text-[#E7C57B]">
                    মাক্কী ও মাদানী জীবনের প্রামাণিক সারসংক্ষেপ
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                    নবী কারীম (সা.)-এর জন্ম, নবুওয়াত, হিজরত, বদর-উহুদ, মক্কা বিজয় ও বিদায় হজ্জের ১২টি অধ্যায় এবং প্রতিটি অধ্যায় থেকে শিক্ষণীয় বিষয়সমূহ।
                  </p>
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3.5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSelectBook('seerah')}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-xs"
                  >
                    <span>১২টি অধ্যায় দেখুন</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlayAllSeerah(selectedSeerahIdx)}
                    className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3.5 text-xs font-bold text-[#0F1F1A] hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
                  >
                    <Volume2 className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                    <span>ধারাবাহিক শুনুন</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : !readerOpen ? (
        /* STEP 2: CHAPTER DIRECTORY FOR THE SELECTED BOOK (পরে অধ্যায়) */
        <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
          {/* Back to Book List & Quick Resume */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedBook(null);
                  setReaderOpen(false);
                }}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>সকল কিতাব</span>
              </button>

              <div>
                <p className="text-[11px] font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                  {selectedBook === 'full-book'
                    ? `আর-রাহীকুল মাখতূম · ${fullSections.length}টি অংশ`
                    : `সংক্ষিপ্ত সীরাতুন নবী (সা.) · ${SEERAH_CHAPTERS.length}টি অধ্যায়`}
                </p>
                <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-lg">
                  অধ্যায় ও অংশ নির্বাচন করুন
                </h2>
              </div>
            </div>

            {selectedBook === 'full-book' && activeFullSection ? (
              <button
                type="button"
                onClick={() => handleOpenFullSection(selectedFullIdx)}
                className="flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  সর্বশেষ: অংশ {activeFullSection.number} খুলুন
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenSeerahChapter(selectedSeerahIdx)}
                className="flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  সর্বশেষ: অধ্যায় {activeSeerah.number} খুলুন
                </span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
            <input
              type="search"
              value={selectedBook === 'full-book' ? fullSearchQuery : seerahSearchQuery}
              onChange={(e) =>
                selectedBook === 'full-book'
                  ? setFullSearchQuery(e.target.value)
                  : setSeerahSearchQuery(e.target.value)
              }
              placeholder="অধ্যায় বা বিষয় খুঁজুন (নাম বা নম্বর)..."
              aria-label="অধ্যায় বা বিষয় খুঁজুন"
              className="min-h-[46px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
            />
          </div>

          {/* Chapter Cards Grid */}
          {selectedBook === 'full-book' ? (
            fullBookLoading ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-20 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]"
                  />
                ))}
              </div>
            ) : filteredFullSections.length === 0 ? (
              <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                <FileText className="mx-auto h-8 w-8 text-[#7A8E86]" />
                <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                  এই নামে কোনো অধ্যায় বা অংশ পাওয়া যায়নি।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFullSections.map((sec) => {
                  const realIdx = fullSections.findIndex((s) => s.id === sec.id);
                  const isLast = realIdx === selectedFullIdx;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleOpenFullSection(realIdx)}
                      className={`flex min-h-[72px] w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        isLast
                          ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] shadow-xs dark:border-[#E7C57B]/45 dark:bg-[#063D34]/60'
                          : 'border-black/8 bg-white/75 hover:border-[#0D6E52]/35 hover:bg-[#0D6E52]/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35'
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            isLast
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                          }`}
                        >
                          {sec.number}
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {sec.titleBn}
                          </p>
                          {sec.paragraphs[0] && (
                            <p className="mt-1 line-clamp-1 text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                              {sec.paragraphs[0]}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#7A8E86]" />
                    </button>
                  );
                })}
              </div>
            )
          ) : filteredSeerahChapters.length === 0 ? (
            <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
              <FileText className="mx-auto h-8 w-8 text-[#7A8E86]" />
              <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                এই নামে কোনো অধ্যায় পাওয়া যায়নি।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSeerahChapters.map((ch) => {
                const realIdx = SEERAH_CHAPTERS.findIndex((item) => item.id === ch.id);
                const isLast = realIdx === selectedSeerahIdx;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleOpenSeerahChapter(realIdx)}
                    className={`flex min-h-[78px] w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                      isLast
                        ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] shadow-xs dark:border-[#E7C57B]/45 dark:bg-[#063D34]/60'
                        : 'border-black/8 bg-white/75 hover:border-[#0D6E52]/35 hover:bg-[#0D6E52]/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          isLast
                            ? 'bg-[#063D34] text-[#F6DC9B]'
                            : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                        }`}
                      >
                        {ch.number}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {ch.titleBn}
                        </p>
                        <p className="mt-1 truncate text-[11px] font-medium text-[#0D6E52] dark:text-[#E7C57B]">
                          {ch.periodBn}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                          {ch.summaryBn}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#7A8E86]" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* STEP 3: SELECTED CHAPTER / SECTION READER */
        <div className="space-y-4">
          {/* Reader Top Back & Prev/Next Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReaderOpen(false)}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>সকল অধ্যায়</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedBook(null);
                  setReaderOpen(false);
                }}
                className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 text-xs font-semibold text-[#475A53] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.04] dark:text-[#9BB0A8]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>সকল কিতাব</span>
              </button>
            </div>

            {selectedBook === 'full-book' && fullSections.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={selectedFullIdx <= 0}
                  onClick={() => handleOpenFullSection(Math.max(0, selectedFullIdx - 1))}
                  className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>পূর্বের অংশ</span>
                </button>
                <button
                  type="button"
                  disabled={selectedFullIdx >= fullSections.length - 1}
                  onClick={() =>
                    handleOpenFullSection(
                      Math.min(fullSections.length - 1, selectedFullIdx + 1)
                    )
                  }
                  className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                >
                  <span>পরের অংশ</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={selectedSeerahIdx <= 0}
                  onClick={() =>
                    handleOpenSeerahChapter(Math.max(0, selectedSeerahIdx - 1))
                  }
                  className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>পূর্বের অধ্যায়</span>
                </button>
                <button
                  type="button"
                  disabled={selectedSeerahIdx >= SEERAH_CHAPTERS.length - 1}
                  onClick={() =>
                    handleOpenSeerahChapter(
                      Math.min(SEERAH_CHAPTERS.length - 1, selectedSeerahIdx + 1)
                    )
                  }
                  className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                >
                  <span>পরের অধ্যায়</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {selectedBook === 'full-book' && activeFullSection ? (
            <article className="glass-card space-y-5 rounded-3xl p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                    আর-রাহীকুল মাখতূম · লিখিত অংশ {activeFullSection.number} / {fullSections.length}
                    {isLiveFullBook ? ' · সম্পূর্ণ বাংলা গ্রন্থ' : ''}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3] md:text-2xl">
                    {activeFullSection.titleBn}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVoicePanel((v) => !v)}
                    className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-xs font-semibold text-[#0F1F1A] dark:border-white/15 dark:bg-white/[0.06] dark:text-white md:hidden"
                  >
                    <Mic className="h-3.5 w-3.5 text-[#0D6E52] dark:text-[#E7C57B]" />
                    <span>ভয়েস</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlayFullSection(activeFullSection)}
                    className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] transition-colors"
                  >
                    {isActiveFullPlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>বিরতি</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        <span>অংশ শুনুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {activeFullSection.paragraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-base leading-[1.95] text-[#0F1F1A] dark:text-[#E7EFEA]"
                  >
                    {para}
                  </p>
                ))}
              </div>

              {/* Bottom Pagination */}
              <div className="flex items-center justify-between gap-3 border-t border-black/8 pt-4 dark:border-white/10">
                <button
                  type="button"
                  disabled={selectedFullIdx === 0}
                  onClick={() => handleOpenFullSection(Math.max(0, selectedFullIdx - 1))}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 px-4 text-xs font-bold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>পূর্ববর্তী অংশ</span>
                </button>

                <span className="font-mono-num text-xs font-semibold text-[#475A53] dark:text-[#9BB0A8]">
                  {activeFullSection.number} / {fullSections.length}
                </span>

                <button
                  type="button"
                  disabled={selectedFullIdx >= fullSections.length - 1}
                  onClick={() =>
                    handleOpenFullSection(
                      Math.min(fullSections.length - 1, selectedFullIdx + 1)
                    )
                  }
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] disabled:opacity-40"
                >
                  <span>পরবর্তী অংশ</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                মূল লেখক: আল্লামা সফিউর রহমান মুবারকপুরী (রহ.) · মুক্ত ইউনিকোড বাংলা সীরাত পাঠ
              </p>
            </article>
          ) : (
            <article className="glass-card space-y-5 rounded-3xl p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                    সংক্ষিপ্ত সীরাতুন নবী (সা.) · অধ্যায় {activeSeerah.number} · {activeSeerah.periodBn}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3] md:text-2xl">
                    {activeSeerah.titleBn}
                  </h2>
                  <p className="mt-1 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    {activeSeerah.summaryBn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlaySingleSeerah(activeSeerah)}
                    className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] transition-colors"
                  >
                    {isActiveSeerahPlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>বিরতি</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        <span>অধ্যায় শুনুন</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlayAllSeerah(selectedSeerahIdx)}
                    className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl border border-[#D4A853]/45 bg-[#D4A853]/15 px-3.5 text-xs font-bold text-[#8B621B] dark:text-[#F6DC9B]"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>ধারাবাহিক শুনুন</span>
                  </button>
                </div>
              </div>

              {/* Narrative Paragraphs */}
              <div className="space-y-4">
                {activeSeerah.paragraphsBn.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-base leading-loose text-[#0F1F1A] dark:text-[#E7EFEA]"
                  >
                    {para}
                  </p>
                ))}
              </div>

              {/* Key Lessons */}
              <div className="rounded-2xl border border-[#0D6E52]/20 bg-[#0D6E52]/[0.06] p-4 dark:border-[#E7C57B]/25 dark:bg-[#063D34]/40">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#0D6E52] dark:text-[#F6DC9B]">
                  <Sparkles className="h-4 w-4" />
                  <span>এই অধ্যায় থেকে শিক্ষণীয় বিষয়সমূহ</span>
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {activeSeerah.lessonsBn.map((lesson, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm leading-relaxed text-[#0F1F1A] dark:text-[#E5F0EC]"
                    >
                      <span className="mt-1 text-xs text-[#0D6E52] dark:text-[#E7C57B]">●</span>
                      <span>{lesson}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                <span className="font-semibold">প্রামাণিক সূত্র:</span> {activeSeerah.sourceBn}
              </p>

              {/* Chapter Pagination */}
              <div className="flex items-center justify-between gap-3 border-t border-black/8 pt-4 dark:border-white/10">
                <button
                  type="button"
                  disabled={selectedSeerahIdx === 0}
                  onClick={() =>
                    handleOpenSeerahChapter(Math.max(0, selectedSeerahIdx - 1))
                  }
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 px-4 text-xs font-bold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>পূর্ববর্তী অধ্যায়</span>
                </button>

                <span className="font-mono-num text-xs font-semibold text-[#475A53] dark:text-[#9BB0A8]">
                  {activeSeerah.number} / {SEERAH_CHAPTERS.length}
                </span>

                <button
                  type="button"
                  disabled={selectedSeerahIdx >= SEERAH_CHAPTERS.length - 1}
                  onClick={() =>
                    handleOpenSeerahChapter(
                      Math.min(SEERAH_CHAPTERS.length - 1, selectedSeerahIdx + 1)
                    )
                  }
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] disabled:opacity-40"
                >
                  <span>পরবর্তী অধ্যায়</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          )}
        </div>
      )}
      </SmoothStage>
    </div>
  );
};
