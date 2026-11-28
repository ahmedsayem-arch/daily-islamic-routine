export interface MediaSessionMetaInput {
  title: string;
  artist?: string;
  album?: string;
}

export interface MediaSessionActionCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeekTo?: (time: number) => void;
  onStop?: () => void;
}

function getMediaSession(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return null;
  }
  return navigator.mediaSession;
}

export function setMediaSessionMetadata(input: MediaSessionMetaInput): void {
  const ms = getMediaSession();
  if (!ms || typeof MediaMetadata === 'undefined') return;
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    const icon192 = origin ? `${origin}/pwa-192x192.png` : '/pwa-192x192.png';
    const icon512 = origin ? `${origin}/pwa-512x512.png` : '/pwa-512x512.png';
    ms.metadata = new MediaMetadata({
      title: input.title,
      artist: input.artist || 'Daily Islamic Routine',
      album: input.album || 'তিলাওয়াত ও ইবাদত',
      artwork: [
        { src: icon192, sizes: '192x192', type: 'image/png' },
        { src: icon512, sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch {
    // ignore unsupported environments
  }
}

export function setMediaSessionPlaybackState(
  state: 'none' | 'paused' | 'playing'
): void {
  const ms = getMediaSession();
  if (!ms) return;
  try {
    ms.playbackState = state;
  } catch {
    // ignore
  }
}

export function updateMediaSessionPosition(
  duration: number,
  position: number,
  playbackRate = 1
): void {
  const ms = getMediaSession();
  if (!ms || typeof ms.setPositionState !== 'function') return;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const safePos = Math.max(0, Math.min(duration, Number.isFinite(position) ? position : 0));
  try {
    ms.setPositionState({
      duration,
      playbackRate: playbackRate > 0 ? playbackRate : 1,
      position: safePos,
    });
  } catch {
    // ignore invalid state
  }
}

export function registerMediaSessionHandlers(
  callbacks: MediaSessionActionCallbacks
): void {
  const ms = getMediaSession();
  if (!ms || typeof ms.setActionHandler !== 'function') return;

  const setHandler = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      // some browsers do not support all actions (e.g. 'stop')
    }
  };

  setHandler('play', callbacks.onPlay ? () => callbacks.onPlay?.() : null);
  setHandler('pause', callbacks.onPause ? () => callbacks.onPause?.() : null);
  setHandler(
    'previoustrack',
    callbacks.onPrev ? () => callbacks.onPrev?.() : null
  );
  setHandler(
    'nexttrack',
    callbacks.onNext ? () => callbacks.onNext?.() : null
  );
  setHandler(
    'seekbackward',
    callbacks.onPrev ? () => callbacks.onPrev?.() : null
  );
  setHandler(
    'seekforward',
    callbacks.onNext ? () => callbacks.onNext?.() : null
  );
  setHandler(
    'seekto',
    callbacks.onSeekTo
      ? (details) => {
          if (typeof details.seekTime === 'number') {
            callbacks.onSeekTo?.(details.seekTime);
          }
        }
      : null
  );
  setHandler('stop', callbacks.onStop ? () => callbacks.onStop?.() : null);
}

export function clearMediaSession(): void {
  const ms = getMediaSession();
  if (!ms) return;
  try {
    ms.playbackState = 'none';
    ms.metadata = null;
  } catch {
    // ignore
  }
  registerMediaSessionHandlers({});
}
