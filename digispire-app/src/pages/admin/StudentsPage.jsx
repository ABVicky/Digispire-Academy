import { useEffect, useState } from 'react';
import {
  collection, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../firebase';
import { Plus, Search, Pencil, Trash2, X, Users, Phone, GraduationCap, Lock, ShieldCheck, TrendingUp, BarChart3, Briefcase, Check } from 'lucide-react';

function generateStudentId() {
  return 'DS' + Math.floor(100000 + Math.random() * 900000);
}

const emptyForm = { name: '', email: '', phone: '', batchId: 'morning', isIntern: false, course: '', studentId: '', tempPassword: '' };

function StatChip({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-1 min-w-[150px]">
      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${color} bg-opacity-10`}>
        <Icon size={18} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all'); // all, morning, evening, internship
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uSnap, tSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'topics'))
      ]);
      setStudents(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm({ ...emptyForm, studentId: generateStudentId(), tempPassword: Math.floor(100000 + Math.random() * 900000).toString() });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      batchId: s.batchId || 'morning',
      isIntern: !!s.isIntern,
      course: s.course || '',
      studentId: s.studentId,
      tempPassword: ''
    });
    setEditingId(s.id);
    setShowModal(true);
  };

  const finalHandleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    let secondaryApp;
    try {
      const cleanPhone = form.phone.replace(/[^0-9]/g, '');
      const studentEmail = `${cleanPhone}@digispire.in`;

      const studentData = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        batchId: form.batchId,
        isIntern: form.isIntern,
        course: form.course,
        studentId: form.studentId,
        role: 'student'
      };

      if (!editingId) {
        const secondaryAppName = `secondary-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, studentEmail, form.tempPassword);

        await setDoc(doc(db, 'users', userCred.user.uid), {
          ...studentData,
          uid: userCred.user.uid,
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'users', editingId), studentData);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.code === 'auth/email-already-in-use' ? 'Phone already registered.' : err.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student record?')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'users', id));
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  };

  const calcProgress = (studentUid) => {
    if (!studentUid || topics.length === 0) return 0;
    const completed = topics.filter(t => t.completedStudents?.includes(studentUid)).length;
    return Math.round((completed / topics.length) * 100);
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.studentId?.includes(q) || s.phone?.includes(q);
    
    if (filterBatch === 'all') return matchesSearch;
    if (filterBatch === 'internship') return matchesSearch && s.isIntern;
    return matchesSearch && s.batchId === filterBatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Student Management</h1>
          <p className="text-xs text-slate-500 font-medium">Manage morning, evening and internship tracks</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#255A84] hover:bg-[#1a4261] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-[#255A84]/10"
        >
          <Plus size={18} /> New Student
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <StatChip label="Morning" value={students.filter(s => s.batchId === 'morning').length} icon={Users} color="bg-[#255A84]" />
        <StatChip label="Evening" value={students.filter(s => s.batchId === 'evening').length} icon={Users} color="bg-orange-500" />
        <StatChip label="Interns" value={students.filter(s => s.isIntern).length} icon={Briefcase} color="bg-emerald-500" />
      </div>

      {/* List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['all', 'morning', 'evening', 'internship'].map(b => (
              <button
                key={b}
                onClick={() => setFilterBatch(b)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${filterBatch === b ? 'bg-[#255A84] text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">No students found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm responsive-table">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="text-left px-8 py-4">Student Info</th>
                  <th className="text-left px-6 py-4">Batch</th>
                  <th className="text-left px-6 py-4">Internship</th>
                  <th className="text-left px-6 py-4">Progress</th>
                  <th className="text-right px-8 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => {
                  const progress = calcProgress(s.uid || s.id);
                  return (
                    <tr key={s.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-8 py-4" data-label="Student Info">
                        <div className="flex items-center gap-4">
                          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden shrink-0 ${s.batchId === 'morning' ? 'bg-[#255A84]' : 'bg-orange-500'}`}>
                            {s.photoURL ? (
                              <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              s.name?.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{s.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4" data-label="Batch">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.batchId === 'morning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {s.batchId}
                        </span>
                      </td>
                      <td className="px-6 py-4" data-label="Internship">
                        {s.isIntern ? (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <Briefcase size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Active Intern</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4" data-label="Progress">
                        <div className="flex items-center gap-3 w-full sm:max-w-[120px]">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${s.isIntern ? 'bg-emerald-500' : 'bg-[#F48B1F]'} rounded-full`} style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right" data-label="Actions">
                        <div className="flex items-center justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(s)} className="p-3 text-slate-400 hover:text-[#255A84] hover:bg-white rounded-xl shadow-sm border border-slate-100 sm:border-transparent hover:border-slate-100 transition active:scale-95">
                            <Pencil size={18} />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl shadow-sm border border-slate-100 sm:border-transparent hover:border-slate-100 transition active:scale-95">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Update Student' : 'New Enrollment'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-300 hover:text-slate-500 transition"><X size={24} /></button>
            </div>
            <form onSubmit={finalHandleSave} className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name *</label>
                <div className="relative">
                  <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none" placeholder="John Doe" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none" placeholder="+91..." />
                  </div>
                </div>
                {!editingId ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Set Password *</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input required value={form.tempPassword} onChange={e => setForm(f => ({ ...f, tempPassword: e.target.value }))}
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none" placeholder="Access code" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student ID</label>
                    <input readOnly value={form.studentId} className="w-full px-4 py-4 bg-slate-100 border-transparent rounded-2xl text-sm text-slate-400 font-mono" />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Academic Batch</label>
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl">
                    {['morning', 'evening'].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, batchId: b }))}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${form.batchId === b ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-400'}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Internship</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isIntern: !f.isIntern }))}
                    className={`w-full py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                      form.isIntern 
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                        : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {form.isIntern ? <Check size={14} /> : null}
                    {form.isIntern ? 'Enrolled' : 'Not Enrolled'}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="w-full py-4 text-sm font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition active:scale-95">Cancel</button>
                <button type="submit" disabled={saving} className="w-full py-4 bg-[#255A84] hover:bg-[#1a4261] text-white text-sm font-bold rounded-2xl transition shadow-xl shadow-[#255A84]/20 active:scale-95">
                  {saving ? 'Processing...' : editingId ? 'Update Info' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
