import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, CheckCircle2, AlertCircle, RefreshCw, 
  Clock, Calendar, Briefcase, Camera
} from 'lucide-react';

export default function StudentAttendancePage() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error
  const [message, setMessage] = useState('');
  const [lastAttendance, setLastAttendance] = useState(null);

  useEffect(() => {
    if (!userProfile?.studentId) return;

    const fetchLast = async () => {
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', userProfile.studentId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) setLastAttendance(snap.docs[0].data());
    };
    // Note: requires index, fallback to simple fetch
    getDocs(query(collection(db, 'attendance'), where('studentId', '==', userProfile.studentId)))
      .then(snap => {
        const sorted = snap.docs.map(d => d.data()).sort((a, b) => b.timestamp - a.timestamp);
        if (sorted[0]) setLastAttendance(sorted[0]);
      });
  }, [userProfile]);

  useEffect(() => {
    if (status === 'scanning') {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 });
      scanner.render(onScanSuccess, onScanError);
      return () => scanner.clear();
    }
  }, [status]);

  const onScanSuccess = async (decodedText) => {
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

  const onScanError = (err) => {
    // console.warn(err);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Check-in Terminal</h1>
        <p className="text-sm text-slate-500 font-medium">Scan the QR code shown by your educator</p>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        {status === 'idle' && (
          <div className="p-10 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="h-24 w-24 bg-blue-50 rounded-[2rem] flex items-center justify-center text-[#255A84] shadow-inner">
              <QrCode size={48} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Ready to Scan?</p>
              <p className="text-xs text-slate-400 mt-2 font-medium px-4">Ensure you are scanning the correct session (Academic or Internship)</p>
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
          <div className="p-6 space-y-6">
            <div id="qr-reader" className="overflow-hidden rounded-[2rem] border-2 border-[#255A84]/10 shadow-inner"></div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full py-4 bg-slate-50 text-slate-400 font-bold rounded-2xl text-sm hover:bg-slate-100 transition"
            >
              Cancel Scan
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
