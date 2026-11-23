import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'dark-hero' | 'surface';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'dark-hero',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F6DC9B] to-[#C8963E] px-3 text-xs font-bold text-[#041815] shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="whitespace-nowrap">অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        className={
          variant === 'surface'
            ? 'flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0D6E52]/30 bg-[#0D6E52] px-4 text-xs font-bold text-[#F6DC9B] shadow-sm transition-colors hover:bg-[#0A5A43]'
            : 'flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E7C57B]/30 bg-white/10 px-3 text-xs font-semibold text-[#F6DC9B] backdrop-blur-md transition-colors hover:bg-white/20'
        }
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span className="whitespace-nowrap">ফোনে অ্যাপ সেভ</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="মোবাইলে অ্যাপ সেভ করুন"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[#E7C57B]/25 bg-[#071A16] p-6 text-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#F6DC9B]">
                মোবাইলে অ্যাপ হিসেবে ইনস্টল করুন
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#A9C4BB] hover:bg-white/10 hover:text-white"
                aria-label="বন্ধ করুন"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#D6E8E1]">
                <li>১. Safari ব্রাউজারের নিচে <strong>Share</strong> বাটনে ট্যাপ করুন।</li>
                <li>২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> সিলেক্ট করুন।</li>
                <li>৩. ডান কোণায় <strong>Add</strong> চাপলেই ফোনে অ্যাপ আইকন চলে আসবে।</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#D6E8E1]">
                <li>
                  ১. উপরের ডান কোণায় ব্রাউজার মেনু <strong>⋮ (৩ ডট)</strong> এ ট্যাপ করুন।
                </li>
                <li>
                  ২. তালিকা থেকে <strong>Install app</strong> বা <strong>Add to Home screen</strong> সিলেক্ট করুন।
                </li>
                <li>
                  ৩. সাথে সাথেই ফোনের হোম স্ক্রিনে অ্যাপের মতো আইকন সেভ হয়ে যাবে।
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-gradient-to-r from-[#F6DC9B] to-[#C8963E] text-sm font-bold text-[#041815]"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed left-4 top-20 z-40 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-[#2B1D06]/95 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md">
      <WifiOff className="h-3.5 w-3.5 text-amber-300" />
      <span>অফলাইন মোড — সংরক্ষিত ডেটা ব্যবহৃত হচ্ছে</span>
    </div>
  );
};
