import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, CheckCircle2, AlertCircle, RefreshCw, 
  Clock, Calendar, Briefcase, Camera, X
} from 'lucide-react';

export default function StudentAttendancePage() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error, processing
  const [message, setMessage] = useState('');
  const [lastAttendance, setLastAttendance] = useState(null);
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
      const data = JSON.parse(decodedText);
      const today = new Date().toISOString().split('T')[0];

      // 1. Validation Logic
      if (data.expiresAt < Date.now()) {
        throw new Error('QR Code has expired. Please ask your educator for a new one.');
      }

      if (data.type === 'internship') {
        if (!userProfile.isIntern) {
          throw new Error('You are not enrolled in the Internship track.');
        }
      } else {
        // Academic QR
        if (data.batchId !== userProfile.batchId) {
          throw new Error(`This QR is for the ${data.batchId} batch. Your batch is ${userProfile.batchId}.`);
        }
      }

      // 2. Duplicate Check
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', userProfile.studentId),
        where('date', '==', today),
        where('type', '==', data.type || 'academic')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`Attendance already marked for today's ${data.type || 'academic'} session.`);
      }

      // 3. Mark Attendance
      await addDoc(collection(db, 'attendance'), {
        studentId: userProfile.studentId,
        uid: userProfile.uid,
        name: userProfile.name,
        batchId: userProfile.batchId,
        isIntern: !!userProfile.isIntern,
        type: data.type || 'academic',
        date: today,
        timestamp: serverTimestamp(),
        sessionId: data.sessionId
      });

      setStatus('success');
      setMessage(`Successfully marked present for ${data.type || 'academic'} session!`);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Invalid QR code. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Check-in Terminal</h1>
        <p className="text-sm text-slate-500 font-medium">Scan the QR code shown by your educator</p>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden relative min-h-[400px] flex flex-col">
        {status === 'idle' && (
          <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="h-24 w-24 bg-blue-50 rounded-[2rem] flex items-center justify-center text-[#255A84] shadow-inner">
              <QrCode size={48} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Ready to Scan?</p>
              <p className="text-xs text-slate-400 mt-2 font-medium px-4 leading-relaxed">Ensure you are scanning the correct session (Academic or Internship)</p>
            </div>
            <button
              onClick={() => setStatus('scanning')}
              className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-2xl font-bold text-sm transition shadow-xl shadow-[#255A84]/20 flex items-center justify-center gap-3 active:scale-95"
            >
              <Camera size={20} /> Launch Scanner
            </button>
          </div>
        )}

        {status === 'scanning' && (
          <div className="relative flex-1 flex flex-col">
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
              {/* Custom Overlay */}
              <div className="w-[250px] h-[250px] border-2 border-white/20 rounded-[2rem] relative overflow-hidden">
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

        {status === 'processing' && (
          <div className="p-16 flex flex-col items-center gap-6">
            <div className="h-12 w-12 border-4 border-[#255A84] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Validating...</p>
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-300">
            <div className={`h-20 w-20 rounded-3xl flex items-center justify-center shadow-lg ${status === 'success' ? 'bg-emerald-50 text-emerald-500 shadow-emerald-500/20' : 'bg-red-50 text-red-500 shadow-red-500/20'}`}>
              {status === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
            </div>
            <div>
              <p className={`text-xl font-bold ${status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {status === 'success' ? 'Great!' : 'Oops!'}
              </p>
              <p className="text-xs text-slate-500 mt-2 font-medium px-4 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-black transition shadow-xl active:scale-95"
            >
              Return Home
            </button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="h-8 w-8 bg-blue-50 text-[#255A84] rounded-xl flex items-center justify-center mb-3">
            <Calendar size={16} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">My Batch</p>
          <p className="text-sm font-bold text-slate-800 capitalize">{userProfile?.batchId}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
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
