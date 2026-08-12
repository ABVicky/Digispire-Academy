import { useState, useEffect } from 'react';
import { Sparkles, X, Heart, Flag, Volume2 } from 'lucide-react';
import AshokaChakra from './AshokaChakra';
import { triggerTriColorCelebration, isIndependenceDayActive } from '../utils/independenceDayTheme';

const patrioticQuotes = [
  "Freedom in mind, faith in words, pride in our hearts. 🇮🇳",
  "Empowering India’s future tech leaders & innovators.",
  "Educate, Empower, Elevate — Celebrating 79 Years of Freedom!",
  "Where the mind is without fear and the head is held high. 🇮🇳",
  "Saluting the spirit of innovation and unity in diversity."
];

export default function IndependenceDayBanner() {
  const [saluteCount, setSaluteCount] = useState(() => {
    return parseInt(localStorage.getItem('indep_salute_count') || '42', 10);
  });
  const [hasSaluted, setHasSaluted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % patrioticQuotes.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!isIndependenceDayActive() || isDismissed) return null;

  // Web Audio API synthesizes a celebratory melody without external audio file assets
  const playCelebrationAudio = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Celebratory arpeggio)
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);

        gain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.35);
      });
    } catch (e) {
      console.warn('Audio context play issue:', e);
    }
  };

  const handleCelebrate = () => {
    triggerTriColorCelebration();
    playCelebrationAudio();

    if (!hasSaluted) {
      const updated = saluteCount + 1;
      setSaluteCount(updated);
      localStorage.setItem('indep_salute_count', updated.toString());
      setHasSaluted(true);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/60 shadow-lg bg-gradient-to-r from-[#FF9933]/15 via-white to-[#138808]/15 p-4 sm:p-5 transition-all duration-300 patriotic-card-glow">
      {/* Top Animated Tri-Color Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-[#FF9933] animate-pulse" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808] animate-pulse" />
      </div>

      {/* Ashoka Chakra Background Watermark */}
      <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
        <AshokaChakra size={160} animate={true} />
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition cursor-pointer z-10"
        title="Dismiss banner"
      >
        <X size={15} />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-1 relative z-10">
        {/* Left Info Section */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center shrink-0 relative overflow-hidden group">
            <AshokaChakra size={30} animate={true} />
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 via-transparent to-emerald-400/20 pointer-events-none" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
                <Flag size={10} className="text-orange-600 animate-bounce" /> Independence Day Celebration
              </span>
              <span className="text-xs text-slate-500 font-extrabold font-mono">15th August 🇮🇳</span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug mt-1 flex items-center gap-1.5">
              Happy Independence Day! <span className="text-xl">🇮🇳</span>
            </h2>

            <p className="text-xs text-slate-600 font-semibold mt-0.5 leading-relaxed truncate max-w-xl transition-all duration-300">
              {patrioticQuotes[quoteIndex]}
            </p>
          </div>
        </div>

        {/* Right CTA Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 sm:border-none">
          <button
            onClick={handleCelebrate}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs text-white shadow-lg hover:shadow-orange-500/25 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-[#FF9933] via-[#e87e13] to-[#138808] patriotic-pulse-ring"
          >
            <Sparkles size={16} className="animate-spin text-amber-200" />
            <span>{hasSaluted ? 'Jai Hind! 🇮🇳' : 'Celebrate 🇮🇳'}</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-md bg-black/20 text-[10px] font-black tracking-wider border border-white/20">
              {saluteCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
