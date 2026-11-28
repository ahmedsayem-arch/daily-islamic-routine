import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  BookMarked,
  BookOpen,
  BookText,
  CalendarCheck,
  Loader2,
  Mic,
  Pause,
  Play,
  Settings,
  Shield,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { DailyRoutineView } from './components/DailyRoutineView';
import { HadithView } from './components/HadithView';
import { OfflineIndicator } from './components/PWAInstallButton';
import { QuranView } from './components/QuranView';
import { RuqyahAmolView } from './components/RuqyahAmolView';
import { SeerahView } from './components/SeerahView';
import { SettingsView } from './components/SettingsView';
import { TasbihModal } from './components/TasbihModal';
import {
  ALL_SURAHS,
  buildEveryAyahUrl,
  buildIslamicNetworkFallbackUrl,
  CITY_PRESETS,
  QARI_RECITERS,
} from './data/islamicData';
import {
  type InAppNotificationAlert,
  usePrayerNotifications,
} from './hooks/usePrayerNotifications';
import { fetchPrayerTimes, type PrayerScheduleResult } from './services/islamicApi';
import type {
  ActiveTab,
  AppSettings,
  AppThemeId,
  AudioStatus,
  AudioTrackItem,
  FavoriteAyahEntry,
  FavoriteGroup,
  QariReciter,
} from './types/islamic';
import { audioKeepAlive } from './utils/audioKeepAlive';
import {
  clearMediaSession,
  registerMediaSessionHandlers,
  setMediaSessionMetadata,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition,
} from './utils/mediaSessionHelper';
import {
  getFastPlayableAudioUrlSync,
  invalidateResolvedAudioUrl,
  prefetchAndCacheAudioUrls,
  prewarmUpcomingAudioUrls,
  resolveAndPrewarmAudioUrl,
} from './utils/offlineAudioCache';
import {
  APP_THEMES,
  getArabicFontCss,
  isThemeDark,
} from './utils/playerThemes';
import {
  ARABIC_VOICE_MODES,
  speechPlayer,
  useSpeechPlayer,
  VOICE_PROFILES,
} from './utils/speechPlayer';
import { getFallbackHijriDate } from './utils/timeFormat';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'routine', label: 'ডেইলি রুটিন' },
  { id: 'quran', label: 'কুরআন' },
  { id: 'hadith', label: 'হাদিস' },
  { id: 'seerah', label: 'সীরাত ও কিতাব' },
  { id: 'ruqyah', label: 'রুকাইয়া ও আমল' },
  { id: 'settings', label: 'সেটিংস' },
];

const DEFAULT_APP_SETTINGS: AppSettings = {
  arabicFontSize: 28,
  arabicFont: 'scheherazade',
  tajweedColorCoding: true,
  showArabic: true,
  showBengaliTransliteration: true,
  showBengaliTranslation: true,
  showEnglishTranslation: false,
  showTafsir: true,
  tafsirEdition: 'zakaria',
  prayerMethod: 1,
  prayerSchool: 1,
  notificationsEnabled: false,
  notificationSound: true,
  prayerLeadMinutes: 0,
  prayerReminders: {
    Fajr: true,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  },
  routineReminders: {
    morningAzkar: { enabled: true, time: '06:30' },
    eveningAzkar: { enabled: true, time: '17:45' },
    sleepSunnah: { enabled: false, time: '22:00' },
  },
};

function mergeSavedSettings(rawObj: Partial<AppSettings> | null | undefined): AppSettings {
  if (!rawObj) return DEFAULT_APP_SETTINGS;
  return {
    ...DEFAULT_APP_SETTINGS,
    ...rawObj,
    prayerReminders: {
      ...DEFAULT_APP_SETTINGS.prayerReminders,
      ...(rawObj.prayerReminders || {}),
    },
    routineReminders: {
      morningAzkar: {
        ...DEFAULT_APP_SETTINGS.routineReminders.morningAzkar,
        ...(rawObj.routineReminders?.morningAzkar || {}),
      },
      eveningAzkar: {
        ...DEFAULT_APP_SETTINGS.routineReminders.eveningAzkar,
        ...(rawObj.routineReminders?.eveningAzkar || {}),
      },
      sleepSunnah: {
        ...DEFAULT_APP_SETTINGS.routineReminders.sleepSunnah,
        ...(rawObj.routineReminders?.sleepSunnah || {}),
      },
    },
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (
        tabParam === 'routine' ||
        tabParam === 'quran' ||
        tabParam === 'hadith' ||
        tabParam === 'seerah' ||
        tabParam === 'ruqyah' ||
        tabParam === 'settings'
      ) {
        return tabParam;
      }
    } catch {
      // ignore
    }
    return 'routine';
  });
  const [quranRouteIntent, setQuranRouteIntent] = useState<{
    viewMode: 'surah' | 'favorites';
    surahNum?: number;
    seq: number;
  } | null>(null);
  const [hadithRouteIntent, setHadithRouteIntent] = useState<{
    bookId: string | null;
    sectionNum: number | null;
    seq: number;
  } | null>(null);
  const [seerahRouteIntent, setSeerahRouteIntent] = useState<{
    topTab: 'books' | 'library';
    selectedBook: 'full-book' | 'seerah' | null;
    readerOpen: boolean;
    selectedFullIdx?: number;
    selectedSeerahIdx?: number;
    seq: number;
  } | null>(null);
  const [ruqyahRouteIntent, setRuqyahRouteIntent] = useState<{
    subTab: 'ruqyah' | 'manzil' | 'azkar';
    azkarFilter: 'all' | 'morning' | 'evening';
    ruqyahId?: string | null;
    manzilOpen?: boolean;
    manzilGroup?: number | 'all';
    azkarId?: string | null;
    seq: number;
  } | null>(null);

  const [quranReaderState, setQuranReaderState] = useState<{
    viewMode: 'surah' | 'favorites';
    readerOpen: boolean;
    selectedSurahNum: number;
  }>({ viewMode: 'surah', readerOpen: false, selectedSurahNum: 1 });

  const [ruqyahReaderState, setRuqyahReaderState] = useState<{
    subTab: 'ruqyah' | 'manzil' | 'azkar';
    selectedRuqyahId: string | null;
    manzilReaderOpen: boolean;
    manzilGroupFilter: number | 'all';
    hisnulChapter: string | null;
    selectedAzkarId: string | null;
  }>({
    subTab: 'ruqyah',
    selectedRuqyahId: null,
    manzilReaderOpen: false,
    manzilGroupFilter: 'all',
    hisnulChapter: null,
    selectedAzkarId: null,
  });

  const [hadithReaderState, setHadithReaderState] = useState<{
    selectedBookId: string | null;
    selectedSectionNum: number | null;
  }>({ selectedBookId: null, selectedSectionNum: null });

  const [seerahReaderState, setSeerahReaderState] = useState<{
    topTab: 'books' | 'library';
    selectedBook: 'full-book' | 'seerah' | null;
    readerOpen: boolean;
    selectedFullIdx: number;
    selectedSeerahIdx: number;
  }>({
    topTab: 'books',
    selectedBook: null,
    readerOpen: false,
    selectedFullIdx: 0,
    selectedSeerahIdx: 0,
  });

  const [audioSourceContext, setAudioSourceContext] = useState<
    | { tab: 'quran'; viewMode: 'surah' | 'favorites'; surahNum: number }
    | {
        tab: 'ruqyah';
        subTab: 'ruqyah' | 'manzil' | 'azkar';
        ruqyahId: string | null;
        manzilOpen: boolean;
        manzilGroup: number | 'all';
      }
    | null
  >(null);

  const [speechSourceContext, setSpeechSourceContext] = useState<
    | { tab: 'quran'; viewMode: 'surah' | 'favorites'; surahNum: number }
    | { tab: 'hadith'; bookId: string | null; sectionNum: number | null }
    | {
        tab: 'seerah';
        topTab: 'books' | 'library';
        selectedBook: 'full-book' | 'seerah' | null;
        readerOpen: boolean;
        selectedFullIdx: number;
        selectedSeerahIdx: number;
      }
    | {
        tab: 'ruqyah';
        azkarFilter: 'all' | 'morning' | 'evening';
        azkarId: string | null;
      }
    | null
  >(null);
  const lastCapturedSpeechIdRef = useRef<string | null>(null);
  const [showDockVoicePicker, setShowDockVoicePicker] = useState(false);
  const [appTheme, setAppTheme] = useState<AppThemeId>(() => {
    try {
      const savedV3 = localStorage.getItem('noor_app_theme_v3') as AppThemeId | null;
      if (
        savedV3 === 'emerald' ||
        savedV3 === 'daylight' ||
        savedV3 === 'tahajjud' ||
        savedV3 === 'cream'
      ) {
        return savedV3;
      }
      const savedV2 = localStorage.getItem('noor_theme_v2');
      if (savedV2 === 'light') return 'daylight';
      return 'emerald';
    } catch {
      return 'emerald';
    }
  });
  const isDark = isThemeDark(appTheme);
  const [favoriteGroups, setFavoriteGroups] = useState<FavoriteGroup[]>(() => {
    const defaultGroup: FavoriteGroup = {
      id: 'default',
      name: 'সাধারণ সংগ্রহ',
      createdAt: 1,
    };
    try {
      const raw = localStorage.getItem('noor_favorite_groups_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasDefault = parsed.some((g: FavoriteGroup) => g.id === 'default');
          return hasDefault ? parsed : [defaultGroup, ...parsed];
        }
      }
      return [defaultGroup];
    } catch {
      return [defaultGroup];
    }
  });
  const [favoriteAyahs, setFavoriteAyahs] = useState<FavoriteAyahEntry[]>(() => {
    try {
      const raw = localStorage.getItem('noor_favorite_ayahs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });
  const [selectedQari, setSelectedQari] = useState<QariReciter>(() => {
    try {
      const savedId = localStorage.getItem('noor_qari_id');
      return QARI_RECITERS.find((q) => q.id === savedId) || QARI_RECITERS[0];
    } catch {
      return QARI_RECITERS[0];
    }
  });
  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    try {
      return localStorage.getItem('noor_city_id') || 'dhaka';
    } catch {
      return 'dhaka';
    }
  });
  const [customCoords, setCustomCoords] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [schedule, setSchedule] = useState<PrayerScheduleResult>(() => {
    const initialHijri = getFallbackHijriDate(new Date());
    return {
      prayers: [
        { key: 'Fajr', labelBn: 'ফজর', time: '05:02' },
        { key: 'Sunrise', labelBn: 'সূর্যোদয়', time: '06:18' },
        { key: 'Dhuhr', labelBn: 'যোহর', time: '11:52' },
        { key: 'Asr', labelBn: 'আসর', time: '15:36' },
        { key: 'Maghrib', labelBn: 'মাগরিব', time: '17:24' },
        { key: 'Isha', labelBn: 'ইশা', time: '18:42' },
      ],
      hijriDateBn: initialHijri.bn,
      hijriDateAr: initialHijri.ar,
      hijriParts: initialHijri.parts,
      locationLabel: 'ঢাকা',
      isLive: false,
    };
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem('noor_app_settings_v1');
      return raw ? mergeSavedSettings(JSON.parse(raw)) : DEFAULT_APP_SETTINGS;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });
  const [inAppAlert, setInAppAlert] = useState<InAppNotificationAlert | null>(null);
  const [isTasbihOpen, setIsTasbihOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMediaPosSyncRef = useRef<number>(0);
  const [playlist, setPlaylist] = useState<AudioTrackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);
  const [playbackSourceTab, setPlaybackSourceTab] = useState<'quran' | 'ruqyah' | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', appTheme);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const themeMetaObj = APP_THEMES.find((t) => t.id === appTheme);
    if (metaTheme && themeMetaObj) {
      metaTheme.setAttribute('content', themeMetaObj.metaThemeColor);
    }
    try {
      localStorage.setItem('noor_app_theme_v3', appTheme);
    } catch {
      // ignore
    }
  }, [appTheme, isDark]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-arabic',
      getArabicFontCss(appSettings.arabicFont)
    );
  }, [appSettings.arabicFont]);

  const handleCycleTheme = useCallback(() => {
    setAppTheme((prev) => {
      const idx = APP_THEMES.findIndex((t) => t.id === prev);
      return APP_THEMES[(idx + 1) % APP_THEMES.length].id;
    });
  }, []);

  const handleCreateFavoriteGroup = useCallback((rawName: string): FavoriteGroup | null => {
    const trimmed = rawName.trim();
    if (!trimmed) return null;
    const newGroup: FavoriteGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      createdAt: Date.now(),
    };
    setFavoriteGroups((prev) => {
      const next = [...prev, newGroup];
      try {
        localStorage.setItem('noor_favorite_groups_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    return newGroup;
  }, []);

  const handleRenameFavoriteGroup = useCallback((groupId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || groupId === 'default') return;
    setFavoriteGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g));
      try {
        localStorage.setItem('noor_favorite_groups_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleDeleteFavoriteGroup = useCallback((groupId: string) => {
    if (groupId === 'default') return;
    setFavoriteGroups((prev) => {
      const next = prev.filter((g) => g.id !== groupId);
      try {
        localStorage.setItem('noor_favorite_groups_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setFavoriteAyahs((prev) => {
      const next = prev.map((item) => {
        const currentGroups = item.groupIds && item.groupIds.length > 0 ? item.groupIds : ['default'];
        if (!currentGroups.includes(groupId)) return item;
        const remaining = currentGroups.filter((id) => id !== groupId);
        return {
          ...item,
          groupIds: remaining.length > 0 ? remaining : ['default'],
        };
      });
      try {
        localStorage.setItem('noor_favorite_ayahs_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleSaveAyahToGroups = useCallback(
    (entry: FavoriteAyahEntry, groupIds: string[]) => {
      setFavoriteAyahs((prev) => {
        const cleanGroupIds = Array.from(new Set(groupIds));
        let next: FavoriteAyahEntry[];
        if (cleanGroupIds.length === 0) {
          next = prev.filter((item) => item.key !== entry.key);
        } else {
          const exists = prev.some((item) => item.key === entry.key);
          const updatedEntry: FavoriteAyahEntry = {
            ...entry,
            groupIds: cleanGroupIds,
          };
          next = exists
            ? prev.map((item) => (item.key === entry.key ? updatedEntry : item))
            : [updatedEntry, ...prev];
        }
        try {
          localStorage.setItem('noor_favorite_ayahs_v1', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const handleToggleFavoriteAyah = useCallback((entry: FavoriteAyahEntry) => {
    setFavoriteAyahs((prev) => {
      const exists = prev.some((item) => item.key === entry.key);
      const next = exists
        ? prev.filter((item) => item.key !== entry.key)
        : [
            {
              ...entry,
              groupIds:
                entry.groupIds && entry.groupIds.length > 0 ? entry.groupIds : ['default'],
            },
            ...prev,
          ];
      try {
        localStorage.setItem('noor_favorite_ayahs_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleRemoveFavoriteAyah = useCallback((key: string) => {
    setFavoriteAyahs((prev) => {
      const next = prev.filter((item) => item.key !== key);
      try {
        localStorage.setItem('noor_favorite_ayahs_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleChangeQari = useCallback((qari: QariReciter) => {
    setSelectedQari(qari);
    try {
      localStorage.setItem('noor_qari_id', qari.id);
    } catch {
      // ignore
    }
  }, []);

  const handleChangeCityId = useCallback((cityId: string) => {
    setCustomCoords(null);
    setSelectedCityId(cityId);
    try {
      localStorage.setItem('noor_city_id', cityId);
    } catch {
      // ignore
    }
  }, []);

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'আপনার অবস্থান',
        });
      },
      () => {
        // ignore
      }
    );
  }, []);

  useEffect(() => {
    let active = true;
    const preset = CITY_PRESETS.find((c) => c.id === selectedCityId) || CITY_PRESETS[0];
    const lat = customCoords ? customCoords.lat : preset.lat;
    const lng = customCoords ? customCoords.lng : preset.lng;
    const label = customCoords ? customCoords.label : preset.nameBn;

    fetchPrayerTimes(
      lat,
      lng,
      label,
      appSettings.prayerMethod,
      appSettings.prayerSchool
    ).then((result) => {
      if (active) setSchedule(result);
    });
    return () => {
      active = false;
    };
  }, [selectedCityId, customCoords, appSettings.prayerMethod, appSettings.prayerSchool]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('noor_app_settings_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleInAppAlert = useCallback((alert: InAppNotificationAlert) => {
    setInAppAlert(alert);
  }, []);

  useEffect(() => {
    if (!inAppAlert) return;
    const timer = setTimeout(() => setInAppAlert(null), 12000);
    return () => clearTimeout(timer);
  }, [inAppAlert]);

  const { permissionState, requestPermission } =
    usePrayerNotifications(schedule.prayers, appSettings, handleInAppAlert);

  const handleToggleMasterNotification = useCallback(async () => {
    if (!appSettings.notificationsEnabled) {
      const perm = await requestPermission();
      handleUpdateSettings({ notificationsEnabled: true });
      if (perm === 'denied') {
        setInAppAlert({
          id: `perm-denied-${Date.now()}`,
          title: 'অ্যাপের রিমাইন্ডার চালু হয়েছে',
          body: 'ফোনের লক-স্ক্রিন নোটিফিকেশনের জন্য ব্রাউজার সেটিংস থেকে Notification অনুমতি দিন। অ্যাপ চালু থাকলে ভেতরে অ্যালার্ট পাবেন।',
        });
      } else {
        setInAppAlert({
          id: `notif-on-${Date.now()}`,
          title: 'নামাজ ও আমলের নোটিফিকেশন চালু হয়েছে',
          body: 'নির্বাচিত ওয়াক্ত ও আমলের সময়ে নিয়মিত রিমাইন্ডার পাবেন। চাইলে সেটিংস থেকে সময় বদলাতে পারবেন।',
        });
      }
    } else {
      handleUpdateSettings({ notificationsEnabled: false });
      setInAppAlert({
        id: `notif-off-${Date.now()}`,
        title: 'নোটিফিকেশন বন্ধ করা হয়েছে',
        body: 'আপনি চাইলে যেকোনো সময় আবার চালু করতে পারবেন।',
      });
    }
  }, [appSettings.notificationsEnabled, requestPermission, handleUpdateSettings]);

  const handleResetSettings = useCallback(() => {
    setAppSettings(DEFAULT_APP_SETTINGS);
    setSelectedCityId('dhaka');
    setCustomCoords(null);
    setSelectedQari(QARI_RECITERS[0]);
    setAppTheme('emerald');
    setIsLooping(false);
    try {
      localStorage.setItem('noor_app_settings_v1', JSON.stringify(DEFAULT_APP_SETTINGS));
      localStorage.setItem('noor_city_id', 'dhaka');
      localStorage.setItem('noor_qari_id', QARI_RECITERS[0].id);
      localStorage.setItem('noor_app_theme_v3', 'emerald');
    } catch {
      // ignore
    }
  }, []);

  const BISMILLAH_RETURN_THRESHOLD_MS = 5 * 60 * 1000;
  const LAST_ACTIVE_AT_KEY = 'noor_last_active_at_v1';
  const LAST_AWAY_AT_KEY = 'noor_last_away_at_v1';
  const NEEDS_RETURN_BISMILLAH_KEY = 'noor_needs_return_bismillah_v1';

  const playlistRef = useRef<AudioTrackItem[]>([]);
  const currentIndexRef = useRef<number>(0);
  const isLoopingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const SILENT_WAV_DATA_URI =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  const activeLoadedRemoteUrlRef = useRef<string | null>(null);
  const playAttemptIdRef = useRef<number>(0);
  const blobRetryAttemptRef = useRef<number>(-1);
  const offlineErrorAttemptRef = useRef<number>(-1);
  const resolvingErrorAttemptRef = useRef<number>(-1);
  const fallbackErrorAttemptRef = useRef<number>(-1);
  const consecutiveErrorsRef = useRef<number>(0);
  const ignorePauseEventRef = useRef<boolean>(false);
  const userPausedQuranAtRef = useRef<number>(0);
  const lastVisibilityHiddenAtRef = useRef<number>(0);
  const screenOffResumeCountRef = useRef<number>(0);
  const syncQuranMediaSessionRef = useRef<() => void>(() => {});
  const isQuranAudioUnlockedRef = useRef<boolean>(false);
  const isPrimingSilentRef = useRef<boolean>(false);
  const silentPrimeTokenRef = useRef<number>(0);
  const recoverAudioErrorRef = useRef<(attemptId: number) => void>(() => {});
  const skipNextTabScrollRef = useRef<boolean>(false);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const quranReaderStateRef = useRef(quranReaderState);
  const ruqyahReaderStateRef = useRef(ruqyahReaderState);
  const selectedQariRef = useRef(selectedQari);
  const playbackSourceTabRef = useRef(playbackSourceTab);
  const lastAwayAtRef = useRef<number>(0);
  const needsReturnBismillahRef = useRef<boolean>((() => {
    try {
      const now = Date.now();
      const persisted = localStorage.getItem(NEEDS_RETURN_BISMILLAH_KEY) === '1';
      const lastActive = Number(localStorage.getItem(LAST_ACTIVE_AT_KEY) || 0);
      const lastAway = Number(localStorage.getItem(LAST_AWAY_AT_KEY) || 0);
      const staleSession = lastActive === 0 || now - lastActive >= BISMILLAH_RETURN_THRESHOLD_MS;
      const awayExceeded = lastAway > 0 && now - lastAway >= BISMILLAH_RETURN_THRESHOLD_MS;
      const due = persisted || staleSession || awayExceeded;
      if (due) {
        localStorage.setItem(NEEDS_RETURN_BISMILLAH_KEY, '1');
      }
      localStorage.removeItem(LAST_AWAY_AT_KEY);
      localStorage.setItem(LAST_ACTIVE_AT_KEY, String(now));
      return due;
    } catch {
      return true;
    }
  })());

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    quranReaderStateRef.current = quranReaderState;
  }, [quranReaderState]);

  useEffect(() => {
    ruqyahReaderStateRef.current = ruqyahReaderState;
  }, [ruqyahReaderState]);

  useEffect(() => {
    selectedQariRef.current = selectedQari;
    const bismillahUrl = buildEveryAyahUrl(selectedQari.everyAyahFolder, 1, 1);
    prewarmUpcomingAudioUrls([bismillahUrl]);
    prefetchAndCacheAudioUrls([bismillahUrl]);
  }, [selectedQari]);

  useEffect(() => {
    playbackSourceTabRef.current = playbackSourceTab;
  }, [playbackSourceTab]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const touchActive = () => {
      try {
        localStorage.setItem(LAST_ACTIVE_AT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    };

    const markReturnedIfAwayLongEnough = () => {
      const now = Date.now();
      let awaySince = lastAwayAtRef.current;
      if (!awaySince) {
        try {
          awaySince = Number(localStorage.getItem(LAST_AWAY_AT_KEY) || 0);
        } catch {
          awaySince = 0;
        }
      }
      if (
        awaySince > 0 &&
        now - awaySince >= BISMILLAH_RETURN_THRESHOLD_MS &&
        !isPlayingRef.current
      ) {
        needsReturnBismillahRef.current = true;
        try {
          localStorage.setItem(NEEDS_RETURN_BISMILLAH_KEY, '1');
        } catch {
          // ignore
        }
      }
      lastAwayAtRef.current = 0;
      try {
        localStorage.removeItem(LAST_AWAY_AT_KEY);
      } catch {
        // ignore
      }
      touchActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        lastVisibilityHiddenAtRef.current = now;
        touchActive();
        if (isPlayingRef.current) {
          audioKeepAlive.pulse();
          setMediaSessionPlaybackState('playing');
          syncQuranMediaSessionRef.current();
          const snapAttempt = playAttemptIdRef.current;
          for (const delay of [160, 550]) {
            window.setTimeout(() => {
              if (
                snapAttempt !== playAttemptIdRef.current ||
                !isPlayingRef.current ||
                Date.now() - userPausedQuranAtRef.current < 1500
              ) {
                return;
              }
              const el = audioRef.current;
              if (el && el.paused && !el.ended && el.src) {
                audioKeepAlive.pulse();
                void el.play().catch(() => {});
              }
            }, delay);
          }
        }
        if (!isPlayingRef.current && speechPlayer.getSnapshot().status !== 'playing') {
          lastAwayAtRef.current = now;
          try {
            localStorage.setItem(LAST_AWAY_AT_KEY, String(now));
          } catch {
            // ignore
          }
        }
      } else if (document.visibilityState === 'visible') {
        markReturnedIfAwayLongEnough();
      }
    };

    const handlePageHide = () => {
      const now = Date.now();
      touchActive();
      if (!isPlayingRef.current && speechPlayer.getSnapshot().status !== 'playing') {
        lastAwayAtRef.current = now;
        try {
          localStorage.setItem(LAST_AWAY_AT_KEY, String(now));
        } catch {
          // ignore
        }
      }
    };

    const handlePageShow = () => {
      markReturnedIfAwayLongEnough();
    };

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        touchActive();
      }
    }, 20000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const speechSnap = useSpeechPlayer();

  useEffect(() => {
    if (speechSnap.status === 'idle' || !speechSnap.currentTrack) {
      lastCapturedSpeechIdRef.current = null;
      setSpeechSourceContext(null);
      return;
    }
    const trackId = speechSnap.currentTrack.id;
    if (lastCapturedSpeechIdRef.current === trackId) return;
    lastCapturedSpeechIdRef.current = trackId;

    if (activeTab === 'quran') {
      setSpeechSourceContext({
        tab: 'quran',
        viewMode: quranReaderState.viewMode,
        surahNum: quranReaderState.selectedSurahNum,
      });
    } else if (activeTab === 'hadith') {
      setSpeechSourceContext({
        tab: 'hadith',
        bookId: hadithReaderState.selectedBookId,
        sectionNum: hadithReaderState.selectedSectionNum,
      });
    } else if (activeTab === 'seerah') {
      setSpeechSourceContext({
        tab: 'seerah',
        topTab: seerahReaderState.topTab,
        selectedBook: seerahReaderState.selectedBook,
        readerOpen: seerahReaderState.readerOpen,
        selectedFullIdx: seerahReaderState.selectedFullIdx,
        selectedSeerahIdx: seerahReaderState.selectedSeerahIdx,
      });
    } else if (activeTab === 'ruqyah') {
      const ch = ruqyahReaderState.hisnulChapter;
      const filter: 'all' | 'morning' | 'evening' =
        ch === 'morning' || ch === 'evening' ? ch : 'all';
      setSpeechSourceContext({
        tab: 'ruqyah',
        azkarFilter: filter,
        azkarId: ruqyahReaderState.selectedAzkarId,
      });
    }
  }, [
    speechSnap.status,
    speechSnap.currentTrack,
    activeTab,
    quranReaderState,
    hadithReaderState,
    seerahReaderState,
    ruqyahReaderState,
  ]);

  const getActiveAudio = useCallback(() => {
    return audioRef.current;
  }, []);

  useEffect(() => {
    return speechPlayer.onBeforeStart(() => {
      userPausedQuranAtRef.current = Date.now();
      const el = audioRef.current;
      if (el && !el.paused) {
        ignorePauseEventRef.current = true;
        el.pause();
        window.setTimeout(() => {
          ignorePauseEventRef.current = false;
        }, 250);
      } else {
        ignorePauseEventRef.current = false;
      }
      audioKeepAlive.release('quran');
      isPlayingRef.current = false;
      setIsPlaying(false);
      setAudioStatus('paused');
    });
  }, []);

  const primeAudioElementInternal = useCallback(() => {
    audioKeepAlive.primeOnGesture();
    const el = audioRef.current;
    if (!el || isPlayingRef.current || isQuranAudioUnlockedRef.current) return;
    if (el.src && !el.error && el.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) {
      return;
    }
    const token = ++silentPrimeTokenRef.current;
    const baseAttempt = playAttemptIdRef.current;
    try {
      isPrimingSilentRef.current = true;
      el.src = SILENT_WAV_DATA_URI;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          isQuranAudioUnlockedRef.current = true;
          if (silentPrimeTokenRef.current === token) {
            isPrimingSilentRef.current = false;
            if (playAttemptIdRef.current === baseAttempt && !isPlayingRef.current) {
              el.pause();
            }
          }
        }).catch(() => {
          if (silentPrimeTokenRef.current === token) {
            isPrimingSilentRef.current = false;
          }
        });
      } else {
        isQuranAudioUnlockedRef.current = true;
        if (silentPrimeTokenRef.current === token) {
          isPrimingSilentRef.current = false;
        }
      }
    } catch {
      if (silentPrimeTokenRef.current === token) {
        isPrimingSilentRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unlockOnce = () => {
      primeAudioElementInternal();
      if (isQuranAudioUnlockedRef.current) {
        document.removeEventListener('pointerdown', unlockOnce, true);
        document.removeEventListener('touchstart', unlockOnce, true);
        document.removeEventListener('keydown', unlockOnce, true);
      }
    };
    document.addEventListener('pointerdown', unlockOnce, { capture: true, passive: true });
    document.addEventListener('touchstart', unlockOnce, { capture: true, passive: true });
    document.addEventListener('keydown', unlockOnce, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', unlockOnce, true);
      document.removeEventListener('touchstart', unlockOnce, true);
      document.removeEventListener('keydown', unlockOnce, true);
    };
  }, [primeAudioElementInternal]);

  const currentTrack = playlist[currentIndex] || null;

  const startTrackOnAudioElement = useCallback(
    (track: AudioTrackItem, idx: number, shouldPlay: boolean) => {
      const targetEl = audioRef.current;
      if (!targetEl) return;

      const attemptId = ++playAttemptIdRef.current;
      silentPrimeTokenRef.current += 1;
      isPrimingSilentRef.current = false;
      setAudioError(null);
      setProgress(0);
      setDuration(0);

      // Auto-cache next 12 tracks & prewarm up to 24 cached tracks in RAM as blob: URLs
      const autoFetchUrls: string[] = [];
      const prewarmUrls: string[] = [track.audioUrl];
      for (let offset = 1; offset <= 24; offset += 1) {
        const nextUrl = playlistRef.current[idx + offset]?.audioUrl;
        if (!nextUrl) continue;
        prewarmUrls.push(nextUrl);
        if (offset <= 12) autoFetchUrls.push(nextUrl);
      }
      prewarmUpcomingAudioUrls(prewarmUrls);
      const fastSrc = getFastPlayableAudioUrlSync(track.audioUrl);
      if (fastSrc === track.audioUrl) {
        autoFetchUrls.unshift(track.audioUrl);
      }
      if (autoFetchUrls.length > 0) {
        prefetchAndCacheAudioUrls(autoFetchUrls);
      }
      activeLoadedRemoteUrlRef.current = track.audioUrl;

      let resolvedFastSrc = fastSrc;
      try {
        if (typeof window !== 'undefined') {
          resolvedFastSrc = new URL(fastSrc, window.location.href).href;
        }
      } catch {
        resolvedFastSrc = fastSrc;
      }

      const needsSrcUpdate =
        targetEl.src !== resolvedFastSrc ||
        Boolean(targetEl.error) ||
        targetEl.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;

      if (needsSrcUpdate) {
        ignorePauseEventRef.current = true;
        targetEl.src = fastSrc;
        if (targetEl.error) {
          targetEl.load();
        }
      } else if (targetEl.ended) {
        targetEl.currentTime = 0;
      }

      setMediaSessionMetadata({
        title: track.titleBn,
        artist: track.subtitleBn,
        album: 'Daily Islamic Routine',
      });
      syncQuranMediaSessionRef.current();

      if (fastSrc === track.audioUrl) {
        void resolveAndPrewarmAudioUrl(track.audioUrl).then((resolved) => {
          if (
            resolved !== track.audioUrl &&
            attemptId === playAttemptIdRef.current &&
            targetEl === audioRef.current &&
            targetEl.error &&
            isPlayingRef.current
          ) {
            ignorePauseEventRef.current = true;
            targetEl.src = resolved;
            targetEl.play().catch(() => {});
          }
        });
      }

      if (shouldPlay) {
        audioKeepAlive.acquire('quran');
        audioKeepAlive.pulse();
        setMediaSessionPlaybackState('playing');
        setAudioStatus('loading');
        targetEl
          .play()
          .then(() => {
            if (attemptId !== playAttemptIdRef.current) return;
            isQuranAudioUnlockedRef.current = true;
            ignorePauseEventRef.current = false;
            screenOffResumeCountRef.current = 0;
            setAudioStatus('playing');
          })
          .catch((err: unknown) => {
            if (attemptId !== playAttemptIdRef.current) return;
            const errName =
              err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
            if (errName === 'AbortError') return;
            if (errName === 'NotAllowedError') {
              ignorePauseEventRef.current = false;
              audioKeepAlive.release('quran');
              isPlayingRef.current = false;
              setIsPlaying(false);
              setAudioStatus('paused');
              setMediaSessionPlaybackState('paused');
              setAudioError('অডিও চালু করতে প্লে বাটনে আবার ট্যাপ করুন');
              return;
            }
            // Keep ignorePauseEventRef true & delegate to unified recovery/fallback pipeline
            recoverAudioErrorRef.current(attemptId);
          });
      } else {
        ignorePauseEventRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    const audio = getActiveAudio();
    if (!audio || !currentTrack) return;

    if (activeLoadedRemoteUrlRef.current === currentTrack.audioUrl) {
      setMediaSessionMetadata({
        title: currentTrack.titleBn,
        artist: currentTrack.subtitleBn,
        album: 'Daily Islamic Routine',
      });
      return;
    }

    startTrackOnAudioElement(currentTrack, currentIndex, isPlayingRef.current);
  }, [currentTrack, currentIndex, getActiveAudio, startTrackOnAudioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const pauseForAutoplayBlock = () => {
      ignorePauseEventRef.current = false;
      audioKeepAlive.release('quran');
      isPlayingRef.current = false;
      setIsPlaying(false);
      setAudioStatus('paused');
      setMediaSessionPlaybackState('paused');
      setAudioError('অডিও চালু করতে প্লে বাটনে আবার ট্যাপ করুন');
    };

    const advanceOrError = (attemptId: number) => {
      if (attemptId !== playAttemptIdRef.current) return;
      const list = playlistRef.current;
      const curIdx = currentIndexRef.current;
      consecutiveErrorsRef.current += 1;
      if (
        consecutiveErrorsRef.current < 3 &&
        curIdx < list.length - 1 &&
        isPlayingRef.current
      ) {
        const nextIdx = curIdx + 1;
        const nextTrack = list[nextIdx];
        if (nextTrack) {
          setAudioError('এই আয়াতের অডিও লোড করা যায়নি, পরবর্তী আয়াতে যাওয়া হচ্ছে...');
          currentIndexRef.current = nextIdx;
          startTrackOnAudioElement(nextTrack, nextIdx, true);
          setCurrentIndex(nextIdx);
          return;
        }
      }
      ignorePauseEventRef.current = false;
      setAudioError('অডিও লোড করা যাচ্ছে না। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
      audioKeepAlive.release('quran');
      isPlayingRef.current = false;
      setIsPlaying(false);
      setAudioStatus('error');
      setMediaSessionPlaybackState('paused');
    };

    const tryFallbackOrAdvance = (attemptId: number) => {
      if (attemptId !== playAttemptIdRef.current || audioRef.current !== audio) return;
      if (!isPlayingRef.current) return;
      const list = playlistRef.current;
      const curTrack = list[currentIndexRef.current];
      const fbUrl = curTrack?.fallbackAudioUrl;
      if (
        fbUrl &&
        fbUrl !== curTrack.audioUrl &&
        fallbackErrorAttemptRef.current !== attemptId
      ) {
        fallbackErrorAttemptRef.current = attemptId;
        resolvingErrorAttemptRef.current = attemptId;
        ignorePauseEventRef.current = true;
        audio.src = getFastPlayableAudioUrlSync(fbUrl);
        audio
          .play()
          .then(() => {
            if (resolvingErrorAttemptRef.current === attemptId) {
              resolvingErrorAttemptRef.current = -1;
            }
          })
          .catch((err: unknown) => {
            const errName =
              err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
            if (errName === 'AbortError') return;
            if (errName === 'NotAllowedError') {
              if (resolvingErrorAttemptRef.current === attemptId) {
                resolvingErrorAttemptRef.current = -1;
              }
              pauseForAutoplayBlock();
              return;
            }
            void resolveAndPrewarmAudioUrl(fbUrl, true).then((resolvedFb) => {
              if (resolvingErrorAttemptRef.current === attemptId) {
                resolvingErrorAttemptRef.current = -1;
              }
              if (attemptId !== playAttemptIdRef.current || audioRef.current !== audio) {
                return;
              }
              if (!isPlayingRef.current) return;
              if (resolvedFb !== fbUrl) {
                ignorePauseEventRef.current = true;
                audio.src = resolvedFb;
                audio.play().catch((fbErr: unknown) => {
                  const fbErrName =
                    fbErr && typeof fbErr === 'object'
                      ? (fbErr as { name?: string }).name
                      : undefined;
                  if (fbErrName === 'AbortError') return;
                  if (fbErrName === 'NotAllowedError') {
                    pauseForAutoplayBlock();
                    return;
                  }
                  advanceOrError(attemptId);
                });
                return;
              }
              advanceOrError(attemptId);
            });
          });
        return;
      }
      advanceOrError(attemptId);
    };

    const recoverAudioError = (attemptId: number) => {
      if (attemptId !== playAttemptIdRef.current || audioRef.current !== audio) return;
      if (resolvingErrorAttemptRef.current === attemptId) return;
      const list = playlistRef.current;
      if (list.length === 0 || !isPlayingRef.current) return;
      const curTrack = list[currentIndexRef.current];

      if (
        curTrack &&
        audio.src.startsWith('blob:') &&
        curTrack.audioUrl &&
        blobRetryAttemptRef.current !== attemptId
      ) {
        blobRetryAttemptRef.current = attemptId;
        invalidateResolvedAudioUrl(curTrack.audioUrl);
        ignorePauseEventRef.current = true;
        audio.src = curTrack.audioUrl;
        audio.play().catch((err: unknown) => {
          const errName =
            err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
          if (errName === 'AbortError') return;
          if (errName === 'NotAllowedError') {
            pauseForAutoplayBlock();
            return;
          }
          recoverAudioError(attemptId);
        });
        return;
      }

      if (
        curTrack &&
        curTrack.audioUrl &&
        offlineErrorAttemptRef.current !== attemptId
      ) {
        offlineErrorAttemptRef.current = attemptId;
        resolvingErrorAttemptRef.current = attemptId;
        void resolveAndPrewarmAudioUrl(curTrack.audioUrl, true).then((resolved) => {
          if (resolvingErrorAttemptRef.current === attemptId) {
            resolvingErrorAttemptRef.current = -1;
          }
          if (attemptId !== playAttemptIdRef.current || audioRef.current !== audio) {
            return;
          }
          if (!isPlayingRef.current) return;
          if (resolved !== curTrack.audioUrl) {
            ignorePauseEventRef.current = true;
            audio.src = resolved;
            audio.play().catch((err: unknown) => {
              const errName =
                err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
              if (errName === 'AbortError') return;
              if (errName === 'NotAllowedError') {
                pauseForAutoplayBlock();
                return;
              }
              tryFallbackOrAdvance(attemptId);
            });
            return;
          }
          tryFallbackOrAdvance(attemptId);
        });
        return;
      }

      tryFallbackOrAdvance(attemptId);
    };

    recoverAudioErrorRef.current = recoverAudioError;

    const handleLoadStart = () => {
      if (isPrimingSilentRef.current) return;
      if (isPlayingRef.current) setAudioStatus('loading');
    };
    const handleWaiting = () => {
      if (isPrimingSilentRef.current) return;
      if (isPlayingRef.current) setAudioStatus('loading');
    };
    const handlePlaying = () => {
      if (isPrimingSilentRef.current) return;
      isQuranAudioUnlockedRef.current = true;
      ignorePauseEventRef.current = false;
      consecutiveErrorsRef.current = 0;
      screenOffResumeCountRef.current = 0;
      isPlayingRef.current = true;
      audioKeepAlive.acquire('quran');
      setIsPlaying(true);
      setAudioStatus('playing');
      setAudioError(null);
      setMediaSessionPlaybackState('playing');
    };
    const handlePause = () => {
      if (isPrimingSilentRef.current) return;
      if (!audio.ended && audio.paused && !ignorePauseEventRef.current) {
        const isHidden =
          typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (
          isHidden &&
          isPlayingRef.current &&
          Date.now() - userPausedQuranAtRef.current > 1500 &&
          Date.now() - lastVisibilityHiddenAtRef.current < 2500 &&
          screenOffResumeCountRef.current < 2
        ) {
          screenOffResumeCountRef.current += 1;
          audioKeepAlive.pulse();
          void audio.play().catch((err: unknown) => {
            const errName =
              err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
            if (errName === 'AbortError') return;
            pauseForAutoplayBlock();
          });
          return;
        }
        isPlayingRef.current = false;
        audioKeepAlive.release('quran');
        setIsPlaying(false);
        setAudioStatus(playlistRef.current.length > 0 ? 'paused' : 'idle');
        if (
          playlistRef.current.length > 0 &&
          speechPlayer.getSnapshot().status !== 'playing'
        ) {
          setMediaSessionPlaybackState('paused');
        }
      }
    };
    const handleTimeUpdate = () => {
      if (isPrimingSilentRef.current) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;
      setProgress(cur);
      setDuration(dur);
      const now = Date.now();
      if (dur > 0 && now - lastMediaPosSyncRef.current >= 900) {
        lastMediaPosSyncRef.current = now;
        updateMediaSessionPosition(dur, cur, audio.playbackRate || 1);
      }
    };
    const handleLoadedMetadata = () => {
      if (isPrimingSilentRef.current) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;
      setProgress(cur);
      setDuration(dur);
      if (dur > 0) {
        lastMediaPosSyncRef.current = Date.now();
        updateMediaSessionPosition(dur, cur, audio.playbackRate || 1);
      }
    };
    const handleEnded = () => {
      if (isPrimingSilentRef.current) return;
      const list = playlistRef.current;
      const curIdx = currentIndexRef.current;
      if (curIdx < list.length - 1) {
        const nextIdx = curIdx + 1;
        const nextTrack = list[nextIdx];
        currentIndexRef.current = nextIdx;
        isPlayingRef.current = true;
        startTrackOnAudioElement(nextTrack, nextIdx, true);
        setCurrentIndex(nextIdx);
      } else if (isLoopingRef.current && list.length > 0) {
        const nextTrack = list[0];
        currentIndexRef.current = 0;
        isPlayingRef.current = true;
        startTrackOnAudioElement(nextTrack, 0, true);
        setCurrentIndex(0);
      } else {
        audioKeepAlive.release('quran');
        isPlayingRef.current = false;
        setIsPlaying(false);
        setAudioStatus('paused');
        setMediaSessionPlaybackState('paused');
      }
    };
    const handleError = () => {
      if (isPrimingSilentRef.current) return;
      recoverAudioError(playAttemptIdRef.current);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      recoverAudioErrorRef.current = () => {};
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [startTrackOnAudioElement]);

  const buildBismillahTrackForSurah = useCallback(
    (surahNum: number, targetAyahNum: number, isBanglaMode = false): AudioTrackItem => {
      const qari = selectedQariRef.current;
      const surahNameBn =
        ALL_SURAHS.find((s) => s.number === surahNum)?.nameBn || `সূরা ${surahNum}`;
      return {
        id: `bismillah-${isBanglaMode ? 'bntran-' : ''}${surahNum}-${targetAyahNum}-${Date.now()}`,
        titleBn: 'বিসমিল্লাহির রাহমানির রাহীম',
        subtitleBn: `সূরা ${surahNameBn} · ${qari.nameBn}`,
        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        meaningBn: 'পরম করুণাময় অসীম দয়ালু আল্লাহর নামে শুরু করছি',
        audioUrl: buildEveryAyahUrl(qari.everyAyahFolder, 1, 1),
        fallbackAudioUrl: buildIslamicNetworkFallbackUrl(qari.alquranCloudEdition, 1, 1),
        surah: surahNum,
        ayah: 0,
      };
    },
    []
  );

  const shouldPrependBismillah = useCallback(
    (target: AudioTrackItem, sourceTab: 'quran' | 'ruqyah'): boolean => {
      if (sourceTab !== 'quran') return false;
      if (
        typeof target.surah !== 'number' ||
        typeof target.ayah !== 'number' ||
        target.ayah < 1
      ) {
        return false;
      }
      if (target.id.startsWith('bn-quran-') || target.id.startsWith('bismillah-')) {
        return false;
      }
      // Surah Al-Fatihah Ayah 1 IS already Bismillah
      if (target.surah === 1 && target.ayah === 1) {
        needsReturnBismillahRef.current = false;
        try {
          localStorage.removeItem(NEEDS_RETURN_BISMILLAH_KEY);
        } catch {
          // ignore
        }
        return false;
      }
      // Surah At-Tawbah never starts with Bismillah
      if (target.surah === 9 && target.ayah === 1) {
        return false;
      }

      const isSurahBeginning = target.ayah === 1 && target.surah !== 1 && target.surah !== 9;
      const isDueAfterReturn = needsReturnBismillahRef.current && target.surah !== 9;

      if (isSurahBeginning || isDueAfterReturn) {
        needsReturnBismillahRef.current = false;
        try {
          localStorage.removeItem(NEEDS_RETURN_BISMILLAH_KEY);
        } catch {
          // ignore
        }
        return true;
      }
      return false;
    },
    []
  );

  const handleTogglePlay = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio || !currentTrack) return;

    if (isPlayingRef.current) {
      userPausedQuranAtRef.current = Date.now();
      ignorePauseEventRef.current = false;
      audio.pause();
      audioKeepAlive.release('quran');
      isPlayingRef.current = false;
      setIsPlaying(false);
      setAudioStatus('paused');
      setMediaSessionPlaybackState('paused');
    } else {
      speechPlayer.stop();
      screenOffResumeCountRef.current = 0;
      audioKeepAlive.acquire('quran');
      setAudioError(null);
      isPlayingRef.current = true;
      setIsPlaying(true);

      const curIdx = currentIndexRef.current;
      const sourceTab = playbackSourceTabRef.current || 'quran';
      if (
        sourceTab === 'quran' &&
        shouldPrependBismillah(currentTrack, 'quran') &&
        typeof currentTrack.surah === 'number' &&
        typeof currentTrack.ayah === 'number'
      ) {
        const bismillahTrack = buildBismillahTrackForSurah(
          currentTrack.surah,
          currentTrack.ayah,
          currentTrack.id.startsWith('bntran-')
        );
        const curList = playlistRef.current;
        const nextList = [
          ...curList.slice(0, curIdx),
          bismillahTrack,
          ...curList.slice(curIdx),
        ];
        playlistRef.current = nextList;
        currentIndexRef.current = curIdx;
        setPlaylist(nextList);
        setCurrentIndex(curIdx);
        startTrackOnAudioElement(bismillahTrack, curIdx, true);
        return;
      }

      if (
        audio.error ||
        !audio.src ||
        audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
      ) {
        startTrackOnAudioElement(currentTrack, currentIndexRef.current, true);
        return;
      }

      const attemptId = ++playAttemptIdRef.current;
      ignorePauseEventRef.current = false;
      setAudioStatus('loading');
      setMediaSessionMetadata({
        title: currentTrack.titleBn,
        artist: currentTrack.subtitleBn,
        album: 'Daily Islamic Routine',
      });
      setMediaSessionPlaybackState('playing');
      audio
        .play()
        .then(() => {
          if (attemptId !== playAttemptIdRef.current) return;
          isQuranAudioUnlockedRef.current = true;
          setAudioStatus('playing');
        })
        .catch((err: unknown) => {
          if (attemptId !== playAttemptIdRef.current) return;
          const errName =
            err && typeof err === 'object' ? (err as { name?: string }).name : undefined;
          if (errName === 'AbortError') return;
          if (errName === 'NotAllowedError') {
            audioKeepAlive.release('quran');
            setAudioError('অডিও চালু করতে প্লে বাটনে আবার ট্যাপ করুন');
            isPlayingRef.current = false;
            setIsPlaying(false);
            setAudioStatus('paused');
            setMediaSessionPlaybackState('paused');
            return;
          }
          recoverAudioErrorRef.current(attemptId);
        });
    }
  }, [
    buildBismillahTrackForSurah,
    currentTrack,
    getActiveAudio,
    shouldPrependBismillah,
    startTrackOnAudioElement,
  ]);

  const handlePrimeAudio = useCallback(() => {
    audioKeepAlive.acquire('quran');
    primeAudioElementInternal();
  }, [primeAudioElementInternal]);

  const handlePlayPlaylist = useCallback(
    (tracks: AudioTrackItem[], startIndex: number, _openVisual = false) => {
      if (tracks.length === 0) return;
      consecutiveErrorsRef.current = 0;
      speechPlayer.stop();
      audioKeepAlive.acquire('quran');
      setAudioError(null);
      const safeIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
      const requestedTarget = tracks[safeIndex] || tracks[0];
      const sourceTab: 'quran' | 'ruqyah' =
        activeTabRef.current === 'ruqyah' ? 'ruqyah' : 'quran';

      let finalTracks = tracks;
      let target = requestedTarget;
      if (
        shouldPrependBismillah(requestedTarget, sourceTab) &&
        typeof requestedTarget.surah === 'number' &&
        typeof requestedTarget.ayah === 'number'
      ) {
        const bismillahTrack = buildBismillahTrackForSurah(
          requestedTarget.surah,
          requestedTarget.ayah,
          requestedTarget.id.startsWith('bntran-')
        );
        finalTracks = [
          ...tracks.slice(0, safeIndex),
          bismillahTrack,
          ...tracks.slice(safeIndex),
        ];
        target = bismillahTrack;
      }

      playlistRef.current = finalTracks;
      currentIndexRef.current = safeIndex;
      isPlayingRef.current = true;
      setPlaylist(finalTracks);
      setCurrentIndex(safeIndex);
      setIsPlaying(true);
      setAudioStatus('loading');
      setPlaybackSourceTab(sourceTab);

      if (sourceTab === 'quran') {
        const qs = quranReaderStateRef.current;
        setAudioSourceContext({
          tab: 'quran',
          viewMode: qs.viewMode,
          surahNum: target.surah || qs.selectedSurahNum,
        });
      } else {
        const rs = ruqyahReaderStateRef.current;
        setAudioSourceContext({
          tab: 'ruqyah',
          subTab: rs.subTab,
          ruqyahId: rs.selectedRuqyahId,
          manzilOpen: rs.manzilReaderOpen,
          manzilGroup: rs.manzilGroupFilter,
        });
      }

      startTrackOnAudioElement(target, safeIndex, true);
    },
    [
      buildBismillahTrackForSurah,
      shouldPrependBismillah,
      startTrackOnAudioElement,
    ]
  );

  const handlePrev = useCallback(() => {
    const nextIdx = Math.max(0, currentIndexRef.current - 1);
    const target = playlistRef.current[nextIdx];
    currentIndexRef.current = nextIdx;
    isPlayingRef.current = true;
    setCurrentIndex(nextIdx);
    setIsPlaying(true);
    setAudioStatus('loading');
    if (target) {
      startTrackOnAudioElement(target, nextIdx, true);
    }
  }, [startTrackOnAudioElement]);

  const handleNext = useCallback(() => {
    const nextIdx = Math.min(playlistRef.current.length - 1, currentIndexRef.current + 1);
    const target = playlistRef.current[nextIdx];
    currentIndexRef.current = nextIdx;
    isPlayingRef.current = true;
    setCurrentIndex(nextIdx);
    setIsPlaying(true);
    setAudioStatus('loading');
    if (target) {
      startTrackOnAudioElement(target, nextIdx, true);
    }
  }, [startTrackOnAudioElement]);

  const handleSeek = useCallback(
    (time: number) => {
      const audio = getActiveAudio();
      if (!audio) return;
      audio.currentTime = time;
      setProgress(time);
      if (audio.duration > 0) {
        lastMediaPosSyncRef.current = Date.now();
        updateMediaSessionPosition(audio.duration, time, audio.playbackRate || 1);
      }
    },
    [getActiveAudio]
  );

  const handleClosePlayer = useCallback(() => {
    userPausedQuranAtRef.current = Date.now();
    playAttemptIdRef.current += 1;
    ignorePauseEventRef.current = true;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    audioKeepAlive.release('quran');
    activeLoadedRemoteUrlRef.current = null;
    isPlayingRef.current = false;
    playlistRef.current = [];
    currentIndexRef.current = 0;
    setIsPlaying(false);
    setAudioStatus('idle');
    setIsPlayerExpanded(false);
    setPlaybackSourceTab(null);
    setAudioSourceContext(null);
    setPlaylist([]);
    setCurrentIndex(0);
    if (speechPlayer.getSnapshot().status === 'idle') {
      clearMediaSession();
    }
  }, []);

  const syncQuranMediaSessionHandlers = useCallback(() => {
    const list = playlistRef.current;
    if (list.length === 0) return;
    const idx = currentIndexRef.current;
    registerMediaSessionHandlers({
      onPlay: () => {
        if (!isPlayingRef.current) handleTogglePlay();
      },
      onPause: () => {
        userPausedQuranAtRef.current = Date.now();
        if (isPlayingRef.current) handleTogglePlay();
      },
      onPrev: idx > 0 ? handlePrev : undefined,
      onNext: idx < list.length - 1 ? handleNext : undefined,
      onSeekTo: handleSeek,
      onStop: () => {
        userPausedQuranAtRef.current = Date.now();
        handleClosePlayer();
      },
    });
  }, [handleTogglePlay, handlePrev, handleNext, handleSeek, handleClosePlayer]);

  syncQuranMediaSessionRef.current = syncQuranMediaSessionHandlers;

  useEffect(() => {
    if (playlist.length === 0) return;
    syncQuranMediaSessionHandlers();
  }, [playlist.length, currentIndex, isPlaying, syncQuranMediaSessionHandlers]);

  const activeTrackKey = currentTrack ? `${currentTrack.surah}:${currentTrack.ayah}` : null;

  const isAudioBarHidden = Boolean(
    playlist.length > 0 &&
      ((activeTab === 'quran' &&
        ((audioSourceContext?.tab === 'quran' &&
          audioSourceContext.viewMode === 'surah' &&
          quranReaderState.viewMode === 'surah' &&
          quranReaderState.readerOpen &&
          quranReaderState.selectedSurahNum === audioSourceContext.surahNum) ||
          (audioSourceContext?.tab === 'quran' &&
            audioSourceContext.viewMode === 'favorites' &&
            quranReaderState.viewMode === 'favorites') ||
          (!audioSourceContext &&
            quranReaderState.viewMode === 'surah' &&
            quranReaderState.readerOpen &&
            currentTrack?.surah === quranReaderState.selectedSurahNum))) ||
        (activeTab === 'ruqyah' &&
          ((ruqyahReaderState.subTab === 'ruqyah' &&
            Boolean(ruqyahReaderState.selectedRuqyahId) &&
            (!audioSourceContext ||
              (audioSourceContext.tab === 'ruqyah' &&
                audioSourceContext.subTab === 'ruqyah' &&
                audioSourceContext.ruqyahId === ruqyahReaderState.selectedRuqyahId))) ||
            (ruqyahReaderState.subTab === 'manzil' &&
              ruqyahReaderState.manzilReaderOpen &&
              (!audioSourceContext ||
                (audioSourceContext.tab === 'ruqyah' &&
                  audioSourceContext.subTab === 'manzil'))))))
  );

  const isSpeechDockHidden = Boolean(
    speechSnap.status !== 'idle' &&
      speechSnap.currentTrack &&
      !showDockVoicePicker &&
      ((activeTab === 'quran' &&
        speechSourceContext?.tab === 'quran' &&
        quranReaderState.viewMode === speechSourceContext.viewMode &&
        (speechSourceContext.viewMode === 'favorites' ||
          (quranReaderState.readerOpen &&
            quranReaderState.selectedSurahNum === speechSourceContext.surahNum))) ||
        (activeTab === 'hadith' &&
          speechSourceContext?.tab === 'hadith' &&
          hadithReaderState.selectedBookId === speechSourceContext.bookId &&
          hadithReaderState.selectedSectionNum === speechSourceContext.sectionNum) ||
        (activeTab === 'seerah' &&
          speechSourceContext?.tab === 'seerah' &&
          seerahReaderState.readerOpen &&
          seerahReaderState.selectedBook === speechSourceContext.selectedBook &&
          (seerahReaderState.selectedBook === 'full-book'
            ? seerahReaderState.selectedFullIdx === speechSourceContext.selectedFullIdx
            : seerahReaderState.selectedSeerahIdx === speechSourceContext.selectedSeerahIdx)) ||
        (activeTab === 'ruqyah' &&
          speechSourceContext?.tab === 'ruqyah' &&
          ruqyahReaderState.subTab === 'azkar' &&
          (ruqyahReaderState.selectedAzkarId === speechSourceContext.azkarId ||
            (speechSourceContext.azkarId === null &&
              ruqyahReaderState.hisnulChapter === speechSourceContext.azkarFilter))))
  );

  const handleJumpToAudioSource = useCallback(() => {
    if (audioSourceContext?.tab === 'quran' || playbackSourceTab === 'quran') {
      const targetViewMode =
        audioSourceContext?.tab === 'quran' ? audioSourceContext.viewMode : 'surah';
      const targetSurahNum =
        audioSourceContext?.tab === 'quran'
          ? audioSourceContext.surahNum
          : currentTrack?.surah;
      setQuranRouteIntent((prev) => ({
        viewMode: targetViewMode,
        surahNum: targetSurahNum,
        seq: (prev?.seq || 0) + 1,
      }));
      skipNextTabScrollRef.current = true;
      setActiveTab('quran');
      return;
    }

    if (audioSourceContext?.tab === 'ruqyah' || playbackSourceTab === 'ruqyah') {
      setRuqyahRouteIntent((prev) => ({
        subTab: audioSourceContext?.tab === 'ruqyah' ? audioSourceContext.subTab : 'ruqyah',
        azkarFilter: 'all',
        ruqyahId: audioSourceContext?.tab === 'ruqyah' ? audioSourceContext.ruqyahId : undefined,
        manzilOpen:
          audioSourceContext?.tab === 'ruqyah' ? audioSourceContext.manzilOpen : undefined,
        manzilGroup:
          audioSourceContext?.tab === 'ruqyah' ? audioSourceContext.manzilGroup : undefined,
        seq: (prev?.seq || 0) + 1,
      }));
      skipNextTabScrollRef.current = true;
      setActiveTab('ruqyah');
    }
  }, [audioSourceContext, playbackSourceTab, currentTrack]);

  const handleJumpToSpeechSource = useCallback(() => {
    if (!speechSourceContext) return;
    if (speechSourceContext.tab === 'quran') {
      setQuranRouteIntent((prev) => ({
        viewMode: speechSourceContext.viewMode,
        surahNum: speechSourceContext.surahNum,
        seq: (prev?.seq || 0) + 1,
      }));
      skipNextTabScrollRef.current = true;
      setActiveTab('quran');
    } else if (speechSourceContext.tab === 'hadith') {
      setHadithRouteIntent((prev) => ({
        bookId: speechSourceContext.bookId,
        sectionNum: speechSourceContext.sectionNum,
        seq: (prev?.seq || 0) + 1,
      }));
      setActiveTab('hadith');
    } else if (speechSourceContext.tab === 'seerah') {
      setSeerahRouteIntent((prev) => ({
        topTab: speechSourceContext.topTab,
        selectedBook: speechSourceContext.selectedBook,
        readerOpen: speechSourceContext.readerOpen,
        selectedFullIdx: speechSourceContext.selectedFullIdx,
        selectedSeerahIdx: speechSourceContext.selectedSeerahIdx,
        seq: (prev?.seq || 0) + 1,
      }));
      setActiveTab('seerah');
    } else if (speechSourceContext.tab === 'ruqyah') {
      setRuqyahRouteIntent((prev) => ({
        subTab: 'azkar',
        azkarFilter: speechSourceContext.azkarFilter,
        azkarId: speechSourceContext.azkarId,
        seq: (prev?.seq || 0) + 1,
      }));
      setActiveTab('ruqyah');
    }
  }, [speechSourceContext]);

  useEffect(() => {
    if (skipNextTabScrollRef.current) {
      skipNextTabScrollRef.current = false;
      return;
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }, [activeTab]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="bg-sanctuary-canvas min-h-screen text-[#0F1F1A] transition-colors dark:text-[#F0F5F3]">
      <audio ref={audioRef} playsInline preload="auto" />
      <OfflineIndicator />
      {/* Strict 3-Zone Frosted Glass Navigation Bar */}
      <header className="app-chrome-bar sticky top-0 z-30 border-b border-[#0D6E52]/10 bg-white/85 backdrop-blur-2xl transition-colors dark:border-[#E7C57B]/10 dark:bg-[#050E0C]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 md:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('routine');
            }}
            className="shrink-0 whitespace-nowrap bg-gradient-to-r from-[#063D34] to-[#0D6E52] bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-[#F6DC9B] dark:to-[#6EE7B7] md:text-xl"
          >
            Daily Islamic Routine
          </a>

          {/* Zone 2: 5 Single-Line Nav Links */}
          <nav aria-label="প্রধান নেভিগেশন" className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative shrink-0 whitespace-nowrap py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'text-[#063D34] dark:text-[#F6DC9B]'
                      : 'text-[#475A53] hover:text-[#0F1F1A] dark:text-[#9BB0A8] dark:hover:text-[#F0F5F3]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="activeNavLine"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#34B38A] to-[#E7C57B]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsTasbihOpen(true)}
              className="min-h-[40px] shrink-0 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#E7C57B] to-[#C8963E] px-4 py-2 text-xs font-bold text-[#041815] shadow-md shadow-[#D4A853]/15 transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              তাসবিহ কাউন্টার
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        className={`mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7 ${
          !isAudioBarHidden && playlist.length > 0
            ? isPlayerExpanded
              ? 'pb-60 md:pb-44'
              : 'pb-36 md:pb-24'
            : 'pb-24 md:pb-12'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'routine' && (
              <DailyRoutineView
                isDark={isDark}
                appTheme={appTheme}
                selectedCityId={selectedCityId}
                schedule={schedule}
                notificationsEnabled={appSettings.notificationsEnabled}
                onToggleTheme={handleCycleTheme}
                onChangeCityId={handleChangeCityId}
                onUseLocation={handleUseLocation}
                onToggleNotifications={handleToggleMasterNotification}
                onNavigateTab={setActiveTab}
                onOpenAmol={(subTab, azkarFilter = 'all') => {
                  setRuqyahRouteIntent((prev) => ({
                    subTab,
                    azkarFilter,
                    seq: (prev?.seq || 0) + 1,
                  }));
                  setActiveTab('ruqyah');
                  try {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } catch {
                    // ignore
                  }
                }}
                onOpenTasbih={() => setIsTasbihOpen(true)}
              />
            )}

            {activeTab === 'quran' && (
              <QuranView
                selectedQari={selectedQari}
                onChangeQari={handleChangeQari}
                activeTrackKey={activeTrackKey}
                activeTrackId={currentTrack?.id || null}
                isPlaying={isPlaying}
                settings={appSettings}
                favoriteAyahs={favoriteAyahs}
                favoriteGroups={favoriteGroups}
                onSaveAyahToGroups={handleSaveAyahToGroups}
                onCreateFavoriteGroup={handleCreateFavoriteGroup}
                onRenameFavoriteGroup={handleRenameFavoriteGroup}
                onDeleteFavoriteGroup={handleDeleteFavoriteGroup}
                onRemoveFavoriteAyah={handleRemoveFavoriteAyah}
                onUpdateSettings={handleUpdateSettings}
                onPlayPlaylist={handlePlayPlaylist}
                onTogglePlay={handleTogglePlay}
                routeIntent={quranRouteIntent}
                onReaderStateChange={setQuranReaderState}
              />
            )}

            {activeTab === 'hadith' && (
              <HadithView
                arabicFontSize={appSettings.arabicFontSize}
                onUpdateSettings={handleUpdateSettings}
                onNavigateTab={setActiveTab}
                routeIntent={hadithRouteIntent}
                onReaderStateChange={setHadithReaderState}
              />
            )}

            {activeTab === 'seerah' && (
              <SeerahView
                onNavigateTab={setActiveTab}
                routeIntent={seerahRouteIntent}
                onReaderStateChange={setSeerahReaderState}
              />
            )}

            {activeTab === 'ruqyah' && (
              <RuqyahAmolView
                selectedQari={selectedQari}
                audioStatus={audioStatus}
                activeTrackKey={activeTrackKey}
                activeTrackTitle={currentTrack?.titleBn}
                isPlaying={isPlaying}
                settings={appSettings}
                routeIntent={ruqyahRouteIntent}
                onChangeQari={handleChangeQari}
                onUpdateSettings={handleUpdateSettings}
                onPlayPlaylist={handlePlayPlaylist}
                onTogglePlay={handleTogglePlay}
                onPrimeAudio={handlePrimeAudio}
                onReaderStateChange={setRuqyahReaderState}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                appTheme={appTheme}
                selectedQari={selectedQari}
                selectedCityId={selectedCityId}
                isLooping={isLooping}
                settings={appSettings}
                prayers={schedule.prayers}
                notifPermission={permissionState}
                onChangeTheme={setAppTheme}
                onChangeQari={handleChangeQari}
                onChangeCityId={handleChangeCityId}
                onToggleLoop={() => setIsLooping((l) => !l)}
                onUpdateSettings={handleUpdateSettings}
                onToggleMasterNotification={handleToggleMasterNotification}
                onResetDefaults={handleResetSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Quiet Editorial Footer (Desktop) */}
      <footer className="app-chrome-bar hidden border-t border-[#0D6E52]/10 bg-white/70 py-6 text-xs text-[#475A53] backdrop-blur-md transition-colors dark:border-[#E7C57B]/10 dark:bg-[#050E0C]/80 dark:text-[#9BB0A8] md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <p>Daily Islamic Routine — নামাজ, কুরআন, সহীহ হাদিস ও রুকাইয়া শারইয়াহ</p>
          <p>দৈনন্দিন ইবাদত, তিলাওয়াত ও মাসনুন আমলের প্রশান্ত ডিজিটাল সঙ্গী</p>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="app-chrome-bar fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-6 border-t border-[#0D6E52]/15 bg-white/95 backdrop-blur-xl transition-colors dark:border-[#E7C57B]/15 dark:bg-[#050E0C]/95 md:hidden"
      >
        {[
          { id: 'routine' as ActiveTab, label: 'রুটিন', Icon: CalendarCheck },
          { id: 'quran' as ActiveTab, label: 'কুরআন', Icon: BookOpen },
          { id: 'hadith' as ActiveTab, label: 'হাদিস', Icon: BookText },
          { id: 'seerah' as ActiveTab, label: 'সীরাত', Icon: BookMarked },
          { id: 'ruqyah' as ActiveTab, label: 'রুকাইয়া', Icon: Shield },
          { id: 'settings' as ActiveTab, label: 'সেটিংস', Icon: Settings },
        ].map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-[#063D34] dark:text-[#F6DC9B]'
                  : 'text-[#475A53] dark:text-[#9BB0A8]'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* In-App Prayer & Routine Notification Toast */}
      <AnimatePresence>
        {inAppAlert && (
          <motion.div
            key={inAppAlert.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            aria-live="polite"
            className="fixed left-4 right-4 top-20 z-50 mx-auto max-w-md rounded-2xl border border-[#E7C57B]/50 bg-[#063D34]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4A853]/20 text-[#F6DC9B]">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#F6DC9B]">{inAppAlert.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#E2EFEA]">
                  {inAppAlert.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInAppAlert(null)}
                className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-[#CBE2DA] hover:bg-white/10 hover:text-white"
                aria-label="নোটিফিকেশন বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Sticky Audio Dock (Expandable In-Place, hidden inside active reader) */}
      <AudioPlayerBar
        playlist={playlist}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        audioStatus={audioStatus}
        isLooping={isLooping}
        isExpanded={isPlayerExpanded}
        appTheme={appTheme}
        progress={progress}
        duration={duration}
        errorMsg={audioError}
        favoriteAyahKeys={favoriteAyahs.map((f) => f.key)}
        hidden={isAudioBarHidden}
        canJumpToSource={Boolean(audioSourceContext || playbackSourceTab)}
        onJumpToSource={handleJumpToAudioSource}
        onToggleFavoriteTrack={(trackItem) => {
          const surahMeta =
            trackItem.titleBn.replace(/^সূরা\s+/, '').split('·')[0]?.trim() ||
            `সূরা ${trackItem.surah}`;
          handleToggleFavoriteAyah({
            key: `${trackItem.surah}:${trackItem.ayah}`,
            surah: trackItem.surah,
            ayah: trackItem.ayah,
            surahNameBn: surahMeta,
            arabic: trackItem.arabic || '',
            tajweedArabic: trackItem.tajweedArabic,
            bengaliTranslit: trackItem.bengaliTranslit,
            bengali: trackItem.meaningBn || '',
            english: trackItem.englishMeaning,
            savedAt: Date.now(),
          });
        }}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onToggleLoop={() => setIsLooping((l) => !l)}
        onSeek={handleSeek}
        onClosePlayer={handleClosePlayer}
        onSetExpanded={setIsPlayerExpanded}
      />

      {/* Digital Tasbih Modal */}
      <TasbihModal
        isOpen={isTasbihOpen}
        onClose={() => setIsTasbihOpen(false)}
        apiHijriParts={schedule.hijriParts}
      />

      {/* Floating Speech Narration Mini Dock (Hadith, Seerah, Azkar) */}
      {speechSnap.status !== 'idle' && speechSnap.currentTrack && !isSpeechDockHidden && (
        <div
          className={`fixed left-3 right-3 z-40 mx-auto max-w-xl rounded-2xl border border-[#E7C57B]/30 bg-[#063D34]/95 p-3 text-white shadow-2xl backdrop-blur-xl md:bottom-5 ${
            !isAudioBarHidden && playlist.length > 0 ? 'bottom-[136px] md:bottom-24' : 'bottom-[72px]'
          }`}
          role="region"
          aria-label="অডিও পঠন নিয়ন্ত্রণ"
        >
          {showDockVoicePicker && (
            <div className="mb-2.5 space-y-2.5 border-b border-white/15 pb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#F6DC9B]">
                  পঠন ভয়েস পরিবর্তন করুন
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowDockVoicePicker(false);
                    setActiveTab('settings');
                  }}
                  className="text-[11px] font-semibold text-[#CBE2DA] underline"
                >
                  বিস্তারিত সেটিংস
                </button>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold text-[#CBE2DA]">
                  আরবি কণ্ঠ (হাদিস ও দুআ)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ARABIC_VOICE_MODES.map((am) => {
                    const selected = speechSnap.voicePrefs.arabicMode === am.id;
                    return (
                      <button
                        key={am.id}
                        type="button"
                        onClick={() => {
                          speechPlayer.updateVoicePrefs({ arabicMode: am.id });
                        }}
                        className={`min-h-[30px] rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                          selected
                            ? 'border-[#F6DC9B] bg-[#F6DC9B] text-[#041D18]'
                            : 'border-white/15 bg-white/10 text-[#E5F2ED] hover:bg-white/20'
                        }`}
                      >
                        {am.shortLabelBn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold text-[#CBE2DA]">
                  বাংলা ও ইংরেজি কণ্ঠ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_PROFILES.map((vp) => {
                    const selected = speechSnap.voicePrefs.profile === vp.id;
                    return (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => {
                          speechPlayer.updateVoicePrefs({ profile: vp.id });
                        }}
                        className={`min-h-[30px] rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                          selected
                            ? 'border-[#F6DC9B] bg-[#F6DC9B] text-[#041D18]'
                            : 'border-white/15 bg-white/10 text-[#E5F2ED] hover:bg-white/20'
                        }`}
                      >
                        {vp.shortLabelBn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={speechSourceContext ? handleJumpToSpeechSource : undefined}
              disabled={!speechSourceContext}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-0.5 text-left transition-colors ${
                speechSourceContext
                  ? 'cursor-pointer hover:bg-white/10 active:scale-[0.99]'
                  : 'cursor-default'
              }`}
              aria-label={
                speechSourceContext
                  ? `${speechSnap.currentTrack.titleBn} — ওই পাঠে ফিরে যান`
                  : speechSnap.currentTrack.titleBn
              }
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4A853]/20 text-[#F6DC9B]">
                {speechSnap.status === 'playing' && speechSnap.isBuffering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-bold text-[#F6DC9B]">
                    {speechSnap.currentTrack.titleBn}
                  </p>
                  {speechSourceContext && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[#E7C57B]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F6DC9B]">
                      <span>যান</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-[#CBE2DA]">
                  {speechSnap.currentTrack.subtitleBn}
                  {speechSnap.tracks.length > 1 &&
                    ` · ${speechSnap.currentIndex + 1}/${speechSnap.tracks.length}`}
                </p>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setShowDockVoicePicker((v) => !v)}
                className={`flex h-9 items-center gap-1 rounded-xl border px-2 text-[11px] font-bold transition-colors ${
                  showDockVoicePicker
                    ? 'border-[#F6DC9B] bg-[#F6DC9B]/20 text-[#F6DC9B]'
                    : 'border-white/15 bg-white/10 text-[#E5F2ED] hover:bg-white/20'
                }`}
                aria-label="ভয়েস পরিবর্তন করুন"
              >
                <Mic className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {VOICE_PROFILES.find((v) => v.id === speechSnap.voicePrefs.profile)
                    ?.shortLabelBn || 'ভয়েস'}
                </span>
              </button>

              {speechSnap.tracks.length > 1 && (
                <button
                  type="button"
                  onClick={() => speechPlayer.prevTrack()}
                  disabled={speechSnap.currentIndex === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 disabled:opacity-35"
                  aria-label="পূর্ববর্তী"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => speechPlayer.togglePlayPause()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E7C57B] to-[#C8963E] text-[#041D18]"
                aria-label={speechSnap.status === 'playing' ? 'বিরতি' : 'চালু করুন'}
              >
                {speechSnap.status === 'playing' ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              {speechSnap.tracks.length > 1 && (
                <button
                  type="button"
                  onClick={() => speechPlayer.nextTrack()}
                  disabled={speechSnap.currentIndex >= speechSnap.tracks.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 disabled:opacity-35"
                  aria-label="পরবর্তী"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowDockVoicePicker(false);
                  speechPlayer.stop();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {audioError && isAudioBarHidden && (
        <div
          role="status"
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[#E7C57B]/40 bg-[#063D34] p-3.5 text-xs text-white shadow-xl"
        >
          <span>{audioError}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {currentTrack && !isPlaying && (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="rounded-lg bg-[#E7C57B] px-2.5 py-1 text-[11px] font-bold text-[#041D18]"
              >
                চালু করুন
              </button>
            )}
            <button
              type="button"
              onClick={() => setAudioError(null)}
              className="shrink-0 rounded-lg p-1 hover:bg-white/10"
              aria-label="বন্ধ করুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {speechSnap.noticeBn && (
        <div
          role="status"
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[#E7C57B]/40 bg-[#063D34] p-3.5 text-xs text-white shadow-xl"
        >
          <span>{speechSnap.noticeBn}</span>
          <button
            type="button"
            onClick={() => speechPlayer.clearNotice()}
            className="shrink-0 rounded-lg p-1 hover:bg-white/10"
            aria-label="বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
