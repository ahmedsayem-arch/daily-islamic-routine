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
      },
      appType: 'spa',
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
