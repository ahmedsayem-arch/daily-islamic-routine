import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Headphones,
  Loader2,
  Maximize2,
  Mic,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Volume2,
} from 'lucide-react';
import {
  AMOL_LANTERN_IMG,
  AZKAR_LIST,
  buildEveryAyahUrl,
  MANZIL_33_AYAT_REFS,
  QARI_RECITERS,
  RUQYAH_NATURE_IMG,
  RUQYAH_PROGRAMS,
} from '../data/islamicData';
import { buildPlaylistFromRefs } from '../services/islamicApi';
import type {
  AppSettings,
  AudioStatus,
  AudioTrackItem,
  AyahRef,
  AzkarEntry,
  QariReciter,
  RuqyahProgram,
} from '../types/islamic';
import {
  countCachedAudioUrls,
  downloadAudioUrlsForOffline,
  prewarmUpcomingAudioUrls,
} from '../utils/offlineAudioCache';
import { TAJWEED_COLOR_CLASSES, TAJWEED_LEGEND } from '../utils/quranFormatting';
import { speechPlayer, useSpeechPlayer } from '../utils/speechPlayer';
import { SmoothStage } from './SmoothTransition';
import { TajweedArabicText } from './TajweedArabicText';
import { VoiceSelectorSection } from './VoiceSelectorSection';

interface RuqyahAmolViewProps {
  selectedQari: QariReciter;
  audioStatus: AudioStatus;
  activeTrackKey?: string | null;
  activeTrackTitle?: string;
  isPlaying: boolean;
  settings: AppSettings;
  routeIntent?: {
    subTab: 'ruqyah' | 'manzil' | 'azkar';
    azkarFilter: 'all' | 'morning' | 'evening';
    ruqyahId?: string | null;
    manzilOpen?: boolean;
    manzilGroup?: number | 'all';
    azkarId?: string | null;
    seq: number;
  } | null;
  onChangeQari: (qari: QariReciter) => void;
  onUpdateSettings?: (patch: Partial<AppSettings>) => void;
  onPlayPlaylist: (tracks: AudioTrackItem[], startIndex: number, openVisual?: boolean) => void;
  onTogglePlay: () => void;
  onReaderStateChange?: (state: {
    subTab: 'ruqyah' | 'manzil' | 'azkar';
    selectedRuqyahId: string | null;
    manzilReaderOpen: boolean;
    manzilGroupFilter: number | 'all';
    hisnulChapter: string | null;
    selectedAzkarId: string | null;
  }) => void;
}

type SubTab = 'ruqyah' | 'manzil' | 'azkar';
type RuqyahCat = 'all' | RuqyahProgram['category'];
type HisnulChapterId = 'morning' | 'evening' | 'sleep' | 'prayer' | 'daily' | 'all';

interface HisnulChapterMeta {
  id: HisnulChapterId;
  number: number;
  titleBn: string;
  subtitleBn: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndicDigits(num: number): string {
  return String(num)
    .split('')
    .map((ch) => ARABIC_INDIC_DIGITS[Number(ch)] ?? ch)
    .join('');
}

const HISNUL_CHAPTERS: HisnulChapterMeta[] = [
  {
    id: 'morning',
    number: 1,
    titleBn: 'সকালের মাসনুন আমল',
    subtitleBn: 'ফজরের পর সুরক্ষা, শোকরিয়া, সাইয়্যিদুল ইস্তিগফার ও সকালের তাসবিহ',
    Icon: Sun,
  },
  {
    id: 'evening',
    number: 2,
    titleBn: 'সন্ধ্যার মাসনুন আমল',
    subtitleBn: 'আসর-মাগরিবের পর রাত্রিকালীন নিরাপত্তা, প্রশান্তি ও তাওহীদের যিকির',
    Icon: Moon,
  },
  {
    id: 'sleep',
    number: 3,
    titleBn: 'ঘুম ও জাগ্রত হওয়ার দুআ',
    subtitleBn: 'ঘুমানোর আগের তাসবিহ, সূরা বাকারার শেষ ২ আয়াত ও জাগ্রত হওয়ার দুআ',
    Icon: Sparkles,
  },
  {
    id: 'prayer',
    number: 4,
    titleBn: 'নামাজ ও মসজিদের দুআ',
    subtitleBn: 'মসজিদে প্রবেশ ও বের হওয়া এবং সালাম ফিরানোর পরের মাসনুন যিকির',
    Icon: BookOpen,
  },
  {
    id: 'daily',
    number: 5,
    titleBn: 'গৃহ, সফর ও দৈনন্দিন দুআ',
    subtitleBn: 'ঘর থেকে বের হওয়া-প্রবেশ, ওয়াশরুম, খাবার ও যানবাহন-সফরের দুআ',
    Icon: Compass,
  },
  {
    id: 'all',
    number: 6,
    titleBn: 'সম্পূর্ণ হিসনুল মুসলিম সূচী',
    subtitleBn: 'সকল অধ্যায়ের সবগুলো প্রামাণিক দুআ ও যিকির একসাথে দেখুন ও শুনুন',
    Icon: BookMarked,
  },
];

function matchesHisnulChapter(entry: AzkarEntry, chapter: HisnulChapterId): boolean {
  if (chapter === 'all') return true;
  if (chapter === 'morning') return entry.category === 'morning' || entry.category === 'both';
  if (chapter === 'evening') return entry.category === 'evening' || entry.category === 'both';
  return entry.category === chapter;
}

function getCategoryLabelBn(cat: AzkarEntry['category']): string {
  switch (cat) {
    case 'morning':
      return 'সকালের বিশেষ';
    case 'evening':
      return 'সন্ধ্যার বিশেষ';
    case 'both':
      return 'সকাল ও সন্ধ্যা';
    case 'sleep':
      return 'ঘুম ও জাগ্রত';
    case 'prayer':
      return 'নামাজ ও মসজিদ';
    case 'daily':
      return 'দৈনন্দিন ও সফর';
  }
}

const RUQYAH_CATEGORY_FILTERS: Array<{ id: RuqyahCat; label: string }> = [
  { id: 'all', label: 'সব রুকাইয়া (১০)' },
  { id: 'shariah', label: 'সম্পূর্ণ ও সিহর' },
  { id: 'manzil', label: '৩৩ আয়াত ও বাকারা' },
  { id: 'nazar', label: 'বদ-নজর ও পরিবার' },
  { id: 'sakina', label: 'সাকীনা ও প্রশান্তি' },
  { id: 'shifa', label: 'আয়াতে শিফা' },
];

function getAudioStatusSummary(status: AudioStatus, title?: string): string {
  switch (status) {
    case 'loading':
      return title ? `লোড হচ্ছে: ${title}` : 'অডিও স্ট্রিম সংযোগ হচ্ছে...';
    case 'playing':
      return title ? `এখন চলছে: ${title}` : 'রুকাইয়া তিলাওয়াত চলছে';
    case 'paused':
      return title ? `বিরতিতে: ${title}` : 'অডিও বিরতিতে আছে';
    case 'error':
      return 'অডিও সংযোগে সাময়িক ত্রুটি — পুনরায় চেষ্টা করুন';
    default:
      return 'সকল রুকাইয়া অডিও স্ট্রিম প্রস্তুত';
  }
}

export const RuqyahAmolView: React.FC<RuqyahAmolViewProps> = ({
  selectedQari,
  audioStatus,
  activeTrackKey = null,
  activeTrackTitle,
  isPlaying,
  settings,
  routeIntent = null,
  onChangeQari,
  onUpdateSettings,
  onPlayPlaylist,
  onTogglePlay,
  onReaderStateChange,
}) => {
  const [subTab, setSubTab] = useState<SubTab>(routeIntent?.subTab || 'ruqyah');
  const [ruqyahCat, setRuqyahCat] = useState<RuqyahCat>('all');
  const [ruqyahQuery, setRuqyahQuery] = useState('');

  // Quran-style Reader state for Ruqyah Compilations
  const [selectedRuqyahId, setSelectedRuqyahId] = useState<string | null>(
    routeIntent?.subTab === 'ruqyah' ? (routeIntent.ruqyahId ?? null) : null
  );
  const [activePlayingRuqyahId, setActivePlayingRuqyahId] = useState<string | null>(null);
  const [ruqyahTracks, setRuqyahTracks] = useState<AudioTrackItem[]>([]);
  const [ruqyahLoading, setRuqyahLoading] = useState(false);
  const [ruqyahReaderStyle, setRuqyahReaderStyle] = useState<'translation' | 'arabicOnly'>(
    'translation'
  );

  // Quran-style Reader state for 33 Ayat (Manzil)
  const [manzilReaderOpen, setManzilReaderOpen] = useState<boolean>(
    routeIntent?.subTab === 'manzil' ? Boolean(routeIntent.manzilOpen) : false
  );
  const [manzilGroupFilter, setManzilGroupFilter] = useState<number | 'all'>(
    routeIntent?.subTab === 'manzil' && routeIntent.manzilGroup !== undefined
      ? routeIntent.manzilGroup
      : 'all'
  );
  const [manzilTracks, setManzilTracks] = useState<AudioTrackItem[]>([]);
  const [manzilLoading, setManzilLoading] = useState(false);
  const [manzilReaderStyle, setManzilReaderStyle] = useState<'translation' | 'arabicOnly'>(
    'translation'
  );

  // Hisnul Muslim hierarchical state (Chapter Directory -> Dua List -> Dua Reader)
  const [hisnulChapter, setHisnulChapter] = useState<HisnulChapterId | null>(
    routeIntent?.subTab === 'azkar' ? routeIntent.azkarFilter : null
  );
  const [selectedAzkarId, setSelectedAzkarId] = useState<string | null>(
    routeIntent?.subTab === 'azkar' ? (routeIntent.azkarId ?? null) : null
  );
  const [azkarQuery, setAzkarQuery] = useState('');
  const [showAzkarVoicePanel, setShowAzkarVoicePanel] = useState(false);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [amolImgFailed, setAmolImgFailed] = useState(false);
  const [autoFollowAyah, setAutoFollowAyah] = useState(true);
  const ayahElementRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pendingRuqyahPlayIdRef = useRef<string | null>(null);
  const pendingManzilPlayRef = useRef<boolean>(false);

  const [offlineSaving, setOfflineSaving] = useState<{
    id: string;
    done: number;
    total: number;
  } | null>(null);
  const [offlineSavedIds, setOfflineSavedIds] = useState<string[]>([]);
  const [readerOfflineCount, setReaderOfflineCount] = useState(0);
  const speechSnap = useSpeechPlayer();

  useEffect(() => {
    if (!routeIntent) return;
    setSubTab(routeIntent.subTab);
    if (routeIntent.subTab === 'ruqyah' && routeIntent.ruqyahId !== undefined) {
      setSelectedRuqyahId(routeIntent.ruqyahId);
    }
    if (routeIntent.subTab === 'manzil') {
      if (routeIntent.manzilGroup !== undefined) {
        setManzilGroupFilter(routeIntent.manzilGroup);
      }
      if (routeIntent.manzilOpen !== undefined) {
        setManzilReaderOpen(routeIntent.manzilOpen);
      }
    }
    if (routeIntent.subTab === 'azkar') {
      setHisnulChapter(routeIntent.azkarFilter);
      setSelectedAzkarId(routeIntent.azkarId ?? null);
      setAzkarQuery('');
    }
  }, [routeIntent]);

  useEffect(() => {
    onReaderStateChange?.({
      subTab,
      selectedRuqyahId,
      manzilReaderOpen,
      manzilGroupFilter,
      hisnulChapter,
      selectedAzkarId,
    });
  }, [
    subTab,
    selectedRuqyahId,
    manzilReaderOpen,
    manzilGroupFilter,
    hisnulChapter,
    selectedAzkarId,
    onReaderStateChange,
  ]);

  const getLocalTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const [azkarCounts, setAzkarCounts] = useState<Record<string, number>>(() => {
    try {
      const d = new Date();
      const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const raw = localStorage.getItem(`noor_azkar_${todayKey}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const incrementAzkar = (id: string, maxTarget: number) => {
    setAzkarCounts((prev) => {
      const current = prev[id] || 0;
      const nextCount = current >= maxTarget ? maxTarget : current + 1;
      const next = { ...prev, [id]: nextCount };
      try {
        localStorage.setItem(`noor_azkar_${getLocalTodayKey()}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetAzkarItem = (id: string) => {
    setAzkarCounts((prev) => {
      const next = { ...prev, [id]: 0 };
      try {
        localStorage.setItem(`noor_azkar_${getLocalTodayKey()}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetAllAzkar = () => {
    setAzkarCounts({});
    try {
      localStorage.setItem(`noor_azkar_${getLocalTodayKey()}`, JSON.stringify({}));
    } catch {
      // ignore
    }
  };

  const scrollTopSmooth = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const selectedRuqyahIndex = useMemo(() => {
    if (!selectedRuqyahId) return -1;
    return RUQYAH_PROGRAMS.findIndex((p) => p.id === selectedRuqyahId);
  }, [selectedRuqyahId]);

  const activeRuqyahProgram =
    selectedRuqyahIndex >= 0 ? RUQYAH_PROGRAMS[selectedRuqyahIndex] : null;

  // Load Quran-style verses whenever a Ruqyah compilation is opened
  useEffect(() => {
    if (!activeRuqyahProgram) {
      setRuqyahTracks([]);
      return;
    }
    let active = true;
    setRuqyahLoading(true);
    buildPlaylistFromRefs(
      activeRuqyahProgram.verses,
      selectedQari,
      activeRuqyahProgram.titleBn
    )
      .then((tracks) => {
        if (!active) return;
        setRuqyahTracks(tracks);
        setRuqyahLoading(false);
        if (
          pendingRuqyahPlayIdRef.current === activeRuqyahProgram.id &&
          tracks.length > 0
        ) {
          pendingRuqyahPlayIdRef.current = null;
          setActivePlayingRuqyahId(activeRuqyahProgram.id);
          onPlayPlaylist(tracks, 0, false);
        }
      })
      .catch(() => {
        if (active) {
          pendingRuqyahPlayIdRef.current = null;
          setRuqyahLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [activeRuqyahProgram, selectedQari, onPlayPlaylist]);

  const groupedManzil = useMemo(
    () =>
      MANZIL_33_AYAT_REFS.reduce<
        Array<{ surah: number; nameBn: string; ayahs: number[] }>
      >((acc, ref) => {
        const last = acc[acc.length - 1];
        if (last && last.surah === ref.surah) {
          last.ayahs.push(ref.ayah);
        } else {
          acc.push({ surah: ref.surah, nameBn: ref.surahNameBn, ayahs: [ref.ayah] });
        }
        return acc;
      }, []),
    []
  );

  const activeManzilRefs = useMemo(() => {
    if (manzilGroupFilter === 'all') return MANZIL_33_AYAT_REFS;
    const grp = groupedManzil[manzilGroupFilter];
    if (!grp) return MANZIL_33_AYAT_REFS;
    return grp.ayahs.map((a) => ({
      surah: grp.surah,
      ayah: a,
      surahNameBn: grp.nameBn,
    }));
  }, [manzilGroupFilter, groupedManzil]);

  // Load Quran-style verses for 33 Ayat (Manzil) when Reader is open
  useEffect(() => {
    if (!manzilReaderOpen) return;
    let active = true;
    setManzilLoading(true);
    const titleLabel =
      manzilGroupFilter === 'all'
        ? '৩৩ আয়াত (মঞ্জিল)'
        : groupedManzil[manzilGroupFilter]?.nameBn || '৩৩ আয়াত (মঞ্জিল)';
    buildPlaylistFromRefs(activeManzilRefs, selectedQari, titleLabel)
      .then((tracks) => {
        if (!active) return;
        setManzilTracks(tracks);
        setManzilLoading(false);
        if (pendingManzilPlayRef.current && tracks.length > 0) {
          pendingManzilPlayRef.current = false;
          onPlayPlaylist(tracks, 0, false);
        }
      })
      .catch(() => {
        if (active) {
          pendingManzilPlayRef.current = false;
          setManzilLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [
    manzilReaderOpen,
    manzilGroupFilter,
    activeManzilRefs,
    groupedManzil,
    selectedQari,
    onPlayPlaylist,
  ]);

  // Count cached offline audio tracks for the open Quran-style reader
  useEffect(() => {
    const tracksToCheck =
      subTab === 'ruqyah' && activeRuqyahProgram
        ? ruqyahTracks
        : subTab === 'manzil' && manzilReaderOpen
        ? manzilTracks
        : [];
    if (tracksToCheck.length === 0) {
      setReaderOfflineCount(0);
      return;
    }
    let active = true;
    countCachedAudioUrls(tracksToCheck.map((t) => t.audioUrl)).then((cnt) => {
      if (active) {
        setReaderOfflineCount(cnt);
        if (cnt > 0) {
          prewarmUpcomingAudioUrls(tracksToCheck.slice(0, 3).map((t) => t.audioUrl));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [subTab, activeRuqyahProgram, ruqyahTracks, manzilReaderOpen, manzilTracks]);

  // Smoothly auto-scroll active Ayah cleanly to the top inside Quran-style Ruqyah / Manzil reader
  useEffect(() => {
    if (!autoFollowAyah || !activeTrackKey || ruqyahLoading || manzilLoading) return;
    const el = ayahElementRefs.current.get(activeTrackKey);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [
    activeTrackKey,
    autoFollowAyah,
    ruqyahTracks.length,
    manzilTracks.length,
    ruqyahLoading,
    manzilLoading,
    ruqyahReaderStyle,
    manzilReaderStyle,
  ]);

  const handleOpenRuqyahReader = (programId: string) => {
    setSelectedRuqyahId(programId);
    scrollTopSmooth();
  };

  const handleOpenAndPlayRuqyah = (program: RuqyahProgram) => {
    if (
      activeRuqyahProgram?.id === program.id &&
      ruqyahTracks.length > 0 &&
      !ruqyahLoading
    ) {
      setActivePlayingRuqyahId(program.id);
      onPlayPlaylist(ruqyahTracks, 0, false);
      scrollTopSmooth();
      return;
    }
    pendingRuqyahPlayIdRef.current = program.id;
    setSelectedRuqyahId(program.id);
    scrollTopSmooth();
  };

  const handleOpenManzilReader = (groupIndex: number | 'all' = 'all') => {
    setManzilGroupFilter(groupIndex);
    setManzilReaderOpen(true);
    scrollTopSmooth();
  };

  const handleOpenAndPlayManzil = (groupIndex: number | 'all' = 'all') => {
    if (
      manzilReaderOpen &&
      manzilGroupFilter === groupIndex &&
      manzilTracks.length > 0 &&
      !manzilLoading
    ) {
      onPlayPlaylist(manzilTracks, 0, false);
      scrollTopSmooth();
      return;
    }
    pendingManzilPlayRef.current = true;
    setManzilGroupFilter(groupIndex);
    setManzilReaderOpen(true);
    scrollTopSmooth();
  };

  const handlePlayRefs = async (
    id: string,
    titleBn: string,
    refs: AyahRef[],
    openVisual: boolean
  ) => {
    setLoadingId(id);
    try {
      const tracks = await buildPlaylistFromRefs(refs, selectedQari, titleBn);
      onPlayPlaylist(tracks, 0, openVisual);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSaveOfflineRefs = async (id: string, refs: AyahRef[]) => {
    if (offlineSaving) return;
    const urls = refs.map((r) =>
      buildEveryAyahUrl(selectedQari.everyAyahFolder, r.surah, r.ayah)
    );
    setOfflineSaving({ id, done: 0, total: urls.length });
    try {
      await buildPlaylistFromRefs(refs, selectedQari, id);
      await downloadAudioUrlsForOffline(urls, (done, total) => {
        setOfflineSaving({ id, done, total });
      });
      setOfflineSavedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      const cnt = await countCachedAudioUrls(urls);
      setReaderOfflineCount(cnt);
    } finally {
      setOfflineSaving(null);
    }
  };

  const filteredPrograms = useMemo(() => {
    const byCat =
      ruqyahCat === 'all'
        ? RUQYAH_PROGRAMS
        : RUQYAH_PROGRAMS.filter((p) => p.category === ruqyahCat);
    const q = ruqyahQuery.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (p) =>
        p.titleBn.toLowerCase().includes(q) ||
        p.subtitleBn.toLowerCase().includes(q) ||
        p.purposeBn.toLowerCase().includes(q)
    );
  }, [ruqyahCat, ruqyahQuery]);

  const chapterAzkarList = useMemo(() => {
    if (!hisnulChapter) return AZKAR_LIST;
    return AZKAR_LIST.filter((a) => matchesHisnulChapter(a, hisnulChapter));
  }, [hisnulChapter]);

  const filteredAzkar = useMemo(() => {
    const base = chapterAzkarList;
    const q = azkarQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (a) =>
        a.titleBn.toLowerCase().includes(q) ||
        a.meaningBn.toLowerCase().includes(q) ||
        a.transliterationBn.toLowerCase().includes(q) ||
        a.reference.toLowerCase().includes(q)
    );
  }, [chapterAzkarList, azkarQuery]);

  const activeHisnulChapterMeta = useMemo(
    () => HISNUL_CHAPTERS.find((c) => c.id === hisnulChapter) || null,
    [hisnulChapter]
  );

  const selectedAzkarIndex = useMemo(() => {
    if (!selectedAzkarId) return -1;
    return chapterAzkarList.findIndex((a) => a.id === selectedAzkarId);
  }, [chapterAzkarList, selectedAzkarId]);

  const activeAzkarItem =
    selectedAzkarIndex >= 0 ? chapterAzkarList[selectedAzkarIndex] : null;

  const totalAzkarDoneAll = useMemo(
    () => AZKAR_LIST.filter((a) => (azkarCounts[a.id] || 0) >= a.repeatTarget).length,
    [azkarCounts]
  );

  const chapterAzkarDoneCount = useMemo(
    () =>
      chapterAzkarList.filter((a) => (azkarCounts[a.id] || 0) >= a.repeatTarget).length,
    [chapterAzkarList, azkarCounts]
  );

  const audioStatusText = getAudioStatusSummary(audioStatus, activeTrackTitle);

  const handleOpenHisnulChapter = (chapterId: HisnulChapterId) => {
    setHisnulChapter(chapterId);
    setSelectedAzkarId(null);
    setAzkarQuery('');
    scrollTopSmooth();
  };

  const handleOpenAzkarReader = (azkarId: string, fallbackChapter?: HisnulChapterId) => {
    if (!hisnulChapter && fallbackChapter) {
      setHisnulChapter(fallbackChapter);
    }
    setSelectedAzkarId(azkarId);
    scrollTopSmooth();
  };

  const handlePlayAzkarAudio = (azkar: AzkarEntry) => {
    if (azkar.audioRefs) {
      handlePlayRefs(
        `azkar-${azkar.id}`,
        azkar.titleBn,
        azkar.audioRefs.map((r) => ({
          surah: r.surah,
          ayah: r.ayah,
          surahNameBn: azkar.titleBn,
        })),
        false
      );
      return;
    }

    const speechId = `azkar-speech-${azkar.id}`;
    if (speechSnap.currentTrack?.id === speechId && speechSnap.status !== 'idle') {
      speechPlayer.togglePlayPause();
    } else {
      speechPlayer.playQueue(
        [
          {
            id: speechId,
            titleBn: azkar.titleBn,
            subtitleBn: azkar.reference,
            segments: [
              { text: azkar.arabic, lang: 'ar-SA' },
              { text: `${azkar.titleBn}। ${azkar.meaningBn}`, lang: 'bn-BD' },
            ],
          },
        ],
        0
      );
    }
  };

  const handlePlayAzkarChapterQueue = (list: AzkarEntry[]) => {
    const tracks = list.map((a) => ({
      id: `azkar-speech-${a.id}`,
      titleBn: a.titleBn,
      subtitleBn: a.reference,
      segments: [
        { text: a.arabic, lang: 'ar-SA' as const },
        { text: `${a.titleBn}। ${a.meaningBn}`, lang: 'bn-BD' as const },
      ],
    }));
    if (tracks.length > 0) {
      speechPlayer.playQueue(tracks, 0);
    }
  };

  /**
   * Shared Quran-Style Verse Reader Renderer for both Ruqyah Compilations and 33 Ayat (Manzil).
   */
  const renderQuranStyleVersesReader = ({
    tracks,
    loading,
    readerStyle,
    onChangeReaderStyle,
    offlineKey,
    refs,
    titleBn,
    subtitleBn,
    metaBadgeBn,
  }: {
    tracks: AudioTrackItem[];
    loading: boolean;
    readerStyle: 'translation' | 'arabicOnly';
    onChangeReaderStyle: (style: 'translation' | 'arabicOnly') => void;
    offlineKey: string;
    refs: AyahRef[];
    titleBn: string;
    subtitleBn: string;
    metaBadgeBn: string;
  }) => {
    const isAllOffline = tracks.length > 0 && readerOfflineCount >= tracks.length;
    const isSavingThis = offlineSaving?.id === offlineKey;

    return (
      <div className="space-y-5">
        {/* Royal Emerald Quran-Style Reader Header */}
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="relative grid grid-cols-1 items-stretch overflow-hidden bg-[#063D34] bg-gradient-to-br from-[#063D34] via-[#052D26] to-[#031B17] text-white md:grid-cols-12">
            <div
              className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col justify-between p-6 md:col-span-8">
              <div>
                <p className="text-xs font-medium text-[#E7C57B]">{metaBadgeBn}</p>
                <h2 className="mt-1.5 text-2xl font-bold text-white md:text-3xl">
                  {titleBn}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#C6DCD5]">{subtitleBn}</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (tracks.length === 0) return;
                    if (subTab === 'ruqyah' && activeRuqyahProgram) {
                      setActivePlayingRuqyahId(activeRuqyahProgram.id);
                    }
                    onPlayPlaylist(tracks, 0, false);
                  }}
                  disabled={loading || tracks.length === 0}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#C2923B] px-4 py-2 text-xs font-bold text-[#041D18] shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Volume2 className="h-4 w-4" />
                  <span className="whitespace-nowrap">সম্পূর্ণ তিলাওয়াত শুনুন</span>
                </button>

                <button
                  type="button"
                  onClick={() => tracks.length > 0 && onPlayPlaylist(tracks, 0, true)}
                  disabled={loading || tracks.length === 0}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
                >
                  <Maximize2 className="h-4 w-4 text-[#E7C57B]" />
                  <span className="whitespace-nowrap">ভিজ্যুয়াল মোড</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveOfflineRefs(offlineKey, refs)}
                  disabled={loading || tracks.length === 0 || Boolean(offlineSaving)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    isAllOffline || offlineSavedIds.includes(offlineKey)
                      ? 'border-[#6EE7B7]/50 bg-[#0D6E52]/60 text-[#E8FFF6]'
                      : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isSavingThis && offlineSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#F6DC9B]" />
                      <span className="font-mono-num whitespace-nowrap">
                        সেভ হচ্ছে {offlineSaving.done}/{offlineSaving.total}
                      </span>
                    </>
                  ) : isAllOffline || offlineSavedIds.includes(offlineKey) ? (
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

            <div className="relative hidden min-h-[180px] md:col-span-4 md:block">
              {!imgFailed ? (
                <img
                  src={RUQYAH_NATURE_IMG}
                  alt={titleBn}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover opacity-80"
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
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-black/8 pb-3 dark:border-white/8">
              <div className="inline-flex rounded-xl border border-black/10 bg-white/80 p-1 dark:border-white/15 dark:bg-black/30">
                <button
                  type="button"
                  onClick={() => onChangeReaderStyle('translation')}
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
                  onClick={() => onChangeReaderStyle('arabicOnly')}
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
                {onUpdateSettings && (
                  <>
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
                    <span className="font-mono-num w-6 text-center">{settings.arabicFontSize}</span>
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
                  </>
                )}
              </div>
            </div>

            {onUpdateSettings &&
              (readerStyle === 'translation' ? (
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
              ))}

            {settings.tajweedColorCoding && (readerStyle === 'arabicOnly' || settings.showArabic) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/8 pt-2 text-[11px] font-semibold dark:border-white/8">
                {TAJWEED_LEGEND.map((item) => (
                  <span key={item.category} className={TAJWEED_COLOR_CLASSES[item.category]}>
                    ● {item.labelBn}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ayahs Reader Feed */}
        <div className="glass-card rounded-3xl p-5 md:p-7">
          {loading ? (
            <div className="space-y-4 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]"
                />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="rounded-2xl bg-black/[0.03] p-8 text-center dark:bg-white/[0.03]">
              <BookOpen className="mx-auto h-8 w-8 text-[#7A8E86]" />
              <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                আয়াতগুলো লোড করা যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন।
              </p>
            </div>
          ) : (
            <SmoothStage stageKey={readerStyle} yOffset={8}>
              {readerStyle === 'arabicOnly' ? (
                /* Continuous Pure Arabic Mushaf Reading View */
                <div
                  dir="rtl"
                  className="font-arabic rounded-2xl border border-[#D4A853]/25 bg-[#FBF7EC]/90 p-5 text-justify text-[#0F1F1A] shadow-inner dark:border-[#E7C57B]/20 dark:bg-[#071612]/90 dark:text-[#F4F7F5] sm:p-7"
                  style={{
                    fontSize: `${settings.arabicFontSize}px`,
                    lineHeight: 2.35,
                  }}
                >
                  {tracks.map((tr, idx) => {
                    const pairKey = `${tr.surah}:${tr.ayah}`;
                    const isThisTrack = activeTrackKey === pairKey;
                    const prevSurah = idx > 0 ? tracks[idx - 1].surah : null;
                    const showSurahMarker = prevSurah !== tr.surah;

                    return (
                      <React.Fragment key={tr.id}>
                        {showSurahMarker && (
                          <div
                            dir="ltr"
                            className="my-3 block rounded-xl border border-[#D4A853]/30 bg-[#063D34]/90 px-3 py-1.5 text-center font-sans text-xs font-bold text-[#F6DC9B] first:mt-0"
                          >
                            {tr.titleBn.split('·')[0].trim()}
                          </div>
                        )}
                        <span
                          ref={(el) => {
                            if (el) ayahElementRefs.current.set(pairKey, el);
                            else ayahElementRefs.current.delete(pairKey);
                          }}
                          onClick={() => {
                            if (isThisTrack) onTogglePlay();
                            else onPlayPlaylist(tracks, idx, false);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (isThisTrack) onTogglePlay();
                              else onPlayPlaylist(tracks, idx, false);
                            }
                          }}
                          className={`scroll-mt-24 inline cursor-pointer rounded-lg px-1 transition-all duration-300 ${
                            isThisTrack
                              ? 'bg-[#0D6E52]/12 text-[#063D34] ring-1 ring-[#0D6E52]/20 dark:bg-[#D4A853]/20 dark:text-[#F6DC9B] dark:ring-[#E7C57B]/25'
                              : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                          }`}
                          title={`${tr.titleBn} শুনতে ট্যাপ করুন`}
                        >
                          <TajweedArabicText
                            plainArabic={tr.arabic || ''}
                            tajweedArabic={tr.tajweedArabic}
                            enableTajweed={settings.tajweedColorCoding}
                            as="span"
                          />{' '}
                          <span className="mx-1 inline-block select-none font-normal text-[#0D6E52] dark:text-[#E7C57B]">
                            ﴿{toArabicIndicDigits(tr.ayah)}﴾
                          </span>{' '}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                /* Ayah-by-Ayah Translation + Tajweed Quran Reader */
                <div className="divide-y divide-black/8 dark:divide-white/8">
                  {tracks.map((tr, idx) => {
                    const pairKey = `${tr.surah}:${tr.ayah}`;
                    const isThisTrack = activeTrackKey === pairKey;
                    const prevSurah = idx > 0 ? tracks[idx - 1].surah : null;
                    const showSurahBanner = prevSurah !== tr.surah;

                    return (
                      <div key={tr.id}>
                        {showSurahBanner && (
                          <div className="my-4 flex items-center justify-between rounded-2xl border border-[#0D6E52]/18 bg-[#0D6E52]/[0.06] px-4 py-2.5 first:mt-0 dark:border-[#E7C57B]/20 dark:bg-[#063D34]/45">
                            <span className="text-xs font-bold text-[#063D34] dark:text-[#F6DC9B]">
                              {tr.titleBn.split('·')[0].trim()}
                            </span>
                            <span className="font-mono-num text-[11px] font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
                              সূরা {tr.surah}
                            </span>
                          </div>
                        )}

                        <article
                          ref={(el) => {
                            if (el) ayahElementRefs.current.set(pairKey, el);
                            else ayahElementRefs.current.delete(pairKey);
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
                                {tr.titleBn} ({tr.surah}:{tr.ayah})
                              </span>
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (isThisTrack) onTogglePlay();
                                else onPlayPlaylist(tracks, idx, false);
                              }}
                              className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
                                isThisTrack && isPlaying
                                  ? 'bg-[#063D34] text-[#E7C57B]'
                                  : 'bg-[#0D6E52]/10 text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]'
                              }`}
                              aria-label={isThisTrack && isPlaying ? 'বিরতি' : 'আয়াত শুনুন'}
                            >
                              {isThisTrack && isPlaying ? (
                                <>
                                  <Pause className="h-3.5 w-3.5" />
                                  <span>বিরতি</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  <span>শুনুন</span>
                                </>
                              )}
                            </button>
                          </div>

                          {settings.showArabic && tr.arabic && (
                            <TajweedArabicText
                              plainArabic={tr.arabic}
                              tajweedArabic={tr.tajweedArabic}
                              enableTajweed={settings.tajweedColorCoding}
                              className="font-arabic text-right text-[#0F1F1A] dark:text-[#F0F5F3]"
                              style={{
                                fontSize: `${settings.arabicFontSize}px`,
                                lineHeight: 2.15,
                              }}
                            />
                          )}

                          {settings.showBengaliTransliteration && tr.bengaliTranslit && (
                            <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#0D6E52] dark:text-[#6EE7B7]">
                              {tr.bengaliTranslit}
                            </p>
                          )}

                          {settings.showBengaliTranslation && tr.meaningBn && (
                            <p className="mt-2.5 text-base leading-relaxed text-[#475A53] dark:text-[#C2D4CD]">
                              {tr.meaningBn}
                            </p>
                          )}

                          {settings.showEnglishTranslation && tr.englishMeaning && (
                            <p className="mt-2 text-sm leading-relaxed text-[#5C7068] dark:text-[#9BB0A8]">
                              {tr.englishMeaning}
                            </p>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
            </SmoothStage>
          )}
        </div>
      </div>
    );
  };

  const innerStageKey =
    subTab === 'ruqyah'
      ? activeRuqyahProgram
        ? `ruqyah-reader-${activeRuqyahProgram.id}`
        : 'ruqyah-directory'
      : subTab === 'manzil'
      ? manzilReaderOpen
        ? `manzil-reader-${manzilGroupFilter}`
        : 'manzil-directory'
      : !hisnulChapter
      ? 'azkar-chapters'
      : !activeAzkarItem
      ? `azkar-list-${hisnulChapter}`
      : `azkar-reader-${activeAzkarItem.id}`;

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation Tabs: Hisnul Muslim, Ruqyah, 33 Ayat */}
      <div className="glass-card flex gap-1.5 overflow-x-auto rounded-2xl p-1.5">
        <button
          type="button"
          onClick={() => {
            setSubTab('azkar');
            setHisnulChapter(null);
            setSelectedAzkarId(null);
            setAzkarQuery('');
          }}
          className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-all md:text-sm ${
            subTab === 'azkar'
              ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#E7C57B] shadow-sm'
              : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8]'
          }`}
        >
          হিসনুল মুসলিম ({AZKAR_LIST.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('ruqyah');
            setSelectedRuqyahId(null);
          }}
          className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-all md:text-sm ${
            subTab === 'ruqyah'
              ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#E7C57B] shadow-sm'
              : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8]'
          }`}
        >
          রুকাইয়া সংকলন ({RUQYAH_PROGRAMS.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('manzil');
            setManzilReaderOpen(false);
          }}
          className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-all md:text-sm ${
            subTab === 'manzil'
              ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#E7C57B] shadow-sm'
              : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8]'
          }`}
        >
          ৩৩ আয়াত (মঞ্জিল)
        </button>
      </div>

      {/* Smooth animated sub-views & reader stages */}
      <SmoothStage stageKey={innerStageKey}>
        {subTab === 'ruqyah' ? (
          activeRuqyahProgram ? (
            /* RUQYAH STEP 2: QURAN-STYLE AYAH READER */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRuqyahId(null);
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>সকল রুকাইয়া ({RUQYAH_PROGRAMS.length})</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedRuqyahIndex <= 0}
                    onClick={() => {
                      const prev = RUQYAH_PROGRAMS[selectedRuqyahIndex - 1];
                      if (prev) handleOpenRuqyahReader(prev.id);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>পূর্বের রুকাইয়া</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedRuqyahIndex >= RUQYAH_PROGRAMS.length - 1}
                    onClick={() => {
                      const next = RUQYAH_PROGRAMS[selectedRuqyahIndex + 1];
                      if (next) handleOpenRuqyahReader(next.id);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                  >
                    <span>পরের রুকাইয়া</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {renderQuranStyleVersesReader({
                tracks: ruqyahTracks,
                loading: ruqyahLoading,
                readerStyle: ruqyahReaderStyle,
                onChangeReaderStyle: setRuqyahReaderStyle,
                offlineKey: activeRuqyahProgram.id,
                refs: activeRuqyahProgram.verses,
                titleBn: activeRuqyahProgram.titleBn,
                subtitleBn: `${activeRuqyahProgram.subtitleBn} · উদ্দেশ্য: ${activeRuqyahProgram.purposeBn}`,
                metaBadgeBn: `রুকাইয়া ${selectedRuqyahIndex + 1} / ${RUQYAH_PROGRAMS.length} · ${activeRuqyahProgram.durationHint}`,
              })}
            </div>
          ) : (
            /* RUQYAH STEP 1: QURAN-SURAH STYLE DIRECTORY */
            <div className="space-y-5">
              {/* Ruqyah Hero Banner */}
              <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/20 bg-[#04241E] shadow-[0_16px_45px_rgba(6,61,52,0.22)]">
                {!imgFailed ? (
                  <img
                    src={RUQYAH_NATURE_IMG}
                    alt="প্রশান্ত প্রকৃতি ও রুকাইয়া"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#063D34] to-[#031814]" />
                )}
                <div className="bg-islamic-lattice absolute inset-0 opacity-35" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#031814]/95 via-[#04241E]/82 to-[#04241E]/55" />

                <div className="relative z-10 p-5 md:p-8">
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div className="max-w-2xl">
                      <p className="text-xs font-semibold text-[#F6DC9B]">
                        ১০টি রুকাইয়া সংকলন · কুরআন-স্টাইল পাঠ ও ১০ জন ক্বারীর তিলাওয়াত
                      </p>
                      <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                        রুকাইয়া শারইয়াহ সংকলন (অধ্যায় ও আয়াত)
                      </h1>
                      <p className="mt-2 text-sm leading-relaxed text-[#D0E2DC]">
                        যেকোনো রুকাইয়া সংকলনে চাপ দিলে কুরআনের সূরার মতো আরবি মুসহাফ, তাজবীদ, বাংলা উচ্চারণ, বাংলা অর্থ ও যেকোনো আয়াত থেকে সরাসরি অডিও শুনতে পারবেন।
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <label htmlFor="ruqyah-qari-select" className="text-[11px] font-medium text-[#A9C4BB]">
                        সক্রিয় রাক্বী / ক্বারী
                      </label>
                      <select
                        id="ruqyah-qari-select"
                        value={selectedQari.id}
                        onChange={(e) => {
                          const found = QARI_RECITERS.find((q) => q.id === e.target.value);
                          if (found) onChangeQari(found);
                        }}
                        className="min-h-[44px] rounded-xl border border-[#E7C57B]/35 bg-[#04241E]/90 px-4 text-xs font-semibold text-[#F6DC9B] backdrop-blur-md focus:outline-none"
                      >
                        {QARI_RECITERS.map((q) => (
                          <option key={q.id} value={q.id} className="bg-[#063D34] text-white">
                            {q.nameBn}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live Audio Status Row */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-xs backdrop-blur-md">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {audioStatus === 'loading' ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#F6DC9B]" />
                      ) : (
                        <Radio className="h-4 w-4 shrink-0 text-[#6EE7B7]" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{audioStatusText}</p>
                        <p className="truncate text-[11px] text-[#A9C4BB]">
                          ক্বারী: {selectedQari.nameBn} · {selectedQari.styleBn}
                        </p>
                      </div>
                    </div>

                    {audioStatus !== 'idle' && activePlayingRuqyahId && (
                      <button
                        type="button"
                        onClick={() => handleOpenRuqyahReader(activePlayingRuqyahId)}
                        className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E7C57B]/40 bg-[#E7C57B]/15 px-3 text-xs font-semibold text-[#F6DC9B] transition-colors hover:bg-[#E7C57B]/25"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span className="whitespace-nowrap">কুরআন মোডে দেখুন</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* World-Famous Raqi / Qari Quick Picker */}
              <section className="glass-card rounded-3xl p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                    <h2 className="text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                      বিশ্ববিখ্যাত ১০ জন রাক্বী ও ক্বারী
                    </h2>
                  </div>
                  <span className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    {selectedQari.countryBn}
                  </span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {QARI_RECITERS.map((qari) => {
                    const active = selectedQari.id === qari.id;
                    return (
                      <button
                        key={qari.id}
                        type="button"
                        onClick={() => onChangeQari(qari)}
                        className={`flex min-h-[58px] min-w-[210px] shrink-0 flex-col justify-center rounded-2xl border px-3.5 py-2 text-left transition-all ${
                          active
                            ? 'border-[#E7C57B]/70 bg-gradient-to-br from-[#063D34] to-[#0A5749] text-white shadow-sm'
                            : 'border-[#E2E8E5] bg-[#F6F9F8] text-[#0F1F1A] hover:border-[#0D6E52]/35 dark:border-[#1E342D] dark:bg-[#07110E] dark:text-[#F0F5F3]'
                        }`}
                      >
                        <p
                          className={`truncate text-xs font-bold ${
                            active ? 'text-[#F6DC9B]' : 'text-[#0F1F1A] dark:text-[#F0F5F3]'
                          }`}
                        >
                          {qari.nameBn}
                        </p>
                        <p
                          className={`mt-0.5 truncate text-[11px] ${
                            active ? 'text-[#CBE2DA]' : 'text-[#475A53] dark:text-[#9BB0A8]'
                          }`}
                        >
                          {qari.styleBn} · {qari.bitrateLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Ruqyah Directory Card List */}
              <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                      রুকাইয়া অধ্যায়সমূহ নির্বাচন করুন
                    </h2>
                    <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                      যেকোনো সংকলনে চাপ দিলে কুরআনের মতো সকল আয়াত খুলে যাবে
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
                    <input
                      type="search"
                      value={ruqyahQuery}
                      onChange={(e) => setRuqyahQuery(e.target.value)}
                      placeholder="রুকাইয়া খুঁজুন..."
                      aria-label="রুকাইয়া খুঁজুন"
                      className="min-h-[42px] w-full rounded-xl border border-black/10 bg-black/[0.025] pl-9 pr-3 text-xs text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {RUQYAH_CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRuqyahCat(cat.id)}
                      className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                        ruqyahCat === cat.id
                          ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B] dark:border-[#E7C57B]/50'
                          : 'border-[#E2E8E5] bg-white text-[#475A53] hover:bg-[#F6F9F8] dark:border-[#244238] dark:bg-[#0D1A16] dark:text-[#9BB0A8]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredPrograms.map((program) => {
                    const realIdx = RUQYAH_PROGRAMS.findIndex((p) => p.id === program.id);
                    const isLoadingAudio = ruqyahLoading && selectedRuqyahId === program.id;

                    return (
                      <div
                        key={program.id}
                        className="flex flex-col justify-between rounded-3xl border border-black/10 bg-white/85 p-5 shadow-xs transition-all hover:border-[#0D6E52]/45 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/45"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenRuqyahReader(program.id)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#063D34] to-[#0D6E52] text-xs font-bold text-[#F6DC9B]">
                              {realIdx + 1}
                            </span>
                            <span className="font-mono-num rounded-xl bg-[#0D6E52]/10 px-2.5 py-1 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                              {program.durationHint}
                            </span>
                          </div>

                          <h3 className="mt-3 text-base font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {program.titleBn}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                            {program.subtitleBn}
                          </p>
                          <p className="mt-2 text-[11px] font-medium text-[#0D6E52] dark:text-[#6EE7B7]">
                            উদ্দেশ্য: {program.purposeBn}
                          </p>
                        </button>

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/8 pt-3.5 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => handleOpenRuqyahReader(program.id)}
                            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-xs"
                          >
                            <BookOpen className="h-4 w-4" />
                            <span>কুরআন মোডে পড়ুন</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenAndPlayRuqyah(program)}
                            disabled={Boolean(loadingId)}
                            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3.5 text-xs font-bold text-[#0F1F1A] hover:bg-black/[0.06] disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
                          >
                            <Volume2 className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
                            <span>{isLoadingAudio ? 'লোড...' : 'শুনুন'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )
        ) : subTab === 'manzil' ? (
          manzilReaderOpen ? (
            /* 33 AYAT (MANZIL) STEP 2: QURAN-STYLE READER */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManzilReaderOpen(false);
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>৩৩ আয়াত সূচী ({groupedManzil.length})</span>
                </button>

                {manzilGroupFilter !== 'all' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={manzilGroupFilter <= 0}
                      onClick={() =>
                        handleOpenManzilReader(Math.max(0, manzilGroupFilter - 1))
                      }
                      className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>পূর্বের অংশ</span>
                    </button>
                    <button
                      type="button"
                      disabled={manzilGroupFilter >= groupedManzil.length - 1}
                      onClick={() =>
                        handleOpenManzilReader(
                          Math.min(groupedManzil.length - 1, manzilGroupFilter + 1)
                        )
                      }
                      className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                    >
                      <span>পরের অংশ</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Switcher Strip: All 33 Ayat vs Any of the 13 Surah Parts */}
              <div className="glass-card flex gap-1.5 overflow-x-auto rounded-2xl p-2">
                <button
                  type="button"
                  onClick={() => setManzilGroupFilter('all')}
                  className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 text-xs font-bold transition-colors ${
                    manzilGroupFilter === 'all'
                      ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                      : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]'
                  }`}
                >
                  সম্পূর্ণ ৩৩ আয়াত ({MANZIL_33_AYAT_REFS.length})
                </button>
                {groupedManzil.map((grp, idx) => (
                  <button
                    key={`${grp.surah}-${idx}`}
                    type="button"
                    onClick={() => setManzilGroupFilter(idx)}
                    className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors ${
                      manzilGroupFilter === idx
                        ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#F6DC9B]'
                        : 'text-[#475A53] hover:bg-black/5 dark:text-[#9BB0A8]'
                    }`}
                  >
                    {idx + 1}. {grp.nameBn.replace(/^সূরা\s+/, '')}
                  </button>
                ))}
              </div>

              {renderQuranStyleVersesReader({
                tracks: manzilTracks,
                loading: manzilLoading,
                readerStyle: manzilReaderStyle,
                onChangeReaderStyle: setManzilReaderStyle,
                offlineKey:
                  manzilGroupFilter === 'all'
                    ? 'manzil-offline'
                    : `manzil-part-${manzilGroupFilter}`,
                refs: activeManzilRefs,
                titleBn:
                  manzilGroupFilter === 'all'
                    ? 'মঞ্জিল — কুরআনের প্রসিদ্ধ ৩৩ আয়াত'
                    : `${groupedManzil[manzilGroupFilter]?.nameBn || ''} (৩৩ আয়াত)`,
                subtitleBn:
                  'আরবি মুসহাফ, তাজবীদ কালার, বাংলা উচ্চারণ ও অনুবাদসহ কুরআন-স্টাইল তিলাওয়াত ও শ্রবণ',
                metaBadgeBn:
                  manzilGroupFilter === 'all'
                    ? `সম্পূর্ণ মঞ্জিল · ${MANZIL_33_AYAT_REFS.length}টি আয়াত · ১৩টি সূরা`
                    : `অংশ ${manzilGroupFilter + 1} / ${groupedManzil.length} · সূরা ${
                        groupedManzil[manzilGroupFilter]?.surah || ''
                      }`,
              })}
            </div>
          ) : (
            /* 33 AYAT (MANZIL) STEP 1: DIRECTORY */
            <section className="glass-card rounded-3xl p-5 md:p-7">
              <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8E5] pb-5 dark:border-[#1E342D] md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                    মঞ্জিল — কুরআনের প্রসিদ্ধ ৩৩ আয়াত
                  </h2>
                  <p className="mt-1 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    ১৩টি সূরা থেকে নির্বাচিত ৮৩টি আয়াত · কুরআন-স্টাইল মুসহাফ, তাজবীদ ও বাংলা অনুবাদসহ পড়ুন বা শুনুন
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenManzilReader('all')}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm hover:opacity-95"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="whitespace-nowrap">কুরআন মোডে পড়ুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAndPlayManzil('all')}
                    disabled={Boolean(loadingId)}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D4A853]/40 bg-[#D4A853]/12 px-4 text-xs font-bold text-[#745118] dark:text-[#E7C57B]"
                  >
                    <Play className="h-4 w-4" />
                    <span className="whitespace-nowrap">সম্পূর্ণ ৩৩ আয়াত শুনুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveOfflineRefs('manzil-offline', MANZIL_33_AYAT_REFS)}
                    disabled={Boolean(offlineSaving)}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-xs font-bold transition-colors disabled:opacity-60 ${
                      offlineSavedIds.includes('manzil-offline')
                        ? 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#0D6E52] dark:border-[#6EE7B7]/40 dark:text-[#6EE7B7]'
                        : 'border-black/10 bg-white text-[#0F1F1A] hover:border-[#0D6E52]/40 dark:border-white/15 dark:bg-white/[0.06] dark:text-white'
                    }`}
                  >
                    {offlineSaving?.id === 'manzil-offline' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-mono-num whitespace-nowrap">
                          {offlineSaving.done}/{offlineSaving.total}
                        </span>
                      </>
                    ) : offlineSavedIds.includes('manzil-offline') ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="whitespace-nowrap">অফলাইন প্রস্তুত</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span className="whitespace-nowrap">অফলাইনে সেভ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupedManzil.map((group, idx) => {
                  const firstAyah = group.ayahs[0];
                  const lastAyah = group.ayahs[group.ayahs.length - 1];
                  const rangeLabel =
                    group.ayahs.length === 1 ? `আয়াত ${firstAyah}` : `আয়াত ${firstAyah}–${lastAyah}`;

                  return (
                    <div
                      key={`${group.surah}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8E5] bg-[#F6F9F8] p-4 transition-colors hover:border-[#0D6E52]/40 dark:border-[#1E342D] dark:bg-[#07110E]"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenManzilReader(idx)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-mono-num text-xs font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                          অংশ {idx + 1} · সূরা {group.surah}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                          {group.nameBn}
                        </p>
                        <p className="font-mono-num text-xs text-[#475A53] dark:text-[#9BB0A8]">
                          {rangeLabel} · পড়তে চাপ দিন
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenAndPlayManzil(idx)}
                        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-white text-[#063D34] shadow-sm transition-colors hover:bg-[#063D34] hover:text-[#E7C57B] dark:bg-[#0D1A16] dark:text-[#E7C57B]"
                        aria-label={`${group.nameBn} শুনুন`}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        ) : !hisnulChapter ? (
          /* HISNUL MUSLIM STEP 1: CHAPTER DIRECTORY */
          <div className="space-y-5">
            <section className="relative overflow-hidden rounded-3xl border border-[#E7C57B]/25 bg-[#04241E] shadow-[0_16px_45px_rgba(6,61,52,0.22)]">
              {!amolImgFailed ? (
                <img
                  src={AMOL_LANTERN_IMG}
                  alt="হিসনুল মুসলিম"
                  referrerPolicy="no-referrer"
                  onError={() => setAmolImgFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#063D34] to-[#031814]" />
              )}
              <div className="bg-islamic-lattice absolute inset-0 opacity-45" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#031814]/95 via-[#04241E]/85 to-[#04241E]/60" />

              <div className="relative z-10 p-5 md:p-7">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="max-w-2xl">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#F6DC9B]">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>হিসনুল মুসলিম · শাইখ সাঈদ ইবনু আলী আল-কাহতানি (রহ.)</span>
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold text-white md:text-3xl">
                      হিসনুল মুসলিম — অধ্যায় ও দুআ সূচী
                    </h1>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#D0E2DC] md:text-sm">
                      কুরআন ও সীরাহর মতো আগে পছন্দের অধ্যায় নির্বাচন করুন, তারপর ভেতরের প্রতিটি দুআ ও যিকির পরিষ্কারভাবে পড়ুন, গণনা করুন ও শুনুন।
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAzkarVoicePanel((v) => !v)}
                      className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#F6DC9B]/40 bg-white/10 px-3.5 text-xs font-bold text-[#F6DC9B] backdrop-blur-md transition-colors hover:bg-white/20"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>ভয়েস নির্বাচন</span>
                    </button>

                    <button
                      type="button"
                      onClick={resetAllAzkar}
                      className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>আজকের গণনা রিসেট</span>
                    </button>
                  </div>
                </div>

                {/* Overall Today Progress */}
                <div className="mt-5 rounded-2xl border border-white/12 bg-black/30 p-3.5 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#E5F2EE]">আজকের মোট সম্পন্ন আমল</span>
                    <span className="font-mono-num font-bold text-[#F6DC9B]">
                      {totalAzkarDoneAll} / {AZKAR_LIST.length}টি দুআ
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#34B38A] to-[#F6DC9B] transition-[width] duration-300"
                      style={{
                        width: `${
                          AZKAR_LIST.length > 0
                            ? Math.round((totalAzkarDoneAll / AZKAR_LIST.length) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {showAzkarVoicePanel && (
              <section className="glass-card rounded-3xl p-4 md:p-5">
                <VoiceSelectorSection compact />
              </section>
            )}

            <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
                    হিসনুল মুসলিমের অধ্যায় নির্বাচন করুন
                  </h2>
                  <p className="text-xs text-[#475A53] dark:text-[#9BB0A8]">
                    অধ্যায়ে চাপ দিলে ভেতরের সব দুআ তালিকা আকারে দেখতে পারবেন
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
                  <input
                    type="search"
                    value={azkarQuery}
                    onChange={(e) => setAzkarQuery(e.target.value)}
                    placeholder="সব অধ্যায় থেকে দুআ খুঁজুন..."
                    aria-label="হিসনুল মুসলিম দুআ খুঁজুন"
                    className="min-h-[42px] w-full rounded-xl border border-black/10 bg-black/[0.025] pl-9 pr-3 text-xs text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
                  />
                </div>
              </div>

              {azkarQuery.trim() ? (
                filteredAzkar.length === 0 ? (
                  <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                    <BookOpen className="mx-auto h-8 w-8 text-[#7A8E86]" />
                    <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                      এই নামে হিসনুল মুসলিমের কোনো দুআ পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAzkar.map((azkar, idx) => {
                      const count = azkarCounts[azkar.id] || 0;
                      const isDone = count >= azkar.repeatTarget;
                      return (
                        <button
                          key={azkar.id}
                          type="button"
                          onClick={() => handleOpenAzkarReader(azkar.id, 'all')}
                          className={`flex min-h-[76px] w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                            isDone
                              ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] dark:border-[#6EE7B7]/35 dark:bg-[#063D34]/50'
                              : 'border-black/8 bg-white/80 hover:border-[#0D6E52]/40 dark:border-white/10 dark:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className={`font-mono-num flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                isDone
                                  ? 'bg-[#063D34] text-[#F6DC9B]'
                                  : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                                {azkar.titleBn}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-[#475A53] dark:text-[#9BB0A8]">
                                {getCategoryLabelBn(azkar.category)} · {count}/{azkar.repeatTarget}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#7A8E86]" />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                  {HISNUL_CHAPTERS.map((chap) => {
                    const items = AZKAR_LIST.filter((a) => matchesHisnulChapter(a, chap.id));
                    const doneCount = items.filter(
                      (a) => (azkarCounts[a.id] || 0) >= a.repeatTarget
                    ).length;
                    const IconComp = chap.Icon;
                    const allDone = items.length > 0 && doneCount === items.length;

                    return (
                      <button
                        key={chap.id}
                        type="button"
                        onClick={() => handleOpenHisnulChapter(chap.id)}
                        className={`flex flex-col justify-between rounded-3xl border p-5 text-left shadow-xs transition-all ${
                          allDone
                            ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.06] dark:border-[#6EE7B7]/35 dark:bg-[#063D34]/45'
                            : 'border-black/10 bg-white/85 hover:border-[#0D6E52]/45 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-[#E7C57B]/45'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#063D34] to-[#0D6E52] text-[#F6DC9B] shadow-xs">
                              <IconComp className="h-5 w-5" />
                            </div>
                            <span className="font-mono-num rounded-xl bg-[#0D6E52]/10 px-2.5 py-1 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                              {items.length}টি দুআ
                            </span>
                          </div>

                          <h3 className="mt-3.5 text-base font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {chap.number}. {chap.titleBn}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#475A53] dark:text-[#9BB0A8]">
                            {chap.subtitleBn}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-3 text-xs dark:border-white/10">
                          <span className="font-mono-num font-semibold text-[#0D6E52] dark:text-[#6EE7B7]">
                            সম্পন্ন: {doneCount}/{items.length}
                          </span>
                          <span className="flex items-center gap-1 font-bold text-[#063D34] dark:text-[#F6DC9B]">
                            <span>অধ্যায় খুলুন</span>
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
        ) : !activeAzkarItem ? (
          /* HISNUL MUSLIM STEP 2: SELECTED CHAPTER DUA DIRECTORY */
          <section className="glass-card space-y-4 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setHisnulChapter(null);
                    setSelectedAzkarId(null);
                    setAzkarQuery('');
                    scrollTopSmooth();
                  }}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>সকল অধ্যায়</span>
                </button>

                <div>
                  <p className="text-[11px] font-semibold text-[#0D6E52] dark:text-[#E7C57B]">
                    হিসনুল মুসলিম · {chapterAzkarList.length}টি দুআ · সম্পন্ন {chapterAzkarDoneCount}/
                    {chapterAzkarList.length}
                  </p>
                  <h2 className="text-base font-bold text-[#0F1F1A] dark:text-[#F0F5F3] sm:text-lg">
                    {activeHisnulChapterMeta?.titleBn}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAzkarVoicePanel((v) => !v)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-xs font-semibold text-[#0F1F1A] dark:border-white/15 dark:bg-white/[0.05] dark:text-white"
                >
                  <Mic className="h-3.5 w-3.5 text-[#0D6E52] dark:text-[#E7C57B]" />
                  <span>ভয়েস</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayAzkarChapterQueue(filteredAzkar)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>সব যিকির শুনুন</span>
                </button>
              </div>
            </div>

            {showAzkarVoicePanel && (
              <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.02]">
                <VoiceSelectorSection compact />
              </div>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8E86]" />
              <input
                type="search"
                value={azkarQuery}
                onChange={(e) => setAzkarQuery(e.target.value)}
                placeholder="এই অধ্যায়ের দুআ বা যিকির খুঁজুন..."
                aria-label="এই অধ্যায়ের দুআ খুঁজুন"
                className="min-h-[44px] w-full rounded-xl border border-black/10 bg-black/[0.03] pl-10 pr-3 text-sm text-[#0F1F1A] placeholder:text-[#7A8E86] focus:border-[#0D6E52] focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F0F5F3]"
              />
            </div>

            {filteredAzkar.length === 0 ? (
              <div className="rounded-2xl bg-black/[0.025] p-8 text-center dark:bg-white/[0.03]">
                <BookOpen className="mx-auto h-8 w-8 text-[#7A8E86]" />
                <p className="mt-2 text-sm text-[#475A53] dark:text-[#9BB0A8]">
                  এই নামে কোনো দুআ পাওয়া যায়নি।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAzkar.map((azkar) => {
                  const realIdx = chapterAzkarList.findIndex((item) => item.id === azkar.id);
                  const count = azkarCounts[azkar.id] || 0;
                  const isDone = count >= azkar.repeatTarget;

                  return (
                    <button
                      key={azkar.id}
                      type="button"
                      onClick={() => handleOpenAzkarReader(azkar.id)}
                      className={`flex min-h-[82px] w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        isDone
                          ? 'border-[#0D6E52]/50 bg-[#0D6E52]/[0.08] shadow-xs dark:border-[#6EE7B7]/35 dark:bg-[#063D34]/55'
                          : 'border-black/8 bg-white/80 hover:border-[#0D6E52]/35 hover:bg-[#0D6E52]/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#E7C57B]/35'
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            isDone
                              ? 'bg-[#063D34] text-[#F6DC9B]'
                              : 'bg-black/[0.05] text-[#0D6E52] dark:bg-white/[0.08] dark:text-[#E7C57B]'
                          }`}
                        >
                          {realIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F1F1A] dark:text-[#F0F5F3]">
                            {azkar.titleBn}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={`font-mono-num font-semibold ${
                                isDone
                                  ? 'text-[#0D6E52] dark:text-[#6EE7B7]'
                                  : 'text-[#475A53] dark:text-[#9BB0A8]'
                              }`}
                            >
                              {isDone ? 'সম্পন্ন ✓' : `${count}/${azkar.repeatTarget} বার`}
                            </span>
                            <span className="text-[#8FA49C]">·</span>
                            <span className="truncate text-[#475A53] dark:text-[#9BB0A8]">
                              {azkar.reference.split('(')[0].trim()}
                            </span>
                          </div>
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
          /* HISNUL MUSLIM STEP 3: SINGLE DUA READER VIEW */
          (() => {
            const count = azkarCounts[activeAzkarItem.id] || 0;
            const isDone = count >= activeAzkarItem.repeatTarget;
            const speechId = `azkar-speech-${activeAzkarItem.id}`;
            const isSpeechPlaying =
              speechSnap.currentTrack?.id === speechId && speechSnap.status === 'playing';
            const hasPrev = selectedAzkarIndex > 0;
            const hasNext = selectedAzkarIndex < chapterAzkarList.length - 1;

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAzkarId(null);
                        scrollTopSmooth();
                      }}
                      className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3.5 text-xs font-bold text-[#063D34] shadow-xs transition-colors hover:bg-[#0D6E52]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F6DC9B] dark:hover:bg-white/12"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>দুআর তালিকা</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHisnulChapter(null);
                        setSelectedAzkarId(null);
                        scrollTopSmooth();
                      }}
                      className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 text-xs font-semibold text-[#475A53] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.04] dark:text-[#9BB0A8]"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>সকল অধ্যায়</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!hasPrev}
                      onClick={() => {
                        if (hasPrev) {
                          handleOpenAzkarReader(chapterAzkarList[selectedAzkarIndex - 1].id);
                        }
                      }}
                      className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>পূর্বের দুআ</span>
                    </button>
                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={() => {
                        if (hasNext) {
                          handleOpenAzkarReader(chapterAzkarList[selectedAzkarIndex + 1].id);
                        }
                      }}
                      className="flex min-h-[40px] items-center gap-1 rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F0F5F3]"
                    >
                      <span>পরের দুআ</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <article className="glass-card space-y-5 rounded-3xl p-5 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono-num rounded-lg bg-[#0D6E52]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#0D6E52] dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]">
                          {activeHisnulChapterMeta?.titleBn} · {selectedAzkarIndex + 1} /{' '}
                          {chapterAzkarList.length}
                        </span>
                        <span className="rounded-lg border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-[#475A53] dark:border-white/15 dark:text-[#9BB0A8]">
                          পাঠের সংখ্যা: {activeAzkarItem.repeatTarget} বার
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-[#0F1F1A] dark:text-[#F0F5F3] md:text-2xl">
                        {activeAzkarItem.titleBn}
                      </h2>
                      <p className="mt-1 text-xs text-[#475A53] dark:text-[#9BB0A8]">
                        প্রামাণিক সূত্র: {activeAzkarItem.reference}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayAzkarAudio(activeAzkarItem)}
                        className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold transition-colors ${
                          isSpeechPlaying
                            ? 'border-[#0D6E52] bg-[#063D34] text-[#F6DC9B]'
                            : 'border-black/10 bg-black/[0.03] text-[#0D6E52] hover:bg-black/5 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#E7C57B]'
                        }`}
                      >
                        {isSpeechPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                        <span>
                          {activeAzkarItem.audioRefs
                            ? 'তিলাওয়াত শুনুন'
                            : isSpeechPlaying
                            ? 'বিরতি'
                            : 'অডিও শুনুন'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => resetAzkarItem(activeAzkarItem.id)}
                        className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-black/10 text-[#7A8E86] hover:bg-[#F1F5F3] dark:border-white/15 dark:hover:bg-[#132620]"
                        aria-label="গণনা রিসেট"
                        title="গণনা রিসেট"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() =>
                          incrementAzkar(activeAzkarItem.id, activeAzkarItem.repeatTarget)
                        }
                        className={`font-mono-num flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
                          isDone
                            ? 'bg-gradient-to-r from-[#063D34] to-[#0D6E52] text-[#E7C57B] shadow-sm'
                            : 'bg-gradient-to-r from-[#E7C57B] to-[#C8963E] text-[#041D18] shadow-sm'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-[#6EE7B7]" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="whitespace-nowrap">
                          {isDone
                            ? `সম্পন্ন (${count}/${activeAzkarItem.repeatTarget})`
                            : `গণনা করুন: ${count} / ${activeAzkarItem.repeatTarget}`}
                        </span>
                      </motion.button>
                    </div>
                  </div>

                  <p
                    dir="rtl"
                    className="font-arabic rounded-2xl border border-[#0D6E52]/10 bg-[#F6F9F8] p-5 text-right text-[#0F1F1A] dark:border-[#1E342D] dark:bg-[#07110E] dark:text-[#F0F5F3]"
                    style={{
                      fontSize: `${Math.min(36, Math.max(24, settings.arabicFontSize))}px`,
                      lineHeight: 2.15,
                    }}
                  >
                    {activeAzkarItem.arabic}
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-medium leading-relaxed text-[#0D6E52] dark:text-[#E7C57B] md:text-base">
                      <span className="font-bold">উচ্চারণ: </span>
                      {activeAzkarItem.transliterationBn}
                    </p>
                    <p className="text-sm leading-relaxed text-[#475A53] dark:text-[#E2EFEA] md:text-base">
                      <span className="font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">অর্থ: </span>
                      {activeAzkarItem.meaningBn}
                    </p>
                  </div>

                  {activeAzkarItem.virtueBn && (
                    <div className="rounded-2xl border border-[#0D6E52]/20 bg-[#0D6E52]/[0.06] p-4 text-xs leading-relaxed text-[#063D34] dark:border-[#E7C57B]/25 dark:bg-[#063D34]/40 dark:text-[#E5F0EC] sm:text-sm">
                      <strong className="text-[#0D6E52] dark:text-[#F6DC9B]">ফযীলত: </strong>
                      {activeAzkarItem.virtueBn}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-black/8 pt-4 dark:border-white/10">
                    <button
                      type="button"
                      disabled={!hasPrev}
                      onClick={() => {
                        if (hasPrev) {
                          handleOpenAzkarReader(chapterAzkarList[selectedAzkarIndex - 1].id);
                        }
                      }}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 px-4 text-xs font-bold text-[#0F1F1A] disabled:opacity-40 dark:border-white/15 dark:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>পূর্ববর্তী দুআ</span>
                    </button>

                    <span className="font-mono-num text-xs font-semibold text-[#475A53] dark:text-[#9BB0A8]">
                      {selectedAzkarIndex + 1} / {chapterAzkarList.length}
                    </span>

                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={() => {
                        if (hasNext) {
                          handleOpenAzkarReader(chapterAzkarList[selectedAzkarIndex + 1].id);
                        }
                      }}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#063D34] to-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] disabled:opacity-40"
                    >
                      <span>পরবর্তী দুআ</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              </div>
            );
          })()
        )}
      </SmoothStage>
    </div>
  );
};
