import {
  computeLastThirdStart,
  computeSehriEndFromFajr,
  type PrayerScheduleResult,
} from '../services/islamicApi';
import type { AppSettings } from '../types/islamic';
import { formatTime12h } from './timeFormat';

export interface WaqtSlotItem {
  id: string;
  labelBn: string;
  rangeTextBn: string;
  subNoteBn?: string;
  isActive: boolean;
}

export interface ActiveWaqtStatus {
  activeId: string;
  activeTitleBn: string;
  activeRangeBn: string;
  remainingLabelBn: string;
  remainingCountdown: string;
  progressPct: number;
  nextTitleBn: string;
  nextRangeBn: string;
  nextStartsIn: string;
  tahajjudStart: string;
  sehriEnd: string;
  sunrise: string;
  iftarTime: string;
  slots: WaqtSlotItem[];
}

export interface ReminderScheduleItem {
  id: string;
  kind: 'prayer' | 'routine';
  labelBn: string;
  timeHHMM: string;
  time12Bn: string;
  enabled: boolean;
  leadNoteBn?: string;
  isNextUpcoming: boolean;
}

export function timeToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

export function secondsToHMS(diffSecs: number): string {
  const clamped = Math.max(0, Math.floor(diffSecs));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function addMinutesHHMM(hhmm: string, deltaMins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h || 0) * 60 + (m || 0) + deltaMins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function getActiveWaqtStatus(
  schedule: PrayerScheduleResult,
  now: Date
): ActiveWaqtStatus {
  const getT = (key: PrayerScheduleResult['prayers'][number]['key'], fallback: string) =>
    schedule.prayers.find((p) => p.key === key)?.time || fallback;

  const fajr = getT('Fajr', '05:02');
  const sunrise = getT('Sunrise', '06:18');
  const dhuhr = getT('Dhuhr', '11:52');
  const asr = getT('Asr', '15:36');
  const maghrib = getT('Maghrib', '17:24');
  const isha = getT('Isha', '18:42');

  const sehriEnd = schedule.imsakTime || computeSehriEndFromFajr(fajr);
  const tahajjudStart = schedule.tahajjudStart || computeLastThirdStart(maghrib, fajr);
  const duhaStart = addMinutesHHMM(sunrise, 15);
  const duhaEnd = addMinutesHHMM(dhuhr, -5);

  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const sTahajjud = timeToSeconds(tahajjudStart);
  const sSehriEnd = timeToSeconds(sehriEnd);
  const sFajr = timeToSeconds(fajr);
  const sSunrise = timeToSeconds(sunrise);
  const sDhuhr = timeToSeconds(dhuhr);
  const sAsr = timeToSeconds(asr);
  const sMaghrib = timeToSeconds(maghrib);
  const sIsha = timeToSeconds(isha);

  const daySecs = 24 * 3600;
  const spanBetween = (startS: number, endS: number, curS: number) => {
    const total = endS >= startS ? endS - startS : daySecs - startS + endS;
    const elapsed = curS >= startS ? curS - startS : daySecs - startS + curS;
    const rem = Math.max(0, total - elapsed);
    const pct = total > 0 ? Math.max(4, Math.min(98, Math.round((elapsed / total) * 100))) : 50;
    return { rem, pct };
  };

  let activeId = 'isha';
  let activeTitleBn = 'এশার ওয়াক্ত চলছে';
  let activeRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
  let remainingLabelBn = 'শেষ রাত / ফজরের আগে বাকি';
  let remainingCountdown = '00:00:00';
  let progressPct = 50;
  let nextTitleBn = 'তাহাজ্জুদ';
  let nextRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
  let nextStartsIn = '00:00:00';

  if (nowSecs >= sFajr && nowSecs < sSunrise) {
    activeId = 'fajr';
    const { rem, pct } = spanBetween(sFajr, sSunrise, nowSecs);
    activeTitleBn = 'ফজরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি (সূর্যোদয়)';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'যোহর';
    nextRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    nextStartsIn = secondsToHMS(sDhuhr - nowSecs);
  } else if (nowSecs >= sSunrise && nowSecs < sDhuhr) {
    activeId = 'duha';
    const { rem, pct } = spanBetween(sSunrise, sDhuhr, nowSecs);
    activeTitleBn = 'ইশরাক ও চাশতের সময়';
    activeRangeBn = `${formatTime12h(duhaStart)} হতে ${formatTime12h(duhaEnd)}`;
    remainingLabelBn = 'যোহর শুরু হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'যোহর';
    nextRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    nextStartsIn = secondsToHMS(sDhuhr - nowSecs);
  } else if (nowSecs >= sDhuhr && nowSecs < sAsr) {
    activeId = 'dhuhr';
    const { rem, pct } = spanBetween(sDhuhr, sAsr, nowSecs);
    activeTitleBn = 'যোহরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'আসর';
    nextRangeBn = `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (nowSecs >= sAsr && nowSecs < sMaghrib) {
    activeId = 'asr';
    const { rem, pct } = spanBetween(sAsr, sMaghrib, nowSecs);
    activeTitleBn = 'আসরের ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`;
    remainingLabelBn = 'ইফতার ও মাগরিবের বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'মাগরিব ও ইফতার';
    nextRangeBn = `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (nowSecs >= sMaghrib && nowSecs < sIsha) {
    activeId = 'maghrib';
    const { rem, pct } = spanBetween(sMaghrib, sIsha, nowSecs);
    activeTitleBn = 'মাগরিব ও ইফতারের সময় চলছে';
    activeRangeBn = `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`;
    remainingLabelBn = 'ওয়াক্ত শেষ হতে বাকি';
    remainingCountdown = secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'এশা';
    nextRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
    nextStartsIn = secondsToHMS(rem);
  } else if (
    (sTahajjud < sFajr && nowSecs >= sTahajjud && nowSecs < sFajr) ||
    (sTahajjud > sIsha && (nowSecs >= sTahajjud || nowSecs < sFajr))
  ) {
    activeId = 'tahajjud';
    const { rem, pct } = spanBetween(sTahajjud, sFajr, nowSecs);
    const toSehri = nowSecs <= sSehriEnd ? sSehriEnd - nowSecs : daySecs - nowSecs + sSehriEnd;
    activeTitleBn = 'তাহাজ্জুদ ও সেহরির সময় চলছে';
    activeRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
    remainingLabelBn =
      nowSecs < sSehriEnd
        ? `সেহরির শেষ (${formatTime12h(sehriEnd)}) পর্যন্ত বাকি`
        : 'ফজর শুরু হতে বাকি';
    remainingCountdown = nowSecs < sSehriEnd ? secondsToHMS(toSehri) : secondsToHMS(rem);
    progressPct = pct;
    nextTitleBn = 'ফজর';
    nextRangeBn = `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`;
    nextStartsIn = secondsToHMS(rem);
  } else {
    activeId = 'isha';
    const { rem, pct } = spanBetween(sIsha, sFajr, nowSecs);
    const toTahajjud =
      sTahajjud >= nowSecs ? sTahajjud - nowSecs : daySecs - nowSecs + sTahajjud;
    activeTitleBn = 'এশার ওয়াক্ত চলছে';
    activeRangeBn = `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`;
    remainingLabelBn = 'তাহাজ্জুদ শুরু হতে বাকি';
    remainingCountdown = secondsToHMS(toTahajjud);
    progressPct = pct;
    nextTitleBn = 'তাহাজ্জুদ';
    nextRangeBn = `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`;
    nextStartsIn = secondsToHMS(rem > 0 ? toTahajjud : 0);
  }

  const slots: WaqtSlotItem[] = [
    {
      id: 'tahajjud',
      labelBn: 'তাহাজ্জুদ',
      rangeTextBn: `${formatTime12h(tahajjudStart)} হতে ${formatTime12h(fajr)}`,
      subNoteBn: 'শেষ তৃতীয়াংশ',
      isActive: activeId === 'tahajjud',
    },
    {
      id: 'sehri',
      labelBn: 'সেহরির শেষ সময়',
      rangeTextBn: `${formatTime12h(sehriEnd)} পর্যন্ত`,
      subNoteBn: `ফজর শুরু ${formatTime12h(fajr)}`,
      isActive: activeId === 'tahajjud' && nowSecs < sSehriEnd,
    },
    {
      id: 'fajr',
      labelBn: 'ফজর',
      rangeTextBn: `${formatTime12h(fajr)} হতে ${formatTime12h(sunrise)}`,
      subNoteBn: `সূর্যোদয় ${formatTime12h(sunrise)}`,
      isActive: activeId === 'fajr',
    },
    {
      id: 'dhuhr',
      labelBn: 'যোহর',
      rangeTextBn: `${formatTime12h(dhuhr)} হতে ${formatTime12h(asr)}`,
      isActive: activeId === 'dhuhr',
    },
    {
      id: 'asr',
      labelBn: 'আসর',
      rangeTextBn: `${formatTime12h(asr)} হতে ${formatTime12h(maghrib)}`,
      isActive: activeId === 'asr',
    },
    {
      id: 'iftar',
      labelBn: 'ইফতারের সময়',
      rangeTextBn: `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`,
      subNoteBn: `ইফতার শুরু ${formatTime12h(maghrib)}`,
      isActive: activeId === 'maghrib',
    },
    {
      id: 'maghrib',
      labelBn: 'মাগরিব',
      rangeTextBn: `${formatTime12h(maghrib)} হতে ${formatTime12h(isha)}`,
      isActive: activeId === 'maghrib',
    },
    {
      id: 'isha',
      labelBn: 'ইশা',
      rangeTextBn: `${formatTime12h(isha)} হতে ${formatTime12h(fajr)}`,
      subNoteBn: `তাহাজ্জুদ শুরু ${formatTime12h(tahajjudStart)}`,
      isActive: activeId === 'isha',
    },
  ];

  return {
    activeId,
    activeTitleBn,
    activeRangeBn,
    remainingLabelBn,
    remainingCountdown,
    progressPct,
    nextTitleBn,
    nextRangeBn,
    nextStartsIn,
    tahajjudStart,
    sehriEnd,
    sunrise,
    iftarTime: maghrib,
    slots,
  };
}

export function getWidgetReminderSummary(
  schedule: PrayerScheduleResult,
  settings: AppSettings,
  now: Date
): {
  items: ReminderScheduleItem[];
  nextUpcoming: ReminderScheduleItem | null;
} {
  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const prayerKeys: Array<{
    key: keyof AppSettings['prayerReminders'];
    labelBn: string;
  }> = [
    { key: 'Fajr', labelBn: 'ফজর' },
    { key: 'Dhuhr', labelBn: 'যোহর' },
    { key: 'Asr', labelBn: 'আসর' },
    { key: 'Maghrib', labelBn: 'মাগরিব' },
    { key: 'Isha', labelBn: 'ইশা' },
  ];

  const rawItems: Array<ReminderScheduleItem & { sortSecs: number }> = [];

  for (const p of prayerKeys) {
    const entry = schedule.prayers.find((x) => x.key === p.key);
    if (!entry) continue;
    const alertTime =
      settings.prayerLeadMinutes > 0
        ? addMinutesHHMM(entry.time, -settings.prayerLeadMinutes)
        : entry.time;
    rawItems.push({
      id: `prayer-${p.key}`,
      kind: 'prayer',
      labelBn: `${p.labelBn} নামাজ`,
      timeHHMM: alertTime,
      time12Bn: formatTime12h(alertTime),
      enabled: settings.notificationsEnabled && settings.prayerReminders[p.key],
      leadNoteBn:
        settings.prayerLeadMinutes > 0
          ? `${settings.prayerLeadMinutes} মি. আগে`
          : 'ঠিক ওয়াক্তে',
      isNextUpcoming: false,
      sortSecs: timeToSeconds(alertTime),
    });
  }

  const routines: Array<{
    key: keyof AppSettings['routineReminders'];
    labelBn: string;
  }> = [
    { key: 'morningAzkar', labelBn: 'সকালের যিকির' },
    { key: 'eveningAzkar', labelBn: 'সন্ধ্যার আমল ও ৩৩ আয়াত' },
    { key: 'sleepSunnah', labelBn: 'রাতের আমল ও সূরা মুলক' },
  ];

  for (const r of routines) {
    const cfg = settings.routineReminders[r.key];
    rawItems.push({
      id: `routine-${r.key}`,
      kind: 'routine',
      labelBn: r.labelBn,
      timeHHMM: cfg.time,
      time12Bn: formatTime12h(cfg.time),
      enabled: settings.notificationsEnabled && cfg.enabled,
      leadNoteBn: 'দৈনিক আমল',
      isNextUpcoming: false,
      sortSecs: timeToSeconds(cfg.time),
    });
  }

  rawItems.sort((a, b) => a.sortSecs - b.sortSecs);

  const enabledList = rawItems.filter((item) => item.enabled);
  let nextItem = enabledList.find((item) => item.sortSecs > nowSecs) || enabledList[0] || null;
  if (!nextItem) {
    nextItem = rawItems.find((item) => item.sortSecs > nowSecs) || rawItems[0] || null;
  }

  const items: ReminderScheduleItem[] = rawItems.map(({ sortSecs: _unused, ...rest }) => ({
    ...rest,
    isNextUpcoming: nextItem ? rest.id === nextItem.id : false,
  }));

  return {
    items,
    nextUpcoming: nextItem
      ? items.find((i) => i.id === nextItem.id) || null
      : null,
  };
}
