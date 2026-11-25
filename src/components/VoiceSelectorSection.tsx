import React, { useMemo } from 'react';
import { Check, Mic, Volume2 } from 'lucide-react';
import {
  ARABIC_VOICE_MODES,
  speechPlayer,
  useSpeechPlayer,
  VOICE_PROFILES,
} from '../utils/speechPlayer';

interface VoiceSelectorSectionProps {
  compact?: boolean;
}

export const VoiceSelectorSection: React.FC<VoiceSelectorSectionProps> = ({
  compact = false,
}) => {
  const speechSnap = useSpeechPlayer();

  const activeMaleLabels = useMemo(
    () => speechPlayer.getActiveMaleVoiceLabels(),
    [speechSnap.voicePrefs]
  );

  const { voicePrefs } = speechSnap;
  const activeBanglaProfile =
    VOICE_PROFILES.find((p) => p.id === voicePrefs.profile) || VOICE_PROFILES[0];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {/* Active Male Voice Summary Banner */}
      <div className="rounded-2xl border border-[#0D6E52]/20 bg-[#0D6E52]/[0.06] p-3.5 dark:border-[#E7C57B]/25 dark:bg-[#0D6E52]/15">
        <p className="text-xs font-bold text-[#0D6E52] dark:text-[#F6DC9B]">
          আরবি · বাংলা · ইংরেজি — সব ভাষায় ১০০% ছেলে কণ্ঠ সক্রিয় (সা., রা., আ., রহ. পূর্ণ উচ্চারণসহ)
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-3">
          <div className="rounded-xl bg-white/75 px-2.5 py-1.5 dark:bg-black/25">
            <span className="font-bold text-[#0D6E52] dark:text-[#F6DC9B]">আরবি: </span>
            <span className="text-[#0F1F1A] dark:text-[#E5F2ED]">
              {activeMaleLabels.arabic}
            </span>
          </div>
          <div className="rounded-xl bg-white/75 px-2.5 py-1.5 dark:bg-black/25">
            <span className="font-bold text-[#0D6E52] dark:text-[#F6DC9B]">বাংলা: </span>
            <span className="text-[#0F1F1A] dark:text-[#E5F2ED]">
              {activeMaleLabels.bangla}
            </span>
          </div>
          <div className="rounded-xl bg-white/75 px-2.5 py-1.5 dark:bg-black/25">
            <span className="font-bold text-[#0D6E52] dark:text-[#F6DC9B]">ইংরেজি: </span>
            <span className="text-[#0F1F1A] dark:text-[#E5F2ED]">
              {activeMaleLabels.english}
            </span>
          </div>
        </div>
      </div>

      {/* 1. ARABIC VOICE SECTION */}
      <div className="rounded-2xl border border-[#0D6E52]/15 bg-black/[0.02] p-4 dark:border-[#E7C57B]/20 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
              <Mic className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
              <span>আরবি ভয়েস (হাদিস ও দুআ)</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => speechPlayer.previewArabicVoice()}
            className="flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl bg-[#0D6E52]/12 px-3 text-xs font-bold text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>আরবি নমুনা শুনুন</span>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ARABIC_VOICE_MODES.map((mode) => {
            const active = voicePrefs.arabicMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => speechPlayer.updateVoicePrefs({ arabicMode: mode.id })}
                className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? 'border-[#0D6E52] bg-gradient-to-br from-[#063D34] to-[#0A5749] text-white shadow-sm dark:border-[#E7C57B]/65'
                    : 'border-black/10 bg-white/80 text-[#0F1F1A] hover:border-[#0D6E52]/35 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold ${
                      active ? 'text-[#F6DC9B]' : 'text-[#0F1F1A] dark:text-[#F0F5F3]'
                    }`}
                  >
                    {mode.labelBn}
                  </p>
                  {!compact && (
                    <p
                      className={`mt-0.5 text-[11px] leading-snug ${
                        active ? 'text-[#D6ECE5]' : 'text-[#475A53] dark:text-[#9BB0A8]'
                      }`}
                    >
                      {mode.descBn}
                    </p>
                  )}
                </div>
                {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F6DC9B]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BANGLA & ENGLISH VOICE SECTION */}
      <div className="rounded-2xl border border-[#0D6E52]/15 bg-black/[0.02] p-4 dark:border-[#E7C57B]/20 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#0F1F1A] dark:text-[#F0F5F3]">
              <Volume2 className="h-4 w-4 text-[#0D6E52] dark:text-[#E7C57B]" />
              <span>বাংলা ও ইংরেজি ছেলে কণ্ঠ</span>
            </p>
            <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
              সক্রিয় কণ্ঠ: {activeBanglaProfile.labelBn} · গতি {voicePrefs.rate.toFixed(2)}x
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => speechPlayer.previewBanglaVoice()}
              className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-[#0D6E52]/12 px-2.5 text-xs font-bold text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>বাংলা নমুনা</span>
            </button>
            <button
              type="button"
              onClick={() => speechPlayer.previewEnglishVoice()}
              className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-[#0D6E52]/12 px-2.5 text-xs font-bold text-[#0D6E52] hover:bg-[#0D6E52]/20 dark:bg-[#E7C57B]/15 dark:text-[#F6DC9B]"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>ইংরেজি নমুনা</span>
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VOICE_PROFILES.map((vp) => {
            const active = voicePrefs.profile === vp.id;
            return (
              <button
                key={vp.id}
                type="button"
                onClick={() => speechPlayer.updateVoicePrefs({ profile: vp.id })}
                className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? 'border-[#0D6E52] bg-gradient-to-br from-[#063D34] to-[#0A5749] text-white shadow-sm dark:border-[#E7C57B]/65'
                    : 'border-black/10 bg-white/80 text-[#0F1F1A] hover:border-[#0D6E52]/35 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F0F5F3]'
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold ${
                      active ? 'text-[#F6DC9B]' : 'text-[#0F1F1A] dark:text-[#F0F5F3]'
                    }`}
                  >
                    {vp.labelBn}
                  </p>
                  {!compact && (
                    <p
                      className={`mt-0.5 text-[11px] leading-snug ${
                        active ? 'text-[#D6ECE5]' : 'text-[#475A53] dark:text-[#9BB0A8]'
                      }`}
                    >
                      {vp.descBn}
                    </p>
                  )}
                </div>
                {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F6DC9B]" />}
              </button>
            );
          })}
        </div>

        {/* Speed & Pitch Sliders */}
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-black/8 bg-white/60 p-3 dark:border-white/8 dark:bg-black/20 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-[#0F1F1A] dark:text-[#F0F5F3]">পড়ার গতি (Speed)</span>
              <span className="font-mono-num text-[#0D6E52] dark:text-[#F6DC9B]">
                {voicePrefs.rate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.25}
              step={0.05}
              value={voicePrefs.rate}
              onChange={(e) =>
                speechPlayer.updateVoicePrefs({ rate: Number(e.target.value) })
              }
              className="h-2 w-full cursor-pointer accent-[#0D6E52] dark:accent-[#D4A853]"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-[#0F1F1A] dark:text-[#F0F5F3]">কণ্ঠের গভীরতা (Pitch)</span>
              <span className="font-mono-num text-[#0D6E52] dark:text-[#F6DC9B]">
                {voicePrefs.pitch.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.65}
              max={1.25}
              step={0.05}
              value={voicePrefs.pitch}
              onChange={(e) =>
                speechPlayer.updateVoicePrefs({ pitch: Number(e.target.value) })
              }
              className="h-2 w-full cursor-pointer accent-[#0D6E52] dark:accent-[#D4A853]"
            />
          </div>
        </div>
        {/* Islamic Honorific Expansion Control + Live Sample */}
        <div className="mt-3 rounded-xl border border-[#0D6E52]/20 bg-[#0D6E52]/[0.05] p-3 dark:border-[#E7C57B]/20 dark:bg-[#0D6E52]/12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#063D34] dark:text-[#F6DC9B]">
                সা., রা., আ., রহ. বিস্তারিত উচ্চারণ
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#475A53] dark:text-[#CBE2DA]">
                সা. / সঃ → সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম · রা. / রাঃ → রাদিয়াল্লাহু আনহু / আনহা · আ. → আলাইহিস সালাম · রহ. → রাহিমাহুল্লাহ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => speechPlayer.previewHonorificExpansion()}
                className="flex min-h-[32px] items-center gap-1 rounded-xl border border-[#0D6E52]/25 bg-white px-2.5 text-[11px] font-bold text-[#0D6E52] hover:bg-[#0D6E52]/10 dark:border-[#E7C57B]/30 dark:bg-black/25 dark:text-[#F6DC9B]"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>পূর্ণ উচ্চারণ শুনুন</span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={voicePrefs.expandHonorifics}
                onClick={() =>
                  speechPlayer.updateVoicePrefs({
                    expandHonorifics: !voicePrefs.expandHonorifics,
                  })
                }
                className={`min-h-[32px] rounded-xl px-3 text-[11px] font-bold transition-colors ${
                  voicePrefs.expandHonorifics
                    ? 'bg-[#063D34] text-[#F6DC9B] shadow-xs dark:border dark:border-[#E7C57B]/40'
                    : 'border border-black/15 bg-white/80 text-[#475A53] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#9BB0A8]'
                }`}
              >
                {voicePrefs.expandHonorifics ? 'চালু আছে' : 'বন্ধ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
