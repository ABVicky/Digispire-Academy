import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Mail, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { loginAdmin, loginStudent } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('admin'); // 'admin' | 'student'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      // Clean phone number (ensure it matches what was saved)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#255A84] via-[#1a4261] to-[#0f2d45] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl border border-slate-100/50">
            <img src="/logo.png" alt="DIGISPIRE Academy" className="h-20 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">DIGISPIRE</h1>
          <p className="text-blue-300 text-sm font-medium tracking-widest uppercase mt-1 opacity-80">Academy Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-white/20">
          {/* Tab Switcher */}
          <div className="flex p-2 bg-slate-50 border-b border-slate-100">
            <button
              onClick={() => { setTab('admin'); setError(''); }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${tab === 'admin' ? 'bg-[#255A84] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Admin
            </button>
            <button
              onClick={() => { setTab('student'); setError(''); }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${tab === 'student' ? 'bg-[#F48B1F] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Student
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center flex-shrink-0">!</div>
                {error}
              </div>
            )}

            {/* Admin Login */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@digispire.in"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] focus:ring-4 focus:ring-[#255A84]/10 transition-all outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] focus:ring-4 focus:ring-[#255A84]/10 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white font-bold rounded-2xl transition-all duration-300 text-sm shadow-xl shadow-[#255A84]/20 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In as Admin'}
                </button>
              </form>
            )}

            {/* Student Login */}
            {tab === 'student' && (
              <form onSubmit={handleStudentLogin} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#F48B1F] focus:ring-4 focus:ring-[#F48B1F]/10 transition-all outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={studentPassword}
                      onChange={e => setStudentPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#F48B1F] focus:ring-4 focus:ring-[#F48B1F]/10 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#F48B1F] hover:bg-[#cc7214] text-white font-bold rounded-2xl transition-all duration-300 text-sm shadow-xl shadow-[#F48B1F]/20 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Logging in...' : 'Sign In as Student'}
                </button>
                <p className="text-center text-[10px] text-slate-400 font-medium px-4">
                  Default password is provided by your educator. Change it after your first login.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-widest">
            © 2024 DIGISPIRE Academy · digispire.in
          </p>
        </div>
      </div>
    </div>
  );
}
