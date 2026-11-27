import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

async function sanitizeAudioCache(cacheName: string) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const exists = await window.caches.has(cacheName);
    if (!exists) return;
    const cache = await window.caches.open(cacheName);
    const reqs = await cache.keys();
    await Promise.all(
      reqs.map(async (req) => {
        const res = await cache.match(req);
        if (!res) return;
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        const isBad =
          res.type === 'opaque' ||
          !res.ok ||
          (res.url && res.url.includes('__cookie_check')) ||
          (ctype &&
            !ctype.includes('audio') &&
            !ctype.includes('mpeg') &&
            !ctype.includes('mp3') &&
            !ctype.includes('octet-stream'));
        if (isBad) {
          await cache.delete(req).catch(() => {});
        }
      })
    );
  } catch {
    // ignore
  }
}

if (import.meta.env.DEV) {
  const cleanupDevSw = async () => {
    let hadController = false;
    let unregisteredAny = false;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      hadController = Boolean(navigator.serviceWorker.controller);
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          const ok = await reg.unregister().catch(() => false);
          if (ok) unregisteredAny = true;
        }
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await window.caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('workbox-') || k === 'noor-male-tts-cache')
            .map((k) => window.caches.delete(k).catch(() => false))
        );
      } catch {
        // ignore
      }
      await sanitizeAudioCache('quran-audio-cache');
      await sanitizeAudioCache('noor-male-tts-cache-v2');
    }
    try {
      if (
        (hadController || unregisteredAny) &&
        !window.sessionStorage.getItem('noor_dev_sw_healed_v1')
      ) {
        window.sessionStorage.setItem('noor_dev_sw_healed_v1', '1');
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };
  void cleanupDevSw();
} else {
  if (typeof window !== 'undefined' && 'caches' in window) {
    void window.caches.delete('noor-male-tts-cache').catch(() => {});
    void sanitizeAudioCache('quran-audio-cache');
    void sanitizeAudioCache('noor-male-tts-cache-v2');
  }
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
