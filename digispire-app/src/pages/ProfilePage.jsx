import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User, Phone, Mail, GraduationCap, Lock, Key,
  CheckCircle2, AlertCircle, Camera, LogOut, Loader2,
  ShieldCheck, CreditCard
} from 'lucide-react';
import QRCode from 'qrcode';

export default function ProfilePage() {
  const { userProfile, changePassword, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('general'); // general, idcard, security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // { type, message }
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (userProfile) {
      const payload = {
        uid: userProfile.uid,
        name: userProfile.name,
        role: userProfile.role,
        studentId: userProfile.studentId || '',
        phone: userProfile.phone || ''
      };
      QRCode.toDataURL(JSON.stringify(payload), {
        margin: 1,
        width: 256
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR code:', err));
    }
  }, [userProfile]);

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

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 150;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image must be less than 5MB.' });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      const compressedDataUrl = await compressImage(file);
      try {
        const storageRef = ref(storage, `profiles/${userProfile.uid}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await updateProfile({ photoURL: url });
        setStatus({ type: 'success', message: 'Profile picture updated!' });
      } catch (storageErr) {
        console.warn('Firebase Storage failed, saving compressed base64 to Firestore:', storageErr);
        await updateProfile({ photoURL: compressedDataUrl });
        setStatus({ type: 'success', message: 'Profile picture updated successfully!' });
      }
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
      <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-100 shadow-sm mx-2">
        <button
          type="button"
          onClick={() => { setActiveTab('general'); setIsFlipped(false); }}
          className={`flex-1 py-3 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeTab === 'general' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User size={13} /> My Profile
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('idcard'); setIsFlipped(false); }}
          className={`flex-1 py-3 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeTab === 'idcard' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <CreditCard size={13} /> Digital ID
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('security'); setIsFlipped(false); }}
          className={`flex-1 py-3 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeTab === 'security' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Lock size={13} /> Security
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'general' ? (
          /* Profile Card */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="relative h-32 bg-gradient-to-r from-[#255A84] to-[#1a4261]">
              <div className="absolute -bottom-12 left-8">
                <div className="h-24 w-24 rounded-2xl bg-white p-1.5 shadow-xl">
                  <div 
                    onClick={handleImageClick}
                    className="h-full w-full rounded-xl bg-slate-100 flex items-center justify-center text-[#255A84] font-bold text-3xl border border-slate-50 relative group overflow-hidden cursor-pointer"
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${userProfile?.role === 'admin' ? 'bg-[#255A84] text-white' : 'bg-orange-50 text-[#F48B1F]'}`}>
                      {userProfile?.role}
                    </span>
                    {userProfile?.role === 'student' && (
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
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
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Phone Number</p>
                      <p className="text-sm font-semibold mt-1">{userProfile?.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Email Address</p>
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
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
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
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Batch Assignment</p>
                      <p className="text-sm font-semibold mt-1">
                        {userProfile?.batchId} {userProfile?.isIntern ? ' (Intern)' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'idcard' ? (
          /* Digital ID Card */
          <div className="flex flex-col items-center gap-6 py-4">
            {/* Interactive Flipping ID Card Container */}
            <div className="id-card-perspective w-80 h-[480px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`id-card-inner rounded-3xl shadow-2xl shadow-[#255A84]/10 border border-slate-100 ${isFlipped ? 'id-card-flipped' : ''}`}>
                
                {/* ── CARD FRONT ── */}
                <div className="id-card-front bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                  {/* Glowing background circles */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0">
                        <img src="/logo.png" alt="DIGISPIRE Logo" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="font-heading font-black tracking-wider text-xs leading-none">DIGISPIRE</h4>
                        <span className="text-[7px] text-[#F48B1F] tracking-[0.25em] font-extrabold uppercase mt-0.5 block">Academy Portal</span>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300 border border-white/15 px-2 py-0.5 rounded bg-white/5">
                      ID Badge
                    </span>
                  </div>

                  {/* Photo & Name */}
                  <div className="text-center my-auto py-2 space-y-4">
                    <div className="h-28 w-28 rounded-2xl bg-white/5 p-1 border border-white/20 shadow-2xl mx-auto overflow-hidden relative">
                      {userProfile?.photoURL ? (
                        <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <div className="h-full w-full bg-[#255A84]/50 flex items-center justify-center text-white text-3xl font-bold font-heading rounded-xl">
                          {userProfile?.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-extrabold text-white tracking-tight leading-snug">{userProfile?.name}</h3>
                      <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1.5 ${
                        userProfile?.role === 'admin' 
                          ? 'bg-[#F48B1F] text-white' 
                          : userProfile?.role === 'educator' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-emerald-500 text-white'
                      }`}>
                        {userProfile?.role === 'admin' ? 'Administrator' : userProfile?.role === 'educator' ? 'Educator' : 'Student'}
                      </span>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div className="border-t border-white/10 pt-4 flex items-end justify-between">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div>
                        <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Identifier ID</p>
                        <p className="text-xs font-mono font-bold text-white tracking-wide">{userProfile?.studentId || 'DS-FACULTY'}</p>
                      </div>
                      {userProfile?.role === 'student' ? (
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Enrolled Course</p>
                          <p className="text-[10px] font-semibold text-slate-200 truncate pr-4">{userProfile?.course || 'General Curriculum'}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Department</p>
                          <p className="text-[10px] font-semibold text-slate-200 truncate pr-4">Academy Management</p>
                        </div>
                      )}
                    </div>
                    {/* Decorative Chip Accent */}
                    <div className="h-7 w-9 rounded bg-gradient-to-br from-yellow-300 to-yellow-600 opacity-60 border border-yellow-200/50 shadow-inner flex flex-col gap-0.5 p-1 shrink-0">
                      <div className="flex gap-1 h-full"><div className="w-1/2 border-r border-yellow-700/30"></div><div className="w-1/2"></div></div>
                    </div>
                  </div>
                </div>

                {/* ── CARD BACK ── */}
                <div className="id-card-back bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                  {/* Glowing background circles */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header */}
                  <div className="text-center border-b border-white/10 pb-2.5">
                    <h4 className="font-heading font-black tracking-wider text-xs leading-none">DIGISPIRE ACADEMY</h4>
                    <span className="text-[6px] text-slate-400 uppercase tracking-widest mt-1 block">Verification & Access</span>
                  </div>

                  {/* QR Code Container */}
                  <div className="my-auto text-center space-y-3">
                    <div className="w-36 h-36 bg-white p-2.5 rounded-2xl shadow-2xl flex items-center justify-center mx-auto border border-white/10 relative group">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Student QR Code" className="h-full w-full object-contain" />
                      ) : (
                        <div className="animate-pulse h-full w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-xs">
                          Generating...
                        </div>
                      )}
                    </div>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Scan for Verification</p>
                  </div>

                  {/* Extra Details */}
                  <div className="border-t border-white/10 pt-3.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div>
                        <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Contact Phone</span>
                        <span className="font-semibold text-slate-200">{userProfile?.phone || 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Enrolled Date</span>
                        <span className="font-semibold text-slate-200">{userProfile?.joiningDate || '—'}</span>
                      </div>
                    </div>

                    {/* Barcode & Notice */}
                    <p className="text-[7px] text-slate-400 leading-tight font-medium text-center pt-1">
                      This digital card certifies enrollment status. If found, please return to Admin Office.
                    </p>

                    {/* Decorative Barcode */}
                    <div className="flex justify-center items-center gap-0.5 opacity-30 pt-1">
                      {[1,3,2,1,4,2,1,3,2,1,4,1,2,3,1,2,4,1,2,3].map((w, i) => (
                        <div key={i} className="bg-white h-5" style={{ width: `${w}px` }} />
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Interactive Control Options */}
            <div className="flex flex-col items-center gap-2 mt-2 w-full max-w-xs px-4">
              <button 
                type="button"
                onClick={() => setIsFlipped(!isFlipped)} 
                className="w-full py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                Flip Card
              </button>
              <p className="text-[10px] text-slate-400 font-medium text-center leading-normal">
                💡 Tap the card directly or click "Flip Card" to flip between the photo ID badge and your secure verification QR Code.
              </p>
            </div>
          </div>
        ) : (
          /* Security Card */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#255A84] flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Security Credentials</h3>
                <p className="text-xs text-slate-400 font-medium">Update your password to keep your account secure</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
              {status && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.message}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">New Password</label>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none shadow-inner"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white font-bold rounded-xl transition shadow-xl shadow-[#255A84]/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
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

            <div className="mt-10 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Security Tip</h4>
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
