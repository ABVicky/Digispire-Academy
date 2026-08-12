import React, { useEffect, useRef } from 'react';
import AshokaChakra from './AshokaChakra';

/**
 * PatrioticDecorations Component
 * Renders decorative festoons/bunting flag garlands, tri-color corner sashes,
 * and ambient floating tri-color petals/sparkles for an extra grand festive look!
 */
export default function PatrioticDecorations() {
  const canvasRef = useRef(null);

  // Floating ambient petals effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const colors = [
      'rgba(255, 153, 51, 0.45)',  // Soft Saffron
      'rgba(255, 255, 255, 0.65)',  // Soft White
      'rgba(19, 136, 8, 0.45)',    // Soft India Green
      'rgba(255, 215, 0, 0.5)',     // Gold Sparkle
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initial ambient particles
    particles = Array.from({ length: 25 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 5 + 2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 0.5 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.02,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx + Math.sin(p.angle) * 0.3;
        p.y += p.vy;
        p.angle += p.vAngle;

        if (p.y > canvas.height + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Render petal / diamond shape
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.8, p.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* ── Ambient Floating Petals Canvas ── */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-30 opacity-70"
      />



      {/* ── Top Floating Celebration Ribbon Sash (Desktop Right) ── */}
      <div className="fixed top-3 right-4 z-40 hidden lg:flex items-center gap-2 bg-gradient-to-r from-[#FF9933] via-white to-[#138808] p-0.5 rounded-full shadow-lg border border-amber-300/60 pointer-events-auto transition-transform hover:scale-105">
        <div className="bg-slate-900/90 text-white px-3 py-1 rounded-full flex items-center gap-2 text-[11px] font-black tracking-wider uppercase backdrop-blur-md">
          <AshokaChakra size={16} animate={true} />
          <span className="bg-gradient-to-r from-orange-400 via-white to-emerald-400 bg-clip-text text-transparent">
            Independence Day 🇮🇳
          </span>
        </div>
      </div>
    </>
  );
}
