import { useState, useEffect, useRef } from 'react';
import { Flag, Sparkles, Award, X, ChevronUp, CheckCircle2, RefreshCw, ShieldCheck, Download, Share2, Compass, Flame } from 'lucide-react';
import AshokaChakra from './AshokaChakra';
import { triggerTriColorCelebration } from '../utils/independenceDayTheme';
import { useAuth } from '../context/AuthContext';

export default function VirtualFlagHoisting({ isOpen, onClose }) {
  const { userProfile } = useAuth();
  const [hoistProgress, setHoistProgress] = useState(0);
  const [isHoisted, setIsHoisted] = useState(() => {
    return localStorage.getItem('flag_hoisted_2026') === 'true';
  });
  const [totalHoists, setTotalHoists] = useState(() => {
    return parseInt(localStorage.getItem('total_flag_hoists_count') || '79', 10);
  });
  const [hoistTime, setHoistTime] = useState(null);
  const [showJets, setShowJets] = useState(false);
  const [jetProgress, setJetProgress] = useState(-20);

  const petalCanvasRef = useRef(null);
  const ropeContainerRef = useRef(null);

  useEffect(() => {
    if (isHoisted && !hoistTime) {
      setHoistTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      setHoistProgress(100);
    }
  }, [isHoisted, hoistTime]);

  // Jet Flypast Animation trigger when hoisted
  const triggerJetFlypast = () => {
    setShowJets(true);
    setJetProgress(-20);
    let pos = -20;
    const interval = setInterval(() => {
      pos += 3;
      setJetProgress(pos);
      if (pos > 120) {
        clearInterval(interval);
        setShowJets(false);
      }
    }, 30);
  };

  // Petal Shower Canvas Effect when flag is 100% hoisted
  useEffect(() => {
    if (hoistProgress < 100) return;
    const canvas = petalCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let petals = [];

    const colors = ['#FF9933', '#FFFFFF', '#138808', '#FFD700', '#FF4500'];

    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    petals = Array.from({ length: 75 }).map(() => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100,
      y: 35,
      r: Math.random() * 5 + 3,
      vx: (Math.random() - 0.5) * 3.5,
      vy: Math.random() * 2 + 1.8,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
      angle: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      petals.forEach((p, idx) => {
        p.x += p.vx + Math.sin(p.angle) * 0.6;
        p.y += p.vy;
        p.angle += 0.06;
        p.opacity -= 0.005;

        if (p.opacity <= 0 || p.y > canvas.height) {
          petals.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.6, p.r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (petals.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [hoistProgress]);

  if (!isOpen) return null;

  const handleRopePullStep = () => {
    if (hoistProgress < 100) {
      const next = Math.min(hoistProgress + 20, 100);
      setHoistProgress(next);
      triggerTriColorCelebration();

      if (next === 100) {
        setIsHoisted(true);
        const newCount = totalHoists + 1;
        setTotalHoists(newCount);
        localStorage.setItem('flag_hoisted_2026', 'true');
        localStorage.setItem('total_flag_hoists_count', newCount.toString());
        setHoistTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        triggerJetFlypast();
      }
    }
  };

  const handleReset = () => {
    setHoistProgress(0);
    setIsHoisted(false);
    setShowCertificate(false);
    localStorage.removeItem('flag_hoisted_2026');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full h-full max-w-5xl max-h-[96vh] p-4 sm:p-6 md:p-8 relative shadow-2xl border border-amber-300/80 overflow-hidden font-sans flex flex-col justify-between">
        {/* Top Tri-color bar */}
        <div className="absolute top-0 left-0 right-0 h-3 flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer z-30"
        >
          <X size={24} />
        </button>

        {/* Header Title */}
        <div className="text-center space-y-1 mt-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-[11px] font-black tracking-widest text-orange-700 uppercase">
            <Flame size={13} className="text-orange-600 animate-pulse" /> 80th Independence Day Ceremony
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Virtual Flag Hoisting
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mx-auto">
            Pull the ceremonial rope, unfurl the Tiranga & watch the Indian Air Force Flypast! ✈️🇮🇳
          </p>
        </div>

        {/* Flag Pole Visualizer Stage with Dynamic Sky & Fighter Jet Trails */}
        <div
          className="my-3 flex-1 min-h-[260px] sm:min-h-[340px] md:min-h-[380px] rounded-2xl border border-slate-200 relative flex items-end justify-center overflow-hidden p-3 shadow-inner transition-all duration-700"
          style={{
            background: hoistProgress < 40
              ? 'linear-gradient(to bottom, #ffedd5 0%, #fff7ed 60%, #ecfdf5 100%)'
              : hoistProgress < 80
              ? 'linear-gradient(to bottom, #bae6fd 0%, #e0f2fe 60%, #ecfdf5 100%)'
              : 'linear-gradient(to bottom, #7dd3fc 0%, #e0f2fe 60%, #d1fae5 100%)'
          }}
        >
          {/* Petal Canvas Overlay */}
          <canvas ref={petalCanvasRef} className="absolute inset-0 pointer-events-none z-20" />

          {/* Air Force Jet Flypast Animation Overlay */}
          {showJets && (
            <div
              className="absolute top-6 z-30 pointer-events-none transition-all duration-75 flex flex-col gap-1"
              style={{ left: `${jetProgress}%` }}
            >
              {/* Jet 1: Saffron Smoke Trail */}
              <div className="flex items-center">
                <div className="w-24 h-1.5 bg-gradient-to-r from-transparent via-orange-400/80 to-[#FF9933] rounded-full blur-[1px]" />
                <span className="text-xs transform rotate-45">✈️</span>
              </div>
              {/* Jet 2: White Smoke Trail */}
              <div className="flex items-center ml-4">
                <div className="w-28 h-1.5 bg-gradient-to-r from-transparent via-white to-slate-100 rounded-full blur-[1px]" />
                <span className="text-sm transform rotate-45">✈️</span>
              </div>
              {/* Jet 3: Green Smoke Trail */}
              <div className="flex items-center">
                <div className="w-24 h-1.5 bg-gradient-to-r from-transparent via-emerald-400/80 to-[#138808] rounded-full blur-[1px]" />
                <span className="text-xs transform rotate-45">✈️</span>
              </div>
            </div>
          )}

          {/* Cloud Motions */}
          <div className="absolute top-3 left-4 w-24 h-7 bg-white/80 rounded-full blur-[1px] animate-pulse" />
          <div className="absolute top-8 right-6 w-28 h-8 bg-white/70 rounded-full blur-[1px]" />

          {/* Golden Motto Watermark on Apex */}
          {hoistProgress === 100 && (
            <div className="absolute top-3 right-3 z-20 text-center animate-in fade-in zoom-in duration-500">
              <span className="text-[11px] font-black tracking-widest text-amber-800 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                <Sparkles size={11} className="text-amber-600 animate-spin" /> सत्यमेव जयते 🇮🇳
              </span>
            </div>
          )}

          {/* Altitude Gauge Line */}
          <div className="absolute left-3 top-10 bottom-6 flex flex-col justify-between text-[9px] font-mono font-bold text-slate-500 pointer-events-none">
            <span>Apex 50m</span>
            <span>25m</span>
            <span>Ground 0m</span>
          </div>

          {/* Flag Pole Base Steps */}
          <div className="flex flex-col items-center z-10">
            <div className="w-24 h-2 bg-slate-400 rounded-t-sm border border-slate-500/60" />
            <div className="w-32 h-3 bg-slate-300 rounded-t-md border border-slate-400/60 shadow-sm" />
          </div>

          {/* Flag Pole Stem */}
          <div className="w-3 h-52 bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 rounded-t-full relative z-10">
            {/* Golden Brass Finial Top */}
            <div className="absolute -top-3.5 -left-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 border border-amber-600 shadow-md flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-amber-200 animate-ping" />
            </div>

            {/* Pulley Rope Line */}
            <div className="absolute top-0 bottom-0 -left-2 w-0.5 border-l border-dashed border-slate-400 opacity-60" />

            {/* Rising Flag Cloth */}
            <div
              className={`absolute left-3 transition-all duration-700 ease-out flex items-center shadow-2xl rounded-r-md overflow-hidden border border-slate-300 ${
                hoistProgress === 100 ? 'animate-[pulse_2.5s_infinite]' : ''
              }`}
              style={{
                bottom: `${(hoistProgress / 100) * 145 + 12}px`,
                width: hoistProgress === 100 ? '140px' : `${Math.max(40, (hoistProgress / 100) * 140)}px`,
                height: '76px',
              }}
            >
              <div className="w-full h-full flex flex-col relative bg-white">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white flex items-center justify-center relative shadow-inner">
                  <AshokaChakra size={24} animate={hoistProgress === 100} />
                </div>
                <div className="flex-1 bg-[#138808]" />
                {/* Waving Sheen Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-white/25 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Meter & Interactive Controls */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-black text-slate-700">
              <span>Rope Tension & Elevation Gauge</span>
              <span className="text-orange-600 font-mono">{hoistProgress}% Hoisted</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#FF9933] via-[#000080] to-[#138808] transition-all duration-500 rounded-full shadow"
                style={{ width: `${hoistProgress}%` }}
              />
            </div>
          </div>

          {hoistProgress < 100 ? (
            <button
              onClick={handleRopePullStep}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#FF9933] via-[#e87e13] to-[#138808] text-white font-black text-sm shadow-xl hover:shadow-orange-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronUp size={20} className="animate-bounce" />
              <span>Pull Rope to Hoist Tiranga</span>
            </button>
          ) : (
            /* Hoisting Completion & Actions */
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-white to-orange-500/10 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-xs">Flag Hoisted & Tiranga Unfurled! 🇮🇳</p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      Hoisted at {hoistTime || '15 Aug'} by {userProfile?.name || 'Student'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={triggerJetFlypast}
                  className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-black uppercase shrink-0 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Flypast ✈️</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 px-3 text-slate-600 hover:text-slate-900 font-bold text-xs bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <RefreshCw size={13} /> Re-Hoist Flag
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Hoisting Counter Footer */}
        <div className="text-center pt-2 mt-2 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Campus Flag Hoistings Count: <span className="text-slate-800 font-mono font-black">{totalHoists} Times 🇮🇳</span>
          </p>
        </div>
      </div>
    </div>
  );
}
