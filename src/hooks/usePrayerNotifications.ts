import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, PrayerTimeEntry } from '../types/islamic';
import { formatTime12h } from '../utils/timeFormat';

export type NotificationPermState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface InAppNotificationAlert {
  id: string;
  title: string;
  body: string;
}

function getPermissionState(): NotificationPermState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermState;
}

export function playGentleAlertChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.48);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // ignore audio restriction errors
  }
}

function getLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

async function dispatchSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
  } catch {
    // ignore iframe or permission quirks
  }
}

function subtractMinutesFromHHMM(hhmm: string, minusMins: number): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = (h * 60 + m - minusMins + 24 * 60) % (24 * 60);
  const outH = Math.floor(total / 60);
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

export function usePrayerNotifications(
  prayers: PrayerTimeEntry[],
  settings: AppSettings,
  onInAppAlert: (alert: InAppNotificationAlert) => void
) {
  const [permissionState, setPermissionState] = useState<NotificationPermState>(() =>
    getPermissionState()
  );

  const requestPermission = useCallback(async (): Promise<NotificationPermState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported');
      return 'unsupported';
    }
    try {
      const res = await Notification.requestPermission();
      const mapped = res as NotificationPermState;
      setPermissionState(mapped);
      return mapped;
    } catch {
      const current = getPermissionState();
      setPermissionState(current);
      return current;
    }
  }, []);

  const triggerAlert = useCallback(
    (title: string, body: string, tag: string) => {
      if (settings.notificationSound) {
        playGentleAlertChime();
      }
      dispatchSystemNotification(title, body, tag);
      onInAppAlert({
        id: `${tag}-${Date.now()}`,
        title,
        body,
      });
    },
    [settings.notificationSound, onInAppAlert]
  );

  useEffect(() => {
    if (!settings.notificationsEnabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const storageKey = `noor_notif_sent_${todayKey}`;
      let sentIds: string[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        sentIds = raw ? JSON.parse(raw) : [];
      } catch {
        sentIds = [];
      }

      const markSent = (id: string) => {
        sentIds.push(id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(sentIds));
        } catch {
          // ignore
        }
      };

      // Check 5 daily prayers
      const prayerKeys: Array<keyof AppSettings['prayerReminders']> = [
        'Fajr',
        'Dhuhr',
        'Asr',
        'Maghrib',
        'Isha',
      ];

      for (const pKey of prayerKeys) {
        if (!settings.prayerReminders[pKey]) continue;
        const entry = prayers.find((p) => p.key === pKey);
        if (!entry) continue;

        const targetTime = subtractMinutesFromHHMM(entry.time, settings.prayerLeadMinutes);
        const eventId = `prayer-${pKey}-${targetTime}`;
        if (nowHHMM === targetTime && !sentIds.includes(eventId)) {
          const timeLabel12 = formatTime12h(entry.time);
          const leadNote =
            settings.prayerLeadMinutes > 0
              ? `${settings.prayerLeadMinutes} মিনিট পর ${entry.labelBn}-এর ওয়াক্ত (${timeLabel12})।`
              : `এখন ${entry.labelBn}-এর ওয়াক্ত (${timeLabel12})। ওজু ও সালাতের প্রস্তুতি নিন।`;
          triggerAlert(`${entry.labelBn}-এর নামাজের সময়`, leadNote, eventId);
          markSent(eventId);
        }
      }

      // Check daily routine reminders
      const routineMap: Array<{
        key: keyof AppSettings['routineReminders'];
        title: string;
        body: string;
      }> = [
        {
          key: 'morningAzkar',
          title: 'সকালের মাসনুন আমল ও যিকির',
          body: 'আয়াতুল কুরসি, ৩ কুল ও সকালের যিকির পাঠ করার সময় হয়েছে।',
        },
        {
          key: 'eveningAzkar',
          title: 'সন্ধ্যার যিকির ও ৩৩ আয়াত / রুকাইয়া',
          body: 'সন্ধ্যার হেফাজতের আমল, যিকির ও ৩৩ আয়াত শুনতে পারেন।',
        },
        {
          key: 'sleepSunnah',
          title: 'রাতের আমল ও সূরা মুলক',
          body: 'ঘুমানোর আগে সূরা বাকারার শেষ ২ আয়াত, সূরা মুলক ও তাসবিহ আদায় করুন।',
        },
      ];

      for (const item of routineMap) {
        const cfg = settings.routineReminders[item.key];
        if (!cfg.enabled || !cfg.time) continue;
        const eventId = `routine-${item.key}-${cfg.time}`;
        if (nowHHMM === cfg.time && !sentIds.includes(eventId)) {
          triggerAlert(item.title, item.body, eventId);
          markSent(eventId);
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 15000);
    return () => clearInterval(interval);
  }, [prayers, settings, triggerAlert]);

  return {
    permissionState,
    requestPermission,
  };
}
