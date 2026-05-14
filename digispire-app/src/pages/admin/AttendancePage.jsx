import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp,
  doc, setDoc, deleteDoc, onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  QrCode, RefreshCw, Clock, Calendar, Users, ChevronRight,
  TrendingUp, CheckCircle2, History, Trash2, ArrowRight, Briefcase, X
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
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);

  const fetchCurriculum = async () => {
    try {
      const [cSnap, mSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules')),
        getDocs(collection(db, 'topics'))
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch curriculum:', err);
    }
  };

  useEffect(() => { 
    fetchCurriculum();
    setLoading(true);
    
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecords(docs);

      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: docs.length,
        today: docs.filter(r => r.date === today).length
      });
      setLoading(false);
    }, (err) => {
      console.error('Realtime sync error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const generateQR = async () => {
    const sessionId = Math.random().toString(36).substring(7);
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 mins

    const newQr = {
      type: activeTab === 'internship' ? 'internship' : 'academic',
      batchId: activeTab,
      sessionId,
      expiresAt,
      date: new Date().toISOString().split('T')[0],
      coveredCourse: selectedCourse,
      coveredModule: selectedModule,
      coveredTopics: selectedTopics
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
      
      // Log session permanently (wrapped in try-catch to not block UI if rules fail)
      try {
        await addDoc(collection(db, 'class_sessions'), {
          type: newQr.type,
          batchId: newQr.batchId,
          date: newQr.date,
          sessionId: newQr.sessionId,
          timestamp: serverTimestamp(),
          coveredCourse: selectedCourse,
          coveredModule: selectedModule,
          coveredTopics: selectedTopics
        });
      } catch (logErr) {
        console.error('Failed to log permanent session:', logErr);
      }

      setQrData(newQr);
      setTimeLeft(300);
    } catch (err) {
      console.error('QR Generation Error:', err);
    }
  };

  const discardQR = async () => {
    try {
      await deleteDoc(doc(db, 'qr_sessions', activeTab));
    } catch (err) {
      console.error('Failed to discard QR:', err);
    }
    setQrData(null);
    setQrImageUrl('');
    setTimeLeft(0);
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      if (qrData) discardQR();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, qrData]);

  const deleteRecord = async (id) => {
    if (!window.confirm('Remove this attendance entry?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Center</h1>
          <p className="text-xs text-slate-500 font-medium">Manage check-ins for academic and internship tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2 w-full sm:w-auto justify-center">
            <TrendingUp size={14} /> {stats.today} Check-ins Today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Generator Card */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8 flex flex-col items-center text-center">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">QR Generator</h2>

          {/* Tab Switcher */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 w-full overflow-x-auto no-scrollbar">
            {['morning', 'evening', 'internship'].map(t => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setQrData(null); setQrImageUrl(''); }}
                className={`flex-1 py-3 px-3 text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === t ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t === 'internship' ? <Briefcase size={14} /> : null}
                {t}
              </button>
            ))}
          </div>

          <div className="relative group w-full flex justify-center">
            <div className={`p-4 sm:p-6 bg-slate-50 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 w-full max-w-[240px] aspect-square flex items-center justify-center ${qrData ? 'border-[#255A84]/20' : 'border-slate-100'}`}>
              {qrImageUrl ? (
                <div className="animate-in fade-in zoom-in duration-300 w-full h-full">
                  <img src={qrImageUrl} alt="QR Code" className="w-full h-full rounded-xl object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300 gap-3">
                  <QrCode size={64} strokeWidth={1} />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select Mode</p>
                </div>
              )}
            </div>

            {qrData && (
              <div className="absolute -top-2 -right-2 h-11 w-11 bg-[#255A84] text-white rounded-2xl flex items-center justify-center text-xs font-bold shadow-lg shadow-[#255A84]/20">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Topic Selection */}
          {!qrData && (
            <div className="w-full text-left mt-6 space-y-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Curriculum Covered (Optional)</label>
              
              <select 
                value={selectedCourse} 
                onChange={e => { setSelectedCourse(e.target.value); setSelectedModule(''); setSelectedTopics([]); }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#255A84] bg-slate-50"
              >
                <option value="">Select Course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select 
                value={selectedModule} 
                onChange={e => { setSelectedModule(e.target.value); setSelectedTopics([]); }}
                disabled={!selectedCourse}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#255A84] bg-slate-50 disabled:opacity-50"
              >
                <option value="">Select Module...</option>
                {modules.filter(m => m.courseId === selectedCourse).map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>

              {selectedModule && (
                <div className="mt-2 max-h-32 overflow-y-auto no-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {topics.filter(t => t.moduleId === selectedModule).length === 0 ? (
                    <p className="text-xs text-slate-400 p-2 text-center">No topics found in this module.</p>
                  ) : (
                    topics.filter(t => t.moduleId === selectedModule).map(topic => (
                      <label key={topic.id} className="flex items-start gap-2 px-2 py-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                        <input 
                          type="checkbox" 
                          className="mt-0.5 rounded text-[#255A84] focus:ring-[#255A84] border-slate-300 flex-shrink-0"
                          checked={selectedTopics.includes(topic.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTopics(prev => [...prev, topic.id]);
                            else setSelectedTopics(prev => prev.filter(id => id !== topic.id));
                          }}
                        />
                        <span className="text-xs font-medium text-slate-700 leading-tight">{topic.title}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {qrData ? (
            <button
              onClick={discardQR}
              className="w-full mt-8 py-4.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-3 active:scale-95"
            >
              <X size={18} /> Discard Session
            </button>
          ) : (
            <button
              onClick={generateQR}
              className={`w-full mt-8 py-4.5 text-white rounded-2xl font-bold text-sm transition shadow-xl flex items-center justify-center gap-3 active:scale-95 ${activeTab === 'internship' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-[#255A84] shadow-[#255A84]/20'}`}
            >
              <RefreshCw size={18} />
              Start {activeTab} Session
            </button>
          )}
          <p className="mt-5 text-[9px] sm:text-[10px] text-slate-400 font-medium italic leading-relaxed">
            {activeTab === 'internship' ? '* Only enrolled interns can scan this.' : '* Only students in this batch can scan.'}
          </p>
        </div>

        {/* Live Feed Card */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <History size={18} className="text-[#255A84]" /> Live Feed
            </h2>
            <button onClick={fetchCurriculum} className="p-3 text-slate-400 hover:text-[#255A84] transition active:rotate-180 duration-500" title="Refresh Curriculum">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[60vh] sm:max-h-[500px]">
            {loading && records.length === 0 ? (
              <div className="py-20 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-[#255A84] border-t-transparent rounded-full" /></div>
            ) : (
              <table className="w-full text-sm responsive-table">
                <thead className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-8 py-3">Student</th>
                    <th className="text-left px-4 py-3">Track</th>
                    <th className="text-left px-4 py-3">Topic</th>
                    <th className="text-left px-4 py-3">Time</th>
                    <th className="text-right px-8 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(record => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4" data-label="Student">
                        <p className="font-bold text-slate-800">{record.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.studentId}</p>
                      </td>
                      <td className="px-4 py-4" data-label="Track">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          record.type === 'internship' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                          record.batchId === 'morning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {record.type === 'internship' ? 'Internship' : record.batchId}
                        </span>
                      </td>
                      <td className="px-4 py-4" data-label="Topic">
                        {record.coveredCourse ? (
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {courses.find(c => c.id === record.coveredCourse)?.name || 'Unknown Course'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {modules.find(m => m.id === record.coveredModule)?.title || 'Unknown Module'}
                              {record.coveredTopics?.length > 0 && ` • ${record.coveredTopics.length} Topics`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">General</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-medium" data-label="Time">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-300" />
                          <span className="text-xs">{record.timestamp?.toDate ? record.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right" data-label="Actions">
                        <button onClick={() => deleteRecord(record.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100 active:scale-90">
                          <Trash2 size={18} />
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
