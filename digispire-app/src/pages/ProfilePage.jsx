import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User, Phone, Mail, GraduationCap, Lock, Key,
  CheckCircle2, AlertCircle, Camera, LogOut, ChevronRight, Loader2,
  ShieldCheck, Settings
} from 'lucide-react';

export default function ProfilePage() {
  const { userProfile, changePassword, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('general'); // general, security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // { type, message }
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await changePassword(newPassword);
      setStatus({ type: 'success', message: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to update password. Try logging in again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image must be less than 2MB.' });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      const storageRef = ref(storage, `profiles/${userProfile.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile({ photoURL: url });
      setStatus({ type: 'success', message: 'Profile picture updated!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to upload image.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Account Settings</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Manage your digital identity and security</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-slate-100 shadow-sm mx-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-3.5 rounded-[1.5rem] text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'general' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User size={14} /> My Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-3.5 rounded-[1.5rem] text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'security' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Lock size={14} /> Security
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'general' ? (
          /* Profile Card */
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="relative h-32 bg-gradient-to-r from-[#255A84] to-[#1a4261]">
              <div className="absolute -bottom-12 left-8">
                <div className="h-24 w-24 rounded-3xl bg-white p-1.5 shadow-xl">
                  <div 
                    onClick={handleImageClick}
                    className="h-full w-full rounded-2xl bg-slate-100 flex items-center justify-center text-[#255A84] font-bold text-3xl border border-slate-50 relative group overflow-hidden cursor-pointer"
                  >
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
                    ) : (
                      userProfile?.name?.charAt(0)
                    )}
                    
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {uploading ? (
                        <Loader2 size={24} className="text-white animate-spin" />
                      ) : (
                        <Camera size={24} className="text-white" />
                      )}
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>
            </div>

            <div className="pt-16 pb-8 px-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{userProfile?.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${userProfile?.role === 'admin' ? 'bg-[#255A84] text-white' : 'bg-orange-50 text-[#F48B1F]'}`}>
                      {userProfile?.role}
                    </span>
                    {userProfile?.role === 'student' && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        ID: {userProfile?.studentId}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-red-500 font-bold text-xs hover:bg-red-50 px-4 py-2 rounded-xl transition"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Phone Number</p>
                      <p className="text-sm font-semibold mt-1">{userProfile?.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Email Address</p>
                      <p className="text-sm font-semibold mt-1">{userProfile?.email || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        {userProfile?.role === 'admin' ? 'Position' : 'Enrolled Course'}
                      </p>
                      <p className="text-sm font-semibold mt-1">{userProfile?.course || (userProfile?.role === 'admin' ? 'Educator' : 'General')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Batch Assignment</p>
                      <p className="text-sm font-semibold mt-1 capitalize">
                        {userProfile?.batchId} {userProfile?.isIntern ? ' (Intern)' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Security Card */
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-[#255A84] flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Security Credentials</h3>
                <p className="text-xs text-slate-400 font-medium">Update your password to keep your account secure</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
              {status && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.message}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">New Password</label>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none shadow-inner"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white font-bold rounded-2xl transition shadow-xl shadow-[#255A84]/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                  {saving ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>

            <div className="mt-10 p-6 bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Security Tip</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Use a combination of uppercase, lowercase, numbers, and symbols for a stronger password. Avoid using personal information like your birthdate or phone number.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
