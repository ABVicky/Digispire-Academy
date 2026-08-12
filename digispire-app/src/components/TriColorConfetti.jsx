import { useEffect, useRef } from 'react';

export default function TriColorConfetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const colors = [
      '#FF9933', // Saffron
      '#FFFFFF', // White
      '#138808', // India Green
      '#000080', // Ashoka Navy
      '#FFD700', // Gold
    ];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const spawnConfetti = (count = 80) => {
      const newParticles = [];
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (canvas.height * 0.3) - 20,
          vx: (Math.random() - 0.5) * 6,
          vy: Math.random() * 4 + 2,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          vRotation: (Math.random() - 0.5) * 8,
          opacity: 1,
          shape: Math.random() > 0.4 ? 'rect' : 'circle',
        });
      }
      particles = [...particles, ...newParticles];
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;
        p.opacity -= 0.005;

        if (p.opacity <= 0 || p.y > canvas.height) {
          particles.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    const handleTrigger = () => {
      spawnConfetti(100);
      cancelAnimationFrame(animationFrameId);
      render();
    };

    window.addEventListener('trigger-tricolor-confetti', handleTrigger);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('trigger-tricolor-confetti', handleTrigger);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
