import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  Bell,
  BookMarked,
  BookOpen,
  BookText,
  CalendarCheck,
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
import { CITY_PRESETS, QARI_RECITERS } from './data/islamicData';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('routine');
  const [ruqyahRouteIntent, setRuqyahRouteIntent] = useState<{
    subTab: 'ruqyah' | 'manzil' | 'azkar';
    azkarFilter: 'all' | 'morning' | 'evening';
    seq: number;
  } | null>(null);
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
  const [playlist, setPlaylist] = useState<AudioTrackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isVisualOpen, setIsVisualOpen] = useState<boolean>(false);
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

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const speechSnap = useSpeechPlayer();

  useEffect(() => {
    return speechPlayer.onBeforeStart(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        setIsPlaying(false);
        setAudioStatus('paused');
      }
    });
  }, []);

  const currentTrack = playlist[currentIndex] || null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setAudioError(null);
    setProgress(0);
    setDuration(0);

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
    }

    if (isPlaying) {
      setAudioStatus('loading');
      audio.play().catch(() => {
        setIsPlaying(false);
        setAudioStatus('paused');
        setAudioError('অডিও চালু করতে প্লে বাটনে আবার ট্যাপ করুন');
      });
    }
  }, [currentTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      if (isPlaying) setAudioStatus('loading');
    };
    const handleWaiting = () => {
      if (isPlaying) setAudioStatus('loading');
    };
    const handlePlaying = () => {
      setAudioStatus('playing');
      setAudioError(null);
    };
    const handlePause = () => {
      if (!audio.ended) {
        setAudioStatus(playlist.length > 0 ? 'paused' : 'idle');
      }
    };
    const handleTimeUpdate = () => {
      setProgress(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    };
    const handleEnded = () => {
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (isLooping && playlist.length > 0) {
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
        setAudioStatus('paused');
      }
    };
    const handleError = () => {
      setAudioStatus('error');
      setAudioError('এই আয়াতের অডিও লোড করা যায়নি, পরবর্তী আয়াতে যাওয়া হচ্ছে...');
      if (currentIndex < playlist.length - 1) {
        setTimeout(() => setCurrentIndex((i) => i + 1), 800);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [currentIndex, playlist.length, isLooping, isPlaying]);

  const handleTogglePlay = useCallback(() => {
      const audio = audioRef.current;
      if (!audio || !currentTrack) return;

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        setAudioStatus('paused');
      } else {
        speechPlayer.stop();
        setAudioError(null);
        setAudioStatus('loading');
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setAudioStatus('playing');
          })
          .catch(() => {
            setAudioError('অডিও স্ট্রিম সংযোগ করা যায়নি');
            setIsPlaying(false);
            setAudioStatus('error');
          });
      }
    }, [isPlaying, currentTrack]);

  const handlePlayPlaylist = useCallback(
    (tracks: AudioTrackItem[], startIndex: number, openVisual = false) => {
      if (tracks.length === 0) return;
      speechPlayer.stop();
      const target = tracks[startIndex] || tracks[0];
      setPlaylist(tracks);
      setCurrentIndex(startIndex);
      setIsPlaying(true);
      setAudioStatus('loading');
      if (openVisual) setIsVisualOpen(true);

      const audio = audioRef.current;
      if (audio) {
        audio.src = target.audioUrl;
        audio
          .play()
          .then(() => setAudioStatus('playing'))
          .catch(() => {
            setIsPlaying(false);
            setAudioStatus('paused');
          });
      }
    },
    []
  );

  const handleSelectTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= playlist.length) return;
      setCurrentIndex(index);
      setIsPlaying(true);
      setAudioStatus('loading');
    },
    [playlist.length]
  );

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setIsPlaying(true);
    setAudioStatus('loading');
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(playlist.length - 1, i + 1));
    setIsPlaying(true);
    setAudioStatus('loading');
  }, [playlist.length]);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setProgress(time);
  }, []);

  const handleClosePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setIsPlaying(false);
    setAudioStatus('idle');
    setIsVisualOpen(false);
    setPlaylist([]);
    setCurrentIndex(0);
  }, []);

  const activeTrackKey = currentTrack ? `${currentTrack.surah}:${currentTrack.ayah}` : null;

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }, [activeTab]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="bg-sanctuary-canvas min-h-screen text-[#0F1F1A] transition-colors dark:text-[#F0F5F3]">
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
          playlist.length > 0 ? 'pb-36 md:pb-24' : 'pb-24 md:pb-12'
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
              />
            )}

            {activeTab === 'hadith' && (
              <HadithView
                arabicFontSize={appSettings.arabicFontSize}
                onUpdateSettings={handleUpdateSettings}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'seerah' && (
              <SeerahView onNavigateTab={setActiveTab} />
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
                onOpenVisualPlayer={() => setIsVisualOpen(true)}
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

      {/* Persistent Audio Player + Visual Recitation Modal */}
      <AudioPlayerBar
        playlist={playlist}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        audioStatus={audioStatus}
        isLooping={isLooping}
        isVisualOpen={isVisualOpen}
        appTheme={appTheme}
        progress={progress}
        duration={duration}
        errorMsg={audioError}
        arabicFontSize={appSettings.arabicFontSize}
        tajweedColorCoding={appSettings.tajweedColorCoding}
        showArabic={appSettings.showArabic}
        showBengaliTransliteration={appSettings.showBengaliTransliteration}
        showBengaliTranslation={appSettings.showBengaliTranslation}
        showEnglishTranslation={appSettings.showEnglishTranslation}
        favoriteAyahKeys={favoriteAyahs.map((f) => f.key)}
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
        onSelectTrack={handleSelectTrack}
        onToggleLoop={() => setIsLooping((l) => !l)}
        onSeek={handleSeek}
        onClosePlayer={handleClosePlayer}
        onSetVisualOpen={setIsVisualOpen}
        onCycleTheme={handleCycleTheme}
      />

      {/* Digital Tasbih Modal */}
      <TasbihModal
        isOpen={isTasbihOpen}
        onClose={() => setIsTasbihOpen(false)}
        apiHijriParts={schedule.hijriParts}
      />

      {/* Floating Speech Narration Mini Dock (Hadith, Seerah, Azkar) */}
      {speechSnap.status !== 'idle' && speechSnap.currentTrack && (
        <div
          className={`fixed left-3 right-3 z-40 mx-auto max-w-xl rounded-2xl border border-[#E7C57B]/30 bg-[#063D34]/95 p-3 text-white shadow-2xl backdrop-blur-xl md:bottom-5 ${
            playlist.length > 0 ? 'bottom-[136px] md:bottom-24' : 'bottom-[72px]'
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
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4A853]/20 text-[#F6DC9B]">
                <Volume2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#F6DC9B]">
                  {speechSnap.currentTrack.titleBn}
                </p>
                <p className="truncate text-[11px] text-[#CBE2DA]">
                  {speechSnap.currentTrack.subtitleBn}
                  {speechSnap.tracks.length > 1 &&
                    ` · ${speechSnap.currentIndex + 1}/${speechSnap.tracks.length}`}
                </p>
              </div>
            </div>

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
