import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import type { AppThemeId, AudioStatus, AudioTrackItem } from '../types/islamic';
import { getPlayerThemeTokens } from '../utils/playerThemes';

interface AudioPlayerBarProps {
  playlist: AudioTrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  audioStatus: AudioStatus;
  isLooping: boolean;
  isExpanded: boolean;
  appTheme: AppThemeId;
  progress: number;
  duration: number;
  errorMsg: string | null;
  favoriteAyahKeys: string[];
  hidden?: boolean;
  canJumpToSource?: boolean;
  onJumpToSource?: () => void;
  onToggleFavoriteTrack: (track: AudioTrackItem) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onClosePlayer: () => void;
  onSetExpanded: (open: boolean) => void;
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
  isExpanded,
  appTheme,
  progress,
  duration,
  errorMsg,
  favoriteAyahKeys,
  hidden = false,
  canJumpToSource = false,
  onJumpToSource,
  onToggleFavoriteTrack,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleLoop,
  onSeek,
  onClosePlayer,
  onSetExpanded,
}) => {
  const tokens = useMemo(() => getPlayerThemeTokens(appTheme), [appTheme]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        onSetExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isExpanded, onSetExpanded]);

  if (playlist.length === 0 || hidden) return null;
  const track = playlist[currentIndex] || playlist[0];
  const trackFavKey = `${track.surah}:${track.ayah}`;
  const isTrackFavorited = favoriteAyahKeys.includes(trackFavKey);
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const statusLabel = getStatusLabel(audioStatus, errorMsg);

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-30 border-t shadow-2xl backdrop-blur-xl transition-colors md:bottom-0 ${tokens.miniDock}`}
      role="region"
      aria-label="অডিও প্লেয়ার"
    >
      {/* Slim Progress Indicator */}
      <div className={`h-0.5 w-full ${tokens.miniTrackBg}`}>
        <div
          className={`h-full transition-[width] duration-150 ${tokens.miniTrackFill}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* In-place Expanded Controls Drawer (keeps Quran/Ruqyah reader visible above) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded-mini-controls"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-black/10 dark:border-white/10"
          >
            <div className="mx-auto max-w-4xl space-y-2.5 px-4 pb-3 pt-2.5">
              {/* Row 1: Track Title + Favorite + Jump to Reader */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tokens.miniIconBox}`}
                  >
                    {audioStatus === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-bold ${tokens.miniTitle}`}>
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

                <div className="flex shrink-0 items-center gap-1.5">
                  {canJumpToSource && onJumpToSource && (
                    <button
                      type="button"
                      onClick={onJumpToSource}
                      className={`flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${tokens.iconBtn}`}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>পাঠ খুলুন</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggleFavoriteTrack(track)}
                    className={`flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
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
                    <span>{isTrackFavorited ? 'ফেভারিট' : 'সেভ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetExpanded(false)}
                    className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border transition-colors ${tokens.iconBtn}`}
                    aria-label="ছোট করুন"
                    title="ছোট করুন"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onClosePlayer}
                    className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border transition-colors ${tokens.iconBtn}`}
                    aria-label="প্লেয়ার বন্ধ করুন"
                    title="বন্ধ করুন"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Seek Scrubber */}
              <div className="flex items-center gap-2.5">
                <span className={`font-mono-num w-9 text-right text-[11px] ${tokens.scrubberTime}`}>
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
                <span className={`font-mono-num w-9 text-[11px] ${tokens.scrubberTime}`}>
                  {formatSeconds(duration)}
                </span>
              </div>

              {errorMsg && (
                <p className={`text-center text-xs ${tokens.errorText}`}>{errorMsg}</p>
              )}

              {/* Row 3: Full Playback Controls */}
              <div className="flex items-center justify-center gap-3.5">
                <button
                  type="button"
                  onClick={onToggleLoop}
                  className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors ${
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
                  className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors disabled:opacity-35 ${tokens.controlBtn}`}
                  aria-label="পূর্ববর্তী আয়াত"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 ${tokens.playBtn}`}
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
                  className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors disabled:opacity-35 ${tokens.controlBtn}`}
                  aria-label="পরবর্তী আয়াত"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Sticky Mini Bar (shown when collapsed) */}
      {!isExpanded && (
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2.5 px-4 py-1.5">
          <button
            type="button"
            onClick={canJumpToSource && onJumpToSource ? onJumpToSource : undefined}
            disabled={!(canJumpToSource && onJumpToSource)}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition-colors ${
              canJumpToSource && onJumpToSource
                ? 'cursor-pointer hover:bg-black/5 active:scale-[0.99] dark:hover:bg-white/5'
                : 'cursor-default'
            }`}
            aria-label={canJumpToSource ? `${track.titleBn} — পাঠে ফিরে যান` : track.titleBn}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tokens.miniIconBox}`}
            >
              {audioStatus === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className={`truncate text-sm font-semibold ${tokens.miniTitle}`}>
                  {track.titleBn}
                </p>
                {canJumpToSource && onJumpToSource && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                    <span>যান</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                )}
              </div>
              <p className={`truncate text-xs ${tokens.miniSubtitle}`}>
                {statusLabel} · {track.subtitleBn} ·{' '}
                <span className="font-mono-num">
                  {currentIndex + 1}/{playlist.length}
                </span>
              </p>
            </div>
          </button>

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
              onClick={() => onSetExpanded(true)}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg ${tokens.miniExpandBtn}`}
              aria-label="প্লেয়ার নিয়ন্ত্রণ বড় করুন"
              title="নিয়ন্ত্রণ বড় করুন"
            >
              <ChevronUp className="h-4 w-4" />
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
      )}
    </div>
  );
};
