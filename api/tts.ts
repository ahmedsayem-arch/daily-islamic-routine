import { synthesizeMaleTts } from '../server/ttsMaleService.ts';

interface VercelReqLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
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
  if (typeof val === 'number') return String(val);
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

    const expandHonorifics =
      source.expandHonorifics === false || pickStr(source.expand) === '0'
        ? false
        : true;

    const audio = await synthesizeMaleTts({
      text,
      lang: pickStr(source.lang),
      voice: pickStr(source.voice),
      rate: pickStr(source.rate),
      pitch: pickStr(source.pitch),
      expandHonorifics,
    });

    const buf = Buffer.from(audio);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');

    const rawRange = req.headers?.range;
    const rangeHeader = typeof rawRange === 'string' ? rawRange : '';
    const rangeMatch = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (rangeMatch && buf.length > 0) {
      const start = rangeMatch[1] ? Number.parseInt(rangeMatch[1], 10) : 0;
      const endRaw = rangeMatch[2] ? Number.parseInt(rangeMatch[2], 10) : buf.length - 1;
      const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;
      const safeEnd = Number.isFinite(endRaw) ? Math.min(buf.length - 1, endRaw) : buf.length - 1;
      if (safeStart <= safeEnd && safeStart < buf.length) {
        const chunk = buf.subarray(safeStart, safeEnd + 1);
        res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${buf.length}`);
        res.setHeader('Content-Length', String(chunk.length));
        res.status(206).send(chunk);
        return;
      }
    }

    res.setHeader('Content-Length', String(buf.length));
    res.status(200).send(buf);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'TTS synthesis failed',
    });
  }
}
