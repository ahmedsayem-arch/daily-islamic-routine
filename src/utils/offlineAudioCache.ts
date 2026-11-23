export const OFFLINE_AUDIO_CACHE_NAME = 'quran-audio-cache';

export function isCacheStorageSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export async function countCachedAudioUrls(urls: string[]): Promise<number> {
  if (!isCacheStorageSupported() || urls.length === 0) return 0;
  try {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE_NAME);
    let count = 0;
    for (const url of urls) {
      const match = await cache.match(url);
      if (match) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function downloadAudioUrlsForOffline(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ saved: number; failed: number }> {
  if (!isCacheStorageSupported()) {
    throw new Error('আপনার ব্রাউজারে অফলাইন ক্যাশ সুবিধা সাপোর্ট করছে না');
  }
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  const total = uniqueUrls.length;
  const cache = await window.caches.open(OFFLINE_AUDIO_CACHE_NAME);

  let saved = 0;
  let failed = 0;
  let done = 0;

  // Fetch in small batches of 4 so Android devices & network stay smooth
  const BATCH_SIZE = 4;
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (existing) {
            saved += 1;
            return;
          }
          const response = await fetch(url, { mode: 'no-cors' });
          if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(url, response);
            saved += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      })
    );
  }

  return { saved, failed };
}
