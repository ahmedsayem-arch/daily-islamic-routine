import type { AppThemeId, ArabicFontId } from '../types/islamic';

export interface AppThemeMeta {
  id: AppThemeId;
  labelBn: string;
  descBn: string;
  isDark: boolean;
  bgSwatch: string;
  accentSwatch: string;
  metaThemeColor: string;
}

export const APP_THEMES: AppThemeMeta[] = [
  {
    id: 'emerald',
    labelBn: 'সবুজ',
    descBn: 'গাঢ় সবুজ ও সোনালি রঙ',
    isDark: true,
    bgSwatch: '#0B241E',
    accentSwatch: '#D4A853',
    metaThemeColor: '#061512',
  },
  {
    id: 'daylight',
    labelBn: 'সাদা',
    descBn: 'পরিষ্কার সাদা ও সবুজ রঙ',
    isDark: false,
    bgSwatch: '#F6F8F7',
    accentSwatch: '#0D6E52',
    metaThemeColor: '#F6F8F7',
  },
  {
    id: 'tahajjud',
    labelBn: 'কালো',
    descBn: 'ডার্ক কালো · রাতের ইবাদত',
    isDark: true,
    bgSwatch: '#0B0F0E',
    accentSwatch: '#E7C57B',
    metaThemeColor: '#090C0B',
  },
  {
    id: 'cream',
    labelBn: 'ক্রিম',
    descBn: 'কুরআনের পাতার মতো উষ্ণ ক্রিম রঙ',
    isDark: false,
    bgSwatch: '#F7F0DF',
    accentSwatch: '#9A631D',
    metaThemeColor: '#F7F0DF',
  },
];

export function isThemeDark(theme: AppThemeId): boolean {
  return theme === 'emerald' || theme === 'tahajjud';
}

export interface ArabicFontOption {
  id: ArabicFontId;
  nameBn: string;
  descBn: string;
  cssFamily: string;
}

export const ARABIC_FONT_OPTIONS: ArabicFontOption[] = [
  {
    id: 'scheherazade',
    nameBn: 'Scheherazade New',
    descBn: 'মদিনা মুসহাফ স্টাইল · সবচেয়ে বেশি ব্যবহৃত',
    cssFamily: "'Scheherazade New', 'Amiri Quran', serif",
  },
  {
    id: 'amiri_quran',
    nameBn: 'Amiri Quran',
    descBn: 'কুরআন ও তাজবীদের জন্য বিশেষ উসমানি ফন্ট',
    cssFamily: "'Amiri Quran', 'Amiri', serif",
  },
  {
    id: 'noto_naskh',
    nameBn: 'Noto Naskh Arabic',
    descBn: 'আধুনিক, ঝকঝকে ও সহজে পঠনযোগ্য নসখ',
    cssFamily: "'Noto Naskh Arabic', 'Amiri', serif",
  },
  {
    id: 'lateef',
    nameBn: 'Lateef (নাস্তালিক ধরন)',
    descBn: 'বাংলাদেশ ও উপমহাদেশে প্রচলিত কোমল লিপি',
    cssFamily: "'Lateef', 'Scheherazade New', serif",
  },
];

export function getArabicFontCss(fontId: ArabicFontId): string {
  return (
    ARABIC_FONT_OPTIONS.find((f) => f.id === fontId)?.cssFamily ||
    ARABIC_FONT_OPTIONS[0].cssFamily
  );
}

export interface PlayerThemeTokens {
  rootBg: string;
  fallbackGradient: string;
  scrimOverlay: string;
  imageOpacity: string;
  latticeOpacity: string;
  topBar: string;
  topTitle: string;
  topSubtitle: string;
  iconBtn: string;
  stageCard: string;
  stageKicker: string;
  stageStatus: string;
  arabicText: string;
  translitText: string;
  meaningText: string;
  englishText: string;
  errorText: string;
  queueCard: string;
  queueHeaderBorder: string;
  queueHeaderTitle: string;
  queueHeaderMeta: string;
  queueTabContainer: string;
  queueTabActive: string;
  queueTabInactive: string;
  queueDivider: string;
  queueRowCurrent: string;
  queueRowNext: string;
  queueRowDone: string;
  queueRowDefault: string;
  queueRowHighlightLabel: string;
  queueRowMutedLabel: string;
  queueRowActionHint: string;
  emptyBtn: string;
  bottomControlsBar: string;
  scrubberTime: string;
  scrubberAccent: string;
  loopActive: string;
  loopInactive: string;
  controlBtn: string;
  playBtn: string;
  miniDock: string;
  miniTrackBg: string;
  miniTrackFill: string;
  miniIconBox: string;
  miniTitle: string;
  miniSubtitle: string;
  miniIconBtn: string;
  miniExpandBtn: string;
  wavePrimaryStroke: string;
  waveSecondaryStroke: string;
}

export function getPlayerThemeTokens(theme: AppThemeId): PlayerThemeTokens {
  switch (theme) {
    case 'cream':
      return {
        rootBg: 'bg-[#F6EBD4] text-[#24190E]',
        fallbackGradient: 'bg-gradient-to-br from-[#F9F0DD] via-[#F4E6CA] to-[#EBDCBA]',
        scrimOverlay: 'bg-gradient-to-b from-[#F6EBD4]/90 via-[#F6EBD4]/82 to-[#EFE0C1]/96',
        imageOpacity: 'opacity-8',
        latticeOpacity: 'opacity-45',
        topBar: 'border-[#B47625]/22 bg-[#FAF1DD]/90',
        topTitle: 'text-[#7C4D12]',
        topSubtitle: 'text-[#6A573F]',
        iconBtn:
          'border-[#B47625]/25 bg-[#FFFDF6] text-[#5C4120] hover:bg-[#F2E5CA]',
        stageCard:
          'border-[#B47625]/35 bg-gradient-to-br from-[#FFFDF7] via-[#FCF6E7] to-[#F7ECDA] shadow-[0_14px_38px_rgba(124,77,18,0.11)]',
        stageKicker: 'text-[#8C5815]',
        stageStatus: 'text-[#6A573F]',
        arabicText: 'text-[#1F150B]',
        translitText: 'text-[#8F5512]',
        meaningText: 'text-[#3A2B1B]',
        englishText: 'text-[#66543E]',
        errorText: 'text-amber-800',
        queueCard: 'border-[#B47625]/22 bg-[#FFFDF5]/92',
        queueHeaderBorder: 'border-[#B47625]/15',
        queueHeaderTitle: 'text-[#7C4D12]',
        queueHeaderMeta: 'text-[#6A573F]',
        queueTabContainer: 'bg-[#EFE2C6]',
        queueTabActive: 'bg-[#8C5815] text-white',
        queueTabInactive: 'text-[#5C4120] hover:text-[#24190E]',
        queueDivider: 'divide-[#B47625]/15',
        queueRowCurrent: 'bg-[#C8963E]/16 ring-1 ring-[#B47625]/45',
        queueRowNext: 'bg-[#F8EFE0] hover:bg-[#F1E4CB]',
        queueRowDone: 'opacity-65 hover:bg-[#F8EFE0] hover:opacity-95',
        queueRowDefault: 'hover:bg-[#F8EFE0]',
        queueRowHighlightLabel: 'text-[#8C5815]',
        queueRowMutedLabel: 'text-[#6A573F]',
        queueRowActionHint: 'text-[#7A664C]',
        emptyBtn: 'border-[#B47625]/40 bg-[#B47625]/10 text-[#7C4D12]',
        bottomControlsBar: 'border-[#B47625]/22 bg-[#FFFDF5]/95',
        scrubberTime: 'text-[#6A573F]',
        scrubberAccent: 'accent-[#9A631D]',
        loopActive: 'border-[#9A631D] bg-[#9A631D]/15 text-[#7C4D12]',
        loopInactive: 'border-[#B47625]/25 text-[#5C4120] hover:bg-[#F2E5CA]',
        controlBtn: 'border-[#B47625]/25 text-[#24190E] hover:bg-[#F2E5CA]',
        playBtn:
          'bg-gradient-to-br from-[#B47625] to-[#8C5815] text-white shadow-lg shadow-[#B47625]/25',
        miniDock: 'border-[#B47625]/25 bg-[#FFFBF0]/96 text-[#24190E]',
        miniTrackBg: 'bg-[#EDE0C4]',
        miniTrackFill: 'bg-gradient-to-r from-[#C8963E] to-[#8C5815]',
        miniIconBox:
          'bg-gradient-to-br from-[#B47625] to-[#8C5815] text-white ring-1 ring-[#B47625]/30',
        miniTitle: 'text-[#24190E]',
        miniSubtitle: 'text-[#6A573F]',
        miniIconBtn: 'text-[#5C4120] hover:bg-[#F2E5CA]',
        miniExpandBtn: 'text-[#8C5815] hover:bg-[#F2E5CA]',
        wavePrimaryStroke: 'rgba(180, 118, 37, 0.24)',
        waveSecondaryStroke: 'rgba(140, 88, 21, 0.16)',
      };

    case 'daylight':
      return {
        rootBg: 'bg-[#F4F7F5] text-[#0F1F1A]',
        fallbackGradient: 'bg-gradient-to-br from-[#F4F7F5] via-[#E8F1EC] to-[#DCEAE3]',
        scrimOverlay: 'bg-gradient-to-b from-[#F4F7F5]/92 via-[#F4F7F5]/86 to-[#E9F1ED]/96',
        imageOpacity: 'opacity-8',
        latticeOpacity: 'opacity-30',
        topBar: 'border-[#0D6E52]/15 bg-white/90',
        topTitle: 'text-[#063D34]',
        topSubtitle: 'text-[#475A53]',
        iconBtn:
          'border-[#0D6E52]/20 bg-white text-[#063D34] hover:bg-[#E7F0EC]',
        stageCard:
          'border-[#0D6E52]/25 bg-white shadow-[0_14px_38px_rgba(6,61,52,0.08)]',
        stageKicker: 'text-[#0D6E52]',
        stageStatus: 'text-[#475A53]',
        arabicText: 'text-[#0A1914]',
        translitText: 'text-[#0D6E52]',
        meaningText: 'text-[#1F352E]',
        englishText: 'text-[#475A53]',
        errorText: 'text-amber-700',
        queueCard: 'border-[#0D6E52]/15 bg-white/95',
        queueHeaderBorder: 'border-[#0D6E52]/10',
        queueHeaderTitle: 'text-[#063D34]',
        queueHeaderMeta: 'text-[#475A53]',
        queueTabContainer: 'bg-[#E5EFEA]',
        queueTabActive: 'bg-[#063D34] text-[#F6DC9B]',
        queueTabInactive: 'text-[#475A53] hover:text-[#0F1F1A]',
        queueDivider: 'divide-[#0D6E52]/10',
        queueRowCurrent: 'bg-[#0D6E52]/10 ring-1 ring-[#0D6E52]/35',
        queueRowNext: 'bg-[#F5FAF7] hover:bg-[#EAF3EE]',
        queueRowDone: 'opacity-65 hover:bg-[#F5FAF7] hover:opacity-95',
        queueRowDefault: 'hover:bg-[#F5FAF7]',
        queueRowHighlightLabel: 'text-[#0D6E52]',
        queueRowMutedLabel: 'text-[#475A53]',
        queueRowActionHint: 'text-[#5A7067]',
        emptyBtn: 'border-[#0D6E52]/30 bg-[#0D6E52]/10 text-[#063D34]',
        bottomControlsBar: 'border-[#0D6E52]/15 bg-white/95',
        scrubberTime: 'text-[#475A53]',
        scrubberAccent: 'accent-[#0D6E52]',
        loopActive: 'border-[#0D6E52] bg-[#0D6E52]/12 text-[#063D34]',
        loopInactive: 'border-[#0D6E52]/20 text-[#475A53] hover:bg-[#E7F0EC]',
        controlBtn: 'border-[#0D6E52]/20 text-[#0F1F1A] hover:bg-[#E7F0EC]',
        playBtn:
          'bg-gradient-to-br from-[#0D6E52] to-[#063D34] text-[#F6DC9B] shadow-lg shadow-[#0D6E52]/25',
        miniDock: 'border-[#0D6E52]/18 bg-white/96 text-[#0F1F1A]',
        miniTrackBg: 'bg-[#E2ECE7]',
        miniTrackFill: 'bg-gradient-to-r from-[#0D6E52] to-[#C8963E]',
        miniIconBox:
          'bg-gradient-to-br from-[#0D6E52] to-[#063D34] text-[#F6DC9B] ring-1 ring-[#0D6E52]/25',
        miniTitle: 'text-[#0F1F1A]',
        miniSubtitle: 'text-[#475A53]',
        miniIconBtn: 'text-[#475A53] hover:bg-[#E7F0EC]',
        miniExpandBtn: 'text-[#0D6E52] hover:bg-[#E7F0EC]',
        wavePrimaryStroke: 'rgba(13, 110, 82, 0.22)',
        waveSecondaryStroke: 'rgba(200, 150, 62, 0.20)',
      };

    case 'tahajjud':
      return {
        rootBg: 'bg-[#050807] text-[#F2F5F4]',
        fallbackGradient: 'bg-gradient-to-br from-[#0D1513] via-[#070B0A] to-[#020303]',
        scrimOverlay: 'bg-gradient-to-b from-[#050807]/90 via-[#050807]/82 to-[#050807]/96',
        imageOpacity: 'opacity-14',
        latticeOpacity: 'opacity-20',
        topBar: 'border-white/10 bg-[#080D0C]/85',
        topTitle: 'text-[#F6DC9B]',
        topSubtitle: 'text-[#9BA8A3]',
        iconBtn: 'border-white/15 bg-white/8 text-white hover:bg-white/16',
        stageCard:
          'border-[#E7C57B]/30 bg-gradient-to-br from-[#101816]/96 via-[#0A100E]/96 to-[#060908]/96 shadow-[0_20px_50px_rgba(0,0,0,0.65)]',
        stageKicker: 'text-[#F6DC9B]',
        stageStatus: 'text-[#9BA8A3]',
        arabicText: 'text-white drop-shadow-sm',
        translitText: 'text-[#6EE7B7]',
        meaningText: 'text-[#E3EBE8]',
        englishText: 'text-[#9BA8A3]',
        errorText: 'text-amber-300',
        queueCard: 'border-white/10 bg-[#080D0C]/90',
        queueHeaderBorder: 'border-white/10',
        queueHeaderTitle: 'text-[#F6DC9B]',
        queueHeaderMeta: 'text-[#9BA8A3]',
        queueTabContainer: 'bg-white/5',
        queueTabActive: 'bg-[#E7C57B] text-[#050807]',
        queueTabInactive: 'text-[#9BA8A3] hover:text-white',
        queueDivider: 'divide-white/8',
        queueRowCurrent: 'bg-[#E7C57B]/15 ring-1 ring-[#E7C57B]/40',
        queueRowNext: 'bg-white/[0.04] hover:bg-white/[0.08]',
        queueRowDone: 'opacity-55 hover:bg-white/[0.04] hover:opacity-90',
        queueRowDefault: 'hover:bg-white/[0.05]',
        queueRowHighlightLabel: 'text-[#F6DC9B]',
        queueRowMutedLabel: 'text-[#8C9994]',
        queueRowActionHint: 'text-[#9BA8A3]',
        emptyBtn: 'border-[#E7C57B]/35 bg-[#E7C57B]/10 text-[#F6DC9B]',
        bottomControlsBar: 'border-white/10 bg-[#060A09]/95',
        scrubberTime: 'text-[#9BA8A3]',
        scrubberAccent: 'accent-[#E7C57B]',
        loopActive: 'border-[#E7C57B] bg-[#E7C57B]/20 text-[#F6DC9B]',
        loopInactive: 'border-white/15 text-[#9BA8A3] hover:text-white',
        controlBtn: 'border-white/15 text-white hover:bg-white/10',
        playBtn:
          'bg-gradient-to-br from-[#E7C57B] to-[#C2923B] text-[#050807] shadow-lg shadow-[#E7C57B]/20',
        miniDock: 'border-white/12 bg-[#080D0C]/95 text-white',
        miniTrackBg: 'bg-white/10',
        miniTrackFill: 'bg-gradient-to-r from-[#C2923B] to-[#F6DC9B]',
        miniIconBox:
          'bg-[#13201C] text-[#F6DC9B] ring-1 ring-[#E7C57B]/25',
        miniTitle: 'text-white',
        miniSubtitle: 'text-[#9BA8A3]',
        miniIconBtn: 'text-[#C6D1CD] hover:bg-white/10',
        miniExpandBtn: 'text-[#F6DC9B] hover:bg-white/10',
        wavePrimaryStroke: 'rgba(231, 197, 123, 0.22)',
        waveSecondaryStroke: 'rgba(110, 231, 183, 0.14)',
      };

    case 'emerald':
    default:
      return {
        rootBg: 'bg-[#04241D] text-[#F0F5F3]',
        fallbackGradient: 'bg-gradient-to-br from-[#08473A] via-[#052D24] to-[#031A15]',
        scrimOverlay: 'bg-gradient-to-b from-[#04241D]/84 via-[#04241D]/72 to-[#031A15]/94',
        imageOpacity: 'opacity-25',
        latticeOpacity: 'opacity-40',
        topBar: 'border-[#E7C57B]/15 bg-[#052B23]/75',
        topTitle: 'text-[#F6DC9B]',
        topSubtitle: 'text-[#B5D2C8]',
        iconBtn: 'border-white/15 bg-white/10 text-white hover:bg-white/20',
        stageCard:
          'border-[#E7C57B]/45 bg-gradient-to-br from-[#0B4A3D]/94 via-[#073229]/95 to-[#05231C]/95 shadow-[0_20px_50px_rgba(2,20,16,0.48)]',
        stageKicker: 'text-[#F6DC9B]',
        stageStatus: 'text-[#B5D2C8]',
        arabicText: 'text-white drop-shadow-sm',
        translitText: 'text-[#6EE7B7]',
        meaningText: 'text-[#E5F2ED]',
        englishText: 'text-[#B5D2C8]',
        errorText: 'text-amber-300',
        queueCard: 'border-[#E7C57B]/15 bg-[#052720]/88',
        queueHeaderBorder: 'border-white/10',
        queueHeaderTitle: 'text-[#F6DC9B]',
        queueHeaderMeta: 'text-[#B5D2C8]',
        queueTabContainer: 'bg-black/30',
        queueTabActive: 'bg-[#0D6E52] text-[#F6DC9B]',
        queueTabInactive: 'text-[#B5D2C8] hover:text-white',
        queueDivider: 'divide-white/8',
        queueRowCurrent: 'bg-[#0D6E52]/38 ring-1 ring-[#E7C57B]/45',
        queueRowNext: 'bg-white/[0.05] hover:bg-white/[0.09]',
        queueRowDone: 'opacity-55 hover:bg-white/[0.04] hover:opacity-90',
        queueRowDefault: 'hover:bg-white/[0.05]',
        queueRowHighlightLabel: 'text-[#F6DC9B]',
        queueRowMutedLabel: 'text-[#95BDB0]',
        queueRowActionHint: 'text-[#A9C4BB]',
        emptyBtn: 'border-[#E7C57B]/35 bg-[#E7C57B]/10 text-[#F6DC9B]',
        bottomControlsBar: 'border-white/10 bg-[#04201A]/94',
        scrubberTime: 'text-[#B5D2C8]',
        scrubberAccent: 'accent-[#D4A853]',
        loopActive: 'border-[#D4A853] bg-[#D4A853]/20 text-[#E7C57B]',
        loopInactive: 'border-white/15 text-[#B5D2C8] hover:text-white',
        controlBtn: 'border-white/15 text-white hover:bg-white/10',
        playBtn:
          'bg-gradient-to-br from-[#D4A853] to-[#B08438] text-[#05120E] shadow-lg shadow-[#D4A853]/25',
        miniDock: 'border-[#E7C57B]/18 bg-[#063128]/95 text-white',
        miniTrackBg: 'bg-white/10',
        miniTrackFill: 'bg-gradient-to-r from-[#34B38A] to-[#D4A853]',
        miniIconBox:
          'bg-gradient-to-br from-[#0D6E52] to-[#084C39] text-[#E7C57B] ring-1 ring-[#D4A853]/30',
        miniTitle: 'text-white',
        miniSubtitle: 'text-[#B5D2C8]',
        miniIconBtn: 'text-[#D0E4DD] hover:bg-white/10',
        miniExpandBtn: 'text-[#E7C57B] hover:bg-white/10',
        wavePrimaryStroke: 'rgba(212, 168, 83, 0.26)',
        waveSecondaryStroke: 'rgba(52, 179, 138, 0.18)',
      };
  }
}
