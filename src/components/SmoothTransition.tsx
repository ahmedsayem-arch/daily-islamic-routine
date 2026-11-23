import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

export const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface SmoothStageProps {
  stageKey: string | number;
  children: React.ReactNode;
  className?: string;
  yOffset?: number;
}

/**
 * Smooth stage transition wrapper for switching between
 * directories, chapter lists, readers, and sub-views.
 */
export const SmoothStage: React.FC<SmoothStageProps> = ({
  stageKey,
  children,
  className,
  yOffset = 10,
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stageKey}
        initial={{ opacity: 0, y: yOffset }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -Math.round(yOffset * 0.7) }}
        transition={{ duration: 0.24, ease: SMOOTH_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

interface SmoothSwapProps {
  itemKey: string | number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Gentle cross-fade + vertical slide for successive items
 * (e.g., next Ayah, next Dua, next Hadith spotlight).
 */
export const SmoothSwap: React.FC<SmoothSwapProps> = ({
  itemKey,
  children,
  className,
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={itemKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: SMOOTH_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
