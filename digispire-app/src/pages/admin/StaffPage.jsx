import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, query, where, setDoc, doc,
  updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../firebase';
import {
  Plus, Pencil, Trash2, X, Users, Mail, Lock,
  Search, Shield, GraduationCap, Loader2, Check, Phone
} from 'lucide-react';

const ROLES = [
  { id: 'admin', label: 'Admin', description: 'Full access to all modules', icon: Shield, color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'educator', label: 'Educator / Faculty', description: 'Manage attendance, curriculum, students', icon: GraduationCap, color: 'bg-blue-50 text-blue-600 border-blue-100' },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'educator',
  password: '',
};

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['admin', 'educator']))
      );
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (member) => {
    setForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'educator',
      password: '',
    });
    setEditingId(member.id);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      alert('Name and Email are required.');
      return;
    }
    if (!editingId && !form.password.trim()) {
      alert('Password is required for new staff accounts.');
      return;
    }

    setSaving(true);
    let secondaryApp;
    try {
      if (!editingId) {
        // Create Firebase Auth account in secondary app so current session is preserved
        const secondaryAppName = `staff-secondary-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password);

        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          createdAt: serverTimestamp(),
        });
      } else {
        // Update existing record (email/password not changeable here – use Firebase Console)
        await updateDoc(doc(db, 'users', editingId), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          updatedAt: serverTimestamp(),
        });
      }
      setShowModal(false);
      fetchStaff();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        alert('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        alert('Password must be at least 6 characters.');
      } else {
        alert('Error: ' + (err.message || 'Unknown error'));
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setSaving(false);
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Remove ${member.name} from staff? Their Firebase Auth account will NOT be deleted automatically — do that in Firebase Console if needed.`)) return;
    setDeleting(member.id);
    try {
      await deleteDoc(doc(db, 'users', member.id));
      setStaff(prev => prev.filter(s => s.id !== member.id));
    } catch (err) {
      console.error(err);
      alert('Failed to remove: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || s.role === filterRole;
    return matchSearch && matchRole;
  });

  const adminCount = staff.filter(s => s.role === 'admin').length;
  const educatorCount = staff.filter(s => s.role === 'educator').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Staff Management</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Add admins and educators, manage their roles and access</p>
        </div>
        <button onClick={openAdd} className="btn-primary-premium px-4 py-2.5 self-start sm:self-auto">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
            <Users size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-none">{staff.length}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
            <Shield size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-none">{adminCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Admins</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <GraduationCap size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-none">{educatorCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Faculty</p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="input-premium pl-10 text-sm"
          />
        </div>
        <div className="chip-scroll">
          {['all', 'admin', 'educator'].map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap transition-all ${
                filterRole === r ? 'bg-[#255A84] text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {r === 'all' ? 'All Staff' : r === 'admin' ? 'Admins' : 'Faculty'}
            </button>
          ))}
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">No staff found</p>
            <p className="text-xs text-slate-300 mt-1">Add your first admin or educator</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="text-left px-6 py-4">Staff Member</th>
                    <th className="text-left px-4 py-4">Role</th>
                    <th className="text-left px-4 py-4">Contact</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(member => {
                    const roleInfo = ROLES.find(r => r.id === member.role);
                    return (
                      <tr key={member.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
                              member.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {member.photoURL ? <img src={member.photoURL} alt={member.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{member.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${roleInfo?.color || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            {roleInfo && <roleInfo.icon size={11} />}
                            {roleInfo?.label || member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-500 font-medium">{member.phone || '—'}</p>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(member)}
                              className="p-2 hover:bg-blue-50 text-slate-400 hover:text-[#255A84] rounded-lg transition border border-slate-200 active:scale-90"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(member)}
                              disabled={deleting === member.id}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition border border-slate-200 active:scale-90 disabled:opacity-50"
                            >
                              {deleting === member.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden p-3 space-y-2.5">
              {filtered.map(member => {
                const roleInfo = ROLES.find(r => r.id === member.role);
                return (
                  <div key={member.id} className="student-card-mobile">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
                        member.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {member.photoURL ? <img src={member.photoURL} alt={member.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{member.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{member.email}</p>
                        {member.phone && <p className="text-[10px] text-slate-400 mt-0.5">{member.phone}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEdit(member)}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-[#255A84] rounded-lg transition active:scale-90 border border-slate-200"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={deleting === member.id}
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition active:scale-90 disabled:opacity-50 border border-slate-200"
                        >
                          {deleting === member.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className={`self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${roleInfo?.color || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                      {roleInfo && <roleInfo.icon size={11} />}
                      {roleInfo?.label || member.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowModal(false)}>
          <div className="modal-container-premium max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Staff Member' : 'Add New Staff'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
              <div className="modal-body-premium space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name *</label>
                  <div className="relative">
                    <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="input-premium pl-10"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Email Address * {editingId && <span className="text-[10px] normal-case text-slate-300">(cannot be changed)</span>}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      readOnly={!!editingId}
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="educator@digispire.in"
                      className={`input-premium pl-10 ${editingId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="input-premium pl-10"
                    />
                  </div>
                </div>

                {/* Password – only for new staff */}
                {!editingId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Set Password *</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Minimum 6 characters"
                        className="input-premium pl-10"
                        minLength={6}
                      />
                    </div>
                  </div>
                )}

                {/* Role Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Role & Access Level *</label>
                  <div className="space-y-2">
                    {ROLES.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, role: role.id }))}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          form.role === role.id
                            ? 'border-[#255A84] bg-blue-50/50 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          form.role === role.id ? 'bg-[#255A84] text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <role.icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold ${form.role === role.id ? 'text-[#255A84]' : 'text-slate-700'}`}>{role.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{role.description}</p>
                        </div>
                        {form.role === role.id && (
                          <div className="h-5 w-5 rounded-full bg-[#255A84] flex items-center justify-center shrink-0">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {!editingId && (
                  <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                      ⚡ A Firebase account will be created for this person. They can log in at <strong>Faculty Portal</strong> using the email and password you set.
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-footer-premium">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline-premium px-5 py-2.5">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary-premium px-5 py-2.5">
                  {saving ? 'Creating...' : editingId ? 'Save Changes' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
