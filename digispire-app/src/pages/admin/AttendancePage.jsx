import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp,
  doc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  QrCode, RefreshCw, Clock, Calendar, Users, ChevronRight,
  TrendingUp, CheckCircle2, History, Trash2, ArrowRight, Briefcase
} from 'lucide-react';
import QRCode from 'qrcode';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('morning'); // morning, evening, internship
  const [qrData, setQrData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, today: 0 });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecords(docs);

      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: docs.length,
        today: docs.filter(r => r.date === today).length
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const generateQR = async () => {
    const sessionId = Math.random().toString(36).substring(7);
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 mins

    const newQr = {
      type: activeTab === 'internship' ? 'internship' : 'academic',
      batchId: activeTab,
      sessionId,
      expiresAt,
      date: new Date().toISOString().split('T')[0]
    };

    try {
      const url = await QRCode.toDataURL(JSON.stringify(newQr), {
        width: 300,
        margin: 2,
        color: {
          dark: '#255A84',
          light: '#F8FAFC'
        }
      });
      setQrImageUrl(url);
      await setDoc(doc(db, 'qr_sessions', activeTab), newQr);
      setQrData(newQr);
      setTimeLeft(300);
    } catch (err) {
      console.error('QR Generation Error:', err);
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const deleteRecord = async (id) => {
    if (!window.confirm('Remove this attendance entry?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
      fetchRecords();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Center</h1>
          <p className="text-xs text-slate-500 font-medium">Manage check-ins for academic and internship tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
            <TrendingUp size={14} /> {stats.today} Check-ins Today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Generator Card */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 flex flex-col items-center text-center">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">QR Generator</h2>

          {/* Tab Switcher */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 w-full">
            {['morning', 'evening', 'internship'].map(t => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setQrData(null); setQrImageUrl(''); }}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === t ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t === 'internship' ? <Briefcase size={14} /> : null}
                {t}
              </button>
            ))}
          </div>

          <div className="relative group">
            <div className={`p-6 bg-slate-50 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${qrData ? 'border-[#255A84]/20' : 'border-slate-100'}`}>
              {qrImageUrl ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <img src={qrImageUrl} alt="QR Code" className="w-[180px] h-[180px] rounded-xl" />
                </div>
              ) : (
                <div className="w-[180px] h-[180px] flex flex-col items-center justify-center text-slate-300 gap-3">
                  <QrCode size={64} strokeWidth={1} />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select Mode</p>
                </div>
              )}
            </div>

            {qrData && (
              <div className="absolute -top-3 -right-3 h-10 w-10 bg-[#255A84] text-white rounded-2xl flex items-center justify-center text-xs font-bold shadow-lg shadow-[#255A84]/20">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          <button
            onClick={generateQR}
            className={`w-full mt-8 py-4 text-white rounded-2xl font-bold text-sm transition shadow-xl flex items-center justify-center gap-3 active:scale-95 ${activeTab === 'internship' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-[#255A84] shadow-[#255A84]/20'}`}
          >
            <RefreshCw size={18} className={timeLeft > 0 ? 'animate-spin' : ''} />
            {qrData ? 'Reset Code' : `Start ${activeTab} Session`}
          </button>
          <p className="mt-4 text-[10px] text-slate-400 font-medium italic">
            {activeTab === 'internship' ? '* Only enrolled interns can scan this.' : '* Only students in this batch can scan.'}
          </p>
        </div>

        {/* Live Feed Card */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <History size={18} className="text-[#255A84]" /> Live Feed
            </h2>
            <button onClick={fetchRecords} className="p-2 text-slate-400 hover:text-[#255A84] transition">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            {loading && records.length === 0 ? (
              <div className="py-20 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-[#255A84] border-t-transparent rounded-full" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 sticky top-0">
                  <tr>
                    <th className="text-left px-8 py-3">Student</th>
                    <th className="text-left px-4 py-3">Track</th>
                    <th className="text-left px-4 py-3">Time</th>
                    <th className="text-right px-8 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(record => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <p className="font-bold text-slate-800">{record.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.studentId}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          record.type === 'internship' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                          record.batchId === 'morning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {record.type === 'internship' ? 'Internship' : record.batchId}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-medium">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-300" />
                          {record.timestamp?.toDate ? record.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => deleteRecord(record.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
