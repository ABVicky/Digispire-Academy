import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Mail, Eye, EyeOff, ShieldCheck, GraduationCap, Shield } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';

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

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setError('');
    setShowPassword(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { profile } = await loginAdmin(email, password);
      if (profile?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        setError('This account does not have administrative privileges.');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid institutional email or password. Please verify your credentials.');
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
        setError('Student academic record not found. Please contact the administrative office.');
      }
    } catch (err) {
      console.error('Student Login Error:', err.code, err.message);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect registered phone number or access password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Account is not registered in the academic registry.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Authentication provider unavailable. Please contact system administrator.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid phone number format.');
      } else {
        setError(`Authentication failed: ${err.code || 'Network error'}. Please check your connection.`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-3 border-[#1E3A5F] border-t-transparent" />
          <p className="text-slate-400 text-xs font-semibold tracking-wider">Verifying Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-ios bg-[#0A0F1D] flex items-center justify-center p-4 py-10 relative overflow-hidden font-sans selection:bg-[#1E3A5F] selection:text-white">
      <AmbientBackground variant="dark" />

      <div className="w-full max-w-md relative z-10 my-auto">
        {/* Institutional Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-white rounded-2xl border border-slate-700/60 p-2.5 shadow-2xl flex items-center justify-center mb-4">
            <img src="/logo.png" alt="DIGISPIRE Academy" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight">DIGISPIRE ACADEMY</h1>
          <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase mt-1">Official Academic Portal</p>
        </div>

        {/* Portal Authentication Card */}
        <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
          {/* Segmented Switcher */}
          <div className="grid grid-cols-2 p-1.5 bg-[#0F172A]/70 border-b border-slate-700/70 gap-1">
            <button
              type="button"
              onClick={() => handleTabSwitch('admin')}
              className={`py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === 'admin' 
                  ? 'bg-[#1E3A5F] text-white shadow-sm border border-slate-600/50' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Faculty & Staff</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('student')}
              className={`py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === 'student' 
                  ? 'bg-[#C2410C] text-white shadow-sm border border-orange-500/50' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap size={14} />
              <span>Student Access</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs font-medium flex items-start gap-3">
                <Shield size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Faculty Form */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label htmlFor="faculty-email" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      id="faculty-email"
                      required
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="faculty@digispire.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0F172A] border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="faculty-password" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Account Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      id="faculty-password"
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#0F172A] border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer z-20"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#1E3A5F] hover:bg-[#2B5282] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm border border-slate-600 mt-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Authenticating Official Session...' : 'Sign In to Faculty Portal'}
                </button>
              </form>
            )}

            {/* Student Form */}
            {tab === 'student' && (
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div>
                  <label htmlFor="student-phone" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      id="student-phone"
                      required
                      type="tel"
                      autoComplete="username"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0F172A] border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FB923C] focus:ring-1 focus:ring-[#FB923C] transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="student-password" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Academic Access Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      id="student-password"
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={studentPassword}
                      onChange={e => setStudentPassword(e.target.value)}
                      placeholder="Enter assigned password"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#0F172A] border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FB923C] focus:ring-1 focus:ring-[#FB923C] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer z-20"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#C2410C] hover:bg-[#EA580C] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm border border-orange-600/50 mt-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Verifying Student Record...' : 'Sign In to Student Portal'}
                </button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                Authorized institutional access only. Unauthorized attempts are logged. For credential support, contact the academic registrar.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-500 text-[11px] font-semibold tracking-wider">
            © 2026 DIGISPIRE ACADEMY · Academic Information System
          </p>
        </div>
      </div>
    </div>
  );
}
