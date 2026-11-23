# Daily Islamic Routine

A Bengali & Arabic Progressive Web App (PWA) for daily Islamic worship, Quran recitation, Hadith study, Seerah, Hisnul Muslim, Ruqyah Shariah, and prayer tracking.

## Features

- **Prayer Times & Daily Routine**: Real-time prayer schedule (AlAdhan API + offline fallback), next prayer countdown, daily ibadat checklist, and direct links to morning/evening Hisnul Muslim azkar.
- **Al-Quran Al-Kareem (114 Surahs)**:
  - Surah index with favorites and search
  - Reading modes with Arabic, Tajweed color coding, Bengali transliteration, Bengali translation (Maulana Muhiuddin Khan), English translation, and a clean Arabic-only Mushaf view
  - Top sticky Ayah follow/audio player with offline Surah saving and male reciter selection
- **Sahih Hadith Library**: 10 major collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah, Muwatta Malik, Riyadhus Salihin, Bulugh al-Maram, Hisnul Muslim) with Arabic + Bengali support.
- **Seerah Library**: Structured reading flow (`আর-রাহীকুল মাখতূম`, `সংক্ষিপ্ত সীরাতুন নবী (সা.)`, and additional downloadable reference books).
- **Hisnul Muslim, 33 Ayat & Ruqyah Shariah**: Chapter-based Hisnul Muslim azkar with tap counter, audio playback, 33 Ayat protection verses, and sequential Ruqyah playback.
- **Digital Tasbih Counter**: Preset zikr targets, vibration feedback, and progress saving.
- **Male-Only Neural TTS**: Backend `/api/tts` endpoint using Microsoft Edge Neural male voices for clear Bengali, Arabic, and English recitation/read-aloud.
- **Offline PWA Support**: Installable web app with Workbox caching for fonts, API responses, and audio.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Lucide React
- **Backend / Serverless**: Express (`server.ts`) & Vercel Serverless (`api/tts.ts`), `@andresaya/edge-tts`
- **PWA**: `vite-plugin-pwa` (Workbox)

## Getting Started

### Prerequisites

- Node.js `>= 22.6` (required for `npm start` native `.ts` execution) or `tsx`

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Runs the Express + Vite dev server on `http://localhost:3000`.

### Typecheck & Build

```bash
npm run lint
npm run build
```

### Production

```bash
NODE_ENV=production npm start
```

## Environment Variables

Copy `.env.example` to `.env` if needed:

- `GEMINI_API_KEY`: Optional Gemini API key if enabling AI features
- `APP_URL`: Public URL of the deployed application
- `PORT`: Server port (defaults to `3000`)
