import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { TASBIH_PRESETS } from '../data/islamicData';

interface TasbihModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TasbihModal: React.FC<TasbihModalProps> = ({ isOpen, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>(TASBIH_PRESETS[0].id);
  const [count, setCount] = useState<number>(0);
  const [target, setTarget] = useState<number>(33);
  const [totalLifetime, setTotalLifetime] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('noor_tasbih_total') || '0');
    } catch {
      return 0;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const preset = TASBIH_PRESETS.find((p) => p.id === selectedId) || TASBIH_PRESETS[0];

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const playGentleTap = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.055);
    } catch {
      // ignore
    }
  };

  const handleTap = () => {
    playGentleTap();
    setCount((c) => c + 1);
    const updatedLifetime = totalLifetime + 1;
    setTotalLifetime(updatedLifetime);
    try {
      localStorage.setItem('noor_tasbih_total', String(updatedLifetime));
    } catch {
      // ignore
    }
  };

  const handleSelectPreset = (id: string) => {
    const found = TASBIH_PRESETS.find((p) => p.id === id);
    setSelectedId(id);
    setCount(0);
    if (found) setTarget(found.defaultTarget);
  };

  if (!isOpen) return null;

  const progressPct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progressPct / 100) * circumference;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#04100C]/65 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ডিজিটাল তাসবিহ কাউন্টার"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[#0D6E52]/20 bg-white shadow-2xl dark:border-[#244238] dark:bg-[#0D1A16] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Royal Emerald Header */}
        <div className="relative overflow-hidden bg-[#063D34] bg-gradient-to-br from-[#063D34] to-[#0B5D4E] px-6 py-5 text-white">
          <div className="bg-islamic-lattice pointer-events-none absolute inset-0 opacity-75" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">ডিজিটাল তাসবিহ</h2>
              <p className="font-mono-num text-xs text-[#E7C57B]">
                সর্বমোট যিকির: {totalLifetime} বার
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={soundEnabled ? 'ট্যাপ শব্দ বন্ধ করুন' : 'ট্যাপ শব্দ চালু করুন'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCount(0)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="রিসেট করুন"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="বন্ধ করুন"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Preset Selector */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {TASBIH_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item.id)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  selectedId === item.id
                    ? 'bg-[#063D34] text-[#E7C57B] shadow-sm dark:bg-[#195E4B] dark:text-white'
                    : 'bg-[#F1F5F3] text-[#475A53] hover:text-[#0F1F1A] dark:bg-[#13241E] dark:text-[#A3BDB4]'
                }`}
              >
                {item.labelBn}
              </button>
            ))}
          </div>

          {/* Arabic Display */}
          <div className="mb-6 rounded-2xl border border-[#0D6E52]/10 bg-[#F6F9F8] p-4 text-center dark:border-[#1F352E] dark:bg-[#08120F]">
            <p dir="rtl" className="font-arabic text-2xl text-[#0F1F1A] dark:text-[#F0F5F3]">
              {preset.arabic}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0D6E52] dark:text-[#34B38A]">
              {preset.labelBn}
            </p>
            <p className="mt-0.5 text-xs text-[#475A53] dark:text-[#9BB0A8]">
              {preset.meaningBn}
            </p>
          </div>

          {/* Luminous Tactile Dial */}
          <div className="flex flex-col items-center">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handleTap}
              className="relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-b from-[#FFFFFF] to-[#EDF3F0] shadow-[0_12px_35px_rgba(6,61,52,0.14)] ring-1 ring-[#0D6E52]/10 dark:from-[#132620] dark:to-[#0A1612] dark:ring-[#34B38A]/20"
              aria-label="তাসবিহ গণনা করতে ট্যাপ করুন"
            >
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
                <defs>
                  <linearGradient id="tasbihGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0D6E52" />
                    <stop offset="100%" stopColor="#D4A853" />
                  </linearGradient>
                </defs>
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[#E2E8E5] dark:text-[#1E342D]"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="url(#tasbihGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  className="transition-[stroke-dashoffset] duration-150"
                />
              </svg>
              <div className="relative flex flex-col items-center">
                <span className="font-mono-num text-5xl font-bold text-[#063D34] dark:text-[#F0F5F3]">
                  {count}
                </span>
                <span className="font-mono-num mt-1 text-xs font-medium text-[#B08438] dark:text-[#E7C57B]">
                  লক্ষ্য: {target}
                </span>
              </div>
            </motion.button>

            <div className="mt-5 flex items-center gap-2">
              {[33, 34, 100, 1000].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`font-mono-num min-h-[40px] rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                    target === t
                      ? 'bg-[#063D34] text-[#E7C57B] dark:bg-[#238E6D] dark:text-white'
                      : 'bg-[#F1F5F3] text-[#475A53] hover:text-[#0F1F1A] dark:bg-[#13241E] dark:text-[#A3BDB4]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
