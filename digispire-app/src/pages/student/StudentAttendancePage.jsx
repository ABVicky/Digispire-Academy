import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  collection, addDoc, serverTimestamp, query, where, getDocs, 
  orderBy, limit, doc, updateDoc, arrayUnion, getDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, CheckCircle2, AlertCircle, RefreshCw, 
  Clock, Calendar, Briefcase, Camera, X, ArrowLeft
} from 'lucide-react';

export default function StudentAttendancePage() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState('idle'); // idle, scanning, manual, success, error, processing
  const [message, setMessage] = useState('');
  const [lastAttendance, setLastAttendance] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [selectedType, setSelectedType] = useState('academic'); // academic, internship
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!userProfile?.studentId) return;

    const fetchLast = async () => {
      try {
        const q = query(
          collection(db, 'attendance'),
          where('studentId', '==', userProfile.studentId),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) setLastAttendance(snap.docs[0].data());
      } catch (err) {
        // Fallback for missing index
        const snap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', userProfile.studentId)));
        const sorted = snap.docs.map(d => d.data()).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        if (sorted[0]) setLastAttendance(sorted[0]);
      }
    };
    fetchLast();
  }, [userProfile]);

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
              const size = Math.min(viewWidth, viewHeight) * 0.7;
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            (errorMessage) => { /* ignore minor scan errors */ }
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
  }, [status]);

  // Unified function to record the attendance after code validation
  const submitAttendance = async (sessionData) => {
    const today = new Date().toISOString().split('T')[0];
    const sessionType = sessionData.type || 'academic';

    // 1. Validation Logic
    if (sessionData.expiresAt < Date.now()) {
      throw new Error('This session QR/Code has expired. Please ask your educator for a new one.');
    }

    if (sessionType === 'internship') {
      if (!userProfile.isIntern) {
        throw new Error('You are not enrolled in the Internship track.');
      }
    } else {
      // Academic Session
      if (sessionData.batchId !== userProfile.batchId) {
        throw new Error(`This session is for the ${sessionData.batchId} batch. Your batch is ${userProfile.batchId}.`);
      }
    }

    // 2. Duplicate Check
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

    // 3. Mark Attendance
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

    // 4. Update Course/Topic Completion
    if (sessionData.coveredTopics && sessionData.coveredTopics.length > 0) {
      await Promise.all(sessionData.coveredTopics.map(topicId => {
        return updateDoc(doc(db, 'topics', topicId), {
          completedStudents: arrayUnion(userProfile.uid)
        }).catch(err => console.error("Failed to mark topic complete:", err));
      }));
    }

    // Save in local state for UI rendering
    setLastAttendance({
      ...attendanceDoc,
      timestamp: { toDate: () => new Date() } // temporary mock for instant state rendering
    });
  };

  const onScanSuccess = async (decodedText) => {
    // Immediately stop scanning to avoid duplicate processing
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Stop failed", e);
      }
    }

    setStatus('processing');
    try {
      let data;
      try {
        data = JSON.parse(decodedText);
      } catch (e) {
        throw new Error("Invalid QR code format.");
      }

      // Check if it's the compressed payload format: { s: sessionId, b: batchId }
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
      } else {
        // Fallback for old QR layout where data was stored directly inside QR
        await submitAttendance(data);
      }

      setStatus('success');
      setMessage(`Successfully marked present!`);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Invalid QR code. Please try again.');
    }
  };

  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    if (!manualCode || manualCode.trim().length !== 6) {
      setStatus('error');
      setMessage('Please enter a valid 6-character session code.');
      return;
    }

    setStatus('processing');
    try {
      const targetBatchId = selectedType === 'internship' ? 'internship' : userProfile.batchId;
      
      const docRef = doc(db, 'qr_sessions', targetBatchId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error(`No active session found for the ${selectedType === 'internship' ? 'Internship' : 'Academic'} track.`);
      }

      const sessionData = docSnap.data();

      // Check code matching (case-insensitive)
      if (sessionData.sessionId.toUpperCase() !== manualCode.trim().toUpperCase()) {
        throw new Error('Invalid session code. Please verify the code shown by your educator.');
      }

      await submitAttendance(sessionData);
      
      setStatus('success');
      setMessage(`Successfully checked in manually using code ${manualCode.toUpperCase()}!`);
      setManualCode('');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Check-in Terminal</h1>
        <p className="text-sm text-slate-500 font-medium">Scan QR code or use a session code to mark present</p>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative min-h-[400px] flex flex-col transition-all duration-300">
        {status === 'idle' && (
          <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="h-24 w-24 bg-blue-50 rounded-2xl flex items-center justify-center text-[#255A84] shadow-inner">
              <QrCode size={48} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Choose Check-in Method</p>
              <p className="text-xs text-slate-400 mt-2 font-medium px-4 leading-relaxed">Scan the display board or type the session code manually</p>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => setStatus('scanning')}
                className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-2xl font-bold text-sm transition shadow-xl shadow-[#255A84]/20 flex items-center justify-center gap-3 active:scale-95"
              >
                <Camera size={20} /> Launch Scanner
              </button>
              
              <div className="relative flex items-center justify-center py-1 w-full">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
              </div>
              
              <button
                onClick={() => setStatus('manual')}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-3 active:scale-95"
              >
                <QrCode size={18} /> Enter Session Code
              </button>
            </div>
          </div>
        )}

        {status === 'scanning' && (
          <div className="relative flex-1 flex flex-col">
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
              {/* Custom Overlay */}
              <div className="w-[250px] h-[250px] border-2 border-white/20 rounded-2xl relative overflow-hidden">
                {/* Scanning Laser Line */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line"></div>
                
                {/* Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl"></div>
              </div>
              <p className="mt-8 text-white text-[10px] font-bold uppercase tracking-[0.2em] bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Align QR Code within frame</p>
            </div>

            <div id="qr-reader" className="flex-1 bg-black"></div>
            
            <button
              onClick={() => setStatus('idle')}
              className="absolute top-4 right-4 z-20 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {status === 'manual' && (
          <form onSubmit={handleManualCheckIn} className="flex-1 p-8 flex flex-col justify-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <button 
                type="button"
                onClick={() => { setStatus('idle'); setManualCode(''); }}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manual Code Entry</h2>
              <div className="w-9"></div> {/* spacing helper */}
            </div>

            {/* Session Type Toggler if Intern */}
            {userProfile?.isIntern && (
              <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                <button
                  type="button"
                  onClick={() => setSelectedType('academic')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${selectedType === 'academic' ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Academic
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('internship')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${selectedType === 'internship' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Internship
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Enter 6-Character Code</label>
              <input 
                type="text" 
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                placeholder="------"
                maxLength={6}
                className="w-full text-center text-3xl font-mono font-black tracking-[0.25em] py-4 border-2 border-slate-200 focus:border-[#255A84] focus:ring-0 rounded-2xl bg-slate-50 uppercase placeholder-slate-300 focus:outline-none transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-slate-400 font-medium text-left">Code is case-insensitive (e.g. A9B3KD)</p>
            </div>

            <button
              type="submit"
              disabled={manualCode.trim().length !== 6}
              className={`w-full py-4 text-white rounded-2xl font-bold text-sm transition shadow-xl flex items-center justify-center gap-3 active:scale-95 ${
                manualCode.trim().length !== 6
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : selectedType === 'internship'
                  ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700'
                  : 'bg-[#255A84] shadow-[#255A84]/20 hover:bg-[#1a4261]'
              }`}
            >
              <CheckCircle2 size={18} /> Verify & Check In
            </button>
          </form>
        )}

        {status === 'processing' && (
          <div className="p-16 flex-1 flex flex-col items-center justify-center gap-6">
            <div className="h-12 w-12 border-4 border-[#255A84] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Validating Session...</p>
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <div className="p-10 flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-300">
            <div className={`h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg ${status === 'success' ? 'bg-emerald-50 text-emerald-500 shadow-emerald-500/20' : 'bg-red-50 text-red-500 shadow-red-500/20'}`}>
              {status === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
            </div>
            <div>
              <p className={`text-xl font-bold ${status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {status === 'success' ? 'Success!' : 'Failed'}
              </p>
              <p className="text-xs text-slate-500 mt-2 font-medium px-4 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={() => { setStatus('idle'); setMessage(''); }}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-black transition shadow-xl active:scale-95"
            >
              Return Home
            </button>
          </div>
        )}
      </div>

      {/* Last Attendance Status Banner (Dynamic UX) */}
      {lastAttendance && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-between animate-in fade-in duration-500">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Marked Present</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">
                {lastAttendance.type === 'internship' ? 'Internship Session' : 'Academic Session'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500">{lastAttendance.date}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {lastAttendance.timestamp?.toDate ? lastAttendance.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
            </p>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="h-8 w-8 bg-blue-50 text-[#255A84] rounded-xl flex items-center justify-center mb-3">
            <Calendar size={16} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">My Batch</p>
          <p className="text-sm font-bold text-slate-800 capitalize">{userProfile?.batchId}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-3 ${userProfile?.isIntern ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`}>
            <Briefcase size={16} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Internship</p>
          <p className={`text-sm font-bold ${userProfile?.isIntern ? 'text-emerald-600' : 'text-slate-400'}`}>
            {userProfile?.isIntern ? 'Enrolled' : 'Not Active'}
          </p>
        </div>
      </div>
    </div>
  );
}
