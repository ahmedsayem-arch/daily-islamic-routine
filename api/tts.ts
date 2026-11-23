import { synthesizeMaleTts } from '../server/ttsMaleService.ts';

interface VercelReqLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
}

interface VercelResLike {
  status: (code: number) => VercelResLike;
  setHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
  json: (body: unknown) => void;
}

function pickStr(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

export default async function handler(req: VercelReqLike, res: VercelResLike) {
  try {
    const source = req.method === 'POST' && req.body ? req.body : req.query || {};
    const text = pickStr(source.text) || '';
    if (!text.trim()) {
      res.status(400).json({ error: 'Missing text parameter' });
      return;
    }

    const audio = await synthesizeMaleTts({
      text,
      lang: pickStr(source.lang),
      voice: pickStr(source.voice),
      rate: pickStr(source.rate),
      pitch: pickStr(source.pitch),
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
    res.status(200).send(Buffer.from(audio));
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'TTS synthesis failed',
    });
  }
}
