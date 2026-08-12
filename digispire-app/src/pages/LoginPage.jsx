import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Mail, Eye, EyeOff } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { isIndependenceDayActive } from '../utils/independenceDayTheme';

export default function LoginPage() {
  const { userProfile, loading: authLoading, loginAdmin, loginStudent } = useAuth();
  const navigate = useNavigate();
  const isFestiveActive = isIndependenceDayActive();

  const [tab, setTab] = useState('admin'); // 'admin' | 'student'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Interactive background & custom cursor state
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  
  const springConfig = { damping: 30, stiffness: 300, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [cursorHovered, setCursorHovered] = useState(false);
  const [cursorClicked, setCursorClicked] = useState(false);
  const [particles, setParticles] = useState([]);

  const spawnParticles = (clientX, clientY) => {
    const flagColors = ['#FF9933', '#FFFFFF', '#138808', '#000080'];
    const brandColors = ['#255A84', '#F48B1F'];
    const activePalette = isFestiveActive ? flagColors : brandColors;

    const newParticles = Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const velocity = 60 + Math.random() * 90;
      const dx = Math.cos(angle) * velocity;
      const dy = Math.sin(angle) * velocity;
      const rot = (Math.random() - 0.5) * 360;
      return {
        id: Date.now() + i + Math.random(),
        x: clientX,
        y: clientY,
        dx: `${dx}px`,
        dy: `${dy}px`,
        rot: `${rot}deg`,
        size: 3 + Math.random() * 5,
        color: activePalette[Math.floor(Math.random() * activePalette.length)],
        shape: Math.random() > 0.5 ? 'circle' : 'square',
      };
    });
    setParticles((prev) => [...prev, ...newParticles].slice(-40));
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setCursorClicked(true);
    const handleMouseUp = () => setCursorClicked(false);
    
    const handleMouseOver = (e) => {
      const target = e.target;
      if (!target) return;
      if (
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'INPUT' || 
        target.closest('button') || 
        target.closest('a') ||
        target.closest('input')
      ) {
        setCursorHovered(true);
      } else {
        setCursorHovered(false);
      }
    };

    const handleMouseClick = (e) => {
      if (window.innerWidth > 768 && !('ontouchstart' in window)) {
        spawnParticles(e.clientX, e.clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('click', handleMouseClick);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('click', handleMouseClick);
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (particles.length > 0) {
      const interval = setInterval(() => {
        setParticles((prev) => prev.filter((p) => Date.now() - p.id < 800));
      }, 300);
      return () => clearInterval(interval);
    }
  }, [particles.length]);

  // Get style to pull background shapes towards the cursor (magnetic parallax effect)
  const getMagneticStyle = (factor) => {
    if (isMobile) return {};
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 500;
    const tx = (mousePos.x - centerX) * factor;
    const ty = (mousePos.y - centerY) * factor;
    return {
      transform: `translate3d(${tx}px, ${ty}px, 0)`,
      transition: 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)', // smooth springy inertia
    };
  };

  useEffect(() => {
    if (!authLoading && userProfile) {
      if (userProfile.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [userProfile, authLoading, navigate]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { profile } = await loginAdmin(email, password);
      if (profile?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        setError('This account does not have admin access.');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cleanPhone = phone.trim();
      const { profile } = await loginStudent(cleanPhone, studentPassword);
      if (profile) {
        navigate('/student/dashboard');
      } else {
        setError('Student record not found. Please contact your educator.');
      }
    } catch (err) {
      console.error('Student Login Error:', err.code, err.message);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect phone number or password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Account not registered. Please contact your educator.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Login provider not enabled. Please ask Admin to enable "Email/Password" in Firebase Console.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid phone number format.');
      } else {
        setError(`Login failed: ${err.code || 'Unknown error'}. Please check your connection.`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#020617] via-[#0b1a29] to-[#140b02] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Spots */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full ambient-glow-1 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full ambient-glow-2 pointer-events-none" />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen-ios bg-gradient-to-tr from-[#020617] via-[#0b1a29] to-[#140b02] flex items-center justify-center p-4 py-8 relative overflow-auto font-sans">
      {/* Repeating SVG Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

      {/* Floating Geometric Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Viewport Frame Brackets */}
        <div className="absolute top-6 left-6 w-8 h-8 border-t border-l border-white/15" style={getMagneticStyle(0.015)} />
        <div className="absolute top-6 right-6 w-8 h-8 border-t border-r border-white/15" style={getMagneticStyle(0.015)} />
        <div className="absolute bottom-6 left-6 w-8 h-8 border-b border-l border-white/15" style={getMagneticStyle(0.015)} />
        <div className="absolute bottom-6 right-6 w-8 h-8 border-b border-r border-white/15" style={getMagneticStyle(0.015)} />

        {/* Animated Dashed Ring */}
        <div className="absolute top-[8%] right-[10%] w-80 h-80 rounded-full border border-dashed border-white/12 animate-[spin_140s_linear_infinite]" style={getMagneticStyle(0.03)} />
        {/* Rotating Nested Solid Ring */}
        <div className="absolute bottom-[6%] left-[6%] w-[450px] h-[450px] rounded-full border border-white/12 border-double animate-[spin_200s_linear_infinite]" style={getMagneticStyle(0.02)} />
        
        {/* Tech Concentric HUD Rings */}
        <svg className="absolute top-[40%] right-[5%] w-44 h-44 text-white/15 animate-[spin_80s_linear_infinite]" viewBox="0 0 100 100" style={getMagneticStyle(0.04)}>
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 8" fill="none" />
          <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" strokeDasharray="30 10 5 10" fill="none" />
          <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="0.5" fill="none" />
          <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" />
        </svg>

        {/* Isometric 3D Cube Wireframe */}
        <svg className="absolute top-[18%] left-[7%] w-24 h-24 text-white/15 animate-[spin_50s_linear_infinite]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.75" style={getMagneticStyle(0.05)}>
          <path d="M50,10 L90,30 L90,70 L50,90 L10,70 L10,30 Z" />
          <path d="M50,10 L50,90" />
          <path d="M50,50 L90,30" />
          <path d="M50,50 L10,30" />
          <line x1="10" y1="30" x2="50" y2="50" />
          <line x1="90" y1="30" x2="50" y2="50" />
          <line x1="90" y1="70" x2="50" y2="90" />
          <line x1="10" y1="70" x2="50" y2="90" />
        </svg>

        {/* Floating Triangle wireframe */}
        <svg className="absolute top-[68%] right-[10%] w-24 h-24 text-white/15 animate-[pulse_10s_ease-in-out_infinite]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" style={getMagneticStyle(0.045)}>
          <polygon points="50,15 90,85 10,85" />
        </svg>

        {/* Tech Radar/Grid Target Coordinate */}
        <svg className="absolute top-[52%] left-[12%] w-32 h-32 text-white/15 animate-[pulse_6s_ease-in-out_infinite]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" style={getMagneticStyle(0.035)}>
          <circle cx="50" cy="50" r="10" />
          <circle cx="50" cy="50" r="30" strokeDasharray="2 4" />
          <line x1="50" y1="10" x2="50" y2="90" />
          <line x1="10" y1="50" x2="95" y2="50" />
        </svg>

        {/* Dotted Sine Wave */}
        <svg className="absolute bottom-[10%] right-[30%] w-72 h-16 text-white/15" viewBox="0 0 300 50" fill="none" stroke="currentColor" strokeWidth="0.75" style={getMagneticStyle(0.025)}>
          <path d="M0,25 Q37.5,5 75,25 T150,25 T225,25 T300,25" strokeDasharray="3 5" />
        </svg>

        {/* Floating Squares/Crosses/Particles */}
        <div className="absolute top-[25%] left-[18%] text-white/30 text-lg font-light select-none animate-pulse" style={getMagneticStyle(0.07)}>+</div>
        <div className="absolute bottom-[35%] right-[22%] text-white/30 text-lg font-light select-none animate-pulse" style={getMagneticStyle(0.07)}>+</div>
        <div className="absolute top-[45%] left-[32%] text-white/20 text-xs font-light select-none animate-pulse" style={getMagneticStyle(0.06)}>×</div>
        <div className="absolute bottom-[52%] right-[42%] text-white/20 text-xs font-light select-none animate-pulse" style={getMagneticStyle(0.06)}>×</div>
        <div className="absolute top-[75%] left-[28%] text-white/20 text-sm font-light select-none animate-pulse" style={getMagneticStyle(0.05)}>■</div>
        <div className="absolute top-[15%] right-[32%] text-white/20 text-sm font-light select-none animate-pulse" style={getMagneticStyle(0.05)}>▲</div>
        <div className="absolute top-[18%] left-[72%] text-white/20 text-[8px] animate-ping" style={getMagneticStyle(0.08)}>✦</div>
        <div className="absolute bottom-[22%] left-[38%] text-white/20 text-[8px] animate-ping" style={getMagneticStyle(0.08)}>✦</div>
        <div className="absolute top-[58%] left-[24%] w-2 h-2 rounded-full border border-white/20 animate-bounce" style={getMagneticStyle(0.05)} />
        <div className="absolute bottom-[15%] right-[16%] w-3 h-3 rounded-full border border-white/20 animate-pulse" style={getMagneticStyle(0.04)} />
      </div>

      {/* Interactive Mouse Spotlight (hidden on mobile) */}
      {!isMobile && (
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(37, 90, 132, 0.1), rgba(244, 139, 31, 0.02), transparent 80%)`
          }}
        />
      )}

      {/* Custom Cursor Follower (only on desktop) */}
      {!isMobile && (
        <>
          {/* Fast Inner Dot */}
          <motion.div
            className="fixed top-0 left-0 w-2 h-2 rounded-full bg-orange-500 pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2"
            style={{
              x: mouseX,
              y: mouseY,
            }}
          />
          {/* Delayed Springy Outer Ring */}
          <motion.div
            className="fixed top-0 left-0 rounded-full border pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2"
            animate={{
              width: cursorHovered ? 44 : 24,
              height: cursorHovered ? 44 : 24,
              backgroundColor: cursorClicked ? 'rgba(244, 139, 31, 0.12)' : 'rgba(244, 139, 31, 0)',
              borderColor: cursorHovered ? '#255A84' : '#F48B1F',
              borderWidth: cursorHovered ? '2px' : '1px',
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            style={{
              x: cursorX,
              y: cursorY,
            }}
          />
        </>
      )}

      {/* Glow Spots */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full ambient-glow-2 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 page-transition my-auto">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-6">
          {isFestiveActive && (
            <div className="mb-3 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 via-white/20 to-emerald-500/20 border border-white/20 text-white text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 backdrop-blur-md shadow-lg animate-pulse">
              <span>🇮🇳</span>
              <span>Happy Independence Day</span>
              <span>🇮🇳</span>
            </div>
          )}
          <img src="/logo.png" alt="DIGISPIRE Academy" className="h-16 w-auto object-contain rounded-2xl shadow-2xl mb-3" />
          <h1 className="text-2xl font-heading font-black text-white tracking-tight">DIGISPIRE</h1>
          <p className="text-blue-300 text-[10px] font-bold tracking-[0.2em] uppercase mt-1 opacity-80 font-sans">Academy Portal</p>
        </div>

        {/* Glassmorphic Login Box */}
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden border border-white/20">
          {/* Tab Switcher */}
          <div className="flex p-2 bg-slate-50/50 border-b border-slate-100/60">
            <button
              onClick={() => { setTab('admin'); setError(''); }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${tab === 'admin' ? 'bg-[#255A84] text-white shadow-md shadow-[#255A84]/20 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Faculty Portal
            </button>
            <button
              onClick={() => { setTab('student'); setError(''); }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${tab === 'student' ? 'bg-[#F48B1F] text-white shadow-md shadow-[#F48B1F]/20 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Student Portal
            </button>
          </div>

          <div className="p-5 sm:p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="h-5 w-5 bg-rose-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-extrabold text-[10px]">!</div>
                {error}
              </div>
            )}

            {/* Admin Login */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@digispire.in"
                      className="input-premium pl-12"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-premium pl-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors z-10"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 btn-primary-premium mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Faculty Portal'}
                </button>
              </form>
            )}

            {/* Student Login */}
            {tab === 'student' && (
              <form onSubmit={handleStudentLogin} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="input-premium pl-12"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={studentPassword}
                      onChange={e => setStudentPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="input-premium pl-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors z-10"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 btn-secondary-premium mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Student Portal'}
                </button>
                <p className="text-center text-[11px] text-slate-400 font-medium px-4 leading-normal">
                  Default credentials are provided by your educator. Please reset password after first enrollment access.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
            © 2026 DIGISPIRE Academy · digispire.in
          </p>
        </div>
      </div>
      {/* Click Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="click-particle fixed pointer-events-none z-50"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            '--dx': p.dx,
            '--dy': p.dy,
            '--rot': p.rot,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
      <style>{`
        @keyframes particle-burst {
          0% {
            transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate3d(var(--dx), var(--dy), 0) scale(0.1) rotate(var(--rot));
            opacity: 0;
          }
        }
        .click-particle {
          animation: particle-burst 0.75s cubic-bezier(0.12, 0.85, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
