import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  collection, addDoc, serverTimestamp, query, where, getDocs, 
  orderBy, limit, doc, updateDoc, arrayUnion, getDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, CheckCircle2, AlertCircle, 
  Calendar, Briefcase, Camera, X, ArrowLeft, History,
  Sparkles, Flame, Clock, Award, BookOpen, Layers, CheckCheck,
  RotateCcw, ArrowRight, ChevronRight, UserCheck, ShieldCheck, KeyRound
} from 'lucide-react';
import { calculateAttendance } from '../../utils/attendanceEngine';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { triggerHaptic } from '../../utils/haptic';

export default function StudentAttendancePage() {
  const { userProfile } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'history'

  // Check-in Terminal States
  const [mode, setMode] = useState('scan'); // 'scan' | 'manual'
  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'manual' | 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [lastAttendance, setLastAttendance] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [selectedType, setSelectedType] = useState('academic'); // 'academic' | 'internship'
  const scannerRef = useRef(null);

  // History calculation states
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const studentBatches = [...(userProfile?.batchIds || (userProfile?.batchId ? [userProfile.batchId] : ['morning']))];
  if (userProfile?.isIntern && !studentBatches.includes('internship')) {
    studentBatches.push('internship');
  }
  const activeBatchId = selectedBatchId || studentBatches[0] || 'morning';
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [myLogs, setMyLogs] = useState([]);
  const [myBatchSchedule, setMyBatchSchedule] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);

  // Fetch today's and last check-ins
  const fetchCheckIns = useCallback(async () => {
    if (!userProfile?.studentId) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      // Fetch latest
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', userProfile.studentId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (docs.length > 0) {
        setLastAttendance(docs[0]);
        const todayDoc = docs.find(d => d.date === today);
        setTodayAttendance(todayDoc || null);
      }
    } catch {
      const snap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', userProfile.studentId)));
      const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      if (sorted[0]) setLastAttendance(sorted[0]);
      const todayDoc = sorted.find(d => d.date === today);
      setTodayAttendance(todayDoc || null);
    }
  }, [userProfile]);

  const fetchHistoryDetails = useCallback(async () => {
    if (!userProfile?.studentId) return;
    setLoadingHistory(true);
    try {
      // 1. Fetch student logs
      const logsSnap = await getDocs(
        query(collection(db, 'attendance'), where('studentId', '==', userProfile.studentId))
      );
      setMyLogs(logsSnap.docs.map(d => d.data()));

      // 2. Fetch batch schedule
      const batchId = activeBatchId || userProfile.batchId || 'morning';
      const batchSnap = await getDoc(doc(db, 'batches', batchId));
      if (batchSnap.exists()) {
        setMyBatchSchedule(batchSnap.data());
      }

      // 3. Fetch holidays, cancellations, courses, modules, topics
      const [hSnap, canSnap, cSnap, mSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'holidays')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'cancelled_classes')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'courses')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'modules')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'topics')).catch(() => ({ docs: [] })),
      ]);

      setHolidays(hSnap.docs.map(d => d.data()));
      setCancellations(canSnap.docs.map(d => d.data()));
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [userProfile, activeBatchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCheckIns();
      fetchHistoryDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCheckIns, fetchHistoryDetails]);

  const submitAttendance = useCallback(async (sessionData) => {
    const today = new Date().toISOString().split('T')[0];
    const sessionType = sessionData.type || 'academic';

    if (sessionData.expiresAt < Date.now()) {
      throw new Error('This session QR/Code has expired. Please ask your educator for a new one.');
    }

    if (sessionType === 'internship') {
      if (!userProfile.isIntern) {
        throw new Error('You are not enrolled in the Internship track.');
      }
    } else {
      const studentBatchIds = userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : []);
      if (!studentBatchIds.includes(sessionData.batchId)) {
        throw new Error(`This session is for the ${sessionData.batchId} batch. You are not enrolled in this batch.`);
      }
    }

    const q = query(
      collection(db, 'attendance'),
      where('studentId', '==', userProfile.studentId),
      where('date', '==', today),
      where('type', '==', sessionType)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`Attendance already marked for today's ${sessionType} session.`);
    }

    const attendanceDoc = {
      studentId: userProfile.studentId,
      uid: userProfile.uid,
      name: userProfile.name,
      batchId: userProfile.batchId,
      isIntern: !!userProfile.isIntern,
      type: sessionType,
      date: today,
      timestamp: serverTimestamp(),
      sessionId: sessionData.sessionId,
      coveredCourse: sessionData.coveredCourse || '',
      coveredModule: sessionData.coveredModule || '',
      coveredTopics: sessionData.coveredTopics || []
    };

    await addDoc(collection(db, 'attendance'), attendanceDoc);

    if (sessionData.coveredTopics && sessionData.coveredTopics.length > 0) {
      await Promise.all(sessionData.coveredTopics.map(topicId => {
        return updateDoc(doc(db, 'topics', topicId), {
          completedStudents: arrayUnion(userProfile.uid)
        }).catch(err => {
          console.error("Failed to mark topic complete:", err);
        });
      }));
    }

    setLastAttendance({
      ...attendanceDoc,
      timestamp: { toDate: () => new Date() }
    });
    setTodayAttendance({
      ...attendanceDoc,
      timestamp: { toDate: () => new Date() }
    });
    fetchHistoryDetails();
  }, [userProfile, fetchHistoryDetails]);

  const onScanSuccess = useCallback(async (decodedText) => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Stop failed", err);
      }
    }

    setStatus('processing');
    triggerHaptic('medium');
    try {
      let data;
      try {
        data = JSON.parse(decodedText);
      } catch (err) {
        throw new Error("Invalid QR code format.", { cause: err });
      }

      if (data.s && data.b) {
        const docRef = doc(db, 'qr_sessions', data.b);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          throw new Error('No active session found for this batch.');
        }

        const sessionData = docSnap.data();
        if (sessionData.sessionId !== data.s) {
          throw new Error('The scanned QR code is outdated. Please scan the current one.');
        }

        await submitAttendance(sessionData);

        const courseName = courses.find(c => c.id === sessionData.coveredCourse)?.name || 'General Course';
        const moduleName = modules.find(m => m.id === sessionData.coveredModule)?.title || 'General Module';
        setStatus('success');
        triggerHaptic('success');
        setMessage(`Successfully marked present for ${courseName} (${moduleName})!`);
      } else {
        await submitAttendance(data);
        const courseName = courses.find(c => c.id === data.coveredCourse)?.name || 'General Course';
        const moduleName = modules.find(m => m.id === data.coveredModule)?.title || 'General Module';
        setStatus('success');
        triggerHaptic('success');
        setMessage(`Successfully marked present for ${courseName} (${moduleName})!`);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      triggerHaptic('heavy');
      setMessage(err.message || 'Invalid QR code. Please try again.');
    }
  }, [submitAttendance, courses, modules]);

  useEffect(() => {
    let html5QrCode = null;

    if (status === 'scanning') {
      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          scannerRef.current = html5QrCode;
          
          const config = { 
            fps: 15, 
            qrbox: (viewWidth, viewHeight) => {
              const size = Math.min(viewWidth, viewHeight) * 0.72;
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => { /* ignore minor scan errors */ }
          );
        } catch (err) {
          console.error("Scanner start error:", err);
          setStatus('error');
          setMessage("Could not access camera. Please ensure permissions are granted.");
        }
      };

      startScanner();
    }

    return () => {
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (err) {
            console.error("Cleanup error:", err);
          }
        }
      };
      cleanup();
    };
  }, [status, onScanSuccess]);

  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    if (!manualCode || manualCode.trim().length !== 6) {
      setStatus('error');
      setMessage('Please enter a valid 6-character session code.');
      triggerHaptic('heavy');
      return;
    }

    setStatus('processing');
    triggerHaptic('light');
    try {
      const studentBatchIds = userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : ['morning']);
      let sessionData = null;

      if (selectedType === 'internship') {
        const docRef = doc(db, 'qr_sessions', 'internship');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.sessionId?.toUpperCase() === manualCode.trim().toUpperCase()) {
            sessionData = data;
          }
        }
      } else {
        // Look for matching session among all enrolled batches
        for (const bId of studentBatchIds) {
          const docRef = doc(db, 'qr_sessions', bId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.sessionId?.toUpperCase() === manualCode.trim().toUpperCase()) {
              sessionData = data;
              break;
            }
          }
        }
      }

      if (!sessionData) {
        throw new Error('Invalid code or no active session matches your enrolled batches.');
      }

      await submitAttendance(sessionData);
      
      const courseName = courses.find(c => c.id === sessionData.coveredCourse)?.name || 'General Course';
      const moduleName = modules.find(m => m.id === sessionData.coveredModule)?.title || 'General Module';

      setStatus('success');
      triggerHaptic('success');
      setMessage(`Successfully checked in manually to ${courseName} (${moduleName}) with code ${manualCode.toUpperCase()}!`);
      setManualCode('');
    } catch (err) {
      console.error(err);
      setStatus('error');
      triggerHaptic('heavy');
      setMessage(err.message || 'Verification failed. Please try again.');
    }
  };

  // Run dynamic calculation for student history tab
  const calculatedHistory = (userProfile && myBatchSchedule)
    ? calculateAttendance({
        student: userProfile,
        attendanceLogs: myLogs,
        batchSchedule: myBatchSchedule,
        holidays,
        cancelledClasses: cancellations
      })
    : null;

  const score = calculatedHistory ? calculatedHistory.attendancePercentage : 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 font-sans">
      {/* ── Compact Learning Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#255A84] text-white p-4 sm:p-6 shadow-md shadow-[#255A84]/15 border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold text-blue-200 tracking-wider uppercase backdrop-blur-md">
              <Sparkles size={11} className="text-amber-400" />
              <span>Digispire Attendance Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Attendance & Session Check-In
            </h1>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Scan class QR codes, submit session pins, and monitor your attendance standing in real-time.
            </p>
          </div>

          {/* Gamified Mini Attendance Progress Tracker */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/15 shrink-0 min-w-[220px] md:max-w-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-white tracking-wide">Overall Score</span>
              </div>
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                score >= 75 
                  ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' 
                  : score >= 60 
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' 
                  : 'bg-rose-400/20 text-rose-300 border-rose-400/30'
              }`}>
                {score}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-900/60 rounded-full h-2 overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                  score >= 75 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                  score >= 60 ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                  'bg-gradient-to-r from-rose-500 to-red-400'
                }`}
                style={{ width: `${Math.max(score, 5)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
              <span>{todayAttendance ? 'Checked In Today ✓' : 'Session Pending'}</span>
              <span className="text-slate-400 flex items-center gap-0.5">
                <Flame size={11} className="text-amber-400" /> Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher Strip ── */}
      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs max-w-md">
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('terminal'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'terminal' 
              ? 'bg-[#255A84] text-white shadow-xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <QrCode size={14} />
          <span>Check In</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('history'); fetchHistoryDetails(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history' 
              ? 'bg-[#255A84] text-white shadow-xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History size={14} />
          <span>My History & Calendar</span>
        </button>
      </div>

      {/* ── TAB 1: CHECK IN TERMINAL ── */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 animate-in fade-in duration-200">
          {/* Main Interactive Check-In Deck (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[420px]">
              {/* Terminal Card Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#255A84] flex items-center justify-center font-bold">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm">Attendance Scanner Deck</h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Scan broadcast screen or enter code</p>
                  </div>
                </div>

                {/* Mode Selector */}
                {status !== 'scanning' && status !== 'processing' && status !== 'success' && status !== 'error' && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => { triggerHaptic('light'); setMode('scan'); setStatus('idle'); }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        mode === 'scan' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Camera QR
                    </button>
                    <button
                      onClick={() => { triggerHaptic('light'); setMode('manual'); setStatus('manual'); }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        mode === 'manual' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Code Entry
                    </button>
                  </div>
                )}
              </div>

              {/* Terminal Viewport */}
              <div className="flex-1 flex flex-col justify-center p-4 sm:p-6">
                {/* 1. IDLE / SCAN LAUNCHER */}
                {status === 'idle' && mode === 'scan' && (
                  <div className="text-center space-y-6 my-auto py-6">
                    <div className="relative h-24 w-24 mx-auto rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/80 flex items-center justify-center text-[#255A84] shadow-sm group">
                      <QrCode size={48} strokeWidth={1.5} className="group-hover:scale-105 transition-transform" />
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-black text-slate-800">Ready to Scan QR Code</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Point your device camera at the classroom projector or educator's broadcast screen.
                      </p>
                    </div>

                    <div className="space-y-2.5 max-w-xs mx-auto">
                      <button
                        onClick={() => { triggerHaptic('light'); setStatus('scanning'); }}
                        className="w-full py-3 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl font-bold text-xs shadow-md shadow-[#255A84]/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <Camera size={16} /> Open Camera Scanner
                      </button>

                      <button
                        onClick={() => { triggerHaptic('light'); setMode('manual'); setStatus('manual'); }}
                        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs border border-slate-200/80 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <KeyRound size={14} /> Type 6-Digit Code Instead
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. LIVE CAMERA SCANNER */}
                {status === 'scanning' && (
                  <div className="relative flex-1 flex flex-col items-center justify-center min-h-[320px] rounded-2xl overflow-hidden bg-slate-950">
                    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-[240px] h-[240px] border-2 border-white/20 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.9)] animate-scan-line" />
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-2xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-2xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-2xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-2xl" />
                      </div>
                      <p className="mt-6 text-white text-[10px] font-bold uppercase tracking-widest bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                        Align QR within frame
                      </p>
                    </div>

                    <div id="qr-reader" className="w-full h-full bg-black flex items-center justify-center" />
                    
                    <button
                      onClick={() => { triggerHaptic('light'); setStatus('idle'); }}
                      className="absolute top-3 right-3 z-20 p-2 bg-white/15 hover:bg-white/25 text-white rounded-full backdrop-blur-md transition-colors"
                      title="Close Scanner"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                {/* 3. MANUAL CODE FORM */}
                {(status === 'manual' || (status === 'idle' && mode === 'manual')) && (
                  <form onSubmit={handleManualCheckIn} className="space-y-4 my-auto max-w-sm mx-auto w-full py-4">
                    {userProfile?.isIntern && (
                      <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                        <button
                          type="button"
                          onClick={() => { triggerHaptic('light'); setSelectedType('academic'); }}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                            selectedType === 'academic' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Academic Track
                        </button>
                        <button
                          type="button"
                          onClick={() => { triggerHaptic('light'); setSelectedType('internship'); }}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                            selectedType === 'internship' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Internship Track
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 text-center">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Enter 6-Character Session Code
                      </label>
                      <input 
                        type="text"
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value.toUpperCase())}
                        placeholder="••••••"
                        maxLength={6}
                        className="w-full text-center text-2xl sm:text-3xl font-mono font-black tracking-[0.3em] py-3.5 border-2 border-slate-200 focus:border-[#255A84] rounded-2xl bg-slate-50 uppercase placeholder-slate-300 focus:outline-none focus:bg-white transition-all shadow-inner"
                        autoFocus
                      />
                      <p className="text-[10px] text-slate-400 font-medium">
                        Case-insensitive code displayed on educator's board
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={manualCode.trim().length !== 6}
                      className={`w-full py-3 text-white rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                        manualCode.trim().length !== 6
                          ? 'bg-slate-300 cursor-not-allowed shadow-none'
                          : selectedType === 'internship'
                          ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700'
                          : 'bg-[#255A84] shadow-[#255A84]/20 hover:bg-[#1a4261]'
                      }`}
                    >
                      <CheckCircle2 size={16} /> Verify & Check In
                    </button>
                  </form>
                )}

                {/* 4. PROCESSING STATE */}
                {status === 'processing' && (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-center my-auto">
                    <div className="h-10 w-10 border-3 border-[#255A84] border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Validating Session...</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Recording attendance in academy database</p>
                    </div>
                  </div>
                )}

                {/* 5. SUCCESS / ERROR STATE */}
                {(status === 'success' || status === 'error') && (
                  <div className="p-6 text-center space-y-4 my-auto animate-in zoom-in-95 duration-200">
                    <div className={`h-16 w-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg ${
                      status === 'success' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-500/20' : 'bg-red-50 text-red-500 shadow-red-500/20'
                    }`}>
                      {status === 'success' ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
                    </div>
                    <div>
                      <h4 className={`text-lg font-black ${status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {status === 'success' ? 'Attendance Recorded!' : 'Check-In Failed'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        {message}
                      </p>
                    </div>
                    <button
                      onClick={() => { setStatus('idle'); setMessage(''); }}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-sm active:scale-95"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Insights Deck (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Today's Live Status Card */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              todayAttendance
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-teal-50/20 border-emerald-200/90 shadow-xs'
                : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className="flex items-center justify-between gap-2 border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold ${
                    todayAttendance ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {todayAttendance ? <CheckCheck size={15} /> : <Clock size={15} />}
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">Today's Status</h4>
                </div>

                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  todayAttendance 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {todayAttendance ? 'Marked Present' : 'Not Checked In'}
                </span>
              </div>

              <div className="pt-3 space-y-2">
                {todayAttendance ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold text-[11px]">Timestamp</span>
                      <span className="font-mono font-bold text-slate-700 text-xs">
                        {todayAttendance.timestamp?.toDate ? todayAttendance.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold text-[11px]">Track</span>
                      <span className="font-bold text-[#255A84] capitalize">
                        {todayAttendance.type || 'Academic'}
                      </span>
                    </div>

                    {todayAttendance.coveredCourse && (
                      <div className="p-2.5 bg-white rounded-xl border border-emerald-100 text-xs space-y-1">
                        <p className="font-bold text-slate-800 text-[11px]">
                          {courses.find(c => c.id === todayAttendance.coveredCourse)?.name || todayAttendance.coveredCourse}
                        </p>
                        {todayAttendance.coveredModule && (
                          <p className="text-[10px] text-slate-500">
                            {modules.find(m => m.id === todayAttendance.coveredModule)?.title || todayAttendance.coveredModule}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-3 space-y-1 text-slate-400">
                    <p className="text-xs font-semibold text-slate-600">No Check-In Recorded for Today</p>
                    <p className="text-[11px] text-slate-400">Use the camera scanner or enter session code when class starts.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Batch Timetable & Info */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#255A84] flex items-center justify-center">
                    <Calendar size={15} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">My Cohort Batch</h4>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-[#255A84] bg-blue-50 px-2 py-0.5 rounded-md">
                  {studentBatches[0] || 'Morning'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {myBatchSchedule && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium text-[11px]">Scheduled Hours</span>
                      <span className="font-bold text-slate-700">{myBatchSchedule.startTime || '09:00'} - {myBatchSchedule.endTime || '11:00'}</span>
                    </div>

                    {myBatchSchedule.educator && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium text-[11px]">Educator</span>
                        <span className="font-bold text-slate-700">{myBatchSchedule.educator}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium text-[11px]">Internship Program</span>
                  <span className={`font-bold ${userProfile?.isIntern ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {userProfile?.isIntern ? 'Active Track' : 'Not Enrolled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
                <ShieldCheck size={14} className="text-[#255A84]" /> Attendance Policy Tip
              </p>
              <p className="text-[10.5px] leading-relaxed text-slate-500">
                Maintain at least <strong>75% attendance</strong> to stay in good academic standing and remain eligible for cohort certifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ATTENDANCE HISTORY & CALENDAR ── */}
      {activeTab === 'history' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {loadingHistory ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-xs">
              <div className="animate-spin h-7 w-7 border-3 border-[#255A84] border-t-transparent rounded-full" />
              <p className="text-xs text-slate-400 font-bold">Calculating attendance metrics...</p>
            </div>
          ) : !myBatchSchedule ? (
            <div className="p-8 bg-white border border-slate-200/80 rounded-2xl text-center text-slate-400 space-y-2 shadow-xs">
              <AlertCircle size={32} className="mx-auto text-rose-500" />
              <p className="text-xs font-bold text-slate-700">Batch schedule settings are not initialized.</p>
              <p className="text-[11px] text-slate-400">Please reach out to your instructor to assign your batch schedule.</p>
            </div>
          ) : calculatedHistory ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Batch Selector if multiple batches exist */}
              {studentBatches.length > 1 && (
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select Cohort Track</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {studentBatches.map(bId => (
                      <button
                        key={bId}
                        onClick={() => setSelectedBatchId(bId)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                          activeBatchId === bId
                            ? 'bg-[#255A84] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {bId === 'internship' ? 'Internship Track' : `${bId} Batch`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Statistics Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-0.5">
                  <p className="text-xl sm:text-2xl font-black text-emerald-600">{calculatedHistory.presentClasses}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Present Days</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-0.5">
                  <p className="text-xl sm:text-2xl font-black text-slate-800">{calculatedHistory.eligibleClasses}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Scheduled Days</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-0.5">
                  <p className="text-xl sm:text-2xl font-black text-amber-600">{calculatedHistory.leaveClasses}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Approved Leaves</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-0.5">
                  <p className="text-xl sm:text-2xl font-black text-blue-600">{calculatedHistory.holidaysCount}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Holidays</p>
                </div>
              </div>

              {/* Dynamic Calendar */}
              <AttendanceCalendar
                student={userProfile}
                dailyStatus={calculatedHistory.dailyStatus}
                attendanceLogs={myLogs}
                batchSchedule={myBatchSchedule}
                holidays={holidays}
                cancelledClasses={cancellations}
                courses={courses}
                modules={modules}
                topics={topics}
              />

              {/* Check-In History Logs Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#255A84] flex items-center justify-center font-bold">
                      <History size={15} />
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wider">
                      Recent Check-In Records
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    Total: {myLogs.length} logs
                  </span>
                </div>

                {myLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                    No attendance records found yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {myLogs
                      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                      .map((log, idx) => (
                        <div key={idx} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold border border-emerald-200/60">
                              <CheckCircle2 size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800 text-xs truncate">
                                  {courses.find(c => c.id === log.coveredCourse)?.name || 'General Class Session'}
                                </p>
                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {log.type || 'academic'}
                                </span>
                              </div>
                              {log.coveredModule && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {modules.find(m => m.id === log.coveredModule)?.title || log.coveredModule}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono font-bold text-slate-700">{log.date}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recorded'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
