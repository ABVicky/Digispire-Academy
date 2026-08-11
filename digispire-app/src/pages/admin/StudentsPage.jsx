import { useEffect, useState } from 'react';
import {
  collection, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../firebase';
import { 
  Plus, Search, Pencil, Trash2, X, Users, Phone, Lock, 
  Briefcase, Check, Calendar, Loader2, CreditCard, Download
} from 'lucide-react';
import QRCode from 'qrcode';
import { downloadCSV } from '../../utils/csvExport';

function generateStudentId() {
  return 'DS' + Math.floor(100000 + Math.random() * 900000);
}

function getBatchBadgeColor(bId, name = '') {
  const label = (name || bId || '').toLowerCase();
  if (label.includes('morning')) return 'badge-premium-orange';
  if (label.includes('evening')) return 'badge-premium-blue';
  if (label.includes('intern')) return 'badge-premium-green';
  return 'badge-premium-grey';
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
  courseId: '',
  mentorId: ''
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
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all'); // all, morning, evening, internship
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState(null);
  const [idCardQrCodeUrl, setIdCardQrCodeUrl] = useState('');
  const [isIdCardFlipped, setIsIdCardFlipped] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    if (selectedStudentForIdCard) {
      const payload = {
        uid: selectedStudentForIdCard.uid || selectedStudentForIdCard.id,
        name: selectedStudentForIdCard.name,
        role: selectedStudentForIdCard.role || 'student',
        studentId: selectedStudentForIdCard.studentId || '',
        phone: selectedStudentForIdCard.phone || ''
      };
      QRCode.toDataURL(JSON.stringify(payload), {
        margin: 1,
        width: 256
      })
      .then(url => {
        if (isSubscribed) setIdCardQrCodeUrl(url);
      })
      .catch(err => console.error('Error generating QR code:', err));
    }
    return () => {
      isSubscribed = false;
    };
  }, [selectedStudentForIdCard]);
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

    try {
      const staffSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'educator'])));
      setStaff(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch staff:', err);
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
      courseId: s.courseId || '',
      mentorId: s.mentorId || ''
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
        role: 'student',
        mentorId: form.mentorId || ''
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

  const handleDownloadStudents = () => {
    if (filtered.length === 0) {
      alert("No student records to download.");
      return;
    }

    const headers = [
      'Student ID',
      'Name',
      'Email',
      'Phone',
      'Course Track',
      'Assigned Mentor',
      'Joining Date',
      'Academic Batches',
      'Internship Enrolled',
      'Progress (%)'
    ];

    const rows = filtered.map(s => {
      const courseName = s.course || '—';
      const mentorName = s.mentorId ? (staff.find(m => m.id === s.mentorId)?.name || 'Loading...') : 'None';
      
      const academicBatches = (s.batchIds || [s.batchId || 'morning']).map(bId => {
        return batches.find(b => b.id === bId)?.name || bId;
      }).join(', ');

      const isInternEnrolled = s.isIntern ? 'Yes' : 'No';
      const progressValue = `${calcProgress(s)}%`;

      return [
        s.studentId || '',
        s.name || '',
        s.email || '',
        s.phone || '',
        courseName,
        mentorName,
        s.joiningDate || '—',
        academicBatches,
        isInternEnrolled,
        progressValue
      ];
    });

    const batchLabel = filterBatch === 'all' ? 'All_Batches' : filterBatch;
    const filename = `Student_Registry_${batchLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(headers, rows, filename);
  };

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Student Registry</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Manage profiles, joining dates, and batch enrolment</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button onClick={handleDownloadStudents} className="btn-outline-premium px-4 py-2.5 flex items-center gap-2">
            <Download size={15} /> Export Registry
          </button>
          <button onClick={openAdd} className="btn-primary-premium px-4 py-2.5 flex items-center gap-2">
            <Plus size={16} /> New Student
          </button>
        </div>
      </div>

      {/* Stats grid – 2 col on mobile, auto on wider */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatChip label="Total Students" value={students.length} icon={Users} color="bg-[#255A84]" />
        {batches.length === 0 ? (
          <>
            <StatChip label="Morning" value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes('morning')).length} icon={Users} color="bg-orange-500" />
            <StatChip label="Evening" value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes('evening')).length} icon={Users} color="bg-[#255A84]" />
          </>
        ) : (
          batches.filter(b => b.id !== 'internship').map((b) => (
            <StatChip
              key={b.id}
              label={b.name || b.id}
              value={students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes(b.id)).length}
              icon={Users}
              color={b.id.toLowerCase().includes('morning') ? "bg-orange-500" : "bg-[#255A84]"}
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
                    return (
                      <tr key={s.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden shrink-0 bg-[#255A84]">
                              {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{s.studentId}</p>
                              {s.course && <p className="text-[10px] font-semibold text-[#255A84] mt-0.5 truncate max-w-[160px]">{s.course}</p>}
                              {s.mentorId && (
                                <p className="text-[10px] font-bold text-emerald-600 mt-0.5 truncate max-w-[160px]">
                                  Mentor: {staff.find(m => m.id === s.mentorId)?.name || 'Loading...'}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(s.batchIds || [s.batchId || 'morning']).map(bId => {
                              const bName = batches.find(b => b.id === bId)?.name || bId;
                              return (
                                <span key={bId} className={getBatchBadgeColor(bId, bName)}>{bName}</span>
                              );
                            })}
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
                            <button onClick={() => { setSelectedStudentForIdCard(s); setShowIdCardModal(true); }} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition active:scale-95 border border-slate-200" title="View Digital ID">
                              <CreditCard size={15} />
                            </button>
                            <button onClick={() => openEdit(s)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-[#255A84] rounded-lg transition active:scale-95 border border-slate-200" title="Edit Student">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition active:scale-95 disabled:opacity-50 border border-slate-200" title="Delete Student">
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
                        {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">{s.studentId}</p>
                        {s.course && <p className="text-[10px] text-[#255A84] font-semibold mt-0.5 truncate">{s.course}</p>}
                        {s.mentorId && (
                          <p className="text-[10px] font-bold text-emerald-600 mt-0.5 truncate">
                            Mentor: {staff.find(m => m.id === s.mentorId)?.name || 'Loading...'}
                          </p>
                        )}
                      </div>
                      {/* Action buttons – always visible on touch */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setSelectedStudentForIdCard(s); setShowIdCardModal(true); }}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-50 text-slate-500 hover:text-slate-600 rounded-lg transition active:scale-90 border border-slate-200" title="View Digital ID">
                          <CreditCard size={13} />
                        </button>
                        <button onClick={() => openEdit(s)}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-[#255A84] rounded-lg transition active:scale-90 border border-slate-200" title="Edit Student">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition active:scale-90 disabled:opacity-50 border border-slate-200" title="Delete Student">
                          {deleting === s.id ? <Loader2 size={13} className="animate-spin text-red-400" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Batch badges */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(s.batchIds || [s.batchId || 'morning']).map(bId => {
                        const bName = batches.find(b => b.id === bId)?.name || bId;
                        return (
                          <span key={bId} className={getBatchBadgeColor(bId, bName)}>{bName}</span>
                        );
                      })}
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assigned Mentor / Educator</label>
                  <select
                    value={form.mentorId}
                    onChange={e => setForm(f => ({ ...f, mentorId: e.target.value }))}
                    className="select-premium cursor-pointer"
                  >
                    <option value="">No Mentor Assigned</option>
                    {staff.map(member => (
                      <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
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

      {/* ── DIGITAL ID CARD MODAL ── */}
      {showIdCardModal && selectedStudentForIdCard && (
        <div className="modal-backdrop-premium" onClick={() => setShowIdCardModal(false)}>
          <div className="modal-container-premium max-w-sm sm:max-w-md bg-transparent border-transparent shadow-none" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-t-2xl border-b border-white/10">
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">Identity Verification</span>
              <button onClick={() => setShowIdCardModal(false)} className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/10 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-900/60 backdrop-blur-md rounded-b-2xl flex flex-col items-center gap-5">
              {/* Flipping Card */}
              <div className="id-card-perspective w-80 h-[480px] cursor-pointer" onClick={() => setIsIdCardFlipped(!isIdCardFlipped)}>
                <div className={`id-card-inner rounded-3xl shadow-2xl ${isIdCardFlipped ? 'id-card-flipped' : ''}`}>
                  
                  {/* Card Front */}
                  <div className="id-card-front bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0">
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
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

                    <div className="text-center my-auto py-2 space-y-4">
                      <div className="h-28 w-28 rounded-2xl bg-white/5 p-1 border border-white/20 shadow-2xl mx-auto overflow-hidden relative">
                        {selectedStudentForIdCard.photoURL ? (
                          <img src={selectedStudentForIdCard.photoURL} alt={selectedStudentForIdCard.name} className="h-full w-full object-cover rounded-xl" />
                        ) : (
                          <div className="h-full w-full bg-white flex items-center justify-center rounded-xl p-2.5">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-heading font-extrabold text-white tracking-tight leading-snug">{selectedStudentForIdCard.name}</h3>
                        <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1.5 bg-emerald-500 text-white">
                          Student
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 flex items-end justify-between">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Identifier ID</p>
                          <p className="text-xs font-mono font-bold text-white tracking-wide">{selectedStudentForIdCard.studentId || 'DS000000'}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Enrolled Course</p>
                          <p className="text-[10px] font-semibold text-slate-200 truncate pr-4">{selectedStudentForIdCard.course || 'General Curriculum'}</p>
                        </div>
                      </div>
                      <div className="h-7 w-9 rounded bg-gradient-to-br from-yellow-300 to-yellow-600 opacity-60 border border-yellow-200/50 shadow-inner flex flex-col gap-0.5 p-1 shrink-0">
                        <div className="flex gap-1 h-full"><div className="w-1/2 border-r border-yellow-700/30"></div><div className="w-1/2"></div></div>
                      </div>
                    </div>
                  </div>

                  {/* Card Back */}
                  <div className="id-card-back bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="text-center border-b border-white/10 pb-2.5">
                      <h4 className="font-heading font-black tracking-wider text-xs leading-none">DIGISPIRE ACADEMY</h4>
                      <span className="text-[6px] text-slate-400 uppercase tracking-widest mt-1 block">Verification & Access</span>
                    </div>

                    <div className="my-auto text-center space-y-3">
                      <div className="w-36 h-36 bg-white p-2.5 rounded-2xl shadow-2xl flex items-center justify-center mx-auto border border-white/10 relative">
                        {idCardQrCodeUrl ? (
                          <img src={idCardQrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
                        ) : (
                          <div className="animate-pulse h-full w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-xs">
                            Generating...
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Scan for Verification</p>
                    </div>

                    <div className="border-t border-white/10 pt-3.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div>
                          <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Contact Phone</span>
                          <span className="font-semibold text-slate-200">{selectedStudentForIdCard.phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Enrolled Date</span>
                          <span className="font-semibold text-slate-200">{selectedStudentForIdCard.joiningDate || '—'}</span>
                        </div>
                      </div>

                      <p className="text-[7px] text-slate-400 leading-tight font-medium text-center pt-1">
                        This digital card certifies enrollment status. If found, please return to Admin Office.
                      </p>

                      <div className="flex justify-center items-center gap-0.5 opacity-30 pt-1">
                        {[1,3,2,1,4,2,1,3,2,1,4,1,2,3,1,2,4,1,2,3].map((w, i) => (
                          <div key={i} className="bg-white h-5" style={{ width: `${w}px` }} />
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Flip Button */}
              <button 
                type="button"
                onClick={() => setIsIdCardFlipped(!isIdCardFlipped)} 
                className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                Flip Card
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
