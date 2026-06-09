import { useEffect, useState } from 'react';
import {
  collection, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../firebase';
import { 
  Plus, Search, Pencil, Trash2, X, Users, Phone, Lock, 
  Briefcase, Check, Calendar, Loader2
} from 'lucide-react';

function generateStudentId() {
  return 'DS' + Math.floor(100000 + Math.random() * 900000);
}

const emptyForm = { 
  name: '', 
  email: '', 
  phone: '', 
  batchIds: ['morning'], 
  isIntern: false, 
  studentId: '', 
  tempPassword: '',
  joiningDate: new Date().toISOString().split('T')[0],
  courseId: ''
};

function StatChip({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-1 min-w-[150px]">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
        <Icon size={18} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [topics, setTopics] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all'); // all, morning, evening, internship
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const fetchData = async () => {
    setLoading(true);
    
    try {
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      setStudents(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }

    try {
      const tSnap = await getDocs(collection(db, 'topics'));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }

    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }

    try {
      const mSnap = await getDocs(collection(db, 'modules'));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }

    try {
      const bSnap = await getDocs(collection(db, 'batches'));
      setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openAdd = () => {
    setForm({ 
      ...emptyForm, 
      studentId: generateStudentId(), 
      tempPassword: Math.floor(100000 + Math.random() * 900000).toString(),
      joiningDate: new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      batchIds: s.batchIds || (s.batchId ? [s.batchId] : ['morning']),
      isIntern: !!s.isIntern,
      studentId: s.studentId,
      tempPassword: '',
      joiningDate: s.joiningDate || new Date().toISOString().split('T')[0],
      courseId: s.courseId || ''
    });
    setEditingId(s.id);
    setShowModal(true);
  };

  const finalHandleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      alert("Name and Phone are required.");
      return;
    }

    setSaving(true);
    let secondaryApp;
    try {
      const cleanPhone = form.phone.replace(/[^0-9]/g, '');
      const studentEmail = `${cleanPhone}@digispire.in`;

      const selectedCourseObj = courses.find(c => c.id === form.courseId);
      const studentData = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        batchIds: form.batchIds || ['morning'],
        batchId: (form.batchIds && form.batchIds.length > 0) ? form.batchIds[0] : 'morning',
        isIntern: form.isIntern,
        studentId: form.studentId,
        joiningDate: form.joiningDate,
        courseId: form.courseId || '',
        course: selectedCourseObj ? selectedCourseObj.name : '',
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
    if (!window.confirm('Delete this student record? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'users', id));
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  };

  const calcProgress = (student) => {
    const studentUid = student.uid || student.id;
    if (!studentUid || topics.length === 0) return 0;
    if (student.courseId) {
      const courseModuleIds = modules.filter(m => m.courseId === student.courseId).map(m => m.id);
      const courseTopics = topics.filter(t => courseModuleIds.includes(t.moduleId));
      if (courseTopics.length === 0) return 0;
      const completed = courseTopics.filter(t => t.completedStudents?.includes(studentUid)).length;
      return Math.round((completed / courseTopics.length) * 100);
    }
    const completed = topics.filter(t => t.completedStudents?.includes(studentUid)).length;
    return Math.round((completed / topics.length) * 100);
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.studentId?.includes(q) || s.phone?.includes(q);
    
    if (filterBatch === 'all') return matchesSearch;
    if (filterBatch === 'internship') return matchesSearch && s.isIntern;
    const enrolledBatches = s.batchIds || (s.batchId ? [s.batchId] : []);
    return matchesSearch && enrolledBatches.includes(filterBatch);
  });

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Student Registry</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Manage profiles, joining dates, and batch enrolment</p>
        </div>
        <button onClick={openAdd} className="btn-primary-premium px-4 py-2.5 self-start sm:self-auto">
          <Plus size={16} /> New Student
        </button>
      </div>

      {/* Stats grid – 2 col on mobile, auto on wider */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatChip label="Total Students" value={students.length} icon={Users} color="bg-[#255A84]" />
        {batches.length === 0 ? (
          <>
            <StatChip label="Morning" value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes('morning')).length} icon={Users} color="bg-[#255A84]" />
            <StatChip label="Evening" value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes('evening')).length} icon={Users} color="bg-orange-500" />
          </>
        ) : (
          batches.filter(b => b.id !== 'internship').map((b, index) => (
            <StatChip
              key={b.id}
              label={b.name || b.id}
              value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes(b.id)).length}
              icon={Users}
              color={index % 2 === 0 ? "bg-orange-500" : "bg-[#255A84]"}
            />
          ))
        )}
        <StatChip label="Interns" value={students.filter(s => s.isIntern).length} icon={Briefcase} color="bg-emerald-500" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, or phone..."
              className="input-premium pl-10 text-sm"
            />
          </div>
          <div className="chip-scroll">
            {batches.length === 0 ? (
              ['all', 'morning', 'evening', 'internship'].map(b => (
                <button
                  key={b} onClick={() => setFilterBatch(b)}
                  className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap rounded-xl border ${
                    filterBatch === b ? 'bg-[#255A84] text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {b === 'all' ? 'All' : b === 'internship' ? 'Interns' : b}
                </button>
              ))
            ) : (
              ['all', ...batches.map(b => b.id), 'internship'].filter((val, idx, self) => self.indexOf(val) === idx).map(b => {
                const batchObj = batches.find(x => x.id === b);
                const label = b === 'all' ? 'All' : b === 'internship' ? 'Interns' : (batchObj?.name || b);
                return (
                  <button
                    key={b} onClick={() => setFilterBatch(b)}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap rounded-xl border ${
                      filterBatch === b ? 'bg-[#255A84] text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            )}
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
          <>
            {/* ── Desktop Table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="text-left px-6 py-3.5">Student Info</th>
                    <th className="text-left px-4 py-3.5">Batch Details</th>
                    <th className="text-left px-4 py-3.5">Progress</th>
                    <th className="text-right px-6 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(s => {
                    const progress = calcProgress(s);
                    return (
                      <tr key={s.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden shrink-0 bg-[#255A84]">
                              {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : s.name?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.studentId}</p>
                              {s.course && <p className="text-[10px] font-semibold text-[#255A84] mt-0.5 truncate max-w-[160px]">{s.course}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(s.batchIds || [s.batchId || 'morning']).map(bId => (
                              <span key={bId} className="badge-premium-blue">{batches.find(b => b.id === bId)?.name || bId}</span>
                            ))}
                            {s.isIntern && <span className="badge-premium-green">Intern</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Joined: {s.joiningDate || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 max-w-[100px]">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${s.isIntern ? 'bg-emerald-500' : 'bg-[#F48B1F]'} rounded-full transition-all`} style={{ width: `${calcProgress(s)}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 shrink-0">{calcProgress(s)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(s)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-[#255A84] rounded-lg transition active:scale-95 border border-slate-200">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition active:scale-95 disabled:opacity-50 border border-slate-200">
                              {deleting === s.id ? <Loader2 size={15} className="animate-spin text-red-400" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Card List ── */}
            <div className="md:hidden p-3 space-y-2.5">
              {filtered.map(s => {
                const progress = calcProgress(s);
                return (
                  <div key={s.id} className="student-card-mobile">
                    {/* Top row: avatar + info */}
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
                        {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : s.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">{s.studentId}</p>
                        {s.course && <p className="text-[10px] text-[#255A84] font-semibold mt-0.5 truncate">{s.course}</p>}
                      </div>
                      {/* Action buttons – always visible on touch */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => openEdit(s)}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-[#255A84] rounded-lg transition active:scale-90 border border-slate-200">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition active:scale-90 disabled:opacity-50 border border-slate-200">
                          {deleting === s.id ? <Loader2 size={13} className="animate-spin text-red-400" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Batch badges */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(s.batchIds || [s.batchId || 'morning']).map(bId => (
                        <span key={bId} className="badge-premium-blue">{batches.find(b => b.id === bId)?.name || bId}</span>
                      ))}
                      {s.isIntern && <span className="badge-premium-green">Intern</span>}
                      <span className="text-[10px] text-slate-400 font-medium ml-auto">Joined {s.joiningDate || '—'}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.isIntern ? 'bg-emerald-500' : 'bg-[#F48B1F]'} rounded-full`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{progress}% progress</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Enrollment/Update Modal */}
      {showModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowModal(false)}>
          <div className="modal-container-premium max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Update Student' : 'New Enrollment'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
            </div>
            <form onSubmit={finalHandleSave} className="flex flex-col h-full overflow-hidden">
              <div className="modal-body-premium space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name *</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="input-premium pl-11" placeholder="John Doe" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone *</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                      <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="input-premium pl-11" placeholder="+91..." />
                    </div>
                  </div>
                  {!editingId ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Set Password *</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                        <input required value={form.tempPassword} onChange={e => setForm(f => ({ ...f, tempPassword: e.target.value }))}
                          className="input-premium pl-11" placeholder="Access code" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student ID</label>
                      <input readOnly value={form.studentId} className="input-premium bg-slate-100 font-mono text-slate-400 cursor-not-allowed" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Enrolled Course Track *</label>
                  <select
                    required
                    value={form.courseId}
                    onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                    className="select-premium cursor-pointer"
                  >
                    <option value="">Select Course Track...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Joining Date *</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input required type="date" value={form.joiningDate} onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))}
                      className="input-premium pl-11" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Academic Batch(es) *</label>
                    <div className="grid grid-cols-2 gap-2 border border-slate-200/80 rounded-xl p-2.5 bg-slate-50/50">
                      {(batches.length === 0 ? [{id: 'morning', name: 'Morning'}, {id: 'evening', name: 'Evening'}] : batches.filter(b => b.id !== 'internship')).map(b => {
                        const isChecked = form.batchIds?.includes(b.id);
                        return (
                          <label key={b.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                            <input
                              type="checkbox"
                              className="rounded text-[#255A84] focus:ring-[#255A84] border-slate-300"
                              checked={isChecked}
                              onChange={(e) => {
                                setForm(f => {
                                  const currentBatchIds = f.batchIds || [];
                                  const nextBatchIds = e.target.checked
                                    ? [...currentBatchIds, b.id]
                                    : currentBatchIds.filter(id => id !== b.id);
                                  return { ...f, batchIds: nextBatchIds };
                                });
                              }}
                            />
                            <span className="text-xs font-bold text-slate-600">{b.name || b.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Internship</label>
                    <button
                      type="button" onClick={() => setForm(f => ({ ...f, isIntern: !f.isIntern }))}
                      className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                        form.isIntern 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {form.isIntern ? <Check size={14} /> : null}
                      {form.isIntern ? 'Enrolled' : 'Not Enrolled'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer-premium">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline-premium px-6 py-3">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary-premium px-6 py-3">
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
