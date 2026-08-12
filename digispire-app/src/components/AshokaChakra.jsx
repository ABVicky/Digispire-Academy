import React from 'react';

/**
 * AshokaChakra Component
 * Renders an authentic 24-spoke Ashoka Chakra SVG with optional rotation animation.
 */
export default function AshokaChakra({ size = 24, className = '', animate = false }) {
  const spokes = 24;
  const radius = 40;
  const cx = 50;
  const cy = 50;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block shrink-0 ${animate ? 'animate-[spin_12s_linear_infinite]' : ''} ${className}`}
      aria-label="Ashoka Chakra"
    >
      {/* Outer Ring */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#000080" strokeWidth="4" />
      <circle cx={cx} cy={cy} r={radius - 4} fill="none" stroke="#000080" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="6" fill="#000080" />

      {/* 24 Spokes */}
      {Array.from({ length: spokes }).map((_, i) => {
        const angle = (i * 360) / spokes;
        const rad = (angle * Math.PI) / 180;
        const x2 = cx + (radius - 5) * Math.cos(rad);
        const y2 = cy + (radius - 5) * Math.sin(rad);

        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="#000080"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      {/* Outer Dots / Decorative Serrations */}
      {Array.from({ length: spokes }).map((_, i) => {
        const angle = (i * 360) / spokes + (360 / (spokes * 2));
        const rad = (angle * Math.PI) / 180;
        const px = cx + (radius - 1) * Math.cos(rad);
        const py = cy + (radius - 1) * Math.sin(rad);

        return <circle key={`dot-${i}`} cx={px} cy={py} r="1" fill="#000080" />;
      })}
    </svg>
  );
}
