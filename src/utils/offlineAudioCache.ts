export const OFFLINE_AUDIO_CACHE_NAME = 'quran-audio-cache';

const resolvedObjectUrlMap = new Map<string, string>();
const inFlightPrewarms = new Set<string>();
const ttsPrefetchQueue: string[] = [];
let activeTtsPrefetches = 0;
const MAX_RESOLVED_BLOB_URLS = 64;
const MAX_CONCURRENT_TTS_PREFETCH = 2;

async function findInAnyCache(
  primaryCache: Cache,
  url: string
): Promise<Response | undefined> {
  const direct = await primaryCache.match(url);
  if (direct) return direct;
  try {
    return (await window.caches.match(url)) || undefined;
  } catch {
    return undefined;
  }
}

function isValidAudioResponse(res: Response | undefined | null): res is Response {
  if (!res || res.type === 'opaque' || !res.ok) return false;
  if (res.url && res.url.includes('__cookie_check')) return false;
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype) return true;
  return (
    ctype.includes('audio') ||
    ctype.includes('mpeg') ||
    ctype.includes('mp3') ||
    ctype.includes('octet-stream')
  );
}

async function fetchPlayableAudioResponse(url: string): Promise<Response | null> {
  const isSameOrigin = url.startsWith('/');
  if (!isSameOrigin || url.length <= 1800) {
    try {
      const res = await fetch(
        url,
        isSameOrigin ? { credentials: 'same-origin' } : { mode: 'cors' }
      );
      if (isValidAudioResponse(res)) {
        return res;
      }
    } catch {
      // network or CORS blocked
    }
  }

  if (url.startsWith('/api/tts?')) {
    try {
      const qIndex = url.indexOf('?');
      const params = new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : '');
      const text = params.get('text') || '';
      if (text.trim()) {
        const postRes = await fetch('/api/tts', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            lang: params.get('lang') || 'bn-BD',
            voice: params.get('voice') || undefined,
            rate: params.get('rate') || undefined,
            pitch: params.get('pitch') || undefined,
            expandHonorifics: params.get('expand') === '0' ? false : true,
          }),
        });
        if (isValidAudioResponse(postRes)) {
          return postRes;
        }
      }
    } catch {
      // ignore POST fallback failure
    }
  }
  return null;
}

export function isCacheStorageSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

async function fetchCacheableAudioResponse(url: string): Promise<Response | null> {
  try {
    const corsRes = await fetch(url, { mode: 'cors' });
    if (corsRes && corsRes.ok) {
      return corsRes;
    }
  } catch {
    // Fall back to opaque no-cors response only when host blocks CORS
  }

  try {
    const opaqueRes = await fetch(url, { mode: 'no-cors' });
    if (opaqueRes && (opaqueRes.ok || opaqueRes.type === 'opaque')) {
      return opaqueRes;
    }
  } catch {
    // network unavailable
  }
  return null;
}

export async function countCachedAudioUrls(urls: string[]): Promise<number> {
  if (!isCacheStorageSupported() || urls.length === 0) return 0;
  try {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE_NAME);
    let count = 0;
    for (const url of urls) {
      const match = await findInAnyCache(cache, url);
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
          const existingDirect = await cache.match(url);
          if (existingDirect && existingDirect.type !== 'opaque') {
            saved += 1;
            return;
          }
          const crossCacheHit = await findInAnyCache(cache, url);
          if (crossCacheHit && crossCacheHit.type !== 'opaque') {
            await cache.put(url, crossCacheHit.clone());
            saved += 1;
            return;
          }
          const response = await fetchCacheableAudioResponse(url);
          if (response) {
            await cache.put(url, response);
            saved += 1;
          } else if (existingDirect || crossCacheHit) {
            // Keep previously cached opaque entry if offline
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

function rememberResolvedObjectUrl(remoteUrl: string, objectUrl: string): void {
  if (resolvedObjectUrlMap.has(remoteUrl)) {
    const existing = resolvedObjectUrlMap.get(remoteUrl);
    resolvedObjectUrlMap.delete(remoteUrl);
    resolvedObjectUrlMap.set(remoteUrl, existing || objectUrl);
    return;
  }
  resolvedObjectUrlMap.set(remoteUrl, objectUrl);
  while (resolvedObjectUrlMap.size > MAX_RESOLVED_BLOB_URLS) {
    const oldestKey = resolvedObjectUrlMap.keys().next().value;
    if (!oldestKey) break;
    const oldestUrl = resolvedObjectUrlMap.get(oldestKey);
    resolvedObjectUrlMap.delete(oldestKey);
    if (oldestUrl) {
      try {
        URL.revokeObjectURL(oldestUrl);
      } catch {
        // ignore
      }
    }
  }
}

export function invalidateResolvedAudioUrl(remoteUrl: string): void {
  const existing = resolvedObjectUrlMap.get(remoteUrl);
  if (existing) {
    resolvedObjectUrlMap.delete(remoteUrl);
    try {
      URL.revokeObjectURL(existing);
    } catch {
      // ignore
    }
  }
}

/**
 * Synchronously returns an already-prepared in-memory blob: URL if available,
 * otherwise falls back to the original URL so audio.play() can run synchronously
 * inside native `ended` event handlers even while the screen is locked.
 */
export function getFastPlayableAudioUrlSync(remoteUrl: string): string {
  const hit = resolvedObjectUrlMap.get(remoteUrl);
  if (hit) {
    // Refresh LRU order so actively playing/recent URLs are never evicted
    resolvedObjectUrlMap.delete(remoteUrl);
    resolvedObjectUrlMap.set(remoteUrl, hit);
    return hit;
  }
  return remoteUrl;
}

/**
 * Resolves cached audio from CacheStorage into a seekable in-memory blob: URL
 * so offline & background screen-off playback works without Service Worker or Range hiccups.
 */
export async function resolveAndPrewarmAudioUrl(
  remoteUrl: string,
  allowNetworkFallback = false
): Promise<string> {
  if (!remoteUrl) return remoteUrl;
  const cachedBlobUrl = resolvedObjectUrlMap.get(remoteUrl);
  if (cachedBlobUrl) return cachedBlobUrl;
  if (!isCacheStorageSupported()) {
    if (allowNetworkFallback && typeof navigator !== 'undefined' && navigator.onLine !== false) {
      const netRes = await fetchPlayableAudioResponse(remoteUrl);
      if (netRes) {
        const blob = await netRes.blob();
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          rememberResolvedObjectUrl(remoteUrl, objUrl);
          return objUrl;
        }
      }
    }
    return remoteUrl;
  }
  if (inFlightPrewarms.has(remoteUrl)) return remoteUrl;

  inFlightPrewarms.add(remoteUrl);
  try {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE_NAME);
    let match = await findInAnyCache(cache, remoteUrl);

    if (match && match.type !== 'opaque' && !isValidAudioResponse(match)) {
      await cache.delete(remoteUrl).catch(() => {});
      match = undefined;
    }

    // Upgrade legacy opaque cache entry or fetch directly when error fallback requests network recovery
    if (
      ((!match && allowNetworkFallback) || (match && match.type === 'opaque')) &&
      typeof navigator !== 'undefined' &&
      navigator.onLine !== false
    ) {
      const upgraded = await fetchPlayableAudioResponse(remoteUrl);
      if (upgraded) {
        await cache.put(remoteUrl, upgraded.clone());
        match = upgraded;
      }
    }

    if (isValidAudioResponse(match)) {
      const blob = await match.blob();
      if (blob.size > 0) {
        const objUrl = URL.createObjectURL(blob);
        rememberResolvedObjectUrl(remoteUrl, objUrl);
        return objUrl;
      }
    }
  } catch {
    // fallback to remoteUrl
  } finally {
    inFlightPrewarms.delete(remoteUrl);
  }

  return remoteUrl;
}

export function prewarmUpcomingAudioUrls(urls: string[]): void {
  for (const url of urls) {
    if (!url || resolvedObjectUrlMap.has(url) || inFlightPrewarms.has(url)) continue;
    void resolveAndPrewarmAudioUrl(url);
  }
}

async function prefetchSingleAudioUrl(url: string): Promise<void> {
  try {
    if (!isCacheStorageSupported()) return;
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE_NAME);
    let match = await findInAnyCache(cache, url);
    if (match && match.type !== 'opaque' && !isValidAudioResponse(match)) {
      await cache.delete(url).catch(() => {});
      match = undefined;
    }
    if (!match || match.type === 'opaque') {
      const netRes = await fetchPlayableAudioResponse(url);
      if (netRes) {
        await cache.put(url, netRes.clone());
        match = netRes;
      }
    }
    if (isValidAudioResponse(match)) {
      const blob = await match.blob();
      if (blob.size > 0) {
        const objUrl = URL.createObjectURL(blob);
        rememberResolvedObjectUrl(url, objUrl);
      }
    }
  } catch {
    // Silent prefetch failure is harmless
  } finally {
    inFlightPrewarms.delete(url);
  }
}

function pumpTtsPrefetchQueue(): void {
  while (
    activeTtsPrefetches < MAX_CONCURRENT_TTS_PREFETCH &&
    ttsPrefetchQueue.length > 0
  ) {
    const nextUrl = ttsPrefetchQueue.shift();
    if (!nextUrl) continue;
    activeTtsPrefetches += 1;
    void prefetchSingleAudioUrl(nextUrl).finally(() => {
      activeTtsPrefetches = Math.max(0, activeTtsPrefetches - 1);
      pumpTtsPrefetchQueue();
    });
  }
}

/**
 * Background-fetches upcoming small Ayah MP3s into CacheStorage + in-memory blob: URLs
 * while online so transitions remain gapless even after the screen turns off.
 */
export function prefetchAndCacheAudioUrls(urls: string[]): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    prewarmUpcomingAudioUrls(urls);
    return;
  }

  for (const url of urls) {
    if (!url || resolvedObjectUrlMap.has(url) || inFlightPrewarms.has(url)) continue;
    // Skip very large full-surah archive.org files during automatic background prefetch
    if (url.includes('archive.org/')) {
      void resolveAndPrewarmAudioUrl(url);
      continue;
    }
    inFlightPrewarms.add(url);
    if (url.startsWith('/api/tts')) {
      ttsPrefetchQueue.push(url);
      pumpTtsPrefetchQueue();
    } else {
      void prefetchSingleAudioUrl(url);
    }
  }
}
