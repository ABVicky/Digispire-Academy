import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import {
  User, Phone, Mail, GraduationCap, Key,
  CheckCircle2, AlertCircle, Camera, LogOut, Loader2,
  ShieldCheck, CreditCard, Sparkles, RotateCw, Printer, Shield
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
  const [mentor, setMentor] = useState(null);

  useEffect(() => {
    if (userProfile?.role === 'student' && userProfile?.mentorId) {
      const fetchMentor = async () => {
        try {
          const snap = await getDoc(doc(db, 'users', userProfile.mentorId));
          if (snap.exists()) {
            setMentor({ id: snap.id, ...snap.data() });
          }
        } catch (err) {
          console.error('Failed to fetch mentor:', err);
        }
      };
      fetchMentor();
    } else {
      setMentor(null);
    }
  }, [userProfile]);

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
      setStatus({ type: 'error', message: 'Password must be at least 6 characters in length.' });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await changePassword(newPassword);
      setStatus({ type: 'success', message: 'Account password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to update password. Try re-authenticating and trying again.' });
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
      setStatus({ type: 'error', message: 'Image size must be less than 5MB.' });
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
        setStatus({ type: 'success', message: 'Profile photo updated!' });
      } catch (storageErr) {
        console.warn('Firebase Storage failed, saving compressed base64 to Firestore:', storageErr);
        await updateProfile({ photoURL: compressedDataUrl });
        setStatus({ type: 'success', message: 'Profile photo updated successfully!' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to upload photo.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 font-sans pb-8">
      {/* Header */}
      <div className="section-header px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Institutional Account Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage your digital identity, academic credentials, and security settings</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => { setActiveTab('general'); setIsFlipped(false); }}
          className={`flex-1 py-2.5 px-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'general' ? 'bg-[#1E3A5F] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User size={13} /> Official Profile
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('idcard'); setIsFlipped(false); }}
          className={`flex-1 py-2.5 px-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'idcard' ? 'bg-[#1E3A5F] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard size={13} /> Digital ID
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('security'); setIsFlipped(false); }}
          className={`flex-1 py-2.5 px-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'security' ? 'bg-[#1E3A5F] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={13} /> Security
        </button>
      </div>

      <div className="animate-in fade-in duration-200">
        {activeTab === 'general' ? (
          /* Profile Card */
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="relative h-28 bg-[#1E3A5F]">
              <div className="absolute -bottom-10 left-6">
                <div className="h-20 w-20 rounded-xl bg-white p-1 shadow-md border border-slate-200">
                  <div 
                    onClick={handleImageClick}
                    className="h-full w-full rounded-lg bg-slate-100 flex items-center justify-center text-[#1E3A5F] font-bold text-2xl border border-slate-100 relative group overflow-hidden cursor-pointer"
                  >
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
                    ) : (
                      <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-2" />
                    )}
                    
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {uploading ? (
                        <Loader2 size={20} className="text-white animate-spin" />
                      ) : (
                        <Camera size={20} className="text-white" />
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

            <div className="pt-14 pb-6 px-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">{userProfile?.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      userProfile?.role === 'admin' ? 'bg-[#1E3A5F] text-white' : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}>
                      {userProfile?.role}
                    </span>
                    {userProfile?.role === 'student' && (
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        ID: {userProfile?.studentId}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-rose-600 font-bold text-xs hover:bg-rose-50 px-3 py-2 rounded-lg transition border border-rose-200 cursor-pointer self-start sm:self-auto"
                >
                  <LogOut size={14} /> Sign Out Session
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <Phone size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Registered Phone</p>
                      <p className="text-xs font-semibold mt-1">{userProfile?.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <Mail size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Email Address</p>
                      <p className="text-xs font-semibold mt-1">{userProfile?.email || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <GraduationCap size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                        {userProfile?.role === 'admin' ? 'Position' : 'Enrolled Course Track'}
                      </p>
                      <p className="text-xs font-semibold mt-1">{userProfile?.course || (userProfile?.role === 'admin' ? 'Faculty Lead' : 'General Track')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <User size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Batch Allocation</p>
                      <p className="text-xs font-semibold mt-1">
                        {userProfile?.batchId} {userProfile?.isIntern ? ' (Internship)' : ''}
                      </p>
                    </div>
                  </div>
                  {mentor && (
                    <div className="flex items-center gap-3 text-slate-600 pt-2 border-t border-slate-100">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
                        <User size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Assigned Academic Advisor</p>
                        <p className="text-xs font-semibold mt-1">{mentor.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                          {mentor.email} {mentor.phone && `· ${mentor.phone}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'idcard' ? (
          /* Digital ID Card */
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="id-card-perspective w-72 sm:w-80 h-[480px] cursor-pointer group shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-3xl"
              onClick={() => setIsFlipped(!isFlipped)}
              title="Click to flip ID card"
            >
              <div className={`id-card-inner ${isFlipped ? 'id-card-flipped' : ''}`}>
                
                {/* CARD FRONT */}
                <div className="id-card-front bg-gradient-to-br from-[#0B192C] via-[#153448] to-[#1E3E62] text-white p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0">
                  {/* Soft Aurora Ambient Glows */}
                  <div className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-br from-cyan-400/30 via-sky-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-gradient-to-tr from-amber-400/20 via-orange-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] pointer-events-none rounded-3xl" />

                  {/* Header */}
                  <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 bg-white/95 backdrop-blur-md rounded-xl flex items-center justify-center p-1 shadow-md border border-white/40 shrink-0">
                        <img src="/logo.png" alt="DIGISPIRE Logo" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="font-heading font-black tracking-tight text-xs sm:text-sm text-white leading-none">DIGISPIRE</h4>
                        <span className="text-[8px] font-bold text-sky-300 tracking-widest uppercase mt-0.5 block">ACADEMY</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified
                    </span>
                  </div>

                  {/* Photo and Name */}
                  <div className="relative z-10 my-auto py-1 text-center flex flex-col items-center space-y-2.5">
                    <div className="relative">
                      <div className="p-1 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-400 to-amber-300 shadow-xl">
                        <div className="h-24 w-24 rounded-xl bg-slate-900 p-0.5 overflow-hidden">
                          {userProfile?.photoURL ? (
                            <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-lg" />
                          ) : (
                            <div className="h-full w-full bg-slate-800 flex items-center justify-center rounded-lg p-2">
                              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain opacity-80" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 p-1 rounded-full shadow-md border-2 border-slate-900">
                        <ShieldCheck size={13} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight drop-shadow-sm">{userProfile?.name}</h3>
                      <p className="text-[11px] font-semibold text-sky-200 line-clamp-1">{userProfile?.course || 'Advanced Skills Program'}</p>
                      <div className="flex items-center justify-center gap-1.5 pt-0.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white font-mono text-[9px] font-bold tracking-wider border border-white/15 uppercase shadow-2xs">
                          {userProfile?.isIntern ? 'Internship Track' : (userProfile?.batchId || 'Academic Cohort')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Security Band */}
                  <div className="relative z-10 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-400/20 via-cyan-400/25 to-purple-400/20 border border-white/20 backdrop-blur-md flex items-center justify-between text-[8px] font-mono tracking-widest text-slate-200 uppercase shadow-xs">
                    <span className="flex items-center gap-1 text-sky-200">
                      <Shield size={10} className="text-cyan-300" /> SECURE PASS
                    </span>
                    <Sparkles size={11} className="text-amber-300 animate-spin-slow" />
                    <span className="text-amber-200">SESSION {new Date().getFullYear()} – {new Date().getFullYear() + 1}</span>
                  </div>

                  {/* Footer */}
                  <div className="relative z-10 border-t border-white/15 pt-2.5 flex items-end justify-between text-xs">
                    <div className="space-y-0.5 text-left">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-300">STUDENT ID</p>
                      <p className="font-mono font-black text-white text-xs tracking-wider bg-white/10 px-1.5 py-0.5 rounded border border-white/10 inline-block">{userProfile?.studentId || 'DS-STD-0000'}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-300">STATUS</p>
                      <p className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wide">
                        {userProfile?.role === 'admin' ? 'Faculty' : userProfile?.isIntern ? 'Intern' : 'Active Student'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CARD BACK */}
                <div className="id-card-back bg-gradient-to-br from-[#0B192C] via-[#153448] to-[#1E3E62] text-white p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0">
                  <div className="absolute -top-12 -left-12 w-44 h-44 bg-gradient-to-br from-indigo-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-gradient-to-tl from-cyan-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] pointer-events-none rounded-3xl" />

                  <div className="relative z-10 text-center border-b border-white/15 pb-2">
                    <h4 className="font-heading font-black text-xs tracking-tight text-white uppercase">DIGISPIRE ACADEMY</h4>
                    <span className="text-[8px] text-sky-300 uppercase tracking-widest block mt-0.5 font-bold">Official Verification Barcode</span>
                  </div>

                  <div className="relative z-10 my-auto text-center space-y-2.5">
                    <div className="w-32 h-32 bg-white p-2 rounded-2xl flex items-center justify-center mx-auto shadow-2xl border-2 border-white/40">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-mono text-sky-200 uppercase tracking-widest font-bold">Scan to Verify Enrolment</p>
                      <p className="text-[7px] text-slate-400 font-mono">Institutional Cloud Verification</p>
                    </div>
                  </div>

                  <div className="relative z-10 border-t border-white/15 pt-2.5 space-y-2 text-[8px] text-slate-300 text-center leading-relaxed">
                    <div className="flex justify-center items-center gap-0.5 opacity-40">
                      {[2,4,1,3,2,1,4,2,3,1,2,4,1,3,2,1,4,2,1,3,2,4,1,3].map((w, i) => (
                        <div key={i} className="bg-white h-4.5" style={{ width: `${w}px` }} />
                      ))}
                    </div>

                    <p className="text-slate-400 text-[7.5px] leading-tight">Official digital credential. Property of DIGISPIRE Academy.</p>
                    <div className="flex items-center justify-center gap-2 pt-0.5 text-slate-400 font-mono text-[8px]">
                      <span className="text-white font-bold">{userProfile?.studentId || 'DS-STD-0000'}</span>
                      <span>•</span>
                      <span>Session: {new Date().getFullYear()} – {new Date().getFullYear() + 1}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Actions Bar */}
            <div className="w-full max-w-sm flex items-center justify-center gap-3">
              <button 
                type="button"
                onClick={() => setIsFlipped(!isFlipped)} 
                className="flex-1 py-2.5 px-4 bg-white/80 backdrop-blur-md border border-slate-200 hover:bg-white text-slate-800 font-bold rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCw size={14} className={isFlipped ? 'rotate-180 transition-transform duration-500' : ''} />
                <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                title="Print or Save ID Card"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
            </div>
          </div>
        ) : (
          /* Security Card */
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-[#1E3A5F] flex items-center justify-center border border-slate-200">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Access Credentials</h3>
                <p className="text-xs text-slate-500">Update your account password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              {status && (
                <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{status.message}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="input-premium pl-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="input-premium pl-10 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-premium text-xs py-2.5 w-full"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  <span>{saving ? 'Updating Password...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
