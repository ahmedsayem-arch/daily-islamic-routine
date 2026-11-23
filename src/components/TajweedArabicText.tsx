import React, { useMemo } from 'react';
import {
  parseTajweedText,
  TAJWEED_COLOR_CLASSES,
} from '../utils/quranFormatting';

interface TajweedArabicTextProps {
  plainArabic?: string;
  tajweedArabic?: string;
  enableTajweed: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: 'p' | 'span';
}

export const TajweedArabicText: React.FC<TajweedArabicTextProps> = ({
  plainArabic,
  tajweedArabic,
  enableTajweed,
  className = '',
  style,
  as = 'p',
}) => {
  const segments = useMemo(() => {
    if (!enableTajweed || !tajweedArabic) return null;
    return parseTajweedText(tajweedArabic);
  }, [enableTajweed, tajweedArabic]);

  const Tag = as;

  if (!enableTajweed || !segments || segments.length === 0) {
    return (
      <Tag dir="rtl" className={className} style={style}>
        {plainArabic}
      </Tag>
    );
  }

  return (
    <Tag dir="rtl" className={className} style={style}>
      {segments.map((seg, idx) =>
        seg.category ? (
          <span key={idx} className={TAJWEED_COLOR_CLASSES[seg.category]}>
            {seg.text}
          </span>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </Tag>
  );
};
