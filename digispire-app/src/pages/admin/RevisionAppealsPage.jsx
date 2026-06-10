import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  History, Calendar, Check, Trash2, X, MessageSquare, Search,
  CheckCircle2, BookOpen, BookMarked, Clock
} from 'lucide-react';

export default function RevisionAppealsPage() {
  const { userProfile } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'resolved'
  const [search, setSearch] = useState('');
  const [resolveModal, setResolveModal] = useState(null); // appeal doc to resolve
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchAppeals = async () => {
    try {
      const q = query(collection(db, 'revision_appeals'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setAppeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching revision appeals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAppeals();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolveModal) return;
    setProcessing(true);
    try {
      const appealRef = doc(db, 'revision_appeals', resolveModal.id);
      await updateDoc(appealRef, {
        status: 'resolved',
        feedback: feedback.trim(),
        resolvedAt: serverTimestamp(),
        resolvedBy: userProfile?.name || 'Educator'
      });
      setResolveModal(null);
      setFeedback('');
      fetchAppeals();
    } catch (err) {
      console.error("Error resolving appeal:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this revision appeal request?")) return;
    try {
      await deleteDoc(doc(db, 'revision_appeals', id));
      fetchAppeals();
    } catch (err) {
      console.error("Error deleting appeal:", err);
    }
  };

  const filteredAppeals = appeals.filter(appeal => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'pending' && appeal.status === 'pending') || 
      (filter === 'resolved' && appeal.status === 'resolved');

    const searchStr = `${appeal.studentName} ${appeal.studentId} ${appeal.courseName} ${appeal.moduleTitle} ${appeal.topicTitle || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingCount = appeals.filter(a => a.status === 'pending').length;
  const resolvedCount = appeals.filter(a => a.status === 'resolved').length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium">Loading revision appeals...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Revision Appeals</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track and manage student revision requests for modules and topics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
            <History size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{appeals.length}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Requests</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending Action</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{resolvedCount}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Resolved</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Filter Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-2xl w-full md:w-auto">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'resolved', label: `Resolved (${resolvedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${filter === tab.id ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student or course..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:border-[#255A84] rounded-xl outline-none transition"
          />
        </div>
      </div>

      {/* Appeals List */}
      {filteredAppeals.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
          <History size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold">No revision requests found.</p>
          <p className="text-xs text-slate-400 mt-1">Requests matching current filters will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppeals.map(appeal => (
            <div
              key={appeal.id}
              className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200 ${appeal.status === 'pending' ? 'border-amber-100 ring-2 ring-amber-500/5' : 'border-slate-100'}`}
            >
              {/* Card Top / Metadata */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#255A84] font-bold uppercase text-sm">
                      {appeal.studentName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-none">{appeal.studentName}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">{appeal.studentId}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] font-bold text-[#255A84] uppercase tracking-wider">{appeal.studentBatch} Batch</span>
                      </div>
                    </div>
                  </div>
 
                  <div className="flex flex-col items-end gap-1.5">
                    {appeal.status === 'pending' ? (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-xl flex items-center gap-1 animate-pulse">
                        <Clock size={8} /> Pending
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <CheckCircle2 size={8} /> Resolved
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Calendar size={10} /> {appeal.createdAt ? new Date(appeal.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Subject of Appeal */}
                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <BookMarked size={12} className="text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Course:</span>
                    <span className="text-xs text-slate-800 font-bold">{appeal.courseName}</span>
                  </div>
                                    <div className="flex items-start gap-2">
                    {appeal.type === 'module' ? (
                      <BookOpen size={12} className="text-[#F48B1F] mt-0.5" />
                    ) : (
                      <History size={12} className="text-[#255A84] mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {appeal.type === 'module' ? 'Module' : 'Topic'} Revision Requested
                      </span>
                      <p className="text-xs text-slate-800 font-bold mt-0.5 truncate">
                        {appeal.type === 'module' ? appeal.moduleTitle : appeal.topicTitle}
                      </p>
                      {appeal.type === 'topic' && (
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                          Module: {appeal.moduleTitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
 
                {/* Notes by student */}
                {appeal.notes ? (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <MessageSquare size={10} /> Student Notes
                    </span>
                    <div className="bg-amber-50/30 border border-amber-100/50 rounded-xl p-3 text-xs text-slate-600 italic">
                      "{appeal.notes}"
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No notes provided by student.</p>
                )}

                {/* Resolution Details */}
                {appeal.status === 'resolved' && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-emerald-500" /> Resolution Details
                    </span>
                    <div className="bg-emerald-50/20 border border-emerald-100/40 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
                      {appeal.feedback && (
                        <p className="font-medium text-slate-700 italic">"{appeal.feedback}"</p>
                      )}
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Resolved by {appeal.resolvedBy} on {appeal.resolvedAt ? new Date(appeal.resolvedAt.seconds * 1000).toLocaleDateString('en-IN') : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Block */}
              {appeal.status === 'pending' && (
                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setResolveModal(appeal)}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10"
                  >
                    <Check size={14} /> Mark as Resolved
                  </button>
                  <button
                    onClick={() => handleDelete(appeal.id)}
                    className="px-3.5 py-2.5 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 active:scale-95 text-slate-400 rounded-xl transition"
                    title="Delete Request"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Resolution Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Resolve Revision Appeal</h3>
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">
                  Confirm Revision Session Completed
                </p>
              </div>
              <button 
                onClick={() => { setResolveModal(null); setFeedback(''); }}
                className="h-8 w-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95"
              >
                <X size={16} />
              </button>
            </div>
 
            <form onSubmit={handleResolve} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                <p><span className="font-bold text-slate-800">Student:</span> {resolveModal.studentName} ({resolveModal.studentId})</p>
                <p><span className="font-bold text-slate-800">Requested:</span> {resolveModal.type === 'module' ? `Module: ${resolveModal.moduleTitle}` : `Topic: ${resolveModal.topicTitle}`}</p>
              </div>
 
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Resolution Notes / Educator Feedback (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-slate-50/50"
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setResolveModal(null); setFeedback(''); }}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    'Mark as Resolved'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
