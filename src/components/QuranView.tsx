import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderPlus,
  Folders,
  Heart,
  Loader2,
  Maximize2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  ALL_SURAHS,
  buildEveryAyahUrl,
  QARI_RECITERS,
  QURAN_STUDY_IMG,
} from '../data/islamicData';
import { buildBanglaQuranSurahUrl } from '../data/banglaQuranAudio';
import { fetchSurahWithBengali } from '../services/islamicApi';
import type {
  AppSettings,
  AudioTrackItem,
  FavoriteAyahEntry,
  FavoriteGroup,
  QariReciter,
  QuranAyahPair,
} from '../types/islamic';
import {
  TAJWEED_COLOR_CLASSES,
  TAJWEED_LEGEND,
} from '../utils/quranFormatting';
import {
  countCachedAudioUrls,
  downloadAudioUrlsForOffline,
  prewarmUpcomingAudioUrls,
} from '../utils/offlineAudioCache';
import { TajweedArabicText } from './TajweedArabicText';
import { SmoothStage } from './SmoothTransition';

interface QuranViewProps {
  selectedQari: QariReciter;
  onChangeQari: (qari: QariReciter) => void;
  activeTrackKey: string | null;
  isPlaying: boolean;
  settings: AppSettings;
  favoriteAyahs: FavoriteAyahEntry[];
  favoriteGroups: FavoriteGroup[];
  onSaveAyahToGroups: (entry: FavoriteAyahEntry, groupIds: string[]) => void;
  onCreateFavoriteGroup: (name: string) => FavoriteGroup | null;
  onRenameFavoriteGroup: (groupId: string, newName: string) => void;
  onDeleteFavoriteGroup: (groupId: string) => void;
  onRemoveFavoriteAyah: (key: string) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onPlayPlaylist: (tracks: AudioTrackItem[], startIndex: number, openVisual?: boolean) => void;
  onTogglePlay: () => void;
  routeIntent?: {
    viewMode: 'surah' | 'favorites';
    surahNum?: number;
    seq: number;
  } | null;
  onReaderStateChange?: (state: {
    viewMode: 'surah' | 'favorites';
    readerOpen: boolean;
    selectedSurahNum: number;
  }) => void;
}

const SUGGESTED_FAVORITES: Array<{
  surah: number;
  ayah: number;
  labelBn: string;
}> = [
  { surah: 2, ayah: 255, labelBn: 'আয়াতুল কুরসি (২:২৫৫)' },
  { surah: 2, ayah: 286, labelBn: 'সর্বশেষ দোয়া ও তাওবা (২:২৮৬)' },
  { surah: 94, ayah: 5, labelBn: 'কষ্টের সাথেই স্বস্তি (৯৪:৫)' },
  { surah: 2, ayah: 201, labelBn: 'রাব্বানা আতিনা (২:২০১)' },
  { surah: 39, ayah: 53, labelBn: 'আল্লাহর রহমত থেকে নিরাশ না হওয়া (৩৯:৫৩)' },
];

function getEntryGroupIds(entry: FavoriteAyahEntry): string[] {
  return entry.groupIds && entry.groupIds.length > 0 ? entry.groupIds : ['default'];
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndicDigits(num: number): string {
  return String(num)
    .split('')
    .map((ch) => ARABIC_INDIC_DIGITS[Number(ch)] ?? ch)
    .join('');
}

export const QuranView: React.FC<QuranViewProps> = ({
  selectedQari,
  onChangeQari,
  activeTrackKey,
  isPlaying,
  settings,
  favoriteAyahs,
  favoriteGroups,
  onSaveAyahToGroups,
  onCreateFavoriteGroup,
  onRenameFavoriteGroup,
  onDeleteFavoriteGroup,
  onRemoveFavoriteAyah,
  onUpdateSettings,
  onPlayPlaylist,
  onTogglePlay,
  routeIntent = null,
  onReaderStateChange,
}) => {
  const [viewMode, setViewMode] = useState<'surah' | 'favorites'>(
    routeIntent?.viewMode || 'surah'
  );
  const [readerOpen, setReaderOpen] = useState<boolean>(
    Boolean(routeIntent && routeIntent.viewMode === 'surah')
  );
  const [readerStyle, setReaderStyle] = useState<'translation' | 'arabicOnly'>('translation');
  const [autoFollowAyah, setAutoFollowAyah] = useState(true);
  const ayahElementRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(() => {
    if (routeIntent?.surahNum && routeIntent.surahNum >= 1 && routeIntent.surahNum <= 114) {
      return routeIntent.surahNum;
    }
    try {
      const saved = Number(localStorage.getItem('noor_last_surah') || '1');
      return saved >= 1 && saved <= 114 ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [surahQuery, setSurahQuery] = useState('');
  const [ayahs, setAyahs] = useState<QuranAyahPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingSuggestionKey, setAddingSuggestionKey] = useState<string | null>(null);
  const [studyImgErr, setStudyImgErr] = useState(false);
  const [offlineSavedCount, setOfflineSavedCount] = useState(0);
  const [banglaSurahSaved, setBanglaSurahSaved] = useState(false);
  const [offlineSavingProgress, setOfflineSavingProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Favorite Groups UI state
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Cross-surah quick-add inside Favorites
  const [isAddFromSurahOpen, setIsAddFromSurahOpen] = useState(false);
  const [pickSurahNum, setPickSurahNum] = useState<number>(2);
  const [pickAyahNum, setPickAyahNum] = useState<number>(255);
  const [pickTargetGroupId, setPickTargetGroupId] = useState<string>('default');
  const [addingCrossSurah, setAddingCrossSurah] = useState(false);
  const [crossSurahFeedback, setCrossSurahFeedback] = useState<string | null>(null);

  // Modal for choosing which group(s) an Ayah belongs to
  const [groupPickerEntry, setGroupPickerEntry] = useState<FavoriteAyahEntry | null>(null);
  const [pickerInlineNewGroup, setPickerInlineNewGroup] = useState('');

  const surahMeta = useMemo(
    () => ALL_SURAHS.find((s) => s.number === selectedSurahNum) || ALL_SURAHS[0],
    [selectedSurahNum]
  );

  const pickSurahMeta = useMemo(
    () => ALL_SURAHS.find((s) => s.number === pickSurahNum) || ALL_SURAHS[0],
    [pickSurahNum]
  );

  const favoriteMap = useMemo(() => {
    const m = new Map<string, FavoriteAyahEntry>();
    for (const f of favoriteAyahs) m.set(f.key, f);
    return m;
  }, [favoriteAyahs]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: favoriteAyahs.length };
    for (const g of favoriteGroups) counts[g.id] = 0;
    for (const fav of favoriteAyahs) {
      for (const gid of getEntryGroupIds(fav)) {
        counts[gid] = (counts[gid] || 0) + 1;
      }
    }
    return counts;
  }, [favoriteAyahs, favoriteGroups]);

  const visibleFavorites = useMemo(() => {
    if (activeGroupId === 'all') return favoriteAyahs;
    return favoriteAyahs.filter((f) => getEntryGroupIds(f).includes(activeGroupId));
  }, [favoriteAyahs, activeGroupId]);

  const activeGroupObj = useMemo(
    () => favoriteGroups.find((g) => g.id === activeGroupId) || null,
    [favoriteGroups, activeGroupId]
  );

  useEffect(() => {
    if (activeGroupId !== 'all' && !favoriteGroups.some((g) => g.id === activeGroupId)) {
      setActiveGroupId('all');
    }
  }, [activeGroupId, favoriteGroups]);

  useEffect(() => {
    if (activeGroupId !== 'all') {
      setPickTargetGroupId(activeGroupId);
    }
  }, [activeGroupId]);

  useEffect(() => {
    if (!routeIntent) return;
    setViewMode(routeIntent.viewMode);
    if (routeIntent.viewMode === 'surah') {
      if (routeIntent.surahNum && routeIntent.surahNum >= 1 && routeIntent.surahNum <= 114) {
        setSelectedSurahNum(routeIntent.surahNum);
      }
      setReaderOpen(true);
    }
  }, [routeIntent]);

  useEffect(() => {
    onReaderStateChange?.({ viewMode, readerOpen, selectedSurahNum });
  }, [viewMode, readerOpen, selectedSurahNum, onReaderStateChange]);

  const filteredSurahs = useMemo(() => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return ALL_SURAHS;
    return ALL_SURAHS.filter(
      (s) =>
        s.nameBn.toLowerCase().includes(q) ||
        s.meaningBn.toLowerCase().includes(q) ||
        s.nameAr.includes(q) ||
        String(s.number) === q
    );
  }, [surahQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('noor_last_surah', String(selectedSurahNum));
    } catch {
      // ignore
    }

    fetchSurahWithBengali(selectedSurahNum, selectedQari)
      .then((list) => {
        if (active) {
          setAyahs(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'সূরা লোড করতে সমস্যা হয়েছে');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSurahNum, selectedQari]);

  useEffect(() => {
    let active = true;
    const banglaUrl = buildBanglaQuranSurahUrl(selectedSurahNum);
    countCachedAudioUrls([banglaUrl]).then((cnt) => {
      if (active) setBanglaSurahSaved(cnt > 0);
    });
    if (ayahs.length === 0) {
      setOfflineSavedCount(0);
      return;
    }
    countCachedAudioUrls(ayahs.map((a) => a.audioUrl)).then((cnt) => {
      if (active) {
        setOfflineSavedCount(cnt);
        if (cnt > 0) {
          prewarmUpcomingAudioUrls(ayahs.slice(0, 3).map((a) => a.audioUrl));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [ayahs, selectedSurahNum]);

  // Keep the currently reciting Ayah scrolled smoothly to the top of the reader view
  useEffect(() => {
    if (!autoFollowAyah || !activeTrackKey || loading) return;
    const el = ayahElementRefs.current.get(activeTrackKey);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTrackKey, autoFollowAyah, ayahs.length, loading, readerStyle]);

  const handleDownloadSurahOffline = async () => {
    if (ayahs.length === 0 || offlineSavingProgress) return;
    const banglaUrl = buildBanglaQuranSurahUrl(selectedSurahNum);
    const ayahUrls = ayahs.map((a) => a.audioUrl);
    const urls = [...ayahUrls, banglaUrl];
    setOfflineSavingProgress({ done: 0, total: urls.length });
    try {
      await downloadAudioUrlsForOffline(urls, (done, total) => {
        setOfflineSavingProgress({ done, total });
      });
      const updated = await countCachedAudioUrls(ayahUrls);
      const bnCnt = await countCachedAudioUrls([banglaUrl]);
      setOfflineSavedCount(updated);
      setBanglaSurahSaved(bnCnt > 0);
    } finally {
      setOfflineSavingProgress(null);
    }
  };

  const handlePlayBanglaTranslationSurah = () => {
    const banglaUrl = buildBanglaQuranSurahUrl(selectedSurahNum);
    const trackId = `bn-quran-${selectedSurahNum}`;
    if (activeTrackKey === trackId) {
      onTogglePlay();
      return;
    }
    const track: AudioTrackItem = {
      id: trackId,
      titleBn: `সূরা ${surahMeta.nameBn} (বাংলা অনুবাদসহ)`,
      subtitleBn: 'মিশারি আল-আফাসি + ইসলামিক ফাউন্ডেশন বাংলাদেশ (পুরুষ কণ্ঠ)',
      arabic: ayahs[0]?.arabic || surahMeta.nameAr,
      tajweedArabic: ayahs[0]?.tajweedArabic,
      meaningBn: `${surahMeta.meaningBn} · ইসলামিক ফাউন্ডেশন বাংলা অনুবাদ তিলাওয়াত`,
      audioUrl: banglaUrl,
      surah: selectedSurahNum,
      ayah: 1,
    };
    onPlayPlaylist([track], 0, false);
  };

  const buildTracks = (): AudioTrackItem[] =>
    ayahs.map((a) => ({
      id: `${selectedSurahNum}:${a.numberInSurah}`,
      titleBn: `সূরা ${surahMeta.nameBn} · আয়াত ${a.numberInSurah}`,
      subtitleBn: `${selectedQari.nameBn}`,
      arabic: a.arabic,
      tajweedArabic: a.tajweedArabic,
      bengaliTranslit: a.bengaliTranslit,
      meaningBn: a.bengali,
      englishMeaning: a.english,
      audioUrl: a.audioUrl,
      surah: selectedSurahNum,
      ayah: a.numberInSurah,
    }));

  const buildFavoriteTracks = (items: FavoriteAyahEntry[]): AudioTrackItem[] =>
    items.map((f) => ({
      id: f.key,
      titleBn: `সূরা ${f.surahNameBn} · আয়াত ${f.ayah}`,
      subtitleBn: `${activeGroupObj ? activeGroupObj.name : 'ফেভারিট সংগ্রহ'} · ${selectedQari.nameBn}`,
      arabic: f.arabic,
      tajweedArabic: f.tajweedArabic,
      bengaliTranslit: f.bengaliTranslit,
      meaningBn: f.bengali,
      englishMeaning: f.english,
      audioUrl: buildEveryAyahUrl(selectedQari.everyAyahFolder, f.surah, f.ayah),
      surah: f.surah,
      ayah: f.ayah,
    }));

  const handlePlaySurah = (startIndex = 0, openVisual = false) => {
    if (ayahs.length === 0) return;
    onPlayPlaylist(buildTracks(), startIndex, openVisual);
  };

  const handlePlayFavorites = (startIndex = 0, openVisual = false) => {
    if (visibleFavorites.length === 0) return;
    onPlayPlaylist(buildFavoriteTracks(visibleFavorites), startIndex, openVisual);
  };

  const addSpecificAyahToGroup = async (
    surah: number,
    ayah: number,
    targetGroupId: string
  ) => {
    const key = `${surah}:${ayah}`;
    const existing = favoriteMap.get(key);
    if (existing) {
      const currentGroups = getEntryGroupIds(existing);
      if (!currentGroups.includes(targetGroupId)) {
        onSaveAyahToGroups(existing, [...currentGroups, targetGroupId]);
      }
      return true;
    }

    const list = await fetchSurahWithBengali(surah, selectedQari);
    const found = list.find((a) => a.numberInSurah === ayah);
    const meta = ALL_SURAHS.find((s) => s.number === surah);
    if (!found) return false;

    onSaveAyahToGroups(
      {
        key,
        surah,
        ayah,
        surahNameBn: meta?.nameBn || `সূরা ${surah}`,
        arabic: found.arabic,
        tajweedArabic: found.tajweedArabic,
        bengaliTranslit: found.bengaliTranslit,
        bengali: found.bengali,
        english: found.english,
        groupIds: [targetGroupId],
        savedAt: Date.now(),
      },
      [targetGroupId]
    );
    return true;
  };

  const handleQuickAddSuggestion = async (surah: number, ayah: number) => {
    const key = `${surah}:${ayah}`;
    const targetGroupId = activeGroupId === 'all' ? 'default' : activeGroupId;
    setAddingSuggestionKey(key);
    try {
      await addSpecificAyahToGroup(surah, ayah, targetGroupId);
    } finally {
      setAddingSuggestionKey(null);
    }
  };

  const handleCrossSurahSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clampedAyah = Math.max(1, Math.min(pickSurahMeta.ayahCount, pickAyahNum));
    setAddingCrossSurah(true);
    setCrossSurahFeedback(null);
    try {
      const ok = await addSpecificAyahToGroup(
        pickSurahNum,
        clampedAyah,
        pickTargetGroupId
      );
      if (ok) {
        const grpName =
          favoriteGroups.find((g) => g.id === pickTargetGroupId)?.name || 'সংগ্রহ';
        setCrossSurahFeedback(
          `সূরা ${pickSurahMeta.nameBn} (${pickSurahNum}:${clampedAyah}) "${grpName}" গ্রুপে যোগ হয়েছে`
        );
      } else {
        setCrossSurahFeedback('আয়াতটি লোড করা যায়নি, আবার চেষ্টা করুন');
      }
    } catch {
      setCrossSurahFeedback('ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন');
    } finally {
      setAddingCrossSurah(false);
    }
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created = onCreateFavoriteGroup(newGroupInput);
    if (created) {
      setNewGroupInput('');
      setIsNewGroupModalOpen(false);
      setActiveGroupId(created.id);
      setPickTargetGroupId(created.id);
    }
  };

  const handleToggleGroupMembership = (entry: FavoriteAyahEntry, groupId: string) => {
    const existing = favoriteMap.get(entry.key);
    const currentGroups = existing ? getEntryGroupIds(existing) : [];
    const nextGroups = currentGroups.includes(groupId)
      ? currentGroups.filter((id) => id !== groupId)
      : [...currentGroups, groupId];
    onSaveAyahToGroups(existing || entry, nextGroups);
  };

  const handleCreateAndAssignInPicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupPickerEntry) return;
    const created = onCreateFavoriteGroup(pickerInlineNewGroup);
    if (!created) return;
    const existing = favoriteMap.get(groupPickerEntry.key);
    const currentGroups = existing ? getEntryGroupIds(existing) : [];
    onSaveAyahToGroups(existing || groupPickerEntry, [...currentGroups, created.id]);
    setPickerInlineNewGroup('');
  };

  const handleOpenSurah = (surahNum: number) => {
    setSelectedSurahNum(surahNum);
    setViewMode('surah');
    setReaderOpen(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Quran View Switcher: Surah Directory (114) vs Favorite Ayahs */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2">
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode('surah');
              setReaderOpen(false);
            }}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all sm:flex-none ${
              viewMode === 'surah'
                ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm'
                : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/5'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span className="whitespace-nowrap">সূরাসমূহ (১১৪)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('favorites')}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all sm:flex-none ${
              viewMode === 'favorites'
                ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-sm'
                : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8] dark:hover:bg-white/5'
            }`}
          >
            <Heart
              className="h-4 w-4"
              fill={viewMode === 'favorites' || favoriteAyahs.length > 0 ? 'currentColor' : 'none'}
            />
            <span className="whitespace-nowrap">
              ফেভারিট আয়াত ({favoriteAyahs.length})
            </span>
          </button>
        </div>

        <p className="hidden text-xs text-[#475A53] dark:text-[#9BB0A8] md:block">
          পছন্দের সূরা নির্বাচন করে অনুবাদসহ বা শুধু আরবি কুরআন পড়ুন
        </p>
      </div>

      <SmoothStage
        stageKey={
          viewMode === 'favorites'
            ? 'favorites'
            : !readerOpen
            ? 'surah-directory'
            : `surah-reader-${selectedSurahNum}`
        }
      >
      {viewMode === 'favorites' ? (
        /* FAVORITE AYAHS & NAMED GROUPS SECTION */
        <div className="space-y-5">
          {/* Favorites Header Stage */}
          <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/25 bg-[#063D34] bg-gradient-to-br from-[#08463B] via-[#052B24] to-[#031714] p-6 text-white shadow-[0_18px_44px_rgba(4,28,23,0.25)] md:p-7">
            <div
              className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold text-[#F2D58E]">
                  {activeGroupObj ? `গ্রুপ: ${activeGroupObj.name}` : 'সকল ফেভারিট গ্রুপ'} ·{' '}
                  {visibleFavorites.length}টি আয়াত
                </p>
                <h2 className="mt-1 text-2xl font-bold text-white">
                  আমার ফেভারিট আয়াত ও গ্রুপসমূহ
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#D0E2DC] md:text-sm">
                  বিষয়ভিত্তিক গ্রুপ তৈরি করে ভিন্ন ভিন্ন সূরার আয়াত একসাথে রাখুন এবং ধারাবাহিকভাবে তিলাওয়াত শুনুন।
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {visibleFavorites.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePlayFavorites(0, false)}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#C2923B] px-4 text-xs font-bold text-[#041D18] shadow-md"
                    >
                      <Volume2 className="h-4 w-4" />
                      <span>
                        {activeGroupObj ? 'এই গ্রুপ শুনুন' : 'সব ফেভারিট শুনুন'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePlayFavorites(0, true)}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                    >
                      <Maximize2 className="h-4 w-4 text-[#E7C57B]" />
                      <span>ভিজ্যুয়াল প্লেয়ার</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Group Selector & Group Management Bar */}
          <section className="glass-card rounded-3xl p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tap-to-select Group Button */}
              <button
                type="button"
                onClick={() => setIsGroupDropdownOpen(true)}
                className="flex min-h-[46px] flex-1 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 text-left transition-colors hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-white/[0.04] sm:flex-initial sm:min-w-[260px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Folders className="h-4 w-4 shrink-0 text-[#0D6E52] dark:text-[#E7C57B]" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-[#475A53] dark:text-[#9BB0A8]">
                      নির্বাচিত গ্রুপ (চাপ দিয়ে বদলান)
                    </p>
                    <p className="truncate text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                      {activeGroupObj
                        ? `${activeGroupObj.name} (${groupCounts[activeGroupObj.id] || 0})`
                        : `সব গ্রুপ (${favoriteAyahs.length})`}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#475A53] dark:text-[#9BB0A8]" />
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>নতুন গ্রুপ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddFromSurahOpen((v) => !v)}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3.5 text-xs font-bold text-[#0F1F1A] transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05] dark:text-[#F0F5F3]"
                >
                  <Plus className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                  <span>ভিন্ন সূরার আয়াত যোগ করুন</span>
                </button>
              </div>
            </div>

            {/* Active Custom Group Rename / Delete bar */}
            {activeGroupObj && activeGroupObj.id !== 'default' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3 dark:border-white/8">
                {renamingGroupId === activeGroupObj.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onRenameFavoriteGroup(activeGroupObj.id, renameInput);
                      setRenamingGroupId(null);
                    }}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      placeholder="গ্রুপের নতুন নাম..."
                      className="min-h-[38px] flex-1 rounded-xl border border-black/15 bg-white/80 px-3 text-xs font-semibold text-[#0F1F1A] focus:outline-none dark:border-white/15 dark:bg-black/30 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] rounded-xl bg-[#0D6E52] px-3.5 text-xs font-bold text-white"
                    >
                      সেভ
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingGroupId(null)}
                      className="min-h-[38px] rounded-xl border border-black/10 px-3 text-xs text-[#475A53] dark:border-white/10 dark:text-[#9BB0A8]"
                    >
                      বাতিল
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                      কাস্টম গ্রুপ: <strong className="text-[#0F1F1A] dark:text-white">{activeGroupObj.name}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingGroupId(activeGroupObj.id);
                          setRenameInput(activeGroupObj.name);
                        }}
                        className="flex min-h-[34px] items-center gap-1 rounded-lg border border-black/10 px-2.5 text-[11px] font-semibold text-[#475A53] hover:bg-black/[0.04] dark:border-white/10 dark:text-[#9BB0A8]"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>নাম বদলান</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFavoriteGroup(activeGroupObj.id)}
                        className="flex min-h-[34px] items-center gap-1 rounded-lg border border-rose-500/25 px-2.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>গ্রুপ মুছুন</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Collapsible Cross-Surah Ayah Adder */}
            {isAddFromSurahOpen && (
              <form
                onSubmit={handleCrossSurahSubmit}
                className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                    যেকোনো সূরার আয়াত সরাসরি পছন্দের গ্রুপে যোগ করুন
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddFromSurahOpen(false)}
                    className="rounded-lg p-1 text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]"
                    aria-label="বন্ধ করুন"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="cross-surah-select"
                      className="mb-1 block text-[11px] font-semibold text-[#475A53] dark:text-[#9BB0A8]"
                    >
                      সূরা নির্বাচন করুন
                    </label>
                    <select
                      id="cross-surah-select"
                      value={pickSurahNum}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        setPickSurahNum(num);
                        setPickAyahNum(1);
                      }}
                      className="min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#0F1F1A] focus:outline-none dark:border-white/15 dark:bg-[#0B1714] dark:text-white"
                    >
                      {ALL_SURAHS.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {s.nameBn} ({s.ayahCount} আয়াত)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cross-ayah-input"
                      className="mb-1 block text-[11px] font-semibold text-[#475A53] dark:text-[#9BB0A8]"
                    >
                      আয়াত নম্বর (১ - {pickSurahMeta.ayahCount})
                    </label>
                    <input
                      id="cross-ayah-input"
                      type="number"
                      min={1}
                      max={pickSurahMeta.ayahCount}
                      value={pickAyahNum}
                      onChange={(e) => setPickAyahNum(Number(e.target.value) || 1)}
                      className="font-mono-num min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-[#0F1F1A] focus:outline-none dark:border-white/15 dark:bg-[#0B1714] dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cross-group-select"
                      className="mb-1 block text-[11px] font-semibold text-[#475A53] dark:text-[#9BB0A8]"
                    >
                      কোন গ্রুপে রাখবেন?
                    </label>
                    <select
                      id="cross-group-select"
                      value={pickTargetGroupId}
                      onChange={(e) => setPickTargetGroupId(e.target.value)}
                      className="min-h-[42px] w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#0F1F1A] focus:outline-none dark:border-white/15 dark:bg-[#0B1714] dark:text-white"
                    >
                      {favoriteGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {crossSurahFeedback ? (
                    <p className="text-xs font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
                      {crossSurahFeedback}
                    </p>
                  ) : (
                    <span className="text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                      উদাহরণ: সূরা বাকারা (২), আয়াত ২৫৫ বা সূরা ইনশিরাহ (৯৪), আয়াত ৫
                    </span>
                  )}

                  <button
                    type="submit"
                    disabled={addingCrossSurah}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] disabled:opacity-60"
                  >
                    {addingCrossSurah ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>গ্রুপে যোগ করুন</span>
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Favorites Ayah List */}
          <section className="glass-card rounded-3xl p-5 md:p-7">
            {visibleFavorites.length === 0 ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D6E52]/10 text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                  <Heart className="h-7 w-7" />
                </div>
                <h3 className="mt-3 text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  {activeGroupObj
                    ? `"${activeGroupObj.name}" গ্রুপে এখনও কোনো আয়াত নেই`
                    : 'এখনও কোনো আয়াত ফেভারিট করা হয়নি'}
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                  ওপরের "ভিন্ন সূরার আয়াত যোগ করুন" বাটন থেকে অথবা সূরা পড়ার সময় ❤️ আইকনে ট্যাপ করে এই গ্রুপে আয়াত যোগ করুন।
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddFromSurahOpen(true)}
                    className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-5 text-xs font-bold text-[#F6DC9B]"
                  >
                    + ভিন্ন সূরা থেকে আয়াত যোগ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('surah')}
                    className="min-h-[44px] rounded-xl border border-black/10 px-4 text-xs font-semibold text-[#0F1F1A] dark:border-white/15 dark:text-white"
                  >
                    সূরা তালিকায় যান
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-black/8 dark:divide-white/8">
                {visibleFavorites.map((fav, idx) => {
                  const isThisTrack = activeTrackKey === fav.key;
                  const entryGroups = getEntryGroupIds(fav)
                    .map((gid) => favoriteGroups.find((g) => g.id === gid))
                    .filter((g): g is FavoriteGroup => Boolean(g));

                  return (
                    <article
                      key={fav.key}
                      className={`py-5 transition-all duration-300 ${
                        isThisTrack
                          ? 'rounded-2xl border-l-4 border-l-[#0D6E52] bg-[#0D6E52]/[0.05] px-4 ring-1 ring-[#0D6E52]/12 dark:border-l-[#E7C57B] dark:bg-[#0D6E52]/15 dark:ring-[#E7C57B]/20'
                          : ''
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-num inline-flex items-center gap-2 text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                            {isThisTrack && (
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isPlaying
                                    ? 'animate-pulse bg-[#0D6E52] dark:bg-[#6EE7B7]'
                                    : 'bg-[#D4A853]'
                                }`}
                              />
                            )}
                            <span>
                              সূরা {fav.surahNameBn} · আয়াত {fav.surah}:{fav.ayah}
                            </span>
                          </span>
                          {entryGroups.map((grp) => (
                            <button
                              key={grp.id}
                              type="button"
                              onClick={() => setGroupPickerEntry(fav)}
                              className="rounded-lg bg-[#0D6E52]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]"
                            >
                              {grp.name}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setGroupPickerEntry(fav)}
                            className="min-h-[38px] rounded-xl border border-black/10 px-2.5 text-[11px] font-semibold text-[#475A53] hover:bg-black/5 dark:border-white/15 dark:text-[#9BB0A8] dark:hover:bg-white/5"
                          >
                            গ্রুপ
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSurah(fav.surah)}
                            className="min-h-[38px] rounded-xl border border-black/10 px-2.5 text-[11px] font-semibold text-[#475A53] hover:bg-black/5 dark:border-white/15 dark:text-[#9BB0A8] dark:hover:bg-white/5"
                          >
                            সূরায় যান
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (isThisTrack) onTogglePlay();
                              else handlePlayFavorites(idx, false);
                            }}
                            className={`flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl transition-colors ${
                              isThisTrack && isPlaying
                                ? 'bg-[#063D34] text-[#E7C57B]'
                                : 'text-[#0D6E52] hover:bg-black/5 dark:text-[#34B38A] dark:hover:bg-white/5'
                            }`}
                            aria-label={isThisTrack && isPlaying ? 'বিরতি' : 'আয়াত শুনুন'}
                          >
                            {isThisTrack && isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveFavoriteAyah(fav.key)}
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                            aria-label="ফেভারিট থেকে সরান"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {settings.showArabic && fav.arabic && (
                        <TajweedArabicText
                          plainArabic={fav.arabic}
                          tajweedArabic={fav.tajweedArabic}
                          enableTajweed={settings.tajweedColorCoding}
                          className="font-arabic text-right text-[#0F1F1A] dark:text-[#F0F5F3]"
                          style={{
                            fontSize: `${settings.arabicFontSize}px`,
                            lineHeight: 2.15,
                          }}
                        />
                      )}

                      {settings.showBengaliTransliteration && fav.bengaliTranslit && (
                        <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#0D6E52] dark:text-[#6EE7B7]">
                          {fav.bengaliTranslit}
                        </p>
                      )}

                      {settings.showBengaliTranslation && fav.bengali && (
                        <p className="mt-2.5 text-base leading-relaxed text-[#475A53] dark:text-[#C2D4CD]">
                          {fav.bengali}
                        </p>
                      )}

                      {settings.showEnglishTranslation && fav.english && (
                        <p className="mt-2 text-sm leading-relaxed text-[#5C7068] dark:text-[#9BB0A8]">
                          {fav.english}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {/* Quick-Add Popular Quranic Ayahs into Active Group */}
            <div className="mt-6 border-t border-black/8 pt-5 dark:border-white/8">
              <p className="text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                ১-ট্যাপে প্রসিদ্ধ আয়াত{' '}
                {activeGroupObj ? `"${activeGroupObj.name}" গ্রুপে` : 'ফেভারিটে'} যোগ করুন
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SUGGESTED_FAVORITES.map((sug) => {
                  const key = `${sug.surah}:${sug.ayah}`;
                  const existing = favoriteMap.get(key);
                  const targetGroupId = activeGroupId === 'all' ? 'default' : activeGroupId;
                  const alreadyInTarget = Boolean(
                    existing &&
                      (activeGroupId === 'all' ||
                        getEntryGroupIds(existing).includes(targetGroupId))
                  );
                  const isBusy = addingSuggestionKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={alreadyInTarget || isBusy}
                      onClick={() => handleQuickAddSuggestion(sug.surah, sug.ayah)}
                      className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        alreadyInTarget
                          ? 'border-[#0D6E52]/30 bg-[#0D6E52]/10 text-[#0D6E52] dark:border-[#E7C57B]/30 dark:text-[#F6DC9B]'
                          : 'border-black/10 bg-black/[0.025] text-[#0F1F1A] hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : alreadyInTarget ? (
                        <Heart className="h-3.5 w-3.5 text-rose-500" fill="currentColor" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      <span>{sug.labelBn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : !readerOpen ? (
        /* SURAH DIRECTORY FIRST LANDING VIEW (Mobile + Desktop) */
        <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
              <input
                type="search"
                value={surahQuery}
                onChange={(e) => setSurahQuery(e.target.value)}
                placeholder="সূরা খুঁজুন (নাম বা নম্বর)..."
                aria-label="সূরা খুঁজুন"
                className="min-h-[44px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
              />
            </div>

            <button
              type="button"
              onClick={() => handleOpenSurah(selectedSurahNum)}
              className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm transition-opacity hover:opacity-95"
            >
              <BookOpen className="h-4 w-4" />
              <span className="whitespace-nowrap">
                সর্বশেষ: সূরা {surahMeta.nameBn} খুলুন
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSurahs.map((s) => {
              const isLast = s.number === selectedSurahNum;
              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => handleOpenSurah(s.number)}
                  className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all ${
                    isLast
                      ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] shadow-xs dark:border-[#E7C57B]/45 dark:bg-[#063D34]/60'
                      : 'border-black/8 bg-white/75 hover:border-[#0D6E52]/35 hover:bg-[#0D6E52]/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isLast
                          ? 'bg-[#063D34] text-[#F6DC9B]'
                          : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                      }`}
                    >
                      {s.number}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                        সূরা {s.nameBn}
                      </p>
                      <p className="truncate text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                        {s.meaningBn} · {s.ayahCount} আয়াত ·{' '}
                        {s.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানী'}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="rtl"
                    className="font-arabic shrink-0 text-xl text-[#063D34] dark:text-[#F6DC9B]"
                  >
                    {s.nameAr}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        /* SURAH READER VIEW */
        <div className="space-y-4">
          {/* Reader Top Back & Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setReaderOpen(false)}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>সকল সূরা (১১৪)</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={selectedSurahNum <= 1}
                onClick={() => handleOpenSurah(Math.max(1, selectedSurahNum - 1))}
                className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>পূর্বের সূরা</span>
              </button>
              <button
                type="button"
                disabled={selectedSurahNum >= 114}
                onClick={() => handleOpenSurah(Math.min(114, selectedSurahNum + 1))}
                className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
              >
                <span>পরের সূরা</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Royal Emerald Surah Header Stage */}
            <div className="glass-card overflow-hidden rounded-3xl">
              <div className="relative grid grid-cols-1 items-stretch overflow-hidden bg-[#063D34] bg-gradient-to-br from-[#063D34] via-[#052D26] to-[#031B17] text-white md:grid-cols-12">
                <div className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75" aria-hidden="true" />
                <div className="relative z-10 flex flex-col justify-between p-6 md:col-span-8">
                  <div>
                    <p className="text-xs font-medium text-[#E7C57B]">
                      সূরা {surahMeta.number} · {surahMeta.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানী'} · {surahMeta.ayahCount} আয়াত
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                      <h2 className="text-2xl font-bold text-white md:text-3xl">
                        সূরা {surahMeta.nameBn}
                      </h2>
                      <span dir="rtl" className="font-arabic text-2xl text-[#E7C57B]">
                        {surahMeta.nameAr}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#C6DCD5]">
                      অর্থ: {surahMeta.meaningBn} · অনুবাদ: মাওলানা মুহিউদ্দীন খান
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handlePlaySurah(0, false)}
                      disabled={loading || ayahs.length === 0}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#C2923B] px-4 py-2 text-xs font-bold text-[#041D18] shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <Volume2 className="h-4 w-4" />
                      <span className="whitespace-nowrap">সম্পূর্ণ সূরা শুনুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePlayBanglaTranslationSurah}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                        activeTrackKey === `bn-quran-${selectedSurahNum}`
                          ? 'border-[#F6DC9B] bg-[#0D6E52] text-[#F6DC9B]'
                          : 'border-[#F6DC9B]/45 bg-[#D4A853]/15 text-[#F6DC9B] hover:bg-[#D4A853]/25'
                      }`}
                    >
                      {activeTrackKey === `bn-quran-${selectedSurahNum}` && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="whitespace-nowrap">
                        বাংলা অনুবাদসহ তিলাওয়াত
                        {banglaSurahSaved ? ' ✓' : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePlaySurah(0, true)}
                      disabled={loading || ayahs.length === 0}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                      <Maximize2 className="h-4 w-4 text-[#E7C57B]" />
                      <span className="whitespace-nowrap">ভিজ্যুয়াল মোড</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSurahOffline}
                      disabled={loading || ayahs.length === 0 || Boolean(offlineSavingProgress)}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        ayahs.length > 0 && offlineSavedCount >= ayahs.length && banglaSurahSaved
                          ? 'border-[#6EE7B7]/50 bg-[#0D6E52]/60 text-[#E8FFF6]'
                          : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {offlineSavingProgress ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[#F6DC9B]" />
                          <span className="font-mono-num whitespace-nowrap">
                            সেভ হচ্ছে {offlineSavingProgress.done}/{offlineSavingProgress.total}
                          </span>
                        </>
                      ) : ayahs.length > 0 && offlineSavedCount >= ayahs.length && banglaSurahSaved ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-[#6EE7B7]" />
                          <span className="whitespace-nowrap">অফলাইন প্রস্তুত</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 text-[#F6DC9B]" />
                          <span className="whitespace-nowrap">অফলাইনে সেভ</span>
                        </>
                      )}
                    </button>

                    <select
                      value={selectedQari.id}
                      onChange={(e) => {
                        const found = QARI_RECITERS.find((q) => q.id === e.target.value);
                        if (found) onChangeQari(found);
                      }}
                      aria-label="ক্বারী নির্বাচন করুন"
                      className="min-h-[44px] rounded-xl border border-white/20 bg-[#04241E]/80 px-3 text-xs font-medium text-white focus:outline-none"
                    >
                      {QARI_RECITERS.map((q) => (
                        <option key={q.id} value={q.id} className="bg-[#063D34] text-white">
                          {q.nameBn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative hidden min-h-[190px] md:col-span-4 md:block">
                  {!studyImgErr ? (
                    <img
                      src={QURAN_STUDY_IMG}
                      alt="কুরআন অধ্যয়নের রেহাল"
                      referrerPolicy="no-referrer"
                      onError={() => setStudyImgErr(true)}
                      className="h-full w-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#04241E]">
                      <BookOpen className="h-8 w-8 text-[#E7C57B]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#052D26] via-transparent to-transparent" />
                </div>
              </div>

              {/* Reading Mode Switcher (Translation vs Pure Arabic Mushaf) & Script Toolbar */}
              <div className="space-y-3 border-t border-black/8 bg-black/[0.02] px-5 py-3.5 dark:border-white/10 dark:bg-black/20 md:px-6">
                {/* Reading Layout Toggle: অনুবাদসহ পাঠ vs শুধু আরবি কুরআন */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-black/8 pb-3 dark:border-white/8">
                  <div className="inline-flex rounded-xl border border-black/10 bg-white/80 p-1 dark:border-white/15 dark:bg-black/30">
                    <button
                      type="button"
                      onClick={() => setReaderStyle('translation')}
                      className={`min-h-[36px] rounded-lg px-3.5 text-xs font-bold transition-all ${
                        readerStyle === 'translation'
                          ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-xs'
                          : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8] dark:hover:text-white'
                      }`}
                    >
                      অনুবাদসহ পাঠ
                    </button>
                    <button
                      type="button"
                      onClick={() => setReaderStyle('arabicOnly')}
                      className={`min-h-[36px] rounded-lg px-3.5 text-xs font-bold transition-all ${
                        readerStyle === 'arabicOnly'
                          ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-xs'
                          : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8] dark:hover:text-white'
                      }`}
                    >
                      শুধু আরবি কুরআন
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    <button
                      type="button"
                      onClick={() => setAutoFollowAyah((v) => !v)}
                      className={`min-h-[32px] rounded-lg border px-2.5 text-[11px] font-bold transition-colors ${
                        autoFollowAyah
                          ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#6EE7B7]/45 dark:bg-[#0D6E52]/35 dark:text-[#E8FFF6]'
                          : 'border-black/10 bg-white/80 text-[#475A53] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                      }`}
                      title="তিলাওয়াতের সাথে চলমান আয়াত সবসময় উপরে রাখুন"
                    >
                      {autoFollowAyah ? 'অটো-স্ক্রল চালু' : 'অটো-স্ক্রল বন্ধ'}
                    </button>
                    <span>আরবি সাইজ:</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          arabicFontSize: Math.max(20, settings.arabicFontSize - 2),
                        })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/80 font-bold text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                      aria-label="ফন্ট ছোট করুন"
                    >
                      -
                    </button>
                    <span className="font-mono-num w-6 text-center">
                      {settings.arabicFontSize}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          arabicFontSize: Math.min(42, settings.arabicFontSize + 2),
                        })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/80 font-bold text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                      aria-label="ফন্ট বড় করুন"
                    >
                      +
                    </button>
                  </div>
                </div>

                {readerStyle === 'translation' ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: 'tajweedColorCoding' as const, label: 'তাজবীদ কালার' },
                      { key: 'showArabic' as const, label: 'আরবি' },
                      { key: 'showBengaliTransliteration' as const, label: 'বাংলা উচ্চারণ' },
                      { key: 'showBengaliTranslation' as const, label: 'বাংলা অর্থ' },
                      { key: 'showEnglishTranslation' as const, label: 'English' },
                    ].map((opt) => {
                      const active = settings[opt.key];
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => onUpdateSettings({ [opt.key]: !active })}
                          className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                              : 'border-black/10 bg-white/80 text-[#475A53] hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                      ধারাবাহিক আরবি মুসহাফ মোড — সরাসরি টেনে আরবি পড়ুন, যেকোনো আয়াতে ট্যাপ করলে তিলাওয়াত শুরু হবে
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ tajweedColorCoding: !settings.tajweedColorCoding })
                      }
                      className={`min-h-[34px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        settings.tajweedColorCoding
                          ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                          : 'border-black/10 bg-white/80 text-[#475A53] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9BB0A8]'
                      }`}
                    >
                      তাজবীদ কালার
                    </button>
                  </div>
                )}

                {settings.tajweedColorCoding && (readerStyle === 'arabicOnly' || settings.showArabic) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/8 pt-2 text-[11px] font-semibold dark:border-white/8">
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
            </div>

            {/* Ayahs Reader Feed */}
            <div className="glass-card rounded-3xl p-5 md:p-7">
              {selectedSurahNum !== 9 && selectedSurahNum !== 1 && (
                <div className="mb-6 border-b border-black/8 pb-5 text-center dark:border-white/8">
                  <p dir="rtl" className="font-arabic text-2xl text-[#063D34] dark:text-[#E7C57B]">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                  <p className="mt-1 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    পরম করুণাময় অসীম দয়ালু আল্লাহর নামে শুরু করছি
                  </p>
                </div>
              )}

              {loading ? (
                <div className="space-y-4 py-8">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl bg-black/[0.03] p-6 text-center dark:bg-white/[0.03]">
                  <p className="text-sm font-medium text-[#0F1F1A] dark:text-[#F0F5F3]">{error}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedSurahNum((n) => n)}
                    className="mt-3 rounded-xl bg-[#0D6E52] px-4 py-2 text-xs font-semibold text-white"
                  >
                    আবার চেষ্টা করুন
                  </button>
                </div>
              ) : (
                <SmoothStage stageKey={readerStyle} yOffset={8}>
                {readerStyle === 'arabicOnly' ? (
                /* Pure Continuous Arabic Mushaf Reading View */
                <div
                  dir="rtl"
                  className="font-arabic rounded-2xl border border-[#D4A853]/25 bg-[#FBF7EC]/90 p-5 text-justify text-[#0F1F1A] shadow-inner dark:border-[#E7C57B]/20 dark:bg-[#071612]/90 dark:text-[#F4F7F5] sm:p-7"
                  style={{
                    fontSize: `${settings.arabicFontSize}px`,
                    lineHeight: 2.35,
                  }}
                >
                  {ayahs.map((ayah, idx) => {
                    const trackId = `${selectedSurahNum}:${ayah.numberInSurah}`;
                    const isThisTrack = activeTrackKey === trackId;
                    return (
                      <span
                        key={ayah.numberInSurah}
                        ref={(el) => {
                          if (el) ayahElementRefs.current.set(trackId, el);
                          else ayahElementRefs.current.delete(trackId);
                        }}
                        onClick={() => {
                          if (isThisTrack) onTogglePlay();
                          else handlePlaySurah(idx, false);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isThisTrack) onTogglePlay();
                            else handlePlaySurah(idx, false);
                          }
                        }}
                        className={`scroll-mt-24 inline cursor-pointer rounded-lg px-1 transition-all duration-300 ${
                          isThisTrack
                            ? 'bg-[#0D6E52]/12 text-[#063D34] ring-1 ring-[#0D6E52]/20 dark:bg-[#D4A853]/20 dark:text-[#F6DC9B] dark:ring-[#E7C57B]/25'
                            : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                        }`}
                        title={`আয়াত ${ayah.numberInSurah} শুনতে ট্যাপ করুন`}
                      >
                        <TajweedArabicText
                          plainArabic={ayah.arabic}
                          tajweedArabic={ayah.tajweedArabic}
                          enableTajweed={settings.tajweedColorCoding}
                          as="span"
                        />{' '}
                        <span className="mx-1 inline-block select-none font-normal text-[#0D6E52] dark:text-[#E7C57B]">
                          ﴿{toArabicIndicDigits(ayah.numberInSurah)}﴾
                        </span>{' '}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-black/8 dark:divide-white/8">
                  {ayahs.map((ayah, idx) => {
                    const trackId = `${selectedSurahNum}:${ayah.numberInSurah}`;
                    const isThisTrack = activeTrackKey === trackId;
                    const favEntry = favoriteMap.get(trackId);
                    const isFavorited = Boolean(favEntry);

                    const candidateEntry: FavoriteAyahEntry = favEntry || {
                      key: trackId,
                      surah: selectedSurahNum,
                      ayah: ayah.numberInSurah,
                      surahNameBn: surahMeta.nameBn,
                      arabic: ayah.arabic,
                      tajweedArabic: ayah.tajweedArabic,
                      bengaliTranslit: ayah.bengaliTranslit,
                      bengali: ayah.bengali,
                      english: ayah.english,
                      savedAt: Date.now(),
                    };

                    return (
                      <article
                        key={ayah.numberInSurah}
                        ref={(el) => {
                          if (el) ayahElementRefs.current.set(trackId, el);
                          else ayahElementRefs.current.delete(trackId);
                        }}
                        className={`scroll-mt-20 py-5 transition-all duration-300 ${
                          isThisTrack
                            ? 'rounded-2xl border-l-4 border-l-[#0D6E52] bg-[#0D6E52]/[0.05] px-4 ring-1 ring-[#0D6E52]/12 dark:border-l-[#E7C57B] dark:bg-[#0D6E52]/15 dark:ring-[#E7C57B]/20'
                            : ''
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="font-mono-num inline-flex items-center gap-2 text-xs font-bold text-[#0D6E52] dark:text-[#E7C57B]">
                            {isThisTrack && (
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isPlaying
                                    ? 'animate-pulse bg-[#0D6E52] dark:bg-[#6EE7B7]'
                                    : 'bg-[#D4A853]'
                                }`}
                              />
                            )}
                            <span>
                              আয়াত {selectedSurahNum}:{ayah.numberInSurah}
                            </span>
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setGroupPickerEntry(candidateEntry)}
                              className={`flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-colors ${
                                isFavorited
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'text-[#7A8E86] hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                              aria-label={
                                isFavorited ? 'ফেভারিট গ্রুপ বদলান' : 'ফেভারিট গ্রুপে যোগ করুন'
                              }
                            >
                              <Heart
                                className="h-4 w-4"
                                fill={isFavorited ? 'currentColor' : 'none'}
                              />
                              <span className="hidden sm:inline">
                                {isFavorited ? 'গ্রুপে সেভ' : 'সেভ'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isThisTrack) onTogglePlay();
                                else handlePlaySurah(idx, false);
                              }}
                              className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-colors ${
                                isThisTrack && isPlaying
                                  ? 'bg-[#063D34] text-[#E7C57B]'
                                  : 'text-[#0D6E52] hover:bg-black/5 dark:text-[#34B38A] dark:hover:bg-white/5'
                              }`}
                              aria-label={isThisTrack && isPlaying ? 'বিরতি' : 'আয়াত শুনুন'}
                            >
                              {isThisTrack && isPlaying ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {settings.showArabic && (
                          <TajweedArabicText
                            plainArabic={ayah.arabic}
                            tajweedArabic={ayah.tajweedArabic}
                            enableTajweed={settings.tajweedColorCoding}
                            className="font-arabic text-right text-[#0F1F1A] dark:text-[#F0F5F3]"
                            style={{
                              fontSize: `${settings.arabicFontSize}px`,
                              lineHeight: 2.15,
                            }}
                          />
                        )}

                        {settings.showBengaliTransliteration && ayah.bengaliTranslit && (
                          <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#0D6E52] dark:text-[#6EE7B7]">
                            {ayah.bengaliTranslit}
                          </p>
                        )}

                        {settings.showBengaliTranslation && ayah.bengali && (
                          <p className="mt-2.5 text-base leading-relaxed text-[#475A53] dark:text-[#C2D4CD]">
                            {ayah.bengali}
                          </p>
                        )}

                        {settings.showEnglishTranslation && ayah.english && (
                          <p className="mt-2 text-sm leading-relaxed text-[#5C7068] dark:text-[#9BB0A8]">
                            {ayah.english}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              </SmoothStage>
              )}
            </div>
          </div>
        </div>
      )}
      </SmoothStage>

      {/* MODAL 1: Tap-to-Select Active Favorite Group */}
      {isGroupDropdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-xs sm:items-center"
          onClick={() => setIsGroupDropdownOpen(false)}
        >
          <div
            className="glass-card w-full max-w-md rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/8 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                ফেভারিট গ্রুপ নির্বাচন করুন
              </h3>
              <button
                type="button"
                onClick={() => setIsGroupDropdownOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveGroupId('all');
                  setIsGroupDropdownOpen(false);
                }}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition-colors ${
                  activeGroupId === 'all'
                    ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                    : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                }`}
              >
                <span>সব গ্রুপ ({favoriteAyahs.length})</span>
                {activeGroupId === 'all' && <Check className="h-4 w-4 shrink-0" />}
              </button>

              {favoriteGroups.map((grp) => {
                const selected = activeGroupId === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      setActiveGroupId(grp.id);
                      setIsGroupDropdownOpen(false);
                    }}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition-colors ${
                      selected
                        ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                        : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                    }`}
                  >
                    <span>
                      {grp.name} ({groupCounts[grp.id] || 0})
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create New Favorite Group */}
      {isNewGroupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-xs sm:items-center"
          onClick={() => setIsNewGroupModalOpen(false)}
        >
          <form
            onSubmit={handleCreateGroupSubmit}
            className="glass-card w-full max-w-md rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/8 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                নতুন ফেভারিট গ্রুপ তৈরি করুন
              </h3>
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label
                htmlFor="new-fav-group-name"
                className="block text-xs font-semibold text-[#475A53] dark:text-[#9BB0A8]"
              >
                গ্রুপের নাম লিখুন (যেমন: দোয়ার আয়াত, মুখস্থ, রুকাইয়া, নামাজের সূরা)
              </label>
              <input
                id="new-fav-group-name"
                type="text"
                value={newGroupInput}
                onChange={(e) => setNewGroupInput(e.target.value)}
                placeholder="গ্রুপের নাম..."
                className="min-h-[46px] w-full rounded-xl border border-black/15 bg-white px-3.5 text-sm font-semibold text-[#0F1F1A] focus:border-[#0D6E52] focus:outline-none dark:border-white/15 dark:bg-[#0B1714] dark:text-white"
                autoFocus
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                className="min-h-[42px] rounded-xl border border-black/10 px-4 text-xs font-semibold text-[#475A53] dark:border-white/10 dark:text-[#9BB0A8]"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={!newGroupInput.trim()}
                className="min-h-[42px] rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-5 text-xs font-bold text-[#F6DC9B] disabled:opacity-50"
              >
                তৈরি করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Assign / Toggle Ayah into Named Favorite Group(s) */}
      {groupPickerEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-xs sm:items-center"
          onClick={() => setGroupPickerEntry(null)}
        >
          <div
            className="glass-card w-full max-w-md rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/8 pb-3 dark:border-white/10">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                  ফেভারিট গ্রুপে সংরক্ষণ করুন
                </h3>
                <p className="truncate text-xs text-[#475A53] dark:text-[#9BB0A8]">
                  সূরা {groupPickerEntry.surahNameBn} · আয়াত {groupPickerEntry.surah}:
                  {groupPickerEntry.ayah}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGroupPickerEntry(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
              {favoriteGroups.map((grp) => {
                const liveEntry = favoriteMap.get(groupPickerEntry.key);
                const checked = liveEntry
                  ? getEntryGroupIds(liveEntry).includes(grp.id)
                  : false;

                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleToggleGroupMembership(groupPickerEntry, grp.id)}
                    className={`flex min-h-[46px] w-full items-center justify-between rounded-2xl border px-3.5 text-left text-xs font-bold transition-colors ${
                      checked
                        ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34] dark:border-[#E7C57B]/60 dark:bg-[#063D34]/75 dark:text-[#F6DC9B]'
                        : 'border-black/8 bg-black/[0.025] text-[#0F1F1A] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                    }`}
                  >
                    <span>
                      {grp.name} ({groupCounts[grp.id] || 0})
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        checked
                          ? 'border-[#0D6E52] bg-[#0D6E52] text-white dark:border-[#E7C57B] dark:bg-[#E7C57B] dark:text-[#041D18]'
                          : 'border-black/20 dark:border-white/25'
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Inline quick create new group + save */}
            <form
              onSubmit={handleCreateAndAssignInPicker}
              className="mt-4 flex items-center gap-2 border-t border-black/8 pt-3 dark:border-white/10"
            >
              <input
                type="text"
                value={pickerInlineNewGroup}
                onChange={(e) => setPickerInlineNewGroup(e.target.value)}
                placeholder="নতুন গ্রুপের নাম লিখে সেভ করুন..."
                className="min-h-[40px] flex-1 rounded-xl border border-black/15 bg-white px-3 text-xs font-semibold text-[#0F1F1A] focus:outline-none dark:border-white/15 dark:bg-[#0B1714] dark:text-white"
              />
              <button
                type="submit"
                disabled={!pickerInlineNewGroup.trim()}
                className="min-h-[40px] shrink-0 rounded-xl bg-[#0D6E52] px-3.5 text-xs font-bold text-white disabled:opacity-50"
              >
                + তৈরি ও সেভ
              </button>
            </form>

            <div className="mt-3 flex items-center justify-between gap-2">
              {favoriteMap.has(groupPickerEntry.key) ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveFavoriteAyah(groupPickerEntry.key);
                    setGroupPickerEntry(null);
                  }}
                  className="min-h-[38px] rounded-xl px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                >
                  ফেভারিট থেকে সরান
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setGroupPickerEntry(null)}
                className="min-h-[40px] rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-5 text-xs font-bold text-[#F6DC9B]"
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
