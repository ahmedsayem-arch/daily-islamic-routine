import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Heart,
  Loader2,
  Maximize2,
  Minimize2,
  Palette,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import { RUQYAH_NATURE_IMG } from '../data/islamicData';
import type { AppThemeId, AudioStatus, AudioTrackItem } from '../types/islamic';
import { APP_THEMES, getPlayerThemeTokens } from '../utils/playerThemes';
import { TajweedArabicText } from './TajweedArabicText';

interface AudioPlayerBarProps {
  playlist: AudioTrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  audioStatus: AudioStatus;
  isLooping: boolean;
  isVisualOpen: boolean;
  appTheme: AppThemeId;
  progress: number;
  duration: number;
  errorMsg: string | null;
  arabicFontSize: number;
  tajweedColorCoding: boolean;
  showArabic: boolean;
  showBengaliTransliteration: boolean;
  showBengaliTranslation: boolean;
  showEnglishTranslation: boolean;
  favoriteAyahKeys: string[];
  onToggleFavoriteTrack: (track: AudioTrackItem) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectTrack: (index: number) => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onClosePlayer: () => void;
  onSetVisualOpen: (open: boolean) => void;
  onCycleTheme: () => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getStatusLabel(status: AudioStatus, errorMsg: string | null): string {
  if (errorMsg || status === 'error') return 'অডিও সংযোগে ত্রুটি';
  switch (status) {
    case 'loading':
      return 'অডিও বাফার হচ্ছে...';
    case 'playing':
      return 'তিলাওয়াত চলছে';
    case 'paused':
      return 'বিরতিতে আছে';
    default:
      return 'প্রস্তুত';
  }
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  playlist,
  currentIndex,
  isPlaying,
  audioStatus,
  isLooping,
  isVisualOpen,
  appTheme,
  progress,
  duration,
  errorMsg,
  arabicFontSize,
  tajweedColorCoding,
  showArabic,
  showBengaliTransliteration,
  showBengaliTranslation,
  showEnglishTranslation,
  favoriteAyahKeys,
  onToggleFavoriteTrack,
  onTogglePlay,
  onPrev,
  onNext,
  onSelectTrack,
  onToggleLoop,
  onSeek,
  onClosePlayer,
  onSetVisualOpen,
  onCycleTheme,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'upcoming' | 'all'>('upcoming');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const queueContainerRef = useRef<HTMLDivElement | null>(null);

  const tokens = useMemo(() => getPlayerThemeTokens(appTheme), [appTheme]);

  const currentThemeLabel = useMemo(
    () => APP_THEMES.find((t) => t.id === appTheme)?.labelBn || 'সবুজ',
    [appTheme]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisualOpen) {
        onSetVisualOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisualOpen, onSetVisualOpen]);

  useEffect(() => {
    if (queueContainerRef.current) {
      queueContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex, queueFilter]);

  // Serene animated geometric & harmonic wave canvas synced with active theme
  useEffect(() => {
    if (!isVisualOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const speed = isPlaying ? 0.025 : 0.006;
      phase += speed;

      const cx = w / 2;
      const cy = h * 0.24;
      const baseRadius = Math.min(w, h) * 0.16;

      for (let ring = 0; ring < 3; ring++) {
        const pulse = isPlaying ? Math.sin(phase * 1.4 + ring * 1.2) * 7 : 0;
        const r = baseRadius + ring * 28 + pulse;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(10, r), 0, Math.PI * 2);
        ctx.strokeStyle =
          ring === 1 ? tokens.wavePrimaryStroke : tokens.waveSecondaryStroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      for (let line = 0; line < 3; line++) {
        ctx.beginPath();
        const amp = isPlaying ? 14 - line * 3 : 4;
        const yCenter = h * 0.9 + line * 8;
        for (let x = 0; x <= w; x += 12) {
          const y =
            yCenter +
            Math.sin(x * 0.008 + phase + line * 1.1) * amp +
            Math.cos(x * 0.015 - phase * 0.8) * (amp * 0.45);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle =
          line === 0 ? tokens.wavePrimaryStroke : tokens.waveSecondaryStroke;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isVisualOpen, isPlaying, tokens.wavePrimaryStroke, tokens.waveSecondaryStroke]);

  const queueItems = useMemo(() => {
    if (queueFilter === 'upcoming') {
      return playlist
        .map((item, idx) => ({ item, idx }))
        .filter(({ idx }) => idx > currentIndex);
    }
    return playlist.map((item, idx) => ({ item, idx }));
  }, [playlist, currentIndex, queueFilter]);

  if (playlist.length === 0) return null;
  const track = playlist[currentIndex] || playlist[0];
  const trackFavKey = `${track.surah}:${track.ayah}`;
  const isTrackFavorited = favoriteAyahKeys.includes(trackFavKey);
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const statusLabel = getStatusLabel(audioStatus, errorMsg);
  const upcomingCount = Math.max(0, playlist.length - 1 - currentIndex);
  const stageArabicSize = Math.min(38, Math.max(22, arabicFontSize));

  return (
    <>
      {/* Full-Screen Floating Active Ayah + Upcoming Ayahs Visual Player */}
      <AnimatePresence>
      {isVisualOpen && (
        <motion.div
          key="visual-player-modal"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed inset-0 z-50 flex flex-col transition-colors duration-200 ${tokens.rootBg}`}
          role="dialog"
          aria-modal="true"
          aria-label="ভিজ্যুয়াল তিলাওয়াত ও রুকাইয়া প্লেয়ার"
        >
          {/* Ambient background image + harmonic wave canvas */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {!imgFailed ? (
              <img
                src={RUQYAH_NATURE_IMG}
                alt="শান্ত প্রকৃতির পটভূমি"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className={`h-full w-full object-cover ${tokens.imageOpacity}`}
              />
            ) : (
              <div className={`h-full w-full ${tokens.fallbackGradient}`} />
            )}
            <div className={`bg-islamic-lattice absolute inset-0 ${tokens.latticeOpacity}`} />
            <div className={`absolute inset-0 ${tokens.scrimOverlay}`} />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>

          {/* Top Bar */}
          <div
            className={`relative z-10 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 backdrop-blur-md md:px-8 ${tokens.topBar}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-bold ${tokens.topTitle}`}>{track.titleBn}</p>
              <p className={`truncate text-xs ${tokens.topSubtitle}`}>
                {track.subtitleBn} · {statusLabel} ·{' '}
                <span className="font-mono-num">
                  {currentIndex + 1}/{playlist.length}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onCycleTheme}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${tokens.iconBtn}`}
                aria-label={`থিম পরিবর্তন করুন (বর্তমান: ${currentThemeLabel})`}
                title={`থিম বদলান (${currentThemeLabel})`}
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{currentThemeLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => onSetVisualOpen(false)}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${tokens.iconBtn}`}
                aria-label="ভিজ্যুয়াল প্লেয়ার ছোট করুন"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Floating Active Ayah + Upcoming Ayahs Layout */}
          <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-3 md:px-8 md:py-4">
            {/* UPPER: Floating Highlighted Current Ayah */}
            <section
              aria-label="চলমান ভাসমান আয়াত"
              className={`flex basis-[35%] min-h-[175px] max-h-[40%] shrink-0 flex-col justify-between overflow-y-auto rounded-3xl border p-4 backdrop-blur-xl transition-colors md:p-6 ${tokens.stageCard}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                <span className={tokens.stageKicker}>
                  চলমান আয়াত · {track.titleBn}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 ${tokens.stageStatus}`}>
                    {audioStatus === 'loading' && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4A853]" />
                    )}
                    <span>{statusLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleFavoriteTrack(track)}
                    className={`flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                      isTrackFavorited
                        ? 'border-rose-400/50 bg-rose-500/15 text-rose-500 dark:text-rose-300'
                        : tokens.iconBtn
                    }`}
                    aria-label={isTrackFavorited ? 'ফেভারিট থেকে সরান' : 'ফেভারিটে যোগ করুন'}
                  >
                    <Heart
                      className="h-3.5 w-3.5"
                      fill={isTrackFavorited ? 'currentColor' : 'none'}
                    />
                    <span>{isTrackFavorited ? 'ফেভারিট' : 'সেভ করুন'}</span>
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="my-auto py-2 text-center"
                >
                  {showArabic && track.arabic ? (
                    <TajweedArabicText
                      plainArabic={track.arabic}
                      tajweedArabic={track.tajweedArabic}
                      enableTajweed={tajweedColorCoding}
                      className={`font-arabic ${tokens.arabicText}`}
                      style={{
                        fontSize: `${stageArabicSize}px`,
                        lineHeight: 2.05,
                      }}
                    />
                  ) : !showArabic ? null : (
                    <p className={`text-base font-medium ${tokens.meaningText}`}>
                      {track.titleBn} তিলাওয়াত চলছে...
                    </p>
                  )}

                  {showBengaliTransliteration && track.bengaliTranslit && (
                    <p
                      className={`mx-auto mt-2 max-w-3xl text-sm font-medium leading-relaxed md:text-base ${tokens.translitText}`}
                    >
                      {track.bengaliTranslit}
                    </p>
                  )}

                  {showBengaliTranslation && track.meaningBn && (
                    <p
                      className={`mx-auto mt-2 max-w-3xl text-sm leading-relaxed md:text-base ${tokens.meaningText}`}
                    >
                      {track.meaningBn}
                    </p>
                  )}

                  {showEnglishTranslation && track.englishMeaning && (
                    <p
                      className={`mx-auto mt-1.5 max-w-3xl text-xs leading-relaxed md:text-sm ${tokens.englishText}`}
                    >
                      {track.englishMeaning}
                    </p>
                  )}

                  {errorMsg && <p className={`mt-2 text-xs ${tokens.errorText}`}>{errorMsg}</p>}
                </motion.div>
              </AnimatePresence>
            </section>

            {/* LOWER: Upcoming & Sequential Ayahs Remaining Visible */}
            <section
              aria-label="পরবর্তী আয়াতসমূহ"
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border backdrop-blur-md transition-colors ${tokens.queueCard}`}
            >
              <div
                className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 md:px-5 ${tokens.queueHeaderBorder}`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-bold ${tokens.queueHeaderTitle}`}>
                    পরবর্তী ও ধারাবাহিক আয়াত
                  </span>
                  <span className="opacity-35" aria-hidden="true">
                    ·
                  </span>
                  <span className={`font-mono-num ${tokens.queueHeaderMeta}`}>
                    আরও {upcomingCount}টি বাকি
                  </span>
                </div>

                <div className={`flex items-center gap-1 rounded-xl p-1 ${tokens.queueTabContainer}`}>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('upcoming')}
                    className={`min-h-[34px] rounded-lg px-3 text-[11px] font-semibold transition-colors ${
                      queueFilter === 'upcoming'
                        ? tokens.queueTabActive
                        : tokens.queueTabInactive
                    }`}
                  >
                    পরবর্তী ({upcomingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('all')}
                    className={`min-h-[34px] rounded-lg px-3 text-[11px] font-semibold transition-colors ${
                      queueFilter === 'all' ? tokens.queueTabActive : tokens.queueTabInactive
                    }`}
                  >
                    সব আয়াত ({playlist.length})
                  </button>
                </div>
              </div>

              <div
                ref={queueContainerRef}
                className={`flex-1 divide-y overflow-y-auto px-3 py-2 md:px-4 ${tokens.queueDivider}`}
              >
                {queueItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <p className={`text-sm font-medium ${tokens.meaningText}`}>
                      এটিই এই সংকলনের শেষ আয়াত।
                    </p>
                    <button
                      type="button"
                      onClick={() => setQueueFilter('all')}
                      className={`mt-3 min-h-[40px] rounded-xl border px-4 text-xs font-semibold ${tokens.emptyBtn}`}
                    >
                      সম্পূর্ণ তালিকা দেখুন
                    </button>
                  </div>
                ) : (
                  queueItems.map(({ item, idx }) => {
                    const isCurrent = idx === currentIndex;
                    const isNext = idx === currentIndex + 1;
                    const isDone = idx < currentIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectTrack(idx)}
                        className={`flex w-full flex-col gap-2 rounded-2xl px-3.5 py-3.5 text-left transition-colors ${
                          isCurrent
                            ? tokens.queueRowCurrent
                            : isNext
                            ? tokens.queueRowNext
                            : isDone
                            ? tokens.queueRowDone
                            : tokens.queueRowDefault
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`font-mono-num font-semibold ${
                              isCurrent || isNext
                                ? tokens.queueRowHighlightLabel
                                : tokens.queueRowMutedLabel
                            }`}
                          >
                            {isCurrent
                              ? `▶ চলছে · ${item.titleBn}`
                              : isNext
                              ? `পরবর্তী · ${item.titleBn}`
                              : `${idx + 1}. ${item.titleBn}`}
                          </span>
                          <span className={`shrink-0 ${tokens.queueRowActionHint}`}>
                            শুনতে ট্যাপ করুন
                          </span>
                        </div>

                        {showArabic && item.arabic && (
                          <TajweedArabicText
                            plainArabic={item.arabic}
                            tajweedArabic={item.tajweedArabic}
                            enableTajweed={tajweedColorCoding}
                            className={`font-arabic text-right ${tokens.arabicText}`}
                            style={{
                              fontSize: `${Math.max(20, Math.min(28, arabicFontSize - 4))}px`,
                              lineHeight: 2.0,
                            }}
                          />
                        )}

                        {showBengaliTransliteration && item.bengaliTranslit && (
                          <p className={`text-xs font-medium leading-relaxed ${tokens.translitText}`}>
                            {item.bengaliTranslit}
                          </p>
                        )}

                        {showBengaliTranslation && item.meaningBn && (
                          <p className={`text-xs leading-relaxed md:text-sm ${tokens.meaningText}`}>
                            {item.meaningBn}
                          </p>
                        )}

                        {showEnglishTranslation && item.englishMeaning && (
                          <p className={`text-xs leading-relaxed ${tokens.englishText}`}>
                            {item.englishMeaning}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Bottom Scrubber & Controls */}
          <div
            className={`relative z-10 shrink-0 border-t px-4 py-3 backdrop-blur-md transition-colors md:px-10 ${tokens.bottomControlsBar}`}
          >
            <div className="mx-auto max-w-3xl space-y-2.5">
              <div className="flex items-center gap-3">
                <span className={`font-mono-num w-10 text-right text-xs ${tokens.scrubberTime}`}>
                  {formatSeconds(progress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="অডিও অগ্রগতি"
                  className={`h-1.5 w-full cursor-pointer ${tokens.scrubberAccent}`}
                />
                <span className={`font-mono-num w-10 text-xs ${tokens.scrubberTime}`}>
                  {formatSeconds(duration)}
                </span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={onToggleLoop}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
                    isLooping ? tokens.loopActive : tokens.loopInactive
                  }`}
                  aria-label="পুনরাবৃত্তি চালু/বন্ধ"
                  title="পুনরাবৃত্তি"
                >
                  <Repeat className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onPrev}
                  disabled={currentIndex === 0}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors disabled:opacity-35 ${tokens.controlBtn}`}
                  aria-label="পূর্ববর্তী আয়াত"
                >
                  <SkipBack className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 ${tokens.playBtn}`}
                  aria-label={isPlaying ? 'বিরতি দিন' : 'চালু করুন'}
                >
                  {audioStatus === 'loading' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="ml-0.5 h-5 w-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onNext}
                  disabled={currentIndex >= playlist.length - 1}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors disabled:opacity-35 ${tokens.controlBtn}`}
                  aria-label="পরবর্তী আয়াত"
                >
                  <SkipForward className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={onClosePlayer}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${tokens.loopInactive}`}
                  aria-label="প্লেয়ার বন্ধ করুন"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Luminous Sticky Mini Audio Dock */}
      <div
        className={`fixed bottom-16 left-0 right-0 z-30 border-t shadow-2xl backdrop-blur-xl transition-colors md:bottom-0 ${tokens.miniDock}`}
      >
        <div className={`h-0.5 w-full ${tokens.miniTrackBg}`}>
          <div
            className={`h-full transition-[width] duration-150 ${tokens.miniTrackFill}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tokens.miniIconBox}`}
            >
              {audioStatus === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold ${tokens.miniTitle}`}>
                {track.titleBn}
              </p>
              <p className={`truncate text-xs ${tokens.miniSubtitle}`}>
                {statusLabel} · {track.subtitleBn} ·{' '}
                <span className="font-mono-num">
                  {currentIndex + 1}/{playlist.length}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentIndex === 0}
              className={`hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg disabled:opacity-35 sm:flex ${tokens.miniIconBtn}`}
              aria-label="পূর্ববর্তী আয়াত"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl shadow-md transition-transform active:scale-95 ${tokens.playBtn}`}
              aria-label={isPlaying ? 'বিরতি' : 'চালু করুন'}
            >
              {audioStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex >= playlist.length - 1}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg disabled:opacity-35 ${tokens.miniIconBtn}`}
              aria-label="পরবর্তী আয়াত"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onSetVisualOpen(true)}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg ${tokens.miniExpandBtn}`}
              aria-label="পূর্ণ স্ক্রিন ভিজ্যুয়াল মোড"
              title="ভিজ্যুয়াল প্লেয়ার"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClosePlayer}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg ${tokens.miniIconBtn}`}
              aria-label="বন্ধ করুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
