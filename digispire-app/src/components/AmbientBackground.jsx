import { useState, useEffect, useRef } from 'react';

export default function AmbientBackground({ variant = 'light' }) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5, pixelX: 0, pixelY: 0 });
  const [ripples, setRipples] = useState([]);
  const targetPos = useRef({ x: 0.5, y: 0.5, pixelX: 0, pixelY: 0 });
  const currentPos = useRef({ x: 0.5, y: 0.5, pixelX: 0, pixelY: 0 });
  const animFrameId = useRef(null);

  useEffect(() => {
    // Initial center coordinates
    const initialX = window.innerWidth / 2;
    const initialY = window.innerHeight / 2;
    targetPos.current = { x: 0, y: 0, pixelX: initialX, pixelY: initialY };
    currentPos.current = { x: 0, y: 0, pixelX: initialX, pixelY: initialY };
    setMousePos({ x: 0, y: 0, pixelX: initialX, pixelY: initialY });

    const handleMouseMove = (e) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const normY = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      targetPos.current = { x: normX, y: normY, pixelX: e.clientX, pixelY: e.clientY };
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        const touch = e.touches[0];
        const normX = (touch.clientX / window.innerWidth - 0.5) * 2;
        const normY = (touch.clientY / window.innerHeight - 0.5) * 2;
        targetPos.current = { x: normX, y: normY, pixelX: touch.clientX, pixelY: touch.clientY };
      }
    };

    const handleClick = (e) => {
      const newRipple = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY
      };
      setRipples((prev) => [...prev.slice(-4), newRipple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 1200);
    };

    // Smooth Lerp loop for buttery 60/120fps parallax physics
    const updatePhysics = () => {
      const lerpFactor = 0.06;
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerpFactor;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerpFactor;
      currentPos.current.pixelX += (targetPos.current.pixelX - currentPos.current.pixelX) * lerpFactor;
      currentPos.current.pixelY += (targetPos.current.pixelY - currentPos.current.pixelY) * lerpFactor;

      setMousePos({
        x: currentPos.current.x,
        y: currentPos.current.y,
        pixelX: currentPos.current.pixelX,
        pixelY: currentPos.current.pixelY
      });

      animFrameId.current = requestAnimationFrame(updatePhysics);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    animFrameId.current = requestAnimationFrame(updatePhysics);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleClick);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  const offsetX = mousePos.x;
  const offsetY = mousePos.y;

  if (variant === 'dark') {
    return (
      <div className="ambient-bg-wrapper pointer-events-none fixed inset-0 overflow-hidden -z-10 select-none">
        {/* Dynamic Cursor Spotlight Light */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[110px] opacity-40 transition-opacity duration-500 pointer-events-none"
          style={{
            transform: `translate3d(${mousePos.pixelX - 300}px, ${mousePos.pixelY - 300}px, 0)`,
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(99, 102, 241, 0.15) 45%, transparent 70%)'
          }}
        />

        {/* Deep Atmosphere Gradients with Parallax Shift */}
        <div
          className="absolute -top-40 -left-40 w-[650px] h-[650px] bg-gradient-to-br from-[#1E3A5F]/40 via-[#0284C7]/20 to-transparent rounded-full blur-[100px] transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${offsetX * -25}px, ${offsetY * -25}px, 0)` }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-gradient-to-tl from-[#C2410C]/35 via-[#F59E0B]/15 to-transparent rounded-full blur-[120px] transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${offsetX * 30}px, ${offsetY * 30}px, 0)` }}
        />

        {/* Interactive Concentric Orbit Rings (Linear / Stripe style) */}
        <div
          className="absolute -top-32 -right-32 w-[680px] h-[680px] rounded-full border border-white/[0.07] transition-transform duration-500 ease-out"
          style={{ transform: `translate3d(${offsetX * -18}px, ${offsetY * -18}px, 0)` }}
        />
        <div
          className="absolute -top-16 -right-16 w-[480px] h-[480px] rounded-full border border-white/[0.06] border-dashed transition-transform duration-500 ease-out"
          style={{ transform: `translate3d(${offsetX * -30}px, ${offsetY * -30}px, 0)` }}
        />
        <div
          className="absolute top-4 right-4 w-[280px] h-[280px] rounded-full border border-white/[0.08] transition-transform duration-500 ease-out"
          style={{ transform: `translate3d(${offsetX * -45}px, ${offsetY * -45}px, 0)` }}
        />

        {/* Interactive Floating 3D Frosted Glass Polygons */}
        <div
          className="absolute top-24 right-[15%] w-28 h-28 rounded-3xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/20 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out hidden md:block"
          style={{
            transform: `translate3d(${offsetX * 40}px, ${offsetY * 40}px, 0) rotate(${12 + offsetX * 15}deg) rotateX(${offsetY * -20}deg) rotateY(${offsetX * 20}deg)`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-cyan-500/10 rounded-3xl" />
        </div>

        <div
          className="absolute bottom-32 left-[8%] w-36 h-36 rounded-3xl bg-gradient-to-tr from-[#C2410C]/25 to-white/[0.04] border border-white/15 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out hidden md:block"
          style={{
            transform: `translate3d(${offsetX * -45}px, ${offsetY * -45}px, 0) rotate(${-12 + offsetX * -12}deg) rotateX(${offsetY * 20}deg) rotateY(${offsetX * -20}deg)`
          }}
        >
          <div className="absolute bottom-3 right-3 w-5 h-5 rounded-lg border border-[#F59E0B]/40 rotate-45" />
        </div>

        {/* Click Harmonic Pulse Ripples */}
        {ripples.map((r) => (
          <div
            key={r.id}
            className="absolute rounded-full border border-cyan-400/40 pointer-events-none animate-ping"
            style={{
              left: r.x - 40,
              top: r.y - 40,
              width: 80,
              height: 80,
              animationDuration: '1.2s'
            }}
          />
        ))}

        {/* Subtle Grid with Crosshairs */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_65%_65%_at_50%_50%,#000_60%,transparent_100%)] opacity-70" />
      </div>
    );
  }

  // LIGHT THEME (Main App)
  return (
    <div className="ambient-bg-wrapper pointer-events-none fixed inset-0 overflow-hidden -z-10 select-none">
      {/* ── 1. Interactive Cursor Follower Spotlight ── */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[90px] opacity-60 transition-opacity duration-300 pointer-events-none"
        style={{
          transform: `translate3d(${mousePos.pixelX - 250}px, ${mousePos.pixelY - 250}px, 0)`,
          background: 'radial-gradient(circle, rgba(30, 58, 95, 0.08) 0%, rgba(56, 189, 248, 0.05) 45%, transparent 70%)'
        }}
      />

      {/* ── 2. Atmospheric Parallax Gradient Auroras ── */}
      <div
        className="absolute -top-32 -right-32 w-[650px] h-[650px] bg-gradient-to-br from-[#1E3A5F]/15 via-[#0284C7]/08 to-transparent rounded-full blur-[80px] transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(${offsetX * -20}px, ${offsetY * -20}px, 0)` }}
      />
      <div
        className="absolute -bottom-40 -left-32 w-[700px] h-[700px] bg-gradient-to-tr from-[#C2410C]/12 via-[#F59E0B]/08 to-transparent rounded-full blur-[90px] transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(${offsetX * 25}px, ${offsetY * 25}px, 0)` }}
      />
      <div
        className="absolute top-1/2 left-1/3 w-[550px] h-[550px] bg-gradient-to-br from-[#6366F1]/07 via-[#0D9488]/06 to-transparent rounded-full blur-[100px] transition-transform duration-700 ease-out"
        style={{ transform: `translate3d(${offsetX * 15}px, ${offsetY * 15}px, 0)` }}
      />

      {/* ── 3. Interactive Concentric Orbit Rings (Stripe/Linear style) ── */}
      <div
        className="absolute -top-48 -right-48 w-[820px] h-[820px] rounded-full border border-slate-300/40 transition-transform duration-700 ease-out pointer-events-none"
        style={{ transform: `translate3d(${offsetX * -15}px, ${offsetY * -15}px, 0)` }}
      />
      <div
        className="absolute -top-24 -right-24 w-[600px] h-[600px] rounded-full border border-slate-300/30 border-dashed transition-transform duration-700 ease-out pointer-events-none"
        style={{ transform: `translate3d(${offsetX * -25}px, ${offsetY * -25}px, 0)` }}
      />
      <div
        className="absolute 0 0 w-[380px] h-[380px] rounded-full border border-[#1E3A5F]/20 transition-transform duration-700 ease-out pointer-events-none"
        style={{ transform: `translate3d(${offsetX * -35}px, ${offsetY * -35}px, 0)` }}
      />
      
      {/* Dynamic orbital glowing data nodes */}
      <div
        className="absolute top-44 right-[440px] w-3 h-3 rounded-full bg-[#1E3A5F]/60 shadow-[0_0_12px_rgba(30,58,95,0.5)] hidden lg:block transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(${offsetX * -30}px, ${offsetY * -30}px, 0)` }}
      />
      <div
        className="absolute top-[290px] right-[190px] w-2.5 h-2.5 rounded-full bg-[#C2410C]/70 shadow-[0_0_12px_rgba(194,65,12,0.5)] hidden lg:block transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(${offsetX * -40}px, ${offsetY * -40}px, 0)` }}
      />

      {/* ── 4. Interactive 3D Frosted Glass Geometric Shapes (Raycast / Apple style) ── */}
      {/* Top Right Floating Glass Cube with 3D Tilt Parallax */}
      <div
        className="absolute top-20 right-[12%] w-26 h-26 rounded-2xl bg-white/45 border border-white/90 shadow-xl shadow-slate-900/5 backdrop-blur-md transition-transform duration-300 ease-out hidden xl:block"
        style={{
          transform: `translate3d(${offsetX * 45}px, ${offsetY * 45}px, 0) rotate(${12 + offsetX * 16}deg) rotateX(${offsetY * -25}deg) rotateY(${offsetX * 25}deg)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-[#1E3A5F]/15 rounded-2xl" />
        <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 rounded-full bg-[#1E3A5F]/25 shadow-xs" />
        <div className="absolute bottom-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-500/30" />
      </div>

      {/* Bottom Left Floating Glass Prism with 3D Tilt Parallax */}
      <div
        className="absolute bottom-28 left-[6%] w-32 h-32 rounded-3xl bg-white/40 border border-white/90 shadow-xl shadow-orange-950/5 backdrop-blur-md transition-transform duration-300 ease-out hidden xl:block"
        style={{
          transform: `translate3d(${offsetX * -45}px, ${offsetY * -45}px, 0) rotate(${-12 + offsetX * -14}deg) rotateX(${offsetY * 25}deg) rotateY(${offsetX * -25}deg)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-[#C2410C]/15 via-transparent to-white/70 rounded-3xl" />
        <div className="absolute bottom-3.5 right-3.5 w-5 h-5 rounded-lg border border-[#C2410C]/40 rotate-45" />
        <div className="absolute top-3.5 left-3.5 w-2.5 h-2.5 rounded-full bg-[#F59E0B]/30" />
      </div>

      {/* Center Subtle Pill Capsule Silhouette */}
      <div
        className="absolute top-[45%] right-[5%] w-48 h-14 rounded-full bg-white/30 border border-white/70 shadow-md backdrop-blur-sm transition-transform duration-500 ease-out hidden 2xl:block opacity-80"
        style={{
          transform: `translate3d(${offsetX * 25}px, ${offsetY * 25}px, 0) rotate(${-6 + offsetY * 8}deg)`
        }}
      >
        <div className="h-full w-full flex items-center px-4 gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1E3A5F]/40" />
          <div className="h-1.5 w-20 bg-slate-300/50 rounded-full" />
        </div>
      </div>

      {/* ── 5. Click Harmonic Pulse Ripples ── */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="absolute rounded-full border border-[#1E3A5F]/30 pointer-events-none animate-ping"
          style={{
            left: r.x - 40,
            top: r.y - 40,
            width: 80,
            height: 80,
            animationDuration: '1.2s'
          }}
        />
      ))}

      {/* ── 6. Subtle Isometric Crosshair Dot Grid Texture ── */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(100,116,139,0.22)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_50%,transparent_100%)] opacity-75" />

      {/* ── 7. Directional Corner Light Beams (Angular Sheen) ── */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-[radial-gradient(ellipse_at_top_right,rgba(30,58,95,0.1),transparent_65%)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-[radial-gradient(ellipse_at_bottom_left,rgba(194,65,12,0.08),transparent_65%)] pointer-events-none" />
    </div>
  );
}
