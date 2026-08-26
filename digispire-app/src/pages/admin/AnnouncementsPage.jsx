import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Megaphone, Plus, Search, Trash2, Edit3, Pin, PinOff,
  AlertTriangle, Bell, Clock, Users, CheckCircle2,
  X, Eye, ShieldAlert, Sparkles, Layers, ArrowRight, Check,
  Target, Info
} from 'lucide-react';

export default function AnnouncementsPage() {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  const [form, setForm] = useState({
    title: '',
    message: '',
    targetBatchIds: ['all'], // array of batch IDs or ['all']
    priority: 'normal', // normal | important | urgent
    pinned: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [annSnap, batchSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'announcements')),
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'users'))
      ]);

      const annList = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      annList.sort((a, b) => {
        if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      setAnnouncements(annList);
      setBatches(batchSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStudents(userSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'student'));
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Available Batch Options (including defaults)
  const allBatchOptions = useMemo(() => {
    const defaultList = [
      { id: 'morning', name: 'Morning Batch', defaultDesc: 'Regular Morning Track' },
      { id: 'evening', name: 'Evening Batch', defaultDesc: 'Regular Evening Track' },
      { id: 'internship', name: 'Internship Track', defaultDesc: 'Practical Internship Cohort' }
    ];

    const existingIds = new Set(batches.map(b => b.id));
    const merged = [...batches];
    defaultList.forEach(def => {
      if (!existingIds.has(def.id)) {
        merged.push(def);
      }
    });
    return merged;
  }, [batches]);

  // Calculate student count per batch
  const batchStudentCounts = useMemo(() => {
    const counts = {};
    allBatchOptions.forEach(b => {
      counts[b.id] = 0;
    });
    students.forEach(s => {
      const bIds = s.batchIds || (s.batchId ? [s.batchId] : ['morning']);
      bIds.forEach(bId => {
        counts[bId] = (counts[bId] || 0) + 1;
      });
      if (s.isIntern) {
        counts['internship'] = (counts['internship'] || 0) + 1;
      }
    });
    return counts;
  }, [students, allBatchOptions]);

  // Calculate target audience size for the current form selection
  const estimatedReach = useMemo(() => {
    if (form.targetBatchIds.includes('all')) {
      return students.length;
    }
    const matchingStudents = students.filter(s => {
      const bIds = s.batchIds || (s.batchId ? [s.batchId] : ['morning']);
      if (s.isIntern && !bIds.includes('internship')) bIds.push('internship');
      return form.targetBatchIds.some(targetId => bIds.includes(targetId));
    });
    return matchingStudents.length;
  }, [form.targetBatchIds, students]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      title: '',
      message: '',
      targetBatchIds: ['all'],
      priority: 'normal',
      pinned: false
    });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    // Support legacy targetBatchId string or new targetBatchIds array
    let targetBatchIds = ['all'];
    if (Array.isArray(item.targetBatchIds)) {
      targetBatchIds = item.targetBatchIds;
    } else if (item.targetBatchId) {
      targetBatchIds = [item.targetBatchId];
    }

    setForm({
      title: item.title || '',
      message: item.message || '',
      targetBatchIds,
      priority: item.priority || 'normal',
      pinned: !!item.pinned
    });
    setShowModal(true);
  };

  const toggleBatchSelection = (batchId) => {
    if (batchId === 'all') {
      setForm(prev => ({ ...prev, targetBatchIds: ['all'] }));
      return;
    }

    setForm(prev => {
      let current = prev.targetBatchIds.filter(id => id !== 'all');
      if (current.includes(batchId)) {
        current = current.filter(id => id !== batchId);
      } else {
        current.push(batchId);
      }
      if (current.length === 0) {
        current = ['all'];
      }
      return { ...prev, targetBatchIds: current };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      alert('Please provide both an announcement title and message.');
      return;
    }
    if (!form.targetBatchIds || form.targetBatchIds.length === 0) {
      alert('Please select at least one target batch.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        targetBatchIds: form.targetBatchIds,
        targetBatchId: form.targetBatchIds.length === 1 ? form.targetBatchIds[0] : (form.targetBatchIds.includes('all') ? 'all' : 'multi'),
        priority: form.priority,
        pinned: form.pinned,
        authorName: userProfile?.name || 'Academic Faculty',
        authorRole: userProfile?.role || 'educator',
        authorUid: userProfile?.uid || '',
        updatedAt: serverTimestamp()
      };

      if (!editingId) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'announcements'), payload);
      } else {
        await updateDoc(doc(db, 'announcements', editingId), payload);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving announcement:', err);
      alert('Failed to save announcement: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this broadcast notice?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting announcement:', err);
      alert('Failed to delete announcement.');
    }
  };

  const togglePin = async (item) => {
    try {
      await updateDoc(doc(db, 'announcements', item.id), {
        pinned: !item.pinned
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const renderBatchBadges = (item) => {
    const rawList = Array.isArray(item.targetBatchIds)
      ? item.targetBatchIds
      : (item.targetBatchId ? [item.targetBatchId] : ['all']);

    if (rawList.includes('all')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
          <Target size={11} className="text-[#1E3A5F]" /> All Batches (Global)
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {rawList.map(bId => {
          const bObj = allBatchOptions.find(b => b.id === bId);
          const label = bObj ? (bObj.name || bObj.id) : bId;
          const isMorning = bId.toLowerCase().includes('morning');
          const isEvening = bId.toLowerCase().includes('evening');
          const isIntern = bId.toLowerCase().includes('intern');

          const pillStyle = isMorning
            ? 'bg-orange-50 text-orange-700 border-orange-200'
            : isEvening
              ? 'bg-blue-50 text-[#1E3A5F] border-blue-200'
              : isIntern
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';

          return (
            <span
              key={bId}
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${pillStyle}`}
            >
              <Target size={10} /> {label}
            </span>
          );
        })}
      </div>
    );
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertTriangle size={11} className="shrink-0" /> Urgent Alert
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Bell size={11} className="shrink-0" /> Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A5F] border border-blue-100">
            <Megaphone size={11} className="shrink-0" /> Notice
          </span>
        );
    }
  };

  const filteredAnnouncements = announcements.filter(a => {
    const q = search.toLowerCase();
    const matchesSearch = !q || a.title?.toLowerCase().includes(q) || a.message?.toLowerCase().includes(q) || a.authorName?.toLowerCase().includes(q);
    
    const targetList = Array.isArray(a.targetBatchIds)
      ? a.targetBatchIds
      : (a.targetBatchId ? [a.targetBatchId] : ['all']);

    const matchesBatch = filterBatch === 'all' || targetList.includes('all') || targetList.includes(filterBatch);
    const matchesPriority = filterPriority === 'all' || a.priority === filterPriority;
    return matchesSearch && matchesBatch && matchesPriority;
  });

  const urgentCount = announcements.filter(a => a.priority === 'urgent').length;
  const importantCount = announcements.filter(a => a.priority === 'important').length;
  const pinnedCount = announcements.filter(a => a.pinned).length;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ─── Header ─── */}
      <div className="section-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Announcements & Notices</h1>
            <span className="badge-premium-blue">Batch Alerts</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Send announcements, class notices, and batch updates to students
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={openAdd}
            className="btn-primary-premium px-4 py-2.5 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* ─── Statistical Summary Chips ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#1E3A5F] flex items-center justify-center shrink-0">
            <Megaphone size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-800 leading-none font-mono">{announcements.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">Total Announcements</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-800 leading-none font-mono">{urgentCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">Urgent Alerts</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-800 leading-none font-mono">{importantCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">Important</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Pin size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-800 leading-none font-mono">{pinnedCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">Pinned</p>
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notices by title, message, or author..."
              className="input-premium pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Batch Filter Dropdown */}
            <select
              value={filterBatch}
              onChange={e => setFilterBatch(e.target.value)}
              className="select-premium text-xs cursor-pointer min-w-[160px]"
            >
              <option value="all">Filter by Target Batch (All)</option>
              <option value="morning">Morning Batch ({batchStudentCounts['morning'] || 0} students)</option>
              <option value="evening">Evening Batch ({batchStudentCounts['evening'] || 0} students)</option>
              <option value="internship">Internship Track ({batchStudentCounts['internship'] || 0} students)</option>
              {batches.filter(b => !['morning', 'evening', 'internship'].includes(b.id)).map(b => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="select-premium text-xs cursor-pointer min-w-[140px]"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent Alerts Only</option>
              <option value="important">Important Only</option>
              <option value="normal">Standard Notices</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Announcements Grid ─── */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin h-8 w-8 border-3 border-[#1E3A5F] border-t-transparent rounded-full" />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Megaphone size={24} />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">No Announcements Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || filterBatch !== 'all' || filterPriority !== 'all'
              ? 'No announcements match the active filter criteria. Try resetting your search filters.'
              : 'Broadcast your first batch-targeted notice by clicking "New Batch Announcement" above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnnouncements.map((item) => {
            const dateStr = item.createdAt?.seconds
              ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN', {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })
              : 'Just now';

            const borderHighlight = item.priority === 'urgent'
              ? 'border-rose-300 ring-2 ring-rose-500/10'
              : item.priority === 'important'
                ? 'border-amber-300 ring-2 ring-amber-500/10'
                : 'border-slate-200';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl p-5 border ${borderHighlight} shadow-2xs space-y-3.5 flex flex-col justify-between relative transition hover:shadow-xs`}
              >
                {/* Pinned Marker */}
                {item.pinned && (
                  <div className="absolute top-0 right-10 -translate-y-1/2 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <Pin size={10} /> Pinned Notice
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getPriorityBadge(item.priority)}
                        {renderBatchBadges(item)}
                      </div>
                      <h2 className="font-bold text-slate-800 text-base leading-snug tracking-tight pt-1">
                        {item.title}
                      </h2>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePin(item)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          item.pinned ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-400 hover:text-slate-600 border-slate-200'
                        }`}
                        title={item.pinned ? 'Unpin from Top' : 'Pin to Top of Dashboard'}
                      >
                        {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                      </button>
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 text-slate-400 hover:text-[#1E3A5F] rounded-lg border border-slate-200 transition cursor-pointer"
                        title="Student View Preview"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-[#1E3A5F] rounded-lg border border-slate-200 transition cursor-pointer"
                        title="Edit Announcement"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition cursor-pointer"
                        title="Delete Notice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal whitespace-pre-line line-clamp-4">
                    {item.message}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} />
                    <span>{dateStr}</span>
                  </div>
                  <div className="font-medium text-slate-500">
                    By: <span className="font-bold text-slate-700">{item.authorName}</span> ({item.authorRole})
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create / Edit Modal with Multi-Batch Selector ─── */}
      {showModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowModal(false)}>
          <div className="modal-container-premium max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-[#1E3A5F]" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {editingId ? 'Edit Batch Announcement' : 'Publish Batch-Targeted Announcement'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
              <div className="modal-body-premium space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                    Announcement Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Tomorrow's 10 AM Lecture Room Relocation"
                    className="input-premium text-xs"
                  />
                </div>

                {/* ─── Batch Targeting Selector Grid ─── */}
                <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Target Audience / Batches <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Estimated Reach: <strong className="text-[#1E3A5F]">{estimatedReach} Students</strong>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Select which batches will receive and see this alert on their dashboard:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {/* All Batches Option */}
                    <div
                      onClick={() => toggleBatchSelection('all')}
                      className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                        form.targetBatchIds.includes('all')
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`h-4 w-4 rounded flex items-center justify-center border ${
                          form.targetBatchIds.includes('all') ? 'bg-white text-[#1E3A5F] border-white' : 'border-slate-300 bg-slate-50'
                        }`}>
                          {form.targetBatchIds.includes('all') && <Check size={12} strokeWidth={3} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">All Batches (Global)</p>
                          <p className={`text-[10px] ${form.targetBatchIds.includes('all') ? 'text-slate-300' : 'text-slate-400'}`}>
                            Broadcast to entire academy
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        form.targetBatchIds.includes('all') ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {students.length} std
                      </span>
                    </div>

                    {/* Individual Batches */}
                    {allBatchOptions.map(b => {
                      const isSelected = !form.targetBatchIds.includes('all') && form.targetBatchIds.includes(b.id);
                      const stdCount = batchStudentCounts[b.id] || 0;

                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleBatchSelection(b.id)}
                          className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-4 w-4 rounded flex items-center justify-center border shrink-0 ${
                              isSelected ? 'bg-white text-[#1E3A5F] border-white' : 'border-slate-300 bg-slate-50'
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold leading-tight truncate">{b.name || b.id}</p>
                              <p className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                {b.startTime ? `${b.startTime} - ${b.endTime}` : (b.defaultDesc || 'Active Batch')}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {stdCount} std
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                      Priority Classification <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value })}
                      className="select-premium text-xs cursor-pointer"
                    >
                      <option value="normal">Standard Campus Notice</option>
                      <option value="important">Important Priority Notice</option>
                      <option value="urgent">Urgent Emergency Alert Banner</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                      Pinned Position
                    </label>
                    <div className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg min-h-[42px]">
                      <input
                        type="checkbox"
                        id="pinned-checkbox-form"
                        checked={form.pinned}
                        onChange={e => setForm({ ...form, pinned: e.target.checked })}
                        className="h-4 w-4 rounded text-[#1E3A5F] focus:ring-[#1E3A5F] border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="pinned-checkbox-form" className="text-xs text-slate-700 font-semibold cursor-pointer select-none">
                        Pin to top of student dashboard
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                    Announcement Message Body <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Provide full details, lecture links, room numbers, or deadline instructions..."
                    className="textarea-premium text-xs resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="modal-footer-premium">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline-premium text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-premium text-xs py-2 px-5"
                >
                  {saving ? 'Publishing Notice...' : (editingId ? 'Save Changes' : `Broadcast to ${estimatedReach} Students`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Student View Preview Modal ─── */}
      {previewItem && (
        <div className="modal-backdrop-premium" onClick={() => setPreviewItem(null)}>
          <div className="modal-container-premium max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Student Dashboard Alert Preview</span>
              <button onClick={() => setPreviewItem(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body-premium space-y-3">
              <div className="flex items-center justify-between pb-1">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  Targeted Batches:
                </p>
                {renderBatchBadges(previewItem)}
              </div>

              {/* Exact Replica of Student Alert Card */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                previewItem.priority === 'urgent'
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                  : previewItem.priority === 'important'
                    ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                    : 'bg-blue-50/90 border-blue-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {previewItem.priority === 'urgent' ? (
                      <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    ) : previewItem.priority === 'important' ? (
                      <Bell size={14} className="text-amber-700 shrink-0" />
                    ) : (
                      <Megaphone size={14} className="text-[#1E3A5F] shrink-0" />
                    )}
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                      {previewItem.priority === 'urgent' ? 'Urgent Academic Alert' : previewItem.priority === 'important' ? 'Faculty Notice' : 'Campus Bulletin'}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/60">
                    Live Banner
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-900 leading-snug">
                  {previewItem.title}
                </h4>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                  {previewItem.message}
                </p>

                <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Author: {previewItem.authorName}</span>
                  <span>Active Now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
