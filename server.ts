import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeMaleTts } from './server/ttsMaleService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/tts', async (req, res) => {
    try {
      const text = typeof req.query.text === 'string' ? req.query.text : '';
      if (!text.trim()) {
        res.status(400).json({ error: 'Missing text parameter' });
        return;
      }

      const audio = await synthesizeMaleTts({
        text,
        lang: typeof req.query.lang === 'string' ? req.query.lang : undefined,
        voice: typeof req.query.voice === 'string' ? req.query.voice : undefined,
        rate: typeof req.query.rate === 'string' ? req.query.rate : undefined,
        pitch: typeof req.query.pitch === 'string' ? req.query.pitch : undefined,
        expandHonorifics: req.query.expand === '0' ? false : true,
      });

      const buf = Buffer.from(audio);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');

      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : '';
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
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const text = typeof body.text === 'string' ? body.text : '';
      if (!text.trim()) {
        res.status(400).json({ error: 'Missing text parameter' });
        return;
      }

      const audio = await synthesizeMaleTts({
        text,
        lang: typeof body.lang === 'string' ? body.lang : undefined,
        voice: typeof body.voice === 'string' ? body.voice : undefined,
        rate:
          typeof body.rate === 'string' || typeof body.rate === 'number'
            ? body.rate
            : undefined,
        pitch:
          typeof body.pitch === 'string' || typeof body.pitch === 'number'
            ? body.pitch
            : undefined,
        expandHonorifics: body.expandHonorifics === false ? false : true,
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
      res.status(200).send(Buffer.from(audio));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'TTS synthesis failed',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        forwardConsole: false,
      },
      appType: 'spa',
    });

    // When HMR & WebSocket are disabled in middleware mode, Vite 8's @vite/client still attempts
    // `transport.connect(...)` to port 24678, throwing `WebSocket closed without opened.` in the browser.
    // Keep CSS/error-overlay helpers intact while skipping the dead WebSocket connection.
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const patched = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in middleware mode */',
          )
          .replace(
            'else throw new SendBeforeConnectError("send was called before connect");',
            'else return;',
          )
          .replace(
            'else throw new SendBeforeConnectError("invoke was called before connect");',
            'else return;',
          );
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).send(patched);
      } catch (err) {
        next(err);
      }
    });

    // Serve a self-unregistering Service Worker kill-switch for browsers that cached
    // an older /dev-sw.js?dev-sw (otherwise 404/HTML MIME prevents SW update & leaves stale SW active).
    app.get('/dev-sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.status(200).send(`
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('workbox-') || k === 'noor-male-tts-cache')
          .map((k) => caches.delete(k))
      );
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch {}
  })());
});
`);
    });

    app.get('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(
        "if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}); }"
      );
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
