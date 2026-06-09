import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Mail, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { userProfile, loading: authLoading, loginAdmin, loginStudent } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('admin'); // 'admin' | 'student'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Spots */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full ambient-glow-1 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full ambient-glow-2 pointer-events-none" />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen-ios bg-slate-950 flex items-center justify-center p-4 py-8 relative overflow-auto font-sans">
      {/* Glow Spots */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full ambient-glow-2 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 page-transition my-auto">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl mb-3 border border-white/15 shadow-2xl">
            <img src="/logo.png" alt="DIGISPIRE Academy" className="h-12 w-auto object-contain" />
          </div>
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
    </div>
  );
}
